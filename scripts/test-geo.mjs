/**
 * Regression tests for the distance and split arithmetic.
 *
 *   npm run test:geo
 *
 * geo.ts is pure and dependency-free, so this compiles that one file and drives
 * it directly — no test runner, no React Native, no device. It exists because
 * the pause-boundary bug was invisible to a typecheck, a bundle, a browser
 * walkthrough *and* an emulator run: only arithmetic on a track containing a
 * pause shows it.
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const out = mkdtempSync(path.join(tmpdir(), 'kinetic-geo-'));
try {
  // Runs tsc's entrypoint through node rather than via npx: Node 24 refuses to
  // spawn a .cmd without a shell, and this is identical on Windows and Linux.
  execFileSync(
    process.execPath,
    [
      path.join('node_modules', 'typescript', 'bin', 'tsc'),
      'src/lib/geo.ts',
      '--ignoreConfig',
      '--outDir', out,
      '--module', 'commonjs',
      '--target', 'es2020',
      '--skipLibCheck',
    ],
    { stdio: 'inherit' },
  );

  const geo = createRequire(import.meta.url)(path.join(out, 'geo.js'));

  // Points along the equator, using the same spherical radius haversine() does,
  // so expected metres are exact rather than 0.1% off a WGS84 constant.
  const M_PER_DEG = (2 * Math.PI * 6_371_000) / 360;
  const at = (metresEast, tSec, extra = {}) => ({
    lat: 0,
    lon: metresEast / M_PER_DEG,
    t: tSec * 1000,
    acc: 5,
    ...extra,
  });

  const results = [];
  const round = (n) => Math.round(n * 10) / 10;
  const check = (name, actual, expected, tol = 1.5) => {
    const ok = Math.abs(actual - expected) <= tol;
    results.push(ok);
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(46)} got ${String(round(actual)).padStart(7)}  want ~${expected}`,
    );
  };

  /*
   * Run 300 m, pause 60 s while covering 350 m (a bus), resume, run 300 m more.
   *   honest: 600 m / 200 s        naive: 950 m / 260 s
   */
  const withBreak = [];
  for (let i = 0; i <= 10; i++) withBreak.push(at(i * 30, i * 10));
  withBreak.push(at(650, 160, { break: true }));
  for (let i = 1; i <= 10; i++) withBreak.push(at(650 + i * 30, 160 + i * 10));

  const legacy = withBreak.map(({ break: _b, ...p }) => p);

  console.log('--- a pause must contribute neither distance nor time ---');
  check('distance excludes the paused travel', geo.totalDistance(withBreak), 600);
  const splits = geo.computeSplits(withBreak, 1000);
  check('split count', splits.length, 1, 0);
  check('partial split metres', splits[0].meters, 600);
  check('split seconds exclude the 60 s pause', splits[0].seconds, 200);

  console.log('\n--- tracks recorded before v1.0.3 keep their old numbers ---');
  check('distance includes the bus ride', geo.totalDistance(legacy), 950);
  check('split seconds include the pause', geo.computeSplits(legacy, 1000)[0].seconds, 260);

  console.log('\n--- a run without pauses is untouched ---');
  const clean = [];
  for (let i = 0; i <= 100; i++) clean.push(at(i * 30, i * 10)); // 3000 m / 1000 s
  check('clean distance', geo.totalDistance(clean), 3000);
  const cleanSplits = geo.computeSplits(clean, 1000);
  check('clean split count', cleanSplits.length, 3, 0);
  check('each km takes 333 s', cleanSplits[0].seconds, 333.3, 1);
  check('splits sum to full distance', cleanSplits.reduce((s, x) => s + x.meters, 0), 3000);
  check('splits sum to full time', cleanSplits.reduce((s, x) => s + x.seconds, 0), 1000, 2);

  console.log('\n--- GPS filtering ---');
  const base = at(0, 0);
  check('rejects a low-accuracy fix', geo.isPlausible(base, at(30, 10, { acc: 60 })) ? 1 : 0, 0, 0);
  check('rejects sub-metre jitter', geo.isPlausible(base, at(0.5, 10)) ? 1 : 0, 0, 0);
  check('rejects a 20 m/s teleport', geo.isPlausible(base, at(200, 10)) ? 1 : 0, 0, 0);
  check('accepts an ordinary stride', geo.isPlausible(base, at(30, 10)) ? 1 : 0, 1, 0);

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} passed${results.every(Boolean) ? '' : '  <-- FAILURES'}`);
  process.exitCode = results.every(Boolean) ? 0 : 1;
} finally {
  rmSync(out, { recursive: true, force: true });
}
