import AsyncStorage from '@react-native-async-storage/async-storage';
import type * as Location from 'expo-location';

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
  /**
   * Set on resume; consumed by the next fix that lands, which is then marked as
   * a track break.
   *
   * It travels through storage rather than memory because the fix may well be
   * delivered to a headless JS context that never saw the resume happen.
   */
  breakPending?: boolean;
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
  const meta = await readMeta();
  let breakPending = meta?.breakPending === true;

  for (const fix of fixes) {
    const prev = points[points.length - 1];
    // The very first fix has nothing to validate against; take it as the origin.
    if (!prev) {
      points.push(fix);
      continue;
    }

    if (breakPending) {
      // First fix after a resume. It deliberately bypasses isPlausible's
      // movement and speed gates — those compare against a point from before
      // the pause, and the whole point of the marker is that the comparison is
      // meaningless. Accuracy is still worth checking.
      if (fix.acc != null && fix.acc > 35) continue;
      points.push({ ...fix, break: true });
      breakPending = false;
      continue;
    }

    if (isPlausible(prev, fix)) points.push(fix);
  }

  // Clear the flag only once a fix has actually claimed it.
  if (meta?.breakPending && !breakPending) {
    await writeMeta({ ...meta, breakPending: false });
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

/** Lives here rather than in the task file so the tracker can share it without an import cycle. */
export function toGeoPoint(fix: Location.LocationObject): GeoPoint {
  return {
    lat: fix.coords.latitude,
    lon: fix.coords.longitude,
    alt: fix.coords.altitude ?? undefined,
    acc: fix.coords.accuracy ?? undefined,
    t: fix.timestamp,
  };
}

/**
 * Runs older than this are not offered for resume.
 *
 * A stale buffer means the app died and was not reopened for a long time —
 * silently continuing a run from yesterday would produce a garbage duration,
 * and blindly re-entering it on every launch is how a crash loop starts.
 */
export const MAX_RESUME_AGE_MS = 12 * 60 * 60 * 1000;
