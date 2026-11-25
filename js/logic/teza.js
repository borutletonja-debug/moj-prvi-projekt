// Teža: trend (eksponentno drseče povprečje), linearna regresija, tedenska tabela.
import { addDays, daysBetween } from './datumi.js';
import { validateNumber } from './stevila.js';

/** Časovna konstanta glajenja v dnevih (večja = bolj gladek trend). */
export const TREND_TAU_DAYS = 7;

export function sortWeights(weights) {
  return [...weights].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Trendna teža: eksponentno drseče povprečje, ki upošteva razmik med meritvami
 * (deluje tudi z redkimi meritvami). Vrne [{ date, kg, trend }], urejeno po datumu.
 */
export function emaTrend(weights, tau = TREND_TAU_DAYS) {
  const sorted = sortWeights(weights);
  const out = [];
  let trend = null;
  let prevDate = null;
  for (const w of sorted) {
    if (trend === null) trend = w.kg;
    else {
      const dt = Math.max(daysBetween(prevDate, w.date), 0);
      const alpha = dt === 0 ? 0.5 : 1 - Math.exp(-dt / tau);
      trend += alpha * (w.kg - trend);
    }
    prevDate = w.date;
    out.push({ date: w.date, kg: w.kg, trend });
  }
  return out;
}

/**
 * Trendna teža na izbrani dan (linearno med meritvami; po zadnji meritvi ostane zadnja vrednost).
 * Pred prvo meritvijo vrne null.
 */
export function trendAt(trendPoints, date) {
  if (!trendPoints.length || date < trendPoints[0].date) return null;
  let prev = trendPoints[0];
  for (const p of trendPoints) {
    if (p.date === date) return p.trend;
    if (p.date > date) {
      const total = daysBetween(prev.date, p.date);
      const part = daysBetween(prev.date, date);
      return total > 0 ? prev.trend + ((p.trend - prev.trend) * part) / total : p.trend;
    }
    prev = p;
  }
  return prev.trend;
}

/** Linearna regresija po metodi najmanjših kvadratov. points: [{ x, y }]. */
export function linearRegression(points) {
  const n = points.length;
  if (n < 2) return null;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (const p of points) {
    sxx += (p.x - mx) ** 2;
    sxy += (p.x - mx) * (p.y - my);
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx, n };
}

/**
 * Tempo spremembe teže iz meritev v oknu [end − windowDays + 1, end].
 * Vrne { slopeKgPerDay, measurements, spanDays } (slope je null, če ni dovolj meritev).
 */
export function weightChangeRate(weights, end, windowDays = 28) {
  const start = addDays(end, -(windowDays - 1));
  const inWindow = sortWeights(weights).filter((w) => w.date >= start && w.date <= end);
  const measurements = inWindow.length;
  const spanDays = measurements >= 2 ? daysBetween(inWindow[0].date, inWindow[measurements - 1].date) : 0;
  const reg = linearRegression(inWindow.map((w) => ({ x: daysBetween(start, w.date), y: w.kg })));
  return { slopeKgPerDay: reg ? reg.slope : null, measurements, spanDays };
}

/**
 * Tedenska tabela (najnovejši teden prvi).
 * weeks: rezultat buildWeeks (za povprečni vnos); balanceForWeek(start) -> kcal ali null.
 */
export function weeklyTable({ weights, weeks, today, weekStartOf, balanceForWeek }) {
  const trend = emaTrend(weights);
  const starts = new Set(weeks.map((w) => w.start));
  for (const w of weights) starts.add(weekStartOf(w.date));
  const byStart = new Map(weeks.map((w) => [w.start, w]));
  return [...starts].sort((a, b) => b.localeCompare(a)).map((start) => {
    const end = addDays(start, 6);
    const at = end > today ? today : end;
    const t = trendAt(trend, at);
    const prev = trendAt(trend, addDays(start, -1));
    return {
      start,
      end,
      inProgress: start === weekStartOf(today),
      trend: t,
      change: t !== null && prev !== null ? t - prev : null,
      measurements: weights.filter((w) => w.date >= start && w.date <= end).length,
      avgKcal: byStart.get(start)?.summary.avgKcal ?? null,
      balance: balanceForWeek ? balanceForWeek(start) : null,
    };
  });
}

/** Validacija meritve teže (kg). */
export function validateWeight(input) {
  return validateNumber(input, { min: 20, max: 400 });
}
