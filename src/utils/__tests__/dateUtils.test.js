const {
  getLocalizedDate,
  isValidDate,
  generateBirthdayKey,
  shouldCleanupEntry,
} = require('../dateUtils');

describe('getLocalizedDate', () => {
  test('converts date to specified timezone', () => {
    // Create a fixed UTC date: 2024-01-15 12:00:00 UTC
    const utcDate = new Date('2024-01-15T12:00:00Z');

    // New York is UTC-5 in January, so 12:00 UTC = 07:00 EST
    const nyDate = getLocalizedDate(utcDate, 'America/New_York');
    expect(nyDate.getHours()).toBe(7);
  });

  test('handles UTC timezone', () => {
    const date = new Date('2024-06-15T15:30:00Z');
    const result = getLocalizedDate(date, 'UTC');
    // The result represents 15:30 UTC as local time values
    expect(result.getHours()).toBe(15);
    expect(result.getMinutes()).toBe(30);
  });

  test('handles Asia/Tokyo timezone', () => {
    // Tokyo is UTC+9
    const utcDate = new Date('2024-01-15T12:00:00Z');
    const tokyoDate = getLocalizedDate(utcDate, 'Asia/Tokyo');
    // 12:00 UTC = 21:00 JST
    expect(tokyoDate.getHours()).toBe(21);
  });

  test('falls back to UTC for invalid timezone', () => {
    const date = new Date('2024-01-15T12:00:00Z');
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const result = getLocalizedDate(date, 'Invalid/Timezone');

    expect(consoleSpy).toHaveBeenCalled();
    // Should return UTC time as local values (12:00 UTC)
    expect(result.getHours()).toBe(12);

    consoleSpy.mockRestore();
  });

  test('handles completely invalid timezone string', () => {
    const date = new Date('2024-01-15T12:00:00Z');
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    // Completely invalid timezone should trigger fallback
    const result = getLocalizedDate(date, 'Not/A/Real/Timezone');

    expect(consoleSpy).toHaveBeenCalled();
    // Should fall back to UTC (12:00)
    expect(result.getHours()).toBe(12);

    consoleSpy.mockRestore();
  });
});

describe('isValidDate', () => {
  describe('with year provided', () => {
    test('validates correct dates', () => {
      expect(isValidDate(15, 6, 1990)).toBe(true);
      expect(isValidDate(1, 1, 2000)).toBe(true);
      expect(isValidDate(31, 12, 1985)).toBe(true);
    });

    test('rejects invalid day for month', () => {
      expect(isValidDate(31, 4, 2024)).toBe(false); // April has 30 days
      expect(isValidDate(31, 6, 2024)).toBe(false); // June has 30 days
      expect(isValidDate(32, 1, 2024)).toBe(false); // No month has 32 days
    });

    test('handles leap year February correctly', () => {
      expect(isValidDate(29, 2, 2024)).toBe(true);  // 2024 is a leap year
      expect(isValidDate(29, 2, 2023)).toBe(false); // 2023 is not a leap year
      expect(isValidDate(29, 2, 2000)).toBe(true);  // 2000 is a leap year
      expect(isValidDate(29, 2, 1900)).toBe(false); // 1900 is not a leap year
    });

    test('rejects invalid months', () => {
      expect(isValidDate(15, 0, 2024)).toBe(false);
      expect(isValidDate(15, 13, 2024)).toBe(false);
      expect(isValidDate(15, -1, 2024)).toBe(false);
    });

    test('rejects day less than 1', () => {
      expect(isValidDate(0, 6, 2024)).toBe(false);
      expect(isValidDate(-1, 6, 2024)).toBe(false);
    });
  });

  describe('without year (day/month only)', () => {
    test('validates correct day/month combinations', () => {
      expect(isValidDate(15, 6)).toBe(true);
      expect(isValidDate(31, 1)).toBe(true);
      expect(isValidDate(28, 2)).toBe(true);
    });

    test('rejects invalid day for month', () => {
      expect(isValidDate(31, 4)).toBe(false);  // April has 30 days
      expect(isValidDate(30, 2)).toBe(false);  // Feb never has 30 days
      expect(isValidDate(31, 11)).toBe(false); // November has 30 days
    });

    test('rejects Feb 29 without year (uses non-leap year)', () => {
      // Without a year, we use 2023 (non-leap) so Feb 29 is invalid
      expect(isValidDate(29, 2)).toBe(false);
    });
  });
});

describe('generateBirthdayKey', () => {
  test('generates correct format', () => {
    const key = generateBirthdayKey('123456', '789012', 2024, 6, 15);
    expect(key).toBe('123456-789012-2024-6-15');
  });

  test('handles different server and user IDs', () => {
    const key1 = generateBirthdayKey('server1', 'user1', 2024, 1, 1);
    const key2 = generateBirthdayKey('server2', 'user1', 2024, 1, 1);
    const key3 = generateBirthdayKey('server1', 'user2', 2024, 1, 1);

    expect(key1).not.toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key2).not.toBe(key3);
  });

  test('different dates produce different keys', () => {
    const key1 = generateBirthdayKey('server', 'user', 2024, 1, 1);
    const key2 = generateBirthdayKey('server', 'user', 2024, 1, 2);
    const key3 = generateBirthdayKey('server', 'user', 2025, 1, 1);

    expect(key1).not.toBe(key2);
    expect(key1).not.toBe(key3);
  });
});

describe('shouldCleanupEntry', () => {
  test('returns true for entries older than max age', () => {
    const twoDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000); // 3 days ago
    const maxAge = 2 * 24 * 60 * 60 * 1000; // 2 days

    expect(shouldCleanupEntry(twoDaysAgo, maxAge)).toBe(true);
  });

  test('returns false for entries newer than max age', () => {
    const oneHourAgo = Date.now() - (1 * 60 * 60 * 1000); // 1 hour ago
    const maxAge = 2 * 24 * 60 * 60 * 1000; // 2 days

    expect(shouldCleanupEntry(oneHourAgo, maxAge)).toBe(false);
  });

  test('returns false for current timestamp', () => {
    const now = Date.now();
    const maxAge = 2 * 24 * 60 * 60 * 1000;

    expect(shouldCleanupEntry(now, maxAge)).toBe(false);
  });

  test('returns true for entries exactly at max age boundary', () => {
    const maxAge = 1000; // 1 second
    const exactlyAtBoundary = Date.now() - maxAge - 1; // Just past the boundary

    expect(shouldCleanupEntry(exactlyAtBoundary, maxAge)).toBe(true);
  });
});
