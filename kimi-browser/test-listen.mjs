import assert from 'node:assert';
import { listenPage } from './page-fns.js';

// Isang video na naglalabas ng caption sa paglipas ng panahon, gaya ng totoo.
let t = 0;
const cues = [['Kumusta kayong lahat'], ['Ngayon ay pag-uusapan natin'], ['Kumusta kayong lahat']];
const video = {
  tagName: 'VIDEO', currentSrc: 'https://x.com/v.mp4', paused: false,
  muted: false, volume: 1, currentTime: 12.4, duration: 300,
  textTracks: [{ mode: 'disabled', get activeCues() { return (cues[t] || []).map((text) => ({ text })); } }],
};
globalThis.document = {
  querySelectorAll: (sel) => (sel.includes('video') ? [video] : []),
};

const p = listenPage(2);
const tick = setInterval(() => t++, 450);
const r = await p;
clearInterval(tick);

console.log('transcript:', JSON.stringify(r.transcript));
assert.equal(video.textTracks[0].mode, 'hidden', 'binubuksan ang naka-disable na track — kung hindi, walang cue');
assert.match(r.transcript, /Kumusta kayong lahat/);
assert.match(r.transcript, /pag-uusapan natin/);
assert.equal(r.transcript.split('\n').length, 2, 'walang inuulit na linya');
assert.equal(r.media[0].tumutugtog, true);
assert.equal(r.media[0].haba, 300);
assert.equal(r.tala, null, 'walang babala kapag may nakuhang caption');

// Walang media sa page: dapat malinaw ang sabihin, hindi tahimik na mabigo.
globalThis.document = { querySelectorAll: () => [] };
const empty = await listenPage(2);
assert.equal(empty.transcript, null);
assert.match(empty.tala, /Walang video o audio/);
console.log('OK — nakukuha ang caption sa paglipas ng panahon, at malinaw kapag wala');
