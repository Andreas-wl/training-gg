import type { Program } from './types';

// Handrullad strukturkontroll av importerade program-JSON-filer - se
// PLAN.md #4/#10. Ingen zod-dependency; vi kastar aldrig, utan returnerar
// ett tydligt felmeddelande som UI:t kan visa direkt i en window.alert.
export type ValidateProgramResult = { ok: true; program: Program } | { ok: false; error: string };

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function validateProgram(data: unknown): ValidateProgramResult {
  if (!isObject(data)) {
    return { ok: false, error: 'Filen innehåller inte ett giltigt JSON-objekt.' };
  }

  if (!isNonEmptyString(data.id)) {
    return { ok: false, error: '"id" saknas eller är inte en icke-tom text.' };
  }
  if (!isNonEmptyString(data.name)) {
    return { ok: false, error: '"name" saknas eller är inte en icke-tom text.' };
  }

  if (!isObject(data.lifts)) {
    return { ok: false, error: '"lifts" saknas eller är inte ett objekt.' };
  }
  const lifts = data.lifts;
  const liftKeys = Object.keys(lifts);
  for (const key of liftKeys) {
    const lift = lifts[key];
    if (!isObject(lift)) {
      return { ok: false, error: `Lyftet "${key}" är inte ett giltigt objekt.` };
    }
    if (!isNonEmptyString(lift.name)) {
      return { ok: false, error: `Lyftet "${key}" saknar en giltig "name".` };
    }
    if (!isNonEmptyString(lift.group)) {
      return { ok: false, error: `Lyftet "${key}" saknar en giltig "group".` };
    }
    if (typeof lift.isMain !== 'boolean') {
      return { ok: false, error: `Lyftet "${key}" saknar ett giltigt "isMain" (boolean).` };
    }
    if (lift.setScheme !== 'autoregulated' && lift.setScheme !== 'fixed') {
      return {
        ok: false,
        error: `Lyftet "${key}" har ogiltigt "setScheme" - måste vara "autoregulated" eller "fixed".`,
      };
    }
    if (lift.setScheme === 'fixed' && (!isNumber(lift.targetSets) || lift.targetSets <= 0)) {
      return {
        ok: false,
        error: `Lyftet "${key}" har setScheme "fixed" men saknar ett giltigt positivt "targetSets".`,
      };
    }
  }

  if (!isObject(data.dayTemplates)) {
    return { ok: false, error: '"dayTemplates" saknas eller är inte ett objekt.' };
  }
  for (const [freq, days] of Object.entries(data.dayTemplates)) {
    if (!Array.isArray(days)) {
      return { ok: false, error: `"dayTemplates[${freq}]" måste vara en array av dagar.` };
    }
    for (let dayIdx = 0; dayIdx < days.length; dayIdx += 1) {
      const day = days[dayIdx];
      if (!Array.isArray(day)) {
        return { ok: false, error: `"dayTemplates[${freq}][${dayIdx}]" måste vara en array av lyftnycklar.` };
      }
      for (const liftKey of day) {
        if (typeof liftKey !== 'string') {
          return { ok: false, error: `"dayTemplates[${freq}][${dayIdx}]" innehåller ett icke-textvärde.` };
        }
        if (!liftKeys.includes(liftKey)) {
          return {
            ok: false,
            error: `Lyftnyckeln "${liftKey}" i dayTemplates[${freq}][${dayIdx}] finns inte i "lifts".`,
          };
        }
      }
    }
  }

  if (!Array.isArray(data.weekMainIntensity) || !data.weekMainIntensity.every(isNumber)) {
    return { ok: false, error: '"weekMainIntensity" måste vara en array av tal.' };
  }

  if (
    !Array.isArray(data.percentChart) ||
    !data.percentChart.every((row) => isObject(row) && isNumber(row.pct) && isNumber(row.reps) && isNumber(row.rir))
  ) {
    return { ok: false, error: '"percentChart" måste vara en array av { pct, reps, rir } med numeriska fält.' };
  }

  const thresholds = data.defaultThresholds;
  if (
    !isObject(thresholds) ||
    !isNumber(thresholds.lower) ||
    !isNumber(thresholds.upper) ||
    !isNumber(thresholds.increasePct) ||
    !isNumber(thresholds.decreasePct)
  ) {
    return {
      ok: false,
      error: '"defaultThresholds" måste vara ett objekt med numeriska lower, upper, increasePct, decreasePct.',
    };
  }

  const settings = data.defaultSettings;
  if (
    !isObject(settings) ||
    !isNumber(settings.frequency) ||
    !isNumber(settings.rounding) ||
    !isNumber(settings.singleAt8Percent) ||
    typeof settings.unit !== 'string'
  ) {
    return {
      ok: false,
      error:
        '"defaultSettings" måste vara ett objekt med frequency, rounding, singleAt8Percent (tal) och unit (text).',
    };
  }

  if (!isNumber(data.variationOffset)) {
    return { ok: false, error: '"variationOffset" måste vara ett tal.' };
  }

  return { ok: true, program: data as unknown as Program };
}
