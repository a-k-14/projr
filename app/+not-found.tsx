import { Link, Stack } from 'expo-router';
import { Text } from '@/components/ui/AppText';
import { View } from 'react-native';
import { APP_BRAND } from '../lib/theme';
import { FONT_WEIGHT } from '../lib/design';
import { HOME_TEXT } from '../lib/layoutTokens';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: FONT_WEIGHT.semibold, marginBottom: 12 }}>
          This screen doesn't exist.
        </Text>
        <Link href="/">
          <Text style={{ color: APP_BRAND, fontSize: HOME_TEXT.sectionTitle }}>Go to home screen</Text>
        </Link>
      </View>
    </>
  );
}
