// Nakaimbak sa chrome.storage.local bilang { user: [...], sites: { "domain": [...] } }.
// Isang linya bawat tala — walang embeddings, walang ranking. Ang alituntunin ay ang
// site memory ay per-domain, kaya ang hinahatid lang sa model ay ang tungkol sa
// kinaroroonan niya ngayon.

const KEY = 'memory';
const MAX_PER_SCOPE = 40; // ang pinakaluma ang unang nabubura

export async function load() {
  const d = await chrome.storage.local.get(KEY);
  return { user: [], sites: {}, ...(d[KEY] || {}) };
}

export async function remember(scope, note, domain) {
  const mem = await load();
  const text = String(note).trim().slice(0, 300);
  if (!text) return { error: 'Walang laman ang tala.' };

  const list = scope === 'site' ? (mem.sites[domain] ||= []) : mem.user;
  // Ang pag-uulit ay ingay: ang parehong aral na natutunan nang dalawang beses ay isa pa rin.
  if (list.some((x) => x.toLowerCase() === text.toLowerCase()))
    return { ok: true, note: 'Naitala na dati.' };

  list.push(text);
  while (list.length > MAX_PER_SCOPE) list.shift();

  await chrome.storage.local.set({ [KEY]: mem });
  return { ok: true, scope, domain: scope === 'site' ? domain : undefined };
}

export async function forget(scope, index, domain) {
  const mem = await load();
  const list = scope === 'site' ? mem.sites[domain] || [] : mem.user;
  list.splice(index, 1);
  if (scope === 'site' && !list.length) delete mem.sites[domain];
  await chrome.storage.local.set({ [KEY]: mem });
  return { ok: true };
}

export async function clearAll() {
  await chrome.storage.local.set({ [KEY]: { user: [], sites: {} } });
}

// Ang bahagi ng system prompt para sa kasalukuyang domain. Walang laman kung walang alam,
// para hindi tayo magsayang ng tokens sa mga walang lamang heading.
export async function promptFor(domain) {
  const mem = await load();
  const site = mem.sites[domain] || [];
  if (!mem.user.length && !site.length) return '';

  let out = '\n\nANG NATUTUNAN MO NA:';
  if (mem.user.length) out += '\n\nTungkol sa user:\n' + mem.user.map((s) => `- ${s}`).join('\n');
  if (site.length) out += `\n\nTungkol sa ${domain}:\n` + site.map((s) => `- ${s}`).join('\n');
  out +=
    '\n\nGamitin ito para laktawan ang mga natuklasan mo na. Kung mali ang isang tala, ' +
    'sabihin sa user — huwag itong basta sundin.';
  return out;
}
