import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The page a stranger lands on.
 *
 * Short on purpose. The first version of this had a dark hero, display type at
 * 68px, drawn mock-ups of four screens and six sections of prose — which is
 * both longer than anyone reads and, more to the point, exactly what a
 * generated landing page looks like. Length and polish were doing the work that
 * plain information should.
 *
 * So: the app's own colours rather than a separate palette invented for one
 * page, ordinary type sizes, short lines, and nothing pictured that does not
 * exist. Someone should be able to read the whole thing in under a minute and
 * know whether it is for them.
 */
export function LandingPage() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}>
      <View style={styles.page}>
        <View style={styles.header}>
          <ThemedText style={styles.wordmark}>DriveSafe</ThemedText>
          <Pressable onPress={() => router.push('/(auth)/sign-in' as never)}>
            <ThemedText type="small" style={{ color: theme.tint }}>
              Sign in
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.intro}>
          <ThemedText style={styles.title}>
            A dashcam and safety score for new drivers.
          </ThemedText>

          <ThemedText type="small" themeColor="textSecondary" style={styles.lede}>
            A teenager records their drive on their phone. Their parent sees the route, the speed
            and anything worth talking about — here, or on their own phone. Built for the
            Congressional App Challenge in California&apos;s 2nd district.
          </ThemedText>

          <View style={styles.actions}>
            <Button
              label="Create a parent account"
              onPress={() => router.push('/(auth)/sign-up' as never)}
              style={styles.action}
            />
            <Button
              label="Sign in"
              variant="secondary"
              onPress={() => router.push('/(auth)/sign-in' as never)}
              style={styles.action}
            />
          </View>

          <ThemedText type="small" themeColor="textSecondary">
            Drivers use the phone app. This dashboard is for parents.
          </ThemedText>
        </View>

        <Section title="What it does">
          <Line>Records the route, speed and distance of every drive.</Line>
          <Line>
            Scores the drive against the real speed limit of each road, from OpenStreetMap.
          </Line>
          <Line>Lets a parent watch a drive while it is happening.</Line>
          <Line>
            Keeps the last twenty seconds of dashcam footage, saved when the driver asks or when
            the car gets loud.
          </Line>
        </Section>

        <Section title="What it does not do">
          <Line>Record conversations. The microphone measures loudness, nothing else.</Line>
          <Line>Track anyone who is not currently driving.</Line>
          <Line>Show a drive to anybody outside your own family.</Line>
          <Line>Sell data, show ads, or run analytics.</Line>
        </Section>

        <Section title="Who made it">
          <Line>Stanley Ho — the app, the scoring and the backend.</Line>
          <Line>Nico Zametto — product and road testing.</Line>
        </Section>

        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <ThemedText type="small" themeColor="textSecondary">
            Congressional App Challenge 2026 · California District 2
          </ThemedText>
          <Pressable onPress={() => router.push('/privacy' as never)}>
            <ThemedText type="small" style={{ color: theme.tint }}>
              Privacy
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">{title}</ThemedText>
      <View style={styles.lines}>{children}</View>
    </View>
  );
}

function Line({ children }: { children: React.ReactNode }) {
  const theme = useTheme();

  return (
    <View style={styles.line}>
      <View style={[styles.bullet, { backgroundColor: theme.tint }]} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.lineText}>
        {children}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.three,
  },
  // A reading width. The content is text, so it does not want the window.
  page: {
    width: '100%',
    maxWidth: 560,
    gap: Spacing.five,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wordmark: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  intro: {
    gap: Spacing.three,
  },
  title: {
    // Large enough to be the first thing read, not so large it is a poster.
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  lede: {
    lineHeight: 23,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  action: {
    flexGrow: 1,
    flexBasis: 200,
  },
  section: {
    gap: Spacing.two,
  },
  lines: {
    gap: Spacing.two,
  },
  line: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  bullet: {
    width: 4,
    height: 4,
    borderRadius: Radius.pill,
    marginTop: 9,
  },
  lineText: {
    flex: 1,
    lineHeight: 22,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three,
  },
});
