import { CompressionCodecs, CompressionTypes, Kafka, logLevel as LogLevels } from 'kafkajs';
import SnappyCodec from 'kafkajs-snappy';

export interface KafkaModuleOptions {
  topic: string;
  brokers: string[];
  groupId: string;
  clientId?: string;
  logLevel?: keyof typeof LogLevels;
}

export class KafkaModule {
  readonly topic: string;
  private kafka: Kafka;
  private groupId: string;
  private logLevel: LogLevels;
  private isCodecRegistered = false;

  constructor(opts: KafkaModuleOptions) {
    const { topic, brokers, groupId, clientId = 'bacefook-processor', logLevel = 'INFO' } = opts;

    this.topic = topic;
    this.groupId = groupId;
    this.logLevel = LogLevels[logLevel];

    if (!this.isCodecRegistered) {
      try {
        CompressionCodecs[CompressionTypes.Snappy] = SnappyCodec;
        this.isCodecRegistered = true;
      } catch (err) {}
    }

    this.kafka = new Kafka({
      brokers,
      clientId,
      logLevel: this.logLevel,
    });
  }

  getConsumer() {
    return this.kafka.consumer({
      groupId: this.groupId,
    });
  }

  getAdmin() {
    return this.kafka.admin();
  }

  async fetchEarliestOffsets(): Promise<Map<number, string>> {
    const admin = this.getAdmin();
    await admin.connect();
    const offsets = await admin.fetchTopicOffsets(this.topic);
    await admin.disconnect();

    const result = new Map<number, string>();
    for (const { partition, low } of offsets) {
      result.set(partition, low);
    }
    return result;
  }

  logOffsets(offsets: Map<number, string>) {
    const printable = Array.from(offsets.entries())
      .map(([p, o]) => `${p}:${o}`)
      .join(', ');
    console.log('[offsets] earliest:', printable);
  }
}
