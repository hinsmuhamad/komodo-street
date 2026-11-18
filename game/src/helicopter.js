// helicopter.js
// Komodo Street. Police helicopter with a visible searchlight.
// Parked far away and invisible until wanted level 3, then it flies in,
// circles above the player, and tracks the player with its spotlight and
// a translucent light cone. It flies away again when the heat drops.

import * as THREE from 'three';
import { clamp, lerp } from './util.js';

const PARK_POS = new THREE.Vector3(420, 90, 420);
const FLY_HEIGHT = 42;
const CIRCLE_RADIUS = 18;

function box(group, w, h, d, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
}

export function createHelicopter(state) {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({
    color: 0x10243e, roughness: 0.4, metalness: 0.4,
  });
  const white = new THREE.MeshStandardMaterial({
    color: 0xf2f2f2, roughness: 0.45, metalness: 0.3,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x0e1a24, roughness: 0.12, metalness: 0.6,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x1a1d22, roughness: 0.7, metalness: 0.2,
  });

  // Body: a rounded nose, a white belly stripe, and a glass cockpit.
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 12), paint);
  body.scale.set(1.0, 0.9, 1.7);
  body.position.set(0, 0, 0);
  body.castShadow = true;
  group.add(body);
  box(group, 2.2, 0.35, 3.4, white, 0, -0.55, 0);
  box(group, 1.7, 0.9, 1.1, glass, 0, 0.25, 1.55);
  box(group, 1.9, 0.5, 0.9, paint, 0, -0.35, 1.7);
  // Tail boom, tail fin, and a small tail rotor.
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.45, 4.6, 10), paint);
  boom.rotation.x = Math.PI / 2;
  boom.position.set(0, 0.25, -4.2);
  boom.castShadow = true;
  group.add(boom);
  box(group, 0.12, 1.3, 0.9, paint, 0, 0.9, -6.2);
  box(group, 0.9, 0.1, 0.5, white, 0, 0.3, -6.2);
  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.35, 0.35, -6.2);
  const tailBladeGeo = new THREE.BoxGeometry(0.08, 1.5, 0.16);
  const tailBladeA = new THREE.Mesh(tailBladeGeo, dark);
  const tailBladeB = new THREE.Mesh(tailBladeGeo, dark);
  tailBladeB.rotation.z = Math.PI / 2;
  tailRotor.add(tailBladeA, tailBladeB);
  group.add(tailRotor);
  // Main rotor mast and four long blades.
  box(group, 0.3, 0.5, 0.3, dark, 0, 1.5, 0);
  const rotor = new THREE.Group();
  rotor.position.set(0, 1.8, 0);
  const bladeGeo = new THREE.BoxGeometry(0.35, 0.06, 5.4);
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(bladeGeo, dark);
    blade.rotation.y = (i * Math.PI) / 2;
    blade.castShadow = true;
    rotor.add(blade);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.25, 12), white);
  rotor.add(hub);
  group.add(rotor);
  // Landing skids on short struts.
  box(group, 0.12, 0.5, 0.12, dark, -0.9, -1.15, 0.8);
  box(group, 0.12, 0.5, 0.12, dark, 0.9, -1.15, 0.8);
  box(group, 0.12, 0.5, 0.12, dark, -0.9, -1.15, -0.8);
  box(group, 0.12, 0.5, 0.12, dark, 0.9, -1.15, -0.8);
  const skidGeo = new THREE.CylinderGeometry(0.07, 0.07, 3.6, 8);
  const skidL = new THREE.Mesh(skidGeo, dark);
  skidL.rotation.x = Math.PI / 2;
  skidL.position.set(-0.95, -1.45, 0);
  group.add(skidL);
  const skidR = new THREE.Mesh(skidGeo, dark);
  skidR.rotation.x = Math.PI / 2;
  skidR.position.set(0.95, -1.45, 0);
  group.add(skidR);
  // Red and blue strobe dots on the belly, matching the police cars.
  const redDot = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff1a1a, emissiveIntensity: 2.0 })
  );
  redDot.position.set(-0.5, -0.75, 0.5);
  group.add(redDot);
  const blueDot = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x2244ff, emissiveIntensity: 2.0 })
  );
  blueDot.position.set(0.5, -0.75, 0.5);
  group.add(blueDot);

  // Searchlight: a real spotlight plus a translucent cone, so the beam
  // reads clearly on the ground and in the cover shot.
  const spotlight = new THREE.SpotLight(0xfff2c0, 0, 140, 0.32, 0.45, 1.0);
  spotlight.position.set(0, -0.8, 1.2);
  group.add(spotlight);
  const spotlightTarget = new THREE.Object3D();
  state.scene.add(spotlightTarget);
  spotlight.target = spotlightTarget;

  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xfff2c0,
    transparent: true,
    opacity: 0.13,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(7.5, FLY_HEIGHT, 24, 1, true),
    coneMat
  );
  // Cone tip sits at the helicopter, base opens on the player below.
  // It lives in the scene, not in the group, so updateHelicopter can aim
  // it from the helicopter straight at the player each frame. The group
  // circles 18 m off the player, so a group child cone would miss.
  // ConeGeometry already points up, tip at the top, base at the bottom.
  cone.visible = false;
  state.scene.add(cone);

  // A bright pool disc on the ground, parented to the target, marks the
  // exact spot the beam is tracking.
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(6.5, 24),
    new THREE.MeshBasicMaterial({
      color: 0xfff2c0, transparent: true, opacity: 0.22,
      depthWrite: false, blending: THREE.AdditiveBlending,
    })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0, 0.06, 0);
  pool.visible = false;
  spotlightTarget.add(pool);

  group.position.copy(PARK_POS);
  group.visible = false;
  state.scene.add(group);

  return {
    group: group,
    rotor: rotor,
    tailRotor: tailRotor,
    spotlight: spotlight,
    spotlightTarget: spotlightTarget,
    cone: cone,
    pool: pool,
    active: false,
    angle: 0,
    leaving: false,
  };
}

export function updateHelicopter(state, heli, dt) {
  const step = Math.min(dt, 0.05);
  const player = state.player.pos;
  const wanted = state.wanted || 0;

  // Spin the rotors whenever the helicopter is out, fast in the air.
  if (heli.active || heli.leaving) {
    heli.rotor.rotation.y += step * 28;
    heli.tailRotor.rotation.x += step * 34;
  }

  if (wanted >= 3 && !heli.active && !heli.leaving) {
    heli.active = true;
    heli.group.visible = true;
    heli.cone.visible = true;
    heli.pool.visible = true;
    heli.spotlight.intensity = 900;
    // Start the circle on the side facing the player, for a short fly in.
    heli.angle = Math.atan2(heli.group.position.z - player.z, heli.group.position.x - player.x);
  }

  if (heli.active) {
    if (wanted < 3) {
      heli.active = false;
      heli.leaving = true;
      heli.cone.visible = false;
      heli.pool.visible = false;
      heli.spotlight.intensity = 0;
      return;
    }
    heli.angle += step * 0.45;
    const targetX = player.x + Math.cos(heli.angle) * CIRCLE_RADIUS;
    const targetZ = player.z + Math.sin(heli.angle) * CIRCLE_RADIUS;
    const targetY = FLY_HEIGHT;
    // Ease toward the circling point, so the fly in reads as an arrival.
    const k = 1 - Math.exp(-step * 1.4);
    heli.group.position.x = lerp(heli.group.position.x, targetX, k);
    heli.group.position.y = lerp(heli.group.position.y, targetY, k);
    heli.group.position.z = lerp(heli.group.position.z, targetZ, k);
    // Face the direction of travel, with a gentle banking tilt.
    const travelHeading = Math.atan2(
      targetX - heli.group.position.x,
      targetZ - heli.group.position.z
    );
    heli.group.rotation.y = travelHeading;
    heli.group.rotation.z = Math.sin(state.time.elapsed * 0.8) * 0.06;
    heli.spotlightTarget.position.set(player.x, 0, player.z);
    heli.spotlight.intensity = 900;
    // Aim the cone from the helicopter at the player: tip at the heli,
    // base on the ground at the player, stretched to the true distance.
    const toPlayer = new THREE.Vector3(
      player.x - heli.group.position.x,
      0 - heli.group.position.y,
      player.z - heli.group.position.z
    );
    const beamLen = toPlayer.length();
    const beamDir = toPlayer.clone().normalize();
    heli.cone.position.copy(heli.group.position).addScaledVector(beamDir, beamLen / 2);
    heli.cone.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      beamDir.clone().negate()
    );
    heli.cone.scale.set(1, beamLen / FLY_HEIGHT, 1);
    return;
  }

  if (heli.leaving) {
    const k = 1 - Math.exp(-step * 1.1);
    heli.group.position.x = lerp(heli.group.position.x, PARK_POS.x, k);
    heli.group.position.y = lerp(heli.group.position.y, PARK_POS.y, k);
    heli.group.position.z = lerp(heli.group.position.z, PARK_POS.z, k);
    heli.group.rotation.z = lerp(heli.group.rotation.z, 0, k);
    const dx = PARK_POS.x - heli.group.position.x;
    const dz = PARK_POS.z - heli.group.position.z;
    if (Math.abs(dx) < 4 && Math.abs(dz) < 4) {
      heli.leaving = false;
      heli.group.visible = false;
      heli.group.position.copy(PARK_POS);
    }
  }
}
