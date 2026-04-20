import { formatIndianNumberStr, parseFormattedNumber } from '../lib/derived';

describe('number formatting', () => {
  it('preserves leading negative signs in amount fields', () => {
    expect(formatIndianNumberStr('-')).toBe('-');
    expect(formatIndianNumberStr('-.')).toBe('-.');
    expect(formatIndianNumberStr('-2500')).toBe('-2,500');
    expect(parseFormattedNumber('-2,500')).toBe('-2500');
  });
});
