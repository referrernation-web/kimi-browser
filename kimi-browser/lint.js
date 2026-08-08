// SURIIN ANG ARTIKULO BILANG CODE — walang model call, walang gastos, walang pagkakaiba
// sa bawat takbo.
//
// Ang Part 13 ng master prompt ay isang checklist na apatnapung aytem. Karamihan doon
// ay masusukat nang tiyak: may em dash ba, ilang table, may id ba ang bawat H2, may
// tamang rel ba ang link sa kalaban. Hindi ito trabaho ng modelo. Sa tatlong setting
// ng pag-iisip na sinukat ko sa parehong gawain, LAHAT ay pumalya sa parehong tatlo:
// walang <table>, walang id sa <h2>, at walang tamang $N CAD. Hindi ito naaayos ng mas
// malakas na modelo o mas mahabang pag-iisip — code lang ang hindi nakakalimot.
//
// Purong function ito: pumapasok ang HTML, lumalabas ang listahan. Walang chrome API.

const teksto = (html) =>
  String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

const bilang = (html, re) => (String(html || '').match(re) || []).length;

// Ang mga JSON-LD block, pinagsama — dito hinahanap ang schema.
const schema = (html) =>
  [...String(html || '').matchAll(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1])
    .join('\n');

// Bawat <a>, hiwa-hiwalay, para masuri ang href at ang rel nang magkasama.
// Ang HOST ang hinihiwalay, hindi ang buong URL: ang "hamuq.com/blogs/news/hamuq-vs-douglas"
// ay PANLOOB na link kahit may "douglas" sa daan, at ang "naplab.com/…/douglas-review"
// ay pinagmulan, hindi kalaban. Limang maling alarma ang naidulot nito sa gold standard.
function mgaLink(html) {
  return [...String(html || '').matchAll(/<a\s+([^>]*)>/gi)].map((m) => {
    const attr = m[1];
    const href = (/href\s*=\s*["']([^"']*)["']/i.exec(attr) || [, ''])[1];
    const rel = (/rel\s*=\s*["']([^"']*)["']/i.exec(attr) || [, ''])[1].toLowerCase();
    let host = '';
    try { host = new URL(href, 'https://hamuq.com').hostname.replace(/^www\./, ''); } catch {}
    return { href, rel, host, raw: m[0] };
  });
}

const KALABAN = /^(endy|douglas|silkandsnow|silk-and-snow|logancove|logan-and-cove|casper|polysleep|purple|nectarsleep|emma-?sleep|sleepcountry|dormezvous)\.|\.(endy|douglas|casper)\./i;
const AUTORIDAD = /\.gov(\.|\/|$)|\.edu(\.|\/|$)|canada\.ca|statcan|nrcan|healthcanada|csagroup|oeko-tex|global-standard|controlunion|certipur|pubmed|nih\.gov|ncbi\.nlm|doi\.org|who\.int/i;

// Ang bawat panuntunan ay isang function: html + opsyon → {ok, label, detail}.
// Ang `detail` ay isinusulat para maibalik nang diretso sa modelo bilang utos.
const PANUNTUNAN = [
  // ---------- Estilo (Part 9) ----------
  (h) => {
    const n = bilang(teksto(h), /[—–]/g);
    return { ok: !n, label: 'Walang em dash o en dash', detail: n ? `${n} ang nakita. Palitan ng kuwit, tuldok, o "to" sa hanay.` : '' };
  },
  (h) => {
    // Kailangan ang (?!\d) bago ang (?!\s*CAD). Kung wala iyon, umuurong ang regex at
    // tumutugma sa PREFIX: sa "$599 CAD" ay hinuhuli nito ang "$59" dahil ang sumusunod
    // na "9" ay hindi CAD. Ipinakita ito ng sariling gold standard ng user — limang
    // maling alarma sa isang artikulong tama ang lahat ng presyo.
    // Kailangan ang (?![\d,]) — hindi lang (?!\d). Sa "$1,100 CAD" ay umuurong ang
    // regex hanggang sa "$1" (dahil ang sumusunod na "," ay hindi digit) at inaakusahan
    // ang isang tamang presyo. Ang KUWIT ay bahagi ng bilang, kaya dapat kasama ito sa
    // pagbabawal. Napansin ito sa gold standard ng user.
    const mali = [...teksto(h).matchAll(/CAD\s*\$[\d,.]+|\$[\d,]+(?:\.\d\d)?(?![\d,])(?!\s*CAD)/g)]
      .map((m) => m[0]).slice(0, 5);
    return { ok: !mali.length, label: 'Presyo sa hugis na $999 CAD', detail: mali.length ? `Mali: ${mali.join(', ')}. Laging halaga bago ang CAD.` : '' };
  },
  (h) => {
    const n = bilang(teksto(h), /\bpercent\b/gi);
    return { ok: !n, label: 'Canadian na baybay: "per cent"', detail: n ? `${n} ang "percent". Hatiin ito: "per cent".` : '' };
  },
  (h) => {
    const nat = [...String(h).matchAll(/\[INSERT [^\]]*\]/gi)].map((m) => m[0]).slice(0, 4);
    return { ok: !nat.length, label: 'Walang natirang placeholder', detail: nat.length ? nat.join(', ') : '' };
  },

  // ---------- Istruktura (Part 2) ----------
  (h) => {
    // ZERO ay TAMA sa Shopify. Ang tema ang nagre-render ng H1 mula sa Title field ng
    // blog post, kaya ang ipinapasteng katawan ay dapat WALANG H1 — kung meron, dalawa
    // ang H1 ng pahina. Ginagamit ng gold standard ng user ang <h2> sa hero nang sadya.
    // Ang dalawa o higit pa ang mali.
    const n = bilang(h, /<h1[\s>]/gi);
    return {
      ok: n <= 1,
      label: 'Isa o walang H1 sa katawan',
      detail: n <= 1 ? (n ? '1' : '0 — ang tema ng Shopify ang naglalagay ng H1 mula sa Title') : `${n} ang nakita. Isa lang ang H1 kada pahina.`,
    };
  },
  (h) => {
    const n = bilang(h, /<table[\s>]/gi);
    return { ok: n >= 3, label: 'Tatlo o higit pang tunay na table', detail: n >= 3 ? `${n}` : `${n} lang. Ang talahanayan ang pinaka-nakukuha ng AI; layunin ay lima.` };
  },
  (h) => {
    const lahat = [...String(h).matchAll(/<h2\b([^>]*)>/gi)];
    const wala = lahat.filter((m) => !/\bid\s*=/i.test(m[1])).length;
    return {
      ok: lahat.length > 0 && !wala,
      label: 'May id anchor ang bawat H2',
      detail: !lahat.length ? 'Walang H2.' : wala ? `${wala} sa ${lahat.length} ang walang id. Ito ang binibigyan ng AI ng deep link sa mismong seksyon.` : '',
    };
  },
  (h) => {
    // Ang seksyon ng FAQ LANG, hindi ang buong natitirang pahina. Ang unang "faq" sa
    // dokumento ay ang link sa talaan ng nilalaman (#faq), at ang pagbibilang mula
    // doon ay kasama ang bawat h3 sa mga kard, sa selector, at sa CTA — dalawampu sa
    // isang totoong artikulo na may pitong FAQ. Ang maling alarma ay ipinagwawalang-bahala,
    // kaya mas masahol pa iyon sa walang tseke.
    const s = String(h);
    const ulo = /<h2[^>]*\bid\s*=\s*["']faq["'][^>]*>|<h2[^>]*>[^<]*\bFAQ\b[^<]*<\/h2>|<h2[^>]*>[^<]*\bquestions?\b[^<]*<\/h2>/i.exec(s);
    if (!ulo) return { ok: false, label: 'Limang hanggang pitong FAQ', detail: 'Walang nakitang seksyon ng FAQ.' };
    const simula = ulo.index + ulo[0].length;
    const susunod = s.slice(simula).search(/<h2[\s>]/i);
    const n = bilang(s.slice(simula, susunod < 0 ? s.length : simula + susunod), /<h3[\s>]/gi);
    return { ok: n >= 5 && n <= 7, label: 'Limang hanggang pitong FAQ', detail: n >= 5 && n <= 7 ? `${n}` : `${n} ang nakita. Dapat 5 hanggang 7.` };
  },

  // ---------- Mga link (Part 6) — ito mismo ang hinihingi ng user ----------
  (h) => {
    const loob = mgaLink(h).filter((a) => /hamuq\.com|^\/(blogs|products|collections)/i.test(a.href));
    return {
      ok: loob.length >= 3,
      label: 'Panloob na link (hub, spoke, produkto)',
      detail: loob.length >= 3 ? `${loob.length}` : `${loob.length} lang. Dapat may link pataas sa hub, isa hanggang tatlong kapatid, at dalawang beses sa product page.`,
    };
  },
  (h) => {
    const pdp = mgaLink(h).filter((a) => /\/products\//i.test(a.href)).length;
    return { ok: pdp >= 2, label: 'Dalawang beses na naka-link ang product page', detail: pdp >= 2 ? `${pdp}` : `${pdp} lang. Isa malapit sa Short Answer, isa sa katawan.` };
  },
  (h) => {
    const src = mgaLink(h).filter((a) => AUTORIDAD.test(a.host));
    return { ok: src.length >= 1, label: 'May link sa pinagmulan (Health Canada, CSA, StatsCan, pag-aaral)', detail: src.length ? `${src.length}` : 'Wala. Dito mahina ang Sleep Foundation at Forbes — huwag itong palampasin.' };
  },
  (h) => {
    const mali = mgaLink(h).filter(
      (a) => KALABAN.test(a.host) && !(a.rel.includes('nofollow') && a.rel.includes('noopener') && a.rel.includes('noreferrer'))
    );
    return {
      ok: !mali.length,
      label: 'Link sa kalaban: nofollow noopener noreferrer',
      detail: mali.length ? `${mali.length} ang kulang: ${mali.slice(0, 3).map((a) => a.href).join(', ')}` : '',
    };
  },
  (h) => {
    const mali = mgaLink(h).filter((a) => AUTORIDAD.test(a.host) && a.rel.includes('nofollow'));
    return {
      ok: !mali.length,
      label: 'Ang pinagmulan ay dofollow, hindi nofollow',
      detail: mali.length ? `${mali.map((a) => a.href).slice(0, 3).join(', ')} — positibong senyas ang pag-link sa mapagkakatiwalaan.` : '',
    };
  },
  (h) => {
    const mali = mgaLink(h).filter((a) => /hamuq\.com|^\//i.test(a.href) && a.rel.includes('nofollow'));
    return { ok: !mali.length, label: 'Ang panloob na link ay walang rel', detail: mali.length ? `${mali.length} ang naka-nofollow. Panatilihin ang equity sa loob ng site.` : '' };
  },

  // ---------- Schema (Part 3) ----------
  (h) => {
    const s = schema(h);
    const a = bilang(s, /"@type"\s*:\s*"(Article|BlogPosting)"/g);
    const f = bilang(s, /"@type"\s*:\s*"FAQPage"/g);
    return { ok: a === 1 && f === 1, label: 'Isang Article at isang FAQPage node', detail: a === 1 && f === 1 ? '' : `Article: ${a}, FAQPage: ${f}.` };
  },
  (h) => {
    const s = schema(h);
    const may = /"@type"\s*:\s*"Product"/.test(s);
    return {
      ok: !may || (/positiveNotes/.test(s) && /negativeNotes/.test(s)),
      label: 'May positiveNotes at negativeNotes ang Product',
      detail: !may ? 'walang Product node' : 'Dito muling nabubuo ng AI ang ranked list mula sa schema lang.',
    };
  },
  (h) => {
    const s = schema(h);
    const may = /"@type"\s*:\s*"LocalBusiness"/.test(s);
    const array = /"areaServed"\s*:\s*\[/.test(s);
    return { ok: may && array, label: 'LocalBusiness na may areaServed bilang array', detail: !may ? 'Walang LocalBusiness node (Gate 4).' : array ? '' : 'Ang areaServed ay dapat listahan ng probinsya, hindi "Canada".' };
  },
  (h) => {
    const s = schema(h);
    const video = bilang(h, /<iframe[^>]*(youtube|youtu\.be|vimeo)/gi);
    const node = bilang(s, /"@type"\s*:\s*"VideoObject"/g);
    return { ok: !video || node >= video, label: 'Isang VideoObject kada naka-embed na video', detail: !video ? 'walang video' : `${video} video, ${node} node.` };
  },

  // ---------- Disenyo at pag-access (Part 8) ----------
  (h) => {
    const mali = [...String(h).matchAll(/<[a-z]+[^>]*\son[a-z]+\s*=/gi)].length;
    return { ok: !mali, label: 'Walang inline na on* handler', detail: mali ? `${mali} ang nakita. Tinatanggal ito ng sanitizer ng Shopify sa bawat save — patay na buton.` : '' };
  },
  (h) => ({ ok: /prefers-reduced-motion/.test(h), label: 'May prefers-reduced-motion na bloke', detail: '' }),
  (h) => {
    const mali = [...String(h).matchAll(/<img\b(?![^>]*\balt\s*=)[^>]*>/gi)].length;
    return { ok: !mali, label: 'May alt ang bawat larawan', detail: mali ? `${mali} ang walang alt.` : '' };
  },
  (h) => {
    // Ang _1600x at _760x ay TAMA — hinihingi mismo ng master prompt (8.7) ang
    // tamang-laking variant: _1600x sa hero, _760x sa dalawang-hanay na grid. Ang mali
    // ay ang MALIIT na thumbnail (_430x pababa) na ginamit sa isang malaking puwang.
    // At ang ibang host (halimbawa, larawan ng may-akda) ay hindi Shopify CDN, kaya
    // hindi ito hinahatulan ng panuntunang ito. Tatlong maling alarma ang naidulot nito
    // sa gold standard ng user.
    const maliit = [...String(h).matchAll(/https:\/\/[^"'\s]*(?:cdn\.shopify\.com|hamuq\.com\/cdn)[^"'\s]*?_(\d+)x/g)]
      .filter((m) => +m[1] < 700).map((m) => m[0]).slice(0, 3);
    const signed = /X-Goog-Expires|shopify-private-shop-assets/.test(h);
    return {
      ok: !maliit.length && !signed,
      label: 'Permanenteng CDN na URL ng larawan',
      detail: signed ? 'May signed URL — mamamatay ito sa loob ng ilang araw.' : maliit.length ? `Maliit na thumbnail: ${maliit.join(', ')}` : '',
    };
  },
  (h) => {
    // Ang @media na bloke ay HINDI doble — ito ay pagpapalit para sa ibang laki ng
    // screen o para sa reduced-motion, at kailangan nga nitong ulitin ang selector.
    // Tinatanggal muna sila bago magbilang.
    // Ang BUONG selector ang hinahambing, hindi ang huling klase lang. Ang
    // ".hq-anim-ready .hq-proofstrip .hq-badge" ay ibang panuntunan sa ".hq-badge" —
    // may saklaw ito, hindi doble. Maling alarma ito sa gold standard ng user.
    // Tinatanggal din ang @media: pagpapalit iyon, at kailangan nga nitong ulitin.
    const style = (/<style[\s\S]*?<\/style>/i.exec(h) || [''])[0].replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, ' ');
    const sel = [...style.matchAll(/(^|\})\s*([^{}@]+?)\s*\{/g)]
      .map((m) => m[2].replace(/\s+/g, ' ').trim())
      .filter((s) => s.includes('hq-'));
    const doble = [...new Set(sel.filter((s, i) => sel.indexOf(s) !== i))];
    return { ok: !doble.length, label: 'Walang dobleng hq- na selector', detail: doble.length ? doble.slice(0, 5).join(' · ') : '' };
  },

  // ANG PINAKAMADALAS AT PINAKA-HINDI HALATANG SIRA. Isinusulat ang <style> sa unang
  // seksyon; ang mga sumunod ay isinusulat nang hindi na ito nakikita, kaya nag-iimbento
  // siya ng bagong pangalan. Sa isang totoong artikulo: 12 sa 45 na klase ang walang CSS
  // (.hq-ctacard gayong .hq-cta-card ang tinukoy; .hq-verdict at .hq-sources na wala
  // talaga). Mukhang tama ang HTML, pero walang estilo ang mga seksyong iyon paglabas —
  // at hindi ito mapapansin sa isang mabilisang tingin.
  (h) => {
    const style = [...String(h).matchAll(/<style[\s\S]*?<\/style>/gi)].map((m) => m[0]).join('\n');
    if (!style) return { ok: true, label: 'May CSS ang bawat klaseng ginamit', detail: 'walang style block' };
    const may = new Set([...style.matchAll(/\.([a-z][a-z0-9_-]+)/gi)].map((m) => m[1]));
    const gamit = new Set(
      [...String(h).replace(/<style[\s\S]*?<\/style>/gi, '').matchAll(/class\s*=\s*["']([^"']+)["']/gi)]
        .flatMap((m) => m[1].split(/\s+/))
        .filter(Boolean)
    );
    const wala = [...gamit].filter((c) => !may.has(c));
    return {
      ok: !wala.length,
      label: 'May CSS ang bawat klaseng ginamit',
      detail: wala.length ? `${wala.length} ang walang kahulugan: ${wala.slice(0, 8).map((c) => '.' + c).join(' ')}` : `${gamit.size}`,
    };
  },

  // Isang artikulo, isang wrapper. Ang pagsulat kada seksyon ay nagbubukas at nagsasara
  // ng sariling balot sa bawat tawag — limang magkakapatid na bloke sa isang totoong
  // artikulo. Ginugulo ito ng sanitizer ng Shopify at nagdaragdag ng puwang.
  (h) => {
    const n = bilang(h, /<div class="hq-article"/g);
    return { ok: n <= 1, label: 'Isang wrapper lang ng artikulo', detail: n > 1 ? `${n} ang nakita. Buksan ito sa unang seksyon lang at isara sa huli.` : '' };
  },
  (h) => {
    const may = /^\s*<!doctype|<html[\s>]|<head[\s>]/i.test(String(h));
    return { ok: !may, label: 'Fragment, hindi buong pahina', detail: may ? 'Ang laman ng blog sa Shopify ay fragment. Ang doctype, html at head ay hindi dapat naroon.' : '' };
  },
];

// `words` = target na haba (opsyonal). `chart` = true kung reference/chart na pahina.
export function lintArticle(html, opts = {}) {
  const out = PANUNTUNAN.map((r) => {
    const res = r(html || '');
    return { ok: !!res.ok, label: res.label, detail: res.detail || '' };
  });

  if (opts.words) {
    const n = teksto(html).replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    const baba = Math.round(opts.words * 0.8);
    out.push({
      ok: n >= baba,
      label: `Haba: ${n} salita (target ${opts.words})`,
      detail: n >= baba ? '' : `Kulang ng ${baba - n}. Ang manipis na pahina ay hindi umaabot sa lalim ng kasalukuyang #1.`,
    });
  }
  if (opts.chart) {
    const heading = [...String(html).matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map((m) => m[1]);
    const may = heading.some((t) => /20\d\d/.test(t)) || /<title[^>]*>[^<]*20\d\d/i.test(html);
    out.push({
      ok: !may,
      label: 'Walang taon sa heading ng chart na pahina',
      detail: may ? 'Pinaikli nito ang buhay ng isang reference na pahina at sinisira ang tono nito.' : '',
    });
  }
  return out;
}

// Ang mga bumagsak, isinulat bilang utos na maibabalik nang diretso sa modelo.
export function lintPrompt(mga) {
  const bagsak = mga.filter((r) => !r.ok);
  if (!bagsak.length) return '';
  return (
    'Sinuri ko ang artikulo laban sa checklist. Ito ang bumagsak — ayusin ang bawat isa ' +
    'gamit ang write_document (replace_section sa apektadong seksyon), tapos huwag nang ' +
    'baguhin ang iba:\n\n' +
    bagsak.map((r) => `- ${r.label}${r.detail ? ' — ' + r.detail : ''}`).join('\n')
  );
}
