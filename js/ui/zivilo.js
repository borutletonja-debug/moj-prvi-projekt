// Obrazec za dodajanje in urejanje živila.
import { h, field, segmented, chainInputs, confirmDialog, openSheet, toast } from './komponente.js';
import { validateFood, BASIS_100G, BASIS_PIECE } from '../logic/prehrana.js';
import { formatNumber } from '../logic/stevila.js';
import { VNOS_MESTNIK, plural } from '../logic/besedilo.js';
import * as stanje from '../stanje.js';

const fmt = (n) => (n === null || n === undefined ? '' : formatNumber(n, 2));

/**
 * Nariše obrazec v `container`.
 * Vrne { save } – save() validira in shrani, vrne shranjeno živilo ali null.
 */
export function renderFoodForm(container, { food = null, initialName = '' } = {}) {
  let basis = food?.basis ?? BASIS_100G;

  const name = field({ label: 'Ime živila', type: 'text', value: food?.name ?? initialName, placeholder: 'npr. Grški jogurt' });
  const kcal = field({ label: 'Kalorije', value: fmt(food?.kcal), suffix: 'kcal', placeholder: '0' });
  const protein = field({ label: 'Beljakovine', value: fmt(food?.protein), suffix: 'g', placeholder: '0' });
  const fat = field({ label: 'Maščobe', value: fmt(food?.fat), suffix: 'g', placeholder: '0' });
  const carbs = field({ label: 'Ogljikovi hidrati', value: fmt(food?.carbs), suffix: 'g', placeholder: '0' });
  const pieceWeight = field({
    label: 'Teža enega kosa (neobvezno)', value: fmt(food?.pieceWeight), suffix: 'g', placeholder: 'npr. 60', help: '',
  });

  const basisNote = h('div', { class: 'field-help', style: 'padding: 0 4px 4px' });
  const updateBasisText = () => {
    const per = basis === BASIS_PIECE ? 'na 1 kos' : 'na 100 g';
    basisNote.textContent = `Vpiši vrednosti ${per}.`;
    pieceWeight.setHelp(basis === BASIS_PIECE
      ? 'Če jo vpišeš, lahko količino vneseš tudi v gramih.'
      : 'Če jo vpišeš, lahko količino vneseš tudi v kosih (npr. jajce = 60 g).');
  };

  const basisPicker = segmented(
    [{ value: BASIS_100G, label: 'na 100 g' }, { value: BASIS_PIECE, label: 'na 1 kos' }],
    basis,
    (v) => { basis = v; updateBasisText(); },
    'Osnova vrednosti',
  );
  updateBasisText();

  container.append(
    h('div', { class: 'list' }, name.el),
    h('div', { class: 'section-title' }, 'Hranilne vrednosti'),
    h('div', { style: 'margin-bottom: 8px' }, basisPicker),
    basisNote,
    h('div', { class: 'list' }, kcal.el, protein.el, fat.el, carbs.el),
    h('div', { class: 'list', style: 'margin-top: 14px' }, pieceWeight.el),
  );

  const fields = { name, kcal, protein, fat, carbs, pieceWeight };

  async function save() {
    const r = validateFood({
      name: name.value, basis, kcal: kcal.value, protein: protein.value,
      fat: fat.value, carbs: carbs.value, pieceWeight: pieceWeight.value,
    });
    for (const [k, f] of Object.entries(fields)) f.setError(r.errors[k]);
    if (!r.ok) {
      const firstBad = Object.keys(fields).find((k) => r.errors[k]);
      fields[firstBad]?.input.focus();
      return null;
    }
    return stanje.saveFood(r.value, food);
  }

  chainInputs([name.input, kcal.input, protein.input, fat.input, carbs.input, pieceWeight.input], () => save().then((f) => f && container.dispatchEvent(new CustomEvent('saved', { detail: f }))));

  return { save, focusFirst: () => name.input.focus() };
}

/** Samostojni list za urejanje / dodajanje živila (iz knjižnice). */
export function openFoodSheet({ food = null } = {}) {
  const sheet = openSheet({ title: food ? 'Uredi živilo' : 'Novo živilo' });
  const form = renderFoodForm(sheet.body, { food });

  const doSave = async () => {
    const saved = await form.save();
    if (saved) {
      toast(food ? 'Živilo shranjeno' : 'Živilo dodano');
      sheet.close();
    }
  };
  sheet.body.addEventListener('saved', () => { toast(food ? 'Živilo shranjeno' : 'Živilo dodano'); sheet.close(); });

  sheet.setLeft(h('button', { class: 'link-btn', type: 'button', onclick: () => sheet.close() }, 'Prekliči'));
  sheet.setRight(h('button', { class: 'link-btn', type: 'button', onclick: doSave }, 'Shrani'));

  sheet.body.append(h('div', { style: 'margin-top: 20px' },
    h('button', { class: 'btn primary block', type: 'button', onclick: doSave }, 'Shrani'),
    food ? h('button', {
      class: 'btn danger block', type: 'button',
      onclick: async () => {
        const used = await stanje.foodUsageCount(food.id);
        const msg = used > 0
          ? `Živilo je uporabljeno v ${used} ${plural(used, VNOS_MESTNIK)} v dnevniku.\nPretekli vnosi ostanejo nespremenjeni, živila pa ne bo več v knjižnici.`
          : 'Živilo bo odstranjeno iz knjižnice.';
        const ok = await confirmDialog({ title: `Izbrišem »${food.name}«?`, message: msg, confirmText: 'Izbriši', danger: true });
        if (!ok) return;
        await stanje.deleteFood(food.id);
        toast('Živilo izbrisano');
        sheet.close();
      },
    }, 'Izbriši živilo') : null,
  ));

  if (!food) form.focusFirst();
  return sheet;
}

