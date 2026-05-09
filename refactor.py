import os
import re

index_path = '/Volumes/Hive/Dev/projr/app/(tabs)/index.tsx'
with open(index_path, 'r') as f:
    content = f.read()

# Make HomeAccountPage exported
content = content.replace('const HomeAccountPage = React.memo(function HomeAccountPage({', 'export const HomeAccountPage = React.memo(function HomeAccountPage({')

# Add middleContent to HomeAccountPage props
content = content.replace('onOpenNetWorth,\n  netWorth,\n  isPageReady,', 'onOpenNetWorth,\n  netWorth,\n  isPageReady,\n  middleContent,')
content = content.replace('onOpenNetWorth?: () => void;\n  netWorth?: number;\n  isPageReady: boolean;', 'onOpenNetWorth?: () => void;\n  netWorth?: number;\n  isPageReady: boolean;\n  middleContent?: React.ReactNode;')

# Insert middleContent before the Recent section
chart_block_end = """          </View>

          <View
            style={{
              backgroundColor: palette.surface,"""

new_chart_block_end = """          </View>
          
          {middleContent}

          <View
            style={{
              backgroundColor: palette.surface,"""

content = content.replace(chart_block_end, new_chart_block_end)

with open(index_path, 'w') as f:
    f.write(content)

print("Modified index.tsx to export HomeAccountPage and add middleContent")

