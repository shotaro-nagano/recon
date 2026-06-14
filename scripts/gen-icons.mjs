/* PWAアイコンを public/icon.svg からラスタライズする */
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = await readFile(path.join(root, 'public', 'icon.svg'));

const targets = [
  { file: 'pwa-192.png', size: 192 },
  { file: 'pwa-512.png', size: 512 },
  { file: 'maskable-512.png', size: 512, pad: true },
  { file: 'apple-touch-icon.png', size: 180 },
];

for (const t of targets) {
  let img = sharp(svg).resize(t.size, t.size);
  if (t.pad) {
    // maskable: セーフゾーン確保のため80%に縮小して背景色で埋める
    const inner = Math.round(t.size * 0.8);
    const offset = Math.round((t.size - inner) / 2);
    const resized = await sharp(svg).resize(inner, inner).png().toBuffer();
    img = sharp({
      create: { width: t.size, height: t.size, channels: 4, background: '#0D2B4A' },
    }).composite([{ input: resized, left: offset, top: offset }]);
  }
  await img.png().toFile(path.join(root, 'public', t.file));
  console.log('generated', t.file);
}
