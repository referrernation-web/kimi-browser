import { repairHistory } from './history.js';

const $ = (id) => document.getElementById(id);
const log = $('log');

// Ang usapan ay nakatira DITO. Namamatay ang service worker kapag tahimik;
// ang panel ay buhay habang bukas, kaya siya ang may hawak ng katotohanan.
let history = [];      // ang hugis-API na mensahe, para sa model
let transcript = [];   // ang nakikita ng tao, para maibalik pagkabukas muli

// Nagsasara rin ang panel. Isinusulat natin ang dalawa sa storage tuwing may nagbabago,
// kaya nagpapatuloy ang usapan kahit isarado mo ito o i-restart ang Chrome.
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(
    () => chrome.storage.local.set({ session: { history, transcript: transcript.slice(-300) } }),
    300
  );
}

async function restore() {
  const { session } = await chrome.storage.local.get('session');
  if (!session?.transcript?.length) return;
  history = session.history || [];
  transcript = session.transcript;
  for (const e of transcript) {
    if (e.t === 'think') addThinking(e.text, true);
    else if (e.t === 'table') addTable(e.title, e.columns, e.rows, true);
    else add(e.t, e.text, true);
  }
  add('tool', '— dating usapan, itinuloy —', true);
}

// Namamatay din ang port kasama ng service worker, kaya kinakabit ulit kapag kailangan.
let port = null;
function getPort() {
  if (port) return port;
  port = chrome.runtime.connect({ name: 'kimi' });
  port.onMessage.addListener(onMessage);
  port.onDisconnect.addListener(() => {
    port = null;
    if (!$('send').disabled) return; // walang tumatakbo — walang aayusin
    const healed = repairHistory(history);
    save();
    add('error', `Naputol ang koneksyon. Nakuha ang ${history.length} mensahe${healed ? ' (may naiwang hakbang)' : ''} — magpatuloy ka lang, tandaan pa rin niya ang nagawa na.`);
    $('send').disabled = false;
    $('send').textContent = '↑';
  });
  return port;
}

// --- settings: nabubuhay sa chrome.storage.local, hindi sa code ---
const HINTS = {
  manual: 'Nagtatanong bago ang bawat aksyon.',
  auto: 'Kusang kumikilos; nagtatanong pa rin sa hindi na maibabalik.',
  plan: 'Read-only. Nagbabasa at nagpaplano, hindi kumikilos.',
  coach: 'Nakikinig sa caption ng tawag at nagmumungkahi ng sagot. Walang ginagalaw.',
  bypass: 'Walang tanong kahit ano.',
};
const showHint = () => ($('hint').textContent = HINTS[$('mode').value]);

chrome.storage.local.get(['apiKey', 'model', 'mode']).then((d) => {
  $('key').value = d.apiKey || '';
  $('model').value = d.model || 'k3';
  $('mode').value = d.mode || 'manual';
  showHint();
});
$('key').onchange = () => chrome.storage.local.set({ apiKey: $('key').value.trim() });
$('model').onchange = () => chrome.storage.local.set({ model: $('model').value });
$('mode').onchange = () => {
  chrome.storage.local.set({ mode: $('mode').value });
  showHint();
};

function add(cls, text, replaying) {
  const el = document.createElement('div');
  el.className = `msg ${cls}`;
  el.textContent = text;
  log.append(el);
  log.scrollTop = log.scrollHeight;
  if (!replaying) {
    transcript.push({ t: cls, text });
    save();
  }
  return el;
}

// Ang pag-iisip ang pinakakawili-wiling bahagi, kaya makikita agad ang unang pangungusap;
// nasa loob ng details ang buo para hindi lumamon sa panel.
function addThinking(text, replaying) {
  if (!replaying) {
    transcript.push({ t: 'think', text });
    save();
  }
  const first = (text.match(/^[\s\S]{0,150}?[.!?](\s|$)/) || [text.slice(0, 150)])[0].trim();
  const d = document.createElement('details');
  d.className = 'think';
  const s = document.createElement('summary');
  s.textContent = first + (text.length > first.length ? ' …' : '');
  d.append(s, document.createTextNode(text));
  log.append(d);
  log.scrollTop = log.scrollHeight;
}

// Ang tool call bilang pangungusap, hindi bilang JSON.
const SAYS = {
  read_page: () => 'Binabasa ang page',
  screenshot: () => 'Tumitingin sa screen',
  listen: (a) => `Nakikinig (${a.seconds || 8}s)`,
  scroll: (a) => `Nag-scroll ${a.direction === 'up' ? 'pataas' : 'pababa'}`,
  click: (a) => `Pinipindot ang ${a.ref}`,
  type: (a) => `Isinusulat: "${String(a.text).slice(0, 40)}"`,
  navigate: (a) => `Pumupunta sa ${hostOf(a.url)}`,
  new_tab: (a) => `Bagong tab: ${hostOf(a.url)}`,
  close_tab: () => 'Isinasara ang tab',
  remember: (a) => `Tinatandaan: ${String(a.note).slice(0, 60)}`,
  collect: (a) => `Naitala ang ${a.count ?? ''} sa "${a.title}"`.replace('  ', ' '),
  _compact: (a) => `Nilinis ang konteksto (−${Math.round(a.saved / 1000)}k karakter)`,
  _capture: () => 'Nakikinig na sa tunog ng tab',
  list_tabs: () => 'Tinitingnan ang mga bukas na tab',
  switch_tab: () => 'Lumilipat ng tab',
};
const hostOf = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
};
const describe = (name, args) => (SAYS[name] ? SAYS[name](args || {}) : name);

// Isang pindutan-hilera na sumasagot sa background, tapos pinapalitan ang sarili
// ng napiling sagot para manatiling mababasa ang usapan.
function addChoice(id, titleText, detailText, choices, echo) {
  const box = document.createElement('div');
  box.className = detailText === null ? 'question' : 'confirm';

  const title = document.createElement('b');
  title.textContent = titleText;
  box.append(title);

  if (detailText !== null) {
    const d = document.createElement('div');
    d.className = 'tool';
    d.textContent = detailText;
    box.append(d);
  }

  const row = document.createElement('div');
  row.className = 'opts';
  row.style.marginTop = '6px';

  const answer = (value) => {
    getPort().postMessage({ type: 'reply', id, value });
    box.replaceChildren(
      Object.assign(document.createElement('div'), { className: 'tool', textContent: echo(value) })
    );
  };

  for (const [label, value] of choices) {
    const b = document.createElement('button');
    b.textContent = label;
    b.onclick = () => answer(value);
    row.append(b);
  }
  box.append(row);
  log.append(box);
  log.scrollTop = log.scrollHeight;
  return answer;
}

function addConfirm(id, tool, args) {
  addChoice(
    id,
    `Papayagan ang ${tool}?`,
    JSON.stringify(args),
    [
      ['Payagan', true],
      ['Huwag', false],
    ],
    (v) => `${tool} — ${v ? 'pinayagan' : 'tinanggihan'}`
  );
}

function addQuestion(id, question, options) {
  const answer = addChoice(
    id,
    question,
    null,
    options.map((o) => [o, o]).concat([['Iba pa…', '__other__']]),
    (v) => `sagot: ${v}`
  );
  // "Iba pa" ay nagbubukas ng prompt sa halip na magpadala ng sentinel.
  log.lastChild.querySelectorAll('button').forEach((b) => {
    if (b.textContent !== 'Iba pa…') return;
    b.onclick = () => {
      const t = window.prompt(question);
      if (t) answer(t);
    };
  });
}

// Ang mga nakolektang table, ayon sa pamagat — ang paulit-ulit na `collect` na may
// parehong pamagat ay nagdadagdag ng row sa halip na gumawa ng bagong table.
const tables = new Map();

function addTable(title, columns, rows, replaying) {
  let t = tables.get(title);
  if (t) {
    t.rows.push(...rows);
  } else {
    t = { title, columns, rows: [...rows], sort: null, el: null };
    tables.set(title, t);
  }
  if (!replaying) {
    transcript = transcript.filter((e) => !(e.t === 'table' && e.title === title));
    transcript.push({ t: 'table', title, columns: t.columns, rows: t.rows });
    save();
  }
  renderTable(t);
}

function renderTable(t) {
  const box = document.createElement('div');
  box.className = 'tablebox';

  const head = document.createElement('div');
  head.className = 'row';
  const h = document.createElement('b');
  h.style.flex = '1';
  h.textContent = `${t.title} (${t.rows.length})`;
  const csv = Object.assign(document.createElement('button'), { textContent: 'CSV' });
  const cp = Object.assign(document.createElement('button'), { textContent: 'Kopyahin' });
  csv.onclick = () => download(t);
  cp.onclick = () => copyTable(t, cp);
  head.append(h, csv, cp);

  const wrap = document.createElement('div');
  wrap.className = 'tablewrap';
  const table = document.createElement('table');

  const tr = document.createElement('tr');
  t.columns.forEach((c, i) => {
    const th = document.createElement('th');
    th.textContent = c + (t.sort?.i === i ? (t.sort.dir > 0 ? ' ▲' : ' ▼') : '');
    th.onclick = () => {
      const dir = t.sort?.i === i && t.sort.dir > 0 ? -1 : 1;
      t.sort = { i, dir };
      t.rows.sort((a, b) => cmp(a[i], b[i]) * dir);
      renderTable(t);
    };
    tr.append(th);
  });
  table.append(tr);

  for (const r of t.rows) {
    const row = document.createElement('tr');
    for (const cell of r) {
      const td = document.createElement('td');
      const s = String(cell ?? '');
      if (/^https?:\/\//.test(s)) {
        const a = document.createElement('a');
        a.href = s;
        a.target = '_blank';
        a.textContent = 'buksan';
        td.append(a);
      } else td.textContent = s;
      row.append(td);
    }
    table.append(row);
  }

  wrap.append(table);
  box.append(head, wrap);
  if (t.el) t.el.replaceWith(box);
  else log.append(box);
  t.el = box;
  log.scrollTop = log.scrollHeight;
}

// Ang "₱15,500" ay dapat mag-sort bilang 15500, hindi bilang teksto.
function cmp(a, b) {
  const na = parseFloat(String(a).replace(/[^\d.-]/g, ''));
  const nb = parseFloat(String(b).replace(/[^\d.-]/g, ''));
  if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
  return String(a).localeCompare(String(b));
}

const toCSV = (t) =>
  [t.columns, ...t.rows]
    .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

function download(t) {
  const url = URL.createObjectURL(new Blob(['﻿' + toCSV(t)], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = t.title.replace(/[^\w-]+/g, '-').toLowerCase() + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

async function copyTable(t, btn) {
  // Tab-separated: dumidikit ito nang maayos sa Excel, Sheets, at Messenger.
  const text = [t.columns, ...t.rows].map((r) => r.join('\t')).join('\n');
  await navigator.clipboard.writeText(text);
  btn.textContent = 'Nakopya ✓';
  setTimeout(() => (btn.textContent = 'Kopyahin'), 1500);
}

function onMessage(m) {
  switch (m.type) {
    case 'thinking':
      return addThinking(m.text);
    case 'assistant':
      return void add('assistant', m.text);
    case 'tool':
      return void add('tool', describe(m.name, m.args));
    case 'tool_result':
      // Ang tagumpay ay tahimik — ang bawat "ok" ay ingay lang. Ang pagkabigo lang ang nagsasalita.
      if (!m.result?.error) return;
      return void add('error', `Hindi natuloy ang ${describe(m.name, m.args).toLowerCase()}: ${m.result.error}`);
    case 'confirm':
      return addConfirm(m.id, m.tool, m.args);
    case 'question':
      return addQuestion(m.id, m.question, m.options);
    case 'error':
      return void add('error', m.text);
    case 'heard':
      return void add('tool', `🔊 ${m.text}`);
    case 'capture-off':
      $('tap').classList.remove('on');
      return;
    case 'shot': {
      // Ipinapakita rin sa tao ang nakita niya — kung hindi, hulaan mo kung ano ang tiningnan.
      const el = add('tool', 'Tumingin sa screen');
      const im = document.createElement('img');
      im.src = m.image;
      el.append(im);
      return;
    }
    case 'table':
      return addTable(m.title, m.columns, m.rows);
    case 'msg':
      history.push(m.message);
      return save();
    case 'done':
      $('send').disabled = false;
      $('send').textContent = '↑';
  }
}

// --- mga larawang idinikit ---
// Ang hilaw na screenshot ay 2-4 MB bilang base64. Pinapaliit natin bago ipadala:
// 1280px ang pinakamalaki at JPEG 0.8 — nababasa pa rin ang teksto sa screenshot,
// pero ~15x na mas maliit. Kung hindi, isang paste ay kakain ng kalahating konteksto.
const MAX_SIDE = 1280;
let attachments = [];

function shrink(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('Hindi mabuksan ang larawan.'));
    img.onload = () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.src = URL.createObjectURL(file);
  });
}

function drawThumbs() {
  $('thumbs').replaceChildren(
    ...attachments.map((url, i) => {
      const d = document.createElement('div');
      d.className = 'thumb';
      const im = document.createElement('img');
      im.src = url;
      const x = document.createElement('button');
      x.textContent = '×';
      x.title = 'Alisin';
      x.onclick = () => {
        attachments.splice(i, 1);
        drawThumbs();
      };
      d.append(im, x);
      return d;
    })
  );
}

async function attach(files) {
  for (const f of files) {
    if (!f.type.startsWith('image/')) continue;
    try {
      attachments.push(await shrink(f));
    } catch (e) {
      add('error', e.message);
    }
  }
  drawThumbs();
}

$('ask').addEventListener('paste', (e) => {
  const files = [...e.clipboardData.items].filter((i) => i.kind === 'file').map((i) => i.getAsFile());
  if (!files.length) return;
  e.preventDefault(); // kung hindi, idinidikit ng Chrome ang pangalan ng file bilang teksto
  attach(files);
});
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  attach(e.dataTransfer.files);
});

function submit() {
  const text = $('ask').value.trim();
  if (!text && !attachments.length) return;

  // Ang pinakamadalas na paraan ng pagkasira: nagtanong siya, hindi ka pumindot ng sagot,
  // nagtype ka na lang. Ang naiwang tool_call na walang sagot ay tinatanggihan ng API
  // magpakailanman. Nililinis natin ito sa BAWAT pagpapadala, hindi lang kapag nadiskonekta.
  if (repairHistory(history, 'Hindi ito sinagot ng user; nagpadala siya ng bagong mensahe sa ibaba.')) {
    log.querySelectorAll('.question button').forEach((b) => (b.disabled = true));
  }

  const el = add('user', text);
  for (const url of attachments) {
    const im = document.createElement('img');
    im.src = url;
    el.append(im);
  }

  // Ang multimodal na mensahe ay array ng bahagi; ang purong teksto ay string pa rin,
  // para hindi tayo magpadala ng array kung saan sapat na ang isang linya.
  history.push({
    role: 'user',
    content: attachments.length
      ? [
          { type: 'text', text: text || 'Ano ang nasa larawang ito?' },
          ...attachments.map((url) => ({ type: 'image_url', image_url: { url } })),
        ]
      : text,
  });

  attachments = [];
  drawThumbs();
  $('ask').value = '';
  $('send').disabled = true;
  $('send').textContent = '…';
  getPort().postMessage({ type: 'ask', history });
}

// --- tenga sa mikropono: libre, nasa Chrome na, walang API key ---
// Mikropono ito, hindi tab audio — kaya kailangang naka-speaker ang tawag para marinig
// ang kabilang panig. Ipinapadala ang narinig sa background, at ibinibigay ito sa
// susunod na `listen` ng agent. Hindi ito nagre-record: teksto lang ang naiipon.
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;

function toggleMic() {
  if (!SR) {
    add('error', 'Walang Web Speech API ang browser na ito.');
    return;
  }
  if (rec) {
    rec.__off = true; // para hindi ito kusang mag-restart
    rec.stop();
    return;
  }

  rec = new SR();
  rec.continuous = true;
  rec.interimResults = false;
  rec.lang = navigator.language?.startsWith('tl') ? 'tl-PH' : 'en-US';

  rec.onresult = (e) => {
    let text = '';
    for (let i = e.resultIndex; i < e.results.length; i++)
      if (e.results[i].isFinal) text += e.results[i][0].transcript + ' ';
    text = text.trim();
    if (!text) return;
    add('tool', `🎤 ${text}`);
    getPort().postMessage({ type: 'mic', text });
  };
  // May mga error na panandalian at may mga PATAY NA. Kung hindi ito paghihiwalayin,
  // ang not-allowed ay magpapaikot nang walang katapusan: error → onend → restart → error.
  const FATAL = new Set(['not-allowed', 'service-not-allowed', 'audio-capture']);

  rec.onerror = (e) => {
    if (e.error === 'no-speech') return; // karaniwan sa katahimikan, hindi ito sira
    if (!FATAL.has(e.error)) {
      add('error', `Mikropono: ${e.error}`);
      return;
    }
    rec.__off = true; // huwag nang subukan muli
    add('error', 'Walang pahintulot sa mikropono. Bubuksan ko ang page na hihingi nito.');
    chrome.tabs.create({ url: chrome.runtime.getURL('mic-permission.html') });
  };
  rec.onend = () => {
    // Kusang humihinto ang Chrome tuwing ilang sandali. Binubuksan natin ulit
    // maliban kung ikaw ang pumatay — kung hindi, tumitigil ito sa gitna ng tawag.
    if (rec?.__off) {
      rec = null;
      $('mic').classList.remove('on');
      add('tool', '🎤 tumigil');
      return;
    }
    try {
      rec.start();
    } catch {}
  };

  try {
    rec.start();
    $('mic').classList.add('on');
    add('tool', '🎤 nakikinig — ilagay sa speaker ang tawag para marinig ang kabila');
  } catch (e) {
    rec = null;
    add('error', `Hindi mabuksan ang mikropono: ${e.message}`);
  }
}

$('mic').onclick = toggleMic;

// --- tunog ng tab → Groq Whisper ---
// Hinihingi ang key dito, hindi sa code. Ang unang pindot ay nagtatanong kung wala pa.
$('tap').onclick = async () => {
  if ($('tap').classList.contains('on')) {
    getPort().postMessage({ type: 'capture', on: false });
    $('tap').classList.remove('on');
    add('tool', '🔊 tumigil');
    return;
  }
  const { groqKey } = await chrome.storage.local.get('groqKey');
  if (!groqKey) {
    const k = window.prompt('Groq API key (gsk_...) — nasa chrome.storage lang ito, hindi sa code:');
    if (!k) return;
    await chrome.storage.local.set({ groqKey: k.trim() });
  }
  getPort().postMessage({ type: 'capture', on: true });
  $('tap').classList.add('on');
  add('tool', '🔊 kinukuha ang tunog ng tab — maririnig mo pa rin ito');
};

$('new').onclick = () => {
  history = [];
  transcript = [];
  log.replaceChildren();
  chrome.storage.local.remove('session');
};

// Ang natutunan niya, nakikita at nabubura. Ang memory na hindi mo makita ay
// memory na hindi mo mapagkakatiwalaan.
$('mem').onclick = async () => {
  const { load, forget } = await import('./memory.js');
  const mem = await load();
  const rows = [
    ...mem.user.map((s, i) => ['user', i, '', s]),
    ...Object.entries(mem.sites).flatMap(([d, xs]) => xs.map((s, i) => ['site', i, d, s])),
  ];
  const box = document.createElement('div');
  box.className = 'confirm';
  const b = document.createElement('b');
  b.textContent = rows.length ? `Natutunan niya (${rows.length})` : 'Wala pa siyang natutunan.';
  box.append(b);
  for (const [scope, i, domain, text] of rows) {
    const row = document.createElement('div');
    row.className = 'row';
    row.style.marginTop = '4px';
    const t = document.createElement('span');
    t.className = 'dim';
    t.style.flex = '1';
    t.textContent = (domain ? `${domain}: ` : 'ikaw: ') + text;
    const x = document.createElement('button');
    x.textContent = '×';
    x.onclick = async () => {
      await forget(scope, i, domain);
      row.remove();
    };
    row.append(t, x);
    box.append(row);
  }
  log.append(box);
  log.scrollTop = log.scrollHeight;
};

$('send').onclick = submit;
restore();
$('ask').onkeydown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    submit();
  }
};
