// Razčlenjevanje in prikaz števil (sprejema decimalno vejico ali piko).

/**
 * Pretvori vnos uporabnika v število.
 * Vrne null za prazen vnos in NaN za neveljaven vnos.
 *  "0,5" -> 0.5, "0.5" -> 0.5, " 12 " -> 12, "" -> null, "1,2,3" -> NaN
 */
export function parseNumber(input) {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') return Number.isFinite(input) ? input : NaN;
  const s = String(input).trim().replace(/\s+/g, '');
  if (s === '') return null;
  const normalized = s.replace(',', '.');
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(normalized)) return NaN;
  return Number(normalized);
}

/**
 * Preveri številsko polje.
 * opts: { required = true, min = 0, minExclusive = false, max }
 * Vrne { value, error } – error je slovensko sporočilo ali null.
 */
export function validateNumber(input, opts = {}) {
  const { required = true, min = 0, minExclusive = false, max } = opts;
  const value = parseNumber(input);
  if (value === null) {
    return required ? { value: null, error: 'Obvezno polje.' } : { value: null, error: null };
  }
  if (Number.isNaN(value)) return { value: null, error: 'Vpiši število (npr. 12,5).' };
  if (min !== undefined && min !== null) {
    if (minExclusive && value <= min) {
      return { value: null, error: min === 0 ? 'Vrednost mora biti večja od 0.' : `Vrednost mora biti večja od ${formatNumber(min)}.` };
    }
    if (!minExclusive && value < min) {
      return { value: null, error: min === 0 ? 'Vrednost ne sme biti negativna.' : `Vrednost mora biti vsaj ${formatNumber(min)}.` };
    }
  }
  if (max !== undefined && max !== null && value > max) {
    return { value: null, error: `Vrednost je prevelika (največ ${formatNumber(max)}).` };
  }
  return { value, error: null };
}

function noNegZero(n) {
  return Object.is(n, -0) ? 0 : n;
}

/** Kalorije: celo število. */
export function formatKcal(n) {
  if (!Number.isFinite(n)) return '–';
  return String(noNegZero(Math.round(n)));
}

/** Makrohranila: ena decimalka z vejico. */
export function formatMacro(n) {
  if (!Number.isFinite(n)) return '–';
  const r = noNegZero(Math.round(n * 10) / 10);
  return r.toFixed(1).replace('.', ',');
}

/** Splošno število (npr. količina): do `decimals` decimalk, brez odvečnih ničel. */
export function formatNumber(n, decimals = 2) {
  if (!Number.isFinite(n)) return '–';
  const f = 10 ** decimals;
  const r = noNegZero(Math.round(n * f) / f);
  return String(r).replace('.', ',');
}
