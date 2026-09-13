import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { useRouteGuard } from '@/lib/use-route-guard';

/**
 * The parent's app answers three questions in order: where are they right now,
 * how have they been driving, and who is linked to me.
 *
 * SDK 57 note: the old Icon/Label imports and the VectorIcon Android wiring
 * became compound components with `sf` (SF Symbol, iOS) and `md` (Material
 * glyph, Android) props on one element.
 */
export default function ParentLayout() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  // Signing out, deleting the account, or leaving the family all pull the
  // ground out from under these tabs. Without this they stay mounted over a
  // dead session.
  const redirect = useRouteGuard('parent');
  if (redirect) return <Redirect href={redirect as never} />;

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundSelected}
      labelStyle={{ color: colors.textSecondary }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Live</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="location.fill" md="my_location" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="drives">
        <NativeTabs.Trigger.Label>Drives</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="list.bullet.rectangle" md="list_alt" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="clips">
        <NativeTabs.Trigger.Label>Clips</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="film.fill" md="movie" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape.fill" md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
