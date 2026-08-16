import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { DriveClip } from '@/types/drive';

/**
 * Plays one dashcam clip.
 *
 * A clip is several files, because the camera records in segments and nothing
 * in an Expo app can join them. Rather than pretend otherwise, this plays the
 * parts in order and advances when one finishes — so it looks like one clip
 * with a small stutter at each seam, which is the honest version of what was
 * recorded.
 */
export function ClipPlayer({ clip }: { clip: DriveClip }) {
  const theme = useTheme();
  const [partIndex, setPartIndex] = useState(0);

  const playable = clip.parts.filter((part) => part.url !== null);
  const current = playable[partIndex];

  const player = useVideoPlayer(current?.url ?? null, (instance) => {
    instance.loop = false;
  });

  // Advance through the parts as each one ends.
  useEffect(() => {
    const subscription = player.addListener('playToEnd', () => {
      setPartIndex((index) => (index + 1 < playable.length ? index + 1 : index));
    });

    return () => subscription.remove();
  }, [player, playable.length]);

  if (playable.length === 0) {
    return (
      <View style={[styles.unavailable, { borderColor: theme.border }]}>
        <ThemedText type="small" themeColor="textSecondary">
          This clip could not be loaded. It may still be uploading from the driver&apos;s phone.
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.video}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls
          allowsFullscreen
        />
      </View>

      {playable.length > 1 ? (
        <View style={styles.partsRow}>
          <ThemedText type="small" themeColor="textSecondary">
            Part {partIndex + 1} of {playable.length}
          </ThemedText>
          {partIndex > 0 ? (
            <Button
              label="Restart"
              variant="secondary"
              onPress={() => setPartIndex(0)}
              style={styles.restart}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
  },
  video: {
    height: 200,
    borderRadius: Radius.medium,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  unavailable: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.medium,
    padding: Spacing.three,
  },
  partsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  restart: {
    minHeight: 36,
    paddingHorizontal: Spacing.three,
  },
});
