import type { StorageAdapter } from './StorageAdapter';
import type {
  AccessorySlot,
  AccessoryLog,
  LiftLog,
  Program,
  TrainingState,
  WarmupItem,
  WarmupLog,
} from '../domain/types';
import { resolveFrequency } from '../domain/programEngine';

const STORAGE_KEY = 'sbsTrainerData_v1';
const CUSTOM_PROGRAMS_KEY = 'sbsCustomPrograms_v1';
const ACTIVE_PROGRAM_ID_KEY = 'sbsActiveProgramId_v1';

function defaultState(program: Program): TrainingState {
  const maxes: TrainingState['maxes'] = {};
  Object.keys(program.lifts).forEach((k) => {
    maxes[k] = null;
  });
  return {
    version: 1,
    settings: { ...program.defaultSettings },
    maxes,
    thresholds: { ...program.defaultThresholds },
    currentWeek: 1,
    currentDayIndex: 0,
    accessoryPlan: {},
    accessoryLogs: {},
    warmupPlan: {},
    warmupLogs: {},
    favoriteBackExercise: '',
    logs: {},
  };
}

// Seedar programmets passmall (mobility + explosivt före, tillägg efter) in i
// användarens egna planer. Bara dagar som saknar rader berörs, och bara en
// gång per program+frekvens (se TrainingState.seededPrepFor) - allt man sedan
// redigerar eller tar bort ska stanna borta.
//
// OBS: warmupPlan/accessoryPlan är nycklade på dagindex, INTE på frekvens,
// men dayPrep är (som dayTemplates) nycklad på frekvens och finns bara för de
// frekvenser programmet anger. Markören innehåller därför frekvensen: byter
// man frekvens ändras markören så seedningen får en ny chans för tomma dagar.
// Byter man PROGRAM nollställs planerna helt (se nedan).
//
// Frekvensen normaliseras först (ett sparat "4" från ett tidigare program
// finns inte i ett 5-dagarsprogram), annars seedas mallen för fel frekvens.
function seedDayPrep(loaded: TrainingState, program: Program): TrainingState {
  const freq = resolveFrequency(program, loaded.settings.frequency);
  const state = freq === loaded.settings.frequency ? loaded : { ...loaded, settings: { ...loaded.settings, frequency: freq } };
  const marker = `${program.id}:${freq}`;
  if (state.seededPrepFor === marker) return state;

  // Seedat för ett ANNAT program (eller aldrig seedat): förra programmets
  // pass-tillägg hör inte hemma här, så planerna börjar om från det nya
  // programmets mall och vecka/dag nollställs. Loggarna ligger kvar.
  const sameProgram = state.seededPrepFor?.split(':')[0] === program.id;
  const base: TrainingState = sameProgram
    ? state
    : { ...state, warmupPlan: {}, accessoryPlan: {}, currentWeek: 1, currentDayIndex: 0 };

  const template = program.dayPrep?.[freq];
  if (!template) return { ...base, seededPrepFor: marker };

  const warmupPlan = { ...base.warmupPlan };
  const accessoryPlan = { ...base.accessoryPlan };

  template.forEach((day, dayIndex) => {
    if (!warmupPlan[dayIndex]?.length) {
      const items: WarmupItem[] = [
        ...(day.mobility ?? []).map((i) => ({
          id: makeId(),
          name: i.name,
          kind: 'mobility' as const,
          setsReps: i.setsReps,
        })),
        ...(day.explosive ?? []).map((i) => ({
          id: makeId(),
          name: i.name,
          kind: 'explosive' as const,
          setsReps: i.setsReps,
        })),
      ];
      if (items.length) warmupPlan[dayIndex] = items;
    }
    if (!accessoryPlan[dayIndex]?.length && day.extras?.length) {
      accessoryPlan[dayIndex] = day.extras.map((i) => ({ id: makeId(), name: i.name, setsReps: i.setsReps }));
    }
  });

  return { ...base, warmupPlan, accessoryPlan, seededPrepFor: marker };
}

export function makeId(): string {
  return `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// Övningar man lagt till innan `accessoryPlan` fanns, sparade som
// {dayIndex: [{name,setsReps,weight}]} utan historik per vecka. Migreras in
// i den nya planen + en vecka-1-logg så inget tappas. Ren port av
// legacy/app.js migrateOldAccessories.
function migrateOldAccessories(parsed: Record<string, unknown>): {
  plan: Record<number, AccessorySlot[]>;
  logs: Record<string, AccessoryLog>;
} {
  if (parsed.accessoryPlan) {
    return {
      plan: parsed.accessoryPlan as Record<number, AccessorySlot[]>,
      logs: (parsed.accessoryLogs as Record<string, AccessoryLog>) || {},
    };
  }
  const plan: Record<number, AccessorySlot[]> = {};
  const logs: Record<string, AccessoryLog> = {};
  const oldAccessories =
    (parsed.accessories as Record<string, { name?: string; setsReps?: string; weight?: string }[]>) || {};
  Object.entries(oldAccessories).forEach(([dayIndex, rows]) => {
    plan[Number(dayIndex)] = rows.map((row) => {
      const id = makeId();
      if (row.setsReps || row.weight) {
        logs[`acc_${id}_w1`] = {
          name: row.name || '',
          setsReps: row.setsReps || '',
          weight: row.weight || '',
        };
      }
      return { id, name: row.name || '' };
    });
  });
  return { plan, logs };
}

// Gamla loggposter (etapp <4) hade ett gemensamt weightUsed/repsTarget för
// hela veckan istället för en sets-lista - se PLAN.md #5. Konverterar till
// ett syntetiskt set så historiken inte försvinner när schemat byts.
function migrateLogs(rawLogs: Record<string, unknown> | undefined): Record<string, LiftLog> {
  const migrated: Record<string, LiftLog> = {};
  Object.entries(rawLogs || {}).forEach(([key, value]) => {
    const old = value as {
      sets?: unknown;
      testSingle?: number | null;
      notes?: string;
      weightUsed?: number | null;
      repsTarget?: number;
    };
    if (Array.isArray(old.sets)) {
      // Redan nya formatet - lämna orört.
      migrated[key] = old as unknown as LiftLog;
      return;
    }
    migrated[key] = {
      testSingle: old.testSingle ?? null,
      notes: old.notes,
      sets:
        old.weightUsed != null || old.repsTarget != null
          ? [
              {
                index: 0,
                targetWeight: old.weightUsed ?? 0,
                targetReps: old.repsTarget ?? 0,
                weight: old.weightUsed ?? 0,
                reps: null,
                rir: null,
                adjusted: false,
              },
            ]
          : [],
    };
  });
  return migrated;
}

// TrainingRepository är den enda platsen som känner till lagringsnyckeln och
// hur äldre sparade format ska tolkas om - se PLAN.md #3.2.
export class TrainingRepository {
  constructor(
    private storage: StorageAdapter,
    private builtInPrograms: Program[],
  ) {}

  async loadState(program: Program): Promise<TrainingState> {
    const base = defaultState(program);
    try {
      const parsed = await this.storage.getItem<Record<string, unknown>>(STORAGE_KEY);
      if (!parsed) return seedDayPrep(base, program);

      const { plan, logs: accLogs } = migrateOldAccessories(parsed);
      return seedDayPrep(
        {
          ...base,
          ...parsed,
          settings: { ...base.settings, ...((parsed.settings as Partial<TrainingState['settings']>) || {}) },
          maxes: {
            ...base.maxes,
            ...((parsed.maxes as Partial<TrainingState['maxes']>) || {}),
          } as TrainingState['maxes'],
          thresholds: {
            ...base.thresholds,
            ...((parsed.thresholds as Partial<TrainingState['thresholds']>) || {}),
          },
          accessoryPlan: plan,
          accessoryLogs: accLogs,
          warmupPlan: (parsed.warmupPlan as Record<number, WarmupItem[]>) || {},
          warmupLogs: (parsed.warmupLogs as Record<string, WarmupLog>) || {},
          logs: migrateLogs(parsed.logs as Record<string, unknown> | undefined),
        },
        program,
      );
    } catch (e) {
      console.error('Kunde inte läsa sparad data, återställer till standard.', e);
      // Medvetet OSEEDAT: en trasig lagringspost får inte leda till att
      // markören sätts på ett state som just tappade allt - då hade
      // seedningen aldrig kunnat köra igen.
      return base;
    }
  }

  async saveState(state: TrainingState): Promise<void> {
    await this.storage.setItem(STORAGE_KEY, state);
  }

  async clearState(): Promise<void> {
    await this.storage.removeItem(STORAGE_KEY);
  }

  // Programbibliotek (PLAN.md #10, etapp 5): standardprogram + ev. importerade
  // custom-program. builtInPrograms är aldrig skrivna till storage - bara
  // custom-program sparas under en egen nyckel, se PLAN.md #3.2.
  async listPrograms(): Promise<Program[]> {
    const custom = (await this.storage.getItem<Program[]>(CUSTOM_PROGRAMS_KEY)) || [];
    return [...this.builtInPrograms, ...custom];
  }

  async saveProgram(program: Program): Promise<void> {
    const custom = (await this.storage.getItem<Program[]>(CUSTOM_PROGRAMS_KEY)) || [];
    const idx = custom.findIndex((p) => p.id === program.id);
    const next = idx >= 0 ? custom.map((p, i) => (i === idx ? program : p)) : [...custom, program];
    await this.storage.setItem(CUSTOM_PROGRAMS_KEY, next);
  }

  async getActiveProgramId(): Promise<string> {
    const id = await this.storage.getItem<string>(ACTIVE_PROGRAM_ID_KEY);
    return id || this.builtInPrograms[0]?.id || '';
  }

  async setActiveProgramId(id: string): Promise<void> {
    await this.storage.setItem(ACTIVE_PROGRAM_ID_KEY, id);
  }
}
