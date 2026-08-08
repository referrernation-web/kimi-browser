import assert from 'node:assert';
import zlib from 'node:zlib';

const store = {};
globalThis.chrome = {
  storage: {
    local: {
      get: async (k) => (typeof k === 'string' ? { [k]: store[k] } : { ...store }),
      set: async (o) => Object.assign(store, o),
      // Ang totoong API ay tumatanggap ng string O array. Dapat ganoon din ang stub —
      // ang stub na mas mahigpit kaysa sa totoo ay nagpapabagsak sa gumaganang code.
      remove: async (k) => { for (const one of [].concat(k)) delete store[one]; },
    },
  },
};
// Ang DecompressionStream ay native sa Chrome; sa Node ay ipinapasa natin sa zlib
// para masubok ang TOTOONG deflate-compressed na .docx (hindi lang store-only).
if (!globalThis.DecompressionStream) {
  globalThis.DecompressionStream = class {
    constructor() {
      const z = zlib.createInflateRaw();
      const { Readable, Writable } = require('node:stream');
      this.readable = Readable.toWeb(z);
      this.writable = Writable.toWeb(z);
    }
  };
}

const F = await import('./files.js');
const { makeDocx, parseMarkdown } = await import('./docx.js');

// --- Chunking: may overlap, walang maliliit na basura ---
const teksto = 'Ang unang talata tungkol sa HVAC maintenance. '.repeat(60);
const chunks = F.chunkText(teksto);
assert.ok(chunks.length > 1, 'nahahati ang mahabang teksto (' + chunks.length + ' tipak)');
assert.ok(chunks.every((c) => c.length <= F._fileInternals.CHUNK_SIZE + 50), 'sinusunod ang laki ng tipak');
assert.ok(chunks.every((c) => c.length > 20), 'walang basurang maliit na tipak');
assert.equal(F.chunkText('').length, 0);
assert.equal(F.chunkText('maikli').length, 0, 'ang sobrang ikli ay hindi nagiging tipak');

// --- .docx na gawa natin ay nababasa natin pabalik (round trip) ---
const docx = makeDocx('Aire One SOP', parseMarkdown('# Aire One SOP\n\nAng NAP ay dapat **eksakto**: Aire One Heating & Cooling, Brampton.\n\n## Tono\n\nPropesyonal pero madaling maintindihan.'));
const teksto2 = await F.extractText('sop.docx', docx);
assert.match(teksto2, /Aire One SOP/, 'nababasa ang pamagat');
assert.match(teksto2, /Brampton/, 'nababasa ang laman');
assert.match(teksto2, /Tono/, 'nababasa ang lahat ng seksyon');
assert.ok(!/<w:/.test(teksto2), 'naalis ang XML tags');
assert.ok(!/&amp;/.test(teksto2) && /&/.test(teksto2), 'na-decode ang ampersand');

// --- Mga plain text format ---
const enc = (s) => new TextEncoder().encode(s);
assert.equal(await F.extractText('a.txt', enc('hello world')), 'hello world');
assert.equal(await F.extractText('a.md', enc('# Pamagat')), '# Pamagat');
assert.match(await F.extractText('a.html', enc('<p>Laman <b>dito</b></p>')), /Laman dito/);
await assert.rejects(() => F.extractText('a.pdf', enc('x')), /PDF/, 'malinaw ang sabi tungkol sa PDF');
await assert.rejects(() => F.extractText('a.exe', enc('x')), /suportado/, 'tinatanggihan ang hindi kilalang format');

// --- Project lifecycle ---
const p = await F.createProject('Aire One Peel');
assert.ok(p.id);
await F.setInstructions(p.id, 'Laging gamitin ang eksaktong NAP. Huwag mag-imbento ng review.');
const r = await F.addFile(p.id, 'sop.docx', teksto2);
assert.equal(r.ok, true);
assert.ok(r.mga_tipak >= 1);

// --- Ang laman ay NASA HIWALAY na key, hindi sa project object ---
const ps = await F.listProjects();
assert.ok(!JSON.stringify(ps).includes('Brampton'), 'ang laman ay wala sa project metadata — targeted ang basa');
assert.ok(store[F._fileInternals.CHUNK_PREFIX + r.id], 'may sariling key ang mga tipak');

// --- Attach sa session at ang system prompt ---
await F.attachSession('sess1', p.id);
F.setFileSession('sess1');
const prompt = await F.projectPrompt('sess1');
assert.match(prompt, /Aire One Peel/, 'kasama ang pangalan ng project');
assert.match(prompt, /eksaktong NAP/, 'kasama ang tagubilin');
assert.match(prompt, /sop\.docx/, 'kasama ang PANGALAN ng dokumento');
assert.ok(!prompt.includes('Brampton'), 'ANG LAMAN AY WALA sa prompt — ito ang buong punto');
// Ang hangganan ay 1,600 hindi 1,200: idinagdag ang hugis ng bawat file (bilang ng
// linya, unang linya) at ang tuntuning ang kawalan sa isang ulat ng traffic ay hindi
// patunay ng kawalan sa site. Iyon ang pumigil sa pagrekomenda ng artikulong meron na.
// Maliit pa rin ito — ang punto ay hindi dumadaan dito ang LAMAN ng mga dokumento.
assert.ok(prompt.length < 1600, 'maliit ang project prompt (' + prompt.length + ' chars)');
assert.ok(!prompt.includes('Brampton'), 'ang laman ay wala pa rin dito');

// --- search_files: mga tumutugmang bahagi lang ---
const hits = await F.searchFiles('sess1', 'NAP Brampton');
assert.ok(hits.bilang >= 1, 'may nahanap');
assert.match(hits.mga_tipak[0].teksto, /Brampton/);
assert.ok(hits.mga_tipak.length <= F._fileInternals.MAX_HITS);
assert.equal(hits.mga_tipak[0].file, 'sop.docx', 'sinasabi kung saang file galing');

// Walang tugma = malinaw na sagot, hindi basura.
const wala = await F.searchFiles('sess1', 'zzzqqq walanggantiyanapaksa');
assert.equal(wala.bilang, 0);
assert.match(wala.tala, /Walang tumugma/);

// Walang project = malinaw ding sagot.
F.setFileSession('walang-project');
const noProj = await F.searchFiles('walang-project', 'kahit ano');
assert.match(noProj.error, /Walang naka-attach/);

// --- Malaking file: bounded pa rin ang search result ---
F.setFileSession('sess1');
await F.addFile(p.id, 'malaki.txt', 'Ang HVAC furnace filter ay dapat palitan. '.repeat(4000));
const big = await F.searchFiles('sess1', 'furnace filter palitan');
assert.ok(JSON.stringify(big).length < 6000, 'bounded ang search result kahit malaking file (' + JSON.stringify(big).length + ' chars)');

// --- Delete ---
await F.deleteFile(p.id, r.id);
assert.ok(!store[F._fileInternals.CHUNK_PREFIX + r.id], 'nabura pati ang mga tipak');
await F.deleteProject(p.id);
assert.equal(Object.keys(await F.listProjects()).length, 0);

console.log('OK — nababasa ang docx, hiwalay ang laman sa prompt, at bounded ang search');
