import React, { useId } from 'react';
import Svg, {
  Defs,
  G,
  LinearGradient,
  Path,
  Rect,
  RadialGradient,
  Stop,
} from 'react-native-svg';

import { kinetic, lime } from '../theme/tokens';

/*
 * The Kinetic mark, drawn on a 100×100 grid.
 *
 * Anatomy:
 *   · a solid stem bar
 *   · a chevron that is *detached* from the stem — the gap is the whole idea,
 *     it reads as stored energy rather than a static letterform
 *   · three motion trails falling off the back edge
 *
 * The whole letter is skewed -7° so it leans into the direction of travel, then
 * translated back by 8 to keep the skewed bounds inside the viewBox.
 */

const STEM = { x: 22, y: 13, w: 15, h: 74, r: 4 };
// Vertex sits at x=49.5: the miter reaches back to ~39, leaving a 2pt counter
// against the stem's right edge at 37. Any wider and the letter fragments into
// "I<" once it's down at tab-bar size.
const CHEVRON = 'M 80 18 L 49.5 50 L 82 82';
const CHEVRON_WEIGHT = 15;
const LEAN = 'translate(8, 0) skewX(-7)';

/** Trailing dashes off the back of the stem. */
const TRAILS = [
  { x: 6, y: 25.5, w: 10, o: 0.3 },
  { x: 1, y: 47.5, w: 15, o: 0.55 },
  { x: 7, y: 69.5, w: 9, o: 0.3 },
];

export type LogoVariant =
  /** Just the letterform, transparent behind it. */
  | 'mark'
  /** Letterform inside a dark rounded-square tile — app-icon shape. */
  | 'badge';

type Props = {
  size?: number;
  variant?: LogoVariant;
  /**
   * Render flat in this colour instead of the brand gradient. Used for tab bar
   * icons and anywhere the mark sits inside a coloured surface.
   */
  monochrome?: string;
  /** Radial bloom behind the letterform. Ignored for monochrome. */
  glow?: boolean;
};

export function KineticLogo({
  size = 48,
  variant = 'mark',
  monochrome,
  glow = variant === 'badge',
}: Props) {
  // useId keeps gradient ids unique — duplicated ids across mounted SVGs make
  // every instance resolve to whichever one rendered last.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const gradId = `kGrad${uid}`;
  const glowId = `kGlow${uid}`;
  const tileId = `kTile${uid}`;

  const fill = monochrome ?? `url(#${gradId})`;
  const showGlow = glow && !monochrome;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Defs>
        {/* Deep green in the heel, lime at the leading tip. */}
        <LinearGradient id={gradId} x1="0.12" y1="1" x2="0.92" y2="0">
          <Stop offset="0" stopColor={kinetic[600]} />
          <Stop offset="0.45" stopColor="#17E48F" />
          <Stop offset="1" stopColor={lime} />
        </LinearGradient>

        <RadialGradient id={glowId} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor={kinetic[400]} stopOpacity="0.42" />
          <Stop offset="0.6" stopColor={kinetic[400]} stopOpacity="0.1" />
          <Stop offset="1" stopColor={kinetic[400]} stopOpacity="0" />
        </RadialGradient>

        <LinearGradient id={tileId} x1="0" y1="0" x2="0.6" y2="1">
          <Stop offset="0" stopColor="#16221E" />
          <Stop offset="1" stopColor="#080D0B" />
        </LinearGradient>
      </Defs>

      {variant === 'badge' && (
        <Rect x="0" y="0" width="100" height="100" rx="24" fill={`url(#${tileId})`} />
      )}

      {showGlow && <Rect x="2" y="2" width="96" height="96" rx="48" fill={`url(#${glowId})`} />}

      <G transform={LEAN}>
        {TRAILS.map((t) => (
          <Rect
            key={t.y}
            x={t.x}
            y={t.y}
            width={t.w}
            height={5}
            rx={2.5}
            fill={fill}
            opacity={t.o}
          />
        ))}

        <Rect x={STEM.x} y={STEM.y} width={STEM.w} height={STEM.h} rx={STEM.r} fill={fill} />

        <Path
          d={CHEVRON}
          stroke={fill}
          strokeWidth={CHEVRON_WEIGHT}
          strokeLinejoin="miter"
          strokeLinecap="butt"
          fill="none"
        />
      </G>
    </Svg>
  );
}
