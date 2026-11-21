import { parentPort, workerData } from 'worker_threads';
import cron from 'node-cron';
import { executeHourlyPostgresBackup } from '../../../scripts/postgres-gdrive-backup.ts';

const scheduleExpr = String(workerData?.schedule || process.env.BACKUP_CRON_SCHEDULE || '*/15 * * * *').trim();
const validSchedule = cron.validate(scheduleExpr) ? scheduleExpr : '*/15 * * * *';

let isRunningBackup = false;

async function runBackupCycle(trigger: 'cron' | 'manual') {
  if (isRunningBackup) {
    parentPort?.postMessage({
      type: 'backup_skipped_overlap',
      trigger,
      atUtc: new Date().toISOString()
    });
    return;
  }

  isRunningBackup = true;
  try {
    const report = await executeHourlyPostgresBackup();
    parentPort?.postMessage({
      type: 'backup_result',
      trigger,
      report
    });
  } catch (err: any) {
    parentPort?.postMessage({
      type: 'backup_error',
      trigger,
      error: err?.message || 'Erro desconhecido no worker de backup PostgreSQL',
      atUtc: new Date().toISOString()
    });
  } finally {
    isRunningBackup = false;
  }
}

const task = cron.schedule(
  validSchedule,
  () => {
    void runBackupCycle('cron');
  },
  {
    timezone: 'UTC'
  }
);

parentPort?.on('message', (msg: any) => {
  if (msg?.type === 'run_now') {
    void runBackupCycle('manual');
  } else if (msg?.type === 'shutdown') {
    task.stop();
    process.exit(0);
  }
});

parentPort?.postMessage({
  type: 'worker_ready',
  schedule: validSchedule,
  startedAtUtc: new Date().toISOString()
});
