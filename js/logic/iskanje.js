// Iskanje živil, nedavna živila in zadnja uporabljena količina.
import { availableUnits, UNIT_PIECE } from './prehrana.js';

/** Odstrani strešice in velike črke: "Češnje" -> "cesnje". */
export function normalize(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function compareNames(a, b) {
  return a.name.localeCompare(b.name, 'sl', { sensitivity: 'base' });
}

/**
 * Filtrira živila po imenu. Vse besede iz poizvedbe se morajo pojaviti.
 * Razvrstitev: najprej ujemanje na začetku imena, nato abecedno.
 */
export function filterFoods(foods, query) {
  const q = normalize(query);
  if (!q) return [...foods].sort(compareNames);
  const words = q.split(/\s+/);
  const matches = foods.filter((f) => {
    const n = normalize(f.name);
    return words.every((w) => n.includes(w));
  });
  return matches.sort((a, b) => {
    const as = normalize(a.name).startsWith(q) ? 0 : 1;
    const bs = normalize(b.name).startsWith(q) ? 0 : 1;
    return as - bs || compareNames(a, b);
  });
}

function entryTime(e) {
  return e.createdAt ?? 0;
}

/** Zadnji vnos za vsako živilo: Map(foodId -> vnos). */
export function lastEntryByFood(entries) {
  const map = new Map();
  for (const e of entries) {
    if (e.foodId == null) continue;
    const prev = map.get(e.foodId);
    if (!prev || entryTime(e) > entryTime(prev)) map.set(e.foodId, e);
  }
  return map;
}

/** Nazadnje uporabljena živila (obstoječa v knjižnici), najnovejša prva. */
export function recentFoods(entries, foods, limit = 10) {
  const byId = new Map(foods.map((f) => [f.id, f]));
  return [...lastEntryByFood(entries).values()]
    .sort((a, b) => entryTime(b) - entryTime(a))
    .map((e) => byId.get(e.foodId))
    .filter(Boolean)
    .slice(0, limit);
}

/** Privzeta količina in enota za živilo: zadnja uporabljena, sicer 100 g ali 1 kos. */
export function defaultQuantity(food, lastEntry) {
  const units = availableUnits(food);
  if (lastEntry && units.includes(lastEntry.unit) && lastEntry.quantity > 0) {
    return { quantity: lastEntry.quantity, unit: lastEntry.unit };
  }
  const unit = units[0];
  return { quantity: unit === UNIT_PIECE ? 1 : 100, unit };
}
