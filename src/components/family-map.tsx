import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatRelative } from '@/lib/format';
import {
  getLocationSharing,
  listFamilyLocations,
  publishLocation,
  type FamilyLocation,
} from '@/lib/locations';
import { useSession } from '@/lib/session';

/** How often we push our own position while the map is open. */
const PUBLISH_INTERVAL_MS = 15_000;
/** How often we pull everyone else's. */
const REFRESH_INTERVAL_MS = 15_000;

/**
 * The shared family map. A parent and a driver see exactly the same screen —
 * everyone in the family who is sharing shows up as a pin, including you.
 *
 * Location only moves while this screen is open and focused. Background
 * tracking would need a development build, and more importantly it is not
 * something to switch on for a family without asking first.
 */
export function FamilyMap() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { profile, family } = useSession();

  const mapRef = useRef<MapView | null>(null);
  const [locations, setLocations] = useState<FamilyLocation[]>([]);
  const [permission, setPermission] = useState<Location.PermissionStatus | null>(null);
  const [isSharing, setIsSharing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasFitted, setHasFitted] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const next = await listFamilyLocations();
      setLocations(next);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load family locations.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const pushMyLocation = useCallback(async () => {
    if (!profile) return;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermission(status);
      if (status !== Location.PermissionStatus.GRANTED) return;

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      await publishLocation({
        userId: profile.id,
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      });
    } catch {
      // A failed publish is not worth interrupting the map for; the next tick
      // will try again.
    }
  }, [profile]);

  // Sharing is a profile preference now, set from the profile screen. Re-read on
  // focus rather than trusting the session copy, so toggling it on another tab
  // and coming straight back here shows the truth.
  useFocusEffect(
    useCallback(() => {
      if (!profile) return;

      getLocationSharing(profile.id)
        .then(setIsSharing)
        .catch(() => setIsSharing(true));
    }, [profile])
  );

  // Publish and refresh only while the screen is actually on top.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function tick() {
        if (cancelled) return;
        if (isSharing) await pushMyLocation();
        if (!cancelled) await refresh();
      }

      void tick();

      const publishTimer = setInterval(() => {
        if (isSharing) void pushMyLocation();
      }, PUBLISH_INTERVAL_MS);
      const refreshTimer = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);

      return () => {
        cancelled = true;
        clearInterval(publishTimer);
        clearInterval(refreshTimer);
      };
    }, [isSharing, pushMyLocation, refresh])
  );

  const others = useMemo(
    () => locations.filter((entry) => entry.id !== profile?.id),
    [locations, profile]
  );

  const initialRegion = useMemo<Region>(() => {
    const mine = locations.find((entry) => entry.id === profile?.id) ?? locations[0];

    return {
      // Falls back to Marin County — DriveSafe's home district — so the map is
      // never a grey void while the first fix lands.
      latitude: mine?.lat ?? 38.0834,
      longitude: mine?.lon ?? -122.7633,
      latitudeDelta: 0.15,
      longitudeDelta: 0.15,
    };
  }, [locations, profile]);

  // Frame everyone once, the first time we have more than one pin.
  useEffect(() => {
    if (hasFitted || locations.length === 0 || !mapRef.current) return;

    if (locations.length === 1) {
      setHasFitted(true);
      return;
    }

    mapRef.current.fitToCoordinates(
      locations.map((entry) => ({ latitude: entry.lat, longitude: entry.lon })),
      { edgePadding: { top: 120, right: 80, bottom: 220, left: 80 }, animated: true }
    );
    setHasFitted(true);
  }, [locations, hasFitted]);

  function focusOn(entry: FamilyLocation) {
    mapRef.current?.animateToRegion(
      {
        latitude: entry.lat,
        longitude: entry.lon,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      400
    );
  }

  const denied =
    permission !== null && permission !== Location.PermissionStatus.GRANTED && isSharing;

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsUserLocation={permission === Location.PermissionStatus.GRANTED}
        showsMyLocationButton={false}
        toolbarEnabled={false}>
        {locations.map((entry) => {
          const isMe = entry.id === profile?.id;

          return (
            <Marker
              key={entry.id}
              coordinate={{ latitude: entry.lat, longitude: entry.lon }}
              title={isMe ? `${entry.username} (you)` : entry.username}
              description={`Updated ${formatRelative(entry.at)}`}
              pinColor={isMe ? 'green' : entry.role === 'parent' ? 'purple' : 'red'}
            />
          );
        })}
      </MapView>

      <View style={[styles.header, { top: insets.top + Spacing.two }]}>
        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <ThemedText type="smallBold">{family?.name ?? 'Your family'}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {isLoading
                  ? 'Finding everyone…'
                  : others.length === 0
                    ? 'Nobody else is sharing right now'
                    : `${others.length} ${others.length === 1 ? 'person' : 'people'} sharing`}
              </ThemedText>
            </View>
            {isLoading ? <ActivityIndicator color={theme.tint} /> : null}
          </View>

          {!isSharing ? (
            <ThemedText type="small" themeColor="textSecondary">
              You are not sharing your location, so your family cannot see you here. Turn it back on
              from your profile.
            </ThemedText>
          ) : null}

          {denied ? (
            <ThemedText type="small" style={{ color: theme.warning }}>
              Location permission is off, so your family cannot see you. Enable it in Settings →
              Privacy → Location Services.
            </ThemedText>
          ) : null}

          {error ? (
            <ThemedText type="small" style={{ color: theme.danger }}>
              {error}
            </ThemedText>
          ) : null}
        </View>
      </View>

      {locations.length > 0 ? (
        <View style={[styles.footer, { bottom: BottomTabInset + insets.bottom + Spacing.two }]}>
          <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            {locations.map((entry) => {
              const isMe = entry.id === profile?.id;

              return (
                <Pressable
                  key={entry.id}
                  accessibilityRole="button"
                  onPress={() => focusOn(entry)}
                  style={styles.personRow}>
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor: isMe
                          ? theme.success
                          : entry.role === 'parent'
                            ? theme.tint
                            : theme.warning,
                      },
                    ]}
                  />
                  <ThemedText type="small" style={styles.personName}>
                    {isMe ? `${entry.username} (you)` : entry.username}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatRelative(entry.at)}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
  },
  footer: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
  },
  card: {
    borderRadius: Radius.large,
    padding: Spacing.three,
    gap: Spacing.two,
    // A floating card over map tiles needs its own separation from them.
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 4 },
    }),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  headerText: {
    flex: 1,
    gap: Spacing.half,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 28,
  },
  personName: {
    flex: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: Radius.pill,
  },
});
