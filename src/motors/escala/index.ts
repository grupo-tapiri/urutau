import { safeMotorCall, safeMotorCallSync } from '../../shared/motorRuntime';

export interface IsolatedEscalaData {
  escalaFixa: any[];
  movimentosEscala: any[];
  cargos: any[];
  reservasTurno: any[];
  rhRegistros: any[];
  degradedCrossMotors: string[];
}

export function selectIsolatedEscalaData(rawErpData: any): IsolatedEscalaData {
  const degradedCrossMotors: string[] = [];

  const escalaFixa = safeMotorCallSync<any[]>(
    'escala',
    () => (Array.isArray(rawErpData?.escalaFixa) ? rawErpData.escalaFixa : []),
    []
  );

  const movimentosEscala = safeMotorCallSync<any[]>(
    'escala',
    () => (Array.isArray(rawErpData?.movimentosEscala) ? rawErpData.movimentosEscala : []),
    []
  );

  const cargos = safeMotorCallSync<any[]>(
    'rh-cargos',
    () => (Array.isArray(rawErpData?.cargos) ? rawErpData.cargos : []),
    []
  );
  if (cargos.degraded) degradedCrossMotors.push('rh-cargos');

  const reservas = safeMotorCallSync<any[]>(
    'reservas',
    () => (Array.isArray(rawErpData?.reservas) ? rawErpData.reservas : []),
    []
  );
  if (reservas.degraded) degradedCrossMotors.push('reservas');

  const rhRegistros = safeMotorCallSync<any[]>(
    'rh-cargos',
    () => (Array.isArray(rawErpData?.rhRegistros) ? rawErpData.rhRegistros : []),
    []
  );

  return {
    escalaFixa: escalaFixa.data ?? [],
    movimentosEscala: movimentosEscala.data ?? [],
    cargos: cargos.data ?? [],
    reservasTurno: reservas.data ?? [],
    rhRegistros: rhRegistros.data ?? [],
    degradedCrossMotors
  };
}

export async function fetchEscalaMotorStatus(empresaId?: number) {
  const qs = empresaId ? `?empresa_id=${empresaId}` : '';
  return safeMotorCall(
    'escala',
    async () => {
      const res = await fetch(`/api/motors/escala/status${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    },
    null
  );
}
