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

function bootPage({ storage = {} } = {}) {
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
  w.AudioContext = stub();
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
