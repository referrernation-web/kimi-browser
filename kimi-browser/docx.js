// --- DOCUMENT BUILDER: .docx at .pptx nang WALANG external library ---
// Ang .docx at .pptx ay parehong ZIP na may XML sa loob (OOXML), kaya iisang zip
// writer at iisang markdown parser ang pinagsasaluhan nila. Store-only ang zip
// (walang compression) — valid pa rin ito at CRC32 lang ang tunay na trabaho.

// ============ 1. MARKDOWN PARSER (shared ng docx, pptx, at HTML preview) ============

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

// Isang linya → mga run na may bold/italic. Ang link ay pangalan lang ang natitira.
function inlineRuns(text) {
  const out = [];
  let rest = String(text).replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/`([^`]*)`/g, '$1');
  const re = /(\*\*|__)(.+?)\1|(\*|_)(.+?)\3/;
  let m;
  while ((m = re.exec(rest))) {
    if (m.index > 0) out.push({ text: rest.slice(0, m.index) });
    if (m[2] !== undefined) out.push({ text: m[2], b: true });
    else out.push({ text: m[4], i: true });
    rest = rest.slice(m.index + m[0].length);
  }
  if (rest) out.push({ text: rest });
  return out.filter((r) => r.text);
}

// Markdown → blocks. Ito ang iisang representasyon na ginagamit ng lahat ng format.
export function parseMarkdown(md) {
  const blocks = [];
  const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
  let para = [];
  const flush = () => {
    if (!para.length) return;
    blocks.push({ type: 'p', runs: inlineRuns(para.join(' ')) });
    para = [];
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flush(); continue; }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { flush(); blocks.push({ type: 'h' + Math.min(h[1].length, 3), runs: inlineRuns(h[2]) }); continue; }
    const li = /^\s*[-*•]\s+(.*)$/.exec(line);
    if (li) { flush(); blocks.push({ type: 'li', runs: inlineRuns(li[1]) }); continue; }
    const ol = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
    if (ol) { flush(); blocks.push({ type: 'li', ordinal: +ol[1], runs: inlineRuns(ol[2]) }); continue; }
    const q = /^\s*>\s?(.*)$/.exec(line);
    if (q) { flush(); blocks.push({ type: 'quote', runs: inlineRuns(q[1]) }); continue; }
    para.push(line.trim());
  }
  flush();
  return blocks;
}

export function blocksToHtml(blocks) {
  const runs = (rs) => rs.map((r) => (r.b ? `<strong>${esc(r.text)}</strong>` : r.i ? `<em>${esc(r.text)}</em>` : esc(r.text))).join('');
  let html = '';
  let inList = false;
  for (const b of blocks) {
    if (b.type === 'li' && !inList) { html += '<ul>'; inList = true; }
    if (b.type !== 'li' && inList) { html += '</ul>'; inList = false; }
    if (b.type === 'li') html += `<li>${runs(b.runs)}</li>`;
    else if (b.type === 'quote') html += `<blockquote>${runs(b.runs)}</blockquote>`;
    else if (b.type[0] === 'h') html += `<${b.type}>${runs(b.runs)}</${b.type}>`;
    else html += `<p>${runs(b.runs)}</p>`;
  }
  if (inList) html += '</ul>';
  return html;
}

// ============ 2. STORE-ONLY ZIP WRITER (shared ng docx at pptx) ============

let crcTable = null;
export function crc32(bytes) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[i] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const enc = (s) => new TextEncoder().encode(s);

export function zipStore(files) {
  const parts = [];
  const central = [];
  let offset = 0;
  const u16 = (n) => [n & 0xff, (n >> 8) & 0xff];
  const u32 = (n) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];

  for (const f of files) {
    const name = enc(f.name);
    const data = typeof f.data === 'string' ? enc(f.data) : f.data;
    const crc = crc32(data);
    // General purpose bit 11 = UTF-8 na filename; method 0 = store (walang compression).
    const local = [
      ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0),
      ...u16(0), ...u16(0x2821), // nakapirming DOS time/date — deterministic ang output
      ...u32(crc), ...u32(data.length), ...u32(data.length),
      ...u16(name.length), ...u16(0),
    ];
    parts.push(new Uint8Array(local), name, data);
    central.push({ name, crc, size: data.length, offset });
    offset += local.length + name.length + data.length;
  }

  const dir = [];
  for (const c of central) {
    dir.push(
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0),
      ...u16(0), ...u16(0x2821), ...u32(c.crc), ...u32(c.size), ...u32(c.size),
      ...u16(c.name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(c.offset)
    );
    dir.push(...c.name);
  }
  const dirBytes = new Uint8Array(dir);
  const eocd = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(central.length), ...u16(central.length),
    ...u32(dirBytes.length), ...u32(offset), ...u16(0),
  ]);

  const total = offset + dirBytes.length + eocd.length;
  const out = new Uint8Array(total);
  let p = 0;
  for (const part of parts) { out.set(part, p); p += part.length; }
  out.set(dirBytes, p); p += dirBytes.length;
  out.set(eocd, p);
  return out;
}

// ============ 3. DOCX ============

const XMLNS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function wRuns(rs) {
  return rs
    .map((r) => {
      const props = (r.b ? '<w:b/>' : '') + (r.i ? '<w:i/>' : '');
      return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${esc(r.text)}</w:t></w:r>`;
    })
    .join('');
}

function wPara(b) {
  const style = { h1: 'Heading1', h2: 'Heading2', h3: 'Heading3' }[b.type];
  let pPr = '';
  let runs = b.runs;
  if (style) pPr = `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>`;
  else if (b.type === 'li') {
    // Sinasadyang indent + literal na bullet: iniiwasan ang numbering.xml na siyang
    // pinaka-marupok na bahagi ng OOXML. Walang nakikitang pagkakaiba sa Word.
    pPr = '<w:pPr><w:ind w:left="720"/></w:pPr>';
    runs = [{ text: (b.ordinal ? b.ordinal + '. ' : '• ') }, ...b.runs];
  } else if (b.type === 'quote') {
    pPr = '<w:pPr><w:ind w:left="720"/></w:pPr>';
    runs = b.runs.map((r) => ({ ...r, i: true }));
  }
  return `<w:p>${pPr}${wRuns(runs)}</w:p>`;
}

const DOCX_STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${XMLNS_W}">
<w:style w:type="paragraph" w:styleId="Normal" w:default="1"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="22"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="360" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="280" w:after="120"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>
</w:styles>`;

export function makeDocx(title, blocks) {
  const body =
    (title ? wPara({ type: 'h1', runs: [{ text: title }] }) : '') +
    blocks.map(wPara).join('') +
    '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>';

  return zipStore([
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>` },
    { name: 'word/_rels/document.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: 'word/styles.xml', data: DOCX_STYLES },
    { name: 'word/document.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${XMLNS_W}"><w:body>${body}</w:body></w:document>` },
  ]);
}

// ============ 4. PPTX ============
// Ang paghahati sa slide: bawat h1/h2 ay bagong slide (pamagat + mga bullet mula sa
// sumunod na laman). Ang document title ay ang unang slide.

const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

export function splitSlides(title, blocks) {
  const slides = [];
  let cur = null;
  for (const b of blocks) {
    if (b.type === 'h1' || b.type === 'h2') {
      if (cur) slides.push(cur);
      cur = { title: b.runs.map((r) => r.text).join(''), bullets: [] };
      continue;
    }
    if (!cur) cur = { title: title || 'Slide', bullets: [] };
    const text = b.runs.map((r) => r.text).join('').trim();
    if (!text) continue;
    if (b.type === 'h3') cur.bullets.push(text);
    else if (b.type === 'li') cur.bullets.push(text);
    else {
      // Ang mahabang talata ay pinuputol — ang slide ay hindi dokumento.
      cur.bullets.push(text.length > 220 ? text.slice(0, 217) + '…' : text);
    }
  }
  if (cur) slides.push(cur);
  // Title slide sa unahan.
  return [{ title: title || 'Dokumento', bullets: [], isTitle: true }, ...slides].filter(
    (s, i) => i === 0 || s.title || s.bullets.length
  );
}

function slideXml(s) {
  const bullets = s.bullets
    .map((t) => `<a:p><a:pPr lvl="0"/><a:r><a:rPr lang="en-US" sz="1800"/><a:t>${esc(t)}</a:t></a:r></a:p>`)
    .join('');
  const bodyShape = s.bullets.length
    ? `<p:sp><p:nvSpPr><p:cNvPr id="3" name="Content"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="838200" y="2000250"/><a:ext cx="10515600" cy="3600000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/>${bullets}</p:txBody></p:sp>`
    : '';
  const titleSz = s.isTitle ? 4000 : 2800;
  const titleY = s.isTitle ? '2400000' : '800000';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="838200" y="${titleY}"/><a:ext cx="10515600" cy="1200000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="${titleSz}" b="1"/><a:t>${esc(s.title)}</a:t></a:r></a:p></p:txBody></p:sp>${bodyShape}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

const SLIDE_MASTER = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`;

const SLIDE_LAYOUT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;

const THEME = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="${A}" name="Dianna"><a:themeElements><a:clrScheme name="D"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1B1D21"/></a:dk2><a:lt2><a:srgbClr val="F4F5F7"/></a:lt2><a:accent1><a:srgbClr val="7C5CFF"/></a:accent1><a:accent2><a:srgbClr val="4A2FD0"/></a:accent2><a:accent3><a:srgbClr val="0B7A5A"/></a:accent3><a:accent4><a:srgbClr val="B46A00"/></a:accent4><a:accent5><a:srgbClr val="C0392B"/></a:accent5><a:accent6><a:srgbClr val="5F6570"/></a:accent6><a:hlink><a:srgbClr val="7C5CFF"/></a:hlink><a:folHlink><a:srgbClr val="4A2FD0"/></a:folHlink></a:clrScheme><a:fontScheme name="D"><a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="D"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;

export function makePptx(title, blocks) {
  const slides = splitSlides(title, blocks);
  const files = [];

  const sldIds = slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join('');
  const presRels = slides
    .map((_, i) => `<Relationship Id="rId${i + 2}" Type="${R}/slide" Target="slides/slide${i + 1}.xml"/>`)
    .join('');

  const overrides = slides
    .map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`)
    .join('');

  files.push({ name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${overrides}</Types>` });

  files.push({ name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/officeDocument" Target="ppt/presentation.xml"/></Relationships>` });

  files.push({ name: 'ppt/presentation.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${sldIds}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>` });

  files.push({ name: 'ppt/_rels/presentation.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/slideMaster" Target="slideMasters/slideMaster1.xml"/>${presRels}<Relationship Id="rId${slides.length + 2}" Type="${R}/theme" Target="theme/theme1.xml"/></Relationships>` });

  files.push({ name: 'ppt/slideMasters/slideMaster1.xml', data: SLIDE_MASTER });
  files.push({ name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="${R}/theme" Target="../theme/theme1.xml"/></Relationships>` });

  files.push({ name: 'ppt/slideLayouts/slideLayout1.xml', data: SLIDE_LAYOUT });
  files.push({ name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>` });

  files.push({ name: 'ppt/theme/theme1.xml', data: THEME });

  slides.forEach((s, i) => {
    files.push({ name: `ppt/slides/slide${i + 1}.xml`, data: slideXml(s) });
    files.push({ name: `ppt/slides/_rels/slide${i + 1}.xml.rels`, data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>` });
  });

  return zipStore(files);
}
