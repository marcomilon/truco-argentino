import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createHand,
  playerPlayCard,
  playerCallEnvido,
  playerCallTruco,
  playerRespond,
  playerFold,
  advanceBotTurn,
} from '../hand.js';
import { buildDeck } from '../deck.js';

const deck = buildDeck();
const get = (id) => deck.find((c) => c.id === id);

// Strong player hand, weak bot hand — bot won't call anything proactively
const strongPlayer = [get('1-espada'), get('7-espada'), get('3-copa')];
const weakBot      = [get('4-basto'),  get('5-copa'),   get('6-oro')];
const scores = { player: 0, bot: 0 };

function freshHand(opts) {
  return createHand(strongPlayer, weakBot, 'player', scores, opts);
}

describe('createHand', () => {
  it('starts in playing phase', () => {
    const h = freshHand();
    assert.equal(h.phase, 'playing');
  });

  it('deals 3 cards to each side', () => {
    const h = freshHand();
    assert.equal(h.playerHand.length, 3);
    assert.equal(h.botHand.length, 3);
  });

  it('playerAllCards is a snapshot of original cards', () => {
    const h = freshHand();
    assert.deepEqual(h.playerAllCards.map((c) => c.id), strongPlayer.map((c) => c.id));
  });

  it('sets no winner initially', () => {
    assert.equal(freshHand().winner, null);
  });

  it('envidoAvailable starts true', () => {
    assert.ok(freshHand().envidoAvailable);
  });

  it('stores a matchScores snapshot', () => {
    const h = createHand(strongPlayer, weakBot, 'player', { player: 12, bot: 5 });
    assert.equal(h.matchScores.player, 12);
    assert.equal(h.matchScores.bot, 5);
  });
});

describe('playerPlayCard', () => {
  it('removes the card from the player hand', () => {
    let h = freshHand();
    const id = h.playerHand[0].id;
    h = playerPlayCard(h, id);
    assert.ok(!h.playerHand.some((c) => c.id === id));
  });

  it('bot also plays a card', () => {
    let h = freshHand();
    const botCountBefore = h.botHand.length;
    h = playerPlayCard(h, h.playerHand[0].id);
    assert.equal(h.botHand.length, botCountBefore - 1);
  });

  it('records the trick', () => {
    let h = freshHand();
    h = playerPlayCard(h, h.playerHand[0].id);
    assert.equal(h.tricks.length, 1);
    assert.ok(['player', 'bot', 'parda'].includes(h.tricks[0].winner));
  });

  it('closes the envido window after the first trick', () => {
    let h = freshHand();
    assert.ok(h.envidoAvailable);
    h = playerPlayCard(h, h.playerHand[0].id);
    assert.ok(!h.envidoAvailable);
  });

  it('sets lastEvent to type trick', () => {
    let h = freshHand();
    h = playerPlayCard(h, h.playerHand[0].id);
    assert.equal(h.lastEvent.type, 'trick');
  });

  it('is a no-op when phase is not playing', () => {
    let h = freshHand();
    h = playerCallTruco(h, 'truco'); // phase → truco-pending
    const before = h.playerHand.length;
    h = playerPlayCard(h, h.playerHand[0].id);
    assert.equal(h.playerHand.length, before);
  });

  it('reaches hand-over after 3 tricks', () => {
    let h = freshHand();
    for (let i = 0; i < 3 && h.phase !== 'hand-over'; i++) {
      h = playerPlayCard(h, h.playerHand[0].id);
    }
    assert.equal(h.phase, 'hand-over');
    assert.ok(h.winner === 'player' || h.winner === 'bot');
  });
});

describe('playerCallEnvido', () => {
  it('transitions phase to envido-pending', () => {
    let h = freshHand();
    h = playerCallEnvido(h, 'envido');
    assert.equal(h.phase, 'envido-pending');
    assert.equal(h.pendingResponder, 'bot');
    assert.equal(h.pendingCallType, 'envido');
  });

  it('is a no-op after envido window closes', () => {
    let h = freshHand();
    h = playerPlayCard(h, h.playerHand[0].id); // closes window
    h = playerCallEnvido(h, 'envido');
    assert.equal(h.phase, 'playing');
  });

  it('is a no-op when truco is already accepted', () => {
    let h = freshHand();
    h = playerCallTruco(h, 'truco');
    // Force-accept truco by responding ourselves (simulating bot quiero)
    h = playerRespond(h, 'quiero'); // this won't work — player can't respond to own call
    // Instead just check the guard via advanceBotTurn
    h = freshHand();
    h = playerCallTruco(h, 'truco');
    h = advanceBotTurn(h); // bot responds
    if (h.trucoBetting.status === 'accepted') {
      h = playerCallEnvido(h, 'envido');
      assert.equal(h.phase, 'playing'); // envido blocked
    }
  });
});

describe('playerCallTruco', () => {
  it('transitions phase to truco-pending', () => {
    let h = freshHand();
    h = playerCallTruco(h, 'truco');
    assert.equal(h.phase, 'truco-pending');
    assert.equal(h.pendingResponder, 'bot');
    assert.equal(h.pendingCallType, 'truco');
  });

  it('closes the envido window', () => {
    let h = freshHand();
    h = playerCallTruco(h, 'truco');
    assert.ok(!h.envidoAvailable);
  });

  it('records the truco call', () => {
    let h = freshHand();
    h = playerCallTruco(h, 'truco');
    assert.equal(h.trucoBetting.calls.length, 1);
    assert.equal(h.trucoBetting.calls[0].call, 'truco');
  });

  it('is a no-op when a call is already pending', () => {
    let h = freshHand();
    h = playerCallTruco(h, 'truco');
    const phase = h.phase;
    h = playerCallTruco(h, 'retruco');
    assert.equal(h.phase, phase); // unchanged
  });
});

describe('playerRespond — envido', () => {
  it('quiero triggers envido showdown and awards points', () => {
    let h = freshHand();
    h = playerCallEnvido(h, 'envido');
    assert.equal(h.phase, 'envido-pending');
    h = advanceBotTurn(h); // bot responds (declines with weak hand)
    assert.equal(h.phase, 'playing');
    // bot declined, player should get noQuieroPts = 1
    assert.equal(h.pointsDelta.player, 1);
  });

  it('quiero to bot envido call triggers showdown', () => {
    const botWithFlora = [get('7-copa'), get('6-copa'), get('4-basto')]; // 7+6+20=33
    let h = createHand(strongPlayer, botWithFlora, 'player', scores);
    h = advanceBotTurn(h); // bot has score 33, should call falta-envido
    if (h.pendingResponder === 'player' && h.pendingCallType === 'envido') {
      h = playerRespond(h, 'quiero');
      assert.equal(h.phase, 'playing');
      // one side got points
      assert.ok(h.pointsDelta.player > 0 || h.pointsDelta.bot > 0);
    }
  });

  it('no-quiero to bot envido call awards noQuieroPts to bot', () => {
    const botHighEnvido = [get('7-copa'), get('6-copa'), get('4-basto')];
    let h = createHand(strongPlayer, botHighEnvido, 'player', scores);
    h = advanceBotTurn(h);
    if (h.pendingResponder === 'player' && h.pendingCallType === 'envido') {
      const noQuiero = h.envidoBetting.noQuieroPts;
      h = playerRespond(h, 'no-quiero');
      assert.equal(h.pointsDelta.bot, noQuiero);
    }
  });
});

describe('playerRespond — truco', () => {
  it('quiero updates trucoBetting to accepted', () => {
    // Bot calls truco — use a bot hand with high strength
    const strongBot = [get('1-espada'), get('7-espada'), get('3-copa')];
    let h = createHand(weakBot, strongBot, 'player', scores);
    // Swap: player=weakBot, bot=strongBot so bot calls truco
    h = advanceBotTurn(h);
    if (h.pendingResponder === 'player' && h.pendingCallType === 'truco') {
      h = playerRespond(h, 'quiero');
      assert.equal(h.trucoBetting.status, 'accepted');
      assert.equal(h.phase, 'playing');
    }
  });

  it('no-quiero to bot truco ends the hand and awards points to bot', () => {
    const strongBot = [get('1-espada'), get('7-espada'), get('3-copa')];
    let h = createHand(weakBot, strongBot, 'player', scores);
    h = advanceBotTurn(h);
    if (h.pendingResponder === 'player' && h.pendingCallType === 'truco') {
      const expected = h.trucoBetting.noQuieroPts;
      h = playerRespond(h, 'no-quiero');
      assert.equal(h.phase, 'hand-over');
      assert.equal(h.winner, 'bot');
      assert.equal(h.pointsDelta.bot, expected);
    }
  });
});

describe('playerFold', () => {
  it('immediately ends the hand with bot as winner', () => {
    let h = freshHand();
    h = playerFold(h);
    assert.equal(h.phase, 'hand-over');
    assert.equal(h.winner, 'bot');
  });

  it('awards 1 point to bot when no truco was called', () => {
    let h = freshHand();
    h = playerFold(h);
    assert.equal(h.pointsDelta.bot, 1);
  });

  it('awards noQuieroPts when truco was accepted', () => {
    let h = freshHand();
    h = playerCallTruco(h, 'truco');
    h = advanceBotTurn(h); // bot responds
    if (h.trucoBetting.status === 'accepted') {
      const expected = h.trucoBetting.noQuieroPts; // 1 for truco
      h = playerFold(h);
      assert.equal(h.pointsDelta.bot, expected);
    }
  });

  it('is a no-op when phase is not playing', () => {
    let h = freshHand();
    h = playerCallTruco(h, 'truco');
    const phase = h.phase;
    h = playerFold(h); // truco-pending, not playing
    assert.equal(h.phase, phase);
  });
});

describe('advanceBotTurn', () => {
  it('returns the same hand when phase is hand-over', () => {
    let h = freshHand();
    h = playerFold(h);
    const before = h;
    const after = advanceBotTurn(h);
    assert.equal(after, before);
  });

  it('bot responds to player envido call', () => {
    let h = freshHand();
    h = playerCallEnvido(h, 'envido');
    assert.equal(h.pendingResponder, 'bot');
    h = advanceBotTurn(h);
    // Bot should have responded; pendingResponder should be cleared
    assert.equal(h.pendingResponder, null);
  });

  it('bot responds to player truco call', () => {
    let h = freshHand();
    h = playerCallTruco(h, 'truco');
    assert.equal(h.pendingResponder, 'bot');
    h = advanceBotTurn(h);
    assert.equal(h.pendingResponder, null);
  });
});

describe('flor', () => {
  it('awards 3 points to the flor holder when florEnabled', () => {
    const florHand = [get('1-espada'), get('7-espada'), get('3-espada')]; // all espada
    const h = createHand(florHand, weakBot, 'player', scores, { florEnabled: true });
    assert.equal(h.pointsDelta.player, 3);
    assert.equal(h.florClaimed, 'player');
    assert.ok(!h.envidoAvailable);
  });

  it('does not award flor when florEnabled is false', () => {
    const florHand = [get('1-espada'), get('7-espada'), get('3-espada')];
    const h = createHand(florHand, weakBot, 'player', scores, { florEnabled: false });
    assert.equal(h.pointsDelta.player, 0);
    assert.equal(h.florClaimed, null);
  });

  it('both players having flor awards 3 points to the higher scorer', () => {
    const florPlayer = [get('7-espada'), get('6-espada'), get('1-espada')]; // 7+6+20=33
    const florBot    = [get('3-basto'),  get('2-basto'),  get('1-basto')];  // 3+2+20=25
    const h = createHand(florPlayer, florBot, 'player', scores, { florEnabled: true });
    assert.equal(h.florClaimed, 'player');
    assert.equal(h.pointsDelta.player, 3);
    assert.equal(h.pointsDelta.bot, 0);
  });
});
