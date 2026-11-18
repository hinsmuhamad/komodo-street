// hud.js
// Komodo Street. Heads up display: money, rep, health, armour, wanted
// stars, clock, district, speed, collectibles, objective, dialogue,
// notice, and a live minimap drawn on the 180 by 160 canvas.

import { CONFIG, districtAt, repNameFor } from './config.js';
import { clamp, dist2D, formatClock, formatMoney } from './util.js';

const POLICE_NAMES = ['GARUDA-1', 'KOMODO-2', 'ELANG-3', 'BAYU-4', 'SRIKANDI-5'];

const MAP_W = 180;
const MAP_H = 160;
const MAP_SCALE = 0.3;
const MAP_OY = 20;

function mapX(x) {
  return (x + 260) * MAP_SCALE;
}

function mapY(z) {
  return (z + 200) * MAP_SCALE + MAP_OY;
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

function targetXY(t) {
  if (!t) return null;
  if (t.vehicle && t.vehicle.pos) return { x: t.vehicle.pos.x, z: t.vehicle.pos.z };
  if (t.pos) return { x: t.pos.x, z: t.pos.z };
  if (t.position) return { x: t.position.x, z: t.position.z };
  if (t.group && t.group.position) return { x: t.group.position.x, z: t.group.position.z };
  if (t.x !== undefined && t.z !== undefined) return { x: t.x, z: t.z };
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

export function createHud(state) {
  const get = (id) => document.getElementById(id);
  const hud = {
    money: get('money'),
    repName: get('rep-name'),
    repFill: get('rep-fill'),
    healthFill: get('health-fill'),
    armourFill: get('armour-fill'),
    conditionFill: get('condition-fill'),
    conditionPct: get('condition-pct'),
    weapons: Array.from(document.querySelectorAll('#weapons .weapon')),
    policeList: get('police-list'),
    policeCount: get('police-count'),
    policeRows: get('police-rows'),
    radioStation: get('radio-station'),
    radioSong: get('radio-song'),
    wanted: get('wanted'),
    clock: get('clock'),
    district: get('district'),
    minimap: get('minimap'),
    objectiveText: get('objective-text'),
    speed: get('speed-num'),
    carName: get('carname'),
    collectibles: get('collectibles'),
    notice: get('notice'),
    dialogue: get('dialogue'),
    dialogueName: get('dialogue-name'),
    dialogueText: get('dialogue-text'),
    frame: 0,
    ctx: null,
  };
  if (hud.minimap) hud.ctx = hud.minimap.getContext('2d');
  return hud;
}

function drawMinimap(state, hud) {
  const ctx = hud.ctx;
  if (!ctx) return;
  const p = state.player;

  ctx.fillStyle = '#101418';
  ctx.fillRect(0, 0, MAP_W, MAP_H);

  // Sea on the right, beach strip next to it.
  ctx.fillStyle = '#1c5f7a';
  ctx.fillRect(mapX(178), MAP_OY, MAP_W - mapX(178), 120);
  ctx.fillStyle = '#c9b078';
  ctx.fillRect(mapX(140), MAP_OY, mapX(178) - mapX(140), 120);

  // District ground tints.
  for (const d of CONFIG.districts) {
    ctx.fillStyle = '#' + d.ground.toString(16).padStart(6, '0');
    ctx.globalAlpha = 0.55;
    ctx.fillRect(mapX(d.minX), mapY(d.minZ), (d.maxX - d.minX) * MAP_SCALE, (d.maxZ - d.minZ) * MAP_SCALE);
    ctx.globalAlpha = 1;
  }

  // Roads.
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const ax of CONFIG.city.avenues) {
    ctx.moveTo(mapX(ax), mapY(-200));
    ctx.lineTo(mapX(ax), mapY(200));
  }
  for (const sz of CONFIG.city.streets) {
    ctx.moveTo(mapX(-260), mapY(sz));
    ctx.lineTo(mapX(180), mapY(sz));
  }
  ctx.stroke();

  // Buildings as small dots.
  const buildings = (state.city && state.city.buildings) || [];
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const b of buildings) {
    const xy = targetXY(b) || (b.minX !== undefined
      ? { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 }
      : null);
    if (!xy) continue;
    ctx.fillRect(mapX(xy.x) - 1, mapY(xy.z) - 1, 2, 2);
  }

  // Unfound collectibles as tiny gold dots.
  ctx.fillStyle = '#ffd23d';
  for (const c of collectibleList(state)) {
    if (c.found) continue;
    const xy = targetXY(c);
    if (!xy) continue;
    ctx.fillRect(mapX(xy.x) - 1, mapY(xy.z) - 1, 2, 2);
  }

  // Mission target as a gold diamond.
  const t = targetXY(missionTarget(state));
  if (t) {
    const tx = mapX(t.x);
    const ty = mapY(t.z);
    ctx.fillStyle = '#ffd23d';
    ctx.beginPath();
    ctx.moveTo(tx, ty - 5);
    ctx.lineTo(tx + 5, ty);
    ctx.lineTo(tx, ty + 5);
    ctx.lineTo(tx - 5, ty);
    ctx.closePath();
    ctx.fill();
  }

  // Police units as red dots.
  const units = (state.police && state.police.units) || [];
  ctx.fillStyle = '#ff4a3c';
  for (const u of units) {
    const xy = targetXY(u);
    if (!xy) continue;
    ctx.beginPath();
    ctx.arc(mapX(xy.x), mapY(xy.z), 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Player as a white arrow rotated by heading.
  if (p && p.pos) {
    const px = mapX(p.pos.x);
    const py = mapY(p.pos.z);
    const fx = Math.cos(p.heading);
    const fz = -Math.sin(p.heading);
    const angle = Math.atan2(fx, -fz);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 5);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

export function updateHud(state, hud, dt) {
  if (!hud) return;
  hud.frame = (hud.frame || 0) + 1;
  const p = state.player || {};

  if (hud.money) hud.money.textContent = formatMoney(state.money || 0);

  const rep = state.rep || 0;
  if (hud.repName) hud.repName.textContent = repNameFor(rep);
  if (hud.repFill) {
    const levels = CONFIG.repLevels;
    let cur = levels[0];
    let next = null;
    for (let i = 0; i < levels.length; i++) {
      if (rep >= levels[i].threshold) {
        cur = levels[i];
        next = levels[i + 1] || null;
      }
    }
    const pct = next
      ? ((rep - cur.threshold) / (next.threshold - cur.threshold)) * 100
      : 100;
    hud.repFill.style.width = clamp(pct, 0, 100) + '%';
  }

  if (hud.healthFill) {
    hud.healthFill.style.width = clamp(p.health || 0, 0, 100) + '%';
  }
  if (hud.armourFill) {
    hud.armourFill.style.width = clamp(p.armour || 0, 0, 100) + '%';
  }

  // Car condition: the hero car carries a condition value, other cars
  // read as full. Shown as a bar plus a percent, like the top entries.
  if (hud.conditionFill) {
    const cond = p.vehicle && typeof p.vehicle.condition === 'number'
      ? p.vehicle.condition
      : 100;
    hud.conditionFill.style.width = clamp(cond, 0, 100) + '%';
    if (hud.conditionPct) hud.conditionPct.textContent = Math.round(cond) + '%';
  }

  // Weapon loadout: highlight the selected slot, the rest stay dim.
  if (hud.weapons && hud.weapons.length > 0) {
    const selected = state.loadout && typeof state.loadout.selected === 'number'
      ? state.loadout.selected
      : 0;
    for (let i = 0; i < hud.weapons.length; i++) {
      hud.weapons[i].classList.toggle('selected', i === selected);
    }
  }

  if (hud.wanted) {
    const wanted = clamp(state.wanted || 0, 0, 5);
    let stars = '';
    for (let i = 0; i < 5; i++) {
      stars += i < wanted ? '<span>&#9733;</span>' : '<span class="off">&#9733;</span>';
    }
    hud.wanted.innerHTML = stars;
  }

  // Police response list: one row per active unit with its call sign,
  // live distance from the player, and a status tag. Hidden when no unit
  // is chasing, so the left column stays clean in free roam.
  if (hud.policeList) {
    const units = (state.police && state.police.units) || [];
    const wanted = clamp(state.wanted || 0, 0, 5);
    if (wanted > 0 && units.length > 0 && p.pos) {
      hud.policeList.classList.add('show');
      if (hud.policeCount) {
        hud.policeCount.textContent = units.length + (units.length === 1 ? ' UNIT' : ' UNITS');
      }
      if (hud.policeRows) {
        let rows = '';
        for (let i = 0; i < units.length; i++) {
          const u = units[i];
          const name = (u && u.name) || POLICE_NAMES[i % POLICE_NAMES.length];
          const xy = u && u.vehicle ? targetXY(u.vehicle) : null;
          const dist = xy ? Math.round(dist2D(xy.x, xy.z, p.pos.x, p.pos.z)) : 0;
          let status = (u && u.status) || '';
          if (!status) status = dist < 12 ? 'RAMMING' : (dist < 25 ? 'PURSUIT' : 'ROADBLOCK');
          const tagClass = status === 'RAMMING' ? 'ramming' : (status === 'PURSUIT' ? 'pursuit' : 'roadblock');
          rows += '<div class="pl-row"><span class="pl-name">' + name + '</span>'
            + '<span class="pl-dist">' + dist + ' m</span>'
            + '<span class="tag ' + tagClass + '">' + status + '</span></div>';
        }
        hud.policeRows.innerHTML = rows;
      }
    } else {
      hud.policeList.classList.remove('show');
    }
  }

  // Radio: station and track line, bottom right above the speed.
  if (hud.radioStation && state.radio) {
    hud.radioStation.innerHTML = '&#9834; ' + state.radio.station + ' - ' + state.radio.program;
  }
  if (hud.radioSong && state.radio) {
    hud.radioSong.textContent = state.radio.song + ' - ' + state.radio.artist;
  }

  if (hud.clock) hud.clock.textContent = formatClock(state.time ? state.time.hour : 18.4);
  if (hud.district && p.pos) {
    hud.district.textContent = districtAt(p.pos.x, p.pos.z).name;
  }

  if (hud.speed) {
    const moving = Math.abs(p.speed || 0) > 0.1;
    const kmh = moving ? Math.round(Math.abs(p.speed) * 3.6) : 0;
    hud.speed.innerHTML = kmh + ' <small>km/h</small>';
  }

  // Car name above the speed, shown only when the current vehicle has a
  // name. The staged hero car is the KOMODO GT.
  if (hud.carName) {
    const name = p.vehicle && p.vehicle.name ? p.vehicle.name : '';
    hud.carName.textContent = name;
    hud.carName.style.display = name ? 'block' : 'none';
  }

  if (hud.collectibles) {
    const found = state.stats ? state.stats.collectiblesFound || 0 : 0;
    const total = state.stats
      ? state.stats.collectiblesTotal || CONFIG.collectiblesTotal
      : CONFIG.collectiblesTotal;
    hud.collectibles.textContent = 'Komodo coins ' + found + ' / ' + total;
  }

  if (hud.objectiveText && state.objective) {
    hud.objectiveText.textContent = state.objective.title
      ? state.objective.title + ': ' + state.objective.text
      : state.objective.text || '';
  }

  if (hud.dialogue) {
    const d = state.dialogue;
    if (d && d.visible) {
      hud.dialogue.style.display = 'flex';
      if (hud.dialogueName) hud.dialogueName.textContent = d.speaker || '';
      if (hud.dialogueText) hud.dialogueText.textContent = d.text || '';
    } else {
      hud.dialogue.style.display = 'none';
    }
  }

  if (hud.notice && state.ui) {
    if (state.ui.noticeTimer > 0) {
      hud.notice.textContent = state.ui.notice || '';
      hud.notice.style.opacity = String(clamp(state.ui.noticeTimer, 0, 1));
      state.ui.noticeTimer -= dt || 0.016;
    } else {
      hud.notice.textContent = '';
      hud.notice.style.opacity = '0';
    }
  }

  if (hud.frame % 2 === 0) drawMinimap(state, hud);
}
