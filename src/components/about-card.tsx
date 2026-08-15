import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spacing } from '@/constants/theme';
import { isSupabaseConfigured } from '@/lib/supabase';

/**
 * Credits and build info. Shown at the bottom of both Settings screens, which
 * is also what makes the privacy policy reachable from either interface — App
 * Review wants it linked inside the app, not only in the store listing.
 */
export function AboutCard() {
  const router = useRouter();
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

      <Button label="Privacy policy" variant="secondary" onPress={() => router.push('/privacy')} />
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
