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

// Fritt tillägg ovanpå programmets mall, samma mönster som AccessorySlot -
// se PLAN.md #6. Bor i TrainingState, inte i Program.
export interface WarmupItem {
  id: string;
  name: string;
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
  logs: Record<string, LiftLog>;
}
