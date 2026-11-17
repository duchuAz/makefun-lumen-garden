// The painter: every screen of Lumen is drawn here with the 2D canvas API — the neon garden,
// its flowers, hive and spiders, the firefly and its glow trail, the pooled particles and waves,
// the HUD, and the title, pause, win and lose overlays. It reads the state game.js owns and
// never changes it; main.js gives it a canvas and a view size, and calls draw() once a frame.

import { FIELD, FONT, HEARTS, HIVE, LEVELS, PLAYER, PULSE } from './config.js';
import {
  SCREEN_LOSE,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
} from './game.js';

const WIDTH = FIELD.width;
const HEIGHT = FIELD.height;

const COLOR_CACHE = new Map();

function rgbOf(hex) {
  const cached = COLOR_CACHE.get(hex);
  if (cached !== undefined) return cached;
  let value = hex.replace('#', '');
  if (value.length === 3) value = value.split('').map((c) => c + c).join('');
  const parsed = [
    parseInt(value.slice(0, 2), 16) || 0,
    parseInt(value.slice(2, 4), 16) || 0,
    parseInt(value.slice(4, 6), 16) || 0,
  ];
  COLOR_CACHE.set(hex, parsed);
  return parsed;
}

/** A hex colour at an alpha, as a CSS rgba string. */
function alpha(hex, a) {
  const [r, g, b] = rgbOf(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, a))})`;
}

/** A soft radial haze, the game's main glow primitive. */
function glow(ctx, x, y, radius, hex, strength = 0.3) {
  if (radius <= 0 || strength <= 0) return;
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, alpha(hex, strength));
  gradient.addColorStop(0.45, alpha(hex, strength * 0.42));
  gradient.addColorStop(1, alpha(hex, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

/** A rounded rectangle path, independent of the browser's roundRect support. */
function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Text with hand-set tracking, so the display face keeps its letterspaced title look. */
function spaced(ctx, text, x, y, tracking, align = 'center') {
  const chars = [...text];
  let total = 0;
  for (let index = 0; index < chars.length; index += 1) {
    total += ctx.measureText(chars[index]).width + (index < chars.length - 1 ? tracking : 0);
  }
  let cursor = align === 'left' ? x : align === 'right' ? x - total : x - total / 2;
  const previous = ctx.textAlign;
  ctx.textAlign = 'left';
  for (let index = 0; index < chars.length; index += 1) {
    ctx.fillText(chars[index], cursor, y);
    cursor += ctx.measureText(chars[index]).width + tracking;
  }
  ctx.textAlign = previous;
  return total;
}

function heartPath(ctx, x, y, size) {
  const s = size / 16;
  ctx.beginPath();
  ctx.moveTo(x, y + 6 * s);
  ctx.bezierCurveTo(x, y + 2 * s, x - 3 * s, y - 2 * s, x - 6.4 * s, y - 2 * s);
  ctx.bezierCurveTo(x - 11.4 * s, y - 2 * s, x - 11.4 * s, y + 4.4 * s, x - 11.4 * s, y + 4.4 * s);
  ctx.bezierCurveTo(x - 11.4 * s, y + 9 * s, x - 6.6 * s, y + 12.6 * s, x, y + 16 * s);
  ctx.bezierCurveTo(x + 6.6 * s, y + 12.6 * s, x + 11.4 * s, y + 9 * s, x + 11.4 * s, y + 4.4 * s);
  ctx.bezierCurveTo(x + 11.4 * s, y + 4.4 * s, x + 11.4 * s, y - 2 * s, x + 6.4 * s, y - 2 * s);
  ctx.bezierCurveTo(x + 3 * s, y - 2 * s, x, y + 2 * s, x, y + 6 * s);
  ctx.closePath();
}

/** The canvas, its backing-store size and the transform that fits the 1280x720 field inside it. */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const view = { width: WIDTH, height: HEIGHT, scale: 1, offsetX: 0, offsetY: 0, dpr: 1, cssWidth: WIDTH, cssHeight: HEIGHT };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssWidth = Math.max(320, canvas.clientWidth || window.innerWidth || WIDTH);
    const cssHeight = Math.max(240, canvas.clientHeight || window.innerHeight || HEIGHT);
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    const scale = Math.min(cssWidth / WIDTH, cssHeight / HEIGHT);
    view.dpr = dpr;
    view.cssWidth = cssWidth;
    view.cssHeight = cssHeight;
    view.scale = scale;
    view.offsetX = (cssWidth - WIDTH * scale) / 2;
    view.offsetY = (cssHeight - HEIGHT * scale) / 2;
    view.width = WIDTH;
    view.height = HEIGHT;
  }

  resize();

  function world() {
    const { dpr, scale, offsetX, offsetY } = view;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offsetX, dpr * offsetY);
  }

  return { ctx, view, resize, world };
}

function drawSky(ctx, p) {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, p.skyTop);
  gradient.addColorStop(0.55, p.skyMid);
  gradient.addColorStop(1, p.skyBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(-60, -60, WIDTH + 120, HEIGHT + 120);
}

function drawStars(ctx, p, decor, time) {
  for (let index = 0; index < decor.stars.length; index += 1) {
    const star = decor.stars[index];
    const twinkle = 0.55 + 0.45 * Math.sin(time * star.speed + star.phase);
    ctx.fillStyle = alpha(p.star, star.a * twinkle);
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
    if (star.r > 1.35) {
      ctx.fillStyle = alpha(p.star, star.a * twinkle * 0.18);
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawMoon(ctx, p, time) {
  const x = 1082;
  const y = 188;
  const pulse = 1 + Math.sin(time * 0.5) * 0.02;
  glow(ctx, x, y, 150 * pulse, p.moonGlow, 0.16);
  const body = ctx.createRadialGradient(x - 9, y - 11, 3, x, y, 34);
  body.addColorStop(0, p.moon);
  body.addColorStop(0.72, p.moon);
  body.addColorStop(1, p.moonGlow);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, 33, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = alpha(p.skyMid, 0.16);
  ctx.beginPath();
  ctx.arc(x - 8, y + 7, 6, 0, Math.PI * 2);
  ctx.arc(x + 11, y - 5, 4, 0, Math.PI * 2);
  ctx.arc(x + 2, y + 16, 3, 0, Math.PI * 2);
  ctx.fill();
}

function hillPath(ctx, hill) {
  ctx.beginPath();
  ctx.moveTo(-40, HEIGHT + 40);
  for (let x = -40; x <= WIDTH + 40; x += 18) {
    const y = hill.y + Math.sin(x * hill.freq + hill.phase) * hill.amp + Math.sin(x * hill.freq * 2.3 + hill.phase * 1.7) * hill.amp * 0.28;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(WIDTH + 40, HEIGHT + 40);
  ctx.closePath();
}

function drawHills(ctx, p, decor) {
  const tones = { far: p.hillFar, mid: p.hillMid, near: p.hillNear };
  for (let index = 0; index < decor.hills.length; index += 1) {
    const hill = decor.hills[index];
    hillPath(ctx, hill);
    ctx.fillStyle = tones[hill.tone] || p.hillNear;
    ctx.fill();
    ctx.strokeStyle = alpha(p.foliageLight, 0.3);
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
}

function drawVines(ctx, p, decor, time) {
  for (let index = 0; index < decor.vines.length; index += 1) {
    const vine = decor.vines[index];
    const sway = Math.sin(time * 0.45 + vine.phase) * vine.sway;
    const endX = vine.x + sway;
    const endY = vine.length;
    ctx.strokeStyle = alpha(p.foliageLight, 0.7);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(vine.x, -4);
    ctx.bezierCurveTo(vine.x + sway * 0.3, vine.length * 0.4, endX - sway * 0.25, vine.length * 0.74, endX, endY);
    ctx.stroke();
    for (let leaf = 0; leaf < vine.leaves; leaf += 1) {
      const t = (leaf + 1) / (vine.leaves + 1);
      const lx = vine.x + sway * t * t;
      const ly = vine.length * t;
      const side = leaf % 2 === 0 ? 1 : -1;
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(side * 0.7 + Math.sin(time * 0.8 + leaf + vine.phase) * 0.16);
      ctx.fillStyle = alpha(p.leaf, 0.62);
      ctx.beginPath();
      ctx.ellipse(5 * vine.scale * side, 0, 9 * vine.scale, 3.4 * vine.scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (vine.glow) {
      glow(ctx, endX, endY, 26, p.accentSoft, 0.18 + 0.1 * Math.sin(time * 1.3 + vine.phase));
      ctx.fillStyle = alpha(p.accent, 0.85);
      ctx.beginPath();
      ctx.arc(endX, endY, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawGrass(ctx, p, decor, time) {
  for (let index = 0; index < decor.grass.length; index += 1) {
    const blade = decor.grass[index];
    const bend = Math.sin(time * 0.9 + blade.x * 0.02) * 2.4;
    ctx.strokeStyle = alpha(blade.tone > 0.82 ? p.leaf : p.grass, 0.45 + blade.tone * 0.42);
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(blade.x, blade.y);
    ctx.quadraticCurveTo(blade.x + blade.lean * 0.4 + bend, blade.y - blade.h * 0.6, blade.x + blade.lean + bend, blade.y - blade.h);
    ctx.stroke();
  }
}

function drawFern(ctx, p, fern, time) {
  const sway = Math.sin(time * 0.7 + fern.phase) * 0.06;
  for (let leaf = 0; leaf < 7; leaf += 1) {
    const spread = (-0.95 + leaf * 0.32) * fern.dir;
    ctx.save();
    ctx.translate(fern.x, fern.y);
    ctx.rotate(spread + sway);
    ctx.strokeStyle = alpha(p.foliageLight, 0.78);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(8 * fern.scale, -34 * fern.scale, 14 * fern.scale, -82 * fern.scale);
    ctx.stroke();
    for (let pinna = 1; pinna <= 4; pinna += 1) {
      const t = pinna / 5;
      const px = 10 * fern.scale * t;
      const py = -72 * fern.scale * t;
      ctx.strokeStyle = alpha(p.leaf, 0.6);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + 10 * fern.scale, py - 7 * fern.scale);
      ctx.moveTo(px, py);
      ctx.lineTo(px - 7 * fern.scale, py - 9 * fern.scale);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawMushroom(ctx, p, mushroom, time) {
  const pulse = 0.7 + 0.3 * Math.sin(time * 1.4 + mushroom.phase);
  glow(ctx, mushroom.x, mushroom.y - mushroom.r * 0.6, mushroom.r * 3.2, p.accentWarm, 0.1 * mushroom.glow * pulse);
  ctx.fillStyle = alpha(p.panel, 0.85);
  ctx.fillRect(mushroom.x - 1.6, mushroom.y - mushroom.r * 0.5, 3.2, mushroom.r * 0.9);
  ctx.fillStyle = alpha(p.hive, 0.55 + 0.3 * pulse);
  ctx.beginPath();
  ctx.ellipse(mushroom.x, mushroom.y - mushroom.r * 0.7, mushroom.r, mushroom.r * 0.62, 0, Math.PI, Math.PI * 2);
  ctx.fill();
}

function drawBloom(ctx, p, bloom, time) {
  const pulse = 0.7 + 0.3 * Math.sin(time * 1.1 + bloom.phase);
  const color = bloom.warm ? p.hiveGlow : p.accentSoft;
  glow(ctx, bloom.x, bloom.y, bloom.r * 4.2, color, 0.12 * pulse);
  ctx.fillStyle = alpha(bloom.warm ? p.hive : p.flower, 0.58 + 0.28 * pulse);
  ctx.beginPath();
  ctx.arc(bloom.x, bloom.y, bloom.r * 0.55, 0, Math.PI * 2);
  ctx.fill();
}

function drawMotes(ctx, p, decor, time) {
  for (let index = 0; index < decor.motes.length; index += 1) {
    const mote = decor.motes[index];
    const x = mote.x + Math.sin(time * 0.24 + mote.phase) * mote.drift;
    const y = mote.y + Math.sin(time * mote.speed * 0.12 + mote.phase) * 16;
    ctx.fillStyle = alpha(p.star, mote.alpha * (0.6 + 0.4 * Math.sin(time * 0.9 + mote.phase)));
    ctx.beginPath();
    ctx.arc(x, y, mote.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWebs(ctx, p, webs, time) {
  const spokes = 11;
  for (let index = 0; index < webs.length; index += 1) {
    const web = webs[index];
    const spin = Math.sin(time * 0.3 + web.phase) * 0.06;
    glow(ctx, web.x, web.y, web.r * 1.25, p.web, 0.05);
    ctx.strokeStyle = alpha(p.web, 0.2);
    ctx.lineWidth = 1;
    for (let spoke = 0; spoke < spokes; spoke += 1) {
      const angle = (spoke / spokes) * Math.PI * 2 + spin;
      ctx.beginPath();
      ctx.moveTo(web.x, web.y);
      ctx.lineTo(web.x + Math.cos(angle) * web.r, web.y + Math.sin(angle) * web.r);
      ctx.stroke();
    }
    ctx.strokeStyle = alpha(p.web, 0.16);
    for (let ring = 1; ring <= 4; ring += 1) {
      const radius = (web.r * ring) / 4;
      ctx.beginPath();
      for (let spoke = 0; spoke <= spokes; spoke += 1) {
        const angle = (spoke / spokes) * Math.PI * 2 + spin;
        const wobble = radius * (0.92 + 0.08 * Math.sin(spoke * 2.3 + time * 0.6));
        const px = web.x + Math.cos(angle) * wobble;
        const py = web.y + Math.sin(angle) * wobble;
        if (spoke === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }
}

function hexagon(ctx, x, y, radius, rotation = 0) {
  ctx.beginPath();
  for (let corner = 0; corner < 6; corner += 1) {
    const angle = rotation + (corner / 6) * Math.PI * 2;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (corner === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawHive(ctx, p, hive, delivered, time) {
  const goal = HIVE.goal;
  const progress = Math.min(1, delivered / goal);
  const pulse = 0.85 + 0.15 * Math.sin(time * 1.6);
  const flash = Math.min(1, hive.depositFlash);
  glow(ctx, hive.x, hive.y, 170 + flash * 90, p.hiveGlow, 0.18 * pulse + flash * 0.16);
  glow(ctx, hive.x, hive.y, 76, p.hive, 0.28);
  // The pollen already home colours the hive's heart.
  const core = ctx.createRadialGradient(hive.x, hive.y - 6, 2, hive.x, hive.y, 46);
  core.addColorStop(0, p.hive);
  core.addColorStop(0.55, alpha(p.hive, 0.72));
  core.addColorStop(1, alpha(p.hiveDeep, 0.2));
  ctx.fillStyle = core;
  hexagon(ctx, hive.x, hive.y, 41, Math.PI / 6);
  ctx.fill();
  for (let cell = 0; cell < 7; cell += 1) {
    const angle = (cell / 7) * Math.PI * 2 + Math.PI / 6;
    const cx = hive.x + Math.cos(angle) * 24;
    const cy = hive.y + Math.sin(angle) * 24;
    const lit = cell / 7 < progress;
    ctx.fillStyle = lit ? alpha(p.pollen, 0.7 + 0.25 * pulse) : alpha(p.hiveDeep, 0.5);
    hexagon(ctx, cx, cy, 9, hive.spin + cell);
    ctx.fill();
    ctx.strokeStyle = alpha(p.hiveGlow, 0.4);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // Rotating outer combs and a progress arc.
  ctx.strokeStyle = alpha(p.hiveGlow, 0.8);
  ctx.lineWidth = 2.4;
  hexagon(ctx, hive.x, hive.y, 50, hive.spin * 0.6);
  ctx.stroke();
  ctx.strokeStyle = alpha(p.hive, 0.34);
  ctx.lineWidth = 1;
  hexagon(ctx, hive.x, hive.y, 58, -hive.spin * 0.4);
  ctx.stroke();
  ctx.strokeStyle = alpha(p.pollen, 0.28);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(hive.x, hive.y, 68, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
  ctx.stroke();
  // The deposit ring.
  if (flash > 0.01) {
    ctx.strokeStyle = alpha(p.hiveGlow, flash * 0.8);
    ctx.lineWidth = 2 + flash * 5;
    ctx.beginPath();
    ctx.arc(hive.x, hive.y, 52 + (1 - flash) * 70, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = alpha(p.text, 0.92);
  ctx.font = `600 11px ${FONT.mono}`;
  ctx.textAlign = 'center';
  ctx.fillText('HIVE', hive.x, hive.y + 92);
  ctx.fillStyle = alpha(p.hiveGlow, 0.7);
  ctx.fillText(`${delivered} / ${goal}`, hive.x, hive.y + 108);
  ctx.textAlign = 'left';
}

function drawFlower(ctx, p, flower, time) {
  const sway = Math.sin(time * 0.9 + flower.phase) * 3.2;
  const x = flower.x + sway;
  const y = flower.y;
  const full = flower.pollen > 0;
  const open = full ? 1 : 0.62;
  glow(ctx, x, y, full ? 78 : 46, p.flower, full ? 0.2 : 0.07);
  ctx.strokeStyle = alpha(p.leaf, 0.85);
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x, y + 12);
  ctx.quadraticCurveTo(x - 2, y + 30, x - 9, y + 44);
  ctx.stroke();
  ctx.fillStyle = alpha(p.leaf, 0.7);
  ctx.beginPath();
  ctx.ellipse(x - 12, y + 34, 10, 4, -0.5, 0, Math.PI * 2);
  ctx.ellipse(x + 6, y + 40, 9, 3.6, 0.45, 0, Math.PI * 2);
  ctx.fill();
  // The petals, a rotating rosette that flashes when picked.
  const petalScore = 6;
  for (let petal = 0; petal < petalScore; petal += 1) {
    const angle = time * 0.18 + flower.phase + (petal / petalScore) * Math.PI * 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const petalGradient = ctx.createLinearGradient(0, -6, 0, -32);
    petalGradient.addColorStop(0, alpha(p.flowerDeep, full ? 0.9 : 0.55));
    petalGradient.addColorStop(1, alpha(p.flower, full ? 0.85 : 0.4));
    ctx.fillStyle = petalGradient;
    ctx.strokeStyle = alpha(p.text, full ? 0.3 : 0.12);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, -18 * open, 7.4 * open, 14 * open, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  drawGlowCenter(ctx, p, flower, x, y, full);
  if (flower.flash > 0.01) {
    ctx.strokeStyle = alpha(p.pollen, flower.flash * 0.8);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 26 + (1 - flower.flash) * 26, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawGlowCenter(ctx, p, flower, x, y, full) {
  if (full) {
    glow(ctx, x, y, 30, p.pollen, 0.55);
    ctx.fillStyle = p.pollen;
  } else {
    ctx.fillStyle = alpha(p.flowerDeep, 0.9);
  }
  ctx.beginPath();
  ctx.arc(x, y, 8.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = full ? p.pollenSoft : alpha(p.panel, 0.8);
  ctx.beginPath();
  ctx.arc(x, y, 3.4, 0, Math.PI * 2);
  ctx.fill();
  if (!full) return;
  for (let dot = 0; dot < flower.pollen; dot += 1) {
    const angle = -Math.PI / 2 + dot * ((Math.PI * 2) / flower.max);
    ctx.fillStyle = alpha(p.text, 0.9);
    ctx.beginPath();
    ctx.arc(x + Math.cos(angle) * 13, y + Math.sin(angle) * 13, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSpider(ctx, p, spider, time) {
  const scared = spider.scared > 0;
  const stunned = spider.stun > 0;
  const alert = spider.alert > 0 && !scared;
  const body = scared ? p.accent : p.spider;
  // Legs first, under the body.
  ctx.lineCap = 'round';
  for (let side = -1; side <= 1; side += 2) {
    for (let leg = 0; leg < 4; leg += 1) {
      const base = side * (0.5 + leg * 0.34) + Math.PI / 2;
      const step = Math.sin(time * 9 + spider.phase + leg * 1.7 + (side > 0 ? 0 : 1.2)) * 0.18;
      const angle = base + step;
      const jointX = spider.x + Math.cos(angle) * 22;
      const jointY = spider.y + Math.sin(angle) * 22 - 6;
      const tipX = jointX + Math.cos(angle + side * 0.5) * 18;
      const tipY = jointY + Math.sin(angle + side * 0.5) * 18 + 8;
      ctx.strokeStyle = alpha(p.spiderDark, 0.95);
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(spider.x + side * 5, spider.y + 2);
      ctx.lineTo(jointX, jointY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
      ctx.strokeStyle = alpha(body, 0.5);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  // Abdomen and head.
  const skin = ctx.createRadialGradient(spider.x - 4, spider.y - 6, 2, spider.x, spider.y + 4, spider.r + 6);
  skin.addColorStop(0, alpha(body, 0.95));
  skin.addColorStop(0.55, alpha(p.spiderDark, 0.98));
  skin.addColorStop(1, alpha(p.spiderDark, 1));
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(spider.x, spider.y + 4, spider.r, spider.r * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = alpha(body, 0.85);
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = alpha(p.spiderDark, 1);
  ctx.beginPath();
  ctx.arc(spider.x, spider.y - 8, 9.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = alpha(body, 0.7);
  ctx.stroke();
  // The hourglass marking.
  ctx.fillStyle = alpha(body, 0.85);
  ctx.beginPath();
  ctx.moveTo(spider.x - 4, spider.y + 1);
  ctx.lineTo(spider.x + 4, spider.y + 1);
  ctx.lineTo(spider.x, spider.y + 5);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(spider.x - 4, spider.y + 11);
  ctx.lineTo(spider.x + 4, spider.y + 11);
  ctx.lineTo(spider.x, spider.y + 7);
  ctx.closePath();
  ctx.fill();
  // Eyes.
  for (let eye = -1; eye <= 1; eye += 2) {
    glow(ctx, spider.x + eye * 4, spider.y - 10, 9, scared ? p.accent : '#ff6f8c', 0.5);
    ctx.fillStyle = scared ? p.accent : '#ffd7e4';
    ctx.beginPath();
    ctx.arc(spider.x + eye * 4, spider.y - 10, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  if (spider.hurtFlash > 0.01) {
    ctx.fillStyle = alpha('#ffffff', spider.hurtFlash * 0.55);
    ctx.beginPath();
    ctx.arc(spider.x, spider.y, spider.r + 8, 0, Math.PI * 2);
    ctx.fill();
  }
  if (alert) {
    const bounce = Math.sin(time * 12) * 2;
    ctx.strokeStyle = alpha('#ff9ab0', spider.windup > 0 ? 0.9 : 0.4);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(spider.x, spider.y, spider.r + 11 + bounce, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd2dd';
    ctx.font = `700 20px ${FONT.body}`;
    ctx.textAlign = 'center';
    ctx.fillText('!', spider.x, spider.y - 34 - bounce);
    ctx.textAlign = 'left';
  }
  if (scared) {
    ctx.strokeStyle = alpha(p.accent, 0.5);
    ctx.lineWidth = 1.2;
    for (let dash = 0; dash < 3; dash += 1) {
      const angle = time * 2 + dash * 2.1;
      ctx.beginPath();
      ctx.arc(spider.x, spider.y, spider.r + 8 + dash * 3, angle, angle + 0.9);
      ctx.stroke();
    }
  }
  if (stunned) {
    for (let star = 0; star < 3; star += 1) {
      const angle = time * 3 + (star / 3) * Math.PI * 2;
      const sx = spider.x + Math.cos(angle) * 16;
      const sy = spider.y - 26 + Math.sin(angle) * 6;
      ctx.fillStyle = alpha(p.accentWarm, 0.9);
      ctx.beginPath();
      ctx.arc(sx, sy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawTrail(ctx, trail) {
  ctx.globalCompositeOperation = 'lighter';
  for (let index = 0; index < trail.length; index += 1) {
    const point = trail[index];
    const t = Math.max(0, point.life / point.maxLife);
    glow(ctx, point.x, point.y, point.size * 4.4, point.color, 0.16 * t);
    ctx.fillStyle = alpha(point.color, 0.5 * t);
    ctx.beginPath();
    ctx.arc(point.x, point.y, point.size * t, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawPlayer(ctx, p, player, state) {
  if (player.invuln > 0 && state.screen === SCREEN_PLAY) {
    const blink = 0.55 + 0.45 * Math.sin(state.time * 34);
    ctx.globalAlpha = blink;
  }
  const carrying = state.carried > 0;
  const light = carrying ? p.pollen : p.accent;
  const angle = Math.atan2(player.facingY, player.facingX) + Math.PI / 2;
  glow(ctx, player.x, player.y, 38, light, 0.38);
  if (player.dashTime > 0) {
    const speed = Math.hypot(player.vx, player.vy) || 1;
    const backX = player.x - (player.vx / speed) * 30;
    const backY = player.y - (player.vy / speed) * 30;
    ctx.strokeStyle = alpha(light, 0.5);
    ctx.lineWidth = 2.4;
    for (let line = -1; line <= 1; line += 1) {
      ctx.beginPath();
      ctx.moveTo(backX + line * 6, backY + line * 5);
      ctx.lineTo(player.x + line * 4, player.y + line * 4);
      ctx.stroke();
    }
  }
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(angle);
  // Wings, beating fast.
  const flap = Math.sin(player.wing) * 0.55;
  for (let side = -1; side <= 1; side += 2) {
    ctx.save();
    ctx.translate(side * 5, -3);
    ctx.rotate(side * (0.5 + flap));
    ctx.fillStyle = alpha(p.text, 0.3);
    ctx.strokeStyle = alpha(p.text, 0.5);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(side * 6, -4, 11.4, 5.2, side * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  // The glowing abdomen and dark head, facing up the local axis.
  const body = ctx.createLinearGradient(0, -10, 0, 13);
  body.addColorStop(0, p.panel);
  body.addColorStop(0.45, alpha(p.accentSoft, 0.95));
  body.addColorStop(1, light);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 3, 9, 12.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = alpha(p.text, 0.55);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = p.panel;
  ctx.beginPath();
  ctx.arc(0, -8.6, 6.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = alpha(p.text, 0.9);
  for (let eye = -1; eye <= 1; eye += 2) {
    ctx.beginPath();
    ctx.arc(eye * 2.1, -9.6, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  // The tail lamp.
  glow(ctx, 0, 12, 14, light, 0.6);
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.arc(0, 12, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Carried pollen orbits the firefly.
  for (let orb = 0; orb < state.carried; orb += 1) {
    const orbit = state.time * 2.2 + (orb / state.carried) * Math.PI * 2;
    const ox = player.x + Math.cos(orbit) * 22;
    const oy = player.y + Math.sin(orbit) * 22 - 4;
    glow(ctx, ox, oy, 12, p.pollen, 0.45);
    ctx.fillStyle = p.pollen;
    ctx.beginPath();
    ctx.arc(ox, oy, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }
  if (player.hurtFlash > 0.01) {
    ctx.fillStyle = alpha('#ff6f8c', player.hurtFlash * 0.4);
    ctx.beginPath();
    ctx.arc(player.x, player.y, 22, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFireflies(ctx, p, fireflies) {
  ctx.globalCompositeOperation = 'lighter';
  for (let index = 0; index < fireflies.length; index += 1) {
    const fly = fireflies[index];
    const color = fly.warm ? p.hiveGlow : p.accentWarm;
    glow(ctx, fly.x, fly.y, fly.size * 8, color, 0.16 * fly.pulse);
    ctx.fillStyle = alpha(color, 0.65 * fly.pulse);
    ctx.beginPath();
    ctx.arc(fly.x, fly.y, fly.size * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawParticles(ctx, particles) {
  ctx.globalCompositeOperation = 'lighter';
  for (let index = 0; index < particles.length; index += 1) {
    const particle = particles[index];
    if (!particle.active) continue;
    const t = Math.max(0, particle.life / particle.maxLife);
    const size = particle.size * (0.4 + 0.6 * t);
    if (particle.shape === 'streak') {
      ctx.strokeStyle = alpha(particle.color, 0.8 * t);
      ctx.lineWidth = Math.max(1, size * 0.7);
      ctx.beginPath();
      ctx.moveTo(particle.x, particle.y);
      ctx.lineTo(particle.x - particle.vx * 0.03, particle.y - particle.vy * 0.03);
      ctx.stroke();
    } else if (particle.shape === 'petal') {
      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.angle);
      ctx.fillStyle = alpha(particle.color, 0.85 * t);
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 1.8, size * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = alpha(particle.color, 0.9 * t);
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawWaves(ctx, waves) {
  ctx.globalCompositeOperation = 'lighter';
  for (let index = 0; index < waves.length; index += 1) {
    const wave = waves[index];
    const t = 1 - wave.age / wave.life;
    ctx.strokeStyle = alpha(wave.color, 0.55 * t);
    ctx.lineWidth = Math.max(1, wave.width * t);
    ctx.beginPath();
    ctx.arc(wave.x, wave.y, wave.r, 0, Math.PI * 2);
    ctx.stroke();
    if (wave.effect === 'pulse') {
      ctx.strokeStyle = alpha(wave.color, 0.22 * t);
      ctx.lineWidth = Math.max(1, wave.width * 2.4 * t);
      ctx.beginPath();
      ctx.arc(wave.x, wave.y, Math.max(0, wave.r - 16), 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawToasts(ctx, toasts) {
  for (let index = 0; index < toasts.length; index += 1) {
    const toast = toasts[index];
    const t = Math.max(0, toast.life / toast.maxLife);
    const a = Math.min(1, t * 2.4);
    ctx.font = `700 14px ${FONT.mono}`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3.4;
    ctx.strokeStyle = alpha('#04080f', 0.7 * a);
    ctx.strokeText(toast.text, toast.x, toast.y);
    ctx.fillStyle = alpha(toast.color, a);
    ctx.fillText(toast.text, toast.x, toast.y);
    ctx.textAlign = 'left';
  }
}

function drawFlash(ctx, flash) {
  if (!flash) return;
  ctx.fillStyle = alpha(flash.color, Math.max(0, flash.alpha));
  ctx.fillRect(-60, -60, WIDTH + 120, HEIGHT + 120);
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}

function panel(ctx, p, x, y, width, height, radius = 16) {
  ctx.fillStyle = alpha(p.panel, 0.78);
  roundRect(ctx, x, y, width, height, radius);
  ctx.fill();
  ctx.strokeStyle = alpha(p.panelEdge, 0.75);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.strokeStyle = alpha(p.accent, 0.14);
  roundRect(ctx, x + 2, y + 2, width - 4, height - 4, radius - 2);
  ctx.stroke();
}

function pips(ctx, p, x, y, count, filled, color, radius = 5.4) {
  for (let index = 0; index < count; index += 1) {
    const cx = x + index * (radius * 2 + 6);
    if (index < filled) {
      glow(ctx, cx, y, radius * 3.2, color, 0.35);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, y, radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = alpha(p.panelEdge, 0.25);
      ctx.beginPath();
      ctx.arc(cx, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = alpha(color, 0.35);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

function drawHearts(ctx, p, x, y, hearts, max) {
  for (let index = 0; index < max; index += 1) {
    const hx = x + index * 25;
    const alive = index < hearts;
    const beat = alive ? 1 + Math.sin(x * 0.1 + index) * 0.02 : 1;
    if (alive) glow(ctx, hx, y - 2, 17, p.spider, 0.18);
    heartPath(ctx, hx, y - 9, 17 * beat);
    if (alive) {
      const grad = ctx.createLinearGradient(hx - 8, y - 12, hx + 6, y + 4);
      grad.addColorStop(0, '#ffd2dd');
      grad.addColorStop(1, '#ff5f8a');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = alpha(p.panelEdge, 0.22);
    }
    ctx.fill();
    ctx.strokeStyle = alive ? alpha('#ffd2dd', 0.8) : alpha(p.panelEdge, 0.4);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawBar(ctx, p, x, y, width, value, color, label, state) {
  const height = 7;
  ctx.fillStyle = alpha(p.panelEdge, 0.24);
  roundRect(ctx, x, y, width, height, height / 2);
  ctx.fill();
  if (value > 0) {
    const fill = ctx.createLinearGradient(x, 0, x + width, 0);
    fill.addColorStop(0, alpha(color, 0.55));
    fill.addColorStop(1, color);
    ctx.fillStyle = fill;
    roundRect(ctx, x, y, Math.max(height, width * Math.min(1, value)), height, height / 2);
    ctx.fill();
  }
  ctx.fillStyle = alpha(p.muted, 0.9);
  ctx.font = `600 9.5px ${FONT.mono}`;
  ctx.fillText(label, x, y - 5);
  ctx.textAlign = 'right';
  ctx.fillStyle = alpha(value >= 1 ? p.accent : p.text, 0.9);
  ctx.fillText(state, x + width, y - 5);
  ctx.textAlign = 'left';
}

function objectiveLine(state) {
  if (state.carried > 0) {
    return `Carry ${state.carried} pollen home to the hive — ${Math.max(0, HIVE.goal - state.delivered)} to restore the garden`;
  }
  if (state.delivered >= HIVE.goal) return 'The garden is restored. Follow the last echo onward.';
  return 'Gather pollen from the glowing flowers — Shift to dash, Space to pulse';
}

function drawHud(ctx, p, state) {
  const top = 16;
  panel(ctx, p, 22, top, 1236, 74, 18);
  const name = LEVELS[state.level - 1];
  ctx.textAlign = 'left';
  ctx.fillStyle = alpha(p.muted, 0.9);
  ctx.font = `600 10px ${FONT.mono}`;
  spaced(ctx, 'LEVEL', 46, top + 24, 2, 'left');
  ctx.fillStyle = p.text;
  ctx.font = `700 21px ${FONT.display}`;
  ctx.fillText(`${state.level} / ${LEVELS.length}`, 46, top + 47);
  ctx.fillStyle = alpha(p.accentWarm, 0.95);
  ctx.font = `600 11px ${FONT.mono}`;
  spaced(ctx, name.name.toUpperCase(), 46, top + 63, 1.2, 'left');

  ctx.fillStyle = alpha(p.panelEdge, 0.5);
  ctx.fillRect(224, top + 16, 1, 44);

  // Pollen carried.
  ctx.fillStyle = alpha(p.muted, 0.9);
  ctx.font = `600 10px ${FONT.mono}`;
  spaced(ctx, 'POLLEN CARRIED', 244, top + 24, 1.2, 'left');
  ctx.font = `700 22px ${FONT.display}`;
  ctx.fillStyle = p.pollen;
  ctx.fillText(`${state.carried}`, 244, top + 48);
  const carriedWidth = ctx.measureText(`${state.carried}`).width;
  ctx.font = `600 12px ${FONT.mono}`;
  ctx.fillStyle = alpha(p.muted, 0.85);
  ctx.fillText(`/ ${PLAYER.carryMax}`, 244 + carriedWidth + 6, top + 48);
  pips(ctx, p, 244, top + 62, PLAYER.carryMax, state.carried, p.pollen, 4.6);

  // Hive progress.
  ctx.fillStyle = alpha(p.muted, 0.9);
  ctx.font = `600 10px ${FONT.mono}`;
  spaced(ctx, 'HIVE', 394, top + 24, 1.2, 'left');
  ctx.font = `700 22px ${FONT.display}`;
  ctx.fillStyle = p.hiveGlow;
  ctx.fillText(`${state.delivered}`, 394, top + 48);
  const hiveWidth = ctx.measureText(`${state.delivered}`).width;
  ctx.font = `600 12px ${FONT.mono}`;
  ctx.fillStyle = alpha(p.muted, 0.85);
  ctx.fillText(`/ ${HIVE.goal}`, 394 + hiveWidth + 6, top + 48);
  for (let pip = 0; pip < HIVE.goal; pip += 1) {
    const px = 394 + pip * 17;
    const py = top + 62;
    if (pip < state.delivered) {
      ctx.fillStyle = p.hiveGlow;
      hexagon(ctx, px, py, 5, Math.PI / 6);
      ctx.fill();
    } else {
      ctx.strokeStyle = alpha(p.hiveGlow, 0.34);
      ctx.lineWidth = 1;
      hexagon(ctx, px, py, 5, Math.PI / 6);
      ctx.stroke();
    }
  }

  ctx.fillStyle = alpha(p.panelEdge, 0.5);
  ctx.fillRect(532, top + 16, 1, 44);

  // Hearts.
  ctx.fillStyle = alpha(p.muted, 0.9);
  ctx.font = `600 10px ${FONT.mono}`;
  spaced(ctx, 'HEARTS', 552, top + 24, 1.2, 'left');
  drawHearts(ctx, p, 556, top + 52, state.hearts, HEARTS);

  ctx.fillStyle = alpha(p.panelEdge, 0.5);
  ctx.fillRect(650, top + 16, 1, 44);

  // Timer.
  ctx.fillStyle = alpha(p.muted, 0.9);
  ctx.font = `600 10px ${FONT.mono}`;
  spaced(ctx, 'TIME', 674, top + 24, 1.2, 'left');
  ctx.font = `700 20px ${FONT.display}`;
  ctx.fillStyle = p.text;
  ctx.fillText(formatTime(state.runTime), 674, top + 48);

  // Score.
  ctx.textAlign = 'right';
  ctx.fillStyle = alpha(p.muted, 0.9);
  ctx.font = `600 10px ${FONT.mono}`;
  spaced(ctx, 'SCORE', 1236, top + 24, 1.4, 'right');
  ctx.font = `700 26px ${FONT.display}`;
  ctx.fillStyle = p.text;
  ctx.fillText(state.score.toLocaleString('en-US'), 1236, top + 50);
  ctx.font = `600 10px ${FONT.mono}`;
  ctx.fillStyle = alpha(p.muted, 0.78);
  ctx.fillText(`BEST ${state.best.toLocaleString('en-US')}`, 1236, top + 64);
  ctx.textAlign = 'left';

  // Objective pill.
  const line = objectiveLine(state);
  ctx.font = `600 12px ${FONT.body}`;
  const textWidth = ctx.measureText(line).width;
  panel(ctx, p, 640 - textWidth / 2 - 22, 98, textWidth + 44, 27, 13);
  ctx.fillStyle = alpha(p.accent, 0.9);
  ctx.beginPath();
  ctx.arc(640 - textWidth / 2 - 7, 111.5, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = alpha(p.text, 0.92);
  ctx.textAlign = 'center';
  ctx.fillText(line, 640 + 5, 116);
  ctx.textAlign = 'left';

  // Cooldown bars, bottom left.
  panel(ctx, p, 22, 640, 318, 58, 14);
  const dashReady = 1 - state.player.dashCd / PLAYER.dashCooldown;
  const pulseReady = 1 - state.player.pulseCd / PULSE.cooldown;
  drawBar(
    ctx,
    p,
    40,
    662,
    280,
    dashReady,
    p.accent,
    'SHIFT · DASH',
    dashReady >= 1 ? 'READY' : `${Math.max(0, state.player.dashCd).toFixed(1)}S`,
  );
  drawBar(
    ctx,
    p,
    40,
    687,
    280,
    pulseReady,
    p.hiveGlow,
    'SPACE / CLICK · PULSE',
    pulseReady >= 1 ? 'READY' : `${Math.max(0, state.player.pulseCd).toFixed(1)}S`,
  );

  // Bottom right keys and mute state.
  ctx.textAlign = 'right';
  ctx.font = `600 10px ${FONT.mono}`;
  ctx.fillStyle = alpha(p.muted, 0.8);
  ctx.fillText(state.muted ? 'M · SOUND OFF' : 'M · SOUND ON', 1238, 672);
  ctx.fillStyle = alpha(p.muted, 0.55);
  ctx.fillText('P · PAUSE', 1238, 690);
  ctx.textAlign = 'left';
}

function drawBanner(ctx, p, banner) {
  const t = banner.timer / banner.max;
  const fade = Math.min(1, Math.min(t, 1 - t) * 6);
  const a = Math.max(0, Math.min(1, fade));
  ctx.globalAlpha = a;
  ctx.textAlign = 'center';
  ctx.fillStyle = alpha(p.accentWarm, 0.95);
  ctx.font = `700 34px ${FONT.display}`;
  ctx.shadowColor = alpha(p.accent, 0.5);
  ctx.shadowBlur = 24;
  spaced(ctx, banner.title, 640, 234, 5, 'center');
  ctx.shadowBlur = 0;
  ctx.fillStyle = alpha(p.muted, 0.95);
  ctx.font = `600 12px ${FONT.mono}`;
  spaced(ctx, banner.subtitle, 640, 258, 2.4, 'center');
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;
}

function dimScene(ctx, p, strength = 0.62) {
  const gradient = ctx.createRadialGradient(640, 330, 90, 640, 360, 780);
  gradient.addColorStop(0, alpha(p.panel, strength * 0.72));
  gradient.addColorStop(0.62, alpha(p.panel, strength));
  gradient.addColorStop(1, alpha(p.skyTop, Math.min(1, strength + 0.24)));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function frame(ctx, p, x, y, width, height, accent = p.accent) {
  panel(ctx, p, x, y, width, height, 24);
  const corners = 26;
  ctx.strokeStyle = alpha(accent, 0.6);
  ctx.lineWidth = 2;
  const spots = [
    [x + 14, y + 14, 1, 1],
    [x + width - 14, y + 14, -1, 1],
    [x + 14, y + height - 14, 1, -1],
    [x + width - 14, y + height - 14, -1, -1],
  ];
  for (let index = 0; index < spots.length; index += 1) {
    const [sx, sy, dx, dy] = spots[index];
    ctx.beginPath();
    ctx.moveTo(sx, sy + dy * corners);
    ctx.lineTo(sx, sy);
    ctx.lineTo(sx + dx * corners, sy);
    ctx.stroke();
  }
}

function drawTitleOverlay(ctx, p, state) {
  dimScene(ctx, p, 0.7);
  frame(ctx, p, 240, 128, 800, 468, p.accent);
  ctx.textAlign = 'center';
  ctx.fillStyle = alpha(p.accent, 0.9);
  ctx.font = `600 11px ${FONT.mono}`;
  spaced(ctx, 'A FIREFLY TALE', 640, 172, 5, 'center');

  ctx.save();
  const titleGradient = ctx.createLinearGradient(0, 190, 0, 286);
  titleGradient.addColorStop(0, p.text);
  titleGradient.addColorStop(0.58, p.accentSoft);
  titleGradient.addColorStop(1, p.hiveGlow);
  ctx.fillStyle = titleGradient;
  ctx.font = `700 94px ${FONT.display}`;
  ctx.shadowColor = alpha(p.accent, 0.55);
  ctx.shadowBlur = 40;
  spaced(ctx, 'LUMEN', 640, 268, 12, 'center');
  ctx.restore();

  ctx.fillStyle = alpha(p.muted, 0.95);
  ctx.font = `600 17px ${FONT.mono}`;
  spaced(ctx, 'GARDEN OF ECHOES', 640, 302, 8, 'center');

  ctx.strokeStyle = alpha(p.accent, 0.3);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(400, 322);
  ctx.lineTo(880, 322);
  ctx.stroke();

  ctx.fillStyle = alpha(p.text, 0.9);
  ctx.font = `400 17px ${FONT.display}`;
  ctx.fillText('The garden has gone dark. Carry the light home.', 640, 350);

  const chips = ['WASD / ARROWS  MOVE', 'SHIFT  DASH', 'SPACE / CLICK  PULSE', 'P  PAUSE', 'M  MUTE'];
  ctx.font = `600 10.5px ${FONT.mono}`;
  const chipWidths = chips.map((chip) => ctx.measureText(chip).width + 24);
  const gap = 10;
  const total = chipWidths.reduce((sum, width) => sum + width, 0) + gap * (chips.length - 1);
  let cursor = 640 - total / 2;
  for (let index = 0; index < chips.length; index += 1) {
    const width = chipWidths[index];
    ctx.fillStyle = alpha(p.panelEdge, 0.28);
    roundRect(ctx, cursor, 372, width, 24, 12);
    ctx.fill();
    ctx.strokeStyle = alpha(p.panelEdge, 0.6);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = alpha(p.muted, 0.95);
    ctx.fillText(chips[index], cursor + width / 2, 388);
    cursor += width + gap;
  }

  const pulse = 0.65 + 0.35 * Math.sin(state.time * 3.1);
  glow(ctx, 640, 448, 190, p.accent, 0.1 * pulse);
  ctx.fillStyle = alpha(p.accent, 0.6 + 0.4 * pulse);
  ctx.font = `700 16px ${FONT.mono}`;
  spaced(ctx, 'PRESS ENTER OR CLICK TO BEGIN', 640, 452, 2.4, 'center');

  ctx.fillStyle = alpha(p.muted, 0.75);
  ctx.font = `600 10px ${FONT.mono}`;
  spaced(ctx, 'RESTORE THREE GARDENS · FIVE POLLEN EACH · THREE HEARTS', 640, 524, 1.4, 'center');
  if (state.best > 0) {
    ctx.fillStyle = alpha(p.hiveGlow, 0.9);
    ctx.font = `600 11px ${FONT.mono}`;
    spaced(ctx, `BEST  ${state.best.toLocaleString('en-US')}`, 640, 552, 2.2, 'center');
  }
  ctx.textAlign = 'left';
}

function drawPauseOverlay(ctx, p, state) {
  dimScene(ctx, p, 0.68);
  frame(ctx, p, 400, 232, 480, 252, p.accent);
  ctx.textAlign = 'center';
  ctx.fillStyle = alpha(p.accent, 0.85);
  ctx.font = `600 10px ${FONT.mono}`;
  spaced(ctx, 'THE GARDEN HOLDS ITS BREATH', 640, 280, 2.4, 'center');
  ctx.fillStyle = p.text;
  ctx.font = `700 52px ${FONT.display}`;
  spaced(ctx, 'PAUSED', 640, 338, 8, 'center');
  ctx.fillStyle = alpha(p.text, 0.85);
  ctx.font = `600 13px ${FONT.mono}`;
  ctx.fillText('P or ENTER to resume', 640, 384);
  ctx.fillStyle = alpha(p.muted, 0.78);
  ctx.font = `400 12px ${FONT.body}`;
  ctx.fillText('M toggles sound · your run is safe', 640, 414);
  const pulse = 0.55 + 0.45 * Math.sin(state.time * 2.6);
  ctx.fillStyle = alpha(p.accentWarm, 0.5 + 0.4 * pulse);
  ctx.font = `600 11px ${FONT.mono}`;
  spaced(ctx, `SCORE ${state.score.toLocaleString('en-US')}`, 640, 452, 2, 'center');
  ctx.textAlign = 'left';
}

function stat(ctx, p, x, y, label, value, color = p.text) {
  ctx.textAlign = 'center';
  ctx.fillStyle = alpha(p.muted, 0.85);
  ctx.font = `600 9.5px ${FONT.mono}`;
  spaced(ctx, label, x, y, 2, 'center');
  ctx.fillStyle = color;
  ctx.font = `700 30px ${FONT.display}`;
  ctx.fillText(value, x, y + 32);
  ctx.textAlign = 'left';
}

function restartRow(ctx, p, state, y, win, text) {
  const pulse = 0.62 + 0.38 * Math.sin(state.time * 3);
  const width = 380;
  const x = 640 - width / 2;
  glow(ctx, 640, y + 20, 220, win ? p.accent : p.hiveGlow, 0.1 * pulse);
  ctx.fillStyle = alpha(win ? p.accent : p.hiveGlow, 0.1 + 0.08 * pulse);
  roundRect(ctx, x, y, width, 44, 22);
  ctx.fill();
  ctx.strokeStyle = alpha(win ? p.accent : p.hiveGlow, 0.5 + 0.3 * pulse);
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = alpha(p.text, 0.95);
  ctx.font = `700 13px ${FONT.mono}`;
  ctx.textAlign = 'center';
  spaced(ctx, text, 640, y + 27, 1.6, 'center');
  ctx.textAlign = 'left';
}

function drawWinOverlay(ctx, p, state) {
  dimScene(ctx, p, 0.66);
  frame(ctx, p, 240, 104, 800, 512, p.accent);
  ctx.textAlign = 'center';
  ctx.fillStyle = alpha(p.accentWarm, 0.92);
  ctx.font = `600 10.5px ${FONT.mono}`;
  spaced(ctx, 'ALL THREE GARDENS ARE AWAKE', 640, 150, 3.4, 'center');
  const gradient = ctx.createLinearGradient(0, 176, 0, 236);
  gradient.addColorStop(0, p.text);
  gradient.addColorStop(1, p.accentWarm);
  ctx.fillStyle = gradient;
  ctx.font = `700 56px ${FONT.display}`;
  ctx.shadowColor = alpha(p.accent, 0.5);
  ctx.shadowBlur = 30;
  spaced(ctx, 'GARDEN RESTORED', 640, 228, 5, 'center');
  ctx.shadowBlur = 0;
  ctx.fillStyle = alpha(p.muted, 0.92);
  ctx.font = `400 15px ${FONT.display}`;
  ctx.fillText('The last echo before dawn settles into light.', 640, 260);
  ctx.strokeStyle = alpha(p.accent, 0.28);
  ctx.beginPath();
  ctx.moveTo(330, 280);
  ctx.lineTo(950, 280);
  ctx.stroke();

  stat(ctx, p, 400, 314, 'FINAL SCORE', state.score.toLocaleString('en-US'), p.text);
  stat(ctx, p, 640, 314, 'TIME', formatTime(state.runTime), p.accent);
  stat(ctx, p, 880, 314, 'POLLEN GATHERED', state.pollenTotal.toLocaleString('en-US'), p.pollen);
  stat(ctx, p, 400, 384, 'GARDENS RESTORED', `3 / ${LEVELS.length}`, p.hiveGlow);
  stat(ctx, p, 640, 384, 'HEARTS LEFT', `${state.hearts} / ${HEARTS}`, '#ff9ab0');
  stat(ctx, p, 880, 384, 'GRADE', state.grade, p.accentWarm);

  if (state.score >= state.best) {
    ctx.fillStyle = alpha(p.accentWarm, 0.95);
    ctx.font = `700 11px ${FONT.mono}`;
    spaced(ctx, 'NEW BEST', 640, 438, 4, 'center');
  } else {
    ctx.fillStyle = alpha(p.muted, 0.85);
    ctx.font = `600 11px ${FONT.mono}`;
    spaced(ctx, `BEST  ${state.best.toLocaleString('en-US')}`, 640, 438, 2.4, 'center');
  }
  restartRow(ctx, p, state, 468, true, 'PRESS ENTER OR CLICK TO FLY AGAIN');
  ctx.fillStyle = alpha(p.muted, 0.7);
  ctx.font = `400 11px ${FONT.body}`;
  ctx.fillText('Thank you for carrying the light home.', 640, 544);
  ctx.textAlign = 'left';
}

function drawLoseOverlay(ctx, p, state) {
  dimScene(ctx, p, 0.72);
  frame(ctx, p, 268, 148, 744, 436, '#ff7a95');
  ctx.textAlign = 'center';
  ctx.fillStyle = alpha('#ffb4c2', 0.9);
  ctx.font = `600 10.5px ${FONT.mono}`;
  spaced(ctx, 'THE LIGHT WENT OUT', 640, 194, 3.4, 'center');
  const gradient = ctx.createLinearGradient(0, 218, 0, 278);
  gradient.addColorStop(0, '#ffe6ec');
  gradient.addColorStop(1, '#ff8fa8');
  ctx.fillStyle = gradient;
  ctx.font = `700 52px ${FONT.display}`;
  ctx.shadowColor = alpha('#ff5f8a', 0.45);
  ctx.shadowBlur = 28;
  spaced(ctx, 'THE GARDEN SLEEPS', 640, 270, 3.4, 'center');
  ctx.shadowBlur = 0;
  ctx.fillStyle = alpha(p.muted, 0.9);
  ctx.font = `400 15px ${FONT.display}`;
  ctx.fillText('But every sleeping garden is waiting for another dawn.', 640, 302);
  ctx.strokeStyle = alpha('#ff7a95', 0.24);
  ctx.beginPath();
  ctx.moveTo(340, 322);
  ctx.lineTo(940, 322);
  ctx.stroke();

  stat(ctx, p, 420, 356, 'SCORE', state.score.toLocaleString('en-US'), p.text);
  stat(ctx, p, 640, 356, 'LEVEL REACHED', `${state.level} / ${LEVELS.length}`, p.accentWarm);
  stat(ctx, p, 860, 356, 'POLLEN DELIVERED', `${state.delivered} / ${HIVE.goal}`, p.hiveGlow);
  ctx.fillStyle = alpha(p.muted, 0.75);
  ctx.font = `600 10px ${FONT.mono}`;
  spaced(ctx, `TIME IN THE GARDEN  ${formatTime(state.runTime)}`, 640, 424, 1.8, 'center');

  restartRow(ctx, p, state, 456, false, 'PRESS ENTER OR CLICK TO TRY AGAIN');
  ctx.fillStyle = alpha(p.muted, 0.7);
  ctx.font = `400 11px ${FONT.body}`;
  ctx.fillText('Tip: save a pulse for when a spider is close.', 640, 536);
  ctx.textAlign = 'left';
}

function drawScene(ctx, state) {
  const p = state.palette;
  const time = state.time;
  const shake = state.shake;
  const shakeX = shake > 0 ? Math.sin(time * 91) * shake * 0.55 + Math.sin(time * 47) * shake * 0.3 : 0;
  const shakeY = shake > 0 ? Math.cos(time * 83) * shake * 0.5 : 0;
  ctx.save();
  ctx.translate(shakeX, shakeY);
  drawSky(ctx, p);
  drawStars(ctx, p, state.decor, time);
  drawMoon(ctx, p, time);
  drawHills(ctx, p, state.decor);
  drawVines(ctx, p, state.decor, time);
  drawMotes(ctx, p, state.decor, time);
  drawWebs(ctx, p, state.webs, time);
  for (let index = 0; index < state.decor.bgBlooms.length; index += 1) drawBloom(ctx, p, state.decor.bgBlooms[index], time);
  for (let index = 0; index < state.decor.mushrooms.length; index += 1) drawMushroom(ctx, p, state.decor.mushrooms[index], time);
  for (let index = 0; index < state.decor.ferns.length; index += 1) drawFern(ctx, p, state.decor.ferns[index], time);
  drawGrass(ctx, p, state.decor, time);
  drawHive(ctx, p, state.hive, state.delivered, time);
  for (let index = 0; index < state.flowers.length; index += 1) drawFlower(ctx, p, state.flowers[index], time);
  drawFireflies(ctx, p, state.fireflies);
  drawTrail(ctx, state.trail);
  drawParticles(ctx, state.particles);
  for (let index = 0; index < state.spiders.length; index += 1) drawSpider(ctx, p, state.spiders[index], time);
  drawPlayer(ctx, p, state.player, state);
  drawWaves(ctx, state.waves);
  drawToasts(ctx, state.toasts);
  drawFlash(ctx, state.flash);
  ctx.restore();
}

function drawVignette(ctx) {
  const gradient = ctx.createRadialGradient(640, 380, 300, 640, 380, 820);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(2,5,12,0.62)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

/** Paint one frame of a game state; the caller has set the 1280x720 view transform. */
export function draw(ctx, state) {
  // Clip to the logical field so decorations that sit just outside it never leak into the
  // black letterbox on a window that is not exactly 16:9.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, WIDTH, HEIGHT);
  ctx.clip();
  ctx.fillStyle = state.palette.skyTop;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  drawScene(ctx, state);
  drawVignette(ctx);
  if (state.screen === SCREEN_PLAY || state.screen === SCREEN_PAUSED) {
    drawHud(ctx, state.palette, state);
    if (state.banner && state.screen === SCREEN_PLAY) drawBanner(ctx, state.palette, state.banner);
  }
  if (state.screen === SCREEN_TITLE) drawTitleOverlay(ctx, state.palette, state);
  else if (state.screen === SCREEN_PAUSED) drawPauseOverlay(ctx, state.palette, state);
  else if (state.screen === SCREEN_WIN) drawWinOverlay(ctx, state.palette, state);
  else if (state.screen === SCREEN_LOSE) drawLoseOverlay(ctx, state.palette, state);
  ctx.restore();
}

export { drawScene };
