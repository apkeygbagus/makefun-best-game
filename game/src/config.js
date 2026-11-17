// Neon Void — tuning constants: arena size, palette, wave table, upgrade pool.
// Everything visual in the game traces back to these values, so the whole look
// can be rebalanced from one file.

export const WORLD = { width: 960, height: 540 };

export const COLORS = {
  backgroundTop: '#070b1d',
  backgroundBottom: '#0d1030',
  grid: 'rgba(64, 90, 200, 0.13)',
  player: '#37e6ff',
  playerCore: '#e8fbff',
  bullet: '#8ff4ff',
  drone: '#ff4d8d',
  dart: '#ffb347',
  brute: '#b06bff',
  shard: '#52ffa8',
  heart: '#ff5d73',
  text: '#dceeff',
  textDim: '#7f93b8',
  panel: 'rgba(10, 16, 38, 0.88)',
  panelEdge: '#3d5bff',
};

export const PLAYER_BASE = {
  radius: 13,
  speed: 265,
  hp: 100,
  fireRate: 6.5, // shots per second
  damage: 12,
  projectiles: 1,
  pierce: 0,
  regen: 0,
  magnet: 46,
};

export const ENEMY_TYPES = {
  drone: { radius: 14, hp: 22, speed: 92, damage: 12, score: 50, shards: 1 },
  dart: { radius: 10, hp: 12, speed: 168, damage: 8, score: 80, shards: 1 },
  brute: { radius: 26, hp: 95, speed: 46, damage: 22, score: 200, shards: 3 },
};

// Wave n spawns count enemies; darts join from wave 2, brutes from wave 3.
// Wave 10 is the last scripted wave: clearing it wins the run.
export function waveComposition(wave) {
  const total = 5 + wave * 3;
  const brutes = wave >= 3 ? Math.min(1 + Math.floor((wave - 3) / 2), 5) : 0;
  const darts = wave >= 2 ? Math.floor(total * 0.32) : 0;
  const drones = Math.max(total - brutes - darts, 1);
  return { drones, darts, brutes };
}

export const FINAL_WAVE = 10;

export const UPGRADES = [
  {
    id: 'rapid', name: 'Rapid Cycler', icon: '»',
    blurb: '+22% fire rate. More bolts, more light.',
    apply: (p) => { p.fireRate *= 1.22; },
  },
  {
    id: 'heavy', name: 'Heavy Rounds', icon: '◆',
    blurb: '+35% damage per bolt.',
    apply: (p) => { p.damage *= 1.35; },
  },
  {
    id: 'twin', name: 'Split Cannon', icon: '⋔',
    blurb: '+1 projectile, −8% damage. Max 3 extra.',
    apply: (p) => { p.projectiles += 1; p.damage *= 0.92; },
    available: (p) => p.projectiles <= 3,
  },
  {
    id: 'swift', name: 'Swift Thrusters', icon: '➤',
    blurb: '+13% movement speed.',
    apply: (p) => { p.speed *= 1.13; },
  },
  {
    id: 'hull', name: 'Reinforced Hull', icon: '♥',
    blurb: '+25 max hull and repair 40 now.',
    apply: (p) => { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 40); },
  },
  {
    id: 'regen', name: 'Nano Plating', icon: '✚',
    blurb: 'Regenerate +0.7 hull per second.',
    apply: (p) => { p.regen += 0.7; },
  },
  {
    id: 'magnet', name: 'Magnet Array', icon: '◎',
    blurb: '+70% shard pickup radius.',
    apply: (p) => { p.magnet *= 1.7; },
  },
  {
    id: 'pierce', name: 'Piercing Rounds', icon: '➶',
    blurb: 'Bolts pierce +1 enemy. Max 2.',
    apply: (p) => { p.pierce += 1; },
    available: (p) => p.pierce < 2,
  },
];
