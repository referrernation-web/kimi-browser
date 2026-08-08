import assert from 'node:assert';

// ANG DEPEKTONG PINIPIGILAN NITO:
// Ang master prompt ng Hamuq ay 73,115 karakter. Dati, ang laman nito ay dumadaan
// LANG sa search_files: 5 tipak × 800 karakter = ~4,000 kada tawag. Mga 11% ang
// nakikita ng modelo — habang sinasabi ng prompt na "SUNDIN ITO NANG BUO". Mas
// malala: ang ranking (overlap / sqrt(size)) ay kumikiling sa MAIIKLING tipak,
// kabaligtaran mismo ng mahahabang CSS at HTML na kailangan.
//
// At ang Part 8 (ang design system) ay PROSA, hindi CSS: "border-radius:13px;
// padding:2px (the 2px of visible gradient IS the border)". Kaya kahit buo pa ang
// prompt, kailangan pa ring MULING GAWIN ng modelo ang stylesheet mula sa
// paglalarawan — kaya iba-iba ang labas. Doon pumapasok ang 🎨: totoong CSS mula
// sa isang naipadala nang artikulo.

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

const F = await import('./files.js');

// ---------- joinChunks: eksaktong pagbaligtad ng chunkText ----------
// Gumagawa tayo ng dokumentong kasinlaki ng totoong v4.5, na may natatanging marka
// sa EKSAKTONG GITNA — doon eksaktong hindi umaabot ang retrieval.
const talata = (n) =>
  `Ang seksyon bilang ${n} ay naglalaman ng mga panuntunan sa istruktura, sa tono, ` +
  `at sa bilang ng talahanayan na kailangan sa bawat artikulo ng kliyente. `.repeat(12);
let src = Array.from({ length: 75 }, (_, i) => `PART ${i}: PANUNTUNAN\n${talata(i)}`).join('\n\n');
const gitna = Math.floor(src.length / 2);
src = src.slice(0, gitna) + '\n.hq-gold-divider{border-color:#d4a017} GITNANG-SENTINEL\n' + src.slice(gitna);
src += '\n\nWAKAS-SENTINEL';
assert.ok(src.length > 40000, 'malaking dokumento ang sinusubok (' + src.length + ' chars)');

const tipak = F.chunkText(src);
const buo = F.joinChunks(tipak);
assert.match(buo, /GITNANG-SENTINEL/, 'buo ang GITNA pagkatapos ng muling pagbuo');
assert.match(buo, /hq-gold-divider\{border-color:#d4a017\}/, 'eksakto pa rin ang CSS sa gitna');
assert.match(buo, /WAKAS-SENTINEL/, 'umabot hanggang dulo');
// Ang joinChunks ay PANUKLI lang para sa lumang file. HINDI ito eksakto, at hindi
// ito magiging eksakto: sa paulit-ulit na teksto, maraming posisyon ang tumutugma
// nang pantay, kaya hindi mababawi kung alin ang totoo. Malapit lang ang layunin.
assert.ok(
  Math.abs(buo.length - src.length) < src.length * 0.12,
  `malapit ang panukli (orihinal ${src.length}, muling binuo ${buo.length})`
);
// Ang chunks.join('\n') ang MALING paraan — pinapatunayan dito kung bakit.
assert.ok(
  tipak.join('\n').length > src.length * 1.03,
  'ang simpleng join ay MAGDODOBLE ng laman — dobleng CSS rule = dobleng seksyon sa artikulo'
);

// ---------- designSkeleton: CSS oo, lumang schema hindi ----------
const shipped =
  '<!doctype html><html><head><style>.hq-goldframe{border-radius:13px;padding:2px;' +
  'animation:hq-border-shift 9s linear infinite}</style>' +
  '<script type="application/ld+json">{"@type":"Article","headline":"LUMANG PAMAGAT",' +
  '"datePublished":"2026-07-01"}</script></head><body>' +
  '<section class="hq-hero"><h1>Best Canadian Made Mattress</h1></section>' +
  '<script>new IntersectionObserver(cb)</script></body></html>';
const skel = F.designSkeleton(shipped);
assert.match(skel, /hq-border-shift 9s/, 'nakuha ang TOTOONG keyframes, hindi paglalarawan nito');
assert.match(skel, /class="hq-hero"/, 'nakuha ang balangkas ng markup');
assert.match(skel, /IntersectionObserver/, 'nakuha ang script ng animation');
assert.ok(!skel.includes('LUMANG PAMAGAT'), 'TINANGGAL ang JSON-LD — kung hindi, kokopyahin niya ang lumang headline');
assert.ok(!skel.includes('datePublished'), 'walang lumang petsa na madadala sa bagong artikulo');

// ---------- Ang injection mismo ----------
const p = await F.createProject('Hamuq');
const mp = await F.addFile(p.id, 'v4.5-master.md', src);
const tp = await F.addFile(p.id, 'shipped-article.html', shipped);
await F.addFile(p.id, 'verified-facts.md', 'Ang presyo ng Hamuq Original Hybrid ay $999 CAD queen. '.repeat(30));
await F.setFileRole(p.id, mp.id, 'prompt');
await F.setFileRole(p.id, tp.id, 'template');
await F.attachSession('s1', p.id);
F.setFileSession('s1');

const w = await F.projectPrompt('s1', 'write');
// EKSAKTO ito, hindi malapit lang: ang orihinal ang naka-imbak, hindi hinuhulaan.
assert.ok(w.includes(src), 'BYTE-EXACT ang buong master prompt sa system prompt — walang nawala, walang doble');
assert.match(w, /GITNANG-SENTINEL/, 'VERBATIM ang GITNA sa system prompt — hindi buod, hindi tipak');
assert.match(w, /WAKAS-SENTINEL/, 'umabot ang injection hanggang dulo ng master prompt');
assert.match(w, /hq-border-shift 9s/, 'kasama ang TOTOONG CSS mula sa 🎨');
assert.ok(
  w.indexOf('===== 🎨') > 0 && w.indexOf('===== 🎨') < w.indexOf('===== 📌'),
  'UNA ang template: ang CSS ay byte-exact, ang panuntunan ay pwedeng i-paraphrase'
);
assert.ok(!w.includes('LUMANG PAMAGAT'), 'hindi dumadaan ang lumang schema kahit sa injection');

// Sa ibang mode, listahan lang — hindi binabayaran ang 33k token para sa Gmail check.
const a = await F.projectPrompt('s1', 'adaptive');
assert.ok(!a.includes('GITNANG-SENTINEL'), 'sa write mode LANG ipinapasok ang laman');
assert.ok(a.length < 1500, 'maliit pa rin ang project prompt sa ibang mode (' + a.length + ' chars)');
assert.match(a, /search_files/, 'sinasabi pa rin ang paraan ng paghanap');

// ---------- Hindi na hinahanap ang naipasok na ----------
await F.projectPrompt('s1', 'write'); // itinatakda ang injected set
const hits = await F.searchFiles('s1', 'panuntunan istruktura talahanayan kliyente');
assert.ok(
  !hits.mga_tipak.some((h) => h.file === 'v4.5-master.md'),
  'hindi na hinahanap ang master — nasa system prompt na, at ang 90+ tipak nito ay sasakop sa buong top-5'
);
// Ang dokumento ng TOTOONG DATOS ang nakakakuha na ngayon ng puwang. Dati, ang 90+
// tipak ng master ang sumasakop sa buong top-5 at nagugutom ito.
const facts = await F.searchFiles('s1', 'presyo Hamuq Original Hybrid queen');
assert.ok(facts.mga_tipak.some((h) => h.file === 'verified-facts.md'), 'nahahanap ang dokumento ng datos');
assert.ok(!facts.mga_tipak.some((h) => h.file === 'v4.5-master.md'), 'hindi ito nakakaagaw ng puwang');
// Kapag tahasang pinangalanan, hahanapin pa rin: iyon ang labasan kapag may pinutol.
const tahasan = await F.searchFiles('s1', 'panuntunan', 'v4.5-master');
assert.ok(tahasan.bilang >= 1, 'mahahanap pa rin kapag pinangalanan nang tahasan');

// ---------- Walang marka = SINASABI, hindi tahimik na nag-iimbento ----------
const p2 = await F.createProject('Bagong kliyente');
await F.addFile(p2.id, 'brief.md', 'Isang maikling brief tungkol sa serbisyo ng kliyente. '.repeat(20));
await F.attachSession('s2', p2.id);
const w2 = await F.projectPrompt('s2', 'write');
assert.match(w2, /WALANG FILE NA NAKAMARKAHAN/, 'malinaw na sinasabi kapag walang 📌 o 🎨');
assert.match(w2, /huwag kang mag-imbento/i, 'tahasang ipinagbabawal ang pag-iimbento ng palette');
// ANG SALITA DITO AY MAHALAGA, AT NAPATUNAYAN ITO SA TOTOONG PAGGAMIT.
// Ang unang bersyon ay nagsabing "WALANG MASTER PROMPT O TEMPLATE sa project na ito".
// Binasa iyon ng auditor bilang "walang design system ang project" at tinawag niyang
// imbento ang isang disenyong TOTOONG nasa mga dokumento — dalawang beses, at dalawang
// beses nagpasulat muli ng tapos nang artikulo. Anim na dagdag na model call.
// Ang totoong sinasabi ay: walang na-TAG na file, kaya walang naipasok nang buo.
assert.ok(
  !/walang disenyong masusunod/i.test(w2),
  'HUWAG sabihing walang disenyo ang project — ang sinasabi lang ay walang na-tag na file. ' +
    'Ang lumang pariralang ito ang binasa ng auditor bilang "imbento ang lahat", dalawang beses.'
);
assert.match(w2, /HINDI ito nangangahulugang walang design system/, 'malinaw ang pagkakaiba');
assert.match(w2, /search_files/, 'itinuturo ang paraan para hanapin ito sa mga dokumento');

// ---------- Sobrang laki: middle-out, at nananatiling mahahanap ----------
const sobra = 'PART 1: SIMULA\nUNANG-SENTINEL\n' +
  'Ang napakahabang talata na paulit-ulit para lumagpas sa hangganan ng injection. '.repeat(3000) +
  '\nPART 99: WAKAS\nHULING-SENTINEL';
assert.ok(sobra.length > F._fileInternals.MAX_PROJECT_INJECT, 'talagang lumalagpas ito sa cap');
const p3 = await F.createProject('Malaki');
const big = await F.addFile(p3.id, 'sobra.md', sobra);
await F.setFileRole(p3.id, big.id, 'prompt');
await F.attachSession('s3', p3.id);
F.setFileSession('s3');
const w3 = await F.projectPrompt('s3', 'write');
assert.match(w3, /UNANG-SENTINEL/, 'nananatili ang SIMULA (doon ang mga panuntunan)');
assert.match(w3, /HULING-SENTINEL/, 'nananatili ang DULO (doon ang checklist) — middle-out, hindi tail-cut');
assert.match(w3, /PINUTOL ANG GITNA/, 'sinasabi kung ano ang pinutol at kung paano ito makukuha');
const s3 = await F.searchFiles('s3', 'napakahabang talata paulit-ulit hangganan');
assert.ok(s3.bilang >= 1, 'ang PINUTOL na master ay NANANATILING mahahanap — ito ang escape hatch');

// ---------- Ang HTML na buong pahina ay hindi hinuhubaran ----------
const enc = (s) => new TextEncoder().encode(s);
const buoHtml = await F.extractText('shipped.html', enc(shipped));
assert.match(buoHtml, /class="hq-hero"/, 'ang BUONG pahina ay iniingatan ang markup — iyon ang punto ng 🎨');
const pirasoHtml = await F.extractText('piraso.html', enc('<p>Laman <b>dito</b></p>'));
assert.ok(!pirasoHtml.includes('<b>'), 'ang PIRASO lang ng HTML ay teksto ang halaga, kaya nililinis pa rin');

// ---------- Kusang pagmamarka, pati sa mga LUMANG file ----------
// Ang pagpindot ng ☆ at 🖌 ay hakbang na madaling makalimutan, at tahimik ang kabiguan:
// bumabalik lang siya sa paghahanap at gumagawa ng sariling disenyo. Sa isang totoong
// takbo, LABIMPITONG search_files bago pa makapagsulat ng isang salita.
const p4 = await F.createProject('Auto');
const m4 = await F.addFile(p4.id, 'client-master-prompt.md', src);
const t4 = await F.addFile(p4.id, 'shipped-2026.html', shipped);
await F.addFile(p4.id, 'notes.txt', 'Maikling tala lang ito.');
const files4 = (await F.listProjects())[p4.id].files;
assert.equal(files4.find((f) => f.id === m4.id).role, 'prompt', 'kusang nakilala ang master prompt');
assert.equal(files4.find((f) => f.id === t4.id).role, 'template', 'kusang nakilala ang template');
assert.ok(!files4.find((f) => f.name === 'notes.txt').role, 'hindi minamarkahan ang maikling tala');

// Ang mga file na na-upload BAGO ang v0.23 ay walang naka-imbak na orihinal, at ang
// HTML noon ay HINUBARAN ng tags. Kung ang raw lang ang titingnan, hindi maaayos ang
// mga umiiral nang project — at sila mismo ang may problema.
const p5 = await F.createProject('Luma');
const luma1 = await F.addFile(p5.id, 'v4.5-luma.md', src);
const luma2 = await F.addFile(p5.id, 'shipped-luma.html', 'Ang teksto lang, hinubaran na ng tags noong 2026. '.repeat(200));
for (const id of [luma1.id, luma2.id]) await chrome.storage.local.remove('fraw_' + id);
const ps5 = await F.listProjects();
for (const f of ps5[p5.id].files) f.role = '';
await chrome.storage.local.set({ projects: ps5 });

const r5 = await F.autoMark(p5.id);
const files5 = (await F.listProjects())[p5.id].files;
assert.equal(
  files5.find((f) => f.id === luma2.id).role, 'template',
  'nakikilala pa rin ang lumang .html sa PANGALAN — walang <style> doon dahil hinubaran ito ng lumang code'
);
assert.equal(files5.find((f) => f.id === luma1.id).role, 'prompt', 'nakikilala ang lumang master prompt mula sa mga tipak');
assert.equal(r5.binago.length, 2, 'iniuulat kung ano ang minarkahan para makita ng user');

// At kapag walang CSS ang 🎨, SINASABI ito — hindi tahimik na nagpapasok ng walang silbi.
await F.attachSession('s5', p5.id);
const w5 = await F.projectPrompt('s5', 'write');
assert.match(w5, /WALANG CSS sa loob/, 'sinasabi kapag walang disenyo ang minarkahang template');
assert.match(w5, /i-upload muli/, 'sinasabi ang gagawin');

// Hindi nang-aagaw sa piniling mano-mano ng user.
const bago = await F.autoMark(p5.id);
assert.equal(bago.binago.length, 0, 'walang binabago kapag may marka na');

console.log('OK — buo at verbatim ang master prompt at ang totoong CSS sa write mode');
