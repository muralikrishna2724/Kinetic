import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, View } from 'react-native';

import { useSettings } from '../store/settings';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { colors, radius, space } = useTheme();
  const haptics = useSettings((s) => s.hapticsEnabled);

  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        backgroundColor: colors.surfaceAlt,
        borderRadius: radius.pill,
        padding: 4,
        gap: 4,
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="tab"
            // The Text child isn't picked up as the accessible name on every
            // platform, so name the control explicitly.
            accessibilityLabel={opt.label}
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (active) return;
              if (haptics) Haptics.selectionAsync().catch(() => {});
              onChange(opt.value);
            }}
            style={({ pressed }) => [
              {
                flex: 1,
                minHeight: 36,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.pill,
                paddingHorizontal: space.md,
                backgroundColor: active ? colors.surface : 'transparent',
              },
              pressed && !active && { opacity: 0.6 },
            ]}
          >
            <Text variant="caption" color={active ? 'default' : 'muted'}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
