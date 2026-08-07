# Kimi K3 Browser

Sidebar agent sa loob ng totoong Chrome mo. Nakikita niya ang mga naka-login mong session —
yan ang dahilan kung bakit extension ito at hindi remote browser.

## Install

1. Chrome → `chrome://extensions`
2. Buksan ang **Developer mode** (kanang taas)
3. **Load unpacked** → piliin ang folder na ito
4. Pindutin ang icon ng extension para buksan ang side panel
5. Ilagay ang Kimi API key mo sa taas ng panel (galing sa kimi.com/code/console)

Naka-`chrome.storage.local` ang key — wala sa code, hindi napupunta sa git.

## Modes

| Mode | Kilos |
|---|---|
| **Manual** | Nagtatanong bago ang bawat click/type/navigate. Ito ang default. |
| **Auto** | Kusang kumikilos, pero nagtatanong pa rin sa hindi na maibabalik (`close_tab`). |
| **Plan** | Read-only. Tinatanggal sa schema ang write tools — hindi lang hinaharangan, hindi man lang nakikita ng model. |
| **Bypass** | Walang tanong kahit ano. |

## Mga tool ng agent

| Tool | Kailangan ng pagpayag |
|---|---|
| `ask_user` | — (ang user mismo ang sumasagot) |
| `read_page`, `scroll`, `list_tabs`, `switch_tab` | hindi |
| `click`, `type`, `navigate`, `new_tab` | oo, maliban sa Auto/Bypass |
| `close_tab` | oo, maliban sa Bypass |

Ang `ask_user` ay humihinto at nagpapakita ng mapipinduting sagot kapag may sangang
hindi kayang pagpasyahan ng model — halimbawa, aling invoice sa tatlo.

## Test

    node test-loop.mjs

Pinapatakbo nito ang buong agent loop na may pekeng Chrome at pekeng Kimi: anim na
sitwasyon na sumasakop sa apat na mode, sa gate ng `close_tab`, at sa `ask_user`.

## Mga file

| File | Laman |
|---|---|
| `background.js` | agent loop, Kimi API, permission gate |
| `tools.js` | tool schema + dispatch papuntang Chrome APIs |
| `page-fns.js` | mga function na ini-inject sa page (DOM read, click, type) |
| `sidepanel.*` | chat UI |

## Alam nang limitasyon

- Walang screenshot/vision — teksto at DOM refs lang. Sapat ito sa karamihan ng site at
  mas mura; kung may canvas-based na app kayong kailangan, doon lang ito kulang.
- Hindi umaabot sa `chrome://` at Web Store pages. Hadlang ito ng Chrome mismo, hindi bug.
- Non-streaming ang mga sagot — lumalabas nang buo pagkatapos ng bawat hakbang.
- Nawawalan ng bisa ang mga ref kapag nagbago ang page. Sinasabi ito ng error, at
  nagre-read_page ulit ang model.
