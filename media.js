'use strict';
/**
 * Media scanner. Everything runs locally on your PC (free, no API keys):
 *
 *   1. VISION  - what the picture/GIF/video LOOKS like (kissing, nudity, banana ...)    [CLIP via @huggingface/transformers]
 *   2. OCR     - reads TEXT written inside images / stickers / GIF & video frames        [tesseract.js]
 *   3. SPEECH  - transcribes voice notes, audio files and video soundtracks to text      [Whisper via @huggingface/transformers]
 *
 * The OCR text and the transcript are then fed through the SAME word/emoji database as normal chat messages.
 *
 *   npm install @huggingface/transformers ffmpeg-static tesseract.js sharp
 *
 * Each part switches itself off (with a clear message) if its package is missing; the others keep working.
 * First start downloads the models once (CLIP ~150 MB, Whisper-base ~150 MB, OCR languages ~30 MB).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const cfg = require('./config');
const { analyzeText } = require('./filter');

const M = cfg.media;
const OCR = M.ocr || {};
const VOICE = M.voice || {};

// Test hooks: replace the heavy models with fakes (used by the mock tests, never needed normally).
const backends = { classify: null, ocr: null, transcribe: null };

// ---------------------------------------------------------------------------------
// Lazy loaders (each loads once, and turns itself OFF with a message if it cannot load)
// ---------------------------------------------------------------------------------
function lazy(name, hint, loader) {
  let state = 'idle', promise = null, value = null, retryAt = 0;
  return async function get() {
    if (state === 'ready') return value;
    if (state === 'off') {
      if (Date.now() < retryAt) return null;           // a failed load is retried every 10 minutes
      state = 'idle'; promise = null;
    }
    if (!promise) {
      promise = (async () => {
        try {
          value = await loader();
          state = 'ready';
          console.log(`[media] ${name}: ready.`);
          return value;
        } catch (e) {
          state = 'off';
          retryAt = Date.now() + 10 * 60 * 1000;
          console.log(`[media] ${name} is OFF: ${String(e.message).split('\n')[0]}`);
          if (hint) console.log(`[media]   to enable: ${hint}  (will retry automatically in 10 minutes)`);
          return null;
        }
      })();
    }
    return promise;
  };
}

const transformers = lazy('AI library', 'npm install @huggingface/transformers', () => import('@huggingface/transformers'));

const vision = lazy('image scanner (CLIP)', 'npm install @huggingface/transformers', async () => {
  const t = await transformers();
  if (!t) throw new Error('@huggingface/transformers not available');
  console.log('[media] Loading image model (first run downloads ~150 MB, please wait)...');
  return { clf: await t.pipeline('zero-shot-image-classification', M.model), RawImage: t.RawImage };
});

const ocrWorker = lazy('text-in-image reader (OCR)', 'npm install tesseract.js', async () => {
  const { createWorker } = require('tesseract.js');
  console.log('[media] Loading OCR (first run downloads language data)...');
  const langs = OCR.languages && OCR.languages.length ? OCR.languages : ['eng'];
  // errorHandler stops tesseract.js from throwing out of its worker thread (which would crash the whole bot)
  return createWorker(langs, 1, { errorHandler: (e) => console.log('[media] OCR problem:', String((e && e.message) || e).split('\n')[0]) });
});

const asr = lazy('voice transcriber (Whisper)', 'npm install @huggingface/transformers', async () => {
  const t = await transformers();
  if (!t) throw new Error('@huggingface/transformers not available');
  console.log(`[media] Loading speech model ${VOICE.model} (first run downloads it, please wait)...`);
  return t.pipeline('automatic-speech-recognition', VOICE.model);
});

let ffmpegWarned = false;
function ffmpegPath() {
  try { return M.ffmpegPath || require('ffmpeg-static'); } catch { /* fallthrough */ }
  if (!ffmpegWarned) {
    ffmpegWarned = true;
    console.log('[media] ffmpeg not found: GIF/video frames and voice notes cannot be read. Run: npm install ffmpeg-static');
  }
  return null;
}

let sharp = null;
try { sharp = require('sharp'); } catch { /* optional */ }

// ---------------------------------------------------------------------------------
// Priority queue: live messages always go before the start-up/periodic sweeps
// ---------------------------------------------------------------------------------
const queues = { high: [], low: [] };
let running = 0;
function pump() {
  if (running >= (M.parallel || 2)) return;
  const job = queues.high.shift() || queues.low.shift();
  if (!job) return;
  running++;
  job.fn().then(job.resolve, job.reject).finally(() => { running--; pump(); });
}
function enqueue(fn, priority) {
  return new Promise((resolve, reject) => { queues[priority === 'low' ? 'low' : 'high'].push({ fn, resolve, reject }); pump(); });
}

// ---------------------------------------------------------------------------------
// ffmpeg helpers
// ---------------------------------------------------------------------------------
function run(bin, args, timeout) {
  return new Promise((resolve) => execFile(bin, args, { timeout, windowsHide: true }, (err) => resolve(!err)));
}

async function withTemp(buffer, fn) {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'wabot-'));
  try {
    const input = path.join(dir, 'in.bin');
    await fs.promises.writeFile(input, buffer);
    return await fn(dir, input);
  } finally {
    fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Up to maxFrames JPEG frames (one per second) from a video or GIF. */
async function extractFrames(videoBuffer) {
  const bin = ffmpegPath();
  if (!bin) return [];
  return withTemp(videoBuffer, async (dir, input) => {
    await run(bin, ['-hide_banner', '-loglevel', 'error', '-y', '-i', input, '-vf', 'fps=1,scale=480:-2',
      '-frames:v', String(M.maxFrames || 3), path.join(dir, 'f%02d.jpg')], 25000);
    const files = (await fs.promises.readdir(dir)).filter((f) => f.endsWith('.jpg')).sort();
    return Promise.all(files.map((f) => fs.promises.readFile(path.join(dir, f))));
  });
}

/** Any audio/video file -> 16 kHz mono Float32Array (what Whisper needs). */
async function decodeAudio(buffer, maxSeconds) {
  const bin = ffmpegPath();
  if (!bin) return null;
  return withTemp(buffer, async (dir, input) => {
    const out = path.join(dir, 'out.raw');
    const ok = await run(bin, ['-hide_banner', '-loglevel', 'error', '-y', '-i', input, '-t', String(maxSeconds || 120),
      '-vn', '-ac', '1', '-ar', '16000', '-f', 'f32le', out], 30000);
    if (!ok) return null;
    const raw = await fs.promises.readFile(out).catch(() => null);
    if (!raw || raw.length < 4) return null;
    const copy = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength - (raw.byteLength % 4));
    return new Float32Array(copy);
  });
}

// ---------------------------------------------------------------------------------
// 1. VISION
// ---------------------------------------------------------------------------------
const ALL_TEXTS = [...M.unsafeGroups.flatMap((g) => g.texts), ...M.safeTexts];

async function classifyBuffer(buffer) {
  if (backends.classify) return backends.classify(buffer);
  const v = await vision();
  if (!v) return null;
  const img = await v.RawImage.fromBlob(new Blob([buffer]));
  const out = await v.clf(img, ALL_TEXTS);
  const prob = Object.fromEntries(out.map((r) => [r.label, r.score]));
  let worst = null;
  for (const g of M.unsafeGroups) {
    const total = g.texts.reduce((a, t) => a + (prob[t] || 0), 0);
    if (total >= g.threshold && (!worst || total / g.threshold > worst.ratio)) worst = { group: g.name, score: total, ratio: total / g.threshold };
  }
  if (M.debug) console.log('[media] vision top:', out.slice(0, 3).map((r) => `${r.label} ${(r.score * 100).toFixed(0)}%`).join(' | '));
  return worst;
}

// ---------------------------------------------------------------------------------
// 2. OCR
// ---------------------------------------------------------------------------------
async function prepareForOcr(buf, invert) {
  if (!sharp) return buf;
  try {
    const meta = await sharp(buf).metadata();
    const target = Math.min(OCR.maxSide || 1600, Math.max(1000, meta.width || 1000));
    let img = sharp(buf).rotate().resize({ width: target }).greyscale().normalise();
    if (invert) img = img.negate();
    return await img.png().toBuffer();
  } catch {
    return buf;
  }
}

const letterCount = (s) => (s.match(/\p{L}/gu) || []).length;
const cleanOcr = (t) => String(t || '').split('\n').filter((l) => letterCount(l) >= (OCR.minLettersPerLine || 3)).join('\n');

async function ocrBuffer(buffer) {
  if (backends.ocr) return backends.ocr(buffer);
  const w = await ocrWorker();
  if (!w) return '';
  let text = cleanOcr((await w.recognize(await prepareForOcr(buffer, false))).data.text);
  if (OCR.tryInverted !== false && letterCount(text) < 8) {            // light text on dark background reads badly
    const second = cleanOcr((await w.recognize(await prepareForOcr(buffer, true))).data.text);
    text = `${text}\n${second}`.trim();
  }
  return text;
}

// ---------------------------------------------------------------------------------
// 3. SPEECH
// ---------------------------------------------------------------------------------
async function transcribe(buffer) {
  const audio = await decodeAudio(buffer, VOICE.maxSeconds);
  if (!audio || audio.length < 4800) return '';                          // < 0.3 s
  if (backends.transcribe) return backends.transcribe(audio);
  const model = await asr();
  if (!model) return '';
  const langs = VOICE.languages && VOICE.languages.length ? VOICE.languages : [null];
  const texts = [];
  for (const lang of langs) {
    const opts = { chunk_length_s: 30, stride_length_s: 5, task: 'transcribe' };
    if (lang) opts.language = lang;                                       // null = let Whisper detect the language
    texts.push((await model(audio, opts)).text || '');
  }
  return texts.join('\n');
}

// ---------------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------------
function kindOf(msg) {
  if (msg.type === 'sticker') return 'stickers';
  if (msg.type === 'image') return 'images';
  if (msg.type === 'video') return msg.isGif ? 'gifs' : 'videos';
  if (msg.type === 'ptt') return 'voice';
  if (msg.type === 'audio') return 'audio';
  return null;
}

const snip = (t) => String(t).replace(/\s+/g, ' ').trim().slice(0, 60);
const hitList = (r) => r.hits.map((h) => `${h.label}(+${h.weight})`).join(', ');

async function scanNow(msg, kind) {
  const media = await msg.downloadMedia();
  if (!media || !media.data) return null;
  const buffer = Buffer.from(media.data, 'base64');
  if (buffer.length > M.maxBytes) return null;
  const mime = media.mimetype || '';

  // ---- pictures, stickers, GIFs, videos: look at them, then read any text in them
  if (kind !== 'voice' && kind !== 'audio') {
    let frames;
    if (mime.startsWith('video/') || mime === 'image/gif') {
      frames = await extractFrames(buffer);
      if (!frames.length && mime === 'image/gif') frames = [buffer];
    } else {
      frames = [buffer];
    }

    if (M.vision !== false) {
      for (const f of frames) {
        const r = await classifyBuffer(f);
        if (r) return { kind: 'vision', detail: `looks like ${r.group} ${(r.score * 100).toFixed(0)}%` };
      }
    }
    if (OCR.enabled !== false) {
      for (const f of frames.slice(0, OCR.maxFrames || 2)) {
        const text = await ocrBuffer(f);
        if (!text) continue;
        const res = analyzeText(text);
        if (res.flagged) return { kind: 'ocr', detail: `text inside image "${snip(text)}" -> ${hitList(res)}` };
      }
    }
  }

  // ---- voice notes, audio files, video soundtracks: transcribe, then judge the words
  const wantsSpeech = VOICE.enabled !== false &&
    (kind === 'voice' || kind === 'audio' || (kind === 'videos' && VOICE.scanVideoAudio));
  if (wantsSpeech) {
    const text = await transcribe(buffer);
    if (text && text.trim()) {
      const res = analyzeText(text);
      if (M.debug) console.log(`[media] transcript: "${snip(text)}" score ${res.score}`);
      if (res.flagged) return { kind: 'speech', detail: `spoken "${snip(text)}" -> ${hitList(res)}` };
    }
  }
  return null;
}

/**
 * @param {object} msg   whatsapp-web.js Message
 * @param {{priority?:'high'|'low', ageSec?:number}} opts   'low' = sweep (old media beyond sweepMaxAgeMinutes is skipped)
 * @returns {Promise<null | {kind:'vision'|'ocr'|'speech', detail:string}>}
 */
async function scanMessage(msg, opts = {}) {
  const kind = kindOf(msg);
  if (!kind || !M.scan[kind]) return null;
  if (opts.priority === 'low' && opts.ageSec > (M.sweepMaxAgeMinutes || 1440) * 60) return null;
  return enqueue(async () => {
    try { return await scanNow(msg, kind); }
    catch (e) { console.log('[media] scan error:', e.message); return null; }
  }, opts.priority);
}

/** Load the models in the background at start-up so the first real message is not slow. */
async function init() {
  if (!M.enabled) return;
  if (M.vision !== false) await vision();
  if (OCR.enabled !== false) await ocrWorker();
  if (VOICE.enabled !== false) await asr();
  ffmpegPath();
}

module.exports = { scanMessage, init, _test: { backends, extractFrames, decodeAudio, prepareForOcr, kindOf } };
