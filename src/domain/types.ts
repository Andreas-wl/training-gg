// Program (lyft-schema) är nu data, inte hårdkodade konstanter - se
// PLAN.md #4. Ett uppladdat program kan ha helt andra lyftnycklar, så
// `LiftKey` är inte längre en union av 10 kända strängar.
export type LiftKey = string;

export interface LiftDefinition {
  name: string;
  group: string;
  isMain: boolean;
  setScheme: 'autoregulated' | 'fixed';
  // Kroppsviktslyft (t.ex. Nordic curls) har inget skivstångsmax att räkna
  // procent på - då är målvikten alltid 0 och UI:t säger "kroppsvikt".
  bodyweight?: boolean;
  // 'autoregulated' (SBS): inget fast antal set i förväg - antalet set man
  //   klarade är själva mätvärdet (jämförs mot defaultThresholds).
  // 'fixed' (t.ex. klassiskt 5×5): targetSets är känt i förväg.
  targetSets?: number;
  // Endast för 'fixed': %-tabellen är meningslös för ett lyft som inte körs
  // på procent av ett max, så repsmålet anges explicit.
  targetReps?: number;
}

export interface PercentRow {
  pct: number;
  reps: number;
  rir: number;
}

export interface Thresholds {
  lower: number;
  upper: number;
  increasePct: number;
  decreasePct: number;
}

export interface Settings {
  frequency: number;
  rounding: number;
  singleAt8Percent: number;
  unit: string;
}

// Passmall utanför skivstången: det som körs före (mobility + explosivt) och
// efter (tillägg) SBS-lyften. Ligger i programmet eftersom det är data, precis
// som accessorySuggestions - men seedas in i användarens egen plan så den kan
// redigeras fritt. Nyckeln är frekvens (som dayTemplates), arrayen är per dag.
export interface DayPrepTemplate {
  mobility?: PlannedItem[];
  explosive?: PlannedItem[];
  extras?: PlannedItem[];
}

export interface PlannedItem {
  name: string;
  setsReps?: string;
}

export interface Program {
  id: string;
  name: string;
  description?: string;
  lifts: Record<string, LiftDefinition>;
  dayTemplates: Record<number, string[][]>;
  weekMainIntensity: number[];
  variationOffset: number;
  percentChart: PercentRow[];
  defaultThresholds: Thresholds;
  defaultSettings: Settings;
  accessorySuggestions?: string[];
  dayPrep?: Record<number, DayPrepTemplate[]>;
}

// Set-nivå-loggning (etapp 4, PLAN.md #5) - varje set bär sitt eget snapshot
// av vad som var planerat (targetWeight/targetReps) kontra vad som faktiskt
// gjordes (weight/reps), så en avvikelse mitt i passet inte skriver över
// resten av veckans set (buggen i den gamla aggregat-modellen).
export interface SetEntry {
  index: number;
  targetWeight: number;
  targetReps: number;
  weight: number;
  reps: number | null;
  rir: number | null;
  adjusted: boolean;
  adjustedAt?: string;
  adjustmentNote?: string;
}

export interface LiftLog {
  testSingle?: number | null;
  notes?: string;
  sets: SetEntry[];
  // Autoregleringsförslaget för DEN HÄR veckan är redan tillämpat. Utan
  // detta går förslaget att trycka på om och om igen (det räknas ut från
  // hårda set kontra trösklar, vilket inte ändras av att maxet höjs), så
  // maxet skulle kunna trappas upp flera steg av misstag.
  autoregApplied?: { newMax: number; appliedAt: string };
}

export interface AccessorySlot {
  id: string;
  name: string;
  // Planerat set/reps från programmet ("3x6-8"). Används bara som förslag
  // när det inte finns någon logg för veckan - faktiska värden bor i
  // AccessoryLog, per vecka.
  setsReps?: string;
}

export interface AccessoryLog {
  name: string;
  setsReps?: string;
  weight?: string;
}

// Fritt tillägg ovanpå programmets mall, samma mönster som AccessorySlot -
// se PLAN.md #6. Bor i TrainingState, inte i Program.
export interface WarmupItem {
  id: string;
  name: string;
  // Passordningen är mobility -> explosivt -> SBS -> tillägg. Båda
  // för-pass-blocken delar samma lista och skiljs på `kind` (saknas det
  // räknas raden som mobility, dvs gamla sparade rader hamnar rätt).
  kind?: 'mobility' | 'explosive';
  setsReps?: string;
  weight?: string;
}

export interface WarmupLog {
  setsReps?: string;
  weight?: string;
}

export interface TrainingState {
  version: number;
  settings: Settings;
  maxes: Record<LiftKey, number | null>;
  thresholds: Thresholds;
  currentWeek: number;
  currentDayIndex: number;
  accessoryPlan: Record<number, AccessorySlot[]>;
  accessoryLogs: Record<string, AccessoryLog>;
  warmupPlan: Record<number, WarmupItem[]>;
  warmupLogs: Record<string, WarmupLog>;
  favoriteBackExercise: string;
  // Markör för att programmets dayPrep redan har seedats in i
  // warmupPlan/accessoryPlan ("<programId>:<frekvens>"). Utan den skulle
  // seedningen köra igen och skapa dubbletter med nya id:n (makeId() är
  // tidsbaserad), vilket dessutom skulle orphana veckans loggar.
  seededPrepFor?: string;
  logs: Record<string, LiftLog>;
}
