// Neon Void — bootstrap: wire canvas, input, sound and the game together,
// run the fixed-step loop, and (for the kit's screenshots) stage a seeded
// scene when the page is opened with ?shot=<kind>&seed=<n>.

import { Game } from './game.js';
import { Input } from './input.js';
import { SoundFX } from './audio.js';
import { WORLD } from './config.js';

const canvas = document.getElementById('game');
canvas.width = WORLD.width;
canvas.height = WORLD.height;

const input = new Input(canvas);
const sfx = new SoundFX();
const game = new Game(canvas, input, sfx);

// Sound may only start after a user gesture; unlock on the first one.
window.addEventListener('pointerdown', () => sfx.unlock(), { passive: true });
window.addEventListener('keydown', () => sfx.unlock());

const status = document.getElementById('status');
function announce() {
  if (status) status.textContent = `Neon Void: ${game.state}, score ${game.score}, wave ${game.wave}, hull ${Math.ceil(game.player.hp)}`;
}

const params = new URLSearchParams(window.location.search);
if (params.has('shot')) {
  game.stageShot(params.get('shot'), Number(params.get('seed') || 1));
  announce();
}

// Fixed-step simulation (120 steps/s substeps of the frame delta, clamped)
// keeps gameplay identical on 60 Hz and 144 Hz displays.
let last = performance.now();
function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05;
  game.update(dt);
  game.render();
  if (Math.floor(now / 500) !== Math.floor((now - dt * 1000) / 500)) announce();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
