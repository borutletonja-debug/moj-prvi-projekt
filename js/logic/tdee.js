// Ocena dnevne porabe energije (TDEE).
import { addDays } from './datumi.js';
import { dailyTotals } from './tedni.js';
import { emaTrend, trendAt, weightChangeRate, sortWeights } from './teza.js';

export const KCAL_PER_KG = 7700;
export const WINDOW_DAYS = 28;

/** Najmanj podatkov za oceno iz meritev. */
export const MIN = Object.freeze({ spanDays: 14, completeDays: 10, measurements: 4 });
/** Podatki, pri katerih ocena velja za zanesljivo. */
export const FULL = Object.freeze({ spanDays: 21, completeDays: 20, measurements: 6 });

export const ACTIVITY = Object.freeze({
  sedentary: { factor: 1.2, label: 'Sedeče', hint: 'malo ali nič vadbe' },
  light: { factor: 1.375, label: 'Lahka', hint: 'vadba 1–3× na teden' },
  moderate: { factor: 1.55, label: 'Zmerna', hint: 'vadba 3–5× na teden' },
  high: { factor: 1.725, label: 'Visoka', hint: 'vadba 6–7× na teden' },
  extreme: { factor: 1.9, label: 'Zelo visoka', hint: 'fizično delo in vsakodnevna vadba' },
});

/** Bazalna presnova po Mifflin-St Jeor (kcal/dan). */
export function mifflinBmr({ sex, age, heightCm, weightKg }) {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'female' ? -161 : 5);
}

/** Začetna ocena porabe: Mifflin-St Jeor × faktor aktivnosti. Vrne null, če podatki manjkajo. */
export function initialTdee(profile, weightKg, year) {
  if (!profile || !(weightKg > 0)) return null;
  const { sex, birthYear, heightCm, activity } = profile;
  if ((sex !== 'male' && sex !== 'female') || !(birthYear > 0) || !(heightCm > 0) || !ACTIVITY[activity]) return null;
  return mifflinBmr({ sex, age: year - birthYear, heightCm, weightKg }) * ACTIVITY[activity].factor;
}

/** Pripravi podatke za več zaporednih ocen. */
export function makeContext({ entries, dayFlags = [], weights, profile }) {
  const sorted = sortWeights(weights);
  return {
    totals: dailyTotals(entries),
    incomplete: new Set(dayFlags.filter((d) => d.incomplete).map((d) => d.date)),
    weights: sorted,
    trend: emaTrend(sorted),
    profile,
  };
}

/**
 * Surova ocena iz podatkov v oknu, ki se konča na `end`:
 * TDEE = povprečni vnos − (sprememba teže v kg/dan × 7700).
 * Današnji dan (še nedokončan) se v povprečni vnos ne šteje.
 */
export function adaptiveEstimate(ctx, end, today) {
  const start = addDays(end, -(WINDOW_DAYS - 1));
  let sum = 0;
  let completeDays = 0;
  for (const [date, t] of ctx.totals) {
    if (date < start || date > end || date === today) continue;
    if (t.count === 0 || ctx.incomplete.has(date)) continue;
    sum += t.kcal;
    completeDays += 1;
  }
  const avgIntake = completeDays ? sum / completeDays : null;
  const { slopeKgPerDay, measurements, spanDays } = weightChangeRate(ctx.weights, end, WINDOW_DAYS);
  const sufficient = spanDays >= MIN.spanDays && completeDays >= MIN.completeDays
    && measurements >= MIN.measurements && slopeKgPerDay !== null;
  let raw = sufficient ? avgIntake - slopeKgPerDay * KCAL_PER_KG : null;
  // nesmiselne vrednosti (napaka pri vnosu teže ali hrane) zavrži
  const plausible = raw !== null && raw >= 800 && raw <= 6000;
  if (!plausible) raw = null;
  const score = Math.min(1, spanDays / FULL.spanDays, completeDays / FULL.completeDays, measurements / FULL.measurements);
  return {
    start, end, avgIntake, completeDays, measurements, spanDays, slopeKgPerDay,
    sufficient: sufficient && plausible, implausible: sufficient && !plausible, raw, score,
  };
}

/**
 * Končna ocena porabe na dan `end`.
 * - level 'none': ni ne podatkov ne osebnih podatkov
 * - level 'initial': začetna ocena po formuli
 * - level 'partial': mešanica formule in meritev
 * - level 'reliable': ocena iz meritev
 * Ocena iz meritev je zglajena čez zadnje tedne, da ne skače.
 */
export function estimateTdee(ctx, { end, today }) {
  const current = adaptiveEstimate(ctx, end, today);

  // glajenje: tedenske ocene (od najstarejše do zadnje), vsaka nova prispeva polovico
  let smoothed = null;
  for (let k = 8; k >= 0; k -= 1) {
    const est = k === 0 ? current : adaptiveEstimate(ctx, addDays(end, -7 * k), today);
    if (est.raw === null) continue;
    smoothed = smoothed === null ? est.raw : smoothed + 0.5 * (est.raw - smoothed);
  }
  const adaptive = current.sufficient ? smoothed : null;

  const weightKg = trendAt(ctx.trend, end) ?? ctx.weights[0]?.kg ?? null;
  const initial = initialTdee(ctx.profile, weightKg, Number(end.slice(0, 4)));

  let tdee = null;
  let level = 'none';
  let weight = 0;
  if (adaptive !== null) {
    weight = initial === null ? 1 : current.score;
    tdee = weight * adaptive + (1 - weight) * (initial ?? 0);
    level = current.score >= 1 ? 'reliable' : 'partial';
    if (initial === null) weight = 1;
  } else if (initial !== null) {
    tdee = initial;
    level = 'initial';
  }
  return { tdee, level, weight, adaptive, initial, weightKg, current };
}
