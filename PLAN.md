# Styrkelogg → React – Plan

Det här dokumentet beskriver hur vi tar dagens fungerande vanilla-JS-prototyp
(`index.html` + `app.js` + `data.js`) till en React-app: arkitektur,
datamodell, designspråk, skärmar/flöde (ASCII-wireframes) och en föreslagen
etappindelning. Kod nedan är på hög nivå (interface/pseudokod), inte färdig
implementation.

## 1. Mål med omskrivningen

1. **React** istället för hand-rullad DOM-manipulation.
2. **Ett lagringslager** mellan `localStorage` och appen, så vi kan byta
   lagringsbackend senare (t.ex. till en server) utan att röra UI/affärslogik.
3. **Program (lyft-scheman) som data**, inte hårdkodat i `data.js`. Ett
   standardprogram (dagens SBS-mall) laddas som JSON, och man ska kunna ladda
   upp/välja egna program.
4. **Fixa bugg**: när man loggar ett set med avvikande reps och justerar
   vikten, ska appen inte anta att *alla* set den veckan gjordes med nya
   vikten/samma reps. Vi inför set-nivå-loggning med en `adjusted`-flagga och
   historik över justeringar.
5. **iOS-likt, enkelt UI** enligt referensbilden ("Bevel iOS 480.png"): ljust
   tema, rundade vita kort, stor rubrik, grupperade listor, flytande
   tab-bar. En övning i taget på skärmen, inte allt samtidigt.

## 2. Nuläge (kort)

- All kod i tre globala script-filer, ett `state`-objekt i minnet, sparas som
  en enda JSON-blob i `localStorage` (`sbsTrainerData_v1`).
- `data.js` innehåller allt om **regler**: lyft, dagmallar per frekvens,
  veckointensitet, %1RM→reps/RIR-tabell, standardtrösklar. Allt hårdkodat.
- Loggning sker **per lyft och vecka**, inte per set:
  `logs["squat_w3"] = { testSingle, setsCompleted, notes, weightUsed, repsTarget, rirCutoff, pct }`.
  `setsCompleted` är en manuellt inskriven siffra ("hur många hårda set blev
  det"), inte en lista av faktiska set.
- **Buggen**: eftersom `weightUsed`/`repsTarget` är ett gemensamt fält för
  hela veckan finns det inget ställe att uttrycka "det här enskilda setet
  avvek och jag justerade". Om man byter vikt mitt i passet skrivs bara det
  aggregerade fältet över — ingen historik över *vilka* set som var
  justerade eller varför.

## 3. Arkitektur – lagerindelning

```
┌───────────────────────────────────────────────────┐
│  Screens (Idag, Övning, Historik, Program, ...)    │  React-komponenter,
│                                                     │  "dumma", bara UI
├───────────────────────────────────────────────────┤
│  Domän-hooks (useTrainingState, useProgram, ...)   │  React Context/reducer,
│                                                     │  affärslogik + state
├───────────────────────────────────────────────────┤
│  Domänmotor (programEngine.ts)                     │  Rena funktioner:
│                                                     │  intensityFor, percentRow,
│                                                     │  computeWeight, blockWaveLabel
├───────────────────────────────────────────────────┤
│  Repository (TrainingRepository)                   │  Vet VAD som sparas
│                                                     │  (state, program, version)
├───────────────────────────────────────────────────┤
│  StorageAdapter (interface)                        │  Vet HUR det sparas
│    ↳ LocalStorageAdapter        (idag)             │
│    ↳ (framtid) RemoteApiAdapter / IndexedDBAdapter │
└───────────────────────────────────────────────────┘
```

Regeln: **skärmar pratar aldrig direkt med storage**. De använder hooks, som
använder repository, som använder en adapter. Vill vi senare byta ut
`localStorage` mot en server behöver vi bara skriva en ny `StorageAdapter` –
resten av appen är orörd.

### 3.1 StorageAdapter (interface)

```ts
interface StorageAdapter {
  getItem<T>(key: string): Promise<T | null>;
  setItem<T>(key: string, value: T): Promise<void>;
  removeItem(key: string): Promise<void>;
}

class LocalStorageAdapter implements StorageAdapter {
  // JSON.stringify/parse mot window.localStorage, som idag
}
```

### 3.2 Repository (domänspecifikt, ovanpå adaptern)

```ts
class TrainingRepository {
  constructor(private storage: StorageAdapter) {}

  loadState(): Promise<TrainingState>       // hanterar ev. migrering av gammalt format
  saveState(state: TrainingState): Promise<void>

  listPrograms(): Promise<Program[]>
  saveProgram(program: Program): Promise<void>
  getActiveProgramId(): Promise<string>
  setActiveProgramId(id: string): Promise<void>
}
```

Repository är den **enda** platsen som känner till nycklarna i storage och
hur gammalt sparat format ska tolkas om (motsvarar dagens
`migrateOldAccessories`, fast centraliserat och generellt).

React-sidan: en `TrainingProvider` skapar en repository-instans (med vald
adapter) i appens rot, laddar state asynkront vid start och exponerar det via
Context. Komponenter använder hooks som `useTrainingState()`,
`useProgram()`, `useLogActions()` – aldrig `localStorage` eller adaptern
direkt.

## 4. Program som JSON (istället för hårdkodat i `data.js`)

```ts
interface LiftDefinition {
  name: string;
  group: string;
  isMain: boolean;
  setScheme: 'autoregulated' | 'fixed';
  // 'autoregulated' (SBS): inget fast antal set i förväg. Man loggar set
  //   tills man inte längre klarar mål-reps inom RIR-gränsen, och ANTALET
  //   set man klarade är själva mätvärdet (jämförs mot defaultThresholds).
  // 'fixed' (t.ex. klassiskt 5×5): targetSets är känt i förväg och UI:t
  //   kan visa upp N set-rader direkt.
  targetSets?: number;   // krävs bara när setScheme === 'fixed'
}

interface Program {
  id: string;
  name: string;
  description?: string;
  lifts: Record<string, LiftDefinition>;
  dayTemplates: Record<number, string[][]>;   // frekvens -> dagar -> lyftnycklar
  weekMainIntensity: number[];
  variationOffset: number;
  percentChart: { pct: number; reps: number; rir: number }[];
  defaultThresholds: { lower: number; upper: number; increasePct: number; decreasePct: number };
  defaultSettings: { rounding: number; singleAt8Percent: number; unit: string };
  accessorySuggestions?: string[];            // t.ex. dagens BACK_EXERCISES
}
```

`setScheme` sitter **per lyft, i programmet** – inte som en global
app-inställning – eftersom ett uppladdat program kan blanda stilar (t.ex.
autoreglerade huvudlyft men fasta set på tillbehör). SBS-standardprogrammet
sätter `setScheme: 'autoregulated'` på alla sina lyft (`targetSets` utelämnas
helt där).

- Dagens `data.js`-innehåll (redan verifierat mot Excel-arket) blir
  `src/data/programs/sbs-default.json` – helt oförändrade regler, bara i
  JSON-form.
- `programEngine.ts` gör exakt samma beräkningar som idag
  (`intensityFor`, `percentRow`, `computeWeight`, `blockWaveLabel`), men tar
  emot `program` som parameter istället för att läsa globala konstanter.
- **Programbibliotek**: en skärm under Inställningar/Program där man ser
  standardprogrammet + ev. importerade program, väljer aktivt, och kan
  importera en egen JSON-fil (`<input type="file">` + validering, t.ex. med
  `zod`, mot schemat ovan). Importerade program sparas via
  `repository.saveProgram(...)`, precis som annan data. Man ska också kunna
  exportera aktuellt program som JSON – bra dokumentation för hur man bygger
  sitt eget.

## 5. Ny loggmodell + fix av "justerad vikt/reps"-buggen

**Dagens modell** (ett fält per lyft och vecka, inte per set):

```
logs["squat_w3"] = { weightUsed, repsTarget, setsCompleted, testSingle, notes }
```

**Problemet**: `weightUsed`/`repsTarget` gäller hela veckan. Så fort vi vill
logga set för set (vilket vi ändå vill, för "en övning i taget"-flödet) och
byter vikt mitt i passet för att reps avvek, finns ingen plats att uttrycka
*vilket set* som avvek eller varför – och ingen historik över justeringar.

**Ny modell** (per lyft, vecka och set):

```ts
interface SetEntry {
  index: number;
  targetWeight: number;
  targetReps: number;
  weight: number;              // faktiskt använd vikt
  reps: number | null;         // faktiskt utförda reps
  rir: number | null;
  adjusted: boolean;           // true om vikt/reps avviker från mål
  adjustedAt?: string;         // ISO-tidsstämpel, för justeringshistorik
  adjustmentNote?: string;
}

interface LiftLog {
  liftKey: string;
  week: number;
  testSingle?: number;
  notes?: string;
  sets: SetEntry[];
}
```

- `adjusted` sätts **automatiskt** när `weight`/`reps` för ett set avviker
  från `targetWeight`/`targetReps` (appen behöver inte fråga användaren –
  den vet redan vad som var planerat för det setet). `targetWeight`/
  `targetReps` kommer alltid från `percentRow(pct)` i programmet, oavsett
  `setScheme`.
- **`sets.length` är inte förbestämd när `setScheme === 'autoregulated'`.**
  UI:t visar ett öppet "+ Logga set"-flöde utan känt slutantal; användaren
  avslutar övningen själv (eller appen föreslår att sluta när ett set inte
  längre klarar RIR-cutoffen). Antalet loggade set blir då `sets.length`
  och driver autoregleringen direkt (`< lower` → sänk, `>= upper` → höj) –
  det finns medvetet inget `targetSets` att jämföra mot i det här läget.
  När `setScheme === 'fixed'` känner UI:t till `targetSets` i förväg och kan
  förifylla lika många set-rader; autoreg-förslaget (om något) baseras
  istället på om alla fasta set klarades med bibehållna reps.
- "Hårda set" (dagens `setsCompleted`) blir en **härledd** summering från
  `sets` (för `autoregulated`: antal set som möter/överträffar
  RIR-cutoffen; för `fixed`: implicit `sets.length` mot `targetSets`)
  istället för ett separat manuellt fält – tar bort risken att siffran
  glappar mot vad som faktiskt loggades.
- Historikvyn kan visa/markera set med `adjusted: true` och en egen
  "justeringslogg" per lyft (alla set där `adjusted` är sant, sorterat på
  tid) – så man ser mönster över tid, precis det du efterfrågade.
- **Migrering**: gamla `logs[lift_wN]`-poster (aggregat) migreras till en
  `sets`-lista med ett syntetiskt set (`index: 0`, `adjusted: false`,
  `reps: null`) så historiken inte försvinner. Görs en gång i
  `TrainingRepository.loadState()`.

## 6. Uppvärmning och fri anpassning av dagen

Utöver programmets fasta struktur (lyft, dagindelning, intensitet) vill vi
kunna lägga till ett **uppvärmningsblock** innan huvudlyften för en dag, och
mer generellt kunna anpassa dagen fritt när man väl kör ett program – utan
att behöva redigera själva program-JSON:en.

Dagens app har redan exakt det här mönstret för tillbehörsövningar
(`accessoryPlan`/`accessoryLogs`): en lista per dag som ligger i
**användarens state**, helt fristående från programmet, och som man
fritt kan lägga till/ta bort rader i direkt i UI:t. Vi återanvänder samma
mönster för uppvärmning istället för att göra det till en del av
`Program`-schemat:

```ts
interface WarmupItem {
  id: string;
  name: string;
  setsReps?: string;   // fritext, t.ex. "2x8"
  weight?: string;     // fritext eller "% av dagens arbetsvikt"
}

interface TrainingState {
  // ...
  warmupPlan: Record<number, WarmupItem[]>;     // dayIndex -> rader, precis som accessoryPlan
  warmupLogs: Record<string, { setsReps?: string; weight?: string }>; // warmup_{id}_w{week}
  accessoryPlan: Record<number, AccessoryItem[]>;
  accessoryLogs: Record<string, { setsReps?: string; weight?: string; name: string }>;
  // ...
}
```

**Princip**: `Program` (JSON) beskriver den *delade mallen* – lyft,
dagindelning, intensitet, `setScheme`. `TrainingState` innehåller
användarens *personliga tillägg ovanpå mallen* – uppvärmning och
tillbehör idag, och samma mönster kan återanvändas för fler typer av
tillägg senare (t.ex. nedvarvning/mobility) utan att röra Program-schemat
eller kräva en ny JSON-import. Det är detta som ger "customiza precis som
man vill när man väl är inne i programmet" – anpassningarna är knutna till
din lokala körning av programmet, inte till mallen som delas/importeras.

UI-mässigt får dagöversikten (8.2) ett nytt "Uppvärmning"-block *överst*,
före huvudlyften, med samma "+ Lägg till övning"-interaktion som
tillbehörsblocket redan har idag.

## 7. Design / UI-lager

Referensbilden (Bevel, iOS) visar: ljusgrå bakgrund, vita rundade kort med
mjuk skugga, stor fet rubrik + grå underrubrik, sektionsrubriker med
ikonknappar (`…`, `+`), listrader med fet titel + grå underrad, och en
flytande, pillerformad tab-bar längst ner.

**Rekommendation**: Tailwind CSS + ett litet eget "ui-kit" som matchar
Bevel-tokens, byggt ovanpå [shadcn/ui](https://ui.shadcn.com)-primitiv
(Dialog/Sheet, Select) för tillgänglighet (fokushantering, tangentbord,
skärmläsare) utan att ärva en hel opinionerad visuell stil. Alternativ:
Ionic React ger native-känsla (gester, haptik) helt gratis, men är tyngre
och svårare att styla exakt som referensbilden. Med tanke på att appen är
liten och vi vill ha pixel-kontroll väljer vi Tailwind + shadcn/ui som bas.

Föreslagna primitiv i `src/ui/`:

- `Screen` – safe-area-padding, scroll-container
- `LargeTitle` – stor rubrik + grå underrubrik
- `Card` / `CardList`
- `ListRow` – titel, underrad, höger-innehåll (chevron, status, ikon)
- `SectionHeader` – etikett + ikonknappar
- `TabBar` – flytande piller, ikoner, aktivt tillstånd
- `Sheet` – bottom sheet (samma mönster som dagens `settingsOverlay`)
- `Button` – primär/sekundär, piller
- `Stepper` / `NumberField` – +/- för vikt/reps vid set-loggning

Färgtokens (ljust tema):
`--bg:#F2F2F7; --card:#FFFFFF; --text:#1C1C1E; --text-dim:#8E8E93; --accent:#0A84FF; --danger:#FF3B30; --success:#34C759;`
Kort använder skugga istället för synlig border, likt referensbilden. Mörkt
tema kan läggas till senare via CSS-variabler/`prefers-color-scheme` – inte
i MVP.

## 8. Skärmar & flöde (ASCII-wireframes)

Övergripande princip: **en övning i taget**. "Idag" är en innehållsförteckning
för dagens pass (namn + kort status), man trycker in i en övning för att
logga.

### 8.1 Onboarding (första gången, inga max satta)

```
┌─────────────────────────────────┐
│         🏋️ Styrkelogg           │
│                                  │
│   Välj program                  │
│   (●) SBS Strength (standard)   │
│   ( ) Importera eget program…   │
│                                  │
│   Sätt dina max                 │
│   Knäböj        [_____] kg      │
│   Bänkpress     [_____] kg      │
│   Marklyft      [_____] kg      │
│   Militärpress  [_____] kg      │
│                                  │
│   [        Kom igång        ]   │
└─────────────────────────────────┘
```

### 8.2 Idag – dagöversikt (lista, inte detaljer)

```
┌─────────────────────────────────┐
│  Idag                       ⚙   │
│  Vecka 3 av 21 · Block 1, våg 1 │
│                                  │
│   ◀     Dag 2 av 4     ▶        │
│                                  │
│  Uppvärmning                +   │
│  ┌─────────────────────────────┐│
│  │ Rodd 5 min · Axelcirklar     ││
│  └─────────────────────────────┘│
│                                  │
│  ┌─────────────────────────────┐│
│  │ Bänkpress              ✓    ││
│  │ Huvudlyft · 82.5 kg × 5     ││
│  └─────────────────────────────┘│
│  ┌─────────────────────────────┐│
│  │ Frontböj                    ││
│  │ Variant · 62.5 kg × 3       ││
│  └─────────────────────────────┘│
│  ┌─────────────────────────────┐│
│  │ Push press                  ││
│  │ Variant · 40 kg × 2         ││
│  └─────────────────────────────┘│
│                                  │
│  Tillbehör                  +   │
│  ┌─────────────────────────────┐│
│  │ Hantelrodd · 3×10 · 20 kg   ││
│  └─────────────────────────────┘│
│                                  │
│ ╭──────────────────────────────╮│
│ │ 🏠Idag  📜Hist  📋Prog  ⚙Inst││
│ ╰──────────────────────────────╯│
└─────────────────────────────────┘
```

### 8.3 Övning – detaljskärm (kärnan i "en övning i taget")

```
┌─────────────────────────────────┐
│ ←  Bänkpress                    │
│    Huvudlyft · vecka 3          │
│                                  │
│  ┌───────┬────────┬────────┐   │
│  │ Vikt  │ Reps   │ RIR    │   │
│  │82.5kg │  5     │  3     │   │
│  └───────┴────────┴────────┘   │
│  Mål: 4-6 hårda set/vecka       │
│                                  │
│  Testade du en singel idag?     │
│  [_____ kg]  [Använd som max]   │
│                                  │
│  Set                             │
│  ┌─────────────────────────────┐│
│  │ Set 1   82.5 kg × 5    ✓    ││
│  │ Set 2   82.5 kg × 5    ✓    ││
│  │ Set 3   80.0 kg × 4  ⚠ just.││
│  └─────────────────────────────┘│
│  [        + Logga set        ]  │
│                                  │
│  📈 Förslag: +2% → 84 kg [Använd]│
│                                  │
│  Anteckningar                   │
│  [_______________________]      │
│                                  │
│  ◀ Föregående övning  Nästa ▶   │
└─────────────────────────────────┘
```

`◀ Föregående / Nästa ▶` (eller swipe) flyttar mellan dagens övningar utan
att gå tillbaka till listan – man kan logga hela passet utan att lämna
"en övning i taget"-läget.

Ovanstående vy är för `setScheme: 'autoregulated'` (SBS): setlistan har
inget känt slutantal, "Mål" avser tröskelintervallet för hårda set totalt,
och man loggar set tills man själv (eller ett förslag i UI:t) bedömer att
passet för lyftet är klart. För `setScheme: 'fixed'` (t.ex. ett importerat
5×5-program) ser samma skärm istället ut så här – `targetSets` är känt i
förväg och raderna är förifyllda:

```
│  Set (mål: 5 set × 5 reps)      │
│  ┌─────────────────────────────┐│
│  │ Set 1   100 kg × 5     ✓    ││
│  │ Set 2   100 kg × 5     ✓    ││
│  │ Set 3   100 kg × –          ││   <- ej loggat än
│  │ Set 4   100 kg × –          ││
│  │ Set 5   100 kg × –          ││
│  └─────────────────────────────┘│
```

Ingen autoreg-banner visas i `fixed`-läget i denna version av planen – det
kan läggas till senare om vi vill autoreglera även fasta program.

### 8.4 Logga set (bottom sheet) – här löses buggen konkret

```
╭─────────────────────────────────╮
│  Logga set 3               ✕    │
│                                  │
│  Vikt          [ 80.0 ] kg       │
│  Reps          [   4  ]          │
│                                  │
│  ⚠ Avviker från mål (82.5 kg × 5)│
│    → sparas som justerat set     │
│                                  │
│  [        Spara set          ]  │
╰─────────────────────────────────╯
```

Om vikt/reps avviker från `targetWeight`/`targetReps` flaggas setet
automatiskt som `adjusted: true` med tidsstämpel – ingen manuell
kryssruta behövs, och det gäller bara *det* setet, inte resten av veckan.

### 8.5 Historik

```
┌─────────────────────────────────┐
│  Historik                       │
│                                  │
│  Vecka 3                        │
│  ┌─────────────────────────────┐│
│  │ Bänkpress                    ││
│  │ 3 set · 82.5 kg × 5 (1 just.)││
│  └─────────────────────────────┘│
│  ┌─────────────────────────────┐│
│  │ Knäböj                       ││
│  │ 4 set · 100 kg × 5           ││
│  └─────────────────────────────┘│
│                                  │
│  Vecka 2                        │
│  ...                             │
│                                  │
│ ╭──────────────────────────────╮│
│ │ 🏠Idag  📜Hist  📋Prog  ⚙Inst││
│ ╰──────────────────────────────╯│
└─────────────────────────────────┘
```

### 8.6 Program (bibliotek)

```
┌─────────────────────────────────┐
│  Program                    +   │
│  Välj vilket program du kör     │
│                                  │
│  ┌─────────────────────────────┐│
│  │ SBS Strength (standard)  ●  ││
│  │ 10 lyft · 2–6 pass/vecka    ││
│  └─────────────────────────────┘│
│  ┌─────────────────────────────┐│
│  │ Mitt eget program        ○  ││
│  │ Importerad 2026-08-10       ││
│  └─────────────────────────────┘│
│                                  │
│  [ + Importera program (JSON) ] │
│  [ Exportera aktuellt som JSON ]│
└─────────────────────────────────┘
```

### 8.7 Inställningar (grupperad iOS-lista)

```
┌─────────────────────────────────┐
│  Inställningar                  │
│                                  │
│  GRUNDINSTÄLLNINGAR              │
│  ┌─────────────────────────────┐│
│  │ Pass per vecka           4 >││
│  │ Avrundning             2.5 >││
│  │ Enhet                   kg >││
│  └─────────────────────────────┘│
│                                  │
│  AUTOREGLERING                   │
│  ┌─────────────────────────────┐│
│  │ Nedre/övre tröskel     4-6 >││
│  │ Öka/minska med      +2/-5% >││
│  └─────────────────────────────┘│
│                                  │
│  MAX                             │
│  ┌─────────────────────────────┐│
│  │ Knäböj               100kg >││
│  │ Bänkpress             80kg >││
│  └─────────────────────────────┘│
│                                  │
│  DATA                            │
│  ┌─────────────────────────────┐│
│  │ Exportera all data           ││
│  │ Återställ all data       ⚠ ││
│  └─────────────────────────────┘│
└─────────────────────────────────┘
```

### 8.8 Flöde (navigering)

```
Onboarding ──(max satta)──► Idag (dagöversikt)
                                │  tryck på övning
                                ▼
                         Övning (detalj) ──◀/▶── nästa/föregående övning
                                │  "+ Logga set"
                                ▼
                         Logga set (sheet)
                                │  Spara
                                ▼
                         tillbaka till Övning (uppdaterad, ev. ⚠ justerat)

Tab-bar (alltid synlig utom i Övning/sheets):
  Idag │ Historik │ Program │ Inställningar

Program-fliken ──importera JSON──► validering ──► sparas via
  TrainingRepository ──► syns i listan, kan väljas som aktivt
```

## 9. Mappstruktur (hög nivå)

```
src/
  main.tsx, App.tsx
  storage/
    StorageAdapter.ts
    LocalStorageAdapter.ts
    TrainingRepository.ts
  domain/
    types.ts            // Program, LiftLog, SetEntry, WarmupItem, Settings, Thresholds...
    programEngine.ts     // intensityFor, percentRow, computeWeight, blockWaveLabel
  data/
    programs/sbs-default.json
  state/
    TrainingProvider.tsx // Context + reducer, wrappar repository
    hooks.ts             // useTrainingState, useProgram, useLogActions
  ui/                    // designsystem-primitiv (Card, ListRow, TabBar, Sheet, ...)
  screens/
    OnboardingScreen, TodayScreen, ExerciseScreen,
    HistoryScreen, ProgramLibraryScreen, SettingsScreen
```

## 10. Föreslagen etappindelning

1. **Skelett**: Vite + React, storage-lager (adapter + repository) men med
   *samma* datamodell som idag – ren omskrivning, verifiera att appen
   beter sig identiskt.
2. **Program → JSON**: bryt ut `data.js` till `sbs-default.json`,
   `programEngine` tar `program` som parameter. Ingen import-UI ännu, bara
   standardprogrammet laddas.
3. **Design-lager**: Tailwind + iOS-primitiv, bygg om Idag/Historik/
   Inställningar visuellt i nya stilen (fortfarande med dagens
   "alla lyft synliga samtidigt"-navigering). Lägg till `warmupPlan`/
   `warmupLogs` i state enligt samma mönster som `accessoryPlan`, och rendera
   uppvärmningsblocket överst på dagöversikten.
4. **Ny loggmodell**: set-nivå-loggning + `adjusted` + `setScheme`
   (`autoregulated`/`fixed`) per lyft, migrering av gammal data (blir
   `autoregulated` för alla dagens lyft), bygg om Idag-flödet till
   "en övning i taget" + öppet/förifyllt "Logga set"-flöde beroende på
   scheman.
5. **Programbibliotek-UI**: importera/exportera/välja program (JSON-
   uppladdning + validering).
6. **Historik** uppdateras för att visa set-nivå och justeringsmarkeringar.
7. **PWA-polish**: service worker-cachelista uppdateras för Vite-bygget,
   ikoner, manifest.

## 11. Öppna frågor att ta ställning till

- **TypeScript eller JavaScript?** Rekommendation: TypeScript – ger
  kontrakt kring `Program`/`TrainingState` som blir extra värdefullt när
  användare kan importera egna JSON-program (vi vill kunna validera mot
  ett typat schema).
- Ska mörkt tema finnas kvar som alternativ, eller bara ljust
  (Bevel-stil) i första versionen?
- Om man byter aktivt program mitt i en cykel – hur hanteras
  vecka/dag-index som kanske inte stämmer mot det nya programmet? (Förslag:
  nollställ `currentWeek`/`currentDayIndex` vid programbyte, med en
  bekräftelsedialog.)
- Namn på ny lagringsnyckel för v2-schemat (t.ex. `styrkeloggData_v2`)?
