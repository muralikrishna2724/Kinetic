import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type PressableProps,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

/** Full-screen background with the correct safe-area padding. */
export function Screen({
  children,
  scroll = false,
  edges = ['top'],
  contentStyle,
  style,
  ...rest
}: ViewProps & {
  scroll?: boolean;
  edges?: ('top' | 'bottom')[];
  contentStyle?: ViewStyle;
}) {
  const { colors, space } = useTheme();
  const insets = useSafeAreaInsets();

  const pad = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
  };

  if (scroll) {
    return (
      <View style={[{ flex: 1, backgroundColor: colors.bg }, style]} {...rest}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            pad,
            // Clear the floating tab bar.
            { paddingBottom: (pad.paddingBottom || 0) + space['5xl'] + 64 },
            contentStyle,
          ]}
        >
          {children}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[{ flex: 1, backgroundColor: colors.bg }, pad, style]} {...rest}>
      {children}
    </View>
  );
}

/** Raised container. Tappable when `onPress` is supplied. */
export function Card({
  children,
  onPress,
  padded = true,
  tone = 'surface',
  style,
  ...rest
}: Omit<PressableProps, 'style'> & {
  children: React.ReactNode;
  padded?: boolean;
  tone?: 'surface' | 'alt' | 'brand';
  style?: ViewStyle;
}) {
  const { colors, radius, space, elevation } = useTheme();

  const bg =
    tone === 'alt' ? colors.surfaceAlt : tone === 'brand' ? colors.brandWash : colors.surface;

  const base: ViewStyle = {
    backgroundColor: bg,
    borderRadius: radius.xl,
    padding: padded ? space.lg : 0,
    ...(tone === 'brand'
      ? { borderWidth: 1, borderColor: colors.brand + '33' }
      : (elevation(1) as ViewStyle)),
  };

  if (!onPress) {
    return <View style={[base, style]}>{children}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [base, pressed && { opacity: 0.72, transform: [{ scale: 0.99 }] }, style]}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

/** Small all-caps label that sits above a value. */
export function Label({ children }: { children: React.ReactNode }) {
  return (
    <Text variant="label" color="faint" uppercase>
      {children}
    </Text>
  );
}

/** Section header with an optional trailing action. */
export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const { space } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: space.md,
      }}
    >
      <Text variant="h3">{title}</Text>
      {action && (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => pressed && { opacity: 0.6 }}
        >
          <Text variant="caption" color="brand">
            {action}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

/** Hairline divider. */
export function Divider({ inset = 0 }: { inset?: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.border,
        marginLeft: inset,
      }}
    />
  );
}
