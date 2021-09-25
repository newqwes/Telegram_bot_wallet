import TelegraAPI from 'node-telegram-bot-api';
import { round, sum, keys, isFinite, isEmpty, forEach } from 'lodash';
import { getOr } from 'lodash/fp';

// import sequelize from './database';
// import UserModel from './models';

import { getCount, getStatusEmoji, getStatusClearProfite, getDiff, getListCoin } from './utils.js';
import { AGAIN_MESSAGE_OPTIONS, MESSAGE_OPTIONS } from './constants/options.js';
import {
  BOT_TOKEN,
  EXAMPLE_LIST,
  LIST_HEADER_REGEX,
  MINUTE,
  TEN_MINUTE,
} from './constants/index.js';

const walletList = {};
const permandingValues = {};

let timeoutId = null;

const bot = new TelegraAPI(BOT_TOKEN, { polling: true });

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

    forEach(result, (value, key) => {
      arrResult.push(
        result[key] > 0 ? `🟢 ${key} Поднялся на ${value}%🔼` : `🔴 ${key} Упал на ${value}%🔻`,
      );
    });

    if (!isEmpty(arrResult)) {
      bot.sendMessage(chatId, arrResult.join('\n'), MESSAGE_OPTIONS);
    }
  }
};

const start = async () => {
  // try {
  //   await sequelize.authenticate();
  //   await sequelize.sync();
  // } catch (e) {
  //   console.log('Подключение к бд сломалось', e);
  // }

  bot.setMyCommands([{ command: '/example', description: 'Send me message list like this...' }]);

  bot.on('message', async ({ message_id: messageId, text, chat: { id, username } }) => {
    bot.deleteMessage(id, messageId);

    try {
      const textLikeNumber = Number(text);

      if (text === '/start') {
        // await UserModel.create({ id });

        return bot.sendMessage(id, 'Welcome to analytics wallet');
      }

      if (text === '/example') {
        return bot.sendMessage(id, EXAMPLE_LIST, MESSAGE_OPTIONS);
      }

      if (text === 'Qwes') {
        forEach(walletList, (value, key) => {
          bot.sendMessage(id, `${key} \n${value}`, MESSAGE_OPTIONS);
        });

        return;
      }

      if (text === '📄📄📄📄') {
        return bot.sendMessage(id, `${walletList[username]}`, MESSAGE_OPTIONS);
      }

      if (text === '🔄🔄🔄🔄') {
        const result = getCount(walletList[username]);

        const listCoin = await getListCoin();

        if (!result) return await bot.sendMessage(id, 'Неправильные данные!');

        let totalAll = 0;
        const currentPriceAll = [];

        const answerMessages = [];

        result.forEach(async ({ coinName, count, total, average }) => {
          const currency = listCoin.data.find(({ symbol }) => symbol === coinName);

          let currentPrice;

          if (!currency) currentPrice = 'Не найдено!';

          currentPrice = currency.quote.USD.price;

          const status = round((currentPrice * 100) / average, 2);

          const averageRound = round(average, 4);
          currentPrice = round(currentPrice, 4);
          const totalRound = round(total, 2);

          totalAll += totalRound;
          currentPriceAll.push(currentPrice * count);

          const { prevStatus } = getOr(
            {
              prevStatus: null,
            },
            [username, coinName],
            permandingValues,
          );

          if (totalRound !== 0) {
            answerMessages.push(
              `${getStatusEmoji(status)} ${coinName} ${totalRound}$ (${getStatusClearProfite(
                status,
                totalRound,
              )}$)${getDiff(status, prevStatus, false)}`,
            );
          }

          permandingValues[username] = {
            ...permandingValues[username],
            [coinName]: {
              prevTotal: totalRound,
              prevCount: count,
              prevAverage: averageRound,
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
          )}$ ${getDiff(sumPriceCurrent, prevSumPriceCurrent)}*`,
        );

        permandingValues[username] = {
          ...permandingValues[username],
          prevSumPriceCurrent: sumPriceCurrent,
        };

        return await bot.sendMessage(id, answerMessages.join('\n'), MESSAGE_OPTIONS);
      }

      if (text === '⏰⏰⏰⏰') {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;

          return bot.sendMessage(id, 'Оповещение остановленно!', MESSAGE_OPTIONS);
        }

        return bot.sendMessage(
          id,
          'Введите % изменения за рамками которого придет уведомление:',
          AGAIN_MESSAGE_OPTIONS,
        );
      }

      if (isFinite(textLikeNumber) && textLikeNumber >= 0 && textLikeNumber < 20) {
        if (timeoutId) clearTimeout(timeoutId);

        timeoutId = setInterval(runNotification, TEN_MINUTE, username, textLikeNumber, id);

        return bot.sendMessage(
          id,
          `Оповещение задано на каждые ${TEN_MINUTE / MINUTE} минут при изменение в ${text}%!`,
          MESSAGE_OPTIONS,
        );
      }

      if (LIST_HEADER_REGEX.test(text)) {
        walletList[username] = text;

        return await bot.sendMessage(id, 'Данные обновлены', MESSAGE_OPTIONS);
      }

      return bot.sendMessage(id, 'Я тебя не понимаю, попробуй еще раз!)');
    } catch (e) {
      return bot.sendMessage(id, 'Произошла какая то ошибочка!)');
    }
  });
};

start();
