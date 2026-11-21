import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import {
  deleteDriveFile,
  DriveListedFile,
  isGoogleDriveServiceAccountConfigured,
  listFilesInDriveFolder,
  uploadBufferToDrive
} from '../src/server/services/googleDriveServiceAccount.ts';
import { isStagingEnvironment, resolveDatabaseUrl } from '../src/server/db/postgresEngine.ts';
import {
  exportAllTenantsLogicalBackups,
  TenantBackupExportResult
} from '../src/server/services/tenantLogicalBackupService.ts';

const BACKUP_NAME_PREFIX = 'urutau-pg-backup-';
const HOURS_48_MS = 48 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

export interface SmartRetentionSummary {
  totalEvaluated: number;
  keptRecent48h: number;
  keptHourly48h: number;
  keptFractionalCurrentHour: number;
  prunedFractionalPreviousHours: number;
  keptDailyArchive: number;
  deletedIds: string[];
}

export interface PostgresGdriveBackupReport {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  fileName?: string;
  driveFileId?: string;
  sizeBytes?: number;
  sha256?: string;
  durationMs: number;
  retention?: SmartRetentionSummary;
  tenantLogicalBackups?: TenantBackupExportResult[];
  executedAtUtc: string;
}

function isTopOfHourTimestamp(createdMs: number): boolean {
  const minute = new Date(createdMs).getUTCMinutes();
  return minute < 5;
}

export function computeSmartRetentionPlan(
  files: DriveListedFile[],
  nowMs: number = Date.now()
): {
  keepIds: Set<string>;
  deleteIds: string[];
  keptRecent48h: number;
  keptHourly48h: number;
  keptFractionalCurrentHour: number;
  prunedFractionalPreviousHours: number;
  keptDailyArchive: number;
} {
  const cutoff48h = nowMs - HOURS_48_MS;
  const keepIds = new Set<string>();
  const recentFiles: Array<{ file: DriveListedFile; createdMs: number; hourBucket: number; isTopOfHour: boolean }> = [];
  const olderByDay = new Map<string, DriveListedFile[]>();

  for (const file of files) {
    if (!file.name.startsWith(BACKUP_NAME_PREFIX) || !file.name.endsWith('.sql.gz')) {
      continue;
    }
    const createdMs = Date.parse(file.createdTime || '');
    if (!Number.isFinite(createdMs)) {
      keepIds.add(file.id);
      continue;
    }

    if (createdMs >= cutoff48h) {
      const hourBucket = Math.floor(createdMs / ONE_HOUR_MS) * ONE_HOUR_MS;
      recentFiles.push({
        file,
        createdMs,
        hourBucket,
        isTopOfHour: isTopOfHourTimestamp(createdMs)
      });
    } else {
      const utcDay = new Date(createdMs).toISOString().slice(0, 10);
      const bucket = olderByDay.get(utcDay) || [];
      bucket.push(file);
      olderByDay.set(utcDay, bucket);
    }
  }

  const fullHourByBucket = new Map<number, { file: DriveListedFile; createdMs: number }>();
  let latestFullHourBucket = -1;

  for (const entry of recentFiles) {
    if (entry.isTopOfHour) {
      if (entry.hourBucket > latestFullHourBucket) {
        latestFullHourBucket = entry.hourBucket;
      }
      const existing = fullHourByBucket.get(entry.hourBucket);
      if (!existing || entry.createdMs > existing.createdMs) {
        fullHourByBucket.set(entry.hourBucket, { file: entry.file, createdMs: entry.createdMs });
      }
    }
  }

  let keptHourly48h = 0;
  for (const [, bestHourly] of fullHourByBucket.entries()) {
    keepIds.add(bestHourly.file.id);
    keptHourly48h += 1;
  }

  let keptFractionalCurrentHour = 0;
  let prunedFractionalPreviousHours = 0;

  for (const entry of recentFiles) {
    if (entry.isTopOfHour) continue;

    if (latestFullHourBucket >= 0 && entry.hourBucket < latestFullHourBucket) {
      prunedFractionalPreviousHours += 1;
      continue;
    }

    const currentHourBucket = Math.floor(nowMs / ONE_HOUR_MS) * ONE_HOUR_MS;
    if (latestFullHourBucket < 0 && entry.hourBucket < currentHourBucket) {
      const sameHourBest = recentFiles
        .filter((x) => x.hourBucket === entry.hourBucket)
        .sort((a, b) => b.createdMs - a.createdMs)[0];
      if (sameHourBest && sameHourBest.file.id === entry.file.id) {
        keepIds.add(entry.file.id);
        keptHourly48h += 1;
      } else {
        prunedFractionalPreviousHours += 1;
      }
      continue;
    }

    keepIds.add(entry.file.id);
    keptFractionalCurrentHour += 1;
  }

  const keptRecent48h = keptHourly48h + keptFractionalCurrentHour;

  let keptDailyArchive = 0;
  for (const [, dayFiles] of olderByDay.entries()) {
    const sortedNewestFirst = [...dayFiles].sort(
      (a, b) => Date.parse(b.createdTime) - Date.parse(a.createdTime)
    );
    if (sortedNewestFirst.length > 0) {
      keepIds.add(sortedNewestFirst[0].id);
      keptDailyArchive += 1;
    }
  }

  const deleteIds = files
    .filter(
      (f) =>
        f.name.startsWith(BACKUP_NAME_PREFIX) &&
        f.name.endsWith('.sql.gz') &&
        !keepIds.has(f.id)
    )
    .map((f) => f.id);

  return {
    keepIds,
    deleteIds,
    keptRecent48h,
    keptHourly48h,
    keptFractionalCurrentHour,
    prunedFractionalPreviousHours,
    keptDailyArchive
  };
}

export async function applySmartRetentionPolicy(folderId: string): Promise<SmartRetentionSummary> {
  const listed = await listFilesInDriveFolder({
    folderId,
    namePrefix: BACKUP_NAME_PREFIX
  });

  const plan = computeSmartRetentionPlan(listed, Date.now());
  const deletedIds: string[] = [];

  for (const fileId of plan.deleteIds) {
    try {
      await deleteDriveFile(fileId);
      deletedIds.push(fileId);
    } catch (err: any) {
      console.warn(`[PG Backup Retention] Falha ao remover backup antigo ${fileId}:`, err?.message);
    }
  }

  return {
    totalEvaluated: listed.length,
    keptRecent48h: plan.keptRecent48h,
    keptHourly48h: plan.keptHourly48h,
    keptFractionalCurrentHour: plan.keptFractionalCurrentHour,
    prunedFractionalPreviousHours: plan.prunedFractionalPreviousHours,
    keptDailyArchive: plan.keptDailyArchive,
    deletedIds
  };
}

async function runPgDumpToGzipFile(databaseUrl: string, targetGzPath: string): Promise<void> {
  const parsedUrl = new URL(databaseUrl);
  const pgEnv: NodeJS.ProcessEnv = {
    ...process.env,
    PGPASSWORD: decodeURIComponent(parsedUrl.password || '')
  };

  const dbName = parsedUrl.pathname.replace(/^\//, '');
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
    dbName
  ];

  const pgDump = spawn('pg_dump', args, {
    env: pgEnv,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stderrData = '';
  pgDump.stderr.on('data', (chunk) => {
    stderrData += String(chunk);
  });

  const gzip = zlib.createGzip({ level: 9 });
  const fileOut = fs.createWriteStream(targetGzPath, { mode: 0o600 });

  const exitPromise = new Promise<number>((resolve, reject) => {
    pgDump.on('error', reject);
    pgDump.on('close', (code) => resolve(code ?? 1));
  });

  await Promise.all([
    pipeline(pgDump.stdout, gzip, fileOut),
    exitPromise.then((code) => {
      if (code !== 0) {
        throw new Error(`pg_dump encerrou com codigo ${code}: ${stderrData.trim().slice(0, 400)}`);
      }
    })
  ]);
}

export async function executeHourlyPostgresBackup(): Promise<PostgresGdriveBackupReport> {
  const startMs = Date.now();
  const executedAtUtc = new Date().toISOString();

  if (isStagingEnvironment()) {
    console.log('[STAGING SANDBOX] Rotina de backup horario de producao ignorada em ambiente staging.');
    return {
      ok: true,
      skipped: true,
      reason: 'staging_sandbox',
      durationMs: Date.now() - startMs,
      executedAtUtc
    };
  }

  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    return {
      ok: false,
      skipped: true,
      reason: 'DATABASE_URL nao configurado.',
      durationMs: Date.now() - startMs,
      executedAtUtc
    };
  }

  const backupFolderId = String(process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID || '').trim();
  if (!isGoogleDriveServiceAccountConfigured() || !backupFolderId) {
    return {
      ok: false,
      skipped: true,
      reason: 'Google Drive Service Account ou GOOGLE_DRIVE_BACKUP_FOLDER_ID nao configurado.',
      durationMs: Date.now() - startMs,
      executedAtUtc
    };
  }

  const stamp = executedAtUtc.replace(/[:.]/g, '-');
  const fileName = `${BACKUP_NAME_PREFIX}${stamp}.sql.gz`;
  const tempFilePath = path.join(os.tmpdir(), fileName);

  try {
    await runPgDumpToGzipFile(databaseUrl, tempFilePath);
    const buffer = fs.readFileSync(tempFilePath);
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    let uploadedId = '';
    let sizeBytes = buffer.byteLength;
    try {
      const uploaded = await uploadBufferToDrive({
        buffer,
        fileName,
        mimeType: 'application/gzip',
        folderId: backupFolderId,
        description: `Urutau PostgreSQL Backup UTC=${executedAtUtc} SHA256=${sha256}`
      });
      uploadedId = uploaded.id;
      sizeBytes = uploaded.sizeBytes;
    } finally {
      buffer.fill(0);
    }

    const [retention, tenantLogicalBackups] = await Promise.all([
      applySmartRetentionPolicy(backupFolderId),
      exportAllTenantsLogicalBackups({
        uploadToDrive: true,
        driveFolderId:
          String(process.env.GOOGLE_DRIVE_TENANT_BACKUP_FOLDER_ID || '').trim() || backupFolderId
      }).catch(() => [] as TenantBackupExportResult[])
    ]);

    return {
      ok: true,
      fileName,
      driveFileId: uploadedId,
      sizeBytes,
      sha256,
      durationMs: Date.now() - startMs,
      retention,
      tenantLogicalBackups,
      executedAtUtc
    };
  } finally {
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.rmSync(tempFilePath, { force: true });
      }
    } catch {}
  }
}

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentFilePath)) {
  executeHourlyPostgresBackup()
    .then((report) => {
      console.log('[PG-GDRIVE-BACKUP]', JSON.stringify(report));
      if (!report.ok && !report.skipped) {
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('[PG-GDRIVE-BACKUP FATAL]', err);
      process.exit(1);
    });
}
