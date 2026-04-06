import { Link, Stack } from 'expo-router';
import { View, Text } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <Text style={{ fontSize: 20, fontWeight: '600', marginBottom: 12 }}>
          This screen doesn't exist.
        </Text>
        <Link href="/">
          <Text style={{ color: '#1B4332', fontSize: 15 }}>Go to home screen</Text>
        </Link>
      </View>
    </>
  );
}
