import re

with open('/Volumes/Hive/Dev/projr/app/(tabs)/index.tsx', 'r') as f:
    content = f.read()

# Add useRef to import if missing
if 'useRef' not in content[:content.find('\n\n')]:
    content = content.replace('useState } from \'react\';', 'useState, useRef } from \'react\';')

# Find HomeScreenContent
start_idx = content.find('function HomeScreenContent() {')

# Inject refs and registerTabReset
hook_insert_idx = content.find('const { palette } = useAppTheme();', start_idx) + len('const { palette } = useAppTheme();')
hook_code = """
  const accountScrollRef = useRef<any>(null);
  const pageScrollTopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return registerTabReset('index', () => {
      pageScrollTopRef.current?.();
      accountScrollRef.current?.scrollTo({ x: 0, animated: true });
      setPeriod('today');
    });
  }, [setPeriod]);
"""
content = content[:hook_insert_idx] + hook_code + content[hook_insert_idx:]

# Update registerScrollTop prop
content = content.replace('registerScrollTop={() => {}}', 'registerScrollTop={(_, fn) => { pageScrollTopRef.current = fn; }}')

# Update middleContent horizontal scrollview and cards
middle_content_search = """      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SCREEN_GUTTER, gap: 12 }}>"""
middle_content_replace = """      <ScrollView ref={accountScrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SCREEN_GUTTER, gap: 12 }}>"""
content = content.replace(middle_content_search, middle_content_replace)

cards_search = """      <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: SCREEN_GUTTER, marginTop: 16 }}>
        {['Deposits', 'Loans', 'Budgets'].map(feature => (
          <TouchableOpacity
            key={feature}
            onPress={() => feature === 'Loans' ? router.push('/(tabs)/loans') : feature === 'Budgets' ? router.push('/(tabs)/budget') : {}}
            style={{ 
               flex: 1, 
               padding: 12, 
               alignItems: 'center', 
               justifyContent: 'center',
               backgroundColor: palette.surface, 
               borderRadius: HOME_RADIUS.card, 
               borderWidth: 1, 
               borderColor: palette.divider 
            }}
          >
             <Text style={{ fontSize: 13, fontWeight: '600', color: palette.text }}>{feature}</Text>
          </TouchableOpacity>
        ))}
      </View>"""

cards_replace = """      <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: SCREEN_GUTTER, marginTop: 16 }}>
        {[
          { id: 'Deposits', label: 'Deposits', icon: 'piggy-bank' as const, route: null },
          { id: 'Loans', label: 'Loans', icon: 'landmark' as const, route: '/(tabs)/loans' },
          { id: 'Budgets', label: 'Budgets', icon: 'pie-chart' as const, route: '/(tabs)/budget' }
        ].map(feature => (
          <TouchableOpacity
            key={feature.id}
            onPress={() => feature.route ? router.push(feature.route as any) : {}}
            style={{ 
               flex: 1, 
               padding: 16, 
               alignItems: 'flex-start', 
               backgroundColor: palette.card, 
               borderRadius: HOME_RADIUS.card, 
               borderWidth: 1, 
               borderColor: palette.divider,
               shadowColor: '#000',
               shadowOffset: { width: 0, height: 2 },
               shadowOpacity: palette.isDark ? 0.2 : 0.04,
               shadowRadius: 8,
               elevation: 2,
            }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
               <AppIcon name={feature.icon} size={18} color={palette.brand} />
            </View>
            <Text style={{ fontSize: 13.5, fontWeight: '700', color: palette.text }}>{feature.label}</Text>
          </TouchableOpacity>
        ))}
      </View>"""

content = content.replace(cards_search, cards_replace)

with open('/Volumes/Hive/Dev/projr/app/(tabs)/index.tsx', 'w') as f:
    f.write(content)

print("Updated index.tsx cards and reset logic")
