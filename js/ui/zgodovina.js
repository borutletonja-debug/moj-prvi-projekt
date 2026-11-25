// Zaslon »Zgodovina«: dnevi po tednih s povzetki in podrobnosti dne.
import { h, setChildren, icon, macroChips } from './komponente.js';
import { dayView } from './dan.js';
import { buildWeeks } from '../logic/tedni.js';
import { goalsForDate } from '../logic/nastavitve.js';
import { formatKcal, formatMacro } from '../logic/stevila.js';
import { todayKey, formatDayLong, formatDayShort, formatWeekRange, formatDateShort, isValidDateKey } from '../logic/datumi.js';
import { count, plural } from '../logic/besedilo.js';
import * as stanje from '../stanje.js';

const DAN = ['dan', 'dneva', 'dni', 'dni'];

export async function render(root, ctx, param) {
  if (param && isValidDateKey(param) && param <= todayKey()) return renderDay(root, ctx, param);
  return renderList(root, ctx);
}

// ----- Podrobnosti dne -----
async function renderDay(root, ctx, date) {
  const today = todayKey();
  setChildren(root,
    h('button', { class: 'back-btn', type: 'button', onclick: () => ctx.navigate('zgodovina') }, icon('back'), 'Zgodovina'),
    h('div', { class: 'screen-head' },
      h('h1', {}, date === today ? 'Danes' : formatDateShort(date)),
      h('div', { class: 'sub' }, formatDayLong(date)),
    ),
    await dayView(date),
  );
}

// ----- Seznam tednov -----
async function renderList(root, ctx) {
  const settings = stanje.settings();
  const today = todayKey();
  const [entries, dayFlags] = await Promise.all([stanje.getEntries(), stanje.getDays()]);
  const weeks = buildWeeks({
    entries, dayFlags, today,
    goalsForDate: (d) => goalsForDate(settings, d),
    tolerancePct: settings.tolerancePct,
  });

  // Odpri poljuben pretekli dan (tudi brez vnosov), npr. za naknadni vpis.
  const datePicker = h('input', { type: 'date', max: today, value: today, class: 'date-input', 'aria-label': 'Izberi dan' });
  datePicker.addEventListener('change', () => {
    if (isValidDateKey(datePicker.value) && datePicker.value <= today) ctx.navigate(`zgodovina/${datePicker.value}`);
  });
  const head = h('div', { class: 'screen-head head-row' },
    h('h1', {}, 'Zgodovina'),
    h('label', { class: 'date-pick' }, h('span', {}, 'Odpri dan'), datePicker),
  );
  if (!weeks.length) {
    setChildren(root, head, h('div', { class: 'list' }, h('div', { class: 'empty' },
      h('strong', {}, 'Zgodovina je še prazna'),
      'Ko dodaš prvi vnos, se tukaj pokažejo dnevi in tedenski povzetki.')));
    return;
  }

  setChildren(root, head, weeks.map((w) => weekBlock(w, ctx, settings.tolerancePct)));
}

function weekBlock(w, ctx, tolerancePct) {
  return h('section', { class: 'week', 'aria-label': `Teden ${formatWeekRange(w.start)}` },
    h('div', { class: 'week-head' },
      h('h2', {}, formatWeekRange(w.start)),
      w.inProgress ? h('span', { class: 'badge progress' }, 'v teku') : null,
    ),
    h('div', { class: 'list' }, w.days.map((d) => h('button', {
      class: 'row', type: 'button', onclick: () => ctx.navigate(`zgodovina/${d.date}`),
    },
    h('div', { class: 'row-main' },
      h('div', { class: 'row-title day-title' }, d.isToday ? 'Danes' : formatDayShort(d.date)),
      h('div', { class: 'row-sub' },
        count(d.count, ['vnos', 'vnosa', 'vnosi', 'vnosov']),
        d.incomplete ? h('span', { class: 'badge warn', style: 'margin-left: 8px' }, 'nepopoln') : null,
      ),
    ),
    h('div', { class: 'row-end' },
      h('div', { class: 'row-kcal num' }, formatKcal(d.kcal), h('small', {}, 'kcal')),
      macroChips(d),
    ),
    h('span', { class: 'chev', 'aria-hidden': 'true' }, '›')))),
    weekSummary(w, tolerancePct),
  );
}

function weekSummary(w, tolerancePct) {
  const s = w.summary;
  const title = h('div', { class: 'summary-title' }, w.inProgress ? 'Povzetek tedna (v teku)' : 'Povzetek tedna');

  if (s.countedDays === 0) {
    return h('div', { class: 'card summary' }, title,
      h('p', { class: 'muted small', style: 'margin: 6px 0 0' },
        w.inProgress
          ? 'Povprečje se izračuna, ko je končan vsaj en popoln dan. Današnji dan še ne šteje.'
          : 'V tem tednu ni popolnih dni, zato povprečja ni.'));
  }

  const g = s.goal;
  let goalLine = null;
  if (g) {
    const abs = formatKcal(Math.abs(g.diffKcal));
    const text = Math.round(g.diffKcal) === 0
      ? 'točno na cilju'
      : `${abs} kcal na dan ${g.diffKcal > 0 ? 'nad ciljem' : 'pod ciljem'}`;
    const badge = g.status === 'met'
      ? h('span', { class: 'badge ok' }, 'Cilj dosežen')
      : h('span', { class: `badge ${g.status === 'over' ? 'bad' : 'warn'}` }, g.status === 'over' ? 'Nad ciljem' : 'Pod ciljem');
    goalLine = h('div', { class: 'summary-line' },
      h('div', {},
        h('div', { class: 'num' }, text),
        h('div', { class: 'muted small num' }, `cilj ${formatKcal(s.goalKcal)} kcal, toleranca ±${formatMacro(tolerancePct).replace(/,0$/, '')} %`),
      ),
      badge,
    );
  }

  const notes = [`Upoštevano: ${s.countedDays} ${plural(s.countedDays, DAN)}`];
  if (s.incompleteDays) notes.push(`${s.incompleteDays} ${plural(s.incompleteDays, ['nepopoln', 'nepopolna', 'nepopolni', 'nepopolnih'])}`);
  if (w.days.some((d) => d.isToday)) notes.push('današnji dan še ne šteje');

  return h('div', { class: 'card summary' },
    title,
    h('div', { class: 'summary-grid' },
      h('div', {},
        h('div', { class: 'summary-val num' }, formatKcal(s.avgKcal), h('small', {}, ' kcal')),
        h('div', { class: 'summary-lbl' }, 'povprečno na dan'),
      ),
      h('div', {},
        h('div', { class: 'summary-val num protein' }, formatMacro(s.avgProtein), h('small', {}, ' g')),
        h('div', { class: 'summary-lbl' }, 'beljakovin na dan'),
      ),
    ),
    goalLine,
    h('div', { class: 'summary-line' },
      h('div', {},
        h('div', {}, 'Deficit ali presežek glede na porabo'),
        h('div', { class: 'muted small' }, 'Na voljo v fazi 3, ko bo dodano spremljanje teže.'),
      ),
    ),
    h('div', { class: 'muted small', style: 'margin-top: 10px' }, notes.join(' · ')),
  );
}
