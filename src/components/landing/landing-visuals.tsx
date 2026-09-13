import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';

import { Landing } from './landing-tokens';

/**
 * The pictures on the landing page.
 *
 * Every one is a small, honest rendering of a screen that exists in the app —
 * the same numbers, the same layout, the same green. Stock illustration and
 * abstract shapes would have been faster and would have said nothing; a person
 * deciding whether to trust this with their family's location wants to see what
 * they are actually getting.
 *
 * Drawn rather than screenshotted so they stay sharp at any width and do not go
 * stale the next time a screen is touched.
 */

/** Shared chrome: a device-ish panel with a hairline and a soft lift. */
function Panel({
  children,
  label,
  style,
}: {
  children: React.ReactNode;
  label?: string;
  style?: object;
}) {
  return (
    <View style={[styles.panel, style]}>
      {label ? (
        <View style={styles.panelBar}>
          <ThemedText style={styles.panelLabel}>{label}</ThemedText>
        </View>
      ) : null}
      <View style={styles.panelBody}>{children}</View>
    </View>
  );
}

/**
 * The parent's live view: a route on a map, the driver on it, the numbers
 * underneath.
 */
export function LiveDriveVisual() {
  return (
    <Panel label="Live · Nico is driving">
      <View style={styles.mapFrame}>
        <Svg width="100%" height="100%" viewBox="0 0 420 240">
          {/* Blocks, to read as a town rather than an abstract field. */}
          <Rect x="0" y="0" width="420" height="240" fill={Landing.mapGround} />
          {[
            [18, 22, 92, 54],
            [132, 14, 78, 44],
            [232, 30, 104, 48],
            [22, 112, 70, 62],
            [120, 128, 96, 40],
            [250, 128, 88, 66],
            [352, 96, 54, 96],
          ].map(([x, y, w, h], index) => (
            <Rect
              key={index}
              x={x}
              y={y}
              width={w}
              height={h}
              rx="3"
              fill={Landing.mapBlock}
            />
          ))}

          {/* Roads. */}
          <Line x1="0" y1="92" x2="420" y2="92" stroke={Landing.mapRoad} strokeWidth="7" />
          <Line x1="0" y1="196" x2="420" y2="196" stroke={Landing.mapRoad} strokeWidth="5" />
          <Line x1="116" y1="0" x2="116" y2="240" stroke={Landing.mapRoad} strokeWidth="5" />
          <Line x1="240" y1="0" x2="240" y2="240" stroke={Landing.mapRoad} strokeWidth="6" />

          {/* The recorded trace. */}
          <Polyline
            points="24,206 96,206 116,196 116,120 158,92 240,92 268,74 342,74"
            fill="none"
            stroke={Landing.accent}
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx="24" cy="206" r="6" fill={Landing.paper} stroke={Landing.accent} strokeWidth="3" />
          <Circle cx="342" cy="74" r="9" fill={Landing.accent} />
          <Circle cx="342" cy="74" r="16" fill={Landing.accent} opacity="0.22" />
        </Svg>
      </View>

      <View style={styles.statRow}>
        <Stat value="34" unit="mph" label="Now" />
        <Stat value="4.2" unit="mi" label="Distance" />
        <Stat value="11:04" label="Elapsed" />
      </View>
    </Panel>
  );
}

/** The score, as the drive detail screen shows it. */
export function ScoreVisual() {
  return (
    <Panel label="Drive · Tuesday, 4:12 pm">
      <View style={styles.scoreRow}>
        <View style={styles.scoreDial}>
          <Svg width="104" height="104" viewBox="0 0 104 104">
            <Circle cx="52" cy="52" r="44" stroke={Landing.line} strokeWidth="8" fill="none" />
            <Circle
              cx="52"
              cy="52"
              r="44"
              stroke={Landing.accent}
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              // 94 of 100, drawn from the top.
              strokeDasharray={`${2 * Math.PI * 44 * 0.94} ${2 * Math.PI * 44}`}
              transform="rotate(-90 52 52)"
            />
          </Svg>
          <View style={styles.scoreCentre}>
            <ThemedText style={styles.scoreNumber}>94</ThemedText>
          </View>
        </View>

        <View style={styles.scoreLines}>
          <ScoreLine label="Speeding" detail="38 s over on Novato Blvd" cost="−4" />
          <ScoreLine label="Cabin noise" detail="One flag, 8 minutes in" cost="−2" />
          <ScoreLine label="Everything else" detail="Nothing flagged" cost="0" muted />
        </View>
      </View>
    </Panel>
  );
}

/** The noise graph, at the shape a real drive produces. */
export function NoiseVisual() {
  // One loud spell in an otherwise ordinary drive — the thing the feature is for.
  const bars = [
    18, 22, 19, 24, 21, 26, 23, 20, 25, 22, 28, 24, 21, 27, 23, 26, 22, 29, 25, 23, 58, 74, 81, 77,
    69, 46, 28, 24, 27, 22, 25, 21, 26, 23, 20, 24, 22, 27, 23, 21,
  ];

  return (
    <Panel label="Cabin noise · last 20 seconds">
      <View style={styles.noiseFrame}>
        <Svg width="100%" height="100%" viewBox="0 0 420 132">
          {/* The alert line. Bars that reach it start the warning. */}
          <Line
            x1="0"
            y1="42"
            x2="420"
            y2="42"
            stroke={Landing.warning}
            strokeWidth="1.5"
            strokeDasharray="5 4"
          />
          {bars.map((value, index) => {
            const height = (value / 100) * 118;
            return (
              <Rect
                key={index}
                x={index * 10.5 + 1.5}
                y={124 - height}
                width="7"
                height={height}
                rx="2"
                fill={value >= 58 ? Landing.warning : Landing.accent}
                opacity={0.45 + (index / bars.length) * 0.55}
              />
            );
          })}
        </Svg>
      </View>

      <ThemedText style={styles.caption}>
        Loudness only. The microphone is read as a meter and the reading is the only thing that
        leaves the phone.
      </ThemedText>
    </Panel>
  );
}

/** A saved clip, with the transport the player actually uses. */
export function ClipVisual() {
  return (
    <Panel label="Clip · kept automatically">
      <View style={styles.clipFrame}>
        <Svg width="100%" height="100%" viewBox="0 0 420 200">
          <Rect x="0" y="0" width="420" height="200" fill="#0A0F0C" />
          {/* A road at dusk, suggested rather than drawn. */}
          <Rect x="0" y="0" width="420" height="96" fill="#16241C" />
          <Path d="M0 200 L172 96 L248 96 L420 200 Z" fill="#1E2E24" />
          <Line
            x1="210"
            y1="104"
            x2="210"
            y2="200"
            stroke="#3C5446"
            strokeWidth="4"
            strokeDasharray="14 16"
          />
          <Rect x="286" y="74" width="58" height="26" rx="4" fill="#22352A" />
          <Circle cx="120" cy="60" r="16" fill="#24382C" />
        </Svg>
      </View>

      <View style={styles.transport}>
        <View style={styles.playButton}>
          <ThemedText style={styles.playGlyph}>▶</ThemedText>
        </View>
        <View style={styles.trackColumn}>
          <View style={styles.track}>
            <View style={styles.trackFill} />
          </View>
          <View style={styles.trackTimes}>
            <ThemedText style={styles.timecode}>0:07</ThemedText>
            <ThemedText style={styles.timecode}>0:20</ThemedText>
          </View>
        </View>
      </View>
    </Panel>
  );
}

function Stat({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statValueRow}>
        <ThemedText style={styles.statValue}>{value}</ThemedText>
        {unit ? <ThemedText style={styles.statUnit}>{unit}</ThemedText> : null}
      </View>
      <ThemedText style={styles.statLabel}>{label}</ThemedText>
    </View>
  );
}

function ScoreLine({
  label,
  detail,
  cost,
  muted = false,
}: {
  label: string;
  detail: string;
  cost: string;
  muted?: boolean;
}) {
  return (
    <View style={styles.scoreLine}>
      <View style={styles.scoreLineText}>
        <ThemedText style={styles.scoreLineLabel}>{label}</ThemedText>
        <ThemedText style={styles.scoreLineDetail}>{detail}</ThemedText>
      </View>
      <ThemedText style={[styles.scoreLineCost, muted && styles.scoreLineCostMuted]}>
        {cost}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: Landing.paper,
    borderRadius: Radius.large,
    borderWidth: 1,
    borderColor: Landing.line,
    overflow: 'hidden',
    // A single soft lift, not a glow. Enough to sit above the page.
    boxShadow: '0 24px 60px -32px rgba(11, 29, 19, 0.45)',
  },
  panelBar: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: Landing.line,
    backgroundColor: Landing.paperAlt,
  },
  panelLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Landing.textMuted,
  },
  panelBody: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  mapFrame: {
    height: 240,
    borderRadius: Radius.medium,
    overflow: 'hidden',
    backgroundColor: Landing.mapGround,
  },
  statRow: {
    flexDirection: 'row',
    gap: Spacing.four,
  },
  stat: {
    gap: 2,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  statValue: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    color: Landing.text,
    letterSpacing: -0.4,
  },
  statUnit: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: Landing.textMuted,
  },
  statLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: Landing.textMuted,
    letterSpacing: 0.3,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
  },
  scoreDial: {
    width: 104,
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreCentre: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    color: Landing.text,
    letterSpacing: -1,
  },
  scoreLines: {
    flex: 1,
    gap: Spacing.two,
  },
  scoreLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  scoreLineText: {
    flex: 1,
    gap: 1,
  },
  scoreLineLabel: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
    color: Landing.text,
  },
  scoreLineDetail: {
    fontSize: 13,
    lineHeight: 18,
    color: Landing.textMuted,
  },
  scoreLineCost: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: Landing.warning,
    fontVariant: ['tabular-nums'],
  },
  scoreLineCostMuted: {
    color: Landing.textMuted,
  },
  noiseFrame: {
    height: 132,
  },
  caption: {
    fontSize: 13,
    lineHeight: 19,
    color: Landing.textMuted,
  },
  clipFrame: {
    height: 200,
    borderRadius: Radius.medium,
    overflow: 'hidden',
    backgroundColor: '#0A0F0C',
  },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  playButton: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    backgroundColor: Landing.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playGlyph: {
    fontSize: 13,
    lineHeight: 18,
    color: '#FFFFFF',
  },
  trackColumn: {
    flex: 1,
    gap: 4,
  },
  track: {
    height: 6,
    borderRadius: Radius.pill,
    backgroundColor: Landing.line,
    overflow: 'hidden',
  },
  trackFill: {
    width: '35%',
    height: '100%',
    borderRadius: Radius.pill,
    backgroundColor: Landing.accent,
  },
  trackTimes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timecode: {
    fontSize: 12,
    lineHeight: 16,
    color: Landing.textMuted,
    fontVariant: ['tabular-nums'],
  },
});
