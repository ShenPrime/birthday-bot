require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const cron = require('node-cron');

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

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

// Check for birthdays and send announcements
async function checkBirthdays() {
  try {
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
      
      if (birthdaysResult.rows.length > 0) {
        const channel = await client.channels.fetch(channelId);
        
        for (const birthday of birthdaysResult.rows) {
          // Get current date in user's timezone
          const now = new Date();
          const userDate = new Date(now.toLocaleString('en-US', {
            timeZone: birthday.timezone || 'UTC'
          }));
          
          const userDay = userDate.getDate();
          const userMonth = userDate.getMonth() + 1;
          
          // Create a unique key for this birthday
          const birthdayKey = `${serverId}-${birthday.user_id}-${userDay}-${userMonth}`;
          
          // Check if it's the user's birthday in their timezone and hasn't been announced today
          if (birthday.birth_day === userDay && birthday.birth_month === userMonth && !announcedBirthdays.has(birthdayKey)) {
            const age = birthday.birth_year ? userDate.getFullYear() - birthday.birth_year : null;
            const ageText = age ? ` They are turning ${age} today!` : '';
            
            await channel.send(`🎉 Happy Birthday to <@${birthday.user_id}>!${ageText} 🎂`);
            
            // Mark this birthday as announced for today
            announcedBirthdays.set(birthdayKey, true);
            console.log(`Announced birthday for user ${birthday.user_id} in server ${serverId}`);
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
  
  // Schedule birthday check every hour
  cron.schedule('0 * * * *', () => {
    checkBirthdays();
  });
  
  console.log('Birthday checks scheduled to run hourly');
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