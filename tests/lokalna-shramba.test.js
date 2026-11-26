import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLocalStore, storageWorks } from '../js/lokalna-shramba.js';

/** Nadomestek za localStorage; `limit` posnema polno shrambo. */
function fakeStorage(limit = Infinity) {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      const size = [...m].reduce((s, [kk, vv]) => s + (kk === k ? 0 : vv.length), 0) + String(v).length;
      if (size > limit) throw new Error('QuotaExceededError');
      m.set(k, String(v));
    },
    removeItem: (k) => m.delete(k),
    raw: m,
  };
}

test('storageWorks', () => {
  assert.equal(storageWorks(fakeStorage()), true);
  assert.equal(storageWorks(fakeStorage(0)), false);
  assert.equal(storageWorks({ getItem() { throw new Error('x'); } }), false);
});

test('put, get, getAll, del', async () => {
  const s = createLocalStore(fakeStorage());
  assert.deepEqual(await s.getAll('foods'), []);
  await s.put('foods', { id: 'a', name: 'Jajce' });
  await s.put('foods', { id: 'b', name: 'Riž' });
  await s.put('foods', { id: 'a', name: 'Jajce L' }); // zamenja
  assert.equal((await s.get('foods', 'a')).name, 'Jajce L');
  assert.equal((await s.getAll('foods')).length, 2);
  await s.del('foods', 'a');
  assert.equal(await s.get('foods', 'a'), undefined);
  await s.put('days', { date: '2026-11-25', incomplete: true });
  assert.equal((await s.get('days', '2026-11-25')).incomplete, true);
  await s.put('settings', { key: 'main', theme: 'dark' });
  assert.equal((await s.get('settings', 'main')).theme, 'dark');
  await assert.rejects(() => s.put('foods', { name: 'brez ključa' }));
  await assert.rejects(() => s.getAll('neznano'));
});

test('podatki preživijo ponovni zagon in so neodvisne kopije', async () => {
  const storage = fakeStorage();
  const a = createLocalStore(storage);
  const obj = { id: 'e1', date: '2026-11-25', foodId: 'f1', kcal: 100, food: { name: 'X' } };
  await a.put('entries', obj);
  obj.kcal = 999; // sprememba izvirnika ne sme vplivati na shranjeno
  const got = await a.get('entries', 'e1');
  got.food.name = 'spremenjeno';
  const b = createLocalStore(storage); // »ponovni zagon«
  assert.deepEqual(await b.get('entries', 'e1'), { id: 'e1', date: '2026-11-25', foodId: 'f1', kcal: 100, food: { name: 'X' } });
});

test('getByIndex in countByIndex', async () => {
  const s = createLocalStore(fakeStorage());
  await s.put('entries', { id: '1', date: '2026-11-24', foodId: 'f1' });
  await s.put('entries', { id: '2', date: '2026-11-25', foodId: 'f1' });
  await s.put('entries', { id: '3', date: '2026-11-25', foodId: 'f2' });
  assert.deepEqual((await s.getByIndex('entries', 'date', '2026-11-25')).map((e) => e.id), ['2', '3']);
  assert.equal(await s.countByIndex('entries', 'foodId', 'f1'), 2);
  assert.equal(await s.countByIndex('entries', 'foodId', 'ni'), 0);
});

test('replaceAll zamenja vse zbirke', async () => {
  const s = createLocalStore(fakeStorage());
  await s.put('foods', { id: 'staro' });
  await s.put('weights', { id: 'w', date: '2026-11-01', kg: 80 });
  await s.replaceAll({ foods: [{ id: 'novo' }], entries: [], settings: [{ key: 'main' }] });
  assert.deepEqual(await s.getAll('foods'), [{ id: 'novo' }]);
  assert.deepEqual(await s.getAll('weights'), []);
  assert.equal((await s.getAll('settings')).length, 1);
});

test('polna shramba: napaka, stari podatki ostanejo', async () => {
  const storage = fakeStorage(200);
  const s = createLocalStore(storage);
  await s.put('foods', { id: 'a', name: 'Jajce' });
  await assert.rejects(() => s.put('foods', { id: 'b', name: 'x'.repeat(500) }), /polna/);
  assert.deepEqual(await s.getAll('foods'), [{ id: 'a', name: 'Jajce' }]);
  await assert.rejects(() => s.replaceAll({ foods: [{ id: 'c', name: 'y'.repeat(500) }] }), /Uvoz ni uspel/);
  assert.deepEqual(await s.getAll('foods'), [{ id: 'a', name: 'Jajce' }]);
});

test('poškodovan zapis ne sesuje aplikacije', async () => {
  const storage = fakeStorage();
  storage.setItem('tilen-letonja:foods', '{to ni json');
  const s = createLocalStore(storage);
  assert.deepEqual(await s.getAll('foods'), []);
});
