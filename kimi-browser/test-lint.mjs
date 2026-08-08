import assert from 'node:assert';
import { lintArticle, lintPrompt } from './lint.js';

// ANG PART 13 NG MASTER PROMPT AY 40 AYTEM. Mga dalawampu't pito ang masusukat nang
// tiyak: walang model call, walang gastos, at parehong sagot sa bawat takbo.
//
// Bakit ito kailangan: sa tatlong setting ng pag-iisip na sinukat ko sa PAREHONG
// gawain (walang hangganan, 4,000 na budget, patay), LAHAT ay pumalya sa parehong
// tatlo — walang <table>, walang id sa <h2>, at maling hugis ng presyo. Hindi ito
// naaayos ng mas malakas na modelo o mas mahabang pag-iisip. Code lang ang hindi
// nakakalimot.

const may = (mga, salita) => mga.find((r) => r.label.includes(salita));
const bagsak = (mga, salita) => { const r = may(mga, salita); assert.ok(r, `walang tseke para sa "${salita}"`); return !r.ok; };

// ---------- Isang artikulong tama ----------
const mabuti = `<style>
.hq-article{color:#1a1a1a}.hq-goldframe{border-radius:13px}.hq-table{width:100%}
.hq-hero{min-height:300px}.hq-faq{margin:0}.hq-cta{background:#1a1a1a}
@media (prefers-reduced-motion:reduce){.hq-goldframe{animation:none}.hq-hero{animation:none}}
</style>
<div class="hq-article">
<h1>How Much Does a Mattress Cost in Canada?</h1>
<p>A queen runs $999 CAD to $1,999 CAD, and 8 per cent of buyers overpay.</p>
<h2 id="chart">Price by type</h2><p>Foam is cheapest.</p>
<div class="hq-table"><table><tr><th>Type</th></tr><tr><td>Foam</td></tr></table></div>
<h2 id="size">Price by size</h2><table><tr><th>Size</th></tr><tr><td>Queen</td></tr></table>
<h2 id="method">Method</h2><table><tr><th>Source</th></tr><tr><td>StatsCan</td></tr></table>
<p>Verified against <a href="https://www.statcan.gc.ca/x" rel="noopener noreferrer" target="_blank">Statistics Canada</a>
and <a href="https://www.canada.ca/y" rel="noopener noreferrer" target="_blank">Health Canada</a>.
Douglas sells a <a href="https://www.douglas.ca/z" rel="nofollow noopener noreferrer" target="_blank">$799 CAD all-foam</a>.</p>
<p>See the <a href="https://hamuq.com/products/the-hamuq-hybrid">Original Hybrid</a>,
the <a href="https://hamuq.com/products/the-hamuq-organic">Organic Hybrid</a>,
and our <a href="https://hamuq.com/blogs/news/best-mattress-canada">hub</a>.</p>
<img src="https://cdn.shopify.com/s/files/1/1/files/bed.png" alt="A Hamuq hybrid in a Canadian bedroom">
<h2 id="faq">FAQ</h2>
<div class="hq-faq"><h3>Q1</h3><p>A</p><h3>Q2</h3><p>A</p><h3>Q3</h3><p>A</p><h3>Q4</h3><p>A</p><h3>Q5</h3><p>A</p></div>
<h2 id="cta">Where Hamuq sits</h2><div class="hq-cta"><p>$999 CAD queen.</p></div>
</div>
<script>if('IntersectionObserver' in window){}</script>
<script type="application/ld+json">{"@graph":[
{"@type":"Article","headline":"x"},
{"@type":"FAQPage","mainEntity":[]},
{"@type":"Product","positiveNotes":{},"negativeNotes":{}},
{"@type":"LocalBusiness","areaServed":["Ontario","Quebec","British Columbia"]}]}</script>`;

const ok = lintArticle(mabuti);
const mgaBagsak = ok.filter((r) => !r.ok);
assert.deepEqual(
  mgaBagsak.map((r) => r.label + ' — ' + r.detail), [],
  'ang artikulong sumusunod sa lahat ay dapat pumasa sa lahat. Kung bumagsak ito, ' +
    'MALI ANG PANUNTUNAN KO, hindi ang artikulo — at ang maling alarma ay ipinagwawalang-bahala.'
);
assert.equal(lintPrompt(ok), '', 'walang utos kapag walang bumagsak');

// ---------- Ang mga tunay na palya, isa-isa ----------
assert.ok(bagsak(lintArticle(mabuti.replace('$999 CAD to', '—')), 'em dash'), 'em dash');
assert.ok(bagsak(lintArticle(mabuti.replace('8 per cent', '8 percent')), 'per cent'), 'Canadian na baybay');
assert.ok(bagsak(lintArticle(mabuti.replace(/<table>/, '<div>')), 'tunay na table'), 'kulang sa table');
assert.ok(bagsak(lintArticle(mabuti.replace('id="size"', '')), 'id anchor'), 'h2 na walang id');
assert.ok(bagsak(lintArticle(mabuti.replace('<h3>Q5</h3><p>A</p>', '')), 'FAQ'), 'kulang sa FAQ');
assert.ok(bagsak(lintArticle(mabuti.replace(/rel="nofollow noopener noreferrer"/, '')), 'kalaban'),
  'ANG HINILING MISMO NG USER: nofollow noopener noreferrer sa link ng kalaban');
assert.ok(bagsak(lintArticle(mabuti.replace(/https:\/\/www\.statcan[^"]*/g, 'https://example.org/a').replace(/https:\/\/www\.canada\.ca[^"]*/g, 'https://example.org/b')), 'pinagmulan'),
  'walang link sa pinagmulan');
assert.ok(bagsak(lintArticle(mabuti.replace(/<a href="https:\/\/hamuq\.com\/products\/the-hamuq-organic">[^<]*<\/a>/, 'wala')), 'Dalawang beses'),
  'isang beses lang naka-link ang product');
assert.ok(bagsak(lintArticle(mabuti.replace('"LocalBusiness","areaServed":["Ontario","Quebec","British Columbia"]', '"LocalBusiness","areaServed":"Canada"')), 'LocalBusiness'),
  'ang areaServed ay dapat listahan ng probinsya, hindi "Canada" (Gate 4)');
assert.ok(bagsak(lintArticle(mabuti.replace('<h1>', '<h1 onclick="x()">')), 'inline'),
  'tinatanggal ng sanitizer ng Shopify ang on* sa bawat save — patay na buton');
assert.ok(bagsak(lintArticle(mabuti.replace(' alt="A Hamuq hybrid in a Canadian bedroom"', '')), 'alt ang bawat'), 'larawang walang alt');
assert.ok(bagsak(lintArticle(mabuti.replace('bed.png', 'bed_430x.png')), 'CDN'), 'thumbnail na suffix');
assert.ok(bagsak(lintArticle(mabuti.replace('$999 CAD queen', '$999 queen')), 'Presyo'), 'presyong walang CAD');

// ---------- Ang tatlong sirang nakita sa TOTOONG artikulo ----------
// 1. Klaseng ginamit pero walang CSS. Isinusulat ang <style> sa unang seksyon; ang
//    mga sumunod ay isinusulat nang hindi na ito nakikita, kaya nag-iimbento siya ng
//    bagong pangalan. 12 sa 45 sa isang totoong artikulo: .hq-ctacard gayong
//    .hq-cta-card ang tinukoy, at .hq-verdict at .hq-sources na wala talaga.
assert.ok(
  bagsak(lintArticle(mabuti.replace('class="hq-cta"', 'class="hq-ctacard"')), 'May CSS ang bawat klase'),
  'nahuhuli ang klaseng ginamit pero walang CSS — hindi ito nakikita sa mabilisang tingin'
);
// 2. Limang magkakapatid na wrapper, mula sa pagsulat kada seksyon.
assert.ok(
  bagsak(lintArticle(mabuti + '<div class="hq-article"><p>b</p></div>'), 'Isang wrapper'),
  'nahuhuli ang maraming wrapper'
);
// 3. Buong dokumento sa halip na fragment — dito hindi makita sa Shopify.
assert.ok(
  bagsak(lintArticle('<!doctype html><meta charset="utf-8">' + mabuti), 'Fragment'),
  'ang laman ng blog sa Shopify ay fragment; ang doctype ang dahilan kung bakit walang lumalabas'
);

// ---------- Ang @media ay hindi doble ----------
assert.ok(
  !bagsak(lintArticle(mabuti), 'dobleng'),
  'ang selector sa loob ng @media ay pagpapalit, hindi doble — maling alarma ito dati'
);

// ---------- Ang bilang ng FAQ ay sa seksyon ng FAQ lang ----------
const maramingH3 = mabuti.replace('<h2 id="chart">Price by type</h2>', '<h2 id="chart">Price by type</h2><h3>a</h3><h3>b</h3><h3>c</h3>');
assert.ok(
  !bagsak(lintArticle(maramingH3), 'FAQ'),
  'ang h3 sa ibang seksyon ay hindi FAQ — dating nagbibilang ng 20 sa artikulong may 7'
);

// ---------- Ang utos na maibabalik sa modelo ----------
const may3 = lintArticle(mabuti.replace(/<table>/, '<div>'));
const utos = lintPrompt(may3);
assert.match(utos, /write_document/, 'sinasabi ang tool na gagamitin sa pag-ayos');
assert.match(utos, /tunay na table/, 'nakalista ang mismong bumagsak');
assert.ok(!/✓/.test(utos), 'ang pasado ay hindi na ibinabalik — basura iyon sa konteksto');

console.log(`OK — ${ok.length} na tseke, walang maling alarma, at nakabalot bilang utos`);
