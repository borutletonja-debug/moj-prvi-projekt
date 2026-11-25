// Graf teže (SVG): meritve kot točke, trend kot črta, cilj kot črtkana črta.
import { h } from './komponente.js';
import { daysBetween, parseDateKey, addDays } from '../logic/datumi.js';
import { formatNumber } from '../logic/stevila.js';

const NS = 'http://www.w3.org/2000/svg';
function s(tag, attrs = {}, text) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text !== undefined) el.textContent = text;
  return el;
}

function niceStep(span, maxTicks = 5) {
  for (const step of [0.5, 1, 2, 5, 10, 20, 50]) if (span / step <= maxTicks) return step;
  return 100;
}

const dm = (key) => { const d = parseDateKey(key); return `${d.getDate()}. ${d.getMonth() + 1}.`; };

/**
 * points: [{ date, kg, trend }] (urejeno), today, targetKg (neobvezno).
 */
export function weightChart(points, { today, targetKg = null } = {}) {
  const W = 350; const H = 220;
  const m = { l: 40, r: 12, t: 12, b: 26 };
  const iw = W - m.l - m.r; const ih = H - m.t - m.b;

  let x0 = points[0].date;
  let x1 = points[points.length - 1].date > today ? points[points.length - 1].date : today;
  if (x0 === x1) { x0 = addDays(x0, -3); x1 = addDays(x1, 3); }
  const xSpan = daysBetween(x0, x1);

  const vals = points.flatMap((p) => [p.kg, p.trend]);
  let lo = Math.min(...vals); let hi = Math.max(...vals);
  // cilj prikaži, če ni predaleč od meritev
  const showTarget = Number.isFinite(targetKg) && targetKg > lo - 6 && targetKg < hi + 6;
  if (showTarget) { lo = Math.min(lo, targetKg); hi = Math.max(hi, targetKg); }
  if (hi - lo < 2) { const mid = (hi + lo) / 2; lo = mid - 1; hi = mid + 1; }
  const step = niceStep(hi - lo);
  lo = Math.floor((lo - 0.2) / step) * step;
  hi = Math.ceil((hi + 0.2) / step) * step;

  const X = (date) => m.l + (daysBetween(x0, date) / xSpan) * iw;
  const Y = (kg) => m.t + (1 - (kg - lo) / (hi - lo)) * ih;

  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img' });
  const last = points[points.length - 1];
  svg.setAttribute('aria-label', `Graf teže. Zadnja meritev ${formatNumber(last.kg, 1)} kg, trend ${formatNumber(last.trend, 1)} kg.`);

  for (let v = lo; v <= hi + 1e-9; v += step) {
    svg.append(s('line', { class: 'grid', x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v) }));
    svg.append(s('text', { class: 'axis', x: m.l - 6, y: Y(v) + 4, 'text-anchor': 'end' }, formatNumber(v, 1)));
  }
  const ticks = [x0, addDays(x0, Math.round(xSpan / 2)), x1];
  ticks.forEach((d, i) => svg.append(s('text', {
    class: 'axis', x: X(d), y: H - 6, 'text-anchor': i === 0 ? 'start' : i === 2 ? 'end' : 'middle',
  }, dm(d))));

  if (showTarget) {
    svg.append(s('line', { class: 'target', x1: m.l, x2: W - m.r, y1: Y(targetKg), y2: Y(targetKg) }));
  }
  if (points.length > 1) {
    const path = points.map((p, i) => `${i ? 'L' : 'M'}${X(p.date).toFixed(1)},${Y(p.trend).toFixed(1)}`).join(' ');
    svg.append(s('path', { class: 'trend', d: path }));
  }
  for (const p of points) svg.append(s('circle', { class: 'pt', cx: X(p.date), cy: Y(p.kg), r: points.length > 40 ? 2.2 : 3.2 }));
  svg.append(s('circle', { class: 'trend-end', cx: X(last.date), cy: Y(last.trend), r: 4.5 }));

  return h('div', {},
    svg,
    h('div', { class: 'legend' },
      h('span', {}, h('i', { class: 'lg-pt' }), 'meritve'),
      h('span', {}, h('i', { class: 'lg-trend' }), 'trend'),
      showTarget ? h('span', {}, h('i', { class: 'lg-target' }), `cilj ${formatNumber(targetKg, 1)} kg`) : null,
    ),
  );
}
