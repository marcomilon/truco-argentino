import {
  createGame,
  dealHand,
  applyHandResult,
  checkMatchWinner,
  resetMatch,
  playerPlayCard,
  playerCallEnvido,
  playerCallTruco,
  playerRespond,
  playerFold,
  advanceBotTurn,
} from '../engine/index.js';

// ── Constants ────────────────────────────────────────────────
const SUIT_FOLDER = { espada: 'espadas', basto: 'bastos', oro: 'oros', copa: 'copas' };
const TRUCO_SEQ   = ['truco', 'retruco', 'vale-cuatro'];

// ── State ────────────────────────────────────────────────────
let game = createGame();

// ── Helpers ──────────────────────────────────────────────────
const el = (id) => document.getElementById(id);

function cardPath(card) {
  return `assets/cards/${String(card.rank).padStart(2, '0')}-${SUIT_FOLDER[card.suit]}.png`;
}

function makeCard(src, alt) {
  const img = document.createElement('img');
  img.className = 'card';
  img.src = src;
  img.alt = alt;
  return img;
}

function canPlayerCallTruco(hand) {
  if (!hand || hand.phase !== 'playing' || hand.pendingResponder) return false;
  const b = hand.trucoBetting;
  if (b.status === 'pending' || b.status === 'declined') return false;
  if (b.status === 'idle') return true;
  if (b.status === 'accepted') {
    const last  = b.calls[b.calls.length - 1]?.call;
    const next  = TRUCO_SEQ.indexOf(last) + 1;
    return next < TRUCO_SEQ.length && b.raisedBy === 'player';
  }
  return false;
}

function nextTrucoCall(hand) {
  const b = hand.trucoBetting;
  if (!b.calls.length) return 'truco';
  const last = b.calls[b.calls.length - 1]?.call;
  return TRUCO_SEQ[TRUCO_SEQ.indexOf(last) + 1] ?? null;
}

// ── Message builder ──────────────────────────────────────────
function buildMessage(hand) {
  if (!hand) {
    if (game.matchWinner) {
      return game.matchWinner === 'player'
        ? 'Ganaste el partido — presioná Jugar de nuevo.'
        : 'El bot ganó el partido — presioná Jugar de nuevo.';
    }
    return 'Presioná Repartir para empezar.';
  }

  if (hand.phase === 'hand-over') {
    const { winner, pointsDelta } = hand;
    const pts = pointsDelta[winner];
    const side = winner === 'player' ? 'Ganás la mano' : 'El bot gana la mano';
    return `${side} (+${pts} pt${pts !== 1 ? 's' : ''}). Presioná Siguiente mano.`;
  }

  if (hand.pendingResponder === 'player') {
    const type  = hand.pendingCallType;
    const state = type === 'envido' ? hand.envidoBetting : hand.trucoBetting;
    const call  = state.calls[state.calls.length - 1]?.call ?? type;
    return `El bot canta ${call} — ${state.quieroPts} pts si quiero, ${state.noQuieroPts} si no quiero.`;
  }

  const e = hand.lastEvent;
  if (!e) return 'Jugá una carta, o cantá envido / truco.';

  switch (e.type) {
    case 'trick':
      if (e.winner === 'parda') return 'Parda — jugá la siguiente carta.';
      return e.winner === 'player' ? `Ganás la vuelta ${e.round}.` : `El bot gana la vuelta ${e.round}.`;
    case 'envido-showdown':
      return `Envido: vos ${e.playerScore} — bot ${e.botScore}. ${e.winner === 'player' ? 'Ganás' : 'El bot gana'} ${e.pts} pt${e.pts !== 1 ? 's' : ''}.`;
    case 'envido-declined':
      return `No quisiste. El bot gana ${e.pts} pt${e.pts !== 1 ? 's' : ''}.`;
    case 'envido-declined-by-bot':
      return `El bot no quiso. Ganás ${e.pts} pt${e.pts !== 1 ? 's' : ''}.`;
    case 'truco-accepted':
      return `Quiero — esta mano vale ${e.stake} pts.`;
    case 'truco-declined':
      return `No quiero — ${e.pts} pt${e.pts !== 1 ? 's' : ''} otorgados.`;
    case 'fold':
      return `Te fuiste. El bot gana ${e.pts} pt${e.pts !== 1 ? 's' : ''}.`;
    case 'flor':
      return e.winner === 'player' ? '¡Flor! — ganás 3 pts.' : 'El bot tiene flor — 3 pts para el bot.';
    default:
      return 'Jugá una carta, o cantá envido / truco.';
  }
}

// ── Render ───────────────────────────────────────────────────
function render() {
  const hand = game.currentHand;

  renderScoreboard(hand);
  renderBotHand(hand);
  renderArena(hand);
  renderPlayerHand(hand);
  renderControls(hand);
}

function renderScoreboard(hand) {
  el('player-score').textContent = game.playerScore;
  el('bot-score').textContent    = game.botScore;
  el('mano-label').textContent   = hand
    ? (hand.manoSide === 'player' ? '★ sos mano' : '★ el bot es mano')
    : '';
}

function renderBotHand(hand) {
  const row = el('bot-hand');
  row.innerHTML = '';
  const count = hand ? hand.botHand.length : 3;
  for (let i = 0; i < count; i++) {
    row.appendChild(makeCard('assets/cards/reverso.png', 'bot card'));
  }
}

function renderArena(hand) {
  const botSpot    = el('bot-played');
  const playerSpot = el('player-played');
  const dotsEl     = el('trick-dots');

  botSpot.innerHTML    = '';
  playerSpot.innerHTML = '';
  dotsEl.innerHTML     = '';

  botSpot.classList.toggle('play-spot--empty',    !hand || hand.tricks.length === 0);
  playerSpot.classList.toggle('play-spot--empty', !hand || hand.tricks.length === 0);

  if (!hand || hand.tricks.length === 0) return;

  const last = hand.tricks[hand.tricks.length - 1];

  const botImg = makeCard(cardPath(last.botCard), last.botCard.id);
  if (last.winner === 'bot')   botImg.classList.add('card--win');
  if (last.winner === 'player') botImg.classList.add('card--lose');
  if (last.winner === 'parda') botImg.classList.add('card--parda');
  botSpot.appendChild(botImg);

  const playerImg = makeCard(cardPath(last.playerCard), last.playerCard.id);
  if (last.winner === 'player') playerImg.classList.add('card--win');
  if (last.winner === 'bot')   playerImg.classList.add('card--lose');
  if (last.winner === 'parda') playerImg.classList.add('card--parda');
  playerSpot.appendChild(playerImg);

  for (const trick of hand.tricks) {
    const dot = document.createElement('span');
    const cls = trick.winner === 'player' ? 'dot--you'
              : trick.winner === 'bot'    ? 'dot--bot'
              : 'dot--parda';
    dot.className = `dot ${cls}`;
    dotsEl.appendChild(dot);
  }
}

function renderPlayerHand(hand) {
  const row = el('player-hand');
  row.innerHTML = '';
  if (!hand) return;

  const canPlay = hand.phase === 'playing' && !hand.pendingResponder;

  for (const card of hand.playerHand) {
    const img = makeCard(cardPath(card), card.id);
    if (canPlay) {
      img.classList.add('card--playable');
      img.dataset.cardId = card.id;
      img.addEventListener('click', onPlayCard);
    }
    row.appendChild(img);
  }
}

function renderControls(hand) {
  const handOver     = hand?.phase === 'hand-over';
  const noHand       = !hand;
  const canAct       = hand?.phase === 'playing' && !hand?.pendingResponder;
  const needsRespond = hand?.pendingResponder === 'player';

  // Deal / Next Hand / Play Again
  setVisible('btn-deal', noHand || handOver);
  el('btn-deal').textContent = game.matchWinner ? 'Jugar de nuevo'
    : handOver ? 'Siguiente mano' : 'Repartir';

  // Action buttons
  setVisible('btn-envido', canAct && !!hand.envidoAvailable);
  setVisible('btn-truco',  canAct && canPlayerCallTruco(hand));
  if (canAct && canPlayerCallTruco(hand)) {
    el('btn-truco').textContent = nextTrucoCall(hand) ?? 'Truco';
  }
  setVisible('btn-fold', canAct);

  // Response buttons
  setVisible('btn-quiero',   needsRespond);
  setVisible('btn-noquiero', needsRespond);

  el('message').textContent = buildMessage(hand);
}

function setVisible(id, visible) {
  el(id).classList.toggle('hidden', !visible);
}

// ── Actions ──────────────────────────────────────────────────
function advance() {
  const h = game.currentHand;
  if (!h || h.phase === 'hand-over') return;
  game = { ...game, currentHand: advanceBotTurn(h) };
}

function onDeal() {
  if (game.matchWinner) game = resetMatch(game);
  if (game.currentHand?.phase === 'hand-over') {
    game = applyHandResult(game);
    if (checkMatchWinner(game)) { render(); return; }
  }
  game = dealHand(game);
  advance();
  render();
}

function onPlayCard(e) {
  const id = e.currentTarget.dataset.cardId;
  game = { ...game, currentHand: playerPlayCard(game.currentHand, id) };
  advance();
  render();
}

function onEnvido() {
  game = { ...game, currentHand: playerCallEnvido(game.currentHand, 'envido') };
  advance();
  render();
}

function onTruco() {
  const call = nextTrucoCall(game.currentHand);
  if (!call) return;
  game = { ...game, currentHand: playerCallTruco(game.currentHand, call) };
  advance();
  render();
}

function onFold() {
  game = { ...game, currentHand: playerFold(game.currentHand) };
  render();
}

function onQuiero() {
  game = { ...game, currentHand: playerRespond(game.currentHand, 'quiero') };
  advance();
  render();
}

function onNoQuiero() {
  game = { ...game, currentHand: playerRespond(game.currentHand, 'no-quiero') };
  advance();
  render();
}

// ── Wire up ──────────────────────────────────────────────────
el('btn-deal').addEventListener('click',     onDeal);
el('btn-envido').addEventListener('click',   onEnvido);
el('btn-truco').addEventListener('click',    onTruco);
el('btn-fold').addEventListener('click',     onFold);
el('btn-quiero').addEventListener('click',   onQuiero);
el('btn-noquiero').addEventListener('click', onNoQuiero);

render();
