import { safeMotorCall, safeMotorCallSync } from '../../shared/motorRuntime';

export interface IsolatedReservasData {
  reservas: any[];
  setores: any[];
  configs: any[];
  degraded: boolean;
}

export function selectIsolatedReservasData(rawErpData: any): IsolatedReservasData {
  const reservas = safeMotorCallSync<any[]>(
    'reservas',
    () => (Array.isArray(rawErpData?.reservas) ? rawErpData.reservas : []),
    []
  );

  const setores = safeMotorCallSync<any[]>(
    'rh-cargos',
    () => (Array.isArray(rawErpData?.setores) ? rawErpData.setores : []),
    []
  );

  const configs = safeMotorCallSync<any[]>(
    'reservas',
    () => (Array.isArray(rawErpData?.configs) ? rawErpData.configs : []),
    []
  );

  return {
    reservas: reservas.data ?? [],
    setores: setores.data ?? [],
    configs: configs.data ?? [],
    degraded: reservas.degraded || setores.degraded || configs.degraded
  };
}

export async function fetchReservasMotorStatus(empresaId?: number) {
  const qs = empresaId ? `?empresa_id=${empresaId}` : '';
  return safeMotorCall(
    'reservas',
    async () => {
      const res = await fetch(`/api/motors/reservas/status${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    },
    null
  );
}
