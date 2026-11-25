import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeSettings, validateGoals, macroMismatch, backupDue, DEFAULT_SETTINGS,
  withGoalChange, goalsForDate, validateTolerance,
} from '../js/logic/nastavitve.js';

test('mergeSettings dopolni manjkajoča polja', () => {
  const s = mergeSettings({ goals: { kcal: 1800 }, theme: 'light' });
  assert.equal(s.goals.kcal, 1800);
  assert.equal(s.goals.protein, DEFAULT_SETTINGS.goals.protein);
  assert.equal(s.theme, 'light');
  assert.equal(s.tolerancePct, 5);
  assert.equal(mergeSettings(undefined).theme, 'dark');
});

test('validateGoals', () => {
  const ok = validateGoals({ kcal: '2200', protein: '160,5', fat: '70', carbs: '0' });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.value, { kcal: 2200, protein: 160.5, fat: 70, carbs: 0 });
  const bad = validateGoals({ kcal: '0', protein: '-5', fat: '', carbs: '200' });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.kcal && bad.errors.protein && bad.errors.fat);
});

test('macroMismatch', () => {
  // 150*4 + 70*9 + 200*4 = 2030 -> razlika 1,5 %
  assert.equal(macroMismatch({ kcal: 2000, protein: 150, fat: 70, carbs: 200 }), null);
  const m = macroMismatch({ kcal: 2000, protein: 100, fat: 50, carbs: 100 }); // 1250
  assert.equal(m.macroKcal, 1250);
  assert.equal(m.diffPct, -37.5);
});

test('backupDue', () => {
  const s = { firstUse: '2026-11-01', lastBackup: null };
  assert.equal(backupDue(s, '2026-11-10', true), false);
  assert.equal(backupDue(s, '2026-11-15', true), true);
  assert.equal(backupDue(s, '2026-11-15', false), false);
  assert.equal(backupDue({ ...s, lastBackup: '2026-11-14' }, '2026-11-20', true), false);
  assert.equal(backupDue({ firstUse: null, lastBackup: null }, '2026-11-20', true), false);
});

test('zgodovina ciljev: pretekli dnevi obdržijo stare cilje', () => {
  let s = mergeSettings({ goals: { kcal: 2000, protein: 150, fat: 70, carbs: 200 } });
  assert.equal(goalsForDate(s, '2026-11-01').kcal, 2000);

  s = { ...s, ...withGoalChange(s, { ...s.goals, kcal: 1800 }, '2026-11-20') };
  assert.equal(s.goals.kcal, 1800);
  assert.equal(goalsForDate(s, '2026-11-19').kcal, 2000);
  assert.equal(goalsForDate(s, '2026-11-20').kcal, 1800);
  assert.equal(goalsForDate(s, '2026-12-24').kcal, 1800);

  // druga sprememba isti dan prepiše prvo
  s = { ...s, ...withGoalChange(s, { ...s.goals, kcal: 1700 }, '2026-11-20') };
  assert.equal(s.goalHistory.length, 2);
  assert.equal(goalsForDate(s, '2026-11-21').kcal, 1700);

  s = { ...s, ...withGoalChange(s, { ...s.goals, kcal: 2100 }, '2026-12-01') };
  assert.equal(goalsForDate(s, '2026-11-25').kcal, 1700);
  assert.equal(goalsForDate(s, '2026-12-01').kcal, 2100);
});

test('validateTolerance', () => {
  assert.equal(validateTolerance('5').value, 5);
  assert.equal(validateTolerance('7,5').value, 7.5);
  assert.ok(validateTolerance('-1').error);
  assert.ok(validateTolerance('80').error);
});
