import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';
import type { Role } from '@/types/drive';

export default function SignUpScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signUp } = useSession();

  const [role, setRole] = useState<Role>('child');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trimmedUsername = username.trim();
  const canSubmit =
    trimmedUsername.length >= 2 && email.trim().length > 0 && password.length >= 6;

  async function handleSubmit() {
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    const { error: signUpError, needsEmailConfirmation } = await signUp({
      email,
      password,
      username: trimmedUsername,
      role,
    });

    setIsSubmitting(false);

    if (signUpError) {
      setError(signUpError);
      return;
    }

    if (needsEmailConfirmation) {
      setNotice(
        `Account created. Check ${email.trim()} for a confirmation link, then come back and sign in.`
      );
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
          { paddingTop: insets.top + Spacing.five, paddingBottom: insets.bottom + Spacing.five },
        ]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <View style={styles.hero}>
            <ThemedText type="subtitle">Create your account</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Parents create a family. Drivers join it with the family code.
            </ThemedText>
          </View>

          <View style={styles.form}>
            <View style={styles.roleGroup}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                I AM A
              </ThemedText>
              <View style={styles.roleRow}>
                <RoleChip
                  label="Driver"
                  selected={role === 'child'}
                  onPress={() => setRole('child')}
                />
                <RoleChip
                  label="Parent"
                  selected={role === 'parent'}
                  onPress={() => setRole('parent')}
                />
              </View>
            </View>

            <Field
              label="USERNAME"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="alex"
              hint="Shown to your family. 2–24 characters."
            />

            <Field
              label="EMAIL"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@example.com"
              textContentType="emailAddress"
            />

            <Field
              label="PASSWORD"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              placeholder="At least 6 characters"
              textContentType="newPassword"
              onSubmitEditing={handleSubmit}
              returnKeyType="go"
            />

            {error ? (
              <ThemedText type="small" style={{ color: theme.danger }}>
                {error}
              </ThemedText>
            ) : null}

            {notice ? (
              <ThemedText type="small" style={{ color: theme.success }}>
                {notice}
              </ThemedText>
            ) : null}

            <Button
              label={isSubmitting ? 'Creating account…' : 'Create account'}
              onPress={handleSubmit}
              disabled={!canSubmit}
              loading={isSubmitting}
            />
          </View>

          <View style={styles.footer}>
            <ThemedText type="small" themeColor="textSecondary">
              Already have an account?
            </ThemedText>
            <Link href="/(auth)/sign-in" replace>
              <ThemedText type="smallBold" style={{ color: theme.tint }}>
                Sign in
              </ThemedText>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function RoleChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? theme.tint : theme.backgroundElement,
          borderColor: selected ? theme.tint : theme.border,
        },
      ]}>
      <ThemedText type="smallBold" style={{ color: selected ? theme.onTint : theme.text }}>
        {label}
      </ThemedText>
    </Pressable>
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
    gap: Spacing.four,
  },
  hero: {
    gap: Spacing.two,
  },
  form: {
    gap: Spacing.three,
  },
  roleGroup: {
    gap: Spacing.one,
  },
  roleRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  chip: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    marginTop: 'auto',
  },
});
