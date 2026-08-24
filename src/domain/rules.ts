/*
 * Regler extraherade från "Kopia av SBS Strength Program.xlsx".
 * Rak TypeScript-port av legacy/data.js - samma regler, samma värden.
 * I etapp 2 (se PLAN.md) blir det här ett Program-objekt som kan bytas ut;
 * just nu är det fortfarande en global konstant, precis som i originalet.
 */

export type LiftKey =
  | 'squat'
  | 'bench'
  | 'deadlift'
  | 'ohp'
  | 'frontSquat'
  | 'pausedSquat'
  | 'closeGripBench'
  | 'inclinePress'
  | 'sumoDeadlift'
  | 'pushPress';

export interface LiftDefinition {
  name: string;
  group: LiftKey;
  isMain: boolean;
}

// De 10 lyften. `group` kopplar en variant till sitt huvudlyft (för -10% offset).
export const LIFTS: Record<LiftKey, LiftDefinition> = {
  squat:          { name: 'Knäböj',                 group: 'squat',    isMain: true },
  bench:          { name: 'Bänkpress',               group: 'bench',    isMain: true },
  deadlift:       { name: 'Marklyft',                group: 'deadlift', isMain: true },
  ohp:            { name: 'Militärpress',            group: 'ohp',      isMain: true },
  frontSquat:     { name: 'Frontböj',                group: 'squat',    isMain: false },
  pausedSquat:    { name: 'Knäböj (paus)',           group: 'squat',    isMain: false },
  closeGripBench: { name: 'Bänkpress (smalt grepp)', group: 'bench',    isMain: false },
  inclinePress:   { name: 'Lutande bänkpress',       group: 'bench',    isMain: false },
  sumoDeadlift:   { name: 'Marklyft (sumo)',         group: 'deadlift', isMain: false },
  pushPress:      { name: 'Push press',              group: 'ohp',      isMain: false },
};

export const LIFT_ORDER = Object.keys(LIFTS) as LiftKey[];

// Vilka lyft som tränas vilken dag, per veckofrekvens. Extraherat 1:1 från
// flikarna "2x".."6x" i kalkylbladet.
export const DAY_TEMPLATES: Record<number, LiftKey[][]> = {
  2: [
    ['squat', 'bench', 'sumoDeadlift', 'pushPress'],
    ['deadlift', 'ohp', 'frontSquat', 'closeGripBench'],
  ],
  3: [
    ['squat', 'sumoDeadlift', 'inclinePress'],
    ['bench', 'ohp', 'frontSquat'],
    ['deadlift', 'closeGripBench', 'pausedSquat', 'pushPress'],
  ],
  4: [
    ['squat', 'inclinePress', 'sumoDeadlift'],
    ['bench', 'frontSquat', 'pushPress'],
    ['deadlift', 'closeGripBench'],
    ['ohp', 'pausedSquat'],
  ],
  5: [
    ['squat', 'pushPress'],
    ['bench', 'frontSquat'],
    ['deadlift', 'closeGripBench'],
    ['ohp', 'pausedSquat'],
    ['inclinePress', 'sumoDeadlift'],
  ],
  6: [
    ['squat', 'closeGripBench'],
    ['pushPress', 'sumoDeadlift'],
    ['bench', 'frontSquat'],
    ['inclinePress', 'pausedSquat'],
    ['deadlift'],
    ['ohp'],
  ],
};

// Intensitet (% av max) för huvudlyft, vecka 1-21. Varianter tränas alltid
// 10 procentenheter lägre samma vecka (fast värde i original-arket).
export const WEEK_MAIN_INTENSITY: number[] = [
  0.70, 0.75, 0.80, 0.725, 0.775, 0.825, 0.60, // block 1 (v1-7)
  0.75, 0.80, 0.85, 0.775, 0.825, 0.875, 0.60, // block 2 (v8-14)
  0.80, 0.85, 0.90, 0.85, 0.90, 0.95, 0.60,    // block 3 (v15-21)
];
export const VARIATION_OFFSET = -0.10;
export const CYCLE_LENGTH = WEEK_MAIN_INTENSITY.length; // 21 veckor, upprepas därefter

export interface PercentRow {
  pct: number;
  reps: number;
  rir: number;
}

// %1RM -> (reps, RIR-cutoff). Samma tabell för alla lyft i original-arket.
// RIR-cutoff = gränsen för hur nära failure du ska gå innan du räknar setet
// som "hårt" (används för autoreglering av volym).
export const PERCENT_CHART: PercentRow[] = [
  { pct: 0.500, reps: 8, rir: 5 },
  { pct: 0.525, reps: 8, rir: 5 },
  { pct: 0.550, reps: 8, rir: 5 },
  { pct: 0.575, reps: 8, rir: 5 },
  { pct: 0.600, reps: 7, rir: 4 },
  { pct: 0.625, reps: 7, rir: 4 },
  { pct: 0.650, reps: 6, rir: 4 },
  { pct: 0.675, reps: 6, rir: 4 },
  { pct: 0.700, reps: 5, rir: 3 },
  { pct: 0.725, reps: 5, rir: 3 },
  { pct: 0.750, reps: 4, rir: 3 },
  { pct: 0.775, reps: 4, rir: 3 },
  { pct: 0.800, reps: 3, rir: 2 },
  { pct: 0.825, reps: 3, rir: 2 },
  { pct: 0.850, reps: 2, rir: 2 },
  { pct: 0.875, reps: 2, rir: 2 },
  { pct: 0.900, reps: 1, rir: 1 },
  { pct: 0.925, reps: 1, rir: 1 },
  { pct: 0.950, reps: 1, rir: 1 },
  { pct: 0.975, reps: 1, rir: 0 },
  { pct: 1.000, reps: 1, rir: 0 },
];

export interface Thresholds {
  lower: number;
  upper: number;
  increasePct: number;
  decreasePct: number;
}

// Standardtrösklar för autoreglering. I originalet är dessa lika för alla
// lyft: 4-6 "hårda" set/vecka = behåll vikten, <4 = sänk, >=6 = höj.
export const DEFAULT_THRESHOLDS: Thresholds = { lower: 4, upper: 6, increasePct: 0.02, decreasePct: -0.05 };

export interface Settings {
  frequency: number;
  rounding: number;
  singleAt8Percent: number;
  unit: string;
}

export const DEFAULT_SETTINGS: Settings = {
  frequency: 4,
  rounding: 2.5,
  singleAt8Percent: 0.9, // en singel @RPE8 antas motsvara 90% av sant 1RM
  unit: 'kg',
};

// Ryggövningar från "Quick Setup" B19:B26 - fritt val till accessory-slots.
export const BACK_EXERCISES: string[] = [
  'Skivstångsrodd',
  'Hantelrodd',
  'Sittande kabelrodd (chest supported)',
  'T-bar rodd',
  'Pull-ups',
  'Chins',
  'Pull-ups (neutralt grepp)',
  'Neddrag i block',
];

export function effectiveWeek(absoluteWeek: number): number {
  return ((absoluteWeek - 1) % CYCLE_LENGTH) + 1;
}

export interface BlockWaveLabel {
  block: number;
  wave?: number;
  weekInWave?: number;
  deload: boolean;
  text: string;
}

// Block/våg-etikett, t.ex. "Block 2, våg 1, vecka 2/3" eller "Deload".
export function blockWaveLabel(absoluteWeek: number): BlockWaveLabel {
  const week = effectiveWeek(absoluteWeek);
  const withinBlock = ((week - 1) % 7) + 1;
  const block = Math.floor((week - 1) / 7) + 1;
  if (withinBlock === 7) {
    return { block, deload: true, text: `Block ${block} - Deload` };
  }
  const wave = withinBlock <= 3 ? 1 : 2;
  const weekInWave = withinBlock <= 3 ? withinBlock : withinBlock - 3;
  return { block, wave, weekInWave, deload: false, text: `Block ${block}, våg ${wave}, vecka ${weekInWave}/3` };
}

export function intensityFor(liftKey: LiftKey, absoluteWeek: number): number {
  const week = effectiveWeek(absoluteWeek);
  const main = WEEK_MAIN_INTENSITY[week - 1];
  const isMain = LIFTS[liftKey].isMain;
  const pct = isMain ? main : main + VARIATION_OFFSET;
  return Math.round(pct * 1000) / 1000;
}

// Slår upp reps/RIR-cutoff för en given intensitet genom att avrunda till
// närmaste 2.5%-steg i tabellen (samma metod som kalkylbladets IF-kedja).
export function percentRow(pct: number): PercentRow {
  const clamped = Math.min(1, Math.max(0.5, pct));
  const stepped = Math.round(clamped / 0.025) * 0.025;
  let best = PERCENT_CHART[0];
  let bestDiff = Infinity;
  for (const row of PERCENT_CHART) {
    const diff = Math.abs(row.pct - stepped);
    if (diff < bestDiff) { bestDiff = diff; best = row; }
  }
  return best;
}

export function computeWeight(max: number | null | undefined, pct: number, rounding: number): number | null {
  if (!max || !rounding) return null;
  return Math.round((max * pct) / rounding) * rounding;
}

export function roundTo(value: number | null | undefined, rounding: number): number | null | undefined {
  if (value == null || !rounding) return value;
  return Math.round(value / rounding) * rounding;
}
