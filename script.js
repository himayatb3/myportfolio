(() => {
  'use strict';
  window.__motion = true;

  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasIO = 'IntersectionObserver' in window;

  /* ---------- Active navigation ---------- */
  const links = Array.from(document.querySelectorAll('nav a'));
  if (hasIO) {
    const navObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        links.forEach(link => {
          const active = link.hash === '#' + entry.target.id;
          link.classList.toggle('active', active);
          if (active) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-10% 0px -65% 0px' });
    links.forEach(link => {
      const section = document.querySelector(link.hash);
      if (section) navObserver.observe(section);
    });
  }

  /* ---------- Scroll reveal ---------- */
  const revealSelector = [
    '.section-head .eyebrow', '.section-head h2', '.section-head > p',
    '.featured', '.project-card', '.additional-project', '.metrics > div',
    '.skill-row', '.experience-title > *', '.job', '.education',
    '.contact-top', '.contact h2', '.contact-links', 'footer'
  ].join(',');
  const revealItems = document.querySelectorAll(revealSelector);

  if (reduce || !hasIO) {
    revealItems.forEach(el => el.classList.add('in'));
  } else {
    const revealObserver = new IntersectionObserver(entries => {
      let order = 0;
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const delay = Math.min(order++, 6) * 0.09;
        el.style.setProperty('--d', delay + 's');
        el.classList.add('in');
        revealObserver.unobserve(el);
        // Drop the stagger delay afterwards so hover effects respond instantly
        setTimeout(() => el.style.removeProperty('--d'), 2000 + delay * 1000);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revealItems.forEach(el => revealObserver.observe(el));
  }

  // Let the headline's highlight breathe once its entrance is done
  const heading = document.querySelector('h1');
  if (heading) setTimeout(() => heading.classList.add('done'), reduce ? 0 : 2100);

  /* ---------- Number counters ---------- */
  const counters = document.querySelectorAll('.big-number, .metrics strong, .experience-total strong');

  function prepareCounter(el) {
    const node = Array.from(el.childNodes).find(n => n.nodeType === 3 && /\d/.test(n.textContent));
    if (!node) return null;
    const match = node.textContent.match(/^(\D*)(\d+)(.*)$/s);
    if (!match) return null;
    const [, prefix, digits, suffix] = match;
    node.textContent = prefix + '0' + suffix;
    return { node, prefix, suffix, target: parseInt(digits, 10) };
  }

  function runCounter(c, duration = 1800) {
    let start;
    const step = now => {
      if (start === undefined) start = now;
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 4);
      c.node.textContent = c.prefix + Math.round(c.target * eased) + c.suffix;
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
        setTimeout(() => runCounter(c, inHero ? 2000 : 1800), inHero ? 900 : 250);
      });
    }, { threshold: 0.6 });
    counters.forEach(el => {
      el.__counter = prepareCounter(el);
      counterObserver.observe(el);
    });
  }

  /* ---------- Scroll-driven effects (one rAF loop) ---------- */
  const header = document.querySelector('header');
  const progress = document.querySelector('.progress');
  const heroNote = document.querySelector('.hero-note');
  const marqueeTrack = document.querySelector('.marquee-track');
  const marqueeAnim = marqueeTrack && marqueeTrack.getAnimations ? marqueeTrack.getAnimations()[0] : null;

  let lastY = window.scrollY;
  let marqueeRate = 1;
  let marqueeDir = 1;

  function frame() {
    const y = window.scrollY;
    const delta = y - lastY;

    if (delta !== 0 || frame.first) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (progress) progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;

      if (header) {
        header.classList.toggle('scrolled', y > 10);
        if (delta > 4 && y > 320) header.classList.add('hide');
        else if (delta < -4 || y < 320) header.classList.remove('hide');
      }

      if (heroNote && !reduce && window.innerWidth > 760 && y < window.innerHeight * 1.3) {
        heroNote.style.setProperty('--py', (y * -0.12).toFixed(1) + 'px');
      }
      frame.first = false;
    }

    if (marqueeAnim && !reduce) {
      if (delta) marqueeDir = delta > 0 ? 1 : -1;
      const target = marqueeDir * (1 + Math.min(Math.abs(delta) * 0.18, 6));
      marqueeRate += (target - marqueeRate) * 0.07;
      marqueeAnim.playbackRate = marqueeRate;
    }

    lastY = y;
    requestAnimationFrame(frame);
  }
  frame.first = true;
  requestAnimationFrame(frame);

  // Keep the header visible when keyboard focus lands in it
  if (header) header.addEventListener('focusin', () => header.classList.remove('hide'));

  if (reduce || !finePointer) return;

  /* ---------- Card spotlight ---------- */
  document.querySelectorAll('.featured, .project-card').forEach(card => {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  /* ---------- Magnetic buttons ---------- */
  document.querySelectorAll('.button, .contact-nav').forEach(btn => {
    btn.addEventListener('pointermove', e => {
      const r = btn.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.25;
      const y = (e.clientY - r.top - r.height / 2) * 0.35;
      btn.style.transform = `translate(${x}px, ${y}px)`;
    });
    btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
  });

  /* ---------- Cursor ring ---------- */
  const cursor = document.createElement('div');
  cursor.className = 'cursor';
  cursor.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cursor);

  let mx = -100, my = -100, cx = -100, cy = -100;
  window.addEventListener('pointermove', e => {
    mx = e.clientX; my = e.clientY;
    cursor.classList.add('on');
  }, { passive: true });
  document.addEventListener('pointerleave', () => cursor.classList.remove('on'));

  const interactive = 'a, summary, button, .tags span';
  document.addEventListener('pointerover', e => {
    cursor.classList.toggle('hover', !!e.target.closest(interactive));
  });

  (function follow() {
    cx += (mx - cx) * 0.2;
    cy += (my - cy) * 0.2;
    cursor.style.transform = `translate(${cx}px, ${cy}px)`;
    requestAnimationFrame(follow);
  })();
})();
