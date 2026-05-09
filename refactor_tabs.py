import re

with open('/Volumes/Hive/Dev/projr/app/(tabs)/_layout.tsx', 'r') as f:
    content = f.read()

# Replace TAB_ITEMS
content = content.replace("budget: { icon: 'pie-chart', label: 'Budget' },", "insights: { icon: 'bar-chart-2', label: 'Insights' },")

# Replace VISIBLE_TAB_NAMES
content = content.replace("const VISIBLE_TAB_NAMES = ['index', 'activity', 'budget', 'settings'] as const;", "const VISIBLE_TAB_NAMES = ['index', 'activity', 'insights', 'settings'] as const;")

# Replace TAB_BAR_SLOTS
content = content.replace("const TAB_BAR_SLOTS = ['index', 'activity', 'add', 'budget', 'settings'] as const;", "const TAB_BAR_SLOTS = ['index', 'activity', 'add', 'insights', 'settings'] as const;")

# Replace BACKGROUND_RESET_ENABLED
content = content.replace("budget: true,", "insights: true,\n  budget: true,")

# Add Tabs.Screen name="insights"
# Modify Tabs.Screen name="budget" to be hidden
tabs_search = """<Tabs.Screen name="budget" />
      <Tabs.Screen name="settings" />"""

tabs_replace = """<Tabs.Screen name="insights" />
      <Tabs.Screen name="budget" options={{ href: null }} />
      <Tabs.Screen name="settings" />"""
      
content = content.replace(tabs_search, tabs_replace)

with open('/Volumes/Hive/Dev/projr/app/(tabs)/_layout.tsx', 'w') as f:
    f.write(content)

print("Updated _layout.tsx")
