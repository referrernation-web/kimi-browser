// --- GOOGLE CONNECTOR: Gmail at Sheets nang direkta sa API ---
// Walang server ang extension, kaya ang OAuth ay dumadaan sa chrome.identity mismo.
// Ang launchWebAuthFlow ang ginagamit (hindi getAuthToken) para hindi kailangang
// baguhin ang manifest tuwing may bagong client ID — nasa settings ito, hindi sa code.
// Ang token ay itinatago sa memorya lang; kapag nag-expire, tahimik muna ang pagbawi
// at interactive na lang kapag talagang kailangan ng tao.

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/userinfo.email',
];

let token = null;
let expiresAt = 0;

export function googleRedirectUri() {
  return chrome.identity.getRedirectURL();
}

export function googleSignOut() {
  token = null;
  expiresAt = 0;
}

async function auth(interactive) {
  if (token && Date.now() < expiresAt - 60000) return token;
  const { googleClientId } = await chrome.storage.local.get('googleClientId');
  if (!googleClientId) throw new Error('Walang Google client ID. Buksan ang 🔌 Connect at sundan ang setup.');

  const url =
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    new URLSearchParams({
      client_id: googleClientId,
      response_type: 'token',
      redirect_uri: googleRedirectUri(),
      scope: SCOPES.join(' '),
      // Tahimik na pagbawi kapag buhay pa ang session ng Google sa Chrome na ito.
      ...(interactive ? { prompt: 'consent' } : { prompt: 'none' }),
    });

  const redirect = await chrome.identity.launchWebAuthFlow({ url, interactive });
  if (!redirect) throw new Error('Hindi natuloy ang pag-connect sa Google.');
  const frag = new URLSearchParams(new URL(redirect).hash.slice(1));
  const t = frag.get('access_token');
  if (!t) throw new Error(frag.get('error') || 'Walang natanggap na token mula sa Google.');
  token = t;
  expiresAt = Date.now() + (+frag.get('expires_in') || 3600) * 1000;
  return token;
}

// Isang tawag sa Google API. Kapag nag-expire ang token, isang tahimik na pagbawi
// muna bago sumuko — hindi dapat pahirapan ang user tuwing oras.
async function api(path, opts = {}, retry = true) {
  const t = await auth(false).catch(() => auth(true));
  const res = await fetch('https://www.googleapis.com' + path, {
    ...opts,
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (res.status === 401 && retry) {
    googleSignOut();
    return api(path, opts, false);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `Google API ${res.status}`);
  return data;
}

export async function googleConnect() {
  googleSignOut();
  await auth(true);
  const me = await api('/oauth2/v2/userinfo');
  return me.email || 'konektado';
}

export async function googleWhoami() {
  const me = await api('/oauth2/v2/userinfo');
  return me.email || null;
}

// --- Mga tool na nakikita ng agent ---
export const GOOGLE_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'gmail_search',
      description:
        'Maghanap sa Gmail ng user. Ginagamit ang search syntax ng Gmail (hal. "from:client@x.com is:unread newer_than:7d"). Ibinabalik ang mga id, mula kanino, paksa, petsa, at unang bahagi — hindi ang buong laman, para makatipid. Gamitin ang gmail_read para sa buong mensahe.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Gmail search query.' },
          limit: { type: 'number', description: 'Ilang mensahe. Default 10, hanggang 25.' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'gmail_read',
      description: 'Basahin ang buong laman ng isang email gamit ang id nito mula sa gmail_search.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'gmail_send',
      description:
        'Magpadala ng email mula sa Gmail ng user. TOTOO itong pagpapadala at hindi na maibabalik — siguraduhing tama ang tatanggap at ang laman bago tumawag.',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Email ng tatanggap.' },
          subject: { type: 'string' },
          body: { type: 'string', description: 'Plain text na laman.' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sheets_read',
      description: 'Basahin ang isang saklaw sa Google Sheets. Ang spreadsheet id ay ang mahabang bahagi ng URL sa pagitan ng /d/ at /edit.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Spreadsheet id.' },
          range: { type: 'string', description: 'Hal. "Sheet1!A1:F50". Default "A1:Z100".' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sheets_append',
      description:
        'Magdagdag ng mga hilera sa dulo ng isang Google Sheet. ITO ANG GAMITIN kapag sinabi ng user na ilagay sa Sheets ang nakolekta mo — isang tawag para sa lahat ng hilera, hindi isa-isa.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Spreadsheet id.' },
          rows: {
            type: 'array',
            items: { type: 'array', items: { type: 'string' } },
            description: 'Listahan ng hilera; bawat hilera ay listahan ng cell.',
          },
          range: { type: 'string', description: 'Default "Sheet1!A1".' },
        },
        required: ['id', 'rows'],
      },
    },
  },
];

const b64url = (s) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

// Ang laman ng email ay nasa nested na parts — hinahanap ang plain text.
function bodyOf(part) {
  if (!part) return '';
  if (part.mimeType === 'text/plain' && part.body?.data) {
    return atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
  }
  for (const p of part.parts || []) {
    const t = bodyOf(p);
    if (t) return t;
  }
  return '';
}

export async function runGoogleTool(name, args) {
  switch (name) {
    case 'gmail_search': {
      const n = Math.min(Math.max(Math.round(args.limit || 10), 1), 25);
      const list = await api(
        `/gmail/v1/users/me/messages?q=${encodeURIComponent(args.query)}&maxResults=${n}`
      );
      const ids = (list.messages || []).map((m) => m.id);
      if (!ids.length) return { bilang: 0, mga_mensahe: [], tala: 'Walang tumugma sa paghahanap.' };
      const mga_mensahe = await Promise.all(
        ids.map(async (id) => {
          const m = await api(
            `/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`
          );
          const h = Object.fromEntries((m.payload?.headers || []).map((x) => [x.name, x.value]));
          return { id, mula: h.From, paksa: h.Subject, petsa: h.Date, simula: (m.snippet || '').slice(0, 180) };
        })
      );
      return { bilang: mga_mensahe.length, mga_mensahe };
    }
    case 'gmail_read': {
      const m = await api(`/gmail/v1/users/me/messages/${args.id}?format=full`);
      const h = Object.fromEntries((m.payload?.headers || []).map((x) => [x.name, x.value]));
      return {
        mula: h.From,
        para_kay: h.To,
        paksa: h.Subject,
        petsa: h.Date,
        laman: (bodyOf(m.payload) || m.snippet || '').slice(0, 12000),
      };
    }
    case 'gmail_send': {
      const raw = [
        `To: ${args.to}`,
        `Subject: ${args.subject}`,
        'Content-Type: text/plain; charset=UTF-8',
        '',
        args.body,
      ].join('\r\n');
      const r = await api('/gmail/v1/users/me/messages/send', {
        method: 'POST',
        body: JSON.stringify({ raw: b64url(raw) }),
      });
      return { ok: true, id: r.id, naipadala_kay: args.to };
    }
    case 'sheets_read': {
      const range = encodeURIComponent(args.range || 'A1:Z100');
      const r = await api(`/v4/spreadsheets/${args.id}/values/${range}`);
      return { saklaw: r.range, mga_hilera: r.values || [] };
    }
    case 'sheets_append': {
      const range = encodeURIComponent(args.range || 'Sheet1!A1');
      const r = await api(
        `/v4/spreadsheets/${args.id}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        { method: 'POST', body: JSON.stringify({ values: args.rows || [] }) }
      );
      return { ok: true, naidagdag: r.updates?.updatedRows || 0, saklaw: r.updates?.updatedRange };
    }
    default:
      return { error: `Hindi kilalang Google tool: ${name}` };
  }
}

export const GOOGLE_TOOL_NAMES = new Set(GOOGLE_TOOLS.map((t) => t.function.name));
