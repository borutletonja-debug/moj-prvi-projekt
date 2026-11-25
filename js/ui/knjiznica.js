// Zaslon »Knjižnica živil«.
import { h, setChildren, icon, toast } from './komponente.js';
import { openFoodSheet } from './zivilo.js';
import { filterFoods } from '../logic/iskanje.js';
import { formatKcal, formatMacro, formatNumber } from '../logic/stevila.js';
import { BASIS_PIECE } from '../logic/prehrana.js';
import { count, ZIVILO } from '../logic/besedilo.js';
import * as stanje from '../stanje.js';

let query = '';

export async function render(root) {
  const foods = await stanje.getFoods();

  const input = h('input', {
    type: 'search', placeholder: 'Išči po imenu …', value: query,
    autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'search', 'aria-label': 'Išči živilo',
  });
  const listWrap = h('div');

  const row = (f) => {
    const star = h('button', {
      class: `star${f.favorite ? ' on' : ''}`, type: 'button',
      'aria-label': f.favorite ? `Odstrani »${f.name}« iz priljubljenih` : `Dodaj »${f.name}« med priljubljena`,
      'aria-pressed': String(!!f.favorite),
      onclick: async (e) => {
        e.stopPropagation();
        const updated = await stanje.toggleFavorite(f);
        toast(updated.favorite ? 'Dodano med priljubljena' : 'Odstranjeno iz priljubljenih');
      },
    }, icon(f.favorite ? 'starOn' : 'star'));
    const per = f.basis === BASIS_PIECE ? 'na 1 kos' : 'na 100 g';
    const pw = f.pieceWeight > 0 ? ` · kos ${formatNumber(f.pieceWeight)} g` : '';
    return h('div', { class: 'row tappable', role: 'button', tabindex: '0', onclick: () => openFoodSheet({ food: f }),
      onkeydown: (e) => { if (e.key === 'Enter') openFoodSheet({ food: f }); } },
    h('div', { class: 'row-main' },
      h('div', { class: 'row-title' }, f.name),
      h('div', { class: 'row-sub num' }, `${formatKcal(f.kcal)} kcal ${per}${pw}`),
      h('div', { class: 'macro-chips num' },
        h('span', { class: 'chip-p' }, `B ${formatMacro(f.protein)}`),
        h('span', { class: 'chip-f' }, `M ${formatMacro(f.fat)}`),
        h('span', { class: 'chip-c' }, `OH ${formatMacro(f.carbs)}`),
      ),
    ),
    star);
  };

  const renderList = () => {
    if (foods.length === 0) {
      listWrap.replaceChildren(h('div', { class: 'list' }, h('div', { class: 'empty' },
        h('strong', {}, 'Knjižnica je prazna'),
        'Dodaj živila, ki jih pogosto ješ. Vrednosti najdeš na embalaži.')));
      return;
    }
    const found = filterFoods(foods, query);
    const favs = found.filter((f) => f.favorite);
    const rest = found.filter((f) => !f.favorite);
    const parts = [];
    if (!found.length) {
      parts.push(h('div', { class: 'list' }, h('div', { class: 'empty' }, h('strong', {}, 'Ni zadetkov'), `Za »${query.trim()}« ni živila.`)));
    }
    if (favs.length) parts.push(h('div', { class: 'section-title' }, 'Priljubljena'), h('div', { class: 'list' }, favs.map(row)));
    if (rest.length) parts.push(h('div', { class: 'section-title' }, favs.length ? 'Ostala živila' : `Živila (${rest.length})`), h('div', { class: 'list' }, rest.map(row)));
    listWrap.replaceChildren(...parts);
  };

  input.addEventListener('input', () => { query = input.value; renderList(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });

  setChildren(root,
    h('div', { class: 'screen-head' },
      h('h1', {}, 'Knjižnica'),
      h('div', { class: 'sub' }, count(foods.length, ZIVILO)),
    ),
    foods.length ? h('label', { class: 'search' }, icon('search'), input) : null,
    listWrap,
    h('button', { class: 'fab', type: 'button', onclick: () => openFoodSheet() }, icon('plus'), 'Živilo'),
  );
  renderList();
}

