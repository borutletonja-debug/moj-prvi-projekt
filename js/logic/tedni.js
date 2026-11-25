// Dnevni seštevki in tedenski povzetki (ponedeljek–nedelja).
import { addDays, weekStart } from './datumi.js';

const KEYS = ['kcal', 'protein', 'fat', 'carbs'];

/** Seštevki po dnevih: Map(datum -> { kcal, protein, fat, carbs, count }). */
export function dailyTotals(entries) {
  const map = new Map();
  for (const e of entries) {
    let t = map.get(e.date);
    if (!t) { t = { kcal: 0, protein: 0, fat: 0, carbs: 0, count: 0 }; map.set(e.date, t); }
    for (const k of KEYS) t[k] += Number(e[k]) || 0;
    t.count += 1;
  }
  return map;
}

/**
 * Ali dan šteje v povprečja: ima vsaj en vnos, ni označen kot nepopoln
 * in ni današnji dan (ta še ni končan).
 */
export function isCounted(day, today) {
  return day.count > 0 && !day.incomplete && day.date !== today;
}

/**
 * Primerjava povprečja s ciljem.
 * Vrne { diffKcal, diffPct, status } – status: 'met' | 'over' | 'under'.
 */
export function compareToGoal(avgKcal, goalKcal, tolerancePct = 5) {
  if (!(goalKcal > 0) || !Number.isFinite(avgKcal)) return null;
  const diffKcal = avgKcal - goalKcal;
  const diffPct = (diffKcal / goalKcal) * 100;
  let status = 'met';
  if (Math.abs(diffPct) > tolerancePct + 1e-9) status = diffPct > 0 ? 'over' : 'under';
  return { diffKcal, diffPct, status };
}

/**
 * Povzetek tedna iz seznama dni.
 * days: [{ date, kcal, protein, count, incomplete, goalKcal }]
 * opts: { today, tolerancePct, tdee } – tdee (ocenjena poraba) je neobvezen.
 */
export function summarizeWeek(days, { today, tolerancePct = 5, tdee = null } = {}) {
  const counted = days.filter((d) => isCounted(d, today));
  const n = counted.length;
  const base = {
    daysWithEntries: days.filter((d) => d.count > 0).length,
    countedDays: n,
    incompleteDays: days.filter((d) => d.count > 0 && d.incomplete).length,
  };
  if (n === 0) {
    return { ...base, avgKcal: null, avgProtein: null, goalKcal: null, goal: null, balance: null };
  }
  const avg = (k) => counted.reduce((s, d) => s + d[k], 0) / n;
  const avgKcal = avg('kcal');
  const goalKcal = avg('goalKcal');
  return {
    ...base,
    avgKcal,
    avgProtein: avg('protein'),
    goalKcal,
    goal: compareToGoal(avgKcal, goalKcal, tolerancePct),
    // ocenjen dnevni deficit (-) ali presežek (+) glede na porabo
    balance: Number.isFinite(tdee) ? avgKcal - tdee : null,
  };
}

/**
 * Zgodovina po tednih, najnovejši teden prvi, dnevi v tednu najnovejši prvi.
 * opts: { entries, dayFlags: [{date, incomplete}], today, goalsForDate(date) -> {kcal}, tolerancePct, tdeeForWeek(start) }
 */
export function buildWeeks({ entries, dayFlags = [], today, goalsForDate, tolerancePct = 5, tdeeForWeek }) {
  const totals = dailyTotals(entries);
  const incomplete = new Set(dayFlags.filter((d) => d.incomplete).map((d) => d.date));
  const weeks = new Map();
  for (const [date, t] of totals) {
    const start = weekStart(date);
    if (!weeks.has(start)) weeks.set(start, []);
    weeks.get(start).push({
      date, ...t,
      incomplete: incomplete.has(date),
      isToday: date === today,
      goalKcal: goalsForDate(date).kcal,
    });
  }
  const currentStart = weekStart(today);
  return [...weeks.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([start, days]) => {
      days.sort((a, b) => b.date.localeCompare(a.date));
      return {
        start,
        end: addDays(start, 6),
        inProgress: start === currentStart,
        days,
        summary: summarizeWeek(days, { today, tolerancePct, tdee: tdeeForWeek ? tdeeForWeek(start) : null }),
      };
    });
}
