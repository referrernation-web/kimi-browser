// COMPAT SHIM — ang tunay na imbakan ay hub.js na ngayon (structured records na may
// bounded injection). Nandito pa rin ang file na ito para hindi masira ang mga
// import; ini-redirect lang nito ang lumang API papunta sa hub.

import { hubAdd, hubPromptFor, hubList, hubForget } from './hub.js';

// remember(scope, note, domain, kind?) → hubAdd. Ang 'user' scope ay walang domain.
export async function remember(scope, note, domain, kind) {
  return hubAdd({
    text: note,
    domain: scope === 'site' ? domain || '' : '',
    kind: kind || (scope === 'site' ? 'note' : 'pref'),
    source: 'reflect',
  });
}

export async function promptFor(domain, taskText) {
  return hubPromptFor(domain, taskText);
}

// Legacy load()/forget() para sa anumang naiwang tumatawag — nakabatay na sa hub.
export async function load() {
  const records = await hubList();
  const mem = { user: [], sites: {} };
  for (const r of records) {
    if (r.domain) (mem.sites[r.domain] ||= []).push(r.text);
    else mem.user.push(r.text);
  }
  return mem;
}

export async function forget(scope, index, domain) {
  // Best-effort para sa lumang index-based na tawag — hinahanap ang record sa hub.
  const records = await hubList();
  const list = records.filter((r) => (scope === 'site' ? r.domain === domain : !r.domain));
  const rec = list[index];
  if (rec) await hubForget(rec.id);
  return { ok: !!rec };
}
