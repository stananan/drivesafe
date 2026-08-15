import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, View } from 'react-native';

import { AboutCard } from '@/components/about-card';
import { DeleteAccountCard } from '@/components/delete-account-card';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';

export default function ChildProfileScreen() {
  const theme = useTheme();
  const { profile, family, session, signOut, leaveFamily, setListenIn } = useSession();
  const [permission, setPermission] = useState<Location.PermissionStatus | null>(null);

  useEffect(() => {
    let cancelled = false;

    Location.getForegroundPermissionsAsync()
      .then(({ status }) => {
        if (!cancelled) setPermission(status);
      })
      .catch(() => {
        if (!cancelled) setPermission(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const granted = permission === Location.PermissionStatus.GRANTED;

  async function toggleListenIn(next: boolean) {
    const { error } = await setListenIn(next);
    if (error) Alert.alert('Could not save that', error);
  }

  function confirmLeave() {
    Alert.alert(
      'Leave this family?',
      'Your drives stay saved, but your family will stop seeing new ones until you rejoin.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => void leaveFamily() },
      ]
    );
  }

  return (
    <Screen title="Profile" subtitle="Your account and what DriveSafe is allowed to do.">
      <Card title="Driver">
        <View style={styles.rows}>
          <Row label="Username" value={profile?.username ?? '—'} />
          <Row label="Email" value={session?.user.email ?? '—'} />
          <Row label="Family" value={family?.name ?? 'Not in a family'} />
          <Row
            label="Location access"
            value={granted ? 'Granted' : permission === null ? 'Unknown' : 'Not granted'}
            valueColor={granted ? theme.success : theme.warning}
          />
        </View>
      </Card>

      <Card title="Let a parent listen in">
        <View style={styles.toggleRow}>
          <ThemedText type="small" style={styles.toggleLabel}>
            {profile?.listenInEnabled ? 'Your parent can listen' : 'Your parent cannot listen'}
          </ThemedText>
          <Switch
            value={profile?.listenInEnabled ?? false}
            onValueChange={(next) => void toggleListenIn(next)}
            trackColor={{ true: theme.tint, false: theme.border }}
          />
        </View>

        <ThemedText type="small" themeColor="textSecondary">
          Off unless you turn it on, and only you can change it. When it is on, a parent in your
          family can open the audio in your car while you are on a drive. Anyone riding with you can
          be heard too, so only switch this on if they would be fine with that.
        </ThemedText>

        <ThemedText type="small" themeColor="textSecondary">
          Not built yet — this saves your answer so nothing can start listening before you have
          said yes. You will see a clear indicator on this screen whenever the microphone is open.
        </ThemedText>
      </Card>

      <Card title="Your data">
        <ThemedText type="small" themeColor="textSecondary">
          Drives are recorded on this phone and shared only with your family. Audio distraction
          alerts measure how loud the car is — DriveSafe never records or uploads what it hears.
        </ThemedText>
      </Card>

      <AboutCard />

      <View style={styles.actions}>
        <Button label="Leave family" variant="secondary" onPress={confirmLeave} />
        <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
      </View>

      <DeleteAccountCard />
    </Screen>
  );
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="small" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  rows: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  actions: {
    gap: Spacing.two,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    minHeight: 32,
  },
  toggleLabel: {
    flexShrink: 1,
  },
});
