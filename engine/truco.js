const TRUCO_SEQUENCE = ['truco', 'retruco', 'vale-cuatro'];

const TRUCO_POINTS = {
  'truco':       { quiero: 2, noQuiero: 1 },
  'retruco':     { quiero: 4, noQuiero: 2 },
  'vale-cuatro': { quiero: 6, noQuiero: 4 },
};

export function makeTrucoBetting() {
  return {
    calls: [],
    status: 'idle',
    pendingCaller: null,
    quieroPts: 0,
    noQuieroPts: 0,
    raisedBy: null,
  };
}

export function canCallTruco(betting, callerSide) {
  if (betting.status === 'pending') return false;

  if (betting.status === 'idle') {
    return true;
  }

  if (betting.status === 'accepted') {
    const lastCall = betting.calls[betting.calls.length - 1].call;
    const nextIdx = TRUCO_SEQUENCE.indexOf(lastCall) + 1;
    if (nextIdx >= TRUCO_SEQUENCE.length) return false;
    return betting.raisedBy === callerSide;
  }

  return false;
}

export function nextTrucoCall(betting) {
  if (betting.calls.length === 0) return 'truco';
  const lastCall = betting.calls[betting.calls.length - 1].call;
  const nextIdx = TRUCO_SEQUENCE.indexOf(lastCall) + 1;
  return TRUCO_SEQUENCE[nextIdx] ?? null;
}

export function appendTrucoCall(betting, call, caller) {
  const pts = TRUCO_POINTS[call];
  return {
    ...betting,
    calls: [...betting.calls, { caller, call }],
    status: 'pending',
    pendingCaller: caller,
    quieroPts: pts.quiero,
    noQuieroPts: pts.noQuiero,
  };
}

export function respondTruco(betting, response, responderSide) {
  if (response === 'quiero') {
    return {
      ...betting,
      status: 'accepted',
      raisedBy: responderSide,
    };
  }
  return { ...betting, status: 'declined' };
}
