// The garden's inhabitants and the small effects around them: the firefly you steer, the
// flowers that hold pollen, the hive, the spiders, drifting fireflies and decorative growth.
// Also the pooled systems for particles, expanding waves, floating text and the player's trail.
// Nothing here draws; render.js turns these plain objects into the scene.

import { FIELD, FLOWER, HIVE, PLAYER, SPIDER } from './config.js';

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function distance(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

export function createPlayer() {
  return {
    x: FIELD.width / 2,
    y: 600,
    vx: 0,
    vy: 0,
    facingX: 0,
    facingY: -1,
    radius: PLAYER.radius,
    dashTime: 0,
    dashCd: 0,
    pulseCd: 0,
    invuln: 0,
    hurtFlash: 0,
    wing: 0,
    trailTimer: 0,
    inWeb: false,
  };
}

export function resetPlayer(player, x, y) {
  player.x = x;
  player.y = y;
  player.vx = 0;
  player.vy = 0;
  player.facingX = 0;
  player.facingY = -1;
  player.dashTime = 0;
  player.dashCd = 0;
  player.pulseCd = 0;
  player.invuln = 0;
  player.hurtFlash = 0;
  player.trailTimer = 0;
  player.inWeb = false;
}

export function createHive(x, y) {
  return { x, y, r: HIVE.radius, depositFlash: 0, spin: 0, glow: 0 };
}

export function createFlower(x, y, pollen = FLOWER.pollen, index = 0) {
  return {
    x,
    y,
    r: FLOWER.radius,
    pollen,
    max: FLOWER.pollen,
    phase: (x * 0.013 + y * 0.017 + index * 0.9) % (Math.PI * 2),
    regrow: 0,
    flash: 0,
    sway: 0.6 + ((x + y) % 7) * 0.06,
  };
}

export function createSpider(x, y, speed, phase = 0) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    r: SPIDER.radius,
    speed,
    phase,
    state: 'wander',
    wanderAngle: phase,
    scared: 0,
    stun: 0,
    windup: 0,
    alert: 0,
    pulseTag: -1,
    hurtFlash: 0,
  };
}

export function createWeb(x, y, r) {
  return { x, y, r, phase: (x * 0.01 + y * 0.02) % (Math.PI * 2) };
}

/**
 * The static garden behind a level: stars, three hill ridges, hanging vines, ferns, mushrooms,
 * distant glowing blooms, grass and drifting motes. Seeded, so a seed grows the same garden.
 */
export function createGardenDecor(random, levelIndex) {
  const stars = [];
  for (let index = 0; index < 120; index += 1) {
    stars.push({
      x: random() * FIELD.width,
      y: 16 + random() * 390,
      r: 0.4 + random() * 1.5,
      a: 0.15 + random() * 0.55,
      phase: random() * Math.PI * 2,
      speed: 0.5 + random() * 1.4,
    });
  }

  const hills = [
    { y: 452 + levelIndex * 6, amp: 32, freq: 0.006, phase: random() * 6.28, tone: 'far' },
    { y: 528 + levelIndex * 4, amp: 44, freq: 0.0044, phase: random() * 6.28, tone: 'mid' },
    { y: 614, amp: 34, freq: 0.0075, phase: random() * 6.28, tone: 'near' },
  ];

  const vines = [];
  for (let index = 0; index < 7; index += 1) {
    const left = index % 2 === 0;
    vines.push({
      x: left ? 20 + random() * 330 : 930 + random() * 330,
      length: 110 + random() * 250,
      sway: 26 + random() * 52,
      phase: random() * Math.PI * 2,
      leaves: 4 + Math.floor(random() * 4),
      scale: 0.7 + random() * 0.7,
      glow: random() < 0.55,
    });
  }

  const ferns = [
    { x: 24, y: 700, dir: 1, scale: 1.05, phase: random() * 6.28 },
    { x: 1256, y: 700, dir: -1, scale: 1.15, phase: random() * 6.28 },
    { x: 150, y: 706, dir: 1, scale: 0.7, phase: random() * 6.28 },
    { x: 1130, y: 708, dir: -1, scale: 0.68, phase: random() * 6.28 },
  ];

  const mushrooms = [];
  for (let index = 0; index < 9; index += 1) {
    const left = index % 2 === 0;
    mushrooms.push({
      x: left ? 30 + random() * 230 : 1010 + random() * 240,
      y: 590 + random() * 100,
      r: 6 + random() * 14,
      glow: 0.5 + random() * 0.5,
      phase: random() * 6.28,
    });
  }

  const bgBlooms = [];
  for (let index = 0; index < 10; index += 1) {
    const left = index % 2 === 0;
    bgBlooms.push({
      x: left ? 30 + random() * 190 : 1060 + random() * 190,
      y: 300 + random() * 290,
      r: 5 + random() * 12,
      phase: random() * 6.28,
      warm: random() < 0.35,
    });
  }

  const grass = [];
  for (let index = 0; index < 150; index += 1) {
    grass.push({
      x: random() * FIELD.width,
      y: 646 + random() * 74,
      h: 6 + random() * 26,
      lean: (random() - 0.5) * 12,
      tone: random(),
    });
  }

  const motes = [];
  for (let index = 0; index < 30; index += 1) {
    motes.push({
      x: 20 + random() * 1240,
      y: 120 + random() * 560,
      r: 0.8 + random() * 1.8,
      speed: 4 + random() * 12,
      drift: (random() - 0.5) * 14,
      phase: random() * 6.28,
      alpha: 0.1 + random() * 0.35,
    });
  }

  return { stars, hills, vines, ferns, mushrooms, bgBlooms, grass, motes };
}

export function createFireflies(random, count = 22) {
  const fireflies = [];
  for (let index = 0; index < count; index += 1) {
    const ox = 50 + random() * 1180;
    const oy = 140 + random() * 500;
    fireflies.push({
      ox,
      oy,
      x: ox,
      y: oy,
      amp: 14 + random() * 52,
      speed: 0.12 + random() * 0.32,
      phase: random() * Math.PI * 2,
      size: 1.5 + random() * 2.6,
      warm: random() < 0.25,
      pulse: 0.8,
    });
  }
  return fireflies;
}

export function updateFireflies(fireflies, time) {
  for (let index = 0; index < fireflies.length; index += 1) {
    const fly = fireflies[index];
    fly.x = fly.ox + Math.sin(time * fly.speed + fly.phase) * fly.amp;
    fly.y = fly.oy + Math.cos(time * fly.speed * 0.83 + fly.phase * 1.7) * fly.amp * 0.62;
    fly.pulse = 0.72 + 0.28 * Math.sin(time * 2.1 + fly.phase * 3.1);
  }
}

/** A fixed pool of particles: spawnBurst reuses the oldest slot, so a long game allocates nothing. */
export function createParticlePool(size = 420) {
  const particles = [];
  for (let index = 0; index < size; index += 1) {
    particles.push({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 2,
      color: '#ffffff',
      gravity: 0,
      drag: 1,
      shape: 'dot',
      spin: 0,
      angle: 0,
    });
  }
  return particles;
}

function takeParticle(state) {
  const pool = state.particles;
  const particle = pool[state.particleCursor % pool.length];
  state.particleCursor = (state.particleCursor + 1) % pool.length;
  return particle;
}

export function spawnBurst(state, options) {
  const {
    x,
    y,
    count = 10,
    colors = ['#ffffff'],
    speed = 130,
    speedMin = speed * 0.2,
    angle = 0,
    spread = Math.PI * 2,
    size = 3,
    sizeMin = size * 0.4,
    life = 0.7,
    lifeMin = life * 0.4,
    gravity = 0,
    drag = 1.6,
    shape = 'dot',
  } = options;
  for (let index = 0; index < count; index += 1) {
    const particle = takeParticle(state);
    const direction = angle + (state.random() - 0.5) * spread;
    const velocity = speedMin + state.random() * (speed - speedMin);
    particle.active = true;
    particle.x = x + (state.random() - 0.5) * 12;
    particle.y = y + (state.random() - 0.5) * 12;
    particle.vx = Math.cos(direction) * velocity;
    particle.vy = Math.sin(direction) * velocity;
    particle.maxLife = lifeMin + state.random() * (life - lifeMin);
    particle.life = particle.maxLife;
    particle.size = sizeMin + state.random() * (size - sizeMin);
    particle.color = colors[Math.floor(state.random() * colors.length) % colors.length];
    particle.gravity = gravity;
    particle.drag = drag;
    particle.shape = shape;
    particle.angle = state.random() * Math.PI * 2;
    particle.spin = (state.random() - 0.5) * 8;
  }
}

export function addTrailPoint(state, x, y, color, size = 4, life = 0.5) {
  if (state.trail.length >= 150) state.trail.shift();
  state.trail.push({ x, y, life, maxLife: life, size, color });
}

export function addWave(state, options) {
  const { x, y, max = 250, life = 0.5, width = 5, color = '#ffffff', effect = 'ring' } = options;
  state.waveSeq += 1;
  state.waves.push({ id: state.waveSeq, x, y, r: 4, max, age: 0, life, width, color, effect });
}

export function addToast(state, text, x, y, color = '#ffffff', life = 1.5) {
  if (state.toasts.length >= 12) state.toasts.shift();
  state.toasts.push({ text, x, y, color, life, maxLife: life });
}

export function updateTrail(state, dt) {
  const trail = state.trail;
  for (let index = trail.length - 1; index >= 0; index -= 1) {
    trail[index].life -= dt;
    if (trail[index].life <= 0) trail.splice(index, 1);
  }
}

export function updateParticles(state, dt) {
  const particles = state.particles;
  for (let index = 0; index < particles.length; index += 1) {
    const particle = particles[index];
    if (!particle.active) continue;
    particle.life -= dt;
    if (particle.life <= 0) {
      particle.active = false;
      continue;
    }
    const damping = Math.exp(-particle.drag * dt);
    particle.vx *= damping;
    particle.vy = particle.vy * damping + particle.gravity * dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.angle += particle.spin * dt;
  }
}

export function updateWaves(state, dt) {
  const waves = state.waves;
  for (let index = waves.length - 1; index >= 0; index -= 1) {
    const wave = waves[index];
    wave.age += dt;
    if (wave.age >= wave.life) {
      waves.splice(index, 1);
      continue;
    }
    const progress = wave.age / wave.life;
    wave.r = 4 + (wave.max - 4) * (1 - (1 - progress) * (1 - progress));
  }
}

export function updateToasts(state, dt) {
  const toasts = state.toasts;
  for (let index = toasts.length - 1; index >= 0; index -= 1) {
    const toast = toasts[index];
    toast.life -= dt;
    toast.y -= dt * 26;
    if (toast.life <= 0) toasts.splice(index, 1);
  }
}
