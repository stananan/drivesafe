import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { RoutePreview } from '@/components/route-preview';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { QueryState } from '@/components/ui/query-state';
import { ScoreBadge, scoreColor } from '@/components/ui/score-badge';
import { Screen } from '@/components/ui/screen';
import { Stat, StatRow } from '@/components/ui/stat';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { listDrives, listFamilyDrivers, milesThisWeek } from '@/lib/drives';
import { formatMiles, formatRelative } from '@/lib/format';
import { useSession } from '@/lib/session';
import { useAsync } from '@/lib/use-async';
import type { LinkedDriver } from '@/types/drive';

export default function ParentLiveScreen() {
  const { family } = useSession();

  const drivers = useAsync(
    () => (family ? listFamilyDrivers(family.id) : Promise.resolve([])),
    [family?.id],
    { enabled: Boolean(family) }
  );
  const drives = useAsync(() => listDrives(), [family?.id]);

  useFocusEffect(
    useCallback(() => {
      void drivers.reload();
      void drives.reload();
      // Reloading on focus is the point; re-running when the callbacks change is not.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const driverList = drivers.data ?? [];
  const driveList = drives.data ?? [];
  const recentDrive = driveList[0];

  return (
    <Screen title="Live" subtitle={`Where ${family?.name ?? 'your family'} is right now.`}>
      <QueryState
        isLoading={drivers.isLoading}
        error={drivers.error}
        isEmpty={!drivers.isLoading && driverList.length === 0}
        emptyMessage={`No drivers have joined yet. Share your family code ${family?.code ?? ''} from the Settings tab.`}
      />

      {driverList.map((driver) => (
        <DriverCard key={driver.id} driver={driver} />
      ))}

      {recentDrive ? (
        <Card title="Most recent drive" meta={formatRelative(recentDrive.startedAt)}>
          <RoutePreview
            route={recentDrive.route}
            caption={`${formatMiles(recentDrive.distanceMeters)} mi recorded`}
          />
          <StatRow>
            <Stat
              label="Safety score"
              value={`${recentDrive.safetyScore}`}
              valueColor={scoreColor(recentDrive.safetyScore)}
            />
            <Stat label="Miles this week" value={milesThisWeek(driveList).toFixed(0)} unit="mi" />
            <Stat label="Events" value={`${recentDrive.events.length}`} />
          </StatRow>
        </Card>
      ) : null}
    </Screen>
  );
}

function DriverCard({ driver }: { driver: LinkedDriver }) {
  const theme = useTheme();
  const isDriving = driver.activeDriveId !== null;

  return (
    <Card>
      <View style={styles.driverRow}>
        <View style={styles.driverInfo}>
          <View style={styles.nameRow}>
            <View
              style={[
                styles.dot,
                { backgroundColor: isDriving ? theme.success : theme.textSecondary },
              ]}
            />
            <ThemedText type="smallBold">{driver.name}</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {isDriving
              ? 'On a drive now'
              : driver.lastSeenAt
                ? `Not driving · last drive ${formatRelative(driver.lastSeenAt)}`
                : 'No drives recorded yet'}
          </ThemedText>
        </View>
        <ScoreBadge score={driver.weekScore} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  driverRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  driverInfo: {
    flex: 1,
    gap: Spacing.half,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
  },
});
