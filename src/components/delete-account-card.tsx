import { useState } from 'react';
import { Alert } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useSession } from '@/lib/session';

/**
 * In-app account deletion, required by App Store Review guideline 5.1.1(v).
 *
 * Shown on both settings surfaces. The copy changes with role because deleting
 * a parent account takes the whole family with it, which is a bigger thing to
 * do by accident than one driver leaving.
 */
export function DeleteAccountCard() {
  const { profile, deleteAccount } = useSession();
  const [isDeleting, setIsDeleting] = useState(false);

  const consequences =
    profile?.role === 'parent'
      ? 'Deletes your account, your family, and every drive you recorded. Your drivers keep their own accounts and drives, but the family code stops working and they will need a new one.'
      : 'Deletes your account and every drive you have recorded, including their routes. Your family will no longer see any of it.';

  async function runDelete() {
    setIsDeleting(true);

    const { error } = await deleteAccount();

    // On success the session provider clears the session and the router leaves
    // for the auth screens, so there is nothing left here to put back.
    if (error) {
      setIsDeleting(false);
      Alert.alert('Could not delete account', error);
    }
  }

  function confirmDelete() {
    Alert.alert('Delete your account?', `${consequences}\n\nThis cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete forever', style: 'destructive', onPress: () => void runDelete() },
    ]);
  }

  return (
    <Card title="Delete account">
      <ThemedText type="small" themeColor="textSecondary">
        {consequences}
      </ThemedText>
      <Button label="Delete account" variant="danger" loading={isDeleting} onPress={confirmDelete} />
    </Card>
  );
}
