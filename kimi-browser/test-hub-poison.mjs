import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

// ANG NANGYARI SA TOTOONG SESYON (Aug 9, Hamuq SEO):
// Sumuko ang ensureScope dahil chrome:// ang bukas na tab, at ang error ay "Walang
// scope group pa." Naniwala ang agent na katotohanan iyon tungkol sa mundo, at
// itinala nang permanente sa knowledge hub:
//     "Ang live browser ay nangangailangan ng scope group setup"
//     "hamuq.com/sitemap.xml ay hindi ma-access (walang scope group)"
//     "Hindi pa na-access nang live ang hamuq.com/sitemap.xml"
//
// Hindi sapat ang ayusin ang bug. Habang nandiyan ang mga talang ito, ipinapasok sila
// sa BAWAT system prompt at sinasabihan siyang huwag nang subukan — kaya mali pa rin
// ang gawi niya kahit gumagana na ang mekanismo. Ang maling aral ay mas mapanganib
// kaysa sa walang aral: mukha itong karanasan.

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

// Ang eksaktong hugis ng hub pagkatapos ng sesyong iyon.
store.hub = {
  v: 1, migratedFrom: null, lastConsolidated: {},
  records: [
    { id: 'h_1', text: 'Ang live browser ay nangangailangan ng "scope group" setup mula sa panel bago makapag-navigate.', domain: '', kind: 'gotcha', source: 'error', hits: 3, created: 1, lastUsed: 1, pinned: false },
    { id: 'h_2', text: 'hamuq.com/sitemap.xml ay hindi ma-access (walang scope group).', domain: 'hamuq.com', kind: 'gotcha', source: 'error', hits: 2, created: 1, lastUsed: 1, pinned: false },
    { id: 'h_3', text: 'Hindi pa na-access nang live ang hamuq.com/sitemap.xml — may hadlang sa browser.', domain: 'hamuq.com', kind: 'note', source: 'reflect', hits: 1, created: 1, lastUsed: 1, pinned: false },
    { id: 'h_4', text: 'Ang Hamuq ay Canadian mattress brand, value positioning, coil-heavy hybrid.', domain: 'hamuq.com', kind: 'note', source: 'user', hits: 5, created: 1, lastUsed: 1, pinned: false },
    { id: 'h_5', text: 'Gusto ng user ang English na deliverable kahit Tagalog ang usapan.', domain: '', kind: 'pref', source: 'user', hits: 4, created: 1, lastUsed: 1, pinned: true },
  ],
};

const H = await import('./hub.js');

const hub = await H.hubLoad();
const teksto = hub.records.map((r) => r.text);

for (const bawal of ['scope group', 'sitemap.xml ay hindi ma-access', 'Hindi pa na-access nang live']) {
  assert.ok(
    !teksto.some((t) => t.includes(bawal)),
    `NANDITO PA: "${bawal}" — ituturo nito sa kanya na huwag nang subukan kahit naayos na`
  );
}
assert.equal(hub.records.length, 2, 'tatlong maling aral ang inalis, dalawang totoo ang naiwan');
assert.ok(teksto.some((t) => /Canadian mattress brand/.test(t)), 'HINDI hinawakan ang tunay na kaalaman');
assert.ok(teksto.some((t) => /English na deliverable/.test(t)), 'ligtas ang naka-pin');

// Isang beses lang, at nakatago sa storage — hindi tumatakbo sa bawat load.
assert.equal(hub.cleaned, 1, 'may marka na tapos na');
assert.equal(store.hub.records.length, 2, 'naisulat sa storage, hindi lang sa alaala');
store.hub.records.push({ id: 'h_6', text: 'Kailangan ng scope group bago mag-navigate.', domain: '', kind: 'gotcha', source: 'error', hits: 1, created: 2, lastUsed: 2, pinned: false });
const ulit = await H.hubLoad();
assert.equal(
  ulit.records.length, 3,
  'HINDI na ito umuulit — isang beses na paglilinis ito ng lumang pinsala, hindi permanenteng censor'
);

// Ang bagong hub ay walang binubura — walang dapat linisin.
delete store.hub;
const bagoHub = await H.hubLoad();
assert.equal(bagoHub.records.length, 0, 'ligtas sa bagong install');
assert.equal(bagoHub.cleaned, 1, 'namamarkahan pa rin para hindi na tumakbo ulit');

// At sinasabihan siyang huwag nang matuto nito muli.
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const tools = fs.readFileSync(path.join(HERE, 'tools.js'), 'utf8');
assert.match(
  tools, /HUWAG na HUWAG itala ang pagpalya ng SARILI MONG mga tool/,
  'ang tuntunin laban sa pagtatala ng sariling depekto ay nasa deskripsyon ng remember'
);

console.log('OK — nalinis ang maling aral, ligtas ang totoo, at hindi na ito matututuhan muli');
