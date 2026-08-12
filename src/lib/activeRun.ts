import AsyncStorage from '@react-native-async-storage/async-storage';

import { isPlausible, type GeoPoint } from './geo';

/**
 * Durable storage for the run currently being recorded.
 *
 * Background location on Android can be delivered to a *headless JS context* —
 * a second copy of the bundle with its own module registry. Anything held in
 * memory by the UI (the zustand store, React state) does not exist there. So the
 * in-progress run lives here, in AsyncStorage, and both contexts talk through it:
 * the location task appends fixes, the UI reads them back.
 *
 * It also buys crash recovery for free. If Android kills the app mid-run, the
 * track is already on disk and the next launch picks it up where it left off.
 */

export const LOCATION_TASK = 'kinetic-location-updates';

const META_KEY = 'kinetic.active.meta.v1';
const POINTS_KEY = 'kinetic.active.points.v1';

export type ActiveMeta = {
  startedAt: number;
  /** Moving time banked from completed segments, ms. */
  accumulatedMs: number;
  /** Start of the current moving segment, or null while paused. */
  segmentStartedAt: number | null;
};

export async function readMeta(): Promise<ActiveMeta | null> {
  try {
    const raw = await AsyncStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as ActiveMeta) : null;
  } catch {
    return null;
  }
}

export async function writeMeta(meta: ActiveMeta): Promise<void> {
  try {
    await AsyncStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // A failed meta write costs the pause state, not the track itself.
  }
}

export async function readPoints(): Promise<GeoPoint[]> {
  try {
    const raw = await AsyncStorage.getItem(POINTS_KEY);
    return raw ? (JSON.parse(raw) as GeoPoint[]) : [];
  } catch {
    return [];
  }
}

/**
 * Filters `fixes` against the existing track and appends whatever survives.
 * Returns the full updated track.
 *
 * The location task is the only writer, so the read-modify-write here has no
 * competing writer to race with.
 */
export async function appendPoints(fixes: GeoPoint[]): Promise<GeoPoint[]> {
  const points = await readPoints();

  for (const fix of fixes) {
    const prev = points[points.length - 1];
    // The very first fix has nothing to validate against; take it as the origin.
    if (!prev) {
      points.push(fix);
      continue;
    }
    if (isPlausible(prev, fix)) points.push(fix);
  }

  try {
    await AsyncStorage.setItem(POINTS_KEY, JSON.stringify(points));
  } catch {
    // Out of space or storage unavailable — keep whatever is already persisted
    // rather than throwing inside a background task, which Android would treat
    // as a crash.
  }

  return points;
}

export async function clearActive(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([META_KEY, POINTS_KEY]);
  } catch {
    // Ignore — a stale buffer is recovered from on next launch anyway.
  }
}

export async function hasActiveRun(): Promise<boolean> {
  return (await readMeta()) != null;
}
