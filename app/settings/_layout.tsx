import { Feather } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { Text } from '@/components/ui/AppText';
import { TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SCREEN_GUTTER } from '../../lib/design';
import { SCREEN_HEADER } from '../../lib/layoutTokens';
import { useAppTheme } from '../../lib/theme';

export default function SettingsLayout() {
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <Stack
      screenOptions={{
        headerBackVisible: false,
        header: ({ options }) => (
          <View style={{ paddingTop: insets.top, backgroundColor: palette.background }}>
            <View
              style={{
                height: 52,
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: SCREEN_GUTTER,
              }}
            >
              <TouchableOpacity
                delayPressIn={0}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => router.back()}
                style={{ marginRight: SCREEN_HEADER.iconTitleGap }}
              >
                <Feather name="arrow-left" size={24} color={palette.text} />
              </TouchableOpacity>
              <Text style={{ flex: 1, fontSize: SCREEN_HEADER.titleSize, fontWeight: SCREEN_HEADER.titleWeight, color: palette.text }}>
                {options.title}
              </Text>
            </View>
          </View>
        ),
        headerShadowVisible: false,
        headerStyle: { backgroundColor: palette.background },
      }}
    >
      <Stack.Screen name="accounts" options={{ title: 'Accounts' }} />
      <Stack.Screen
        name="account-form"
        options={({ route }) => ({
          title: (route.params as { id?: string } | undefined)?.id ? 'Edit Account' : 'New Account',
        })}
      />
      <Stack.Screen name="categories" options={{ title: 'Categories' }} />
      <Stack.Screen
        name="category-form"
        options={({ route }) => {
          const params = route.params as { id?: string; type?: string } | undefined;
          if (params?.id) return { title: 'Edit Category' };
          const typeLabel = params?.type === 'in' ? 'Income' : params?.type === 'out' ? 'Expense' : '';
          return { title: typeLabel ? `New ${typeLabel} Category` : 'New Category' };
        }}
      />
      <Stack.Screen name="tags" options={{ title: 'Tags' }} />
      <Stack.Screen
        name="tag-form"
        options={({ route }) => ({
          title: (route.params as { id?: string } | undefined)?.id ? 'Edit Tag' : 'New Tag',
        })}
      />
    </Stack>
  );
}
