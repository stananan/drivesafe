import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Icon, Label, NativeTabs, VectorIcon } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

/**
 * The driver's app is built around one button: start the drive. History and
 * profile sit behind it.
 *
 * iOS renders SF Symbols natively; Android has no equivalent name lookup, so it
 * gets the matching Material icon through `androidSrc`.
 */
export default function ChildLayout() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundSelected}
      labelStyle={{ color: colors.textSecondary }}>
      <NativeTabs.Trigger name="index">
        <Label>Drive</Label>
        <Icon
          sf="car.fill"
          androidSrc={<VectorIcon family={MaterialIcons} name="directions-car" />}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="map">
        <Label>Map</Label>
        <Icon sf="map.fill" androidSrc={<VectorIcon family={MaterialIcons} name="map" />} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="history">
        <Label>History</Label>
        <Icon
          sf="clock.arrow.circlepath"
          androidSrc={<VectorIcon family={MaterialIcons} name="history" />}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <Label>Profile</Label>
        <Icon
          sf="person.crop.circle"
          androidSrc={<VectorIcon family={MaterialIcons} name="person" />}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
