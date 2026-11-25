import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNumber, validateNumber, formatKcal, formatMacro, formatNumber, formatSigned } from '../js/logic/stevila.js';

test('parseNumber sprejme vejico in piko', () => {
  assert.equal(parseNumber('0,5'), 0.5);
  assert.equal(parseNumber('0.5'), 0.5);
  assert.equal(parseNumber(' 12 '), 12);
  assert.equal(parseNumber('120,'), 120);
  assert.equal(parseNumber(',5'), 0.5);
  assert.equal(parseNumber('-3'), -3);
  assert.equal(parseNumber(7), 7);
});

test('parseNumber: prazno je null, neveljavno je NaN', () => {
  assert.equal(parseNumber(''), null);
  assert.equal(parseNumber('   '), null);
  assert.equal(parseNumber(null), null);
  assert.ok(Number.isNaN(parseNumber('abc')));
  assert.ok(Number.isNaN(parseNumber('1,2,3')));
  assert.ok(Number.isNaN(parseNumber('1.2,3')));
  assert.ok(Number.isNaN(parseNumber('12g')));
});

test('validateNumber: obvezno, negativno, večje od 0', () => {
  assert.equal(validateNumber('').error, 'Obvezno polje.');
  assert.equal(validateNumber('', { required: false }).error, null);
  assert.equal(validateNumber('-1').error, 'Vrednost ne sme biti negativna.');
  assert.equal(validateNumber('0').error, null);
  assert.equal(validateNumber('0', { minExclusive: true }).error, 'Vrednost mora biti večja od 0.');
  assert.equal(validateNumber('x').error, 'Vpiši število (npr. 12,5).');
  assert.deepEqual(validateNumber('2,5'), { value: 2.5, error: null });
  assert.ok(validateNumber('20000', { max: 10000 }).error);
});

test('formatiranje: kcal cela števila, makrohranila 1 decimalka', () => {
  assert.equal(formatKcal(123.5), '124');
  assert.equal(formatKcal(123.4), '123');
  assert.equal(formatKcal(-0.2), '0');
  assert.equal(formatMacro(12.345), '12,3');
  assert.equal(formatMacro(12.35), '12,4');
  assert.equal(formatMacro(5), '5,0');
  assert.equal(formatMacro(-0.01), '0,0');
  assert.equal(formatNumber(0.5), '0,5');
  assert.equal(formatNumber(150), '150');
  assert.equal(formatNumber(1 / 3), '0,33');
  assert.equal(formatKcal(NaN), '–');
  assert.equal(formatSigned(0.34), '+0,3');
  assert.equal(formatSigned(-0.46), '\u22120,5');
  assert.equal(formatSigned(-0.01), '0,0');
  assert.equal(formatSigned(-350, 0), '\u2212350');
});
