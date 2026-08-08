import assert from 'node:assert';

// In-memory na chrome.storage.local stub — kailangan BAGO ang import.
const store = {};
globalThis.chrome = {
  storage: {
    local: {
      get: async (k) => {
        if (typeof k === 'string') return { [k]: store[k] };
        if (Array.isArray(k)) return Object.fromEntries(k.map((x) => [x, store[x]]));
        return { ...store };
      },
      set: async (obj) => Object.assign(store, obj),
    },
  },
};
globalThis.__hubNow = 1_700_000_000_000; // nakapirming "ngayon" para sa deterministic na test

const hub = await import('./hub.js');

// --- Migration mula sa lumang memory shape ---
store.memory = { user: ['gusto ng user ang maikli'], sites: { 'x.com': ['ang login ay nasa taas'] } };
let h = await hub.hubLoad();
assert.equal(h.migratedFrom, 'memory');
assert.equal(h.records.length, 2, 'na-migrate ang 2 lumang tala');
assert.ok(store.memory, 'hindi binura ang lumang memory (safe rollback)');
assert.ok(h.records.some((r) => r.kind === 'pref' && r.domain === ''), 'user → pref/global');
assert.ok(h.records.some((r) => r.kind === 'note' && r.domain === 'x.com'), 'site → note');

// --- Dedup: ang malapit na pareho ay nag-bu-bump ng hits, hindi nagdadagdag ---
await hub.hubAdd({ text: 'Ang checkout button ay nasa ilalim ng cart', domain: 'shop.com', kind: 'gotcha' });
const before = (await hub.hubLoad()).records.length;
const r2 = await hub.hubAdd({ text: 'ang checkout button nasa ilalim ng cart!', domain: 'shop.com', kind: 'gotcha' });
const after = await hub.hubLoad();
assert.equal(after.records.length, before, 'hindi nagdagdag — pareho na');
const dup = after.records.find((r) => r.domain === 'shop.com');
assert.equal(dup.hits, 2, 'nag-bump ng hits sa halip');
assert.equal(r2.note?.includes('pinalakas'), true);

// Ang ibang domain na parehong teksto ay HINDI dedup (magkaibang site, magkaibang aral).
await hub.hubAdd({ text: 'Ang checkout button ay nasa ilalim ng cart', domain: 'iba.com', kind: 'gotcha' });
assert.ok((await hub.hubLoad()).records.some((r) => r.domain === 'iba.com'));

// --- Injection budget: KAILANMAN ≤1500 chars, at may max records ---
for (let i = 0; i < 40; i++) {
  await hub.hubAdd({ text: 'Tala bilang ' + i + ' na medyo mahaba para masubok ang budget ng injection dito', domain: 'big.com', kind: 'note' });
}
const inj = await hub.hubPromptFor('big.com', 'tala budget');
assert.ok(inj.length <= 1500 + 200, 'may hard budget ang injection (' + inj.length + ')'); // +200 para sa header/footer
assert.ok((inj.match(/\n- /g) || []).length <= 10, 'max 10 records');

// --- Caps at eviction: per-domain cap, pinned hindi nawawala ---
const bigCount = (await hub.hubLoad()).records.filter((r) => r.domain === 'big.com').length;
assert.ok(bigCount <= hub._internals.MAX_PER_DOMAIN, 'per-domain cap sinusunod (' + bigCount + ')');

await hub.hubAdd({ text: 'MAHALAGANG PINNED na aral na dapat manatili', domain: 'big.com', kind: 'fix', pinned: true });
for (let i = 0; i < 30; i++) await hub.hubAdd({ text: 'dagdag pang tala para pilitin ang eviction ' + i, domain: 'big.com' });
const stillPinned = (await hub.hubLoad()).records.some((r) => r.text.includes('PINNED'));
assert.ok(stillPinned, 'ang pinned ay hindi kailanman ine-evict');

// --- Pinned ay laging kasama sa injection at nauuna ---
const inj2 = await hub.hubPromptFor('big.com', 'kahit ano');
assert.ok(inj2.includes('PINNED'), 'pinned laging kasama sa injection');

// --- recall: hinahanap anuman ang domain ---
await hub.hubAdd({ text: 'Sa Elementor, ang HTML widget ay nasa kaliwang panel', domain: 'wp1.com', kind: 'fix' });
const rec = await hub.recall('elementor html widget');
assert.ok(rec.bilang >= 1, 'nahanap ng recall');
assert.ok(rec.mga_item.some((x) => x.tala.includes('HTML widget')));

// --- Write queue: 20 sabayang add na MAGKAKAIBA, walang nawawala/na-corrupt ---
// (Kailangang tunay na magkaiba ang teksto — kung magkakapareho, tama lang na
// pagsamahin sila ng dedup, at hindi na race ang nasusubok.)
const salita = ['checkout', 'pagbabayad', 'paghahatid', 'kupon', 'balik', 'suporta', 'account',
  'password', 'larawan', 'presyo', 'stock', 'sukat', 'kulay', 'brand', 'rating', 'komento',
  'filter', 'paghahanap', 'wishlist', 'notipikasyon'];
await Promise.all(salita.map((w) => hub.hubAdd({ text: `Ang ${w} dito ay may sariling hiwalay na pahina`, domain: 'race.com' })));
const raceCount = (await hub.hubLoad()).records.filter((r) => r.domain === 'race.com').length;
assert.equal(raceCount, 20, 'lahat ng 20 sabayang write ay pumasok (' + raceCount + ')');

console.log('OK — bounded injection, fuzzy dedup, LRU eviction, pinned-safe, recall, migration');
