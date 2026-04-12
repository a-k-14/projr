import { Link, Stack } from 'expo-router';
import { View, Text } from 'react-native';
import { APP_BRAND } from '../lib/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <Text style={{ fontSize: 20, fontWeight: '600', marginBottom: 12 }}>
          This screen doesn't exist.
        </Text>
        <Link href="/">
          <Text style={{ color: APP_BRAND, fontSize: 15 }}>Go to home screen</Text>
        </Link>
      </View>
    </>
  );
}
