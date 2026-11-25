// Zaslon »Danes«.
import { h, setChildren } from './komponente.js';
import { dayView } from './dan.js';
import { todayKey, formatDayLong } from '../logic/datumi.js';
import { backupDue } from '../logic/nastavitve.js';
import * as stanje from '../stanje.js';

export async function render(root, ctx) {
  const date = todayKey();
  const settings = stanje.settings();

  let backupNotice = null;
  if (backupDue(settings, date, (await stanje.getEntries()).length > 0)) {
    backupNotice = h('div', { class: 'notice', role: 'note' },
      'Podatki so shranjeni samo na tem telefonu. Varnostne kopije ni bilo že več kot 14 dni.',
      h('div', {}, h('button', { class: 'link-btn', type: 'button', onclick: () => ctx.navigate('nastavitve') }, 'Izvozi varnostno kopijo')),
    );
  }

  setChildren(root,
    h('div', { class: 'screen-head' },
      h('h1', {}, 'Danes'),
      h('div', { class: 'sub' }, formatDayLong(date)),
    ),
    backupNotice,
    await dayView(date, { emptyTitle: 'Danes še ni vnosov' }),
  );
}
