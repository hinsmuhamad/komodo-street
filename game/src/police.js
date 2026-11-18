// police.js
// Komodo Street. Wanted-level police pursuit.
// No units exist until the player is wanted. Units spawn on a ring around
// the player, steer toward the player and try to ram. Flashing light bars,
// a bust timer when the player sits still close by, and an evade timer
// when every unit is far away.

import * as THREE from 'three';
import { buildCar } from './vehicles.js';
import { lerpAngle, clamp, dist2D } from './util.js';

function spawnUnit(state, police) {
  const cfg = state.config;
  const player = state.player.pos;
  const angle = Math.random() * Math.PI * 2;
  const ring = cfg.police.spawnRing;
  let x = player.x + Math.cos(angle) * ring;
  let z = player.z + Math.sin(angle) * ring;
  x = clamp(x, cfg.city.minX + 6, cfg.city.maxX - 6);
  z = clamp(z, cfg.city.minZ + 6, cfg.city.maxZ - 6);
  const vehicle = buildCar(state, 'police');
  vehicle.pos.set(x, 0, z);
  vehicle.heading = Math.atan2(player.x - x, player.z - z);
  vehicle.group.rotation.y = vehicle.heading;
  state.scene.add(vehicle.group);
  const unit = { vehicle: vehicle, speed: 0 };
  police.units.push(unit);
  return unit;
}

function removeUnit(state, police, unit) {
  state.scene.remove(unit.vehicle.group);
  const index = police.units.indexOf(unit);
  if (index >= 0) police.units.splice(index, 1);
}

function removeAllUnits(state, police) {
  while (police.units.length > 0) {
    removeUnit(state, police, police.units[0]);
  }
}

export function createPolice(state) {
  return {
    units: [],
    bustTimer: 0,
    evadeTimer: 0,
    flashTimer: 0,
  };
}

export function updatePolice(state, police, dt) {
  const cfg = state.config;
  const tuning = cfg.police;
  const step = Math.min(dt, 0.05);
  const player = state.player;
  const playerSpeed = Math.abs(player.speed || 0);

  // Wanted level sets how many units stay active, capped at five.
  const wanted = clamp(state.wanted || 0, 0, 5);
  if (wanted === 0) {
    if (police.units.length > 0) removeAllUnits(state, police);
    police.bustTimer = 0;
    police.evadeTimer = 0;
    return;
  }

  while (police.units.length < wanted) spawnUnit(state, police);
  while (police.units.length > wanted) {
    // Drop the unit furthest from the player first.
    let far = police.units[0];
    let farDist = -1;
    for (const unit of police.units) {
      const d = dist2D(unit.vehicle.pos.x, unit.vehicle.pos.z, player.pos.x, player.pos.z);
      if (d > farDist) {
        farDist = d;
        far = unit;
      }
    }
    removeUnit(state, police, far);
  }

  // Flash the light bars red and blue in alternating halves.
  police.flashTimer += step;
  const redOn = Math.floor(police.flashTimer * 6) % 2 === 0;
  for (const unit of police.units) {
    const bar = unit.vehicle.lightBar;
    if (bar) {
      bar.left.material.emissiveIntensity = redOn ? 3.0 : 0.25;
      bar.right.material.emissiveIntensity = redOn ? 0.25 : 3.0;
    }
  }

  let nearestDist = Infinity;
  for (const unit of police.units) {
    const v = unit.vehicle;
    const dx = player.pos.x - v.pos.x;
    const dz = player.pos.z - v.pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < nearestDist) nearestDist = dist;

    // Steer toward the player and drive to ram, a little faster per star.
    const targetHeading = Math.atan2(dx, dz);
    v.heading = lerpAngle(v.heading, targetHeading, Math.min(1, step * 2.2));
    v.group.rotation.y = v.heading;
    const topSpeed = Math.min(30, 19 + wanted * 1.8);
    unit.speed += (topSpeed - unit.speed) * Math.min(1, step * 1.4);
    // Ease off right on top of the player, so the ram reads as a bump.
    const drive = dist < 4 ? unit.speed * 0.35 : unit.speed;
    v.speed = drive;
    v.pos.x += Math.sin(v.heading) * drive * step;
    v.pos.z += Math.cos(v.heading) * drive * step;
    v.pos.x = clamp(v.pos.x, cfg.city.minX - 4, cfg.city.maxX + 4);
    v.pos.z = clamp(v.pos.z, cfg.city.minZ - 4, cfg.city.maxZ + 4);
    for (const wheel of v.wheels) {
      wheel.rotation.x += (drive * step) / 0.36;
    }
  }

  // Bust rule: close and nearly still for the full bust window.
  if (nearestDist < tuning.bustDistance && playerSpeed < tuning.bustStillSpeed) {
    police.bustTimer += step;
  } else {
    police.bustTimer = 0;
  }
  if (police.bustTimer >= tuning.bustSeconds) {
    const fine = wanted * tuning.finePerStar;
    state.money = Math.max(0, (state.money || 0) - fine);
    state.wanted = 0;
    removeAllUnits(state, police);
    police.bustTimer = 0;
    police.evadeTimer = 0;
    if (state.ui) {
      state.ui.notice = 'BUSTED! Fine $' + fine;
      state.ui.noticeTimer = 3;
    }
    return;
  }

  // Evade rule: no unit within 28 metres for the full evade window.
  if (nearestDist > 28) {
    police.evadeTimer += step;
    if (police.evadeTimer >= tuning.evadeSeconds) {
      state.wanted = Math.max(0, wanted - 1);
      police.evadeTimer = 0;
      police.bustTimer = 0;
      if (state.ui && state.wanted === 0) {
        state.ui.notice = 'You lost the police';
        state.ui.noticeTimer = 2.5;
      }
    }
  } else {
    police.evadeTimer = 0;
  }
}
