# Egyptian & Hindu Tic-Tac-Toe
### Battle of the Ancient Realms

A fully-featured browser Tic-Tac-Toe game with cinematic themes, a strategic AI, chaos rules, procedural music, and a progression system — all in vanilla HTML / CSS / JS, zero dependencies.

**[▶ Play Live](https://highviewone.github.io/EgyptianHinduTicTacToe/)** · Installable PWA — works offline

---

## Themes

Four named themes, each with unique symbols, colors, music, win messages, quips, lore facts, and corner glyphs. A fifth **✦ Random** mode procedurally generates a brand-new palette and symbol pair every time.

| Theme | Player 1 | Player 2 | Vibe |
|---|---|---|---|
| ☥ Egypt vs India | Egypt ☥ | India ॐ | Golden desert meets cosmic lotus |
| ✕ X vs O | X | O | Clean, ruthless geometry |
| ⚡ Greek vs Norse | Greece ⚡ | Norse ⚔️ | Olympus vs Asgard |
| ⚔ Samurai vs Ninja | Samurai ⛩ | Ninja 🥷 | Honor vs shadow |

### Lore & Quips

Every theme ships with five historically (and comedically) accurate lore facts that pop up after games, and four per-player **quips** that flash in the status bar with a 15 % chance each move. Win messages are drawn randomly from a pool of three per player, so no two victories feel the same.

---

## Game Modes

- **2 Players** — local hot-seat
- **vs AI — Easy** — random moves
- **vs AI — Medium** — 50 % random, 50 % minimax
- **vs AI — Hard** — full minimax with alpha-beta pruning (unbeatable)

---

## ⚡ Chaos Mode

Toggle Chaos mode to spice up each round with 1–3 randomly chosen rules from the catalogue below. Active rules display in a chip bar above the board and fire live during play.

| Rule | Icon | Effect |
|---|---|---|
| Wild Turn | 🎲 | Once per round, a placed piece teleports to a random empty square |
| Swap Souls | 🔄 | Two pieces switch allegiances mid-game |
| Ghost Move | 👻 | One piece becomes spectral — barely real, barely counts |
| Smite | ⚡ | A divine bolt obliterates a random enemy piece |
| Blessing of Twofold | ✨ | One lucky player claims two squares in a single turn |
| Cursed Skip | 💀 | A player's next turn is silently, divinely skipped |
| Mirror Realm | 🪞 | The board is horizontally reflected |
| Chaos Storm | 🌪 | The board shakes violently after every move |
| Solar Flare | 🌟 | A blinding flash strikes at the worst moment |
| Divine Lag | ⏳ | All input freezes for 3 celestial seconds |

---

## Fun Modes

| Button | Effect |
|---|---|
| ✨ Cosmic | Board rotates 3° per turn, accumulating over the game |
| 🌪 Storm | Board shakes randomly on 38 % of turns |
| ⚡ Chaos | Activates the Chaos rules system |
| ⏱ Timed | 15-second move timer; random move placed on expiry |
| ⛶ Full | Toggle fullscreen |

---

## Tournament Mode

Select **Best of 3 / 5 / 7** from the Match row. Pip indicators on each player card fill as they win rounds. A full-screen match victory overlay fires when a player reaches the winning threshold. Preference persists across reloads.

---

## Achievements

Eight unlockable achievements stored in `localStorage`. A slide-in toast confirms each unlock; multiple unlocks queue gracefully.

| Achievement | Condition |
|---|---|
| ⚔️ First Blood | Win any game |
| 🔥 On Fire | Win 3 games in a row |
| 🤖 Machine Breaker | Defeat the Hard AI |
| ⚡ Lord of Chaos | Win a round with Chaos mode on |
| ⏱ Speed Demon | Win while Timed mode is on |
| 🏆 Match Master | Win a Best of 5 or 7 match |
| ✨ Cosmic Champion | Win with Cosmic mode on |
| 🌍 Pilgrim of Ages | Play all 4 named themes |
| ⚖️ Equilibrium | Play to a draw |
| 💨 Lightning Strike | Win in the minimum 5 moves |
| 🌙 Night Owl | Play between 22:00 and 04:00 |
| 👑 Undisputed | Win a Best of 3 without dropping a round |

---

## All-Time Stats

The 📊 Stats button opens a modal showing cumulative games played, draws, per-player wins, best streak, and player-1 win rate — persisted across sessions.

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `1`–`9` | Place on cell (reading order; top-left = 1) |
| `Numpad 1`–`9` | Place on cell (board-intuitive; Numpad 7 = top-left) |
| `N` | New round |
| `M` | Toggle music |
| `U` | Undo last move |
| `H` | Show move hint (pulses best cell for 1.8 s) |
| `F` | Toggle fullscreen |
| `?` | Toggle keyboard shortcut help panel |
| `Escape` | Close overlays |

---

## Procedural Music

Each theme has its own modal scale, melody pattern, step tempo, and drone frequencies built from Web Audio API oscillators — no audio files required. Music crossfades on theme change and layers an LFO-modulated ambient drone beneath the melody.

---

## File Structure

```
index.html          static shell and all overlays
manifest.json       PWA manifest (installable, offline-ready)
sw.js               service worker — offline-first cache
icon.svg            app icon
styles.css          CSS custom-property theming system (~1 100 lines)
data.js             all static data: themes, chaos rules, quips, achievements
audio.js            Web Audio API — sound effects + procedural background music
ai.js               minimax with alpha-beta pruning + mode management
script.js           game loop, UI, chaos engine, events, localStorage
gameLogic.js        pure game logic — board and win detection (Jest-tested)
gameLogic.test.js   29 unit tests
```

### localStorage Keys

| Key | Contents |
|---|---|
| `ehttt` | Preferences: theme, AI mode, fun modes, match length |
| `ehttt-stats` | All-time game statistics |
| `ehttt-ach` | Unlocked achievements + themes-played tracking |

---

## Running Locally

Open `index.html` directly in any modern browser — no build step or server required.

```bash
npm test   # run the 29 unit tests
```

---

## Deploying

The repo includes a GitHub Actions workflow (`.github/workflows/pages.yml`) that publishes the site automatically on every push to `main`.

To enable it on your fork:
1. Go to **Settings → Pages** and set Source to **GitHub Actions**.
2. Push to `main` — the workflow deploys in ~30 seconds.
3. Your live URL will be `https://<username>.github.io/<repo>/`.
