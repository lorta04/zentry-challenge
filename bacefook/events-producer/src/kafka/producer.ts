import type { ConnectionEvent } from 'events-generator/types';
import {
  CompressionCodecs,
  CompressionTypes,
  Kafka,
  logLevel as LogLevels,
  type Message,
} from 'kafkajs';
import SnappyCodec from 'kafkajs-snappy';

export interface ProducerOptions {
  clientId: string;
  brokers: string[];
  topic: string;
  logLevel?: keyof typeof LogLevels;
}

export class Producer {
  private kafka: Kafka;
  private topic: string;
  private producer: ReturnType<Kafka['producer']>;
  private isCodecRegistered = false;

  constructor(options: ProducerOptions) {
    const { clientId, brokers, topic, logLevel = 'ERROR' } = options;

    this.kafka = new Kafka({
      clientId,
      brokers,
      logLevel: LogLevels[logLevel],
    });

    this.topic = topic;

    if (!this.isCodecRegistered) {
      try {
        CompressionCodecs[CompressionTypes.Snappy] = SnappyCodec;
        this.isCodecRegistered = true;
      } catch (err) {}
    }

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
