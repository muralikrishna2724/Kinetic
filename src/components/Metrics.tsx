import React from 'react';
import { View, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { useTheme } from '../theme/ThemeProvider';
import { brandGradientFlat } from '../theme/tokens';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

/**
 * Label-over-value stat block. The unit is typeset smaller and baseline-aligned
 * with the number so the eye lands on the magnitude first.
 */
export function StatTile({
  label,
  value,
  unit,
  icon,
  size = 'md',
  align = 'flex-start',
  style,
}: {
  label: string;
  value: string;
  unit?: string;
  icon?: IconName;
  size?: 'sm' | 'md' | 'lg';
  align?: ViewStyle['alignItems'];
  style?: ViewStyle;
}) {
  const { colors, space } = useTheme();
  const variant = size === 'lg' ? 'metricLg' : size === 'sm' ? 'metricMd' : 'metricLg';

  return (
    <View style={[{ alignItems: align, gap: space.xs }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        {icon && <Icon name={icon} size={12} color={colors.textFaint} />}
        <Text variant="label" color="faint" uppercase>
          {label}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
        <Text variant={variant}>{value}</Text>
        {unit && (
          <Text variant="caption" color="muted">
            {unit}
          </Text>
        )}
      </View>
    </View>
  );
}

/**
 * Circular goal indicator. Drawn with a rotated stroke-dash arc so it renders
 * identically on both platforms without a native chart dependency.
 */
export function ProgressRing({
  progress,
  size = 132,
  thickness = 11,
  children,
}: {
  /** 0–1. Values above 1 are clamped; the ring is a goal, not a gauge. */
  progress: number;
  size?: number;
  thickness?: number;
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const clamped = Math.max(0, Math.min(1, progress));

  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id={`ring${uid}`} x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor={brandGradientFlat[1]} />
            <Stop offset="1" stopColor={brandGradientFlat[0]} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.surfaceAlt}
          strokeWidth={thickness}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#ring${uid})`}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${c * clamped} ${c}`}
          fill="none"
          // Start the arc at 12 o'clock rather than 3 o'clock.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ alignItems: 'center' }}>{children}</View>
    </View>
  );
}

/**
 * Weekly distance bars. Days with no run keep a stub bar so the week still
 * reads as seven columns instead of collapsing into gaps.
 */
export function BarChart({
  data,
  height = 116,
  highlightLast = true,
}: {
  data: { label: string; value: number }[];
  height?: number;
  highlightLast?: boolean;
}) {
  const { colors, radius, space } = useTheme();
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, height }}>
      {data.map((d, i) => {
        const isLast = highlightLast && i === data.length - 1;
        const filled = d.value > 0;
        const barHeight = filled ? Math.max(6, (d.value / max) * (height - 26)) : 4;

        return (
          <View key={`${d.label}-${i}`} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
            <View
              accessibilityLabel={`${d.label}: ${d.value.toFixed(1)}`}
              style={{
                width: '100%',
                height: barHeight,
                borderRadius: radius.sm,
                backgroundColor: !filled
                  ? colors.surfaceAlt
                  : isLast
                    ? colors.brand
                    : colors.brandMuted,
              }}
            />
            <Text variant="label" color={isLast ? 'brand' : 'faint'} uppercase>
              {d.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** Horizontal split bar — length encodes relative pace across the run. */
export function SplitBar({
  fraction,
  fastest,
}: {
  /** 0–1 relative to the fastest split. */
  fraction: number;
  fastest: boolean;
}) {
  const { colors, radius } = useTheme();
  return (
    <View
      style={{
        height: 8,
        flex: 1,
        borderRadius: radius.sm,
        backgroundColor: colors.surfaceAlt,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          height: '100%',
          width: `${Math.max(6, Math.min(100, fraction * 100))}%`,
          borderRadius: radius.sm,
          backgroundColor: fastest ? colors.brand : colors.brandMuted,
        }}
      />
    </View>
  );
}
