import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AudioLevelGraph } from '@/components/audio-level-graph';
import { DriveRouteMap } from '@/components/drive-route-map';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { QueryState } from '@/components/ui/query-state';
import { ScoreBadge, scoreColor } from '@/components/ui/score-badge';
import { Screen } from '@/components/ui/screen';
import { Stat, StatRow } from '@/components/ui/stat';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getDrive } from '@/lib/drives';
import { formatDuration, formatMiles, formatMph, formatWhen } from '@/lib/format';
import { useAsync } from '@/lib/use-async';
import type { DriveEvent } from '@/types/drive';

const EVENT_LABELS: Record<DriveEvent['type'], string> = {
  speeding: 'Speeding',
  hard_brake: 'Hard brake',
  rapid_accel: 'Rapid acceleration',
  phone_distraction: 'Phone distraction',
  loud_audio: 'Loud in the car',
};

/** Shared by both interfaces — a parent and their driver see the same trip detail. */
export default function DriveDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: drive, error, isLoading } = useAsync(() => getDrive(id), [id]);

  if (isLoading || error || !drive) {
    return (
      <Screen title="Drive" subtitle="">
        <QueryState
          isLoading={isLoading}
          error={error}
          isEmpty={!isLoading && !drive}
          emptyMessage="This drive is no longer available, or it belongs to another family."
        />
      </Screen>
    );
  }

  const duration = drive.endedAt ? drive.endedAt - drive.startedAt : 0;

  return (
    <Screen title={formatWhen(drive.startedAt)} subtitle={`${drive.driverName}'s drive`}>
      <Card>
        <DriveRouteMap route={drive.route} height={240} />
        <StatRow>
          <Stat label="Distance" value={formatMiles(drive.distanceMeters)} unit="mi" />
          <Stat label="Duration" value={formatDuration(duration)} />
          <Stat label="Top speed" value={formatMph(drive.topSpeed)} unit="mph" />
        </StatRow>
        <StatRow>
          <Stat label="Avg speed" value={formatMph(drive.avgSpeed)} unit="mph" />
          <Stat
            label="Safety score"
            value={`${drive.safetyScore}`}
            valueColor={scoreColor(drive.safetyScore)}
          />
          <Stat label="GPS points" value={`${drive.route.length}`} />
        </StatRow>
      </Card>

      {drive.audioLevels.length > 0 ? (
        <Card title="Cabin noise" meta={`${drive.audioLevels.length} readings`}>
          <AudioLevelGraph levels={drive.audioLevels.map((sample) => sample.level)} height={120} />
          <ThemedText type="small" themeColor="textSecondary">
            How loud it was across the whole drive. The line is where DriveSafe warns the driver;
            bars reaching it are what cost points.
          </ThemedText>
        </Card>
      ) : null}

      <Card title="Events" meta={`${drive.events.length} flagged`}>
        {drive.events.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Clean drive — nothing flagged.
          </ThemedText>
        ) : (
          <View style={styles.events}>
            {drive.events.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </View>
        )}
      </Card>

      <Card title="Overall">
        <View style={styles.overall}>
          <ScoreBadge score={drive.safetyScore} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.overallText}>
            Scores start at 100 and drop for each flagged event, weighted by severity.
          </ThemedText>
        </View>
      </Card>
    </Screen>
  );
}

function EventRow({ event }: { event: DriveEvent }) {
  const theme = useTheme();

  return (
    <View style={styles.eventRow}>
      <View style={styles.eventText}>
        <ThemedText type="small" style={{ color: theme.warning }}>
          {EVENT_LABELS[event.type]}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {event.detail}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {new Date(event.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  events: {
    gap: Spacing.three,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  eventText: {
    flex: 1,
    gap: Spacing.half,
  },
  overall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  overallText: {
    flex: 1,
  },
});
