import { router } from 'expo-router';


export function safePush(nav: { isFocused: () => boolean }, href: Parameters<typeof router.push>[0]) {
  if (nav.isFocused()) {
    router.push(href);
  }
}
