import type { ConnectionEvent } from 'types';

export type WithSeq<T extends ConnectionEvent> = T & { seq: number };
export type SequencedConnectionEvent = WithSeq<ConnectionEvent>;

export interface RelationshipGraphOptions {
  referralPointDepth?: number;
}

export interface IngestResult {
  applied: boolean;
  touched: string[]; // names of nodes actually mutated (or whose lastSeq advanced)
}

export interface PersistableUserNode {
  name: string;
  createdAt?: string;
  referredBy?: string;
  referrals: string[];
  friends: string[];
  referralPoints: number;
  referralChildrenAwarded: string[];
  lastSeq: number;
  referralsCount: number;
  friendsCount: number;
}

export interface UserNode {
  name: string;
  createdAt?: string;
  referredBy?: string;
  referrals: Set<string>;
  friends: Set<string>;
  referralPoints: number;
  referralChildrenAwarded: Set<string>;
  lastSeq: number;
  referralsCount: number;
  friendsCount: number;
}
