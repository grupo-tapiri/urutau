import { Request, Response } from 'express';
import { createIsolatedMotorRouter, safeMotorCall, wrapMotorHandler } from '../motorRuntime.ts';

export interface CaixaContextProvider {
  getDb: () => any;
  saveDb: () => void;
}

export async function buildIsolatedCaixaSnapshot(provider: CaixaContextProvider, empresaId?: number) {
  const db = provider.getDb() || {};

  const lancamentosRes = await safeMotorCall<any[]>(
    'caixa',
    () =>
      (Array.isArray(db.erp_caixa) ? db.erp_caixa : []).filter(
        (c: any) => !c?.arquivado_legal && (!empresaId || !c?.empresa_id || Number(c.empresa_id) === empresaId)
      ),
    []
  );

  const fechamentosRes = await safeMotorCall<any[]>(
    'caixa',
    () =>
      (Array.isArray(db.erp_fechamentos_caixa_diarios) ? db.erp_fechamentos_caixa_diarios : []).filter(
        (f: any) => !f?.arquivado_legal && (!empresaId || !f?.id_empresa || Number(f.id_empresa) === empresaId)
      ),
    []
  );

  const rateiosRes = await safeMotorCall<any[]>(
    'caixa',
    () =>
      (Array.isArray(db.erp_rateios_historico) ? db.erp_rateios_historico : []).filter(
        (r: any) => !r?.arquivado_legal && (!empresaId || !r?.id_empresa || Number(r.id_empresa) === empresaId)
      ),
    []
  );

  const pdvCrossRes = await safeMotorCall<any[]>(
    'pdv',
    () =>
      (Array.isArray(db.pdv_comandas) ? db.pdv_comandas : []).filter(
        (cmd: any) => !cmd?.arquivado_legal && (!empresaId || !cmd?.empresa_id || Number(cmd.empresa_id) === empresaId)
      ),
    []
  );

  return {
    ok: true,
    motor: 'caixa',
    degraded:
      lancamentosRes.degraded ||
      fechamentosRes.degraded ||
      rateiosRes.degraded ||
      pdvCrossRes.degraded,
    crossMotorStatus: {
      pdvDegraded: pdvCrossRes.degraded
    },
    caixa: lancamentosRes.data ?? [],
    fechamentosDiarios: fechamentosRes.data ?? [],
    rateiosHistorico: rateiosRes.data ?? [],
    comandasVinculadasPdv: pdvCrossRes.data ?? []
  };
}

export function createCaixaMotorRouter(provider: CaixaContextProvider) {
  return createIsolatedMotorRouter('caixa', (router) => {
    router.get(
      '/status',
      wrapMotorHandler('caixa', async (req: Request, res: Response) => {
        const empresaId = req.query.empresa_id ? Number(req.query.empresa_id) : undefined;
        const snapshot = await buildIsolatedCaixaSnapshot(provider, empresaId);
        res.json(snapshot);
      })
    );
  });
}
