import { safeMotorCall, safeMotorCallSync } from '../../shared/motorRuntime';

export interface IsolatedRhCargosData {
  empresas: any[];
  usuarios: any[];
  cargos: any[];
  cadastrosPessoas: any[];
  freelancers: any[];
  selecao: any[];
  rhRegistros: any[];
  unidades: any[];
  setores: any[];
  degraded: boolean;
}

export function selectIsolatedRhCargosData(rawErpData: any): IsolatedRhCargosData {
  const empresas = safeMotorCallSync<any[]>(
    'rh-cargos',
    () => (Array.isArray(rawErpData?.empresas) ? rawErpData.empresas : []),
    []
  );
  const usuarios = safeMotorCallSync<any[]>(
    'rh-cargos',
    () => (Array.isArray(rawErpData?.usuarios) ? rawErpData.usuarios : []),
    []
  );
  const cargos = safeMotorCallSync<any[]>(
    'rh-cargos',
    () => (Array.isArray(rawErpData?.cargos) ? rawErpData.cargos : []),
    []
  );
  const cadastros = safeMotorCallSync<any[]>(
    'rh-cargos',
    () => (Array.isArray(rawErpData?.cadastrosPessoas) ? rawErpData.cadastrosPessoas : []),
    []
  );
  const freelancers = safeMotorCallSync<any[]>(
    'rh-cargos',
    () => (Array.isArray(rawErpData?.freelancers) ? rawErpData.freelancers : []),
    []
  );
  const selecao = safeMotorCallSync<any[]>(
    'rh-cargos',
    () => (Array.isArray(rawErpData?.selecao) ? rawErpData.selecao : []),
    []
  );
  const rhRegistros = safeMotorCallSync<any[]>(
    'rh-cargos',
    () => (Array.isArray(rawErpData?.rhRegistros) ? rawErpData.rhRegistros : []),
    []
  );
  const unidades = safeMotorCallSync<any[]>(
    'rh-cargos',
    () => (Array.isArray(rawErpData?.unidades) ? rawErpData.unidades : []),
    []
  );
  const setores = safeMotorCallSync<any[]>(
    'rh-cargos',
    () => (Array.isArray(rawErpData?.setores) ? rawErpData.setores : []),
    []
  );

  return {
    empresas: empresas.data ?? [],
    usuarios: usuarios.data ?? [],
    cargos: cargos.data ?? [],
    cadastrosPessoas: cadastros.data ?? [],
    freelancers: freelancers.data ?? [],
    selecao: selecao.data ?? [],
    rhRegistros: rhRegistros.data ?? [],
    unidades: unidades.data ?? [],
    setores: setores.data ?? [],
    degraded:
      empresas.degraded ||
      usuarios.degraded ||
      cargos.degraded ||
      cadastros.degraded ||
      freelancers.degraded
  };
}

export async function fetchRhCargosMotorStatus(empresaId?: number) {
  const qs = empresaId ? `?empresa_id=${empresaId}` : '';
  return safeMotorCall(
    'rh-cargos',
    async () => {
      const res = await fetch(`/api/motors/rh-cargos/status${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    },
    null
  );
}
