// timeofday.js
// Komodo Street. Sunset clock: the sun drops over the sea to the east,
// the sky slides from warm orange toward deep purple, lamps and windows
// glow at dusk, and fine rain streaks fall between 18.3 and 20.0.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { clamp, lerp } from './util.js';

const RAIN_COUNT = 800;
const RAIN_BOX = 34;
const RAIN_HEIGHT = 30;
const SKY_DUSK = new THREE.Color(0xff8c42);
const SKY_NIGHT = new THREE.Color(0x2a1a4a);

function buildRain() {
  const positions = new Float32Array(RAIN_COUNT * 2 * 3);
  const drops = [];
  for (let i = 0; i < RAIN_COUNT; i++) {
    drops.push({
      x: (Math.random() - 0.5) * RAIN_BOX * 2,
      y: Math.random() * RAIN_HEIGHT,
      z: (Math.random() - 0.5) * RAIN_BOX * 2,
      len: 0.7 + Math.random() * 0.6,
      speed: 20 + Math.random() * 10,
    });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({
    color: 0xa8c4d8,
    transparent: true,
    opacity: 0.4,
  });
  const rain = new THREE.LineSegments(geo, mat);
  rain.visible = false;
  rain.frustumCulled = false;
  return { rain, drops, positions };
}

export function createTimeOfDay(state) {
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.2);
  sun.position.set(200, 40, -20);
  state.scene.add(sun);
  if (sun.target) state.scene.add(sun.target);

  const hemi = new THREE.HemisphereLight(0xffb37a, 0x3a2a3a, 0.7);
  state.scene.add(hemi);

  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(26, 48),
    new THREE.MeshBasicMaterial({
      color: 0xff4a12,
      fog: false,
      transparent: true,
      opacity: 1,
      toneMapped: false,
    })
  );
  sunDisc.position.set(320, 30, -120);
  sunDisc.scale.set(1.4, 1.4, 1.4);
  state.scene.add(sunDisc);

  // Gradient sky dome, deep violet at the top fading through magenta to
  // warm orange at the horizon, so the sky is never one flat color. The
  // dome is BackSide with fog off, so it reads as sky from every camera
  // angle and the fog still hazes the ground toward the horizon.
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 4;
  skyCanvas.height = 256;
  const sctx = skyCanvas.getContext('2d');
  const grad = sctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#2a1650');
  grad.addColorStop(0.32, '#8a3a6e');
  grad.addColorStop(0.55, '#ff7a5c');
  grad.addColorStop(0.78, '#ff9a5c');
  grad.addColorStop(1, '#ffb37a');
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 4, 256);
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(880, 24, 16),
    new THREE.MeshBasicMaterial({
      map: skyTex, side: THREE.BackSide, fog: false,
      depthWrite: false, toneMapped: false,
    })
  );
  state.scene.add(skyDome);
  state.scene.background = null;

  const rainBuilt = buildRain();
  state.scene.add(rainBuilt.rain);

  const sky = SKY_DUSK.clone();
  state.scene.background = null;
  if (!state.scene.fog) {
    state.scene.fog = new THREE.Fog(0xff8c42, 120, 460);
  }

  const t = {
    sun,
    hemi,
    sunDisc,
    rain: rainBuilt.rain,
    rainDrops: rainBuilt.drops,
    rainPositions: rainBuilt.positions,
    rainOn: false,
    lamps: [],
    sky,
  };
  state.timeSys = t;
  return t;
}

function setGlow(list, on) {
  for (const m of list || []) {
    if (!m || !m.material) continue;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      if (mat && mat.emissive) {
        mat.emissiveIntensity = on ? 1.6 : 0.05;
      }
    }
  }
}

export function updateTimeOfDay(state, t, dt) {
  if (!t) return;
  dt = Math.min(dt || 0.016, 0.05);

  state.time.hour += dt * CONFIG.clock.minutesPerSecond / 60;
  if (state.time.hour >= 24) state.time.hour -= 24;

  if (state.shot === 'cover') {
    state.time.hour = 18.4;
    t.rainOn = false;
  } else if (state.shot === 'foot') {
    t.rainOn = true;
  }

  const hour = state.time.hour;
  const f = clamp((hour - 18.2) / 1.8, 0, 1);

  // Sun elevation: low over the sea at 18.4, sinking below the horizon by 20.0.
  const elevDeg = lerp(14, -3, f);
  const elev = (elevDeg * Math.PI) / 180;
  const sunDir = new THREE.Vector3(Math.cos(elev), Math.sin(elev), 0.08).normalize();
  t.sun.position.set(sunDir.x * 220, Math.max(sunDir.y * 220, 6), sunDir.z * 220);
  t.sun.intensity = lerp(2.2, 0.9, f);
  t.sun.color.setHex(f < 0.5 ? 0xffd9a0 : 0xff9a7a);
  if (t.sun.target) {
    t.sun.target.position.set(0, 0, 0);
    t.sun.target.updateMatrixWorld();
  }

  t.sky.copy(SKY_DUSK).lerp(SKY_NIGHT, f);
  // The gradient dome owns the sky now, so the background stays null and
  // only the fog color follows the dusk slide.
  if (state.scene.fog) state.scene.fog.color.copy(t.sky);
  t.hemi.intensity = lerp(0.7, 0.45, f);

  // Big low sun disc over the sea, always facing the camera. It sits
  // north of east so it reads in the cover frame, upper right over the
  // water, and near the centre of the high title view.
  t.sunDisc.position.set(320, lerp(34, 8, f), -120);
  const discScale = lerp(1.4, 1.7, f);
  t.sunDisc.scale.set(discScale, discScale, discScale);
  if (state.camera) t.sunDisc.lookAt(state.camera.position);

  // Dusk lamps and windows.
  const dusk = hour >= CONFIG.clock.duskStartHour;
  const lamps = (state.city && state.city.lamps) || t.lamps || [];
  const windows = (state.city && state.city.windows) || [];
  setGlow(lamps, dusk);
  setGlow(windows, dusk);

  // Rain: fine thin streaks, only inside the rain window, or forced by foot shot.
  // Cover, drive, and title shots are dry; only the foot shot forces rain on.
  let rainOn = hour >= CONFIG.clock.rainStartHour && hour < CONFIG.clock.rainEndHour;
  if (state.shot === 'cover' || state.shot === 'drive' || state.shot === 'title') rainOn = false;
  if (state.shot === 'foot') rainOn = true;
  t.rainOn = rainOn;
  t.rain.visible = rainOn;

  if (rainOn && state.camera) {
    t.rain.position.set(state.camera.position.x, 0, state.camera.position.z);
    const pos = t.rainPositions;
    for (let i = 0; i < t.rainDrops.length; i++) {
      const d = t.rainDrops[i];
      d.y -= d.speed * dt;
      if (d.y < 0) {
        d.y += RAIN_HEIGHT;
        d.x = (Math.random() - 0.5) * RAIN_BOX * 2;
        d.z = (Math.random() - 0.5) * RAIN_BOX * 2;
      }
      const o = i * 6;
      pos[o] = d.x;
      pos[o + 1] = d.y;
      pos[o + 2] = d.z;
      pos[o + 3] = d.x;
      pos[o + 4] = d.y + d.len;
      pos[o + 5] = d.z;
    }
    t.rain.geometry.attributes.position.needsUpdate = true;
  }
}
