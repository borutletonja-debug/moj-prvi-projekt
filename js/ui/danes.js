// Zaslon »Danes«.
import { h, setChildren, icon, calorieRing, macroBar, macroChips } from './komponente.js';
import { openAddEntry, openEditEntry } from './vnos.js';
import { sumEntries } from '../logic/prehrana.js';
import { formatKcal, formatNumber } from '../logic/stevila.js';
import { todayKey, formatDayLong } from '../logic/datumi.js';
import { backupDue } from '../logic/nastavitve.js';
import * as stanje from '../stanje.js';

export async function render(root, ctx) {
  const date = todayKey();
  const settings = stanje.settings();
  const goals = settings.goals;
  const entries = await stanje.getEntriesForDate(date);
  const t = sumEntries(entries);

  const head = h('div', { class: 'screen-head' },
    h('h1', {}, 'Danes'),
    h('div', { class: 'sub' }, formatDayLong(date)),
  );

  const ringCard = h('section', { class: 'card ring-card', 'aria-label': 'Kalorije' }, calorieRing(t.kcal, goals.kcal));

  const macros = h('section', { class: 'card', 'aria-label': 'Makrohranila' },
    macroBar({ key: 'protein', label: 'Beljakovine', consumed: t.protein, goal: goals.protein, primary: true }),
    h('div', { class: 'macro-row' },
      macroBar({ key: 'fat', label: 'Maščobe', consumed: t.fat, goal: goals.fat }),
      macroBar({ key: 'carbs', label: 'Ogljikovi hidrati', consumed: t.carbs, goal: goals.carbs }),
    ),
  );

  let backupNotice = null;
  const allEntries = entries.length ? 1 : (await stanje.getEntries()).length;
  if (backupDue(settings, date, allEntries > 0)) {
    backupNotice = h('div', { class: 'notice', role: 'note' },
      'Podatki so shranjeni samo na tem telefonu. Varnostne kopije ni bilo že več kot 14 dni.',
      h('div', {}, h('button', { class: 'link-btn', type: 'button', onclick: () => ctx.navigate('nastavitve') }, 'Izvozi varnostno kopijo')),
    );
  }

  const list = entries.length
    ? h('div', { class: 'list' }, entries.map((e) => h('button', {
      class: 'row', type: 'button', onclick: () => openEditEntry(e),
      'aria-label': `${e.food.name}, ${formatNumber(e.quantity)} ${e.unit}, ${formatKcal(e.kcal)} kcal. Uredi.`,
    },
    h('div', { class: 'row-main' },
      h('div', { class: 'row-title' }, e.food.name),
      h('div', { class: 'row-sub num' }, `${formatNumber(e.quantity)} ${e.unit}`),
    ),
    h('div', { class: 'row-end' },
      h('div', { class: 'row-kcal num' }, formatKcal(e.kcal), h('small', {}, 'kcal')),
      macroChips(e),
    ))))
    : h('div', { class: 'list' }, h('div', { class: 'empty' },
      h('strong', {}, 'Danes še ni vnosov'),
      'Dotakni se »+ Dodaj« in izberi živilo.'));

  const fab = h('button', { class: 'fab', type: 'button', onclick: () => openAddEntry(date) }, icon('plus'), 'Dodaj');

  setChildren(root,
    head,
    backupNotice,
    ringCard,
    macros,
    h('div', { class: 'section-title' }, `Vnosi${entries.length ? ` (${entries.length})` : ''}`),
    list,
    fab,
  );
  return { date };
}
