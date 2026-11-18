// traffic.js
// Komodo Street. Ambient traffic cars and pedestrians.
// Cars stay on avenues and streets, turn at intersections sometimes, and
// wrap around the city bounds. Pedestrians walk the sidewalks between
// random nearby targets. Cheap movement, no physics.

import * as THREE from 'three';
import { buildCar } from './vehicles.js';
import { mulberry32, randRange, pick, clamp, lerpAngle } from './util.js';

const TRAFFIC_COLORS = [
  0x3f6fb5, 0xc4a06f, 0x5fa8a0, 0xd98c4a, 0x7a7d8a, 0x9ab8c4,
  0xb08a5f, 0x6b8f5f, 0xa03f4a, 0xd9c98f, 0x4a5a7a, 0x8f7a5f,
];

const SHIRT_COLORS = [
  0xd21f26, 0x2f9bb0, 0xffb020, 0x5fa860, 0x8a5fbf, 0xf2f2f2,
  0x222222, 0xd98c4a, 0x3f6fb5, 0xe88aa0,
];

const SKIN_COLORS = [0xc98a5f, 0x8a5a3a, 0xe8b88a, 0x6f4a2f, 0xd9a077];
const PANTS_COLORS = [0x2a3442, 0x4a3a2a, 0x5a5a5a, 0x1a1d22, 0x6b4a3a];

function headingFor(axis, dir) {
  if (axis === 'x') return dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  return dir > 0 ? 0 : Math.PI;
}

function makePedestrian(rand) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({
    color: pick(rand, SHIRT_COLORS), roughness: 0.8, metalness: 0.0,
  });
  const skin = new THREE.MeshStandardMaterial({
    color: pick(rand, SKIN_COLORS), roughness: 0.7, metalness: 0.0,
  });
  const pants = new THREE.MeshStandardMaterial({
    color: pick(rand, PANTS_COLORS), roughness: 0.85, metalness: 0.0,
  });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.55, 4, 10), shirt);
  body.position.y = 1.05;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), skin);
  head.position.y = 1.62;
  head.castShadow = true;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.62, 8), pants);
  legL.position.set(-0.12, 0.31, 0);
  legL.castShadow = true;
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.62, 8), pants);
  legR.position.set(0.12, 0.31, 0);
  legR.castShadow = true;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8), shirt);
  armL.position.set(-0.32, 1.1, 0);
  group.add(armL);
  const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8), shirt);
  armR.position.set(0.32, 1.1, 0);
  group.add(armR);
  return { group: group, legL: legL, legR: legR, armL: armL, armR: armR };
}

function sidewalkTarget(rand, city) {
  const useAvenue = rand() < 0.5;
  if (useAvenue) {
    const avenue = pick(rand, city.avenues);
    const side = rand() < 0.5 ? -1 : 1;
    return new THREE.Vector3(
      avenue + side * randRange(rand, 3.6, 5.2),
      0,
      randRange(rand, city.minZ + 8, city.maxZ - 8)
    );
  }
  const street = pick(rand, city.streets);
  const side = rand() < 0.5 ? -1 : 1;
  return new THREE.Vector3(
    randRange(rand, city.minX + 8, city.maxX - 8),
    0,
    street + side * randRange(rand, 3.6, 5.2)
  );
}

function spawnCar(rand, cfg, scene) {
  const city = cfg.city;
  const axis = rand() < 0.5 ? 'x' : 'z';
  const dir = rand() < 0.5 ? -1 : 1;
  const lane = dir > 0 ? 1.9 : -1.9;
  let x = 0;
  let z = 0;
  let line = 0;
  if (axis === 'x') {
    line = pick(rand, city.avenues);
    x = line + lane;
    z = randRange(rand, city.minZ + 10, city.maxZ - 10);
  } else {
    line = pick(rand, city.streets);
    x = randRange(rand, city.minX + 10, city.maxX - 10);
    z = line + lane;
  }
  const vehicle = buildCar({ config: cfg }, 'traffic', pick(rand, TRAFFIC_COLORS));
  vehicle.pos.set(x, 0, z);
  vehicle.heading = headingFor(axis, dir);
  vehicle.group.rotation.y = vehicle.heading;
  vehicle.speed = randRange(rand, 8, 14);
  scene.add(vehicle.group);
  return {
    vehicle: vehicle,
    road: { axis: axis, line: line },
    dir: dir,
    speed: vehicle.speed,
  };
}

export function createTraffic(state) {
  const cfg = state.config;
  const rand = mulberry32(cfg.seed + 101);
  const cars = [];
  for (let i = 0; i < cfg.counts.traffic; i++) {
    cars.push(spawnCar(rand, cfg, state.scene));
  }
  const peds = [];
  for (let i = 0; i < cfg.counts.pedestrians; i++) {
    const parts = makePedestrian(rand);
    const target = sidewalkTarget(rand, cfg.city);
    const start = sidewalkTarget(rand, cfg.city);
    parts.group.position.copy(start);
    state.scene.add(parts.group);
    peds.push({
      mesh: parts.group,
      pos: parts.group.position,
      heading: randRange(rand, 0, Math.PI * 2),
      speed: randRange(rand, 1.0, 2.0),
      target: target,
      legL: parts.legL,
      legR: parts.legR,
      armL: parts.armL,
      armR: parts.armR,
      phase: randRange(rand, 0, Math.PI * 2),
    });
  }
  return { cars: cars, peds: peds, rand: rand };
}

function nearestCrossing(value, lines) {
  let best = null;
  let bestDist = Infinity;
  for (const line of lines) {
    const d = Math.abs(value - line);
    if (d < bestDist) {
      bestDist = d;
      best = line;
    }
  }
  return { line: best, dist: bestDist };
}

function turnCar(car, cfg, rand) {
  const city = cfg.city;
  const current = car.road;
  if (current.axis === 'x') {
    const cross = nearestCrossing(car.vehicle.pos.z, city.streets);
    if (cross.line === null || cross.dist > 2.0) return;
    const dir = rand() < 0.5 ? -1 : 1;
    const lane = dir > 0 ? 1.9 : -1.9;
    car.road = { axis: 'z', line: cross.line };
    car.dir = dir;
    car.vehicle.pos.z = cross.line + lane;
  } else {
    const cross = nearestCrossing(car.vehicle.pos.x, city.avenues);
    if (cross.line === null || cross.dist > 2.0) return;
    const dir = rand() < 0.5 ? -1 : 1;
    const lane = dir > 0 ? 1.9 : -1.9;
    car.road = { axis: 'x', line: cross.line };
    car.dir = dir;
    car.vehicle.pos.x = cross.line + lane;
  }
  car.vehicle.heading = headingFor(car.road.axis, car.dir);
}

function wrapCar(car, cfg) {
  const city = cfg.city;
  const p = car.vehicle.pos;
  if (car.road.axis === 'x') {
    if (p.z > city.maxZ + 6) p.z = city.minZ - 6;
    if (p.z < city.minZ - 6) p.z = city.maxZ + 6;
    p.x = clamp(p.x, city.minX, city.maxX);
  } else {
    if (p.x > city.maxX + 6) p.x = city.minX - 6;
    if (p.x < city.minX - 6) p.x = city.maxX + 6;
    p.z = clamp(p.z, city.minZ, city.maxZ);
  }
}

export function updateTraffic(state, traffic, dt) {
  const cfg = state.config;
  const city = cfg.city;
  const step = Math.min(dt, 0.05);

  for (const car of traffic.cars) {
    const v = car.vehicle;
    const targetHeading = headingFor(car.road.axis, car.dir);
    v.heading = lerpAngle(v.heading, targetHeading, Math.min(1, step * 6));
    v.group.rotation.y = v.heading;
    const move = car.speed * step;
    if (car.road.axis === 'x') {
      v.pos.z += car.dir * move;
      v.pos.x = car.road.line + (car.dir > 0 ? 1.9 : -1.9);
    } else {
      v.pos.x += car.dir * move;
      v.pos.z = car.road.line + (car.dir > 0 ? 1.9 : -1.9);
    }
    v.speed = car.speed;
    for (const wheel of v.wheels) {
      wheel.rotation.x += (car.speed * step) / 0.36;
    }
    // At an intersection, turn onto the crossing road sometimes.
    const along = car.road.axis === 'x' ? v.pos.z : v.pos.x;
    const lines = car.road.axis === 'x' ? city.streets : city.avenues;
    const cross = nearestCrossing(along, lines);
    if (cross.dist < 1.6 && traffic.rand() < step * 0.45) {
      turnCar(car, cfg, traffic.rand);
    }
    wrapCar(car, cfg);
  }

  for (const ped of traffic.peds) {
    const dx = ped.target.x - ped.pos.x;
    const dz = ped.target.z - ped.pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 1.0) {
      ped.target = sidewalkTarget(traffic.rand, city);
      continue;
    }
    const targetHeading = Math.atan2(dx, dz);
    ped.heading = lerpAngle(ped.heading, targetHeading, Math.min(1, step * 5));
    ped.mesh.rotation.y = ped.heading;
    const move = ped.speed * step;
    ped.pos.x += (dx / dist) * move;
    ped.pos.z += (dz / dist) * move;
    ped.phase += step * ped.speed * 4.5;
    const swing = Math.sin(ped.phase) * 0.45;
    ped.legL.rotation.x = swing;
    ped.legR.rotation.x = -swing;
    ped.armL.rotation.x = -swing * 0.7;
    ped.armR.rotation.x = swing * 0.7;
  }
}
