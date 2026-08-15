import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Switch, View } from 'react-native';

import { AudioLevelGraph } from '@/components/audio-level-graph';
import { RoutePreview } from '@/components/route-preview';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Stat, StatRow } from '@/components/ui/stat';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAudioLevelBroadcast } from '@/lib/audio-broadcast';
import {
  finishDrive,
  heartbeatDrive,
  logDriveEvent,
  setDriveAudioMonitoring,
  startDrive,
} from '@/lib/drives';
import { formatDuration, formatMiles, formatMph } from '@/lib/format';
import { publishLocation } from '@/lib/locations';
import { notifyFamilyParents } from '@/lib/notifications';
import { useSession } from '@/lib/session';
import { describeLevel, useAudioMonitor } from '@/lib/use-audio-monitor';
import { useDriveTracker } from '@/lib/use-drive-tracker';

/**
 * How often the phone tells the family where it is and how the drive is going.
 * GPS arrives about once a second; writing that often would be a lot of traffic
 * for a dashboard that may well have nobody looking at it.
 */
const HEARTBEAT_MS = 10_000;

/** The on-screen loud-noise warning clears itself rather than needing a tap. */
const ALERT_VISIBLE_MS = 12_000;

export default function DriveScreen() {
  const theme = useTheme();
  const tracker = useDriveTracker();
  const { profile } = useSession();

  const [lastDriveSummary, setLastDriveSummary] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [driveId, setDriveId] = useState<string | null>(null);
  const [loudAlert, setLoudAlert] = useState<{ at: number; level: number } | null>(null);

  // Counted here rather than read back from the database so a failed event
  // insert cannot quietly erase the score penalty.
  const loudCount = useRef(0);

  const isRecording = tracker.status === 'recording';
  const isStarting = tracker.status === 'requesting';

  // The heartbeat and the loud-audio handler both need the newest tracker
  // numbers, but neither should re-arm every time a GPS fix lands.
  const latest = useRef({ tracker, driveId, profile });
  latest.current = { tracker, driveId, profile };

  const handleLoud = useCallback((level: number) => {
    const at = Date.now();
    const { tracker: current, driveId: id, profile: who } = latest.current;

    setLoudAlert({ at, level });
    loudCount.current += 1;

    const detail = `Cabin noise ${describeLevel(level)} — ${Math.round(level)} dBFS`;

    if (id) {
      void logDriveEvent({
        driveId: id,
        type: 'loud_audio',
        at,
        detail,
        lat: current.point?.lat,
        lon: current.point?.lon,
      }).catch(() => {
        // The on-screen warning already did the urgent half of the job.
      });
    }

    if (who?.familyId) {
      void notifyFamilyParents({
        familyId: who.familyId,
        title: `You should call ${who.username}`,
        body: 'It has got loud in the car while they are driving.',
        data: { driveId: id, type: 'loud_audio' },
      });
    }
  }, []);

  const audio = useAudioMonitor({ enabled: isRecording && audioEnabled, onLoud: handleLoud });

  // Push the level to whoever is watching this drive. Ephemeral — nothing about
  // this is written down, it only exists while a parent has the screen open.
  useAudioLevelBroadcast({
    driveId,
    level: audio.level,
    enabled: isRecording && audioEnabled,
  });

  // Clear the warning on its own so a driver never has to interact with it.
  useEffect(() => {
    if (!loudAlert) return;

    const timer = setTimeout(() => setLoudAlert(null), ALERT_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [loudAlert]);

  // Publish position and progress while recording, so the parent dashboard has
  // something live to show.
  useEffect(() => {
    if (!isRecording || !driveId || !profile) return;

    const userId = profile.id;

    async function beat() {
      const { tracker: current } = latest.current;
      const seconds = Math.max(1, current.elapsedMs / 1000);

      await heartbeatDrive({
        driveId: driveId!,
        distanceMeters: current.distanceMeters,
        topSpeed: current.topSpeed,
        avgSpeed: current.distanceMeters / seconds,
        currentSpeed: current.speed,
      });

      if (current.point) {
        await publishLocation({
          userId,
          lat: current.point.lat,
          lon: current.point.lon,
        });
      }
    }

    // Once immediately, so the parent sees the drive appear rather than waiting
    // out the first interval.
    void beat().catch(() => {});
    const timer = setInterval(() => void beat().catch(() => {}), HEARTBEAT_MS);

    return () => clearInterval(timer);
  }, [isRecording, driveId, profile]);

  async function handleStart() {
    if (!profile) return;

    const startedAt = await tracker.start();
    if (!startedAt) return;

    try {
      const id = await startDrive({
        driverId: profile.id,
        startedAt,
        audioMonitoring: audioEnabled,
      });

      setDriveId(id);
    } catch {
      // Recording continues on the phone; only the live view is lost. The drive
      // still saves at the end, because handleStop opens a row if none exists.
      Alert.alert(
        'Recording offline',
        'DriveSafe could not reach the server, so your family will not see this drive live. It will still save when you finish.'
      );
    }
  }

  async function toggleAudio(next: boolean) {
    setAudioEnabled(next);

    if (driveId) {
      void setDriveAudioMonitoring(driveId, next).catch(() => {
        // A stale flag on the parent's screen is not worth an interruption.
      });
    }
  }

  async function handleStop() {
    const summary = tracker.stop();
    if (!summary || !profile) return;

    const miles = formatMiles(summary.distanceMeters);
    const duration = formatDuration(summary.endedAt - summary.startedAt);

    setIsSaving(true);

    try {
      // A drive that never got a row — the phone was offline at the start —
      // still deserves to be saved.
      const id =
        driveId ??
        (await startDrive({
          driverId: profile.id,
          startedAt: summary.startedAt,
          audioMonitoring: audioEnabled,
        }));

      await finishDrive({
        driveId: id,
        startedAt: summary.startedAt,
        endedAt: summary.endedAt,
        distanceMeters: summary.distanceMeters,
        topSpeed: summary.topSpeed,
        avgSpeed: summary.avgSpeed,
        route: summary.route,
        loudAudioAlerts: loudCount.current,
      });

      setLastDriveSummary(`${miles} mi in ${duration} · saved`);
      Alert.alert('Drive saved', `${miles} mi in ${duration}. Your family can see it now.`);
    } catch (error) {
      setLastDriveSummary(`${miles} mi in ${duration} · not saved`);
      Alert.alert(
        'Could not save drive',
        error instanceof Error ? error.message : 'Check your connection and try again.'
      );
    } finally {
      setDriveId(null);
      setLoudAlert(null);
      loudCount.current = 0;
      setIsSaving(false);
    }
  }

  return (
    <Screen
      title={isRecording ? 'Recording' : `Hey, ${profile?.username ?? 'there'}`}
      subtitle={
        isRecording
          ? 'Keep your eyes on the road — DriveSafe has this.'
          : 'Start a drive and DriveSafe logs the route, speed, and safety events.'
      }>
      {loudAlert ? (
        <View
          style={[
            styles.alert,
            { backgroundColor: theme.warning, borderColor: theme.warning },
          ]}>
          <ThemedText style={[styles.alertTitle, { color: theme.onTint }]}>
            Keep it down
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.onTint }}>
            It got {describeLevel(loudAlert.level)} in here. Loud cabins make it easy to miss a
            siren — your family has been told.
          </ThemedText>
        </View>
      ) : null}

      <Card>
        <View style={styles.speedBlock}>
          <ThemedText
            style={[styles.speed, { color: isRecording ? theme.tint : theme.textSecondary }]}>
            {isRecording ? formatMph(tracker.speed) : '0'}
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
          <Button
            label={isSaving ? 'Saving…' : 'End drive'}
            variant="danger"
            onPress={() => void handleStop()}
            loading={isSaving}
          />
        ) : (
          <Button
            label={isStarting ? 'Starting…' : 'Start drive'}
            loading={isStarting || isSaving}
            onPress={() => void handleStart()}
          />
        )}
      </Card>

      <Card title="Audio distraction alerts">
        <View style={styles.toggleRow}>
          <ThemedText type="small" style={styles.toggleLabel}>
            {isRecording ? 'Listening for a loud cabin' : 'Listen for a loud cabin'}
          </ThemedText>
          <Switch
            value={audioEnabled}
            onValueChange={(next) => void toggleAudio(next)}
            trackColor={{ true: theme.tint, false: theme.border }}
          />
        </View>

        <ThemedText type="small" themeColor="textSecondary">
          DriveSafe measures how loud it is using the microphone. Nothing is recorded, saved, or
          uploaded — only the loudness reading leaves your phone, and only when it stays high.
        </ThemedText>

        {audio.status === 'monitoring' ? <AudioLevelGraph levels={audio.levels} /> : null}

        {audio.status === 'denied' ? (
          <ThemedText type="small" style={{ color: theme.warning }}>
            Microphone access is off, so DriveSafe cannot listen. Turn it on in your phone settings
            to use this.
          </ThemedText>
        ) : null}

        {audio.status === 'error' && audio.errorMessage ? (
          <ThemedText type="small" style={{ color: theme.danger }}>
            {audio.errorMessage}
          </ThemedText>
        ) : null}
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
      <ThemedText type="small" style={styles.upcomingLabel}>
        {label}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.upcomingDetail}>
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
  alert: {
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  alertTitle: {
    fontSize: 19,
    fontWeight: '700',
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
  upcoming: {
    gap: Spacing.two,
  },
  upcomingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  upcomingLabel: {
    flexShrink: 1,
  },
  upcomingDetail: {
    flexShrink: 1,
    textAlign: 'right',
  },
});
