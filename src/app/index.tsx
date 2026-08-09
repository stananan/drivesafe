import { Redirect } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';
import type { Role } from '@/types/drive';

/**
 * The role gate. Whoever opens DriveSafe lands here exactly once; after that the
 * saved role sends them straight into their own interface.
 */
export default function WelcomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // The root layout holds the splash until the role has loaded, so by the time
  // this renders the role is known.
  const { role, setRole } = useSession();

  if (role === 'parent') return <Redirect href="/(parent)" />;
  if (role === 'teen') return <Redirect href="/(teen)" />;

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: theme.background, paddingTop: insets.top + Spacing.five },
      ]}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <ThemedText type="title">DriveSafe</ThemedText>
          <ThemedText themeColor="textSecondary">
            Teen drivers and their parents, on the same page about every trip.
          </ThemedText>
        </View>

        <View style={styles.choices}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            WHO IS USING THIS PHONE?
          </ThemedText>

          <RoleCard
            role="teen"
            title="I'm the driver"
            body="Record your drives, watch your speed, and build a safety score you own."
            onSelect={setRole}
          />
          <RoleCard
            role="parent"
            title="I'm a parent"
            body="See where your driver is right now and review every trip they finish."
            onSelect={setRole}
          />
        </View>

        <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
          You can switch roles anytime from Settings.
        </ThemedText>
      </View>
    </View>
  );
}

function RoleCard({
  role,
  title,
  body,
  onSelect,
}: {
  role: Role;
  title: string;
  body: string;
  onSelect: (role: Role) => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onSelect(role)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: pressed ? theme.tint : theme.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}>
      <ThemedText type="smallBold" style={{ color: theme.tint }}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {body}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.five,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.two,
  },
  choices: {
    gap: Spacing.two,
  },
  card: {
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  footer: {
    textAlign: 'center',
  },
});
