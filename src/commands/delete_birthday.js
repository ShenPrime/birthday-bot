const { SlashCommandBuilder } = require('discord.js');
const { removeZodiacRoles } = require('../utils/zodiacUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delete_birthday')
    .setDescription('Delete your birthday information'),
  
  async execute(interaction, pool) {
    try {
      await interaction.deferReply({ ephemeral: true });
      
      const serverId = interaction.guildId;
      const userId = interaction.user.id;
      
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
        return await interaction.editReply('You have not set your birthday yet.');
      }
      
      // Delete birthday
      await pool.query(`
        DELETE FROM server_${serverId}.birthdays WHERE user_id = $1;
      `, [userId]);
      
      // Remove zodiac roles
      const roleResult = await removeZodiacRoles(interaction.guild, userId);
      
      await interaction.editReply('Your birthday information has been deleted.');
      
      if (roleResult.success) {
        await interaction.followUp({
          content: 'Your zodiac sign role has been removed.',
          ephemeral: true
        });
      }
    } catch (error) {
      console.error('Error in delete_birthday command:', error);
      await interaction.editReply('There was an error deleting your birthday. Please try again later.');
    }
  },
};