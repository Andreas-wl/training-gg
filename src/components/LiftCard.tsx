import { useRef } from 'react';
import { useTraining } from '../state/TrainingProvider';
import { computeWeight, intensityFor, percentRow, roundTo } from '../domain/programEngine';
import type { LiftKey } from '../domain/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

const inputClass =
  'w-full rounded-xl border-0 bg-app px-3 py-2 text-[15px] text-ink placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-accent';

export function LiftCard({ liftKey }: { liftKey: LiftKey }) {
  const { state, program, updateLog, autoregSuggestion, applyMax } = useTraining();
  const testSingleRef = useRef<HTMLInputElement>(null);

  const lift = program.lifts[liftKey];
  const week = state.currentWeek;
  const logKey = `${liftKey}_w${week}`;
  const log = state.logs[logKey] || {};
  const max = state.maxes[liftKey];

  const pct = intensityFor(program, liftKey, week);
  const { reps, rir } = percentRow(program, pct);
  const effectiveMax = log.testSingle ? log.testSingle / state.settings.singleAt8Percent : max;
  const weight = computeWeight(effectiveMax, pct, state.settings.rounding);

  const suggestion = autoregSuggestion(liftKey, week);

  return (
    <Card className="mb-4 p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-[17px] font-semibold text-ink">{lift.name}</h3>
        <span className="text-xs text-dim">
          {lift.isMain ? 'Huvudlyft' : `Variant · ${program.lifts[lift.group].name}`}
        </span>
      </div>

      <div className="mb-3">
        <label className="mb-1 block text-xs text-dim">Testade du en singel @RPE8 idag? (valfritt)</label>
        <div className="flex flex-wrap gap-2">
          <input
            key={logKey}
            ref={testSingleRef}
            type="number"
            step={0.5}
            className={`${inputClass} w-24 flex-none`}
            placeholder="vikt"
            defaultValue={log.testSingle ?? ''}
            onBlur={(e) => {
              const val = e.target.value === '' ? null : Number(e.target.value);
              updateLog(liftKey, week, { testSingle: val });
            }}
          />
          <Button
            variant="secondary"
            className="flex-1 text-xs"
            disabled={!log.testSingle}
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
      </div>

      <div className="mb-3 grid grid-cols-4 gap-2 rounded-xl bg-app p-3">
        <div className="text-center">
          <span className="block text-[11px] text-dim">Vikt</span>
          <span className="mt-0.5 block text-base font-semibold text-ink">
            {max ? `${weight} ${state.settings.unit}` : 'Sätt max'}
          </span>
        </div>
        <div className="text-center">
          <span className="block text-[11px] text-dim">Reps/set</span>
          <span className="mt-0.5 block text-base font-semibold text-ink">{reps}</span>
        </div>
        <div className="text-center">
          <span className="block text-[11px] text-dim">RIR-cutoff</span>
          <span className="mt-0.5 block text-base font-semibold text-ink">{rir}</span>
        </div>
        <div className="text-center">
          <span className="block text-[11px] text-dim">Målsätt/vecka</span>
          <span className="mt-0.5 block text-base font-semibold text-ink">
            {state.thresholds.lower}-{state.thresholds.upper} set
          </span>
        </div>
      </div>

      <div className="mb-3">
        <label className="mb-1 block text-xs text-dim">Set klara denna vecka</label>
        <input
          key={logKey}
          type="number"
          min={0}
          className={inputClass}
          placeholder="antal"
          defaultValue={log.setsCompleted ?? ''}
          onBlur={(e) => {
            const val = e.target.value === '' ? null : Number(e.target.value);
            updateLog(liftKey, week, { setsCompleted: val });
          }}
        />
      </div>

      {suggestion && (
        <div
          className={`mb-3 flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm ${
            suggestion.direction === 'up' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
          }`}
        >
          <span>
            {suggestion.direction === 'up' ? '📈' : '📉'} Förslag: {suggestion.pct > 0 ? '+' : ''}
            {Math.round(suggestion.pct * 100)}% → {suggestion.newMax} {state.settings.unit}
          </span>
          <button
            className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink shadow-sm"
            onClick={() => applyMax(liftKey, suggestion.newMax)}
          >
            Använd
          </button>
        </div>
      )}

      <textarea
        key={logKey}
        className={`${inputClass} min-h-[2.6rem] resize-y`}
        placeholder="Anteckningar (t.ex. känsla, teknik)"
        defaultValue={log.notes || ''}
        onBlur={(e) => updateLog(liftKey, week, { notes: e.target.value })}
      />
    </Card>
  );
}
