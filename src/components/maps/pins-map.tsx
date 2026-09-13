import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';

import { AvatarPin } from '@/components/avatar-pin';
import type { PinsMapProps } from '@/components/maps/types';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Marin County, so an empty map still shows the district DriveSafe was built for. */
const FALLBACK: Region = {
  latitude: 38.0834,
  longitude: -122.7633,
  latitudeDelta: 0.2,
  longitudeDelta: 0.2,
};

/**
 * People on a map: family members, or one driver being followed.
 *
 * The counterpart to `RouteMap`, and the other half of what had to be abstracted
 * before the app could build for the web at all. Its `.web.tsx` twin draws the
 * same pins with Leaflet.
 */
export function PinsMap({ pins, height = 240, focusId, fill = false }: PinsMapProps) {
  const theme = useTheme();
  const mapRef = useRef<MapView | null>(null);
  const hasFramed = useRef(false);

  // Frame everyone once, the first time there is more than one pin to frame.
  useEffect(() => {
    if (hasFramed.current || pins.length === 0 || !mapRef.current) return;
    hasFramed.current = true;

    if (pins.length === 1) {
      mapRef.current.animateToRegion(
        {
          latitude: pins[0].lat,
          longitude: pins[0].lon,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        700
      );
      return;
    }

    mapRef.current.fitToCoordinates(
      pins.map((pin) => ({ latitude: pin.lat, longitude: pin.lon })),
      { edgePadding: { top: 90, right: 70, bottom: 90, left: 70 }, animated: true }
    );
  }, [pins]);

  // Slide to whichever pin the caller wants shown.
  useEffect(() => {
    if (!focusId || !mapRef.current) return;

    const pin = pins.find((candidate) => candidate.id === focusId);
    if (!pin) return;

    mapRef.current.animateToRegion(
      { latitude: pin.lat, longitude: pin.lon, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      700
    );
  }, [focusId, pins]);

  return (
    <View
      style={[
        fill ? StyleSheet.absoluteFill : { height },
        fill ? null : { borderRadius: Radius.medium, overflow: 'hidden', borderColor: theme.border },
      ]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={FALLBACK}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}>
        {pins.map((pin) => (
          <Marker
            key={pin.id}
            coordinate={{ latitude: pin.lat, longitude: pin.lon }}
            // The pin's point sits at the coordinate, not its middle.
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges={false}>
            <AvatarPin
              label={pin.label}
              isDriving={pin.isDriving ?? false}
              isSelected={pin.isSelected ?? false}
            />
          </Marker>
        ))}
      </MapView>
    </View>
  );
}
