import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { DriveListItem } from '@/components/drive-list-item';
import { Card } from '@/components/ui/card';
import { QueryState } from '@/components/ui/query-state';
import { scoreColor } from '@/components/ui/score-badge';
import { Screen } from '@/components/ui/screen';
import { Stat, StatRow } from '@/components/ui/stat';
import { Spacing } from '@/constants/theme';
import { averageScore, listDrives, milesThisWeek } from '@/lib/drives';
import { useSession } from '@/lib/session';
import { useAsync } from '@/lib/use-async';

export default function ChildHistoryScreen() {
  const { profile } = useSession();
  const { data, error, isLoading, reload } = useAsync(() => listDrives(), [profile?.id]);

  // A drive recorded on the Drive tab should be here the moment they switch.
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );

  const drives = data ?? [];
  const score = averageScore(drives);

  return (
    <Screen title="Your drives" subtitle="Every trip you record, scored and saved.">
      {drives.length > 0 ? (
        <Card title="This week">
          <StatRow>
            <Stat label="Safety score" value={`${score}`} valueColor={scoreColor(score)} />
            <Stat label="Miles" value={milesThisWeek(drives).toFixed(0)} unit="mi" />
            <Stat label="Drives" value={`${drives.length}`} />
          </StatRow>
        </Card>
      ) : null}

      <QueryState
        isLoading={isLoading}
        error={error}
        isEmpty={drives.length === 0}
        emptyMessage="No drives yet. Record one from the Drive tab and it will show up here."
      />

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
