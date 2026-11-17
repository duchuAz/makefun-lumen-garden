// The bootstrap: sizes the canvas, builds the game, unlocks WebAudio on the first gesture,
// runs the fixed-timestep loop (60 updates a second whatever the display's refresh rate) and
// hands each frame to render.js. The ?shot=... scenes come from shots.js and are drawn exactly
// once, so screenshots are deterministic.

import { BEST_KEY, STEP } from './config.js';
import { createAudio, createSilentAudio } from './audio.js';
import { ACTION_PAUSE, createGame } from './game.js';
import { createInput } from './input.js';
import { createRandom } from './random.js';
import { createRenderer, draw } from './render.js';
import { seedFromLocation, shotFromLocation, stageShot } from './shots.js';

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const input = createInput(canvas);

const shot = shotFromLocation();
const seed = seedFromLocation();
const audio = shot ? createSilentAudio() : createAudio();

function readBest() {
  try {
    const value = Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '', 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function writeBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    /* A private window without storage still plays; the best just does not persist. */
  }
}

function announce(message) {
  if (status) status.textContent = message;
}

const game = createGame({
  random: createRandom(seed),
  audio,
  best: shot ? 0 : readBest(),
  initialMuted: false,
  onBest: writeBest,
  announce,
});

function resize() {
  renderer.resize();
  paint();
}

/** Clear the letterbox once in device pixels, then paint the logical 1280x720 frame. */
function paint() {
  const { ctx } = renderer;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#04070f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  renderer.world();
  draw(ctx, game.state);
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);

function unlockAudio() {
  audio.unlock();
}

if (!shot) {
  window.addEventListener('keydown', unlockAudio);
  window.addEventListener('pointerdown', unlockAudio);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state.screen === 'playing') game.handleActions(ACTION_PAUSE);
  });
}

if (shot) {
  stageShot(game, shot);
  announce(`Screenshot scene: ${shot}, seed ${seed}.`);
  paint();
  const redraw = () => {
    paint();
    window.requestAnimationFrame(redraw);
  };
  window.requestAnimationFrame(redraw);
} else {
  let previous = performance.now();
  let accumulator = 0;
  const frame = (now) => {
    const elapsed = Math.min(0.1, (now - previous) / 1000);
    previous = now;
    const actions = input.takeActions();
    if (actions !== 0) {
      audio.unlock();
      game.handleActions(actions);
    }
    accumulator += elapsed;
    let steps = 0;
    while (accumulator >= STEP && steps < 5) {
      game.update(STEP, input.axis());
      accumulator -= STEP;
      steps += 1;
    }
    if (steps === 5) accumulator = 0;
    paint();
    window.requestAnimationFrame(frame);
  };
  announce('Lumen: Garden of Echoes. Press Enter or click to begin.');
  window.requestAnimationFrame(frame);
}
