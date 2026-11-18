// config.js
// Komodo Street. Central frozen configuration. Every module reads values from
// here, so tuning one file tunes the whole game. The city is a 440 by 400
// grid on the coast: land from x -260 to 180, beach from 140 to 178, sea
// from 178 to 340. Six districts in a 3 by 2 grid. Sunset starts at 18:24.

export const CONFIG = Object.freeze({
  seed: 7,
  city: {
    minX: -260,
    maxX: 180,
    minZ: -200,
    maxZ: 200,
    avenues: [-210, -150, -90, -30, 30, 90, 130],
    streets: [-180, -120, -60, 0, 60, 120, 180],
    beach: { minX: 140, maxX: 178, minZ: -200, maxZ: 200 },
    sea: { minX: 178, maxX: 340, minZ: -200, maxZ: 200 },
  },
  districts: [
    { id: 'bukit', name: 'Bukit Angin', minX: -260, maxX: -80, minZ: -200, maxZ: 0, accent: 0xd98c4a, ground: 0x6b5d4f, building: 0x8f7a5f },
    { id: 'pelabuhan', name: 'Pelabuhan', minX: -80, maxX: 60, minZ: -200, maxZ: 0, accent: 0x5fa8a0, ground: 0x5f6157, building: 0x7a7d8a },
    { id: 'pantai', name: 'Pantai Biru', minX: 60, maxX: 180, minZ: -200, maxZ: 0, accent: 0x2f9bb0, ground: 0xd9c98f, building: 0x9ab8c4 },
    { id: 'kotalama', name: 'Kota Lama', minX: -260, maxX: -80, minZ: 0, maxZ: 200, accent: 0xc47f3f, ground: 0x8a7a5f, building: 0xa8906f },
    { id: 'pasar', name: 'Pasar Ikan', minX: -80, maxX: 60, minZ: 0, maxZ: 200, accent: 0xd45a3f, ground: 0x9a8a6f, building: 0xb08a5f },
    { id: 'tanjung', name: 'Tanjung Senja', minX: 60, maxX: 180, minZ: 0, maxZ: 200, accent: 0xff7a3f, ground: 0xc4a06f, building: 0xb08a7a },
  ],
  clock: {
    startHour: 18.4,
    minutesPerSecond: 1,
    duskStartHour: 18.2,
    rainStartHour: 18.3,
    rainEndHour: 20.0,
  },
  missionRewards: [500, 800, 1200, 1800, 2500, 3500, 5000],
  repLevels: [
    { threshold: 0, name: 'Kurir Baru' },
    { threshold: 150, name: 'Tangan Cepat' },
    { threshold: 400, name: 'Bintang Kilat' },
    { threshold: 800, name: 'Legenda Jalanan' },
  ],
  prices: {
    food: 10,
    heal: 30,
    safehouse: 5000,
    garage: 3000,
    upgrades: [800, 2000, 4000],
  },
  sideJobPay: { passenger: 300, express: 400 },
  racePrize: 500,
  counts: {
    traffic: 24,
    pedestrians: 40,
    beachgoers: 8,
    umbrellas: 10,
    boats: 5,
    shops: 20,
    neon: 6,
    palms: 60,
    gerobak: 5,
    becak: 4,
  },
  collectiblesTotal: 24,
  player: {
    walkSpeed: 6,
    runSpeed: 9,
    maxHealth: 100,
    maxArmour: 100,
    enterRange: 3.2,
    fov: 70,
  },
  car: {
    accel: 22,
    brake: 34,
    maxSpeed: 42,
    maxReverse: 12,
    turn: 1.9,
    grip: 0.92,
  },
  police: {
    spawnRing: 28,
    evadeSeconds: 6,
    bustDistance: 3.5,
    bustStillSpeed: 1.5,
    bustSeconds: 2.5,
    finePerStar: 200,
  },
  heroCarColor: 0xd21f26,
  policeCarColor: 0xf2f2f2,
});

export function districtAt(x, z) {
  for (const d of CONFIG.districts) {
    if (x >= d.minX && x < d.maxX && z >= d.minZ && z < d.maxZ) return d;
  }
  return CONFIG.districts[0];
}

export function repNameFor(rep) {
  let name = CONFIG.repLevels[0].name;
  for (const level of CONFIG.repLevels) {
    if (rep >= level.threshold) name = level.name;
  }
  return name;
}
