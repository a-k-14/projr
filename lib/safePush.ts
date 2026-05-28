import { router } from 'expo-router';
import type { NavigationProp } from '@react-navigation/native';

export function safePush(nav: { isFocused: () => boolean }, href: Parameters<typeof router.push>[0]) {
  if (nav.isFocused()) {
    router.push(href);
  }
}
