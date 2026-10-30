/* ==========================================================
   PLAY MODE — a side-scrolling world built from the portfolio.
   Run and jump with the keyboard or the touch buttons.
   Collect the tech stack, stomp bugs, open doors, jump into
   skill blocks and grab checkpoint flags.
   Content in the panels is read from the Classic view markup,
   so there is one source of truth.
   ========================================================== */
(() => {
  'use strict';

  const gameEl = document.getElementById('game');
  const canvas = document.getElementById('world');
  if (!gameEl || !canvas) return;

  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const MG = window.MiniGames || {};
  const g = canvas.getContext('2d');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  /* ---------- Elements ---------- */
  const fab = $('#play-fab');
  const startEl = $('#start');
  const dialog = $('#panel');
  const pTitle = $('#panel-title');
  const pBody = $('.panel-body', dialog);
  const hudLevel = $('[data-g-level]');
  const hudZone = $('[data-g-zone]');
  const hudCoins = $('[data-g-coins]');
  const hudBugs = $('[data-g-bugs]');
  const hudExplored = $('[data-g-explored]');
  const hudBar = $('[data-g-bar]');
  const hudHint = $('[data-g-hint]');
  const bannerEl = $('[data-g-banner]');
  const liveEl = $('[data-g-live]');
  const soundBtn = $('[data-g-sound]');
  const toastBox = $('.toasts');

  /* ---------- State ---------- */
  let mode = root.classList.contains('playing') ? 'play' : 'classic';
  let started = false, panelOpen = false, running = false;
  let soundOn = true, audio = null;
  let VW = 480, VH = 270, SCALE = 3, groundY = 200;
  let frameCount = 0, camX = 0;
  let coinCount = 0, bugCount = 0, maxLevel = 1;
  let jumpBuffer = 0, coyote = 0, actionQueued = false;
  const visited = new Set();
  const awarded = new Set();

  /* ---------- World data ---------- */
  const WORLD_W = 5800;
  const ZONES = [
    { level: 1, name: 'Title screen', x0: 0, x1: 1000, hue: 228, accent: '#ffc53d' },
    { level: 2, name: 'Quest log', x0: 1000, x1: 2900, hue: 256, accent: '#5b8cff', hint: 'Walk to a door and press E' },
    { level: 3, name: 'Skill tree', x0: 2900, x1: 4100, hue: 200, accent: '#3df2b0', hint: 'Jump into the blocks from below' },
    { level: 4, name: 'Campaign log', x0: 4100, x1: 5000, hue: 278, accent: '#b78bff', hint: 'Walk to a flag and press E' },
    { level: 5, name: 'Final stage', x0: 5000, x1: 5800, hue: 228, accent: '#ff5470', hint: 'Enter the gate' }
  ];
  const TECH = ['ASP.NET Core', 'Angular', 'SQL Server', 'SignalR', 'TypeScript', 'Dapper', 'Firebase', 'QuestPDF', 'RxJS', 'EF Core'];
  const COIN_AT = [[330, 22], [430, 22], [565, 78], [700, 22], [860, 82], [1105, 76], [1330, 22], [1640, 80], [1930, 22], [2240, 80]];
  const coins = COIN_AT.map(([x, h], i) => ({ x, h, label: TECH[i], got: false }));
  const platforms = [
    { x: 520, w: 90, top: 56 }, { x: 820, w: 80, top: 60 }, { x: 1060, w: 90, top: 54 },
    { x: 1590, w: 100, top: 58 }, { x: 2190, w: 100, top: 58 }, { x: 3150, w: 90, top: 52 },
    { x: 3600, w: 90, top: 52 }, { x: 4450, w: 90, top: 56 }, { x: 5200, w: 90, top: 56 }
  ];
  const DOORS = [
    { id: 'hse', x: 1180, label: 'Main quest: HSE', color: '#ff5470' },
    { id: 'eng', x: 1480, label: 'Engineering', color: '#5b8cff' },
    { id: 'delivery', x: 1780, label: 'Delivery', color: '#3df2b0' },
    { id: 'notify', x: 2080, label: 'Notifications', color: '#ffc53d' },
    { id: 'realtime', x: 2380, label: 'Real-time', color: '#b78bff' },
    { id: 'logic', x: 2680, label: 'Logic Hub', color: '#8f98c7' }
  ];
  const BLOCKS = [
    { id: 'skill-backend', x: 3060, color: '#5b8cff' },
    { id: 'skill-frontend', x: 3280, color: '#3df2b0' },
    { id: 'skill-data', x: 3500, color: '#ffc53d' },
    { id: 'skill-integration', x: 3720, color: '#b78bff' },
    { id: 'skill-cloud', x: 3940, color: '#ff5470', progress: true }
  ].map(b => Object.assign(b, { bottom: 56, bump: 0, hit: false }));
  const FLAGS = [
    { id: 'job-naffco', x: 4300, label: 'NAFFCO', color: '#b78bff' },
    { id: 'job-logic', x: 4640, label: 'Logic Hub', color: '#5b8cff' },
    { id: 'education', x: 4880, label: 'Origin', color: '#3df2b0' }
  ];
  const GATE = { id: 'contact', x: 5500 };
  const BUGS = [
    [600, 560, 770], [1330, 1260, 1400], [1930, 1860, 2000], [2530, 2440, 2620],
    [3180, 3110, 3250], [3820, 3770, 3880], [4460, 4380, 4560], [5100, 5060, 5240]
  ].map(([x, min, max], i) => ({ x, min, max, dir: i % 2 ? -1 : 1, alive: true }));
  const TOTAL = DOORS.length + BLOCKS.length + FLAGS.length + 1;

  const player = { x: 140, y: 100, w: 12, h: 22, vx: 0, vy: 0, face: 1, onGround: false, hurt: 0, run: 0 };
  let particles = [];

  /* ---------- Sprites (pixel maps drawn once) ---------- */
  function makeSprite(rows, pal, scale) {
    const c = document.createElement('canvas');
    c.width = rows[0].length * scale; c.height = rows.length * scale;
    const x = c.getContext('2d');
    rows.forEach((row, y) => Array.from(row).forEach((ch, i) => {
      if (pal[ch]) { x.fillStyle = pal[ch]; x.fillRect(i * scale, y * scale, scale, scale); }
    }));
    return c;
  }
  const HEAD = ['....hhhh....', '...hhhhhh...', '...hvvvvh...', '...hvwvvh...', '...hhhhhh...', '....bbbb....', '...bmmmmb...'];
  const BODY = {
    stand: ['..bbmmmmbb..', '...bmmmmb...', '....kkkk....', '....kk.kk...', '...rr..rr...'],
    run1: ['.bbmmmmb....', '...bmmmmbb..', '....kkkk....', '...kk...kk..', '..rr.....rr.'],
    run2: ['...bmmmmbb..', '.bbmmmmb....', '....kkkk....', '....kkkk....', '....rrrr....']
  };
  const PPAL = { h: '#ffc53d', v: '#0a0c1a', w: '#e9ecff', b: '#5b8cff', m: '#3df2b0', k: '#2b3163', r: '#ff5470' };
  const PLAYER = {};
  Object.keys(BODY).forEach(k => { PLAYER[k] = makeSprite(HEAD.concat(BODY[k]), PPAL, 2); });
  const BUG_A = ['..k....k..', '...k..k...', '..rrrrrr..', '.rrwrrwrr.', 'rrrrrrrrrr', 'rrrrrrrrrr', '.rr.rr.rr.', 'r..r..r..r'];
  const BUG_B = ['..k....k..', '...k..k...', '..rrrrrr..', '.rrwrrwrr.', 'rrrrrrrrrr', 'rrrrrrrrrr', '.rr.rr.rr.', 'r.r..r..r.'];
  const BPAL = { r: '#ff5470', k: '#2b3163', w: '#e9ecff' };
  const BUGSPR = [makeSprite(BUG_A, BPAL, 2), makeSprite(BUG_B, BPAL, 2)];
  const COIN = makeSprite(['..oooo..', '.oyyyyo.', 'oyyhhyyo', 'oyyhhyyo', 'oyyyyyyo', 'oyyyyyyo', '.oyyyyo.', '..oooo..'], { o: '#c98a00', y: '#ffc53d', h: '#fff3c4' }, 2);
  const QMARK = ['.###.', '#...#', '....#', '..##.', '..#..', '.....', '..#..'];
  const CHECK = ['....#', '...##', '#.##.', '.###.', '..#..'];
  function glyph(rows, x, y, color, s = 1) {
    g.fillStyle = color;
    rows.forEach((row, j) => Array.from(row).forEach((ch, i) => { if (ch === '#') g.fillRect(x + i * s, y + j * s, s, s); }));
  }

  /* ---------- Audio ---------- */
  function ensureAudio() {
    if (audio) { if (audio.state === 'suspended') audio.resume(); return; }
    try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audio = null; }
  }
  function beep(f, d = 0.08, type = 'square', v = 0.035, slide = 0) {
    if (!soundOn || !audio) return;
    const o = audio.createOscillator(), gn = audio.createGain(), t = audio.currentTime;
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.linearRampToValueAtTime(Math.max(40, f + slide), t + d);
    gn.gain.setValueAtTime(v, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(gn); gn.connect(audio.destination); o.start(t); o.stop(t + d);
  }
  const sfx = {
    jump: () => beep(330, 0.13, 'square', 0.03, 280),
    coin: () => { beep(880, 0.06); setTimeout(() => beep(1320, 0.1), 60); },
    stomp: () => beep(180, 0.12, 'sawtooth', 0.04, -100),
    hurt: () => beep(150, 0.22, 'sawtooth', 0.04, -70),
    open: () => { beep(520, 0.08); setTimeout(() => beep(780, 0.12), 80); },
    bump: () => beep(210, 0.08, 'square', 0.04),
    level: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.12), i * 90))
  };

  /* ---------- Toasts, banner, HUD ---------- */
  const TROPHY = '<svg viewBox="0 0 10 10" width="22" height="22" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true"><rect x="2" y="1" width="6" height="4"/><rect x="0" y="1" width="2" height="1"/><rect x="0" y="2" width="1" height="2"/><rect x="1" y="4" width="1" height="1"/><rect x="8" y="1" width="2" height="1"/><rect x="9" y="2" width="1" height="2"/><rect x="8" y="4" width="1" height="1"/><rect x="3" y="5" width="4" height="1"/><rect x="4" y="6" width="2" height="2"/><rect x="2" y="8" width="6" height="1"/></svg>';
  const queue = [];
  let showing = false;
  function award(key, title, text) {
    if (awarded.has(key)) return;
    awarded.add(key);
    queue.push({ title, text });
    if (!showing) nextToast();
  }
  function nextToast() {
    const item = queue.shift();
    if (!item || !toastBox) { showing = false; return; }
    showing = true;
    const t = el('div', 'toast', `<span class="ico">${TROPHY}</span><div><small>Achievement unlocked</small><span class="t-title"></span><span class="t-text"></span></div>`);
    $('.t-title', t).textContent = item.title;
    $('.t-text', t).textContent = item.text;
    toastBox.appendChild(t);
    if (liveEl) liveEl.textContent = 'Achievement unlocked: ' + item.title;
    setTimeout(() => { t.classList.add('out'); setTimeout(() => { t.remove(); nextToast(); }, 420); }, 3400);
  }
  function small(text, wx, wy) {
    // quick floating label where a coin was collected
    const t = el('div', 'coin-pop');
    t.textContent = '+ ' + text;
    t.style.left = Math.round((wx - camX) * SCALE) + 'px';
    t.style.top = Math.round(wy * SCALE - 24) + 'px';
    gameEl.appendChild(t);
    setTimeout(() => t.remove(), 1100);
  }
  function updateHud() {
    hudCoins.textContent = coinCount + '/' + coins.length;
    hudBugs.textContent = String(bugCount);
    hudExplored.textContent = visited.size + '/' + TOTAL;
    hudBar.style.width = (visited.size / TOTAL * 100) + '%';
  }
  function showBanner(z) {
    bannerEl.innerHTML = `<small>Level ${String(z.level).padStart(2, '0')}</small><b>${esc(z.name)}</b>${z.hint ? `<span>${esc(z.hint)}</span>` : ''}`;
    bannerEl.classList.remove('show'); void bannerEl.offsetWidth; bannerEl.classList.add('show');
    if (liveEl) liveEl.textContent = 'Level ' + z.level + ': ' + z.name;
  }
  function hideHint() { if (hudHint) hudHint.classList.add('gone'); }

  /* ---------- Input ---------- */
  const keys = { left: false, right: false, jump: false };
  const touch = { left: false, right: false, jump: false };
  const KEYMAP = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'jump', w: 'jump', W: 'jump', ' ': 'jump' };
  const ACTION = new Set(['e', 'E', 'Enter', 'ArrowDown', 's', 'S']);
  function releaseKeys() { keys.left = keys.right = keys.jump = false; touch.left = touch.right = touch.jump = false; }

  window.addEventListener('keydown', e => {
    if (mode !== 'play' || !started || panelOpen) return;
    const tag = e.target && e.target.closest ? e.target.closest('button, a, input, textarea, select') : null;
    const k = KEYMAP[e.key];
    if (k && !(tag && e.key === ' ')) {
      e.preventDefault();
      if (k === 'jump' && !keys.jump) jumpBuffer = 8;
      keys[k] = true; hideHint();
    } else if (ACTION.has(e.key) && !tag) {
      e.preventDefault(); actionQueued = true;
    }
  });
  window.addEventListener('keyup', e => { const k = KEYMAP[e.key]; if (k) keys[k] = false; });
  window.addEventListener('blur', releaseKeys);

  $$('.touch [data-t]').forEach(b => {
    const k = b.dataset.t;
    const down = e => {
      e.preventDefault();
      if (b.setPointerCapture) { try { b.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } }
      if (k === 'act') actionQueued = true;
      else { touch[k] = true; if (k === 'jump') jumpBuffer = 8; }
      b.classList.add('on'); hideHint();
    };
    const up = () => { if (k !== 'act') touch[k] = false; b.classList.remove('on'); };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('lostpointercapture', up);
    b.addEventListener('contextmenu', e => e.preventDefault());
  });

  /* ---------- Panels (content comes from the Classic markup) ---------- */
  const PANELS = {
    hse: { kind: 'project', game: 'workflow' },
    eng: { kind: 'project', game: 'roles' },
    delivery: { kind: 'project', game: 'signature' },
    notify: { kind: 'project', game: 'notify' },
    realtime: { kind: 'project', game: 'signals' },
    logic: { kind: 'project', game: 'booking' },
    'skill-backend': { kind: 'skill' }, 'skill-frontend': { kind: 'skill' }, 'skill-data': { kind: 'skill' },
    'skill-integration': { kind: 'skill' }, 'skill-cloud': { kind: 'skill' },
    'job-naffco': { kind: 'job' }, 'job-logic': { kind: 'job' },
    education: { kind: 'education' },
    contact: { kind: 'contact' }
  };
  const flat = node => { const c = node.cloneNode(true); $$('br', c).forEach(b => b.replaceWith(' ')); $$('.state', c).forEach(s => s.remove()); return c.textContent.replace(/\s+/g, ' ').trim(); };

  function buildPanel(id) {
    const def = PANELS[id];
    const src = $(`[data-panel="${id}"]`);
    const node = el('div', 'pn');
    let title = 'Details';
    if (!src) return { title, node };
    if (def.kind === 'project') {
      title = flat($('h3', src));
      const top = $('.card-top', src) || src.firstElementChild;
      if (top) node.append(top.cloneNode(true));
      const p = $(':scope > p, :scope > .project-story > p', src);
      if (p) node.append(el('p', 'pn-lead', esc(p.textContent)));
      const tags = $('.tags', src);
      if (tags) node.append(tags.cloneNode(true));
      const detail = $('.detail-body', src);
      if (detail) node.append(el('div', 'pn-detail', detail.innerHTML));
    } else if (def.kind === 'skill') {
      title = flat($('h3', src));
      if ($('.in-progress', src) || src.classList.contains('in-progress')) node.append(el('span', 'state', 'In progress'));
      const p = $('p', src), s = $('small', src);
      if (p) node.append(el('p', 'pn-lead', esc(p.textContent)));
      if (s) node.append(el('p', '', esc(s.textContent)));
    } else if (def.kind === 'job') {
      title = flat($('h3', src));
      const d = $('.job-date', src), r = $('.role', src), u = $('ul', src);
      if (d) node.append(el('p', 'pn-date', d.innerHTML));
      if (r) node.append(el('p', 'pn-lead', esc(r.textContent)));
      if (u) node.append(u.cloneNode(true));
    } else if (def.kind === 'education') {
      title = 'Education & languages';
      Array.from(src.children).forEach(c => node.append(c.cloneNode(true)));
    } else if (def.kind === 'contact') {
      title = 'Let’s talk';
      node.append(el('p', 'pn-lead', 'Good software starts with a conversation.'));
      const open = $('.contact-top span:last-child', src);
      if (open) node.append(el('p', '', esc(open.textContent)));
      const links = $('.contact-links', src);
      if (links) node.append(links.cloneNode(true));
    }
    return { title, node };
  }

  function openPanel(id) {
    const def = PANELS[id];
    if (!def || panelOpen) return;
    const built = buildPanel(id);
    pTitle.textContent = built.title;
    pBody.innerHTML = '';
    pBody.append(built.node);
    dialog.style.setProperty('--accent', accentFor(id));
    panelOpen = true;
    releaseKeys();
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    sfx.open();
    if (def.game && MG[def.game]) {
      const wrap = el('section', 'mg', '<h3 class="mg-title">Try it</h3>');
      pBody.append(wrap);
      activeCleanup = MG[def.game](wrap, { award, steps: workflowSteps() });
    }
    if (!visited.has(id)) {
      visited.add(id); updateHud();
      if (visited.size === TOTAL) {
        award('explored', '100% explored', 'You opened every door, block and flag');
        burst(player.x, player.y, 60, 1.3);
      }
    }
    pBody.scrollTop = 0;
  }
  let activeCleanup = null;
  function closePanelState() {
    panelOpen = false;
    if (activeCleanup) { try { activeCleanup(); } catch (e) { /* ignore */ } activeCleanup = null; }
    pBody.innerHTML = '';
    releaseKeys(); actionQueued = false;
  }
  dialog.addEventListener('close', closePanelState);
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  $('.panel-close', dialog).addEventListener('click', () => dialog.close());
  function accentFor(id) {
    const d = DOORS.find(x => x.id === id) || BLOCKS.find(x => x.id === id) || FLAGS.find(x => x.id === id);
    return d ? (d.color) : (id === 'contact' ? '#ff5470' : '#ffc53d');
  }
  function workflowSteps() {
    return $$('[data-quest] li').map(li => ({ title: $('strong', li).textContent, owner: $('small', li).textContent }));
  }

  /* ---------- Particles ---------- */
  const COLORS = ['#ffc53d', '#ff5470', '#5b8cff', '#3df2b0', '#b78bff'];
  function burst(x, y, n, power = 1) {
    for (let i = 0; i < n; i++) {
      particles.push({ x, y, vx: (Math.random() - 0.5) * 4 * power, vy: (-1 - Math.random() * 3.5) * power, life: 1, size: 2 + (Math.random() * 2 | 0), c: COLORS[(Math.random() * COLORS.length) | 0] });
    }
  }
  function puff(x, y) {
    for (let i = 0; i < 4; i++) particles.push({ x: x + (Math.random() - 0.5) * 8, y, vx: (Math.random() - 0.5) * 1.2, vy: -Math.random() * 0.8, life: 0.6, size: 2, c: '#6a73a3' });
  }

  /* ---------- Physics ---------- */
  const ACC = 0.26, MAXV = 2.3, JUMP = 6.9, GRAV = 0.33, MAXFALL = 8, COYOTE = 6;
  const blockRect = b => ({ x: b.x - 8, y: groundY - b.bottom - 16 - b.bump, w: 16, h: 16 });

  function movePlayer() {
    const p = player;
    const L = keys.left || touch.left, R = keys.right || touch.right;
    const dir = (R ? 1 : 0) - (L ? 1 : 0);
    if (dir) { p.vx += dir * ACC; p.face = dir; } else p.vx *= p.onGround ? 0.78 : 0.95;
    p.vx = clamp(p.vx, -MAXV, MAXV);
    if (Math.abs(p.vx) < 0.03) p.vx = 0;
    if (p.hurt > 0) p.hurt--;

    if (jumpBuffer > 0) jumpBuffer--;
    coyote = p.onGround ? COYOTE : Math.max(0, coyote - 1);
    const held = keys.jump || touch.jump;
    if (jumpBuffer > 0 && coyote > 0) {
      p.vy = -JUMP; coyote = 0; jumpBuffer = 0; p.onGround = false;
      sfx.jump(); puff(p.x, p.y + p.h);
    }
    p.vy = Math.min(p.vy + ((p.vy < 0 && !held) ? GRAV * 2.4 : GRAV), MAXFALL);

    // horizontal
    p.x = clamp(p.x + p.vx, 14, WORLD_W - 14);
    for (const b of BLOCKS) {
      const r = blockRect(b);
      if (p.x + p.w / 2 > r.x && p.x - p.w / 2 < r.x + r.w && p.y + p.h > r.y && p.y < r.y + r.h) {
        p.x = p.vx >= 0 ? r.x - p.w / 2 : r.x + r.w + p.w / 2;
        p.vx = 0;
      }
    }

    // vertical
    const prevBottom = p.y + p.h;
    p.y += p.vy;
    p.onGround = false;
    for (const b of BLOCKS) {
      const r = blockRect(b);
      if (p.x + p.w / 2 > r.x && p.x - p.w / 2 < r.x + r.w && p.y + p.h > r.y && p.y < r.y + r.h) {
        if (p.vy < 0) { p.y = r.y + r.h; p.vy = 0.6; bumpBlock(b); }
        else { p.y = r.y - p.h; p.vy = 0; p.onGround = true; }
      }
    }
    if (p.y + p.h >= groundY) { p.y = groundY - p.h; p.vy = 0; p.onGround = true; }
    else if (p.vy >= 0) {
      for (const pl of platforms) {
        const top = groundY - pl.top;
        if (prevBottom <= top + 0.6 && p.y + p.h >= top && p.x + p.w / 2 > pl.x && p.x - p.w / 2 < pl.x + pl.w) {
          p.y = top - p.h; p.vy = 0; p.onGround = true; break;
        }
      }
    }
    if (p.onGround && Math.abs(p.vx) > 0.5) p.run += Math.abs(p.vx) * 0.12; else if (p.onGround) p.run = 0;
  }

  function bumpBlock(b) {
    if (b.bumping) return;
    b.bumping = true; b.bump = 5;
    sfx.bump();
    burst(b.x, groundY - b.bottom - 16, 6, 0.5);
    setTimeout(() => { b.bumping = false; b.hit = true; openPanel(b.id); }, 220);
  }

  function updateBugs() {
    for (const b of BUGS) {
      if (!b.alive) continue;
      b.x += b.dir * 0.45;
      if (b.x < b.min || b.x > b.max) b.dir *= -1;
      if (!started) continue;
      const p = player, bx = b.x - 9, by = groundY - 16;
      if (p.x + p.w / 2 > bx && p.x - p.w / 2 < bx + 18 && p.y + p.h > by + 2 && p.y < by + 16) {
        if (p.vy > 0.8 && p.y + p.h - by < 11) {
          b.alive = false; bugCount++; p.vy = (keys.jump || touch.jump) ? -5.6 : -3.8;
          burst(b.x, by + 6, 10, 0.8); sfx.stomp(); updateHud();
          if (bugCount === 3) award('bugs', 'Bug squasher', 'Three bugs squashed. Production thanks you.');
          if (bugCount === BUGS.length) award('allbugs', 'Zero known bugs', 'Every bug squashed');
        } else if (p.hurt === 0) {
          p.hurt = 70; p.vx = (p.x < b.x ? -1 : 1) * 2.6; p.vy = -3; sfx.hurt();
        }
      }
    }
  }

  function updateCoins() {
    for (const c of coins) {
      if (c.got) continue;
      const cy = groundY - c.h;
      if (Math.abs(player.x - c.x) < 13 && Math.abs(player.y + player.h / 2 - cy) < 18) {
        c.got = true; coinCount++;
        burst(c.x, cy, 8, 0.7); sfx.coin(); small(c.label, c.x, cy); updateHud();
        if (coinCount === coins.length) award('stack', 'Full stack collected', 'All ten technologies found');
      }
    }
  }

  function zoneAt(x) { return ZONES.find(z => x >= z.x0 && x < z.x1) || ZONES[ZONES.length - 1]; }
  let curZone = ZONES[0];
  function updateZone() {
    const z = zoneAt(player.x);
    if (z === curZone) return;
    curZone = z;
    hudLevel.textContent = 'LV ' + String(z.level).padStart(2, '0');
    hudZone.textContent = z.name;
    if (z.level > maxLevel) { maxLevel = z.level; showBanner(z); sfx.level(); burst(player.x, player.y - 20, 24, 1); }
    else showBanner(z);
  }

  let near = null;
  function findNear() {
    const p = player;
    for (const d of DOORS) if (Math.abs(p.x - d.x) < 24) return { id: d.id, x: d.x, top: 66 };
    for (const f of FLAGS) if (Math.abs(p.x - f.x) < 22) return { id: f.id, x: f.x, top: 76 };
    if (Math.abs(p.x - GATE.x) < 34) return { id: GATE.id, x: GATE.x, top: 96 };
    return null;
  }

  function update() {
    frameCount++;
    BLOCKS.forEach(b => { if (b.bump > 0) b.bump = Math.max(0, b.bump - 0.6); });
    updateBugs();
    particles.forEach(q => { q.x += q.vx; q.y += q.vy; q.vy += 0.12; q.life -= 0.022; });
    particles = particles.filter(q => q.life > 0);
    if (started) {
      movePlayer();
      updateCoins();
      updateZone();
      near = findNear();
      if (actionQueued && near) openPanel(near.id);
    }
    actionQueued = false;
    const target = clamp(player.x - VW * 0.42, 0, Math.max(0, WORLD_W - VW));
    camX += (target - camX) * 0.12;
  }

  /* ---------- Rendering ---------- */
  let stars = [], skyline = [];
  function hueAt(x) {
    const cs = ZONES.map(z => ({ c: (z.x0 + z.x1) / 2, h: z.hue }));
    if (x <= cs[0].c) return cs[0].h;
    for (let i = 0; i < cs.length - 1; i++) {
      if (x < cs[i + 1].c) return cs[i].h + (cs[i + 1].h - cs[i].h) * ((x - cs[i].c) / (cs[i + 1].c - cs[i].c));
    }
    return cs[cs.length - 1].h;
  }
  function buildSky() {
    stars = Array.from({ length: Math.round(VW * VH / 1500) }, () => ({ x: Math.random() * VW, y: Math.random() * groundY, s: Math.random() < 0.2 ? 2 : 1, a: 0.3 + Math.random() * 0.6, p: Math.random() * 6.28 }));
    skyline = [];
    let x = -40, n = 0;
    const total = WORLD_W * 0.25 + VW + 200;
    while (x < total) {
      const w = 14 + ((n * 37) % 24), h = 28 + ((n * 53) % 64), spire = n % 11 === 5;
      const wins = [];
      for (let j = 0; j < h - 8; j += 6) for (let i = 3; i < w - 3; i += 5) if (((n * 31 + i * 17 + j * 13) % 7) === 0) wins.push([i, j + 4]);
      skyline.push({ x, w, h: spire ? h + 30 : h, spire, wins });
      x += w + 2 + ((n * 7) % 6); n++;
    }
  }
  function txt(s, x, y, font, color, align = 'left') {
    g.font = font; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'top';
    g.fillText(s, x, y);
  }
  const PIX = "7px 'Silkscreen', monospace";
  const DISP = (px, w = 700) => `${w} ${px}px 'Chakra Petch', system-ui, sans-serif`;

  function board(cx, w, h, bottom, accent, content, noPosts) {
    const x = Math.round(cx - w / 2), y = groundY - bottom - h;
    if (!noPosts) { g.fillStyle = '#1b2046'; g.fillRect(x + 8, y + h, 3, bottom); g.fillRect(x + w - 11, y + h, 3, bottom); }
    g.fillStyle = accent; g.fillRect(x, y, w, h);
    g.fillStyle = '#0f1230'; g.fillRect(x + 2, y + 2, w - 4, h - 4);
    content(x, y);
  }

  function drawWorld(t) {
    const h = hueAt(camX + VW / 2);
    // sky
    const grad = g.createLinearGradient(0, 0, 0, groundY);
    grad.addColorStop(0, `hsl(${h} 58% 5%)`); grad.addColorStop(1, `hsl(${h} 46% 17%)`);
    g.fillStyle = grad; g.fillRect(0, 0, VW, VH);
    for (const s of stars) {
      const sx = ((s.x - camX * 0.04) % VW + VW) % VW;
      g.globalAlpha = s.a * (0.65 + 0.35 * Math.sin(t / 700 + s.p));
      g.fillStyle = '#cfd6ff'; g.fillRect(Math.round(sx), Math.round(s.y), s.s, s.s);
    }
    g.globalAlpha = 1;
    // skyline
    const off = camX * 0.25;
    for (const b of skyline) {
      const x = Math.round(b.x - off);
      if (x > VW || x + b.w < 0) continue;
      g.fillStyle = `hsl(${h} 40% 8%)`; g.fillRect(x, groundY - b.h, b.w, b.h);
      if (b.spire) { g.fillRect(x + 4, groundY - b.h - 10, b.w - 8, 10); g.fillRect(x + b.w / 2 - 1, groundY - b.h - 28, 2, 18); }
      g.fillStyle = 'rgba(255,215,120,.5)';
      for (const [wx, wy] of b.wins) g.fillRect(x + wx, groundY - b.h + wy, 1, 2);
    }
    // ground
    const accent = zoneAt(camX + VW / 2).accent;
    g.fillStyle = `hsl(${h} 34% 12%)`; g.fillRect(0, groundY, VW, VH - groundY);
    g.fillStyle = accent; g.fillRect(0, groundY, VW, 2);
    g.fillStyle = `hsl(${h} 34% 20%)`; g.fillRect(0, groundY + 2, VW, 2);
    g.fillStyle = `hsl(${h} 40% 8%)`;
    const gx = -((Math.round(camX)) % 16);
    for (let x = gx; x < VW; x += 16) g.fillRect(x, groundY + 4, 1, VH - groundY);

    g.save();
    g.translate(-Math.round(camX), 0);

    // lamps
    for (let x = 60; x < WORLD_W; x += 260) {
      if (x < camX - 20 || x > camX + VW + 20) continue;
      g.fillStyle = '#1b2046'; g.fillRect(x, groundY - 34, 2, 34);
      g.fillStyle = '#ffd36b'; g.fillRect(x - 3, groundY - 37, 8, 3);
      g.fillStyle = 'rgba(255,200,90,.07)'; g.fillRect(x - 12, groundY - 34, 26, 34);
    }

    // title boards
    board(250, 184, 56, 26, '#ffc53d', (x, y) => {
      txt('HIMAYAT BHAT', x + 10, y + 8, "9px 'Silkscreen', monospace", '#ffc53d');
      txt('Full Stack Developer', x + 10, y + 22, DISP(12), '#e9ecff');
      txt('Dubai, UAE', x + 10, y + 40, "8px 'Hanken Grotesk', sans-serif", '#a3abd6');
    });
    board(640, 236, 58, 26, '#5b8cff', (x, y) => {
      txt('Complex workflows.', x + 12, y + 8, DISP(13), '#e9ecff');
      txt('Considered engineering.', x + 12, y + 23, DISP(13), '#e9ecff');
      txt('Run right to explore', x + 12, y + 42, "8px 'Hanken Grotesk', sans-serif", '#a3abd6');
    });
    for (const z of ZONES.slice(1)) {
      board(z.x0 + 90, 176, 50, 24, z.accent, (x, y) => {
        txt('LEVEL 0' + z.level, x + 10, y + 7, "8px 'Silkscreen', monospace", z.accent);
        txt(z.name, x + 10, y + 19, DISP(13), '#e9ecff');
        txt(z.hint || '', x + 10, y + 36, "8px 'Hanken Grotesk', sans-serif", '#a3abd6');
      });
    }

    // platforms
    for (const pl of platforms) {
      if (pl.x > camX + VW || pl.x + pl.w < camX) continue;
      const y = groundY - pl.top;
      g.fillStyle = '#1b2046'; g.fillRect(pl.x + 4, y + 6, 3, pl.top - 6); g.fillRect(pl.x + pl.w - 7, y + 6, 3, pl.top - 6);
      g.fillStyle = `hsl(${h} 30% 24%)`; g.fillRect(pl.x, y, pl.w, 6);
      g.fillStyle = accent; g.fillRect(pl.x, y, pl.w, 2);
    }

    // doors
    for (const d of DOORS) {
      if (d.x < camX - 60 || d.x > camX + VW + 60) continue;
      const x = d.x - 18, y = groundY - 52, seen = visited.has(d.id);
      g.fillStyle = d.color; g.fillRect(x - 3, y - 3, 42, 55);
      g.fillStyle = '#0f1230'; g.fillRect(x, y, 36, 52);
      g.globalAlpha = 0.25 + 0.12 * Math.sin(t / 380 + d.x);
      g.fillStyle = d.color; g.fillRect(x + 3, y + 3, 30, 49);
      g.globalAlpha = 1;
      g.fillStyle = '#ffd36b'; g.fillRect(x + 28, y + 28, 3, 3);
      g.font = DISP(10, 700);
      const w = Math.ceil(g.measureText(d.label).width) + 14;
      board(d.x, w, 18, 58, d.color, (bx, by) => txt(d.label, bx + 7, by + 3, DISP(10), '#e9ecff'), true);
      if (seen) glyph(CHECK, d.x - 5, groundY - 36, '#3df2b0', 2);
    }

    // blocks
    for (const b of BLOCKS) {
      const r = blockRect(b);
      if (r.x > camX + VW || r.x + 16 < camX) continue;
      g.fillStyle = b.hit ? '#2b3163' : b.color; g.fillRect(r.x, r.y, 16, 16);
      g.fillStyle = b.hit ? '#1b2046' : '#0a0c1a'; g.fillRect(r.x + 2, r.y + 2, 12, 12);
      g.fillStyle = b.hit ? '#2b3163' : b.color; g.fillRect(r.x + 3, r.y + 3, 10, 10);
      if (b.progress && !b.hit) { g.fillStyle = '#0a0c1a'; for (let i = 0; i < 16; i += 4) g.fillRect(r.x + i, r.y, 2, 1); }
      if (b.hit) glyph(CHECK, r.x + 3, r.y + 4, '#3df2b0', 2); else glyph(QMARK, r.x + 5, r.y + 4, '#0a0c1a', 1);
      if (!b.hit) { g.globalAlpha = 0.5 + 0.5 * Math.sin(t / 250 + b.x); g.fillStyle = '#fff'; g.fillRect(r.x + 1, r.y + 1, 2, 2); g.globalAlpha = 1; }
    }

    // flags
    for (const f of FLAGS) {
      if (f.x < camX - 60 || f.x > camX + VW + 60) continue;
      const seen = visited.has(f.id), col = seen ? '#3df2b0' : f.color;
      g.fillStyle = '#6a73a3'; g.fillRect(f.x, groundY - 68, 2, 68);
      g.fillStyle = '#ffd36b'; g.fillRect(f.x - 1, groundY - 71, 4, 4);
      g.font = "7px 'Silkscreen', monospace";
      const fw = Math.ceil(g.measureText(f.label).width) + 12;
      for (let r = 0; r < 12; r++) {
        const wave = Math.round(Math.sin(t / 180 + r * 0.5) * 1.5);
        g.fillStyle = col; g.fillRect(f.x + 2, groundY - 66 + r, fw + wave - (r > 8 ? (r - 8) * 3 : 0), 1);
      }
      txt(f.label, f.x + 5, groundY - 64, "7px 'Silkscreen', monospace", '#0a0c1a');
      if (seen) glyph(CHECK, f.x - 4, groundY - 84, '#3df2b0', 2);
    }

    // gate
    {
      const x = GATE.x, y = groundY;
      g.fillStyle = '#232a5a';
      g.fillRect(x - 64, y - 116, 36, 116); g.fillRect(x + 28, y - 116, 36, 116); g.fillRect(x - 28, y - 86, 56, 86);
      g.fillStyle = '#2f3874';
      for (let i = 0; i < 4; i++) { g.fillRect(x - 64 + i * 10, y - 124, 6, 8); g.fillRect(x + 28 + i * 10, y - 124, 6, 8); }
      g.fillStyle = '#0f1230'; g.fillRect(x - 20, y - 68, 40, 68);
      for (let j = 0; j < 68; j += 4) {
        g.globalAlpha = 0.35 + 0.35 * Math.sin(t / 200 + j * 0.3);
        g.fillStyle = '#ff5470'; g.fillRect(x - 20, y - 68 + j, 40, 3);
      }
      g.globalAlpha = 1;
      board(x, 104, 24, 130, '#ff5470', (bx, by) => txt("Let's talk", bx + 12, by + 5, DISP(14), '#e9ecff'), true);
      if (visited.has('contact')) glyph(CHECK, x - 5, y - 172, '#3df2b0', 2);
    }

    // coins
    for (const c of coins) {
      if (c.got || c.x < camX - 20 || c.x > camX + VW + 20) continue;
      const sw = Math.max(3, Math.round(Math.abs(Math.cos(t / 240 + c.x)) * 16));
      const cy = groundY - c.h + Math.round(Math.sin(t / 320 + c.x) * 2);
      g.drawImage(COIN, Math.round(c.x - sw / 2), cy - 8, sw, 16);
    }

    // bugs
    for (const b of BUGS) {
      if (!b.alive || b.x < camX - 30 || b.x > camX + VW + 30) continue;
      g.save();
      g.translate(Math.round(b.x), groundY - 16);
      if (b.dir < 0) g.scale(-1, 1);
      g.drawImage(BUGSPR[(frameCount >> 4) & 1], -10, 0);
      g.restore();
    }

    // player
    {
      const p = player;
      if (!(p.hurt > 0 && (frameCount >> 2) & 1)) {
        const frame = !p.onGround ? 'run2' : (Math.abs(p.vx) > 0.4 ? (((p.run | 0) & 1) ? 'run1' : 'run2') : 'stand');
        g.save();
        g.translate(Math.round(p.x), Math.round(p.y + p.h - 24));
        if (p.face < 0) g.scale(-1, 1);
        g.drawImage(PLAYER[frame], -12, 0);
        g.restore();
      }
    }

    // particles
    for (const q of particles) {
      g.globalAlpha = Math.max(0, q.life);
      g.fillStyle = q.c; g.fillRect(Math.round(q.x), Math.round(q.y), q.size, q.size);
    }
    g.globalAlpha = 1;

    // interaction prompt
    if (near && started && !panelOpen) {
      const label = near.id === 'contact' ? (coarse ? 'Tap E to enter' : 'Press E to enter') : (coarse ? 'Tap E to open' : 'Press E to open');
      g.font = DISP(10, 700);
      const w = Math.ceil(g.measureText(label).width) + 12;
      const bx = Math.round(near.x - w / 2), by = groundY - near.top - 38 + Math.round(Math.sin(t / 220) * 2) - (near.id === 'contact' ? 52 : 0);
      g.fillStyle = '#ffc53d'; g.fillRect(bx, by, w, 15);
      g.fillStyle = '#ffc53d'; g.fillRect(Math.round(near.x) - 2, by + 15, 4, 3);
      txt(label, bx + 6, by + 2, DISP(10), '#0a0c1a');
    }
    g.restore();
  }

  /* ---------- Loop, sizing, modes ---------- */
  let last = 0, acc = 0;
  function loop(t) {
    if (!running) return;
    requestAnimationFrame(loop);
    const dt = Math.min(100, t - (last || t));
    last = t;
    if (panelOpen || document.hidden) return;
    acc += dt;
    while (acc >= 16.667) { update(); acc -= 16.667; }
    drawWorld(t);
  }
  function startLoop() { if (running) return; running = true; last = 0; acc = 0; requestAnimationFrame(loop); }
  function stopLoop() { running = false; }

  function resize() {
    const cw = gameEl.clientWidth, ch = gameEl.clientHeight;
    if (!cw || !ch) return;
    SCALE = Math.max(2, Math.round(Math.min(ch / 240, cw / 420)));
    VW = Math.ceil(cw / SCALE); VH = Math.ceil(ch / SCALE);
    canvas.width = VW; canvas.height = VH;
    g.imageSmoothingEnabled = false;
    const prev = groundY;
    groundY = VH - (36 + (coarse ? Math.round(124 / SCALE) : 0));
    player.y += groundY - prev;
    buildSky();
  }
  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (mode === 'play') { resize(); if (!running) drawWorld(performance.now()); } }, 100); });

  function setMode(next) {
    if (next === mode) return;
    mode = next;
    root.classList.toggle('playing', mode === 'play');
    try { sessionStorage.setItem('view', mode); } catch (e) { /* ignore */ }
    fab.hidden = mode === 'play';
    if (mode === 'play') {
      resize(); startLoop();
      if (!started) showStart();
    } else {
      stopLoop(); releaseKeys();
      if (dialog.open) dialog.close();
      window.scrollTo(0, 0);
    }
    window.dispatchEvent(new Event('portfolio:view'));
  }

  function showStart() { startEl.hidden = false; const first = $('[data-start="play"]', startEl); if (first) first.focus({ preventScroll: true }); }
  function startGame() {
    if (started) return;
    started = true; startEl.hidden = true;
    ensureAudio();
    showBanner(ZONES[0]);
    updateHud();
    setTimeout(hideHint, 9000);
    hudLevel.textContent = 'LV 01'; hudZone.textContent = ZONES[0].name;
  }

  $$('[data-start]', startEl).forEach(b => b.addEventListener('click', () => {
    if (b.dataset.start === 'play') startGame(); else { startEl.hidden = true; setMode('classic'); }
  }));
  fab.addEventListener('click', () => { setMode('play'); });
  $('[data-g-classic]').addEventListener('click', e => { e.currentTarget.blur(); setMode('classic'); });
  $('[data-g-talk]').addEventListener('click', e => { e.currentTarget.blur(); if (started) openPanel('contact'); else startGame(); });
  soundBtn.addEventListener('click', e => {
    e.currentTarget.blur();
    soundOn = !soundOn; ensureAudio();
    soundBtn.setAttribute('aria-pressed', String(soundOn));
    soundBtn.textContent = soundOn ? 'Sound on' : 'Sound off';
  });
  window.addEventListener('keydown', e => {
    if ((e.key === 'm' || e.key === 'M') && mode === 'play' && started && !panelOpen) soundBtn.click();
  });

  /* ---------- Init ---------- */
  window.__game = {
    ready: true,
    state: () => ({ mode, started, panelOpen, x: Math.round(player.x), y: Math.round(player.y), onGround: player.onGround, coins: coinCount, bugs: bugCount, explored: visited.size, total: TOTAL, level: curZone.level, near: near && near.id, VW, VH, SCALE, camX: Math.round(camX) }),
    teleport: x => { player.x = clamp(x, 20, WORLD_W - 20); player.vx = 0; camX = clamp(player.x - VW * 0.42, 0, WORLD_W - VW); }
  };

  fab.hidden = mode === 'play';
  if (mode === 'play') {
    resize(); startLoop(); showStart();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { const c = $('[data-start="classic"]', startEl); if (c) c.focus({ preventScroll: true }); }
  }
  updateHud();
})();
