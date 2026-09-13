import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider, useSession } from '@/lib/session';

SplashScreen.preventAutoHideAsync();

/**
 * Holds the splash screen until the stored session has been resolved.
 *
 * This lives in the root layout rather than on one screen because the app can
 * cold-start on any route — a deep link, or a reload three tabs deep. Hiding the
 * splash from a single screen leaves every other entry point stuck behind it.
 */
function SplashGate({ children }: { children: React.ReactNode }) {
  const { isLoading } = useSession();

  useEffect(() => {
    if (isLoading) return;

    SplashScreen.hideAsync().catch(() => {
      // Already hidden, or the splash module is unavailable — either is fine.
    });
  }, [isLoading]);

  if (isLoading) return null;

  return <>{children}</>;
}

// SDK 57's expo-router no longer runs on @react-navigation, so the
// ThemeProvider that used to wrap everything has nothing left to theme — the
// app's own theme system covers every screen, and header colours come from
// screenOptions if they ever need to differ from the defaults.
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
          <SessionProvider>
            <SplashGate>
              <StatusBar style="auto" />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="family-setup" />
                <Stack.Screen name="(parent)" />
                <Stack.Screen name="(child)" />
                <Stack.Screen
                  name="drive/[id]"
                  options={{ headerShown: true, title: 'Drive detail', presentation: 'card' }}
                />
                <Stack.Screen
                  name="live/[id]"
                  options={{ headerShown: true, title: 'Live drive', presentation: 'card' }}
                />
                <Stack.Screen
                  name="privacy"
                  options={{ headerShown: true, title: 'Privacy policy', presentation: 'card' }}
                />
              </Stack>
            </SplashGate>
          </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
