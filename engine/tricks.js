export function compareTrick(cardA, cardB) {
  if (cardA.power > cardB.power) return 1;
  if (cardA.power < cardB.power) return -1;
  return 0;
}

export function resolveTrick(playerCard, botCard) {
  const cmp = compareTrick(playerCard, botCard);
  if (cmp > 0) return 'player';
  if (cmp < 0) return 'bot';
  return 'parda';
}

export function resolveHand(tricks, manoSide) {
  const n = tricks.length;
  if (n === 0) return null;

  const w = (t) => (t.winner === 'parda' ? null : t.winner);

  if (n === 1) return null;

  if (n === 2) {
    const w1 = w(tricks[0]);
    const w2 = w(tricks[1]);
    if (w1 === null && w2 === null) return null; // both parda → need trick 3
    if (w1 === null) return w2;                  // trick 1 parda → trick 2 decides
    if (w2 === null) return w1;                  // trick 2 parda → trick 1 decides
    if (w1 === w2) return w1;                    // same player won both
    return null;                                 // split → need trick 3
  }

  // n === 3: count wins
  const wins = { player: 0, bot: 0 };
  for (const t of tricks) {
    if (t.winner !== 'parda') wins[t.winner]++;
  }
  if (wins.player > wins.bot) return 'player';
  if (wins.bot > wins.player) return 'bot';

  // Tied: all-parda (0-0) → mano wins; 1-1 → "primera" (first non-parda trick winner) wins
  if (wins.player === 0) return manoSide; // all parda
  const primera = tricks.find((t) => t.winner !== 'parda');
  return primera ? primera.winner : manoSide;
}
