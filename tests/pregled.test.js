import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOverview } from '../js/logic/pregled.js';
import { mergeSettings } from '../js/logic/nastavitve.js';
import { addDays } from '../js/logic/datumi.js';

test('buildOverview poveže porabo, tedne, tabelo in priporočilo', () => {
  const today = '2026-11-29'; // nedelja
  const entries = [];
  const weights = [];
  for (let i = 35; i >= 1; i -= 1) {
    const date = addDays(today, -i);
    entries.push({ date, kcal: 2200, protein: 150, fat: 0, carbs: 0 });
    weights.push({ id: `w${i}`, date, kg: 82 - (0.5 / 7) * (35 - i) });
  }
  const settings = mergeSettings({
    profile: { sex: 'male', birthYear: 1996, heightCm: 180, activity: 'moderate' },
    weightGoal: { targetKg: 75, direction: 'lose', rateKgPerWeek: 0.5 },
  });
  const o = buildOverview({ entries, dayFlags: [], weights, settings, today });
  assert.equal(o.estimate.level, 'reliable');
  assert.ok(Math.abs(o.estimate.tdee - 2750) < 1);
  assert.equal(o.recommendation.recommended, 2200);
  assert.equal(o.rate, -0.5);
  // pretekli teden: vnos 2200 pri porabi 2750 -> deficit 550
  const last = o.weeks.find((w) => !w.inProgress);
  assert.ok(Math.abs(last.summary.balance + 550) < 1);
  const row = o.table.find((r) => r.start === last.start);
  assert.ok(Math.abs(row.balance + 550) < 1);
  assert.ok(Math.abs(row.change + 0.5) < 0.1);
  assert.equal(row.measurements, 7);
  assert.ok(Math.abs(o.recentRate.slopeKgPerDay * 7 + 0.5) < 1e-6);
});

test('buildOverview brez podatkov', () => {
  const o = buildOverview({ entries: [], dayFlags: [], weights: [], settings: mergeSettings({}), today: '2026-11-29' });
  assert.equal(o.estimate.level, 'none');
  assert.equal(o.recommendation, null);
  assert.deepEqual(o.weeks, []);
  assert.deepEqual(o.table, []);
});
