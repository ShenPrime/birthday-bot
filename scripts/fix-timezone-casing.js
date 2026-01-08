/**
 * Migration script to fix lowercase timezone values in the database.
 * Run once with: node scripts/fix-timezone-casing.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Correctly-cased timezone identifiers
const commonTimezones = [
  'UTC',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Phoenix', 'America/Anchorage', 'America/Adak', 'America/Honolulu',
  'America/Toronto', 'America/Vancouver', 'America/Edmonton', 'America/Halifax',
  'America/St_Johns', 'America/Mexico_City', 'America/Tijuana', 'America/Monterrey',
  'America/Sao_Paulo', 'America/Buenos_Aires', 'America/Santiago', 'America/Lima',
  'America/Bogota', 'America/Caracas', 'America/La_Paz', 'America/Montevideo',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow',
  'Europe/Madrid', 'Europe/Rome', 'Europe/Amsterdam', 'Europe/Brussels',
  'Europe/Vienna', 'Europe/Stockholm', 'Europe/Oslo', 'Europe/Copenhagen',
  'Europe/Helsinki', 'Europe/Athens', 'Europe/Istanbul', 'Europe/Warsaw',
  'Europe/Bucharest', 'Europe/Kiev', 'Europe/Lisbon', 'Europe/Dublin',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Dubai',
  'Asia/Hong_Kong', 'Asia/Seoul', 'Asia/Bangkok', 'Asia/Jakarta',
  'Asia/Manila', 'Asia/Kuala_Lumpur', 'Asia/Taipei', 'Asia/Kolkata',
  'Asia/Karachi', 'Asia/Tehran', 'Asia/Jerusalem', 'Asia/Baghdad',
  'Asia/Riyadh', 'Asia/Qatar', 'Asia/Dhaka', 'Asia/Ho_Chi_Minh',
  'Africa/Cairo', 'Africa/Lagos', 'Africa/Johannesburg', 'Africa/Nairobi',
  'Africa/Casablanca', 'Africa/Tunis', 'Africa/Algiers', 'Africa/Khartoum',
  'Africa/Accra', 'Africa/Addis_Ababa',
  'Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Perth',
  'Australia/Adelaide', 'Australia/Darwin', 'Australia/Hobart',
  'Pacific/Auckland', 'Pacific/Fiji', 'Pacific/Honolulu', 'Pacific/Guam',
  'Pacific/Samoa', 'Pacific/Tahiti', 'Pacific/Noumea'
];

// Build a map of lowercase -> correct case
const timezoneMap = new Map();
for (const tz of commonTimezones) {
  timezoneMap.set(tz.toLowerCase(), tz);
}

async function fixTimezoneCasing() {
  console.log('Starting timezone casing migration...\n');

  try {
    // Get all server schemas
    const schemasResult = await pool.query(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name LIKE 'server_%';
    `);

    console.log(`Found ${schemasResult.rows.length} server schemas\n`);

    let totalUpdated = 0;

    for (const row of schemasResult.rows) {
      const schema = row.schema_name;

      // Get all birthdays with their timezones
      const birthdaysResult = await pool.query(`
        SELECT user_id, timezone
        FROM ${schema}.birthdays
        WHERE timezone IS NOT NULL;
      `);

      for (const birthday of birthdaysResult.rows) {
        const currentTz = birthday.timezone;
        const correctTz = timezoneMap.get(currentTz.toLowerCase());

        // Only update if the casing is different
        if (correctTz && correctTz !== currentTz) {
          await pool.query(`
            UPDATE ${schema}.birthdays
            SET timezone = $1
            WHERE user_id = $2;
          `, [correctTz, birthday.user_id]);

          console.log(`[${schema}] Fixed: ${currentTz} -> ${correctTz} (user: ${birthday.user_id})`);
          totalUpdated++;
        }
      }
    }

    console.log(`\nMigration complete. Updated ${totalUpdated} records.`);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixTimezoneCasing();
