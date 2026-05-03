import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compareTrick, resolveTrick, resolveHand } from '../tricks.js';

const c = (power) => ({ power });
const trick = (winner) => ({ winner });

describe('compareTrick', () => {
  it('returns 1 when cardA has higher power', () => assert.equal(compareTrick(c(10), c(5)), 1));
  it('returns -1 when cardB has higher power', () => assert.equal(compareTrick(c(3), c(9)), -1));
  it('returns 0 when powers are equal (parda)', () => assert.equal(compareTrick(c(7), c(7)), 0));
});

describe('resolveTrick', () => {
  it('player wins when their card has higher power', () => assert.equal(resolveTrick(c(12), c(8)), 'player'));
  it('bot wins when their card has higher power', () => assert.equal(resolveTrick(c(5), c(11)), 'bot'));
  it('returns parda on equal power', () => assert.equal(resolveTrick(c(10), c(10)), 'parda'));
});

describe('resolveHand — after 1 trick', () => {
  it('is always undecided', () => {
    assert.equal(resolveHand([trick('player')], 'player'), null);
    assert.equal(resolveHand([trick('bot')], 'bot'), null);
    assert.equal(resolveHand([trick('parda')], 'player'), null);
  });
});

describe('resolveHand — after 2 tricks', () => {
  it('same winner both tricks → that player wins', () => {
    assert.equal(resolveHand([trick('player'), trick('player')], 'bot'), 'player');
    assert.equal(resolveHand([trick('bot'),    trick('bot')],    'player'), 'bot');
  });

  it('trick 1 parda, trick 2 won → trick 2 winner wins', () => {
    assert.equal(resolveHand([trick('parda'), trick('player')], 'bot'), 'player');
    assert.equal(resolveHand([trick('parda'), trick('bot')],    'player'), 'bot');
  });

  it('trick 1 won, trick 2 parda → trick 1 winner holds', () => {
    assert.equal(resolveHand([trick('player'), trick('parda')], 'bot'), 'player');
    assert.equal(resolveHand([trick('bot'),    trick('parda')], 'player'), 'bot');
  });

  it('both parda → undecided, need trick 3', () => {
    assert.equal(resolveHand([trick('parda'), trick('parda')], 'player'), null);
  });

  it('split (different winners) → undecided, need trick 3', () => {
    assert.equal(resolveHand([trick('player'), trick('bot')], 'player'), null);
    assert.equal(resolveHand([trick('bot'), trick('player')], 'bot'), null);
  });
});

describe('resolveHand — after 3 tricks', () => {
  it('2-0 sweep → winner', () => {
    assert.equal(resolveHand([trick('player'), trick('player'), trick('bot')],    'bot'), 'player');
    assert.equal(resolveHand([trick('bot'),    trick('bot'),    trick('player')], 'player'), 'bot');
  });

  it('all three parda → mano side wins', () => {
    assert.equal(resolveHand([trick('parda'), trick('parda'), trick('parda')], 'player'), 'player');
    assert.equal(resolveHand([trick('parda'), trick('parda'), trick('parda')], 'bot'), 'bot');
  });

  it('1-1 with one parda → primera rule: first non-parda trick winner wins', () => {
    // Player won trick 1, bot won trick 2, trick 3 parda → player wins (primera)
    assert.equal(resolveHand([trick('player'), trick('bot'), trick('parda')], 'bot'), 'player');
    // Bot won trick 1, player won trick 2, trick 3 parda → bot wins (primera)
    assert.equal(resolveHand([trick('bot'), trick('player'), trick('parda')], 'player'), 'bot');
  });

  it('1-1 with parda in trick 1 → primera rule still applies (trick 2 winner has primera)', () => {
    // Trick 1 parda → trick 2 becomes primera; trick 2 winner holds the advantage
    assert.equal(resolveHand([trick('parda'), trick('player'), trick('bot')], 'bot'), 'player');
    assert.equal(resolveHand([trick('parda'), trick('bot'),    trick('player')], 'player'), 'bot');
  });

  it('2-1 → majority wins, mano is irrelevant', () => {
    assert.equal(resolveHand([trick('player'), trick('bot'), trick('player')], 'bot'), 'player');
    assert.equal(resolveHand([trick('bot'), trick('player'), trick('bot')], 'player'), 'bot');
  });
});
