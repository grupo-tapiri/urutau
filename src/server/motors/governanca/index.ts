import { Request, Response } from 'express';
import {
  getMotorHealthRegistry,
  createIsolatedMotorRouter,
  safeMotorCall,
  wrapMotorHandler
} from '../motorRuntime.ts';
import {
  isStagingEnvironment,
  maskDatabaseUrl,
  resolveDatabaseUrl,
  resolveProdDatabaseUrl
} from '../../db/postgresEngine.ts';
import { getBackupSchedulerStatus } from '../../services/postgresBackupScheduler.ts';

export interface GovernancaContextProvider {
  getDb: () => any;
  saveDb: () => void;
}

export async function buildIsolatedGovernancaSnapshot(provider: GovernancaContextProvider) {
  const db = provider.getDb() || {};

  const auditRes = await safeMotorCall<any[]>(
    'governanca',
    () => (Array.isArray(db.erp_audit_logs) ? db.erp_audit_logs.slice(0, 60) : []),
    []
  );

  const backupsRes = await safeMotorCall<any[]>(
    'governanca',
    () => (Array.isArray(db.backups_horarios) ? db.backups_horarios.slice(0, 20) : []),
    []
  );

  return {
    ok: true,
    motor: 'governanca',
    degraded: auditRes.degraded || backupsRes.degraded,
    appEnv: isStagingEnvironment() ? 'staging' : process.env.APP_ENV || process.env.NODE_ENV || 'production',
    stagingSandboxActive: isStagingEnvironment(),
    databaseEngine: 'postgresql',
    databaseTarget: maskDatabaseUrl(resolveDatabaseUrl()),
    prodDatabaseTarget: maskDatabaseUrl(resolveProdDatabaseUrl()),
    backupScheduler: getBackupSchedulerStatus(),
    motorsHealth: getMotorHealthRegistry(),
    auditLogs: auditRes.data ?? [],
    backupsHorarios: backupsRes.data ?? []
  };
}

export function createGovernancaMotorRouter(provider: GovernancaContextProvider) {
  return createIsolatedMotorRouter('governanca', (router) => {
    router.get(
      '/status',
      wrapMotorHandler('governanca', async (_req: Request, res: Response) => {
        const snapshot = await buildIsolatedGovernancaSnapshot(provider);
        res.json(snapshot);
      })
    );
  });
}
