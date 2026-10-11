// Fresh, realistic data for every E2E run (separate database: gym_mgmt_e2e).
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const E2E_DB = 'mongodb://127.0.0.1:27017/gym_mgmt_e2e';

export default async function globalSetup() {
  const env = { ...process.env, NODE_ENV: 'test', MONGO_URI: E2E_DB, JWT_ACCESS_SECRET: 'e2e-access-secret', JWT_REFRESH_SECRET: 'e2e-refresh-secret' };
  execFileSync(process.execPath, [path.join(here, 'seed-e2e.mjs')], { env, stdio: 'inherit', cwd: path.join(here, '..', '..', 'server') });
}
