import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
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
  const { profile, createFamily, joinFamily, signOut } = useSession();

  const isParent = profile?.role === 'parent';

  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trimmed = value.trim();
  const canSubmit = isParent ? trimmed.length > 0 : trimmed.length === 6;

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
            <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
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
