// Lokalna shramba na telefonu: IndexedDB, sicer nadomestno localStorage.
import { STORES } from './logic/izvoz.js';
import { createLocalStore, storageWorks } from './lokalna-shramba.js';

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

function idb_getAll(store) {
  return tx([store], 'readonly', (t) => promisify(t.objectStore(store).getAll()));
}

function idb_get(store, key) {
  return tx([store], 'readonly', (t) => promisify(t.objectStore(store).get(key)));
}

function idb_put(store, value) {
  return tx([store], 'readwrite', (t) => promisify(t.objectStore(store).put(value)));
}

function idb_del(store, key) {
  return tx([store], 'readwrite', (t) => promisify(t.objectStore(store).delete(key)));
}

function idb_getByIndex(store, index, value) {
  return tx([store], 'readonly', (t) => promisify(t.objectStore(store).index(index).getAll(value)));
}

function idb_countByIndex(store, index, value) {
  return tx([store], 'readonly', (t) => promisify(t.objectStore(store).index(index).count(value)));
}

function idb_replaceAll(data) {
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

// ----- Izbira shrambe -----
const idbBackend = {
  kind: 'indexedDB',
  getAll: idb_getAll, get: idb_get, put: idb_put, del: idb_del,
  getByIndex: idb_getByIndex, countByIndex: idb_countByIndex, replaceAll: idb_replaceAll,
};

function hasIndexedDB() {
  try { return typeof indexedDB !== 'undefined' && indexedDB !== null; } catch { return false; }
}

function getLocalStorage() {
  try { return typeof localStorage !== 'undefined' && storageWorks(localStorage) ? localStorage : null; } catch { return null; }
}

let backend = null;
function db() {
  if (backend) return backend;
  if (hasIndexedDB()) backend = idbBackend;
  else {
    // IndexedDB ni na voljo (npr. način zaklepanja na iPhonu) – uporabi localStorage.
    const ls = getLocalStorage();
    if (!ls) throw new Error('Brskalnik ne dovoli shranjevanja podatkov (ne IndexedDB ne localStorage).');
    backend = createLocalStore(ls);
  }
  return backend;
}

/** 'indexedDB' ali 'localStorage' */
export function storageKind() { return db().kind; }

const call = (name) => (...args) => {
  try { return db()[name](...args); } catch (e) { return Promise.reject(e); }
};
export const getAll = call('getAll');
export const get = call('get');
export const put = call('put');
export const del = call('del');
export const getByIndex = call('getByIndex');
export const countByIndex = call('countByIndex');

/** Zamenja VSE podatke z uvoženimi (vse ali nič). */
export const replaceAll = call('replaceAll');

/** Vsi podatki za varnostno kopijo. */
export async function exportAll() {
  const out = {};
  for (const s of STORES) out[s] = await getAll(s);
  return out;
}
