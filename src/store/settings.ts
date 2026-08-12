import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

export type ThemeMode = 'system' | 'light' | 'dark';
export type Units = 'metric' | 'imperial';

const KEY = 'kinetic.settings.v1';

type Persisted = {
  themeMode: ThemeMode;
  units: Units;
  /** Weekly distance goal, always stored in metres regardless of display units. */
  weeklyGoalMeters: number;
  displayName: string;
  hapticsEnabled: boolean;
  audioCuesEnabled: boolean;
  keepAwake: boolean;
};

type SettingsState = Persisted & {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  set: <K extends keyof Persisted>(key: K, value: Persisted[K]) => void;
};

const defaults: Persisted = {
  themeMode: 'system',
  units: 'metric',
  weeklyGoalMeters: 30_000,
  displayName: 'Runner',
  hapticsEnabled: true,
  audioCuesEnabled: true,
  keepAwake: true,
};

function persist(state: Persisted) {
  const snapshot: Persisted = {
    themeMode: state.themeMode,
    units: state.units,
    weeklyGoalMeters: state.weeklyGoalMeters,
    displayName: state.displayName,
    hapticsEnabled: state.hapticsEnabled,
    audioCuesEnabled: state.audioCuesEnabled,
    keepAwake: state.keepAwake,
  };
  // Fire-and-forget: a failed settings write should never break the UI.
  AsyncStorage.setItem(KEY, JSON.stringify(snapshot)).catch(() => {});
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...defaults,
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Persisted>;
        // Spread over defaults so a settings key added in a later version
        // doesn't come back undefined for existing installs.
        set({ ...defaults, ...parsed, hydrated: true });
        return;
      }
    } catch {
      // Corrupt payload — fall through to defaults rather than trapping the user.
    }
    set({ hydrated: true });
  },

  set: (key, value) => {
    set({ [key]: value } as Pick<Persisted, typeof key>);
    persist(get());
  },
}));
