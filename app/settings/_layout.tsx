import { Stack } from 'expo-router';

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: '700',
        },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="year-start" options={{ presentation: 'transparentModal', headerShown: false }} />
      <Stack.Screen name="default-account" options={{ presentation: 'transparentModal', headerShown: false }} />
      <Stack.Screen name="currency" options={{ presentation: 'transparentModal', headerShown: false }} />
      <Stack.Screen name="theme" options={{ presentation: 'transparentModal', headerShown: false }} />
      <Stack.Screen name="accounts" options={{ title: 'Accounts' }} />
      <Stack.Screen name="categories" options={{ title: 'Categories' }} />
      <Stack.Screen name="tags" options={{ title: 'Tags' }} />
    </Stack>
  );
}
