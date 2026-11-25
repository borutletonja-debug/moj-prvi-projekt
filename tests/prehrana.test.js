import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  availableUnits, calcNutrition, buildEntry, snapshotFood, sumEntries, progress,
  validateFood, validateQuantity, kcalFromMacros,
} from '../js/logic/prehrana.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

// vrednosti na 100 g, s težo kosa
const jajce = { name: 'Jajce', basis: '100g', kcal: 143, protein: 12.6, fat: 9.5, carbs: 0.7, pieceWeight: 60 };
// vrednosti na 100 g, brez teže kosa
const riz = { name: 'Riž', basis: '100g', kcal: 130, protein: 2.7, fat: 0.3, carbs: 28, pieceWeight: null };
// vrednosti na kos, s težo kosa
const banana = { name: 'Banana', basis: 'kos', kcal: 105, protein: 1.3, fat: 0.4, carbs: 27, pieceWeight: 120 };
// vrednosti na kos, brez teže
const ploscica = { name: 'Ploščica', basis: 'kos', kcal: 200, protein: 20, fat: 7, carbs: 15 };

test('availableUnits', () => {
  assert.deepEqual(availableUnits(jajce), ['g', 'kos']);
  assert.deepEqual(availableUnits(riz), ['g']);
  assert.deepEqual(availableUnits(banana), ['kos', 'g']);
  assert.deepEqual(availableUnits(ploscica), ['kos']);
  assert.deepEqual(availableUnits({ ...jajce, pieceWeight: 0 }), ['g']);
});

test('na 100 g, vnos v gramih', () => {
  const n = calcNutrition(riz, 150, 'g');
  close(n.kcal, 195);
  close(n.protein, 4.05);
  close(n.carbs, 42);
});

test('na 100 g, vnos v kosih (grami = kosi × teža kosa)', () => {
  const n = calcNutrition(jajce, 2, 'kos'); // 120 g
  close(n.kcal, 171.6);
  close(n.protein, 15.12);
});

test('na kos, vnos v kosih', () => {
  const n = calcNutrition(banana, 0.5, 'kos');
  close(n.kcal, 52.5);
  close(n.carbs, 13.5);
});

test('na kos, vnos v gramih (kosi = grami / teža kosa)', () => {
  const n = calcNutrition(banana, 180, 'g'); // 1,5 kosa
  close(n.kcal, 157.5);
  close(n.fat, 0.6);
});

test('nedovoljena enota ali količina vrne null', () => {
  assert.equal(calcNutrition(riz, 1, 'kos'), null);
  assert.equal(calcNutrition(ploscica, 50, 'g'), null);
  assert.equal(calcNutrition(riz, -5, 'g'), null);
  assert.equal(calcNutrition(riz, NaN, 'g'), null);
});

test('vnos shrani posnetek – sprememba knjižnice ne vpliva nanj', () => {
  const food = { ...riz, id: 'f1' };
  const e = buildEntry({ id: 'e1', date: '2026-11-25', foodId: 'f1', source: food, quantity: 200, unit: 'g', now: 1000 });
  close(e.kcal, 260);
  food.kcal = 999;
  food.name = 'Spremenjeno';
  assert.equal(e.food.kcal, 130);
  assert.equal(e.food.name, 'Riž');
  assert.equal(e.createdAt, 1000);

  // urejanje količine se preračuna iz posnetka, ne iz knjižnice
  const edited = buildEntry({ ...e, source: e.food, quantity: 100, now: 2000 });
  close(edited.kcal, 130);
  assert.equal(edited.createdAt, 1000);
  assert.equal(edited.updatedAt, 2000);
});

test('buildEntry z neveljavno enoto vrže napako', () => {
  assert.throws(() => buildEntry({ id: 'x', date: '2026-11-25', source: riz, quantity: 1, unit: 'kos' }));
});

test('snapshotFood ne vsebuje id ali priljubljenosti', () => {
  const s = snapshotFood({ ...jajce, id: 'a', favorite: true });
  assert.deepEqual(Object.keys(s).sort(), ['basis', 'carbs', 'fat', 'kcal', 'name', 'pieceWeight', 'protein']);
});

test('sumEntries in progress', () => {
  const t = sumEntries([
    { kcal: 100.4, protein: 10, fat: 1, carbs: 5 },
    { kcal: 200.4, protein: 5.55, fat: 2, carbs: 0 },
  ]);
  close(t.kcal, 300.8);
  close(t.protein, 15.55);
  assert.deepEqual(sumEntries([]), { kcal: 0, protein: 0, fat: 0, carbs: 0 });

  assert.deepEqual(progress(1500, 2000), { ratio: 0.75, remaining: 500, over: false });
  assert.deepEqual(progress(2100, 2000), { ratio: 1.05, remaining: -100, over: true });
  assert.equal(progress(2000, 2000).over, false);
  assert.equal(progress(100, 0).ratio, 0);
});

test('validateFood: obvezna polja in negativne vrednosti', () => {
  const r = validateFood({ name: '  ', basis: '', kcal: '', protein: '-1', fat: '0', carbs: 'x', pieceWeight: '' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.name);
  assert.ok(r.errors.basis);
  assert.ok(r.errors.kcal);
  assert.ok(r.errors.protein);
  assert.ok(!r.errors.fat);
  assert.ok(r.errors.carbs);
  assert.ok(!r.errors.pieceWeight);
});

test('validateFood: veljavno živilo z decimalno vejico', () => {
  const r = validateFood({ name: ' Jajce ', basis: '100g', kcal: '143', protein: '12,6', fat: '9.5', carbs: '0,7', pieceWeight: '60' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { name: 'Jajce', basis: '100g', kcal: 143, protein: 12.6, fat: 9.5, carbs: 0.7, pieceWeight: 60 });
});

test('validateFood: teža kosa mora biti > 0, če je podana', () => {
  const r = validateFood({ name: 'A', basis: 'kos', kcal: '1', protein: '1', fat: '1', carbs: '1', pieceWeight: '0' });
  assert.ok(r.errors.pieceWeight);
});

test('validateQuantity', () => {
  assert.equal(validateQuantity('0,5').value, 0.5);
  assert.ok(validateQuantity('0').error);
  assert.ok(validateQuantity('').error);
});

test('kcalFromMacros', () => {
  assert.equal(kcalFromMacros({ protein: 150, fat: 70, carbs: 200 }), 150 * 4 + 70 * 9 + 200 * 4);
});
