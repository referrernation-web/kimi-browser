import { readPage, clickRef, typeRef, scrollPage, overlay, listenPage, readWhisperTab } from './page-fns.js';
import { remember } from './memory.js';

// Mga tool na nagbabago ng kalagayan sa labas ng browser.
export const WRITES = new Set(['click', 'type', 'navigate', 'new_tab', 'close_tab']);

// Hindi na maibabalik kapag nagawa na — nagtatanong pa rin kahit auto mode.
export const DANGER = new Set(['close_tab']);

export const MODES = {
  manual: { label: 'Manual', hint: 'Nagtatanong bago ang bawat aksyon.' },
  auto: { label: 'Auto', hint: 'Kusang kumikilos; nagtatanong pa rin sa hindi na maibabalik.' },
  plan: { label: 'Plan', hint: 'Read-only. Nagbabasa at nagpaplano, hindi kumikilos.' },
  coach: { label: 'Coach', hint: 'Nakikinig sa caption at nagmumungkahi ng sagot. Walang ginagalaw.' },
  bypass: { label: 'Bypass', hint: 'Walang tanong kahit ano. Alam mo ang ginagawa mo.' },
};

// Ang plan at coach ay pareho: nakakabasa, nakakakita, nakakarinig — walang binabago.
const READ_ONLY = new Set(['plan', 'coach']);

// Kailangan ba ng pindot ng tao bago patakbuhin ang `name` sa `mode`?
export function needsApproval(mode, name) {
  if (!WRITES.has(name)) return false;
  if (mode === 'bypass') return false;
  if (mode === 'auto') return DANGER.has(name);
  return true; // manual (ang read-only na mode ay hindi man lang nakakakita ng write tools)
}

// Sa read-only na mode ay tinatanggal natin ang write tools sa schema mismo, hindi lang
// hinaharangan: kapag hindi nakikita ng model ang tool, hindi niya ito sinusubukan.
export function schemaFor(mode) {
  return READ_ONLY.has(mode) ? SCHEMA.filter((t) => !WRITES.has(t.function.name)) : SCHEMA;
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
        'Basahin ang kasalukuyang tab: URL, title, ang teksto nito, at listahan ng mga [ref_N] na pwedeng pindutin o sulatan. Tawagin ito BAGO mag-click o mag-type, at ULIT pagkatapos ng anumang nagpabago ng page.',
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
        'Tingnan ang tab bilang larawan. GAMITIN ITO kapag hindi sapat ang teksto: para tingnan kung nagbago ang estado pagkatapos ng pagpindot (nagsimula ba ang tawag, bumukas ba ang modal, na-load ba), para sa UI na puro icon, para sa chart, larawan, video, canvas, o kahit anong nakikita pero hindi nababasa. Kapag dalawang beses nang nabigo ang read_page na sagutin ang tanong mo, tumingin ka na sa halip na sumubok muli.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listen',
      description:
        'Makinig. Apat ang pinagkukunan, at ibinabalik lahat ng available: (a) may_tunog — may tumutunog ba sa tab; (b) transcript — caption ng video habang tumatakbo; (c) narinig_sa_mikropono — kung binuksan ng user ang 🎤 sa panel; (d) whisper.bago — bagong transcript mula sa bukas na whisper.cpp stream tab, lokal at pribado. Para sa voice call na walang caption, ang (c) o (d) lang ang makakarinig ng salita. Kung wala ang lahat, sabihin agad sa user kung alin ang buksan — huwag maghintay nang paulit-ulit sa katahimikan.',
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
      description: 'Dalhin ang kasalukuyang tab sa isang URL.',
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
      description: 'Ilista ang lahat ng bukas na tab kasama ang id at URL nila.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'switch_tab',
      description: 'Iharap ang isang tab gamit ang id mula sa list_tabs.',
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
      description: 'Magbukas ng bagong tab sa isang URL.',
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
      description: 'Isara ang isang tab gamit ang id nito.',
      parameters: {
        type: 'object',
        properties: { tabId: { type: 'number' } },
        required: ['tabId'],
      },
    },
  },
];

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab) throw new Error('Walang aktibong tab.');
  if (/^(chrome|edge|about|chrome-extension):/.test(tab.url || ''))
    throw new Error(`Hindi maaabot ng extension ang ${tab.url} — browser-internal page ito.`);
  return tab;
}

async function inPage(func, args = []) {
  const tab = await activeTab();
  // Hindi kayang i-serialize ng executeScript ang `undefined` — sumasabog ito bilang
  // "Value is unserializable" kapag may hindi ibinigay ang model na opsyonal na argument.
  const safe = args.map((a) => (a === undefined ? null : a));
  const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func, args: safe });
  return res.result;
}

// ponytail: fixed na 1.5s ang hinihintay pagka-navigate. Kung may makitang page na
// hindi pa tapos mag-render, palitan ito ng chrome.tabs.onUpdated listener.
const settle = () => new Promise((r) => setTimeout(r, 1500));

// Ipinapakita ang cursor sa element at binibigyan ito ng sandali para makagalaw
// bago ang aksyon — para may makita ang tao, hindi biglaang pagkumpas.
async function point(ref) {
  try {
    await inPage(overlay, ['point', ref]);
    await new Promise((r) => setTimeout(r, 400));
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
    return new URL((await activeTab()).url).hostname.replace(/^www\./, '');
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
      const tab = await activeTab();
      // JPEG 60 — sapat para makita ang estado ng UI, at ~10x na mas maliit kaysa PNG.
      // Ang larawan ay malaki kahit naka-compress, kaya hindi ito dapat pang-araw-araw.
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: 'jpeg',
        quality: 60,
      });
      return { image: dataUrl, url: tab.url };
    }
    case 'click': {
      await point(args.ref);
      const out = await inPage(clickRef, [args.ref]);
      await settle();
      return out;
    }
    case 'type':
      await point(args.ref);
      return inPage(typeRef, [args.ref, args.text, !!args.submit]);
    case 'scroll':
      return inPage(scrollPage, [args.direction, args.amount]);
    case 'navigate': {
      const tab = await activeTab();
      await chrome.tabs.update(tab.id, { url: args.url });
      await settle();
      return { ok: true, url: args.url };
    }
    case 'listen': {
      const tab = await activeTab();
      // Ang `audible` ay galing sa Chrome mismo — alam nito kung may tumutunog kahit
      // walang caption at kahit hindi natin marinig ang mismong tunog.
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
      const tabs = await chrome.tabs.query({});
      return tabs.map((t) => ({
        tabId: t.id,
        title: t.title,
        url: t.url,
        active: t.active,
        may_tunog: !!t.audible, // dito makikita kung aling tab ang tumutunog
      }));
    }
    case 'switch_tab':
      await chrome.tabs.update(args.tabId, { active: true });
      return { ok: true };
    case 'new_tab': {
      const t = await chrome.tabs.create({ url: args.url, active: true });
      await settle();
      return { ok: true, tabId: t.id };
    }
    case 'close_tab':
      await chrome.tabs.remove(args.tabId);
      return { ok: true };
    default:
      return { error: `Hindi kilalang tool: ${name}` };
  }
}
