import { Alert } from 'react-native';

/**
 * Asks a yes/no question, on whichever platform is asking.
 *
 * `Alert.alert` is a silent no-op in react-native-web. Not an error, not a
 * fallback dialog — nothing happens at all. Every confirmation in the app went
 * through it, so on the dashboard "Leave family" and "Delete account" were dead
 * buttons: click, and the page simply sat there.
 *
 * Resolves true when the destructive option was chosen.
 */
export function confirmAction(options: {
  title: string;
  message: string;
  /** The affirmative button. Name the action, not "OK". */
  confirmLabel: string;
  cancelLabel?: string;
}): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(options.title, options.message, [
      { text: options.cancelLabel ?? 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: options.confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

/** Tells the user something happened. No decision to make. */
export function notify(title: string, message?: string): void {
  Alert.alert(title, message);
}
