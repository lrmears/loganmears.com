// Small visual effects: confetti and heading "decrypt". Skipped for reduced-motion users.
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let canvas, ctx, raf = 0, dpr = 1, confettiBits = [];

function ensure() {
  if (canvas) return;
  canvas = document.createElement('canvas'); canvas.className = 'fx'; canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas); ctx = canvas.getContext('2d');
  addEventListener('resize', size); size();
}
function size() { dpr = Math.min(devicePixelRatio || 1, 2); canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
function css(v, fallback) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim() || fallback; }

function loop() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);

  confettiBits = confettiBits.filter(b => b.y < innerHeight + 20 && b.life > 0);
  confettiBits.forEach(b => {
    b.vy += .25; b.x += b.vx; b.y += b.vy; b.r += b.vr; b.life--;
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.fillStyle = b.c; ctx.fillRect(-b.s / 2, -b.s / 2, b.s, b.s); ctx.restore();
  });

  if (confettiBits.length) raf = requestAnimationFrame(loop);
  else raf = 0;
}
const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };

export function confetti(x = innerWidth / 2, y = innerHeight / 3) {
  if (reduced) return; ensure();
  const colors = [css('--green', '#4f9d5f'), css('--yellow', '#b59a2b'), css('--gray', '#4a4c50'), '#ffffff'];
  for (let i = 0; i < 70; i++) {
    const a = Math.random() * Math.PI * 2, v = 3 + Math.random() * 7;
    confettiBits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4, r: Math.random() * 6, vr: (Math.random() - .5) * .4, s: 6 + Math.random() * 7, c: colors[i % colors.length], life: 140 });
  }
  kick();
}

// Scramble headings into place as they scroll into view. The real text always stays in the DOM
// (crawlers and screen readers read it); the heading is only visually held back until it reveals.
const GLYPHS = '01<>/\\|-_+*#';
export function decryptHeadings(selector) {
  if (reduced || !('IntersectionObserver' in window)) return;
  const scramble = (text, keep) => [...text].map((ch, i) => (ch === ' ' || i < keep ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)])).join('');
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return; io.unobserve(e.target);
    const { span, final } = e.target._dx, start = performance.now(), dur = 650 + final.length * 18;
    span.textContent = scramble(final, 0); e.target.classList.remove('dx');
    (function tick(now) {
      const p = Math.min(1, (now - start) / dur);
      span.textContent = scramble(final, Math.floor(p * final.length));
      p < 1 ? requestAnimationFrame(tick) : (span.textContent = final);
    })(start);
  }), { threshold: .6 });
  document.querySelectorAll(selector).forEach(h => {
    const final = h.textContent, span = document.createElement('span');
    span.textContent = final; h.textContent = ''; h.appendChild(span);
    h._dx = { span, final }; h.classList.add('dx'); io.observe(h);
  });
}
