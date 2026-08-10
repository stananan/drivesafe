/**
 * DriveSafe design tokens.
 *
 * Light green and white: white ground, pale green surfaces, and one confident
 * green for actions. The safety scale (green / amber / red) is deliberately a
 * *different* green from the brand green so "this drive was safe" never reads as
 * ordinary chrome — the brand green is muted and cool, the safety green is
 * brighter and warmer.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0F1F16',
    textSecondary: '#5A6B60',
    background: '#FFFFFF',
    /** Cards and raised surfaces: the palest green that still reads as green. */
    backgroundElement: '#F1F9F3',
    backgroundSelected: '#DFF1E4',
    border: '#CDE6D5',
    tint: '#2E8B57',
    onTint: '#FFFFFF',
    success: '#1F9D55',
    warning: '#B7791F',
    danger: '#C53030',
  },
  dark: {
    text: '#ECF6EF',
    textSecondary: '#9DB3A5',
    background: '#0C1611',
    backgroundElement: '#152420',
    backgroundSelected: '#1E332B',
    border: '#274236',
    tint: '#4FBE80',
    onTint: '#06140C',
    success: '#3FD68A',
    warning: '#E7A94A',
    danger: '#F26D6D',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
export type Theme = (typeof Colors)['light' | 'dark'];

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  small: 10,
  medium: 16,
  large: 24,
  pill: 999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
