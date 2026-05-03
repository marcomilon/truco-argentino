import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeTrucoBetting,
  canCallTruco,
  nextTrucoCall,
  appendTrucoCall,
  respondTruco,
} from '../truco.js';

describe('canCallTruco', () => {
  it('allows first call when idle', () => {
    assert.ok(canCallTruco(makeTrucoBetting(), 'player'));
    assert.ok(canCallTruco(makeTrucoBetting(), 'bot'));
  });

  it('blocks while a call is pending', () => {
    const b = appendTrucoCall(makeTrucoBetting(), 'truco', 'player');
    assert.ok(!canCallTruco(b, 'bot'));
    assert.ok(!canCallTruco(b, 'player'));
  });

  it('allows raise only by the side that accepted', () => {
    let b = appendTrucoCall(makeTrucoBetting(), 'truco', 'player');
    b = respondTruco(b, 'quiero', 'bot'); // bot accepted → bot can raise
    assert.ok(canCallTruco(b, 'bot'));
    assert.ok(!canCallTruco(b, 'player'));
  });

  it('blocks raise once vale-cuatro is reached', () => {
    let b = appendTrucoCall(makeTrucoBetting(), 'truco', 'player');
    b = respondTruco(b, 'quiero', 'bot');
    b = appendTrucoCall(b, 'retruco', 'bot');
    b = respondTruco(b, 'quiero', 'player');
    b = appendTrucoCall(b, 'vale-cuatro', 'player');
    b = respondTruco(b, 'quiero', 'bot');
    assert.ok(!canCallTruco(b, 'bot'));
    assert.ok(!canCallTruco(b, 'player'));
  });
});

describe('nextTrucoCall', () => {
  it('is truco when no calls made', () => {
    assert.equal(nextTrucoCall(makeTrucoBetting()), 'truco');
  });

  it('is retruco after truco', () => {
    let b = appendTrucoCall(makeTrucoBetting(), 'truco', 'player');
    b = respondTruco(b, 'quiero', 'bot');
    assert.equal(nextTrucoCall(b), 'retruco');
  });

  it('is vale-cuatro after retruco', () => {
    let b = appendTrucoCall(makeTrucoBetting(), 'truco', 'player');
    b = respondTruco(b, 'quiero', 'bot');
    b = appendTrucoCall(b, 'retruco', 'bot');
    b = respondTruco(b, 'quiero', 'player');
    assert.equal(nextTrucoCall(b), 'vale-cuatro');
  });

  it('is null after vale-cuatro', () => {
    let b = appendTrucoCall(makeTrucoBetting(), 'truco', 'player');
    b = respondTruco(b, 'quiero', 'bot');
    b = appendTrucoCall(b, 'retruco', 'bot');
    b = respondTruco(b, 'quiero', 'player');
    b = appendTrucoCall(b, 'vale-cuatro', 'player');
    assert.equal(nextTrucoCall(b), null);
  });
});

describe('appendTrucoCall — points', () => {
  it('truco: quiero=2, noQuiero=1', () => {
    const b = appendTrucoCall(makeTrucoBetting(), 'truco', 'player');
    assert.equal(b.quieroPts, 2);
    assert.equal(b.noQuieroPts, 1);
    assert.equal(b.status, 'pending');
    assert.equal(b.pendingCaller, 'player');
  });

  it('retruco: quiero=4, noQuiero=2', () => {
    const b = appendTrucoCall(makeTrucoBetting(), 'retruco', 'bot');
    assert.equal(b.quieroPts, 4);
    assert.equal(b.noQuieroPts, 2);
  });

  it('vale-cuatro: quiero=6, noQuiero=4', () => {
    const b = appendTrucoCall(makeTrucoBetting(), 'vale-cuatro', 'player');
    assert.equal(b.quieroPts, 6);
    assert.equal(b.noQuieroPts, 4);
  });

  it('records call history', () => {
    let b = appendTrucoCall(makeTrucoBetting(), 'truco', 'player');
    b = respondTruco(b, 'quiero', 'bot');
    b = appendTrucoCall(b, 'retruco', 'bot');
    assert.equal(b.calls.length, 2);
    assert.equal(b.calls[0].call, 'truco');
    assert.equal(b.calls[1].call, 'retruco');
  });
});

describe('respondTruco', () => {
  it('quiero sets status to accepted and records raisedBy', () => {
    let b = appendTrucoCall(makeTrucoBetting(), 'truco', 'player');
    b = respondTruco(b, 'quiero', 'bot');
    assert.equal(b.status, 'accepted');
    assert.equal(b.raisedBy, 'bot');
  });

  it('no-quiero sets status to declined', () => {
    let b = appendTrucoCall(makeTrucoBetting(), 'truco', 'player');
    b = respondTruco(b, 'no-quiero', 'bot');
    assert.equal(b.status, 'declined');
  });
});
