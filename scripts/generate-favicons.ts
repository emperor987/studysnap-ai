/**
 * Génère les favicons StudySnap depuis public/logo.svg (maître).
 *
 * Sorties (dans public/) :
 *   - favicon-16.png, favicon-32.png
 *   - favicon-180-apple-touch.png (iOS)
 *   - favicon-192.png (PWA)
 *   - favicon.ico (contient 16 + 32 px, format ICO avec PNG embarqué)
 *
 * Usage : bun scripts/generate-favicons.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const PUBLIC = resolve(import.meta.dir, "..", "public");
const MASTER = resolve(PUBLIC, "logo.svg");
const svg = readFileSync(MASTER);

const SIZES = [
  { file: "favicon-16.png", size: 16 },
  { file: "favicon-32.png", size: 32 },
  { file: "favicon-180-apple-touch.png", size: 180 },
  { file: "favicon-192.png", size: 192 },
];

async function main() {
  const pngs = new Map<number, Buffer>();
  for (const { file, size } of SIZES) {
    const out = resolve(PUBLIC, file);
    const buf = await sharp(svg).resize(size, size).png().toBuffer();
    pngs.set(size, buf);
    writeFileSync(out, buf);
    console.log(`✓ ${file} (${size}px, ${buf.length} octets)`);
  }

  // favicon.ico : en-tête ICONDIR + entrées + données PNG (16 & 32 px).
  const images = [pngs.get(16)!, pngs.get(32)!];
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // réservé
  header.writeUInt16LE(1, 2); // type : icône
  header.writeUInt16LE(images.length, 4);

  const entries: Buffer[] = [];
  let offset = 6 + 16 * images.length;
  for (const [i, buf] of images.entries()) {
    const size = i === 0 ? 16 : 32;
    const e = Buffer.alloc(16);
    e.writeUInt8(size, 0); // largeur
    e.writeUInt8(size, 1); // hauteur
    e.writeUInt8(0, 2); // palette
    e.writeUInt8(0, 3); // réservé
    e.writeUInt16LE(1, 4); // plans
    e.writeUInt16LE(32, 6); // bits par pixel
    e.writeUInt32LE(buf.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += buf.length;
    entries.push(e);
  }
  const ico = Buffer.concat([header, ...entries, ...images]);
  writeFileSync(resolve(PUBLIC, "favicon.ico"), ico);
  console.log(`✓ favicon.ico (${ico.length} octets)`);
}

mkdirSync(PUBLIC, { recursive: true });
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
