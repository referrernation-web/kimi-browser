import assert from 'node:assert';

// Pekeng Chrome at fetch: sinusubaybayan kung ano talaga ang ipinapadala sa Google.
const calls = [];
globalThis.chrome = {
  identity: {
    getRedirectURL: () => 'https://abc.chromiumapp.org/',
    launchWebAuthFlow: async () => 'https://abc.chromiumapp.org/#access_token=TOK&expires_in=3600',
  },
  storage: { local: { get: async () => ({ googleClientId: 'cid.apps.googleusercontent.com' }) } },
};
globalThis.fetch = async (url, opts = {}) => {
  calls.push({ url, method: opts.method || 'GET', body: opts.body, auth: opts.headers?.Authorization });
  const reply = (o) => ({ ok: true, status: 200, json: async () => o });
  if (url.includes('/messages?q=')) return reply({ messages: [{ id: 'm1' }, { id: 'm2' }] });
  if (url.includes('format=metadata'))
    return reply({
      snippet: 'Kumusta, tungkol sa invoice',
      payload: { headers: [{ name: 'From', value: 'c@x.com' }, { name: 'Subject', value: 'Invoice' }] },
    });
  if (url.includes('format=full'))
    return reply({
      snippet: 's',
      payload: {
        headers: [{ name: 'Subject', value: 'Invoice' }],
        parts: [{ mimeType: 'text/plain', body: { data: btoa('Ang buong laman ng email.') } }],
      },
    });
  if (url.includes('/send')) return reply({ id: 'sent1' });
  if (url.includes(':append')) return reply({ updates: { updatedRows: 3, updatedRange: 'Sheet1!A5:C7' } });
  if (url.includes('/values/')) return reply({ range: 'Sheet1!A1:C2', values: [['a', 'b'], ['c', 'd']] });
  return reply({ email: 'ako@gmail.com' });
};

const { runGoogleTool, GOOGLE_TOOL_NAMES, GOOGLE_TOOLS } = await import('./google.js');

// Ang search ay nagbabalik ng BUOD lang, hindi ng buong email — dito ang tipid.
const s = await runGoogleTool('gmail_search', { query: 'is:unread', limit: 2 });
assert.equal(s.bilang, 2);
assert.equal(s.mga_mensahe[0].mula, 'c@x.com');
assert.ok(!('laman' in s.mga_mensahe[0]), 'walang buong laman sa search — para hindi lumobo ang konteksto');
assert.ok(JSON.stringify(s).length < 800, 'siksik ang resulta ng search');

// Ang buong laman ay kinukuha lang kapag hiningi.
const r = await runGoogleTool('gmail_read', { id: 'm1' });
assert.match(r.laman, /buong laman/);

// Ang pagpapadala ay dapat tunay na RFC822 na naka-base64url, may To at Subject.
calls.length = 0;
await runGoogleTool('gmail_send', { to: 'x@y.com', subject: 'Hi', body: 'Test' });
const sent = calls.find((c) => c.url.includes('/send'));
const raw = atob(JSON.parse(sent.body).raw.replace(/-/g, '+').replace(/_/g, '/'));
assert.match(raw, /^To: x@y\.com/m);
assert.match(raw, /^Subject: Hi/m);
assert.match(raw, /Test$/);
assert.equal(sent.method, 'POST');
assert.equal(sent.auth, 'Bearer TOK', 'may token ang tawag');

// Ang append ay isang tawag para sa LAHAT ng hilera, hindi isa-isa.
calls.length = 0;
const a = await runGoogleTool('sheets_append', { id: 'sid', rows: [['1'], ['2'], ['3']] });
assert.equal(a.naidagdag, 3);
assert.equal(calls.filter((c) => c.url.includes(':append')).length, 1, 'isang tawag lang');

// Ang mga pangalan ay dapat kilala ng router sa background.
for (const t of GOOGLE_TOOLS) assert.ok(GOOGLE_TOOL_NAMES.has(t.function.name));

console.log('OK — tumatakbo ang Gmail at Sheets, siksik ang search, tama ang email na ipinapadala');
