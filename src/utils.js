import { round } from 'lodash';
import rp from 'request-promise';
import { PARSE_STRING_REGEX } from './constants';
import { REQUESTS_OPTIONS } from './constants/options';

export const getListCoin = async () => {
  try {
    return await rp(REQUESTS_OPTIONS);
  } catch (error) {
    console.log('API call error:', error.message);
  }
};

export const getCount = stringData => {
  const data = stringData.match(PARSE_STRING_REGEX);

  if (!data) return;

  const purchases = [];

  data.forEach(element => {
    // eslint-disable-next-line prefer-const
    let [coinName, count, , price] = element.split(' ');

    count = Number(count);
    price = Number(price);

    const coin = purchases.find(purchase => purchase.coinName === coinName);

    if (!coin) {
      purchases.push({ coinName, count, total: price * count });
    } else {
      coin.count += count;
      coin.total += price * count;

      if (coin.total < 0) {
        coin.total = 0;
      }
    }
  });

  const result = purchases.map(({ coinName, count, total }) => ({
    coinName,
    count,
    total,
    average: total / count,
  }));

  return result;
};

export const getDiff = ({
  value,
  prevValue,
  prevCurrentPrice,
  currentPrice,
  total,
  type = true,
}) => {
  if (total === 0) {
    return 100 - (prevCurrentPrice * 100) / currentPrice;
  }
  if (!prevValue) return null;

  return round(type ? 100 - (prevValue * 100) / value : value - prevValue, 2);
};

export const getStatusEmoji = status => (status - 100 >= 0 ? '🟢' : '🔴');

export const getStatusClearProfite = (status, total, count, currentPrice) => {
  if (total === 0) {
    return round(count * currentPrice, 1);
  }

  return round(((status - 100) / 100) * total, 1);
};

export const getStatusLine = (status, total) =>
  `Статус: ${getStatusEmoji(status)}*${getStatusClearProfite(status, total)}$ (${round(
    status - 100,
    1,
  )}%)*`;
