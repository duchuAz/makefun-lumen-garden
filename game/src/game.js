// The game's rules and the state machine: title, playing, paused, win and lose. It owns the
// level flow, movement, pollen pickup and deposit, spider pursuit, dashing, pulsing, scoring,
// hearts and collisions. It draws nothing and knows no screen size; the loop calls update()
// with a fixed step and render.js paints the state.

import {
  FIELD,
  FLOWER,
  HEARTS,
  HIVE,
  LEVELS,
  PALETTES,
  PLAYER,
  PULSE,
  SCORE,
  SPIDER,
} from './config.js';
import {
  addToast,
  addTrailPoint,
  addWave,
  clamp,
  createFireflies,
  createFlower,
  createGardenDecor,
  createHive,
  createParticlePool,
  createPlayer,
  createSpider,
  createWeb,
  distance,
  resetPlayer,
  spawnBurst,
  updateFireflies,
  updateParticles,
  updateToasts,
  updateTrail,
  updateWaves,
} from './entities.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'playing';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WIN = 'win';
export const SCREEN_LOSE = 'lose';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_DASH = 8;
export const ACTION_PULSE = 16;
export const ACTION_CLICK = 32;

const HIVE_X = 640;
const HIVE_Y = 300;

function createState(random, audio, best) {
  const state = {
    // The seeded generator the effects and the wandering spiders draw from.
    random,
    screen: SCREEN_TITLE,
    time: 0,
    runTime: 0,
    level: 1,
    palette: PALETTES[0],
    score: 0,
    hearts: HEARTS,
    delivered: 0,
    carried: 0,
    pollenTotal: 0,
    player: createPlayer(),
    hive: createHive(HIVE_X, HIVE_Y),
    flowers: [],
    spiders: [],
    webs: [],
    particles: createParticlePool(460),
    particleCursor: 0,
    waves: [],
    waveSeq: 0,
    toasts: [],
    trail: [],
    fireflies: createFireflies(random, 26),
    decor: createGardenDecor(random, 0),
    banner: null,
    clearing: 0,
    shake: 0,
    flash: null,
    best,
    grade: 'C',
    muted: audio.isMuted(),
    hintCd: 0,
    outcome: null,
  };
  return state;
}

export function createGame(options) {
  const { random, audio, best = 0, initialMuted = false, onBest = () => {}, announce = () => {} } = options;
  audio.setMuted(initialMuted);
  const state = createState(random, audio, best);

  function objectiveState() {
    return {
      level: state.level,
      delivered: state.delivered,
      carried: state.carried,
      goal: HIVE.goal,
      carryMax: PLAYER.carryMax,
    };
  }

  function clearEffects() {
    for (let index = 0; index < state.particles.length; index += 1) {
      state.particles[index].active = false;
    }
    state.particleCursor = 0;
    state.waves.length = 0;
    state.toasts.length = 0;
    state.trail.length = 0;
    state.shake = 0;
    state.flash = null;
    state.clearing = 0;
  }

  /** Build a whole garden for level index (0-based): decor, flowers, spiders, webs, hive, player. */
  function buildGarden(index, ambient = false) {
    const definition = LEVELS[index];
    state.level = index + 1;
    state.palette = PALETTES[index];
    state.decor = createGardenDecor(random, index);
    state.flowers = definition.flowers.map(([x, y], flowerIndex) => createFlower(x, y, FLOWER.pollen, flowerIndex));
    state.webs = definition.webs.map(([x, y, radius]) => createWeb(x, y, radius));
    state.spiders = ambient
      ? []
      : definition.spiders.map(([x, y], spiderIndex) =>
          createSpider(
            clamp(x + (random() - 0.5) * 48, FIELD.left + 20, FIELD.right - 20),
            clamp(y + (random() - 0.5) * 48, FIELD.top + 20, FIELD.bottom - 20),
            definition.spiderSpeed * (0.94 + random() * 0.12),
            spiderIndex * 1.7 + random() * 1.2,
          ),
        );
    state.hive = createHive(HIVE_X, HIVE_Y);
    clearEffects();
    resetPlayer(state.player, definition.start[0], definition.start[1]);
    state.delivered = 0;
    state.carried = 0;
    state.fireflies = createFireflies(random, ambient ? 32 : 22);
    state.banner = ambient
      ? null
      : {
          title: definition.name.toUpperCase(),
          subtitle: `LEVEL ${index + 1} · ${definition.spiders} ${definition.spiders === 1 ? 'SPIDER' : 'SPIDERS'}`,
          timer: 2.4,
          max: 2.4,
        };
  }

  /** The title screen's calm garden: flowers open, hive aglow, no spiders. */
  function openTitle() {
    state.screen = SCREEN_TITLE;
    state.outcome = null;
    state.grade = 'C';
    state.score = 0;
    state.hearts = HEARTS;
    state.pollenTotal = 0;
    state.runTime = 0;
    state.hintCd = 0;
    buildGarden(0, true);
    for (let index = 0; index < state.flowers.length; index += 1) {
      state.flowers[index].pollen = state.flowers[index].max;
    }
    state.banner = null;
    announce('Lumen: Garden of Echoes. Press Enter or click to begin.');
  }

  /** Start a fresh run from the title, win or lose screen. */
  function beginRun() {
    audio.click();
    state.score = 0;
    state.hearts = HEARTS;
    state.pollenTotal = 0;
    state.runTime = 0;
    state.outcome = null;
    state.grade = 'C';
    state.hintCd = 0;
    state.screen = SCREEN_PLAY;
    buildGarden(0);
    state.player.invuln = 1.1;
    announce(`Level 1, ${LEVELS[0].name}. Gather pollen and carry it to the hive.`);
  }

  /** Start a specific level (0-based index), used by the level flow and the screenshot scenes. */
  function startLevel(index) {
    const safeIndex = clamp(index, 0, LEVELS.length - 1);
    buildGarden(safeIndex);
    state.screen = SCREEN_PLAY;
    state.player.invuln = 1.2;
    state.clearing = 0;
    announce(`Level ${safeIndex + 1}, ${LEVELS[safeIndex].name}. ${LEVELS[safeIndex].hint}`);
  }

  function toggleMute() {
    state.muted = audio.toggleMute();
    addToast(state, state.muted ? 'SOUND OFF' : 'SOUND ON', 640, 632, state.palette.text, 1.1);
  }

  function tryDash() {
    const player = state.player;
    if (player.dashCd > 0 || state.clearing > 0 || state.screen !== SCREEN_PLAY) return;
    let dx = player.facingX;
    let dy = player.facingY;
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > 30) {
      dx = player.vx / speed;
      dy = player.vy / speed;
    } else if (dx === 0 && dy === 0) {
      dx = 0;
      dy = -1;
    }
    player.dashTime = PLAYER.dashTime;
    player.dashCd = PLAYER.dashCooldown;
    player.vx = dx * PLAYER.dashSpeed;
    player.vy = dy * PLAYER.dashSpeed;
    player.facingX = dx;
    player.facingY = dy;
    player.invuln = Math.max(player.invuln, PLAYER.dashTime + PLAYER.dashGuard);
    state.shake = Math.max(state.shake, 5);
    spawnBurst(state, {
      x: player.x - dx * 10,
      y: player.y - dy * 10,
      count: 12,
      colors: [state.palette.accent, state.palette.accentWarm, state.palette.text],
      speed: 230,
      speedMin: 50,
      angle: Math.atan2(-dy, -dx),
      spread: 1.4,
      size: 3.4,
      life: 0.45,
      shape: 'streak',
    });
    audio.dash();
  }

  function tryPulse() {
    const player = state.player;
    if (player.pulseCd > 0 || state.clearing > 0 || state.screen !== SCREEN_PLAY) return;
    player.pulseCd = PULSE.cooldown;
    addWave(state, {
      x: player.x,
      y: player.y,
      max: PULSE.radius,
      life: PULSE.duration,
      width: 6,
      color: state.palette.accent,
      effect: 'pulse',
    });
    spawnBurst(state, {
      x: player.x,
      y: player.y,
      count: 20,
      colors: [state.palette.accent, state.palette.accentWarm, state.palette.text],
      speed: 290,
      speedMin: 70,
      size: 3.4,
      life: 0.6,
      shape: 'dot',
    });
    state.shake = Math.max(state.shake, 6);
    audio.pulse();
  }

  /** Route one frame's one-shot presses to the screen that should hear them. */
  function handleActions(actions) {
    if (actions & ACTION_MUTE) toggleMute();
    if (actions & ACTION_PAUSE) {
      if (state.screen === SCREEN_PLAY) {
        state.screen = SCREEN_PAUSED;
        audio.click();
        addToast(state, 'PAUSED', 640, 632, state.palette.text, 0.8);
        announce('Paused.');
        return;
      }
      if (state.screen === SCREEN_PAUSED) {
        state.screen = SCREEN_PLAY;
        audio.click();
        announce('Playing.');
        return;
      }
    }
    if (state.screen === SCREEN_TITLE) {
      if (actions & (ACTION_CONFIRM | ACTION_CLICK)) beginRun();
      return;
    }
    if (state.screen === SCREEN_WIN || state.screen === SCREEN_LOSE) {
      if (actions & (ACTION_CONFIRM | ACTION_CLICK)) beginRun();
      return;
    }
    if (state.screen === SCREEN_PAUSED) {
      if (actions & (ACTION_CONFIRM | ACTION_CLICK)) {
        state.screen = SCREEN_PLAY;
        audio.click();
        announce('Playing.');
      }
      return;
    }
    if (state.screen === SCREEN_PLAY) {
      if (actions & ACTION_DASH) tryDash();
      if (actions & (ACTION_PULSE | ACTION_CLICK)) tryPulse();
    }
  }

  function isInWeb(x, y) {
    for (let index = 0; index < state.webs.length; index += 1) {
      const web = state.webs[index];
      if (distance(x, y, web.x, web.y) < web.r) return true;
    }
    return false;
  }

  function updatePlayer(dt, controls) {
    const player = state.player;
    player.invuln = Math.max(0, player.invuln - dt);
    player.dashTime = Math.max(0, player.dashTime - dt);
    player.dashCd = Math.max(0, player.dashCd - dt);
    player.pulseCd = Math.max(0, player.pulseCd - dt);
    player.hurtFlash = Math.max(0, player.hurtFlash - dt * 1.6);
    player.inWeb = isInWeb(player.x, player.y);

    if (player.dashTime > 0) {
      player.x += player.vx * dt;
      player.y += player.vy * dt;
    } else {
      const speed = PLAYER.speed * (player.inWeb ? 0.52 : 1);
      const targetX = controls.x * speed;
      const targetY = controls.y * speed;
      const blend = 1 - Math.exp(-PLAYER.turnRate * dt);
      player.vx += (targetX - player.vx) * blend;
      player.vy += (targetY - player.vy) * blend;
      player.x += player.vx * dt;
      player.y += player.vy * dt;
      if (controls.x !== 0 || controls.y !== 0) {
        const length = Math.hypot(controls.x, controls.y) || 1;
        player.facingX = controls.x / length;
        player.facingY = controls.y / length;
      }
    }

    const clampX = clamp(player.x, FIELD.left, FIELD.right);
    const clampY = clamp(player.y, FIELD.top, FIELD.bottom);
    if (clampX !== player.x) player.vx = 0;
    if (clampY !== player.y) player.vy = 0;
    player.x = clampX;
    player.y = clampY;

    const motion = Math.hypot(player.vx, player.vy);
    player.wing += dt * (11 + motion * 0.05);
    player.trailTimer -= dt;
    if (motion > 35 && player.trailTimer <= 0) {
      player.trailTimer = PLAYER.trailInterval;
      const color = state.carried > 0 ? state.palette.pollen : state.palette.accent;
      addTrailPoint(state, player.x, player.y, color, player.dashTime > 0 ? 7 : 4.2, player.dashTime > 0 ? 0.6 : 0.45);
      if (player.dashTime > 0) {
        spawnBurst(state, {
          x: player.x,
          y: player.y,
          count: 1,
          colors: [state.palette.accent, state.palette.pollen],
          speed: 40,
          size: 5,
          life: 0.4,
          shape: 'dot',
        });
      }
    }
  }

  function applyPulseWaves() {
    const player = state.player;
    for (let waveIndex = 0; waveIndex < state.waves.length; waveIndex += 1) {
      const wave = state.waves[waveIndex];
      if (wave.effect !== 'pulse') continue;
      for (let spiderIndex = 0; spiderIndex < state.spiders.length; spiderIndex += 1) {
        const spider = state.spiders[spiderIndex];
        if (spider.pulseTag === wave.id) continue;
        if (distance(wave.x, wave.y, spider.x, spider.y) > wave.r) continue;
        spider.pulseTag = wave.id;
        spider.scared = Math.max(spider.scared, PULSE.scare);
        spider.stun = Math.max(spider.stun, 0.12);
        const dx = spider.x - wave.x;
        const dy = spider.y - wave.y;
        const length = Math.hypot(dx, dy) || 1;
        spider.vx += (dx / length) * PULSE.knock;
        spider.vy += (dy / length) * PULSE.knock;
        spawnBurst(state, {
          x: spider.x,
          y: spider.y,
          count: 8,
          colors: [state.palette.accent, state.palette.text],
          speed: 150,
          size: 2.6,
          life: 0.5,
          shape: 'streak',
        });
        addToast(state, 'SCATTER', spider.x, spider.y - 36, state.palette.accent, 0.85);
        state.shake = Math.max(state.shake, 4);
      }
    }
  }

  function updateSpiders(dt, fleeing) {
    const player = state.player;
    const detection = state.carried > 0 ? SPIDER.detectCarrying : SPIDER.detect;
    for (let index = 0; index < state.spiders.length; index += 1) {
      const spider = state.spiders[index];
      spider.phase += dt * (2.4 + Math.hypot(spider.vx, spider.vy) * 0.035);
      spider.hurtFlash = Math.max(0, spider.hurtFlash - dt * 2);

      if (spider.stun > 0) {
        spider.stun -= dt;
        const damping = Math.exp(-5 * dt);
        spider.vx *= damping;
        spider.vy *= damping;
        spider.x = clamp(spider.x + spider.vx * dt, FIELD.left, FIELD.right);
        spider.y = clamp(spider.y + spider.vy * dt, FIELD.top, FIELD.bottom);
        continue;
      }

      const dx = player.x - spider.x;
      const dy = player.y - spider.y;
      const length = Math.hypot(dx, dy) || 1;
      let targetX = 0;
      let targetY = 0;
      let speed = 0;

      if (spider.scared > 0) {
        spider.scared -= dt;
        spider.state = 'flee';
        targetX = -dx / length;
        targetY = -dy / length;
        speed = SPIDER.fleeSpeed;
      } else if (fleeing || state.clearing > 0) {
        spider.state = 'flee';
        targetX = -dx / length;
        targetY = -dy / length;
        speed = SPIDER.fleeSpeed * 0.7;
      } else if (length < detection) {
        if (spider.state !== 'chase' && spider.state !== 'alert') {
          spider.state = 'alert';
          spider.windup = SPIDER.windup;
        }
        spider.alert = 1;
        if (spider.windup > 0) {
          spider.windup -= dt;
          targetX = (-dy / length) * 0.9 + (dx / length) * 0.25;
          targetY = (dx / length) * 0.9 + (dy / length) * 0.25;
          speed = spider.speed * 0.35;
          if (spider.windup <= 0) spider.state = 'chase';
        } else {
          spider.state = 'chase';
          targetX = dx / length;
          targetY = dy / length;
          speed = spider.speed;
        }
      } else {
        spider.alert = 0;
        if (spider.state === 'chase' || spider.state === 'alert') spider.state = 'wander';
        spider.wanderAngle += (state.random() - 0.5) * 2.4 * dt;
        targetX = Math.cos(spider.wanderAngle);
        targetY = Math.sin(spider.wanderAngle);
        speed = SPIDER.wanderSpeed;
      }

      for (let otherIndex = 0; otherIndex < state.spiders.length; otherIndex += 1) {
        if (otherIndex === index) continue;
        const other = state.spiders[otherIndex];
        const sx = spider.x - other.x;
        const sy = spider.y - other.y;
        const separation = Math.hypot(sx, sy);
        if (separation > 0.001 && separation < SPIDER.separation) {
          const push = (SPIDER.separation - separation) / SPIDER.separation;
          targetX += (sx / separation) * push * 1.6;
          targetY += (sy / separation) * push * 1.6;
        }
      }

      const blend = 1 - Math.exp(-3.4 * dt);
      spider.vx += (targetX * speed - spider.vx) * blend;
      spider.vy += (targetY * speed - spider.vy) * blend;
      const nextX = spider.x + spider.vx * dt;
      const nextY = spider.y + spider.vy * dt;
      if (nextX < FIELD.left || nextX > FIELD.right) {
        spider.vx *= -0.5;
        spider.wanderAngle += Math.PI;
      }
      if (nextY < FIELD.top || nextY > FIELD.bottom) {
        spider.vy *= -0.5;
        spider.wanderAngle += Math.PI;
      }
      spider.x = clamp(nextX, FIELD.left, FIELD.right);
      spider.y = clamp(nextY, FIELD.top, FIELD.bottom);
    }
  }

  function updateFlowers(dt) {
    const player = state.player;
    for (let index = 0; index < state.flowers.length; index += 1) {
      const flower = state.flowers[index];
      flower.phase += dt * flower.sway;
      flower.flash = Math.max(0, flower.flash - dt * 1.5);
      if (flower.pollen <= 0) {
        flower.regrow -= dt;
        if (flower.regrow <= 0) {
          flower.pollen = flower.max;
          flower.flash = 0.7;
          spawnBurst(state, {
            x: flower.x,
            y: flower.y,
            count: 8,
            colors: [state.palette.flower, state.palette.pollen],
            speed: 90,
            size: 2.6,
            life: 0.6,
            shape: 'dot',
          });
        }
      }
      const reach = PLAYER.radius + FLOWER.reach;
      if (distance(player.x, player.y, flower.x, flower.y) > reach || flower.pollen <= 0) continue;
      if (state.carried < PLAYER.carryMax) {
        const take = Math.min(flower.pollen, PLAYER.carryMax - state.carried);
        flower.pollen -= take;
        if (flower.pollen <= 0) flower.regrow = FLOWER.regrow;
        flower.flash = 0.6;
        state.carried += take;
        state.pollenTotal += take;
        state.score += SCORE.pickup * take;
        audio.pickup(state.carried);
        spawnBurst(state, {
          x: flower.x,
          y: flower.y,
          count: 10 + take * 6,
          colors: [state.palette.pollen, state.palette.pollenSoft, state.palette.text],
          speed: 190,
          speedMin: 30,
          size: 3.4,
          life: 0.75,
          shape: take > 1 ? 'petal' : 'dot',
          gravity: 40,
        });
        addToast(state, `+${take} POLLEN`, flower.x, flower.y - 42, state.palette.pollen, 1.1);
        state.shake = Math.max(state.shake, 3);
        announce(`${take} pollen gathered. ${state.carried} carried.`);
      } else if (state.hintCd <= 0) {
        addToast(state, 'CARRY FULL · FLY TO THE HIVE', flower.x, flower.y - 44, state.palette.accentWarm, 1.3);
        state.hintCd = 2.6;
      }
    }
  }

  function checkContact() {
    const player = state.player;
    if (player.invuln > 0 || state.clearing > 0) return;
    for (let index = 0; index < state.spiders.length; index += 1) {
      const spider = state.spiders[index];
      if (spider.stun > 0 || spider.scared > 0.35) continue;
      if (distance(player.x, player.y, spider.x, spider.y) > player.radius + spider.r + 3) continue;
      hurtPlayer(spider);
      break;
    }
  }

  function hurtPlayer(spider) {
    const player = state.player;
    state.hearts -= 1;
    player.invuln = PLAYER.hitInvulnerable;
    player.hurtFlash = 1;
    player.dashTime = 0;
    const dx = player.x - spider.x;
    const dy = player.y - spider.y;
    const length = Math.hypot(dx, dy) || 1;
    player.vx = (dx / length) * PLAYER.knockback;
    player.vy = (dy / length) * PLAYER.knockback;
    spider.vx = (-dx / length) * 210;
    spider.vy = (-dy / length) * 210;
    spider.stun = SPIDER.stun;
    spider.hurtFlash = 1;
    state.shake = 18;
    state.flash = { color: '#ff5f7e', alpha: 0.32 };
    addWave(state, {
      x: player.x,
      y: player.y,
      max: 190,
      life: 0.45,
      width: 4,
      color: '#ff7a95',
      effect: 'hit',
    });
    spawnBurst(state, {
      x: player.x,
      y: player.y,
      count: 22,
      colors: ['#ff6f8c', '#ffd2dd', state.palette.text],
      speed: 260,
      speedMin: 40,
      size: 3.6,
      life: 0.65,
      shape: 'streak',
    });
    addToast(state, '-1 HEART', player.x, player.y - 44, '#ff9ab0', 1.2);
    audio.hit();
    if (state.hearts <= 0) {
      state.hearts = 0;
      finishRun('lose');
      return;
    }
    announce(`Hit. ${state.hearts} ${state.hearts === 1 ? 'heart' : 'hearts'} left.`);
  }

  function checkHive() {
    const player = state.player;
    if (state.carried <= 0) return;
    if (distance(player.x, player.y, state.hive.x, state.hive.y) > HIVE.depositRadius) return;
    const amount = state.carried;
    state.carried = 0;
    state.delivered = Math.min(HIVE.goal, state.delivered + amount);
    state.score += SCORE.deposit * amount;
    state.hive.depositFlash = 0.9;
    state.shake = Math.max(state.shake, 7);
    state.flash = { color: state.palette.hiveGlow, alpha: 0.18 };
    addWave(state, {
      x: state.hive.x,
      y: state.hive.y,
      max: 150,
      life: 0.6,
      width: 3,
      color: state.palette.hiveGlow,
      effect: 'deposit',
    });
    spawnBurst(state, {
      x: state.hive.x,
      y: state.hive.y,
      count: 16 + amount * 7,
      colors: [state.palette.hiveGlow, state.palette.pollen, state.palette.text],
      speed: 210,
      speedMin: 30,
      size: 3.2,
      life: 0.9,
      shape: 'dot',
      gravity: -20,
    });
    addToast(state, `+${amount} DELIVERED`, state.hive.x, state.hive.y - 76, state.palette.hiveGlow, 1.3);
    audio.deposit(amount);
    announce(`${amount} pollen delivered. ${state.delivered} of ${HIVE.goal}.`);
    if (state.delivered >= HIVE.goal) completeLevel();
  }

  function completeLevel() {
    const definition = LEVELS[state.level - 1];
    const bonus = SCORE.level + state.hearts * SCORE.heart;
    state.score += bonus;
    state.hive.depositFlash = 1.4;
    state.shake = 18;
    state.flash = { color: state.palette.accent, alpha: 0.42 };
    addWave(state, {
      x: state.hive.x,
      y: state.hive.y,
      max: 340,
      life: 0.9,
      width: 8,
      color: state.palette.accent,
      effect: 'deposit',
    });
    spawnBurst(state, {
      x: state.hive.x,
      y: state.hive.y,
      count: 44,
      colors: [state.palette.accent, state.palette.pollen, state.palette.flower, state.palette.text],
      speed: 360,
      speedMin: 40,
      size: 4.4,
      life: 1.25,
      shape: 'petal',
      gravity: 20,
    });
    audio.levelClear();
    addToast(state, `GARDEN RESTORED  +${bonus}`, 640, 214, state.palette.accentWarm, 2.2);
    if (state.level >= LEVELS.length) {
      finishRun('win');
      return;
    }
    state.clearing = 2.1;
    state.banner = {
      title: 'GARDEN RESTORED',
      subtitle: `${definition.name.toUpperCase()} · +${bonus}`,
      timer: 2.1,
      max: 2.1,
    };
    state.player.invuln = Math.max(state.player.invuln, 2.4);
    announce(`${definition.name} restored. Onward to level ${state.level + 1}.`);
  }

  function gradeRun() {
    if (state.outcome !== 'win') return '—';
    if (state.runTime <= 165 && state.hearts === 3) return 'S';
    if (state.runTime <= 215 && state.hearts >= 2) return 'A';
    if (state.runTime <= 300) return 'B';
    return 'C';
  }

  /** End the run on the win or lose screen, record the best score and play the closing sound. */
  function finishRun(outcome) {
    if (state.screen === SCREEN_WIN || state.screen === SCREEN_LOSE) return;
    state.outcome = outcome;
    state.screen = outcome === 'win' ? SCREEN_WIN : SCREEN_LOSE;
    state.clearing = 0;
    state.banner = null;
    if (outcome === 'win') {
      state.score += SCORE.win;
      state.delivered = HIVE.goal;
      state.shake = 20;
      state.flash = { color: '#ffffff', alpha: 0.55 };
      for (let index = 0; index < state.flowers.length; index += 1) {
        state.flowers[index].pollen = state.flowers[index].max;
        state.flowers[index].flash = 0.9;
      }
      for (let index = 0; index < 60; index += 1) {
        spawnBurst(state, {
          x: state.hive.x + (state.random() - 0.5) * 320,
          y: state.hive.y + (state.random() - 0.5) * 220,
          count: 2,
          colors: [state.palette.accent, state.palette.pollen, state.palette.flower],
          speed: 190,
          size: 3.2,
          life: 1.6,
          shape: 'petal',
          gravity: 10,
        });
      }
      audio.win();
      announce(`Garden restored. Final score ${state.score}.`);
    } else {
      state.hearts = 0;
      state.shake = 16;
      state.flash = { color: '#ff4d6d', alpha: 0.4 };
      audio.lose();
      announce(`The garden sleeps. Score ${state.score}. Level reached ${state.level}.`);
    }
    state.grade = gradeRun();
    if (state.score > state.best) {
      state.best = state.score;
      onBest(state.best);
    }
  }

  function simulate(dt, controls) {
    if (state.banner) {
      state.banner.timer -= dt;
      if (state.banner.timer <= 0) state.banner = null;
    }
    if (state.clearing > 0) {
      state.clearing -= dt;
      updatePlayer(dt, controls);
      updateSpiders(dt, true);
      if (state.clearing <= 0 && state.screen === SCREEN_PLAY) startLevel(state.level);
      return;
    }
    state.runTime += dt;
    updatePlayer(dt, controls);
    applyPulseWaves();
    updateSpiders(dt, false);
    updateFlowers(dt);
    checkHive();
    if (state.screen !== SCREEN_PLAY) return;
    checkContact();
  }

  function updateVisuals(dt) {
    updateFireflies(state.fireflies, state.time);
    updateTrail(state, dt);
    updateParticles(state, dt);
    updateWaves(state, dt);
    updateToasts(state, dt);
    state.shake = Math.max(0, state.shake - dt * 36);
    state.hintCd = Math.max(0, state.hintCd - dt);
    state.hive.depositFlash = Math.max(0, state.hive.depositFlash - dt * 1.5);
    state.hive.spin += dt * 0.25;
    if (state.flash) {
      state.flash.alpha -= dt * 1.8;
      if (state.flash.alpha <= 0) state.flash = null;
    }
    for (let index = 0; index < state.flowers.length; index += 1) {
      state.flowers[index].flash = Math.max(0, state.flowers[index].flash - dt * 1.5);
    }
    for (let index = 0; index < state.spiders.length; index += 1) {
      state.spiders[index].hurtFlash = Math.max(0, state.spiders[index].hurtFlash - dt * 1.8);
    }
  }

  function update(dt, controls) {
    state.time += dt;
    updateVisuals(dt);
    if (state.screen === SCREEN_PLAY) simulate(dt, controls);
  }

  function snapshot() {
    return {
      screen: state.screen,
      level: state.level,
      delivered: state.delivered,
      carried: state.carried,
      hearts: state.hearts,
      score: state.score,
      goal: HIVE.goal,
      objective: objectiveState(),
    };
  }

  openTitle();

  return {
    state,
    snapshot,
    openTitle,
    beginRun,
    startLevel,
    finishRun,
    update,
    updateVisuals,
    handleActions,
  };
}
