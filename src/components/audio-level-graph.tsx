import { useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Polyline } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { LOUD_THRESHOLD_DBFS, QUIET_FLOOR_DBFS } from '@/lib/use-audio-monitor';

/**
 * How loud the car is, plotted.
 *
 * Two shapes for two jobs. `bars` is the live view — a strip chart of the last
 * stretch, where each reading is its own thing and the eye wants to land on the
 * newest one. `line` is the retrospective view for a finished drive, where the
 * question is the shape of the trip rather than any individual reading.
 *
 * The alert threshold is drawn across either one. It is also the calibration
 * instrument: the constant behind that line is a guess until someone sits in a
 * car and watches where conversation, the stereo, and shouting actually land.
 */

/** Beyond this the bars stop being distinguishable and start costing views. */
const MAX_BARS = 60;

/** A line carries more detail than bars before it turns to mush. */
const MAX_LINE_POINTS = 140;

/**
 * Collapses a long series into at most `limit` buckets, keeping the *loudest*
 * reading in each. Averaging would smooth away exactly what the graph exists to
 * show: a brief spell of shouting inside an otherwise quiet drive.
 */
function downsample(levels: number[], limit: number): number[] {
  if (levels.length <= limit) return levels;

  const bucketSize = levels.length / limit;
  const buckets: number[] = [];

  for (let i = 0; i < limit; i++) {
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
  variant = 'bars',
  height = 96,
  threshold = LOUD_THRESHOLD_DBFS,
  floor = QUIET_FLOOR_DBFS,
  emptyMessage = 'Listening…',
}: {
  /** dBFS readings, oldest first. Downsampled internally when long. */
  levels: number[];
  variant?: 'bars' | 'line';
  height?: number;
  threshold?: number;
  floor?: number;
  emptyMessage?: string;
}) {
  const theme = useTheme();

  const levels = useMemo(
    () => downsample(raw, variant === 'line' ? MAX_LINE_POINTS : MAX_BARS),
    [raw, variant]
  );

  /** dBFS to a 0–1 height in the plot, clamped to the visible window. */
  const positionOf = (dbfs: number) => Math.max(0, Math.min(1, (dbfs - floor) / (0 - floor)));

  const thresholdPosition = positionOf(threshold);

  if (levels.length === 0) {
    return (
      <View
        style={[
          styles.container,
          styles.empty,
          { height, backgroundColor: theme.backgroundSelected, borderColor: theme.border },
        ]}>
        <ThemedText type="small" themeColor="textSecondary">
          {emptyMessage}
        </ThemedText>
      </View>
    );
  }

  if (variant === 'line') {
    return (
      <LineGraph
        levels={levels}
        height={height}
        positionOf={positionOf}
        thresholdPosition={thresholdPosition}
      />
    );
  }

  return (
    <View
      style={[
        styles.container,
        { height, backgroundColor: theme.backgroundSelected, borderColor: theme.border },
      ]}>
      <View
        style={[
          styles.threshold,
          { bottom: `${thresholdPosition * 100}%`, backgroundColor: theme.warning },
        ]}
      />

      <View style={styles.bars}>
        {levels.map((level, index) => (
          <View
            key={index}
            style={[
              styles.bar,
              {
                height: `${Math.max(2, positionOf(level) * 100)}%`,
                backgroundColor: level >= threshold ? theme.warning : theme.tint,
                // Older samples fade, so the eye lands on what is happening now.
                opacity: 0.35 + (index / Math.max(1, levels.length - 1)) * 0.65,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * The line shape. Measured rather than drawn in a scaled viewBox, because
 * stretching a viewBox to fit would stretch the stroke with it and leave the
 * line thicker at one end than the other.
 */
function LineGraph({
  levels,
  height,
  positionOf,
  thresholdPosition,
}: {
  levels: number[];
  height: number;
  positionOf: (dbfs: number) => number;
  thresholdPosition: number;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  function measure(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  // Inset so the stroke is not clipped in half at the top and bottom edges.
  const inset = 3;
  const plotHeight = height - inset * 2;
  const yOf = (level: number) => inset + (1 - positionOf(level)) * plotHeight;

  const points = levels
    .map((level, index) => {
      const x = levels.length === 1 ? width / 2 : (index / (levels.length - 1)) * width;
      return `${x.toFixed(1)},${yOf(level).toFixed(1)}`;
    })
    .join(' ');

  const thresholdY = inset + (1 - thresholdPosition) * plotHeight;

  return (
    <View
      onLayout={measure}
      style={[
        styles.container,
        { height, backgroundColor: theme.backgroundSelected, borderColor: theme.border },
      ]}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Line
            x1={0}
            y1={thresholdY}
            x2={width}
            y2={thresholdY}
            stroke={theme.warning}
            strokeWidth={1}
            strokeDasharray="5 4"
            opacity={0.9}
          />
          <Polyline
            points={points}
            fill="none"
            stroke={theme.tint}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </Svg>
      ) : null}
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
