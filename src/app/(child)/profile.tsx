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
  const { profile, family, session, signOut, leaveFamily, setPreference } = useSession();
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

  async function togglePreference(
    key: 'audioAlertsEnabled' | 'dashcamEnabled' | 'locationSharing',
    next: boolean
  ) {
    const { error } = await setPreference(key, next);
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

      <Card title="Audio distraction alerts">
        <View style={styles.toggleRow}>
          <ThemedText type="small" style={styles.toggleLabel}>
            Listen for a loud cabin
          </ThemedText>
          <Switch
            value={profile?.audioAlertsEnabled ?? false}
            onValueChange={(next) => void togglePreference('audioAlertsEnabled', next)}
            trackColor={{ true: theme.tint, false: theme.border }}
          />
        </View>

        <ThemedText type="small" themeColor="textSecondary">
          While you are driving, DriveSafe measures how loud it is using the microphone. If it stays
          loud you get a warning on screen and your family is told. Nothing is recorded, saved, or
          uploaded — only the loudness reading ever leaves your phone.
        </ThemedText>
      </Card>

      <Card title="Dashcam">
        <View style={styles.toggleRow}>
          <ThemedText type="small" style={styles.toggleLabel}>
            Record while I drive
          </ThemedText>
          <Switch
            value={profile?.dashcamEnabled ?? false}
            onValueChange={(next) => void togglePreference('dashcamEnabled', next)}
            trackColor={{ true: theme.tint, false: theme.border }}
          />
        </View>

        <ThemedText type="small" themeColor="textSecondary">
          The camera records on a loop and keeps only the last minute — everything older is deleted
          on your phone without ever being sent anywhere. Tap Save that during a drive, or let
          DriveSafe keep a clip automatically when it gets loud.
        </ThemedText>

        <ThemedText type="small" themeColor="textSecondary">
          Video only. The microphone is used to measure loudness and nothing else, so clips have no
          sound.
        </ThemedText>
      </Card>

      <Card title="Location sharing">
        <View style={styles.toggleRow}>
          <ThemedText type="small" style={styles.toggleLabel}>
            Share my location
          </ThemedText>
          <Switch
            value={profile?.locationSharing ?? false}
            onValueChange={(next) => void togglePreference('locationSharing', next)}
            trackColor={{ true: theme.tint, false: theme.border }}
          />
        </View>

        <ThemedText type="small" themeColor="textSecondary">
          Puts you on the family map and lets a parent follow a drive you are on. Only your most
          recent position is kept — DriveSafe never builds a history of where you have been outside
          the drives you record.
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
