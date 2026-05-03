export const SUITS = ['espada', 'basto', 'oro', 'copa'];
export const RANKS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

const POWER_TABLE = new Map([
  ['1-espada', 14],
  ['1-basto',  13],
  ['7-espada', 12],
  ['7-oro',    11],
  ['3',        10],
  ['2',         9],
  ['1',         8],
  ['12',        7],
  ['11',        6],
  ['10',        5],
  ['7',         4],
  ['6',         3],
  ['5',         2],
  ['4',         1],
]);

export function cardPower(rank, suit) {
  return POWER_TABLE.get(`${rank}-${suit}`) ?? POWER_TABLE.get(String(rank));
}

export function cardEnvidoValue(rank) {
  return rank >= 10 ? 0 : rank;
}

export function buildDeck() {
  return SUITS.flatMap((suit) =>
    RANKS.map((rank) => ({
      id: `${rank}-${suit}`,
      rank,
      suit,
      power: cardPower(rank, suit),
      envido: cardEnvidoValue(rank),
    }))
  );
}

export function shuffle(cards) {
  const deck = [...cards];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
