# Kimi K3 Browser

Sidebar agent sa loob ng totoong Chrome mo. Nakikita niya ang mga naka-login mong session —
yan ang dahilan kung bakit extension ito at hindi remote browser.

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
5. Ilagay ang Kimi API key mo sa taas ng panel (galing sa kimi.com/code/console)

Naka-`chrome.storage.local` ang key — wala sa code, hindi napupunta sa git.

## Modes

| Mode | Kilos |
|---|---|
| **Manual** | Nagtatanong bago ang bawat click/type/navigate. Ito ang default. |
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
| `read_page`, `screenshot`, `generate_image`, `scroll`, `list_tabs`, `switch_tab`, `listen` | hindi |
| `click`, `type`, `navigate`, `new_tab` | oo, maliban sa Auto/Bypass |
| `close_tab` | oo, maliban sa Bypass |

Ang `ask_user` ay humihinto at nagpapakita ng mapipinduting sagot kapag may sangang
hindi kayang pagpasyahan ng model — halimbawa, aling invoice sa tatlo. Kahit lumipat ka
ng ibang session tab, babalik ang tanong kapag bumalik ka sa tab na iyon.

## Mga file

| File | Laman |
|---|---|
| `background.js` | agent loop, Kimi API (streaming), permission gate, scope group setup |
| `tools.js` | tool schema + dispatch, working tab logic, waitForLoad, generate_image |
| `page-fns.js` | mga function na ini-inject sa page (DOM read, click, type) |
| `sidepanel.*` | chat UI, sessions, tabs, voice, sounds, export |
| `memory.js` | natutunan niya per-site at tungkol sa iyo |
| `history.js` | pag-aayos ng mga naulilang tool call |
| `offscreen.*` | pagkuha ng tunog ng tab para sa Groq Whisper |
| `mic-permission.html` | page na humihingi ng pahintulot sa mikropono |

## Alam nang limitasyon

- Isang run sa isang pagkakataon (kahit maraming session tabs). Ang parallel na run
  kada session ay balang-araw pa.
- Ang screenshot ay kailangang iharap sandali ang working tab — limitasyon ng
  `captureVisibleTab` ng Chrome.
- Ang mga screenshot at generated image ay hindi nase-save kasama ng kasaysayan
  pagkatapos isara ang panel (live lang) — tipid sa 10MB storage quota.
- Hindi umaabot sa `chrome://` at Web Store pages. Hadlang ito ng Chrome mismo, hindi bug.
- Ang image generation ay may rate limit (libreng provider) — subukan ulit kapag nag-fail.
- Nawawalan ng bisa ang mga ref kapag nagbago ang page. Sinasabi ito ng error, at
  nagre-read_page ulit ang model.
