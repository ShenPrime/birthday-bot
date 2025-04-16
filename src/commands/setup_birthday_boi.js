const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup_birthday_boi')
    .setDescription('Setup the birthday bot for this server')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('The channel where birthday announcements will be sent')
        .setRequired(true)),
  
  async execute(interaction, pool, createServerSchema) {
    try {
      await interaction.deferReply();
      
      const serverId = interaction.guildId;
      const channelId = interaction.options.getChannel('channel').id;
      
      // Check if server already exists in database
      const serverCheck = await pool.query('SELECT * FROM servers WHERE server_id = $1', [serverId]);
      
      if (serverCheck.rows.length > 0) {
        // Update existing server
        await pool.query(
          'UPDATE servers SET announcement_channel_id = $1 WHERE server_id = $2',
          [channelId, serverId]
        );
      } else {
        // Insert new server
        await pool.query(
          'INSERT INTO servers (server_id, announcement_channel_id) VALUES ($1, $2)',
          [serverId, channelId]
        );
      }
      
      // Create schema and tables for this server
      const schemaCreated = await createServerSchema(serverId);
      
      if (schemaCreated) {
        await interaction.editReply(`Birthday bot has been set up successfully! Birthday announcements will be sent to <#${channelId}>.`);
      } else {
        await interaction.editReply('There was an error setting up the birthday bot. Please try again later.');
      }
    } catch (error) {
      console.error('Error in setup_birthday_boi command:', error);
      await interaction.editReply('There was an error setting up the birthday bot. Please try again later.');
    }
  },
};