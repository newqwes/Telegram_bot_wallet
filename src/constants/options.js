import { AUTH_KEY } from '.';

export const REQUESTS_OPTIONS = {
  method: 'GET',
  uri: 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest',
  qs: {
    start: '1',
    limit: '400',
    convert: 'USD',
  },
  headers: {
    'X-CMC_PRO_API_KEY': AUTH_KEY,
  },
  json: true,
  gzip: true,
};

export const MESSAGE_OPTIONS = {
  parse_mode: 'markdown',
  reply_markup: {
    resize_keyboard: true,
    keyboard: [['🔄🔄🔄', '💰💰💰', '📄📄📄', '⏰⏰⏰']],
  },
};

export const AGAIN_MESSAGE_OPTIONS = {
  parse_mode: 'markdown',
  reply_markup: {
    resize_keyboard: true,
    keyboard: [
      ['0.1', '1', '2', '3'],
      ['4', '5', '6', '7'],
      ['8', '9', '10', '15'],
    ],
  },
};
