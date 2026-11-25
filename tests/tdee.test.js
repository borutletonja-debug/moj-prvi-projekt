import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mifflinBmr, initialTdee, makeContext, adaptiveEstimate, estimateTdee } from '../js/logic/tdee.js';
import { recommend, signedRate } from '../js/logic/priporocilo.js';
import { addDays } from '../js/logic/datumi.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const profile = { sex: 'male', birthYear: 1996, heightCm: 180, activity: 'moderate' };

/** n dni vnosov pred `today` in meritve teže vsakih `every` dni z naklonom kgPerWeek. */
function data({ today = '2026-11-29', days = 28, kcal = 2000, kgPerWeek = -0.5, every = 1, startKg = 80, skip = [] }) {
  const entries = [];
  const weights = [];
  for (let i = days; i >= 1; i -= 1) {
    const date = addDays(today, -i);
    if (!skip.includes(i)) entries.push({ date, kcal, protein: 0, fat: 0, carbs: 0 });
    const n = days - i;
    if (n % every === 0) weights.push({ id: `w${i}`, date, kg: startKg + (kgPerWeek / 7) * n });
  }
  return { entries, weights, today };
}

test('Mifflin-St Jeor', () => {
  assert.equal(mifflinBmr({ sex: 'male', age: 30, heightCm: 180, weightKg: 80 }), 800 + 1125 - 150 + 5);
  assert.equal(mifflinBmr({ sex: 'female', age: 30, heightCm: 165, weightKg: 60 }), 600 + 1031.25 - 150 - 161);
  close(initialTdee(profile, 80, 2026), 1780 * 1.55);
  assert.equal(initialTdee({ ...profile, sex: null }, 80, 2026), null);
  assert.equal(initialTdee(profile, null, 2026), null);
  assert.equal(initialTdee(null, 80, 2026), null);
});

test('adaptiveEstimate: TDEE = vnos − sprememba teže × 7700', () => {
  const d = data({});
  const ctx = makeContext({ ...d, profile });
  const e = adaptiveEstimate(ctx, d.today, d.today);
  assert.equal(e.completeDays, 27); // okno 28 dni vključuje današnji dan, ki ne šteje
  assert.equal(e.measurements, 27);
  close(e.avgIntake, 2000);
  close(e.slopeKgPerDay, -0.5 / 7);
  close(e.raw, 2000 + 550);
  assert.equal(e.sufficient, true);
  assert.equal(e.score, 1);
});

test('adaptiveEstimate: pridobivanje teže pomeni nižjo porabo od vnosa', () => {
  const d = data({ kcal: 3000, kgPerWeek: 0.25 });
  const e = adaptiveEstimate(makeContext({ ...d, profile }), d.today, d.today);
  close(e.raw, 3000 - 275);
});

test('nepopolni dnevi in današnji dan ne štejejo', () => {
  const d = data({});
  d.entries.push({ date: d.today, kcal: 300, protein: 0, fat: 0, carbs: 0 });
  const dayFlags = [{ date: addDays(d.today, -1), incomplete: true }, { date: addDays(d.today, -2), incomplete: true }];
  const e = adaptiveEstimate(makeContext({ ...d, dayFlags, profile }), d.today, d.today);
  assert.equal(e.completeDays, 25);
  close(e.avgIntake, 2000);
});

test('premalo podatkov: začetna ocena po formuli', () => {
  // samo 8 dni
  const few = data({ days: 8 });
  const r1 = estimateTdee(makeContext({ ...few, profile }), { end: few.today, today: few.today });
  assert.equal(r1.level, 'initial');
  assert.equal(r1.adaptive, null);
  close(r1.tdee, r1.initial);
  assert.equal(r1.current.sufficient, false);

  // dovolj dni, a samo 3 meritve
  const fewW = data({ every: 9 }); // ena meritev pade iz 28-dnevnega okna
  const r2 = estimateTdee(makeContext({ ...fewW, profile }), { end: fewW.today, today: fewW.today });
  assert.equal(r2.current.measurements, 3);
  assert.equal(r2.level, 'initial');

  // dovolj meritev, a premalo popolnih dni
  const fewD = data({ skip: Array.from({ length: 20 }, (_, i) => i + 1) });
  const r3 = estimateTdee(makeContext({ ...fewD, profile }), { end: fewD.today, today: fewD.today });
  assert.equal(r3.current.completeDays, 7);
  assert.equal(r3.level, 'initial');

  // brez osebnih podatkov in brez meritev
  const r4 = estimateTdee(makeContext({ entries: [], weights: [], profile: null }), { end: '2026-11-29', today: '2026-11-29' });
  assert.equal(r4.level, 'none');
  assert.equal(r4.tdee, null);
});

test('delna ocena je mešanica formule in meritev', () => {
  const d = data({ days: 16, every: 3 }); // 15 popolnih dni, 6 meritev, razpon 15 dni
  const r = estimateTdee(makeContext({ ...d, profile }), { end: d.today, today: d.today });
  assert.equal(r.level, 'partial');
  close(r.weight, 15 / 21);
  close(r.tdee, r.weight * r.adaptive + (1 - r.weight) * r.initial);
  assert.ok(r.tdee > Math.min(r.adaptive, r.initial) && r.tdee < Math.max(r.adaptive, r.initial));
});

test('zanesljiva ocena iz meritev; brez profila deluje samo iz meritev', () => {
  const d = data({});
  const r = estimateTdee(makeContext({ ...d, profile }), { end: d.today, today: d.today });
  assert.equal(r.level, 'reliable');
  close(r.tdee, 2550);
  const noProfile = estimateTdee(makeContext({ ...d, profile: null }), { end: d.today, today: d.today });
  assert.equal(noProfile.initial, null);
  close(noProfile.tdee, 2550);
});

test('glajenje: nenadna sprememba premakne oceno le delno', () => {
  // 8 tednov: vnos 2000 in stabilna teža (TDEE 2000) ...
  const d = data({ days: 56, kgPerWeek: 0 });
  // ... nato zadnja 2 tedna teža hitro pada
  for (const w of d.weights) {
    const ago = Math.round((new Date(d.today) - new Date(w.date)) / 86400000);
    if (ago <= 14) w.kg -= ((14 - ago) / 7) * 1.0;
  }
  const ctx = makeContext({ ...d, profile });
  const r = estimateTdee(ctx, { end: d.today, today: d.today });
  assert.ok(r.current.raw > 2300, `surova ocena ${r.current.raw}`);
  assert.ok(r.adaptive < r.current.raw, 'zglajena ocena je nižja od surove');
  assert.ok(r.adaptive > 2000);
});

test('nesmiselna ocena se zavrže', () => {
  const d = data({ kgPerWeek: -6 }); // napaka pri vnosu teže
  const r = estimateTdee(makeContext({ ...d, profile }), { end: d.today, today: d.today });
  assert.equal(r.current.implausible, true);
  assert.equal(r.level, 'initial');
});

test('signedRate', () => {
  assert.equal(signedRate({ direction: 'lose', rateKgPerWeek: 0.5 }), -0.5);
  assert.equal(signedRate({ direction: 'gain', rateKgPerWeek: 0.25 }), 0.25);
  assert.equal(signedRate({ direction: 'maintain', rateKgPerWeek: 0.5 }), 0);
  assert.equal(signedRate(undefined), 0);
});

test('priporočen vnos = TDEE + tempo × 7700 / 7', () => {
  const r = recommend({ tdee: 2550, rateKgPerWeek: -0.5, sex: 'male', weightKg: 80, age: 30 });
  close(r.adjustment, -550);
  close(r.target, 2000);
  assert.equal(r.recommended, 2000);
  assert.equal(r.belowFloor, false);
  assert.equal(r.tooFast, false);
  assert.equal(recommend({ tdee: 2504, rateKgPerWeek: 0, sex: 'male', weightKg: 80 }).recommended, 2500);
  assert.equal(recommend({ tdee: 2500, rateKgPerWeek: 0.25, sex: 'male', weightKg: 80 }).recommended, 2780);
  assert.equal(recommend({ tdee: null, rateKgPerWeek: 0 }), null);
});

test('varnost: spodnja meja in največ 1 % telesne teže na teden', () => {
  const m = recommend({ tdee: 2000, rateKgPerWeek: -1, sex: 'male', weightKg: 80, age: 30 }); // cilj 900
  assert.equal(m.belowFloor, true);
  assert.equal(m.recommended, 1500);
  assert.equal(m.tooFast, true); // 1 kg > 0,8 kg
  const f = recommend({ tdee: 1600, rateKgPerWeek: -0.5, sex: 'female', weightKg: 60, age: 30 }); // cilj 1050
  assert.equal(f.recommended, 1200);
  assert.equal(f.tooFast, false); // 0,5 < 0,6
  assert.equal(recommend({ tdee: 2500, rateKgPerWeek: -0.8, sex: 'male', weightKg: 80 }).tooFast, false); // točno 1 %
  assert.equal(recommend({ tdee: 2500, rateKgPerWeek: 1.5, sex: 'male', weightKg: 80 }).tooFast, false); // pridobivanje
});
