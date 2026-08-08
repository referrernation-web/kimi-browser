# Dianna.ai

> ⚠️ **PRIVATE na ang repo na ito** — may naka-baked na Cartesia API key sa
> `sidepanel.js`. Huwag itong gawing public habang nandiyan ang key.

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
