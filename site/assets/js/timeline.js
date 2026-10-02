// Horizontal timeline. Reads the semantic <ol id="tl"> (also the no-JS fallback) and builds
// a scrollable rail of nodes plus a detail panel. Keyboard: ←/→, Home/End.
import { note } from './sound.js?v=__BUILD__';

export function initTimeline() {
  const src = document.getElementById('tl');
  const items = [...src.querySelectorAll('.t-item')].reverse().map(li => ({
    type: li.dataset.type,
    date: li.querySelector('.t-date').textContent,
    short: li.querySelector('.t-date').textContent.split(' →')[0],
    title: li.querySelector('h3').textContent,
    card: li.querySelector('.t-card')
  })); // chronological: oldest first

  const root = document.createElement('div'); root.className = 'htl';
  root.innerHTML = `
    <div class="htl-rail" id="htl-rail" tabindex="-1"><div class="htl-track"><div class="htl-fill"></div><div class="htl-nodes" role="tablist" aria-label="Timeline events"></div></div></div>
    <div class="htl-controls">
      <button class="icon-btn" id="htl-prev" type="button" aria-label="Previous event">←</button>
      <span class="htl-count" id="htl-count"></span>
      <button class="icon-btn" id="htl-next" type="button" aria-label="Next event">→</button>
      <button class="chip" id="htl-play" type="button">▶ Play through</button>
    </div>
    <div class="htl-panel" id="htl-panel" role="tabpanel" aria-live="polite"></div>`;
  src.after(root);
  document.documentElement.classList.add('js-htl');

  const rail = root.querySelector('#htl-rail'), nodesEl = root.querySelector('.htl-nodes'),
        fill = root.querySelector('.htl-fill'), panel = root.querySelector('#htl-panel'),
        count = root.querySelector('#htl-count');
  const nodes = items.map((it, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'htl-node'; b.dataset.type = it.type;
    b.setAttribute('role', 'tab'); b.id = 'htl-n' + i;
    const mk = (cls, text) => { const e = document.createElement('span'); e.className = cls; if (text) e.textContent = text; return e; };
    const dot = mk('htl-dot'); dot.setAttribute('aria-hidden', 'true');
    b.append(mk('htl-date', it.short), dot, mk('htl-title', it.title));
    b.addEventListener('click', () => select(i, true));
    nodesEl.appendChild(b); return b;
  });

  let cur = -1, timer = null;
  const visible = () => items.map((it, i) => i).filter(i => !nodes[i].hidden);

  function select(i, user, dir) {
    if (user) stop();
    const prev = cur; cur = i;
    nodes.forEach((n, k) => { const on = k === i; n.classList.toggle('active', on); n.classList.toggle('past', k < i); n.setAttribute('aria-selected', on); n.tabIndex = on ? 0 : -1; });
    const n = nodes[i];
    fill.style.width = (n.offsetLeft + n.offsetWidth / 2) + 'px';
    rail.scrollTo({ left: n.offsetLeft + n.offsetWidth / 2 - rail.clientWidth / 2, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    panel.setAttribute('aria-labelledby', n.id);
    panel.dataset.type = items[i].type;
    panel.innerHTML = ''; panel.appendChild(items[i].card.cloneNode(true));
    panel.classList.remove('from-left', 'from-right'); void panel.offsetWidth;
    panel.classList.add((dir || (prev < i ? 1 : -1)) > 0 ? 'from-right' : 'from-left');
    const v = visible(); count.textContent = `${v.indexOf(i) + 1} / ${v.length}`;
    if (prev !== -1) note(v.indexOf(i) % 8, .1, 'sine');
  }

  function step(d, user) {
    const v = visible(); if (!v.length) return;
    let k = v.indexOf(cur) + d;
    if (k < 0) k = v.length - 1; if (k >= v.length) k = 0;
    select(v[k], user, d);
    return k;
  }

  function stop() { clearInterval(timer); timer = null; root.querySelector('#htl-play').textContent = '▶ Play through'; }
  root.querySelector('#htl-play').addEventListener('click', e => {
    if (timer) return stop();
    e.target.textContent = '⏸ Pause';
    const v = visible(); select(v[0], false, -1);
    timer = setInterval(() => { const k = step(1, false); if (k === visible().length - 1) stop(); }, 3200);
  });
  root.querySelector('#htl-prev').addEventListener('click', () => step(-1, true));
  root.querySelector('#htl-next').addEventListener('click', () => step(1, true));
  nodesEl.addEventListener('keydown', e => {
    const v = visible(); let k = v.indexOf(cur);
    if (e.key === 'ArrowRight') k = Math.min(v.length - 1, k + 1);
    else if (e.key === 'ArrowLeft') k = Math.max(0, k - 1);
    else if (e.key === 'Home') k = 0; else if (e.key === 'End') k = v.length - 1; else return;
    e.preventDefault(); select(v[k], true); nodes[v[k]].focus();
  });

  // Drag to scroll the rail with a mouse
  let drag = null;
  rail.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') drag = { x: e.clientX, l: rail.scrollLeft, moved: false }; });
  addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x; if (Math.abs(dx) > 4) drag.moved = true; rail.scrollLeft = drag.l - dx; });
  addEventListener('pointerup', () => { drag = null; });
  rail.addEventListener('click', e => { if (drag && drag.moved) e.stopPropagation(); }, true);

  // Filtering: called by main.js
  function filter(type) {
    nodes.forEach((n, i) => { n.hidden = type !== 'all' && items[i].type !== type; });
    // Re-measure after layout changes, then select the latest visible event.
    const v = visible(); stop();
    if (v.length) select(v[v.length - 1], false, -1);
  }
  select(items.length - 1, false, -1);
  addEventListener('resize', () => cur > -1 && select(cur, false, 0));
  return { filter };
}
