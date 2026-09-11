import { useTraining } from '../state/TrainingProvider';
import { Button } from '../ui/Button';
import { CollapsibleSection } from '../ui/CollapsibleSection';

const inputClass =
  'w-full rounded-xl border-0 bg-app px-2.5 py-2 text-sm text-ink placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-accent';

// Ett block för för-passet. Mobility och explosivt delar samma lista i
// warmupPlan och skiljs på `kind`; rader utan kind (sparade innan
// uppdelningen fanns) räknas som mobility. `idx` som skickas till
// rename/remove måste vara indexet i HELA listan, inte i den filtrerade.
export function WarmupBlock({
  dayIndex,
  week,
  kind,
  title,
  hint,
}: {
  dayIndex: number;
  week: number;
  kind: 'mobility' | 'explosive';
  title: string;
  hint?: string;
}) {
  const { state, addWarmupItem, removeWarmupItem, renameWarmupItem, updateWarmupLog, previousWarmupLog } =
    useTraining();
  const all = state.warmupPlan[dayIndex] || [];
  const items = all
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => (item.kind ?? 'mobility') === kind);

  const summary =
    items.length === 0
      ? (hint ?? 'Inga övningar')
      : items.map(({ item }) => item.name || 'Namnlös').join(' · ');

  return (
    <CollapsibleSection
      title={title}
      summary={summary}
      onAction={() => addWarmupItem(dayIndex, kind)}
      defaultOpen={items.length === 0}
    >
      <>
        {items.map(({ item, idx }) => {
          const thisWeekLog = state.warmupLogs[`warmup_${item.id}_w${week}`];
          // Veckans logg > förra veckans logg > programmets planerade
          // set/reps. Det sista är bara ett förslag i placeholdern, inget
          // sparat värde.
          const fallback = thisWeekLog || previousWarmupLog(item.id, week) || {};
          const planned = item.setsReps || 't.ex. 2x8';
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
                placeholder={planned}
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

        <Button variant="secondary" className="mt-2 text-xs" onClick={() => addWarmupItem(dayIndex, kind)}>
          + Lägg till övning
        </Button>
      </>
    </CollapsibleSection>
  );
}
