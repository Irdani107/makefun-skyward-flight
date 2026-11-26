// SKYWARD — Meridian Coast: hand-in program for the flight game entry.
//
// Copies game/ and screenshots/ from this repository into the output
// directory and writes dossier.json with the kit's own library, so the
// dossier the scorer rebuilds from the same files matches byte for byte.
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const repoDir = new URL('.', import.meta.url).pathname;

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoDir, 'game'), join(outputDir, 'game'), { recursive: true });
cpSync(join(repoDir, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });

writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  }),
);
console.log('skyward: game, screenshots and dossier written to', outputDir);
