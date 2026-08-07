import { readPage, clickRef, typeRef, scrollPage, overlay, listenPage, readWhisperTab } from './page-fns.js';
import { remember } from './memory.js';

// Mga tool na nagbabago ng kalagayan sa labas ng browser.
export const WRITES = new Set(['click', 'type', 'navigate', 'new_tab', 'close_tab']);

// Hindi na maibabalik kapag nagawa na — nagtatanong pa rin kahit auto mode.
export const DANGER = new Set(['close_tab']);

export const MODES = {
  adaptive: { label: 'Adaptive', hint: 'Nagtatanong sa unang beses ng bawat aksyon, tapos tiwala na sa buong gawain.' },
  manual: { label: 'Manual', hint: 'Nagtatanong bago ang bawat aksyon.' },
  auto: { label: 'Auto', hint: 'Kusang kumikilos; nagtatanong pa rin sa hindi na maibabalik.' },
  plan: { label: 'Plan', hint: 'Read-only. Nagbabasa at nagpaplano, hindi kumikilos.' },
  coach: { label: 'Coach', hint: 'Nakikinig sa caption at nagmumungkahi ng sagot. Walang ginagalaw.' },
  bypass: { label: 'Bypass', hint: 'Walang tanong kahit ano. Alam mo ang ginagawa mo.' },
};

// Ang plan at coach ay pareho: nakakabasa, nakakakita, nakakarinig — walang binabago.
const READ_ONLY = new Set(['plan', 'coach']);

// --- ADAPTIVE: natututo sa loob ng isang gawain ---
// Sa unang pagkakataon ng bawat uri ng aksyon (click, type, navigate, new_tab) ay
// magtatanong ito; kapag pinayagan mo, hindi na ito magtatanong ulit SA LOOB NG
// GAWAIN NA IYON. Ang close_tab ay laging nagtatanong. Sa susunod na gawain,
// nagsisimula ulit sa wala — kaya awtomatiko itong nag-a-adjust: maingat sa simula,
// mabilis kapag tiwala na.
const approved = new Set();

export function markApproved(name) {
  approved.add(name);
}

export function resetApprovals() {
  approved.clear();
}

// Kailangan ba ng pindot ng tao bago patakbuhin ang `name` sa `mode`?
export function needsApproval(mode, name) {
  if (!WRITES.has(name)) return false;
  if (mode === 'bypass') return false;
  if (mode === 'auto') return DANGER.has(name);
  if (mode === 'adaptive') {
    if (DANGER.has(name)) return true; // ang hindi na maibabalik ay laging nagtatanong
    return !approved.has(name);
  }
  return true; // manual (ang read-only na mode ay hindi man lang nakakakita ng write tools)
}

// Sa read-only na mode ay tinatanggal natin ang write tools sa schema mismo, hindi lang
// hinaharangan: kapag hindi nakikita ng model ang tool, hindi niya ito sinusubukan.
export function schemaFor(mode) {
  return READ_ONLY.has(mode) ? SCHEMA.filter((t) => !WRITES.has(t.function.name)) : SCHEMA;
}

// --- SCOPE: ang tanging tab group na kontrolado ng agent ---
// Dito ang pinakamahalagang pagbabago: hindi na sinusunod ng agent ang tab na
// nakatutok ka. May sarili siyang purple na tab group, at doon lang siya kikilos —
// kahit magtrabaho ka sa ibang tab, hindi ka niya gugulohin.
const scope = { groupId: null, workingTabId: null };

export function setScope(groupId, workingTabId) {
  scope.groupId = groupId;
  if (workingTabId != null) scope.workingTabId = workingTabId;
}

export function getScope() {
  return { ...scope };
}

export const SCHEMA = [
  {
    type: 'function',
    function: {
      name: 'ask_user',
      description:
        'Magtanong sa user kapag may sanga na siya lang ang makakasagot: alin sa maraming resulta, aling account, o kailangan ba talagang ituloy. Ang mga sagot ay lumalabas bilang mapipinduting buton. Huwag itong gamitin sa bagay na kaya mong alamin sa pamamagitan ng pagbabasa ng page.',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          options: {
            type: 'array',
            items: { type: 'string' },
            description: '2-4 na maikling pagpipilian. Laging idinadagdag ang "Iba pa".',
          },
        },
        required: ['question', 'options'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'collect',
      description:
        'Itala ang mga nahanap mo bilang table. GAMITIN ITO sa tuwing may tatlo o higit pang bagay na maihahambing — listing, produkto, resulta, kandidato. Tawagin ito habang nangongolekta ka, hindi lang sa dulo. Ang table ay napupunta sa user; hindi na kailangang ulitin sa sagot mo. Isang tawag kada batch; ang parehong `title` ay nagdadagdag sa dating table.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'hal. "DDR5 32GB kits"' },
          columns: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Panatilihing pareho sa buong task. Isama ang lahat ng batayan ng paghahambing — presyo, yunit na presyo, lugar, rating ng seller, edad ng listing, link.',
          },
          rows: {
            type: 'array',
            items: { type: 'array', items: { type: 'string' } },
            description: 'Isang array kada bagay, kasunod ng pagkakasunod ng columns.',
          },
        },
        required: ['title', 'columns', 'rows'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remember',
      description:
        'Itala ang isang bagay na magiging kapaki-pakinabang sa susunod. Gamitin ito kapag may natuklasan kang hindi halata at magtitipid ng hakbang sa susunod — kung saan nakatago ang isang buton, ilang hakbang ang checkout, anong pangalan ang ginagamit ng site sa isang bagay. Gamitin din para sa mga bagay na sinabi ng user tungkol sa sarili o sa gusto niya. HUWAG itala ang panandaliang bagay: presyo, bilang ng resulta, laman ng page ngayon.',
      parameters: {
        type: 'object',
        properties: {
          scope: {
            type: 'string',
            enum: ['site', 'user'],
            description: '"site" = tungkol sa website na ito. "user" = tungkol sa tao.',
          },
          note: { type: 'string', description: 'Isang pangungusap.' },
        },
        required: ['scope', 'note'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_page',
      description:
        'Basahin ang working tab: URL, title, ang teksto nito, at listahan ng mga [ref_N] na pwedeng pindutin o sulatan. Tawagin ito BAGO mag-click o mag-type, at ULIT pagkatapos ng anumang nagpabago ng page.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'click',
      description: 'Pindutin ang isang element gamit ang ref nito mula sa read_page.',
      parameters: {
        type: 'object',
        properties: { ref: { type: 'string', description: 'hal. ref_12' } },
        required: ['ref'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'type',
      description:
        'Maglagay ng halaga sa isang field gamit ang ref nito. Gumagana rin ito sa <select> na dropdown — ipasa lang ang nakikitang label ng opsyon (hal. "Filipino"); kapag walang tugma, ibinabalik nito ang buong listahan ng mapagpipilian.',
      parameters: {
        type: 'object',
        properties: {
          ref: { type: 'string' },
          text: { type: 'string' },
          submit: { type: 'boolean', description: 'Pindutin ang Enter pagkatapos.' },
        },
        required: ['ref', 'text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'screenshot',
      description:
        'Tingnan ang working tab bilang larawan. GAMITIN ITO kapag hindi sapat ang teksto: para tingnan kung nagbago ang estado pagkatapos ng pagpindot, para sa UI na puro icon, para sa chart, larawan, video, canvas, o kahit anong nakikita pero hindi nababasa. Kapag dalawang beses nang nabigo ang read_page na sagutin ang tanong mo, tumingin ka na sa halip na sumubok muli. Ipinapakita nito sandali ang working tab sa user (isang kisap lang, ibabalik agad ang dating tab).',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_image',
      description:
        'Gumawa ng larawan mula sa text description — poster, logo concept, illustration, diagram. Ipinapakita ito sa user at nakikita mo rin. Libre at walang kailangang key. Ang prompt ay dapat nasa English at detalyado para sa pinakamahusay na resulta.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Detalyadong description ng larawan, sa English.' },
          width: { type: 'number', description: 'Default 1024.' },
          height: { type: 'number', description: 'Default 1024.' },
        },
        required: ['prompt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listen',
      description:
        'Makinig sa working tab. Apat ang pinagkukunan, at ibinabalik lahat ng available: (a) may_tunog — may tumutunog ba sa tab; (b) transcript — caption ng video habang tumatakbo; (c) narinig_sa_mikropono — kung binuksan ng user ang 🎤 sa panel; (d) whisper.bago — bagong transcript mula sa bukas na whisper.cpp stream tab, lokal at pribado. Para sa voice call na walang caption, ang (c) o (d) lang ang makakarinig ng salita. Kung wala ang lahat, sabihin agad sa user kung alin ang buksan — huwag maghintay nang paulit-ulit sa katahimikan.',
      parameters: {
        type: 'object',
        properties: {
          seconds: {
            type: 'number',
            description: 'Gaano katagal makikinig, 2 hanggang 30. Default 8.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'scroll',
      description: 'I-scroll ang page pataas o pababa.',
      parameters: {
        type: 'object',
        properties: {
          direction: { type: 'string', enum: ['up', 'down'] },
          amount: { type: 'number', description: 'Bilang ng screen, default 1.' },
        },
        required: ['direction'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'navigate',
      description: 'Dalhin ang working tab sa isang URL.',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string' } },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_tabs',
      description:
        'Ilista ang mga tab na nasa scope group mo LANG. Hindi mo makikita ang ibang tabs ng user — wala kang access doon.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'switch_tab',
      description:
        'Gawing working tab ang isang tab sa group gamit ang id mula sa list_tabs. Hindi ito gumagalaw ng focus ng user — sa background lang nagpapalit.',
      parameters: {
        type: 'object',
        properties: { tabId: { type: 'number' } },
        required: ['tabId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'new_tab',
      description:
        'Magbukas ng bagong tab sa isang URL, SA BACKGROUND LANG — hindi aagawin ang focus ng user. Awtomatiko itong papasok sa scope group mo.',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string' } },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'close_tab',
      description:
        'Isara ang isang tab sa scope group mo LANG. Hindi ito gagana sa tabs na labas ng group — hindi mo kayang isara ang ibang tabs ng user.',
      parameters: {
        type: 'object',
        properties: { tabId: { type: 'number' } },
        required: ['tabId'],
      },
    },
  },
];

// Ang "active tab" ay wala na sa vocabulary ng agent. Ang binabasa niya ay ang WORKING
// tab — ang huling tab na ginamit niya sa loob ng scope group. Kahit lumipat ang user
// ng focus, dito pa rin siya kikilos.
async function workingTab() {
  if (scope.workingTabId != null) {
    try {
      const t = await chrome.tabs.get(scope.workingTabId);
      if (scope.groupId == null || t.groupId === scope.groupId) {
        if (/^(chrome|edge|about|chrome-extension):/.test(t.url || ''))
          throw new Error(`Hindi maaabot ng extension ang ${t.url} — browser-internal page ito.`);
        return t;
      }
    } catch (e) {
      if (e.message?.startsWith('Hindi maaabot')) throw e;
      scope.workingTabId = null; // isinara o inalis sa group — humanap ng kapalit
    }
  }

  if (scope.groupId != null) {
    const tabs = await chrome.tabs.query({ groupId: scope.groupId });
    const usable = tabs.find((t) => !/^(chrome|edge|about|chrome-extension):/.test(t.url || ''));
    if (usable) {
      scope.workingTabId = usable.id;
      return usable;
    }
    throw new Error('Walang laman ang scope group. Sabihin sa user na buksan ang panel at magpadala ng utos para may ma-adopt na tab.');
  }

  throw new Error('Walang scope group pa. Magpadala muna ng utos mula sa panel para mag-setup ang group.');
}

async function inPage(func, args = []) {
  const tab = await workingTab();
  // Hindi kayang i-serialize ng executeScript ang `undefined` — sumasabog ito bilang
  // "Value is unserializable" kapag may hindi ibinigay ang model na opsyonal na argument.
  const safe = args.map((a) => (a === undefined ? null : a));
  const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func, args: safe });
  return res.result;
}

// --- SMART PAGE LOAD ---
// Hindi na tayo hihintay ng fixed na 1.5 segundo. Sasabihin ng Chrome mismo kung
// kailan tapos ang page, at may timeout kung sakaling hindi matapos.
const settle = (ms = 300) => new Promise((r) => setTimeout(r, ms));

export function waitForLoad(tabId, timeoutMs = 10000) {
  return new Promise((resolve) => {
    let finished = false;
    const done = (ok) => {
      if (finished) return;
      finished = true;
      chrome.tabs.onUpdated.removeListener(onUpdated);
      clearTimeout(timer);
      resolve(ok);
    };
    const timer = setTimeout(() => done(false), timeoutMs);
    const onUpdated = (id, info) => {
      if (id === tabId && info.status === 'complete') done(true);
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
    // Baka tapos na bago pa tayo nakinig.
    chrome.tabs
      .get(tabId)
      .then((t) => {
        if (t.status === 'complete') done(true);
      })
      .catch(() => done(false));
  });
}

// Ipinapakita ang cursor sa element at binibigyan ito ng sandali para makagalaw
// bago ang aksyon — para may makita ang tao, hindi biglaang pagkumpas.
async function point(ref) {
  try {
    await inPage(overlay, ['point', ref]);
    await new Promise((r) => setTimeout(r, 150));
  } catch {} // ang palamuti ay hindi dapat magpabagsak ng aksyon
}

export async function setOverlay(on) {
  try {
    await inPage(overlay, [on ? 'on' : 'off', null]);
  } catch {}
}

// Kung may bukas na whisper.cpp stream tab, siya ang tenga natin para sa boses na walang
// caption. Ibinabalik lang natin ang BAGONG bahagi — kung hindi, paulit-ulit na babasahin
// ng model ang parehong pangungusap at lalaki ang konteksto nang walang saysay.
let whisperSeen = '';

async function whisperTab() {
  const tabs = await chrome.tabs.query({
    url: ['*://whisper.ggerganov.com/*', '*://ggml.ai/whisper.cpp/*'],
  });
  if (!tabs.length) return {};

  let out;
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: readWhisperTab,
    });
    out = res.result;
  } catch {
    return {};
  }
  if (!out) return {};

  const full = out.transcript || '';
  const fresh = full.startsWith(whisperSeen) ? full.slice(whisperSeen.length).trim() : full;
  whisperSeen = full;

  return {
    whisper: {
      bago: fresh || null,
      estado: out.status,
      model: out.model,
      ...(out.status && /not started/i.test(out.status)
        ? { tala: 'Hindi pa nagsisimula. Sabihin sa user na pindutin ang Start sa whisper tab.' }
        : {}),
    },
  };
}

export function resetWhisper() {
  whisperSeen = '';
}

export async function currentDomain() {
  try {
    return new URL((await workingTab()).url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export async function runTool(name, args) {
  switch (name) {
    case 'remember':
      return remember(args.scope, args.note, await currentDomain());
    case 'read_page':
      return inPage(readPage, [12000]);
    case 'screenshot': {
      const tab = await workingTab();
      // Ang captureVisibleTab ay kumukuha ng NAKIKITANG tab, kaya kailangan munang
      // iharap ang working tab — pero ibinabalik natin AGAD ang tab ng user, kaya
      // isang kisap lang ito at hindi nagnanakaw ng focus.
      const [prev] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
      await chrome.tabs.update(tab.id, { active: true });
      await settle(350);
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: 'jpeg',
        quality: 60,
      });
      if (prev && prev.id !== tab.id) {
        await chrome.tabs.update(prev.id, { active: true }).catch(() => {});
      }
      return { image: dataUrl, url: tab.url };
    }
    case 'generate_image': {
      const w = Math.min(Math.max(Math.round(args.width || 1024), 256), 2048);
      const h = Math.min(Math.max(Math.round(args.height || 1024), 256), 2048);
      const seed = Math.floor(Math.random() * 1e6);
      const url =
        `https://image.pollinations.ai/prompt/${encodeURIComponent(String(args.prompt).slice(0, 800))}` +
        `?width=${w}&height=${h}&seed=${seed}&nologo=true`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Image API ${res.status} — subukan ulit pagkalipas ng ilang sandali.`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const mime = (res.headers.get('content-type') || 'image/jpeg').split(';')[0];
      return { image: `data:${mime};base64,${btoa(bin)}` };
    }
    case 'click': {
      const tab = await workingTab();
      await point(args.ref);
      const out = await inPage(clickRef, [args.ref]);
      // Hintayin kung magna-navigate; kung hindi, maikling settle lang.
      await settle(250);
      const now = await chrome.tabs.get(tab.id).catch(() => null);
      if (now && now.status === 'loading') {
        await waitForLoad(tab.id, 8000);
        await settle(200);
      }
      return out;
    }
    case 'type':
      await point(args.ref);
      return inPage(typeRef, [args.ref, args.text, !!args.submit]);
    case 'scroll':
      return inPage(scrollPage, [args.direction, args.amount]);
    case 'navigate': {
      const tab = await workingTab();
      await chrome.tabs.update(tab.id, { url: args.url });
      await waitForLoad(tab.id, 10000);
      await settle(150);
      return { ok: true, url: args.url };
    }
    case 'listen': {
      const tab = await workingTab();
      const page = await inPage(listenPage, [args.seconds]);
      const now = await chrome.tabs.get(tab.id);
      return {
        may_tunog: !!now.audible,
        naka_mute_ang_tab: !!now.mutedInfo?.muted,
        ...page,
        ...(await whisperTab()),
      };
    }
    case 'list_tabs': {
      if (scope.groupId == null) return { error: 'Walang scope group pa.' };
      const tabs = await chrome.tabs.query({ groupId: scope.groupId });
      return tabs.map((t) => ({
        tabId: t.id,
        title: t.title,
        url: t.url,
        working: t.id === scope.workingTabId,
        may_tunog: !!t.audible,
      }));
    }
    case 'switch_tab': {
      await assertInScope(args.tabId);
      // WALANG activation: ang DOM operations ay gumagana sa background tabs, kaya
      // hindi na kailangang agawin ang focus ng user — ito ang lalamangan natin
      // sa screenshot-based na mga agent na sa active tab lang kumikilos.
      scope.workingTabId = args.tabId;
      return { ok: true, note: 'Working tab lang ang pinalitan — hindi gumalaw ang focus ng user.' };
    }
    case 'new_tab': {
      // active:false — background tab para hindi maistorbo ang tinitingnan ng user.
      const t = await chrome.tabs.create({ url: args.url, active: false });
      if (scope.groupId != null) {
        await chrome.tabs.group({ tabIds: [t.id], groupId: scope.groupId });
      }
      scope.workingTabId = t.id;
      await waitForLoad(t.id, 10000);
      await settle(150);
      return { ok: true, tabId: t.id };
    }
    case 'close_tab': {
      await assertInScope(args.tabId);
      await chrome.tabs.remove(args.tabId);
      if (scope.workingTabId === args.tabId) scope.workingTabId = null;
      return { ok: true };
    }
    default:
      return { error: `Hindi kilalang tool: ${name}` };
  }
}

// Ang huling kandado: kahit ano pang sabihin ng model, hindi nito magagalaw ang tab
// na labas sa scope group. Hindi lang ito patakaran — hadlang ito sa Chrome API mismo.
async function assertInScope(tabId) {
  const t = await chrome.tabs.get(tabId).catch(() => null);
  if (!t) throw new Error(`Walang tab na ${tabId}.`);
  if (scope.groupId == null || t.groupId !== scope.groupId) {
    throw new Error('Ang tab na iyan ay labas ng scope group mo — hindi mo ito kayang galawin.');
  }
}
