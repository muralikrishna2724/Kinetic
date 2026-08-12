import React from 'react';
import { View } from 'react-native';

import {
  distanceUnit,
  formatDistance,
  formatDurationShort,
  formatPace,
  formatRunDate,
  paceUnit,
} from '../lib/format';
import type { Run } from '../store/runs';
import { useSettings } from '../store/settings';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';
import { RouteTrace } from './RouteTrace';
import { Card } from './Surface';
import { Text } from './Text';

const THUMB = 74;

export function ActivityCard({ run, onPress }: { run: Run; onPress: () => void }) {
  const { colors, space, radius } = useTheme();
  const units = useSettings((s) => s.units);

  return (
    <Card onPress={onPress} accessibilityLabel={`${run.title}, ${formatRunDate(run.startedAt)}`}>
      <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center' }}>
        <View
          style={{
            width: THUMB,
            height: THUMB,
            borderRadius: radius.lg,
            backgroundColor: colors.surfaceAlt,
            overflow: 'hidden',
          }}
        >
          <RouteTrace
            points={run.points}
            width={THUMB}
            height={THUMB}
            strokeWidth={2.5}
            padding={12}
            showMarkers={false}
          />
        </View>

        <View style={{ flex: 1, gap: space.sm }}>
          <View>
            <Text variant="h3" numberOfLines={1}>
              {run.title}
            </Text>
            <Text variant="caption" color="faint">
              {formatRunDate(run.startedAt)}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: space.lg }}>
            <Inline
              value={formatDistance(run.distanceMeters, units, 2)}
              unit={distanceUnit(units)}
            />
            <Inline
              value={formatPace(run.distanceMeters, run.durationSec, units)}
              unit={paceUnit(units)}
            />
            <Inline value={formatDurationShort(run.durationSec)} />
          </View>
        </View>

        <Icon name="chevronRight" size={18} color={colors.textFaint} />
      </View>
    </Card>
  );
}

function Inline({ value, unit }: { value: string; unit?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
      <Text variant="bodyStrong" tabular>
        {value}
      </Text>
      {unit && (
        <Text variant="label" color="faint">
          {unit}
        </Text>
      )}
    </View>
  );
}
