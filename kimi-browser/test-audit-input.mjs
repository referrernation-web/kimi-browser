import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

// ANG APAT NA DEPEKTONG NAKITA SA TOTOONG TRANSCRIPT (Aug 9, sesyon ng Hamuq SEO):
//
// 1. Hinuhusgahan ng auditor ang sagot laban sa UNANG mensahe ng buong usapan.
//    Humingi ang user ng research; sinukat ito ng auditor laban sa "nakikita mo ba
//    yung project nayan?" mula tatlong turn ang nakalipas. 6/10, ipinasulat muli.
// 2. Hindi nakikita ng auditor ang ibinigay sa worker, kaya tinawag niyang
//    hallucination ang 21 filename na TOTOO — nasa system prompt ang mga iyon.
//    4/10, ipinasulat muli, at ang bago ay mas maingat pero hindi mas tama.
// 3. Ginamit ang Pages.csv (isang Search Console PERFORMANCE export) bilang patunay
//    na WALA pang artikulo sa isang paksa. Ang export na iyon ay may laman lang na
//    mga pahinang may impression sa napiling petsa. Apat na paksang meron na pala
//    ang inirekomenda. Sagot ng user: "meron na tayong mga article nayan."
// 4. Hindi makapag-navigate para itsek ang sitemap: sumuko ang ensureScope dahil
//    chrome:// ang bukas na tab, at ang payo pa ay "magpadala mula sa panel" — na
//    ginawa naman niya. Lumipat pa sa mas mahal na model bago tuluyang sumuko.

const store = {};
globalThis.chrome = {
  storage: {
    local: {
      get: async (k) => (typeof k === 'string' ? { [k]: store[k] } : { ...store }),
      set: async (o) => Object.assign(store, o),
      remove: async (k) => { for (const one of [].concat(k)) delete store[one]; },
    },
  },
  runtime: { onConnect: { addListener() {} }, onMessage: { addListener() {} }, onInstalled: { addListener() {} }, getPlatformInfo: async () => ({}) },
  alarms: { onAlarm: { addListener() {} }, create() {}, clear() {}, getAll: async () => [] },
  notifications: { onClicked: { addListener() {} } },
  tabs: { onRemoved: { addListener() {} }, onUpdated: { addListener() {} }, query: async () => [] },
  tabGroups: { onRemoved: { addListener() {} } },
  action: { onClicked: { addListener() {} } },
  sidePanel: { setPanelBehavior: async () => {} },
  commands: { onCommand: { addListener() {} } },
};

const BG = await import('./background.js');
const F = await import('./files.js');

// ---------- 1. Huling utos, hindi ang una ----------
const usapan = [
  { role: 'user', content: 'nakikita mo ba yung project nayan?' },
  { role: 'assistant', content: 'Oo, nakikita ko.' },
  { role: 'user', content: 'magresearch ka nga ng topic na magcoconvert ng sales' },
  { role: 'assistant', content: null, tool_calls: [{ id: '1', function: { name: 'search_files', arguments: '{}' } }] },
  { role: 'tool', tool_call_id: '1', content: '{}' },
];
assert.equal(
  BG.latestUserTask(usapan), 'magresearch ka nga ng topic na magcoconvert ng sales',
  'ANG HULING utos ang hinuhusgahan — hindi ang kauna-unahang mensahe ng usapan'
);

// Ang mga paalala ng sistema ay role:'user' din. Hindi sila utos.
usapan.push({ role: 'user', content: '[SISTEMA] Tatlong beses nang bumagsak ang read_page, kaya inalis ko na ito.' });
assert.equal(
  BG.latestUserTask(usapan), 'magresearch ka nga ng topic na magcoconvert ng sales',
  'hindi nagiging "utos ng user" ang paalala ng sistema'
);

// Ang screenshot ay user message na array ang content — hindi rin ito utos.
usapan.push({ role: 'user', content: [{ type: 'image_url', image_url: { url: 'data:...' } }] });
assert.equal(BG.latestUserTask(usapan), 'magresearch ka nga ng topic na magcoconvert ng sales', 'hindi rin ang larawan');
assert.equal(BG.latestUserTask([]), '', 'ligtas sa walang laman');
assert.equal(BG.latestUserTask(undefined), '', 'ligtas sa undefined');

// ---------- 2. Nakikita ng auditor ang ibinigay sa worker ----------
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const bg = fs.readFileSync(path.join(HERE, 'background.js'), 'utf8');
assert.match(bg, /ANG UTOS NG USER:\\n\$\{hulingUtos\}/, 'ang huling utos ang ipinapasa sa auditor');
assert.match(bg, /ANG IBINIGAY NA SA WORKER/, 'ipinapakita sa auditor ang project context');
assert.match(bg, /HINDI hallucination/, 'tahasang sinasabi sa auditor na totoo ang konteksto');
assert.ok(
  !/const firstUser/.test(bg),
  'BUMALIK ang bug: hinuhusgahan ang sagot laban sa kauna-unahang mensahe ng usapan'
);

// ---------- 3. Sinasabi kung ANO ang bawat file ----------
const csv = ['URL,Clicks,Impressions,CTR,Position']
  .concat(Array.from({ length: 974 }, (_, i) => `https://hamuq.com/p/${i},${i},${i * 3},1.2%,${i % 40}`))
  .join('\n');
const p = await F.createProject('Hamuq SEO');
const f = await F.addFile(p.id, 'Pages.csv', csv);
await F.attachSession('sx', p.id);
F.setFileSession('sx');

const meta = (await F.listProjects())[p.id].files.find((x) => x.id === f.id);
assert.equal(meta.lines, 975, 'itinatala ang bilang ng linya sa pag-upload (libre doon, mahal sa bawat prompt)');
assert.match(meta.head, /^URL,Clicks,Impressions/, 'itinatala ang unang linya — dito nakikita kung anong ulat ito');

const prompt = await F.projectPrompt('sx', 'adaptive');
assert.match(prompt, /975 linya/, 'sinasabi sa modelo kung gaano kalaki');
assert.match(prompt, /URL,Clicks,Impressions/, 'sinasabi kung ANONG ulat ito, hindi lang ang pangalan');
assert.match(
  prompt, /KAWALAN ng isang bagay doon ay HINDI patunay na wala ito/,
  'ITO ang mismong pagkakamali: ginamit ang performance export bilang patunay na wala pang artikulo'
);
assert.match(prompt, /sitemap o \s*\n?\s*sa mismong site/, 'itinuturo ang TAMANG pinagkukunan');

// ---------- 4. Gumagawa ng tab, hindi sumusuko ----------
assert.match(
  bg, /chrome\.tabs\.create\(\{ url: 'about:blank', active: false \}\)/,
  'gumagawa ng tab kapag chrome:// ang bukas — dating tahimik na sumusuko at pumapatay ng buong takbo'
);

// ---------- 5. May hangganan ang pag-iisip ----------
assert.match(bg, /enable_thinking: true, thinking_budget: think/, 'ipinapadala ang hangganan ng pag-iisip');
assert.match(
  bg, /think: provider === 'tokenplan' \|\| provider === 'dashscope' \? \(d\.think \?\? 4000\) : 0/,
  'sa pamilyang Qwen lang — tinatanggihan ito ng Kimi at Groq nang hindi kilala'
);
assert.match(bg, /think,\n\s*onDelta/, 'naipapasa ito sa pangunahing tawag, hindi lang nakadeklara');

console.log('OK — tamang utos sa auditor, alam ang hugis ng file, at may hangganan ang pag-iisip');
