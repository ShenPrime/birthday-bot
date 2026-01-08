const { getZodiacSign, getZodiacColor } = require('../zodiacUtils');

describe('getZodiacSign', () => {
  describe('returns correct sign for each zodiac period', () => {
    const testCases = [
      // Aries: March 21 - April 19
      { day: 21, month: 3, expected: 'Aries' },
      { day: 19, month: 4, expected: 'Aries' },
      // Taurus: April 20 - May 20
      { day: 20, month: 4, expected: 'Taurus' },
      { day: 20, month: 5, expected: 'Taurus' },
      // Gemini: May 21 - June 20
      { day: 21, month: 5, expected: 'Gemini' },
      { day: 20, month: 6, expected: 'Gemini' },
      // Cancer: June 21 - July 22
      { day: 21, month: 6, expected: 'Cancer' },
      { day: 22, month: 7, expected: 'Cancer' },
      // Leo: July 23 - August 22
      { day: 23, month: 7, expected: 'Leo' },
      { day: 22, month: 8, expected: 'Leo' },
      // Virgo: August 23 - September 22
      { day: 23, month: 8, expected: 'Virgo' },
      { day: 22, month: 9, expected: 'Virgo' },
      // Libra: September 23 - October 22
      { day: 23, month: 9, expected: 'Libra' },
      { day: 22, month: 10, expected: 'Libra' },
      // Scorpio: October 23 - November 21
      { day: 23, month: 10, expected: 'Scorpio' },
      { day: 21, month: 11, expected: 'Scorpio' },
      // Sagittarius: November 22 - December 21
      { day: 22, month: 11, expected: 'Sagittarius' },
      { day: 21, month: 12, expected: 'Sagittarius' },
      // Capricorn: December 22 - January 19
      { day: 22, month: 12, expected: 'Capricorn' },
      { day: 19, month: 1, expected: 'Capricorn' },
      // Aquarius: January 20 - February 18
      { day: 20, month: 1, expected: 'Aquarius' },
      { day: 18, month: 2, expected: 'Aquarius' },
      // Pisces: February 19 - March 20
      { day: 19, month: 2, expected: 'Pisces' },
      { day: 20, month: 3, expected: 'Pisces' },
    ];

    test.each(testCases)(
      'returns $expected for day $day, month $month',
      ({ day, month, expected }) => {
        expect(getZodiacSign(day, month)).toBe(expected);
      }
    );
  });

  describe('handles boundary dates correctly', () => {
    test('March 20 is Pisces (last day)', () => {
      expect(getZodiacSign(20, 3)).toBe('Pisces');
    });

    test('March 21 is Aries (first day)', () => {
      expect(getZodiacSign(21, 3)).toBe('Aries');
    });

    test('December 21 is Sagittarius (last day)', () => {
      expect(getZodiacSign(21, 12)).toBe('Sagittarius');
    });

    test('December 22 is Capricorn (first day)', () => {
      expect(getZodiacSign(22, 12)).toBe('Capricorn');
    });

    test('January 1 is Capricorn', () => {
      expect(getZodiacSign(1, 1)).toBe('Capricorn');
    });

    test('December 31 is Capricorn', () => {
      expect(getZodiacSign(31, 12)).toBe('Capricorn');
    });
  });

  describe('handles mid-month dates', () => {
    test('January 15 is Capricorn', () => {
      expect(getZodiacSign(15, 1)).toBe('Capricorn');
    });

    test('July 15 is Cancer', () => {
      expect(getZodiacSign(15, 7)).toBe('Cancer');
    });
  });
});

describe('getZodiacColor', () => {
  const expectedColors = {
    'Aries': '#FF0000',
    'Taurus': '#00FF00',
    'Gemini': '#FFFF00',
    'Cancer': '#FFFFFF',
    'Leo': '#FFA500',
    'Virgo': '#964B00',
    'Libra': '#FFC0CB',
    'Scorpio': '#800000',
    'Sagittarius': '#800080',
    'Capricorn': '#000000',
    'Aquarius': '#0000FF',
    'Pisces': '#40E0D0',
  };

  test.each(Object.entries(expectedColors))(
    'returns %s for %s',
    (sign, color) => {
      expect(getZodiacColor(sign)).toBe(color);
    }
  );

  test('returns gray for unknown sign', () => {
    expect(getZodiacColor('Unknown')).toBe('#808080');
  });

  test('returns gray for invalid input', () => {
    expect(getZodiacColor('NotASign')).toBe('#808080');
  });
});
