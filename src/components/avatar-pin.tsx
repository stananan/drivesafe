import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A map pin that shows who it is: a circular avatar sitting above a small
 * pointer, so the person's initial reads at a glance without tapping.
 *
 * Profile pictures are not stored yet, so this falls back to the first letter
 * of the username. When avatars land, drop an <Image> into the same circle and
 * everything around it stays put.
 */
export function AvatarPin({
  label,
  isDriving = false,
  isSelected = false,
}: {
  label: string;
  /** Driving pins get the live colour so a moving car stands out. */
  isDriving?: boolean;
  isSelected?: boolean;
}) {
  const theme = useTheme();
  const initial = label.trim().charAt(0).toUpperCase() || '?';
  const accent = isDriving ? theme.success : theme.tint;

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: accent,
            borderColor: theme.background,
            transform: [{ scale: isSelected ? 1.15 : 1 }],
          },
        ]}>
        <ThemedText style={[styles.initial, { color: theme.onTint }]}>{initial}</ThemedText>
      </View>

      {/* Tail, so the bubble points at the exact coordinate rather than
          hovering ambiguously over it. */}
      <View style={[styles.tail, { borderTopColor: accent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
  },
  bubble: {
    width: 42,
    height: 42,
    borderRadius: Radius.pill,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  initial: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  tail: {
    width: 0,
    height: 0,
    marginTop: -2,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
