import { safeMotorCall, safeMotorCallSync } from '../../shared/motorRuntime';

export interface IsolatedGovernancaData {
  auditLogs: any[];
  backupsHorarios: any[];
  filaAprovacoes: any[];
  registrosArquivados: any[];
  configs: any[];
  degraded: boolean;
}

export function selectIsolatedGovernancaData(rawErpData: any): IsolatedGovernancaData {
  const auditLogs = safeMotorCallSync<any[]>(
    'governanca',
    () => (Array.isArray(rawErpData?.auditLogs) ? rawErpData.auditLogs : []),
    []
  );
  const backups = safeMotorCallSync<any[]>(
    'governanca',
    () => (Array.isArray(rawErpData?.backupsHorarios) ? rawErpData.backupsHorarios : []),
    []
  );
  const fila = safeMotorCallSync<any[]>(
    'governanca',
    () => (Array.isArray(rawErpData?.filaAprovacoes) ? rawErpData.filaAprovacoes : []),
    []
  );
  const arquivados = safeMotorCallSync<any[]>(
    'governanca',
    () => (Array.isArray(rawErpData?.registrosArquivados) ? rawErpData.registrosArquivados : []),
    []
  );
  const configs = safeMotorCallSync<any[]>(
    'governanca',
    () => (Array.isArray(rawErpData?.configs) ? rawErpData.configs : []),
    []
  );

  return {
    auditLogs: auditLogs.data ?? [],
    backupsHorarios: backups.data ?? [],
    filaAprovacoes: fila.data ?? [],
    registrosArquivados: arquivados.data ?? [],
    configs: configs.data ?? [],
    degraded:
      auditLogs.degraded ||
      backups.degraded ||
      fila.degraded ||
      arquivados.degraded ||
      configs.degraded
  };
}

export async function fetchGovernancaMotorStatus() {
  return safeMotorCall(
    'governanca',
    async () => {
      const res = await fetch('/api/motors/governanca/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    },
    null
  );
}
