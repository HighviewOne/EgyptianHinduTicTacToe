/* ─────────────────────────────────────────────
   themes.js — themes: apply/generate, intro, lore popup,
   background particles and papyrus ornaments
   Plain <script>: shares the page's global scope with the
   other game files (load order: see index.html).
───────────────────────────────────────────── */

/* ─────────────────────────────────────────────
   Character intro
───────────────────────────────────────────── */
function showIntro() {
  const overlay = document.getElementById('intro-overlay');
  const left    = document.getElementById('intro-left');
  const right   = document.getElementById('intro-right');
  const vs      = overlay.querySelector('.intro-vs');
  const begin   = document.getElementById('intro-begin');

  document.getElementById('intro-sym1').textContent  = currentTheme.players.egypt.symbol;
  document.getElementById('intro-name1').textContent = playerName(EGYPT).toUpperCase();
  document.getElementById('intro-tag1').textContent  = currentTheme.players.egypt.intro;
  document.getElementById('intro-sym1').style.color  = currentTheme.players.egypt.primary;
  document.getElementById('intro-name1').style.color = currentTheme.players.egypt.primary;

  document.getElementById('intro-sym2').textContent  = currentTheme.players.hindu.symbol;
  document.getElementById('intro-name2').textContent = playerName(HINDU).toUpperCase();
  document.getElementById('intro-tag2').textContent  = currentTheme.players.hindu.intro;
  document.getElementById('intro-sym2').style.color  = currentTheme.players.hindu.primary;
  document.getElementById('intro-name2').style.color = currentTheme.players.hindu.primary;

  left.classList.remove('shown');
  right.classList.remove('shown');
  vs.classList.remove('shown');
  begin.classList.remove('shown');

  if (introTimer) clearTimeout(introTimer);
  introShowing = true;
  overlay.classList.add('active');

  setTimeout(() => left.classList.add('shown'),  150);
  setTimeout(() => right.classList.add('shown'), 480);
  setTimeout(() => vs.classList.add('shown'),    720);
  setTimeout(() => begin.classList.add('shown'), 2100);

  const dismiss = () => {
    overlay.classList.remove('active');
    overlay.removeEventListener('click', dismiss);
    if (introTimer) { clearTimeout(introTimer); introTimer = null; }
    introShowing = false;
    scheduleAI();
    scheduleSpectatorAI();
    if (!spectatorMode && (!aiMode || gameState.currentPlayer === EGYPT)) startTimer();
  };
  introTimer = setTimeout(dismiss, 4000);
  overlay.addEventListener('click', dismiss);
}

/* ─────────────────────────────────────────────
   Lore popup (1-in-20 chance after a game)
───────────────────────────────────────────── */
function checkLorePopup() {
  if (Math.random() > 0.15) return;
  const facts = currentTheme.loreFacts;
  if (!facts || !facts.length) return;
  const toast = document.getElementById('lore-toast');
  document.getElementById('lore-toast-text').textContent =
    facts[Math.floor(Math.random() * facts.length)];
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 5800);
}

/* ─────────────────────────────────────────────
   Procedural theme generator
───────────────────────────────────────────── */
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k     = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}


function generateRandomTheme() {
  const pair = RAND_PAIRS[randInt(RAND_PAIRS.length)];
  const h1   = randInt(360);
  const h2   = (h1 + 140 + randInt(80)) % 360;
  const c1   = hslToHex(h1, 72 + randInt(18), 54 + randInt(12));
  const c2   = hslToHex(h2, 68 + randInt(22), 50 + randInt(16));
  const r1   = hexToRgb(c1);
  const r2   = hexToRgb(c2);
  const musicThemes = Object.values(THEMES).filter(t => t.music).map(t => t.music);
  const music = musicThemes[randInt(musicThemes.length)];

  const mkPlayer = (p, col, rgb, isP1) => ({
    symbol: p.sym, name: p.name, title: p.title,
    lore:   `Born of ${p.name.toLowerCase()}, forged in the crucible of procedural chance`,
    intro:  `${p.name} emerges from the generative mists...`,
    label:  `${p.name}'s turn — Place the ${p.sym}`,
    winMsgs: [
      `🏆 ${p.name.toUpperCase()} WINS! The RNG gods have spoken and they are PLEASED!`,
      `🏆 Procedurally generated AND victorious! ${p.name} defies all probability!`,
      `🏆 The algorithm chose ${p.name}. The algorithm is wise. The algorithm is just.`,
    ],
    primary: col,
    vars: isP1
      ? { '--egypt-gold': col, '--egypt-sand': hslToHex(h1,60,80),
          '--egypt-dark': hslToHex(h1,55,8), '--egypt-brown': hslToHex(h1,50,22),
          '--egypt-teal': hslToHex((h1+40)%360,55,32), '--p1-rgb': rgb }
      : { '--hindu-orange': col, '--hindu-saffron': hslToHex(h2,75,62),
          '--hindu-purple': hslToHex(h2,60,10), '--hindu-rose': hslToHex((h2+25)%360,68,50),
          '--p2-rgb': rgb },
  });

  return {
    label:     `✦ ${pair.p1.name} vs ${pair.p2.name}`,
    corners:   [pair.p1.sym, pair.p2.sym, pair.p1.sym, pair.p2.sym],
    footer:    [pair.p1.sym, pair.p2.sym, pair.p1.sym, pair.p2.sym, pair.p1.sym, pair.p2.sym],
    loreFacts: [
      'This theme was generated at random just for you. Contemplate its uniqueness.',
      'Every random theme is a universe that exists only once. This is yours.',
      'The procedural cosmos contains infinite themes. You chose to witness this one.',
    ],
    music,
    players: { egypt: mkPlayer(pair.p1, c1, r1, true), hindu: mkPlayer(pair.p2, c2, r2, false) },
  };
}

function applyRandomTheme() {
  THEMES['random'] = generateRandomTheme();
  applyTheme('random');
}

/* ─────────────────────────────────────────────
   Background particles — floating theme symbols
───────────────────────────────────────────── */
function spawnBgParticles() {
  const container = document.getElementById('bg-particles');
  container.innerHTML = '';
  const syms  = currentTheme.footer;
  const count = 16;
  for (let i = 0; i < count; i++) {
    const span = document.createElement('span');
    span.className   = 'bg-sym';
    span.textContent = syms[i % syms.length];
    span.style.left            = `${Math.random() * 100}%`;
    span.style.animationDuration  = `${14 + Math.random() * 22}s`;
    span.style.animationDelay     = `${Math.random() * -36}s`;
    span.style.fontSize           = `${0.7 + Math.random() * 1.3}rem`;
    container.appendChild(span);
  }
}

/* ─────────────────────────────────────────────
   Apply theme
───────────────────────────────────────────── */
function applyTheme(key) {
  currentTheme    = THEMES[key];
  currentThemeKey = key;
  trackThemeAchievement(key);
  const root = document.documentElement.style;
  Object.entries(currentTheme.players.egypt.vars).forEach(([k, v]) => root.setProperty(k, v));
  Object.entries(currentTheme.players.hindu.vars).forEach(([k, v]) => root.setProperty(k, v));

  const [tl, tr, bl, br] = currentTheme.corners;
  document.querySelector('.corner.tl').textContent = tl;
  document.querySelector('.corner.tr').textContent = tr;
  document.querySelector('.corner.bl').textContent = bl;
  document.querySelector('.corner.br').textContent = br;

  const footerSpans = document.querySelectorAll('.footer-symbols span');
  currentTheme.footer.forEach((sym, i) => { if (footerSpans[i]) footerSpans[i].textContent = sym; });
  spawnBgParticles();

  document.querySelector('#card-egypt .player-symbol').textContent = currentTheme.players.egypt.symbol;
  document.getElementById('name-egypt').textContent                = playerName(EGYPT);
  document.querySelector('#card-egypt .player-title').textContent  = currentTheme.players.egypt.title;
  document.querySelector('#card-egypt .player-lore').textContent   = currentTheme.players.egypt.lore;
  document.querySelector('#card-hindu .player-symbol').textContent = currentTheme.players.hindu.symbol;
  document.getElementById('name-hindu').textContent                = playerName(HINDU);
  document.querySelector('#card-hindu .player-title').textContent  = currentTheme.players.hindu.title;
  document.querySelector('#card-hindu .player-lore').textContent   = currentTheme.players.hindu.lore;

  SYMBOLS.egypt = currentTheme.players.egypt.symbol;
  SYMBOLS.hindu = currentTheme.players.hindu.symbol;
  setPlayerLabel(EGYPT);
  setPlayerLabel(HINDU);

  document.querySelectorAll('.theme-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.theme === key);
  });

  // Crossfade music to new theme if currently playing
  if (musicPlaying) {
    clearTimeout(melodyTimer);
    stopDrone();
    melodyStep = 0;
    droneNodes = startDrone();
    tickMelody();
  }

  // Set papyrus CSS vars from theme data
  const t = THEMES[key];
  if (t.paper) {
    root.setProperty('--paper', t.paper);
    root.setProperty('--paper-dark', t.paperDark);
    root.setProperty('--paper-shadow', t.paperShadow);
    root.setProperty('--ink', t.ink);
    root.setProperty('--accent', t.accent);
    root.setProperty('--p1-ink', t.p1ink);
    root.setProperty('--p1-soft', t.p1soft);
    root.setProperty('--p2-ink', t.p2ink);
    root.setProperty('--p2-soft', t.p2soft);
  }
  // Update masthead subtitle
  const mastSub = document.getElementById('masthead-sub');
  if (mastSub) mastSub.textContent = (t.label || '').replace(/^[^ ]+ /, '');

  // Update border ornaments
  updateBorderOrnaments(key);

  // Update board stage corner glyphs
  updateBoardCorners(key);

  // Update player card corner glyphs and rules
  updatePlayerCardDetails(key);

  // Cancel any AI thinking from the previous theme/round
  aiThinking = false;
  boardEl.classList.remove('ai-thinking');

  // Intro first, so the new round's AI / timer wait until it is dismissed.
  showIntro();
  resetScores();
  savePrefs();
}

/* ─────────────────────────────────────────────
   Papyrus helper functions
───────────────────────────────────────────── */
function getBorderSVG(pattern, ink, opacity, flip) {
  const f = flip ? ' transform="scale(1,-1) translate(0,-32)"' : '';
  if (pattern === 'wave') {
    return `<svg class="border-svg" viewBox="0 0 400 32" preserveAspectRatio="none" aria-hidden="true"${f}><defs><filter id="b-w-ink"><feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="0.6"/></filter></defs><g filter="url(#b-w-ink)" stroke="${ink}" stroke-width="1.4" fill="none" stroke-linecap="round" opacity="${opacity}"><path d="M0 16 Q 10 4 20 16 T 40 16 T 60 16 T 80 16 T 100 16 T 120 16 T 140 16 T 160 16 T 180 16 T 200 16 T 220 16 T 240 16 T 260 16 T 280 16 T 300 16 T 320 16 T 340 16 T 360 16 T 380 16 T 400 16"/><path d="M0 22 Q 10 14 20 22 T 40 22 T 60 22 T 80 22 T 100 22 T 120 22 T 140 22 T 160 22 T 180 22 T 200 22 T 220 22 T 240 22 T 260 22 T 280 22 T 300 22 T 320 22 T 340 22 T 360 22 T 380 22 T 400 22" opacity="0.5"/></g></svg>`;
  }
  if (pattern === 'simple') {
    return `<svg class="border-svg" viewBox="0 0 400 32" preserveAspectRatio="none" aria-hidden="true"${f}><defs><filter id="b-s-ink"><feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="0.7"/></filter></defs><g filter="url(#b-s-ink)" stroke="${ink}" stroke-width="1.4" fill="none" stroke-linecap="round" opacity="${opacity}"><line x1="0" y1="10" x2="400" y2="10"/><line x1="0" y1="14" x2="400" y2="14" stroke-width="0.6"/><line x1="0" y1="22" x2="400" y2="22"/>${Array.from({length:20},(_,i)=>`<circle cx="${10+i*20}" cy="18" r="0.8" fill="${ink}" stroke="none"/>`).join('')}</g></svg>`;
  }
  // meander (default)
  const tileW = 28;
  const paths = Array.from({length:15},(_,i)=>{const x=i*tileW;return`<path d="M${x} 4 L${x+22} 4 L${x+22} 22 L${x+8} 22 L${x+8} 12 L${x+16} 12 L${x+16} 18"/>`;}).join('');
  return `<svg class="border-svg" viewBox="0 0 400 32" preserveAspectRatio="none" aria-hidden="true"${f}><defs><filter id="b-m-ink"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="0.8"/></filter></defs><g filter="url(#b-m-ink)" stroke="${ink}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="${opacity}">${paths}<line x1="0" y1="28" x2="400" y2="28"/></g></svg>`;
}

function updateBorderOrnaments(key) {
  const t = THEMES[key];
  if (!t) return;
  const ink = t.ink || '#2a1a08';
  const pattern = t.border || 'meander';
  const topEl = document.getElementById('hborder-top');
  const botEl = document.getElementById('hborder-bot');
  if (topEl) topEl.innerHTML = getBorderSVG(pattern, ink, 0.5, false);
  if (botEl) botEl.innerHTML = getBorderSVG(pattern, ink, 0.5, true);
}

function updateBoardCorners(key) {
  const t = THEMES[key];
  if (!t) return;
  const p1 = t.players.egypt, p2 = t.players.hindu;
  const p1color = t.p1ink || '#9b3b14';
  const p2color = t.p2ink || '#3a4a8a';
  const corners = [
    ['bc-tl', p1.cornerGlyphs?.[0] || '', p1color],
    ['bc-tr', p2.cornerGlyphs?.[0] || '', p2color],
    ['bc-bl', p1.cornerGlyphs?.[1] || '', p1color],
    ['bc-br', p2.cornerGlyphs?.[1] || '', p2color],
  ];
  corners.forEach(([id, glyph, color]) => {
    const el = document.getElementById(id);
    if (el) { el.textContent = glyph; el.style.color = color; }
  });
}

function updatePlayerCardDetails(key) {
  const t = THEMES[key];
  if (!t) return;
  const p1 = t.players.egypt, p2 = t.players.hindu;
  const p1color = t.p1ink || '#9b3b14';
  const p2color = t.p2ink || '#3a4a8a';
  // Player card corner glyphs
  [['egypt', p1, p1color], ['hindu', p2, p2color]].forEach(([side, p, color]) => {
    const glyphs = p.cornerGlyphs || [];
    ['tl','tr','bl','br'].forEach((pos, i) => {
      const el = document.getElementById(`pcc-${side}-${pos}`);
      if (el) { el.textContent = glyphs[i] || ''; el.style.color = color; }
    });
    // Update pc-rule color
    const card = document.getElementById(`card-${side}`);
    if (card) {
      const rule = card.querySelector('.pc-rule');
      if (rule) rule.style.background = `repeating-linear-gradient(90deg, ${color} 0 6px, transparent 6px 14px)`;
    }
  });
}
