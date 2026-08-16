import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { AudioLevelGraph } from '@/components/audio-level-graph';
import { AvatarPin } from '@/components/avatar-pin';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { QueryState } from '@/components/ui/query-state';
import { Screen } from '@/components/ui/screen';
import { Stat, StatRow } from '@/components/ui/stat';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getLiveDrive } from '@/lib/drives';
import { formatDuration, formatMiles, formatMph, formatRelative } from '@/lib/format';
import { getSupabase } from '@/lib/supabase';
import { useAsync } from '@/lib/use-async';
import type { DriveEvent } from '@/types/drive';

/**
 * Backstop poll. Realtime carries the interesting changes, so this only exists
 * to cover a dropped socket and to move the driver's pin as they travel — the
 * position lives on `profiles`, which the drive subscription does not watch.
 */
const REFRESH_MS = 5_000;

/** How long a loud-audio alert stays banner-worthy rather than just list-worthy. */
const RECENT_ALERT_MS = 3 * 60_000;

const EVENT_LABELS: Record<DriveEvent['type'], string> = {
  speeding: 'Speeding',
  hard_brake: 'Hard brake',
  rapid_accel: 'Rapid acceleration',
  phone_distraction: 'Phone distraction',
  loud_audio: 'Loud in the car',
};

/**
 * What a parent sees while their driver is out.
 *
 * Everything here is deliberately read-only. A parent watching a drive should be
 * able to see what is happening without any control that would tempt a driver to
 * pick up the phone and respond.
 */
export default function LiveDriveScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const live = useAsync(() => getLiveDrive(id), [id]);

  // Subscriptions and timers should not re-arm every time a poll lands.
  const reloadRef = useRef(live.reload);
  reloadRef.current = live.reload;

  useEffect(() => {
    const timer = setInterval(() => void reloadRef.current(), REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  // A loud-audio alert should land on this screen the moment it is written,
  // not up to five seconds later.
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !id) return;

    const channel = supabase
      .channel(`live-drive-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'drive_events',
          filter: `drive_id=eq.${id}`,
        },
        () => void reloadRef.current()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'drives', filter: `id=eq.${id}` },
        () => void reloadRef.current()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id]);

  const drive = live.data?.drive ?? null;
  const position = live.data?.position ?? null;
  const isActive = drive?.status === 'active';

  // A finished drive is not a live drive. The moment the driver ends it, hand
  // the parent the completed trip instead of leaving them on a dashboard whose
  // numbers have stopped moving. `replace` rather than `push` so Back returns
  // to the Live tab rather than to a dead screen.
  const hasRedirected = useRef(false);
  useEffect(() => {
    if (!drive || drive.status !== 'completed' || hasRedirected.current) return;

    hasRedirected.current = true;
    router.replace({ pathname: '/drive/[id]', params: { id: drive.id } });
  }, [drive, router]);

  // Ticks locally so the clock moves between heartbeats.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isActive) return;

    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [isActive]);

  if (live.isLoading || live.error || !drive) {
    return (
      <Screen title="Live drive" subtitle="">
        <QueryState
          isLoading={live.isLoading}
          error={live.error}
          isEmpty={!live.isLoading && !drive}
          emptyMessage="This drive is no longer available, or it belongs to another family."
        />
      </Screen>
    );
  }

  const duration = (drive.endedAt ?? now) - drive.startedAt;

  // Events come back newest first, so the first match is the latest one.
  const recentLoud = isActive
    ? drive.events.find(
        (event) => event.type === 'loud_audio' && now - event.at < RECENT_ALERT_MS
      )
    : undefined;

  return (
    <Screen
      title={drive.driverName}
      subtitle={isActive ? 'Driving right now' : 'This drive has finished.'}>
      {recentLoud ? (
        <View style={[styles.alert, { backgroundColor: theme.warning }]}>
          <ThemedText style={[styles.alertTitle, { color: theme.onTint }]}>
            Loud in the car
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.onTint }}>
            You should call {drive.driverName}. It has been loud in the car since{' '}
            {formatRelative(recentLoud.at)} — they were warned on their screen too.
          </ThemedText>
        </View>
      ) : null}

      <Card>
        {position ? (
          <View style={styles.mapWrap}>
            <MapView
              style={StyleSheet.absoluteFill}
              region={{
                latitude: position.lat,
                longitude: position.lon,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              toolbarEnabled={false}>
              <Marker
                coordinate={{ latitude: position.lat, longitude: position.lon }}
                anchor={{ x: 0.5, y: 1 }}
                tracksViewChanges={false}>
                <AvatarPin label={drive.driverName} isDriving={isActive} isSelected />
              </Marker>
            </MapView>
          </View>
        ) : (
          <View style={[styles.mapWrap, styles.mapEmpty, { borderColor: theme.border }]}>
            <ThemedText type="small" themeColor="textSecondary">
              {drive.driverName} has location sharing off, so there is no map for this drive.
            </ThemedText>
          </View>
        )}

        {position ? (
          <ThemedText type="small" themeColor="textSecondary">
            Position updated {formatRelative(position.at)}
          </ThemedText>
        ) : null}
      </Card>

      <Card title={isActive ? 'Right now' : 'Final numbers'}>
        <StatRow>
          <Stat
            label={isActive ? 'Speed' : 'Avg speed'}
            value={formatMph(isActive ? drive.currentSpeed : drive.avgSpeed)}
            unit="mph"
          />
          <Stat label="Distance" value={formatMiles(drive.distanceMeters)} unit="mi" />
          <Stat label="Duration" value={formatDuration(duration)} />
        </StatRow>
        <StatRow>
          <Stat label="Top speed" value={formatMph(drive.topSpeed)} unit="mph" />
          <Stat
            label="Audio alerts"
            value={drive.audioMonitoring ? 'On' : 'Off'}
            valueColor={drive.audioMonitoring ? 'success' : 'textSecondary'}
          />
        </StatRow>

        <ThemedText type="small" themeColor="textSecondary">
          {drive.audioMonitoring
            ? 'Audio distraction alerts are on for this drive. DriveSafe measures loudness on their phone — it never records or sends audio.'
            : 'Audio distraction alerts are off for this drive. Only your driver can turn them on.'}
        </ThemedText>
      </Card>

      {drive.audioMonitoring ? (
        <Card title="How loud it is in there" meta={`${drive.audioLevels.length} readings`}>
          <AudioLevelGraph levels={drive.audioLevels.map((sample) => sample.level)} />
          <ThemedText type="small" themeColor="textSecondary">
            {drive.audioLevels.length === 0
              ? 'Waiting for the first readings from their phone.'
              : 'The whole drive so far, not just since you opened this. Taller bars mean a louder car; the line is where DriveSafe starts warning them.'}
          </ThemedText>
        </Card>
      ) : null}

      <Card title="Alerts" meta={`${drive.events.length}`}>
        {drive.events.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {isActive
              ? 'Nothing flagged so far. Alerts appear here the moment they happen.'
              : 'Nothing was flagged on this drive.'}
          </ThemedText>
        ) : (
          <View style={styles.events}>
            {drive.events.map((event) => (
              <View key={event.id} style={styles.event}>
                <View
                  style={[
                    styles.eventDot,
                    {
                      backgroundColor:
                        event.type === 'loud_audio' ? theme.warning : theme.danger,
                    },
                  ]}
                />
                <View style={styles.eventText}>
                  <ThemedText type="smallBold">{EVENT_LABELS[event.type]}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {event.detail} · {formatRelative(event.at)}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  alert: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  alertTitle: {
    fontSize: 19,
    fontWeight: '700',
  },
  mapWrap: {
    height: 260,
    borderRadius: Radius.medium,
    overflow: 'hidden',
  },
  mapEmpty: {
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
  },
  events: {
    gap: Spacing.three,
  },
  event: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  eventDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
    marginTop: 6,
  },
  eventText: {
    flex: 1,
    gap: Spacing.half,
  },
});
