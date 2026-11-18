// missions.js
// Komodo Street. Story missions and side jobs. Seven missions form one arc:
// a first shift, a hot delivery, a night run, a dark harbor job, a sunset
// race, a last package, and the ride home. Missions are chains of stage
// targets; reaching a target advances the stage, finishing the last stage
// pays the reward and grows reputation.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { dist2D } from './util.js';
import { showDialogue, DIALOGUE } from './dialogue.js';
import { addRep } from './rep.js';

export const MISSION_DEFS = [
  {
    id: 'first-shift',
    name: 'First Shift',
    briefing: 'Pak Bimo has a package for the fish market. Take it across town before the ice melts.',
    reward: CONFIG.missionRewards[0],
    stages: [
      { text: 'Pick up the package at Pantai Biru', x: 130, z: -60, radius: 8 },
      { text: 'Deliver the package to Pasar Ikan', x: 30, z: 120, radius: 10 },
    ],
  },
  {
    id: 'hot-package',
    name: 'Hot Package',
    briefing: 'A hot package for the harbor, and the buyer will not wait. Fast feet, faster wheels.',
    reward: CONFIG.missionRewards[1],
    timeLimitSeconds: 150,
    stages: [
      { text: 'Grab the hot package at Pantai Biru', x: 130, z: -120, radius: 8 },
      { text: 'Deliver it to Pelabuhan before the timer ends', x: -30, z: -120, radius: 10 },
    ],
  },
  {
    id: 'night-run',
    name: 'Night Run',
    briefing: 'Three checkpoints, one night, no shortcuts. Show the city you know every corner.',
    reward: CONFIG.missionRewards[2],
    stages: [
      { text: 'Checkpoint 1: Bukit Angin', x: -210, z: -120, radius: 10 },
      { text: 'Checkpoint 2: Pelabuhan', x: 30, z: -180, radius: 10 },
      { text: 'Checkpoint 3: Pantai Biru', x: 150, z: -120, radius: 10 },
    ],
  },
  {
    id: 'pelabuhan-gelap',
    name: 'Pelabuhan Gelap',
    briefing: 'A crate at the dark end of the harbor. No questions, no headlights, no police.',
    reward: CONFIG.missionRewards[3],
    stages: [
      { text: 'Pick up the crate at the dark harbor', x: -30, z: -180, radius: 8 },
      { text: 'Smuggle the crate to Kota Lama', x: -150, z: 120, radius: 10 },
    ],
  },
  {
    id: 'balap-senja',
    name: 'Balap Senja',
    briefing: 'Sunset race around Tanjung Senja. Three rivals, one loop, winner takes the street.',
    reward: CONFIG.missionRewards[4],
    stages: [
      { text: 'Race checkpoint 1 of 5', x: 90, z: 60, radius: 12 },
      { text: 'Race checkpoint 2 of 5', x: 130, z: 60, radius: 12 },
      { text: 'Race checkpoint 3 of 5', x: 130, z: 180, radius: 12 },
      { text: 'Race checkpoint 4 of 5', x: 90, z: 180, radius: 12 },
      { text: 'Final checkpoint: finish the loop', x: 90, z: 60, radius: 12 },
    ],
  },
  {
    id: 'paket-terakhir',
    name: 'Paket Terakhir',
    briefing: 'The last package of the day, and the most important one. Tanjung Senja is waiting.',
    reward: CONFIG.missionRewards[5],
    stages: [
      { text: 'Collect the last package at Pasar Ikan', x: 30, z: 60, radius: 8 },
      { text: 'Deliver it to Tanjung Senja', x: 130, z: 150, radius: 10 },
    ],
  },
  {
    id: 'jalan-pulang',
    name: 'Jalan Pulang',
    briefing: 'The sun is down and the work is done. Come home, kid. Dinner is getting cold.',
    reward: CONFIG.missionRewards[6],
    stages: [
      { text: 'Ride through Kota Lama', x: -90, z: 120, radius: 10 },
      { text: 'Park at the safehouse', x: -210, z: 120, radius: 10 },
    ],
  },
];

export const SIDE_JOBS = [
  {
    id: 'passenger',
    name: 'Becak Passenger',
    pay: CONFIG.sideJobPay.passenger,
    text: 'Pick up a passenger and drop them off',
  },
  {
    id: 'express',
    name: 'Express Delivery',
    pay: CONFIG.sideJobPay.express,
    text: 'Deliver a parcel before the timer ends',
  },
];

export const START_POINT = { x: 150, z: 0 };

function makeBeacon() {
  const group = new THREE.Group();
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffb020,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 36, 16, 1, true), beamMat);
  beam.position.y = 18;
  group.add(beam);
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xffd34d });
  const marker = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.6, 4), markerMat);
  marker.rotation.x = Math.PI;
  marker.position.y = 7;
  group.add(marker);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffd34d,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.4, 32), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  group.add(ring);
  group.userData.marker = marker;
  group.userData.beam = beam;
  group.visible = false;
  return group;
}

export function createMissions(state) {
  const beacon = makeBeacon();
  state.scene.add(beacon);
  return {
    index: 0,
    stage: 0,
    active: false,
    done: [],
    beacon,
    timeLeft: 0,
    greeted: false,
    freeRoamSet: false,
  };
}

export function startMission(state, index, missions) {
  const m = missions || state.missions;
  if (!m) return;
  const def = MISSION_DEFS[index];
  if (!def) return;
  m.index = index;
  m.stage = 0;
  m.active = true;
  m.timeLeft = def.timeLimitSeconds || 0;
  const first = def.stages[0];
  m.beacon.position.set(first.x, 0, first.z);
  m.beacon.visible = true;
  state.objective = { title: def.name, text: first.text };
  const lines = DIALOGUE.briefings[def.id];
  if (lines && lines.length > 0) showDialogue(state, 'Pak Bimo', lines[0]);
}

export function updateMissions(state, missions, dt) {
  if (!state.started || state.paused) return;
  if (!missions) return;

  if (missions.beacon.visible) {
    const marker = missions.beacon.userData.marker;
    marker.position.y = 7 + Math.sin(state.time.elapsed * 2) * 0.8;
    marker.rotation.y += dt * 1.5;
    missions.beacon.userData.beam.rotation.y += dt * 0.4;
  }

  if (!missions.active) {
    if (missions.index >= MISSION_DEFS.length) {
      if (!missions.freeRoamSet) {
        state.objective = {
          title: 'Free Roam',
          text: 'Free roam: collect coins, take side jobs, race at Tanjung Senja',
        };
        missions.freeRoamSet = true;
      }
      return;
    }
    state.objective = { title: 'Pak Bimo', text: 'Talk to Pak Bimo' };
    const d = dist2D(state.player.pos.x, state.player.pos.z, START_POINT.x, START_POINT.z);
    if (d < 14 && !missions.greeted) {
      missions.greeted = true;
      const line = DIALOGUE.greetings[missions.index % DIALOGUE.greetings.length];
      showDialogue(state, 'Pak Bimo', line);
    }
    if (d < 6) startMission(state, missions.index, missions);
    return;
  }

  const def = MISSION_DEFS[missions.index];
  const stage = def.stages[missions.stage];

  if (missions.timeLeft > 0) {
    missions.timeLeft -= dt;
    if (missions.timeLeft <= 0) {
      missions.active = false;
      missions.stage = 0;
      missions.beacon.visible = false;
      state.ui.notice = 'Too slow, the package went cold. Talk to Pak Bimo to try again.';
      state.objective = { title: 'Pak Bimo', text: 'Talk to Pak Bimo' };
      return;
    }
  }

  const timeText = missions.timeLeft > 0 ? ' (' + Math.ceil(missions.timeLeft) + 's left)' : '';
  state.objective = { title: def.name, text: stage.text + timeText };

  const d = dist2D(state.player.pos.x, state.player.pos.z, stage.x, stage.z);
  if (d > stage.radius) return;

  if (def.id === 'pelabuhan-gelap' && missions.stage === 0) {
    state.wanted = Math.min(5, (state.wanted || 0) + 2);
    state.ui.notice = 'The police noticed the crate! Lose them and keep driving.';
  } else if (def.id === 'balap-senja') {
    state.ui.notice = 'Checkpoint! Keep pushing, the rivals are right behind you.';
  } else {
    state.ui.notice = 'Stage complete.';
  }

  missions.stage += 1;
  if (missions.stage >= def.stages.length) {
    state.money += def.reward;
    addRep(state, 20 + missions.index * 10);
    state.stats.missionsDone += 1;
    missions.done.push(def.id);
    missions.active = false;
    missions.stage = 0;
    missions.timeLeft = 0;
    missions.beacon.visible = false;
    missions.greeted = false;
    state.ui.notice = 'Mission complete! +$' + def.reward;
    const after = DIALOGUE.after[missions.index];
    if (after) showDialogue(state, 'Pak Bimo', after);
    missions.index += 1;
    if (missions.index >= MISSION_DEFS.length) {
      state.objective = {
        title: 'Free Roam',
        text: 'Free roam: collect coins, take side jobs, race at Tanjung Senja',
      };
      missions.freeRoamSet = true;
    } else {
      state.objective = { title: 'Pak Bimo', text: 'Talk to Pak Bimo' };
    }
    return;
  }

  const next = def.stages[missions.stage];
  missions.beacon.position.set(next.x, 0, next.z);
  state.objective = { title: def.name, text: next.text };
}
