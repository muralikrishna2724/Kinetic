import type { GeoPoint } from './geo';
import { computeSplits, elevationGain, totalDistance } from './geo';
import type { Run } from '../store/runs';

/**
 * Deterministic demo history so a fresh install isn't an empty shell.
 *
 * Everything is generated from a fixed seed, so the charts, splits and route
 * shapes are identical on every device — which makes design review meaningful.
 * Cleared for good the moment the user records or deletes anything.
 */

/** mulberry32 — small, fast, and stable across JS engines. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Demo runs are centred on Cubbon Park, Bengaluru. */
const CENTER = { lat: 12.9763, lon: 77.5929 };
const M_PER_DEG_LAT = 111_320;

type RouteShape = 'loop' | 'outAndBack' | 'figureEight';

/**
 * Builds a plausible GPS track of very close to `targetMeters`.
 *
 * Two passes, and the order matters. First the curve is traced in dimensionless
 * units and its polyline length measured; only then is it scaled so the track
 * actually measures `targetMeters`. Deriving the radius from the target up front
 * doesn't work — the wobble harmonics and the shape each change the arc length
 * by an amount you can't know before drawing it, which leaves the recorded
 * distance disagreeing with the pace the timestamps imply.
 */
function makeRoute(
  targetMeters: number,
  paceSecPerKm: number,
  startedAt: number,
  shape: RouteShape,
  seed: number,
): GeoPoint[] {
  const rand = rng(seed);

  const baseSpeed = 1000 / paceSecPerKm; // m/s
  const totalSec = (targetMeters / 1000) * paceSecPerKm;
  // Roughly one fix every 4 seconds, bounded so short runs still curve smoothly
  // and long ones don't carry thousands of points around.
  const steps = Math.min(900, Math.max(150, Math.round(totalSec / 4)));

  // A few harmonics turn the bare circle into something street-shaped.
  const wobble = [
    { k: 3, amp: 0.16 + rand() * 0.1, phase: rand() * Math.PI * 2 },
    { k: 5, amp: 0.08 + rand() * 0.06, phase: rand() * Math.PI * 2 },
    { k: 8, amp: 0.04 + rand() * 0.03, phase: rand() * Math.PI * 2 },
  ];

  /* Pass 1 — trace the shape in unit space. */
  const shapePoints: { x: number; y: number; theta: number }[] = [];

  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;
    const theta = progress * Math.PI * 2;

    let r = 1;
    for (const w of wobble) r *= 1 + w.amp * Math.sin(w.k * theta + w.phase);

    let x: number;
    let y: number;

    if (shape === 'outAndBack') {
      // Out along a gently curving line, then back down the same line.
      const leg = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
      const bend = Math.sin(leg * Math.PI) * 0.45;
      x = leg * 2.4 + bend * 0.3;
      y = bend + Math.sin(leg * 9) * 0.06;
    } else if (shape === 'figureEight') {
      // Lemniscate — one full crossing over the parameter range.
      x = r * Math.sin(theta);
      y = r * Math.sin(theta) * Math.cos(theta);
    } else {
      x = r * Math.cos(theta);
      y = r * Math.sin(theta);
    }

    shapePoints.push({ x, y, theta });
  }

  /* Measure it, then solve for the scale that hits the target length. */
  let shapeLength = 0;
  for (let i = 1; i < shapePoints.length; i++) {
    shapeLength += Math.hypot(
      shapePoints[i].x - shapePoints[i - 1].x,
      shapePoints[i].y - shapePoints[i - 1].y,
    );
  }
  const metresPerUnit = targetMeters / Math.max(shapeLength, 1e-9);

  /* Pass 2 — walk the scaled path, spending time according to pace. */
  const lonScale = Math.cos((CENTER.lat * Math.PI) / 180);
  const points: GeoPoint[] = [];
  let elapsed = 0;
  let paceDrift = 0;

  for (let i = 0; i < shapePoints.length; i++) {
    const sp = shapePoints[i];
    const progress = i / steps;

    if (i > 0) {
      const prev = shapePoints[i - 1];
      const segment = Math.hypot(sp.x - prev.x, sp.y - prev.y) * metresPerUnit;

      // Pace wanders as a random walk and fades over the last third, the way a
      // real run does once the legs go.
      paceDrift += (rand() - 0.5) * 0.06;
      paceDrift = Math.max(-0.14, Math.min(0.14, paceDrift));
      const fatigue = progress > 0.65 ? (progress - 0.65) * 0.12 : 0;
      const speed = Math.max(baseSpeed * (1 + paceDrift - fatigue), 0.5);

      elapsed += segment / speed;
    }

    const dxMeters = sp.x * metresPerUnit;
    const dyMeters = sp.y * metresPerUnit;

    points.push({
      lat: CENTER.lat + dyMeters / M_PER_DEG_LAT,
      lon: CENTER.lon + dxMeters / (M_PER_DEG_LAT * lonScale),
      // Gentle rolling terrain, plus a little sensor noise.
      alt: 920 + Math.sin(sp.theta * 1.7) * 9 + Math.sin(sp.theta * 4.3) * 3 + rand() * 1.2,
      t: startedAt + Math.round(elapsed * 1000),
      acc: 4 + rand() * 4,
    });
  }

  return points;
}

type Blueprint = {
  daysAgo: number;
  hour: number;
  km: number;
  paceSecPerKm: number;
  shape: RouteShape;
  title: string;
  avgHr: number;
};

const BLUEPRINTS: Blueprint[] = [
  { daysAgo: 1, hour: 6, km: 8.2, paceSecPerKm: 322, shape: 'loop', title: 'Morning Run', avgHr: 152 },
  { daysAgo: 3, hour: 18, km: 5.0, paceSecPerKm: 298, shape: 'outAndBack', title: 'Tempo Session', avgHr: 168 },
  { daysAgo: 4, hour: 7, km: 12.4, paceSecPerKm: 345, shape: 'figureEight', title: 'Long Run', avgHr: 145 },
  { daysAgo: 6, hour: 19, km: 6.1, paceSecPerKm: 331, shape: 'loop', title: 'Evening Shakeout', avgHr: 141 },
  { daysAgo: 8, hour: 6, km: 10.0, paceSecPerKm: 336, shape: 'loop', title: 'Steady State', avgHr: 149 },
  { daysAgo: 10, hour: 17, km: 4.2, paceSecPerKm: 288, shape: 'outAndBack', title: 'Intervals', avgHr: 174 },
  { daysAgo: 12, hour: 7, km: 15.6, paceSecPerKm: 352, shape: 'figureEight', title: 'Weekend Long', avgHr: 143 },
  { daysAgo: 15, hour: 6, km: 7.3, paceSecPerKm: 327, shape: 'loop', title: 'Easy Miles', avgHr: 138 },
  { daysAgo: 18, hour: 18, km: 5.4, paceSecPerKm: 305, shape: 'loop', title: 'Threshold', avgHr: 165 },
  { daysAgo: 22, hour: 7, km: 9.1, paceSecPerKm: 340, shape: 'outAndBack', title: 'Recovery Run', avgHr: 134 },
];

export function buildSeedRuns(unitMetersForSplits = 1000): Run[] {
  const now = new Date();

  return BLUEPRINTS.map((bp, i) => {
    const start = new Date(now);
    start.setDate(now.getDate() - bp.daysAgo);
    start.setHours(bp.hour, (i * 13) % 60, 0, 0);
    const startedAt = start.getTime();

    const points = makeRoute(bp.km * 1000, bp.paceSecPerKm, startedAt, bp.shape, 1000 + i * 7919);
    const distanceMeters = totalDistance(points);
    const endedAt = points[points.length - 1].t;

    return {
      id: `seed-${bp.daysAgo}-${i}`,
      title: bp.title,
      startedAt,
      endedAt,
      // Seeded runs have no pauses, so moving time is the whole span.
      durationSec: Math.round((endedAt - startedAt) / 1000),
      distanceMeters,
      points,
      splits: computeSplits(points, unitMetersForSplits),
      elevationGainMeters: elevationGain(points),
      avgHr: bp.avgHr,
      isSeed: true,
    } satisfies Run;
  });
}
