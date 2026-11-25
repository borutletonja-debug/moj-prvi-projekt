// Skupni gradniki vmesnika.
import { formatKcal, formatMacro } from '../logic/stevila.js';

/** Ustvari element: h('div', { class: 'x', onclick }, otrok1, 'besedilo', ...) */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v; // samo za statične ikone
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  append(el, children);
  return el;
}

/** Kot replaceChildren, a izpusti null/false. */
export function setChildren(el, ...children) {
  el.replaceChildren();
  append(el, children);
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

// ===== Ikone (statični SVG) =====
const ICON_PATHS = {
  today: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
  history: '<rect x="3.5" y="5" width="17" height="15" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  weight: '<path d="M4 18 9 12l4 3 7-8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="20" cy="7" r="1.6" fill="currentColor"/>',
  library: '<path d="M5 4.5h10a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M5 17a3 3 0 0 1 3-3h10M9 8.5h5" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>',
  settings: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="7" r="2.3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="10" cy="17" r="2.3" fill="none" stroke="currentColor" stroke-width="2"/>',
  plus: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  search: '<circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="m16 16 4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  star: '<path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  starOn: '<path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  back: '<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  clock: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
};

export function icon(name) {
  const span = document.createElement('span');
  span.style.display = 'contents';
  span.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`;
  return span.firstChild;
}

// ===== Obroč kalorij =====
let lastRingRatio = 0;

export function calorieRing(consumed, goal) {
  const R = 96;
  const C = 2 * Math.PI * R;
  const ratio = goal > 0 ? consumed / goal : 0;
  const over = goal > 0 && consumed > goal;
  const shown = Math.min(Math.max(ratio, 0), 1);

  const s = svg('svg', { viewBox: '0 0 220 220', 'aria-hidden': 'true' });
  s.append(svg('circle', { class: 'track', cx: 110, cy: 110, r: R, fill: 'none', 'stroke-width': 18 }));
  const bar = svg('circle', {
    class: 'bar', cx: 110, cy: 110, r: R, fill: 'none', 'stroke-width': 18,
    'stroke-linecap': 'round', 'stroke-dasharray': C,
    'stroke-dashoffset': C * (1 - Math.min(lastRingRatio, 1)),
  });
  if (shown === 0) bar.setAttribute('stroke-opacity', '0');
  s.append(bar);
  // animacija od prejšnje vrednosti do nove
  requestAnimationFrame(() => requestAnimationFrame(() => bar.setAttribute('stroke-dashoffset', C * (1 - shown))));
  lastRingRatio = shown;

  const remaining = goal - consumed;
  const left = over
    ? `${formatKcal(-remaining)} kcal nad ciljem`
    : `Še ${formatKcal(remaining)} kcal`;

  return h('div', {
    class: `ring${over ? ' over' : ''}`,
    role: 'img',
    'aria-label': `Zaužito ${formatKcal(consumed)} od ${formatKcal(goal)} kcal. ${left}.`,
  },
  s,
  h('div', { class: 'ring-center' },
    h('div', { class: 'ring-value num' }, formatKcal(consumed)),
    h('div', { class: 'ring-goal num' }, `/ ${formatKcal(goal)} kcal`),
    h('div', { class: 'ring-left num' }, left),
  ));
}

// ===== Vrstica makrohranila =====
export function macroBar({ key, label, consumed, goal, primary = false }) {
  const pct = goal > 0 ? Math.min(consumed / goal, 1) * 100 : 0;
  const fill = h('div', { class: 'bar-fill' });
  requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = `${pct}%`; }));
  return h('div', { class: `macro ${key}${primary ? ' primary' : ''}` },
    h('div', { class: 'macro-head' },
      h('span', { class: 'macro-label' }, label),
      h('span', { class: 'macro-val num' }, h('b', {}, formatMacro(consumed)), ` / ${formatMacro(goal).replace(/,0$/, '')} g`),
    ),
    h('div', {
      class: 'bar-track', role: 'progressbar',
      'aria-label': label, 'aria-valuemin': 0, 'aria-valuemax': Math.round(goal || 0), 'aria-valuenow': Math.round(consumed),
    }, fill),
  );
}

export function macroChips(n) {
  return h('div', { class: 'macro-chips num' },
    h('span', { class: 'chip-p' }, `B ${formatMacro(n.protein)}`),
    h('span', { class: 'chip-f' }, `M ${formatMacro(n.fat)}`),
    h('span', { class: 'chip-c' }, `OH ${formatMacro(n.carbs)}`),
  );
}

// ===== Segmentirani izbirnik =====
export function segmented(options, value, onChange, ariaLabel) {
  const wrap = h('div', { class: 'segmented', role: 'group', 'aria-label': ariaLabel || '' });
  const render = (v) => {
    for (const b of wrap.children) b.setAttribute('aria-pressed', String(b.dataset.value === v));
  };
  for (const o of options) {
    wrap.append(h('button', {
      type: 'button',
      dataset: { value: o.value },
      onclick: () => { render(o.value); onChange(o.value); },
    }, o.label));
  }
  render(value);
  wrap.setValue = render;
  return wrap;
}

// ===== Polje obrazca =====
/**
 * Polje z oznako, enoto in napako.
 * type: 'text' | 'decimal'
 */
export function field({ label, value = '', type = 'decimal', suffix, placeholder, help, name, autocapitalize }) {
  const input = h('input', {
    name,
    type: 'text',
    value: value ?? '',
    placeholder: placeholder ?? '',
    inputmode: type === 'decimal' ? 'decimal' : null,
    autocomplete: 'off',
    autocorrect: type === 'decimal' ? 'off' : null,
    autocapitalize: autocapitalize ?? (type === 'decimal' ? 'off' : 'sentences'),
    spellcheck: 'false',
    enterkeyhint: 'next',
    'aria-label': label,
  });
  const errorEl = h('div', { class: 'field-error', 'aria-live': 'polite' });
  const helpEl = help ? h('div', { class: 'field-help' }, help) : null;
  const labelText = h('span', {}, label);
  const el = h('label', { class: 'field' },
    h('div', { class: 'field-label' }, labelText),
    h('div', { class: 'field-input' }, input, suffix ? h('span', { class: 'suffix' }, suffix) : null),
    errorEl,
    helpEl,
  );
  errorEl.hidden = true;
  return {
    el,
    input,
    get value() { return input.value; },
    setLabel(t) { labelText.textContent = t; },
    setHelp(t) { if (helpEl) helpEl.textContent = t; },
    setError(msg) {
      errorEl.textContent = msg || '';
      errorEl.hidden = !msg;
      el.classList.toggle('invalid', !!msg);
    },
  };
}

/** Enter v polju skoči na naslednje polje (zadnje sproži `onDone`). */
export function chainInputs(inputs, onDone) {
  inputs.forEach((inp, i) => {
    if (i === inputs.length - 1) inp.setAttribute('enterkeyhint', 'done');
    inp.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const next = inputs[i + 1];
      if (next) next.focus();
      else if (onDone) onDone();
      else inp.blur();
    });
  });
}

// ===== Spodnji list =====
export function openSheet({ title = '', onClose } = {}) {
  const backdrop = h('div', { class: 'sheet-backdrop' });
  const titleEl = h('h2', { id: 'sheet-title' }, title);
  const left = h('div', { class: 'left' });
  const right = h('div', { class: 'right' });
  const body = h('div', { class: 'sheet-body' });
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sheet-title' },
    h('div', { class: 'sheet-head' }, left, titleEl, right),
    body,
  );
  document.body.append(backdrop, sheet);
  document.body.classList.add('sheet-open');
  requestAnimationFrame(() => { backdrop.classList.add('open'); sheet.classList.add('open'); });

  let closed = false;
  const api = {
    body, sheet,
    setTitle(t) { titleEl.textContent = t; },
    setLeft(...nodes) { left.replaceChildren(...nodes); },
    setRight(...nodes) { right.replaceChildren(...nodes); },
    close() {
      if (closed) return;
      closed = true;
      if (document.activeElement && sheet.contains(document.activeElement)) document.activeElement.blur();
      backdrop.classList.remove('open');
      sheet.classList.remove('open');
      document.body.classList.remove('sheet-open');
      const done = () => { backdrop.remove(); sheet.remove(); };
      sheet.addEventListener('transitionend', done, { once: true });
      setTimeout(done, 450);
      document.removeEventListener('keydown', onKey);
      onClose?.();
    },
  };
  const onKey = (e) => { if (e.key === 'Escape') api.close(); };
  document.addEventListener('keydown', onKey);
  backdrop.addEventListener('click', () => api.close());
  return api;
}

// ===== Potrditveno okno =====
export function confirmDialog({ title, message, confirmText = 'Potrdi', cancelText = 'Prekliči', danger = false }) {
  return new Promise((resolve) => {
    const finish = (v) => { wrap.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') finish(false); };
    const okBtn = h('button', { class: `btn ${danger ? 'danger-solid' : 'primary'}`, type: 'button', onclick: () => finish(true) }, confirmText);
    const wrap = h('div', { class: 'dialog-wrap', onclick: (e) => { if (e.target === wrap) finish(false); } },
      h('div', { class: 'dialog', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'dlg-t' },
        h('h3', { id: 'dlg-t' }, title),
        message ? h('p', {}, message) : null,
        h('div', { class: 'actions', style: cancelText ? null : 'grid-template-columns: 1fr' },
          cancelText ? h('button', { class: 'btn', type: 'button', onclick: () => finish(false) }, cancelText) : null,
          okBtn,
        ),
      ),
    );
    document.addEventListener('keydown', onKey);
    document.body.append(wrap);
    okBtn.focus({ preventScroll: true });
  });
}

// ===== Kratko obvestilo =====
let toastTimer;
export function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(el);
  }
  el.textContent = msg;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/** Izbere vsebino polja (deluje tudi na iOS). */
export function selectAll(input) {
  try { input.setSelectionRange(0, input.value.length); } catch { input.select?.(); }
}
