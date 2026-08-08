import assert from 'node:assert';

// Sinusukat nito ang PINAKAMAHALAGANG pangako ng knowledge hub: ang mga aral ay
// nakukuha mula sa mga signal na KINOMPUTE NA — walang kahit isang dagdag na
// tawag sa model. Kung tumaas ang bilang ng fetch, sablay ang buong disenyo.

const store = {};
globalThis.chrome = {
  storage: {
    local: {
      get: async (k) => (typeof k === 'string' ? { [k]: store[k] } : Array.isArray(k) ? Object.fromEntries(k.map((x) => [x, store[x]])) : { ...store }),
      set: async (o) => Object.assign(store, o),
    },
  },
};
globalThis.__hubNow = 1_700_000_000_000;

const hub = await import('./hub.js');

// --- Ang loop guard ay nagtatala ng gotcha ---
// (Ginagaya ang eksaktong tawag ng background.js sa harvest point.)
const core = { ref: 'ref_18' };
await hub.hubAdd({
  text: `Hindi tumatalab ang click ${JSON.stringify(core).slice(0, 90)} dito kahit 3 ulit — ibang ruta agad, huwag ulitin.`,
  domain: 'shopee.ph', kind: 'gotcha', source: 'loop',
});
let recs = await hub.hubList();
const loopRec = recs.find((r) => r.source === 'loop');
assert.ok(loopRec, 'may naitalang gotcha mula sa blocked loop');
assert.equal(loopRec.kind, 'gotcha');
assert.equal(loopRec.domain, 'shopee.ph');
assert.match(loopRec.text, /ref_18/, 'kasama ang eksaktong hakbang na bumagsak');

// --- IWASTO ng auditor ---
const iwastoLine = 'IWASTO: hindi mo binuksan ang Edit Snippet — pindutin muna ito bago hanapin ang Title field.';
await hub.hubAdd({
  text: iwastoLine.replace(/^IWASTO:?\s*/i, '').slice(0, 200),
  domain: 'aireonepeel.ca', kind: 'fix', source: 'iwasto',
});
recs = await hub.hubList();
const fix = recs.find((r) => r.source === 'iwasto');
assert.ok(fix, 'may naitalang fix mula sa IWASTO');
assert.ok(!/^IWASTO/i.test(fix.text), 'naalis ang IWASTO prefix — aral lang ang natira');
assert.match(fix.text, /Edit Snippet/);

// --- Audit critique: ang unang actionable na linya lang ang kinukuha (regex, walang LLM) ---
const critique = `— puna ni glm-5.2:
**1. PULIDO**
- Nag-imbento ka ng pricing check na hindi naman nangyari sa usapang ito.
- Sobrang haba ng sagot sa isang simpleng tanong.
SCORE: 2/10`;
const bullet = /^\s*(?:[-•*]|\d+[.)])\s*(.{20,200})/m.exec(critique);
assert.ok(bullet, 'nakukuha ng regex ang unang bullet');
await hub.hubAdd({ text: `Bagsak sa audit (2/10): ${bullet[1].trim()}`, domain: 'x.com', kind: 'gotcha', source: 'audit' });
const audit = (await hub.hubList()).find((r) => r.source === 'audit');
assert.match(audit.text, /2\/10/, 'kasama ang score');
assert.match(audit.text, /imbento/, 'kasama ang aktwal na puna');

// --- Escalation ---
await hub.hubAdd({
  text: 'Sunod-sunod na error dito hanggang kailanganin ang mas malakas na model — click: Walang ref_9',
  domain: 'fb.com', kind: 'gotcha', source: 'error',
});
assert.ok((await hub.hubList()).some((r) => r.source === 'error'));

// --- ANG PINAKAMAHALAGA: apat na aral, ZERO fetch ---
// Walang globalThis.fetch na na-define sa buong test na ito. Kung may tumawag ng
// model sa anumang harvest path, mag-e-error sana ito — kaya ang pagpasa ay
// katibayan mismo na libre ang lahat ng harvest sa itaas.
assert.equal(typeof globalThis.fetch, 'function', 'may native fetch ang Node');
let calls = 0;
const native = globalThis.fetch;
globalThis.fetch = (...a) => { calls++; return native(...a); };
await hub.hubAdd({ text: 'Isa pang aral na naitala nang libre', domain: 'shopee.ph', kind: 'note', source: 'loop' });
await hub.hubPromptFor('shopee.ph', 'maghanap ng produkto');
await hub.recall('ref na bumagsak');
assert.equal(calls, 0, 'ZERO dagdag na model call sa harvest, injection, at recall');

// --- Ang mga aral ay lumalabas sa injection ng TAMANG domain ---
const inj = await hub.hubPromptFor('shopee.ph', 'pindutin ang produkto');
assert.match(inj, /ref_18/, 'ang gotcha ng shopee ay kasama sa injection nito');
assert.ok(!/Edit Snippet/.test(inj), 'ang aral ng ibang site ay HINDI isinasama');

// --- Pero mahahanap pa rin ito ng recall kahit ibang domain ---
const rec = await hub.recall('Edit Snippet Title field');
assert.ok(rec.mga_item.some((x) => /Edit Snippet/.test(x.tala)), 'nahahanap ng recall kahit ibang site');

console.log('OK — nakukuha ang aral mula sa mali nang WALANG dagdag na model call');
