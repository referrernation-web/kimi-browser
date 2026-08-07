import assert from 'node:assert';
// Ang background.js ay tumatawag ng chrome.* sa module scope kapag na-load.
globalThis.chrome = {
  runtime: { onMessage: { addListener() {} }, onConnect: { addListener() {} } },
  action: { onClicked: { addListener() {} } },
  alarms: { onAlarm: { addListener() {} } },
  notifications: { onClicked: { addListener() {} } },
};
const { toolTrail } = await import('./background.js');

// Walang tool = dapat MALINAW na sabihin, hindi blangko — dito nahuhuli ang
// worker na nag-iimbento ng "base sa ginawa nating pagsusuri".
assert.match(toolTrail([{ role: 'user', content: 'hello' }]), /WALA/);

const messages = [
  { role: 'user', content: 'hanapan mo ako ng DDR5' },
  {
    role: 'assistant',
    tool_calls: [
      { function: { name: 'navigate', arguments: '{"url":"https://marketplace.example.com"}' } },
      { function: { name: 'click', arguments: '{"ref":"ref_12"}' } },
    ],
  },
  { role: 'tool', content: '{"ok":true}' },
  { role: 'assistant', tool_calls: [{ function: { name: 'read_page', arguments: '{}' } }] },
  { role: 'tool', content: '{"error":"Walang ref_99"}' },
];

const trail = toolTrail(messages);
assert.match(trail, /navigate — https:\/\/marketplace\.example\.com/, 'kasama ang URL na binuksan');
assert.match(trail, /click — ref_12/, 'kasama ang pinindot');
assert.match(trail, /read_page/, 'kasama ang pagbasa');
assert.match(trail, /NABIGO/, 'kita ang mga nabigong hakbang — dito nakikita ang tunay na sablay');

// Ang mahabang gawain ay pinuputol sa dulo (ang pinakabago ang mahalaga).
const marami = Array.from({ length: 40 }, (_, i) => ({
  role: 'assistant',
  tool_calls: [{ function: { name: `tool${i}`, arguments: '{}' } }],
}));
const lines = toolTrail(marami, 5).split('\n');
assert.equal(lines.length, 5, 'sumusunod sa limit');
assert.equal(lines.at(-1), 'tool39', 'ang HULI ang pinapanatili, hindi ang una');

// Sirang JSON sa arguments: hindi dapat sumabog — ang trail ay palamuti lang ng audit.
assert.match(
  toolTrail([{ role: 'assistant', tool_calls: [{ function: { name: 'click', arguments: '{sira' } }] }]),
  /click/,
  'kaya ang sirang arguments'
);

console.log('OK — nakikita ng auditor ang TALAGANG ginawa, hindi lang ang sinabi');
