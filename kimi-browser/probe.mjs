// BUMUBUO ng probe.html: ang markup ng sidepanel + isang chrome stub + isang script
// na pumipindot ng mga buton. Layunin: TOTOONG buksan ng Chrome ang sidepanel.js
// bilang ES module at pindutin ang mga handler na GAWA SA RUNTIME.
//
// Bakit ito kailangan gayong may 23 nang test: ang test-modules ay tumitingin ng
// syntax, at ang test-wiring ay tumitingin kung may naka-assign na handler. Wala
// sa dalawa ang makakahuli ng handler na na-assign pero pumuputok kapag pinindot,
// o ng buton na ginawa sa runtime (ang 🖌, ang ▸, ang mga file row). Tatlong beses
// nang naipadala ang blangkong panel dahil walang ganitong tseke.
//
// Paggamit (kailangan ng lokal na HTTP; ang file:// ay hindi kayang mag-dynamic import):
//   node probe.mjs
//   python -m http.server 8731
//   chrome --headless=new --virtual-time-budget=8000 --dump-dom http://localhost:8731/probe.html
// Hanapin ang <title>RESULT:{...}</title>.

import fs from 'node:fs';

const html = fs.readFileSync('sidepanel.html', 'utf8');
const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)[1].replace(/<script[\s\S]*?<\/script>/gi, '');
const style = (/<style[\s\S]*?<\/style>/i.exec(html) || [''])[0];

fs.writeFileSync(
  'probe.html',
  fs.readFileSync('probe-head.html', 'utf8') + style + body + fs.readFileSync('probe-tail.html', 'utf8')
);
console.log('probe.html handa — patakbuhin ang lokal na server at ang headless Chrome (tingnan ang komento sa itaas)');
