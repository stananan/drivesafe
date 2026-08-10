import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, type Region } from 'react-native-maps';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { DrivePoint } from '@/types/drive';

/**
 * A recorded drive drawn on real map tiles.
 *
 * Non-interactive by default: on the drive detail screen this sits inside a
 * scroll view, and a pannable map there would fight the scroll gesture.
 */
export function DriveRouteMap({
  route,
  height = 220,
  interactive = false,
}: {
  route: DrivePoint[];
  height?: number;
  interactive?: boolean;
}) {
  const theme = useTheme();

  const region = useMemo<Region | null>(() => {
    if (route.length === 0) return null;

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
  }, [route]);

  if (!region || route.length < 2) {
    return (
      <View
        style={[
          styles.empty,
          { height, backgroundColor: theme.backgroundSelected, borderColor: theme.border },
        ]}>
        <ThemedText type="small" themeColor="textSecondary">
          No route recorded for this drive.
        </ThemedText>
      </View>
    );
  }

  const start = route[0];
  const end = route[route.length - 1];

  return (
    <View style={[styles.container, { height, borderColor: theme.border }]}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={region}
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
        <Marker coordinate={{ latitude: end.lat, longitude: end.lon }} title="End" pinColor="red" />
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
