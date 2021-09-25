import Sequelize from 'sequelize';

const config = {
  dialect: 'postgres',
  username: 'postgres',
  password: 'root',
  database: 'store_db',
  host: 'localhost',
  port: '5432',
  omitNull: true,
};

export default new Sequelize(config);
