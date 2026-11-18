// city.js
// Komodo Street. Builds the whole sunset city: ground, roads, buildings,
// beach, sea, palms, signs, lamps, carts and boats. Everything lives in one
// group added to the scene. Placement is seeded, so the city is identical
// on every run. Buildings never sit on a road or on the beach, and every
// avenue and street keeps a clear driving lane.

import * as THREE from 'three';
import { CONFIG, districtAt } from './config.js';
import { mulberry32, randRange, randInt, pick } from './util.js';
import {
  makeBuildingTexture,
  makeGroundTexture,
  makeRoadTexture,
  makeSandTexture,
  makeWaterTexture,
  makeSignTexture,
  makeAwningTexture,
} from './textures.js';

const ROAD_HALF = 6;
const SIDEWALK = 2.5;
const SHOP_NAMES = [
  'WARUNG KOPI', 'NASI GORENG', 'SATE AYAM', 'BAKSO 88', 'ES KELAPA',
  'MIE AYAM', 'KOPI SENJA', 'ROTI BAKAR', 'JUS BUAH', 'AYAM GEPREK',
  'TOKO KELONTONG', 'IKAN BAKAR', 'SOTO LAMONGAN', 'GORENGAN', 'CILOK',
  'BUBUR AYAM', 'KETOPRAK', 'RUJAK', 'TEH BOTOL', 'MARTABAK',
];
const NEON_NAMES = ['SENJA', 'PANTAI', 'KOPI', 'BAR', 'HOTEL', 'DISKO'];
const FACADE_SHOPS = ['TOKO', 'KOPI', 'SATE', 'BAKSO', 'MIE', 'ES', 'ROTI', 'JUS', 'SOTO', 'CILOK'];
const NEON_COLORS = [0xff2e88, 0x22d3ee, 0xffa726, 0x7c4dff, 0x39ff88, 0xff5252];
const UMBRELLA_COLORS = [0xff7043, 0x29b6f6, 0xffca28, 0xec407a, 0x66bb6a, 0xab47bc];
const BOAT_COLORS = [0xe8e2d4, 0x2f9bb0, 0xd45a3f, 0xffca28, 0x7a7d8a];

function hexColor(n) {
  return new THREE.Color(n);
}

function jitterColor(base, rand, amount) {
  const c = new THREE.Color(base);
  c.offsetHSL((rand() - 0.5) * 0.04, (rand() - 0.5) * 0.08, (rand() - 0.5) * amount);
  return c;
}

function blockRanges(centers, min, max) {
  const edges = [min, ...centers, max];
  const out = [];
  for (let i = 0; i < edges.length - 1; i++) {
    out.push([edges[i], edges[i + 1]]);
  }
  return out;
}

export function createCity(state) {
  const rand = mulberry32(CONFIG.seed);
  const cityCfg = CONFIG.city;
  const group = new THREE.Group();
  group.name = 'city';
  const colliders = [];
  const buildings = [];
  const palms = [];
  const boats = [];
  const neonMats = [];

  // Ground. Land only, x -260 to 180, z -200 to 200.
  const groundTex = makeGroundTexture();
  groundTex.repeat.set(22, 20);
  const groundMat = new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95, metalness: 0 });
  const groundW = cityCfg.maxX - cityCfg.minX;
  const groundD = cityCfg.maxZ - cityCfg.minZ;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(groundW, groundD),
    groundMat
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((cityCfg.minX + cityCfg.maxX) / 2, 0, 0);
  ground.receiveShadow = true;
  group.add(ground);

  // Roads. One shared asphalt texture, cloned and rotated for streets.
  const roadTexAvenue = makeRoadTexture();
  roadTexAvenue.repeat.set(1, 20);
  const roadTexStreet = roadTexAvenue.clone();
  roadTexStreet.needsUpdate = true;
  roadTexStreet.repeat.set(1, 22);
  roadTexStreet.center.set(0.5, 0.5);
  roadTexStreet.rotation = Math.PI / 2;
  const roadMatAvenue = new THREE.MeshStandardMaterial({ map: roadTexAvenue, roughness: 0.65, metalness: 0.05 });
  const roadMatStreet = new THREE.MeshStandardMaterial({ map: roadTexStreet, roughness: 0.65, metalness: 0.05 });

  for (const ax of cityCfg.avenues) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, groundD), roadMatAvenue);
    road.rotation.x = -Math.PI / 2;
    road.position.set(ax, 0.05, 0);
    road.receiveShadow = true;
    group.add(road);
  }
  for (const sz of cityCfg.streets) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(groundW, ROAD_HALF * 2), roadMatStreet);
    road.rotation.x = -Math.PI / 2;
    road.position.set((cityCfg.minX + cityCfg.maxX) / 2, 0.06, sz);
    road.receiveShadow = true;
    group.add(road);
  }

  // Beach sand and sea.
  const sandTex = makeSandTexture();
  sandTex.repeat.set(2, 20);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(cityCfg.beach.maxX - cityCfg.beach.minX, groundD),
    new THREE.MeshStandardMaterial({ map: sandTex, roughness: 1, metalness: 0 })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set((cityCfg.beach.minX + cityCfg.beach.maxX) / 2, 0.02, 0);
  sand.receiveShadow = true;
  group.add(sand);

  const waterTex = makeWaterTexture();
  waterTex.repeat.set(6, 10);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(cityCfg.sea.maxX - cityCfg.sea.minX, groundD),
    new THREE.MeshStandardMaterial({
      map: waterTex, roughness: 0.35, metalness: 0.1,
      color: 0x9fd8e8, transparent: true, opacity: 0.96,
    })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set((cityCfg.sea.minX + cityCfg.sea.maxX) / 2, 0.04, 0);
  group.add(sea);

  // Buildings. Blocks are the cells between road center lines, inset by
  // road half width plus sidewalk. The beach column, x 140 to 178, is
  // skipped entirely. Each block is split into one or two cells per side.
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x3a3630, roughness: 1 });
  const xBlocks = blockRanges(cityCfg.avenues, cityCfg.minX, cityCfg.maxX);
  const zBlocks = blockRanges(cityCfg.streets, cityCfg.minZ, cityCfg.maxZ);
  const inset = ROAD_HALF + SIDEWALK;
  for (const [bx0, bx1] of xBlocks) {
    for (const [bz0, bz1] of zBlocks) {
      const innerX0 = bx0 + inset;
      const innerX1 = bx1 - inset;
      const innerZ0 = bz0 + inset;
      const innerZ1 = bz1 - inset;
      if (innerX1 - innerX0 < 12 || innerZ1 - innerZ0 < 12) continue;
      if (innerX0 >= cityCfg.beach.minX) continue;
      const usableX1 = Math.min(innerX1, cityCfg.beach.minX - 2);
      if (usableX1 - innerX0 < 12) continue;
      const cols = (usableX1 - innerX0) > 32 ? 2 : 1;
      const rows = (innerZ1 - innerZ0) > 32 ? 2 : 1;
      const cellW = (usableX1 - innerX0) / cols;
      const cellD = (innerZ1 - innerZ0) / rows;
      for (let cx = 0; cx < cols; cx++) {
        for (let cz = 0; cz < rows; cz++) {
          const cellX0 = innerX0 + cx * cellW;
          const cellZ0 = innerZ0 + cz * cellD;
          const w = randRange(rand, cellW * 0.62, cellW * 0.88);
          const d = randRange(rand, cellD * 0.62, cellD * 0.88);
          const x = cellX0 + cellW / 2 + randRange(rand, -1.5, 1.5);
          const z = cellZ0 + cellD / 2 + randRange(rand, -1.5, 1.5);
          const district = districtAt(x, z);
          const floors = randInt(rand, 3, 12);
          const h = floors * 3.1 + randRange(rand, 0.5, 2.5);
          const base = jitterColor(district.building, rand, 0.12);
          const accent = district.accent;
          const facade = makeBuildingTexture(rand, base, accent, floors, pick(rand, FACADE_SHOPS));
          const sideMat = new THREE.MeshStandardMaterial({ map: facade, roughness: 0.9, metalness: 0 });
          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, d),
            [sideMat, sideMat, roofMat, roofMat, sideMat, sideMat]
          );
          mesh.position.set(x, h / 2, z);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          group.add(mesh);
          buildings.push({ mesh, x, z, w, d, h });
          colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });

          // Roof variety, so the skyline is not a row of identical flat
          // boxes. About a third of buildings get a pitched pyramid roof
          // in terracotta or slate; the rest get heavier rooftop clutter,
          // water tanks, AC boxes and vents, so rooflines step up and down.
          const roofRoll = rand();
          if (roofRoll < 0.3) {
            const roofColor = pick(rand, [0x9a5a3a, 0x7a4a3a, 0x4a5568, 0x8a6a4a]);
            const roofH = randRange(rand, 1.8, 3.4);
            const roof = new THREE.Mesh(
              new THREE.ConeGeometry(Math.sqrt((w / 2) * (w / 2) + (d / 2) * (d / 2)) * 1.05, roofH, 4),
              new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.95 })
            );
            roof.rotation.y = Math.PI / 4;
            roof.position.set(x, h + roofH / 2, z);
            roof.castShadow = true;
            group.add(roof);
          } else {
            if (rand() < 0.75) {
              const tank = new THREE.Mesh(
                new THREE.BoxGeometry(randRange(rand, 1.2, 2.2), randRange(rand, 1, 1.8), randRange(rand, 1.2, 2.2)),
                new THREE.MeshStandardMaterial({ color: rand() < 0.5 ? 0x8a8f96 : 0x5a6a72, roughness: 0.9 })
              );
              tank.position.set(x + randRange(rand, -w / 4, w / 4), h + 0.7, z + randRange(rand, -d / 4, d / 4));
              group.add(tank);
            }
            const acCount = randInt(rand, 1, 3);
            for (let a = 0; a < acCount; a++) {
              const ac = new THREE.Mesh(
                new THREE.BoxGeometry(randRange(rand, 0.7, 1.3), randRange(rand, 0.5, 0.9), randRange(rand, 0.7, 1.3)),
                new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.7, metalness: 0.3 })
              );
              ac.position.set(
                x + randRange(rand, -w / 3, w / 3), h + 0.35,
                z + randRange(rand, -d / 3, d / 3)
              );
              group.add(ac);
            }
          }
          // Balconies on the south face of mid rise buildings, so facades
          // are not one flat texture on every side.
          if (floors >= 3 && rand() < 0.45) {
            const balconyMat = new THREE.MeshStandardMaterial({ color: 0x6b5d4f, roughness: 0.9 });
            const railMat = new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.6, metalness: 0.5 });
            const balconies = randInt(rand, 2, 3);
            for (let b = 0; b < balconies; b++) {
              const by = 3.4 + b * 3.1 + randRange(rand, 0, 1.2);
              if (by > h - 1.5) continue;
              const bx = x + randRange(rand, -w / 4, w / 4);
              const slab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.9), balconyMat);
              slab.position.set(bx, by, z + d / 2 + 0.45);
              group.add(slab);
              const rail = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 0.06), railMat);
              rail.position.set(bx, by + 0.4, z + d / 2 + 0.88);
              group.add(rail);
            }
          }
          // Awnings over the ground floor shop front on low buildings.
          if (floors <= 6 && rand() < 0.6) {
            const awnTex = makeAwningTexture(pick(rand, [0xd45a3f, 0x2f9bb0, 0xff7a3f, 0x5fa8a0]));
            awnTex.repeat.set(2, 1);
            const awn = new THREE.Mesh(
              new THREE.PlaneGeometry(Math.min(w * 0.7, 8), 1.6),
              new THREE.MeshStandardMaterial({ map: awnTex, roughness: 0.9, side: THREE.DoubleSide })
            );
            awn.position.set(x, 3.6, z + d / 2 + 0.7);
            awn.rotation.x = -0.5;
            group.add(awn);
          }
        }
      }
    }
  }

  // Shop signs on building fronts, facing south toward the street.
  const signCount = Math.min(CONFIG.counts.shops, buildings.length);
  for (let i = 0; i < signCount; i++) {
    const b = buildings[Math.floor((i / signCount) * buildings.length)];
    const name = SHOP_NAMES[i % SHOP_NAMES.length];
    const bg = pick(rand, [0x1d3557, 0xd45a3f, 0x2f6b4f, 0x8a2f2f, 0x2f5d8a, 0xc47f3f]);
    const tex = makeSignTexture(name, bg, 0xffffff);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 1.25),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, side: THREE.DoubleSide })
    );
    sign.position.set(b.x, 4.4, b.z + b.d / 2 + 0.12);
    group.add(sign);
  }

  // Neon signs, high on taller buildings, emissive so they glow at dusk.
  const neonBuildings = [...buildings].sort((a, b) => b.h - a.h).slice(0, 24);
  for (let i = 0; i < CONFIG.counts.neon; i++) {
    const b = neonBuildings[Math.floor(rand() * neonBuildings.length)];
    const color = NEON_COLORS[i % NEON_COLORS.length];
    const name = NEON_NAMES[i % NEON_NAMES.length];
    const tex = makeSignTexture(name, 0x111118, color);
    const mat = new THREE.MeshStandardMaterial({
      map: tex, emissive: color, emissiveIntensity: 1.8,
      emissiveMap: tex, roughness: 0.4, side: THREE.DoubleSide,
    });
    neonMats.push(mat);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), mat);
    sign.position.set(b.x, Math.min(b.h - 1.5, randRange(rand, 9, 16)), b.z + b.d / 2 + 0.15);
    group.add(sign);
  }

  // Street lamps along every avenue, both sides, every 60 m.
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.7, metalness: 0.6 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff2c4, emissive: 0xffc86b, emissiveIntensity: 1.4 });
  for (const ax of cityCfg.avenues) {
    for (let z = -180; z <= 180; z += 60) {
      for (const side of [-1, 1]) {
        const lamp = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.2, 6), poleMat);
        pole.position.y = 2.6;
        lamp.add(pole);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.08), poleMat);
        arm.position.set(-side * 0.65, 5.1, 0);
        lamp.add(arm);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), lampMat);
        head.position.set(-side * 1.3, 5.0, 0);
        lamp.add(head);
        lamp.position.set(ax + side * (ROAD_HALF + 1.2), 0, z + randRange(rand, -4, 4));
        group.add(lamp);
      }
    }
  }

  // Palms. Beach palms in loose rows near the shore, sidewalk palms
  // along avenues. Trunk plus bent frond planes and a coconut cluster.
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 1 });
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 0.9, side: THREE.DoubleSide });
  const frondMat2 = new THREE.MeshStandardMaterial({ color: 0x3aa76d, roughness: 0.9, side: THREE.DoubleSide });
  function makePalm(x, z, scale) {
    const palm = new THREE.Group();
    const height = randRange(rand, 4.5, 7.5) * scale;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, height, 7), trunkMat);
    trunk.position.y = height / 2;
    trunk.rotation.z = randRange(rand, -0.08, 0.08);
    palm.add(trunk);
    const fronds = [];
    const count = randInt(rand, 5, 7);
    for (let i = 0; i < count; i++) {
      const geo = new THREE.PlaneGeometry(3.4, 0.9, 6, 1);
      const pos = geo.attributes.position;
      for (let v = 0; v < pos.count; v++) {
        const px = pos.getX(v);
        const t = (px + 1.7) / 3.4;
        pos.setY(v, pos.getY(v) - t * t * 1.1);
        pos.setZ(v, pos.getZ(v) + Math.sin(t * Math.PI) * 0.08);
      }
      geo.computeVertexNormals();
      const frond = new THREE.Mesh(geo, rand() < 0.5 ? frondMat : frondMat2);
      frond.position.set(1.5, 0, 0);
      const holder = new THREE.Group();
      holder.position.y = height;
      holder.rotation.y = (i / count) * Math.PI * 2 + randRange(rand, -0.2, 0.2);
      holder.rotation.z = randRange(rand, 0.35, 0.65);
      holder.add(frond);
      holder.userData.baseZ = holder.rotation.z;
      holder.userData.phase = rand() * Math.PI * 2;
      palm.add(holder);
      fronds.push(holder);
    }
    const nuts = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 6, 5),
      new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 1 })
    );
    nuts.position.y = height - 0.3;
    palm.add(nuts);
    palm.position.set(x, 0, z);
    palm.rotation.y = rand() * Math.PI * 2;
    group.add(palm);
    palms.push({ group: palm, fronds, phase: rand() * Math.PI * 2 });
  }
  for (let i = 0; i < 26; i++) {
    makePalm(randRange(rand, 144, 174), randRange(rand, -192, 192), randRange(rand, 0.9, 1.25));
  }
  for (let i = 0; i < CONFIG.counts.palms - 26; i++) {
    const ax = pick(rand, cityCfg.avenues);
    const side = rand() < 0.5 ? -1 : 1;
    makePalm(ax + side * randRange(rand, 8, 10), randRange(rand, -190, 190), randRange(rand, 0.8, 1.1));
  }

  // Beach umbrellas with towels.
  const towelColors = [0xff7043, 0x29b6f6, 0xffca28, 0xec407a, 0xffffff, 0x66bb6a];
  for (let i = 0; i < CONFIG.counts.umbrellas; i++) {
    const x = randRange(rand, 146, 172);
    const z = -180 + i * 36 + randRange(rand, -8, 8);
    const color = UMBRELLA_COLORS[i % UMBRELLA_COLORS.length];
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 2.3, 6),
      new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.8 })
    );
    pole.position.set(x, 1.15, z);
    group.add(pole);
    const canopy = new THREE.Mesh(
      new THREE.ConeGeometry(1.7, 0.7, 8),
      new THREE.MeshStandardMaterial({ color, roughness: 0.85, side: THREE.DoubleSide })
    );
    canopy.position.set(x, 2.5, z);
    group.add(canopy);
    const towel = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 0.9),
      new THREE.MeshStandardMaterial({ color: towelColors[i % towelColors.length], roughness: 1 })
    );
    towel.rotation.x = -Math.PI / 2;
    towel.rotation.z = rand() * Math.PI;
    towel.position.set(x + randRange(rand, 1.5, 2.5), 0.07, z + randRange(rand, -1, 1));
    group.add(towel);
  }

  // Beach detail near the shore, so the sand is not an empty expanse:
  // extra umbrellas and towels clustered where people gather, a trail of
  // footprints, scattered shells, a beach ball and starfish.
  const beachDetailColors = [0xff7043, 0x29b6f6, 0xffca28, 0xec407a];
  for (let i = 0; i < 6; i++) {
    const x = randRange(rand, 146, 174);
    const z = randRange(rand, -44, 24);
    const color = beachDetailColors[i % beachDetailColors.length];
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 2.3, 6),
      new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.8 })
    );
    pole.position.set(x, 1.15, z);
    group.add(pole);
    const canopy = new THREE.Mesh(
      new THREE.ConeGeometry(1.7, 0.7, 8),
      new THREE.MeshStandardMaterial({ color, roughness: 0.85, side: THREE.DoubleSide })
    );
    canopy.position.set(x, 2.5, z);
    group.add(canopy);
    const towel = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 0.9),
      new THREE.MeshStandardMaterial({ color: towelColors[(i + 2) % towelColors.length], roughness: 1 })
    );
    towel.rotation.x = -Math.PI / 2;
    towel.rotation.z = rand() * Math.PI;
    towel.position.set(x + randRange(rand, 1.5, 2.5), 0.07, z + randRange(rand, -1, 1));
    group.add(towel);
  }
  // Footprint trail along the sand near the shore.
  const printMat = new THREE.MeshStandardMaterial({ color: 0xb99a62, roughness: 1 });
  for (let i = 0; i < 26; i++) {
    const print = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 6),
      printMat
    );
    print.scale.set(1, 0.25, 1.6);
    print.position.set(
      152 + Math.sin(i * 0.7) * 1.2 + (i % 2 === 0 ? -0.35 : 0.35),
      0.05,
      -38 + i * 1.4
    );
    group.add(print);
  }
  // Scattered shells and starfish on the sand.
  for (let i = 0; i < 22; i++) {
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(randRange(rand, 0.12, 0.24), 8, 6),
      new THREE.MeshStandardMaterial({ color: pick(rand, [0xf2e6d0, 0xe8b8a0, 0xffffff, 0xffd9c0]), roughness: 0.8 })
    );
    shell.scale.set(1, 0.45, 1);
    shell.position.set(randRange(rand, 142, 176), 0.06, randRange(rand, -60, 40));
    group.add(shell);
  }
  for (let i = 0; i < 4; i++) {
    const star = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.08, 5),
      new THREE.MeshStandardMaterial({ color: 0xff8a4a, roughness: 0.9 })
    );
    star.position.set(randRange(rand, 146, 172), 0.07, randRange(rand, -50, 30));
    group.add(star);
  }
  // A striped beach ball left on the sand.
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xff5252, roughness: 0.5 })
  );
  ball.position.set(158, 0.55, -18);
  group.add(ball);
  const ballStripe = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.07, 8, 20),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 })
  );
  ballStripe.rotation.x = Math.PI / 2;
  ballStripe.position.set(158, 0.55, -18);
  group.add(ballStripe);

  // Boats on the sea. Hull, mast and sail, stored for gentle bobbing.
  for (let i = 0; i < CONFIG.counts.boats; i++) {
    const boat = new THREE.Group();
    const hullColor = BOAT_COLORS[i % BOAT_COLORS.length];
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.9, 1.7),
      new THREE.MeshStandardMaterial({ color: hullColor, roughness: 0.7 })
    );
    hull.position.y = 0.45;
    boat.add(hull);
    const bow = new THREE.Mesh(
      new THREE.ConeGeometry(0.85, 1.4, 4),
      new THREE.MeshStandardMaterial({ color: hullColor, roughness: 0.7 })
    );
    bow.rotation.z = -Math.PI / 2;
    bow.rotation.y = Math.PI / 4;
    bow.position.set(2.7, 0.45, 0);
    boat.add(bow);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 3.4, 6),
      new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 })
    );
    mast.position.y = 2.4;
    boat.add(mast);
    const sail = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 2.6),
      new THREE.MeshStandardMaterial({ color: 0xfff8e7, roughness: 0.9, side: THREE.DoubleSide })
    );
    sail.position.set(0.7, 2.6, 0);
    boat.add(sail);
    const bx = randRange(rand, 195, 320);
    const bz = -160 + i * 70 + randRange(rand, -18, 18);
    boat.position.set(bx, 0.04, bz);
    boat.rotation.y = randRange(rand, -0.6, 0.6);
    group.add(boat);
    boats.push({ group: boat, phase: rand() * Math.PI * 2, baseY: 0.04, baseRot: boat.rotation.y });
  }

  // Two boats close to shore, so the sea has life and scale near the beach.
  for (let i = 0; i < 2; i++) {
    const boat = new THREE.Group();
    const hullColor = BOAT_COLORS[(i + 2) % BOAT_COLORS.length];
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.9, 1.7),
      new THREE.MeshStandardMaterial({ color: hullColor, roughness: 0.7 })
    );
    hull.position.y = 0.45;
    boat.add(hull);
    const bow = new THREE.Mesh(
      new THREE.ConeGeometry(0.85, 1.4, 4),
      new THREE.MeshStandardMaterial({ color: hullColor, roughness: 0.7 })
    );
    bow.rotation.z = -Math.PI / 2;
    bow.rotation.y = Math.PI / 4;
    bow.position.set(2.7, 0.45, 0);
    boat.add(bow);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 3.4, 6),
      new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 })
    );
    mast.position.y = 2.4;
    boat.add(mast);
    const sail = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 2.6),
      new THREE.MeshStandardMaterial({ color: 0xfff8e7, roughness: 0.9, side: THREE.DoubleSide })
    );
    sail.position.set(0.7, 2.6, 0);
    boat.add(sail);
    boat.position.set(188 + i * 6, 0.04, -52 + i * 34);
    boat.rotation.y = randRange(rand, -0.4, 0.4);
    group.add(boat);
    boats.push({ group: boat, phase: rand() * Math.PI * 2, baseY: 0.04, baseRot: boat.rotation.y });
  }

  // Gerobak food carts near the market district.
  for (let i = 0; i < CONFIG.counts.gerobak; i++) {
    const cart = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.9, 1.1),
      new THREE.MeshStandardMaterial({ color: 0x8a5a2e, roughness: 0.9 })
    );
    body.position.y = 0.85;
    cart.add(body);
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.08, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.9 })
    );
    top.position.y = 1.34;
    cart.add(top);
    const awnTex = makeAwningTexture(pick(rand, [0xd45a3f, 0xff7a3f, 0x2f9bb0]));
    const awn = new THREE.Mesh(
      new THREE.PlaneGeometry(2.0, 1.1),
      new THREE.MeshStandardMaterial({ map: awnTex, roughness: 0.9, side: THREE.DoubleSide })
    );
    awn.position.set(0, 2.1, 0);
    awn.rotation.x = -0.35;
    cart.add(awn);
    for (const px of [-0.7, 0.7]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.8, 6),
        new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 })
      );
      post.position.set(px, 1.75, 0.5);
      cart.add(post);
    }
    for (const side of [-1, 1]) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 0.08, 10),
        new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 1 })
      );
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(0, 0.35, side * 0.58);
      cart.add(wheel);
    }
    const signTex = makeSignTexture(pick(rand, ['SATE', 'BAKSO', 'ES TEH', 'CILOK', 'KOPI']), 0x1d3557, 0xffffff);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 0.35),
      new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.7, side: THREE.DoubleSide })
    );
    sign.position.set(0, 1.0, 0.58);
    cart.add(sign);
    cart.position.set(randRange(rand, -60, 40), 0, randRange(rand, 10, 170));
    cart.rotation.y = randRange(rand, -0.5, 0.5);
    group.add(cart);
  }

  // Big PANTAI BIRU beach sign near the shore, facing west toward the
  // city. It sits close to the beach road so it reads fully in the cover
  // frame instead of being cut off at the edge.
  const beachSignTex = makeSignTexture('PANTAI BIRU', 0x0e7d99, 0xffffff);
  const beachBoard = new THREE.Mesh(
    new THREE.PlaneGeometry(11, 2.75),
    new THREE.MeshStandardMaterial({ map: beachSignTex, roughness: 0.6, side: THREE.DoubleSide })
  );
  beachBoard.position.set(160, 4.6, -20);
  beachBoard.rotation.y = -Math.PI / 2;
  group.add(beachBoard);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 });
  for (const dz of [-4.5, 4.5]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.4, 8), postMat);
    post.position.set(160, 1.7, -20 + dz);
    group.add(post);
  }

  state.scene.add(group);
  return { group, colliders, buildings, waterTex, neonMats, palms, boats };
}

export function updateCity(state, city, dt) {
  if (!city || !state || !state.time) return;
  const t = state.time.elapsed || 0;
  if (city.waterTex) {
    city.waterTex.offset.x += dt * 0.018;
    city.waterTex.offset.y += dt * 0.007;
  }
  for (let i = 0; i < city.neonMats.length; i++) {
    const mat = city.neonMats[i];
    const flicker = Math.sin(t * 7 + i * 2.1) * 0.12 + Math.sin(t * 13 + i) * 0.06;
    mat.emissiveIntensity = 1.7 + flicker;
  }
  for (const palm of city.palms) {
    for (const frond of palm.fronds) {
      frond.rotation.z = frond.userData.baseZ + Math.sin(t * 1.1 + frond.userData.phase) * 0.07;
    }
  }
  for (const boat of city.boats) {
    boat.group.position.y = boat.baseY + Math.sin(t * 0.9 + boat.phase) * 0.12;
    boat.group.rotation.z = Math.sin(t * 0.7 + boat.phase) * 0.03;
    boat.group.rotation.y = boat.baseRot + Math.sin(t * 0.25 + boat.phase) * 0.08;
  }
}
