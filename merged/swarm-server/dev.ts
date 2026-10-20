/** Local development launcher (works on Windows, macOS and Linux — no shell env syntax). Memory store, dev room route enabled, any origin.
 *    npm run swarm:dev      then set NEXT_PUBLIC_SWARM_URL=http://localhost:8787 and SWARM_SECRET=dev-secret-dev-secret-dev in .env.local */
process.env.SWARM_DEV = '1';
process.env.SWARM_SECRET ??= 'dev-secret-dev-secret-dev';
process.env.PORT ??= '8787';
delete process.env.DATABASE_URL;
void import('./index');
