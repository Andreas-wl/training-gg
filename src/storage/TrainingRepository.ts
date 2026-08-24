import type { StorageAdapter } from './StorageAdapter';
import type { AccessorySlot, AccessoryLog, Program, TrainingState } from '../domain/types';

const STORAGE_KEY = 'sbsTrainerData_v1';

function defaultState(program: Program): TrainingState {
  const maxes: TrainingState['maxes'] = {};
  Object.keys(program.lifts).forEach((k) => { maxes[k] = null; });
  return {
    version: 1,
    settings: { ...program.defaultSettings },
    maxes,
    thresholds: { ...program.defaultThresholds },
    currentWeek: 1,
    currentDayIndex: 0,
    accessoryPlan: {},
    accessoryLogs: {},
    favoriteBackExercise: '',
    logs: {},
  };
}

export function makeId(): string {
  return `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// Övningar man lagt till innan `accessoryPlan` fanns, sparade som
// {dayIndex: [{name,setsReps,weight}]} utan historik per vecka. Migreras in
// i den nya planen + en vecka-1-logg så inget tappas. Ren port av
// legacy/app.js migrateOldAccessories.
function migrateOldAccessories(
  parsed: Record<string, unknown>,
): { plan: Record<number, AccessorySlot[]>; logs: Record<string, AccessoryLog> } {
  if (parsed.accessoryPlan) {
    return {
      plan: parsed.accessoryPlan as Record<number, AccessorySlot[]>,
      logs: (parsed.accessoryLogs as Record<string, AccessoryLog>) || {},
    };
  }
  const plan: Record<number, AccessorySlot[]> = {};
  const logs: Record<string, AccessoryLog> = {};
  const oldAccessories = (parsed.accessories as Record<string, { name?: string; setsReps?: string; weight?: string }[]>) || {};
  Object.entries(oldAccessories).forEach(([dayIndex, rows]) => {
    plan[Number(dayIndex)] = rows.map((row) => {
      const id = makeId();
      if (row.setsReps || row.weight) {
        logs[`acc_${id}_w1`] = { name: row.name || '', setsReps: row.setsReps || '', weight: row.weight || '' };
      }
      return { id, name: row.name || '' };
    });
  });
  return { plan, logs };
}

// TrainingRepository är den enda platsen som känner till lagringsnyckeln och
// hur äldre sparade format ska tolkas om - se PLAN.md #3.2.
export class TrainingRepository {
  constructor(private storage: StorageAdapter) {}

  async loadState(program: Program): Promise<TrainingState> {
    const base = defaultState(program);
    try {
      const parsed = await this.storage.getItem<Record<string, unknown>>(STORAGE_KEY);
      if (!parsed) return base;

      const { plan, logs: accLogs } = migrateOldAccessories(parsed);
      return {
        ...base,
        ...parsed,
        settings: { ...base.settings, ...((parsed.settings as Partial<TrainingState['settings']>) || {}) },
        maxes: { ...base.maxes, ...((parsed.maxes as Partial<TrainingState['maxes']>) || {}) } as TrainingState['maxes'],
        thresholds: { ...base.thresholds, ...((parsed.thresholds as Partial<TrainingState['thresholds']>) || {}) },
        accessoryPlan: plan,
        accessoryLogs: accLogs,
        logs: (parsed.logs as TrainingState['logs']) || {},
      };
    } catch (e) {
      console.error('Kunde inte läsa sparad data, återställer till standard.', e);
      return base;
    }
  }

  async saveState(state: TrainingState): Promise<void> {
    await this.storage.setItem(STORAGE_KEY, state);
  }

  async clearState(): Promise<void> {
    await this.storage.removeItem(STORAGE_KEY);
  }
}
