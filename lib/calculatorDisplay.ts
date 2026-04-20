export const CALCULATOR_DISPLAY_MAX_LINES = 2;

export function getCalculatorDisplayMetrics(value: string, maxFontSize: number) {
  const compactLength = value.replace(/\s/g, '').length;
  const twoLineTargetLength = 24;
  const minimumFontSize = Math.round(maxFontSize * 0.58);

  if (compactLength <= twoLineTargetLength) {
    return buildMetrics(maxFontSize);
  }

  const shrinkSteps = Math.ceil((compactLength - twoLineTargetLength) / 8);
  const fontSize = Math.max(minimumFontSize, maxFontSize - shrinkSteps * 4);
  return buildMetrics(fontSize);
}

function buildMetrics(fontSize: number) {
  return {
    fontSize,
    lineHeight: Math.round(fontSize * 1.16),
  };
}
