import { POOL } from './words.js';
import { note, fanfare } from './sound.js';

const ROWS = 6, EPOCH = new Date(2026, 0, 1);
const $ = id => document.getElementById(id);
const rank = { gray: 1, yellow: 2, green: 3 };
const EMOJI = { green: '🟩', yellow: '🟨', gray: '⬛' };
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};

const dayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const dayIndex = () => Math.floor((new Date().setHours(0, 0, 0, 0) - EPOCH) / 864e5);
// Cheap deterministic shuffle so the daily order isn't just list order.
const dailyPick = () => POOL[((dayIndex() * 7919) % POOL.length + POOL.length) % POOL.length];

export function initWordle() {
  const board = $('board'), kb = $('kb'), msg = $('g-msg');
  let pick, daily, guesses, typed, row, col, locked, grid;
  let stats = store.get('wstats', { played: 0, wins: 0, streak: 0, best: 0, dist: [0, 0, 0, 0, 0, 0], last: '' });

  function start(isDaily) {
    daily = isDaily;
    pick = isDaily ? dailyPick() : POOL[Math.floor(Math.random() * POOL.length)];
    guesses = []; typed = []; row = 0; col = 0; locked = false;
    $('g-topic').textContent = 'Topic: ' + pick.topic;
    $('g-mode').textContent = isDaily ? 'Daily' : 'Practice';
    $('g-practice').textContent = isDaily ? 'Practice word' : 'Back to daily';
    $('g-result').hidden = true; msg.textContent = 'Guess the 5-letter word.';
    build();
    if (isDaily) {
      const saved = store.get('wdaily', null);
      if (saved && saved.day === dayKey()) saved.guesses.forEach(g => replay(g));
    }
  }

  function build() {
    board.innerHTML = ''; grid = [];
    for (let r = 0; r < ROWS; r++) {
      const el = document.createElement('div'); el.className = 'row'; el.setAttribute('role', 'row');
      const cells = Array.from({ length: 5 }, () => { const t = document.createElement('div'); t.className = 'tile'; t.setAttribute('role', 'gridcell'); el.appendChild(t); return t; });
      board.appendChild(el); grid.push({ el, cells });
    }
    kb.innerHTML = '';
    ['QWERTYUIOP', 'ASDFGHJKL', '*ZXCVBNM<'].forEach(keys => {
      const d = document.createElement('div'); d.className = 'kb-row';
      [...keys].forEach(k => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'key';
        b.dataset.k = k === '*' ? 'Enter' : k === '<' ? 'Backspace' : k;
        b.textContent = k === '*' ? 'Enter' : k === '<' ? '⌫' : k;
        b.setAttribute('aria-label', b.dataset.k);
        if (k === '*' || k === '<') b.classList.add('wide');
        d.appendChild(b);
      });
      kb.appendChild(d);
    });
  }

  function score(guess) {
    const res = Array(5).fill('gray'), left = {};
    for (let i = 0; i < 5; i++) guess[i] === pick.word[i] ? res[i] = 'green' : left[pick.word[i]] = (left[pick.word[i]] || 0) + 1;
    for (let i = 0; i < 5; i++) if (res[i] !== 'green' && left[guess[i]] > 0) { res[i] = 'yellow'; left[guess[i]]--; }
    return res;
  }

  function paint(r, guess, res, animate) {
    res.forEach((s, i) => {
      const t = grid[r].cells[i]; t.textContent = guess[i]; t.classList.add('filled');
      const apply = () => {
        t.classList.add(s);
        const key = kb.querySelector(`[data-k="${guess[i]}"]`);
        const old = ['green', 'yellow', 'gray'].find(c => key.classList.contains(c));
        if (!old || rank[s] > rank[old]) { key.classList.remove('green', 'yellow', 'gray'); key.classList.add(s); }
      };
      if (!animate) return apply();
      setTimeout(() => { t.classList.add('flip'); note(s === 'green' ? i + 3 : s === 'yellow' ? i + 1 : 0, .14); setTimeout(apply, 300); }, i * 240);
    });
  }

  function replay(g) {
    const res = score(g); paint(row, g, res, false); guesses.push(res); typed.push(g); row++;
    if (g === pick.word) finish(true, false); else if (row === ROWS) finish(false, false);
  }

  function finish(won, fresh) {
    locked = true;
    if (won) { msg.textContent = ['Genius!', 'Magnificent!', 'Impressive!', 'Splendid!', 'Great!', 'Phew!'][row - 1]; grid[row - 1].el.style.setProperty('--i', 0); grid[row - 1].cells.forEach((c, i) => c.style.setProperty('--i', i)); grid[row - 1].el.classList.add('win'); if (fresh) fanfare(); }
    else msg.textContent = `The word was ${pick.word}.`;
    const text = `Logan's Word ${daily ? '#' + (dayIndex() + 1) : '(practice)'} ${won ? row : 'X'}/${ROWS}\n` + guesses.map(g => g.map(s => EMOJI[s]).join('')).join('\n') + '\nloganmears.com';
    $('g-share-text').textContent = text; $('g-result').hidden = false;
    if (fresh && daily) {
      stats.played++; stats.last = dayKey();
      if (won) { stats.wins++; stats.streak++; stats.best = Math.max(stats.best, stats.streak); stats.dist[row - 1]++; } else stats.streak = 0;
      store.set('wstats', stats); renderStats();
    }
  }

  function submit() {
    if (locked) return;
    if (col < 5) { const el = grid[row].el; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); msg.textContent = 'Not enough letters'; return; }
    const guess = grid[row].cells.map(c => c.textContent).join('');
    const res = score(guess), cur = row;
    locked = true; guesses.push(res); typed.push(guess); paint(cur, guess, res, true);
    if (daily) store.set('wdaily', { day: dayKey(), guesses: typed });
    setTimeout(() => {
      row++; col = 0;
      if (guess === pick.word) finish(true, true);
      else if (row === ROWS) finish(false, true);
      else { locked = false; msg.textContent = ''; }
    }, 5 * 240 + 350);
  }

  function handle(k) {
    if (k === 'Enter') return submit();
    if (locked) return;
    if (k === 'Backspace') { if (col) { const t = grid[row].cells[--col]; t.textContent = ''; t.classList.remove('filled'); } return; }
    if (/^[A-Z]$/.test(k) && col < 5) { const t = grid[row].cells[col++]; t.textContent = k; t.classList.add('filled'); note(col, .08, 'sine'); }
  }

  function renderStats() {
    const pct = stats.played ? Math.round(stats.wins / stats.played * 100) : 0, max = Math.max(1, ...stats.dist);
    $('g-stats').innerHTML = `<div class="nums"><div><b>${stats.played}</b><span>Played</span></div><div><b>${pct}%</b><span>Win rate</span></div><div><b>${stats.streak}</b><span>Streak</span></div><div><b>${stats.best}</b><span>Best</span></div></div>` +
      `<div class="dist">${stats.dist.map((n, i) => `<span>${i + 1}</span><i class="${locked && row === i + 1 && daily ? 'hit' : ''}" style="width:${Math.max(8, n / max * 100)}%">${n}</i>`).join('')}</div>`;
  }

  kb.addEventListener('click', e => { const b = e.target.closest('.key'); if (b) handle(b.dataset.k); });
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || !$('panel-word') || $('panel-word').hidden) return;
    if (!$('palette').hidden || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    const r = $('game').getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
    const k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    if (k === 'Enter' && document.activeElement.tagName === 'BUTTON' && !document.activeElement.classList.contains('key')) return;
    if (k === 'Enter' || k === 'Backspace' || /^[A-Z]$/.test(k)) { e.preventDefault(); handle(k); }
  });
  $('g-practice').addEventListener('click', () => start(!daily));
  $('g-stats-btn').addEventListener('click', () => { renderStats(); $('g-stats').hidden = !$('g-stats').hidden; });
  $('g-share').addEventListener('click', async () => {
    const t = $('g-share-text').textContent;
    try { await navigator.clipboard.writeText(t); $('g-share').textContent = 'Copied!'; } catch (e) { $('g-share').textContent = 'Copy failed'; }
    setTimeout(() => $('g-share').textContent = 'Copy result', 1800);
  });
  start(true);
  return { practice: () => start(false), daily: () => start(true) };
}
