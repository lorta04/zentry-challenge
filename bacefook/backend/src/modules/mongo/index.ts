import { Collection, Db, MongoClient, MongoServerError } from 'mongodb';
import { logError } from 'utils';

import type { PersistableUserNode } from '../graph/types';
import type { MongoModuleOptions, OffsetDoc, StoredEvent } from './types';

export class MongoModule {
  private client: MongoClient;
  private db!: Db;
  private usersCol!: Collection<PersistableUserNode>;
  private offsetsCol!: Collection<OffsetDoc>;
  private relationshipEventsCol!: Collection<StoredEvent>;

  constructor(private options: MongoModuleOptions) {
    this.client = new MongoClient(this.options.uri, { maxPoolSize: 40 });
  }

  async init() {
    await this.client.connect();
    this.db = this.client.db(this.options.dbName);

    this.usersCol = this.db.collection<PersistableUserNode>('relationship_users');
    this.offsetsCol = this.db.collection<OffsetDoc>('kafka_offsets');

    const collections = await this.db.listCollections({ name: 'relationship_events' }).toArray();
    if (collections.length === 0) {
      await this.db.createCollection('relationship_events', {
        timeseries: {
          timeField: 'createdAt',
          metaField: 'type',
          granularity: 'seconds',
        },
      });
    }

    this.relationshipEventsCol = this.db.collection<StoredEvent>('relationship_events');

    await Promise.all([
      this.usersCol.createIndex({ name: 1 }, { unique: true }),
      this.usersCol.createIndex({ lastSeq: -1 }),
      this.offsetsCol.createIndex({ topic: 1, partition: 1 }, { unique: true }),
      this.relationshipEventsCol.createIndex({ offset: 1 }),
      this.relationshipEventsCol.createIndex({ 'event.user': 1 }),
    ]);
  }

  async getStoredOffset(topic: string, partition: number): Promise<number | null> {
    const doc = await this.offsetsCol.findOne({ topic, partition });
    return doc ? doc.offset : null;
  }

  async saveOffset(topic: string, partition: number, offset: number) {
    try {
      await this.offsetsCol.updateOne(
        { topic, partition },
        { $set: { offset, updatedAt: new Date() } },
        { upsert: true },
      );
    } catch (e) {
      logError(`saveOffset failed for ${topic}[${partition}] = ${offset}`, e);
    }
  }

  async loadAllUsers(): Promise<PersistableUserNode[]> {
    return this.usersCol.find({}).toArray();
  }

  async flushDirtyUsers(nodes: PersistableUserNode[]) {
    if (!nodes.length) return;
    try {
      const bulk = this.usersCol.initializeUnorderedBulkOp();
      for (const n of nodes) {
        bulk
          .find({ name: n.name })
          .upsert()
          .updateOne({
            $set: {
              createdAt: n.createdAt,
              referredBy: n.referredBy,
              referrals: n.referrals,
              friends: n.friends,
              referralPoints: n.referralPoints,
              lastSeq: n.lastSeq,
              referralsCount: n.referralsCount,
              friendsCount: n.friendsCount,
            },
          });
      }
      await bulk.execute();
    } catch (e) {
      logError('flushDirtyUsers failed', e);
    }
  }

  async storeEvents(docs: StoredEvent[]) {
    if (!docs.length) return;
    try {
      await this.relationshipEventsCol.insertMany(docs, { ordered: false });
    } catch (e) {
      if (e instanceof MongoServerError && e.code !== 11000) {
        logError('storeEvents insertMany failed', e);
      }
    }
  }

  async close() {
    await this.client.close();
  }
}
