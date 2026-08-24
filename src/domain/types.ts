// Program (lyft-schema) är nu data, inte hårdkodade konstanter - se
// PLAN.md #4. Ett uppladdat program kan ha helt andra lyftnycklar, så
// `LiftKey` är inte längre en union av 10 kända strängar.
export type LiftKey = string;

export interface LiftDefinition {
  name: string;
  group: string;
  isMain: boolean;
  setScheme: 'autoregulated' | 'fixed';
  // 'autoregulated' (SBS): inget fast antal set i förväg - antalet set man
  //   klarade är själva mätvärdet (jämförs mot defaultThresholds).
  // 'fixed' (t.ex. klassiskt 5×5): targetSets är känt i förväg.
  targetSets?: number;
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
}

// Ett fält per lyft och vecka - samma aggregat-modell som legacy/app.js.
// Byts ut mot set-nivå-loggning i etapp 4 (se PLAN.md #5).
export interface LiftLog {
  testSingle?: number | null;
  setsCompleted?: number | null;
  notes?: string;
  weightUsed?: number | null;
  repsTarget?: number;
  rirCutoff?: number;
  pct?: number;
}

export interface AccessorySlot {
  id: string;
  name: string;
}

export interface AccessoryLog {
  name: string;
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
  favoriteBackExercise: string;
  logs: Record<string, LiftLog>;
}
