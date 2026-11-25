import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emaTrend, trendAt, linearRegression, weightChangeRate, weeklyTable, validateWeight } from '../js/logic/teza.js';
import { addDays, weekStart } from '../js/logic/datumi.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('emaTrend: prva meritev je trend, nihanja se zgladijo', () => {
  const t = emaTrend([
    { date: '2026-11-03', kg: 81 }, { date: '2026-11-01', kg: 80 }, { date: '2026-11-02', kg: 82 },
  ]);
  assert.deepEqual(t.map((p) => p.date), ['2026-11-01', '2026-11-02', '2026-11-03']);
  assert.equal(t[0].trend, 80);
  const a = 1 - Math.exp(-1 / 7);
  close(t[1].trend, 80 + a * 2);
  assert.ok(t[1].trend < 80.5, 'skok za 2 kg premakne trend za manj kot 0,5 kg');
});

test('emaTrend: redke meritve imajo večjo težo (daljši razmik)', () => {
  const daily = emaTrend([{ date: '2026-11-01', kg: 80 }, { date: '2026-11-02', kg: 78 }]);
  const sparse = emaTrend([{ date: '2026-11-01', kg: 80 }, { date: '2026-11-15', kg: 78 }]);
  assert.ok(sparse[1].trend < daily[1].trend);
  close(sparse[1].trend, 80 - 2 * (1 - Math.exp(-2)));
  assert.deepEqual(emaTrend([]), []);
});

test('trendAt: interpolacija, pred prvo meritvijo null, po zadnji zadnja vrednost', () => {
  const t = [{ date: '2026-11-01', trend: 80 }, { date: '2026-11-11', trend: 79 }];
  assert.equal(trendAt(t, '2026-10-31'), null);
  assert.equal(trendAt(t, '2026-11-01'), 80);
  close(trendAt(t, '2026-11-06'), 79.5);
  assert.equal(trendAt(t, '2026-11-11'), 79);
  assert.equal(trendAt(t, '2026-12-01'), 79);
  assert.equal(trendAt([], '2026-12-01'), null);
});

test('linearRegression', () => {
  const r = linearRegression([{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 5 }]);
  close(r.slope, 2);
  close(r.intercept, 1);
  assert.equal(linearRegression([{ x: 0, y: 1 }]), null);
  assert.equal(linearRegression([{ x: 1, y: 1 }, { x: 1, y: 2 }]), null);
});

test('weightChangeRate: naklon iz meritev v zadnjih 28 dneh', () => {
  const end = '2026-11-28';
  // −0,5 kg na teden, meritev vsake 3 dni; ena stara meritev zunaj okna
  const weights = [{ date: '2026-09-01', kg: 95 }];
  for (let i = 0; i <= 27; i += 3) weights.push({ date: addDays('2026-11-01', i), kg: 80 - (0.5 / 7) * i });
  const r = weightChangeRate(weights, end);
  close(r.slopeKgPerDay, -0.5 / 7);
  assert.equal(r.measurements, 10);
  assert.equal(r.spanDays, 27);
  const one = weightChangeRate([{ date: '2026-11-20', kg: 80 }], end);
  assert.equal(one.slopeKgPerDay, null);
  assert.equal(one.spanDays, 0);
});

test('weeklyTable: trend ob koncu tedna in sprememba glede na prejšnji teden', () => {
  const weights = [{ date: '2026-11-10', kg: 80 }, { date: '2026-11-17', kg: 79 }, { date: '2026-11-24', kg: 78.5 }];
  const weeks = [{ start: '2026-11-16', summary: { avgKcal: 2100 } }];
  const rows = weeklyTable({ weights, weeks, today: '2026-11-25', weekStartOf: weekStart, balanceForWeek: (s) => (s === '2026-11-16' ? -300 : null) });
  assert.deepEqual(rows.map((r) => r.start), ['2026-11-23', '2026-11-16', '2026-11-09']);
  assert.equal(rows[0].inProgress, true);
  // konec tedna (15. 11.) je med meritvama 10. in 17. – trend je interpoliran
  assert.ok(rows[2].trend < 80 && rows[2].trend > rows[1].trend);
  assert.equal(rows[2].change, null); // pred prvim tednom ni trenda
  assert.ok(rows[1].change < 0);
  close(rows[1].change, rows[1].trend - rows[2].trend);
  assert.equal(rows[1].avgKcal, 2100);
  assert.equal(rows[1].balance, -300);
  assert.equal(rows[1].measurements, 1);
  assert.equal(rows[0].avgKcal, null);
});

test('validateWeight', () => {
  assert.equal(validateWeight('82,4').value, 82.4);
  assert.ok(validateWeight('5').error);
  assert.ok(validateWeight('').error);
});
