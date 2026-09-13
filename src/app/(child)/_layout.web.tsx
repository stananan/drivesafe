import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';
import { useRouteGuard } from '@/lib/use-route-guard';

/**
 * The driver's side does not run in a browser, and says so.
 *
 * Recording a drive needs the phone's GPS, its microphone and its camera, held
 * in the foreground with the screen awake. A browser can offer a worse version
 * of the first and none of the rest, and a driver who half-starts a drive on a
 * laptop has a drive that records nothing.
 *
 * The parent's side, by contrast, is all maps and lists and video playback,
 * which is exactly what a browser is good at — so the web build exists for them.
 */
export default function ChildWebLayout() {
  const theme = useTheme();
  const { profile, signOut } = useSession();

  const redirect = useRouteGuard('child');
  if (redirect) return <Redirect href={redirect as never} />;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={styles.message}>
        <ThemedText type="subtitle">DriveSafe runs on your phone</ThemedText>

        <ThemedText type="small" themeColor="textSecondary">
          Recording a drive needs your phone&apos;s GPS, microphone and camera, so the driver side
          of DriveSafe lives there rather than in a browser.
          {profile ? ` You're signed in as ${profile.username}.` : ''}
        </ThemedText>

        <ThemedText type="small" themeColor="textSecondary">
          Open DriveSafe on your phone to start a drive. This dashboard is for parents.
        </ThemedText>

        <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  message: {
    maxWidth: MaxContentWidth,
    gap: Spacing.three,
  },
});
