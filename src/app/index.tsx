import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';

/**
 * The router gate. Everything enters here and gets sent to exactly one place,
 * based on how far through onboarding the account is.
 */
export default function IndexGate() {
  const theme = useTheme();
  const { isLoading, session, profile, configError } = useSession();

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
