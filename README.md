# Kimi Browser — Chrome Extension

## Paano i-install sa laptop mo (5 minutos lang)

Hindi mo kailangan ng kahit anong technical knowledge. Sundan lang:

### Step 1 — I-download ang extension
1. Buksan itong page na ito: **github.com/referrernation-web/kimi-browser**
2. Click ang berdeng button na **<> Code** (nasa itaas ng listahan ng files)
3. Click **Download ZIP**
4. Hanapin ang na-download na `kimi-browser-main.zip` sa **Downloads** folder mo

### Step 2 — I-extract ang ZIP
- **Windows:** Right-click ang zip file → **Extract All...** → Extract
- **Mac:** Double-click lang ang zip file
- Magkakaroon ka ng folder na `kimi-browser-main`
- **Buksan iyon** — sa loob niya may isa pang folder na `kimi-browser`. IYON ang kailangan natin. (Doon nakalagay ang `manifest.json`.)

### Step 3 — I-load sa Chrome
1. Buksan ang **Google Chrome**
2. Sa address bar, i-type: `chrome://extensions` tapos Enter
3. Sa **kanang-itaas**, i-ON ang **Developer mode** (toggle switch)
4. Click ang **Load unpacked** (button sa kaliwang-itaas)
5. Piliin ang **inner folder**: `kimi-browser-main` → `kimi-browser` (ang folder na may `manifest.json` mismo sa loob)
6. Click **Select Folder**

### Step 4 — Tapos na!
- Lalabas ang **Kimi Browser** sa listahan ng extensions mo
- Para madaling ma-access, click ang puzzle icon 🧩 sa toolbar ng Chrome, tapos i-**pin** ang Kimi Browser

---

## Paano mag-update (kapag may bagong version)
1. I-download ulit ang ZIP (Step 1) at i-extract
2. Punta sa `chrome://extensions`
3. Click ang 🔄 refresh icon sa Kimi Browser card — o kaya i-remove muna tapos Load unpacked ulit gamit ang bagong folder

## Troubleshooting
| Problema | Solusyon |
|---|---|
| Walang "Load unpacked" button | Hindi naka-ON ang Developer mode — i-ON muna sa kanang-itaas |
| Error na "Could not load manifest" | Mali ang napiling folder — piliin ang INNER na `kimi-browser` folder (may `manifest.json` mismo sa loob), hindi ang `kimi-browser-main` |
| Warning si Chrome na "Developer mode extension" | Normal lang ito sa ganitong extension — click lang **Keep** |

## Notes
- Personal/internal extension ito — hindi ito mula sa Chrome Web Store, kaya kailangan ng Developer mode
- Ang buong source code ay nakikita dito sa repo — walang nakatagong anything
- Ang mga extension files ay nasa [`kimi-browser/`](./kimi-browser) na folder
