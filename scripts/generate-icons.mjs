/**
 * Rasterises the Kinetic mark into the PNG assets Expo needs.
 *
 *   node scripts/generate-icons.mjs
 *
 * The geometry here is the single source of truth shared with
 * src/components/KineticLogo.tsx — if you change one, change the other.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const OUT = path.join(process.cwd(), 'assets');

const GRAD = `
  <linearGradient id="g" x1="0.12" y1="1" x2="0.92" y2="0">
    <stop offset="0" stop-color="#00A462"/>
    <stop offset="0.45" stop-color="#17E48F"/>
    <stop offset="1" stop-color="#C6FF4D"/>
  </linearGradient>`;

/** The letterform itself, already leaned into its direction of travel. */
const LETTER = (fill) => `
  <g transform="translate(8, 0) skewX(-7)">
    <rect x="6"  y="25.5" width="10" height="5"  rx="2.5" fill="${fill}" opacity="0.30"/>
    <rect x="1"  y="47.5" width="15" height="5"  rx="2.5" fill="${fill}" opacity="0.55"/>
    <rect x="7"  y="69.5" width="9"  height="5"  rx="2.5" fill="${fill}" opacity="0.30"/>
    <rect x="22" y="13"   width="15" height="74" rx="4"   fill="${fill}"/>
    <path d="M 80 18 L 49.5 50 L 82 82" stroke="${fill}" stroke-width="15"
          stroke-linejoin="miter" stroke-linecap="butt" fill="none"/>
  </g>`;

/**
 * @param scale  letterform size as a fraction of the canvas. Store icons want the
 *               glyph tighter than adaptive icons, which get cropped to a circle.
 */
function icon({ tile, glow = true, scale = 0.66 }) {
  const inset = (100 - scale * 100) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="1024" height="1024">
  <defs>
    ${GRAD}
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0"   stop-color="#17E48F" stop-opacity="0.40"/>
      <stop offset="0.6" stop-color="#17E48F" stop-opacity="0.10"/>
      <stop offset="1"   stop-color="#17E48F" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="tile" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0" stop-color="#16221E"/>
      <stop offset="1" stop-color="#080D0B"/>
    </linearGradient>
  </defs>
  ${tile ? '<rect width="100" height="100" rx="0" fill="url(#tile)"/>' : ''}
  ${glow ? '<circle cx="50" cy="50" r="46" fill="url(#glow)"/>' : ''}
  <g transform="translate(${inset}, ${inset}) scale(${scale})">
    ${LETTER('url(#g)')}
  </g>
</svg>`;
}

const targets = [
  // Store / home-screen icon: full-bleed dark tile, iOS rounds the corners itself.
  { file: 'icon.png', svg: icon({ tile: true, scale: 0.66 }), size: 1024 },
  // Android adaptive foreground: transparent, and pulled in hard because the
  // launcher mask crops to roughly the middle 66%.
  { file: 'adaptive-icon.png', svg: icon({ tile: false, glow: false, scale: 0.5 }), size: 1024 },
  // Splash: transparent, sits on the themed background from app.json.
  { file: 'splash-icon.png', svg: icon({ tile: false, scale: 0.72 }), size: 1024 },
  { file: 'favicon.png', svg: icon({ tile: true, scale: 0.7 }), size: 64 },
];

await mkdir(OUT, { recursive: true });

for (const t of targets) {
  const png = await sharp(Buffer.from(t.svg)).resize(t.size, t.size).png().toBuffer();
  await writeFile(path.join(OUT, t.file), png);
  console.log(`✓ assets/${t.file}  ${t.size}×${t.size}`);
}

// A contact sheet so the mark can be eyeballed at real sizes without a device.
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="260" viewBox="0 0 760 260">
  <defs>${GRAD}
    <linearGradient id="tile" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0" stop-color="#16221E"/><stop offset="1" stop-color="#080D0B"/>
    </linearGradient>
  </defs>
  <rect width="760" height="260" fill="#080B0A"/>
  <rect x="410" y="0" width="350" height="260" fill="#F7FAF9"/>
  ${[
    { x: 30, y: 40, s: 180, fill: 'url(#g)' },
    { x: 240, y: 90, s: 80, fill: 'url(#g)' },
    { x: 240, y: 190, s: 32, fill: '#17E48F' },
    { x: 300, y: 190, s: 20, fill: '#17E48F' },
    { x: 440, y: 40, s: 180, fill: 'url(#g)' },
    { x: 650, y: 90, s: 80, fill: 'url(#g)' },
  ]
    .map(
      (c) =>
        `<g transform="translate(${c.x}, ${c.y}) scale(${c.s / 100})">${LETTER(c.fill)}</g>`,
    )
    .join('\n  ')}
</svg>`;
await writeFile(
  path.join(OUT, 'logo-contact-sheet.png'),
  await sharp(Buffer.from(sheet)).png().toBuffer(),
);
console.log('✓ assets/logo-contact-sheet.png');
