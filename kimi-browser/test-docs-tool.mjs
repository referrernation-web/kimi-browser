import assert from 'node:assert';

const store = {};
globalThis.chrome = {
  storage: {
    local: {
      get: async (k) => (typeof k === 'string' ? { [k]: store[k] } : { ...store }),
      set: async (o) => Object.assign(store, o),
    },
  },
  runtime: { onMessage: { addListener() {} }, onConnect: { addListener() {} } },
  action: { onClicked: { addListener() {} } },
  alarms: { onAlarm: { addListener() {} } },
  notifications: { onClicked: { addListener() {} } },
  identity: { getRedirectURL: () => 'x' },
};

const { docAppend, docGet, docAsMarkdown, docAsHtml, setDocSession, _docInternals } = await import('./docs.js');

// --- Ang laman ay HINDI bumabalik sa usapan — bilang lang ---
setDocSession('s1');
let r = await docAppend({ title: 'Winter Tips', append: '## Panimula\n\nAng taglamig ay mahirap para sa HVAC.' });
assert.equal(r.ok, true);
assert.equal(r.mga_seksyon, 1);
assert.ok(r.mga_salita > 5);
assert.ok(!JSON.stringify(r).includes('HVAC'), 'ang LAMAN ay wala sa tool result — ito ang tipid');
assert.deepEqual(r.balangkas, ['Panimula']);

// --- Umiipon ang salita sa maraming seksyon ---
r = await docAppend({ append: '## Pangalawa\n\n' + 'salita '.repeat(300) });
assert.equal(r.mga_seksyon, 2);
assert.ok(r.mga_salita > 300, 'umiipon ang bilang ng salita');

// --- replace_section: rebisyon, hindi dagdag ---
r = await docAppend({ append: '## Bagong Panimula\n\nPinalitan na ito.', replace_section: 0 });
assert.equal(r.mga_seksyon, 2, 'hindi nadagdagan');
assert.equal(r.balangkas[0], 'Bagong Panimula');

// --- Per-session isolation ---
setDocSession('s2');
r = await docAppend({ title: 'Iba', append: '## Hiwalay\n\nIbang dokumento ito.' });
assert.equal(r.mga_seksyon, 1, 'bagong session, bagong dokumento');
setDocSession('s1');
assert.equal((await docGet()).sections.length, 2, 'buo pa rin ang unang dokumento');

// --- start_new: naglilinis ---
r = await docAppend({ title: 'Panibago', append: '## Simula ulit', start_new: true });
assert.equal(r.mga_seksyon, 1);

// --- Cap: may malinaw na Tagalog na error, hindi tahimik na pagkabigo ---
setDocSession('s3');
await docAppend({ title: 'Malaki', append: 'x'.repeat(_docInternals.MAX_DOC_CHARS - 100) });
r = await docAppend({ append: 'y'.repeat(500) });
assert.ok(r.error && /[Pp]uno/.test(r.error), 'may error kapag puno: ' + r.error);

// --- Markdown at HTML export ---
setDocSession('s4');
await docAppend({ title: 'Test Doc', append: '## Seksyon\n\nMay **bold** dito.' });
const md = await docAsMarkdown();
assert.match(md, /^# Test Doc/);
assert.match(md, /## Seksyon/);
const html = await docAsHtml();
assert.match(html, /<h1>Test Doc<\/h1>/);
assert.match(html, /<strong>bold<\/strong>/);

// --- LRU: hanggang 10 dokumento lang ---
for (let i = 0; i < 12; i++) {
  setDocSession('lru' + i);
  await docAppend({ title: 'D' + i, append: 'Laman ng dokumento numero ' + i });
}
const all = (await chrome.storage.local.get('docs')).docs;
assert.ok(Object.keys(all).length <= _docInternals.MAX_DOCS, 'sinusunod ang LRU cap (' + Object.keys(all).length + ')');

// --- compactDocArgs: ang mga LUMANG seksyon ay tinatanggal sa history ---
const { compactDocArgs } = await import('./background.js');
const mkCall = (title, body) => ({
  role: 'assistant',
  tool_calls: [{ id: 'c' + title, function: { name: 'write_document', arguments: JSON.stringify({ title, append: body }) } }],
});
const messages = [
  { role: 'user', content: 'sumulat ka' },
  mkCall('A', 'x'.repeat(2000)),
  { role: 'tool', tool_call_id: 'cA', content: '{"ok":true}' },
  mkCall('B', 'y'.repeat(2000)),
  { role: 'tool', tool_call_id: 'cB', content: '{"ok":true}' },
  mkCall('C', 'z'.repeat(2000)),
  { role: 'tool', tool_call_id: 'cC', content: '{"ok":true}' },
];
const bago = JSON.stringify(messages).length;
const saved = compactDocArgs(messages);
assert.ok(saved > 3000, 'malaking natipid (' + saved + ')');
assert.ok(!JSON.stringify(messages[1]).includes('xxxx'), 'naalis ang laman ng UNANG seksyon');
assert.ok(JSON.stringify(messages[5]).includes('zzzz'), 'BUO ang pinakabagong seksyon');
assert.match(messages[1].tool_calls[0].function.arguments, /"title":"A"/, 'nananatili ang pamagat');
// Ang pagkakapares ng tool_call at tool result ay hindi dapat masira.
assert.equal(messages.filter((m) => m.role === 'tool').length, 3, 'buo ang tool results');
assert.equal(messages[1].tool_calls[0].id, 'cA', 'buo ang tool_call id');
assert.ok(JSON.stringify(messages).length < bago);

console.log('OK — ang laman ay nasa buffer hindi sa usapan, may cap, at nalilinis sa history');
