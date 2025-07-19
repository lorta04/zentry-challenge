import type { AddFriendEvent, ReferralEvent, RegisterEvent, UnfriendEvent } from 'types';

import type {
  IngestResult,
  PersistableUserNode,
  RelationshipGraphOptions,
  SequencedConnectionEvent,
  UserNode,
  WithSeq,
} from './types';

export class GraphModule {
  readonly users = new Map<string, UserNode>();
  private readonly referralPointDepth: number;
  private readonly dirty = new Set<string>();

  constructor(opts: RelationshipGraphOptions = {}) {
    this.referralPointDepth = opts.referralPointDepth ?? 2;
  }

  ingest(ev: SequencedConnectionEvent): IngestResult {
    switch (ev.type) {
      case 'register':
        return this.handleRegister(ev as WithSeq<RegisterEvent>);
      case 'referral':
        return this.handleReferral(ev as WithSeq<ReferralEvent>);
      case 'addfriend':
        return this.handleAddFriend(ev as WithSeq<AddFriendEvent>);
      case 'unfriend':
        return this.handleUnfriend(ev as WithSeq<UnfriendEvent>);
      default:
        return { applied: false, touched: [] };
    }
  }

  ingestMany(events: SequencedConnectionEvent[]): number {
    let applied = 0;
    for (const e of events) if (this.ingest(e).applied) applied++;
    return applied;
  }

  drainDirtyNodes(): PersistableUserNode[] {
    if (this.dirty.size === 0) return [];
    const out: PersistableUserNode[] = [];
    for (const name of this.dirty) {
      const u = this.users.get(name);
      if (!u) continue;
      u.referralsCount = u.referrals.size;
      u.friendsCount = u.friends.size;
      out.push({
        name: u.name,
        createdAt: u.createdAt,
        referredBy: u.referredBy,
        referrals: Array.from(u.referrals),
        friends: Array.from(u.friends),
        referralPoints: u.referralPoints,
        lastSeq: u.lastSeq,
        referralsCount: u.referralsCount,
        friendsCount: u.friendsCount,
      });
    }
    this.dirty.clear();
    return out;
  }

  hydrate(docs: PersistableUserNode[]) {
    this.users.clear();
    this.dirty.clear();
    for (const d of docs) {
      this.users.set(d.name, {
        name: d.name,
        createdAt: d.createdAt,
        referredBy: d.referredBy,
        referrals: new Set(d.referrals ?? []),
        friends: new Set(d.friends ?? []),
        referralPoints: d.referralPoints ?? 0,
        lastSeq: d.lastSeq ?? -1,
        referralsCount: d.referralsCount ?? d.referrals?.length ?? 0,
        friendsCount: d.friendsCount ?? d.friends?.length ?? 0,
      });
    }
  }

  snapshot(): PersistableUserNode[] {
    return Array.from(this.users.values()).map((u) => ({
      name: u.name,
      createdAt: u.createdAt,
      referredBy: u.referredBy,
      referrals: Array.from(u.referrals),
      friends: Array.from(u.friends),
      referralPoints: u.referralPoints,
      lastSeq: u.lastSeq,
      referralsCount: u.referralsCount,
      friendsCount: u.friendsCount,
    }));
  }

  private handleRegister(ev: WithSeq<RegisterEvent>): IngestResult {
    const targets = [ev.name];
    if (!this.canApply(targets, ev.seq)) return { applied: false, touched: [] };

    const u = this.getOrCreate(ev.name);
    if (!u.createdAt) {
      u.createdAt = ev.created_at;
      this.markDirty(u.name);
    }
    if (this.markApplied(targets, ev.seq)) {
      this.markDirty(ev.name);
      return { applied: true, touched: targets };
    }
    return { applied: false, touched: [] };
  }

  private handleReferral(ev: WithSeq<ReferralEvent>): IngestResult {
    if (ev.referredBy === ev.user) return { applied: false, touched: [] };
    const parent = this.users.get(ev.referredBy);
    const child = this.users.get(ev.user);
    if (!parent || !child) return { applied: false, touched: [] };

    const targets = [ev.referredBy, ev.user];
    if (!this.canApply(targets, ev.seq)) return { applied: false, touched: [] };

    if (child.referredBy && child.referredBy !== ev.referredBy)
      return { applied: false, touched: [] };

    let mutated = false;

    if (!child.referredBy) {
      child.referredBy = ev.referredBy;
      mutated = true;
      this.markDirty(child.name);
    }

    const beforeSize = parent.referrals.size;
    parent.referrals.add(child.name);
    if (parent.referrals.size !== beforeSize) {
      mutated = true;
      this.markDirty(parent.name);
      this.propagateReferralPoints(parent.name);
    }

    if (!mutated) return { applied: false, touched: [] };

    this.markApplied(targets, ev.seq);
    return { applied: true, touched: targets };
  }

  private handleAddFriend(ev: WithSeq<AddFriendEvent>): IngestResult {
    if (ev.user1_name === ev.user2_name) return { applied: false, touched: [] };
    const a = this.users.get(ev.user1_name);
    const b = this.users.get(ev.user2_name);
    if (!a || !b) return { applied: false, touched: [] };

    const targets = [a.name, b.name];
    if (!this.canApply(targets, ev.seq)) return { applied: false, touched: [] };

    const aBefore = a.friends.size;
    const bBefore = b.friends.size;
    a.friends.add(b.name);
    b.friends.add(a.name);

    if (a.friends.size === aBefore && b.friends.size === bBefore) {
      return { applied: false, touched: [] };
    }

    this.markDirty(a.name);
    this.markDirty(b.name);
    this.markApplied(targets, ev.seq);
    return { applied: true, touched: targets };
  }

  private handleUnfriend(ev: WithSeq<UnfriendEvent>): IngestResult {
    if (ev.user1_name === ev.user2_name) return { applied: false, touched: [] };
    const a = this.users.get(ev.user1_name);
    const b = this.users.get(ev.user2_name);
    if (!a || !b) return { applied: false, touched: [] };

    const targets = [a.name, b.name];
    if (!this.canApply(targets, ev.seq)) return { applied: false, touched: [] };

    const aHad = a.friends.delete(b.name);
    const bHad = b.friends.delete(a.name);
    if (!aHad && !bHad) {
      return { applied: false, touched: [] };
    }

    this.markDirty(a.name);
    this.markDirty(b.name);
    this.markApplied(targets, ev.seq);
    return { applied: true, touched: targets };
  }

  private canApply(names: string[], seq: number): boolean {
    for (const n of names) {
      const u = this.users.get(n);
      if (u && u.lastSeq >= seq) return false;
    }
    return true;
  }

  private markApplied(names: string[], seq: number): boolean {
    let advanced = false;
    for (const n of names) {
      const u = this.getOrCreate(n);
      if (u.lastSeq < seq) {
        u.lastSeq = seq;
        this.markDirty(n);
        advanced = true;
      }
    }
    return advanced;
  }

  private markDirty(name: string) {
    this.dirty.add(name);
  }

  private getOrCreate(name: string): UserNode {
    let node = this.users.get(name);
    if (!node) {
      node = {
        name,
        referrals: new Set(),
        friends: new Set(),
        referralPoints: 0,
        lastSeq: -1,
        referralsCount: 0,
        friendsCount: 0,
      };
      this.users.set(name, node);
      this.markDirty(name);
    }
    return node;
  }

  private propagateReferralPoints(start: string): void {
    let current: string | undefined = start;
    for (let depth = 0; depth < this.referralPointDepth && current; depth++) {
      const node = this.users.get(current);
      if (!node) break;
      node.referralPoints += 1;
      this.markDirty(node.name);
      current = node.referredBy;
    }
  }
}
