const { SlashCommandBuilder } = require('discord.js');
const { assignZodiacRole } = require('../utils/zodiacUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set_birthday')
    .setDescription('Set your birthday')
    .addIntegerOption(option =>
      option.setName('day')
        .setDescription('The day of your birthday')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(31))
    .addIntegerOption(option =>
      option.setName('month')
        .setDescription('The month of your birthday')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(12))
    .addIntegerOption(option =>
      option.setName('year')
        .setDescription('The year of your birthday (optional)')
        .setRequired(false)
        .setMinValue(1900)
        .setMaxValue(new Date().getFullYear())),
  
  async execute(interaction, pool) {
    try {
      await interaction.deferReply({ ephemeral: true });
      
      const serverId = interaction.guildId;
      const userId = interaction.user.id;
      const username = interaction.user.username;
      const day = interaction.options.getInteger('day');
      const month = interaction.options.getInteger('month');
      const year = interaction.options.getInteger('year') || null;
      
      // Validate date
      if (year) {
        const date = new Date(year, month - 1, day);
        if (date.getDate() !== day || date.getMonth() !== month - 1 || date.getFullYear() !== year) {
          return await interaction.editReply('Invalid date. Please provide a valid date.');
        }
      } else {
        // Just validate day/month combination
        const daysInMonth = new Date(new Date().getFullYear(), month, 0).getDate();
        if (day > daysInMonth) {
          return await interaction.editReply(`Invalid date. The month ${month} only has ${daysInMonth} days.`);
        }
      }
      
      // Check if schema exists for this server
      const schemaCheck = await pool.query(`
        SELECT schema_name FROM information_schema.schemata 
        WHERE schema_name = 'server_${serverId}';
      `);
      
      if (schemaCheck.rows.length === 0) {
        return await interaction.editReply('The birthday bot has not been set up for this server yet. Please ask an admin to run the /setup_birthday_boi command first.');
      }
      
      // Check if user already has a birthday set
      const userCheck = await pool.query(`
        SELECT * FROM server_${serverId}.birthdays WHERE user_id = $1;
      `, [userId]);
      
      if (userCheck.rows.length > 0) {
        // Update existing birthday
        await pool.query(`
          UPDATE server_${serverId}.birthdays 
          SET birth_day = $1, birth_month = $2, birth_year = $3, username = $4 
          WHERE user_id = $5;
        `, [day, month, year, username, userId]);
        
        await interaction.editReply(`Your birthday has been updated to ${month}/${day}/${year}.`);
      
      // Assign zodiac role
      const roleResult = await assignZodiacRole(interaction.guild, userId, day, month);
      if (roleResult.success) {
        await interaction.followUp({
          content: `You've been assigned the ${roleResult.zodiacSign} role based on your birthday!`,
          ephemeral: true
        });
      }
      } else {
        // Insert new birthday
        await pool.query(`
          INSERT INTO server_${serverId}.birthdays (user_id, username, birth_day, birth_month, birth_year) 
          VALUES ($1, $2, $3, $4, $5);
        `, [userId, username, day, month, year]);
        
        const yearText = year ? `/${year}` : '';
        await interaction.editReply(`Your birthday has been set to ${month}/${day}${yearText}.`);
      
      // Assign zodiac role
      const roleResult = await assignZodiacRole(interaction.guild, userId, day, month);
      if (roleResult.success) {
        await interaction.followUp({
          content: `You've been assigned the ${roleResult.zodiacSign} role based on your birthday!`,
          ephemeral: true
        });
      }
      }
      
      // Check if today is the user's birthday
      const today = new Date();
      const todayDay = today.getDate();
      const todayMonth = today.getMonth() + 1; // JavaScript months are 0-indexed
      
      if (day === todayDay && month === todayMonth) {
        // Get the announcement channel for this server
        const serverInfo = await pool.query('SELECT announcement_channel_id FROM servers WHERE server_id = $1', [serverId]);
        
        if (serverInfo.rows.length > 0 && serverInfo.rows[0].announcement_channel_id) {
          const channelId = serverInfo.rows[0].announcement_channel_id;
          const channel = await interaction.client.channels.fetch(channelId);
          
          if (channel) {
            const age = year ? today.getFullYear() - year : null;
            const ageText = age ? ` They are turning ${age} today!` : '';
            
            await channel.send(`🎉 Happy Birthday to <@${userId}>!${ageText} 🎂`);
            
            // Let the user know their birthday was announced
            await interaction.followUp({ 
              content: `Since today is your birthday, I've sent a birthday announcement to the server!`, 
              ephemeral: true 
            });
          }
        }
      }
    } catch (error) {
      console.error('Error in set_birthday command:', error);
      await interaction.editReply('There was an error setting your birthday. Please try again later.');
    }
  },
};