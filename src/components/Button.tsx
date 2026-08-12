import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { ActivityIndicator, Pressable, View, type ViewStyle } from 'react-native';

import { useSettings } from '../store/settings';
import { useTheme } from '../theme/ThemeProvider';
import { brandGradientFlat, MIN_TARGET } from '../theme/tokens';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled,
  loading,
  fullWidth,
  style,
}: Props) {
  const { colors, radius, space } = useTheme();
  const haptics = useSettings((s) => s.hapticsEnabled);

  const height = size === 'lg' ? 56 : MIN_TARGET + 4;
  const inactive = disabled || loading;

  const handlePress = () => {
    if (inactive) return;
    if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };

  const shell: ViewStyle = {
    height,
    minWidth: MIN_TARGET,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: size === 'lg' ? space['2xl'] : space.xl,
    alignSelf: fullWidth ? 'stretch' : 'flex-start',
    opacity: inactive ? 0.45 : 1,
  };

  const fg =
    variant === 'primary'
      ? colors.onBrand
      : variant === 'danger'
        ? colors.danger
        : variant === 'ghost'
          ? colors.textMuted
          : colors.text;

  const content = (
    <>
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        icon && <Icon name={icon} size={18} color={fg} />
      )}
      <Text variant="bodyStrong" color={fg}>
        {label}
      </Text>
    </>
  );

  return (
    <Pressable
      onPress={handlePress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        fullWidth ? { alignSelf: 'stretch' } : { alignSelf: 'flex-start' },
        pressed && !inactive && { transform: [{ scale: 0.97 }], opacity: 0.9 },
        style,
      ]}
    >
      {variant === 'primary' ? (
        <LinearGradient
          colors={[...brandGradientFlat]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={shell}
        >
          {content}
        </LinearGradient>
      ) : (
        <View
          style={[
            shell,
            {
              backgroundColor: variant === 'ghost' ? 'transparent' : colors.surfaceAlt,
              borderWidth: variant === 'danger' ? 1 : 0,
              borderColor: colors.danger + '55',
            },
          ]}
        >
          {content}
        </View>
      )}
    </Pressable>
  );
}
