// Pinapatakbo ang background.js na may pekeng Chrome APIs at pekeng Kimi API,
// para masubukan ang agent loop nang walang browser.  node test-loop.mjs
import assert from 'node:assert';

const listeners = {};
let MODE = 'manual';
let sentTools = null; // ang schema na aktwal na naipadala sa API

globalThis.chrome = {
  runtime: {
    onConnect: { addListener: (fn) => (listeners.connect = fn) },
    onMessage: { addListener() {} },
    sendMessage() {},
    getPlatformInfo: async () => ({}),
  },
  offscreen: { hasDocument: async () => false, createDocument: async () => {}, closeDocument: async () => {} },
  tabCapture: { getMediaStreamId: async () => 'sid' },
  action: { onClicked: { addListener() {} } },
  sidePanel: { open() {} },
  storage: { local: { get: async () => ({ apiKey: 'test', model: 'k3', mode: MODE }) } },
  tabs: {
    query: async () => [{ id: 1, url: 'https://example.com', active: true }],
    update: async () => ({}),
    create: async () => ({ id: 2 }),
    remove: async () => ({}),
  },
  scripting: {
    executeScript: async ({ func, args }) => [{ result: func(...args) }],
  },
};

// Pekeng DOM para sa mga inject na function.
globalThis.window = { __kimiRefs: new Map([['ref_2', { scrollIntoView() {}, focus() {}, isContentEditable: true, dispatchEvent() {}, innerText: 'Search' }]]), innerHeight: 800, scrollY: 0, scrollBy() {} };
globalThis.document = { title: 'T', body: { innerText: 'hello' }, querySelectorAll: () => [] };
globalThis.location = { href: 'https://example.com' };
globalThis.getComputedStyle = () => ({});

// Ang script ng pekeng Kimi ay itinatakda ng bawat sitwasyon.
let script = [];
let turn = 0;
const call = (name, args) => ({
  choices: [{ message: { role: 'assistant', tool_calls: [{ id: 't' + turn, type: 'function', function: { name, arguments: JSON.stringify(args) } }] } }],
});
globalThis.fetch = async (_url, opts) => {
  const body = JSON.parse(opts.body);
  sentTools = body.tools;
  // Ang tawag na walang tools ay tawag para sa buod: teksto lang ang isinasagot,
  // gaya ng tunay na API. Kung hindi, tool call pa rin ang ibinabalik nito.
  const step = body.tools ? script[turn++] : null;
  return {
    ok: true,
    json: async () =>
      step ? call(step[0], step[1]) : { choices: [{ message: { role: 'assistant', content: 'Tapos na.' } }] },
  };
};

await import('./background.js');
assert.ok(listeners.connect, 'nagrehistro ang onConnect');

// Nagpapatakbo ng isang usapan at ibinabalik ang lahat ng events na nakita ng panel.
async function run({ mode, steps, reply = () => true }) {
  MODE = mode;
  script = steps;
  turn = 0;
  const got = [];
  let onMsg;
  const port = {
    name: 'kimi',
    postMessage: (m) => {
      got.push(m);
      if (m.type === 'confirm' || m.type === 'question')
        setTimeout(() => onMsg({ type: 'reply', id: m.id, value: reply(m) }), 0);
    },
    onMessage: { addListener: (fn) => (onMsg = fn) },
    onDisconnect: { addListener() {} },
  };
  listeners.connect(port);
  await onMsg({ type: 'ask', text: 'gawin mo', history: [{ role: 'user', content: 'gawin mo' }] });
  await new Promise((r) => setTimeout(r, 50));
  return got;
}

const TYPE = ['type', { ref: 'ref_2', text: 'hi', submit: true }];
const READ = ['read_page', {}];

// 1. manual: humihingi ng pahintulot bago mag-type
let got = await run({ mode: 'manual', steps: [READ, TYPE] });
console.log('manual:', got.map((m) => m.type).join(' '));
assert.ok(got.some((m) => m.type === 'confirm'), 'manual ay humihingi ng pahintulot');
assert.ok(got.find((m) => m.type === 'done'), 'nagpadala ng done');

// Ang bawat mensahe ay ipinapadala AGAD, hindi lang sa dulo — ito ang dahilan kung bakit
// hindi nawawala ang trabaho kapag namatay ang service worker sa kalagitnaan.
const streamed = got.filter((m) => m.type === 'msg').map((m) => m.message);
assert.ok(streamed.length >= 4, `naipadala isa-isa ang kasaysayan (${streamed.length})`);
assert.ok(!streamed.some((m) => m.role === 'system'), 'walang system prompt na naipapadala');
// Ang unang mensahe ay dapat naipadala na BAGO pa dumating ang done.
assert.ok(got.indexOf(got.find((m) => m.type === 'msg')) < got.indexOf(got.find((m) => m.type === 'done')),
  'dumarating ang mga mensahe bago matapos');
// Bawat tool_call ay may katugmang sagot — kung hindi, tatanggihan ito ng API sa susunod.
const ids = streamed.flatMap((m) => (m.tool_calls || []).map((c) => c.id));
const answers = new Set(streamed.filter((m) => m.role === 'tool').map((m) => m.tool_call_id));
assert.ok(ids.every((id) => answers.has(id)), 'may sagot ang bawat tool call');

// 2. auto: hindi na nagtatanong sa type
got = await run({ mode: 'auto', steps: [READ, TYPE] });
console.log('auto:', got.map((m) => m.type).join(' '));
assert.ok(!got.some((m) => m.type === 'confirm'), 'auto ay hindi nagtatanong sa type');

// 3. auto: nagtatanong PA RIN sa close_tab (hindi na maibabalik)
got = await run({ mode: 'auto', steps: [['close_tab', { tabId: 1 }]] });
assert.ok(got.some((m) => m.type === 'confirm'), 'auto ay nagtatanong pa rin sa close_tab');

// 4. bypass: wala talagang tanong
got = await run({ mode: 'bypass', steps: [['close_tab', { tabId: 1 }]] });
assert.ok(!got.some((m) => m.type === 'confirm'), 'bypass ay hindi nagtatanong');

// 5. plan: hindi man lang nakikita ng model ang write tools
await run({ mode: 'plan', steps: [READ] });
const names = sentTools.map((t) => t.function.name);
assert.ok(!names.includes('click') && !names.includes('type'), 'walang write tools sa plan mode');
assert.ok(names.includes('read_page'), 'may read_page pa rin sa plan mode');

// 6. ask_user: ang sagot ng tao ay bumabalik sa model bilang tool result
got = await run({
  mode: 'manual',
  steps: [['ask_user', { question: 'Alin?', options: ['Una', 'Pangalawa'] }]],
  reply: (m) => (m.type === 'question' ? 'Pangalawa' : true),
});
const q = got.find((m) => m.type === 'question');
assert.ok(q, 'lumalabas ang tanong sa panel');
assert.deepEqual(q.options, ['Una', 'Pangalawa'], 'naipapasa ang mga pagpipilian');
const toolMsg = got
  .filter((m) => m.type === 'msg')
  .map((m) => m.message)
  .find((m) => m.role === 'tool');
assert.match(toolMsg.content, /Pangalawa/, 'ang sagot ng tao ay napupunta sa model');
assert.ok(!got.some((m) => m.type === 'confirm'), 'ang ask_user ay hindi humihingi ng pahintulot');

console.log('OK — pasado ang 6 na sitwasyon');

// 7. Ang paglampas sa hangganan ay nagbubuod, hindi nagbubura ng trabaho.
got = await run({ mode: 'bypass', steps: Array.from({ length: 70 }, () => READ) });
const limitMsg = got.find((m) => m.type === 'error' && /hakbang/.test(m.text));
assert.ok(limitMsg, 'sinasabi kapag umabot sa hangganan');
const afterLimit = got.slice(got.indexOf(limitMsg));
assert.ok(afterLimit.some((m) => m.type === 'assistant'), 'may panghuling buod pagkatapos ng hangganan');
console.log('OK — nagbubuod kapag umabot sa hangganan');

// 8. Coach mode: nakakarinig at nakakakita, pero hindi nakakagalaw ng page.
await run({ mode: 'coach', steps: [['listen', { seconds: 5 }]] });
const coachTools = sentTools.map((t) => t.function.name);
assert.ok(coachTools.includes('listen'), 'may listen ang coach');
assert.ok(coachTools.includes('screenshot'), 'may screenshot ang coach');
assert.ok(!coachTools.some((n) => ['click', 'type', 'navigate', 'close_tab'].includes(n)),
  'walang write tool ang coach — hindi siya makakagalaw ng page');
console.log('OK — nakikinig ang coach, hindi kumikilos');

// 9. Pagkatapos ng totoong gawain, bumabalik siya at nagtatala ng natutunan.
let remembered = [];
const origExec = chrome.scripting.executeScript;
chrome.storage.local.set = async () => {};
chrome.storage.local.get = async (k) =>
  k === 'memory' ? { memory: { user: [], sites: {} } } : { apiKey: 'test', model: 'k3', mode: MODE };

// Ang huling tawag (walang tools maliban sa remember) ay sumasagot ng remember call.
const baseFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  const body = JSON.parse(opts.body);
  const only = body.tools?.length === 1 && body.tools[0].function.name === 'remember';
  if (only) {
    remembered.push(body.messages.at(-1).content);
    return { ok: true, json: async () => ({ choices: [{ message: { role: 'assistant',
      tool_calls: [{ id: 'r1', type: 'function', function: { name: 'remember',
        arguments: JSON.stringify({ scope: 'site', note: 'Nasa ilalim ng ⋮ ang export dito.' }) } }] } }] }) };
  }
  return baseFetch(url, opts);
};

got = await run({ mode: 'bypass', steps: [READ, READ, READ] });
assert.equal(remembered.length, 1, 'isang beses lang bumabalik-tanaw kada gawain');
assert.match(remembered[0], /natuklasan ka bang hindi halata/, 'tinatanong ang tamang bagay');
assert.ok(got.some((m) => m.type === 'tool' && m.name === 'remember'), 'naitatala ang natutunan');
// Ang pagbabalik-tanaw ay HINDI dapat dumumi sa usapan.
assert.ok(!got.filter((m) => m.type === 'msg').some((m) => /natuklasan ka bang/.test(m.message?.content || '')),
  'wala sa kasaysayan ang tanong sa pagbabalik-tanaw');

// Ang maikling gawain ay hindi sulit balikan.
remembered = [];
await run({ mode: 'bypass', steps: [] });
assert.equal(remembered.length, 0, 'hindi bumabalik-tanaw sa gawaing walang hakbang');
console.log('OK — natututo siya pagkatapos ng gawain, hindi pagkatapos ng bawat sagot');
