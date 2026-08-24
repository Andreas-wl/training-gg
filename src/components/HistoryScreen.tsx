import { useTraining } from '../state/TrainingProvider';
import { blockWaveLabel } from '../domain/programEngine';
import type { AccessoryLog, LiftLog, SetEntry } from '../domain/types';
import { Card } from '../ui/Card';

// Vanligaste (vikt × reps)-kombinationen bland loggade set - se PLAN.md
// #8.5: "3 set · 82.5 kg × 5 (1 just.)" avser det representativa setet, inte
// nödvändigtvis det senast loggade. Set utan reps (t.ex. migrerade
// legacy-poster) räknas bara in om inga andra set har reps.
function summarizeSets(sets: SetEntry[]): { weight: number; reps: number | null } | null {
  const withReps = sets.filter((s) => s.reps != null);
  const source = withReps.length > 0 ? withReps : sets;
  if (source.length === 0) return null;

  const counts = new Map<string, { weight: number; reps: number | null; count: number }>();
  source.forEach((s) => {
    const key = `${s.weight}_${s.reps}`;
    const entry = counts.get(key);
    if (entry) entry.count += 1;
    else counts.set(key, { weight: s.weight, reps: s.reps, count: 1 });
  });

  let best: { weight: number; reps: number | null; count: number } | null = null;
  for (const entry of counts.values()) {
    if (!best || entry.count > best.count) best = entry;
  }
  return best;
}

export function HistoryScreen() {
  const { state, program } = useTraining();

  const liftEntries: { liftKey: string; week: number; log: LiftLog }[] = [];
  Object.entries(state.logs).forEach(([key, log]) => {
    const hasData = (log.sets?.length ?? 0) > 0 || log.testSingle != null || (log.notes && log.notes.trim());
    if (!hasData) return;
    const m = key.match(/^(.+)_w(\d+)$/);
    if (!m) return;
    liftEntries.push({ liftKey: m[1], week: Number(m[2]), log });
  });

  const accEntries: { key: string; week: number; log: AccessoryLog }[] = [];
  Object.entries(state.accessoryLogs).forEach(([key, log]) => {
    const hasData = (log.setsReps && log.setsReps.trim()) || (log.weight && String(log.weight).trim());
    if (!hasData) return;
    const m = key.match(/^acc_(.+)_w(\d+)$/);
    if (!m) return;
    accEntries.push({ key, week: Number(m[2]), log });
  });

  if (liftEntries.length === 0 && accEntries.length === 0) {
    return (
      <p className="px-4 py-12 text-center text-[15px] text-dim">
        Ingen historik än. Logga ett set på Idag-fliken.
      </p>
    );
  }

  liftEntries.sort((a, b) => b.week - a.week || a.liftKey.localeCompare(b.liftKey));
  accEntries.sort((a, b) => b.week - a.week || (a.log.name || '').localeCompare(b.log.name || ''));

  return (
    <>
      {liftEntries.map(({ liftKey, week, log }) => {
        const lift = program.lifts[liftKey];
        if (!lift) return null;
        const bw = blockWaveLabel(program, week);
        const sets = log.sets ?? [];
        const summary = summarizeSets(sets);
        const adjustedCount = sets.filter((s) => s.adjusted).length;
        const setsText =
          sets.length > 0
            ? `${sets.length} set${summary ? ` · ${summary.weight} ${state.settings.unit} × ${summary.reps ?? '–'}` : ''}${
                adjustedCount > 0 ? ` (${adjustedCount} just.)` : ''
              }`
            : null;

        return (
          <Card className="mb-3 p-4" key={`${liftKey}_w${week}`}>
            <div className="flex items-baseline justify-between">
              <span className="font-semibold text-ink">{lift.name}</span>
              <span className="text-sm text-dim">Vecka {week}</span>
            </div>
            <div className="mt-1 text-sm text-dim">
              {bw.text}
              {setsText ? ` · ${setsText}` : ''}
            </div>
            {log.testSingle != null && (
              <div className="mt-1 text-sm text-dim">Testad singel: {log.testSingle} {state.settings.unit}</div>
            )}
            {log.notes && <div className="mt-1 text-sm text-dim">&quot;{log.notes}&quot;</div>}
          </Card>
        );
      })}

      {accEntries.map(({ key, week, log }) => {
        const bw = blockWaveLabel(program, week);
        return (
          <Card className="mb-3 p-4" key={key}>
            <div className="flex items-baseline justify-between">
              <span className="font-semibold text-ink">{log.name || '(namnlös övning)'}</span>
              <span className="text-sm text-dim">Vecka {week}</span>
            </div>
            <div className="mt-1 text-sm text-dim">{bw.text} · Tillbehör</div>
            <div className="mt-1 text-sm text-dim">
              {log.setsReps || '–'}
              {log.weight ? ` · ${log.weight} ${state.settings.unit}` : ''}
            </div>
          </Card>
        );
      })}
    </>
  );
}
