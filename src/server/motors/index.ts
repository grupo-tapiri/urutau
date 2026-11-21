import { Express, Request, Response } from 'express';
import {
  cloneProductionDatabaseToStaging,
  isStagingEnvironment,
  maskDatabaseUrl,
  resolveDatabaseUrl,
  resolveProdDatabaseUrl
} from '../db/postgresEngine.ts';
import { getMotorHealthRegistry, safeMotorCall } from './motorRuntime.ts';
import { createEscalaMotorRouter } from './escala/index.ts';
import { createReservasMotorRouter } from './reservas/index.ts';
import { createCaixaMotorRouter } from './caixa/index.ts';
import { createPdvMotorRouter } from './pdv/index.ts';
import { createRhCargosMotorRouter } from './rh-cargos/index.ts';
import { createWhatsAppIaMotorRouter } from './whatsapp-ia/index.ts';
import { createGovernancaMotorRouter } from './governanca/index.ts';

export interface UrutauMotorHostBridge {
  getDb: () => any;
  saveDb: () => void;
  reloadJsonDbFromDisk?: () => void;
}

export function registerAllIsolatedMotors(app: Express, bridge: UrutauMotorHostBridge): void {
  const provider = {
    getDb: bridge.getDb,
    saveDb: bridge.saveDb
  };

  app.use('/api/motors/escala', createEscalaMotorRouter(provider));
  app.use('/api/motors/reservas', createReservasMotorRouter(provider));
  app.use('/api/motors/caixa', createCaixaMotorRouter(provider));
  app.use('/api/motors/pdv', createPdvMotorRouter(provider));
  app.use('/api/motors/rh-cargos', createRhCargosMotorRouter(provider));
  app.use('/api/motors/whatsapp-ia', createWhatsAppIaMotorRouter(provider));
  app.use('/api/motors/governanca', createGovernancaMotorRouter(provider));

  app.get('/api/motors/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      appEnv: isStagingEnvironment() ? 'staging' : process.env.APP_ENV || process.env.NODE_ENV || 'production',
      stagingSandboxActive: isStagingEnvironment(),
      databaseEngine: 'postgresql',
      motors: getMotorHealthRegistry()
    });
  });

  app.get('/api/system/staging/status', (_req: Request, res: Response) => {
    const isStaging = isStagingEnvironment();
    res.json({
      ok: true,
      appEnv: isStaging ? 'staging' : process.env.APP_ENV || process.env.NODE_ENV || 'production',
      isStaging,
      stagingSandboxActive: isStaging,
      databaseEngine: 'postgresql',
      databaseTarget: maskDatabaseUrl(resolveDatabaseUrl()),
      prodDatabaseTarget: maskDatabaseUrl(resolveProdDatabaseUrl())
    });
  });

  app.post('/api/system/staging/reset', async (_req: Request, res: Response) => {
    if (!isStagingEnvironment()) {
      res.status(403).json({
        ok: false,
        codigo: 'OPERACAO_EXCLUSIVA_STAGING',
        erro: 'Operacao bloqueada: O reset de banco espelhado so e permitido quando APP_ENV=staging.'
      });
      return;
    }

    const result = await safeMotorCall(
      'governanca',
      async () => {
        const report = await cloneProductionDatabaseToStaging();
        if (bridge.reloadJsonDbFromDisk) {
          bridge.reloadJsonDbFromDisk();
        }
        return report;
      },
      null
    );

    if (result.degraded || !result.data) {
      res.status(500).json({
        ok: false,
        erro: result.error || 'Falha ao restaurar banco espelhado de staging.'
      });
      return;
    }

    res.json({
      ok: true,
      mensagem: 'Ambiente de testes restaurado com sucesso a partir do espelho de producao.',
      relatorio: result.data
    });
  });
}
