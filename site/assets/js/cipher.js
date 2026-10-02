import { note, fanfare } from './sound.js';

const PLAIN = 'SAXOPHONE AND SECURITY WALK INTO A BAR';
const KEY = 17; // ciphertext is PLAIN shifted forward by KEY; the dial shifts back

const shift = (s, n) => s.replace(/[A-Z]/g, c => String.fromCharCode((c.charCodeAt(0) - 65 + n + 26) % 26 + 65));
const CIPHER = shift(PLAIN, KEY);

export function initCipher() {
  const out = document.getElementById('c-out'), range = document.getElementById('c-range'),
        label = document.getElementById('c-shift'), win = document.getElementById('c-win');
  let solved = false;
  const render = () => {
    const n = +range.value; label.textContent = n;
    // Decoding by shifting back `n` letters; solved when n === KEY.
    out.textContent = shift(CIPHER, -n);
    note(n % 8, .06, 'sine');
    if (n === KEY && !solved) { solved = true; out.classList.add('solved'); win.hidden = false; fanfare(); }
    else if (n !== KEY) { out.classList.remove('solved'); }
  };
  range.addEventListener('input', render);
  document.getElementById('c-hint').addEventListener('click', () => { document.getElementById('c-hint-text').hidden = false; });
  render();
}
