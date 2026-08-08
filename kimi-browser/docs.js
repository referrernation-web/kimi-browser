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

// Ang <style> at <script> ay hindi binibilang bilang salita — sila ay disenyo, hindi
// nilalaman, at palalakihin lang nila ang bilang nang walang katotohanan.
const stripCode = (s) => String(s).replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ');
const countWords = (s) => (stripCode(s).replace(/<[^>]+>/g, ' ').trim().match(/\S+/g) || []).length;

// KILALANIN KUNG HTML: ang design system tulad ng Hamuq ay hindi kayang dalhin ng
// markdown — may sariling klase, inline <style>, at <script> para sa animation. Sa
// hugis natin ito kinikilala, kaya hindi na kailangang magpasa ng flag ang model.
export function isHtml(s) {
  const t = String(s || '').trim();
  if (!t.startsWith('<')) return false;
  return /<(div|section|article|style|script|h[1-6]|table|figure|header|p)\b/i.test(t);
}

// Ang unang heading ng seksyon ang ginagamit bilang pangalan nito sa balangkas.
const headOf = (md) => {
  const s = String(md || '');
  if (isHtml(s)) {
    const h = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i.exec(stripCode(s));
    if (h) return h[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
    return stripCode(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Seksyon';
  }
  const m = /^\s{0,3}#{1,6}\s+(.+)$/m.exec(s);
  return m ? m[1].trim().slice(0, 60) : s.trim().split('\n')[0].slice(0, 60);
};

// Ang mga klaseng TUNAY na may CSS sa dokumento, para hindi na siya mag-imbento ng
// bago habang nasa gitna siya ng pagsulat.
function classInventory(doc) {
  const buo = doc.sections.map((s) => s.md).join('\n');
  const style = [...buo.matchAll(/<style[\s\S]*?<\/style>/gi)].map((m) => m[0]).join('\n');
  const klase = [...new Set([...style.matchAll(/\.([a-z][a-z0-9_-]+)\s*[,{:.]/gi)].map((m) => m[1]))];
  return klase.length
    ? `GAMITIN LANG ANG MGA KLASENG ITO — may CSS na sila. Huwag gumawa ng bago; ` +
        `kung wala kang makitang bagay, gamitin ang pinakamalapit: ${klase.join(' ')}`
    : '';
}

export function docAppend({ title, append, start_new, replace_section }) {
  return enqueue(async () => {
    const all = await loadAll();
    let doc = all[current];
    if (!doc || start_new) doc = { title: title || 'Dokumento', sections: [], words: 0, updatedAt: Date.now() };
    if (title) doc.title = String(title).slice(0, 200);

    const md = String(append || '').trim();
    if (!md) return { error: 'Walang laman ang seksyon.' };

    // HTML O MARKDOWN? Ang design system tulad ng Hamuq ay nangangailangan ng tunay na
    // HTML — may sariling klase, inline <style>, at <script>. Hindi kayang dalhin ng
    // markdown ang mga iyon. Kinikilala natin ang HTML sa hugis nito, kaya hindi na
    // kailangang isipin ng model kung anong flag ang ipapasa.
    if (isHtml(md)) doc.html = true;

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
      may_disenyo: !!doc.html, // ito ang nagpapasya kung aling file ang ibibigay sa kliyente
      // ANG SARILI NIYANG STYLESHEET, IBINABALIK SA KANYA.
      // Isinusulat ang <style> sa unang seksyon, tapos ang mga sumunod ay isinusulat
      // nang HINDI na ito nakikita — hindi ibinabalik ng write_document ang laman,
      // sinadya iyon para hindi lumaki ang konteksto. Ang bunga sa isang totoong
      // artikulo: 12 sa 45 na klase ang ginamit pero walang CSS. Gumawa siya ng
      // .hq-ctacard gayong .hq-cta-card ang tinukoy niya kanina, at .hq-verdict at
      // .hq-sources na wala talaga. Walang estilo ang mga seksyong iyon paglabas.
      // Ang listahan ng pangalan ay ilang daang karakter lang — mura kumpara doon.
      ...(doc.html ? { mga_klase: classInventory(doc) } : {}),
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

// Kapag HTML ang isinulat ng model, IBINABALIK ITO NANG BUO — hindi dinadaan sa
// markdown converter. Doon nawawala ang mga klase, style, at script na siyang buong
// disenyo. Ito ang dahilan kung bakit dati ay hindi lumalabas ang Hamuq design.
export async function docAsHtml(sessionId) {
  const doc = await docGet(sessionId);
  if (!doc) return '';
  if (doc.html) return doc.sections.map((s) => s.md).join('\n');
  return `<h1>${doc.title}</h1>` + blocksToHtml(parseMarkdown(doc.sections.map((s) => s.md).join('\n\n')));
}

// Para sa .docx, .pdf, at .pptx: kailangan ng blocks, hindi HTML. Ang teksto lang ang
// kinukuha — sinasadya iyon, dahil ang Word at PowerPoint ay may sariling estilo.
export async function docAsPlainMarkdown(sessionId) {
  const doc = await docGet(sessionId);
  if (!doc) return '';
  if (!doc.html) return docAsMarkdown(sessionId);
  const body = doc.sections
    .map((s) =>
      stripCode(s.md)
        .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) => `\n\n${'#'.repeat(+n)} ${t.replace(/<[^>]+>/g, '').trim()}\n`)
        .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `\n- ${t.replace(/<[^>]+>/g, '').trim()}`)
        .replace(/<\/(p|div|tr|section)>/gi, '\n\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    )
    .join('\n\n');
  return `# ${doc.title}\n\n${body}`;
}

export async function docClear(sessionId) {
  const all = await loadAll();
  delete all[sessionId || current];
  await saveAll(all);
  return { ok: true };
}

export const _docInternals = { MAX_DOC_CHARS, MAX_DOCS };
