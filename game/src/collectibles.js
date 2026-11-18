// collectibles.js
// Komodo Street. 24 Komodo coins hidden across all six districts. Each coin
// is a gold torus with a soft glow, spinning and bobbing where a player on
// foot can reach it: near shops, along sidewalks, and out on the beach sand.
// Positions come from a seeded RNG, so every run hides them in the same
// places and a guide can be written for them.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { dist2D, mulberry32, randRange } from './util.js';

const COIN_COUNT = 24;
const COLLECT_RADIUS = 2;
const COIN_VALUE = 50;
const ALL_COINS_BONUS = 1000;

function makeGlowTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255, 220, 120, 0.9)');
  gradient.addColorStop(0.4, 'rgba(255, 190, 60, 0.35)');
  gradient.addColorStop(1, 'rgba(255, 190, 60, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

function makeCoin(glowTexture) {
  const group = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({
    color: 0xffc93c,
    metalness: 0.85,
    roughness: 0.3,
    emissive: 0x664400,
    emissiveIntensity: 0.5,
  });
  const torus = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.18, 12, 24), gold);
  group.add(torus);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), gold);
  group.add(hub);
  const spriteMat = new THREE.SpriteMaterial({
    map: glowTexture,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const glow = new THREE.Sprite(spriteMat);
  glow.scale.set(2.4, 2.4, 1);
  group.add(glow);
  return group;
}

export function createCollectibles(state) {
  const rand = mulberry32(CONFIG.seed + 99);
  const glowTexture = makeGlowTexture();
  const coins = [];
  const avenues = CONFIG.city.avenues;

  for (let i = 0; i < COIN_COUNT; i++) {
    const district = CONFIG.districts[i % CONFIG.districts.length];
    let x;
    let z;
    const onBeach = district.id === 'pantai' && Math.floor(i / 6) % 2 === 0;
    if (onBeach) {
      x = randRange(rand, 145, 175);
      z = randRange(rand, district.minZ + 10, district.maxZ - 10);
    } else {
      const inDistrict = avenues.filter((ax) => ax > district.minX + 5 && ax < district.maxX - 5);
      const avenue = inDistrict.length > 0
        ? inDistrict[Math.floor(rand() * inDistrict.length)]
        : (district.minX + district.maxX) / 2;
      x = avenue + 6;
      z = randRange(rand, district.minZ + 10, district.maxZ - 10);
    }
    const group = makeCoin(glowTexture);
    const baseY = 1.3;
    group.position.set(x, baseY, z);
    state.scene.add(group);
    coins.push({ group, baseY, phase: rand() * Math.PI * 2, found: false });
  }

  state.stats.collectiblesTotal = COIN_COUNT;
  return { coins };
}

export function updateCollectibles(state, c, dt) {
  if (!state.started || state.paused) return;
  if (!c || !c.coins) return;
  for (const coin of c.coins) {
    if (coin.found) continue;
    coin.group.rotation.y += dt * 2.2;
    coin.group.position.y = coin.baseY + Math.sin(state.time.elapsed * 2 + coin.phase) * 0.25;
    const d = dist2D(
      state.player.pos.x,
      state.player.pos.z,
      coin.group.position.x,
      coin.group.position.z,
    );
    if (d > COLLECT_RADIUS) continue;
    coin.found = true;
    coin.group.visible = false;
    state.stats.collectiblesFound += 1;
    state.money += COIN_VALUE;
    const found = state.stats.collectiblesFound;
    if (found >= COIN_COUNT) {
      state.money += ALL_COINS_BONUS;
      state.ui.notice = 'All Komodo coins found! +$' + ALL_COINS_BONUS;
    } else {
      state.ui.notice = 'Komodo coin! ' + found + ' / ' + COIN_COUNT;
    }
  }
}
