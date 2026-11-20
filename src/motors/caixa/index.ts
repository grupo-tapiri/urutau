import { safeMotorCall, safeMotorCallSync } from '../../shared/motorRuntime';

export interface IsolatedCaixaData {
  caixa: any[];
  fechamentosCaixaDiarios: any[];
  categoriasFechamentoCaixa: any[];
  rateiosHistorico: any[];
  pdvComandas: any[];
  degraded: boolean;
}

export function selectIsolatedCaixaData(rawErpData: any): IsolatedCaixaData {
  const caixa = safeMotorCallSync<any[]>(
    'caixa',
    () => (Array.isArray(rawErpData?.caixa) ? rawErpData.caixa : []),
    []
  );

  const fechamentos = safeMotorCallSync<any[]>(
    'caixa',
    () =>
      Array.isArray(rawErpData?.fechamentosCaixaDiarios)
        ? rawErpData.fechamentosCaixaDiarios
        : [],
    []
  );

  const categorias = safeMotorCallSync<any[]>(
    'caixa',
    () =>
      Array.isArray(rawErpData?.categoriasFechamentoCaixa)
        ? rawErpData.categoriasFechamentoCaixa
        : [],
    []
  );

  const rateios = safeMotorCallSync<any[]>(
    'caixa',
    () => (Array.isArray(rawErpData?.rateiosHistorico) ? rawErpData.rateiosHistorico : []),
    []
  );

  const pdvComandas = safeMotorCallSync<any[]>(
    'pdv',
    () => (Array.isArray(rawErpData?.pdvComandas) ? rawErpData.pdvComandas : []),
    []
  );

  return {
    caixa: caixa.data ?? [],
    fechamentosCaixaDiarios: fechamentos.data ?? [],
    categoriasFechamentoCaixa: categorias.data ?? [],
    rateiosHistorico: rateios.data ?? [],
    pdvComandas: pdvComandas.data ?? [],
    degraded:
      caixa.degraded ||
      fechamentos.degraded ||
      categorias.degraded ||
      rateios.degraded ||
      pdvComandas.degraded
  };
}

export async function fetchCaixaMotorStatus(empresaId?: number) {
  const qs = empresaId ? `?empresa_id=${empresaId}` : '';
  return safeMotorCall(
    'caixa',
    async () => {
      const res = await fetch(`/api/motors/caixa/status${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    },
    null
  );
}
