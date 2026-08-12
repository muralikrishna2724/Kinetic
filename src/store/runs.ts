import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import type { GeoPoint, Split } from '../lib/geo';
import { buildSeedRuns } from '../lib/seed';

export type Run = {
  id: string;
  title: string;
  /** Epoch ms. */
  startedAt: number;
  endedAt: number;
  /** Moving time in seconds — excludes paused stretches. */
  durationSec: number;
  distanceMeters: number;
  points: GeoPoint[];
  splits: Split[];
  elevationGainMeters: number;
  avgHr?: number;
  notes?: string;
  /** Demo data. Wiped as soon as the user records their own run. */
  isSeed?: boolean;
};

const KEY = 'kinetic.runs.v1';

type RunsState = {
  runs: Run[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  addRun: (run: Run) => void;
  removeRun: (id: string) => void;
  renameRun: (id: string, title: string) => void;
  clearAll: () => void;
};

function persist(runs: Run[]) {
  AsyncStorage.setItem(KEY, JSON.stringify(runs)).catch(() => {});
}

export const useRuns = create<RunsState>((set, get) => ({
  runs: [],
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Run[];
        set({ runs: parsed, hydrated: true });
        return;
      }
    } catch {
      // Unreadable store — start fresh rather than dead-ending the app.
    }
    // First launch: populate demo history so every screen has something to show.
    const seeded = buildSeedRuns();
    set({ runs: seeded, hydrated: true });
    persist(seeded);
  },

  addRun: (run) => {
    // The first real run retires the whole demo set — mixing them would make
    // the totals and streaks lie.
    const existing = get().runs.filter((r) => !r.isSeed);
    const next = [run, ...existing].sort((a, b) => b.startedAt - a.startedAt);
    set({ runs: next });
    persist(next);
  },

  removeRun: (id) => {
    const next = get().runs.filter((r) => r.id !== id);
    set({ runs: next });
    persist(next);
  },

  renameRun: (id, title) => {
    const next = get().runs.map((r) => (r.id === id ? { ...r, title } : r));
    set({ runs: next });
    persist(next);
  },

  clearAll: () => {
    set({ runs: [] });
    persist([]);
  },
}));

/* ------------------------------------------------------------------ *
 * Derived selectors
 * ------------------------------------------------------------------ */

export function startOfWeek(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // Monday-first week.
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d;
}

export type Totals = {
  runs: number;
  meters: number;
  seconds: number;
  elevation: number;
};

export function totalsFor(runs: Run[], since?: number): Totals {
  const scoped = since == null ? runs : runs.filter((r) => r.startedAt >= since);
  return scoped.reduce<Totals>(
    (acc, r) => ({
      runs: acc.runs + 1,
      meters: acc.meters + r.distanceMeters,
      seconds: acc.seconds + r.durationSec,
      elevation: acc.elevation + r.elevationGainMeters,
    }),
    { runs: 0, meters: 0, seconds: 0, elevation: 0 },
  );
}

/** Distance per day for the last `days` days, oldest first. */
export function dailyDistance(runs: Run[], days: number): { date: Date; meters: number }[] {
  const out: { date: Date; meters: number }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const next = new Date(d);
    next.setDate(d.getDate() + 1);

    const meters = runs
      .filter((r) => r.startedAt >= d.getTime() && r.startedAt < next.getTime())
      .reduce((sum, r) => sum + r.distanceMeters, 0);

    out.push({ date: d, meters });
  }
  return out;
}

/**
 * Consecutive days ending today (or yesterday) that have at least one run.
 * Yesterday still counts so the streak doesn't visibly break before you've had
 * a chance to run today.
 */
export function currentStreak(runs: Run[]): number {
  if (runs.length === 0) return 0;

  const dayKeys = new Set(
    runs.map((r) => {
      const d = new Date(r.startedAt);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }),
  );

  const keyOf = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  if (!dayKeys.has(keyOf(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!dayKeys.has(keyOf(cursor))) return 0;
  }

  let streak = 0;
  while (dayKeys.has(keyOf(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Fastest pace (seconds per km) across runs of at least 1km. */
export function bestPaceSecPerKm(runs: Run[]): number | null {
  let best: number | null = null;
  for (const r of runs) {
    if (r.distanceMeters < 1000 || r.durationSec <= 0) continue;
    const pace = r.durationSec / (r.distanceMeters / 1000);
    if (best == null || pace < best) best = pace;
  }
  return best;
}

export function longestRun(runs: Run[]): Run | null {
  return runs.reduce<Run | null>(
    (best, r) => (best == null || r.distanceMeters > best.distanceMeters ? r : best),
    null,
  );
}
