import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, type Region } from 'react-native-maps';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { DrivePoint } from '@/types/drive';

/**
 * A drive drawn on real map tiles, finished or in progress.
 *
 * Non-interactive by default: on the drive detail screen this sits inside a
 * scroll view, and a pannable map there would fight the scroll gesture.
 *
 * `follow` is for a drive that is still happening. Framing the whole route
 * would zoom further out with every mile, until a driver glancing down sees a
 * county rather than the road they are on; following keeps the view at street
 * level and moves it along instead.
 */
export function DriveRouteMap({
  route,
  height = 220,
  interactive = false,
  follow = false,
}: {
  route: DrivePoint[];
  height?: number;
  interactive?: boolean;
  /** Track the newest fix rather than framing the whole route. */
  follow?: boolean;
}) {
  const theme = useTheme();
  const mapRef = useRef<MapView | null>(null);

  const latest = route.length > 0 ? route[route.length - 1] : null;

  // Slides the view to each new fix. Animating rather than setting `region`
  // keeps the map from snapping, which at a glance reads as the map breaking.
  useEffect(() => {
    if (!follow || !latest || !mapRef.current) return;

    mapRef.current.animateToRegion(
      {
        latitude: latest.lat,
        longitude: latest.lon,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      },
      800
    );
  }, [follow, latest]);

  const region = useMemo<Region | null>(() => {
    if (route.length === 0) return null;

    // A drive in progress opens at street level around where it started, and
    // the effect above takes over from there.
    if (follow) {
      const first = route[0];
      return {
        latitude: first.lat,
        longitude: first.lon,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      };
    }

    const lats = route.map((point) => point.lat);
    const lons = route.map((point) => point.lon);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    // A 40% margin keeps the route off the edges, and the floor stops a very
    // short trip from zooming to street level.
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLon + maxLon) / 2,
      latitudeDelta: Math.max((maxLat - minLat) * 1.4, 0.01),
      longitudeDelta: Math.max((maxLon - minLon) * 1.4, 0.01),
    };
  }, [route, follow]);

  // A live drive is worth showing from its very first fix; a finished one needs
  // two points before there is a line to draw.
  if (!region || route.length < (follow ? 1 : 2)) {
    return (
      <View
        style={[
          styles.empty,
          { height, backgroundColor: theme.backgroundSelected, borderColor: theme.border },
        ]}>
        <ThemedText type="small" themeColor="textSecondary">
          {follow ? 'Waiting for the first GPS fix…' : 'No route recorded for this drive.'}
        </ThemedText>
      </View>
    );
  }

  const start = route[0];
  const end = route[route.length - 1];

  return (
    <View style={[styles.container, { height, borderColor: theme.border }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        showsUserLocation={follow}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}>
        <Polyline
          coordinates={route.map((point) => ({ latitude: point.lat, longitude: point.lon }))}
          strokeColor={theme.tint}
          strokeWidth={4}
        />
        <Marker
          coordinate={{ latitude: start.lat, longitude: start.lon }}
          title="Start"
          pinColor="green"
        />
        {follow ? null : (
          <Marker
            coordinate={{ latitude: end.lat, longitude: end.lon }}
            title="End"
            pinColor="red"
          />
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  empty: {
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
  },
});
