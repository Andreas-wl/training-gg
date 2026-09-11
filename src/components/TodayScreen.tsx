import { useEffect } from 'react';
import { useTraining } from '../state/TrainingProvider';
import {
  blockWaveLabel,
  cycleLength,
  effectiveWeek,
  intensityFor,
  targetRepsFor,
  targetWeightFor,
} from '../domain/programEngine';
import type { LiftKey } from '../domain/types';
import { AccessoriesBlock } from './AccessoriesBlock';
import { WarmupBlock } from './WarmupBlock';
import { Card } from '../ui/Card';
import { SectionHeader } from '../ui/SectionHeader';

// Dagöversikt (PLAN.md #8.2) - en lätt lista, inte fulla lyftkort. Klick på
// en rad öppnar övnings-detaljvyn (ExerciseScreen) via onOpenLift, som styrs
// från AppShell.
function LiftRow({ liftKey, week, onOpen }: { liftKey: LiftKey; week: number; onOpen: () => void }) {
  const { state, program } = useTraining();
  const lift = program.lifts[liftKey];
  const log = state.logs[`${liftKey}_w${week}`];

  const pct = intensityFor(program, liftKey, week);
  const reps = targetRepsFor(lift, program, pct);
  const max = state.maxes[liftKey];
  const effectiveMax = log?.testSingle ? log.testSingle / state.settings.singleAt8Percent : max;
  const weight = targetWeightFor(lift, effectiveMax, pct, state.settings.rounding);

  const setCount = log?.sets?.length ?? 0;
  const badge = lift.isMain ? 'Huvudlyft' : `Variant · ${program.lifts[lift.group]?.name ?? ''}`;
  const target = lift.bodyweight
    ? `Kroppsvikt × ${reps}`
    : weight != null
      ? `${weight} ${state.settings.unit} × ${reps}`
      : 'Sätt max';
  const status = setCount > 0 ? `${setCount} set loggade` : target;

  return (
    <Card className="mb-3 cursor-pointer p-4 active:bg-app" onClick={onOpen}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[17px] font-semibold text-ink">{lift.name}</span>
        {setCount > 0 && <span className="text-success">✓</span>}
      </div>
      <div className="mt-0.5 text-sm text-dim">
        {badge} · {status}
      </div>
    </Card>
  );
}

export function TodayScreen({ onOpenLift }: { onOpenLift: (liftKey: LiftKey) => void }) {
  const { state, program, setCurrentWeek, setCurrentDayIndex } = useTraining();
  const freq = state.settings.frequency;
  const days = program.dayTemplates[freq] ?? program.dayTemplates[4];
  const dayIndex = state.currentDayIndex >= days.length ? 0 : state.currentDayIndex;

  useEffect(() => {
    if (state.currentDayIndex >= days.length) setCurrentDayIndex(0);
  }, [state.currentDayIndex, days.length, setCurrentDayIndex]);

  const bw = blockWaveLabel(program, state.currentWeek);
  const effWeek = effectiveWeek(program, state.currentWeek);
  const cycle = Math.floor((state.currentWeek - 1) / cycleLength(program)) + 1;

  return (
    <>
      <div className="mb-4 flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm">
        <button
          className="flex h-8 w-8 items-center justify-center rounded-full bg-app text-lg text-ink"
          onClick={() => setCurrentWeek(state.currentWeek - 1)}
        >
          −
        </button>
        <div className="text-center">
          <div className="font-semibold text-ink">
            Vecka {effWeek} av {cycleLength(program)}
          </div>
          <div className="mt-0.5 text-xs text-dim">
            {bw.text}
            {cycle > 1 ? ` · Cykel ${cycle}` : ''}
          </div>
        </div>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-full bg-app text-lg text-ink"
          onClick={() => setCurrentWeek(state.currentWeek + 1)}
        >
          +
        </button>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {days.map((_, idx) => (
          <button
            key={idx}
            className={`flex-shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ${
              idx === dayIndex ? 'bg-accent text-white' : 'bg-white text-dim shadow-sm'
            }`}
            onClick={() => setCurrentDayIndex(idx)}
          >
            Dag {idx + 1}
          </button>
        ))}
      </div>

      {/* Passordningen är fast: mobility -> explosivt -> SBS -> tillägg. */}
      <WarmupBlock
        dayIndex={dayIndex}
        week={state.currentWeek}
        kind="mobility"
        title="1 · Mobility (5-7 min)"
        hint="Lägg till rörlighetsövningar du kör före passet."
      />
      <WarmupBlock
        dayIndex={dayIndex}
        week={state.currentWeek}
        kind="explosive"
        title="2 · Explosivt"
        hint="Hopp/kast före skivstången, medan du är fräsch."
      />

      <SectionHeader title="3 · SBS" />
      <div className="mb-4">
        {days[dayIndex].map((liftKey) => (
          <LiftRow
            key={liftKey}
            liftKey={liftKey}
            week={state.currentWeek}
            onOpen={() => onOpenLift(liftKey)}
          />
        ))}
      </div>

      <AccessoriesBlock dayIndex={dayIndex} week={state.currentWeek} />
    </>
  );
}
