// Privzete nastavitve in validacija ciljev.
import { validateNumber } from './stevila.js';
import { kcalFromMacros } from './prehrana.js';
import { daysBetween } from './datumi.js';

export const SETTINGS_KEY = 'main';

export const DEFAULT_SETTINGS = Object.freeze({
  key: SETTINGS_KEY,
  goals: { kcal: 2000, protein: 150, fat: 70, carbs: 200 },
  theme: 'dark', // 'dark' | 'light' | 'system'
  tolerancePct: 5,
  firstUse: null, // 'YYYY-MM-DD'
  lastBackup: null, // 'YYYY-MM-DD'
});

/** Združi shranjene nastavitve s privzetimi (za manjkajoča polja iz starejših različic). */
export function mergeSettings(stored) {
  const s = stored || {};
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    key: SETTINGS_KEY,
    goals: { ...DEFAULT_SETTINGS.goals, ...(s.goals || {}) },
  };
}

/** Validacija dnevnih ciljev iz obrazca. */
export function validateGoals(input) {
  const errors = {};
  const value = {};
  const kcal = validateNumber(input.kcal, { min: 0, minExclusive: true, max: 10000 });
  if (kcal.error) errors.kcal = kcal.error;
  value.kcal = kcal.value;
  for (const k of ['protein', 'fat', 'carbs']) {
    const r = validateNumber(input[k], { min: 0, max: 1000 });
    if (r.error) errors[k] = r.error;
    value[k] = r.value;
  }
  return { ok: Object.keys(errors).length === 0, errors, value };
}

/**
 * Opozorilo, če se kcal iz makrohranil (4/9/4) razlikujejo od kaloričnega cilja za več kot 10 %.
 * Vrne null ali { macroKcal, diffPct }.
 */
export function macroMismatch(goals, thresholdPct = 10) {
  if (!(goals.kcal > 0)) return null;
  const macroKcal = kcalFromMacros(goals);
  const diffPct = ((macroKcal - goals.kcal) / goals.kcal) * 100;
  return Math.abs(diffPct) > thresholdPct ? { macroKcal, diffPct } : null;
}

/**
 * Ali naj opomnim na varnostno kopijo?
 * Da, če obstajajo podatki in je od zadnje kopije (ali prve uporabe) minilo ≥ `days` dni.
 */
export function backupDue(settings, today, hasData, days = 14) {
  if (!hasData) return false;
  const ref = settings.lastBackup || settings.firstUse;
  if (!ref) return false;
  return daysBetween(ref, today) >= days;
}
