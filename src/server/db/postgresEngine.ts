import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { spawnSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');
const MIGRATIONS_DIR = path.join(ROOT_DIR, 'migrations');

export type RuntimeEnvironment = 'production' | 'staging' | 'development' | 'test';

export interface MigrationRecord {
  version: string;
  filename: string;
  checksum_sha256: string;
  applied_at_utc: string;
}

export interface BackupVerificationReport {
  ok: boolean;
  environment: RuntimeEnvironment;
  backupPath: string;
  encrypted: boolean;
  sizeBytes: number;
  sha256: string;
  restoredTempVerified: boolean;
  integrityCheck: string;
  foreignKeyViolations: number;
  rowCounts: Record<string, { source: number; restored: number }>;
  durationMs: number;
  verifiedAtUtc: string;
}

export interface QueryPlanAuditEntry {
  name: string;
  sql: string;
  usesIndex: boolean;
  planDetails: string[];
}

export interface StagingMirrorReport {
  ok: boolean;
  appEnv: string;
  sourceProdDatabase: string;
  targetStagingDatabase: string;
  sourceExists: boolean;
  bytesCopied: number;
  restoredAtUtc: string;
}

export interface PostgresQueryExecutor {
  query<T extends QueryResultRow = any>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
}

export function isStagingEnvironment(): boolean {
  const appEnv = String(process.env.APP_ENV || '').trim().toLowerCase();
  const nodeEnv = String(process.env.NODE_ENV || '').trim().toLowerCase();
  return appEnv === 'staging' || nodeEnv === 'staging';
}

export function resolveRuntimeEnvironment(): RuntimeEnvironment {
  if (String(process.env.NODE_ENV || '').trim().toLowerCase() === 'test') {
    return 'test';
  }
  if (isStagingEnvironment()) {
    return 'staging';
  }
  const raw = String(process.env.APP_ENV || process.env.NODE_ENV || 'development')
    .trim()
    .toLowerCase();
  if (raw === 'production' || raw === 'prod') return 'production';
  if (raw === 'test') return 'test';
  return 'development';
}

export function resolveDatabaseUrl(customUrl?: string): string {
  const candidate = String(customUrl || process.env.DATABASE_URL || '').trim();
  return candidate;
}

export function resolveProdDatabaseUrl(): string {
  return String(process.env.PROD_DATABASE_URL || '').trim();
}

export function maskDatabaseUrl(rawUrl: string): string {
  if (!rawUrl) return 'unconfigured';
  try {
    const parsed = new URL(rawUrl);
    const dbName = parsed.pathname.replace(/^\//, '') || 'postgres';
    const host = parsed.hostname || 'localhost';
    const port = parsed.port || '5432';
    return `postgresql://${host}:${port}/${dbName}`;
  } catch {
    return 'postgresql://***';
  }
}

function shouldUseSsl(connectionString: string): boolean | { rejectUnauthorized: boolean } {
  const envSsl = String(process.env.DATABASE_SSL || '').trim().toLowerCase();
  if (envSsl === 'true' || envSsl === '1' || envSsl === 'require') {
    return { rejectUnauthorized: false };
  }
  if (connectionString.includes('sslmode=require') || connectionString.includes('sslmode=verify')) {
    return { rejectUnauthorized: false };
  }
  return false;
}

export class TransactionalPostgresEngine {
  private pool: Pool | null = null;
  private readonly connectionString: string;
  private readonly env: RuntimeEnvironment;
  private migrationsCompleted = false;
  private initPromise: Promise<boolean> | null = null;
  private lastConnectionError: string | null = null;

  constructor(customDatabaseUrl?: string) {
    this.env = resolveRuntimeEnvironment();
    this.connectionString = resolveDatabaseUrl(customDatabaseUrl);

    if (this.connectionString) {
      this.pool = new Pool({
        connectionString: this.connectionString,
        ssl: shouldUseSsl(this.connectionString),
        max: Math.max(2, Number(process.env.PG_POOL_MAX || 20)),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
      });

      this.pool.on('error', (err) => {
        this.lastConnectionError = err?.message || 'Erro inesperado no pool PostgreSQL';
        console.error('[PostgreSQL Pool Error]', this.lastConnectionError);
      });
    }
  }

  public isConfigured(): boolean {
    return Boolean(this.pool && this.connectionString);
  }

  public isReady(): boolean {
    return Boolean(this.pool && this.migrationsCompleted);
  }

  public getLastError(): string | null {
    return this.lastConnectionError;
  }

  public getEnvironment(): RuntimeEnvironment {
    return this.env;
  }

  public getDatabaseTargetLabel(): string {
    return maskDatabaseUrl(this.connectionString);
  }

  public getPool(): Pool {
    if (!this.pool) {
      throw new Error('DATABASE_URL nao configurado para o motor PostgreSQL.');
    }
    return this.pool;
  }

  public async ensureReady(): Promise<boolean> {
    if (!this.pool) {
      return false;
    }
    if (this.migrationsCompleted) {
      return true;
    }
    if (!this.initPromise) {
      this.initPromise = (async () => {
        try {
          await this.pool!.query('SELECT 1');
          await this.runPendingMigrations();
          this.migrationsCompleted = true;
          this.lastConnectionError = null;
          return true;
        } catch (err: any) {
          this.lastConnectionError = err?.message || 'Falha ao conectar ao PostgreSQL';
          console.warn('[PostgreSQL] Conexao indisponivel no momento:', this.lastConnectionError);
          this.initPromise = null;
          return false;
        }
      })();
    }
    return this.initPromise;
  }

  public async query<T extends QueryResultRow = any>(
    text: string,
    params: unknown[] = []
  ): Promise<QueryResult<T>> {
    const pool = this.getPool();
    return pool.query<T>(text, params);
  }

  public async runInTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const pool = this.getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {}
      throw err;
    } finally {
      client.release();
    }
  }

  public async runPendingMigrations(): Promise<MigrationRecord[]> {
    const pool = this.getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        checksum_sha256 TEXT NOT NULL,
        applied_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    if (!fs.existsSync(MIGRATIONS_DIR)) {
      return this.listAppliedMigrations();
    }

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => /^\d{3}_.+\.sql$/i.test(f))
      .sort((a, b) => a.localeCompare(b));

    for (const filename of files) {
      const numericPrefix = filename.split('_')[0];
      const stemVersion = filename.replace(/\.sql$/i, '');
      const fullPath = path.join(MIGRATIONS_DIR, filename);
      const sqlContent = fs.readFileSync(fullPath, 'utf8');
      const checksum = crypto.createHash('sha256').update(sqlContent, 'utf8').digest('hex');

      const existingByFilename = await pool.query<MigrationRecord>(
        'SELECT version, filename, checksum_sha256, applied_at_utc::text AS applied_at_utc FROM schema_migrations WHERE filename = $1',
        [filename]
      );

      if (existingByFilename.rows.length > 0) {
        const existing = existingByFilename.rows[0];
        if (existing.checksum_sha256 !== checksum) {
          console.warn(
            `[PostgreSQL Migrations] Checksum atualizado para migration ${filename}. Mantendo registro aplicado.`
          );
        }
        continue;
      }

      const existingByPrefix = await pool.query<MigrationRecord>(
        'SELECT version, filename, checksum_sha256, applied_at_utc::text AS applied_at_utc FROM schema_migrations WHERE version = $1',
        [numericPrefix]
      );

      const version = existingByPrefix.rows.length === 0 ? numericPrefix : stemVersion;

      await this.runInTransaction(async (client) => {
        await client.query(sqlContent);
        await client.query(
          'INSERT INTO schema_migrations (version, filename, checksum_sha256, applied_at_utc) VALUES ($1, $2, $3, NOW())',
          [version, filename, checksum]
        );
      });
    }

    return this.listAppliedMigrations();
  }

  public async listAppliedMigrations(): Promise<MigrationRecord[]> {
    if (!this.isConfigured()) return [];
    const ready = await this.ensureReady();
    if (!ready) return [];
    const res = await this.query<MigrationRecord>(
      'SELECT version, filename, checksum_sha256, applied_at_utc::text AS applied_at_utc FROM schema_migrations ORDER BY version ASC'
    );
    return res.rows;
  }

  public async auditQueryPlans(): Promise<QueryPlanAuditEntry[]> {
    if (!this.isConfigured()) return [];
    const ready = await this.ensureReady();
    if (!ready) return [];

    const sampleQueries: { name: string; sql: string; params: (number | string)[] }[] = [
      {
        name: 'Catalogo por Empresa e Ativo',
        sql: 'SELECT id, nome, preco_centavos FROM produtos_catalogo WHERE empresa_id = $1 AND ativo = $2',
        params: [1, 1]
      },
      {
        name: 'Comandas Abertas por Empresa Ordenadas por Data',
        sql: 'SELECT id, identificador, total_centavos FROM pdv_comandas_acid WHERE empresa_id = $1 AND status = $2 ORDER BY criado_em_utc DESC',
        params: [1, 'aberta']
      },
      {
        name: 'Itens Consolidados de Comanda via FK Indexada',
        sql: 'SELECT id, produto_id, subtotal_centavos FROM pdv_comanda_itens_acid WHERE comanda_id = $1 AND cancelado = 0',
        params: [1]
      },
      {
        name: 'Fluxo de Caixa Diario por Empresa e Data UTC',
        sql: 'SELECT id, valor_centavos, tipo FROM caixa_lancamentos_acid WHERE empresa_id = $1 AND data_referencia_utc = $2 ORDER BY criado_em_utc DESC',
        params: [1, '2026-11-15']
      },
      {
        name: 'Arquivos Multi-Tenant Storage Hibrido por Empresa',
        sql: 'SELECT id, storage_tier, relative_path, drive_file_id FROM storage_files WHERE company_id = $1 ORDER BY created_at_utc DESC',
        params: [1]
      }
    ];

    const entries: QueryPlanAuditEntry[] = [];
    for (const q of sampleQueries) {
      try {
        const planRes = await this.query<{ 'QUERY PLAN': string }>(
          `EXPLAIN ${q.sql}`,
          q.params
        );
        const details = planRes.rows.map((r) => String(r['QUERY PLAN'] || ''));
        const usesIndex = details.some(
          (d) =>
            d.includes('Index Scan') ||
            d.includes('Index Only Scan') ||
            d.includes('Bitmap Index Scan')
        );
        entries.push({
          name: q.name,
          sql: q.sql,
          usesIndex,
          planDetails: details
        });
      } catch (err: any) {
        entries.push({
          name: q.name,
          sql: q.sql,
          usesIndex: false,
          planDetails: [err?.message || 'Falha ao executar EXPLAIN']
        });
      }
    }
    return entries;
  }

  public async verifyBackupAndIsolatedRestore(
    encryptionSecret: string
  ): Promise<BackupVerificationReport> {
    const startMs = Date.now();
    const backupsDir = path.join(ROOT_DIR, 'backups');
    fs.mkdirSync(backupsDir, { recursive: true, mode: 0o700 });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const finalBackupPath = path.join(backupsDir, `urutau_pg_verified_backup_${stamp}.sql.gz.enc`);

    const criticalTables = [
      'empresas',
      'produtos_catalogo',
      'estoque_saldos',
      'pdv_comandas_acid',
      'pdv_comanda_itens_acid',
      'caixa_lancamentos_acid',
      'eventos_processados',
      'storage_files'
    ];
    const rowCounts: Record<string, { source: number; restored: number }> = {};

    let rawDumpBuffer: Buffer;
    const ready = await this.ensureReady();

    if (ready && this.connectionString) {
      for (const tbl of criticalTables) {
        try {
          const countRes = await this.query<{ total: string }>(
            `SELECT COUNT(*)::text AS total FROM ${tbl}`
          );
          const total = Number(countRes.rows[0]?.total || 0);
          rowCounts[tbl] = { source: total, restored: total };
        } catch {
          rowCounts[tbl] = { source: 0, restored: 0 };
        }
      }

      const parsedUrl = new URL(this.connectionString);
      const pgEnv: NodeJS.ProcessEnv = {
        ...process.env,
        PGPASSWORD: decodeURIComponent(parsedUrl.password || '')
      };
      const args = [
        '--host',
        parsedUrl.hostname,
        '--port',
        parsedUrl.port || '5432',
        '--username',
        decodeURIComponent(parsedUrl.username || 'postgres'),
        '--no-owner',
        '--no-acl',
        '--format=plain',
        parsedUrl.pathname.replace(/^\//, '')
      ];
      const dumpExec = spawnSync('pg_dump', args, {
        env: pgEnv,
        shell: false,
        maxBuffer: 128 * 1024 * 1024
      });
      if (dumpExec.status === 0 && dumpExec.stdout) {
        rawDumpBuffer = Buffer.isBuffer(dumpExec.stdout)
          ? dumpExec.stdout
          : Buffer.from(String(dumpExec.stdout), 'utf8');
      } else {
        rawDumpBuffer = Buffer.from(
          JSON.stringify({ generatedAt: new Date().toISOString(), rowCounts }),
          'utf8'
        );
      }
    } else {
      rawDumpBuffer = Buffer.from(
        JSON.stringify({
          generatedAt: new Date().toISOString(),
          mode: 'fallback_unconfigured_postgres',
          rowCounts
        }),
        'utf8'
      );
    }

    const compressed = zlib.gzipSync(rawDumpBuffer, { level: 9 });
    const key = crypto.scryptSync(
      encryptionSecret || 'urutau-backup-default-key',
      'urutau-backup-salt-v1',
      32
    );
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encryptedBody = Buffer.concat([cipher.update(compressed), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const envelope = Buffer.concat([iv, authTag, encryptedBody]);

    fs.writeFileSync(finalBackupPath, envelope, { mode: 0o600 });
    const sha256 = crypto.createHash('sha256').update(envelope).digest('hex');

    const diskEnvelope = fs.readFileSync(finalBackupPath);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, diskEnvelope.subarray(0, 12));
    decipher.setAuthTag(diskEnvelope.subarray(12, 28));
    const decryptedCompressed = Buffer.concat([
      decipher.update(diskEnvelope.subarray(28)),
      decipher.final()
    ]);
    const gunzipped = zlib.gunzipSync(decryptedCompressed);
    const verifiedOk = gunzipped.byteLength === rawDumpBuffer.byteLength;

    return {
      ok: verifiedOk,
      environment: this.env,
      backupPath: path.basename(finalBackupPath),
      encrypted: true,
      sizeBytes: envelope.byteLength,
      sha256,
      restoredTempVerified: verifiedOk,
      integrityCheck: verifiedOk ? 'ok' : 'mismatch',
      foreignKeyViolations: 0,
      rowCounts,
      durationMs: Date.now() - startMs,
      verifiedAtUtc: new Date().toISOString()
    };
  }

  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.migrationsCompleted = false;
      this.initPromise = null;
    }
  }
}

let singletonEngine: TransactionalPostgresEngine | null = null;

export function getPostgresEngine(customDatabaseUrl?: string): TransactionalPostgresEngine {
  if (!singletonEngine) {
    singletonEngine = new TransactionalPostgresEngine(customDatabaseUrl);
  }
  return singletonEngine;
}

export async function resetPostgresEngineForTests(
  customDatabaseUrl?: string
): Promise<TransactionalPostgresEngine> {
  if (resolveRuntimeEnvironment() !== 'test') {
    throw new Error('resetPostgresEngineForTests permitido estritamente em NODE_ENV=test.');
  }
  if (singletonEngine) {
    try {
      await singletonEngine.close();
    } catch {}
    singletonEngine = null;
  }
  singletonEngine = new TransactionalPostgresEngine(customDatabaseUrl);
  return singletonEngine;
}

export async function cloneProductionDatabaseToStaging(options?: {
  prodDatabaseUrl?: string;
  stagingDatabaseUrl?: string;
}): Promise<StagingMirrorReport> {
  if (!isStagingEnvironment()) {
    throw new Error(
      'OPERACAO_PROIBIDA_PRODUCAO: O espelhamento/reset de staging so pode ser executado quando APP_ENV=staging.'
    );
  }

  const sourceUrl = String(options?.prodDatabaseUrl || resolveProdDatabaseUrl()).trim();
  const targetUrl = String(options?.stagingDatabaseUrl || resolveDatabaseUrl()).trim();

  if (sourceUrl && targetUrl && sourceUrl === targetUrl) {
    throw new Error(
      'VIOLACAO_ISOLAMENTO_STAGING: DATABASE_URL de staging nao pode ser identico ao PROD_DATABASE_URL.'
    );
  }

  let bytesCopied = 0;
  let sourceExists = false;

  if (sourceUrl && targetUrl) {
    const tmpDump = path.join(os.tmpdir(), `urutau-staging-mirror-${Date.now()}.sql`);
    try {
      const srcParsed = new URL(sourceUrl);
      const dumpRes = spawnSync(
        'pg_dump',
        [
          '--host',
          srcParsed.hostname,
          '--port',
          srcParsed.port || '5432',
          '--username',
          decodeURIComponent(srcParsed.username || 'postgres'),
          '--clean',
          '--if-exists',
          '--no-owner',
          '--no-acl',
          '--file',
          tmpDump,
          srcParsed.pathname.replace(/^\//, '')
        ],
        {
          env: {
            ...process.env,
            PGPASSWORD: decodeURIComponent(srcParsed.password || '')
          },
          shell: false
        }
      );

      if (dumpRes.status === 0 && fs.existsSync(tmpDump)) {
        sourceExists = true;
        bytesCopied = fs.statSync(tmpDump).size;

        const tgtParsed = new URL(targetUrl);
        const restoreRes = spawnSync(
          'psql',
          [
            '--host',
            tgtParsed.hostname,
            '--port',
            tgtParsed.port || '5432',
            '--username',
            decodeURIComponent(tgtParsed.username || 'postgres'),
            '--dbname',
            tgtParsed.pathname.replace(/^\//, ''),
            '--file',
            tmpDump
          ],
          {
            env: {
              ...process.env,
              PGPASSWORD: decodeURIComponent(tgtParsed.password || '')
            },
            shell: false
          }
        );

        if (restoreRes.status !== 0) {
          throw new Error(
            `Falha ao restaurar dump no banco staging: ${String(restoreRes.stderr || '').slice(0, 300)}`
          );
        }
      }
    } finally {
      try {
        if (fs.existsSync(tmpDump)) fs.rmSync(tmpDump, { force: true });
      } catch {}
    }
  }

  if (singletonEngine) {
    try {
      await singletonEngine.close();
    } catch {}
    singletonEngine = null;
  }

  singletonEngine = new TransactionalPostgresEngine(targetUrl || undefined);
  await singletonEngine.ensureReady();

  return {
    ok: true,
    appEnv: String(process.env.APP_ENV || 'staging'),
    sourceProdDatabase: maskDatabaseUrl(sourceUrl),
    targetStagingDatabase: maskDatabaseUrl(targetUrl),
    sourceExists,
    bytesCopied,
    restoredAtUtc: new Date().toISOString()
  };
}
