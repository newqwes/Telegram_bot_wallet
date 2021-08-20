const dotenv = require('dotenv');
const TelegraAPI = require('node-telegram-bot-api');
const rp = require('request-promise');
const lodash = require('lodash');
const lodashfp = require('lodash/fp');

const { round, sum } = lodash;
const { getOr } = lodashfp;

dotenv.config();

const { BOT_TOKEN, AUTH_KEY } = process.env;

const utils = require('./utils.js');

const LIST_HEADER_REGEX = /Цена покупки/;

const opts = {
  parse_mode: 'markdown',
};

const requestOptions = {
  method: 'GET',
  uri: 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest',
  qs: {
    start: '1',
    limit: '20',
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

const bot = new TelegraAPI(BOT_TOKEN, { polling: true });

const walletList = {};
const permandingValues = {};

const start = async () => {
  bot.setMyCommands([
    { command: '/show', description: '📄📄📄📄📄📄📄📄📄📄' },
    { command: '/check', description: '🔄🔄🔄🔄🔄🔄🔄🔄🔄🔄' },
  ]);

  bot.on('message', async ({ message_id, text, chat: { id, username } }) => {
    bot.deleteMessage(id, message_id);

    try {
      if (text === '/show') {
        return bot.sendMessage(id, `${walletList[username]}`, opts);
      }

      if (text === '/check') {
        const result = utils.count(walletList[username]);

        const listCoin = await getListCoin();

        if (!result) return await bot.sendMessage(id, 'Неправильные данные!');

        let totalAll = 0;
        let currentPriceAll = [];

        const answerMessages = [];

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

          const { prevTotal, prevCount, prevAverage, prevCurrentPrice, prevStatus } = getOr(
            {
              prevTotal: null,
              prevCount: null,
              prevAverage: null,
              prevCurrentPrice: null,
              prevStatus: null,
            },
            [username, coinName],
            permandingValues,
          );

          if (total !== 0) {
            answerMessages.push(
              `В *${coinName}* ты всего вложил: *${total}$${utils.getDiff(
                total,
                prevTotal,
              )}*\nУ тебя: *${round(count, 6)}${utils.getDiff(
                count,
                prevCount,
              )}${coinName}*\nСр. покупки: *${average}$${utils.getDiff(
                average,
                prevAverage,
              )}*\nТекущая стоимость: *${currentPrice}$${utils.getDiff(
                currentPrice,
                prevCurrentPrice,
              )}*\nСтатус: *${status}%${utils.getDiff(status, prevStatus, false)}*\n`,
            );
          }

          permandingValues[username] = {
            ...permandingValues[username],
            [coinName]: {
              prevTotal: total,
              prevCount: count,
              prevAverage: average,
              prevCurrentPrice: currentPrice,
              prevStatus: status,
            },
          };
        });

        const sumPriceCurrent = round(sum(currentPriceAll), 2);

        const { prevSumPriceCurrent } = permandingValues[username];

        answerMessages.push(
          `Всего вложил: *${round(totalAll, 2)}*$\nСостояние кошелька: ${round(
            sumPriceCurrent,
            2,
          )}$${utils.getDiff(sumPriceCurrent, prevSumPriceCurrent)}`,
        );

        permandingValues[username] = {
          ...permandingValues[username],
          prevSumPriceCurrent: sumPriceCurrent,
        };

        return await bot.sendMessage(id, answerMessages.join('\n'), opts);
      }

      if (LIST_HEADER_REGEX.test(text)) {
        walletList[username] = text;

        return await bot.sendMessage(id, 'Данные обновлены', opts);
      }

      return bot.sendMessage(id, 'Я тебя не понимаю, попробуй еще раз!)');
    } catch (e) {
      return bot.sendMessage(id, 'Произошла какая то ошибочка!)');
    }
  });
};

start();
