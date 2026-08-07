// Ang mga function dito ay ipinapadala sa page via chrome.scripting.executeScript,
// kaya SELF-CONTAINED sila: hindi sila pwedeng tumukoy sa kahit anong nasa labas nila.
// Ang refs ay nabubuhay sa window ng isolated world, kaya tuloy-tuloy sila sa magkakasunod na tawag.

export function readPage(maxChars) {
  const SEL =
    'a[href],button,input,select,textarea,summary,[role=button],[role=link],[role=tab],' +
    '[role=checkbox],[role=menuitem],[role=option],[contenteditable=true],[onclick]';
  const map = new Map();
  const lines = [];
  let n = 0;

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
  };
  const label = (el) => {
    const t =
      el.getAttribute('aria-label') ||
      el.getAttribute('placeholder') ||
      el.value ||
      el.innerText ||
      el.getAttribute('title') ||
      el.getAttribute('name') ||
      '';
    return t.replace(/\s+/g, ' ').trim().slice(0, 120);
  };

  for (const el of document.querySelectorAll(SEL)) {
    if (!visible(el)) continue;
    if (el.disabled) continue;
    const ref = 'ref_' + ++n;
    map.set(ref, el);
    const tag = el.tagName.toLowerCase();
    const type = el.type ? `:${el.type}` : '';
    const checked = el.checked === true ? ' checked' : '';
    lines.push(`[${ref}] ${tag}${type}${checked} "${label(el)}"`);
    if (n >= 400) break;
  }

  window.__kimiRefs = map;

  const text = (document.body?.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
  const budget = Math.max(1000, (maxChars || 12000) - lines.join('\n').length);
  return {
    url: location.href,
    title: document.title,
    interactive: lines.join('\n'),
    text: text.slice(0, budget),
    truncated: text.length > budget,
  };
}

export function clickRef(ref) {
  const el = window.__kimiRefs?.get(ref);
  if (!el) return { error: `Walang ${ref}. Tumawag muli ng read_page — nagbago ang page.` };
  el.scrollIntoView({ block: 'center' });
  el.click();
  return { ok: true, clicked: (el.innerText || el.value || el.tagName).slice(0, 80) };
}

export function typeRef(ref, text, submit) {
  const el = window.__kimiRefs?.get(ref);
  if (!el) return { error: `Walang ${ref}. Tumawag muli ng read_page — nagbago ang page.` };

  el.scrollIntoView({ block: 'center' });

  // Ang <select> ay hindi sinusulatan — pinipili. Kung walang ganitong sanga, paulit-ulit
  // na susubukan ng model na mag-type doon at hindi ito magtatagumpay kahit kailan.
  if (el.tagName === 'SELECT') {
    const opts = [...el.options];
    const want = String(text).trim().toLowerCase();
    const match =
      opts.find((o) => o.value.toLowerCase() === want) ||
      opts.find((o) => o.text.trim().toLowerCase() === want) ||
      opts.find((o) => o.text.toLowerCase().includes(want));

    if (!match) {
      // Ibinabalik ang totoong pagpipilian — dito nakakabawi ang model sa halip na manghula.
      return {
        ok: false,
        error: `Walang opsyon na "${text}".`,
        mapagpipilian: opts.map((o) => o.text.trim()).slice(0, 60),
      };
    }
    el.value = match.value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, method: 'select', napili: match.text.trim() };
  }

  el.click(); // may mga editor na naglalagay lang ng handler pagkatapos ng tunay na pagpindot
  el.focus();

  let method;
  if (el.isContentEditable) {
    // Ang Lexical (Messenger, Facebook), Draft.js, TinyMCE (Elementor), at ProseMirror ay
    // may sariling modelo ng dokumento. Ang pagtatakda ng textContent ay nagbabago ng DOM
    // pero hindi ng modelo — pinapalitan nila ito pabalik o hindi man lang napapansin.
    // Ang execCommand ang tanging paraan na gumagawa ng buong tunay na input events.
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);

    method = 'execCommand';
    if (!document.execCommand('insertText', false, text)) {
      method = 'beforeinput';
      const ev = new InputEvent('beforeinput', {
        inputType: 'insertText',
        data: text,
        bubbles: true,
        cancelable: true,
      });
      el.dispatchEvent(ev);
      if (!ev.defaultPrevented) {
        method = 'textContent';
        el.textContent = text;
      }
    }
  } else {
    method = 'valueSetter';
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
    // Ang React ay may patch sa value setter; ang prototype setter ang lumalampas dito.
    Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, text);
  }

  el.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: text, bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));

  if (submit) sendEnter(el);

  // Ibinabalik ang tunay na laman pagkatapos, para hindi na kailangang manghula ng model
  // kung tumalab ba — kita niya agad kung hindi.
  const now = (el.isContentEditable ? el.innerText : el.value) || '';
  return {
    ok: now.includes(text),
    method,
    laman: now.slice(0, 200),
    ...(now.includes(text)
      ? {}
      : { babala: 'Hindi tumalab ang pag-type. Basahin ulit ang page bago magpatuloy.' }),
  };
}

// Ang mga editor ay nakikinig sa iba't ibang antas: may keydown, may keypress, may
// requestSubmit. Ipinapadala natin lahat, kasama ang keyCode na hinahanap pa rin ng
// mga lumang handler.
function sendEnter(el) {
  const opts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
  for (const t of ['keydown', 'keypress', 'keyup']) el.dispatchEvent(new KeyboardEvent(t, opts));
  el.form?.requestSubmit?.();
}

// Nakikitang palatandaan sa page: may GLOWING violet frame (parang magic), banner sa
// itaas na may TIMER at LIVE STATUS ng ginagawa ng agent, at cursor na gumagalaw
// papunta sa bawat element bago ito pindutin. Nasa shadow DOM para hindi maabot ng
// CSS ng site, at pointer-events:none para hindi mahadlangan ang totoong pag-click.
export function overlay(action, ref) {
  const ID = '__kimi_overlay';
  let host = document.getElementById(ID);

  if (action === 'off') {
    if (host?.__tm) clearInterval(host.__tm);
    host?.remove();
    return { ok: true };
  }

  if (!host) {
    host = document.createElement('div');
    host.id = ID;
    host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647';
    const sh = host.attachShadow({ mode: 'open' });
    sh.innerHTML = `
      <style>
        .frame {
          position:fixed; inset:0; border:2px solid #7c5cff; border-radius:3px;
          animation:glow 1.8s ease-in-out infinite;
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 4px #7c5cff22, inset 0 0 4px #7c5cff11; }
          50%      { box-shadow: 0 0 20px #7c5cffaa, inset 0 0 14px #7c5cff44; }
        }
        .bar {
          position:fixed; top:0; left:50%; transform:translateX(-50%);
          background:#7c5cff; color:#fff; font:600 12px/1 ui-sans-serif,system-ui,sans-serif;
          padding:6px 14px; border-radius:0 0 9px 9px; letter-spacing:.2px;
          display:flex; align-items:center; gap:7px; box-shadow:0 2px 10px #7c5cff66;
          white-space:nowrap; max-width:96vw;
        }
        .dot { width:7px; height:7px; border-radius:50%; background:#fff; animation:pulse 1.4s infinite; }
        @keyframes pulse { 50% { opacity:.25; } }
        .st { opacity:.9; font-weight:500; }
        .tm { opacity:.8; font-variant-numeric:tabular-nums; }
        .cur {
          position:fixed; width:22px; height:22px; margin:-11px 0 0 -11px;
          border:2px solid #7c5cff; border-radius:50%; background:#7c5cff33;
          transition:left .35s cubic-bezier(.22,1,.36,1), top .35s cubic-bezier(.22,1,.36,1);
          opacity:0;
        }
        .cur.on { opacity:1; }
        .ring {
          position:fixed; border:2px solid #7c5cff; border-radius:6px;
          transition:all .35s cubic-bezier(.22,1,.36,1); opacity:0;
        }
        .ring.on { opacity:1; animation:flash .6s ease-out; }
        @keyframes flash { from { box-shadow:0 0 0 0 #7c5cff88; } to { box-shadow:0 0 0 14px #7c5cff00; } }
        .spark {
          position:fixed; bottom:10px; width:5px; height:5px; border-radius:50%;
          background:#c9b8ff; animation:sparkle 1.7s ease-in infinite;
        }
        @keyframes sparkle {
          0% { opacity:0; transform:translateY(0) scale(.6); }
          30% { opacity:1; }
          100% { opacity:0; transform:translateY(-16px) scale(1); }
        }
      </style>
      <div class="frame"></div>
      <div class="bar"><span class="dot"></span><b>Kimi K3</b><span class="st"></span><span class="tm"></span></div>
      <div class="cur"></div>
      <div class="ring"></div>
      <div class="spark" style="left:12%"></div>
      <div class="spark" style="left:50%;animation-delay:.55s"></div>
      <div class="spark" style="left:86%;animation-delay:1.1s"></div>`;
    document.documentElement.append(host);

    // Ang timer sa banner — nagsisimula kapag pumasok ang agent, humihinto kapag tapos.
    const t0 = Date.now();
    const tm = sh.querySelector('.tm');
    host.__tm = setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000);
      tm.textContent = ` ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }, 1000);
  }

  if (action === 'status') {
    // Live na status ng ginagawa — hal. "Pinipindot ang ref_12" o "Binabasa ang page".
    const st = host.shadowRoot.querySelector('.st');
    st.textContent = ref ? `· ${ref}` : '';
    return { ok: true };
  }

  if (action === 'point') {
    const el = window.__kimiRefs?.get(ref);
    if (!el) return { ok: false };
    const r = el.getBoundingClientRect();
    const sh = host.shadowRoot;
    const cur = sh.querySelector('.cur');
    const ring = sh.querySelector('.ring');
    cur.style.left = r.left + r.width / 2 + 'px';
    cur.style.top = r.top + r.height / 2 + 'px';
    cur.classList.add('on');
    Object.assign(ring.style, {
      left: r.left - 3 + 'px',
      top: r.top - 3 + 'px',
      width: r.width + 6 + 'px',
      height: r.height + 6 + 'px',
    });
    ring.classList.remove('on');
    void ring.offsetWidth; // pinipilit ang muling pagpapatakbo ng animation
    ring.classList.add('on');
  }
  return { ok: true };
}

// Pakikinig nang walang Whisper. Dalawang pinagkukunan, pareho nang nasa page:
//   1. textTracks — ang tunay na caption track ng HTML video. Ito ang pinakatumpak.
//   2. mga elementong caption sa DOM — ang ginagamit ng YouTube/FB para sa live na auto-caption.
// Nagsasalita ang mga ito habang tumatakbo ang video, kaya nangongolekta tayo sa paglipas
// ng panahon sa halip na kumuha ng isang larawan lang.
export function listenPage(seconds) {
  return new Promise((resolve) => {
    const media = [...document.querySelectorAll('video, audio')];
    const lines = [];
    const seen = new Set();

    const grab = () => {
      for (const m of media) {
        for (const track of m.textTracks || []) {
          if (track.mode === 'disabled') track.mode = 'hidden'; // kung hindi, walang cue
          for (const cue of track.activeCues || []) {
            const t = (cue.text || '').replace(/<[^>]+>/g, '').trim();
            if (t && !seen.has(t)) {
              seen.add(t);
              lines.push(t);
            }
          }
        }
      }
      // Ang live na auto-caption ng YouTube at Facebook ay wala sa textTracks.
      for (const el of document.querySelectorAll(
        '.ytp-caption-segment, .captions-text, [class*="caption" i] span, [aria-live="polite"][class*="caption" i]'
      )) {
        const t = el.innerText?.trim();
        if (t && t.length > 1 && !seen.has(t)) {
          seen.add(t);
          lines.push(t);
        }
      }
    };

    grab();
    const timer = setInterval(grab, 400);
    setTimeout(() => {
      clearInterval(timer);
      const state = media.map((m) => ({
        uri: m.currentSrc?.slice(0, 120) || m.tagName.toLowerCase(),
        tumutugtog: !m.paused,
        naka_mute: m.muted || m.volume === 0,
        segundo: Math.round(m.currentTime),
        haba: isFinite(m.duration) ? Math.round(m.duration) : null,
      }));
      resolve({
        media: state,
        may_media: media.length > 0,
        transcript: lines.join('\n') || null,
        tala: lines.length
          ? null
          : media.length
            ? 'Walang caption na nakita. Baka nakapatay ito — subukang buksan ang CC, o gumamit ng screenshot.'
            : 'Walang video o audio na elemento sa page na ito.',
      });
    }, Math.min(Math.max(seconds || 8, 2), 30) * 1000);
  });
}

// Binabasa ang transcript mula sa tumatakbong whisper.cpp stream page. Lokal ito at
// pribado — walang audio na lumalabas ng makina mo. Hindi natin kailangang malaman ang
// tiyak na markup: pinipili natin ang textarea na may transcript at hindi ang debug log.
export function readWhisperTab() {
  const areas = [...document.querySelectorAll('textarea, #output, pre')];
  let best = '';
  for (const el of areas) {
    const t = (el.value ?? el.textContent ?? '').trim();
    if (!t || t.length < best.length) continue;
    if (/^js:|loadRemote:|fetchRemote:|storeFS:/m.test(t)) continue; // debug log, hindi transcript
    if (/transcribed text will be displayed/i.test(t)) continue; // placeholder pa lang
    best = t;
  }
  const body = document.body.innerText;
  const status = /Status:\s*(.+)/.exec(body)?.[1]?.trim() || null;
  return { transcript: best || null, status, model: /loaded "(.+?)"/.exec(body)?.[1] || null };
}

export function scrollPage(direction, amount) {
  const px = (amount || 1) * window.innerHeight * 0.8; // ang null/undefined ay nagiging 1
  window.scrollBy({ top: direction === 'up' ? -px : px, behavior: 'instant' });
  return { ok: true, scrollY: Math.round(window.scrollY) };
}

// ============================================================================
// v0.3: WordPress/Elementor toolkit + record & replay
// ============================================================================

// --- CONSOLE READER ---
// Ang tunay na console ng page ay nabubuhay sa MAIN world — hindi ito maririnig
// mula sa isolated world. Kaya ang hookConsole/readConsole ay ini-inject doon.
export function hookConsole() {
  if (window.__kimiConsole) return { ok: true, note: 'naka-hook na dati' };
  const buf = (window.__kimiConsole = []);
  const push = (level, args) => {
    try {
      const text = args
        .map((a) => {
          try {
            return typeof a === 'object' ? JSON.stringify(a).slice(0, 300) : String(a);
          } catch {
            return '[object]';
          }
        })
        .join(' ')
        .slice(0, 500);
      buf.push({ level, text, at: Date.now() });
      if (buf.length > 200) buf.shift();
    } catch {}
  };
  for (const level of ['error', 'warn', 'log', 'info']) {
    const orig = console[level];
    console[level] = (...a) => {
      push(level, a);
      return orig.apply(console, a);
    };
  }
  window.addEventListener('error', (e) => push('pageerror', [e.message, `${e.filename}:${e.lineno}`]));
  window.addEventListener('unhandledrejection', (e) => push('unhandledrejection', [String(e.reason)]));
  // Mga nabigong network call — sakupin ang fetch (ang karamihan ng modernong site
  // ay fetch na; ang XHR ay isusunod na lang kung kailangan talaga).
  const origFetch = window.fetch;
  window.fetch = async (...a) => {
    const res = await origFetch(...a);
    try {
      if (res.status >= 400) push('network', [`${res.status} ${String(a[0]).slice(0, 150)}`]);
    } catch {}
    return res;
  };
  return { ok: true };
}

export function readConsole() {
  const buf = window.__kimiConsole || [];
  const entries = buf.splice(0).map((l) => `[${l.level}] ${l.text}`);
  return {
    entries,
    count: entries.length,
    hooked: !!window.__kimiConsole,
    note: entries.length
      ? null
      : 'Walang nakuha pa. Ang mga error BAGO i-hook ay hindi nakukuha — i-reload ang page para makita ang mga error sa pag-load.',
  };
}

// --- PASTE LARGE ---
// Para sa mahabang HTML/code: ang Elementor HTML widget, TinyMCE, at CodeMirror ay
// sumusugal sa iisang malaking insertText — kaya hinahati natin sa chunks, parang
// tunay na paste na maraming bahagi.
export function pasteLarge(ref, text, chunkSize) {
  const el = window.__kimiRefs?.get(ref);
  if (!el) return { error: `Walang ${ref}. Tumawag muli ng read_page — nagbago ang page.` };

  el.scrollIntoView({ block: 'center' });
  el.click();
  el.focus();

  const CHUNK = Math.min(Math.max(chunkSize || 2000, 200), 8000);
  const full = String(text);

  if (el.isContentEditable) {
    // CodeMirror 6, TinyMCE, Lexical: select-all + delete muna (buong palit),
    // tapos sunod-sunod na insertText chunks.
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand('delete', false);

    let i = 0;
    let method = 'execCommand-chunks';
    while (i < full.length) {
      const part = full.slice(i, i + CHUNK);
      if (!document.execCommand('insertText', false, part)) {
        method = 'textContent-fallback';
        el.textContent = full;
        el.dispatchEvent(new InputEvent('input', { bubbles: true }));
        break;
      }
      i += CHUNK;
    }
    const now = el.innerText || '';
    return {
      ok: now.length >= full.length * 0.95,
      method,
      nilagay: full.length,
      laman_ngayon: now.length,
      ...(now.length < full.length * 0.95
        ? { babala: 'Mukhang kulang ang napaste — basahin ulit ang page at subukan muli.' }
        : {}),
    };
  }

  // textarea/input: atomic na ang isang set — walang chunks na kailangan.
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, full);
  el.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: full, bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));

  const now = el.value || '';
  return {
    ok: now === full,
    method: 'valueSetter',
    nilagay: full.length,
    laman_ngayon: now.length,
    ...(now !== full ? { babala: 'Hindi tumalab — baka may limitasyon ang field na ito.' } : {}),
  };
}

// --- RECORD & REPLAY ---
// Nire-record ang mga pindot at type ng user sa working tab, bilang mga hakbang na
// may CSS selector. Kapag nag-navigate ang page, nawawala ang recorder (bagong
// document) — kaya i-record ang bawat page-load na bahagi nang hiwalay kung kailangan.
export function recorderStart() {
  if (window.__kimiRecording) return { ok: true, note: 'nagre-record na' };
  const steps = (window.__kimiSteps = []);

  const cssPath = (el) => {
    if (el.id) return '#' + CSS.escape(el.id);
    const parts = [];
    while (el && el.nodeType === 1 && parts.length < 6) {
      let sel = el.tagName.toLowerCase();
      if (el.name) {
        parts.unshift(`${sel}[name="${el.name}"]`);
        break;
      }
      const aria = el.getAttribute('aria-label');
      if (aria) {
        parts.unshift(`${sel}[aria-label="${aria.slice(0, 40).replace(/"/g, '')}"]`);
        break;
      }
      const parent = el.parentElement;
      if (parent) {
        const same = [...parent.children].filter((c) => c.tagName === el.tagName);
        if (same.length > 1) sel += `:nth-of-type(${same.indexOf(el) + 1})`;
      }
      parts.unshift(sel);
      el = parent;
    }
    return parts.join(' > ');
  };

  const onClick = (e) => {
    const el = e.target.closest('a,button,input,select,summary,[role=button],[onclick]') || e.target;
    steps.push({
      action: 'click',
      selector: cssPath(el),
      label: (el.innerText || el.value || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 60),
    });
  };
  const onChange = (e) => {
    const el = e.target;
    if (!/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
    steps.push({ action: 'type', selector: cssPath(el), value: el.value });
  };

  document.addEventListener('click', onClick, true);
  document.addEventListener('change', onChange, true);
  window.__kimiRecording = { onClick, onChange };
  return { ok: true };
}

export function recorderStop() {
  const rec = window.__kimiRecording;
  if (!rec) return { error: 'Walang recording na tumatakbo.' };
  document.removeEventListener('click', rec.onClick, true);
  document.removeEventListener('change', rec.onChange, true);
  window.__kimiRecording = null;
  const steps = window.__kimiSteps || [];
  window.__kimiSteps = [];
  return { ok: true, steps };
}

// Isang hakbang ng replay — tinatawag ng tools.js isa-isa nang may pagitan,
// para makapag-hintay ng navigation sa pagitan ng mga hakbang.
export function applyStep(step) {
  const el = document.querySelector(step.selector);
  if (!el) return { error: `Hindi makita ang ${step.selector} — baka nagbago ang page.` };
  el.scrollIntoView({ block: 'center' });

  if (step.action === 'click') {
    el.click();
    return { ok: true, clicked: step.label || step.selector };
  }
  if (step.action === 'type') {
    el.focus();
    if (el.tagName === 'SELECT') {
      const want = String(step.value).toLowerCase();
      const match =
        [...el.options].find((o) => o.value.toLowerCase() === want) ||
        [...el.options].find((o) => o.text.trim().toLowerCase() === want);
      if (match) el.value = match.value;
    } else if (el.isContentEditable) {
      el.textContent = step.value;
    } else {
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
      Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, step.value);
    }
    el.dispatchEvent(new InputEvent('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true };
  }
  return { error: `Hindi kilalang hakbang: ${step.action}` };
}

// --- VERIFICATION LOOP ---
// Mura at mabilis na "pagbabago signature" ng page: URL + title + laki ng text +
// bilang ng interactive na elemento. Kinukuha bago at pagkatapos ng aksyon — ang
// paghahambing ang nagsasabi sa model kung tumalab ba, nang walang dagdag na API call.
export function pageSig() {
  return {
    url: location.href,
    title: document.title,
    sig:
      (document.body?.innerText.length || 0) +
      ':' +
      document.querySelectorAll('a,button,input,select,textarea').length,
  };
}
