import type * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { appendPoints, LOCATION_TASK, readMeta } from './activeRun';
import type { GeoPoint } from './geo';
import { useTracker } from '../store/tracker';

/**
 * The background location receiver.
 *
 * Registered at module scope, not inside a component — Android may spin up a
 * headless JS context and immediately deliver a batch of fixes, and the task has
 * to already be defined by the time the bundle finishes evaluating. Imported for
 * its side effect from app/_layout.tsx.
 *
 * Whichever context this runs in, the durable write to AsyncStorage happens
 * first. The store update after it is a no-op in a headless context (nothing is
 * rendering) and an instant UI refresh when the app is in the foreground — so
 * the same code path serves both without a separate foreground watcher.
 */
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) return;

  const locations = (data as { locations?: Location.LocationObject[] } | null)?.locations;
  if (!locations || locations.length === 0) return;

  const meta = await readMeta();
  // No active run, or paused — drop the fixes. Recording them while stopped
  // would draw a straight line through wherever the phone was sitting.
  if (!meta || meta.segmentStartedAt == null) return;

  const points = await appendPoints(locations.map(toGeoPoint));
  useTracker.getState().ingest(points);
});

function toGeoPoint(fix: Location.LocationObject): GeoPoint {
  return {
    lat: fix.coords.latitude,
    lon: fix.coords.longitude,
    alt: fix.coords.altitude ?? undefined,
    acc: fix.coords.accuracy ?? undefined,
    t: fix.timestamp,
  };
}
