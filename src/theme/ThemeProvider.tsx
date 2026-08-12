import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { useSettings } from '../store/settings';
import {
  darkPalette,
  lightPalette,
  motion,
  radius,
  space,
  type as typeScale,
  type Palette,
} from './tokens';

type Theme = {
  scheme: 'light' | 'dark';
  isDark: boolean;
  colors: Palette;
  space: typeof space;
  radius: typeof radius;
  type: typeof typeScale;
  motion: typeof motion;
  /**
   * Card elevation. Dark mode gets a hairline instead of a shadow — shadows are
   * close to invisible on a near-black background and just cost a render pass.
   */
  elevation: (level: 1 | 2 | 3) => object;
};

const ThemeContext = createContext<Theme | null>(null);

const shadowByLevel = {
  1: { radius: 8, opacity: 0.06, y: 2 },
  2: { radius: 18, opacity: 0.1, y: 6 },
  3: { radius: 30, opacity: 0.14, y: 12 },
} as const;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const themeMode = useSettings((s) => s.themeMode);

  const scheme: 'light' | 'dark' =
    themeMode === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : themeMode;

  const value = useMemo<Theme>(() => {
    const isDark = scheme === 'dark';
    const colors = isDark ? darkPalette : lightPalette;

    return {
      scheme,
      isDark,
      colors,
      space,
      radius,
      type: typeScale,
      motion,
      elevation: (level) => {
        if (isDark) {
          return { borderWidth: 1, borderColor: colors.border };
        }
        const s = shadowByLevel[level];
        return {
          shadowColor: colors.shadow,
          shadowOpacity: s.opacity,
          shadowRadius: s.radius,
          shadowOffset: { width: 0, height: s.y },
          elevation: level * 2,
        };
      },
    };
  }, [scheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
