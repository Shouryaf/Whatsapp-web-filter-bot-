'use strict';
/**
 * Offline self-test for the text filter (no WhatsApp needed).
 *   node test.js                 -> runs the built-in checks
 *   node test.js "some message"  -> shows the score and which words matched
 */
const { analyzeText } = require('./filter');

if (process.argv[2]) {
  const r = analyzeText(process.argv.slice(2).join(' '));
  console.log(r.flagged ? 'WOULD DELETE' : 'would keep', '| score', r.score);
  for (const h of r.hits) console.log('  -', h.label, `(+${h.weight}, ${h.kind})`);
  process.exit(0);
}

// [text, shouldBeDeleted]
const CASES = [
  // ---- must be deleted ----
  ['fuck you', true], ['f u', true], ['F U', true], ['s u', true], ['s.u', true], ['f off', true],
  ['fk u', true], ['fku', true], ['stfu', true], ['fuuuuuuck', true], ['f u c k', true],
  ['f.u.c.k', true], ['f*ck', true], ['f**k', true], ['f***', true], ['fvck', true],
  ['sex', true], ['s3x', true], ['$ex', true], ['s e x', true], ['seeeex', true], ['sexy pic', true],
  ['send nudes', true], ['p0rn', true], ['pornhub', true], ['b00bs', true], ['b o o b s', true],
  ['show your boobs', true], ['hentai', true], ['nhentai link', true], ['horny', true],
  ['bhosdike', true], ['bhosdiwale', true], ['madarchod', true], ['mdrchod', true],
  ['behenchod', true], ['bhenchod', true], ['bhnchod', true], ['chutiya', true], ['chutiye', true],
  ['gandu', true], ['gaandu', true], ['lund', true], ['lauda', true], ['randi', true],
  ['bokachoda', true], ['boka choda', true], ['bokachodaaa', true], ['khankir chele', true],
  ['magir chele', true], ['bara', true], ['tor bara', true], ['bsdk', true], ['mkc', true],
  ['bkl', true], ['mc bc', true], ['chudai', true], ['chudbo', true], ['gud marani', true],
  ['MADARCHOD', true], ['ᴍᴀᴅᴀʀᴄʜᴏᴅ', true], ['ｓｅｘ', true], ['𝐬𝐞𝐱', true],
  ['मादरचोद', true], ['बहनचोद', true], ['चूतिया', true], ['लंड', true], ['रंडी', true],
  ['বোকাচোদা', true], ['খানকির ছেলে', true], ['চুদি তোকে', true],
  ['kiss me', true], ['let\'s have sex', true], ['dick pic', true], ['nsfw', true], ['18+ video', false],
  ['milf', true], ['rape', true], ['onlyfans', true], ['xvideos', true], ['blue film', true],
  ['🍆', true], ['🍑', true], ['🍌', true], ['😘', true], ['💋', true], ['💏', true], ['🔞', true],
  ['🍆💦', true], ['💦💦', true], ['😘😘😘', true], ['lol 🍌', true], ['👉👌', true], ['👩‍❤️‍💋‍👨', true],
  ['sleep with me', true], ['bhabhi chudai', true], ['nangi photo bhej', true],

  // ---- must be KEPT ----
  ['hello how are you', false], ['good morning', false], ['class assignment due tomorrow', false],
  ['I will pass the exam', false], ['document submitted', false], ['maggi khaoge?', false],
  ['kung fu panda', false], ['assam tea', false], ['bhai chutti chahiye', false],
  ['chutney is nice', false], ['Gandhi ji', false], ['I like cucumber', false], ['analysis of data', false],
  ['Essex and Sussex', false], ['bachchon ki chudiyan', false], ['which game is best?', false],
  ['God of war old games and ragnarok', false], ['mc donalds', false], ['I scored 455 runs', false],
  ['chod do yaar', false], ['hot day today', false], ['wtf happened', false], ['🥵', false], ['😏', false],
  ['😂😂😂', false], ['❤️', false], ['👍', false], ['🏳️‍🌈', false], ['assignment 5', false],
  ['Magi labyrinth of magic', false], ['hello 😊', false], ['namaste', false], ['চোদ্দ তারিখ', false],
  ['বাড়ি যাচ্ছি', false], ['गुड मॉर्निंग', false], ['मुझे छोड़ दो', false], ['sexton and sextant', false],
];

let bad = 0;
for (const [text, want] of CASES) {
  const r = analyzeText(text);
  if (r.flagged !== want) {
    bad++;
    console.log(`FAIL  want=${want ? 'DELETE' : 'keep  '} got=${r.flagged ? 'DELETE' : 'keep  '} score=${r.score}  "${text}"  ${r.hits.map((h) => h.label).join(',')}`);
  }
}

// speed + worst-case input check
const t0 = Date.now();
for (let i = 0; i < 300; i++) analyzeText('this is a normal message about homework and anime episode ' + i);
const perMsg = (Date.now() - t0) / 300;
const evil = 'o'.repeat(3000) + ' ' + 'b '.repeat(500) + '*'.repeat(500);
const t1 = Date.now(); analyzeText(evil); const evilMs = Date.now() - t1;

console.log(`\n${CASES.length - bad}/${CASES.length} checks passed.  ~${perMsg.toFixed(1)} ms per normal message, ${evilMs} ms for a hostile 4000-char message.`);
process.exit(bad ? 1 : 0);
