# Truco Engine

A headless, zero-DOM game engine for 2-player Argentine Truco (human vs bot). It has no dependencies and runs in any ES module environment (browser or Node).

---

## File overview

```
engine/
  index.js    — public API; the only file a UI imports
  game.js     — match lifecycle: scores, mano rotation, deal
  hand.js     — single-hand state machine and all player actions
  bot.js      — bot AI: card choice, betting calls, responses
  deck.js     — card definitions, power table, shuffle
  envido.js   — envido score calculation and betting chain
  truco.js    — truco betting state machine
  tricks.js   — trick comparison and parda resolution
```

---

## Core concepts

### Card

A card is a plain object created once by `buildDeck()` and never mutated:

```js
{ id: '7-espada', rank: 7, suit: 'espada', power: 12, envido: 7 }
```

`power` is the Truco ranking (1–14). `envido` is the Envido point value (0 for face cards, face value for numbered cards). Both are precomputed at deck-build time so comparisons are simple integer lookups.

### Power table

The 40-card Spanish deck has a non-obvious ranking. The table in `deck.js` resolves it with two-step key lookup — specific keys like `'1-espada'` first, generic keys like `'3'` second:

| Power | Card |
|---|---|
| 14 | Ace of Spades |
| 13 | Ace of Clubs |
| 12 | 7 of Spades |
| 11 | 7 of Diamonds |
| 10 | 3s |
| 9 | 2s |
| 8 | Aces (Cups/Diamonds) |
| 7–1 | Kings → 4s |

### Immutability

Every function that modifies state returns a **new object**. Nothing is mutated in place. `hand.js` uses an internal `cloneHand()` that deep-copies all arrays and sub-objects before making changes. This makes states safe to hold as snapshots and easy to test.

---

## Match lifecycle (`game.js`)

```
createGame(options)
    ↓
dealHand(gameState)        ← repeats each hand
    ↓
[hand plays out]
    ↓
applyHandResult(gameState) ← adds points, rotates mano
    ↓
checkMatchWinner(gameState) → 'player' | 'bot' | null
```

- Target score is **30 points**. The first 15 are *las malas*, the next 15 are *las buenas* (`playerInBuenas` / `botInBuenas` flags).
- `manoSide` flips between `'player'` and `'bot'` after every hand.
- `dealHand` is a no-op if `matchWinner` is already set.
- `resetMatch` zeroes scores and restarts from hand 1.

---

## Hand state machine (`hand.js`)

A hand lives in `gameState.currentHand` as a `HandState` object. The `phase` field drives what actions are valid:

```
'playing'        normal turn — player can play a card, call envido/truco, or fold
'envido-pending' an envido call was made; waiting for the other side to respond
'truco-pending'  a truco call was made; waiting for the other side to respond
'hand-over'      hand is finished; pointsDelta is final
```

Key fields:

| Field | Type | Meaning |
|---|---|---|
| `playerHand` | `Card[]` | Cards still in the player's hand |
| `botHand` | `Card[]` | Cards still in the bot's hand |
| `playerAllCards` | `Card[]` | All 3 original player cards (used for envido after cards are played) |
| `botAllCards` | `Card[]` | All 3 original bot cards |
| `tricks` | `Trick[]` | Completed tricks in order |
| `manoSide` | `'player'\|'bot'` | Who plays first (right of dealer) |
| `envidoBetting` | object | Envido betting chain state |
| `trucoBetting` | object | Truco betting chain state |
| `envidoAvailable` | boolean | False once any trick completes or truco is accepted |
| `pendingResponder` | `'player'\|'bot'\|null` | Who must respond to a pending call |
| `pendingCallType` | `'envido'\|'truco'\|null` | Which call is waiting |
| `winner` | `'player'\|'bot'\|null` | Set when phase becomes `'hand-over'` |
| `pointsDelta` | `{ player, bot }` | Points earned this hand (accumulates envido + truco) |
| `lastEvent` | object | Describes the most recent action (for UI messages) |

### Turn flow

The UI drives turns like this:

1. Call `dealHand(game)` to get a fresh hand.
2. Call `advanceBotTurn(hand)` — the bot may proactively call envido or truco before the first card is played.
3. If `hand.pendingResponder === 'player'`, show the response UI and call `playerRespond(hand, 'quiero'|'no-quiero')`.
4. Otherwise the player plays a card (`playerPlayCard`), calls envido/truco, or folds.
5. After every player action, call `advanceBotTurn(hand)` again. The bot will respond to the player's call, or make its own call before the next trick.
6. Repeat until `hand.phase === 'hand-over'`.
7. Call `applyHandResult(game)` to commit points and rotate mano.

### Flor

If `options.florEnabled` is true, `createHand` immediately calls `checkFlor`. If either player holds a flor (all 3 cards of the same suit), 3 points are added to `pointsDelta` and `envidoAvailable` is set to false. Both players having flor resolves by highest envido score.

---

## Envido (`envido.js`)

### Score calculation

`calcEnvido(cards)` groups cards by suit. If any suit has 2+ cards, the score is the sum of the two highest envido values plus 20. If no suit has a pair, the score is the single highest envido value. Examples:

- `[3♠, 2♠, 7♣]` → 3 + 2 + 20 = **25**
- `[3♠, 2♥, 7♣]` → **7** (best single card, all different suits)
- `[12♠, 11♥, 10♣]` → **0** (all figures)

### Betting chain

Envido calls stack. Each call to `appendEnvidoCall` recalculates `quieroPts` and `noQuieroPts` based on the previous stake:

| Call | quieroPts | noQuieroPts |
|---|---|---|
| `envido` (first) | 2 | 1 |
| `envido` (second, stacked) | prev + 2 | prev |
| `real-envido` (standalone) | 3 | 1 |
| `real-envido` (after envido) | prev + 3 | prev |
| `falta-envido` | 30 − winner's score | prev |

The `noQuieroPts` is always the previous `quieroPts` — the caller gets what was already on the table when the opponent says no.

### Showdown

When a call is accepted (`quiero`), `resolveEnvidoShowdown` computes both players' envido scores using `playerAllCards` (not just the remaining hand, so cards already played in trick 1 are included), and awards `quieroPts` to the higher scorer.

---

## Truco (`truco.js`)

### Betting chain

Three fixed levels:

| Call | quieroPts | noQuieroPts |
|---|---|---|
| `truco` | 2 | 1 |
| `retruco` | 4 | 2 |
| `vale-cuatro` | 6 | 4 |

No truco called at all → the hand winner gets **1 point** (the base value, set in `endHand`).

### Raise guard

`raisedBy` tracks who last accepted. Only that side can raise next. `canCallTruco(betting, callerSide)` enforces this — a player who called truco and had it accepted cannot immediately raise to retruco; only the bot (who accepted) can do that, and vice versa.

### Declining ends the hand

A `no-quiero` to any truco call immediately awards `noQuieroPts` to the caller and sets `phase = 'hand-over'`. The hand does not continue to trick play.

---

## Trick resolution (`tricks.js`)

### Comparison

`compareTrick(cardA, cardB)` compares `power` values. Equal power → **parda** (tie).

### Hand winner (`resolveHand`)

After 2 tricks:

| Trick 1 | Trick 2 | Result |
|---|---|---|
| parda | parda | null — play trick 3 |
| parda | A wins | A wins |
| A wins | parda | A wins |
| A wins | A wins | A wins |
| A wins | B wins | null — play trick 3 |

After 3 tricks:

- One player has 2+ wins → they win.
- All three parda (0-0) → **mano side wins**.
- 1-1 with one parda → **"primera" rule**: the winner of the first non-parda trick wins. This differs from always giving the hand to the mano side — it rewards whoever established the lead.

---

## Bot AI (`bot.js`)

All bot functions are stateless — they take data and return a decision string or null.

### Card play (`botChooseCard`)

- **Round 1**: Play a guaranteed winner (power ≥ 12) if available; otherwise discard the weakest card.
- **Round 2**: If bot needs a win, play the minimum card that beats the player's trick-1 card; if bot already leads, discard weakest.
- **Round 3**: Play the strongest remaining card.

### Envido calls (`botDecideEnvido`)

Only considered before any trick is played:

| Envido score | Action |
|---|---|
| ≥ 30 | `falta-envido` |
| ≥ 25 | `envido` |
| ≥ 23 | `real-envido` |
| 22–24 | `envido` with 40% probability (bluff) |
| < 22 | no call |

### Truco calls (`botDecideTruco`)

Based on total hand strength (sum of all card powers):

| Strength | Action |
|---|---|
| ≥ 20 | call `truco` |
| ≥ 24 (already accepted) | raise to `retruco` |
| has card with power ≥ 12 (already accepted) | raise to `vale-cuatro` |

### Responses

- **Envido**: accept if envido score ≥ 22. Below that, decline unless the cost of declining (noQuieroPts) is only 1 point and the score is between 18–22.
- **Truco**: accept if hand strength ≥ 18; 30% chance to bluff-accept at 14–17; decline below 14.

---

## Public API reference

```js
import {
  // Match
  createGame, dealHand, applyHandResult, checkMatchWinner, resetMatch,

  // Hand actions (each returns a new HandState)
  playerPlayCard,    // (hand, cardId) → HandState
  playerCallEnvido,  // (hand, call) → HandState   call: 'envido'|'real-envido'|'falta-envido'
  playerCallTruco,   // (hand, call) → HandState   call: 'truco'|'retruco'|'vale-cuatro'
  playerRespond,     // (hand, response) → HandState   response: 'quiero'|'no-quiero'
  playerFold,        // (hand) → HandState
  advanceBotTurn,    // (hand) → HandState   call after every player action

  // Utilities
  calcEnvido,        // (cards) → number
  hasFlor,           // (cards) → boolean
  SUITS, RANKS,
} from './engine/index.js';
```

### Minimal usage

```js
// Start a match
let game = createGame({ florEnabled: false });

// Deal and play a hand
game = dealHand(game);
let hand = game.currentHand;
hand = advanceBotTurn(hand); // bot may call something first

// Player plays a card
hand = playerPlayCard(hand, hand.playerHand[0].id);
hand = advanceBotTurn(hand); // bot responds / plays

// Player responds to a bot call
if (hand.pendingResponder === 'player') {
  hand = playerRespond(hand, 'quiero');
  hand = advanceBotTurn(hand);
}

// When the hand is over, commit the result
game.currentHand = hand;
game = applyHandResult(game);

// Check for a match winner
const winner = checkMatchWinner(game); // 'player' | 'bot' | null
```

### Reading `lastEvent`

Every action sets `hand.lastEvent` to describe what just happened, which the UI can use to build messages:

| type | fields |
|---|---|
| `'trick'` | `round`, `winner`, `playerCard`, `botCard` |
| `'envido-call'` | `caller`, `call` |
| `'envido-showdown'` | `winner`, `playerScore`, `botScore`, `pts` |
| `'envido-declined'` | `pts` (awarded to bot) |
| `'envido-declined-by-bot'` | `pts` (awarded to player) |
| `'truco-call'` | `caller`, `call` |
| `'truco-accepted'` | `stake` |
| `'truco-declined'` | `pts` |
| `'fold'` | `folder`, `pts` |
| `'flor'` | `winner`, `playerScore?`, `botScore?` |
