import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Alert, Pressable, Share, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { SplitBar } from '@/components/Metrics';
import { RouteTrace } from '@/components/RouteTrace';
import { Card, Divider, Label, Screen, SectionHeader } from '@/components/Surface';
import { Text } from '@/components/Text';
import {
  distanceUnit,
  elevationUnit,
  estimateCalories,
  formatDistance,
  formatDuration,
  formatElevation,
  formatPace,
  formatRunDate,
  formatSpeed,
  paceUnit,
  unitMeters,
} from '@/lib/format';
import { computeSplits } from '@/lib/geo';
import { useRuns } from '@/store/runs';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TARGET } from '@/theme/tokens';

export default function RunDetailScreen() {
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const { colors, space, radius } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const run = useRuns((s) => s.runs.find((r) => r.id === id));
  const removeRun = useRuns((s) => s.removeRun);
  const units = useSettings((s) => s.units);

  const justSaved = fresh === '1';

  // Splits are stored per kilometre; recompute for miles rather than converting,
  // so each mile marker lands where it actually was on the route.
  const splits = useMemo(() => {
    if (!run) return [];
    return units === 'metric' ? run.splits : computeSplits(run.points, unitMeters(units));
  }, [run, units]);

  /** Seconds per display unit, normalised so a partial final split compares fairly. */
  const paceOf = (split: { seconds: number; meters: number }) =>
    split.meters > 0 ? split.seconds / (split.meters / unitMeters(units)) : Infinity;

  const fastestSplit = useMemo(() => {
    // Only complete splits qualify — a 0.2km tail would win on noise alone.
    const full = splits.filter((s) => s.meters >= unitMeters(units) * 0.95);
    if (full.length === 0) return null;
    return full.reduce((best, s) => (paceOf(s) < paceOf(best) ? s : best));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splits, units]);

  if (!run) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
          <Icon name="route" size={28} color={colors.textFaint} />
          <Text variant="h3">Run not found</Text>
          <Text variant="caption" color="muted">
            It may have been deleted.
          </Text>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text variant="bodyStrong" color="brand">
              Go back
            </Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const calories = estimateCalories(run.distanceMeters, run.durationSec);
  const avgSpeed = run.durationSec > 0 ? run.distanceMeters / run.durationSec : 0;
  const traceWidth = width - space.lg * 2;

  const handleShare = () => {
    Share.share({
      message: `${formatDistance(run.distanceMeters, units, 2)} ${distanceUnit(
        units,
      )} in ${formatDuration(run.durationSec)} at ${formatPace(
        run.distanceMeters,
        run.durationSec,
        units,
      )}${paceUnit(units)} — tracked with Kinetic.`,
    }).catch(() => {});
  };

  const handleDelete = () => {
    Alert.alert('Delete this run?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          removeRun(run.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <Screen scroll contentStyle={{ paddingHorizontal: space.lg, gap: space.lg }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: space.md,
        }}
      >
        <RoundButton
          icon="chevronLeft"
          label="Back"
          // A saved run replaces the tracking screen, so "back" would land on it
          // again — send the user home instead.
          onPress={() => (justSaved ? router.replace('/') : router.back())}
        />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <RoundButton icon="share" label="Share run" onPress={handleShare} />
          <RoundButton icon="trash" label="Delete run" onPress={handleDelete} tone="danger" />
        </View>
      </View>

      {justSaved && (
        <Card tone="brand">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: radius.pill,
                backgroundColor: colors.brand,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="check" size={20} color={colors.onBrand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">Run saved</Text>
              <Text variant="caption" color="muted">
                Nice work. It's in your history now.
              </Text>
            </View>
          </View>
        </Card>
      )}

      {/* Hero */}
      <View style={{ gap: space.xs }}>
        <Text variant="caption" color="muted">
          {formatRunDate(run.startedAt)}
        </Text>
        <Text variant="h1">{run.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: space.sm }}>
          <Text variant="metricHero">{formatDistance(run.distanceMeters, units, 2)}</Text>
          <Text variant="h2" color="muted">
            {distanceUnit(units)}
          </Text>
        </View>
      </View>

      {/* Route */}
      <Card padded={false} style={{ overflow: 'hidden' }}>
        <View style={{ padding: space.lg, alignItems: 'center' }}>
          <RouteTrace points={run.points} width={traceWidth - space.lg * 2} height={210} />
        </View>
      </Card>

      {/* Metrics */}
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: space.xl }}>
          <Metric
            icon="clock"
            label="Moving time"
            value={formatDuration(run.durationSec)}
          />
          <Metric
            icon="trending"
            label="Avg pace"
            value={formatPace(run.distanceMeters, run.durationSec, units)}
            unit={paceUnit(units)}
          />
          <Metric
            icon="pulse"
            label="Avg speed"
            value={formatSpeed(avgSpeed, units)}
            unit={units === 'metric' ? 'km/h' : 'mph'}
          />
          <Metric icon="flame" label="Calories" value={String(calories)} unit="kcal" />
          <Metric
            icon="elevation"
            label="Elevation"
            value={formatElevation(run.elevationGainMeters, units)}
            unit={elevationUnit(units)}
          />
          {run.avgHr != null && (
            <Metric icon="heart" label="Avg heart rate" value={String(run.avgHr)} unit="bpm" />
          )}
        </View>
      </Card>

      {/* Splits */}
      {splits.length > 0 && (
        <Card>
          <SectionHeader title={`Splits per ${units === 'metric' ? 'kilometre' : 'mile'}`} />

          {splits.map((split, i) => {
            const isPartial = split.meters < unitMeters(units) * 0.95;
            const pace = formatPace(split.meters, split.seconds, units);
            const isFastest = fastestSplit != null && split.index === fastestSplit.index;

            // Bar length is the fastest split's pace over this one's, so the
            // quickest km fills the track and slower ones fall short. Cubed,
            // because raw pace ratios across a run sit in a narrow band and the
            // untouched bars all look identical.
            const fraction = fastestSplit ? (paceOf(fastestSplit) / paceOf(split)) ** 3 : 1;

            return (
              <View key={split.index}>
                {i > 0 && <Divider />}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.md,
                    paddingVertical: space.md,
                  }}
                >
                  <Text variant="caption" color="faint" style={{ width: 26 }} tabular>
                    {isPartial
                      ? (split.meters / unitMeters(units)).toFixed(1)
                      : String(split.index)}
                  </Text>

                  <SplitBar fraction={fraction} fastest={isFastest} />

                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3, width: 74, justifyContent: 'flex-end' }}>
                    <Text variant="bodyStrong" tabular>
                      {pace}
                    </Text>
                    {isFastest && <Icon name="flame" size={12} color={colors.brand} />}
                  </View>
                </View>
              </View>
            );
          })}
        </Card>
      )}

      <View style={{ height: insets.bottom }} />
    </Screen>
  );
}

function RoundButton({
  icon,
  label,
  onPress,
  tone = 'default',
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
}) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [
        {
          width: MIN_TARGET - 4,
          height: MIN_TARGET - 4,
          borderRadius: radius.pill,
          backgroundColor: colors.surfaceAlt,
          alignItems: 'center',
          justifyContent: 'center',
        },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Icon name={icon} size={19} color={tone === 'danger' ? colors.danger : colors.textMuted} />
    </Pressable>
  );
}

function Metric({
  icon,
  label,
  value,
  unit,
}: {
  icon: IconName;
  label: string;
  value: string;
  unit?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ width: '50%', gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name={icon} size={13} color={colors.textFaint} />
        <Label>{label}</Label>
      </View>
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
