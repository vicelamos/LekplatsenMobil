# Läsbudgettester

De här testerna mäter **dokumentläsningar**, inte millisekunder. Läsningar är
det Firestore fakturerar, och det är den siffra som tyst exploderar när
databasen växer: en fråga som kostar 400 läsningar idag kostar 10 000 när
lekplatserna blir rikstäckande — utan att någonting går sönder på vägen.

```bash
npm run test:perf   # startar emulatorn, seedar, mäter
npm run test:all    # enheter + regler + läsbudget
```

## Hur mätningen går till

`jest.mock('firebase/firestore')` lindar `getDocs` och `getDoc` och summerar
`snapshot.size`. Produktionskoden är orörd — den vet inte om att den mäts.

Seedningen sker med admin-SDK:t (går förbi säkerhetsreglerna) medan mätningen
sker via klient-SDK:t. Samma uppdelning som i verkligheten: servern fyller
databasen, appen läser ur den.

Projekt-ID är `demo-lekplatsen-perf`, skilt från regeltesternas
`demo-lekplatsen` så att sviterna inte trampar på varandras data.

Perf-sviten kör dessutom mot en **egen emulatorport** (8081) via
`firebase.perf.json`, medan regeltesterna använder 8080 i `firebase.json`.
Skälet är praktiskt: på Windows överlever emulatorns java-process ibland
`emulators:exec`, och med delad port kunde `npm run test:all` inte starta den
andra sviten. Med skilda portar spelar en läckt process ingen roll.

## Vad som mäts

| Test | Invariant |
| --- | --- |
| en flödessida | högst en läsning per visad post |
| samma sida, större databas | kostnaden känner inte till databasens storlek |
| vänlistans storlek | en fråga per påbörjad grupp om 30 |
| sida två | kostar inte mer än sida ett, och överlappar den inte |

Plus två tester som **dokumenterar dagens beteende** som baslinje att mäta
förbättringar mot:

- att läsa hela `lekplatser` kostar en läsning per lekplats (det HomeScreen och
  SearchScreen gör vid varje sidladdning)
- bildberikningen gör en fråga per kort, och varje fråga läser upp till tio
  incheckningar — tio läsningar för att välja en miniatyrbild

## Att lägga till en budget

Mät alltid genom servicelagret, aldrig genom att återskapa frågan i testet.
Ligger logiken kvar inne i en skärm går den inte att mäta — det är i sig ett
skäl att flytta ut den först.

```js
const { result, docs, calls } = await measure(() => minService(...));
expect(docs).toBeLessThanOrEqual(BUDGET);
```

## Begränsning

Emulatorn modellerar inte Firestores skrivtak per dokument (~1 skrivning per
sekund uthålligt). Statistiktransaktionen på `lekplatser/{id}` vid varje
incheckning syns därför inte här — den behöver testas mot ett riktigt projekt.
