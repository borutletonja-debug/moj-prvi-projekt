// Datumi kot nizi 'YYYY-MM-DD' v LOKALNEM času telefona (ne UTC).

const pad = (n) => String(n).padStart(2, '0');

export function toDateKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayKey(now = new Date()) {
  return toDateKey(now);
}

/** 'YYYY-MM-DD' -> Date (lokalno, opoldne – varno pred premiki ure). */
export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function isValidDateKey(key) {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  return toDateKey(parseDateKey(key)) === key;
}

export function addDays(key, n) {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + n);
  return toDateKey(d);
}

/** Število dni od a do b (b - a). */
export function daysBetween(a, b) {
  const ms = parseDateKey(b) - parseDateKey(a);
  return Math.round(ms / 86400000);
}

/** Ponedeljek tedna, v katerem je dan. */
export function weekStart(key) {
  const d = parseDateKey(key);
  const dow = (d.getDay() + 6) % 7; // pon = 0 ... ned = 6
  return addDays(key, -dow);
}

const DNEVI = ['nedelja', 'ponedeljek', 'torek', 'sreda', 'četrtek', 'petek', 'sobota'];
const MESECI = ['januar', 'februar', 'marec', 'april', 'maj', 'junij', 'julij',
  'avgust', 'september', 'oktober', 'november', 'december'];

/** "torek, 25. november" */
export function formatDayLong(key) {
  const d = parseDateKey(key);
  return `${DNEVI[d.getDay()]}, ${d.getDate()}. ${MESECI[d.getMonth()]}`;
}

/** "25. 11. 2026" */
export function formatDateShort(key) {
  const d = parseDateKey(key);
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
}
