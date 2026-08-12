import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef } from 'react';
import {
  Alert,
  Animated,
  AppState,
  Easing,
  Pressable,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { KineticLogo } from '@/components/KineticLogo';
import { RouteTrace } from '@/components/RouteTrace';
import { Card, Label, Screen } from '@/components/Surface';
import { Text } from '@/components/Text';
import {
  distanceUnit,
  estimateCalories,
  formatDistance,
  formatDuration,
  formatPace,
  paceUnit,
} from '@/lib/format';
import { useRuns } from '@/store/runs';
import { useSettings } from '@/store/settings';
import { selectCurrentPace, selectElapsedSec, useTracker } from '@/store/tracker';
import { useTheme } from '@/theme/ThemeProvider';

export default function RunScreen() {
  const { colors, space, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const tracker = useTracker();
  const addRun = useRuns((s) => s.addRun);
  const units = useSettings((s) => s.units);
  const haptics = useSettings((s) => s.hapticsEnabled);
  const keepAwake = useSettings((s) => s.keepAwake);

  const isLive = tracker.status === 'running' || tracker.status === 'paused';

  useEffect(() => {
    // No-ops when a run was just restored from the durable buffer.
    tracker.prepare();
    // Releasing the GPS subscription on unmount is handled by discard/finish;
    // this only runs the initial acquisition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Coming back from the background, the in-memory track can be behind what
    // the location task wrote while nothing was rendering. Re-read it.
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') useTracker.getState().syncFromStorage();
    });
    return () => sub.remove();
  }, []);

  const buzz = (style: Haptics.ImpactFeedbackStyle) => {
    if (haptics) Haptics.impactAsync(style).catch(() => {});
  };

  const handleFinish = () => {
    Alert.alert('Finish this run?', 'Your run will be saved to your activity history.', [
      { text: 'Keep running', style: 'cancel' },
      {
        text: 'Finish',
        style: 'default',
        onPress: async () => {
          const run = await tracker.finish();
          buzz(Haptics.ImpactFeedbackStyle.Heavy);
          if (run) {
            addRun(run);
            router.replace({ pathname: '/activity/[id]', params: { id: run.id, fresh: '1' } });
          } else {
            Alert.alert(
              'Run too short to save',
              'Kinetic keeps runs over 50 metres and 20 seconds.',
            );
            router.back();
          }
        },
      },
    ]);
  };

  const handleClose = () => {
    if (!isLive) {
      tracker.discard();
      router.back();
      return;
    }
    Alert.alert('Discard this run?', 'Everything recorded so far will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          await tracker.discard();
          router.back();
        },
      },
    ]);
  };

  return (
    <Screen edges={['top']}>
      {keepAwake && isLive && <KeepAwake />}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: space.lg,
          paddingVertical: space.md,
        }}
      >
        <Pressable
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel={isLive ? 'Discard run' : 'Close'}
          hitSlop={12}
          style={({ pressed }) => [
            {
              width: 40,
              height: 40,
              borderRadius: radius.pill,
              backgroundColor: colors.surfaceAlt,
              alignItems: 'center',
              justifyContent: 'center',
            },
            pressed && { opacity: 0.6 },
          ]}
        >
          <Icon name="close" size={20} color={colors.textMuted} />
        </Pressable>

        <GpsBadge status={tracker.status} accuracy={tracker.accuracy} />

        <View style={{ width: 40 }} />
      </View>

      {isLive ? (
        <LiveView units={units} onFinish={handleFinish} buzz={buzz} />
      ) : (
        <PreRunView units={units} buzz={buzz} />
      )}

      <View style={{ height: Math.max(insets.bottom, space.lg) }} />
    </Screen>
  );
}

/** Separate component so the hook only mounts while a run is actually live. */
function KeepAwake() {
  useKeepAwake();
  return null;
}

/* ------------------------------------------------------------------ *
 * Before the run
 * ------------------------------------------------------------------ */

function PreRunView({
  units,
  buzz,
}: {
  units: 'metric' | 'imperial';
  buzz: (s: Haptics.ImpactFeedbackStyle) => void;
}) {
  const { colors, space, radius } = useTheme();
  const tracker = useTracker();
  const ready = tracker.status === 'ready';
  const denied = tracker.status === 'denied';

  return (
    <View style={{ flex: 1, paddingHorizontal: space.lg, justifyContent: 'space-between' }}>
      <View style={{ alignItems: 'center', gap: space.lg, marginTop: space['4xl'] }}>
        <KineticLogo size={104} glow />
        <View style={{ alignItems: 'center', gap: space.xs }}>
          <Text variant="h1">Ready to run</Text>
          <Text variant="body" color="muted" align="center">
            {denied
              ? tracker.errorMessage
              : ready
                ? 'GPS locked. Hit start when you are.'
                : 'Finding your position…'}
          </Text>
        </View>

        {/* Background access is the difference between a full track and one that
            stops at the lock screen, so say which one they're about to get. */}
        {!denied && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.sm,
              backgroundColor: tracker.backgroundGranted ? colors.brandWash : colors.surfaceAlt,
              paddingHorizontal: space.lg,
              paddingVertical: space.sm,
              borderRadius: radius.pill,
            }}
          >
            <Icon
              name={tracker.backgroundGranted ? 'check' : 'lock'}
              size={14}
              color={tracker.backgroundGranted ? colors.brand : colors.warning}
            />
            <Text variant="caption" color="muted" style={{ flexShrink: 1 }}>
              {tracker.backgroundGranted
                ? 'Records with the screen off'
                : 'Screen must stay on — allow location “all the time”'}
            </Text>
          </View>
        )}
      </View>

      <View style={{ gap: space.lg, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', gap: space['3xl'] }}>
          <Preview label="Distance" value={`0.00 ${distanceUnit(units)}`} />
          <Preview label="Time" value="0:00" />
          <Preview label="Pace" value={`—:— ${paceUnit(units)}`} />
        </View>

        {denied ? (
          <Button
            label="Try again"
            icon="pin"
            fullWidth
            size="lg"
            onPress={() => tracker.prepare()}
          />
        ) : (
          <StartButton
            disabled={!ready}
            onPress={() => {
              buzz(Haptics.ImpactFeedbackStyle.Heavy);
              tracker.start();
            }}
          />
        )}

        <Text variant="caption" color="faint" align="center">
          {denied
            ? 'Enable location access for Kinetic in your device settings.'
            : 'Keep Kinetic open while you run to record the full route.'}
        </Text>
      </View>
    </View>
  );
}

function Preview({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <Label>{label}</Label>
      <Text variant="bodyStrong" color="faint" tabular>
        {value}
      </Text>
    </View>
  );
}

/** Big circular start control with a breathing halo while it waits for GPS. */
function StartButton({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!disabled) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [disabled, pulse]);

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', height: 176 }}>
      {disabled && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: 156,
            height: 156,
            borderRadius: 78,
            borderWidth: 2,
            borderColor: colors.brand,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
            transform: [
              { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] }) },
            ],
          }}
        />
      )}

      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Start run"
        accessibilityState={{ disabled }}
        style={({ pressed }) => [
          {
            width: 156,
            height: 156,
            borderRadius: 78,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: disabled ? colors.surfaceAlt : colors.brand,
          },
          pressed && { transform: [{ scale: 0.96 }] },
        ]}
      >
        <Text
          variant="h1"
          color={disabled ? colors.textFaint : colors.onBrand}
          style={{ letterSpacing: 2 }}
        >
          START
        </Text>
      </Pressable>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * During the run
 * ------------------------------------------------------------------ */

function LiveView({
  units,
  onFinish,
  buzz,
}: {
  units: 'metric' | 'imperial';
  onFinish: () => void;
  buzz: (s: Haptics.ImpactFeedbackStyle) => void;
}) {
  const { colors, space, radius } = useTheme();
  const { width } = useWindowDimensions();
  const tracker = useTracker();

  const paused = tracker.status === 'paused';
  const elapsed = selectElapsedSec(tracker);
  const window = useMemo(() => selectCurrentPace(tracker), [tracker]);
  const calories = estimateCalories(tracker.distanceMeters, elapsed);

  const traceWidth = width - space.lg * 2 - space.lg * 2;

  return (
    <View style={{ flex: 1, paddingHorizontal: space.lg, gap: space.lg }}>
      <View style={{ alignItems: 'center', gap: space.xs, marginTop: space.sm }}>
        <Label>Distance</Label>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Text variant="metricHero">{formatDistance(tracker.distanceMeters, units, 2)}</Text>
          <Text variant="h2" color="muted">
            {distanceUnit(units)}
          </Text>
        </View>
      </View>

      <Card tone="alt">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Live label="Time" value={formatDuration(elapsed)} />
          <Live
            label="Pace"
            value={formatPace(window.meters, window.seconds, units)}
            unit={paceUnit(units)}
          />
          <Live label="Calories" value={String(calories)} unit="kcal" />
        </View>
      </Card>

      <Card padded={false} style={{ flex: 1, overflow: 'hidden' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg }}>
          <RouteTrace
            points={tracker.points}
            width={traceWidth}
            height={200}
            strokeWidth={4}
            padding={24}
          />
        </View>
      </Card>

      {paused && (
        <View
          style={{
            alignSelf: 'center',
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.sm,
            backgroundColor: colors.surfaceAlt,
            paddingHorizontal: space.lg,
            paddingVertical: space.sm,
            borderRadius: radius.pill,
          }}
        >
          <Icon name="pause" size={14} color={colors.warning} />
          <Text variant="caption" color="muted">
            Paused — the clock is stopped
          </Text>
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
        <Button
          label="Finish"
          icon="stop"
          variant="secondary"
          size="lg"
          style={{ flex: 1 }}
          fullWidth
          onPress={onFinish}
        />
        <Button
          label={paused ? 'Resume' : 'Pause'}
          icon={paused ? 'play' : 'pause'}
          size="lg"
          style={{ flex: 1 }}
          fullWidth
          onPress={() => {
            buzz(Haptics.ImpactFeedbackStyle.Medium);
            paused ? tracker.resume() : tracker.pause();
          }}
        />
      </View>
    </View>
  );
}

function Live({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <Label>{label}</Label>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
        <Text variant="metricMd">{value}</Text>
        {unit && (
          <Text variant="label" color="faint">
            {unit}
          </Text>
        )}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * GPS status
 * ------------------------------------------------------------------ */

function GpsBadge({ status, accuracy }: { status: string; accuracy: number | null }) {
  const { colors, space, radius } = useTheme();
  const blink = useRef(new Animated.Value(1)).current;

  const recording = status === 'running';
  const searching = status === 'acquiring';

  useEffect(() => {
    if (!recording) {
      blink.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.15, duration: 700, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [recording, blink]);

  const { tint, text } = (() => {
    if (status === 'denied') return { tint: colors.danger, text: 'No GPS' };
    if (recording) return { tint: colors.danger, text: 'Recording' };
    if (status === 'paused') return { tint: colors.warning, text: 'Paused' };
    if (searching) return { tint: colors.textFaint, text: 'Searching…' };
    return {
      tint: colors.brand,
      text: accuracy != null ? `GPS · ±${Math.round(accuracy)}m` : 'GPS ready',
    };
  })();

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Location status: ${text}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        backgroundColor: colors.surfaceAlt,
        paddingHorizontal: space.md,
        paddingVertical: 7,
        borderRadius: radius.pill,
      }}
    >
      <Animated.View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: tint,
          opacity: blink,
        }}
      />
      <Text variant="label" color="muted" uppercase>
        {text}
      </Text>
    </View>
  );
}
