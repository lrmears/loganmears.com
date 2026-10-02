// "GeoTrace": a terminal game. Gather recon clues, then `guess <country>` to attribute the attack.
import { COUNTRIES } from './countries.js';
import { note, fanfare } from './sound.js';
import { confetti } from './fx.js';

const HOME = [41.26, -95.93]; // Omaha, where the (fictional) sensor sits
const MAX_GUESSES = 6, EPOCH = new Date(2026, 0, 1);
const $ = id => document.getElementById(id);
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
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

  const line = (text, cls = '') => { const p = document.createElement('div'); p.className = 't-line ' + cls; p.textContent = text; screen.appendChild(p); screen.scrollTop = screen.scrollHeight; return p; };
  const gap = () => line('');

  function start(isDaily) {
    daily = isDaily;
    const i = isDaily ? ((dayIndex() * 13 + 5) % COUNTRIES.length + COUNTRIES.length) % COUNTRIES.length : Math.floor(Math.random() * COUNTRIES.length);
    target = COUNTRIES[i]; clues = new Set(); guesses = []; cmds = []; over = false;
    ip = `203.0.113.${(isDaily ? dayIndex() * 37 : Math.floor(Math.random() * 250)) % 250 + 2}`;
    $('t-mode').textContent = isDaily ? 'Daily' : 'Practice';
    $('t-practice').textContent = isDaily ? 'Practice case' : 'Back to daily';
    $('t-result').hidden = true;
    screen.innerHTML = '';
    banner();
    if (isDaily) { const s = store.get('tdaily', null); if (s && s.day === dayKey() && Array.isArray(s.cmds)) s.cmds.slice(0, 40).forEach(c => typeof c === 'string' && c.length < 80 && run(c, true)); }
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
    ['countries', 'list valid answers'], ['history', 'show your guesses'], ['clear', 'clear the screen'], ['new', 'start a practice case']
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
      clues.add(c);
      CLUES[c]().forEach(l => line(l, 'ok'));
    } else if (c === 'guess' || c === 'g') {
      if (!arg) return line('usage: guess <country>', 'warn');
      const g = find(arg); if (!g) return line(`"${arg}" is not a known country. Try "countries".`, 'warn');
      if (guesses.includes(g)) return line(`Already tried ${g.name}.`, 'warn');
      if (!replay) { cmds.push(text); save(); }
      guesses.push(g);
      if (g === target) return win();
      const d = Math.round(distKm([g.lat, g.lon], [target.lat, target.lon])), [dir, ar] = arrow([g.lat, g.lon], [target.lat, target.lon]);
      const near = Math.max(0, Math.round((1 - d / 20000) * 100));
      line(`✗ ${g.name}: ${d.toLocaleString()} km ${dir} ${ar}  (${near}% close)`, 'bad');
      if (!replay) note(0, .2, 'sawtooth');
      if (guesses.length >= MAX_GUESSES) lose(); else line(`${MAX_GUESSES - guesses.length} attempts remaining.`, 'dim');
    } else if (c === 'help' || c === '?') {
      HELP.forEach(([k, v]) => line(`  ${k.padEnd(18)} ${v}`));
    } else if (c === 'countries') {
      line(COUNTRIES.map(x => x.name).join(', '), 'dim');
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
    } else if (c === 'exit') { line('There is no escape. Only incident response.', 'dim');
    } else { line(`${cmd}: command not found. Try "help".`, 'warn'); }
  }

  const save = () => daily && store.set('tdaily', { day: dayKey(), cmds });

  function summary(won) {
    const marks = guesses.map((g, i) => (g === target ? '🟩' : (d => d < 1000 ? '🟩' : d < 3000 ? '🟨' : d < 7000 ? '🟧' : '🟥')(distKm([g.lat, g.lon], [target.lat, target.lon])))).join('');
    return `GeoTrace ${daily ? '#' + (dayIndex() + 1) : '(practice)'} ${won ? guesses.length : 'X'}/${MAX_GUESSES} · ${clues.size} clues\n${marks}\nloganmears.com`;
  }
  function win() {
    over = true; gap();
    line(`✓ ATTRIBUTION CONFIRMED: ${target.name}`, 'good');
    line(`Solved in ${guesses.length} guess${guesses.length > 1 ? 'es' : ''} using ${clues.size} recon command${clues.size === 1 ? '' : 's'}.`, 'good');
    finish(true); fanfare();
    const r = box.getBoundingClientRect(); confetti(r.left + r.width / 2, r.top + r.height / 3);
  }
  function lose() {
    over = true; gap();
    line(`✗ Out of attempts. The origin was ${target.name} (${target.capital}).`, 'bad');
    finish(false);
  }
  function finish(won) { $('t-share-text').textContent = summary(won); $('t-result').hidden = false; }

  function complete() {
    const v = input.value, m = v.match(/^(guess|g)\s+(.*)$/i);
    if (m) {
      const hits = COUNTRIES.filter(c => c.name.toLowerCase().startsWith(m[2].toLowerCase()));
      if (hits.length === 1) input.value = `guess ${hits[0].name}`;
      else if (hits.length > 1) line(hits.map(h => h.name).join('  '), 'dim');
      return;
    }
    const names = [...Object.keys(CLUES), 'guess', 'help', 'countries', 'history', 'clear', 'new'];
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
  $('t-practice').addEventListener('click', () => start(!daily));
  $('t-share').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('t-share-text').textContent); $('t-share').textContent = 'Copied!'; } catch (e) { $('t-share').textContent = 'Copy failed'; }
    setTimeout(() => $('t-share').textContent = 'Copy result', 1800);
  });
  const how = $('how');
  const openHelp = () => how.showModal();
  $('how-open').addEventListener('click', openHelp);
  how.addEventListener('click', e => { if (e.target === how) how.close(); });
  start(true);
  return { openHelp, focus: () => input.focus({ preventScroll: true }), practice: () => start(false) };
}
