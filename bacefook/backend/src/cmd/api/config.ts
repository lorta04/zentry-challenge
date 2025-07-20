import 'dotenv/config';

export const CONFIG = {
  MONGO_URI: process.env.MONGO_URI ?? 'mongodb://localhost:27017',
  MONGO_DB: process.env.MONGO_DB ?? 'bacefook',
  PORT: process.env.PORT ? Number(process.env.PORT) : 3000,
};
