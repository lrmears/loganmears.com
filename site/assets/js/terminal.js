// "GeoTrace": a terminal game. Gather recon clues, then `guess <country>` to attribute the attack.
import { COUNTRIES } from './countries.js?v=__BUILD__';
import { note, fanfare } from './sound.js?v=__BUILD__';
import { confetti } from './fx.js?v=__BUILD__';

const HOME = [41.26, -95.93]; // Omaha, where the (fictional) sensor sits
const MAX_GUESSES = 6, EPOCH = new Date(2026, 0, 1);
const $ = id => document.getElementById(id);
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
// Country outlines are a separate (~80 KB) module, loaded lazily so the page itself stays light.
let outlinesP = null;
const loadOutlines = () => outlinesP || (outlinesP = import('./outlines.js?v=__BUILD__').then(m => m.OUTLINES).catch(() => ({})));
const SVGNS = 'http://www.w3.org/2000/svg';
function outlineSvg(outlines, name, tone) {
  const svg = document.createElementNS(SVGNS, 'svg'); svg.setAttribute('class', 'ol ' + tone); svg.setAttribute('aria-hidden', 'true');
  const o = outlines[name], shape = document.createElementNS(SVGNS, o ? 'path' : 'circle');
  if (o) { svg.setAttribute('viewBox', `-3 -3 ${o[0] + 6} ${o[1] + 6}`); shape.setAttribute('d', o[2]); shape.setAttribute('fill-rule', 'evenodd'); }
  else { svg.setAttribute('viewBox', '0 0 100 100'); shape.setAttribute('cx', 50); shape.setAttribute('cy', 50); shape.setAttribute('r', 7); } // too small to outline: a dot
  svg.appendChild(shape); return svg;
}
// ---- Daily history and streaks (kept in this browser only) ----
const HKEY = 'tstats';
const isoDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const noon = iso => Date.parse(iso + 'T12:00:00');
function loadHistory() {
  const raw = store.get(HKEY, null), days = {};
  if (raw && typeof raw.days === 'object' && raw.days) {
    Object.entries(raw.days).slice(0, 2000).forEach(([k, v]) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && v && (v.w === 0 || v.w === 1) && Number.isInteger(v.g) && v.g >= 1 && v.g <= 6) days[k] = { w: v.w, g: v.g, c: Number.isInteger(v.c) ? v.c : 0 };
    });
  }
  return { days };
}
function recordDay(won, guesses, clues) {
  const h = loadHistory(), k = isoDay();
  if (h.days[k]) return false;            // one daily result per day
  h.days[k] = { w: won ? 1 : 0, g: guesses, c: clues };
  store.set(HKEY, h); return true;
}
function computeStats(h) {
  const keys = Object.keys(h.days).sort();
  let best = 0, run = 0, prev = null; const dist = [0, 0, 0, 0, 0, 0]; let wins = 0, guessSum = 0;
  keys.forEach(k => {
    const d = h.days[k];
    if (d.w) { run = prev && h.days[prev].w && Math.round((noon(k) - noon(prev)) / 864e5) === 1 ? run + 1 : 1; best = Math.max(best, run); wins++; dist[d.g - 1]++; guessSum += d.g; } else run = 0;
    prev = k;
  });
  // Current streak: counts back from today, or from yesterday if today's case isn't played yet.
  const today = isoDay(), yest = isoDay(new Date(Date.now() - 864e5));
  let k = h.days[today] ? today : (h.days[yest] ? yest : null), cur = 0;
  while (k && h.days[k] && h.days[k].w) { cur++; k = isoDay(new Date(noon(k) - 864e5)); }
  const last14 = Array.from({ length: 14 }, (_, i) => { const day = isoDay(new Date(Date.now() - (13 - i) * 864e5)); return { day, state: h.days[day] ? (h.days[day].w ? 'win' : 'loss') : 'none' }; });
  return { played: keys.length, wins, pct: keys.length ? Math.round(wins / keys.length * 100) : 0, avg: wins ? (guessSum / wins).toFixed(1) : '–', cur, best, dist, last14, todayGuesses: h.days[today] && h.days[today].w ? h.days[today].g : 0 };
}
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

const dayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const dayIndex = () => Math.floor((new Date().setHours(0, 0, 0, 0) - EPOCH) / 864e5);

const rad = d => d * Math.PI / 180;
function distKm(a, b) {
  const dLat = rad(b[0] - a[0]), dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
function arrow(a, b) {
  const y = Math.sin(rad(b[1] - a[1])) * Math.cos(rad(b[0]));
  const x = Math.cos(rad(a[0])) * Math.sin(rad(b[0])) - Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(rad(b[1] - a[1]));
  const deg = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360, i = Math.round(deg / 45) % 8;
  return [['N', '⬆️'], ['NE', '↗️'], ['E', '➡️'], ['SE', '↘️'], ['S', '⬇️'], ['SW', '↙️'], ['W', '⬅️'], ['NW', '↖️']][i];
}
const find = q => {
  q = q.trim().toLowerCase(); if (!q) return null;
  const exact = COUNTRIES.find(c => c.name.toLowerCase() === q || c.alias.includes(q));
  if (exact) return exact;
  const pre = COUNTRIES.filter(c => c.name.toLowerCase().startsWith(q));
  return pre.length === 1 ? pre[0] : null;
};

export function initTerminal() {
  const screen = $('t-screen'), input = $('t-input'), box = $('terminal');
  let target, daily, clues, guesses, over, cmds, hist = [], hi = 0, ip;

  const line = (text, cls = '', shape = null) => {
    const p = document.createElement('div'); p.className = 't-line ' + cls;
    if (shape) {
      p.classList.add('has-ol');
      const slot = document.createElement('span'); slot.className = 'ol-slot' + (shape.big ? ' big' : '');
      const label = document.createElement('span'); label.textContent = text; p.append(slot, label);
      loadOutlines().then(O => { slot.appendChild(outlineSvg(O, shape.name, shape.tone)); screen.scrollTop = screen.scrollHeight; });
    } else p.textContent = text;
    screen.appendChild(p); screen.scrollTop = screen.scrollHeight; return p;
  };
  const gap = () => line('');

  function start(isDaily) {
    daily = isDaily;
    const i = isDaily ? ((dayIndex() * 13 + 5) % COUNTRIES.length + COUNTRIES.length) % COUNTRIES.length : Math.floor(Math.random() * COUNTRIES.length);
    target = COUNTRIES[i]; clues = new Set(); guesses = []; cmds = []; over = false;
    syncChips();
    ip = `203.0.113.${(isDaily ? dayIndex() * 37 : Math.floor(Math.random() * 250)) % 250 + 2}`;
    [['t-mode-daily', true], ['t-mode-practice', false]].forEach(([id, d]) => { const b = $(id); b.classList.toggle('active', isDaily === d); b.setAttribute('aria-pressed', isDaily === d); });
    $('t-result').hidden = true;
    screen.innerHTML = '';
    banner();
    if (isDaily) { const s = store.get('tdaily', null); if (s && s.day === dayKey() && Array.isArray(s.cmds)) s.cmds.slice(0, 40).forEach(c => typeof c === 'string' && c.length < 80 && run(c, true)); }
  }

  // Quick-command buttons show which clues are already used, and dim once the case is closed.
  function syncChips() {
    $('t-chips').classList.toggle('over', !!over);
    document.querySelectorAll('.t-chip').forEach(b => {
      const used = clues.has(b.dataset.cmd);
      b.classList.toggle('used', used);
      b.setAttribute('aria-label', used ? `${b.dataset.cmd} (already used)` : b.dataset.cmd);
    });
  }

  function banner() {
    line('GeoTrace v1.0  ·  SOC incident console', 'dim');
    gap();
    line('ALERT #7731  ·  HIGH', 'bad');
    line(`Unauthorized login to vault-01 from ${ip}`, 'warn');
    line('Sensor location: Omaha, NE. Origin country: UNKNOWN.');
    gap();
    line(`Run recon commands to build a profile, then: guess <country>   (${MAX_GUESSES} attempts)`);
    line('Type "help" for commands. Tab completes. Fictional incident, real geography.', 'dim');
    gap();
  }

  const CLUES = {
    whois:      () => [`domain registrant TLD ......... ${target.tld}`],
    ping:       () => { const d = distKm(HOME, [target.lat, target.lon]); const rtt = Math.round(d / 95 + 18 + (target.name.length * 7) % 13); return [`PING ${ip}: 3 packets transmitted, 3 received`, `rtt avg ......................... ${rtt} ms`]; },
    tz:         () => [`session log timestamps ........ ${target.tz}`],
    lang:       () => [`Accept-Language header ........ ${target.lang}`],
    phone:      () => [`MFA SMS destination prefix .... ${target.phone}`],
    continent:  () => [`ASN registry region ........... ${target.continent}`],
    traceroute: () => {
      const slug = target.capital.toLowerCase().replace(/[^a-z]/g, '');
      return ['traceroute to ' + ip, ' 1  gw.omaha.local            0.9 ms', ' 2  core1.chi.transit.example    11 ms',
        ` 3  ix-peer.example.net          ${Math.round(distKm(HOME, [target.lat, target.lon]) / 140 + 20)} ms`, ` 4  edge1.${slug}.isp.example   ${Math.round(distKm(HOME, [target.lat, target.lon]) / 95 + 18)} ms`];
    }
  };
  const HELP = [
    ['whois', 'registrant top-level domain'], ['ping', 'round-trip latency from Omaha'], ['tz', 'timezone seen in session logs'],
    ['lang', 'browser language header'], ['phone', 'MFA phone prefix'], ['continent', 'ASN registry region'],
    ['traceroute', 'network path (reveals the nearest city)'], ['guess <country>', 'submit your attribution'],
    ['countries', 'list valid answers'], ['history', 'show your guesses'], ['stats', 'daily record and streak'], ['expand', 'fill the screen (Esc to exit)'], ['clear', 'clear the screen'], ['new', 'start a practice case']
  ];

  function run(raw, replay = false) {
    const text = raw.trim(); if (!text) return;
    line(`analyst@soc:~$ ${text}`, 'cmd');
    const [cmd, ...rest] = text.split(/\s+/), arg = rest.join(' ');
    const c = cmd.toLowerCase();
    if (!replay) { hist.push(text); hi = hist.length; }
    if (over && (CLUES[c] || c === 'guess' || c === 'g')) { line('Case closed. Type "new" for a practice case.', 'dim'); return; }

    if (CLUES[c]) {
      if (!replay) { cmds.push(text); save(); note(1 + clues.size, .08, 'square'); }
      clues.add(c); syncChips();
      CLUES[c]().forEach(l => line(l, 'ok'));
    } else if (c === 'guess' || c === 'g') {
      if (!arg) return line('usage: guess <country>', 'warn');
      const g = find(arg); if (!g) return line(`"${arg}" is not a known country. Try "countries".`, 'warn');
      if (guesses.includes(g)) return line(`Already tried ${g.name}.`, 'warn');
      if (!replay) { cmds.push(text); save(); }
      guesses.push(g);
      if (g === target) return win(replay);
      const d = Math.round(distKm([g.lat, g.lon], [target.lat, target.lon])), [dir, ar] = arrow([g.lat, g.lon], [target.lat, target.lon]);
      const near = Math.max(0, Math.round((1 - d / 20000) * 100));
      line(`✗ ${g.name}: ${d.toLocaleString()} km ${dir} ${ar}  (${near}% close)`, 'bad', { name: g.name, tone: 'miss' });
      if (!replay) note(0, .2, 'sawtooth');
      if (guesses.length >= MAX_GUESSES) lose(replay); else line(`${MAX_GUESSES - guesses.length} attempts remaining.`, 'dim');
    } else if (c === 'help' || c === '?') {
      HELP.forEach(([k, v]) => line(`  ${k.padEnd(18)} ${v}`));
    } else if (c === 'countries') {
      line(COUNTRIES.map(x => x.name).join(', '), 'dim');
    } else if (c === 'stats') {
      const s = computeStats(loadHistory());
      if (!s.played) line('No daily games recorded yet. Solve today\'s case to start a streak.', 'dim');
      else {
        line(`played ${s.played} · won ${s.wins} (${s.pct}%) · avg ${s.avg} guesses`);
        line(`current streak ${plural(s.cur, 'day')} · best ${plural(s.best, 'day')}`, 'ok');
        line('last 14 days: ' + s.last14.map(d => d.state === 'win' ? '🟩' : d.state === 'loss' ? '🟥' : '⬛').join(''));
      }
    } else if (c === 'history') {
      guesses.length ? guesses.forEach((g, i) => line(`  ${i + 1}. ${g.name}`)) : line('No guesses yet.', 'dim');
    } else if (c === 'clear') {
      screen.innerHTML = '';
    } else if (c === 'new') {
      start(false);
    } else if (c === 'ls') { line('vault-01.key  incident.log  README.md');
    } else if (c === 'whoami') { line('analyst');
    } else if (c === 'sudo') { line('analyst is not in the sudoers file. This incident will be reported.', 'warn');
    } else if (c === 'cat') { line(arg ? `cat: ${arg}: Permission denied` : 'usage: cat <file>', 'warn');
    } else if (c === 'expand' || c === 'fullscreen') { setExpanded(true);
    } else if (c === 'exit') { if (expanded) { line('logout', 'dim'); setExpanded(false); } else line('There is no escape. Only incident response.', 'dim');
    } else { line(`${cmd}: command not found. Try "help".`, 'warn'); }
  }

  const save = () => daily && store.set('tdaily', { day: dayKey(), cmds });

  let streakNow = 0;
  function summary(won) {
    const marks = guesses.map((g, i) => (g === target ? '🟩' : (d => d < 1000 ? '🟩' : d < 3000 ? '🟨' : d < 7000 ? '🟧' : '🟥')(distKm([g.lat, g.lon], [target.lat, target.lon])))).join('');
    return `GeoTrace ${daily ? '#' + (dayIndex() + 1) : '(practice)'} ${won ? guesses.length : 'X'}/${MAX_GUESSES} · ${plural(clues.size, 'clue')}\n${marks}${won && daily && streakNow > 1 ? `\n🔥 ${streakNow}-day streak` : ''}\nloganmears.com`;
  }
  function win(replay) {
    over = true; syncChips(); gap();
    line(`✓ ATTRIBUTION CONFIRMED: ${target.name}`, 'good', { name: target.name, tone: 'win', big: true });
    line(`Solved in ${guesses.length} guess${guesses.length > 1 ? 'es' : ''} using ${clues.size} recon command${clues.size === 1 ? '' : 's'}.`, 'good');
    finish(true, replay);
    if (!replay) { fanfare(); const r = box.getBoundingClientRect(); confetti(r.left + r.width / 2, r.top + r.height / 3); }
  }
  function lose(replay) {
    over = true; syncChips(); gap();
    line(`✗ Out of attempts. The origin was ${target.name} (${target.capital}).`, 'bad', { name: target.name, tone: 'reveal', big: true });
    finish(false, replay);
  }
  function finish(won, replay) {
    if (daily && !replay && recordDay(won, guesses.length, clues.size)) {
      const s = computeStats(loadHistory()); streakNow = s.cur; renderStreak();
      line(won ? `🔥 Streak: ${plural(s.cur, 'day')} (best ${s.best})` : `Streak reset. Best so far: ${plural(s.best, 'day')}.`, won ? 'good' : 'dim');
    } else if (daily) streakNow = computeStats(loadHistory()).cur;
    $('t-share-text').textContent = summary(won); $('t-result').hidden = false;
  }

  function complete() {
    const v = input.value, m = v.match(/^(guess|g)\s+(.*)$/i);
    if (m) {
      const hits = COUNTRIES.filter(c => c.name.toLowerCase().startsWith(m[2].toLowerCase()));
      if (hits.length === 1) input.value = `guess ${hits[0].name}`;
      else if (hits.length > 1) line(hits.map(h => h.name).join('  '), 'dim');
      return;
    }
    const names = [...Object.keys(CLUES), 'guess', 'help', 'countries', 'history', 'stats', 'expand', 'clear', 'new'];
    const hits = names.filter(n => n.startsWith(v.toLowerCase()));
    if (hits.length === 1) input.value = hits[0] + (hits[0] === 'guess' ? ' ' : '');
    else if (hits.length > 1) line(hits.join('  '), 'dim');
  }

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { const v = input.value; input.value = ''; run(v); }
    else if (e.key === 'Tab') { e.preventDefault(); complete(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (hi > 0) input.value = hist[--hi]; }
    else if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.min(hist.length, hi + 1); input.value = hist[hi] || ''; }
    else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); screen.innerHTML = ''; }
  });
  box.addEventListener('click', e => { if (!getSelection().toString() && !e.target.closest('button')) input.focus({ preventScroll: true }); });
  document.querySelectorAll('.t-chip').forEach(b => b.addEventListener('click', () => { run(b.dataset.cmd); }));
  $('t-mode-daily').addEventListener('click', () => { if (!daily) start(true); });
  $('t-mode-practice').addEventListener('click', () => start(false)); // always a fresh practice case
  $('t-share').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('t-share-text').textContent); $('t-share').textContent = 'Copied!'; } catch (e) { $('t-share').textContent = 'Copy failed'; }
    setTimeout(() => $('t-share').textContent = 'Copy result', 1800);
  });
  function renderStreak() {
    const s = computeStats(loadHistory()); $('t-streak').textContent = '🔥 ' + s.cur;
    $('t-streak').setAttribute('aria-label', `Current streak: ${plural(s.cur, 'day')}`);
  }
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  function renderStatsDialog() {
    const s = computeStats(loadHistory()), body = $('t-stats-body'); body.replaceChildren();
    const nums = mk('div', 'hs-nums');
    [[s.played, 'Played'], [s.pct + '%', 'Win rate'], [s.cur, 'Streak'], [s.best, 'Best streak']].forEach(([n, l]) => { const d = mk('div'); d.append(mk('b', '', String(n)), mk('span', '', l)); nums.appendChild(d); });
    const max = Math.max(1, ...s.dist), dist = mk('div', 'hs-dist');
    s.dist.forEach((n, i) => { const bar = mk('i', i + 1 === s.todayGuesses ? 'hit' : '', String(n)); bar.style.setProperty('width', Math.max(8, n / max * 100) + '%'); dist.append(mk('span', '', String(i + 1)), bar); });
    const days = mk('div', 'hs-days'); days.setAttribute('role', 'img'); days.setAttribute('aria-label', 'Last 14 days: ' + s.last14.map(d => d.state === 'win' ? 'win' : d.state === 'loss' ? 'loss' : 'no game').join(', '));
    s.last14.forEach(d => { const i = mk('i', d.state); i.title = d.day; days.appendChild(i); });
    body.append(nums, mk('h4', '', 'Guesses to solve'), dist, mk('h4', '', 'Last 14 days'), days, mk('p', 'muted fine', s.played ? `Average ${s.avg} guesses on solved cases. Only daily cases count; results stay in this browser.` : 'Play today\'s daily case to start your history. Results stay in this browser.'));
  }
  const sd = $('t-stats-dialog');
  $('t-stats-btn').addEventListener('click', () => { renderStatsDialog(); sd.showModal(); });
  sd.addEventListener('click', e => { if (e.target === sd) sd.close(); });
  let armed = null;
  $('t-stats-clear').addEventListener('click', e => {
    if (!armed) { e.target.textContent = 'Click again to confirm'; armed = setTimeout(() => { armed = null; e.target.textContent = 'Clear history'; }, 3000); return; }
    clearTimeout(armed); armed = null; store.set(HKEY, { days: {} }); e.target.textContent = 'Clear history'; renderStatsDialog(); renderStreak();
  });
  // Expand: the terminal panel fills the whole viewport (everything behind it is made inert).
  const panel = document.querySelector('.terminal-panel'), expBtn = $('t-expand');
  let expanded = false;
  function setExpanded(on) {
    if (on === expanded) return; expanded = on;
    panel.classList.toggle('expanded', on); document.documentElement.classList.toggle('t-expanded', on);
    document.querySelectorAll('.nav, .hero, main > section:not(#play), #play .section-head, .footer, .progress').forEach(e => e.toggleAttribute('inert', on));
    expBtn.setAttribute('aria-expanded', on); expBtn.setAttribute('aria-label', on ? 'Exit full screen' : 'Expand to full screen'); expBtn.title = on ? 'Exit (Esc)' : 'Expand (Esc to exit)';
    if (on) { panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', 'GeoTrace, expanded'); input.focus({ preventScroll: true }); }
    else { ['role', 'aria-modal', 'aria-label'].forEach(a => panel.removeAttribute(a)); expBtn.focus({ preventScroll: true }); }
    screen.scrollTop = screen.scrollHeight;
  }
  expBtn.addEventListener('click', () => setExpanded(!expanded));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && expanded && !document.querySelector('dialog[open]') && $('palette').hidden) setExpanded(false);
  });
  const how = $('how');
  const openHelp = () => how.showModal();
  $('how-open').addEventListener('click', openHelp);
  how.addEventListener('click', e => { if (e.target === how) how.close(); });
  setTimeout(loadOutlines, 1200);
  renderStreak();
  start(true);
  return { expand: () => setExpanded(true), openHelp, focus: () => input.focus({ preventScroll: true }), practice: () => start(false) };
}
