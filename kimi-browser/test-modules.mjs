import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// ANG ARAL NA NAGDULOT NG TEST NA ITO (v0.18.0 hanggang v0.20.0, tatlong bersyon):
// Naiwan ang lumang connectors block nang isulat ko muli ito, kaya naging DOBLE ang
// `mcpPing`. Sa ES module, ang doblehing deklarasyon ay SyntaxError — hindi tumatakbo
// ang BUONG file, kaya blangkong panel. Tatlong beses itong naipadala nang hindi
// nahuhuli dahil `node --check file.js` ay sumusuri bilang CommonJS, at doon ay LEGAL
// ang doblehing function. Ang extension ay module, kaya kailangang bilang module suriin.
//
// Ang test na ito ang bantay: bawat file na ginagamit bilang module ay sinusuri sa
// TAMANG mode. Kung maulit ang doble, dito ito babagsak, hindi sa mukha ng user.

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

// Lahat ng file na ini-import ng sidepanel.html, background.js, o ng isa't isa.
const MODULES = [
  'sidepanel.js', 'background.js', 'tools.js', 'page-fns.js',
  'hub.js', 'memory.js', 'docs.js', 'docx.js', 'pdf.js',
  'files.js', 'google.js', 'speech.js', 'history.js', 'collab.js', 'models.js',
];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dianna-mod-'));
let checked = 0;

for (const name of MODULES) {
  const src = path.join(HERE, name);
  if (!fs.existsSync(src)) continue; // opsyonal na file — huwag magpabagsak
  // Kinokopya bilang .mjs para PILITIN ang module semantics ng Node.
  const asModule = path.join(tmp, name.replace(/\.js$/, '.mjs'));
  fs.writeFileSync(asModule, fs.readFileSync(src));
  try {
    execFileSync(process.execPath, ['--check', asModule], { stdio: 'pipe' });
    checked++;
  } catch (e) {
    const msg = String(e.stderr || e.message);
    // Ang mensahe ng Node ay may linya at dahilan — ipasa nang buo, dito ito kapaki-pakinabang.
    assert.fail(`${name} ay hindi valid bilang ES module:\n${msg.split('\n').slice(0, 6).join('\n')}`);
  }
}

assert.ok(checked >= 12, `dapat nasuri ang lahat ng module (nasuri: ${checked})`);

// Dagdag na bantay: walang top-level na pangalan na nadodoble sa loob ng isang file.
// Nahuhuli na ito ng module check sa itaas, pero ang mensahe dito ay mas malinaw at
// tumuturo sa PAREHONG linya — iyon ang kailangan mo kapag inaayos.
for (const name of MODULES) {
  const src = path.join(HERE, name);
  if (!fs.existsSync(src)) continue;
  const lines = fs.readFileSync(src, 'utf8').split('\n');
  const seen = new Map();
  lines.forEach((line, i) => {
    // Top-level lang: walang indent sa simula.
    const m = /^(?:export\s+)?(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/.exec(line);
    if (!m) return;
    const id = m[1];
    if (seen.has(id)) {
      assert.fail(
        `${name}: doble ang top-level na "${id}" (linya ${seen.get(id) + 1} at ${i + 1}). ` +
          `Sa ES module ito ay SyntaxError at hindi tatakbo ang BUONG file.`
      );
    }
    seen.set(id, i);
  });
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`OK — ${checked} module ang valid, at walang doblehing top-level na deklarasyon`);
