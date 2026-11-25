import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyTotals, compareToGoal, summarizeWeek, buildWeeks } from '../js/logic/tedni.js';

const e = (date, kcal, protein = 0) => ({ date, kcal, protein, fat: 0, carbs: 0 });

test('dailyTotals sešteje po dnevih', () => {
  const t = dailyTotals([e('2026-11-23', 500, 30), e('2026-11-23', 700, 20), e('2026-11-24', 100, 5)]);
  assert.deepEqual(t.get('2026-11-23'), { kcal: 1200, protein: 50, fat: 0, carbs: 0, count: 2 });
  assert.equal(t.get('2026-11-24').count, 1);
});

test('compareToGoal: toleranca ±5 %', () => {
  assert.equal(compareToGoal(2000, 2000).status, 'met');
  assert.equal(compareToGoal(2100, 2000).status, 'met'); // točno +5 %
  assert.equal(compareToGoal(1900, 2000).status, 'met'); // točno −5 %
  assert.equal(compareToGoal(2101, 2000).status, 'over');
  assert.equal(compareToGoal(1899, 2000).status, 'under');
  assert.equal(compareToGoal(2200, 2000, 10).status, 'met');
  const c = compareToGoal(1800, 2000);
  assert.equal(c.diffKcal, -200);
  assert.equal(c.diffPct, -10);
  assert.equal(compareToGoal(1800, 0), null);
});

const day = (date, kcal, protein, extra = {}) => ({ date, kcal, protein, count: 1, incomplete: false, goalKcal: 2000, ...extra });

test('summarizeWeek: povprečje samo iz popolnih dni z vnosi', () => {
  const s = summarizeWeek([
    day('2026-11-16', 2000, 150),
    day('2026-11-17', 1800, 130),
    day('2026-11-18', 600, 20, { incomplete: true }), // nepopoln – ne šteje
    day('2026-11-19', 0, 0, { count: 0 }), // brez vnosov – ne šteje
  ], { today: '2026-11-25' });
  assert.equal(s.countedDays, 2);
  assert.equal(s.daysWithEntries, 3);
  assert.equal(s.incompleteDays, 1);
  assert.equal(s.avgKcal, 1900);
  assert.equal(s.avgProtein, 140);
  assert.equal(s.goal.diffKcal, -100);
  assert.equal(s.goal.status, 'met');
  assert.equal(s.balance, null);
});

test('summarizeWeek: današnji dan ne šteje, TDEE da deficit', () => {
  const s = summarizeWeek([day('2026-11-23', 2400, 100), day('2026-11-24', 2600, 100), day('2026-11-25', 300, 10)],
    { today: '2026-11-25', tdee: 2700 });
  assert.equal(s.countedDays, 2);
  assert.equal(s.avgKcal, 2500);
  assert.equal(s.goal.status, 'over');
  assert.equal(s.balance, -200);
});

test('summarizeWeek: brez upoštevanih dni', () => {
  const s = summarizeWeek([day('2026-11-25', 300, 10)], { today: '2026-11-25' });
  assert.equal(s.countedDays, 0);
  assert.equal(s.avgKcal, null);
  assert.equal(s.goal, null);
});

test('summarizeWeek: cilj se je med tednom spremenil – primerja s povprečnim ciljem', () => {
  const s = summarizeWeek([day('2026-11-16', 2000, 0, { goalKcal: 2000 }), day('2026-11-17', 2000, 0, { goalKcal: 1800 })], { today: '2026-11-25' });
  assert.equal(s.goalKcal, 1900);
  assert.equal(s.goal.diffKcal, 100);
});

test('buildWeeks: tedni pon–ned, najnovejši prvi, tekoči označen', () => {
  const weeks = buildWeeks({
    entries: [e('2026-11-15', 1000), e('2026-11-16', 2000, 100), e('2026-11-22', 2200, 120), e('2026-11-23', 1900), e('2026-11-25', 400)],
    dayFlags: [{ date: '2026-11-22', incomplete: true }],
    today: '2026-11-25',
    goalsForDate: () => ({ kcal: 2000 }),
  });
  assert.deepEqual(weeks.map((w) => [w.start, w.end, w.inProgress]), [
    ['2026-11-23', '2026-11-29', true],
    ['2026-11-16', '2026-11-22', false],
    ['2026-11-09', '2026-11-15', false],
  ]);
  assert.deepEqual(weeks[0].days.map((d) => d.date), ['2026-11-25', '2026-11-23']);
  assert.equal(weeks[0].days[0].isToday, true);
  assert.equal(weeks[0].summary.countedDays, 1);
  assert.equal(weeks[1].summary.countedDays, 1); // nedelja 22. je nepopolna
  assert.equal(weeks[1].summary.avgKcal, 2000);
  assert.equal(weeks[2].summary.avgKcal, 1000); // nedelja 15. spada v prejšnji teden
});
