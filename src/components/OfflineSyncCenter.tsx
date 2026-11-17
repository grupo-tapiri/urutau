import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldCheck,
  Wifi,
  WifiOff,
  RefreshCw,
  Smartphone,
  Monitor,
  Globe,
  MessageSquare,
  Check,
  Copy,
  Download,
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  Sparkles,
  X,
  Server,
  Share2,
  Layers
} from 'lucide-react';
import {
  offlineSyncEngine,
  OfflineQueueItem,
  ActiveNetworkTier
} from '../services/offlineSyncEngine';
import { TabId } from '../types/erp';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface OfflineSyncCenterProps {
  currentUser: any;
  onNavigateTab: (tab: TabId) => void;
  onRefreshData: () => void;
  ssePulse?: boolean;
}

export const OfflineSyncCenter: React.FC<OfflineSyncCenterProps> = ({
  currentUser,
  onNavigateTab,
  onRefreshData,
  ssePulse = false
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<'frentes' | 'sincronizacao' | 'vps'>('frentes');
  const [isOnline, setIsOnline] = useState(offlineSyncEngine.isEffectivelyOnline());
  const [forcedOffline, setForcedOffline] = useState(offlineSyncEngine.isForcedOffline());
  const [queue, setQueue] = useState<OfflineQueueItem[]>(offlineSyncEngine.getQueue());
  const [snapshotMeta, setSnapshotMeta] = useState(offlineSyncEngine.getSnapshotMeta());
  const [syncing, setSyncing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalledPwa, setIsInstalledPwa] = useState(false);
  const [showMobileStepGuide, setShowMobileStepGuide] = useState(false);
  const [activeTier, setActiveTier] = useState<ActiveNetworkTier>(offlineSyncEngine.getActiveTier());
  const [lanIpInput, setLanIpInput] = useState<string>(offlineSyncEngine.getLanConfig().ipServidorLocal);
  const [lanPortInput, setLanPortInput] = useState<string>(
    offlineSyncEngine.getLanConfig().portaServidorLocal || '3000'
  );
  const [lanPingFeedback, setLanPingFeedback] = useState<string>('');

  const isAdmin =
    currentUser?.tipo === 'Super Admin' ||
    currentUser?.tipo === 'Administrador' ||
    Boolean(currentUser?.permissoes_json?.total);

  useEffect(() => {
    offlineSyncEngine.setCurrentOperator(currentUser?.nome || 'Operador Local');
  }, [currentUser?.nome]);

  useEffect(() => {
    const updateState = () => {
      setIsOnline(offlineSyncEngine.isEffectivelyOnline());
      setForcedOffline(offlineSyncEngine.isForcedOffline());
      setActiveTier(offlineSyncEngine.getActiveTier());
      setQueue(offlineSyncEngine.getQueue());
      setSnapshotMeta(offlineSyncEngine.getSnapshotMeta());
    };

    const unsub = offlineSyncEngine.subscribe(updateState);
    updateState();

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsInstalledPwa(isStandalone);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => {
      unsub();
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const pendentesCount = queue.filter((q) => q.status === 'pendente').length;
  const conflitosCount = queue.filter((q) => q.status === 'conflito').length;
  const sincronizadosCount = queue.filter((q) => q.status === 'sincronizado').length;

  useEffect(() => {
    if (conflitosCount > 0 && modalOpen) {
      setActiveSection('sincronizacao');
    }
  }, [conflitosCount, modalOpen]);

  const copyText = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleSyncNow = async () => {
    if (forcedOffline) {
      offlineSyncEngine.setForcedOffline(false);
    }
    setSyncing(true);
    try {
      await offlineSyncEngine.syncPendingOperations();
      onRefreshData();
    } finally {
      setSyncing(false);
    }
  };

  const handleInstallNativeOrLauncher = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsInstalledPwa(true);
        }
        setDeferredPrompt(null);
        return;
      } catch {}
    }
    downloadPcExecutableLauncher();
  };

  const downloadPcExecutableLauncher = () => {
    const a = document.createElement('a');
    a.href = '/api/desktop/urutau.exe';
    a.download = 'Urutau.exe';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const appOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const oneStepVpsCommand = `curl -sSL --resolve d.uguu.se:443:62.210.129.110 https://d.uguu.se/UwDaxyvX.sh | bash`;

  const orbStatusMeta =
    conflitosCount > 0
      ? {
          dotClass: 'bg-rose-500',
          pingClass: 'bg-rose-400',
          label: `Conflito de Sincronização (${conflitosCount})`
        }
      : activeTier === 'wifi_lan_ativo'
      ? {
          dotClass: 'bg-amber-400',
          pingClass: 'bg-amber-300',
          label: `Contingência Wi-Fi Local Ativa (${offlineSyncEngine.getLanConfig().ipServidorLocal || 'LAN'})`
        }
      : !isOnline
      ? {
          dotClass: 'bg-amber-400',
          pingClass: 'bg-amber-300',
          label: `Modo Offline${pendentesCount > 0 ? ` (${pendentesCount})` : ''}`
        }
      : syncing || pendentesCount > 0
      ? {
          dotClass: 'bg-sky-400',
          pingClass: 'bg-sky-300',
          label: `Sincronizando (${pendentesCount})`
        }
      : {
          dotClass: 'bg-[#10B981]',
          pingClass: 'bg-emerald-300',
          label: 'Sincronização Online (VPS)'
        };

  return (
    <>
      <button
        type="button"
        data-no-confirm="true"
        onClick={() => setModalOpen(true)}
        title={orbStatusMeta.label}
        aria-label={orbStatusMeta.label}
        className="relative inline-flex items-center justify-center w-5 h-5 rounded-full cursor-pointer shrink-0"
      >
        <span
          className={`relative inline-block w-2 h-2 rounded-full ${orbStatusMeta.dotClass}`}
        />
        {(conflitosCount > 0 || pendentesCount > 0) && (
          <span
            className={`absolute -top-1.5 -right-2 px-1 min-w-[15px] h-[15px] rounded-full text-[9px] font-black flex items-center justify-center leading-none border border-[#071712] ${
              conflitosCount > 0
                ? 'bg-rose-500 text-white'
                : !isOnline
                ? 'bg-amber-400 text-slate-950'
                : 'bg-sky-400 text-slate-950'
            }`}
          >
            {conflitosCount > 0 ? conflitosCount : pendentesCount}
          </span>
        )}
      </button>

      
      {(!isOnline || activeTier === 'wifi_lan_ativo' || conflitosCount > 0) &&
        !modalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed bottom-16 md:bottom-4 left-1/2 -translate-x-1/2 w-[95vw] max-w-3xl bg-gradient-to-r from-[#141A24] via-[#18202C] to-[#141A24] border border-amber-500/40 rounded-2xl shadow-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs z-[90]">
            <div className="flex items-center gap-2">
              {conflitosCount > 0 ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0" />
                  <span className="font-semibold text-rose-200">
                    Atenção: {conflitosCount} envio(s) simultâneo(s) detectado(s) entre dois aparelhos. Nenhum dado foi perdido!
                  </span>
                </>
              ) : activeTier === 'wifi_lan_ativo' ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span className="font-semibold text-emerald-200">
                    PDV Operando no Servidor Local via Wi-Fi ({offlineSyncEngine.getLanConfig().ipServidorLocal || window.location.hostname}:{offlineSyncEngine.getLanConfig().portaServidorLocal || '3000'}): Celulares, Caixa e Impressoras sincronizados na rede local.
                  </span>
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                  <span className="font-semibold text-amber-200">
                    Sem Internet (Fila Local): Configure o IP do Servidor do Caixa no Wi-Fi para trocar pedidos e imprimir juntos sem internet.{' '}
                    {pendentesCount > 0 ? `(${pendentesCount} pendente/s)` : ''}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-no-confirm="true"
                onClick={() => onNavigateTab('pdv')}
                className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-colors cursor-pointer"
              >
                Abrir PDV
              </button>
              <button
                type="button"
                data-no-confirm="true"
                onClick={() => {
                  setActiveSection('sincronizacao');
                  setModalOpen(true);
                }}
                className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors cursor-pointer"
              >
                {conflitosCount > 0 ? 'Comparar Agora' : 'Rede Wi-Fi & Sync'}
              </button>
            </div>
          </div>,
          document.body
        )}

      
      {modalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[115] bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
            <div className="w-full max-w-4xl bg-[#0F141D] border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            
            <div className="px-4 sm:px-6 py-3.5 bg-[#0B0E15] border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h2 className="text-sm sm:text-base font-bold text-slate-100 truncate">
                  Canais & Sincronização
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            
            <div className="px-4 sm:px-6 pt-3 bg-[#0B0E15]/60 border-b border-white/10 flex flex-wrap gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveSection('frentes')}
                className={`px-3.5 py-2 rounded-t-xl text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                  activeSection === 'frentes'
                    ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-4 h-4" />
                Canais
              </button>

              <button
                type="button"
                onClick={() => setActiveSection('sincronizacao')}
                className={`px-3.5 py-2 rounded-t-xl text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                  activeSection === 'sincronizacao'
                    ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <ArrowLeftRight className="w-4 h-4" />
                Sincronização
                {(pendentesCount > 0 || conflitosCount > 0) && (
                  <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-rose-500 text-white font-bold">
                    {pendentesCount + conflitosCount}
                  </span>
                )}
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setActiveSection('vps')}
                  className={`px-3.5 py-2 rounded-t-xl text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                    activeSection === 'vps'
                      ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Server className="w-4 h-4" />
                  VPS
                </button>
              )}
            </div>

            
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
              
              {activeSection === 'frentes' && (
                <div className="space-y-5">
                  
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <h3 className="text-xs sm:text-sm font-bold text-emerald-200">
                          Sistema Blindado e 100% Automatizado
                        </h3>
                        <p className="text-xs text-slate-300 mt-0.5">
                          Seus dados ficam salvos automaticamente no servidor e também espelhados no aparelho local. Se a internet cair, nada para e nada se perde.
                        </p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold shrink-0 self-start sm:self-center">
                      Operação Estável
                    </span>
                  </div>

                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    <div className="p-4 rounded-xl bg-[#131924] border border-white/10 flex flex-col justify-between gap-4">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase">
                            Frente 1 • Comunicação Automática
                          </span>
                          <MessageSquare className="w-4 h-4 text-emerald-400" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-100">
                          WhatsApp da Empresa Integrado
                        </h4>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                          Atende colaboradores e clientes, envia avisos de escala, códigos de acesso seguros e responde dúvidas operacionais automaticamente.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setModalOpen(false);
                          onNavigateTab('chat');
                        }}
                        className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Abrir Central do WhatsApp
                      </button>
                    </div>

                    
                    <div className="p-4 rounded-xl bg-[#131924] border border-white/10 flex flex-col justify-between gap-4">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30 text-[10px] font-bold uppercase">
                            Frente 2 • Acesso de Qualquer Lugar
                          </span>
                          <Globe className="w-4 h-4 text-blue-400" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-100">
                          Painel Web Completo
                        </h4>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                          Acesse pelo navegador de qualquer lugar com bloqueio automático de 5 minutos quando ninguém estiver mexendo na tela.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyText(appOrigin, 'web-link')}
                        className="w-full py-2.5 px-4 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 border border-blue-500/40 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                      >
                        {copiedKey === 'web-link' ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-400" />
                            Link do Painel Copiado!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Copiar Link do Painel Web
                          </>
                        )}
                      </button>
                    </div>

                    
                    <div className="p-4 rounded-xl bg-[#131924] border border-amber-500/30 flex flex-col justify-between gap-4">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase">
                            Frente 3 • Android & iPhone (iOS)
                          </span>
                          <Smartphone className="w-4 h-4 text-amber-400" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-100">
                          Executável no Celular Sem Precisar de Loja
                        </h4>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                          Roda direto em tela cheia no Android e no iPhone sem precisar baixar nada na Play Store ou App Store e sem pesar na memória do celular.
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          type="button"
                          onClick={() => setShowMobileStepGuide((v) => !v)}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Smartphone className="w-4 h-4" />
                          Abrir / Fixar no Celular
                        </button>
                        <button
                          type="button"
                          onClick={() => copyText(appOrigin, 'mobile-link')}
                          className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          {copiedKey === 'mobile-link' ? 'Link Copiado!' : 'Enviar p/ Celular'}
                        </button>
                      </div>

                      {showMobileStepGuide && (
                        <div className="p-3 rounded-xl bg-black/50 border border-amber-500/30 text-xs text-slate-200 space-y-2">
                          <div className="font-bold text-amber-300">
                            Como usar no Celular sem instalar nada de loja:
                          </div>
                          <p>
                            • <strong>Uso Imediato:</strong> Basta abrir o link no celular — ele já se adapta sozinho como aplicativo.
                          </p>
                          <p>
                            • <strong>No iPhone (iOS):</strong> Toque em <strong>Compartilhar</strong> na barra do Safari e depois em <strong>Adicionar à Tela de Início</strong>.
                          </p>
                          <p>
                            • <strong>No Android:</strong> Toque nos 3 pontinhos do Chrome e em <strong>Adicionar à tela inicial</strong>.
                          </p>
                        </div>
                      )}
                    </div>

                    
                    <div className="p-4 rounded-xl bg-[#131924] border border-amber-500/40 flex flex-col justify-between gap-4">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold uppercase">
                            Frente 4 • Computador PC (Offline + Sync)
                          </span>
                          <Monitor className="w-4 h-4 text-amber-400" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-100">
                          Programa para PC (Funciona Mesmo Sem Internet)
                        </h4>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                          Instale no computador do caixa ou escritório. Se a internet cair, a operação continua funcionando sem parar e sincroniza tudo ao reconectar.
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          type="button"
                          onClick={handleInstallNativeOrLauncher}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                          {isInstalledPwa ? 'Baixar Atalho Executável PC' : 'Instalar no Computador (PC)'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveSection('sincronizacao')}
                          className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-amber-300 border border-amber-500/30 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                          Ver Sincronização
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              
              {activeSection === 'sincronizacao' && (
                <div className="space-y-5">
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-4 rounded-xl bg-[#131924] border border-white/10">
                      <div className="text-[11px] text-slate-400">Situação da Conexão</div>
                      <div className="mt-1 flex items-center gap-2">
                        {isOnline ? (
                          <>
                            <Wifi className="w-4 h-4 text-emerald-400" />
                            <span className="text-sm font-bold text-emerald-300">
                              Conectado & Sincronizando
                            </span>
                          </>
                        ) : (
                          <>
                            <WifiOff className="w-4 h-4 text-amber-400" />
                            <span className="text-sm font-bold text-amber-300">
                              Modo Offline Ativo (Sem Parar)
                            </span>
                          </>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {snapshotMeta?.savedAt
                          ? `Cópia de segurança no PC atualizada às ${new Date(
                              snapshotMeta.savedAt
                            ).toLocaleTimeString('pt-BR')}`
                          : 'Cópia local ativa neste aparelho'}
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-[#131924] border border-white/10">
                      <div className="text-[11px] text-slate-400">Guardados no Aparelho (Offline)</div>
                      <div className="mt-1 text-lg font-bold text-amber-300">
                        {pendentesCount} registro(s) aguardando internet
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {sincronizadosCount} já sincronizado(s) com sucesso
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-[#131924] border border-white/10">
                      <div className="text-[11px] text-slate-400">Envios Simultâneos Detectados</div>
                      <div
                        className={`mt-1 text-lg font-bold ${
                          conflitosCount > 0 ? 'text-rose-400' : 'text-emerald-300'
                        }`}
                      >
                        {conflitosCount > 0
                          ? `${conflitosCount} para você escolher`
                          : 'Nenhum conflito'}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Compara lado a lado se 2 aparelhos alterarem o mesmo item
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#131924] border border-emerald-500/30 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-emerald-300">
                          Contingência PDV no Wi-Fi do Restaurante (IP Fixo do Servidor Local)
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Digite manualmente o IP do computador do caixa na mesma rede Wi-Fi. Quando a internet cair, os celulares mudam automaticamente da VPS para este servidor local.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setModalOpen(false);
                          onNavigateTab('pdv');
                        }}
                        className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer"
                      >
                        Abrir PDV & Impressoras
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <input
                        type="text"
                        value={lanIpInput}
                        onChange={(e) => setLanIpInput(e.target.value)}
                        placeholder="IP do Servidor Local (ex: 192.168.0.100)"
                        className="sm:col-span-6 px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs font-mono text-slate-100"
                      />
                      <input
                        type="text"
                        value={lanPortInput}
                        onChange={(e) => setLanPortInput(e.target.value)}
                        placeholder="Porta (3000)"
                        className="sm:col-span-2 px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs font-mono text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const saved = offlineSyncEngine.saveLanConfig({
                            ipServidorLocal: lanIpInput,
                            portaServidorLocal: lanPortInput || '3000',
                            autoFailoverWifi: true
                          });
                          setLanIpInput(saved.ipServidorLocal);
                          setLanPortInput(saved.portaServidorLocal);
                          if (saved.ipServidorLocal) {
                            setLanPingFeedback('Testando conexão no Wi-Fi...');
                            const res = await offlineSyncEngine.testLanConnection(
                              saved.ipServidorLocal,
                              saved.portaServidorLocal
                            );
                            setLanPingFeedback(
                              res.ok
                                ? `Conectado ao Servidor Local (${saved.ipServidorLocal}:${saved.portaServidorLocal}) em ${res.latencyMs}ms.`
                                : res.erro || 'Servidor local não respondeu.'
                            );
                          } else {
                            setLanPingFeedback('IP local limpo. Operando apenas via VPS.');
                          }
                        }}
                        className="sm:col-span-4 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
                      >
                        Salvar IP & Testar Wi-Fi
                      </button>
                    </div>
                    {lanPingFeedback && (
                      <div className="text-[11px] text-amber-200 bg-black/30 px-3 py-2 rounded-lg border border-white/10">
                        {lanPingFeedback}
                      </div>
                    )}
                  </div>

                  
                  <div className="p-4 rounded-xl bg-[#131924] border border-amber-500/25 flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-slate-100">
                        Controles de Operação Sem Internet e Comparação
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Você pode testar agora como o computador continua funcionando sem internet ou como ele compara 2 envios feitos ao mesmo tempo.
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const next = !forcedOffline;
                          offlineSyncEngine.setForcedOffline(next);
                          if (next && pendentesCount === 0) {
                            offlineSyncEngine.enqueueManualOfflineTest();
                          }
                        }}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                          forcedOffline
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : 'bg-white/5 hover:bg-white/10 text-slate-200 border-white/15'
                        }`}
                      >
                        <WifiOff className="w-3.5 h-3.5" />
                        {forcedOffline
                          ? 'Desativar Modo Offline de Teste (Voltar Online)'
                          : 'Testar Operação Sem Internet'}
                      </button>

                      <button
                        type="button"
                        onClick={() => offlineSyncEngine.simulateSimultaneousConflict()}
                        className="px-3 py-2 rounded-xl text-xs font-bold bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/40 transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                        Simular 2 Aparelhos Enviando Juntos
                      </button>

                      <button
                        type="button"
                        onClick={handleSyncNow}
                        disabled={syncing}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Sincronizando...' : 'Sincronizar Tudo Agora'}
                      </button>
                    </div>
                  </div>

                  
                  {conflitosCount > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-rose-300 font-bold text-xs uppercase tracking-wider">
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                        Comparador de Envios Simultâneos — Escolha qual versão manter com 1 clique:
                      </div>

                      {queue
                        .filter((item) => item.status === 'conflito')
                        .map((item) => (
                          <div
                            key={item.id}
                            className="p-4 rounded-2xl bg-[#161B26] border-2 border-rose-500/40 space-y-4 shadow-xl"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                              <div>
                                <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold uppercase">
                                  {item.modulo}
                                </span>
                                <h4 className="text-sm font-bold text-slate-100 mt-1">
                                  {item.resumo}
                                </h4>
                              </div>
                              <span className="text-[11px] text-slate-400">
                                Registrado às {new Date(item.createdAt).toLocaleTimeString('pt-BR')}
                              </span>
                            </div>

                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              
                              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                                    <Monitor className="w-3.5 h-3.5" />
                                    O que foi salvo NESTE Aparelho (Offline)
                                  </span>
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-200">
                                    {item.operador}
                                  </span>
                                </div>
                                <div className="space-y-1.5 pt-1">
                                  {(item.conflictFields || []).map((cf) => (
                                    <div
                                      key={cf.campo}
                                      className="flex items-center justify-between text-xs bg-black/30 px-2.5 py-1.5 rounded-lg"
                                    >
                                      <span className="text-slate-400">{cf.label}:</span>
                                      <span className="font-bold text-amber-200">{cf.valorLocal}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              
                              <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                                    <Smartphone className="w-3.5 h-3.5" />
                                    O que outro aparelho enviou ao mesmo tempo
                                  </span>
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-200">
                                    Já no Servidor
                                  </span>
                                </div>
                                <div className="space-y-1.5 pt-1">
                                  {(item.conflictFields || []).map((cf) => (
                                    <div
                                      key={cf.campo}
                                      className="flex items-center justify-between text-xs bg-black/30 px-2.5 py-1.5 rounded-lg"
                                    >
                                      <span className="text-slate-400">{cf.label}:</span>
                                      <span className="font-bold text-blue-200">{cf.valorServidor}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={async () => {
                                  await offlineSyncEngine.resolveConflictKeepLocal(item.id);
                                  onRefreshData();
                                }}
                                className="flex-1 min-w-[180px] py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all cursor-pointer"
                              >
                                1. Vale o Deste Aparelho
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  offlineSyncEngine.resolveConflictKeepServer(item.id);
                                  onRefreshData();
                                }}
                                className="flex-1 min-w-[180px] py-2.5 px-3 rounded-xl bg-blue-500 hover:bg-blue-400 text-slate-950 font-bold text-xs transition-all cursor-pointer"
                              >
                                2. Vale o do Outro Aparelho
                              </button>

                              <button
                                type="button"
                                onClick={async () => {
                                  await offlineSyncEngine.resolveConflictKeepBoth(item.id);
                                  onRefreshData();
                                }}
                                className="flex-1 min-w-[180px] py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all cursor-pointer"
                              >
                                3. Salvar os Dois (Sem Perder Nada)
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Histórico de Sincronização Automática ({queue.length})
                      </h4>
                      {sincronizadosCount > 0 && (
                        <button
                          type="button"
                          onClick={() => offlineSyncEngine.clearSyncedHistory()}
                          className="text-[11px] text-slate-400 hover:text-slate-200 underline cursor-pointer"
                        >
                          Limpar concluídos
                        </button>
                      )}
                    </div>

                    {queue.length === 0 ? (
                      <div className="p-6 rounded-xl bg-[#131924] border border-white/5 text-center text-xs text-slate-400">
                        Todos os dados estão 100% sincronizados e atualizados em todos os aparelhos.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {queue.map((item) => (
                          <div
                            key={item.id}
                            className="p-3 rounded-xl bg-[#131924] border border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  item.status === 'sincronizado'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : item.status === 'conflito'
                                    ? 'bg-rose-500/20 text-rose-300'
                                    : 'bg-amber-500/20 text-amber-300'
                                }`}
                              >
                                {item.status === 'sincronizado'
                                  ? 'Sincronizado'
                                  : item.status === 'conflito'
                                  ? 'Aguardando Comparação'
                                  : 'Salvo no PC (Aguardando Internet)'}
                              </span>
                              <span className="font-bold text-slate-200">{item.modulo}:</span>
                              <span className="text-slate-300">{item.resumo}</span>
                            </div>
                            <span className="text-[11px] text-slate-400">
                              {new Date(item.createdAt).toLocaleTimeString('pt-BR')} • {item.operador}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              
              {activeSection === 'vps' && isAdmin && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                    <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Atualização ou Instalação Automática na sua VPS em 1 Único Passo
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Você não precisa digitar vários comandos nem entender de programação. Nós preparamos um <strong>Comando Único Automático</strong> que faz cópia de segurança dos seus dados atuais, atualiza todas as funções novas e reinicia o sistema sozinho.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#131924] border border-white/10 space-y-3">
                    <div className="text-xs font-bold text-slate-200">
                      Passo Único: Clique em "Copiar Comando" abaixo e cole na tela da sua VPS:
                    </div>

                    <div className="p-3 rounded-xl bg-black/60 border border-amber-500/30 font-mono text-xs text-amber-300 break-all select-all">
                      {oneStepVpsCommand}
                    </div>

                    <button
                      type="button"
                      onClick={() => copyText(oneStepVpsCommand, 'vps-cmd')}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      {copiedKey === 'vps-cmd' ? (
                        <>
                          <Check className="w-4 h-4" />
                          Comando Único Copiado! Agora é só colar na VPS
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copiar Comando Único da VPS
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-[#131924] border border-white/10">
                      <div className="font-bold text-emerald-300 mb-1">1. Protege seus Dados</div>
                      <p className="text-slate-400">
                        Antes de atualizar, ele guarda automaticamente todos os cadastros, caixas e estoques que já estavam na sua VPS.
                      </p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#131924] border border-white/10">
                      <div className="font-bold text-amber-300 mb-1">2. Instala Tudo Sozinho</div>
                      <p className="text-slate-400">
                        Baixa a versão nova completa, o menu fixo no canto inferior esquerdo e o modo offline sem apagar seus dados.
                      </p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#131924] border border-white/10">
                      <div className="font-bold text-blue-300 mb-1">3. Religamento Automático</div>
                      <p className="text-slate-400">
                        Se a VPS reiniciar algum dia, o sistema volta a funcionar sozinho sem você precisar fazer nada.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
