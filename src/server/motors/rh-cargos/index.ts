import { Request, Response } from 'express';
import { createIsolatedMotorRouter, safeMotorCall, wrapMotorHandler } from '../motorRuntime.ts';

export interface RhCargosContextProvider {
  getDb: () => any;
  saveDb: () => void;
}

export async function buildIsolatedRhCargosSnapshot(provider: RhCargosContextProvider, empresaId?: number) {
  const db = provider.getDb() || {};

  const empresasRes = await safeMotorCall<any[]>(
    'rh-cargos',
    () => (Array.isArray(db.empresas) ? db.empresas : []).filter((e: any) => !e?.arquivado_legal),
    []
  );

  const usuariosRes = await safeMotorCall<any[]>(
    'rh-cargos',
    () =>
      (Array.isArray(db.usuarios) ? db.usuarios : [])
        .filter((u: any) => !u?.arquivado_legal)
        .map((u: any) => {
          const copy = { ...u };
          delete copy.senha_argon2id;
          return copy;
        }),
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

  const cadastrosRes = await safeMotorCall<any[]>(
    'rh-cargos',
    () =>
      (Array.isArray(db.cadastros_pessoas) ? db.cadastros_pessoas : []).filter(
        (c: any) => !c?.arquivado_legal && (!empresaId || !c?.id_empresa || Number(c.id_empresa) === empresaId)
      ),
    []
  );

  const freelancersRes = await safeMotorCall<any[]>(
    'rh-cargos',
    () => (Array.isArray(db.freelancers) ? db.freelancers : []).filter((f: any) => !f?.arquivado_legal),
    []
  );

  return {
    ok: true,
    motor: 'rh-cargos',
    degraded:
      empresasRes.degraded ||
      usuariosRes.degraded ||
      cargosRes.degraded ||
      cadastrosRes.degraded ||
      freelancersRes.degraded,
    empresas: empresasRes.data ?? [],
    usuarios: usuariosRes.data ?? [],
    cargos: cargosRes.data ?? [],
    cadastrosPessoas: cadastrosRes.data ?? [],
    freelancers: freelancersRes.data ?? []
  };
}

export function createRhCargosMotorRouter(provider: RhCargosContextProvider) {
  return createIsolatedMotorRouter('rh-cargos', (router) => {
    router.get(
      '/status',
      wrapMotorHandler('rh-cargos', async (req: Request, res: Response) => {
        const empresaId = req.query.empresa_id ? Number(req.query.empresa_id) : undefined;
        const snapshot = await buildIsolatedRhCargosSnapshot(provider, empresaId);
        res.json(snapshot);
      })
    );
  });
}
