const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const axios = require('axios');

const token = process.env.TELEGRAM_BOT_TOKEN;
const options = {
  webHook: {
    port: process.env.PORT,
  }
};

const Item = setSchema();

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
  const dice = match[1].split('d');
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

function rollDice(num, size) {
  let total = 0;
  const rolls = [];
  for (let i = 0; i < num; i++) {
      const roll = Math.floor(Math.random() * size + 1);
      total += roll;
      rolls.push(roll);
  }
  return { total, rolls };
}

async function suggestItem(description) {
  dbConnect();
  const suggestion = new Item({ description });
  await suggestion.save((err) => {
    if (err) return console.error(err);
    dbClose();
  });
}

async function dbConnect() {
  const username = process.env.DB_USER;
  const password = process.env.DB_PW;
  try {
    await mongoose.connect(`mongodb+srv://${username}:${password}@cluster0-dxoyz.mongodb.net/DNDDB?retryWrites=true&w=majority`,
      { useNewUrlParser: true });
    const db = mongoose.connection;
    db.on('error', console.error.bind(console, 'DB Connection Error'));
    db.once('open', () => {
      console.log.bind(console, 'Connected to DB');
    });
  } catch (err) {
    console.error(err);
  }
  
}

function dbClose() {
  const db = mongoose.connection;
  db.close();
}

function setSchema() {
  const Schema = mongoose.Schema;
  const itemSchema = new Schema({
    description: String,
  });
  const Item = mongoose.model('Items', itemSchema, 'MagicItems');
  return Item;
}

async function apiSearch(type, words) {
  try {
    const res1 = await axios.get(`http://dnd5eapi.co/api/${type}`)
    const results = res1.data.results;
    const selection = await results.find(result => result.name.toLowerCase() === words.join(' ').toLowerCase());
    const res = await axios.get(selection.url);
    return res.data;
  } catch (err) {
    console.error(err);
  }
}

async function spells(query) {
  const result = await apiSearch('spells', query);
  const reply = `${result.name}\n`
    + `Description: ${result.desc}\n`
    + `Range: ${result.range}\n`
    + `Components: ${result.components}\n`
    + `Material: ${result.material}\n`
    + `Higher Level: ${result.higher_level}\n`;
  return reply;
}

async function features(query) {
  const result = await apiSearch('features', query);
  const reply = `${result.name}\n`
    +`Description: ${result.desc}\n`;
  return reply;
}

async function items(query) {
  const result = await apiSearch('equipment', query);
  let reply = '';
  if (result.equipment_category === 'Weapon') {
    reply = `${result.name}\n`
      + `${result.category_range} ${result.equipment_category}\n`
      + `${result.damage.dice_count}d${result.damage.dice_value} ${result.damage.damage_type.name} Damage\n`
      + `Range: ${(result.range.long)? result.range.normal + '/' + result.range.long : result.range.normal}\n`
      + `Properties: ${result.properties.map(el => el.name).join(', ')}\n`
      + `Cost: ${result.cost.quantity}${result.cost.unit}`;
  } else if (result.equipment_category === 'Armor') {
    reply = `${result.name}\n`
      + `${result.armor_category} ${result.equipment_category}\n`
      + `${result.armor_class.base}AC`
      + `${(result.armor_class.dex_bonus) ? 'DEX\n' : '\n'}`
      + `Cost: ${result.cost.quantity}${result.cost.unit}\n`;
      + `${(result.str_minimum > 0) ? 'MinimumStrength: result.str_minimum\n' : ''}`
      + `${(result.stealth_disadvantage) ? 'Stealth Disadvantage' : ''}`
  } else if (result.equipment_category === 'Adventuring Gear') {
    reply = `${result.name}\n`
      + `Description: ${result.desc.join(' ')}\n`
      + `Cost: ${result.cost.quantity}${result.cost.unit}`;
  } else {
    reply = `Sorry, I couldn't find anything with the name ${query.join(' ')}`
  }
  return reply;
}