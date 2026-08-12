import type { Units } from '../store/settings';

const M_PER_MILE = 1609.344;
const M_PER_FOOT = 0.3048;

/** Metres per display unit (km or mile). */
export function unitMeters(units: Units) {
  return units === 'metric' ? 1000 : M_PER_MILE;
}

export function distanceUnit(units: Units) {
  return units === 'metric' ? 'km' : 'mi';
}

export function paceUnit(units: Units) {
  return units === 'metric' ? '/km' : '/mi';
}

export function elevationUnit(units: Units) {
  return units === 'metric' ? 'm' : 'ft';
}

/**
 * Distance as a display string. Returns the number alone — pair it with
 * `distanceUnit()` so the unit can be typeset smaller than the value.
 */
export function formatDistance(meters: number, units: Units, decimals = 2): string {
  const v = meters / unitMeters(units);
  return v.toFixed(decimals);
}

export function formatElevation(meters: number, units: Units): string {
  const v = units === 'metric' ? meters : meters / M_PER_FOOT;
  return Math.round(v).toString();
}

/** `mm:ss`, promoting to `h:mm:ss` past an hour. */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Compact form for list rows: `1h 04m` / `42m 10s`. */
export function formatDurationShort(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  return `${m}m ${(s % 60).toString().padStart(2, '0')}s`;
}

/**
 * Pace in min:sec per display unit. Returns an em-dash below walking speed so a
 * stopped GPS doesn't render an absurd number like `312:45`.
 */
export function formatPace(meters: number, seconds: number, units: Units): string {
  if (meters < 10 || seconds <= 0) return '—:—';
  const secPerUnit = seconds / (meters / unitMeters(units));
  if (!Number.isFinite(secPerUnit) || secPerUnit > 40 * 60) return '—:—';
  const m = Math.floor(secPerUnit / 60);
  const s = Math.round(secPerUnit % 60);
  // Rounding 59.6 up must roll the minute, not print ":60".
  if (s === 60) return `${m + 1}:00`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Speed in km/h or mph. */
export function formatSpeed(metersPerSecond: number, units: Units): string {
  const perHour = (metersPerSecond * 3600) / unitMeters(units);
  return perHour.toFixed(1);
}

/**
 * Rough energy burn. Uses the standard MET-by-pace approximation — good enough
 * to be motivating, not good enough to be nutrition advice.
 */
export function estimateCalories(meters: number, seconds: number, weightKg = 70): number {
  if (seconds <= 0 || meters <= 0) return 0;
  const kmh = (meters / 1000 / seconds) * 3600;
  // ACSM running MET curve, clamped to the range where it stays sane.
  const met = Math.min(20, Math.max(3, 1.0 + kmh * 0.95));
  return Math.round((met * 3.5 * weightKg * (seconds / 60)) / 200);
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `Today · 07:14`, `Yesterday · 18:30`, else `Tue 4 Mar · 06:50`. */
export function formatRunDate(timestamp: number): string {
  const d = new Date(timestamp);
  const now = new Date();
  const time = `${d.getHours().toString().padStart(2, '0')}:${d
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (sameDay(d, now)) return `Today · ${time}`;
  if (sameDay(d, yesterday)) return `Yesterday · ${time}`;
  return `${DAYS[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()]} · ${time}`;
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export { DAYS, MONTHS };
