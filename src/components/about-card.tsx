import Constants from 'expo-constants';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Spacing } from '@/constants/theme';
import { isSupabaseConfigured } from '@/lib/supabase';

/** Credits and build info. Shown at the bottom of both Settings screens. */
export function AboutCard() {
  const version = Constants.expoConfig?.version ?? '0.1.0';

  return (
    <Card title="About DriveSafe">
      <View style={styles.rows}>
        <Row label="Built by" value="Stanley Ho & Nico Zametto" />
        <Row label="For" value="Congressional App Challenge" />
        <Row label="District" value="California District 2" />
        <Row label="Version" value={version} />
        <Row label="Cloud sync" value={isSupabaseConfigured ? 'Connected' : 'Not configured'} />
      </View>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="small">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  rows: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
