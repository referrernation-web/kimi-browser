import assert from 'node:assert';
globalThis.chrome = {
  runtime: { onConnect: { addListener() {} }, onMessage: { addListener() {} }, sendMessage() {}, getPlatformInfo: async () => ({}) },
  action: { onClicked: { addListener() {} } }, sidePanel: { open() {} },
  storage: { local: { get: async () => ({}) } },
  tabs: { query: async () => [{ id: 1, url: 'https://x.com' }] }, scripting: {},
  offscreen: { hasDocument: async () => false, createDocument: async () => {}, closeDocument: async () => {} },
  tabCapture: { getMediaStreamId: async () => 'sid' },
};
const { compactPages } = await import('./background.js');

// Ginagaya ang tunay na hugis: 15 listing na binasa, ~12k karakter bawat isa.
const page = (u) => JSON.stringify({ url: u, title: 't', interactive: 'a'.repeat(2000), text: 'b'.repeat(10000) });
const messages = [{ role: 'user', content: 'hanapin mo' }];
for (let i = 1; i <= 15; i++) {
  messages.push({ role: 'assistant', tool_calls: [{ id: 'c' + i, function: { name: 'read_page' } }] });
  messages.push({ role: 'tool', tool_call_id: 'c' + i, content: page('https://x.com/item/' + i) });
}
const names = new Map(messages.flatMap(m => (m.tool_calls||[]).map(c => [c.id, 'read_page'])));

const before = messages.reduce((n, m) => n + (m.content?.length || 0), 0);
const saved = compactPages(messages, id => names.get(id));
const after = messages.reduce((n, m) => n + (m.content?.length || 0), 0);

console.log(`bago: ${(before/1000).toFixed(0)}k  pagkatapos: ${(after/1000).toFixed(0)}k  (−${Math.round(100-after/before*100)}%)`);
assert.ok(after < before * 0.15, 'higit 85% ang natipid');
assert.equal(saved, before - after, 'tumpak ang iniulat na natipid');

// Ang pinakabagong page ay dapat BUO pa rin — yan ang tinitingnan niya ngayon.
assert.ok(messages.at(-1).content.length > 10000, 'buo ang huling page');
// Ang mga luma ay may natitirang URL, para may mababalikan siya.
assert.match(messages[2].content, /x\.com\/item\/1/, 'nananatili ang URL ng naikling page');
// Hindi nasisira ang pagkakapares ng tool_call — ito ang sumisira ng API kapag namali.
assert.equal(messages.filter(m=>m.role==='tool').length, 15, 'walang nawawalang tool message');
// Ang pangalawang pagpapatakbo ay wala nang dapat gawin.
assert.equal(compactPages(messages, id => names.get(id)), 0, 'hindi na umuulit');
console.log('OK — nililinis ang konteksto nang hindi nasisira ang kasaysayan');

// Ang mga screenshot ay ~200KB kada isa. Ang pinakabago lang ang mahalaga.
const { compactShots } = await import('./background.js');
const shot = () => ({ role: 'user', content: [
  { type: 'text', text: 'Ito ang hitsura ng screen ngayon:' },
  { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + 'A'.repeat(200000) } }] });
const ms = [{ role: 'user', content: 'tingnan mo' }, shot(), shot(), shot()];
const size = (a) => JSON.stringify(a).length;
const b4 = size(ms);
const savedShots = compactShots(ms);
console.log(`screenshots bago: ${(b4/1000).toFixed(0)}k  pagkatapos: ${(size(ms)/1000).toFixed(0)}k`);
assert.ok(savedShots > 390000, 'dalawang lumang larawan ang naalis');
assert.ok(ms.at(-1).content.some(p => p.type === 'image_url'), 'buo ang pinakabagong larawan');
assert.ok(!ms[1].content.some(p => p.type === 'image_url'), 'wala nang larawan ang luma');
assert.equal(compactShots(ms), 0, 'hindi umuulit');
console.log('OK — nililinis ang mga lumang screenshot');
