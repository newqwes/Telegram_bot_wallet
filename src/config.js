import TelegraAPI from 'node-telegram-bot-api';

import { BOT_TOKEN } from './constants/index.js';

export default new TelegraAPI(BOT_TOKEN, { polling: true });
