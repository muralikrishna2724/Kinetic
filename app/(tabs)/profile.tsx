import React, { useMemo } from 'react';
import { Alert, Pressable, Switch, View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { KineticLogo } from '@/components/KineticLogo';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Card, Divider, Label, Screen, SectionHeader } from '@/components/Surface';
import { Text } from '@/components/Text';
import { distanceUnit, formatDistance, formatDurationShort, unitMeters } from '@/lib/format';
import { totalsFor, useRuns } from '@/store/runs';
import { useSettings, type ThemeMode, type Units } from '@/store/settings';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TARGET } from '@/theme/tokens';

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const UNIT_OPTIONS: { value: Units; label: string }[] = [
  { value: 'metric', label: 'Kilometres' },
  { value: 'imperial', label: 'Miles' },
];

export default function ProfileScreen() {
  const { colors, space, radius, isDark } = useTheme();

  const runs = useRuns((s) => s.runs);
  const clearAll = useRuns((s) => s.clearAll);
  const settings = useSettings();
  const set = useSettings((s) => s.set);

  const lifetime = useMemo(() => totalsFor(runs), [runs]);
  const goalUnits = settings.weeklyGoalMeters / unitMeters(settings.units);

  const adjustGoal = (delta: number) => {
    const step = delta * unitMeters(settings.units) * 5;
    const next = Math.max(unitMeters(settings.units) * 5, settings.weeklyGoalMeters + step);
    set('weeklyGoalMeters', Math.round(next));
  };

  const confirmClear = () => {
    Alert.alert(
      'Clear run history?',
      'This permanently deletes every run stored on this device. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete all', style: 'destructive', onPress: clearAll },
      ],
    );
  };

  return (
    <Screen scroll contentStyle={{ paddingHorizontal: space.lg, gap: space.lg }}>
      <View style={{ paddingTop: space.lg }}>
        <Text variant="h1">Profile</Text>
      </View>

      {/* Identity + lifetime totals */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
          <View
            style={{
              width: 62,
              height: 62,
              borderRadius: radius.xl,
              backgroundColor: colors.surfaceAlt,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <KineticLogo size={38} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="h2">{settings.displayName}</Text>
            <Text variant="caption" color="muted">
              {lifetime.runs} {lifetime.runs === 1 ? 'run' : 'runs'} recorded
            </Text>
          </View>
        </View>

        <View style={{ height: space.lg }} />
        <Divider />
        <View style={{ height: space.lg }} />

        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Lifetime
            label="Distance"
            value={formatDistance(lifetime.meters, settings.units, 1)}
            unit={distanceUnit(settings.units)}
          />
          <Lifetime label="Time" value={formatDurationShort(lifetime.seconds)} />
          <Lifetime label="Runs" value={String(lifetime.runs)} />
        </View>
      </Card>

      {/* Appearance */}
      <Card>
        <SectionHeader title="Appearance" />
        <View style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Icon name={isDark ? 'moon' : 'sun'} size={16} color={colors.brand} />
            <Text variant="caption" color="muted">
              Currently showing the {isDark ? 'dark' : 'light'} theme
            </Text>
          </View>
          <SegmentedControl
            options={THEME_OPTIONS}
            value={settings.themeMode}
            onChange={(v) => set('themeMode', v)}
          />
        </View>
      </Card>

      {/* Units + goal */}
      <Card>
        <SectionHeader title="Measurement" />
        <View style={{ gap: space.lg }}>
          <View style={{ gap: space.sm }}>
            <Label>Distance units</Label>
            <SegmentedControl
              options={UNIT_OPTIONS}
              value={settings.units}
              onChange={(v) => set('units', v)}
            />
          </View>

          <View style={{ gap: space.sm }}>
            <Label>Weekly goal</Label>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
              <Stepper direction="down" onPress={() => adjustGoal(-1)} />
              <View style={{ flex: 1, alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                  <Text variant="metricLg">{goalUnits.toFixed(0)}</Text>
                  <Text variant="caption" color="muted">
                    {distanceUnit(settings.units)} / week
                  </Text>
                </View>
              </View>
              <Stepper direction="up" onPress={() => adjustGoal(1)} />
            </View>
          </View>
        </View>
      </Card>

      {/* Toggles */}
      <Card>
        <SectionHeader title="During a run" />
        <Toggle
          icon="device"
          label="Keep screen awake"
          detail="Stops the display sleeping while recording"
          value={settings.keepAwake}
          onChange={(v) => set('keepAwake', v)}
        />
        <Divider />
        <Toggle
          icon="bell"
          label="Audio cues"
          detail="Announce each split as you pass it"
          value={settings.audioCuesEnabled}
          onChange={(v) => set('audioCuesEnabled', v)}
        />
        <Divider />
        <Toggle
          icon="pulse"
          label="Haptics"
          detail="Vibrate on start, pause and finish"
          value={settings.hapticsEnabled}
          onChange={(v) => set('hapticsEnabled', v)}
        />
      </Card>

      {/* Data */}
      <Card>
        <SectionHeader title="Data" />
        <Pressable
          onPress={confirmClear}
          accessibilityRole="button"
          accessibilityLabel="Clear run history"
          style={({ pressed }) => [
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.md,
              minHeight: MIN_TARGET,
            },
            pressed && { opacity: 0.6 },
          ]}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.md,
              backgroundColor: colors.danger + '1A',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="trash" size={17} color={colors.danger} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong" color="danger">
              Clear run history
            </Text>
            <Text variant="caption" color="faint">
              Deletes all {lifetime.runs} runs from this device
            </Text>
          </View>
        </Pressable>
      </Card>

      <View style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.lg }}>
        <KineticLogo size={26} monochrome={colors.textFaint} />
        <Text variant="caption" color="faint">
          Kinetic 1.0.0
        </Text>
        {runs.some((r) => r.isSeed) && (
          <Text variant="label" color="faint" uppercase>
            Showing demo history
          </Text>
        )}
      </View>
    </Screen>
  );
}

function Lifetime({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View>
      <Label>{label}</Label>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
        <Text variant="metricMd">{value}</Text>
        {unit && (
          <Text variant="caption" color="muted">
            {unit}
          </Text>
        )}
      </View>
    </View>
  );
}

function Stepper({ direction, onPress }: { direction: 'up' | 'down'; onPress: () => void }) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={direction === 'up' ? 'Increase weekly goal' : 'Decrease weekly goal'}
      style={({ pressed }) => [
        {
          width: MIN_TARGET,
          height: MIN_TARGET,
          borderRadius: radius.pill,
          backgroundColor: colors.surfaceAlt,
          alignItems: 'center',
          justifyContent: 'center',
        },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Text variant="h2" color="brand">
        {direction === 'up' ? '+' : '−'}
      </Text>
    </Pressable>
  );
}

function Toggle({
  icon,
  label,
  detail,
  value,
  onChange,
}: {
  icon: IconName;
  label: string;
  detail: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { colors, space, radius } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: space.md,
        minHeight: MIN_TARGET,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radius.md,
          backgroundColor: colors.surfaceAlt,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={17} color={colors.textMuted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{label}</Text>
        <Text variant="caption" color="faint">
          {detail}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ false: colors.surfaceAlt, true: colors.brand }}
        thumbColor={colors.surface}
        ios_backgroundColor={colors.surfaceAlt}
      />
    </View>
  );
}
