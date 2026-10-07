'use strict';

const fs = require('fs');
const js = require('@eslint/js');
const globals = require('globals');

// The game is plain <script> files sharing one global scope, in this order.
// Each file may use what any of them declares at top level, so collect those
// names and declare them as globals for all of them.
const GAME_FILES = ['gameLogic.js', 'data.js', 'audio.js', 'ai.js', 'script.js'];
const shared = {};
for (const f of GAME_FILES) {
  const src = fs.readFileSync(f, 'utf8');
  for (const [, name] of src.matchAll(/^(?:const|let|var|function|async function)\s+([A-Za-z_$][\w$]*)/gm)) {
    shared[name] = 'writable';
  }
}

module.exports = [
  { ignores: ['node_modules/**', '_site/**'] },
  js.configs.recommended,
  {
    files: GAME_FILES,
    languageOptions: {
      sourceType: 'script',
      globals: { ...globals.browser, ...shared, module: 'readonly' },
    },
    rules: {
      // Top-level names are used across files, so only check locals.
      'no-unused-vars': ['error', { vars: 'local', args: 'none', caughtErrors: 'none' }],
      // Each file's own declarations are also in `shared`; that's expected.
      'no-redeclare': ['error', { builtinGlobals: false }],
      // try { localStorage… } catch (_) {} — storage can be unavailable
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['sw.js'],
    languageOptions: { sourceType: 'script', globals: globals.serviceworker },
  },
  {
    files: ['*.test.js', 'eslint.config.js'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node, ...globals.jest } },
  },
];
