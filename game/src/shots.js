// Deterministic scenes behind ?shot=title|play|win|lose&seed=1. Each one builds the real game
// state, adds a few hand-placed effects and lets the visual systems settle for a fraction of a
// second, so a screenshot is a genuine frame of the running game and the same seed always gives
// the same frame. No Math.random is used here: every burst draws from the game's seeded RNG.

import { STEP } from './config.js';
import { addToast, addTrailPoint, addWave, spawnBurst } from './entities.js';
import { SCREEN_PLAY } from './game.js';

const SHOTS = new Set(['title', 'play', 'win', 'lose']);
const DEFAULT_SEED = 1;

/** The scene named in the page's query string, or null when this is a normal visit. */
export function shotFromLocation(search = window.location.search) {
  const params = new URLSearchParams(search);
  const name = params.get('shot');
  return SHOTS.has(name) ? name : null;
}

/** The integer seed for ?seed=..., defaulting to 1. */
export function seedFromLocation(search = window.location.search) {
  const value = Number.parseInt(new URLSearchParams(search).get('seed') ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_SEED;
}

/** Advance only the cosmetic systems, never the rules, so no spider can be hit while staging. */
function settle(game, seconds) {
  const state = game.state;
  const steps = Math.max(1, Math.round(seconds / STEP));
  for (let index = 0; index < steps; index += 1) {
    state.time += STEP;
    game.updateVisuals(STEP);
  }
}

function dressPlayScene(game) {
  const state = game.state;
  state.score = 2140;
  state.best = 3980;
  state.runTime = 96.4;
  state.hearts = 2;
  state.delivered = 3;
  state.carried = 2;
  state.pollenTotal = 13;
  state.banner = null;
  state.muted = false;
  state.hintCd = 1.4;
  state.player.x = 742;
  state.player.y = 388;
  state.player.facingX = 0.85;
  state.player.facingY = -0.4;
  state.player.vx = 210;
  state.player.vy = -96;
  state.player.invuln = 0;
  state.player.dashCd = 0.42;
  state.player.pulseCd = 1.55;
  state.flowers[0].pollen = 1;
  state.flowers[1].pollen = 0;
  state.flowers[1].regrow = 2.2;
  state.flowers[2].pollen = 2;
  state.flowers[3].pollen = 1;
  state.flowers[4].pollen = 2;
  // Three spiders: one closing in, one alert, one wandering the dark.
  const trio = [
    { x: 916, y: 300, state: 'chase', alert: 1, windup: 0.24, vx: -80, vy: 12 },
    { x: 512, y: 486, state: 'alert', alert: 1, windup: 0.3, vx: 46, vy: -18 },
    { x: 604, y: 176, state: 'wander', alert: 0, vx: 18, vy: 22 },
  ];
  for (let index = 0; index < state.spiders.length && index < trio.length; index += 1) {
    Object.assign(state.spiders[index], trio[index]);
  }
  // A glowing wake behind the firefly.
  for (let point = 0; point < 18; point += 1) {
    const t = point / 17;
    addTrailPoint(
      state,
      592 + t * 146 + Math.sin(t * 5.2) * 14,
      526 - t * 132 + Math.cos(t * 4.1) * 12,
      t > 0.55 ? state.palette.pollen : state.palette.accent,
      3.4 + t * 1.6,
      0.42 + t * 0.16,
    );
  }
  spawnBurst(state, {
    x: 998,
    y: 210,
    count: 16,
    colors: [state.palette.pollen, state.palette.pollenSoft, state.palette.text],
    speed: 180,
    speedMin: 30,
    size: 3.4,
    life: 0.85,
    shape: 'petal',
    gravity: 24,
  });
  spawnBurst(state, {
    x: 742,
    y: 388,
    count: 14,
    colors: [state.palette.accent, state.palette.accentWarm, state.palette.text],
    speed: 130,
    speedMin: 24,
    size: 3,
    life: 0.6,
    shape: 'dot',
  });
  spawnBurst(state, {
    x: 916,
    y: 300,
    count: 10,
    colors: [state.palette.accent, state.palette.text],
    speed: 120,
    size: 2.6,
    life: 0.5,
    shape: 'streak',
  });
  addWave(state, {
    x: 742,
    y: 388,
    max: 258,
    life: 0.55,
    width: 6,
    color: state.palette.accent,
    effect: 'pulse',
  });
  addToast(state, '+2 POLLEN', 858, 176, state.palette.pollen, 1.2);
  addToast(state, 'SCATTER', 916, 254, state.palette.accent, 0.9);
  settle(game, 0.19);
}

/** Stage the named scene on an already-created game. */
export function stageShot(game, name) {
  const state = game.state;
  if (name === 'title') {
    game.openTitle();
    state.best = 4180;
    for (let index = 0; index < state.flowers.length; index += 1) {
      const flower = state.flowers[index];
      spawnBurst(state, {
        x: flower.x,
        y: flower.y,
        count: 5,
        colors: [state.palette.pollen, state.palette.flower],
        speed: 46,
        speedMin: 8,
        size: 2.2,
        life: 1.1,
        shape: 'dot',
      });
    }
    settle(game, 1.35);
    return state.screen;
  }
  if (name === 'play') {
    game.startLevel(1);
    state.screen = SCREEN_PLAY;
    dressPlayScene(game);
    return state.screen;
  }
  if (name === 'win') {
    game.startLevel(2);
    state.score = 4480;
    state.best = 5120;
    state.runTime = 158.4;
    state.hearts = 3;
    state.delivered = 5;
    state.carried = 0;
    state.pollenTotal = 31;
    state.banner = null;
    state.muted = false;
    game.finishRun('win');
    settle(game, 0.42);
    return state.screen;
  }
  // lose
  game.startLevel(1);
  state.score = 1940;
  state.best = 3980;
  state.runTime = 137.2;
  state.hearts = 1;
  state.delivered = 2;
  state.carried = 0;
  state.pollenTotal = 9;
  state.banner = null;
  state.muted = false;
  game.finishRun('lose');
  settle(game, 0.34);
  return state.screen;
}
