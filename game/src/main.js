// main.js
// Komodo Street. Integration shell. Static imports of all game modules, the
// shared state, the frame loop, input routing, the per frame update order,
// screenshot staging, the title to game transition, a small local save, and
// a simple side job runner. No fallbacks and no module probing: every module
// exists, so the real implementations run.
//
// Frame order: input, then while playing: player, traffic, police,
// helicopter, missions, side jobs, collectibles, rep, time of day, city,
// upgrades, then the HUD, map, and audio, then the render. While paused or
// on the title screen the world effects still run so the sky, lamps, and
// windows stay correct, but gameplay holds its staged position.
//
// ?shot=cover|drive|foot|title (with &seed=N) stages that scene instead of
// running the loop, paints it, and sets window.__shotReady for a screenshot.

import * as THREE from 'three';
import { CONFIG, districtAt, repNameFor } from './config.js';
import { clamp, formatClock, formatMoney } from './util.js';
import { createCity, updateCity } from './city.js';
import { createTimeOfDay, updateTimeOfDay } from './timeofday.js';
import { createTraffic, updateTraffic } from './traffic.js';
import { createPlayer, updatePlayer } from './player.js';
import { createPolice, updatePolice } from './police.js';
import { createHelicopter, updateHelicopter } from './helicopter.js';
import { createMissions, updateMissions, startMission } from './missions.js';
import { createCollectibles, updateCollectibles } from './collectibles.js';
import { createRep, updateRep } from './rep.js';
import { createHud, updateHud } from './hud.js';
import { createMap, updateMap, toggleMap } from './map.js';
import { createUpgrades, updateUpgrades } from './upgrades.js';
import { createAudio, updateAudio, playBlip, playClick } from './audio.js';
import { dismissDialogue } from './dialogue.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : CONFIG.seed;

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a1a2e);
scene.fog = new THREE.Fog(0x2a1a2e, 120, 520);

const camera = new THREE.PerspectiveCamera(CONFIG.player.fov, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(140, 6, 20);

const state = {
  seed,
  config: CONFIG,
  scene,
  camera,
  renderer,
  time: { elapsed: 0, hour: CONFIG.clock.startHour },
  input: { keys: new Set(), pressed: new Set() },
  player: null,
  wanted: 0,
  rep: 0,
  money: 0,
  stats: { missionsDone: 0, sideJobsDone: 0, racesWon: 0, collectiblesFound: 0, collectiblesTotal: CONFIG.collectiblesTotal },
  screen: 'title',
  started: false,
  paused: false,
  ui: { notice: '', noticeTimer: 0 },
  objective: { title: 'First Shift', text: 'Talk to Pak Bimo at Pantai Biru.' },
  dialogue: { speaker: '', text: '', visible: false },
  radio: { station: 'KOMODO FM 88.1', program: 'Senja Drive', song: 'Pantai Biru Nights', artist: 'The Komodos' },
  loadout: { selected: 0 },
  vehicles: [],
  safehouse: false,
  muted: false,
};

// Build the world. Order matters: city first (lamps, colliders), then the
// systems that read it.
state.city = createCity(state);
state.timeSys = createTimeOfDay(state);
state.traffic = createTraffic(state);
state.player = createPlayer(state);
state.police = createPolice(state);
state.heli = createHelicopter(state);
state.missions = createMissions(state);
state.collectibles = createCollectibles(state);
state.repSys = createRep(state);
state.hud = createHud(state);
state.mapSys = createMap(state);
state.upgradesSys = createUpgrades(state);
state.audioSys = createAudio(state);

// Small local save: money, rep, missions done, collectibles found.
const SAVE_KEY = 'komodo-street-save-v1';
function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (typeof data.money === 'number') state.money = data.money;
    if (typeof data.rep === 'number') state.rep = data.rep;
    if (typeof data.missionsDone === 'number') state.stats.missionsDone = data.missionsDone;
    if (typeof data.collectiblesFound === 'number') state.stats.collectiblesFound = data.collectiblesFound;
  } catch {
    // A bad save is ignored; the game starts fresh.
  }
}
function saveGame() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: state.money,
      rep: state.rep,
      missionsDone: state.stats.missionsDone,
      collectiblesFound: state.stats.collectiblesFound,
    }));
  } catch {
    // Storage can be off; the game keeps running.
  }
}
loadSave();

// Simple side job runner: two pickup points, E to start, drive to the
// destination, get paid. Express has a 90 second timer.
const SIDE_JOB_POINTS = [
  { id: 'passenger', name: 'Becak Passenger', x: -20, z: 100, destX: 120, destZ: -120, pay: CONFIG.sideJobPay.passenger, timer: 0 },
  { id: 'express', name: 'Express Delivery', x: 0, z: -150, destX: -180, destZ: 150, pay: CONFIG.sideJobPay.express, timer: 90 },
];
const sideJob = { active: null, marker: null, timerLeft: 0 };
function sideJobMarker(x, z, color) {
  const geo = new THREE.CylinderGeometry(1.6, 1.6, 0.15, 20);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, 0.1, z);
  scene.add(mesh);
  return mesh;
}
function updateSideJobs(stateArg, dt) {
  const p = stateArg.player;
  if (!p || !stateArg.started || stateArg.paused) return;
  if (stateArg.screen !== 'play') return;
  if (!sideJob.active) {
    if (stateArg.input.pressed.has('KeyE') && p.onFoot) {
      for (const point of SIDE_JOB_POINTS) {
        const dx = p.pos.x - point.x;
        const dz = p.pos.z - point.z;
        if (dx * dx + dz * dz < 25) {
          sideJob.active = point;
          sideJob.timerLeft = point.timer;
          sideJob.marker = sideJobMarker(point.destX, point.destZ, 0xffd23d);
          stateArg.objective = { title: point.name, text: 'Drive to the gold marker.' };
          stateArg.ui.notice = point.name + ' started!';
          stateArg.ui.noticeTimer = 2.5;
          break;
        }
      }
    }
    return;
  }
  const job = sideJob.active;
  if (job.timer > 0) {
    sideJob.timerLeft -= dt;
    if (sideJob.timerLeft <= 0) {
      stateArg.ui.notice = job.name + ' failed: out of time.';
      stateArg.ui.noticeTimer = 3;
      if (sideJob.marker) scene.remove(sideJob.marker);
      sideJob.active = null;
      sideJob.marker = null;
      stateArg.objective = { title: 'Free Roam', text: 'Collect coins, take side jobs, race at Tanjung Senja.' };
      return;
    }
  }
  const dx = p.pos.x - job.destX;
  const dz = p.pos.z - job.destZ;
  if (dx * dx + dz * dz < 64) {
    stateArg.money += job.pay;
    stateArg.stats.sideJobsDone += 1;
    stateArg.ui.notice = job.name + ' done! +$' + job.pay;
    stateArg.ui.noticeTimer = 3;
    if (sideJob.marker) scene.remove(sideJob.marker);
    sideJob.active = null;
    sideJob.marker = null;
    stateArg.objective = { title: 'Free Roam', text: 'Collect coins, take side jobs, race at Tanjung Senja.' };
    playBlip(stateArg);
    saveGame();
  }
}

// Input.
window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  state.input.keys.add(event.code);
  state.input.pressed.add(event.code);
  if (event.code === 'KeyM') toggleMap(state);
  if (event.code === 'KeyP') {
    if (state.screen === 'play') {
      state.screen = 'paused';
      state.paused = true;
      const el = document.getElementById('pause-screen');
      if (el) el.classList.add('show');
    } else if (state.screen === 'paused') {
      state.screen = 'play';
      state.paused = false;
      const el = document.getElementById('pause-screen');
      if (el) el.classList.remove('show');
    }
  }
  if (event.code === 'KeyR') {
    state.muted = !state.muted;
    if (state.audioSys && state.audioSys.master) state.audioSys.master.gain.value = state.muted ? 0 : 0.35;
  }
  if (event.code === 'KeyE' && state.dialogue.visible) dismissDialogue(state);
});
window.addEventListener('keyup', (event) => {
  state.input.keys.delete(event.code);
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const startButton = document.getElementById('title-start');
if (startButton) {
  startButton.addEventListener('click', () => {
    const el = document.getElementById('title-screen');
    if (el) el.classList.remove('show');
    state.screen = 'play';
    state.started = true;
    if (state.audioSys && state.audioSys.start) state.audioSys.start();
    playClick(state);
  });
}

function update(dt) {
  state.time.elapsed += dt;
  updateTimeOfDay(state, state.timeSys, dt);
  updateCity(state, state.city, dt);
  updateTraffic(state, state.traffic, dt);
  if (state.started && !state.paused && state.screen === 'play') {
    updatePlayer(state, state.player, dt);
    updatePolice(state, state.police, dt);
    updateHelicopter(state, state.heli, dt);
    updateMissions(state, state.missions, dt);
    updateSideJobs(state, dt);
    updateCollectibles(state, state.collectibles, dt);
    updateRep(state, state.repSys, dt);
    updateUpgrades(state, state.upgradesSys, dt);
  } else {
    updatePlayer(state, state.player, 0);
  }
  updateHud(state, state.hud, dt);
  updateMap(state, state.mapSys, dt);
  updateAudio(state, state.audioSys, dt);
  if (state.ui.noticeTimer > 0) {
    state.ui.noticeTimer -= dt;
    if (state.ui.noticeTimer <= 0) state.ui.notice = '';
  }
  state.input.pressed.clear();
}

// Screenshot staging: place the cast and camera, render, signal ready.
if (shotName) {
  applyShot(state, shotName);
  update(0.016);
  renderer.render(scene, camera);
  update(0.016);
  renderer.render(scene, camera);
  window.__shotReady = true;
} else {
  let last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    if (dt <= 0) return;
    update(dt);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(loop);
}
