# Firebase Miljökonfiguration

Detta projekt har konfigurerats för att stödja separata Firebase-miljöer för utveckling (dev) och produktion (prod).

## Konfiguration

### 1. Fyll i dina Firebase-credentials

Öppna `.env` filen och uppdatera DEV Firebase-konfigurationen med dina egna värden från ditt dev Firebase-projekt:

```env
DEV_FIREBASE_API_KEY=din_api_key
DEV_FIREBASE_AUTH_DOMAIN=ditt-projekt.firebaseapp.com
DEV_FIREBASE_PROJECT_ID=ditt-projekt-id
DEV_FIREBASE_STORAGE_BUCKET=ditt-projekt.firebasestorage.app
DEV_FIREBASE_MESSAGING_SENDER_ID=ditt_sender_id
DEV_FIREBASE_APP_ID=ditt_app_id
```

Du hittar dessa värden i Firebase Console:
1. Gå till din Firebase-projekt
2. Klicka på kugghjulet (⚙️) > Project Settings
3. Scrolla ner till "Your apps"
4. Kopiera värdena från Firebase SDK snippet

### 2. Android google-services.json

För Android behöver du två separata `google-services.json` filer:

- `android/app/google-services.json` - för **produktion**
- `android/app/google-services-dev.json` - för **utveckling** (skapa denna fil)

Hämta dessa från respektive Firebase-projekt.

### 3. iOS GoogleService-Info.plist (om du använder iOS)

För iOS behöver du två separata `GoogleService-Info.plist` filer:

- `GoogleService-Info.plist` - för **produktion**
- `GoogleService-Info-dev.plist` - för **utveckling**

## Användning

### Firebase Functions

Dina Functions behöver deployeras till rätt projekt:

#### Deploya till dev-miljö:
```bash
cd functions
npm run deploy:dev
```

#### Deploya till prod-miljö:
```bash
cd functions
npm run deploy:prod
```

#### Kör Functions lokalt med emulator:
```bash
cd functions
npm run serve:dev    # För dev-projekt
npm run serve:prod   # För prod-projekt
```

#### Se loggar från Functions:
```bash
cd functions
npm run logs:dev     # Loggar från dev
npm run logs:prod    # Loggar från prod
```

### Lokal utveckling

#### Starta i dev-miljö (standard):
```bash
npm run start:dev
```

#### Starta i prod-miljö:
```bash
npm run start:prod
```

#### Kör på Android i dev-miljö:
```bash
npm run android:dev
```

#### Kör på Android i prod-miljö:
```bash
npm run android:prod
```

### EAS Build

Miljön sätts automatiskt baserat på build-profilen:

- `eas build --profile development` → använder **dev** miljön
- `eas build --profile preview` → använder **dev** miljön
- `eas build --profile production` → använder **prod** miljön

## Hur det fungerar

1. **app.config.js** läser miljövariabler från `.env` filen och exponerar dem via `extra`
2. **firebase.js** läser miljön (dev/prod) från `Constants.expoConfig.extra.appEnv`
3. Baserat på miljön väljs rätt Firebase-konfiguration
4. Firebase initialiseras med vald konfiguration
5. **Functions** deployeras separat till dev eller prod-projektet med `npm run deploy:dev` eller `npm run deploy:prod`

## Viktigt om Functions

- Mobilappen anropar automatiskt functions i **samma projekt** som den är konfigurerad för
- Om appen körs i dev-läge (viktor-2e4f9), anropas functions i dev-projektet
- Om appen körs i prod-läge (lekplatsen-907fb), anropas functions i prod-projektet
- **Kom ihåg**: Du måste deploya samma functions till BÅDA projekten:
  ```bash
  cd functions
  npm run deploy:dev   # Deploya till viktor-2e4f9
  npm run deploy:prod  # Deploya till lekplatsen-907fb
  ```

## Rekommenderat arbetsflöde

1. **Utveckling**: 
   - Mobilapp: `npm run start:dev` (anropar viktor-2e4f9)
   - Functions: `cd functions && npm run serve:dev` (kör lokalt mot viktor-2e4f9)
   - Testa ändringar lokalt med emulator

2. **Deployment till dev**:
   - Deploy functions: `cd functions && npm run deploy:dev`
   - Bygg app: `eas build --profile development`

3. **Deployment till production**:
   - Deploy functions: `cd functions && npm run deploy:prod`
   - Bygg app: `eas build --profile production`

## Verifiera vilken miljö som används

När appen startar kommer du att se i konsolen:
```
🔥 Firebase initialized in development mode
📦 Using project: ditt-dev-projekt-id
```

eller

```
🔥 Firebase initialized in production mode
📦 Using project: lekplatsen-907fb
```

## Viktigt!

- `.env` filen är **inte** versionshanterad (finns i `.gitignore`)
- Dela **ALDRIG** dina Firebase API-nycklar publikt
- Använd alltid dev-miljön för testning
- Bygg alltid releases med production-profilen

## Felsökning

### Problem: Appen använder fel miljö

1. Kontrollera att du använder rätt script (`npm run start:dev` eller `npm run start:prod`)
2. Rensa cache: `expo start -c`
3. Kontrollera konsolen för vilket projekt-ID som används

### Problem: Firebase-fel vid start

1. Verifiera att alla variabler i `.env` är korrekt ifyllda
2. Kontrollera att du har kopierat rätt värden från Firebase Console
3. Se till att Firebase-projektet är korrekt konfigurerat

### Problem: Android-build misslyckas

1. Kontrollera att `google-services.json` existerar för båda miljöerna
2. Verifiera att filerna innehåller rätt projekt-information
