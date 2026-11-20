import { safeMotorCall, safeMotorCallSync } from '../../shared/motorRuntime';

export interface IsolatedWhatsAppIaData {
  instanciasChat: any[];
  mensagensChat: any[];
  mensagensRapidas: any[];
  notificacoes: any[];
  degraded: boolean;
}

export function selectIsolatedWhatsAppIaData(rawErpData: any): IsolatedWhatsAppIaData {
  const instancias = safeMotorCallSync<any[]>(
    'whatsapp-ia',
    () => (Array.isArray(rawErpData?.instanciasChat) ? rawErpData.instanciasChat : []),
    []
  );
  const mensagens = safeMotorCallSync<any[]>(
    'whatsapp-ia',
    () => (Array.isArray(rawErpData?.mensagensChat) ? rawErpData.mensagensChat : []),
    []
  );
  const rapidas = safeMotorCallSync<any[]>(
    'whatsapp-ia',
    () => (Array.isArray(rawErpData?.mensagensRapidas) ? rawErpData.mensagensRapidas : []),
    []
  );
  const notificacoes = safeMotorCallSync<any[]>(
    'whatsapp-ia',
    () => (Array.isArray(rawErpData?.notificacoes) ? rawErpData.notificacoes : []),
    []
  );

  return {
    instanciasChat: instancias.data ?? [],
    mensagensChat: mensagens.data ?? [],
    mensagensRapidas: rapidas.data ?? [],
    notificacoes: notificacoes.data ?? [],
    degraded:
      instancias.degraded ||
      mensagens.degraded ||
      rapidas.degraded ||
      notificacoes.degraded
  };
}

export async function fetchWhatsAppIaMotorStatus() {
  return safeMotorCall(
    'whatsapp-ia',
    async () => {
      const res = await fetch('/api/motors/whatsapp-ia/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    },
    null
  );
}
