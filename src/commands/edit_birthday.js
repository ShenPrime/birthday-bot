const { SlashCommandBuilder } = require('discord.js');
const { assignZodiacRole } = require('../utils/zodiacUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('edit_birthday')
    .setDescription('Edit your birthday')
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
        .setMaxValue(new Date().getFullYear()))
    .addStringOption(option =>
      option.setName('timezone')
        .setDescription('Your timezone (e.g. America/New_York)')
        .setRequired(false)
        .setAutocomplete(true)),
  
  async execute(interaction, pool) {
    try {
      await interaction.deferReply({ ephemeral: true });
      
      const serverId = interaction.guildId;
      const userId = interaction.user.id;
      const username = interaction.user.username;
      const day = interaction.options.getInteger('day');
      const month = interaction.options.getInteger('month');
      const year = interaction.options.getInteger('year') || null;
      const timezone = interaction.options.getString('timezone') || 'UTC';
      
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
      
      // Check if user has a birthday set
      const userCheck = await pool.query(`
        SELECT * FROM server_${serverId}.birthdays WHERE user_id = $1;
      `, [userId]);
      
      if (userCheck.rows.length === 0) {
        return await interaction.editReply('You have not set your birthday yet. Please use the /set_birthday command first.');
      }
      
      // Update birthday
      await pool.query(`
        UPDATE server_${serverId}.birthdays 
        SET birth_day = $1, birth_month = $2, birth_year = $3, username = $4, timezone = $5 
        WHERE user_id = $6;
      `, [day, month, year, username, timezone, userId]);
      
      const yearText = year ? `/${year}` : '';
      await interaction.editReply(`Your birthday has been updated to ${month}/${day}${yearText}.`);
      
      // Assign zodiac role
      const roleResult = await assignZodiacRole(interaction.guild, userId, day, month);
      if (roleResult.success) {
        await interaction.followUp({
          content: `You've been assigned the ${roleResult.zodiacSign} role based on your birthday!`,
          ephemeral: true
        });
      }
      
      // Check if today is the user's birthday in the user's timezone
      const now = new Date();
      const userDate = new Date(now.toLocaleString('en-US', {
        timeZone: timezone || 'UTC'
      }));
      
      const userDay = userDate.getDate();
      const userMonth = userDate.getMonth() + 1; // JavaScript months are 0-indexed
      
      if (day === userDay && month === userMonth) {
        // Get the announcement channel for this server
        const serverInfo = await pool.query('SELECT announcement_channel_id FROM servers WHERE server_id = $1', [serverId]);
        
        if (serverInfo.rows.length > 0 && serverInfo.rows[0].announcement_channel_id) {
          const channelId = serverInfo.rows[0].announcement_channel_id;
          
          // Use the shared function to check and announce birthday
          const announced = await interaction.client.checkAndAnnounceUserBirthday(serverId, userId, channelId);
          
          if (announced) {
            // Let the user know their birthday was announced
            await interaction.followUp({ 
              content: `Since today is your birthday, I've sent a birthday announcement to the server!`, 
              ephemeral: true 
            });
          }
        }
      }
    } catch (error) {
      console.error('Error in edit_birthday command:', error);
      await interaction.editReply('There was an error editing your birthday. Please try again later.');
    }
  },
};