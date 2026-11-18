// textures.js
// Komodo Street. Canvas texture factory. Every texture is drawn fresh on a
// 2D canvas, so the game needs no image files and no network requests.
// All textures use sRGB color space. Tiling textures use repeat wrapping.

import * as THREE from 'three';

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function toCss(color) {
  if (typeof color === 'string') return color;
  const c = new THREE.Color(color);
  return '#' + c.getHexString();
}

function shade(color, amount) {
  const c = new THREE.Color(color);
  c.offsetHSL(0, 0, amount);
  return '#' + c.getHexString();
}

function finish(canvas, repeat) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  tex.anisotropy = 4;
  return tex;
}

function speckle(ctx, w, h, rand, count, colors, alphaMin, alphaMax, sizeMax) {
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const s = 1 + rand() * sizeMax;
    ctx.globalAlpha = alphaMin + rand() * (alphaMax - alphaMin);
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
    ctx.fillRect(x, y, s, s);
  }
  ctx.globalAlpha = 1;
}

// A building facade. Rows of windows, some lit warm, some dark, some with
// the accent color. Darker ground floor with a shop front, door and sign
// band, plus grime streaks so the wall does not read as flat paint. The
// shop name changes per building, so no two ground floors read alike.
export function makeBuildingTexture(rand, baseColor, accentColor, floors, shopName) {
  const w = 256;
  const h = 256;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const base = toCss(baseColor);
  const accent = toCss(accentColor);
  const dark = shade(baseColor, -0.12);
  const light = shade(baseColor, 0.08);

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, light);
  grad.addColorStop(0.55, base);
  grad.addColorStop(1, dark);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const storyH = Math.max(18, Math.floor((h - 52) / Math.max(1, floors)));
  const cols = 5;
  const winW = 26;
  const winH = Math.min(20, storyH - 8);
  const gapX = (w - cols * winW) / (cols + 1);
  const litColors = ['#ffd98a', '#ffbe5c', '#fff2c4', '#ffb46b'];
  for (let f = 0; f < floors; f++) {
    const y = 8 + f * storyH;
    if (y + winH > h - 52) break;
    for (let c = 0; c < cols; c++) {
      const x = gapX + c * (winW + gapX);
      const roll = rand();
      ctx.fillStyle = '#2a2622';
      ctx.fillRect(x - 2, y - 2, winW + 4, winH + 4);
      if (roll < 0.52) {
        ctx.fillStyle = litColors[Math.floor(rand() * litColors.length)];
      } else if (roll < 0.62) {
        ctx.fillStyle = accent;
      } else {
        ctx.fillStyle = rand() < 0.5 ? '#3d4a5a' : '#232a33';
      }
      ctx.fillRect(x, y, winW, winH);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.fillRect(x, y, winW, 3);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(x + winW / 2 - 1, y, 2, winH);
      if (rand() < 0.18) {
        ctx.fillStyle = 'rgba(20, 20, 26, 0.55)';
        ctx.fillRect(x, y + winH - 7, winW, 7);
      }
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.fillRect(0, y + storyH - 3, w, 2);
  }

  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  for (let i = 0; i < 26; i++) {
    const x = rand() * w;
    const len = 20 + rand() * 90;
    ctx.fillRect(x, rand() * h * 0.6, 2 + rand() * 4, len);
  }
  speckle(ctx, w, h, rand, 260, ['#000000', '#ffffff', '#3a2f24'], 0.04, 0.12, 2);

  const groundY = h - 52;
  ctx.fillStyle = shade(baseColor, -0.22);
  ctx.fillRect(0, groundY, w, 52);
  ctx.fillStyle = accent;
  ctx.fillRect(0, groundY, w, 6);
  ctx.fillStyle = '#1c1a18';
  ctx.fillRect(14, groundY + 12, 96, 34);
  ctx.fillStyle = '#ffd98a';
  ctx.fillRect(18, groundY + 16, 88, 26);
  ctx.fillStyle = 'rgba(40, 30, 20, 0.85)';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(24 + i * 22, groundY + 16, 10, 26);
  }
  ctx.fillStyle = '#241d18';
  ctx.fillRect(150, groundY + 10, 34, 42);
  ctx.fillStyle = accent;
  ctx.fillRect(150, groundY + 10, 34, 4);
  ctx.fillStyle = '#e8e2d4';
  ctx.fillRect(206, groundY + 14, 36, 30);
  ctx.fillStyle = '#2a2622';
  const shopLabel = String(shopName || 'TOKO').toUpperCase();
  let shopSize = 9;
  ctx.font = 'bold ' + shopSize + 'px sans-serif';
  ctx.textAlign = 'center';
  while (ctx.measureText(shopLabel).width > 32 && shopSize > 6) {
    shopSize -= 1;
    ctx.font = 'bold ' + shopSize + 'px sans-serif';
  }
  ctx.fillText(shopLabel, 224, groundY + 32);

  return finish(canvas, false);
}

// Patchy asphalt and pavement for the ground plane.
export function makeGroundTexture() {
  const rand = mulberryLike(1234);
  const w = 256;
  const h = 256;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#6f6a63';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 12 + rand() * 42;
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    const tone = rand() < 0.5 ? '110, 104, 94' : '88, 82, 74';
    g.addColorStop(0, 'rgba(' + tone + ', 0.35)');
    g.addColorStop(1, 'rgba(' + tone + ', 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  speckle(ctx, w, h, rand, 1400, ['#3f3a34', '#8d867c', '#a89f8d', '#55504a'], 0.1, 0.3, 2);
  ctx.strokeStyle = 'rgba(40, 36, 32, 0.5)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    let x = rand() * w;
    let y = rand() * h;
    ctx.moveTo(x, y);
    for (let s = 0; s < 5; s++) {
      x += (rand() - 0.5) * 50;
      y += (rand() - 0.5) * 50;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, w, h);
  return finish(canvas, true);
}

// Mid grey asphalt with a dashed center line and solid edge lines. The
// dash runs along the canvas height, which maps along the road length.
// Kept light enough that the road reads as grey asphalt in sunset light,
// not black.
export function makeRoadTexture() {
  const rand = mulberryLike(77);
  const w = 128;
  const h = 256;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#4e4e54';
  ctx.fillRect(0, 0, w, h);
  speckle(ctx, w, h, rand, 500, ['#333338', '#66666e', '#7a7a82'], 0.15, 0.35, 2);
  ctx.fillStyle = '#e8e4d8';
  ctx.fillRect(6, 0, 3, h);
  ctx.fillRect(w - 9, 0, 3, h);
  ctx.fillStyle = '#f2c14e';
  for (let y = 0; y < h; y += 64) {
    ctx.fillRect(w / 2 - 2, y + 8, 4, 34);
  }
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.fillRect(0, 0, w, 4);
  return finish(canvas, true);
}

// Warm beach sand with speckles and a few small shells.
export function makeSandTexture() {
  const rand = mulberryLike(2024);
  const w = 256;
  const h = 256;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#dcc288';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 24; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 18 + rand() * 46;
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, 'rgba(190, 150, 90, 0.25)');
    g.addColorStop(1, 'rgba(190, 150, 90, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  speckle(ctx, w, h, rand, 1600, ['#b99a62', '#efe0b0', '#a8874f', '#fff3cf'], 0.12, 0.35, 2);
  for (let i = 0; i < 9; i++) {
    const x = 12 + rand() * (w - 24);
    const y = 12 + rand() * (h - 24);
    ctx.fillStyle = rand() < 0.5 ? '#f2e6d0' : '#e8b8a0';
    ctx.beginPath();
    ctx.arc(x, y, 3 + rand() * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120, 90, 50, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, 2 + rand() * 2, 0.2, Math.PI - 0.4);
    ctx.stroke();
  }
  return finish(canvas, true);
}

// Bright blue sea with lighter wave streaks and sparkle, so it reads as
// clear water against the sand even at sunset.
export function makeWaterTexture() {
  const rand = mulberryLike(99);
  const w = 256;
  const h = 256;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#1a8ab0');
  grad.addColorStop(0.5, '#2aa8cc');
  grad.addColorStop(1, '#14708f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.lineCap = 'round';
  for (let i = 0; i < 42; i++) {
    const y = rand() * h;
    const x = rand() * w;
    const len = 24 + rand() * 70;
    ctx.strokeStyle = rand() < 0.6 ? 'rgba(190, 240, 250, 0.5)' : 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1 + rand() * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + len * 0.3, y - 4 - rand() * 4, x + len * 0.7, y + 4 + rand() * 4, x + len, y);
    ctx.stroke();
  }
  speckle(ctx, w, h, rand, 320, ['#d8f4fa', '#ffffff', '#1a7a9a'], 0.15, 0.5, 2);
  return finish(canvas, true);
}

// A bold shop sign. Text is centered and uppercased for readability.
export function makeSignTexture(text, bgColor, fgColor) {
  const w = 256;
  const h = 64;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = toCss(bgColor);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.fillRect(0, 0, w, 10);
  ctx.strokeStyle = toCss(fgColor);
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, w - 8, h - 8);
  ctx.fillStyle = toCss(fgColor);
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = String(text || 'TOKO').toUpperCase();
  const maxW = w - 24;
  let size = 30;
  ctx.font = 'bold ' + size + 'px sans-serif';
  while (ctx.measureText(label).width > maxW && size > 12) {
    size -= 2;
    ctx.font = 'bold ' + size + 'px sans-serif';
  }
  ctx.fillText(label, w / 2, h / 2 + 1);
  return finish(canvas, false);
}

// A striped awning, alternating the given color with warm cream.
export function makeAwningTexture(color) {
  const w = 128;
  const h = 64;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const base = toCss(color);
  const stripeW = 16;
  for (let x = 0; x < w; x += stripeW) {
    ctx.fillStyle = (x / stripeW) % 2 === 0 ? base : '#f2e6c8';
    ctx.fillRect(x, 0, stripeW, h);
  }
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  for (let x = 0; x < w; x += stripeW) {
    ctx.fillRect(x + stripeW - 2, 0, 2, h);
  }
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  return finish(canvas, true);
}

// Tiny local deterministic generator for textures that do not receive a
// caller supplied rand. Kept separate so texture speckle never consumes
// numbers from the shared city sequence.
function mulberryLike(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
