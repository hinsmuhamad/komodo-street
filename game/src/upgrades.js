// upgrades.js
// Komodo Street. The Tanjung Senja workshop. Engine levels make the car
// faster, armour plating soaks up damage, and the safehouse unlocks a save
// point in Kota Lama that heals the player on visit. The garage opens only
// near the workshop, with G, and buying writes straight into the player
// state so player.js can read engineLevel and drive accordingly.

import { dist2D } from './util.js';

export const GARAGE_POINT = { x: 120, z: 150 };
export const SAFEHOUSE_POINT = { x: -210, z: 120 };
const GARAGE_RANGE = 8;
const SAFEHOUSE_RANGE = 8;

export const UPGRADES = [
  { id: 'engine-1', name: 'Engine Level 1', price: 800, desc: 'Better top speed and acceleration.' },
  { id: 'engine-2', name: 'Engine Level 2', price: 2000, desc: 'Much better top speed and acceleration.' },
  { id: 'engine-3', name: 'Engine Level 3', price: 4000, desc: 'The fastest engine in Vellora.' },
  { id: 'armour', name: 'Armour Plating', price: 1000, desc: '+50 armour for you and the car.' },
  { id: 'safehouse', name: 'Safehouse', price: 5000, desc: 'A save point at Kota Lama that heals you on visit.' },
];

function keyPressed(input, code, key) {
  if (!input || !input.pressed) return false;
  const p = input.pressed;
  if (typeof p.has === 'function') return p.has(code) || p.has(key);
  if (Array.isArray(p)) return p.includes(code) || p.includes(key);
  return !!p[code] || !!p[key];
}

function renderGarageList(state) {
  if (typeof document === 'undefined') return;
  const list = document.getElementById('garage-list');
  if (!list) return;
  const owned = (state.upgrades && state.upgrades.owned) || [];
  list.innerHTML = '';
  UPGRADES.forEach((up, index) => {
    const isOwned = owned.includes(up.id);
    const row = document.createElement('div');
    row.className = 'garage-row';
    const name = document.createElement('span');
    name.textContent = up.name + ' ' + up.desc;
    const price = document.createElement('span');
    price.textContent = isOwned ? 'Owned' : '$' + up.price;
    const button = document.createElement('button');
    button.textContent = isOwned ? 'Owned' : 'Buy';
    button.disabled = isOwned;
    button.addEventListener('click', () => buyUpgrade(state, index));
    row.appendChild(name);
    row.appendChild(price);
    row.appendChild(button);
    list.appendChild(row);
  });
}

export function createUpgrades(state) {
  return { owned: [], garageOpen: false };
}

export function toggleGarage(state) {
  const u = state.upgrades;
  if (!u) return;
  const d = dist2D(state.player.pos.x, state.player.pos.z, GARAGE_POINT.x, GARAGE_POINT.z);
  if (d > GARAGE_RANGE) {
    state.ui.notice = 'Come to the Tanjung Senja workshop to open the garage.';
    return;
  }
  if (state.screen === 'garage') {
    state.screen = 'play';
    u.garageOpen = false;
    if (typeof document !== 'undefined') {
      const screen = document.getElementById('garage-screen');
      if (screen) screen.style.display = 'none';
    }
    return;
  }
  state.screen = 'garage';
  u.garageOpen = true;
  renderGarageList(state);
  if (typeof document !== 'undefined') {
    const screen = document.getElementById('garage-screen');
    if (screen) screen.style.display = 'block';
  }
}

export function buyUpgrade(state, index) {
  const u = state.upgrades;
  if (!u) return;
  const up = UPGRADES[index];
  if (!up) return;
  if (u.owned.includes(up.id)) {
    state.ui.notice = 'You already own ' + up.name + '.';
    return;
  }
  if (up.id === 'engine-2' && !u.owned.includes('engine-1')) {
    state.ui.notice = 'Buy Engine Level 1 first.';
    return;
  }
  if (up.id === 'engine-3' && !u.owned.includes('engine-2')) {
    state.ui.notice = 'Buy Engine Level 2 first.';
    return;
  }
  if (state.money < up.price) {
    state.ui.notice = 'Not enough money';
    return;
  }
  state.money -= up.price;
  u.owned.push(up.id);
  if (up.id === 'engine-1') state.player.engineLevel = 1;
  if (up.id === 'engine-2') state.player.engineLevel = 2;
  if (up.id === 'engine-3') state.player.engineLevel = 3;
  if (up.id === 'armour') {
    const max = (state.player.maxArmour || 100);
    state.player.armour = Math.min(max, (state.player.armour || 0) + 50);
  }
  if (up.id === 'safehouse') state.safehouse = true;
  state.ui.notice = 'Bought ' + up.name + '!';
  renderGarageList(state);
}

export function updateUpgrades(state, u, dt) {
  if (!state.started || state.paused) return;
  if (!u) return;
  if (keyPressed(state.input, 'KeyG', 'g')) toggleGarage(state);
  if (state.safehouse) {
    const d = dist2D(state.player.pos.x, state.player.pos.z, SAFEHOUSE_POINT.x, SAFEHOUSE_POINT.z);
    if (d <= SAFEHOUSE_RANGE && state.player.health < (state.player.maxHealth || 100)) {
      state.player.health = Math.min(
        state.player.maxHealth || 100,
        state.player.health + 8 * dt,
      );
    }
  }
}
