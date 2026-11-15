'use strict';
const W = require('./wordlists');
const cfg = require('./config');

// ---------------------------------------------------------------------------------
// 1. Regex building
// ---------------------------------------------------------------------------------
const SEP = '[\\s._\\-]*';
const SUFFIX = '(?:s|es|ed|er|ers|ing|in)?';

// Letters that can be disguised. Vowels also accept * # style masking (f*ck, b**bs).
const LEET = {
  a: 'a@4*', e: 'e3*', i: 'i1!|*', o: 'o0*', u: 'uv*',
  s: 's5$', t: 't7+', b: 'b8', g: 'g9', l: 'l1|', z: 'z2',
};

const escapeRe = (c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Normalise native-script text/terms the same way, so they always compare equal. */
const nativeNormalize = (s) =>
  String(s)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF\u00AD]/g, '');

const CONFUSABLES = {
  'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', 'у': 'y', 'і': 'i', 'ј': 'j',
  'ѕ': 's', 'һ': 'h', 'к': 'k', 'м': 'm', 'т': 't', 'ս': 'u',
  'ο': 'o', 'α': 'a', 'ε': 'e', 'ν': 'v', 'ι': 'i', 'κ': 'k', 'ρ': 'p', 'τ': 't',
  // small-caps lookalikes (ᴍᴀᴅᴀʀᴄʜᴏᴅ)
  'ᴀ': 'a', 'ʙ': 'b', 'ᴄ': 'c', 'ᴅ': 'd', 'ᴇ': 'e', 'ꜰ': 'f', 'ɢ': 'g', 'ʜ': 'h', 'ɪ': 'i',
  'ᴊ': 'j', 'ᴋ': 'k', 'ʟ': 'l', 'ᴍ': 'm', 'ɴ': 'n', 'ᴏ': 'o', 'ᴘ': 'p', 'ʀ': 'r', 'ꜱ': 's',
  'ᴛ': 't', 'ᴜ': 'u', 'ᴠ': 'v', 'ᴡ': 'w', 'ʏ': 'y', 'ᴢ': 'z',
};

const CONFUSABLE_RE = new RegExp('[' + Object.keys(CONFUSABLES).join('') + ']', 'g');

function latinNormalize(native) {
  let s = native.replace(CONFUSABLE_RE, (c) => CONFUSABLES[c]);
  s = s.normalize('NFD').replace(/(?<=[a-z])[\u0300-\u036f]+/g, '').normalize('NFC');
  return s;
}

const capRuns = (s) => s.replace(/(.)\1{4,}/gsu, '$1$1$1$1').replace(/\s+/g, ' ');

/** "f u c k" / "s.e.x" / "b-o-o-b-s"  ->  "fuck" / "sex" / "boobs"  (3+ single characters in a row) */
function joinSpaced(s) {
  return s.replace(
    /(?<![a-z0-9@$!])(?:[a-z0-9@$!][\s._\-*,]{1,2}){2,}[a-z0-9@$!](?![a-z0-9@$!])/g,
    (m) => m.replace(/[\s._\-*,]/g, '')
  );
}

function compileLatin(term, weight) {
  let t = term.trim().toLowerCase();
  let sub = false;
  if (t[0] === '~') { sub = true; t = t.slice(1); }
  const parts = [];
  let letters = 0;
  for (let i = 0; i < t.length;) {
    const ch = t[i];
    if (ch === ' ') { parts.push(SEP); i++; continue; }
    let j = i;
    while (j < t.length && t[j] === ch) j++;
    const k = j - i;
    const cls = LEET[ch] ? `[${LEET[ch]}]` : escapeRe(ch);
    parts.push(k === 1 ? `${cls}+` : `${cls}{${k},}`);
    letters += k;
    i = j;
  }
  const body = parts.join('');
  const src = sub ? body : `(?<![a-z])${body}${SUFFIX}(?![a-z])`;
  return {
    id: `L:${term}`, label: term, weight, view: 'latin',
    re: new RegExp(src, 'gu'),
    minLetters: Math.max(2, Math.ceil(letters / 2)),
  };
}

function compileNative(term, weight) {
  let t = nativeNormalize(term.trim());
  let sub = false;
  if (t[0] === '~') { sub = true; t = t.slice(1); }
  const body = t.split(' ').map(escapeRe).join('[\\s._\\-]*');
  const src = sub ? body : `(?<![\\p{L}\\p{M}])${body}(?![\\p{L}\\p{M}])`;
  return { id: `N:${term}`, label: term.replace('~', ''), weight, view: 'native', re: new RegExp(src, 'gu'), minLetters: 0 };
}

function compileRegex(entry) {
  return { id: `R:${entry.label}`, label: entry.label, weight: entry.w, view: 'latin', re: new RegExp(entry.re, 'gu'), minLetters: 0 };
}

// ---------------------------------------------------------------------------------
// 2. Build everything once at start-up
// ---------------------------------------------------------------------------------
const extra = cfg.extraWords || {};
function dedupe(lists) {            // term -> highest weight
  const m = new Map();
  for (const [weight, arr] of lists) for (const t of arr) m.set(t, Math.max(m.get(t) || 0, weight));
  return m;
}

const latinTerms = [];
for (const [term, weight] of dedupe([
  [3, W.STRONG], [2, W.MEDIUM], [1, W.WEAK],
  [3, extra.strong || []], [2, extra.medium || []], [1, extra.weak || []],
])) latinTerms.push(compileLatin(term, weight));
for (const r of W.REGEX) latinTerms.push(compileRegex(r));

const nativeTerms = [];
for (const [term, weight] of dedupe([[3, W.NATIVE_STRONG], [2, W.NATIVE_MEDIUM], [1, W.NATIVE_WEAK]]))
  nativeTerms.push(compileNative(term, weight));

const safeList = [...W.SAFE_WORDS, ...(extra.safe || [])];
const SAFE_RE = safeList.length
  ? new RegExp(`(?<![a-z])(?:${safeList.map((w) => w.split(' ').map(escapeRe).join(SEP)).join('|')})(?![a-z])`, 'gu')
  : null;

const EMOJI = Object.assign({}, W.EMOJI, cfg.extraEmoji || {});

// ---------------------------------------------------------------------------------
// 3. Matching
// ---------------------------------------------------------------------------------
function runTerms(list, view, found, kind) {
  for (const t of list) {
    if (found.has(t.id)) continue;
    t.re.lastIndex = 0;
    let m;
    while ((m = t.re.exec(view)) !== null) {
      if (m[0].length === 0) { t.re.lastIndex++; continue; }
      if (t.minLetters) {
        const n = (m[0].match(/[a-z]/g) || []).length;
        if (n < t.minLetters) continue;      // e.g. "455" must not count as "ass"
      }
      found.set(t.id, { label: t.label, weight: t.weight, kind });
      break;
    }
  }
}

function scoreEmoji(raw, found) {
  const s = raw.replace(/[\uFE0E\uFE0F\u{1F3FB}-\u{1F3FF}]/gu, '');
  for (const [e, w] of Object.entries(EMOJI)) {
    if (!w) continue;
    const n = s.split(e).length - 1;
    if (n > 0) found.set(`E:${e}`, { label: e, weight: w * Math.min(n, 2), kind: 'emoji' });
  }
  for (const c of W.EMOJI_COMBOS) if (c.re.test(s)) found.set(`E:${c.label}`, { label: c.label, weight: c.w, kind: 'emoji' });
}

/**
 * Analyse a piece of text.
 * @returns {{score:number, flagged:boolean, hits:{label:string,weight:number,kind:string}[]}}
 */
function analyzeText(raw, opts = {}) {
  const threshold = opts.threshold ?? cfg.threshold;
  const text = String(raw || '').slice(0, cfg.maxTextLength || 4000);
  if (!text.trim()) return { score: 0, flagged: false, hits: [] };

  const found = new Map();
  scoreEmoji(text, found);

  const native = capRuns(nativeNormalize(text));
  let latin = latinNormalize(native);
  if (SAFE_RE) latin = latin.replace(SAFE_RE, ' ');
  const joined = joinSpaced(latin);

  runTerms(latinTerms, latin, found, 'text');
  if (joined !== latin) runTerms(latinTerms, joined, found, 'spaced');
  runTerms(nativeTerms, native, found, 'native');

  let score = 0;
  let evaded = false;
  for (const h of found.values()) { score += h.weight; if (h.kind === 'spaced') evaded = true; }
  if (evaded) score += 1;                       // deliberately spelling it out is itself a red flag

  const hits = [...found.values()];
  return { score, flagged: score >= threshold, hits };
}

module.exports = { analyzeText, nativeNormalize, latinNormalize };
