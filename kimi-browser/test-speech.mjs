import assert from 'node:assert';
import { forSpeech } from './speech.js';

// Ang eksaktong hugis ng sagot ng second brain — ito ang binabasa ng boses dati
// nang buo kasama ang mga asterisk at gitling.
const audit = `**1. PULIDO**
- May gap sa testimonya: sinabi ng worker na "may Public badge na" — pero hindi natin makita.
- Inamin niya ang typo sa URL, maganda iyon.

**2. IMPROVE**
- Dapat nag-verify siya via \`GET /repos/kimi-browser\` at hindi lang sa screenshot.`;

const s = forSpeech(audit);
assert.ok(!s.includes('*'), 'walang asterisk na babasahin nang literal');
assert.ok(!s.includes('—'), 'walang em dash');
assert.ok(!/^\s*-\s/m.test(s), 'walang gitling sa simula ng linya');
assert.ok(!s.includes('`'), 'walang backtick');
assert.match(s, /PULIDO/, 'buo pa rin ang laman');
assert.match(s, /may Public badge na", pero hindi/, 'ang em dash ay naging kuwit');

// Ang code block ay hindi binabasa — walang saysay pakinggan ang syntax.
const code = forSpeech('Ito ang ayos:\n```js\nconst x = 1;\n```\nSubukan mo.');
assert.ok(!code.includes('const x'), 'hindi binabasa ang laman ng code block');
assert.match(code, /Nasa panel ang code/);

// Ang link ay pangalan lang, hindi ang buong URL na mahaba at walang saysay basahin.
assert.equal(forSpeech('Tingnan ang [dokumentasyon](https://example.com/a/b/c).'),
  'Tingnan ang dokumentasyon.');

// Mga pamagat at numerado: nawawala ang marka, at ang bawat isa ay tinatapos ng
// tuldok — dito nagkakaroon ng hinto ang boses sa pagitan ng mga item.
assert.equal(forSpeech('### Ang Resulta\n1. Una\n2. Pangalawa'), 'Ang Resulta. Una. Pangalawa.');

// Walang naiipong bantas mula sa mga pagpapalit.
const doble = forSpeech('Tapos na ang gawain.\n\n— Ito ang susunod.');
assert.ok(!/\.\s*,/.test(doble), `walang tuldok-kuwit na magkasunod: ${JSON.stringify(doble)}`);
assert.ok(!/,\s*,/.test(doble), 'walang dobleng kuwit');

// Ligtas sa walang laman.
assert.equal(forSpeech(''), '');
assert.equal(forSpeech(null), '');

console.log('OK — malinis na binabasa ng boses, walang markdown at walang em dash');
