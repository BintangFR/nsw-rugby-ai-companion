// Visual FX: soft phosphor glow and a gentle screen vignette, switched with the FX button in the
// top bar (remembered in localStorage 'tackle.fx'). No scanlines, no motion, no transitions.
// Purely decorative: the overlay ignores the pointer and never prints.
(() => {
  const root = document.documentElement;
  const stored = (() => { try { return localStorage.getItem('tackle.fx'); } catch { return null; } })();
  let on = stored ? stored === 'on' : true;

  const crt = document.createElement('div');
  crt.className = 'crt';
  crt.setAttribute('aria-hidden', 'true');
  crt.innerHTML = '<i class="crt-vignette"></i>';
  document.body.prepend(crt);

  function apply() {
    root.classList.toggle('fx-on', on);
    const btn = document.getElementById('fxToggle');
    if (btn) { btn.setAttribute('aria-pressed', on); btn.classList.toggle('on', on); btn.title = on ? 'Glow effects on (click to turn off)' : 'Glow effects off (click to turn on)'; }
  }

  function toggle() {
    on = !on;
    try { localStorage.setItem('tackle.fx', on ? 'on' : 'off'); } catch {}
    apply();
  }

  apply();
  const bind = () => { document.getElementById('fxToggle')?.addEventListener('click', toggle); apply(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();

  window.FX = { toggle, get on() { return on; } };
})();
