import React, { useEffect, useState } from 'react';
import { AlertTriangle, RotateCcw, ShieldAlert } from 'lucide-react';
import {
  getMotorHealthRegistry,
  recordMotorExecution,
  safeMotorCall,
  safeMotorCallSync,
  UrutauMotorName
} from '../shared/motorRuntime';
import { selectIsolatedEscalaData } from './escala';
import { selectIsolatedReservasData } from './reservas';
import { selectIsolatedCaixaData } from './caixa';
import { selectIsolatedPdvData } from './pdv';
import { selectIsolatedRhCargosData } from './rh-cargos';
import { selectIsolatedWhatsAppIaData } from './whatsapp-ia';
import { selectIsolatedGovernancaData } from './governanca';

export {
  getMotorHealthRegistry,
  recordMotorExecution,
  safeMotorCall,
  safeMotorCallSync,
  selectIsolatedEscalaData,
  selectIsolatedReservasData,
  selectIsolatedCaixaData,
  selectIsolatedPdvData,
  selectIsolatedRhCargosData,
  selectIsolatedWhatsAppIaData,
  selectIsolatedGovernancaData
};

export interface ModuleIntegrityBoundaryProps {
  motorName: UrutauMotorName;
  moduleTitle?: string;
  onRetry?: () => void;
  children: React.ReactNode;
}

interface ModuleIntegrityBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ModuleIntegrityBoundary extends React.Component<
  ModuleIntegrityBoundaryProps,
  ModuleIntegrityBoundaryState
> {
  constructor(props: ModuleIntegrityBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: ''
    };
  }

  static getDerivedStateFromError(error: Error): ModuleIntegrityBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Excecao isolada capturada no motor.'
    };
  }

  componentDidCatch(error: Error): void {
    recordMotorExecution(
      this.props.motorName,
      false,
      error?.message || 'Erro de renderizacao isolado no motor'
    );
  }

  componentDidUpdate(prevProps: ModuleIntegrityBoundaryProps): void {
    if (prevProps.motorName !== this.props.motorName && this.state.hasError) {
      this.setState({ hasError: false, errorMessage: '' });
    }
  }

  handleResetError = (): void => {
    recordMotorExecution(this.props.motorName, true);
    this.setState({ hasError: false, errorMessage: '' });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-xl bg-[#112229] border border-amber-500/40 text-slate-100 space-y-3 shadow-xl">
          <div className="flex items-center gap-2.5 text-amber-400 font-bold text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>
              Isolamento de Falha Ativo • Motor [{this.props.moduleTitle || this.props.motorName}]
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Este domínio encontrou uma condição inesperada e foi isolado com segurança para proteger os demais módulos em operação (PDV, Caixa, Escalas e Reservas continuam 100% ativos).
          </p>
          {this.state.errorMessage && (
            <div className="p-2.5 rounded-lg bg-[#081115] border border-white/10 font-mono text-[11px] text-amber-300">
              Detalhe técnico: {this.state.errorMessage}
            </div>
          )}
          <div className="pt-1">
            <button
              type="button"
              onClick={this.handleResetError}
              className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Recarregar Motor Isolado</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function resolveMotorNameForTab(tabId: string): UrutauMotorName {
  switch (tabId) {
    case 'escalas':
    case 'agenda':
    case 'checklists':
      return 'escala';
    case 'reservas':
      return 'reservas';
    case 'caixa':
    case 'rateio':
    case 'estoque':
    case 'compras':
    case 'cmv':
      return 'caixa';
    case 'pdv':
      return 'pdv';
    case 'cadastros':
    case 'cargos':
    case 'equipe':
    case 'selecao':
    case 'rh':
    case 'empresas':
    case 'freelancers':
    case 'unidades':
    case 'setores':
      return 'rh-cargos';
    case 'chat':
    case 'notificacoes':
      return 'whatsapp-ia';
    default:
      return 'governanca';
  }
}

export function buildFaultIsolatedErpData(rawErpData: any, activeMotor?: UrutauMotorName): any {
  return safeMotorCallSync(
    activeMotor || 'governanca',
    () => {
      const base = rawErpData && typeof rawErpData === 'object' ? rawErpData : {};
      const escala = selectIsolatedEscalaData(base);
      const reservas = selectIsolatedReservasData(base);
      const caixa = selectIsolatedCaixaData(base);
      const pdv = selectIsolatedPdvData(base);
      const rh = selectIsolatedRhCargosData(base);
      const wpp = selectIsolatedWhatsAppIaData(base);
      const gov = selectIsolatedGovernancaData(base);

      return {
        ...base,
        empresas: rh.empresas,
        freelancers: rh.freelancers,
        unidades: rh.unidades,
        setores: rh.setores,
        usuarios: rh.usuarios,
        cargos: rh.cargos,
        cadastrosPessoas: rh.cadastrosPessoas,
        selecao: rh.selecao,
        rhRegistros: rh.rhRegistros,
        escalaFixa: escala.escalaFixa,
        movimentosEscala: escala.movimentosEscala,
        reservas: reservas.reservas,
        caixa: caixa.caixa,
        categoriasFechamentoCaixa: caixa.categoriasFechamentoCaixa,
        fechamentosCaixaDiarios: caixa.fechamentosCaixaDiarios,
        rateiosHistorico: caixa.rateiosHistorico,
        pdvProdutos: pdv.pdvProdutos,
        pdvComandas: pdv.pdvComandas,
        pdvImpressoras: pdv.pdvImpressoras,
        pdvFilaImpressao: pdv.pdvFilaImpressao,
        instanciasChat: wpp.instanciasChat,
        mensagensChat: wpp.mensagensChat,
        mensagensRapidas: wpp.mensagensRapidas,
        notificacoes: wpp.notificacoes,
        auditLogs: gov.auditLogs,
        backupsHorarios: gov.backupsHorarios,
        filaAprovacoes: gov.filaAprovacoes,
        registrosArquivados: gov.registrosArquivados,
        configs: gov.configs,
        checklists: Array.isArray(base.checklists) ? base.checklists : [],
        agenda: Array.isArray(base.agenda) ? base.agenda : [],
        portais: Array.isArray(base.portais) ? base.portais : [],
        estoque: Array.isArray(base.estoque) ? base.estoque : [],
        cmv: Array.isArray(base.cmv) ? base.cmv : []
      };
    },
    rawErpData || {}
  ).data;
}

export const StagingEnvironmentTopBanner: React.FC<{
  onAfterReset?: () => Promise<void> | void;
}> = ({ onAfterReset }) => {
  const [isStaging, setIsStaging] = useState<boolean>(() => {
    const viteEnv = String((import.meta as any).env?.VITE_APP_ENV || '').trim().toLowerCase();
    return viteEnv === 'staging';
  });
  const [resetting, setResetting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/system/staging/status')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.ok && Boolean(j.isStaging)) {
          setIsStaging(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isStaging) return null;

  const handleResetStaging = async () => {
    setResetting(true);
    setFeedback('');
    const res = await safeMotorCall(
      'governanca',
      async () => {
        const resp = await fetch('/api/system/staging/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const json = await resp.json();
        if (!resp.ok || !json.ok) {
          throw new Error(json.erro || 'Falha ao restaurar dados originais.');
        }
        return json;
      },
      null
    );

    setResetting(false);
    if (res.degraded || !res.data) {
      setFeedback(res.error || 'Erro ao restaurar espelho.');
      return;
    }

    setFeedback('Banco espelhado restaurado com sucesso!');
    if (onAfterReset) {
      await onAfterReset();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="w-full bg-amber-500/20 border-b border-amber-400/50 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-200 z-[120]">
      <div className="flex items-center gap-2 font-mono font-bold">
        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
        <span>AMBIENTE DE TESTES (BANCO ESPELHADO)</span>
        <span className="hidden sm:inline text-[11px] text-amber-300/80 font-normal">
          • Disparos externos de WhatsApp e Webhooks bloqueados em Sandbox
        </span>
        {feedback && (
          <span className="px-2 py-0.5 rounded bg-emerald-500/25 border border-emerald-400/40 text-emerald-200 text-[11px]">
            {feedback}
          </span>
        )}
      </div>

      <button
        type="button"
        disabled={resetting}
        onClick={handleResetStaging}
        className="px-3 py-1 rounded-md bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-black text-xs inline-flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
      >
        <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
        <span>{resetting ? 'Restaurando Espelho...' : 'Restaurar Dados Originais'}</span>
      </button>
    </div>
  );
};
