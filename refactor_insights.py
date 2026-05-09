import re

with open('/Volumes/Hive/Dev/projr/app/(tabs)/index.tsx', 'r') as f:
    content = f.read()

# Extract HomeDonutChartBlock usage
chart_block = content[content.find('<View\n            style={{\n              backgroundColor: palette.card,\n              borderWidth: 1,'):]
chart_block = chart_block[:chart_block.find('</View>\n          \n          {middleContent}')] + '</View>'

print(chart_block[:500])

