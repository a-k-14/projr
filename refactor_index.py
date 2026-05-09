import re

with open('/Volumes/Hive/Dev/projr/app/(tabs)/index.tsx', 'r') as f:
    content = f.read()

# Remove HomeDonutChartBlock block
start_tag = '<View\n            style={{\n              backgroundColor: palette.card,\n              borderWidth: 1,\n              borderColor: palette.divider,\n              borderRadius: HOME_RADIUS.card,\n              paddingTop: 12,\n              paddingBottom: 12,\n              marginBottom: HOME_SURFACE.chartCardBottom\n            }}\n          >'
end_tag = '</View>\n          \n          {middleContent}'

idx_start = content.find(start_tag)
if idx_start != -1:
    idx_end = content.find(end_tag, idx_start)
    if idx_end != -1:
        content = content[:idx_start] + '{middleContent}' + content[idx_end + len(end_tag):]

# Modify middleContent
middle_content_search = """const middleContent = (
    <View style={{ marginBottom: HOME_SPACE.lg }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SCREEN_GUTTER, gap: 12 }}>"""

middle_content_replace = """const middleContent = (
    <View style={{ marginBottom: HOME_SPACE.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SCREEN_GUTTER, marginBottom: 12, marginTop: 16 }}>
        <Text appWeight="medium" style={{ fontSize: 18, fontWeight: '700', color: palette.text }}>Accounts</Text>
        <TouchableOpacity delayPressIn={0} onPress={() => router.push('/accounts')}>
          <Text appWeight="medium" style={{ fontSize: 14, color: palette.brand, fontWeight: '600' }}>View all</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SCREEN_GUTTER, gap: 12 }}>"""

content = content.replace(middle_content_search, middle_content_replace)

with open('/Volumes/Hive/Dev/projr/app/(tabs)/index.tsx', 'w') as f:
    f.write(content)

print("Updated index.tsx")
