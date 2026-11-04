/**
 * Build the Client half of the boot-animation bundle.
 *
 * Inlines:
 *  - the official DeepSeek whale SVG path extracted from the marketing page
 *  - two pre-rendered Chinese TTS lines (base64 WAV)
 *
 * Run: node build-client.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (...parts) => fs.readFileSync(path.join(here, ...parts), 'utf8');
const readBuffer = (...parts) => fs.readFileSync(path.join(here, ...parts));

const whaleSvg = read('research', 'whale.svg');
const pathMatch = /<path[^>]*\sd="([^"]+)"/.exec(whaleSvg);
const tightViewBox = /viewBox="([^"]+)"/.exec(whaleSvg);
const groupShift = /<g[^>]*transform="translate\(([-\d.]+)[ ,]+([-\d.]+)\)"[^>]*>/.exec(whaleSvg);
if (!pathMatch || !tightViewBox) {
  throw new Error('Could not extract viewBox/path from research/whale.svg');
}
// whale.svg wraps the original-coordinate path in a translate group so it
// fits a tight 0 0 box. Inline SVG needs the original viewBox instead, or the
// top of the whale would be clipped. Undo the wrapper translation here.
const tight = tightViewBox[1].trim().split(/\s+/).map(Number);
let originalViewBox = tightViewBox[1];
if (groupShift) {
  const tx = Number(groupShift[1]);
  const ty = Number(groupShift[2]);
  originalViewBox = `${-tx} ${-ty} ${tight[2]} ${tight[3]}`;
}

const welcome = readBuffer('assets', 'welcome-bot.wav').toString('base64');
const tagline = readBuffer('assets', 'tagline-bot.wav').toString('base64');
const beep = readBuffer('assets', 'sfx-beep.wav').toString('base64');
const solidify = readBuffer('assets', 'sfx-solidify.wav').toString('base64');
const reveal = readBuffer('assets', 'sfx-reveal.wav').toString('base64');

let source = read('src', 'boot.template.js');
const replacements = {
  __WHALE_VIEWBOX__: JSON.stringify(originalViewBox),
  __WHALE_PATH__: JSON.stringify(pathMatch[1]),
  __VOICE_WELCOME__: welcome,
  __VOICE_TAGLINE__: tagline,
  __SFX_BEEP__: beep,
  __SFX_SOLIDIFY__: solidify,
  __SFX_REVEAL__: reveal,
};
for (const [token, value] of Object.entries(replacements)) {
  if (!source.includes(token)) throw new Error(`Missing placeholder ${token}`);
  source = source.split(token).join(value);
}

if (source.includes('__WHALE') || source.includes('__VOICE') || source.includes('__SFX')) {
  throw new Error('Unreplaced placeholder remains');
}

const output = path.join(here, 'plugin', 'client.js');
fs.writeFileSync(output, source, 'utf8');
console.log(`built ${output} (${Buffer.byteLength(source)} bytes)`);
console.log(`whale viewBox: ${originalViewBox}`);
console.log(`welcome audio: ${Math.round(welcome.length / 1024)} KiB base64`);
console.log(`tagline audio: ${Math.round(tagline.length / 1024)} KiB base64`);
console.log(`sfx audio: ${Math.round((beep.length + solidify.length + reveal.length) / 1024)} KiB base64`);
