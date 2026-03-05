'use strict';

// ─── Player constants ────────────────────────────────────────────────────────
const EGYPT = 'egypt';
const HINDU = 'hindu';

// ─── Win lines ───────────────────────────────────────────────────────────────
// All 8 possible winning combinations on the flat 9-cell board:
//   0 | 1 | 2
//   3 | 4 | 5
//   6 | 7 | 8
const WIN_LINES = [
  [0,1,2],[3,4,5],[6,7,8],   // rows
  [0,3,6],[1,4,7],[2,5,8],   // columns
  [0,4,8],[2,4,6],           // diagonals
];

// ─── checkWinner ─────────────────────────────────────────────────────────────
// Tests every winning line against the supplied board array.
// Returns { winner: 'egypt'|'hindu'|'draw', cells: number[] }, or null if the
// game is still in progress.
function checkWinner(board) {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], cells: line };
    }
  }
  if (board.every(v => v !== null)) return { winner: 'draw', cells: [] };
  return null;
}

// ─── getNextPlayer ───────────────────────────────────────────────────────────
// Returns the opponent of the given player.
function getNextPlayer(player) {
  return player === EGYPT ? HINDU : EGYPT;
}

// ─── getStartingPlayer ───────────────────────────────────────────────────────
// Determines who goes first in the next round.
// Even total of completed games → Egypt; odd → India.
// This ensures neither player is always disadvantaged.
function getStartingPlayer(scores) {
  return (scores.egypt + scores.hindu + scores.draws) % 2 === 0 ? EGYPT : HINDU;
}

// ─── createInitialBoard ──────────────────────────────────────────────────────
// Returns a fresh 9-element board array. Called by newRound() and tests.
function createInitialBoard() {
  return Array(9).fill(null);
}

// ─── Export ──────────────────────────────────────────────────────────────────
// CommonJS export for Jest; when loaded via <script> in the browser the
// symbols are already on the global scope, so no extra work is needed.
if (typeof module !== 'undefined') {
  module.exports = { EGYPT, HINDU, WIN_LINES, checkWinner, getNextPlayer, getStartingPlayer, createInitialBoard };
}
