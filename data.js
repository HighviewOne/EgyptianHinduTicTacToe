/* ─────────────────────────────────────────────
   data.js — Static game data
   All pure constants: themes, chaos rules,
   quips, draw messages, achievements, rand pairs.
   No DOM access. No function calls on load.
───────────────────────────────────────────── */

/* ── Named themes ── */
const THEMES = {
  'egypt-hindu': {
    label: '☥ Egypt vs India',
    corners: ['𓂀','ॐ','☥','🪷'],
    footer:  ['𓂀','☥','𓆙','ॐ','🪷','🔱'],
    loreFacts: [
      "Cleopatra lived closer in time to the Moon landing than to the construction of the Great Pyramid. ☥",
      "The 'Om' symbol appears over 400 times in the Rigveda, one of humanity's oldest texts.",
      "Ancient Egyptians believed the heart — not the brain — was the seat of the soul. Ra weighed it against a feather.",
      "The Bhagavad Gita was recited on a battlefield. An entire war paused for a 700-verse philosophical debate.",
      "Hieroglyphs were used for 3,500 years. No one could read them for 1,400 years until the Rosetta Stone. Oops.",
    ],
    music: {
      scale:  [110, 116.54, 138.59, 146.83, 164.81, 174.61, 207.65, 220, 246.94],
      pattern:[4,3,2,4, 6,4,3,2, 1,0,2,3, -1, 6,7,6,4, 3,4,-1, 2,0,-1, 4,2,0,-1],
      stepMs: 560,
      droneFreqs:   [{freq:55,vol:.22},{freq:82.41,vol:.13},{freq:110,vol:.10},{freq:164.81,vol:.06}],
      droneLfoFreq: 0.11,
    },
    players: {
      egypt: {
        symbol: '☥', name: 'Egypt', title: "Pharaoh's Ankh",
        lore:   "Keepers of sacred hieroglyphs, born of the Nile's eternal tide",
        intro:  "Ra descends from the eternal sun, golden and terrible...",
        label:  "Egypt's turn — Place the Ankh ☥",
        winMsgs: [
          "🏆 EGYPT WINS! The Pharaoh's enemies are now ground to sand. Literally. It's a desert. ☥",
          "🏆 Ra himself descended to move that last piece. Egypt takes the credit anyway. ☥",
          "🏆 Historians are already carving this into pyramid walls. It will outlast civilization. ☥",
        ],
        primary: '#D4A017',
        vars: { '--egypt-gold':'#D4A017','--egypt-sand':'#F2D77E',
                '--egypt-dark':'#1A0A00','--egypt-brown':'#7B4A1E','--egypt-teal':'#1B6E6E',
                '--p1-rgb':'212,160,23' },
      },
      hindu: {
        symbol: 'ॐ', name: 'India', title: 'Divine Om',
        lore:   'Weavers of cosmic order, guardians of the divine syllable',
        intro:  "Vishnu stirs from a thousand-year cosmic slumber...",
        label:  "India's turn — Invoke the Om ॐ",
        winMsgs: [
          "🏆 INDIA WINS! Vishnu has added this to his list of 1,008 divine accomplishments. Number 1,009! ॐ",
          "🏆 The cosmic wheel of Dharma has spoken, and it said India wins. The universe is pleased. ॐ",
          "🏆 Shiva opened a third eye just to watch India claim this. The board is spiritually destroyed. 🪷",
        ],
        primary: '#FF9933',
        vars: { '--hindu-orange':'#FF6B35','--hindu-saffron':'#FF9933',
                '--hindu-purple':'#6A0572','--hindu-rose':'#E91E8C',
                '--p2-rgb':'255,153,51' },
      },
    },
  },
  'classic': {
    label: '✕ Classic X / O',
    corners: ['✕','○','✕','○'],
    footer:  ['✕','○','✕','○','✕','○'],
    loreFacts: [
      "Tic-tac-toe dates back to ancient Rome, where it was called Terni Lapilli. Romans were bored too.",
      "A perfectly played game of tic-tac-toe ALWAYS ends in a draw. Every. Single. Time. Without exception.",
      "The first computer tic-tac-toe program was written in 1952 as part of a PhD thesis. The future came early.",
      "There are 255,168 possible games of tic-tac-toe, but only 138 distinct final positions. Math is elegant.",
      "The name 'tic-tac-toe' may derive from a blind game of pencil-striking squares. Nobody is completely sure.",
    ],
    music: {
      scale:  [130.81, 146.83, 164.81, 174.61, 196, 220, 246.94, 261.63],
      pattern:[0,2,4,7, 6,4,2,0, 4,5,6,4, -1, 7,6,4,2, 0,2,4,-1, 6,7,6,4, 2,0,-1],
      stepMs: 380,
      droneFreqs:   [{freq:65.41,vol:.18},{freq:130.81,vol:.11},{freq:196,vol:.07},{freq:261.63,vol:.04}],
      droneLfoFreq: 0.18,
    },
    players: {
      egypt: { symbol:'✕', name:'X', title:'Crosses',
               lore:'Crisp and decisive — the mark of the bold',
               intro:'X steps into the arena. No words. Just X.',
               label:"X's turn — Place the Cross",
               winMsgs:["🏆 X WINS! Cold. Calculated. Absolutely ruthless. X offers no apologies and zero context.",
                        "🏆 CROSSES TRIUMPH! Mathematics bows before X. The angles were perfect.",
                        "🏆 X dominates! The opposition has been thoroughly cross-examined. Verdict: X wins."],
               primary:'#4FC3F7',
               vars:{ '--egypt-gold':'#4FC3F7','--egypt-sand':'#B3E5FC',
                      '--egypt-dark':'#0A1A2A','--egypt-brown':'#1A3A5A','--egypt-teal':'#0288D1',
                      '--p1-rgb':'79,195,247' } },
      hindu: { symbol:'○', name:'O', title:'Noughts',
               lore:'Complete and eternal — the unbroken circle',
               intro:'O arrives. Perfect. Complete. Circular.',
               label:"O's turn — Place the Circle",
               winMsgs:["🏆 O WINS! The circle of life has spoken, and it said O. Full circle. Literally.",
                        "🏆 NOUGHTS PREVAIL! O has been going in circles this whole time. Circles of VICTORY.",
                        "🏆 Unbreakable! Eternal! O is the shape of zero regrets."],
               primary:'#EF5350',
               vars:{ '--hindu-orange':'#EF5350','--hindu-saffron':'#FF7043',
                      '--hindu-purple':'#3A0A0A','--hindu-rose':'#E53935',
                      '--p2-rgb':'239,83,80' } },
    },
  },
  'greek-norse': {
    label: '⚡ Greek vs Norse',
    corners: ['⚡','⚔️','🏛','🐺'],
    footer:  ['⚡','🏛','⚔️','🐺','🌩','🛡'],
    loreFacts: [
      "Zeus transformed himself into a swan, a bull, a shower of gold, and a cuckoo. Priorities unclear.",
      "Odin's ravens Huginn and Muninn mean 'Thought' and 'Memory.' He literally sent his mind across the world daily.",
      "Thor once dressed as a bride to retrieve his hammer from a giant. Loki helped him. This is canon.",
      "Sisyphus tricked death twice. The gods were so impressed they sentenced him to roll a boulder uphill forever.",
      "Hercules was supposed to do 10 labors. He messed up 2 of them and had to do 2 extra. Classic overachiever.",
    ],
    music: {
      scale:  [146.83, 164.81, 174.61, 196, 220, 233.08, 261.63, 293.66],
      pattern:[0,2,4,7, 6,4,2,0, 3,4,5,7, -1, 7,6,4,3, 5,4,2,-1, 0,2,4,7, 3,0,-1],
      stepMs: 620,
      droneFreqs:   [{freq:73.42,vol:.20},{freq:110,vol:.13},{freq:146.83,vol:.09},{freq:220,vol:.05}],
      droneLfoFreq: 0.07,
    },
    players: {
      egypt: { symbol:'⚡', name:'Greece', title:"Zeus's Thunder",
               lore:'Heirs of Olympus, where gods walk among mortals',
               intro:"Zeus charges his thunderbolts. He's been waiting for this.",
               label:"Greece's turn — Cast the Thunder ⚡",
               winMsgs:["🏆 ZEUS WINS! Lightning has struck! Again! The insurance claims are astronomical! ⚡",
                        "🏆 THE ORACLE PREDICTED THIS! She also predicted 46 other things. This was the one. 🏛",
                        "🏆 OLYMPUS QUAKES! Hera is already jealous of this victory. As usual. ⚡"],
               primary:'#FFD700',
               vars:{ '--egypt-gold':'#FFD700','--egypt-sand':'#FFF8DC',
                      '--egypt-dark':'#1A1400','--egypt-brown':'#6A5A00','--egypt-teal':'#4A90E2',
                      '--p1-rgb':'255,215,0' } },
      hindu: { symbol:'⚔️', name:'Norse', title:"Odin's Blade",
               lore:'Children of Yggdrasil, forged in the fires of Ragnarök',
               intro:"Odin opens his one remaining eye. He's seen this coming.",
               label:"Norse's turn — Swing the Blade ⚔️",
               winMsgs:["🏆 ODIN WINS! He sacrificed an eye for wisdom. Worth it. Would do it again. ⚔️",
                        "🏆 VALHALLA FEASTS! Norse Triumphs! The mead flows! The skalds compose! Very loud! ⚔️",
                        "🏆 RAGNARÖK POSTPONED! All parties agree to celebrate Norse's victory first. 🐺"],
               primary:'#8AB4F8',
               vars:{ '--hindu-orange':'#5B8FD0','--hindu-saffron':'#8AB4F8',
                      '--hindu-purple':'#0A1A3A','--hindu-rose':'#4A7AC0',
                      '--p2-rgb':'138,180,248' } },
    },
  },
  'dragon-phoenix': {
    label: '🐉 Dragon vs Phoenix',
    corners: ['龍','鳳','🐉','🌟'],
    footer:  ['龍','🐉','🌟','鳳','🌸','☁'],
    loreFacts: [
      "In Chinese mythology, the Dragon and Phoenix represent the Emperor and Empress — cosmic equals in eternal opposition. And yet, here they are on a 3×3 grid.",
      "The Chinese Dragon (龍) is benevolent, controlling rain and rivers. It has nothing to do with hoarding gold and terrorising villages. That's the Europeans.",
      "The Fenghuang (鳳凰) is not the Western phoenix — it doesn't rise from ashes. It simply refuses to land anywhere that isn't absolutely worthy of it.",
      "For 2,000 years, only the Emperor could use the Dragon symbol. The Dragon player carries this historical weight personally and should feel it.",
      "Ancient texts say the Fenghuang appears only in times of peace. It has apparently given up waiting and decided to play tic-tac-toe instead.",
    ],
    music: {
      scale:  [110, 130.81, 146.83, 164.81, 196, 220, 261.63, 293.66, 329.63, 392],
      pattern:[0,2,3,2, 0,-1, 4,3,2,0, -1, 5,4,3,2, -1, 2,3,4,3, 2,0,-1, 7,6,5,4, 3,2,-1, 0,2,3,-1],
      stepMs: 500,
      droneFreqs:   [{freq:55,vol:.20},{freq:110,vol:.13},{freq:146.83,vol:.09},{freq:196,vol:.05}],
      droneLfoFreq: 0.08,
    },
    players: {
      egypt: {
        symbol: '龍', name: 'Dragon', title: "Heaven's Claw",
        lore:   'Lord of storms and rivers, sovereign of the nine celestial courts',
        intro:  "The Dragon uncoils from ten thousand years of slumber...",
        label:  "Dragon's turn — Strike with the Claw 龍",
        winMsgs: [
          "🏆 THE DRAGON ASCENDS! 龍 Heaven shakes, earth trembles, and the board collapses into legend!",
          "🏆 Nine celestial courts bow before this grid victory! 龍 The Dragon breathes fire on the opposition!",
          "🏆 DRAGON TRIUMPHANT! 龍 Ten thousand years of draconic dominance continues unbroken!",
        ],
        primary: '#DC143C',
        vars: { '--egypt-gold':'#DC143C','--egypt-sand':'#FF8080',
                '--egypt-dark':'#1A0006','--egypt-brown':'#5A0D1A','--egypt-teal':'#8B0000',
                '--p1-rgb':'220,20,60' },
      },
      hindu: {
        symbol: '鳳', name: 'Phoenix', title: 'Eternal Flame',
        lore:   'Born of sacred fire, whose song silences all other music',
        intro:  "The Phoenix lands. The air tastes of cinnamon and destiny.",
        label:  "Phoenix's turn — Rise from the Flame 鳳",
        winMsgs: [
          "🏆 THE PHOENIX PREVAILS! 鳳 From the sacred flames, a champion emerges absolutely immaculate!",
          "🏆 The Fenghuang has deemed this board worthy of its landing! 🌟 The universe is honoured.",
          "🏆 PHOENIX REIGNS! 鳳 Beauty, grace, and utterly devastating tactical grid awareness!",
        ],
        primary: '#FF8C00',
        vars: { '--hindu-orange':'#E07000','--hindu-saffron':'#FF8C00',
                '--hindu-purple':'#2A1500','--hindu-rose':'#FFA040',
                '--p2-rgb':'255,140,0' },
      },
    },
  },
  'samurai-ninja': {
    label: '⚔ Samurai vs Ninja',
    corners: ['⛩','🥷','⚔','🌸'],
    footer:  ['⛩','⚔','🌸','🥷','🗡','🌙'],
    loreFacts: [
      "Miyamoto Musashi won 60+ duels and showed up late to every single one. Deliberately. Psychological warfare.",
      "The word 'ninja' only became common in the 20th century. Historically they were called 'shinobi.' Ninja is marketing.",
      "Some samurai practiced ikebana (flower arranging) alongside swordsmanship. Balance is the way of Bushido.",
      "Most historical 'ninja attacks' were disinformation campaigns run by ninja themselves. circa 1400 CE. Genius.",
      "The katana required over 1,000 folding steps during forging. That's dedication. Also, the math is staggering.",
    ],
    music: {
      scale:  [110, 123.47, 130.81, 164.81, 174.61, 220, 246.94, 261.63, 329.63],
      pattern:[0,2,-1, 4,2,0,-1, 3,4,5,-1, 4,2,-1, 0,3,4,-1, 5,4,2,0,-1, 2,-1, 4,5,4,-1],
      stepMs: 680,
      droneFreqs:   [{freq:55,vol:.16},{freq:110,vol:.12},{freq:123.47,vol:.09},{freq:164.81,vol:.05}],
      droneLfoFreq: 0.05,
    },
    players: {
      egypt: { symbol:'⛩', name:'Samurai', title:'Bushido Code',
               lore:'Honor bound by Bushido, blade swift as the storm',
               intro:"The Samurai rose before dawn. They've been ready for hours.",
               label:"Samurai's turn — Draw the Katana ⛩",
               winMsgs:["🏆 SAMURAI WINS! The blade was drawn so fast opponents only heard a faint breeze. ⛩",
                        "🏆 THE SAMURAI ARRIVED 3 HOURS EARLY, MEDITATED, AND THEN WON. Prepared. ⛩",
                        "🏆 HONOR CLAIMED! The Samurai is already composing a haiku about this. 5-7-5. ⚔"],
               primary:'#FF4444',
               vars:{ '--egypt-gold':'#FF4444','--egypt-sand':'#FF9999',
                      '--egypt-dark':'#1A0000','--egypt-brown':'#5A1A1A','--egypt-teal':'#CC0000',
                      '--p1-rgb':'255,68,68' } },
      hindu: { symbol:'🥷', name:'Ninja', title:'Shadow Art',
               lore:'Masters of shadow and silence, where darkness is home',
               intro:"The Ninja was already here. You just couldn't see them.",
               label:"Ninja's turn — Strike from Shadow 🥷",
               winMsgs:["🏆 NINJA WINS! You never saw it coming. Nobody did. That was entirely the point. 🥷",
                        "🏆 THE NINJA WAS HERE THE WHOLE TIME. Just watching. Waiting. Still watching. 🥷",
                        "🏆 UNSEEN! UNSTOPPABLE! The Ninja disappeared before you finished reading this sentenc\u2014 🌙"],
               primary:'#BBBBBB',
               vars:{ '--hindu-orange':'#999999','--hindu-saffron':'#BBBBBB',
                      '--hindu-purple':'#0A0A0A','--hindu-rose':'#888888',
                      '--p2-rgb':'187,187,187' } },
    },
  },
};
let currentTheme    = THEMES['egypt-hindu'];
let currentThemeKey = 'egypt-hindu';

/* ── Chaos rules catalogue ── */
const CHAOS_RULES = [
  { id: 'wild-turn',   icon: '🎲', name: 'Wild Turn',
    desc: 'Once per round a placed piece teleports to a random square!' },
  { id: 'swap-souls',  icon: '🔄', name: 'Swap Souls',
    desc: 'Two pieces suddenly swap allegiances mid-battle!' },
  { id: 'ghost-move',  icon: '👻', name: 'Ghost Move',
    desc: 'One piece becomes spectral — visible but barely real!' },
  { id: 'smite',       icon: '⚡', name: 'Smite',
    desc: 'A divine bolt obliterates one enemy piece without warning!' },
  { id: 'blessing',    icon: '✨', name: 'Blessing of Twofold',
    desc: 'One lucky player claims two squares in a single blessed turn!' },
  { id: 'cursed-skip', icon: '💀', name: 'Cursed Skip',
    desc: "One player's next turn will be mysteriously, divinely skipped!" },
  { id: 'mirror',      icon: '🪞', name: 'Mirror Realm',
    desc: 'The board is horizontally reflected into a mirror dimension!' },
  { id: 'chaos-storm', icon: '🌪', name: 'Chaos Storm',
    desc: 'The board trembles violently after every single move!' },
  { id: 'solar-flare', icon: '🌟', name: 'Solar Flare',
    desc: 'A blinding divine flash strikes at the worst possible moment!' },
  { id: 'divine-lag',  icon: '⏳', name: 'Divine Lag',
    desc: 'Time itself warps, freezing all input for 3 celestial seconds!' },
  { id: 'holy-ground', icon: '⛪', name: 'Holy Ground',
    desc: 'One sacred cell is divinely forbidden — none may claim it!' },
  { id: 'phantom-veil',icon: '👁', name: 'Phantom Veil',
    desc: 'After each move, all pieces vanish from sight for 1.5 eerie seconds!' },
  { id: 'treachery',   icon: '🗡', name: 'Treachery',
    desc: 'Once per round a freshly placed piece may betray its master and switch sides!' },
];

/* ── Quips — 15 % chance to flash after a move ── */
const QUIPS = {
  'egypt-hindu': {
    egypt: ['Ra approves of this move.', 'The pyramid nods.', 'Hieroglyphs intensify.', 'Nile-certified placement.'],
    hindu: ['Om resonates.', 'Karma aligns.', 'The lotus blooms accordingly.', 'Cosmic order maintained.'],
  },
  'classic': {
    egypt: ['Cold and calculated.', 'Geometrically sound.', 'Right angles only.', 'No comment. Just X.'],
    hindu: ['Circular logic. Winning.', 'Round and round we go.', 'Nought to worry about.', 'Perfect, as circles are.'],
  },
  'greek-norse': {
    egypt: ['The oracle nods.', 'Zeus approves.', 'Olympus is watching.', 'Lightning well spent.'],
    hindu: ["Odin takes notes.", 'The ravens observe silently.', 'Valhalla is watching.', 'Yggdrasil trembles slightly.'],
  },
  'dragon-phoenix': {
    egypt: ['The Dragon roars approval.', 'Ancient. Inevitable. Crimson.', 'Nine heavens bear witness.', 'Rain follows the Dragon.'],
    hindu: ['Elegance personified.', 'The Fenghuang is pleased.', 'Worthy. Barely.', 'Fire and grace, intertwined.'],
  },
  'samurai-ninja': {
    egypt: ['Swift as wind.', 'Honor maintained.', 'The blade approves.', 'Bushido is satisfied.'],
    hindu: ['Unseen. Inevitable.', 'Shadow strikes true.', 'None saw it coming.', 'Silence is the technique.'],
  },
  'random': {
    egypt: ['Procedurally perfect.', 'The algorithm smiles.', 'RNG was clearly biased.', 'Generated and approved.'],
    hindu: ['Randomness has a plan.', 'Chaos theory confirms this.', 'The void chose wisely.', 'Stochastic excellence.'],
  },
};

/* ── Draw messages — themed per round ── */
const DRAW_MESSAGES = {
  'egypt-hindu':   "⚖️ The scales of Ma'at are perfectly balanced — a sacred draw",
  'classic':       '⚖️ Mathematical perfection — a theoretically inevitable draw',
  'greek-norse':   '⚖️ The Norns cut the thread in a tie — Olympus and Asgard remain equal',
  'dragon-phoenix': '⚖️ Dragon and Phoenix circle each other in eternal cosmic balance — the universe exhales',
  'samurai-ninja': '⚖️ Both warriors vanish into shadow — an impeccably honorable draw',
  'random':        '⚖️ The RNG has spoken, and it said: nobody wins',
};

/* ── Procedural random theme — symbol / name pairs ── */
const RAND_PAIRS = [
  { p1:{ sym:'☀', name:'Solar',    title:'Sun Eternal'    }, p2:{ sym:'🌙', name:'Lunar',    title:'Moon Eternal'   } },
  { p1:{ sym:'🔥', name:'Flame',    title:'Fire Dancer'    }, p2:{ sym:'💧', name:'Frost',    title:'Ice Sculptor'   } },
  { p1:{ sym:'⚔', name:'Steel',    title:'Iron Edge'      }, p2:{ sym:'🌿', name:'Nature',   title:'Living Root'    } },
  { p1:{ sym:'🦅', name:'Eagle',    title:'Sky Sovereign'  }, p2:{ sym:'🐺', name:'Wolf',     title:'Night Stalker'  } },
  { p1:{ sym:'✦', name:'Star',     title:'Celestial'      }, p2:{ sym:'🌀', name:'Void',     title:'Infinite Dark'  } },
  { p1:{ sym:'🌊', name:'Wave',     title:'Ocean Deep'     }, p2:{ sym:'⛰', name:'Mountain', title:'Eternal Stone'  } },
  { p1:{ sym:'🦁', name:'Lion',     title:'King of Kings'  }, p2:{ sym:'🐍', name:'Serpent',  title:'Coiled Wisdom'  } },
  { p1:{ sym:'💎', name:'Crystal',  title:'Eternal Facets' }, p2:{ sym:'🌑', name:'Obsidian', title:'Dark Mirror'    } },
];

/* ── Achievements ── */
const ACH_KEY = 'ehttt-ach';
const ACHIEVEMENTS = [
  { id: 'first-win',     icon: '⚔️',  name: 'First Blood',     desc: 'Win your first game' },
  { id: 'triple-threat', icon: '🔥',  name: 'On Fire',         desc: 'Win 3 games in a row' },
  { id: 'ai-slayer',     icon: '🤖',  name: 'Machine Breaker', desc: 'Defeat the Hard AI' },
  { id: 'chaos-winner',  icon: '⚡',  name: 'Lord of Chaos',   desc: 'Win with Chaos mode on' },
  { id: 'speed-win',     icon: '⏱',  name: 'Speed Demon',     desc: 'Win while Timed mode is on' },
  { id: 'match-master',  icon: '🏆',  name: 'Match Master',    desc: 'Win a Best of 5 or 7 match' },
  { id: 'cosmic-winner', icon: '✨',  name: 'Cosmic Champion', desc: 'Win with Cosmic mode on' },
  { id: 'all-themes',    icon: '🌍',  name: 'Pilgrim of Ages',   desc: 'Play all 5 named themes' },
  { id: 'first-draw',   icon: '⚖️', name: 'Equilibrium',       desc: 'Play to a draw' },
  { id: 'speed-round',  icon: '💨',  name: 'Lightning Strike',  desc: 'Win in the minimum 5 moves' },
  { id: 'night-owl',    icon: '🌙',  name: 'Night Owl',         desc: 'Play between 22:00 and 04:00' },
  { id: 'undisputed',   icon: '👑',  name: 'Undisputed',        desc: 'Win a Best of 3 without dropping a round' },
  { id: 'dragon-lord',  icon: '🐉',  name: 'Dragon Lord',       desc: 'Win a game with the Dragon vs Phoenix theme' },
  { id: 'penta-streak', icon: '🔥',  name: 'Unstoppable',       desc: 'Win 5 games in a row' },
  { id: 'pure-intuition',icon:'🎯',  name: 'Pure Intuition',    desc: 'Win a game without ever using the Hint button' },
  { id: 'chaos-champ',  icon: '🌪',  name: 'Chaos Champion',    desc: 'Win a round with all 3 chaos rules active' },
  { id: 'comeback',     icon: '🔄',  name: 'Comeback King',     desc: 'Win a match after trailing 0 wins to your opponent\'s 2+' },
  { id: 'perfect-game',icon: '⭐',  name: 'Perfect Execution', desc: 'Win a game making only optimal moves' },
];

/* ── All-time stats localStorage key ── */
const STATS_KEY = 'ehttt-stats';
