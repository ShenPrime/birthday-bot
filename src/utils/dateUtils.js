/**
 * Date and timezone utility functions for the birthday bot.
 */

/**
 * Converts a date to the user's timezone with fallback to UTC.
 * @param {Date} date - The date to convert
 * @param {string} timezone - IANA timezone identifier (e.g., 'America/New_York')
 * @returns {Date} The date in the specified timezone
 */
function getLocalizedDate(date, timezone) {
  try {
    return new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  } catch (e) {
    console.error(`Error with timezone ${timezone}, falling back to UTC:`, e.message);
    return new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  }
}

/**
 * Validates if a day/month/year combination is a valid date.
 * @param {number} day - Day of the month (1-31)
 * @param {number} month - Month (1-12)
 * @param {number|null} year - Year (optional, for leap year validation)
 * @returns {boolean} True if valid, false otherwise
 */
function isValidDate(day, month, year = null) {
  if (month < 1 || month > 12) return false;
  if (day < 1) return false;

  if (year !== null) {
    const date = new Date(year, month - 1, day);
    return date.getDate() === day &&
           date.getMonth() === month - 1 &&
           date.getFullYear() === year;
  } else {
    // Validate day/month only (use a non-leap year for Feb)
    const daysInMonth = new Date(2023, month, 0).getDate();
    return day <= daysInMonth;
  }
}

/**
 * Generates a unique key for tracking announced birthdays.
 * @param {string} serverId - Discord server ID
 * @param {string} userId - Discord user ID
 * @param {number} year - Current year in user's timezone
 * @param {number} month - Current month in user's timezone
 * @param {number} day - Current day in user's timezone
 * @returns {string} Unique birthday key
 */
function generateBirthdayKey(serverId, userId, year, month, day) {
  return `${serverId}-${userId}-${year}-${month}-${day}`;
}

/**
 * Determines if an announcement entry should be cleaned up based on age.
 * @param {number} timestamp - The timestamp when the announcement was made
 * @param {number} maxAgeMs - Maximum age in milliseconds before cleanup
 * @returns {boolean} True if the entry should be removed
 */
function shouldCleanupEntry(timestamp, maxAgeMs) {
  return Date.now() - timestamp > maxAgeMs;
}

module.exports = {
  getLocalizedDate,
  isValidDate,
  generateBirthdayKey,
  shouldCleanupEntry,
};
