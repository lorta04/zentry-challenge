import { Elysia } from 'elysia';

import { firstSnapshotTime, lastSnapshotTime } from '../modules/snapshot';
import { mongoPlugin } from '../plugins/mongo';

export const metaRoute = new Elysia({ name: 'meta-route' })
  .use(mongoPlugin)
  .get('/snapshots', () => {
    return {
      ok: true,
      code: 200,
      data: {
        firstSnapshotTime: firstSnapshotTime?.toISOString() ?? null,
        lastSnapshotTime: lastSnapshotTime?.toISOString() ?? null,
      },
    };
  })
  .get('/users', async ({ usersCol, set }) => {
    try {
      const total = await usersCol.countDocuments();

      return {
        ok: true,
        code: 200,
        data: {
          totalUsers: total,
        },
      };
    } catch (err) {
      set.status = 500;
      return {
        ok: false,
        code: 500,
        message: 'Failed to count users from MongoDB',
      };
    }
  });
