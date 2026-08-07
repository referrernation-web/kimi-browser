import assert from 'node:assert';
import { typeRef } from './page-fns.js';

// Ang eksaktong dropdown na kinalaban niya: whisper.cpp stream.wasm language picker.
const mk = () => {
  const opts = [
    { value: 'en', text: 'English' },
    { value: 'tl', text: 'Filipino' },
    { value: 'es', text: 'Spanish' },
  ];
  return {
    tagName: 'SELECT', options: opts, value: 'en',
    scrollIntoView() {}, dispatchEvent() {},
  };
};
const run = (el, text) => { window.__kimiRefs = new Map([['r', el]]); return typeRef('r', text, false); };
globalThis.window = {};

// Tugma sa nakikitang label — ito ang gagamitin ng model.
let el = mk();
let r = run(el, 'Filipino');
assert.equal(r.ok, true);
assert.equal(el.value, 'tl', 'napili ang tamang value, hindi lang teksto');
assert.equal(r.napili, 'Filipino');

// Tugma sa value code.
el = mk(); run(el, 'tl');
assert.equal(el.value, 'tl');

// Hindi case-sensitive at bahagi lang.
el = mk(); run(el, 'filip');
assert.equal(el.value, 'tl');

// Kapag walang tugma, IBINABALIK ang mapagpipilian — dito nakakabawi ang model.
el = mk();
r = run(el, 'Tagalog Republic');
assert.equal(r.ok, false);
assert.deepEqual(r.mapagpipilian, ['English', 'Filipino', 'Spanish']);
assert.equal(el.value, 'en', 'hindi ginagalaw kapag walang tugma');
console.log('OK — napipili na niya ang dropdown (4 na tseke)');
