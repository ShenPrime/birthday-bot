const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('list_birthdays')
    .setDescription('List all registered birthdays in this server'),
  
  async execute(interaction, pool) {
    try {
      await interaction.deferReply();
      
      const serverId = interaction.guildId;
      
      // Check if schema exists for this server
      const schemaCheck = await pool.query(`
        SELECT schema_name FROM information_schema.schemata 
        WHERE schema_name = 'server_${serverId}';
      `);
      
      if (schemaCheck.rows.length === 0) {
        return await interaction.editReply('The birthday bot has not been set up for this server yet. Please ask an admin to run the /setup_birthday_boi command first.');
      }
      
      // Get all birthdays for this server
      const birthdaysResult = await pool.query(`
        SELECT * FROM server_${serverId}.birthdays ORDER BY birth_month, birth_day;
      `);
      
      if (birthdaysResult.rows.length === 0) {
        return await interaction.editReply('No birthdays have been registered in this server yet.');
      }
      
      // Create embed for birthdays list
      const embed = new EmbedBuilder()
        .setTitle('🎂 Registered Birthdays 🎂')
        .setColor('#FF69B4')
        .setDescription('Here are all the registered birthdays in this server:')
        .setTimestamp();
      
      // Group birthdays by month
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      
      const birthdaysByMonth = {};
      
      for (const birthday of birthdaysResult.rows) {
        const monthName = months[birthday.birth_month - 1];
        if (!birthdaysByMonth[monthName]) {
          birthdaysByMonth[monthName] = [];
        }
        
        const yearText = birthday.birth_year ? ` (${birthday.birth_year})` : '';
        birthdaysByMonth[monthName].push(`<@${birthday.user_id}>: ${birthday.birth_day}${yearText}`);
      }
      
      // Add fields for each month that has birthdays
      for (const month of months) {
        if (birthdaysByMonth[month]) {
          embed.addFields({
            name: month,
            value: birthdaysByMonth[month].join('\n'),
            inline: true
          });
        }
      }
      
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in list_birthdays command:', error);
      await interaction.editReply('There was an error listing birthdays. Please try again later.');
    }
  },
};