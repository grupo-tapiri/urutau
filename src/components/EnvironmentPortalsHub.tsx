import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  GraduationCap,
  ShieldCheck,
  Building2,
  Wrench,
  Wallet,
  ClipboardCheck,
  Check,
  Plus,
  Send,
  Award,
  Globe,
  Sparkles,
  Calendar,
  Server,
  ChevronRight,
  Users
} from 'lucide-react';
import { TabId } from '../types/erp';
import { UrutauWatermarkSVG } from './UrutauShared';

export type EnvironmentPortalMode = 'empresario' | 'colaborador' | 'tecnico';

export interface VagaItem {
  id: string;
  titulo: string;
  unidade: string;
  modalidade: 'Freelancer / Evento' | 'Colaborador Fixo' | 'Técnico / Manutenção';
  valorProposto: number;
  turnoData: string;
  requisitosTreinamento: string[];
  status: 'Aberta' | 'Em Negociação' | 'Preenchida';
  propostas: {
    id: string;
    candidatoNome: string;
    funcao: string;
    valorOferta: number;
    mensagem: string;
    origem: 'colaborador' | 'empresa';
    status: 'Pendente' | 'Aceita' | 'Contraproposta';
  }[];
}

export interface TreinamentoItem {
  id: string;
  titulo: string;
  setor: string;
  duracaoMin: number;
  obrigatorioPara: string;
  checklistVinculado: string;
  modulos: string[];
  concluidoPor: string[];
}

const INITIAL_VAGAS: VagaItem[] = [];

const INITIAL_TREINAMENTOS: TreinamentoItem[] = [];

export const ENVIRONMENT_PORTAL_META: Record<
  EnvironmentPortalMode,
  {
    id: EnvironmentPortalMode;
    titulo: string;
    subtitulo: string;
    dominioExemplo: string;
    corHex: string;
    abasPrincipais: TabId[];
    categoriasPermitidas: string[];
  }
> = {
  empresario: {
    id: 'empresario',
    titulo: 'Empresários & Administrativo',
    subtitulo: 'Fechamento de caixa financeiro, edição de checklists, treinamentos, vagas e gestão multi-unidade',
    dominioExemplo: 'tapiri.nyctibi.us',
    corHex: '#F59E0B',
    abasPrincipais: ['caixa', 'checklists', 'rh', 'cmv', 'reservas', 'estoque', 'rateio', 'equipe'],
    categoriasPermitidas: [
      'salao_atendimento',
      'operacao_escalas',
      'financeiro_caixa',
      'estoque_suprimentos',
      'pessoas_equipe',
      'rh_selecao',
      'estrutura_unidades'
    ]
  },
  colaborador: {
    id: 'colaborador',
    titulo: 'Colaboradores & Freelancers',
    subtitulo: 'Vagas e propostas, treinamentos e capacitações, checklists do turno, escalas e rateio',
    dominioExemplo: 'colaborador.nyctibi.us',
    corHex: '#10B981',
    abasPrincipais: ['freelancers', 'checklists', 'escalas', 'rateio', 'agenda', 'reservas'],
    categoriasPermitidas: ['operacao_escalas', 'salao_atendimento', 'rh_selecao']
  },
  tecnico: {
    id: 'tecnico',
    titulo: 'Equipe Técnica de Manutenção',
    subtitulo: 'Módulos anti-queda, servidor VPS/OTA, banco offline, logs de auditoria, permissões e licenças',
    dominioExemplo: 'tecnico.nyctibi.us',
    corHex: '#26A69A',
    abasPrincipais: ['modulos', 'servidor_ia', 'auditoria', 'permissoes', 'empresas', 'notificacoes', 'config'],
    categoriasPermitidas: ['governanca_sistema', 'estrutura_unidades']
  }
};

export function EnvironmentWorkspaceBar({
  activeEnvironment,
  onSelectEnvironment,
  companySubdomainSlug,
  collaboratorSlug,
  onApplyPresetLink,
  activeTab,
  onSelectTab,
  hubOpen,
  setHubOpen
}: {
  activeEnvironment: EnvironmentPortalMode;
  onSelectEnvironment: (env: EnvironmentPortalMode) => void;
  companySubdomainSlug: string;
  collaboratorSlug: string;
  onApplyPresetLink: (linkHost: string, env: EnvironmentPortalMode) => void;
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  hubOpen: boolean;
  setHubOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const [vagas, setVagas] = useState<VagaItem[]>(() => {
    try {
      const saved = localStorage.getItem('urutau_vagas_propostas_v2_clean');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_VAGAS;
  });

  const [treinamentos, setTreinamentos] = useState<TreinamentoItem[]>(() => {
    try {
      const saved = localStorage.getItem('urutau_treinamentos_v2_clean');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_TREINAMENTOS;
  });

  const [hubSubTab, setHubSubTab] = useState<'vagas' | 'treinamentos' | 'links'>('vagas');
  const [novaVagaTitulo, setNovaVagaTitulo] = useState('');
  const [novaVagaValor, setNovaVagaValor] = useState('200');
  const [novaVagaModalidade, setNovaVagaModalidade] = useState<VagaItem['modalidade']>('Freelancer / Evento');

  const [novoTreinTitulo, setNovoTreinTitulo] = useState('');
  const [novoTreinSetor, setNovoTreinSetor] = useState('Operação & Salão');
  const [novoTreinChecklist, setNovoTreinChecklist] = useState('Checklist Operacional do Turno');

  const [propostaValorInput, setPropostaValorInput] = useState<Record<string, string>>({});
  const [propostaMsgInput, setPropostaMsgInput] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      localStorage.setItem('urutau_vagas_propostas_v2_clean', JSON.stringify(vagas));
    } catch {}
  }, [vagas]);

  useEffect(() => {
    try {
      localStorage.setItem('urutau_treinamentos_v2_clean', JSON.stringify(treinamentos));
    } catch {}
  }, [treinamentos]);

  const activeHostLabel =
    activeEnvironment === 'tecnico'
      ? 'tecnico.nyctibi.us'
      : activeEnvironment === 'colaborador'
      ? `${collaboratorSlug || 'colaborador'}.nyctibi.us`
      : `${companySubdomainSlug || 'empresa'}.nyctibi.us`;

  const handleCreateVaga = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaVagaTitulo.trim()) return;
    const nova: VagaItem = {
      id: `vaga_${Date.now()}`,
      titulo: novaVagaTitulo.trim(),
      unidade: 'Tapiri Matriz',
      modalidade: novaVagaModalidade,
      valorProposto: Number(novaVagaValor) || 180,
      turnoData: 'Horário a combinar no turno',
      requisitosTreinamento: ['Padrão Operacional Urutau'],
      status: 'Aberta',
      propostas: []
    };
    setVagas((prev) => [nova, ...prev]);
    setNovaVagaTitulo('');
  };

  const handleSendProposta = (vagaId: string, defaultVal: number) => {
    const val = Number(propostaValorInput[vagaId] || defaultVal);
    const msg =
      propostaMsgInput[vagaId]?.trim() ||
      (activeEnvironment === 'empresario'
        ? 'Proposta oficial enviada pela administração.'
        : 'Tenho disponibilidade imediata e treinamentos em dia.');

    setVagas((prev) =>
      prev.map((v) => {
        if (v.id !== vagaId) return v;
        return {
          ...v,
          status: 'Em Negociação',
          propostas: [
            ...v.propostas,
            {
              id: `prop_${Date.now()}`,
              candidatoNome:
                activeEnvironment === 'empresario'
                  ? 'Proposta da Administração'
                  : `${collaboratorSlug || 'Colaborador'} (Freelancer/Equipe)`,
              funcao: v.modalidade,
              valorOferta: val,
              mensagem: msg,
              origem: activeEnvironment === 'empresario' ? 'empresa' : 'colaborador',
              status: 'Pendente'
            }
          ]
        };
      })
    );
    setPropostaMsgInput((prev) => ({ ...prev, [vagaId]: '' }));
  };

  const handleAcceptProposta = (vagaId: string, propId: string) => {
    setVagas((prev) =>
      prev.map((v) => {
        if (v.id !== vagaId) return v;
        return {
          ...v,
          status: 'Preenchida',
          propostas: v.propostas.map((p) =>
            p.id === propId ? { ...p, status: 'Aceita' } : p
          )
        };
      })
    );
  };

  const handleCreateTreinamento = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoTreinTitulo.trim()) return;
    const novo: TreinamentoItem = {
      id: `trein_${Date.now()}`,
      titulo: novoTreinTitulo.trim(),
      setor: novoTreinSetor,
      duracaoMin: 20,
      obrigatorioPara: 'Equipe Operacional & Freelancers',
      checklistVinculado: novoTreinChecklist,
      modulos: [
        '1. Padrão de execução e conferência no sistema',
        '2. Boas práticas e validação pelo checklist diário'
      ],
      concluidoPor: []
    };
    setTreinamentos((prev) => [novo, ...prev]);
    setNovoTreinTitulo('');
  };

  const handleToggleConcluirTreinamento = (treinId: string) => {
    const userLabel = collaboratorSlug || 'Colaborador Ativo';
    setTreinamentos((prev) =>
      prev.map((t) => {
        if (t.id !== treinId) return t;
        const jaConcluiu = t.concluidoPor.includes(userLabel);
        return {
          ...t,
          concluidoPor: jaConcluiu
            ? t.concluidoPor.filter((x) => x !== userLabel)
            : [...t.concluidoPor, userLabel]
        };
      })
    );
  };

  return (
    <div className="mb-3 space-y-2">
      
      <div className="bg-[#071510] border border-white/8 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2">
        
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mr-1 hidden sm:inline">
            Ambiente:
          </span>

          <button
            type="button"
            data-no-confirm="true"
            onClick={() => onSelectEnvironment('empresario')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeEnvironment === 'empresario'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>1. Empresário & Admin</span>
          </button>

          <button
            type="button"
            data-no-confirm="true"
            onClick={() => onSelectEnvironment('colaborador')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeEnvironment === 'colaborador'
                ? 'bg-[#10B981]/20 text-emerald-300 border border-[#10B981]/40'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>2. Colaborador & Freelancer</span>
          </button>

          <button
            type="button"
            data-no-confirm="true"
            onClick={() => onSelectEnvironment('tecnico')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeEnvironment === 'tecnico'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>3. Equipe Técnica</span>
          </button>
        </div>

        
        <div className="flex flex-wrap items-center gap-2">
          <div
            onClick={() => {
              setHubSubTab('links');
              setHubOpen(true);
            }}
            className="px-2.5 py-1 rounded-lg bg-[#050E0A] border border-white/10 text-[11px] font-mono text-slate-300 hover:border-white/25 inline-flex items-center gap-1.5 cursor-pointer"
            title="Clique para testar ou copiar os links personalizados .nyctibi.us com pré-carregamento"
          >
            <Globe className="w-3 h-3 text-[#10B981]" />
            <span>{activeHostLabel}</span>
          </div>

          <button
            type="button"
            data-no-confirm="true"
            onClick={() => setHubOpen((v) => !v)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
              hubOpen
                ? 'bg-[#10B981] text-[#05100C]'
                : 'bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Vagas, Propostas & Treinamentos</span>
          </button>
        </div>
      </div>

      
      <div className="flex flex-wrap items-center gap-1.5 px-1">
        {activeEnvironment === 'empresario' && (
          <>
            <button
              type="button"
              data-no-confirm="true"
              onClick={() => onSelectTab('caixa')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer ${
                activeTab === 'caixa'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-[#091812] text-slate-300 hover:text-white border border-white/6'
              }`}
            >
              <Wallet className="w-3 h-3 text-amber-400" />
              <span>Fechamento de Caixa Financeiro</span>
            </button>
            <button
              type="button"
              data-no-confirm="true"
              onClick={() => onSelectTab('checklists')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer ${
                activeTab === 'checklists'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-[#091812] text-slate-300 hover:text-white border border-white/6'
              }`}
            >
              <ClipboardCheck className="w-3 h-3 text-amber-400" />
              <span>Editar Checklists dos Colaboradores</span>
            </button>
            <button
              type="button"
              data-no-confirm="true"
              onClick={() => {
                setHubSubTab('treinamentos');
                setHubOpen(true);
              }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#091812] text-slate-300 hover:text-white border border-white/6 inline-flex items-center gap-1 cursor-pointer"
            >
              <GraduationCap className="w-3 h-3 text-amber-400" />
              <span>Editar Treinamentos & Capacitações</span>
            </button>
            <button
              type="button"
              data-no-confirm="true"
              onClick={() => {
                setHubSubTab('vagas');
                setHubOpen(true);
              }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#091812] text-slate-300 hover:text-white border border-white/6 inline-flex items-center gap-1 cursor-pointer"
            >
              <Briefcase className="w-3 h-3 text-amber-400" />
              <span>Gerenciar Vagas & Propostas ({vagas.length})</span>
            </button>
            <button
              type="button"
              data-no-confirm="true"
              onClick={() => onSelectTab('reservas')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer ${
                activeTab === 'reservas'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-[#091812] text-slate-300 hover:text-white border border-white/6'
              }`}
            >
              <Calendar className="w-3 h-3 text-amber-400" />
              <span>Mapa de Mesas & Reservas</span>
            </button>
          </>
        )}

        {activeEnvironment === 'colaborador' && (
          <>
            <button
              type="button"
              data-no-confirm="true"
              onClick={() => {
                setHubSubTab('vagas');
                setHubOpen(true);
              }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#091812] text-emerald-300 hover:text-white border border-[#10B981]/30 inline-flex items-center gap-1 cursor-pointer"
            >
              <Briefcase className="w-3 h-3 text-[#10B981]" />
              <span>Vagas & Enviar Proposta ({vagas.length})</span>
            </button>
            <button
              type="button"
              data-no-confirm="true"
              onClick={() => {
                setHubSubTab('treinamentos');
                setHubOpen(true);
              }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#091812] text-emerald-300 hover:text-white border border-[#10B981]/30 inline-flex items-center gap-1 cursor-pointer"
            >
              <GraduationCap className="w-3 h-3 text-[#10B981]" />
              <span>Meus Treinamentos & Capacitações ({treinamentos.length})</span>
            </button>
            <button
              type="button"
              data-no-confirm="true"
              onClick={() => onSelectTab('checklists')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer ${
                activeTab === 'checklists'
                  ? 'bg-[#10B981]/20 text-emerald-300 border border-[#10B981]/40'
                  : 'bg-[#091812] text-slate-300 hover:text-white border border-white/6'
              }`}
            >
              <ClipboardCheck className="w-3 h-3 text-[#10B981]" />
              <span>Meus Checklists do Turno</span>
            </button>
            <button
              type="button"
              data-no-confirm="true"
              onClick={() => onSelectTab('escalas')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer ${
                activeTab === 'escalas'
                  ? 'bg-[#10B981]/20 text-emerald-300 border border-[#10B981]/40'
                  : 'bg-[#091812] text-slate-300 hover:text-white border border-white/6'
              }`}
            >
              <Calendar className="w-3 h-3 text-[#10B981]" />
              <span>Minha Escala & Turnos</span>
            </button>
            <button
              type="button"
              data-no-confirm="true"
              onClick={() => onSelectTab('rateio')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer ${
                activeTab === 'rateio'
                  ? 'bg-[#10B981]/20 text-emerald-300 border border-[#10B981]/40'
                  : 'bg-[#091812] text-slate-300 hover:text-white border border-white/6'
              }`}
            >
              <Sparkles className="w-3 h-3 text-[#10B981]" />
              <span>Meus Pontos & Rateio</span>
            </button>
          </>
        )}

        {activeEnvironment === 'tecnico' && (
          <>
            <button
              type="button"
              data-no-confirm="true"
              onClick={() => onSelectTab('modulos')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer ${
                activeTab === 'modulos'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                  : 'bg-[#091812] text-slate-300 hover:text-white border border-white/6'
              }`}
            >
              <Wrench className="w-3 h-3 text-teal-400" />
              <span>Módulos Isolados Anti-Queda</span>
            </button>
            <button
              type="button"
              data-no-confirm="true"
              onClick={() => onSelectTab('servidor_ia')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer ${
                activeTab === 'servidor_ia'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                  : 'bg-[#091812] text-slate-300 hover:text-white border border-white/6'
              }`}
            >
              <Server className="w-3 h-3 text-teal-400" />
              <span>Servidor VPS, OTA & Sync Offline</span>
            </button>
            <button
              type="button"
              data-no-confirm="true"
              onClick={() => onSelectTab('auditoria')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer ${
                activeTab === 'auditoria'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                  : 'bg-[#091812] text-slate-300 hover:text-white border border-white/6'
              }`}
            >
              <ShieldCheck className="w-3 h-3 text-teal-400" />
              <span>Logs & Geofence GPS</span>
            </button>
            <button
              type="button"
              data-no-confirm="true"
              onClick={() => onSelectTab('empresas')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer ${
                activeTab === 'empresas'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                  : 'bg-[#091812] text-slate-300 hover:text-white border border-white/6'
              }`}
            >
              <Building2 className="w-3 h-3 text-teal-400" />
              <span>Multi-Empresas & Subdomínios .nyctibi.us</span>
            </button>
          </>
        )}
      </div>

      
      {hubOpen && (
        <div className="bg-[#081510] border border-[#10B981]/35 rounded-2xl p-4 space-y-4 relative overflow-hidden">
          <UrutauWatermarkSVG variant="vazado" className="w-28 h-28 opacity-5 absolute -right-4 -bottom-4" />

          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 pb-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                data-no-confirm="true"
                onClick={() => setHubSubTab('vagas')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                  hubSubTab === 'vagas'
                    ? 'bg-[#10B981] text-[#05100C]'
                    : 'bg-[#0D2119] text-slate-300 hover:text-white'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>Vagas & Propostas ({vagas.length})</span>
              </button>

              <button
                type="button"
                data-no-confirm="true"
                onClick={() => setHubSubTab('treinamentos')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                  hubSubTab === 'treinamentos'
                    ? 'bg-[#10B981] text-[#05100C]'
                    : 'bg-[#0D2119] text-slate-300 hover:text-white'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Treinamentos & Capacitações ({treinamentos.length})</span>
              </button>

              <button
                type="button"
                data-no-confirm="true"
                onClick={() => setHubSubTab('links')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                  hubSubTab === 'links'
                    ? 'bg-[#10B981] text-[#05100C]'
                    : 'bg-[#0D2119] text-slate-300 hover:text-white'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Links Personalizados (.nyctibi.us)</span>
              </button>
            </div>

            <button
              type="button"
              data-no-confirm="true"
              onClick={() => setHubOpen(false)}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 cursor-pointer"
            >
              Fechar 
            </button>
          </div>

          
          {hubSubTab === 'vagas' && (
            <div className="space-y-4">
              {activeEnvironment !== 'colaborador' && (
                <form
                  onSubmit={handleCreateVaga}
                  className="p-3 rounded-xl bg-[#05100C] border border-white/8 grid grid-cols-1 sm:grid-cols-12 gap-2 items-end"
                >
                  <div className="sm:col-span-5">
                    <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                      Nova Vaga / Escala Extra
                    </label>
                    <input
                      type="text"
                      value={novaVagaTitulo}
                      onChange={(e) => setNovaVagaTitulo(e.target.value)}
                      placeholder="Ex: Bartender Sábado, Cozinheiro Extra..."
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#0A1D16] border border-white/10 text-xs text-white"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                      Modalidade
                    </label>
                    <select
                      value={novaVagaModalidade}
                      onChange={(e) => setNovaVagaModalidade(e.target.value as VagaItem['modalidade'])}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#0A1D16] border border-white/10 text-xs text-white"
                    >
                      <option value="Freelancer / Evento">Freelancer / Evento</option>
                      <option value="Colaborador Fixo">Colaborador Fixo</option>
                      <option value="Técnico / Manutenção">Técnico / Manutenção</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                      Cachê / Valor (R$)
                    </label>
                    <input
                      type="number"
                      value={novaVagaValor}
                      onChange={(e) => setNovaVagaValor(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#0A1D16] border border-white/10 text-xs font-mono text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      className="w-full py-1.5 px-3 rounded-lg bg-[#10B981] text-[#05100C] font-bold text-xs inline-flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Publicar</span>
                    </button>
                  </div>
                </form>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {vagas.map((vaga) => (
                  <div
                    key={vaga.id}
                    className="p-3.5 rounded-xl bg-[#05100C] border border-white/10 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] font-mono text-slate-300">
                          {vaga.modalidade}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            vaga.status === 'Preenchida'
                              ? 'bg-[#10B981]/20 text-[#10B981]'
                              : vaga.status === 'Em Negociação'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-sky-500/20 text-sky-300'
                          }`}
                        >
                          {vaga.status}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-white leading-snug">{vaga.titulo}</h4>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">{vaga.unidade}</span>
                        <span className="font-mono font-bold text-[#10B981]">
                          R$ {vaga.valorProposto.toLocaleString('pt-BR')}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400">{vaga.turnoData}</div>

                      <div className="flex flex-wrap gap-1 pt-1">
                        {vaga.requisitosTreinamento.map((req, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.5 rounded bg-[#0A1F17] border border-[#10B981]/30 text-[10px] text-emerald-300"
                          >
                             {req}
                          </span>
                        ))}
                      </div>

                      
                      {vaga.propostas.length > 0 && (
                        <div className="pt-2 border-t border-white/8 space-y-1.5">
                          <div className="text-[10px] font-mono uppercase text-slate-400">
                            Propostas ({vaga.propostas.length})
                          </div>
                          {vaga.propostas.map((prop) => (
                            <div
                              key={prop.id}
                              className="p-2 rounded-lg bg-[#0A1A14] border border-white/8 text-[11px] space-y-1"
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-semibold text-white">
                                  {prop.candidatoNome}
                                </span>
                                <span className="font-mono font-bold text-amber-300">
                                  R$ {prop.valorOferta}
                                </span>
                              </div>
                              <p className="text-slate-400 text-[10px]">{prop.mensagem}</p>
                              <div className="flex items-center justify-between pt-1">
                                <span
                                  className={`text-[10px] font-mono ${
                                    prop.status === 'Aceita'
                                      ? 'text-[#10B981] font-bold'
                                      : 'text-amber-300'
                                  }`}
                                >
                                  {prop.status}
                                </span>
                                {prop.status !== 'Aceita' && (
                                  <button
                                    type="button"
                                    data-no-confirm="true"
                                    onClick={() => handleAcceptProposta(vaga.id, prop.id)}
                                    className="px-2 py-0.5 rounded bg-[#10B981] text-[#05100C] text-[10px] font-bold cursor-pointer"
                                  >
                                     Aceitar Proposta
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    
                    <div className="pt-2 border-t border-white/8 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={propostaValorInput[vaga.id] ?? vaga.valorProposto}
                          onChange={(e) =>
                            setPropostaValorInput((prev) => ({
                              ...prev,
                              [vaga.id]: e.target.value
                            }))
                          }
                          className="w-24 px-2 py-1 rounded bg-[#0A1D16] border border-white/10 text-xs font-mono text-white"
                          title="Valor da proposta (R$)"
                        />
                        <input
                          type="text"
                          value={propostaMsgInput[vaga.id] || ''}
                          onChange={(e) =>
                            setPropostaMsgInput((prev) => ({
                              ...prev,
                              [vaga.id]: e.target.value
                            }))
                          }
                          placeholder={
                            activeEnvironment === 'empresario'
                              ? 'Enviar proposta ao profissional...'
                              : 'Sua disponibilidade / contraproposta...'
                          }
                          className="flex-1 min-w-0 px-2 py-1 rounded bg-[#0A1D16] border border-white/10 text-xs text-white"
                        />
                        <button
                          type="button"
                          data-no-confirm="true"
                          onClick={() => handleSendProposta(vaga.id, vaga.valorProposto)}
                          className="px-2.5 py-1 rounded bg-amber-500 text-slate-950 text-xs font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          <Send className="w-3 h-3" />
                          <span>Propor</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          
          {hubSubTab === 'treinamentos' && (
            <div className="space-y-4">
              {activeEnvironment !== 'colaborador' && (
                <form
                  onSubmit={handleCreateTreinamento}
                  className="p-3 rounded-xl bg-[#05100C] border border-white/8 grid grid-cols-1 sm:grid-cols-12 gap-2 items-end"
                >
                  <div className="sm:col-span-5">
                    <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                      Nova Trilha de Treinamento / Capacitação
                    </label>
                    <input
                      type="text"
                      value={novoTreinTitulo}
                      onChange={(e) => setNovoTreinTitulo(e.target.value)}
                      placeholder="Ex: Padrão de Atendimento & Vinhos..."
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#0A1D16] border border-white/10 text-xs text-white"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                      Setor
                    </label>
                    <input
                      type="text"
                      value={novoTreinSetor}
                      onChange={(e) => setNovoTreinSetor(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#0A1D16] border border-white/10 text-xs text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                      Checklist Vinculado
                    </label>
                    <input
                      type="text"
                      value={novoTreinChecklist}
                      onChange={(e) => setNovoTreinChecklist(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#0A1D16] border border-white/10 text-xs text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      className="w-full py-1.5 px-3 rounded-lg bg-[#10B981] text-[#05100C] font-bold text-xs inline-flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar</span>
                    </button>
                  </div>
                </form>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {treinamentos.map((tr) => {
                  const userLabel = collaboratorSlug || 'Colaborador Ativo';
                  const concluido = tr.concluidoPor.includes(userLabel);
                  return (
                    <div
                      key={tr.id}
                      className="p-3.5 rounded-xl bg-[#05100C] border border-white/10 flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] font-mono text-slate-300">
                            {tr.setor} • {tr.duracaoMin} min
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              concluido
                                ? 'bg-[#10B981]/20 text-[#10B981]'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {concluido ? ' Certificado Emitido' : 'Em Capacitação'}
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-white leading-snug">{tr.titulo}</h4>

                        <div className="text-[11px] text-slate-400">
                          Checklist vinculado:{' '}
                          <strong className="text-slate-200">{tr.checklistVinculado}</strong>
                        </div>

                        <div className="space-y-1 pt-1">
                          {tr.modulos.map((m, idx) => (
                            <div
                              key={idx}
                              className="text-[11px] text-slate-300 flex items-center gap-1.5"
                            >
                              <ChevronRight className="w-3 h-3 text-[#10B981] shrink-0" />
                              <span>{m}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-white/8 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          data-no-confirm="true"
                          onClick={() => onSelectTab('checklists')}
                          className="text-[11px] text-amber-300 hover:underline cursor-pointer"
                        >
                          Abrir Checklist →
                        </button>
                        <button
                          type="button"
                          data-no-confirm="true"
                          onClick={() => handleToggleConcluirTreinamento(tr.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer ${
                            concluido
                              ? 'bg-white/10 text-white'
                              : 'bg-[#10B981] text-[#05100C]'
                          }`}
                        >
                          <Award className="w-3.5 h-3.5" />
                          <span>{concluido ? 'Concluído ' : 'Concluir Capacitação'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          
          {hubSubTab === 'links' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-[#05100C] border border-amber-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300">
                    1. Portal do Empresário & Admin
                  </span>
                  <Building2 className="w-4 h-4 text-amber-400" />
                </div>
                <div className="p-2 rounded bg-[#0A1A14] font-mono text-xs text-white">
                  {companySubdomainSlug || 'tapiri'}.nyctibi.us
                </div>
                <p className="text-[11px] text-slate-400">
                  Pré-carrega a marca e cores da empresa, Fechamento de Caixa Financeiro, Edição de Checklists dos Colaboradores e Gestão de Treinamentos/Vagas.
                </p>
                <button
                  type="button"
                  data-no-confirm="true"
                  onClick={() =>
                    onApplyPresetLink(`${companySubdomainSlug || 'tapiri'}.nyctibi.us`, 'empresario')
                  }
                  className="w-full py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer"
                >
                  Ativar e Pré-Carregar {companySubdomainSlug || 'tapiri'}.nyctibi.us
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-[#05100C] border border-[#10B981]/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300">
                    2. Portal do Colaborador & Freelancer
                  </span>
                  <Users className="w-4 h-4 text-[#10B981]" />
                </div>
                <div className="p-2 rounded bg-[#0A1A14] font-mono text-xs text-white">
                  colaborador.nyctibi.us
                </div>
                <p className="text-[11px] text-slate-400">
                  Pré-carrega o ambiente do colaborador/freelancer com Sistema de Vagas e Propostas, Treinamentos e Capacitações, Checklists do Turno e Rateio.
                </p>
                <button
                  type="button"
                  data-no-confirm="true"
                  onClick={() => onApplyPresetLink('colaborador.nyctibi.us', 'colaborador')}
                  className="w-full py-1.5 rounded-lg bg-[#10B981] text-[#05100C] font-bold text-xs cursor-pointer"
                >
                  Ativar e Pré-Carregar colaborador.nyctibi.us
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-[#05100C] border border-teal-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-300">
                    3. Portal da Equipe Técnica
                  </span>
                  <Wrench className="w-4 h-4 text-teal-400" />
                </div>
                <div className="p-2 rounded bg-[#0A1A14] font-mono text-xs text-white">
                  tecnico.nyctibi.us
                </div>
                <p className="text-[11px] text-slate-400">
                  Pré-carrega o ambiente de engenharia e manutenção: Módulos Isolados Anti-Queda, Servidor VPS/OTA, Banco Offline, Auditoria e Multi-Empresas.
                </p>
                <button
                  type="button"
                  data-no-confirm="true"
                  onClick={() => onApplyPresetLink('tecnico.nyctibi.us', 'tecnico')}
                  className="w-full py-1.5 rounded-lg bg-teal-400 text-slate-950 font-bold text-xs cursor-pointer"
                >
                  Ativar e Pré-Carregar tecnico.nyctibi.us
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
