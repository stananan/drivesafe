import 'leaflet/dist/leaflet.css';

import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { CircleMarker, MapContainer, Polyline, TileLayer, useMap } from 'react-leaflet';

import type { RouteMapProps } from '@/components/maps/types';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The browser's version of the route map.
 *
 * Leaflet rather than `react-native-maps`, which imports React Native internals
 * and cannot run in a browser at all. Tiles come from OpenStreetMap, the same
 * project the speed limits do.
 *
 * Circles rather than pin images for start and end: Leaflet's default marker
 * icon is loaded from a bundler-relative path that Metro does not produce, and
 * a drawn shape has no asset to lose.
 */
export function RouteMap({
  route,
  height = 220,
  interactive = false,
  follow = false,
}: RouteMapProps) {
  const theme = useTheme();

  const path = useMemo(
    () => route.map((point) => [point.lat, point.lon] as [number, number]),
    [route]
  );

  if (route.length < (follow ? 1 : 2)) {
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
  const centre: [number, number] = follow ? [end.lat, end.lon] : [start.lat, start.lon];

  return (
    <View style={[styles.container, { height, borderColor: theme.border }]}>
      <MapContainer
        center={centre}
        zoom={15}
        scrollWheelZoom={interactive}
        dragging={interactive}
        style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Polyline positions={path} pathOptions={{ color: theme.tint, weight: 4 }} />

        <CircleMarker
          center={[start.lat, start.lon]}
          radius={7}
          pathOptions={{ color: theme.success, fillColor: theme.success, fillOpacity: 1 }}
        />

        {follow ? null : (
          <CircleMarker
            center={[end.lat, end.lon]}
            radius={7}
            pathOptions={{ color: theme.danger, fillColor: theme.danger, fillOpacity: 1 }}
          />
        )}

        <Recentre lat={end.lat} lon={end.lon} enabled={follow} />
      </MapContainer>
    </View>
  );
}

/**
 * Slides the view to the newest fix while a drive is live.
 *
 * Leaflet is imperative, so this exists purely to reach the map instance from
 * inside the container — there is no prop for "follow this point".
 */
function Recentre({ lat, lon, enabled }: { lat: number; lon: number; enabled: boolean }) {
  const map = useMap();

  if (enabled) map.panTo([lat, lon], { animate: true });

  return null;
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
