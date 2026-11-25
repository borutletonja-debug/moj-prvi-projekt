// Zaslon »Teža«: meritve, graf s trendom, ocena porabe (TDEE) in priporočen vnos.
import { h, setChildren, icon, field, segmented, openSheet, confirmDialog, toast, selectAll } from './komponente.js';
import { weightChart } from './graf.js';
import { buildOverview } from '../logic/pregled.js';
import { validateWeight } from '../logic/teza.js';
import { MIN, WINDOW_DAYS } from '../logic/tdee.js';
import { withGoalChange } from '../logic/nastavitve.js';
import { formatKcal, formatMacro, formatNumber, formatSigned } from '../logic/stevila.js';
import { todayKey, addDays, formatDateShort, formatDayShort, isValidDateKey, parseDateKey } from '../logic/datumi.js';
import * as stanje from '../stanje.js';

let range = '90';
let showAll = false;

const kg = (n) => `${formatMacro(n)} kg`;
const dm = (key) => { const d = parseDateKey(key); return `${d.getDate()}. ${d.getMonth() + 1}.`; };

export async function render(root, ctx) {
  const today = todayKey();
  const settings = stanje.settings();
  const [entries, dayFlags, weights] = await Promise.all([stanje.getEntries(), stanje.getDays(), stanje.getWeights()]);
  const o = buildOverview({ entries, dayFlags, weights, settings, today });
  const trend = o.ctx.trend;

  const fab = h('button', { class: 'fab', type: 'button', onclick: () => openWeightSheet({ weights }) }, icon('plus'), 'Teža');
  const head = h('div', { class: 'screen-head' }, h('h1', {}, 'Teža'));

  setChildren(root,
    head,
    trend.length ? currentCard(o, settings, trend) : h('div', { class: 'list' }, h('div', { class: 'empty' },
      h('strong', {}, 'Še ni meritev teže'),
      'Dotakni se »+ Teža« in vpiši prvo meritev. Ni se treba tehtati vsak dan.')),
    trend.length ? chartCard(trend, today, settings, () => ctx.rerender()) : null,
    tdeeCard(o, settings, ctx),
    recommendationCard(o, settings, today),
    o.table.length ? tableCard(o.table) : null,
    trend.length ? measurementList(trend, weights, () => ctx.rerender()) : null,
    fab,
  );
}

// ----- Trenutno stanje -----
function currentCard(o, settings, trend) {
  const last = trend[trend.length - 1];
  const target = settings.weightGoal.targetKg;
  const perWeek = o.recentRate.slopeKgPerDay !== null && o.recentRate.spanDays >= 7 ? o.recentRate.slopeKgPerDay * 7 : null;
  const rows = [
    h('div', { class: 'kv' }, h('span', { class: 'k' }, 'Zadnja meritev'), h('span', { class: 'num' }, `${kg(last.kg)} · ${formatDateShort(last.date)}`)),
  ];
  if (perWeek !== null) {
    rows.push(h('div', { class: 'kv' }, h('span', { class: 'k' }, `Tempo (zadnjih ${WINDOW_DAYS} dni)`), h('span', { class: 'num' }, `${formatSigned(perWeek, 2)} kg/teden`)));
  }
  if (Number.isFinite(target)) {
    const diff = last.trend - target;
    rows.push(h('div', { class: 'kv' }, h('span', { class: 'k' }, `Do cilja (${kg(target)})`),
      h('span', { class: 'num' }, Math.abs(diff) < 0.05 ? 'dosežen' : `še ${formatMacro(Math.abs(diff))} kg`)));
  }
  return h('section', { class: 'card', 'aria-label': 'Trenutna teža', style: 'padding-bottom: 4px' },
    h('div', { class: 'summary-lbl' }, 'Trendna teža'),
    h('div', { class: 'big-val num' }, formatMacro(last.trend), h('small', {}, ' kg')),
    h('div', { class: 'kv-list' }, rows),
  );
}

// ----- Graf -----
function chartCard(trend, today, settings, rerender) {
  const from = range === 'all' ? null : addDays(today, -Number(range));
  let pts = from ? trend.filter((p) => p.date >= from) : trend;
  if (!pts.length) pts = trend.slice(-1);
  return h('section', { class: 'card', 'aria-label': 'Graf teže' },
    segmented([{ value: '30', label: '1 mesec' }, { value: '90', label: '3 meseci' }, { value: 'all', label: 'Vse' }],
      range, (v) => { range = v; rerender(); }, 'Obdobje'),
    h('div', { style: 'margin-top: 12px' }, weightChart(pts, { today, targetKg: settings.weightGoal.targetKg })),
  );
}

// ----- Ocena porabe -----
const LEVELS = {
  initial: { badge: 'Začetna ocena', cls: 'warn' },
  partial: { badge: 'Delna ocena', cls: 'progress' },
  reliable: { badge: 'Zanesljiva ocena', cls: 'ok' },
};

function check(label, value, min, unit) {
  const ok = value >= min;
  return h('div', { class: `check${ok ? ' ok' : ''}` },
    h('span', { class: 'mark', 'aria-hidden': 'true' }, ok ? '✓' : '○'),
    h('span', {}, label),
    h('span', { class: 'num' }, `${value} / ${min}${unit ? ` ${unit}` : ''}`),
  );
}

function tdeeCard(o, settings, ctx) {
  const e = o.estimate;
  const c = e.current;
  const title = h('div', { class: 'summary-title' }, 'Ocena dnevne porabe (TDEE)');

  const checks = h('div', { class: 'checks' },
    h('div', { class: 'muted small', style: 'margin-bottom: 6px' }, `Podatki v zadnjih ${WINDOW_DAYS} dneh za oceno iz meritev:`),
    check('Razpon med meritvami teže', c.spanDays, MIN.spanDays, 'dni'),
    check('Popolni dnevi z vnosi hrane', c.completeDays, MIN.completeDays),
    check('Meritve teže', c.measurements, MIN.measurements),
  );

  if (e.level === 'none') {
    return h('section', { class: 'card', 'aria-label': 'Ocena porabe' }, title,
      h('p', { class: 'muted', style: 'margin: 8px 0 12px' },
        'Za začetno oceno vpiši osebne podatke (spol, letnica rojstva, višina, aktivnost) in vsaj eno meritev teže.'),
      h('button', { class: 'btn block', type: 'button', onclick: () => ctx.navigate('nastavitve') }, 'Odpri nastavitve'),
      checks);
  }

  const lv = LEVELS[e.level];
  let explain;
  if (e.level === 'initial') {
    explain = 'Ocena je začetna: izračunana po formuli Mifflin-St Jeor × faktor aktivnosti. Ko bo podatkov dovolj, jo postopoma zamenja ocena iz tvojih vnosov in meritev. Točna postane po 2–3 tednih rednega beleženja.';
  } else if (e.level === 'partial') {
    const pct = Math.round(e.weight * 100);
    explain = `Ocena je mešanica tvojih meritev (${pct} %) in formule (${100 - pct} %). Z več podatki se bo naslanjala samo na meritve.`;
  } else {
    explain = `Ocena temelji na tvojih vnosih hrane in meritvah teže v zadnjih ${WINDOW_DAYS} dneh in je zglajena čez zadnje tedne.`;
  }

  const parts = [];
  if (c.avgIntake !== null) {
    parts.push(h('div', { class: 'kv' }, h('span', { class: 'k' }, `Povprečni vnos (${c.completeDays} popolnih dni)`), h('span', { class: 'num' }, `${formatKcal(c.avgIntake)} kcal`)));
  }
  if (c.slopeKgPerDay !== null) {
    parts.push(h('div', { class: 'kv' }, h('span', { class: 'k' }, `Sprememba teže (${c.measurements} meritev)`), h('span', { class: 'num' }, `${formatSigned(c.slopeKgPerDay * 7, 2)} kg/teden`)));
  }
  if (e.adaptive !== null) {
    parts.push(h('div', { class: 'kv' }, h('span', { class: 'k' }, 'Ocena iz meritev (zglajena)'), h('span', { class: 'num' }, `${formatKcal(e.adaptive)} kcal`)));
  }
  if (e.initial !== null) {
    parts.push(h('div', { class: 'kv' }, h('span', { class: 'k' }, 'Začetna ocena (formula)'), h('span', { class: 'num' }, `${formatKcal(e.initial)} kcal`)));
  }

  return h('section', { class: 'card', 'aria-label': 'Ocena porabe' },
    h('div', { class: 'card-head' }, title, h('span', { class: `badge ${lv.cls}` }, lv.badge)),
    h('div', { class: 'big-val num' }, formatKcal(e.tdee), h('small', {}, ' kcal/dan')),
    h('p', { class: 'muted small', style: 'margin: 8px 0 0' }, explain),
    c.implausible ? h('div', { class: 'notice', style: 'margin: 12px 0 0' },
      'Izračun iz meritev je dal nesmiselno vrednost, zato ni upoštevan. Preveri, ali je katera meritev teže napačno vpisana.') : null,
    checks,
    parts.length ? h('div', {}, h('div', { class: 'summary-title', style: 'margin-top: 16px' }, 'Iz česa je izračun'), h('div', { class: 'kv-list' }, parts)) : null,
  );
}

// ----- Priporočen vnos -----
function recommendationCard(o, settings, today) {
  const r = o.recommendation;
  if (!r) return null;
  const goal = settings.goals.kcal;
  const wg = settings.weightGoal;
  const rateTxt = o.rate === 0
    ? 'vzdrževanje teže'
    : `${o.rate < 0 ? 'hujšanje' : 'pridobivanje'} ${formatNumber(Math.abs(o.rate))} kg/teden`;
  const formula = o.rate === 0
    ? `poraba ${formatKcal(o.estimate.tdee)} kcal (${rateTxt})`
    : `poraba ${formatKcal(o.estimate.tdee)} ${o.rate < 0 ? '−' : '+'} ${formatKcal(Math.abs(r.adjustment))} kcal (${rateTxt})`;

  const warnings = [];
  if (r.tooFast) {
    warnings.push(`Želeni tempo hujšanja (${formatNumber(Math.abs(o.rate))} kg/teden) je večji od 1 % telesne teže na teden (${formatNumber(r.maxSafeRate, 1)} kg). Izberi počasnejši tempo.`);
  }
  if (r.belowFloor) {
    warnings.push(`Izračunani vnos (${formatKcal(r.target)} kcal) je pod varno mejo ${r.floor} kcal, zato ga aplikacija ne predlaga. Predlog je omejen na ${r.floor} kcal. Razmisli o počasnejšem tempu.`);
  }
  if (o.estimate.level === 'initial') {
    warnings.push('Predlog temelji na začetni oceni porabe. Natančnejši bo po 2–3 tednih rednega beleženja hrane in teže.');
  }

  const same = Math.round(goal) === r.recommended;
  const btn = h('button', {
    class: 'btn primary block', type: 'button', disabled: same,
    onclick: async () => {
      const ok = await confirmDialog({
        title: 'Posodobim kalorični cilj?',
        message: `Dnevni cilj se spremeni z ${formatKcal(goal)} na ${formatKcal(r.recommended)} kcal.\nCilji makrohranil ostanejo nespremenjeni.`,
        confirmText: 'Posodobi',
      });
      if (!ok) return;
      await stanje.saveSettings(withGoalChange(settings, { ...settings.goals, kcal: r.recommended }, today));
      toast('Kalorični cilj posodobljen');
    },
  }, same ? 'Cilj je že usklajen s predlogom' : 'Posodobi kalorični cilj');

  return h('section', { class: 'card', 'aria-label': 'Priporočen vnos' },
    h('div', { class: 'summary-title' }, 'Priporočen dnevni vnos'),
    h('div', { class: 'big-val num accent' }, formatKcal(r.recommended), h('small', {}, ' kcal/dan')),
    h('p', { class: 'muted small num', style: 'margin: 6px 0 0' }, formula),
    wg.direction === 'maintain' && !Number.isFinite(wg.targetKg)
      ? h('p', { class: 'muted small', style: 'margin: 6px 0 0' }, 'Cilj teže in želeni tempo nastaviš v Nastavitvah.') : null,
    warnings.map((w) => h('div', { class: 'notice', style: 'margin: 12px 0 0' }, w)),
    h('div', { class: 'kv-list', style: 'margin-bottom: 12px' },
      h('div', { class: 'kv' }, h('span', { class: 'k' }, 'Trenutni kalorični cilj'), h('span', { class: 'num' }, `${formatKcal(goal)} kcal`))),
    btn,
    h('p', { class: 'muted small', style: 'margin: 8px 0 0' }, 'Predlog se nikoli ne uveljavi sam. Cilj se spremeni šele, ko pritisneš gumb.'),
  );
}

// ----- Tedenska tabela -----
function tableCard(rows) {
  const td = (text, cls) => h('td', { class: `num${cls ? ` ${cls}` : ''}` }, text);
  return h('section', { class: 'card', 'aria-label': 'Tedenska tabela', style: 'padding: 16px 10px' },
    h('div', { class: 'summary-title', style: 'margin: 0 6px 8px' }, 'Po tednih'),
    h('table', { class: 'wk-table' },
      h('thead', {}, h('tr', {},
        h('th', {}, 'Teden'), h('th', {}, 'Trend kg'), h('th', {}, 'Sprem.'), h('th', {}, 'Vnos kcal'), h('th', {}, 'Bilanca'))),
      h('tbody', {}, rows.slice(0, 12).map((r) => h('tr', {},
        h('td', {}, h('div', { class: 'num' }, `${dm(r.start)}–${dm(r.end)}`),
          h('div', { class: 'muted tiny' }, r.inProgress ? 'v teku' : `${r.measurements} mer.`)),
        td(r.trend !== null ? formatMacro(r.trend) : '–'),
        td(r.change !== null ? formatSigned(r.change, 1) : '–'),
        td(r.avgKcal !== null ? formatKcal(r.avgKcal) : '–'),
        td(r.balance !== null ? formatSigned(r.balance, 0) : '–', r.balance === null ? '' : r.balance < 0 ? 'neg' : 'pos'),
      ))),
    ),
    h('p', { class: 'muted small', style: 'margin: 10px 6px 0' },
      'Sprememba je glede na trend prejšnjega tedna. Bilanca je povprečni dnevni vnos minus ocenjena poraba: minus pomeni deficit, plus presežek.'),
  );
}

// ----- Seznam meritev -----
function measurementList(trend, weights, rerender) {
  const byDate = new Map(weights.map((w) => [w.date, w]));
  const all = [...trend].reverse();
  const shown = showAll ? all : all.slice(0, 10);
  return h('div', {},
    h('div', { class: 'section-title' }, `Meritve (${all.length})`),
    h('div', { class: 'list' }, shown.map((p) => h('button', {
      class: 'row', type: 'button', onclick: () => openWeightSheet({ weights, weight: byDate.get(p.date) }),
    },
    h('div', { class: 'row-main' },
      h('div', { class: 'row-title day-title' }, `${formatDayShort(p.date)} ${p.date.slice(0, 4)}`),
      h('div', { class: 'row-sub num' }, `trend ${kg(p.trend)}`),
    ),
    h('div', { class: 'row-end' }, h('div', { class: 'row-kcal num' }, formatNumber(p.kg, 2), h('small', {}, 'kg'))),
    h('span', { class: 'chev', 'aria-hidden': 'true' }, '›')))),
    all.length > 10 && !showAll
      ? h('button', { class: 'btn block', type: 'button', style: 'margin-top: 10px', onclick: () => { showAll = true; rerender(); } }, 'Pokaži vse meritve')
      : null,
  );
}

// ----- Vnos / urejanje meritve -----
function openWeightSheet({ weights, weight = null }) {
  const today = todayKey();
  const sheet = openSheet({ title: weight ? 'Uredi meritev' : 'Nova meritev' });
  const dateInput = h('input', { type: 'date', class: 'date-field', value: weight?.date ?? today, max: today, 'aria-label': 'Datum' });
  const last = weights.length ? [...weights].sort((a, b) => b.date.localeCompare(a.date))[0] : null;
  const kgField = field({ label: 'Teža', value: weight ? formatNumber(weight.kg, 2) : '', suffix: 'kg', placeholder: last ? formatNumber(last.kg, 1) : 'npr. 80,5' });
  kgField.input.setAttribute('enterkeyhint', 'done');
  const dateError = h('div', { class: 'field-error', style: 'padding: 0 16px 8px' });
  dateError.hidden = true;

  const save = async () => {
    const date = dateInput.value;
    const dateOk = isValidDateKey(date) && date <= today;
    dateError.textContent = dateOk ? '' : 'Izberi datum, ki ni v prihodnosti.';
    dateError.hidden = dateOk;
    const r = validateWeight(kgField.value);
    kgField.setError(r.error ? (r.value === null && kgField.value.trim() === '' ? 'Vpiši težo.' : 'Vpiši težo v kilogramih (npr. 80,5).') : null);
    if (!dateOk || r.error) { if (r.error) kgField.input.focus(); return; }
    const existing = weights.find((w) => w.date === date && w.id !== weight?.id);
    if (existing) {
      const ok = await confirmDialog({
        title: 'Zamenjam meritev?',
        message: `Za ${formatDateShort(date)} je že vpisana teža ${formatNumber(existing.kg, 2)} kg. Na dan je lahko ena meritev.`,
        confirmText: 'Zamenjaj',
      });
      if (!ok) return;
    }
    await stanje.saveWeight({ id: weight?.id, date, kg: r.value });
    toast('Teža shranjena');
    sheet.close();
  };

  kgField.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } });
  sheet.setLeft(h('button', { class: 'link-btn', type: 'button', onclick: () => sheet.close() }, 'Prekliči'));
  sheet.setRight(h('button', { class: 'link-btn', type: 'button', onclick: save }, 'Shrani'));
  setChildren(sheet.body,
    h('div', { class: 'list' },
      h('label', { class: 'field' }, h('div', { class: 'field-label' }, h('span', {}, 'Datum')), dateInput),
      dateError,
      kgField.el,
    ),
    h('p', { class: 'muted small', style: 'margin: 10px 4px 16px' }, 'Najbolje se je tehtati zjutraj, po stranišču in pred zajtrkom. Teža iz dneva v dan niha zaradi vode, zato aplikacija spremlja trend.'),
    h('button', { class: 'btn primary block', type: 'button', onclick: save }, 'Shrani'),
    weight ? h('button', {
      class: 'btn danger block', type: 'button',
      onclick: async () => {
        const ok = await confirmDialog({ title: 'Izbrišem meritev?', message: `${formatDateShort(weight.date)}, ${formatNumber(weight.kg, 2)} kg`, confirmText: 'Izbriši', danger: true });
        if (!ok) return;
        await stanje.deleteWeight(weight.id);
        toast('Meritev izbrisana');
        sheet.close();
      },
    }, 'Izbriši meritev') : null,
  );
  kgField.input.focus();
  selectAll(kgField.input);
}
