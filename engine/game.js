import { buildDeck, shuffle } from './deck.js';
import { createHand } from './hand.js';

export function createGame(options = {}) {
  return {
    playerScore: 0,
    botScore: 0,
    manoSide: 'player',
    handNumber: 0,
    currentHand: null,
    matchWinner: null,
    options: {
      florEnabled: options.florEnabled ?? false,
    },
    playerInBuenas: false,
    botInBuenas: false,
  };
}

export function dealHand(gameState) {
  if (gameState.matchWinner) return gameState;

  const deck = shuffle(buildDeck());
  const playerCards = deck.slice(0, 3);
  const botCards = deck.slice(3, 6);

  const hand = createHand(
    playerCards,
    botCards,
    gameState.manoSide,
    { player: gameState.playerScore, bot: gameState.botScore },
    gameState.options,
  );

  return {
    ...gameState,
    handNumber: gameState.handNumber + 1,
    currentHand: hand,
  };
}

export function applyHandResult(gameState) {
  const hand = gameState.currentHand;
  if (!hand || hand.phase !== 'hand-over') return gameState;

  const playerScore = Math.min(30, gameState.playerScore + (hand.pointsDelta.player || 0));
  const botScore = Math.min(30, gameState.botScore + (hand.pointsDelta.bot || 0));

  const matchWinner = playerScore >= 30 ? 'player' : botScore >= 30 ? 'bot' : null;

  return {
    ...gameState,
    playerScore,
    botScore,
    playerInBuenas: playerScore >= 15,
    botInBuenas: botScore >= 15,
    manoSide: gameState.manoSide === 'player' ? 'bot' : 'player',
    matchWinner,
    currentHand: null,
  };
}

export function checkMatchWinner(gameState) {
  return gameState.matchWinner;
}

export function resetMatch(gameState) {
  return {
    ...gameState,
    playerScore: 0,
    botScore: 0,
    manoSide: 'player',
    handNumber: 0,
    currentHand: null,
    matchWinner: null,
    playerInBuenas: false,
    botInBuenas: false,
  };
}
