/**
 * Utility functions for zodiac sign determination and role management
 */

/**
 * Determines the zodiac sign based on day and month
 * @param {number} day - The day of birth
 * @param {number} month - The month of birth (1-12)
 * @returns {string} The zodiac sign
 */
function getZodiacSign(day, month) {
  // Define zodiac sign date ranges
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'Aries';
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'Taurus';
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'Gemini';
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'Cancer';
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'Leo';
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'Virgo';
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'Libra';
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'Scorpio';
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'Sagittarius';
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return 'Capricorn';
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'Aquarius';
  if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return 'Pisces';
  
  // Default fallback (should never reach here if valid date)
  return 'Unknown';
}

/**
 * Ensures all zodiac sign roles exist in the guild and are positioned at the bottom of the hierarchy
 * @param {Object} guild - The Discord guild object
 * @returns {Promise<boolean>} Success status
 */
async function ensureZodiacRoles(guild) {
  try {
    const zodiacSigns = [
      'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
      'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
    ];
    
    // Get all existing roles
    const existingRoles = await guild.roles.fetch();
    
    // Create missing zodiac roles
    for (const sign of zodiacSigns) {
      let role = existingRoles.find(r => r.name === sign);
      
      if (!role) {
        // Create the role if it doesn't exist
        role = await guild.roles.create({
          name: sign,
          color: getZodiacColor(sign),
          reason: 'Birthday Bot zodiac sign role',
          // Position 1 will place it just above @everyone (which is at position 0)
          position: 1
        });
        console.log(`Created ${sign} role in ${guild.name}`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error ensuring zodiac roles:', error);
    return false;
  }
}

/**
 * Assigns the appropriate zodiac sign role to a user and removes any other zodiac roles
 * @param {Object} guild - The Discord guild object
 * @param {string} userId - The user's Discord ID
 * @param {number} day - The day of birth
 * @param {number} month - The month of birth (1-12)
 * @returns {Promise<Object>} Result object with success status and message
 */
async function assignZodiacRole(guild, userId, day, month) {
  try {
    // Get the user's zodiac sign
    const zodiacSign = getZodiacSign(day, month);
    
    // Ensure all zodiac roles exist
    await ensureZodiacRoles(guild);
    
    // Get the member
    const member = await guild.members.fetch(userId);
    if (!member) {
      return { success: false, message: 'Member not found' };
    }
    
    // Get all zodiac roles
    const allZodiacRoles = [
      'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
      'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
    ];
    
    // Get the roles collection
    const roles = await guild.roles.fetch();
    
    // Find the target zodiac role
    const targetRole = roles.find(r => r.name === zodiacSign);
    if (!targetRole) {
      return { success: false, message: `Could not find the ${zodiacSign} role` };
    }
    
    // Remove any existing zodiac roles
    const memberRoles = member.roles.cache;
    const zodiacRolesToRemove = memberRoles.filter(role => 
      allZodiacRoles.includes(role.name) && role.name !== zodiacSign
    );
    
    if (zodiacRolesToRemove.size > 0) {
      await member.roles.remove(zodiacRolesToRemove);
    }
    
    // Add the new zodiac role if they don't already have it
    if (!memberRoles.has(targetRole.id)) {
      await member.roles.add(targetRole);
    }
    
    return { 
      success: true, 
      message: `Assigned ${zodiacSign} role to ${member.user.username}`,
      zodiacSign
    };
  } catch (error) {
    console.error('Error assigning zodiac role:', error);
    return { success: false, message: 'Error assigning zodiac role' };
  }
}

/**
 * Removes all zodiac roles from a user
 * @param {Object} guild - The Discord guild object
 * @param {string} userId - The user's Discord ID
 * @returns {Promise<Object>} Result object with success status and message
 */
async function removeZodiacRoles(guild, userId) {
  try {
    // Get all zodiac signs
    const zodiacSigns = [
      'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
      'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
    ];
    
    // Get the member
    const member = await guild.members.fetch(userId);
    if (!member) {
      return { success: false, message: 'Member not found' };
    }
    
    // Get the roles collection
    const roles = await guild.roles.fetch();
    
    // Find all zodiac roles the member has
    const memberRoles = member.roles.cache;
    const zodiacRolesToRemove = memberRoles.filter(role => 
      zodiacSigns.includes(role.name)
    );
    
    if (zodiacRolesToRemove.size > 0) {
      await member.roles.remove(zodiacRolesToRemove);
      return { 
        success: true, 
        message: `Removed zodiac roles from ${member.user.username}` 
      };
    }
    
    return { 
      success: true, 
      message: `${member.user.username} had no zodiac roles to remove` 
    };
  } catch (error) {
    console.error('Error removing zodiac roles:', error);
    return { success: false, message: 'Error removing zodiac roles' };
  }
}

/**
 * Gets a color for each zodiac sign
 * @param {string} sign - The zodiac sign
 * @returns {string} Hex color code
 */
function getZodiacColor(sign) {
  const colors = {
    'Aries': '#FF0000', // Red
    'Taurus': '#00FF00', // Green
    'Gemini': '#FFFF00', // Yellow
    'Cancer': '#FFFFFF', // White
    'Leo': '#FFA500', // Orange
    'Virgo': '#964B00', // Brown
    'Libra': '#FFC0CB', // Pink
    'Scorpio': '#800000', // Maroon
    'Sagittarius': '#800080', // Purple
    'Capricorn': '#000000', // Black
    'Aquarius': '#0000FF', // Blue
    'Pisces': '#40E0D0'  // Turquoise
  };
  
  return colors[sign] || '#808080'; // Default to gray if not found
}

module.exports = {
  getZodiacSign,
  ensureZodiacRoles,
  assignZodiacRole,
  removeZodiacRoles
};