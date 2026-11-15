'use strict';
const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const fs = require('fs');
const cfg = require('./config');
const { analyzeText } = require('./filter');
const media = require('./media');

// System messages (joins, leaves, etc.) can't be deleted, so skip them. Already-deleted messages are 'revoked'.
const SKIP_TYPES = new Set(['gp2', 'notification_template', 'e2e_notification', 'protocol', 'revoked', 'call_log', 'ciphertext']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nowSec = () => Math.floor(Date.now() / 1000);

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: 'C:/Users/shour/AppData/Local/Google/Chrome/Application/chrome.exe',
  },
});

// ------------------------------------------------------------------ persistent state (for the start-up sweep)
const SW = cfg.sweep || {};
const SESSION_START = nowSec();   // the moment THIS run of the bot began. "Delete everything" users are only moderated from here on.
let lastActive = 0;
let savedTargets = [];
try {
  const st = JSON.parse(fs.readFileSync(SW.stateFile || 'state.json', 'utf8'));
  lastActive = st.lastActive || 0;
  savedTargets = Array.isArray(st.targetIds) ? st.targetIds : [];
} catch { /* first run */ }
function saveState() {
  try { fs.writeFileSync(SW.stateFile || 'state.json', JSON.stringify({ lastActive: nowSec(), targetIds: [...targetIds] })); } catch { /* ignore */ }
}

// ------------------------------------------------------------------ caches
const groupInfo = new Map();   // groupId -> { name, monitored, admins:Set }
const targetIds = new Set(savedTargets);   // sender ids already recognised as "delete everything" users (remembered across restarts)
const verdict = new Map();     // messageId -> 'clean' | 'deleted' | 'dry'
const inflight = new Set();    // messages being scanned right now (stops live + sweep scanning the same one twice)
function setVerdict(id, v) {
  if (!id) return;
  verdict.set(id, v);
  if (verdict.size > 20000) verdict.delete(verdict.keys().next().value);
}

let strikes = {};
try { strikes = JSON.parse(fs.readFileSync(cfg.actions.strikesFile, 'utf8')); } catch { /* first run */ }
function addStrike(id) {
  strikes[id] = (strikes[id] || 0) + 1;
  fs.writeFile(cfg.actions.strikesFile, JSON.stringify(strikes, null, 2), () => {});
  return strikes[id];
}
function logViolation(entry) {
  fs.appendFile(cfg.actions.logFile, JSON.stringify({ time: new Date().toISOString(), ...entry }) + '\n', () => {});
}

// ------------------------------------------------------------------ helpers
function extractText(msg, bodyOverride) {
  const d = msg._data || {};
  const parts = [bodyOverride ?? msg.body, msg.pollName ?? d.pollName, d.filename, d.caption, d.title, d.description];
  const options = msg.pollOptions ?? d.pollOptions ?? [];
  for (const o of options) parts.push(o && (o.name ?? o));
  if (msg.location) parts.push(msg.location.name, msg.location.address, msg.location.description);
  return parts.filter((p) => typeof p === 'string' && p).join('\n');
}

function adminSet(chat) {
  return new Set((chat.participants || []).filter((p) => p.isAdmin || p.isSuperAdmin).map((p) => p.id && p.id._serialized));
}
function remember(chat) {
  const monitored = cfg.monitorAllGroups || cfg.monitoredGroups.includes(chat.name);
  const info = { name: chat.name, monitored, admins: adminSet(chat) };
  groupInfo.set(chat.id._serialized, info);
  return info;
}

function quickTarget(senderId) {
  const b = cfg.blockAllFrom;
  if (!b || !b.enabled) return false;
  return targetIds.has(senderId) || (b.phones || []).some((p) => senderId.includes(p));
}
// A "delete everything" user is only moderated while the bot is running: messages sent BEFORE this run started
// (i.e. while the bot was switched off) are left alone. graceSeconds covers messages that arrive during start-up
// and tiny clock differences between your PC and WhatsApp.
function inBlockWindow(msg) {
  const b = cfg.blockAllFrom || {};
  if (b.onlyWhileRunning === false) return true;
  const grace = b.graceSeconds ?? 15;
  return (msg.timestamp || nowSec()) >= SESSION_START - grace;
}

function matchesBlockAll(contact, senderId) {
  const b = cfg.blockAllFrom;
  if (!b || !b.enabled) return false;
  const digits = (contact.number || '').replace(/\D/g, '');
  if ((b.phones || []).some((p) => senderId.includes(p) || digits.endsWith(p))) return true;
  const names = [contact.name, contact.pushname, contact.shortName].filter(Boolean).map((n) => n.toLowerCase());
  return names.some((n) => (b.names || []).some((t) => n.includes(t)));
}

// Deletes run up to 4 at a time, each retried, so a spam burst is cleared as fast as WhatsApp allows.
let active = 0;
const waiters = [];
async function withSlot(fn) {
  if (active >= 4) await new Promise((r) => waiters.push(r));
  active++;
  try { return await fn(); } finally { active--; const n = waiters.shift(); if (n) n(); }
}
async function deleteWithRetry(msg) {
  let last;
  for (let i = 0; i < 3; i++) {
    try { await msg.delete(true); return; } catch (e) { last = e; await sleep(600 * (i + 1)); }
  }
  throw last;
}

async function act({ msg, groupName, contact, senderId, reason, detail }) {
  const who = (contact && (contact.pushname || contact.name || contact.number)) || senderId;
  const snippet = (msg.body || `[${msg.type}]`).slice(0, 80).replace(/\s+/g, ' ');
  logViolation({ group: groupName, sender: who, senderId, type: msg.type, reason, detail, text: snippet, dryRun: !!cfg.actions.dryRun });

  if (cfg.actions.dryRun) {
    console.log(`[DRY RUN] would delete (${reason}) from ${who}: "${snippet}"  ${detail}`);
    return 'dry';
  }

  await withSlot(() => deleteWithRetry(msg));
  console.log(`Deleted (${reason}) from ${who}: "${snippet}"  ${detail}`);

  const a = cfg.actions;
  const count = addStrike(senderId);
  if (a.warnAfterStrikes && count === a.warnAfterStrikes) {
    const chat = await msg.getChat().catch(() => null);
    if (chat) await chat.sendMessage(`@${senderId.split('@')[0]} ${a.warnMessage}`, { mentions: [senderId] }).catch(() => {});
  }
  if (a.removeAfterStrikes && count >= a.removeAfterStrikes) {
    const chat = await msg.getChat().catch(() => null);
    if (chat) await chat.removeParticipants([senderId]).catch((e) => console.log('Could not remove member:', e.message));
  }
  return 'deleted';
}

// ------------------------------------------------------------------ the main handler
// returns: 'skip' | 'clean' | 'deleted' | 'dry' | 'failed'
async function handle(msg, opts = {}) {
  const id = msg && msg.id && msg.id._serialized;
  if (!opts.edited && id) {
    if (inflight.has(id)) return 'skip';
    inflight.add(id);
  }
  try { return await handleInner(msg, opts); }
  finally { if (!opts.edited && id) inflight.delete(id); }
}

async function handleInner(msg, { edited = false, newBody = null, chat: givenChat = null, sweep = false } = {}) {
  try {
    if (msg.fromMe || !msg.from || !msg.from.endsWith('@g.us')) return 'skip';
    if (SKIP_TYPES.has(msg.type)) return 'skip';

    const id = msg.id && msg.id._serialized;
    if (!edited && id && verdict.has(id)) return 'skip';

    const senderId = msg.author || msg.from;
    const gi = groupInfo.get(msg.from);
    if (gi && !gi.monitored) return 'skip';

    // ---- FAST PATH: a "delete everything" user in an already-known group -> delete immediately.
    if (gi && gi.monitored && quickTarget(senderId) && !(cfg.exemptAdmins && gi.admins.has(senderId))) {
      if (!inBlockWindow(msg)) { setVerdict(id, 'clean'); return 'skip'; }   // sent while the bot was off -> leave it
      const r = await act({ msg, groupName: gi.name, contact: null, senderId, reason: 'blocked-user', detail: 'fast' });
      setVerdict(id, r);
      return r;
    }

    // ---- normal path
    const chat = givenChat || await msg.getChat();
    if (!chat.isGroup) return 'skip';
    const info = remember(chat);
    if (!info.monitored) return 'skip';

    const contact = await msg.getContact();
    if (cfg.exemptAdmins && (info.admins.has(senderId) || info.admins.has(contact.id && contact.id._serialized))) {
      setVerdict(id, 'clean');
      return 'skip';
    }

    let reason = null;
    let detail = '';

    if (matchesBlockAll(contact, senderId)) {
      const isNew = !targetIds.has(senderId);
      targetIds.add(senderId);                   // next time this person is recognised instantly
      if (contact.id && contact.id._serialized) targetIds.add(contact.id._serialized);
      if (isNew) saveState();                    // ...even after a restart
      if (!inBlockWindow(msg)) { setVerdict(id, 'clean'); return 'skip'; }   // sent while the bot was off -> leave it
      reason = 'blocked-user';
    }

    if (!reason) {
      const res = analyzeText(extractText(msg, newBody));
      if (res.flagged) {
        reason = 'text';
        detail = `score ${res.score}: ` + res.hits.map((h) => `${h.label}(+${h.weight})`).join(', ');
      }
    }

    if (!reason && cfg.media.enabled && msg.hasMedia) {
      const r = await media.scanMessage(msg, { priority: sweep ? 'low' : 'high', ageSec: nowSec() - (msg.timestamp || nowSec()) });
      if (r) { reason = `media-${r.kind}`; detail = r.detail; }
    }

    if (!reason) {
      if (!edited) setVerdict(id, 'clean');
      return 'clean';
    }

    const result = await act({ msg, groupName: chat.name, contact, senderId, reason, detail });
    setVerdict(id, result);
    return result;
  } catch (err) {
    console.error('Error handling message:', err.message);
    return 'failed';                              // no verdict stored -> the next sweep retries it
  }
}

// ------------------------------------------------------------------ sweeps (safety net)
let sweeping = false;
async function monitoredChats() {
  const chats = await client.getChats();
  return chats.filter((c) => c.isGroup && (cfg.monitorAllGroups || cfg.monitoredGroups.includes(c.name)));
}

async function sweepOnce({ limit, sinceTs = 0, label }) {
  if (sweeping) return;
  sweeping = true;
  const stats = { checked: 0, deleted: 0, failed: 0 };
  try {
    for (const chat of await monitoredChats()) {
      remember(chat);
      let msgs;
      try { msgs = await chat.fetchMessages({ limit }); } catch (e) { console.log(`[${label}] could not read "${chat.name}":`, e.message); continue; }
      for (const m of msgs) {
        if (sinceTs && m.timestamp < sinceTs) continue;
        if (m.fromMe || SKIP_TYPES.has(m.type)) continue;
        stats.checked++;
        const r = await handle(m, { chat, sweep: true });
        if (r === 'deleted' || r === 'dry') stats.deleted++;
        if (r === 'failed') stats.failed++;
      }
    }
  } catch (e) {
    console.log(`[${label}] error:`, e.message);
  } finally {
    sweeping = false;
  }
  if (label === 'startup sweep' || stats.deleted || stats.failed) {
    console.log(`[${label}] checked ${stats.checked} messages, deleted ${stats.deleted}${stats.failed ? `, ${stats.failed} failed (will retry)` : ''}.`);
  }
}

// ------------------------------------------------------------------ login / status / events
client.on('qr', async (qr) => {
  await QRCode.toFile('qr.png', qr, { width: 400 });
  console.log('QR saved as qr.png. Open it and scan it now.');
});
client.on('loading_screen', (p, m) => console.log('Loading:', p, m));
client.on('authenticated', () => console.log('Authenticated!'));
client.on('auth_failure', (m) => console.log('Auth failed:', m));
client.on('disconnected', (r) => console.log('Disconnected:', r));

client.on('ready', async () => {
  console.log('Bot is online and moderating!');
  console.log(`Groups: ${cfg.monitorAllGroups ? 'ALL' : cfg.monitoredGroups.join(', ')} | threshold ${cfg.threshold}` +
    ` | dry-run ${cfg.actions.dryRun ? 'ON (nothing is deleted)' : 'off'}`);
  if (cfg.blockAllFrom && cfg.blockAllFrom.enabled) {
    console.log(`Delete-everything rule: ON from ${new Date(SESSION_START * 1000).toLocaleString()} until you stop the bot` +
      ` (messages sent while the bot was off are left alone).`);
  }
  if (cfg.media.enabled) media.init();            // warm up the image model in the background

  // learn the groups first so the fast path works from the very first live message
  try { for (const c of await monitoredChats()) remember(c); } catch { /* sweep will retry */ }

  if (SW.enabled) {
    // Other members' 18+ content: by default also re-checked for the time the bot was off (coverOfflineTimeForOthers).
    // Messages from "delete everything" users are never touched for that offline time (see inBlockWindow).
    const since = (SW.coverOfflineTimeForOthers === false)
      ? SESSION_START - ((cfg.blockAllFrom && cfg.blockAllFrom.graceSeconds) ?? 15)
      : (lastActive ? lastActive - (SW.marginSeconds || 300) : nowSec() - (SW.defaultLookbackHours || 24) * 3600);
    console.log(`Start-up sweep: re-checking messages since ${new Date(since * 1000).toLocaleString()} ...`);
    await sweepOnce({ limit: SW.startupLimit || 500, sinceTs: since, label: 'startup sweep' });
    setInterval(() => sweepOnce({ limit: SW.periodicLimit || 60, label: 'sweep' }), (SW.intervalSeconds || 30) * 1000);
  }
  saveState();
  setInterval(saveState, 15000);                  // remember when we were last running
});

client.on('message_create', (msg) => handle(msg));
client.on('message_edit', (msg, newBody) => handle(msg, { edited: true, newBody }));  // "send clean, edit to dirty"

process.on('unhandledRejection', (e) => console.error('Unhandled:', e && e.message ? e.message : e));
process.on('uncaughtException', (e) => console.error('Uncaught (bot keeps running):', e && e.message ? e.message : e));
process.on('SIGINT', () => { saveState(); process.exit(0); });

client.initialize();

if (require.main !== module) module.exports = { client, handle, sweepOnce };   // used only by tests
