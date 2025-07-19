import type { AddFriendEvent, ReferralEvent, RegisterEvent, UnfriendEvent } from 'types';
import { beforeEach, describe, expect, it } from 'vitest';

import { GraphModule } from './index';
import type { SequencedConnectionEvent, WithSeq } from './types';

describe('GraphModule', () => {
  let graph: GraphModule;

  beforeEach(() => {
    graph = new GraphModule({ referralPointDepth: 2 });
  });

  describe('register', () => {
    it('registers a new user', () => {
      const ev: WithSeq<RegisterEvent> = {
        type: 'register',
        name: 'alice',
        created_at: '2024-01-01T00:00:00.000Z',
        seq: 1,
      };

      const result = graph.ingest(ev);
      expect(result.applied).toBe(true);
      expect(result.touched).toEqual(['alice']);

      const snapshot = graph.snapshot();
      expect(snapshot).toHaveLength(1);
      expect(snapshot[0]).toMatchObject({
        name: 'alice',
        createdAt: '2024-01-01T00:00:00.000Z',
        referrals: [],
        friends: [],
        referralPoints: 0,
        referralChildrenAwarded: [],
        lastSeq: 1,
        referralsCount: 0,
        friendsCount: 0,
      });
    });

    it('ignores re-register with lower seq', () => {
      graph.ingest({
        type: 'register',
        name: 'alice',
        created_at: '2024-01-01T00:00:00.000Z',
        seq: 2,
      });

      const result = graph.ingest({
        type: 'register',
        name: 'alice',
        created_at: '2023-01-01T00:00:00.000Z',
        seq: 1,
      });

      expect(result.applied).toBe(false);
    });

    it('is idempotent on same seq', () => {
      const ev: WithSeq<RegisterEvent> = {
        type: 'register',
        name: 'alice',
        created_at: '2024-01-01T00:00:00.000Z',
        seq: 1,
      };

      expect(graph.ingest(ev).applied).toBe(true);
      expect(graph.ingest(ev).applied).toBe(false);
    });

    it('returns dirty nodes after registration', () => {
      graph.ingest({
        type: 'register',
        name: 'bob',
        created_at: '2022-02-02T00:00:00.000Z',
        seq: 3,
      });

      const dirty = graph.drainDirtyNodes();
      expect(dirty).toHaveLength(1);
      expect(dirty[0]!.name).toBe('bob');
      expect(graph.drainDirtyNodes()).toHaveLength(0);
    });
  });

  describe('referral', () => {
    beforeEach(() => {
      graph.ingest({
        type: 'register',
        name: 'parent',
        created_at: '2024-01-01T00:00:00.000Z',
        seq: 1,
      });
      graph.ingest({
        type: 'register',
        name: 'child',
        created_at: '2024-01-02T00:00:00.000Z',
        seq: 2,
      });
    });

    it('applies referral and propagates points', () => {
      const result = graph.ingest({
        type: 'referral',
        referredBy: 'parent',
        user: 'child',
        created_at: '2024-01-03T00:00:00.000Z',
        seq: 3,
      });

      expect(result.applied).toBe(true);
      expect(result.touched.sort()).toEqual(['child', 'parent']);

      const dirty = graph.drainDirtyNodes();
      const parent = dirty.find((u) => u.name === 'parent');
      const child = dirty.find((u) => u.name === 'child');

      expect(parent).toBeDefined();
      expect(parent!.referralPoints).toBe(1);
      expect(parent!.referrals).toContain('child');
      expect(parent!.referralChildrenAwarded).toContain('child');
      expect(child).toBeDefined();
      expect(child!.referredBy).toBe('parent');
    });

    it('ignores self-referral', () => {
      const result = graph.ingest({
        type: 'referral',
        referredBy: 'child',
        user: 'child',
        created_at: '2024-01-03T00:00:00.000Z',
        seq: 4,
      });

      expect(result.applied).toBe(false);
    });

    it('ignores re-referral with different parent', () => {
      graph.ingest({
        type: 'register',
        name: 'intruder',
        created_at: '2024-01-03T00:00:00.000Z',
        seq: 5,
      });
      graph.ingest({
        type: 'referral',
        referredBy: 'parent',
        user: 'child',
        created_at: '2024-01-03T00:00:00.000Z',
        seq: 6,
      });

      const result = graph.ingest({
        type: 'referral',
        referredBy: 'intruder',
        user: 'child',
        created_at: '2024-01-04T00:00:00.000Z',
        seq: 7,
      });

      expect(result.applied).toBe(false);
    });

    it('is idempotent and does not double-count points', () => {
      graph.ingest({
        type: 'referral',
        referredBy: 'parent',
        user: 'child',
        created_at: '2024-01-03T00:00:00.000Z',
        seq: 3,
      });

      const before = graph.snapshot().find((u) => u.name === 'parent');
      expect(before?.referralPoints).toBe(1);

      const repeat = graph.ingest({
        type: 'referral',
        referredBy: 'parent',
        user: 'child',
        created_at: '2024-01-04T00:00:00.000Z',
        seq: 4,
      });

      expect(repeat.applied).toBe(false);

      const after = graph.snapshot().find((u) => u.name === 'parent');
      expect(after?.referralPoints).toBe(1);
    });

    it('propagates points up to depth 2', () => {
      graph.ingest({
        type: 'register',
        name: 'grandparent',
        created_at: '2024-01-01T00:00:00.000Z',
        seq: 10,
      });
      graph.ingest({
        type: 'register',
        name: 'parent',
        created_at: '2024-01-02T00:00:00.000Z',
        seq: 11,
      });
      graph.ingest({
        type: 'register',
        name: 'child',
        created_at: '2024-01-03T00:00:00.000Z',
        seq: 12,
      });

      graph.ingest({
        type: 'referral',
        referredBy: 'grandparent',
        user: 'parent',
        created_at: '2024-01-02T12:00:00.000Z',
        seq: 13,
      });
      graph.ingest({
        type: 'referral',
        referredBy: 'parent',
        user: 'child',
        created_at: '2024-01-03T12:00:00.000Z',
        seq: 14,
      });

      const snapshot = graph.snapshot();
      const gp = snapshot.find((u) => u.name === 'grandparent');
      const p = snapshot.find((u) => u.name === 'parent');
      const c = snapshot.find((u) => u.name === 'child');

      expect(gp?.referralPoints).toBe(2);
      expect(p?.referralPoints).toBe(1);
      expect(c?.referralPoints).toBe(0);
    });

    it('is idempotent on same referral event', () => {
      const ev: WithSeq<ReferralEvent> = {
        type: 'referral',
        referredBy: 'parent',
        user: 'child',
        created_at: '2024-01-03T00:00:00.000Z',
        seq: 3,
      };

      expect(graph.ingest(ev).applied).toBe(true);
      expect(graph.ingest(ev).applied).toBe(false);
    });

    it('ignores referral if parent or child not registered', () => {
      const bad1 = graph.ingest({
        type: 'referral',
        referredBy: 'ghost',
        user: 'child',
        created_at: '2024-01-03T00:00:00.000Z',
        seq: 10,
      });
      expect(bad1.applied).toBe(false);

      const bad2 = graph.ingest({
        type: 'referral',
        referredBy: 'parent',
        user: 'ghost',
        created_at: '2024-01-03T00:00:00.000Z',
        seq: 11,
      });
      expect(bad2.applied).toBe(false);
    });
  });

  describe('addfriend', () => {
    beforeEach(() => {
      graph.ingest({
        type: 'register',
        name: 'a',
        created_at: '2024-01-01T00:00:00.000Z',
        seq: 1,
      });
      graph.ingest({
        type: 'register',
        name: 'b',
        created_at: '2024-01-01T00:00:00.000Z',
        seq: 2,
      });
    });

    it('adds friendship between two users', () => {
      const result = graph.ingest({
        type: 'addfriend',
        user1_name: 'a',
        user2_name: 'b',
        created_at: '2024-01-03T00:00:00.000Z',
        seq: 3,
      } as WithSeq<AddFriendEvent>);

      expect(result.applied).toBe(true);

      const dirty = graph.drainDirtyNodes();
      const a = dirty.find((u) => u.name === 'a');
      const b = dirty.find((u) => u.name === 'b');

      expect(a?.friends).toContain('b');
      expect(b?.friends).toContain('a');
    });

    it('is idempotent and does not re-add friendship', () => {
      graph.ingest({
        type: 'addfriend',
        user1_name: 'a',
        user2_name: 'b',
        created_at: '2024-01-03T00:00:00.000Z',
        seq: 3,
      });

      const repeat = graph.ingest({
        type: 'addfriend',
        user1_name: 'a',
        user2_name: 'b',
        created_at: '2024-01-04T00:00:00.000Z',
        seq: 4,
      });

      expect(repeat.applied).toBe(false);
    });

    it('ignores self-friendship', () => {
      const result = graph.ingest({
        type: 'addfriend',
        user1_name: 'a',
        user2_name: 'a',
        created_at: '2024-01-03T00:00:00.000Z',
        seq: 3,
      } as WithSeq<AddFriendEvent>);

      expect(result.applied).toBe(false);
    });

    it('ignores outdated addfriend event by seq', () => {
      graph.ingest({
        type: 'addfriend',
        user1_name: 'a',
        user2_name: 'b',
        created_at: '2024-01-03T00:00:00.000Z',
        seq: 5,
      });

      const late = graph.ingest({
        type: 'addfriend',
        user1_name: 'a',
        user2_name: 'b',
        created_at: '2024-01-02T00:00:00.000Z',
        seq: 4,
      });

      expect(late.applied).toBe(false);
    });

    it('ignores if either user does not exist', () => {
      const result = graph.ingest({
        type: 'addfriend',
        user1_name: 'a',
        user2_name: 'ghost',
        created_at: '2024-01-03T00:00:00.000Z',
        seq: 3,
      } as WithSeq<AddFriendEvent>);

      expect(result.applied).toBe(false);
    });
  });

  describe('unfriend', () => {
    beforeEach(() => {
      graph.ingest({
        type: 'register',
        name: 'alice',
        created_at: '2024-01-01T00:00:00.000Z',
        seq: 1,
      });
      graph.ingest({
        type: 'register',
        name: 'bob',
        created_at: '2024-01-01T00:00:00.000Z',
        seq: 2,
      });
      graph.ingest({
        type: 'addfriend',
        user1_name: 'alice',
        user2_name: 'bob',
        created_at: '2024-01-02T00:00:00.000Z',
        seq: 3,
      });
      graph.drainDirtyNodes();
    });

    it('removes friendship between two users', () => {
      const result = graph.ingest({
        type: 'unfriend',
        user1_name: 'alice',
        user2_name: 'bob',
        created_at: '2024-01-03T00:00:00.000Z',
        seq: 4,
      } as WithSeq<UnfriendEvent>);

      expect(result.applied).toBe(true);

      const dirty = graph.drainDirtyNodes();
      const alice = dirty.find((u) => u.name === 'alice');
      const bob = dirty.find((u) => u.name === 'bob');

      expect(alice?.friends).not.toContain('bob');
      expect(bob?.friends).not.toContain('alice');
    });

    it('is idempotent and does not double-unfriend', () => {
      graph.ingest({
        type: 'unfriend',
        user1_name: 'alice',
        user2_name: 'bob',
        created_at: '2024-01-03T00:00:00.000Z',
        seq: 4,
      });

      const repeat = graph.ingest({
        type: 'unfriend',
        user1_name: 'alice',
        user2_name: 'bob',
        created_at: '2024-01-04T00:00:00.000Z',
        seq: 5,
      } as WithSeq<UnfriendEvent>);

      expect(repeat.applied).toBe(false);
    });

    it('ignores self-unfriend', () => {
      const result = graph.ingest({
        type: 'unfriend',
        user1_name: 'alice',
        user2_name: 'alice',
        created_at: '2024-01-03T00:00:00.000Z',
        seq: 4,
      } as WithSeq<UnfriendEvent>);

      expect(result.applied).toBe(false);
    });

    it('ignores unfriend if user not registered', () => {
      const result = graph.ingest({
        type: 'unfriend',
        user1_name: 'alice',
        user2_name: 'ghost',
        created_at: '2024-01-03T00:00:00.000Z',
        seq: 4,
      } as WithSeq<UnfriendEvent>);

      expect(result.applied).toBe(false);
    });

    it('ignores outdated unfriend event by seq', () => {
      graph.ingest({
        type: 'unfriend',
        user1_name: 'alice',
        user2_name: 'bob',
        created_at: '2024-01-04T00:00:00.000Z',
        seq: 5,
      });

      const late = graph.ingest({
        type: 'unfriend',
        user1_name: 'alice',
        user2_name: 'bob',
        created_at: '2024-01-03T00:00:00.000Z',
        seq: 4,
      });

      expect(late.applied).toBe(false);
    });
  });

  describe('miscellaneous behaviors', () => {
    it('ingestMany applies only actually applied events', () => {
      const batch = [
        // first registration succeeds
        { type: 'register', name: 'x', created_at: '2024-01-01T00:00:00.000Z', seq: 1 },
        // duplicate seq=1 for same user → no-op
        { type: 'register', name: 'x', created_at: '2024-01-01T00:00:00.000Z', seq: 1 },
        // new user y
        { type: 'register', name: 'y', created_at: '2024-01-02T00:00:00.000Z', seq: 2 },
      ] as SequencedConnectionEvent[];

      expect(graph.ingestMany(batch)).toBe(2);
    });

    it('snapshot + hydrate round‑trip preserves state', () => {
      graph.ingest({ type: 'register', name: 'a', created_at: '2024-01-01T00:00:00.000Z', seq: 1 });
      graph.ingest({ type: 'register', name: 'b', created_at: '2024-01-02T00:00:00.000Z', seq: 2 });
      graph.ingest({
        type: 'referral',
        referredBy: 'a',
        user: 'b',
        created_at: '2024-01-03T00:00:00.000Z',
        seq: 3,
      });

      const snap = graph.snapshot();
      const fresh = new GraphModule({ referralPointDepth: 2 });
      fresh.hydrate(snap);

      expect(fresh.snapshot()).toEqual(snap);
    });

    it('drainDirtyNodes sets referralsCount & friendsCount correctly', () => {
      graph.ingest({
        type: 'register',
        name: 'u1',
        created_at: '2024-01-01T00:00:00.000Z',
        seq: 1,
      });
      graph.ingest({
        type: 'register',
        name: 'u2',
        created_at: '2024-01-01T00:00:00.000Z',
        seq: 2,
      });
      graph.ingest({
        type: 'register',
        name: 'u3',
        created_at: '2024-01-01T00:00:00.000Z',
        seq: 3,
      });
      graph.ingest({
        type: 'referral',
        referredBy: 'u1',
        user: 'u2',
        created_at: '2024-01-02T00:00:00.000Z',
        seq: 4,
      });
      graph.ingest({
        type: 'addfriend',
        user1_name: 'u2',
        user2_name: 'u3',
        created_at: '2024-01-03T00:00:00.000Z',
        seq: 5,
      });

      const dirty = graph.drainDirtyNodes();
      const u1 = dirty.find((u) => u.name === 'u1')!;
      const u2 = dirty.find((u) => u.name === 'u2')!;
      const u3 = dirty.find((u) => u.name === 'u3')!;

      expect(u1.referralsCount).toBe(1);
      expect(u1.friendsCount).toBe(0);

      expect(u2.referralsCount).toBe(0);
      expect(u2.friendsCount).toBe(1);

      expect(u3.referralsCount).toBe(0);
      expect(u3.friendsCount).toBe(1);
    });

    it('respects custom referralPointDepth', () => {
      const smallDepth = new GraphModule({ referralPointDepth: 1 });
      smallDepth.ingest({ type: 'register', name: 'P', created_at: '2024-01-01', seq: 1 });
      smallDepth.ingest({ type: 'register', name: 'C1', created_at: '2024-01-02', seq: 2 });
      smallDepth.ingest({ type: 'register', name: 'C2', created_at: '2024-01-03', seq: 3 });
      smallDepth.ingest({
        type: 'referral',
        referredBy: 'P',
        user: 'C1',
        created_at: '2024-01-02',
        seq: 4,
      });
      smallDepth.ingest({
        type: 'referral',
        referredBy: 'C1',
        user: 'C2',
        created_at: '2024-01-03',
        seq: 5,
      });

      const pNode = smallDepth.snapshot().find((u) => u.name === 'P')!;
      // depth=1 so only +1 for C1, not for C2
      expect(pNode.referralPoints).toBe(1);
    });

    it('ignores unknown event types', () => {
      const res = graph.ingest({ type: 'foobar' } as any);
      expect(res).toEqual({ applied: false, touched: [] });
    });

    it('blocks duplicate seq for same node', () => {
      const ev = {
        type: 'register',
        name: 'dup',
        created_at: '2024-01-01',
        seq: 1,
      } as WithSeq<RegisterEvent>;
      expect(graph.ingest(ev).applied).toBe(true);
      expect(graph.ingest(ev).applied).toBe(false);
    });

    it('clears dirty state after drain', () => {
      graph.ingest({ type: 'register', name: 'd', created_at: '2024-01-01', seq: 1 });
      expect(graph.drainDirtyNodes()).toHaveLength(1);
      expect(graph.drainDirtyNodes()).toHaveLength(0);
    });

    it('does not create users on addfriend of unknown names', () => {
      const res = graph.ingest({
        type: 'addfriend',
        user1_name: 'foo',
        user2_name: 'bar',
        created_at: '2024-01-01',
        seq: 1,
      } as WithSeq<AddFriendEvent>);
      expect(res.applied).toBe(false);
      expect(graph.snapshot()).toEqual([]);
    });

    it('handles a mix of operations correctly', () => {
      graph.ingest({ type: 'register', name: 'A', created_at: '2024-01-01', seq: 1 });
      graph.ingest({ type: 'register', name: 'B', created_at: '2024-01-02', seq: 2 });
      graph.ingest({ type: 'register', name: 'C', created_at: '2024-01-03', seq: 3 });
      graph.ingest({
        type: 'referral',
        referredBy: 'A',
        user: 'B',
        created_at: '2024-01-04',
        seq: 4,
      });
      graph.ingest({
        type: 'addfriend',
        user1_name: 'B',
        user2_name: 'C',
        created_at: '2024-01-05',
        seq: 5,
      });
      graph.ingest({
        type: 'unfriend',
        user1_name: 'B',
        user2_name: 'C',
        created_at: '2024-01-06',
        seq: 6,
      });
      graph.ingest({
        type: 'referral',
        referredBy: 'A',
        user: 'C',
        created_at: '2024-01-07',
        seq: 7,
      });

      const snap = graph.snapshot();
      const a = snap.find((u) => u.name === 'A')!;
      const b = snap.find((u) => u.name === 'B')!;
      const c = snap.find((u) => u.name === 'C')!;

      expect(a.referrals.sort()).toEqual(['B', 'C']);
      expect(a.referralPoints).toBe(2); // B & C both gave points
      expect(b.friends).not.toContain('C'); // unfriended
      expect(c.referredBy).toBe('A');
    });
  });
});
