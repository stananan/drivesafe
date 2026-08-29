import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';

/**
 * The step between signing up and using the app.
 *
 * A parent names a family and gets a code back; a child types that code in.
 * Both paths end with `profile.family_id` set, which is what the index gate
 * waits for.
 */
export default function FamilySetupScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isLoading, session, profile, createFamily, joinFamily, signOut, deleteAccount } =
    useSession();

  const isParent = profile?.role === 'parent';

  // An account that has never been in a family has nothing behind it: no drives,
  // no clips, nothing anyone else can see. Leaving here means abandoning a
  // half-finished sign-up, so it goes rather than lingering as a row nobody can
  // reach. An account that has *left* a family is a different thing entirely and
  // only signs out.
  const isAbandonedSignup = Boolean(profile) && !profile!.everJoinedFamily;

  function confirmLeave() {
    if (!isAbandonedSignup) {
      void signOut();
      return;
    }

    Alert.alert(
      'Leave without a family?',
      'Your account is not finished — it has no family and nothing in it. Leaving now deletes it, and you can sign up again whenever you like.',
      [
        { text: 'Keep setting up', style: 'cancel' },
        {
          text: 'Delete and leave',
          style: 'destructive',
          onPress: () => {
            void deleteAccount().then(({ error: deleteError }) => {
              // If the account could not be removed, at least do not strand them
              // on a screen they cannot leave.
              if (deleteError) void signOut();
            });
          },
        },
      ]
    );
  }

  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trimmed = value.trim();
  const canSubmit = isParent ? trimmed.length > 0 : trimmed.length === 6;

  // This screen had no guard, so signing out from it cleared the session and
  // then sat there over nothing — which is what "sign out does not work" looks
  // like from the outside.
  if (!isLoading && !session) return <Redirect href={'/(auth)/sign-in' as never} />;

  async function handleSubmit() {
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    const result = isParent ? await createFamily(trimmed) : await joinFamily(trimmed);

    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    router.replace('/');
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + Spacing.six, paddingBottom: insets.bottom + Spacing.five },
        ]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <View style={styles.hero}>
            <ThemedText type="subtitle">
              {isParent ? 'Create your family' : 'Join your family'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {isParent
                ? 'You will get a six-character code to share with your driver.'
                : 'Ask your parent for the six-character family code.'}
            </ThemedText>
          </View>

          <View style={styles.form}>
            {isParent ? (
              <Field
                label="FAMILY NAME"
                value={value}
                onChangeText={setValue}
                placeholder="The Ho Family"
                autoCapitalize="words"
                error={error}
                onSubmitEditing={handleSubmit}
                returnKeyType="go"
              />
            ) : (
              <Field
                label="FAMILY CODE"
                value={value}
                onChangeText={(next) => setValue(next.toUpperCase())}
                placeholder="ABC123"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={6}
                style={styles.codeInput}
                error={error}
                hint="Six characters, letters and numbers."
                onSubmitEditing={handleSubmit}
                returnKeyType="go"
              />
            )}

            <Button
              label={
                isSubmitting
                  ? isParent
                    ? 'Creating…'
                    : 'Joining…'
                  : isParent
                    ? 'Create family'
                    : 'Join family'
              }
              onPress={handleSubmit}
              disabled={!canSubmit}
              loading={isSubmitting}
            />
          </View>

          <View style={styles.footer}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.footerText}>
              Signed in as {profile?.username ?? 'your account'}.
            </ThemedText>
            <Button
              label={isAbandonedSignup ? 'Cancel and delete account' : 'Sign out'}
              variant="secondary"
              onPress={confirmLeave}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    flex: 1,
    gap: Spacing.five,
  },
  hero: {
    gap: Spacing.two,
  },
  form: {
    gap: Spacing.three,
  },
  codeInput: {
    fontSize: 28,
    // Same trap as the code displays elsewhere: a large fontSize needs its own
    // lineHeight or the glyphs are clipped by the inherited 24.
    lineHeight: 36,
    letterSpacing: 8,
    textAlign: 'center',
    minHeight: 64,
  },
  footer: {
    marginTop: 'auto',
    gap: Spacing.two,
  },
  footerText: {
    textAlign: 'center',
  },
});
