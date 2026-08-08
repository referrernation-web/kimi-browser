import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

// ANG DEPEKTONG PINIPIGILAN NITO:
// Ang docAsPlainMarkdown ay ginawa mismo para sa .docx, .pdf at .pptx — nakasulat pa
// nga sa komento nito. Pero HINDI ITO KAILANMAN NA-IMPORT ng sidepanel.js. Ang
// ginagamit ay docAsMarkdown, na basta pinagdurugtong ang mga seksyon nang walang
// ginagawa sa HTML. Tapos ang parseMarkdown ay tinuturing na ordinaryong TALATA ang
// bawat linyang hindi nagsisimula sa # o -.
//
// Ang resulta: ang .docx na ibinibigay sa Canadian na kliyente ay naglalaman ng
// literal na `<section class="hq-hero">` at `<style>`. Ang mismong kaso na dahilan
// kung bakit umiiral ang buong 🎨 na sistema, ay siya ring kaso na sira.

const store = {};
globalThis.chrome = {
  storage: {
    local: {
      get: async (k) => (typeof k === 'string' ? { [k]: store[k] } : { ...store }),
      set: async (o) => Object.assign(store, o),
      remove: async (k) => { for (const one of [].concat(k)) delete store[one]; },
    },
  },
};

const D = await import('./docs.js');
const { parseMarkdown } = await import('./docx.js');

D.setDocSession('s1');
await D.docAppend({
  title: 'Best Canadian Made Mattress',
  start_new: true,
  append:
    '<style>.hq-goldframe{border-radius:13px;animation:hq-border-shift 9s linear infinite}</style>' +
    '<section class="hq-hero"><h2>Why Hamuq</h2><p>Cooling foam and 1,200+ coils.</p>' +
    '<ul><li>15-year warranty</li><li>120-night trial</li></ul></section>' +
    '<script>new IntersectionObserver(cb)</script>',
});

// ---------- Ang teksto para sa Word, PDF at PowerPoint ----------
const plain = await D.docAsPlainMarkdown('s1');
assert.match(plain, /^## Why Hamuq$/m, 'ang <h2> ay naging TUNAY na markdown heading');
assert.match(plain, /^- 15-year warranty$/m, 'ang <li> ay naging tunay na bullet');
assert.match(plain, /Cooling foam and 1,200\+ coils\./, 'buo ang prosa');
for (const bawal of ['<section', 'hq-hero', 'hq-goldframe', 'border-radius', 'IntersectionObserver', '<style', '<script']) {
  assert.ok(!plain.includes(bawal), `walang "${bawal}" sa mapupunta sa .docx/.pdf/.pptx`);
}

// ITO ang eksaktong sira: dating literal na talatang "<section class=..." ang
// napupunta sa Word. Ngayon, tunay na heading.
const blocks = parseMarkdown(plain);
assert.equal(blocks.find((b) => b.runs?.[0]?.text === 'Why Hamuq')?.type, 'h2', 'tunay na Word heading');
assert.ok(
  !blocks.some((b) => b.runs?.some((r) => /<|hq-/.test(r.text))),
  'WALANG markup na dumaraan bilang teksto sa Word — ito ang dating naipapadala sa kliyente'
);

// Pinapatunayan na TALAGANG sira ang dating daan (docAsMarkdown), hindi lang haka-haka.
const luma = await D.docAsMarkdown('s1');
assert.ok(
  parseMarkdown(luma).some((b) => b.runs?.some((r) => r.text.includes('<section'))),
  'ang LUMANG daan ay talagang naglalagay ng literal na <section> sa Word — kaya ito pinalitan'
);

// ---------- Ang .html ay may buong disenyo pa rin ----------
const html = await D.docAsHtml('s1');
assert.match(html, /class="hq-hero"/, 'buo ang klase sa .html');
assert.match(html, /hq-border-shift 9s/, 'buo ang animation sa .html');
assert.equal((await D.docGet('s1')).html, true, 'nakilala bilang dokumentong may disenyo');

// ---------- Ang markdown na dokumento ay hindi nagbabago ----------
D.setDocSession('s2');
await D.docAppend({ title: 'Ordinaryong ulat', start_new: true, append: '## Buod\n\nIsang talata lang ito.' });
assert.equal(
  await D.docAsPlainMarkdown('s2'),
  await D.docAsMarkdown('s2'),
  'sa purong markdown, walang ipinagkaiba — walang na-regress'
);

// ---------- Naka-wire ba talaga? ----------
// Ang mga assertion sa itaas ay nagpapatunay na TAMA ang docAsPlainMarkdown. Wala
// silang sinasabi kung GINAGAMIT ba ito. Iyon mismo ang naging depekto sa loob ng
// ilang bersyon: tamang function, hindi tinatawag.
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const js = fs.readFileSync(path.join(HERE, 'sidepanel.js'), 'utf8');
assert.match(js, /import \{[^}]*docAsPlainMarkdown[^}]*\} from '\.\/docs\.js'/, 'na-import');
assert.match(js, /const plain = await docAsPlainMarkdown\(sid\)/, 'ginagamit sa build() ng doc card');
assert.match(js, /blocks: parseMarkdown\(plain\)/, 'ang blocks ng .docx/.pdf/.pptx ay galing sa plain');
assert.match(js, /doc\.md = plain/, 'ang .md ay galing din sa plain');
assert.ok(
  !/body\.innerHTML = await docAsHtml/.test(js),
  'ang preview ay hindi na innerHTML — hindi nagpapatakbo iyon ng script, kaya patay ang animation'
);
const sandbox = /\.sandbox\s*=\s*'([^']*)'/.exec(js);
assert.ok(sandbox, 'iframe na sandboxed ang preview');
assert.ok(sandbox[1].includes('allow-scripts'), 'tumatakbo ang animation ng artikulo');
assert.ok(
  !sandbox[1].includes('allow-same-origin'),
  'walang allow-same-origin: tumatakbo ang script pero hindi maaabot ang panel — ' +
    'ang laman ng artikulo ay galing sa modelo, hindi sa atin'
);

// Ang "may disenyo ba ito" ay dumadaan sa TATLONG file: docs.js → background.js →
// sidepanel.js. Ang isang maling pangalan ng field ay hindi pumuputok — tahimik
// lang na nagiging undefined, at mawawala ang tanging tanda kung aling file ang
// ligtas ibigay sa kliyente.
D.setDocSession('s1');
const may = await D.docAppend({ append: '<p>Isa pang seksyon.</p>' });
assert.equal(may.may_disenyo, true, 'sinasabi ng docAppend kung may disenyo');
const bg = fs.readFileSync(path.join(HERE, 'background.js'), 'utf8');
assert.match(bg, /design: result\.may_disenyo/, 'ipinapasa ito ng background sa panel');
assert.match(js, /const mayDisenyo = !!m\.design/, 'ginagamit ito ng doc card');
assert.match(js, /design: !!d\.html/, 'ibinabalik din ito kapag binuhay mula storage');

console.log('OK — teksto sa Word/PDF/Slides, buong disenyo sa HTML, at totoong preview');
