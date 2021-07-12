const PARSE_STRING_REGEX = /[A-Z]{3}\s\d{0,}(\.|)(\d{0,}|)\s=\s\d{0,}(\.|)(\d{0,})/gm;

exports.count = stringData => {
  const data = stringData.match(PARSE_STRING_REGEX);

  if (!data) return;

  const purchases = [];

  data.forEach(element => {
    let [coinName, count, _, price] = element.split(' ');

    count = Number(count);
    price = Number(price);

    const coin = purchases.find(purchase => purchase.coinName === coinName);

    if (!coin) {
      purchases.push({ coinName, count, total: price * count });
    } else {
      coin.count += count;
      coin.total += price * count;
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
