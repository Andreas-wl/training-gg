import { useState } from 'react';
import { useTraining } from '../state/TrainingProvider';
import { BACK_EXERCISES, DEFAULT_SETTINGS, LIFT_ORDER, LIFTS, type LiftKey } from '../domain/rules';

const FREQUENCIES = [2, 3, 4, 5, 6];

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { state, saveSettings, resetAll } = useTraining();

  const [frequency, setFrequency] = useState(state.settings.frequency);
  const [rounding, setRounding] = useState(state.settings.rounding);
  const [unit, setUnit] = useState(state.settings.unit);
  const [singleAt8Percent, setSingleAt8Percent] = useState(state.settings.singleAt8Percent);
  const [lower, setLower] = useState(state.thresholds.lower);
  const [upper, setUpper] = useState(state.thresholds.upper);
  const [increasePct, setIncreasePct] = useState(Math.round(state.thresholds.increasePct * 100));
  const [decreasePct, setDecreasePct] = useState(Math.round(state.thresholds.decreasePct * 100));
  const [maxes, setMaxes] = useState<Record<LiftKey, number | null>>({ ...state.maxes });
  const [favoriteBackExercise, setFavoriteBackExercise] = useState(state.favoriteBackExercise);

  const setMax = (k: LiftKey, value: string) => {
    setMaxes((m) => ({ ...m, [k]: value === '' ? null : Number(value) }));
  };

  const handleSave = () => {
    saveSettings({
      settings: {
        frequency,
        rounding: rounding || DEFAULT_SETTINGS.rounding,
        unit: unit || 'kg',
        singleAt8Percent: singleAt8Percent || DEFAULT_SETTINGS.singleAt8Percent,
      },
      thresholds: {
        lower,
        upper,
        increasePct: increasePct / 100,
        decreasePct: decreasePct / 100,
      },
      maxes,
      favoriteBackExercise,
    });
    onClose();
  };

  const handleReset = () => {
    if (window.confirm('Radera all sparad träningsdata? Detta kan inte ångras.')) {
      resetAll();
      onClose();
    }
  };

  const mainKeys = LIFT_ORDER.filter((k) => LIFTS[k].isMain);
  const variantKeys = LIFT_ORDER.filter((k) => !LIFTS[k].isMain);

  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet">
        <div className="sheet-header">
          <h2>Inställningar</h2>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="sheet-body">
          <h3>Grundinställningar</h3>
          <div className="field-row">
            <label>Pass per vecka</label>
            <select value={frequency} onChange={(e) => setFrequency(Number(e.target.value))}>
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div className="field-row">
            <label>Avrundning</label>
            <input
              type="number"
              step={0.5}
              value={rounding}
              onChange={(e) => setRounding(Number(e.target.value))}
            />
          </div>
          <div className="field-row">
            <label>Enhet (etikett)</label>
            <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </div>
          <div className="field-row">
            <label>Singel @RPE8 (% av 1RM)</label>
            <input
              type="number"
              step={0.01}
              value={singleAt8Percent}
              onChange={(e) => setSingleAt8Percent(Number(e.target.value))}
            />
          </div>
          <p className="hint">
            En singel med 2 reps kvar (RPE8) antas motsvara denna andel av ditt sanna 1RM.
          </p>

          <h3>Autoreglering (set/vecka)</h3>
          <div className="field-row">
            <label>Nedre tröskel</label>
            <input type="number" step={1} value={lower} onChange={(e) => setLower(Number(e.target.value))} />
          </div>
          <div className="field-row">
            <label>Övre tröskel</label>
            <input type="number" step={1} value={upper} onChange={(e) => setUpper(Number(e.target.value))} />
          </div>
          <div className="field-row">
            <label>Öka med (%)</label>
            <input
              type="number"
              step={1}
              value={increasePct}
              onChange={(e) => setIncreasePct(Number(e.target.value))}
            />
          </div>
          <div className="field-row">
            <label>Minska med (%)</label>
            <input
              type="number"
              step={1}
              value={decreasePct}
              onChange={(e) => setDecreasePct(Number(e.target.value))}
            />
          </div>
          <p className="hint">
            Under nedre tröskeln → sänk max. Vid/över övre tröskeln → höj max. Standard: 4-6 set, +2%/−5%.
          </p>

          <h3>Max (huvudlyft)</h3>
          {mainKeys.map((k) => (
            <div className="field-row" key={k}>
              <label>{LIFTS[k].name}</label>
              <input
                type="number"
                step={0.5}
                value={maxes[k] ?? ''}
                onChange={(e) => setMax(k, e.target.value)}
              />
            </div>
          ))}

          <h3>Max (varianter, valfritt)</h3>
          <p className="hint">
            Känner du inte till ditt max? Gissa lågt till att börja med – du kan justera senare.
          </p>
          {variantKeys.map((k) => (
            <div className="field-row" key={k}>
              <label>{LIFTS[k].name}</label>
              <input
                type="number"
                step={0.5}
                value={maxes[k] ?? ''}
                onChange={(e) => setMax(k, e.target.value)}
              />
            </div>
          ))}

          <h3>Favorit-ryggövning</h3>
          <div className="field-row">
            <label>Snabbval till tillbehör</label>
            <select value={favoriteBackExercise} onChange={(e) => setFavoriteBackExercise(e.target.value)}>
              <option value="">(ingen)</option>
              {BACK_EXERCISES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <button className="save-settings-btn" onClick={handleSave}>
            Spara inställningar
          </button>
          <button
            className="btn-secondary"
            style={{ width: '100%', marginTop: '0.6rem' }}
            onClick={handleReset}
          >
            Återställ all data
          </button>
        </div>
      </div>
    </div>
  );
}
