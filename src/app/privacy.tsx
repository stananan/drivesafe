import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { PrivacyContactEmail, PrivacyPolicySections, PrivacyPolicyUpdated } from '@/constants/privacy';
import { Spacing } from '@/constants/theme';

/**
 * The privacy policy, in the app.
 *
 * Rendered from `@/constants/privacy` rather than linking out, so it still
 * reads on a phone with no signal and cannot break if the hosted copy moves.
 */
export default function PrivacyScreen() {
  return (
    <Screen title="Privacy" subtitle={`Last updated ${PrivacyPolicyUpdated}.`}>
      {PrivacyPolicySections.map((section) => (
        <Card key={section.title} title={section.title}>
          <View style={styles.paragraphs}>
            {section.paragraphs.map((paragraph) => (
              <ThemedText key={paragraph} type="small" themeColor="textSecondary">
                {paragraph}
              </ThemedText>
            ))}
          </View>
        </Card>
      ))}

      <Card title="Contact">
        <ThemedText type="small" themeColor="textSecondary">
          Questions about your data, or want an account removed? Reach us at {PrivacyContactEmail}.
        </ThemedText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  paragraphs: {
    gap: Spacing.two,
  },
});
