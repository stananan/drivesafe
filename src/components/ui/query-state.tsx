import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Renders the loading / error / empty states a query screen needs, and gets out
 * of the way once there is data. Returns null when there is nothing to say.
 */
export function QueryState({
  isLoading,
  error,
  isEmpty,
  emptyMessage,
}: {
  isLoading: boolean;
  error: string | null;
  isEmpty?: boolean;
  emptyMessage?: string;
}) {
  const theme = useTheme();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.tint} />
      </View>
    );
  }

  if (error) {
    return (
      <Card title="Could not load">
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      </Card>
    );
  }

  if (isEmpty) {
    return (
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          {emptyMessage ?? 'Nothing here yet.'}
        </ThemedText>
      </Card>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  center: {
    paddingVertical: Spacing.five,
    alignItems: 'center',
  },
});
