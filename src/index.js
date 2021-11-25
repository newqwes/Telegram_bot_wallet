import { round, sum, keys, isFinite, isEmpty, forEach } from 'lodash';
import { get, isEqual, compose, sortBy, take, join, map, getOr } from 'lodash/fp';
import fs from 'fs';

import MyBot from './config.js';

import { getCount, getStatusEmoji, getStatusClearProfite, getDiff, getListCoin } from './utils.js';
import { AGAIN_MESSAGE_OPTIONS, MESSAGE_OPTIONS } from './constants/options.js';
import { EXAMPLE_LIST, LIST_HEADER_REGEX, MINUTE, MY_CHAT, TEN_MINUTE } from './constants/index.js';

const permandingValues = {};

let timeoutId = null;

const runNotification = async (username, trigerPersent, chatId) => {
  const myPermandingValues = get([username], permandingValues);

  if (myPermandingValues) {
    const listCoin = await getListCoin();
    const myCoinsName = keys(myPermandingValues);
    const result = {};

    myCoinsName.forEach(myCoinName => {
      const currency = listCoin.data.find(({ symbol }) => isEqual(symbol, myCoinName));

      const currentPrice = get(['quote', 'USD', 'price'], currency);
      const prevCurrentPrice = get([myCoinName, 'prevCurrentPrice'], myPermandingValues);

      if (!currentPrice || !prevCurrentPrice) return;

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
      MyBot.sendMessage(chatId, arrResult.join('\n'), MESSAGE_OPTIONS);
    }
  }
};

const start = async () => {
  MyBot.setMyCommands([{ command: '/example', description: 'Send me message list like this...' }]);

  MyBot.on('message', async ({ text, chat: { id, username } }) => {
    try {
      const textLikeNumber = Number(text);

      if (text === '/start') {
        MyBot.sendMessage(MY_CHAT, `${username} ${text}`);
        return MyBot.sendMessage(id, 'Welcome to analytics wallet');
      }

      if (text === '/example') {
        MyBot.sendMessage(MY_CHAT, `${username} ${text}`);
        return MyBot.sendMessage(id, EXAMPLE_LIST, MESSAGE_OPTIONS);
      }

      if (text === '💰💰💰') {
        const sortedAnswer = compose(
          join(', '),
          map('coinName'),
          take(10),
          sortBy('prevStatus'),
          get(username),
        )(permandingValues);

        MyBot.sendMessage(
          MY_CHAT,
          `${username}\n${text}\nПокупай: ${sortedAnswer || 'Да что угодно =)'}`,
        );
        return MyBot.sendMessage(
          id,
          `Покупай: ${sortedAnswer || 'Да что угодно =)'}`,
          MESSAGE_OPTIONS,
        );
      }

      if (text === '📄📄📄') {
        fs.readFile(`${username}.txt`, 'utf8', async (err, data) => {
          if (err) return MyBot.sendMessage(id, 'Ваши данные не найдены, обновите их!');

          MyBot.sendMessage(id, `${data}`, MESSAGE_OPTIONS);

          MyBot.sendMessage(MY_CHAT, `${username}\n${text}\n${data}`);
        });

        return MyBot.sendMessage(id, 'Сделано!', MESSAGE_OPTIONS);
      }

      if (text === '🔄🔄🔄') {
        let result;

        fs.readFile(`${username}.txt`, 'utf8', async (err, data) => {
          err && MyBot.sendMessage(MY_CHAT, `${username}\n${text}\nДанные не найдены`);
          if (err) return MyBot.sendMessage(id, 'Ваши данные не найдены, обновите их!');

          result = getCount(data);
        });

        const listCoin = await getListCoin();

        !result && MyBot.sendMessage(MY_CHAT, `${username}\n${text}\nДанные не правильные`);

        if (!result) return await MyBot.sendMessage(id, 'Неправильные данные!');

        let totalAll = 0;
        const currentPriceAll = [];

        const answerMessages = [];

        result.forEach(async ({ coinName, count, total, average }) => {
          const currency = listCoin.data.find(({ symbol }) => isEqual(symbol, coinName));

          if (!currency) return;

          const currentPrice = get(['quote', 'USD', 'price'], currency);

          const status = average === 0 ? 100 : (currentPrice * 100) / average;

          totalAll += total;

          currentPriceAll.push(currentPrice * count);

          const { prevStatus } = getOr(
            {
              prevStatus: null,
            },
            [username, coinName],
            permandingValues,
          );

          const { prevCurrentPrice } = getOr(
            {
              prevCurrentPrice: null,
            },
            [username, coinName],
            permandingValues,
          );

          if (count !== 0) {
            answerMessages.push([
              getStatusEmoji(status),
              coinName,
              ' ',
              round(total, 1),
              '$ (',
              getStatusClearProfite(status, total, count, currentPrice),
              '$) ',
              getDiff({ value: status, prevValue: prevStatus, type: false }),
              getDiff({
                value: status,
                prevValue: prevStatus,
                prevCurrentPrice,
                currentPrice,
                total,
                type: false,
              }) && '%',
            ]);
          }

          permandingValues[username] = {
            ...permandingValues[username],
            [coinName]: {
              coinName,
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

        const sortedAnswer = sortBy(arr => arr[7], answerMessages).reverse();

        sortedAnswer.push(
          `Всего вложил: *${round(totalAll, 2)}*$\nСостояние кошелька: *${round(
            sumPriceCurrent,
            2,
          )}$\nДоход: ${round(sumPriceCurrent - totalAll, 2)}$ ${getDiff({
            value: sumPriceCurrent,
            prevValue: prevSumPriceCurrent,
          })}%*`,
        );

        permandingValues[username] = {
          ...permandingValues[username],
          prevSumPriceCurrent: sumPriceCurrent,
        };

        const replaceQree = sortedAnswer.map(answer => answer.toString().replace(/,/g, ''));

        MyBot.sendMessage(MY_CHAT, `${username}\n${text}\n${replaceQree.join('\n')}`);

        return await MyBot.sendMessage(id, replaceQree.join('\n'), MESSAGE_OPTIONS);
      }

      if (text === '⏰⏰⏰') {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;

          MyBot.sendMessage(MY_CHAT, `${username}\n${text}\nОповещение остановленно!`);
          return MyBot.sendMessage(id, 'Оповещение остановленно!', MESSAGE_OPTIONS);
        }

        return MyBot.sendMessage(
          id,
          'Введите % изменения за рамками которого придет уведомление:',
          AGAIN_MESSAGE_OPTIONS,
        );
      }

      if (isFinite(textLikeNumber) && textLikeNumber >= 0 && textLikeNumber < 30) {
        if (timeoutId) clearTimeout(timeoutId);

        timeoutId = setInterval(runNotification, TEN_MINUTE, username, textLikeNumber, id);

        MyBot.sendMessage(MY_CHAT, `${username}\nОповещение ${text}`);
        return MyBot.sendMessage(
          id,
          `Оповещение задано на каждые ${TEN_MINUTE / MINUTE} минут при изменение в ${text}%!`,
          MESSAGE_OPTIONS,
        );
      }

      if (LIST_HEADER_REGEX.test(text)) {
        fs.writeFile(`${username}.txt`, text, err => {
          if (err) return console.log(err);
        });

        MyBot.sendMessage(MY_CHAT, `${username}\nСписок ${text}`);
        return await MyBot.sendMessage(id, 'Данные обновлены', MESSAGE_OPTIONS);
      }

      MyBot.sendMessage(MY_CHAT, `${username}\nНе понимаю${text}`);
      return MyBot.sendMessage(id, 'Я тебя не понимаю, попробуй еще раз!)');
    } catch (e) {
      MyBot.sendMessage(MY_CHAT, `${username}\nКакая то ошибочка ${text}`);
      return MyBot.sendMessage(id, 'Произошла какая то ошибочка!)');
    }
  });
};

start();
