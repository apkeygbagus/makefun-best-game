// Neon Void — the game itself: a neon arena survival shooter. You pilot the
// last interceptor in a collapsing sector, blast waves of void drones, gather
// their cores, and bolt on upgrades between waves. Clear wave 10 to win the
// sector; fall and the void takes the run. Endless mode follows victory.
//
// This file owns the state machine (menu / playing / upgrade / paused / over /
// win), every entity, the wave director, the combo scoring, and all drawing.

import { WORLD, COLORS, PLAYER_BASE, ENEMY_TYPES, waveComposition, FINAL_WAVE, UPGRADES } from './config.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAU = Math.PI * 2;

export class Game {
  constructor(canvas, input, sfx) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = input;
    this.sfx = sfx;
    this.state = 'menu';
    this.rng = mulberry32(20261117);
    this.stars = [];
    for (let i = 0; i < 120; i++) {
      this.stars.push({ x: this.rng() * WORLD.width, y: this.rng() * WORLD.height, z: 0.3 + this.rng() * 0.7 });
    }
    this.best = 0;
    try { this.best = Number(localStorage.getItem('neon-void-best') || 0) || 0; } catch { this.best = 0; }
    this.frozen = false;
    this.auto = null;
    this.time = 0;
    this.resetRun();
    this.state = 'menu';
    this.player.x = WORLD.width / 2;
    this.player.y = 452; // the title screen parks the ship under its text
  }

  resetRun() {
    const base = { ...PLAYER_BASE };
    this.player = {
      ...base, maxHp: base.hp, hp: base.hp,
      x: WORLD.width / 2, y: WORLD.height / 2, vx: 0, vy: 0,
      angle: -Math.PI / 2, fireCooldown: 0, invuln: 0, thrust: 0,
    };
    this.enemies = [];
    this.bullets = [];
    this.shards = [];
    this.particles = [];
    this.texts = [];
    this.wave = 0;
    this.score = 0;
    this.frozen = false;
    this.auto = null;
    this.cores = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.kills = 0;
    this.runTime = 0;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.shake = 0;
    this.upgradeChoices = [];
    this.endless = false;
  }

  startRun(seed) {
    if (seed !== undefined) this.rng = mulberry32(seed);
    this.resetRun();
    this.state = 'playing';
    this.startWave(1);
  }

  startWave(wave) {
    this.wave = wave;
    const comp = waveComposition(wave);
    this.spawnQueue = [];
    for (let i = 0; i < comp.drones; i++) this.spawnQueue.push('drone');
    for (let i = 0; i < comp.darts; i++) this.spawnQueue.push('dart');
    for (let i = 0; i < comp.brutes; i++) this.spawnQueue.push('brute');
    // Shuffle so types interleave instead of arriving in blocks.
    for (let i = this.spawnQueue.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [this.spawnQueue[i], this.spawnQueue[j]] = [this.spawnQueue[j], this.spawnQueue[i]];
    }
    this.spawnTimer = 0.4;
    this.addText(WORLD.width / 2, 120, wave > FINAL_WAVE ? `ENDLESS WAVE ${wave}` : `WAVE ${wave}`, COLORS.text, 34);
  }

  spawnEnemy(type) {
    const spec = ENEMY_TYPES[type];
    // Spawn on a random edge, at least 240px from the player.
    let x = 0; let y = 0;
    for (let tries = 0; tries < 12; tries++) {
      const edge = Math.floor(this.rng() * 4);
      if (edge === 0) { x = this.rng() * WORLD.width; y = -30; }
      if (edge === 1) { x = this.rng() * WORLD.width; y = WORLD.height + 30; }
      if (edge === 2) { x = -30; y = this.rng() * WORLD.height; }
      if (edge === 3) { x = WORLD.width + 30; y = this.rng() * WORLD.height; }
      const d = Math.hypot(x - this.player.x, y - this.player.y);
      if (d > 240) break;
    }
    const hpScale = 1 + (this.wave - 1) * 0.13;
    this.enemies.push({
      type, x, y, vx: 0, vy: 0,
      radius: spec.radius, hp: spec.hp * hpScale, maxHp: spec.hp * hpScale,
      speed: spec.speed * (0.92 + this.rng() * 0.16),
      damage: spec.damage, score: spec.score, shards: spec.shards,
      wobble: this.rng() * TAU, dashTimer: this.rng() * 1.2, flash: 0, angle: 0,
    });
  }

  multiplier() {
    return Math.min(1 + this.combo * 0.2, 5);
  }

  addScore(base, x, y) {
    const gained = Math.round(base * this.multiplier());
    this.score += gained;
    if (x !== undefined) this.addText(x, y, `+${gained}`, COLORS.shard, 15);
  }

  addText(x, y, text, color, size) {
    this.texts.push({ x, y, text, color, size: size || 16, life: 1.1, maxLife: 1.1 });
  }

  burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i++) {
      const a = this.rng() * TAU;
      const s = (0.3 + this.rng() * 0.7) * speed;
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.35 + this.rng() * 0.45, maxLife: 0.8,
        color, size: 1.5 + this.rng() * 2.8,
      });
    }
    if (this.particles.length > 420) this.particles.splice(0, this.particles.length - 420);
  }

  update(dt) {
    this.time += dt;
    this.updateStars(dt);
    if (this.frozen) return;
    const key = this.input.consumeKey();
    if (key === 'KeyM') {
      const muted = this.sfx.toggleMute();
      this.addText(WORLD.width / 2, 40, muted ? 'SOUND OFF' : 'SOUND ON', COLORS.textDim, 14);
    }

    if (this.state === 'menu') {
      if (key === 'Enter' || this.input.consumeClick()) { this.sfx.unlock(); this.startRun(); }
      this.updateParticles(dt);
      return;
    }
    if (this.state === 'over' || this.state === 'win') {
      this.updateParticles(dt);
      this.updateTexts(dt);
      const restart = key === 'KeyR' || (this.state === 'over' && this.input.consumeClick());
      const goEndless = this.state === 'win' && key === 'Enter';
      if (restart) this.startRun();
      if (goEndless) { this.endless = true; this.state = 'playing'; this.startWave(this.wave + 1); }
      return;
    }
    if (this.state === 'upgrade') {
      this.updateParticles(dt);
      this.updateTexts(dt);
      this.updateUpgradeChoice(key);
      return;
    }
    if (this.state === 'paused') {
      if (key === 'KeyP' || key === 'Escape') this.state = 'playing';
      return;
    }
    // state === 'playing'
    if (key === 'KeyP' || key === 'Escape') { this.state = 'paused'; return; }
    this.updatePlaying(dt);
  }

  updateStars(dt) {
    for (const star of this.stars) {
      star.x -= star.z * 9 * dt;
      if (star.x < 0) { star.x = WORLD.width; star.y = this.rng() * WORLD.height; }
    }
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.92; p.vy *= 0.92; p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  updateTexts(dt) {
    for (const t of this.texts) { t.y -= 26 * dt; t.life -= dt; }
    this.texts = this.texts.filter((t) => t.life > 0);
  }

  currentControls() {
    if (this.auto) return this.auto;
    const input = this.input;
    return {
      mx: input.axisX(), my: input.axisY(),
      aimX: input.mouse.x, aimY: input.mouse.y,
      fire: input.mouse.down || input.down('Space'),
    };
  }

  updatePlaying(dt) {
    const p = this.player;
    this.runTime += dt;
    const ctl = this.currentControls();

    // Movement with a little inertia, clamped to the arena.
    const accel = 1500;
    p.vx += ctl.mx * accel * dt;
    p.vy += ctl.my * accel * dt;
    p.vx *= Math.pow(0.0015, dt);
    p.vy *= Math.pow(0.0015, dt);
    const velocity = Math.hypot(p.vx, p.vy);
    if (velocity > p.speed) { p.vx = (p.vx / velocity) * p.speed; p.vy = (p.vy / velocity) * p.speed; }
    p.x = Math.min(Math.max(p.x + p.vx * dt, p.radius), WORLD.width - p.radius);
    p.y = Math.min(Math.max(p.y + p.vy * dt, p.radius), WORLD.height - p.radius);
    p.thrust = Math.min(1, velocity / p.speed);
    p.angle = Math.atan2(ctl.aimY - p.y, ctl.aimX - p.x);
    if (p.regen > 0) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);
    if (p.invuln > 0) p.invuln -= dt;

    // Firing.
    p.fireCooldown -= dt;
    if (ctl.fire && p.fireCooldown <= 0) {
      p.fireCooldown = 1 / p.fireRate;
      this.fireBolts();
    }

    // Wave director.
    if (this.spawnQueue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = Math.max(0.28, 0.62 - this.wave * 0.03);
        this.spawnEnemy(this.spawnQueue.pop());
      }
    }

    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updateShards(dt);
    this.updateParticles(dt);
    this.updateTexts(dt);
    if (this.comboTimer > 0) { this.comboTimer -= dt; if (this.comboTimer <= 0) this.combo = 0; }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 26);

    // Wave cleared?
    if (this.spawnQueue.length === 0 && this.enemies.length === 0 && this.state === 'playing') {
      if (this.wave >= FINAL_WAVE && !this.endless) {
        this.state = 'win';
        this.saveBest();
        this.sfx.waveClear();
      } else {
        this.presentUpgrades();
      }
    }
  }

  fireBolts() {
    const p = this.player;
    const count = p.projectiles;
    const spreadStep = 0.085;
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * spreadStep;
      const a = p.angle + offset;
      this.bullets.push({
        x: p.x + Math.cos(p.angle) * (p.radius + 6),
        y: p.y + Math.sin(p.angle) * (p.radius + 6),
        vx: Math.cos(a) * 660, vy: Math.sin(a) * 660,
        life: 0.95, damage: p.damage, pierce: p.pierce, radius: 4,
      });
    }
    this.sfx.shoot();
  }

  updateEnemies(dt) {
    const p = this.player;
    for (const e of this.enemies) {
      const toPlayer = Math.atan2(p.y - e.y, p.x - e.x);
      e.angle = toPlayer;
      e.wobble += dt * 3;
      let speed = e.speed;
      if (e.type === 'drone') {
        const wob = Math.sin(e.wobble) * 0.45;
        e.vx = Math.cos(toPlayer + wob) * speed;
        e.vy = Math.sin(toPlayer + wob) * speed;
      } else if (e.type === 'dart') {
        e.dashTimer -= dt;
        if (e.dashTimer < -0.9) e.dashTimer = 1.1;
        if (e.dashTimer < 0) speed *= 2.1; // dash phase
        e.vx = Math.cos(toPlayer) * speed;
        e.vy = Math.sin(toPlayer) * speed;
      } else { // brute: steady, shrugs off knockback
        e.vx = Math.cos(toPlayer) * speed;
        e.vy = Math.sin(toPlayer) * speed;
      }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.flash > 0) e.flash -= dt;

      // Contact with the player.
      const dist = Math.hypot(e.x - p.x, e.y - p.y);
      if (dist < e.radius + p.radius && p.invuln <= 0) {
        this.damagePlayer(e.damage);
        const push = Math.atan2(e.y - p.y, e.x - p.x);
        e.x += Math.cos(push) * 26;
        e.y += Math.sin(push) * 26;
      }
    }
    // Gentle separation so enemies do not stack into one blob.
    const list = this.enemies;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]; const b = list[j];
        const dx = b.x - a.x; const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const min = a.radius + b.radius;
        if (d > 0 && d < min) {
          const push = (min - d) / 2;
          const ux = dx / d; const uy = dy / d;
          a.x -= ux * push; a.y -= uy * push;
          b.x += ux * push; b.y += uy * push;
        }
      }
    }
  }

  updateBullets(dt) {
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        const d = Math.hypot(e.x - b.x, e.y - b.y);
        if (d < e.radius + b.radius) {
          e.hp -= b.damage;
          e.flash = 0.08;
          this.sfx.hit();
          this.burst(b.x, b.y, COLORS.bullet, 3, 130);
          if (e.hp <= 0) this.killEnemy(e);
          if (b.pierce > 0) { b.pierce -= 1; } else { b.life = 0; }
          break;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0 && b.x > -20 && b.x < WORLD.width + 20 && b.y > -20 && b.y < WORLD.height + 20);
    this.enemies = this.enemies.filter((e) => e.hp > 0);
  }

  killEnemy(e) {
    this.kills += 1;
    this.combo += 1;
    this.comboTimer = 2.5;
    const color = e.type === 'drone' ? COLORS.drone : e.type === 'dart' ? COLORS.dart : COLORS.brute;
    this.burst(e.x, e.y, color, e.type === 'brute' ? 30 : 16, 240);
    this.addScore(e.score, e.x, e.y - 10);
    this.sfx.explosion();
    if (e.type === 'brute') {
      this.shake = Math.min(9, this.shake + 5);
      for (let i = 0; i < 2; i++) {
        const spec = ENEMY_TYPES.drone;
        this.enemies.push({
          type: 'drone', x: e.x + (this.rng() - 0.5) * 30, y: e.y + (this.rng() - 0.5) * 30,
          vx: 0, vy: 0, radius: spec.radius, hp: spec.hp, maxHp: spec.hp,
          speed: spec.speed, damage: spec.damage, score: spec.score, shards: spec.shards,
          wobble: this.rng() * TAU, dashTimer: 0, flash: 0, angle: 0,
        });
      }
    }
    for (let i = 0; i < e.shards; i++) {
      this.shards.push({
        x: e.x + (this.rng() - 0.5) * 22, y: e.y + (this.rng() - 0.5) * 22,
        vx: (this.rng() - 0.5) * 60, vy: (this.rng() - 0.5) * 60, life: 11,
      });
    }
  }

  updateShards(dt) {
    const p = this.player;
    for (const s of this.shards) {
      s.life -= dt;
      const d = Math.hypot(p.x - s.x, p.y - s.y);
      if (d < p.magnet + 60) {
        const pull = d < p.magnet ? 340 : 150;
        s.vx += ((p.x - s.x) / (d || 1)) * pull * dt * 4;
        s.vy += ((p.y - s.y) / (d || 1)) * pull * dt * 4;
      }
      s.vx *= Math.pow(0.02, dt); s.vy *= Math.pow(0.02, dt);
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (d < p.radius + 10) {
        s.life = 0;
        this.cores += 1;
        this.score += 15;
        this.sfx.pickup();
        if (this.cores % 15 === 0) {
          p.hp = Math.min(p.maxHp, p.hp + 8);
          this.addText(p.x, p.y - 24, '+8 HULL', COLORS.heart, 14);
        }
      }
    }
    this.shards = this.shards.filter((s) => s.life > 0);
  }

  damagePlayer(amount) {
    const p = this.player;
    p.hp -= amount;
    p.invuln = 0.7;
    this.shake = Math.min(10, this.shake + 6);
    this.combo = 0;
    this.burst(p.x, p.y, COLORS.heart, 14, 220);
    this.sfx.hurt();
    if (p.hp <= 0) {
      p.hp = 0;
      this.state = 'over';
      this.burst(p.x, p.y, COLORS.player, 46, 320);
      this.burst(p.x, p.y, COLORS.heart, 30, 260);
      this.saveBest();
    }
  }

  saveBest() {
    if (this.score > this.best) {
      this.best = this.score;
      try { localStorage.setItem('neon-void-best', String(this.best)); } catch { /* offline sandbox */ }
    }
  }

  presentUpgrades() {
    const pool = UPGRADES.filter((u) => !u.available || u.available(this.player));
    const picks = [];
    const copy = [...pool];
    while (picks.length < 3 && copy.length > 0) {
      const idx = Math.floor(this.rng() * copy.length);
      picks.push(copy.splice(idx, 1)[0]);
    }
    this.upgradeChoices = picks;
    this.state = 'upgrade';
    this.sfx.waveClear();
  }

  upgradeCardRects() {
    const rects = [];
    const w = 252; const h = 176; const gap = 22;
    const total = w * 3 + gap * 2;
    const startX = (WORLD.width - total) / 2;
    const y = 218;
    for (let i = 0; i < 3; i++) rects.push({ x: startX + i * (w + gap), y, w, h });
    return rects;
  }

  updateUpgradeChoice(key) {
    const rects = this.upgradeCardRects();
    let chosen = -1;
    if (key === 'Digit1') chosen = 0;
    if (key === 'Digit2') chosen = 1;
    if (key === 'Digit3') chosen = 2;
    const click = this.input.consumeClick();
    if (click) {
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        if (click.x >= r.x && click.x <= r.x + r.w && click.y >= r.y && click.y <= r.y + r.h) chosen = i;
      }
    }
    if (chosen >= 0 && this.upgradeChoices[chosen]) {
      this.upgradeChoices[chosen].apply(this.player);
      this.sfx.upgrade();
      this.state = 'playing';
      this.startWave(this.wave + 1);
    }
  }

  // --- Screenshot staging -------------------------------------------------
  // The kit takes screenshots through ?shot=<kind>&seed=<n>: each kind builds
  // a real game state with a seeded RNG and a simple autopilot, then freezes
  // it. The frames are genuine renders of the running game, never artwork.

  autopilotControls() {
    const p = this.player;
    let target = null; let bestD = Infinity;
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < bestD) { bestD = d; target = e; }
    }
    let mx = 0; let my = 0;
    if (target) {
      const dx = target.x - p.x; const dy = target.y - p.y;
      const want = 185;
      const radial = bestD > want + 26 ? 1 : bestD < want - 26 ? -1 : 0;
      const strafe = Math.sin(this.runTime * 0.9) * 0.7;
      const ux = dx / (bestD || 1); const uy = dy / (bestD || 1);
      mx = ux * radial - uy * strafe;
      my = uy * radial + ux * strafe;
    }
    return {
      mx, my,
      aimX: target ? target.x : p.x + 100, aimY: target ? target.y : p.y,
      fire: Boolean(target) && bestD < 560,
    };
  }

  simulate(seconds) {
    const steps = Math.floor(seconds * 60);
    for (let i = 0; i < steps; i++) {
      this.auto = this.autopilotControls();
      this.updatePlaying(1 / 60);
      if (this.state !== 'playing') break;
    }
    this.auto = null;
  }

  stageShot(kind, seed) {
    const s = Number.isFinite(seed) ? seed : 1;
    if (kind === 'menu') {
      this.rng = mulberry32(s * 7919);
      this.state = 'menu';
      this.player.x = WORLD.width / 2;
      this.player.y = 452; // parked below the menu text, as on the title screen
      return;
    }
    this.startRun(s * 104729 + 7);
    if (kind === 'play') {
      // A mid-wave-3 firefight in a ship that already earned two upgrades:
      // split cannon, rapid cycler and a reinforced hull (400 HP) that also
      // keeps the staging simulation alive for the whole take.
      this.player.fireRate *= 1.22;
      this.player.projectiles = 2;
      this.player.maxHp = 400;
      this.player.hp = 400;
      this.score = 2450; this.cores = 17; this.kills = 23;
      this.wave = 2; this.startWave(3);
      for (let chunk = 0; chunk < 11 && this.state === 'playing'; chunk++) {
        this.simulate(1);
        if (this.state === 'upgrade') { this.updateUpgradeChoice('Digit1'); }
      }
      if (this.state === 'playing') {
        // Enemies enter from off-screen, so a freshly topped-up field can
        // still photograph empty: place a ring of hostiles inside the arena
        // around the player, then run a third of a second of live fire so
        // bolts, thrust and motion are all in the frame before it freezes.
        const ring = [[-270, -150], [300, -100], [220, 180], [-310, 130], [30, -310], [-90, 290]];
        const types = ['drone', 'dart', 'brute', 'drone', 'dart', 'drone'];
        const onScreen = this.enemies.filter((e) => e.x > 0 && e.x < WORLD.width && e.y > 0 && e.y < WORLD.height).length;
        for (let i = onScreen; i < 6; i++) {
          this.spawnEnemy(types[i % types.length]);
          const e = this.enemies[this.enemies.length - 1];
          e.x = Math.min(Math.max(this.player.x + ring[i % ring.length][0], 40), WORLD.width - 40);
          e.y = Math.min(Math.max(this.player.y + ring[i % ring.length][1], 40), WORLD.height - 40);
        }
        for (let s = 0; s < 22 && this.state === 'playing'; s++) {
          this.auto = this.autopilotControls();
          this.updatePlaying(1 / 60);
        }
        this.auto = null;
        this.player.hp = this.player.maxHp;
        if (this.enemies.length > 0) {
          this.burst(this.enemies[0].x, this.enemies[0].y, COLORS.drone, 12, 210);
        }
      }
      this.frozen = true;
      return;
    }
    if (kind === 'upgrade') {
      this.score = 1800; this.cores = 12; this.kills = 14;
      this.simulate(6);
      this.player.hp = Math.round(this.player.maxHp * 0.62);
      this.enemies = [];
      this.spawnQueue = [];
      // Two survivors hang back as backdrop while the choice is offered.
      this.spawnEnemy('drone');
      this.spawnEnemy('brute');
      for (const e of this.enemies) { e.x = 120 + this.rng() * 120; e.y = 90 + this.rng() * 80; }
      this.presentUpgrades();
      this.frozen = true;
      return;
    }
    if (kind === 'over') {
      this.score = 3120; this.cores = 21; this.kills = 29;
      this.wave = 3; this.startWave(4);
      this.simulate(7);
      this.runTime = 187; // the staged run lasted 3:07, as its stats claim
      this.damagePlayer(9999);
      this.frozen = true;
    }
  }
}

// --- Rendering (appended to the Game class via prototype) -------------------
// All art is drawn with canvas paths at run time: no image files, no fonts to
// load, nothing fetched. Neon edges come from shadowBlur over saturated
// strokes on a deep-space gradient with a parallax starfield and grid.

Game.prototype.render = function render() {
  const ctx = this.ctx;
  ctx.save();
  if (this.shake > 0) {
    ctx.translate((this.rng() - 0.5) * this.shake, (this.rng() - 0.5) * this.shake);
  }
  this.drawBackground(ctx);
  this.drawShards(ctx);
  this.drawEnemies(ctx);
  this.drawBullets(ctx);
  if (this.state !== 'over') this.drawPlayer(ctx);
  this.drawParticles(ctx);
  ctx.restore();
  this.drawTexts(ctx);
  this.drawHUD(ctx);
  if (this.state === 'menu') this.drawMenu(ctx);
  if (this.state === 'upgrade') this.drawUpgrade(ctx);
  if (this.state === 'paused') this.drawCenterPanel(ctx, 'PAUSED', 'Press P or Esc to resume');
  if (this.state === 'over') this.drawEndScreen(ctx, false);
  if (this.state === 'win') this.drawEndScreen(ctx, true);
};

Game.prototype.drawBackground = function drawBackground(ctx) {
  const grad = ctx.createLinearGradient(0, 0, 0, WORLD.height);
  grad.addColorStop(0, COLORS.backgroundTop);
  grad.addColorStop(1, COLORS.backgroundBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= WORLD.width; x += 48) { ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.height); }
  for (let y = 0; y <= WORLD.height; y += 48) { ctx.moveTo(0, y); ctx.lineTo(WORLD.width, y); }
  ctx.stroke();
  for (const star of this.stars) {
    ctx.globalAlpha = 0.25 + star.z * 0.6;
    ctx.fillStyle = '#bcd8ff';
    ctx.fillRect(star.x, star.y, star.z * 2.2, star.z * 2.2);
  }
  ctx.globalAlpha = 1;
};

Game.prototype.polygon = function polygon(ctx, x, y, radius, sides, rotation) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i / sides) * TAU;
    const px = x + Math.cos(a) * radius;
    const py = y + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
};

Game.prototype.drawPlayer = function drawPlayer(ctx) {
  const p = this.player;
  if (p.invuln > 0 && Math.floor(this.time * 16) % 2 === 0 && this.state === 'playing') return; // hit blink
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  // Engine flame.
  if (p.thrust > 0.15) {
    const flame = 12 + p.thrust * 12 + Math.sin(this.time * 40) * 3;
    ctx.beginPath();
    ctx.moveTo(-p.radius + 2, 5);
    ctx.lineTo(-p.radius - flame, 0);
    ctx.lineTo(-p.radius + 2, -5);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 170, 60, 0.85)';
    ctx.fill();
  }
  ctx.shadowColor = COLORS.player;
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.moveTo(p.radius + 5, 0);
  ctx.lineTo(-p.radius, p.radius - 2);
  ctx.lineTo(-p.radius + 5, 0);
  ctx.lineTo(-p.radius, -p.radius + 2);
  ctx.closePath();
  ctx.fillStyle = '#0b2b3d';
  ctx.fill();
  ctx.strokeStyle = COLORS.player;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, TAU);
  ctx.fillStyle = COLORS.playerCore;
  ctx.fill();
  ctx.restore();
};

Game.prototype.drawEnemies = function drawEnemies(ctx) {
  for (const e of this.enemies) {
    const color = e.type === 'drone' ? COLORS.drone : e.type === 'dart' ? COLORS.dart : COLORS.brute;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.angle);
    ctx.shadowColor = color;
    ctx.shadowBlur = 13;
    ctx.fillStyle = e.flash > 0 ? '#ffffff' : 'rgba(16, 8, 26, 0.92)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    if (e.type === 'drone') {
      ctx.beginPath();
      ctx.moveTo(e.radius, 0);
      ctx.lineTo(-e.radius, e.radius * 0.8);
      ctx.lineTo(-e.radius * 0.4, 0);
      ctx.lineTo(-e.radius, -e.radius * 0.8);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    } else if (e.type === 'dart') {
      ctx.beginPath();
      ctx.moveTo(e.radius + 3, 0);
      ctx.lineTo(0, e.radius * 0.62);
      ctx.lineTo(-e.radius - 2, 0);
      ctx.lineTo(0, -e.radius * 0.62);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    } else {
      this.polygon(ctx, 0, 0, e.radius, 6, this.time * 0.7);
      ctx.fill(); ctx.stroke();
      this.polygon(ctx, 0, 0, e.radius * 0.55, 6, -this.time * 1.1);
      ctx.stroke();
    }
    ctx.restore();
    // Hull bar for anything tougher than a dart.
    if (e.maxHp > 20 && e.hp < e.maxHp) {
      const w = e.radius * 2;
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(e.x - e.radius, e.y - e.radius - 10, w, 3.5);
      ctx.fillStyle = color;
      ctx.fillRect(e.x - e.radius, e.y - e.radius - 10, w * Math.max(0, e.hp / e.maxHp), 3.5);
    }
  }
};

Game.prototype.drawBullets = function drawBullets(ctx) {
  ctx.save();
  ctx.shadowColor = COLORS.bullet;
  ctx.shadowBlur = 10;
  ctx.fillStyle = COLORS.bullet;
  for (const b of this.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
};

Game.prototype.drawShards = function drawShards(ctx) {
  ctx.save();
  ctx.shadowColor = COLORS.shard;
  ctx.shadowBlur = 9;
  ctx.fillStyle = COLORS.shard;
  for (const s of this.shards) {
    if (s.life < 2 && Math.floor(this.time * 10) % 2 === 0) continue; // expiry blink
    this.polygon(ctx, s.x, s.y, 6, 4, this.time * 2.4);
    ctx.fill();
  }
  ctx.restore();
};

Game.prototype.drawParticles = function drawParticles(ctx) {
  for (const p of this.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
};

Game.prototype.drawTexts = function drawTexts(ctx) {
  for (const t of this.texts) {
    ctx.globalAlpha = Math.max(0, Math.min(1, t.life / (t.maxLife * 0.6)));
    ctx.font = `700 ${t.size}px system-ui, "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
};

Game.prototype.drawHUD = function drawHUD(ctx) {
  if (this.state === 'menu') return;
  const p = this.player;
  // Hull bar, top left.
  ctx.textAlign = 'left';
  ctx.font = '700 12px system-ui, "Segoe UI", sans-serif';
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText('HULL', 18, 24);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(18, 30, 210, 12);
  const hullRatio = Math.max(0, p.hp / p.maxHp);
  ctx.fillStyle = hullRatio > 0.35 ? COLORS.shard : COLORS.heart;
  ctx.fillRect(18, 30, 210 * hullRatio, 12);
  ctx.strokeStyle = 'rgba(220,238,255,0.35)';
  ctx.strokeRect(18, 30, 210, 12);
  // Score and combo, top center.
  ctx.textAlign = 'center';
  ctx.font = '800 24px system-ui, "Segoe UI", sans-serif';
  ctx.fillStyle = COLORS.text;
  ctx.fillText(String(this.score).padStart(6, '0'), WORLD.width / 2, 34);
  if (this.combo >= 3) {
    ctx.font = '700 14px system-ui, "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.dart;
    ctx.fillText(`COMBO ×${this.multiplier().toFixed(1)}`, WORLD.width / 2, 56);
  }
  // Wave and hostiles, top right.
  ctx.textAlign = 'right';
  ctx.font = '700 15px system-ui, "Segoe UI", sans-serif';
  ctx.fillStyle = COLORS.text;
  ctx.fillText(`WAVE ${this.wave}`, WORLD.width - 18, 28);
  ctx.font = '600 12px system-ui, "Segoe UI", sans-serif';
  ctx.fillStyle = COLORS.textDim;
  const hostiles = this.enemies.length + this.spawnQueue.length;
  ctx.fillText(`HOSTILES ${hostiles}   ◆ CORES ${this.cores}`, WORLD.width - 18, 48);
  // Controls hint, bottom.
  ctx.textAlign = 'center';
  ctx.font = '500 11.5px system-ui, "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(127, 147, 184, 0.75)';
  ctx.fillText('WASD / arrows move · mouse aim · click or Space fire · P pause · M mute', WORLD.width / 2, WORLD.height - 12);
};

Game.prototype.roundRect = function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

Game.prototype.drawMenu = function drawMenu(ctx) {
  ctx.textAlign = 'center';
  ctx.save();
  ctx.shadowColor = COLORS.player;
  ctx.shadowBlur = 30;
  ctx.font = '900 84px system-ui, "Segoe UI", sans-serif';
  ctx.fillStyle = COLORS.player;
  ctx.fillText('NEON VOID', WORLD.width / 2, 168);
  ctx.restore();
  ctx.font = '600 19px system-ui, "Segoe UI", sans-serif';
  ctx.fillStyle = COLORS.text;
  ctx.fillText('Arena survival in a collapsing sector', WORLD.width / 2, 206);
  ctx.font = '500 15px system-ui, "Segoe UI", sans-serif';
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText('Blast the void swarm, harvest their cores, and bolt on upgrades between waves.', WORLD.width / 2, 258);
  ctx.fillText('Clear WAVE 10 to save the sector. Fall, and the void keeps your score.', WORLD.width / 2, 282);
  const pulse = 0.72 + Math.sin(this.time * 4) * 0.28;
  ctx.globalAlpha = pulse;
  ctx.font = '800 21px system-ui, "Segoe UI", sans-serif';
  ctx.fillStyle = COLORS.shard;
  ctx.fillText('CLICK OR PRESS ENTER TO LAUNCH', WORLD.width / 2, 348);
  ctx.globalAlpha = 1;
  ctx.font = '500 14px system-ui, "Segoe UI", sans-serif';
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText('Move  WASD / Arrow keys        Aim  Mouse        Fire  Hold click / Space', WORLD.width / 2, 396);
  ctx.fillText('Pause  P        Mute  M        Upgrades  Click a card or press 1 · 2 · 3', WORLD.width / 2, 422);
  if (this.best > 0) {
    ctx.font = '700 15px system-ui, "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.dart;
    ctx.fillText(`BEST SCORE  ${this.best}`, WORLD.width / 2, 504);
  }
};

Game.prototype.drawUpgrade = function drawUpgrade(ctx) {
  ctx.fillStyle = 'rgba(4, 6, 18, 0.55)';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  ctx.textAlign = 'center';
  ctx.font = '800 30px system-ui, "Segoe UI", sans-serif';
  ctx.fillStyle = COLORS.shard;
  ctx.fillText(`WAVE ${this.wave} CLEARED`, WORLD.width / 2, 128);
  ctx.font = '600 16px system-ui, "Segoe UI", sans-serif';
  ctx.fillStyle = COLORS.text;
  ctx.fillText('Choose one upgrade to bolt on', WORLD.width / 2, 158);
  const rects = this.upgradeCardRects();
  const mouse = this.input.mouse;
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    const u = this.upgradeChoices[i];
    if (!u) continue;
    const hover = mouse.x >= r.x && mouse.x <= r.x + r.w && mouse.y >= r.y && mouse.y <= r.y + r.h;
    this.roundRect(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.fillStyle = COLORS.panel;
    ctx.fill();
    ctx.strokeStyle = hover ? COLORS.shard : COLORS.panelEdge;
    ctx.lineWidth = hover ? 2.6 : 1.6;
    ctx.stroke();
    ctx.font = '900 34px system-ui, "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.player;
    ctx.fillText(u.icon, r.x + r.w / 2, r.y + 52);
    ctx.font = '800 18px system-ui, "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(u.name, r.x + r.w / 2, r.y + 88);
    ctx.font = '500 13px system-ui, "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.textDim;
    const words = u.blurb.split(' ');
    let line = ''; let lineY = r.y + 116;
    for (const word of words) {
      if ((line + ' ' + word).trim().length > 26) {
        ctx.fillText(line.trim(), r.x + r.w / 2, lineY);
        lineY += 17; line = word;
      } else line += ' ' + word;
    }
    ctx.fillText(line.trim(), r.x + r.w / 2, lineY);
    ctx.font = '700 13px system-ui, "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(`[ ${i + 1} ]`, r.x + r.w / 2, r.y + r.h - 14);
  }
};

Game.prototype.drawCenterPanel = function drawCenterPanel(ctx, title, subtitle) {
  ctx.fillStyle = 'rgba(4, 6, 18, 0.6)';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  ctx.textAlign = 'center';
  ctx.font = '900 44px system-ui, "Segoe UI", sans-serif';
  ctx.fillStyle = COLORS.text;
  ctx.fillText(title, WORLD.width / 2, WORLD.height / 2 - 6);
  ctx.font = '600 16px system-ui, "Segoe UI", sans-serif';
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText(subtitle, WORLD.width / 2, WORLD.height / 2 + 28);
};

Game.prototype.drawEndScreen = function drawEndScreen(ctx, won) {
  ctx.fillStyle = 'rgba(4, 6, 18, 0.62)';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  ctx.textAlign = 'center';
  ctx.save();
  ctx.shadowColor = won ? COLORS.shard : COLORS.heart;
  ctx.shadowBlur = 24;
  ctx.font = '900 56px system-ui, "Segoe UI", sans-serif';
  ctx.fillStyle = won ? COLORS.shard : COLORS.heart;
  ctx.fillText(won ? 'SECTOR SAVED' : 'SHIP LOST', WORLD.width / 2, 178);
  ctx.restore();
  ctx.font = '600 17px system-ui, "Segoe UI", sans-serif';
  ctx.fillStyle = COLORS.text;
  ctx.fillText(won ? 'You cleared all 10 waves of the void swarm.' : 'The void swarm overran your interceptor.', WORLD.width / 2, 216);
  ctx.font = '800 30px system-ui, "Segoe UI", sans-serif';
  ctx.fillStyle = COLORS.text;
  ctx.fillText(`SCORE  ${this.score}`, WORLD.width / 2, 286);
  ctx.font = '600 16px system-ui, "Segoe UI", sans-serif';
  ctx.fillStyle = COLORS.textDim;
  const mm = String(Math.floor(this.runTime / 60)).padStart(2, '0');
  const ss = String(Math.floor(this.runTime % 60)).padStart(2, '0');
  ctx.fillText(`Wave reached ${this.wave} · Kills ${this.kills} · Cores ${this.cores} · Time ${mm}:${ss}`, WORLD.width / 2, 320);
  if (this.score >= this.best && this.score > 0) {
    ctx.fillStyle = COLORS.dart;
    ctx.font = '700 15px system-ui, "Segoe UI", sans-serif';
    ctx.fillText('★ NEW BEST SCORE ★', WORLD.width / 2, 348);
  }
  ctx.font = '800 18px system-ui, "Segoe UI", sans-serif';
  ctx.fillStyle = COLORS.shard;
  ctx.fillText(won ? 'ENTER — Endless mode      R — New run' : 'Press R or click to fly again', WORLD.width / 2, 402);
};
