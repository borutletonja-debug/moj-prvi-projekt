// IndexedDB: lokalna shramba na telefonu.
import { STORES } from './logic/izvoz.js';

const DB_NAME = 'tilen-letonja';
const DB_VERSION = 1;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('foods')) db.createObjectStore('foods', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('entries')) {
        const s = db.createObjectStore('entries', { keyPath: 'id' });
        s.createIndex('date', 'date');
        s.createIndex('foodId', 'foodId');
      }
      if (!db.objectStoreNames.contains('days')) db.createObjectStore('days', { keyPath: 'date' });
      if (!db.objectStoreNames.contains('weights')) {
        const s = db.createObjectStore('weights', { keyPath: 'id' });
        s.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Baza je zaklenjena. Zapri druge zavihke z aplikacijo.'));
  });
  return dbPromise;
}

function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(stores, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    let result;
    Promise.resolve(fn(t)).then((r) => { result = r; }, (err) => { try { t.abort(); } catch { /* */ } reject(err); });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transakcija prekinjena.'));
  });
}

export function getAll(store) {
  return tx([store], 'readonly', (t) => promisify(t.objectStore(store).getAll()));
}

export function get(store, key) {
  return tx([store], 'readonly', (t) => promisify(t.objectStore(store).get(key)));
}

export function put(store, value) {
  return tx([store], 'readwrite', (t) => promisify(t.objectStore(store).put(value)));
}

export function del(store, key) {
  return tx([store], 'readwrite', (t) => promisify(t.objectStore(store).delete(key)));
}

export function getByIndex(store, index, value) {
  return tx([store], 'readonly', (t) => promisify(t.objectStore(store).index(index).getAll(value)));
}

export function countByIndex(store, index, value) {
  return tx([store], 'readonly', (t) => promisify(t.objectStore(store).index(index).count(value)));
}

/** Vsi podatki za varnostno kopijo. */
export async function exportAll() {
  const out = {};
  for (const s of STORES) out[s] = await getAll(s);
  return out;
}

/** Zamenja VSE podatke z uvoženimi (v eni transakciji – vse ali nič). */
export function replaceAll(data) {
  return tx(STORES, 'readwrite', async (t) => {
    for (const s of STORES) {
      const os = t.objectStore(s);
      os.clear();
      for (const item of data[s] || []) os.put(item);
    }
  });
}

/** Prosi brskalnik, naj podatkov ne briše samodejno. */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch { /* ni podprto */ }
  return false;
}

export function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
