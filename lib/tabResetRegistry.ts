import { InteractionManager } from 'react-native';

export type TabRouteName = 'index' | 'activity' | 'loans' | 'budget' | 'settings';
export type TabResetMode = 'background' | 'full';

export type TabResetHandler = (options: { mode: TabResetMode; animated: boolean }) => void;

const knownTabs = new Set<TabRouteName>(['index', 'activity', 'loans', 'budget', 'settings']);
const registry = new Map<string, TabResetHandler>();

export function registerTabReset(tab: TabRouteName, handler: TabResetHandler): () => void {
  registry.set(tab, handler);
  return () => {
    if (registry.get(tab) === handler) {
      registry.delete(tab);
    }
  };
}

export function getTabReset(tab: string): TabResetHandler | undefined {
  const handler = registry.get(tab);
  if (!handler && __DEV__ && knownTabs.has(tab as TabRouteName)) {
    console.warn(`No tab reset handler registered for tab: ${tab}`);
  }
  return handler;
}

export function runAfterTabHidden(action: () => void) {
  return InteractionManager.runAfterInteractions(action);
}
