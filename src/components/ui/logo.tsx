import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/**
 * The DS mark, and optionally the name beside it.
 *
 * One component rather than an <Image> at each call site, because the mark is
 * the only thing on screen that has to look identical everywhere it appears —
 * the landing page, the sign-in screen, and the message a driver gets when they
 * open the dashboard on a laptop.
 *
 * The artwork is trimmed to the glyph, so `size` is the height of the mark
 * itself rather than of a square with the mark somewhere inside it. Spacing is
 * the caller's business.
 */
export function Logo({
  size = 28,
  withWordmark = false,
  style,
}: {
  size?: number;
  withWordmark?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const mark = (
    <Image
      source={require('@/assets/images/logo.png')}
      // The source is square with the glyph centred, so a square box at the
      // requested height keeps it from being stretched on either axis.
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessibilityLabel="DriveSafe"
    />
  );

  if (!withWordmark) return <View style={style}>{mark}</View>;

  return (
    <View style={[styles.row, style]}>
      {mark}
      <ThemedText style={[styles.wordmark, { fontSize: size * 0.6, lineHeight: size * 0.78 }]}>
        DriveSafe
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  wordmark: {
    fontWeight: '700',
  },
});
