// Tiny Web Audio synth. Off by default; persisted. Notes are a pentatonic scale so anything sounds fine.
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16];
let ctx = null, on = false;
try { on = localStorage.getItem('sound') === '1'; } catch (e) {}

export const isOn = () => on;
export function setOn(v) {
  on = v;
  try { localStorage.setItem('sound', v ? '1' : '0'); } catch (e) {}
  if (v) note(0);
}
export function note(step = 0, dur = .18, type = 'triangle') {
  if (!on) return;
  ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
  const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.value = 220 * Math.pow(2, SCALE[step % SCALE.length] / 12);
  g.gain.setValueAtTime(.0001, t);
  g.gain.exponentialRampToValueAtTime(.12, t + .02);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t); o.stop(t + dur + .05);
}
export const fanfare = () => [0, 2, 4, 7].forEach((s, i) => setTimeout(() => note(s + 2, .25), i * 110));
