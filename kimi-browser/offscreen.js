// Dito nakukuha ang tunog ng tab. Kailangan ito ng hiwalay na dokumento: ang service
// worker ay walang getUserMedia, at ang side panel ay hindi makakakuha ng tab audio.

const GROQ = 'https://api.groq.com/openai/v1/audio/transcriptions';
const CHUNK_MS = 8000; // mas maikli = mas mabilis makarating, pero mas maputol ang salita

let stream = null;
let ctx = null;
let apiKey = '';
let language = '';

chrome.runtime.onMessage.addListener((m) => {
  if (m.target !== 'offscreen') return;
  if (m.type === 'start-capture') start(m.streamId, m.apiKey, m.language);
  if (m.type === 'stop-capture') stop();
});

const say = (type, payload) => chrome.runtime.sendMessage({ from: 'offscreen', type, ...payload });

async function start(streamId, key, lang) {
  if (stream) return;
  apiKey = key;
  language = lang || '';
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } },
    });
  } catch (e) {
    say('capture-error', { text: e.message });
    return;
  }

  // MAHALAGA: pinapatahimik ng tabCapture ang tab. Ibinabalik natin ang tunog sa speaker,
  // kung hindi ay hindi mo na maririnig ang tawag habang nakikinig ito.
  ctx = new AudioContext();
  ctx.createMediaStreamSource(stream).connect(ctx.destination);

  say('capture-started', {});
  loop();
}

function stop() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  ctx?.close();
  ctx = null;
  say('capture-stopped', {});
}

// Bagong MediaRecorder kada chunk. Ang timeslice sa iisang recorder ay gumagawa ng
// fragment na hindi kayang basahin nang mag-isa — bitag ito na madalas ikinabibigo nito.
function loop() {
  if (!stream) return;
  const rec = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
  const parts = [];
  rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
  rec.onstop = () => {
    const blob = new Blob(parts, { type: 'audio/webm' });
    if (blob.size > 3000) transcribe(blob); // ang katahimikan ay maliit; huwag nang bayaran
    loop();
  };
  rec.start();
  setTimeout(() => rec.state !== 'inactive' && rec.stop(), CHUNK_MS);
}

async function transcribe(blob) {
  const form = new FormData();
  form.append('file', blob, 'a.webm');
  form.append('model', 'whisper-large-v3-turbo');
  form.append('response_format', 'text');
  if (language) form.append('language', language);

  let res;
  try {
    res = await fetch(GROQ, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form });
  } catch (e) {
    say('capture-error', { text: `Groq: ${e.message}` });
    return;
  }
  if (!res.ok) {
    say('capture-error', { text: `Groq ${res.status}: ${(await res.text()).slice(0, 200)}` });
    if (res.status === 401) stop(); // maling key — huwag nang ulitin kada 8 segundo
    return;
  }

  const text = (await res.text()).trim();
  // Ibinabalik ng Whisper ang "you" o "." sa katahimikan. Hindi ito sulit ipasa.
  if (text.length > 2) say('transcript', { text });
}
