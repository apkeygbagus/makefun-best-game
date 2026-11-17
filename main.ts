// Neon Void — entry program for make.fun "Make the best game" (best-game-01).
//
// The game itself is the static site in game/ (open game/index.html in a desktop
// browser, no server, no network). This program is only the courier: when the
// grader runs it with Node 22 it copies game/ and screenshots/ into the output
// directory and writes dossier.json there with buildDossier from the vendored
// make.fun library, so the judge receives exactly the files in this repository.
//
// Local run:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// In the grader the output directory is /output and MAKEFUN_OUTPUT_DIR names it.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's published caps for this competition: at most 993 entries and
// 48 MiB under game/, paths of at most 1000 bytes, at most 4 screenshots of
// at most 256 KiB each, and the dossier text budget below.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function handIn() {
  mkdirSync(outputDir, { recursive: true });
  cpSync(join(repoDir, 'game'), join(outputDir, 'game'), { recursive: true });
  mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
  const shotsDir = join(repoDir, 'screenshots');
  if (existsSync(shotsDir)) {
    cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });
  }
  const dossier = buildDossier(outputDir, DOSSIER_CAPS);
  writeFileSync(join(outputDir, 'dossier.json'), dossier);
}

handIn();
