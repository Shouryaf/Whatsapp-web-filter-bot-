'use strict';
/**
 * WORD LISTS for the moderation filter.
 *
 * HOW ENTRIES WORK
 *  - Write terms in plain lowercase letters a-z. The engine automatically also catches:
 *      * stretched letters      (fuuuuck, seeex)
 *      * leetspeak / symbols    (s3x, p0rn, b00bs, $ex, f*ck, a55)
 *      * look-alike letters     (Cyrillic/Greek lookalikes, fancy fonts, accents)
 *      * spaced-out letters     (f u c k, s.e.x, b-o-o-b-s)
 *  - A SPACE inside a term means "optional separator" (so "boka choda" also matches "bokachoda").
 *  - A term WITHOUT a prefix is matched as a WHOLE WORD (plus s/es/ed/er/ers/ing/in endings).
 *  - A term starting with "~" is matched ANYWHERE inside a word (use for long, unambiguous roots).
 *
 * WEIGHTS: STRONG = 3 (a single hit deletes), MEDIUM = 2, WEAK = 1.
 * A message is deleted when its total score reaches `threshold` in config.js (default 3).
 * So one MEDIUM word alone survives, but MEDIUM + MEDIUM (or MEDIUM + WEAK) gets deleted.
 */

// ===================================================================================
// STRONG (weight 3)
// ===================================================================================
const STRONG = [
  // ---------- English: sex / body / acts ----------
  'sex', 'sexy', 'sexi', 'sexual', 'sexually', 'sexting', 'sext', 'sextape', 'sextoy', 'sexcam',
  'sexchat', 'seggs', 'swu', 'sxu', 'sexu',
  'fuck', 'fuk', 'fck', 'fuq', 'fvck', 'phuck', 'phuk', 'fcuk', 'fuc', 'fku', 'fcku',
  'fuckface', 'fuckboy', 'fucktard', 'fuckwit', 'fuckhead', 'clusterfuck', 'fuckoff', 'fuckyou',
  'fuckme', 'stfu', 'gtfo', 'motherfucker', 'mutherfucker', 'motherfuker', 'mfer', 'mofo',
  'pussy', 'pussies', 'cunt', 'twat', 'dick', 'dickhead', 'cock', 'cocksucker', 'penis', 'vagina',
  'vulva', 'clit', 'clitoris', 'labia',
  'boob', 'boobs', 'boobies', 'booby', 'boobz', 'bobs', 'bubs', 'tits', 'titties', 'titty',
  'nipple', 'areola',
  'nude', 'naked', 'topless', 'bottomless', 'underboob', 'sideboob', 'upskirt', 'downblouse',
  'nipslip', 'nip slip', 'cameltoe', 'camel toe',
  'panty', 'panties', 'lingerie', 'thong', 'g string',
  '~porn', 'xxx', 'nsfw', 'nsfl', 'horny', '~hentai', '~nhentai', 'oppai', 'paizuri', 'ahegao',
  'futanari', 'bussy',
  'blowjob', 'blow job', 'handjob', 'hand job', 'rimjob', 'titjob', 'footjob', 'anal', 'oral sex',
  'deepthroat', 'deep throat', 'gangbang', 'gang bang', 'threesome', 'foursome', 'orgy', 'orgies',
  'bukkake', 'creampie', 'cumshot', 'cum shot', 'squirt', 'squirting', 'fisting', 'rimming',
  'dildo', 'vibrator', 'buttplug', 'butt plug', 'fleshlight', 'bdsm', 'bondage', 'dominatrix',
  'fetish', 'femdom', 'milf', 'dilf', 'gilf', 'incest',
  'cum', 'cumming', 'cummin', 'jizz', 'semen', 'sperm', 'boner', 'hardon', 'hard on', 'butthole',
  'ballsack', 'balls deep', 'blue balls',
  '~ejaculat', '~masturbat', '~orgasm', '~erotic', '~intercourse', '~pornograph', '~prostitut',
  '~fornicat',
  'jerk off', 'jerking off', 'jackoff', 'jack off', 'fap', 'fapping', 'wank', 'wanker', 'wanking',
  'asshole', 'arsehole',
  'rape', 'raped', 'raping', 'rapist', '~molest', 'grope', 'groped', 'groping', 'pedo',
  'pedophile', 'paedo', 'paedophile', 'pedophilia', 'bestiality',
  'slut', 'slutty', 'whore', 'skank', 'hooker', 'stripper', 'camgirl', 'cam girl', 'lapdance',
  'lap dance',
  // adult sites / performers
  '~onlyfans', '~chaturbate', '~xvideos', '~xnxx', '~xhamster', '~redtube', '~youporn',
  '~spankbang', '~eporner', '~brazzers', '~hentaihaven', '~hanime', '~rule34', '~stripchat',
  '~fansly', '~livejasmin', 'mia khalifa', 'sunny leone', 'johnny sins',
  // kissing / hookup / propositions
  'kiss me', 'kiss you', 'kiss her', 'kiss him', 'kissing', 'french kiss', 'smooch', 'smooching',
  'make out', 'making out', 'makeout', 'wet dream', 'get laid', 'one night stand', 'booty call',
  'make love', 'making love', 'sleep with me', 'sleep with you', 'lick my', 'lick ur',
  'lick your', 'suck my', 'suck ur', 'suck your', 'suck me', 'hook up', 'hookup', 'dtf', 'fwb',
  'friends with benefits', 'dirty talk', 'dirty pic', 'dirty pics', 'dirty video',
  'blue film', 'blue movie', 'bluefilm', 'adult video', 'adult videos', 'adult movie',
  'adult film', 'adult content', 'adults only',

  // ---------- Hindi / Hinglish ----------
  '~bhosd', '~bhosad', '~bhosr', '~bhonsd', '~bhonsad', 'bhsdk', 'bsdk', 'bsdke', 'bsdika',
  'bkl', 'mkc', 'tmkc', 'mcbc', 'gndu',
  '~madarch', '~maderch', '~madrch', '~mdrch', '~mderch', '~maadarch', '~mdarch', '~madharch',
  '~behench', '~bhench', '~benchod', '~bnchod', '~bhnch', '~behnch', '~bonchod', '~bahenchod',
  '~bhen chod', '~behen chod', '~bhen ke lod', '~behen ke lod', '~bhen ke lund', '~behen ke lund',
  '~chutiy', '~chutia', '~chutya', '~chootiy', '~chutad', '~chutmar', '~chut mar', '~chootmar',
  'chut', 'choot', 'chhut', 'chhoot',
  '~gandu', '~gaandu', '~gandmasti', '~gaandmasti', '~gandmar', '~gaandmar', '~gand mar',
  '~gaand mar', 'gand', 'gaand',
  'lund', 'lauda', 'laude', 'lawda', 'lawde', 'lavda', 'lavde', 'laudu', 'lode', 'lodey', 'loda',
  'lodu', 'lowda', 'lowde', 'lwda', 'lwde', 'lvda', '~lundfak', '~lavdy',
  'randi', 'raand', 'raandi', '~randw', '~randib', '~randikh', 'chinal', 'chinaal',
  '~chudai', '~chudwa', '~chudasi', '~chudne', 'chodu', 'chud',
  '~muth mar', '~mooth mar', '~mut mar', '~muthmar',
  'chuchi', 'chuchiyan', 'chuchhi',
  '~bhadw', '~bhadv', '~bhandw', '~bhadu', 'tharki', '~tharki',
  '~gashti', '~rakhail', '~sambhog', '~maithun', '~balatkar', '~balaatkar', '~veshya', '~vesya',
  'nangi', '~ghapaghap', '~ghapa ghap', '~kapde utar', '~kapde utaar', '~kapre utar',
  'viral mms', 'leaked mms', 'mms leak',

  // ---------- Bengali (romanised) ----------
  '~boka chod', '~boka chud', '~boka cod', '~boka cud', '~bokaa chod', '~bokachod',
  '~khank', 'magir', '~magir', '~magichod', '~magi chod',
  '~gudmar', '~gud mar', '~chudmar', '~chudir', '~chudb', '~chudech', '~chudl', '~chuda chudi',
  '~choda chudi', '~chodachud', '~chudachud', 'chodbo', 'chodbi',
  '~bhoda', '~bhodai', 'bara', 'barar', '~chodna chodi',

  // ---------- Tamil / Telugu / Malayalam / Marathi / Punjabi ----------
  'punda', 'pundai', '~pundamav', 'ommala', 'omala', 'ootha', 'oththa', 'otha', '~thevid',
  '~thevud', '~thevdi', 'koothi', 'mayiru', 'myiru', 'pooku', 'poolu', 'denga', 'dengey',
  'dengu', 'lanja', '~lanjak', 'modda', 'puku', 'kunna', 'kunne', 'myre', 'myru', 'thayoli',
  'kandaroli', 'oombu', 'oombi', '~zavad', '~zavn', '~bhikarchot', '~penchod', '~pencho',
  '~penchd',
];

// ===================================================================================
// MEDIUM (weight 2) - not deleted alone, deleted with one more hit
// ===================================================================================
const MEDIUM = [
  // English
  'bitch', 'bitches', 'biatch', 'bitchy', 'bastard', 'shit', 'shite', 'bullshit', 'horseshit',
  'dipshit', 'shitty', 'shithead', 'shitface', 'bitchass', 'dumbass', 'jackass', 'smartass',
  'fatass', 'arse', 'prick', 'tosser', 'bollocks', 'bellend', 'piss', 'ass', 'asses',
  'mf', 'mfs', 'ffs', 'omfg', 'effing', 'bj', 'fingering', 'spank', 'spanking',
  'kinky', 'kink', 'nudity', 'cleavage', 'busty', 'booty', 'twerk', 'twerking', 'breast',
  'breasts', 'testicle', 'testicles', 'scrotum', 'foreskin', 'erection', 'anus',
  'hoe', 'hoes', 'thot', 'pimp', 'seduce', 'seduction', 'seductive', 'lewd', 'lewds',
  'uncensored', 'netflix and chill', 'stepmom', 'stepsis', 'sugar daddy', 'sugar mommy',
  'condom', 'condoms', 'lube', 'bang you', 'bang her', 'bang me', 'private parts',
  'strip', 'stripping', 'undress', 'undressed', 'sleep together',
  // Hinglish
  'bc', 'mc', 'harami', '~haramkhor', '~haramzad', '~haramjad', 'kutiya', 'kuttiya', 'kutti',
  'kuttar bachha', 'kuttar baccha', 'shuorer bachha', 'shuorer baccha', 'shuor', '~hijd',
  'jhatu', 'jhant', 'jhaant', 'tatte', 'mamme', 'mammey', 'chudi', 'chudiye', 'choda', 'baal',
  'baler', 'baaler', 'magi', 'maagi', 'chus', 'chusna', 'muth', 'mooth', 'muthi', 'nanga',
  'chumma', 'chumban', 'kanjri', 'desi bhabhi', 'garam maal', 'hot maal', 'gnd', 'dhon',
];

// ===================================================================================
// WEAK (weight 1) - only matters in combination
// ===================================================================================
const WEAK = [
  'hot', 'wtf', 'bal', 'maal', 'mms', 'chod', 'chodna', 'chodo', 'chodne', 'chodte', 'kamina',
  'kamine', 'kameena', 'kaminey', 'suhagraat', 'jism', 'ecchi', 'doujin', 'doujinshi', 'thicc',
  'bikini', 'underwear', 'bosom', 'escort', 'balls', 'butt', 'kiss', 'kisses', 'xoxo',
  'naughty', 'adult', 'adults', 'send pic', 'send pics', 'send photo', 'pic bhej', 'photo bhej',
  'bed scene', 'hotel room', 'fml',
];

// ===================================================================================
// NATIVE-SCRIPT terms (Devanagari / Bengali). No leetspeak applies here.
// "~" = anywhere in a word, otherwise whole word.
// ===================================================================================
const NATIVE_STRONG = [
  // Devanagari (Hindi / Marathi)
  '~मादरचोद', '~मादर चोद', '~बहनचोद', '~बहन चोद', '~भोसड', '~भोंसड', '~चूतिय', '~चुतिय',
  'चूत', 'चुत', '~गांडू', '~गाँडू', '~गान्डू', 'गांड', 'गाँड', 'गान्ड', 'लंड', 'लौड़ा', 'लौडा',
  'लवडा', 'लवड़ा', 'लौड़े', 'लौडे', 'रंडी', 'रांड', 'रण्डी', '~चुदाई', '~चोदू', '~चोदन',
  '~चुदवा', 'सेक्स', 'सेक्सी', '~पोर्न', '~बलात्कार', '~संभोग', '~वेश्या', '~नंगी',
  // Bengali
  '~বোকাচোদা', '~বোকাচুদা', '~বোকা চোদা', '~চোদা', '~চোদন', '~চুদি', '~চুদে', '~চুদব',
  '~চুদল', '~চুদির', '~খানকি', '~খানকী', '~মাগি', '~মাগী', '~গান্ডু', '~গাণ্ডু', '~ভোদা',
  'গুদ', 'গুদে', 'গুদের', 'সেক্স', 'পর্ন', '~পর্নো', '~ধর্ষণ', 'নগ্ন',
];
const NATIVE_MEDIUM = [
  'हरामी', '~हरामखोर', 'कुतिया', '~हिजड़', 'झांट', 'झाँट', 'टट्टे', 'कंडोम', 'नंगा', 'मुठ', 'मूठ',
  'বাড়া', 'বাল', 'হারামি', 'শুয়োর', '~কুত্তার বাচ্চা',
];
const NATIVE_WEAK = ['कमीना'];

// ===================================================================================
// SPECIAL PATTERNS (regex). Written for the cleaned, lower-case, Latin-normalised text.
// ===================================================================================
const NB = '(?<![a-z0-9])';   // "not preceded by a letter/digit"
const NA = '(?![a-z0-9])';    // "not followed by a letter/digit"
const REGEX = [
  // ---- abbreviations: f u / s u etc ----
  { label: 'f u',        w: 3, re: `${NB}f[\\s._\\-*]{1,2}u${NA}` },
  { label: 'fu',         w: 2, re: `${NB}fu${NA}` },
  { label: 'fk u',       w: 3, re: `${NB}(?:fk|fck|fuk|fuq|fcuk)[\\s._\\-*]{0,2}(?:u|you|yu|ya|yo|ur|urself|yourself|off|me|her|him|them|this|that)${NA}` },
  { label: 'fk',         w: 2, re: `${NB}fk${NA}` },
  { label: 'f off/you',  w: 3, re: `${NB}f[\\s._\\-]{1,2}(?:you|yourself|off|this|that|them|him|her|everyone|everybody|ur|urself)${NA}` },
  { label: 's u',        w: 3, re: `${NB}s[\\s._\\-*]{1,2}u${NA}` },
  { label: 's w u',      w: 3, re: `${NB}s[\\s._\\-]?w[\\s._\\-]?u${NA}` },
  { label: 'sx u',       w: 3, re: `${NB}(?:sx|sxy)[\\s._\\-]{0,2}(?:u|you)${NA}` },
  { label: 'x rated',    w: 3, re: `${NB}x[\\s._\\-]?rated${NA}` },
  { label: '18+',        w: 2, re: `${NB}18[\\s]?(?:\\+|plus)` },
  // ---- censored swearing with symbols ----
  { label: 'f***',       w: 3, re: `${NB}f[*#@%]{2,4}(?:ing|in|er|ed|s)?${NA}` },
  { label: 'a**hole',    w: 3, re: `${NB}a[*#@%]{2}hole${NA}` },
  { label: 's**t',       w: 2, re: `${NB}s[*#@%]{1,2}t${NA}` },
  // ---- Indian internet slang ----
  { label: 'bobs & vegana', w: 3, re: `${NB}(?:vegana|vagene|vegina)${NA}` },
  { label: 'abuse family',  w: 2, re: `${NB}(?:ma|maa|mummy|behen|bhen|beti|bhabhi)\\s+(?:ko|ki|ka|ke)?\\s*(?:chod|chud|pel|thok)` },
  { label: 'teri maa ki',   w: 2, re: `${NB}ter[ie]\\s+(?:ma|maa|mummy|mom|behen|bhen)\\s+(?:ki|ka|ke|ko)${NA}` },
];

// Words/phrases that look dangerous to a naive filter but are fine. They are blanked out BEFORE matching.
const SAFE_WORDS = [
  'maggi', 'kung fu', 'kungfu', 'scunthorpe', 'sussex', 'essex', 'middlesex', 'hancock',
  'cocktail', 'peacock', 'assam', 'dickens',
];

// ===================================================================================
// EMOJI (weight per emoji; the same emoji counts at most twice)
// NOTE: there is no pomegranate emoji in Unicode. The closest "fruit with a hidden meaning"
// ones are 🍑 🍒 🍌 🍆 - all covered. Add your own in config.js -> extraEmoji.
// ===================================================================================
const EMOJI = {
  // fruit / food used as innuendo
  '🍆': 3, '🍑': 3, '🍌': 3, '🍒': 2, '🌭': 2, '🍓': 1, '🥒': 1,
  // water / body
  '💦': 2, '👅': 2, '👄': 2, '🫦': 3,
  // kissing
  '💋': 3, '😘': 3, '😗': 3, '😙': 3, '😚': 3, '💏': 3,
  // suggestive faces / clothes / signs
  '😈': 1, '🥵': 1, '🤤': 1, '😏': 1, '👙': 2, '🩲': 3, '🛏': 1, '🔞': 3,
};
const EMOJI_COMBOS = [
  { label: '👉👌', w: 3, re: /👉\s*👌|👌\s*👉/u },
];

module.exports = {
  STRONG, MEDIUM, WEAK,
  NATIVE_STRONG, NATIVE_MEDIUM, NATIVE_WEAK,
  REGEX, SAFE_WORDS, EMOJI, EMOJI_COMBOS,
};
