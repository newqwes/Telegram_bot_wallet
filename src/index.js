const dotenv = require('dotenv');
const TelegraAPI = require('node-telegram-bot-api');
const rp = require('request-promise');
const lodash = require('lodash');
const lodashfp = require('lodash/fp');

const { round, sum, keys, isFinite } = lodash;
const { getOr } = lodashfp;

dotenv.config();

const { BOT_TOKEN, AUTH_KEY } = process.env;

const utils = require('./utils.js');
const { isEmpty } = require('lodash');

const LIST_HEADER_REGEX = /Цена покупки/;

let timeoutId = null;

const EXAMPLE_LIST = `
Цена покупки

XRP 300 = 1.66807
DOGE 2000 = 0.62987
DOGE -1000 = 0.9999
`;

const MINUTE = 1000 * 60;
const TEN_MINUTE = MINUTE * 10;

const opts = {
  parse_mode: 'markdown',
  reply_markup: {
    resize_keyboard: true,
    keyboard: [['🔄🔄🔄🔄', '📄📄📄📄', '⏰⏰⏰⏰']],
  },
};

const againOptions = {
  parse_mode: 'markdown',
  reply_markup: {
    resize_keyboard: true,
    keyboard: [['0.1', '1', '2', '3', '4', '5', '6', '7', '8']],
  },
};

const requestOptions = {
  method: 'GET',
  uri: 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest',
  qs: {
    start: '1',
    limit: '350',
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

const runNotification = async (username, trigerPersent, chatId) => {
  const myPermandingValues = getOr(null, [username], permandingValues);

  if (myPermandingValues) {
    const listCoin = await getListCoin();
    const myCoinsName = keys(myPermandingValues);
    const result = {};

    myCoinsName.forEach(myCoinName => {
      const currency = listCoin.data.find(({ symbol }) => symbol === myCoinName);

      if (!currency) return;

      const currentPrice = getOr(null, ['quote', 'USD', 'price'], currency);

      if (!currentPrice) return;

      const prevCurrentPrice = getOr(null, [myCoinName, 'prevCurrentPrice'], myPermandingValues);

      if (!prevCurrentPrice) return;

      const changesPricePersent = round((currentPrice * 100) / prevCurrentPrice - 100, 4);

      if (changesPricePersent > trigerPersent) {
        result[myCoinName] = changesPricePersent;
      }

      if (changesPricePersent < -trigerPersent) {
        result[myCoinName] = changesPricePersent;
      }
    });

    const arrResult = [];

    for (key in result) {
      arrResult.push(
        result[key] > 0
          ? `🟢 ${key} Поднялся на ${result[key]}%🔼`
          : `🔴 ${key} Упал на ${result[key]}%🔻`,
      );
    }

    if (!isEmpty(arrResult)) {
      bot.sendMessage(chatId, arrResult.join('\n'), opts);
    }
  }
};

const start = async () => {
  bot.setMyCommands([{ command: '/example', description: 'Send me message list like this...' }]);

  bot.on('message', async ({ message_id, text, chat: { id, username } }) => {
    bot.deleteMessage(id, message_id);

    try {
      const textLikeNumber = Number(text);

      if (text === '/example') {
        console.log(id);
        return bot.sendMessage(id, EXAMPLE_LIST, opts);
      }

      if (text === 'Qwes') {
        for (const key in walletList) {
          bot.sendMessage(id, `${key} \n${walletList[key]}`, opts);
        }

        return;
      }

      if (text === '📄📄📄📄') {
        return bot.sendMessage(id, `${walletList[username]}`, opts);
      }

      if (text === '🔄🔄🔄🔄') {
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

          const { prevStatus } = getOr(
            {
              prevStatus: null,
            },
            [username, coinName],
            permandingValues,
          );

          if (total !== 0) {
            answerMessages.push(
              `${utils.getStatusEmoji(status)} ${coinName} ${total}$ (${utils.getStatusClearProfite(
                status,
                total,
              )}$)${utils.getDiff(status, prevStatus, false)}`,
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

      if (text === '⏰⏰⏰⏰') {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;

          return bot.sendMessage(id, 'Оповещение остановленно!', opts);
        }

        return bot.sendMessage(
          id,
          'Введите % изменения за рамками которого придет уведомление:',
          againOptions,
        );
      }

      if (isFinite(textLikeNumber) && textLikeNumber >= 0 && textLikeNumber < 9) {
        timeoutId = setInterval(runNotification, TEN_MINUTE, username, textLikeNumber, id);

        return bot.sendMessage(
          id,
          `Оповещение задано на каждые ${TEN_MINUTE / MINUTE} минут при изменение в ${text}%!`,
          opts,
        );
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
