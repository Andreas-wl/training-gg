import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LocalStorageAdapter } from '../storage/LocalStorageAdapter';
import { TrainingRepository, makeId } from '../storage/TrainingRepository';
import type { AccessoryLog, LiftLog, TrainingState } from '../domain/types';
import { computeWeight, intensityFor, percentRow, roundTo, type LiftKey } from '../domain/rules';

const repository = new TrainingRepository(new LocalStorageAdapter());

export interface AutoregSuggestion {
  direction: 'up' | 'down';
  newMax: number;
  pct: number;
}

function logKeyFor(liftKey: LiftKey, week: number): string {
  return `${liftKey}_w${week}`;
}

function accessoryLogKey(id: string, week: number): string {
  return `acc_${id}_w${week}`;
}

interface TrainingContextValue {
  state: TrainingState;
  hasRequiredMaxes: boolean;
  setCurrentWeek: (week: number) => void;
  setCurrentDayIndex: (index: number) => void;
  updateLog: (liftKey: LiftKey, week: number, patch: Partial<LiftLog>) => void;
  autoregSuggestion: (liftKey: LiftKey, week: number) => AutoregSuggestion | null;
  applyMax: (liftKey: LiftKey, newMax: number) => void;
  saveSettings: (patch: {
    settings: TrainingState['settings'];
    thresholds: TrainingState['thresholds'];
    maxes: TrainingState['maxes'];
    favoriteBackExercise: string;
  }) => void;
  addAccessorySlot: (dayIndex: number) => void;
  addAccessorySlotWithName: (dayIndex: number, name: string) => void;
  removeAccessorySlot: (dayIndex: number, slotIndex: number) => void;
  renameAccessorySlot: (dayIndex: number, slotIndex: number, name: string) => void;
  updateAccessoryLog: (id: string, week: number, name: string, patch: Partial<AccessoryLog>) => void;
  previousAccessoryLog: (id: string, week: number) => AccessoryLog | null;
  resetAll: () => void;
}

const TrainingContext = createContext<TrainingContextValue | null>(null);

const MAIN_KEYS: LiftKey[] = ['squat', 'bench', 'deadlift', 'ohp'];

export function TrainingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TrainingState | null>(null);

  useEffect(() => {
    repository.loadState().then(setState);
  }, []);

  // Sparar varje gång state ändras, precis som legacy/app.js saveState()
  // efter varje mutation. Hoppar över den allra första (null -> laddat state).
  useEffect(() => {
    if (state) repository.saveState(state);
  }, [state]);

  const value = useMemo<TrainingContextValue | null>(() => {
    if (!state) return null;

    const hasRequiredMaxes = MAIN_KEYS.every((k) => state.maxes[k]);

    const updateLog: TrainingContextValue['updateLog'] = (liftKey, week, patch) => {
      setState((prev) => {
        if (!prev) return prev;
        const key = logKeyFor(liftKey, week);
        const existing = prev.logs[key] || {};
        const merged: LiftLog = { ...existing, ...patch };

        const max = prev.maxes[liftKey];
        const pct = intensityFor(liftKey, week);
        const { reps, rir } = percentRow(pct);
        const effectiveMax = merged.testSingle ? merged.testSingle / prev.settings.singleAt8Percent : max;
        merged.weightUsed = computeWeight(effectiveMax, pct, prev.settings.rounding);
        merged.repsTarget = reps;
        merged.rirCutoff = rir;
        merged.pct = pct;

        return { ...prev, logs: { ...prev.logs, [key]: merged } };
      });
    };

    const autoregSuggestion: TrainingContextValue['autoregSuggestion'] = (liftKey, week) => {
      const key = logKeyFor(liftKey, week);
      const log = state.logs[key];
      if (!log || log.setsCompleted == null || (log.setsCompleted as unknown) === '') return null;
      const sets = Number(log.setsCompleted);
      const { lower, upper, increasePct, decreasePct } = state.thresholds;
      const max = state.maxes[liftKey];
      if (!max) return null;

      if (sets < lower) {
        const newMax = roundTo(max * (1 + decreasePct), state.settings.rounding);
        if (newMax == null) return null;
        return { direction: 'down', newMax, pct: decreasePct };
      }
      if (sets >= upper) {
        const newMax = roundTo(max * (1 + increasePct), state.settings.rounding);
        if (newMax == null) return null;
        return { direction: 'up', newMax, pct: increasePct };
      }
      return null;
    };

    const applyMax: TrainingContextValue['applyMax'] = (liftKey, newMax) => {
      setState((prev) => (prev ? { ...prev, maxes: { ...prev.maxes, [liftKey]: newMax } } : prev));
    };

    const setCurrentWeek: TrainingContextValue['setCurrentWeek'] = (week) => {
      setState((prev) => (prev ? { ...prev, currentWeek: Math.max(1, week) } : prev));
    };

    const setCurrentDayIndex: TrainingContextValue['setCurrentDayIndex'] = (index) => {
      setState((prev) => (prev ? { ...prev, currentDayIndex: index } : prev));
    };

    const saveSettings: TrainingContextValue['saveSettings'] = (patch) => {
      setState((prev) =>
        prev
          ? {
              ...prev,
              settings: patch.settings,
              thresholds: patch.thresholds,
              maxes: patch.maxes,
              favoriteBackExercise: patch.favoriteBackExercise,
              currentDayIndex: 0,
            }
          : prev,
      );
    };

    const addAccessorySlotWithName: TrainingContextValue['addAccessorySlotWithName'] = (dayIndex, name) => {
      setState((prev) => {
        if (!prev) return prev;
        const slots = prev.accessoryPlan[dayIndex] || [];
        return {
          ...prev,
          accessoryPlan: { ...prev.accessoryPlan, [dayIndex]: [...slots, { id: makeId(), name }] },
        };
      });
    };

    const addAccessorySlot: TrainingContextValue['addAccessorySlot'] = (dayIndex) => {
      addAccessorySlotWithName(dayIndex, '');
    };

    const removeAccessorySlot: TrainingContextValue['removeAccessorySlot'] = (dayIndex, slotIndex) => {
      setState((prev) => {
        if (!prev) return prev;
        const slots = [...(prev.accessoryPlan[dayIndex] || [])];
        slots.splice(slotIndex, 1);
        return { ...prev, accessoryPlan: { ...prev.accessoryPlan, [dayIndex]: slots } };
      });
    };

    const renameAccessorySlot: TrainingContextValue['renameAccessorySlot'] = (dayIndex, slotIndex, name) => {
      setState((prev) => {
        if (!prev) return prev;
        const slots = [...(prev.accessoryPlan[dayIndex] || [])];
        if (!slots[slotIndex]) return prev;
        slots[slotIndex] = { ...slots[slotIndex], name };
        return { ...prev, accessoryPlan: { ...prev.accessoryPlan, [dayIndex]: slots } };
      });
    };

    const updateAccessoryLog: TrainingContextValue['updateAccessoryLog'] = (id, week, name, patch) => {
      setState((prev) => {
        if (!prev) return prev;
        const key = accessoryLogKey(id, week);
        const existing = prev.accessoryLogs[key] || { name };
        return {
          ...prev,
          accessoryLogs: { ...prev.accessoryLogs, [key]: { ...existing, ...patch, name } },
        };
      });
    };

    // Senaste loggade värdet för denna övning (tidigare vecka) - visas som
    // förslag så man inte behöver skriva om samma vikt/reps varje vecka.
    const previousAccessoryLog: TrainingContextValue['previousAccessoryLog'] = (id, week) => {
      for (let w = week - 1; w >= 1; w -= 1) {
        const log = state.accessoryLogs[accessoryLogKey(id, w)];
        if (log) return log;
      }
      return null;
    };

    const resetAll: TrainingContextValue['resetAll'] = () => {
      repository.clearState().then(() => repository.loadState()).then(setState);
    };

    return {
      state,
      hasRequiredMaxes,
      setCurrentWeek,
      setCurrentDayIndex,
      updateLog,
      autoregSuggestion,
      applyMax,
      saveSettings,
      addAccessorySlot,
      addAccessorySlotWithName,
      removeAccessorySlot,
      renameAccessorySlot,
      updateAccessoryLog,
      previousAccessoryLog,
      resetAll,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!value) return null;

  return <TrainingContext.Provider value={value}>{children}</TrainingContext.Provider>;
}

export function useTraining(): TrainingContextValue {
  const ctx = useContext(TrainingContext);
  if (!ctx) throw new Error('useTraining måste användas inuti TrainingProvider');
  return ctx;
}

export { logKeyFor, accessoryLogKey };
