import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  cloneProductionDatabaseToStaging,
  isStagingEnvironment
} from '../src/server/db/postgresEngine.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

async function bootStagingMirror(): Promise<void> {
  if (!process.env.APP_ENV) {
    process.env.APP_ENV = 'staging';
  }

  if (isStagingEnvironment()) {
    const report = await cloneProductionDatabaseToStaging();
    console.log(
      `[STAGING MIRROR POSTGRES] Ambiente staging pronto (${report.targetStagingDatabase} <- ${report.sourceProdDatabase}, ${report.bytesCopied} bytes)`
    );

    const prodJsonPath =
      process.env.PROD_JSON_DATABASE_PATH ||
      (fs.existsSync('/app/prod-data/urutau_db.json')
        ? '/app/prod-data/urutau_db.json'
        : path.join(ROOT_DIR, 'data', 'urutau_db.json'));
    const stagingJsonPath = process.env.STAGING_JSON_DATABASE_PATH || '/tmp/urutau_db_staging.json';
    if (fs.existsSync(prodJsonPath) && path.resolve(prodJsonPath) !== path.resolve(stagingJsonPath)) {
      try {
        fs.copyFileSync(prodJsonPath, stagingJsonPath);
        process.env.URUTAU_JSON_DB_PATH = stagingJsonPath;
      } catch {}
    }
  }

  await import('../server.ts');
}

bootStagingMirror().catch((err) => {
  console.error('[STAGING BOOT ERROR]', err);
  process.exit(1);
});
