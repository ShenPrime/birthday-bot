# Discord Birthday Bot

A Discord bot that manages and announces user birthdays. The bot allows users to set, edit, and delete their birthdays, and automatically announces birthdays in a designated channel.

## Features

- Users can set their birthdays via `/set_birthday` command
- Users can edit their birthdays via `/edit_birthday` command
- Users can delete their birthdays via `/delete_birthday` command
- View a list of all registered birthdays via `/list_birthdays` command
- Server setup via `/setup_birthday_boi` command
- Automatic birthday announcements
- Multi-server support with separate database schemas for each server
- PostgreSQL database for data storage

## Prerequisites

- Node.js (v16 or higher)
- PostgreSQL database
- Discord Bot Token

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file based on the `.env.example` template and fill in your Discord bot token, client ID, and PostgreSQL database credentials
4. Create a PostgreSQL database named `birthday_bot` (or whatever you specified in your `.env` file)
5. Start the bot:
   ```
   npm start
   ```

## Discord Bot Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Navigate to the "Bot" tab and create a bot
4. Copy the bot token and add it to your `.env` file
5. Enable the "SERVER MEMBERS INTENT" under the Privileged Gateway Intents section
6. Navigate to the "OAuth2" tab
7. Under "URL Generator", select the "bot" and "applications.commands" scopes
8. Select the "Send Messages" and "Read Messages/View Channels" permissions
9. Copy the generated URL and use it to invite the bot to your server

## Server Setup

After inviting the bot to your server, run the `/setup_birthday_boi` command and select the channel where you want birthday announcements to be sent.

## Usage

- `/set_birthday day:[1-31] month:[1-12] year:[year]` - Set your birthday
- `/edit_birthday day:[1-31] month:[1-12] year:[year]` - Edit your birthday
- `/delete_birthday` - Delete your birthday
- `/list_birthdays` - List all registered birthdays in the server
- `/setup_birthday_boi channel:[channel]` - Set up the bot for the server

## License

MIT