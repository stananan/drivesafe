import { StyleSheet, View } from 'react-native';

import { RoutePreview } from '@/components/route-preview';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { ScoreBadge, scoreColor } from '@/components/ui/score-badge';
import { Screen } from '@/components/ui/screen';
import { Stat, StatRow } from '@/components/ui/stat';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getDrive, listDrives, listLinkedDrivers, totalMilesThisWeek } from '@/lib/demo-data';
import { formatMiles, formatRelative } from '@/lib/format';
import type { LinkedDriver } from '@/types/drive';

export default function ParentLiveScreen() {
  const drivers = listLinkedDrivers();
  const recentDrive = listDrives()[0];

  return (
    <Screen title="Live" subtitle="Where your drivers are right now.">
      {drivers.map((driver) => (
        <DriverCard key={driver.id} driver={driver} />
      ))}

      <Card title="Most recent drive" meta={recentDrive ? formatRelative(recentDrive.startedAt) : ''}>
        {recentDrive ? (
          <>
            <RoutePreview
              route={getDrive(recentDrive.id)?.route ?? []}
              caption={`${formatMiles(recentDrive.distanceMeters)} mi recorded`}
            />
            <StatRow>
              <Stat
                label="Safety score"
                value={`${recentDrive.safetyScore}`}
                valueColor={scoreColor(recentDrive.safetyScore)}
              />
              <Stat label="Miles this week" value={totalMilesThisWeek().toFixed(0)} unit="mi" />
              <Stat label="Events" value={`${recentDrive.events.length}`} />
            </StatRow>
          </>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            No drives recorded yet.
          </ThemedText>
        )}
      </Card>
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
              : `Not driving · last seen ${formatRelative(driver.lastSeenAt)}`}
          </ThemedText>
        </View>
        <ScoreBadge score={driver.weekScore} />
      </View>

      {driver.lastLocation ? (
        <ThemedText type="small" themeColor="textSecondary">
          Last location {driver.lastLocation.lat.toFixed(4)}, {driver.lastLocation.lon.toFixed(4)}
        </ThemedText>
      ) : null}
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
