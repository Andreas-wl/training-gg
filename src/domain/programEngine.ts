/*
 * Domänmotor - rena funktioner som räknar på ett `Program`-objekt (se
 * PLAN.md #3 och #4). Samma matematik som legacy/app.js + tidigare
 * domain/rules.ts, men parametriserad på `program` istället för globala
 * konstanter, så att olika program (t.ex. uppladdade av användaren) kan
 * driva samma beräkningar.
 */
import type { PercentRow, Program } from './types';

export function cycleLength(program: Program): number {
  return program.weekMainIntensity.length;
}

export function effectiveWeek(program: Program, absoluteWeek: number): number {
  return ((absoluteWeek - 1) % cycleLength(program)) + 1;
}

export interface BlockWaveLabel {
  block: number;
  wave?: number;
  weekInWave?: number;
  deload: boolean;
  text: string;
}

// Block/våg-etikett, t.ex. "Block 2, våg 1, vecka 2/3" eller "Deload".
export function blockWaveLabel(program: Program, absoluteWeek: number): BlockWaveLabel {
  const week = effectiveWeek(program, absoluteWeek);
  const withinBlock = ((week - 1) % 7) + 1;
  const block = Math.floor((week - 1) / 7) + 1;
  if (withinBlock === 7) {
    return { block, deload: true, text: `Block ${block} - Deload` };
  }
  const wave = withinBlock <= 3 ? 1 : 2;
  const weekInWave = withinBlock <= 3 ? withinBlock : withinBlock - 3;
  return { block, wave, weekInWave, deload: false, text: `Block ${block}, våg ${wave}, vecka ${weekInWave}/3` };
}

export function intensityFor(program: Program, liftKey: string, absoluteWeek: number): number {
  const week = effectiveWeek(program, absoluteWeek);
  const main = program.weekMainIntensity[week - 1];
  const isMain = program.lifts[liftKey].isMain;
  const pct = isMain ? main : main + program.variationOffset;
  return Math.round(pct * 1000) / 1000;
}

// Slår upp reps/RIR-cutoff för en given intensitet genom att avrunda till
// närmaste 2.5%-steg i tabellen (samma metod som kalkylbladets IF-kedja).
export function percentRow(program: Program, pct: number): PercentRow {
  const clamped = Math.min(1, Math.max(0.5, pct));
  const stepped = Math.round(clamped / 0.025) * 0.025;
  let best = program.percentChart[0];
  let bestDiff = Infinity;
  for (const row of program.percentChart) {
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
