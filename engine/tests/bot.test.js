import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  botChooseCard,
  botDecideEnvido,
  botDecideTruco,
  botRespondToEnvido,
  botRespondToTruco,
} from '../bot.js';
import { makeEnvidoBetting, appendEnvidoCall } from '../envido.js';
import { makeTrucoBetting, appendTrucoCall, respondTruco } from '../truco.js';

const mkCard = (id, power, envido = 0) => ({ id, power, envido, suit: 'espada', rank: 1 });

describe('botChooseCard — round 1', () => {
  it('plays a power-≥12 card to secure an early win', () => {
    const hand = [mkCard('a', 14), mkCard('b', 5), mkCard('c', 3)];
    const choice = botChooseCard(hand, []);
    assert.equal(choice.id, 'a');
  });

  it('discards the weakest card when no guaranteed winner exists', () => {
    const hand = [mkCard('a', 9), mkCard('b', 5), mkCard('c', 7)];
    const choice = botChooseCard(hand, []);
    assert.equal(choice.id, 'b'); // lowest power
  });
});

describe('botChooseCard — round 2', () => {
  const trick1 = (playerPower, botPower, winner) => ({
    playerCard: mkCard('pc', playerPower),
    botCard: mkCard('bc', botPower),
    winner,
  });

  it('plays minimum winning card when bot lost trick 1', () => {
    const tricks = [trick1(10, 5, 'player')];
    const hand = [mkCard('a', 8), mkCard('b', 11), mkCard('c', 6)];
    // player played power-10; bot needs > 10 to win; minimum winning is 11
    const choice = botChooseCard(hand, tricks);
    assert.equal(choice.id, 'b');
  });

  it('discards weakest when bot already won trick 1', () => {
    const tricks = [trick1(5, 12, 'bot')];
    const hand = [mkCard('a', 8), mkCard('b', 3), mkCard('c', 6)];
    const choice = botChooseCard(hand, tricks);
    assert.equal(choice.id, 'b'); // weakest, power 3
  });

  it('discards weakest when no card can beat the player', () => {
    const tricks = [trick1(14, 5, 'player')];
    const hand = [mkCard('a', 9), mkCard('b', 7), mkCard('c', 6)];
    // player played power-14 (ace of spades); no card can beat it
    const choice = botChooseCard(hand, tricks);
    assert.equal(choice.id, 'c'); // weakest
  });
});

describe('botChooseCard — round 3', () => {
  it('plays the strongest remaining card', () => {
    const tricks = [{ winner: 'player' }, { winner: 'bot' }];
    const hand = [mkCard('a', 6), mkCard('b', 13)];
    const choice = botChooseCard(hand, tricks);
    assert.equal(choice.id, 'b');
  });
});

describe('botDecideEnvido', () => {
  const mkCards = (envidoValues, suit = 'espada') =>
    envidoValues.map((v, i) => ({ id: `c${i}`, envido: v, suit, rank: v, power: v }));

  it('calls falta-envido with score ≥ 30', () => {
    // 7 + 7 + 20 = 34, but falta requires score >= 30 on the card
    // Build a hand where calcEnvido >= 30: two same-suit cards scoring >= 10 together
    const cards = mkCards([7, 6, 0]); // 7+6+20 = 33
    assert.equal(botDecideEnvido(cards, makeEnvidoBetting(), []), 'falta-envido');
  });

  it('calls envido with score 25–29', () => {
    const cards = mkCards([3, 2, 0]); // 3+2+20=25
    assert.equal(botDecideEnvido(cards, makeEnvidoBetting(), []), 'envido');
  });

  it('calls real-envido with score 23–24', () => {
    const cards = mkCards([3, 0, 0]); // 3+0+20=23
    assert.equal(botDecideEnvido(cards, makeEnvidoBetting(), []), 'real-envido');
  });

  it('returns null when score is below threshold', () => {
    const cards = [
      { id: 'a', envido: 5, suit: 'espada', rank: 5 },
      { id: 'b', envido: 3, suit: 'basto',  rank: 3 },
      { id: 'c', envido: 2, suit: 'copa',   rank: 2 },
    ];
    // All different suits, best single = 5; below any call threshold
    assert.equal(botDecideEnvido(cards, makeEnvidoBetting(), []), null);
  });

  it('returns null if envido window is closed (trick already played)', () => {
    const cards = mkCards([7, 6, 0]);
    assert.equal(botDecideEnvido(cards, makeEnvidoBetting(), [{ winner: 'player' }]), null);
  });

  it('returns null if betting is not idle', () => {
    const cards = mkCards([7, 6, 0]);
    const betting = appendEnvidoCall(makeEnvidoBetting(), 'envido', 'player', 0);
    assert.equal(botDecideEnvido(cards, betting, []), null);
  });
});

describe('botDecideTruco', () => {
  // Hand strength = sum of card powers
  const strongHand = [mkCard('a', 10), mkCard('b', 8), mkCard('c', 6)]; // strength 24
  const weakHand   = [mkCard('a', 4),  mkCard('b', 3), mkCard('c', 2)]; // strength 9

  it('calls truco when strength ≥ 20', () => {
    assert.equal(botDecideTruco(strongHand, makeTrucoBetting(), makeEnvidoBetting()), 'truco');
  });

  it('returns null when strength is below threshold', () => {
    assert.equal(botDecideTruco(weakHand, makeTrucoBetting(), makeEnvidoBetting()), null);
  });

  it('returns null while envido is pending', () => {
    const pendingEnvido = appendEnvidoCall(makeEnvidoBetting(), 'envido', 'player', 0);
    assert.equal(botDecideTruco(strongHand, makeTrucoBetting(), pendingEnvido), null);
  });

  it('returns null when canCallTruco is false (e.g. wrong raisedBy side)', () => {
    let b = appendTrucoCall(makeTrucoBetting(), 'truco', 'player');
    b = respondTruco(b, 'quiero', 'player'); // player accepted → player can raise, not bot
    assert.equal(botDecideTruco(strongHand, b, makeEnvidoBetting()), null);
  });
});

describe('botRespondToEnvido', () => {
  const mkCards = (envidoValues, suit = 'espada') =>
    envidoValues.map((v, i) => ({ id: `c${i}`, envido: v, suit, rank: v, power: v }));

  it('accepts when envido score ≥ 22', () => {
    const cards = mkCards([3, 2, 0]); // 3+2+20 = 25
    const b = appendEnvidoCall(makeEnvidoBetting(), 'envido', 'player', 0);
    assert.equal(botRespondToEnvido(cards, b), 'quiero');
  });

  it('declines when score is low and noQuieroPts is cheap', () => {
    const cards = [
      { id: 'a', envido: 4, suit: 'espada', rank: 4 },
      { id: 'b', envido: 3, suit: 'basto',  rank: 3 },
      { id: 'c', envido: 2, suit: 'copa',   rank: 2 },
    ];
    const b = appendEnvidoCall(makeEnvidoBetting(), 'envido', 'player', 0); // noQuieroPts=1
    assert.equal(botRespondToEnvido(cards, b), 'no-quiero');
  });
});

describe('botRespondToTruco', () => {
  it('accepts when hand strength ≥ 18', () => {
    const hand = [mkCard('a', 10), mkCard('b', 8), mkCard('c', 6)]; // strength 24
    assert.equal(botRespondToTruco(hand), 'quiero');
  });

  it('declines when hand strength is below 14', () => {
    const hand = [mkCard('a', 4), mkCard('b', 3), mkCard('c', 2)]; // strength 9
    assert.equal(botRespondToTruco(hand), 'no-quiero');
  });
});
