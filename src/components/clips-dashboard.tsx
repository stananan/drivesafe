import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ClipPlayer } from '@/components/clip-player';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { QueryState } from '@/components/ui/query-state';
import { Screen } from '@/components/ui/screen';
import { Stat, StatRow } from '@/components/ui/stat';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { deleteClip, listRecentClips, renameClip } from '@/lib/clips';
import { confirmAction, notify } from '@/lib/confirm';
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
      wide
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
          onChanged={() => void clips.reload()}
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
  onChanged,
  accent,
}: {
  clip: FamilyClip;
  role: 'parent' | 'child';
  isOpen: boolean;
  onToggle: () => void;
  onOpenDrive: () => void;
  onChanged: () => void;
  accent: string;
}) {
  const theme = useTheme();

  const [draftTitle, setDraftTitle] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const megabytes =
    clip.parts.reduce((sum, part) => sum + part.bytes, 0) / (1024 * 1024);

  const fallbackName =
    clip.reason === 'loud_audio' ? 'Kept automatically — loud' : 'Saved during the drive';

  async function commitRename() {
    if (draftTitle === null) return;

    const next = draftTitle;
    setDraftTitle(null);

    if (next.trim() === (clip.title ?? '')) return;

    setIsBusy(true);

    try {
      await renameClip(clip.id, next);
      onChanged();
    } catch (error) {
      notify('Could not rename', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setIsBusy(false);
    }
  }

  async function confirmDelete() {
    const ok = await confirmAction({
      title: 'Delete this clip?',
      message: 'The video is removed from your family and from storage. This cannot be undone.',
      confirmLabel: 'Delete',
    });

    if (!ok) return;

    setIsBusy(true);

    try {
      await deleteClip({ id: clip.id, driveId: clip.driveId, parts: clip.parts });
      onChanged();
    } catch (error) {
      notify('Could not delete', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setIsBusy(false);
    }
  }


  return (
    <Card>
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: accent }]} />

        <View style={styles.headerText}>
          {draftTitle !== null ? (
            <TextInput
              value={draftTitle}
              onChangeText={setDraftTitle}
              onBlur={() => void commitRename()}
              onSubmitEditing={() => void commitRename()}
              placeholder="Name this clip"
              placeholderTextColor={theme.textSecondary}
              autoFocus
              returnKeyType="done"
              maxLength={80}
              style={[styles.input, { borderColor: theme.tint, color: theme.text }]}
            />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityHint="Rename this clip"
              onPress={() => setDraftTitle(clip.title ?? '')}
              hitSlop={6}>
              <ThemedText type="smallBold">{clip.title ?? fallbackName}</ThemedText>
            </Pressable>
          )}

          <ThemedText type="small" themeColor="textSecondary">
            {role === 'parent' ? `${clip.driverName} · ` : ''}
            {formatWhen(clip.recordedAt)}
            {clip.title ? ` · ${fallbackName.toLowerCase()}` : ''}
          </ThemedText>
        </View>

        <Pressable accessibilityRole="button" onPress={onToggle} hitSlop={8}>
          <ThemedText type="small" style={{ color: theme.tint }}>
            {isOpen ? 'Hide' : 'Watch'}
          </ThemedText>
        </Pressable>
      </View>

      {isOpen ? <ClipPlayer clip={clip} /> : null}

      <View style={[styles.details, { borderTopColor: theme.border }]}>
        <Detail label="Length" value={`${Math.round(clip.durationSeconds)}s`} />
        <Detail label="Size" value={`${megabytes.toFixed(1)} MB`} />
        <Detail label="Parts" value={`${clip.parts.length}`} />
        <Detail label="Sound" value={clip.hasAudio ? 'Included' : 'Video only'} />
      </View>

      <View style={styles.actions}>
        <Button
          label="Open the drive"
          variant="secondary"
          onPress={onOpenDrive}
          style={styles.action}
        />
        <Button
          label="Delete"
          variant="danger"
          disabled={isBusy}
          onPress={() => void confirmDelete()}
          style={styles.action}
        />
      </View>
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
  // Sits where the title was, so renaming happens in place rather than in a
  // field somewhere else on the card.
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  action: {
    flex: 1,
  },
});
