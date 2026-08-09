/**
 * DriveSafe design tokens.
 *
 * The palette is intentionally calm: a deep navy ground with a single confident
 * blue for actions, and a green/amber/red scale reserved *only* for safety
 * signals. Nothing decorative is allowed to use the safety colors — if it is
 * green, it means the drive was safe.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0B1220',
    textSecondary: '#5A6478',
    background: '#F6F8FC',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E8EDF7',
    border: '#DDE3EF',
    tint: '#2F6BFF',
    onTint: '#FFFFFF',
    success: '#12A150',
    warning: '#C77700',
    danger: '#D93838',
  },
  dark: {
    text: '#F4F7FC',
    textSecondary: '#9BA5BA',
    background: '#0B1220',
    backgroundElement: '#151D2E',
    backgroundSelected: '#1F2940',
    border: '#243049',
    tint: '#5A8CFF',
    onTint: '#06101F',
    success: '#2BD37A',
    warning: '#F5A524',
    danger: '#FF6B6B',
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
