import { calcEnvido } from './envido.js';
import { canCallTruco, nextTrucoCall } from './truco.js';

function handStrength(cards) {
  return cards.reduce((sum, c) => sum + c.power, 0);
}

export function botChooseCard(botHand, tricks) {
  const round = tricks.length + 1;

  if (round === 1) {
    const sorted = [...botHand].sort((a, b) => a.power - b.power);
    // Play a guaranteed winner immediately if available, otherwise discard weakest
    const winner = sorted.find((c) => c.power >= 12);
    return winner ?? sorted[0];
  }

  if (round === 2) {
    const playerCard = tricks[0]?.playerCard;
    // If bot needs to win this trick (bot lost or drew trick 1), play minimum winning card
    const botNeedsWin = tricks[0]?.winner !== 'bot';
    if (botNeedsWin && playerCard) {
      const sorted = [...botHand].sort((a, b) => a.power - b.power);
      const winning = sorted.find((c) => c.power > playerCard.power);
      return winning ?? sorted[0]; // if can't win, discard weakest
    }
    // Already winning — discard weakest
    return [...botHand].sort((a, b) => a.power - b.power)[0];
  }

  // Round 3: play highest remaining card
  return [...botHand].sort((a, b) => b.power - a.power)[0];
}

export function botDecideEnvido(botAllCards, envidoBetting, tricks) {
  if (envidoBetting.status !== 'idle') return null;
  if (tricks.length >= 1) return null; // envido window closed

  const score = calcEnvido(botAllCards);

  if (score >= 30) return 'falta-envido';
  if (score >= 25) return 'envido';
  if (score >= 23) return 'real-envido';
  if (score >= 22 && Math.random() < 0.40) return 'envido'; // bluff
  return null;
}

export function botDecideEnvidoRaise(botAllCards, envidoBetting) {
  if (envidoBetting.status !== 'accepted') return null;
  const score = calcEnvido(botAllCards);
  const lastCall = envidoBetting.calls[envidoBetting.calls.length - 1]?.call;
  if (lastCall === 'envido' && score >= 28) return 'envido';
  return null;
}

export function botDecideTruco(botHand, trucoBetting, envidoBetting) {
  if (envidoBetting && envidoBetting.status === 'pending') return null;
  if (!canCallTruco(trucoBetting, 'bot')) return null;

  const strength = handStrength(botHand);
  const call = nextTrucoCall(trucoBetting);

  if (call === 'truco' && strength >= 20) return 'truco';
  if (call === 'retruco' && strength >= 24) return 'retruco';
  if (call === 'vale-cuatro' && botHand.some((c) => c.power >= 12)) return 'vale-cuatro';
  return null;
}

export function botRespondToEnvido(botAllCards, envidoBetting) {
  const score = calcEnvido(botAllCards);
  if (score >= 22) return 'quiero';
  if (envidoBetting.noQuieroPts <= 1) return 'no-quiero';
  return score >= 18 ? 'quiero' : 'no-quiero';
}

export function botRespondToTruco(botHand) {
  const strength = handStrength(botHand);
  if (strength >= 18) return 'quiero';
  if (strength >= 14 && Math.random() < 0.30) return 'quiero'; // bluff
  return 'no-quiero';
}
