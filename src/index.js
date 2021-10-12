import TelegraAPI from 'node-telegram-bot-api';
import { round, sum, keys, isFinite, isEmpty, forEach, sortBy } from 'lodash';
import { getOr } from 'lodash/fp';
import fs from 'fs';

import { getCount, getStatusEmoji, getStatusClearProfite, getDiff, getListCoin } from './utils.js';
import { AGAIN_MESSAGE_OPTIONS, MESSAGE_OPTIONS } from './constants/options.js';
import {
  BOT_TOKEN,
  EXAMPLE_LIST,
  LIST_HEADER_REGEX,
  MINUTE,
  TEN_MINUTE,
} from './constants/index.js';

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
  bot.setMyCommands([{ command: '/example', description: 'Send me message list like this...' }]);

  bot.on('message', async ({ message_id: messageId, text, chat: { id, username } }) => {
    bot.deleteMessage(id, messageId);

    try {
      const textLikeNumber = Number(text);

      if (text === '/start') {
        return bot.sendMessage(id, 'Welcome to analytics wallet');
      }

      if (text === '/example') {
        return bot.sendMessage(id, EXAMPLE_LIST, MESSAGE_OPTIONS);
      }

      if (text === 'Qwes') {
        // forEach(walletList, (value, key) => {
        //   bot.sendMessage(id, `${key} \n${value}`, MESSAGE_OPTIONS);
        // });

        return;
      }

      if (text === '💰💰💰') {
        const sortedAnswer = sortBy(permandingValues[username], ['prevStatus']);

        console.log(sortedAnswer);

        bot.sendMessage(
          id,
          `Покупай: ${sortedAnswer[0].coinName}, ${sortedAnswer[1].coinName},${sortedAnswer[2].coinName}`,
          MESSAGE_OPTIONS,
        );
        return;
      }

      if (text === '📄📄📄') {
        fs.readFile(`${username}.txt`, 'utf8', async (err, data) => {
          if (err) return bot.sendMessage(id, 'Ваши данные не найдены, обновите их!');

          console.log(`OK: ${username}`);
          bot.sendMessage(id, `${data}`, MESSAGE_OPTIONS);
        });

        return;
      }

      if (text === '🔄🔄🔄') {
        let result;

        fs.readFile(`${username}.txt`, 'utf8', async (err, data) => {
          if (err) return bot.sendMessage(id, 'Ваши данные не найдены, обновите их!');

          console.log(`OK: ${username}`);
          result = getCount(data);
        });

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
            answerMessages.push([
              getStatusEmoji(status),
              coinName,
              totalRound,
              '$ (',
              getStatusClearProfite(status, totalRound),
              '$)',
              getDiff(status, prevStatus, false),
            ]);
          }

          permandingValues[username] = {
            ...permandingValues[username],
            [coinName]: {
              coinName,
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

        const sortedAnswer = sortBy(answerMessages, arr => arr[6]).reverse();

        sortedAnswer.push(
          `Всего вложил: *${round(totalAll, 2)}*$\nСостояние кошелька: *${round(
            sumPriceCurrent,
            2,
          )}$\nДоход: ${round(sumPriceCurrent - totalAll, 2)}$ ${getDiff(
            sumPriceCurrent,
            prevSumPriceCurrent,
          )}*`,
        );

        permandingValues[username] = {
          ...permandingValues[username],
          prevSumPriceCurrent: sumPriceCurrent,
        };

        const replaceQree = sortedAnswer.map(answer => answer.toString().replace(/,/g, ' '));

        return await bot.sendMessage(id, replaceQree.join('\n'), MESSAGE_OPTIONS);
      }

      if (text === '⏰⏰⏰') {
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
        fs.writeFile(`${username}.txt`, text, err => {
          if (err) return console.log(err);
          console.log('save to .txt');
        });

        return await bot.sendMessage(id, 'Данные обновлены', MESSAGE_OPTIONS);
      }

      return bot.sendMessage(id, 'Я тебя не понимаю, попробуй еще раз!)');
    } catch (e) {
      return bot.sendMessage(id, 'Произошла какая то ошибочка!)');
    }
  });
};

start();
