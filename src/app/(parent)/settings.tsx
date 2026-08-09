import { useState } from 'react';
import { Alert, StyleSheet, Switch, View } from 'react-native';

import { AboutCard } from '@/components/about-card';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { listLinkedDrivers } from '@/lib/demo-data';
import { useSession } from '@/lib/session';

export default function ParentSettingsScreen() {
  const { signOut } = useSession();
  const drivers = listLinkedDrivers();

  // Local-only for now; these move to the parent's Supabase profile row.
  const [alertOnSpeeding, setAlertOnSpeeding] = useState(true);
  const [alertOnHardBrake, setAlertOnHardBrake] = useState(true);
  const [alertOnDriveEnd, setAlertOnDriveEnd] = useState(false);

  function confirmSwitch() {
    Alert.alert('Switch role?', 'You will go back to the welcome screen and pick a role again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Switch', style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  return (
    <Screen title="Settings" subtitle="Linked drivers and what you get told about.">
      <Card title="Linked drivers" meta={`${drivers.length} linked`}>
        <View style={styles.rows}>
          {drivers.map((driver) => (
            <View key={driver.id} style={styles.row}>
              <ThemedText type="small">{driver.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Week score {driver.weekScore}
              </ThemedText>
            </View>
          ))}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          Invite codes land with Supabase auth — for now the demo driver is linked automatically.
        </ThemedText>
      </Card>

      <Card title="Alerts">
        <View style={styles.rows}>
          <ToggleRow label="Speeding" value={alertOnSpeeding} onChange={setAlertOnSpeeding} />
          <ToggleRow label="Hard braking" value={alertOnHardBrake} onChange={setAlertOnHardBrake} />
          <ToggleRow
            label="Every completed drive"
            value={alertOnDriveEnd}
            onChange={setAlertOnDriveEnd}
          />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          Push delivery is not wired up yet — these preferences are saved on this device.
        </ThemedText>
      </Card>

      <AboutCard />

      <Button label="Switch role" variant="secondary" onPress={confirmSwitch} />

      <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
        DriveSafe shows a parent where their driver is and how the drive went. It is not a
        substitute for talking to them about it.
      </ThemedText>
    </Screen>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <ThemedText type="small">{label}</ThemedText>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: theme.tint, false: theme.border }}
      />
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
    minHeight: 32,
    gap: Spacing.two,
  },
  footer: {
    textAlign: 'center',
  },
});
