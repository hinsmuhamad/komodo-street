// rep.js
// Komodo Street. Reputation and wanted level. Reputation grows when missions
// pay out and side work gets done; crossing a rep threshold announces the new
// street name. Wanted level rises when the player is caught doing dirty work
// and falls when the player stays out of sight of every police unit for a
// while. The bust path lives in police.js; this file only handles the evade.

import { CONFIG } from './config.js';
import { clamp, dist2D } from './util.js';
import { repNameFor } from './config.js';

const EVADE_DISTANCE = 28;

export function createRep(state) {
  return { evadeTimer: 0 };
}

export function addRep(state, n) {
  const before = repNameFor(state.rep || 0);
  state.rep = (state.rep || 0) + n;
  const after = repNameFor(state.rep);
  if (after !== before) {
    state.ui.notice = 'Reputation up: ' + after;
  }
}

export function addWanted(state, n) {
  state.wanted = clamp((state.wanted || 0) + n, 0, 5);
}

export function clearWanted(state) {
  state.wanted = 0;
}

function nearestPoliceDistance(state) {
  if (!state.police || !Array.isArray(state.police.units)) return Infinity;
  let nearest = Infinity;
  for (const unit of state.police.units) {
    const ux = unit.pos ? unit.pos.x : unit.x;
    const uz = unit.pos ? unit.pos.z : unit.z;
    if (typeof ux !== 'number' || typeof uz !== 'number') continue;
    const d = dist2D(state.player.pos.x, state.player.pos.z, ux, uz);
    if (d < nearest) nearest = d;
  }
  return nearest;
}

export function updateRep(state, repSys, dt) {
  if (!state.started || state.paused) return;
  if (!repSys) return;
  if ((state.wanted || 0) <= 0) {
    repSys.evadeTimer = 0;
    return;
  }
  const evadeSeconds = (CONFIG.police && CONFIG.police.evadeSeconds) || 6;
  const nearest = nearestPoliceDistance(state);
  if (nearest > EVADE_DISTANCE) {
    repSys.evadeTimer += dt;
  } else {
    repSys.evadeTimer = 0;
  }
  if (repSys.evadeTimer >= evadeSeconds) {
    repSys.evadeTimer = 0;
    state.wanted = Math.max(0, state.wanted - 1);
    if (state.wanted > 0) {
      state.ui.notice = 'You shook the police. Wanted level ' + state.wanted + '.';
    } else {
      state.ui.notice = 'You lost the police. You are clean.';
    }
  }
}
