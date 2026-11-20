import { Request, Response } from 'express';
import { isStagingEnvironment } from '../../db/sqliteEngine.ts';
import { createIsolatedMotorRouter, safeMotorCall, wrapMotorHandler } from '../motorRuntime.ts';

export interface WhatsAppIaContextProvider {
  getDb: () => any;
  saveDb: () => void;
}

export async function buildIsolatedWhatsAppIaSnapshot(provider: WhatsAppIaContextProvider) {
  const db = provider.getDb() || {};

  const instanciasRes = await safeMotorCall<any[]>(
    'whatsapp-ia',
    () => (Array.isArray(db.instancias_chat) ? db.instancias_chat : []),
    []
  );

  const mensagensRes = await safeMotorCall<any[]>(
    'whatsapp-ia',
    () => (Array.isArray(db.mensagens_chat) ? db.mensagens_chat.slice(-100) : []),
    []
  );

  return {
    ok: true,
    motor: 'whatsapp-ia',
    stagingSandboxActive: isStagingEnvironment(),
    degraded: instanciasRes.degraded || mensagensRes.degraded,
    instanciasChat: instanciasRes.data ?? [],
    mensagensRecentes: mensagensRes.data ?? []
  };
}

export function createWhatsAppIaMotorRouter(provider: WhatsAppIaContextProvider) {
  return createIsolatedMotorRouter('whatsapp-ia', (router) => {
    router.get(
      '/status',
      wrapMotorHandler('whatsapp-ia', async (_req: Request, res: Response) => {
        const snapshot = await buildIsolatedWhatsAppIaSnapshot(provider);
        res.json(snapshot);
      })
    );
  });
}
