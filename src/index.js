require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const cron = require('node-cron');

// --- Global Error Handlers ---
process.on('uncaughtException', (error) => {
  console.error('--- UNCAUGHT EXCEPTION ---');
  console.error(error);
  process.exit(1); // Exit after logging
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('--- UNHANDLED REJECTION ---');
  console.error('Reason:', reason);
  // console.error('Promise:', promise); // Uncomment for more details if needed
  process.exit(1); // Exit after logging
});
// -----------------------------

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

// Attach the checkAndAnnounceUserBirthday function to the client
client.checkAndAnnounceUserBirthday = checkAndAnnounceUserBirthday;

// Initialize commands collection
client.commands = new Collection();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Initialize database
async function initializeDatabase() {
  try {
    // Create servers table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS servers (
        server_id TEXT PRIMARY KEY,
        announcement_channel_id TEXT
      );
    `);
    console.log('Servers table initialized');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// Create schema and tables for a server
async function createServerSchema(serverId) {
  try {
    // Create schema for the server
    await pool.query(`CREATE SCHEMA IF NOT EXISTS server_${serverId};`);
    
    // Create birthdays table in the server's schema
    await pool.query(`
      CREATE TABLE IF NOT EXISTS server_${serverId}.birthdays (
        user_id TEXT PRIMARY KEY,
        username TEXT,
        birth_day INTEGER,
        birth_month INTEGER,
        birth_year INTEGER,
        timezone TEXT DEFAULT 'UTC',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log(`Schema and tables created for server ${serverId}`);
    return true;
  } catch (error) {
    console.error(`Error creating schema for server ${serverId}:`, error);
    return false;
  }
}

// Load command files
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.log(`[WARNING] The command at ${filePath} is missing required properties.`);
  }
}

// Register slash commands
async function registerCommands() {
  try {
    const commands = [];
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
      const command = require(path.join(commandsPath, file));
      commands.push(command.data.toJSON());
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
}

// Track announced birthdays to prevent duplicates
const announcedBirthdays = new Map();

// Reset announced birthdays map at midnight UTC
function resetAnnouncedBirthdays() {
  const now = new Date();
  if (now.getUTCHours() === 0 && now.getUTCMinutes() < 5) { // Reset in the first 5 minutes of the day
    console.log('Resetting announced birthdays tracking');
    announcedBirthdays.clear();
  }
}

// Function to check if it's a user's birthday and send announcement
async function checkAndAnnounceUserBirthday(serverId, userId, channelId) {
  try {
    // Get user's birthday data
    const birthdayResult = await pool.query(`
      SELECT * FROM server_${serverId}.birthdays WHERE user_id = $1;
    `, [userId]);
    
    if (birthdayResult.rows.length === 0) return false;
    
    const birthday = birthdayResult.rows[0];
    
    // Get current date in user's timezone
    const now = new Date();
    const userDate = new Date(now.toLocaleString('en-US', {
      timeZone: (birthday.timezone || 'UTC').toLowerCase()
    }));
    
    const userDay = userDate.getDate();
    const userMonth = userDate.getMonth() + 1;
    
    // Create a unique key for this birthday
    const birthdayKey = `${serverId}-${birthday.user_id}-${userDay}-${userMonth}`;
    
    // Check if it's the user's birthday in their timezone and hasn't been announced today
    if (birthday.birth_day === userDay && birthday.birth_month === userMonth && !announcedBirthdays.has(birthdayKey)) {
      // Try to fetch the channel
      let channel;
      try {
        channel = await client.channels.fetch(channelId);
      } catch (error) {
        console.error(`Error fetching channel ${channelId} for server ${serverId}: ${error.message}`);
        return false;
      }
      
      // Verify the channel exists and is a text channel
      if (!channel || !channel.isTextBased()) {
        console.error(`Channel ${channelId} for server ${serverId} is not accessible or not a text channel`);
        return false;
      }
      
      const age = birthday.birth_year ? userDate.getFullYear() - birthday.birth_year : null;
      const ageText = age ? ` They are turning ${age} today!` : '';
      
      try {
        await channel.send(`🎉 Happy Birthday to <@${birthday.user_id}>!${ageText} 🎂`);
        
        // Mark this birthday as announced for today
        announcedBirthdays.set(birthdayKey, true);
        console.log(`Announced birthday for user ${birthday.user_id} in server ${serverId}`);
        return true;
      } catch (error) {
        console.error(`Error sending birthday message in channel ${channelId} for server ${serverId}: ${error.message}`);
        return false;
      }
    }
    
    return false;
  } catch (error) {
    console.error(`Error checking birthday for user ${userId} in server ${serverId}:`, error);
    return false;
  }
}

// Check for birthdays and send announcements
async function checkBirthdays() {
  console.log('--- Entering checkBirthdays function ---'); // Add this log
  try {
    const now = new Date(); // Define 'now' here
    // Reset tracking at midnight UTC if needed
    resetAnnouncedBirthdays();
    
    // Get all servers
    const serversResult = await pool.query('SELECT * FROM servers;');
    
    for (const server of serversResult.rows) {
      const serverId = server.server_id;
      const channelId = server.announcement_channel_id;
      
      if (!channelId) continue;
      
      // Check if schema exists
      const schemaCheck = await pool.query(`
        SELECT schema_name FROM information_schema.schemata 
        WHERE schema_name = 'server_${serverId}';
      `);
      
      if (schemaCheck.rows.length === 0) continue;
      
      // Get all birthdays (not filtered by date yet)
      const birthdaysResult = await pool.query(`
        SELECT * FROM server_${serverId}.birthdays;
      `);
      
      console.log(`Found ${birthdaysResult.rows.length} birthday records for server ${serverId}.`); // Add this log

      if (birthdaysResult.rows.length > 0) {
        // Try to fetch the channel, but handle the case where the bot no longer has access
        let channel;
        try {
          channel = await client.channels.fetch(channelId);
        } catch (error) {
          console.error(`Error fetching channel ${channelId} for server ${serverId}: ${error.message}`);
          // Skip this server since we can't access the channel
          continue;
        }
        
        // Verify the channel exists and is a text channel that we can send messages to
        if (!channel || !channel.isTextBased()) {
          console.error(`Channel ${channelId} for server ${serverId} is not accessible or not a text channel`);
          continue;
        }
        
        for (const birthday of birthdaysResult.rows) {
          // Get current date in user's timezone          // const now = new Date(); <-- Remove this line
          let userDate;
          try {
            // Attempt to get date in user's specified timezone
            userDate = new Date(now.toLocaleString('en-US', {
              timeZone: birthday.timezone || 'UTC' // Use the stored timezone directly
            }));
          } catch (error) {
            // Handle invalid timezone identifier
            if (error instanceof RangeError) {
              console.warn(`Invalid timezone '${birthday.timezone}' for user ${birthday.user_id} in server ${serverId}. Defaulting to UTC.`);
              userDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' })); // Fallback to UTC
            } else {
              // Re-throw other unexpected errors
              console.error(`Unexpected error getting user date for ${birthday.user_id} in server ${serverId}:`, error);
              continue; // Skip this user if we can't determine their date
            }
          }
          
          const userDay = userDate.getDate();
          const userMonth = userDate.getMonth() + 1;
          
          // Create a unique key for this birthday
          const birthdayKey = `${serverId}-${birthday.user_id}-${userDay}-${userMonth}`;
          
          // Check if it's the user's birthday in their timezone and hasn't been announced today
          if (birthday.birth_day === userDay && birthday.birth_month === userMonth && !announcedBirthdays.has(birthdayKey)) {
            const age = birthday.birth_year ? userDate.getFullYear() - birthday.birth_year : null;
            const ageText = age ? ` They are turning ${age} today!` : '';
            
            try {
              await channel.send(`🎉 Happy Birthday to <@${birthday.user_id}>!${ageText} 🎂`);
              
              // Mark this birthday as announced for today
              announcedBirthdays.set(birthdayKey, true);
              console.log(`Announced birthday for user ${birthday.user_id} in server ${serverId}`);
            } catch (sendError) {
              // Log specific errors related to sending messages (e.g., permissions)
              console.error(`Error sending birthday message for user ${birthday.user_id} in channel ${channelId} (Server: ${serverId}): ${sendError.message}`);
              // No need to 'continue' here, just log the error and proceed to the next user
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error checking birthdays:', error);
  }
}

// Event: Client ready
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  
  // Initialize database
  await initializeDatabase();
  
  // Register commands
  await registerCommands();
  
  // Schedule birthday check every minute
  console.log('Attempting to schedule cron job...'); // Add this log
  cron.schedule('0 * * * *', () => {
    console.log('--- Cron job triggered ---'); // Add this log
    console.log('Running hourly birthday check...'); // Corrected log message
    checkBirthdays();
  });
  console.log('Cron job scheduled successfully.'); // Add this log
  
  console.log('Birthday checks scheduled to run every hour.');
});

// Common timezones for autocomplete suggestions
const commonTimezones = [
  // UTC
  'UTC',
  
  // North America
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Phoenix', 'America/Anchorage', 'America/Adak', 'America/Honolulu',
  'America/Toronto', 'America/Vancouver', 'America/Edmonton', 'America/Halifax',
  'America/St_Johns', 'America/Mexico_City', 'America/Tijuana', 'America/Monterrey',
  
  // South America
  'America/Sao_Paulo', 'America/Buenos_Aires', 'America/Santiago', 'America/Lima',
  'America/Bogota', 'America/Caracas', 'America/La_Paz', 'America/Montevideo',
  
  // Europe
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow',
  'Europe/Madrid', 'Europe/Rome', 'Europe/Amsterdam', 'Europe/Brussels',
  'Europe/Vienna', 'Europe/Stockholm', 'Europe/Oslo', 'Europe/Copenhagen',
  'Europe/Helsinki', 'Europe/Athens', 'Europe/Istanbul', 'Europe/Warsaw',
  'Europe/Bucharest', 'Europe/Kiev', 'Europe/Lisbon', 'Europe/Dublin',
  
  // Asia
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Dubai',
  'Asia/Hong_Kong', 'Asia/Seoul', 'Asia/Bangkok', 'Asia/Jakarta',
  'Asia/Manila', 'Asia/Kuala_Lumpur', 'Asia/Taipei', 'Asia/Kolkata',
  'Asia/Karachi', 'Asia/Tehran', 'Asia/Jerusalem', 'Asia/Baghdad',
  'Asia/Riyadh', 'Asia/Qatar', 'Asia/Dhaka', 'Asia/Ho_Chi_Minh',
  
  // Africa
  'Africa/Cairo', 'Africa/Lagos', 'Africa/Johannesburg', 'Africa/Nairobi',
  'Africa/Casablanca', 'Africa/Tunis', 'Africa/Algiers', 'Africa/Khartoum',
  'Africa/Accra', 'Africa/Addis_Ababa',
  
  // Oceania
  'Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Perth',
  'Australia/Adelaide', 'Australia/Darwin', 'Australia/Hobart',
  'Pacific/Auckland', 'Pacific/Fiji', 'Pacific/Honolulu', 'Pacific/Guam',
  'Pacific/Samoa', 'Pacific/Tahiti', 'Pacific/Noumea'
];

// Make timezones accessible to command files
client.commonTimezones = commonTimezones;

// Event: Interaction create
client.on('interactionCreate', async interaction => {
  // Handle autocomplete interactions
  if (interaction.isAutocomplete()) {
    if (interaction.commandName === 'set_birthday' || interaction.commandName === 'edit_birthday') {
      const focusedOption = interaction.options.getFocused(true);
      if (focusedOption.name === 'timezone') {
        const input = focusedOption.value.toLowerCase();
        const filtered = commonTimezones.filter(tz => tz.toLowerCase().includes(input));
        await interaction.respond(
          filtered.map(tz => ({ name: tz, value: tz })).slice(0, 25)
        );
      }
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction, pool, createServerSchema);
  } catch (error) {
    console.error(error);
    await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
  }
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);