export function calcEnvido(cards) {
  const bySuit = {};
  for (const card of cards) {
    (bySuit[card.suit] = bySuit[card.suit] || []).push(card.envido);
  }

  const paired = Object.values(bySuit)
    .filter((group) => group.length > 1)
    .map((group) => {
      const sorted = [...group].sort((a, b) => b - a);
      return sorted[0] + sorted[1] + 20;
    });

  if (paired.length > 0) return Math.max(...paired);
  return Math.max(...cards.map((c) => c.envido));
}

export function hasFlor(cards) {
  return cards.length === 3 && new Set(cards.map((c) => c.suit)).size === 1;
}

export function faltaEnvidoPoints(winnerScore) {
  return Math.max(30 - winnerScore, 1);
}

export function makeEnvidoBetting() {
  return {
    calls: [],
    status: 'idle',
    pendingCaller: null,
    quieroPts: 0,
    noQuieroPts: 0,
  };
}

export function appendEnvidoCall(betting, call, caller, winnerScore) {
  const prev = betting.quieroPts;
  let quieroPts;
  let noQuieroPts;

  if (call === 'falta-envido') {
    quieroPts = faltaEnvidoPoints(winnerScore);
    noQuieroPts = prev === 0 ? 1 : prev;
  } else if (call === 'real-envido') {
    quieroPts = prev + 3;
    noQuieroPts = prev === 0 ? 1 : prev;
  } else {
    // 'envido'
    quieroPts = prev === 0 ? 2 : prev + 2;
    noQuieroPts = prev === 0 ? 1 : prev;
  }

  return {
    ...betting,
    calls: [...betting.calls, { caller, call }],
    status: 'pending',
    pendingCaller: caller,
    quieroPts,
    noQuieroPts,
  };
}

export function respondEnvido(betting, response) {
  if (response === 'quiero') {
    return { ...betting, status: 'accepted' };
  }
  return { ...betting, status: 'declined' };
}
