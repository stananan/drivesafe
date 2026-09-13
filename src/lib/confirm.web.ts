/**
 * The browser's version of the confirmation helpers.
 *
 * `Alert.alert` does nothing at all under react-native-web, so this uses the
 * browser's own dialogs instead. They are not pretty and they are not themed,
 * but they are modal, they block, and they work — which beats a Delete account
 * button that silently ignores you. A themed modal would be the nicer answer if
 * the dashboard ever grows more of these.
 */

export function confirmAction(options: {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
}): Promise<boolean> {
  // The browser dialog has no title bar of its own, so the title leads the body.
  return Promise.resolve(window.confirm(`${options.title}\n\n${options.message}`));
}

export function notify(title: string, message?: string): void {
  window.alert(message ? `${title}\n\n${message}` : title);
}
