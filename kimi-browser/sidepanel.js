import { repairHistory } from './history.js';

const $ = (id) => document.getElementById(id);
const log = $('log');

// ===== SESSIONS =====
// Bawat session: { id, title, history, transcript, createdAt }.
// Ang history ay ang hugis-API na mensahe para sa model; ang transcript ay ang
// nakikita ng tao. Parehong nakatira DITO sa panel — ang background ay stateless,
// kaya kahit mamatay ang service worker, buo ang lahat.
let sessions = [];
let activeId = null;

const runsById = new Map();       // runId -> sessionId (para maroute ang events)
const activeRuns = new Set();     // runId ng mga tumatakbong gawain
const unread = new Set();         // sessionId na may bagong update habang hindi aktibo
const pendingPrompts = new Map(); // sessionId -> [{ kind:'question'|'confirm', id, ... }]
const streams = new Map();        // runId -> { a, t, slots, elA, elT } para sa streaming

const uid = () =>
  crypto.randomUUID?.() || 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const active = () => sessions.find((s) => s.id === activeId);

// --- save/load ---
// Ang mga larawan ay hindi isinasave sa storage (10MB lang ang quota) — nananatili
// lang sila sa memory habang bukas ang panel.
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const stripped = sessions.map((s) => ({
      ...s,
      transcript: s.transcript.slice(-300),
      history: s.history.map(stripImages),
    }));
    chrome.storage.local.set({ sessions: stripped, activeSessionId: activeId });
  }, 300);
}

function stripImages(m) {
  if (!Array.isArray(m.content)) return m;
  return {
    ...m,
    content: m.content.map((p) => (p.type === 'image_url' ? { type: 'text', text: '[larawan]' } : p)),
  };
}

async function loadSessions() {
  const d = await chrome.storage.local.get(['sessions', 'activeSessionId']);
  sessions = d.sessions || [];
  activeId = d.activeSessionId;
  if (!sessions.length) {
    sessions = [{ id: uid(), title: 'Bagong usapan', history: [], transcript: [], createdAt: Date.now() }];
    activeId = sessions[0].id;
  }
  if (!sessions.some((s) => s.id === activeId)) activeId = sessions[0].id;
}

function newSession() {
  const s = { id: uid(), title: 'Bagong usapan', history: [], transcript: [], createdAt: Date.now() };
  sessions.push(s);
  activeId = s.id;
  renderTabs();
  renderLog();
  save();
  $('ask').focus();
}

function closeSession(id) {
  const i = sessions.findIndex((s) => s.id === id);
  if (i < 0) return;
  // Kung may tumatakbo sa session na ito, ipahinto muna bago isara.
  for (const [, sid] of runsById) if (sid === id) getPort().postMessage({ type: 'stop' });
  sessions.splice(i, 1);
  pendingPrompts.delete(id);
  unread.delete(id);
  if (!sessions.length) return newSession();
  if (activeId === id) {
    activeId = sessions[Math.max(0, i - 1)].id;
    renderLog();
  }
  renderTabs();
  save();
}

function setActive(id) {
  if (activeId === id) return;
  activeId = id;
  unread.delete(id);
  renderTabs();
  renderLog();
  save();
  // I-render ulit ang mga pending na tanong/pahintulot para maisagot ng user.
  for (const p of pendingPrompts.get(id) || []) {
    if (p.kind === 'question') addQuestion(p.id, p.question, p.options);
    else addConfirm(p.id, p.tool, p.args);
  }
}

// --- TAB STRIP: pahalang, nai-drag para mag-reorder ---
function renderTabs() {
  const strip = $('tabstrip');
  const running = new Set(runsById.values());
  strip.replaceChildren(
    ...sessions.map((s) => {
      const el = document.createElement('div');
      el.className = 'tab' + (s.id === activeId ? ' active' : '');
      el.draggable = true;

      const t = document.createElement('span');
      t.className = 't';
      t.textContent = s.title;
      t.title = s.title;
      el.append(t);

      if (running.has(s.id)) {
        const d = document.createElement('span');
        d.className = 'dot';
        d.title = 'Tumatakbo ang agent dito';
        el.append(d);
      } else if (unread.has(s.id)) {
        const d = document.createElement('span');
        d.className = 'unread';
        d.title = 'May bagong update';
        el.append(d);
      }

      const x = document.createElement('button');
      x.textContent = '×';
      x.title = 'Isara ang usapang ito';
      x.onclick = (e) => {
        e.stopPropagation();
        closeSession(s.id);
      };
      el.append(x);

      el.onclick = () => setActive(s.id);

      // Drag left-right para mag-reorder, tulad ng sa Claude.
      el.ondragstart = (e) => {
        e.dataTransfer.setData('text/plain', s.id);
        e.dataTransfer.effectAllowed = 'move';
        el.classList.add('dragging');
      };
      el.ondragend = () => el.classList.remove('dragging');
      el.ondragover = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        el.classList.add('dragover');
      };
      el.ondragleave = () => el.classList.remove('dragover');
      el.ondrop = (e) => {
        e.preventDefault();
        el.classList.remove('dragover');
        const from = e.dataTransfer.getData('text/plain');
        if (!from || from === s.id) return;
        const fi = sessions.findIndex((q) => q.id === from);
        const ti = sessions.findIndex((q) => q.id === s.id);
        if (fi < 0 || ti < 0) return;
        sessions.splice(ti, 0, sessions.splice(fi, 1)[0]);
        renderTabs();
        save();
      };
      return el;
    })
  );
}
$('tabstrip').onwheel = (e) => {
  if (!e.deltaY) return;
  $('tabstrip').scrollLeft += e.deltaY;
  e.preventDefault();
};
$('newtab').onclick = newSession;

// --- LOG RENDERING ---
function renderLog() {
  log.replaceChildren();
  for (const t of tables.values()) t.el = null; // ang lumang nodes ay burado na
  const s = active();
  if (!s) return;
  for (const e of s.transcript) renderEntry(e);
  log.scrollTop = log.scrollHeight;
}

function renderEntry(e) {
  if (e.t === 'think') addThinking(e.text);
  else if (e.t === 'table') addTable(e.title, e.columns, e.rows, true, active());
  else if (e.t === 'audit') addAudit(e.text, e.model, e.worker);
  else if (e.t === 'vote') addVote(e.avg, e.pass, e.n);
  else if (e.t === 'plan') addPlan(e.steps, e.done);
  else add(e.t, e.text, e.model);
}

// --- PLAN CHECKLIST: ang plano ng agent bilang umuusad na checklist ---
function addPlan(steps = [], done = 0) {
  const box = document.createElement('div');
  box.className = 'planbox';
  const b = document.createElement('b');
  b.textContent = `📋 PLANO — ${Math.min(done, steps.length)} sa ${steps.length} tapos`;
  const ol = document.createElement('ol');
  steps.forEach((s, i) => {
    const li = document.createElement('li');
    const st = document.createElement('span');
    st.className = 'st ' + (i < done ? 'done' : i === done ? 'doing' : 'todo');
    st.textContent = i < done ? '✓' : i === done ? '▸' : '○';
    const tx = document.createElement('span');
    tx.textContent = s;
    if (i !== done) li.className = 'gray';
    li.append(st, tx);
    ol.append(li);
  });
  const bar = document.createElement('div');
  bar.className = 'planbar';
  const fill = document.createElement('i');
  fill.style.width = steps.length ? `${Math.round((Math.min(done, steps.length) / steps.length) * 100)}%` : '0%';
  bar.append(fill);
  box.append(b, ol, bar);
  log.append(box);
  log.scrollTop = log.scrollHeight;
}

// Isang planbox lang kada gawain: kapag tumawag ulit ang model ng `plan`, ang HULING
// plan entry sa transcript ang ina-update — hindi nagdadagdag ng bagong box.
function planUpdate(sess, args) {
  const steps = (args.steps || []).map(String).slice(0, 8);
  const done = Math.max(0, Math.round(args.done || 0));
  const last = [...sess.transcript].reverse().find((e) => e.t === 'plan');
  if (last) {
    last.steps = steps;
    last.done = done;
    save();
    if (sess.id === activeId) renderLog();
  } else {
    emit(sess, { t: 'plan', steps, done });
  }
}

// Itala ang entry sa session (aktibo man o hindi), tapos i-render kung aktibo.
function emit(sess, entry) {
  sess.transcript.push(entry);
  if (sess.transcript.length > 300) sess.transcript.shift();
  save();
  if (sess.id === activeId) renderEntry(entry);
  else {
    unread.add(sess.id);
    renderTabs();
  }
}

function add(cls, text, model) {
  const el = document.createElement('div');
  el.className = `msg ${cls}`;
  // Transparency: ang bawat sagot ay may model tag — alam mo kung sino ang nagsasalita.
  if (model && cls === 'assistant') {
    const b = document.createElement('div');
    b.className = 'modeltag';
    b.textContent = model;
    el.append(b);
  }
  el.append(document.createTextNode(text));
  log.append(el);
  log.scrollTop = log.scrollHeight;
  return el;
}

// Ang pag-iisip ang pinakakawili-wiling bahagi, kaya makikita agad ang unang pangungusap;
// nasa loob ng details ang buo para hindi lumamon sa panel.
function addThinking(text) {
  const first = (text.match(/^[\s\S]{0,150}?[.!?](\s|$)/) || [text.slice(0, 150)])[0].trim();
  const d = document.createElement('details');
  d.className = 'think';
  const s = document.createElement('summary');
  s.textContent = first + (text.length > first.length ? ' …' : '');
  d.append(s, document.createTextNode(text));
  log.append(d);
  log.scrollTop = log.scrollHeight;
}

// --- PORT: namamatay kasama ng service worker, kaya kinakabit ulit kapag kailangan ---
let port = null;
function getPort() {
  if (port) return port;
  port = chrome.runtime.connect({ name: 'kimi' });
  port.onMessage.addListener(onMessage);
  port.onDisconnect.addListener(() => {
    port = null;
    if (!activeRuns.size) return; // walang tumatakbo — walang aayusin
    // Namatay ang background sa gitna ng trabaho. Ayusin ang LAHAT ng session,
    // hindi lang ang aktibo — baka sa iba tumatakbo.
    let healedAny = false;
    for (const s of sessions) healedAny = repairHistory(s.history) || healedAny;
    activeRuns.clear();
    runsById.clear();
    pendingPrompts.clear();
    save();
    updateSend();
    renderTabs();
    const s = active();
    if (s)
      emit(s, {
        t: 'error',
        text: `Naputol ang koneksyon${healedAny ? ' (may naayos na naiwang hakbang)' : ''} — magpatuloy ka lang, tandaan pa rin niya ang nagawa na.`,
      });
  });
  return port;
}

// --- SETTINGS: nabubuhay sa chrome.storage.local, hindi sa code ---
const HINTS = {
  adaptive: 'Nagtatanong sa unang beses ng bawat aksyon, tapos tiwala na sa buong gawain.',
  manual: 'Nagtatanong bago ang bawat aksyon.',
  auto: 'Kusang kumikilos; nagtatanong pa rin sa hindi na maibabalik.',
  plan: 'Read-only. Nagbabasa at nagpaplano, hindi kumikilos.',
  coach: 'Nakikinig sa caption ng tawag at nagmumungkahi ng sagot. Walang ginagalaw.',
  bypass: 'Walang tanong kahit ano.',
};
const showHint = () => ($('hint').textContent = HINTS[$('mode').value]);

let ttsOn = false;
let soundOn = true;

// --- PROVIDERS: Kimi, Alibaba Token Plan, DashScope, o kahit anong OpenAI-compatible ---
// Bawat provider ay may sariling naka-save na API key — hindi nagtatapon ng key
// kapag nagpapalipat-lipat ka.
const PROVIDERS = {
  kimi: {
    keyHint: 'Kimi API key (sk-kimi-...)',
    models: ['k3', 'k3-256k'],
  },
  groq: {
    keyHint: 'Groq API key (gsk_...)',
    // Fallback lang ito — ang totoong listahan ay kinukuha nang live sa /models.
    models: ['moonshotai/kimi-k2-instruct', 'llama-3.3-70b-versatile'],
  },
  tokenplan: {
    keyHint: 'Token Plan API key (sk-...)',
    models: [
      'qwen3.8-max',
      'qwen3.7-max',
      'qwen3.7-plus',
      'qwen3.6-flash',
      'glm-5.2',
      'deepseek-v4-pro',
      'deepseek-v4-flash-0731',
    ],
  },
  dashscope: {
    keyHint: 'DashScope API key (sk-...)',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen3-235b-a22b-instruct', 'qwen-vl-max'],
  },
  custom: { keyHint: 'API key', models: [] },
};
let curProvider = 'kimi';
let apiKeys = {}; // { kimi: '...', groq: '...', tokenplan: '...', dashscope: '...', custom: '...' }

// --- LIVE MODEL LIST: ang totoong /models ng provider, hindi hardcoded na listahan ---
// Ang mga model name ay nagbabago kada buwan; ang /models endpoint ang katotohanan.
// Ang OpenAI-compatible na provider ay may GET /models sa tabi ng /chat/completions.
const CHAT_URLS = {
  kimi: 'https://api.kimi.com/coding/v1/chat/completions',
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  tokenplan: 'https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions',
  dashscope: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
};

async function refreshModels(p) {
  const chat = p === 'custom' ? $('baseurl').value.trim() : CHAT_URLS[p];
  const key = apiKeys[p] || '';
  const url = (chat || '').replace(/\/chat\/completions\/?$/, '/models');
  if (!key || !url || url === chat) return null;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    if (!res.ok) return null; // hindi lahat ng provider ay may /models — hayaan ang fallback
    const ids = (((await res.json()).data) || []).map((m) => m.id).filter(Boolean).sort();
    if (!ids.length) return null;
    (PROVIDERS[p] ||= { keyHint: 'API key', models: [] }).models = ids;
    if (p === curProvider) fillModels(true);
    if (p === $('auditprovider').value) fillAModels(true);
    return ids.length; // para masabi ng "I-test" kung gumagana ang key
  } catch {
    return null; // ang suggestions ay palamuti — hindi dapat makasira
  }
}

function fillModels(keepValue = false) {
  const list = PROVIDERS[curProvider]?.models || [];
  $('models').replaceChildren(...list.map((m) => Object.assign(document.createElement('option'), { value: m })));
  if (!keepValue && list.length && !list.includes($('model').value)) {
    $('model').value = list[0];
    chrome.storage.local.set({ model: $('model').value });
  }
}

// Ang auditor ay may sariling provider at model — at ginagamit ang key na naka-save
// para sa provider na iyon, kaya walang bagong key na kailangan ilagay.
let auditOn = false;

function fillAModels(keepValue = false) {
  const p = $('auditprovider').value;
  const list = PROVIDERS[p]?.models || [];
  $('amodels').replaceChildren(...list.map((m) => Object.assign(document.createElement('option'), { value: m })));
  if (!keepValue && list.length && !list.includes($('auditmodel').value)) {
    $('auditmodel').value = list[0];
    chrome.storage.local.set({ auditModel: $('auditmodel').value });
  }
}

chrome.storage.local
  .get(['apiKey', 'apiKeys', 'provider', 'model', 'customUrl', 'mode', 'tts', 'sound', 'autopilot', 'theme',
        'audit', 'auditProvider', 'auditModel', 'groqKey', 'teach'])
  .then((d) => {
    apiKeys = d.apiKeys || {};
    // Migration: ang lumang single apiKey ay para sa Kimi; ang groqKey ng Whisper
    // capture ay doble-gamit bilang chat key ng Groq.
    if (d.apiKey && !apiKeys.kimi) apiKeys.kimi = d.apiKey;
    if (d.groqKey && !apiKeys.groq) apiKeys.groq = d.groqKey;
    curProvider = d.provider || 'kimi';
    $('provider').value = curProvider;
    $('key').value = apiKeys[curProvider] || '';
    $('key').placeholder = PROVIDERS[curProvider].keyHint;
    $('model').value = d.model || 'k3';
    $('baseurl').value = d.customUrl || '';
    $('baseurl').style.display = curProvider === 'custom' ? '' : 'none';
    fillModels(true);
    $('mode').value = d.mode || 'adaptive';
    ttsOn = !!d.tts;
    soundOn = d.sound !== false;
    $('tts').classList.toggle('on', ttsOn);
    $('sound').classList.toggle('on', soundOn);
    $('pilot').classList.toggle('on', !!d.autopilot);
    $('teach').classList.toggle('on', !!d.teach);
    // Auditor settings
    auditOn = !!d.audit;
    $('audit').classList.toggle('on', auditOn);
    $('auditrow').style.display = auditOn ? '' : 'none';
    $('auditprovider').value = d.auditProvider || 'tokenplan';
    $('auditmodel').value = d.auditModel || 'qwen3.8-max';
    fillAModels(true);
    // Puti ang default — dark lang kapag pinili ng user
    document.body.dataset.theme = d.theme || 'light';
    $('theme').textContent = document.body.dataset.theme === 'dark' ? '☀' : '☾';
    syncChip();
    syncMenuDot();
    showHint();
    // Unang bukas na walang key: 3-hakbang na setup card, hindi error message.
    if (!$('key').value) addSetupCard();
  });

// --- ONBOARDING: ang unang karanasan ay gabay, hindi "Walang API key" na error ---
const PROVIDER_LABELS = { kimi: 'Kimi', groq: 'Groq ⚡', tokenplan: 'Token Plan', dashscope: 'Qwen', custom: 'Custom' };

function addSetupCard() {
  if (log.querySelector('.setup')) return;
  const srow = (n) => {
    const d = document.createElement('div');
    d.className = 'srow';
    const nn = document.createElement('span');
    nn.className = 'n';
    nn.textContent = n;
    d.append(nn);
    return d;
  };
  const card = document.createElement('div');
  card.className = 'setup';
  const b = document.createElement('b');
  b.textContent = 'Maligayang pagdating! 3 hakbang lang bago tayo umandar:';
  card.append(b);

  const r2 = srow(2); // ginagamit ng chips ng hakbang 1, kaya buo na agad
  const kin = document.createElement('input');
  kin.type = 'password';
  kin.placeholder = PROVIDERS[curProvider].keyHint;
  kin.style.flex = '1';
  const test = document.createElement('button');
  test.className = 'try';
  test.textContent = 'I-test';
  test.onclick = async () => {
    apiKeys[curProvider] = kin.value.trim();
    await chrome.storage.local.set({ apiKeys });
    $('key').value = kin.value.trim();
    test.textContent = '…';
    const n = await refreshModels(curProvider);
    test.textContent = n ? `✓ ${n} model` : '✗ subukan ulit';
  };
  r2.append(kin, test);

  const r1 = srow(1);
  for (const [p, label] of Object.entries(PROVIDER_LABELS)) {
    const c = document.createElement('button');
    c.className = 'provchip' + (p === curProvider ? ' sel' : '');
    c.textContent = label;
    c.onclick = () => {
      $('provider').value = p;
      $('provider').onchange();
      for (const x of r1.querySelectorAll('.provchip')) x.classList.toggle('sel', x === c);
      kin.placeholder = PROVIDERS[p].keyHint;
      kin.value = apiKeys[p] || '';
    };
    r1.append(c);
  }

  const r3 = srow(3);
  for (const t of ['Buksan ang google.com', 'Basahin ang page na ito']) {
    const c = document.createElement('button');
    c.className = 'try';
    c.textContent = t;
    c.onclick = () => {
      $('ask').value = t;
      $('ask').focus();
    };
    r3.append(c);
  }

  card.append(r1, r2, r3);
  log.append(card);
}

// --- ⚙ SETTINGS at ⋯ MENU: nakatago hanggang kailangan (malinis na panel) ---
$('gear').onclick = () => {
  const open = $('settings').style.display === 'none';
  $('settings').style.display = open ? 'grid' : 'none';
  if (open) {
    // I-refresh ang totoong model list ng worker at auditor habang bukas ang settings.
    refreshModels(curProvider);
    if ($('auditprovider').value !== curProvider) refreshModels($('auditprovider').value);
  }
};
$('menubtn').onclick = (e) => {
  e.stopPropagation();
  const open = $('menu').style.display === 'none';
  $('menu').style.display = open ? 'grid' : 'none';
};
document.addEventListener('click', (e) => {
  if (!$('menu').contains(e.target) && e.target !== $('menubtn')) $('menu').style.display = 'none';
});
// Violet border sa ⋯ kapag may naka-ong feature para kita agad.
const syncMenuDot = () =>
  $('menubtn').classList.toggle(
    'has-on',
    $('audit').classList.contains('on') ||
      $('pilot').classList.contains('on') ||
      $('teach').classList.contains('on')
  );

// Ang model chip sa header — laging kita kung sino ang worker ngayon.
const syncChip = () => ($('modelchip').textContent = $('model').value || 'model');

$('provider').onchange = () => {
  curProvider = $('provider').value;
  chrome.storage.local.set({ provider: curProvider });
  $('key').value = apiKeys[curProvider] || '';
  $('key').placeholder = PROVIDERS[curProvider].keyHint;
  $('baseurl').style.display = curProvider === 'custom' ? '' : 'none';
  fillModels(); // kapag lumipat ng provider, i-suggest ang unang model nito
  refreshModels(curProvider); // tapos palitan ng totoong listahan mula sa /models
  syncChip();
};
$('key').onchange = () => {
  apiKeys[curProvider] = $('key').value.trim();
  chrome.storage.local.set({ apiKeys });
  refreshModels(curProvider); // bagong key — baka bukas na ang /models
};
$('testkey').onclick = async () => {
  apiKeys[curProvider] = $('key').value.trim();
  await chrome.storage.local.set({ apiKeys });
  $('testkey').textContent = '…';
  const n = await refreshModels(curProvider);
  $('testkey').textContent = n ? `✓ ${n}` : '✗';
  setTimeout(() => ($('testkey').textContent = 'I-test'), 4000);
};
$('model').onchange = () => {
  chrome.storage.local.set({ model: $('model').value.trim() });
  syncChip();
};
$('baseurl').onchange = () => chrome.storage.local.set({ customUrl: $('baseurl').value.trim() });
$('mode').onchange = () => {
  chrome.storage.local.set({ mode: $('mode').value });
  showHint();
};

// --- MGA TUNOG: Web Audio lang, walang files, walang key ---
let audioCtx = null;
function chime(kind) {
  if (!soundOn) return;
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const notes =
      kind === 'done'
        ? [[660, 0, 0.12], [880, 0.13, 0.18]]
        : kind === 'ask'
          ? [[523, 0, 0.13], [523, 0.17, 0.13]]
          : [[196, 0, 0.28]];
    for (const [freq, at, dur] of notes) {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      const t0 = audioCtx.currentTime + at;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.15, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(audioCtx.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    }
  } catch {}
}

$('sound').onclick = () => {
  soundOn = !soundOn;
  $('sound').classList.toggle('on', soundOn);
  chrome.storage.local.set({ sound: soundOn });
};

// --- TTS: binabasa nang malakas ang mga sagot ---
function speak(text, then) {
  if (!ttsOn || !text) {
    then?.();
    return;
  }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[*#`_]/g, '').slice(0, 1200));
  u.lang = navigator.language?.startsWith('tl') ? 'tl-PH' : 'en-US';
  u.onend = () => then?.();
  u.onerror = () => then?.();
  speechSynthesis.speak(u);
}

function maybeSpeak(text) {
  speak(text, () => {
    // Conversation mode: pagkatapos magsalita, makinig ulit — tuloy-tuloy na usapan.
    if (voiceConvo && !activeRuns.size && !dictateRec) startDictate();
  });
}

$('tts').onclick = () => {
  ttsOn = !ttsOn;
  $('tts').classList.toggle('on', ttsOn);
  chrome.storage.local.set({ tts: ttsOn });
  if (!ttsOn) speechSynthesis.cancel();
};

// Ang tool call bilang pangungusap, hindi bilang JSON.
const SAYS = {
  read_page: () => 'Binabasa ang page',
  screenshot: () => 'Tumitingin sa screen',
  generate_image: (a) => `Gumagawa ng larawan: "${String(a.prompt).slice(0, 50)}"`,
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
  list_tabs: () => 'Tinitingnan ang mga tab sa group',
  switch_tab: () => 'Lumilipat ng working tab',
  read_console: () => 'Binabasa ang console ng page',
  paste_large: (a) => `Nagpa-paste ng ${String(a.text || '').length} karakter`,
  run_shortcut: (a) => `Pinapatakbo ang shortcut na "${a.name}"`,
  schedule_task: () => 'Nag-iiskedyul ng gawain',
  _autopilot: (a) => `🛩 Nagpapatuloy (${a.chains}/5): ${String(a.next).slice(0, 60)}`,
  _escalate: (a) => `Lumipat sa mas malakas na model — ${a.why}`,
  _audit: (a) => `🗳 Sinusuri nina ${a.model} ang sagot…`,
  _midcheck: (a) => `🧐 Second brain: ${a.note}`,
};
const hostOf = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
};
const describe = (name, args) => (SAYS[name] ? SAYS[name](args || {}) : name);

// --- PENDING PROMPTS: para mabuhay ang tanong kahit lumipat ka ng session ---
function trackPending(sid, p) {
  const arr = pendingPrompts.get(sid) || [];
  arr.push(p);
  pendingPrompts.set(sid, arr);
}
function untrackPending(id) {
  for (const [sid, arr] of pendingPrompts) pendingPrompts.set(sid, arr.filter((p) => p.id !== id));
}

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
    untrackPending(id);
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

// --- MGA TABLE: ang paulit-ulit na `collect` na may parehong pamagat ay nagdadagdag
// ng row sa halip na gumawa ng bagong table. Per-session ang mga ito.
const tables = new Map(); // key: `${sessId}::${title}`

function addTable(title, columns, rows, replaying, sess = active()) {
  const key = `${sess.id}::${title}`;
  let t = tables.get(key);
  if (t) {
    t.rows.push(...rows);
  } else {
    t = { title, columns, rows: [...rows], sort: null, el: null };
    tables.set(key, t);
  }
  if (!replaying) {
    sess.transcript = sess.transcript.filter((e) => !(e.t === 'table' && e.title === title));
    sess.transcript.push({ t: 'table', title, columns: t.columns, rows: t.rows });
    save();
    if (sess.id !== activeId) {
      unread.add(sess.id);
      renderTabs();
      return;
    }
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

// --- STREAMING: live na bubble habang nagta-type ang model ---
function liveDelta(sess, runId, kind, text, meta = {}) {
  let st = streams.get(runId);
  if (!st) {
    st = { a: '', t: '', slots: null, elA: null, elT: null };
    streams.set(runId, st);
  }
  const live = sess.id === activeId;
  if (kind === 'a') {
    st.a += text;
    if (live) {
      if (!st.elA) {
        st.elA = document.createElement('div');
        st.elA.className = 'msg assistant live';
        log.append(st.elA);
      }
      st.elA.textContent = st.a;
      log.scrollTop = log.scrollHeight;
    }
  } else if (kind === 'u') {
    // Ang audit stream — per-model slot para sa voting (sabay-sabay ang mga AI).
    const slot = meta.slot ?? 0;
    st.slots ||= {};
    const su = (st.slots[slot] ||= { text: '', el: null, model: meta.model });
    su.text += text;
    if (live) {
      if (!su.el) {
        su.el = document.createElement('div');
        su.el.className = 'msg audit live';
        const head = document.createElement('div');
        head.className = 'audit-head';
        head.textContent = `🧐 ${su.model || 'Second brain'}…`;
        su.el.append(head, document.createTextNode(''));
        log.append(su.el);
      }
      su.el.childNodes[1].textContent = su.text;
      log.scrollTop = log.scrollHeight;
    }
  } else {
    st.t += text;
    if (live) {
      if (!st.elT) {
        st.elT = document.createElement('details');
        st.elT.className = 'think live';
        const s = document.createElement('summary');
        s.textContent = 'Nag-iisip…';
        st.elT.append(s, document.createTextNode(''));
        log.append(st.elT);
      }
      st.elT.childNodes[1].textContent = st.t;
      log.scrollTop = log.scrollHeight;
    }
  }
}

// Ang audit bubble na may button na nagpapasa ng puna pabalik sa worker —
// dito nagkakaroon ng usapan ang dalawang AI.
function addAudit(text, model, worker) {
  const el = document.createElement('div');
  el.className = 'msg audit';
  const head = document.createElement('div');
  head.className = 'audit-head';
  head.textContent = `🧐 Second brain — ${model || 'auditor'}${worker ? ` (ang worker: ${worker})` : ''}`;
  el.append(head, document.createTextNode(text));

  const btn = document.createElement('button');
  btn.className = 'audit-pass';
  btn.textContent = '✉ Ipasa ang puna kay worker';
  btn.onclick = () => {
    $('ask').value = `Ang sabi ng second brain na si ${model}:\n${text}\n\nAyusin o ituloy mo ang gawain batay sa puna na ito.`;
    btn.disabled = true;
    btn.textContent = 'Naipasa na ✓';
    submit(false);
  };
  el.append(btn);
  log.append(el);
  log.scrollTop = log.scrollHeight;
}

function auditEnd(sess, runId, model, worker, slot = 0) {
  const st = streams.get(runId);
  if (!st?.slots?.[slot]) return;
  const su = st.slots[slot];
  delete st.slots[slot];
  su.el?.remove();
  emit(sess, { t: 'audit', text: su.text, model, worker });
}

// Ang consensus ng mga AI sa voting — isang linya lang, malinaw.
function addVote(avg, pass, n) {
  const el = document.createElement('div');
  el.className = 'msg audit';
  const head = document.createElement('div');
  head.className = 'audit-head';
  head.textContent = `🗳 Consensus: ${pass ? 'PASS ✅' : 'KAILANGANG AYUSIN ⚠️'} — ${avg}/10 mula sa ${n} model`;
  el.append(head);
  log.append(el);
  log.scrollTop = log.scrollHeight;
}

function streamEnd(sess, runId, model) {
  const st = streams.get(runId);
  if (!st) return;
  streams.delete(runId);
  // Alisin ang live na bubble — papalitan ng pangmatagalang entry na naitatala.
  st.elA?.remove();
  st.elT?.remove();
  if (st.t) emit(sess, { t: 'think', text: st.t });
  if (st.a) {
    emit(sess, { t: 'assistant', text: st.a, model });
    maybeSpeak(st.a);
  }
}

// --- MGA MENSAHE MULA SA BACKGROUND: nire-route sa tamang session ---
function onMessage(m) {
  const sid = m.runId ? runsById.get(m.runId) : activeId;
  const sess = sessions.find((s) => s.id === sid) || active();
  if (!sess) return;
  const live = sess.id === activeId;

  switch (m.type) {
    case 'assistant_delta':
      return liveDelta(sess, m.runId, 'a', m.text);
    case 'thinking_delta':
      return liveDelta(sess, m.runId, 't', m.text);
    case 'audit_delta':
      return liveDelta(sess, m.runId, 'u', m.text, { slot: m.slot, model: m.model });
    case 'audit_end':
      return auditEnd(sess, m.runId, m.model, m.worker, m.slot);
    case 'vote':
      return emit(sess, { t: 'vote', avg: m.avg, pass: m.pass, n: m.n });
    case 'stream_end':
      return streamEnd(sess, m.runId, m.model);
    case 'thinking':
      return emit(sess, { t: 'think', text: m.text });
    case 'assistant':
      emit(sess, { t: 'assistant', text: m.text, model: m.model });
      return maybeSpeak(m.text);
    case 'tool':
      if (m.name === 'plan') return planUpdate(sess, m.args || {});
      return emit(sess, { t: 'tool', text: describe(m.name, m.args) });
    case 'tool_result':
      // Ang tagumpay ay tahimik — ang bawat "ok" ay ingay lang. Ang pagkabigo lang ang nagsasalita.
      if (!m.result?.error) return;
      emit(sess, { t: 'error', text: `Hindi natuloy ang ${describe(m.name, m.args).toLowerCase()}: ${m.result.error}` });
      return chime('error');
    case 'confirm':
      trackPending(sess.id, { kind: 'confirm', id: m.id, tool: m.tool, args: m.args });
      if (live) addConfirm(m.id, m.tool, m.args);
      else {
        unread.add(sess.id);
        renderTabs();
      }
      voiceConvo = false; // kailangan ng desisyon mo — huminto muna ang usapang boses
      return chime('ask');
    case 'question':
      trackPending(sess.id, { kind: 'question', id: m.id, question: m.question, options: m.options });
      if (live) addQuestion(m.id, m.question, m.options);
      else {
        unread.add(sess.id);
        renderTabs();
      }
      voiceConvo = false;
      return chime('ask');
    case 'error':
      emit(sess, { t: 'error', text: m.text });
      return chime('error');
    case 'heard':
      return emit(sess, { t: 'tool', text: `🔊 ${String(m.text).slice(0, 500)}` });
    case 'capture-off':
      $('tap').classList.remove('on');
      return;
    case 'shot': {
      // Ang mga larawan ay live lang — hindi itinatala para hindi mapuno ang storage.
      if (!live) {
        unread.add(sess.id);
        return renderTabs();
      }
      const el = add('tool', 'Tumingin sa screen');
      const im = document.createElement('img');
      im.src = m.image;
      el.append(im);
      log.scrollTop = log.scrollHeight;
      return;
    }
    case 'table':
      return addTable(m.title, m.columns, m.rows, false, sess);
    case 'msg':
      sess.history.push(m.message);
      return save();
    case 'recorded':
      return finishRecording(m.steps);
    case 'usage':
      return trackUsage(m);
    case 'done':
      activeRuns.delete(m.runId);
      runsById.delete(m.runId);
      updateSend();
      if (!activeRuns.size) stopClock();
      renderTabs();
      return chime('done');
  }
}

function updateSend() {
  const busy = activeRuns.size > 0;
  $('send').disabled = busy;
  $('send').textContent = busy ? '…' : '↑';
  $('statuslight').classList.toggle('on', busy); // ang violet na ilaw
}

// --- TIMER: makikita mo kung gaano na katagal ang gawaing tumatakbo ---
let runClock = null;
let clockStart = 0;
function startClock() {
  clockStart = Date.now();
  clearInterval(runClock);
  const tick = () => {
    const s = Math.floor((Date.now() - clockStart) / 1000);
    $('timer').textContent = `⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  tick();
  runClock = setInterval(tick, 1000);
}
function stopClock() {
  clearInterval(runClock);
  runClock = null;
  $('timer').textContent = '';
}

// --- USAGE TRACKING: TUMPAK na tokens (galing sa API mismo) kada model ---
// Bawat tawag sa API ay may usage event na may in/out tokens; ang dulo ng takbo ay
// may seconds at runs. Ipon lahat dito, hiwalay ang worker sa auditor.
async function trackUsage(m) {
  if (!m.model) return;
  const { usage = {} } = await chrome.storage.local.get('usage');
  const u = (usage[m.model] ||= { calls: 0, runs: 0, seconds: 0, tin: 0, tout: 0, role: '' });
  u.calls += m.calls || 0;
  u.runs += m.runs || 0;
  u.seconds += m.seconds || 0;
  u.tin += m.in || 0;
  u.tout += m.out || 0;
  if (m.role) u.role = m.role;
  await chrome.storage.local.set({ usage });
}

const fmtSecs = (s) => (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);
const fmtTok = (n) =>
  n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(n);

$('stats').onclick = async () => {
  const { usage = {} } = await chrome.storage.local.get('usage');
  const entries = Object.entries(usage).sort(
    (a, b) => b[1].tin + b[1].tout - (a[1].tin + a[1].tout) || b[1].seconds - a[1].seconds
  );
  const box = document.createElement('div');
  box.className = 'usagebox';

  const head = document.createElement('div');
  head.className = 'uhead';
  const b = document.createElement('b');
  b.textContent = '📊 Usage';
  head.append(b);
  box.append(head);

  if (!entries.length) {
    const d = document.createElement('div');
    d.className = 'dim';
    d.textContent = 'Wala pang naitatalang usage — magpatakbo muna ng gawain.';
    box.append(d);
  } else {
    const tin = entries.reduce((n, [, u]) => n + u.tin, 0);
    const tout = entries.reduce((n, [, u]) => n + u.tout, 0);
    const runs = entries.reduce((n, [, u]) => n + u.runs, 0);
    const totals = document.createElement('div');
    totals.className = 'totals';
    for (const [n, l] of [[fmtTok(tin), 'Input tokens'], [fmtTok(tout), 'Output tokens'], [String(runs), 'Mga takbo']]) {
      const s = document.createElement('div');
      s.className = 'stat';
      const nn = document.createElement('div');
      nn.className = 'n';
      nn.textContent = n;
      const ll = document.createElement('div');
      ll.className = 'l';
      ll.textContent = l;
      s.append(nn, ll);
      totals.append(s);
    }
    box.append(totals);

    const max = Math.max(...entries.map(([, u]) => u.tin + u.tout), 1);
    for (const [model, u] of entries) {
      const row = document.createElement('div');
      row.className = 'urow';
      const mdl = document.createElement('div');
      mdl.className = 'mdl';
      const nm = document.createElement('span');
      nm.textContent = model;
      nm.title = model;
      mdl.append(nm);
      if (u.role) {
        const r = document.createElement('span');
        r.className = 'role ' + (u.role === 'auditor' ? 'a' : 'w');
        r.textContent = u.role === 'auditor' ? 'AUDITOR' : 'WORKER';
        mdl.append(r);
      }
      const nums = document.createElement('span');
      nums.className = 'nums';
      const bits = [];
      if (u.runs) bits.push(`${u.runs} takbo`);
      if (u.calls) bits.push(`${u.calls} tawag`);
      if (u.seconds) bits.push(fmtSecs(u.seconds));
      bits.push(`${fmtTok(u.tin)} in`, `${fmtTok(u.tout)} out`);
      nums.textContent = bits.join(' · ');
      const bar = document.createElement('div');
      bar.className = 'ubar';
      const fill = document.createElement('i');
      fill.style.width = `${Math.max(2, Math.round(((u.tin + u.tout) / max) * 100))}%`;
      bar.append(fill);
      row.append(mdl, nums, bar);
      box.append(row);
    }

    const reset = document.createElement('button');
    reset.textContent = 'I-reset ang stats';
    reset.onclick = async () => {
      await chrome.storage.local.set({ usage: {} });
      box.remove();
    };
    box.append(reset);
  }
  log.append(box);
  log.scrollTop = log.scrollHeight;
};

// --- MGA LARAWANG IDINIKIT ---
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
      const s = active();
      if (s) emit(s, { t: 'error', text: e.message });
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

// --- SUBMIT ---
let voiceConvo = false; // tuloy-tuloy na usapang boses: salita → sagot → salita

function submit(viaVoice = false) {
  const s = active();
  if (!s) return;
  const text = $('ask').value.trim();
  if (!text && !attachments.length) return;

  if (activeRuns.size) {
    emit(s, { t: 'tool', text: 'May tumatakbo pang gawain — hintayin munang matapos bago magpadala ulit.' });
    $('ask').value = '';
    return;
  }

  // Ang pinakamadalas na paraan ng pagkasira: nagtanong siya, hindi ka pumindot ng sagot,
  // nagtype ka na lang. Ang naiwang tool_call na walang sagot ay tinatanggihan ng API
  // magpakailanman. Nililinis natin ito sa BAWAT pagpapadala.
  if (repairHistory(s.history, 'Hindi ito sinagot ng user; nagpadala siya ng bagong mensahe sa ibaba.')) {
    pendingPrompts.set(s.id, []);
    log.querySelectorAll('.question button, .confirm button').forEach((b) => (b.disabled = true));
  }

  // Ang unang mensahe ang nagiging pamagat ng tab.
  if (s.title === 'Bagong usapan' && text) {
    s.title = text.slice(0, 26);
    renderTabs();
  }

  emit(s, { t: 'user', text });
  if (attachments.length) {
    const el = log.lastChild;
    for (const url of attachments) {
      const im = document.createElement('img');
      im.src = url;
      el?.append(im);
    }
  }

  s.history.push({
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
  voiceConvo = viaVoice && ttsOn;

  const runId = uid();
  runsById.set(runId, s.id);
  activeRuns.add(runId);
  updateSend();
  startClock(); // timer ng gawain
  renderTabs();
  save();

  getPort().postMessage({
    type: 'ask',
    history: s.history,
    runId,
    sessionId: s.id,
    title: s.title,
  });
}

// --- VOICE COMMAND: sabihin ang utos, hindi na kailangang mag-type ---
// Sa normal na mode: nagta-type sa box ang sinasabi mo, at awtomatikong ipinapadala
// pagkatapos ng maikling katahimikan. Sa COACH mode: pakikinig ito para sa listen tool.
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let dictateRec = null;
let ambientRec = null;
let dictateBase = '';
let silenceTimer = null;

function toggleMic() {
  if (dictateRec) {
    dictateRec.__off = true;
    dictateRec.stop();
    return;
  }
  if (ambientRec) {
    ambientRec.__off = true;
    ambientRec.stop();
    return;
  }
  if ($('mode').value === 'coach') startAmbientMic();
  else startDictate();
}

function startDictate() {
  const s = active();
  if (!s) return;
  if (!SR) {
    emit(s, { t: 'error', text: 'Walang Web Speech API ang browser na ito.' });
    return;
  }

  const rec = new SR();
  dictateRec = rec;
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = navigator.language?.startsWith('tl') ? 'tl-PH' : 'en-US';
  dictateBase = $('ask').value ? $('ask').value.trim() + ' ' : '';

  rec.onresult = (e) => {
    let interim = '';
    let finals = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) finals += e.results[i][0].transcript + ' ';
      else interim += e.results[i][0].transcript;
    }
    if (finals) dictateBase += finals;
    $('ask').value = dictateBase + interim;
    // Auto-send pagkatapos ng maikling katahimikan sa dulo ng pangungusap.
    clearTimeout(silenceTimer);
    if (finals && !interim) {
      silenceTimer = setTimeout(() => {
        if (dictateRec) {
          dictateRec.__off = true;
          dictateRec.stop();
        }
        submit(true);
      }, 1600);
    }
  };

  const FATAL = new Set(['not-allowed', 'service-not-allowed', 'audio-capture']);
  rec.onerror = (e) => {
    if (e.error === 'no-speech') return;
    if (!FATAL.has(e.error)) {
      emit(s, { t: 'error', text: `Mikropono: ${e.error}` });
      return;
    }
    rec.__off = true;
    emit(s, { t: 'error', text: 'Walang pahintulot sa mikropono. Bubuksan ko ang page na hihingi nito.' });
    chrome.tabs.create({ url: chrome.runtime.getURL('mic-permission.html') });
  };

  rec.onend = () => {
    if (rec.__off) {
      dictateRec = null;
      $('mic').classList.remove('on');
      return;
    }
    try {
      rec.start();
    } catch {}
  };

  try {
    rec.start();
    $('mic').classList.add('on');
  } catch (e) {
    dictateRec = null;
    emit(s, { t: 'error', text: `Hindi mabuksan ang mikropono: ${e.message}` });
  }
}

// Ang lumang behavior ng 🎤, para sa coach mode: pakikinig sa kwarto at ipinapadala
// sa background para sa susunod na `listen` ng agent. Hindi nagre-record: teksto lang.
function startAmbientMic() {
  const s = active();
  if (!s) return;
  if (!SR) {
    emit(s, { t: 'error', text: 'Walang Web Speech API ang browser na ito.' });
    return;
  }

  const rec = new SR();
  ambientRec = rec;
  rec.continuous = true;
  rec.interimResults = false;
  rec.lang = navigator.language?.startsWith('tl') ? 'tl-PH' : 'en-US';

  rec.onresult = (e) => {
    let text = '';
    for (let i = e.resultIndex; i < e.results.length; i++)
      if (e.results[i].isFinal) text += e.results[i][0].transcript + ' ';
    text = text.trim();
    if (!text) return;
    emit(s, { t: 'tool', text: `🎤 ${text.slice(0, 300)}` });
    getPort().postMessage({ type: 'mic', text });
  };

  const FATAL = new Set(['not-allowed', 'service-not-allowed', 'audio-capture']);
  rec.onerror = (e) => {
    if (e.error === 'no-speech') return;
    if (!FATAL.has(e.error)) {
      emit(s, { t: 'error', text: `Mikropono: ${e.error}` });
      return;
    }
    rec.__off = true;
    emit(s, { t: 'error', text: 'Walang pahintulot sa mikropono. Bubuksan ko ang page na hihingi nito.' });
    chrome.tabs.create({ url: chrome.runtime.getURL('mic-permission.html') });
  };

  rec.onend = () => {
    if (rec.__off) {
      ambientRec = null;
      $('mic').classList.remove('on');
      emit(s, { t: 'tool', text: '🎤 tumigil' });
      return;
    }
    try {
      rec.start();
    } catch {}
  };

  try {
    rec.start();
    $('mic').classList.add('on');
    emit(s, { t: 'tool', text: '🎤 nakikinig — ilagay sa speaker ang tawag para marinig ang kabila' });
  } catch (e) {
    ambientRec = null;
    emit(s, { t: 'error', text: `Hindi mabuksan ang mikropono: ${e.message}` });
  }
}

$('mic').onclick = toggleMic;

// --- EXPORT: i-download ang usapan bilang Markdown ---
$('export').onclick = () => {
  const s = active();
  if (!s || !s.transcript.length) return;
  const lines = [`# ${s.title}`, '', `_${new Date(s.createdAt).toLocaleString()}_`, ''];
  for (const e of s.transcript) {
    if (e.t === 'user') lines.push('## Ikaw', '', e.text, '');
    else if (e.t === 'assistant') lines.push('## Kimi K3', '', e.text, '');
    else if (e.t === 'tool') lines.push(`> ${e.text}`, '');
    else if (e.t === 'error') lines.push(`> ⚠ ${e.text}`, '');
    else if (e.t === 'audit') lines.push(`## 🧐 Second brain (${e.model || 'auditor'})`, '', e.text, '');
    else if (e.t === 'vote') lines.push(`## 🗳 Consensus: ${e.pass ? 'PASS' : 'AYUSIN'} — ${e.avg}/10 (${e.n} model)`, '');
    else if (e.t === 'table') {
      lines.push(
        `### ${e.title}`,
        '',
        '| ' + e.columns.join(' | ') + ' |',
        '| ' + e.columns.map(() => '---').join(' | ') + ' |',
        ...e.rows.map((r) => '| ' + r.map((c) => String(c ?? '').replace(/\|/g, '\\|')).join(' | ') + ' |'),
        ''
      );
    }
    // Ang 'think' ay hindi naisasama — panloob na pag-iisip iyon.
  }
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/markdown' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = s.title.replace(/[^\w-]+/g, '-').toLowerCase().slice(0, 50) + '.md';
  a.click();
  URL.revokeObjectURL(url);
};

// --- TUNOG NG TAB → Groq Whisper ---
$('tap').onclick = async () => {
  const s = active();
  if ($('tap').classList.contains('on')) {
    getPort().postMessage({ type: 'capture', on: false });
    $('tap').classList.remove('on');
    if (s) emit(s, { t: 'tool', text: '🔊 tumigil' });
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
  if (s) emit(s, { t: 'tool', text: '🔊 kinukuha ang tunog ng tab — maririnig mo pa rin ito' });
};

// --- ANG NATUTUNAN NIYA: nakikita at nabubura ---
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

// --- AUDIT (second brain mula sa ibang AI) ---
$('audit').onclick = () => {
  auditOn = !auditOn;
  $('audit').classList.toggle('on', auditOn);
  $('auditrow').style.display = auditOn ? '' : 'none';
  syncMenuDot();
  chrome.storage.local.set({ audit: auditOn });
  const s = active();
  if (s)
    emit(s, {
      t: 'tool',
      text: auditOn
        ? `🧐 Second brain ON — si ${$('auditmodel').value} ang magrerepaso at mag-i-improve ng bawat huling sagot`
        : '🧐 Second brain OFF',
    });
};
$('auditprovider').onchange = () => {
  chrome.storage.local.set({ auditProvider: $('auditprovider').value });
  fillAModels();
  refreshModels($('auditprovider').value);
};
$('auditmodel').onchange = () =>
  chrome.storage.local.set({ auditModel: $('auditmodel').value.trim() });

// --- AUTOPILOT: kusang nagpapatuloy sa susunod na hakbang ---
$('pilot').onclick = () => {
  const on = !$('pilot').classList.contains('on');
  $('pilot').classList.toggle('on', on);
  syncMenuDot();
  chrome.storage.local.set({ autopilot: on });
  const s = active();
  if (s)
    emit(s, {
      t: 'tool',
      text: on
        ? '🛩 Autopilot ON — pagkatapos ng gawain, kusang magpapatuloy sa susunod na hakbang (max 5, may permission gates pa rin)'
        : '🛩 Autopilot OFF',
    });
};

$('teach').onclick = () => {
  const on = !$('teach').classList.contains('on');
  $('teach').classList.toggle('on', on);
  syncMenuDot();
  chrome.storage.local.set({ teach: on });
  const s = active();
  if (s)
    emit(s, {
      t: 'tool',
      text: on
        ? '🎓 Teach ON — may captions na sa page: bawat galaw at ang dahilan nito, para matuto ang nanonood'
        : '🎓 Teach OFF',
    });
};

// --- RECORD & REPLAY ---
let recording = false;

$('rec').onclick = () => {
  const s = active();
  recording = !recording;
  $('rec').classList.toggle('on', recording);
  getPort().postMessage({ type: 'record', on: recording });
  if (s)
    emit(s, {
      t: 'tool',
      text: recording
        ? '⏺ Nagre-record — gawin mo ang mga pindot sa working tab, tapos pindutin ulit ito para ihinto'
        : '⏺ Huminto ang recording…',
    });
};

async function finishRecording(steps) {
  recording = false;
  $('rec').classList.remove('on');
  const s = active();
  const name = window.prompt(`Pangalan ng shortcut na ito (${steps.length} hakbang):`);
  if (!name) {
    if (s) emit(s, { t: 'tool', text: 'Hindi na-save ang recording.' });
    return;
  }
  const { shortcuts = {} } = await chrome.storage.local.get('shortcuts');
  shortcuts[name] = { steps, createdAt: Date.now() };
  await chrome.storage.local.set({ shortcuts });
  if (s)
    emit(s, {
      t: 'tool',
      text: `⏺ Naka-save ang shortcut na "${name}" (${steps.length} hakbang) — sabihin mo lang: "i-run ang ${name}"`,
    });
}

// --- THEME: puti ang default, dark kapag pinindot ang ☾ ---
$('theme').onclick = () => {
  const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
  document.body.dataset.theme = next;
  $('theme').textContent = next === 'dark' ? '☀' : '☾';
  chrome.storage.local.set({ theme: next });
};

// --- SCHEDULED TASKS ---
$('sched').onclick = async () => {
  const { schedules = [] } = await chrome.storage.local.get('schedules');
  const box = document.createElement('div');
  box.className = 'confirm';
  const b = document.createElement('b');
  b.textContent = schedules.length ? `Naka-iskedyul (${schedules.length})` : 'Walang naka-iskedyul na gawain.';
  box.append(b);
  for (const t of schedules) {
    const row = document.createElement('div');
    row.className = 'row';
    row.style.marginTop = '4px';
    const span = document.createElement('span');
    span.className = 'dim';
    span.style.flex = '1';
    span.textContent = `${t.every ? `kada ${t.every} min` : 'minsan'}: ${t.instruction.slice(0, 80)}`;
    const x = document.createElement('button');
    x.textContent = '×';
    x.onclick = async () => {
      await chrome.alarms.clear(t.id);
      const { schedules: cur = [] } = await chrome.storage.local.get('schedules');
      await chrome.storage.local.set({ schedules: cur.filter((q) => q.id !== t.id) });
      row.remove();
    };
    row.append(span, x);
    box.append(row);
  }
  log.append(box);
  log.scrollTop = log.scrollHeight;
};

$('send').onclick = () => submit(false);
$('ask').onkeydown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    submit(false);
  }
};

// --- BOOT ---
(async () => {
  await loadSessions();
  renderTabs();
  renderLog();
  updateSend();
})();
