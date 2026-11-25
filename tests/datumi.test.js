import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toDateKey, todayKey, addDays, daysBetween, weekStart, isValidDateKey, formatDayLong, formatDateShort, formatDayShort, formatWeekRange,
} from '../js/logic/datumi.js';

test('lokalni datum, tudi tik po polnoči', () => {
  assert.equal(toDateKey(new Date(2026, 10, 25, 0, 30)), '2026-11-25');
  assert.equal(todayKey(new Date(2026, 0, 1, 23, 59)), '2026-01-01');
});

test('addDays čez mesec, leto in prestopno leto', () => {
  assert.equal(addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  // premik ure (konec marca) ne sme pokvariti štetja
  assert.equal(addDays('2026-03-28', 2), '2026-03-30');
});

test('daysBetween', () => {
  assert.equal(daysBetween('2026-11-01', '2026-11-25'), 24);
  assert.equal(daysBetween('2026-03-20', '2026-04-05'), 16);
  assert.equal(daysBetween('2026-11-25', '2026-11-20'), -5);
});

test('weekStart vrne ponedeljek', () => {
  assert.equal(weekStart('2026-11-25'), '2026-11-23'); // sreda
  assert.equal(weekStart('2026-11-23'), '2026-11-23'); // ponedeljek
  assert.equal(weekStart('2026-11-29'), '2026-11-23'); // nedelja
  assert.equal(weekStart('2026-11-30'), '2026-11-30');
});

test('isValidDateKey', () => {
  assert.ok(isValidDateKey('2026-02-28'));
  assert.ok(!isValidDateKey('2026-02-30'));
  assert.ok(!isValidDateKey('2026-2-3'));
  assert.ok(!isValidDateKey(null));
});

test('slovenski zapis datuma', () => {
  assert.equal(formatDayLong('2026-11-25'), 'sreda, 25. november');
  assert.equal(formatDateShort('2026-11-25'), '25. 11. 2026');
  assert.equal(formatDayShort('2026-11-25'), 'sre, 25. 11.');
  assert.equal(formatWeekRange('2026-11-23'), '23.–29. november 2026');
  assert.equal(formatWeekRange('2026-11-30'), '30. november – 6. december 2026');
  assert.equal(formatWeekRange('2026-12-28'), '28. december – 3. januar 2027');
});
