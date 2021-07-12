const dotenv = require('dotenv');
const TelegraAPI = require('node-telegram-bot-api');
const rp = require('request-promise');
const lodash = require('lodash');

dotenv.config();

const { BOT_TOKEN, AUTH_KEY } = process.env;
const { round, sum } = lodash;

const requestOptions = {
  method: 'GET',
  uri: 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest',
  qs: {
    start: '1',
    limit: '10',
    convert: 'USD',
  },
  headers: {
    'X-CMC_PRO_API_KEY': AUTH_KEY,
  },
  json: true,
  gzip: true,
};

const getListCoin = async () => {
  try {
    const listCoin = await rp(requestOptions);

    return listCoin;
  } catch (error) {
    console.log('API call error:', error.message);
  }
};

const utils = require('./utils.js');

const bot = new TelegraAPI(BOT_TOKEN, { polling: true });

bot.on('message', async ({ text, chat: { id } }) => {
  const result = utils.count(text);

  const opts = {
    parse_mode: 'markdown',
  };

  const listCoin = await getListCoin();

  if (!result) return await bot.sendMessage(id, 'Неправильные данные!');

  let totalAll = 0;
  let currentPriceAll = [];

  result.forEach(async ({ coinName, count, total, average }) => {
    const currency = listCoin.data.find(({ symbol }) => symbol === coinName);

    let currentPrice;

    if (!currency) currentPrice = 'Не найдено!';

    currentPrice = currency.quote.USD.price;

    const status = round((currentPrice * 100) / average, 2);

    average = round(average, 4);
    currentPrice = round(currentPrice, 4);
    total = round(total, 2);

    totalAll += total;
    currentPriceAll.push(currentPrice * count);

    await bot.sendMessage(
      id,
      `В *${coinName}* ты всего вложил: *${total} $*;\nУ тебя: *${count} ${coinName}*;\nСр. покупки: *${average} $*;\nТекущая стоимость: *${currentPrice} $*;\nСтатус: *${status}%*;\n`,
      opts,
    );
  });

  const sumPriceCurrent = round(sum(currentPriceAll), 2);

  return await bot.sendMessage(
    id,
    `Всего вложил: *${totalAll}* $;\nСостояние кошелька: ${sumPriceCurrent} $`,
    opts,
  );
});
