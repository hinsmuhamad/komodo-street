// map.js
// Komodo Street. Full screen map on KeyM. Draws the six districts, roads,
// beach and sea, the player, the mission target, collectible dots, and the
// safehouse marker. Redraws at most every 100 ms while open.

import { CONFIG } from './config.js';

function css(hex) {
  return '#' + hex.toString(16).padStart(6, '0');
}

function targetXY(t) {
  if (!t) return null;
  if (t.vehicle && t.vehicle.pos) return { x: t.vehicle.pos.x, z: t.vehicle.pos.z };
  if (t.pos) return { x: t.pos.x, z: t.pos.z };
  if (t.position) return { x: t.position.x, z: t.position.z };
  if (t.group && t.group.position) return { x: t.group.position.x, z: t.group.position.z };
  if (t.x !== undefined && t.z !== undefined) return { x: t.x, z: t.z };
  return null;
}

function missionTarget(state) {
  if (state.missions && state.missions.target) return state.missions.target;
  if (state.missions && state.missions.current && state.missions.current.target) {
    return state.missions.current.target;
  }
  if (state.missions && state.missions.beacon && state.missions.active) {
    return state.missions.beacon;
  }
  if (state.missionTarget) return state.missionTarget;
  if (state.objective && state.objective.target) return state.objective.target;
  return null;
}

function collectibleList(state) {
  if (state.collectibles && Array.isArray(state.collectibles.items)) {
    return state.collectibles.items;
  }
  if (state.collectibles && Array.isArray(state.collectibles.coins)) {
    return state.collectibles.coins;
  }
  if (Array.isArray(state.collectibles)) return state.collectibles;
  return [];
}

export function createMap(state) {
  const canvas = document.getElementById('map-canvas');
  return {
    canvas,
    ctx: canvas ? canvas.getContext('2d') : null,
    screen: document.getElementById('map-screen'),
    lastDraw: 0,
  };
}

export function toggleMap(state) {
  const pressed = state.input ? state.input.pressed : null;
  if (!pressed || !pressed.has('KeyM')) return;
  pressed.delete('KeyM');
  const screen = document.getElementById('map-screen');
  if (state.screen === 'play') {
    state.screen = 'map';
    if (screen) screen.classList.add('show');
  } else if (state.screen === 'map') {
    state.screen = 'play';
    if (screen) screen.classList.remove('show');
  }
}

function drawMap(state, mapSys) {
  const ctx = mapSys.ctx;
  if (!ctx) return;
  const W = 640;
  const H = 560;
  const S = 1.0;
  const OX = 20;
  const OY = 80;
  const mx = (x) => OX + (x + 260) * S;
  const my = (z) => OY + (z + 200) * S;

  ctx.fillStyle = '#101418';
  ctx.fillRect(0, 0, W, H);

  // Sea and beach.
  ctx.fillStyle = '#1c5f7a';
  ctx.fillRect(mx(178), my(-200), (340 - 178) * S, 400 * S);
  ctx.fillStyle = '#c9b078';
  ctx.fillRect(mx(140), my(-200), (178 - 140) * S, 400 * S);

  // District rectangles with names.
  ctx.textAlign = 'center';
  for (const d of CONFIG.districts) {
    ctx.fillStyle = css(d.ground);
    ctx.fillRect(mx(d.minX), my(d.minZ), (d.maxX - d.minX) * S, (d.maxZ - d.minZ) * S);
    ctx.strokeStyle = css(d.accent);
    ctx.lineWidth = 2;
    ctx.strokeRect(mx(d.minX), my(d.minZ), (d.maxX - d.minX) * S, (d.maxZ - d.minZ) * S);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 15px Arial, sans-serif';
    ctx.fillText(
      d.name,
      mx((d.minX + d.maxX) / 2),
      my((d.minZ + d.maxZ) / 2)
    );
  }

  // Roads.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (const ax of CONFIG.city.avenues) {
    ctx.moveTo(mx(ax), my(-200));
    ctx.lineTo(mx(ax), my(200));
  }
  for (const sz of CONFIG.city.streets) {
    ctx.moveTo(mx(-260), my(sz));
    ctx.lineTo(mx(180), my(sz));
  }
  ctx.stroke();

  // Buildings as small dots.
  const buildings = (state.city && state.city.buildings) || [];
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  for (const b of buildings) {
    const xy = targetXY(b) || (b.minX !== undefined
      ? { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 }
      : null);
    if (!xy) continue;
    ctx.fillRect(mx(xy.x) - 1.5, my(xy.z) - 1.5, 3, 3);
  }

  // Collectible dots.
  ctx.fillStyle = '#ffd23d';
  for (const c of collectibleList(state)) {
    if (c.found) continue;
    const xy = targetXY(c);
    if (!xy) continue;
    ctx.beginPath();
    ctx.arc(mx(xy.x), my(xy.z), 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Safehouse marker.
  if (state.safehouse) {
    const sp = targetXY(state.safehousePos) || { x: -210, z: 120 };
    const sx = mx(sp.x);
    const sy = my(sp.z);
    ctx.fillStyle = '#3ddc5a';
    ctx.fillRect(sx - 7, sy - 7, 14, 14);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillText('SAFEHOUSE', sx, sy - 12);
  }

  // Mission target as a gold diamond.
  const t = targetXY(missionTarget(state));
  if (t) {
    const tx = mx(t.x);
    const ty = my(t.z);
    ctx.fillStyle = '#ffd23d';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx, ty - 10);
    ctx.lineTo(tx + 10, ty);
    ctx.lineTo(tx, ty + 10);
    ctx.lineTo(tx - 10, ty);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffd23d';
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillText('TARGET', tx, ty - 15);
  }

  // Player as a white arrow.
  const p = state.player;
  if (p && p.pos) {
    const px = mx(p.pos.x);
    const py = my(p.pos.z);
    const fx = Math.cos(p.heading);
    const fz = -Math.sin(p.heading);
    const angle = Math.atan2(fx, -fz);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(8, 9);
    ctx.lineTo(0, 5);
    ctx.lineTo(-8, 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillText('YOU', px, py + 24);
  }
}

export function updateMap(state, mapSys, dt) {
  toggleMap(state);
  if (!mapSys || state.screen !== 'map') return;
  const now = (typeof performance !== 'undefined') ? performance.now() : 0;
  if (now - (mapSys.lastDraw || 0) < 100) return;
  mapSys.lastDraw = now;
  drawMap(state, mapSys);
}
