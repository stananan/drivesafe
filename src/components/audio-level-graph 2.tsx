import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { LOUD_THRESHOLD_DBFS, QUIET_FLOOR_DBFS } from '@/lib/use-audio-monitor';

/**
 * A live plot of how loud the car is, in the same dependency-free style as
 * `RoutePreview` — plain views, no charting library, works from a QR code.
 *
 * This is as much a calibration instrument as a feature. The alert threshold is
 * drawn as a line across the graph, so during a road test you can watch where
 * conversation, the stereo, and actual shouting each land relative to it and
 * move the constant to the right place. Without the picture, tuning the
 * threshold is guesswork.
 *
 * Bars are drawn oldest-left, so the trace reads like a strip chart.
 */
/**
 * More bars than this and they stop being distinguishable, while the view count
 * starts to matter — an hour-long drive is thousands of readings.
 */
const MAX_BARS = 60;

/**
 * Collapses a long series into at most `MAX_BARS` buckets, keeping the *loudest*
 * reading in each. Averaging would smooth away exactly what the graph exists to
 * show: a brief spell of shouting inside an otherwise quiet drive.
 */
function downsample(levels: number[]): number[] {
  if (levels.length <= MAX_BARS) return levels;

  const bucketSize = levels.length / MAX_BARS;
  const buckets: number[] = [];

  for (let i = 0; i < MAX_BARS; i++) {
    const start = Math.floor(i * bucketSize);
    const end = Math.min(levels.length, Math.floor((i + 1) * bucketSize));
    let peak = levels[start];

    for (let j = start + 1; j < end; j++) {
      if (levels[j] > peak) peak = levels[j];
    }

    buckets.push(peak);
  }

  return buckets;
}

export function AudioLevelGraph({
  levels: raw,
  height = 96,
  threshold = LOUD_THRESHOLD_DBFS,
  floor = QUIET_FLOOR_DBFS,
}: {
  /** dBFS readings, oldest first. Downsampled internally when long. */
  levels: number[];
  height?: number;
  threshold?: number;
  floor?: number;
}) {
  const theme = useTheme();
  const levels = useMemo(() => downsample(raw), [raw]);

  /** dBFS to a 0–1 position in the plot, clamped to the visible window. */
  const positionOf = (dbfs: number) =>
    Math.max(0, Math.min(1, (dbfs - floor) / (0 - floor)));

  if (levels.length === 0) {
    return (
      <View
        style={[
          styles.container,
          styles.empty,
          { height, backgroundColor: theme.backgroundSelected, borderColor: theme.border },
        ]}>
        <ThemedText type="small" themeColor="textSecondary">
          Listening…
        </ThemedText>
      </View>
    );
  }

  const thresholdPosition = positionOf(threshold);

  return (
    <View
      style={[
        styles.container,
        { height, backgroundColor: theme.backgroundSelected, borderColor: theme.border },
      ]}>
      {/* The alert line. Anything reaching it starts the sustain timer. */}
      <View
        style={[
          styles.threshold,
          { bottom: `${thresholdPosition * 100}%`, backgroundColor: theme.warning },
        ]}
      />

      <View style={styles.bars}>
        {levels.map((level, index) => {
          const isLoud = level >= threshold;

          return (
            <View
              key={index}
              style={[
                styles.bar,
                {
                  height: `${Math.max(2, positionOf(level) * 100)}%`,
                  backgroundColor: isLoud ? theme.warning : theme.tint,
                  // Older samples fade, so the eye lands on what is happening now.
                  opacity: 0.35 + (index / Math.max(1, levels.length - 1)) * 0.65,
                },
              ]}
            />
          );
        })}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: '100%',
    paddingHorizontal: Spacing.one,
    gap: 2,
  },
  bar: {
    flex: 1,
    borderRadius: 1,
  },
  threshold: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth * 2,
    opacity: 0.8,
  },
});
