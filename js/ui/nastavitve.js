// Zaslon »Nastavitve«.
import { h, setChildren, field, segmented, chainInputs, confirmDialog, toast } from './komponente.js';
import {
  validateGoals, macroMismatch, withGoalChange, validateTolerance, validateProfile, validateWeightGoal, ACTIVITY_KEYS,
} from '../logic/nastavitve.js';
import { ACTIVITY } from '../logic/tdee.js';
import { buildBackup, validateBackup, entriesCSV, foodsCSV, weightsCSV } from '../logic/izvoz.js';
import { formatKcal, formatNumber } from '../logic/stevila.js';
import { todayKey, formatDateShort } from '../logic/datumi.js';
import { APP_VERSION } from '../verzija.js';
import { count, ZIVILO, VNOS, MERITEV } from '../logic/besedilo.js';
import * as stanje from '../stanje.js';

export async function render(root, ctx) {
  const s = stanje.settings();

  // ----- Dnevni cilji -----
  const g = s.goals;
  const kcal = field({ label: 'Kalorije', value: formatNumber(g.kcal), suffix: 'kcal' });
  const protein = field({ label: 'Beljakovine', value: formatNumber(g.protein), suffix: 'g' });
  const fat = field({ label: 'Maščobe', value: formatNumber(g.fat), suffix: 'g' });
  const carbs = field({ label: 'Ogljikovi hidrati', value: formatNumber(g.carbs), suffix: 'g' });
  const tolerance = field({
    label: 'Toleranca za »cilj dosežen«', value: formatNumber(s.tolerancePct), suffix: '± %',
    help: 'Tedensko povprečje kalorij sme od cilja odstopati za toliko odstotkov.',
  });
  const goalFields = { kcal, protein, fat, carbs };
  const mismatch = h('div', { class: 'notice', hidden: true });
  const saveGoalsBtn = h('button', { class: 'btn primary block', type: 'button', disabled: true }, 'Shrani cilje');

  const readGoals = () => validateGoals({ kcal: kcal.value, protein: protein.value, fat: fat.value, carbs: carbs.value });
  const checkGoals = () => {
    const r = readGoals();
    const dirty = Object.entries(goalFields).some(([k, f]) => f.value.trim() !== formatNumber(g[k]))
      || tolerance.value.trim() !== formatNumber(s.tolerancePct);
    saveGoalsBtn.disabled = !dirty;
    const m = r.ok ? macroMismatch(r.value) : null;
    mismatch.hidden = !m;
    if (m) {
      mismatch.textContent = `Makrohranila skupaj dajo ${formatKcal(m.macroKcal)} kcal (beljakovine in OH 4 kcal/g, maščobe 9 kcal/g), `
        + `kar je ${formatKcal(Math.abs(m.diffPct))} % ${m.diffPct > 0 ? 'več' : 'manj'} od kaloričnega cilja.`;
    }
  };
  const saveGoals = async () => {
    const r = readGoals();
    for (const [k, f] of Object.entries(goalFields)) f.setError(r.errors[k]);
    const tol = validateTolerance(tolerance.value);
    tolerance.setError(tol.error);
    if (!r.ok || tol.error) return;
    document.activeElement?.blur();
    const goalsChanged = Object.keys(r.value).some((k) => r.value[k] !== g[k]);
    await stanje.saveSettings({
      // stari cilji ostanejo veljavni za pretekle dni
      ...(goalsChanged ? withGoalChange(s, r.value, todayKey()) : {}),
      tolerancePct: tol.value,
    });
    toast('Cilji shranjeni');
  };
  for (const f of Object.values(goalFields)) f.input.addEventListener('input', () => { f.setError(null); checkGoals(); });
  tolerance.input.addEventListener('input', () => { tolerance.setError(null); checkGoals(); });
  chainInputs([kcal.input, protein.input, fat.input, carbs.input, tolerance.input], saveGoals);
  saveGoalsBtn.addEventListener('click', saveGoals);
  checkGoals();

  // ----- Osebni podatki in cilj teže -----
  const p = s.profile;
  const wg = s.weightGoal;
  let sex = p.sex;
  let direction = wg.direction;
  const sexPicker = segmented([{ value: 'male', label: 'Moški' }, { value: 'female', label: 'Ženska' }], sex, (v) => { sex = v; }, 'Spol');
  const birthYear = field({ label: 'Letnica rojstva', value: p.birthYear ?? '', placeholder: 'npr. 2004' });
  birthYear.input.setAttribute('inputmode', 'numeric');
  const height = field({ label: 'Višina', value: p.heightCm ? formatNumber(p.heightCm) : '', suffix: 'cm', placeholder: 'npr. 180' });
  const activity = h('select', { class: 'select-field', 'aria-label': 'Raven aktivnosti' },
    h('option', { value: '' }, 'Izberi …'),
    ACTIVITY_KEYS.map((k) => h('option', { value: k, selected: p.activity === k }, `${ACTIVITY[k].label} (${ACTIVITY[k].hint})`)),
  );
  const targetKg = field({ label: 'Ciljna teža', value: wg.targetKg ? formatNumber(wg.targetKg) : '', suffix: 'kg', placeholder: 'neobvezno' });
  const rate = field({ label: 'Želeni tempo', value: formatNumber(wg.rateKgPerWeek), suffix: 'kg na teden', help: 'Zmerno: 0,25–0,5 kg na teden.' });
  const showRate = () => { rate.el.hidden = direction === 'maintain'; };
  const directionPicker = segmented(
    [{ value: 'lose', label: 'Hujšanje' }, { value: 'maintain', label: 'Vzdrževanje' }, { value: 'gain', label: 'Pridobivanje' }],
    direction, (v) => { direction = v; showRate(); }, 'Cilj teže');
  showRate();
  const saveBody = async () => {
    const pr = validateProfile({ sex, birthYear: birthYear.value, heightCm: height.value, activity: activity.value }, new Date().getFullYear());
    const gr = validateWeightGoal({ targetKg: targetKg.value, direction, rateKgPerWeek: rate.value });
    birthYear.setError(pr.errors.birthYear);
    height.setError(pr.errors.heightCm);
    targetKg.setError(gr.errors.targetKg);
    rate.setError(gr.errors.rateKgPerWeek);
    if (!pr.ok || !gr.ok) return;
    document.activeElement?.blur();
    await stanje.saveSettings({ profile: pr.value, weightGoal: gr.value });
    toast('Shranjeno');
  };
  chainInputs([birthYear.input, height.input]);
  chainInputs([targetKg.input, rate.input], saveBody);

  // ----- Videz -----
  const themePicker = segmented(
    [{ value: 'dark', label: 'Temno' }, { value: 'light', label: 'Svetlo' }, { value: 'system', label: 'Sistem' }],
    s.theme,
    async (v) => { ctx.applyTheme(v); await stanje.saveSettings({ theme: v }); },
    'Videz',
  );

  // ----- Podatki -----
  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only', tabindex: '-1', 'aria-hidden': 'true' });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (file) await importBackup(file);
  });

  const persisted = await isPersisted();
  const backupInfo = s.lastBackup ? formatDateShort(s.lastBackup) : 'še nikoli';

  setChildren(root,
    h('div', { class: 'screen-head' }, h('h1', {}, 'Nastavitve')),

    h('div', { class: 'section-title' }, 'Dnevni cilji'),
    h('div', { class: 'list' }, kcal.el, protein.el, fat.el, carbs.el),
    h('div', { class: 'list', style: 'margin-top: 14px' }, tolerance.el),
    h('p', { class: 'muted small', style: 'margin: 8px 4px 0' }, 'Novi cilji veljajo od danes naprej. Pretekli dnevi se primerjajo s cilji, ki so veljali takrat.'),
    h('div', { style: 'margin-top: 12px' }, mismatch),
    saveGoalsBtn,

    h('div', { class: 'section-title' }, 'Osebni podatki'),
    h('p', { class: 'muted small', style: 'margin: 0 4px 10px' }, 'Za začetno oceno dnevne porabe, dokler ni dovolj meritev. Ostanejo samo na tem telefonu.'),
    h('div', { style: 'margin-bottom: 10px' }, sexPicker),
    h('div', { class: 'list' },
      birthYear.el, height.el,
      h('label', { class: 'field' }, h('div', { class: 'field-label' }, h('span', {}, 'Raven aktivnosti')), activity),
    ),

    h('div', { class: 'section-title' }, 'Cilj teže'),
    h('div', { style: 'margin-bottom: 10px' }, directionPicker),
    h('div', { class: 'list' }, targetKg.el, rate.el),
    h('button', { class: 'btn primary block', type: 'button', style: 'margin-top: 12px', onclick: saveBody }, 'Shrani osebne podatke in cilj teže'),

    h('div', { class: 'section-title' }, 'Videz'),
    themePicker,

    h('div', { class: 'section-title' }, 'Varnostna kopija'),
    h('div', { class: 'list' },
      h('div', { class: 'kv' }, h('span', { class: 'k' }, 'Zadnja varnostna kopija'), h('span', { class: 'num' }, backupInfo)),
      h('div', { class: 'kv' }, h('span', { class: 'k' }, 'Trajna shramba'), h('span', {}, persisted ? 'vklopljena' : 'ni potrjena')),
    ),
    h('p', { class: 'muted small', style: 'margin: 8px 4px 12px' },
      'Podatki so shranjeni samo na tem telefonu. Če aplikacijo odstraniš z začetnega zaslona, se izbrišejo. '
      + 'Varnostno kopijo shrani v aplikacijo Datoteke ali iCloud Drive.'),
    h('div', { class: 'stack' },
      h('button', { class: 'btn primary block', type: 'button', onclick: exportBackup }, 'Izvozi varnostno kopijo (JSON)'),
      h('button', { class: 'btn block', type: 'button', onclick: () => fileInput.click() }, 'Uvozi varnostno kopijo'),
    ),
    fileInput,

    h('div', { class: 'section-title' }, 'Izvoz za Excel / Numbers'),
    h('div', { class: 'stack' },
      h('button', { class: 'btn block', type: 'button', onclick: exportEntriesCSV }, 'Izvozi vnose (CSV)'),
      h('button', { class: 'btn block', type: 'button', onclick: exportFoodsCSV }, 'Izvozi knjižnico (CSV)'),
      h('button', { class: 'btn block', type: 'button', onclick: exportWeightsCSV }, 'Izvozi težo (CSV)'),
    ),

    h('div', { class: 'section-title' }, 'O aplikaciji'),
    h('div', { class: 'list' },
      h('div', { class: 'kv' }, h('span', { class: 'k' }, 'Tilen Letonja'), h('span', { class: 'num' }, `različica ${APP_VERSION}`)),
    ),
  );
}

async function isPersisted() {
  try { return !!(await navigator.storage?.persisted?.()); } catch { return false; }
}

/** Deli ali prenese datoteko. Vrne true, če je bila datoteka shranjena/deljena. */
async function saveFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const file = new File([blob], filename, { type: mime });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return true;
    } catch (e) {
      if (e.name === 'AbortError') return false;
      // sicer poskusi s prenosom
    }
  }
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}

async function exportBackup() {
  const data = await stanje.exportAll();
  const today = todayKey();
  data.settings = data.settings.map((x) => ({ ...x, lastBackup: today }));
  const json = JSON.stringify(buildBackup(data), null, 1);
  const ok = await saveFile(`tilen-letonja-${today}.json`, json, 'application/json');
  if (ok) {
    await stanje.saveSettings({ lastBackup: today });
    toast('Varnostna kopija izvožena');
  }
}

async function importBackup(file) {
  let obj;
  try { obj = JSON.parse(await file.text()); } catch {
    await confirmDialog({ title: 'Uvoz ni uspel', message: 'Datoteka ni veljaven JSON.', confirmText: 'V redu', cancelText: null });
    return;
  }
  const r = validateBackup(obj);
  if (!r.ok) {
    await confirmDialog({ title: 'Uvoz ni uspel', message: r.error, confirmText: 'V redu', cancelText: null });
    return;
  }
  const c = r.counts;
  const ok = await confirmDialog({
    title: 'Zamenjam vse podatke?',
    message: `Kopija vsebuje ${count(c.foods, ZIVILO)}, ${count(c.entries, VNOS)} in ${count(c.weights, MERITEV)} teže.\n`
      + 'Vsi trenutni podatki na tem telefonu bodo zamenjani.',
    confirmText: 'Uvozi', danger: true,
  });
  if (!ok) return;
  try {
    await stanje.importAll(r.data);
    toast('Podatki uvoženi');
  } catch (e) {
    await confirmDialog({ title: 'Uvoz ni uspel', message: `Obstoječi podatki niso bili spremenjeni.\n${e.message}`, confirmText: 'V redu', cancelText: null });
  }
}

async function exportEntriesCSV() {
  const entries = await stanje.getEntries();
  if (!entries.length) { toast('Ni vnosov za izvoz'); return; }
  if (await saveFile(`vnosi-${todayKey()}.csv`, entriesCSV(entries), 'text/csv')) toast('Vnosi izvoženi');
}

async function exportFoodsCSV() {
  const foods = await stanje.getFoods();
  if (!foods.length) { toast('Knjižnica je prazna'); return; }
  if (await saveFile(`knjiznica-${todayKey()}.csv`, foodsCSV(foods), 'text/csv')) toast('Knjižnica izvožena');
}

async function exportWeightsCSV() {
  const weights = await stanje.getWeights();
  if (!weights.length) { toast('Ni meritev teže za izvoz'); return; }
  if (await saveFile(`teza-${todayKey()}.csv`, weightsCSV(weights), 'text/csv')) toast('Teža izvožena');
}
