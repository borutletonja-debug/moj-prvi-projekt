// Dodajanje in urejanje vnosa v dnevnik.
import { h, setChildren, icon, openSheet, segmented, confirmDialog, toast, selectAll } from './komponente.js';
import { renderFoodForm } from './zivilo.js';
import { availableUnits, calcNutrition, validateQuantity, BASIS_PIECE, UNIT_PIECE } from '../logic/prehrana.js';
import { filterFoods, recentFoods, lastEntryByFood, defaultQuantity } from '../logic/iskanje.js';
import { formatKcal, formatMacro, formatNumber } from '../logic/stevila.js';
import * as stanje from '../stanje.js';

const unitLabel = (u) => (u === UNIT_PIECE ? 'kos' : 'g');
const basisLabel = (f) => (f.basis === BASIS_PIECE ? 'na 1 kos' : 'na 100 g');

function foodRow(food, onPick) {
  return h('button', { class: 'row', type: 'button', onclick: () => onPick(food) },
    h('div', { class: 'row-main' },
      h('div', { class: 'row-title' }, food.name),
      h('div', { class: 'row-sub num' }, `${basisLabel(food)} · ${formatKcal(food.kcal)} kcal`),
    ),
    food.favorite ? h('span', { class: 'star on', style: 'pointer-events:none', 'aria-label': 'priljubljeno' }, icon('starOn')) : null,
  );
}

/** Odpre list za nov vnos na dan `date`. */
export async function openAddEntry(date) {
  const sheet = openSheet({ title: 'Dodaj živilo' });
  const [foods, entries] = await Promise.all([stanje.getFoods(), stanje.getEntries()]);
  const lastByFood = lastEntryByFood(entries);
  let query = '';

  const showSearch = () => {
    sheet.setTitle('Dodaj živilo');
    sheet.setLeft(h('button', { class: 'link-btn', type: 'button', onclick: () => sheet.close() }, 'Prekliči'));
    sheet.setRight();

    const input = h('input', {
      type: 'search', placeholder: 'Išči živilo …', value: query,
      autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'search', 'aria-label': 'Išči živilo',
    });
    const results = h('div');

    const render = () => {
      results.replaceChildren();
      if (foods.length === 0) {
        results.append(h('div', { class: 'empty' },
          h('strong', {}, 'Knjižnica je prazna'),
          'Najprej dodaj živilo s hranilnimi vrednostmi.'));
      } else if (query.trim()) {
        const found = filterFoods(foods, query);
        if (found.length) results.append(h('div', { class: 'list' }, found.map((f) => foodRow(f, showQuantity))));
        else results.append(h('div', { class: 'empty' }, h('strong', {}, 'Ni zadetkov'), `Za »${query.trim()}« ni živila v knjižnici.`));
      } else {
        const favs = filterFoods(foods.filter((f) => f.favorite), '');
        const recent = recentFoods(entries, foods, 10);
        if (favs.length) {
          results.append(h('div', { class: 'section-title' }, 'Priljubljena'),
            h('div', { class: 'list' }, favs.map((f) => foodRow(f, showQuantity))));
        }
        if (recent.length) {
          results.append(h('div', { class: 'section-title' }, 'Nedavno'),
            h('div', { class: 'list' }, recent.map((f) => foodRow(f, showQuantity))));
        }
        results.append(h('div', { class: 'section-title' }, 'Vsa živila'),
          h('div', { class: 'list' }, filterFoods(foods, '').map((f) => foodRow(f, showQuantity))));
      }
      results.append(h('button', {
        class: 'btn block', type: 'button', style: 'margin-top: 16px',
        onclick: () => showNewFood(query.trim()),
      }, icon('plus'), 'Novo živilo v knjižnico'));
    };

    input.addEventListener('input', () => { query = input.value; render(); sheet.body.scrollTop = 0; });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const first = query.trim() && filterFoods(foods, query)[0];
        if (first) showQuantity(first); else input.blur();
      }
    });

    setChildren(sheet.body, h('label', { class: 'search' }, icon('search'), input), results);
    render();
  };

  const showNewFood = (initialName) => {
    sheet.setTitle('Novo živilo');
    sheet.setLeft(h('button', { class: 'link-btn', type: 'button', onclick: showSearch }, 'Nazaj'));
    sheet.body.replaceChildren();
    const form = renderFoodForm(sheet.body, { initialName });
    const onSaved = (f) => { foods.push(f); toast('Živilo dodano'); showQuantity(f); };
    const doSave = async () => { const f = await form.save(); if (f) onSaved(f); };
    sheet.body.addEventListener('saved', (e) => onSaved(e.detail), { once: true });
    sheet.setRight(h('button', { class: 'link-btn', type: 'button', onclick: doSave }, 'Shrani'));
    sheet.body.append(h('button', { class: 'btn primary block', type: 'button', style: 'margin-top: 20px', onclick: doSave }, 'Shrani in nadaljuj'));
    form.focusFirst();
  };

  const showQuantity = (food) => {
    sheet.setLeft(h('button', { class: 'link-btn', type: 'button', onclick: showSearch }, 'Nazaj'));
    sheet.setRight();
    sheet.setTitle('Količina');
    renderQuantity(sheet, {
      food,
      initial: defaultQuantity(food, lastByFood.get(food.id)),
      submitText: 'Dodaj v dnevnik',
      onSubmit: async (quantity, unit) => {
        await stanje.addEntry({ date, food, quantity, unit });
        toast(`Dodano: ${food.name}`);
        sheet.close();
      },
    });
  };

  showSearch();
  return sheet;
}

/** Odpre list za urejanje obstoječega vnosa. */
export function openEditEntry(entry) {
  const sheet = openSheet({ title: 'Uredi vnos' });
  sheet.setLeft(h('button', { class: 'link-btn', type: 'button', onclick: () => sheet.close() }, 'Prekliči'));
  renderQuantity(sheet, {
    food: entry.food,
    initial: { quantity: entry.quantity, unit: entry.unit },
    submitText: 'Shrani',
    onSubmit: async (quantity, unit) => {
      await stanje.updateEntry(entry, { quantity, unit });
      toast('Vnos shranjen');
      sheet.close();
    },
    extra: h('button', {
      class: 'btn danger block', type: 'button',
      onclick: async () => {
        const ok = await confirmDialog({ title: 'Izbrišem vnos?', message: `${entry.food.name}, ${formatNumber(entry.quantity)} ${unitLabel(entry.unit)}`, confirmText: 'Izbriši', danger: true });
        if (!ok) return;
        await stanje.deleteEntry(entry.id);
        toast('Vnos izbrisan');
        sheet.close();
      },
    }, 'Izbriši vnos'),
  });
  return sheet;
}

/** Vnos količine z enoto in predogledom izračuna. */
function renderQuantity(sheet, { food, initial, submitText, onSubmit, extra }) {
  const units = availableUnits(food);
  let unit = units.includes(initial.unit) ? initial.unit : units[0];

  const input = h('input', {
    class: 'qty-input num', type: 'text', inputmode: 'decimal', enterkeyhint: 'done',
    autocomplete: 'off', value: formatNumber(initial.quantity), 'aria-label': 'Količina',
  });
  const error = h('div', { class: 'field-error', 'aria-live': 'polite' });
  const cell = (cls, label) => {
    const v = h('div', { class: 'v num' }, '–');
    return { el: h('div', { class: cls }, v, h('div', { class: 'l' }, label)), v };
  };
  const pk = cell('k', 'kcal');
  const pp = cell('p', 'Beljak. g');
  const pf = cell('f', 'Maščobe g');
  const pc = cell('c', 'OH g');
  const submit = h('button', { class: 'btn primary block', type: 'button' }, submitText);

  const update = () => {
    const q = validateQuantity(input.value);
    const n = q.error ? null : calcNutrition(food, q.value, unit);
    pk.v.textContent = n ? formatKcal(n.kcal) : '–';
    pp.v.textContent = n ? formatMacro(n.protein) : '–';
    pf.v.textContent = n ? formatMacro(n.fat) : '–';
    pc.v.textContent = n ? formatMacro(n.carbs) : '–';
    submit.disabled = !n;
    return q;
  };

  const doSubmit = async () => {
    const q = update();
    if (q.error) { error.textContent = q.error; input.focus(); return; }
    error.textContent = '';
    submit.disabled = true;
    try { await onSubmit(q.value, unit); } catch (e) { error.textContent = e.message; submit.disabled = false; }
  };

  input.addEventListener('input', () => { error.textContent = ''; update(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSubmit(); } });
  submit.addEventListener('click', doSubmit);

  const unitPicker = units.length > 1
    ? segmented(units.map((u) => ({ value: u, label: unitLabel(u) })), unit, (v) => {
      // pri menjavi enote pretvori količino, da ostane enaka porcija
      const q = validateQuantity(input.value);
      if (!q.error && food.pieceWeight > 0 && v !== unit) {
        const converted = v === UNIT_PIECE ? q.value / food.pieceWeight : q.value * food.pieceWeight;
        input.value = formatNumber(converted);
      }
      unit = v;
      update();
      input.focus();
      selectAll(input);
    }, 'Enota')
    : h('div', { class: 'segmented' }, h('button', { type: 'button', 'aria-pressed': 'true', disabled: true }, unitLabel(unit)));

  const basisInfo = `${formatKcal(food.kcal)} kcal ${basisLabel(food)}`
    + (food.pieceWeight > 0 ? ` · 1 kos = ${formatNumber(food.pieceWeight)} g` : '');

  setChildren(sheet.body,
    h('div', { class: 'qty-food' }, food.name),
    h('div', { class: 'qty-basis num' }, basisInfo),
    h('div', { class: 'qty-row' }, input, unitPicker),
    error,
    h('div', { class: 'preview' }, pk.el, pp.el, pf.el, pc.el),
    submit,
    extra || null,
  );
  update();
  input.focus();
  selectAll(input);
}
