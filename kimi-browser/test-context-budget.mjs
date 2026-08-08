import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

// ANG REGRESSION NA HINULI NITO — at ako mismo ang gumawa noon sa v0.23.0.
//
// Ang mga threshold ng compaction ay gumagamit ng totalChars(messages), na kasama
// ang system message sa index 0. Noong v0.22, ~12,000 karakter iyon at walang
// problema. Sa v0.23 ay ipinasok ko nang BUO ang master prompt at ang template ng
// disenyo — naging ~117,000 karakter.
//
// Ang bunga: lampas na sa hangganan bago pa may sabihin ang user. At dahil ang
// compaction ay kayang paliitin ang USAPAN lang — hindi ang system prompt —
// HINDI NA ITO BABABA KAILANMAN. Mula sa hakbang 16, tatawag ng autoCompact sa
// BAWAT hakbang habambuhay, at ang bawat tawag ay isang dagdag na model call na
// walang kahit anong mababawas.
//
// Ang tamang sukatan ay ang USAPAN lang: ang mga sukat na hindi mababago ay hindi
// dapat magpasya kung dapat bang magbawas.

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const bg = fs.readFileSync(path.join(HERE, 'background.js'), 'utf8');

// ---------- 1. Ang usapan ang sinusukat, hindi ang system prompt ----------
assert.match(bg, /const convoChars = \(msgs\) => totalChars\(msgs\.slice\(1\)\)/, 'may hiwalay na sukat ang usapan');

const thresholds = [...bg.matchAll(/(\w+)\(messages\) > \(CTX_CHARS\[[^\]]+\] \|\| (\w+|\d+)\) \* ([\d.]+)/g)];
assert.equal(thresholds.length, 3, 'tatlong threshold ang nakabatay sa laki ng konteksto');
for (const [buo, fn, fallback, mult] of thresholds) {
  assert.equal(
    fn, 'convoChars',
    `ANG REGRESSION: ${buo}\n  Kasama ang system prompt sa sukatan. Sa ~117,000-karakter na ` +
      'system prompt, lampas na agad sa hangganan bago pa magsimula ang usapan — at dahil ' +
      'hindi mababawasan ang system prompt, hindi na ito bababa kailanman.'
  );
  assert.equal(fallback, 'CTX_DEFAULT', `dapat pinangalanang hangganan, hindi hubad na numero: ${buo}`);
}
assert.match(bg, /const CTX_DEFAULT = (\d+)/, 'may pinangalanang default');
assert.ok(
  +/const CTX_DEFAULT = (\d+)/.exec(bg)[1] >= 200000,
  'ang dating 110,000 ay nagpapa-compact sa qwen3.8-max (~900k karakter ang kaya) sa ikaapat ' +
    'na bahagi lang. Sa isang totoong sesyon, dalawang beses itong tumakbo (−71k, −69k) sa ' +
    'usapang kasya naman sana nang buo.'
);

// ---------- 2. Tunay na pagsukat, hindi lang regex ----------
const stub = {
  storage: { local: { get: async () => ({}), set: async () => {}, remove: async () => {} } },
  runtime: { onConnect: { addListener() {} }, onMessage: { addListener() {} }, onInstalled: { addListener() {} }, getPlatformInfo: async () => ({}) },
  alarms: { onAlarm: { addListener() {} }, create() {}, clear() {}, getAll: async () => [] },
  notifications: { onClicked: { addListener() {} } },
  tabs: { onRemoved: { addListener() {} }, onUpdated: { addListener() {} }, query: async () => [] },
  tabGroups: { onRemoved: { addListener() {} } },
  action: { onClicked: { addListener() {} } },
  sidePanel: { setPanelBehavior: async () => {} },
  commands: { onCommand: { addListener() {} } },
};
globalThis.chrome = stub;
const BG = await import('./background.js');

// Isang tunay na hugis: 117k na system prompt (master + template), maikling usapan.
const usapan = [
  { role: 'system', content: 'x'.repeat(117000) },
  { role: 'user', content: 'Sumulat ng artikulo.' },
  { role: 'assistant', content: 'Sige.' },
];
assert.ok(
  BG._bgInternals.convoChars(usapan) < 100,
  'ang maikling usapan sa ilalim ng malaking system prompt ay MAIKLI pa rin — ' +
    `nakuha: ${BG._bgInternals.convoChars(usapan)}`
);
assert.ok(BG._bgInternals.totalChars(usapan) > 117000, 'ang totalChars ay sumusukat pa rin ng buo, kung kailangan');

// Sa dating sukatan, ang parehong usapang ito ay LAMPAS na sa 0.85 threshold.
assert.ok(
  BG._bgInternals.totalChars(usapan) > 240000 * 0.85 || 117000 > 110000 * 0.85,
  'sa lumang hangganan, ang system prompt lang ay sapat nang magpaandar ng autoCompact'
);

// ---------- 3. Ang tab na bukas ay hindi ang gawain ----------
assert.match(
  bg, /const gumalaw = new Set\(\['navigate'/,
  'may tseke kung TUNAY na ginalaw ang site bago mag-angkin ng aral para dito'
);
assert.match(bg, /if \(!ginamit\) return;/, 'hindi nagdi-distill kapag walang ginawa sa browser');
const blokeSimula = bg.indexOf('async function distillWorkflow');
const bloke = bg.slice(blokeSimula, blokeSimula + 1400);
assert.ok(
  bloke.indexOf('if (!ginamit) return;') < bloke.indexOf('fetch('),
  'ANG TSEKE AY BAGO ANG MODEL CALL — kung hindi, binabayaran pa rin natin ang tawag ' +
    'bago itapon ang resulta. Sa isang totoong sesyon tungkol sa SEO ng Hamuq na puro ' +
    'search_files lang, "natutunan ang daloy sa mail.google.com" dahil Gmail ang nakabukas.'
);

console.log('OK — ang usapan ang sinusukat, at ang aral ay nakatali sa tunay na ginawa');
