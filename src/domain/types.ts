import type { LiftKey, Settings, Thresholds } from './rules';

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
