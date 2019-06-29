const TelegramBot = require('node-telegram-bot-api');
const { rollDice, suggestItem, spells, features, items } = require('./botFunctions');

const token = process.env.TELEGRAM_BOT_TOKEN;
const options = {
  webHook: {
    port: process.env.PORT,
  }
};


const herokuUrl = process.env.APP_URL || 'https://lif-bot.herokuapp.com:443';
const bot = new TelegramBot(token, options);
bot.setWebHook(`${herokuUrl}/bot${token}`);

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const reply = '/roll <arg> - rolls the number and size of dice you enter, e.g. 1d6\n'
    +'/suggest <arg> - suggests a magic item to be saved, give as much description as you can\n'
    +'/players - lists the player names, classes and races\n'
    +'/search [spells/features/items] <args> - search for information on a spell or class feature'
  bot.sendMessage(chatId, reply);
});

bot.onText(/\/roll (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const dice = match[1].toLowerCase().split('d');
  const rolls = rollDice(dice[0], dice[1]);
  const rollReply = `You rolled a total of ${rolls.total}, with rolls of ${rolls.rolls}`;
  bot.sendMessage(chatId, rollReply);
});

bot.onText(/\/suggest (.+)/, (msg, match) => {
  suggestItem(match[1]);
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Thanks for the suggestion!');
});

bot.onText(/\/players/, (msg) => {
  const chatId = msg.chat.id;
  const players = 'Jack: Salleek - Aarakocra - Monk\n'
  +'Rory: Thinkkibrick - Gnome - Warlock\n'
  +'Jake: Valen Narse - Half-Elf - Paladin\n'
  +'Hugh: Ibram Gaunt - Human - Fighter\n'
  +'Fraser: Keranumon - Half-Elf - Bard\n';
  bot.sendMessage(chatId, players);
});

bot.onText(/\/search (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const query = match[1].split(' ');
  let reply = '';
  if (query[0] === 'spell' || query[0] === 'spells')
    reply = await spells(query.slice(1));
  else if (query[0] === 'feature' || query[0] === 'features')
    reply = await features(query.slice(1));
  else if (query[0] === 'item' || query[0] === 'items' || query[0] === 'equipment')
    reply = await items(query.slice(1));
  bot.sendMessage(chatId, reply);
});

