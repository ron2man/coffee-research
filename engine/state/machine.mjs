// Status machine for work items. Pure functions: callers persist the result.

export const SIDE_STATES = ['blocked', 'needs_human'];

// Forward (and explicit loop-back) transitions per item type.
const FLOWS = {
  'new-post': {
    idea: ['idea_approved', 'rejected'],
    idea_approved: ['researched', 'rejected'],
    researched: ['briefed', 'rejected'],
    briefed: ['drafted'],
    drafted: ['passed', 'briefed', 'rejected'], // briefed = one revision loop
    passed: ['published'],
    published: ['measured'],
    measured: [],
    rejected: ['idea'], // re-score when new demand data arrives
  },
};

export function allowedTransitions(item) {
  const flow = FLOWS[item.type];
  if (!flow) throw new Error(`Unknown item type: ${item.type}`);
  if (SIDE_STATES.includes(item.status)) {
    return [item.resumeStatus, 'rejected'].filter(Boolean);
  }
  const next = flow[item.status];
  if (!next) throw new Error(`Unknown status ${item.status} for type ${item.type}`);
  // Any active state can be parked for a human or blocked; terminal states cannot.
  const parkable = !['measured', 'rejected'].includes(item.status);
  return parkable ? [...next, ...SIDE_STATES] : next;
}

/**
 * Return a new item moved to `to`. Throws on an illegal move.
 * Entering a side state remembers where to resume; leaving it clears that.
 * Attempts reset on every move except into `blocked`.
 */
export function transition(item, to, { by, reason = '', at = new Date().toISOString() }) {
  if (!by) throw new Error('transition requires `by`');
  if (!allowedTransitions(item).includes(to)) {
    throw new Error(`Illegal transition for ${item.id}: ${item.status} → ${to}`);
  }
  const next = {
    ...item,
    status: to,
    updatedAt: at,
    history: [...item.history, { at, from: item.status, to, by, reason }],
  };
  if (SIDE_STATES.includes(to)) {
    next.resumeStatus = SIDE_STATES.includes(item.status) ? item.resumeStatus : item.status;
    next.blockedReason = reason || to;
  } else {
    delete next.resumeStatus;
    delete next.blockedReason;
    delete next.lastError;
  }
  if (to !== 'blocked') next.attempts = 0;
  return next;
}

export function newItem({ id, type = 'new-post', niche, status = 'idea', by, reason = '', at = new Date().toISOString() }) {
  if (!FLOWS[type]?.[status]) throw new Error(`Invalid initial status ${status} for ${type}`);
  return {
    schemaVersion: 1,
    id,
    type,
    niche,
    status,
    attempts: 0,
    revisions: 0,
    createdAt: at,
    updatedAt: at,
    artifacts: {},
    history: [{ at, from: null, to: status, by, reason }],
  };
}
