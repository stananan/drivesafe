import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Switch, View } from 'react-native';

import { AboutCard } from '@/components/about-card';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { QueryState } from '@/components/ui/query-state';
import { Screen } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { listFamilyDrivers } from '@/lib/drives';
import { useSession } from '@/lib/session';
import { useAsync } from '@/lib/use-async';

export default function ParentSettingsScreen() {
  const theme = useTheme();
  const { family, session, signOut } = useSession();

  const drivers = useAsync(
    () => (family ? listFamilyDrivers(family.id) : Promise.resolve([])),
    [family?.id],
    { enabled: Boolean(family) }
  );

  useFocusEffect(
    useCallback(() => {
      void drivers.reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  // Local-only for now; these move to the parent's profile row with push.
  const [alertOnSpeeding, setAlertOnSpeeding] = useState(true);
  const [alertOnHardBrake, setAlertOnHardBrake] = useState(true);
  const [alertOnDriveEnd, setAlertOnDriveEnd] = useState(false);

  async function copyCode() {
    if (!family) return;

    await Clipboard.setStringAsync(family.code);
    Alert.alert('Copied', `Family code ${family.code} is on your clipboard.`);
  }

  const driverList = drivers.data ?? [];

  return (
    <Screen title="Settings" subtitle="Your family code, drivers, and alerts.">
      <Card title="Family code" meta={family?.name ?? ''}>
        <ThemedText type="small" themeColor="textSecondary">
          Share this with your driver. They enter it when they create their account.
        </ThemedText>

        <View style={[styles.codeBox, { borderColor: theme.tint }]}>
          <ThemedText style={[styles.code, { color: theme.tint }]}>
            {family?.code ?? '——————'}
          </ThemedText>
        </View>

        <Button label="Copy code" variant="secondary" onPress={() => void copyCode()} />
      </Card>

      <Card title="Drivers" meta={`${driverList.length} joined`}>
        <QueryState
          isLoading={drivers.isLoading}
          error={drivers.error}
          isEmpty={!drivers.isLoading && driverList.length === 0}
          emptyMessage="Nobody has joined yet. Share the code above."
        />

        <View style={styles.rows}>
          {driverList.map((driver) => (
            <View key={driver.id} style={styles.row}>
              <ThemedText type="small">{driver.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Score {driver.weekScore}
              </ThemedText>
            </View>
          ))}
        </View>
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

      <Card title="Account">
        <View style={styles.rows}>
          <View style={styles.row}>
            <ThemedText type="small" themeColor="textSecondary">
              Signed in as
            </ThemedText>
            <ThemedText type="small">{session?.user.email ?? '—'}</ThemedText>
          </View>
        </View>
      </Card>

      <AboutCard />

      <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />

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
  codeBox: {
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  code: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 8,
  },
  footer: {
    textAlign: 'center',
  },
});
