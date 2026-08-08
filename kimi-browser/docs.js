// --- DOCUMENT BUFFER: mahabang artikulo na HINDI dumadaan sa usapan ---
// Kung ang 2,000-salitang artikulo ay isusulat sa chat, mababayaran ito MULI sa bawat
// kasunod na hakbang. Dito, ang bawat seksyon ay napupunta sa storage at ang tool
// result ay bilang lang ("naidagdag, 1,240 salita na") — kaya kahit maliit na model
// ay kayang magsulat ng mahabang dokumento nang hindi lumalobo ang konteksto.

import { parseMarkdown, blocksToHtml } from './docx.js';

const KEY = 'docs';
const MAX_DOC_CHARS = 60000; // ~10,000 salita
const MAX_DOCS = 10;

let queue = Promise.resolve();
const enqueue = (op) => {
  queue = queue.then(op, op);
  return queue;
};

// Ang kasalukuyang session — itinatakda ng background sa simula ng bawat run,
// katulad ng setScope sa tools.js.
let current = 'default';
export function setDocSession(id) {
  if (id) current = String(id);
}
export function getDocSession() {
  return current;
}

async function loadAll() {
  try {
    const d = await chrome.storage.local.get(KEY);
    return d?.[KEY] || {};
  } catch {
    return {};
  }
}
async function saveAll(all) {
  try {
    await chrome.storage.local.set({ [KEY]: all });
  } catch {}
}

const countWords = (s) => (String(s).trim().match(/\S+/g) || []).length;

// Ang unang heading ng seksyon ang ginagamit bilang pangalan nito sa balangkas.
const headOf = (md) => {
  const m = /^\s{0,3}#{1,6}\s+(.+)$/m.exec(md || '');
  return m ? m[1].trim().slice(0, 60) : String(md || '').trim().split('\n')[0].slice(0, 60);
};

export function docAppend({ title, append, start_new, replace_section }) {
  return enqueue(async () => {
    const all = await loadAll();
    let doc = all[current];
    if (!doc || start_new) doc = { title: title || 'Dokumento', sections: [], words: 0, updatedAt: Date.now() };
    if (title) doc.title = String(title).slice(0, 200);

    const md = String(append || '').trim();
    if (!md) return { error: 'Walang laman ang seksyon.' };

    const kasalukuyan = doc.sections.reduce((n, s) => n + s.md.length, 0);
    if (kasalukuyan + md.length > MAX_DOC_CHARS) {
      return {
        error: `Puno na ang dokumento (${MAX_DOC_CHARS} karakter ang hangganan). Tapusin mo na ito, o magsimula ng bago gamit ang start_new.`,
      };
    }

    const sec = { h: headOf(md), md };
    if (Number.isInteger(replace_section) && doc.sections[replace_section]) {
      doc.sections[replace_section] = sec;
    } else {
      doc.sections.push(sec);
    }

    doc.words = doc.sections.reduce((n, s) => n + countWords(s.md), 0);
    doc.updatedAt = Date.now();
    all[current] = doc;

    // LRU: panatilihin lang ang pinakabagong sampung dokumento.
    const ids = Object.keys(all);
    if (ids.length > MAX_DOCS) {
      ids.sort((a, b) => (all[a].updatedAt || 0) - (all[b].updatedAt || 0));
      for (const id of ids.slice(0, ids.length - MAX_DOCS)) delete all[id];
    }
    await saveAll(all);

    return {
      ok: true,
      pamagat: doc.title,
      mga_salita: doc.words,
      mga_seksyon: doc.sections.length,
      balangkas: doc.sections.map((s) => s.h),
      tala: 'Naidagdag sa dokumento (wala ito sa usapan, kaya hindi lumalaki ang konteksto). Isulat ang susunod na seksyon, o sabihin sa user na handa na ito sa preview card.',
    };
  });
}

export async function docGet(sessionId) {
  const all = await loadAll();
  return all[sessionId || current] || null;
}

export async function docAsMarkdown(sessionId) {
  const doc = await docGet(sessionId);
  if (!doc) return '';
  return `# ${doc.title}\n\n` + doc.sections.map((s) => s.md).join('\n\n');
}

export async function docAsHtml(sessionId) {
  const doc = await docGet(sessionId);
  if (!doc) return '';
  return `<h1>${doc.title}</h1>` + blocksToHtml(parseMarkdown(doc.sections.map((s) => s.md).join('\n\n')));
}

export async function docClear(sessionId) {
  const all = await loadAll();
  delete all[sessionId || current];
  await saveAll(all);
  return { ok: true };
}

export const _docInternals = { MAX_DOC_CHARS, MAX_DOCS };
