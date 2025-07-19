import 'dotenv/config';

export const CONFIG = {
  KAFKA_BROKER: process.env.KAFKA_BROKER ?? 'localhost:19092',
  KAFKA_TOPIC: process.env.KAFKA_TOPIC ?? 'bacefook-relationship-events-topic',
  GENERATOR_COUNT: Number(process.env.GENERATOR_COUNT ?? 5),
  MAX_MESSAGES: Number(process.env.MAX_MESSAGES ?? 100),
};
