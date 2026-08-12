import * as Location from 'expo-location';
import { create } from 'zustand';

import { clearActive, LOCATION_TASK, readMeta, readPoints, writeMeta } from '../lib/activeRun';
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
  /**
   * Whether "Allow all the time" was granted. Without it the run still records,
   * but only while Kinetic is on screen.
   */
  backgroundGranted: boolean;
  errorMessage: string | null;

  prepare: () => Promise<void>;
  start: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  /** Ends the run and returns it, or null if it was too short to keep. */
  finish: () => Promise<Run | null>;
  discard: () => Promise<void>;
  /** Called by the location task with the full persisted track. */
  ingest: (points: GeoPoint[]) => void;
  /** Re-reads the durable buffer — used on app foreground. */
  syncFromStorage: () => Promise<void>;
  /** Picks a run back up after the app was killed or backgrounded. */
  restore: () => Promise<boolean>;
};

/** Pre-run watcher. Only alive while acquiring a first fix. */
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

function startTimer(set: (partial: Partial<TrackerState>) => void, get: () => TrackerState) {
  stopTimer();
  timer = setInterval(() => set({ tick: get().tick + 1 }), 1000);
}

async function startLocationUpdates() {
  const already = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
  if (already) return;

  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 1000,
    distanceInterval: 1,
    // Let iOS know this is a workout so it tunes the GPS duty cycle for it.
    activityType: Location.ActivityType.Fitness,
    // iOS will otherwise stop updates when it thinks you've stopped moving,
    // which silently truncates a run at a long traffic light.
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    // Android requires an ongoing notification to keep delivering location once
    // the app leaves the foreground. This is what makes it survive a locked screen.
    foregroundService: {
      notificationTitle: 'Kinetic is recording',
      notificationBody: 'Tracking your run — tap to return',
      notificationColor: '#17E48F',
      killServiceOnDestroy: false,
    },
  });
}

async function stopLocationUpdates() {
  try {
    const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
    if (running) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  } catch {
    // Task was never registered, or already torn down.
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
  errorMessage: null as string | null,
};

export const useTracker = create<TrackerState>((set, get) => ({
  ...initial,

  prepare: async () => {
    // A run restored from a previous session must not be wiped by the pre-run
    // screen re-preparing on mount.
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

      // Asked separately, and only after foreground is granted — that is the
      // order Android 11+ requires, and asking for both at once gets the
      // background prompt suppressed entirely.
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

    // Hand off from the pre-run watcher to the background service — running both
    // would double-deliver every fix.
    stopWatching();

    await writeMeta({ startedAt, accumulatedMs: 0, segmentStartedAt: now });
    set({ status: 'running', startedAt, segmentStartedAt: now, accumulatedMs: 0 });

    startTimer(set, get);
    await startLocationUpdates();
  },

  pause: async () => {
    const { segmentStartedAt, accumulatedMs, startedAt } = get();
    const banked = accumulatedMs + (segmentStartedAt ? Date.now() - segmentStartedAt : 0);

    set({ status: 'paused', accumulatedMs: banked, segmentStartedAt: null });
    stopTimer();

    // Keep the service alive across a pause. Tearing it down and standing it
    // back up costs several seconds of GPS reacquisition on resume; the task
    // itself drops fixes while segmentStartedAt is null.
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
      await writeMeta({ startedAt, accumulatedMs, segmentStartedAt: now });
    }
    await startLocationUpdates();
  },

  finish: async () => {
    const state = get();
    const elapsedMs =
      state.accumulatedMs + (state.segmentStartedAt ? Date.now() - state.segmentStartedAt : 0);

    stopTimer();
    stopWatching();
    await stopLocationUpdates();

    // Take the durable copy as the source of truth — it includes anything the
    // background task recorded while the UI was not mounted.
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
    stopWatching();
    await stopLocationUpdates();
    await clearActive();
    set({ ...initial });
  },

  ingest: (points) => {
    // Ignore late deliveries that arrive after the run was finished or discarded.
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
    const meta = await readMeta();
    if (!meta) return false;

    const points = await readPoints();
    set({
      status: meta.segmentStartedAt == null ? 'paused' : 'running',
      startedAt: meta.startedAt,
      accumulatedMs: meta.accumulatedMs,
      segmentStartedAt: meta.segmentStartedAt,
      points,
      distanceMeters: totalDistance(points),
      accuracy: points[points.length - 1]?.acc ?? null,
      backgroundGranted: true,
      errorMessage: null,
    });

    if (meta.segmentStartedAt != null) {
      startTimer(set, get);
      // The service may have been torn down with the process; bring it back.
      await startLocationUpdates();
    }
    return true;
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
  for (let j = i + 1; j < pts.length; j++) meters += haversine(pts[j - 1], pts[j]);

  return { meters, seconds: (pts[pts.length - 1].t - pts[i].t) / 1000 };
}

function titleForHour(hour: number): string {
  if (hour < 5) return 'Night Run';
  if (hour < 11) return 'Morning Run';
  if (hour < 15) return 'Midday Run';
  if (hour < 19) return 'Afternoon Run';
  return 'Evening Run';
}
