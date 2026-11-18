// player.js
// Komodo Street. The player on foot and behind the wheel.
// Movement is relative to the camera, driving follows CONFIG.car tuning,
// collisions are circle versus AABB push outs, and the camera is a
// smoothed third person chase cam with three distances on KeyC.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { clamp, lerpAngle } from './util.js';

const CAM_DIST = [0.65, 1.0, 1.5];
const BOUNDS = { minX: -258, maxX: 338, minZ: -198, maxZ: 198 };

function makeLimb(mat, w, h, d, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  return mesh;
}

export function createPlayer(state) {
  const shirt = new THREE.MeshStandardMaterial({ color: 0xff5a3c, roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe8b88a, roughness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.9 });
  const cap = new THREE.MeshStandardMaterial({ color: 0x1f6f5a, roughness: 0.8 });

  const mesh = new THREE.Group();

  // Slimmer proportions: a narrow torso, long legs, thin arms close to
  // the body, so the figure reads as a person, not a blocky toy.
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.55, 4, 10), shirt);
  body.position.y = 1.02;
  mesh.add(body);

  // Slim waist belt and a courier backpack, so the figure reads as a
  // person from behind instead of one solid red capsule.
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.28), dark);
  belt.position.y = 0.78;
  mesh.add(belt);
  const pack = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.48, 0.16),
    new THREE.MeshStandardMaterial({ color: 0x1f6f5a, roughness: 0.8 })
  );
  pack.position.set(0, 1.14, -0.28);
  mesh.add(pack);
  const packFlap = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.12, 0.17),
    new THREE.MeshStandardMaterial({ color: 0xffd27d, roughness: 0.8 })
  );
  packFlap.position.set(0, 1.34, -0.28);
  mesh.add(packFlap);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 14), skin);
  head.position.y = 1.62;
  mesh.add(head);

  const hat = new THREE.Mesh(new THREE.SphereGeometry(0.25, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), cap);
  hat.position.y = 1.66;
  mesh.add(hat);

  const brim = makeLimb(cap, 0.26, 0.05, 0.28, 0.24, 1.7, 0);
  mesh.add(brim);

  const legL = makeLimb(dark, 0.16, 0.72, 0.18, 0, 0.42, -0.13);
  const legR = makeLimb(dark, 0.16, 0.72, 0.18, 0, 0.42, 0.13);
  legL.geometry.translate(0, -0.36, 0);
  legR.geometry.translate(0, -0.36, 0);
  legL.position.y = 0.78;
  legR.position.y = 0.78;
  mesh.add(legL);
  mesh.add(legR);
  // Small shoes at the feet.
  const shoeL = makeLimb(dark, 0.18, 0.09, 0.3, 0, 0.05, -0.13);
  const shoeR = makeLimb(dark, 0.18, 0.09, 0.3, 0, 0.05, 0.13);
  mesh.add(shoeL);
  mesh.add(shoeR);

  const armL = makeLimb(shirt, 0.12, 0.56, 0.13, 0, 1.18, -0.32);
  const armR = makeLimb(shirt, 0.12, 0.56, 0.13, 0, 1.18, 0.32);
  armL.geometry.translate(0, -0.28, 0);
  armR.geometry.translate(0, -0.28, 0);
  armL.position.y = 1.42;
  armR.position.y = 1.42;
  mesh.add(armL);
  mesh.add(armR);

  mesh.position.set(150, 0, 0);
  mesh.rotation.y = Math.PI;
  state.scene.add(mesh);

  const player = {
    pos: new THREE.Vector3(150, 0, 0),
    heading: Math.PI,
    speed: 0,
    onFoot: true,
    vehicle: null,
    health: 100,
    armour: 0,
    mesh,
    legL,
    legR,
    armL,
    armR,
    camMode: 1,
    walkPhase: 0,
    engineLevel: 0,
  };
  state.player = player;
  return player;
}

// Sibling modules (vehicles, traffic, police) use the other heading
// convention: forward is (sin h, 0, cos h), group.rotation.y = h.
// This module uses forward (cos h, 0, -sin h), so a car built by
// vehicles.js needs its stored heading shifted by +PI/2, and an
// entered car needs its heading shifted back by -PI/2.
function toSiblingHeading(heading) {
  return heading + Math.PI / 2;
}

function fromSiblingHeading(heading) {
  return heading - Math.PI / 2;
}

function syncVehicleGroup(player, v) {
  if (!v || !v.group) return;
  if (v.forwardAxis === 'x') {
    v.heading = player.heading;
    v.group.rotation.y = player.heading;
  } else {
    v.heading = toSiblingHeading(player.heading);
    v.group.rotation.y = v.heading;
  }
  v.group.position.set(player.pos.x, 0, player.pos.z);
}

function forwardOf(heading) {
  return { x: Math.cos(heading), z: -Math.sin(heading) };
}

function headingOf(dx, dz) {
  return Math.atan2(-dz, dx);
}

function resolveColliders(pos, radius) {
  const colliders = (stateRef.city && stateRef.city.colliders) || [];
  for (const c of colliders) {
    const cx = clamp(pos.x, c.minX, c.maxX);
    const cz = clamp(pos.z, c.minZ, c.maxZ);
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    if (d2 > 0.000001) {
      const d = Math.sqrt(d2);
      pos.x = cx + (dx / d) * radius;
      pos.z = cz + (dz / d) * radius;
    } else {
      const pushL = pos.x - c.minX + radius;
      const pushR = c.maxX - pos.x + radius;
      const pushB = pos.z - c.minZ + radius;
      const pushF = c.maxZ - pos.z + radius;
      const m = Math.min(pushL, pushR, pushB, pushF);
      if (m === pushL) pos.x = c.minX - radius;
      else if (m === pushR) pos.x = c.maxX + radius;
      else if (m === pushB) pos.z = c.minZ - radius;
      else pos.z = c.maxZ + radius;
    }
  }
}

let stateRef = null;

function nearestVehicle(state, pos, range) {
  const list = Array.isArray(state.vehicles) ? state.vehicles : [];
  let best = null;
  let bestD = range;
  for (const v of list) {
    if (!v || !v.pos) continue;
    const vx = v.pos.x !== undefined ? v.pos.x : 0;
    const vz = v.pos.z !== undefined ? v.pos.z : 0;
    const dx = pos.x - vx;
    const dz = pos.z - vz;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  return best;
}

function enterVehicle(state, player, v) {
  player.vehicle = v;
  player.onFoot = false;
  player.speed = 0;
  if (v) {
    v.speed = 0;
    player.pos.copy(v.pos);
    player.heading = v.forwardAxis === 'x'
      ? (v.heading || 0)
      : fromSiblingHeading(v.heading || 0);
  }
  if (player.mesh) player.mesh.visible = false;
}

function exitVehicle(state, player) {
  const v = player.vehicle;
  if (!v) return;
  const f = forwardOf(player.heading);
  const rx = -f.z;
  const rz = f.x;
  player.pos.set(v.pos.x + rx * 2.4, 0, v.pos.z + rz * 2.4);
  player.vehicle = null;
  player.onFoot = true;
  player.speed = 0;
  v.speed = 0;
  if (player.mesh) player.mesh.visible = true;
}

export function updatePlayer(state, player, dt) {
  stateRef = state;
  if (!player || !state.scene) return;
  dt = Math.min(dt || 0.016, 0.05);
  const keys = state.input ? state.input.keys : new Set();
  const pressed = state.input ? state.input.pressed : new Set();

  // Screenshot staging owns the camera and the pose, so do not fight it.
  if (state.shot) {
    if (player.mesh) {
      player.mesh.position.copy(player.pos);
      player.mesh.rotation.y = player.heading;
    }
    if (player.vehicle && player.vehicle.group) {
      syncVehicleGroup(player, player.vehicle);
    }
    return;
  }

  if (pressed.has('KeyC')) {
    player.camMode = (player.camMode + 1) % CAM_DIST.length;
  }

  if (pressed.has('KeyE')) {
    if (player.onFoot) {
      const v = nearestVehicle(state, player.pos, CONFIG.player.enterRange);
      if (v) enterVehicle(state, player, v);
    } else {
      exitVehicle(state, player);
    }
  }

  const camera = state.camera;
  const camDir = new THREE.Vector3();
  if (camera) camera.getWorldDirection(camDir);
  const camYaw = Math.atan2(-camDir.z, camDir.x);
  const camF = { x: Math.cos(camYaw), z: -Math.sin(camYaw) };
  const camR = { x: -camF.z, z: camF.x };

  if (player.onFoot) {
    let mx = 0;
    let mz = 0;
    if (keys.has('KeyW')) { mx += camF.x; mz += camF.z; }
    if (keys.has('KeyS')) { mx -= camF.x; mz -= camF.z; }
    if (keys.has('KeyD')) { mx += camR.x; mz += camR.z; }
    if (keys.has('KeyA')) { mx -= camR.x; mz -= camR.z; }
    const len = Math.sqrt(mx * mx + mz * mz);
    const running = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const targetSpeed = len > 0
      ? (running ? CONFIG.player.runSpeed : CONFIG.player.walkSpeed)
      : 0;
    if (len > 0) {
      mx /= len;
      mz /= len;
      player.pos.x += mx * targetSpeed * dt;
      player.pos.z += mz * targetSpeed * dt;
      player.heading = lerpAngle(player.heading, headingOf(mx, mz), Math.min(1, dt * 12));
      player.walkPhase += targetSpeed * dt * 1.7;
    }
    player.speed = targetSpeed;
    const swing = len > 0 ? Math.sin(player.walkPhase) * 0.55 : 0;
    if (player.legL) player.legL.rotation.x = swing;
    if (player.legR) player.legR.rotation.x = -swing;
    if (player.armL) player.armL.rotation.x = -swing * 0.7;
    if (player.armR) player.armR.rotation.x = swing * 0.7;
    resolveColliders(player.pos, 1.2);
    if (player.mesh) {
      player.mesh.position.copy(player.pos);
      player.mesh.rotation.y = player.heading;
    }
  } else {
    const v = player.vehicle;
    const car = CONFIG.car;
    const level = player.engineLevel || 0;
    const topSpeed = car.maxSpeed + level * 6;
    let speed = player.speed || 0;

    if (keys.has('KeyW')) speed += car.accel * dt;
    if (keys.has('KeyS')) {
      if (speed > 0.5) speed -= car.brake * dt;
      else speed -= car.accel * 0.6 * dt;
    }
    if (keys.has('Space')) {
      speed -= Math.sign(speed) * car.brake * 1.4 * dt;
      if (Math.abs(speed) < 0.4) speed = 0;
    }
    if (!keys.has('KeyW') && !keys.has('KeyS')) {
      speed -= speed * 0.9 * dt;
      if (Math.abs(speed) < 0.05) speed = 0;
    }
    speed = clamp(speed, -car.maxReverse, topSpeed);

    let steer = 0;
    if (keys.has('KeyA')) steer += 1;
    if (keys.has('KeyD')) steer -= 1;
    const steerAuthority = clamp(Math.abs(speed) / 9, 0, 1);
    player.heading += steer * car.turn * steerAuthority * Math.sign(speed || 1) * dt;

    const f = forwardOf(player.heading);
    player.pos.x += f.x * speed * dt;
    player.pos.z += f.z * speed * dt;
    player.speed = speed;

    resolveColliders(player.pos, 1.6);
    if (v) {
      v.pos.copy(player.pos);
      v.speed = speed;
      syncVehicleGroup(player, v);
      if (Array.isArray(v.wheels)) {
        for (const w of v.wheels) {
          if (w) w.rotation.x += (speed * dt) / 0.35;
        }
      }
    }
    if (player.mesh) player.mesh.visible = false;
  }

  player.pos.x = clamp(player.pos.x, BOUNDS.minX, BOUNDS.maxX);
  player.pos.z = clamp(player.pos.z, BOUNDS.minZ, BOUNDS.maxZ);
  player.pos.y = 0;

  if (camera) {
    const mult = CAM_DIST[player.camMode] || 1;
    const dist = (player.onFoot ? 9 : 12) * mult;
    const height = (player.onFoot ? 3.6 : 4.4) * (0.75 + 0.25 * mult);
    const f = forwardOf(player.heading);
    const lookAhead = player.onFoot ? 2 : 5;
    const tx = player.pos.x + f.x * lookAhead;
    const tz = player.pos.z + f.z * lookAhead;
    const cx = player.pos.x - f.x * dist;
    const cz = player.pos.z - f.z * dist;
    const k = 1 - Math.exp(-6 * dt);
    camera.position.x += (cx - camera.position.x) * k;
    camera.position.y += (height - camera.position.y) * k;
    camera.position.z += (cz - camera.position.z) * k;
    camera.lookAt(tx, 1.6, tz);
  }
}
