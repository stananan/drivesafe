import { StyleSheet, View } from 'react-native';

import { DriveListItem } from '@/components/drive-list-item';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { scoreColor } from '@/components/ui/score-badge';
import { Screen } from '@/components/ui/screen';
import { Stat, StatRow } from '@/components/ui/stat';
import { Spacing } from '@/constants/theme';
import { listDrives, totalMilesThisWeek, weeklyScore } from '@/lib/demo-data';

export default function ParentDrivesScreen() {
  const drives = listDrives();
  const score = weeklyScore();
  const flagged = drives.reduce((count, drive) => count + drive.events.length, 0);

  return (
    <Screen title="Drives" subtitle="Every completed trip, newest first.">
      <Card title="Last 7 days">
        <StatRow>
          <Stat label="Avg score" value={`${score}`} valueColor={scoreColor(score)} />
          <Stat label="Miles" value={totalMilesThisWeek().toFixed(0)} unit="mi" />
          <Stat label="Events" value={`${flagged}`} />
        </StatRow>
      </Card>

      {drives.length === 0 ? (
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            No drives yet. Once your driver records a trip it shows up here.
          </ThemedText>
        </Card>
      ) : (
        <View style={styles.list}>
          {drives.map((drive) => (
            <DriveListItem key={drive.id} drive={drive} showDriver />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.two,
  },
});
