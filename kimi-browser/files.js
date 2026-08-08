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

const CHUNK_SIZE = 800; // karakter kada tipak
const CHUNK_OVERLAP = 120; // para hindi maputol ang pangungusap sa gitna
const MAX_HITS = 5; // tipak na ibinabalik ng search
const MAX_INSTRUCTIONS = 2000; // hangganan ng project instructions sa system prompt
const MAX_FILE_CHARS = 400000; // ~65,000 salita kada file

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
    return ext === 'html' || ext === 'htm' ? stripTags(t) : t;
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
    for (const f of p.files) await chrome.storage.local.remove(CHUNK_PREFIX + f.id).catch(() => {});
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
    await set({ [CHUNK_PREFIX + id]: chunks });
    p.files.push({ id, name: String(name).slice(0, 120), size: body.length, chunks: chunks.length, addedAt: Date.now() });
    await set({ [PKEY]: ps });
    return { ok: true, id, mga_tipak: chunks.length, laki: body.length };
  });
}

// Alin ang MASTER PROMPT? Kapag may nakamarka, tahasang tinuturo ito sa system prompt
// bilang pinagmumulan ng istruktura at disenyo — hindi na kailangang hulaan ng agent
// kung alin sa limang dokumento ang susundin.
export function setFileRole(projectId, fileId, role) {
  return enqueue(async () => {
    const ps = await get(PKEY, {});
    const p = ps[projectId];
    if (!p) return { error: 'Walang ganitong project.' };
    for (const f of p.files) {
      if (f.id === fileId) f.role = role || '';
      else if (role === 'prompt' && f.role === 'prompt') f.role = ''; // isa lang ang master
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
    await chrome.storage.local.remove(CHUNK_PREFIX + fileId).catch(() => {});
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

// --- Ang bahagi ng system prompt: instructions + listahan LANG ng file ---
// Hindi ang laman. Ang laman ay dumadaan sa search_files kapag kailangan.
export async function projectPrompt(sessionId) {
  const p = await projectForSession(sessionId);
  if (!p) return '';
  let out = `\n\nPROJECT: ${p.name}`;
  if (p.instructions) out += `\n\nTAGUBILIN NG PROJECT (sundin ito sa buong gawain):\n${p.instructions}`;
  if (p.files.length) {
    out +=
      `\n\nMGA DOKUMENTO SA PROJECT (${p.files.length}) — ang LAMAN ay hindi nakalagay dito para hindi lumaki ang konteksto. ` +
      `Gamitin ang search_files para hanapin ang kailangan mo:\n` +
      p.files.map((f) => `- ${f.name}${f.role === 'prompt' ? '  ← MASTER PROMPT' : ''}`).join('\n');

    const master = p.files.find((f) => f.role === 'prompt');
    if (master) {
      out +=
        `\n\nANG MASTER PROMPT NG PROJECT NA ITO AY "${master.name}". Ito ang batayan ng ISTRUKTURA ` +
        `at ng DISENYO. BAGO ka magsulat, mag-search_files dito nang ilang beses para makuha ang: ` +
        `(a) ang pagkakasunod ng mga seksyon, (b) ang eksaktong pangalan ng CSS class at ang palette, ` +
        `at (c) ang mga tuntunin sa nilalaman. Sundin ito NANG BUO — huwag mag-imbento ng sariling ` +
        `disenyo, sariling kulay, o sariling pangalan ng klase. Kung may halimbawang artikulo sa mga ` +
        `dokumento, kopyahin ang eksaktong istruktura at klase nito.`;
    }
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

export const _fileInternals = { CHUNK_SIZE, MAX_HITS, MAX_INSTRUCTIONS, MAX_FILE_CHARS, CHUNK_PREFIX };
