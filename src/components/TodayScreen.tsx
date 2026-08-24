import { useEffect } from 'react';
import { useTraining } from '../state/TrainingProvider';
import { blockWaveLabel, cycleLength, effectiveWeek } from '../domain/programEngine';
import { LiftCard } from './LiftCard';
import { AccessoriesBlock } from './AccessoriesBlock';
import { WarmupBlock } from './WarmupBlock';

export function TodayScreen() {
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

      <WarmupBlock dayIndex={dayIndex} week={state.currentWeek} />

      {days[dayIndex].map((liftKey) => (
        <LiftCard key={liftKey} liftKey={liftKey} />
      ))}

      <AccessoriesBlock dayIndex={dayIndex} week={state.currentWeek} />
    </>
  );
}
