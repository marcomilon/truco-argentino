import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcEnvido,
  hasFlor,
  faltaEnvidoPoints,
  makeEnvidoBetting,
  appendEnvidoCall,
  respondEnvido,
} from '../envido.js';

// Helper: build a minimal card object with suit and envido value
const card = (suit, envido) => ({ suit, envido });

describe('calcEnvido', () => {
  it('pair of same suit: top two + 20', () => {
    const cards = [card('espada', 3), card('espada', 2), card('copa', 7)];
    assert.equal(calcEnvido(cards), 3 + 2 + 20); // 25
  });

  it('three of same suit: top two + 20', () => {
    const cards = [card('espada', 7), card('espada', 6), card('espada', 1)];
    assert.equal(calcEnvido(cards), 7 + 6 + 20); // 33
  });

  it('all different suits: best single card', () => {
    const cards = [card('espada', 5), card('basto', 7), card('copa', 3)];
    assert.equal(calcEnvido(cards), 7);
  });

  it('all face cards (envido=0): returns 0', () => {
    const cards = [card('espada', 0), card('basto', 0), card('copa', 0)];
    assert.equal(calcEnvido(cards), 0);
  });

  it('two suits with pairs: returns the higher of the two', () => {
    const cards = [card('espada', 7), card('espada', 6), card('basto', 3)];
    // espada pair: 7+6+20 = 33; basto has no pair
    assert.equal(calcEnvido(cards), 33);
  });

  it('maximum possible score is 33', () => {
    // 7 + 6 + 20 = 33
    const cards = [card('oro', 7), card('oro', 6), card('copa', 0)];
    assert.equal(calcEnvido(cards), 33);
  });

  it('minimum score with a pair is 20 (both cards value 0)', () => {
    const cards = [card('espada', 0), card('espada', 0), card('basto', 0)];
    assert.equal(calcEnvido(cards), 20);
  });
});

describe('hasFlor', () => {
  it('true when all three cards share a suit', () => {
    const cards = [card('espada', 7), card('espada', 3), card('espada', 1)];
    assert.ok(hasFlor(cards));
  });

  it('false when suits differ', () => {
    const cards = [card('espada', 7), card('basto', 3), card('copa', 1)];
    assert.ok(!hasFlor(cards));
  });

  it('false when only two cards share a suit', () => {
    const cards = [card('espada', 7), card('espada', 3), card('copa', 1)];
    assert.ok(!hasFlor(cards));
  });

  it('false for fewer than 3 cards', () => {
    assert.ok(!hasFlor([card('espada', 1), card('espada', 2)]));
  });
});

describe('faltaEnvidoPoints', () => {
  it('returns points needed to reach 30', () => {
    assert.equal(faltaEnvidoPoints(0),  30);
    assert.equal(faltaEnvidoPoints(10), 20);
    assert.equal(faltaEnvidoPoints(15), 15);
    assert.equal(faltaEnvidoPoints(28),  2);
  });

  it('returns at least 1', () => {
    assert.equal(faltaEnvidoPoints(29), 1);
    assert.equal(faltaEnvidoPoints(30), 1);
  });
});

describe('appendEnvidoCall — betting chain points', () => {
  it('first envido: quiero=2, noQuiero=1', () => {
    const b = appendEnvidoCall(makeEnvidoBetting(), 'envido', 'player', 0);
    assert.equal(b.quieroPts, 2);
    assert.equal(b.noQuieroPts, 1);
    assert.equal(b.status, 'pending');
  });

  it('second envido stacked: quiero=4, noQuiero=2', () => {
    let b = appendEnvidoCall(makeEnvidoBetting(), 'envido', 'player', 0);
    b = appendEnvidoCall(b, 'envido', 'bot', 0);
    assert.equal(b.quieroPts, 4);
    assert.equal(b.noQuieroPts, 2);
  });

  it('standalone real-envido: quiero=3, noQuiero=1', () => {
    const b = appendEnvidoCall(makeEnvidoBetting(), 'real-envido', 'player', 0);
    assert.equal(b.quieroPts, 3);
    assert.equal(b.noQuieroPts, 1);
  });

  it('envido + real-envido: quiero=5, noQuiero=2', () => {
    let b = appendEnvidoCall(makeEnvidoBetting(), 'envido', 'player', 0);
    b = appendEnvidoCall(b, 'real-envido', 'bot', 0);
    assert.equal(b.quieroPts, 5);
    assert.equal(b.noQuieroPts, 2);
  });

  it('standalone falta-envido from score 10: quiero=20', () => {
    const b = appendEnvidoCall(makeEnvidoBetting(), 'falta-envido', 'player', 10);
    assert.equal(b.quieroPts, 20);
    assert.equal(b.noQuieroPts, 1); // no prior bet
  });

  it('envido + falta-envido: noQuiero equals prior quiero', () => {
    let b = appendEnvidoCall(makeEnvidoBetting(), 'envido', 'player', 0);
    b = appendEnvidoCall(b, 'falta-envido', 'bot', 5);
    assert.equal(b.quieroPts, 25); // faltaEnvidoPoints(5)
    assert.equal(b.noQuieroPts, 2); // prior quiero was 2
  });

  it('records the full call history', () => {
    let b = appendEnvidoCall(makeEnvidoBetting(), 'envido', 'player', 0);
    b = appendEnvidoCall(b, 'real-envido', 'bot', 0);
    assert.equal(b.calls.length, 2);
    assert.equal(b.calls[0].call, 'envido');
    assert.equal(b.calls[1].call, 'real-envido');
  });
});

describe('respondEnvido', () => {
  it('quiero sets status to accepted', () => {
    let b = appendEnvidoCall(makeEnvidoBetting(), 'envido', 'bot', 0);
    b = respondEnvido(b, 'quiero');
    assert.equal(b.status, 'accepted');
  });

  it('no-quiero sets status to declined', () => {
    let b = appendEnvidoCall(makeEnvidoBetting(), 'envido', 'bot', 0);
    b = respondEnvido(b, 'no-quiero');
    assert.equal(b.status, 'declined');
  });
});
