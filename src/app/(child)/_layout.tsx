import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { useRouteGuard } from '@/lib/use-route-guard';

/**
 * The driver's app is built around one button: start the drive. History and
 * profile sit behind it.
 *
 * SDK 57 note: the old Icon/Label imports and the VectorIcon Android wiring
 * became compound components with `sf` (SF Symbol, iOS) and `md` (Material
 * glyph, Android) props on one element.
 */
export default function ChildLayout() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  // Signing out, deleting the account, or leaving the family all pull the
  // ground out from under these tabs. Without this they stay mounted over a
  // dead session.
  const redirect = useRouteGuard('child');
  if (redirect) return <Redirect href={redirect as never} />;

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundSelected}
      labelStyle={{ color: colors.textSecondary }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Drive</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="car.fill" md="directions_car" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="map">
        <NativeTabs.Trigger.Label>Map</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="map.fill" md="map" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="clips">
        <NativeTabs.Trigger.Label>Clips</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="film.fill" md="movie" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="history">
        <NativeTabs.Trigger.Label>History</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="clock.arrow.circlepath" md="history" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
