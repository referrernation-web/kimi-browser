// --- PROJECTS + FILES: ang KAALAMANG BINIBIGAY MO, hindi ang natutunan niya ---
// Ang hub.js ay para sa natutunan ng agent mula sa sarili niyang karanasan. Dito
// naman ang mga dokumentong IKAW ang nagbibigay: SOP, brand guidelines, na-verify
// na facts ng kliyente. Isang project kada kliyente o kada uri ng trabaho.
//
// ANG PARIS NA PRINSIPYO NG HUB: hindi ibinubuhos ang buong file sa usapan. Hinahati
// ito sa mga tipak, at ang `search_files` lang ang nagpapasok ng mga tumutugma —
// mga 2,500 karakter, hindi ang buong sampung-pahinang brief.

const PKEY = 'projects';
const SKEY = 'sessionProject'; // { [sessionId]: projectId }
const CHUNK_PREFIX = 'fchunks_';
// Ang ORIHINAL na teksto, buo. Kailangan ito ng 📌 at 🎨 na ipinapasok nang verbatim.
// Mukhang aksaya, pero ang mga tipak ay may 120/800 na overlap — 15% silang MAS
// MALAKI kaysa sa orihinal. Ang pag-iimbak nito ay halos libre, at ang kapalit ay
// eksaktong teksto sa halip na hulang muling pagbuo.
const RAW_PREFIX = 'fraw_';

const CHUNK_SIZE = 800; // karakter kada tipak
const CHUNK_OVERLAP = 120; // para hindi maputol ang pangungusap sa gitna
const MAX_HITS = 5; // tipak na ibinabalik ng search
const MAX_INSTRUCTIONS = 2000; // hangganan ng project instructions sa system prompt
const MAX_FILE_CHARS = 400000; // ~65,000 salita kada file
const MAX_TEMPLATE = 30000; // ang CSS + script + balangkas ng isang naipadalang artikulo
const MAX_PROJECT_INJECT = 120000; // ~33k token; kasya sa 256k na konteksto

// Mga role na may espesyal na kahulugan. Isa lang ang bawat isa kada project.
const ROLE_TAG = { prompt: '  ← 📌 MASTER PROMPT', template: '  ← 🎨 TEMPLATE NG DISENYO' };

let queue = Promise.resolve();
const enqueue = (op) => {
  queue = queue.then(op, op);
  return queue;
};

const newId = (p) => p + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);

async function get(key, fallback) {
  try {
    const d = await chrome.storage.local.get(key);
    return d?.[key] ?? fallback;
  } catch {
    return fallback;
  }
}
async function set(obj) {
  try {
    await chrome.storage.local.set(obj);
    return true;
  } catch {
    return false;
  }
}

// ============ ZIP READER (para sa .docx at .pptx na ina-upload) ============
// Ang zipStore natin sa docx.js ay store-only, pero ang TOTOONG .docx mula sa Word
// ay deflate-compressed. Ang DecompressionStream ng Chrome ang humahawak nito —
// native, walang library.

async function inflateRaw(bytes) {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function unzip(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Hindi ito valid na zip file.');

  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = {};
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const usize = dv.getUint32(p + 24, true);
    const nlen = dv.getUint16(p + 28, true);
    const elen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.slice(p + 46, p + 46 + nlen));

    const lnlen = dv.getUint16(lho + 26, true);
    const lelen = dv.getUint16(lho + 28, true);
    const start = lho + 30 + lnlen + lelen;
    const raw = bytes.slice(start, start + csize);
    try {
      out[name] = method === 0 ? raw : await inflateRaw(raw);
      if (usize && out[name].length !== usize) {
        // Hindi tugma ang laki — huwag magtiwala sa laman.
        delete out[name];
      }
    } catch {}
    p += 46 + nlen + elen + clen;
  }
  return out;
}

// ============ TEXT EXTRACTION ============

const stripTags = (xml) =>
  String(xml)
    // Ang talata at line break sa OOXML ay nagiging bagong linya.
    .replace(/<\/w:p>|<w:br\s*\/>|<\/a:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

// Ibinabalik ang plain text mula sa file. Ang PDF ay hindi pa suportado — sinasabi
// nito nang malinaw imbes na magbalik ng basura.
export async function extractText(name, buf) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (['txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'html', 'htm', 'xml', 'log'].includes(ext)) {
    const t = new TextDecoder().decode(buf instanceof Uint8Array ? buf : new Uint8Array(buf));
    if (ext !== 'html' && ext !== 'htm') return t;
    // Ang isang BUONG pahina (may doctype o <style>) ay ina-upload para sa MARKUP nito —
    // iyon ang buong punto ng 🎨 template: ang eksaktong CSS at ang eksaktong klase.
    // Kung tatanggalin ang tags, mawawala mismo ang bagay na kailangan. Ang piraso lang
    // ng HTML ay teksto ang halaga, kaya iyon ang nililinis pa rin.
    return /<!doctype|<style[\s>]/i.test(t) ? t : stripTags(t);
  }
  if (ext === 'docx') {
    const z = await unzip(buf);
    const doc = z['word/document.xml'];
    if (!doc) throw new Error('Walang laman ang .docx na ito.');
    return stripTags(new TextDecoder().decode(doc));
  }
  if (ext === 'pptx') {
    const z = await unzip(buf);
    const slides = Object.keys(z).filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k)).sort();
    if (!slides.length) throw new Error('Walang slide sa .pptx na ito.');
    return slides.map((s, i) => `## Slide ${i + 1}\n` + stripTags(new TextDecoder().decode(z[s]))).join('\n\n');
  }
  if (ext === 'pdf') throw new Error('Hindi pa suportado ang PDF. I-save mo muna bilang .docx o .txt.');
  throw new Error(`Hindi suportado ang .${ext}. Subukan ang .txt, .md, .csv, .docx, o .pptx.`);
}

// ============ URL IMPORT: ang "prompt scanner" ============
// Ang master prompt ay madalas nasa Google Docs o sa isang naka-host na .md. Imbes na
// i-download pa ito at i-upload, i-paste mo lang ang link. Ang Google Docs ay may
// export endpoint na nagbabalik ng plain text kapag naka-share ang link.

export function toFetchUrl(url) {
  const u = String(url || '').trim();
  // Google Docs → text export
  let m = /docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/.exec(u);
  if (m) return { url: `https://docs.google.com/document/d/${m[1]}/export?format=txt`, uri: 'gdoc' };
  // Google Sheets → CSV export
  m = /docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/.exec(u);
  if (m) return { url: `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv`, uri: 'gsheet' };
  // GitHub blob → raw
  m = /github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/.exec(u);
  if (m) return { url: `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`, uri: 'raw' };
  return { url: u, uri: 'raw' };
}

// Ang pangalan na ipapakita — hinuhugot sa URL, o sa unang heading ng laman.
function nameFromUrl(url, text) {
  const h = /^#\s+(.+)$/m.exec(text || '');
  if (h) return h[1].trim().slice(0, 80);
  try {
    const p = new URL(url).pathname.split('/').filter(Boolean).pop();
    if (p && p !== 'export') return decodeURIComponent(p).slice(0, 80);
  } catch {}
  return 'Naka-import mula sa link';
}

export async function importUrl(projectId, url) {
  const { url: fetchUrl, uri } = toFetchUrl(url);
  if (!/^https?:\/\//i.test(fetchUrl)) return { error: 'Kailangan ng buong link na nagsisimula sa https://' };

  let res;
  try {
    res = await fetch(fetchUrl, { credentials: 'omit' });
  } catch {
    return { error: 'Hindi maabot ang link. Tingnan ang internet mo o ang pagkakasulat ng URL.' };
  }
  if (!res.ok) {
    if (uri === 'gdoc' || uri === 'gsheet') {
      return {
        error:
          `Hindi mabuksan (HTTP ${res.status}). Karaniwang ibig sabihin nito ay PRIVATE ang dokumento. ` +
          'Sa Google Docs: Share → General access → "Anyone with the link" → Viewer. ' +
          'O kaya i-download bilang .md o .txt at i-upload dito.',
      };
    }
    return { error: `Hindi mabuksan ang link (HTTP ${res.status}).` };
  }

  const raw = await res.text();
  // Ang naka-share na Google Doc na private ay nagbabalik ng HTML sign-in page, hindi teksto.
  if (/<html/i.test(raw.slice(0, 400)) && (uri === 'gdoc' || uri === 'gsheet')) {
    return {
      error:
        'Sign-in page ang naibalik, kaya PRIVATE pa ang dokumento. Sa Google Docs: Share → ' +
        '"Anyone with the link" → Viewer, tapos subukan ulit.',
    };
  }
  const text = /<html/i.test(raw.slice(0, 400)) ? stripTags(raw) : raw;
  if (!text.trim()) return { error: 'Walang mabasang teksto sa link na ito.' };

  return addFile(projectId, nameFromUrl(url, text), text);
}

// ============ CHUNKING + SEARCH ============

export function chunkText(text) {
  const clean = String(text || '').replace(/\r\n?/g, '\n').trim();
  if (!clean) return [];
  const chunks = [];
  let i = 0;
  while (i < clean.length) {
    let end = Math.min(i + CHUNK_SIZE, clean.length);
    if (end < clean.length) {
      // Humanap ng malinis na hati (talata o pangungusap) malapit sa dulo.
      const window = clean.slice(i, end);
      const brk = Math.max(window.lastIndexOf('\n\n'), window.lastIndexOf('. '), window.lastIndexOf('\n'));
      if (brk > CHUNK_SIZE * 0.5) end = i + brk + 1;
    }
    chunks.push(clean.slice(i, end).trim());
    if (end >= clean.length) break;
    i = Math.max(end - CHUNK_OVERLAP, i + 1);
  }
  return chunks.filter((c) => c.length > 20);
}

// PANSAMANTALANG PANUKLI para sa mga file na na-upload BAGO ang v0.23. Noon, ang
// mga tipak lang ang naiimbak, kaya kailangang baligtarin ang chunkText.
//
// HINDI ITO EKSAKTO, at may matibay na dahilan: ang chunkText ay may 120-karakter
// na overlap, pero sa PAULIT-ULIT na teksto — CSS rule, talahanayan, listahan ng
// presyo — maraming posisyon ang tumutugma nang pantay. Ang piliin ang pinakamahaba
// ay lumalaktaw ng laman; ang piliin ang pinakamaikli ay nagdodoble. Hindi ito
// depekto ng algoritmo: talagang hindi mababawi ang paulit-ulit na teksto mula sa
// magkakapatong na tipak. Kaya itinatabi na natin ang orihinal (fraw_) — ito ay
// pambalik-tanaw lang, at ang layunin ay malapit, hindi tumpak.
export function joinChunks(chunks) {
  let out = '';
  for (const c of chunks || []) {
    if (!out) { out = c; continue; }
    // Ang totoong overlap ay CHUNK_OVERLAP, bawas ang inalis ng .trim(). Hinahanap
    // ang pinakamalapit doon, hindi ang pinakamahabang tugma.
    let best = 0;
    for (let k = Math.min(c.length, CHUNK_OVERLAP + 20); k >= 40; k--) {
      if (out.endsWith(c.slice(0, k))) { best = k; break; }
    }
    out += best ? c.slice(best) : '\n' + c;
  }
  return out;
}

// Mula sa isang naipadala nang artikulo, kunin ang bahaging DAPAT KOPYAHIN NANG
// EKSAKTO: ang <style>, ang <script>, at ang unang bahagi ng markup kung saan
// makikita kung paano ginagamit ang mga klase.
//
// Ang JSON-LD ay TINATANGGAL nang sadya — kung kasama iyon, kokopyahin niya ang
// headline, petsa, at schema ng LUMANG artikulo papunta sa bago.
export function designSkeleton(html) {
  const s = String(html || '');
  const css = [...s.matchAll(/<style[\s\S]*?<\/style>/gi)].map((m) => m[0]).join('\n');
  const js = [...s.matchAll(/<script(?![^>]*ld\+json)[\s\S]*?<\/script>/gi)].map((m) => m[0]).join('\n');
  const body = s
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const parts = [];
  if (css) parts.push(css);
  if (js) parts.push(js);
  parts.push('<!-- BALANGKAS NG MARKUP (simula ng artikulo) -->\n' + body);
  return parts.join('\n\n').slice(0, MAX_TEMPLATE);
}

const looksHtml = (s) => /<!doctype|<style[\s>]|<section|<div/i.test(String(s || '').slice(0, 4000));

const tok = (s) =>
  new Set(
    String(s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 2)
  );

// ============ PROJECTS ============

export async function listProjects() {
  return await get(PKEY, {});
}

export function createProject(name) {
  return enqueue(async () => {
    const ps = await get(PKEY, {});
    const id = newId('p_');
    ps[id] = { id, name: String(name || 'Bagong project').slice(0, 80), instructions: '', files: [], createdAt: Date.now() };
    await set({ [PKEY]: ps });
    return ps[id];
  });
}

export function setInstructions(projectId, text) {
  return enqueue(async () => {
    const ps = await get(PKEY, {});
    if (!ps[projectId]) return { error: 'Walang ganitong project.' };
    ps[projectId].instructions = String(text || '').slice(0, MAX_INSTRUCTIONS);
    await set({ [PKEY]: ps });
    return { ok: true };
  });
}

export function renameProject(projectId, name) {
  return enqueue(async () => {
    const ps = await get(PKEY, {});
    if (ps[projectId]) ps[projectId].name = String(name).slice(0, 80);
    await set({ [PKEY]: ps });
    return { ok: true };
  });
}

export function deleteProject(projectId) {
  return enqueue(async () => {
    const ps = await get(PKEY, {});
    const p = ps[projectId];
    if (!p) return { ok: true };
    for (const f of p.files) {
      await chrome.storage.local.remove([CHUNK_PREFIX + f.id, RAW_PREFIX + f.id]).catch(() => {});
    }
    delete ps[projectId];
    await set({ [PKEY]: ps });
    return { ok: true };
  });
}

// Ang tipak ay nasa SARILING key kada file — kaya hindi kailangang basahin ang lahat
// ng dokumento para lang makuha ang isa.
export function addFile(projectId, name, text) {
  return enqueue(async () => {
    const ps = await get(PKEY, {});
    const p = ps[projectId];
    if (!p) return { error: 'Walang ganitong project.' };
    const body = String(text || '').slice(0, MAX_FILE_CHARS);
    const chunks = chunkText(body);
    if (!chunks.length) return { error: 'Walang mabasang teksto sa file na ito.' };

    const id = newId('f_');
    await set({ [CHUNK_PREFIX + id]: chunks, [RAW_PREFIX + id]: body });
    p.files.push({ id, name: String(name).slice(0, 120), size: body.length, chunks: chunks.length, addedAt: Date.now() });
    await set({ [PKEY]: ps });
    return { ok: true, id, mga_tipak: chunks.length, laki: body.length };
  });
}

// Dalawang espesyal na role:
//   'prompt'   (📌) — ang MASTER PROMPT: ang mga panuntunan, istruktura, at tono.
//   'template' (🎨) — ang TEMPLATE NG DISENYO: isang naipadala nang artikulo na
//                     kukunan ng TOTOONG CSS at klase, hindi ng paglalarawan nito.
// Sa Write mode, ang laman ng dalawang ito ay ipinapasok nang BUO at VERBATIM sa
// system prompt. Isa lang ang bawat uri kada project.
export function setFileRole(projectId, fileId, role) {
  return enqueue(async () => {
    const ps = await get(PKEY, {});
    const p = ps[projectId];
    if (!p) return { error: 'Walang ganitong project.' };
    for (const f of p.files) {
      if (f.id === fileId) f.role = role || '';
      else if (role && f.role === role) f.role = ''; // isa lang kada uri
    }
    await set({ [PKEY]: ps });
    return { ok: true };
  });
}

export function deleteFile(projectId, fileId) {
  return enqueue(async () => {
    const ps = await get(PKEY, {});
    const p = ps[projectId];
    if (p) {
      p.files = p.files.filter((f) => f.id !== fileId);
      await set({ [PKEY]: ps });
    }
    await chrome.storage.local.remove([CHUNK_PREFIX + fileId, RAW_PREFIX + fileId]).catch(() => {});
    return { ok: true };
  });
}

// Ang kasalukuyang session — itinatakda ng background sa simula ng run, katulad ng
// setDocSession. Ito ang nagsasabi kung aling project ang naka-attach.
let current = 'default';
export function setFileSession(id) {
  if (id) current = String(id);
}
export function getFileSession() {
  return current;
}

// --- Session ↔ project ---
export async function attachSession(sessionId, projectId) {
  const map = await get(SKEY, {});
  if (projectId) map[sessionId] = projectId;
  else delete map[sessionId];
  await set({ [SKEY]: map });
  return { ok: true };
}
export async function projectForSession(sessionId) {
  const map = await get(SKEY, {});
  const id = map[sessionId];
  if (!id) return null;
  const ps = await get(PKEY, {});
  return ps[id] || null;
}

// --- Ang bahagi ng system prompt ---
//
// SA WRITE MODE: ipinapasok nang BUO at VERBATIM ang 📌 master prompt at ang 🎨
// template. Ito ang pagwawasto sa pinakamalaking depekto ng sistema. Dati, ang
// laman ay dumadaan lang sa search_files: 5 tipak × 800 karakter = ~4,000 karakter
// kada tawag, mula sa isang 73,000-karakter na dokumento. Mga 11% ang nakikita
// niya — habang sinasabi ng prompt na "SUNDIN ITO NANG BUO". Mas malala pa: ang
// ranking (overlap / sqrt(size)) ay kumikiling sa MAIIKLING tipak, kabaligtaran
// mismo ng mahahabang CSS at HTML na kailangan. Hindi ito naaayos ng pagtutuno;
// mali ang premise ng retrieval para sa ganitong dokumento. Sa isang design
// system, LAHAT ng linya ay kailangan ng LAHAT ng seksyon.
//
// SA IBANG MODE: listahan pa rin ng pangalan. Hindi binabayaran ang 33k token
// para lang tingnan ang Gmail.
let injected = new Set(); // mga file id na buo nang nasa system prompt ngayong run
export function injectedFiles() {
  return injected;
}

async function fileBody(f) {
  // Ang orihinal kung meron; ang muling pagbuo lang kung luma ang file (bago v0.23).
  const text = (await get(RAW_PREFIX + f.id, '')) || joinChunks(await get(CHUNK_PREFIX + f.id, []));
  // Ang 🎨 ay isang buong naipadalang artikulo (50k-90k). Ang kailangan lang doon
  // ay ang CSS, ang script, at ang balangkas — hindi ang lumang laman nito.
  return f.role === 'template' && looksHtml(text) ? designSkeleton(text) : text;
}

export async function projectPrompt(sessionId, mode) {
  const p = await projectForSession(sessionId);
  injected = new Set();
  if (!p) return '';
  let out = `\n\nPROJECT: ${p.name}`;
  if (p.instructions) out += `\n\nTAGUBILIN NG PROJECT (sundin ito sa buong gawain):\n${p.instructions}`;
  if (!p.files.length) return out;

  out +=
    `\n\nMGA DOKUMENTO SA PROJECT (${p.files.length}):\n` +
    p.files.map((f) => `- ${f.name}${ROLE_TAG[f.role] || ''}`).join('\n');

  const master = p.files.find((f) => f.role === 'prompt');
  const template = p.files.find((f) => f.role === 'template');

  // Walang nakamarka: SABIHIN ito. Ang tahimik na pag-iimbento ng sariling disenyo
  // ang pinakamasamang uri ng pagbagsak — mukhang tagumpay hanggang sa makita ng
  // kliyente na mali ang kulay.
  if (!master && !template) {
    return (
      out +
      `\n\nWALANG NAKAMARKANG 📌 MASTER PROMPT O 🎨 TEMPLATE NG DISENYO sa project na ito. ` +
      `SABIHIN mo ito sa user BAGO ka magsulat: walang disenyong masusunod, kaya plain na ` +
      `markdown lang ang malilikha mo. HUWAG kang mag-imbento ng sariling palette, sariling ` +
      `pangalan ng CSS class, o sariling istruktura at ipakita iyon na parang sa kliyente galing.` +
      `\n\nGamitin ang search_files para sa iba pang dokumento.`
    );
  }

  if (mode !== 'write') {
    return (
      out +
      `\n\nHindi nakalagay dito ang LAMAN ng mga dokumento. Gamitin ang search_files. ` +
      `(Sa Write mode, awtomatikong ipinapasok nang buo ang 📌 at 🎨.)`
    );
  }

  let gastos = 0;
  const dagdag = (f, teksto, ulo) => {
    if (!teksto) return;
    const natitira = MAX_PROJECT_INJECT - gastos;
    if (natitira < 2000) {
      out += `\n\n[HINDI KASYA ang "${f.name}". Gamitin ang search_files dito.]`;
      return;
    }
    let laman = teksto;
    if (teksto.length > natitira) {
      // Middle-out, hindi tail-cut: ang simula (mga panuntunan) at ang dulo
      // (checklist) ang pinaka-load-bearing sa ganitong dokumento.
      const u = Math.floor(natitira * 0.6);
      laman =
        teksto.slice(0, u) +
        `\n\n[…PINUTOL ANG GITNA, ${teksto.length - natitira} karakter. Mag-search_files sa ` +
        `"${f.name}" kung may kailangan ka sa bahaging iyon…]\n\n` +
        teksto.slice(-(natitira - u));
    } else {
      injected.add(f.id); // buo na ito — huwag nang hanapin, doble lang
    }
    gastos += laman.length;
    out += `\n\n${ulo}\n${laman}\n===== KATAPUSAN: ${f.name} =====`;
  };

  // ANG TEMPLATE ANG UNA. Ito ang byte-exact na bagay: ang master prompt ay
  // maaaring i-paraphrase, ang CSS ay hindi.
  if (template) {
    dagdag(
      template,
      await fileBody(template),
      `===== 🎨 TEMPLATE NG DISENYO: ${template.name} =====\n` +
        `Ito ang TOTOONG CSS, script, at markup ng isang NAIPADALA nang artikulo — hindi ` +
        `paglalarawan nito. KOPYAHIN ang <style> block na ito nang BUO at NANG WALANG ` +
        `BINABAGO. Huwag magpalit ng kulay, ng pangalan ng klase, ng border-radius, o ng ` +
        `tagal ng animation. Gamitin ang parehong klase sa parehong paraan. Huwag gumawa ` +
        `ng bagong klase kung may umiiral nang katumbas. Kung magkaiba ang sinasabi nito ` +
        `at ng master prompt tungkol sa hitsura, ANG TEMPLATE ANG TAMA — ito ang totoong ` +
        `naipadala; ang master prompt ay paglalarawan lang nito sa salita.`
    );
  }

  if (master) {
    dagdag(
      master,
      await fileBody(master),
      `===== 📌 MASTER PROMPT: ${master.name} =====\n` +
        `Ito ang BUONG laman, hindi buod at hindi tipak. Ito ang batayan ng istruktura, ng ` +
        `tono, at ng lahat ng panuntunan. Sundin ito nang buo, kasama ang mga bilang: kung ` +
        `may minimum na table, abutin mo; kung may bilang ng FAQ, abutin mo; kung may ` +
        `ipinagbabawal na karakter o format, huwag mo itong gamitin kahit isang beses.`
    );
  }

  const iba = p.files.filter((f) => !injected.has(f.id));
  if (iba.length) {
    out += `\n\nAng ibang dokumento (${iba.map((f) => f.name).join(', ')}) ay hinahanap sa search_files.`;
  }
  return out;
}

// --- search_files: top tipak lang, may hard budget ---
export async function searchFiles(sessionId, query, fileName) {
  const p = await projectForSession(sessionId);
  if (!p) return { error: 'Walang naka-attach na project sa usapang ito. Buksan ang 📁 sa ⋯ menu.' };
  if (!p.files.length) return { bilang: 0, mga_tipak: [], tala: 'Walang dokumento sa project na ito.' };

  const q = tok(query);
  const want = fileName ? String(fileName).toLowerCase() : '';
  const hits = [];
  for (const f of p.files) {
    if (want && !f.name.toLowerCase().includes(want)) continue;
    // Ang buo nang naipasok sa system prompt ay hindi na hinahanap: doble lang iyon,
    // at ang 91 tipak ng isang master prompt ay sasakop sa buong top-5 at gugutumin
    // ang mga dokumento ng totoong datos. Kapag tahasang pinangalanan, hahanapin pa
    // rin — iyon ang labasan kapag may pinutol na gitna.
    if (!want && injected.has(f.id)) continue;
    const chunks = await get(CHUNK_PREFIX + f.id, []);
    chunks.forEach((c, i) => {
      const ct = tok(c);
      let overlap = 0;
      for (const t of q) if (ct.has(t)) overlap++;
      if (overlap > 0) hits.push({ score: overlap / Math.sqrt(ct.size || 1), file: f.name, i, text: c });
    });
  }
  if (!hits.length) {
    return {
      bilang: 0, mga_tipak: [],
      tala: 'Walang tumugma. Subukan ang ibang salita, o tingnan ang listahan ng dokumento sa system prompt mo.',
    };
  }
  hits.sort((a, b) => b.score - a.score);
  return {
    bilang: Math.min(hits.length, MAX_HITS),
    mga_tipak: hits.slice(0, MAX_HITS).map((h) => ({ file: h.file, bahagi: h.i + 1, teksto: h.text })),
    tala: 'Mga pinaka-tumutugmang bahagi lang ito. Kung kulang, maghanap ulit gamit ang ibang salita.',
  };
}

export const _fileInternals = {
  CHUNK_SIZE, CHUNK_OVERLAP, MAX_HITS, MAX_INSTRUCTIONS, MAX_FILE_CHARS,
  CHUNK_PREFIX, RAW_PREFIX, MAX_TEMPLATE, MAX_PROJECT_INJECT,
};
