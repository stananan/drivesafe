import { ScrollView, StyleSheet, View, type ViewProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing, WebHeaderInset } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ScreenProps = ViewProps & {
  title: string;
  subtitle?: string;
  /** Set false for screens that manage their own layout, like the live drive view. */
  scroll?: boolean;
};

/**
 * The browser's version of the standard screen chrome.
 *
 * The phone version reserves space at the *bottom* for the tab bar and leans on
 * the safe-area inset for the top. In a browser both are wrong: there is no
 * notch, so the inset is zero, and the tab bar renders as a floating pill at the
 * top. The result was a page title jammed against the window edge with the tabs
 * sitting on top of its subtitle.
 *
 * So the padding moves to the other end, and the title gets room to be a title.
 */
export function Screen({ title, subtitle, scroll = true, children, style, ...rest }: ScreenProps) {
  const theme = useTheme();

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
      <View style={[styles.root, styles.staticRoot, { backgroundColor: theme.background }]}>
        {body}
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scrollContent}>
      {body}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  staticRoot: {
    paddingTop: WebHeaderInset,
    alignItems: 'center',
  },
  scrollContent: {
    alignItems: 'center',
    paddingTop: WebHeaderInset,
    // No tab bar down here to clear — just enough that the last card is not
    // flush against the bottom of the window.
    paddingBottom: Spacing.six,
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
    // The title is the top of the page here, so it gets space beneath it rather
    // than fighting the tab bar above it.
    paddingBottom: Spacing.one,
  },
});
