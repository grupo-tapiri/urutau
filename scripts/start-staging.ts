import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  cloneProductionDatabaseToStaging,
  isStagingEnvironment,
  resolveDatabaseFilePath,
  resolveProdDatabaseFilePath
} from '../src/server/db/sqliteEngine.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

async function cloneWithBunOrNodeSqlite(): Promise<void> {
  if (!process.env.APP_ENV) {
    process.env.APP_ENV = 'staging';
  }
  if (!process.env.DATABASE_PATH) {
    process.env.DATABASE_PATH = '/tmp/urutau-staging.db';
  }

  if (isStagingEnvironment()) {
    const sourceProd = resolveProdDatabaseFilePath();
    const targetStaging = resolveDatabaseFilePath();

    fs.mkdirSync(path.dirname(targetStaging), { recursive: true, mode: 0o700 });

    const isBunRuntime = typeof (globalThis as any).Bun !== 'undefined';
    if (isBunRuntime && fs.existsSync(sourceProd)) {
      try {
        for (const suffix of ['', '-wal', '-shm']) {
          const artifact = `${targetStaging}${suffix}`;
          if (fs.existsSync(artifact)) {
            fs.rmSync(artifact, { force: true });
          }
        }
        const bunSqliteModName = 'bun:sqlite';
        const bunSqlite = await import(bunSqliteModName);
        const Database = bunSqlite.Database || bunSqlite.default;
        const sourceDb = new Database(sourceProd, { readonly: true });
        try {
          const escaped = targetStaging.replace(/'/g, "''");
          sourceDb.exec(`VACUUM INTO '${escaped}'`);
        } finally {
          sourceDb.close();
        }
        console.log(
          `[STAGING MIRROR BUN] Banco espelhado com sucesso de ${sourceProd} para ${targetStaging}`
        );
      } catch {
        const report = cloneProductionDatabaseToStaging({
          prodDbPath: sourceProd,
          stagingDbPath: targetStaging
        });
        console.log(
          `[STAGING MIRROR SQLITE] Banco espelhado (${report.bytesCopied} bytes) de ${report.sourceProdPath} para ${report.targetStagingPath}`
        );
      }
    } else {
      const report = cloneProductionDatabaseToStaging({
        prodDbPath: sourceProd,
        stagingDbPath: targetStaging
      });
      console.log(
        `[STAGING MIRROR] Ambiente de testes inicializado em ${report.targetStagingPath} (origem: ${report.sourceProdPath}, ${report.bytesCopied} bytes)`
      );
    }

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

cloneWithBunOrNodeSqlite().catch((err) => {
  console.error('[STAGING BOOT ERROR]', err);
  process.exit(1);
});
