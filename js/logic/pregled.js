// Skupni pregled: ocena porabe, tedni z bilanco, tedenska tabela teže in priporočilo.
import { addDays, weekStart } from './datumi.js';
import { buildWeeks } from './tedni.js';
import { goalsForDate } from './nastavitve.js';
import { makeContext, estimateTdee } from './tdee.js';
import { weeklyTable, weightChangeRate } from './teza.js';
import { recommend, signedRate } from './priporocilo.js';

export function buildOverview({ entries, dayFlags, weights, settings, today }) {
  const ctx = makeContext({ entries, dayFlags, weights, profile: settings.profile });
  const estimate = estimateTdee(ctx, { end: today, today });

  // Bilanca preteklega tedna se računa z oceno porabe, ki je veljala ob koncu tistega tedna.
  const cache = new Map();
  const tdeeForWeek = (start) => {
    if (!cache.has(start)) {
      const end = addDays(start, 6);
      cache.set(start, end >= today ? estimate.tdee : estimateTdee(ctx, { end, today }).tdee);
    }
    return cache.get(start);
  };

  const weeks = buildWeeks({
    entries, dayFlags, today,
    goalsForDate: (d) => goalsForDate(settings, d),
    tolerancePct: settings.tolerancePct,
    tdeeForWeek,
  });
  const balances = new Map(weeks.map((w) => [w.start, w.summary.balance]));
  const table = weeklyTable({
    weights, weeks, today, weekStartOf: weekStart,
    balanceForWeek: (s) => balances.get(s) ?? null,
  });

  const rate = signedRate(settings.weightGoal);
  const recommendation = recommend({
    tdee: estimate.tdee, rateKgPerWeek: rate, sex: settings.profile?.sex, weightKg: estimate.weightKg,
  });

  return {
    ctx, estimate, weeks, table, recommendation, rate, tdeeForWeek,
    recentRate: weightChangeRate(ctx.weights, today),
  };
}
