import assert from 'node:assert';
// Ginagaya ang tunay na pag-uugali ng Chrome: sumasabog ito sa `undefined` sa args.
const seen = [];
globalThis.chrome = {
  tabs: {
    query: async () => [{ id: 1, url: 'https://x.com' }],
    get: async (id) => ({ id, url: 'https://x.com', groupId: null }),
  },
  scripting: {
    executeScript: async ({ args }) => {
      args.forEach((a, i) => {
        if (a === undefined) throw new Error(`Error at index ${i}: Value is unserializable.`);
      });
      seen.push(args);
      return [{ result: { ok: true } }];
    },
  },
};
const { runTool, setScope } = await import('./tools.js');
setScope(null, 1); // may scope group na ngayon ang tools.js — ituro sa mock tab

// Ito ang eksaktong tawag na bumagsak: scroll na walang `amount`.
await runTool('scroll', { direction: 'down' });
assert.deepEqual(seen.at(-1), ['down', null], 'ang nawawalang amount ay nagiging null');

await runTool('scroll', { direction: 'down', amount: 2 });
assert.deepEqual(seen.at(-1), ['down', 2]);

// At ang page-side ay dapat tratuhin ang null bilang 1.
const { scrollPage } = await import('./page-fns.js');
globalThis.window = { innerHeight: 1000, scrollY: 0, scrollBy() {} };
assert.equal(scrollPage('down', null).ok, true, 'ang null na amount ay hindi bumabagsak');
console.log('OK — hindi na sumasabog ang scroll na walang amount');
