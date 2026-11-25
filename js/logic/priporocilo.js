// Priporočen dnevni vnos in varnostna opozorila.
import { KCAL_PER_KG } from './tdee.js';

export const FLOOR_KCAL = Object.freeze({ male: 1500, female: 1200 });

/** Predznačen tempo v kg/teden: hujšanje je negativno. */
export function signedRate(weightGoal) {
  const rate = Math.abs(Number(weightGoal?.rateKgPerWeek) || 0);
  if (weightGoal?.direction === 'lose') return -rate;
  if (weightGoal?.direction === 'gain') return rate;
  return 0;
}

/**
 * Priporočen vnos = TDEE + (tempo v kg/teden × 7700 / 7).
 * Vrne { target, recommended, adjustment, floor, belowFloor, tooFast, maxSafeRate }.
 * `recommended` je zaokrožen na 10 kcal in nikoli pod varno mejo.
 */
export function recommend({ tdee, rateKgPerWeek, sex, weightKg }) {
  if (!Number.isFinite(tdee)) return null;
  const adjustment = (rateKgPerWeek * KCAL_PER_KG) / 7;
  const target = tdee + adjustment;
  const floor = sex === 'female' ? FLOOR_KCAL.female : FLOOR_KCAL.male;
  const belowFloor = target < floor;
  const maxSafeRate = weightKg > 0 ? weightKg * 0.01 : null;
  return {
    target,
    adjustment,
    floor,
    belowFloor,
    recommended: Math.round(Math.max(target, floor) / 10) * 10,
    // hujšanje hitreje od 1 % telesne teže na teden
    tooFast: rateKgPerWeek < 0 && maxSafeRate !== null && -rateKgPerWeek > maxSafeRate + 1e-9,
    maxSafeRate,
  };
}
