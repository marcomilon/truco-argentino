import { calcEnvido, hasFlor, makeEnvidoBetting, appendEnvidoCall, respondEnvido } from './envido.js';
import { makeTrucoBetting, canCallTruco, appendTrucoCall, respondTruco } from './truco.js';
import { resolveTrick, resolveHand } from './tricks.js';
import {
  botChooseCard,
  botDecideEnvido,
  botDecideEnvidoRaise,
  botDecideTruco,
  botRespondToEnvido,
  botRespondToTruco,
} from './bot.js';

export function createHand(playerCards, botCards, manoSide, matchScores, options = {}) {
  const initial = {
    playerHand: [...playerCards],
    botHand: [...botCards],
    playerAllCards: [...playerCards],
    botAllCards: [...botCards],
    tricks: [],
    currentTrick: 1,
    manoSide,
    envidoBetting: makeEnvidoBetting(),
    trucoBetting: makeTrucoBetting(),
    envidoAvailable: true,
    phase: 'playing',
    pendingResponder: null,
    pendingCallType: null,
    winner: null,
    pointsDelta: { player: 0, bot: 0 },
    florEnabled: options.florEnabled ?? false,
    florClaimed: null,
    matchScores: { ...matchScores },
    lastEvent: null,
  };
  return checkFlor(initial);
}

function cloneHand(hand) {
  return {
    ...hand,
    playerHand: [...hand.playerHand],
    botHand: [...hand.botHand],
    playerAllCards: [...hand.playerAllCards],
    botAllCards: [...hand.botAllCards],
    tricks: [...hand.tricks],
    envidoBetting: { ...hand.envidoBetting, calls: [...hand.envidoBetting.calls] },
    trucoBetting: { ...hand.trucoBetting, calls: [...hand.trucoBetting.calls] },
    pointsDelta: { ...hand.pointsDelta },
    matchScores: { ...hand.matchScores },
  };
}

function endHand(hand, winner, extraDelta = {}) {
  const h = cloneHand(hand);
  h.winner = winner;
  h.phase = 'hand-over';

  // Determine truco points for the winner
  const trucoPts = h.trucoBetting.status === 'accepted' || h.trucoBetting.status === 'idle'
    ? (h.trucoBetting.quieroPts || 1)
    : (h.trucoBetting.quieroPts || 1);

  h.pointsDelta[winner] = (h.pointsDelta[winner] || 0) + trucoPts;
  for (const [side, pts] of Object.entries(extraDelta)) {
    h.pointsDelta[side] = (h.pointsDelta[side] || 0) + pts;
  }

  h.envidoAvailable = false;
  return h;
}

function checkHandOver(hand) {
  const result = resolveHand(hand.tricks, hand.manoSide);
  if (result) return endHand(hand, result);
  if (hand.playerHand.length === 0 && hand.botHand.length === 0) {
    const winner = resolveHand(hand.tricks, hand.manoSide) ?? hand.manoSide;
    return endHand(hand, winner);
  }
  return hand;
}

// --- Flor ---

function checkFlor(hand) {
  if (!hand.florEnabled) return hand;
  const playerHasFlor = hasFlor(hand.playerAllCards);
  const botHasFlor = hasFlor(hand.botAllCards);
  if (!playerHasFlor && !botHasFlor) return hand;

  const h = cloneHand(hand);
  h.envidoAvailable = false;

  if (playerHasFlor && botHasFlor) {
    const playerScore = calcEnvido(hand.playerAllCards);
    const botScore = calcEnvido(hand.botAllCards);
    const florWinner = playerScore >= botScore ? 'player' : 'bot';
    h.pointsDelta[florWinner] += 3;
    h.florClaimed = florWinner;
    h.lastEvent = { type: 'flor', winner: florWinner, playerScore, botScore };
    return h;
  }

  const florHolder = playerHasFlor ? 'player' : 'bot';
  h.pointsDelta[florHolder] += 3;
  h.florClaimed = florHolder;
  h.lastEvent = { type: 'flor', winner: florHolder };
  return h;
}

// --- Play card ---

export function playerPlayCard(hand, cardId) {
  if (hand.phase !== 'playing') return hand;
  if (hand.pendingResponder !== null) return hand;

  const cardIndex = hand.playerHand.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) return hand;

  let h = cloneHand(hand);
  const [playerCard] = h.playerHand.splice(cardIndex, 1);

  const botCard = botChooseCard(h.botHand, h.tricks, h.manoSide);
  const botIndex = h.botHand.findIndex((c) => c.id === botCard.id);
  h.botHand.splice(botIndex, 1);

  const trickWinner = resolveTrick(playerCard, botCard);
  h.tricks = [
    ...h.tricks,
    {
      round: h.currentTrick,
      playerCard,
      botCard,
      winner: trickWinner,
      leadSide: h.manoSide,
    },
  ];

  h.currentTrick += 1;

  // Close envido window after first trick completes
  if (h.tricks.length >= 1) h.envidoAvailable = false;

  h.lastEvent = { type: 'trick', round: h.currentTrick - 1, winner: trickWinner, playerCard, botCard };

  return checkHandOver(h);
}

// --- Envido ---

export function playerCallEnvido(hand, call) {
  if (!hand.envidoAvailable) return hand;
  if (hand.phase !== 'playing') return hand;
  if (hand.pendingResponder !== null) return hand;
  if (hand.envidoBetting.status === 'resolved' || hand.envidoBetting.status === 'declined') return hand;
  if (hand.trucoBetting.status === 'accepted') return hand; // truco accepted blocks envido

  let h = cloneHand(hand);
  const winnerScore = hand.matchScores.player; // player is calling, they'd be the potential winner
  h.envidoBetting = appendEnvidoCall(h.envidoBetting, call, 'player', winnerScore);
  h.phase = 'envido-pending';
  h.pendingResponder = 'bot';
  h.pendingCallType = 'envido';
  h.lastEvent = { type: 'envido-call', caller: 'player', call };
  return h;
}

function botCallEnvido(hand, call) {
  let h = cloneHand(hand);
  const winnerScore = hand.matchScores.bot;
  h.envidoBetting = appendEnvidoCall(h.envidoBetting, call, 'bot', winnerScore);
  h.phase = 'envido-pending';
  h.pendingResponder = 'player';
  h.pendingCallType = 'envido';
  h.lastEvent = { type: 'envido-call', caller: 'bot', call };
  return h;
}

function resolveEnvidoShowdown(hand) {
  const h = cloneHand(hand);
  const playerScore = calcEnvido(h.playerAllCards);
  const botScore = calcEnvido(h.botAllCards);
  const winner = playerScore >= botScore ? 'player' : 'bot';
  h.pointsDelta[winner] += h.envidoBetting.quieroPts;
  h.envidoBetting = { ...h.envidoBetting, status: 'resolved' };
  h.envidoAvailable = false;
  h.phase = 'playing';
  h.pendingResponder = null;
  h.pendingCallType = null;
  h.lastEvent = { type: 'envido-showdown', winner, playerScore, botScore, pts: h.envidoBetting.quieroPts };
  return h;
}

// --- Truco ---

export function playerCallTruco(hand, call) {
  if (hand.phase !== 'playing') return hand;
  if (hand.pendingResponder !== null) return hand;
  if (!canCallTruco(hand.trucoBetting, 'player')) return hand;

  let h = cloneHand(hand);
  h.trucoBetting = appendTrucoCall(h.trucoBetting, call, 'player');
  h.phase = 'truco-pending';
  h.pendingResponder = 'bot';
  h.pendingCallType = 'truco';
  h.envidoAvailable = false;
  h.lastEvent = { type: 'truco-call', caller: 'player', call };
  return h;
}

function botCallTruco(hand, call) {
  let h = cloneHand(hand);
  h.trucoBetting = appendTrucoCall(h.trucoBetting, call, 'bot');
  h.phase = 'truco-pending';
  h.pendingResponder = 'player';
  h.pendingCallType = 'truco';
  h.envidoAvailable = false;
  h.lastEvent = { type: 'truco-call', caller: 'bot', call };
  return h;
}

// --- Player responds to bot call ---

export function playerRespond(hand, response) {
  if (hand.pendingResponder !== 'player') return hand;

  if (hand.pendingCallType === 'envido') {
    let h = cloneHand(hand);
    h.envidoBetting = respondEnvido(h.envidoBetting, response);
    h.pendingResponder = null;
    h.pendingCallType = null;
    h.phase = 'playing';

    if (response === 'quiero') {
      return resolveEnvidoShowdown(h);
    }
    // no-quiero: bot (caller) gets noQuieroPts
    h.pointsDelta.bot += h.envidoBetting.noQuieroPts;
    h.envidoAvailable = false;
    h.lastEvent = { type: 'envido-declined', pts: h.envidoBetting.noQuieroPts };
    return h;
  }

  if (hand.pendingCallType === 'truco') {
    let h = cloneHand(hand);
    h.trucoBetting = respondTruco(h.trucoBetting, response, 'player');
    h.pendingResponder = null;
    h.pendingCallType = null;

    if (response === 'quiero') {
      h.phase = 'playing';
      h.lastEvent = { type: 'truco-accepted', stake: h.trucoBetting.quieroPts };
      return h;
    }
    // no-quiero: bot (caller) gets noQuieroPts; hand ends
    h.pointsDelta.bot += h.trucoBetting.noQuieroPts;
    h.winner = 'bot';
    h.phase = 'hand-over';
    h.lastEvent = { type: 'truco-declined', pts: h.trucoBetting.noQuieroPts };
    return h;
  }

  return hand;
}

// --- Bot responds to player call ---

function botRespondToEnvidoCall(hand) {
  const response = botRespondToEnvido(hand.botAllCards, hand.envidoBetting);
  let h = cloneHand(hand);
  h.envidoBetting = respondEnvido(h.envidoBetting, response);
  h.pendingResponder = null;
  h.pendingCallType = null;
  h.phase = 'playing';

  if (response === 'quiero') {
    return resolveEnvidoShowdown(h);
  }
  // no-quiero: player (caller) gets noQuieroPts
  h.pointsDelta.player += h.envidoBetting.noQuieroPts;
  h.envidoAvailable = false;
  h.lastEvent = { type: 'envido-declined-by-bot', pts: h.envidoBetting.noQuieroPts };
  return h;
}

function botRespondToTrucoCall(hand) {
  const response = botRespondToTruco(hand.botHand);
  let h = cloneHand(hand);
  h.trucoBetting = respondTruco(h.trucoBetting, response, 'bot');
  h.pendingResponder = null;
  h.pendingCallType = null;

  if (response === 'quiero') {
    h.phase = 'playing';
    h.lastEvent = { type: 'truco-accepted', stake: h.trucoBetting.quieroPts };
    return h;
  }
  // no-quiero: player (caller) gets noQuieroPts; hand ends
  h.pointsDelta.player += h.trucoBetting.noQuieroPts;
  h.winner = 'player';
  h.phase = 'hand-over';
  h.lastEvent = { type: 'truco-declined', pts: h.trucoBetting.noQuieroPts };
  return h;
}

// --- Fold ---

export function playerFold(hand) {
  if (hand.phase !== 'playing') return hand;
  let h = cloneHand(hand);

  let pts;
  if (h.trucoBetting.status === 'idle' || h.trucoBetting.calls.length === 0) {
    pts = 1;
  } else {
    pts = h.trucoBetting.noQuieroPts;
  }

  h.pointsDelta.bot += pts;
  h.winner = 'bot';
  h.phase = 'hand-over';
  h.lastEvent = { type: 'fold', folder: 'player', pts };
  return h;
}

// --- Bot turn engine ---

export function advanceBotTurn(hand) {
  if (hand.phase === 'hand-over') return hand;

  // Bot must respond to player's call
  if (hand.pendingResponder === 'bot') {
    if (hand.pendingCallType === 'envido') {
      return botRespondToEnvidoCall(hand);
    }
    if (hand.pendingCallType === 'truco') {
      return botRespondToTrucoCall(hand);
    }
  }

  // Bot's proactive calls (only when it's between turns, i.e., playing phase, no pending)
  if (hand.phase === 'playing' && hand.pendingResponder === null) {
    // Try envido first
    if (hand.envidoAvailable && hand.envidoBetting.status === 'idle') {
      const envidoCall = botDecideEnvido(hand.botAllCards, hand.envidoBetting, hand.tricks);
      if (envidoCall) return botCallEnvido(hand, envidoCall);
    }

    // Try envido raise after player accepted bot's envido
    if (hand.envidoAvailable && hand.envidoBetting.status === 'accepted' && hand.envidoBetting.calls[hand.envidoBetting.calls.length - 1]?.caller === 'bot') {
      const raiseCall = botDecideEnvidoRaise(hand.botAllCards, hand.envidoBetting);
      if (raiseCall) return botCallEnvido(hand, raiseCall);
    }

    // Try truco raise (bot accepted player's truco and can now raise)
    if (hand.trucoBetting.status === 'accepted' && hand.trucoBetting.raisedBy === 'bot') {
      const raiseCall = botDecideTruco(hand.botHand, hand.trucoBetting, hand.envidoBetting);
      if (raiseCall) return botCallTruco(hand, raiseCall);
    }

    // Try calling truco for the first time
    if (hand.trucoBetting.status === 'idle') {
      const trucoCall = botDecideTruco(hand.botHand, hand.trucoBetting, hand.envidoBetting);
      if (trucoCall) return botCallTruco(hand, trucoCall);
    }
  }

  return hand;
}
