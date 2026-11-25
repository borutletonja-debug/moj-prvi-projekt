// Service worker: aplikacija deluje brez internetne povezave.
// Ob vsaki objavi povečaj VERSION (in APP_VERSION v js/verzija.js).
const VERSION = '1.2.0';
const CACHE = `tilen-letonja-${VERSION}`;

const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/db.js',
  './js/stanje.js',
  './js/verzija.js',
  './js/logic/besedilo.js',
  './js/logic/datumi.js',
  './js/logic/iskanje.js',
  './js/logic/izvoz.js',
  './js/logic/nastavitve.js',
  './js/logic/pregled.js',
  './js/logic/prehrana.js',
  './js/logic/priporocilo.js',
  './js/logic/stevila.js',
  './js/logic/tdee.js',
  './js/logic/tedni.js',
  './js/logic/teza.js',
  './js/ui/dan.js',
  './js/ui/zgodovina.js',
  './js/ui/danes.js',
  './js/ui/graf.js',
  './js/ui/knjiznica.js',
  './js/ui/komponente.js',
  './js/ui/nastavitve.js',
  './js/ui/teza.js',
  './js/ui/vnos.js',
  './js/ui/zivilo.js',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))),
  );
  // Prva namestitev: takoj aktiviraj. Posodobitev: počakaj, da uporabnik potrdi.
  if (!self.registration.active) self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('tilen-letonja-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Odpiranje aplikacije: vedno vrni shranjeni index.html
    if (req.mode === 'navigate') {
      return (await cache.match('./index.html')) || fetch(req);
    }
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      return await fetch(req);
    } catch {
      return new Response('', { status: 504, statusText: 'Brez povezave' });
    }
  })());
});
