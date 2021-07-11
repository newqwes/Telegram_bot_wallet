const dotenv = require('dotenv');
const TelegraAPI = require('node-telegram-bot-api');

dotenv.config();

const count = stringData => {
  const matchStr = stringData.match(/[A-Z]{3}\s\d{0,}(\.|)(\d{0,}|)\s=\s\d{0,}(\.|)(\d{0,})/gm);
  if (!matchStr) return;

  const tokenObj = {};

  matchStr.forEach(element => {
    const [token, count, _, price] = element.split(' ');
    const numCount = +count;

    if (!tokenObj[token]) {
      tokenObj[token] = { count: numCount, total: price * numCount };
    } else {
      tokenObj[token] = {
        ...tokenObj[token],
        count: tokenObj[token].count + numCount,
        total: tokenObj[token].total + price * numCount,
      };
    }
  });

  for (key in tokenObj) {
    tokenObj[key].average = tokenObj[key].total / tokenObj[key].count;
  }

  return tokenObj;
};

const bot = new TelegraAPI(process.env.BOT_TOKEN, { polling: true });

bot.on('message', async ({ text, chat: { id } }) => {
  const result = count(text);

  if (!result) return bot.sendMessage(id, 'Неправильные данные!');

  for (key in result) {
    await bot.sendMessage(
      id,
      `В ${key} ты всего вложил ${result[key].total} $.
      Количество монет: ${result[key].count},
      Средняя цена покупки: ${result[key].average}.
      `,
    );
  }

  return;
});
