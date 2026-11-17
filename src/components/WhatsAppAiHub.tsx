import React, { useEffect, useMemo, useState } from 'react';
import {
  MessageSquare,
  Send,
  QrCode,
  CheckCircle2,
  RefreshCw,
  Phone,
  Users,
  Bell,
  ShieldCheck,
  Globe,
  Lock,
  ExternalLink,
  Power,
  Check,
  AlertCircle,
  Calendar,
  Package,
  Wallet,
  MapPin,
  Plus,
  X,
  Copy
} from 'lucide-react';
import { CommonTabProps } from './OperationalTabsPart1';
import { Empresa } from '../types/erp';
import { isSuperAdminUser } from './UrutauShared';

export function WhatsAppAiHub({
  data,
  onRefresh,
  showAlert,
  currentUser
}: CommonTabProps) {
  const [activeArea, setActiveArea] = useState<'web_whatsapp_comercial' | 'conexao_bot_interno'>(
    'web_whatsapp_comercial'
  );

  const [empresaSelecionadaId, setEmpresaSelecionadaId] = useState<number>(
    data.empresaAtivaId || data.empresas[0]?.id || 1
  );

  useEffect(() => {
    if (data.empresaAtivaId) {
      setEmpresaSelecionadaId(data.empresaAtivaId);
    } else if (data.empresas.length > 0 && !data.empresas.some((e) => Number(e.id) === Number(empresaSelecionadaId))) {
      setEmpresaSelecionadaId(data.empresas[0].id);
    }
  }, [data.empresaAtivaId, data.empresas, empresaSelecionadaId]);

  const empresaAtiva: Empresa | undefined = useMemo(() => {
    return (
      data.empresas.find((e) => Number(e.id) === Number(empresaSelecionadaId)) ||
      data.empresas[0]
    );
  }, [data.empresas, empresaSelecionadaId]);

  const isWebWppComercialConectado = empresaAtiva?.waha_status === 'Conectado';
  const isBotInternoConectado = empresaAtiva?.bot_interno_status === 'Conectado';

  const [qrTokenSeed, setQrTokenSeed] = useState<string>(() =>
    `2@${Math.random().toString(36).substring(2, 12).toUpperCase()}_${Date.now().toString(36).toUpperCase()}`
  );
  const [wppComercialInput, setWppComercialInput] = useState<string>(
    empresaAtiva?.wpp_comercial_numero || ''
  );
  const [loadingWebWpp, setLoadingWebWpp] = useState<boolean>(false);

  const [contatoSelecionado, setContatoSelecionado] = useState<string>('');
  const [novoContatoNumero, setNovoContatoNumero] = useState<string>('');
  const [novoContatoNome, setNovoContatoNome] = useState<string>('');
  const [showNovoContatoForm, setShowNovoContatoForm] = useState<boolean>(false);
  const [textoEnvio, setTextoEnvio] = useState<string>('');
  const [enviandoMsg, setEnviandoMsg] = useState<boolean>(false);

  const [usarWppPessoalComoBot, setUsarWppPessoalComoBot] = useState<boolean>(
    empresaAtiva?.usar_wpp_pessoal_como_bot !== false
  );
  const [wppPessoalTitularInput, setWppPessoalTitularInput] = useState<string>(
    empresaAtiva?.whatsapp_pessoal_titular || ''
  );
  const [botInternoNumeroInput, setBotInternoNumeroInput] = useState<string>(
    empresaAtiva?.bot_interno_numero || empresaAtiva?.waha_numero || ''
  );
  const [alertasEquipe, setAlertasEquipe] = useState<{
    escalas: boolean;
    estoque: boolean;
    fechamento_caixa: boolean;
    ponto_gps: boolean;
  }>({
    escalas: empresaAtiva?.alertas_equipe_config?.escalas !== false,
    estoque: empresaAtiva?.alertas_equipe_config?.estoque !== false,
    fechamento_caixa: empresaAtiva?.alertas_equipe_config?.fechamento_caixa !== false,
    ponto_gps: empresaAtiva?.alertas_equipe_config?.ponto_gps !== false
  });
  const [botPairingCode, setBotPairingCode] = useState<string>('');
  const [botQrUrl, setBotQrUrl] = useState<string>('');
  const [botQrImageUrl, setBotQrImageUrl] = useState<string>('');
  const [loadingBotAction, setLoadingBotAction] = useState<boolean>(false);

  const colaboradoresEquipes = useMemo(() => {
    return (data.usuarios || []).filter((u: any) => {
      if (u.arquivado_legal) return false;
      if (!isSuperAdminUser(currentUser) && isSuperAdminUser(u)) return false;
      if (empresaAtiva?.id) {
        const empIds = Array.isArray(u.empresas_ids) ? u.empresas_ids.map(Number) : [1];
        if (!isSuperAdminUser(currentUser) && !empIds.includes(Number(empresaAtiva.id))) return false;
      }
      return true;
    });
  }, [data.usuarios, currentUser, empresaAtiva]);

  const [simuladorColaboradorId, setSimuladorColaboradorId] = useState<number>(
    () => (data.usuarios && data.usuarios[0]?.id) || 1
  );
  const [simuladorTexto, setSimuladorTexto] = useState<string>('');
  const [simuladorEnviando, setSimuladorEnviando] = useState<boolean>(false);
  const [simuladorHistorico, setSimuladorHistorico] = useState<
    Array<{
      id: string;
      autor: string;
      cargo?: string;
      direcao: 'colaborador' | 'bot' | 'bloqueio';
      texto: string;
      horario: string;
      ferramentas?: string[];
    }>
  >([]);

  const colaboradorSimuladoObj = useMemo(() => {
    return (
      colaboradoresEquipes.find((u: any) => Number(u.id) === Number(simuladorColaboradorId)) ||
      colaboradoresEquipes[0] || {
        id: 1,
        nome: 'Admin Master',
        cargo: 'Diretor Operacional',
        tipo: 'Super Admin',
        telefone: '5591999990001'
      }
    );
  }, [colaboradoresEquipes, simuladorColaboradorId]);

  const alcadasColaboradorSimulado = useMemo(() => {
    const cargoStr = String(colaboradorSimuladoObj?.cargo || '').toLowerCase();
    const tipoStr = String(colaboradorSimuladoObj?.tipo || '').toLowerCase();
    const isGestorOuAdmin =
      tipoStr.includes('admin') ||
      tipoStr.includes('diretor') ||
      tipoStr.includes('gestor') ||
      tipoStr.includes('empres') ||
      cargoStr.includes('gerente') ||
      cargoStr.includes('diretor') ||
      cargoStr.includes('gestor');
    const podeCaixa =
      isGestorOuAdmin ||
      cargoStr.includes('caixa') ||
      cargoStr.includes('financeiro') ||
      cargoStr.includes('atendente');
    const podeFreelancer =
      isGestorOuAdmin ||
      cargoStr.includes('rh') ||
      cargoStr.includes('supervisor') ||
      cargoStr.includes('chefe');
    const podeGestaoEscalaRH =
      isGestorOuAdmin ||
      cargoStr.includes('gerente') ||
      cargoStr.includes('gestor') ||
      cargoStr.includes('supervisor') ||
      cargoStr.includes('chefe') ||
      cargoStr.includes('rh');
    return {
      podeCaixa,
      podeFreelancer,
      podeGestaoEscalaRH,
      podeTurnoChecklist: true
    };
  }, [colaboradorSimuladoObj]);

  useEffect(() => {
    if (!empresaAtiva) return;
    setWppComercialInput(empresaAtiva.wpp_comercial_numero || '');
    setUsarWppPessoalComoBot(empresaAtiva.usar_wpp_pessoal_como_bot !== false);
    setWppPessoalTitularInput(empresaAtiva.whatsapp_pessoal_titular || '');
    setBotInternoNumeroInput(
      empresaAtiva.bot_interno_numero || empresaAtiva.waha_numero || ''
    );
    setAlertasEquipe({
      escalas: empresaAtiva.alertas_equipe_config?.escalas !== false,
      estoque: empresaAtiva.alertas_equipe_config?.estoque !== false,
      fechamento_caixa: empresaAtiva.alertas_equipe_config?.fechamento_caixa !== false,
      ponto_gps: empresaAtiva.alertas_equipe_config?.ponto_gps !== false
    });
  }, [empresaAtiva]);

  useEffect(() => {
    if (!botPairingCode && !botQrImageUrl) return;
    if (isBotInternoConectado) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/v50/whatsapp/status');
        const json = await res.json();
        if (json?.state?.status === 'conectado') {
          setBotPairingCode('');
          setBotQrImageUrl('');
          await onRefresh();
          showAlert(
            'WhatsApp Conectado com Sucesso',
            'Seu aparelho WhatsApp foi conectado ao Urutau com sucesso.'
          );
        } else if (json?.state?.qrCodeDataUrl && json.state.qrCodeDataUrl !== botQrImageUrl) {
          setBotQrImageUrl(json.state.qrCodeDataUrl);
        }
      } catch {}
    }, 2500);

    return () => clearInterval(interval);
  }, [botPairingCode, botQrImageUrl, isBotInternoConectado, onRefresh, showAlert]);

  const mensagensReaisEmpresa = useMemo(() => {
    if (!isWebWppComercialConectado) return [];
    return (data.mensagensChat || []).filter((m: any) => m.real_verified === true || m.direcao === 'enviada');
  }, [data.mensagensChat, isWebWppComercialConectado]);

  const conversasAgrupadas = useMemo(() => {
    if (!isWebWppComercialConectado) return [];
    const map = new Map<
      string,
      {
        contato: string;
        nome: string;
        ultimaMensagem: string;
        horario: string;
        mensagens: any[];
      }
    >();

    for (const msg of mensagensReaisEmpresa) {
      const num = String(msg.contato || '5591999990000').replace(/\D/g, '');
      const existente = map.get(num);
      const list = existente ? [...existente.mensagens, msg] : [msg];
      map.set(num, {
        contato: num,
        nome: msg.remetente || `Cliente ${num.slice(-4)}`,
        ultimaMensagem: msg.texto || '',
        horario: msg.horario || '',
        mensagens: list
      });
    }
    return Array.from(map.values());
  }, [mensagensReaisEmpresa, isWebWppComercialConectado]);

  const conversaAtiva = useMemo(() => {
    if (!conversasAgrupadas.length) return null;
    return (
      conversasAgrupadas.find((c) => c.contato === contatoSelecionado) ||
      conversasAgrupadas[0]
    );
  }, [conversasAgrupadas, contatoSelecionado]);

  const handleGerarNovoQrWebWpp = () => {
    setQrTokenSeed(
      `2@${Math.random().toString(36).substring(2, 12).toUpperCase()}_${Date.now().toString(36).toUpperCase()}`
    );
  };

  const handleConectarOuDesconectarWebWhatsApp = async (conectar: boolean) => {
    if (!empresaAtiva) return;
    if (conectar && wppComercialInput.replace(/\D/g, '').length < 8) {
      showAlert(
        'Informe o Número do WhatsApp Comercial',
        'Digite o número do aparelho comercial que está lendo o QR Code do Web WhatsApp para identificar a sessão.'
      );
      return;
    }

    setLoadingWebWpp(true);
    try {
      const res = await fetch('/api/v50/empresas/conectar-waha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: empresaAtiva.id,
          status: conectar ? 'Conectado' : 'Desconectado',
          wpp_comercial_numero: wppComercialInput
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || 'Falha ao atualizar sessão Web WhatsApp');
      await onRefresh();
      showAlert(
        conectar
          ? 'Web WhatsApp Comercial Conectado no Navegador Interno'
          : 'Sessão Web WhatsApp Encerrada',
        conectar
          ? `O navegador interno do Web WhatsApp foi vinculado ao número comercial ${json.wpp_comercial_numero || wppComercialInput}.`
          : 'O WhatsApp Comercial foi desconectado e marcado como inativo.'
      );
    } catch (e: any) {
      showAlert('Erro na Conexão Web WhatsApp', e.message);
    } finally {
      setLoadingWebWpp(false);
    }
  };

  const handleIniciarNovaConversaComercial = (e: React.FormEvent) => {
    e.preventDefault();
    const limpo = novoContatoNumero.replace(/\D/g, '');
    if (limpo.length < 8) return;
    setContatoSelecionado(limpo);
    setShowNovoContatoForm(false);
  };

  const handleEnviarMensagemComercial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isWebWppComercialConectado) {
      showAlert(
        'WhatsApp Comercial Desconectado',
        'Leia o QR Code no Navegador Interno do Web WhatsApp antes de enviar mensagens para clientes.'
      );
      return;
    }
    const numDestino = conversaAtiva?.contato || novoContatoNumero.replace(/\D/g, '');
    const nomeDestino = conversaAtiva?.nome || novoContatoNome.trim() || `Cliente ${numDestino.slice(-4)}`;
    if (!textoEnvio.trim() || !numDestino) return;

    setEnviandoMsg(true);
    try {
      const res = await fetch('/api/v20/chat/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instancia_id: empresaAtiva?.id || 1,
          destinatario: nomeDestino,
          contato: numDestino,
          texto: textoEnvio.trim()
        })
      });
      if (!res.ok) throw new Error('Falha ao enviar mensagem');
      setTextoEnvio('');
      setNovoContatoNumero('');
      setNovoContatoNome('');
      await onRefresh();
    } catch (e: any) {
      showAlert('Erro no Envio', e.message);
    } finally {
      setEnviandoMsg(false);
    }
  };

  const handleGerarPareamentoBotInterno = async () => {
    const numAlvo = usarWppPessoalComoBot
      ? wppPessoalTitularInput || botInternoNumeroInput
      : botInternoNumeroInput;

    if (!numAlvo || numAlvo.replace(/\D/g, '').length < 8) {
      showAlert(
        'Número do Bot Interno Obrigatório',
        'Informe o número de WhatsApp que será utilizado pelo Bot Interno para falar com a equipe.'
      );
      return;
    }

    setLoadingBotAction(true);
    try {
      const res = await fetch('/api/erp/wpp-bot/iniciar-conexao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero_bot: botInternoNumeroInput,
          whatsapp_pessoal: wppPessoalTitularInput,
          usar_wpp_pessoal_como_bot: usarWppPessoalComoBot,
          nome_empresa: empresaAtiva?.nome || 'Empresa'
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || 'Erro ao gerar pareamento do Bot Interno');
      setBotPairingCode(json.codigo_pareamento || '8K3M-P9V2');
      setBotQrUrl(json.qr_payload || '');
      setBotQrImageUrl(
        json.qr_image_url ||
          `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(
            json.qr_payload || `https://wa.me/${json.numero_resolvido || '5591999990001'}`
          )}`
      );
      if (json.numero_resolvido) {
        setBotInternoNumeroInput(json.numero_resolvido);
      }
    } catch (e: any) {
      showAlert('Erro no Pareamento do Bot Interno', e.message);
    } finally {
      setLoadingBotAction(false);
    }
  };

  const handleConfirmarPareamentoDireto = async () => {
    if (!empresaAtiva) return;
    setLoadingBotAction(true);
    try {
      const res = await fetch('/api/erp/wpp-bot/confirmar-conexao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: empresaAtiva.id,
          numero_bot: botInternoNumeroInput,
          whatsapp_pessoal: wppPessoalTitularInput,
          usar_wpp_pessoal_como_bot: usarWppPessoalComoBot,
          codigo_pareamento: botPairingCode
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || 'Falha ao confirmar conexão');
      setBotPairingCode('');
      setBotQrImageUrl('');
      await onRefresh();
      showAlert(
        'Bot Interno Conectado com Sucesso',
        `O Bot Interno da empresa ${empresaAtiva.nome} foi autenticado e ativado. A equipe e os gestores já podem interagir via WhatsApp.`
      );
    } catch (e: any) {
      showAlert('Erro ao Confirmar Conexão', e.message);
    } finally {
      setLoadingBotAction(false);
    }
  };

  const handleSalvarConfigBotInterno = async (
    novoStatus?: 'Conectado' | 'Desconectado',
    dispararTeste: boolean = false
  ) => {
    if (!empresaAtiva) return;
    const numeroFinal = usarWppPessoalComoBot
      ? wppPessoalTitularInput || botInternoNumeroInput
      : botInternoNumeroInput;

    if (novoStatus === 'Conectado' && String(numeroFinal || '').replace(/\D/g, '').length < 8) {
      showAlert(
        'Informe o Número do Bot Interno',
        'Digite um número válido para ativar o Bot Interno da equipe.'
      );
      return;
    }

    setLoadingBotAction(true);
    try {
      const res = await fetch('/api/erp/bot-interno/salvar-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: empresaAtiva.id,
          bot_interno_numero: numeroFinal,
          whatsapp_pessoal_titular: wppPessoalTitularInput,
          usar_wpp_pessoal_como_bot: usarWppPessoalComoBot,
          bot_interno_status: novoStatus || empresaAtiva.bot_interno_status || 'Desconectado',
          alertas_equipe_config: alertasEquipe,
          disparar_teste_equipe: dispararTeste
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || 'Erro ao salvar configuração do Bot Interno');
      setBotPairingCode('');
      await onRefresh();
      showAlert(
        dispararTeste
          ? 'Aviso de Teste Enviado à Equipe Interna'
          : novoStatus === 'Conectado'
          ? 'Bot Interno da Equipe Conectado!'
          : novoStatus === 'Desconectado'
          ? 'Bot Interno Desconectado'
          : 'Configuração do Bot Interno Salva',
        dispararTeste
          ? `O Bot Interno (${numeroFinal}) disparou um comunicado de teste exclusivo para a equipe interna e empresário.`
          : `As configurações de comunicação interna do Bot Urutau foram atualizadas para a empresa ${empresaAtiva.nome}.`
      );
    } catch (e: any) {
      showAlert('Erro ao Salvar Bot Interno', e.message);
    } finally {
      setLoadingBotAction(false);
    }
  };

  const handleEnviarMensagemSimuladorBot = async (textoCustom?: string) => {
    const msg = (textoCustom !== undefined ? textoCustom : simuladorTexto).trim();
    if (!msg || simuladorEnviando) return;

    const horario = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
    const telefoneRemetente =
      String(colaboradorSimuladoObj?.telefone || '').replace(/\D/g, '') ||
      `55919999900${String(colaboradorSimuladoObj?.id || 1).padStart(2, '0')}`;

    setSimuladorHistorico((prev) => [
      ...prev,
      {
        id: `usr_${Date.now()}`,
        autor: colaboradorSimuladoObj?.nome || 'Colaborador',
        cargo: colaboradorSimuladoObj?.cargo || 'Operacional',
        direcao: 'colaborador',
        texto: msg,
        horario
      }
    ]);
    if (textoCustom === undefined) {
      setSimuladorTexto('');
    }
    setSimuladorEnviando(true);

    try {
      const res = await fetch('/api/v50/chat/ia-interagir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefone: telefoneRemetente,
          remetente: colaboradorSimuladoObj?.nome || 'Colaborador',
          usuario_id: colaboradorSimuladoObj?.id,
          empresa_id: empresaAtiva?.id || 1,
          texto: msg
        })
      });
      const json = await res.json();
      const horarioResp = new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      });

      if (!res.ok) {
        setSimuladorHistorico((prev) => [
          ...prev,
          {
            id: `blk_${Date.now()}`,
            autor: 'Guardião de Segurança Urutau',
            direcao: 'bloqueio',
            texto: json.erro || 'Interação bloqueada pelas regras de segurança.',
            horario: horarioResp
          }
        ]);
      } else {
        setSimuladorHistorico((prev) => [
          ...prev,
          {
            id: `bot_${Date.now()}`,
            autor: 'Bot Interno Urutau',
            cargo: json.colaboradorIdentificado
              ? `Respondendo a ${json.colaboradorIdentificado.nome} (${json.colaboradorIdentificado.cargo})`
              : undefined,
            direcao: 'bot',
            texto: json.resposta || 'Comando processado.',
            horario: horarioResp,
            ferramentas: json.toolCallsExecutadas || []
          }
        ]);
        await onRefresh();
      }
    } catch (e: any) {
      setSimuladorHistorico((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          autor: 'Sistema',
          direcao: 'bloqueio',
          texto: e.message || 'Falha de comunicação com o Bot Interno.',
          horario
        }
      ]);
    } finally {
      setSimuladorEnviando(false);
    }
  };

  return (
    <div className="space-y-5 w-full">
      <div className="p-4 sm:p-5 urutau-glass rounded-2xl border border-white/10 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#10B981]" />
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                Central WhatsApp — Navegador Interno Web WhatsApp & Conexão do Bot da Equipe
              </h2>
            </div>
            <p className="text-xs text-slate-300">
              Separação total e transparente: o <strong>WhatsApp Comercial</strong> atende clientes via Web WhatsApp no navegador interno, enquanto o <strong>Bot Interno Urutau</strong> fala exclusivamente com a sua equipe interna.
            </p>
          </div>

          {data.empresas.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold">Empresa:</span>
              <select
                value={empresaSelecionadaId}
                onChange={(e) => setEmpresaSelecionadaId(Number(e.target.value))}
                className="px-3 py-2 rounded-xl bg-[#041417] border border-[#10B981]/40 text-xs font-bold text-white"
              >
                {data.empresas.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.nome}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={() => setActiveArea('web_whatsapp_comercial')}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start justify-between gap-3 ${
              activeArea === 'web_whatsapp_comercial'
                ? 'bg-[#10B981]/20 border-[#10B981] shadow-lg'
                : 'bg-black/35 border-white/10 hover:border-white/25'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#10B981]" />
                <span className="text-xs sm:text-sm font-black text-white uppercase">
                  1. Navegador Interno — Web WhatsApp Comercial (Clientes)
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Gera o QR Code e acessa o <strong>Web WhatsApp</strong> dentro do navegador interno do sistema para atendimento a clientes.
              </p>
            </div>
            <span
              className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold shrink-0 ${
                isWebWppComercialConectado
                  ? 'bg-emerald-500/25 border border-emerald-400/50 text-emerald-200'
                  : 'bg-rose-500/20 border border-rose-400/40 text-rose-200'
              }`}
            >
              {isWebWppComercialConectado ? ' CONECTADO' : ' DESCONECTADO'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveArea('conexao_bot_interno')}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start justify-between gap-3 ${
              activeArea === 'conexao_bot_interno'
                ? 'bg-amber-500/20 border-amber-400 shadow-lg'
                : 'bg-black/35 border-white/10 hover:border-white/25'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span className="text-xs sm:text-sm font-black text-white uppercase">
                  2. Área de Conexão do Bot Interno (Exclusivo Equipe)
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Cuida do número de Bot que o Urutau usa para se comunicar com a equipe interna e empresário (sem comunicação com clientes).
              </p>
            </div>
            <span
              className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold shrink-0 ${
                isBotInternoConectado
                  ? 'bg-emerald-500/25 border border-emerald-400/50 text-emerald-200'
                  : 'bg-amber-500/20 border border-amber-400/40 text-amber-200'
              }`}
            >
              {isBotInternoConectado ? ' BOT ATIVO' : ' BOT DESCONECTADO'}
            </span>
          </button>
        </div>
      </div>

      {activeArea === 'web_whatsapp_comercial' ? (
        <div className="rounded-2xl overflow-hidden border-2 border-[#10B981]/40 bg-[#041215] shadow-2xl">
          <div className="px-4 py-2.5 bg-[#020B0D] border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-400/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
              <span className="ml-2 text-xs font-black text-slate-200 uppercase tracking-wider">
                Navegador Interno Urutau • Web WhatsApp Comercial
              </span>
            </div>

            <div className="flex-1 max-w-xl flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#071A1E] border border-white/15 text-xs font-mono text-slate-200">
              <Lock className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
              <span className="truncate">
                https://web.whatsapp.com/session/{empresaAtiva?.waha_session_id || 'comercial'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleGerarNovoQrWebWpp}
                className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-xs font-bold text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                title="Recarregar QR Code do Navegador Interno"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Recarregar</span>
              </button>

              {isWebWppComercialConectado && (
                <button
                  type="button"
                  disabled={loadingWebWpp}
                  onClick={() => handleConectarOuDesconectarWebWhatsApp(false)}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/50 text-rose-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>Desconectar Web WhatsApp</span>
                </button>
              )}
            </div>
          </div>

          {!isWebWppComercialConectado ? (
            <div className="p-6 sm:p-10 bg-gradient-to-b from-[#061A1E] to-[#030F12]">
              <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-7 space-y-5">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-rose-500/15 border border-rose-400/40 text-xs font-bold text-rose-200">
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                    <span>Status Real: WhatsApp Comercial Desconectado (Nenhuma mensagem ativa)</span>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-black text-white leading-tight">
                    Conecte o WhatsApp Comercial da empresa pelo QR Code do Navegador Interno
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Para atender seus clientes diretamente por dentro do sistema, escaneie o QR Code ao lado com o <strong>celular do WhatsApp Comercial da sua empresa</strong> (este número é separado do Bot Interno da equipe).
                  </p>

                  <ol className="space-y-2.5 text-xs text-slate-200 bg-black/35 p-4 rounded-xl border border-white/10">
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#10B981] text-[#04120C] font-black flex items-center justify-center shrink-0 text-[11px]">
                        1
                      </span>
                      <span>Abra o <strong>WhatsApp Comercial</strong> no celular de atendimento da empresa.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#10B981] text-[#04120C] font-black flex items-center justify-center shrink-0 text-[11px]">
                        2
                      </span>
                      <span>Toque em <strong>Mais opções (⋮)</strong> ou <strong>Configurações</strong> e selecione <strong>Aparelhos conectados</strong>.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#10B981] text-[#04120C] font-black flex items-center justify-center shrink-0 text-[11px]">
                        3
                      </span>
                      <span>Toque em <strong>Conectar um aparelho</strong> e aponte a câmera do celular para o QR Code deste navegador interno.</span>
                    </li>
                  </ol>

                  <div className="p-4 rounded-xl bg-[#041417] border border-[#10B981]/40 space-y-3">
                    <label className="block text-xs font-bold text-[#6EE7B7]">
                      Número do WhatsApp Comercial (Aparelho que fará a leitura do QR Code):
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <input
                        type="tel"
                        value={wppComercialInput}
                        onChange={(e) => setWppComercialInput(e.target.value)}
                        placeholder="Ex: 91988887777 (WhatsApp de Clientes)"
                        className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#020B0D] border border-white/15 text-xs font-mono text-white"
                      />
                      <button
                        type="button"
                        disabled={loadingWebWpp}
                        onClick={() => handleConectarOuDesconectarWebWhatsApp(true)}
                        className="px-5 py-2.5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-[#04120C] text-xs font-black inline-flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                      >
                        <QrCode className="w-4 h-4" />
                        <span>
                          {loadingWebWpp
                            ? 'Autenticando Sessão...'
                            : 'Confirmar Leitura do QR Code & Abrir Web WhatsApp'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 flex flex-col items-center justify-center">
                  <div className="p-5 rounded-2xl bg-white text-slate-900 shadow-2xl space-y-3 text-center max-w-xs w-full">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 border-b border-slate-200 pb-2">
                      <span>WEB WHATSAPP QR</span>
                      <span className="font-mono text-emerald-700">{qrTokenSeed.slice(0, 10)}</span>
                    </div>

                    <div className="p-3 bg-white border-2 border-slate-900 rounded-xl inline-block mx-auto">
                      <svg viewBox="0 0 120 120" className="w-48 h-48 text-slate-950">
                        <rect width="120" height="120" fill="#ffffff" />
                        <path
                          d="M8,8 h32 v32 h-32 z M14,14 v20 h20 v-20 z M20,20 h8 v8 h-8 z"
                          fill="currentColor"
                        />
                        <path
                          d="M80,8 h32 v32 h-32 z M86,14 v20 h20 v-20 z M92,20 h8 v8 h-8 z"
                          fill="currentColor"
                        />
                        <path
                          d="M8,80 h32 v32 h-32 z M14,86 v20 h20 v-20 z M20,92 h8 v8 h-8 z"
                          fill="currentColor"
                        />
                        <rect x="46" y="10" width="6" height="6" fill="currentColor" />
                        <rect x="58" y="10" width="12" height="6" fill="currentColor" />
                        <rect x="46" y="22" width="12" height="6" fill="currentColor" />
                        <rect x="64" y="22" width="6" height="12" fill="currentColor" />
                        <rect x="10" y="46" width="12" height="6" fill="currentColor" />
                        <rect x="28" y="46" width="6" height="12" fill="currentColor" />
                        <rect x="46" y="46" width="28" height="28" rx="4" fill="#10B981" />
                        <circle cx="60" cy="60" r="8" fill="#04120C" />
                        <rect x="82" y="46" width="12" height="6" fill="currentColor" />
                        <rect x="100" y="46" width="10" height="12" fill="currentColor" />
                        <rect x="80" y="64" width="6" height="18" fill="currentColor" />
                        <rect x="92" y="70" width="18" height="6" fill="currentColor" />
                        <rect x="46" y="82" width="12" height="6" fill="currentColor" />
                        <rect x="64" y="82" width="6" height="18" fill="currentColor" />
                        <rect x="76" y="88" width="18" height="12" fill="currentColor" />
                        <rect x="98" y="84" width="12" height="26" fill="currentColor" />
                        <rect x="46" y="96" width="14" height="14" fill="currentColor" />
                      </svg>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs font-black text-slate-800">
                        Escaneie pelo WhatsApp Comercial
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Token dinâmico: {qrTokenSeed}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleGerarNovoQrWebWpp}
                      className="w-full py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Gerar Novo QR Code</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 min-h-[520px]">
              <div className="md:col-span-4 border-r border-white/10 bg-[#041417] flex flex-col">
                <div className="p-3.5 border-b border-white/10 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-black text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>Web WhatsApp Comercial Ativo</span>
                    </div>
                    <div className="text-[11px] font-mono text-[#6EE7B7]">
                      Número: {empresaAtiva?.wpp_comercial_numero || 'Conectado via QR'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowNovoContatoForm((v) => !v)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#10B981] text-[#04120C] text-xs font-black inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nova Conversa</span>
                  </button>
                </div>

                {showNovoContatoForm && (
                  <form
                    onSubmit={handleIniciarNovaConversaComercial}
                    className="p-3 bg-[#020B0D] border-b border-[#10B981]/40 space-y-2"
                  >
                    <div className="flex items-center justify-between text-[11px] font-bold text-[#6EE7B7]">
                      <span>Iniciar Atendimento com Cliente</span>
                      <button
                        type="button"
                        onClick={() => setShowNovoContatoForm(false)}
                        className="text-slate-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={novoContatoNome}
                      onChange={(e) => setNovoContatoNome(e.target.value)}
                      placeholder="Nome do Cliente"
                      className="w-full px-2.5 py-1.5 rounded bg-[#071A1E] border border-white/15 text-xs text-white"
                    />
                    <div className="flex gap-2">
                      <input
                        type="tel"
                        required
                        value={novoContatoNumero}
                        onChange={(e) => setNovoContatoNumero(e.target.value)}
                        placeholder="WhatsApp (Ex: 91988887777)"
                        className="flex-1 px-2.5 py-1.5 rounded bg-[#071A1E] border border-white/15 text-xs font-mono text-white"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded bg-[#10B981] text-[#04120C] text-xs font-black cursor-pointer"
                      >
                        Abrir
                      </button>
                    </div>
                  </form>
                )}

                <div className="flex-1 overflow-y-auto divide-y divide-white/5">
                  {conversasAgrupadas.length === 0 ? (
                    <div className="p-6 text-center space-y-2 text-xs text-slate-400">
                      <MessageSquare className="w-7 h-7 text-slate-600 mx-auto" />
                      <div className="font-bold text-slate-300">
                        Nenhuma conversa comercial iniciada ainda
                      </div>
                      <p className="text-[11px]">
                        Clique em <strong>+ Nova Conversa</strong> acima para enviar uma mensagem ao cliente pelo Web WhatsApp Comercial.
                      </p>
                    </div>
                  ) : (
                    conversasAgrupadas.map((conv) => (
                      <button
                        key={conv.contato}
                        type="button"
                        onClick={() => setContatoSelecionado(conv.contato)}
                        className={`w-full p-3.5 text-left transition-colors cursor-pointer flex items-start justify-between gap-2 ${
                          conversaAtiva?.contato === conv.contato
                            ? 'bg-[#10B981]/15 border-l-4 border-[#10B981]'
                            : 'hover:bg-white/5'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{conv.nome}</div>
                          <div className="text-[11px] font-mono text-slate-400">{conv.contato}</div>
                          <div className="text-xs text-slate-300 truncate mt-1">
                            {conv.ultimaMensagem}
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">
                          {conv.horario}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="md:col-span-8 bg-[#061A1E] flex flex-col justify-between">
                <div className="p-4 border-b border-white/10 bg-[#041215] flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-white">
                      {conversaAtiva
                        ? `${conversaAtiva.nome} (${conversaAtiva.contato})`
                        : novoContatoNumero
                        ? `Novo Atendimento (${novoContatoNumero})`
                        : 'Selecione ou inicie um atendimento comercial'}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Sessão Web WhatsApp Comercial • Sem mistura com o Bot Interno da equipe
                    </div>
                  </div>
                </div>

                <div className="flex-1 p-4 overflow-y-auto space-y-3 max-h-[380px]">
                  {conversaAtiva && conversaAtiva.mensagens.length > 0 ? (
                    conversaAtiva.mensagens.map((m: any) => (
                      <div
                        key={m.id}
                        className={`max-w-md p-3 rounded-xl text-xs space-y-1 ${
                          m.direcao === 'enviada'
                            ? 'ml-auto bg-[#10B981]/20 border border-[#10B981]/40 text-white'
                            : 'mr-auto bg-[#041215] border border-white/10 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 text-[10px] text-slate-400">
                          <span className="font-bold text-[#6EE7B7]">{m.remetente}</span>
                          <span className="font-mono">{m.horario}</span>
                        </div>
                        <p className="leading-relaxed">{m.texto}</p>
                      </div>
                    ))
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-xs text-slate-400 space-y-2">
                      <Globe className="w-8 h-8 text-[#10B981]/60" />
                      <div className="text-sm font-bold text-slate-200">
                        Navegador Interno Web WhatsApp Pronto
                      </div>
                      <p className="max-w-md">
                        Envie mensagens de confirmação de reserva ou atendimento para clientes usando o campo abaixo.
                      </p>
                    </div>
                  )}
                </div>

                <form
                  onSubmit={handleEnviarMensagemComercial}
                  className="p-3.5 bg-[#041215] border-t border-white/10 flex items-center gap-2"
                >
                  {!conversaAtiva && (
                    <input
                      type="tel"
                      value={novoContatoNumero}
                      onChange={(e) => setNovoContatoNumero(e.target.value)}
                      placeholder="WhatsApp do cliente..."
                      className="w-44 px-3 py-2 rounded-xl bg-[#020B0D] border border-white/15 text-xs font-mono text-white"
                    />
                  )}
                  <input
                    type="text"
                    value={textoEnvio}
                    onChange={(e) => setTextoEnvio(e.target.value)}
                    placeholder="Digite a mensagem comercial para o cliente..."
                    className="flex-1 px-3.5 py-2 rounded-xl bg-[#020B0D] border border-white/15 text-xs text-white"
                  />
                  <button
                    type="submit"
                    disabled={enviandoMsg}
                    className="px-4 py-2 rounded-xl bg-[#10B981] hover:bg-[#059669] text-[#04120C] text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Enviar</span>
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-6 sm:p-8 urutau-glass rounded-2xl border-2 border-amber-400/40 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
            <div className="space-y-1.5 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-amber-500/20 border border-amber-400/40 text-xs font-bold text-amber-200">
                <ShieldCheck className="w-4 h-4 text-amber-300" />
                <span>Área Exclusiva do Bot Interno • Comunicação Somente com a Equipe Interna</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white">
                Gerenciamento & Conexão do Bot Interno Urutau ({empresaAtiva?.nome})
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                O número configurado nesta área <strong>não conversa com clientes</strong>. Ele é o canal oficial pelo qual o assistente Urutau envia alertas de escalas, estoque acabando, fechamento de caixa e avisos operacionais diretamente para os colaboradores e para o empresário.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-black/45 border border-white/10 text-right space-y-1">
              <div className="text-[10px] font-mono uppercase text-slate-400">
                Status Real do Bot Interno
              </div>
              <div
                className={`text-sm font-black flex items-center justify-end gap-1.5 ${
                  isBotInternoConectado ? 'text-emerald-400' : 'text-amber-300'
                }`}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    isBotInternoConectado ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <span>
                  {isBotInternoConectado ? 'Conectado à Equipe' : 'Desconectado / Aguardando'}
                </span>
              </div>
              <div className="text-xs font-mono text-slate-300">
                {botInternoNumeroInput || 'Nenhum número vinculado'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-5">
              <div className="p-5 rounded-xl bg-[#041417] border border-white/10 space-y-4">
                <h4 className="text-sm font-black text-white uppercase tracking-wider">
                  1. Definição do Número do Bot Interno da Equipe
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setUsarWppPessoalComoBot(true)}
                    className={`p-3.5 rounded-xl border text-left text-xs cursor-pointer transition-all ${
                      usarWppPessoalComoBot
                        ? 'bg-[#10B981]/20 border-[#10B981] text-white font-bold'
                        : 'bg-black/30 border-white/10 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>Usar WhatsApp Pessoal do Empresário</span>
                      {usarWppPessoalComoBot && <Check className="w-4 h-4 text-[#10B981]" />}
                    </div>
                    <p className="text-[11px] text-slate-300 font-normal mt-1">
                      O mesmo número pessoal do empresário atua como Bot Interno para avisar a equipe.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUsarWppPessoalComoBot(false)}
                    className={`p-3.5 rounded-xl border text-left text-xs cursor-pointer transition-all ${
                      !usarWppPessoalComoBot
                        ? 'bg-amber-500/20 border-amber-400 text-white font-bold'
                        : 'bg-black/30 border-white/10 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>Usar Número Dedicado ao Bot Interno</span>
                      {!usarWppPessoalComoBot && <Check className="w-4 h-4 text-amber-300" />}
                    </div>
                    <p className="text-[11px] text-slate-300 font-normal mt-1">
                      Usa um chip exclusivo para o sistema Urutau falar com os colaboradores.
                    </p>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      WhatsApp Pessoal do Empresário (Titular)
                    </label>
                    <input
                      type="tel"
                      value={wppPessoalTitularInput}
                      onChange={(e) => {
                        setWppPessoalTitularInput(e.target.value);
                        if (usarWppPessoalComoBot) {
                          setBotInternoNumeroInput(e.target.value);
                        }
                      }}
                      placeholder="Ex: 5591991122334"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#020B0D] border border-white/15 text-xs font-mono text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-amber-300 mb-1">
                      Número do Bot Interno (Comunicação com Equipe)
                    </label>
                    <input
                      type="tel"
                      value={usarWppPessoalComoBot ? wppPessoalTitularInput || botInternoNumeroInput : botInternoNumeroInput}
                      onChange={(e) => setBotInternoNumeroInput(e.target.value)}
                      disabled={usarWppPessoalComoBot}
                      placeholder="Ex: 5591999990001"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#020B0D] border border-amber-400/40 text-xs font-mono text-white disabled:opacity-60"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    disabled={loadingBotAction}
                    onClick={handleGerarPareamentoBotInterno}
                    className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Gerar Código / QR de Pareamento do Bot Interno</span>
                  </button>

                  {isBotInternoConectado ? (
                    <button
                      type="button"
                      disabled={loadingBotAction}
                      onClick={() => handleSalvarConfigBotInterno('Desconectado', false)}
                      className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/50 text-rose-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>Desconectar Bot Interno</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={loadingBotAction}
                      onClick={() => handleSalvarConfigBotInterno('Conectado', false)}
                      className="px-4 py-2 rounded-xl bg-[#10B981] hover:bg-[#059669] text-[#04120C] text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Ativar & Confirmar Conexão do Bot Interno</span>
                    </button>
                  )}
                </div>

                {botPairingCode && (
                  <div className="p-4 rounded-xl bg-black/60 border border-emerald-500/40 space-y-4">
                    <div className="flex flex-col md:flex-row items-center gap-4">
                      {botQrImageUrl && (
                        <div className="p-2 bg-white rounded-xl shadow-md border border-white/20 flex-shrink-0">
                          <img
                            src={botQrImageUrl}
                            alt="QR Code WhatsApp"
                            className="w-36 h-36 object-contain"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0 space-y-2.5">
                        <div className="space-y-1">
                          <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                            Opção 1 (Recomendado): Escanear QR Code
                          </div>
                          <p className="text-xs text-slate-300">
                            No WhatsApp do telefone, acesse <strong>Aparelhos Conectados &gt; Conectar Aparelho</strong> e aponte a câmera para o QR Code ao lado.
                          </p>
                        </div>

                        <div className="space-y-1 pt-2 border-t border-white/10">
                          <div className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                            Opção 2: Código Oficial WhatsApp (8 Dígitos)
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-lg font-mono font-black text-amber-300 bg-black/70 px-3 py-1 rounded-lg border border-amber-500/40 tracking-widest select-all">
                              {botPairingCode}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard?.writeText(botPairingCode);
                                showAlert('Código Copiado', `Código de pareamento ${botPairingCode} copiado.`);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Copy className="w-3 h-3" />
                              <span>Copiar</span>
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Em Aparelhos Conectados &gt; Conectar com número de telefone, insira o código de 8 dígitos acima.
                          </p>
                        </div>

                        <div className="pt-2 border-t border-white/10 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={loadingBotAction}
                            onClick={handleConfirmarPareamentoDireto}
                            className="px-3.5 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-[#04120C] text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Confirmar Pareamento e Conectar no Sistema</span>
                          </button>
                          {botQrUrl && (
                            <a
                              href={botQrUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold inline-flex items-center gap-1"
                            >
                              <span>Abrir WhatsApp Web</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-5 space-y-5">
              <div className="p-5 rounded-xl bg-[#041417] border border-white/10 space-y-4">
                <h4 className="text-sm font-black text-white uppercase tracking-wider">
                  2. Comunicados Internos Automáticos para a Equipe
                </h4>
                <p className="text-xs text-slate-300">
                  Escolha quais avisos internos o Bot Urutau deve enviar para os colaboradores e gestores:
                </p>

                <div className="space-y-2.5">
                  {[
                    {
                      key: 'escalas' as const,
                      label: 'Avisos de Escalas, Turnos e Folgas da Equipe',
                      icon: Calendar
                    },
                    {
                      key: 'estoque' as const,
                      label: 'Alertas de Produtos Acabando e Reposição de Estoque',
                      icon: Package
                    },
                    {
                      key: 'fechamento_caixa' as const,
                      label: 'Resumo de Fechamento de Caixa e Pagamento de RH',
                      icon: Wallet
                    },
                    {
                      key: 'ponto_gps' as const,
                      label: 'Alertas de Presença / Perímetro GPS das Unidades',
                      icon: MapPin
                    }
                  ].map((item) => {
                    const Icon = item.icon;
                    const checked = alertasEquipe[item.key];
                    return (
                      <label
                        key={item.key}
                        className="p-3 rounded-xl bg-black/35 border border-white/10 flex items-center justify-between gap-3 cursor-pointer hover:border-[#10B981]/40"
                      >
                        <div className="flex items-center gap-2.5 text-xs text-slate-200 font-semibold">
                          <Icon className="w-4 h-4 text-[#10B981] shrink-0" />
                          <span>{item.label}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setAlertasEquipe((prev) => ({ ...prev, [item.key]: !prev[item.key] }))
                          }
                          className="accent-[#10B981] w-4 h-4"
                        />
                      </label>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/10">
                  <button
                    type="button"
                    disabled={loadingBotAction}
                    onClick={() => handleSalvarConfigBotInterno(undefined, false)}
                    className="px-4 py-2 rounded-xl bg-[#10B981] hover:bg-[#059669] text-[#04120C] text-xs font-black cursor-pointer"
                  >
                    Salvar Preferências do Bot Interno
                  </button>

                  <button
                    type="button"
                    disabled={loadingBotAction}
                    onClick={() => handleSalvarConfigBotInterno('Conectado', true)}
                    className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Bell className="w-3.5 h-3.5 text-amber-300" />
                    <span>Disparar Teste p/ Equipe Interna</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6 rounded-2xl bg-[#041417] border-2 border-[#10B981]/45 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#10B981]/15 border border-[#10B981]/40 text-[11px] font-bold text-[#6EE7B7]">
                  <Users className="w-3.5 h-3.5 text-[#10B981]" />
                  <span>Console Direto & Simulador de Interação dos Colaboradores via WhatsApp</span>
                </div>
                <h4 className="text-base sm:text-lg font-black text-white">
                  3. Conversar com o Bot Interno como Colaborador (Validação de Cargo, Checklists e Caixa)
                </h4>
                <p className="text-xs text-slate-300">
                  Selecione abaixo qual colaborador está enviando a mensagem no WhatsApp. O Bot Interno valida automaticamente as permissões do cargo antes de liberar consultas financeiras, contratações ou baixas de checklist.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <div className="space-y-1">
                  <label className="block text-[10px] font-mono uppercase text-slate-400">
                    Colaborador Remetente no WhatsApp:
                  </label>
                  <select
                    value={simuladorColaboradorId}
                    onChange={(e) => setSimuladorColaboradorId(Number(e.target.value))}
                    className="px-3.5 py-2 rounded-xl bg-[#020B0D] border border-[#10B981]/50 text-xs font-bold text-white min-w-[250px]"
                  >
                    {colaboradoresEquipes.map((col: any) => (
                      <option key={col.id} value={col.id}>
                        {col.nome} — {col.cargo || col.tipo}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-black/40 border border-white/10 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-400 font-semibold">Alçadas do Cargo Selecionado:</span>
                <span className="px-2.5 py-1 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 font-bold text-[11px]">
                  Checklists, Reservas, Estoque & Compras: LIBERADO
                </span>
                <span
                  className={`px-2.5 py-1 rounded-md font-bold text-[11px] border ${
                    alcadasColaboradorSimulado.podeCaixa
                      ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                      : 'bg-rose-500/20 border-rose-400/40 text-rose-200'
                  }`}
                >
                  Caixa & Fechamento de Rateio:{' '}
                  {alcadasColaboradorSimulado.podeCaixa ? 'AUTORIZADO' : 'BLOQUEADO P/ ESTE CARGO'}
                </span>
                <span
                  className={`px-2.5 py-1 rounded-md font-bold text-[11px] border ${
                    alcadasColaboradorSimulado.podeGestaoEscalaRH
                      ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                      : 'bg-rose-500/20 border-rose-400/40 text-rose-200'
                  }`}
                >
                  Faltas, Dobras & Vales RH:{' '}
                  {alcadasColaboradorSimulado.podeGestaoEscalaRH ? 'AUTORIZADO' : 'BLOQUEADO P/ ESTE CARGO'}
                </span>
                <span
                  className={`px-2.5 py-1 rounded-md font-bold text-[11px] border ${
                    alcadasColaboradorSimulado.podeFreelancer
                      ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                      : 'bg-rose-500/20 border-rose-400/40 text-rose-200'
                  }`}
                >
                  Contratação de Freelancers:{' '}
                  {alcadasColaboradorSimulado.podeFreelancer ? 'AUTORIZADO' : 'BLOQUEADO P/ ESTE CARGO'}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-bold text-slate-300">
                Atalhos de Comandos dos Colaboradores no WhatsApp (Clique para enviar):
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Quem está na escala hoje?', msg: 'Quem está na escala de hoje?' },
                  { label: 'Lançar Falta p/ João', msg: 'Lançar falta para João hoje' },
                  { label: 'Troca de Turno', msg: 'Troca de turno entre Ana e Carlos' },
                  { label: 'Ver Estoque Crítico', msg: 'O que está faltando no estoque?' },
                  { label: 'Saldo de Camarão', msg: 'Saldo de camarão no estoque' },
                  { label: 'Baixa 2kg Filé', msg: 'Baixa de 2kg de filé na cozinha' },
                  { label: 'Pedir Compra 20kg', msg: 'Pedir compra de 20kg de camarão' },
                  { label: 'Recebi Mercadoria R$ 450', msg: 'Recebi 15kg de mercadoria por 450 reais' },
                  { label: 'Saldo do Caixa Hoje', msg: 'Qual o saldo do caixa hoje?' },
                  { label: 'Lançar Saída R$ 45 (Gelo)', msg: 'Lançar saída de 45 reais para compra de gelo' },
                  { label: 'Consultar Rateio do Dia', msg: 'Consultar rateio de hoje' },
                  { label: 'Fechar Rateio do Dia', msg: 'Fechar rateio de hoje' },
                  { label: 'Lançar Vale R$ 100', msg: 'Lançar vale de 100 reais para Pedro' },
                  { label: 'Consultar Prontuário RH', msg: 'Consultar prontuário de Pedro' },
                  { label: 'Criar Reserva Carlos Mesa 4', msg: 'Criar reserva para Carlos hoje às 20h para 6 pessoas na mesa 4' },
                  { label: 'Cliente Mesa 4 Chegou', msg: 'Cliente da mesa 4 chegou' },
                  { label: 'Compromissos da Agenda', msg: 'Quais os compromissos da agenda de hoje?' },
                  { label: 'Ver Checklists Pendentes', msg: 'Quais checklists estão pendentes hoje?' },
                  { label: 'Concluir Checklist Bar', msg: 'Concluí o checklist de abertura e higienização do setor' },
                  { label: 'Consultar CMV do Período', msg: 'Qual o CMV do período?' },
                  { label: 'Buscar Freelancer Garçom', msg: 'Buscar freelancer de Garçom até 180 reais' },
                  { label: 'Confirmar Ação (SIM)', msg: 'SIM' },
                  { label: 'Cancelar Ação (NÃO)', msg: 'NÃO' }
                ].map((atalho) => (
                  <button
                    key={atalho.label}
                    type="button"
                    disabled={simuladorEnviando}
                    onClick={() => handleEnviarMensagemSimuladorBot(atalho.msg)}
                    className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-[#10B981]/20 border border-white/15 hover:border-[#10B981]/50 text-[11px] font-bold text-slate-200 hover:text-white transition-all cursor-pointer"
                  >
                    {atalho.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-[#020B0D] border border-white/10 p-4 h-80 overflow-y-auto space-y-3">
              {simuladorHistorico.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-xs text-slate-400 space-y-2">
                  <MessageSquare className="w-7 h-7 text-[#10B981]/60" />
                  <div className="font-bold text-slate-200">
                    Pronto para simular ou enviar comandos reais ao Bot Interno Urutau
                  </div>
                  <p className="max-w-lg text-[11px]">
                    Escolha um colaborador acima e clique em qualquer atalho (ou digite abaixo) para ver como o sistema responde, dá baixa em checklists, registra ocorrências na escala, lança no caixa em 2 etapas e bloqueia funções fora da alçada do cargo.
                  </p>
                </div>
              ) : (
                simuladorHistorico.map((item) => (
                  <div
                    key={item.id}
                    className={`max-w-2xl p-3.5 rounded-xl text-xs space-y-1.5 ${
                      item.direcao === 'colaborador'
                        ? 'ml-auto bg-[#10B981]/20 border border-[#10B981]/45 text-white'
                        : item.direcao === 'bloqueio'
                        ? 'mr-auto bg-rose-950/60 border border-rose-500/50 text-rose-100'
                        : 'mr-auto bg-[#071A1E] border border-amber-400/35 text-slate-100'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]">
                      <span className="font-black text-[#6EE7B7]">
                        {item.autor} {item.cargo ? `• ${item.cargo}` : ''}
                      </span>
                      <span className="font-mono text-slate-400">{item.horario}</span>
                    </div>
                    <div className="whitespace-pre-line leading-relaxed">{item.texto}</div>
                    {item.ferramentas && item.ferramentas.length > 0 && (
                      <div className="pt-1 flex flex-wrap items-center gap-1.5">
                        {item.ferramentas.map((fn) => (
                          <span
                            key={fn}
                            className="px-2 py-0.5 rounded bg-black/40 border border-amber-400/40 text-[10px] font-mono text-amber-300"
                          >
                            Função executada: {fn}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleEnviarMensagemSimuladorBot();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={simuladorTexto}
                onChange={(e) => setSimuladorTexto(e.target.value)}
                placeholder={`Enviar mensagem no WhatsApp como ${colaboradorSimuladoObj?.nome || 'Colaborador'} (${colaboradorSimuladoObj?.cargo || 'Cargo'})...`}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#020B0D] border border-white/15 text-xs text-white"
              />
              <button
                type="submit"
                disabled={simuladorEnviando}
                className="px-5 py-2.5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-[#04120C] text-xs font-black inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{simuladorEnviando ? 'Processando...' : 'Enviar p/ Bot'}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
