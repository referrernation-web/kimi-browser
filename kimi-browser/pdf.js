// --- PDF WRITER: walang library, gaya ng docx.js ---
// Ang PDF ay text-based na format: mga object, isang xref table, at content stream.
// Ginagamit natin ang Helvetica at Helvetica-Bold — kasama na sila sa bawat PDF
// reader (ang "standard 14"), kaya walang font na kailangang i-embed.

const PAGE_W = 612; // Letter, 72 dpi
const PAGE_H = 792;
const MARGIN = 64;
const TEXT_W = PAGE_W - MARGIN * 2;

// Tinatayang lapad ng Helvetica kada karakter (units/1000). Hindi kailangang
// perpekto — sapat para hindi lumagpas sa margin ang linya.
const WIDTHS = { ' ': 278, '.': 278, ',': 278, ':': 278, ';': 278, '!': 278, "'": 191, '"': 355, '(': 333, ')': 333, '-': 333, i: 222, j: 222, l: 222, t: 278, f: 278, r: 333, I: 278, m: 833, w: 722, M: 833, W: 944 };
const charW = (c, bold) => (WIDTHS[c] || (c >= 'A' && c <= 'Z' ? 667 : 556)) * (bold ? 1.05 : 1);
const textW = (s, size, bold) => {
  let w = 0;
  for (const c of s) w += charW(c, bold);
  return (w / 1000) * size;
};

function wrap(text, size, bold, maxW) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (textW(test, size, bold) > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

// Ang PDF string ay may sariling escaping; ang mga hindi-Latin ay pinapalitan para
// hindi masira ang file (ang WinAnsi ay hindi kayang lahat ng Unicode).
const esc = (s) =>
  String(s)
    .replace(/[\\()]/g, (m) => '\\' + m)
    .replace(/[^\x20-\x7E]/g, (c) => {
      const map = { '‘': "'", '’': "'", '“': '"', '”': '"', '–': '-', '—': '-', '•': '-', '…': '...' };
      return map[c] || '?';
    });

// Ang blocks ay galing sa parseMarkdown ng docx.js — iisa ang pinagmumulan.
export function makePdf(title, blocks) {
  const STYLE = {
    h1: { size: 20, bold: true, before: 18, after: 8 },
    h2: { size: 15, bold: true, before: 14, after: 6 },
    h3: { size: 13, bold: true, before: 11, after: 5 },
    p: { size: 10.5, bold: false, before: 0, after: 9 },
    li: { size: 10.5, bold: false, before: 0, after: 4, indent: 16, bullet: true },
    quote: { size: 10.5, bold: false, before: 4, after: 9, indent: 20 },
  };

  // 1) Ilatag ang lahat ng linya sa mga pahina.
  const pages = [];
  let cur = [];
  let y = PAGE_H - MARGIN;
  const newPage = () => {
    pages.push(cur);
    cur = [];
    y = PAGE_H - MARGIN;
  };

  const all = [{ type: 'h1', runs: [{ text: title || 'Dokumento' }] }, ...(blocks || [])];
  for (const b of all) {
    const st = STYLE[b.type] || STYLE.p;
    const raw = (b.runs || []).map((r) => r.text).join('');
    if (!raw.trim()) continue;
    const indent = st.indent || 0;
    const lines = wrap(raw, st.size, st.bold, TEXT_W - indent);
    y -= st.before;
    for (let i = 0; i < lines.length; i++) {
      if (y - st.size < MARGIN) newPage();
      const prefix = st.bullet && i === 0 ? '- ' : '';
      cur.push({ x: MARGIN + indent, y: y - st.size, size: st.size, bold: st.bold, text: prefix + lines[i] });
      y -= st.size * 1.35;
    }
    y -= st.after;
  }
  pages.push(cur);

  // 2) Content stream kada pahina.
  const streams = pages.map((items) => {
    let s = '';
    for (const it of items) {
      s += `BT /${it.bold ? 'FB' : 'FR'} ${it.size} Tf 1 0 0 1 ${it.x.toFixed(1)} ${it.y.toFixed(1)} Tm (${esc(it.text)}) Tj ET\n`;
    }
    return s;
  });

  // 3) Buuin ang mga object. 1=Catalog, 2=Pages, 3=Helvetica, 4=Helvetica-Bold,
  //    tapos kada pahina: Page object + Contents stream.
  const objs = [];
  const pageIds = pages.map((_, i) => 5 + i * 2);
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[2] = `<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`;
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  pages.forEach((_, i) => {
    const pid = pageIds[i];
    objs[pid] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
      `/Resources << /Font << /FR 3 0 R /FB 4 0 R >> >> /Contents ${pid + 1} 0 R >>`;
    objs[pid + 1] = `<< /Length ${streams[i].length} >>\nstream\n${streams[i]}endstream`;
  });

  // 4) Isulat ang file at itala ang offset ng bawat object para sa xref.
  let out = '%PDF-1.4\n';
  const offsets = [];
  for (let i = 1; i < objs.length; i++) {
    if (!objs[i]) continue;
    offsets[i] = out.length;
    out += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xrefStart = out.length;
  const maxId = objs.length;
  out += `xref\n0 ${maxId}\n0000000000 65535 f \n`;
  for (let i = 1; i < maxId; i++) {
    out += offsets[i] ? String(offsets[i]).padStart(10, '0') + ' 00000 n \n' : '0000000000 65535 f \n';
  }
  out += `trailer\n<< /Size ${maxId} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  // Latin-1 bytes — tugma sa WinAnsiEncoding at sa mga offset na binilang natin.
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}
