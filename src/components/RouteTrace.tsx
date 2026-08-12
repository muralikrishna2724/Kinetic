import React, { useMemo } from 'react';
import { View, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { projectToCanvas, toPath, type GeoPoint } from '../lib/geo';
import { useTheme } from '../theme/ThemeProvider';
import { brandGradientFlat } from '../theme/tokens';
import { Icon } from './Icon';
import { Text } from './Text';

/**
 * The route, drawn as a vector trace rather than on a tiled map.
 *
 * A map tile layer is noisy at card size and needs network + API keys; the bare
 * trace shows the shape of the run, works offline, and is the same graphic in
 * both themes. The live tracking screen layers this over the real map.
 */
export function RouteTrace({
  points,
  width,
  height,
  strokeWidth = 3.5,
  showMarkers = true,
  padding = 18,
  color,
  style,
}: {
  points: GeoPoint[];
  width: number;
  height: number;
  strokeWidth?: number;
  showMarkers?: boolean;
  padding?: number;
  /** Flat colour override; defaults to the brand gradient. */
  color?: string;
  style?: ViewStyle;
}) {
  const { colors, radius } = useTheme();
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, '');

  const projected = useMemo(
    () => projectToCanvas(points, width, height, padding),
    [points, width, height, padding],
  );
  const d = useMemo(() => toPath(projected), [projected]);

  if (projected.length < 2) {
    return (
      <View
        style={[
          {
            width,
            height,
            borderRadius: radius.lg,
            backgroundColor: colors.surfaceAlt,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          },
          style,
        ]}
      >
        <Icon name="route" size={20} color={colors.textFaint} />
        <Text variant="caption" color="faint">
          No route recorded
        </Text>
      </View>
    );
  }

  const start = projected[0];
  const end = projected[projected.length - 1];
  const stroke = color ?? `url(#route${uid})`;

  return (
    <View style={[{ width, height }, style]}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={`route${uid}`} x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor={brandGradientFlat[1]} />
            <Stop offset="1" stopColor={brandGradientFlat[0]} />
          </LinearGradient>
        </Defs>

        {/* Soft under-stroke so the line stays legible over a map or a photo. */}
        <Path
          d={d}
          stroke={colors.brand}
          strokeOpacity={0.18}
          strokeWidth={strokeWidth * 2.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Path
          d={d}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {showMarkers && (
          <>
            <Circle
              cx={start.x}
              cy={start.y}
              r={strokeWidth * 1.5}
              fill={colors.surface}
              stroke={colors.brand}
              strokeWidth={strokeWidth * 0.8}
            />
            <Circle cx={end.x} cy={end.y} r={strokeWidth * 1.6} fill={colors.brand} />
          </>
        )}
      </Svg>
    </View>
  );
}
