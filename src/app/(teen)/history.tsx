import { StyleSheet, View } from 'react-native';

import { DriveListItem } from '@/components/drive-list-item';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Stat, StatRow } from '@/components/ui/stat';
import { scoreColor } from '@/components/ui/score-badge';
import { Spacing } from '@/constants/theme';
import { listDrives, totalMilesThisWeek, weeklyScore } from '@/lib/demo-data';

export default function TeenHistoryScreen() {
  const drives = listDrives();
  const score = weeklyScore();

  return (
    <Screen title="Your drives" subtitle="Every trip you record, scored and saved.">
      <Card title="This week">
        <StatRow>
          <Stat label="Safety score" value={`${score}`} valueColor={scoreColor(score)} />
          <Stat label="Miles" value={totalMilesThisWeek().toFixed(0)} unit="mi" />
          <Stat label="Drives" value={`${drives.length}`} />
        </StatRow>
      </Card>

      <View style={styles.list}>
        {drives.map((drive) => (
          <DriveListItem key={drive.id} drive={drive} />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.two,
  },
});
