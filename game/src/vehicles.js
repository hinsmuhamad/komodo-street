// vehicles.js
// Komodo Street. Detailed vehicle builders: cars, becak, gerobak, boat.
// Forward is local +Z, so heading 0 drives toward +Z and heading PI/2
// drives toward +X. Wheels spin around their local X axle.

import * as THREE from 'three';

function mat(color, roughness, metalness) {
  return new THREE.MeshStandardMaterial({
    color: color,
    roughness: roughness === undefined ? 0.55 : roughness,
    metalness: metalness === undefined ? 0.25 : metalness,
  });
}

function emissiveMat(color, intensity) {
  return new THREE.MeshStandardMaterial({
    color: 0x111111,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.4,
    metalness: 0.1,
  });
}

function box(group, w, h, d, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
}

function makeWheel(radius, width, hubColor) {
  const pivot = new THREE.Group();
  const tyre = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, width, 20),
    mat(0x141414, 0.95, 0.0)
  );
  tyre.rotation.z = Math.PI / 2;
  tyre.castShadow = true;
  pivot.add(tyre);
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, width + 0.02, 12),
    mat(hubColor === undefined ? 0xb8bcc2 : hubColor, 0.35, 0.7)
  );
  hub.rotation.z = Math.PI / 2;
  pivot.add(hub);
  pivot.userData.radius = radius;
  return pivot;
}

function addWheelPair(group, wheels, z, radius, width, halfTrack) {
  const left = makeWheel(radius, width);
  left.position.set(-halfTrack, radius, z);
  group.add(left);
  const right = makeWheel(radius, width);
  right.position.set(halfTrack, radius, z);
  group.add(right);
  wheels.push(left, right);
}

function polisiTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f2f2f2';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#10243e';
  ctx.font = 'bold 40px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('POLISI', 128, 34);
  ctx.fillStyle = '#d21f26';
  ctx.fillRect(0, 54, 256, 6);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function awningTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#d21f26' : '#f7f3e8';
    ctx.fillRect(i * 16, 0, 16, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function buildCarBody(group, kind, color, wheels, extra) {
  const paint = mat(color, 0.35, 0.55);
  const dark = mat(0x1a1d22, 0.6, 0.2);
  const glass = new THREE.MeshStandardMaterial({
    color: 0x0e1a24,
    roughness: 0.12,
    metalness: 0.6,
  });
  const chrome = mat(0xd8dde2, 0.2, 0.9);
  const blackTrim = mat(0x222222, 0.8, 0.1);

  // Main lower body, slightly tapered look from a hood and a trunk slab.
  box(group, 1.9, 0.55, 4.2, paint, 0, 0.62, 0);
  box(group, 1.86, 0.28, 1.1, paint, 0, 0.78, 1.55);
  box(group, 1.86, 0.28, 0.9, paint, 0, 0.78, -1.65);
  // Cabin with dark glass all round.
  box(group, 1.66, 0.52, 2.1, glass, 0, 1.12, -0.25);
  box(group, 1.7, 0.1, 2.14, paint, 0, 1.42, -0.25);
  // Glass pillars and windshield header, to break the cabin into panels.
  box(group, 1.68, 0.08, 0.08, paint, 0, 1.18, 0.82);
  box(group, 0.08, 0.5, 2.1, paint, -0.82, 1.12, -0.25);
  box(group, 0.08, 0.5, 2.1, paint, 0.82, 1.12, -0.25);
  // Bumpers, grille, side trim.
  box(group, 1.94, 0.22, 0.28, blackTrim, 0, 0.42, 2.08);
  box(group, 1.94, 0.22, 0.28, blackTrim, 0, 0.42, -2.08);
  box(group, 1.1, 0.16, 0.06, dark, 0, 0.62, 2.12);
  box(group, 0.06, 0.06, 3.6, chrome, -0.96, 0.72, 0);
  box(group, 0.06, 0.06, 3.6, chrome, 0.96, 0.72, 0);
  // Side mirrors.
  box(group, 0.16, 0.1, 0.22, paint, -1.02, 1.02, 0.72);
  box(group, 0.16, 0.1, 0.22, paint, 1.02, 1.02, 0.72);
  // Door handles and a fuel cap dot.
  box(group, 0.04, 0.05, 0.3, chrome, -0.96, 0.88, 0.35);
  box(group, 0.04, 0.05, 0.3, chrome, 0.96, 0.88, 0.35);
  box(group, 0.04, 0.05, 0.3, chrome, -0.96, 0.88, -0.75);
  box(group, 0.04, 0.05, 0.3, chrome, 0.96, 0.88, -0.75);

  // Headlights: bright emissive lenses plus a small round lamp each side.
  const headMat = emissiveMat(0xfff2b8, 1.6);
  const headL = box(group, 0.42, 0.14, 0.06, headMat, -0.62, 0.72, 2.11);
  const headR = box(group, 0.42, 0.14, 0.06, headMat, 0.62, 0.72, 2.11);
  extra.headlights = [headL, headR];
  // Taillights: full width red strip with two brighter blocks.
  const tailMat = emissiveMat(0xff2a22, 1.4);
  box(group, 1.7, 0.12, 0.06, tailMat, 0, 0.78, -2.12);
  box(group, 0.4, 0.14, 0.06, tailMat, -0.6, 0.78, -2.12);
  box(group, 0.4, 0.14, 0.06, tailMat, 0.6, 0.78, -2.12);
  // Licence plates, front and rear.
  box(group, 0.6, 0.16, 0.04, mat(0xf7f3e8, 0.5, 0.1), 0, 0.42, 2.14);
  box(group, 0.6, 0.16, 0.04, mat(0xf7f3e8, 0.5, 0.1), 0, 0.42, -2.14);

  addWheelPair(group, wheels, 1.35, 0.36, 0.28, 0.82);
  addWheelPair(group, wheels, -1.35, 0.36, 0.28, 0.82);

  if (kind === 'hero') {
    // Rear spoiler on two uprights, hood scoop, side skirts, front lip.
    box(group, 0.1, 0.22, 0.1, blackTrim, -0.6, 1.02, -1.95);
    box(group, 0.1, 0.22, 0.1, blackTrim, 0.6, 1.02, -1.95);
    box(group, 1.7, 0.07, 0.42, paint, 0, 1.16, -1.98);
    box(group, 0.7, 0.12, 0.5, blackTrim, 0, 0.96, 1.35);
    box(group, 0.5, 0.06, 0.3, dark, 0, 1.03, 1.35);
    box(group, 0.08, 0.16, 3.4, blackTrim, -0.97, 0.32, 0);
    box(group, 0.08, 0.16, 3.4, blackTrim, 0.97, 0.32, 0);
    box(group, 1.92, 0.14, 0.3, blackTrim, 0, 0.3, 2.05);
  }

  if (kind === 'police') {
    // Roof light bar: dark base, red left half, blue right half.
    box(group, 1.1, 0.08, 0.34, blackTrim, 0, 1.5, -0.25);
    const redMat = emissiveMat(0xff1a1a, 2.2);
    const blueMat = emissiveMat(0x2244ff, 2.2);
    const left = box(group, 0.5, 0.16, 0.3, redMat, -0.27, 1.6, -0.25);
    const right = box(group, 0.5, 0.16, 0.3, blueMat, 0.27, 1.6, -0.25);
    extra.lightBar = { left: left, right: right };
    // POLISI side markings on both doors.
    const texture = polisiTexture();
    const decalMat = new THREE.MeshBasicMaterial({ map: texture });
    const decalGeo = new THREE.PlaneGeometry(1.25, 0.32);
    const decalL = new THREE.Mesh(decalGeo, decalMat);
    decalL.position.set(-0.97, 0.88, 0.1);
    decalL.rotation.y = -Math.PI / 2;
    group.add(decalL);
    const decalR = new THREE.Mesh(decalGeo, decalMat);
    decalR.position.set(0.97, 0.88, 0.1);
    decalR.rotation.y = Math.PI / 2;
    group.add(decalR);
    // A small roof number plate, so units read apart at a distance.
    box(group, 0.5, 0.04, 0.5, mat(0xf7f3e8, 0.5, 0.1), 0, 1.48, -0.25);
  }

  return extra;
}

function buildBecak(group, wheels) {
  const paint = mat(0x2f9bb0, 0.4, 0.4);
  const seatMat = mat(0x8a2f2f, 0.7, 0.0);
  const dark = mat(0x222222, 0.8, 0.1);
  // Rear passenger bench with a backrest, front driver saddle, pedals.
  box(group, 1.3, 0.14, 0.7, seatMat, 0, 0.85, -0.9);
  box(group, 1.3, 0.7, 0.12, seatMat, 0, 1.2, -1.25);
  box(group, 1.3, 0.5, 0.6, paint, 0, 0.5, -0.9);
  box(group, 0.4, 0.1, 0.35, dark, 0, 0.95, 0.45);
  box(group, 0.12, 0.08, 0.5, dark, -0.25, 0.55, 0.95);
  box(group, 0.12, 0.08, 0.5, dark, 0.25, 0.55, 0.95);
  // Canopy on four thin posts, with a striped edge.
  box(group, 0.07, 0.8, 0.07, dark, -0.6, 1.5, -0.6);
  box(group, 0.07, 0.8, 0.07, dark, 0.6, 1.5, -0.6);
  box(group, 0.07, 0.8, 0.07, dark, -0.6, 1.5, -1.2);
  box(group, 0.07, 0.8, 0.07, dark, 0.6, 1.5, -1.2);
  box(group, 1.5, 0.07, 1.1, mat(0xf7f3e8, 0.6, 0.0), 0, 1.92, -0.9);
  box(group, 1.5, 0.07, 0.12, mat(0xd21f26, 0.6, 0.0), 0, 1.9, -0.36);
  // Handlebar and a small front lamp.
  box(group, 0.7, 0.06, 0.06, dark, 0, 1.05, 1.25);
  const lamp = box(group, 0.16, 0.16, 0.08, emissiveMat(0xfff2b8, 1.4), 0, 0.95, 1.45);
  // Frame rails joining the three wheels.
  box(group, 0.1, 0.1, 2.6, dark, -0.45, 0.55, 0);
  box(group, 0.1, 0.1, 2.6, dark, 0.45, 0.55, 0);
  // One front wheel, two larger rear wheels.
  const front = makeWheel(0.32, 0.12);
  front.position.set(0, 0.32, 1.35);
  group.add(front);
  const rearL = makeWheel(0.38, 0.14);
  rearL.position.set(-0.62, 0.38, -0.95);
  group.add(rearL);
  const rearR = makeWheel(0.38, 0.14);
  rearR.position.set(0.62, 0.38, -0.95);
  group.add(rearR);
  wheels.push(front, rearL, rearR);
  return { headlights: [lamp], lightBar: null };
}

function buildGerobak(group, wheels) {
  const wood = mat(0x8a5a2f, 0.8, 0.0);
  const woodDark = mat(0x5f3d1e, 0.85, 0.0);
  const steel = mat(0xb8bcc2, 0.35, 0.7);
  // Box body, counter shelf, and a lower storage cupboard.
  box(group, 1.5, 0.8, 1.9, wood, 0, 0.75, 0);
  box(group, 1.6, 0.08, 2.0, woodDark, 0, 1.18, 0);
  box(group, 1.3, 0.45, 0.5, steel, 0, 0.4, 0.7);
  // Striped awning on four posts.
  const awnMat = new THREE.MeshStandardMaterial({
    map: awningTexture(),
    roughness: 0.7,
    metalness: 0.0,
  });
  box(group, 0.06, 0.7, 0.06, woodDark, -0.7, 1.55, -0.8);
  box(group, 0.06, 0.7, 0.06, woodDark, 0.7, 1.55, -0.8);
  box(group, 0.06, 0.7, 0.06, woodDark, -0.7, 1.55, 0.8);
  box(group, 0.06, 0.7, 0.06, woodDark, 0.7, 1.55, 0.8);
  const awning = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 2.1), awnMat);
  awning.position.set(0, 1.95, 0);
  awning.rotation.x = 0.08;
  awning.castShadow = true;
  group.add(awning);
  // Small food boxes, jars, and a hanging lamp on top of the counter.
  box(group, 0.35, 0.25, 0.3, mat(0xd45a3f, 0.6, 0.0), -0.4, 1.35, -0.4);
  box(group, 0.35, 0.25, 0.3, mat(0x2f9bb0, 0.6, 0.0), 0.05, 1.35, -0.5);
  box(group, 0.3, 0.3, 0.3, mat(0xf7f3e8, 0.5, 0.0), 0.45, 1.37, -0.35);
  box(group, 0.2, 0.35, 0.2, mat(0xd98c4a, 0.6, 0.0), -0.15, 1.4, 0.45);
  const lamp = box(group, 0.14, 0.14, 0.14, emissiveMat(0xffe9a8, 1.6), 0, 1.78, 0.6);
  // Two big side wheels and push handles at the rear.
  const wheelL = makeWheel(0.42, 0.16);
  wheelL.position.set(-0.82, 0.42, 0.1);
  group.add(wheelL);
  const wheelR = makeWheel(0.42, 0.16);
  wheelR.position.set(0.82, 0.42, 0.1);
  group.add(wheelR);
  wheels.push(wheelL, wheelR);
  box(group, 0.08, 0.08, 0.7, woodDark, -0.5, 1.0, -1.25);
  box(group, 0.08, 0.08, 0.7, woodDark, 0.5, 1.0, -1.25);
  return { headlights: [lamp], lightBar: null };
}

export function buildCar(state, kind, color) {
  const cfg = state.config;
  const group = new THREE.Group();
  const wheels = [];
  const extra = { headlights: [], lightBar: null };

  let paintColor = color;
  if (kind === 'hero') paintColor = cfg.heroCarColor;
  if (kind === 'police') paintColor = cfg.policeCarColor;

  if (kind === 'becak') {
    const parts = buildBecak(group, wheels);
    extra.headlights = parts.headlights;
  } else if (kind === 'gerobak') {
    const parts = buildGerobak(group, wheels);
    extra.headlights = parts.headlights;
  } else {
    buildCarBody(group, kind, paintColor, wheels, extra);
  }

  group.traverse(function (child) {
    if (child.isMesh) child.castShadow = true;
  });

  return {
    kind: kind,
    group: group,
    pos: group.position,
    heading: 0,
    speed: 0,
    color: paintColor,
    wheels: wheels,
    lightBar: extra.lightBar,
    headlights: extra.headlights,
  };
}

export function buildBoat(state) {
  const group = new THREE.Group();
  const hullMat = mat(0x2f6f8f, 0.5, 0.3);
  const deckMat = mat(0xd9c98f, 0.7, 0.0);
  const white = mat(0xf2f2f2, 0.5, 0.2);
  // Hull: a stretched box with a pointed bow cone at the front.
  box(group, 2.0, 0.7, 4.6, hullMat, 0, 0.45, -0.2);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.0, 1.4, 4), hullMat);
  bow.rotation.x = Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.scale.set(1, 1, 0.7);
  bow.position.set(0, 0.45, 2.7);
  bow.castShadow = true;
  group.add(bow);
  // Deck rim, cabin with glass, and a short mast with a flag.
  box(group, 2.1, 0.12, 4.7, deckMat, 0, 0.85, -0.2);
  box(group, 1.3, 0.7, 1.6, white, 0, 1.25, -0.6);
  box(group, 1.34, 0.35, 1.0, new THREE.MeshStandardMaterial({
    color: 0x0e1a24, roughness: 0.15, metalness: 0.5,
  }), 0, 1.3, -0.4);
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 2.4, 8),
    mat(0x5f3d1e, 0.8, 0.0)
  );
  mast.position.set(0, 2.2, 0.9);
  mast.castShadow = true;
  group.add(mast);
  box(group, 0.7, 0.4, 0.03, mat(0xd21f26, 0.6, 0.0), 0.38, 3.15, 0.9);
  // Outboard motor block at the stern.
  box(group, 0.4, 0.6, 0.3, mat(0x222222, 0.6, 0.3), 0, 0.5, -2.55);

  group.traverse(function (child) {
    if (child.isMesh) child.castShadow = true;
  });

  return {
    kind: 'boat',
    group: group,
    pos: group.position,
    heading: 0,
    speed: 0,
    color: 0x2f6f8f,
    wheels: [],
    lightBar: null,
    headlights: [],
  };
}
