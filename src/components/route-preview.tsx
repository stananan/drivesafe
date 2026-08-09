import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { DrivePoint } from '@/types/drive';

/**
 * A dependency-free route sketch.
 *
 * Real tiles arrive when we move to a development build with `expo-maps` — that
 * module is not in Expo Go, and this barebones build has to run from a QR code
 * on any phone. Until then this normalizes the recorded coordinates into the
 * box and draws the shape of the drive, which is enough to confirm the GPS
 * trace is sane.
 */
export function RoutePreview({
  route,
  height = 180,
  caption,
}: {
  route: DrivePoint[];
  height?: number;
  caption?: string;
}) {
  const theme = useTheme();

  if (route.length < 2) {
    return (
      <View
        style={[
          styles.container,
          styles.empty,
          { height, backgroundColor: theme.backgroundSelected, borderColor: theme.border },
        ]}>
        <ThemedText type="small" themeColor="textSecondary">
          {caption ?? 'Route appears once the drive is moving'}
        </ThemedText>
      </View>
    );
  }

  const lats = route.map((p) => p.lat);
  const lons = route.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  // Guard against a zero-size span when the car barely moved.
  const latSpan = Math.max(maxLat - minLat, 1e-5);
  const lonSpan = Math.max(maxLon - minLon, 1e-5);

  // Sample down to keep the view count low on long drives.
  const step = Math.max(1, Math.floor(route.length / 60));
  const dots = route.filter((_, i) => i % step === 0);

  return (
    <View
      style={[
        styles.container,
        { height, backgroundColor: theme.backgroundSelected, borderColor: theme.border },
      ]}>
      {dots.map((point, index) => {
        const isLast = index === dots.length - 1;

        return (
          <View
            key={`${point.t}-${index}`}
            style={[
              styles.dot,
              {
                // Latitude grows northward; screen y grows downward.
                bottom: `${((point.lat - minLat) / latSpan) * 88 + 6}%`,
                left: `${((point.lon - minLon) / lonSpan) * 88 + 6}%`,
                backgroundColor: isLast ? theme.tint : theme.textSecondary,
                opacity: isLast ? 1 : 0.55,
                transform: [{ scale: isLast ? 1.8 : 1 }],
              },
            ]}
          />
        );
      })}

      <View style={styles.captionRow}>
        <ThemedText type="small" themeColor="textSecondary">
          {caption ?? `${route.length} GPS points`}
        </ThemedText>
      </View>
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
  },
  dot: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: Radius.pill,
  },
  captionRow: {
    position: 'absolute',
    left: Spacing.two,
    bottom: Spacing.two,
  },
});
