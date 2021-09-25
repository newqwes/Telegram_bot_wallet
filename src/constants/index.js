import dotenv from 'dotenv';

dotenv.config();

export const { BOT_TOKEN, AUTH_KEY } = process.env;

export const EXAMPLE_LIST = `
Цена покупки

XRP 300 = 1.66807
DOGE 2000 = 0.62987
DOGE -1000 = 0.9999
`;

export const LIST_HEADER_REGEX = /Цена покупки/;

export const MINUTE = 1000 * 60;
export const FOUR_MINUTE = MINUTE * 4;
export const TEN_MINUTE = MINUTE * 10;

export const PARSE_STRING_REGEX = /[A-Z]{1,10}\s(-?)\d{0,}(\.|)(\d{0,}|)\s=\s\d{0,}(\.|)(\d{0,})/gm;
