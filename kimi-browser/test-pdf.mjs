import assert from 'node:assert';
import { makePdf } from './pdf.js';
import { parseMarkdown } from './docx.js';

const md = `## Ang Unang Seksyon

Ito ang isang mahabang talata na dapat mabalot sa maraming linya dahil lumalampas ito sa lapad ng pahina, at kailangan nating tiyakin na hindi ito tumatawid sa margin. ${'Dagdag na pangungusap para humaba pa. '.repeat(20)}

- Unang bullet
- Pangalawang bullet na medyo mahaba para masubok ang pagbalot ng listahan sa loob ng indent

### Pang-tatlong antas

Maikling talata lang.`;

const bytes = makePdf('Winter Tips para sa Aire One', parseMarkdown(md));
const s = Buffer.from(bytes).toString('latin1');

// --- Balangkas ng PDF ---
assert.ok(s.startsWith('%PDF-1.4'), 'may tamang header');
assert.ok(s.trimEnd().endsWith('%%EOF'), 'may tamang dulo');
assert.match(s, /\/Type \/Catalog/, 'may catalog');
assert.match(s, /\/Type \/Pages/, 'may pages tree');
assert.match(s, /\/BaseFont \/Helvetica\b/, 'may regular na font');
assert.match(s, /\/BaseFont \/Helvetica-Bold/, 'may bold na font');
assert.match(s, /\/MediaBox \[0 0 612 792\]/, 'Letter size');

// --- Ang xref offsets ay dapat TUMPAK, kung hindi ay ayaw bumukas ng reader ---
const xrefStart = +/startxref\s+(\d+)/.exec(s)[1];
assert.equal(s.slice(xrefStart, xrefStart + 4), 'xref', 'tumuturo sa tunay na xref ang startxref');
const rows = s.slice(xrefStart).match(/^(\d{10}) 00000 n $/gm) || [];
assert.ok(rows.length >= 6, 'may xref entry bawat object (' + rows.length + ')');
for (const row of rows) {
  const off = +row.slice(0, 10);
  assert.match(s.slice(off, off + 20), /^\d+ 0 obj/, `tumpak ang offset ${off}`);
}

// --- Ang laman ay nandoon at naka-escape nang maayos ---
assert.match(s, /\(Winter Tips para sa Aire One\) Tj/, 'nasa loob ang pamagat');
assert.match(s, /Ang Unang Seksyon/, 'nasa loob ang heading');
assert.match(s, /- Unang bullet/, 'may bullet marker');
assert.ok(/\/FB 1[0-9.]* Tf/.test(s) || /\/FB 20 Tf/.test(s), 'ginagamit ang bold sa heading');

// --- Multi-page: ang mahabang dokumento ay dapat mahati ---
const mahaba = parseMarkdown('## Seksyon\n\n' + 'Ang mahabang talata na paulit-ulit para mapuno ang maraming pahina. '.repeat(400));
const big = Buffer.from(makePdf('Mahaba', mahaba)).toString('latin1');
const pageCount = +/\/Count (\d+)/.exec(big)[1];
assert.ok(pageCount > 3, 'nahahati sa maraming pahina (' + pageCount + ')');
assert.equal((big.match(/\/Type \/Page[^s]/g) || []).length, pageCount, 'tugma ang bilang ng Page object sa Count');

// --- Escaping: ang parenthesis at backslash ay sumisira ng PDF string kung hindi naka-escape ---
const tricky = Buffer.from(makePdf('Test (may parenthesis) at \\ backslash', parseMarkdown('Presyo: (₱4,500) — "mura" ito.'))).toString('latin1');
assert.match(tricky, /\\\(may parenthesis\\\)/, 'naka-escape ang parenthesis');
assert.ok(!/₱/.test(tricky), 'ang hindi-Latin ay pinapalitan, hindi sinisira ang file');
// Ang tunay na panganib: hindi-naka-escape na parenthesis sa loob ng string, dahil
// doon nagtatapos nang maaga ang string at nasisira ang buong PDF.
for (const lit of tricky.match(/\((?:\\.|[^()\\])*\) Tj/g) || []) {
  const inner = lit.slice(1, -4);
  assert.ok(!/(^|[^\\])[()]/.test(inner), `balanse ang string: ${inner.slice(0, 60)}`);
}

// --- Walang laman: hindi dapat sumabog ---
const walang = Buffer.from(makePdf('Blangko', [])).toString('latin1');
assert.ok(walang.startsWith('%PDF') && walang.includes('%%EOF'), 'valid pa rin kahit walang laman');

console.log('OK — tumpak ang xref, nahahati sa pahina, at ligtas ang escaping');
