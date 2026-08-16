/**
 * Push alerts from a driver's phone to their parents'.
 *
 * There is no DriveSafe server, so the driver's device talks to Expo's push
 * service directly. That endpoint accepts an unauthenticated POST as long as
 * the recipient token is a real ExponentPushToken, which is exactly the shape
 * this app needs: a phone that just detected something sends to the phones that
 * asked to hear about it. Tokens live on `profiles.push_token`, and row-level
 * security means a driver can only ever read the tokens of their own family.
 *
 * Delivery caveat: Expo Go dropped remote push in SDK 53. Everything here is
 * correct and will deliver from a development or production build, but on Expo
 * Go `register()` fails and the app falls back to the in-app realtime alert.
 * See TODO.md.
 */

import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { requireSupabase } from '@/lib/supabase';

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

/** A parent with the app open should still see the banner, not just a badge. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Asks for permission, resolves this device's push token, and stores it.
 *
 * Returns null whenever push cannot work here — permission declined, running in
 * Expo Go, no EAS project id yet — because none of those are errors worth
 * interrupting a parent over. The feature simply degrades to in-app alerts.
 */
export async function registerForPushNotifications(userId: string): Promise<string | null> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('alerts', {
        name: 'Drive alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    const permission = existing.granted
      ? existing
      : await Notifications.requestPermissionsAsync();

    if (!permission.granted) return null;

    // Set once `eas init` has run. Without it Expo cannot mint a token, which
    // is the usual reason this returns null on a fresh checkout.
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

    if (!projectId) return null;

    const token = await Notifications.getExpoPushTokenAsync({ projectId });

    await storePushToken(userId, token.data);

    return token.data;
  } catch {
    // Simulators, Expo Go, and offline launches all land here. Push is a bonus
    // channel; failing to get one must never break the screen that asked.
    return null;
  }
}

/** Saves (or clears) the token on the caller's profile row. */
export async function storePushToken(userId: string, token: string | null): Promise<void> {
  const supabase = requireSupabase();

  await supabase.from('profiles').update({ push_token: token }).eq('id', userId);
}

/**
 * Raises a notification from this device, for this device.
 *
 * Unlike push, local notifications still work in Expo Go, so this is what makes
 * a parent's alert visible today while they have the app open on another tab.
 * It cannot reach a phone whose app is fully suspended — that is push's job.
 */
export async function presentLocalAlert(title: string, body: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    });
  } catch {
    // No permission, or a platform that refuses. The in-app banner still shows.
  }
}

type PushMessage = {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  priority: 'high';
  data: Record<string, unknown>;
};

/**
 * Sends a push to every parent in the family who has a token.
 *
 * Resolves to the number of messages accepted. Never throws: this is called
 * from the middle of a drive, where a failed notification is worth a warning in
 * the log and nothing more.
 */
export async function notifyFamilyParents(input: {
  familyId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<number> {
  try {
    const supabase = requireSupabase();

    const { data, error } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('family_id', input.familyId)
      .eq('role', 'parent')
      .not('push_token', 'is', null);

    if (error) throw new Error(error.message);

    const tokens = ((data ?? []) as { push_token: string | null }[])
      .map((row) => row.push_token)
      .filter((token): token is string => Boolean(token));

    if (tokens.length === 0) return 0;

    const messages: PushMessage[] = tokens.map((token) => ({
      to: token,
      title: input.title,
      body: input.body,
      sound: 'default',
      priority: 'high',
      data: input.data ?? {},
    }));

    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) throw new Error(`Expo push responded ${response.status}`);

    return messages.length;
  } catch (error) {
    console.warn(
      'Could not send parent notification:',
      error instanceof Error ? error.message : error
    );
    return 0;
  }
}
