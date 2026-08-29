import 'leaflet/dist/leaflet.css';

import { StyleSheet, View } from 'react-native';
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';

import type { MapPin, PinsMapProps } from '@/components/maps/types';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Marin County, so an empty map still shows the district DriveSafe was built for. */
const FALLBACK: [number, number] = [38.0834, -122.7633];

/**
 * The browser's version of the family map.
 *
 * Circles with permanent tooltips rather than the phone's avatar pins: Leaflet's
 * marker icons come from asset paths Metro does not produce, and a name beside a
 * dot reads at least as well on a screen the size of a dashboard.
 */
export function PinsMap({ pins, height = 240, focusId, fill = false }: PinsMapProps) {
  const theme = useTheme();

  const focused = pins.find((pin) => pin.id === focusId) ?? pins[0];
  const centre: [number, number] = focused ? [focused.lat, focused.lon] : FALLBACK;

  return (
    <View
      style={[
        fill ? StyleSheet.absoluteFill : { height },
        fill ? null : { borderRadius: Radius.medium, overflow: 'hidden' },
      ]}>
      <MapContainer
        center={centre}
        zoom={focused ? 14 : 11}
        style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {pins.map((pin) => (
          <Pin key={pin.id} pin={pin} driving={theme.success} parked={theme.tint} />
        ))}

        {focused ? <Recentre lat={focused.lat} lon={focused.lon} /> : null}
      </MapContainer>
    </View>
  );
}

function Pin({ pin, driving, parked }: { pin: MapPin; driving: string; parked: string }) {
  const colour = pin.isDriving ? driving : parked;

  return (
    <CircleMarker
      center={[pin.lat, pin.lon]}
      radius={pin.isSelected ? 12 : 9}
      pathOptions={{ color: colour, fillColor: colour, fillOpacity: 0.9, weight: 3 }}>
      <Tooltip permanent direction="top" offset={[0, -10]}>
        {pin.label}
        {pin.isDriving ? ' · driving' : ''}
      </Tooltip>
    </CircleMarker>
  );
}

/** Leaflet is imperative; this is the only way to move the view from props. */
function Recentre({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  map.panTo([lat, lon], { animate: true });
  return null;
}
