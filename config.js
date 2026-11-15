'use strict';
/**
 * ALL SETTINGS LIVE HERE. You normally never need to touch the other files.
 */
module.exports = {
  // ---------------------------------------------------------------- WHERE
  monitoredGroups: ['The Anime Warriors of IX'], // exact group names (as shown in WhatsApp)
  monitorAllGroups: false,                       // true = watch every group you are in
  exemptAdmins: true,                            // never delete messages from group admins

  // ---------------------------------------------------------------- TEXT FILTER
  // Each hit has a weight (STRONG 3, MEDIUM 2, WEAK 1). Message is deleted when total >= threshold.
  // 3 = a single strong word deletes, two medium words delete.  4 = stricter on borderline words.
  threshold: 3,
  maxTextLength: 4000,

  // Add your own without touching wordlists.js. Lower-case letters only, same rules as wordlists.js.
  extraWords: {
    strong: [],   // e.g. ['somebadword']
    medium: [],
    weak: [],
    safe: [],     // words that must NEVER count (e.g. a friend's name that looks rude)
  },
  extraEmoji: {}, // e.g. { '🍎': 2 }  (emoji -> weight)

  // ---------------------------------------------------------------- "DELETE EVERYTHING" USERS
  // EVERYTHING these people send in a monitored group is deleted (beer emojis, 18+ stuff, GIFs, plain text, all of it),
  // and deleted on a fast path that skips most lookups. Carried over from the earlier bot.
  blockAllFrom: {
    enabled: true,
    phones: ['7003323022'],                 // without country code
    names: ['mota arya', 'arya mandal'],
    // true = only messages sent WHILE THE BOT IS RUNNING are deleted (from the moment you start it until you stop it).
    //        Anything they sent while the bot was off is left alone, even after a restart.
    onlyWhileRunning: true,
    graceSeconds: 0,   // messages up to this many seconds before start-up still count (start-up delay / clock differences)
  },

  // ---------------------------------------------------------------- SWEEPS (safety net)
  // The bot reacts instantly to new messages, but also re-checks recent history so nothing slips through:
  //  - once at start-up, covering everything since the bot was last running (including time it was OFF)
  //  - every `intervalSeconds` while running (catches messages WhatsApp Web delivered late or a failed delete)
  sweep: {
    enabled: true,
    intervalSeconds: 30,
    periodicLimit: 60,        // newest N messages per group re-checked every interval
    startupLimit: 500,        // newest N messages per group checked at start-up
    defaultLookbackHours: 24, // first ever run (no previous run known): look back this far
    marginSeconds: 300,       // extra overlap before the last known run, to be safe
    stateFile: 'state.json',
    // true  = at start-up, other members' 18+ content is also re-checked for the time the bot was OFF.
    // false = only content posted since this run started is checked.
    // (Messages from the "delete everything" users above are never touched for offline time either way.)
    coverOfflineTimeForOthers: true,
  },

  // ---------------------------------------------------------------- ACTIONS
  actions: {
    dryRun: false,           // true = only LOG what would be deleted, delete nothing (good for tuning)
    logFile: 'violations.log',
    strikesFile: 'strikes.json',
    warnAfterStrikes: 0,     // e.g. 3 = reply with a warning on the 3rd deleted message (0 = off)
    warnMessage: 'Explicit / 18+ content is not allowed in this group.',
    removeAfterStrikes: 0,   // e.g. 10 = remove the member after 10 deleted messages (0 = off)
  },

  // ---------------------------------------------------------------- MEDIA SCANNING (all runs locally on your PC, free)
  //   1. VISION - what the picture / GIF / video looks like (kissing, nudity, banana ...)
  //   2. OCR    - reads TEXT written inside images, stickers, and GIF/video frames
  //   3. SPEECH - transcribes voice notes, audio files and video soundtracks
  // The OCR text and transcripts go through the SAME word + emoji database as normal chat messages.
  // Install once:  npm install @huggingface/transformers ffmpeg-static tesseract.js sharp
  // Any part whose package is missing switches itself off (with a message); the rest keeps working.
  media: {
    enabled: true,
    scan: { images: true, stickers: true, gifs: true, videos: true, voice: true, audio: true },
    vision: true,                 // part 1 on/off
    parallel: 2,                  // how many media files are processed at the same time
    sweepMaxAgeMinutes: 1440,     // sweeps only scan media newer than this (text is always re-checked)

    ocr: {                        // part 2
      enabled: true,
      languages: ['eng', 'hin', 'ben'],   // English, Hindi, Bengali (add 'tam', 'tel', ... if needed)
      maxFrames: 2,               // frames per GIF/video that are read for text
      maxSide: 1600,
      tryInverted: true,          // also try light-on-dark text when the first read finds almost nothing
      minLettersPerLine: 3,       // ignore OCR noise lines
    },

    voice: {                      // part 3
      enabled: true,
      model: 'Xenova/whisper-base',       // better Hindi/Bengali: 'Xenova/whisper-small' (slower, bigger)
      maxSeconds: 120,            // only the first N seconds of each voice note are transcribed
      languages: [null],          // null = auto-detect. To force passes: ['hindi', 'bengali', 'english'] (slower)
      scanVideoAudio: true,       // also transcribe the sound of normal videos
    },
    maxBytes: 12 * 1024 * 1024,   // skip files bigger than this
    maxFrames: 3,                 // frames checked per GIF/video
    model: 'Xenova/clip-vit-base-patch32',
    ffmpegPath: null,             // null = use ffmpeg-static; or e.g. 'C:/ffmpeg/bin/ffmpeg.exe'
    debug: false,                 // true = print the model's probabilities for every scanned image

    // The model compares each image against these descriptions and gives each a probability.
    // A group is "unsafe" when the combined probability of its descriptions reaches `threshold`.
    // The SAFE descriptions soak up probability so normal pictures are not forced into an unsafe group.
    unsafeGroups: [
      { name: 'kissing',      threshold: 0.40, texts: ['two people kissing', 'a couple kissing', 'a person kissing another person'] },
      { name: 'nudity',       threshold: 0.40, texts: ['a nude naked person', 'a topless woman', 'a naked body'] },
      { name: 'sexual',       threshold: 0.35, texts: ['sexual activity', 'pornography', 'an explicit sexual image', 'people having sex'] },
      { name: 'suggestive',   threshold: 0.55, texts: ['a person in lingerie or underwear', 'a sexy provocative pose', 'a bikini model'] },
      { name: 'explicit-anime', threshold: 0.50, texts: ['an explicit hentai drawing', 'a sexualized anime character'] },
      { name: 'banana',       threshold: 0.35, texts: ['a banana', 'a peeled banana'] },
      { name: 'pomegranate',  threshold: 0.40, texts: ['a pomegranate'] },
    ],
    safeTexts: [
      'a screenshot', 'a meme with text', 'a cartoon', 'an anime character', 'a landscape', 'food',
      'a group of people', 'a person', 'an animal', 'a video game screenshot', 'a document',
      'a car', 'a building', 'a selfie', 'a drawing',
    ],
  },
};
