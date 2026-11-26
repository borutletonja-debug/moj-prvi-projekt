// Zagon aplikacije, zavihki, tema in posodobitve.
import { h, icon, toast } from './ui/komponente.js';
import * as stanje from './stanje.js';
import { todayKey } from './logic/datumi.js';
import * as danes from './ui/danes.js';
import * as knjiznica from './ui/knjiznica.js';
import * as nastavitve from './ui/nastavitve.js';
import * as zgodovina from './ui/zgodovina.js';
import * as teza from './ui/teza.js';

const TABS = [
  { id: 'danes', label: 'Danes', icon: 'today', render: (root, ctx) => danes.render(root, ctx) },
  { id: 'zgodovina', label: 'Zgodovina', icon: 'history', render: (root, ctx, param) => zgodovina.render(root, ctx, param) },
  { id: 'teza', label: 'Teža', icon: 'weight', render: (root, ctx) => teza.render(root, ctx) },
  { id: 'knjiznica', label: 'Knjižnica', icon: 'library', render: (root, ctx) => knjiznica.render(root, ctx) },
  { id: 'nastavitve', label: 'Nastavitve', icon: 'settings', render: (root, ctx) => nastavitve.render(root, ctx) },
];

const screen = document.getElementById('screen');
const tabbar = document.getElementById('tabbar');
let current = null;
let currentParam = null;
let renderedDate = todayKey();
let renderSeq = 0;

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('theme', theme); } catch { /* */ }
}

const ctx = { navigate, applyTheme, rerender: () => show(current, currentParam, { keepScroll: true }) };

/** '#zgodovina/2026-11-20' -> { id: 'zgodovina', param: '2026-11-20' } */
function routeFromHash() {
  const [id, param = null] = location.hash.replace('#', '').split('/');
  return TABS.find((t) => t.id === id) ? { id, param } : { id: 'danes', param: null };
}

function showRoute(opts) {
  const r = routeFromHash();
  return show(r.id, r.param, opts);
}

/** navigate('zgodovina') ali navigate('zgodovina/2026-11-20') */
function navigate(path) {
  if (location.hash !== `#${path}`) location.hash = path; // sproži hashchange
  else showRoute();
}

async function show(id, param = null, { keepScroll = false } = {}) {
  const tab = TABS.find((t) => t.id === id) || TABS[0];
  const changedTab = current !== tab.id || currentParam !== param;
  current = tab.id;
  currentParam = param;
  for (const b of tabbar.children) {
    if (b.dataset.tab === tab.id) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  const seq = ++renderSeq;
  const root = document.createElement('div');
  try {
    await tab.render(root, ctx, param);
  } catch (e) {
    console.error(e);
    root.replaceChildren(h('div', { class: 'card' }, h('strong', {}, 'Napaka pri prikazu'), h('p', { class: 'muted' }, e.message)));
  }
  if (seq !== renderSeq) return; // medtem se je začel novejši prikaz
  const y = window.scrollY;
  screen.replaceChildren(...root.childNodes);
  renderedDate = todayKey();
  if (changedTab) window.scrollTo(0, 0);
  else if (keepScroll) window.scrollTo(0, y);
}

function buildTabbar() {
  tabbar.replaceChildren(...TABS.map((t) => h('button', {
    class: 'tab', type: 'button', dataset: { tab: t.id },
    onclick: () => {
      if (current === t.id && !currentParam) window.scrollTo({ top: 0, behavior: 'smooth' });
      else navigate(t.id);
    },
  }, icon(t.icon), h('span', {}, t.label))));
}

// ----- Service worker in posodobitve -----
function registerSW() {
  // V načinu zaklepanja (Lockdown Mode) service worker ni na voljo – aplikacija deluje, a le s povezavo.
  if (!navigator.serviceWorker?.register) return;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const offer = (worker) => {
      if (document.querySelector('.update-banner')) return;
      const banner = h('div', { class: 'update-banner', role: 'status' },
        h('span', {}, 'Na voljo je nova različica.'),
        h('button', {
          class: 'btn primary', type: 'button',
          onclick: () => { banner.remove(); worker.postMessage('skipWaiting'); },
        }, 'Posodobi'),
      );
      document.body.append(banner);
    };
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
      });
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch((e) => console.warn('SW ni registriran:', e));

  // Ponovno naloži samo ob posodobitvi (ne ob prvi namestitvi).
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !hadController) return;
    reloading = true;
    location.reload();
  });
}

async function start() {
  try {
    await stanje.loadSettings();
  } catch (e) {
    screen.replaceChildren(h('div', { class: 'card' },
      h('strong', {}, 'Shramba ni na voljo'),
      h('p', { class: 'muted' }, 'Brskalnik aplikaciji ne dovoli shranjevanja podatkov. Preveri, da ne uporabljaš zasebnega zavihka, in poskusi znova.'),
      h('p', { class: 'muted small' }, String(e?.message || e))));
    return;
  }
  const s = stanje.settings();
  applyTheme(s.theme);
  if (!s.firstUse) await stanje.saveSettings({ firstUse: todayKey() });

  buildTabbar();
  window.addEventListener('hashchange', () => showRoute());
  stanje.onChange(() => show(current, currentParam, { keepScroll: true }));

  // Če je aplikacija odprta čez polnoč, osveži zaslon »Danes«.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && renderedDate !== todayKey()) show(current, currentParam);
  });

  // Ob zagonu se vedno odpre »Danes«.
  if (location.hash && location.hash !== '#danes') history.replaceState(null, '', '#danes');
  await show('danes');

  stanje.requestPersistence();
  registerSW();
}

window.addEventListener('error', (e) => toast(`Napaka: ${e.message}`));
window.addEventListener('unhandledrejection', (e) => toast(`Napaka: ${e.reason?.message || e.reason}`));

start();
