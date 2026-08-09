import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider, useSession } from '@/lib/session';

SplashScreen.preventAutoHideAsync();

/**
 * Holds the splash screen until the stored role has been read.
 *
 * This lives in the root layout rather than on the welcome screen because the
 * app can cold-start on any route — a deep link, or a reload while the teen is
 * three tabs deep. Hiding the splash from a single screen leaves every other
 * entry point stuck behind it.
 */
function SplashGate({ children }: { children: React.ReactNode }) {
  const { isLoading } = useSession();

  useEffect(() => {
    if (isLoading) return;

    SplashScreen.hideAsync().catch(() => {
      // Already hidden, or the splash module is unavailable — either is fine.
    });
  }, [isLoading]);

  // Render nothing behind the splash rather than flashing an empty frame.
  if (isLoading) return null;

  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <SessionProvider>
            <SplashGate>
              <StatusBar style="auto" />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(parent)" />
                <Stack.Screen name="(teen)" />
                <Stack.Screen
                  name="drive/[id]"
                  options={{ headerShown: true, title: 'Drive detail', presentation: 'card' }}
                />
              </Stack>
            </SplashGate>
          </SessionProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
