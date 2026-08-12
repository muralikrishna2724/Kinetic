import React from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import type { TypeToken } from '../theme/tokens';

type ColorToken = 'default' | 'muted' | 'faint' | 'brand' | 'onBrand' | 'danger';

type Props = RNTextProps & {
  variant?: TypeToken;
  color?: ColorToken | string;
  /**
   * Lock digit widths. Essential for anything that updates live — proportional
   * digits make the timer jitter sideways every tick.
   */
  tabular?: boolean;
  uppercase?: boolean;
  align?: TextStyle['textAlign'];
};

export function Text({
  variant = 'body',
  color = 'default',
  tabular,
  uppercase,
  align,
  style,
  children,
  ...rest
}: Props) {
  const { colors, type } = useTheme();
  const t = type[variant];

  const resolved =
    color === 'default'
      ? colors.text
      : color === 'muted'
        ? colors.textMuted
        : color === 'faint'
          ? colors.textFaint
          : color === 'brand'
            ? colors.brand
            : color === 'onBrand'
              ? colors.onBrand
              : color === 'danger'
                ? colors.danger
                : color;

  // Metric variants are always tabular — there's no case where you want the
  // hero number dancing.
  const isMetric = variant.startsWith('metric');
  const useTabular = tabular ?? isMetric;

  return (
    <RNText
      {...rest}
      allowFontScaling
      style={[
        {
          color: resolved,
          fontSize: t.size,
          lineHeight: t.lineHeight,
          fontWeight: t.weight,
          letterSpacing: t.tracking,
          textAlign: align,
          ...(useTabular ? { fontVariant: ['tabular-nums' as const] } : null),
          ...(uppercase ? { textTransform: 'uppercase' as const } : null),
        },
        style,
      ]}
    >
      {children}
    </RNText>
  );
}
