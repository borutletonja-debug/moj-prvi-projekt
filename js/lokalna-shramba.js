// Nadomestna shramba v localStorage, kadar IndexedDB ni na voljo
// (npr. iPhone z vklopljenim načinom zaklepanja – Lockdown Mode).
// Vsaka zbirka je shranjena kot en JSON zapis.

export const KEY_PATHS = Object.freeze({ foods: 'id', entries: 'id', days: 'date', weights: 'id', settings: 'key' });
const PREFIX = 'tilen-letonja:';

/** Ali je shramba uporabna (v nekaterih načinih localStorage obstaja, a ne dovoli pisanja). */
export function storageWorks(storage) {
  try {
    const k = `${PREFIX}test`;
    storage.setItem(k, '1');
    const ok = storage.getItem(k) === '1';
    storage.removeItem(k);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Ustvari shrambo z enakim vmesnikom kot IndexedDB sloj.
 * `storage` je localStorage (ali nadomestek z getItem/setItem/removeItem v testih).
 */
export function createLocalStore(storage) {
  const cache = new Map(); // zbirka -> Map(ključ -> zapis)

  function load(store) {
    if (!KEY_PATHS[store]) throw new Error(`Neznana zbirka: ${store}`);
    if (!cache.has(store)) {
      let list = [];
      try {
        const raw = storage.getItem(PREFIX + store);
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) list = parsed;
      } catch { /* poškodovan zapis – začni s prazno zbirko */ }
      cache.set(store, new Map(list.map((v) => [v[KEY_PATHS[store]], v])));
    }
    return cache.get(store);
  }

  function write(store, map) {
    try {
      storage.setItem(PREFIX + store, JSON.stringify([...map.values()]));
    } catch (e) {
      cache.delete(store); // predpomnilnik naj se ujema s tem, kar je res shranjeno
      throw new Error('Shramba telefona je polna ali ni dovoljena. Izvozi varnostno kopijo in sprosti prostor.', { cause: e });
    }
  }

  const clone = (v) => JSON.parse(JSON.stringify(v));

  return {
    kind: 'localStorage',
    async getAll(store) { return [...load(store).values()].map(clone); },
    async get(store, key) { const v = load(store).get(key); return v === undefined ? undefined : clone(v); },
    async put(store, value) {
      const map = load(store);
      const key = value[KEY_PATHS[store]];
      if (key === undefined || key === null) throw new Error('Zapis nima ključa.');
      const next = new Map(map);
      next.set(key, clone(value));
      write(store, next);
      cache.set(store, next);
      return key;
    },
    async del(store, key) {
      const map = load(store);
      if (!map.has(key)) return;
      const next = new Map(map);
      next.delete(key);
      write(store, next);
      cache.set(store, next);
    },
    async getByIndex(store, index, value) {
      return [...load(store).values()].filter((v) => v[index] === value).map(clone);
    },
    async countByIndex(store, index, value) {
      return [...load(store).values()].filter((v) => v[index] === value).length;
    },
    /** Zamenja vse zbirke; ob napaki povrne prejšnje stanje (vse ali nič). */
    async replaceAll(data) {
      const stores = Object.keys(KEY_PATHS);
      const before = new Map(stores.map((s) => [s, storage.getItem(PREFIX + s)]));
      try {
        for (const s of stores) storage.setItem(PREFIX + s, JSON.stringify(data[s] || []));
      } catch (e) {
        for (const [s, raw] of before) {
          try { if (raw === null) storage.removeItem(PREFIX + s); else storage.setItem(PREFIX + s, raw); } catch { /* */ }
        }
        cache.clear();
        throw new Error('Uvoz ni uspel: v shrambi telefona ni dovolj prostora.', { cause: e });
      }
      cache.clear();
    },
  };
}
