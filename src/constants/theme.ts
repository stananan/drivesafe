/**
 * DriveSafe design tokens.
 *
 * Green on green: a pale green ground, slightly deeper green surfaces, and one
 * confident green for actions. The ground used to be plain white; tinting it
 * meant nudging every neutral in the ladder — surfaces, selection, borders — a
 * step deeper, because a card that used to sit on white no longer reads as
 * raised when the page behind it is the same colour the card was.
 *
 * The safety scale (green / amber / red) is deliberately a *different* green
 * from the brand green so "this drive was safe" never reads as ordinary chrome —
 * the brand green is muted and cool, the safety green is brighter and warmer.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0F1F16',
    textSecondary: '#5A6B60',
    /** The page itself: green enough to notice, pale enough to read on. */
    background: '#EAF6EE',
    /** Cards and raised surfaces: a step deeper than the ground beneath them. */
    backgroundElement: '#DEF0E4',
    /** Inputs. White stopped being the page colour, so it now means "type here". */
    backgroundInput: '#FFFFFF',
    backgroundSelected: '#CDE8D6',
    border: '#B8DCC4',
    tint: '#2E8B57',
    onTint: '#FFFFFF',
    success: '#1F9D55',
    warning: '#B7791F',
    danger: '#C53030',
  },
  dark: {
    text: '#ECF6EF',
    textSecondary: '#9DB3A5',
    /** A shade lighter than it was, to match the light theme going greener. */
    background: '#12211A',
    backgroundElement: '#1A2C23',
    backgroundInput: '#0C1611',
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

/**
 * Height to keep clear at the top of a web screen.
 *
 * On phones the tab bar sits at the bottom and the safe-area inset handles the
 * top. In a browser both of those are wrong: there is no notch, so the inset is
 * zero, and the tab bar renders as a floating pill at the *top* — so a screen
 * that reserves space at the bottom leaves its title colliding with the tabs.
 * Everything on a web screen starts below this.
 */
export const WebHeaderInset = 84;

/** Comfortable reading width for a form. Full width is not it. */
export const FormWidth = 420;

/**
 * For screens whose content is pictures rather than prose. Video needs width
 * more than a paragraph does, and the reading width makes a postage stamp of it.
 */
export const WideContentWidth = 1080;
export const MaxContentWidth = 800;
