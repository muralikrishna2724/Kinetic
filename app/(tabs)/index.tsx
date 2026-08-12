import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { View } from 'react-native';

import { ActivityCard } from '@/components/ActivityCard';
import { Icon, type IconName } from '@/components/Icon';
import { KineticLogo } from '@/components/KineticLogo';
import { BarChart, ProgressRing } from '@/components/Metrics';
import { Card, Label, Screen, SectionHeader } from '@/components/Surface';
import { Text } from '@/components/Text';
import {
  distanceUnit,
  formatDistance,
  formatDurationShort,
  greeting,
  paceUnit,
  unitMeters,
} from '@/lib/format';
import {
  bestPaceSecPerKm,
  currentStreak,
  dailyDistance,
  startOfWeek,
  totalsFor,
  useRuns,
} from '@/store/runs';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme/ThemeProvider';

export default function HomeScreen() {
  const { colors, space } = useTheme();
  const router = useRouter();

  const runs = useRuns((s) => s.runs);
  const units = useSettings((s) => s.units);
  const goalMeters = useSettings((s) => s.weeklyGoalMeters);
  const name = useSettings((s) => s.displayName);

  const week = useMemo(() => totalsFor(runs, startOfWeek().getTime()), [runs]);
  const streak = useMemo(() => currentStreak(runs), [runs]);
  const bestPace = useMemo(() => bestPaceSecPerKm(runs), [runs]);
  const recent = useMemo(() => runs.slice(0, 3), [runs]);

  const daily = useMemo(() => dailyDistance(runs, 7), [runs]);
  const chart = useMemo(
    () =>
      daily.map((d) => ({
        label: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.date.getDay()],
        value: d.meters / unitMeters(units),
      })),
    [daily, units],
  );

  const progress = goalMeters > 0 ? week.meters / goalMeters : 0;
  const remaining = Math.max(0, goalMeters - week.meters);

  // Pace is stored per km; convert once for display in imperial.
  const bestPaceLabel = bestPace
    ? formatPaceSeconds(units === 'metric' ? bestPace : bestPace * 1.609344)
    : '—';

  return (
    <Screen scroll contentStyle={{ paddingHorizontal: space.lg, gap: space.xl }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: space.lg,
        }}
      >
        <View>
          <Text variant="caption" color="muted">
            {greeting()}
          </Text>
          <Text variant="h1">{name}</Text>
        </View>
        <KineticLogo size={38} />
      </View>

      {/* Weekly goal */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xl }}>
          <ProgressRing progress={progress}>
            <Text variant="metricMd">{Math.round(Math.min(progress, 1) * 100)}</Text>
            <Text variant="label" color="faint">
              PERCENT
            </Text>
          </ProgressRing>

          <View style={{ flex: 1, gap: space.md }}>
            <View>
              <Label>This week</Label>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                <Text variant="metricLg">{formatDistance(week.meters, units, 1)}</Text>
                <Text variant="caption" color="muted">
                  / {formatDistance(goalMeters, units, 0)} {distanceUnit(units)}
                </Text>
              </View>
            </View>

            <Text variant="caption" color="muted">
              {remaining > 0
                ? `${formatDistance(remaining, units, 1)} ${distanceUnit(units)} to go`
                : 'Goal smashed. Nice work.'}
            </Text>

            <View style={{ flexDirection: 'row', gap: space.lg }}>
              <MiniStat label="Runs" value={String(week.runs)} />
              <MiniStat label="Time" value={formatDurationShort(week.seconds)} />
            </View>
          </View>
        </View>
      </Card>

      {/* Last 7 days */}
      <Card>
        <SectionHeader title="Last 7 days" />
        <BarChart data={chart} />
      </Card>

      {/* Highlights */}
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Highlight
          icon="flame"
          label="Streak"
          value={String(streak)}
          unit={streak === 1 ? 'day' : 'days'}
        />
        <Highlight icon="trending" label="Best pace" value={bestPaceLabel} unit={paceUnit(units)} />
      </View>

      {/* Recent */}
      <View style={{ gap: space.md }}>
        <SectionHeader
          title="Recent activity"
          action={runs.length > 3 ? 'See all' : undefined}
          onAction={() => router.push('/activity')}
        />

        {recent.length === 0 ? (
          <Card tone="alt">
            <View style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.lg }}>
              <Icon name="route" size={26} color={colors.textFaint} />
              <Text variant="bodyStrong">No runs yet</Text>
              <Text variant="caption" color="muted" align="center">
                Tap RUN to record your first one.
              </Text>
            </View>
          </Card>
        ) : (
          recent.map((run) => (
            <ActivityCard
              key={run.id}
              run={run}
              onPress={() => router.push(`/activity/${run.id}`)}
            />
          ))
        )}
      </View>
    </Screen>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Label>{label}</Label>
      <Text variant="bodyStrong" tabular>
        {value}
      </Text>
    </View>
  );
}

function Highlight({
  icon,
  label,
  value,
  unit,
}: {
  icon: IconName;
  label: string;
  value: string;
  unit: string;
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
          <Text variant="caption" color="muted">
            {unit}
          </Text>
        </View>
      </View>
    </Card>
  );
}

function formatPaceSeconds(secPerUnit: number): string {
  const m = Math.floor(secPerUnit / 60);
  const s = Math.round(secPerUnit % 60);
  if (s === 60) return `${m + 1}:00`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
