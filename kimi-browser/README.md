# Kimi K3 Browser

> ⚠️ **PRIVATE na ang repo na ito** — may naka-baked na Cartesia API key sa
> `sidepanel.js`. Huwag itong gawing public habang nandiyan ang key.

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
