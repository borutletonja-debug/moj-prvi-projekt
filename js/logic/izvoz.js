// Varnostna kopija (JSON) in izvoz v CSV.
import { formatKcal, formatMacro, formatNumber } from './stevila.js';
import { isValidDateKey } from './datumi.js';

export const BACKUP_APP = 'tilen-letonja';
export const BACKUP_VERSION = 1;
export const STORES = ['foods', 'entries', 'days', 'weights', 'settings'];

export function buildBackup(data, now = new Date()) {
  const out = { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), data: {} };
  for (const s of STORES) out.data[s] = Array.isArray(data[s]) ? data[s] : [];
  return out;
}

/**
 * Preveri uvoženo varnostno kopijo.
 * Vrne { ok, error, data, counts }.
 */
export function validateBackup(obj) {
  const fail = (error) => ({ ok: false, error });
  if (!obj || typeof obj !== 'object') return fail('Datoteka ni veljavna varnostna kopija.');
  if (obj.app !== BACKUP_APP) return fail('Datoteka ni varnostna kopija te aplikacije.');
  if (typeof obj.version !== 'number' || obj.version > BACKUP_VERSION) {
    return fail('Varnostna kopija je iz novejše različice aplikacije. Najprej posodobi aplikacijo.');
  }
  const d = obj.data;
  if (!d || typeof d !== 'object') return fail('V datoteki ni podatkov.');

  const data = {};
  for (const s of STORES) {
    const arr = d[s] ?? [];
    if (!Array.isArray(arr)) return fail(`Napačna oblika podatkov (${s}).`);
    data[s] = arr;
  }
  for (const f of data.foods) {
    if (!f || typeof f.id !== 'string' || typeof f.name !== 'string') return fail('Napačen zapis živila.');
  }
  for (const e of data.entries) {
    if (!e || typeof e.id !== 'string' || !isValidDateKey(e.date) || !e.food || !Number.isFinite(e.kcal)) {
      return fail('Napačen zapis vnosa v dnevniku.');
    }
  }
  for (const d2 of data.days) {
    if (!d2 || !isValidDateKey(d2.date)) return fail('Napačen zapis dneva.');
  }
  for (const w of data.weights) {
    if (!w || typeof w.id !== 'string' || !isValidDateKey(w.date) || !Number.isFinite(w.kg)) {
      return fail('Napačen zapis teže.');
    }
  }
  for (const s of data.settings) {
    if (!s || typeof s.key !== 'string') return fail('Napačen zapis nastavitev.');
  }
  const counts = Object.fromEntries(STORES.map((s) => [s, data[s].length]));
  return { ok: true, error: null, data, counts };
}

/** Celica CSV (ločilo ;). */
function cell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV z ločilom ";" in decimalno vejico (Excel / Numbers v slovenščini). Z BOM za šumnike. */
export function toCSV(header, rows) {
  const lines = [header, ...rows].map((r) => r.map(cell).join(';'));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

export function entriesCSV(entries) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt ?? 0) - (b.createdAt ?? 0));
  return toCSV(
    ['Datum', 'Živilo', 'Količina', 'Enota', 'kcal', 'Beljakovine (g)', 'Maščobe (g)', 'Ogljikovi hidrati (g)'],
    sorted.map((e) => [
      e.date, e.food?.name ?? '', formatNumber(e.quantity), e.unit,
      formatKcal(e.kcal), formatMacro(e.protein), formatMacro(e.fat), formatMacro(e.carbs),
    ]),
  );
}

export function foodsCSV(foods) {
  const sorted = [...foods].sort((a, b) => a.name.localeCompare(b.name, 'sl'));
  return toCSV(
    ['Živilo', 'Osnova', 'kcal', 'Beljakovine (g)', 'Maščobe (g)', 'Ogljikovi hidrati (g)', 'Teža kosa (g)', 'Priljubljeno'],
    sorted.map((f) => [
      f.name, f.basis === 'kos' ? 'na 1 kos' : 'na 100 g',
      formatNumber(f.kcal, 1), formatNumber(f.protein, 1), formatNumber(f.fat, 1), formatNumber(f.carbs, 1),
      f.pieceWeight ? formatNumber(f.pieceWeight, 1) : '', f.favorite ? 'da' : '',
    ]),
  );
}

export function weightsCSV(weights) {
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  return toCSV(['Datum', 'Teža (kg)'], sorted.map((w) => [w.date, formatNumber(w.kg, 2)]));
}
