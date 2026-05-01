export const EXPENSE_FLOW_COLORS = [
  '#FF6B6B',
  '#FF8A65',
  '#FF5C8A',
  '#7DD56F',
  '#4F8CFF',
  '#7B61FF',
  '#F4A62A',
  '#A855F7',
  '#15B8A6',
  '#334BFF',
  '#FF4FD8',
  '#C084FC',
  '#00A7F5',
  '#38BDF8',
  '#26C281',
  '#5EEAD4',
  '#FB7185',
  '#8B5CF6',
  '#6366F1',
  '#F97316',
  '#FDBA74',
  '#F59E0B',
  '#3B82F6',
  '#0F766E',
  '#EC4899',
  '#64748B',
] as const;

export const INCOME_FLOW_COLORS = [
  '#22C55E',
  '#16A34A',
  '#84CC16',
  '#2DD4BF',
  '#60A5FA',
  '#A78BFA',
  '#10B981',
  '#34D399',
  '#4ADE80',
  '#38BDF8',
] as const;

export function getPrototypeCategoryColor(
  key: string,
  type: 'income' | 'expense',
  fallbackColor?: string | null,
) {
  const palette = type === 'income' ? INCOME_FLOW_COLORS : EXPENSE_FLOW_COLORS;
  const paletteList: readonly string[] = palette;

  if (fallbackColor && paletteList.includes(fallbackColor)) {
    return fallbackColor;
  }

  const source = key || fallbackColor || 'default';
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
  }
  return palette[hash % palette.length];
}
