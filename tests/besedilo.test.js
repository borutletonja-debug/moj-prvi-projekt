import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plural, count, ZIVILO, VNOS, MERITEV } from '../js/logic/besedilo.js';

test('slovenska dvojina in množina', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 11, 101, 102, 103, 111].map((n) => plural(n, ZIVILO)),
    ['živil', 'živilo', 'živili', 'živila', 'živila', 'živil', 'živil', 'živilo', 'živili', 'živila', 'živil']);
  assert.equal(count(3, VNOS), '3 vnose');
  assert.equal(count(7, VNOS), '7 vnosov');
  assert.equal(count(2, MERITEV), '2 meritvi');
  assert.equal(count(1, MERITEV), '1 meritev');
});
