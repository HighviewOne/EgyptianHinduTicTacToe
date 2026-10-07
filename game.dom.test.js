'use strict';

// Integration tests that boot the real page (index.html + all scripts) in
// jsdom with fake timers, to cover timing bugs that pure unit tests can't:
// AI soft-locks under chaos rules, demo-mode stalls, restore-on-AI-turn,
// and stale AI moves leaking into the next round.

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const FakeTimers = require('@sinonjs/fake-timers');

const ROOT = __dirname;
const SCRIPTS = ['gameLogic.js', 'data.js', 'audio.js', 'ai.js', 'script.js'];

// Universal no-op stub: any property access or call returns another stub.
// Stands in for AudioContext and canvas 2D contexts, which jsdom lacks.
function stub() {
  return new Proxy(function () {}, {
    get: (_t, k) => (k === 'currentTime' ? 0 : k === Symbol.toPrimitive ? () => 0 : stub()),
    apply: () => stub(),
    construct: () => stub(),
  });
}

function bootPage({ storage = {}, audioContext = null } = {}) {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
    .replace(/<script[\s\S]*?<\/script>/g, '');
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/Not implemented/.test(e.message)) errors.push(e); });
  const dom = new JSDOM(html, {
    url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
  });
  const w = dom.window;
  const clock = FakeTimers.withGlobal(w).install({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
             'requestAnimationFrame', 'cancelAnimationFrame'],
  });
  w.AudioContext = audioContext || stub();
  w.HTMLCanvasElement.prototype.getContext = () => stub();
  w.navigator.vibrate = () => true;
  for (const [k, v] of Object.entries(storage)) w.localStorage.setItem(k, JSON.stringify(v));

  let random = 0.5;
  w.Math.random = () => random;

  const inject = code => {
    const el = w.document.createElement('script');
    el.textContent = code;
    w.document.body.appendChild(el);
  };
  for (const f of SCRIPTS) inject(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  // Expose script-scoped `let` state to the test.
  inject(`window.__t = {
    get state() { return gameState; },
    get chaosState() { return chaosState; },
    setChaosEnabled(ids) { chaosEnabled = new Set(ids); },
  };`);

  const $ = id => w.document.getElementById(id);
  return {
    w, clock, errors, $,
    t: w.__t,
    setRandom: r => { random = r; },
    clickCell: i => $('board').children[i].click(),
    key: code => w.document.dispatchEvent(new w.KeyboardEvent('keydown', { code, bubbles: true })),
    pieces: player => w.__t.state.board.filter(v => v === player).length,
  };
}

const INTRO_MS = 4100;   // intro overlay auto-dismiss
const CHAOS_MS = 4700;   // chaos rules overlay auto-dismiss

let page;
afterEach(() => {
  expect(page.errors).toEqual([]);
  page.clock.uninstall();
  page.w.close();
});

test('Holy Ground: AI does not stall when its preferred cell is forbidden', () => {
  page = bootPage();
  page.clock.tick(INTRO_MS);
  page.setRandom(0.5);                     // randInt(9) → 4: holy cell is the center
  page.t.setChaosEnabled(['holy-ground']);
  page.$('mode-hard').click();
  page.$('btn-chaos').click();
  page.clock.tick(CHAOS_MS);
  expect(page.t.chaosState.holyCell).toBe(4);

  page.clickCell(0);                       // Egypt takes a corner; best reply is the (forbidden) center
  page.clock.tick(1000);

  expect(page.pieces('hindu')).toBe(1);
  expect(page.t.state.board[4]).toBeNull();
  expect(page.t.state.currentPlayer).toBe('egypt');
});

test('Divine Lag: AI moves once the lag ends', () => {
  page = bootPage();
  page.clock.tick(INTRO_MS);
  page.setRandom(0.9);
  page.t.setChaosEnabled(['divine-lag']);
  page.$('mode-hard').click();
  page.$('btn-chaos').click();
  page.clock.tick(CHAOS_MS);

  page.setRandom(0.1);                     // < 0.22 → Divine Lag fires on this move
  page.clickCell(0);
  expect(page.t.chaosState.lagActive).toBe(true);
  page.clock.tick(1000);
  expect(page.pieces('hindu')).toBe(0);    // still frozen
  page.clock.tick(3000);

  expect(page.pieces('hindu')).toBe(1);
  expect(page.t.state.currentPlayer).toBe('egypt');
});

test('Demo mode + chaos: Egypt still moves after the chaos overlay closes', () => {
  page = bootPage();
  page.clock.tick(INTRO_MS);
  page.setRandom(0.9);
  page.t.setChaosEnabled(['solar-flare']);
  page.$('btn-chaos').click();
  page.clock.tick(CHAOS_MS);

  page.$('btn-spectator').click();         // new round, Egypt (AI) to start
  expect(page.t.state.currentPlayer).toBe('egypt');
  page.clock.tick(CHAOS_MS + 1500);

  expect(page.pieces('egypt')).toBeGreaterThanOrEqual(1);
});

test('Restoring a game saved on the AI turn resumes the AI', () => {
  page = bootPage({
    storage: {
      'ehttt': { key: 'egypt-hindu', mode: 'hard' },
      'ehttt-game': {
        board: ['egypt', null, null, null, null, null, null, null, null],
        currentPlayer: 'hindu', scores: { egypt: 0, hindu: 0, draws: 0 },
        cosmicAngle: 0, moveLog: [], lastPlacedCell: 0,
      },
    },
  });
  page.clock.tick(INTRO_MS);
  page.$('restore-yes').click();
  page.clock.tick(1000);

  expect(page.pieces('hindu')).toBe(1);
  expect(page.t.state.currentPlayer).toBe('egypt');
});

test('New round while the AI is thinking: the pending AI move is discarded', () => {
  page = bootPage();
  page.clock.tick(INTRO_MS);
  page.setRandom(0.9);
  page.$('mode-hard').click();

  page.clickCell(0);                       // AI now "ponders"
  page.clock.tick(100);
  page.key('KeyN');                        // new round; 0 games played → Egypt starts
  page.clock.tick(1000);

  expect(page.t.state.board.every(v => v === null)).toBe(true);
  expect(page.t.state.currentPlayer).toBe('egypt');
  page.clickCell(4);                       // human can play normally
  expect(page.t.state.board[4]).toBe('egypt');
});

// ─── Undo, overlays, shortcuts, replay ────────────────────────────────────────

// Two-player game where Egypt wins the top row: E0 H3 E1 H4 E2
function playEgyptTopRowWin(p) {
  [0, 3, 1, 4, 2].forEach(i => p.clickCell(i));
  expect(p.t.state.gameOver).toBe(true);
}

test('Undo after a win takes back the score and all-time stats', () => {
  page = bootPage();
  page.clock.tick(INTRO_MS);
  page.setRandom(0.9);
  playEgyptTopRowWin(page);
  const stats = () => JSON.parse(page.w.localStorage.getItem('ehttt-stats') || '{}');
  expect(page.t.state.scores.egypt).toBe(1);
  const winsAfter = stats().egypt;

  page.key('KeyU');
  page.clock.tick(2000);

  expect(page.t.state.gameOver).toBe(false);
  expect(page.t.state.scores.egypt).toBe(0);
  expect(page.$('score-egypt').textContent).toBe('0');
  expect(stats().egypt || 0).toBe(winsAfter - 1);
  expect(page.t.state.board[2]).toBeNull();
  expect(page.$('win-seal').classList.contains('visible')).toBe(false);

  page.clickCell(2);                       // winning again counts once, not twice
  expect(page.t.state.scores.egypt).toBe(1);
});

test('Undo removes the undone moves from the move log', () => {
  page = bootPage();
  page.clock.tick(INTRO_MS);
  page.clickCell(0);
  page.clickCell(4);
  page.key('KeyU');
  expect(page.w.eval('moveLog.length')).toBe(1);
});

test('Starting a new round right after a win does not pop the win seal over it', () => {
  page = bootPage();
  page.clock.tick(INTRO_MS);
  page.setRandom(0.9);
  playEgyptTopRowWin(page);
  page.clock.tick(100);
  page.key('KeyN');
  page.clock.tick(3000);

  expect(page.$('win-seal').classList.contains('visible')).toBe(false);
  expect(page.t.state.gameOver).toBe(false);
});

test('Escape closes the win seal', () => {
  page = bootPage();
  page.clock.tick(INTRO_MS);
  playEgyptTopRowWin(page);
  page.clock.tick(1500);
  expect(page.$('win-seal').classList.contains('visible')).toBe(true);
  page.key('Escape');
  expect(page.$('win-seal').classList.contains('visible')).toBe(false);
});

test('Typing in a player-name field does not trigger shortcuts', () => {
  page = bootPage();
  page.clock.tick(INTRO_MS);
  const name = page.$('name-egypt');
  name.focus();
  for (const code of ['KeyS', 'KeyN', 'Digit5', 'KeyM']) {
    name.dispatchEvent(new page.w.KeyboardEvent('keydown', { code, bubbles: true }));
  }
  expect(page.t.state.board.every(v => v === null)).toBe(true);
  expect(page.$('btn-spectator').classList.contains('on')).toBe(false);
});

test('New round during a replay stops the replay', () => {
  page = bootPage();
  page.clock.tick(INTRO_MS);
  page.setRandom(0.9);
  playEgyptTopRowWin(page);
  page.key('Escape');
  page.key('KeyR');
  page.clock.tick(400);
  page.key('KeyN');
  page.clock.tick(600);                    // a still-running replay would redraw the board here

  const starter = page.t.state.currentPlayer;   // India opens round 2
  page.clickCell(4);
  expect(page.t.state.board[4]).toBe(starter);
  page.clock.tick(5000);
  expect(page.$('status').textContent).not.toMatch(/Replay/);
  expect(page.$('board').querySelectorAll('.win-cell').length).toBe(0);
});

// ─── Achievements and names ───────────────────────────────────────────────────

test('Achievements unlock only for the human player', () => {
  page = bootPage();
  page.clock.tick(INTRO_MS);
  const ach = () => JSON.parse(page.w.localStorage.getItem('ehttt-ach') || '{}');

  page.w.eval("aiMode = 'hard'; checkAchievements('hindu');");
  expect(ach()['first-win']).toBeUndefined();

  page.w.eval("spectatorMode = true; checkAchievements('egypt'); spectatorMode = false;");
  expect(ach()['first-win']).toBeUndefined();

  page.w.eval("checkAchievements('egypt');");
  expect(ach()['first-win']).toBeDefined();
});

test('Custom player names are used in the turn label after reload', () => {
  page = bootPage({ storage: { 'ehttt': { key: 'egypt-hindu', name1: 'Cleo' } } });
  page.clock.tick(INTRO_MS);
  expect(page.$('status').textContent).toMatch(/^Cleo's turn/);
});

test('Demo games and AI moves do not count in all-time stats', () => {
  page = bootPage();
  page.clock.tick(INTRO_MS);
  page.setRandom(0.9);
  const stats = () => JSON.parse(page.w.localStorage.getItem('ehttt-stats') || '{}');

  page.$('mode-hard').click();
  page.clickCell(0);
  page.clock.tick(1000);                   // AI replies
  expect(page.pieces('hindu')).toBe(1);
  expect(stats().cellFreq.reduce((a, b) => a + b, 0)).toBe(1);

  page.$('btn-spectator').click();
  page.clock.tick(30000);                  // several AI-vs-AI games
  expect(page.w.eval('gameState.scores.draws')).toBeGreaterThan(0);
  expect(stats().gamesPlayed).toBeUndefined();
  expect(stats().cellFreq.reduce((a, b) => a + b, 0)).toBe(1);
});

// ─── Round-scoped timers ──────────────────────────────────────────────────────

test('A quip from the previous round does not overwrite the new round status', () => {
  page = bootPage();
  page.clock.tick(INTRO_MS);
  page.setRandom(0.1);                     // < 0.15 → a quip replaces the status for 1.7 s
  page.clickCell(0);
  expect(page.$('status').textContent).toMatch(/^💬/);
  page.key('KeyN');                        // Egypt starts again (0 games finished)
  page.clock.tick(2000);
  expect(page.$('status').textContent).toMatch(/^Egypt's turn/);
});

test('A newer toast is not hidden early by an older toast timer', () => {
  page = bootPage();
  page.clock.tick(INTRO_MS);
  const toast = page.$('chaos-event');
  page.w.eval("showChaosEvent('first', 2600)");
  page.clock.tick(2000);
  page.w.eval("showChaosEvent('second', 2600)");
  page.clock.tick(1000);                   // first toast's timer has expired by now
  expect(toast.textContent).toBe('second');
  expect(toast.classList.contains('visible')).toBe(true);
});

// ─── Audio ────────────────────────────────────────────────────────────────────

test('Saved volume does not create a suspended AudioContext; first click resumes it', () => {
  const log = { created: 0, resumed: 0 };
  // Mimics browser autoplay policy: contexts start suspended until resume().
  const FakeAudioContext = function () {
    log.created++;
    const ctx = stub();
    let state = 'suspended';
    return new Proxy(ctx, {
      get: (t, k) => k === 'state' ? state
        : k === 'resume' ? () => { log.resumed++; state = 'running'; return Promise.resolve(); }
        : t[k],
    });
  };
  page = bootPage({
    storage: { 'ehttt': { key: 'egypt-hindu', volSfx: 0.4, volMusic: 0.3 } },
    audioContext: FakeAudioContext,
  });
  page.clock.tick(INTRO_MS);
  expect(log.created).toBe(0);             // restoring prefs must not create it

  page.clickCell(0);                       // placement sound → context created in a gesture
  expect(log.created).toBe(1);
  expect(log.resumed).toBe(1);
});

// ─── Accessibility ────────────────────────────────────────────────────────────

test('Board cells are labelled buttons with visible coordinates; fog hides pieces', () => {
  page = bootPage();
  page.clock.tick(INTRO_MS);
  const cell = i => page.$('board').children[i];
  expect(page.$('board').getAttribute('role')).toBe('group');
  expect(cell(0).getAttribute('role')).toBe('button');
  expect(cell(0).getAttribute('aria-label')).toBe('A1, empty');

  page.clickCell(0);                       // Egypt at A1
  expect(cell(0).getAttribute('aria-label')).toBe('A1, Egypt');
  page.$('btn-fog').click();               // India to move: Egypt's piece is fogged
  expect(cell(0).getAttribute('aria-label')).toBe('A1, hidden piece');
});

test('Toggle buttons expose their state via aria-pressed', async () => {
  page = bootPage();
  page.clock.tick(INTRO_MS);
  const pressed = id => page.$(id).getAttribute('aria-pressed');
  expect(pressed('mode-2p')).toBe('true');
  expect(pressed('mode-hard')).toBe('false');
  expect(pressed('btn-fog')).toBe('false');
  expect(page.$('btn-install').hasAttribute('aria-pressed')).toBe(false);

  page.$('mode-hard').click();
  page.$('btn-fog').click();
  await Promise.resolve();                 // MutationObserver callbacks are microtasks
  expect(pressed('mode-hard')).toBe('true');
  expect(pressed('mode-2p')).toBe('false');
  expect(pressed('btn-fog')).toBe('true');
});

test('Dialogs: inert while closed, take focus when opened, return it on close', async () => {
  page = bootPage();
  page.clock.tick(INTRO_MS);
  const lore = page.$('lore-modal');
  expect(lore.getAttribute('role')).toBe('dialog');
  expect(lore.hasAttribute('inert')).toBe(true);

  const opener = page.$('btn-lore');
  opener.focus();
  opener.click();
  await Promise.resolve();
  expect(lore.hasAttribute('inert')).toBe(false);
  expect(lore.contains(page.w.document.activeElement)).toBe(true);

  page.key('Escape');                      // Escape now closes the Lore modal too
  await Promise.resolve();
  expect(lore.classList.contains('visible')).toBe(false);
  expect(lore.hasAttribute('inert')).toBe(true);
  expect(page.w.document.activeElement).toBe(opener);
});

// ─── Full-review fixes ────────────────────────────────────────────────────────

test('Cursed Skip re-renders for the new player (fog) and restarts their timer', () => {
  page = bootPage();
  page.clock.tick(INTRO_MS);
  page.setRandom(0.9);
  page.t.setChaosEnabled(['cursed-skip']);
  page.$('btn-fog').click();
  page.$('btn-timed').click();
  page.$('btn-chaos').click();
  page.clock.tick(CHAOS_MS);

  page.setRandom(0.1);                     // < 0.18 → India's next turn will be skipped
  page.clickCell(0);
  page.setRandom(0.9);
  page.clickCell(4);                       // India's move is swallowed by the skip

  expect(page.t.state.board[4]).toBeNull();
  expect(page.t.state.currentPlayer).toBe('egypt');
  const own = page.$('board').children[0];
  expect(own.classList.contains('fog-hidden')).toBe(false);   // Egypt sees its own piece
  expect(page.$('timer-wrap').classList.contains('active')).toBe(true);
});

test('A hint followed by a quick move does not restore the old status text', () => {
  page = bootPage();
  page.clock.tick(INTRO_MS);
  page.setRandom(0.9);
  page.clickCell(0);
  page.$('btn-hint').click();              // India's hint
  page.clickCell(4);                       // India moves before the hint expires
  page.clock.tick(2000);

  expect(page.t.state.currentPlayer).toBe('egypt');
  expect(page.$('status').textContent).toMatch(/^Egypt's turn/);
});

test('Restore brings back the replay log and drops undo history of the replaced board', () => {
  page = bootPage({
    storage: {
      'ehttt-game': {
        board: ['egypt', null, null, null, 'hindu', null, null, null, null],
        currentPlayer: 'egypt', scores: { egypt: 0, hindu: 0, draws: 0 }, cosmicAngle: 0,
        moveLog: [{ player: 'egypt', pos: 'A1', turn: 1, quality: 'best' },
                  { player: 'hindu', pos: 'B2', turn: 2, quality: 'best' }],
        gameLog: [['egypt', null, null, null, null, null, null, null, null],
                  ['egypt', null, null, null, 'hindu', null, null, null, null]],
        lastPlacedCell: 4,
      },
    },
  });
  page.clock.tick(INTRO_MS);
  page.setRandom(0.9);
  page.clickCell(8);                       // a move on the fresh board before restoring
  page.$('restore-yes').click();

  expect(page.w.eval('gameLog.length')).toBe(2);
  expect(page.t.state.history).toEqual([]);
  expect(page.$('btn-undo').disabled).toBe(true);
});

test('Demo mode: games are not auto-saved and undo is disabled', () => {
  page = bootPage();
  page.clock.tick(INTRO_MS);
  page.setRandom(0.9);
  page.$('btn-spectator').click();
  page.clock.tick(1500);
  expect(page.pieces('egypt')).toBeGreaterThanOrEqual(1);
  expect(page.w.localStorage.getItem('ehttt-game')).toBeNull();

  const before = [...page.t.state.board];
  page.key('KeyU');
  expect(page.t.state.board).toEqual(before);
  expect(page.$('btn-undo').disabled).toBe(true);
});

test('Switching theme: the demo AI waits for the intro to be dismissed', () => {
  page = bootPage();
  page.clock.tick(INTRO_MS);
  page.setRandom(0.9);
  page.$('btn-spectator').click();
  page.w.document.querySelector('.theme-btn[data-theme="classic"]').click();
  page.clock.tick(2000);                   // intro still up
  expect(page.pieces('egypt')).toBe(0);
  page.clock.tick(INTRO_MS);
  expect(page.pieces('egypt')).toBeGreaterThanOrEqual(1);
});

// ─── Review follow-ups ────────────────────────────────────────────────────────

test('Move quality: a slower win is "fine", throwing away a win is a "blunder"', () => {
  page = bootPage();
  const q = i => page.w.eval(`computeMoveDetails(['hindu',null,null,null,'hindu','egypt','egypt',null,null], 'hindu', ${i}).quality`);
  expect(q(8)).toBe('best');               // wins now
  expect(q(1)).toBe('fine');               // fork: still wins, just later
  expect(q(3)).toBe('blunder');            // gives up the forced win
});

test('Holy Ground: no threat highlight on the forbidden cell', () => {
  page = bootPage();
  page.clock.tick(INTRO_MS);
  page.setRandom(0.5);                     // holy cell = 4
  page.t.setChaosEnabled(['holy-ground']);
  page.$('btn-chaos').click();
  page.clock.tick(CHAOS_MS);
  [0, 1, 8].forEach(i => page.clickCell(i));   // Egypt has 0 and 8; 4 would complete the diagonal

  const center = page.$('board').children[4];
  expect(center.classList.contains('threat-egypt')).toBe(false);
});

test('Undoing a win also cancels its pending rank-up / milestone toasts', () => {
  page = bootPage({ storage: { 'ehttt-stats': { egypt: 4, gamesPlayed: 4 } } });  // next win → Strategist + 5-win milestone
  page.clock.tick(INTRO_MS);
  page.setRandom(0.9);
  playEgyptTopRowWin(page);
  page.clock.tick(100);
  page.key('KeyU');
  const seen = [];
  for (let t = 0; t < 4000; t += 100) { page.clock.tick(100); seen.push(page.$('chaos-event').textContent); }
  expect(seen.some(x => /RANKS UP|Victories/.test(x))).toBe(false);
});
