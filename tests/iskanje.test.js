import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, filterFoods, recentFoods, lastEntryByFood, defaultQuantity } from '../js/logic/iskanje.js';

const foods = [
  { id: '1', name: 'Češnje', basis: '100g' },
  { id: '2', name: 'Piščančje prsi', basis: '100g' },
  { id: '3', name: 'Jajce', basis: '100g', pieceWeight: 60 },
  { id: '4', name: 'Grški jogurt', basis: '100g' },
  { id: '5', name: 'Banana', basis: 'kos', pieceWeight: 120 },
];
const names = (arr) => arr.map((f) => f.name);

test('normalize odstrani strešice', () => {
  assert.equal(normalize('  Čšž ČŠŽ '), 'csz csz');
});

test('filterFoods: brez poizvedbe abecedno (slovensko)', () => {
  assert.deepEqual(names(filterFoods(foods, '')), ['Banana', 'Češnje', 'Grški jogurt', 'Jajce', 'Piščančje prsi']);
});

test('filterFoods: brez strešic, več besed, začetek imena prvi', () => {
  assert.deepEqual(names(filterFoods(foods, 'cesn')), ['Češnje']);
  assert.deepEqual(names(filterFoods(foods, 'prsi pis')), ['Piščančje prsi']);
  assert.deepEqual(names(filterFoods(foods, 'j')), ['Jajce', 'Češnje', 'Grški jogurt', 'Piščančje prsi']);
  assert.deepEqual(filterFoods(foods, 'xyz'), []);
});

const entries = [
  { foodId: '3', quantity: 2, unit: 'kos', createdAt: 100 },
  { foodId: '2', quantity: 150, unit: 'g', createdAt: 200 },
  { foodId: '3', quantity: 3, unit: 'kos', createdAt: 300 },
  { foodId: 'izbrisano', quantity: 1, unit: 'g', createdAt: 400 },
  { foodId: null, quantity: 1, unit: 'g', createdAt: 500 },
];

test('lastEntryByFood in recentFoods', () => {
  assert.equal(lastEntryByFood(entries).get('3').quantity, 3);
  assert.deepEqual(names(recentFoods(entries, foods)), ['Jajce', 'Piščančje prsi']);
  assert.deepEqual(names(recentFoods(entries, foods, 1)), ['Jajce']);
});

test('defaultQuantity: zadnja količina ali 100 g / 1 kos', () => {
  const jajce = foods[2];
  assert.deepEqual(defaultQuantity(jajce, { quantity: 3, unit: 'kos' }), { quantity: 3, unit: 'kos' });
  assert.deepEqual(defaultQuantity(jajce, null), { quantity: 100, unit: 'g' });
  assert.deepEqual(defaultQuantity(foods[4], undefined), { quantity: 1, unit: 'kos' });
  // enota iz zadnjega vnosa ni več na voljo (teža kosa odstranjena)
  assert.deepEqual(defaultQuantity(foods[0], { quantity: 2, unit: 'kos' }), { quantity: 100, unit: 'g' });
});
