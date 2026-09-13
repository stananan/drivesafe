import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { downloadFile } from '@/lib/download';
import type { DriveClip } from '@/types/drive';

/** Fast enough that the scrubber tracks the video rather than lagging behind it. */
const TICK_MS = 250;

/** Seconds as m:ss. Clips are short; hours would be noise. */
function timecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';

  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/**
 * Plays one dashcam clip, with the controls under it rather than over it.
 *
 * Native controls sit on top of the picture and fade away, which is the wrong
 * trade for footage someone is studying: the moment worth looking at is often
 * the moment the controls are covering. So the transport lives below the video,
 * always visible, and never moves.
 *
 * A clip is several files when the recording spanned a segment boundary. The
 * parts play in order and the scrubber covers whichever part is on screen.
 */
export function ClipPlayer({ clip }: { clip: DriveClip }) {
  const theme = useTheme();
  const [partIndex, setPartIndex] = useState(0);

  const playable = clip.parts.filter((part) => part.url !== null);
  const current = playable[partIndex];

  const player = useVideoPlayer(current?.url ?? null, (instance) => {
    instance.loop = false;
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [trackWidth, setTrackWidth] = useState(0);
  const trackRef = useRef<View | null>(null);
  const trackLeft = useRef(0);

  // Polled rather than subscribed. The player exposes these as plain properties,
  // and a quarter-second tick is both simpler than wiring several listeners and
  // precise enough to scrub a twenty-second clip.
  useEffect(() => {
    const timer = setInterval(() => {
      // Both read NaN before the media has loaded its metadata. Letting that
      // through would put a NaN into the progress bar's width as well as into
      // any later seek.
      const finite = (value: number | undefined) => (Number.isFinite(value) ? (value as number) : 0);

      setIsPlaying(player.playing);
      setPosition(finite(player.currentTime));
      setDuration(finite(player.duration));
    }, TICK_MS);

    return () => clearInterval(timer);
  }, [player]);

  // Advance through the parts as each one ends.
  useEffect(() => {
    const subscription = player.addListener('playToEnd', () => {
      setPartIndex((index) => (index + 1 < playable.length ? index + 1 : index));
    });

    return () => subscription.remove();
  }, [player, playable.length]);

  function togglePlay() {
    // Read the state before acting on it. `playing` is not guaranteed to have
    // flipped by the time play() or pause() returns, so deriving the new value
    // from it afterwards can leave the button showing the wrong glyph until the
    // next tick corrects it.
    const wasPlaying = player.playing;

    if (wasPlaying) player.pause();
    else player.play();

    setIsPlaying(!wasPlaying);
  }

  /**
   * Where along the bar the press landed.
   *
   * The three sources are not interchangeable and not all present everywhere.
   * `locationX` is the React Native one and is undefined under react-native-web,
   * which is what made this divide by nothing and hand the player a NaN —
   * setting currentTime to a non-finite number throws outright. `offsetX` is the
   * DOM equivalent. `pageX` exists on both but is measured from the window, so
   * it only means something once the bar's own position is subtracted.
   */
  function pressOffset(event: GestureResponderEvent): number | null {
    const native = event.nativeEvent as unknown as {
      locationX?: number;
      offsetX?: number;
      pageX?: number;
    };

    if (Number.isFinite(native.locationX)) return native.locationX as number;
    if (Number.isFinite(native.offsetX)) return native.offsetX as number;
    if (Number.isFinite(native.pageX)) return (native.pageX as number) - trackLeft.current;

    return null;
  }

  function seekTo(event: GestureResponderEvent) {
    if (trackWidth <= 0 || !Number.isFinite(duration) || duration <= 0) return;

    const offset = pressOffset(event);
    if (offset === null) return;

    const fraction = Math.max(0, Math.min(1, offset / trackWidth));
    if (!Number.isFinite(fraction)) return;

    const target = fraction * duration;
    if (!Number.isFinite(target)) return;

    player.currentTime = target;
    setPosition(target);
  }

  function measureTrack(event: LayoutChangeEvent) {
    setTrackWidth(event.nativeEvent.layout.width);

    // Kept for the pageX fallback, which needs the bar's position in the window
    // rather than its size.
    trackRef.current?.measureInWindow((x) => {
      trackLeft.current = x;
    });
  }

  if (playable.length === 0) {
    return (
      <View style={[styles.unavailable, { borderColor: theme.border }]}>
        <ThemedText type="small" themeColor="textSecondary">
          This clip could not be loaded. It may still be uploading from the driver&apos;s phone.
        </ThemedText>
      </View>
    );
  }

  const progress = duration > 0 ? Math.min(1, position / duration) : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.video}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          // `cover` filled the box by cropping, which on a wide card threw away
          // most of the frame — the whole point of a dashcam clip is what is at
          // the edges of it. `contain` letterboxes instead, so nothing is lost.
          contentFit="contain"
          nativeControls={false}
        />
      </View>

      <View style={styles.transport}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          onPress={togglePlay}
          hitSlop={8}
          style={({ pressed }) => [
            styles.playButton,
            { backgroundColor: theme.tint, opacity: pressed ? 0.85 : 1 },
          ]}>
          <ThemedText style={[styles.playGlyph, { color: theme.onTint }]}>
            {isPlaying ? '❚❚' : '▶'}
          </ThemedText>
        </Pressable>

        <View style={styles.trackColumn}>
          <Pressable ref={trackRef} onPress={seekTo} onLayout={measureTrack} style={styles.trackHit}>
            <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
              <View
                style={[
                  styles.played,
                  { width: `${progress * 100}%`, backgroundColor: theme.tint },
                ]}
              />
            </View>
          </Pressable>

          <View style={styles.times}>
            <ThemedText type="small" themeColor="textSecondary">
              {timecode(position)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {timecode(duration)}
            </ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        {playable.length > 1 ? (
          <View style={styles.parts}>
            <ThemedText type="small" themeColor="textSecondary">
              Part {partIndex + 1} of {playable.length}
            </ThemedText>
            {partIndex > 0 ? (
              <Button
                label="Restart"
                variant="secondary"
                onPress={() => setPartIndex(0)}
                style={styles.smallButton}
              />
            ) : null}
          </View>
        ) : (
          <View />
        )}

        {current?.downloadUrl ? (
          <Button
            label={playable.length > 1 ? 'Download this part' : 'Download'}
            variant="secondary"
            onPress={() => void downloadFile(current.downloadUrl as string)}
            style={styles.smallButton}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
  },
  video: {
    // Sized by the card rather than pinned to 200px. A fixed height made a 4:1
    // slot out of an 800px-wide card, which is not a shape any video is.
    //
    // Horizontal on both platforms, deliberately. A phone could show portrait
    // footage upright and fill more of its screen, but a clip is watched on the
    // dashboard as often as on the phone, and one shape means a clip looks the
    // same wherever it is opened. Letterboxing is the price and it is worth it.
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: Radius.medium,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  unavailable: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.medium,
    padding: Spacing.three,
  },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playGlyph: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  trackColumn: {
    flex: 1,
    gap: Spacing.half,
  },
  // A six-pixel bar is hard to hit. The hit area is finger-sized; the bar drawn
  // inside it is not.
  trackHit: {
    paddingVertical: Spacing.two,
    justifyContent: 'center',
  },
  track: {
    height: 6,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  played: {
    height: '100%',
    borderRadius: Radius.pill,
  },
  times: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  parts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  smallButton: {
    minHeight: 38,
    paddingHorizontal: Spacing.three,
  },
});
