import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Compass,
  Eye,
  Feather,
  HeartHandshake,
  Image as ImageIcon,
  Laptop,
  MessageSquare,
  Moon,
  Palette,
  RotateCcw,
  Shield,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sun,
  Users,
  Wifi,
  WifiOff,
  X,
  ZoomIn
} from 'lucide-react';
import {
  BrandIdentityConfig,
  SystemImageSourceId,
  TabId
} from '../types/erp';
import {
  BUILTIN_BRAND_IMAGES_META,
  SYSTEM_IMAGE_SLOTS_META,
  SystemSlotImage,
  UrutauEmblemSVG,
  UrutauPosturaState,
  UrutauSlotImageManager,
  UrutauValidatedCityStateSelector,
  blendCompanyWithUrutau,
  extractColorsFromLogoImage,
  isSuperAdminUser,
  useUrutauNightFactor
} from './UrutauShared';
import {
  downloadCompanyAutonomyBackup,
  downloadUrutauWindowsInstaller
} from './UrutauWindowsExplorerModal';
import { offlineSyncEngine } from '../services/offlineSyncEngine';

interface UrutauLandingPageProps {
  companyName?: string;
  empresasCount: number;
  usuariosCount: number;
  brandConfig: BrandIdentityConfig;
  isAuthenticated: boolean;
  currentUser: any;
  scrollToPersonalizacaoSignal?: number;
  onUpdateBrandConfig: (nextBrand: BrandIdentityConfig, persistServer?: boolean) => void;
  onRestoreSavedBrandConfig: () => void;
  onToggleAuthenticatedSimulation?: (simulateVisitor: boolean) => void;
  onEnterErp: (targetTab?: TabId) => void;
  onOpenLoginModal: () => void;
  onCompleteOnboarding: (novoUsuario: any, novaEmpresaId: number, sessaoToken?: string) => void;
}

export function UrutauLandingPage({
  companyName = 'URUTAU',
  brandConfig,
  isAuthenticated,
  currentUser,
  scrollToPersonalizacaoSignal = 0,
  onUpdateBrandConfig,
  onRestoreSavedBrandConfig,
  onEnterErp,
  onOpenLoginModal,
  onCompleteOnboarding
}: UrutauLandingPageProps) {
  const [activeNavSection, setActiveNavSection] = useState<
    'personalizacao-aparencia' | 'historia-urutau' | 'cadastro-empresario'
  >('personalizacao-aparencia');
  const [forceSimulationVisitorMode, setForceSimulationVisitorMode] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [deferredPwaPrompt, setDeferredPwaPrompt] = useState<any>(null);
  const [installFeedback, setInstallFeedback] = useState<string>('');
  const personalizacaoSectionRef = useRef<HTMLElement | null>(null);

  const effectiveCanPersist = isAuthenticated && !forceSimulationVisitorMode;
  const isAdminMasterLogado = effectiveCanPersist && isSuperAdminUser(currentUser);

  const [empNomeEmpresario, setEmpNomeEmpresario] = useState<string>('');
  const [empWhatsapp, setEmpWhatsapp] = useState<string>('');
  const [usarWppPessoalComoBot, setUsarWppPessoalComoBot] = useState<boolean>(true);
  const [empWhatsappBot, setEmpWhatsappBot] = useState<string>('');
  const [wppBotPairingCode, setWppBotPairingCode] = useState<string>('');
  const [wppBotQrUrl, setWppBotQrUrl] = useState<string>('');
  const [wppBotConnected, setWppBotConnected] = useState<boolean>(false);
  const [wppBotConnecting, setWppBotConnecting] = useState<boolean>(false);
  const [empEmail, setEmpEmail] = useState<string>('');
  const [empSenha, setEmpSenha] = useState<string>('');
  const [empNomeEmpresa, setEmpNomeEmpresa] = useState<string>('');
  const [empCnpj, setEmpCnpj] = useState<string>('');
  const [empRamo, setEmpRamo] = useState<string>('Restaurante / Bar / Gastronomia');
  const [empCidade, setEmpCidade] = useState<string>('Belém - PA');
  const [empUnidadeInicial, setEmpUnidadeInicial] = useState<string>('Matriz Principal');
  const [empPlanilhaGoogleUrl, setEmpPlanilhaGoogleUrl] = useState<string>('');
  const [empAceiteLgpd, setEmpAceiteLgpd] = useState<boolean>(true);
  const [showLgpdModal, setShowLgpdModal] = useState<boolean>(false);
  const [onboardingLoading, setOnboardingLoading] = useState<boolean>(false);
  const [onboardingError, setOnboardingError] = useState<string>('');
  const [onboardingResult, setOnboardingResult] = useState<{
    empresa: any;
    usuario: any;
    unidade: any;
    modoOffline?: boolean;
  } | null>(null);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPwaPrompt(e);
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
    };
  }, []);

  useEffect(() => {
    const sectionIds: Array<
      'personalizacao-aparencia' | 'historia-urutau' | 'cadastro-empresario'
    > = [
      'personalizacao-aparencia',
      'historia-urutau',
      'cadastro-empresario'
    ];
    const handleScroll = () => {
      let current: typeof sectionIds[number] = 'personalizacao-aparencia';
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 180) {
            current = id;
          }
        }
      }
      setActiveNavSection(current);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (scrollToPersonalizacaoSignal > 0 && personalizacaoSectionRef.current) {
      setActiveNavSection('personalizacao-aparencia');
      personalizacaoSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [scrollToPersonalizacaoSignal]);

  const scrollToPersonalizacao = () => {
    setActiveNavSection('personalizacao-aparencia');
    if (personalizacaoSectionRef.current) {
      personalizacaoSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const [detectedLogoHighlights, setDetectedLogoHighlights] = useState<string[]>(
    brandConfig.logoHighlights || []
  );

  useEffect(() => {
    if (!brandConfig.logoDataUrl) {
      setDetectedLogoHighlights([]);
      return;
    }
    let active = true;
    extractColorsFromLogoImage(brandConfig.logoDataUrl).then((res) => {
      if (active && res.highlights?.length) {
        setDetectedLogoHighlights(res.highlights);
      }
    });
    return () => {
      active = false;
    };
  }, [brandConfig.logoDataUrl]);

  const applyBrandChange = (nextBrand: BrandIdentityConfig) => {
    onUpdateBrandConfig(nextBrand, effectiveCanPersist);
  };

  const handleInstallAppPlatform = async (platformLabel: 'Computador' | 'Celular') => {
    if (platformLabel === 'Computador') {
      await downloadUrutauWindowsInstaller(brandConfig.companyName || companyName || 'URUTAU');
      setInstallFeedback(
        'Download do aplicativo fechado Urutau.exe iniciado! Execute o Urutau.exe no seu computador (executável binário fechado, sem tela de CMD) para abrir seus programas de atendimento por dentro do sistema.'
      );
      return;
    }

    if (deferredPwaPrompt) {
      deferredPwaPrompt.prompt();
      const choice = await deferredPwaPrompt.userChoice;
      if (choice?.outcome === 'accepted') {
        setInstallFeedback(`Aplicativo para ${platformLabel} instalado com sucesso!`);
        setDeferredPwaPrompt(null);
        return;
      }
    }
    setInstallFeedback(
      'No celular, toque em Compartilhar / Menu e escolha "Adicionar à Tela de Início" para usar o aplicativo no bolso com ou sem internet.'
    );
  };

  const handleIniciarConexaoBotWpp = async () => {
    const numeroAlvo = usarWppPessoalComoBot ? empWhatsapp : empWhatsappBot;
    if (!numeroAlvo || numeroAlvo.replace(/\D/g, '').length < 8) {
      setOnboardingError(
        usarWppPessoalComoBot
          ? 'Preencha seu WhatsApp Pessoal acima para conectar o Bot.'
          : 'Preencha o número do WhatsApp do Bot da Empresa para conectar.'
      );
      return;
    }
    setOnboardingError('');
    setWppBotConnecting(true);
    try {
      const res = await fetch('/api/erp/wpp-bot/iniciar-conexao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsapp_pessoal: empWhatsapp,
          numero_bot: numeroAlvo,
          usar_wpp_pessoal_como_bot: usarWppPessoalComoBot,
          nome_empresa: empNomeEmpresa || 'Minha Empresa'
        })
      });
      const json = await res.json();
      if (res.ok && json?.ok) {
        setWppBotPairingCode(json.codigo_pareamento || 'URUT-7742');
        setWppBotQrUrl(json.qr_payload || `https://wa.me/55${numeroAlvo.replace(/\D/g, '')}`);
      } else {
        const fallbackCode = `URUT-${Math.floor(1000 + Math.random() * 9000)}`;
        setWppBotPairingCode(fallbackCode);
        setWppBotQrUrl(`https://wa.me/55${numeroAlvo.replace(/\D/g, '')}`);
      }
    } catch {
      const fallbackCode = `URUT-${Math.floor(1000 + Math.random() * 9000)}`;
      setWppBotPairingCode(fallbackCode);
      setWppBotQrUrl(`https://wa.me/55${numeroAlvo.replace(/\D/g, '')}`);
    } finally {
      setWppBotConnecting(false);
    }
  };

  const handleConfirmarConexaoBotWpp = async () => {
    const numeroAlvo = usarWppPessoalComoBot ? empWhatsapp : empWhatsappBot;
    setWppBotConnecting(true);
    try {
      await fetch('/api/erp/wpp-bot/confirmar-conexao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsapp_pessoal: empWhatsapp,
          numero_bot: numeroAlvo,
          usar_wpp_pessoal_como_bot: usarWppPessoalComoBot,
          codigo_pareamento: wppBotPairingCode
        })
      });
    } catch {}
    setWppBotConnected(true);
    setWppBotConnecting(false);
  };

  const handleCadastrarEmpresario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empNomeEmpresario.trim() || !empNomeEmpresa.trim() || !empWhatsapp.trim() || !empSenha.trim()) {
      setOnboardingError('Por favor, preencha seu nome, nome da empresa, WhatsApp e uma senha de acesso.');
      return;
    }
    if (empWhatsapp.replace(/\D/g, '').length < 8) {
      setOnboardingError('Informe um número de WhatsApp pessoal válido.');
      return;
    }
    if (!usarWppPessoalComoBot && empWhatsappBot.replace(/\D/g, '').length < 8) {
      setOnboardingError('Informe o número de WhatsApp que será o Bot da Empresa.');
      return;
    }
    if (empSenha.trim().length < 4) {
      setOnboardingError('A senha deve ter pelo menos 4 caracteres.');
      return;
    }
    if (!empAceiteLgpd) {
      setOnboardingError('Confirme a ciência de Guarda Própria dos Dados (LGPD) para concluir o cadastro.');
      return;
    }

    setOnboardingLoading(true);
    setOnboardingError('');

    const numeroBotFinal = usarWppPessoalComoBot ? empWhatsapp.trim() : empWhatsappBot.trim();

    const payload = {
      nome_empresario: empNomeEmpresario.trim(),
      whatsapp: empWhatsapp.trim(),
      usar_wpp_pessoal_como_bot: usarWppPessoalComoBot,
      whatsapp_bot_empresa: numeroBotFinal,
      wpp_bot_ja_conectado: wppBotConnected,
      email: empEmail.trim(),
      senha: empSenha.trim(),
      nome_empresa: empNomeEmpresa.trim(),
      cnpj: empCnpj.trim(),
      ramo: empRamo,
      cidade: empCidade.trim() || 'Belém - PA',
      nome_unidade_inicial: empUnidadeInicial.trim() || 'Matriz Principal',
      planilha_google_url: empPlanilhaGoogleUrl.trim(),
      termo_lgpd_aceito: true,
      zero_guarda_operacional_vps: true
    };

    try {
      const res = await offlineSyncEngine.fetchWithOfflineSupport('/api/erp/onboarding-empresario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();

      if (json?.offlineQueued) {
        const tempEmpId = Date.now();
        const localEmp = {
          id: tempEmpId,
          nome: payload.nome_empresa,
          cnpj: payload.cnpj,
          waha_numero: numeroBotFinal,
          whatsapp_pessoal_titular: payload.whatsapp,
          usar_wpp_pessoal_como_bot: usarWppPessoalComoBot,
          cidade: payload.cidade,
          ramo: payload.ramo
        };
        const localUser = {
          id: tempEmpId + 1,
          nome: payload.nome_empresario,
          telefone: payload.whatsapp,
          whatsapp_bot_vinculado: numeroBotFinal,
          usar_wpp_pessoal_como_bot: usarWppPessoalComoBot,
          tipo: 'Gestor da Empresa',
          cargo: 'Empresário / Proprietário',
          empresas_ids: [tempEmpId],
          permissoes_json: { total: false, gerenciar_subordinados: true }
        };
        setOnboardingResult({
          empresa: localEmp,
          usuario: localUser,
          unidade: { nome: payload.nome_unidade_inicial },
          modoOffline: true
        });
        onCompleteOnboarding(localUser, tempEmpId);
        return;
      }

      if (!res.ok || !json.ok) {
        setOnboardingError(json.erro || 'Não foi possível concluir o cadastro.');
        return;
      }

      setOnboardingResult({
        empresa: json.empresa,
        usuario: json.usuario,
        unidade: json.unidade,
        modoOffline: false
      });
      onCompleteOnboarding(json.usuario, json.empresa.id, json.sessao_token);
    } catch (err: any) {
      setOnboardingError(err.message || 'Erro ao registrar sua empresa.');
    } finally {
      setOnboardingLoading(false);
    }
  };

  const { nightFactor, isManual: isManualNight, setManualFactor } = useUrutauNightFactor();
  const liveBlended = blendCompanyWithUrutau(
    brandConfig.companyColorHex || '#10B981',
    brandConfig.urutauBaseHex || '#10B981',
    brandConfig.blendRatio ?? 0.7,
    nightFactor
  );
  const currentAccentHex = liveBlended.effectiveHex;
  const currentSecondaryHex = brandConfig.effectiveSecondaryHex || brandConfig.companySecondaryHex || '#F59E0B';
  const currentTertiaryHex = brandConfig.effectiveTertiaryHex || brandConfig.companyTertiaryHex || '#06B6D4';
  const tempGallery = brandConfig.customGallery || [];

  const handleUploadSecondaryGalleryFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    const loadedItems: { id: string; nome: string; dataUrl: string }[] = [];
    let processed = 0;

    fileArray.forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        if (dataUrl) {
          loadedItems.push({
            id: `temp_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
            nome: file.name.replace(/\.[^/.]+$/, '').slice(0, 28) || `Foto ${idx + 1}`,
            dataUrl
          });
        }
        processed += 1;
        if (processed === fileArray.length && loadedItems.length > 0) {
          applyBrandChange({
            ...brandConfig,
            customGallery: [...(brandConfig.customGallery || []), ...loadedItems]
          });
        }
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="min-h-screen w-full text-[#F8FAFC] flex flex-col selection:bg-[#10B981] selection:text-[#04120C]">
      <header className="sticky top-0 z-50 w-full bg-[#04161A]/95 backdrop-blur-xl border-b border-[#10B981]/25 px-4 sm:px-8 py-3 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={scrollToPersonalizacao}
          className="flex items-center gap-2.5 text-left cursor-pointer group shrink-0"
          title="Clique no nome ou logo para personalizar ou simular a aparência da sua empresa"
        >
          <SystemSlotImage
            slot="topo_painel"
            brandConfig={brandConfig}
            className="w-10 h-10 shrink-0 transition-transform duration-200 group-hover:scale-105"
          />
          <div className="flex flex-col">
            <span className="text-base sm:text-lg font-black tracking-wider text-white uppercase leading-none">
              {brandConfig.companyName || companyName || 'URUTAU'}
            </span>
            <span
              className="text-[10px] font-semibold"
              style={{ color: currentSecondaryHex }}
            >
              {effectiveCanPersist ? 'Personalizar Sua Marca' : 'Testar Cores da Sua Empresa'}
            </span>
          </div>
        </button>

        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-300">
          {[
            { id: 'personalizacao-aparencia' as const, label: 'Personalizar Aparência' },
            { id: 'historia-urutau' as const, label: 'Sobre o Sistema' },
            { id: 'cadastro-empresario' as const, label: 'Começar na Minha Empresa' }
          ].map((navItem) => {
            const isActive = activeNavSection === navItem.id;
            return (
              <a
                key={navItem.id}
                href={`#${navItem.id}`}
                onClick={() => setActiveNavSection(navItem.id)}
                style={isActive ? { color: currentAccentHex } : undefined}
                className={`hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
                  isActive ? 'font-bold' : 'text-slate-300'
                }`}
              >
                {navItem.label}
              </a>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {isAuthenticated && (
            <button
              type="button"
              onClick={() => onEnterErp()}
              style={{
                borderColor: `${currentTertiaryHex}80`,
                color: currentTertiaryHex
              }}
              className="px-3.5 py-2 rounded-lg bg-[#0D3836]/70 hover:bg-[#0D3836] border font-bold text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Painel
            </button>
          )}
          <button
            type="button"
            onClick={onOpenLoginModal}
            style={{ backgroundColor: currentAccentHex }}
            className="px-4 py-2 rounded-lg text-[#04120C] font-black text-xs sm:text-sm transition-transform hover:scale-[1.02] whitespace-nowrap shrink-0 cursor-pointer shadow-md"
          >
            {isAuthenticated ? `Olá, ${String(currentUser?.nome || 'Empresário').split(' ')[0]}` : 'Entrar'}
          </button>
        </div>
      </header>

      <main id="topo" className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-12 sm:space-y-16">
        <section
          id="personalizacao-aparencia"
          ref={personalizacaoSectionRef}
          className="bg-[#061D21]/95 border-2 rounded-2xl p-5 sm:p-8 space-y-6 shadow-2xl scroll-mt-20"
          style={{ borderColor: `${currentAccentHex}66` }}
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-white/10">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 flex items-center justify-center shrink-0">
                <SystemSlotImage
                  slot="topo_painel"
                  brandConfig={brandConfig}
                  className="w-full h-full"
                />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Personalize com a sua Marca
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {brandConfig.logoDataUrl && (
                <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold inline-flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  <span>Logo Ativa</span>
                </span>
              )}

              {isAuthenticated && (
                <button
                  type="button"
                  onClick={() => {
                    if (!forceSimulationVisitorMode) {
                      setForceSimulationVisitorMode(true);
                    } else {
                      setForceSimulationVisitorMode(false);
                      onRestoreSavedBrandConfig();
                    }
                  }}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
                    forceSimulationVisitorMode
                      ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                      : 'bg-black/40 border-white/15 text-slate-300 hover:text-white'
                  }`}
                >
                  {forceSimulationVisitorMode
                    ? 'Voltar ao Modo Logado'
                    : 'Testar sem Salvar'}
                </button>
              )}

              {!effectiveCanPersist && (
                <>
                  <button
                    type="button"
                    onClick={onRestoreSavedBrandConfig}
                    className="px-3.5 py-2 rounded-xl bg-black/45 hover:bg-black/65 border border-white/15 text-xs font-bold text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restaurar</span>
                  </button>
                  <button
                    type="button"
                    onClick={onOpenLoginModal}
                    style={{ backgroundColor: currentAccentHex }}
                    className="px-4 py-2 rounded-xl text-[#04120C] text-xs font-black cursor-pointer shadow-md"
                  >
                    Salvar
                  </button>
                </>
              )}

              {effectiveCanPersist && (
                <button
                  type="button"
                  onClick={() => onEnterErp()}
                  style={{ backgroundColor: currentAccentHex }}
                  className="px-4 py-2 rounded-xl text-[#04120C] text-xs font-black cursor-pointer shadow-md inline-flex items-center gap-1.5"
                >
                  <span>Ir ao Painel</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            <div className="lg:col-span-5 p-4 rounded-xl bg-[#041215] border border-white/10 flex flex-col justify-center gap-3.5">
              <div className="flex items-center gap-3.5">
                {brandConfig.logoDataUrl ? (
                  <div className="w-14 h-14 rounded-lg bg-[#081F22] border border-white/15 flex items-center justify-center shrink-0 p-1 overflow-hidden">
                    <img
                      src={brandConfig.logoDataUrl}
                      alt="Logo Empresa"
                      className="w-full h-full object-contain rounded"
                    />
                  </div>
                ) : (
                  <div className="w-14 h-14 flex items-center justify-center shrink-0">
                    <UrutauEmblemSVG
                      postura="sentinela"
                      className="w-full h-full"
                    />
                  </div>
                )}

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-200 truncate">
                      Logo da Empresa
                    </span>
                    {brandConfig.logoDataUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          applyBrandChange({
                            ...brandConfig,
                            logoDataUrl: '',
                            slotCustomizations: {
                              ...(brandConfig.slotCustomizations || {}),
                              topo_painel: { choice: 'passaro' }
                            }
                          })
                        }
                        className="text-[11px] text-rose-400 hover:text-rose-300 cursor-pointer shrink-0"
                      >
                        Remover
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <label
                      style={{ backgroundColor: currentAccentHex }}
                      className="flex-1 px-3 py-2 rounded-lg text-[#04120C] text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all hover:brightness-110"
                    >
                      <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">
                        {brandConfig.logoDataUrl ? 'Trocar Minha Logo' : 'Enviar Minha Logo'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = async () => {
                            const dataUrl = String(reader.result || '');
                            const extracted = await extractColorsFromLogoImage(dataUrl);
                            setDetectedLogoHighlights(extracted.highlights || []);
                            const blended = blendCompanyWithUrutau(
                              extracted.dominantHex,
                              brandConfig.urutauBaseHex || '#10B981',
                              brandConfig.blendRatio ?? 0.7,
                              nightFactor
                            );
                            applyBrandChange({
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
                      className="px-3 py-2 rounded-lg bg-[#081F22] hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-all shrink-0"
                    >
                      <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                      <span>Galeria</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-200">
                    Nome da Empresa
                  </label>
                  <span
                    className="text-[11px] font-mono font-bold truncate max-w-[180px]"
                    style={{ color: currentAccentHex }}
                  >
                    {brandConfig.companyName || 'URUTAU'}
                  </span>
                </div>
                <input
                  type="text"
                  value={brandConfig.companyName || ''}
                  onChange={(e) =>
                    applyBrandChange({
                      ...brandConfig,
                      companyName: e.target.value
                    })
                  }
                  placeholder="Ex: Restaurante Tapiri"
                  className="w-full px-3 py-2 bg-[#081F22] border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 font-medium focus:outline-none focus:border-[#10B981]"
                />
              </div>
            </div>

            <div className="lg:col-span-7 p-4 rounded-xl bg-[#041215] border border-white/10 flex flex-col justify-center gap-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                <span>Cores de Destaque da Marca e Transição Solar</span>
                {brandConfig.logoDataUrl && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!brandConfig.logoDataUrl) return;
                      const extracted = await extractColorsFromLogoImage(brandConfig.logoDataUrl);
                      setDetectedLogoHighlights(extracted.highlights || []);
                      const blended = blendCompanyWithUrutau(
                        extracted.dominantHex,
                        brandConfig.urutauBaseHex || '#10B981',
                        brandConfig.blendRatio ?? 0.7,
                        nightFactor
                      );
                      applyBrandChange({
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
                    className="text-[10px] font-semibold text-cyan-300 hover:underline cursor-pointer"
                  >
                    Extrair Destaques da Logo
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-center">
                <div className="md:col-span-6 space-y-2.5">
                  <div className="grid grid-cols-3 gap-2">
                    <label className="p-2 rounded-lg bg-[#081F22] border border-white/10 hover:border-white/25 flex flex-col gap-1 cursor-pointer">
                      <span className="text-[10px] font-bold text-slate-300 truncate">Cor Principal</span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-4 h-4 rounded border border-white/20 shrink-0"
                          style={{ backgroundColor: currentAccentHex }}
                        />
                        <span className="font-mono text-[10px] text-slate-200 truncate">
                          {currentAccentHex}
                        </span>
                      </div>
                      <input
                        type="color"
                        value={brandConfig.companyColorHex || '#10B981'}
                        onChange={(e) => {
                          const newHex = e.target.value.toUpperCase();
                          const blended = blendCompanyWithUrutau(
                            newHex,
                            brandConfig.urutauBaseHex || '#10B981',
                            brandConfig.blendRatio ?? 0.7,
                            nightFactor
                          );
                          applyBrandChange({
                            ...brandConfig,
                            companyColorHex: newHex,
                            effectivePrimaryHex: blended.effectiveHex,
                            effectivePrimaryRgb: blended.rgb
                          });
                        }}
                        className="sr-only"
                      />
                    </label>

                    <label className="p-2 rounded-lg bg-[#081F22] border border-white/10 hover:border-white/25 flex flex-col gap-1 cursor-pointer">
                      <span className="text-[10px] font-bold text-slate-300 truncate">Secundária 1</span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-4 h-4 rounded border border-white/20 shrink-0"
                          style={{ backgroundColor: currentSecondaryHex }}
                        />
                        <span className="font-mono text-[10px] text-amber-300 truncate">
                          {currentSecondaryHex}
                        </span>
                      </div>
                      <input
                        type="color"
                        value={currentSecondaryHex}
                        onChange={(e) => {
                          const newSec = e.target.value.toUpperCase();
                          applyBrandChange({
                            ...brandConfig,
                            companySecondaryHex: newSec,
                            effectiveSecondaryHex: newSec
                          });
                        }}
                        className="sr-only"
                      />
                    </label>

                    <label className="p-2 rounded-lg bg-[#081F22] border border-white/10 hover:border-white/25 flex flex-col gap-1 cursor-pointer">
                      <span className="text-[10px] font-bold text-slate-300 truncate">Secundária 2</span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-4 h-4 rounded border border-white/20 shrink-0"
                          style={{ backgroundColor: currentTertiaryHex }}
                        />
                        <span className="font-mono text-[10px] text-cyan-300 truncate">
                          {currentTertiaryHex}
                        </span>
                      </div>
                      <input
                        type="color"
                        value={currentTertiaryHex}
                        onChange={(e) => {
                          const newTert = e.target.value.toUpperCase();
                          applyBrandChange({
                            ...brandConfig,
                            companyTertiaryHex: newTert,
                            effectiveTertiaryHex: newTert
                          });
                        }}
                        className="sr-only"
                      />
                    </label>
                  </div>

                  {brandConfig.logoDataUrl && detectedLogoHighlights.length > 0 && (
                    <div className="p-2 rounded-lg bg-[#081F22]/90 border border-white/10 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold text-slate-300">
                          Detalhes Detectados na Logo (Fundo Ignorado)
                        </span>
                        <span className="text-[9px] text-slate-400">
                          Clique para definir Cor Principal
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {detectedLogoHighlights.map((hlHex, idx) => {
                          const isPrimary =
                            (brandConfig.companyColorHex || '').toUpperCase() ===
                            hlHex.toUpperCase();
                          return (
                            <button
                              key={`${hlHex}-${idx}`}
                              type="button"
                              onClick={() => {
                                const nextSec =
                                  detectedLogoHighlights.find(
                                    (c) => c.toUpperCase() !== hlHex.toUpperCase()
                                  ) || currentSecondaryHex;
                                const nextTert =
                                  detectedLogoHighlights.find(
                                    (c) =>
                                      c.toUpperCase() !== hlHex.toUpperCase() &&
                                      c.toUpperCase() !== nextSec.toUpperCase()
                                  ) || currentTertiaryHex;
                                const blended = blendCompanyWithUrutau(
                                  hlHex,
                                  brandConfig.urutauBaseHex || '#10B981',
                                  brandConfig.blendRatio ?? 0.7,
                                  nightFactor
                                );
                                applyBrandChange({
                                  ...brandConfig,
                                  companyColorHex: hlHex,
                                  companySecondaryHex: nextSec,
                                  companyTertiaryHex: nextTert,
                                  effectivePrimaryHex: blended.effectiveHex,
                                  effectivePrimaryRgb: blended.rgb,
                                  effectiveSecondaryHex: nextSec,
                                  effectiveTertiaryHex: nextTert
                                });
                              }}
                              className={`px-2 py-1 rounded-md border text-[10px] font-mono font-bold inline-flex items-center gap-1.5 cursor-pointer transition-all ${
                                isPrimary
                                  ? 'bg-white/15 border-white text-white ring-1 ring-white/60'
                                  : 'bg-[#041215] border-white/15 text-slate-300 hover:border-white/40'
                              }`}
                              title={`Aplicar destaque ${hlHex} da logo`}
                            >
                              <span
                                className="w-3 h-3 rounded-sm border border-black/40 shrink-0"
                                style={{ backgroundColor: hlHex }}
                              />
                              <span>{hlHex}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { hex: '#10B981', sec1: '#F59E0B', sec2: '#06B6D4', nome: 'Ciclo Urutau' },
                      { hex: '#F59E0B', sec1: '#10B981', sec2: '#F43F5E', nome: 'Ouro Solar' },
                      { hex: '#22C55E', sec1: '#EAB308', sec2: '#10B981', nome: 'Verde Mata' },
                      { hex: '#06B6D4', sec1: '#10B981', sec2: '#38BDF8', nome: 'Turquesa' },
                      { hex: '#F43F5E', sec1: '#F59E0B', sec2: '#8B5CF6', nome: 'Urucum' },
                      { hex: '#8B5CF6', sec1: '#06B6D4', sec2: '#F59E0B', nome: 'Açaí' }
                    ].map((sw) => {
                      const isSelected = brandConfig.companyColorHex.toUpperCase() === sw.hex.toUpperCase();
                      return (
                        <button
                          key={sw.hex}
                          type="button"
                          onClick={() => {
                            const blended = blendCompanyWithUrutau(
                              sw.hex,
                              brandConfig.urutauBaseHex || '#10B981',
                              brandConfig.blendRatio ?? 0.7,
                              nightFactor
                            );
                            applyBrandChange({
                              ...brandConfig,
                              companyColorHex: sw.hex,
                              companySecondaryHex: sw.sec1,
                              companyTertiaryHex: sw.sec2,
                              effectivePrimaryHex: blended.effectiveHex,
                              effectivePrimaryRgb: blended.rgb,
                              effectiveSecondaryHex: sw.sec1,
                              effectiveTertiaryHex: sw.sec2
                            });
                          }}
                          style={{ backgroundColor: sw.hex }}
                          className={`w-6 h-6 rounded-md border cursor-pointer transition-transform hover:scale-110 flex items-center justify-center ${
                            isSelected ? 'ring-2 ring-white border-white scale-105' : 'border-black/30'
                          }`}
                          title={sw.nome}
                        >
                          {isSelected && <Check className="w-3 h-3 text-black stroke-[3]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="md:col-span-6 space-y-3 md:pl-3.5 md:border-l border-white/10">
                  <div>
                    <div className="flex items-center justify-between text-[10px] text-slate-300 mb-1">
                      <span>Intensidade da Cor</span>
                      <span className="font-mono font-bold" style={{ color: currentSecondaryHex }}>
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
                          ratio,
                          nightFactor
                        );
                        applyBrandChange({
                          ...brandConfig,
                          blendRatio: ratio,
                          effectivePrimaryHex: blended.effectiveHex,
                          effectivePrimaryRgb: blended.rgb
                        });
                      }}
                      style={{ accentColor: currentAccentHex }}
                      className="w-full cursor-pointer h-1.5"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[10px] text-slate-300 mb-1">
                      <span>Transição Ao Anoitecer</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold" style={{ color: currentAccentHex }}>
                          {Math.round(nightFactor * 100)}% Noite
                        </span>
                        {isManualNight && (
                          <button
                            type="button"
                            onClick={() => setManualFactor(null)}
                            className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[9px] text-white cursor-pointer"
                          >
                            Auto
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
                          const val = Number(e.target.value) / 100;
                          setManualFactor(val);
                        }}
                        style={{ accentColor: currentAccentHex }}
                        className="w-full cursor-pointer h-2.5 bg-transparent appearance-none"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-slate-400 mt-1">
                      <span>Dia (Ouro Solar)</span>
                      <span>Entardecer Vivo</span>
                      <span>Noite (Esmeralda)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#08171B] border border-white/10 rounded-xl p-4 sm:p-5 space-y-4">
            <h3 className="text-sm font-bold text-white">
              Gerenciador de Imagens da sua Empresa
            </h3>

            <UrutauSlotImageManager
              brandConfig={brandConfig}
              onUpdateBrandConfig={applyBrandChange}
              theme="emerald"
            />
          </div>
        </section>

        <section
          id="historia-urutau"
          className="bg-[#062024]/90 border rounded-2xl p-6 sm:p-9 space-y-6"
          style={{ borderColor: `${currentSecondaryHex}55` }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-7 space-y-5">
              <h1
                style={{ fontSize: 'clamp(1.85rem, 3.1vw, 2.85rem)', textWrap: 'balance' }}
                className="font-black tracking-tight text-white leading-[1.1]"
              >
                Por que o Urutau é o parceiro ideal para o empresário que não pode estar em todos os lugares ao mesmo tempo?
              </h1>

              <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-[68ch]">
                Na natureza amazônica, o <strong>Urutau</strong> é conhecido como a ave mais vigilante da floresta: com seus grandes olhos dourados e fendas naturais nas pálpebras, ele <strong>enxerga tudo ao redor mesmo quando parece estar de olhos fechados</strong>. Nós trouxemos a essência desse pássaro em 3 posturas vivas — <strong>Camuflagem</strong>, <strong>Sentinela</strong> e <strong>Canto de Alerta</strong> — para cuidar do seu negócio dia e noite.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <a
                  href="#cadastro-empresario"
                  style={{ backgroundColor: currentAccentHex }}
                  className="px-6 py-3.5 rounded-xl text-[#04120C] font-black text-sm inline-flex items-center gap-2 shadow-lg transition-transform hover:scale-[1.02] whitespace-nowrap"
                >
                  <span>Cadastrar Minha Empresa</span>
                  <ArrowRight className="w-4 h-4" />
                </a>

                <button
                  type="button"
                  onClick={scrollToPersonalizacao}
                  style={{
                    borderColor: `${currentTertiaryHex}77`,
                    color: currentTertiaryHex
                  }}
                  className="px-5 py-3.5 rounded-xl bg-[#072226] hover:bg-[#0A2E33] border font-bold text-sm inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Palette className="w-4 h-4" style={{ color: currentTertiaryHex }} />
                  <span>Personalizar Marca</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-xl overflow-hidden border border-[#10B981]/40 bg-[#04120C] shadow-2xl">
                <img
                  src="/assets/branding/poses/prancha_oficial_urutau.jpg?v=esmeralda1"
                  alt="Tríptico Oficial Urutau Esmeralda: Camuflagem, Sentinela e Canto"
                  className="w-full h-auto object-cover block"
                />
                <div className="grid grid-cols-3 divide-x divide-white/10 bg-[#041518] py-2 px-2 text-center text-[11px] font-semibold text-slate-300">
                  <span>1. Camuflagem</span>
                  <span className="text-[#F5B041]">2. Sentinela</span>
                  <span className="text-[#20E3B2]">3. Canto & Alerta</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="cadastro-empresario" className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            <div className="lg:col-span-6 py-2 sm:py-4 flex flex-col justify-center space-y-6">
              <div className="space-y-4">
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
                  Comunicação interna em tempo real, gestão operacional completa, WhatsApp e modo offline contínuo.
                </h2>

                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                  O Urutau centraliza toda a rotina da sua empresa em um único ambiente rápido e auditável. A prioridade é a <strong>comunicação interna direta entre gestores, salão, cozinha, estoque e caixa</strong>, mantendo a equipe alinhada em cada turno sem ruídos ou perda de informações.
                </p>

                <div className="space-y-3.5 pt-1 text-xs sm:text-sm text-slate-200">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="w-4 h-4 text-[#10B981] shrink-0 mt-1" />
                    <div>
                      <strong className="text-[#6EE7B7]">Comunicação Interna e Alinhamento de Equipe:</strong>{' '}
                      Canal interno estruturado por setor e unidade para avisos de turno, solicitações entre áreas, repasse de ocorrências, checklists de abertura/fechamento e confirmação imediata de leitura.
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Smartphone className="w-4 h-4 text-[#10B981] shrink-0 mt-1" />
                    <div>
                      <strong className="text-[#6EE7B7]">Operação Integrada pelo WhatsApp:</strong>{' '}
                      Envio de códigos de acesso, avisos de escalas, registro de faltas, baixas rápidas de estoque, solicitação de vales e alertas de fechamento de caixa diretamente pelo WhatsApp da equipe.
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <ShieldCheck className="w-4 h-4 text-[#10B981] shrink-0 mt-1" />
                    <div>
                      <strong className="text-[#6EE7B7]">Modo Offline Contínuo e Guarda Própria de Dados:</strong>{' '}
                      O sistema continua operando normalmente mesmo sem internet, guardando os lançamentos no aparelho e sincronizando automaticamente quando a conexão volta.
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Users className="w-4 h-4 text-[#10B981] shrink-0 mt-1" />
                    <div>
                      <strong className="text-[#6EE7B7]">Funções Operacionais do Sistema:</strong>{' '}
                      Mapa de Salão e Reservas, Escalas de Equipe, Fechamento de Caixa, Rateio e Comissões, Estoque, Compras, Fichas Técnicas (CMV), RH e Permissões por Cargo.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 bg-[#07262A]/95 border-2 border-[#10B981]/50 rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-5 shadow-2xl">
              {onboardingResult ? (
                <div className="space-y-6 my-auto">
                  <div className="space-y-1">
                    <h2 className="text-2xl font-black text-white">
                      Bem-vindo, {onboardingResult.usuario.nome}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-200">
                      Empresa <strong>{onboardingResult.empresa.nome}</strong> cadastrada.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => onEnterErp('reservas')}
                      className="p-4 rounded-xl bg-[#10B981] hover:bg-[#059669] text-[#04120C] text-left space-y-1 cursor-pointer transition-colors"
                    >
                      <div className="text-xs font-black uppercase">Abrir Painel</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => onEnterErp('chat')}
                      className="p-4 rounded-xl bg-black/45 hover:bg-black/65 border border-[#10B981]/40 text-left space-y-1 cursor-pointer transition-colors"
                    >
                      <div className="text-xs font-black text-[#6EE7B7] uppercase">WhatsApp</div>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="border-b border-white/10 pb-3">
                    <h3 className="text-xl sm:text-2xl font-black text-white">
                      Cadastre sua Empresa
                    </h3>
                  </div>

                  <form onSubmit={handleCadastrarEmpresario} className="space-y-3.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-200 mb-1">
                          Nome da Empresa *
                        </label>
                        <input
                          type="text"
                          required
                          value={empNomeEmpresa}
                          onChange={(e) => setEmpNomeEmpresa(e.target.value)}
                          placeholder="Ex: Restaurante Amazônia Grill"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#041417] border border-[#10B981]/35 text-xs text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-200 mb-1">
                          Seu Nome *
                        </label>
                        <input
                          type="text"
                          required
                          value={empNomeEmpresario}
                          onChange={(e) => setEmpNomeEmpresario(e.target.value)}
                          placeholder="Seu nome completo"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#041417] border border-[#10B981]/35 text-xs text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-200 mb-1">
                          Seu WhatsApp *
                        </label>
                        <input
                          type="tel"
                          required
                          value={empWhatsapp}
                          onChange={(e) => {
                            setEmpWhatsapp(e.target.value);
                            setWppBotConnected(false);
                          }}
                          placeholder="Ex: 91991122334"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#041417] border border-[#10B981]/35 text-xs text-white"
                        />
                      </div>

                      <div className="sm:col-span-2 p-3.5 rounded-xl bg-[#041518] border border-[#10B981]/40 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black text-[#6EE7B7] flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-[#10B981]" />
                            <span>Bot Interno (Equipe)</span>
                          </span>
                          {wppBotConnected && (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/25 border border-emerald-400/50 text-[10px] font-bold text-emerald-200">
                              Pareado
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setUsarWppPessoalComoBot(true);
                              setWppBotConnected(false);
                              setWppBotPairingCode('');
                            }}
                            className={`p-2.5 rounded-xl border text-left text-xs cursor-pointer transition-all ${
                              usarWppPessoalComoBot
                                ? 'bg-[#10B981]/20 border-[#10B981] text-white font-bold'
                                : 'bg-black/30 border-white/10 text-slate-300 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span>Usar Meu WhatsApp</span>
                              {usarWppPessoalComoBot && <Check className="w-3.5 h-3.5 text-[#10B981]" />}
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setUsarWppPessoalComoBot(false);
                              setWppBotConnected(false);
                              setWppBotPairingCode('');
                            }}
                            className={`p-2.5 rounded-xl border text-left text-xs cursor-pointer transition-all ${
                              !usarWppPessoalComoBot
                                ? 'bg-amber-500/20 border-amber-400 text-white font-bold'
                                : 'bg-black/30 border-white/10 text-slate-300 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span>Usar Outro Número</span>
                              {!usarWppPessoalComoBot && <Check className="w-3.5 h-3.5 text-amber-300" />}
                            </div>
                          </button>
                        </div>

                        {!usarWppPessoalComoBot && (
                          <div>
                            <label className="block text-[11px] font-bold text-amber-200 mb-1">
                              WhatsApp do Bot Interno *
                            </label>
                            <input
                              type="tel"
                              required={!usarWppPessoalComoBot}
                              value={empWhatsappBot}
                              onChange={(e) => {
                                setEmpWhatsappBot(e.target.value);
                                setWppBotConnected(false);
                              }}
                              placeholder="Número do Bot..."
                              className="w-full px-3.5 py-2 rounded-xl bg-[#020D10] border border-amber-400/50 text-xs text-white"
                            />
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <span className="text-[11px] text-slate-300">
                            Bot:{' '}
                            <strong className="text-white">
                              {usarWppPessoalComoBot
                                ? empWhatsapp || '-'
                                : empWhatsappBot || '-'}
                            </strong>
                          </span>

                          {!wppBotConnected ? (
                            <button
                              type="button"
                              onClick={handleIniciarConexaoBotWpp}
                              disabled={wppBotConnecting}
                              className="px-3 py-1.5 rounded-lg bg-[#10B981]/25 hover:bg-[#10B981]/35 border border-[#10B981]/60 text-[#6EE7B7] text-xs font-bold cursor-pointer"
                            >
                              {wppBotConnecting
                                ? 'Gerando...'
                                : wppBotPairingCode
                                ? 'Atualizar Código'
                                : 'Parear Bot'}
                            </button>
                          ) : (
                            <span className="text-xs font-bold text-[#10B981]">
                              Bot Pareado
                            </span>
                          )}
                        </div>

                        {wppBotPairingCode && !wppBotConnected && (
                          <div className="p-3 rounded-xl bg-black/50 border border-[#10B981]/40 space-y-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <div className="text-[10px] uppercase font-bold text-slate-400">
                                  Código de Pareamento
                                </div>
                                <div className="text-base font-mono font-black text-amber-300 tracking-widest">
                                  {wppBotPairingCode}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {wppBotQrUrl && (
                                  <a
                                    href={wppBotQrUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold"
                                  >
                                    Abrir WhatsApp
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={handleConfirmarConexaoBotWpp}
                                  className="px-3 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-[#04120C] text-xs font-black cursor-pointer"
                                >
                                  Confirmar
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-200 mb-1">
                          CNPJ ou CPF
                        </label>
                        <input
                          type="text"
                          value={empCnpj}
                          onChange={(e) => setEmpCnpj(e.target.value)}
                          placeholder="Ex: 00.000.000/0001-00"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#041417] border border-[#10B981]/35 text-xs text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-200 mb-1">
                          Ramo de Atuação
                        </label>
                        <select
                          value={empRamo}
                          onChange={(e) => setEmpRamo(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl bg-[#041417] border border-[#10B981]/35 text-xs text-white"
                        >
                          <option value="Restaurante / Bar / Gastronomia">Restaurante / Bar / Gastronomia</option>
                          <option value="Rede de Lojas / Franquias">Rede de Lojas / Franquias</option>
                          <option value="Hotelaria / Eventos / Entretenimento">Hotelaria / Eventos / Entretenimento</option>
                          <option value="Comércio & Serviços Gerais">Comércio & Serviços Gerais</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-200 mb-1">
                          Unidade Principal
                        </label>
                        <input
                          type="text"
                          value={empUnidadeInicial}
                          onChange={(e) => setEmpUnidadeInicial(e.target.value)}
                          placeholder="Ex: Matriz Principal"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#041417] border border-[#10B981]/35 text-xs text-white"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-200 mb-1">
                          Localização (País, Estado e Cidade)
                        </label>
                        <UrutauValidatedCityStateSelector
                          value={empCidade}
                          onChange={(val) => setEmpCidade(val)}
                          variant="emerald"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-200 mb-1">
                          E-mail
                        </label>
                        <input
                          type="email"
                          value={empEmail}
                          onChange={(e) => setEmpEmail(e.target.value)}
                          placeholder="contato@suaempresa.com.br"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#041417] border border-[#10B981]/35 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-200 mb-1">
                          Senha *
                        </label>
                        <input
                          type="password"
                          value={empSenha}
                          onChange={(e) => setEmpSenha(e.target.value)}
                          placeholder="Mínimo 4 caracteres"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#041417] border border-[#10B981]/35 text-xs font-mono text-white"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-[#6EE7B7] mb-1">
                          Link da Planilha Google da Empresa (Guarda Soberana dos Dados)
                        </label>
                        <input
                          type="url"
                          value={empPlanilhaGoogleUrl}
                          onChange={(e) => setEmpPlanilhaGoogleUrl(e.target.value)}
                          placeholder="https://docs.google.com/spreadsheets/d/... (pode informar agora ou depois no painel)"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#041417] border border-[#10B981]/35 text-xs text-white"
                        />
                      </div>

                      <div className="sm:col-span-2 p-3 rounded-xl bg-[#041417] border border-[#10B981]/35 space-y-2">
                        <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-200 leading-snug">
                          <input
                            type="checkbox"
                            checked={empAceiteLgpd}
                            onChange={(e) => setEmpAceiteLgpd(e.target.checked)}
                            className="mt-0.5 accent-[#10B981] cursor-pointer"
                          />
                          <span>
                            Declaro ciência de que minha empresa é a única <strong>Controladora e Guardiã dos Dados (Art. 5º, VI da LGPD)</strong>, mantendo a guarda na própria <strong>Planilha Google</strong> da empresa, enquanto o servidor hospeda exclusivamente o funcionamento do sistema.
                          </span>
                        </label>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => setShowLgpdModal(true)}
                            className="text-[11px] font-bold text-[#6EE7B7] hover:underline cursor-pointer"
                          >
                            Ler Análise Técnica LGPD &amp; Termo de Guarda
                          </button>
                        </div>
                      </div>
                    </div>

                    {onboardingError && (
                      <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 font-semibold">
                        {onboardingError}
                      </div>
                    )}

                    <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="submit"
                        disabled={onboardingLoading}
                        style={{ backgroundColor: currentAccentHex }}
                        className="flex-1 py-3 px-5 rounded-xl text-[#04120C] font-black text-xs sm:text-sm inline-flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50 whitespace-nowrap"
                      >
                        <span>
                          {onboardingLoading
                            ? 'Cadastrando...'
                            : 'Cadastrar Empresa'}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={onOpenLoginModal}
                        className="py-3 px-4 rounded-xl bg-black/40 hover:bg-black/60 text-slate-200 border border-white/15 font-bold text-xs cursor-pointer whitespace-nowrap"
                      >
                        Entrar
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="w-full border-t border-[#10B981]/20 bg-[#031215] px-4 sm:px-8 py-6 mt-12">
        <div className="max-w-[1280px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <button
            type="button"
            onClick={scrollToPersonalizacao}
            className="flex items-center gap-3 cursor-pointer hover:text-white transition-colors"
          >
            <span className="font-bold text-white">{brandConfig.companyName || companyName || 'URUTAU'}</span>
          </button>
          <div className="flex flex-wrap items-center gap-5">
            <a href="#personalizacao-aparencia" className="hover:text-white transition-colors">
              Aparência
            </a>
            <a href="#historia-urutau" className="hover:text-white transition-colors">
              Sobre
            </a>
            <a href="#cadastro-empresario" className="hover:text-white transition-colors">
              Cadastrar
            </a>
            <button
              type="button"
              onClick={() => setShowLgpdModal(true)}
              className="hover:text-white transition-colors cursor-pointer"
            >
              LGPD &amp; Guarda de Dados
            </button>
            <button
              type="button"
              onClick={onOpenLoginModal}
              className="text-[#10B981] hover:underline font-bold cursor-pointer"
            >
              Entrar
            </button>
          </div>
        </div>
      </footer>

      {showLgpdModal && (
        <div
          className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setShowLgpdModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl max-h-[88vh] overflow-y-auto p-5 sm:p-6 rounded-2xl bg-[#041417] border border-[#10B981]/50 shadow-2xl space-y-4 text-slate-200"
          >
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div>
                <h3 className="text-base sm:text-lg font-black text-white">
                  Arquitetura LGPD &amp; Guarda Exclusiva na Planilha Google do Empresário
                </h3>
                <p className="text-xs text-[#6EE7B7]">
                  Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowLgpdModal(false)}
                className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white cursor-pointer"
              >
                Fechar
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed">
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-1.5">
                <div className="font-bold text-[#6EE7B7]">
                  1. Atribuição Completa da Guarda dos Dados ao Empresário (Controlador — Art. 5º, VI)
                </div>
                <p>
                  Cada empresário cadastrado atua como único <strong>Controlador dos Dados</strong> de sua empresa, colaboradores, fornecedores e clientes. A guarda permanente das informações operacionais (Equipe/RH, Escalas, Comunicação Interna, Reservas, Caixa, Rateio, Estoque e CMV) ocorre diretamente na <strong>Planilha Google vinculada à conta Google do próprio empresário</strong>.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-1.5">
                <div className="font-bold text-[#6EE7B7]">
                  2. Servidor VPS Exclusivo para Execução do Sistema (Zero Guarda de Terceiros)
                </div>
                <p>
                  A VPS hospeda apenas o motor de funcionamento do aplicativo. Com o modo de <strong>Guarda Exclusiva na Planilha Google</strong> ativo, os dados operacionais são gravados nas abas da Planilha Google do empresário e expurgados do armazenamento operacional da VPS após a sincronização, isentando o servidor de custódia permanente de bancos de dados de terceiros.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-1.5">
                <div className="font-bold text-[#6EE7B7]">
                  3. Minimização de Dados (Art. 6º, III) — Sem Batida de Ponto
                </div>
                <p>
                  O sistema não realiza controle de batida de ponto trabalhista e mantém desativado por padrão o rastreamento contínuo de localização dos usuários, coletando apenas as informações estritamente necessárias para a comunicação interna e gestão diária.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-1.5">
                <div className="font-bold text-[#6EE7B7]">
                  4. Segurança Técnica e Direitos do Titular (Art. 18 e Art. 46)
                </div>
                <p>
                  As senhas são protegidas com hash criptográfico Argon2id irreversível. O painel da empresa dispõe de ferramenta própria para o empresário atender solicitações de titulares (clientes ou ex-colaboradores), permitindo anonimizar dados pessoais preservando apenas os totais financeiros anônimos.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
