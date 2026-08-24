import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LocalStorageAdapter } from '../storage/LocalStorageAdapter';
import { TrainingRepository, makeId } from '../storage/TrainingRepository';
import type { AccessoryLog, LiftKey, LiftLog, Program, SetEntry, TrainingState, WarmupLog } from '../domain/types';
import { computeWeight, intensityFor, isHardSet, percentRow, roundTo } from '../domain/programEngine';
import sbsDefaultJson from '../data/programs/sbs-default.json';

// I etapp 2 finns bara standardprogrammet, hårdkodat här. Programbibliotek
// (import/export/välja mellan flera) kommer i etapp 5 - se PLAN.md #10.
const program = sbsDefaultJson as unknown as Program;

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

function warmupLogKey(id: string, week: number): string {
  return `warmup_${id}_w${week}`;
}

interface TrainingContextValue {
  state: TrainingState;
  program: Program;
  hasRequiredMaxes: boolean;
  setCurrentWeek: (week: number) => void;
  setCurrentDayIndex: (index: number) => void;
  updateLog: (liftKey: LiftKey, week: number, patch: Partial<Pick<LiftLog, 'testSingle' | 'notes'>>) => void;
  addSet: (liftKey: LiftKey, week: number, weight: number, reps: number | null) => void;
  removeSet: (liftKey: LiftKey, week: number, position: number) => void;
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
  addWarmupItem: (dayIndex: number) => void;
  removeWarmupItem: (dayIndex: number, itemIndex: number) => void;
  renameWarmupItem: (dayIndex: number, itemIndex: number, name: string) => void;
  updateWarmupLog: (id: string, week: number, name: string, patch: Partial<WarmupLog>) => void;
  previousWarmupLog: (id: string, week: number) => WarmupLog | null;
  resetAll: () => void;
}

const TrainingContext = createContext<TrainingContextValue | null>(null);

const MAIN_KEYS: LiftKey[] = Object.keys(program.lifts).filter((k) => program.lifts[k].isMain);

export function TrainingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TrainingState | null>(null);

  useEffect(() => {
    repository.loadState(program).then(setState);
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
        const existing = prev.logs[key];
        const merged: LiftLog = { ...existing, sets: existing?.sets ?? [], ...patch };
        return { ...prev, logs: { ...prev.logs, [key]: merged } };
      });
    };

    // Kärnan i buggfixen (PLAN.md #5): varje set får sitt eget snapshot av
    // mål (targetWeight/targetReps) beräknat HÄR, vid loggningstillfället -
    // inte ärvt från föregående set eller skrivet över på ett veckogemensamt
    // fält. `adjusted` sätts automatiskt utifrån just det här setets avvikelse.
    const addSet: TrainingContextValue['addSet'] = (liftKey, week, weight, reps) => {
      setState((prev) => {
        if (!prev) return prev;
        const key = logKeyFor(liftKey, week);
        const existing = prev.logs[key];
        const sets = existing?.sets ?? [];

        const max = prev.maxes[liftKey];
        const pct = intensityFor(program, liftKey, week);
        const { reps: targetReps } = percentRow(program, pct);
        const effectiveMax = existing?.testSingle ? existing.testSingle / prev.settings.singleAt8Percent : max;
        const targetWeight = computeWeight(effectiveMax, pct, prev.settings.rounding) ?? 0;

        const adjusted = weight !== targetWeight || reps !== targetReps;
        const newSet: SetEntry = {
          index: sets.length,
          targetWeight,
          targetReps,
          weight,
          reps,
          rir: null,
          adjusted,
          ...(adjusted ? { adjustedAt: new Date().toISOString() } : {}),
        };

        const merged: LiftLog = { ...existing, sets: [...sets, newSet] };
        return { ...prev, logs: { ...prev.logs, [key]: merged } };
      });
    };

    const removeSet: TrainingContextValue['removeSet'] = (liftKey, week, position) => {
      setState((prev) => {
        if (!prev) return prev;
        const key = logKeyFor(liftKey, week);
        const existing = prev.logs[key];
        if (!existing) return prev;
        const sets = [...(existing.sets ?? [])];
        sets.splice(position, 1);
        return { ...prev, logs: { ...prev.logs, [key]: { ...existing, sets } } };
      });
    };

    const autoregSuggestion: TrainingContextValue['autoregSuggestion'] = (liftKey, week) => {
      // Fasta scheman autoregleras inte i den här versionen - se PLAN.md #8.3.
      if (program.lifts[liftKey]?.setScheme === 'fixed') return null;

      const key = logKeyFor(liftKey, week);
      const sets = state.logs[key]?.sets ?? [];
      if (sets.length === 0) return null;

      const hardSets = sets.filter((s) => isHardSet(s.targetReps, s.reps)).length;
      const { lower, upper, increasePct, decreasePct } = state.thresholds;
      const max = state.maxes[liftKey];
      if (!max) return null;

      if (hardSets < lower) {
        const newMax = roundTo(max * (1 + decreasePct), state.settings.rounding);
        if (newMax == null) return null;
        return { direction: 'down', newMax, pct: decreasePct };
      }
      if (hardSets >= upper) {
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

    const addWarmupItem: TrainingContextValue['addWarmupItem'] = (dayIndex) => {
      setState((prev) => {
        if (!prev) return prev;
        const items = prev.warmupPlan[dayIndex] || [];
        return {
          ...prev,
          warmupPlan: { ...prev.warmupPlan, [dayIndex]: [...items, { id: makeId(), name: '' }] },
        };
      });
    };

    const removeWarmupItem: TrainingContextValue['removeWarmupItem'] = (dayIndex, itemIndex) => {
      setState((prev) => {
        if (!prev) return prev;
        const items = [...(prev.warmupPlan[dayIndex] || [])];
        items.splice(itemIndex, 1);
        return { ...prev, warmupPlan: { ...prev.warmupPlan, [dayIndex]: items } };
      });
    };

    const renameWarmupItem: TrainingContextValue['renameWarmupItem'] = (dayIndex, itemIndex, name) => {
      setState((prev) => {
        if (!prev) return prev;
        const items = [...(prev.warmupPlan[dayIndex] || [])];
        if (!items[itemIndex]) return prev;
        items[itemIndex] = { ...items[itemIndex], name };
        return { ...prev, warmupPlan: { ...prev.warmupPlan, [dayIndex]: items } };
      });
    };

    const updateWarmupLog: TrainingContextValue['updateWarmupLog'] = (id, week, _name, patch) => {
      setState((prev) => {
        if (!prev) return prev;
        const key = warmupLogKey(id, week);
        const existing = prev.warmupLogs[key] || {};
        return {
          ...prev,
          warmupLogs: { ...prev.warmupLogs, [key]: { ...existing, ...patch } },
        };
      });
    };

    // Senaste loggade värdet för denna uppvärmningsövning (tidigare vecka) -
    // samma "föreslå senaste veckans värde"-mönster som previousAccessoryLog.
    const previousWarmupLog: TrainingContextValue['previousWarmupLog'] = (id, week) => {
      for (let w = week - 1; w >= 1; w -= 1) {
        const log = state.warmupLogs[warmupLogKey(id, w)];
        if (log) return log;
      }
      return null;
    };

    const resetAll: TrainingContextValue['resetAll'] = () => {
      repository.clearState().then(() => repository.loadState(program)).then(setState);
    };

    return {
      state,
      program,
      hasRequiredMaxes,
      setCurrentWeek,
      setCurrentDayIndex,
      updateLog,
      addSet,
      removeSet,
      autoregSuggestion,
      applyMax,
      saveSettings,
      addAccessorySlot,
      addAccessorySlotWithName,
      removeAccessorySlot,
      renameAccessorySlot,
      updateAccessoryLog,
      previousAccessoryLog,
      addWarmupItem,
      removeWarmupItem,
      renameWarmupItem,
      updateWarmupLog,
      previousWarmupLog,
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

export { logKeyFor, accessoryLogKey, warmupLogKey };
