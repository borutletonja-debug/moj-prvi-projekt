// Prikaz enega dne (uporabljata ga »Danes« in »Zgodovina«).
import { h, icon, calorieRing, macroBar, macroChips } from './komponente.js';
import { openAddEntry, openEditEntry } from './vnos.js';
import { sumEntries } from '../logic/prehrana.js';
import { formatKcal, formatNumber } from '../logic/stevila.js';
import { goalsForDate } from '../logic/nastavitve.js';
import * as stanje from '../stanje.js';

/** Vrne seznam elementov za dan `date`. */
export async function dayView(date, { emptyTitle = 'Ta dan še ni vnosov' } = {}) {
  const goals = goalsForDate(stanje.settings(), date);
  const [entries, incomplete] = await Promise.all([stanje.getEntriesForDate(date), stanje.isIncomplete(date)]);
  const t = sumEntries(entries);

  const ringCard = h('section', { class: 'card ring-card', 'aria-label': 'Kalorije' }, calorieRing(t.kcal, goals.kcal));

  const macros = h('section', { class: 'card', 'aria-label': 'Makrohranila' },
    macroBar({ key: 'protein', label: 'Beljakovine', consumed: t.protein, goal: goals.protein, primary: true }),
    h('div', { class: 'macro-row' },
      macroBar({ key: 'fat', label: 'Maščobe', consumed: t.fat, goal: goals.fat }),
      macroBar({ key: 'carbs', label: 'Ogljikovi hidrati', consumed: t.carbs, goal: goals.carbs }),
    ),
  );

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
      h('strong', {}, emptyTitle),
      'Dotakni se »+ Dodaj« in izberi živilo.'));

  // Oznaka »nepopoln dan«
  const toggle = h('button', {
    class: 'switch', type: 'button', role: 'switch', 'aria-checked': String(incomplete),
    'aria-label': 'Nepopoln dan',
    onclick: () => stanje.setIncomplete(date, !incomplete),
  }, h('span', { class: 'knob' }));
  const incompleteRow = h('div', { class: 'list', style: 'margin-top: 14px' },
    h('div', { class: 'row' },
      h('div', { class: 'row-main' },
        h('div', { class: 'row-title' }, 'Nepopoln dan'),
        h('div', { class: 'row-sub', style: 'white-space: normal' }, 'Vklopi, če ta dan ni vpisana vsa hrana. Dan se ne upošteva v povprečjih in izračunih.'),
      ),
      toggle,
    ));

  const fab = h('button', { class: 'fab', type: 'button', onclick: () => openAddEntry(date) }, icon('plus'), 'Dodaj');

  return [
    ringCard,
    macros,
    h('div', { class: 'section-title' }, `Vnosi${entries.length ? ` (${entries.length})` : ''}`),
    list,
    incompleteRow,
    fab,
  ];
}
