import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ScoreBadge } from '@/components/ui/score-badge';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration, formatMiles, formatMph, formatWhen } from '@/lib/format';
import type { Drive } from '@/types/drive';

/** One completed drive, tappable through to the detail screen. Shared by both interfaces. */
export function DriveListItem({ drive, showDriver = false }: { drive: Drive; showDriver?: boolean }) {
  const theme = useTheme();
  const duration = drive.endedAt ? drive.endedAt - drive.startedAt : 0;

  return (
    <Link href={{ pathname: '/drive/[id]', params: { id: drive.id } }} asChild>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.item,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: pressed ? theme.tint : theme.border,
          },
        ]}>
        <View style={styles.topRow}>
          <View style={styles.titleBlock}>
            <ThemedText type="smallBold">
              {showDriver ? `${drive.driverName} · ` : ''}
              {formatWhen(drive.startedAt)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatMiles(drive.distanceMeters)} mi · {formatDuration(duration)} · top{' '}
              {formatMph(drive.topSpeed)} mph
            </ThemedText>
          </View>
          <ScoreBadge score={drive.safetyScore} showLabel={false} />
        </View>

        {drive.events.length > 0 ? (
          <ThemedText type="small" style={{ color: theme.warning }}>
            {drive.events.length} event{drive.events.length === 1 ? '' : 's'} flagged
          </ThemedText>
        ) : (
          <ThemedText type="small" style={{ color: theme.success }}>
            No events flagged
          </ThemedText>
        )}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  item: {
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  titleBlock: {
    flex: 1,
    gap: Spacing.half,
  },
});
