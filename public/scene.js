// Aisle hero scene and scroll feel, in the Alibi / Envelope family. Drawn by us with CSS 3D (compositor-only).
// Hero: glass Kite outlines drifting in 3D, and the Kite mark itself: a thick extruded body whose three
// nodes fly in from the sides, lock into place, glow, and drift apart again.
// Scroll: a sky of small glass kites at different depths (parallax), a progress line, sections that rise in.
// Paused off-screen and in hidden tabs; still frames under prefers-reduced-motion (CSS).
(() => {
  const BODY = 'M23.27 25.61C24.12 24.74 24.67 23.57 24.82 22.3C24.85 22.06 24.93 21.42 25.05 20.51C26.82 6.39 26.82 6.24 26.82 6.02C26.82 5.97 26.82 5.91 26.82 5.85C26.77 4.46 26.12 3.14 25.03 2.23C23.92 1.3 22.46 .86 21.01 1.04L4.5 3.01C2.42 3.25 .68 4.74 .16 6.69C.05 7.1 0 7.53 0 7.95C0 8.01 0 8.06 0 8.12C.06 9.93 1.15 11.57 2.84 12.39C4.74 13.27 8.57 14.28 10.85 16.5C13.12 18.73 14.15 22.47 15.05 24.32L15.06 24.33C15.9 26 17.59 27.07 19.46 27.13C19.52 27.13 19.57 27.13 19.63 27.13C21.02 27.13 22.31 26.59 23.27 25.61Z';
  const NODES = [[19.63, 22.08], [21.61, 6.05], [5.2, 7.98]]; // centres in the 28-unit logo box, radius 3.3
  const defs = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <linearGradient id="k-body" x1="5.7" y1="18.5" x2="22.4" y2="-1.5" gradientUnits="userSpaceOnUse"><stop stop-color="#9B8564"/><stop offset=".55" stop-color="#C9B48C"/><stop offset="1" stop-color="#F1E9D6"/></linearGradient>
    <linearGradient id="k-edge" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#6E5C40"/><stop offset="1" stop-color="#4A3D29"/></linearGradient>
    <linearGradient id="k-iri" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#F3E7C8"/><stop offset=".3" stop-color="#DAA038"/><stop offset=".6" stop-color="#8E9DFF"/><stop offset=".85" stop-color="#B7D36A"/><stop offset="1" stop-color="#F3F1EA"/></linearGradient>
    <linearGradient id="k-glass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#F3E7C8" stop-opacity=".18"/><stop offset=".5" stop-color="#DAA038" stop-opacity=".06"/><stop offset="1" stop-color="#5F79FF" stop-opacity=".12"/></linearGradient>
  </defs></svg>`;
  const glass = (z, face) => `<svg class="gl" viewBox="-1 -1 30 30" style="transform:translateZ(${z}px)" aria-hidden="true"><path d="${BODY}" fill="${face ? 'url(#k-glass)' : 'none'}" stroke="url(#k-iri)" stroke-width="${face ? .32 : .2}" stroke-opacity="${face ? 1 : .5}" vector-effect="non-scaling-stroke"/></svg>`;
  const glassKite = (p, i, cls) => `<div class="gk ${p.k} ${cls}" style="left:${p.x}%;top:${p.y}%;--w:${p.w}px;--rx0:${p.rx[0]}deg;--rx1:${p.rx[1]}deg;--ry0:${p.ry[0]}deg;--ry1:${p.ry[1]}deg;--rz0:${p.rz[0]}deg;--rz1:${p.rz[1]}deg;--dur:${p.d}s;--del:-${(i * 3.3).toFixed(1)}s">
    <div class="gk-in">${glass(-10, false)}${glass(-5, false)}${glass(0, true)}</div></div>`;

  // ---- hero ----
  const scene = document.getElementById('scene');
  if (scene) {
    const PLATES = [
      { x: 52, y: 8, w: 130, rx: [50, 62], ry: [-16, 10], rz: [-30, -12], d: 26, k: 'near' },
      { x: 88, y: 64, w: 150, rx: [16, 34], ry: [26, 2], rz: [14, 32], d: 31, k: 'near' },
      { x: 60, y: 74, w: 96, rx: [-28, -10], ry: [-30, -8], rz: [-14, 8], d: 23, k: 'mid' },
      { x: 90, y: 4, w: 110, rx: [10, 26], ry: [20, -8], rz: [6, 20], d: 29, k: 'far' },
      { x: 42, y: 4, w: 70, rx: [30, 48], ry: [0, 24], rz: [18, 36], d: 27, k: 'far' },
    ];
    // the extruded mark: 12 stacked slices make the thickness, the front slice carries the gradient
    const slices = Array.from({ length: 12 }, (_, i) => `<svg class="sl" viewBox="0 0 28 28" style="transform:translateZ(${-i * 2.2}px)"><path d="${BODY}" fill="${i ? 'url(#k-edge)' : 'url(#k-body)'}"/></svg>`).join('');
    const SCATTER = [['170px', '120px', '140px', '50deg'], ['120px', '-170px', '90px', '-40deg'], ['-190px', '-90px', '120px', '30deg']];
    const nodes = NODES.map(([cx, cy], i) => `<i class="node" style="left:${(cx / 28) * 100}%;top:${(cy / 28) * 100}%;--sx:${SCATTER[i][0]};--sy:${SCATTER[i][1]};--sz:${SCATTER[i][2]};--sr:${SCATTER[i][3]};--nd:${i * .25}s"></i>`).join('');
    scene.innerHTML = `${defs}<div class="aurora"><i></i><i></i><i></i></div>${PLATES.map((p, i) => glassKite(p, i, p.y > 33 ? 'mob-hide' : '')).join('')}
      <div class="mark3d"><div class="mark-glow"></div><div class="mark-sway"><div class="mark-body">${slices}</div>${nodes}</div></div>`;
    let vis = true;
    const upd = () => scene.classList.toggle('paused', !vis || document.hidden);
    if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { vis = e.isIntersecting; upd(); }).observe(scene);
    document.addEventListener('visibilitychange', upd);
  }

  // ---- the sky behind the page: small glass kites at three depths, moved by scroll (parallax) ----
  const sky = document.getElementById('sky');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (sky) {
    const SKY = [
      { x: 6, y: 120, w: 64, f: .35, k: 'far' }, { x: 88, y: 160, w: 90, f: .55, k: 'mid' }, { x: 4, y: 230, w: 110, f: .7, k: 'mid' },
      { x: 92, y: 290, w: 70, f: .4, k: 'far' }, { x: 8, y: 360, w: 80, f: .5, k: 'far' }, { x: 86, y: 420, w: 120, f: .75, k: 'mid' },
      { x: 3, y: 500, w: 70, f: .45, k: 'far' }, { x: 90, y: 560, w: 84, f: .6, k: 'far' },
    ];
    // p.y = the scroll position (in screens ×100) where this kite should cross the middle of the view
    sky.innerHTML = (scene ? '' : defs) + SKY.map((p, i) => `<div class="sk" data-f="${p.f}" style="left:${p.x}%;top:${(p.y * p.f + 35).toFixed(0)}vh">${glassKite({ x: 0, y: 0, w: p.w, rx: [20 + i * 4, 40], ry: [-20, 18], rz: [-18 + i * 5, 12], d: 22 + i * 2, k: p.k }, i, '')}</div>`).join('');
  }

  // ---- scroll: progress line, hero parallax, sky parallax ----
  const bar = document.getElementById('progress');
  const heroText = document.querySelector('.hero');
  const skyKites = sky ? [...sky.querySelectorAll('.sk')] : [];
  let ticking = false;
  const onScroll = () => {
    ticking = false;
    const y = scrollY, h = document.documentElement.scrollHeight - innerHeight;
    if (bar) bar.style.transform = `scaleX(${h > 0 ? Math.min(1, y / h) : 0})`;
    if (reduce) return;
    if (heroText && y < innerHeight * 1.2) { heroText.style.transform = `translate3d(0, ${y * -0.18}px, 0)`; heroText.style.opacity = String(Math.max(0, 1 - y / (innerHeight * .75))); }
    if (scene && y < innerHeight * 1.2) scene.style.transform = `translate3d(0, ${y * 0.25}px, 0) scale(${1 + y / 4000})`;
    for (const k of skyKites) k.style.transform = `translate3d(0, ${-y * Number(k.dataset.f)}px, 0)`;
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener('resize', onScroll); onScroll();

  // ---- sections rise in as they enter; content rendered later still animates (CSS) ----
  const blocks = document.querySelectorAll('main .block');
  if (!reduce && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('rv');
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -12% 0px', threshold: 0.02 });
    blocks.forEach((b) => io.observe(b));
    setTimeout(() => blocks.forEach((b) => b.classList.add('in')), 9000); // never leave content hidden
  }
})();
