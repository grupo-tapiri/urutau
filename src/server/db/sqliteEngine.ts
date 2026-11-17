import { DatabaseSync } from 'node:sqlite';
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

export type RuntimeEnvironment = 'production' | 'development' | 'test';

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

export function resolveRuntimeEnvironment(): RuntimeEnvironment {
  const raw = String(process.env.NODE_ENV || 'development').trim().toLowerCase();
  if (raw === 'production' || raw === 'prod') return 'production';
  if (raw === 'test') return 'test';
  return 'development';
}

export function resolveDatabaseFilePath(customPath?: string): string {
  const env = resolveRuntimeEnvironment();
  if (customPath) {
    if (env === 'test' && customPath.includes('urutau_acid_prod')) {
      throw new Error('VIOLACAO_GOVERNANCA_AMBIENTE: Suite de testes bloqueada de acessar banco de producao.');
    }
    return customPath;
  }
  if (env === 'test') {
    const explicitTestPath = process.env.URUTAU_TEST_SQLITE_PATH;
    if (explicitTestPath) {
      if (explicitTestPath.includes('urutau_acid_prod')) {
        throw new Error('VIOLACAO_GOVERNANCA_AMBIENTE: URUTAU_TEST_SQLITE_PATH aponta para arquivo de producao.');
      }
      return explicitTestPath;
    }
    return path.join(os.tmpdir(), `urutau_acid_test_${process.pid}.sqlite`);
  }
  const dataDir = path.join(ROOT_DIR, 'data');
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  if (env === 'production') {
    return path.join(dataDir, 'urutau_acid_prod.sqlite');
  }
  return path.join(dataDir, 'urutau_acid_dev.sqlite');
}

export class TransactionalSqliteEngine {
  private db: DatabaseSync;
  private readonly dbPath: string;
  private readonly env: RuntimeEnvironment;
  private inTransactionDepth = 0;

  constructor(customPath?: string) {
    this.env = resolveRuntimeEnvironment();
    this.dbPath = resolveDatabaseFilePath(customPath);
    const parentDir = path.dirname(this.dbPath);
    fs.mkdirSync(parentDir, { recursive: true, mode: 0o700 });

    this.db = new DatabaseSync(this.dbPath);
    this.configurePragmas();
    this.runPendingMigrations();
  }

  private configurePragmas(): void {
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA synchronous = FULL');
    this.db.exec('PRAGMA foreign_keys = ON');
    this.db.exec('PRAGMA busy_timeout = 5000');
    this.db.exec('PRAGMA temp_store = MEMORY');
    try {
      fs.chmodSync(this.dbPath, 0o600);
    } catch {}
  }

  public getConnection(): DatabaseSync {
    return this.db;
  }

  public getDatabasePath(): string {
    return this.dbPath;
  }

  public getEnvironment(): RuntimeEnvironment {
    return this.env;
  }

  public runPendingMigrations(): MigrationRecord[] {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        checksum_sha256 TEXT NOT NULL,
        applied_at_utc TEXT NOT NULL
      ) STRICT;
    `);

    if (!fs.existsSync(MIGRATIONS_DIR)) {
      return this.listAppliedMigrations();
    }

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => /^\d{3}_.+\.sql$/i.test(f))
      .sort((a, b) => a.localeCompare(b));

    const checkStmt = this.db.prepare(
      'SELECT version, filename, checksum_sha256, applied_at_utc FROM schema_migrations WHERE version = ?'
    );
    const insertStmt = this.db.prepare(
      'INSERT INTO schema_migrations (version, filename, checksum_sha256, applied_at_utc) VALUES (?, ?, ?, ?)'
    );

    for (const filename of files) {
      const version = filename.split('_')[0];
      const fullPath = path.join(MIGRATIONS_DIR, filename);
      const sqlContent = fs.readFileSync(fullPath, 'utf8');
      const checksum = crypto.createHash('sha256').update(sqlContent, 'utf8').digest('hex');

      const existing = checkStmt.get(version) as unknown as MigrationRecord | undefined;
      if (existing) {
        if (existing.checksum_sha256 !== checksum) {
          throw new Error(
            `INTEGRIDADE_MIGRATION_VIOLADA: A migration ${filename} foi alterada apos aplicacao.`
          );
        }
        continue;
      }

      this.runInImmediateTransaction(() => {
        this.db.exec(sqlContent);
        insertStmt.run(version, filename, checksum, new Date().toISOString());
      });
    }

    return this.listAppliedMigrations();
  }

  public listAppliedMigrations(): MigrationRecord[] {
    const rows = this.db
      .prepare('SELECT version, filename, checksum_sha256, applied_at_utc FROM schema_migrations ORDER BY version ASC')
      .all();
    return rows as unknown as MigrationRecord[];
  }

  public runInImmediateTransaction<T>(work: (conn: DatabaseSync) => T): T {
    if (this.inTransactionDepth > 0) {
      const savepointName = `sp_urutau_${this.inTransactionDepth}`;
      this.inTransactionDepth += 1;
      this.db.exec(`SAVEPOINT ${savepointName}`);
      try {
        const result = work(this.db);
        this.db.exec(`RELEASE SAVEPOINT ${savepointName}`);
        return result;
      } catch (err) {
        try {
          this.db.exec(`ROLLBACK TO SAVEPOINT ${savepointName}`);
          this.db.exec(`RELEASE SAVEPOINT ${savepointName}`);
        } catch {}
        throw err;
      } finally {
        this.inTransactionDepth -= 1;
      }
    }

    this.inTransactionDepth = 1;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = work(this.db);
      this.db.exec('COMMIT');
      return result;
    } catch (err) {
      try {
        this.db.exec('ROLLBACK');
      } catch {}
      throw err;
    } finally {
      this.inTransactionDepth = 0;
    }
  }

  public auditQueryPlans(): QueryPlanAuditEntry[] {
    const sampleQueries: { name: string; sql: string; params: (number | string)[] }[] = [
      {
        name: 'Catalogo por Empresa e Ativo',
        sql: 'SELECT id, nome, preco_centavos FROM produtos_catalogo WHERE empresa_id = ? AND ativo = ?',
        params: [1, 1]
      },
      {
        name: 'Comandas Abertas por Empresa Ordenadas por Data',
        sql: 'SELECT id, identificador, total_centavos FROM pdv_comandas_acid WHERE empresa_id = ? AND status = ? ORDER BY criado_em_utc DESC',
        params: [1, 'aberta']
      },
      {
        name: 'Itens Consolidados de Comanda via FK Indexada',
        sql: 'SELECT id, produto_id, subtotal_centavos FROM pdv_comanda_itens_acid WHERE comanda_id = ? AND cancelado = 0',
        params: [1]
      },
      {
        name: 'Fluxo de Caixa Diario por Empresa e Data UTC',
        sql: 'SELECT id, valor_centavos, tipo FROM caixa_lancamentos_acid WHERE empresa_id = ? AND data_referencia_utc = ? ORDER BY criado_em_utc DESC',
        params: [1, '2026-11-15']
      }
    ];

    return sampleQueries.map((q) => {
      const planRows = this.db.prepare(`EXPLAIN QUERY PLAN ${q.sql}`).all(...q.params) as Array<{
        detail?: string;
      }>;
      const details = planRows.map((r) => String(r.detail || ''));
      const usesIndex = details.some(
        (d) => d.includes('USING INDEX') || d.includes('USING COVERING INDEX') || d.includes('USING INTEGER PRIMARY KEY')
      );
      return {
        name: q.name,
        sql: q.sql,
        usesIndex,
        planDetails: details
      };
    });
  }

  public verifyBackupAndIsolatedRestore(encryptionSecret: string): BackupVerificationReport {
    const startMs = Date.now();
    const backupsDir = path.join(ROOT_DIR, 'backups');
    fs.mkdirSync(backupsDir, { recursive: true, mode: 0o700 });

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'urutau-restore-verify-'));
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rawSnapshotPath = path.join(tempDir, `snapshot_${stamp}.sqlite`);
    const restoredDbPath = path.join(tempDir, `restored_${stamp}.sqlite`);
    const finalBackupPath = path.join(backupsDir, `urutau_verified_backup_${stamp}.sqlite.gz.enc`);

    try {
      const escapedSnapshot = rawSnapshotPath.replace(/'/g, "''");
      this.db.exec(`VACUUM INTO '${escapedSnapshot}'`);

      const snapshotBytes = fs.readFileSync(rawSnapshotPath);
      const compressed = zlib.gzipSync(snapshotBytes, { level: 9 });

      const key = crypto.scryptSync(encryptionSecret || 'urutau-backup-default-key', 'urutau-backup-salt-v1', 32);
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const encryptedBody = Buffer.concat([cipher.update(compressed), cipher.final()]);
      const authTag = cipher.getAuthTag();
      const envelope = Buffer.concat([iv, authTag, encryptedBody]);

      fs.writeFileSync(finalBackupPath, envelope, { mode: 0o600 });
      const sha256 = crypto.createHash('sha256').update(envelope).digest('hex');

      const diskEnvelope = fs.readFileSync(finalBackupPath);
      const readIv = diskEnvelope.subarray(0, 12);
      const readTag = diskEnvelope.subarray(12, 28);
      const readBody = diskEnvelope.subarray(28);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, readIv);
      decipher.setAuthTag(readTag);
      const decryptedCompressed = Buffer.concat([decipher.update(readBody), decipher.final()]);
      const restoredBytes = zlib.gunzipSync(decryptedCompressed);
      fs.writeFileSync(restoredDbPath, restoredBytes, { mode: 0o600 });

      const restoredConn = new DatabaseSync(restoredDbPath, { readOnly: true });
      try {
        const integrityRow = restoredConn.prepare('PRAGMA integrity_check').get() as {
          integrity_check?: string;
        };
        const integrityCheck = String(integrityRow?.integrity_check || 'failed');
        const fkViolations = restoredConn.prepare('PRAGMA foreign_key_check').all();

        const criticalTables = [
          'empresas',
          'produtos_catalogo',
          'estoque_saldos',
          'pdv_comandas_acid',
          'pdv_comanda_itens_acid',
          'caixa_lancamentos_acid',
          'eventos_processados'
        ];
        const rowCounts: Record<string, { source: number; restored: number }> = {};
        let allCountsMatch = true;

        for (const tbl of criticalTables) {
          const srcCount = Number(
            (this.db.prepare(`SELECT COUNT(*) AS total FROM ${tbl}`).get() as { total: number }).total
          );
          const rstCount = Number(
            (restoredConn.prepare(`SELECT COUNT(*) AS total FROM ${tbl}`).get() as { total: number }).total
          );
          rowCounts[tbl] = { source: srcCount, restored: rstCount };
          if (srcCount !== rstCount) {
            allCountsMatch = false;
          }
        }

        const ok = integrityCheck === 'ok' && fkViolations.length === 0 && allCountsMatch;
        return {
          ok,
          environment: this.env,
          backupPath: path.basename(finalBackupPath),
          encrypted: true,
          sizeBytes: envelope.byteLength,
          sha256,
          restoredTempVerified: ok,
          integrityCheck,
          foreignKeyViolations: fkViolations.length,
          rowCounts,
          durationMs: Date.now() - startMs,
          verifiedAtUtc: new Date().toISOString()
        };
      } finally {
        restoredConn.close();
      }
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  }

  public close(): void {
    this.db.close();
  }
}

let singletonEngine: TransactionalSqliteEngine | null = null;

export function getSqliteEngine(customPath?: string): TransactionalSqliteEngine {
  if (!singletonEngine) {
    singletonEngine = new TransactionalSqliteEngine(customPath);
  }
  return singletonEngine;
}

export function resetSqliteEngineForTests(customPath?: string): TransactionalSqliteEngine {
  if (resolveRuntimeEnvironment() !== 'test') {
    throw new Error('resetSqliteEngineForTests permitido estritamente em NODE_ENV=test.');
  }
  if (singletonEngine) {
    try {
      singletonEngine.close();
    } catch {}
    singletonEngine = null;
  }
  singletonEngine = new TransactionalSqliteEngine(customPath);
  return singletonEngine;
}
