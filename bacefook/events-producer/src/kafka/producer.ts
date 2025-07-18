import type { ConnectionEvent } from 'events-generator/types';
import {
  CompressionCodecs,
  CompressionTypes,
  Kafka,
  logLevel as LogLevels,
  type Message,
} from 'kafkajs';
import SnappyCodec from 'kafkajs-snappy';

import { CONFIG } from '../config';

CompressionCodecs[CompressionTypes.Snappy] = SnappyCodec;

export interface ProducerOptions {
  clientId: string;
  brokers: string[];
  logLevel?: keyof typeof LogLevels;
  topic?: string;
}

export class Producer {
  private kafka: Kafka;
  private topic: string;
  private producer: ReturnType<Kafka['producer']>;

  constructor(options: ProducerOptions) {
    const { clientId, brokers, logLevel = 'ERROR', topic = CONFIG.KAFKA_TOPIC } = options;

    this.kafka = new Kafka({
      clientId,
      brokers,
      logLevel: LogLevels[logLevel],
    });

    this.topic = topic;
    this.producer = this.kafka.producer({
      idempotent: true,
    });
  }

  async connect(): Promise<void> {
    await this.producer.connect();
  }

  async send(events: ConnectionEvent[]): Promise<number> {
    const messages: Message[] = events.map((evt) => ({
      key: evt.type,
      value: JSON.stringify(evt),
      headers: { 'content-type': 'application/json' },
    }));

    await this.producer.send({
      topic: this.topic,
      compression: CompressionTypes.Snappy,
      messages,
    });

    return messages.length;
  }
}
