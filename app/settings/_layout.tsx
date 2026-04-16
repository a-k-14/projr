import { Stack } from 'expo-router';
import { HOME_TEXT } from '../../lib/layoutTokens';

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerTitleStyle: {
          fontSize: HOME_TEXT.rowLabel,
          fontWeight: '700',
        },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="accounts" options={{ title: 'Accounts' }} />
      <Stack.Screen name="account-form" options={{ title: 'Account' }} />
      <Stack.Screen name="categories" options={{ title: 'Categories' }} />
      <Stack.Screen name="category-form" options={{ title: 'Category' }} />
      <Stack.Screen name="tags" options={{ title: 'Tags' }} />
      <Stack.Screen name="tag-form" options={{ title: 'Tag' }} />
    </Stack>
  );
}
