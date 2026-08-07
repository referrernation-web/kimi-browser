# Kimi K3 Browser

Sidebar agent sa loob ng totoong Chrome mo. Nakikita niya ang mga naka-login mong session —
yan ang dahilan kung bakit extension ito at hindi remote browser.

## Anong bago sa v0.4.0 (multi-provider)

- **Hindi na Kimi lang** — piliin ang provider sa panel: **Kimi**, **Alibaba Qwen**
  (DashScope, OpenAI-compatible endpoint), o **Custom** (kahit anong OpenAI-compatible
  na serbisyo — OpenRouter, Together, lokal na server; ilalagay mo ang base URL).
- **Bawat provider ay may sariling naka-save na API key** — hindi nababura kapag
  nagpapalipat-lipat ka.
- **Free-form na model field** na may suggestions per provider (qwen-max, qwen-plus,
  qwen-turbo, qwen3, qwen-vl-max, atbp.) — pwede ring mag-type ng kahit anong model name.
- Ang model routing ay gumagana pa rin: lumilipat sa "malakas" na model ng provider
  (Kimi → k3, Qwen → qwen-max) kapag sunod na nag-fail o malaki ang konteksto.
- Tandaan: ang vision (screenshot/image tools) ay nangangailangan ng vision-capable
  na model — sa Qwen, piliin ang `qwen-vl-max` kung gagamit ka ng screenshots.

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
5. Piliin ang provider (Kimi / Alibaba Qwen / Custom) at ilagay ang API key nito

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
| `background.js` | agent loop, multi-provider API (streaming), permission gate, scope group setup, autopilot, alarms, model routing, auto-compaction |
| `tools.js` | tool schema + dispatch, working tab logic, waitForLoad, generate_image, shortcuts, schedules |
| `page-fns.js` | mga function na ini-inject sa page (DOM read, click, type, console hook, paste, recorder, page signature) |
| `sidepanel.*` | chat UI, sessions, tabs, voice, sounds, export, provider/model settings |
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
