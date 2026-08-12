import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
// expo-router 57 vendors its own navigator and deprecates the root `Tabs`
// export; `expo-router/js-tabs` is the supported path for a JS-rendered tab bar.
import { Tabs } from 'expo-router/js-tabs';
import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { Text } from '@/components/Text';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme/ThemeProvider';
import { brandGradientFlat, MIN_TARGET } from '@/theme/tokens';

const TABS: { name: string; label: string; icon: IconName }[] = [
  { name: 'index', label: 'Home', icon: 'home' },
  { name: 'activity', label: 'Activity', icon: 'pulse' },
  { name: 'stats', label: 'Stats', icon: 'chart' },
  { name: 'profile', label: 'Profile', icon: 'user' },
];

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      tabBar={(props) => <KineticTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.label }} />
      ))}
    </Tabs>
  );
}

/**
 * Floating tab bar with the run action raised into the middle.
 *
 * The run button is not a tab — it pushes the tracking screen as a modal so the
 * tab bar can't be reached mid-run, which is the behaviour you want when a
 * stray thumb would otherwise abandon a recording.
 */
/** Derived from the navigator itself so it tracks expo-router's own types. */
type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

function KineticTabBar({ state, navigation }: TabBarProps) {
  const { colors, radius, space, elevation } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const haptics = useSettings((s) => s.hapticsEnabled);

  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);

  const renderTab = (tab: (typeof TABS)[number]) => {
    const index = state.routes.findIndex((r) => r.name === tab.name);
    const focused = state.index === index;

    return (
      <Pressable
        key={tab.name}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={tab.label}
        onPress={() => {
          if (haptics) Haptics.selectionAsync().catch(() => {});
          const event = navigation.emit({
            type: 'tabPress',
            target: state.routes[index].key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) navigation.navigate(tab.name);
        }}
        style={{
          flex: 1,
          minHeight: MIN_TARGET,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        <Icon name={tab.icon} size={21} color={focused ? colors.brand : colors.textFaint} />
        <Text variant="label" color={focused ? 'brand' : 'faint'}>
          {tab.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: space.lg,
        right: space.lg,
        bottom: Math.max(insets.bottom, space.md),
      }}
    >
      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderRadius: radius['2xl'],
            paddingVertical: space.sm,
            paddingHorizontal: space.xs,
            borderWidth: 1,
            borderColor: colors.border,
          },
          elevation(3),
        ]}
      >
        {left.map(renderTab)}

        {/* Spacer the raised button sits over. */}
        <View style={{ width: 74 }} />

        {right.map(renderTab)}
      </View>

      <View
        pointerEvents="box-none"
        style={{ position: 'absolute', left: 0, right: 0, top: -20, alignItems: 'center' }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start a run"
          onPress={() => {
            if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            router.push('/run');
          }}
          style={({ pressed }) => [pressed && { transform: [{ scale: 0.94 }] }]}
        >
          <LinearGradient
            colors={[...brandGradientFlat]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              {
                width: 62,
                height: 62,
                borderRadius: 31,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 4,
                borderColor: colors.bg,
              },
              elevation(2),
            ]}
          >
            <Text variant="label" color={colors.onBrand}>
              RUN
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}
