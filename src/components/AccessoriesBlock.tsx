import { useTraining } from '../state/TrainingProvider';
import { Button } from '../ui/Button';
import { CollapsibleSection } from '../ui/CollapsibleSection';

const inputClass =
  'w-full rounded-xl border-0 bg-app px-2.5 py-2 text-sm text-ink placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-accent';

export function AccessoriesBlock({ dayIndex, week }: { dayIndex: number; week: number }) {
  const {
    state,
    addAccessorySlot,
    addAccessorySlotWithName,
    removeAccessorySlot,
    renameAccessorySlot,
    updateAccessoryLog,
    previousAccessoryLog,
  } = useTraining();
  const slots = state.accessoryPlan[dayIndex] || [];

  const summary =
    slots.length === 0
      ? 'Lägg till rodd, axlar, bålarbete...'
      : slots.map((slot) => slot.name || 'Namnlös').join(' · ');

  return (
    <CollapsibleSection
      title="4 · Tillägg efter SBS"
      summary={summary}
      onAction={() => addAccessorySlot(dayIndex)}
      defaultOpen={slots.length === 0}
    >
      <>
        {slots.map((slot, idx) => {
          const thisWeekLog = state.accessoryLogs[`acc_${slot.id}_w${week}`];
          const fallback = thisWeekLog || previousAccessoryLog(slot.id, week) || {};
          const planned = slot.setsReps || 't.ex. 3x10';
          return (
            <div className="mb-2 grid grid-cols-[2fr_1.1fr_1fr_auto] gap-2 last:mb-0" key={slot.id}>
              <input
                className={inputClass}
                placeholder="Övning"
                defaultValue={slot.name || ''}
                onBlur={(e) => renameAccessorySlot(dayIndex, idx, e.target.value)}
              />
              <input
                key={`sr_${slot.id}_w${week}`}
                className={inputClass}
                placeholder={planned}
                defaultValue={fallback.setsReps || ''}
                onBlur={(e) => updateAccessoryLog(slot.id, week, slot.name, { setsReps: e.target.value })}
              />
              <input
                key={`w_${slot.id}_w${week}`}
                className={inputClass}
                placeholder="vikt"
                defaultValue={fallback.weight || ''}
                onBlur={(e) => updateAccessoryLog(slot.id, week, slot.name, { weight: e.target.value })}
              />
              <button
                className="flex h-9 w-9 items-center justify-center rounded-full bg-app text-dim"
                title="Ta bort"
                onClick={() => removeAccessorySlot(dayIndex, idx)}
              >
                ✕
              </button>
            </div>
          );
        })}

        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="secondary" className="text-xs" onClick={() => addAccessorySlot(dayIndex)}>
            + Lägg till övning
          </Button>

          {state.favoriteBackExercise && (
            <Button
              variant="secondary"
              className="text-xs"
              onClick={() => addAccessorySlotWithName(dayIndex, state.favoriteBackExercise)}
            >
              + {state.favoriteBackExercise}
            </Button>
          )}
        </div>
      </>
    </CollapsibleSection>
  );
}
