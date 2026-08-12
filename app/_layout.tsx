import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { KineticLogo } from '@/components/KineticLogo';
// Side-effect import: registers the background location task. Must run during
// bundle evaluation, before Android can deliver a batch of fixes to a headless
// context that has no components mounted.
import '@/lib/locationTask';
import { useRuns } from '@/store/runs';
import { useSettings } from '@/store/settings';
import { useTracker } from '@/store/tracker';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

export default function RootLayout() {
  const hydrateSettings = useSettings((s) => s.hydrate);
  const hydrateRuns = useRuns((s) => s.hydrate);
  const restoreRun = useTracker((s) => s.restore);

  const [ready, setReady] = useState(false);
  const [resumed, setResumed] = useState(false);

  useEffect(() => {
    // Settings first — the theme depends on it, and flashing the wrong theme on
    // launch is the one loading artefact users always notice.
    Promise.all([hydrateSettings(), hydrateRuns(), restoreRun()])
      .then(([, , didResume]) => setResumed(didResume === true))
      .finally(() => setReady(true));
  }, [hydrateSettings, hydrateRuns, restoreRun]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>{ready ? <Navigator resumed={resumed} /> : <Boot />}</ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Navigator({ resumed }: { resumed: boolean }) {
  const { colors, isDark } = useTheme();
  const router = useRouter();

  useEffect(() => {
    // A run was still recording when the app was last killed or swiped away.
    // Drop the user straight back into it rather than onto a home screen that
    // says nothing about the run still ticking in the notification shade.
    if (resumed) router.replace('/run');
  }, [resumed, router]);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="run"
          options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
        />
        <Stack.Screen name="activity/[id]" />
      </Stack>
    </>
  );
}

/** Held while AsyncStorage is read. Matches the native splash so the handoff is seamless. */
function Boot() {
  const { colors } = useTheme();
  return (
    <View
      style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}
    >
      <KineticLogo size={96} glow />
    </View>
  );
}
