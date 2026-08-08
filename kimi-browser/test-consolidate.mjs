import assert from 'node:assert';

const store = {};
globalThis.chrome = {
  storage: {
    local: {
      get: async (k) => (typeof k === 'string' ? { [k]: store[k] } : Array.isArray(k) ? Object.fromEntries(k.map((x) => [x, store[x]])) : { ...store }),
      set: async (o) => Object.assign(store, o),
    },
  },
  runtime: { onMessage: { addListener() {} }, onConnect: { addListener() {} } },
  action: { onClicked: { addListener() {} } },
  alarms: { onAlarm: { addListener() {} } },
  notifications: { onClicked: { addListener() {} } },
  identity: { getRedirectURL: () => 'x' },
};
globalThis.__hubNow = 1_700_000_000_000;

const hub = await import('./hub.js');
const { consolidateIfNeeded } = await import('./background.js');

const salita = ['checkout', 'bayad', 'hatid', 'kupon', 'balik', 'suporta', 'account', 'password',
  'larawan', 'presyo', 'stock', 'sukat', 'kulay', 'brand', 'rating', 'komento', 'filter',
  'hanap', 'wishlist', 'abiso', 'cart', 'order', 'invoice', 'refund', 'tracking', 'review'];

async function seed(n, domain = 'shop.com') {
  for (let i = 0; i < n; i++) {
    await hub.hubAdd({ text: `Ang ${salita[i]} dito ay may sariling hiwalay na pahina at daan`, domain, kind: 'note' });
  }
}

// --- Threshold: hindi tumatakbo kapag kakaunti pa ---
await seed(10);
assert.equal(await hub.needsConsolidation('shop.com'), false, 'kaunti pa — huwag mag-consolidate');

// --- Tumatakbo kapag umabot na sa threshold (BAGO mag-evict ang caps) ---
await seed(22);
const bilangBago = (await hub.hubList()).filter((r) => r.domain === 'shop.com').length;
assert.ok(bilangBago >= hub._internals.CONSOLIDATE_AT, 'sapat na ang tala (' + bilangBago + ')');
assert.ok(bilangBago <= hub._internals.MAX_PER_DOMAIN, 'hindi pa lumalampas sa cap — kaya walang naitapon');
assert.equal(await hub.needsConsolidation('shop.com'), true, 'marami na — dapat mag-consolidate');

// --- Fake na model na nagbabalik ng valid na JSON array ---
let calls = 0;
globalThis.fetch = async () => {
  calls++;
  return {
    ok: true,
    json: async () => ({
      choices: [{ message: { content: '["Pinagsamang aral A tungkol sa checkout at bayad", "Pinagsamang aral B tungkol sa hanap at filter"]' } }],
    }),
  };
};
let r = await consolidateIfNeeded('shop.com', 'https://x/chat/completions', 'k', 'm');
assert.equal(calls, 1, 'ISANG murang tawag lang');
assert.equal(r.ok, true);
const pagkatapos = (await hub.hubList()).filter((r2) => r2.domain === 'shop.com');
assert.equal(pagkatapos.length, 2, 'pinalitan ng 2 na pinagsamang aral (' + pagkatapos.length + ')');
assert.ok(pagkatapos.every((x) => x.source === 'merge'));

// --- 24h throttle: hindi na uulit agad ---
calls = 0;
await seed(26);
r = await consolidateIfNeeded('shop.com', 'https://x/chat/completions', 'k', 'm');
assert.equal(calls, 0, 'hindi tumatawag sa loob ng 24 oras');
assert.equal(r, null);

// Pagkalipas ng 25 oras, pwede na ulit.
globalThis.__hubNow += 25 * 3600_000;
assert.equal(await hub.needsConsolidation('shop.com'), true, 'lumipas na ang throttle');

// --- Basurang sagot: WALANG binabago (failure-safe) ---
const dami = (await hub.hubList()).filter((x) => x.domain === 'shop.com').length;
globalThis.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'wala akong maibibigay' } }] }) });
await consolidateIfNeeded('shop.com', 'https://x/chat/completions', 'k', 'm');
const damiPagkatapos = (await hub.hubList()).filter((x) => x.domain === 'shop.com').length;
assert.ok(damiPagkatapos >= 2, 'hindi nabura ang lahat sa basurang sagot (' + damiPagkatapos + ')');

// --- Ang PINNED ay hindi ginagalaw ng consolidation ---
globalThis.__hubNow += 25 * 3600_000;
await hub.hubAdd({ text: 'HALAGANG PINNED na hindi dapat mawala kailanman', domain: 'pin.com', kind: 'fix', pinned: true });
await seed(26, 'pin.com');
globalThis.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '["Pinagsamang aral A", "Pinagsamang aral B", "Pinagsamang aral C"]' } }] }) });
await consolidateIfNeeded('pin.com', 'https://x/chat/completions', 'k', 'm');
const pinned = (await hub.hubList()).find((x) => x.text.includes('PINNED'));
assert.ok(pinned, 'buhay pa rin ang pinned pagkatapos ng consolidation');
assert.equal(pinned.pinned, true);

// --- Nabigong fetch: walang binabago, walang sumasabog ---
globalThis.__hubNow += 25 * 3600_000;
globalThis.fetch = async () => { throw new Error('lagot ang network'); };
const bagoAngError = (await hub.hubList()).length;
r = await consolidateIfNeeded('pin.com', 'https://x/chat/completions', 'k', 'm');
assert.equal(r, null, 'tahimik na sumusuko kapag nabigo ang network');
assert.equal((await hub.hubList()).length, bagoAngError, 'walang nawala');

console.log('OK — nagpapaliit nang ligtas, may throttle, at hindi sumisira kapag nabigo');
