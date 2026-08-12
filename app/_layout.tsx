import { Stack, useRouter, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { KineticLogo } from '@/components/KineticLogo';
import { Text } from '@/components/Text';
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
    //
    // The catch is load-bearing: anything that throws here runs on *every*
    // launch, so an unhandled rejection becomes a permanent crash loop the user
    // can only escape by clearing app data. Start degraded instead.
    Promise.all([hydrateSettings(), hydrateRuns(), restoreRun()])
      .then(([, , didResume]) => setResumed(didResume === true))
      .catch(() => setResumed(false))
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
    if (!resumed) return;
    try {
      router.replace('/run');
    } catch {
      // Navigating on the first frame can race the router being ready. Landing
      // on Home is a far better outcome than failing to launch.
    }
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

/**
 * Last line of defence. expo-router renders this instead of unmounting the app
 * when a render throws, which turns "the app closes itself" into something the
 * user can read and act on — and offers the one action that clears a poisoned
 * active-run buffer without digging through system settings.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <CrashScreen error={error} retry={retry} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function CrashScreen({ error, retry }: ErrorBoundaryProps) {
  const { colors, space, radius } = useTheme();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        alignItems: 'center',
        justifyContent: 'center',
        padding: space.xl,
        gap: space.lg,
      }}
    >
      <KineticLogo size={64} monochrome={colors.textFaint} />
      <Text variant="h2" align="center">
        Kinetic hit a problem
      </Text>
      <Text variant="caption" color="muted" align="center">
        {error?.message ?? 'Something went wrong.'}
      </Text>

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          // Almost always an in-progress run we cannot resume. Dropping it is
          // what lets the next launch succeed.
          useTracker
            .getState()
            .discard()
            .catch(() => {})
            .finally(() => retry());
        }}
        style={{
          backgroundColor: colors.brand,
          paddingHorizontal: space['2xl'],
          paddingVertical: space.md,
          borderRadius: radius.pill,
        }}
      >
        <Text variant="bodyStrong" color={colors.onBrand}>
          Discard run and restart
        </Text>
      </Pressable>

      <Pressable accessibilityRole="button" onPress={() => retry()} hitSlop={8}>
        <Text variant="caption" color="brand">
          Just try again
        </Text>
      </Pressable>
    </View>
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
