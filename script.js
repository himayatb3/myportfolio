(() => {
  'use strict';
  window.__motion = true;

  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasIO = 'IntersectionObserver' in window;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const COLORS = ['#ffc53d', '#ff5470', '#5b8cff', '#3df2b0', '#b78bff'];

  /* ==========================================================
     Pixel sprite that runs along the XP bar
     ========================================================== */
  const PIXELS = { h: '#ffc53d', v: '#0a0c1a', w: '#e9ecff', b: '#5b8cff', m: '#3df2b0', k: '#2b3163', r: '#ff5470' };
  const HEAD = ['....hhhh....', '...hhhhhh...', '...hvvvvh...', '...hvwvvh...', '...hhhhhh...', '....bbbb....', '...bmmmmb...'];
  const BODY = {
    stand: ['..bbmmmmbb..', '...bmmmmb...', '....kkkk....', '....kk.kk...', '...rr..rr...'],
    run1:  ['.bbmmmmb....', '...bmmmmbb..', '....kkkk....', '...kk...kk..', '..rr.....rr.'],
    run2:  ['...bmmmmbb..', '.bbmmmmb....', '....kkkk....', '....kkkk....', '....rrrr....']
  };
  const spriteSvg = {};
  Object.keys(BODY).forEach(name => {
    const rects = HEAD.concat(BODY[name]).map((row, y) =>
      Array.from(row).map((ch, x) => PIXELS[ch] ? `<rect x="${x}" y="${y}" width="1" height="1" fill="${PIXELS[ch]}"/>` : '').join('')
    ).join('');
    spriteSvg[name] = `<svg viewBox="0 0 12 12" width="24" height="24" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${rects}</svg>`;
  });

  const sprite = $('#sprite');
  if (sprite) sprite.innerHTML = spriteSvg.stand;

  /* ==========================================================
     Canvas: parallax starfield + pixel bursts
     ========================================================== */
  const starsCanvas = $('#stars');
  const burstCanvas = $('#burst');
  const sctx = starsCanvas.getContext('2d');
  const bctx = burstCanvas.getContext('2d');
  const SPEEDS = [0.03, 0.08, 0.16];
  let stars = [];
  let W = 0, H = 0, DPR = 1;

  function sizeCanvases() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    [starsCanvas, burstCanvas].forEach(c => { c.width = W * DPR; c.height = H * DPR; });
    sctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    bctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const count = Math.round((W * H) / 9000);
    stars = Array.from({ length: count }, () => {
      const layer = Math.random() < 0.55 ? 0 : (Math.random() < 0.6 ? 1 : 2);
      return {
        x: Math.round(Math.random() * W), y: Math.random() * H, layer,
        size: layer === 2 ? 3 : 2, alpha: 0.22 + Math.random() * 0.45,
        phase: Math.random() * 6.28,
        color: Math.random() < 0.09 ? COLORS[Math.floor(Math.random() * COLORS.length)] : '#cfd6ff'
      };
    });
    drawStars(0, window.scrollY);
  }

  function drawStars(t, y) {
    sctx.clearRect(0, 0, W, H);
    for (const s of stars) {
      let py = (s.y - y * SPEEDS[s.layer]) % H;
      if (py < 0) py += H;
      const twinkle = reduce ? 1 : 0.65 + 0.35 * Math.sin(t / 700 + s.phase);
      sctx.globalAlpha = s.alpha * twinkle;
      sctx.fillStyle = s.color;
      sctx.fillRect(s.x, Math.round(py), s.size, s.size);
    }
    sctx.globalAlpha = 1;
  }

  let particles = [];
  let burstRunning = false;

  function burst(x, y, count, power = 1) {
    if (reduce) return;
    for (let i = 0; i < count; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 9 * power,
        vy: (-2 - Math.random() * 7) * power,
        life: 1,
        size: 3 + Math.floor(Math.random() * 3),
        color: COLORS[Math.floor(Math.random() * COLORS.length)]
      });
    }
    if (!burstRunning) { burstRunning = true; requestAnimationFrame(stepBurst); }
  }

  function stepBurst() {
    bctx.clearRect(0, 0, W, H);
    particles = particles.filter(p => p.life > 0);
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.3; p.life -= 0.018;
      bctx.globalAlpha = Math.max(p.life, 0);
      bctx.fillStyle = p.color;
      bctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    bctx.globalAlpha = 1;
    if (particles.length) requestAnimationFrame(stepBurst);
    else { burstRunning = false; bctx.clearRect(0, 0, W, H); }
  }

  /* ==========================================================
     Achievement toasts
     ========================================================== */
  const TROPHY = '<svg viewBox="0 0 10 10" width="22" height="22" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true"><rect x="2" y="1" width="6" height="4"/><rect x="0" y="1" width="2" height="1"/><rect x="0" y="2" width="1" height="2"/><rect x="1" y="4" width="1" height="1"/><rect x="8" y="1" width="2" height="1"/><rect x="9" y="2" width="1" height="2"/><rect x="8" y="4" width="1" height="1"/><rect x="3" y="5" width="4" height="1"/><rect x="4" y="6" width="2" height="2"/><rect x="2" y="8" width="6" height="1"/></svg>';
  const toastBox = $('.toasts');
  const awarded = new Set();
  const queue = [];
  let showing = false;

  function award(key, title, text) {
    if (reduce || !toastBox || awarded.has(key)) return;
    awarded.add(key);
    queue.push({ title, text });
    if (!showing) nextToast();
  }

  function nextToast() {
    const item = queue.shift();
    if (!item) { showing = false; return; }
    showing = true;
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span class="ico">${TROPHY}</span><div><small>Achievement unlocked</small><span class="t-title"></span><span class="t-text"></span></div>`;
    $('.t-title', el).textContent = item.title;
    $('.t-text', el).textContent = item.text;
    toastBox.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => { el.remove(); nextToast(); }, 420);
    }, 3800);
  }

  /* ==========================================================
     HUD: levels, XP bar, stage tint
     ========================================================== */
  const hud = $('.hud');
  const xp = $('.xp');
  const marksEl = $('.xp-marks');
  const lvBox = $('.lv');
  const lvText = $('[data-lv]');
  const stageName = $('[data-stage-name]');
  const navLinks = $$('nav a');
  const sections = $$('[data-level]').map(el => ({ el, level: +el.dataset.level, name: el.dataset.name, hue: +el.dataset.hue }));
  const marks = sections.slice(1).map(s => {
    const i = document.createElement('i');
    marksEl.appendChild(i);
    return { i, s, m: 0 };
  });

  let docMax = 1;
  function measure() {
    docMax = Math.max(1, root.scrollHeight - window.innerHeight);
    marks.forEach(mk => {
      const top = mk.s.el.getBoundingClientRect().top + window.scrollY;
      mk.m = clamp((top - window.innerHeight * 0.55) / docMax, 0, 1);
      mk.i.style.setProperty('--m', mk.m.toFixed(4));
    });
  }

  let current = sections[0];
  let maxLevel = 1;

  function applyStage(s) {
    lvText.textContent = 'LV ' + String(s.level).padStart(2, '0');
    stageName.textContent = s.name;
    root.style.setProperty('--hue', s.hue);
    navLinks.forEach(link => {
      const active = link.hash === '#' + s.el.id;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }

  function levelUp() {
    if (reduce) return;
    lvBox.classList.remove('pop'); hud.classList.remove('flash');
    void hud.offsetWidth;
    lvBox.classList.add('pop'); hud.classList.add('flash');
    if (sprite) {
      sprite.classList.remove('jump'); void sprite.offsetWidth; sprite.classList.add('jump');
      const r = sprite.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + 6, 26);
    }
  }

  function pickStage(y) {
    const line = window.innerHeight * 0.55;
    let active = sections[0];
    for (const s of sections) if (s.el.getBoundingClientRect().top <= line) active = s;
    if (y >= docMax - 4) active = sections[sections.length - 1];
    return active;
  }

  function updateStage(y, silent) {
    const active = pickStage(y);
    if (active === current && !silent) return;
    current = active;
    applyStage(active);
    if (active.level > maxLevel) {
      maxLevel = active.level;
      if (!silent) levelUp();
    }
  }

  /* ==========================================================
     Quest chain (steps tick off as you scroll through the card)
     ========================================================== */
  const quest = $('[data-quest]');
  const questCard = quest ? quest.closest('.featured') : null;
  const steps = quest ? $$('li', quest) : [];
  const questState = $('[data-quest-state]');
  let questDone = -1;

  function updateQuest() {
    if (!quest) return;
    let n = steps.length;
    if (!reduce) {
      const r = questCard.getBoundingClientRect();
      const q = clamp((window.innerHeight * 0.8 - r.top) / (r.height * 0.8), 0, 1);
      n = Math.min(steps.length, Math.floor(q * steps.length + 0.001));
    }
    if (n === questDone) return;
    questDone = n;
    steps.forEach((li, i) => li.classList.toggle('done', i < n));
    const complete = n === steps.length;
    quest.classList.toggle('complete', complete);
    if (questState) {
      if (reduce) questState.textContent = '4 steps';
      else questState.textContent = complete ? 'Quest complete' : (n === 0 ? '4 steps' : n + '/' + steps.length);
    }
    if (complete) award('quest', 'Incident module is live', 'Went live in July 2026');
  }

  /* ==========================================================
     Skill tree and campaign trail (a beam fills as you scroll)
     ========================================================== */
  const tree = $('[data-tree]');
  const treeNodes = tree ? $$('.skill-row', tree) : [];
  const trail = $('[data-trail]');
  const trailNodes = trail ? $$('.job', trail) : [];

  function updateBeam(box, nodes, cls, padTop, padBottom, nodeOffset) {
    if (!box) return 0;
    let fill = 1;
    const head = window.innerHeight * 0.62;
    if (!reduce) {
      const r = box.getBoundingClientRect();
      fill = clamp((head - r.top - padTop) / Math.max(1, r.height - padTop - padBottom), 0, 1);
    }
    box.style.setProperty('--fill', fill.toFixed(3));
    nodes.forEach(n => {
      const on = reduce || head >= n.getBoundingClientRect().top + nodeOffset;
      if (on !== n.classList.contains(cls)) n.classList.toggle(cls, on);
    });
    return fill;
  }

  function updateBeams() {
    if (updateBeam(tree, treeNodes, 'unlocked', 20, 20, 48) >= 0.985) {
      award('stack', 'Full stack unlocked', 'From the interface to the query underneath');
    }
    if (updateBeam(trail, trailNodes, 'saved', 38, 0, 34) >= 0.985) {
      award('years', '2+ years in production', 'From requirements to release');
    }
  }

  /* ==========================================================
     Main loop
     ========================================================== */
  let lastY = window.scrollY;
  let idleSince = -1000;
  let frameName = 'stand';
  let lastStarDraw = 0;
  let first = true;

  function frame(t) {
    if (root.classList.contains('playing')) { lastY = window.scrollY; requestAnimationFrame(frame); return; }
    const y = window.scrollY;
    const delta = y - lastY;

    if (delta !== 0 || first) {
      const p = clamp(y / docMax, 0, 1);
      xp.style.setProperty('--p', p.toFixed(4));
      marks.forEach(mk => mk.i.classList.toggle('hit', p >= mk.m - 0.0005));
      updateStage(y, false);
      updateQuest();
      updateBeams();
      first = false;
    }

    if (!reduce && sprite) {
      if (delta !== 0) {
        idleSince = t;
        sprite.style.setProperty('--dir', delta > 0 ? 1 : -1);
      }
      const running = t - idleSince < 170;
      const want = running ? (Math.floor(t / 110) % 2 ? 'run1' : 'run2') : 'stand';
      if (want !== frameName) { frameName = want; sprite.innerHTML = spriteSvg[want]; }
    }

    if (!reduce && (delta !== 0 || t - lastStarDraw > 90)) {
      drawStars(t, y);
      lastStarDraw = t;
    } else if (reduce && delta !== 0) {
      drawStars(0, y);
    }

    lastY = y;
    requestAnimationFrame(frame);
  }

  sizeCanvases();
  measure();
  // Settle the HUD to wherever the page was restored to, without celebrating
  {
    const active = pickStage(window.scrollY);
    current = active; maxLevel = active.level; applyStage(active);
  }
  requestAnimationFrame(frame);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { sizeCanvases(); measure(); first = true; }, 120);
  });
  window.addEventListener('load', () => { measure(); first = true; });
  // Coming back from Play mode: re-measure once the page is on screen again
  window.addEventListener('portfolio:view', () => requestAnimationFrame(() => { measure(); first = true; sizeCanvases(); }));
  if ('ResizeObserver' in window) new ResizeObserver(() => { measure(); }).observe(document.body);

  /* ==========================================================
     Spawn-in reveals and counters
     ========================================================== */
  const spawnItems = $$('[data-spawn]');
  if (reduce || !hasIO) {
    spawnItems.forEach(el => el.classList.add('in'));
  } else {
    const spawnObserver = new IntersectionObserver(entries => {
      let order = 0;
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const delay = Math.min(order++, 5) * 0.09;
        el.style.setProperty('--d', delay + 's');
        el.classList.add('in');
        spawnObserver.unobserve(el);
        if (el.matches('h2')) {
          const head = el.closest('.section-head');
          if (head) { head.classList.add('shake'); setTimeout(() => head.classList.remove('shake'), 600); }
        }
        setTimeout(() => el.style.removeProperty('--d'), 2000 + delay * 1000);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    spawnItems.forEach(el => spawnObserver.observe(el));
  }

  // Headline: one glitch after it has typed itself out
  const heading = $('h1');
  if (heading && !reduce) {
    setTimeout(() => heading.classList.add('glitch'), 2700);
    setTimeout(() => heading.classList.remove('glitch'), 3400);
  }

  const counters = $$('.big-number, .metrics strong, .experience-total strong');

  function prepareCounter(el) {
    const node = Array.from(el.childNodes).find(n => n.nodeType === 3 && /\d/.test(n.textContent));
    if (!node) return null;
    const match = node.textContent.match(/^(\D*)(\d+)(.*)$/s);
    if (!match) return null;
    const [, prefix, digits, suffix] = match;
    node.textContent = prefix + '0' + suffix;
    return { node, prefix, suffix, target: parseInt(digits, 10) };
  }

  function runCounter(c, duration) {
    let start;
    const step = now => {
      if (start === undefined) start = now;
      const p = Math.min((now - start) / duration, 1);
      c.node.textContent = c.prefix + Math.round(c.target * (1 - Math.pow(1 - p, 4))) + c.suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  if (!reduce && hasIO) {
    const counterObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const c = entry.target.__counter;
        counterObserver.unobserve(entry.target);
        if (!c) return;
        const inHero = entry.target.classList.contains('big-number');
        setTimeout(() => runCounter(c, inHero ? 1800 : 1500), inHero ? 1900 : 300);
      });
    }, { threshold: 0.6 });
    counters.forEach(el => { el.__counter = prepareCounter(el); counterObserver.observe(el); });
  }

  // Achievements tied to sections coming into view
  if (hasIO && !reduce) {
    const watch = (selector, key, title, text, threshold) => {
      const target = $(selector);
      if (!target) return;
      const io = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) { award(key, title, text); io.disconnect(); }
      }, { threshold });
      io.observe(target);
    };
    watch('[data-metrics]', 'apis', '88+ production APIs', 'Delivered in 11 months at NAFFCO', 0.6);
    watch('.contact h2', 'final', 'Final level reached', 'Open to Full Stack, .NET and Angular roles', 0.7);
  }

  // Keep the HUD reachable for keyboard users
  if (hud) hud.addEventListener('focusin', () => hud.classList.remove('flash'));

  /* ==========================================================
     Cheat code: up up down down left right left right B A
     ========================================================== */
  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let konamiAt = 0;
  window.addEventListener('keydown', e => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    konamiAt = key === KONAMI[konamiAt] ? konamiAt + 1 : (key === KONAMI[0] ? 1 : 0);
    if (konamiAt === KONAMI.length) {
      konamiAt = 0;
      root.classList.toggle('cheat');
      burst(window.innerWidth / 2, window.innerHeight * 0.4, 90, 1.4);
      award('cheat', 'Cheat code accepted', 'Rainbow mode, courtesy of the Konami code');
    }
  });

  if (reduce || !finePointer) return;

  /* ==========================================================
     Pointer effects: card tilt, spotlight, magnetic buttons, lock-on reticle
     ========================================================== */
  $$('.project-card, .player-card').forEach(card => {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      card.style.setProperty('--rx', ((0.5 - y) * 6).toFixed(2) + 'deg');
      card.style.setProperty('--ry', ((x - 0.5) * 8).toFixed(2) + 'deg');
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
    card.addEventListener('pointerleave', () => {
      card.style.removeProperty('--rx');
      card.style.removeProperty('--ry');
      card.style.removeProperty('--mx');
      card.style.removeProperty('--my');
    });
  });

  $$('.featured, .metrics > div').forEach(card => {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  $$('.button, .contact-nav').forEach(btn => {
    btn.addEventListener('pointermove', e => {
      const r = btn.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.25;
      const y = (e.clientY - r.top - r.height / 2) * 0.35;
      btn.style.transform = `translate(${x}px, ${y}px)`;
    });
    btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
  });

  const reticle = document.createElement('div');
  reticle.className = 'reticle';
  reticle.setAttribute('aria-hidden', 'true');
  reticle.innerHTML = '<i></i><i></i><i></i><i></i>';
  document.body.appendChild(reticle);

  let mx = -100, my = -100, cx = -100, cy = -100, target = null;
  window.addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; reticle.classList.add('on'); }, { passive: true });
  document.addEventListener('pointerleave', () => reticle.classList.remove('on'));
  document.addEventListener('pointerover', e => {
    target = e.target.closest ? e.target.closest('a, summary, button, .tags span') : null;
    reticle.classList.toggle('lock', !!target);
  });

  (function follow() {
    if (target && document.contains(target)) {
      const r = target.getBoundingClientRect();
      const pad = 6;
      reticle.style.width = (r.width + pad * 2) + 'px';
      reticle.style.height = (r.height + pad * 2) + 'px';
      cx += (r.left - pad - cx) * 0.35;
      cy += (r.top - pad - cy) * 0.35;
    } else {
      reticle.style.width = '';
      reticle.style.height = '';
      cx += (mx - 17 - cx) * 0.25;
      cy += (my - 17 - cy) * 0.25;
    }
    reticle.style.transform = `translate(${cx}px, ${cy}px)`;
    requestAnimationFrame(follow);
  })();
})();
