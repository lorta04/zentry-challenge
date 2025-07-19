import { Elysia, t } from 'elysia';

import { getClosestSnapshotPath, loadSnapshotByDate } from '../modules/snapshot';
import { mongoPlugin } from '../plugins/mongo';

export const analyticsRoute = new Elysia({ name: 'analytics-route' })
  .use(mongoPlugin)

  .get('/network', async ({ query, usersCol, set }) => {
    const username = query.username;
    if (!username) {
      set.status = 400;
      return { ok: false, code: 400, message: 'Missing ?username param' };
    }

    const centerUser = await usersCol.findOne({ name: username });
    if (!centerUser) {
      set.status = 404;
      return { ok: false, code: 404, message: 'User not found' };
    }

    const referrer = centerUser.referredBy
      ? await usersCol.findOne({ name: centerUser.referredBy })
      : null;

    const referrals = Array.isArray(centerUser.referrals)
      ? await usersCol.find({ name: { $in: centerUser.referrals } }).toArray()
      : [];

    const friends = Array.isArray(centerUser.friends)
      ? await usersCol.find({ name: { $in: centerUser.friends } }).toArray()
      : [];

    const edges = [
      ...(referrer ? [{ from: referrer.name, to: centerUser.name, type: 'Referred' }] : []),
      ...referrals.map((u) => ({ from: centerUser.name, to: u.name, type: 'Referred' })),
      ...friends.map((u) => ({ from: centerUser.name, to: u.name, type: 'Friend' })),
    ];

    return {
      ok: true,
      code: 200,
      data: edges,
    };
  })

  .get(
    '/leaderboard',
    ({ query, set }) => {
      const startDate = new Date(query.start);
      const endDate = new Date(query.end);
      const count = Number(query.count ?? 10);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        set.status = 400;
        return { ok: false, code: 400, message: 'Invalid start or end ISO date format' };
      }

      if (isNaN(count) || count <= 0) {
        set.status = 400;
        return { ok: false, code: 400, message: 'Count must be a positive number' };
      }

      const startPath = getClosestSnapshotPath(startDate);
      const endPath = getClosestSnapshotPath(endDate);
      if (!startPath || !endPath) {
        set.status = 404;
        return {
          ok: false,
          code: 404,
          message: 'One or both snapshots not found near given dates',
        };
      }

      const startSnap = loadSnapshotByDate(startDate);
      const endSnap = loadSnapshotByDate(endDate);
      if (!startSnap || !endSnap) {
        set.status = 500;
        return { ok: false, code: 500, message: 'Snapshot(s) could not be loaded' };
      }

      const startMap = new Map(startSnap.map((u) => [u.name, u]));
      const endMap = new Map(endSnap.map((u) => [u.name, u]));

      type RankedUser = { name: string; value: number };

      const referralPointsRank: RankedUser[] = [];
      const networkStrengthRank: RankedUser[] = [];

      for (const [name, endUser] of endMap) {
        const startUser = startMap.get(name);
        const referralDelta = (endUser.referralPoints ?? 0) - (startUser?.referralPoints ?? 0);

        const networkStrength =
          (endUser.friends?.length ?? 0) +
          (endUser.referrals?.length ?? 0) +
          (endUser.referredBy ? 1 : 0);

        referralPointsRank.push({ name, value: referralDelta });
        networkStrengthRank.push({ name, value: networkStrength });
      }

      referralPointsRank.sort((a, b) => b.value - a.value);
      networkStrengthRank.sort((a, b) => b.value - a.value);

      const startFile = startPath.split('/').pop()!;
      const endFile = endPath.split('/').pop()!;

      const parseFileTimestamp = (fileName: string) =>
        fileName
          .replace('graph_snapshot_', '')
          .replace('.json', '')
          .replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, 'T$1:$2:$3.$4Z');

      return {
        ok: true,
        code: 200,
        data: {
          startTimestamp: parseFileTimestamp(startFile),
          endTimestamp: parseFileTimestamp(endFile),
          referralPoints: referralPointsRank.slice(0, count),
          networkStrength: networkStrengthRank.slice(0, count),
        },
      };
    },
    {
      query: t.Object({
        start: t.String(),
        end: t.String(),
        count: t.Optional(t.String()),
      }),
    },
  );
