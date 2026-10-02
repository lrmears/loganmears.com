import { initTerminal } from './terminal.js?v=__BUILD__';
import { initPalette } from './palette.js?v=__BUILD__';
import { initTimeline } from './timeline.js?v=__BUILD__';
import { initRunning } from './running.js?v=__BUILD__';
import * as sound from './sound.js?v=__BUILD__';

const $ = id => document.getElementById(id);
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

$('year').textContent = new Date().getFullYear();

// Theme
function toggleTheme() {
  const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'light' : 'dark';
  try { localStorage.setItem('theme', root.dataset.theme); } catch (e) {}
}
$('theme-toggle').addEventListener('click', toggleTheme);

// Sound
const soundBtn = $('sound-toggle');
function syncSound() {
  soundBtn.setAttribute('aria-pressed', sound.isOn());
  soundBtn.setAttribute('aria-label', 'Sound effects ' + (sound.isOn() ? 'on' : 'off'));
}
function toggleSound() { sound.setOn(!sound.isOn()); syncSound(); }
soundBtn.addEventListener('click', toggleSound); syncSound();

// Hero tiles: flip in on load, replay on hover, cycle color on click, and ripple now and then
const states = ['green', 'yellow', 'gray'], heroTiles = [];
document.querySelectorAll('.tile-row').forEach((rowEl, r) => {
  [...rowEl.dataset.word].forEach((ch, i) => {
    const t = document.createElement('span'); t.className = 'tile'; t.textContent = ch; rowEl.appendChild(t);
    let color = states[(i + r * 2) % 3];
    const play = () => { t.classList.remove('turn', 'green', 'yellow', 'gray'); void t.offsetWidth; t.classList.add('turn'); sound.note(i + r * 2, .15); setTimeout(() => t.classList.add(color), 250); };
    t._play = play; heroTiles.push(t);
    if (reduced) t.classList.add(color); else setTimeout(play, 300 + (r * 5 + i) * 180);
    t.addEventListener('mouseenter', play);
    t.addEventListener('click', () => { color = states[(states.indexOf(color) + 1) % 3]; play(); });
  });
});
if (!reduced) setInterval(() => { if (!document.hidden) heroTiles.forEach((t, k) => setTimeout(t._play, k * 90)); }, 20000);

// Count-up stats
document.querySelectorAll('[data-count]').forEach(el => {
  const n = +el.dataset.count; let i = 0;
  if (reduced) { el.textContent = n; return; }
  const id = setInterval(() => { el.textContent = ++i; if (i >= n) clearInterval(id); }, 140);
});

// Timeline
const timeline = initTimeline();
const chips = document.querySelectorAll('.chip[data-filter]');
chips.forEach(c => c.addEventListener('click', () => {
  chips.forEach(x => x.classList.toggle('active', x === c));
  timeline.filter(c.dataset.filter);
}));
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 });
document.querySelectorAll('.stat, .flip').forEach(el => { el.classList.add('reveal'); io.observe(el); });

// Page progress + current nav link
const bar = $('progress'), links = [...document.querySelectorAll('.nav-links a')];
const sections = links.map(a => document.querySelector(a.getAttribute('href')));
function onScroll() {
  const h = document.documentElement;
  bar.style.width = (h.scrollTop / (h.scrollHeight - h.clientHeight) * 100) + '%';
  let cur = -1; sections.forEach((s, i) => { if (s.getBoundingClientRect().top < innerHeight * .4) cur = i; });
  links.forEach((a, i) => a.classList.toggle('current', i === cur));
}
addEventListener('scroll', onScroll, { passive: true }); onScroll();

// Stat cards
document.querySelectorAll('.stat').forEach(c => c.addEventListener('click', () => {
  const on = c.classList.toggle('on'); c.setAttribute('aria-pressed', on); sound.note(on ? 4 : 2, .1);
}));

// Toolkit tiles
document.querySelectorAll('.flip').forEach(f => f.addEventListener('click', () => { f.classList.toggle('on'); sound.note(2 + Math.floor(Math.random() * 5), .12); }));

// Game
const terminal = initTerminal();
initRunning();

// Effects
const avatar = document.querySelector('.avatar');
if (avatar && !reduced && matchMedia('(hover: hover)').matches) {
  avatar.addEventListener('pointermove', e => {
    const r = avatar.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    avatar.style.setProperty('--rx', (-y * 14) + 'deg'); avatar.style.setProperty('--ry', (x * 14) + 'deg');
  });
  avatar.addEventListener('pointerleave', () => { avatar.style.setProperty('--rx', '0deg'); avatar.style.setProperty('--ry', '0deg'); });
}

// Command palette
const go = id => () => { document.getElementById(id).scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' }); };
initPalette([
  { label: 'Go to About', hint: 'section', run: go('about') },
  { label: 'Go to Timeline', hint: 'section', run: go('timeline') },
  { label: 'Go to Play', hint: 'section', run: go('play') },
  { label: 'Go to Running', hint: 'section', run: go('running') },
  { label: 'Go to Toolkit', hint: 'section', run: go('toolkit') },
  { label: 'Go to Contact', hint: 'section', run: go('contact') },
  { label: 'Play GeoTrace (daily case)', hint: 'game', run: () => { go('play')(); setTimeout(terminal.focus, 500); } },
  { label: 'Start a practice case', hint: 'game', run: () => { terminal.practice(); go('play')(); setTimeout(terminal.focus, 500); } },
  { label: 'How to play GeoTrace', hint: 'help', run: () => { go('play')(); setTimeout(terminal.openHelp, 400); } },
  { label: 'Toggle dark mode', hint: 'theme', run: toggleTheme },
  { label: 'Toggle sound', hint: 'audio', run: toggleSound },
  { label: 'Connect on LinkedIn', hint: 'link', run: () => window.open('https://www.linkedin.com/in/loganrmears/', '_blank', 'noopener') }
]);
