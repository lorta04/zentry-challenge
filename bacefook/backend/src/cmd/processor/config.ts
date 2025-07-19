import 'dotenv/config';

export const CONFIG = {
  MONGO_URI: process.env.MONGO_URI ?? 'mongodb://localhost:27017',
  MONGO_DB: process.env.MONGO_DB ?? 'bacefook',
  KAFKA_BROKERS: (process.env.KAFKA_BROKERS ?? 'localhost:19092').split(','),
  KAFKA_TOPIC: process.env.KAFKA_TOPIC ?? 'bacefook-relationship-events-topic',
  KAFKA_GROUP_ID: process.env.KAFKA_GROUP_ID ?? 'bacefook-processor-v1',
  RESUME: process.env.RESUME === '1',
};
