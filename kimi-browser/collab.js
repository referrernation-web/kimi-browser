/* collab.js — multi-model identity + collab UI (drop-in, walang edit sa sidepanel.js)
   Isagot sa sidepanel.html BAGO ang sidepanel.js script tag:
     <link rel="stylesheet" href="collab.css">
     <script src="collab.js"></script>                     */
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

const S = { seq: 0, calls: [], stats: { audits: 0, flags: 0 } };
window.Collab = S; // debug handle

/* ---- 2. Fetch interception — sino ang TOTOONG sumagot (honest kahit may fallback) ---- */
const _fetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  init = init || {};
  const url = typeof input === 'string' ? input : (input && input.url) || '';
  let m = null;
  if (/chat\/completions/i.test(url)) {
    let model = '?';
    try { model = JSON.parse(init.body || '{}').model || '?'; } catch {}
    m = { id: ++S.seq, url, prov: provOf(url), model, role: 'worker',
          t0: performance.now(), latency: null, tokens: null, status: 'thinking', bound: false };
    S.calls.push(m); if (S.calls.length > 100) S.calls.shift();
    renderLive();
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
      finish(m);
    })();
    return new Response(keep, { status: res.status, statusText: res.statusText, headers: res.headers });
  }
  try {
    res.clone().json().then(j => {
      if (j && j.model) m.model = j.model;
      if (j && j.usage) m.tokens = j.usage.total_tokens || j.usage.completion_tokens || null;
      finish(m);
    }).catch(() => finish(m));
  } catch { finish(m); }
  return res;
};
const finish = m => { m.latency = Math.round(performance.now() - m.t0); m.status = 'done'; renderLive(); setTimeout(() => bindWorker(m), 350); };

/* ---- 3. UI: header + live status bar ---- */
let headEl = null, liveEl = null, obsOn = false;
const el = (t, c) => { const n = document.createElement(t); n.className = c; return n; };
const esc = s => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

function buildUI() {
  const log = document.querySelector('#log'); if (!log || headEl) return;
  headEl = el('div', 'collab-head'); liveEl = el('div', 'collab-live');
  log.parentNode.insertBefore(headEl, log); log.parentNode.insertBefore(liveEl, log);
  renderHead();
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
  liveEl.style.display = act.length ? 'flex' : 'none';
  liveEl.innerHTML = act.map(c =>
    `<span class="lv"><i style="--pc:${c.prov.color}"></i>${esc(c.prov.label)} · ${esc(c.model)} · ` +
    `${c.status === 'thinking' ? 'nag-iisip…' : 'streaming…'} <b data-t="${c.t0}"></b></span>`).join('');
}
setInterval(() => { if (liveEl) liveEl.querySelectorAll('b[data-t]').forEach(b => { b.textContent = ((performance.now() - +b.dataset.t) / 1000).toFixed(1) + 's'; }); }, 250);

/* ---- 4. Badges sa mga bubble ---- */
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
