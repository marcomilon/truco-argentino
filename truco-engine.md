# Argentine Truco Engine — Implementation Plan

## Context

The existing `src/main.js` mixes UI (DOM) and simplified game logic in one file, with several rules omissions: 15-point match cap (should be 30), no Retruco/Vale Cuatro, no Real Envido/Falta Envido, no parda handling, no mano rotation. The goal is a headless, zero-DOM, pure-logic engine under `engine/` that correctly implements full Argentine Truco rules, wired to the existing UI.

**Language rule**: All source code (variable names, function names, comments, string values) must be in English. Exception: untranslatable game-specific Spanish terms that are the actual names of game concepts — `envido`, `truco`, `retruco`, `vale cuatro`, `mano`, `parda`, `flor`, `mazo`, `quiero`, `falta envido`, `real envido` — may remain in Spanish as they are proper nouns of the game.

---

## File Structure

```
engine/
  deck.js       — Card definitions, power table, deck construction, shuffle
  envido.js     — Envido score calculation, betting chain, falta-envido
  truco.js      — Truco betting state machine (call/respond/raise)
  tricks.js     — Trick resolution: winner, parda detection, hand winner
  hand.js       — Single-hand lifecycle, phases, all action functions
  bot.js        — Bot AI: card choice, calls, responses
  game.js       — Match-level state: scores, mano rotation, hand wiring
  index.js      — Public API re-exports (only file the UI imports)
```

---

## Key Data Structures

### Card (immutable after creation)
```js
{ id: '7-espada', rank: 7, suit: 'espada', power: 12, envido: 7 }
```

### EnvidoBettingState
```js
{
  calls: [],            // [{ caller: 'player'|'bot', call: 'envido'|'real-envido'|'falta-envido' }]
  status: 'idle',       // 'idle' | 'pending' | 'accepted' | 'declined' | 'resolved'
  pendingCaller: null,  // 'player' | 'bot'
  quieroPts: 0,
  noQuieroPts: 0,
}
```

### TrucoBettingState
```js
{
  calls: [],            // [{ caller: 'player'|'bot', call: 'truco'|'retruco'|'vale-cuatro' }]
  status: 'idle',       // 'idle' | 'pending' | 'accepted' | 'declined'
  pendingCaller: null,
  quieroPts: 0,         // Stake if current accepted level holds
  noQuieroPts: 0,
  raisedBy: null,       // 'player' | 'bot' — who last accepted (they can raise next)
}
```

### Trick
```js
{ round: 1, playerCard: Card, botCard: Card, winner: 'player'|'bot'|'parda', leadSide: 'player' }
```

### HandState
```js
{
  playerHand: [],        botHand: [],
  playerAllCards: [],    botAllCards: [],  // all 3 original cards for envido calc
  tricks: [],            currentTrick: 1,
  manoSide: 'player',
  envidoBetting: EnvidoBettingState,
  trucoBetting: TrucoBettingState,
  envidoAvailable: true, // false after trick 1 ends or truco accepted
  phase: 'playing',      // 'playing'|'envido-pending'|'truco-pending'|'showdown'|'hand-over'
  pendingResponder: null, pendingCallType: null,
  winner: null,
  pointsDelta: { player: 0, bot: 0 },
  florEnabled: false,    florClaimed: null,
  matchScores: { player: 0, bot: 0 },  // snapshot at hand creation for falta-envido
}
```

### GameState
```js
{
  playerScore: 0,   botScore: 0,       // 0–30
  manoSide: 'player',
  handNumber: 0,
  currentHand: null,                   // HandState | null
  matchWinner: null,                   // 'player' | 'bot' | null
  options: { florEnabled: false },
  playerInBuenas: false,               // playerScore >= 15
  botInBuenas: false,
}
```

---

## Public API (`engine/index.js`)

```js
// Match lifecycle (game.js)
createGame(options)           // → GameState
dealHand(gameState)           // → GameState with fresh currentHand
applyHandResult(gameState)    // → GameState with updated scores + mano rotated
checkMatchWinner(gameState)   // → 'player' | 'bot' | null
resetMatch(gameState)         // → GameState with zeroed scores

// Hand actions (hand.js) — each takes HandState, returns new HandState
playerPlayCard(hand, cardId)
playerCallEnvido(hand, call)  // call: 'envido'|'real-envido'|'falta-envido'
playerCallTruco(hand, call)   // call: 'truco'|'retruco'|'vale-cuatro'
playerRespond(hand, response) // response: 'quiero'|'no-quiero'
playerFold(hand)
advanceBotTurn(hand)          // runs bot decision loop; UI calls after every player action

// Utilities (re-exported for UI display)
calcEnvido(cards)             // → number (envido score)
hasFlor(cards)                // → boolean
SUITS, RANKS                  // constants
```

---

## Phase Transitions

```
createHand → 'playing'
'playing':
  player/bot calls envido → 'envido-pending'
    quiero → 'showdown' → pointsDelta → 'playing'
    no-quiero → pointsDelta added → 'playing'
  player/bot calls truco → 'truco-pending'
    quiero → trucoBetting.status=accepted → 'playing'
    no-quiero → 'hand-over' (noQuieroPts to caller)
  all tricks resolved → 'hand-over'
  fold → 'hand-over'
```

`envidoAvailable` becomes `false` when: `tricks.length >= 1` (any trick completed), truco accepted, envido resolved, or flor claimed.

---

## Key Algorithms

### Envido Score (`envido.js`)
1. Group cards by suit.
2. For each group with ≥ 2 cards: top-two envido values + 20.
3. If any group scored: return `max(scores)`.
4. Else: return `max(card.envido for all cards)` (best single card).

### Envido Bet Chain Points (`envido.js — appendEnvidoCall`)
| Call | quieroPts | noQuieroPts |
|---|---|---|
| `envido` (first) | 2 | 1 |
| `envido` (second, stacked) | prev.quiero + 2 | prev.quiero |
| `real-envido` (standalone) | 3 | 1 |
| `real-envido` (after envido) | prev.quiero + 3 | prev.quiero |
| `falta-envido` (any chain) | `faltaEnvidoPoints(...)` | prev.quiero |

### Truco Bet Chain Points (`truco.js`)
| Call | quieroPts | noQuieroPts |
|---|---|---|
| `truco` | 2 | 1 |
| `retruco` | 4 | 2 |
| `vale-cuatro` | 6 | 4 |
| (none called) | 1 | 1 |

### Trick Winner / Parda (`tricks.js — resolveHand`)
After tricks 1+2: same winner both → winner. Trick 1 parda + trick 2 decided → trick 2 winner. Trick 1 decided + trick 2 parda → trick 1 winner. Both parda → go to trick 3.  
After 3 tricks: count wins; if tied (including all-parda) → `manoSide` wins.

### Fold Point Award (`hand.js — playerFold`)
```
if trucoBetting.status === 'idle': points = 1
else: points = trucoBetting.noQuieroPts
winner = opponent of folder
```

### Falta Envido Points (`envido.js`)
```
faltaEnvidoPoints(winnerScore) = max(30 - winnerScore, 1)
```

---

## Bot AI (`bot.js`)

**Card play** (`botChooseCard`):
- Trick 1: play weakest card unless bot holds a power ≥ 12 card (play it to lock a win).
- Trick 2: play minimum card that beats player's trick-2 card (if bot needs the trick); else play weakest.
- Trick 3: play highest remaining card.

**Envido calls** (`botDecideEnvido`):
- score ≥ 25 → call `envido`; score ≥ 28 after acceptance → stack second envido.
- score ≥ 30 → call `falta-envido` directly; score ≥ 23 → `real-envido`.
- bluff: 40% chance to call `envido` at 22–24.

**Truco calls** (`botDecideTruco`):
- Sum of card powers ≥ 20 → call `truco`; ≥ 24 → raise to `retruco` if already accepted; best card ≥ 12 held → raise to `vale-cuatro`.

**Responses** (`botRespondToCall`):
- Envido quiero if score ≥ 22; truco quiero if strength ≥ 18 (30% bluff at 14–18).

---

## Critical Files

| File | Notes |
|---|---|
| `engine/hand.js` | Central state machine; all action functions; most complex |
| `engine/tricks.js` | Parda edge-case table — most rules-sensitive algorithm |
| `engine/envido.js` | Cumulative chain points + falta-envido math |
| `engine/bot.js` | Integrates all modules for decisions |
| `engine/index.js` | Glue point for the existing `src/main.js` UI |

---

## Edge Cases to Handle

1. Envido stacking: second `envido` call on top of first → quiero=4, noQuiero=2.
2. `envidoAvailable` uses `tricks.length`, not `currentTrick` counter.
3. Truco raise is restricted to `raisedBy` side (the last accepting side).
4. `playerAllCards` (not `playerHand`) is used for envido — includes already-played cards.
5. Bot cannot call truco while `envidoBetting.status === 'pending'`.
6. Falta-envido at score=15 → 15 pts awarded (boundary of "buenas").
7. All-parda hand → mano side wins (not the player, not "player" as default).
8. Match winner is checked after `applyHandResult`; `dealHand` refuses to run if `matchWinner` is set.

---

## Verification

1. Run `node -e "import('./engine/index.js').then(e => console.log(Object.keys(e)))"` — all exports present.
2. Simulate a complete hand via Node REPL: `createGame` → `dealHand` → play 3 cards → `applyHandResult` → check scores updated.
3. Test envido chain: call envido, call envido again, verify quieroPts=4, noQuieroPts=2.
4. Test parda: construct a hand where all three tricks tie and verify manoSide wins.
5. Test truco raise guard: verify bot cannot retruco after player called truco (only after accepting).
6. Test falta-envido points at scores 0, 15, 29 — should return 30, 15, 1.
7. Test match target: verify `checkMatchWinner` returns null at 29pts and non-null at 30pts.
