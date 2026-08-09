import { ScrollView, StyleSheet, View, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ScreenProps = ViewProps & {
  title: string;
  subtitle?: string;
  /** Set false for screens that manage their own layout, like the live drive view. */
  scroll?: boolean;
};

/**
 * Standard screen chrome: safe-area padding, a large title, and a scroll body
 * that clears the tab bar. Every tab uses this so the two interfaces feel like
 * one app.
 */
export function Screen({ title, subtitle, scroll = true, children, style, ...rest }: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const header = (
    <View style={styles.header}>
      <ThemedText type="subtitle">{title}</ThemedText>
      {subtitle ? (
        <ThemedText type="small" themeColor="textSecondary">
          {subtitle}
        </ThemedText>
      ) : null}
    </View>
  );

  const body = (
    <View style={[styles.body, style]} {...rest}>
      {header}
      {children}
    </View>
  );

  if (!scroll) {
    return (
      <View
        style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
        {body}
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.background }]}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: insets.top + Spacing.two, paddingBottom: BottomTabInset + Spacing.five },
      ]}
      showsVerticalScrollIndicator={false}>
      {body}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
  },
  body: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
    flexGrow: 1,
  },
  header: {
    gap: Spacing.one,
    paddingTop: Spacing.two,
  },
});
