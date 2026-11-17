import React from 'react';
import {
  RotateCcw,
  Power,
  CheckCircle2,
  XCircle,
  Zap,
  ArrowRight
} from 'lucide-react';
import { DEFAULT_CATEGORIES, DEFAULT_TAB_META, TabId } from '../types/erp';
import { TabIconSVG, UrutauEmblemSVG } from './UrutauShared';

export interface ModularSystemConfig {
  disabledModules: TabId[];
  simulatedCrashModules: TabId[];
  crashHistory: {
    id: string;
    tabId: TabId;
    label: string;
    errorMsg: string;
    timestamp: string;
    recovered: boolean;
  }[];
}

export const DEFAULT_MODULAR_SYSTEM_CONFIG: ModularSystemConfig = {
  disabledModules: [],
  simulatedCrashModules: [],
  crashHistory: []
};

interface ModuleErrorBoundaryProps {
  tabId: TabId;
  tabLabel: string;
  isDisabled?: boolean;
  isSimulatingCrash?: boolean;
  isSuperAdmin?: boolean;
  onRecoverModule: (tabId: TabId) => void;
  onToggleDisableModule: (tabId: TabId) => void;
  onNavigateSafeModule: (tabId: TabId) => void;
  onRecordCrash?: (tabId: TabId, label: string, errorMsg: string) => void;
  children: React.ReactNode;
}

interface ModuleErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  errorStack?: string;
}

export class ModuleErrorBoundary extends React.Component<
  ModuleErrorBoundaryProps,
  ModuleErrorBoundaryState
> {
  constructor(props: ModuleErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      errorStack: undefined
    };
  }

  static getDerivedStateFromError(error: Error): ModuleErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Erro isolado no módulo.',
      errorStack: error?.stack
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (this.props.onRecordCrash) {
      this.props.onRecordCrash(
        this.props.tabId,
        this.props.tabLabel,
        error?.message || String(errorInfo?.componentStack || 'Erro no módulo')
      );
    }
  }

  componentDidUpdate(prevProps: ModuleErrorBoundaryProps) {
    if (prevProps.tabId !== this.props.tabId && this.state.hasError) {
      this.setState({ hasError: false, errorMessage: '', errorStack: undefined });
    }
    if (prevProps.isSimulatingCrash && !this.props.isSimulatingCrash && this.state.hasError) {
      this.setState({ hasError: false, errorMessage: '', errorStack: undefined });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: '', errorStack: undefined });
    this.props.onRecoverModule(this.props.tabId);
  };

  render() {
    const {
      tabId,
      tabLabel,
      isDisabled,
      isSimulatingCrash,
      isSuperAdmin,
      onToggleDisableModule,
      onNavigateSafeModule,
      children
    } = this.props;

    if (isDisabled && tabId !== 'modulos') {
      return (
        <div className="max-w-xl mx-auto my-8 rounded-xl bg-[#0B1914] border border-white/8 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <UrutauEmblemSVG className="w-10 h-10 shrink-0" postura="camuflagem" />
            <div>
              <h2 className="text-sm font-bold text-white">
                {tabLabel} desativado
              </h2>
              <p className="text-xs text-slate-400">
                Os demais módulos continuam funcionando normalmente.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/6">
            <div className="flex items-center gap-1.5">
              {(['rateio', 'caixa', 'checklists'] as TabId[])
                .filter((t) => t !== tabId)
                .map((safeTab) => (
                  <button
                    key={safeTab}
                    type="button"
                    data-no-confirm="true"
                    onClick={() => onNavigateSafeModule(safeTab)}
                    className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-200 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>{DEFAULT_TAB_META[safeTab]?.label || safeTab}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                ))}
            </div>

            {isSuperAdmin && (
              <button
                type="button"
                data-no-confirm="true"
                onClick={() => onToggleDisableModule(tabId)}
                className="px-3 py-1.5 rounded-lg bg-[#10B981] text-[#05100C] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Power className="w-3.5 h-3.5" />
                <span>Ativar {tabLabel}</span>
              </button>
            )}
          </div>
        </div>
      );
    }

    if (this.state.hasError || isSimulatingCrash) {
      const displayErr = isSimulatingCrash
        ? `Queda isolada em "${tabLabel}". O restante do sistema segue ativo.`
        : this.state.errorMessage;

      return (
        <div className="max-w-xl mx-auto my-8 rounded-xl bg-[#0B1914] border border-rose-500/30 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <UrutauEmblemSVG className="w-10 h-10 shrink-0" postura="comunicacao" />
            <div>
              <h2 className="text-sm font-bold text-white">
                Falha isolada em {tabLabel}
              </h2>
              <p className="text-xs text-slate-400">{displayErr}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/6">
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-no-confirm="true"
                onClick={this.handleReset}
                className="px-3 py-1.5 rounded-lg bg-[#10B981] text-[#05100C] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reiniciar Módulo</span>
              </button>

              {isSuperAdmin && (
                <button
                  type="button"
                  data-no-confirm="true"
                  onClick={() => {
                    this.handleReset();
                    onToggleDisableModule(tabId);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>Desativar</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {(['rateio', 'caixa', 'checklists'] as TabId[])
                .filter((t) => t !== tabId)
                .map((safeTab) => (
                  <button
                    key={safeTab}
                    type="button"
                    data-no-confirm="true"
                    onClick={() => onNavigateSafeModule(safeTab)}
                    className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-200 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>{DEFAULT_TAB_META[safeTab]?.label || safeTab}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                ))}
            </div>
          </div>
        </div>
      );
    }

    return <>{children}</>;
  }
}

export function ModularSystemManagerTab({
  modularConfig,
  onUpdateModularConfig,
  onSelectTab
}: {
  modularConfig: ModularSystemConfig;
  onUpdateModularConfig: (next: ModularSystemConfig) => void;
  onSelectTab: (tabId: TabId) => void;
}) {
  const allModules = React.useMemo(() => {
    const list: {
      tabId: TabId;
      label: string;
      categoriaTitulo: string;
      iconName?: string;
      iconColor?: string;
    }[] = [];

    DEFAULT_CATEGORIES.forEach((cat) => {
      cat.abas.forEach((tId) => {
        const meta = DEFAULT_TAB_META[tId];
        if (!meta) return;
        list.push({
          tabId: tId,
          label: meta.label,
          categoriaTitulo: cat.titulo,
          iconName: meta.iconName,
          iconColor: meta.iconColor
        });
      });
    });
    return list;
  }, []);

  const activeCount = allModules.filter(
    (m) =>
      !modularConfig.disabledModules.includes(m.tabId) &&
      !modularConfig.simulatedCrashModules.includes(m.tabId)
  ).length;

  const toggleModuleEnabled = (tabId: TabId) => {
    if (tabId === 'modulos') return;
    const isCurrentlyDisabled = modularConfig.disabledModules.includes(tabId);
    const nextDisabled = isCurrentlyDisabled
      ? modularConfig.disabledModules.filter((id) => id !== tabId)
      : [...modularConfig.disabledModules, tabId];
    const nextCrashed = modularConfig.simulatedCrashModules.filter((id) => id !== tabId);

    onUpdateModularConfig({
      ...modularConfig,
      disabledModules: nextDisabled,
      simulatedCrashModules: nextCrashed
    });
  };

  const triggerSimulatedCrash = (tabId: TabId, label: string) => {
    const alreadyCrashed = modularConfig.simulatedCrashModules.includes(tabId);
    if (alreadyCrashed) {
      onUpdateModularConfig({
        ...modularConfig,
        simulatedCrashModules: modularConfig.simulatedCrashModules.filter((id) => id !== tabId)
      });
      return;
    }
    const nextHistory = [
      {
        id: `crash_${Date.now()}`,
        tabId,
        label,
        errorMsg: 'Falha isolada com sucesso.',
        timestamp: new Date().toLocaleTimeString('pt-BR'),
        recovered: false
      },
      ...(modularConfig.crashHistory || []).slice(0, 9)
    ];
    onUpdateModularConfig({
      ...modularConfig,
      simulatedCrashModules: [...modularConfig.simulatedCrashModules, tabId],
      crashHistory: nextHistory
    });
  };

  const restoreAllModules = () => {
    onUpdateModularConfig({
      disabledModules: [],
      simulatedCrashModules: [],
      crashHistory: (modularConfig.crashHistory || []).map((h) => ({ ...h, recovered: true }))
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/6">
        <div>
          <h2 className="text-base font-bold text-white">Módulos do Sistema</h2>
          <p className="text-xs text-slate-400">
            Isolamento individual por função ({activeCount}/{allModules.length} ativos)
          </p>
        </div>

        {(modularConfig.disabledModules.length > 0 ||
          modularConfig.simulatedCrashModules.length > 0) && (
          <button
            type="button"
            data-no-confirm="true"
            onClick={restoreAllModules}
            className="px-3 py-1.5 rounded-lg bg-[#10B981] text-[#05100C] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restaurar Todos</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {allModules.map((mod) => {
          const isDisabled = modularConfig.disabledModules.includes(mod.tabId);
          const isCrashed = modularConfig.simulatedCrashModules.includes(mod.tabId);

          return (
            <div
              key={mod.tabId}
              className={`rounded-lg p-3 border flex items-center justify-between gap-3 ${
                isCrashed
                  ? 'bg-rose-950/20 border-rose-500/30'
                  : isDisabled
                  ? 'bg-[#0B1914]/60 border-white/6 opacity-70'
                  : 'bg-[#0B1914] border-white/6'
              }`}
            >
              <div
                onClick={() => onSelectTab(mod.tabId)}
                className="flex items-center gap-2.5 min-w-0 cursor-pointer"
              >
                <TabIconSVG
                  tab={mod.tabId}
                  iconName={mod.iconName}
                  iconColor={mod.iconColor}
                  className="w-4 h-4 shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white truncate">{mod.label}</div>
                  <div className="text-[10px] text-slate-400 truncate">{mod.categoriaTitulo}</div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {mod.tabId !== 'modulos' && (
                  <>
                    <button
                      type="button"
                      data-no-confirm="true"
                      onClick={() => toggleModuleEnabled(mod.tabId)}
                      className={`px-2 py-1 rounded text-[10px] font-medium cursor-pointer ${
                        isDisabled
                          ? 'bg-[#10B981] text-[#05100C] font-semibold'
                          : 'bg-white/5 hover:bg-white/10 text-slate-300'
                      }`}
                    >
                      {isDisabled ? 'Ativar' : 'Pausar'}
                    </button>

                    <button
                      type="button"
                      data-no-confirm="true"
                      onClick={() => {
                        triggerSimulatedCrash(mod.tabId, mod.label);
                        if (!isCrashed) onSelectTab(mod.tabId);
                      }}
                      className={`px-2 py-1 rounded text-[10px] font-medium cursor-pointer ${
                        isCrashed
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300'
                      }`}
                      title="Testar isolamento de queda deste módulo"
                    >
                      <Zap className="w-3 h-3 inline mr-0.5" />
                      {isCrashed ? 'Recuperar' : 'Testar'}
                    </button>
                  </>
                )}

                {mod.tabId === 'modulos' && (
                  <span className="text-[10px] font-mono text-[#10B981] inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Núcleo
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
