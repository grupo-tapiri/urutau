import { Request, Response } from 'express';
import { createIsolatedMotorRouter, safeMotorCall, wrapMotorHandler } from '../motorRuntime.ts';

export interface EscalaContextProvider {
  getDb: () => any;
  saveDb: () => void;
}

export async function buildIsolatedEscalaSnapshot(provider: EscalaContextProvider, empresaId?: number) {
  const db = provider.getDb() || {};

  const escalaFixaRes = await safeMotorCall<any[]>(
    'escala',
    () =>
      (Array.isArray(db.erp_escala_fixa) ? db.erp_escala_fixa : []).filter(
        (e: any) => !e?.arquivado_legal && (!empresaId || !e?.id_empresa || Number(e.id_empresa) === empresaId)
      ),
    []
  );

  const movimentosRes = await safeMotorCall<any[]>(
    'escala',
    () =>
      (Array.isArray(db.erp_movimentos_escala) ? db.erp_movimentos_escala : []).filter(
        (m: any) => !m?.arquivado_legal && (!empresaId || !m?.id_empresa || Number(m.id_empresa) === empresaId)
      ),
    []
  );

  const cargosRes = await safeMotorCall<any[]>(
    'rh-cargos',
    () =>
      (Array.isArray(db.cargos_operacionais) ? db.cargos_operacionais : []).filter(
        (c: any) => !c?.arquivado_legal && (!empresaId || !c?.id_empresa || Number(c.id_empresa) === empresaId)
      ),
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

  const pontoCrossRes = await safeMotorCall<any[]>(
    'rh-cargos',
    () =>
      (Array.isArray(db.erp_rh_registros) ? db.erp_rh_registros : []).filter(
        (p: any) => !p?.arquivado_legal && (!empresaId || !p?.id_empresa || Number(p.id_empresa) === empresaId)
      ),
    []
  );

  return {
    ok: true,
    motor: 'escala',
    degraded:
      escalaFixaRes.degraded ||
      movimentosRes.degraded ||
      cargosRes.degraded ||
      reservasCrossRes.degraded ||
      pontoCrossRes.degraded,
    crossMotorStatus: {
      reservasDegraded: reservasCrossRes.degraded,
      rhCargosDegraded: cargosRes.degraded || pontoCrossRes.degraded
    },
    escalaFixa: escalaFixaRes.data ?? [],
    movimentosEscala: movimentosRes.data ?? [],
    cargosVinculados: cargosRes.data ?? [],
    demandaReservasTurno: reservasCrossRes.data ?? [],
    registrosPonto: pontoCrossRes.data ?? []
  };
}

export function createEscalaMotorRouter(provider: EscalaContextProvider) {
  return createIsolatedMotorRouter('escala', (router) => {
    router.get(
      '/status',
      wrapMotorHandler('escala', async (req: Request, res: Response) => {
        const empresaId = req.query.empresa_id ? Number(req.query.empresa_id) : undefined;
        const snapshot = await buildIsolatedEscalaSnapshot(provider, empresaId);
        res.json(snapshot);
      })
    );
  });
}
