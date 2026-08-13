export type GeoPoint = {
  lat: number;
  lon: number;
  /** Metres above sea level, when the fix provides it. */
  alt?: number;
  /** Epoch ms. */
  t: number;
  /** Horizontal accuracy in metres, when reported. */
  acc?: number;
  /**
   * First fix after a resume — the track is discontinuous here.
   *
   * Nothing is recorded while paused, so without this marker the fix after a
   * resume joins straight onto the one before the pause: pause, take a bus,
   * resume, and the ride is silently added to your distance (measured at 351.7 m
   * across one 60 s pause, an implied 5.84 m/s that sails under the isPlausible
   * gate). The same gap inflates any split spanning it, because split timing
   * comes from fix timestamps.
   *
   * Every consumer below skips the segment *into* a break point: it contributes
   * neither distance nor elapsed time. Absent on runs recorded before v1.0.3,
   * which therefore behave exactly as they did.
   */
  break?: boolean;
};

const R = 6_371_000; // mean Earth radius, metres
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance between two fixes, in metres. */
export function haversine(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Whether a new fix is trustworthy enough to extend the track.
 *
 * Consumer GPS drifts while you stand still, and a single bad fix can add
 * hundreds of metres to a run. Two gates: reject low-accuracy fixes, and reject
 * jumps that imply a speed no runner hits.
 */
export function isPlausible(prev: GeoPoint, next: GeoPoint): boolean {
  if (next.acc != null && next.acc > 35) return false;

  const dt = (next.t - prev.t) / 1000;
  if (dt <= 0) return false;

  const d = haversine(prev, next);
  // Sub-metre movement between fixes is noise, not progress.
  if (d < 1.2) return false;
  // 12 m/s ≈ 2:19/km — faster than a world-record pace, so it's a glitch.
  if (d / dt > 12) return false;

  return true;
}

export function totalDistance(points: GeoPoint[]): number {
  let sum = 0;
  for (let i = 1; i < points.length; i++) {
    // Whatever happened during the pause is not part of the run.
    if (points[i].break) continue;
    sum += haversine(points[i - 1], points[i]);
  }
  return sum;
}

/**
 * Cumulative climb. Altitude is the noisiest channel on a phone GPS, so only
 * count a gain once it clears a 2m threshold above the last confirmed low.
 */
export function elevationGain(points: GeoPoint[]): number {
  let gain = 0;
  let reference: number | null = null;

  for (const p of points) {
    if (p.alt == null) continue;
    // Re-baseline across a pause — climbing a flight of stairs while stopped is
    // not elevation gained on the run.
    if (p.break) {
      reference = p.alt;
      continue;
    }
    if (reference == null) {
      reference = p.alt;
      continue;
    }
    const delta = p.alt - reference;
    if (delta > 2) {
      gain += delta;
      reference = p.alt;
    } else if (delta < 0) {
      reference = p.alt;
    }
  }
  return Math.round(gain);
}

export type Bounds = { minLat: number; maxLat: number; minLon: number; maxLon: number };

export function boundsOf(points: GeoPoint[]): Bounds | null {
  if (points.length === 0) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }
  return { minLat, maxLat, minLon, maxLon };
}

/**
 * Project lat/lon onto a fixed-size canvas for the SVG route drawing.
 *
 * Longitude degrees shrink by cos(latitude), so without that correction a
 * north–south route renders visibly squashed. Aspect ratio is preserved and the
 * result is centred, so the shape of the route is honest.
 */
export function projectToCanvas(
  points: GeoPoint[],
  width: number,
  height: number,
  padding = 16,
): { x: number; y: number }[] {
  const b = boundsOf(points);
  if (!b || points.length === 0) return [];

  const midLat = (b.minLat + b.maxLat) / 2;
  const lonScale = Math.cos(toRad(midLat));

  const spanX = Math.max((b.maxLon - b.minLon) * lonScale, 1e-9);
  const spanY = Math.max(b.maxLat - b.minLat, 1e-9);

  const availW = Math.max(width - padding * 2, 1);
  const availH = Math.max(height - padding * 2, 1);
  const scale = Math.min(availW / spanX, availH / spanY);

  const drawnW = spanX * scale;
  const drawnH = spanY * scale;
  const offsetX = (width - drawnW) / 2;
  const offsetY = (height - drawnH) / 2;

  return points.map((p) => ({
    x: offsetX + (p.lon - b.minLon) * lonScale * scale,
    // Latitude increases northward; screen y increases downward.
    y: offsetY + (b.maxLat - p.lat) * scale,
  }));
}

/** Turns projected points into an SVG path. */
export function toPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  return pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');
}

export type Split = {
  /** 1-based index of the kilometre or mile. */
  index: number;
  /** Seconds taken to cover this split. */
  seconds: number;
  /** Metres covered — the final split is usually partial. */
  meters: number;
};

/**
 * Per-unit splits, interpolating the crossing point between the two fixes that
 * straddle each boundary so a sparse track doesn't smear the times.
 */
export function computeSplits(points: GeoPoint[], unitMeters: number): Split[] {
  if (points.length < 2) return [];

  const splits: Split[] = [];
  let cumulative = 0;
  /**
   * Elapsed time with paused stretches removed. Split timing is measured on
   * this rather than on raw fix timestamps — a pause is real wall-clock time
   * that the runner did not spend running, and charging it to whichever split
   * happened to contain it made that kilometre read minutes slower than it was.
   */
  let movingMs = 0;
  let splitStartMovingMs = 0;
  let nextBoundary = unitMeters;
  let index = 1;

  for (let i = 1; i < points.length; i++) {
    // The segment into a resume contributes neither distance nor time.
    if (points[i].break) continue;

    const segment = haversine(points[i - 1], points[i]);
    const segStartDistance = cumulative;
    const segStartMovingMs = movingMs;

    cumulative += segment;
    movingMs += Math.max(0, points[i].t - points[i - 1].t);

    // A stationary segment still spends time; it just cannot cross a boundary.
    if (segment <= 0) continue;

    while (cumulative >= nextBoundary) {
      const fraction = (nextBoundary - segStartDistance) / segment;
      const crossingMovingMs = segStartMovingMs + (movingMs - segStartMovingMs) * fraction;

      splits.push({
        index,
        seconds: (crossingMovingMs - splitStartMovingMs) / 1000,
        meters: unitMeters,
      });

      splitStartMovingMs = crossingMovingMs;
      nextBoundary += unitMeters;
      index += 1;
    }
  }

  const remainder = cumulative - (nextBoundary - unitMeters);
  if (remainder > unitMeters * 0.05) {
    splits.push({
      index,
      seconds: (movingMs - splitStartMovingMs) / 1000,
      meters: remainder,
    });
  }

  return splits;
}
