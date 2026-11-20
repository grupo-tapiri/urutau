import { Request, Response } from 'express';
import { createIsolatedMotorRouter, safeMotorCall, wrapMotorHandler } from '../motorRuntime.ts';

export interface ReservasContextProvider {
  getDb: () => any;
  saveDb: () => void;
}

export async function buildIsolatedReservasSnapshot(provider: ReservasContextProvider, empresaId?: number) {
  const db = provider.getDb() || {};

  const reservasRes = await safeMotorCall<any[]>(
    'reservas',
    () =>
      (Array.isArray(db.erp_reservas) ? db.erp_reservas : []).filter(
        (r: any) => !r?.arquivado_legal && (!empresaId || !r?.id_empresa || Number(r.id_empresa) === empresaId)
      ),
    []
  );

  const setoresCrossRes = await safeMotorCall<any[]>(
    'rh-cargos',
    () =>
      (Array.isArray(db.setores) ? db.setores : []).filter(
        (s: any) => !s?.arquivado_legal && (!empresaId || !s?.id_empresa || Number(s.id_empresa) === empresaId)
      ),
    []
  );

  const mapaConfigRes = await safeMotorCall<any>(
    'reservas',
    () => {
      const configs = Array.isArray(db.erp_configs) ? db.erp_configs : [];
      const found = configs.find((c: any) => String(c?.chave || '').startsWith('mapa_salao_'));
      return found?.valor_json ?? null;
    },
    null
  );

  return {
    ok: true,
    motor: 'reservas',
    degraded: reservasRes.degraded || setoresCrossRes.degraded || mapaConfigRes.degraded,
    reservas: reservasRes.data ?? [],
    setoresSalao: setoresCrossRes.data ?? [],
    mapaSalaoConfig: mapaConfigRes.data ?? null
  };
}

export function createReservasMotorRouter(provider: ReservasContextProvider) {
  return createIsolatedMotorRouter('reservas', (router) => {
    router.get(
      '/status',
      wrapMotorHandler('reservas', async (req: Request, res: Response) => {
        const empresaId = req.query.empresa_id ? Number(req.query.empresa_id) : undefined;
        const snapshot = await buildIsolatedReservasSnapshot(provider, empresaId);
        res.json(snapshot);
      })
    );
  });
}
