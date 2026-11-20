import { Request, Response } from 'express';
import { createIsolatedMotorRouter, safeMotorCall, wrapMotorHandler } from '../motorRuntime.ts';

export interface PdvContextProvider {
  getDb: () => any;
  saveDb: () => void;
}

export async function buildIsolatedPdvSnapshot(provider: PdvContextProvider, empresaId?: number) {
  const db = provider.getDb() || {};

  const produtosRes = await safeMotorCall<any[]>(
    'pdv',
    () =>
      (Array.isArray(db.pdv_produtos) ? db.pdv_produtos : []).filter(
        (p: any) => !p?.arquivado_legal && (!empresaId || !p?.empresa_id || Number(p.empresa_id) === empresaId)
      ),
    []
  );

  const comandasRes = await safeMotorCall<any[]>(
    'pdv',
    () =>
      (Array.isArray(db.pdv_comandas) ? db.pdv_comandas : []).filter(
        (c: any) => !c?.arquivado_legal && (!empresaId || !c?.empresa_id || Number(c.empresa_id) === empresaId)
      ),
    []
  );

  const impressorasRes = await safeMotorCall<any[]>(
    'pdv',
    () => (Array.isArray(db.pdv_impressoras) ? db.pdv_impressoras : []),
    []
  );

  const reservasCrossRes = await safeMotorCall<any[]>(
    'reservas',
    () =>
      (Array.isArray(db.erp_reservas) ? db.erp_reservas : []).filter(
        (r: any) => !r?.arquivado_legal && (!empresaId || !r?.id_empresa || Number(r.id_empresa) === empresaId)
      ),
    []
  );

  return {
    ok: true,
    motor: 'pdv',
    degraded:
      produtosRes.degraded ||
      comandasRes.degraded ||
      impressorasRes.degraded ||
      reservasCrossRes.degraded,
    crossMotorStatus: {
      reservasDegraded: reservasCrossRes.degraded
    },
    pdvProdutos: produtosRes.data ?? [],
    pdvComandas: comandasRes.data ?? [],
    pdvImpressoras: impressorasRes.data ?? [],
    reservasAtivasSalao: reservasCrossRes.data ?? []
  };
}

export function createPdvMotorRouter(provider: PdvContextProvider) {
  return createIsolatedMotorRouter('pdv', (router) => {
    router.get(
      '/status',
      wrapMotorHandler('pdv', async (req: Request, res: Response) => {
        const empresaId = req.query.empresa_id ? Number(req.query.empresa_id) : undefined;
        const snapshot = await buildIsolatedPdvSnapshot(provider, empresaId);
        res.json(snapshot);
      })
    );
  });
}
