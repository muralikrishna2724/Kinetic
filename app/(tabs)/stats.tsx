import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { BarChart } from '@/components/Metrics';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Card, Divider, Label, Screen, SectionHeader } from '@/components/Surface';
import { Text } from '@/components/Text';
import {
  distanceUnit,
  elevationUnit,
  formatDistance,
  formatDurationShort,
  formatElevation,
  formatRunDate,
  paceUnit,
  unitMeters,
} from '@/lib/format';
import { bestPaceSecPerKm, longestRun, totalsFor, useRuns, type Run } from '@/store/runs';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme/ThemeProvider';

type Window = '4w' | '12w' | '1y';

const WINDOWS: { value: Window; label: string; weeks: number }[] = [
  { value: '4w', label: '4 weeks', weeks: 4 },
  { value: '12w', label: '12 weeks', weeks: 12 },
  { value: '1y', label: '1 year', weeks: 52 },
];

export default function StatsScreen() {
  const { colors, space } = useTheme();
  const router = useRouter();
  const runs = useRuns((s) => s.runs);
  const units = useSettings((s) => s.units);
  const [window, setWindow] = useState<Window>('4w');

  const weeks = WINDOWS.find((w) => w.value === window)!.weeks;

  const buckets = useMemo(() => weeklyBuckets(runs, weeks), [runs, weeks]);
  const since = buckets[0]?.start ?? 0;
  const totals = useMemo(() => totalsFor(runs, since), [runs, since]);

  // A year of weekly bars won't fit, so roll it up to months at that range.
  const chart = useMemo(() => {
    if (window === '1y') {
      const months = monthlyBuckets(runs, 12);
      return months.map((m) => ({
        label: m.label,
        value: m.meters / unitMeters(units),
      }));
    }
    return buckets.map((b) => ({
      label: b.label,
      value: b.meters / unitMeters(units),
    }));
  }, [window, buckets, runs, units]);

  const avgPerWeek = totals.meters / Math.max(1, weeks);
  const best = useMemo(() => bestPaceSecPerKm(runs), [runs]);
  const longest = useMemo(() => longestRun(runs), [runs]);
  const biggestWeek = useMemo(
    () => buckets.reduce((max, b) => Math.max(max, b.meters), 0),
    [buckets],
  );

  const bestPaceLabel = best
    ? formatPaceSeconds(units === 'metric' ? best : best * 1.609344)
    : '—';

  return (
    <Screen scroll contentStyle={{ paddingHorizontal: space.lg, gap: space.lg }}>
      <View style={{ paddingTop: space.lg, gap: space.lg }}>
        <Text variant="h1">Stats</Text>
        <SegmentedControl
          options={WINDOWS.map((w) => ({ value: w.value, label: w.label }))}
          value={window}
          onChange={setWindow}
        />
      </View>

      <Card>
        <Label>Total distance</Label>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
          <Text variant="display">{formatDistance(totals.meters, units, 1)}</Text>
          <Text variant="h3" color="muted">
            {distanceUnit(units)}
          </Text>
        </View>

        <View style={{ height: space.lg }} />
        <BarChart data={chart} height={132} />
      </Card>

      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Tile
          icon="route"
          label="Runs"
          value={String(totals.runs)}
          unit={totals.runs === 1 ? 'run' : 'runs'}
        />
        <Tile icon="clock" label="Time" value={formatDurationShort(totals.seconds)} />
      </View>

      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Tile
          icon="target"
          label="Weekly avg"
          value={formatDistance(avgPerWeek, units, 1)}
          unit={distanceUnit(units)}
        />
        <Tile
          icon="elevation"
          label="Elevation"
          value={formatElevation(totals.elevation, units)}
          unit={elevationUnit(units)}
        />
      </View>

      <Card>
        <SectionHeader title="Personal bests" />

        <Record
          icon="trending"
          label="Fastest pace"
          value={`${bestPaceLabel} ${paceUnit(units)}`}
          detail="Across all runs of 1 km or more"
        />
        <Divider />
        <Record
          icon="route"
          label="Longest run"
          value={
            longest
              ? `${formatDistance(longest.distanceMeters, units, 2)} ${distanceUnit(units)}`
              : '—'
          }
          detail={longest ? formatRunDate(longest.startedAt) : 'No runs yet'}
          onPress={longest ? () => router.push(`/activity/${longest.id}`) : undefined}
        />
        <Divider />
        <Record
          icon="flame"
          label="Biggest week"
          value={`${formatDistance(biggestWeek, units, 1)} ${distanceUnit(units)}`}
          detail={`Best of the last ${weeks} weeks`}
        />
      </Card>

      {runs.length === 0 && (
        <Card tone="alt">
          <View style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.lg }}>
            <Icon name="chart" size={24} color={colors.textFaint} />
            <Text variant="caption" color="muted" align="center">
              Record a run and your trends will build up here.
            </Text>
          </View>
        </Card>
      )}
    </Screen>
  );
}

function Tile({
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
  const { colors, space } = useTheme();
  return (
    <Card style={{ flex: 1 }}>
      <View style={{ gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name={icon} size={14} color={colors.brand} />
          <Text variant="label" color="faint" uppercase>
            {label}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
          <Text variant="metricLg">{value}</Text>
          {unit && (
            <Text variant="caption" color="muted">
              {unit}
            </Text>
          )}
        </View>
      </View>
    </Card>
  );
}

function Record({
  icon,
  label,
  value,
  detail,
  onPress,
}: {
  icon: IconName;
  label: string;
  value: string;
  detail: string;
  onPress?: () => void;
}) {
  const { colors, space, radius } = useTheme();
  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: space.md,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radius.md,
          backgroundColor: colors.brandWash,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={17} color={colors.brand} />
      </View>

      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{label}</Text>
        <Text variant="caption" color="faint">
          {detail}
        </Text>
      </View>

      <Text variant="bodyStrong" tabular>
        {value}
      </Text>
      {onPress && <Icon name="chevronRight" size={16} color={colors.textFaint} />}
    </View>
  );

  if (!onPress) return body;
  return (
    <Card onPress={onPress} padded={false} tone="surface" style={{ borderWidth: 0, elevation: 0 }}>
      {body}
    </Card>
  );
}

type Bucket = { label: string; start: number; meters: number };

/** Weekly distance buckets, oldest first, Monday-aligned. */
function weeklyBuckets(runs: Run[], weeks: number): Bucket[] {
  const out: Bucket[] = [];
  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(monday);
    start.setDate(monday.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);

    const meters = runs
      .filter((r) => r.startedAt >= start.getTime() && r.startedAt < end.getTime())
      .reduce((sum, r) => sum + r.distanceMeters, 0);

    out.push({ label: `${start.getDate()}/${start.getMonth() + 1}`, start: start.getTime(), meters });
  }
  return out;
}

const SHORT_MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

function monthlyBuckets(runs: Run[], months: number): Bucket[] {
  const out: Bucket[] = [];
  const first = new Date();
  first.setHours(0, 0, 0, 0);
  first.setDate(1);

  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(first);
    start.setMonth(first.getMonth() - i);
    const end = new Date(start);
    end.setMonth(start.getMonth() + 1);

    const meters = runs
      .filter((r) => r.startedAt >= start.getTime() && r.startedAt < end.getTime())
      .reduce((sum, r) => sum + r.distanceMeters, 0);

    out.push({ label: SHORT_MONTHS[start.getMonth()], start: start.getTime(), meters });
  }
  return out;
}

function formatPaceSeconds(secPerUnit: number): string {
  const m = Math.floor(secPerUnit / 60);
  const s = Math.round(secPerUnit % 60);
  if (s === 60) return `${m + 1}:00`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
