import assert from 'node:assert';
import { readWhisperTab } from './page-fns.js';

// Ginagaya ang tunay na stream.wasm: may debug log, may placeholder, may transcript.
const page = (transcript, status) => {
  const areas = [
    { value: 'js: Initialized successfully!\nloadRemote: storage quota: 10797134251 bytes\nfetchRemote: fetching 100% ...' },
    { value: transcript },
  ];
  globalThis.document = {
    querySelectorAll: () => areas,
    body: { innerText: `Whisper model: loaded "base"!\nStatus: ${status}\n` },
  };
};

// Ang debug log ay MAS MAHABA kaysa sa transcript — dito madaling magkamali.
page('Kumusta, ano ang karanasan mo sa SEO?', 'running');
let r = readWhisperTab();
assert.equal(r.transcript, 'Kumusta, ano ang karanasan mo sa SEO?', 'hindi napipili ang debug log');
assert.equal(r.status, 'running');
assert.equal(r.model, 'base');

// Hindi pa nagsisimula: placeholder lang ang laman.
page('[The transcribed text will be displayed here]', 'not started');
r = readWhisperTab();
assert.equal(r.transcript, null, 'ang placeholder ay hindi transcript');
assert.match(r.status, /not started/);
console.log('OK — nababasa ang whisper tab, hindi ang debug log nito');
