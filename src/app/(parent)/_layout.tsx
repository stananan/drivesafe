import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Icon, Label, NativeTabs, VectorIcon } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

/**
 * The parent's app answers three questions in order: where are they right now,
 * how have they been driving, and who is linked to me.
 */
export default function ParentLayout() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundSelected}
      labelStyle={{ color: colors.textSecondary }}>
      <NativeTabs.Trigger name="index">
        <Label>Live</Label>
        <Icon
          sf="location.fill"
          androidSrc={<VectorIcon family={MaterialIcons} name="my-location" />}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="drives">
        <Label>Drives</Label>
        <Icon
          sf="list.bullet.rectangle"
          androidSrc={<VectorIcon family={MaterialIcons} name="list-alt" />}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="clips">
        <Label>Clips</Label>
        <Icon sf="film.fill" androidSrc={<VectorIcon family={MaterialIcons} name="movie" />} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <Label>Settings</Label>
        <Icon
          sf="gearshape.fill"
          androidSrc={<VectorIcon family={MaterialIcons} name="settings" />}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
