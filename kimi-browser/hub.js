// --- KNOWLEDGE HUB: persistent learning na hindi nagpapalaki ng context ---
// Ang lumang memory.js ay nagbubuhos ng LAHAT ng tala sa system prompt (worst case
// ~24,000 chars kada step). Dito, structured records na may kind/domain/hits, at ang
// injection ay TOP-K lang na may hard budget — natututo pero hindi lumalaki.
//
// Tatlong pinakamahalagang aral (auditor IWASTO, audit critique, blocked loop) ay
// hina-harvest nang WALANG dagdag na model call — kinompute na sila, itinatago lang.

const KEY = 'hub';
const MAX_PER_DOMAIN = 25;
// Nagko-consolidate BAGO umabot sa cap. Kung hihintayin pa nating mapuno, magsisimula
// nang mag-evict ang caps at may mga aral na basta itatapon — samantalang ang
// consolidation ay pinagsasama sila imbes na burahin.
const CONSOLIDATE_AT = 20;
const MAX_TOTAL = 300;
const MAX_TEXT = 200;
const INJECT_BUDGET = 1500; // chars — ang hard ceiling ng palaging-kasama na block
const INJECT_MAX = 10; // records
const DEDUP_SIM = 0.8; // Jaccard — pareho na ang aral
const WORKFLOW_SIM = 0.7; // mas maluwag para sa workflow (mas mahaba, mas magkakaiba)

// --- Write queue: serialize lahat ng write para walang race sa sabayang harvest ---
let queue = Promise.resolve();
const enqueue = (op) => {
  queue = queue.then(op, op);
  return queue;
};

let counter = 0;
function newId() {
  // Walang Math.random reliance para sa uniqueness — counter + time ang gumagarantiya.
  return 'h_' + (Date.now().toString(36) + (counter++).toString(36)).slice(-10);
}

// --- Similarity: normalize → token set → Jaccard. Walang embeddings, walang API. ---
export function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export function tokens(s) {
  return new Set(normalize(s).split(' ').filter((w) => w.length > 2));
}
export function similarity(a, b) {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter); // Jaccard
}

async function rawLoad() {
  try {
    const d = await chrome.storage.local.get(KEY);
    return d?.[KEY] || null;
  } catch {
    return null;
  }
}

// Lahat ng write ay dumadaan dito. Ang memory ay hindi dapat magpabagsak ng agent:
// kapag puno ang storage o wala ang API, tahimik lang itong lumalampas.
async function save(hub) {
  try {
    await chrome.storage.local.set({ [KEY]: hub });
  } catch {}
}

// --- Migration: ang lumang `memory` key ay pinapasok bilang records, isang beses. ---
async function migrate() {
  const d = await chrome.storage.local.get('memory');
  const mem = d.memory;
  const hub = { v: 1, migratedFrom: 'memory', lastConsolidated: {}, records: [] };
  const now = nowTs();
  if (mem) {
    for (const t of mem.user || []) {
      hub.records.push(mk(t, '', 'pref', 'legacy', now));
    }
    for (const [domain, list] of Object.entries(mem.sites || {})) {
      for (const t of list || []) hub.records.push(mk(t, domain, 'note', 'legacy', now));
    }
  }
  // HUWAG burahin ang lumang `memory` key — safe rollback.
  await save(hub);
  return hub;
}

// Ang Date.now() ay ginagawang injectable para testable — ang test ay nagse-set ng
// globalThis.__hubNow. Sa produksyon, tunay na oras.
function nowTs() {
  return typeof globalThis.__hubNow === 'number' ? globalThis.__hubNow : Date.now();
}

function mk(text, domain, kind, source, ts) {
  return {
    id: newId(),
    text: String(text).trim().slice(0, MAX_TEXT),
    domain: domain || '',
    kind: kind || 'note',
    source: source || 'user',
    hits: 1,
    created: ts,
    lastUsed: ts,
    pinned: false,
  };
}

// MGA ARAL NA GALING SA SARILING DEPEKTO. Bago ang v0.25, sumusuko ang ensureScope
// kapag chrome:// ang bukas na tab, at ang sabi ay "Walang scope group pa." Naniwala
// ang agent na iyon ay katotohanan tungkol sa mundo at itinala ito nang permanente:
//   "Ang live browser ay nangangailangan ng scope group setup"
//   "hamuq.com/sitemap.xml ay hindi ma-access (walang scope group)"
// Hindi sapat ang ayusin ang bug. Habang nandiyan ang mga talang ito, ipinapasok sila
// sa bawat system prompt at sinasabihan siyang huwag nang subukan — kaya patuloy pa
// ring mali ang gawi niya kahit gumagana na ang mekanismo. Ang maling aral ay mas
// mapanganib kaysa sa walang aral: mukha itong karanasan.
const MALING_ARAL = /scope group|walang scope|hindi ma-access ang live|hindi pa na-access.*live/i;

export async function hubLoad() {
  const hub = (await rawLoad()) || (await migrate());
  if (hub.cleaned !== 1) {
    hub.records = (hub.records || []).filter((r) => !MALING_ARAL.test(r.text || ''));
    hub.cleaned = 1;
    await save(hub);
  }
  return hub;
}

function recencyPoints(lastUsed, now) {
  const days = (now - lastUsed) / 86400000;
  if (days <= 7) return 10;
  if (days <= 30) return 5;
  return 0;
}

function evictScore(r, now) {
  return r.hits * 3 + recencyPoints(r.lastUsed, now);
}

// Panatilihin ang caps: per-domain at global. Ang pinned ay hindi kailanman ine-evict.
function enforceCaps(hub, now) {
  const byDomain = {};
  for (const r of hub.records) (byDomain[r.domain] ||= []).push(r);
  const toDrop = new Set();
  for (const list of Object.values(byDomain)) {
    const unpinned = list.filter((r) => !r.pinned);
    if (unpinned.length <= MAX_PER_DOMAIN) continue;
    unpinned.sort((a, b) => evictScore(a, now) - evictScore(b, now));
    for (const r of unpinned.slice(0, unpinned.length - MAX_PER_DOMAIN)) toDrop.add(r.id);
  }
  let kept = hub.records.filter((r) => !toDrop.has(r.id));
  if (kept.length > MAX_TOTAL) {
    const unpinned = kept.filter((r) => !r.pinned).sort((a, b) => evictScore(a, now) - evictScore(b, now));
    const extra = new Set(unpinned.slice(0, kept.length - MAX_TOTAL).map((r) => r.id));
    kept = kept.filter((r) => !extra.has(r.id));
  }
  hub.records = kept;
}

// --- hubAdd: dedup-aware. Kapag pareho na (≥0.8), bump hits, huwag magdagdag. ---
export function hubAdd({ text, domain = '', kind = 'note', source = 'user', pinned = false }) {
  return enqueue(async () => {
    const clean = String(text || '').trim().slice(0, MAX_TEXT);
    if (clean.length < 4) return { error: 'Walang laman.' };
    const hub = await hubLoad();
    const now = nowTs();
    // Dedup laban sa parehong domain (o global kung domain==='').
    const same = hub.records.filter((r) => r.domain === (domain || ''));
    for (const r of same) {
      if (r.text.toLowerCase() === clean.toLowerCase() || similarity(r.text, clean) >= DEDUP_SIM) {
        r.hits++;
        r.lastUsed = now;
        if (pinned) r.pinned = true;
        await save(hub);
        return { ok: true, note: 'Naitala na dati (pinalakas).', id: r.id };
      }
    }
    const rec = mk(clean, domain, kind, source, now);
    rec.pinned = pinned;
    hub.records.push(rec);
    enforceCaps(hub, now);
    await save(hub);
    return { ok: true, id: rec.id };
  });
}

// --- Injection: TOP-K na may hard char budget. Ito ang "hindi lumalaki ang context". ---
function scoreFor(r, domain, taskTokens, now) {
  let s = 0;
  if (r.pinned) s += 1000;
  if (r.domain && r.domain === domain) s += 100;
  s += { fix: 30, gotcha: 25, pref: 20, note: 10 }[r.kind] || 10;
  if (taskTokens.size) {
    const rt = tokens(r.text);
    let overlap = 0;
    for (const t of rt) if (taskTokens.has(t)) overlap++;
    s += Math.min(overlap * 2, 20);
  }
  s += Math.min(r.hits, 10);
  s += recencyPoints(r.lastUsed, now);
  return s;
}

export async function hubPromptFor(domain, taskText) {
  const hub = await hubLoad();
  const now = nowTs();
  const taskTokens = tokens(taskText || '');
  // Kandidato: kasalukuyang domain, global (''), at lahat ng pinned.
  const cands = hub.records.filter((r) => r.pinned || r.domain === domain || r.domain === '');
  cands.sort((a, b) => scoreFor(b, domain, taskTokens, now) - scoreFor(a, domain, taskTokens, now));

  const chosen = [];
  let used = 0;
  for (const r of cands) {
    if (chosen.length >= INJECT_MAX) break;
    const line = `- [${r.kind}] ${r.domain || 'ikaw'}: ${r.text}`;
    if (used + line.length > INJECT_BUDGET) continue; // subukan ang susunod na mas maikli
    chosen.push(r);
    used += line.length + 1;
  }
  if (!chosen.length) return '';

  // Bump hits/lastUsed ng na-inject — fire-and-forget (hindi hinihintay).
  const ids = new Set(chosen.map((r) => r.id));
  enqueue(async () => {
    const h = await hubLoad();
    for (const r of h.records) if (ids.has(r.id)) { r.hits++; r.lastUsed = now; }
    await save(h);
  });

  let out = '\n\nANG NATUTUNAN MO NA (pinaka-may-kaugnayan sa gawaing ito):\n';
  out += chosen.map((r) => `- [${r.kind}] ${r.domain || 'ikaw'}: ${r.text}`).join('\n');
  out +=
    '\n\nMay recall tool ka para hanapin ang iba pang naitala. Kung mali ang isang tala, ' +
    'sabihin sa user — huwag itong basta sundin.';
  return out;
}

// --- recall: hinahanap ng agent ang mga aral anuman ang domain ---
export async function recall(query) {
  const hub = await hubLoad();
  const now = nowTs();
  const qt = tokens(query || '');
  const scored = hub.records
    .map((r) => {
      const rt = tokens(r.text);
      let overlap = 0;
      for (const t of rt) if (qt.has(t)) overlap++;
      return { r, score: overlap + (r.domain ? 0 : 0.1) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  if (!scored.length) return { bilang: 0, mga_item: [], tala: 'Walang naitalang aral na tumugma.' };
  const ids = new Set(scored.map((x) => x.r.id));
  enqueue(async () => {
    const h = await hubLoad();
    for (const r of h.records) if (ids.has(r.id)) { r.hits++; r.lastUsed = now; }
    await save(h);
  });
  return {
    bilang: scored.length,
    mga_item: scored.map((x) => ({ id: x.r.id, domain: x.r.domain || 'ikaw', kind: x.r.kind, tala: x.r.text })),
  };
}

// --- UI helpers: id-based (gamot sa stale-index bug ng lumang forget) ---
export async function hubList() {
  return (await hubLoad()).records;
}
export function hubForget(id) {
  return enqueue(async () => {
    const hub = await hubLoad();
    hub.records = hub.records.filter((r) => r.id !== id);
    await save(hub);
    return { ok: true };
  });
}
export function hubEdit(id, text) {
  return enqueue(async () => {
    const hub = await hubLoad();
    const r = hub.records.find((x) => x.id === id);
    if (r) r.text = String(text).trim().slice(0, MAX_TEXT);
    await save(hub);
    return { ok: !!r };
  });
}
export function hubPin(id, pinned) {
  return enqueue(async () => {
    const hub = await hubLoad();
    const r = hub.records.find((x) => x.id === id);
    if (r) r.pinned = !!pinned;
    await save(hub);
    return { ok: !!r };
  });
}

// --- Consolidation: kailangan bang tumakbo para sa domain na ito? ---
export async function needsConsolidation(domain) {
  const hub = await hubLoad();
  const now = nowTs();
  const domainCount = hub.records.filter((r) => r.domain === domain).length;
  const last = hub.lastConsolidated?.[domain] || 0;
  if (now - last < 86400000) return false; // 24h throttle
  return domainCount >= CONSOLIDATE_AT || hub.records.length > 250;
}

// Ibinabalik ang mga teksto na ico-consolidate (para bigyan ng LLM sa background),
// at ang bilang. Hindi ito tumatawag ng model — ang caller ang gumagawa niyon.
export async function consolidationInput(domain) {
  const hub = await hubLoad();
  const items = hub.records.filter((r) => r.domain === domain && !r.pinned);
  return { texts: items.map((r) => r.text), count: items.length, target: Math.ceil(items.length / 2) };
}

// Pinapalitan ang mga hindi-pinned na record ng isang domain ng merged na listahan.
// Failure-safe: kung walang laman ang merged, walang binabago.
export function applyConsolidation(domain, mergedTexts) {
  return enqueue(async () => {
    const hub = await hubLoad();
    const now = nowTs();
    const clean = (mergedTexts || []).map((t) => String(t).trim().slice(0, MAX_TEXT)).filter((t) => t.length >= 4);
    if (!clean.length) {
      // Walang valid na merged — huwag galawin ang data, i-throttle na lang.
      hub.lastConsolidated = { ...(hub.lastConsolidated || {}), [domain]: now };
      await save(hub);
      return { ok: false, note: 'Walang binago — walang valid na merged.' };
    }
    const pinned = hub.records.filter((r) => r.domain === domain && r.pinned);
    const others = hub.records.filter((r) => r.domain !== domain);
    const merged = clean.map((t) => mk(t, domain, 'note', 'merge', now));
    hub.records = [...others, ...pinned, ...merged];
    hub.lastConsolidated = { ...(hub.lastConsolidated || {}), [domain]: now };
    enforceCaps(hub, now);
    await save(hub);
    return { ok: true, into: merged.length };
  });
}

export const _internals = { MAX_PER_DOMAIN, MAX_TOTAL, INJECT_BUDGET, DEDUP_SIM, WORKFLOW_SIM, CONSOLIDATE_AT };
