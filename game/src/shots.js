// shots.js
// Komodo Street. Screenshot staging for ?shot=cover|drive|foot|title.
// Runs once before the first render, positions the camera and the cast,
// then returns. main.js renders once and sets window.__shotReady.
// Hero and police cars come from the vehicles module via buildCar.
// The helicopter here is staging only, kept on state.shotHeli so it
// never fights the gameplay helicopter on state.heli.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { buildCar } from './vehicles.js';
import { makeSignTexture } from './textures.js';

// This file uses forward (cos h, 0, -sin h). vehicles.js stores the
// sibling heading, forward (sin h, 0, cos h), so stored headings shift
// by +PI/2 and the group rotation matches the stored heading.
function placeCar(state, car, x, z, heading) {
  car.group.position.set(x, 0, z);
  car.heading = heading + Math.PI / 2;
  car.group.rotation.y = car.heading;
  state.scene.add(car.group);
  if (!Array.isArray(state.vehicles)) state.vehicles = [];
  if (!state.vehicles.includes(car)) state.vehicles.push(car);
  return car;
}

function getOrBuildHero(state) {
  const list = Array.isArray(state.vehicles) ? state.vehicles : [];
  const hero = list.find((v) => v && v.kind === 'hero');
  if (hero) return hero;
  return placeCar(state, buildCar(state, 'hero'), 120, 0, -20);
}

function getOrBuildPolice(state, x, z, heading) {
  const list = Array.isArray(state.vehicles) ? state.vehicles : [];
  const free = list.find((v) => v && v.kind === 'police' && !v.usedInShot);
  const car = free || buildCar(state, 'police');
  car.usedInShot = true;
  return placeCar(state, car, x, z, heading);
}

function buildHelicopter(state, x, y, z, targetPos) {
  // Stage the gameplay police helicopter (state.heli), which already has
  // a proper body, tail boom, skids, strobes, a real spotlight, a
  // translucent beam cone and a ground pool. The staging helicopter used
  // to be a crude grey box; this one reads as a helicopter. A thin
  // translucent disc above the rotor reads as the spinning rotor blur.
  const heli = state.heli;
  if (!heli || !heli.group) return null;
  const group = heli.group;
  group.visible = true;
  group.position.set(x, y, z);
  group.rotation.set(0, 0.6, 0);
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(4.2, 4.2, 0.06, 32),
    new THREE.MeshBasicMaterial({
      color: 0x444444, transparent: true, opacity: 0.18,
      side: THREE.DoubleSide, depthWrite: false,
    })
  );
  disc.position.set(0, 1.85, 0);
  group.add(disc);
  heli.spotlight.intensity = 900;
  heli.spotlightTarget.position.set(targetPos.x, 0, targetPos.z);
  const from = new THREE.Vector3(x, y, z);
  const to = new THREE.Vector3(targetPos.x, 0, targetPos.z);
  const dir = to.clone().sub(from);
  const len = dir.length();
  const beamDir = dir.clone().normalize();
  heli.cone.visible = true;
  heli.cone.position.copy(from).addScaledVector(beamDir, len / 2);
  heli.cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), beamDir.clone().negate());
  heli.cone.scale.set(1, len / 42, 1);
  heli.pool.visible = true;
  heli.pool.position.set(targetPos.x, 0.06, targetPos.z);
  state.shotHeli = heli;
  return heli;
}

function addRoadMarkings(state) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xf2f2e8 });
  const add = (w, d, x, z) => {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), mat);
    stripe.position.set(x, 0.02, z);
    stripe.userData.shotProp = true;
    state.scene.add(stripe);
  };
  // Crosswalk stripes across the avenue at z -28, ahead of the hero car.
  for (let i = 0; i < 5; i++) {
    add(9, 0.9, 130, -31.5 + i * 1.7);
  }
  // Dashed centre line down the avenue, either side of the crosswalk.
  for (let z = -48; z <= 10; z += 6) {
    if (z > -34 && z < -24) continue;
    add(0.35, 2.2, 130, z);
  }
}

// Warm fill light from the camera side so the hero car reads bright red
// even though the sun sits behind it over the sea. Staging only.
function addFillLight(state, x, y, z, tx, ty, tz, intensity) {
  const fill = new THREE.DirectionalLight(0xffe0b8, intensity === undefined ? 1.6 : intensity);
  fill.position.set(x, y, z);
  fill.target.position.set(tx, ty, tz);
  state.scene.add(fill);
  state.scene.add(fill.target);
  return fill;
}

// An emissive neon sign plane, glowing at dusk. Shot props only.
function addNeonSign(state, text, bg, fg, w, h, x, y, z, rotY) {
  const tex = makeSignTexture(text, bg, fg);
  const mat = new THREE.MeshStandardMaterial({
    map: tex, emissive: fg, emissiveIntensity: 2.0,
    emissiveMap: tex, roughness: 0.4, side: THREE.DoubleSide,
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  sign.position.set(x, y, z);
  sign.rotation.y = rotY;
  sign.userData.shotProp = true;
  state.scene.add(sign);
  return sign;
}

// A freestanding neon billboard on two posts, facing the cover camera.
function addBillboard(state, text, bg, fg, w, h, x, y, z, rotY) {
  addNeonSign(state, text, bg, fg, w, h, x, y, z, rotY);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 });
  const half = w / 2 - 0.8;
  for (const dz of [-half, half]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, y - h / 2, 8), postMat);
    post.position.set(x, (y - h / 2) / 2, z + dz);
    post.userData.shotProp = true;
    state.scene.add(post);
  }
}

// A traffic car staged on the road for a shot. Built fresh, never part of
// the ambient traffic system, so it stays exactly where it is put.
function stageTrafficCar(state, kind, color, x, z, heading) {
  const car = buildCar(state, kind, color);
  return placeCar(state, car, x, z, heading);
}

// Teleport one ambient pedestrian to a visible spot for a shot. The shot
// only runs two frames, so the walker barely moves from where it is put.
function stagePedestrian(state, index, x, z, rotY) {
  const peds = (state.traffic && state.traffic.peds) || [];
  const ped = peds[index % Math.max(1, peds.length)];
  if (!ped) return;
  ped.pos.set(x, 0, z);
  ped.heading = rotY;
  if (ped.mesh) ped.mesh.rotation.y = rotY;
  ped.target.set(x + Math.sin(rotY) * 4, 0, z + Math.cos(rotY) * 4);
}

function showTitle(state, show) {
  const el = document.getElementById('title-screen');
  if (el) el.classList.toggle('show', show);
}

function putPlayerInCar(state, car) {
  const p = state.player;
  if (!p) return;
  p.pos.copy(car.pos);
  p.heading = car.heading - Math.PI / 2;
  p.speed = 0;
  p.onFoot = false;
  p.vehicle = car;
  if (p.mesh) p.mesh.visible = false;
}

function putPlayerOnFoot(state, x, z, heading) {
  const p = state.player;
  if (!p) return;
  p.pos.set(x, 0, z);
  p.heading = heading;
  p.speed = 0;
  p.onFoot = true;
  p.vehicle = null;
  if (p.mesh) {
    p.mesh.visible = true;
    p.mesh.position.set(x, 0, z);
    p.mesh.rotation.y = heading;
  }
}

function setCamera(state, px, py, pz, tx, ty, tz, fov) {
  const cam = state.camera;
  if (!cam) return;
  cam.position.set(px, py, pz);
  cam.lookAt(tx, ty, tz);
  cam.fov = fov || 70;
  cam.updateProjectionMatrix();
}

// Move the dialogue box to the top of the frame for a shot, so it never
// covers the hero car in the lower half. updateHud only sets display and
// text, never position, so this inline style persists for the shot.
function moveDialogueTop() {
  const dlg = document.getElementById('dialogue');
  if (!dlg) return;
  dlg.style.top = '66px';
  dlg.style.bottom = 'auto';
  dlg.style.width = '480px';
}

export function applyShot(state, name) {
  state.shot = name;
  if (!state.config) state.config = CONFIG;

  if (name === 'cover') {
    state.time.hour = 18.4;
    if (state.timeSys) {
      state.timeSys.rainOn = false;
      if (state.timeSys.rain) state.timeSys.rain.visible = false;
    }

    // Hero car large in the foreground, three quarter rear view. It faces
    // northeast toward the sea, so the camera southwest of it sees the
    // spoiler, the taillight strip and the wheels, with the beach, the sea
    // and the low sun behind it. The car is staged mid chase, doing
    // 108 km/h, so the speed readout is alive, not parked at zero.
    const hero = getOrBuildHero(state);
    placeCar(state, hero, 130, -10, Math.PI / 4);
    putPlayerInCar(state, hero);
    state.player.speed = 30;
    hero.speed = 30;
    hero.condition = 82;
    hero.name = 'KOMODO GT';

    // Three white police cars closing in: two flanking the hero, one
    // further up the avenue driving at it head on, so the chase has depth.
    const p1 = getOrBuildPolice(state, 126, -20, 0.6);
    const p2 = getOrBuildPolice(state, 136, -16, Math.PI - 0.6);
    const p3 = getOrBuildPolice(state, 131, -38, -Math.PI / 2);
    state.police = state.police || {};
    state.police.units = [
      { vehicle: p1, speed: 0, name: 'GARUDA-1', status: 'RAMMING' },
      { vehicle: p2, speed: 0, name: 'KOMODO-2', status: 'RAMMING' },
      { vehicle: p3, speed: 0, name: 'ELANG-3', status: 'PURSUIT' },
    ];

    // Traffic ahead on the avenue and a becak on the beach edge, so the
    // road is alive instead of empty.
    stageTrafficCar(state, 'traffic', 0xffb020, 133, -30, Math.PI / 2);
    stageTrafficCar(state, 'traffic', 0x3f6fb5, 128, -48, -Math.PI / 2);
    stageTrafficCar(state, 'becak', 0, 146, -26, Math.PI / 2);

    // Pedestrians on the sidewalks and the beach, so the street has people.
    stagePedestrian(state, 0, 121, -26, Math.PI);
    stagePedestrian(state, 1, 141, -32, 0);
    stagePedestrian(state, 2, 152, -14, Math.PI / 2);

    // Neon: a big pink KOMODO FM billboard on the beach side, mid frame,
    // raised clear of the palm fronds, so the shore side carries a
    // readable glow.
    addBillboard(state, 'KOMODO FM', 0x111118, 0xff2e88, 11, 2.75, 152, 8, -42, -Math.PI / 2);

    // Helicopter closer and lower than before, with its spotlight cone on
    // the hero car and a fill light on its camera side, so it reads as a
    // helicopter instead of a dark silhouette against the sky.
    buildHelicopter(state, 152, 10, -26, hero.pos);
    addFillLight(state, 140, 16, -12, 152, 10, -26, 0.9);

    // Warm fill from the camera side so the hero car reads bright red
    // even though the sun sits behind it over the sea. Kept soft and low
    // so the roof does not blow out white and the road stays grey.
    addFillLight(state, 124, 5, -2, 130, 1, -10, 0.5);

    // Camera close and low, south of the hero car, looking northeast
    // toward the sea, so the big hero car dominates the lower centre in
    // three quarter rear view, the police flank it, and the frame holds
    // the beach, a wide sea band, the low sun, the Pantai Biru sign on
    // the right, and buildings behind. The look target sits at car height
    // so the whole car stays in frame, clear of the dialogue box, which
    // is moved to the top.
    setCamera(state, 128, 2.0, -4.5, 134, 2.2, -18, 74);
    moveDialogueTop();

    state.wanted = 3;
    state.money = 18450;
    state.rep = 320;
    state.loadout = { selected: 2 };
    state.radio = { station: 'KOMODO FM 88.1', program: 'Senja Drive', song: 'Pantai Biru Nights', artist: 'The Komodos' };
    state.dialogue = {
      speaker: 'Pak Bimo',
      text: 'The package is in the red car. Drive it to Pasar Ikan before sunset, and do not let the police take it.',
      visible: true,
    };
    state.objective = { title: 'First Shift', text: 'Drive the package to Pasar Ikan' };
    state.screen = 'play';
    state.started = true;
    state.paused = false;
    showTitle(state, false);
    return;
  }

  if (name === 'drive') {
    state.time.hour = 18.4;
    if (state.timeSys) {
      state.timeSys.rainOn = false;
      if (state.timeSys.rain) state.timeSys.rain.visible = false;
    }

    const hero = getOrBuildHero(state);
    placeCar(state, hero, 130, -20, Math.PI / 2);
    putPlayerInCar(state, hero);
    state.player.speed = 24;
    hero.speed = 24;
    hero.condition = 82;
    hero.name = 'KOMODO GT';
    // A taxi ahead on the avenue and a pedestrian on the sidewalk, so the
    // drive shot has traffic and people instead of an empty road.
    stageTrafficCar(state, 'traffic', 0xffb020, 128, -36, Math.PI / 2);
    stagePedestrian(state, 3, 122, -28, Math.PI);
    addRoadMarkings(state);
    addFillLight(state, 124, 8, -8, 130, 1, -20);
    // A soft light over the road ahead so the asphalt reads as dark grey
    // with visible lane markings, not black.
    addFillLight(state, 130, 12, -30, 130, 0, -40);

    // Camera close behind and above, hero car large and centred, beach and
    // sea to the east on the right of the frame, buildings on the sides.
    setCamera(state, 130, 2.4, -13.5, 130, 1.2, -35);

    state.wanted = 0;
    state.money = 18450;
    state.rep = 320;
    state.dialogue = { speaker: '', text: '', visible: false };
    state.objective = { title: 'First Shift', text: 'Drive the package to Pasar Ikan' };
    state.screen = 'play';
    state.started = true;
    state.paused = false;
    showTitle(state, false);
    return;
  }

  if (name === 'foot') {
    state.time.hour = 18.6;
    if (state.timeSys) {
      state.timeSys.rainOn = true;
      if (state.timeSys.rain) state.timeSys.rain.visible = true;
    }

    putPlayerOnFoot(state, 150, -10, Math.PI / 2);

    // Camera close behind the player at eye level, looking north along the
    // beach, so the sea and sand sit on the right and the city on the left.
    setCamera(state, 152, 2.0, -5, 147, 1.2, -32);
    // The opening mission dialogue pops up on the beach, so move it to the
    // top like the cover, where it never covers the courier or the radio.
    moveDialogueTop();

    state.wanted = 1;
    state.dialogue = { speaker: '', text: '', visible: false };
    state.objective = { title: 'First Shift', text: 'Meet Pak Bimo at Pantai Biru' };
    state.screen = 'play';
    state.started = true;
    state.paused = false;
    showTitle(state, false);
    return;
  }

  if (name === 'title') {
    state.time.hour = 18.4;
    state.screen = 'title';
    state.started = false;
    showTitle(state, true);
    // High slow view over the city at sunset, looking east toward the sea.
    setCamera(state, -40, 42, 130, 180, 8, -10);
    return;
  }
}
