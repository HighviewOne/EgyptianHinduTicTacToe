'use strict';

const {
  EGYPT, HINDU, WIN_LINES,
  checkWinner, getNextPlayer, getStartingPlayer, createInitialBoard,
  BLOCKED, blockCell,
} = require('./gameLogic');

// ─── createInitialBoard ───────────────────────────────────────────────────────

describe('createInitialBoard', () => {
  test('returns a 9-element array', () => {
    expect(createInitialBoard()).toHaveLength(9);
  });

  test('every cell is null', () => {
    expect(createInitialBoard().every(v => v === null)).toBe(true);
  });

  test('returns a fresh array each call', () => {
    const a = createInitialBoard();
    const b = createInitialBoard();
    expect(a).not.toBe(b);
  });
});

// ─── checkWinner — in progress ────────────────────────────────────────────────

describe('checkWinner — in progress', () => {
  test('returns null on an empty board', () => {
    expect(checkWinner(createInitialBoard())).toBeNull();
  });

  test('returns null when the board is partially filled with no winner', () => {
    const board = [EGYPT, HINDU, null, null, null, null, null, null, null];
    expect(checkWinner(board)).toBeNull();
  });
});

// ─── checkWinner — all 8 win lines ───────────────────────────────────────────

describe('checkWinner — win lines', () => {
  for (const [player, label] of [[EGYPT, 'Egypt'], [HINDU, 'Hindu']]) {
    for (const line of WIN_LINES) {
      test(`${label} wins line [${line}]`, () => {
        const board = createInitialBoard();
        line.forEach(i => { board[i] = player; });
        const result = checkWinner(board);
        expect(result).not.toBeNull();
        expect(result.winner).toBe(player);
        expect(result.cells).toEqual(line);
      });
    }
  }
});

// ─── checkWinner — draw ───────────────────────────────────────────────────────

describe('checkWinner — draw', () => {
  test('returns draw when board is full with no winner', () => {
    // E H E
    // H E H  ← no winning line for either player
    // H E H
    const board = [
      EGYPT, HINDU, EGYPT,
      HINDU, EGYPT, HINDU,
      HINDU, EGYPT, HINDU,
    ];
    const result = checkWinner(board);
    expect(result).not.toBeNull();
    expect(result.winner).toBe('draw');
    expect(result.cells).toEqual([]);
  });
});

// ─── getNextPlayer ────────────────────────────────────────────────────────────

describe('getNextPlayer', () => {
  test('Egypt → Hindu', () => {
    expect(getNextPlayer(EGYPT)).toBe(HINDU);
  });

  test('Hindu → Egypt', () => {
    expect(getNextPlayer(HINDU)).toBe(EGYPT);
  });
});

// ─── getStartingPlayer ────────────────────────────────────────────────────────

describe('getStartingPlayer', () => {
  test('Egypt starts when total completed games is 0 (even)', () => {
    expect(getStartingPlayer({ egypt: 0, hindu: 0, draws: 0 })).toBe(EGYPT);
  });

  test('Hindu starts when total completed games is 1 (odd)', () => {
    expect(getStartingPlayer({ egypt: 1, hindu: 0, draws: 0 })).toBe(HINDU);
  });

  test('Egypt starts when total completed games is 2 (even)', () => {
    expect(getStartingPlayer({ egypt: 1, hindu: 1, draws: 0 })).toBe(EGYPT);
  });

  test('Hindu starts when total completed games is 3 (odd)', () => {
    expect(getStartingPlayer({ egypt: 1, hindu: 1, draws: 1 })).toBe(HINDU);
  });

  test('draws count toward the total', () => {
    expect(getStartingPlayer({ egypt: 0, hindu: 0, draws: 2 })).toBe(EGYPT);
    expect(getStartingPlayer({ egypt: 0, hindu: 0, draws: 3 })).toBe(HINDU);
  });
});

// ─── blockCell (Holy Ground) ──────────────────────────────────────────────────

describe('blockCell', () => {
  test('fills an empty cell with BLOCKED without mutating the input', () => {
    const board = createInitialBoard();
    const out = blockCell(board, 4);
    expect(out[4]).toBe(BLOCKED);
    expect(board[4]).toBeNull();
  });

  test('leaves an occupied cell alone', () => {
    const board = createInitialBoard();
    board[4] = EGYPT;
    expect(blockCell(board, 4)[4]).toBe(EGYPT);
  });

  test('index -1 (rule inactive) returns an unchanged copy', () => {
    const board = createInitialBoard();
    const out = blockCell(board, -1);
    expect(out).toEqual(board);
    expect(out).not.toBe(board);
  });

  test('only the blocked cell left empty counts as a draw', () => {
    // E H E / E H H / H E _  — cell 8 is holy, no line complete
    const board = [EGYPT, HINDU, EGYPT, EGYPT, HINDU, HINDU, HINDU, EGYPT, null];
    expect(checkWinner(board)).toBeNull();
    expect(checkWinner(blockCell(board, 8))).toEqual({ winner: 'draw', cells: [] });
  });
});

// ─── AI never picks a blocked cell ────────────────────────────────────────────

describe('getBestMove with a blocked cell', () => {
  Object.assign(global, { EGYPT, HINDU, WIN_LINES, randInt: n => Math.floor(Math.random() * n) });
  const { getBestMove, setAiMode } = require('./ai');

  test.each(['easy', 'medium', 'hard'])('%s AI avoids the Holy Ground cell', mode => {
    setAiMode(mode);
    for (let holy = 0; holy < 9; holy++) {
      for (let first = 0; first < 9; first++) {
        if (first === holy) continue;
        const board = createInitialBoard();
        board[first] = EGYPT;
        for (let k = 0; k < 5; k++) {
          expect(getBestMove(blockCell(board, holy))).not.toBe(holy);
        }
      }
    }
  });
});
