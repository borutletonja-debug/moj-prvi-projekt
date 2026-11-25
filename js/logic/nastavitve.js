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
  goalHistory: [], // [{ from: 'YYYY-MM-DD', goals }] – kateri cilji so veljali od katerega dne
  // osebni podatki za začetno oceno porabe
  profile: { sex: null, birthYear: null, heightCm: null, activity: null },
  // direction: 'lose' | 'maintain' | 'gain'; tempo je vedno pozitiven (kg/teden)
  weightGoal: { targetKg: null, direction: 'maintain', rateKgPerWeek: 0.5 },
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
    profile: { ...DEFAULT_SETTINGS.profile, ...(s.profile || {}) },
    weightGoal: { ...DEFAULT_SETTINGS.weightGoal, ...(s.weightGoal || {}) },
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

/** Validacija tolerance za »cilj dosežen« (v %). */
export function validateTolerance(input) {
  return validateNumber(input, { min: 0, max: 50 });
}

const BEGINNING = '0000-00-00';

/**
 * Sprememba ciljev: vrne popravek nastavitev { goals, goalHistory }.
 * Stari cilji ostanejo veljavni za pretekle dni, novi veljajo od `today` naprej.
 */
export function withGoalChange(settings, newGoals, today) {
  const history = (settings.goalHistory?.length
    ? settings.goalHistory
    : [{ from: BEGINNING, goals: { ...settings.goals } }]
  ).filter((h) => h.from !== today);
  history.push({ from: today, goals: { ...newGoals } });
  history.sort((a, b) => a.from.localeCompare(b.from));
  return { goals: { ...newGoals }, goalHistory: history };
}

/** Cilji, ki so veljali na izbrani dan. */
export function goalsForDate(settings, date) {
  const history = settings.goalHistory || [];
  let found = null;
  for (const h of history) if (h.from <= date) found = h;
  return found ? found.goals : (history[0]?.goals ?? settings.goals);
}

export const ACTIVITY_KEYS = ['sedentary', 'light', 'moderate', 'high', 'extreme'];

/** Validacija osebnih podatkov (vsa polja so neobvezna). */
export function validateProfile(input, currentYear) {
  const errors = {};
  const value = {};
  value.sex = input.sex === 'male' || input.sex === 'female' ? input.sex : null;
  const by = validateNumber(input.birthYear, { required: false, min: currentYear - 100, max: currentYear - 10 });
  if (by.error) errors.birthYear = `Vpiši letnico med ${currentYear - 100} in ${currentYear - 10}.`;
  else if (by.value !== null && !Number.isInteger(by.value)) errors.birthYear = 'Vpiši celo letnico (npr. 2004).';
  value.birthYear = by.value;
  const hgt = validateNumber(input.heightCm, { required: false, min: 100, max: 250 });
  if (hgt.error) errors.heightCm = 'Vpiši višino v centimetrih (100–250).';
  value.heightCm = hgt.value;
  value.activity = ACTIVITY_KEYS.includes(input.activity) ? input.activity : null;
  return { ok: Object.keys(errors).length === 0, errors, value };
}

/** Validacija cilja teže. Tempo je pozitiven; smer določa predznak. */
export function validateWeightGoal(input) {
  const errors = {};
  const value = {};
  const t = validateNumber(input.targetKg, { required: false, min: 20, max: 400 });
  if (t.error) errors.targetKg = 'Vpiši težo v kilogramih (20–400).';
  value.targetKg = t.value;
  value.direction = ['lose', 'maintain', 'gain'].includes(input.direction) ? input.direction : 'maintain';
  if (value.direction === 'maintain') {
    const r = validateNumber(input.rateKgPerWeek, { required: false, min: 0, max: 2 });
    value.rateKgPerWeek = r.error || r.value === null ? 0.5 : r.value;
  } else {
    const r = validateNumber(input.rateKgPerWeek, { min: 0, minExclusive: true, max: 2 });
    if (r.error) errors.rateKgPerWeek = 'Vpiši tempo med 0 in 2 kg na teden (npr. 0,5).';
    value.rateKgPerWeek = r.value;
  }
  return { ok: Object.keys(errors).length === 0, errors, value };
}
