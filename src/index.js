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

// Check for birthdays and send announcements
async function checkBirthdays() {
  try {
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1; // JavaScript months are 0-indexed

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
      
      // Get birthdays for today
      const birthdaysResult = await pool.query(`
        SELECT * FROM server_${serverId}.birthdays 
        WHERE birth_day = $1 AND birth_month = $2;
      `, [day, month]);
      
      if (birthdaysResult.rows.length > 0) {
        const channel = await client.channels.fetch(channelId);
        
        for (const birthday of birthdaysResult.rows) {
          const age = birthday.birth_year ? today.getFullYear() - birthday.birth_year : null;
          const ageText = age ? ` They are turning ${age} today!` : '';
          
          await channel.send(`🎉 Happy Birthday to <@${birthday.user_id}>!${ageText} 🎂`);
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
  
  // Schedule birthday check every day at midnight
  cron.schedule('0 0 * * *', () => {
    checkBirthdays();
  });
});

// Event: Interaction create
client.on('interactionCreate', async interaction => {
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