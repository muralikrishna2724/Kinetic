import React from 'react';
import Svg, { Circle, Path, Polyline, Rect } from 'react-native-svg';

import { useTheme } from '../theme/ThemeProvider';

/**
 * House icon set. 24×24 grid, 2px stroke, round caps and joins throughout so it
 * sits with the rounded terminals on the Kinetic mark.
 *
 * Deliberately hand-rolled rather than pulled from an icon package — it keeps
 * the stroke weight consistent at the sizes this app actually uses (18–28).
 */

export type IconName =
  | 'home'
  | 'pulse'
  | 'chart'
  | 'user'
  | 'play'
  | 'pause'
  | 'stop'
  | 'lock'
  | 'chevronRight'
  | 'chevronLeft'
  | 'close'
  | 'pin'
  | 'clock'
  | 'flame'
  | 'trending'
  | 'target'
  | 'route'
  | 'heart'
  | 'moon'
  | 'sun'
  | 'device'
  | 'settings'
  | 'share'
  | 'trash'
  | 'bell'
  | 'check'
  | 'elevation'
  | 'shoe'
  | 'calendar';

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  /** Fill the glyph instead of stroking it — used for the run button. */
  filled?: boolean;
};

export function Icon({ name, size = 22, color, filled = false }: Props) {
  const { colors } = useTheme();
  const stroke = color ?? colors.text;
  // Keep the optical weight steady as the icon scales.
  const sw = (2 / 24) * 24 * (22 / size) > 2.6 ? 2.2 : 2;

  const common = {
    stroke: filled ? 'none' : stroke,
    strokeWidth: sw,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: filled ? stroke : 'none',
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {glyph(name, common, stroke, filled)}
    </Svg>
  );
}

function glyph(name: IconName, p: object, stroke: string, filled: boolean) {
  switch (name) {
    case 'home':
      return (
        <>
          <Path d="M3 10.5 12 3l9 7.5" {...p} />
          <Path d="M5.5 9.5V20a1 1 0 0 0 1 1H10v-5.5h4V21h3.5a1 1 0 0 0 1-1V9.5" {...p} />
        </>
      );
    case 'pulse':
      return <Path d="M2 12.5h4.2L9 5.5l4 13 2.8-6h4.2" {...p} />;
    case 'chart':
      return (
        <>
          <Path d="M4 20V11" {...p} />
          <Path d="M10 20V4" {...p} />
          <Path d="M16 20v-6" {...p} />
          <Path d="M22 20H2" {...p} />
        </>
      );
    case 'user':
      return (
        <>
          <Circle cx="12" cy="8" r="4" {...p} />
          <Path d="M4.5 21a7.5 7.5 0 0 1 15 0" {...p} />
        </>
      );
    case 'play':
      return <Path d="M8 5.2 19 12 8 18.8z" {...p} fill={filled ? stroke : 'none'} />;
    case 'pause':
      return (
        <>
          <Rect x="7" y="5" width="3.6" height="14" rx="1.4" {...p} />
          <Rect x="13.4" y="5" width="3.6" height="14" rx="1.4" {...p} />
        </>
      );
    case 'stop':
      return <Rect x="6" y="6" width="12" height="12" rx="2.5" {...p} />;
    case 'lock':
      return (
        <>
          <Rect x="4.5" y="10" width="15" height="10.5" rx="3" {...p} />
          <Path d="M8.2 10V7.5a3.8 3.8 0 0 1 7.6 0V10" {...p} />
        </>
      );
    case 'chevronRight':
      return <Path d="m9 5 7 7-7 7" {...p} />;
    case 'chevronLeft':
      return <Path d="m15 5-7 7 7 7" {...p} />;
    case 'close':
      return (
        <>
          <Path d="m6 6 12 12" {...p} />
          <Path d="m18 6-12 12" {...p} />
        </>
      );
    case 'pin':
      return (
        <>
          <Path d="M12 21.5s7-6.1 7-11.3A7 7 0 0 0 5 10.2c0 5.2 7 11.3 7 11.3Z" {...p} />
          <Circle cx="12" cy="10" r="2.6" {...p} />
        </>
      );
    case 'clock':
      return (
        <>
          <Circle cx="12" cy="12" r="9" {...p} />
          <Path d="M12 7v5.4l3.4 2" {...p} />
        </>
      );
    case 'flame':
      return (
        <Path
          d="M12 22c3.9 0 6.5-2.6 6.5-6.2 0-4.6-4.6-6.4-3.6-11.8-2.6.9-4.6 3.4-4.6 6 0 1.3-.8 1.9-1.6 1.2-.7-.6-1-1.6-1-2.6C6 10.5 5.5 12.6 5.5 15c0 4 2.9 7 6.5 7Z"
          {...p}
        />
      );
    case 'trending':
      return (
        <>
          <Polyline points="3,17 9.5,10.5 13.5,14.5 21,7" {...p} />
          <Polyline points="15,7 21,7 21,13" {...p} />
        </>
      );
    case 'target':
      return (
        <>
          <Circle cx="12" cy="12" r="9" {...p} />
          <Circle cx="12" cy="12" r="4.6" {...p} />
          <Circle cx="12" cy="12" r="0.9" fill={stroke} stroke="none" />
        </>
      );
    case 'route':
      return (
        <>
          <Path d="M6.5 20c0-4 11-3 11-7.5S9 8.5 9 4.6" {...p} />
          <Circle cx="6.5" cy="20.5" r="2.2" {...p} />
          <Circle cx="9" cy="3.5" r="2.2" {...p} />
        </>
      );
    case 'heart':
      return (
        <Path
          d="M12 20.5S3.5 15.4 3.5 9.6A4.6 4.6 0 0 1 12 7.1a4.6 4.6 0 0 1 8.5 2.5c0 5.8-8.5 10.9-8.5 10.9Z"
          {...p}
        />
      );
    case 'moon':
      return <Path d="M20 14.2A8.6 8.6 0 0 1 9.8 4 8.7 8.7 0 1 0 20 14.2Z" {...p} />;
    case 'sun':
      return (
        <>
          <Circle cx="12" cy="12" r="4.2" {...p} />
          <Path d="M12 2v2.2M12 19.8V22M2 12h2.2M19.8 12H22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M19.1 4.9l-1.6 1.6M6.5 17.5l-1.6 1.6" {...p} />
        </>
      );
    case 'device':
      return (
        <>
          <Rect x="6" y="2.5" width="12" height="19" rx="3" {...p} />
          <Path d="M10.5 5.8h3" {...p} />
        </>
      );
    case 'settings':
      return (
        <>
          <Circle cx="12" cy="12" r="3.2" {...p} />
          <Path
            d="M19.4 14.6a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.56V21a2 2 0 0 1-4 0v-.11a1.7 1.7 0 0 0-1.1-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1H3a2 2 0 0 1 0-4h.11a1.7 1.7 0 0 0 1.56-1.1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.56V3a2 2 0 0 1 4 0v.11a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.56 1H21a2 2 0 0 1 0 4h-.11a1.7 1.7 0 0 0-1.56 1Z"
            {...p}
          />
        </>
      );
    case 'share':
      return (
        <>
          <Path d="M12 15.5V3.5" {...p} />
          <Path d="m8 7 4-3.5L16 7" {...p} />
          <Path d="M5 12.5V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6.5" {...p} />
        </>
      );
    case 'trash':
      return (
        <>
          <Path d="M4 6.5h16" {...p} />
          <Path d="M9.5 6.5V4.8A1.3 1.3 0 0 1 10.8 3.5h2.4a1.3 1.3 0 0 1 1.3 1.3V6.5" {...p} />
          <Path d="M6.5 6.5 7.4 20a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-13.5" {...p} />
        </>
      );
    case 'bell':
      return (
        <>
          <Path d="M18 9a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16S18 14 18 9Z" {...p} />
          <Path d="M13.7 19a2 2 0 0 1-3.4 0" {...p} />
        </>
      );
    case 'check':
      return <Path d="m4.5 12.5 5 5 10-11" {...p} />;
    case 'elevation':
      return (
        <>
          <Path d="M2 19h20" {...p} />
          <Path d="m3.5 19 5.5-9 3.2 4.4L16.5 7l4 12" {...p} />
        </>
      );
    case 'shoe':
      return (
        <>
          <Path d="M2.5 17.5v-6l4-1 2.5 2.5 3-1 2 2h5a2.5 2.5 0 0 1 2.5 2.5v1a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1Z" {...p} />
          <Path d="M6.5 11.5 8 8" {...p} />
        </>
      );
    case 'calendar':
      return (
        <>
          <Rect x="3.5" y="5" width="17" height="16" rx="3" {...p} />
          <Path d="M3.5 10h17M8.5 3v4M15.5 3v4" {...p} />
        </>
      );
    default:
      return null;
  }
}
