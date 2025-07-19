import { Elysia, t } from 'elysia';

import { mongoPlugin } from '../plugins/mongo';

export const usersRoute = new Elysia({ name: 'users-route' })
  .use(mongoPlugin)
  .get('/:name/top-friends', async ({ params, usersCol, set }) => {
    const user = await usersCol.findOne({ name: params.name });
    if (!user) {
      set.status = 404;
      return { ok: false, code: 404, message: 'User not found' };
    }

    const friendNames = Array.isArray(user.friends) ? user.friends : [];
    const friends = await usersCol.find({ name: { $in: friendNames } }).toArray();

    const scored = friends.map((u) => ({
      name: u.name,
      strength: (u.friends?.length ?? 0) + (u.referrals?.length ?? 0) + (u.referredBy ? 1 : 0),
    }));

    scored.sort((a, b) => b.strength - a.strength);

    return {
      ok: true,
      code: 200,
      data: scored.slice(0, 3),
    };
  })
  .get(
    '/:name/friends',
    async ({ params, query, usersCol, set }) => {
      const page = Number(query.page ?? 1);
      const pageSize = Number(query.pageSize ?? 10);

      if (page < 1 || pageSize <= 0 || pageSize > 100) {
        set.status = 400;
        return {
          ok: false,
          code: 400,
          message: 'Invalid page or pageSize (must be > 0, pageSize ≤ 100)',
        };
      }

      const user = await usersCol.findOne({ name: params.name });
      if (!user) {
        set.status = 404;
        return { ok: false, code: 404, message: 'User not found' };
      }

      const friendNames = Array.isArray(user.friends) ? user.friends : [];
      const offset = (page - 1) * pageSize;

      const paginatedNames = friendNames.slice(offset, offset + pageSize);
      const friends = await usersCol.find({ name: { $in: paginatedNames } }).toArray();

      return {
        ok: true,
        code: 200,
        data: {
          page,
          pageSize,
          total: friendNames.length,
          results: friends,
        },
      };
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
      }),
    },
  );
