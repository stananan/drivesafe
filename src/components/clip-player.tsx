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

/**
 * What shape to assume before the player reports one.
 *
 * Portrait, because the app is locked to portrait in `app.json`, so the camera
 * records upright and every clip in the system is taller than it is wide. This
 * is also the shape used everywhere `videoTrack` is unavailable, which includes
 * the web dashboard.
 */
const ASSUMED_ASPECT = 9 / 16;

/**
 * How tall an upright clip is allowed to be.
 *
 * Portrait footage stretched to the width of a dashboard card becomes a column
 * of video taller than the browser window, which is a worse way to watch it
 * than a small one. So an upright clip is sized by its height and left at its
 * natural width — a phone-shaped picture, the shape it was filmed in.
 */
const PORTRAIT_HEIGHT = 420;

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
  const [aspect, setAspect] = useState(ASSUMED_ASPECT);
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

      // The real shape of this particular clip, once the track has loaded.
      // Read here rather than through a listener because the tick is already
      // running, and it is null on web, where the assumed portrait stands.
      const size = player.videoTrack?.size;
      if (size && size.width > 0 && size.height > 0) {
        const measured = size.width / size.height;

        if (Number.isFinite(measured)) {
          // Compared before setting so a steady reading does not re-render the
          // player four times a second.
          setAspect((current) => (Math.abs(measured - current) > 0.01 ? measured : current));
        }
      }
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

  // Upright footage is sized by its height so it stays phone-shaped; a
  // landscape clip is sized by the width available to it. Either way the box
  // matches the picture, so there is nothing to letterbox.
  const isPortrait = aspect < 1;

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.video,
          isPortrait
            ? { height: PORTRAIT_HEIGHT, aspectRatio: aspect }
            : { width: '100%', aspectRatio: aspect },
        ]}>
        <VideoView
          player={player}
          // Explicit 100%/100% rather than StyleSheet.absoluteFill, which is
          // broken here on the web dashboard and only there.
          //
          // On web this component renders a plain <video> and hands the style
          // straight to the DOM. absoluteFill is left/right/top/bottom: 0 with
          // no width or height, and for a *replaced* element — video, img — CSS
          // resolves width:auto to the intrinsic width and then drops the
          // over-constrained `right`. So the element laid itself out at the
          // clip's full pixel size inside a much smaller box, and overflow:
          // hidden cropped the difference. Yoga stretches absoluteFill properly,
          // which is why the phone was always correct.
          style={styles.videoSurface}
          // `cover` filled the box by cropping, which threw away most of the
          // frame — the whole point of a dashcam clip is what is at the edges
          // of it. `contain` never crops, and it is also the safety net for a
          // clip whose real shape is not what was assumed.
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
    // No width or aspect here: both are decided per clip from the shape the
    // player reports, because the one thing worse than a letterboxed clip is a
    // clip forced into a box that is not its shape.
    //
    // Centred rather than stretched. Upright footage is narrow, and a narrow
    // picture pinned to the left of a wide dashboard card reads as broken
    // rather than deliberate.
    alignSelf: 'center',
    maxWidth: '100%',
    borderRadius: Radius.medium,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  // Fills the box above on both platforms. See the note at the call site for
  // why this cannot be StyleSheet.absoluteFill.
  videoSurface: {
    width: '100%',
    height: '100%',
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
