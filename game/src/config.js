// Every tuning number, level layout and colour in one place. The garden is a fixed 1280x720
// logical field; the renderer scales it to the window, so no rule depends on the screen size.

export const FIELD = {
  width: 1280,
  height: 720,
  left: 42,
  right: 1238,
  top: 104,
  bottom: 676,
};

/** The simulation's fixed step in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  speed: 330,
  turnRate: 15,
  dashSpeed: 860,
  dashTime: 0.16,
  dashCooldown: 1.15,
  dashGuard: 0.1,
  hitInvulnerable: 1.8,
  knockback: 540,
  carryMax: 3,
  trailInterval: 0.032,
};

export const PULSE = {
  cooldown: 3,
  radius: 258,
  duration: 0.55,
  scare: 2.7,
  knock: 270,
  windup: 0.16,
};

export const HIVE = {
  radius: 52,
  depositRadius: 82,
  goal: 5,
};

export const HEARTS = 3;

export const SCORE = {
  pickup: 10,
  deposit: 60,
  level: 300,
  heart: 50,
  win: 1000,
};

export const FLOWER = {
  radius: 26,
  reach: 44,
  pollen: 2,
  regrow: 5.5,
};

export const SPIDER = {
  radius: 18,
  detect: 300,
  detectCarrying: 430,
  wanderSpeed: 46,
  fleeSpeed: 176,
  windup: 0.32,
  stun: 1.25,
  separation: 54,
};

export const LEVELS = [
  {
    name: 'Moonlit Terrace',
    tag: 'where the first light falls',
    flowers: [[318, 246], [962, 246], [356, 530], [924, 530]],
    spiders: [[250, 168], [1046, 626]],
    webs: [],
    start: [640, 602],
    spiderSpeed: 76,
    hint: 'Gather pollen, then bring it home to the hive.',
  },
  {
    name: 'Ember Hollow',
    tag: 'warmth lingers in the roots',
    flowers: [[282, 204], [998, 204], [300, 508], [980, 508], [640, 604]],
    spiders: [[186, 332], [1094, 332], [640, 156]],
    webs: [[492, 408, 94], [788, 408, 94]],
    start: [640, 470],
    spiderSpeed: 88,
    hint: 'Spiders wake when pollen moves. Dash past them.',
  },
  {
    name: 'Violet Canopy',
    tag: 'the last echo before dawn',
    flowers: [[246, 188], [1034, 188], [258, 470], [1022, 470], [472, 618], [808, 618]],
    spiders: [[164, 300], [1116, 300], [358, 646], [922, 646]],
    webs: [[440, 352, 86], [840, 352, 86], [640, 528, 78]],
    start: [640, 428],
    spiderSpeed: 98,
    hint: 'Scatter the spiders, then carry the light home.',
  },
];

export const PALETTES = [
  {
    key: 'moonlit',
    skyTop: '#040a1b',
    skyMid: '#0a1930',
    skyBottom: '#123647',
    moon: '#dffbff',
    moonGlow: '#79e9ff',
    hillFar: '#0b2036',
    hillMid: '#0f2c3e',
    hillNear: '#133c46',
    foliage: '#0c3440',
    foliageLight: '#16595c',
    leaf: '#1f7264',
    accent: '#7cf5d4',
    accentSoft: '#3fd6c0',
    accentWarm: '#ffe9a8',
    text: '#edfbff',
    muted: '#9fc6ce',
    panel: '#07141f',
    panelEdge: '#2a6b73',
    flower: '#9ff0ff',
    flowerDeep: '#3f9fc4',
    pollen: '#ffe27a',
    pollenSoft: '#ffb84d',
    hive: '#ffd27a',
    hiveDeep: '#a9672b',
    hiveGlow: '#ffcf6e',
    spider: '#ff6fce',
    spiderDark: '#4d1a4c',
    web: '#bfe9ff',
    grass: '#09272e',
    star: '#d8f6ff',
  },
  {
    key: 'ember',
    skyTop: '#140514',
    skyMid: '#2a0f1e',
    skyBottom: '#48222c',
    moon: '#ffeccb',
    moonGlow: '#ff9e6b',
    hillFar: '#281020',
    hillMid: '#3a192a',
    hillNear: '#512631',
    foliage: '#371a26',
    foliageLight: '#6b2f36',
    leaf: '#8f453f',
    accent: '#ffb46b',
    accentSoft: '#ff8a5c',
    accentWarm: '#fff2b8',
    text: '#fff3ea',
    muted: '#d7b4a6',
    panel: '#1b0b12',
    panelEdge: '#7a3a3a',
    flower: '#ffd27a',
    flowerDeep: '#c96a4a',
    pollen: '#fff3b8',
    pollenSoft: '#ffc06a',
    hive: '#ff9a5c',
    hiveDeep: '#8b3b28',
    hiveGlow: '#ffb46b',
    spider: '#b58cff',
    spiderDark: '#33225f',
    web: '#ffd7c0',
    grass: '#2b1220',
    star: '#ffe9d2',
  },
  {
    key: 'violet',
    skyTop: '#06041d',
    skyMid: '#120c37',
    skyBottom: '#211952',
    moon: '#eadfff',
    moonGlow: '#a88bff',
    hillFar: '#140f31',
    hillMid: '#1e1646',
    hillNear: '#2b2059',
    foliage: '#241a4c',
    foliageLight: '#3b2b70',
    leaf: '#4e3b89',
    accent: '#b79bff',
    accentSoft: '#8f74e6',
    accentWarm: '#9dffe6',
    text: '#f3efff',
    muted: '#c0b3e8',
    panel: '#0d0920',
    panelEdge: '#5a4a9c',
    flower: '#d9b4ff',
    flowerDeep: '#7a4fd0',
    pollen: '#9dffe6',
    pollenSoft: '#5fe6c8',
    hive: '#8ff4ff',
    hiveDeep: '#2b7587',
    hiveGlow: '#8ff4ff',
    spider: '#ff6b8a',
    spiderDark: '#4d1730',
    web: '#d9c8ff',
    grass: '#191138',
    star: '#e6dcff',
  },
];

export const FONT = {
  display: 'Georgia, "Liberation Serif", "DejaVu Serif", serif',
  body: '"Trebuchet MS", "Segoe UI", "DejaVu Sans", system-ui, sans-serif',
  mono: '"DejaVu Sans Mono", "Liberation Mono", ui-monospace, monospace',
};

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'lumen-garden.best';
