import { cors } from '@elysiajs/cors';
import swagger from '@elysiajs/swagger';
import { Elysia } from 'elysia';
import { firstSnapshotTime, lastSnapshotTime, syncAndIngestSnapshots } from 'modules/snapshot';
import { mongoPlugin } from 'plugins/mongo';
import { analyticsRoute } from 'routes/analytics';
import { metaRoute } from 'routes/meta';
import { usersRoute } from 'routes/users';

await syncAndIngestSnapshots();
console.log(`📅 First snapshot: ${firstSnapshotTime?.toISOString()}`);
console.log(`📅 Last snapshot:  ${lastSnapshotTime?.toISOString()}`);

new Elysia()
  .use(cors({ origin: true }))
  .use(mongoPlugin)
  .group('/analytics', (app) => app.use(analyticsRoute))
  .group('/users', (app) => app.use(usersRoute))
  .group('/meta', (app) => app.use(metaRoute))
  .use(
    swagger({
      path: '/swagger',
      documentation: {
        info: {
          title: 'Bacefook API',
          version: '1.0.0',
          description: 'Neatly injected MongoDB + analytics route',
        },
      },
    }),
  )
  .listen(3000);

console.log('🦊 Running on http://localhost:3000');
