import * as Location from 'expo-location';
import { PermissionsAndroid, Platform } from 'react-native';
import { create } from 'zustand';

import {
  clearActive,
  LOCATION_TASK,
  MAX_RESUME_AGE_MS,
  appendPoints,
  readMeta,
  readPoints,
  toGeoPoint,
  writeMeta,
} from '../lib/activeRun';
import { computeSplits, elevationGain, haversine, totalDistance, type GeoPoint } from '../lib/geo';
import type { Run } from './runs';

export type TrackerStatus =
  /** Nothing started. */
  | 'idle'
  /** Permission granted, waiting for a fix good enough to start on. */
  | 'acquiring'
  /** Locked on and ready for the user to hit start. */
  | 'ready'
  | 'running'
  | 'paused'
  /** Permission denied or location services off. */
  | 'denied';

/**
 * How the current run is being recorded.
 *
 * `background` needs "Allow all the time" and keeps recording with the screen
 * off. `foreground` is the fallback when that was refused — it records only
 * while Kinetic is on screen, which is worse but is emphatically better than
 * refusing to record at all.
 */
export type RecordingMode = 'background' | 'foreground';

/** Rolling window used for the live pace readout. */
const PACE_WINDOW_MS = 30_000;

type TrackerState = {
  status: TrackerStatus;
  points: GeoPoint[];
  distanceMeters: number;
  accumulatedMs: number;
  segmentStartedAt: number | null;
  startedAt: number | null;
  /** Bumped every second purely to re-render the timer. */
  tick: number;
  accuracy: number | null;
  backgroundGranted: boolean;
  mode: RecordingMode | null;
  /** Fatal — blocks starting a run. */
  errorMessage: string | null;
  /** Non-fatal — the run is recording, but with a caveat worth showing. */
  notice: string | null;

  prepare: () => Promise<void>;
  start: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  finish: () => Promise<Run | null>;
  discard: () => Promise<void>;
  ingest: (points: GeoPoint[]) => void;
  syncFromStorage: () => Promise<void>;
  /** Restores state after a kill. Deliberately starts no location updates. */
  restore: () => Promise<boolean>;
  /** Re-arms location for a restored run. Safe to call repeatedly. */
  reattach: () => Promise<void>;
};

let watcher: Location.LocationSubscription | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

function stopWatching() {
  watcher?.remove();
  watcher = null;
}

function stopTimer() {
  if (timer) clearInterval(timer);
  timer = null;
}

function startTimer(set: (p: Partial<TrackerState>) => void, get: () => TrackerState) {
  stopTimer();
  timer = setInterval(() => set({ tick: get().tick + 1 }), 1000);
}

/**
 * Asks for POST_NOTIFICATIONS on Android 13+.
 *
 * Without it the foreground service still runs and the track still grows — but
 * the system silently drops its ongoing notification, so a run records with no
 * indication it is happening and no tap-to-return. That notification is the only
 * affordance telling someone a run is live; losing it is how a run gets
 * abandoned by accident. Verified on an API 36 emulator: with the permission
 * absent the appop sits at POST_NOTIFICATION: ignore and the shade stays empty.
 *
 * Never fatal — a refusal costs the notification, not the recording.
 */
async function requestNotificationPermission(): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (typeof Platform.Version === 'number' && Platform.Version < 33) return;
  try {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  } catch {
    // Older Android, or the dialog could not be shown. Recording is unaffected.
  }
}

/**
 * Brings location up, preferring the background service.
 *
 * Returns the mode that actually started, or null if neither could. **Nothing
 * in here is allowed to throw.** Both paths fail for ordinary, user-reachable
 * reasons — background location refused, or Android 12+ refusing to let a
 * foreground service start from a cold launch — and an escaping rejection here
 * is what previously took the whole app down on every launch.
 */
async function beginRecording(force = false): Promise<RecordingMode | null> {
  // Preferred: the foreground service, which survives the screen going off.
  try {
    if (force) {
      // Re-arming after a process death. TaskManager persists the task
      // registration, so hasStartedLocationUpdatesAsync still answers `true`
      // even though the service died with the process — taking the short
      // circuit below would report 'background' and record nothing at all,
      // while the UI happily showed RECORDING. Clear the stale registration so
      // the start call underneath actually stands the service back up.
      await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {});
    } else {
      const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(
        () => false,
      );
      if (running) return 'background';
    }

    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 1000,
      distanceInterval: 1,
      activityType: Location.ActivityType.Fitness,
      // iOS will otherwise stop updates when it decides you've stopped moving,
      // silently truncating a run at a long traffic light.
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Kinetic is recording',
        notificationBody: 'Tracking your run — tap to return',
        notificationColor: '#17E48F',
        killServiceOnDestroy: false,
      },
    });
    return 'background';
  } catch {
    // Almost always: ACCESS_BACKGROUND_LOCATION not granted. Degrade.
  }

  // Fallback: an in-process watcher. Same durable write path, so the rest of
  // the app cannot tell the difference.
  try {
    stopWatching();
    watcher = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 1 },
      (fix) => {
        if (useTracker.getState().status !== 'running') return;
        appendPoints([toGeoPoint(fix)])
          .then((points) => useTracker.getState().ingest(points))
          .catch(() => {});
      },
    );
    return 'foreground';
  } catch {
    return null;
  }
}

async function stopLocationUpdates() {
  stopWatching();
  try {
    const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
    if (running) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  } catch {
    // Never registered, or already torn down.
  }
}

const initial = {
  status: 'idle' as TrackerStatus,
  points: [] as GeoPoint[],
  distanceMeters: 0,
  accumulatedMs: 0,
  segmentStartedAt: null as number | null,
  startedAt: null as number | null,
  tick: 0,
  accuracy: null as number | null,
  backgroundGranted: false,
  mode: null as RecordingMode | null,
  errorMessage: null as string | null,
  notice: null as string | null,
};

export const useTracker = create<TrackerState>((set, get) => ({
  ...initial,

  prepare: async () => {
    // A run restored from a previous session must not be wiped by the pre-run
    // screen preparing on mount.
    if (get().status === 'running' || get().status === 'paused') return;

    set({ ...initial, status: 'acquiring' });

    try {
      const foreground = await Location.requestForegroundPermissionsAsync();
      if (foreground.status !== 'granted') {
        set({
          status: 'denied',
          errorMessage: 'Kinetic needs location access to measure your run.',
        });
        return;
      }

      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        set({
          status: 'denied',
          errorMessage: 'Location services are turned off on this device.',
        });
        return;
      }

      // Before the background request, because that one navigates away to app
      // settings — asking for notifications afterwards would land the dialog on
      // top of a screen the user is already trying to get out of.
      await requestNotificationPermission();

      // Asked separately, and only after foreground is granted — the order
      // Android 11+ requires. Note this does NOT show a normal dialog there: it
      // sends the user to app settings to pick "Allow all the time", so a denial
      // is the common case and must never be treated as fatal.
      const background = await Location.requestBackgroundPermissionsAsync().catch(() => null);
      set({ backgroundGranted: background?.status === 'granted' });

      stopWatching();
      watcher = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 1 },
        (fix) => {
          const acc = fix.coords.accuracy ?? null;
          set({ accuracy: acc });
          if (get().status === 'acquiring' && (acc ?? 99) <= 25) set({ status: 'ready' });
        },
      );
    } catch {
      set({
        status: 'denied',
        errorMessage: 'Could not reach the location sensor. Try again.',
      });
    }
  },

  start: async () => {
    const now = Date.now();
    const startedAt = get().startedAt ?? now;

    // Hand off from the pre-run watcher — running both would double-deliver.
    stopWatching();

    const mode = await beginRecording();
    if (!mode) {
      // Nothing was persisted, so there is no half-started run to trip over on
      // the next launch. Put the user back on the pre-run screen.
      set({
        status: 'denied',
        errorMessage: 'Kinetic could not start location updates. Check location permissions.',
      });
      return;
    }

    // Only now is there genuinely a run in progress. Persisting before this is
    // what previously left an unstartable run on disk and crash-looped the app.
    await writeMeta({ startedAt, accumulatedMs: 0, segmentStartedAt: now });

    set({
      status: 'running',
      startedAt,
      segmentStartedAt: now,
      accumulatedMs: 0,
      mode,
      errorMessage: null,
      notice:
        mode === 'foreground'
          ? 'Recording while Kinetic is open. Allow location “all the time” to keep tracking with the screen off.'
          : null,
    });

    startTimer(set, get);
  },

  pause: async () => {
    const { segmentStartedAt, accumulatedMs, startedAt } = get();
    const banked = accumulatedMs + (segmentStartedAt ? Date.now() - segmentStartedAt : 0);

    set({ status: 'paused', accumulatedMs: banked, segmentStartedAt: null });
    stopTimer();

    // Keep the service alive across a pause — tearing it down and standing it
    // back up costs seconds of GPS reacquisition. Both recording paths drop
    // fixes while segmentStartedAt is null.
    if (startedAt != null) {
      await writeMeta({ startedAt, accumulatedMs: banked, segmentStartedAt: null });
    }
  },

  resume: async () => {
    const now = Date.now();
    const { startedAt, accumulatedMs } = get();

    set({ status: 'running', segmentStartedAt: now });
    startTimer(set, get);

    if (startedAt != null) {
      // breakPending marks the next fix as a track discontinuity, so the
      // distance covered while paused is not joined onto the run.
      await writeMeta({ startedAt, accumulatedMs, segmentStartedAt: now, breakPending: true });
    }
    if (!get().mode) {
      const mode = await beginRecording();
      if (mode) set({ mode });
    }
  },

  finish: async () => {
    const state = get();
    const elapsedMs =
      state.accumulatedMs + (state.segmentStartedAt ? Date.now() - state.segmentStartedAt : 0);

    stopTimer();
    await stopLocationUpdates();

    // The durable copy is authoritative — it includes anything recorded while
    // the UI was not mounted.
    const points = await readPoints();
    const distanceMeters = totalDistance(points);

    const tooShort = distanceMeters < 50 || elapsedMs < 20_000;
    if (tooShort || !state.startedAt) {
      await clearActive();
      set({ ...initial });
      return null;
    }

    const run: Run = {
      id: `run-${state.startedAt}`,
      title: titleForHour(new Date(state.startedAt).getHours()),
      startedAt: state.startedAt,
      endedAt: Date.now(),
      durationSec: Math.round(elapsedMs / 1000),
      distanceMeters,
      points,
      splits: computeSplits(points, 1000),
      elevationGainMeters: elevationGain(points),
    };

    await clearActive();
    set({ ...initial });
    return run;
  },

  discard: async () => {
    stopTimer();
    await stopLocationUpdates();
    await clearActive();
    set({ ...initial });
  },

  ingest: (points) => {
    // Ignore late deliveries arriving after the run was finished or discarded.
    const { status } = get();
    if (status !== 'running' && status !== 'paused') return;
    set({
      points,
      distanceMeters: totalDistance(points),
      accuracy: points[points.length - 1]?.acc ?? get().accuracy,
    });
  },

  syncFromStorage: async () => {
    const { status } = get();
    if (status !== 'running' && status !== 'paused') return;

    const points = await readPoints();
    set({ points, distanceMeters: totalDistance(points) });
  },

  restore: async () => {
    // Runs during app hydration, so it must not throw and must not start a
    // foreground service — Android 12+ forbids starting one from a cold launch,
    // and an unguarded attempt here crash-looped the app on every open.
    try {
      const meta = await readMeta();
      if (!meta) return false;

      if (Date.now() - meta.startedAt > MAX_RESUME_AGE_MS) {
        await clearActive();
        return false;
      }

      const points = await readPoints();
      set({
        status: meta.segmentStartedAt == null ? 'paused' : 'running',
        startedAt: meta.startedAt,
        accumulatedMs: meta.accumulatedMs,
        segmentStartedAt: meta.segmentStartedAt,
        points,
        distanceMeters: totalDistance(points),
        accuracy: points[points.length - 1]?.acc ?? null,
        mode: null,
        errorMessage: null,
        notice: null,
      });

      if (meta.segmentStartedAt != null) startTimer(set, get);
      return true;
    } catch {
      // A buffer we cannot parse is worse than no buffer — drop it rather than
      // failing the same way on every subsequent launch.
      await clearActive().catch(() => {});
      return false;
    }
  },

  reattach: async () => {
    const { status, mode } = get();
    if (status !== 'running' && status !== 'paused') return;
    if (mode) return;

    const next = await beginRecording(true);
    set({
      mode: next,
      notice:
        next === 'foreground'
          ? 'Recording while Kinetic is open. Allow location “all the time” to keep tracking with the screen off.'
          : next == null
            ? 'Location updates could not be restarted. Finish the run to keep what was recorded.'
            : null,
    });
  },
}));

/** Moving time in seconds, live. */
export function selectElapsedSec(s: TrackerState): number {
  const live = s.segmentStartedAt ? Date.now() - s.segmentStartedAt : 0;
  return Math.floor((s.accumulatedMs + live) / 1000);
}

/**
 * Pace over the last 30 seconds rather than the whole run, so the number
 * responds when you pick it up or ease off.
 */
export function selectCurrentPace(s: TrackerState): { meters: number; seconds: number } {
  const pts = s.points;
  if (pts.length < 2) return { meters: 0, seconds: 0 };

  const cutoff = pts[pts.length - 1].t - PACE_WINDOW_MS;
  let i = pts.length - 1;
  while (i > 0 && pts[i - 1].t >= cutoff) i--;

  let meters = 0;
  let ms = 0;
  for (let j = i + 1; j < pts.length; j++) {
    // Same rule as everywhere else: a pause contributes neither, so live pace
    // does not spike on the first fix after a resume.
    if (pts[j].break) continue;
    meters += haversine(pts[j - 1], pts[j]);
    ms += Math.max(0, pts[j].t - pts[j - 1].t);
  }

  return { meters, seconds: ms / 1000 };
}

function titleForHour(hour: number): string {
  if (hour < 5) return 'Night Run';
  if (hour < 11) return 'Morning Run';
  if (hour < 15) return 'Midday Run';
  if (hour < 19) return 'Afternoon Run';
  return 'Evening Run';
}
