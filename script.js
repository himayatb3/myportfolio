/*
  Story engine
  The page is a tall scroll track with a sticky, full-screen stage on top.
  Each .scene owns a slice of the scroll (data-len, in screen heights).
  Inside a scene, elements react to the scene's progress p (0 → 1):
    data-in=".3"            reveal once p reaches .3 (and hide again when scrolling back)
    data-fill=".2,.7"       sets --f from 0 → 1 between those points (lines, scale)
    .scrub data-from/to     lights words one by one
    data-count data-from/to counts a number up
*/
(() => {
  'use strict';
  window.__story = true;

  const root = document.documentElement;
  const story = root.classList.contains('js');
  const resume = document.getElementById('resume');

  /* ---------- Résumé (works in every mode) ---------- */
  function openResume(e) {
    if (e) e.preventDefault();
    if (story && resume && typeof resume.showModal === 'function') {
      resume.showModal();
      resume.scrollTop = 0;
    } else if (resume) {
      resume.scrollIntoView();
    }
  }
  document.querySelectorAll('[data-open-resume]').forEach(el => el.addEventListener('click', openResume));
  document.querySelectorAll('[data-close-resume]').forEach(el => el.addEventListener('click', () => resume.close()));
  if (resume) resume.addEventListener('click', e => { if (e.target === resume) resume.close(); });

  if (!story) return;

  /* ---------- Setup ---------- */
  const track = document.querySelector('.story');
  const scenes = Array.from(document.querySelectorAll('.scene')).map(el => ({
    el,
    len: parseFloat(el.dataset.len) || 1.5,
    chapter: el.dataset.chapter || '',
    title: el.dataset.title || '',
    tone: el.dataset.tone || 'lime',
    reveals: Array.from(el.querySelectorAll('[data-in]')).map(r => ({
      el: r, at: parseFloat(r.dataset.in) || 0, out: r.dataset.out ? parseFloat(r.dataset.out) : 9, on: false
    })),
    fills: Array.from(el.querySelectorAll('[data-fill]')).map(f => {
      const [a, b] = f.dataset.fill.split(',').map(Number);
      return { el: f, a, b, v: -1 };
    }),
    scrubs: Array.from(el.querySelectorAll('.scrub')).map(s => ({
      words: splitWords(s), from: parseFloat(s.dataset.from) || 0, to: parseFloat(s.dataset.to) || 1, v: -1
    })),
    counts: Array.from(el.querySelectorAll('[data-count]')).map(c => ({
      el: c, target: parseFloat(c.dataset.count), from: parseFloat(c.dataset.from) || 0, to: parseFloat(c.dataset.to) || 1, v: -1
    })),
    start: 0, op: -1, vis: null
  }));

  // Wrap each word of a narration line in a span, keeping inner tags like <em>
  function splitWords(container) {
    const words = [];
    const walk = node => {
      Array.from(node.childNodes).forEach(child => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const w = document.createElement('span');
            w.className = 'w';
            w.textContent = part;
            frag.appendChild(w);
            words.push(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    };
    walk(container);
    return words;
  }

  /* ---------- Timeline (chapter dots) ---------- */
  const timeline = document.querySelector('.timeline ol');
  const timelineFill = document.querySelector('.timeline');
  const ticks = scenes.map((s, i) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    const label = s.title ? `${s.chapter}: ${s.title}` : s.chapter;
    btn.setAttribute('aria-label', 'Go to ' + label);
    btn.innerHTML = `<span>${label}</span>`;
    btn.addEventListener('click', () => goTo(i));
    li.appendChild(btn);
    timeline.appendChild(li);
    return li;
  });

  /* ---------- Layout ---------- */
  let vh = window.innerHeight;
  let trackTop = 0;
  let total = 0;

  function layout() {
    vh = window.innerHeight;
    let acc = 0;
    scenes.forEach(s => { s.start = acc; acc += s.len * vh; });
    total = acc;
    track.style.height = (total + vh) + 'px';
    trackTop = track.getBoundingClientRect().top + window.scrollY;
    scenes.forEach((s, i) => { ticks[i].style.left = (s.start / total * 100) + '%'; });
    ticks[ticks.length - 1].style.left = '100%';
  }

  function goTo(i) {
    const s = scenes[i];
    const y = i === 0 ? 0 : trackTop + s.start + s.len * vh * (i === scenes.length - 1 ? 0.9 : 0.8);
    window.scrollTo({ top: y, behavior: 'smooth' });
  }
  document.querySelectorAll('[data-chapter-jump]').forEach(el => el.addEventListener('click', e => {
    e.preventDefault();
    goTo(parseInt(el.dataset.chapterJump, 10) || 0);
  }));
  document.querySelectorAll('[data-skip]').forEach(el => el.addEventListener('click', () => goTo(scenes.length - 1)));

  /* ---------- Render loop ---------- */
  const clamp = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const hudChapter = document.querySelector('.hud-chapter');
  const hudNum = hudChapter.querySelector('.hud-num');
  const hudName = hudChapter.querySelector('.hud-name');
  const cue = document.querySelector('.cue');
  const floor = document.querySelector('.floor');

  // Mouse parallax: the whole stage leans gently toward the pointer (mouse devices only)
  const tilt = { x: 0, y: 0 };
  const tiltTarget = { x: 0, y: 0 };
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    window.addEventListener('pointermove', e => {
      tiltTarget.x = (e.clientY / window.innerHeight - 0.5) * -5;
      tiltTarget.y = (e.clientX / window.innerWidth - 0.5) * 7;
    }, { passive: true });
    document.addEventListener('pointerleave', () => { tiltTarget.x = 0; tiltTarget.y = 0; });
  }
  let active = -1;
  let smooth = Math.max(0, window.scrollY - trackTop);
  let lastSmooth = -1;

  function render(y) {
    const last = scenes.length - 1;

    scenes.forEach((s, i) => {
      const p = (y - s.start) / (s.len * vh);

      // Scene fades: in over the first 8%, out over the last 10%
      const enter = i === 0 ? 1 : clamp(p / 0.08);
      const exit = i === last ? 1 : clamp((1 - p) / 0.1);
      const op = Math.min(enter, exit);
      const visible = op > 0.001;

      if (visible !== s.vis) {
        s.el.style.visibility = visible ? 'visible' : 'hidden';
        s.el.setAttribute('aria-hidden', visible ? 'false' : 'true');
        s.vis = visible;
      }
      if (!visible && s.op === 0) return;
      // 3D travel: a new scene rises out of the distance, the old one flies past the camera
      const out = 1 - exit;
      const into = 1 - enter;
      let ty, tz, rx;
      if (out > 0) { const e = easeOut(out); ty = -50 * e; tz = 360 * e; rx = -10 * e; }
      else { const e = into * into; ty = 90 * e; tz = -520 * e; rx = 16 * e; }
      const transform = `perspective(1400px) translate3d(0,${ty.toFixed(1)}px,${tz.toFixed(1)}px) rotateX(${(rx + tilt.x).toFixed(2)}deg) rotateY(${tilt.y.toFixed(2)}deg)`;
      if (transform !== s.tf) { s.el.style.transform = transform; s.tf = transform; }
      if (Math.abs(op - s.op) > 0.001 || op === 0 || op === 1) {
        s.el.style.opacity = op.toFixed(3);
        s.op = op;
      }

      // Element reveals
      s.reveals.forEach(r => {
        const on = p >= r.at && p < r.out;
        if (on !== r.on) { r.el.classList.toggle('on', on); r.on = on; }
      });

      // Progress-driven fills
      s.fills.forEach(f => {
        const v = clamp((p - f.a) / (f.b - f.a));
        if (Math.abs(v - f.v) > 0.0005) { f.el.style.setProperty('--f', v.toFixed(4)); f.v = v; }
      });

      // Word-by-word narration
      s.scrubs.forEach(sc => {
        const t = clamp((p - sc.from) / (sc.to - sc.from));
        if (Math.abs(t - sc.v) < 0.0005) return;
        sc.v = t;
        const n = sc.words.length;
        sc.words.forEach((w, k) => {
          const lit = clamp(t * n - k);
          w.style.opacity = (0.13 + 0.87 * lit).toFixed(3);
        });
      });

      // Counters
      s.counts.forEach(c => {
        const t = easeOut(clamp((p - c.from) / (c.to - c.from)));
        const v = Math.round(c.target * t);
        if (v !== c.v) { c.el.textContent = v; c.v = v; }
      });
    });

    // Which chapter are we in?
    let current = 0;
    scenes.forEach((s, i) => { if (y >= s.start - 1) current = i; });
    if (current !== active) setChapter(current);

    // HUD, timeline, letterbox, cue
    timelineFill.style.setProperty('--progress', clamp(y / total).toFixed(4));
    ticks.forEach((t, i) => t.classList.toggle('passed', y >= scenes[i].start - 1));
    root.style.setProperty('--bars', (1 - clamp((y / vh - 0.25) / 0.9)).toFixed(3));
    if (floor) {
      floor.style.setProperty('--gy', ((y * 0.35) % 90).toFixed(1) + 'px');
      floor.style.setProperty('--fz', (tilt.y * -0.6).toFixed(2) + 'deg');
    }
    cue.classList.toggle('gone', y > 30);
  }

  let swapTimer;
  function setChapter(i) {
    const prev = active;
    active = i;
    const s = scenes[i];
    document.body.dataset.tone = s.tone;
    ticks.forEach((t, k) => t.classList.toggle('current', k === i));
    if (prev === -1) {
      hudNum.textContent = s.chapter;
      hudName.textContent = s.title;
      return;
    }
    hudChapter.classList.add('swap');
    clearTimeout(swapTimer);
    swapTimer = setTimeout(() => {
      hudNum.textContent = s.chapter;
      hudName.textContent = s.title;
      hudChapter.classList.remove('swap');
    }, 250);
  }

  // Smoothly follow the real scroll position so scrubbed text glides instead of stepping
  let lastTime = performance.now();
  function frame(now) {
    // Time-based easing: same feel at 30, 60 or 120 frames per second
    const dt = Math.min((now || performance.now()) - lastTime, 100);
    lastTime = now || performance.now();
    const k = 1 - Math.exp(-dt / 110);
    const target = Math.min(Math.max(window.scrollY - trackTop, 0), total);
    smooth += (target - smooth) * k;
    if (Math.abs(target - smooth) < 0.3) smooth = target;

    // Ease the stage tilt toward the pointer
    const dx = tiltTarget.x - tilt.x, dy = tiltTarget.y - tilt.y;
    const tilting = Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01;
    if (tilting) { const kt = 1 - Math.exp(-dt / 200); tilt.x += dx * kt; tilt.y += dy * kt; }

    if (smooth !== lastSmooth || tilting) {
      render(smooth);
      lastSmooth = smooth;
    }
    requestAnimationFrame(frame);
  }

  layout();
  if (window.scrollY > 40) root.classList.add('no-opening');
  render(smooth);
  requestAnimationFrame(frame);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const ratio = total ? Math.max(window.scrollY - trackTop, 0) / total : 0;
      layout();
      window.scrollTo(0, trackTop + ratio * total);
      scenes.forEach(s => { s.op = -1; s.fills.forEach(f => f.v = -1); s.scrubs.forEach(sc => sc.v = -1); });
      lastSmooth = -1;
    }, 150);
  });

  // Keyboard: PageDown / PageUp move one chapter at a time
  window.addEventListener('keydown', e => {
    if (resume && resume.open) return;
    if (e.key !== 'PageDown' && e.key !== 'PageUp') return;
    e.preventDefault();
    const next = e.key === 'PageDown' ? Math.min(active + 1, scenes.length - 1) : Math.max(active - 1, 0);
    goTo(next);
  });
})();
