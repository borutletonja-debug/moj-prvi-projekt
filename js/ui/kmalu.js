// Začasni zasloni za zavihke iz kasnejših faz.
import { h, setChildren, icon } from './komponente.js';

const TEXT = {
  teza: {
    title: 'Teža',
    icon: 'weight',
    body: 'Vnos teže, graf s trendno črto, ocena porabe (TDEE) in priporočen vnos. Prihaja v fazi 3.',
  },
};

export function render(root, ctx, name) {
  const t = TEXT[name];
  setChildren(root,
    h('div', { class: 'screen-head' }, h('h1', {}, t.title)),
    h('div', { class: 'card placeholder' }, icon(t.icon), h('h2', {}, 'Kmalu'), h('p', {}, t.body)),
  );
}
