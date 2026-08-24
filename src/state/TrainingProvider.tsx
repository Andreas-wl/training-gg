import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LocalStorageAdapter } from '../storage/LocalStorageAdapter';
import { TrainingRepository, makeId } from '../storage/TrainingRepository';
import type { AccessoryLog, LiftKey, LiftLog, Program, SetEntry, TrainingState, WarmupLog } from '../domain/types';
import { computeWeight, intensityFor, isHardSet, percentRow, roundTo } from '../domain/programEngine';
import { validateProgram } from '../domain/validateProgram';
import sbsDefaultJson from '../data/programs/sbs-default.json';

// Standardprogrammet är alltid tillgängligt. Programbibliotek (etapp 5,
// PLAN.md #10) lägger till möjligheten att importera/välja fler ovanpå det.
const BUILT_IN_PROGRAMS: Program[] = [sbsDefaultJson as unknown as Program];

const repository = new TrainingRepository(new LocalStorageAdapter(), BUILT_IN_PROGRAMS);

// `settings.frequency` är sparat oberoende av program (samma TrainingState
// delas mellan alla program). Ett program man byter till kan sakna
// dayTemplates för den frekvens som råkade vara vald tidigare - normalisera
// till en frekvens som faktiskt finns i det nya programmet, annars kraschar
// TodayScreen (dayTemplates[freq] blir undefined).
function resolveFrequency(program: Program, frequency: number): number {
  if (program.dayTemplates[frequency]) return frequency;
  const available = Object.keys(program.dayTemplates)
    .map(Number)
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b);
  return available[0] ?? frequency;
}

function downloadProgramJson(program: Program): void {
  const blob = new Blob([JSON.stringify(program, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${program.id}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

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
  programs: Program[];
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
  switchProgram: (id: string) => void;
  importProgram: (program: Program) => { ok: true } | { ok: false; error: string };
  exportProgram: (program: Program) => void;
}

const TrainingContext = createContext<TrainingContextValue | null>(null);

export function TrainingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TrainingState | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);

  useEffect(() => {
    (async () => {
      const list = await repository.listPrograms();
      setPrograms(list);
      const activeId = await repository.getActiveProgramId();
      const active = list.find((p) => p.id === activeId) ?? list[0];
      setProgram(active);
      const loaded = await repository.loadState(active);
      setState({
        ...loaded,
        settings: { ...loaded.settings, frequency: resolveFrequency(active, loaded.settings.frequency) },
      });
    })();
  }, []);

  // Sparar varje gång state ändras, precis som legacy/app.js saveState()
  // efter varje mutation. Hoppar över den allra första (null -> laddat state).
  useEffect(() => {
    if (state) repository.saveState(state);
  }, [state]);

  const value = useMemo<TrainingContextValue | null>(() => {
    if (!state || !program) return null;

    const mainKeys: LiftKey[] = Object.keys(program.lifts).filter((k) => program.lifts[k].isMain);
    const hasRequiredMaxes = mainKeys.every((k) => state.maxes[k]);

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

    // Programbyte kan lämna currentWeek/currentDayIndex pekande fel om det
    // nya programmets dagstruktur skiljer sig - se PLAN.md #10/#11. Vi
    // nollställer alltid båda och ber om bekräftelse innan bytet sker.
    const switchProgram: TrainingContextValue['switchProgram'] = (id) => {
      const target = programs.find((p) => p.id === id);
      if (!target || target.id === program.id) return;
      if (!window.confirm('Byta program nollställer aktuell vecka och dag till start. Fortsätt?')) return;

      repository
        .setActiveProgramId(id)
        .then(() => repository.loadState(target))
        .then((loaded) => {
          setProgram(target);
          setState({
            ...loaded,
            currentWeek: 1,
            currentDayIndex: 0,
            settings: { ...loaded.settings, frequency: resolveFrequency(target, loaded.settings.frequency) },
          });
        });
    };

    const importProgram: TrainingContextValue['importProgram'] = (candidate) => {
      const result = validateProgram(candidate);
      if (!result.ok) return result;

      repository
        .saveProgram(result.program)
        .then(() => repository.listPrograms())
        .then(setPrograms);
      return { ok: true };
    };

    const exportProgram: TrainingContextValue['exportProgram'] = (target) => {
      downloadProgramJson(target);
    };

    return {
      state,
      program,
      programs,
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
      switchProgram,
      importProgram,
      exportProgram,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, program, programs]);

  if (!value) return null;

  return <TrainingContext.Provider value={value}>{children}</TrainingContext.Provider>;
}

export function useTraining(): TrainingContextValue {
  const ctx = useContext(TrainingContext);
  if (!ctx) throw new Error('useTraining måste användas inuti TrainingProvider');
  return ctx;
}

export { logKeyFor, accessoryLogKey, warmupLogKey };
