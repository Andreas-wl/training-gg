import { useRef, useState } from 'react';
import { useTraining } from '../state/TrainingProvider';
import { computeWeight, intensityFor, percentRow, roundTo } from '../domain/programEngine';
import type { LiftKey } from '../domain/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { LogSetSheet } from './LogSetSheet';

const inputClass =
  'w-full rounded-xl border-0 bg-app px-3 py-2 text-[15px] text-ink placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-accent';

// Helskärms-detaljvy för en övning - kärnan i "en övning i taget" (PLAN.md
// #8.3). Visas ISTÄLLET FÖR dagöversikten (växlas via lokalt state i
// AppShell), inte som en egen navigationsflik.
export function ExerciseScreen({
  liftKey,
  onClose,
  onOpenLift,
}: {
  liftKey: LiftKey;
  onClose: () => void;
  onOpenLift: (liftKey: LiftKey) => void;
}) {
  const { state, program, updateLog, removeSet, autoregSuggestion, applyMax } = useTraining();
  const testSingleRef = useRef<HTMLInputElement>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const lift = program.lifts[liftKey];
  const week = state.currentWeek;
  const logKey = `${liftKey}_w${week}`;
  const log = state.logs[logKey];
  const sets = log?.sets ?? [];
  const max = state.maxes[liftKey];

  const pct = intensityFor(program, liftKey, week);
  const { reps: targetReps, rir } = percentRow(program, pct);
  const effectiveMax = log?.testSingle ? log.testSingle / state.settings.singleAt8Percent : max;
  const targetWeight = computeWeight(effectiveMax, pct, state.settings.rounding);

  const suggestion = autoregSuggestion(liftKey, week);

  const freq = state.settings.frequency;
  const days = program.dayTemplates[freq] ?? program.dayTemplates[4];
  const dayLifts = days[state.currentDayIndex] ?? [];
  const posInDay = dayLifts.indexOf(liftKey);
  const prevLift = posInDay > 0 ? dayLifts[posInDay - 1] : null;
  const nextLift = posInDay >= 0 && posInDay < dayLifts.length - 1 ? dayLifts[posInDay + 1] : null;

  // targetSets kommer bara från 'fixed'-lyft; faller snällt tillbaka om det
  // saknas (finns inga fixed-lyft i standardprogrammet, se PLAN.md).
  const targetSets = lift.setScheme === 'fixed' ? lift.targetSets : undefined;

  return (
    <>
      <div className="mb-4 flex items-center gap-3 pt-2">
        <button
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white text-ink shadow-sm"
          onClick={onClose}
        >
          ←
        </button>
        <div>
          <h2 className="text-[17px] font-semibold text-ink">{lift.name}</h2>
          <div className="text-xs text-dim">
            {lift.isMain ? 'Huvudlyft' : `Variant · ${program.lifts[lift.group]?.name ?? ''}`} · vecka {week}
          </div>
        </div>
      </div>

      <Card className="mb-4 p-4">
        <div className="mb-3 grid grid-cols-3 gap-2 rounded-xl bg-app p-3">
          <div className="text-center">
            <span className="block text-[11px] text-dim">Vikt</span>
            <span className="mt-0.5 block text-base font-semibold text-ink">
              {targetWeight != null ? `${targetWeight} ${state.settings.unit}` : 'Sätt max'}
            </span>
          </div>
          <div className="text-center">
            <span className="block text-[11px] text-dim">Reps</span>
            <span className="mt-0.5 block text-base font-semibold text-ink">{targetReps}</span>
          </div>
          <div className="text-center">
            <span className="block text-[11px] text-dim">RIR</span>
            <span className="mt-0.5 block text-base font-semibold text-ink">{rir}</span>
          </div>
        </div>
        <div className="text-xs text-dim">
          {lift.setScheme === 'fixed' && targetSets
            ? `Mål: ${targetSets} set × ${targetReps} reps`
            : `Mål: ${state.thresholds.lower}-${state.thresholds.upper} hårda set/vecka`}
        </div>
      </Card>

      <Card className="mb-4 p-4">
        <label className="mb-1 block text-xs text-dim">Testade du en singel @RPE8 idag? (valfritt)</label>
        <div className="flex flex-wrap gap-2">
          <input
            key={logKey}
            ref={testSingleRef}
            type="number"
            step={0.5}
            className={`${inputClass} w-24 flex-none`}
            placeholder="vikt"
            defaultValue={log?.testSingle ?? ''}
            onBlur={(e) => {
              const val = e.target.value === '' ? null : Number(e.target.value);
              updateLog(liftKey, week, { testSingle: val });
            }}
          />
          <Button
            variant="secondary"
            className="flex-1 text-xs"
            onClick={() => {
              const val = Number(testSingleRef.current?.value);
              if (!val) return;
              const newMax = roundTo(val / state.settings.singleAt8Percent, state.settings.rounding);
              if (newMax != null) applyMax(liftKey, newMax);
            }}
          >
            Använd som nytt max
          </Button>
        </div>
      </Card>

      <Card className="mb-4 p-4">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-dim">
          Set{lift.setScheme === 'fixed' && targetSets ? ` (mål: ${targetSets} set × ${targetReps} reps)` : ''}
        </h3>

        {sets.map((set, i) => (
          <div
            key={i}
            className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-app px-3 py-2 last:mb-0"
          >
            <span className="text-[15px] text-ink">
              Set {i + 1}: {set.weight} {state.settings.unit} × {set.reps ?? '–'} reps
              {set.adjusted && <span className="ml-2 text-xs text-danger">⚠ justerat</span>}
            </span>
            <button
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white text-dim shadow-sm"
              title="Ta bort set"
              onClick={() => removeSet(liftKey, week, i)}
            >
              ✕
            </button>
          </div>
        ))}

        {lift.setScheme === 'fixed' &&
          targetSets != null &&
          targetSets > sets.length &&
          Array.from({ length: targetSets - sets.length }).map((_, j) => (
            <div
              key={`placeholder_${j}`}
              className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-app/60 px-3 py-2 text-dim last:mb-0"
            >
              <span className="text-[15px]">
                Set {sets.length + j + 1}: {targetWeight != null ? `${targetWeight} ${state.settings.unit}` : '–'} × –
              </span>
            </div>
          ))}

        <Button variant="secondary" className="mt-2 w-full" onClick={() => setSheetOpen(true)}>
          + Logga set
        </Button>
      </Card>

      {suggestion && (
        <div
          className={`mb-4 flex items-center justify-between gap-2 rounded-2xl bg-white px-4 py-3 text-sm shadow-sm ${
            suggestion.direction === 'up' ? 'text-success' : 'text-danger'
          }`}
        >
          <span>
            {suggestion.direction === 'up' ? '📈' : '📉'} Förslag: {suggestion.pct > 0 ? '+' : ''}
            {Math.round(suggestion.pct * 100)}% → {suggestion.newMax} {state.settings.unit}
          </span>
          <button
            className="rounded-full bg-app px-3 py-1 text-xs font-semibold text-ink"
            onClick={() => applyMax(liftKey, suggestion.newMax)}
          >
            Använd
          </button>
        </div>
      )}

      <Card className="mb-4 p-4">
        <label className="mb-1 block text-xs text-dim">Anteckningar</label>
        <textarea
          key={logKey}
          className={`${inputClass} min-h-[2.6rem] resize-y`}
          placeholder="t.ex. känsla, teknik"
          defaultValue={log?.notes || ''}
          onBlur={(e) => updateLog(liftKey, week, { notes: e.target.value })}
        />
      </Card>

      <div className="mb-6 flex items-center justify-between gap-2">
        <Button variant="secondary" disabled={!prevLift} onClick={() => prevLift && onOpenLift(prevLift)}>
          ◀ Föregående övning
        </Button>
        <Button variant="secondary" disabled={!nextLift} onClick={() => nextLift && onOpenLift(nextLift)}>
          Nästa övning ▶
        </Button>
      </div>

      {sheetOpen && (
        <LogSetSheet
          liftKey={liftKey}
          week={week}
          setNumber={sets.length + 1}
          targetWeight={targetWeight ?? 0}
          targetReps={targetReps}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
  );
}
