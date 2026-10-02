import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const repoRoot = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const electronMain = readFileSync(join(repoRoot, 'electron', 'main.js'), 'utf8');
const indexHtml = readFileSync(join(repoRoot, 'index.html'), 'utf8');
const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));

const readLargestIcoFrame = (icoPath) => {
  const ico = readFileSync(icoPath);
  const frameCount = ico.readUInt16LE(4);

  for (let index = 0; index < frameCount; index += 1) {
    const entryOffset = 6 + index * 16;
    const width = ico[entryOffset] || 256;

    if (width === 256) {
      const size = ico.readUInt32LE(entryOffset + 8);
      const offset = ico.readUInt32LE(entryOffset + 12);
      return ico.subarray(offset, offset + size);
    }
  }

  throw new Error('Missing 256px ICO frame');
};

test('Electron desktop uses the RTX icon for runtime window and packaged executable', () => {
  assert.equal(packageJson.build.win.icon, 'build/logo V2.ico');
  assert.equal(packageJson.build.afterPack, './scripts/apply-win-icon.js');
  assert.equal(packageJson.build.win.signAndEditExecutable, false);
  assert.match(electronMain, /const getAppIconPath = \(\) => \(/);
  assert.match(electronMain, /const APP_ICON_FILE = 'logo V2\.ico'/);
  assert.match(electronMain, /public', APP_ICON_FILE/);
  assert.match(electronMain, /dist', APP_ICON_FILE/);
  assert.match(electronMain, /icon:\s*getAppIconPath\(\)/);
  assert.ok(existsSync(join(repoRoot, 'public', 'logo V2.ico')));
  assert.ok(existsSync(join(repoRoot, 'build', 'logo V2.ico')));
});

test('Windows afterPack hook stamps the RTX icon without the legacy winCodeSign bundle', () => {
  const hook = readFileSync(join(repoRoot, 'scripts', 'apply-win-icon.js'), 'utf8');

  assert.match(hook, /from 'rcedit'/);
  assert.match(hook, /electronPlatformName !== 'win32'/);
  assert.match(hook, /build', 'logo V2\.ico'/);
  assert.match(hook, /icon: iconPath/);
});

test('Web favicon points at the same RTX app icon copied into dist', () => {
  assert.match(indexHtml, /<link rel="icon" href="%BASE_URL%logo V2\.ico" \/>/);
});

test('RTX app icon uses a dark mark with the green 5 for light taskbar surfaces', async () => {
  const frame = readLargestIcoFrame(join(repoRoot, 'build', 'logo V2.ico'));
  const { data } = await sharp(frame).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let darkPixels = 0;
  let greenPixels = 0;
  let whitePixels = 0;

  for (let offset = 0; offset < data.length; offset += 4) {
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const a = data[offset + 3];

    if (a <= 32) continue;
    if (r < 45 && g < 55 && b < 80) darkPixels += 1;
    if (g > 120 && r < 150 && b < 120) greenPixels += 1;
    if (r > 180 && g > 180 && b > 180) whitePixels += 1;
  }

  assert.ok(darkPixels > 1000, 'icon should have a visible dark RTX mark');
  assert.ok(greenPixels > 100, 'icon should preserve the green 5');
  assert.equal(whitePixels, 0, 'icon should not contain opaque white logo pixels');
});
