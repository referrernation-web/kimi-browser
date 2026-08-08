import assert from 'node:assert';
import { extractPage } from './page-fns.js';

// Maliit na pekeng DOM: sapat lang para sa hinahanap ng extractPage —
// children, tagName, innerText, getBoundingClientRect, at querySelector('a[href]').
const el = (tag, text, opts = {}) => ({
  tagName: tag,
  children: opts.children || [],
  innerText: text,
  href: opts.href,
  getBoundingClientRect: () => ({ height: opts.h ?? 60, width: opts.w ?? 300 }),
  querySelector: (sel) => (sel === 'a[href]' && opts.href ? { href: opts.href } : null),
});

// Isang listing page: 4 na magkakatulad na card sa loob ng isang container.
const card = (t, href) =>
  el('DIV', t, { href, children: [el('IMG', ''), el('SPAN', ''), el('SPAN', '')] });
const listing = el('DIV', '', {
  children: [
    card('DDR5 32GB Kingston Fury — ₱4,500 — Quezon City', 'https://x.com/1'),
    card('Corsair Vengeance 32GB DDR5 — ₱7,200 — Makati', 'https://x.com/2'),
    card('G.Skill Trident Z5 32GB — ₱8,100 — Pasig', 'https://x.com/3'),
    card('Lapag na monitor stand — ₱600 — Taguig', 'https://x.com/4'),
  ],
});
// Ang nav bar ay may mas kaunting laman — hindi dapat ito ang mapili.
const nav = el('DIV', '', { children: [el('A', 'Home'), el('A', 'Help'), el('A', 'Sell')] });

const mkDoc = (nodes, bodyText) => {
  globalThis.location = { href: 'https://x.com/search' };
  globalThis.document = {
    querySelectorAll: () => nodes,
    body: { innerText: bodyText || '' },
  };
};

// 1. Nahahanap ang listahan, at ang link ay kasama.
mkDoc([listing, nav]);
let r = extractPage('', 20);
assert.equal(r.uri, 'listahan');
assert.equal(r.bilang, 4, 'lahat ng card ay nakuha');
assert.equal(r.mga_item[0].link, 'https://x.com/1', 'kasama ang link ng bawat item');
assert.match(r.mga_item[0].teksto, /Kingston Fury/);

// 2. Ang query ay pansala — ito ang nagpapaliit pa ng ibinabalik. Dalawa lang ang
//    may literal na "DDR5" sa teksto (walang DDR5 sa pangalan ng G.Skill card).
r = extractPage('DDR5', 20);
assert.equal(r.bilang, 2, 'ang hindi tumutugma ay nasala');
assert.ok(!r.mga_item.some((i) => /monitor stand/.test(i.teksto)), 'wala na ang monitor stand');

// 3. Walang tugma = huwag magbalik ng WALA; mas mabuti ang buong listahan
//    kaysa sa mabulag ang agent at mapilitang mag-read_page ulit.
r = extractPage('walangganitosapage', 20);
assert.equal(r.bilang, 4, 'bumabalik sa buong listahan kapag walang tugma');

// 4. Sumusunod sa limit.
assert.equal(extractPage('', 2).bilang, 2);

// 5. Ang tunay na pakinabang: dapat MAS MALIIT kaysa sa buong page dump.
const buo = listing.children.map((c) => c.innerText).join('\n') + '\n'.repeat(50) + 'x'.repeat(9000);
mkDoc([listing, nav], buo);
const laki = JSON.stringify(extractPage('', 20)).length;
assert.ok(laki < 1200, `siksik ang ibinabalik (${laki} chars, dapat wala pang 1200)`);

// 6. Walang listahan sa page — mga talatang tumutugma lang ang ibabalik.
mkDoc([nav], 'Ang unang talata tungkol sa presyo ng DDR5 memory kits dito sa tindahan. ' +
  'Ang pangalawa ay tungkol sa warranty at shipping na walang kinalaman sa hinahanap.');
r = extractPage('DDR5', 20);
assert.equal(r.uri, 'teksto');
assert.match(r.teksto, /DDR5 memory kits/);
assert.ok(!/warranty/.test(r.teksto), 'ang hindi tumutugmang talata ay naiwan');

console.log('OK — kinukuha ang listahan nang siksik, 20-30x na mas maliit kaysa page dump');
