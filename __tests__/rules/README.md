# Regeltester för Firestore

Testerna kör `firestore.rules` mot Firestore-emulatorn och beskriver vad
reglerna **faktiskt** gör — inte vad de ser ut att göra. Där de skiljer sig åt
står en `KÄNT FEL`-kommentar i testet.

## Kör

```bash
npm run test:rules   # startar emulatorn, kör testerna, stänger ner
npm run test:all     # enhetstester + regeltester
```

`npm test` rör inte de här testerna — de kräver emulator och Java, och ska inte
sakta ner den snabba sviten.

## Förutsättningar

- Java (emulatorn är en jar-fil)
- Firebase CLI (`firebase --version`)

Projekt-ID är `demo-lekplatsen`. `demo-`-prefixet gör att emulatorn vägrar prata
med riktiga Firebase-tjänster — testerna kan alltså inte råka skriva till
vare sig `lekplatsen-907fb` eller `viktor-2e4f9`.

## Om du får "Could not start Firestore Emulator, port taken"

På Windows överlever emulatorns java-process ibland `emulators:exec`. Hitta och
stäng just den processen:

```powershell
Get-NetTCPConnection -LocalPort 8080 -State Listen |
  ForEach-Object {
    $p = Get-CimInstance Win32_Process -Filter "ProcessId = $($_.OwningProcess)"
    if ($p.CommandLine -match 'cloud-firestore-emulator') { Stop-Process -Id $_.OwningProcess -Force }
  }
```

## Varför `maxWorkers: 1`

Alla testfiler delar en emulatorinstans och ett projekt-ID. Körs de parallellt
hinner en fils `clearFirestore()` radera en annan fils seedade data mitt i ett
test, vilket ger sporadiska "Null value error" från `get()`-anrop i reglerna.

## Känd begränsning: sponsorstatistiken

Reglerna låser *formen* på analytikskrivningarna — exakt en känd räknare, exakt
ett steg, datumfält som matchar dokument-id. Det stoppar den som vill skriva
`badgeImpressions: 10000000` i ett svep.

Det stoppar däremot inte den som loopar enskilda +1-skrivningar. Skrivningen
måste vara öppen för gäster eftersom sponsorbadgen visas för utloggade
besökare, och regler ensamma kan inte skilja appen från ett skript.

Vill du stänga även det finns två vägar:

1. **App Check** (Play Integrity / DeviceCheck) — Firestore avvisar då skrivningar
   som inte kommer från din riktiga app. Rätt lösning, men kräver konfiguration
   per plattform och en ny build.
2. **Anonym inloggning + rate limiting** — appen loggar redan in gäster anonymt
   vid gästincheckning. Kräver man `request.auth != null` går varje händelse att
   knyta till ett uid och begränsa i `_rateLimits`.

## Struktur

| Fil | Täcker |
| --- | --- |
| `setup.js` | emulatormiljö, aktörer (`alice`, `bob`, admin `root`), seeding |
| `lekplatser.test.js` | läsning, skapande, bildbyte, adminrättigheter |
| `incheckningar.test.js` | skapande, likes, redigering, radering, kommentarer |
| `users.test.js` | profiler, vänlistor, notiser, troféer, kontoradering |
| `sponsors.test.js` | sponsordokument och statistiksamlingen |
| `ovrigt.test.js` | troféer, konfiguration, vänförfrågningar, nyheter, rapporter, förslag |

Aktörerna har alltid ett `users`-dokument. Flera regler gör
`get(/users/$(uid)).data.isAdmin` — saknas dokumentet blir regeln ett fel och
allt nekas, vilket döljer vad testet egentligen mäter.
