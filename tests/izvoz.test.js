import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBackup, validateBackup, toCSV, entriesCSV, foodsCSV } from '../js/logic/izvoz.js';

const sample = {
  foods: [{ id: 'f1', name: 'Riž', basis: '100g', kcal: 130, protein: 2.7, fat: 0.3, carbs: 28, pieceWeight: null, favorite: true }],
  entries: [{
    id: 'e1', date: '2026-11-25', foodId: 'f1', quantity: 150, unit: 'g', kcal: 195, protein: 4.05, fat: 0.45, carbs: 42,
    food: { name: 'Riž', basis: '100g', kcal: 130, protein: 2.7, fat: 0.3, carbs: 28, pieceWeight: null }, createdAt: 1,
  }],
  settings: [{ key: 'main', goals: { kcal: 2000 } }],
};

test('buildBackup + validateBackup (krožna pot prek JSON)', () => {
  const b = buildBackup(sample, new Date('2026-11-25T10:00:00Z'));
  assert.equal(b.exportedAt, '2026-11-25T10:00:00.000Z');
  assert.deepEqual(b.data.days, []);
  const r = validateBackup(JSON.parse(JSON.stringify(b)));
  assert.equal(r.ok, true);
  assert.deepEqual(r.counts, { foods: 1, entries: 1, days: 0, weights: 0, settings: 1 });
});

test('validateBackup zavrne napačne datoteke', () => {
  assert.equal(validateBackup(null).ok, false);
  assert.equal(validateBackup({ app: 'drugo' }).ok, false);
  assert.equal(validateBackup({ app: 'tilen-letonja', version: 99, data: {} }).ok, false);
  const bad = buildBackup({ ...sample, entries: [{ id: 'e', date: '2026-13-01', food: {}, kcal: 1 }] });
  assert.equal(validateBackup(bad).ok, false);
  const badW = buildBackup({ weights: [{ id: 'w', date: '2026-11-01', kg: 'x' }] });
  assert.equal(validateBackup(badW).ok, false);
});

test('toCSV: ločilo ;, narekovaji, BOM', () => {
  const csv = toCSV(['a', 'b'], [['x;y', 'rekel je "da"'], [1, null]]);
  assert.ok(csv.startsWith('﻿'));
  assert.equal(csv.slice(1), 'a;b\r\n"x;y";"rekel je ""da"""\r\n1;\r\n');
});

test('entriesCSV in foodsCSV z decimalno vejico', () => {
  const e = entriesCSV(sample.entries).slice(1).split('\r\n');
  assert.equal(e[1], '2026-11-25;Riž;150;g;195;4,1;0,5;42,0');
  const f = foodsCSV(sample.foods).slice(1).split('\r\n');
  assert.equal(f[1], 'Riž;na 100 g;130;2,7;0,3;28;;da');
});
