import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing, type ThemeColor } from '@/constants/theme';

type StatProps = {
  label: string;
  value: string;
  /** Rendered immediately after the value at a smaller size, e.g. `mph`. */
  unit?: string;
  valueColor?: ThemeColor;
};

/** A single labelled number. Use inside `<StatRow>` for the standard grid. */
export function Stat({ label, value, unit, valueColor }: StatProps) {
  return (
    <View style={styles.stat}>
      <View style={styles.valueRow}>
        <ThemedText style={styles.value} themeColor={valueColor}>
          {value}
        </ThemedText>
        {unit ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.unit}>
            {unit}
          </ThemedText>
        ) : null}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

export function StatRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  stat: {
    flex: 1,
    gap: Spacing.half,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.one,
  },
  value: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
  },
  unit: {
    fontWeight: '600',
  },
});
