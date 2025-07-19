import type { ConnectionEvent } from 'types';

export interface MongoModuleOptions {
  uri: string;
  dbName: string;
}

export interface StoredEvent {
  topic: string;
  partition: number;
  offset: number;
  type: ConnectionEvent['type'];
  createdAt: Date;
  event: ConnectionEvent;
}

export interface OffsetDoc {
  topic: string;
  partition: number;
  offset: number;
  updatedAt: Date;
}
