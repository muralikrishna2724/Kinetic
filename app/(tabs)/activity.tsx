import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { ActivityCard } from '@/components/ActivityCard';
import { Icon } from '@/components/Icon';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Card, Label, Screen } from '@/components/Surface';
import { Text } from '@/components/Text';
import {
  distanceUnit,
  formatDistance,
  formatDurationShort,
  MONTHS,
} from '@/lib/format';
import { totalsFor, useRuns, type Run } from '@/store/runs';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme/ThemeProvider';

type Range = 'all' | 'month' | 'week';

const RANGES: { value: Range; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'all', label: 'All time' },
];

export default function ActivityScreen() {
  const { colors, space } = useTheme();
  const router = useRouter();
  const runs = useRuns((s) => s.runs);
  const units = useSettings((s) => s.units);
  const [range, setRange] = useState<Range>('all');

  const since = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (range === 'week') {
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      return d.getTime();
    }
    if (range === 'month') {
      d.setDate(1);
      return d.getTime();
    }
    return undefined;
  }, [range]);

  const filtered = useMemo(
    () => (since == null ? runs : runs.filter((r) => r.startedAt >= since)),
    [runs, since],
  );
  const totals = useMemo(() => totalsFor(filtered), [filtered]);
  const groups = useMemo(() => groupByMonth(filtered), [filtered]);

  return (
    <Screen scroll contentStyle={{ paddingHorizontal: space.lg, gap: space.lg }}>
      <View style={{ paddingTop: space.lg, gap: space.lg }}>
        <Text variant="h1">Activity</Text>
        <SegmentedControl options={RANGES} value={range} onChange={setRange} />
      </View>

      <Card tone="alt">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Summary label="Distance" value={formatDistance(totals.meters, units, 1)} unit={distanceUnit(units)} />
          <Summary label="Runs" value={String(totals.runs)} />
          <Summary label="Time" value={formatDurationShort(totals.seconds)} />
        </View>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <View style={{ alignItems: 'center', gap: space.sm, paddingVertical: space['2xl'] }}>
            <Icon name="route" size={28} color={colors.textFaint} />
            <Text variant="bodyStrong">Nothing here yet</Text>
            <Text variant="caption" color="muted" align="center">
              {range === 'all'
                ? 'Your recorded runs will appear here.'
                : 'No runs in this period. Try a wider range.'}
            </Text>
          </View>
        </Card>
      ) : (
        groups.map((group) => (
          <View key={group.key} style={{ gap: space.md }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}
            >
              <Text variant="h3">{group.title}</Text>
              <Text variant="caption" color="faint">
                {formatDistance(group.meters, units, 1)} {distanceUnit(units)} · {group.runs.length}{' '}
                {group.runs.length === 1 ? 'run' : 'runs'}
              </Text>
            </View>

            {group.runs.map((run) => (
              <ActivityCard
                key={run.id}
                run={run}
                onPress={() => router.push(`/activity/${run.id}`)}
              />
            ))}
          </View>
        ))
      )}
    </Screen>
  );
}

function Summary({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={{ gap: 2 }}>
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

type Group = { key: string; title: string; runs: Run[]; meters: number };

function groupByMonth(runs: Run[]): Group[] {
  const byKey = new Map<string, Group>();

  for (const run of runs) {
    const d = new Date(run.startedAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const thisYear = d.getFullYear() === new Date().getFullYear();

    let group = byKey.get(key);
    if (!group) {
      group = {
        key,
        title: thisYear ? monthName(d) : `${monthName(d)} ${d.getFullYear()}`,
        runs: [],
        meters: 0,
      };
      byKey.set(key, group);
    }
    group.runs.push(run);
    group.meters += run.distanceMeters;
  }

  return [...byKey.values()];
}

const FULL_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function monthName(d: Date) {
  return FULL_MONTHS[d.getMonth()] ?? MONTHS[d.getMonth()];
}
