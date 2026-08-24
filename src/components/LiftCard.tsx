import { useRef } from 'react';
import { useTraining } from '../state/TrainingProvider';
import { LIFTS, computeWeight, intensityFor, percentRow, roundTo, type LiftKey } from '../domain/rules';

export function LiftCard({ liftKey }: { liftKey: LiftKey }) {
  const { state, updateLog, autoregSuggestion, applyMax } = useTraining();
  const testSingleRef = useRef<HTMLInputElement>(null);

  const lift = LIFTS[liftKey];
  const week = state.currentWeek;
  const logKey = `${liftKey}_w${week}`;
  const log = state.logs[logKey] || {};
  const max = state.maxes[liftKey];

  const pct = intensityFor(liftKey, week);
  const { reps, rir } = percentRow(pct);
  const effectiveMax = log.testSingle ? log.testSingle / state.settings.singleAt8Percent : max;
  const weight = computeWeight(effectiveMax, pct, state.settings.rounding);

  const suggestion = autoregSuggestion(liftKey, week);

  return (
    <section className="lift-card">
      <header className="lift-card-header">
        <h3 className="lift-name">{lift.name}</h3>
        <span className="lift-badge">
          {lift.isMain ? 'Huvudlyft' : `Variant · ${LIFTS[lift.group].name}`}
        </span>
      </header>

      <div className="lift-tm-row">
        <label>Testade du en singel @RPE8 idag? (valfritt)</label>
        <div className="tm-test-row">
          <input
            key={logKey}
            ref={testSingleRef}
            type="number"
            step={0.5}
            className="tm-test-input"
            placeholder="vikt"
            defaultValue={log.testSingle ?? ''}
            onBlur={(e) => {
              const val = e.target.value === '' ? null : Number(e.target.value);
              updateLog(liftKey, week, { testSingle: val });
            }}
          />
          <button
            className="btn-secondary use-as-max-btn"
            disabled={!log.testSingle}
            onClick={() => {
              const val = Number(testSingleRef.current?.value);
              if (!val) return;
              const newMax = roundTo(val / state.settings.singleAt8Percent, state.settings.rounding);
              if (newMax != null) applyMax(liftKey, newMax);
            }}
          >
            Använd som nytt max
          </button>
        </div>
      </div>

      <div className="lift-plan">
        <div className="plan-cell">
          <span className="plan-label">Vikt</span>
          <span className="plan-value weight-value">{max ? `${weight} ${state.settings.unit}` : 'Sätt max'}</span>
        </div>
        <div className="plan-cell">
          <span className="plan-label">Reps/set</span>
          <span className="plan-value reps-value">{reps}</span>
        </div>
        <div className="plan-cell">
          <span className="plan-label">RIR-cutoff</span>
          <span className="plan-value rir-value">{rir}</span>
        </div>
        <div className="plan-cell">
          <span className="plan-label">Målsätt/vecka</span>
          <span className="plan-value goal-value">
            {state.thresholds.lower}-{state.thresholds.upper} set
          </span>
        </div>
      </div>

      <div className="lift-log-row">
        <label>Set klara denna vecka</label>
        <input
          key={logKey}
          type="number"
          min={0}
          className="sets-completed-input"
          placeholder="antal"
          defaultValue={log.setsCompleted ?? ''}
          onBlur={(e) => {
            const val = e.target.value === '' ? null : Number(e.target.value);
            updateLog(liftKey, week, { setsCompleted: val });
          }}
        />
      </div>

      {suggestion && (
        <div className={`autoreg-banner ${suggestion.direction === 'up' ? 'up' : 'down'}`}>
          <span>
            {suggestion.direction === 'up' ? '📈' : '📉'} Förslag: {suggestion.pct > 0 ? '+' : ''}
            {Math.round(suggestion.pct * 100)}% → {suggestion.newMax} {state.settings.unit}
          </span>
          <button onClick={() => applyMax(liftKey, suggestion.newMax)}>Använd</button>
        </div>
      )}

      <textarea
        key={logKey}
        className="lift-notes"
        placeholder="Anteckningar (t.ex. känsla, teknik)"
        defaultValue={log.notes || ''}
        onBlur={(e) => updateLog(liftKey, week, { notes: e.target.value })}
      />
    </section>
  );
}
