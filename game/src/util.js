// util.js
// Komodo Street. Small math and random helpers shared by every module.
// No dependencies. All randomness in the game flows through mulberry32 so a
// seed reproduces the same city, traffic and collectible layout.

export function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function dist2D(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

// mulberry32: a tiny deterministic PRNG. seed is any integer.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rand, list) {
  return list[Math.floor(rand() * list.length)];
}

export function randRange(rand, min, max) {
  return min + rand() * (max - min);
}

export function randInt(rand, min, max) {
  return min + Math.floor(rand() * (max - min + 1));
}

export function formatMoney(n) {
  return '$' + Math.floor(n).toLocaleString('en-US');
}

export function formatClock(hour) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour % 1) * 60);
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return hh + ':' + mm;
}
