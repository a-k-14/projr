export const CALCULATOR_DISPLAY_MAX_LINES = 2;

export function getCalculatorDisplayMetrics(value: string, maxFontSize = 24) {
  const minFontSize = 20;
  if (value.length <= 18) {
    return buildMetrics(maxFontSize);
  }
  const calculated = maxFontSize - Math.floor((value.length - 18) / 4);
  const fontSize = Math.max(minFontSize, calculated);
  return buildMetrics(fontSize);
}

function buildMetrics(fontSize: number) {
  return {
    fontSize,
    lineHeight: Math.round(fontSize * 1.3),
  };
}
