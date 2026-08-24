import { useTraining } from '../state/TrainingProvider';
import { blockWaveLabel } from '../domain/programEngine';
import type { AccessoryLog, LiftLog } from '../domain/types';
import { Card } from '../ui/Card';

export function HistoryScreen() {
  const { state, program } = useTraining();

  const liftEntries: { liftKey: string; week: number; log: LiftLog }[] = [];
  Object.entries(state.logs).forEach(([key, log]) => {
    const hasData = log.testSingle != null || log.setsCompleted != null || (log.notes && log.notes.trim());
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
        const weightText = log.weightUsed != null ? `${log.weightUsed} ${state.settings.unit}` : '–';
        return (
          <Card className="mb-3 p-4" key={`${liftKey}_w${week}`}>
            <div className="flex items-baseline justify-between">
              <span className="font-semibold text-ink">{lift.name}</span>
              <span className="text-sm text-dim">Vecka {week}</span>
            </div>
            <div className="mt-1 text-sm text-dim">
              {bw.text} · {weightText} × {log.repsTarget ?? '–'} reps · RIR-cutoff {log.rirCutoff ?? '–'}
            </div>
            <div className="mt-1 text-sm text-dim">
              Set klara: {log.setsCompleted ?? '–'}
              {log.testSingle ? ` · Testad singel: ${log.testSingle} ${state.settings.unit}` : ''}
            </div>
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
