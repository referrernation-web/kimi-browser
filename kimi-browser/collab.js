/* collab.js v2 — multi-model identity + ETA + per-model usage meter (drop-in)
   Isagot sa sidepanel.html BAGO ang sidepanel.js script tag:
     <link rel="stylesheet" href="collab.css">
     <script src="collab.js"></script>
   Limits: i-click ang usage chip para magtakda ng daily-token / tokens-per-minute limit. */
(() => {
'use strict';

/* ---- 1. Provider registry — dagdagan dito kapag may bagong provider ---- */
const PROVIDERS = [
  { re: /api\.kimi\.com/i,                  label: 'Kimi', color: '#a866ff' },
  { re: /dashscope|aliyuncs|maas\.aliyun/i, label: 'Qwen', color: '#3b82f6' },
];
const provOf = url => {
  for (const p of PROVIDERS) if (p.re.test(url)) return p;
  try { return { label: (new URL(url).hostname.split('.')[0] || 'CUSTOM').toUpperCase().slice(0, 8), color: '#10b981' }; }
  catch { return { label: 'CUSTOM', color: '#10b981' }; }
};

const todayKey = () => new Date().toISOString().slice(0, 10);
const S = {
  seq: 0, calls: [], runs: [], stats: { audits: 0, flags: 0 },
  usage: {},  // "Prov·model" -> { day, tokDay, reqDay, times:[[ts,tok],...] }
  limits: {}, // "Prov·model" -> { dayTok, tpm } (0 = walang limit)
};
window.Collab = S; // debug handle
try { Object.assign(S.limits, JSON.parse(localStorage.getItem('collab.limits.v1') || '{}')); } catch {}
try {
  const u = JSON.parse(localStorage.getItem('collab.usage.v1') || '{}');
  if (u && u.day === todayKey() && u.models) for (const k in u.models) S.usage[k] = { ...u.models[k], times: [] };
} catch {}
const saveUsage = () => { try {
  const models = {};
  for (const k in S.usage) models[k] = { day: S.usage[k].day, tokDay: S.usage[k].tokDay, reqDay: S.usage[k].reqDay };
  localStorage.setItem('collab.usage.v1', JSON.stringify({ day: todayKey(), models }));
} catch {} };

const fmt  = s => s < 90 ? Math.round(s) + 's' : Math.round(s / 60) + 'm';
const fmtK = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(Math.round(n));
const esc  = s => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
const el   = (t, c) => { const n = document.createElement(t); n.className = c; return n; };

/* ---- 2. Fetch interception — sino ang TOTOONG sumagot + usage + run timing ---- */
const _fetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  init = init || {};
  const url = typeof input === 'string' ? input : (input && input.url) || '';
  let m = null;
  if (/chat\/completions/i.test(url)) {
    let model = '?';
    try { model = JSON.parse(init.body || '{}').model || '?'; } catch {}
    m = { id: ++S.seq, url, prov: provOf(url), model, role: 'worker',
          t0: performance.now(), latency: null, tokens: null, ptokens: null, status: 'thinking', bound: false };
    S.calls.push(m); if (S.calls.length > 100) S.calls.shift();
    touchRun(); renderLive();
  }
  const res = await _fetch(input, init);
  if (!m) return res;
  const ct = res.headers.get('content-type') || '';
  if (/stream|event-stream/i.test(ct)) {
    m.status = 'streaming'; renderLive();
    const [keep, meter] = res.body.tee();
    (async () => {
      const r = meter.getReader(); let last = '';
      try { for (;;) { const d = await r.read(); if (d.done) break; last = new TextDecoder().decode(d.value); } } catch {}
      const u = last.match(/"completion_tokens":(\d+)/); if (u) m.tokens = +u[1];
      const p = last.match(/"prompt_tokens":(\d+)/); if (p) m.ptokens = +p[1];
      finish(m);
    })();
    return new Response(keep, { status: res.status, statusText: res.statusText, headers: res.headers });
  }
  try {
    res.clone().json().then(j => {
      if (j && j.model) m.model = j.model;
      if (j && j.usage) {
        m.tokens = (j.usage.completion_tokens != null ? j.usage.completion_tokens : j.usage.total_tokens) || null;
        m.ptokens = j.usage.prompt_tokens != null ? j.usage.prompt_tokens : null;
      }
      finish(m);
    }).catch(() => finish(m));
  } catch { finish(m); }
  return res;
};
const finish = m => {
  m.latency = Math.round(performance.now() - m.t0); m.status = 'done';
  recordUsage(m); touchRun(); renderLive(); renderUsage();
  setTimeout(() => bindWorker(m), 350);
};

/* ---- 3. Per-model usage meter (Claude Code-style, may %) ---- */
function recordUsage(m) {
  const k = m.prov.label + '·' + m.model;
  const u = S.usage[k] || (S.usage[k] = { day: todayKey(), tokDay: 0, reqDay: 0, times: [] });
  if (u.day !== todayKey()) { u.day = todayKey(); u.tokDay = 0; u.reqDay = 0; u.times = []; }
  const tok = (m.tokens || 0) + (m.ptokens || 0);
  u.tokDay += tok; u.reqDay += 1; u.times.push([Date.now(), tok]);
  saveUsage();
}
const tpmOf = u => { const cut = Date.now() - 60000; u.times = u.times.filter(t => t[0] > cut); return u.times.reduce((a, t) => a + t[1], 0); };
const limitOf = k => S.limits[k] || { dayTok: 0, tpm: 0 };
function setLimit(k) {
  const cur = limitOf(k);
  const d = prompt('Daily token limit para kay ' + k + ' (0 = walang limit):', String(cur.dayTok || 0));
  if (d === null) return;
  const t = prompt('Tokens-per-minute limit para kay ' + k + ' (0 = walang limit):', String(cur.tpm || 0));
  S.limits[k] = { dayTok: +d || 0, tpm: t === null ? (cur.tpm || 0) : (+t || 0) };
  try { localStorage.setItem('collab.limits.v1', JSON.stringify(S.limits)); } catch {}
  renderUsage();
}
function renderUsage() {
  if (!useEl) return;
  const keys = Object.keys(S.usage);
  useEl.style.display = keys.length ? 'flex' : 'none';
  useEl.innerHTML = keys.map(k => {
    const u = S.usage[k], L = limitOf(k), tpm = tpmOf(u);
    const pct  = L.dayTok ? Math.min(999, Math.round(100 * u.tokDay / L.dayTok)) : null;
    const pPct = L.tpm    ? Math.min(999, Math.round(100 * tpm / L.tpm))        : null;
    const worst = Math.max(pct || 0, pPct || 0);
    const cls = worst >= 100 ? 'max' : worst >= 80 ? 'warn' : '';
    const color = k.indexOf('Kimi') === 0 ? '#a866ff' : k.indexOf('Qwen') === 0 ? '#3b82f6' : '#10b981';
    return `<span class="us ${cls}" data-k="${esc(k)}" title="${esc(k)} — i-click para magtakda ng limit">` +
      `<i style="--pc:${color}"></i>${esc(k)} <b>${fmtK(u.tokDay)}</b> ngayon` +
      (pct != null ? ` (${pct}%)` : '') + ` · ${fmtK(tpm)}/min` + (pPct != null ? ` (${pPct}%)` : '') +
      (pct == null && pPct == null ? ' · click=limit' : '') + `</span>`;
  }).join('');
}

/* ---- 4. Run detection + ETA ---- */
let run = { start: 0, last: 0, active: false };
function touchRun() {
  const now = Date.now();
  if (run.active && now - run.last > 15000) endRun();
  if (!run.active) run = { start: now, last: now, active: true };
  else run.last = now;
}
function endRun() {
  const d = Date.now() - run.start;
  if (d > 3000) { S.runs.push(d); if (S.runs.length > 20) S.runs.shift(); }
  run.active = false; renderLive();
}
setInterval(() => { if (run.active && Date.now() - run.last > 15000) endRun(); }, 5000);
const median = a => { if (!a.length) return 0; const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; };
function etaText() {
  if (!run.active) return '';
  const elS = (Date.now() - run.start) / 1000;
  const typ = median(S.runs) / 1000;
  let t = '⏱ ' + fmt(elS);
  if (S.runs.length >= 2 && typ > 0) {
    const rem = Math.max(0, typ - elS);
    t += elS >= typ * 0.8 ? ` · malapit na matapos (~${fmt(rem)})` : ` · ~${fmt(rem)} pa (batay sa ${S.runs.length} run)`;
  } else t += ' · kalibrating…';
  return t;
}

/* ---- 5. UI: header + live bar + usage strip ---- */
let headEl = null, liveEl = null, useEl = null, obsOn = false;
function buildUI() {
  const log = document.querySelector('#log'); if (!log || headEl) return;
  headEl = el('div', 'collab-head'); liveEl = el('div', 'collab-live'); useEl = el('div', 'collab-usage');
  log.parentNode.insertBefore(headEl, log);
  log.parentNode.insertBefore(liveEl, log);
  log.parentNode.insertBefore(useEl, log);
  useEl.addEventListener('click', e => { const c = e.target.closest('.us'); if (c) setLimit(c.dataset.k); });
  renderHead(); renderUsage();
}
function renderHead() {
  if (!headEl) return;
  const w = [...S.calls].reverse().find(c => c.role === 'worker');
  const a = [...S.calls].reverse().find(c => c.role === 'auditor');
  headEl.innerHTML =
    `<span class="ch-title">COLLAB</span>` +
    `<span><i style="--pc:${w ? w.prov.color : '#555'}"></i>${w ? esc(w.prov.label) + ' · ' + esc(w.model) : 'worker: —'}</span>` +
    `<span class="ch-arrow">→</span>` +
    `<span><i style="--pc:${a ? a.prov.color : '#555'}"></i>${a ? esc(a.prov.label) + ' · ' + esc(a.model) : 'auditor: — (i-on ang AUDIT)'}</span>` +
    `<span class="ch-stats">audits ${S.stats.audits} · flags ${S.stats.flags}</span>`;
}
function renderLive() {
  if (!liveEl) return;
  const act = S.calls.filter(c => c.status !== 'done');
  const eta = etaText();
  liveEl.style.display = (act.length || eta) ? 'flex' : 'none';
  liveEl.innerHTML = act.map(c =>
    `<span class="lv"><i style="--pc:${c.prov.color}"></i>${esc(c.prov.label)} · ${esc(c.model)} · ` +
    `${c.status === 'thinking' ? 'nag-iisip…' : 'streaming…'} <b>${((performance.now() - c.t0) / 1000).toFixed(1)}s</b></span>`
  ).join('') + (eta ? `<span class="eta">${esc(eta)}</span>` : '');
}
setInterval(renderLive, 500);

/* ---- 6. Badges sa mga bubble ---- */
const isUser = n => /u|user|me|human/.test(' ' + n.className) && !n.classList.contains('audit');
function badge(node, m, role) {
  m.bound = true; m.role = role; node.dataset.collab = m.id;
  const b = el('span', 'collab-badge');
  b.style.setProperty('--pc', m.prov.color);
  b.innerHTML = `<i></i>${esc(m.prov.label)} · ${esc(m.model)} <em>${role}</em>`;
  b.title = `${m.prov.label} ${m.model}\n${m.url}\nlatency: ${m.latency != null ? m.latency + 'ms' : '…'}${m.tokens ? ' · ' + m.tokens + ' tok' : ''}`;
  node.prepend(b);
  return b;
}
function bindWorker(m) {
  if (m.bound) return;
  const log = document.querySelector('#log'); if (!log) return;
  const nodes = [...log.querySelectorAll('.msg')].filter(n =>
    !n.dataset.collab && !n.classList.contains('audit') && !n.classList.contains('think') && !isUser(n));
  const node = nodes[nodes.length - 1]; if (!node) return;
  badge(node, m, 'worker');
}
function bindAuditor(node) {
  const m = [...S.calls].reverse().find(c => !c.bound); if (!m) return;
  const b = badge(node, m, 'auditor');
  S.stats.audits++;
  const pass = node.classList.contains('audit-pass') || /PASS/i.test(node.textContent.slice(0, 300));
  if (!pass) S.stats.flags++;
  const chip = el('span', 'collab-chip ' + (pass ? 'ok' : 'warn'));
  chip.textContent = pass ? '✓ pass' : '⚠ may findings';
  b.after(chip); renderHead();
}
const obs = new MutationObserver(muts => {
  for (const mut of muts) for (const n of mut.addedNodes) {
    if (n instanceof HTMLElement && n.classList.contains('msg') && n.classList.contains('audit') && !n.dataset.collab) bindAuditor(n);
  }
});
function startObs() { const log = document.querySelector('#log'); if (log && !obsOn) { obsOn = true; obs.observe(log, { childList: true }); } }

const boot = setInterval(() => { if (!document.body) return; clearInterval(boot); buildUI(); startObs(); }, 200);
})();
