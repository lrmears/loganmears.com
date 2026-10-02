// Running section: last-28-days cards and charts (weekly miles, cumulative miles, indoor/outdoor mix, run lengths). Data is an aggregate snapshot.
import { RUNNING } from './running-data.js';
import { note } from './sound.js';

const $ = id => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const fmt = n => n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function initRunning() {
  if (!$('run-cards')) return;
  const { last28, weeks } = RUNNING;

  // Last 28 days
  const yr = RUNNING.year;
  [[fmt(yr.miles), `miles so far in ${yr.year}`, `${yr.runs} runs this year`, 'year'], [fmt(last28.miles), 'miles in the last 28 days'], [String(last28.runs), 'runs in the last 28 days'], [fmt(last28.hours), 'hours on my feet in the last 28 days'], [fmt(last28.longestMiles), 'mile longest run in the last 28 days']].forEach(([big, label, extra, cls]) => {
    const c = el('div', 'rcard' + (cls ? ' ' + cls : '')); c.append(el('b', '', big), el('span', '', label)); if (extra) c.append(el('small', '', extra)); $('run-cards').appendChild(c);
  });

  // Weekly chart: each week is a button that fills the readout.
  const max = Math.max(...weeks.map(w => w.miles));
  const chart = $('run-chart'), readout = $('run-readout'), bars = [];
  const label = iso => new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  weeks.forEach((w, i) => {
    const b = el('button', 'run-col'); b.type = 'button';
    const current = i === weeks.length - 1;
    b.setAttribute('aria-label', `Week of ${label(w.start)}: ${fmt(w.miles)} miles in ${w.runs} run${w.runs === 1 ? '' : 's'}${current ? ' (week in progress)' : ''}`);
    const pair = el('span', 'run-pair'), bar = el('i', 'run-bar k26' + (current ? ' partial' : ''));
    bar.dataset.h = w.miles ? Math.max(3, w.miles / max * 100) : 0; bar.style.setProperty('--h', reduced ? bar.dataset.h + '%' : '0%');
    pair.appendChild(bar); bars.push(bar);
    b.append(el('span', 'run-v', fmt(w.miles)), pair, el('span', 'run-m', label(w.start).replace(' ', '\u00a0')));
    const show = () => {
      readout.textContent = `Week of ${label(w.start)}: ${fmt(w.miles)} mi in ${w.runs} run${w.runs === 1 ? '' : 's'}${current ? ' (in progress)' : ''}`;
      chart.querySelectorAll('.run-col').forEach(x => x.classList.toggle('on', x === b));
    };
    b.addEventListener('click', () => { show(); note(i % 8, .08, 'sine'); });
    b.addEventListener('mouseenter', show); b.addEventListener('focus', show);
    chart.appendChild(b);
  });
  if (!reduced && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return; io.disconnect();
      bars.forEach((bar, k) => setTimeout(() => bar.style.setProperty('--h', bar.dataset.h + '%'), k * 45));
    }), { threshold: .3 });
    io.observe(chart);
  } else bars.forEach(bar => bar.style.setProperty('--h', bar.dataset.h + '%'));

  $('run-asof').textContent = `Snapshot from my ${RUNNING.source} watch, as of ${new Date(RUNNING.asOf + 'T12:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}.`;

  // Cumulative miles: area + line over the 12 weeks, one hover point per week.
  const NS = 'http://www.w3.org/2000/svg', svg = (tag, attrs = {}, cls) => { const e = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v)); if (cls) e.setAttribute('class', cls); return e; };
  let run = 0; const totals = weeks.map(w => (run += w.miles));
  const W = 320, H = 150, P = { l: 8, r: 8, t: 12, b: 8 }, top = Math.ceil(run / 10) * 10;
  const X = i => P.l + i / (weeks.length - 1) * (W - P.l - P.r), Y = v => H - P.b - v / top * (H - P.t - P.b);
  const cum = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Cumulative miles rising to ${fmt(run)} over 12 weeks` }, 'cum-svg');
  [0, .5, 1].forEach(f => cum.appendChild(svg('line', { x1: P.l, x2: W - P.r, y1: Y(top * f), y2: Y(top * f) }, 'grid')));
  const pts = totals.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
  cum.appendChild(svg('polygon', { points: `${X(0)},${Y(0)} ${pts.join(' ')} ${X(weeks.length - 1)},${Y(0)}` }, 'area'));
  const line = svg('polyline', { points: pts.join(' '), pathLength: 1 }, 'line'); cum.appendChild(line);
  const dots = totals.map((v, i) => { const c = svg('circle', { cx: X(i), cy: Y(v), r: 3.5 }, 'pt'); cum.appendChild(c); return c; });
  $('chart-cum').appendChild(cum);
  const ax = el('div', 'cum-axis'); ax.setAttribute('aria-hidden', 'true'); ax.append(el('span', '', label(weeks[0].start)), el('span', '', label(weeks[weeks.length - 1].start))); $('chart-cum').appendChild(ax);
  const cumShow = i => { $('cum-readout').textContent = `Through the week of ${label(weeks[i].start)}: ${fmt(totals[i])} miles total`; dots.forEach((d, k) => d.classList.toggle('on', k === i)); };
  cum.addEventListener('pointermove', e => { const r = cum.getBoundingClientRect(); cumShow(Math.max(0, Math.min(weeks.length - 1, Math.round((e.clientX - r.left) / r.width * (weeks.length - 1))))); });
  cumShow(weeks.length - 1);

  // Indoor vs outdoor donut.
  const { outdoor, indoor } = RUNNING.mix, runsAll = outdoor.runs + indoor.runs, C = 2 * Math.PI * 42;
  const don = svg('svg', { viewBox: '0 0 100 100', role: 'img', 'aria-label': `${outdoor.runs} outdoor runs and ${indoor.runs} indoor runs` }, 'donut');
  don.appendChild(svg('circle', { cx: 50, cy: 50, r: 42 }, 'ring bg'));
  const seg = (n, off, cls) => { const c = svg('circle', { cx: 50, cy: 50, r: 42, transform: 'rotate(-90 50 50)', 'stroke-dasharray': `${(n / runsAll) * C} ${C}`, 'stroke-dashoffset': -off }, 'ring ' + cls); don.appendChild(c); return c; };
  const segO = seg(outdoor.runs, 0, 'k-out'), segI = seg(indoor.runs, outdoor.runs / runsAll * C, 'k-in');
  const mid = svg('text', { x: 50, y: 50 }, 'donut-n'); mid.textContent = runsAll; const sub = svg('text', { x: 50, y: 63 }, 'donut-s'); sub.textContent = 'runs';
  don.append(mid, sub); $('chart-mix').appendChild(don);
  [['k-out', 'Outdoor', outdoor], ['k-in', 'Indoor', indoor]].forEach(([k, n, d]) => {
    const li = el('li'); const dot = el('i', 'dot ' + k); li.append(dot, el('span', '', `${n}: ${d.runs} runs, ${fmt(d.miles)} mi`)); $('mix-legend').appendChild(li);
  });

  // Run-length histogram.
  const lmax = Math.max(...RUNNING.lengths.map(l => l.runs)), lbars = [];
  RUNNING.lengths.forEach(l => {
    const col = el('div', 'len-col'), bar = el('i', 'len-bar k26'); bar.dataset.h = l.runs ? Math.max(4, l.runs / lmax * 100) : 0; bar.style.setProperty('--h', reduced ? bar.dataset.h + '%' : '0%');
    col.setAttribute('aria-label', `${l.label} miles: ${l.runs} runs`); col.append(el('b', '', String(l.runs)), el('span', 'len-wrap', ''), el('small', '', l.label));
    col.querySelector('.len-wrap').appendChild(bar); lbars.push(bar); $('chart-len').appendChild(col);
  });

  // Each chart animates in when its own card scrolls into view.
  const reveals = [
    [$('card-cum'), () => line.classList.add('draw')],
    [$('card-mix'), () => { segO.classList.add('in'); segI.classList.add('in'); }],
    [$('card-len'), () => lbars.forEach((b, k) => setTimeout(() => b.style.setProperty('--h', b.dataset.h + '%'), k * 70))]
  ];
  if (!reduced && 'IntersectionObserver' in window) {
    const io2 = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return; io2.unobserve(e.target); reveals.find(([n]) => n === e.target)[1]();
    }), { threshold: .25 });
    reveals.forEach(([n]) => io2.observe(n));
  } else reveals.forEach(([, f]) => f());
}
