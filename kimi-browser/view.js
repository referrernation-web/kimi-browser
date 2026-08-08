// BUONG-PAHINA NA TINGIN NG ISANG DOKUMENTO.
//
// Dati, gumagawa ang panel ng blob URL at binubuksan ito sa isang tab — tapos
// nire-revoke pagkalipas ng 120 segundo. Ang bunga ay nakita sa totoong paggamit:
// isang tab na "Your file couldn't be accessed — ERR_FILE_NOT_FOUND". Iyon mismo
// ang ibinibigay ng Chrome para sa na-revoke na blob. Namamatay din ito kapag
// isinara ang panel, o kapag ibinalik ng Chrome ang tab pagkatapos mag-restart.
//
// Dito, ang tab mismo ang bumabasa mula sa storage. Nabubuhay ito habang nandiyan
// ang dokumento — kayang i-reload, i-bookmark, at ibalik pagkatapos ng restart.
//
// Ang laman ay nasa loob ng SANDBOXED na iframe: nakakakuha ito ng sariling
// opaque origin at sariling CSP, kaya tumatakbo ang <script> ng artikulo (ang mga
// animation) nang hindi maaabot ang extension. Ang laman ay galing sa modelo,
// hindi sa atin — hindi ito dapat magkaroon ng access sa storage o sa mga API.

import { docGet, docAsHtml } from './docs.js';

const sid = new URLSearchParams(location.search).get('s') || '';
const msg = document.getElementById('msg');

const pahina = (doc, html) =>
  doc.html
    ? `<!doctype html><meta charset="utf-8"><title>${doc.title}</title>${html}`
    : `<!doctype html><meta charset="utf-8"><title>${doc.title}</title>
<style>
  @page { size: letter; margin: 25mm; }
  body { background:#f0f0f4; margin:0; padding:28px 16px 60px;
    font:16px/1.7 Georgia,"Times New Roman",serif; color:#1a1a1a; }
  .sheet { background:#fff; max-width:760px; margin:0 auto; padding:64px 72px;
    box-shadow:0 3px 18px #00000022; border-radius:2px; }
  h1 { font-size:27px; line-height:1.25; text-align:center; margin:0 0 28px; }
  h2 { font-size:20px; margin:30px 0 10px; }
  h3 { font-size:17px; margin:22px 0 8px; }
  p, li { margin:0 0 13px; }
  ul, ol { padding-left:26px; }
  blockquote { margin:0 0 13px; padding-left:16px; border-left:3px solid #ddd; color:#555; }
  .meta { text-align:center; color:#888; font:12px/1.5 ui-sans-serif,system-ui,sans-serif; margin:-18px 0 30px; }
  @media print { body { background:#fff; padding:0; } .sheet { box-shadow:none; max-width:none; padding:0; } }
</style>
<div class="sheet"><h1>${doc.title}</h1>
<div class="meta">${doc.words} salita · ${doc.sections.length} seksyon · Ctrl+P para i-print o gawing PDF</div>
${html}</div>`;

(async () => {
  const doc = await docGet(sid);
  if (!doc) {
    msg.textContent =
      'Wala na ang dokumentong ito. Sampung pinakabago lang ang naiimbak — ' +
      'kung kailangan mo pa ito, i-download mo muna sa susunod bago magsulat ng bago.';
    return;
  }
  document.title = doc.title;
  const fr = document.createElement('iframe');
  fr.sandbox = 'allow-scripts';
  fr.srcdoc = pahina(doc, await docAsHtml(sid));
  document.body.replaceChildren(fr);
})().catch((e) => {
  msg.textContent = 'Hindi mabuksan ang dokumento: ' + (e?.message || e);
});
