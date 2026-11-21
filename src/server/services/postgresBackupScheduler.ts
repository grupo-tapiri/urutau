import path from 'path';
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface BackupWorkerStatus {
  active: boolean;
  schedule: string;
  startedAtUtc: string | null;
  lastRunAtUtc: string | null;
  lastReport: any;
  lastError: string | null;
}

let activeWorker: Worker | null = null;
const workerStatus: BackupWorkerStatus = {
  active: false,
  schedule: String(process.env.BACKUP_CRON_SCHEDULE || '*/15 * * * *'),
  startedAtUtc: null,
  lastRunAtUtc: null,
  lastReport: null,
  lastError: null
};

export function startPostgresBackupWorkerThread(): Worker | null {
  if (process.env.NODE_ENV === 'test') {
    return null;
  }
  if (String(process.env.ENABLE_HOURLY_PG_BACKUP || 'true').trim().toLowerCase() === 'false') {
    return null;
  }
  if (activeWorker) {
    return activeWorker;
  }

  const workerScriptPath = path.resolve(__dirname, '../workers/postgresBackupWorker.ts');
  const schedule = String(process.env.BACKUP_CRON_SCHEDULE || '*/15 * * * *').trim();

  try {
    const worker = new Worker(workerScriptPath, {
      workerData: { schedule },
      execArgv: process.execArgv
    });

    worker.on('message', (msg: any) => {
      if (msg?.type === 'worker_ready') {
        workerStatus.active = true;
        workerStatus.schedule = msg.schedule || schedule;
        workerStatus.startedAtUtc = msg.startedAtUtc || new Date().toISOString();
      } else if (msg?.type === 'backup_result') {
        workerStatus.lastRunAtUtc = new Date().toISOString();
        workerStatus.lastReport = msg.report || null;
        workerStatus.lastError = msg.report?.ok === false ? msg.report?.reason || null : null;
      } else if (msg?.type === 'backup_error') {
        workerStatus.lastRunAtUtc = msg.atUtc || new Date().toISOString();
        workerStatus.lastError = msg.error || 'Erro no worker de backup';
      }
    });

    worker.on('error', (err) => {
      workerStatus.active = false;
      workerStatus.lastError = err?.message || 'Worker de backup encontrou erro';
      console.warn('[PG Backup Worker] Erro isolado na thread de backup:', workerStatus.lastError);
    });

    worker.on('exit', () => {
      workerStatus.active = false;
      activeWorker = null;
    });

    worker.unref();
    activeWorker = worker;
    return worker;
  } catch (err: any) {
    workerStatus.active = false;
    workerStatus.lastError = err?.message || 'Falha ao iniciar worker_threads de backup';
    console.warn('[PG Backup Worker] Nao foi possivel iniciar worker:', workerStatus.lastError);
    return null;
  }
}

export function triggerManualBackupOnWorker(): boolean {
  if (!activeWorker) return false;
  activeWorker.postMessage({ type: 'run_now' });
  return true;
}

export function getBackupSchedulerStatus(): BackupWorkerStatus {
  return { ...workerStatus };
}
