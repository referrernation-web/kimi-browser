# Dianna.ai

> ⚠️ **PRIVATE na ang repo na ito** — may naka-baked na Cartesia API key sa
> `sidepanel.js`. Huwag itong gawing public habang nandiyan ang key.

## Anong bago sa v0.23.0 (kinokopya na ang disenyo, at hindi na basura ang export)

Sinukat ko ang totoong master prompt ng Hamuq: **73,115 karakter**. Dalawang bagay ang
lumabas, at pareho silang nagpapaliwanag kung bakit "hindi niya nakokopya yung design".

**Isa: 11% lang ang nakikita niya.** Ang laman ng master prompt ay dumadaan LANG sa
`search_files` — limang tipak na tig-800 karakter, mga 4,000 kada tawag. Mas malala: ang
ranking (`overlap / sqrt(size)`) ay **kumikiling sa MAIIKLING tipak**, kabaligtaran mismo
ng mahahabang CSS at HTML na kailangan. Sinasabi ng prompt na "SUNDIN ITO NANG BUO"
habang ang mekanismo ay kayang magbigay ng pira-piraso lang. Hindi ito naaayos ng
pagtutuno: sa isang design system, LAHAT ng linya ay kailangan ng LAHAT ng seksyon.

**Dalawa: ang Part 8 ay PROSA, hindi CSS.** Ganito ang nakasulat doon:
*"border-radius:13px; padding:2px (the 2px of visible gradient IS the border)"*.
Iyon ay paglalarawan ng CSS sa Ingles. Kaya kada artikulo, **muling ginagawa** niya ang
buong stylesheet mula sa deskripsyon — hindi kumokopya, gumagawa ng bago. Iyon ang
dahilan kung bakit iba-iba ang labas.

Ang naging sagot:

- **🎨 Template ng disenyo** — bagong marka sa tabi ng 📌. I-upload ang isang
  **naipadala nang artikulo** (`*-PUBLISH-READY.html`) at pindutin ang 🖌. Kinukuha
  nito ang TOTOONG `<style>`, ang script ng animation, at ang balangkas ng markup —
  at tinatanggal ang JSON-LD, para hindi madala ang lumang headline at petsa sa bago.
- **Buo at verbatim ang injection sa Write mode** — nasa system prompt na niya ang
  buong 📌 at 🎨, byte-exact. Hindi na siya naghahanap para sa disenyo, kaya **mas
  mabilis pa** (dalawang round trip ang natanggal). Sa ibang mode, listahan pa rin ng
  pangalan lang — hindi binabayaran ang 33k token para lang tingnan ang Gmail.
- **Nakalaan na ang puwang sa search para sa totoong datos.** Dati, ang 91 tipak ng
  master prompt ang sumasakop sa buong top-5 at nagugutom ang dokumento ng na-verify
  na facts. Hindi na hinahanap ang naipasok nang buo.
- **Sinasabi na niya kapag walang disenyo.** Dati, tahimik siyang nag-iimbento ng
  sariling palette — mukhang tagumpay hanggang makita ng kliyente na mali ang kulay.
- **Inayos ang export.** Ang `docAsPlainMarkdown` ay ginawa mismo para sa `.docx`,
  `.pdf` at `.pptx` — pero **hindi ito kailanman na-import**. Kaya ang ibinibigay sa
  kliyente ay may literal na `<section class="hq-hero">` at `<style>`. Naka-wire na,
  at sinasabi na ng bawat file card kung alin ang may disenyo at alin ang teksto lang.
- **Totoo nang preview.** Iframe na ngayon, hindi `innerHTML` — kaya tumatakbo ang mga
  animation at hindi nag-aaway ang CSS ng artikulo sa CSS ng panel.
- **Bagong `probe.mjs`** — TOTOONG binubuksan ng Chrome ang `sidepanel.js` at
  pinipindot ang mga buton na gawa sa runtime. Ang `test-modules` ay tumitingin ng
  syntax; ang `test-wiring` ay tumitingin kung may naka-assign na handler. Wala sa
  dalawa ang makakahuli ng buton na pumuputok kapag pinindot. Nahuli nito ang isang
  tunay na `SyntaxError` habang ginagawa ito.

## Anong bago sa v0.22.0 (prompt scanner, at INAYOS ang nawalang Projects)

> ⚠️ **Ang v0.20.1 at v0.21.0 ay walang gumaganang 📁 Projects.** Nang alisin ko ang
> naiwang lumang bloke ng code sa v0.20.1, kasamang nadala ang buong Projects UI —
> walang nangyayari kapag pinindot, at walang error. Naibalik na ito.

- **Prompt scanner: i-paste ang link** — bagong URL field sa loob ng project. Google
  Docs, Google Sheets, GitHub, o kahit anong naka-host na `.md`. Kinukuha nito ang
  teksto at ginagawang dokumento ng project, kaya hindi mo na kailangang mag-download
  at mag-upload pa. Kapag private ang Google Doc, malinaw ang sabi kung ano ang gagawin:
  Share → General access → Anyone with the link → Viewer.
- **📌 Master prompt** — markahan ang isang dokumento gamit ang ☆. Kapag may nakamarka,
  TAHASANG tinuturo ito sa system prompt bilang batayan ng istruktura, ng pangalan ng
  CSS class, at ng palette — at bawal siyang mag-imbento ng sariling disenyo o kulay.
  Ito ang sagot sa "hindi malinaw kung saan niya kukunin ang prompt".
- **Bagong `test-wiring.mjs`** — tinitingnan kung may handler ang BAWAT buton at kung
  totoo ang lahat ng import. Pinatunayan kong nahuhuli nito ang mismong regression na
  ito bago ko ipinadala. Ang module test ay hindi ito nahuli dahil valid pa rin ang
  syntax; ang unit tests naman ay hindi hinahawakan ang UI.

## Anong bago sa v0.21.0 (HTML na disenyo, wika, at hindi na nagsasayang)

- **HTML na dokumento** — kapag may design system ang project, isinusulat na ng agent
  ang seksyon bilang TUNAY NA HTML at itinatago nang BUO, kasama ang mga klase, style,
  at script. Dati, dinadaan sa markdown converter kaya nawawala ang buong disenyo.
  Kusang nakikilala kung HTML — walang flag na kailangang ipasa.
- **Wika ng dokumento, hiwalay sa wika ng usapan** — bagong ikaapat na tanong sa wizard.
  English ang default. Dati, Tagalog ang lumalabas na artikulo para sa Canadian na brand
  dahil Tagalog ang usapan; hiwalay na sila ngayon.
- **Walang project = walang search_files** — hindi na ibinibigay ang tool na tiyak na
  babagsak. Sa isang totoong takbo, limang sunod-sunod na pagkabigo ang nasayang doon.
- **Bantay sa paulit-ulit na PAGKABIGO** — dati, ang loop guard ay humuhuli lang ng
  eksaktong parehong tawag, kaya nakakalusot ang limang search_files na iba-iba ang
  query. Ngayon, binibilang ang pagkabigo kada tool: sa ikatlo, inaalis na ito sa schema.
- **Babala sa wizard** kapag walang project — malinaw na sinasabing generic at
  puro placeholder ang lalabas, may buton na dumiretso sa 📁 Projects.

## Anong bago sa v0.20.1 (INAYOS: blangkong panel)

> ⚠️ **Kung blangko ang panel mo, ito ang ayos.** Ang v0.18.0 hanggang v0.20.0 ay SIRA.

**Ang sira:** nang isulat kong muli ang Connectors sa v0.18.0, naiwan ang lumang bloke,
kaya naging DOBLE ang `mcpPing`. Sa ES module, ang doblehing deklarasyon ay SyntaxError —
hindi tumatakbo ang BUONG `sidepanel.js`, kaya blangkong panel na walang tab at walang
settings.

**Bakit hindi nahuli sa tatlong bersyon:** ginagamit ko ang `node --check sidepanel.js`,
at sinusuri niyan ang file bilang **CommonJS** — doon, LEGAL ang doblehing function.
Ang extension ay **ES module**, kung saan iyon ay error. Maling mode ang sinusuri ko.

**Ang bantay ngayon:** bagong `test-modules.mjs` na sumusuri sa LAHAT ng 15 module sa
TAMANG mode (kinokopya bilang `.mjs` para pilitin ang module semantics), at may dagdag
na tseke para sa doblehing top-level na pangalan. Pinatunayan kong nahuhuli nito ang
mismong sirang bersyon bago ko ito ipinadala.

**Dagdag na ayos:** ang dropdown ng model ay sinasala na — hindi na lalabas ang
`wan2.7-image`, `qwen-audio-3.0-tts-plus`, at iba pang image, TTS, o embedding na model
na hindi naman makakasagot ng chat, dahil tahimik na bumabagsak ang gawain kapag napili
sila. Nananatili ang vision-language (`qwen-vl-max`) dahil sila ang nakakabasa ng
screenshot. May `test-models.mjs` para dito.

## Anong bago sa v0.20.0 (article wizard — hindi na malilito ang VA)

Dati, kailangang alam ng VA ang apat na bagay bago makasulat: aling mode, aling project,
ano ang itatype, at gaano kahaba. Ngayon, **tatlong tanong** na lang sa isang form.

- Pindutin ang **📝 Sumulat ng artikulo** sa mga starter → lalabas ang wizard.
- **1. Para kaninong kliyente?** — dropdown ng mga project mo, sinasabi kung ilang
  dokumento ang gagamitin.
- **2. Anong paksa o keyword?** — isang linya lang.
- **3. Anong uri at gaano kahaba?** — mapipinduting chips (Paghahambing, Paano gawin,
  Paliwanag, Lokal) at haba (800 / 1,500 / 2,500).
- Pindutin ang **▶ Simulan ang pagsulat** at siya na ang bahala: ini-attach ang project,
  nililipat sa 📝 Write mode, at binubuo ang buong utos kasama ang tagubiling mag-search_files
  muna bago magsulat para walang imbentong facts.

May kasama ring **gabay para sa VA** (5 hakbang na may larawan) na maipapasa sa team.

## Anong bago sa v0.19.1 (mas madaling gamitin)

Tatlong bagay na hinango sa mga totoong nasagasaan namin habang ginagawa ito:

- **Mga starter sa blangkong usapan** — hindi na blangkong kahon ang bubungad. Anim na
  mapipinduting alok (Sumulat ng artikulo, Ihambing ang presyo, Itaas ang RankMath score,
  Tingnan ang Gmail, Ilagay sa Sheets, Basahin ang page). Ang "Sumulat ng artikulo" ay
  kusang lumilipat sa 📝 Write. Kapag may naka-attach na project, sinasabi nito kung ilang
  dokumento ang gagamitin.
- **Alok na lumipat sa Write mode** — kapag pagsulat ang tinipa mo pero nasa Adaptive ka,
  may isang linyang lumalabas bago mo pa ipadala. Ito mismo ang pumipigil sa sablay na
  napunta sa chat ang artikulo imbes na sa dokumento.
- **Errors sa wika ng tao** — ang "API 401: invalid_api_key" ay nagiging "Hindi tinanggap
  ang API key. Buksan ang ⚙ at pindutin ang I-test." Pitong karaniwang error ang may
  ganitong pagsasalin, at bawat isa ay may SAGOT, hindi lang sisi.

## Anong bago sa v0.19.0 (document preview na mukhang tunay na dokumento)

Ang preview dati ay plain na teksto sa loob ng card. Ngayon, **mukha na itong tunay na
pahina**: puting papel, serif na tipo (Georgia), nakasentrong pamagat, at maluwag na
margin. Mababasa mo na ang artikulo sa panel mismo bago mag-download.

- **⛶ Buksan nang buo** — bagong buton na nagbubukas ng buong-pahina na bersyon sa
  bagong tab, naka-layout na parang naka-print na papel. Doon mo komportableng
  mapo-proofread ang 2,000-salitang artikulo, at ang **Ctrl+P ay nagiging PDF** na may
  tamang margin at page size.
- Sinusuportahan na rin ng preview ang blockquote at bold.

## Anong bago sa v0.18.0 (bagong Connectors — card grid tulad ng sa Claude)

Ang lumang Connectors view ay binabaha ka agad ng limang hakbang ng Google Cloud setup
pagbukas pa lang. Malinis na card grid na ito ngayon, at **nakatago ang setup hanggang
pindutin mo ang Connect**.

- **Siyam na connector card** — Gmail, Google Sheets, Google Calendar, Google Drive,
  Zapier, Notion, Composio, GitHub, at Custom. Bawat isa ay may icon, pangalan,
  paglalarawan, at **Connect** button. Berde ang card kapag konektado na.
- **Isang Google account para sa apat** — Gmail, Sheets, Calendar, at Drive ay iisang
  consent lang. Kapag konektado na, email mo ang nakalagay sa card.
- **Nakatago ang mahabang gabay** — ang limang hakbang ng Google Cloud ay nasa likod ng
  "Paano kumuha ng Client ID? (5 minuto)". Kung may Client ID ka na, isang pindot lang.
- **Tatlong bagong tool**: `calendar_list`, `calendar_create`, at `drive_search` —
  walo na ang Google tools.

## Anong bago sa v0.17.1 (mga file card, tulad ng sa Claude)

Ang export ay hilera dati ng button (`⤓ .docx`, `⤓ .pdf`…). Ngayon, **file card na** —
bawat format ay may icon, pangalan ng file, uri, at **Download** button, gaya ng sa
Claude. May **⤓ Download all** din para makuha lahat sa isang pindot.

Ang laman ay isang beses lang binubuo para sa lahat ng format, hindi kada pindot.

## Anong bago sa v0.17.0 (📝 Write mode — inayos ang article generation)

**Ang sira na inayos:** dalawampu't apat na tool ang meron ang agent, at sobra-sobra
iyon para sa maliit na model tulad ng `deepseek-v4-flash`. Hindi nito napipili ang
`write_document`, kaya isinusulat ang artikulo diretso sa chat — lumolobo ang
konteksto (nakita namin ang 260,000 karakter) at walang lumalabas na dokumento.

- **📝 Write mode** — bagong mode sa tabi ng Adaptive at Plan. Dito, **ANIM na tool
  lang** ang nakikita niya: `write_document`, `search_files`, `read_page`, `extract`,
  `navigate`, at `ask_user`. Hindi na siya maliligaw. May mahigpit ding tagubilin na
  bawal isulat ang artikulo sa sagot — dumadaan lang ito sa dokumento.
- **⤓ PDF** — bagong `pdf.js`, walang library gaya ng docx. Ngayon apat na ang
  format sa doc card: **DOCX, PDF, PPTX, MD, HTML**.
- **Tahimik na ang download** — hindi na nagbubukas ng bagong tab kapag nag-export
  (nakakagulo iyon at mukhang may mali). Isang linya na lang: "nasa Downloads mo".
  Lumalabas lang ang pamalit na paraan kapag tumanggi talaga ang Chrome.

**Paano gamitin:** piliin ang 📝 Write sa mode dropdown, i-attach ang project na may
SOP at brand guidelines mo, tapos sabihing "sumulat ka ng artikulo tungkol sa X".
Maghahanap muna siya sa dokumento, susulat kada seksyon, at sa dulo ay may card na
may download buttons.

## Anong bago sa v0.16.0 (📁 Projects at file upload)

Kung ang knowledge hub ay ang natutunan NIYA, ang projects naman ay ang kaalamang
IKAW ang nagbibigay: ang SOP mo, ang brand guidelines, ang mga na-verify na facts ng
kliyente. Isang project kada kliyente o kada uri ng trabaho.

- **📁 sa ⋯ menu** — gumawa ng project, maglagay ng tagubilin (sinusunod niya sa buong
  gawain), at mag-upload ng dokumento sa pamamagitan ng click o drag-and-drop.
- **Suportadong format:** `.txt`, `.md`, `.csv`, `.json`, `.html`, at **`.docx` at
  `.pptx`** — nababasa ang tunay na Word at PowerPoint file gamit ang native na
  `DecompressionStream` ng Chrome, walang external library. (Ang PDF ay hindi pa
  suportado — sinasabi nito nang malinaw imbes na magbalik ng basura.)
- **`search_files` tool** — ito ang susi sa "hindi lumalaki ang konteksto": ang
  system prompt ay may PANGALAN lang ng mga dokumento, hindi ang laman. Kapag may
  kailangan siya, hinahanap niya ito at mga tumutugmang bahagi lang ang pumapasok
  (~2,500 karakter), hindi ang buong sampung-pahinang brief.
- Nakalagay sa system prompt na ang mga dokumento ang **pinagmumulan ng katotohanan** —
  maghanap muna bago manghula o magtanong.
- Ang bawat file ay nasa sariling storage key, kaya targeted ang pagbasa. Idinagdag ang
  `unlimitedStorage` permission para kasya ang malalaking dokumento.

> Kailangan ng buong reload (Remove + Load unpacked) — may bagong `unlimitedStorage`
> permission.

## Anong bago sa v0.15.0 (knowledge hub at article generator)

### 🧠 Persistent learning na HINDI nagpapalaki ng context

Dati, tatlong pinakamahalagang aral ay **kinokompute na pero itinatapon** pagkatapos ng
bawat run: ang IWASTO ng auditor, ang puna kapag bumagsak sa audit, at ang mga hakbang
na hinaharangan ng loop guard. Ngayon, hina-harvest na sila — **at zero dagdag na model
call**, dahil nakalkula na sila noon pa.

- **Bounded injection.** Dati, LAHAT ng tala ay ibinubuhos sa system prompt (worst case
  ~24,000 karakter, na binabayaran kada hakbang). Ngayon: **top-10 lang na
  pinaka-may-kaugnayan, may hard limit na 1,500 karakter**. Malaking tipid sa quota.
- **`recall` tool** — para sa mga aral na wala sa top-10, kaya niyang hanapin ang lahat,
  kahit galing sa ibang site.
- **Matalinong dedup** — hindi na exact-match lang; ang magkatulad na aral ay
  pinagsasama at pinapalakas (hits), hindi dinodoble.
- **Consolidation** — kapag umipon na ang tala sa isang site, isang murang tawag ang
  nagpagsasama at nagpapaikli sa kanila. Tumatakbo BAGO mag-evict, kaya walang aral na
  basta naitatapon. May 24-oras na throttle.
- **Inayos na 🧠 UI** — may search, filter kada uri (fix/gotcha/pref/note/daloy),
  **📌 pin** (laging kasama, hindi kailanman nabubura), **✎ edit**, at delete na
  id-based — ayos na ang dating bug kung saan maling tala ang natatanggal kapag
  sunod-sunod kang nagbura.
- Naayos din: ang aral ay naitatala na sa TAMANG domain kahit maraming site ang nadaanan
  sa isang gawain, at hindi na napupuno ng magkakaparehong workflow ang isang site.

### 📄 Article generator na may .docx at .pptx

- **`write_document` tool** — isinusulat ang mahabang artikulo nang paunti-unti sa isang
  buffer na **wala sa usapan**. Ang tool result ay bilang lang (355 karakter para sa
  5,600-karakter na artikulo), kaya kahit 3,000 salita ay hindi nagpapalaki ng konteksto.
- **Export: .docx, .pptx, .md, .html** — gawa nang **walang external library**; parehong
  OOXML zip ang Word at PowerPoint, kaya iisang zip writer lang. Sa .pptx, bawat heading
  ay nagiging slide.
- **Live preview card** sa panel: pamagat, bilang ng salita, balangkas, at ang mga export
  button. Nabubuhay ito kahit isara mo ang panel o mamatay ang service worker.
- **Diretso sa WordPress** — `paste_large` na may `from_document: true`: ang HTML ay
  dumadaan mula storage papuntang editor nang **hindi dumadaan sa model**, kaya walang
  dagdag na token kahit gaano kahaba ang artikulo.

### Paano subukan

1. Magpasulat ng artikulo: *"sumulat ka ng 1,500-salitang artikulo tungkol sa winter HVAC
   tips"* → panoorin ang doc card na umuusad, tapos i-export sa .docx at .pptx.
2. Sa wp-admin, sabihing ipasok ang artikulo → dapat `from_document` ang gamitin niya.
3. Buksan ang 🧠 pagkatapos ng ilang gawain — dapat may mga `gotcha` at `fix` na aral,
   lalo na kung may nagkamali sa daan.
4. Sa 📊, tingnan kung bumaba ang input tokens kada takbo.

## Anong bago sa v0.14.1 (mabilis at malakas na sa RankMath)

Dati, ang pagpapataas ng RankMath score ay eksplorasyon mula sa wala: binabasa niya
ang panel, hinuhulaan kung ano ang nagpapataas, at paulit-ulit na chine-check ang
score. Ngayon, may built-in na RankMath playbook na siya kapag nasa wp-admin:

- Alam na niya ang daloy: isang basa ng mga FAILING check lang, lahat ng ayos sa isang
  pass, at isang beses lang ang pag-verify ng score sa dulo.
- Alam na niya ang mga tunay na nagpapataas ayon sa bigat: focus keyword sa simula ng
  SEO title, sa URL, sa meta description, at sa unang 10% ng content; tamang haba ng
  title (≤60) at description (120-160) sa Edit Snippet; keyword sa subheading at alt
  text; panloob at panlabas na link; maikling talata.
- Alam na rin niya ang mga bitag: lumang score badge sa Posts list, at kung kailan mas
  tama ang manatili sa 90+ kaysa pilitin ang 100 sa pamamagitan ng keyword stuffing.
- Dagdag na disiplina sa bilis sa wp-admin: walang screenshot maliban kung biswal ang
  tanong, at walang read_page pagkatapos ng bawat type sa parehong form.

## Anong bago sa v0.14.0 (one-click Gmail at Sheets, tulad ng sa Claude)

Sa **⋯ → 🔌 Connect**, may card na ngayon ang **Gmail + Sheets** na may Connect button.
Pagkatapos ng isang beses na setup, isang pindot na lang at lalabas ang Google account
chooser, gaya ng sa Claude. Ang OAuth ay dumadaan sa `chrome.identity` mismo, kaya
walang server na kailangan at walang third party na humahawak ng token mo.

Limang bagong tool ang nabubuksan nito: `gmail_search`, `gmail_read`, `gmail_send`,
`sheets_read`, at `sheets_append`. Ang paghahanap ay nagbabalik ng buod lang (mula
kanino, paksa, petsa, unang bahagi) at hindi ng buong email, kaya hindi lumolobo ang
konteksto. Ang pagpapadala at pagsulat sa Sheets ay dumadaan sa parehong permission
gate ng ibang write actions.

**Ang isang beses na setup** (nasa loob ng card mismo ang gabay, hakbang-hakbang):
gumawa ng project sa Google Cloud, i-enable ang Gmail at Sheets API, gumawa ng OAuth
client ID na **Web application**, idagdag ang redirect URI na ipinapakita ng card
(i-click para kopyahin), at i-paste ang Client ID. Kailangan ito dahil nakatali ang
client ID sa ID ng extension mo — walang maibibigay na pangkalahatang client ID.

> Kailangan ng buong reload (Remove + Load unpacked) — may bagong `identity` permission.

## Anong bago sa v0.13.2 (alam na niya kung kailan tapos na)

- **⛔ Hadlang sa paikot-ikot** — kapag tinawag niya ang EKSAKTONG parehong hakbang sa
  ikatlong beses, hindi na ito pinapatakbo. Sa halip, sinasabihan siyang paikot-ikot na
  siya at kailangan nang magbago ng paraan o huminto. Ito ang tunay na hadlang: hindi
  na umaasa sa payo lang, hinaharangan na talaga ang pag-aaksaya.
- **Tuntunin sa pagtatapos** — malinaw nang nakasulat sa system prompt na kapag nasagot
  na ang hinihingi, tapos na: bawal ang mag-double check ng na-verify na, bawal magbasa
  ulit ng page na walang nagbago, at bawal maghanap ng dagdag na kumpirmasyon kapag
  sapat na ang nasa kamay. Kapag may hindi niya kayang tapusin, sasabihin niya at
  hihinto, hindi na susubukan nang paulit-ulit.

## Anong bago sa v0.13.1 (tunay nang nagtuturo ang 🎓 Teach)

Dati, ang caption sa page ay "Pinipindot ang Edit Snippet" lang — nakikita mo ang
nangyari pero walang matututunan doon. Ngayon, tatlong bagay ang nasa bawat caption:

- **Ang hakbang** — `[4/9]`, nakatali sa plano, kaya alam mo kung nasaan na siya.
- **Ang TUNAY na halaga** — hindi na "Isinusulat…" kundi `Isinusulat: "Winter tips to
  keep your home warm and safe"`. Nakikita mo mismo ang inilagay.
- **Ang DAHILAN** — pinipilit na ngayon ng schema ang agent na sabihin kung bakit bago
  siya kumilos, kaya hindi na umaasa sa kung magkataong may paliwanag siya.

Halimbawa ng bagong caption: `[4/9] 🖱 Pinipindot ang "Edit Snippet" — para mabuksan ang
SEO title at description na kailangang palitan.`

Idinadagdag lang ang dahilan kapag naka-ON ang 🎓, kaya walang dagdag na token kapag
naka-off. Kasama na rin ito sa talaan sa panel, hindi lang sa lumilipas na caption,
kaya mababalikan at maie-export ang natutunan.

## Anong bago sa v0.13.0 (Dianna.ai na ang pangalan)

- **Bagong pangalan: Dianna.ai** — palit na ang extension name, ang logo, ang banner
  sa page, ang mga notification, at ang pangalan ng purple tab group. Ang "Kimi" na
  natitira ay ang PROVIDER lamang (api.kimi.com), na hiwalay sa pangalan ng produkto.
- **Malinis nang binabasa ng boses ang sagot** — nililinis na ang markdown bago ipabasa
  sa TTS: ang mga asterisk, pamagat, at bullet ay tinatanggal, ang em dash ay nagiging
  kuwit, at ang bawat linya ay tinatapos ng tuldok para may tamang hinto ang pagbasa.
  Bawal na rin ang em dash sa sagot mismo (may tuntunin na sa system prompt).
- **Hindi na pumapalya ang ⤓ Export** — bukod sa `chrome.downloads`, may dalawang
  paraan nang laging gumagana kapag tumanggi ang Chrome: **📋 Kopyahin ang buong laman**
  at **🔗 Buksan sa bagong tab** (Ctrl+S doon). Pareho sa CSV ng mga talahanayan.

## Anong bago sa v0.12.3

> ⚠️ **Kailangan ng buong reload, hindi lang 🔄** — may bagong `downloads` permission
> ang manifest. Sa `chrome://extensions`, i-**Remove** muna ang extension tapos
> **Load unpacked** ulit. Hindi kumakagat ang bagong permission sa refresh lang.

- **Ginagamit na ang `chrome.downloads` API** — sa side panel ng extension ay hindi
  maaasahan ang karaniwang download link (tahimik lang itong walang ginagawa). Ito ang
  tunay na dahilan kung bakit walang nangyayari sa ⤓ Export.
- Nananatili ang lumang paraan bilang huling dulot, at kapag parehong nabigo, **may
  lumalabas nang error sa chat** na may sanhi — hindi na tahimik.

## Anong bago sa v0.12.2 (naayos ang ⤓ Export)

- **Naayos ang Export na hindi gumagana kapag malaki na ang usapan** — agad na
  ini-revoke ang blob pagkatapos ng click, at natatalo nito ang download mismo. Mas
  madalas itong nangyari kapag mahaba na ang usapan, kaya mukhang "hindi na
  maclick". Idinikit na rin sa dokumento ang download link (hindi laging kumakagat
  ang detached na anchor sa side panel).
- May kumpirmasyon na sa chat: `⤓ Na-export: pangalan.md (12 KB)` — hindi na tahimik.
- Kasama na ang 📋 plano sa export, at hindi na `.md` lang ang pangalan kapag puro
  emoji o bantas ang pamagat ng usapan.
- Parehong ayos sa CSV download ng mga talahanayan — iisang daan na sila.

## Anong bago sa v0.12.1

- **Prosa ang default na sagot, hindi listahan** — sa karaniwang tanong, usapan, o
  paliwanag, tuloy-tuloy nang pangungusap ang isinusulat niya: walang bullet, walang
  gitling sa simula ng linya, walang naka-bold na pamagat. Ginagamit lang ang listahan
  kapag ang nilalaman mismo ay listahan (paghahambing, sunod-sunod na hakbang, code,
  datos). Ang dating 4-bahaging balangkas ay saklaw na lang ng sagot, hindi format.

## Anong bago sa v0.12.0 (matinding pagtitipid sa quota)

- **`extract` tool** — sa mga page na may listahan (listing, produkto, job post,
  resulta), kinukuha na lang ang MGA ITEM bilang siksik na records sa halip na ang
  buong 9,000-karakter na page dump. **20-30x na mas maliit** — at dahil ang bawat
  token sa usapan ay binabayaran MULI sa bawat kasunod na hakbang, ito ang
  pinakamalaking tipid sa quota.
- **Explicit prompt cache** — ang system prompt ay minarkahan na ng `cache_control`
  sa Alibaba (Token Plan/DashScope): **10% na lang ng presyo** ang cache hit, kalahati
  ng automatic na 20%, at garantisadong tumatama.
- **⚡ Cache hit rate sa 📊** — makikita mo na kung gumagana ang tipid: berde kapag
  ≥50% cached, dilaw 20-49%, pula kapag walang cache hit.

## Anong bago sa v0.11.0 (Connectors gallery — parang kay Claude)

- **🔌 Connect sa ⋯ menu** — buong connectors view na parang kay Claude: gallery ng
  mapagpipilian (Zapier, Composio, Notion, GitHub, Custom), "I-test at i-connect" na
  button, at status kada connector (✓ ilan ang tools / ✗ ano ang mali) na kusang
  nagche-check pagbukas. On/off toggle at ✕ kada connector.
- **Maraming connector nang SABAY-SABAY** — hanggang 4 na MCP server nang magkakasama
  (hal. Zapier para sa Gmail/Sheets + Notion nang sabay), pinagsasama ang tools nila
  sa iisang agent, naka-tag kung saang connector galing ang bawat isa.

## Anong bago sa v0.10.0 (mas mabilis, mas matalino, at nakakonekta na sa labas)

- **🔌 MCP connectors** — ilagay sa ⚙ ang URL ng kahit anong MCP server (hal. Zapier
  MCP o Composio — daan-daang app tulad ng Gmail/Sheets/Slack sa likod ng iisang URL)
  at magiging tools na ito ng agent. May pahintulot ang bawat connector na aksyon,
  tulad ng ibang write actions.
- **Cache-friendly na compaction** — hindi na binabago ang usapan kada hakbang (pumapatay
  yun ng prompt cache = 10-100x na mas mahal at mas mabagal). Ngayon, append-only ang
  usapan hanggang 60% ng konteksto, saka isang malaking putol. Diskarte mula sa Manus.
- **Recitation ng plano** — kada 8 hakbang, isinusulat muli ang plano sa dulo ng usapan
  para hindi maligaw ang model sa mahahabang gawain ("lost in the middle" ang gamot).
- **📚 Auto-skills** — kapag pumasa ang gawain sa second brain (≥8/10, ≥5 hakbang),
  kusang dinidistill ang daloy bilang workflow ng site na iyon at gagamitin sa susunod —
  +51% success rate ang sinukat ng Agent Workflow Memory paper sa ganitong pag-iipon.
  (Kailangang naka-ON ang 🧐 para may quality gate.)

## Anong bago sa v0.9.0 (solid na tandem ang worker at second brain)

- **♻ Auto-fix** — dati, nahuhuli ng auditor ang masamang sagot pero IKAW pa ang
  pipindot ng "ipasa ang puna". Ngayon, kapag bumagsak sa **4/10 pababa**, kusang
  ibinabalik sa worker at ipinapasulat muli nang isang beses — ang naitama na ang
  makikita mo, hindi ang sablay.
- **Nakikita na ng auditor ang TALAGANG ginawa** — kasama na ang tool trail (anong
  na-navigate, na-click, nabasa, at kung ano ang nabigo). Kaya niyang sabihin ngayon
  na "sinabi mong binuksan mo pero wala sa listahan" — hindi na prosa lang ang husga.
- **Sukat at katapatan sa worker** — bagong tuntunin sa system prompt: ang "hello" ay
  sinasagot ng pagbati, hindi ng buong pagsusuri; at bawal ang pag-imbento ng nakaraang
  gawaing hindi naman nangyari.
- **Kalibradong score at nakapirming wika sa auditor** — may malinaw nang batayan ang
  1-10 (para hindi arbitrary ang boto), at bawal nang dumulas ang ibang wika.
- **★ Average score kada model sa 📊** — makikita mo na kung aling worker model ang
  talagang mahusay ayon sa second brain, may datos: berde (≥7), dilaw (5-6), pula (<5).
- Default na dalawang auditor mula sa magkaibang pamilya (`qwen3.8-max, glm-5.2`) —
  tunay na consensus, hindi ugali ng iisang model.

## Anong bago sa v0.8.1

- **Dropdown na rin ang second brain** — may picker na sa auditor: kita mo lahat ng
  model ng provider nito (live mula sa /models), at ang pagpili ay NAGDADAGDAG sa
  listahan — kaya buo pa rin ang voting (hanggang 3 model). May ✕ para linisin.
- **Hindi na tahimik kapag mali ang setup ng second brain** — dati, kapag "Custom"
  ang provider nito na walang base URL, hindi talaga tumatakbo ang auditor pero
  akala mo tumatakbo. Ngayon: kusang gagamit ng provider ng worker, at kung may
  kulang pa rin, sasabihin sa iyo kung ano.

- **Cartesia na ang default na boses** — natural na Tagalog agad pagbukas, hindi na
  ang robotic na browser voice. Naka-baked na ang API key at ang default na boses
  (**Mae — Calm Authority**), kaya walang setup na kailangan: i-on lang ang 🗣 sa ⋯ menu.
- Mapapalitan pa rin ang boses sa ⚙ → 🗣 Boses — 8 Tagalog voices ang mapagpipilian:
  Mae, Angel, Joy, Liezel, Luz (babae); Jerome, Juan, Angelo (lalaki).

## Anong bago sa v0.8.0 (natural na Tagalog na boses)

- **🗣 Cartesia Sonic TTS** — sa ⚙ settings, piliin ang "Cartesia Sonic (natural na
  Tagalog)" bilang boses. Natural na Tagalog/Taglish ang pagbasa ng mga sagot, hindi
  na robotic. Kumuha ng libreng key sa play.cartesia.ai (20K characters/buwan libre),
  i-paste, at pumili ng boses — Tagalog voices muna ang inililista.
- May automatic fallback sa browser voice kapag walang key, walang credits, o nag-error
  ang API — hindi mananahimik ang TTS.

## Anong bago sa v0.7.1

- **Totoong dropdown na ang model picker** — hindi na datalist na nagtatago ng mga
  opsyon kapag may laman na ang field. Kita mo na LAHAT ng model ng provider (live
  mula sa /models), at may "✎ Iba pa…" para sa free-form na model name.
- **Tapat na ang pagpapakilala** — kapag Qwen (o iba) ang worker, hindi na siya
  magpapanggap na "Kimi K3". Ang totoong model name ang sinasabi niya.

## Anong bago sa v0.7.0 (teaching remote + malinaw na lahat)

- **🎓 Teach mode** — captions sa baba ng page habang nagtatrabaho ang agent: anong
  ginagawa + bakit, parang subtitles ng screen-share. Ang nanonood, natututo mismo
  kung paano ginagawa ang task. I-on sa ⋯ menu.
- **Pangalan ng element, hindi ref** — "Pinipindot ang “Mga Filter”" na ang lumalabas
  sa banner at captions, hindi na "ref_12".
- **📋 Plan tool + checklist** — inilalatag ng agent ang plano bilang checklist na
  may umuusad na check marks at progress bar sa panel. Laging alam mo kung nasaan na.
- **Onboarding sa unang bukas** — 3-hakbang na setup card (provider → key → subukan)
  na may "I-test" button, sa halip na error message. May "I-test" din sa ⚙ settings.
- **📊 Tumpak na usage** — eksaktong input/output tokens mula mismo sa API kada tawag,
  hiwalay ang worker sa auditor, may malalaking totals at bar kada model.
- Mas malinaw na mode labels (🤝 Adaptive, ✋ Manual, ⚡ Auto, 👀 Plan, 🎧 Coach, 🚀 Bypass).

Sidebar agent sa loob ng totoong Chrome mo. Nakikita niya ang mga naka-login mong session —
yan ang dahilan kung bakit extension ito at hindi remote browser.

## Anong bago sa v0.6.1

- **Second brain sa GITNA ng gawain** — hindi na lang sa dulo nag-a-audit. Kada 6 na
  hakbang, sinisilip ng auditor ang direksyon ng worker: kung tama, tahimik lang;
  kung mali o paikot-ikot, isang "IWASTO" na linya ang ipinapasok sa worker para
  maituwid agad — mas mabuting tama sa unang beses kaysa paulit-ulit na mali.
- **Groq bilang provider** — piliin ang "Groq (mabilis)" sa settings para tumakbo ang
  worker o auditor sa pinakamabilis na inference ngayon. Kung naka-setup na ang Groq
  key mo para sa 🎧 (Whisper), gagana na agad ito — parehong key.
- **Live model list** — hindi na hardcoded ang mga model suggestion. Kinukuha na
  nang live sa `/models` endpoint ng provider, kaya laging totoo at sariwa ang listahan
  kahit magbago ang mga pangalan ng model.
- **Plano muna bago kumilos** — sa mga gawaing 3+ hakbang, maglalatag muna ang agent
  ng maikling numerado na plano bago ang unang aksyon, at magre-replan kapag dalawang
  beses nabigo ang parehong hakbang — hindi na ipagpipilitan ang ayaw gumana.

## Anong bago sa v0.6.0

- **Malinis na UI** — ang API key/provider/model/auditor settings ay nasa likod na ng
  ⚙ button, at ang lahat ng feature toggle ay nasa ⋯ menu. Isang malinis na header row
  na lang: mode, hint, model chip, at gear.
- **Model badges** — ang bawat sagot ay may maliit na tag kung aling model ang sumagot
  (transparency: alam mo kung si K3, Qwen, DeepSeek, o GLM ang nagsasalita).
- **Magic overlay** — kapag kumikilos ang agent sa page: glowing violet frame, banner
  na may LIVE status (hal. "Pinipindot ang ref_12") at TIMER, moving cursor, at
  sparkle effects — makikita mo mismo ang ginagawa niya habang nagtatrabaho.
- **🗳 Voting system** — ilagay sa auditor model field ang maraming model na
  comma-separated (hal. `qwen3.8-max, deepseek-v4-pro, glm-5.2`) at SABAY-SABAY
  silang bibigay ng second brain review, bawat isa may SCORE na boto, at may
  consensus na PASS/AYUSIN sa dulo.

## Anong bago sa v0.5.1

- **Second brain** — pinalakas ang auditor: hindi lang taga-hanap ng mali, taga-bigay
  na rin ng mga improvement idea na lampas sa hinihingi mo (PULIDO / IMPROVE /
  SUSUNOD NA LEVEL).
- **Timer** — makikita mo ang elapsed time ng tumatakbong gawain sa tabs row.
- **Usage stats (📊)** — ilang run at ilang segundo/minuto ang ginugol ng bawat model
  (worker at auditor magkahiwalay), para makita mo kung alin ang sulit.

## Anong bago sa v0.5.0 (second opinion — dalawang AI, magkasabay)

- **Worker + Auditor combo** (🧐) — iba ang AI na gumagawa, iba ang nagsusuri. Halimbawa:
  Kimi K3 ang worker, qwen3.8-max ang auditor — o baliktad. Hiwalay na provider, key, at
  tawag, kaya **sabay silang tumatakbo**.
- Pagkatapos ng gawain, kusang sinusuri ng auditor ang huling sagot: may mali ba, may
  kulang ba, may panganib ba, may mas magandang paraan ba — lumalabas bilang audit bubble
  na may **"✉ Ipasa ang puna kay worker"** button para mag-usap ang dalawang AI.
- **Vision correction:** ang qwen3.8-max, qwen3.7-plus, at qwen3.6-flash sa Token Plan ay
  may **Visual Understanding** pala — gumagana ang screenshots/image attachments sa kanila.

## Anong bago sa v0.4.0 (multi-provider)

- **Hindi na Kimi lang** — piliin ang provider sa panel: **Kimi**, **Alibaba Token Plan**,
  **Alibaba Qwen** (DashScope), o **Custom** (kahit anong OpenAI-compatible na serbisyo —
  OpenRouter, Together, lokal na server; ilalagay mo ang base URL).
- **Bawat provider ay may sariling naka-save na API key** — hindi nababura kapag
  nagpapalipat-lipat ka.
- **Free-form na model field** na may suggestions per provider — pwede ring mag-type ng
  kahit anong model name.
- Ang model routing ay gumagana pa rin: lumilipat sa "malakas" na model ng provider
  kapag sunod na nag-fail o malaki ang konteksto.

## Anong bago sa v0.3.1 (harness upgrade — parang mga tip sa Reddit)

- **Model routing** — ang pinili mong model ang default ng buong loop; kusang
  lumilipat sa malakas na model kapag dalawang sunod na step ang may error o lalampas sa
  konteksto. Bayad ka lang ng malakas na model kapag kailangan talaga.
- **Auto-compaction** — bago mapuno ang konteksto, ini-summarize ng model ang naunang
  bahagi ng usapan at iyon lang ang pinapanatili (may tool-pairing safety). Ang mga
  durable na fact ay awtomatikong nase-save sa memory bago mawala ang detalye.
  Gamot sa "nagbobobo habang humahaba ang session."
- **Verification loop** — bawat click ay may before/after signature ng page:
  `nagbago: url/dom/wala`. Kapag "wala", may babala agad at magbabago ng diskarte
  ang agent sa halip na ulitin nang bulag — walang dagdag na API call.
- **Token discipline** — maikli ang pag-iisip sa mekanikal na hakbang (click, type,
  scroll) ayon sa system prompt; ang malalim na pag-aanalisa ay para sa paghahambing
  at debugging lang.

## Anong bago sa v0.3

- **WordPress/Elementor toolkit** — `read_console` (JS errors at nabigong network calls),
  `paste_large` (malaking HTML/code sa HTML widget, TinyMCE, CodeMirror), at built-in
  wp-admin/Elementor playbook na awtomatikong naglo-load kapag nasa wp-admin ka.
- **Autopilot** (🛩) — pagkatapos ng gawain, kusang nagpapatuloy sa susunod na hakbang,
  max 5 na kadena, nananatili ang lahat ng permission gates.
- **Record & replay** (⏺) — i-record ang mga pindot mo sa working tab, i-save bilang
  shortcut, at pa-ulitin sa agent ("i-run ang pangalan").
- **Scheduled tasks** (⏰) — iskedyul ng gawain nang minsan o paulit-ulit (chrome.alarms).
  Sa scheduled run ay walang user na sasagot kaya read-only-ish sa disenyo; may
  notification sa simula at sa resulta.

## Anong bago sa v0.2

- **Session tabs** — maraming usapan sa side panel. I-drag pahalang para mag-reorder,
  gaya ng sa Claude. Bawat tab may sariling kasaysayan at sariling tab group.
- **Scoped tab group** — sa pagsisimula ng gawain, ang kasalukuyang tab ay pumapasok sa
  purple na tab group na "K3 · (usapan)". Doon LANG kikilos ang agent: hindi niya
  makikita, malilipat, o masasara ang ibang tabs mo — hinahadlangan mismo ng Chrome.
  Ang mga bagong tab na binubuksan niya ay awtomatikong papasok sa group.
- **Streaming** — lumalabas ang sagot habang nagta-type, hindi na hintay nang buo.
- **Smart page load** — hinihintay ng agent na matapos ang page bago kumilos, hindi na
  fixed na 1.5 segundo.
- **Voice command** — pindutin ang 🎤 at sabihin ang utos. Awtomatikong ipinapadala
  pagkatapos mong magsalita. Sa Coach mode, pakikinig pa rin ito sa tawag.
- **TTS at tunog** — 🗣 binabasa nang malakas ang mga sagot (conversation mode kapag
  sabay ang voice command), 🔔 chime kapag tapos na, may tanong, o may error.
- **Image generation** — sabihin lang ang gusto mong larawan (poster, logo concept,
  diagram) at lalabas ito sa chat. Libre, walang key.
- **Export** — ⤓ i-download ang usapan bilang Markdown.

## Install

1. Chrome → `chrome://extensions`
2. Buksan ang **Developer mode** (kanang taas)
3. **Load unpacked** → piliin ang folder na ito (yung may `manifest.json` mismo sa loob)
4. Pindutin ang icon ng extension para buksan ang side panel
5. Piliin ang provider (Kimi / Alibaba Token Plan / Alibaba Qwen / Custom) at ilagay ang API key nito

Naka-`chrome.storage.local` ang mga key — wala sa code, hindi napupunta sa git.

## Modes

| Mode | Kilos |
|---|---|
| **Adaptive** | Nagtatanong sa unang beses ng bawat aksyon, tapos tiwala na sa buong gawain. Ito ang default. |
| **Manual** | Nagtatanong bago ang bawat aksyon. |
| **Auto** | Kusang kumikilos, pero nagtatanong pa rin sa hindi na maibabalik (`close_tab`). |
| **Plan** | Read-only. Tinatanggal sa schema ang write tools — hindi lang hinaharangan, hindi man lang nakikita ng model. |
| **Coach** | Nakikinig sa caption ng tawag at nagmumungkahi ng sagot. Walang ginagalaw. |
| **Bypass** | Walang tanong kahit ano. |

Kahit sa Bypass: ang mga tab na labas ng scope group ay hindi talaga aabot ng agent —
hadlang ito ng Chrome API, hindi lang patakaran.

## Mga tool ng agent

| Tool | Kailangan ng pagpayag |
|---|---|
| `ask_user` | — (ang user mismo ang sumasagot) |
| `read_page`, `read_console`, `screenshot`, `generate_image`, `scroll`, `list_tabs`, `switch_tab`, `listen` | hindi |
| `click`, `type`, `paste_large`, `navigate`, `new_tab`, `run_shortcut`, `schedule_task` | oo, maliban sa Auto/Bypass (sa Adaptive: unang beses lang) |
| `close_tab` | oo, maliban sa Bypass |

Ang `ask_user` ay humihinto at nagpapakita ng mapipinduting sagot kapag may sangang
hindi kayang pagpasyahan ng model — halimbawa, aling invoice sa tatlo. Kahit lumipat ka
ng ibang session tab, babalik ang tanong kapag bumalik ka sa tab na iyon.

## Mga file

| File | Laman |
|---|---|
| `background.js` | agent loop, multi-provider API (streaming), permission gate, scope group, autopilot, alarms, model routing, auto-compaction, second brain + voting |
| `tools.js` | tool schema + dispatch, working tab logic, waitForLoad, generate_image, shortcuts, schedules |
| `page-fns.js` | mga function na ini-inject sa page (DOM read, click, type, console hook, paste, recorder, page signature, magic overlay) |
| `sidepanel.*` | chat UI, sessions, tabs, voice, sounds, export, provider/model/auditor settings |
| `memory.js` | natutunan niya per-site at tungkol sa iyo |
| `history.js` | pag-aayos ng mga naulilang tool call |
| `offscreen.*` | pagkuha ng tunog ng tab para sa Groq Whisper |
| `mic-permission.html` | page na humihingi ng pahintulot sa mikropono |

## Alam nang limitasyon

- Isang run sa isang pagkakataon (kahit maraming session tabs). Ang parallel na run
  kada session ay balang-araw pa.
- Ang screenshot ay kailangang iharap sandali ang working tab (isang kisap lang —
  ibinabalik agad ang tab mo).
- Ang mga screenshot at generated image ay hindi nase-save kasama ng kasaysayan
  pagkatapos isara ang panel (live lang) — tipid sa 10MB storage quota.
- Ang console hook ay nakakakuha lang ng mga error PAGKATAPOS niyang ma-inject —
  i-reload ang page para sa load-time errors.
- Ang recorder ay nawawala kapag nag-navigate ang page (bagong document) — i-record
  ang bawat page-load na bahagi nang hiwalay kung kailangan.
- Hindi umaabot sa `chrome://` at Web Store pages. Hadlang ito ng Chrome mismo, hindi bug.
- Ang image generation ay may rate limit (libreng provider) — subukan ulit kapag nag-fail.
- Nawawalan ng bisa ang mga ref kapag nagbago ang page. Sinasabi ito ng error, at
  nagre-read_page ulit ang model.
