import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

// Static rendering has no window, so the server snapshot must be the light
// theme and the client has to re-resolve after hydration. `useSyncExternalStore`
// expresses exactly that with no effect and no cascading render.
const emptySubscribe = () => () => {};
const getHasHydrated = () => true;
const getHasHydratedOnServer = () => false;

/**
 * On web the color scheme is only trustworthy once we are on the client.
 * Until then, render the light theme so the markup matches what was prerendered.
 */
export function useColorScheme() {
  const hasHydrated = useSyncExternalStore(
    emptySubscribe,
    getHasHydrated,
    getHasHydratedOnServer
  );
  const colorScheme = useRNColorScheme();

  return hasHydrated ? colorScheme : 'light';
}
