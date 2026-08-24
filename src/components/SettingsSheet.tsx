import { useState } from 'react';
import { useTraining } from '../state/TrainingProvider';
import type { LiftKey } from '../domain/types';
import { Sheet } from '../ui/Sheet';
import { Card } from '../ui/Card';
import { SectionHeader } from '../ui/SectionHeader';
import { ListRow } from '../ui/ListRow';
import { Button } from '../ui/Button';

const FREQUENCIES = [2, 3, 4, 5, 6];

const fieldInputClass =
  'w-24 rounded-lg border-0 bg-app px-2 py-1.5 text-right text-[15px] text-ink focus:outline-none focus:ring-2 focus:ring-accent';

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { state, program, saveSettings, resetAll } = useTraining();

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
        rounding: rounding || program.defaultSettings.rounding,
        unit: unit || 'kg',
        singleAt8Percent: singleAt8Percent || program.defaultSettings.singleAt8Percent,
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

  const liftOrder = Object.keys(program.lifts);
  const mainKeys = liftOrder.filter((k) => program.lifts[k].isMain);
  const variantKeys = liftOrder.filter((k) => !program.lifts[k].isMain);

  return (
    <Sheet title="Inställningar" onClose={onClose}>
      <SectionHeader title="Grundinställningar" />
      <Card className="divide-y divide-app">
        <ListRow
          title="Pass per vecka"
          right={
            <select
              className={fieldInputClass}
              value={frequency}
              onChange={(e) => setFrequency(Number(e.target.value))}
            >
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          }
        />
        <ListRow
          title="Avrundning"
          right={
            <input
              type="number"
              step={0.5}
              className={fieldInputClass}
              value={rounding}
              onChange={(e) => setRounding(Number(e.target.value))}
            />
          }
        />
        <ListRow
          title="Enhet (etikett)"
          right={
            <input
              type="text"
              className={fieldInputClass}
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
          }
        />
        <ListRow
          title="Singel @RPE8 (% av 1RM)"
          right={
            <input
              type="number"
              step={0.01}
              className={fieldInputClass}
              value={singleAt8Percent}
              onChange={(e) => setSingleAt8Percent(Number(e.target.value))}
            />
          }
        />
      </Card>
      <p className="mb-1 mt-2 px-1 text-xs text-dim">
        En singel med 2 reps kvar (RPE8) antas motsvara denna andel av ditt sanna 1RM.
      </p>

      <SectionHeader title="Autoreglering (set/vecka)" />
      <Card className="divide-y divide-app">
        <ListRow
          title="Nedre tröskel"
          right={
            <input
              type="number"
              step={1}
              className={fieldInputClass}
              value={lower}
              onChange={(e) => setLower(Number(e.target.value))}
            />
          }
        />
        <ListRow
          title="Övre tröskel"
          right={
            <input
              type="number"
              step={1}
              className={fieldInputClass}
              value={upper}
              onChange={(e) => setUpper(Number(e.target.value))}
            />
          }
        />
        <ListRow
          title="Öka med (%)"
          right={
            <input
              type="number"
              step={1}
              className={fieldInputClass}
              value={increasePct}
              onChange={(e) => setIncreasePct(Number(e.target.value))}
            />
          }
        />
        <ListRow
          title="Minska med (%)"
          right={
            <input
              type="number"
              step={1}
              className={fieldInputClass}
              value={decreasePct}
              onChange={(e) => setDecreasePct(Number(e.target.value))}
            />
          }
        />
      </Card>
      <p className="mb-1 mt-2 px-1 text-xs text-dim">
        Under nedre tröskeln → sänk max. Vid/över övre tröskeln → höj max. Standard: 4-6 set, +2%/−5%.
      </p>

      <SectionHeader title="Max (huvudlyft)" />
      <Card className="divide-y divide-app">
        {mainKeys.map((k) => (
          <ListRow
            key={k}
            title={program.lifts[k].name}
            right={
              <input
                type="number"
                step={0.5}
                className={fieldInputClass}
                value={maxes[k] ?? ''}
                onChange={(e) => setMax(k, e.target.value)}
              />
            }
          />
        ))}
      </Card>

      <SectionHeader title="Max (varianter, valfritt)" />
      <p className="mb-1 px-1 text-xs text-dim">
        Känner du inte till ditt max? Gissa lågt till att börja med – du kan justera senare.
      </p>
      <Card className="divide-y divide-app">
        {variantKeys.map((k) => (
          <ListRow
            key={k}
            title={program.lifts[k].name}
            right={
              <input
                type="number"
                step={0.5}
                className={fieldInputClass}
                value={maxes[k] ?? ''}
                onChange={(e) => setMax(k, e.target.value)}
              />
            }
          />
        ))}
      </Card>

      <SectionHeader title="Favorit-ryggövning" />
      <Card className="mb-5">
        <ListRow
          title="Snabbval till tillbehör"
          right={
            <select
              className={fieldInputClass}
              value={favoriteBackExercise}
              onChange={(e) => setFavoriteBackExercise(e.target.value)}
            >
              <option value="">(ingen)</option>
              {(program.accessorySuggestions ?? []).map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          }
        />
      </Card>

      <Button className="w-full" onClick={handleSave}>
        Spara inställningar
      </Button>
      <Button variant="danger" className="mt-3 w-full" onClick={handleReset}>
        Återställ all data
      </Button>
    </Sheet>
  );
}
