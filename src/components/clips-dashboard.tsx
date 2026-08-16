import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ClipPlayer } from '@/components/clip-player';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { QueryState } from '@/components/ui/query-state';
import { Screen } from '@/components/ui/screen';
import { Stat, StatRow } from '@/components/ui/stat';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { listRecentClips } from '@/lib/clips';
import { formatWhen } from '@/lib/format';
import { useAsync } from '@/lib/use-async';
import type { FamilyClip } from '@/types/drive';

/**
 * Every saved dashcam clip, for whoever is looking.
 *
 * One component for both interfaces: row-level security already decides what
 * comes back, so a driver sees their own clips and a parent sees the family's
 * without either screen having to know the difference. Only the wording changes.
 *
 * One player is mounted at a time. Video views are expensive, and a list that
 * spun up a decoder per row would stutter on exactly the phones this app is
 * meant to run on.
 */
export function ClipsDashboard({ role }: { role: 'parent' | 'child' }) {
  const theme = useTheme();
  const router = useRouter();

  const clips = useAsync(() => listRecentClips(), []);
  const [openClipId, setOpenClipId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void clips.reload();
      // Refetching on focus is the point; re-arming on identity changes is not.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const list = useMemo(() => clips.data ?? [], [clips.data]);

  const totals = useMemo(() => {
    const bytes = list.reduce(
      (sum, clip) => sum + clip.parts.reduce((inner, part) => inner + part.bytes, 0),
      0
    );

    return {
      count: list.length,
      automatic: list.filter((clip) => clip.reason === 'loud_audio').length,
      megabytes: bytes / (1024 * 1024),
    };
  }, [list]);

  return (
    <Screen
      title="Clips"
      subtitle={
        role === 'parent'
          ? 'Everything your drivers chose to keep, and everything DriveSafe kept for them.'
          : 'The moments you kept, and the ones DriveSafe kept when it got loud.'
      }>
      <QueryState
        isLoading={clips.isLoading}
        error={clips.error}
        isEmpty={!clips.isLoading && list.length === 0}
        emptyMessage={
          role === 'parent'
            ? 'No clips yet. They appear here when a driver saves one, or when DriveSafe keeps one automatically.'
            : 'No clips yet. Turn the dashcam on in your profile, then tap Save that during a drive.'
        }
      />

      {list.length > 0 ? (
        <Card>
          <StatRow>
            <Stat label="Clips" value={`${totals.count}`} />
            <Stat label="Kept automatically" value={`${totals.automatic}`} />
            <Stat label="Storage" value={totals.megabytes.toFixed(1)} unit="MB" />
          </StatRow>
        </Card>
      ) : null}

      {list.map((clip) => (
        <ClipRow
          key={clip.id}
          clip={clip}
          role={role}
          isOpen={openClipId === clip.id}
          onToggle={() => setOpenClipId((current) => (current === clip.id ? null : clip.id))}
          onOpenDrive={() =>
            router.push({ pathname: '/drive/[id]', params: { id: clip.driveId } })
          }
          accent={clip.reason === 'loud_audio' ? theme.warning : theme.tint}
        />
      ))}
    </Screen>
  );
}

function ClipRow({
  clip,
  role,
  isOpen,
  onToggle,
  onOpenDrive,
  accent,
}: {
  clip: FamilyClip;
  role: 'parent' | 'child';
  isOpen: boolean;
  onToggle: () => void;
  onOpenDrive: () => void;
  accent: string;
}) {
  const theme = useTheme();

  const megabytes =
    clip.parts.reduce((sum, part) => sum + part.bytes, 0) / (1024 * 1024);


  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        onPress={onToggle}
        style={styles.header}>
        <View style={[styles.dot, { backgroundColor: accent }]} />

        <View style={styles.headerText}>
          <ThemedText type="smallBold">
            {clip.reason === 'loud_audio' ? 'Kept automatically — loud' : 'Saved during the drive'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {role === 'parent' ? `${clip.driverName} · ` : ''}
            {formatWhen(clip.recordedAt)}
          </ThemedText>
        </View>

        <ThemedText type="small" themeColor="textSecondary">
          {isOpen ? 'Hide' : 'Watch'}
        </ThemedText>
      </Pressable>

      {isOpen ? <ClipPlayer clip={clip} /> : null}

      <View style={[styles.details, { borderTopColor: theme.border }]}>
        <Detail label="Length" value={`${Math.round(clip.durationSeconds)}s`} />
        <Detail label="Size" value={`${megabytes.toFixed(1)} MB`} />
        <Detail label="Parts" value={`${clip.parts.length}`} />
        <Detail label="Sound" value={clip.hasAudio ? 'Included' : 'Video only'} />
      </View>

      <Button label="Open the drive" variant="secondary" onPress={onOpenDrive} />
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="small">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headerText: {
    flex: 1,
    gap: Spacing.half,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: Radius.pill,
  },
  details: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  detail: {
    gap: Spacing.half,
    minWidth: 64,
  },
});
