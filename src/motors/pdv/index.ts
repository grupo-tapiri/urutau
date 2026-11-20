import { safeMotorCall, safeMotorCallSync } from '../../shared/motorRuntime';
import { offlineSyncEngine } from '../../services/offlineSyncEngine';

export interface IsolatedPdvData {
  pdvProdutos: any[];
  pdvComandas: any[];
  pdvImpressoras: any[];
  pdvFilaImpressao: any[];
  reservasSalao: any[];
  offlineQueueSize: number;
  degraded: boolean;
}

export function selectIsolatedPdvData(rawErpData: any): IsolatedPdvData {
  const produtos = safeMotorCallSync<any[]>(
    'pdv',
    () => (Array.isArray(rawErpData?.pdvProdutos) ? rawErpData.pdvProdutos : []),
    []
  );

  const comandas = safeMotorCallSync<any[]>(
    'pdv',
    () => (Array.isArray(rawErpData?.pdvComandas) ? rawErpData.pdvComandas : []),
    []
  );

  const impressoras = safeMotorCallSync<any[]>(
    'pdv',
    () => (Array.isArray(rawErpData?.pdvImpressoras) ? rawErpData.pdvImpressoras : []),
    []
  );

  const filaImpressao = safeMotorCallSync<any[]>(
    'pdv',
    () => (Array.isArray(rawErpData?.pdvFilaImpressao) ? rawErpData.pdvFilaImpressao : []),
    []
  );

  const reservas = safeMotorCallSync<any[]>(
    'reservas',
    () => (Array.isArray(rawErpData?.reservas) ? rawErpData.reservas : []),
    []
  );

  const offlineQueue = safeMotorCallSync<number>(
    'pdv',
    () => offlineSyncEngine.getQueue().filter((q) => q.status === 'pendente').length,
    0
  );

  return {
    pdvProdutos: produtos.data ?? [],
    pdvComandas: comandas.data ?? [],
    pdvImpressoras: impressoras.data ?? [],
    pdvFilaImpressao: filaImpressao.data ?? [],
    reservasSalao: reservas.data ?? [],
    offlineQueueSize: offlineQueue.data ?? 0,
    degraded:
      produtos.degraded ||
      comandas.degraded ||
      impressoras.degraded ||
      filaImpressao.degraded ||
      reservas.degraded
  };
}

export async function fetchPdvMotorStatus(empresaId?: number) {
  const qs = empresaId ? `?empresa_id=${empresaId}` : '';
  return safeMotorCall(
    'pdv',
    async () => {
      const res = await fetch(`/api/motors/pdv/status${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    },
    null
  );
}
