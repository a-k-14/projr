export const CALCULATOR_DISPLAY_MAX_LINES = 2;

export function getCalculatorDisplayMetrics(value: string, maxFontSize = 28) {
  const compactLength = value.replace(/\s/g, '').length;
  const twoLineTargetLength = 24;

  if (maxFontSize === 28) {
    const fontSize = compactLength <= twoLineTargetLength ? 28 : 24;
    return buildMetrics(fontSize);
  }

  // Fallback for tests or other custom maxFontSize
  const fontSize = compactLength <= twoLineTargetLength ? maxFontSize : Math.max(24, maxFontSize - 4);
  return buildMetrics(fontSize);
}

function buildMetrics(fontSize: number) {
  return {
    fontSize,
    lineHeight: Math.round(fontSize * 1.16),
  };
}
