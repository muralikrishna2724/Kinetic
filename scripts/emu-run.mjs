/**
 * Feeds a synthetic run to a booted Android emulator so the tracking flow can be
 * exercised without going outside.
 *
 *   node scripts/emu-run.mjs [--km 2] [--pace 330] [--hz 1]
 *
 * Drives `adb emu geo fix`, which is the emulator's location injection channel.
 * Coordinates are perfect by construction, so this proves the plumbing — record,
 * accumulate, split, save — not the GPS filtering, which never sees a bad fix
 * here and has to be reasoned about separately.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

const ADB =
  process.env.ADB ??
  'C:/Users/surya/AppData/Local/Android/Sdk/platform-tools/adb.exe';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(process.argv[i + 1]);
}

const km = arg('km', 2);
const paceSecPerKm = arg('pace', 330);
const hz = arg('hz', 1);

// Cubbon Park, Bengaluru — same origin the seeded demo runs use.
const CENTER = { lat: 12.9763, lon: 77.5929 };
const M_PER_DEG_LAT = 111_320;
const lonScale = Math.cos((CENTER.lat * Math.PI) / 180);

const totalMeters = km * 1000;
const totalSec = (totalMeters / 1000) * paceSecPerKm;
const steps = Math.round(totalSec * hz);
const stepMeters = totalMeters / steps;

// A wobbled loop, so the route trace has a shape worth looking at.
const radius = totalMeters / (2 * Math.PI);

console.log(
  `Injecting ${km} km at ${Math.floor(paceSecPerKm / 60)}:${String(paceSecPerKm % 60).padStart(2, '0')}/km — ` +
    `${steps} fixes at ${hz} Hz (~${Math.round(totalSec)}s real time)`,
);

for (let i = 0; i <= steps; i++) {
  const t = (i / steps) * Math.PI * 2;
  const r = radius * (1 + 0.18 * Math.sin(3 * t) + 0.07 * Math.sin(5 * t + 1.1));

  const dx = r * Math.cos(t);
  const dy = r * Math.sin(t);

  const lat = CENTER.lat + dy / M_PER_DEG_LAT;
  const lon = CENTER.lon + dx / (M_PER_DEG_LAT * lonScale);

  // geo fix takes longitude first — the opposite order to almost every other
  // location API, and a silent source of "why is my run in the ocean".
  await exec(ADB, ['emu', 'geo', 'fix', lon.toFixed(7), lat.toFixed(7), '920']);

  if (i % 20 === 0) {
    process.stdout.write(
      `  ${i}/${steps}  ~${((i * stepMeters) / 1000).toFixed(2)} km\n`,
    );
  }

  await new Promise((r) => setTimeout(r, 1000 / hz));
}

console.log('done — finish the run in the app to save it');
