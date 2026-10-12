// Visual FX: a subtle cogitator/CRT layer (scanlines, VHS tracking roll, grain, chromatic fringe,
// tab-switch signal jump) plus a short boot sequence once per browser session.
// Purely decorative: overlays ignore the pointer, honour reduced-motion, and never print.
// Toggle with the FX button in the top bar (remembered in localStorage 'tackle.fx').
(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stored = (() => { try { return localStorage.getItem('tackle.fx'); } catch { return null; } })();
  let on = stored ? stored === 'on' : true;

  // Overlay layers (one fixed container, three decorative children).
  const crt = document.createElement('div');
  crt.className = 'crt';
  crt.setAttribute('aria-hidden', 'true');
  crt.innerHTML = '<i class="crt-scan"></i><i class="crt-roll"></i><i class="crt-grain"></i><i class="crt-vignette"></i>';
  document.body.prepend(crt);

  function apply() {
    root.classList.toggle('fx-on', on);
    const btn = document.getElementById('fxToggle');
    if (btn) { btn.setAttribute('aria-pressed', on); btn.classList.toggle('on', on); btn.title = on ? 'Screen effects on (click to turn off)' : 'Screen effects off (click to turn on)'; }
  }

  function toggle() {
    on = !on;
    try { localStorage.setItem('tackle.fx', on ? 'on' : 'off'); } catch {}
    apply();
  }

  // Brief horizontal "signal jump" when the view changes, like a VHS tape catching.
  function glitch() {
    if (!on || reduced) return;
    const panel = document.querySelector('.tab-panel.active');
    if (!panel) return;
    panel.classList.remove('fx-glitch');
    void panel.offsetWidth; // restart the animation
    panel.classList.add('fx-glitch');
  }

  // Boot sequence: once per session, only with FX on. Any key or click skips it.
  function boot() {
    let seen = false;
    try { seen = sessionStorage.getItem('tackle.booted') === '1'; sessionStorage.setItem('tackle.booted', '1'); } catch {}
    if (!on || seen || reduced || new URLSearchParams(location.search).has('demo')) return;
    const D = window.TACKLE_DATA || {};
    const model = window.Ollama?.config?.model || 'local model';
    const lines = [
      '+++ TACKLE//AI COGITATOR — NSW RUGBY LEGACY ARRAY +++',
      `› Binding data-spirits … ${D.grants?.length ?? 0} grants · ${D.dashboard?.length ?? 0} budget lines · ${D.regions?.length ?? 0} regions`,
      '› Calibrating pitch auspex … NSW boundary locked',
      `› Waking machine spirit … ${model}`,
      '+++ LINK ESTABLISHED · THE LINE HOLDS +++',
    ];
    const el = document.createElement('div');
    el.className = 'fx-boot';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<div class="fx-boot-inner">${lines.map((l, i) => `<p style="animation-delay:${i * 0.28}s">${l.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`).join('')}<span class="fx-boot-bar"><span></span></span></div>`;
    document.body.append(el);
    const done = () => {
      if (!el.isConnected) return;
      el.classList.add('out');
      setTimeout(() => el.remove(), 450);
      removeEventListener('keydown', done, true);
    };
    el.addEventListener('click', done);
    addEventListener('keydown', done, true);
    setTimeout(done, 2100);
  }

  apply();
  boot();
  document.addEventListener('tab', glitch);
  document.addEventListener('DOMContentLoaded', () => { document.getElementById('fxToggle')?.addEventListener('click', toggle); apply(); });
  if (document.readyState !== 'loading') { document.getElementById('fxToggle')?.addEventListener('click', toggle); apply(); }

  window.FX = { toggle, get on() { return on; } };
})();
