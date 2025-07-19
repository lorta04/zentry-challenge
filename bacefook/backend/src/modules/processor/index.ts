import type { Consumer, ConsumerGroupJoinEvent, EachBatchPayload } from 'kafkajs';
import type { GraphModule } from 'modules/graph';
import type { KafkaModule } from 'modules/kafka';
import type { MongoModule } from 'modules/mongo';
import type { StoredEvent } from 'modules/mongo/types';
import type { ConnectionEvent } from 'types';
import { logError } from 'utils';

export interface ProcessorOptions {
  resume: boolean;
  mongo: MongoModule;
  graph: GraphModule;
  kafka: KafkaModule;
}

export class Processor {
  private kafka: KafkaModule;
  private consumer: Consumer;
  private topic: string;
  private resume: boolean;
  private graph: GraphModule;
  private mongo: MongoModule;
  private intervalTimer: NodeJS.Timeout | null = null;

  private latestOffset = -1;
  private totalCount = 0;
  private totalBatches = 0;
  private intervalTotal = 0;
  private typeCounts = {
    register: 0,
    referral: 0,
    addfriend: 0,
    unfriend: 0,
  };

  private earliestOffsets = new Map<number, string>();

  constructor(opts: ProcessorOptions) {
    this.kafka = opts.kafka;
    this.topic = opts.kafka.topic;
    this.consumer = opts.kafka.getConsumer();
    this.resume = opts.resume;
    this.mongo = opts.mongo;
    this.graph = opts.graph;
  }

  private printStats() {
    const { register, referral, addfriend, unfriend } = this.typeCounts;
    const now = new Date().toISOString();
    const avg = this.totalBatches ? (this.totalCount / this.totalBatches).toFixed(2) : '0.00';
    console.log(
      `[${now}] rate=${this.intervalTotal} msg/s | total=${this.totalCount} | latestOffset=${this.latestOffset} | avgPerBatch=${avg} | types: register=${register}, referral=${referral}, addfriend=${addfriend}, unfriend=${unfriend}`,
    );
    this.intervalTotal = 0;
  }

  private async loadEarliestOffsets() {
    this.earliestOffsets = await this.kafka.fetchEarliestOffsets();
    this.kafka.logOffsets(this.earliestOffsets);
  }

  private async handleGroupJoin(e: ConsumerGroupJoinEvent) {
    const assignments = e.payload.memberAssignment[this.topic];
    if (!assignments) return;

    for (const partition of assignments) {
      const earliest = this.earliestOffsets.get(partition) ?? '0';

      if (this.resume) {
        const stored = await this.mongo.getStoredOffset(this.topic, partition);
        if (stored != null) {
          let seekNum = stored + 1;
          const earliestNum = Number(earliest);
          if (seekNum < earliestNum) seekNum = earliestNum;
          this.consumer.seek({ topic: this.topic, partition, offset: seekNum.toString() });
          continue;
        }
      }

      this.consumer.seek({ topic: this.topic, partition, offset: earliest });
    }
  }

  private async handleBatch({
    batch,
    resolveOffset,
    heartbeat,
    isRunning,
    isStale,
  }: EachBatchPayload) {
    this.totalBatches++;
    let highestApplied = -1;
    let highestSeen = -1;

    const events: StoredEvent[] = [];

    for (const m of batch.messages) {
      if (!isRunning() || isStale()) break;

      const offsetNum = Number(m.offset);
      const raw = m.value?.toString();
      if (!raw) {
        resolveOffset(m.offset);
        continue;
      }

      try {
        const evt: ConnectionEvent = JSON.parse(raw);
        const createdAt = (evt as { created_at: string }).created_at;
        events.push({
          topic: batch.topic,
          partition: batch.partition,
          offset: offsetNum,
          seq: offsetNum,
          type: evt.type,
          createdAt,
          ingestedAt: new Date(),
          event: evt,
        });

        const applied = !!this.graph.ingest({ ...evt, seq: offsetNum });
        if (applied) {
          this.totalCount++;
          this.intervalTotal++;
          this.typeCounts[evt.type as keyof typeof this.typeCounts]++;
          if (offsetNum > highestApplied) highestApplied = offsetNum;
        }
        if (offsetNum > highestSeen) highestSeen = offsetNum;
        if (offsetNum > this.latestOffset) this.latestOffset = offsetNum;
      } catch (e: unknown) {
        logError(`❌ Parse/ingest error at offset: ${m.offset}`, e);
      }

      resolveOffset(m.offset);
    }

    if (events.length) await this.mongo.storeEvents(events);

    await heartbeat();

    const dirty = this.graph.drainDirtyNodes();
    if (dirty.length) await this.mongo.flushDirtyUsers(dirty);

    const offsetToSave = highestApplied >= 0 ? highestApplied : highestSeen;
    if (offsetToSave >= 0) await this.mongo.saveOffset(batch.topic, batch.partition, offsetToSave);
  }

  async start() {
    await this.mongo.init();
    this.graph.hydrate(await this.mongo.loadAllUsers());
    await this.loadEarliestOffsets();
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: this.topic, fromBeginning: false });

    this.consumer.on(this.consumer.events.GROUP_JOIN, (e) => void this.handleGroupJoin(e));
    this.consumer.on(this.consumer.events.CRASH, (event) => {
      const err = event.payload?.error;
      logError('❌ Kafka consumer crash', err);
      process.exit(1);
    });

    await this.consumer.run({
      autoCommit: false,
      eachBatchAutoResolve: false,
      eachBatch: async (p) => this.handleBatch(p),
    });

    this.intervalTimer = setInterval(() => this.printStats(), 5000);
  }

  async stop() {
    if (this.intervalTimer) clearInterval(this.intervalTimer);
    try {
      await this.consumer.stop();
    } catch (e: unknown) {
      logError('❌ Error stopping consumer', e);
    }
    try {
      await this.consumer.disconnect();
    } catch (e: unknown) {
      logError('❌ Error disconnecting consumer', e);
    }
    await this.mongo.close();
    console.log('🛑 Processor stopped.');
  }
}
