import assert from 'node:assert';
import zlib from 'node:zlib';
import { parseMarkdown, blocksToHtml, crc32, zipStore, makeDocx, makePptx, splitSlides } from './docx.js';

// --- CRC32 laban sa kilalang halaga: kung mali ito, tatanggihan ng Word ang file ---
assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926, 'tama ang CRC32');

// --- Markdown parser ---
const md = `# Pamagat
Unang talata na may **bold** at *italic*.

## Seksyon
- unang bullet
- pangalawang bullet
1. numerado

> sipi

Pangalawang talata & may <tag> na dapat ma-escape.`;
const blocks = parseMarkdown(md);
assert.equal(blocks[0].type, 'h1');
assert.ok(blocks.some((b) => b.type === 'h2'));
assert.equal(blocks.filter((b) => b.type === 'li').length, 3, 'tatlong list item');
assert.ok(blocks.some((b) => b.runs.some((r) => r.b)), 'may bold run');
assert.ok(blocks.some((b) => b.runs.some((r) => r.i)), 'may italic run');
assert.ok(blocks.some((b) => b.type === 'quote'), 'may quote');
// Ang link ay pangalan lang ang natitira.
assert.equal(parseMarkdown('Tingnan ang [docs](https://x.com/a).')[0].runs.map((r) => r.text).join(''),
  'Tingnan ang docs.');

// --- HTML preview ---
const html = blocksToHtml(blocks);
assert.match(html, /<h1>Pamagat<\/h1>/);
assert.match(html, /<strong>bold<\/strong>/);
assert.match(html, /<ul>.*<li>/s);
assert.match(html, /&amp;/, 'na-escape ang ampersand');
assert.ok(!/<tag>/.test(html), 'na-escape ang literal na tag');

// --- Zip: totoong unzip gamit ang node zlib, hindi lang pagbasa ng signature ---
function unzip(buf) {
  // Basahin ang EOCD, tapos ang central directory — ito mismo ang gagawin ng Word.
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  assert.ok(eocd >= 0, 'may EOCD');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = {};
  for (let i = 0; i < count; i++) {
    assert.equal(dv.getUint32(p, true), 0x02014b50, 'central dir signature');
    const method = dv.getUint16(p + 10, true);
    const crc = dv.getUint32(p + 16, true);
    const csize = dv.getUint32(p + 20, true);
    const usize = dv.getUint32(p + 24, true);
    const nlen = dv.getUint16(p + 28, true);
    const lho = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(buf.slice(p + 46, p + 46 + nlen));
    assert.equal(method, 0, 'store-only');
    assert.equal(csize, usize, 'walang compression kaya pareho ang laki');
    // Pumunta sa local header at kunin ang tunay na data.
    assert.equal(dv.getUint32(lho, true), 0x04034b50, 'local header signature');
    const lnlen = dv.getUint16(lho + 26, true);
    const lelen = dv.getUint16(lho + 28, true);
    const start = lho + 30 + lnlen + lelen;
    const data = buf.slice(start, start + usize);
    assert.equal(crc32(data), crc, `tugma ang CRC ng ${name}`);
    out[name] = new TextDecoder().decode(data);
    p += 46 + nlen + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
  }
  return out;
}

// --- DOCX: buo ba ang package at nabubuksan ang sariling output? ---
const docx = makeDocx('Winter Tips', blocks);
assert.ok(docx instanceof Uint8Array && docx.length > 500);
const dfiles = unzip(docx);
for (const need of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml', 'word/_rels/document.xml.rels']) {
  assert.ok(dfiles[need], `may ${need}`);
}
assert.match(dfiles['word/document.xml'], /<w:pStyle w:val="Heading1"\/>/, 'may heading style');
assert.match(dfiles['word/document.xml'], /<w:b\/>/, 'may bold');
assert.match(dfiles['word/document.xml'], /<w:sectPr>/, 'may section properties');
assert.match(dfiles['word/document.xml'], /Winter Tips/, 'kasama ang pamagat');
assert.ok(!/<tag>/.test(dfiles['word/document.xml']), 'na-escape ang XML sa docx');

// --- PPTX: tamang bilang ng slide at buo ang rels ---
const slides = splitSlides('Winter Tips', blocks);
assert.ok(slides[0].isTitle, 'title slide ang una');
assert.equal(slides.length, 3, 'title + h1 + h2 = 3 slides');
assert.ok(slides[2].bullets.length >= 3, 'may bullets ang slide ng seksyon');

const pptx = makePptx('Winter Tips', blocks);
const pfiles = unzip(pptx);
for (const need of ['[Content_Types].xml', '_rels/.rels', 'ppt/presentation.xml',
  'ppt/_rels/presentation.xml.rels', 'ppt/slideMasters/slideMaster1.xml',
  'ppt/slideLayouts/slideLayout1.xml', 'ppt/theme/theme1.xml', 'ppt/slides/slide1.xml',
  'ppt/slides/_rels/slide1.xml.rels']) {
  assert.ok(pfiles[need], `may ${need}`);
}
// Bawat slide ay may Override sa Content_Types at Relationship sa presentation rels —
// kung kulang ang alinman, tatanggihan ng PowerPoint ang buong file.
for (let i = 1; i <= slides.length; i++) {
  assert.ok(pfiles[`ppt/slides/slide${i}.xml`], `may slide${i}.xml`);
  assert.ok(pfiles['[Content_Types].xml'].includes(`/ppt/slides/slide${i}.xml`), `may Override ang slide${i}`);
  assert.ok(pfiles['ppt/_rels/presentation.xml.rels'].includes(`slides/slide${i}.xml`), `may rel ang slide${i}`);
}
assert.match(pfiles['ppt/slides/slide1.xml'], /Winter Tips/);
assert.match(pfiles['ppt/presentation.xml'], /<p:sldSz cx="12192000"/, '16:9 na sukat');

// Ang bilang ng sldId ay dapat katumbas ng bilang ng slide file.
assert.equal((pfiles['ppt/presentation.xml'].match(/<p:sldId /g) || []).length, slides.length);

console.log('OK — valid na docx at pptx, tumpak ang CRC, buo ang package, na-escape ang XML');
