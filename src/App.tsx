import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LogOut,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  PanelLeft,
  PanelBottom,
  MessageSquare,
  Copy,
  Check,
  ArrowUp,
  ArrowDown,
  Building2,
  Smartphone,
  ShieldCheck,
  Sparkles,
  Menu,
  X,
  Sliders,
  Settings,
  LayoutGrid,
  List,
  ListFilter,
  ChevronsUpDown,
  Eye,
  EyeOff,
  Edit3,
  FolderPlus,
  Trash2,
  Palette,
  MapPin,
  Clock,
  Lock,
  Key,
  Users,
  UserPlus,
  Sun
} from 'lucide-react';
import {
  BrandIdentityConfig,
  CustomTabOverride,
  DEFAULT_CATEGORIES,
  DEFAULT_SECURITY_GEOFENCE_TURNO_CONFIG,
  DEFAULT_TAB_META,
  DeepLinkTarget,
  ERPCompleteData,
  MENU_SYMBOL_COLOR_PALETTE,
  NavCategory,
  SecurityGeofenceTurnoConfig,
  SystemImageSlotId,
  SystemImageSourceId,
  TabId
} from './types/erp';
import {
  AVAILABLE_MENU_ICONS,
  BUILTIN_BRAND_IMAGES_META,
  BackgroundBrightnessControlPanel,
  CategorySymbolSVG,
  CestariaGrafismoSVG,
  DEFAULT_ADMIN_MASTER_BRIGHTNESS,
  FocusFormModal,
  MarajoaraDividerSVG,
  SYSTEM_IMAGE_SLOTS_META,
  SystemDialogState,
  SystemSlotImage,
  TabIconSVG,
  UrutauEmblemSVG,
  UrutauGlobalSelectSystem,
  UrutauPosturaState,
  UrutauSlotImageManager,
  UrutauSystemDialog,
  VisualAvatar,
  applyBackgroundBrightnessToDom,
  blendCompanyWithUrutau,
  clampBrightness,
  extractColorsFromLogoImage,
  isGestorEmpresaUser,
  isSubordinadoDoGestor,
  isSuperAdminUser,
  podeMudarAparenciaSistema,
  registerClientErrorLog,
  resolverWhatsappInteligente,
  useSyncSystemFavicon,
  useUrutauNightFactor
} from './components/UrutauShared';
import {
  AgendaTab,
  CaixaTab,
  ChatAppsTab,
  ComprasTab,
  EscalasTab,
  EstoqueTab,
  PortaisTab,
  RateioTab,
  ReservasTab
} from './components/OperationalTabsPart1';
import {
  AuditLogsTab,
  CMVTab,
  CadastrosPessoasTab,
  ChecklistsTab,
  ConfigTab,
  EquipeTab,
  NotificacoesTab,
  RHTab,
  SelecaoTab,
  SetoresTab,
  UnidadesTab
} from './components/OperationalTabsPart2';
import { CargosTab } from './components/CargosTab';
import { EmpresasTab, FreelancersTab } from './components/MultiCompanyTabs';
import { PwaInstallBanner } from './components/PwaInstallBanner';
import { WhatsAppAiHub } from './components/WhatsAppAiHub';
import { OfflineSyncCenter } from './components/OfflineSyncCenter';
import { PdvHibridoTab } from './components/PdvHibridoTab';
import { UrutauLandingPage } from './components/UrutauLandingPage';
import { CleanModuleShell, HomeDashboardHub, MODULE_CLEAN_GUIDES, ModulosDirectoryHub } from './components/CleanModuleShell';
import {
  LaunchedPcProgram,
  UrutauPcProgramTakeoverScreen,
  UrutauWindowsExplorerModal,
  downloadCompanyAutonomyBackup,
  downloadUrutauWindowsInstaller
} from './components/UrutauWindowsExplorerModal';
import { offlineSyncEngine } from './services/offlineSyncEngine';

function buildPublicBootstrapErpData(empresasPub: any[] = [], configsPub: any[] = []): ERPCompleteData {
  const safeEmpresas = Array.isArray(empresasPub) ? empresasPub : [];
  const safeConfigs = Array.isArray(configsPub) ? configsPub : [];
  return {
    empresas: safeEmpresas,
    freelancers: [],
    cadastrosPessoas: [],
    registrosArquivados: [],
    cargos: [],
    matches_contratacoes: [],
    empresaAtivaId: safeEmpresas[0]?.id ? Number(safeEmpresas[0].id) : 1,
    unidades: [],
    setores: [],
    usuarios: [],
    checklists: [],
    escalaFixa: {},
    movimentosEscala: [],
    agenda: [],
    reservas: [],
    pdvProdutos: [],
    pdvComandas: [],
    pdvImpressoras: [],
    pdvFilaImpressao: [],
    portais: [],
    caixa: [],
    categoriasFechamentoCaixa: [],
    fechamentosCaixaDiarios: [],
    estoque: [],
    cmv: [],
    vagasRH: [],
    selecao: [],
    rhRegistros: [],
    mensagensRapidas: [],
    notificacoes: [],
    rateiosHistorico: [],
    configs: safeConfigs,
    auditLogs: [],
    backupsHorarios: [],
    filaAprovacoes: [],
    instanciasChat: [],
    mensagensChat: [],
    cqrs: {
      mv_cmv_diario: [],
      mv_rateio_10: []
    },
    pesosRateioSetoresEmpresas: {},
    relacionamentos: {}
  };
}

export default function App() {
  useEffect(() => {
    document.title = 'Urutau';
    const observer = new MutationObserver(() => {
      if (document.title !== 'Urutau') {
        document.title = 'Urutau';
      }
    });
    const titleEl = document.querySelector('title');
    if (titleEl) observer.observe(titleEl, { childList: true });
    return () => observer.disconnect();
  }, []);

  const [erpData, setErpData] = useState<ERPCompleteData | null>(null);
  const [showLandingPage, setShowLandingPage] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const parseInitialRouteFromLocation = (): { tab: TabId; subSlug: string | null } => {
    try {
      const params = new URLSearchParams(window.location.search);
      const qTab = params.get('tab');
      const qSub = params.get('sub') || params.get('submenu');
      if (qTab === 'whatsapp') return { tab: 'chat', subSlug: qSub };
      if (qTab && qTab in DEFAULT_TAB_META) return { tab: qTab as TabId, subSlug: qSub };

      const parts = window.location.pathname
        .split('/')
        .map((p) => p.trim().toLowerCase())
        .filter(Boolean);
      if (parts.length > 0) {
        if ((parts[0] === 'e' || parts[0] === 'portal') && parts.length >= 3) {
          const maybeTab = parts[2] as TabId;
          if (maybeTab in DEFAULT_TAB_META) {
            return { tab: maybeTab, subSlug: parts[3] || null };
          }
        }
        const firstSeg = parts[0] as TabId;
        if (firstSeg in DEFAULT_TAB_META) {
          return { tab: firstSeg, subSlug: parts[1] || null };
        }
      }
    } catch {}
    return { tab: 'home', subSlug: null };
  };

  const [activeTab, setActiveTab] = useState<TabId>(() => parseInitialRouteFromLocation().tab);
  const [activeSubTabSlug, setActiveSubTabSlug] = useState<string | null>(
    () => parseInitialRouteFromLocation().subSlug
  );
  const [sseApiBase, setSseApiBase] = useState<string>(() => offlineSyncEngine.getActiveApiBaseUrl());
  const [rhInitialSubView, setRhInitialSubView] = useState<'recursos' | 'dossie' | 'prontuarios' | 'selecao'>('recursos');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [deepLinkEntityId, setDeepLinkEntityId] = useState<number | null>(null);
  const [deepLinkMesaCodigo, setDeepLinkMesaCodigo] = useState<string | null>(null);

  const [inactivityLimitSec, setInactivityLimitSec] = useState<number>(300);
  const secondsRemainingRef = useRef<number>(300);
  const setSecondsRemaining = useCallback((val: number) => {
    secondsRemainingRef.current = val;
  }, []);
  const [isUserAuthenticated, setIsUserAuthenticated] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('urutau_active_user_session_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        const hasSignedToken =
          typeof parsed?.sessaoToken === 'string' && parsed.sessaoToken.includes('.');
        if (hasSignedToken) {
          offlineSyncEngine.setSessionToken(parsed.sessaoToken);
        }
        return Boolean(parsed?.user?.id && Number(parsed.user.id) > 0 && hasSignedToken);
      }
    } catch {}
    return false;
  });
  const [isSessionLocked, setIsSessionLocked] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('urutau_active_user_session_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        const hasSignedToken =
          typeof parsed?.sessaoToken === 'string' && parsed.sessaoToken.includes('.');
        if (parsed?.user?.id && Number(parsed.user.id) > 0 && hasSignedToken) return false;
      }
    } catch {}
    return true;
  });
  const [sessionVerifiedByServer, setSessionVerifiedByServer] = useState<boolean>(false);
  const [landingScrollSignal, setLandingScrollSignal] = useState<number>(0);
  const [windowsExplorerErpOpen, setWindowsExplorerErpOpen] = useState<boolean>(false);
  const [isDesktopExeMode, setIsDesktopExeMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      localStorage.removeItem('urutau_exe_runtime_active');
    } catch {}
    const params = new URLSearchParams(window.location.search);
    return params.get('desktop_exe') === '1';
  });
  const [activePcProgram, setActivePcProgram] = useState<LaunchedPcProgram | null>(null);
  const [launchedPcPrograms, setLaunchedPcPrograms] = useState<LaunchedPcProgram[]>([]);

  const handleLaunchPcProgram = useCallback((prog: LaunchedPcProgram) => {
    setLaunchedPcPrograms((prev) => {
      const filtered = prev.filter((p) => p.id !== prog.id && p.caminhoExe !== prog.caminhoExe);
      return [prog, ...filtered];
    });
    setActivePcProgram(prog);
    setWindowsExplorerErpOpen(false);
  }, []);
  const [currentUser, setCurrentUser] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('urutau_active_user_session_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.user && Number(parsed.user.id) > 0) return parsed.user;
      }
    } catch {}
    return {
      id: 0,
      nome: 'Visitante',
      cargo: 'Acesso Não Autenticado',
      tipo: 'Visitante',
      empresas_ids: []
    };
  });
  const [realOperatorUser, setRealOperatorUser] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('urutau_active_user_session_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.user && Number(parsed.user.id) > 0) return parsed.user;
      }
    } catch {}
    return {
      id: 0,
      nome: 'Visitante',
      cargo: 'Acesso Não Autenticado',
      tipo: 'Visitante',
      empresas_ids: []
    };
  });
  const [unlockIdentificador, setUnlockIdentificador] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('urutau_active_user_session_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.user?.nome && parsed.user.nome !== 'Visitante') return parsed.user.nome;
      }
    } catch {}
    return '';
  });
  const [unlockPassword, setUnlockPassword] = useState<string>('');
  const [unlockError, setUnlockError] = useState<string>('');
  const [unlockLoading, setUnlockLoading] = useState<boolean>(false);
  const [recoveryOpen, setRecoveryOpen] = useState<boolean>(false);
  const [recoveryCanal, setRecoveryCanal] = useState<'whatsapp' | 'email'>('whatsapp');
  const [recoveryIdentificador, setRecoveryIdentificador] = useState<string>('');
  const [recoveryStep, setRecoveryStep] = useState<'request' | 'confirm'>('request');
  const [recoveryToken, setRecoveryToken] = useState<string>('');
  const [recoveryNovaSenha, setRecoveryNovaSenha] = useState<string>('');
  const [recoveryFeedback, setRecoveryFeedback] = useState<string>('');
  const [recoveryError, setRecoveryError] = useState<string>('');
  const [recoveryLoading, setRecoveryLoading] = useState<boolean>(false);

  const [userSwitchModalOpen, setUserSwitchModalOpen] = useState<boolean>(false);
  const [userSwitchTab, setUserSwitchTab] = useState<'salvos' | 'outro_login' | 'novo_usuario'>('salvos');
  const [savedDeviceUsers, setSavedDeviceUsers] = useState<any[]>(() => {
    try {
      const raw = localStorage.getItem('urutau_saved_accounts_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (u: any) => Number(u?.id) !== 1 && String(u?.nome || '').toLowerCase() !== 'admin master'
          );
        }
      }
    } catch {}
    return [];
  });
  const [removedSavedUserKeys, setRemovedSavedUserKeys] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('urutau_removed_saved_accounts_v1');
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });
  const [switchLoginIdentificador, setSwitchLoginIdentificador] = useState<string>('');
  const [switchLoginPassword, setSwitchLoginPassword] = useState<string>('');
  const [switchSaveAccount, setSwitchSaveAccount] = useState<boolean>(true);
  const [switchAuthError, setSwitchAuthError] = useState<string>('');
  const [switchAuthLoading, setSwitchAuthLoading] = useState<boolean>(false);

  const [newQuickUserForm, setNewQuickUserForm] = useState({
    nome: '',
    cargo: 'Operador',
    tipo: 'Colaborador',
    telefone: '',
    senha: '',
    salvarNoDispositivo: true
  });

  const [selectedEmpresaId, setSelectedEmpresaId] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem('urutau_active_user_session_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.empresaId) return Number(parsed.empresaId);
        if (Array.isArray(parsed?.user?.empresas_ids) && parsed.user.empresas_ids.length > 0) {
          return Number(parsed.user.empresas_ids[0]);
        }
      }
    } catch {}
    return null;
  });

  const persistActiveSession = useCallback(
    (userObj: any, empId?: number | null, sessaoToken?: string | null) => {
      try {
        const targetEmpId =
          empId ??
          (Array.isArray(userObj?.empresas_ids) && userObj.empresas_ids.length > 0
            ? Number(userObj.empresas_ids[0])
            : null);
        const resolvedToken =
          typeof sessaoToken === 'string' && sessaoToken.includes('.')
            ? sessaoToken.trim()
            : offlineSyncEngine.getSessionToken();
        if (resolvedToken) {
          offlineSyncEngine.setSessionToken(resolvedToken);
        }
        localStorage.setItem(
          'urutau_active_user_session_v2',
          JSON.stringify({
            user: userObj,
            empresaId: targetEmpId,
            sessaoToken: resolvedToken || ''
          })
        );
      } catch {}
    },
    []
  );
  const [loginTab, setLoginTab] = useState<'wpp' | 'argon2' | 'cadastro'>('wpp');
  const [wppInputTelefone, setWppInputTelefone] = useState<string>('');
  const [wppOtpCode, setWppOtpCode] = useState<string>('');
  const [wppOtpSent, setWppOtpSent] = useState<boolean>(false);
  const [wppOtpTimer, setWppOtpTimer] = useState<number>(300);
  const [wppOtpFeedback, setWppOtpFeedback] = useState<string>('');
  const [wppLoading, setWppLoading] = useState<boolean>(false);
  const [wppError, setWppError] = useState<string>('');

  const [cadNomeEmpresa, setCadNomeEmpresa] = useState<string>('');
  const [cadSubdominioInput, setCadSubdominioInput] = useState<string>('');
  const [cadSubdominioEditadoManual, setCadSubdominioEditadoManual] = useState<boolean>(false);
  const [cadCorMarcaHex, setCadCorMarcaHex] = useState<string>('#10B981');
  const [cadLogoDataUrl, setCadLogoDataUrl] = useState<string>('');
  const [portalSubdominioInput, setPortalSubdominioInput] = useState<string>('');
  const [portalEmpresaAtiva, setPortalEmpresaAtiva] = useState<any>(null);
  const [portaisDisponiveis, setPortaisDisponiveis] = useState<any[]>([]);
  const [copiedPortalLink, setCopiedPortalLink] = useState<boolean>(false);
  const [savingPortalSlug, setSavingPortalSlug] = useState<boolean>(false);
  const [cadNomeEmpresario, setCadNomeEmpresario] = useState<string>('');
  const [cadWhatsapp, setCadWhatsapp] = useState<string>('');
  const [cadEmail, setCadEmail] = useState<string>('');
  const [cadCnpj, setCadCnpj] = useState<string>('');
  const [cadSenha, setCadSenha] = useState<string>('');
  const [cadModoDrive, setCadModoDrive] = useState<'botao_google' | 'compartilhar_pasta' | 'automatico_depois'>('botao_google');
  const [cadPastaDriveUrl, setCadPastaDriveUrl] = useState<string>('');
  const [cadProvedorNuvem, setCadProvedorNuvem] = useState<string>('Google Drive');
  const [cadMostrarTrocaDrive, setCadMostrarTrocaDrive] = useState<boolean>(false);
  const [cadEmailServicoSistema, setCadEmailServicoSistema] = useState<string>('bd@nyctibi.us');
  const [cadGoogleClientId, setCadGoogleClientId] = useState<string>('');
  const [cadCopiedServiceEmail, setCadCopiedServiceEmail] = useState<boolean>(false);
  const [cadGoogleToken, setCadGoogleToken] = useState<string>('');
  const [cadPlanilhaUrl, setCadPlanilhaUrl] = useState<string>('');
  const [cadAceiteLgpd, setCadAceiteLgpd] = useState<boolean>(true);
  const [cadModoGuarda, setCadModoGuarda] = useState<'google_drive' | 'computador_local_multiacesso'>('google_drive');
  const [cadCienciaMultiacessoSemDrive, setCadCienciaMultiacessoSemDrive] = useState<boolean>(false);
  const [computadoresAtivosEmpresa, setComputadoresAtivosEmpresa] = useState<number>(1);
  const [bannerMultiacessoSaving, setBannerMultiacessoSaving] = useState<boolean>(false);
  const [fechamentoUltimoPcModalOpen, setFechamentoUltimoPcModalOpen] = useState<boolean>(false);
  const [estadoFechamentoLocal, setEstadoFechamentoLocal] = useState<any>(null);
  const [outroPcCienteContinuar, setOutroPcCienteContinuar] = useState<boolean>(false);
  const [verificandoOutroPc, setVerificandoOutroPc] = useState<boolean>(false);
  const [pacoteAtrasadoPendente, setPacoteAtrasadoPendente] = useState<any>(null);
  const [mesclandoAtraso, setMesclandoAtraso] = useState<boolean>(false);
  const [recuperacaoConcluidaMsg, setRecuperacaoConcluidaMsg] = useState<string>('');
  const [cadLoading, setCadLoading] = useState<boolean>(false);
  const [cadError, setCadError] = useState<string>('');
  const [cadCriadoResumo, setCadCriadoResumo] = useState<any>(null);

  const { meuPcId, meuPcApelido } = useMemo(() => {
    try {
      let id = localStorage.getItem('urutau_pc_id') || '';
      if (!id) {
        id = `PC-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        localStorage.setItem('urutau_pc_id', id);
      }
      let apelido = localStorage.getItem('urutau_pc_apelido') || '';
      if (!apelido) {
        const ua = String(navigator.userAgent || '').toLowerCase();
        const so = ua.includes('win')
          ? 'Computador Windows'
          : ua.includes('mac')
          ? 'Computador Mac'
          : ua.includes('linux')
          ? 'Computador Linux'
          : 'Computador';
        apelido = `${so} (${id})`;
        localStorage.setItem('urutau_pc_apelido', apelido);
      }
      return { meuPcId: id, meuPcApelido: apelido };
    } catch {
      return { meuPcId: 'PC-LOCAL', meuPcApelido: 'Este Computador' };
    }
  }, []);

  useEffect(() => {
    fetch('/api/lgpd/google-sheets/opcoes-publicas')
      .then((r) => r.json())
      .then((json) => {
        if (json?.email_servico_compartilhamento) {
          setCadEmailServicoSistema(json.email_servico_compartilhamento);
        }
        if (json?.google_client_id && !cadGoogleClientId) {
          setCadGoogleClientId(json.google_client_id);
        }
      })
      .catch(() => {});
  }, []);

  const hidratacaoEmAndamentoRef = useRef<Record<number, boolean>>({});

  const contarRegistrosPacote = useCallback((pacote: any) => {
    if (!pacote || typeof pacote !== 'object') return 0;
    return (
      (pacote.reservas?.length || 0) +
      (pacote.movimentosEscala?.length || 0) +
      (pacote.caixa?.length || 0) +
      (pacote.estoque?.length || 0) +
      (pacote.cmv?.length || 0) +
      (pacote.selecao?.length || 0) +
      (pacote.rhRegistros?.length || 0) +
      (pacote.notificacoes?.length || 0) +
      (pacote.rateiosHistorico?.length || 0) +
      (pacote.agenda?.length || 0) +
      (pacote.checklists?.length || 0) +
      (pacote.cadastrosPessoas?.length || 0)
    );
  }, []);

  const erpDataRef = useRef<ERPCompleteData | null>(null);
  useEffect(() => {
    erpDataRef.current = erpData;
  }, [erpData]);

  const construirPacotePortatilSync = useCallback((empId: number) => {
    const snap = erpDataRef.current;
    if (!snap) return null;
    const empObj = (snap.empresas || []).find((e: any) => Number(e.id) === empId);
    const matchEmp = (r: any) => Number(r?.empresa_id ?? r?.id_empresa ?? 0) === empId;
    return {
      versao_pacote: 'URUTAU-PORTATIL-LGPD-1.0',
      empresa_id: empId,
      empresa_nome: empObj?.nome || `Empresa #${empId}`,
      exportado_em: new Date().toISOString(),
      empresa: empObj || null,
      movimentosEscala: (snap.movimentosEscala || []).filter(matchEmp),
      agenda: (snap.agenda || []).filter(matchEmp),
      reservas: (snap.reservas || []).filter(matchEmp),
      caixa: (snap.caixa || []).filter(matchEmp),
      estoque: (snap.estoque || []).filter(matchEmp),
      cmv: (snap.cmv || []).filter(matchEmp),
      selecao: (snap.selecao || []).filter(matchEmp),
      rhRegistros: (snap.rhRegistros || []).filter(matchEmp),
      notificacoes: (snap.notificacoes || []).filter(matchEmp),
      rateiosHistorico: (snap.rateiosHistorico || []).filter(matchEmp),
      checklists: (snap.checklists || []).filter(matchEmp),
      cadastrosPessoas: (snap.cadastrosPessoas || []).filter(matchEmp)
    };
  }, []);

  const limparBackupsDuplicadosLocais = useCallback(
    (empId: number, apagarPontoParadaJaSincronizado = false) => {
      try {
        const chaveUnicaLocal = `urutau_pacote_local_empresa_${empId}`;
        const chavePontoParada = `urutau_pacote_atrasado_empresa_${empId}`;
        const chavesParaRemover: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          if (
            k.startsWith('urutau_backup_local_fechamento') ||
            k.startsWith('urutau_copia_duplicada_') ||
            (k.startsWith('urutau_pacote_local_empresa_') && k !== chaveUnicaLocal) ||
            (k.startsWith('urutau_pacote_atrasado_empresa_') && k !== chavePontoParada)
          ) {
            chavesParaRemover.push(k);
          }
        }
        chavesParaRemover.forEach((k) => localStorage.removeItem(k));
        if (apagarPontoParadaJaSincronizado) {
          localStorage.removeItem(chavePontoParada);
          localStorage.removeItem('urutau_ultimo_pc_fechou_sem_nuvem');
          localStorage.removeItem('urutau_backup_local_fechamento_exe');
        }
      } catch {}
    },
    []
  );

  const salvarPacotePortatilLocal = useCallback(
    async (empId: number, salvarPontoParadaMesmoNaoSendoUltimo = true) => {
      limparBackupsDuplicadosLocais(empId, false);
      const pacoteSync = construirPacotePortatilSync(empId);
      if (pacoteSync) {
        try {
          localStorage.setItem(`urutau_pacote_local_empresa_${empId}`, JSON.stringify(pacoteSync));
          if (salvarPontoParadaMesmoNaoSendoUltimo && contarRegistrosPacote(pacoteSync) > 0) {
            localStorage.setItem(
              `urutau_pacote_atrasado_empresa_${empId}`,
              JSON.stringify({
                empresa_id: empId,
                fechado_em: new Date().toISOString(),
                pc_id: meuPcId,
                pc_apelido: meuPcApelido,
                sobrescrito_unico: true,
                pacote: pacoteSync
              })
            );
          }
        } catch {}
      }
      try {
        const r = await fetch(`/api/lgpd/vps-processador/exportar-pacote/${empId}`);
        const json = await r.json();
        if (r.ok && json?.ok && json.pacote_portatil) {
          localStorage.setItem(
            `urutau_pacote_local_empresa_${empId}`,
            JSON.stringify(json.pacote_portatil)
          );
          if (salvarPontoParadaMesmoNaoSendoUltimo && contarRegistrosPacote(json.pacote_portatil) > 0) {
            localStorage.setItem(
              `urutau_pacote_atrasado_empresa_${empId}`,
              JSON.stringify({
                empresa_id: empId,
                fechado_em: new Date().toISOString(),
                pc_id: meuPcId,
                pc_apelido: meuPcApelido,
                sobrescrito_unico: true,
                pacote: json.pacote_portatil
              })
            );
          }
        }
      } catch {}
    },
    [construirPacotePortatilSync, contarRegistrosPacote, limparBackupsDuplicadosLocais, meuPcId, meuPcApelido]
  );

  const dispararExportacaoFechamentoLocalExe = useCallback(
    (salvarArquivoDisco = false, isUltimoPcOverride = false) => {
      const empId = Number(selectedEmpresaId || currentUser?.empresas_ids?.[0] || 1);
      limparBackupsDuplicadosLocais(empId, false);
      const pacoteSync = construirPacotePortatilSync(empId);
      if (pacoteSync) {
        try {
          localStorage.setItem(`urutau_pacote_local_empresa_${empId}`, JSON.stringify(pacoteSync));
          if (contarRegistrosPacote(pacoteSync) > 0) {
            localStorage.setItem(
              `urutau_pacote_atrasado_empresa_${empId}`,
              JSON.stringify({
                empresa_id: empId,
                fechado_em: new Date().toISOString(),
                pc_id: meuPcId,
                pc_apelido: meuPcApelido,
                sobrescrito_unico: true,
                era_ultimo_pc: isUltimoPcOverride,
                pacote: pacoteSync
              })
            );
          }
        } catch {}
      }
      const payloadStr = JSON.stringify({
        empresa_id: empId,
        origem: 'FECHAMENTO_EXE_LOCAL',
        encerrar_sessao: true,
        pc_id: meuPcId,
        pc_apelido: meuPcApelido,
        is_ultimo_pc: isUltimoPcOverride,
        sobrescrever_anterior: true,
        fechado_em: new Date().toISOString()
      });
      try {
        localStorage.setItem(
          'urutau_backup_local_fechamento_exe',
          JSON.stringify({
            empresa_id: empId,
            pc_id: meuPcId,
            sobrescrito_unico: true,
            exportado_em: new Date().toISOString(),
            padrao: 'PONTO_DE_PARADA_SOBRESCRITO_UNICO'
          })
        );
      } catch {}
      try {
        if (navigator.sendBeacon) {
          const blob = new Blob([payloadStr], { type: 'application/json' });
          navigator.sendBeacon('/api/lgpd/google-sheets/exportar-fechamento-local', blob);
        } else {
          fetch('/api/lgpd/google-sheets/exportar-fechamento-local', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payloadStr,
            keepalive: true
          }).catch(() => {});
        }
      } catch {}

      const isExeLocal =
        salvarArquivoDisco ||
        window.location.search.includes('desktop_exe=1') ||
        localStorage.getItem('urutau_desktop_exe_mode') === '1';

      if (isExeLocal) {
        try {
          const link = document.createElement('a');
          link.href = `/api/lgpd/google-sheets/baixar-planilha-mestre/${empId}?codigo=01&fechamento_exe=1`;
          link.download = `Backup_Local_Fechamento_Urutau_${empId}.xls`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } catch {}
      }
    },
    [
      selectedEmpresaId,
      currentUser,
      meuPcId,
      meuPcApelido,
      limparBackupsDuplicadosLocais,
      construirPacotePortatilSync,
      contarRegistrosPacote
    ]
  );

  const finalizarSaidaDaSessao = useCallback(
    (limparIdentificador = false) => {
      const empId = Number(selectedEmpresaId || currentUser?.empresas_ids?.[0] || 1);
      const empObj = (erpData?.empresas || []).find((e: any) => Number(e.id) === empId);
      const cfgCust: any = empObj?.lgpd_custodia_config || {};
      const driveConectado = Boolean(
        (cfgCust.pasta_google_drive_id && String(cfgCust.pasta_google_drive_id).trim().length > 0) ||
          (cfgCust.planilha_google_id && String(cfgCust.planilha_google_id).trim().length > 0) ||
          (cfgCust.apps_script_webhook_url && String(cfgCust.apps_script_webhook_url).startsWith('https://')) ||
          (cfgCust.conta_google_vinculada && String(cfgCust.conta_google_vinculada).includes('@'))
      );
      const isUltimoPcSemNuvem = !driveConectado && computadoresAtivosEmpresa <= 1;
      if (isUltimoPcSemNuvem) {
        const estadoLocal = {
          aguardando_primeiro_pc: true,
          ultimo_pc_id: meuPcId,
          ultimo_pc_apelido: meuPcApelido,
          fechado_em: new Date().toISOString()
        };
        setEstadoFechamentoLocal(estadoLocal);
        try {
          localStorage.setItem(
            'urutau_ultimo_pc_fechou_sem_nuvem',
            JSON.stringify({
              empresa_id: empId,
              empresa_nome: empObj?.nome || 'Sua Empresa',
              pc_id: meuPcId,
              pc_apelido: meuPcApelido,
              fechado_em: estadoLocal.fechado_em
            })
          );
        } catch {}
      }
      salvarPacotePortatilLocal(empId, true);
      dispararExportacaoFechamentoLocalExe(true, isUltimoPcSemNuvem);
      setMobileMenuOpen(false);
      setFechamentoUltimoPcModalOpen(false);
      if (limparIdentificador) {
        setUnlockIdentificador(
          realOperatorUser?.nome && realOperatorUser.nome !== 'Visitante'
            ? realOperatorUser.nome
            : ''
        );
      } else {
        setUnlockIdentificador(realOperatorUser?.nome || currentUser?.nome || 'Admin Master');
      }
      offlineSyncEngine.setSessionToken('');
      try {
        const rawSaved = localStorage.getItem('urutau_active_user_session_v2');
        if (rawSaved) {
          const parsedSaved = JSON.parse(rawSaved);
          localStorage.setItem(
            'urutau_active_user_session_v2',
            JSON.stringify({
              user: parsedSaved?.user || null,
              empresaId: parsedSaved?.empresaId || empId,
              sessaoToken: ''
            })
          );
        }
      } catch {}
      setSessionVerifiedByServer(false);
      setUserSwitchModalOpen(false);
      setIsUserAuthenticated(false);
      setIsSessionLocked(true);
      setErpData((prev) => buildPublicBootstrapErpData(prev?.empresas || [], []));
    },
    [
      selectedEmpresaId,
      currentUser,
      erpData?.empresas,
      computadoresAtivosEmpresa,
      meuPcId,
      meuPcApelido,
      salvarPacotePortatilLocal,
      dispararExportacaoFechamentoLocalExe,
      realOperatorUser
    ]
  );

  const solicitarSaidaDoSistema = useCallback(
    (limparIdentificador = false) => {
      const empId = Number(selectedEmpresaId || currentUser?.empresas_ids?.[0] || 1);
      const empObj = (erpData?.empresas || []).find((e: any) => Number(e.id) === empId);
      const cfgCust: any = empObj?.lgpd_custodia_config || {};
      const driveConectado = Boolean(
        (cfgCust.pasta_google_drive_id && String(cfgCust.pasta_google_drive_id).trim().length > 0) ||
          (cfgCust.planilha_google_id && String(cfgCust.planilha_google_id).trim().length > 0) ||
          (cfgCust.apps_script_webhook_url && String(cfgCust.apps_script_webhook_url).startsWith('https://')) ||
          (cfgCust.conta_google_vinculada && String(cfgCust.conta_google_vinculada).includes('@'))
      );
      salvarPacotePortatilLocal(empId, true);
      if (!driveConectado && computadoresAtivosEmpresa <= 1) {
        setFechamentoUltimoPcModalOpen(true);
        return;
      }
      finalizarSaidaDaSessao(limparIdentificador);
    },
    [
      selectedEmpresaId,
      currentUser,
      erpData?.empresas,
      computadoresAtivosEmpresa,
      salvarPacotePortatilLocal,
      finalizarSaidaDaSessao
    ]
  );

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('desktop_exe') === '1' || params.get('auto_export_close') === '1') {
        localStorage.setItem('urutau_desktop_exe_mode', '1');
      }
    } catch {}

    const empId = Number(selectedEmpresaId || currentUser?.empresas_ids?.[0] || 1);
    const interval1h = window.setInterval(() => {
      if (!isUserAuthenticated || isSessionLocked || !offlineSyncEngine.getSessionToken()) return;
      fetch('/api/lgpd/google-sheets/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: empId,
          origem: 'AUTOMATICA_1H'
        })
      })
        .then((r) => r.json())
        .then((json) => {
          if (json?.pacote_portatil) {
            try {
              limparBackupsDuplicadosLocais(empId, true);
              localStorage.setItem(
                `urutau_pacote_local_empresa_${empId}`,
                JSON.stringify(json.pacote_portatil)
              );
            } catch {}
          }
        })
        .catch(() => {});
    }, 60 * 60 * 1000);

    const handleBeforeUnload = () => {
      const empObj = (erpData?.empresas || []).find((e: any) => Number(e.id) === empId);
      const cfgCust: any = empObj?.lgpd_custodia_config || {};
      const driveConectado = Boolean(
        (cfgCust.pasta_google_drive_id && String(cfgCust.pasta_google_drive_id).trim().length > 0) ||
          (cfgCust.planilha_google_id && String(cfgCust.planilha_google_id).trim().length > 0) ||
          (cfgCust.apps_script_webhook_url && String(cfgCust.apps_script_webhook_url).startsWith('https://')) ||
          (cfgCust.conta_google_vinculada && String(cfgCust.conta_google_vinculada).includes('@'))
      );
      const isUltimoSemNuvemUnload = !driveConectado && computadoresAtivosEmpresa <= 1;
      dispararExportacaoFechamentoLocalExe(false, isUltimoSemNuvemUnload);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      window.clearInterval(interval1h);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, [selectedEmpresaId, currentUser, erpData?.empresas, computadoresAtivosEmpresa, dispararExportacaoFechamentoLocalExe, limparBackupsDuplicadosLocais]);

  const handleConectarGoogleDrivePopup = () => {
    setCadError('');
    const clientId = cadGoogleClientId.trim();
    if (!clientId) {
      setCadGoogleToken('CONECTADO_AUTOMATICO_BD_NYCTIBI_US');
      return;
    }
    const startOAuth = () => {
      const g = (window as any).google;
      if (!g?.accounts?.oauth2) {
        setCadGoogleToken('CONECTADO_AUTOMATICO_BD_NYCTIBI_US');
        return;
      }
      const tokenClient = g.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets',
        callback: (resp: any) => {
          if (resp?.access_token) {
            setCadGoogleToken(resp.access_token);
          } else {
            setCadGoogleToken('CONECTADO_AUTOMATICO_BD_NYCTIBI_US');
          }
        }
      });
      tokenClient.requestAccessToken({ prompt: 'consent' });
    };
    if ((window as any).google?.accounts?.oauth2) {
      startOAuth();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = startOAuth;
    script.onerror = () => setCadGoogleToken('CONECTADO_AUTOMATICO_BD_NYCTIBI_US');
    document.head.appendChild(script);
  };

  const [brandShowcaseOpen, setBrandShowcaseOpen] = useState<boolean>(false);
  const [previewPostura, setPreviewPostura] = useState<UrutauPosturaState>('sentinela');

  const [accentHex, setAccentHex] = useState<string>('#10B981');
  const [brandConfig, setBrandConfig] = useState<BrandIdentityConfig>(() => {
    try {
      const saved = localStorage.getItem('urutau_brand_identity_v2');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      companyName: '',
      logoDataUrl: '',
      companyColorHex: '#10B981',
      companySecondaryHex: '#F59E0B',
      companyTertiaryHex: '#06B6D4',
      urutauBaseHex: '#10B981',
      blendRatio: 0.7,
      effectivePrimaryHex: '#10B981',
      effectivePrimaryRgb: { r: 16, g: 185, b: 129 },
      effectiveSecondaryHex: '#F59E0B',
      effectiveTertiaryHex: '#06B6D4',
      modeloTracoPreferido: 'padrao_xilogravura_olhar_marajoara'
    };
  });

  const applyAccentTheme = useCallback((hex: string, rgb?: { r: number; g: number; b: number }) => {
    setAccentHex(hex);
    document.documentElement.style.setProperty('--urutau-accent', hex);
    if (rgb) {
      document.documentElement.style.setProperty(
        '--urutau-accent-rgb',
        `${rgb.r}, ${rgb.g}, ${rgb.b}`
      );
    }
  }, []);

  const savedPersistedBrandRef = useRef<BrandIdentityConfig | null>(null);
  const adminMasterBrandRef = useRef<BrandIdentityConfig | null>(null);
  const adminMasterCategoriesRef = useRef<NavCategory[]>(DEFAULT_CATEGORIES);
  const adminMasterOverridesRef = useRef<Record<string, CustomTabOverride>>({});
  const adminMasterLayoutRef = useRef<{
    menuPosition: 'left' | 'bottom';
    menuVisualMode: 'grid' | 'dock' | 'compact';
    expandAllCategories: boolean;
    sidebarWidth: number;
  }>({
    menuPosition: 'left',
    menuVisualMode: 'dock',
    expandAllCategories: true,
    sidebarWidth: 264
  });

  const [adminMasterBrightness, setAdminMasterBrightness] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('urutau_admin_master_brightness_v1');
      if (saved !== null && saved !== '') {
        return clampBrightness(saved, DEFAULT_ADMIN_MASTER_BRIGHTNESS);
      }
    } catch {}
    return DEFAULT_ADMIN_MASTER_BRIGHTNESS;
  });

  const [userBrightnessOverride, setUserBrightnessOverride] = useState<number | null>(() => {
    try {
      if (currentUser?.id && !isSuperAdminUser(currentUser)) {
        const raw = localStorage.getItem(`urutau_user_custom_${currentUser.id}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.backgroundBrightness !== undefined && parsed?.backgroundBrightness !== null) {
            return clampBrightness(parsed.backgroundBrightness);
          }
        }
      }
    } catch {}
    return null;
  });

  const [brightnessPanelOpen, setBrightnessPanelOpen] = useState<boolean>(false);

  const effectiveBackgroundBrightness = useMemo(() => {
    if (!isUserAuthenticated || isSessionLocked) {
      return clampBrightness(adminMasterBrightness);
    }
    if (isSuperAdminUser(currentUser)) {
      return clampBrightness(adminMasterBrightness);
    }
    if (userBrightnessOverride !== null && userBrightnessOverride !== undefined) {
      return clampBrightness(userBrightnessOverride);
    }
    return clampBrightness(adminMasterBrightness);
  }, [isUserAuthenticated, isSessionLocked, currentUser, adminMasterBrightness, userBrightnessOverride]);

  useEffect(() => {
    applyBackgroundBrightnessToDom(effectiveBackgroundBrightness);
  }, [effectiveBackgroundBrightness]);

  useEffect(() => {
    if (!currentUser?.id || isSuperAdminUser(currentUser)) {
      setUserBrightnessOverride(null);
      return;
    }
    const cfgFromMemory = erpData?.configs?.find(
      (c: any) => c.chave === `personalizacao_usuario_${currentUser.id}`
    )?.valor_json;
    if (cfgFromMemory && cfgFromMemory.backgroundBrightness !== undefined) {
      setUserBrightnessOverride(
        cfgFromMemory.backgroundBrightness === null
          ? null
          : clampBrightness(cfgFromMemory.backgroundBrightness)
      );
      return;
    }
    try {
      const raw = localStorage.getItem(`urutau_user_custom_${currentUser.id}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.backgroundBrightness !== undefined && parsed?.backgroundBrightness !== null) {
          setUserBrightnessOverride(clampBrightness(parsed.backgroundBrightness));
          return;
        }
      }
    } catch {}
    setUserBrightnessOverride(null);
  }, [currentUser?.id, currentUser?.tipo, erpData?.configs]);

  const brightnessSaveTimerRef = useRef<any>(null);

  const handleUpdateBackgroundBrightness = useCallback(
    (nextVal: number | null) => {
      if (brightnessSaveTimerRef.current) {
        clearTimeout(brightnessSaveTimerRef.current);
      }
      if (isSuperAdminUser(currentUser)) {
        const clamped = clampBrightness(nextVal ?? DEFAULT_ADMIN_MASTER_BRIGHTNESS);
        setAdminMasterBrightness(clamped);
        try {
          localStorage.setItem('urutau_admin_master_brightness_v1', String(clamped));
        } catch {}
        brightnessSaveTimerRef.current = setTimeout(() => {
          fetch('/api/erp/configs/salvar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chave: 'brilho_fundo_padrao',
              valor_json: {
                brilho: clamped,
                atualizado_por: currentUser?.nome || 'Admin Master',
                atualizado_em: new Date().toISOString()
              }
            })
          }).catch(() => {});
        }, 350);
      } else if (currentUser?.id) {
        const normalized = nextVal === null ? null : clampBrightness(nextVal);
        setUserBrightnessOverride(normalized);
        const userKey = `personalizacao_usuario_${currentUser.id}`;
        let existingObj: Record<string, any> = {};
        try {
          const existingRaw = localStorage.getItem(`urutau_user_custom_${currentUser.id}`);
          existingObj = existingRaw ? JSON.parse(existingRaw) : {};
        } catch {}
        const merged = {
          ...existingObj,
          backgroundBrightness: normalized,
          updatedAt: new Date().toISOString()
        };
        try {
          localStorage.setItem(`urutau_user_custom_${currentUser.id}`, JSON.stringify(merged));
        } catch {}
        brightnessSaveTimerRef.current = setTimeout(() => {
          fetch('/api/erp/configs/salvar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chave: userKey,
              valor_json: merged
            })
          }).catch(() => {});
        }, 350);
      }
    },
    [currentUser]
  );

  const handleUpdateBrandConfig = useCallback(
    (nextBrand: BrandIdentityConfig, persistServer: boolean = true) => {
      setBrandConfig(nextBrand);
      const blended = blendCompanyWithUrutau(
        nextBrand.companyColorHex || '#10B981',
        nextBrand.urutauBaseHex || '#10B981',
        nextBrand.blendRatio ?? 0.7
      );
      applyAccentTheme(blended.effectiveHex, blended.rgb);
      document.documentElement.style.setProperty('--sidebar-bg-top', blended.sidebarBgTop);
      document.documentElement.style.setProperty('--sidebar-bg-bottom', blended.sidebarBgBottom);

      if (persistServer) {
        savedPersistedBrandRef.current = nextBrand;
        localStorage.setItem('urutau_brand_identity_v2', JSON.stringify(nextBrand));
        const activeEmpId = Number(selectedEmpresaId || currentUser?.empresas_ids?.[0] || portalEmpresaAtiva?.id || 1);
        fetch('/api/erp/empresas/personalizacao-portal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            empresa_id: activeEmpId,
            subdominio: portalSubdominioInput || undefined,
            brand_config: nextBrand
          })
        })
          .then((r) => r.json())
          .then((d) => {
            if (d?.ok && d?.empresa) {
              setPortalEmpresaAtiva(d.empresa);
              if (d.empresa.subdominio) setPortalSubdominioInput(d.empresa.subdominio);
            }
          })
          .catch(() => {});

        if (isSuperAdminUser(currentUser)) {
          adminMasterBrandRef.current = nextBrand;
          fetch('/api/erp/configs/salvar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chave: 'identidade_visual_empresa',
              empresa_id: activeEmpId,
              valor_json: nextBrand
            })
          }).catch(() => {});
        } else if (currentUser?.id) {
          const userKey = `personalizacao_usuario_${currentUser.id}`;
          const existingRaw = localStorage.getItem(`urutau_user_custom_${currentUser.id}`);
          const existingObj = existingRaw ? JSON.parse(existingRaw) : {};
          const merged = { ...existingObj, brandConfig: nextBrand, updatedAt: new Date().toISOString() };
          localStorage.setItem(`urutau_user_custom_${currentUser.id}`, JSON.stringify(merged));
          fetch('/api/erp/configs/salvar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chave: userKey,
              empresa_id: activeEmpId,
              valor_json: merged
            })
          }).catch(() => {});
        }
      }
    },
    [applyAccentTheme, currentUser, selectedEmpresaId, portalEmpresaAtiva?.id, portalSubdominioInput]
  );

  const normalizarSlugEmpresa = useCallback((raw: string): string => {
    return (
      String(raw || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'empresa'
    );
  }, []);

  const detectarSubdominioNaUrl = useCallback((): string => {
    try {
      const params = new URLSearchParams(window.location.search);
      const queryEmp = params.get('empresa') || params.get('portal') || params.get('subdominio') || '';
      const host = window.location.hostname.toLowerCase();
      let hostSlug = '';
      if (host.endsWith('.nyctibi.us')) {
        const prefix = host.slice(0, -'.nyctibi.us'.length);
        if (prefix && !['www', 'api', 'bd', 'app', 'painel'].includes(prefix)) {
          hostSlug = prefix;
        }
      }
      const pathMatch = window.location.pathname.match(/^\/(?:e|portal)\/([a-zA-Z0-9-_]+)/);
      const pathSlug = pathMatch ? pathMatch[1] : '';
      return hostSlug || queryEmp || pathSlug || '';
    } catch {
      return '';
    }
  }, []);

  const carregarPortalEmpresaPorSubdominio = useCallback(
    async (slugForcado?: string) => {
      try {
        const urlSlug = detectarSubdominioNaUrl();
        const slugAlvo = slugForcado !== undefined ? slugForcado : urlSlug;
        const url = slugAlvo
          ? `/api/public/empresa-portal?subdominio=${encodeURIComponent(slugAlvo)}`
          : '/api/public/empresa-portal';

        const res = await fetch(url);
        if (!res.ok) return;
        const json = await res.json();
        if (!json?.ok) return;

        if (Number.isFinite(Number(json.brilho_fundo_padrao))) {
          const masterBrilho = clampBrightness(json.brilho_fundo_padrao);
          setAdminMasterBrightness(masterBrilho);
          try {
            localStorage.setItem('urutau_admin_master_brightness_v1', String(masterBrilho));
          } catch {}
        }

        if (Array.isArray(json.empresas_disponiveis)) {
          setPortaisDisponiveis(json.empresas_disponiveis);
        }

        if (slugAlvo && json.empresa) {
          setPortalEmpresaAtiva(json.empresa);
          setPortalSubdominioInput(json.empresa.subdominio || normalizarSlugEmpresa(json.empresa.nome));
          if (json.empresa.id) {
            setSelectedEmpresaId(Number(json.empresa.id));
          }
          if (json.empresa.brand_config) {
            handleUpdateBrandConfig(json.empresa.brand_config, false);
          }
        } else {
          setPortalEmpresaAtiva(null);
        }
      } catch {}
    },
    [detectarSubdominioNaUrl, handleUpdateBrandConfig, normalizarSlugEmpresa]
  );

  useEffect(() => {
    carregarPortalEmpresaPorSubdominio();
  }, [carregarPortalEmpresaPorSubdominio]);

  const handleRestoreSavedBrandConfig = useCallback(() => {
    const fallbackBrand: BrandIdentityConfig =
      savedPersistedBrandRef.current ||
      adminMasterBrandRef.current || {
        companyName: '',
        logoDataUrl: '',
        companyColorHex: '#10B981',
        companySecondaryHex: '#F59E0B',
        companyTertiaryHex: '#06B6D4',
        urutauBaseHex: '#10B981',
        blendRatio: 0.7,
        effectivePrimaryHex: '#10B981',
        effectivePrimaryRgb: { r: 16, g: 185, b: 129 },
        effectiveSecondaryHex: '#F59E0B',
        effectiveTertiaryHex: '#06B6D4',
        modeloTracoPreferido: 'padrao_xilogravura_olhar_marajoara'
      };
    handleUpdateBrandConfig(fallbackBrand, false);
  }, [handleUpdateBrandConfig]);

  const { nightFactor, isManual: isManualNight, setManualFactor } = useUrutauNightFactor();
  useSyncSystemFavicon(brandConfig, nightFactor);

  useEffect(() => {
    const blended = blendCompanyWithUrutau(
      brandConfig.companyColorHex || '#10B981',
      brandConfig.urutauBaseHex || '#10B981',
      brandConfig.blendRatio ?? 0.7,
      nightFactor
    );
    applyAccentTheme(blended.effectiveHex, blended.rgb);
    document.documentElement.style.setProperty('--sidebar-bg-top', blended.sidebarBgTop);
    document.documentElement.style.setProperty('--sidebar-bg-bottom', blended.sidebarBgBottom);
  }, [
    brandConfig.companyColorHex,
    brandConfig.urutauBaseHex,
    brandConfig.blendRatio,
    nightFactor,
    applyAccentTheme
  ]);

  const [dialog, setDialog] = useState<SystemDialogState>({
    open: false,
    type: 'info',
    title: '',
    message: ''
  });

  const showAlert = useCallback(
    (title: string, message: string, technicalDetails?: string) => {
      setDialog({
        open: true,
        type: technicalDetails ? 'error' : 'info',
        title,
        message,
        technicalDetails
      });
    },
    []
  );

  const showConfirm = useCallback(
    (title: string, message: string, onConfirm: () => void) => {
      setDialog({
        open: true,
        type: 'confirm',
        title,
        message,
        onConfirm
      });
    },
    []
  );

  const [menuPosition, setMenuPosition] = useState<'left' | 'bottom'>('left');
  const [menuVisualMode, setMenuVisualMode] = useState<'grid' | 'dock' | 'compact'>('dock');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [sidebarWidth, setSidebarWidth] = useState<number>(264);
  const [isResizingSidebar, setIsResizingSidebar] = useState<boolean>(false);

  const normalizeUnifiedCategories = useCallback((rawCats: NavCategory[]): NavCategory[] => {
    if (!Array.isArray(rawCats) || rawCats.length === 0) return DEFAULT_CATEGORIES;
    const cleaned: NavCategory[] = rawCats
      .map((c) => {
        const defMatch = DEFAULT_CATEGORIES.find((d) => d.id === c.id);
        const rawTitle = String(c.titulo || defMatch?.titulo || '').replace(/^\d+\.\s*/, '').trim();
        return {
          ...c,
          titulo: rawTitle || defMatch?.titulo || 'Grupo',
          corSimbolo: c.corSimbolo || defMatch?.corSimbolo || '#10B981',
          abas: (c.abas || []).filter(
            (t) =>
              t !== 'rateio' &&
              t !== 'compras' &&
              t !== 'empresas' &&
              t !== 'freelancers' &&
              t !== 'selecao'
          )
        };
      })
      .filter((c) => c.abas.length > 0);

    if (cleaned.length === 0) return DEFAULT_CATEGORIES;

    DEFAULT_CATEGORIES.forEach((defCat) => {
      defCat.abas.forEach((reqTab) => {
        const alreadyExists = cleaned.some((c) => c.abas.includes(reqTab));
        if (!alreadyExists) {
          const targetCat =
            cleaned.find((c) => c.id === defCat.id) || cleaned[cleaned.length - 1];
          if (reqTab === 'home') {
            targetCat.abas = ['home', ...targetCat.abas.filter((x) => x !== 'home')];
          } else {
            targetCat.abas = [...targetCat.abas, reqTab];
          }
        }
      });
    });

    return cleaned;
  }, []);

  const [categories, setCategories] = useState<NavCategory[]>(() => {
    try {
      localStorage.removeItem('urutau_nav_categories_v2');
      localStorage.removeItem('urutau_nav_categories_v8');
      localStorage.removeItem('urutau_nav_categories_v9');
      localStorage.removeItem('urutau_nav_categories_v10');
      const saved = localStorage.getItem('urutau_nav_categories_v11');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return normalizeUnifiedCategories(parsed);
        }
      }
    } catch {}
    return DEFAULT_CATEGORIES;
  });

  const [tabOverrides, setTabOverrides] = useState<Record<string, CustomTabOverride>>(() => {
    try {
      localStorage.removeItem('urutau_tab_overrides_v1');
      const saved = localStorage.getItem('urutau_tab_overrides_v8');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const handleUpdateCategories = useCallback(
    (nextCats: NavCategory[]) => {
      const cleanNext = nextCats.map((c) => ({
        ...c,
        titulo: String(c.titulo || '').replace(/^\d+\.\s*/, '').trim()
      }));
      setCategories(cleanNext);
      if (isSuperAdminUser(currentUser)) {
        adminMasterCategoriesRef.current = cleanNext;
        localStorage.setItem('urutau_nav_categories_v9', JSON.stringify(cleanNext));
        fetch('/api/erp/configs/salvar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chave: 'menu_categorias_personalizadas_v9',
            valor_json: cleanNext
          })
        }).catch(() => {});
      } else if (currentUser?.id) {
        const userKey = `personalizacao_usuario_${currentUser.id}`;
        const existingRaw = localStorage.getItem(`urutau_user_custom_${currentUser.id}`);
        const existingObj = existingRaw ? JSON.parse(existingRaw) : {};
        const merged = { ...existingObj, categories: cleanNext, updatedAt: new Date().toISOString() };
        localStorage.setItem(`urutau_user_custom_${currentUser.id}`, JSON.stringify(merged));
        fetch('/api/erp/configs/salvar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chave: userKey,
            valor_json: merged
          })
        }).catch(() => {});
      }
    },
    [currentUser]
  );

  const handleUpdateTabOverrides = useCallback(
    (nextOverrides: Record<string, CustomTabOverride>) => {
      setTabOverrides(nextOverrides);
      if (isSuperAdminUser(currentUser)) {
        adminMasterOverridesRef.current = nextOverrides;
        localStorage.setItem('urutau_tab_overrides_v8', JSON.stringify(nextOverrides));
        fetch('/api/erp/configs/salvar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chave: 'menu_abas_overrides_v8',
            valor_json: nextOverrides
          })
        }).catch(() => {});
      } else if (currentUser?.id) {
        const userKey = `personalizacao_usuario_${currentUser.id}`;
        const existingRaw = localStorage.getItem(`urutau_user_custom_${currentUser.id}`);
        const existingObj = existingRaw ? JSON.parse(existingRaw) : {};
        const merged = { ...existingObj, tabOverrides: nextOverrides, updatedAt: new Date().toISOString() };
        localStorage.setItem(`urutau_user_custom_${currentUser.id}`, JSON.stringify(merged));
        fetch('/api/erp/configs/salvar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chave: userKey,
            valor_json: merged
          })
        }).catch(() => {});
      }
    },
    [currentUser]
  );

  const [openCategoryId, setOpenCategoryId] = useState<string>('operacao_escalas');
  const [expandAllCategories, setExpandAllCategories] = useState<boolean>(true);
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('urutau_collapsed_categories_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const initialLayoutSyncedRef = useRef<boolean>(false);
  const [customizeMenuMode, setCustomizeMenuMode] = useState<boolean>(false);
  const [draggedTab, setDraggedTab] = useState<{ tabId: TabId; fromCatId: string } | null>(null);
  const [draggedCatId, setDraggedCatId] = useState<string | null>(null);
  const draggedTabRef = useRef<{ tabId: TabId; fromCatId: string } | null>(null);
  const draggedCatIdRef = useRef<string | null>(null);
  const [dragOverCatId, setDragOverCatId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<TabId | null>(null);
  const [inlineEditingTabId, setInlineEditingTabId] = useState<TabId | null>(null);
  const [inlineEditingCatId, setInlineEditingCatId] = useState<string | null>(null);
  const [inlineNewGroupName, setInlineNewGroupName] = useState<string>('');
  const [showNewGroupInline, setShowNewGroupInline] = useState<boolean>(false);
  const holdTimerRef = useRef<any>(null);
  const holdTriggeredRef = useRef<boolean>(false);
  const touchStartPosRef = useRef<{ x: number; y: number; tabId?: TabId; fromCatId?: string; catId?: string } | null>(null);
  const touchDraggingActiveRef = useRef<boolean>(false);

  const handleToggleCategoryCollapse = useCallback((catId: string) => {
    setCollapsedCategoryIds((prev) => {
      const isCollapsed = prev.includes(catId);
      const next = isCollapsed ? prev.filter((id) => id !== catId) : [...prev, catId];
      try {
        localStorage.setItem('urutau_collapsed_categories_v1', JSON.stringify(next));
      } catch {}
      setExpandAllCategories(next.length === 0);
      return next;
    });
  }, []);

  const handleToggleAllCategories = useCallback(() => {
    setCollapsedCategoryIds((prev) => {
      const allIds = categories.map((c) => c.id);
      const shouldCollapseAll = prev.length < allIds.length;
      const next = shouldCollapseAll ? allIds : [];
      try {
        localStorage.setItem('urutau_collapsed_categories_v1', JSON.stringify(next));
      } catch {}
      setExpandAllCategories(!shouldCollapseAll);
      return next;
    });
  }, [categories]);

  const handleUpdateMenuLayout = useCallback(
    (patch: Partial<{
      menuPosition: 'left' | 'bottom';
      menuVisualMode: 'grid' | 'dock' | 'compact';
      expandAllCategories: boolean;
      sidebarWidth: number;
    }>) => {
      const nextLayout = {
        menuPosition: patch.menuPosition ?? menuPosition,
        menuVisualMode: 'dock' as const,
        expandAllCategories: patch.expandAllCategories ?? expandAllCategories,
        sidebarWidth: patch.sidebarWidth ?? sidebarWidth
      };
      if (patch.menuPosition !== undefined) setMenuPosition(patch.menuPosition);
      setMenuVisualMode('dock');
      if (patch.expandAllCategories !== undefined) {
        setExpandAllCategories(patch.expandAllCategories);
        const nextCollapsed = patch.expandAllCategories ? [] : categories.map((c) => c.id);
        setCollapsedCategoryIds(nextCollapsed);
        try {
          localStorage.setItem('urutau_collapsed_categories_v1', JSON.stringify(nextCollapsed));
        } catch {}
      }
      if (patch.sidebarWidth !== undefined) setSidebarWidth(patch.sidebarWidth);

      if (isSuperAdminUser(currentUser)) {
        adminMasterLayoutRef.current = nextLayout;
        fetch('/api/erp/configs/salvar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chave: 'layout_modo_menu_padrao',
            valor_json: nextLayout
          })
        }).catch(() => {});
      } else if (currentUser?.id) {
        const userKey = `personalizacao_usuario_${currentUser.id}`;
        const existingRaw = localStorage.getItem(`urutau_user_custom_${currentUser.id}`);
        const existingObj = existingRaw ? JSON.parse(existingRaw) : {};
        const merged = { ...existingObj, layout: nextLayout, updatedAt: new Date().toISOString() };
        localStorage.setItem(`urutau_user_custom_${currentUser.id}`, JSON.stringify(merged));
        fetch('/api/erp/configs/salvar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chave: userKey,
            valor_json: merged
          })
        }).catch(() => {});
      }
    },
    [categories, currentUser, menuPosition, menuVisualMode, expandAllCategories, sidebarWidth]
  );

  const handleResetMenusPadrao = useCallback(() => {
    setInlineEditingTabId(null);
    setInlineEditingCatId(null);
    setOpenCategoryId('operacao_escalas');
    setCollapsedCategoryIds([]);
    try {
      localStorage.removeItem('urutau_collapsed_categories_v1');
    } catch {}

    if (isSuperAdminUser(currentUser)) {
      adminMasterCategoriesRef.current = DEFAULT_CATEGORIES;
      adminMasterOverridesRef.current = {};
      setCategories(DEFAULT_CATEGORIES);
      setTabOverrides({});
      setExpandAllCategories(true);
      localStorage.removeItem('urutau_nav_categories_v2');
      localStorage.removeItem('urutau_nav_categories_v8');
      localStorage.removeItem('urutau_tab_overrides_v1');
      localStorage.setItem('urutau_nav_categories_v9', JSON.stringify(DEFAULT_CATEGORIES));
      localStorage.setItem('urutau_tab_overrides_v8', JSON.stringify({}));
      fetch('/api/erp/configs/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chave: 'menu_categorias_personalizadas_v9',
          valor_json: DEFAULT_CATEGORIES
        })
      }).catch(() => {});
      fetch('/api/erp/configs/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chave: 'menu_abas_overrides_v8',
          valor_json: {}
        })
      }).catch(() => {});
    } else {
      const masterCats = adminMasterCategoriesRef.current || DEFAULT_CATEGORIES;
      const masterOverrides = adminMasterOverridesRef.current || {};
      const masterLayout = adminMasterLayoutRef.current;
      setCategories(masterCats);
      setTabOverrides(masterOverrides);
      setMenuPosition(masterLayout.menuPosition);
      setMenuVisualMode('dock');
      setExpandAllCategories(masterLayout.expandAllCategories);
      if (adminMasterBrandRef.current) {
        handleUpdateBrandConfig(adminMasterBrandRef.current, false);
      }
      setUserBrightnessOverride(null);
      if (currentUser?.id) {
        localStorage.removeItem(`urutau_user_custom_${currentUser.id}`);
        fetch('/api/erp/configs/salvar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chave: `personalizacao_usuario_${currentUser.id}`,
            valor_json: null
          })
        }).catch(() => {});
      }
    }
  }, [currentUser, handleUpdateBrandConfig]);

  const cancelHoldTimer = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const startHoldOnTab = useCallback(
    (tabId: TabId, fromCatId?: string, touchEvent?: React.TouchEvent) => {
      cancelHoldTimer();
      holdTriggeredRef.current = false;
      touchDraggingActiveRef.current = false;
      if (touchEvent && touchEvent.touches[0]) {
        touchStartPosRef.current = {
          x: touchEvent.touches[0].clientX,
          y: touchEvent.touches[0].clientY,
          tabId,
          fromCatId
        };
      }
      holdTimerRef.current = setTimeout(() => {
        if (touchDraggingActiveRef.current) return;
        holdTriggeredRef.current = true;
        setInlineEditingTabId((prev) => (prev === tabId ? null : tabId));
        setInlineEditingCatId(null);
      }, 650);
    },
    [cancelHoldTimer]
  );

  const startHoldOnCategory = useCallback(
    (catId: string, touchEvent?: React.TouchEvent) => {
      cancelHoldTimer();
      holdTriggeredRef.current = false;
      touchDraggingActiveRef.current = false;
      if (touchEvent && touchEvent.touches[0]) {
        touchStartPosRef.current = {
          x: touchEvent.touches[0].clientX,
          y: touchEvent.touches[0].clientY,
          catId
        };
      }
      holdTimerRef.current = setTimeout(() => {
        if (touchDraggingActiveRef.current) return;
        holdTriggeredRef.current = true;
        setInlineEditingCatId((prev) => (prev === catId ? null : catId));
        setInlineEditingTabId(null);
      }, 650);
    },
    [cancelHoldTimer]
  );

  const handleInlineUpdateTabOverride = useCallback(
    (tabId: TabId, partial: Partial<CustomTabOverride>) => {
      const current = tabOverrides[tabId] || {};
      const next = {
        ...tabOverrides,
        [tabId]: {
          ...current,
          ...partial
        }
      };
      handleUpdateTabOverrides(next);
    },
    [tabOverrides, handleUpdateTabOverrides]
  );

  const handleInlineRenameCategory = useCallback(
    (catId: string, novoTitulo: string) => {
      const next = categories.map((c) => (c.id === catId ? { ...c, titulo: novoTitulo } : c));
      handleUpdateCategories(next);
    },
    [categories, handleUpdateCategories]
  );

  const handleInlineUpdateCategoryColor = useCallback(
    (catId: string, corSimbolo: string) => {
      const next = categories.map((c) => (c.id === catId ? { ...c, corSimbolo } : c));
      handleUpdateCategories(next);
    },
    [categories, handleUpdateCategories]
  );

  const handleMoveTabWithinGroup = useCallback(
    (catId: string, tabId: TabId, dir: -1 | 1) => {
      const next = categories.map((c) => {
        if (c.id !== catId) return c;
        const idx = c.abas.indexOf(tabId);
        const targetIdx = idx + dir;
        if (idx < 0 || targetIdx < 0 || targetIdx >= c.abas.length) return c;
        const copy = [...c.abas];
        const [moved] = copy.splice(idx, 1);
        copy.splice(targetIdx, 0, moved);
        return { ...c, abas: copy };
      });
      handleUpdateCategories(next);
    },
    [categories, handleUpdateCategories]
  );

  const handleMoveCategoryOrder = useCallback(
    (catId: string, dir: -1 | 1) => {
      const idx = categories.findIndex((c) => c.id === catId);
      const targetIdx = idx + dir;
      if (idx < 0 || targetIdx < 0 || targetIdx >= categories.length) return;
      const copy = [...categories];
      const [moved] = copy.splice(idx, 1);
      copy.splice(targetIdx, 0, moved);
      handleUpdateCategories(copy);
    },
    [categories, handleUpdateCategories]
  );

  const handleInlineCreateGroup = useCallback(() => {
    const trimmed = inlineNewGroupName.trim();
    if (!trimmed) return;
    const slug =
      trimmed
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_') +
      '_' +
      Date.now().toString().slice(-3);
    const next = [...categories, { id: slug, titulo: trimmed, corSimbolo: '#10B981', abas: [] }];
    handleUpdateCategories(next);
    setInlineNewGroupName('');
    setShowNewGroupInline(false);
    setOpenCategoryId(slug);
  }, [inlineNewGroupName, categories, handleUpdateCategories]);

  const handleInlineDeleteEmptyGroup = useCallback(
    (catId: string) => {
      const target = categories.find((c) => c.id === catId);
      if (!target || target.abas.length > 0) return;
      handleUpdateCategories(categories.filter((c) => c.id !== catId));
      setInlineEditingCatId(null);
    },
    [categories, handleUpdateCategories]
  );

  const startHtml5TabDrag = useCallback(
    (e: React.DragEvent, tabId: TabId, fromCatId: string) => {
      e.stopPropagation();
      cancelHoldTimer();
      const payload = { tabId, fromCatId };
      draggedTabRef.current = payload;
      draggedCatIdRef.current = null;
      try {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', `${fromCatId}:${tabId}`);
      } catch {}
      requestAnimationFrame(() => {
        setDraggedTab(payload);
      });
    },
    [cancelHoldTimer]
  );

  const startHtml5CatDrag = useCallback(
    (e: React.DragEvent, catId: string) => {
      e.stopPropagation();
      cancelHoldTimer();
      draggedCatIdRef.current = catId;
      draggedTabRef.current = null;
      try {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', `cat:${catId}`);
      } catch {}
      requestAnimationFrame(() => {
        setDraggedCatId(catId);
      });
    },
    [cancelHoldTimer]
  );

  const clearHtml5DragState = useCallback(() => {
    draggedTabRef.current = null;
    draggedCatIdRef.current = null;
    setDraggedTab(null);
    setDraggedCatId(null);
    setDragOverTabId(null);
    setDragOverCatId(null);
  }, []);

  const handleDropOnCategoryHeader = useCallback(
    (targetCatId: string) => {
      setDragOverCatId(null);
      setDragOverTabId(null);
      const activeCatDrag = draggedCatIdRef.current || draggedCatId;
      const activeTabDrag = draggedTabRef.current || draggedTab;
      if (activeCatDrag && activeCatDrag !== targetCatId) {
        const fromIdx = categories.findIndex((c) => c.id === activeCatDrag);
        const toIdx = categories.findIndex((c) => c.id === targetCatId);
        if (fromIdx >= 0 && toIdx >= 0) {
          const clone = [...categories];
          const [moved] = clone.splice(fromIdx, 1);
          clone.splice(toIdx, 0, moved);
          handleUpdateCategories(clone);
        }
        clearHtml5DragState();
        return;
      }
      if (activeTabDrag) {
        const { tabId, fromCatId } = activeTabDrag;
        if (fromCatId === targetCatId) {
          clearHtml5DragState();
          return;
        }
        const next = categories.map((c) => {
          const semItem = c.abas.filter((t) => t !== tabId);
          if (c.id === targetCatId) {
            return { ...c, abas: [...semItem, tabId] };
          }
          return { ...c, abas: semItem };
        });
        handleUpdateCategories(next);
        setOpenCategoryId(targetCatId);
        clearHtml5DragState();
      }
    },
    [draggedCatId, draggedTab, categories, handleUpdateCategories, clearHtml5DragState]
  );

  const handleDropOnTabItem = useCallback(
    (targetCatId: string, targetTabId: TabId) => {
      setDragOverCatId(null);
      setDragOverTabId(null);
      const activeTabDrag = draggedTabRef.current || draggedTab;
      if (!activeTabDrag) return;
      const { tabId } = activeTabDrag;
      if (tabId === targetTabId) {
        clearHtml5DragState();
        return;
      }
      const next = categories.map((c) => {
        const semItem = c.abas.filter((t) => t !== tabId);
        if (c.id === targetCatId) {
          const targetIdx = semItem.indexOf(targetTabId);
          if (targetIdx >= 0) {
            const copy = [...semItem];
            copy.splice(targetIdx, 0, tabId);
            return { ...c, abas: copy };
          }
          return { ...c, abas: [...semItem, tabId] };
        }
        return { ...c, abas: semItem };
      });
      handleUpdateCategories(next);
      clearHtml5DragState();
    },
    [draggedTab, categories, handleUpdateCategories, clearHtml5DragState]
  );

  const handleTouchMoveDrag = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      const start = touchStartPosRef.current;
      if (!touchDraggingActiveRef.current && start) {
        const dist = Math.hypot(touch.clientX - start.x, touch.clientY - start.y);
        if (dist > 14) {
          cancelHoldTimer();
          touchDraggingActiveRef.current = true;
          if (start.tabId && start.fromCatId) {
            const payload = { tabId: start.tabId, fromCatId: start.fromCatId };
            draggedTabRef.current = payload;
            setDraggedTab(payload);
          } else if (start.catId) {
            draggedCatIdRef.current = start.catId;
            setDraggedCatId(start.catId);
          }
        }
      }
      if (!touchDraggingActiveRef.current && !draggedTabRef.current && !draggedCatIdRef.current) return;

      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      if (!el) return;
      const tabTarget = el.closest('[data-drop-tab-id]') as HTMLElement | null;
      const catTarget = el.closest('[data-drop-cat-id]') as HTMLElement | null;
      if (tabTarget) {
        const tId = tabTarget.getAttribute('data-drop-tab-id') as TabId;
        const cId = tabTarget.getAttribute('data-drop-tab-cat') || '';
        setDragOverTabId(tId);
        setDragOverCatId(cId || null);
      } else if (catTarget) {
        const cId = catTarget.getAttribute('data-drop-cat-id') || '';
        setDragOverCatId(cId);
        setDragOverTabId(null);
      } else {
        setDragOverTabId(null);
        setDragOverCatId(null);
      }
    },
    [cancelHoldTimer]
  );

  const handleTouchEndDrag = useCallback(() => {
    cancelHoldTimer();
    if (touchDraggingActiveRef.current || draggedTabRef.current || draggedCatIdRef.current || draggedTab || draggedCatId) {
      if (dragOverTabId && dragOverCatId) {
        handleDropOnTabItem(dragOverCatId, dragOverTabId);
      } else if (dragOverCatId) {
        handleDropOnCategoryHeader(dragOverCatId);
      }
      clearHtml5DragState();
      setTimeout(() => {
        touchDraggingActiveRef.current = false;
        touchStartPosRef.current = null;
      }, 60);
    } else {
      touchStartPosRef.current = null;
    }
  }, [
    cancelHoldTimer,
    draggedTab,
    draggedCatId,
    dragOverTabId,
    dragOverCatId,
    handleDropOnTabItem,
    handleDropOnCategoryHeader,
    clearHtml5DragState
  ]);

  const mainViewportRef = useRef<HTMLDivElement>(null);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const bottomBarScrollRef = useRef<HTMLDivElement>(null);
  const tabScrollMemoryRef = useRef<Record<string, number>>({});
  const sidebarScrollPosRef = useRef<number>(0);

  const [quickMsgOpen, setQuickMsgOpen] = useState<boolean>(false);
  const [copiedQuickToast, setCopiedQuickToast] = useState<string | null>(null);

  const [sseEvents, setSseEvents] = useState<
    { id: string; evento: string; ts: string; payload: any }[]
  >([]);
  const [ssePulseActive, setSsePulseActive] = useState<boolean>(false);

  const [securityGeofenceConfig, setSecurityGeofenceConfig] = useState<SecurityGeofenceTurnoConfig>(() => {
    try {
      const saved = localStorage.getItem('urutau_security_geofence_v1');
      if (saved) return { ...DEFAULT_SECURITY_GEOFENCE_TURNO_CONFIG, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_SECURITY_GEOFENCE_TURNO_CONFIG;
  });

  const [userGpsLocation, setUserGpsLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
    simulated: boolean;
    label: string;
  }>({
    latitude: DEFAULT_SECURITY_GEOFENCE_TURNO_CONFIG.empresaLatitude,
    longitude: DEFAULT_SECURITY_GEOFENCE_TURNO_CONFIG.empresaLongitude,
    accuracy: 8,
    simulated: false,
    label: 'Sede da Empresa (Belém - PA)'
  });

  const [simulatedShiftMode, setSimulatedShiftMode] = useState<'auto' | 'em_turno' | 'fora_turno'>('auto');

  const handleUpdateSecurityGeofenceConfig = useCallback((nextCfg: SecurityGeofenceTurnoConfig) => {
    setSecurityGeofenceConfig(nextCfg);
    localStorage.setItem('urutau_security_geofence_v1', JSON.stringify(nextCfg));
    fetch('/api/erp/configs/salvar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chave: 'regras_seguranca_geofence_turno',
        valor_json: nextCfg
      })
    }).catch(() => {});
  }, []);

  const calcularDistanciaMetrosHaversine = useCallback(
    (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371000;
      const toRad = (deg: number) => (deg * Math.PI) / 180;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return Math.round(R * c);
    },
    []
  );

  const avaliacaoGpsCoerente = React.useMemo(() => {
    const distBase = calcularDistanciaMetrosHaversine(
      userGpsLocation.latitude,
      userGpsLocation.longitude,
      securityGeofenceConfig.empresaLatitude,
      securityGeofenceConfig.empresaLongitude
    );
    const raioBase = Math.max(15, Number(securityGeofenceConfig.raioPermitidoMetros || 150));
    let menorDistancia = distBase;
    let dentroDeAlgumaUnidade = distBase <= raioBase;
    let nomeUnidadeMaisProxima = securityGeofenceConfig.empresaNomeReferencia || 'Sede Principal';

    const listaUnidades = erpData?.unidades || [];
    for (const u of listaUnidades) {
      const uLat = Number((u as any).latitude);
      const uLng = Number((u as any).longitude);
      if (Number.isFinite(uLat) && Number.isFinite(uLng) && (uLat !== 0 || uLng !== 0)) {
        const dUnidade = calcularDistanciaMetrosHaversine(
          userGpsLocation.latitude,
          userGpsLocation.longitude,
          uLat,
          uLng
        );
        const rUnidade = Math.max(20, Number((u as any).raio_metros || raioBase));
        if (dUnidade <= rUnidade) {
          dentroDeAlgumaUnidade = true;
        }
        if (dUnidade < menorDistancia) {
          menorDistancia = dUnidade;
          nomeUnidadeMaisProxima = u.nome || nomeUnidadeMaisProxima;
        }
      }
    }

    return {
      distanciaMetros: menorDistancia,
      dentroDaEmpresa: dentroDeAlgumaUnidade,
      unidadeReferencia: nomeUnidadeMaisProxima
    };
  }, [
    calcularDistanciaMetrosHaversine,
    userGpsLocation.latitude,
    userGpsLocation.longitude,
    securityGeofenceConfig.empresaLatitude,
    securityGeofenceConfig.empresaLongitude,
    securityGeofenceConfig.raioPermitidoMetros,
    securityGeofenceConfig.empresaNomeReferencia,
    erpData?.unidades
  ]);

  const distanciaEmpresaMetros = avaliacaoGpsCoerente.distanciaMetros;
  const usuarioDentroDaEmpresa = avaliacaoGpsCoerente.dentroDaEmpresa;

  const handleCalibrateGpsToCoords = useCallback((lat: number, lng: number, label: string) => {
    setUserGpsLocation({
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lng.toFixed(6)),
      accuracy: 5,
      simulated: true,
      label: label || 'Posição Calibrada na Unidade'
    });
  }, []);

  const verificarUsuarioEmTurno = useCallback(
    (userAlvo: any): boolean => {
      if (simulatedShiftMode === 'em_turno') return true;
      if (simulatedShiftMode === 'fora_turno') return false;
      const agora = new Date();
      const diaHoje = agora.getDay();
      if (erpData?.escalaFixa && userAlvo?.id) {
        const diasEscala = erpData.escalaFixa[userAlvo.id];
        if (Array.isArray(diasEscala) && diasEscala.length > 0 && !diasEscala.includes(diaHoje)) {
          return false;
        }
      }
      const [hIni, mIni] = String(securityGeofenceConfig.horarioInicioTurnoPadrao || '08:00')
        .split(':')
        .map(Number);
      const [hFim, mFim] = String(securityGeofenceConfig.horarioFimTurnoPadrao || '23:30')
        .split(':')
        .map(Number);
      const minAgora = agora.getHours() * 60 + agora.getMinutes();
      const minIni = (hIni || 0) * 60 + (mIni || 0);
      const minFim = (hFim || 23) * 60 + (mFim || 59);
      if (minIni <= minFim) {
        return minAgora >= minIni && minAgora <= minFim;
      }
      return minAgora >= minIni || minAgora <= minFim;
    },
    [simulatedShiftMode, erpData?.escalaFixa, securityGeofenceConfig]
  );

  const usuarioEmTurnoAtivo = verificarUsuarioEmTurno(currentUser);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserGpsLocation((prev) => {
          if (prev.simulated) return prev;
          return {
            latitude: Number(pos.coords.latitude.toFixed(6)),
            longitude: Number(pos.coords.longitude.toFixed(6)),
            accuracy: Math.round(pos.coords.accuracy || 10),
            simulated: false,
            label: 'GPS Real do Dispositivo'
          };
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const registrarTelemetriaGpsLog = useCallback(
    (
      tipo_telemetria: 'ABERTURA_MENU' | 'CLIQUE_BOTAO' | 'EXECUCAO_SISTEMA' | 'BLOQUEIO_GEOFENCE_TURNO',
      acao: string,
      detalhes: string,
      abaRef?: string
    ) => {
      if (securityGeofenceConfig.rastrearCliquesELogsNoMapa === false) return;
      if (!isUserAuthenticated || isSessionLocked || !offlineSyncEngine.getSessionToken()) return;
      const jitterLat = userGpsLocation.simulated ? 0 : (Math.random() - 0.5) * 0.00012;
      const jitterLng = userGpsLocation.simulated ? 0 : (Math.random() - 0.5) * 0.00012;
      const latFinal = Number((userGpsLocation.latitude + jitterLat).toFixed(6));
      const lngFinal = Number((userGpsLocation.longitude + jitterLng).toFixed(6));

      fetch('/api/erp/telemetria-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario: currentUser?.nome || 'Operador',
          usuario_id: currentUser?.id || 1,
          cargo: currentUser?.cargo || currentUser?.tipo || 'Operacional',
          acao,
          detalhes,
          tipo_telemetria,
          aba: abaRef || activeTab,
          latitude: latFinal,
          longitude: lngFinal,
          precisao_metros: userGpsLocation.accuracy || 10,
          distancia_empresa_m: distanciaEmpresaMetros,
          dentro_empresa: usuarioDentroDaEmpresa,
          em_turno: usuarioEmTurnoAtivo,
          dispositivo: window.innerWidth < 768 ? 'Mobile PWA' : 'Desktop Web'
        })
      }).catch(() => {});
    },
    [
      securityGeofenceConfig.rastrearCliquesELogsNoMapa,
      isUserAuthenticated,
      isSessionLocked,
      userGpsLocation,
      currentUser,
      activeTab,
      distanciaEmpresaMetros,
      usuarioDentroDaEmpresa,
      usuarioEmTurnoAtivo
    ]
  );

  const lastClickLogRef = useRef<number>(0);
  useEffect(() => {
    const handleGlobalSystemClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (
        target.closest('[data-urutau-custom-select-popover="true"]') ||
        target.closest('select')
      ) {
        return;
      }
      const interactive = target.closest('button, a, [role="button"], input[type="submit"]') as HTMLElement | null;
      if (!interactive) return;
      const now = Date.now();
      if (now - lastClickLogRef.current < 1200) return;
      lastClickLogRef.current = now;

      const labelRaw =
        interactive.getAttribute('title') ||
        interactive.getAttribute('aria-label') ||
        interactive.innerText ||
        'Ação';
      const cleanLabel = String(labelRaw).replace(/\s+/g, ' ').trim().slice(0, 65);
      if (!cleanLabel) return;

      const isExec =
        /salvar|gravar|confirmar|criar|aprovar|fechar|atualizar|enviar|ativar|sincronizar/i.test(
          cleanLabel
        );
      registrarTelemetriaGpsLog(
        isExec ? 'EXECUCAO_SISTEMA' : 'CLIQUE_BOTAO',
        isExec ? 'EXECUCAO_SISTEMA' : 'CLIQUE_BOTAO',
        `${isExec ? 'Execução' : 'Clique'} em "${cleanLabel}" na aba [${activeTab}] (${
          usuarioDentroDaEmpresa ? `Dentro da empresa • ${distanciaEmpresaMetros}m` : `Fora da empresa • ${distanciaEmpresaMetros}m`
        })`,
        activeTab
      );
    };

    window.addEventListener('click', handleGlobalSystemClick, { capture: true, passive: true });
    return () => window.removeEventListener('click', handleGlobalSystemClick, { capture: true });
  }, [activeTab, registrarTelemetriaGpsLog, usuarioDentroDaEmpresa, distanciaEmpresaMetros]);

  const fetchAllData = useCallback(async () => {
    try {
      const hasSignedToken = Boolean(offlineSyncEngine.getSessionToken());
      if (!isUserAuthenticated || isSessionLocked || !hasSignedToken) {
        let pubEmpresas: any[] = [];
        let pubConfigs: any[] = [];
        try {
          const pubRes = await fetch('/api/public/bootstrap-branding', {
            signal: AbortSignal.timeout(3500)
          });
          if (pubRes.ok) {
            const pubJson = await pubRes.json();
            pubEmpresas = Array.isArray(pubJson?.empresas) ? pubJson.empresas : [];
            pubConfigs = Array.isArray(pubJson?.configs) ? pubJson.configs : [];
            const cfgBrilhoPub = pubConfigs.find(
              (c: any) => c.chave === 'brilho_fundo_padrao' || c.chave === 'brilho_padrao_admin_master_v1'
            )?.valor_json;
            if (cfgBrilhoPub && Number.isFinite(Number(cfgBrilhoPub.brilho))) {
              const masterB = clampBrightness(cfgBrilhoPub.brilho);
              setAdminMasterBrightness(masterB);
              try {
                localStorage.setItem('urutau_admin_master_brightness_v1', String(masterB));
              } catch {}
            }
            const cfgBrandPub =
              pubConfigs.find((c: any) => c.chave === 'identidade_visual_empresa')?.valor_json ||
              pubConfigs.find((c: any) => String(c?.chave || '').startsWith('identidade_visual_empresa_'))?.valor_json ||
              pubEmpresas[0]?.brand_config ||
              null;
            if (cfgBrandPub) {
              adminMasterBrandRef.current = cfgBrandPub;
              setBrandConfig((prev) =>
                prev.logoDataUrl || prev.slotCustomizations ? prev : { ...prev, ...cfgBrandPub }
              );
            }
          }
        } catch {}
        setErpData((prev) => prev || buildPublicBootstrapErpData(pubEmpresas, pubConfigs));
        return;
      }

      const res = await offlineSyncEngine.fetchWithOfflineSupport('/api/erp/dados-completos');
      if (res.status === 401 || res.status === 403) {
        offlineSyncEngine.setSessionToken('');
        try {
          const rawSaved = localStorage.getItem('urutau_active_user_session_v2');
          if (rawSaved) {
            const parsedSaved = JSON.parse(rawSaved);
            localStorage.setItem(
              'urutau_active_user_session_v2',
              JSON.stringify({
                user: parsedSaved?.user || null,
                empresaId: parsedSaved?.empresaId || null,
                sessaoToken: ''
              })
            );
          }
        } catch {}
        setSessionVerifiedByServer(false);
        setIsUserAuthenticated(false);
        setIsSessionLocked(true);
        setErpData(buildPublicBootstrapErpData([], []));
        return;
      }
      if (!res.ok) throw new Error('Falha ao sincronizar dados');
      const json: ERPCompleteData = await res.json();
      setErpData(json);
      setSessionVerifiedByServer(true);

      const empAtivaId = Number(selectedEmpresaId || currentUser?.empresas_ids?.[0] || 1);
      const empAtivaObj = (json.empresas || []).find((e: any) => Number(e.id) === empAtivaId);
      const cfgEmpAtiva: any = empAtivaObj?.lgpd_custodia_config || {};
      const pendFechamento = cfgEmpAtiva?.estado_fechamento_local || null;
      const driveConectadoEmp = Boolean(
        (cfgEmpAtiva.pasta_google_drive_id && String(cfgEmpAtiva.pasta_google_drive_id).trim().length > 0) ||
          (cfgEmpAtiva.planilha_google_id && String(cfgEmpAtiva.planilha_google_id).trim().length > 0) ||
          (cfgEmpAtiva.apps_script_webhook_url && String(cfgEmpAtiva.apps_script_webhook_url).startsWith('https://')) ||
          (cfgEmpAtiva.conta_google_vinculada && String(cfgEmpAtiva.conta_google_vinculada).includes('@'))
      );
      setEstadoFechamentoLocal(driveConectadoEmp ? null : pendFechamento);

      if (cfgEmpAtiva?.zero_guarda_operacional_vps === true) {
        const matchEmp = (r: any) => Number(r?.empresa_id ?? r?.id_empresa ?? 0) === empAtivaId;
        const totalEmRam =
          (json.reservas || []).filter(matchEmp).length +
          (json.movimentosEscala || []).filter(matchEmp).length +
          (json.caixa || []).filter(matchEmp).length +
          (json.estoque || []).filter(matchEmp).length;

        const bloqueadoPorOutroPc = Boolean(
          !driveConectadoEmp &&
            pendFechamento?.aguardando_primeiro_pc &&
            pendFechamento?.ultimo_pc_id &&
            pendFechamento.ultimo_pc_id !== meuPcId
        );

        let dadosAtrasadosLocais: any = null;
        try {
          const rawAtrasado = localStorage.getItem(`urutau_pacote_atrasado_empresa_${empAtivaId}`);
          if (rawAtrasado) {
            const parsedAtr = JSON.parse(rawAtrasado);
            if (parsedAtr?.pacote && contarRegistrosPacote(parsedAtr.pacote) > 0) {
              dadosAtrasadosLocais = parsedAtr;
            }
          }
        } catch {}

        if (totalEmRam > 0) {
          if (dadosAtrasadosLocais) {
            if (isUserAuthenticated && !isSessionLocked) {
              setPacoteAtrasadoPendente({
                ...dadosAtrasadosLocais,
                total_registros_atrasados: contarRegistrosPacote(dadosAtrasadosLocais.pacote),
                total_registros_em_sessao: totalEmRam
              });
            }
          } else {
            salvarPacotePortatilLocal(empAtivaId, true);
            if (isUserAuthenticated && !isSessionLocked) {
              limparBackupsDuplicadosLocais(empAtivaId, true);
              if (pendFechamento?.aguardando_primeiro_pc && pendFechamento?.ultimo_pc_id === meuPcId) {
                fetch('/api/lgpd/vps-processador/confirmar-retorno-ultimo-pc', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ empresa_id: empAtivaId, pc_id: meuPcId })
                })
                  .then((r) => r.json())
                  .then((resConf) => {
                    if (resConf?.ok) setEstadoFechamentoLocal(resConf.estado_fechamento_local || null);
                  })
                  .catch(() => {});
              }
            }
          }
        } else if (!bloqueadoPorOutroPc && !hidratacaoEmAndamentoRef.current[empAtivaId]) {
          let hidratouViaArquivoLocal = false;
          try {
            const rawFonte =
              localStorage.getItem(`urutau_pacote_atrasado_empresa_${empAtivaId}`) ||
              localStorage.getItem(`urutau_pacote_local_empresa_${empAtivaId}`);
            if (rawFonte) {
              const parsedFonte = JSON.parse(rawFonte);
              const pacoteLocal = parsedFonte?.pacote ? parsedFonte.pacote : parsedFonte;
              const totalLocal = contarRegistrosPacote(pacoteLocal);
              if (totalLocal > 0) {
                hidratouViaArquivoLocal = true;
                hidratacaoEmAndamentoRef.current[empAtivaId] = true;
                fetch('/api/lgpd/vps-processador/hidratar-sessao', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    empresa_id: empAtivaId,
                    pacote_portatil: pacoteLocal,
                    pc_id: meuPcId
                  })
                })
                  .then((r) => r.json())
                  .then((hRes) => {
                    if (hRes?.ok) {
                      setEstadoFechamentoLocal(hRes.estado_fechamento_local || null);
                      setPacoteAtrasadoPendente(null);
                      limparBackupsDuplicadosLocais(empAtivaId, true);
                      offlineSyncEngine.fetchWithOfflineSupport('/api/erp/dados-completos')
                        .then((r2) => r2.json())
                        .then((j2) => setErpData(j2))
                        .catch(() => {});
                    }
                  })
                  .catch(() => {});
              }
            }
          } catch {}

          if (
            !hidratouViaArquivoLocal &&
            isUserAuthenticated &&
            !isSessionLocked &&
            pendFechamento?.aguardando_primeiro_pc &&
            pendFechamento?.ultimo_pc_id === meuPcId
          ) {
            fetch('/api/lgpd/vps-processador/confirmar-retorno-ultimo-pc', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ empresa_id: empAtivaId, pc_id: meuPcId })
            })
              .then((r) => r.json())
              .then((resConf) => {
                if (resConf?.ok) {
                  setEstadoFechamentoLocal(resConf.estado_fechamento_local || null);
                  try {
                    localStorage.removeItem('urutau_ultimo_pc_fechou_sem_nuvem');
                    localStorage.removeItem(`urutau_pacote_atrasado_empresa_${empAtivaId}`);
                  } catch {}
                }
              })
              .catch(() => {});
          }
        }
      }

      const cfgBrand = json.configs?.find((c) => c.chave === 'identidade_visual_empresa');
      if (cfgBrand?.valor_json) {
        adminMasterBrandRef.current = cfgBrand.valor_json;
      }

      const cfgBrandPorEmpresa = json.configs?.find(
        (c) => c.chave === `identidade_visual_empresa_${empAtivaId}`
      )?.valor_json;
      const brandDaEmpresaAtiva =
        cfgBrandPorEmpresa ||
        empAtivaObj?.brand_config ||
        adminMasterBrandRef.current;

      const slugNaUrlAtual = detectarSubdominioNaUrl();
      if (empAtivaObj) {
        const slugEmp =
          empAtivaObj.subdominio ||
          String(empAtivaObj.nome || 'empresa')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        setPortalSubdominioInput(slugEmp);
        if (slugNaUrlAtual) {
          setPortalEmpresaAtiva({
            id: empAtivaObj.id,
            nome: empAtivaObj.nome,
            subdominio: slugEmp,
            link_acesso: `https://${slugEmp}.nyctibi.us`,
            brand_config: brandDaEmpresaAtiva
          });
        }
      }

      const cfgCats =
        json.configs?.find((c) => c.chave === 'menu_categorias_personalizadas_v9') ||
        json.configs?.find((c) => c.chave === 'menu_categorias_personalizadas_v8');
      if (Array.isArray(cfgCats?.valor_json) && cfgCats.valor_json.length > 0) {
        adminMasterCategoriesRef.current = normalizeUnifiedCategories(cfgCats.valor_json);
      } else {
        adminMasterCategoriesRef.current = DEFAULT_CATEGORIES;
      }

      const cfgOverrides = json.configs?.find((c) => c.chave === 'menu_abas_overrides_v8');
      if (cfgOverrides?.valor_json && typeof cfgOverrides.valor_json === 'object') {
        adminMasterOverridesRef.current = cfgOverrides.valor_json;
      } else {
        adminMasterOverridesRef.current = {};
      }

      const cfgLayout = json.configs?.find((c) => c.chave === 'layout_modo_menu_padrao');
      if (cfgLayout?.valor_json && typeof cfgLayout.valor_json === 'object') {
        adminMasterLayoutRef.current = {
          ...adminMasterLayoutRef.current,
          ...cfgLayout.valor_json
        };
      }

      const cfgBrilhoPadrao = json.configs?.find((c) => c.chave === 'brilho_fundo_padrao')?.valor_json;
      if (cfgBrilhoPadrao && Number.isFinite(Number(cfgBrilhoPadrao.brilho))) {
        const masterB = clampBrightness(cfgBrilhoPadrao.brilho);
        setAdminMasterBrightness(masterB);
        try {
          localStorage.setItem('urutau_admin_master_brightness_v1', String(masterB));
        } catch {}
      }

      const userCustomCfg =
        !isSuperAdminUser(currentUser) && currentUser?.id
          ? json.configs?.find((c) => c.chave === `personalizacao_usuario_${currentUser.id}`)?.valor_json
          : null;

      if (!isSuperAdminUser(currentUser) && currentUser?.id) {
        if (userCustomCfg && userCustomCfg.backgroundBrightness !== undefined) {
          setUserBrightnessOverride(
            userCustomCfg.backgroundBrightness === null
              ? null
              : clampBrightness(userCustomCfg.backgroundBrightness)
          );
        }
      }

      const effectiveBrand = userCustomCfg?.brandConfig || brandDaEmpresaAtiva;
      if (effectiveBrand && (isUserAuthenticated || Boolean(slugNaUrlAtual))) {
        savedPersistedBrandRef.current = effectiveBrand;
        handleUpdateBrandConfig(effectiveBrand, false);
      } else {
        const cfgTema = json.configs?.find((c) => c.chave === 'tema_rgb_urutau');
        const savedHex = String(cfgTema?.valor_json?.hex || '').toUpperCase();
        if (savedHex && savedHex !== '#D97706' && savedHex !== '#3B82F6') {
          applyAccentTheme(savedHex, {
            r: cfgTema?.valor_json?.r || 16,
            g: cfgTema?.valor_json?.g || 185,
            b: cfgTema?.valor_json?.b || 129
          });
        } else {
          applyAccentTheme('#10B981', { r: 16, g: 185, b: 129 });
        }
      }

      if (userCustomCfg?.categories && Array.isArray(userCustomCfg.categories)) {
        setCategories(normalizeUnifiedCategories(userCustomCfg.categories));
      } else {
        setCategories(adminMasterCategoriesRef.current);
      }

      if (userCustomCfg?.tabOverrides && typeof userCustomCfg.tabOverrides === 'object') {
        setTabOverrides(userCustomCfg.tabOverrides);
      } else {
        setTabOverrides(adminMasterOverridesRef.current);
      }

      if (!initialLayoutSyncedRef.current) {
        initialLayoutSyncedRef.current = true;
        const effectiveLayout = userCustomCfg?.layout || adminMasterLayoutRef.current;
        if (effectiveLayout) {
          if (effectiveLayout.menuPosition) setMenuPosition(effectiveLayout.menuPosition);
          setMenuVisualMode('dock');
        }
      }

      const cfgGeofence = json.configs?.find((c) => c.chave === 'regras_seguranca_geofence_turno');
      if (cfgGeofence?.valor_json && typeof cfgGeofence.valor_json === 'object') {
        setSecurityGeofenceConfig((prev) => ({
          ...prev,
          ...cfgGeofence.valor_json
        }));
      }

      const cfgTema = json.configs?.find((c) => c.chave === 'tema_rgb_urutau');
      if (cfgTema?.valor_json?.tempo_inatividade_seg) {
        setInactivityLimitSec(Number(cfgTema.valor_json.tempo_inatividade_seg));
      }
    } catch (e: any) {
      setErpData((prev) => prev || buildPublicBootstrapErpData([], []));
      showAlert('Erro de Sincronização', e.message, e.stack);
    } finally {
      setLoading(false);
    }
  }, [
    applyAccentTheme,
    currentUser,
    selectedEmpresaId,
    isUserAuthenticated,
    isSessionLocked,
    meuPcId,
    salvarPacotePortatilLocal,
    contarRegistrosPacote,
    handleUpdateBrandConfig,
    detectarSubdominioNaUrl,
    normalizeUnifiedCategories,
    showAlert
  ]);

  const fetchAllDataRef = useRef(fetchAllData);
  useEffect(() => {
    fetchAllDataRef.current = fetchAllData;
  }, [fetchAllData]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  useEffect(() => {
    if (!loading && erpData) return;
    const watchdog = window.setTimeout(() => {
      setErpData((prev) => prev || buildPublicBootstrapErpData([], []));
      setLoading(false);
    }, 4500);
    return () => window.clearTimeout(watchdog);
  }, [loading, erpData]);

  useEffect(() => {
    const handleTierSwitch = () => {
      setSseApiBase(offlineSyncEngine.getActiveApiBaseUrl());
      fetchAllDataRef.current();
    };
    window.addEventListener('urutau:tier-changed', handleTierSwitch);
    return () => window.removeEventListener('urutau:tier-changed', handleTierSwitch);
  }, []);

  useEffect(() => {
    const activeToken = offlineSyncEngine.getSessionToken();
    if (!isUserAuthenticated || isSessionLocked || !activeToken) return;
    const empIdSse = Number(selectedEmpresaId || currentUser?.empresas_ids?.[0] || 1);
    const es = new EventSource(
      `${sseApiBase}/api/stream?empresa_id=${empIdSse}&pc_id=${encodeURIComponent(meuPcId)}&session_token=${encodeURIComponent(activeToken)}`
    );

    const tiposMonitorados = [
      'sse.conectado',
      'equipe.atualizada',
      'equipe.contratado_automatico',
      'cargos.atualizado',
      'unidade.atualizada',
      'setor.atualizado',
      'checklist.atualizado',
      'vinculos.atualizados',
      'escala.atualizada',
      'rateio.fechado',
      'agenda.atualizada',
      'reserva.atualizada',
      'pdv.comanda_atualizada',
      'pdv.comanda_fechada',
      'pdv.impressao_disparada',
      'pdv.cardapio_atualizado',
      'portal.atualizado',
      'caixa.movimentacao_registrada',
      'estoque.atualizado',
      'selecao.atualizada',
      'rh.atualizado',
      'chat.mensagem_recebida',
      'notificacao.programada',
      'config.atualizada',
      'registro.arquivado',
      'backup.horario_concluido',
      'backup.local.fechamento_exe',
      'backup.nuvem.ciclo_1h',
      'sessao.computadores_ativos',
      'sessao.aguardando_primeiro_pc',
      'sessao.ultimo_pc_sincronizado',
      'telemetria.registrada',
      'empresa.licenca_atualizada',
      'bot_interno.atualizado'
    ];

    tiposMonitorados.forEach((evtName) => {
      es.addEventListener(evtName, (ev: MessageEvent) => {
        try {
          const parsed = JSON.parse(ev.data);
          const payloadData = parsed.payload || parsed;
          if (evtName === 'sessao.computadores_ativos') {
            if (Number(payloadData?.empresa_id || empIdSse) === empIdSse) {
              setComputadoresAtivosEmpresa(Math.max(1, Number(payloadData?.computadores_ativos || 1)));
            }
            return;
          }
          if (evtName === 'sessao.aguardando_primeiro_pc') {
            if (Number(payloadData?.empresa_id || empIdSse) === empIdSse) {
              setEstadoFechamentoLocal(payloadData?.estado_fechamento_local || null);
            }
            return;
          }
          if (evtName === 'sessao.ultimo_pc_sincronizado') {
            if (Number(payloadData?.empresa_id || empIdSse) === empIdSse) {
              if (payloadData?.limpar_backups_duplicados) {
                limparBackupsDuplicadosLocais(empIdSse, true);
              }
              setEstadoFechamentoLocal(null);
              setOutroPcCienteContinuar(false);
              fetchAllDataRef.current();
            }
            return;
          }
          setSseEvents((prev) => [
            {
              id: `${Date.now()}-${Math.random()}`,
              evento: evtName,
              ts: new Date().toLocaleTimeString('pt-BR'),
              payload: payloadData
            },
            ...prev.slice(0, 39)
          ]);
          if (evtName !== 'sse.conectado' && evtName !== 'telemetria.registrada') {
            setSsePulseActive(true);
            setTimeout(() => setSsePulseActive(false), 850);
            fetchAllDataRef.current();
          }
        } catch {}
      });
    });

    fetch(`/api/lgpd/vps-processador/status/${empIdSse}`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok) {
          if (typeof j.computadores_ativos === 'number') {
            setComputadoresAtivosEmpresa(Math.max(1, j.computadores_ativos));
          }
          setEstadoFechamentoLocal(j.drive_conectado ? null : j.estado_fechamento_local || null);
        }
      })
      .catch(() => {});

    return () => {
      es.close();
    };
  }, [selectedEmpresaId, currentUser?.id, meuPcId, sseApiBase, isUserAuthenticated, isSessionLocked]);

  useEffect(() => {
    if (isSessionLocked) return;

    secondsRemainingRef.current = inactivityLimitSec;

    const resetTimer = () => {
      secondsRemainingRef.current = inactivityLimitSec;
    };

    const events = ['mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));

    const interval = setInterval(() => {
      if (secondsRemainingRef.current <= 1) {
        secondsRemainingRef.current = 0;
        setIsSessionLocked(true);
      } else {
        secondsRemainingRef.current -= 1;
      }
    }, 1000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
      clearInterval(interval);
    };
  }, [isSessionLocked, inactivityLimitSec]);

  useEffect(() => {
    if (!isResizingSidebar) return;
    const onMove = (e: MouseEvent) => {
      const newWidth = Math.min(380, Math.max(200, e.clientX));
      setSidebarWidth(newWidth);
    };
    const onUp = () => setIsResizingSidebar(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isResizingSidebar]);

  const handleSelectTab = useCallback(
    (requestedTab: TabId, requestedSubSlug?: string) => {
      const newTab: TabId = requestedTab === 'selecao' ? 'rh' : requestedTab;
      if (isAdminExclusiveTab(newTab) && !isSuperAdminUser(currentUser)) {
        showAlert(
          'Acesso Restrito',
          'As abas administrativas do sistema são exclusivas da gestão global da plataforma.'
        );
        return;
      }
      if (requestedTab === 'selecao') {
        setRhInitialSubView('selecao');
      } else if (requestedTab === 'rh') {
        setRhInitialSubView('recursos');
      }

      const defaultSub =
        requestedSubSlug || MODULE_CLEAN_GUIDES[newTab]?.subTabs?.[0]?.slug || null;
      setActiveSubTabSlug(defaultSub);

      try {
        const nextPath =
          newTab === 'home' ? '/' : `/${newTab}${defaultSub ? `/${defaultSub}` : ''}`;
        if (window.location.pathname !== nextPath) {
          window.history.replaceState({}, '', `${nextPath}${window.location.search}`);
        }
      } catch {}

      const metaLabel = tabOverrides[newTab]?.label || DEFAULT_TAB_META[newTab]?.label || newTab;
      registrarTelemetriaGpsLog(
        'ABERTURA_MENU',
        'ABERTURA_MENU',
        `Abertura do menu "${metaLabel}" [${newTab}] (${
          usuarioDentroDaEmpresa
            ? `Dentro da empresa • ${distanciaEmpresaMetros}m`
            : `Fora da empresa • ${distanciaEmpresaMetros}m`
        } • ${usuarioEmTurnoAtivo ? 'Em turno' : 'Fora de turno'})`,
        newTab
      );

      if (mainViewportRef.current) {
        tabScrollMemoryRef.current[activeTab] = mainViewportRef.current.scrollTop;
      }
      if (sidebarScrollRef.current) {
        sidebarScrollPosRef.current = sidebarScrollRef.current.scrollTop;
      }

      setActiveTab(newTab);

      const cat = categories.find((c) => c.abas.includes(newTab));
      if (cat) {
        setOpenCategoryId(cat.id);
      }

      requestAnimationFrame(() => {
        if (mainViewportRef.current) {
          mainViewportRef.current.scrollTop = tabScrollMemoryRef.current[newTab] || 0;
        }
        if (sidebarScrollRef.current) {
          sidebarScrollRef.current.scrollTop = sidebarScrollPosRef.current;
        }
      });
    },
    [
      activeTab,
      categories,
      tabOverrides,
      registrarTelemetriaGpsLog,
      usuarioDentroDaEmpresa,
      distanciaEmpresaMetros,
      usuarioEmTurnoAtivo,
      currentUser,
      showAlert
    ]
  );

  useEffect(() => {
    const handleOpenErrorLogs = () => {
      handleSelectTab('auditoria', 'erros-falhas');
    };
    window.addEventListener('urutau:open-error-logs', handleOpenErrorLogs);
    return () => window.removeEventListener('urutau:open-error-logs', handleOpenErrorLogs);
  }, [handleSelectTab]);

  const handleNavigateDeepLink = useCallback(
    (target: DeepLinkTarget) => {
      if (target.entityId) {
        setDeepLinkEntityId(target.entityId);
      }
      if (target.mesaCodigo) {
        setDeepLinkMesaCodigo(target.mesaCodigo);
      }
      handleSelectTab(target.tab);
    },
    [handleSelectTab]
  );

  const moveCategory = (idx: number, dir: -1 | 1) => {
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= categories.length) return;
    const clone = [...categories];
    const [removed] = clone.splice(idx, 1);
    clone.splice(targetIdx, 0, removed);
    setCategories(clone);
    localStorage.setItem('urutau_nav_categories_v11', JSON.stringify(clone));
  };

  const resetMenuOrder = () => {
    setCategories(DEFAULT_CATEGORIES);
    setSidebarWidth(264);
    setSidebarCollapsed(false);
    setMenuPosition('left');
    setOpenCategoryId('operacao');
    localStorage.removeItem('urutau_nav_categories_v11');
  };

  const handleUnlockSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError('');
    setUnlockLoading(true);
    try {
      const res = await fetch('/api/v31/auth/desbloquear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identificador: unlockIdentificador,
          codigo: unlockPassword
        })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        const msg = json.erro || 'Credenciais de acesso inválidas.';
        setUnlockError(msg);
        registerClientErrorLog({
          origem: 'Tela de Login (Senha)',
          titulo: 'Falha de Login por Senha',
          mensagem: msg,
          detalhesTecnicos: `Identificador informado: ${unlockIdentificador || '(vazio)'}`
        });
        return;
      }
      if (json.usuario) {
        setCurrentUser(json.usuario);
        setRealOperatorUser(json.usuario);
        setUnlockIdentificador(json.usuario.nome || '');
        const empId =
          json.empresa_ativa_id ||
          (Array.isArray(json.usuario.empresas_ids) && json.usuario.empresas_ids.length > 0
            ? Number(json.usuario.empresas_ids[0])
            : 1);
        setSelectedEmpresaId(empId);
        persistActiveSession(json.usuario, empId, json.sessao_token);
        if (!isSuperAdminUser(json.usuario)) {
          handleSaveUserToDeviceList(json.usuario);
        }
      }
      setUnlockPassword('');
      setSecondsRemaining(inactivityLimitSec);
      setSessionVerifiedByServer(true);
      setIsSessionLocked(false);
      setIsUserAuthenticated(true);
      setShowLandingPage(false);
    } catch (err: any) {
      const msg = err.message || 'Falha de comunicação com o servidor.';
      setUnlockError(msg);
      registerClientErrorLog({
        origem: 'Tela de Login (Senha)',
        titulo: 'Erro de Conexão no Login',
        mensagem: msg
      });
    } finally {
      setUnlockLoading(false);
    }
  };

  const handleRequestPasswordRecovery = async () => {
    const ident = (recoveryIdentificador || unlockIdentificador).trim();
    if (!ident) {
      setRecoveryError('Informe seu Nome de usuário, WhatsApp ou E-mail cadastrado.');
      return;
    }
    setRecoveryError('');
    setRecoveryFeedback('');
    setRecoveryLoading(true);
    try {
      const res = await fetch('/api/v31/auth/recuperar-senha/solicitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identificador: ident,
          canal: recoveryCanal
        })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        const msg = json.erro || 'Não foi possível enviar o código de recuperação.';
        setRecoveryError(msg);
        registerClientErrorLog({
          origem: 'Recuperação de Senha',
          titulo: 'Erro ao Solicitar Recuperação',
          mensagem: msg,
          detalhesTecnicos: `Identificador: ${ident} • Canal: ${recoveryCanal}`
        });
        return;
      }
      setRecoveryIdentificador(ident);
      setRecoveryStep('confirm');
      setRecoveryFeedback(json.mensagem || 'Código de 6 dígitos enviado com sucesso!');
      if (json.codigo_recuperacao_direto) {
        setRecoveryToken(String(json.codigo_recuperacao_direto));
      }
    } catch (e: any) {
      setRecoveryError(e.message || 'Falha ao solicitar recuperação de senha.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleConfirmPasswordRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryToken.trim() || !recoveryNovaSenha.trim()) {
      setRecoveryError('Informe o código de 6 dígitos e a nova senha.');
      return;
    }
    setRecoveryError('');
    setRecoveryLoading(true);
    try {
      const res = await fetch('/api/v31/auth/recuperar-senha/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identificador: (recoveryIdentificador || unlockIdentificador).trim(),
          token: recoveryToken.trim(),
          nova_senha: recoveryNovaSenha.trim()
        })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        const msg = json.erro || 'Código inválido ou expirado.';
        setRecoveryError(msg);
        registerClientErrorLog({
          origem: 'Recuperação de Senha',
          titulo: 'Falha ao Confirmar Nova Senha',
          mensagem: msg
        });
        return;
      }
      if (json.usuario) {
        setCurrentUser(json.usuario);
        setRealOperatorUser(json.usuario);
        setUnlockIdentificador(json.usuario.nome || '');
        const empId =
          json.empresa_ativa_id ||
          (Array.isArray(json.usuario.empresas_ids) && json.usuario.empresas_ids.length > 0
            ? Number(json.usuario.empresas_ids[0])
            : 1);
        setSelectedEmpresaId(empId);
        persistActiveSession(json.usuario, empId, json.sessao_token);
      }
      setRecoveryOpen(false);
      setRecoveryStep('request');
      setRecoveryToken('');
      setRecoveryNovaSenha('');
      setSessionVerifiedByServer(true);
      setIsSessionLocked(false);
      setIsUserAuthenticated(true);
      setShowLandingPage(false);
      showAlert('Senha Redefinida', json.mensagem || 'Sua senha foi redefinida e sua sessão foi iniciada.');
    } catch (e: any) {
      setRecoveryError(e.message || 'Falha ao redefinir senha.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const effectiveSavedUsers = React.useMemo(() => {
    const map = new Map<string, any>();
    const makeKey = (u: any) =>
      `${Number(u?.id || 0)}_${String(u?.nome || '').trim().toLowerCase()}`;

    const isCurrentMaster = isSuperAdminUser(currentUser) || isSuperAdminUser(realOperatorUser);
    const empAtivaId = selectedEmpresaId ? Number(selectedEmpresaId) : null;

    savedDeviceUsers.forEach((u) => {
      if (!u || !u.nome) return;
      if (!isCurrentMaster && isSuperAdminUser(u)) return;
      if (!isCurrentMaster && empAtivaId) {
        const empIds = Array.isArray(u.empresas_ids) ? u.empresas_ids.map(Number) : [];
        if (empIds.length > 0 && !empIds.includes(empAtivaId)) return;
      }
      const k = makeKey(u);
      if (!removedSavedUserKeys.includes(k)) {
        map.set(k, u);
      }
    });

    (erpData?.usuarios || []).forEach((u: any) => {
      if (!u || !u.nome) return;
      if (!isCurrentMaster && isSuperAdminUser(u)) return;
      if (!isCurrentMaster && empAtivaId) {
        const empIds = Array.isArray(u.empresas_ids) ? u.empresas_ids.map(Number) : [];
        if (empIds.length > 0 && !empIds.includes(empAtivaId)) return;
      }
      const k = makeKey(u);
      if (!removedSavedUserKeys.includes(k) && !map.has(k)) {
        map.set(k, {
          id: u.id,
          nome: u.nome,
          cargo: u.cargo || u.tipo || 'Operacional',
          tipo: u.tipo || 'Colaborador',
          telefone: u.telefone || '',
          empresas_ids: u.empresas_ids,
          permissoes_json: u.permissoes_json
        });
      }
    });

    return Array.from(map.values());
  }, [savedDeviceUsers, erpData?.usuarios, removedSavedUserKeys, currentUser, realOperatorUser, selectedEmpresaId]);

  const handleSaveUserToDeviceList = useCallback((userObj: any) => {
    if (!userObj || !userObj.nome) return;
    const key = `${Number(userObj.id || 0)}_${String(userObj.nome).trim().toLowerCase()}`;
    setRemovedSavedUserKeys((prev) => {
      const next = prev.filter((k) => k !== key);
      localStorage.setItem('urutau_removed_saved_accounts_v1', JSON.stringify(next));
      return next;
    });
    setSavedDeviceUsers((prev) => {
      const filtered = prev.filter(
        (u) => `${Number(u?.id || 0)}_${String(u?.nome || '').trim().toLowerCase()}` !== key
      );
      const next = [
        {
          id: userObj.id || Date.now(),
          nome: userObj.nome,
          cargo: userObj.cargo || userObj.tipo || 'Operacional',
          tipo: userObj.tipo || 'Colaborador',
          telefone: userObj.telefone || '',
          empresas_ids: userObj.empresas_ids,
          permissoes_json: userObj.permissoes_json
        },
        ...filtered
      ];
      localStorage.setItem('urutau_saved_accounts_v1', JSON.stringify(next));
      return next;
    });
  }, []);

  const handleDeleteSavedDeviceUser = useCallback((targetUser: any) => {
    if (!targetUser) return;
    const key = `${Number(targetUser?.id || 0)}_${String(targetUser?.nome || '').trim().toLowerCase()}`;
    setRemovedSavedUserKeys((prev) => {
      const next = Array.from(new Set([...prev, key]));
      localStorage.setItem('urutau_removed_saved_accounts_v1', JSON.stringify(next));
      return next;
    });
    setSavedDeviceUsers((prev) => {
      const next = prev.filter(
        (u) => `${Number(u?.id || 0)}_${String(u?.nome || '').trim().toLowerCase()}` !== key
      );
      localStorage.setItem('urutau_saved_accounts_v1', JSON.stringify(next));
      return next;
    });
  }, []);

  const handleQuickSwitchToSavedUser = (targetUser: any) => {
    if (!targetUser) return;
    setSwitchLoginIdentificador(String(targetUser.nome || targetUser.telefone || '').trim());
    setSwitchLoginPassword('');
    setSwitchAuthError('Por seguranca Zero-Trust, confirme a credencial do operador para emitir sessao assinada.');
    setUserSwitchTab('outro_login');
  };

  const handleLoginWithAnotherUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!switchLoginIdentificador.trim()) {
      setSwitchAuthError('Informe o nome de usuário ou WhatsApp.');
      return;
    }
    setSwitchAuthError('');
    setSwitchAuthLoading(true);
    try {
      const res = await fetch('/api/v31/auth/desbloquear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identificador: switchLoginIdentificador.trim(),
          codigo: switchLoginPassword
        })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setSwitchAuthError(json.erro || 'Credenciais inválidas ou usuário não encontrado.');
        return;
      }
      const loggedUser = json.usuario || {
        id: Date.now(),
        nome: switchLoginIdentificador.trim(),
        cargo: 'Operador',
        tipo: 'Colaborador'
      };
      const empId =
        json.empresa_ativa_id ||
        (Array.isArray(loggedUser.empresas_ids) && loggedUser.empresas_ids.length > 0
          ? Number(loggedUser.empresas_ids[0])
          : selectedEmpresaId || 1);
      setCurrentUser(loggedUser);
      setRealOperatorUser(loggedUser);
      setSelectedEmpresaId(empId);
      persistActiveSession(loggedUser, empId, json.sessao_token);
      setSessionVerifiedByServer(true);
      setIsSessionLocked(false);
      setIsUserAuthenticated(true);
      setUnlockIdentificador(loggedUser.nome);
      if (switchSaveAccount && !isSuperAdminUser(loggedUser)) {
        handleSaveUserToDeviceList(loggedUser);
      }
      setSwitchLoginIdentificador('');
      setSwitchLoginPassword('');
      setUserSwitchModalOpen(false);
    } catch (err: any) {
      setSwitchAuthError(err.message || 'Falha de comunicação ao autenticar.');
    } finally {
      setSwitchAuthLoading(false);
    }
  };

  const handleCreateAndLoginNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuickUserForm.nome.trim()) {
      setSwitchAuthError('Informe o nome completo ou de exibição do novo usuário.');
      return;
    }
    setSwitchAuthError('');
    setSwitchAuthLoading(true);
    try {
      const res = await fetch('/api/acessos/salvar-completo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: newQuickUserForm.nome.trim(),
          cargo: newQuickUserForm.cargo.trim() || 'Operador',
          tipo: newQuickUserForm.tipo || 'Colaborador',
          telefone: newQuickUserForm.telefone.trim(),
          senha_plana: newQuickUserForm.senha.trim() || '1234',
          empresas_ids: selectedEmpresaId ? [selectedEmpresaId] : [1]
        })
      });
      const json = await res.json();
      if (!res.ok || json.erro) {
        setSwitchAuthError(json.erro || 'Não foi possível criar o novo usuário.');
        return;
      }
      await fetchAllData();
      const createdUser = json.usuario || {
        id: json.id || Date.now(),
        nome: newQuickUserForm.nome.trim(),
        cargo: newQuickUserForm.cargo.trim() || 'Operador',
        tipo: newQuickUserForm.tipo || 'Colaborador',
        telefone: newQuickUserForm.telefone.trim()
      };
      setCurrentUser(createdUser);
      setRealOperatorUser(createdUser);
      setSessionVerifiedByServer(true);
      setIsUserAuthenticated(true);
      setUnlockIdentificador(createdUser.nome);
      if (newQuickUserForm.salvarNoDispositivo) {
        handleSaveUserToDeviceList(createdUser);
      }
      setNewQuickUserForm({
        nome: '',
        cargo: 'Operador',
        tipo: 'Colaborador',
        telefone: '',
        senha: '',
        salvarNoDispositivo: true
      });
      setUserSwitchModalOpen(false);
    } catch (err: any) {
      setSwitchAuthError(err.message || 'Erro ao criar e autenticar novo usuário.');
    } finally {
      setSwitchAuthLoading(false);
    }
  };

  useEffect(() => {
    if (!wppOtpSent || wppOtpTimer <= 0) return;
    const interval = setInterval(() => {
      setWppOtpTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [wppOtpSent, wppOtpTimer]);

  const handleRequestWppToken = async () => {
    if (!wppInputTelefone.trim()) {
      setWppError('Informe o seu número de WhatsApp cadastrado.');
      return;
    }
    setWppError('');
    setWppLoading(true);
    try {
      const res = await fetch('/api/v50/auth/solicitar-token-wpp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefone: wppInputTelefone,
          identificador: wppInputTelefone
        })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setWppError(json.erro || 'Não foi possível solicitar o código de autenticação.');
        return;
      }
      setWppOtpSent(true);
      setWppOtpTimer(300);
      setWppOtpFeedback(json.mensagem || 'Código de autenticação enviado!');
      setWppOtpCode('');
    } catch (e: any) {
      setWppError(e.message || 'Erro de comunicação com o servidor.');
    } finally {
      setWppLoading(false);
    }
  };

  const handleValidateWppToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wppOtpCode.trim()) {
      setWppError('Informe o código de autenticação recebido.');
      return;
    }
    setWppError('');
    setWppLoading(true);
    try {
      const res = await fetch('/api/v50/auth/validar-token-wpp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: wppOtpCode
        })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setWppError(json.erro || 'Código inválido ou expirado.');
        return;
      }
      if (json.usuario) {
        setCurrentUser(json.usuario);
        setRealOperatorUser(json.usuario);
        setUnlockIdentificador(json.usuario.nome || '');
        const empId =
          json.empresa_ativa_id ||
          (Array.isArray(json.usuario.empresas_ids) && json.usuario.empresas_ids.length > 0
            ? Number(json.usuario.empresas_ids[0])
            : 1);
        setSelectedEmpresaId(empId);
        persistActiveSession(json.usuario, empId, json.sessao_token);
        if (!isSuperAdminUser(json.usuario)) {
          handleSaveUserToDeviceList(json.usuario);
        }
      }
      setSessionVerifiedByServer(true);
      setIsSessionLocked(false);
      setIsUserAuthenticated(true);
      setShowLandingPage(false);
      setSecondsRemaining(inactivityLimitSec);
      setWppOtpCode('');
      setWppOtpSent(false);
      showAlert('Acesso Concedido', 'Sessão autenticada com sucesso.');
    } catch (e: any) {
      setWppError(e.message || 'Erro ao validar token.');
    } finally {
      setWppLoading(false);
    }
  };

  const formatCountdown = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const getInitials = (name: string) =>
    String(name || 'UR')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase())
      .join('');

  const handleCopyQuickMessage = (msg: any) => {
    navigator.clipboard?.writeText(msg.texto);
    setQuickMsgOpen(false);
    setCopiedQuickToast(`Mensagem "${msg.titulo}" copiada!`);
    setTimeout(() => setCopiedQuickToast(null), 2600);
  };

  const officialCloudOrigin = 'https://ais-pre-pejnpvvx5jpp4nbv5n76xv-247047087382.us-east1.run.app';
  const vpsUpdateOneLineCmd = `(grep -q "1.1.1.1" /etc/resolv.conf 2>/dev/null || echo -e "nameserver 1.1.1.1\\nnameserver 8.8.8.8" >> /etc/resolv.conf 2>/dev/null || true) && curl -4 -sSL ${officialCloudOrigin}/atualizar-vps.sh | bash`;

  const ADMIN_EXCLUSIVE_TABS: TabId[] = [
    'servidor_ia'
  ];

  const GESTOR_GOVERNANCE_TABS: TabId[] = [
    'permissoes',
    'auditoria',
    'config',
    'notificacoes',
    'empresas',
    'modulos'
  ];

  const isAdminExclusiveTab = (tabId: TabId): boolean =>
    ADMIN_EXCLUSIVE_TABS.includes(tabId);

  const isAdminExclusiveCategory = (catId: string): boolean =>
    catId === 'governanca_sistema';

  const isCurrentTabSystematicAdmin =
    isSuperAdminUser(currentUser) && isAdminExclusiveTab(activeTab);

  const canAccessTab = (tabId: TabId) => {
    if (isAdminExclusiveTab(tabId)) {
      return isSuperAdminUser(currentUser);
    }
    if (GESTOR_GOVERNANCE_TABS.includes(tabId)) {
      return isSuperAdminUser(currentUser) || isGestorEmpresaUser(currentUser);
    }
    if (tabOverrides[tabId]?.hidden) {
      return false;
    }
    if (isSuperAdminUser(currentUser)) {
      return true;
    }
    const modPerm = currentUser?.permissoes_json?.modulos?.[tabId];
    if (modPerm && typeof modPerm.ver === 'boolean') {
      return modPerm.ver;
    }
    return true;
  };

  useEffect(() => {
    if (!isSuperAdminUser(currentUser) && isAdminExclusiveTab(activeTab)) {
      setActiveTab('caixa');
    }
  }, [currentUser, activeTab]);

  if (loading || !erpData) {
    return (
      <div className="w-full min-h-screen bg-[#05100C] flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-[#F8FAFC] font-mono text-sm">
          <UrutauEmblemSVG className="w-8 h-8 animate-pulse" postura="sentinela" />
          <span>Carregando...</span>
        </div>
      </div>
    );
  }

  const podeSimularColaboradores =
    isSuperAdminUser(realOperatorUser) || isGestorEmpresaUser(realOperatorUser);
  const estaSimulandoColaborador =
    podeSimularColaboradores &&
    Number(currentUser?.id) !== Number(realOperatorUser?.id);

  const colaboradoresSimulaveis = (erpData.usuarios || []).filter((u: any) => {
    if (isSuperAdminUser(u) && !isSuperAdminUser(realOperatorUser)) return false;
    if (isSuperAdminUser(realOperatorUser)) return true;
    if (isGestorEmpresaUser(realOperatorUser)) {
      return (
        Number(u.id) === Number(realOperatorUser.id) ||
        isSubordinadoDoGestor(realOperatorUser, u, selectedEmpresaId)
      );
    }
    return false;
  });

  const handleTrocarVisaoColaborador = (targetUser: any) => {
    if (!targetUser) return;
    setCurrentUser(targetUser);
    if (
      Array.isArray(targetUser?.empresas_ids) &&
      targetUser.empresas_ids.length > 0 &&
      !isSuperAdminUser(targetUser)
    ) {
      setSelectedEmpresaId(Number(targetUser.empresas_ids[0]));
    }
    const modPerm = targetUser?.permissoes_json?.modulos?.[activeTab];
    if (
      !isSuperAdminUser(targetUser) &&
      modPerm &&
      typeof modPerm.ver === 'boolean' &&
      !modPerm.ver
    ) {
      const primeiraPermitida = categories
        .flatMap((c) => c.abas)
        .find((t) => {
          const p = targetUser?.permissoes_json?.modulos?.[t];
          return !p || p.ver !== false;
        });
      if (primeiraPermitida) {
        setActiveTab(primeiraPermitida);
      }
    }
  };

  const commonProps = {
    data: { ...erpData, empresaAtivaId: selectedEmpresaId },
    onRefresh: fetchAllData,
    onNavigateDeepLink: handleNavigateDeepLink,
    showAlert,
    showConfirm,
    deepLinkEntityId,
    clearDeepLink: () => {
      setDeepLinkEntityId(null);
      setDeepLinkMesaCodigo(null);
    },
    currentUser,
    onSwitchCurrentUser: (u: any) => {
      handleTrocarVisaoColaborador(u);
    }
  };

  const bypassGeofenceOrShift =
    isSuperAdminUser(currentUser) && securityGeofenceConfig.isentarSuperAdmin !== false;
  const activeTabRequiresCompanyLocation =
    securityGeofenceConfig.geofenceAtivo &&
    (securityGeofenceConfig.abasExigemLocalizacaoEmpresa || []).includes(activeTab);
  const activeTabBlockedByGeofence =
    activeTabRequiresCompanyLocation && !usuarioDentroDaEmpresa && !bypassGeofenceOrShift;

  const activeTabRequiresShift =
    securityGeofenceConfig.bloqueioForaDeTurnoAtivo &&
    (securityGeofenceConfig.abasBloqueadasForaDeTurno || []).includes(activeTab);
  const activeTabBlockedByShift =
    activeTabRequiresShift && !usuarioEmTurnoAtivo && !bypassGeofenceOrShift;

  const handleSimulateGpsPosition = (insideCompany: boolean) => {
    if (insideCompany) {
      setUserGpsLocation({
        latitude: securityGeofenceConfig.empresaLatitude,
        longitude: securityGeofenceConfig.empresaLongitude,
        accuracy: 6,
        simulated: true,
        label: 'Dentro da Empresa (Perímetro Autorizado)'
      });
    } else {
      setUserGpsLocation({
        latitude: Number((securityGeofenceConfig.empresaLatitude - 0.0068).toFixed(6)),
        longitude: Number((securityGeofenceConfig.empresaLongitude - 0.0042).toFixed(6)),
        accuracy: 12,
        simulated: true,
        label: 'Fora da Empresa (~890m de distância)'
      });
    }
  };

  const empresaAtivaObj =
    (erpData.empresas || []).find(
      (e: any) =>
        Number(e.id) === Number(selectedEmpresaId || currentUser?.empresas_ids?.[0] || 1)
    ) || (erpData.empresas || [])[0];

  const nivelAcessoLicencaAtiva: 'uso_completo' | 'somente_leitura' | 'somente_download' =
    (empresaAtivaObj?.nivel_acesso_licenca as any) ||
    (empresaAtivaObj?.status_licenca === 'Modo Leitura (Inadimplente)'
      ? 'somente_leitura'
      : empresaAtivaObj?.status_licenca === 'Somente Download de Dados'
      ? 'somente_download'
      : 'uso_completo');

  const handleQuickRestoreFullLicense = async () => {
    if (!empresaAtivaObj?.id) return;
    try {
      await fetch('/api/erp/empresas/alterar-licenca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: empresaAtivaObj.id,
          nivel_acesso_licenca: 'uso_completo'
        })
      });
      await fetchAllData();
    } catch {}
  };

  const hasSignedSessionToken = Boolean(offlineSyncEngine.getSessionToken());
  const isAuthenticatedAndUnlocked =
    isUserAuthenticated &&
    !isSessionLocked &&
    sessionVerifiedByServer &&
    hasSignedSessionToken &&
    Boolean(currentUser?.id && Number(currentUser.id) > 0);

  if (isAuthenticatedAndUnlocked && activePcProgram) {
    return (
      <>
        <UrutauPcProgramTakeoverScreen
          activeProgram={activePcProgram}
          launchedPrograms={launchedPcPrograms}
          onResumeUrutau={() => setActivePcProgram(null)}
          onOpenExeExplorer={() => setWindowsExplorerErpOpen(true)}
          onSelectProgram={(prog: LaunchedPcProgram) => setActivePcProgram(prog)}
          onCloseProgram={(progId: string) => {
            setLaunchedPcPrograms((prev) => {
              const remaining = prev.filter((p) => p.id !== progId);
              setActivePcProgram(remaining[0] || null);
              return remaining;
            });
          }}
        />
        <UrutauWindowsExplorerModal
          open={windowsExplorerErpOpen}
          onClose={() => setWindowsExplorerErpOpen(false)}
          companyName={brandConfig.companyName || 'URUTAU'}
          onLaunchPcProgram={handleLaunchPcProgram}
        />
      </>
    );
  }

  return (
    <>
      {showLandingPage ? (
        <UrutauLandingPage
          companyName={brandConfig.companyName || 'URUTAU'}
          empresasCount={(erpData.empresas || []).length}
          usuariosCount={(erpData.usuarios || []).length}
          brandConfig={brandConfig}
          isAuthenticated={isAuthenticatedAndUnlocked}
          currentUser={currentUser}
          scrollToPersonalizacaoSignal={landingScrollSignal}
          onUpdateBrandConfig={handleUpdateBrandConfig}
          onRestoreSavedBrandConfig={handleRestoreSavedBrandConfig}
          onOpenLoginModal={() => setIsSessionLocked(true)}
          onCompleteOnboarding={(novoUsuario, novaEmpresaId, sessaoToken) => {
            const empId =
              novaEmpresaId ||
              (Array.isArray(novoUsuario?.empresas_ids) && novoUsuario.empresas_ids.length > 0
                ? Number(novoUsuario.empresas_ids[0])
                : 1);
            if (novoUsuario) {
              setCurrentUser(novoUsuario);
              setRealOperatorUser(novoUsuario);
              setUnlockIdentificador(novoUsuario.nome || '');
              handleSaveUserToDeviceList(novoUsuario);
              persistActiveSession(novoUsuario, empId, sessaoToken);
            }
            if (empId) {
              setSelectedEmpresaId(empId);
            }
            setSessionVerifiedByServer(true);
            setIsSessionLocked(false);
            setIsUserAuthenticated(true);
          }}
          onEnterErp={(targetTab) => {
            if (!isAuthenticatedAndUnlocked) {
              setIsSessionLocked(true);
              return;
            }
            if (targetTab) {
              handleSelectTab(targetTab);
            }
            setShowLandingPage(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      ) : isAuthenticatedAndUnlocked ? (
        <div
          className={`w-full min-h-screen text-[#F8FAFC] flex flex-col transition-colors duration-300 ${
            isCurrentTabSystematicAdmin ? 'systematic-admin-viewport' : 'bg-[#05100C]'
          }`}
        >
      {estaSimulandoColaborador && (
        <div className="w-full bg-[#F59E0B] text-[#05100C] px-3 sm:px-6 py-1.5 flex items-center justify-between gap-2 z-50 shadow-md border-b border-black/20">
          <div className="flex items-center gap-2 text-xs font-bold min-w-0 truncate">
            <Eye className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              Visão de: <strong className="underline">{currentUser?.nome}</strong> ({currentUser?.cargo || currentUser?.tipo})
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleTrocarVisaoColaborador(realOperatorUser)}
              className="px-2.5 py-1 rounded-lg bg-[#05100C] text-[#10B981] hover:bg-[#071712] text-[11px] font-black cursor-pointer whitespace-nowrap"
            >
              Voltar ({String(realOperatorUser?.nome || '').split(' ')[0]})
            </button>
          </div>
        </div>
      )}

      {!mobileMenuOpen && (
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className={`${
            menuPosition === 'left' ? 'flex md:hidden' : 'flex'
          } tapiri-sidebar-edge-arrow`}
          aria-label="Expandir Menu Lateral"
          title="Expandir Menu Lateral"
        >
          <ChevronRight className="w-4 h-4 stroke-[2.6]" />
        </button>
      )}

      <div className="flex-1 w-full flex items-start relative">
        {menuPosition === 'left' && sidebarCollapsed && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSidebarCollapsed(false);
            }}
            className="hidden md:flex tapiri-sidebar-edge-arrow"
            title="Expandir Menu Lateral"
            aria-label="Expandir Menu Lateral"
          >
            <ChevronRight className="w-4 h-4 stroke-[2.6]" />
          </button>
        )}

        {menuPosition === 'left' && !sidebarCollapsed && (
          <aside
            style={{ width: menuVisualMode === 'dock' ? 148 : sidebarWidth }}
            className="hidden md:flex sticky top-0 self-start h-screen tapiri-sidebar flex-col shrink-0 select-none z-30 transition-[width] duration-150"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSidebarCollapsed(true);
              }}
              className="tapiri-sidebar-protrusion"
              title="Recolher Menu Lateral"
              aria-label="Recolher Menu Lateral"
            >
              <ChevronLeft className="w-4 h-4 stroke-[2.6]" />
            </button>

            <div className="p-2.5 border-b border-white/[0.06] space-y-2 shrink-0">
              <button
                type="button"
                onClick={() => setBrandShowcaseOpen(true)}
                className="w-full flex flex-col items-center justify-center gap-1 py-1.5 px-2 rounded-lg hover:bg-white/[0.04] transition-colors cursor-pointer group"
                title="Personalizar Identidade Visual e Cores da Empresa"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <SystemSlotImage
                    slot={
                      ssePulseActive &&
                      !brandConfig.logoDataUrl &&
                      brandConfig.imagePlacements?.topo_painel !== 'logo_empresa' &&
                      !String(brandConfig.imagePlacements?.topo_painel || '').startsWith('custom_')
                        ? 'pulso_tempo_real'
                        : 'topo_painel'
                    }
                    brandConfig={brandConfig}
                    ssePulse={ssePulseActive}
                    className="w-9 h-7 shrink-0 transition-transform duration-200 group-hover:scale-105"
                  />
                  <span
                    className={`tapiri-orb-turquoise shrink-0 transition-transform duration-300 ${
                      ssePulseActive ? 'scale-125' : ''
                    }`}
                    title="Sincronização em Tempo Real Ativa"
                  />
                </div>
                <span className="text-[11px] font-bold tracking-[0.06em] text-slate-100 uppercase leading-tight text-center truncate w-full">
                  {brandConfig.companyName ? brandConfig.companyName : 'URUTAU'}
                </span>
              </button>

              {erpData.empresas && erpData.empresas.length > 0 && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.03] border border-white/[0.06] min-w-0">
                  <Building2 className="w-3 h-3 text-emerald-400/80 shrink-0" />
                  {isSuperAdminUser(currentUser) || isGestorEmpresaUser(currentUser) ? (
                    <select
                      value={selectedEmpresaId ?? ''}
                      onChange={(e) =>
                        setSelectedEmpresaId(e.target.value ? Number(e.target.value) : null)
                      }
                      className="!bg-transparent !border-none text-[10px] font-medium text-slate-200 focus:outline-none cursor-pointer truncate w-full !p-0 !shadow-none"
                      title="Selecionar Empresa / Unidade"
                    >
                      {isSuperAdminUser(currentUser) && (
                        <option value="" className="bg-[#080D11] text-slate-100">
                          Rede ({erpData.empresas.length})
                        </option>
                      )}
                      {erpData.empresas
                        .filter(
                          (emp) =>
                            isSuperAdminUser(currentUser) ||
                            (Array.isArray(currentUser?.empresas_ids) &&
                              currentUser.empresas_ids.map(Number).includes(Number(emp.id))) ||
                            Number(selectedEmpresaId) === Number(emp.id)
                        )
                        .map((emp) => (
                          <option key={emp.id} value={emp.id} className="bg-[#080D11] text-slate-100">
                            {emp.nome}
                          </option>
                        ))}
                    </select>
                  ) : (
                    <span className="text-[10px] font-medium text-slate-200 truncate">
                      {erpData.empresas.find(
                        (e) =>
                          Number(e.id) ===
                          Number(selectedEmpresaId || currentUser?.empresas_ids?.[0] || 1)
                      )?.nome || 'Unidade'}
                    </span>
                  )}
                </div>
              )}

              {podeSimularColaboradores && colaboradoresSimulaveis.length > 1 && (
                <div
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md border min-w-0 ${
                    estaSimulandoColaborador
                      ? 'bg-amber-500/15 border-amber-500/30'
                      : 'bg-white/[0.03] border-white/[0.06]'
                  }`}
                  title="Alternar visão de colaborador"
                >
                  <Eye className="w-3 h-3 text-amber-400/80 shrink-0" />
                  <select
                    value={currentUser?.id || ''}
                    onChange={(e) => {
                      const alvo = colaboradoresSimulaveis.find(
                        (u: any) => Number(u.id) === Number(e.target.value)
                      );
                      if (alvo) handleTrocarVisaoColaborador(alvo);
                    }}
                    className="!bg-transparent !border-none text-[10px] font-medium text-slate-200 focus:outline-none cursor-pointer truncate w-full !p-0 !shadow-none"
                  >
                    {colaboradoresSimulaveis.map((u: any) => (
                      <option key={u.id} value={u.id} className="bg-[#080D11] text-slate-100">
                        {Number(u.id) === Number(realOperatorUser?.id)
                          ? `Minha Visão (${u.nome})`
                          : `${u.nome} (${u.cargo || u.tipo})`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setSwitchAuthError('');
                    setUserSwitchTab('salvos');
                    setUserSwitchModalOpen(true);
                  }}
                  className="flex-1 py-1 px-1.5 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] flex items-center gap-1.5 min-w-0 cursor-pointer transition-colors"
                  title={`${currentUser?.nome} • Clique para Login / Trocar de Usuário`}
                >
                  <VisualAvatar
                    name={currentUser?.nome}
                    role={currentUser?.cargo}
                    size="sm"
                    highlight
                  />
                  <div className="flex flex-col min-w-0 text-left">
                    <span className="text-[10px] font-semibold text-slate-100 truncate">
                      {currentUser?.nome || 'Login'}
                    </span>
                    <span className="text-[9px] text-slate-400 truncate">
                      {currentUser?.cargo || 'Trocar Conta'}
                    </span>
                  </div>
                </button>

                <OfflineSyncCenter
                  currentUser={currentUser}
                  onNavigateTab={handleSelectTab}
                  onRefreshData={fetchAllData}
                />

                <button
                  type="button"
                  onClick={() => setBrightnessPanelOpen((prev) => !prev)}
                  className={`p-1.5 rounded-md flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                    brightnessPanelOpen
                      ? 'bg-[#10B981]/20 text-[#10B981]'
                      : 'text-slate-400 hover:text-amber-300 hover:bg-amber-500/10'
                  }`}
                  title={`Brilho: ${effectiveBackgroundBrightness}%`}
                  aria-label="Brilho"
                >
                  <Sun className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => solicitarSaidaDoSistema(false)}
                  className="p-1.5 rounded-md text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                  title="Sair / Fechar (Salva Backup do Ponto de Parada)"
                  aria-label="Sair"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>

              {isDesktopExeMode && (
                <button
                  type="button"
                  onClick={() => setWindowsExplorerErpOpen(true)}
                  className="w-full py-1 px-2 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[10px] font-semibold text-slate-200 hover:text-white transition-colors cursor-pointer truncate"
                  title="Abrir Explorer de Arquivos"
                >
                  Explorer & Apps PC
                </button>
              )}
            </div>

            {inlineEditingTabId && (
              <div className="mx-2 mt-2 p-2.5 rounded-lg bg-[#0B1217] border border-white/10 shadow-lg space-y-2 z-40">
                {(() => {
                  const tId = inlineEditingTabId;
                  const baseMeta = DEFAULT_TAB_META[tId];
                  const override = tabOverrides[tId] || {};
                  const currentLabel = override.label ?? baseMeta?.label ?? tId;
                  const currentIcon = override.iconName ?? baseMeta?.iconName ?? 'Sparkles';
                  const currentIconColor = override.iconColor ?? baseMeta?.iconColor ?? '#10B981';
                  const currentCat = categories.find((c) => c.abas.includes(tId));
                  return (
                    <>
                      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                          Personalizar Menu
                        </span>
                        <div className="flex items-center gap-1">
                          {currentCat && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleMoveTabWithinGroup(currentCat.id, tId, -1)}
                                className="p-1 rounded bg-white/5 text-slate-300 hover:text-white cursor-pointer"
                                title="Subir posição"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveTabWithinGroup(currentCat.id, tId, 1)}
                                className="p-1 rounded bg-white/5 text-slate-300 hover:text-white cursor-pointer"
                                title="Descer posição"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => setInlineEditingTabId(null)}
                            className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold cursor-pointer"
                          >
                            OK
                          </button>
                        </div>
                      </div>

                      <input
                        type="text"
                        value={currentLabel}
                        onChange={(e) =>
                          handleInlineUpdateTabOverride(tId, { label: e.target.value })
                        }
                        autoFocus
                        className="w-full px-2 py-1.5 text-xs font-medium rounded bg-[#070C10] border border-white/10 text-white"
                      />

                      <select
                        value={currentCat?.id || ''}
                        onChange={(e) => {
                          const destCatId = e.target.value;
                          const next = categories.map((c) => {
                            const sem = c.abas.filter((x) => x !== tId);
                            if (c.id === destCatId) return { ...c, abas: [...sem, tId] };
                            return { ...c, abas: sem };
                          });
                          handleUpdateCategories(next);
                          setOpenCategoryId(destCatId);
                        }}
                        className="w-full px-2 py-1 text-[11px] rounded bg-[#070C10] border border-white/10 text-white"
                      >
                        {categories.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.titulo}
                          </option>
                        ))}
                      </select>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">Cor do Símbolo:</span>
                          <input
                            type="color"
                            value={currentIconColor}
                            onChange={(e) =>
                              handleInlineUpdateTabOverride(tId, { iconColor: e.target.value })
                            }
                            className="w-5 h-5 rounded cursor-pointer bg-transparent border-0 p-0"
                          />
                        </div>
                        <div className="grid grid-cols-6 gap-1 p-1 rounded bg-[#070C10] border border-white/[0.06]">
                          {MENU_SYMBOL_COLOR_PALETTE.map((cItem) => (
                            <button
                              key={cItem.hex}
                              type="button"
                              onClick={() =>
                                handleInlineUpdateTabOverride(tId, { iconColor: cItem.hex })
                              }
                              title={cItem.nome}
                              style={{ backgroundColor: cItem.hex }}
                              className={`h-4 rounded cursor-pointer transition-transform ${
                                currentIconColor.toUpperCase() === cItem.hex.toUpperCase()
                                  ? 'ring-1 ring-white scale-105'
                                  : 'opacity-80 hover:opacity-100'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-5 gap-1 max-h-24 overflow-y-auto p-1 rounded bg-[#070C10] border border-white/[0.06]">
                        {AVAILABLE_MENU_ICONS.map((ic) => (
                          <button
                            key={ic.name}
                            type="button"
                            onClick={() =>
                              handleInlineUpdateTabOverride(tId, { iconName: ic.name })
                            }
                            title={ic.label}
                            className={`p-1.5 rounded flex items-center justify-center cursor-pointer transition-all ${
                              currentIcon === ic.name
                                ? 'bg-emerald-500/20 ring-1 ring-emerald-400/50'
                                : 'text-slate-300 hover:bg-white/10'
                            }`}
                          >
                            <TabIconSVG
                              tab={tId}
                              iconName={ic.name}
                              iconColor={currentIconColor}
                              className="w-4 h-4"
                            />
                          </button>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            <div
              ref={sidebarScrollRef}
              onScroll={(e) => {
                sidebarScrollPosRef.current = e.currentTarget.scrollTop;
              }}
              className="flex-1 overflow-y-auto py-2 px-2 space-y-1"
            >
              {menuVisualMode === 'dock' ? (
                <div className="flex flex-col items-stretch gap-1">
                  {categories
                    .filter((c) => !isAdminExclusiveCategory(c.id) || isSuperAdminUser(currentUser) || isGestorEmpresaUser(currentUser))
                    .flatMap((c) =>
                    c.abas
                      .filter(canAccessTab)
                      .map((tabId) => {
                        const meta = DEFAULT_TAB_META[tabId];
                        const override = tabOverrides[tabId];
                        const displayLabel = override?.label || meta?.label || tabId;
                        const displayIcon = override?.iconName || meta?.iconName;
                        const displayIconColor = override?.iconColor || meta?.iconColor;
                        const isActive = activeTab === tabId;
                        return (
                          <button
                            key={tabId}
                            type="button"
                            data-drop-tab-id={tabId}
                            data-drop-tab-cat={c.id}
                            draggable
                            onDragStart={(e) => startHtml5TabDrag(e, tabId, c.id)}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                              setDragOverTabId(tabId);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              handleDropOnTabItem(c.id, tabId);
                            }}
                            onDragEnd={clearHtml5DragState}
                            onMouseDown={() => startHoldOnTab(tabId, c.id)}
                            onMouseUp={cancelHoldTimer}
                            onMouseLeave={cancelHoldTimer}
                            onTouchStart={(e) => startHoldOnTab(tabId, c.id, e)}
                            onTouchMove={handleTouchMoveDrag}
                            onTouchEnd={handleTouchEndDrag}
                            onClick={() => {
                              if (holdTriggeredRef.current) {
                                holdTriggeredRef.current = false;
                                return;
                              }
                              handleSelectTab(tabId);
                            }}
                            title={displayLabel}
                            aria-label={displayLabel}
                            className={`w-full py-2 px-1.5 rounded-lg flex flex-col items-center justify-center gap-1 relative transition-colors cursor-pointer ${
                              dragOverTabId === tabId ? 'ring-1 ring-amber-400/60' : ''
                            } ${
                              isActive
                                ? 'amazonia-tab-active'
                                : 'amazonia-tab-inactive'
                            }`}
                          >
                            <TabIconSVG
                              tab={tabId}
                              iconName={displayIcon}
                              iconColor={displayIconColor}
                              className="w-4 h-4 shrink-0"
                            />
                            <span className="text-[10px] font-medium truncate w-full text-center leading-tight">
                              {displayLabel}
                            </span>
                            {isAdminExclusiveTab(tabId) && (
                              <span className="absolute top-1 right-1 px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[7px] font-mono font-bold leading-none">
                                ADM
                              </span>
                            )}
                          </button>
                        );
                      })
                  )}
                </div>
              ) : (
                categories
                  .filter((cat) => !isAdminExclusiveCategory(cat.id) || isSuperAdminUser(currentUser) || isGestorEmpresaUser(currentUser))
                  .map((cat) => {
                  const visibleTabs = cat.abas.filter(canAccessTab);
                  if (visibleTabs.length === 0 && inlineEditingCatId !== cat.id) return null;
                  const isExpanded = !collapsedCategoryIds.includes(cat.id);
                  const isEditingThisCat = inlineEditingCatId === cat.id;
                  const isDragOverThisCat = dragOverCatId === cat.id;
                  const cleanCatTitle = String(cat.titulo || '').replace(/^\d+\.\s*/, '');

                  return (
                    <div
                      key={cat.id}
                      data-drop-cat-id={cat.id}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverCatId(cat.id);
                      }}
                      onDragLeave={() => {
                        if (dragOverCatId === cat.id) setDragOverCatId(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleDropOnCategoryHeader(cat.id);
                      }}
                      className={`rounded-lg overflow-hidden transition-all ${
                        isDragOverThisCat
                          ? 'ring-1 ring-amber-400/50 bg-white/[0.03]'
                          : ''
                      }`}
                    >
                      {isEditingThisCat ? (
                        <div className="p-2 bg-[#0B1217] border border-white/10 rounded-lg space-y-1.5">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-semibold text-slate-300">
                              Grupo & Cor:
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleMoveCategoryOrder(cat.id, -1)}
                                className="p-1 rounded bg-white/5 text-slate-300 hover:text-white cursor-pointer"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveCategoryOrder(cat.id, 1)}
                                className="p-1 rounded bg-white/5 text-slate-300 hover:text-white cursor-pointer"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                              {cat.abas.length === 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleInlineDeleteEmptyGroup(cat.id)}
                                  className="p-1 rounded bg-rose-500/20 text-rose-300 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setInlineEditingCatId(null)}
                                className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold cursor-pointer"
                              >
                                OK
                              </button>
                            </div>
                          </div>
                          <input
                            type="text"
                            value={cleanCatTitle}
                            onChange={(e) => handleInlineRenameCategory(cat.id, e.target.value)}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') setInlineEditingCatId(null);
                            }}
                            className="w-full px-2 py-1 text-xs font-medium rounded bg-[#070C10] border border-white/10 text-white"
                          />
                          <div className="grid grid-cols-6 gap-1 p-1 rounded bg-[#070C10] border border-white/[0.06]">
                            {MENU_SYMBOL_COLOR_PALETTE.map((cItem) => (
                              <button
                                key={cItem.hex}
                                type="button"
                                onClick={() => handleInlineUpdateCategoryColor(cat.id, cItem.hex)}
                                title={cItem.nome}
                                style={{ backgroundColor: cItem.hex }}
                                className={`h-4 rounded cursor-pointer ${
                                  (cat.corSimbolo || '#10B981').toUpperCase() ===
                                  cItem.hex.toUpperCase()
                                    ? 'ring-1 ring-white scale-105'
                                    : 'opacity-80 hover:opacity-100'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          draggable
                          onDragStart={(e) => startHtml5CatDrag(e, cat.id)}
                          onDragEnd={clearHtml5DragState}
                          onMouseDown={() => startHoldOnCategory(cat.id)}
                          onMouseUp={cancelHoldTimer}
                          onMouseLeave={cancelHoldTimer}
                          onTouchStart={(e) => startHoldOnCategory(cat.id, e)}
                          onTouchMove={handleTouchMoveDrag}
                          onTouchEnd={handleTouchEndDrag}
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelHoldTimer();
                            if (holdTriggeredRef.current) {
                              holdTriggeredRef.current = false;
                              return;
                            }
                            handleToggleCategoryCollapse(cat.id);
                          }}
                          className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-white/[0.03] text-left text-[11px] font-semibold tracking-wide text-slate-400 hover:text-slate-200 cursor-pointer transition-colors"
                          title={cleanCatTitle}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <CategorySymbolSVG
                              categoryId={cat.id}
                              colorHex={cat.corSimbolo}
                              className="w-3.5 h-3.5 shrink-0 opacity-80"
                            />
                            <span className="truncate">{cleanCatTitle}</span>
                            {isAdminExclusiveCategory(cat.id) && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-[8px] font-mono font-bold uppercase tracking-wider text-amber-300 shrink-0">
                                ADMIN
                              </span>
                            )}
                          </div>
                          <CestariaGrafismoSVG expanded={isExpanded} className="w-3 h-3 shrink-0 opacity-60" />
                        </button>
                      )}

                      {isExpanded && (
                        <div
                          className={
                            menuVisualMode === 'grid'
                              ? 'p-1 grid grid-cols-2 gap-1'
                              : 'py-0.5 space-y-0.5'
                          }
                        >
                          {visibleTabs.map((tabId) => {
                            const meta = DEFAULT_TAB_META[tabId];
                            const override = tabOverrides[tabId];
                            const displayLabel = override?.label || meta?.label || tabId;
                            const displayIcon = override?.iconName || meta?.iconName;
                            const displayIconColor = override?.iconColor || meta?.iconColor;
                            const isActive = activeTab === tabId;
                            const isBeingEdited = inlineEditingTabId === tabId;
                            const isDragOverItem = dragOverTabId === tabId;

                            const sharedDragAndHoldProps = {
                              'data-drop-tab-id': tabId,
                              'data-drop-tab-cat': cat.id,
                              draggable: true,
                              onDragStart: (e: React.DragEvent) => startHtml5TabDrag(e, tabId, cat.id),
                              onDragOver: (e: React.DragEvent) => {
                                e.preventDefault();
                                e.stopPropagation();
                                e.dataTransfer.dropEffect = 'move';
                                setDragOverTabId(tabId);
                              },
                              onDragLeave: () => {
                                if (dragOverTabId === tabId) setDragOverTabId(null);
                              },
                              onDrop: (e: React.DragEvent) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDropOnTabItem(cat.id, tabId);
                              },
                              onDragEnd: clearHtml5DragState,
                              onMouseDown: () => startHoldOnTab(tabId, cat.id),
                              onMouseUp: cancelHoldTimer,
                              onMouseLeave: cancelHoldTimer,
                              onTouchStart: (e: React.TouchEvent) => startHoldOnTab(tabId, cat.id, e),
                              onTouchMove: handleTouchMoveDrag,
                              onTouchEnd: handleTouchEndDrag,
                              onClick: () => {
                                if (holdTriggeredRef.current) {
                                  holdTriggeredRef.current = false;
                                  return;
                                }
                                handleSelectTab(tabId);
                              },
                              title: displayLabel
                            };

                            if (menuVisualMode === 'grid') {
                              const adminTab = isAdminExclusiveTab(tabId);
                              return (
                                <button
                                  key={tabId}
                                  type="button"
                                  {...sharedDragAndHoldProps}
                                  className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg text-center transition-colors cursor-pointer relative ${
                                    isDragOverItem ? 'ring-1 ring-amber-400/60' : ''
                                  } ${
                                    isBeingEdited ? 'ring-1 ring-amber-400/60 bg-amber-500/15' : ''
                                  } ${
                                    isActive
                                      ? adminTab
                                        ? 'bg-amber-500/15 border border-amber-500/30 text-amber-200'
                                        : 'amazonia-tab-active'
                                      : adminTab
                                      ? 'text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/10'
                                      : 'amazonia-tab-inactive'
                                  }`}
                                >
                                  {adminTab && (
                                    <span className="px-1 py-0.2 rounded bg-amber-500/15 text-[8px] font-mono font-bold uppercase tracking-wider text-amber-300 leading-tight">
                                      ADMIN
                                    </span>
                                  )}
                                  <TabIconSVG
                                    tab={tabId}
                                    iconName={displayIcon}
                                    iconColor={displayIconColor}
                                    className="w-4 h-4 shrink-0"
                                  />
                                  <span className="text-[11px] font-medium truncate w-full leading-tight">
                                    {displayLabel}
                                  </span>
                                </button>
                              );
                            }

                            const adminTab = isAdminExclusiveTab(tabId);
                            return (
                              <button
                                key={tabId}
                                type="button"
                                {...sharedDragAndHoldProps}
                                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors whitespace-nowrap cursor-pointer ${
                                  isDragOverItem ? 'ring-1 ring-amber-400/60' : ''
                                } ${
                                  isBeingEdited ? 'ring-1 ring-amber-400/60 bg-amber-500/15' : ''
                                } ${
                                  isActive
                                    ? adminTab
                                      ? 'bg-amber-500/15 border border-amber-500/30 text-amber-200 font-medium'
                                      : 'amazonia-tab-active'
                                    : adminTab
                                    ? 'text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/10'
                                    : 'amazonia-tab-inactive'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <TabIconSVG
                                    tab={tabId}
                                    iconName={displayIcon}
                                    iconColor={displayIconColor}
                                    className="w-4 h-4 shrink-0"
                                  />
                                  <span className="truncate">{displayLabel}</span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {adminTab && (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-[8px] font-mono font-bold uppercase text-amber-300">
                                      ADMIN
                                    </span>
                                  )}
                                  {isActive && <span className="tapiri-orb-turquoise" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {menuVisualMode !== 'dock' && (
              <div
                onMouseDown={() => setIsResizingSidebar(true)}
                className="w-2 -right-2 bg-transparent hover:bg-[#10B981]/35 border-l border-transparent hover:border-[#10B981]/80 cursor-col-resize absolute top-0 bottom-0 z-30 transition-colors"
                title="Arraste para redimensionar"
              />
            )}
          </aside>
        )}

        <main
          ref={mainViewportRef}
          onScroll={(e) => {
            tabScrollMemoryRef.current[activeTab] = e.currentTarget.scrollTop;
          }}
          className={`flex-1 w-full min-w-0 p-3.5 sm:p-6 pb-24 overflow-x-hidden transition-colors duration-300 ${
            isCurrentTabSystematicAdmin ? 'systematic-admin-main' : 'bg-[#0C1117]'
          }`}
        >

          {brightnessPanelOpen && (
            <div className="mb-4 p-4 rounded-2xl bg-[#11151E] border border-[#10B981]/40 shadow-lg space-y-3">
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setBrightnessPanelOpen(false)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 inline-flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Fechar</span>
                </button>
              </div>
              <BackgroundBrightnessControlPanel
                effectiveBrightness={effectiveBackgroundBrightness}
                adminMasterBrightness={adminMasterBrightness}
                userBrightnessOverride={userBrightnessOverride}
                isAdminMaster={isSuperAdminUser(currentUser)}
                userName={currentUser?.nome}
                onChangeBrightness={handleUpdateBackgroundBrightness}
                compact
              />
            </div>
          )}

          {isCurrentTabSystematicAdmin && (
            <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-[#2D0E1E]/95 via-[#281509]/95 to-[#131128]/95 border border-amber-400/60 flex flex-wrap items-center justify-between gap-2 shadow-xl">
              <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-300">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <span> Ambiente Sistemático • Exclusivo Admin Master</span>
              </div>
              <span className="text-[11px] text-amber-100/90 font-medium">
                Fundo diferenciado de governança ativo: você está alterando parâmetros sistemáticos do ERP / Servidor VPS.
              </span>
            </div>
          )}
          
          {nivelAcessoLicencaAtiva === 'somente_leitura' && (
            <div className="mb-4 p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-500/50 flex flex-wrap items-center justify-between gap-3 shadow-lg">
              <div className="space-y-0.5">
                <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-300">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Assinatura em Modo Somente Consulta ({empresaAtivaObj?.nome || 'Empresa'})
                  </span>
                </div>
                <p className="text-xs text-amber-100/90">
                  O acesso está liberado para visualizar relatórios, consultar histórico e exportar seus dados. Novos cadastros e edições estão pausados até a renovação.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadCompanyAutonomyBackup(empresaAtivaObj?.nome || 'Empresa')}
                  className="px-3 py-1.5 rounded-xl bg-amber-400 text-slate-950 font-black text-xs cursor-pointer hover:bg-amber-300"
                >
                   Baixar Backup dos Dados
                </button>
                {isSuperAdminUser(realOperatorUser) && (
                  <button
                    type="button"
                    onClick={handleQuickRestoreFullLicense}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs cursor-pointer hover:bg-emerald-400"
                  >
                     Liberar Uso Completo
                  </button>
                )}
              </div>
            </div>
          )}

          {(() => {
            const cfgCust: any = empresaAtivaObj?.lgpd_custodia_config || {};
            const driveConectado = Boolean(
              (cfgCust.pasta_google_drive_id && String(cfgCust.pasta_google_drive_id).trim().length > 0) ||
                (cfgCust.planilha_google_id && String(cfgCust.planilha_google_id).trim().length > 0) ||
                (cfgCust.apps_script_webhook_url && String(cfgCust.apps_script_webhook_url).startsWith('https://')) ||
                (cfgCust.conta_google_vinculada && String(cfgCust.conta_google_vinculada).includes('@'))
            );
            const outroPcPendente = Boolean(
              !driveConectado &&
                estadoFechamentoLocal?.aguardando_primeiro_pc &&
                estadoFechamentoLocal?.ultimo_pc_id &&
                estadoFechamentoLocal.ultimo_pc_id !== meuPcId
            );
            const confirmadoSemDrive = Boolean(cfgCust.multiacesso_sem_drive_confirmado === true);
            const empIdAtual = Number(selectedEmpresaId || currentUser?.empresas_ids?.[0] || 1);

            return (
              <>
                {recuperacaoConcluidaMsg && (
                  <div className="mb-4 p-4 rounded-2xl bg-emerald-500/15 border-2 border-emerald-500/50 flex items-center justify-between gap-3 shadow-lg">
                    <div className="text-xs text-emerald-100 font-semibold leading-relaxed">
                      {recuperacaoConcluidaMsg}
                    </div>
                    <button
                      type="button"
                      onClick={() => setRecuperacaoConcluidaMsg('')}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs cursor-pointer shrink-0"
                    >
                      OK
                    </button>
                  </div>
                )}

                {outroPcPendente && outroPcCienteContinuar && (
                  <div className="mb-4 p-4 rounded-2xl bg-rose-500/15 border-2 border-rose-500/60 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-lg">
                    <div className="space-y-1">
                      <div className="text-xs font-black uppercase tracking-wider text-rose-300">
                        Aviso: Este Computador Não Possui Os Dados Mais Recentes
                      </div>
                      <p className="text-xs text-rose-100/95 leading-relaxed">
                        O último computador usado sem Google Drive foi{' '}
                        <strong>{estadoFechamentoLocal?.ultimo_pc_apelido || 'outro computador'}</strong>
                        {estadoFechamentoLocal?.fechado_em
                          ? ` em ${new Date(estadoFechamentoLocal.fechado_em).toLocaleString('pt-BR')}`
                          : ''}
                        . Você pode continuar usando normalmente e <strong>recuperar o atraso depois sem perder nada</strong>: assim que aquele computador for ligado e entrar no sistema (ou se você carregar a cópia salva dele aqui), o sistema juntará os dois sem apagar o que você lançar hoje.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={verificandoOutroPc}
                        onClick={async () => {
                          setVerificandoOutroPc(true);
                          try {
                            const r = await fetch(`/api/lgpd/vps-processador/status/${empIdAtual}`);
                            const j = await r.json();
                            if (j?.ok) {
                              setEstadoFechamentoLocal(j.drive_conectado ? null : j.estado_fechamento_local || null);
                            }
                            await fetchAllData();
                          } catch {} finally {
                            setVerificandoOutroPc(false);
                          }
                        }}
                        className="px-3.5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-black text-xs cursor-pointer disabled:opacity-50"
                      >
                        {verificandoOutroPc ? 'Verificando...' : 'Verificar Se Já Subiu'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('config')}
                        className="px-3.5 py-2 rounded-xl bg-[#0C1117] hover:bg-slate-900 border border-emerald-500/50 text-emerald-300 font-bold text-xs cursor-pointer"
                      >
                        Conectar Google Drive
                      </button>
                    </div>
                  </div>
                )}

                {computadoresAtivosEmpresa >= 2 && !driveConectado && !confirmadoSemDrive && (
                  <div className="mb-4 p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-500/50 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-lg">
                    <div className="space-y-1">
                      <div className="text-xs font-black uppercase tracking-wider text-amber-300">
                        {computadoresAtivosEmpresa} Computadores Conectados Ao Mesmo Tempo Sem Google Drive
                      </div>
                      <p className="text-xs text-amber-100/90 leading-relaxed">
                        Enquanto estiverem abertos juntos, todos veem as alterações na hora. Porém, sem Google Drive conectado, quando o <strong>último computador fechar</strong>, a versão final ficará salva apenas nesse último computador — no dia seguinte, abra primeiro por ele para não perder dados.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setActiveTab('config')}
                        className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer"
                      >
                        Conectar Meu Google Drive (Recomendado)
                      </button>
                      <button
                        type="button"
                        disabled={bannerMultiacessoSaving}
                        onClick={async () => {
                          setBannerMultiacessoSaving(true);
                          try {
                            await fetch('/api/lgpd/vps-processador/definir-modo-multiacesso', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                empresa_id: empIdAtual,
                                modo_guarda_escolhido: 'computador_local_multiacesso',
                                multiacesso_sem_drive_confirmado: true,
                                usuario_nome: currentUser?.nome || empresaAtivaObj?.nome
                              })
                            });
                            await fetchAllData();
                          } catch {} finally {
                            setBannerMultiacessoSaving(false);
                          }
                        }}
                        className="px-3.5 py-2 rounded-xl bg-[#0C1117] hover:bg-slate-900 border border-amber-400/60 text-amber-200 font-bold text-xs cursor-pointer disabled:opacity-50"
                      >
                        {bannerMultiacessoSaving
                          ? 'Confirmando...'
                          : 'Entendi as Orientações e Quero Continuar Sem Drive'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {nivelAcessoLicencaAtiva === 'somente_download' && activeTab !== 'empresas' ? (
            <div className="max-w-3xl mx-auto my-6 bg-[#11151E] border-2 border-amber-500/60 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0">
                  <Lock className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold uppercase tracking-wider">
                    Modalidade Definida pela Administração: Somente Download de Dados
                  </span>
                  <h2 className="text-xl font-bold text-white">
                    Seus Dados Estão Íntegros e Disponíveis para Exportação — {empresaAtivaObj?.nome || 'Empresa'}
                  </h2>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    A assinatura operacional desta empresa encontra-se pausada no modo <strong>Só Baixar os Dados</strong>. Como o Urutau respeita a autonomia total do empresário, você pode baixar 100% da base de dados da sua empresa agora mesmo para continuar trabalhando no seu próprio sistema ou planilhas.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-[#0B0D11] border border-slate-800">
                  <div className="text-[11px] text-slate-400">Colaboradores</div>
                  <div className="text-lg font-mono font-black text-emerald-400 mt-0.5">
                    {(erpData.usuarios || []).length}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#0B0D11] border border-slate-800">
                  <div className="text-[11px] text-slate-400">Lançamentos de Caixa</div>
                  <div className="text-lg font-mono font-black text-amber-300 mt-0.5">
                    {(erpData.caixa || []).length}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#0B0D11] border border-slate-800">
                  <div className="text-[11px] text-slate-400">Itens de Estoque</div>
                  <div className="text-lg font-mono font-black text-cyan-300 mt-0.5">
                    {(erpData.estoque || []).length}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#0B0D11] border border-slate-800">
                  <div className="text-[11px] text-slate-400">Unidades & Cadastros</div>
                  <div className="text-lg font-mono font-black text-purple-300 mt-0.5">
                    {(erpData.unidades || []).length + (erpData.cadastrosPessoas || []).length}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => downloadCompanyAutonomyBackup(empresaAtivaObj?.nome || 'Empresa')}
                  className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer shadow-lg"
                >
                   Baixar Pacote Completo de Dados da Empresa (.JSON / Planilha)
                </button>
                <button
                  type="button"
                  onClick={() => downloadUrutauWindowsInstaller(empresaAtivaObj?.nome || 'Empresa')}
                  className="px-4 py-3 rounded-xl bg-[#0B0D11] hover:bg-slate-900 border border-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
                >
                   Baixar Urutau.exe (App Fechado Desktop)
                </button>
              </div>

              {isSuperAdminUser(realOperatorUser) && (
                <div className="p-4 rounded-xl bg-[#0B0D11] border border-amber-500/40 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-amber-200">
                    <strong> Controle Manual do Super Admin:</strong> Você pode alterar o nível desta empresa a qualquer momento.
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleQuickRestoreFullLicense}
                      className="px-3.5 py-2 rounded-lg bg-emerald-500 text-slate-950 font-black text-xs cursor-pointer"
                    >
                       Liberar Uso Completo Agora
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectTab('empresas')}
                      className="px-3.5 py-2 rounded-lg bg-amber-500/20 border border-amber-400/50 text-amber-200 font-bold text-xs cursor-pointer"
                    >
                      Abrir Painel de Empresas
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (activeTabBlockedByGeofence || activeTabBlockedByShift) ? (
            <div className="max-w-2xl mx-auto my-6 bg-[#11151E] border-2 border-rose-500/50 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                  <Lock className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-mono font-bold uppercase tracking-wider">
                    Bloqueio de Segurança Operacional Registrado nos Logs
                  </span>
                  <h2 className="text-lg font-bold text-white">
                    Acesso Restrito a "{tabOverrides[activeTab]?.label || DEFAULT_TAB_META[activeTab]?.label || activeTab}"
                  </h2>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Por determinação de segurança da empresa, esta funcionalidade possui trava automática de{' '}
                    {activeTabBlockedByGeofence && activeTabBlockedByShift
                      ? 'Perímetro Físico (Geofence) e Horário de Turno'
                      : activeTabBlockedByGeofence
                      ? 'Localização Dentro da Empresa (Geofence)'
                      : 'Horário de Turno Operacional'}.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div
                  className={`p-3.5 rounded-xl border ${
                    activeTabBlockedByGeofence
                      ? 'bg-rose-500/10 border-rose-500/40 text-rose-200'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5 mb-1">
                    <MapPin className="w-4 h-4 shrink-0" />
                    <span>Perímetro da Empresa (Geofence)</span>
                  </div>
                  <div className="font-mono text-[11px]">
                    Distância atual: <strong>{distanciaEmpresaMetros}m</strong> (Raio permitido:{' '}
                    {securityGeofenceConfig.raioPermitidoMetros}m)
                  </div>
                  <div className="text-[11px] mt-1 opacity-90">
                    Status: {usuarioDentroDaEmpresa ? ' Dentro da Empresa' : ' Fora da Empresa'}
                  </div>
                </div>

                <div
                  className={`p-3.5 rounded-xl border ${
                    activeTabBlockedByShift
                      ? 'bg-rose-500/10 border-rose-500/40 text-rose-200'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5 mb-1">
                    <Clock className="w-4 h-4 shrink-0" />
                    <span>Escala & Turno do Colaborador</span>
                  </div>
                  <div className="font-mono text-[11px]">
                    Janela de Turno: <strong>{securityGeofenceConfig.horarioInicioTurnoPadrao}</strong> às{' '}
                    <strong>{securityGeofenceConfig.horarioFimTurnoPadrao}</strong>
                  </div>
                  <div className="text-[11px] mt-1 opacity-90">
                    Status: {usuarioEmTurnoAtivo ? ' Em Turno Ativo' : ' Fora de Turno'}
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0B0D11] border border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-slate-400">
                  Calibração Rápida de Localização / Turno:
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {activeTabBlockedByGeofence && (
                    <button
                      type="button"
                      onClick={() => handleSimulateGpsPosition(true)}
                      className="px-3 py-1.5 rounded-lg bg-[#10B981] text-[#05100C] font-bold text-xs cursor-pointer"
                    >
                       Calibrar Entrada na Empresa (0m)
                    </button>
                  )}
                  {activeTabBlockedByShift && (
                    <button
                      type="button"
                      onClick={() => setSimulatedShiftMode('em_turno')}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer"
                    >
                       Confirmar Entrada em Turno
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div
              key={activeTab}
              className={`w-full tab-content-enter ${ssePulseActive ? 'sse-bioluminescent-pulse rounded-xl' : ''}`}
            >
              <CleanModuleShell
                activeTab={activeTab}
                customLabel={tabOverrides[activeTab]?.label}
                companySubdomain={
                  portalSubdominioInput ||
                  empresaAtivaObj?.subdominio ||
                  brandConfig.companyName ||
                  empresaAtivaObj?.nome ||
                  'empresa'
                }
                initialSubTabSlug={activeSubTabSlug}
                onSubTabChange={(slug) => setActiveSubTabSlug(slug)}
              >
                {activeTab === 'home' && (
                  <HomeDashboardHub
                    data={erpData}
                    currentUser={currentUser}
                    companyName={brandConfig.companyName || empresaAtivaObj?.nome || 'Empresa'}
                    companySubdomain={
                      portalSubdominioInput ||
                      empresaAtivaObj?.subdominio ||
                      brandConfig.companyName ||
                      empresaAtivaObj?.nome ||
                      'empresa'
                    }
                    onNavigateTab={(tId, sSlug) => handleSelectTab(tId, sSlug)}
                  />
                )}
                {activeTab === 'modulos' && (
                  <ModulosDirectoryHub
                    companySubdomain={
                      portalSubdominioInput ||
                      empresaAtivaObj?.subdominio ||
                      brandConfig.companyName ||
                      empresaAtivaObj?.nome ||
                      'empresa'
                    }
                    companyName={brandConfig.companyName || empresaAtivaObj?.nome || 'Empresa'}
                    categories={categories}
                    onNavigateModuleSubTab={(tId, sSlug) => handleSelectTab(tId, sSlug)}
                  />
                )}
                {activeTab === 'empresas' && <EmpresasTab {...commonProps} />}
              {activeTab === 'freelancers' && <FreelancersTab {...commonProps} />}
              {activeTab === 'rateio' && <CaixaTab {...commonProps} initialSubArea="rateio" />}
              {activeTab === 'escalas' && <EscalasTab {...commonProps} />}
              {activeTab === 'agenda' && <AgendaTab {...commonProps} />}
              {activeTab === 'pdv' && (
                <PdvHibridoTab
                  {...commonProps}
                  currentUser={currentUser}
                  deepLinkMesaCodigo={deepLinkMesaCodigo}
                />
              )}
              {activeTab === 'reservas' && <ReservasTab {...commonProps} />}
              {activeTab === 'portais' && <PortaisTab {...commonProps} />}
              {activeTab === 'chat' && <WhatsAppAiHub {...commonProps} />}
              {activeTab === 'caixa' && <CaixaTab {...commonProps} />}
              {activeTab === 'estoque' && <EstoqueTab {...commonProps} />}
              {activeTab === 'compras' && <ComprasTab {...commonProps} />}
              {activeTab === 'cmv' && <CMVTab {...commonProps} />}
              {activeTab === 'cadastros' && (
                <CadastrosPessoasTab {...commonProps} currentUser={currentUser} />
              )}
              {activeTab === 'cargos' && <CargosTab {...commonProps} />}
              {activeTab === 'equipe' && <EquipeTab {...commonProps} />}
              {activeTab === 'selecao' && (
                <RHTab {...commonProps} initialSubView="selecao" />
              )}
              {activeTab === 'rh' && (
                <RHTab {...commonProps} initialSubView={rhInitialSubView} />
              )}
              {activeTab === 'unidades' && (
                <UnidadesTab
                  {...commonProps}
                  securityGeofenceConfig={securityGeofenceConfig}
                  onUpdateSecurityGeofenceConfig={handleUpdateSecurityGeofenceConfig}
                  userGpsLocation={userGpsLocation}
                  onCalibrateGpsToCoords={handleCalibrateGpsToCoords}
                />
              )}
              {activeTab === 'setores' && <SetoresTab {...commonProps} />}
              {activeTab === 'checklists' && <ChecklistsTab {...commonProps} />}
              {activeTab === 'notificacoes' && (
                <NotificacoesTab {...commonProps} sseEventHistory={sseEvents} />
              )}
              {activeTab === 'auditoria' && (
                <AuditLogsTab
                  {...commonProps}
                  currentUser={currentUser}
                  securityGeofenceConfig={securityGeofenceConfig}
                  onUpdateSecurityGeofenceConfig={handleUpdateSecurityGeofenceConfig}
                  userGpsLocation={userGpsLocation}
                  onSimulateGpsPosition={handleSimulateGpsPosition}
                  simulatedShiftMode={simulatedShiftMode}
                  onChangeSimulatedShiftMode={setSimulatedShiftMode}
                />
              )}
              {(activeTab === 'config' ||
                activeTab === 'permissoes' ||
                activeTab === 'servidor_ia') && (
                <ConfigTab
                  {...commonProps}
                  modoMenuIndividual={
                    activeTab === 'servidor_ia'
                      ? 'servidor_ia'
                      : activeTab === 'permissoes'
                      ? 'permissoes'
                      : 'aparencia'
                  }
                  inactivityLimitSec={inactivityLimitSec}
                  onChangeInactivityLimit={(sec) => {
                    setInactivityLimitSec(sec);
                    setSecondsRemaining(sec);
                  }}
                  currentAccentHex={accentHex}
                  onChangeAccentColor={applyAccentTheme}
                  categories={categories}
                  onUpdateCategories={handleUpdateCategories}
                  tabOverrides={tabOverrides}
                  onUpdateTabOverrides={handleUpdateTabOverrides}
                  menuPosition={menuPosition}
                  onChangeMenuPosition={(pos) => {
                    setMenuPosition(pos);
                    setSidebarCollapsed(false);
                  }}
                  brandConfig={brandConfig}
                  onUpdateBrandConfig={handleUpdateBrandConfig}
                  vpsUpdateCmd={vpsUpdateOneLineCmd}
                  securityGeofenceConfig={securityGeofenceConfig}
                  onUpdateSecurityGeofenceConfig={handleUpdateSecurityGeofenceConfig}
                  userGpsLocation={userGpsLocation}
                  onSimulateGpsPosition={handleSimulateGpsPosition}
                  simulatedShiftMode={simulatedShiftMode}
                  onChangeSimulatedShiftMode={setSimulatedShiftMode}
                  effectiveBrightness={effectiveBackgroundBrightness}
                  adminMasterBrightness={adminMasterBrightness}
                  userBrightnessOverride={userBrightnessOverride}
                  onChangeBackgroundBrightness={handleUpdateBackgroundBrightness}
                />
              )}
              </CleanModuleShell>
            </div>
          )}
        </main>
      </div>

      
      {menuPosition === 'bottom' && (
        <nav className="fixed bottom-0 left-0 right-0 h-16 amazonia-bottom-nav z-50 flex items-center px-3 gap-1">
          <button
            type="button"
            onClick={() => setMenuPosition('left')}
            className="p-2 text-slate-200 hover:text-white rounded shrink-0 cursor-pointer"
            title="Alternar para Barra Vertical Esquerda"
          >
            <PanelLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() =>
              bottomBarScrollRef.current?.scrollBy({ left: -240, behavior: 'smooth' })
            }
            className="p-2 text-slate-300 hover:bg-black/25 rounded shrink-0 cursor-pointer"
            aria-label="Rolar menu para a esquerda"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div
            ref={bottomBarScrollRef}
            className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1"
          >
            {categories.flatMap((c) =>
              c.abas
                .filter(canAccessTab)
                .map((tabId) => {
                  const meta = DEFAULT_TAB_META[tabId];
                  const override = tabOverrides[tabId];
                  const displayLabel = override?.label || meta?.label || tabId;
                  const displayIcon = override?.iconName || meta?.iconName;
                  const displayIconColor = override?.iconColor || meta?.iconColor;
                  const isActive = activeTab === tabId;
                  return (
                    <button
                      key={tabId}
                      type="button"
                      data-drop-tab-id={tabId}
                      data-drop-tab-cat={c.id}
                      draggable
                      onDragStart={(e) => startHtml5TabDrag(e, tabId, c.id)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        setDragOverTabId(tabId);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleDropOnTabItem(c.id, tabId);
                      }}
                      onDragEnd={clearHtml5DragState}
                      onMouseDown={() => startHoldOnTab(tabId, c.id)}
                      onMouseUp={cancelHoldTimer}
                      onMouseLeave={cancelHoldTimer}
                      onTouchStart={(e) => startHoldOnTab(tabId, c.id, e)}
                      onTouchMove={handleTouchMoveDrag}
                      onTouchEnd={handleTouchEndDrag}
                      onClick={() => {
                        if (holdTriggeredRef.current) {
                          holdTriggeredRef.current = false;
                          return;
                        }
                        handleSelectTab(tabId);
                      }}
                      title={displayLabel}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                        dragOverTabId === tabId ? 'ring-2 ring-amber-400' : ''
                      } ${isActive ? 'amazonia-tab-active' : 'amazonia-tab-inactive'}`}
                    >
                      <TabIconSVG
                        tab={tabId}
                        iconName={displayIcon}
                        iconColor={displayIconColor}
                        className="w-3.5 h-3.5"
                      />
                      <span>{displayLabel}</span>
                      {isAdminExclusiveTab(tabId) && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/25 border border-amber-400/60 text-[8px] font-mono font-black uppercase text-amber-300">
                           ADMIN
                        </span>
                      )}
                      {isActive && <span className="tapiri-orb-turquoise" />}
                    </button>
                  );
                })
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              bottomBarScrollRef.current?.scrollBy({ left: 240, behavior: 'smooth' })
            }
            className="p-2 text-slate-300 hover:bg-black/25 rounded shrink-0 cursor-pointer"
            aria-label="Rolar menu para a direita"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </nav>
      )}

      
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[65] flex items-stretch justify-start">
          <div
            className="fixed inset-0 penumbra-da-mata-backdrop transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          <div className="relative w-[84%] max-w-[320px] h-full tapiri-sidebar border-r border-white/10 flex flex-col shadow-2xl z-10">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="tapiri-sidebar-protrusion"
              title="Recolher Menu Lateral"
              aria-label="Recolher Menu Lateral"
            >
              <ChevronLeft className="w-4 h-4 stroke-[2.6]" />
            </button>
            <div className="p-3 border-b border-white/10 flex items-center justify-between gap-2 bg-black/25">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setBrandShowcaseOpen(true);
                }}
                className="flex items-center gap-2 min-w-0 cursor-pointer text-left"
                title="Personalizar Identidade Visual e Cores da Empresa"
              >
                <SystemSlotImage
                  slot="topo_painel"
                  brandConfig={brandConfig}
                  ssePulse={ssePulseActive}
                  className="w-9 h-7 shrink-0"
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-black tracking-[0.1em] text-white uppercase truncate">
                    {brandConfig.companyName || 'URUTAU'}
                  </span>
                </div>
              </button>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleResetMenusPadrao}
                  className="p-2 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-200 cursor-pointer"
                  title="Restaurar Menus Padrões"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 text-slate-300 hover:text-white rounded-lg cursor-pointer"
                  aria-label="Fechar menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            
            <div className="px-3 py-2 border-b border-white/10 bg-black/20 grid grid-cols-1 gap-1.5">
              {erpData.empresas && erpData.empresas.length > 0 && (
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#0A1F17] border border-[#10B981]/25">
                  <Building2 className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
                  <select
                    value={selectedEmpresaId ?? ''}
                    onChange={(e) =>
                      setSelectedEmpresaId(e.target.value ? Number(e.target.value) : null)
                    }
                    className="!bg-transparent !border-none text-xs font-bold text-[#F8FAFC] focus:outline-none truncate w-full !p-0"
                  >
                    {isSuperAdminUser(currentUser) && (
                      <option value="" className="bg-[#071712] text-[#F8FAFC]">
                         Rede Completa ({erpData.empresas.length})
                      </option>
                    )}
                    {erpData.empresas
                      .filter(
                        (emp) =>
                          isSuperAdminUser(currentUser) ||
                          (Array.isArray(currentUser?.empresas_ids) &&
                            currentUser.empresas_ids.map(Number).includes(Number(emp.id))) ||
                          Number(selectedEmpresaId) === Number(emp.id)
                      )
                      .map((emp) => (
                        <option key={emp.id} value={emp.id} className="bg-[#071712] text-[#F8FAFC]">
                           {emp.nome}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {podeSimularColaboradores && colaboradoresSimulaveis.length > 1 && (
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#0A1F17] border border-[#F59E0B]/30">
                  <Eye className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
                  <select
                    value={currentUser?.id || ''}
                    onChange={(e) => {
                      const alvo = colaboradoresSimulaveis.find(
                        (u: any) => Number(u.id) === Number(e.target.value)
                      );
                      if (alvo) handleTrocarVisaoColaborador(alvo);
                    }}
                    className="!bg-transparent !border-none text-xs font-bold text-[#F8FAFC] focus:outline-none truncate w-full !p-0"
                  >
                    {colaboradoresSimulaveis.map((u: any) => (
                      <option key={u.id} value={u.id} className="bg-[#071712] text-[#F8FAFC]">
                        {Number(u.id) === Number(realOperatorUser?.id)
                          ? ` Minha Visão (${u.nome})`
                          : ` Ver como: ${u.nome}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            
            {inlineEditingTabId && (
              <div className="mx-3 mt-2 p-3 rounded-xl bg-[#071712] border-2 border-amber-400 shadow-xl space-y-2.5 z-40">
                {(() => {
                  const tId = inlineEditingTabId;
                  const baseMeta = DEFAULT_TAB_META[tId];
                  const override = tabOverrides[tId] || {};
                  const currentLabel = override.label ?? baseMeta?.label ?? tId;
                  const currentIcon = override.iconName ?? baseMeta?.iconName ?? 'Sparkles';
                  const currentIconColor = override.iconColor ?? baseMeta?.iconColor ?? '#10B981';
                  const currentCat = categories.find((c) => c.abas.includes(tId));
                  return (
                    <>
                      <div className="flex items-center justify-between gap-2 border-b border-emerald-900/60 pb-1.5">
                        <span className="text-[11px] font-black uppercase text-amber-300 truncate">
                          Personalizar: {currentLabel}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {currentCat && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleMoveTabWithinGroup(currentCat.id, tId, -1)}
                                className="p-1 rounded bg-black/50 border border-white/10 text-slate-200 cursor-pointer"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveTabWithinGroup(currentCat.id, tId, 1)}
                                className="p-1 rounded bg-black/50 border border-white/10 text-slate-200 cursor-pointer"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => setInlineEditingTabId(null)}
                            className="px-2.5 py-1 rounded bg-emerald-500 text-slate-950 text-[11px] font-bold cursor-pointer"
                          >
                            OK
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={currentLabel}
                          onChange={(e) =>
                            handleInlineUpdateTabOverride(tId, { label: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 text-xs font-bold rounded bg-[#05100C] border border-amber-400 text-white"
                        />
                        <select
                          value={currentCat?.id || ''}
                          onChange={(e) => {
                            const destCatId = e.target.value;
                            const next = categories.map((c) => {
                              const sem = c.abas.filter((x) => x !== tId);
                              if (c.id === destCatId) return { ...c, abas: [...sem, tId] };
                              return { ...c, abas: sem };
                            });
                            handleUpdateCategories(next);
                            setOpenCategoryId(destCatId);
                          }}
                          className="w-full px-2 py-1.5 text-xs rounded bg-[#05100C] border border-slate-700 text-white"
                        >
                          {categories.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.titulo}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-6 gap-1.5 p-1.5 rounded bg-[#05100C] border border-slate-800">
                        {MENU_SYMBOL_COLOR_PALETTE.map((cItem) => (
                          <button
                            key={cItem.hex}
                            type="button"
                            onClick={() =>
                              handleInlineUpdateTabOverride(tId, { iconColor: cItem.hex })
                            }
                            title={cItem.nome}
                            style={{ backgroundColor: cItem.hex }}
                            className={`h-5 rounded-md cursor-pointer ${
                              currentIconColor.toUpperCase() === cItem.hex.toUpperCase()
                                ? 'ring-2 ring-white scale-105'
                                : 'opacity-85'
                            }`}
                          />
                        ))}
                      </div>

                      <div className="grid grid-cols-6 gap-1 max-h-24 overflow-y-auto p-1 rounded bg-[#05100C] border border-slate-800">
                        {AVAILABLE_MENU_ICONS.map((ic) => (
                          <button
                            key={ic.name}
                            type="button"
                            onClick={() =>
                              handleInlineUpdateTabOverride(tId, { iconName: ic.name })
                            }
                            className={`p-1.5 rounded flex items-center justify-center cursor-pointer ${
                              currentIcon === ic.name
                                ? 'bg-amber-500/25 ring-1 ring-amber-400'
                                : 'text-slate-300'
                            }`}
                          >
                            <TabIconSVG
                              tab={tId}
                              iconName={ic.name}
                              iconColor={currentIconColor}
                              className="w-4 h-4"
                            />
                          </button>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
              {menuVisualMode === 'dock' ? (
                <div className="grid grid-cols-3 gap-2">
                  {categories.flatMap((c) =>
                    c.abas
                      .filter(canAccessTab)
                      .map((tabId) => {
                        const meta = DEFAULT_TAB_META[tabId];
                        const override = tabOverrides[tabId];
                        const displayLabel = override?.label || meta?.label || tabId;
                        const displayIcon = override?.iconName || meta?.iconName;
                        const displayIconColor = override?.iconColor || meta?.iconColor;
                        const isActive = activeTab === tabId;
                        return (
                          <button
                            key={tabId}
                            type="button"
                            data-drop-tab-id={tabId}
                            data-drop-tab-cat={c.id}
                            draggable
                            onDragStart={(e) => startHtml5TabDrag(e, tabId, c.id)}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                              setDragOverTabId(tabId);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              handleDropOnTabItem(c.id, tabId);
                            }}
                            onDragEnd={clearHtml5DragState}
                            onMouseDown={() => startHoldOnTab(tabId, c.id)}
                            onMouseUp={cancelHoldTimer}
                            onTouchStart={(e) => startHoldOnTab(tabId, c.id, e)}
                            onTouchMove={handleTouchMoveDrag}
                            onTouchEnd={handleTouchEndDrag}
                            onClick={() => {
                              if (holdTriggeredRef.current) {
                                holdTriggeredRef.current = false;
                                return;
                              }
                              handleSelectTab(tabId);
                              setMobileMenuOpen(false);
                            }}
                            title={displayLabel}
                            className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl transition-all cursor-pointer relative ${
                              dragOverTabId === tabId ? 'ring-2 ring-amber-400 scale-105' : ''
                            } ${
                              isActive
                                ? 'amazonia-tab-active shadow-lg'
                                : 'bg-black/30 text-slate-300 hover:text-white hover:bg-[#113025] border border-white/10'
                            }`}
                          >
                            <TabIconSVG
                              tab={tabId}
                              iconName={displayIcon}
                              iconColor={displayIconColor}
                              className="w-6 h-6 shrink-0"
                            />
                            <span className="text-[10px] font-bold truncate w-full text-center leading-tight">
                              {displayLabel}
                            </span>
                          </button>
                        );
                      })
                  )}
                </div>
              ) : (
                categories
                  .filter((cat) => !isAdminExclusiveCategory(cat.id) || isSuperAdminUser(currentUser) || isGestorEmpresaUser(currentUser))
                  .map((cat) => {
                  const visibleTabs = cat.abas.filter(canAccessTab);
                  if (visibleTabs.length === 0 && inlineEditingCatId !== cat.id) return null;
                  const isExpanded = !collapsedCategoryIds.includes(cat.id);
                  const isDragOverThisCat = dragOverCatId === cat.id;
                  const cleanCatTitle = String(cat.titulo || '').replace(/^\d+\.\s*/, '');
                  return (
                    <div
                      key={cat.id}
                      data-drop-cat-id={cat.id}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverCatId(cat.id);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleDropOnCategoryHeader(cat.id);
                      }}
                      className={`rounded-xl border bg-black/20 overflow-hidden transition-all ${
                        isDragOverThisCat
                          ? 'border-amber-400 ring-2 ring-amber-400/40'
                          : 'border-white/10'
                      }`}
                    >
                      {inlineEditingCatId === cat.id ? (
                        <div className="p-2.5 bg-[#071712] border-b border-amber-500/40 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold text-amber-300 uppercase">
                              Grupo & Cor
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleMoveCategoryOrder(cat.id, -1)}
                                className="p-1 rounded bg-black/50 text-slate-200"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveCategoryOrder(cat.id, 1)}
                                className="p-1 rounded bg-black/50 text-slate-200"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setInlineEditingCatId(null)}
                                className="px-2.5 py-1 rounded bg-emerald-500 text-slate-950 text-xs font-bold"
                              >
                                OK
                              </button>
                            </div>
                          </div>
                          <input
                            type="text"
                            value={cleanCatTitle}
                            onChange={(e) => handleInlineRenameCategory(cat.id, e.target.value)}
                            autoFocus
                            className="w-full px-2.5 py-1.5 text-xs font-bold rounded bg-[#05100C] border border-amber-400 text-white"
                          />
                          <div className="grid grid-cols-6 gap-1.5 p-1.5 rounded bg-[#05100C] border border-slate-800">
                            {MENU_SYMBOL_COLOR_PALETTE.map((cItem) => (
                              <button
                                key={cItem.hex}
                                type="button"
                                onClick={() => handleInlineUpdateCategoryColor(cat.id, cItem.hex)}
                                title={cItem.nome}
                                style={{ backgroundColor: cItem.hex }}
                                className={`h-5 rounded cursor-pointer ${
                                  (cat.corSimbolo || '#10B981').toUpperCase() ===
                                  cItem.hex.toUpperCase()
                                    ? 'ring-2 ring-white scale-105'
                                    : 'opacity-85'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          draggable
                          onDragStart={(e) => startHtml5CatDrag(e, cat.id)}
                          onDragEnd={clearHtml5DragState}
                          onMouseDown={() => startHoldOnCategory(cat.id)}
                          onMouseUp={cancelHoldTimer}
                          onTouchStart={(e) => startHoldOnCategory(cat.id, e)}
                          onTouchMove={handleTouchMoveDrag}
                          onTouchEnd={handleTouchEndDrag}
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelHoldTimer();
                            if (holdTriggeredRef.current) {
                              holdTriggeredRef.current = false;
                              return;
                            }
                            handleToggleCategoryCollapse(cat.id);
                          }}
                          className="w-full px-3 py-2 bg-black/25 flex items-center justify-between text-left text-xs font-bold text-slate-200 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <CategorySymbolSVG
                              categoryId={cat.id}
                              colorHex={cat.corSimbolo}
                              className="w-4 h-4 shrink-0"
                            />
                            <span className="truncate">{cleanCatTitle}</span>
                            {isAdminExclusiveCategory(cat.id) && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/25 border border-amber-400/60 text-[8px] font-mono font-black uppercase text-amber-300 shrink-0">
                                 ADMIN
                              </span>
                            )}
                          </div>
                          <CestariaGrafismoSVG expanded={isExpanded} className="w-3.5 h-3.5 shrink-0 opacity-75" />
                        </button>
                      )}

                      {isExpanded && (
                        <div
                          className={
                            menuVisualMode === 'grid'
                              ? 'p-2 grid grid-cols-2 gap-1.5'
                              : 'p-1.5 space-y-1'
                          }
                        >
                          {visibleTabs.map((tabId) => {
                            const meta = DEFAULT_TAB_META[tabId];
                            const override = tabOverrides[tabId];
                            const displayLabel = override?.label || meta?.label || tabId;
                            const displayIcon = override?.iconName || meta?.iconName;
                            const displayIconColor = override?.iconColor || meta?.iconColor;
                            const isActive = activeTab === tabId;
                            const isDragOverItem = dragOverTabId === tabId;
                            const isBeingEdited = inlineEditingTabId === tabId;
                            const adminTab = isAdminExclusiveTab(tabId);

                            const mobileItemProps = {
                              'data-drop-tab-id': tabId,
                              'data-drop-tab-cat': cat.id,
                              draggable: true,
                              onDragStart: (e: React.DragEvent) => startHtml5TabDrag(e, tabId, cat.id),
                              onDragOver: (e: React.DragEvent) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'move';
                                setDragOverTabId(tabId);
                              },
                              onDrop: (e: React.DragEvent) => {
                                e.preventDefault();
                                handleDropOnTabItem(cat.id, tabId);
                              },
                              onDragEnd: clearHtml5DragState,
                              onMouseDown: () => startHoldOnTab(tabId, cat.id),
                              onMouseUp: cancelHoldTimer,
                              onTouchStart: (e: React.TouchEvent) =>
                                startHoldOnTab(tabId, cat.id, e),
                              onTouchMove: handleTouchMoveDrag,
                              onTouchEnd: handleTouchEndDrag,
                              onClick: () => {
                                if (holdTriggeredRef.current) {
                                  holdTriggeredRef.current = false;
                                  return;
                                }
                                handleSelectTab(tabId);
                                setMobileMenuOpen(false);
                              }
                            };

                            if (menuVisualMode === 'grid') {
                              return (
                                <button
                                  key={tabId}
                                  type="button"
                                  {...mobileItemProps}
                                  className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl text-center transition-all cursor-pointer relative ${
                                    isDragOverItem ? 'ring-2 ring-amber-400 scale-105' : ''
                                  } ${
                                    isBeingEdited ? 'ring-2 ring-amber-400 bg-amber-500/20' : ''
                                  } ${
                                    isActive
                                      ? adminTab
                                        ? 'bg-[#321222] border-2 border-amber-400 text-amber-100 shadow-md'
                                        : 'amazonia-tab-active shadow-md'
                                      : adminTab
                                      ? 'bg-[#1D0B16]/75 hover:bg-[#2B1020] text-amber-200 border border-amber-500/35'
                                      : 'bg-black/25 hover:bg-[#113025]/60 text-slate-200 hover:text-white border border-white/8'
                                  }`}
                                >
                                  {adminTab && (
                                    <span className="px-1.5 py-0.2 rounded bg-amber-500/25 border border-amber-400/60 text-[8px] font-mono font-black uppercase text-amber-300">
                                       ADMIN
                                    </span>
                                  )}
                                  <TabIconSVG
                                    tab={tabId}
                                    iconName={displayIcon}
                                    iconColor={displayIconColor}
                                    className="w-5 h-5 shrink-0"
                                  />
                                  <span className="text-[11px] font-semibold truncate w-full leading-tight">
                                    {displayLabel}
                                  </span>
                                </button>
                              );
                            }

                            return (
                              <button
                                key={tabId}
                                type="button"
                                {...mobileItemProps}
                                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-xs min-h-[40px] transition-all cursor-pointer ${
                                  isDragOverItem ? 'ring-2 ring-amber-400' : ''
                                } ${
                                  isBeingEdited ? 'ring-2 ring-amber-400 bg-amber-500/20' : ''
                                } ${
                                  isActive ? 'amazonia-tab-active' : 'amazonia-tab-inactive'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <TabIconSVG
                                    tab={tabId}
                                    iconName={displayIcon}
                                    iconColor={displayIconColor}
                                    className="w-4 h-4 shrink-0"
                                  />
                                  <span className="truncate">{displayLabel}</span>
                                </div>
                                {isActive && <span className="tapiri-orb-turquoise shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            
            <div className="p-3 border-t border-white/10 bg-black/40 space-y-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  handleSelectTab('auditoria');
                  setMobileMenuOpen(false);
                }}
                className={`w-full px-3 py-2 rounded-xl border text-xs font-mono font-bold flex items-center justify-between gap-2 cursor-pointer ${
                  usuarioDentroDaEmpresa && usuarioEmTurnoAtivo
                    ? 'bg-[#10B981]/10 border-[#10B981]/35 text-[#10B981]'
                    : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                }`}
              >
                <span className="inline-flex items-center gap-1.5 truncate">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {usuarioDentroDaEmpresa
                      ? `Na Empresa (${distanciaEmpresaMetros}m)`
                      : `Fora (${distanciaEmpresaMetros}m)`}
                  </span>
                </span>
                <span className="shrink-0">
                  {usuarioEmTurnoAtivo ? 'Em Turno' : 'Fora de Turno'}
                </span>
              </button>

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setSwitchAuthError('');
                    setUserSwitchTab('salvos');
                    setUserSwitchModalOpen(true);
                  }}
                  className="flex items-center gap-2 cursor-pointer min-w-0 flex-1 text-left px-1.5 py-1 rounded-xl hover:bg-[#10B981]/10 transition-colors"
                  title="Clique para trocar de usuário ou gerenciar contas salvas"
                >
                  <VisualAvatar
                    name={currentUser?.nome}
                    role={currentUser?.cargo}
                    size="sm"
                    highlight
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-white truncate">
                      {currentUser?.nome}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate">
                      {currentUser?.cargo || currentUser?.tipo}
                    </span>
                  </div>
                </button>

                <OfflineSyncCenter
                  currentUser={currentUser}
                  onNavigateTab={(tab) => {
                    handleSelectTab(tab);
                    setMobileMenuOpen(false);
                  }}
                  onRefreshData={fetchAllData}
                />

                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setBrightnessPanelOpen((prev) => !prev);
                  }}
                  className={`inline-flex items-center justify-center w-9 h-9 rounded-xl border shrink-0 cursor-pointer transition-colors ${
                    brightnessPanelOpen
                      ? 'bg-[#10B981] text-[#05100C] border-[#10B981]'
                      : 'bg-[#05100C] text-amber-300 border-white/15 hover:bg-[#113025]'
                  }`}
                  title={`Brilho: ${effectiveBackgroundBrightness}%`}
                  aria-label="Brilho"
                >
                  <Sun className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => solicitarSaidaDoSistema(true)}
                  className="inline-flex items-center justify-center w-9 h-9 btn-urucum rounded-xl shrink-0 cursor-pointer"
                  title="Fechar / Sair (Salva Cópia Local Automaticamente)"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      
      {activeTab === 'chat' && erpData && (
        <div className="fixed bottom-3 left-4 z-[60]">
          {quickMsgOpen && (
            <div className="mb-2 w-72 sm:w-84 urutau-gold-turquoise-outer p-2 max-h-[70vh] flex flex-col">
              <div className="urutau-gold-turquoise-inner overflow-hidden flex flex-col">
                <div className="px-4 py-2.5 bg-[#131B24] border-b border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">
                      Mensagens Rápidas
                    </span>
                    <span className="text-[10px] text-[#94A3B8] font-medium">
                      {erpData.empresas.find((e) => Number(e.id) === Number(selectedEmpresaId || erpData.empresaAtivaId || erpData.empresas[0]?.id))?.nome || 'Empresa Ativa'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQuickMsgOpen(false)}
                    className="text-xs text-[#94A3B8] hover:text-white p-1 min-h-[32px] flex items-center cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-800/70 p-1">
                  {(() => {
                    const empId = Number(selectedEmpresaId || erpData.empresaAtivaId || erpData.empresas[0]?.id || 1);
                    const lista = (erpData.mensagensRapidas || []).filter(
                      (m: any) => !m.empresa_id || Number(m.empresa_id) === empId
                    );
                    if (lista.length === 0) {
                      return (
                        <div className="p-4 text-center text-xs text-[#94A3B8]">
                          Nenhuma mensagem rápida cadastrada para esta empresa.
                        </div>
                      );
                    }
                    return lista.map((m: any) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleCopyQuickMessage(m)}
                        className="w-full text-left p-3 hover:bg-white/5 transition-colors space-y-1 group min-h-[44px] cursor-pointer rounded"
                      >
                        <div className="flex items-center justify-between text-xs font-semibold text-white">
                          <span>{m.titulo}</span>
                          <Copy className="w-3.5 h-3.5 text-[var(--urutau-accent)]" />
                        </div>
                        <p className="text-[11px] text-[#94A3B8] line-clamp-2">{m.texto}</p>
                      </button>
                    ));
                  })()}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setQuickMsgOpen((v) => !v)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg btn-turquoise-pill text-xs shadow-xl transition-colors min-h-[42px] cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Mensagens Rápidas</span>
            </button>

            {copiedQuickToast && (
              <div className="px-3 py-2 bg-[#131B24] border border-white/15 text-emerald-400 text-xs font-mono rounded-lg flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>{copiedQuickToast}</span>
              </div>
            )}
          </div>
        </div>
      )}

      
      {brandShowcaseOpen && (
        <div
          className="fixed inset-0 z-[115] penumbra-da-mata-backdrop flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-5xl max-h-[92vh] urutau-gold-turquoise-outer p-2 sm:p-3.5 flex flex-col relative overflow-hidden">
            <div className="w-full flex-1 overflow-hidden urutau-gold-turquoise-inner flex flex-col">
              
              <div className="shrink-0 z-30 penumbra-sticky-bar px-4 sm:px-6 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <SystemSlotImage
                    slot="topo_painel"
                    brandConfig={brandConfig}
                    className="w-11 h-9"
                  />
                  <div>
                    <h2 className="text-base sm:text-lg font-black tracking-[0.14em] text-white uppercase">
                      {brandConfig.companyName ? `${brandConfig.companyName} • URUTAU` : 'APARÊNCIA DA EMPRESA'}
                    </h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setBrandShowcaseOpen(false)}
                  className="p-2 text-[#94A3B8] hover:text-white rounded-full cursor-pointer"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="w-full flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center bg-[#0C1117] border border-white/10 rounded-xl p-4 sm:p-5">
                <div className="lg:col-span-4 flex flex-col items-center justify-center p-4 rounded-xl bg-[#131B24] border border-white/10 min-h-[210px]">
                  <UrutauEmblemSVG className="w-36 h-32" postura={previewPostura} disableAutoBlink />
                  <span className="mt-3 text-xs font-bold uppercase tracking-wider text-amber-300 text-center">
                    {BUILTIN_BRAND_IMAGES_META.find((b) => b.id === previewPostura)?.label || previewPostura}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const nextPlacements = {
                        ...(brandConfig.imagePlacements || {}),
                        topo_painel: previewPostura,
                        tela_login: previewPostura
                      };
                      handleUpdateBrandConfig({
                        ...brandConfig,
                        imagePlacements: nextPlacements
                      });
                    }}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-[#10B981]/20 hover:bg-[#10B981]/30 border border-[#10B981]/50 text-[#10B981] text-[11px] font-bold cursor-pointer"
                  >
                    Usar no Topo e Login
                  </button>
                </div>

                <div className="lg:col-span-8 space-y-3">
                  <div className="text-xs font-semibold text-slate-200">
                    Posturas
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {BUILTIN_BRAND_IMAGES_META.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setPreviewPostura(item.id)}
                        className={`px-3 py-2.5 rounded-xl text-left text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
                          previewPostura === item.id
                            ? 'btn-metallic-gold'
                            : 'bg-[#131B24] text-[#F8FAFC] border border-white/10 hover:border-white/25'
                        }`}
                      >
                        <UrutauEmblemSVG className="w-8 h-8 shrink-0" postura={item.id} disableAutoBlink />
                        <div className="min-w-0">
                          <div className="truncate font-bold">{item.label}</div>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-semibold cursor-pointer">
                        <span>Enviar Minha Logo</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = async () => {
                              const dataUrl = String(reader.result || '');
                              const extracted = await extractColorsFromLogoImage(dataUrl);
                              const blended = blendCompanyWithUrutau(
                                extracted.dominantHex,
                                brandConfig.urutauBaseHex || '#10B981',
                                brandConfig.blendRatio ?? 0.7
                              );
                              handleUpdateBrandConfig({
                                ...brandConfig,
                                logoDataUrl: dataUrl,
                                companyColorHex: extracted.dominantHex,
                                companySecondaryHex: extracted.secondaryHex,
                                companyTertiaryHex: extracted.tertiaryHex,
                                logoHighlights: extracted.highlights,
                                effectivePrimaryHex: blended.effectiveHex,
                                effectivePrimaryRgb: blended.rgb,
                                effectiveSecondaryHex: extracted.secondaryHex,
                                effectiveTertiaryHex: extracted.tertiaryHex,
                                imagePlacements: {
                                  ...(brandConfig.imagePlacements || {}),
                                  topo_painel: 'logo_empresa'
                                },
                                slotCustomizations: {
                                  ...(brandConfig.slotCustomizations || {}),
                                  topo_painel: { choice: 'logo_principal' }
                                }
                              });
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() =>
                          window.dispatchEvent(
                            new CustomEvent('urutau:open-gallery-modal', {
                              detail: { slotId: 'topo_painel' }
                            })
                          )
                        }
                        className="px-3 py-1.5 rounded-lg bg-[#131B24] hover:bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-semibold cursor-pointer transition-all"
                      >
                        Galeria
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[#0C1117] border border-white/10 rounded-xl p-4 sm:p-5 space-y-4">
                <h3 className="text-sm font-bold text-white">
                  Gerenciador de Imagens da sua Empresa
                </h3>

                <UrutauSlotImageManager
                  brandConfig={brandConfig}
                  onUpdateBrandConfig={handleUpdateBrandConfig}
                  theme="dark"
                />
              </div>

              <div className="bg-[#0C1117] border border-white/10 rounded-xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-white">
                    Cores de Destaque da Marca e Nome da Empresa
                  </h3>
                  {brandConfig.logoDataUrl && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!brandConfig.logoDataUrl) return;
                        const extracted = await extractColorsFromLogoImage(brandConfig.logoDataUrl);
                        const blended = blendCompanyWithUrutau(
                          extracted.dominantHex,
                          brandConfig.urutauBaseHex || '#10B981',
                          brandConfig.blendRatio ?? 0.7
                        );
                        handleUpdateBrandConfig({
                          ...brandConfig,
                          companyColorHex: extracted.dominantHex,
                          companySecondaryHex: extracted.secondaryHex,
                          companyTertiaryHex: extracted.tertiaryHex,
                          logoHighlights: extracted.highlights,
                          effectivePrimaryHex: blended.effectiveHex,
                          effectivePrimaryRgb: blended.rgb,
                          effectiveSecondaryHex: extracted.secondaryHex,
                          effectiveTertiaryHex: extracted.tertiaryHex
                        });
                      }}
                      className="text-xs font-bold text-cyan-400 hover:underline cursor-pointer"
                    >
                      Extrair Destaques da Logo
                    </button>
                  )}
                </div>

                {brandConfig.logoDataUrl &&
                  brandConfig.logoHighlights &&
                  brandConfig.logoHighlights.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-[#131B24] border border-white/10 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-200">
                          Detalhes Detectados na Logo (Fundo Ignorado)
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Clique para aplicar como Cor Principal
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {brandConfig.logoHighlights.map((hlHex, idx) => {
                          const isSelected =
                            (brandConfig.companyColorHex || '').toUpperCase() ===
                            hlHex.toUpperCase();
                          return (
                            <button
                              key={`${hlHex}-${idx}`}
                              type="button"
                              onClick={() => {
                                const blended = blendCompanyWithUrutau(
                                  hlHex,
                                  brandConfig.urutauBaseHex || '#10B981',
                                  brandConfig.blendRatio ?? 0.7
                                );
                                handleUpdateBrandConfig({
                                  ...brandConfig,
                                  companyColorHex: hlHex,
                                  effectivePrimaryHex: blended.effectiveHex,
                                  effectivePrimaryRgb: blended.rgb
                                });
                              }}
                              className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-bold inline-flex items-center gap-1.5 cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-white/15 border-white text-white ring-1 ring-white/60'
                                  : 'bg-[#0C1117] border-slate-700 text-slate-300 hover:border-slate-500'
                              }`}
                            >
                              <span
                                className="w-3.5 h-3.5 rounded border border-black/40 shrink-0"
                                style={{ backgroundColor: hlHex }}
                              />
                              <span>{hlHex}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-emerald-300">
                        Link Exclusivo do Empresário (.nyctibi.us) &amp; Login Personalizado
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Ao acessar seu endereço exclusivo, a tela de login exibe automaticamente sua logo, nome da empresa e cores escolhidas.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const slug = normalizarSlugEmpresa(portalSubdominioInput || brandConfig.companyName || 'empresa');
                          const linkOficial = `https://${slug}.nyctibi.us`;
                          navigator.clipboard?.writeText(linkOficial);
                          setCopiedPortalLink(true);
                          setTimeout(() => setCopiedPortalLink(false), 2200);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold cursor-pointer"
                      >
                        {copiedPortalLink ? 'Link Copiado!' : `Copiar https://${normalizarSlugEmpresa(portalSubdominioInput || brandConfig.companyName || 'empresa')}.nyctibi.us`}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const slug = normalizarSlugEmpresa(portalSubdominioInput || brandConfig.companyName || 'empresa');
                          const activeEmpId = Number(selectedEmpresaId || currentUser?.empresas_ids?.[0] || 1);
                          setPortalEmpresaAtiva({
                            id: activeEmpId,
                            nome: brandConfig.companyName || 'Empresa',
                            subdominio: slug,
                            link_acesso: `https://${slug}.nyctibi.us`,
                            brand_config: brandConfig
                          });
                          setBrandShowcaseOpen(false);
                          setIsSessionLocked(true);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-200 text-xs font-semibold cursor-pointer"
                      >
                        Visualizar Meu Login
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    <div className="md:col-span-7">
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Seu Subdomínio Exclusivo
                      </label>
                      <div className="flex items-center rounded-lg bg-[#070C10] border border-white/[0.08] overflow-hidden">
                        <span className="px-2.5 py-2 text-xs font-mono text-slate-500 bg-white/[0.02] border-r border-white/[0.06]">
                          https://
                        </span>
                        <input
                          type="text"
                          value={portalSubdominioInput}
                          onChange={(e) => setPortalSubdominioInput(normalizarSlugEmpresa(e.target.value))}
                          placeholder="sua-empresa"
                          className="flex-1 px-2.5 py-2 text-xs font-mono text-emerald-300 !border-0 focus:!ring-0"
                        />
                        <span className="px-3 py-2 text-xs font-mono font-semibold text-slate-300 bg-white/[0.03] border-l border-white/[0.06]">
                          .nyctibi.us
                        </span>
                      </div>
                    </div>
                    <div className="md:col-span-5 flex items-center gap-2">
                      <button
                        type="button"
                        disabled={savingPortalSlug}
                        onClick={async () => {
                          const activeEmpId = Number(selectedEmpresaId || currentUser?.empresas_ids?.[0] || 1);
                          const slug = normalizarSlugEmpresa(portalSubdominioInput || brandConfig.companyName || 'empresa');
                          setSavingPortalSlug(true);
                          try {
                            const r = await fetch('/api/erp/empresas/personalizacao-portal', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                empresa_id: activeEmpId,
                                subdominio: slug,
                                brand_config: brandConfig
                              })
                            });
                            const j = await r.json();
                            if (j?.ok && j?.empresa) {
                              setPortalEmpresaAtiva(j.empresa);
                              setPortalSubdominioInput(j.empresa.subdominio);
                              localStorage.setItem('urutau_portal_subdominio', j.empresa.subdominio);
                              const nextUrl = new URL(window.location.href);
                              nextUrl.searchParams.set('empresa', j.empresa.subdominio);
                              window.history.replaceState({}, '', nextUrl.toString());
                              await fetchAllData();
                            }
                          } finally {
                            setSavingPortalSlug(false);
                          }
                        }}
                        className="w-full py-2 px-3 rounded-lg btn-turquoise-pill text-xs font-semibold cursor-pointer"
                      >
                        {savingPortalSlug ? 'Salvando Link...' : 'Salvar Link & Personalização do Login'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-4">
                    <label className="block text-xs text-slate-300 mb-1 font-medium">
                      Nome da Empresa
                    </label>
                    <input
                      type="text"
                      value={brandConfig.companyName || ''}
                      onChange={(e) => {
                        const novoNome = e.target.value;
                        handleUpdateBrandConfig({
                          ...brandConfig,
                          companyName: novoNome
                        });
                      }}
                      placeholder="Ex: Italiamo"
                      className="w-full px-3 py-2 bg-[#131B24] border border-slate-700 rounded-lg text-xs text-white"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-xs text-slate-300 mb-1 font-medium">
                      Cor Principal
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={brandConfig.companyColorHex || '#10B981'}
                        onChange={(e) => {
                          const hex = e.target.value.toUpperCase();
                          const blended = blendCompanyWithUrutau(
                            hex,
                            brandConfig.urutauBaseHex || '#10B981',
                            brandConfig.blendRatio ?? 0.7
                          );
                          handleUpdateBrandConfig({
                            ...brandConfig,
                            companyColorHex: hex,
                            effectivePrimaryHex: blended.effectiveHex,
                            effectivePrimaryRgb: blended.rgb
                          });
                        }}
                        className="w-10 h-9 rounded bg-transparent border border-slate-700 cursor-pointer"
                      />
                      <span className="text-xs font-mono text-slate-200">
                        {brandConfig.companyColorHex || '#10B981'}
                      </span>
                    </div>
                  </div>

                  <div className="md:col-span-5">
                    <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                      <span>Intensidade</span>
                      <span className="font-mono text-amber-400">
                        {Math.round((brandConfig.blendRatio ?? 0.7) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={Math.round((brandConfig.blendRatio ?? 0.7) * 100)}
                      onChange={(e) => {
                        const ratio = Number(e.target.value) / 100;
                        const blended = blendCompanyWithUrutau(
                          brandConfig.companyColorHex || '#10B981',
                          brandConfig.urutauBaseHex || '#10B981',
                          ratio
                        );
                        handleUpdateBrandConfig({
                          ...brandConfig,
                          blendRatio: ratio,
                          effectivePrimaryHex: blended.effectiveHex,
                          effectivePrimaryRgb: blended.rgb
                        });
                      }}
                      className="w-full accent-[#10B981] cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  {[
                    { nome: 'Amazônia', primary: '#10B981', secondary: '#F59E0B' },
                    { nome: 'Ouro', primary: '#F59E0B', secondary: '#10B981' },
                    { nome: 'Urucum', primary: '#F43F5E', secondary: '#F59E0B' },
                    { nome: 'Açaí', primary: '#8B5CF6', secondary: '#20E3B2' },
                    { nome: 'Rio Negro', primary: '#0EA5E9', secondary: '#10B981' }
                  ].map((preset) => (
                    <button
                      key={preset.nome}
                      type="button"
                      onClick={() => {
                        const blended = blendCompanyWithUrutau(
                          preset.primary,
                          '#10B981',
                          brandConfig.blendRatio ?? 0.7
                        );
                        handleUpdateBrandConfig({
                          ...brandConfig,
                          companyColorHex: preset.primary,
                          companySecondaryHex: preset.secondary,
                          effectivePrimaryHex: blended.effectiveHex,
                          effectivePrimaryRgb: blended.rgb,
                          effectiveSecondaryHex: preset.secondary
                        });
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#131B24] hover:bg-slate-800 border border-white/10 text-xs text-slate-200 flex items-center gap-2 cursor-pointer"
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: preset.primary }}
                      />
                      <span>{preset.nome}</span>
                    </button>
                  ))}
                </div>

                <div className="pt-3 border-t border-white/10 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span>Transição Ao Anoitecer</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold" style={{ color: accentHex }}>
                        {Math.round(nightFactor * 100)}% Noite
                      </span>
                      {isManualNight && (
                        <button
                          type="button"
                          onClick={() => setManualFactor(null)}
                          className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] text-white cursor-pointer"
                        >
                          Automático
                        </button>
                      )}
                    </div>
                  </div>
                  <div
                    className="relative h-2.5 rounded-full flex items-center px-0.5 border border-white/15"
                    style={{
                      background:
                        'linear-gradient(90deg, #F59E0B 0%, #EAB308 30%, #22C55E 68%, #10B981 100%)'
                    }}
                  >
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={2}
                      value={Math.round(nightFactor * 100)}
                      onChange={(e) => {
                        setManualFactor(Number(e.target.value) / 100);
                      }}
                      style={{ accentColor: accentHex }}
                      className="w-full cursor-pointer h-2.5 bg-transparent appearance-none"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>Dia (Ouro Solar)</span>
                    <span>Entardecer Vivo</span>
                    <span>Noite (Verde Esmeralda)</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setBrandShowcaseOpen(false)}
                  className="px-5 py-2 rounded-lg btn-turquoise-pill text-xs font-bold cursor-pointer"
                >
                  Concluir
                </button>
              </div>
              </div>
            </div>
          </div>
        </div>
      )}
        </div>
      ) : null}

      {isAuthenticatedAndUnlocked && fechamentoUltimoPcModalOpen && (
        <div
          className="fixed inset-0 z-[125] penumbra-da-mata-backdrop flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg urutau-gold-turquoise-outer p-3 sm:p-4 my-auto"
          >
            <div className="urutau-gold-turquoise-inner p-5 space-y-4">
              <div className="space-y-1">
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[10px] font-black uppercase tracking-wider">
                  Último Computador Ativo • {meuPcApelido}
                </span>
                <h3 className="text-base sm:text-lg font-black text-white">
                  Atenção Antes de Fechar Este Computador
                </h3>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-400/40 space-y-2 text-xs text-amber-50 leading-relaxed">
                <div>
                  <strong>1. Cópia final salva aqui ({meuPcApelido}):</strong> Como não há Google Drive conectado e este é o último computador aberto, todos os dados atualizados até agora ficarão salvos <strong>somente neste computador</strong>.
                </div>
                <div>
                  <strong>2. Este precisa ser o PRIMEIRO computador a ligar depois:</strong> Quando a empresa voltar a usar o sistema, <strong>ligue e entre primeiro neste computador</strong> para que ele envie os dados salvos automaticamente antes de qualquer outro computador acessar.
                </div>
                <div>
                  <strong>3. Se outro computador ligar antes:</strong> o sistema exibirá um alerta avisando que ele não tem as informações atualizadas até que este computador suba a cópia salva.
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => finalizarSaidaDaSessao(false)}
                  className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black cursor-pointer"
                >
                  Entendi — Salvar Neste Computador e Fechar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFechamentoUltimoPcModalOpen(false);
                    setActiveTab('config');
                  }}
                  className="py-3 px-4 rounded-xl bg-[#0C1117] hover:bg-slate-900 border border-emerald-500/50 text-emerald-300 text-xs font-bold cursor-pointer"
                >
                  Conectar Google Drive Antes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(() => {
        if (!isAuthenticatedAndUnlocked || outroPcCienteContinuar) return null;
        const cfgCustModal: any = empresaAtivaObj?.lgpd_custodia_config || {};
        const driveConectadoModal = Boolean(
          (cfgCustModal.pasta_google_drive_id && String(cfgCustModal.pasta_google_drive_id).trim().length > 0) ||
            (cfgCustModal.planilha_google_id && String(cfgCustModal.planilha_google_id).trim().length > 0) ||
            (cfgCustModal.apps_script_webhook_url && String(cfgCustModal.apps_script_webhook_url).startsWith('https://')) ||
            (cfgCustModal.conta_google_vinculada && String(cfgCustModal.conta_google_vinculada).includes('@'))
        );
        const mostrarAlertaOutroPc = Boolean(
          !driveConectadoModal &&
            estadoFechamentoLocal?.aguardando_primeiro_pc &&
            estadoFechamentoLocal?.ultimo_pc_id &&
            estadoFechamentoLocal.ultimo_pc_id !== meuPcId
        );
        if (!mostrarAlertaOutroPc) return null;
        const empIdModal = Number(selectedEmpresaId || currentUser?.empresas_ids?.[0] || 1);
        return (
          <div
            className="fixed inset-0 z-[124] penumbra-da-mata-backdrop flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
            role="dialog"
            aria-modal="true"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg urutau-gold-turquoise-outer p-3 sm:p-4 my-auto"
            >
              <div className="urutau-gold-turquoise-inner p-5 space-y-4">
                <div className="space-y-1">
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/50 text-rose-300 text-[10px] font-black uppercase tracking-wider">
                    Computador Diferente do Último Acesso • {meuPcApelido}
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-white">
                    Atenção: Este Computador Não Terá as Informações Atualizadas
                  </h3>
                </div>

                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-400/40 space-y-2.5 text-xs text-rose-50 leading-relaxed">
                  <div>
                    <strong>1. Onde estão os dados finais:</strong> Como o sistema está sem Google Drive conectado, o último encerramento ocorreu em{' '}
                    <strong>{estadoFechamentoLocal?.ultimo_pc_apelido || 'outro computador'}</strong>
                    {estadoFechamentoLocal?.fechado_em
                      ? ` em ${new Date(estadoFechamentoLocal.fechado_em).toLocaleString('pt-BR')}`
                      : ''}
                    . As últimas alterações ficaram salvas apenas lá.
                  </div>
                  <div>
                    <strong>2. Como atualizar aqui automaticamente:</strong> Ligue primeiro o computador{' '}
                    <strong>{estadoFechamentoLocal?.ultimo_pc_apelido || 'anterior'}</strong> e entre no sistema por ele. Assim que ele enviar os dados, este computador será atualizado sozinho na hora.
                  </div>
                  <div>
                    <strong>3. Se você continuar sem aguardar (é possível recuperar o atraso depois):</strong> novos lançamentos feitos aqui serão mantidos. Quando o computador{' '}
                    <strong>{estadoFechamentoLocal?.ultimo_pc_apelido || 'anterior'}</strong> ligar depois (ou ao carregar a cópia salva dele manualmente), o sistema irá <strong>juntar os dados atrasados sem apagar o que foi feito aqui</strong>.
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  <button
                    type="button"
                    disabled={verificandoOutroPc}
                    onClick={async () => {
                      setVerificandoOutroPc(true);
                      try {
                        const r = await fetch(`/api/lgpd/vps-processador/status/${empIdModal}`);
                        const j = await r.json();
                        if (j?.ok) {
                          setEstadoFechamentoLocal(j.drive_conectado ? null : j.estado_fechamento_local || null);
                        }
                        await fetchAllData();
                      } catch {} finally {
                        setVerificandoOutroPc(false);
                      }
                    }}
                    className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black cursor-pointer disabled:opacity-50"
                  >
                    {verificandoOutroPc
                      ? 'Verificando se o último computador já enviou os dados...'
                      : 'Verificar Novamente (Aguardar Outro Computador Enviar)'}
                  </button>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOutroPcCienteContinuar(true);
                        setActiveTab('config');
                      }}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-[#0C1117] hover:bg-slate-900 border border-amber-400/50 text-amber-200 text-xs font-bold cursor-pointer"
                    >
                      Carregar Cópia Salva Manualmente
                    </button>
                    <button
                      type="button"
                      onClick={() => setOutroPcCienteContinuar(true)}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-[#0C1117] hover:bg-slate-900 border border-white/15 text-slate-300 text-xs font-bold cursor-pointer"
                    >
                      Abrir Mesmo Assim (Sincronizar Depois)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {isAuthenticatedAndUnlocked && pacoteAtrasadoPendente && (
        <div
          className="fixed inset-0 z-[126] penumbra-da-mata-backdrop flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg urutau-gold-turquoise-outer p-3 sm:p-4 my-auto"
          >
            <div className="urutau-gold-turquoise-inner p-5 space-y-4">
              <div className="space-y-1">
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                  Recuperação de Dados em Atraso • {meuPcApelido}
                </span>
                <h3 className="text-base sm:text-lg font-black text-white">
                  Recuperar e Sincronizar Dados Salvos em Atraso
                </h3>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-400/40 space-y-2.5 text-xs text-emerald-50 leading-relaxed">
                <div>
                  <strong>1. Seus dados antigos estão protegidos aqui:</strong> Outro computador iniciou o sistema antes deste hoje, mas a cópia salva aqui{' '}
                  {pacoteAtrasadoPendente?.fechado_em
                    ? `em ${new Date(pacoteAtrasadoPendente.fechado_em).toLocaleString('pt-BR')} `
                    : ''}
                  com <strong>{pacoteAtrasadoPendente?.total_registros_atrasados || 0} registros</strong> não foi perdida.
                </div>
                <div>
                  <strong>2. Junção segura sem apagar o trabalho de hoje:</strong> Ao clicar em mesclar abaixo, o sistema juntará esses registros salvos em atraso com os{' '}
                  <strong>{pacoteAtrasadoPendente?.total_registros_em_sessao || 0} registros</strong> já abertos na sessão atual, preservando tudo de ambos os computadores e atualizando todos ao mesmo tempo.
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  disabled={mesclandoAtraso}
                  onClick={async () => {
                    setMesclandoAtraso(true);
                    try {
                      const empAtr = Number(pacoteAtrasadoPendente.empresa_id || 1);
                      const res = await fetch('/api/lgpd/vps-processador/hidratar-sessao', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          empresa_id: empAtr,
                          pacote_portatil: pacoteAtrasadoPendente.pacote,
                          pc_id: meuPcId,
                          forcar_liberacao_manual: true,
                          modo_mesclagem: 'recuperar_atraso'
                        })
                      });
                      const json = await res.json();
                      if (res.ok && json?.ok) {
                        limparBackupsDuplicadosLocais(empAtr, true);
                        setPacoteAtrasadoPendente(null);
                        setEstadoFechamentoLocal(null);
                        setOutroPcCienteContinuar(false);
                        await fetchAllData();
                        setRecuperacaoConcluidaMsg(
                          `Ponto de parada sincronizado com sucesso: ${Number(json.registros_recuperados || 0)} registros deste computador foram enviados ao PC principal e os backups duplicados foram apagados automaticamente para poupar espaço.`
                        );
                      }
                    } catch {} finally {
                      setMesclandoAtraso(false);
                    }
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black cursor-pointer disabled:opacity-50"
                >
                  {mesclandoAtraso
                    ? 'Sincronizando e Apagando Backups Duplicados...'
                    : 'Sincronizar com PC Principal e Apagar Backups Duplicados'}
                </button>
                <button
                  type="button"
                  disabled={mesclandoAtraso}
                  onClick={async () => {
                    const empAtr = Number(pacoteAtrasadoPendente.empresa_id || 1);
                    limparBackupsDuplicadosLocais(empAtr, true);
                    setPacoteAtrasadoPendente(null);
                    try {
                      await fetch('/api/lgpd/vps-processador/confirmar-retorno-ultimo-pc', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          empresa_id: empAtr,
                          pc_id: meuPcId,
                          liberar_todos_computadores: true
                        })
                      });
                    } catch {}
                    await fetchAllData();
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#0C1117] hover:bg-slate-900 border border-white/15 text-slate-300 text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  Descartar Cópia Atrasada Deste Computador (Usar Apenas os Dados Atuais)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isAuthenticatedAndUnlocked && (!showLandingPage || isSessionLocked) && (
        <div
          className="fixed inset-0 z-[110] bg-[#05100C] flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl urutau-gold-turquoise-outer p-3 sm:p-5 my-auto cursor-default"
          >
            <div className="urutau-gold-turquoise-inner overflow-hidden space-y-0">
              {(() => {
                const isPortalPersonalizado = Boolean(portalEmpresaAtiva);
                const basePublicBrand = adminMasterBrandRef.current || brandConfig;
                const loginBrand: BrandIdentityConfig =
                  isPortalPersonalizado && portalEmpresaAtiva?.brand_config
                    ? portalEmpresaAtiva.brand_config
                    : {
                        companyName: 'URUTAU',
                        logoDataUrl: basePublicBrand?.logoDataUrl || '',
                        companyColorHex: basePublicBrand?.companyColorHex || '#10B981',
                        companySecondaryHex: basePublicBrand?.companySecondaryHex || '#F59E0B',
                        companyTertiaryHex: basePublicBrand?.companyTertiaryHex || '#06B6D4',
                        urutauBaseHex: basePublicBrand?.urutauBaseHex || '#10B981',
                        blendRatio: basePublicBrand?.blendRatio ?? 0.7,
                        effectivePrimaryHex: basePublicBrand?.effectivePrimaryHex || '#10B981',
                        effectivePrimaryRgb: basePublicBrand?.effectivePrimaryRgb || { r: 16, g: 185, b: 129 },
                        effectiveSecondaryHex: basePublicBrand?.effectiveSecondaryHex || '#F59E0B',
                        effectiveTertiaryHex: basePublicBrand?.effectiveTertiaryHex || '#06B6D4',
                        modeloTracoPreferido:
                          basePublicBrand?.modeloTracoPreferido || 'padrao_xilogravura_olhar_marajoara',
                        imagePlacements: basePublicBrand?.imagePlacements,
                        slotCustomizations: basePublicBrand?.slotCustomizations,
                        customGallery: basePublicBrand?.customGallery
                      };
                const corDestaqueLogin = isPortalPersonalizado
                  ? loginBrand.companyColorHex || '#10B981'
                  : '#10B981';
                const tituloLogin = isPortalPersonalizado
                  ? loginBrand.companyName || portalEmpresaAtiva?.nome || 'EMPRESA'
                  : 'URUTAU';
                const dominioExibido = isPortalPersonalizado
                  ? `${normalizarSlugEmpresa(portalEmpresaAtiva?.subdominio || loginBrand.companyName || 'empresa')}.nyctibi.us`
                  : 'nyctibi.us';

                return (
                  <div
                    style={{
                      borderBottomColor: `${corDestaqueLogin}33`,
                      background: `linear-gradient(135deg, ${corDestaqueLogin}14 0%, rgba(9, 16, 20, 0.96) 65%)`
                    }}
                    className="p-4 sm:p-5 penumbra-sticky-bar flex flex-col gap-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3.5 min-w-0">
                        {isPortalPersonalizado && loginBrand.logoDataUrl ? (
                          <div
                            style={{ borderColor: `${corDestaqueLogin}55` }}
                            className="w-14 h-12 sm:w-16 sm:h-14 rounded-xl bg-black/30 border flex items-center justify-center p-1.5 shrink-0 overflow-hidden"
                          >
                            <img
                              src={loginBrand.logoDataUrl}
                              alt={tituloLogin}
                              className="w-full h-full object-contain rounded-lg"
                            />
                          </div>
                        ) : (
                          <div className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center shrink-0">
                            <SystemSlotImage
                              slot="tela_login"
                              brandConfig={loginBrand}
                              ssePulse={wppLoading || unlockLoading || recoveryLoading || cadLoading}
                              className="w-14 h-14 sm:w-16 sm:h-16"
                            />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-lg sm:text-2xl font-bold tracking-[0.08em] text-white uppercase leading-none truncate">
                              {tituloLogin}
                            </h2>
                            <span
                              style={{
                                backgroundColor: `${corDestaqueLogin}20`,
                                color: corDestaqueLogin,
                                borderColor: `${corDestaqueLogin}40`
                              }}
                              className="px-2 py-0.5 rounded-md border text-[10px] font-mono font-semibold"
                            >
                              {dominioExibido}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">
                            {isPortalPersonalizado
                              ? 'Portal Exclusivo da Empresa • Acesso Personalizado do Empresário e Equipe'
                              : 'Portal Geral de Acesso • Gestão Multi-Empresa e Operações'}
                          </p>
                        </div>
                      </div>

                      {isPortalPersonalizado && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(`https://${dominioExibido}`);
                            setCopiedPortalLink(true);
                            setTimeout(() => setCopiedPortalLink(false), 2000);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-[11px] font-mono text-slate-200 shrink-0 cursor-pointer transition-colors"
                          title="Copiar link direto da empresa (.nyctibi.us)"
                        >
                          {copiedPortalLink ? 'Copiado!' : 'Copiar Link'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

              {(() => {
                if (!portalEmpresaAtiva) return null;
                try {
                  const rawUltimo = localStorage.getItem('urutau_ultimo_pc_fechou_sem_nuvem');
                  const ehEsteUltimoPc = Boolean(rawUltimo);
                  const ehOutroPcComPendencia = Boolean(
                    !ehEsteUltimoPc &&
                      estadoFechamentoLocal?.aguardando_primeiro_pc &&
                      estadoFechamentoLocal?.ultimo_pc_id &&
                      estadoFechamentoLocal.ultimo_pc_id !== meuPcId
                  );
                  if (ehEsteUltimoPc && rawUltimo) {
                    const parsedUlt = JSON.parse(rawUltimo);
                    return (
                      <div className="mx-4 mt-3 p-3 rounded-xl bg-amber-500/15 border border-amber-400/50 text-[11px] text-amber-100 leading-relaxed">
                        <strong className="text-amber-300 block mb-0.5">
                          Este Computador Foi o Último a Fechar Sem Nuvem ({parsedUlt?.empresa_nome || 'Empresa'})
                        </strong>
                        Ao entrar agora por este computador, ele enviará automaticamente os dados salvos para liberar o acesso atualizado aos demais computadores.
                      </div>
                    );
                  }
                  if (ehOutroPcComPendencia) {
                    return (
                      <div className="mx-4 mt-3 p-3 rounded-xl bg-rose-500/15 border border-rose-400/60 text-[11px] text-rose-100 leading-relaxed">
                        <strong className="text-rose-300 block mb-0.5">
                          Atenção: Este Não Foi o Último Computador a Fechar
                        </strong>
                        O último uso sem Google Drive foi encerrado em{' '}
                        <strong>{estadoFechamentoLocal?.ultimo_pc_apelido || 'outro computador'}</strong>
                        {estadoFechamentoLocal?.fechado_em
                          ? ` (${new Date(estadoFechamentoLocal.fechado_em).toLocaleString('pt-BR')})`
                          : ''}
                        . Se você entrar por este computador agora, ele <strong>não terá as informações atualizadas</strong> até que aquele computador seja ligado e entre no sistema primeiro.
                      </div>
                    );
                  }
                  return null;
                } catch {
                  return null;
                }
              })()}

              <div className="flex border-b border-white/10 bg-[#11151C]/80">
                <button
                  type="button"
                  onClick={() => {
                    setLoginTab('wpp');
                    setWppError('');
                    setUnlockError('');
                    setCadError('');
                  }}
                  className={`flex-1 py-3 px-2 sm:px-3 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border-b-2 min-h-[44px] cursor-pointer ${
                    loginTab === 'wpp'
                      ? 'border-[#20E3B2] text-[#20E3B2] bg-[#20E3B2]/10'
                      : 'border-transparent text-[#94A3B8] hover:text-white'
                  }`}
                >
                  <Smartphone className="w-4 h-4 shrink-0" />
                  <span>Código WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginTab('argon2');
                    setWppError('');
                    setUnlockError('');
                    setCadError('');
                  }}
                  className={`flex-1 py-3 px-2 sm:px-3 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border-b-2 min-h-[44px] cursor-pointer ${
                    loginTab === 'argon2'
                      ? 'border-[#F5B041] text-[#F5B041] bg-[#F5B041]/10'
                      : 'border-transparent text-[#94A3B8] hover:text-white'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Senha</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginTab('cadastro');
                    setWppError('');
                    setUnlockError('');
                    setCadError('');
                  }}
                  className={`flex-1 py-3 px-2 sm:px-3 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border-b-2 min-h-[44px] cursor-pointer ${
                    loginTab === 'cadastro'
                      ? 'border-[#10B981] text-[#6EE7B7] bg-[#10B981]/10'
                      : 'border-transparent text-[#94A3B8] hover:text-white'
                  }`}
                >
                  <FolderPlus className="w-4 h-4 shrink-0" />
                  <span>Cadastrar Empresa</span>
                </button>
              </div>

              {loginTab === 'wpp' && (
                <form onSubmit={handleValidateWppToken} className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                      WhatsApp / Telefone (não precisa +55 nem DDD)
                    </label>
                    <input
                      type="tel"
                      value={wppInputTelefone}
                      onChange={(e) => {
                        setWppInputTelefone(e.target.value);
                        setWppError('');
                      }}
                      placeholder="DDD e número de WhatsApp..."
                      className="w-full px-3.5 py-2.5 text-xs min-h-[44px]"
                    />
                  </div>

                  {!wppOtpSent ? (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleRequestWppToken}
                        disabled={wppLoading}
                        className="w-full py-3 rounded-full btn-metallic-gold text-xs flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
                      >
                        <Smartphone className="w-4 h-4" />
                        <span>{wppLoading ? 'Enviando...' : 'Solicitar Código'}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4 pt-1">
                      <div className="p-3.5 bg-[#20E3B2]/10 border border-[#20E3B2]/30 rounded-xl space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold text-[#20E3B2]">
                          <span className="flex items-center gap-1.5">
                            <Check className="w-4 h-4" />
                            <span>Código Enviado</span>
                          </span>
                          <span className="text-[11px] text-[#F5B041] font-mono font-bold">Válido por 5 min</span>
                        </div>
                        <p className="text-[11px] text-slate-300">
                          Se o número informado pertencer a um usuário cadastrado, o código de autenticação de 6 dígitos foi enviado via WhatsApp.
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                          Código de Autenticação (6 dígitos)
                        </label>
                        <input
                          type="text"
                          autoFocus
                          value={wppOtpCode}
                          onChange={(e) => setWppOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="000000"
                          maxLength={6}
                          className="w-full text-center text-lg tracking-[0.25em] font-mono py-2.5 text-[#F5B041] min-h-[44px]"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleRequestWppToken}
                          disabled={wppLoading}
                          className="py-2.5 px-4 pill-status-dark rounded-full text-xs font-medium transition-colors min-h-[44px] cursor-pointer"
                        >
                          Reenviar
                        </button>
                        <button
                          type="submit"
                          disabled={wppLoading || !wppOtpCode.trim()}
                          className="flex-1 py-2.5 rounded-full btn-turquoise-pill disabled:opacity-50 text-xs flex items-center justify-center gap-2 min-h-[44px] cursor-pointer"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>{wppLoading ? 'Validando...' : 'Entrar'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {wppError && (
                    <div className="p-3 bg-[#FF6B57]/15 border border-[#FF6B57]/45 rounded-xl flex items-center gap-3 text-xs text-[#FF8A7A] font-mono">
                      <div className="w-11 h-11 flex items-center justify-center shrink-0">
                        <SystemSlotImage
                          slot="dialogos_seguranca"
                          brandConfig={brandConfig}
                          overrideSource="comunicacao"
                          className="w-11 h-11"
                        />
                      </div>
                      <div className="flex-1">{wppError}</div>
                    </div>
                  )}
                </form>
              )}

              {loginTab === 'argon2' && (
                <div className="p-4 sm:p-6 space-y-4">
                  <form onSubmit={handleUnlockSession} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                        Identificador / Usuário
                      </label>
                      <input
                        type="text"
                        value={unlockIdentificador}
                        onChange={(e) => {
                          setUnlockIdentificador(e.target.value);
                          setUnlockError('');
                        }}
                        placeholder="Nome de usuário, WhatsApp ou e-mail..."
                        className="w-full px-3.5 py-2.5 text-xs min-h-[44px]"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-medium text-[#94A3B8]">
                          Senha de Acesso
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setRecoveryOpen((prev) => !prev);
                            setRecoveryError('');
                            setRecoveryFeedback('');
                            if (!recoveryIdentificador && unlockIdentificador) {
                              setRecoveryIdentificador(unlockIdentificador);
                            }
                          }}
                          className="text-[11px] font-semibold text-[#10B981] hover:underline cursor-pointer"
                        >
                          {recoveryOpen ? 'Voltar ao Login' : 'Esqueci minha senha (E-mail ou WhatsApp)'}
                        </button>
                      </div>
                      <input
                        type="password"
                        autoFocus={!recoveryOpen}
                        value={unlockPassword}
                        onChange={(e) => setUnlockPassword(e.target.value)}
                        placeholder="Digite sua senha de acesso..."
                        className="w-full px-3.5 py-2.5 text-xs font-mono min-h-[44px]"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={unlockLoading || !unlockPassword.trim()}
                      className="w-full py-3 rounded-full btn-metallic-gold disabled:opacity-50 text-xs flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
                    >
                      <Key className="w-4 h-4" />
                      <span>{unlockLoading ? 'Validando...' : 'Entrar com Senha'}</span>
                    </button>

                    {unlockError && (
                      <div className="p-3 bg-[#FF6B57]/15 border border-[#FF6B57]/45 rounded-xl flex items-center gap-3 text-xs text-[#FF8A7A] font-mono">
                        <div className="w-11 h-11 flex items-center justify-center shrink-0">
                          <SystemSlotImage
                            slot="dialogos_seguranca"
                            brandConfig={brandConfig}
                            overrideSource="comunicacao"
                            className="w-11 h-11"
                          />
                        </div>
                        <div className="flex-1">{unlockError}</div>
                      </div>
                    )}
                  </form>

                  {recoveryOpen && (
                    <div className="p-4 rounded-xl bg-[#071712] border border-[#10B981]/40 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-bold text-[#10B981]">
                          Recuperar / Redefinir Senha por WhatsApp ou E-mail
                        </div>
                        <button
                          type="button"
                          onClick={() => setRecoveryOpen(false)}
                          className="text-slate-400 hover:text-white cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setRecoveryCanal('whatsapp')}
                          className={`py-2 px-3 rounded-lg text-xs font-bold border min-h-[40px] cursor-pointer ${
                            recoveryCanal === 'whatsapp'
                              ? 'bg-[#10B981] text-[#05100C] border-[#10B981]'
                              : 'bg-[#05100C] text-slate-300 border-white/10'
                          }`}
                        >
                          Receber por WhatsApp
                        </button>
                        <button
                          type="button"
                          onClick={() => setRecoveryCanal('email')}
                          className={`py-2 px-3 rounded-lg text-xs font-bold border min-h-[40px] cursor-pointer ${
                            recoveryCanal === 'email'
                              ? 'bg-[#10B981] text-[#05100C] border-[#10B981]'
                              : 'bg-[#05100C] text-slate-300 border-white/10'
                          }`}
                        >
                          Receber por E-mail
                        </button>
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">
                          Seu Nome de Usuário, WhatsApp ou E-mail
                        </label>
                        <input
                          type="text"
                          value={recoveryIdentificador}
                          onChange={(e) => setRecoveryIdentificador(e.target.value)}
                          placeholder="Ex: Admin Master, 91999999999 ou seu@email.com"
                          className="w-full px-3 py-2 text-xs min-h-[40px]"
                        />
                      </div>

                      {recoveryStep === 'request' ? (
                        <button
                          type="button"
                          disabled={recoveryLoading}
                          onClick={handleRequestPasswordRecovery}
                          className="w-full py-2.5 rounded-lg bg-[#10B981] hover:bg-[#34D399] text-[#05100C] text-xs font-black min-h-[40px] cursor-pointer disabled:opacity-50"
                        >
                          {recoveryLoading
                            ? 'Enviando Código...'
                            : `Enviar Código de 6 Dígitos via ${recoveryCanal === 'email' ? 'E-mail' : 'WhatsApp'}`}
                        </button>
                      ) : (
                        <form onSubmit={handleConfirmPasswordRecovery} className="space-y-3 pt-1">
                          {recoveryFeedback && (
                            <div className="p-2.5 rounded-lg bg-[#10B981]/15 border border-[#10B981]/40 text-[11px] text-emerald-200">
                              {recoveryFeedback}
                            </div>
                          )}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] text-slate-300 mb-1">
                                Código de 6 Dígitos
                              </label>
                              <input
                                type="text"
                                maxLength={6}
                                value={recoveryToken}
                                onChange={(e) =>
                                  setRecoveryToken(e.target.value.replace(/\D/g, '').slice(0, 6))
                                }
                                placeholder="000000"
                                className="w-full px-3 py-2 text-xs font-mono tracking-widest text-center min-h-[40px]"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-slate-300 mb-1">
                                Nova Senha
                              </label>
                              <input
                                type="password"
                                value={recoveryNovaSenha}
                                onChange={(e) => setRecoveryNovaSenha(e.target.value)}
                                placeholder="Mínimo 4 caracteres"
                                className="w-full px-3 py-2 text-xs font-mono min-h-[40px]"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={handleRequestPasswordRecovery}
                              disabled={recoveryLoading}
                              className="py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 min-h-[40px] cursor-pointer"
                            >
                              Reenviar Código
                            </button>
                            <button
                              type="submit"
                              disabled={recoveryLoading}
                              className="py-2 px-3 rounded-lg bg-[#10B981] hover:bg-[#34D399] text-[#05100C] text-xs font-black min-h-[40px] cursor-pointer"
                            >
                              {recoveryLoading ? 'Salvando...' : 'Confirmar Nova Senha'}
                            </button>
                          </div>
                        </form>
                      )}

                      {recoveryError && (
                        <div className="p-2.5 bg-[#FF6B57]/15 border border-[#FF6B57]/45 rounded-lg flex items-center gap-2.5 text-xs text-[#FF8A7A]">
                          <div className="w-9 h-9 flex items-center justify-center shrink-0">
                            <SystemSlotImage
                              slot="dialogos_seguranca"
                              brandConfig={brandConfig}
                              overrideSource="comunicacao"
                              className="w-9 h-9"
                            />
                          </div>
                          <div className="flex-1">{recoveryError}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {loginTab === 'cadastro' && (
                <div className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                  {cadCriadoResumo ? (
                    <div className="space-y-4">
                      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-emerald-300">
                            Link Exclusivo Gerado:
                          </span>
                          <span className="font-mono font-bold text-white">
                            https://{cadCriadoResumo.empresa?.subdominio || normalizarSlugEmpresa(cadNomeEmpresa)}.nyctibi.us
                          </span>
                        </div>
                        <div className="text-sm font-bold text-white pt-1">
                          Tudo Pronto! Seus Dados Ficam Exclusivamente com Você
                        </div>
                        <p className="text-xs text-slate-300">
                          A pasta <strong>{cadCriadoResumo.empresa?.lgpd_custodia_config?.pasta_google_drive_nome}</strong> e suas planilhas foram preparadas para o seu controle exclusivo (<strong>{cadCriadoResumo.empresa?.lgpd_custodia_config?.conta_google_vinculada || cadEmail || 'Sua Conta Conectada'}</strong>), com cópias automáticas no seu Drive e no seu computador.
                        </p>
                      </div>

                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {(cadCriadoResumo.empresa?.lgpd_custodia_config?.estrutura_diretorios_planilhas || []).map((dir: any) => (
                          <div
                            key={dir.codigo}
                            className="p-2.5 rounded-lg bg-black/40 border border-white/10 text-[11px] flex flex-col gap-0.5"
                          >
                            <div className="font-mono font-bold text-[#6EE7B7]">
                              [{dir.codigo}] {dir.nome_pasta}
                            </div>
                            {dir.planilha_nome && (
                              <div className="text-slate-300">
                                Backup Automático: <strong>{dir.planilha_nome}</strong> ({(dir.abas || []).length} abas)
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSessionVerifiedByServer(true);
                          setIsSessionLocked(false);
                          setIsUserAuthenticated(true);
                          setShowLandingPage(false);
                          setCadCriadoResumo(null);
                        }}
                        className="w-full py-3 rounded-lg btn-turquoise-pill text-xs font-bold cursor-pointer"
                      >
                        Entrar no Sistema Agora
                      </button>
                    </div>
                  ) : (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!cadNomeEmpresa.trim() || !cadNomeEmpresario.trim() || !cadWhatsapp.trim() || !cadSenha.trim()) {
                          setCadError('Preencha Nome da Empresa, Seu Nome, WhatsApp e Senha.');
                          return;
                        }
                        if (!cadAceiteLgpd) {
                          setCadError('Confirme a proteção de backup LGPD para continuar.');
                          return;
                        }
                        if (cadModoGuarda === 'computador_local_multiacesso' && !cadCienciaMultiacessoSemDrive) {
                          setCadError('Confirme que entendeu as orientações de uso em mais de um computador sem Google Drive.');
                          return;
                        }
                        setCadLoading(true);
                        setCadError('');
                        try {
                          const slugFinal = normalizarSlugEmpresa(cadSubdominioInput || cadNomeEmpresa);
                          const res = await fetch('/api/erp/onboarding-empresario', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              nome_empresa: cadNomeEmpresa.trim(),
                              subdominio: slugFinal,
                              cor_marca_hex: cadCorMarcaHex,
                              logo_data_url: cadLogoDataUrl,
                              nome_empresario: cadNomeEmpresario.trim(),
                              whatsapp: cadWhatsapp.trim(),
                              usar_wpp_pessoal_como_bot: true,
                              whatsapp_bot_empresa: cadWhatsapp.trim(),
                              email: cadEmail.trim(),
                              conta_google_vinculada: cadEmail.trim(),
                              provedor_nuvem_backup: cadProvedorNuvem,
                              cnpj: cadCnpj.trim(),
                              senha: cadSenha.trim(),
                              modo_conexao_drive: cadModoDrive,
                              pasta_google_drive_url: cadPastaDriveUrl.trim(),
                              google_access_token: cadGoogleToken.trim() || 'CONECTADO_AUTOMATICO_BD_NYCTIBI_US',
                              planilha_google_url: cadPlanilhaUrl.trim(),
                              termo_lgpd_aceito: true,
                              zero_guarda_operacional_vps: true,
                              modo_guarda_escolhido: cadModoGuarda,
                              multiacesso_sem_drive_confirmado:
                                cadModoGuarda === 'computador_local_multiacesso'
                                  ? cadCienciaMultiacessoSemDrive
                                  : false
                            })
                          });
                          const json = await res.json();
                          if (!res.ok || !json.ok) {
                            setCadError(json.erro || 'Não foi possível concluir o cadastro.');
                            return;
                          }
                          if (json.empresa?.brand_config) {
                            handleUpdateBrandConfig(json.empresa.brand_config, false);
                          }
                          if (json.empresa?.subdominio) {
                            setPortalSubdominioInput(json.empresa.subdominio);
                            localStorage.setItem('urutau_portal_subdominio', json.empresa.subdominio);
                          }
                          if (json.usuario) {
                            setCurrentUser(json.usuario);
                            setRealOperatorUser(json.usuario);
                            setUnlockIdentificador(json.usuario.nome || '');
                            const empId = json.empresa?.id || 1;
                            setSelectedEmpresaId(empId);
                            persistActiveSession(json.usuario, empId, json.sessao_token);
                            setSessionVerifiedByServer(true);
                            setIsSessionLocked(false);
                            setIsUserAuthenticated(true);
                            handleSaveUserToDeviceList(json.usuario);
                            salvarPacotePortatilLocal(empId);
                          }
                          await fetchAllData();
                          await carregarPortalEmpresaPorSubdominio(json.empresa?.subdominio);
                          setCadCriadoResumo(json);
                        } catch (err: any) {
                          setCadError(err.message || 'Falha ao cadastrar empresa.');
                        } finally {
                          setCadLoading(false);
                        }
                      }}
                      className="space-y-3"
                    >
                      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[11px] text-slate-200 space-y-1">
                        <div className="font-bold text-emerald-300">
                          Link Próprio (.nyctibi.us) + Seus Dados 100% no Seu Drive ou Computador
                        </div>
                        <p className="text-slate-300">
                          Ao cadastrar, você recebe seu endereço exclusivo <strong>{(cadSubdominioInput || normalizarSlugEmpresa(cadNomeEmpresa || 'sua-empresa'))}.nyctibi.us</strong> com login personalizado da sua marca.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                            Nome da Empresa *
                          </label>
                          <input
                            type="text"
                            required
                            value={cadNomeEmpresa}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCadNomeEmpresa(val);
                              if (!cadSubdominioEditadoManual) {
                                setCadSubdominioInput(normalizarSlugEmpresa(val));
                              }
                            }}
                            placeholder="Ex: Restaurante Amazônia Grill"
                            className="w-full px-3 py-2 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                            Seu Link Exclusivo (.nyctibi.us) *
                          </label>
                          <div className="flex items-center rounded-lg bg-[#070C10] border border-white/[0.08] overflow-hidden">
                            <input
                              type="text"
                              value={cadSubdominioInput || (cadNomeEmpresa ? normalizarSlugEmpresa(cadNomeEmpresa) : '')}
                              onChange={(e) => {
                                setCadSubdominioEditadoManual(true);
                                setCadSubdominioInput(normalizarSlugEmpresa(e.target.value));
                              }}
                              placeholder="sua-empresa"
                              className="flex-1 px-2.5 py-2 text-xs font-mono text-emerald-300 !border-0"
                            />
                            <span className="px-2.5 py-2 text-[11px] font-mono text-slate-400 bg-white/[0.03] border-l border-white/[0.06]">
                              .nyctibi.us
                            </span>
                          </div>
                        </div>
                        <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={cadCorMarcaHex}
                              onChange={(e) => setCadCorMarcaHex(e.target.value.toUpperCase())}
                              className="w-7 h-7 rounded cursor-pointer bg-transparent border border-white/10"
                              title="Cor da marca na tela de login"
                            />
                            <span className="text-xs text-slate-300">
                              Cor e Logo na Tela de Login (<span className="font-mono text-emerald-300">{cadCorMarcaHex}</span>)
                            </span>
                          </div>
                          <label className="px-2.5 py-1 rounded-md bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-[11px] font-semibold text-slate-200 cursor-pointer">
                            {cadLogoDataUrl ? 'Logo Carregada (Trocar)' : 'Enviar Logo da Empresa'}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = async () => {
                                  const url = String(reader.result || '');
                                  setCadLogoDataUrl(url);
                                  const ext = await extractColorsFromLogoImage(url);
                                  if (ext?.dominantHex) setCadCorMarcaHex(ext.dominantHex);
                                };
                                reader.readAsDataURL(file);
                              }}
                            />
                          </label>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                            Seu Nome (Empresário) *
                          </label>
                          <input
                            type="text"
                            required
                            value={cadNomeEmpresario}
                            onChange={(e) => setCadNomeEmpresario(e.target.value)}
                            placeholder="Nome completo"
                            className="w-full px-3 py-2 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                            Seu WhatsApp *
                          </label>
                          <input
                            type="tel"
                            required
                            value={cadWhatsapp}
                            onChange={(e) => setCadWhatsapp(e.target.value)}
                            placeholder="Ex: 91991122334"
                            className="w-full px-3 py-2 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                            E-mail da Sua Conta Google (Drive de Backup)
                          </label>
                          <input
                            type="email"
                            value={cadEmail}
                            onChange={(e) => setCadEmail(e.target.value)}
                            placeholder="suaempresa@gmail.com"
                            className="w-full px-3 py-2 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                            CNPJ / CPF
                          </label>
                          <input
                            type="text"
                            value={cadCnpj}
                            onChange={(e) => setCadCnpj(e.target.value)}
                            placeholder="00.000.000/0001-00"
                            className="w-full px-3 py-2 text-xs"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                            Senha de Acesso *
                          </label>
                          <input
                            type="password"
                            required
                            value={cadSenha}
                            onChange={(e) => setCadSenha(e.target.value)}
                            placeholder="Mínimo 4 caracteres"
                            className="w-full px-3 py-2 text-xs font-mono"
                          />
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-xs font-bold text-[#6EE7B7]">
                            Como Você Prefere Usar e Salvar Seus Dados?
                          </div>
                          <button
                            type="button"
                            onClick={() => setCadMostrarTrocaDrive((prev) => !prev)}
                            className="text-[11px] font-bold text-amber-300 hover:underline cursor-pointer"
                          >
                            {cadMostrarTrocaDrive ? 'Ocultar Opções de Nuvem' : 'Alterar Conta do Drive'}
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setCadModoGuarda('google_drive')}
                            className={`p-2.5 rounded-lg border text-left text-[11px] cursor-pointer ${
                              cadModoGuarda === 'google_drive'
                                ? 'bg-[#10B981]/20 border-[#10B981] text-white'
                                : 'bg-black/30 border-white/10 text-slate-300'
                            }`}
                          >
                            <div className="font-bold text-[#6EE7B7]">Com Google Drive (Recomendado)</div>
                            <div className="text-[10px] text-slate-300 mt-0.5">
                              Sincroniza vários computadores ao mesmo tempo e salva tudo no seu Drive.
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setCadModoGuarda('computador_local_multiacesso')}
                            className={`p-2.5 rounded-lg border text-left text-[11px] cursor-pointer ${
                              cadModoGuarda === 'computador_local_multiacesso'
                                ? 'bg-amber-500/20 border-amber-400 text-white'
                                : 'bg-black/30 border-white/10 text-slate-300'
                            }`}
                          >
                            <div className="font-bold text-amber-300">Sem Google Drive (Só no Computador)</div>
                            <div className="text-[10px] text-slate-300 mt-0.5">
                              Salva direto no computador quando o último PC conectado fechar.
                            </div>
                          </button>
                        </div>

                        {cadModoGuarda === 'google_drive' ? (
                          <div className="space-y-2 text-[11px] text-slate-300">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={handleConectarGoogleDrivePopup}
                                className="px-3.5 py-2.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-[#04181C] text-xs font-black cursor-pointer"
                              >
                                {cadGoogleToken
                                  ? `Conta Google Conectada (${cadEmail || 'Criação Automática Ativa'})`
                                  : 'Conectar Minha Conta Google'}
                              </button>
                            </div>
                            <p className="text-[11px] text-slate-300">
                              Conectando sua conta Google, sua pasta e planilhas são criadas direto no <strong>seu Google Drive</strong> e atualizadas sozinhas de 1 em 1 hora.
                            </p>
                          </div>
                        ) : (
                          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-400/40 space-y-2 text-[11px] text-amber-100">
                            <div className="font-bold text-amber-300">
                              Orientação Importante Para Usar em Mais de Um Computador Sem Google Drive:
                            </div>
                            <div>
                              • Enquanto estiverem abertos juntos, os computadores sincronizam na hora.
                            </div>
                            <div>
                              • Quando o <strong>último computador fechar</strong>, a cópia final fica salva <strong>somente nesse computador</strong>.
                            </div>
                            <div>
                              • No dia seguinte, <strong>abra primeiro pelo último computador que fechou</strong> (ou carregue a cópia salva em Configurações).
                            </div>
                            <label className="flex items-start gap-2 pt-1 cursor-pointer text-white">
                              <input
                                type="checkbox"
                                checked={cadCienciaMultiacessoSemDrive}
                                onChange={(e) => setCadCienciaMultiacessoSemDrive(e.target.checked)}
                                className="mt-0.5 accent-amber-400"
                              />
                              <span>
                                Li e entendi: se usar vários computadores sem Google Drive, o último computador que fechar fica com a versão final e devo abrir primeiro por ele.
                              </span>
                            </label>
                          </div>
                        )}

                        {cadMostrarTrocaDrive && (
                          <div className="p-2.5 rounded-lg bg-black/50 border border-white/10 space-y-2 pt-2">
                            <div className="text-[11px] font-bold text-amber-300">
                              Alterar Conta ou Destino do Seu Drive em Nuvem:
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] text-[#94A3B8] mb-1">
                                  Nuvem de Backup
                                </label>
                                <select
                                  value={cadProvedorNuvem}
                                  onChange={(e) => setCadProvedorNuvem(e.target.value)}
                                  className="w-full px-2.5 py-1.5 text-xs bg-[#041518] border border-white/15 rounded-lg text-white"
                                >
                                  <option value="Google Drive">Google Drive (Criação Automática)</option>
                                  <option value="Google Workspace Corporativo">Google Workspace Corporativo</option>
                                  <option value="Outro Drive em Nuvem">Outra Pasta / Nuvem Personalizada</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] text-[#94A3B8] mb-1">
                                  E-mail da Conta do Drive
                                </label>
                                <input
                                  type="email"
                                  value={cadEmail}
                                  onChange={(e) => setCadEmail(e.target.value)}
                                  placeholder="outraconta@gmail.com"
                                  className="w-full px-2.5 py-1.5 text-xs"
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <label className="block text-[10px] text-[#94A3B8] mb-1">
                                  Pasta Específica do Drive (Opcional — deixe em branco para o sistema criar sozinho)
                                </label>
                                <input
                                  type="url"
                                  value={cadPastaDriveUrl}
                                  onChange={(e) => setCadPastaDriveUrl(e.target.value)}
                                  placeholder="https://drive.google.com/drive/folders/..."
                                  className="w-full px-2.5 py-1.5 text-xs"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <label className="flex items-start gap-2 text-[11px] text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cadAceiteLgpd}
                          onChange={(e) => setCadAceiteLgpd(e.target.checked)}
                          className="mt-0.5 accent-[#10B981]"
                        />
                        <span>
                          Autorizo a criação automática da pasta de <strong>Backup de Segurança Protegido pela LGPD (Art. 5º, VI)</strong> no meu Drive em nuvem, podendo alterar a conta vinculada quando desejar.
                        </span>
                      </label>

                      {cadError && (
                        <div className="p-2.5 bg-[#FF6B57]/15 border border-[#FF6B57]/45 rounded-xl flex items-center gap-3 text-xs text-[#FF8A7A]">
                          <div className="w-11 h-11 flex items-center justify-center shrink-0">
                            <SystemSlotImage
                              slot="dialogos_seguranca"
                              brandConfig={brandConfig}
                              overrideSource="comunicacao"
                              className="w-11 h-11"
                            />
                          </div>
                          <div className="flex-1">{cadError}</div>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={cadLoading}
                        className="w-full py-3 rounded-full btn-metallic-gold disabled:opacity-50 text-xs font-black flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
                      >
                        <FolderPlus className="w-4 h-4" />
                        <span>
                          {cadLoading
                            ? 'Conectando e Criando Backup no Seu Drive...'
                            : 'Cadastrar e Criar Automaticamente no Meu Drive'}
                        </span>
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      
      <PwaInstallBanner />

      
      <UrutauSystemDialog
        dialog={dialog}
        onClose={() => setDialog((prev) => ({ ...prev, open: false }))}
        brandConfig={brandConfig}
      />

      
      {isAuthenticatedAndUnlocked && (
      <FocusFormModal
        open={userSwitchModalOpen}
        title="Alternar Usuário & Contas Salvas"
        subtitle={`Sessão ativa: ${currentUser?.nome || 'Operador'} (${currentUser?.cargo || currentUser?.tipo || 'Operacional'})`}
        onClose={() => setUserSwitchModalOpen(false)}
        maxWidthClass="max-w-xl"
      >
        <div className="space-y-4">
          
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#041518]/90 border border-[#10B981]/25">
            <button
              type="button"
              onClick={() => {
                setUserSwitchTab('salvos');
                setSwitchAuthError('');
              }}
              className={`py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                userSwitchTab === 'salvos'
                  ? 'bg-[#10B981] text-[#04181C] shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Salvos ({effectiveSavedUsers.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setUserSwitchTab('outro_login');
                setSwitchAuthError('');
              }}
              className={`py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                userSwitchTab === 'outro_login'
                  ? 'bg-[#10B981] text-[#04181C] shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Outro Usuário</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setUserSwitchTab('novo_usuario');
                setSwitchAuthError('');
              }}
              className={`py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                userSwitchTab === 'novo_usuario'
                  ? 'bg-[#10B981] text-[#04181C] shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Novo Usuário</span>
            </button>
          </div>

          {switchAuthError && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 font-medium">
              {switchAuthError}
            </div>
          )}

          
          {userSwitchTab === 'salvos' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-[11px] text-slate-300 px-1">
                <span>Selecione uma conta salva para alternar imediatamente ou exclua da lista:</span>
              </div>

              {effectiveSavedUsers.length === 0 ? (
                <div className="p-6 rounded-xl bg-[#04181C]/70 border border-[#10B981]/20 text-center space-y-2">
                  <p className="text-xs text-slate-300">Nenhum usuário salvo neste dispositivo.</p>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setUserSwitchTab('outro_login')}
                      className="px-3 py-1.5 rounded-lg bg-[#10B981]/20 border border-[#10B981]/40 text-xs font-bold text-[#10B981] hover:bg-[#10B981]/30 cursor-pointer"
                    >
                      Entrar com Conta Existente
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserSwitchTab('novo_usuario')}
                      className="px-3 py-1.5 rounded-lg bg-[#10B981] text-xs font-bold text-[#04181C] cursor-pointer"
                    >
                      + Criar Novo Usuário
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {effectiveSavedUsers.map((u) => {
                    const isCurrent =
                      Number(u.id) === Number(currentUser?.id) &&
                      String(u.nome || '').toLowerCase() === String(currentUser?.nome || '').toLowerCase();
                    return (
                      <div
                        key={`${u.id}_${u.nome}`}
                        className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border transition-all ${
                          isCurrent
                            ? 'bg-[#10B981]/15 border-[#10B981]/50'
                            : 'bg-[#04181C]/75 border-white/10 hover:border-[#10B981]/35'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleQuickSwitchToSavedUser(u)}
                          className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                        >
                          <VisualAvatar
                            name={u.nome}
                            role={u.cargo || u.tipo}
                            size="sm"
                            highlight={isCurrent}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white truncate">
                                {u.nome}
                              </span>
                              {isCurrent && (
                                <span className="px-2 py-0.5 rounded-md bg-[#10B981]/25 border border-[#10B981]/50 text-[10px] font-bold text-[#10B981] shrink-0">
                                  Ativo
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {u.cargo || u.tipo || 'Operacional'}
                              {u.telefone ? ` • ${u.telefone}` : ''}
                            </div>
                          </div>
                        </button>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {!isCurrent && (
                            <button
                              type="button"
                              onClick={() => handleQuickSwitchToSavedUser(u)}
                              className="px-3 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-[#04181C] text-xs font-black cursor-pointer transition-colors"
                            >
                              Entrar
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteSavedDeviceUser(u)}
                            className="p-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 border border-rose-500/35 text-rose-300 cursor-pointer transition-colors"
                            title={`Excluir "${u.nome}" dos usuários salvos`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setUserSwitchModalOpen(false);
                    handleSelectTab('cadastros');
                  }}
                  className="text-xs font-semibold text-[#10B981] hover:underline cursor-pointer"
                >
                  Gerenciar Todos os Cadastros e Permissões →
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setUserSwitchTab('outro_login')}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-semibold text-slate-200 cursor-pointer"
                  >
                    Logar com Outro
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserSwitchTab('novo_usuario')}
                    className="px-3 py-1.5 rounded-lg bg-[#10B981]/20 hover:bg-[#10B981]/30 border border-[#10B981]/40 text-xs font-bold text-[#10B981] cursor-pointer"
                  >
                    + Novo Usuário
                  </button>
                </div>
              </div>
            </div>
          )}

          
          {userSwitchTab === 'outro_login' && (
            <form onSubmit={handleLoginWithAnotherUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nome do Usuário ou WhatsApp
                </label>
                <input
                  type="text"
                  autoFocus
                  value={switchLoginIdentificador}
                  onChange={(e) => setSwitchLoginIdentificador(e.target.value)}
                  placeholder="Ex: Admin Master ou número de WhatsApp..."
                  className="w-full px-3.5 py-2.5 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Senha de Acesso
                </label>
                <input
                  type="password"
                  value={switchLoginPassword}
                  onChange={(e) => setSwitchLoginPassword(e.target.value)}
                  placeholder="Digite a senha do usuário..."
                  className="w-full px-3.5 py-2.5 text-xs font-mono"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={switchSaveAccount}
                  onChange={(e) => setSwitchSaveAccount(e.target.checked)}
                />
                <span>Salvar este usuário na lista de acesso rápido deste dispositivo</span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUserSwitchTab('salvos')}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-semibold text-slate-300 cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={switchAuthLoading}
                  className="px-5 py-2 rounded-xl bg-[#10B981] hover:bg-[#059669] text-[#04181C] text-xs font-black cursor-pointer disabled:opacity-50"
                >
                  {switchAuthLoading ? 'Autenticando...' : 'Entrar com Este Usuário'}
                </button>
              </div>
            </form>
          )}

          
          {userSwitchTab === 'novo_usuario' && (
            <form onSubmit={handleCreateAndLoginNewUser} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nome do Novo Usuário *
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={newQuickUserForm.nome}
                    onChange={(e) =>
                      setNewQuickUserForm((prev) => ({ ...prev, nome: e.target.value }))
                    }
                    placeholder="Nome completo ou de operação"
                    className="w-full px-3.5 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Cargo / Função
                  </label>
                  <input
                    type="text"
                    value={newQuickUserForm.cargo}
                    onChange={(e) =>
                      setNewQuickUserForm((prev) => ({ ...prev, cargo: e.target.value }))
                    }
                    placeholder="Ex: Gerente, Caixa, Garçom..."
                    className="w-full px-3.5 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Perfil de Acesso
                  </label>
                  <select
                    value={newQuickUserForm.tipo}
                    onChange={(e) =>
                      setNewQuickUserForm((prev) => ({ ...prev, tipo: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-xs"
                  >
                    <option value="Colaborador">Colaborador</option>
                    <option value="Gestor">Gestor de Unidade</option>
                    <option value="Administrador">Administrador</option>
                    <option value="Super Admin">Super Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    WhatsApp (Opcional)
                  </label>
                  <input
                    type="text"
                    value={newQuickUserForm.telefone}
                    onChange={(e) =>
                      setNewQuickUserForm((prev) => ({ ...prev, telefone: e.target.value }))
                    }
                    placeholder="Ex: 91991122334"
                    className="w-full px-3.5 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Senha de Acesso
                  </label>
                  <input
                    type="password"
                    value={newQuickUserForm.senha}
                    onChange={(e) =>
                      setNewQuickUserForm((prev) => ({ ...prev, senha: e.target.value }))
                    }
                    placeholder="Senha para login"
                    className="w-full px-3.5 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={newQuickUserForm.salvarNoDispositivo}
                  onChange={(e) =>
                    setNewQuickUserForm((prev) => ({
                      ...prev,
                      salvarNoDispositivo: e.target.checked
                    }))
                  }
                />
                <span>Manter salvo na lista de usuários deste dispositivo</span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUserSwitchTab('salvos')}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-semibold text-slate-300 cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={switchAuthLoading}
                  className="px-5 py-2 rounded-xl bg-[#10B981] hover:bg-[#059669] text-[#04181C] text-xs font-black cursor-pointer disabled:opacity-50"
                >
                  {switchAuthLoading ? 'Salvando...' : 'Criar & Entrar Agora'}
                </button>
              </div>
            </form>
          )}
        </div>
      </FocusFormModal>
      )}

      {isAuthenticatedAndUnlocked && isDesktopExeMode && (
        <UrutauWindowsExplorerModal
          open={windowsExplorerErpOpen}
          onClose={() => setWindowsExplorerErpOpen(false)}
          companyName={brandConfig.companyName || 'URUTAU'}
          onLaunchPcProgram={handleLaunchPcProgram}
        />
      )}

      {isAuthenticatedAndUnlocked && <UrutauGlobalSelectSystem onRefreshErp={fetchAllData} />}
    </>
  );
}
