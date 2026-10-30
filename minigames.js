/* ==========================================================
   Mini-games shown inside the project panels.
   Each game is MG.name(container, ctx) and returns a cleanup function.
   ctx.award(key, title, text) shows an achievement toast.
   ========================================================== */
(() => {
  'use strict';

  const MG = {};
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  const shuffle = arr => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const replay = (label, fn) => {
    const b = el('button', 'mg-btn ghost', label);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  };

  /* ---------- 1. Observation workflow: put the steps in order ---------- */
  MG.workflow = (box, ctx) => {
    const steps = (ctx.steps && ctx.steps.length ? ctx.steps : [
      { title: 'Raise & report', owner: 'Safety Officer' },
      { title: 'Verify the observation', owner: 'Line Manager' },
      { title: 'Take corrective action', owner: 'Responsible Person' },
      { title: 'Review & approve', owner: 'Line Manager → Manager → HOD' }
    ]);
    box.append(el('p', 'mg-intro', 'Put an observation through its workflow. Tap the steps in the order they happen.'));
    const bar = el('div', 'mg-bar');
    const prog = el('span', 'mg-chip');
    const timer = el('span', 'mg-chip', '0.0 s');
    bar.append(prog, timer);
    const list = el('div', 'mg-steps');
    const msg = el('p', 'mg-msg');
    msg.setAttribute('aria-live', 'polite');
    box.append(bar, list, msg);

    let next, t0, tick, order;

    function reset() {
      clearInterval(tick);
      next = 0; t0 = 0;
      order = shuffle(steps.map((_, i) => i));
      if (order.every((v, i) => v === i)) order.reverse();
      prog.textContent = '0/' + steps.length;
      timer.textContent = '0.0 s';
      msg.textContent = '';
      list.innerHTML = '';
      order.forEach(i => {
        const b = el('button', 'mg-step', `<strong>${esc(steps[i].title)}</strong><small>${esc(steps[i].owner)}</small>`);
        b.type = 'button';
        b.addEventListener('click', () => pick(i, b));
        list.append(b);
      });
    }

    function pick(i, b) {
      if (!t0) {
        t0 = performance.now();
        tick = setInterval(() => { timer.textContent = ((performance.now() - t0) / 1000).toFixed(1) + ' s'; }, 100);
      }
      if (i === next) {
        b.classList.add('done');
        b.disabled = true;
        b.insertAdjacentHTML('afterbegin', `<span class="mg-n">${next + 1}</span>`);
        next++;
        prog.textContent = next + '/' + steps.length;
        if (next === steps.length) finish();
      } else {
        b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
        msg.textContent = 'Not yet. Think about what has to happen first.';
      }
    }

    function finish() {
      clearInterval(tick);
      const secs = ((performance.now() - t0) / 1000).toFixed(1);
      timer.textContent = secs + ' s';
      msg.innerHTML = `<strong>Observation closed in ${secs} s.</strong> Defined ownership, traceable approvals.`;
      msg.append(' ', replay('Run it again', reset));
      list.classList.add('closed');
      setTimeout(() => list.classList.remove('closed'), 1200);
      ctx.award('workflow', 'Observation closed', 'Workflow completed in ' + secs + ' s');
    }

    reset();
    return () => clearInterval(tick);
  };

  /* ---------- 2. Role-based visibility ---------- */
  MG.roles = box => {
    const roles = ['Engineer', 'Manager', 'HOD'];
    const items = [
      { n: 'Request 1', s: 'Awaiting engineer', r: 0 },
      { n: 'Request 2', s: 'Drawing uploaded', r: 0 },
      { n: 'Request 3', s: 'In review', r: 0 },
      { n: 'Request 4', s: 'Awaiting manager', r: 1 },
      { n: 'Request 5', s: 'Pending approval', r: 1 },
      { n: 'Request 6', s: 'Escalated to HOD', r: 2 }
    ];
    box.append(el('p', 'mg-intro', 'Permission-aware request lists. Pick a role and see what that person can see. Demo data.'));
    const chips = el('div', 'mg-roles');
    const list = el('ul', 'mg-list');
    const msg = el('p', 'mg-msg');
    msg.setAttribute('aria-live', 'polite');
    box.append(chips, list, msg);
    const buttons = roles.map((name, level) => {
      const b = el('button', 'mg-btn', name);
      b.type = 'button';
      b.addEventListener('click', () => show(level));
      chips.append(b);
      return b;
    });
    function show(level) {
      buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(i === level)));
      const visible = items.filter(it => it.r <= level);
      list.innerHTML = visible.map(it => `<li><strong>${esc(it.n)}</strong><span>${esc(it.s)}</span></li>`).join('');
      msg.textContent = `${roles[level]} sees ${visible.length} of ${items.length} requests.`;
    }
    show(0);
    return () => {};
  };

  /* ---------- 3. Proof of delivery: sign to confirm ---------- */
  MG.signature = (box, ctx) => {
    box.append(el('p', 'mg-intro', 'Proof of delivery. Sign with your mouse or finger to confirm the delivery.'));
    const status = el('p', 'mg-status', '<span class="mg-dot"></span><b>Out for delivery</b>');
    const pad = el('canvas', 'mg-sig');
    pad.width = 640; pad.height = 180;
    pad.setAttribute('aria-label', 'Signature pad');
    const row = el('div', 'mg-row');
    const clear = el('button', 'mg-btn ghost', 'Clear');
    const confirm = el('button', 'mg-btn primary', 'Confirm delivery');
    clear.type = confirm.type = 'button';
    confirm.disabled = true;
    row.append(clear, confirm);
    box.append(status, pad, row);

    const g = pad.getContext('2d');
    g.lineWidth = 4; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#ffc53d';
    let drawing = false, ink = 0, last = null, locked = false;

    const pos = e => {
      const r = pad.getBoundingClientRect();
      return { x: (e.clientX - r.left) * pad.width / r.width, y: (e.clientY - r.top) * pad.height / r.height };
    };
    pad.addEventListener('pointerdown', e => {
      if (locked) return;
      drawing = true; last = pos(e);
      pad.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    pad.addEventListener('pointermove', e => {
      if (!drawing) return;
      const p = pos(e);
      g.beginPath(); g.moveTo(last.x, last.y); g.lineTo(p.x, p.y); g.stroke();
      ink += Math.hypot(p.x - last.x, p.y - last.y);
      last = p;
      confirm.disabled = ink < 120;
    });
    const stop = () => { drawing = false; };
    pad.addEventListener('pointerup', stop);
    pad.addEventListener('pointercancel', stop);

    clear.addEventListener('click', () => {
      g.clearRect(0, 0, pad.width, pad.height); ink = 0; confirm.disabled = true;
      locked = false; pad.classList.remove('locked');
      status.innerHTML = '<span class="mg-dot"></span><b>Out for delivery</b>';
      status.classList.remove('ok');
    });
    confirm.addEventListener('click', () => {
      locked = true; confirm.disabled = true; pad.classList.add('locked');
      status.classList.add('ok');
      status.innerHTML = '<span class="mg-dot"></span><b>Delivered</b> · signature attached';
      ctx.award('signature', 'Proof of delivery', 'Signature captured and attached');
    });
    return () => {};
  };

  /* ---------- 4. Notification router: per-app unread counts ---------- */
  MG.notify = (box, ctx) => {
    box.append(el('p', 'mg-intro', 'One notification service, many applications. Send an update, then open it to clear that app’s unread count.'));
    const apps = [
      { name: 'HSE', color: 'var(--hp)', n: 0 },
      { name: 'Delivery', color: 'var(--heal)', n: 0 },
      { name: 'HR self-service', color: 'var(--mp)', n: 0 }
    ];
    const grid = el('div', 'mg-apps');
    const total = el('p', 'mg-msg');
    total.setAttribute('aria-live', 'polite');
    box.append(grid, total);
    let cleared = 0;
    const tiles = apps.map(app => {
      const t = el('div', 'mg-app');
      t.style.setProperty('--c', app.color);
      const badge = el('span', 'mg-badge', '0');
      const send = el('button', 'mg-btn', 'Send update');
      const open = el('button', 'mg-btn ghost', 'Open');
      send.type = open.type = 'button';
      t.append(el('strong', '', esc(app.name)), badge, send, open);
      const note = el('small', 'mg-note', '');
      t.append(note);
      send.addEventListener('click', () => { app.n++; refresh(); badge.classList.remove('pop'); void badge.offsetWidth; badge.classList.add('pop'); });
      open.addEventListener('click', () => {
        if (!app.n) { note.textContent = 'Nothing new here.'; return; }
        note.textContent = `Deep link opened in ${app.name}.`;
        app.n = 0; cleared++; refresh();
        if (cleared === 3) ctx.award('notify', 'Inbox zero', 'Every application is read');
      });
      grid.append(t);
      return { app, badge };
    });
    function refresh() {
      tiles.forEach(({ app, badge }) => { badge.textContent = app.n; badge.classList.toggle('on', app.n > 0); });
      const sum = apps.reduce((a, b) => a + b.n, 0);
      total.textContent = sum ? `${sum} unread across applications.` : 'All caught up.';
    }
    refresh();
    return () => {};
  };

  /* ---------- 5. Safety monitoring: classify the alarms ---------- */
  let bestSignals = 0;
  MG.signals = (box, ctx) => {
    box.append(el('p', 'mg-intro', 'Sensor signals arrive in real time. Classify each alarm before it clears. 20 seconds.'));
    const bar = el('div', 'mg-bar');
    const score = el('span', 'mg-chip', 'Classified 0');
    const clock = el('span', 'mg-chip', '20.0 s');
    bar.append(score, clock);
    const grid = el('div', 'mg-signals');
    const msg = el('p', 'mg-msg');
    msg.setAttribute('aria-live', 'polite');
    const start = el('button', 'mg-btn primary', 'Start monitoring');
    start.type = 'button';
    box.append(bar, grid, msg, start);

    const tiles = Array.from({ length: 12 }, (_, i) => {
      const b = el('button', 'mg-tile', `<b>S${i + 1}</b><small>Normal</small>`);
      b.type = 'button';
      b.disabled = true;
      grid.append(b);
      return { b, state: 'idle', timer: 0 };
    });
    let running = false, hits = 0, total = 0, spawner = 0, clockTimer = 0, endAt = 0;

    function setState(t, state, text) {
      t.state = state;
      t.b.dataset.state = state;
      t.b.querySelector('small').textContent = text;
    }
    function flash(t, state, text) {
      setState(t, state, text);
      t.timer = setTimeout(() => setState(t, 'idle', 'Normal'), 260);
    }
    tiles.forEach(t => t.b.addEventListener('click', () => {
      if (!running || t.state !== 'alarm') return;
      clearTimeout(t.timer); hits++;
      score.textContent = 'Classified ' + hits;
      flash(t, 'ok', 'Classified');
    }));
    function spawn() {
      const idle = tiles.filter(t => t.state === 'idle');
      if (!idle.length) return;
      const t = idle[Math.floor(Math.random() * idle.length)];
      total++;
      setState(t, 'alarm', 'ALARM');
      t.timer = setTimeout(() => { if (t.state === 'alarm') flash(t, 'missed', 'Missed'); }, 1150);
    }
    function end() {
      running = false;
      clearInterval(spawner); clearInterval(clockTimer);
      tiles.forEach(t => { clearTimeout(t.timer); setState(t, 'idle', 'Normal'); t.b.disabled = true; });
      clock.textContent = '0.0 s';
      const best = hits > bestSignals;
      bestSignals = Math.max(bestSignals, hits);
      msg.innerHTML = `<strong>Classified ${hits} of ${total} alarms.</strong> ${hits >= total * 0.8 ? 'Control room ready.' : 'Good start. Try again.'}${best && hits ? ' New best.' : ''}`;
      start.hidden = false;
      start.textContent = 'Play again';
      if (total && hits >= total * 0.8) ctx.award('signals', 'Control room ready', `Classified ${hits} of ${total} alarms`);
    }
    start.addEventListener('click', () => {
      hits = 0; total = 0; msg.textContent = '';
      score.textContent = 'Classified 0';
      start.hidden = true; running = true;
      tiles.forEach(t => { t.b.disabled = false; });
      endAt = performance.now() + 20000;
      spawn();
      spawner = setInterval(spawn, 650);
      clockTimer = setInterval(() => {
        const left = Math.max(0, endAt - performance.now());
        clock.textContent = (left / 1000).toFixed(1) + ' s';
        if (left <= 0) end();
      }, 100);
    });
    return () => { running = false; clearInterval(spawner); clearInterval(clockTimer); tiles.forEach(t => clearTimeout(t.timer)); };
  };

  /* ---------- 6. Booking: walk a booking from discovery to fulfillment ---------- */
  MG.booking = (box, ctx) => {
    const stages = ['Discovery', 'Scheduling', 'Payment', 'Confirmation', 'Fulfillment'];
    box.append(el('p', 'mg-intro', 'Walk a booking through every stage, from discovery to fulfillment.'));
    const rail = el('ol', 'mg-rail');
    stages.forEach(s => rail.append(el('li', '', esc(s))));
    const msg = el('p', 'mg-msg');
    msg.setAttribute('aria-live', 'polite');
    const go = el('button', 'mg-btn primary');
    go.type = 'button';
    box.append(rail, msg, go);
    let at = 0;
    function paint() {
      Array.from(rail.children).forEach((li, i) => {
        li.classList.toggle('done', i < at);
        li.classList.toggle('now', i === at);
      });
      if (at >= stages.length) {
        msg.innerHTML = '<strong>Booking fulfilled.</strong> Every stage handled end to end.';
        go.textContent = 'Book another';
      } else {
        msg.textContent = `Stage ${at + 1} of ${stages.length}: ${stages[at]}.`;
        go.textContent = at === 0 ? 'Start booking' : `Complete ${stages[at].toLowerCase()}`;
      }
    }
    go.addEventListener('click', () => {
      if (at >= stages.length) { at = 0; paint(); return; }
      at++;
      paint();
      if (at === stages.length) ctx.award('booking', 'Booking fulfilled', 'Discovery to fulfillment');
    });
    paint();
    return () => {};
  };

  window.MiniGames = MG;
})();
