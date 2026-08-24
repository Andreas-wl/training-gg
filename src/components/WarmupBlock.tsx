import { useTraining } from '../state/TrainingProvider';
import { Card } from '../ui/Card';
import { SectionHeader } from '../ui/SectionHeader';
import { Button } from '../ui/Button';

const inputClass =
  'w-full rounded-xl border-0 bg-app px-2.5 py-2 text-sm text-ink placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-accent';

export function WarmupBlock({ dayIndex, week }: { dayIndex: number; week: number }) {
  const { state, addWarmupItem, removeWarmupItem, renameWarmupItem, updateWarmupLog, previousWarmupLog } =
    useTraining();
  const items = state.warmupPlan[dayIndex] || [];

  return (
    <div className="mb-4">
      <SectionHeader title="Uppvärmning" onAction={() => addWarmupItem(dayIndex)} />
      <Card className="p-4">
        {items.map((item, idx) => {
          const thisWeekLog = state.warmupLogs[`warmup_${item.id}_w${week}`];
          const fallback = thisWeekLog || previousWarmupLog(item.id, week) || {};
          return (
            <div className="mb-2 grid grid-cols-[2fr_1.1fr_1fr_auto] gap-2 last:mb-0" key={item.id}>
              <input
                className={inputClass}
                placeholder="Övning"
                defaultValue={item.name || ''}
                onBlur={(e) => renameWarmupItem(dayIndex, idx, e.target.value)}
              />
              <input
                key={`sr_${item.id}_w${week}`}
                className={inputClass}
                placeholder="t.ex. 2x8"
                defaultValue={fallback.setsReps || ''}
                onBlur={(e) => updateWarmupLog(item.id, week, item.name, { setsReps: e.target.value })}
              />
              <input
                key={`w_${item.id}_w${week}`}
                className={inputClass}
                placeholder="vikt"
                defaultValue={fallback.weight || ''}
                onBlur={(e) => updateWarmupLog(item.id, week, item.name, { weight: e.target.value })}
              />
              <button
                className="flex h-9 w-9 items-center justify-center rounded-full bg-app text-dim"
                title="Ta bort"
                onClick={() => removeWarmupItem(dayIndex, idx)}
              >
                ✕
              </button>
            </div>
          );
        })}

        <Button variant="secondary" className="mt-2 text-xs" onClick={() => addWarmupItem(dayIndex)}>
          + Lägg till övning
        </Button>
      </Card>
    </div>
  );
}
