import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AudioLevelGraph } from '@/components/audio-level-graph';
import { RoutePreview } from '@/components/route-preview';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Stat, StatRow } from '@/components/ui/stat';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { saveClip } from '@/lib/clips';
import {
  appendAudioLevels,
  finishDrive,
  heartbeatDrive,
  logDriveEvent,
  startDrive,
} from '@/lib/drives';
import { formatDuration, formatMiles, formatMph } from '@/lib/format';
import { publishLocation } from '@/lib/locations';
import { notifyFamilyParents } from '@/lib/notifications';
import { useSession } from '@/lib/session';
import { describeLevel, useAudioMonitor } from '@/lib/use-audio-monitor';
import { useDashcam } from '@/lib/use-dashcam';
import { useDriveTracker } from '@/lib/use-drive-tracker';
import type { DriveClipReason } from '@/types/drive';

/**
 * How often the phone tells the family where it is and how the drive is going.
 * GPS arrives about once a second; writing that often would be a lot of traffic
 * for a dashboard that may well have nobody looking at it.
 */
const HEARTBEAT_MS = 10_000;

/**
 * Loudness goes up far more often than the heartbeat. It is a handful of tiny
 * rows, and it is the one thing on the parent's screen that visibly lags when it
 * waits — a noise graph that arrives in clumps reads as broken.
 */
const AUDIO_FLUSH_MS = 1_000;

/**
 * How often a reading is kept for upload. The monitor samples faster still, but
 * two a second is the point where the parent's graph stops looking stepped and
 * starts looking live.
 */
const AUDIO_SAMPLE_MS = 500;

/** The on-screen loud-noise warning clears itself rather than needing a tap. */
const ALERT_VISIBLE_MS = 12_000;

export default function DriveScreen() {
  const theme = useTheme();
  const tracker = useDriveTracker();
  const { profile } = useSession();

  const [lastDriveSummary, setLastDriveSummary] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [driveId, setDriveId] = useState<string | null>(null);
  const [loudAlert, setLoudAlert] = useState<{ at: number; level: number } | null>(null);

  // Counted here rather than read back from the database so a failed event
  // insert cannot quietly erase the score penalty.
  const loudCount = useRef(0);

  // Readings wait here between heartbeats rather than being written one at a
  // time — a row per sample would be a write every fraction of a second.
  const pendingLevels = useRef<{ t: number; level: number }[]>([]);

  const isRecording = tracker.status === 'recording';
  const isStarting = tracker.status === 'requesting';

  // The heartbeat, the loud-audio handler, and the clip saver all need the
  // newest values, but none should re-arm every time a GPS fix lands.
  const latest = useRef({ tracker, driveId, profile });
  latest.current = { tracker, driveId, profile };

  // The driver sets these once in their profile; a drive just honours them.
  const audioEnabled = profile?.audioAlertsEnabled ?? false;
  const dashcamEnabled = profile?.dashcamEnabled ?? false;

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [isSavingClip, setIsSavingClip] = useState(false);
  const [lastClipAt, setLastClipAt] = useState<number | null>(null);

  const hasCamera = cameraPermission?.granted ?? false;
  const dashcam = useDashcam({ enabled: isRecording && dashcamEnabled && hasCamera });

  // Ask once, when the driver has actually asked for the feature.
  useEffect(() => {
    if (!dashcamEnabled || cameraPermission?.granted || !cameraPermission?.canAskAgain) return;

    void requestCameraPermission();
  }, [dashcamEnabled, cameraPermission, requestCameraPermission]);

  const keepClip = useCallback(
    async (reason: DriveClipReason) => {
      const id = latest.current.driveId;
      if (!id) return;

      setIsSavingClip(true);

      const segments = await dashcam.flush();

      try {
        if (segments.length === 0) return;

        await saveClip({
          driveId: id,
          reason,
          recordedAt: segments[0].startedAt,
          parts: segments.map((segment) => ({
            uri: segment.uri,
            durationSeconds: segment.durationSeconds,
          })),
        });

        setLastClipAt(Date.now());
      } catch (error) {
        Alert.alert(
          'Could not save that clip',
          error instanceof Error ? error.message : 'Check your connection and try again.'
        );
      } finally {
        dashcam.release(segments);
        setIsSavingClip(false);
      }
    },
    [dashcam]
  );

  // Held in a ref so the loud-audio handler can reach the newest version
  // without re-subscribing the microphone every render.
  const keepClipRef = useRef(keepClip);
  keepClipRef.current = keepClip;

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

    // The dashcam exists for moments like this one, so it does not wait to be
    // asked. Saving is best-effort: the warning and the event matter more.
    void keepClipRef.current('loud_audio').catch(() => {});

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

  const lastBufferedAt = useRef(0);
  useEffect(() => {
    if (audio.level === null) return;

    const now = Date.now();
    if (now - lastBufferedAt.current < AUDIO_SAMPLE_MS) return;

    lastBufferedAt.current = now;
    pendingLevels.current.push({ t: now, level: audio.level });
  }, [audio.level]);

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

  // Loudness on its own, faster cadence. Buffered so this is one small insert
  // rather than a write per reading.
  useEffect(() => {
    if (!isRecording || !driveId || !audioEnabled) return;

    async function flush() {
      if (pendingLevels.current.length === 0) return;

      const batch = pendingLevels.current;
      pendingLevels.current = [];

      try {
        await appendAudioLevels(driveId!, batch);
      } catch {
        // A dropped batch costs a gap in a graph. Never worth interrupting a
        // drive, and the next flush carries on regardless.
      }
    }

    const timer = setInterval(() => void flush(), AUDIO_FLUSH_MS);

    return () => {
      clearInterval(timer);
      void flush();
    };
  }, [isRecording, driveId, audioEnabled]);

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
      pendingLevels.current = [];
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

      {isRecording && dashcamEnabled ? (
        <Card
          title="Dashcam"
          meta={dashcam.status === 'recording' ? `${dashcam.bufferedSeconds}s buffered` : ''}>
          {hasCamera ? (
            <>
              <View style={styles.cameraWrap}>
                <CameraView
                  ref={dashcam.cameraRef}
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  mode="video"
                  // Video only. The microphone belongs to the loudness monitor,
                  // and DriveSafe does not record audio.
                  mute
                />
              </View>

              <ThemedText type="small" themeColor="textSecondary">
                Recording on a loop and keeping only the last fifteen seconds. Video only — no
                sound is captured. Tap below to keep what just happened.
              </ThemedText>

              <Button
                label={isSavingClip ? 'Saving clip…' : 'Save that'}
                variant="secondary"
                loading={isSavingClip}
                onPress={() => void keepClip('manual')}
              />

              {lastClipAt ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Clip saved. Your family can watch it on this drive.
                </ThemedText>
              ) : null}

              {dashcam.status === 'error' && dashcam.errorMessage ? (
                <ThemedText type="small" style={{ color: theme.danger }}>
                  {dashcam.errorMessage}
                </ThemedText>
              ) : null}
            </>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              The dashcam is on in your profile, but camera access is blocked. Turn it on in your
              phone settings, or switch the dashcam off in your profile.
            </ThemedText>
          )}
        </Card>
      ) : null}

      {audio.status === 'monitoring' ? (
        <Card title="Cabin noise">
          <AudioLevelGraph levels={audio.levels} height={80} />
          <ThemedText type="small" themeColor="textSecondary">
            The last few seconds. Bars reaching the line are what DriveSafe warns you about.
          </ThemedText>
        </Card>
      ) : null}

      {audio.status === 'denied' ? (
        <Card title="Microphone access needed">
          <ThemedText type="small" themeColor="textSecondary">
            Audio distraction alerts are on in your profile, but the microphone is blocked, so
            DriveSafe cannot tell how loud the car is. Turn it on in your phone settings, or switch
            the alerts off in your profile.
          </ThemedText>
        </Card>
      ) : null}

      {audio.status === 'error' && audio.errorMessage ? (
        <Card title="Audio alerts stopped">
          <ThemedText type="small" style={{ color: theme.danger }}>
            {audio.errorMessage}
          </ThemedText>
        </Card>
      ) : null}

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
  cameraWrap: {
    height: 180,
    borderRadius: Radius.medium,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
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
