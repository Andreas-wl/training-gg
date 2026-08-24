import { useEffect } from 'react';
import { useTraining } from '../state/TrainingProvider';
import { CYCLE_LENGTH, DAY_TEMPLATES, blockWaveLabel, effectiveWeek } from '../domain/rules';
import { LiftCard } from './LiftCard';
import { AccessoriesBlock } from './AccessoriesBlock';

export function TodayScreen() {
  const { state, setCurrentWeek, setCurrentDayIndex } = useTraining();
  const freq = state.settings.frequency;
  const days = DAY_TEMPLATES[freq] ?? DAY_TEMPLATES[4];
  const dayIndex = state.currentDayIndex >= days.length ? 0 : state.currentDayIndex;

  useEffect(() => {
    if (state.currentDayIndex >= days.length) setCurrentDayIndex(0);
  }, [state.currentDayIndex, days.length, setCurrentDayIndex]);

  const bw = blockWaveLabel(state.currentWeek);
  const effWeek = effectiveWeek(state.currentWeek);
  const cycle = Math.floor((state.currentWeek - 1) / CYCLE_LENGTH) + 1;

  return (
    <>
      <div className="week-nav">
        <button onClick={() => setCurrentWeek(state.currentWeek - 1)}>−</button>
        <div>
          <span className="week-label">
            Vecka {effWeek} av {CYCLE_LENGTH}
          </span>
          <span className="block-label">
            {bw.text}
            {cycle > 1 ? ` · Cykel ${cycle}` : ''}
          </span>
        </div>
        <button onClick={() => setCurrentWeek(state.currentWeek + 1)}>+</button>
      </div>

      <div className="day-selector">
        {days.map((_, idx) => (
          <button
            key={idx}
            className={idx === dayIndex ? 'active' : ''}
            onClick={() => setCurrentDayIndex(idx)}
          >
            Dag {idx + 1}
          </button>
        ))}
      </div>

      {days[dayIndex].map((liftKey) => (
        <LiftCard key={liftKey} liftKey={liftKey} />
      ))}

      <AccessoriesBlock dayIndex={dayIndex} week={state.currentWeek} />
    </>
  );
}
