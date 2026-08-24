import { useTraining } from '../state/TrainingProvider';
import { blockWaveLabel } from '../domain/programEngine';
import type { AccessoryLog, LiftLog } from '../domain/types';

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
    return <div className="empty-state">Ingen historik än. Logga ett set på Idag-fliken.</div>;
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
          <div className="history-entry" key={`${liftKey}_w${week}`}>
            <div className="h-top">
              <span>{lift.name}</span>
              <span>Vecka {week}</span>
            </div>
            <div className="h-meta">
              {bw.text} · {weightText} × {log.repsTarget ?? '–'} reps · RIR-cutoff {log.rirCutoff ?? '–'}
            </div>
            <div className="h-meta">
              Set klara: {log.setsCompleted ?? '–'}
              {log.testSingle ? ` · Testad singel: ${log.testSingle} ${state.settings.unit}` : ''}
            </div>
            {log.notes && <div className="h-meta">&quot;{log.notes}&quot;</div>}
          </div>
        );
      })}

      {accEntries.map(({ key, week, log }) => {
        const bw = blockWaveLabel(program, week);
        return (
          <div className="history-entry" key={key}>
            <div className="h-top">
              <span>{log.name || '(namnlös övning)'}</span>
              <span>Vecka {week}</span>
            </div>
            <div className="h-meta">{bw.text} · Tillbehör</div>
            <div className="h-meta">
              {log.setsReps || '–'}
              {log.weight ? ` · ${log.weight} ${state.settings.unit}` : ''}
            </div>
          </div>
        );
      })}
    </>
  );
}
