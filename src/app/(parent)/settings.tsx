import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { AboutCard } from '@/components/about-card';
import { DeleteAccountCard } from '@/components/delete-account-card';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { QueryState } from '@/components/ui/query-state';
import { Screen } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { confirmAction, notify } from '@/lib/confirm';
import { listFamilyDrivers } from '@/lib/drives';
import { useSession } from '@/lib/session';
import { useAsync } from '@/lib/use-async';

export default function ParentSettingsScreen() {
  const theme = useTheme();
  const { family, session, signOut, leaveFamily } = useSession();

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

  async function confirmLeave() {
    const ok = await confirmAction({
      title: 'Leave this family?',
      message:
        'You will stop seeing your drivers, their drives, and their clips. Their accounts and the family stay as they are, and you can create or join another afterwards.',
      confirmLabel: 'Leave',
    });

    if (ok) void leaveFamily();
  }

  async function copyCode() {
    if (!family) return;

    await Clipboard.setStringAsync(family.code);
    notify('Copied', `Family code ${family.code} is on your clipboard.`);
  }

  const driverList = drivers.data ?? [];

  return (
    <Screen title="Settings" subtitle="Your family code, drivers, and alerts.">
      <Card title="Family code" meta={family?.name ?? ''}>
        <View
          style={[
            styles.codeBox,
            { borderColor: theme.tint, backgroundColor: theme.backgroundElement },
          ]}>
          <ThemedText numberOfLines={1} style={[styles.code, { color: theme.tint }]}>
            {family?.code ?? '——————'}
          </ThemedText>
        </View>

        <Button label="Copy code" variant="secondary" onPress={() => void copyCode()} />
        <ThemedText type="small" themeColor="textSecondary">
          Share this to add another driver. New parents get the big version on the Live tab until
          someone joins.
        </ThemedText>
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

      <View style={styles.rows}>
        <Button label="Leave family" variant="secondary" onPress={() => void confirmLeave()} />
        <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
      </View>

      <DeleteAccountCard />

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
  // The code gets a row to itself. Sharing one with the Copy button left it
  // competing for width on a narrow phone, and shrinking it to fit only traded
  // a clipped code for an unreadably small one.
  codeBox: {
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
  },
  code: {
    fontSize: 30,
    // Must rise with fontSize: ThemedText's default lineHeight of 24 would clip
    // these glyphs top and bottom.
    lineHeight: 38,
    fontWeight: '700',
    letterSpacing: 6,
    // letterSpacing adds a trailing gap after the last character, which pushes
    // centred text visibly left. Pull it back by the same amount.
    marginLeft: 6,
  },
  footer: {
    textAlign: 'center',
  },
});
