import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AboutCard } from '@/components/about-card';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DEMO_DRIVER_NAME } from '@/lib/demo-data';
import { useSession } from '@/lib/session';

export default function TeenProfileScreen() {
  const theme = useTheme();
  const { signOut } = useSession();
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

  function confirmSwitch() {
    Alert.alert('Switch role?', 'You will go back to the welcome screen and pick a role again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Switch', style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  return (
    <Screen title="Profile" subtitle="Your account and what DriveSafe is allowed to do.">
      <Card title="Driver">
        <View style={styles.rows}>
          <Row label="Name" value={DEMO_DRIVER_NAME} />
          <Row label="Linked parent" value="Not linked yet" />
          <Row
            label="Location access"
            value={granted ? 'Granted' : permission === null ? 'Unknown' : 'Not granted'}
            valueColor={granted ? theme.success : theme.warning}
          />
        </View>
      </Card>

      <Card title="Your data">
        <ThemedText type="small" themeColor="textSecondary">
          Drives are recorded on this phone and shared only with the parent account you link. Audio
          distraction detection will run on-device — DriveSafe never uploads what it hears.
        </ThemedText>
      </Card>

      <AboutCard />

      <Button label="Switch role" variant="secondary" onPress={confirmSwitch} />
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
});
