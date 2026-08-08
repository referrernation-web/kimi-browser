import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

// ANG ARAL NA NAGDULOT NG TEST NA ITO:
// Nang alisin ko ang isang naiwang bloke ng lumang code, KASAMANG NADALA ang buong
// Projects UI — nawalan ng handler ang 📁 button. Hindi ito nahuli ng module test
// (valid pa rin ang syntax) ni ng unit tests (hindi nila hinahawakan ang UI). Blangko
// lang ang mangyayari kapag pinindot: walang error, walang nangyayari.
//
// Dito tinitingnan: bawat button na may id sa sidepanel.html ay may katumbas na
// handler sa sidepanel.js. Kapag may natanggal, dito ito babagsak.

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const html = fs.readFileSync(path.join(HERE, 'sidepanel.html'), 'utf8');
const js = fs.readFileSync(path.join(HERE, 'sidepanel.js'), 'utf8');

// Mga id na hinahawakan ng ibang paraan (hindi onclick), o purong display lang.
const HINDI_BUTTON = new Set([
  'ask', 'send', 'log', 'tabstrip', 'tabs', 'menu', 'settings', 'thumbs', 'hint',
  'modelchip', 'statuslight', 'timer', 'models', 'amodels', 'auditrow', 'auditrow2',
  'ttsrow', 'baseurl', 'key', 'model', 'provider', 'mode', 'auditmodel', 'auditprovider',
  'amodelpick', 'cartesiakey', 'cartesiavoice', 'ttsengine', 'mcpurl', 'mcptoken',
]);

const ids = [...html.matchAll(/<button[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
assert.ok(ids.length >= 15, `dapat maraming button ang may id (nakita: ${ids.length})`);

const walang = [];
for (const id of ids) {
  if (HINDI_BUTTON.has(id)) continue;
  // Tinatanggap ang $('id').onclick = ... o $('id').onchange = ...
  const may = new RegExp(`\\$\\('${id}'\\)\\.on(click|change)\\s*=`).test(js);
  if (!may) walang.push(id);
}

assert.deepEqual(
  walang, [],
  `WALANG HANDLER ang mga buton na ito: ${walang.join(', ')}. ` +
    'Pinindot ng user, walang mangyayari at walang error — ito ang pinakamahirap na uri ng sira.'
);

// Ang mga tinatawag sa loob ng code ay dapat may deklarasyon din — nahuhuli nito ang
// tulad ng $('proj').onclick() na tumatawag sa handler na natanggal na pala.
for (const m of js.matchAll(/\$\('([a-z]+)'\)\.onclick\(\)/g)) {
  const id = m[1];
  assert.ok(
    new RegExp(`\\$\\('${id}'\\)\\.onclick\\s*=`).test(js),
    `tinatawag ang $('${id}').onclick() pero WALANG deklarasyon nito — TypeError kapag napindot`
  );
}

// Ang mga import ng sidepanel.js ay dapat totoong file, at ang mga pangalang ini-import
// ay dapat totoong export — nahuhuli nito ang natanggal na function sa ibang module.
for (const m of js.matchAll(/^import\s+\{([^}]+)\}\s+from\s+'\.\/([^']+)'/gm)) {
  const names = m[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
  const file = path.join(HERE, m[2]);
  assert.ok(fs.existsSync(file), `walang file na ${m[2]} na ini-import ng sidepanel.js`);
  const src = fs.readFileSync(file, 'utf8');
  for (const n of names) {
    assert.ok(
      new RegExp(`export\\s+(async\\s+)?(function|const|let|class)\\s+${n}\\b`).test(src) ||
        new RegExp(`export\\s*\\{[^}]*\\b${n}\\b`).test(src),
      `ini-import ang "${n}" mula sa ${m[2]} pero hindi ito naka-export doon`
    );
  }
}

console.log(`OK — ${ids.length} buton ang may handler, at tama lahat ng import`);
