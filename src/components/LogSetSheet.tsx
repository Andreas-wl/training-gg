import { useState } from 'react';
import { useTraining } from '../state/TrainingProvider';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import type { LiftKey } from '../domain/types';

const inputClass =
  'w-full rounded-xl border-0 bg-app px-3 py-2 text-[15px] text-ink placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-accent';

// Bottom-sheet för att logga ett enskilt set - se PLAN.md #8.4. Vikt och
// reps är två oberoende, explicita fält som alltid förifylls med det
// BERÄKNADE målet (aldrig föregående sets faktiska värden), så att en
// avvikelse i ett set aldrig "ärvs" tyst av nästa. `adjusted` sätts av
// `addSet` i TrainingProvider utifrån en ren talmässig jämförelse.
export function LogSetSheet({
  liftKey,
  week,
  setNumber,
  targetWeight,
  targetReps,
  bodyweight = false,
  onClose,
}: {
  liftKey: LiftKey;
  week: number;
  setNumber: number;
  targetWeight: number;
  targetReps: number;
  // Kroppsviktslyft: ingen vikt att justera, bara reps.
  bodyweight?: boolean;
  onClose: () => void;
}) {
  const { addSet, state } = useTraining();
  const [weightInput, setWeightInput] = useState(String(targetWeight));
  const [repsInput, setRepsInput] = useState(String(targetReps));

  const weight = weightInput.trim() === '' ? NaN : Number(weightInput);
  const reps = repsInput.trim() === '' ? null : Number(repsInput);
  const repsInvalid = reps != null && Number.isNaN(reps);
  const canSave = !Number.isNaN(weight) && !repsInvalid;

  const deviates = !Number.isNaN(weight) && (weight !== targetWeight || reps !== targetReps);

  return (
    <Sheet title={`Logga set ${setNumber}`} onClose={onClose}>
      {!bodyweight && (
        <div className="mb-3">
          <label className="mb-1 block text-xs text-dim">Vikt ({state.settings.unit})</label>
          <input
            type="number"
            step={0.5}
            className={inputClass}
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            autoFocus
          />
        </div>
      )}
      <div className="mb-3">
        <label className="mb-1 block text-xs text-dim">Reps</label>
        <input
          type="number"
          className={inputClass}
          value={repsInput}
          onChange={(e) => setRepsInput(e.target.value)}
        />
      </div>

      {deviates && (
        <div className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
          ⚠ Avviker från mål ({bodyweight ? 'kroppsvikt' : `${targetWeight} ${state.settings.unit}`} ×{' '}
          {targetReps})<div className="mt-0.5 text-xs opacity-80">→ sparas som justerat set</div>
        </div>
      )}

      <Button
        className="w-full"
        disabled={!canSave}
        onClick={() => {
          addSet(liftKey, week, weight, reps);
          onClose();
        }}
      >
        Spara set
      </Button>
    </Sheet>
  );
}
