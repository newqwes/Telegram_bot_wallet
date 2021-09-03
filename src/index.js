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

const EXAMPLE_LIST = `
Цена покупки

XRP 3 = 1.66807
XRP 8 = 1.66831
DOGE 2 = 0.62987
DOGE -2 = 0.66600
XRP 1 = 1.56897
ETH 0.01 = 3948.72
XRP 6 = 1.53972
ETH 0.01 = 3928.04
XRP 6 = 1.54923
ETH -0.01 = 3818.67
XRP 24 = 1.59000
XRP 1 = 1.16831
XRP 17 = 1.16255
ETH 0.01 = 2568.37
BTC 0.001 = 37896.60
XRP 40 = 0.89380
ETH 0.01 = 1960.28
XRP 30 = 0.67665
XRP 1 = 0.62000
XRP 119 = 0.63280
XRP 1 = 0.58366
XRP 39 = 0.53316
BTC -0.001 = 38594.20
ETH -0.01 = 2344.41
XRP -50 = 0.65078
XRP -40 = 0.67010
XRP -50 = 0.72624
ETH 0.01 = 2315.87
BTC 0.001 = 40258.05
XRP 130 = 0.71756
DOGE 2 = 0.20198
XRP 129 = 0.81874
DOGE 1 = 0.25489
XRP 42 = 1.1199
DOGE 3 = 0.30033
XRP 93 = 1.11808
ETH -0.01 = 2997.65
ETH -0.01 = 2997.65
BTC -0.001 = 44686.25
XRP 152 = 1.26507
DOGE 2 = 0.3260
XRP 76 = 1.25522
UNI 0.05 = 28.24946
LTC 0.07 = 300
`;

const opts = {
  parse_mode: 'markdown',
  reply_markup: {
    resize_keyboard: true,
    keyboard: [['🔄🔄🔄🔄🔄🔄', '📄📄📄📄📄📄']],
  },
};

const requestOptions = {
  method: 'GET',
  uri: 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest',
  qs: {
    start: '1',
    limit: '100',
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
  bot.setMyCommands([{ command: '/example', description: 'Send me message list like this...' }]);

  bot.on('message', async ({ message_id, text, chat: { id, username } }) => {
    bot.deleteMessage(id, message_id);

    try {
      if (text === '/example') {
        return bot.sendMessage(id, EXAMPLE_LIST, opts);
      }

      if (text === 'Qwes') {
        for (const key in walletList) {
          bot.sendMessage(id, `${key} \n${walletList[key]}`, opts);
        }

        return;
      }

      if (text === '📄📄📄📄📄📄') {
        return bot.sendMessage(id, `${walletList[username]}`, opts);
      }

      if (text === '🔄🔄🔄🔄🔄🔄') {
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
              )}*\nУ тебя: *${round(count, 3)}${utils.getDiff(
                count,
                prevCount,
              )}${coinName}*\nСр. покупки: *${average}$${utils.getDiff(
                average,
                prevAverage,
              )}*\nТекущая стоимость: *${currentPrice}$${utils.getDiff(
                currentPrice,
                prevCurrentPrice,
              )}*\n${utils.getStatusLine(status, total)}*${utils.getDiff(
                status,
                prevStatus,
                false,
              )}*\n`,
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
          `Всего вложил: *${round(totalAll, 2)}*$\nСостояние кошелька: *${round(
            sumPriceCurrent,
            2,
          )}$ ${utils.getDiff(sumPriceCurrent, prevSumPriceCurrent)}*`,
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
