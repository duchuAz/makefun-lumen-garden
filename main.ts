// Hand in the Lumen: Garden of Echoes entry: copy the playable game/ and its screenshots/ into
// the output directory, write dossier.json with the vendored make.fun library, and run a few of
// my own checks so a broken hand-in fails loudly here rather than at the scorer.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Node 22, standard library only. MAKEFUN_OUTPUT_DIR stands in for /output outside the grader.

import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOSSIER_SCHEMA, buildDossier } from './vendor/makefun-game.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const OUT = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const SOURCE_IMAGE = /\.(jpe?g|png)$/i;
const TEXT_FILE = /\.(html|js|mjs|css|json)$/i;
const EXTERNAL_REFERENCE = /\bhttps?:\/\//i;

const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function fail(message) {
  process.stderr.write(`main.ts: ${message}\n`);
  process.exit(1);
}

function walk(dir) {
  const files = [];
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1));
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

function prepareOutput() {
  mkdirSync(OUT, { recursive: true });
  // Clear only what this program owns, so a rerun is byte-identical and never mixes old files in.
  for (const owned of ['game', 'screenshots', 'dossier.json']) {
    rmSync(join(OUT, owned), { recursive: true, force: true });
  }
  const game = join(HERE, 'game');
  const shots = join(HERE, 'screenshots');
  if (!existsSync(join(game, 'index.html'))) fail('game/index.html is missing');
  if (!existsSync(shots)) fail('screenshots/ is missing');
  cpSync(game, join(OUT, 'game'), { recursive: true });
  cpSync(shots, join(OUT, 'screenshots'), { recursive: true });
}

function checkGame() {
  const gameDir = join(OUT, 'game');
  const files = walk(gameDir);
  let bytes = 0;
  const offenders = [];
  for (const file of files) {
    const size = statSync(file).size;
    bytes += size;
    if (TEXT_FILE.test(file) && size < 2 * 1024 * 1024) {
      const text = readFileSync(file, 'utf8');
      if (EXTERNAL_REFERENCE.test(text)) offenders.push(relative(OUT, file));
    }
  }
  if (files.length > CAPS.game_max_files) fail(`game/ holds ${files.length} files, over ${CAPS.game_max_files}`);
  if (bytes > CAPS.game_max_bytes) fail(`game/ is ${bytes} bytes, over ${CAPS.game_max_bytes}`);
  if (offenders.length > 0) fail(`game/ references the network in: ${offenders.join(', ')}`);
  return { files: files.length, bytes };
}

function checkScreenshots() {
  const shotDir = join(OUT, 'screenshots');
  const names = readdirSync(shotDir).sort();
  if (names.length !== 4) fail(`screenshots/ holds ${names.length} files, expected exactly 4`);
  let bytes = 0;
  const details = [];
  for (const name of names) {
    if (!SOURCE_IMAGE.test(name)) fail(`screenshots/${name} is not a PNG or JPEG`);
    const size = statSync(join(shotDir, name)).size;
    if (size > CAPS.screenshots.max_bytes) fail(`screenshots/${name} is ${size} bytes, over ${CAPS.screenshots.max_bytes}`);
    bytes += size;
    details.push(`${name} (${size} B)`);
  }
  return { count: names.length, bytes, details };
}

prepareOutput();
const gameStats = checkGame();
const shotStats = checkScreenshots();

const dossierBytes = buildDossier(OUT, CAPS);
writeFileSync(join(OUT, 'dossier.json'), dossierBytes);

const dossier = JSON.parse(Buffer.from(dossierBytes).toString('utf8'));
if (dossier.schema !== DOSSIER_SCHEMA) fail(`dossier schema is ${String(dossier.schema)}, expected ${DOSSIER_SCHEMA}`);
if (!/^## Game/.test(dossier.text ?? '')) fail('dossier text has no "## Game" block');
if (dossierBytes.length > 1.5 * 1024 * 1024) fail(`dossier.json is ${dossierBytes.length} bytes, over 1.5 MiB`);
const shasum = createHash('sha256').update(dossierBytes).digest('hex');

process.stdout.write(
  [
    'makefun best-game-01 · Lumen: Garden of Echoes',
    `  output          ${OUT}`,
    `  game            ${gameStats.files} files, ${gameStats.bytes} bytes (no network references)`,
    `  screenshots     ${shotStats.count} files, ${shotStats.bytes} bytes: ${shotStats.details.join(', ')}`,
    `  dossier         ${dossierBytes.length} bytes, sha256 ${shasum}`,
    '  checks          ok',
  ].join('\n') + '\n',
);
