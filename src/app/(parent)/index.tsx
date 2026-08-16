import * as Clipboard from 'expo-clipboard';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AvatarPin } from '@/components/avatar-pin';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ScoreBadge } from '@/components/ui/score-badge';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { listFamilyDrivers } from '@/lib/drives';
import { formatRelative } from '@/lib/format';
import { publishLocation } from '@/lib/locations';
import { registerForPushNotifications } from '@/lib/notifications';
import { useSession } from '@/lib/session';
import { useAsync } from '@/lib/use-async';
import { useDriveActivity } from '@/lib/use-drive-activity';
import { useFamilyAlerts } from '@/lib/use-family-alerts';
import type { LinkedDriver } from '@/types/drive';

/** Marin County, so an empty map still shows the district DriveSafe was built for. */
const FALLBACK_REGION: Region = {
  latitude: 38.0834,
  longitude: -122.7633,
  latitudeDelta: 0.2,
  longitudeDelta: 0.2,
};

/**
 * Backstop only — `useDriveActivity` is what actually makes a drive appear
 * promptly. Kept short enough that a parent whose realtime connection is down
 * still sees a drive start within a few seconds rather than a quarter-minute.
 */
const REFRESH_INTERVAL_MS = 5_000;

export default function ParentLiveScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, family } = useSession();

  const mapRef = useRef<MapView | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const hasFramed = useRef(false);

  const drivers = useAsync(
    () => (family ? listFamilyDrivers(family.id) : Promise.resolve([])),
    [family?.id],
    { enabled: Boolean(family) }
  );

  // The parent broadcasts too, so their driver can see them on the child map.
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    const userId = profile.id;

    async function publish() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== Location.PermissionStatus.GRANTED || cancelled) return;

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;

        await publishLocation({
          userId,
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      } catch {
        // Not being able to publish should never break the parent's view.
      }
    }

    void publish();
    return () => {
      cancelled = true;
    };
  }, [profile]);

  // Parents are the ones who get notified, so this is where the push token is
  // claimed. Silently does nothing where push cannot work — Expo Go, or before
  // `eas init` has given the project an id.
  useEffect(() => {
    if (!profile) return;

    void registerForPushNotifications(profile.id);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      void drivers.reload();
      const timer = setInterval(() => void drivers.reload(), REFRESH_INTERVAL_MS);
      return () => clearInterval(timer);
      // Polling on focus is the point; re-arming when the callback identity
      // changes is not.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  // Loud-audio alerts arrive here over realtime, so a parent sitting on this
  // tab sees them without waiting for the next poll.
  const { alert, dismiss } = useFamilyAlerts({ enabled: Boolean(family) });

  // A drive starting is what a parent is waiting for; it should not sit behind
  // the refresh interval.
  useDriveActivity({
    enabled: Boolean(family),
    onChange: () => void drivers.reload(),
  });

  // A new alert means something is happening right now; pull the driver list so
  // the row underneath flips to "Driving now" in the same beat.
  useEffect(() => {
    if (alert) void drivers.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alert]);

  const driverList = useMemo(() => drivers.data ?? [], [drivers.data]);
  const located = useMemo(
    () => driverList.filter((driver) => driver.lastLocation !== null),
    [driverList]
  );

  /** Slides the map to a driver rather than jumping, so the move is followable. */
  const centerOn = useCallback((driver: LinkedDriver) => {
    if (!driver.lastLocation || !mapRef.current) return;

    setSelectedId(driver.id);
    mapRef.current.animateToRegion(
      {
        latitude: driver.lastLocation.lat,
        longitude: driver.lastLocation.lon,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      700
    );
  }, []);

  // Frame everyone once, the first time positions arrive.
  useEffect(() => {
    if (hasFramed.current || located.length === 0 || !mapRef.current) return;
    hasFramed.current = true;

    if (located.length === 1) {
      centerOn(located[0]);
      return;
    }

    mapRef.current.fitToCoordinates(
      located.map((driver) => ({
        latitude: driver.lastLocation!.lat,
        longitude: driver.lastLocation!.lon,
      })),
      { edgePadding: { top: 90, right: 70, bottom: 90, left: 70 }, animated: true }
    );
  }, [located, centerOn]);

  async function copyCode() {
    if (!family) return;
    await Clipboard.setStringAsync(family.code);
    Alert.alert('Copied', `Family code ${family.code} is on your clipboard.`);
  }

  const noDriversYet = !drivers.isLoading && driverList.length === 0;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={FALLBACK_REGION}
          showsUserLocation
          showsMyLocationButton={false}
          toolbarEnabled={false}>
          {located.map((driver) => (
            <Marker
              key={driver.id}
              coordinate={{
                latitude: driver.lastLocation!.lat,
                longitude: driver.lastLocation!.lon,
              }}
              onPress={() => centerOn(driver)}
              // The pin's point sits at the coordinate, not its middle.
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={false}>
              <AvatarPin
                label={driver.name}
                isDriving={driver.activeDriveId !== null}
                isSelected={selectedId === driver.id}
              />
            </Marker>
          ))}
        </MapView>

        <View style={[styles.mapHeader, { top: insets.top + Spacing.two }]}>
          <View style={[styles.floatingCard, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">{family?.name ?? 'Your family'}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {drivers.isLoading
                ? 'Loading…'
                : located.length === 0
                  ? 'No live locations yet'
                  : `${located.length} ${located.length === 1 ? 'driver' : 'drivers'} on the map`}
            </ThemedText>
          </View>
        </View>
      </View>

      {alert ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            dismiss();
            router.push({ pathname: '/live/[id]', params: { id: alert.driveId } });
          }}
          style={({ pressed }) => [
            styles.alertBanner,
            {
              backgroundColor: theme.warning,
              bottom: BottomTabInset + insets.bottom + Spacing.three,
              opacity: pressed ? 0.9 : 1,
            },
          ]}>
          <ThemedText style={[styles.alertTitle, { color: theme.onTint }]}>
            You should call {alert.driverName}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.onTint }}>
            It has got loud in the car while they are driving. Tap to watch the drive.
          </ThemedText>
        </Pressable>
      ) : null}

      <View style={[styles.sheet, { backgroundColor: theme.background }]}>
        {noDriversYet ? (
          <FamilyCodeOnboarding code={family?.code ?? ''} onCopy={() => void copyCode()} />
        ) : (
          <ScrollView
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: BottomTabInset + insets.bottom + Spacing.three },
            ]}
            showsVerticalScrollIndicator={false}>
            <View style={styles.listHeader}>
              <ThemedText type="smallBold">Drivers</ThemedText>
              {drivers.isLoading ? <ActivityIndicator color={theme.tint} /> : null}
            </View>

            {drivers.error ? (
              <ThemedText type="small" style={{ color: theme.danger }}>
                {drivers.error}
              </ThemedText>
            ) : null}

            {driverList.map((driver) => (
              <DriverRow
                key={driver.id}
                driver={driver}
                isSelected={selectedId === driver.id}
                onPress={() => centerOn(driver)}
                onWatchLive={() => {
                  if (!driver.activeDriveId) return;
                  router.push({
                    pathname: '/live/[id]',
                    params: { id: driver.activeDriveId },
                  });
                }}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

/**
 * Shown only until the first driver joins. Once someone is in the family this
 * whole block is replaced by the driver list, so the code stops taking up the
 * screen the moment it stops being useful.
 */
function FamilyCodeOnboarding({ code, onCopy }: { code: string; onCopy: () => void }) {
  const theme = useTheme();

  return (
    <View style={styles.onboarding}>
      <ThemedText type="smallBold">Invite your driver</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Share this code. They enter it when they create their account, and this card disappears
        once they join.
      </ThemedText>

      <View style={[styles.codeBox, { borderColor: theme.tint, backgroundColor: theme.backgroundElement }]}>
        <ThemedText style={[styles.code, { color: theme.tint }]}>{code || '——————'}</ThemedText>
      </View>

      <Button label="Copy code" variant="secondary" onPress={onCopy} />
    </View>
  );
}

function DriverRow({
  driver,
  isSelected,
  onPress,
  onWatchLive,
}: {
  driver: LinkedDriver;
  isSelected: boolean;
  onPress: () => void;
  onWatchLive: () => void;
}) {
  const theme = useTheme();
  const isDriving = driver.activeDriveId !== null;
  const hasLocation = driver.lastLocation !== null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      disabled={!hasLocation}
      style={({ pressed }) => [
        styles.driverRow,
        {
          backgroundColor: isSelected ? theme.backgroundSelected : theme.backgroundElement,
          borderColor: isSelected ? theme.tint : theme.border,
          opacity: pressed || !hasLocation ? 0.75 : 1,
        },
      ]}>
      <View style={[styles.avatar, { backgroundColor: isDriving ? theme.success : theme.tint }]}>
        <ThemedText style={[styles.avatarInitial, { color: theme.onTint }]}>
          {driver.name.charAt(0).toUpperCase()}
        </ThemedText>
      </View>

      <View style={styles.driverText}>
        <ThemedText type="smallBold">{driver.name}</ThemedText>
        <ThemedText
          type="small"
          style={{ color: isDriving ? theme.success : theme.textSecondary }}>
          {isDriving
            ? driver.activeAudioMonitoring
              ? 'Driving now · audio alerts on'
              : 'Driving now'
            : hasLocation
              ? `Parked · updated ${formatRelative(driver.lastSeenAt ?? Date.now())}`
              : 'Not sharing location'}
        </ThemedText>
      </View>

      {isDriving ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Watch ${driver.name}'s drive`}
          onPress={onWatchLive}
          hitSlop={8}
          style={({ pressed }) => [
            styles.watchPill,
            { backgroundColor: theme.tint, opacity: pressed ? 0.85 : 1 },
          ]}>
          <ThemedText type="small" style={{ color: theme.onTint, fontWeight: '600' }}>
            Watch
          </ThemedText>
        </Pressable>
      ) : (
        <ScoreBadge score={driver.weekScore} showLabel={false} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  // Upper portion of the screen is the map; the list sheet takes the rest.
  mapWrap: {
    flex: 6,
  },
  sheet: {
    flex: 4,
    borderTopLeftRadius: Radius.large,
    borderTopRightRadius: Radius.large,
    marginTop: -Radius.large,
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  mapHeader: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
  },
  floatingCard: {
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.half,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  listContent: {
    gap: Spacing.two,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.one,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 21,
  },
  driverText: {
    flex: 1,
    gap: Spacing.half,
  },
  watchPill: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  // Floats over the driver list rather than pushing it around, so an alert
  // arriving mid-scroll does not move what the parent is already reading.
  alertBanner: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.half,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  alertTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  onboarding: {
    gap: Spacing.three,
    paddingTop: Spacing.two,
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
    // letterSpacing adds a trailing gap after the last character, which pushes
    // centred text visibly left. Pull it back by the same amount.
    marginLeft: 8,
  },
});
