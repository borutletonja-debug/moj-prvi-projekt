// Podatkovni sloj aplikacije nad IndexedDB.
import * as db from './db.js';
import { mergeSettings, SETTINGS_KEY } from './logic/nastavitve.js';
import { buildEntry } from './logic/prehrana.js';

let settingsCache = null;
const listeners = new Set();

/** Obvesti zaslone, da so se podatki spremenili. */
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function changed(what) { for (const fn of listeners) fn(what); }

// ----- Nastavitve -----
export async function loadSettings() {
  settingsCache = mergeSettings(await db.get('settings', SETTINGS_KEY));
  return settingsCache;
}

export function settings() { return settingsCache; }

export async function saveSettings(patch) {
  settingsCache = mergeSettings({ ...settingsCache, ...patch });
  await db.put('settings', settingsCache);
  try { localStorage.setItem('theme', settingsCache.theme); } catch { /* */ }
  changed('settings');
  return settingsCache;
}

// ----- Živila -----
export const getFoods = () => db.getAll('foods');
export const getFood = (id) => db.get('foods', id);

export async function saveFood(value, existing) {
  const now = Date.now();
  const food = existing
    ? { ...existing, ...value, updatedAt: now }
    : { id: db.newId(), favorite: false, ...value, createdAt: now, updatedAt: now };
  await db.put('foods', food);
  changed('foods');
  return food;
}

export async function toggleFavorite(food) {
  const f = { ...food, favorite: !food.favorite };
  await db.put('foods', f);
  changed('foods');
  return f;
}

export const foodUsageCount = (id) => db.countByIndex('entries', 'foodId', id);

export async function deleteFood(id) {
  await db.del('foods', id);
  changed('foods');
}

// ----- Vnosi v dnevnik -----
export const getEntries = () => db.getAll('entries');

export async function getEntriesForDate(date) {
  const list = await db.getByIndex('entries', 'date', date);
  return list.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
}

/** Nov vnos iz živila v knjižnici. */
export async function addEntry({ date, food, quantity, unit }) {
  const e = buildEntry({ id: db.newId(), date, foodId: food.id, source: food, quantity, unit });
  await db.put('entries', e);
  changed('entries');
  return e;
}

/** Sprememba količine obstoječega vnosa – preračun iz shranjenega posnetka. */
export async function updateEntry(entry, { quantity, unit }) {
  const e = buildEntry({ ...entry, source: entry.food, quantity, unit });
  await db.put('entries', e);
  changed('entries');
  return e;
}

export async function deleteEntry(id) {
  await db.del('entries', id);
  changed('entries');
}

// ----- Dnevi (oznaka »nepopoln«) -----
export const getDays = () => db.getAll('days');

export async function isIncomplete(date) {
  return !!(await db.get('days', date))?.incomplete;
}

export async function setIncomplete(date, incomplete) {
  if (incomplete) await db.put('days', { date, incomplete: true });
  else await db.del('days', date);
  changed('days');
}

// ----- Teža (ena meritev na dan) -----
export const getWeights = () => db.getAll('weights');

/** Shrani meritev; obstoječo meritev istega dne zamenja. */
export async function saveWeight({ id, date, kg }) {
  const sameDay = await db.getByIndex('weights', 'date', date);
  for (const w of sameDay) if (w.id !== id) await db.del('weights', w.id);
  const w = { id: id ?? db.newId(), date, kg, updatedAt: Date.now() };
  await db.put('weights', w);
  changed('weights');
  return w;
}

export async function deleteWeight(id) {
  await db.del('weights', id);
  changed('weights');
}

// ----- Varnostna kopija -----
export const exportAll = db.exportAll;

export async function importAll(data) {
  await db.replaceAll(data);
  await loadSettings();
  changed('all');
}

export const requestPersistence = db.requestPersistence;
