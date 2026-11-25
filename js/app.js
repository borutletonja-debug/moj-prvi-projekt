// Zagon aplikacije, zavihki, tema in posodobitve.
import { h, icon, toast } from './ui/komponente.js';
import * as stanje from './stanje.js';
import { todayKey } from './logic/datumi.js';
import * as danes from './ui/danes.js';
import * as knjiznica from './ui/knjiznica.js';
import * as nastavitve from './ui/nastavitve.js';
import * as kmalu from './ui/kmalu.js';

const TABS = [
  { id: 'danes', label: 'Danes', icon: 'today', render: (root, ctx) => danes.render(root, ctx) },
  { id: 'zgodovina', label: 'Zgodovina', icon: 'history', render: (root, ctx) => kmalu.render(root, ctx, 'zgodovina') },
  { id: 'teza', label: 'Teža', icon: 'weight', render: (root, ctx) => kmalu.render(root, ctx, 'teza') },
  { id: 'knjiznica', label: 'Knjižnica', icon: 'library', render: (root, ctx) => knjiznica.render(root, ctx) },
  { id: 'nastavitve', label: 'Nastavitve', icon: 'settings', render: (root, ctx) => nastavitve.render(root, ctx) },
];

const screen = document.getElementById('screen');
const tabbar = document.getElementById('tabbar');
let current = null;
let renderedDate = todayKey();
let renderSeq = 0;

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('theme', theme); } catch { /* */ }
}

const ctx = { navigate, applyTheme };

function tabFromHash() {
  const id = location.hash.replace('#', '');
  return TABS.find((t) => t.id === id) ? id : 'danes';
}

function navigate(id) {
  if (location.hash !== `#${id}`) location.hash = id; // sproži hashchange
  else show(id);
}

async function show(id, { keepScroll = false } = {}) {
  const tab = TABS.find((t) => t.id === id) || TABS[0];
  const changedTab = current !== tab.id;
  current = tab.id;
  for (const b of tabbar.children) {
    if (b.dataset.tab === tab.id) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  const seq = ++renderSeq;
  const root = document.createElement('div');
  try {
    await tab.render(root, ctx);
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
      if (current === t.id) window.scrollTo({ top: 0, behavior: 'smooth' });
      else navigate(t.id);
    },
  }, icon(t.icon), h('span', {}, t.label))));
}

// ----- Service worker in posodobitve -----
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
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
      h('p', { class: 'muted' }, 'Aplikacija ne more odpreti lokalne baze. V zasebnem načinu brskalnika shranjevanje ne deluje.'),
      h('p', { class: 'muted small' }, String(e?.message || e))));
    return;
  }
  const s = stanje.settings();
  applyTheme(s.theme);
  if (!s.firstUse) await stanje.saveSettings({ firstUse: todayKey() });

  buildTabbar();
  window.addEventListener('hashchange', () => show(tabFromHash()));
  stanje.onChange(() => show(current, { keepScroll: true }));

  // Če je aplikacija odprta čez polnoč, osveži zaslon »Danes«.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && renderedDate !== todayKey()) show(current, { keepScroll: false });
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
