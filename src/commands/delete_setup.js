const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delete_setup')
    .setDescription('Delete all server data from the database')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Only administrators can use this command
  
  async execute(interaction, pool) {
    try {
      await interaction.deferReply({ ephemeral: true });
      
      const serverId = interaction.guildId;
      
      // Check if server exists in the servers table
      const serverCheck = await pool.query('SELECT * FROM servers WHERE server_id = $1', [serverId]);
      
      if (serverCheck.rows.length === 0) {
        return await interaction.editReply('The birthday bot has not been set up for this server yet.');
      }
      
      // Check if schema exists for this server
      const schemaCheck = await pool.query(`
        SELECT schema_name FROM information_schema.schemata 
        WHERE schema_name = 'server_${serverId}';
      `);
      
      if (schemaCheck.rows.length === 0) {
        // If no schema exists, just delete from servers table
        await pool.query('DELETE FROM servers WHERE server_id = $1', [serverId]);
        return await interaction.editReply('Server configuration has been deleted successfully.');
      }
      
      // Delete server data in a transaction to ensure atomicity
      await pool.query('BEGIN');
      
      try {
        // Drop the server schema (this will delete all tables within it)
        await pool.query(`DROP SCHEMA server_${serverId} CASCADE;`);
        
        // Delete server from servers table
        await pool.query('DELETE FROM servers WHERE server_id = $1', [serverId]);
        
        // Commit the transaction
        await pool.query('COMMIT');
        
        await interaction.editReply('All server data has been deleted successfully. The birthday bot setup and all birthday data for this server have been removed.');
      } catch (error) {
        // Rollback in case of error
        await pool.query('ROLLBACK');
        console.error('Error in delete_setup transaction:', error);
        await interaction.editReply('There was an error deleting server data. Please try again later.');
      }
    } catch (error) {
      console.error('Error in delete_setup command:', error);
      await interaction.editReply('There was an error deleting server data. Please try again later.');
    }
  },
};