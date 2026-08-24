import { useTraining } from '../state/TrainingProvider';

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

  return (
    <div className="accessories-block">
      <h4>Övrigt / tillbehörsövningar</h4>

      {slots.map((slot, idx) => {
        const thisWeekLog = state.accessoryLogs[`acc_${slot.id}_w${week}`];
        const fallback = thisWeekLog || previousAccessoryLog(slot.id, week) || {};
        return (
          <div className="accessory-row" key={slot.id}>
            <input
              className="acc-name"
              placeholder="Övning"
              defaultValue={slot.name || ''}
              onBlur={(e) => renameAccessorySlot(dayIndex, idx, e.target.value)}
            />
            <input
              key={`sr_${slot.id}_w${week}`}
              className="acc-sets-reps"
              placeholder="t.ex. 3x10"
              defaultValue={fallback.setsReps || ''}
              onBlur={(e) => updateAccessoryLog(slot.id, week, slot.name, { setsReps: e.target.value })}
            />
            <input
              key={`w_${slot.id}_w${week}`}
              className="acc-weight"
              placeholder="vikt"
              defaultValue={fallback.weight || ''}
              onBlur={(e) => updateAccessoryLog(slot.id, week, slot.name, { weight: e.target.value })}
            />
            <button
              className="icon-btn acc-remove"
              title="Ta bort"
              onClick={() => removeAccessorySlot(dayIndex, idx)}
            >
              ✕
            </button>
          </div>
        );
      })}

      <button className="btn-secondary add-accessory-btn" onClick={() => addAccessorySlot(dayIndex)}>
        + Lägg till övning
      </button>

      {state.favoriteBackExercise && (
        <button
          className="btn-secondary"
          style={{ marginLeft: '0.5rem' }}
          onClick={() => addAccessorySlotWithName(dayIndex, state.favoriteBackExercise)}
        >
          + {state.favoriteBackExercise}
        </button>
      )}
    </div>
  );
}
