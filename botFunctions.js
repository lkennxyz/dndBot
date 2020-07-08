const mongoose = require('mongoose');
const axios = require('axios');
const fnExport = module.exports = {};

async function dbConnect() {
  const username = process.env.DB_USER;
  const password = process.env.DB_PW;
  const url = process.env.DB_URL.replace('<username>', username).replace('<password>', password)
  try {
    await mongoose.connect(url,
      {useNewUrlParser: true});
    const db = mongoose.connection;
    db.on('error', console.error('DB Connection Error'));
    db.once('open', () => {
      console.log('Connected to DB');
    });
  } catch (err) {
    console.error(err);
  }

}

function dbClose() {
  const db = mongoose.connection;
  db.close();
}

function setItemSchema() {
  const Schema = mongoose.Schema;
  const itemSchema = new Schema({
    description: String,
  });
  const Item = mongoose.model('Items', itemSchema, 'MagicItems');
  return Item;
}

function setNameSchema() {
  const Schema = mongoose.Schema;
  const nameSchema = new Schema({
    male: String,
    female: String,
    surname: String,
  });
}

fnExport.rollDice = function (num, size) {
  let total = 0;
  const rolls = [];
  for (let i = 0; i < num; i++) {
    const roll = size != '%' ? 
      Math.floor(Math.random() * size + 1) :
      10 * (Math.floor(Math.random() * 10 + 1)) + (Math.floor(Math.random() * 10 + 1));
    total += roll;
    rolls.push(roll);
  }
  return {total, rolls};
}

fnExport.suggestItem = async function (description) {
  dbConnect();
  const Item = setItemSchema();
  const suggestion = new Item({description});
  await suggestion.save((err) => {
    if (err) return console.error(err);
    dbClose();
  });
}

async function apiSearch(type, words) {
  try {
    const res1 = await axios.get(`http://dnd5eapi.co/api/${type}`)
    const results = res1.data.results;
    const selection = await results.find(result => result.name.toLowerCase() === words.join(' ').toLowerCase());
    if (!selection)
      return 'Sorry I couldn\'t find that';
    const res = await axios.get(selection.url);
    return res.data;
  } catch (err) {
    console.error(err);
  }
}

fnExport.spells = async function (query) {
  const result = await apiSearch('spells', query);
  if (!result.name)
    return result;
  const reply = `${result.name}\n`
    + `Description: ${result.desc}\n`
    + `Range: ${result.range}\n`
    + `Components: ${result.components}\n`
    + `Material: ${result.material}\n`
    + `Higher Level: ${result.higher_level}\n`;
  return reply;
}

fnExport.features = async function (query) {
  const result = await apiSearch('features', query);
  if (!result.name)
    return result;
  const reply = `${result.name}\n`
    + `Description: ${result.desc}\n`;
  return reply;
}

fnExport.items = async function (query) {
  const result = await apiSearch('equipment', query);
  if (!result.name)
    return result;
  let reply = '';
  if (result.equipment_category === 'Weapon') {
    reply = `${result.name}\n`
      + `${result.category_range} ${result.equipment_category}\n`
      + `${result.damage.dice_count}d${result.damage.dice_value} ${result.damage.damage_type.name} Damage\n`
      + `Range: ${(result.range.long) ? result.range.normal + '/' + result.range.long : result.range.normal}\n`
      + `Properties: ${result.properties.map(el => el.name).join(', ')}\n`
      + `Cost: ${result.cost.quantity}${result.cost.unit}`;
  } else if (result.equipment_category === 'Armor') {
    reply = `${result.name}\n`
      + `${result.armor_category} ${result.equipment_category}\n`
      + `${result.armor_class.base}AC`
      + `${(result.armor_class.dex_bonus) ? ' + DEX\n' : '\n'}`
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
