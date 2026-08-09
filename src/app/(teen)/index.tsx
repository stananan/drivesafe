import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { RoutePreview } from '@/components/route-preview';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Stat, StatRow } from '@/components/ui/stat';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DEMO_DRIVER_NAME } from '@/lib/demo-data';
import { formatDuration, formatMiles, formatMph } from '@/lib/format';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useDriveTracker } from '@/lib/use-drive-tracker';

export default function DriveScreen() {
  const theme = useTheme();
  const tracker = useDriveTracker();
  const [lastDriveSummary, setLastDriveSummary] = useState<string | null>(null);

  const isRecording = tracker.status === 'recording';
  const isStarting = tracker.status === 'requesting';

  function handleStop() {
    const summary = tracker.stop();
    if (!summary) return;

    const miles = formatMiles(summary.distanceMeters);
    const duration = formatDuration(summary.endedAt - summary.startedAt);
    setLastDriveSummary(`${miles} mi in ${duration} · ${summary.route.length} GPS points`);

    Alert.alert(
      'Drive saved locally',
      `${miles} mi in ${duration}.\n\n` +
        (isSupabaseConfigured
          ? 'Uploading to Supabase is the next milestone — the drive is held in memory for now.'
          : 'Add your Supabase keys to .env.local to sync this drive to your parent.')
    );
  }

  return (
    <Screen
      title={isRecording ? 'Recording' : `Hey, ${DEMO_DRIVER_NAME}`}
      subtitle={
        isRecording
          ? 'Keep your eyes on the road — DriveSafe has this.'
          : 'Start a drive and DriveSafe logs the route, speed, and safety events.'
      }>
      <Card>
        <View style={styles.speedBlock}>
          <ThemedText
            style={[styles.speed, { color: isRecording ? theme.tint : theme.textSecondary }]}>
            {isRecording ? formatMph(tracker.speed) : '--'}
          </ThemedText>
          <ThemedText type="smallBold" themeColor="textSecondary">
            MPH
          </ThemedText>
        </View>

        <StatRow>
          <Stat label="Distance" value={formatMiles(tracker.distanceMeters)} unit="mi" />
          <Stat label="Time" value={formatDuration(tracker.elapsedMs)} />
          <Stat label="Top speed" value={formatMph(tracker.topSpeed)} unit="mph" />
        </StatRow>

        {isRecording ? (
          <Button label="End drive" variant="danger" onPress={handleStop} />
        ) : (
          <Button
            label={isStarting ? 'Starting…' : 'Start drive'}
            loading={isStarting}
            onPress={tracker.start}
          />
        )}
      </Card>

      {tracker.status === 'denied' ? (
        <Card title="Location access needed">
          <ThemedText type="small" themeColor="textSecondary">
            DriveSafe can only record a drive with location permission. Enable it in Settings →
            Privacy → Location Services, then start the drive again.
          </ThemedText>
        </Card>
      ) : null}

      {tracker.status === 'error' && tracker.errorMessage ? (
        <Card title="Could not start recording">
          <ThemedText type="small" style={{ color: theme.danger }}>
            {tracker.errorMessage}
          </ThemedText>
        </Card>
      ) : null}

      {isRecording ? (
        <Card title="Live route" meta={`${tracker.pointCount} points`}>
          <RoutePreview
            route={tracker.route}
            caption={
              tracker.route.length < 2 ? 'Route builds as you move' : `${tracker.pointCount} points`
            }
            height={160}
          />
          {tracker.point ? (
            <ThemedText type="small" themeColor="textSecondary">
              {tracker.point.lat.toFixed(5)}, {tracker.point.lon.toFixed(5)}
              {tracker.point.accuracy ? ` · ±${Math.round(tracker.point.accuracy)} m` : ''}
            </ThemedText>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              Waiting for the first GPS fix…
            </ThemedText>
          )}
        </Card>
      ) : null}

      {!isRecording && lastDriveSummary ? (
        <Card title="Last drive">
          <ThemedText type="small" themeColor="textSecondary">
            {lastDriveSummary}
          </ThemedText>
        </Card>
      ) : null}

      {!isRecording ? (
        <Card title="Coming soon">
          <View style={styles.upcoming}>
            <UpcomingRow label="Audio distraction alerts" detail="On-device, nothing recorded" />
            <UpcomingRow label="Rolling-buffer dashcam" detail="Keeps the last 60 seconds" />
            <UpcomingRow label='"DriveSafe, save that"' detail="Voice-triggered clip capture" />
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

function UpcomingRow({ label, detail }: { label: string; detail: string }) {
  return (
    <View style={styles.upcomingRow}>
      <ThemedText type="small">{label}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {detail}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  speedBlock: {
    alignItems: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.two,
  },
  speed: {
    fontSize: 88,
    lineHeight: 96,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  upcoming: {
    gap: Spacing.two,
  },
  upcomingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
