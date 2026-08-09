import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Maps a 0–100 safety score onto the app's three safety colors. */
export function scoreColor(score: number): ThemeColor {
  if (score >= 90) return 'success';
  if (score >= 75) return 'warning';
  return 'danger';
}

export function scoreLabel(score: number): string {
  if (score >= 90) return 'Safe';
  if (score >= 75) return 'Watch';
  return 'Risky';
}

export function ScoreBadge({ score, showLabel = true }: { score: number; showLabel?: boolean }) {
  const theme = useTheme();
  const color = theme[scoreColor(score)];

  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <ThemedText type="smallBold" style={{ color }}>
        {score}
      </ThemedText>
      {showLabel ? (
        <ThemedText type="small" style={{ color }}>
          {scoreLabel(score)}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
});
