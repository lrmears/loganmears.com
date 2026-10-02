import { initTerminal } from './terminal.js';
import { initPalette } from './palette.js';
import { initTimeline } from './timeline.js';
import * as sound from './sound.js';

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

// Hero tiles
const palette = ['green', 'yellow', 'gray', 'green', 'yellow'];
document.querySelectorAll('.tile-row').forEach((rowEl, r) => {
  [...rowEl.dataset.word].forEach((ch, i) => {
    const t = document.createElement('span'); t.className = 'tile'; t.textContent = ch; rowEl.appendChild(t);
    const color = palette[(i + r * 2) % 5];
    const play = () => { t.classList.remove('turn', 'green', 'yellow', 'gray'); void t.offsetWidth; t.classList.add('turn'); sound.note(i + r * 2, .15); setTimeout(() => t.classList.add(color), 250); };
    if (reduced) t.classList.add(color); else setTimeout(play, 300 + (r * 5 + i) * 180);
    t.addEventListener('mouseenter', play);
  });
});

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

// Command palette
const go = id => () => { document.getElementById(id).scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' }); };
initPalette([
  { label: 'Go to About', hint: 'section', run: go('about') },
  { label: 'Go to Timeline', hint: 'section', run: go('timeline') },
  { label: 'Go to Play', hint: 'section', run: go('play') },
  { label: 'Go to Toolkit', hint: 'section', run: go('toolkit') },
  { label: 'Go to Contact', hint: 'section', run: go('contact') },
  { label: 'Play GeoTrace (daily case)', hint: 'game', run: () => { go('play')(); setTimeout(terminal.focus, 500); } },
  { label: 'Start a practice case', hint: 'game', run: () => { terminal.practice(); go('play')(); setTimeout(terminal.focus, 500); } },
  { label: 'How to play GeoTrace', hint: 'help', run: () => { go('play')(); setTimeout(terminal.openHelp, 400); } },
  { label: 'Toggle dark mode', hint: 'theme', run: toggleTheme },
  { label: 'Toggle sound', hint: 'audio', run: toggleSound },
  { label: 'Connect on LinkedIn', hint: 'link', run: () => window.open('https://www.linkedin.com/in/loganrmears/', '_blank', 'noopener') }
]);
