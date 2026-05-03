import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, dealHand, applyHandResult, checkMatchWinner, resetMatch } from '../game.js';

function makeHandOver(playerPts, botPts) {
  return {
    phase: 'hand-over',
    winner: playerPts >= botPts ? 'player' : 'bot',
    pointsDelta: { player: playerPts, bot: botPts },
  };
}

describe('createGame', () => {
  it('starts with zero scores', () => {
    const g = createGame();
    assert.equal(g.playerScore, 0);
    assert.equal(g.botScore, 0);
  });

  it('starts with player as mano', () => {
    assert.equal(createGame().manoSide, 'player');
  });

  it('has no current hand or winner', () => {
    const g = createGame();
    assert.equal(g.currentHand, null);
    assert.equal(g.matchWinner, null);
  });

  it('respects florEnabled option', () => {
    assert.ok(!createGame().options.florEnabled);
    assert.ok(createGame({ florEnabled: true }).options.florEnabled);
  });
});

describe('dealHand', () => {
  it('creates a currentHand with 3 cards each', () => {
    const g = dealHand(createGame());
    assert.equal(g.currentHand.playerHand.length, 3);
    assert.equal(g.currentHand.botHand.length, 3);
  });

  it('increments handNumber', () => {
    const g = dealHand(createGame());
    assert.equal(g.handNumber, 1);
  });

  it('is a no-op when matchWinner is set', () => {
    const finished = { ...createGame(), matchWinner: 'player' };
    const g = dealHand(finished);
    assert.equal(g.currentHand, null);
  });

  it('passes manoSide to the hand', () => {
    const g = dealHand(createGame());
    assert.equal(g.currentHand.manoSide, 'player');
  });
});

describe('applyHandResult', () => {
  it('adds points from pointsDelta to the scores', () => {
    let g = dealHand(createGame());
    g.currentHand = makeHandOver(2, 0);
    g = applyHandResult(g);
    assert.equal(g.playerScore, 2);
    assert.equal(g.botScore, 0);
  });

  it('rotates manoSide after each hand', () => {
    let g = dealHand(createGame());
    g.currentHand = makeHandOver(1, 0);
    g = applyHandResult(g);
    assert.equal(g.manoSide, 'bot');

    g = dealHand(g);
    g.currentHand = makeHandOver(1, 0);
    g = applyHandResult(g);
    assert.equal(g.manoSide, 'player');
  });

  it('clears currentHand', () => {
    let g = dealHand(createGame());
    g.currentHand = makeHandOver(1, 0);
    g = applyHandResult(g);
    assert.equal(g.currentHand, null);
  });

  it('sets playerInBuenas when score crosses 15', () => {
    let g = dealHand(createGame());
    g.currentHand = makeHandOver(15, 0);
    g = applyHandResult(g);
    assert.ok(g.playerInBuenas);
    assert.ok(!g.botInBuenas);
  });

  it('caps score at 30', () => {
    let g = { ...createGame(), playerScore: 29 };
    g = dealHand(g);
    g.currentHand = makeHandOver(6, 0); // would reach 35 without cap
    g = applyHandResult(g);
    assert.equal(g.playerScore, 30);
  });

  it('is a no-op when currentHand is null', () => {
    const g = createGame();
    assert.equal(applyHandResult(g), g);
  });

  it('is a no-op when hand phase is not hand-over', () => {
    let g = dealHand(createGame());
    // Hand is in 'playing' phase by default
    const before = g.playerScore;
    g = applyHandResult(g);
    assert.equal(g.playerScore, before);
  });
});

describe('checkMatchWinner', () => {
  it('returns null when no one has reached 30', () => {
    let g = dealHand(createGame());
    g.currentHand = makeHandOver(14, 0);
    g = applyHandResult(g);
    assert.equal(checkMatchWinner(g), null);
  });

  it('returns player when player reaches 30', () => {
    let g = { ...createGame(), playerScore: 28 };
    g = dealHand(g);
    g.currentHand = makeHandOver(2, 0);
    g = applyHandResult(g);
    assert.equal(checkMatchWinner(g), 'player');
  });

  it('returns bot when bot reaches 30', () => {
    let g = { ...createGame(), botScore: 29 };
    g = dealHand(g);
    g.currentHand = makeHandOver(0, 1);
    g = applyHandResult(g);
    assert.equal(checkMatchWinner(g), 'bot');
  });

  it('returns null at exactly 29 points', () => {
    let g = { ...createGame(), playerScore: 28 };
    g = dealHand(g);
    g.currentHand = makeHandOver(1, 0);
    g = applyHandResult(g);
    assert.equal(checkMatchWinner(g), null);
  });
});

describe('resetMatch', () => {
  it('zeroes both scores', () => {
    let g = { ...createGame(), playerScore: 20, botScore: 15 };
    g = resetMatch(g);
    assert.equal(g.playerScore, 0);
    assert.equal(g.botScore, 0);
  });

  it('resets manoSide to player', () => {
    let g = { ...createGame(), manoSide: 'bot' };
    g = resetMatch(g);
    assert.equal(g.manoSide, 'player');
  });

  it('clears matchWinner and currentHand', () => {
    let g = { ...createGame(), matchWinner: 'bot', currentHand: {} };
    g = resetMatch(g);
    assert.equal(g.matchWinner, null);
    assert.equal(g.currentHand, null);
  });

  it('preserves options', () => {
    let g = createGame({ florEnabled: true });
    g = resetMatch(g);
    assert.ok(g.options.florEnabled);
  });
});
