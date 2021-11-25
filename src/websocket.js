// import WebSocket from 'ws';

// const pricesWs = new WebSocket('wss://ws.coincap.io/prices?assets=ALL');

// let currentCoinPrices = {};

// pricesWs.onerror = error => {
//   console.log(`API WebSocket call onerror: ${error.message}`);
// };

// pricesWs.onmessage = ({ data }) => {
//   try {
//     currentCoinPrices = { ...currentCoinPrices, ...JSON.parse(data) };
//     // console.log(currentCoinPrices);
//   } catch (error) {
//     console.log('API WebSocket call catch error:', error.message);
//   }
// };
