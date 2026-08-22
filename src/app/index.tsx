import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';

/**
 * The router gate. Everything enters here and gets sent to exactly one place,
 * based on how far through onboarding the account is.
 */
export default function IndexGate() {
  const theme = useTheme();
  const { isLoading, session, profile, configError, profileError, signOut } = useSession();

  if (configError) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <View style={styles.message}>
          <ThemedText type="smallBold">Supabase is not configured</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {configError}
          </ThemedText>
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.tint} />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/sign-in" />;

  // Signed in and the profile could not be read. An account whose row is simply
  // gone signs itself out in the session provider, so reaching here means the
  // read failed rather than came back empty — most often a database that has
  // not run the current schema.sql. Waiting will not fix that, and a spinner
  // with no way out is the worst possible way to say so.
  if (!profile && profileError) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <View style={styles.message}>
          <ThemedText type="smallBold">Could not load your account</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {profileError}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            If this project&apos;s database was changed recently, re-run
            supabase/schema.sql. Signing out will get you back to the start.
          </ThemedText>
          <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
        </View>
      </View>
    );
  }

  // Signed in, but the profile row has not arrived yet. The auth trigger creates
  // it, so this is a brief network state rather than a broken account.
  if (!profile) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.tint} />
      </View>
    );
  }

  if (!profile.familyId) return <Redirect href="/family-setup" />;

  return <Redirect href={profile.role === 'parent' ? '/(parent)' : '/(child)'} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  message: {
    maxWidth: MaxContentWidth,
    gap: Spacing.two,
  },
});
