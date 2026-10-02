// Cmd/Ctrl+K command menu. Commands are supplied by main.js.
export function initPalette(commands) {
  const root = document.getElementById('palette'), input = document.getElementById('p-input'), list = document.getElementById('p-list');
  let shown = [], sel = 0, opener = null;

  const render = () => {
    const q = input.value.trim().toLowerCase();
    shown = commands.filter(c => q.split(/\s+/).every(w => c.label.toLowerCase().includes(w)));
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    list.replaceChildren(...(shown.length ? shown : [{ label: 'No matches' }]).map((c, i) => {
      const li = document.createElement('li'), l = document.createElement('span'), h = document.createElement('small');
      l.textContent = c.label; h.textContent = c.hint || ''; li.append(l, h);
      if (shown.length) { li.setAttribute('role', 'option'); li.dataset.i = i; li.setAttribute('aria-selected', i === sel); }
      return li;
    }));
  };
  const open = () => { opener = document.activeElement; root.hidden = false; input.value = ''; sel = 0; render(); input.focus(); };
  const close = () => { root.hidden = true; opener && opener.focus && opener.focus(); };
  const run = i => { const c = shown[i]; if (!c) return; close(); setTimeout(c.run, 0); };

  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); root.hidden ? open() : close(); return; }
    if (root.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % shown.length; render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + shown.length) % shown.length; render(); }
    else if (e.key === 'Enter') { e.preventDefault(); run(sel); }
  });
  input.addEventListener('input', () => { sel = 0; render(); });
  list.addEventListener('click', e => { const li = e.target.closest('li[data-i]'); if (li) run(+li.dataset.i); });
  root.addEventListener('mousedown', e => { if (e.target === root) close(); });
  document.getElementById('open-palette').addEventListener('click', open);
}
