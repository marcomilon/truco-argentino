import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildDeck, shuffle, cardPower, cardEnvidoValue, SUITS, RANKS } from '../deck.js';

describe('buildDeck', () => {
  it('returns 40 cards', () => {
    assert.equal(buildDeck().length, 40);
  });

  it('all card IDs are unique', () => {
    const deck = buildDeck();
    const ids = deck.map((c) => c.id);
    assert.equal(new Set(ids).size, 40);
  });

  it('every card has rank, suit, power, and envido', () => {
    for (const card of buildDeck()) {
      assert.ok(RANKS.includes(card.rank), `bad rank: ${card.rank}`);
      assert.ok(SUITS.includes(card.suit), `bad suit: ${card.suit}`);
      assert.ok(typeof card.power === 'number' && card.power >= 1 && card.power <= 14);
      assert.ok(typeof card.envido === 'number' && card.envido >= 0 && card.envido <= 7);
    }
  });

  it('id format is rank-suit', () => {
    const card = buildDeck().find((c) => c.rank === 1 && c.suit === 'espada');
    assert.equal(card.id, '1-espada');
  });
});

describe('cardPower', () => {
  it('ace of spades is 14 (highest)', () => assert.equal(cardPower(1, 'espada'), 14));
  it('ace of clubs is 13',            () => assert.equal(cardPower(1, 'basto'),  13));
  it('7 of spades is 12',             () => assert.equal(cardPower(7, 'espada'), 12));
  it('7 of diamonds is 11',           () => assert.equal(cardPower(7, 'oro'),    11));
  it('3 of any suit is 10',           () => assert.equal(cardPower(3, 'copa'),   10));
  it('2 of any suit is 9',            () => assert.equal(cardPower(2, 'basto'),   9));
  it('ace of cups is 8',              () => assert.equal(cardPower(1, 'copa'),    8));
  it('ace of diamonds is 8',          () => assert.equal(cardPower(1, 'oro'),     8));
  it('king (12) is 7',                () => assert.equal(cardPower(12, 'espada'), 7));
  it('knight (11) is 6',              () => assert.equal(cardPower(11, 'basto'),  6));
  it('jack (10) is 5',                () => assert.equal(cardPower(10, 'copa'),   5));
  it('7 of clubs is 4',               () => assert.equal(cardPower(7, 'basto'),   4));
  it('6 is 3',                        () => assert.equal(cardPower(6, 'oro'),     3));
  it('5 is 2',                        () => assert.equal(cardPower(5, 'copa'),    2));
  it('4 is 1 (lowest)',               () => assert.equal(cardPower(4, 'espada'),  1));
});

describe('cardEnvidoValue', () => {
  it('face cards (10, 11, 12) are worth 0', () => {
    assert.equal(cardEnvidoValue(10), 0);
    assert.equal(cardEnvidoValue(11), 0);
    assert.equal(cardEnvidoValue(12), 0);
  });

  it('numbered cards are worth their face value', () => {
    for (let r = 1; r <= 7; r++) {
      assert.equal(cardEnvidoValue(r), r);
    }
  });
});

describe('shuffle', () => {
  it('returns a new array of the same length', () => {
    const deck = buildDeck();
    const shuffled = shuffle(deck);
    assert.equal(shuffled.length, deck.length);
    assert.notEqual(shuffled, deck);
  });

  it('contains the same cards', () => {
    const deck = buildDeck();
    const shuffled = shuffle(deck);
    const original = new Set(deck.map((c) => c.id));
    for (const card of shuffled) {
      assert.ok(original.has(card.id));
    }
  });

  it('does not mutate the input array', () => {
    const deck = buildDeck();
    const firstId = deck[0].id;
    shuffle(deck);
    assert.equal(deck[0].id, firstId);
  });
});
