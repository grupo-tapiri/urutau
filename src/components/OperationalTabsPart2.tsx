import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  ArrowUpRight,
  Lock,
  Unlock,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  CheckSquare,
  Square,
  Globe,
  RefreshCw,
  Copy,
  Check,
  Database,
  Server,
  Eye,
  Edit3,
  User,
  Users,
  Globe2,
  Trash2,
  AlertTriangle,
  Building2,
  ShieldCheck,
  Zap,
  Upload,
  Palette,
  Sliders,
  Download,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  FolderPlus,
  EyeOff,
  PanelLeft,
  PanelBottom,
  Terminal,
  HardDrive,
  Sparkles,
  MapPin,
  Clock
} from 'lucide-react';
import { CommonTabProps } from './OperationalTabsPart1';
import { ZeroTrustGovernancePanel } from './ZeroTrustGovernancePanel';
import {
  BrandIdentityConfig,
  CustomTabOverride,
  DEFAULT_CATEGORIES,
  DEFAULT_SECURITY_GEOFENCE_TURNO_CONFIG,
  DEFAULT_TAB_META,
  MENU_SYMBOL_COLOR_PALETTE,
  NaturezaCadastro,
  NavCategory,
  PapelCadastro,
  SecurityGeofenceTurnoConfig,
  TabId
} from '../types/erp';
import { EmpresasTab, FreelancersTab } from './MultiCompanyTabs';
import {
  AVAILABLE_MENU_ICONS,
  CestariaGrafismoSVG,
  CircularGaugeSVG,
  FocusFormModal,
  TabIconSVG,
  TriangularRGBPicker,
  UrutauDateMultiView,
  UrutauDefaultPosesGallery,
  UrutauEmblemSVG,
  UrutauSlotImageManager,
  UrutauUnusedGallerySection,
  UrutauValidatedCityStateSelector,
  VisualAvatar,
  blendCompanyWithUrutau,
  extractColorsFromLogoImage,
  hexToRgb,
  isGestorEmpresaUser,
  isSubordinadoDoGestor,
  isSuperAdminUser,
  podeMudarAparenciaSistema,
  resolverWhatsappInteligente,
  BackgroundBrightnessControlPanel,
  DEFAULT_ADMIN_MASTER_BRIGHTNESS,
  SystemSlotImage,
  UrutauClientErrorLogEntry
} from './UrutauShared';

export const MODULOS_CONFIG_PERMISSOES = [
  { id: 'rateio', label: 'Rateio 10%', desc: 'Apuração e rateio diário de produtividade' },
  { id: 'escalas', label: 'Escalas', desc: 'Matriz semanal fixa, folgas e reforços' },
  { id: 'agenda', label: 'Agenda / Tarefas', desc: 'Calendário e briefing diário' },
  { id: 'reservas', label: 'Reservas de Salão', desc: 'Mapa de mesas, adultos e kids' },
  { id: 'portais', label: 'Portais Externos', desc: 'Sistemas e links integrados' },
  { id: 'chat', label: 'WhatsApp Web', desc: 'Atendimento aos clientes via web' },
  { id: 'caixa', label: 'Livro Caixa', desc: 'Entradas, saídas e sangrias' },
  { id: 'estoque', label: 'Estoque & Compras', desc: 'Insumos, custos, ponto de pedido e reposição' },
  { id: 'cmv', label: 'CMV', desc: 'Custo da mercadoria vendida' },
  { id: 'cadastros', label: 'Cadastros Unificados', desc: 'PF/PJ, clientes, fornecedores, equipe e gestores' },
  { id: 'equipe', label: 'Equipe', desc: 'Gestão de colaboradores e turnos' },
  { id: 'rh', label: 'RH & Seleção', desc: 'Prontuários ocupacionais, SST e Ambiente de Seleção de Colaboradores' },
  { id: 'unidades', label: 'Unidades', desc: 'Unidades operacionais' },
  { id: 'setores', label: 'Setores', desc: 'Setores e praças de atendimento' },
  { id: 'checklists', label: 'Checklists', desc: 'Rotinas e inspeções' },
  { id: 'notificacoes', label: 'Notificações', desc: 'Alertas e programações' },
  { id: 'auditoria', label: 'Audit Logs', desc: 'Trilha de auditoria de acessos, permissões e dados' },
  { id: 'permissoes', label: 'Menu Permissões', desc: 'Permissão para ver e operar o menu individual de Permissões' },
  { id: 'config', label: 'Aparência & Marca', desc: 'Logo e cores da empresa no sistema' }
];

const DIAS_SEMANA = [
  { idx: 0, curto: 'Dom' },
  { idx: 1, curto: 'Seg' },
  { idx: 2, curto: 'Ter' },
  { idx: 3, curto: 'Qua' },
  { idx: 4, curto: 'Qui' },
  { idx: 5, curto: 'Sex' },
  { idx: 6, curto: 'Sáb' }
];

const ETAPAS_SELECAO = [
  { num: 1, titulo: '1. Anúncio & Captação' },
  { num: 2, titulo: '2. Triagem Curricular' },
  { num: 3, titulo: '3. Entrevista Prática' },
  { num: 4, titulo: '4. Documentação & ASO' },
  { num: 5, titulo: '5. Contratado (Auto-Equipe)' }
];

const PILARES_RH_NR01 = [
  'NR-01 & Riscos',
  'Segurança & EPI',
  'Capacitação',
  'Feedback 1:1',
  'Investimento Pessoal',
  'Ponto Portaria 671',
  'Onboarding & Admissão',
  'Benefícios & Vales',
  'Férias & Licenças',
  'Reconhecimento & Clima',
  'Gestão Disciplinar'
];

function getTodayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function formatBRL(val: number): string {
  return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function CMVTab({ data, onRefresh, showAlert, showConfirm }: CommonTabProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const valorEstoqueAtual = useMemo(() => {
    return data.estoque.reduce(
      (acc, item) => acc + Number(item.quantidade || 0) * Number(item.custo_unitario || 0),
      0
    );
  }, [data.estoque]);

  const faturamentoHoje = useMemo(() => {
    return data.caixa
      .filter((c) => c.tipo === 'Entrada')
      .reduce((acc, c) => acc + Number(c.valor || 0), 0);
  }, [data.caixa]);

  const comprasHoje = useMemo(() => {
    return data.caixa
      .filter((c) => c.tipo === 'Saída')
      .reduce((acc, c) => acc + Number(c.valor || 0), 0);
  }, [data.caixa]);

  const [form, setForm] = useState<any>({
    id: null,
    data: getTodayISO(),
    unidade_id: 1,
    estoque_inicial: 18400,
    compras_periodo: comprasHoje || 3380,
    estoque_final: Number(valorEstoqueAtual.toFixed(2)) || 16650,
    faturamento: faturamentoHoje || 17871
  });

  const cmvCalculado = Math.max(
    0,
    Number(form.estoque_inicial || 0) +
      Number(form.compras_periodo || 0) -
      Number(form.estoque_final || 0)
  );
  const percCalculado =
    Number(form.faturamento || 0) > 0
      ? (cmvCalculado / Number(form.faturamento)) * 100
      : 0;

  const handleSave = async () => {
    try {
      const res = await fetch('/api/v20/cmv/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          custo_insumos: cmvCalculado
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || 'Erro ao gravar apuração de CMV');
      setModalOpen(false);
      await onRefresh();
    } catch (e: any) {
      showAlert('Erro no CMV', e.message);
    }
  };

  const handleArchive = (id: number) => {
    showConfirm('Arquivar Apuração de CMV', 'Confirma o arquivamento lógico deste registro de CMV?', async () => {
      await fetch('/api/erp/arquivar-generico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, tabelaAlvo: 'erp_cmv' })
      });
      setModalOpen(false);
      await onRefresh();
    });
  };

  return (
    <div className="space-y-6 w-full">
      <div className="bg-[#11151E] border border-slate-800/90 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-slate-100">
            CMV
          </h2>
          <button
            type="button"
            onClick={() => {
              setForm({
                id: null,
                data: getTodayISO(),
                unidade_id: 1,
                estoque_inicial: 18400,
                compras_periodo: comprasHoje || 3380,
                estoque_final: Number(valorEstoqueAtual.toFixed(2)) || 16650,
                faturamento: faturamentoHoje || 17871
              });
              setModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Apuração de CMV</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800">
          <div className="p-3.5 bg-[#0B0D11] border border-slate-800 rounded flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">Estoque Imobilizado</div>
              <div className="text-base font-mono font-bold text-slate-100 tabular-nums">
                {formatBRL(valorEstoqueAtual)}
              </div>
            </div>
            <CircularGaugeSVG percent={68} label="EST" colorHex="#10B981" size={44} />
          </div>
          <div className="p-3.5 bg-[#0B0D11] border border-slate-800 rounded flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">Faturamento Caixa</div>
              <div className="text-base font-mono font-bold text-emerald-400 tabular-nums">
                {formatBRL(faturamentoHoje)}
              </div>
            </div>
            <CircularGaugeSVG percent={85} label="FAT" colorHex="#10B981" size={44} />
          </div>
          <div className="p-3.5 bg-[#0B0D11] border border-amber-500/30 rounded flex items-center justify-between">
            <div>
              <div className="text-xs text-amber-300">Meta Técnica CMV</div>
              <div className="text-base font-mono font-bold text-amber-400 tabular-nums">
                26% – 32%
              </div>
            </div>
            <CircularGaugeSVG percent={29} label="29%" colorHex="#F59E0B" size={44} />
          </div>
        </div>
      </div>

      <UrutauDateMultiView
        title="Apurações de CMV por Data (Lista, Kanban da Semana & Calendário do Mês)"
        items={data.cmv || []}
        getDateISO={(c: any) => c.data}
        getTitle={(c: any) =>
          `CMV: ${formatBRL(c.custo_insumos)} (${Number(c.percentual_cmv).toFixed(1)}%) • Fat: ${formatBRL(c.faturamento)}`
        }
        getSubtitle={(c: any) =>
          `Est. Inicial: ${formatBRL(c.estoque_inicial)} + Compras: ${formatBRL(c.compras_periodo)} - Est. Final: ${formatBRL(c.estoque_final)}`
        }
        getBadge={(c: any) => {
          const okMeta = Number(c.percentual_cmv) <= 32;
          return {
            text: `${Number(c.percentual_cmv).toFixed(1)}% CMV`,
            colorClass: okMeta ? 'text-emerald-400' : 'text-rose-400'
          };
        }}
        getRightMeta={(c: any) => formatBRL(c.custo_insumos)}
        onEditItem={(c: any) => {
          setForm({ ...c });
          setModalOpen(true);
        }}
        onCreateAtDate={(iso: string) => {
          setForm({
            id: null,
            data: iso,
            unidade_id: 1,
            estoque_inicial: 18400,
            compras_periodo: comprasHoje || 3380,
            estoque_final: Number(valorEstoqueAtual.toFixed(2)) || 16650,
            faturamento: faturamentoHoje || 17871
          });
          setModalOpen(true);
        }}
        createButtonLabel="Nova Apuração CMV"
      />

      <FocusFormModal
        open={modalOpen}
        title={form.id ? 'Editar Apuração de CMV' : 'Nova Apuração de CMV'}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onArchive={form.id ? () => handleArchive(form.id) : undefined}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Data de Referência</label>
            <input
              type="date"
              value={form.data}
              onChange={(e) => setForm({ ...form, data: e.target.value })}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs font-mono text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Faturamento do Período (R$)</label>
            <input
              type="number"
              step="0.01"
              value={form.faturamento}
              onChange={(e) => setForm({ ...form, faturamento: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs font-mono text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Estoque Inicial (R$)</label>
            <input
              type="number"
              step="0.01"
              value={form.estoque_inicial}
              onChange={(e) => setForm({ ...form, estoque_inicial: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs font-mono text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Compras no Período (R$)</label>
            <input
              type="number"
              step="0.01"
              value={form.compras_periodo}
              onChange={(e) => setForm({ ...form, compras_periodo: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs font-mono text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Estoque Final Contado (R$)</label>
            <input
              type="number"
              step="0.01"
              value={form.estoque_final}
              onChange={(e) => setForm({ ...form, estoque_final: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs font-mono text-slate-100"
            />
          </div>
          <div className="p-3 bg-[#0B0D11] border border-amber-500/30 rounded flex flex-col justify-center">
            <div className="text-[11px] text-slate-400">CMV Apurado Automaticamente</div>
            <div className="text-sm font-mono font-bold text-amber-400 tabular-nums">
              {formatBRL(cmvCalculado)} ({percCalculado.toFixed(2)}%)
            </div>
          </div>
        </div>
      </FocusFormModal>
    </div>
  );
}

export function EquipeTab({
  data,
  onRefresh,
  onNavigateDeepLink,
  showAlert,
  showConfirm,
  deepLinkEntityId,
  clearDeepLink,
  currentUser,
  onSwitchCurrentUser
}: CommonTabProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [filtroHierarquia, setFiltroHierarquia] = useState<'todos' | 'subordinados' | 'gestores'>('todos');
  const [form, setForm] = useState<any>({
    id: null,
    nome: '',
    telefone: '',
    tipo: 'Colaborador',
    cargo: '',
    senha: '',
    gestor_id: null,
    empresas_ids: [1],
    escalaFixa: [1, 2, 3, 4, 5],
    unidadesIds: [1],
    setoresIds: [1],
    checklistsIds: [1],
    permissoes: {}
  });
  const [criandoSetorEquipe, setCriandoSetorEquipe] = useState(false);
  const [novoSetorNomeEquipe, setNovoSetorNomeEquipe] = useState('');
  const [novoSetorPesoEquipe, setNovoSetorPesoEquipe] = useState('1.0');
  const [salvandoSetorEquipe, setSalvandoSetorEquipe] = useState(false);

  const [criandoUnidadeEquipe, setCriandoUnidadeEquipe] = useState(false);
  const [novaUnidadeNomeEquipe, setNovaUnidadeNomeEquipe] = useState('');
  const [salvandoUnidadeEquipe, setSalvandoUnidadeEquipe] = useState(false);

  const [criandoChecklistEquipe, setCriandoChecklistEquipe] = useState(false);
  const [novoChecklistTituloEquipe, setNovoChecklistTituloEquipe] = useState('');
  const [salvandoChecklistEquipe, setSalvandoChecklistEquipe] = useState(false);

  const handleCriarSetorInlineEquipe = async () => {
    const nome = novoSetorNomeEquipe.trim();
    if (!nome) {
      showAlert('Nome do Setor', 'Informe o nome do novo setor para vinculá-lo ao colaborador.');
      return;
    }
    setSalvandoSetorEquipe(true);
    try {
      const res = await fetch('/api/setores/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          peso_gorjeta: Number(novoSetorPesoEquipe) || 1.0,
          usuario_logado_id: currentUser?.id
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || 'Erro ao criar setor');
      await onRefresh();
      const novoId = Number(json.id);
      setForm((prev: any) => ({
        ...prev,
        setoresIds: prev.setoresIds.includes(novoId) ? prev.setoresIds : [...prev.setoresIds, novoId]
      }));
      setNovoSetorNomeEquipe('');
      setNovoSetorPesoEquipe('1.0');
      setCriandoSetorEquipe(false);
    } catch (e: any) {
      showAlert('Erro ao Criar Setor', e.message);
    } finally {
      setSalvandoSetorEquipe(false);
    }
  };

  const handleCriarUnidadeInlineEquipe = async () => {
    const nome = novaUnidadeNomeEquipe.trim();
    if (!nome) {
      showAlert('Nome da Unidade', 'Informe o nome da nova unidade para vinculá-la ao colaborador.');
      return;
    }
    setSalvandoUnidadeEquipe(true);
    try {
      const res = await fetch('/api/unidades/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          cnpj: '',
          cidade: 'Belém - PA',
          usuario_logado_id: currentUser?.id
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || 'Erro ao criar unidade');
      await onRefresh();
      const novoId = Number(json.id);
      setForm((prev: any) => ({
        ...prev,
        unidadesIds: prev.unidadesIds.includes(novoId) ? prev.unidadesIds : [...prev.unidadesIds, novoId]
      }));
      setNovaUnidadeNomeEquipe('');
      setCriandoUnidadeEquipe(false);
    } catch (e: any) {
      showAlert('Erro ao Criar Unidade', e.message);
    } finally {
      setSalvandoUnidadeEquipe(false);
    }
  };

  const handleCriarChecklistInlineEquipe = async () => {
    const titulo = novoChecklistTituloEquipe.trim();
    if (!titulo) {
      showAlert('Título do Checklist', 'Informe o título do novo checklist para vinculá-lo ao colaborador.');
      return;
    }
    setSalvandoChecklistEquipe(true);
    try {
      const res = await fetch('/api/checklists/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo,
          setor_id: form.setoresIds?.[0] || data.setores?.[0]?.id || 1,
          horario_limite: '18:00',
          itens: [{ id: 1, texto: 'Verificar conformidade inicial do setor', obrigatorio: true, concluido: false }],
          usuario_logado_id: currentUser?.id
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || 'Erro ao criar checklist');
      await onRefresh();
      const novoId = Number(json.id);
      setForm((prev: any) => ({
        ...prev,
        checklistsIds: prev.checklistsIds.includes(novoId) ? prev.checklistsIds : [...prev.checklistsIds, novoId]
      }));
      setNovoChecklistTituloEquipe('');
      setCriandoChecklistEquipe(false);
    } catch (e: any) {
      showAlert('Erro ao Criar Checklist', e.message);
    } finally {
      setSalvandoChecklistEquipe(false);
    }
  };

  const gestoresDisponiveis = useMemo(() => {
    return (data.usuarios || []).filter((u) => {
      if (!isSuperAdminUser(currentUser) && isSuperAdminUser(u)) return false;
      const empAtiva = Number(data.empresaAtivaId || 1);
      const empIds = Array.isArray(u.empresas_ids) ? u.empresas_ids.map(Number) : [1];
      if (!isSuperAdminUser(currentUser) && !empIds.includes(empAtiva)) return false;
      return isSuperAdminUser(u) || isGestorEmpresaUser(u);
    });
  }, [data.usuarios, currentUser, data.empresaAtivaId]);

  const usuariosFiltrados = useMemo(() => {
    const lista = (data.usuarios || []).filter((u) => {
      if (!isSuperAdminUser(currentUser) && isSuperAdminUser(u)) return false;
      const empAtiva = Number(data.empresaAtivaId || 1);
      const empIds = Array.isArray(u.empresas_ids) ? u.empresas_ids.map(Number) : [1];
      if (!isSuperAdminUser(currentUser) && !empIds.includes(empAtiva)) return false;
      return true;
    });
    if (filtroHierarquia === 'subordinados') {
      return lista.filter((u) => isSubordinadoDoGestor(currentUser, u, data.empresaAtivaId));
    }
    if (filtroHierarquia === 'gestores') {
      return lista.filter((u) => isGestorEmpresaUser(u) || (isSuperAdminUser(currentUser) && isSuperAdminUser(u)));
    }
    return lista;
  }, [data.usuarios, filtroHierarquia, currentUser, data.empresaAtivaId]);

  const abrirModalUnicoColaborador = (u?: any) => {
    if (u) {
      if (!isSuperAdminUser(currentUser) && isSuperAdminUser(u)) {
        showAlert(
          'Acesso Restrito ao Super Admin',
          'Gestores da empresa podem definir permissões de seus subordinados, mas não podem alterar a conta Super Admin.'
        );
        return;
      }
      const esc = data.escalaFixa[u.id] || [1, 2, 3, 4, 5];
      const uIds = (data.relacionamentos.rel_usuario_unidade || [])
        .filter((r) => Number(r.usuario_id) === Number(u.id))
        .map((r) => Number(r.unidade_id));
      const sIds = (data.relacionamentos.rel_usuario_setor || [])
        .filter((r) => Number(r.usuario_id) === Number(u.id))
        .map((r) => Number(r.setor_id));
      const cIds = (data.relacionamentos.rel_usuario_checklist || [])
        .filter((r) => Number(r.usuario_id) === Number(u.id))
        .map((r) => Number(r.checklist_id));

      setForm({
        id: u.id,
        nome: u.nome,
        telefone: u.telefone || '',
        tipo: u.tipo || 'Colaborador',
        cargo: u.cargo || '',
        senha: '',
        gestor_id: u.gestor_id ?? (isGestorEmpresaUser(currentUser) ? currentUser.id : null),
        empresas_ids:
          Array.isArray(u.empresas_ids) && u.empresas_ids.length > 0
            ? u.empresas_ids.map(Number)
            : [Number(data.empresaAtivaId || 1)],
        escalaFixa: esc,
        unidadesIds: uIds,
        setoresIds: sIds,
        checklistsIds: cIds,
        permissoes: u.permissoes_json || {},
        escopoColaboradores: u.permissoes_json?.escopo_colaboradores || 'todos'
      });
    } else {
      setForm({
        id: null,
        nome: '',
        telefone: '',
        tipo: 'Colaborador',
        cargo: '',
        senha: '',
        gestor_id: currentUser?.id || 2,
        empresas_ids: [Number(data.empresaAtivaId || currentUser?.empresas_ids?.[0] || 1)],
        escalaFixa: [2, 3, 4, 5, 6, 0],
        unidadesIds: [data.unidades[0]?.id || 1],
        setoresIds: [data.setores[0]?.id || 1],
        checklistsIds: [],
        permissoes: {},
        escopoColaboradores: 'todos'
      });
    }
    setModalOpen(true);
  };

  useEffect(() => {
    if (deepLinkEntityId) {
      const alvo = data.usuarios.find((u) => Number(u.id) === Number(deepLinkEntityId));
      if (alvo) {
        abrirModalUnicoColaborador(alvo);
      }
      clearDeepLink();
    }
  }, [deepLinkEntityId, data.usuarios, clearDeepLink]);

  const toggleItemInList = (list: number[], id: number) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const handleToggleFormModuloPerm = (modId: string, campo: 'ver' | 'editar') => {
    const isMaster = form.tipo === 'Super Admin' || form.permissoes?.total;
    const currentModulos = form.permissoes?.modulos || {};
    const modConfig = currentModulos[modId] || {
      ver: isMaster || !!form.permissoes?.[modId],
      editar: isMaster || !!form.permissoes?.[modId],
      escopo: 'todos'
    };

    let novoVer = modConfig.ver;
    let novoEditar = modConfig.editar;
    if (campo === 'ver') {
      novoVer = !modConfig.ver;
      if (!novoVer) novoEditar = false;
    } else {
      novoEditar = !modConfig.editar;
      if (novoEditar) novoVer = true;
    }

    setForm({
      ...form,
      permissoes: {
        ...(form.permissoes || {}),
        total: false,
        modulos: {
          ...currentModulos,
          [modId]: {
            ver: novoVer,
            editar: novoEditar,
            escopo: modConfig.escopo || 'todos'
          }
        },
        [modId]: novoVer
      }
    });
  };

  const handleAlterarFormModuloEscopo = (
    modId: string,
    novoEscopo: 'todos' | 'subordinados' | 'pessoal'
  ) => {
    const isMaster = form.tipo === 'Super Admin' || form.permissoes?.total;
    const currentModulos = form.permissoes?.modulos || {};
    const modConfig = currentModulos[modId] || {
      ver: isMaster || !!form.permissoes?.[modId],
      editar: isMaster || !!form.permissoes?.[modId],
      escopo: 'todos'
    };

    setForm({
      ...form,
      permissoes: {
        ...(form.permissoes || {}),
        total: false,
        modulos: {
          ...currentModulos,
          [modId]: {
            ...modConfig,
            escopo: novoEscopo
          }
        }
      }
    });
  };

  const handleSave = async () => {
    try {
      const isGestorTipo =
        form.tipo === 'Empresário' || form.tipo === 'Gerente' || form.tipo === 'Gestor';
      const permissoesAtualizadas = {
        ...(form.permissoes || {}),
        gerenciar_subordinados:
          form.permissoes?.gerenciar_subordinados !== undefined
            ? Boolean(form.permissoes.gerenciar_subordinados)
            : isGestorTipo,
        mudar_aparencia:
          form.permissoes?.mudar_aparencia !== undefined
            ? Boolean(form.permissoes.mudar_aparencia)
            : isGestorTipo
      };
      const res = await fetch('/api/acessos/salvar-completo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          gestor_id: form.gestor_id ? Number(form.gestor_id) : null,
          empresas_ids: Array.isArray(form.empresas_ids) ? form.empresas_ids.map(Number) : [1],
          permissoes: permissoesAtualizadas
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || 'Erro ao salvar colaborador no Modal Único');
      setModalOpen(false);
      await onRefresh();
    } catch (e: any) {
      showAlert('Erro no Cadastro da Equipe', e.message);
    }
  };

  const handleArchive = (id: number) => {
    showConfirm(
      'Arquivar Colaborador',
      'Confirma o arquivamento deste colaborador preservando o histórico operacional?',
      async () => {
        await fetch('/api/acessos/excluir-usuario', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        });
        setModalOpen(false);
        await onRefresh();
      }
    );
  };

  return (
    <div className="space-y-6 w-full">
      <div className="bg-[#11151E] border border-slate-800/90 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h2 className="text-base font-semibold text-slate-100">
            Equipe & Governança de Subordinados
          </h2>
          <p className="text-xs text-slate-400">
            Os gestores da empresa podem definir as permissões dos subordinados e personalizar a aparência do sistema.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="flex flex-wrap items-center gap-1 bg-[#0B0D11] p-1 rounded-lg border border-slate-800">
            {[
              { id: 'todos', label: ` Todos (${data.usuarios.length})` },
              {
                id: 'subordinados',
                label: ` Subordinados (${
                  data.usuarios.filter((u) =>
                    isSubordinadoDoGestor(currentUser, u, data.empresaAtivaId)
                  ).length
                })`
              },
              {
                id: 'gestores',
                label: ` Gestores (${
                  data.usuarios.filter(
                    (u) =>
                      (!isSuperAdminUser(u) && Number(u.id) !== 1 && isGestorEmpresaUser(u)) ||
                      (isSuperAdminUser(currentUser) && isSuperAdminUser(u))
                  ).length
                })`
              }
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltroHierarquia(f.id as any)}
                className={`px-2.5 py-1.5 rounded text-xs font-semibold transition-all cursor-pointer ${
                  filtroHierarquia === f.id
                    ? 'bg-[#10B981] text-[#04120C] font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {podeMudarAparenciaSistema(currentUser) && (
            <button
              type="button"
              onClick={() => onNavigateDeepLink({ tab: 'config' })}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#10B981] bg-[#10B981]/15 hover:bg-[#10B981]/25 border border-[#10B981]/40 rounded min-h-[42px] cursor-pointer"
            >
              <Palette className="w-3.5 h-3.5 shrink-0" />
              <span>Aparência & Permissões</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => abrirModalUnicoColaborador()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded min-h-[42px] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span>Novo Colaborador</span>
          </button>
        </div>
      </div>

      
      <div className="bg-[#11151E] border border-slate-800/90 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-[#0D1017] text-[11px] font-mono uppercase text-slate-400">
                <th className="py-3 px-4">ID / Nome</th>
                <th className="py-3 px-4">Cargo / Hierarquia</th>
                <th className="py-3 px-4">WhatsApp</th>
                <th className="py-3 px-4">Unidades & Setores</th>
                <th className="py-3 px-4">Escala Semanal Fixa</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {usuariosFiltrados.map((u) => {
                const esc = data.escalaFixa[u.id] || [];
                const uIds = (data.relacionamentos.rel_usuario_unidade || [])
                  .filter((r) => Number(r.usuario_id) === Number(u.id))
                  .map((r) => data.unidades.find((un) => Number(un.id) === Number(r.unidade_id))?.nome)
                  .filter(Boolean);
                const sIds = (data.relacionamentos.rel_usuario_setor || [])
                  .filter((r) => Number(r.usuario_id) === Number(u.id))
                  .map((r) => data.setores.find((st) => Number(st.id) === Number(r.setor_id))?.nome)
                  .filter(Boolean);
                const gestorDireto = data.usuarios.find((g) => Number(g.id) === Number(u.gestor_id));
                const ehSubordinado = isSubordinadoDoGestor(currentUser, u, data.empresaAtivaId);

                return (
                  <tr
                    key={u.id}
                    onClick={() => abrirModalUnicoColaborador(u)}
                    className="hover:bg-slate-800/30 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <VisualAvatar name={u.nome} role={u.cargo} size="sm" />
                        <div>
                          <div className="font-semibold text-slate-100 flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-amber-400">#{u.id}</span>
                            <span>{u.nome}</span>
                            {ehSubordinado && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                                 Subordinado
                              </span>
                            )}
                          </div>
                          {gestorDireto && (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Gestor: <span className="text-slate-300 font-medium">{gestorDireto.nome}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-slate-200">{u.cargo}</span>
                        <span className="text-slate-600">·</span>
                        <span className="font-mono text-amber-400">{u.tipo}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        {isGestorEmpresaUser(u) && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">
                             Define Subordinados
                          </span>
                        )}
                        {podeMudarAparenciaSistema(u) && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-500/15 text-purple-300 border border-purple-500/30">
                             Muda Aparência
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-300">{u.telefone || '—'}</td>
                    <td className="py-2.5 px-4">
                      <div className="flex flex-wrap items-center gap-1">
                        {uIds.length > 0 ? (
                          uIds.map((unName, idx) => (
                            <span
                              key={`un-${idx}`}
                              className="px-2 py-0.5 rounded text-[10px] font-mono tag-acai-nn"
                            >
                              {unName}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                        {sIds.map((stName, idx) => (
                          <span
                            key={`st-${idx}`}
                            className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/35"
                          >
                            {stName}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 font-mono">
                      <div className="inline-flex items-center gap-1">
                        {DIAS_SEMANA.map((d) => {
                          const ativo = esc.includes(d.idx);
                          return (
                            <span
                              key={d.idx}
                              title={d.curto}
                              className={`w-5 h-5 rounded-full text-[10px] font-bold inline-flex items-center justify-center ${
                                ativo
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                  : 'bg-slate-900/60 text-slate-600 border border-slate-800'
                              }`}
                            >
                              {d.curto[0]}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-2">
                        {onSwitchCurrentUser &&
                          Number(currentUser?.id) !== Number(u.id) &&
                          !isSuperAdminUser(u) &&
                          (isSuperAdminUser(currentUser) ||
                            (isGestorEmpresaUser(currentUser) &&
                              isSubordinadoDoGestor(currentUser, u, data.empresaAtivaId))) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSwitchCurrentUser(u);
                              }}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40 hover:bg-[#10B981] hover:text-[#05100C] transition-colors cursor-pointer"
                              title="Interagir com o sistema na visão e permissões deste colaborador"
                            >
                               Assumir Visão
                            </button>
                          )}
                        <span className="text-amber-400 font-medium hover:underline">
                          Permissões & Dados
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      
      <FocusFormModal
        open={modalOpen}
        title={
          form.id
            ? `Cadastro do Colaborador — ${form.nome}`
            : 'Novo Colaborador'
        }
        subtitle="Dados cadastrais, escala fixa e permissões individuais por função"
        maxWidthClass="max-w-4xl"
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onArchive={
          form.id &&
          Number(form.id) !== 1 &&
          Number(form.id) !== Number(currentUser?.id)
            ? () => handleArchive(form.id)
            : undefined
        }
      >
        <div className="mb-3 p-3 rounded-xl bg-[#071712] border border-[#10B981]/35 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div>
            <span className="text-slate-400">Conta logada agora:</span>{' '}
            <strong className="text-[#10B981]">{currentUser?.nome || 'Operador'}</strong>
          </div>
          <div>
            <span className="text-slate-400">Ficha sendo editada:</span>{' '}
            <strong className="text-white">{form.nome || 'Novo Colaborador'}</strong>
            {form.id && Number(form.id) === Number(currentUser?.id) && (
              <span className="ml-2 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                Seu Próprio Cadastro (Protegido Contra Arquivamento)
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Nome Completo do Colaborador</label>
            <input
              type="text"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Cargo / Função Operacional</label>
            <input
              type="text"
              value={form.cargo}
              onChange={(e) => setForm({ ...form, cargo: e.target.value })}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Telefone / WhatsApp</label>
            <input
              type="text"
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs font-mono text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Perfil de Governança</label>
            <select
              value={form.tipo}
              onChange={(e) => {
                const novoTipo = e.target.value;
                const isGestor =
                  novoTipo === 'Empresário' || novoTipo === 'Gerente' || novoTipo === 'Gestor';
                const isAutonomo = novoTipo === 'Autônomo' || novoTipo === 'Freelancer';
                setForm({
                  ...form,
                  tipo: novoTipo,
                  gestor_id: isAutonomo ? null : form.gestor_id,
                  permissoes: {
                    ...(form.permissoes || {}),
                    gerenciar_subordinados: isGestor
                      ? true
                      : Boolean(form.permissoes?.gerenciar_subordinados),
                    mudar_aparencia: isGestor ? true : Boolean(form.permissoes?.mudar_aparencia)
                  }
                });
              }}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
            >
              <option value="Colaborador">Colaborador (Subordinado)</option>
              <option value="Autônomo">Autônomo / Independente (Sem Gestor Superior)</option>
              <option value="Freelancer">Freelancer / Prestador Independente</option>
              <option value="Gerente">Gerente / Gestor de Equipe</option>
              <option value="Empresário">Empresário / Gestor da Empresa</option>
              {isSuperAdminUser(currentUser) && (
                <option value="Super Admin">Super Admin</option>
              )}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Gestor Direto Responsável (Hierarquia)
            </label>
            <select
              value={form.gestor_id ?? ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  gestor_id: e.target.value ? Number(e.target.value) : null
                })
              }
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
            >
              <option value="">Sem Gestor Superior / Autônomo (Independente / Topo)</option>
              {gestoresDisponiveis
                .filter((g) => Number(g.id) !== Number(form.id))
                .map((g) => (
                  <option key={g.id} value={g.id}>
                     {g.nome} ({g.cargo || g.tipo})
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Credencial / Senha de Acesso
            </label>
            <input
              type="password"
              value={form.senha}
              onChange={(e) => setForm({ ...form, senha: e.target.value })}
              placeholder={
                form.id
                  ? 'Deixe em branco para manter a senha atual'
                  : 'Digite a senha de acesso do colaborador'
              }
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs font-mono text-slate-100"
            />
          </div>
          <div className="sm:col-span-2 p-3.5 rounded-lg bg-[#0B0D11] border border-[#10B981]/30 space-y-2.5">
            <div className="text-xs font-bold text-[#10B981] uppercase tracking-wider">
              Privilégios de Gestão da Empresa & Aparência do Sistema
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[#11151E] border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={
                    form.tipo === 'Empresário' ||
                    form.tipo === 'Gerente' ||
                    form.tipo === 'Super Admin' ||
                    Boolean(form.permissoes?.gerenciar_subordinados)
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      permissoes: {
                        ...(form.permissoes || {}),
                        gerenciar_subordinados: e.target.checked
                      }
                    })
                  }
                  className="mt-0.5 w-4 h-4 accent-[#10B981]"
                />
                <div className="text-xs">
                  <div className="font-bold text-slate-100">
                     Definir Permissões dos Subordinados
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Permite configurar o que cada subordinado desta empresa pode ver e editar.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[#11151E] border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={
                    form.tipo === 'Empresário' ||
                    form.tipo === 'Gerente' ||
                    form.tipo === 'Super Admin' ||
                    Boolean(form.permissoes?.mudar_aparencia)
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      permissoes: {
                        ...(form.permissoes || {}),
                        mudar_aparencia: e.target.checked
                      }
                    })
                  }
                  className="mt-0.5 w-4 h-4 accent-[#10B981]"
                />
                <div className="text-xs">
                  <div className="font-bold text-slate-100">
                     Mudar a Aparência do Sistema
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Permite alterar logo, cores da empresa, grupos do menu e ícones do sistema.
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>

        
        <div className="p-4 bg-[#0B0D11] border border-slate-800 rounded-lg space-y-3">
          <div>
            <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              Permissões e Escopo Individual por Função
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Defina para cada função individualmente se este colaborador pode visualizar, editar e de quem ele vê os dados:
            </p>
          </div>
          <div className="max-h-64 overflow-y-auto overflow-x-auto border border-slate-800 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-[#121622] text-[10px] font-mono uppercase text-slate-400 sticky top-0">
                  <th className="py-2 px-2.5">Função</th>
                  <th className="py-2 px-2 text-center">Ver</th>
                  <th className="py-2 px-2 text-center">Editar</th>
                  <th className="py-2 px-2.5">Escopo desta Função</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-[#0E121B]">
                {MODULOS_CONFIG_PERMISSOES.map((mod) => {
                  const isMaster = form.tipo === 'Super Admin' || form.permissoes?.total;
                  const modPerm = form.permissoes?.modulos?.[mod.id] || {
                    ver: isMaster || !!form.permissoes?.[mod.id],
                    editar: isMaster || !!form.permissoes?.[mod.id],
                    escopo: 'todos'
                  };
                  const podeVer = isMaster || modPerm.ver;
                  const podeEditar = isMaster || modPerm.editar;
                  const escopoMod = modPerm.escopo || 'todos';

                  return (
                    <tr key={mod.id} className="hover:bg-slate-800/30">
                      <td className="py-2 px-2.5 font-medium text-slate-200">{mod.label}</td>
                      <td className="py-2 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={podeVer}
                          onChange={() => handleToggleFormModuloPerm(mod.id, 'ver')}
                          className="w-4 h-4 accent-amber-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={podeEditar}
                          onChange={() => handleToggleFormModuloPerm(mod.id, 'editar')}
                          className="w-4 h-4 accent-amber-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-2 px-2.5">
                        <select
                          value={escopoMod}
                          disabled={!podeVer}
                          onChange={(e) =>
                            handleAlterarFormModuloEscopo(
                              mod.id,
                              e.target.value as 'todos' | 'subordinados' | 'pessoal'
                            )
                          }
                          className="w-full px-2 py-1 rounded text-[11px] bg-[#121622] border border-slate-700 text-slate-200 disabled:opacity-40"
                        >
                          <option value="todos"> De Todo Mundo</option>
                          <option value="subordinados"> Apenas Subordinados</option>
                          <option value="pessoal"> Apenas Próprio (Dele)</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        
        <div className="p-4 bg-[#0B0D11] border border-slate-800 rounded-lg space-y-2.5">
          <div className="text-xs font-semibold text-slate-200">
            Matriz de Escala Semanal Fixa
          </div>
          <div className="flex flex-wrap gap-2">
            {DIAS_SEMANA.map((d) => {
              const ativo = form.escalaFixa.includes(d.idx);
              return (
                <button
                  key={d.idx}
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      escalaFixa: toggleItemInList(form.escalaFixa, d.idx)
                    })
                  }
                  className={`px-3.5 py-2 text-xs font-mono rounded border transition-colors ${
                    ativo
                      ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold'
                      : 'bg-[#11151E] text-slate-400 border-slate-800'
                  }`}
                >
                  {d.curto}
                </button>
              );
            })}
          </div>
        </div>

        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3.5 bg-[#0B0D11] border border-slate-800 rounded-lg space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-amber-400">Vínculo N:N — Unidades</div>
              <button
                type="button"
                data-no-confirm="true"
                onClick={() => setCriandoUnidadeEquipe((v) => !v)}
                className="px-2 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-[10px] font-bold text-emerald-300 cursor-pointer"
              >
                {criandoUnidadeEquipe ? 'Cancelar' : '+ Criar Unidade'}
              </button>
            </div>
            {criandoUnidadeEquipe && (
              <div className="p-2.5 rounded-lg bg-[#05100C] border border-emerald-500/40 space-y-2">
                <input
                  type="text"
                  value={novaUnidadeNomeEquipe}
                  onChange={(e) => setNovaUnidadeNomeEquipe(e.target.value)}
                  placeholder="Nome da nova unidade..."
                  className="w-full px-2.5 py-1.5 bg-[#0B0D11] border border-slate-700 rounded text-xs text-white"
                />
                <button
                  type="button"
                  data-no-confirm="true"
                  disabled={salvandoUnidadeEquipe}
                  onClick={handleCriarUnidadeInlineEquipe}
                  className="w-full py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] cursor-pointer disabled:opacity-50"
                >
                  {salvandoUnidadeEquipe ? 'Criando...' : 'Salvar e Vincular Unidade'}
                </button>
              </div>
            )}
            {data.unidades.map((un) => (
              <label key={un.id} className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.unidadesIds.includes(un.id)}
                  onChange={() =>
                    setForm({ ...form, unidadesIds: toggleItemInList(form.unidadesIds, un.id) })
                  }
                  className="accent-amber-500"
                />
                <span>{un.nome}</span>
              </label>
            ))}
          </div>

          <div className="p-3.5 bg-[#0B0D11] border border-slate-800 rounded-lg space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-amber-400">Vínculo N:N — Setores</div>
              <button
                type="button"
                data-no-confirm="true"
                onClick={() => setCriandoSetorEquipe((v) => !v)}
                className="px-2 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-[10px] font-bold text-emerald-300 cursor-pointer"
              >
                {criandoSetorEquipe ? 'Cancelar' : '+ Criar Setor'}
              </button>
            </div>
            {criandoSetorEquipe && (
              <div className="p-2.5 rounded-lg bg-[#05100C] border border-emerald-500/40 space-y-2">
                <input
                  type="text"
                  value={novoSetorNomeEquipe}
                  onChange={(e) => setNovoSetorNomeEquipe(e.target.value)}
                  placeholder="Nome do novo setor (ex: Bar Piscina)"
                  className="w-full px-2.5 py-1.5 bg-[#0B0D11] border border-slate-700 rounded text-xs text-white"
                />
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400">Peso Rateio:</span>
                  <input
                    type="number"
                    step="0.1"
                    value={novoSetorPesoEquipe}
                    onChange={(e) => setNovoSetorPesoEquipe(e.target.value)}
                    className="w-20 px-2 py-1 bg-[#0B0D11] border border-slate-700 rounded text-xs font-mono text-amber-400"
                  />
                </div>
                <button
                  type="button"
                  data-no-confirm="true"
                  disabled={salvandoSetorEquipe}
                  onClick={handleCriarSetorInlineEquipe}
                  className="w-full py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] cursor-pointer disabled:opacity-50"
                >
                  {salvandoSetorEquipe ? 'Criando...' : 'Salvar e Vincular Setor'}
                </button>
              </div>
            )}
            {data.setores.map((st) => (
              <label key={st.id} className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.setoresIds.includes(st.id)}
                  onChange={() =>
                    setForm({ ...form, setoresIds: toggleItemInList(form.setoresIds, st.id) })
                  }
                  className="accent-amber-500"
                />
                <span>{st.nome}</span>
              </label>
            ))}
          </div>

          <div className="p-3.5 bg-[#0B0D11] border border-slate-800 rounded-lg space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-amber-400">Vínculo N:N — Checklists</div>
              <button
                type="button"
                data-no-confirm="true"
                onClick={() => setCriandoChecklistEquipe((v) => !v)}
                className="px-2 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-[10px] font-bold text-emerald-300 cursor-pointer"
              >
                {criandoChecklistEquipe ? 'Cancelar' : '+ Criar Checklist'}
              </button>
            </div>
            {criandoChecklistEquipe && (
              <div className="p-2.5 rounded-lg bg-[#05100C] border border-emerald-500/40 space-y-2">
                <input
                  type="text"
                  value={novoChecklistTituloEquipe}
                  onChange={(e) => setNovoChecklistTituloEquipe(e.target.value)}
                  placeholder="Título do novo checklist..."
                  className="w-full px-2.5 py-1.5 bg-[#0B0D11] border border-slate-700 rounded text-xs text-white"
                />
                <button
                  type="button"
                  data-no-confirm="true"
                  disabled={salvandoChecklistEquipe}
                  onClick={handleCriarChecklistInlineEquipe}
                  className="w-full py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] cursor-pointer disabled:opacity-50"
                >
                  {salvandoChecklistEquipe ? 'Criando...' : 'Salvar e Vincular Checklist'}
                </button>
              </div>
            )}
            {data.checklists.map((ck) => (
              <label key={ck.id} className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.checklistsIds.includes(ck.id)}
                  onChange={() =>
                    setForm({
                      ...form,
                      checklistsIds: toggleItemInList(form.checklistsIds, ck.id)
                    })
                  }
                  className="accent-amber-500"
                />
                <span className="truncate">{ck.titulo}</span>
              </label>
            ))}
          </div>
        </div>
      </FocusFormModal>
    </div>
  );
}

export function SelecaoTab({
  data,
  onRefresh,
  onNavigateDeepLink,
  showAlert,
  showConfirm
}: CommonTabProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<any>({
    id: null,
    nome: '',
    whatsapp: '',
    vaga: '',
    etapa: 1,
    observacoes: ''
  });

  const moverEtapa = async (candidato: any, novaEtapa: number) => {
    try {
      const res = await fetch('/api/v20/selecao/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...candidato, etapa: novaEtapa })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || 'Erro ao avançar etapa');
      await onRefresh();
      if (novaEtapa === 5 && json.contratado_usuario_id) {
        showAlert(
          'Contratação Automática Efetivada (Etapa 5)',
          `O candidato "${candidato.nome}" atingiu a Etapa 5 (Contratado) e foi automaticamente cadastrado na Aba Equipe sob o ID #${json.contratado_usuario_id}.`
        );
      }
    } catch (e: any) {
      showAlert('Erro no Funil de Seleção', e.message);
    }
  };

  const handleSave = async () => {
    try {
      const res = await fetch('/api/v20/selecao/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || 'Erro ao salvar candidato');
      setModalOpen(false);
      await onRefresh();
      if (Number(form.etapa) === 5 && json.contratado_usuario_id) {
        showAlert(
          'Contratação Automática Concluída',
          `Colaborador integrado automaticamente à Aba Equipe (ID #${json.contratado_usuario_id}).`
        );
      }
    } catch (e: any) {
      showAlert('Erro em Seleção', e.message);
    }
  };

  const handleArchive = (id: number) => {
    showConfirm('Arquivar Candidato', 'Confirma o arquivamento lógico deste processo seletivo?', async () => {
      await fetch('/api/erp/arquivar-generico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, tabelaAlvo: 'erp_selecao' })
      });
      setModalOpen(false);
      await onRefresh();
    });
  };

  return (
    <div className="space-y-6 w-full">
      <div className="bg-[#11151E] border border-slate-800/90 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-slate-100">
          Seleção
        </h2>
        <button
          type="button"
          onClick={() => {
            setForm({ id: null, nome: '', whatsapp: '', vaga: '', etapa: 1, observacoes: '' });
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Novo Candidato / Vaga</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {ETAPAS_SELECAO.map((et) => {
          const candidatos = data.selecao.filter((c) => Number(c.etapa) === et.num);
          return (
            <div
              key={et.num}
              className="bg-[#11151E] border border-slate-800/90 rounded-lg flex flex-col min-h-[380px]"
            >
              <div className="p-3.5 border-b border-slate-800 bg-[#0D1017] flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">{et.titulo}</span>
                <span className="text-xs font-mono text-amber-400">{candidatos.length}</span>
              </div>
              <div className="p-3 space-y-3 flex-1">
                {candidatos.map((c) => {
                  const colabEquivalente = data.usuarios.find(
                    (u) => u.nome.toLowerCase().trim() === c.nome.toLowerCase().trim()
                  );
                  return (
                    <div
                      key={c.id}
                      className="p-3 bg-[#0B0D11] border border-slate-800 rounded-lg space-y-2 text-xs"
                    >
                      <div
                        onClick={() => {
                          setForm({ ...c });
                          setModalOpen(true);
                        }}
                        className="cursor-pointer"
                      >
                        <div className="font-semibold text-slate-100 hover:text-amber-400">
                          {c.nome}
                        </div>
                        <div className="text-amber-400/90 text-[11px]">{c.vaga}</div>
                        <p className="text-slate-400 text-[11px] mt-1">{c.observacoes}</p>
                      </div>

                      {et.num < 5 ? (
                        <button
                          type="button"
                          onClick={() => moverEtapa(c, et.num + 1)}
                          className="w-full py-1.5 bg-amber-500/15 hover:bg-amber-500 hover:text-slate-950 text-amber-300 border border-amber-500/30 rounded text-[11px] font-semibold transition-colors"
                        >
                          Avançar para Etapa {et.num + 1}
                        </button>
                      ) : (
                        colabEquivalente && (
                          <button
                            type="button"
                            onClick={() =>
                              onNavigateDeepLink({
                                tab: 'equipe',
                                entityId: colabEquivalente.id,
                                action: 'edit'
                              })
                            }
                            className="w-full py-1.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded text-[11px] font-semibold inline-flex items-center justify-center gap-1"
                          >
                            <span>Abrir na Equipe (#{colabEquivalente.id})</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </button>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <FocusFormModal
        open={modalOpen}
        title={form.id ? `Editar Candidato — ${form.nome}` : 'Novo Candidato no Funil'}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onArchive={form.id ? () => handleArchive(form.id) : undefined}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Nome do Candidato</label>
            <input
              type="text"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Vaga / Cargo Pretendido</label>
            <input
              type="text"
              value={form.vaga}
              onChange={(e) => setForm({ ...form, vaga: e.target.value })}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">WhatsApp</label>
            <input
              type="text"
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs font-mono text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Etapa do Funil (1 a 5)</label>
            <select
              value={form.etapa}
              onChange={(e) => setForm({ ...form, etapa: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
            >
              {ETAPAS_SELECAO.map((e) => (
                <option key={e.num} value={e.num}>
                  {e.titulo}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-400 mb-1">Parecer Técnico de Seleção</label>
            <textarea
              rows={3}
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
            />
          </div>
        </div>
      </FocusFormModal>
    </div>
  );
}

interface RecursoRHCatalogo {
  codigo: string;
  emoji: string;
  nome: string;
  subtitulo: string;
  categoria: string;
  corBadge: string;
  tituloPadrao: string;
  descricaoPadrao: string;
  segredoSugerido: string;
  itensPadrao: string[];
  possuiAvaliacao?: boolean;
  possuiValorFinanceiro?: boolean;
  possuiValidade?: boolean;
  diasValidadePadrao?: number;
}

const CATALOGO_RECURSOS_RH: RecursoRHCatalogo[] = [
  {
    codigo: 'ONBOARDING_NR01',
    emoji: '',
    nome: '1. Onboarding & Integração NR-01',
    subtitulo: 'Admissão estruturada, Ordem de Serviço (OS) de Segurança, LGPD e cultura da casa',
    categoria: 'Onboarding & Admissão',
    corBadge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    tituloPadrao: 'Onboarding & Ordem de Serviço NR-01 Concluídos',
    descricaoPadrao: 'Integração completa do colaborador nos procedimentos operacionais, normas de higiene, riscos ocupacionais NR-01 e canais oficiais de comunicação.',
    segredoSugerido: 'Termo LGPD & OS NR-01 assinados digitalmente — Prontuário Admissional OK',
    itensPadrao: [
      'Apresentação da Cultura, Cardápio e Padrão de Atendimento',
      'Assinatura da Ordem de Serviço (OS) NR-01 & Mapeamento de Riscos',
      'Cadastro na Comunidade Oficial WhatsApp & Escala da Equipe',
      'Orientação de Segurança Alimentar (BPF / ANVISA)',
      'Termo de Confidencialidade e Ciência LGPD'
    ],
    possuiValidade: true,
    diasValidadePadrao: 365
  },
  {
    codigo: 'EPI_ASO_NR06',
    emoji: '',
    nome: '2. Entrega de EPI & Controle ASO (NR-06 / NR-07)',
    subtitulo: 'Ficha de EPI assinada, calçado de segurança, luvas térmicas/corte e validade do ASO',
    categoria: 'Segurança & EPI',
    corBadge: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    tituloPadrao: 'Entrega de Kit EPI & Validação de ASO Ocupacional',
    descricaoPadrao: 'Fornecimento e conferência de Equipamentos de Proteção Individual (NR-06) com Certificado de Aprovação (CA) ativo e verificação de aptidão no ASO.',
    segredoSugerido: 'ASO APTO S/ Restrições | CA #42198 (Bota Antiderrapante) + CA #18902 (Luva Malha/Térmica)',
    itensPadrao: [
      'Sapato Fechado Antiderrapante Impermeável (CA Validado)',
      'Avental / Dólmã / Uniforme Operacional Completo',
      'Luva de Proteção Térmica / Corte e Touca Descartável',
      'Protetor Auricular / Óculos de Proteção (Higienização)',
      'Exame ASO (Admissional / Periódico) Apto e dentro da validade'
    ],
    possuiValidade: true,
    diasValidadePadrao: 365
  },
  {
    codigo: 'AVALIACAO_360_PDI',
    emoji: '',
    nome: '3. Avaliação de Desempenho 360° & Feedback 1:1',
    subtitulo: 'Avaliação prática de Assiduidade, Qualidade, Agilidade, Trabalho em Equipe e PDI',
    categoria: 'Feedback 1:1',
    corBadge: 'bg-purple-500/15 text-purple-300 border-purple-500/40',
    tituloPadrao: 'Ciclo de Avaliação 360° & Plano de Desenvolvimento Individual (PDI)',
    descricaoPadrao: 'Reunião individual 1:1 com avaliação estruturada de competências técnicas e comportamentais, alinhamento de metas e próximos passos na carreira.',
    segredoSugerido: 'Acordo de PDI: Meta de evolução para líder de praça em 90 dias',
    itensPadrao: [
      'Pontualidade, Assiduidade e Compromisso com a Escala',
      'Padrão Técnico, Qualidade de Entrega e Organização da Praça',
      'Trabalho em Equipe, Comunicação e Clima Organizacional',
      'Agilidade sob Pressão e Resolução de Imprevistos',
      'Cuidado com Insumos (Redução de Desperdício / CMV)'
    ],
    possuiAvaliacao: true,
    possuiValidade: true,
    diasValidadePadrao: 90
  },
  {
    codigo: 'TREINAMENTO_ANVISA_BPF',
    emoji: '',
    nome: '4. Capacitação Técnica & Boas Práticas (ANVISA)',
    subtitulo: 'Treinamento de manipulação segura, controle de temperatura, POPs e atendimento',
    categoria: 'Capacitação',
    corBadge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
    tituloPadrao: 'Certificação Interna: Boas Práticas de Manipulação & Padrão Operacional',
    descricaoPadrao: 'Capacitação prática aplicada à equipe com verificação de aprendizado em higiene, controle cruzado de contaminantes, etiquetagem PVPS e excelência no atendimento.',
    segredoSugerido: 'Certificado Interno Emitido — Aproveitamento Prático 100%',
    itensPadrao: [
      'Higienização das Mãos, Bancadas e Utensílios (RDC 216 ANVISA)',
      'Etiquetagem de Validade (PVPS) e Controle de Temperaturas',
      'Prevenção de Contaminação Cruzada e Armazenamento Correto',
      'Padronização de Fichas Técnicas e Porcionamento',
      'Postura Profissional e Excelência no Atendimento'
    ],
    possuiValidade: true,
    diasValidadePadrao: 180
  },
  {
    codigo: 'PONTO_BANCO_FERIAS',
    emoji: '',
    nome: '5. Ponto Portaria 671, Banco de Horas & Férias',
    subtitulo: 'Fechamento de espelho de ponto, compensação de horas, folgas ou programação de férias',
    categoria: 'Ponto Portaria 671',
    corBadge: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
    tituloPadrao: 'Homologação de Espelho de Ponto & Acordo de Banco de Horas / Férias',
    descricaoPadrao: 'Conferência e validação de jornada conforme Portaria MTP 671, saldo de banco de horas e agendamento de descanso regulamentar/férias.',
    segredoSugerido: 'Hash SHA-256 Portaria 671 Validado — Saldo de Horas Conferido pelo Colaborador',
    itensPadrao: [
      'Conferência de Batidas de Entrada, Intervalo Intrajornada e Saída',
      'Extrato de Banco de Horas / Horas Extras Homologado',
      'Verificação de Descanso Semanal Remunerado (DSR)',
      'Programação de Férias / Folga Compensatória Acordada'
    ],
    possuiValidade: true,
    diasValidadePadrao: 30
  },
  {
    codigo: 'BENEFICIOS_VALES_PREMIACAO',
    emoji: '',
    nome: '6. Benefícios, Vale, Adiantamento & Premiação',
    subtitulo: 'Vale-transporte, alimentação, adiantamento salarial ou bônus de meta (integra Caixa)',
    categoria: 'Benefícios & Vales',
    corBadge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    tituloPadrao: 'Concessão de Benefício / Premiação / Vale ao Colaborador',
    descricaoPadrao: 'Aplicação financeira de benefício, bônus de produtividade, auxílio deslocamento ou adiantamento com recibo eletrônico no prontuário.',
    segredoSugerido: 'Comprovante PIX / Recibo Assinado Arquivado no Dossiê Financeiro RH',
    itensPadrao: [
      'Vale-Transporte / Auxílio Combustível / Mobilidade',
      'Vale-Alimentação / Refeição na Casa',
      'Bonificação por Meta Batida / Gorjeta / Premiação de Equipe',
      'Adiantamento Salarial (Vale) Autorizado pela Gestão'
    ],
    possuiValorFinanceiro: true
  },
  {
    codigo: 'RECONHECIMENTO_ELOGIO',
    emoji: '',
    nome: '7. Reconhecimento Oficial & Destaque do Mês',
    subtitulo: 'Elogio formal em prontuário, mérito por atitude exemplar e disparo de parabéns no WhatsApp',
    categoria: 'Reconhecimento & Clima',
    corBadge: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    tituloPadrao: 'Mérito & Elogio Oficial — Destaque de Excelência na Equipe',
    descricaoPadrao: 'Reconhecimento oficial registrado na ficha funcional pela dedicação extraordinária, espírito de equipe e compromisso com a excelência.',
    segredoSugerido: 'Mérito Positivo Computado para Progressão de Nível / Cargo',
    itensPadrao: [
      'Atitude Exemplar e Proatividade Acima do Esperado',
      'Elogio Direto de Clientes ou Colegas de Turno',
      'Zero Atrasos e Comprometimento Total no Período',
      'Apoio Decisivo à Equipe em Dia de Movimento Intenso'
    ],
    possuiAvaliacao: true,
    possuiValorFinanceiro: true
  },
  {
    codigo: 'GESTAO_DISCIPLINAR_ORIENTATIVA',
    emoji: '',
    nome: '8. Alinhamento de Conduta & Gestão Disciplinar',
    subtitulo: 'Orientação verbal educativa, termo de alinhamento ou advertência com sigilo LGPD',
    categoria: 'Gestão Disciplinar',
    corBadge: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
    tituloPadrao: 'Termo de Orientação & Alinhamento Operacional de Conduta',
    descricaoPadrao: 'Registro formal de orientação corretiva com foco pedagógico, esclarecimento das normas internas e compromisso de melhoria imediata.',
    segredoSugerido: 'Registro restrito à gestão (Art. 11 LGPD) — Testemunhas e ciência registradas',
    itensPadrao: [
      'Orientação Educativa sobre Pontualidade e Cumprimento de Horário',
      'Alinhamento sobre Uso Obrigatório de EPI / Uniforme',
      'Reforço de Procedimento Operacional Padrão (POP) e Higiene',
      'Compromisso de Conduta Respeitosa e Colaborativa no Turno'
    ]
  }
];

export function RHTab(
  props: CommonTabProps & {
    initialSubView?: 'recursos' | 'dossie' | 'prontuarios' | 'selecao';
  }
) {
  const {
    data,
    onRefresh,
    onNavigateDeepLink,
    showAlert,
    showConfirm,
    initialSubView
  } = props;

  const [subView, setSubView] = useState<'recursos' | 'dossie' | 'prontuarios' | 'selecao'>(
    initialSubView || 'recursos'
  );
  useEffect(() => {
    if (initialSubView) {
      setSubView(initialSubView);
    }
  }, [initialSubView]);
  const [pilarFiltro, setPilarFiltro] = useState<string>('Todos');
  const [colabFiltro, setColabFiltro] = useState<number>(0);
  const [modalOpen, setModalOpen] = useState(false);

  const [notas360, setNotas360] = useState<{
    assiduidade: number;
    qualidade: number;
    equipe: number;
    agilidade: number;
    seguranca: number;
  }>({
    assiduidade: 5,
    qualidade: 5,
    equipe: 5,
    agilidade: 5,
    seguranca: 5
  });

  const [recursoAtivo, setRecursoAtivo] = useState<RecursoRHCatalogo | null>(null);

  const [form, setForm] = useState<any>({
    id: null,
    usuario_id: data.usuarios[0]?.id || 1,
    aplicar_para_todos: false,
    recurso_codigo: '',
    categoria: 'NR-01 & Riscos',
    titulo: '',
    descricao: '',
    data: getTodayISO(),
    validade_data: '',
    status: 'Ativo',
    nota_avaliacao: 0,
    valor_financeiro: 0,
    lancar_caixa: false,
    notificar_wpp: true,
    itens_aplicados: [] as string[],
    segredo: ''
  });

  const addDaysISO = (days: number) => {
    const dt = new Date();
    dt.setDate(dt.getDate() + days);
    return dt.toISOString().split('T')[0];
  };

  const abrirAplicacaoRecurso = (recurso: RecursoRHCatalogo, usuarioIdPreSelecionado?: number, paraTodos?: boolean) => {
    setRecursoAtivo(recurso);
    const notasIniciais = { assiduidade: 5, qualidade: 5, equipe: 5, agilidade: 5, seguranca: 5 };
    setNotas360(notasIniciais);
    setForm({
      id: null,
      usuario_id: usuarioIdPreSelecionado || data.usuarios[0]?.id || 1,
      aplicar_para_todos: Boolean(paraTodos),
      recurso_codigo: recurso.codigo,
      categoria: recurso.categoria,
      titulo: recurso.tituloPadrao,
      descricao: recurso.descricaoPadrao,
      data: getTodayISO(),
      validade_data: recurso.possuiValidade && recurso.diasValidadePadrao ? addDaysISO(recurso.diasValidadePadrao) : '',
      status: 'Ativo',
      nota_avaliacao: recurso.possuiAvaliacao ? 5.0 : 0,
      valor_financeiro: 0,
      lancar_caixa: false,
      notificar_wpp: true,
      itens_aplicados: [...recurso.itensPadrao],
      segredo: recurso.segredoSugerido
    });
    setModalOpen(true);
  };

  const atualizarNotaMedia360 = (novasNotas: typeof notas360) => {
    setNotas360(novasNotas);
    const soma =
      novasNotas.assiduidade +
      novasNotas.qualidade +
      novasNotas.equipe +
      novasNotas.agilidade +
      novasNotas.seguranca;
    const media = Number((soma / 5).toFixed(1));
    setForm((prev: any) => ({ ...prev, nota_avaliacao: media }));
  };

  const toggleItemChecklist = (item: string) => {
    setForm((prev: any) => {
      const atual: string[] = Array.isArray(prev.itens_aplicados) ? prev.itens_aplicados : [];
      if (atual.includes(item)) {
        return { ...prev, itens_aplicados: atual.filter((i) => i !== item) };
      }
      return { ...prev, itens_aplicados: [...atual, item] };
    });
  };

  const handleSave = async () => {
    try {
      const endpoint = form.recurso_codigo || form.aplicar_para_todos
        ? '/api/v20/rh/aplicar-recurso'
        : '/api/v20/rh/salvar';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || 'Erro ao aplicar recurso de RH');
      setModalOpen(false);
      await onRefresh();
      if (json.total_aplicados && json.total_aplicados > 1) {
        showAlert(
          'Recurso de RH Aplicado em Lote',
          `O recurso "${form.titulo}" foi aplicado com sucesso para ${json.total_aplicados} colaboradores da equipe!`
        );
      }
    } catch (e: any) {
      showAlert('Erro no Setor de RH', e.message);
    }
  };

  const handleArchive = (id: number) => {
    showConfirm('Arquivar Prontuário RH / NR-01', 'Confirma o arquivamento lógico deste registro ocupacional?', async () => {
      await fetch('/api/erp/arquivar-generico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, tabelaAlvo: 'erp_rh_nr01' })
      });
      setModalOpen(false);
      await onRefresh();
    });
  };

  const kpisRH = useMemo(() => {
    const totalColabs = data.usuarios.length;
    const registros = data.rhRegistros || [];
    const colabsComNR01 = new Set(
      registros
        .filter((r) =>
          ['NR-01 & Riscos', 'Segurança & EPI', 'Onboarding & Admissão'].includes(r.categoria)
        )
        .map((r) => Number(r.usuario_id))
    ).size;

    const avaliacoes = registros.filter((r: any) => Number(r.nota_avaliacao) > 0);
    const mediaDesempenho =
      avaliacoes.length > 0
        ? (
            avaliacoes.reduce((acc: number, r: any) => acc + Number(r.nota_avaliacao || 0), 0) /
            avaliacoes.length
          ).toFixed(1)
        : '5.0';

    const totalInvestidoRH = registros.reduce(
      (acc: number, r: any) => acc + Number(r.valor_financeiro || 0),
      0
    );

    const vagasAbertas = (data.selecao || []).filter((c) => Number(c.etapa) < 5).length;

    return {
      totalColabs,
      colabsComNR01,
      coberturaNR01: totalColabs > 0 ? Math.round((colabsComNR01 / totalColabs) * 100) : 100,
      totalRegistros: registros.length,
      mediaDesempenho,
      totalInvestidoRH,
      vagasAbertas
    };
  }, [data.usuarios, data.rhRegistros, data.selecao]);

  return (
    <div className="space-y-6 w-full">
      
      <div className="bg-[#071712] border border-emerald-900/60 rounded-xl p-5 space-y-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full">
                Setor de Recursos Humanos & DP
              </span>
              <span className="px-2.5 py-0.5 text-[11px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-full">
                NR-01 • NR-06 • Portaria 671 • LGPD AES-256
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-100">
              Central de RH & Recursos Aplicados à Equipe
            </h2>
            <p className="text-xs text-slate-400">
              Aplique instrumentos práticos de RH individualmente ou para toda a equipe: Onboarding, EPI/ASO, Avaliação 360°, Treinamentos, Ponto/Férias, Benefícios e Reconhecimento.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => abrirAplicacaoRecurso(CATALOGO_RECURSOS_RH[0], data.usuarios[0]?.id, false)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-400 rounded-lg shadow transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span> Aplicar Recurso de RH</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setRecursoAtivo(null);
                setForm({
                  id: null,
                  usuario_id: data.usuarios[0]?.id || 1,
                  aplicar_para_todos: false,
                  recurso_codigo: '',
                  categoria: 'NR-01 & Riscos',
                  titulo: '',
                  descricao: '',
                  data: getTodayISO(),
                  validade_data: '',
                  status: 'Ativo',
                  nota_avaliacao: 0,
                  valor_financeiro: 0,
                  lancar_caixa: false,
                  notificar_wpp: false,
                  itens_aplicados: [],
                  segredo: ''
                });
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 rounded-lg transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Prontuário Livre</span>
            </button>
          </div>
        </div>

        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-lg bg-[#05100C] border border-emerald-950/90">
            <div className="text-[11px] text-slate-400">Equipe Ativa</div>
            <div className="text-lg font-bold text-slate-100 mt-0.5">
               {kpisRH.totalColabs} <span className="text-xs font-normal text-slate-400">colabs</span>
            </div>
          </div>
          <div className="p-3.5 rounded-lg bg-[#05100C] border border-emerald-950/90">
            <div className="text-[11px] text-slate-400">Cobertura NR-01 / EPI</div>
            <div className="text-lg font-bold text-emerald-400 mt-0.5">
               {kpisRH.coberturaNR01}% <span className="text-xs font-normal text-slate-400">({kpisRH.colabsComNR01}/{kpisRH.totalColabs})</span>
            </div>
          </div>
          <div className="p-3.5 rounded-lg bg-[#05100C] border border-emerald-950/90">
            <div className="text-[11px] text-slate-400">Média Avaliação 360°</div>
            <div className="text-lg font-bold text-amber-400 mt-0.5">
               {kpisRH.mediaDesempenho} <span className="text-xs font-normal text-slate-400">/ 5.0</span>
            </div>
          </div>
          <div className="p-3.5 rounded-lg bg-[#05100C] border border-emerald-950/90">
            <div className="text-[11px] text-slate-400">Benefícios / Bônus Aplicados</div>
            <div className="text-lg font-bold text-emerald-300 mt-0.5">
               {formatBRL(kpisRH.totalInvestidoRH)}
            </div>
          </div>
          <div className="p-3.5 rounded-lg bg-[#05100C] border border-emerald-950/90 col-span-2 sm:col-span-1">
            <div className="text-[11px] text-slate-400">Prontuários & Seleção</div>
            <div className="text-lg font-bold text-cyan-300 mt-0.5">
               {kpisRH.totalRegistros} <span className="text-xs font-normal text-slate-400">• {kpisRH.vagasAbertas} cand.</span>
            </div>
          </div>
        </div>

        
        <div className="pt-3 border-t border-emerald-900/50 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                if (subView === 'selecao') setSubView('recursos');
              }}
              className={`p-3.5 rounded-xl border text-left transition-all flex items-start justify-between gap-3 cursor-pointer ${
                subView !== 'selecao'
                  ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-md ring-2 ring-emerald-500/40'
                  : 'bg-[#05100C] border-emerald-900/60 text-slate-300 hover:border-emerald-500/50'
              }`}
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 text-[10px] font-black uppercase">
                    Ambiente 1 • Gestão RH
                  </span>
                  <span className="text-xs font-mono text-emerald-300">
                    {kpisRH.totalRegistros} prontuários
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-100">
                   Recursos de RH, Dossiê 360° & Prontuários NR-01
                </div>
                <p className="text-[11px] text-slate-400">
                  Aplicação de recursos na equipe, avaliação 360°, entrega de EPI, ponto e benefícios.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSubView('selecao')}
              className={`p-3.5 rounded-xl border text-left transition-all flex items-start justify-between gap-3 cursor-pointer ${
                subView === 'selecao'
                  ? 'bg-amber-500/20 border-amber-400 text-white shadow-md ring-2 ring-amber-400/40'
                  : 'bg-[#05100C] border-emerald-900/60 text-slate-300 hover:border-amber-500/50'
              }`}
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 text-[10px] font-black uppercase">
                    Ambiente 2 • Seleção de Colaborador
                  </span>
                  <span className="text-xs font-mono text-amber-300">
                    {(data.selecao || []).length} candidatos ({kpisRH.vagasAbertas} em andamento)
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-100">
                   Ambiente de Seleção & Contratação de Colaboradores
                </div>
                <p className="text-[11px] text-slate-400">
                  Funil de 5 etapas (Captação, Triagem, Entrevista Prática, ASO e Contratação Automática na Equipe).
                </p>
              </div>
            </button>
          </div>

          
          {subView !== 'selecao' && (
            <div className="flex flex-wrap gap-2 pt-1">
              {[
                { id: 'recursos', label: ' 1. Recursos de RH para Aplicar (8 Instrumentos)' },
                { id: 'dossie', label: ` 2. Dossiê 360° por Colaborador (${data.usuarios.length})` },
                { id: 'prontuarios', label: ` 3. Prontuários & Histórico LGPD (${data.rhRegistros.length})` }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSubView(tab.id as any)}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                    subView === tab.id
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow'
                      : 'bg-[#05100C] text-slate-300 border-emerald-900/60 hover:border-emerald-600/60'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      
      {subView === 'recursos' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Escolha o Recurso de RH para Aplicar Agora
              </h3>
              <p className="text-xs text-slate-400">
                Cada recurso abaixo já vem com checklist técnico normativo, cálculo de avaliação, recibo criptografado LGPD e envio opcional no WhatsApp do colaborador.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CATALOGO_RECURSOS_RH.map((rec) => {
              const qtdAplicada = data.rhRegistros.filter(
                (r: any) => r.recurso_codigo === rec.codigo || r.categoria === rec.categoria
              ).length;

              return (
                <div
                  key={rec.codigo}
                  className="bg-[#071712] border border-emerald-900/60 hover:border-emerald-500/60 rounded-xl p-5 flex flex-col justify-between gap-4 transition-all shadow-md"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-[#05100C] border border-emerald-800/60 flex items-center justify-center text-2xl shrink-0">
                          {rec.emoji}
                        </div>
                        <div>
                          <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded border mb-1 ${rec.corBadge}`}>
                            {rec.categoria}
                          </span>
                          <h4 className="text-sm font-bold text-slate-100 leading-snug">
                            {rec.nome}
                          </h4>
                        </div>
                      </div>
                      <span className="px-2 py-1 text-[11px] font-mono bg-[#05100C] border border-emerald-900/80 text-slate-300 rounded shrink-0">
                        {qtdAplicada} aplic.
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      {rec.subtitulo}
                    </p>

                    <div className="p-3 rounded-lg bg-[#05100C] border border-emerald-950/90 space-y-1.5">
                      <div className="text-[11px] font-semibold text-emerald-400">
                        Itens verificados neste recurso:
                      </div>
                      <ul className="space-y-1">
                        {rec.itensPadrao.slice(0, 4).map((item, idx) => (
                          <li key={idx} className="text-[11px] text-slate-400 flex items-start gap-1.5">
                            <span className="text-emerald-400 mt-0.5"></span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-emerald-900/40">
                    <button
                      type="button"
                      onClick={() => abrirAplicacaoRecurso(rec, data.usuarios[0]?.id, false)}
                      className="flex-1 min-w-[160px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-400 rounded-lg transition-colors"
                    >
                      <span> Aplicar em Colaborador</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => abrirAplicacaoRecurso(rec, data.usuarios[0]?.id, true)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 rounded-lg transition-colors"
                      title="Aplica este recurso simultaneamente para todos os colaboradores ativos da equipe"
                    >
                      <span> Aplicar p/ Toda Equipe</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      
      {subView === 'dossie' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.usuarios.map((colab) => {
              const regsColab = data.rhRegistros.filter(
                (r) => Number(r.usuario_id) === Number(colab.id)
              );
              const temNR01 = regsColab.some((r) =>
                ['NR-01 & Riscos', 'Onboarding & Admissão'].includes(r.categoria)
              );
              const temEPI = regsColab.some((r) => r.categoria === 'Segurança & EPI');
              const temTreino = regsColab.some((r) => r.categoria === 'Capacitação');
              const temFeedback = regsColab.some((r) =>
                ['Feedback 1:1', 'Reconhecimento & Clima'].includes(r.categoria)
              );
              const temPonto = regsColab.some((r) =>
                ['Ponto Portaria 671', 'Férias & Licenças'].includes(r.categoria)
              );

              const avals = regsColab.filter((r: any) => Number(r.nota_avaliacao) > 0);
              const mediaColab =
                avals.length > 0
                  ? (
                      avals.reduce((acc: number, r: any) => acc + Number(r.nota_avaliacao || 0), 0) /
                      avals.length
                    ).toFixed(1)
                  : null;

              const totalBeneficiosColab = regsColab.reduce(
                (acc: number, r: any) => acc + Number(r.valor_financeiro || 0),
                0
              );

              return (
                <div
                  key={colab.id}
                  className="bg-[#071712] border border-emerald-900/60 rounded-xl p-5 space-y-4 shadow-md"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-100">{colab.nome}</span>
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded">
                          {colab.cargo || colab.role}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 font-mono">
                         {colab.telefone || 'Sem WPP'} • Escala: {colab.escala || '6x1'} • {regsColab.length} registro(s) RH
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {mediaColab && (
                        <span className="px-2.5 py-1 text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-lg">
                           {mediaColab}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setColabFiltro(colab.id);
                          setSubView('prontuarios');
                        }}
                        className="px-2.5 py-1 text-xs font-semibold bg-[#05100C] hover:bg-emerald-950 text-slate-200 border border-emerald-800/60 rounded-lg"
                      >
                         Ver Ficha ({regsColab.length})
                      </button>
                    </div>
                  </div>

                  
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {[
                      { label: 'NR-01 / OS', ok: temNR01, recIdx: 0 },
                      { label: 'EPI & ASO', ok: temEPI, recIdx: 1 },
                      { label: 'Aval. 360°', ok: temFeedback, recIdx: 2 },
                      { label: 'Treinamento', ok: temTreino, recIdx: 3 },
                      { label: 'Ponto 671', ok: temPonto, recIdx: 4 }
                    ].map((selo) => (
                      <button
                        key={selo.label}
                        type="button"
                        onClick={() => abrirAplicacaoRecurso(CATALOGO_RECURSOS_RH[selo.recIdx], colab.id, false)}
                        className={`p-2 rounded-lg border text-left transition-all ${
                          selo.ok
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                            : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:border-amber-400'
                        }`}
                        title="Clique para aplicar ou atualizar este recurso para o colaborador"
                      >
                        <div className="text-[10px] font-bold flex items-center justify-between">
                          <span>{selo.label}</span>
                          <span>{selo.ok ? '' : ''}</span>
                        </div>
                        <div className="text-[10px] opacity-80 mt-0.5">
                          {selo.ok ? 'Em dia' : 'Aplicar agora'}
                        </div>
                      </button>
                    ))}
                  </div>

                  
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-emerald-900/40">
                    <div className="text-[11px] text-slate-400">
                      Benefícios/Vales acumulados:{' '}
                      <span className="font-mono font-semibold text-emerald-300">
                        {formatBRL(totalBeneficiosColab)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => abrirAplicacaoRecurso(CATALOGO_RECURSOS_RH[2], colab.id, false)}
                        className="px-2.5 py-1.5 text-[11px] font-semibold bg-purple-500/15 hover:bg-purple-500/25 text-purple-200 border border-purple-500/40 rounded-lg"
                      >
                         Avaliar 360°
                      </button>
                      <button
                        type="button"
                        onClick={() => abrirAplicacaoRecurso(CATALOGO_RECURSOS_RH[5], colab.id, false)}
                        className="px-2.5 py-1.5 text-[11px] font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border border-emerald-500/40 rounded-lg"
                      >
                         Vale / Bônus
                      </button>
                      <button
                        type="button"
                        onClick={() => abrirAplicacaoRecurso(CATALOGO_RECURSOS_RH[6], colab.id, false)}
                        className="px-2.5 py-1.5 text-[11px] font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-500/40 rounded-lg"
                      >
                         Elogiar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      
      {subView === 'prontuarios' && (
        <div className="space-y-4">
          <div className="bg-[#071712] border border-emerald-900/60 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-semibold text-slate-300">
                Filtrar Prontuários por Pilar de RH ou Colaborador:
              </div>
              <select
                value={colabFiltro}
                onChange={(e) => setColabFiltro(Number(e.target.value))}
                className="px-3 py-1.5 bg-[#05100C] border border-emerald-800/70 rounded-lg text-xs text-slate-100"
              >
                <option value={0}> Todos os Colaboradores ({data.usuarios.length})</option>
                {data.usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                     {u.nome} ({u.cargo})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {['Todos', ...PILARES_RH_NR01].map((pilar) => (
                <button
                  key={pilar}
                  type="button"
                  onClick={() => setPilarFiltro(pilar)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    pilarFiltro === pilar
                      ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold'
                      : 'bg-[#05100C] text-slate-300 border-emerald-900/60 hover:border-emerald-700'
                  }`}
                >
                  {pilar}
                </button>
              ))}
            </div>
          </div>

          <UrutauDateMultiView
            title="Cronograma de Prontuários, ASO, EPI e Recursos de RH por Data"
            items={data.rhRegistros
              .filter((r) => pilarFiltro === 'Todos' || r.categoria === pilarFiltro)
              .filter((r) => colabFiltro === 0 || Number(r.usuario_id) === Number(colabFiltro))}
            getDateISO={(r: any) => r.data}
            getTitle={(r: any) => {
              const colab = data.usuarios.find((u) => Number(u.id) === Number(r.usuario_id));
              return `${r.titulo}${colab ? ` — ${colab.nome}` : ''}`;
            }}
            getSubtitle={(r: any) => `${r.categoria} • ${r.descricao || ''}`}
            getBadge={(r: any) => ({
              text: r.status || 'Vigente',
              colorClass: 'text-emerald-400'
            })}
            getRightMeta={(r: any) =>
              Number(r.valor_financeiro) > 0
                ? formatBRL(Number(r.valor_financeiro))
                : Number(r.nota_avaliacao) > 0
                ? ` ${Number(r.nota_avaliacao).toFixed(1)}`
                : r.categoria
            }
            onEditItem={(r: any) => {
              const itensAplicados: string[] = Array.isArray(r.itens_aplicados)
                ? r.itens_aplicados
                : [];
              setRecursoAtivo(
                CATALOGO_RECURSOS_RH.find((c) => c.codigo === r.recurso_codigo) || null
              );
              setForm({
                id: r.id,
                usuario_id: r.usuario_id,
                aplicar_para_todos: false,
                recurso_codigo: r.recurso_codigo || '',
                categoria: r.categoria,
                titulo: r.titulo,
                descricao: r.descricao,
                data: r.data,
                validade_data: r.validade_data || '',
                status: r.status,
                nota_avaliacao: Number(r.nota_avaliacao || 0),
                valor_financeiro: Number(r.valor_financeiro || 0),
                lancar_caixa: false,
                notificar_wpp: false,
                itens_aplicados: itensAplicados,
                segredo: r.segredo_decifrado || ''
              });
              setModalOpen(true);
            }}
            onCreateAtDate={(iso: string) => {
              abrirAplicacaoRecurso(CATALOGO_RECURSOS_RH[0], colabFiltro || data.usuarios[0]?.id || 1, false);
              setForm((prev: any) => ({ ...prev, data: iso }));
            }}
            createButtonLabel="Novo Prontuário RH"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.rhRegistros
              .filter((r) => pilarFiltro === 'Todos' || r.categoria === pilarFiltro)
              .filter((r) => colabFiltro === 0 || Number(r.usuario_id) === Number(colabFiltro))
              .map((r: any) => {
                const colab = data.usuarios.find((u) => Number(u.id) === Number(r.usuario_id));
                const itensAplicados: string[] = Array.isArray(r.itens_aplicados) ? r.itens_aplicados : [];
                return (
                  <div
                    key={r.id}
                    onClick={() => {
                      setRecursoAtivo(
                        CATALOGO_RECURSOS_RH.find((c) => c.codigo === r.recurso_codigo) || null
                      );
                      setForm({
                        id: r.id,
                        usuario_id: r.usuario_id,
                        aplicar_para_todos: false,
                        recurso_codigo: r.recurso_codigo || '',
                        categoria: r.categoria,
                        titulo: r.titulo,
                        descricao: r.descricao,
                        data: r.data,
                        validade_data: r.validade_data || '',
                        status: r.status,
                        nota_avaliacao: Number(r.nota_avaliacao || 0),
                        valor_financeiro: Number(r.valor_financeiro || 0),
                        lancar_caixa: false,
                        notificar_wpp: false,
                        itens_aplicados: itensAplicados,
                        segredo: r.segredo_decifrado || ''
                      });
                      setModalOpen(true);
                    }}
                    className="p-4 bg-[#071712] border border-emerald-900/60 hover:border-amber-500/50 rounded-xl cursor-pointer space-y-2.5 shadow"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 font-mono text-amber-300 font-semibold">
                        {r.categoria}
                      </span>
                      <div className="flex items-center gap-2 font-mono text-slate-400">
                        {Number(r.nota_avaliacao) > 0 && (
                          <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold">
                             {Number(r.nota_avaliacao).toFixed(1)}
                          </span>
                        )}
                        {Number(r.valor_financeiro) > 0 && (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                            {formatBRL(Number(r.valor_financeiro))}
                          </span>
                        )}
                        <span>
                          {r.data} · {r.status}
                        </span>
                      </div>
                    </div>

                    <div className="text-sm font-bold text-slate-100">{r.titulo}</div>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                      {r.descricao}
                    </p>

                    {itensAplicados.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {itensAplicados.map((item, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 text-[10px] bg-[#05100C] border border-emerald-900/70 text-emerald-300 rounded"
                          >
                             {item}
                          </span>
                        ))}
                      </div>
                    )}

                    {r.segredo_decifrado && (
                      <div className="p-2.5 bg-[#05100C] border border-emerald-900/80 rounded-lg text-[11px] font-mono text-emerald-400">
                         [Sigilo LGPD AES-256-GCM]: {r.segredo_decifrado}
                      </div>
                    )}

                    <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 border-t border-emerald-950">
                      {colab ? (
                        <div className="flex items-center gap-1.5">
                          <span>Colaborador:</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateDeepLink({ tab: 'cadastros', entityId: colab.id, action: 'edit' });
                            }}
                            className="text-emerald-300 hover:text-amber-400 font-semibold underline"
                          >
                            {colab.nome} ({colab.cargo})
                          </button>
                        </div>
                      ) : (
                        <span>Colaborador #{r.usuario_id}</span>
                      )}
                      {r.validade_data && (
                        <span className="font-mono text-[11px] text-amber-300">
                           Validade/Revisão: {r.validade_data}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      
      {subView === 'selecao' && <SelecaoTab {...props} />}

      
      <FocusFormModal
        open={modalOpen}
        title={
          form.id
            ? 'Editar Prontuário & Recurso de RH'
            : recursoAtivo
            ? `${recursoAtivo.emoji} Aplicar: ${recursoAtivo.nome}`
            : 'Novo Prontuário RH & NR-01'
        }
        subtitle="Aplique recursos práticos de gestão de pessoas com checklist, avaliação, integração financeira e proteção LGPD AES-256-GCM"
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onArchive={form.id ? () => handleArchive(form.id) : undefined}
      >
        <div className="space-y-4">
          
          {!form.id && (
            <div className="p-3 bg-[#05100C] border border-emerald-900/70 rounded-lg space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                 Escolher Modelo de Recurso de RH (Preenchimento Automático)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {CATALOGO_RECURSOS_RH.map((rec) => (
                  <button
                    key={rec.codigo}
                    type="button"
                    onClick={() => abrirAplicacaoRecurso(rec, form.usuario_id, form.aplicar_para_todos)}
                    className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border transition-all ${
                      form.recurso_codigo === rec.codigo
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                        : 'bg-[#071712] text-slate-300 border-emerald-900/60 hover:border-emerald-500/50'
                    }`}
                  >
                    {rec.emoji} {rec.nome.replace(/^\d+\.\s*/, '')}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Pilar / Categoria de RH</label>
              <select
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
              >
                {PILARES_RH_NR01.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Destinatário do Recurso</label>
              <div className="space-y-2">
                {!form.aplicar_para_todos && (
                  <select
                    value={form.usuario_id}
                    onChange={(e) => setForm({ ...form, usuario_id: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
                  >
                    <option value={0}>Registro Geral / Sem Destinatário Específico</option>
                    {data.usuarios.map((u) => (
                      <option key={u.id} value={u.id}>
                         {u.nome} ({u.cargo})
                      </option>
                    ))}
                  </select>
                )}
                {!form.id && (
                  <label className="flex items-center gap-2 text-xs text-amber-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(form.aplicar_para_todos)}
                      onChange={(e) => setForm({ ...form, aplicar_para_todos: e.target.checked })}
                      className="rounded border-amber-500/50 bg-[#0B0D11] text-emerald-500"
                    />
                    <span> Aplicar em Lote para Todos os Colaboradores ({data.usuarios.length})</span>
                  </label>
                )}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Título Oficial do Registro / Recurso</label>
              <input
                type="text"
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
              />
            </div>

            
            {(recursoAtivo?.itensPadrao?.length || form.itens_aplicados?.length > 0) && (
              <div className="sm:col-span-2 p-3.5 bg-[#05100C] border border-emerald-900/70 rounded-lg space-y-2">
                <div className="text-xs font-bold text-emerald-300">
                   Checklist de Verificação Aplicada (Marque os itens cumpridos)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(recursoAtivo?.itensPadrao || form.itens_aplicados || []).map((item: string, idx: number) => {
                    const checked = Array.isArray(form.itens_aplicados) && form.itens_aplicados.includes(item);
                    return (
                      <label
                        key={idx}
                        className={`flex items-start gap-2 p-2 rounded border text-xs cursor-pointer transition-colors ${
                          checked
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-slate-100'
                            : 'bg-[#0B0D11] border-slate-800 text-slate-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleItemChecklist(item)}
                          className="mt-0.5 rounded border-emerald-500/50 bg-[#0B0D11] text-emerald-500"
                        />
                        <span>{item}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            
            {(recursoAtivo?.possuiAvaliacao ||
              form.categoria === 'Feedback 1:1' ||
              form.categoria === 'Reconhecimento & Clima' ||
              Number(form.nota_avaliacao) > 0) && (
              <div className="sm:col-span-2 p-3.5 bg-purple-950/20 border border-purple-500/30 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-300">
                     Termômetro de Avaliação 360° (Notas de 1 a 5)
                  </span>
                  <span className="px-2.5 py-1 text-xs font-bold bg-purple-500/20 text-purple-200 border border-purple-500/40 rounded">
                    Média Final: {Number(form.nota_avaliacao || 5).toFixed(1)} / 5.0
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                  {[
                    { key: 'assiduidade', label: 'Pontualidade' },
                    { key: 'qualidade', label: 'Qualidade Técnica' },
                    { key: 'equipe', label: 'Espírito Equipe' },
                    { key: 'agilidade', label: 'Agilidade/Entrega' },
                    { key: 'seguranca', label: 'Higiene & EPI' }
                  ].map((crit) => (
                    <div key={crit.key} className="p-2 bg-[#0B0D11] border border-slate-800 rounded">
                      <label className="block text-[10px] text-slate-400 mb-1">{crit.label}</label>
                      <select
                        value={(notas360 as any)[crit.key]}
                        onChange={(e) =>
                          atualizarNotaMedia360({
                            ...notas360,
                            [crit.key]: Number(e.target.value)
                          })
                        }
                        className="w-full bg-transparent text-xs font-bold text-amber-300 focus:outline-none"
                      >
                        {[5, 4, 3, 2, 1].map((n) => (
                          <option key={n} value={n} className="bg-[#0B0D11] text-slate-100">
                            {n} 
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            
            {(recursoAtivo?.possuiValorFinanceiro ||
              form.categoria === 'Benefícios & Vales' ||
              form.categoria === 'Investimento Pessoal' ||
              Number(form.valor_financeiro) > 0) && (
              <div className="sm:col-span-2 p-3.5 bg-emerald-950/20 border border-emerald-500/30 rounded-lg grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-xs font-bold text-emerald-300 mb-1">
                     Valor Financeiro do Benefício / Vale / Bônus (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.valor_financeiro || ''}
                    onChange={(e) => setForm({ ...form, valor_financeiro: Number(e.target.value) })}
                    placeholder="0,00"
                    className="w-full px-3 py-2 bg-[#0B0D11] border border-emerald-500/40 rounded text-xs font-mono text-emerald-200"
                  />
                </div>
                {!form.id && (
                  <label className="flex items-start gap-2 text-xs text-slate-200 cursor-pointer pt-2 sm:pt-4">
                    <input
                      type="checkbox"
                      checked={Boolean(form.lancar_caixa)}
                      onChange={(e) => setForm({ ...form, lancar_caixa: e.target.checked })}
                      className="mt-0.5 rounded border-emerald-500/50 bg-[#0B0D11] text-emerald-500"
                    />
                    <span>
                      Lançar saída automaticamente no <strong>Livro Caixa</strong> (Despesa de Pessoal / RH)
                    </span>
                  </label>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs text-slate-400 mb-1">Data de Aplicação</label>
              <input
                type="date"
                value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })}
                className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Próxima Revisão / Validade (ASO, EPI, Ciclo PDI)
              </label>
              <input
                type="date"
                value={form.validade_data || ''}
                onChange={(e) => setForm({ ...form, validade_data: e.target.value })}
                className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">
                Descrição Operacional, Acordos e Observações
              </label>
              <textarea
                rows={3}
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-amber-400 mb-1">
                 Prontuário Sensível LGPD (Criptografia AES-256-GCM Art. 11)
              </label>
              <input
                type="text"
                value={form.segredo}
                onChange={(e) => setForm({ ...form, segredo: e.target.value })}
                placeholder="Ex: ASO #9912, CA de EPI, Hash de Assinatura Portaria 671, Acordo PDI ou CID restrito..."
                className="w-full px-3 py-2 bg-[#0B0D11] border border-amber-500/40 rounded text-xs font-mono text-emerald-300"
              />
            </div>

            {!form.id && (
              <div className="sm:col-span-2 pt-1">
                <label className="flex items-center gap-2 text-xs text-emerald-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(form.notificar_wpp)}
                    onChange={(e) => setForm({ ...form, notificar_wpp: e.target.checked })}
                    className="rounded border-emerald-500/50 bg-[#0B0D11] text-emerald-500"
                  />
                  <span>
                     Enviar comunicado/comprovante automaticamente no WhatsApp do colaborador (Comunidade WPP)
                  </span>
                </label>
              </div>
            )}
          </div>
        </div>
      </FocusFormModal>
    </div>
  );
}

export interface UnidadesTabProps extends CommonTabProps {
  securityGeofenceConfig?: SecurityGeofenceTurnoConfig;
  onUpdateSecurityGeofenceConfig?: (cfg: SecurityGeofenceTurnoConfig) => void;
  userGpsLocation?: {
    latitude: number;
    longitude: number;
    accuracy: number;
    simulated: boolean;
    label: string;
  };
  onCalibrateGpsToCoords?: (lat: number, lng: number, label: string) => void;
}

const CIDADES_PRESETS_GPS: { label: string; cidade: string; lat: number; lng: number }[] = [
  { label: 'Belém - PA (Centro / Doca)', cidade: 'Belém - PA', lat: -1.455833, lng: -48.503889 },
  { label: 'Ananindeua - PA (Cidade Nova)', cidade: 'Ananindeua - PA', lat: -1.3656, lng: -48.3722 },
  { label: 'Santarém - PA (Orla / Alter)', cidade: 'Santarém - PA', lat: -2.44306, lng: -54.70833 },
  { label: 'Manaus - AM (Adrianópolis)', cidade: 'Manaus - AM', lat: -3.10194, lng: -60.025 },
  { label: 'São Paulo - SP (Paulista / Jardins)', cidade: 'São Paulo - SP', lat: -23.561414, lng: -46.655881 },
  { label: 'Rio de Janeiro - RJ (Zona Sul)', cidade: 'Rio de Janeiro - RJ', lat: -22.971177, lng: -43.182543 },
  { label: 'Belo Horizonte - MG (Savassi)', cidade: 'Belo Horizonte - MG', lat: -19.9386, lng: -43.9352 },
  { label: 'Curitiba - PR (Batel)', cidade: 'Curitiba - PR', lat: -25.441105, lng: -49.276855 },
  { label: 'Fortaleza - CE (Meireles)', cidade: 'Fortaleza - CE', lat: -3.7265, lng: -38.4961 },
  { label: 'Brasília - DF (Asa Sul)', cidade: 'Brasília - DF', lat: -15.7942, lng: -47.8825 }
];

function calcularDistanciaMetrosLocal(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function extrairCoordenadasDeTextoOuLink(raw: string): { lat: number; lng: number } | null {
  const txt = String(raw || '').trim();
  if (!txt) return null;
  const atMatch = txt.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    const lat = Number(atMatch[1]);
    const lng = Number(atMatch[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  const qMatch = txt.match(/[?&](?:q|ll|query)=(-?\d+\.\d+)(?:,|%2C)(-?\d+\.\d+)/i);
  if (qMatch) {
    const lat = Number(qMatch[1]);
    const lng = Number(qMatch[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  const pairMatch = txt.match(/(-?\d{1,2}\.\d{3,})\s*[,;/\s]\s*(-?\d{1,3}\.\d{3,})/);
  if (pairMatch) {
    const lat = Number(pairMatch[1]);
    const lng = Number(pairMatch[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng };
    }
  }
  return null;
}

export function UnidadesTab({
  data,
  onRefresh,
  showAlert,
  showConfirm,
  deepLinkEntityId,
  clearDeepLink,
  securityGeofenceConfig,
  onUpdateSecurityGeofenceConfig,
  userGpsLocation,
  onCalibrateGpsToCoords
}: UnidadesTabProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [capturingGps, setCapturingGps] = useState(false);
  const [mapsPasteInput, setMapsPasteInput] = useState('');
  const [syncWithMainGeofence, setSyncWithMainGeofence] = useState(true);
  const [gpsFeedbackBanner, setGpsFeedbackBanner] = useState<string | null>(null);

  const defaultLat = securityGeofenceConfig?.empresaLatitude ?? -1.455833;
  const defaultLng = securityGeofenceConfig?.empresaLongitude ?? -48.503889;
  const defaultRaio = securityGeofenceConfig?.raioPermitidoMetros ?? 150;

  const [form, setForm] = useState<any>({
    id: null,
    nome: '',
    cidade: '',
    endereco: '',
    latitude: defaultLat,
    longitude: defaultLng,
    raio_metros: defaultRaio,
    exigir_gps_local: true,
    sede_principal: false,
    setoresIds: [],
    checklistsIds: [],
    usuariosIds: []
  });

  const openUnidade = (u?: any) => {
    setMapsPasteInput('');
    if (u) {
      const sIds = (data.relacionamentos.rel_unidade_setor || [])
        .filter((r) => Number(r.unidade_id) === Number(u.id))
        .map((r) => Number(r.setor_id));
      const cIds = (data.relacionamentos.rel_unidade_checklist || [])
        .filter((r) => Number(r.unidade_id) === Number(u.id))
        .map((r) => Number(r.checklist_id));
      const uIds = (data.relacionamentos.rel_unidade_usuario || [])
        .filter((r) => Number(r.unidade_id) === Number(u.id))
        .map((r) => Number(r.usuario_id));
      setForm({
        id: u.id,
        nome: u.nome || '',
        cidade: u.cidade || '',
        endereco: u.endereco || '',
        latitude: Number.isFinite(Number(u.latitude)) ? Number(u.latitude) : defaultLat,
        longitude: Number.isFinite(Number(u.longitude)) ? Number(u.longitude) : defaultLng,
        raio_metros: Number(u.raio_metros || defaultRaio),
        exigir_gps_local: u.exigir_gps_local !== false,
        sede_principal: Boolean(u.sede_principal),
        setoresIds: sIds,
        checklistsIds: cIds,
        usuariosIds: uIds
      });
    } else {
      setForm({
        id: null,
        nome: '',
        cidade: 'Belém - PA',
        endereco: '',
        latitude: userGpsLocation?.latitude ?? defaultLat,
        longitude: userGpsLocation?.longitude ?? defaultLng,
        raio_metros: defaultRaio,
        exigir_gps_local: true,
        sede_principal: data.unidades.length === 0,
        setoresIds: [1],
        checklistsIds: [1],
        usuariosIds: [1]
      });
    }
    setModalOpen(true);
  };

  useEffect(() => {
    if (deepLinkEntityId) {
      const alvo = data.unidades.find((u) => Number(u.id) === Number(deepLinkEntityId));
      if (alvo) openUnidade(alvo);
      clearDeepLink();
    }
  }, [deepLinkEntityId, data.unidades, clearDeepLink]);

  const toggle = (arr: number[], id: number) =>
    arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];

  const handleCapturarGpsRealAparelho = (applyToForm: boolean) => {
    setCapturingGps(true);
    setGpsFeedbackBanner(null);

    const applyCoords = (lat: number, lng: number, origemLabel: string) => {
      const cleanLat = Number(lat.toFixed(6));
      const cleanLng = Number(lng.toFixed(6));
      if (applyToForm) {
        setForm((prev: any) => ({
          ...prev,
          latitude: cleanLat,
          longitude: cleanLng
        }));
      }
      if (onCalibrateGpsToCoords) {
        onCalibrateGpsToCoords(cleanLat, cleanLng, origemLabel);
      }
      setCapturingGps(false);
      setGpsFeedbackBanner(
        `Localização capturada com sucesso (${cleanLat}, ${cleanLng}) — ${origemLabel}.`
      );
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          applyCoords(pos.coords.latitude, pos.coords.longitude, 'GPS Real do Aparelho');
        },
        () => {
          const fallbackLat = userGpsLocation?.latitude ?? defaultLat;
          const fallbackLng = userGpsLocation?.longitude ?? defaultLng;
          applyCoords(fallbackLat, fallbackLng, 'Posição Calibrada do Dispositivo');
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
      );
    } else {
      const fallbackLat = userGpsLocation?.latitude ?? defaultLat;
      const fallbackLng = userGpsLocation?.longitude ?? defaultLng;
      applyCoords(fallbackLat, fallbackLng, 'Posição Calibrada do Dispositivo');
    }
  };

  const handlePasteCoordinates = (val: string) => {
    setMapsPasteInput(val);
    const parsed = extrairCoordenadasDeTextoOuLink(val);
    if (parsed) {
      setForm((prev: any) => ({
        ...prev,
        latitude: Number(parsed.lat.toFixed(6)),
        longitude: Number(parsed.lng.toFixed(6))
      }));
      setGpsFeedbackBanner(
        `Coordenadas extraídas automaticamente: ${parsed.lat.toFixed(6)}, ${parsed.lng.toFixed(6)}`
      );
    }
  };

  const handleAtivarPerimetroUnidade = (u: any, calibrateHere: boolean) => {
    const lat = Number.isFinite(Number(u.latitude)) ? Number(u.latitude) : defaultLat;
    const lng = Number.isFinite(Number(u.longitude)) ? Number(u.longitude) : defaultLng;
    const raio = Math.max(20, Number(u.raio_metros || 150));

    if (onUpdateSecurityGeofenceConfig && securityGeofenceConfig) {
      onUpdateSecurityGeofenceConfig({
        ...securityGeofenceConfig,
        empresaNomeReferencia: `${u.nome} (${u.cidade || 'Unidade'})`,
        empresaLatitude: lat,
        empresaLongitude: lng,
        raioPermitidoMetros: raio
      });
    }
    if (calibrateHere && onCalibrateGpsToCoords) {
      onCalibrateGpsToCoords(lat, lng, `Dentro de ${u.nome} (0m)`);
    }
    setGpsFeedbackBanner(
      calibrateHere
        ? `Perímetro de "${u.nome}" ativado (raio ${raio}m) e seu GPS foi calibrado como Dentro da Unidade (0m).`
        : `Perímetro principal atualizado para "${u.nome}" (${lat.toFixed(5)}, ${lng.toFixed(5)} • Raio ${raio}m).`
    );
  };

  const handleSave = async () => {
    if (!String(form.nome || '').trim()) {
      showAlert('Nome Obrigatório', 'Informe o nome da unidade ou local de trabalho.');
      return;
    }
    try {
      const payload = {
        ...form,
        empresa_id: (data as any).empresaAtivaId || 1,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        raio_metros: Math.max(20, Number(form.raio_metros || 150))
      };
      const res = await fetch('/api/unidades/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || 'Erro ao salvar unidade');

      if (syncWithMainGeofence && onUpdateSecurityGeofenceConfig && securityGeofenceConfig) {
        onUpdateSecurityGeofenceConfig({
          ...securityGeofenceConfig,
          enderecoReferencia: `${form.nome} (${form.cidade || 'Unidade'})`,
          empresaNomeReferencia: `${form.nome} (${form.cidade || 'Unidade'})`,
          empresaLatitude: Number(form.latitude),
          empresaLongitude: Number(form.longitude),
          raioPermitidoMetros: Math.max(20, Number(form.raio_metros || 150))
        });
      }
      if (syncWithMainGeofence && onCalibrateGpsToCoords) {
        onCalibrateGpsToCoords(
          Number(form.latitude),
          Number(form.longitude),
          `Dentro de ${form.nome} (0m)`
        );
      }

      setModalOpen(false);
      setGpsFeedbackBanner(
        `Unidade "${form.nome}" salva com coordenadas GPS (${Number(form.latitude).toFixed(5)}, ${Number(form.longitude).toFixed(5)}) e raio de ${form.raio_metros}m.`
      );
      await onRefresh();
    } catch (e: any) {
      showAlert('Erro em Unidades', e.message);
    }
  };

  const handleArchive = (id: number) => {
    showConfirm('Arquivar Unidade', 'Confirma o arquivamento lógico desta unidade?', async () => {
      await fetch('/api/unidades/arquivar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      setModalOpen(false);
      await onRefresh();
    });
  };

  const currentUserLat = userGpsLocation?.latitude ?? defaultLat;
  const currentUserLng = userGpsLocation?.longitude ?? defaultLng;

  return (
    <div className="space-y-6 w-full">
      <div className="bg-[#11151E] border border-emerald-500/35 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-[11px] font-mono font-bold uppercase">
              <MapPin className="w-3.5 h-3.5" />
              <span>Painel de Localizações & Perímetro GPS da Empresa</span>
            </div>
            <h2 className="text-lg font-bold text-slate-100">
              Unidades Físicas & Cadastro Rápido de Localização (Geofence)
            </h2>
            <p className="text-xs text-slate-400 max-w-3xl">
              Cadastre o endereço e o ponto GPS de cada unidade em 1 clique. O sistema calcula a distância real em metros para validar presença na empresa com coerência e sem travamentos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleCapturarGpsRealAparelho(false)}
              disabled={capturingGps}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-200 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 rounded-xl cursor-pointer transition-colors"
            >
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span>{capturingGps ? 'Lendo GPS...' : ' Ler Meu GPS Atual'}</span>
            </button>

            <button
              type="button"
              onClick={() => openUnidade()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Unidade / Localização</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-800/90 text-xs">
          <div className="p-3 rounded-xl bg-[#0B0D11] border border-slate-800 flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] text-slate-400">Sua Posição Atual (Dispositivo)</div>
              <div className="font-mono font-bold text-slate-100 mt-0.5">
                {currentUserLat.toFixed(6)}, {currentUserLng.toFixed(6)}
              </div>
              <div className="text-[10px] text-emerald-400 mt-0.5">
                {userGpsLocation?.label || 'GPS Ativo'} (±{userGpsLocation?.accuracy || 8}m)
              </div>
            </div>
            <MapPin className="w-5 h-5 text-emerald-400 shrink-0" />
          </div>

          <div className="p-3 rounded-xl bg-[#0B0D11] border border-slate-800 flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] text-slate-400">Perímetro Principal Ativo</div>
              <div className="font-bold text-amber-300 mt-0.5 truncate max-w-[230px]">
                {securityGeofenceConfig?.empresaNomeReferencia || 'Sede Principal'}
              </div>
              <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                Raio autorizado: {securityGeofenceConfig?.raioPermitidoMetros || 150}m • Trava GPS:{' '}
                {securityGeofenceConfig?.geofenceAtivo ? 'Ativa' : 'Informativa'}
              </div>
            </div>
            <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
          </div>

          <div className="p-3 rounded-xl bg-[#0B0D11] border border-slate-800 flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] text-slate-400">Calibração Rápida de Presença</div>
              <div className="text-[11px] text-slate-300 mt-0.5">
                Está dentro da empresa mas o navegador estimou distância por IP?
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const targetUnit = data.unidades[0];
                if (targetUnit) {
                  handleAtivarPerimetroUnidade(targetUnit, true);
                } else if (onCalibrateGpsToCoords) {
                  onCalibrateGpsToCoords(defaultLat, defaultLng, 'Dentro da Sede (0m)');
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[11px] shrink-0 cursor-pointer hover:bg-emerald-400"
            >
               Estou na Empresa (0m)
            </button>
          </div>
        </div>

        {gpsFeedbackBanner && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-xs text-emerald-200 flex items-center justify-between gap-2">
            <span>{gpsFeedbackBanner}</span>
            <button
              type="button"
              onClick={() => setGpsFeedbackBanner(null)}
              className="text-[11px] font-bold text-emerald-300 hover:text-white cursor-pointer"
            >
              Fechar
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.unidades.map((u: any) => {
          const sCount = (data.relacionamentos.rel_unidade_setor || []).filter(
            (r) => Number(r.unidade_id) === Number(u.id)
          ).length;
          const cCount = (data.relacionamentos.rel_unidade_checklist || []).filter(
            (r) => Number(r.unidade_id) === Number(u.id)
          ).length;
          const uCount = (data.relacionamentos.rel_unidade_usuario || []).filter(
            (r) => Number(r.unidade_id) === Number(u.id)
          ).length;

          const uLat = Number.isFinite(Number(u.latitude)) ? Number(u.latitude) : defaultLat;
          const uLng = Number.isFinite(Number(u.longitude)) ? Number(u.longitude) : defaultLng;
          const uRaio = Math.max(20, Number(u.raio_metros || 150));
          const distMetros = calcularDistanciaMetrosLocal(currentUserLat, currentUserLng, uLat, uLng);
          const isInsideUnit = distMetros <= uRaio;
          const isCurrentMainGeofence =
            Math.abs((securityGeofenceConfig?.empresaLatitude ?? 0) - uLat) < 0.0002 &&
            Math.abs((securityGeofenceConfig?.empresaLongitude ?? 0) - uLng) < 0.0002;

          return (
            <div
              key={u.id}
              onClick={() => openUnidade(u)}
              className={`p-5 bg-[#11151E] border rounded-2xl cursor-pointer space-y-3.5 transition-all ${
                isInsideUnit
                  ? 'border-emerald-500/50 hover:border-emerald-400 shadow-lg shadow-emerald-950/20'
                  : 'border-slate-800/90 hover:border-amber-500/50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs font-bold text-amber-400">UNIDADE #{u.id}</span>
                  {isCurrentMainGeofence && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-[10px] font-mono font-bold text-amber-300">
                       Perímetro Principal
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium text-slate-400">{u.cidade}</span>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-100">{u.nome}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {u.endereco || `Localização registrada em ${u.cidade || 'Belém - PA'}`}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#0B0D11] border border-slate-800/90 space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 text-slate-400 font-mono text-[11px]">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    {uLat.toFixed(5)}, {uLng.toFixed(5)}
                  </span>
                  <span className="font-mono text-[11px] text-slate-300">
                    Raio: <strong>{uRaio}m</strong>
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold ${
                      isInsideUnit
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
                        : 'bg-rose-500/15 text-rose-300 border border-rose-500/40'
                    }`}
                  >
                    {isInsideUnit
                      ? ` Dentro da Unidade (${distMetros}m)`
                      : ` A ${distMetros}m da Unidade`}
                  </span>

                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleAtivarPerimetroUnidade(u, true)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 text-[11px] font-bold cursor-pointer"
                      title="Calibrar minha localização como dentro desta unidade agora"
                    >
                       Estou Aqui
                    </button>
                    {!isCurrentMainGeofence && (
                      <button
                        type="button"
                        onClick={() => handleAtivarPerimetroUnidade(u, false)}
                        className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-[11px] font-bold cursor-pointer"
                        title="Definir como perímetro oficial da empresa"
                      >
                         Ativar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-1.5 text-xs font-mono">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded text-[11px] tag-acai-nn">{sCount} setores</span>
                  <span className="px-2 py-0.5 rounded text-[11px] tag-acai-nn">{cCount} checklists</span>
                  <span className="px-2 py-0.5 rounded text-[11px] bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/35">
                    {uCount} colabs
                  </span>
                </div>
                <span className="text-[11px] text-amber-400 font-sans font-semibold">
                  Editar GPS / Equipe →
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <FocusFormModal
        open={modalOpen}
        title={form.id ? `Editar Unidade & GPS — ${form.nome}` : 'Nova Unidade & Localização GPS'}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onArchive={form.id ? () => handleArchive(form.id) : undefined}
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nome da Unidade / Filial
              </label>
              <input
                type="text"
                placeholder="Ex: Unidade Matriz Doca"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded-lg text-xs text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Endereço / Referência Fácil
              </label>
              <input
                type="text"
                placeholder="Ex: Av. Visconde de Souza Franco, 800"
                value={form.endereco || ''}
                onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded-lg text-xs text-slate-100"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Localização (País, Estado e Cidade)
              </label>
              <UrutauValidatedCityStateSelector
                value={form.cidade}
                onChange={(val) => setForm({ ...form, cidade: val })}
              />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#0B0D11] border border-emerald-500/40 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  <span>Cadastro Fácil de Coordenadas GPS & Perímetro</span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  Capture sua localização com 1 clique, escolha uma cidade ou cole coordenadas/link do Google Maps.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleCapturarGpsRealAparelho(true)}
                disabled={capturingGps}
                className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer inline-flex items-center gap-1.5 shadow-md"
              >
                <MapPin className="w-4 h-4" />
                <span>
                  {capturingGps
                    ? 'Capturando GPS...'
                    : ' Capturar Minha Localização Atual (1 Clique)'}
                </span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Colar Link do Google Maps ou Coordenadas (ex: -1.4558, -48.5039)
                </label>
                <input
                  type="text"
                  value={mapsPasteInput}
                  onChange={(e) => handlePasteCoordinates(e.target.value)}
                  placeholder="Cole aqui o link do Google Maps ou latitude, longitude..."
                  className="w-full px-3 py-2 bg-[#11151E] border border-slate-700 rounded-lg text-xs text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Ou escolha uma Cidade / Polo de Referência Rápida
                </label>
                <select
                  value=""
                  onChange={(e) => {
                    const preset = CIDADES_PRESETS_GPS.find((c) => c.label === e.target.value);
                    if (preset) {
                      setForm((prev: any) => ({
                        ...prev,
                        cidade: preset.cidade,
                        latitude: preset.lat,
                        longitude: preset.lng
                      }));
                    }
                  }}
                  className="w-full px-3 py-2 bg-[#11151E] border border-slate-700 rounded-lg text-xs text-slate-100"
                >
                  <option value="">Selecionar cidade para preencher coordenadas...</option>
                  {CIDADES_PRESETS_GPS.map((c) => (
                    <option key={c.label} value={c.label}>
                      {c.label} ({c.lat.toFixed(4)}, {c.lng.toFixed(4)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Latitude GPS</label>
                <input
                  type="number"
                  step="0.000001"
                  value={form.latitude}
                  onChange={(e) => setForm({ ...form, latitude: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-[#11151E] border border-slate-700 rounded-lg text-xs font-mono text-emerald-300"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Longitude GPS</label>
                <input
                  type="number"
                  step="0.000001"
                  value={form.longitude}
                  onChange={(e) => setForm({ ...form, longitude: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-[#11151E] border border-slate-700 rounded-lg text-xs font-mono text-emerald-300"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Raio do Perímetro Permitido: <strong className="text-amber-300">{form.raio_metros}m</strong>
                </label>
                <div className="flex items-center gap-1.5">
                  {[50, 100, 150, 300, 500, 1000].map((rVal) => (
                    <button
                      key={rVal}
                      type="button"
                      onClick={() => setForm({ ...form, raio_metros: rVal })}
                      className={`px-2 py-1.5 rounded text-[11px] font-mono font-bold cursor-pointer ${
                        Number(form.raio_metros) === rVal
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-[#11151E] text-slate-300 border border-slate-700 hover:border-amber-400'
                      }`}
                    >
                      {rVal}m
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-emerald-200 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={syncWithMainGeofence}
                onChange={(e) => setSyncWithMainGeofence(e.target.checked)}
                className="accent-emerald-500"
              />
              <span>
                Ativar esta unidade como Perímetro GPS Oficial da Empresa e calibrar minha presença ao salvar
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-[#0B0D11] border border-slate-800 rounded-xl space-y-2 max-h-52 overflow-y-auto">
              <div className="text-xs font-semibold text-amber-400">Setores Vinculados</div>
              {data.setores.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.setoresIds.includes(s.id)}
                    onChange={() => setForm({ ...form, setoresIds: toggle(form.setoresIds, s.id) })}
                    className="accent-amber-500"
                  />
                  <span>{s.nome}</span>
                </label>
              ))}
            </div>
            <div className="p-3 bg-[#0B0D11] border border-slate-800 rounded-xl space-y-2 max-h-52 overflow-y-auto">
              <div className="text-xs font-semibold text-amber-400">Checklists Vinculados</div>
              {data.checklists.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.checklistsIds.includes(c.id)}
                    onChange={() =>
                      setForm({ ...form, checklistsIds: toggle(form.checklistsIds, c.id) })
                    }
                    className="accent-amber-500"
                  />
                  <span className="truncate">{c.titulo}</span>
                </label>
              ))}
            </div>
            <div className="p-3 bg-[#0B0D11] border border-slate-800 rounded-xl space-y-2 max-h-52 overflow-y-auto">
              <div className="text-xs font-semibold text-amber-400">Equipe Lotada</div>
              {data.usuarios.map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.usuariosIds.includes(u.id)}
                    onChange={() =>
                      setForm({ ...form, usuariosIds: toggle(form.usuariosIds, u.id) })
                    }
                    className="accent-amber-500"
                  />
                  <span>{u.nome}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </FocusFormModal>
    </div>
  );
}

export function SetoresTab({
  data,
  onRefresh,
  onNavigateDeepLink,
  showAlert,
  showConfirm,
  deepLinkEntityId,
  clearDeepLink
}: CommonTabProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [universoSetor, setUniversoSetor] = useState<any | null>(null);
  const [form, setForm] = useState<any>({
    id: null,
    nome: '',
    descricao: '',
    peso_rateio: 1.0,
    unidadesIds: [],
    checklistsIds: [],
    usuariosIds: []
  });

  useEffect(() => {
    if (deepLinkEntityId) {
      const alvo = data.setores.find((s) => Number(s.id) === Number(deepLinkEntityId));
      if (alvo) setUniversoSetor(alvo);
      clearDeepLink();
    }
  }, [deepLinkEntityId, data.setores, clearDeepLink]);

  const openEditSetor = (s?: any) => {
    if (s) {
      const uIds = (data.relacionamentos.rel_setor_unidade || [])
        .filter((r) => Number(r.setor_id) === Number(s.id))
        .map((r) => Number(r.unidade_id));
      const cIds = (data.relacionamentos.rel_setor_checklist || [])
        .filter((r) => Number(r.setor_id) === Number(s.id))
        .map((r) => Number(r.checklist_id));
      const usIds = (data.relacionamentos.rel_setor_usuario || [])
        .filter((r) => Number(r.setor_id) === Number(s.id))
        .map((r) => Number(r.usuario_id));
      setForm({
        id: s.id,
        nome: s.nome,
        descricao: s.descricao,
        peso_rateio: s.peso_rateio || 1.0,
        unidadesIds: uIds,
        checklistsIds: cIds,
        usuariosIds: usIds
      });
    } else {
      setForm({
        id: null,
        nome: '',
        descricao: '',
        peso_rateio: 1.0,
        unidadesIds: [1],
        checklistsIds: [1],
        usuariosIds: []
      });
    }
    setModalOpen(true);
  };

  const toggle = (arr: number[], id: number) =>
    arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];

  const handleSave = async () => {
    try {
      const res = await fetch('/api/setores/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error('Erro ao salvar setor');
      setModalOpen(false);
      await onRefresh();
    } catch (e: any) {
      showAlert('Erro em Setores', e.message);
    }
  };

  const handleArchive = (id: number) => {
    showConfirm('Arquivar Setor', 'Confirma o arquivamento lógico deste setor?', async () => {
      await fetch('/api/setores/arquivar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      setModalOpen(false);
      await onRefresh();
    });
  };

  return (
    <div className="space-y-6 w-full">
      <div className="bg-[#11151E] border border-slate-800/90 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-slate-100">
          Setores
        </h2>
        <button
          type="button"
          onClick={() => openEditSetor()}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Novo Setor</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {data.setores.map((s) => (
          <div
            key={s.id}
            className="p-5 bg-[#11151E] border border-slate-800/90 rounded-lg flex flex-col justify-between gap-4"
          >
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-amber-400">
                  PESO RATEIO: {Number(s.peso_rateio || 1).toFixed(1)}x
                </span>
                <button
                  type="button"
                  onClick={() => openEditSetor(s)}
                  className="text-slate-400 hover:text-slate-100"
                >
                  Editar Cadastro
                </button>
              </div>
              <h3 className="text-base font-semibold text-slate-100 mt-1">{s.nome}</h3>
              <p className="text-xs text-slate-400 mt-1">{s.descricao}</p>
            </div>

            <button
              type="button"
              onClick={() => setUniversoSetor(s)}
              className="w-full py-2 bg-amber-500/15 hover:bg-amber-500 hover:text-slate-950 text-amber-300 border border-amber-500/35 rounded text-xs font-semibold transition-colors"
            >
              Abrir Universo do Setor
            </button>
          </div>
        ))}
      </div>

      
      <FocusFormModal
        open={!!universoSetor}
        title={`Universo 360° do Setor — ${universoSetor?.nome || ''}`}
        subtitle="Mapeamento transversal de todas as entidades conectadas a este setor com Deep-Linking direto"
        onClose={() => setUniversoSetor(null)}
      >
        {universoSetor && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-[#0B0D11] border border-slate-800 rounded-lg space-y-2">
              <div className="font-semibold text-amber-400">Unidades que Operam este Setor</div>
              {(data.relacionamentos.rel_setor_unidade || [])
                .filter((r) => Number(r.setor_id) === Number(universoSetor.id))
                .map((r) => {
                  const un = data.unidades.find((u) => Number(u.id) === Number(r.unidade_id));
                  if (!un) return null;
                  return (
                    <button
                      key={un.id}
                      type="button"
                      onClick={() => {
                        setUniversoSetor(null);
                        onNavigateDeepLink({ tab: 'unidades', entityId: un.id, action: 'edit' });
                      }}
                      className="w-full text-left p-2 bg-[#11151E] hover:border-amber-500 border border-slate-800 rounded flex items-center justify-between"
                    >
                      <span>{un.nome}</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
                    </button>
                  );
                })}
            </div>

            <div className="p-4 bg-[#0B0D11] border border-slate-800 rounded-lg space-y-2">
              <div className="font-semibold text-amber-400">Colaboradores Lotados</div>
              {(data.relacionamentos.rel_setor_usuario || [])
                .filter((r) => Number(r.setor_id) === Number(universoSetor.id))
                .map((r) => {
                  const us = data.usuarios.find((u) => Number(u.id) === Number(r.usuario_id));
                  if (!us) return null;
                  return (
                    <button
                      key={us.id}
                      type="button"
                      onClick={() => {
                        setUniversoSetor(null);
                        onNavigateDeepLink({ tab: 'equipe', entityId: us.id, action: 'edit' });
                      }}
                      className="w-full text-left p-2 bg-[#11151E] hover:border-amber-500 border border-slate-800 rounded flex items-center justify-between"
                    >
                      <span>
                        {us.nome} ({us.cargo})
                      </span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
                    </button>
                  );
                })}
            </div>

            <div className="p-4 bg-[#0B0D11] border border-slate-800 rounded-lg space-y-2">
              <div className="font-semibold text-amber-400">Checklists Obrigatórios</div>
              {(data.relacionamentos.rel_setor_checklist || [])
                .filter((r) => Number(r.setor_id) === Number(universoSetor.id))
                .map((r) => {
                  const ck = data.checklists.find((c) => Number(c.id) === Number(r.checklist_id));
                  if (!ck) return null;
                  return (
                    <button
                      key={ck.id}
                      type="button"
                      onClick={() => {
                        setUniversoSetor(null);
                        onNavigateDeepLink({ tab: 'checklists', entityId: ck.id, action: 'edit' });
                      }}
                      className="w-full text-left p-2 bg-[#11151E] hover:border-amber-500 border border-slate-800 rounded flex items-center justify-between"
                    >
                      <span className="truncate">{ck.titulo}</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    </button>
                  );
                })}
            </div>
          </div>
        )}
      </FocusFormModal>

      <FocusFormModal
        open={modalOpen}
        title={form.id ? `Editar Setor — ${form.nome}` : 'Novo Setor'}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onArchive={form.id ? () => handleArchive(form.id) : undefined}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Nome do Setor</label>
            <input
              type="text"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Peso Multiplicador no Rateio</label>
            <input
              type="number"
              step="0.1"
              value={form.peso_rateio}
              onChange={(e) => setForm({ ...form, peso_rateio: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs font-mono text-slate-100"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-400 mb-1">Descrição Operacional</label>
            <textarea
              rows={2}
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 bg-[#0B0D11] border border-slate-800 rounded space-y-2">
            <div className="text-xs font-semibold text-amber-400">Unidades Vinculadas</div>
            {data.unidades.map((u) => (
              <label key={u.id} className="flex items-center gap-2 text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={form.unidadesIds.includes(u.id)}
                  onChange={() => setForm({ ...form, unidadesIds: toggle(form.unidadesIds, u.id) })}
                  className="accent-amber-500"
                />
                <span>{u.nome}</span>
              </label>
            ))}
          </div>
          <div className="p-3 bg-[#0B0D11] border border-slate-800 rounded space-y-2">
            <div className="text-xs font-semibold text-amber-400">Checklists Vinculados</div>
            {data.checklists.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={form.checklistsIds.includes(c.id)}
                  onChange={() =>
                    setForm({ ...form, checklistsIds: toggle(form.checklistsIds, c.id) })
                  }
                  className="accent-amber-500"
                />
                <span className="truncate">{c.titulo}</span>
              </label>
            ))}
          </div>
          <div className="p-3 bg-[#0B0D11] border border-slate-800 rounded space-y-2">
            <div className="text-xs font-semibold text-amber-400">Colaboradores Vinculados</div>
            {data.usuarios.map((u) => (
              <label key={u.id} className="flex items-center gap-2 text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={form.usuariosIds.includes(u.id)}
                  onChange={() => setForm({ ...form, usuariosIds: toggle(form.usuariosIds, u.id) })}
                  className="accent-amber-500"
                />
                <span>{u.nome}</span>
              </label>
            ))}
          </div>
        </div>
      </FocusFormModal>
    </div>
  );
}

export function ChecklistsTab({
  data,
  onRefresh,
  showAlert,
  showConfirm,
  deepLinkEntityId,
  clearDeepLink
}: CommonTabProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [novoItemTexto, setNovoItemTexto] = useState('');
  const [form, setForm] = useState<any>({
    id: null,
    titulo: '',
    descricao: '',
    itens: [],
    unidadesIds: [1],
    setoresIds: [1],
    usuariosIds: [1]
  });

  const openChecklist = (c?: any) => {
    if (c) {
      const uIds = (data.relacionamentos.rel_checklist_unidade || [])
        .filter((r) => Number(r.checklist_id) === Number(c.id))
        .map((r) => Number(r.unidade_id));
      const sIds = (data.relacionamentos.rel_checklist_setor || [])
        .filter((r) => Number(r.checklist_id) === Number(c.id))
        .map((r) => Number(r.setor_id));
      const usIds = (data.relacionamentos.rel_checklist_usuario || [])
        .filter((r) => Number(r.checklist_id) === Number(c.id))
        .map((r) => Number(r.usuario_id));
      setForm({
        id: c.id,
        titulo: c.titulo,
        descricao: c.descricao,
        itens: Array.isArray(c.itens_json) ? c.itens_json : [],
        unidadesIds: uIds,
        setoresIds: sIds,
        usuariosIds: usIds
      });
    } else {
      setForm({
        id: null,
        titulo: '',
        descricao: '',
        itens: [{ texto: 'Inspecionar conformidade inicial do turno', concluido: false }],
        unidadesIds: [1],
        setoresIds: [1],
        usuariosIds: [1]
      });
    }
    setModalOpen(true);
  };

  useEffect(() => {
    if (deepLinkEntityId) {
      const alvo = data.checklists.find((c) => Number(c.id) === Number(deepLinkEntityId));
      if (alvo) openChecklist(alvo);
      clearDeepLink();
    }
  }, [deepLinkEntityId, data.checklists, clearDeepLink]);

  const toggleChecklistItemDirect = async (ck: any, idxItem: number) => {
    const novosItens = (ck.itens_json || []).map((it: any, idx: number) =>
      idx === idxItem ? { ...it, concluido: !it.concluido } : it
    );
    await fetch('/api/checklists/salvar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: ck.id,
        titulo: ck.titulo,
        descricao: ck.descricao,
        itens: novosItens
      })
    });
    await onRefresh();
  };

  const handleSave = async () => {
    try {
      const res = await fetch('/api/checklists/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error('Erro ao salvar checklist');
      setModalOpen(false);
      await onRefresh();
    } catch (e: any) {
      showAlert('Erro em Checklists', e.message);
    }
  };

  const handleArchive = (id: number) => {
    showConfirm('Arquivar Checklist', 'Confirma o arquivamento lógico deste checklist?', async () => {
      await fetch('/api/checklists/arquivar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      setModalOpen(false);
      await onRefresh();
    });
  };

  return (
    <div className="space-y-6 w-full">
      <div className="bg-[#11151E] border border-slate-800/90 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-slate-100">
          Checklists
        </h2>
        <button
          type="button"
          onClick={() => openChecklist()}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Novo Checklist</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {data.checklists.map((ck) => {
          const itens = Array.isArray(ck.itens_json) ? ck.itens_json : [];
          const concluidos = itens.filter((i: any) => i.concluido).length;
          return (
            <div
              key={ck.id}
              className="p-5 bg-[#11151E] border border-slate-800/90 rounded-lg flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-amber-400">
                    CONFORMIDADE: {concluidos}/{itens.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => openChecklist(ck)}
                    className="text-xs text-slate-400 hover:text-amber-400"
                  >
                    Configurar N:N
                  </button>
                </div>
                <h3 className="text-base font-semibold text-slate-100">{ck.titulo}</h3>
                <p className="text-xs text-slate-400">{ck.descricao}</p>

                <div className="space-y-2 pt-2 border-t border-slate-800">
                  {itens.map((it: any, idx: number) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleChecklistItemDirect(ck, idx)}
                      className="w-full text-left flex items-start gap-2.5 p-2 rounded bg-[#0B0D11] hover:bg-slate-800/60 border border-slate-800/80 text-xs transition-colors"
                    >
                      {it.concluido ? (
                        <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                      )}
                      <span className={it.concluido ? 'line-through text-slate-500' : 'text-slate-200'}>
                        {it.texto}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <FocusFormModal
        open={modalOpen}
        title={form.id ? `Editar Checklist — ${form.titulo}` : 'Novo Checklist Operacional'}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onArchive={form.id ? () => handleArchive(form.id) : undefined}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Título do Checklist</label>
            <input
              type="text"
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Descrição</label>
            <input
              type="text"
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
            />
          </div>

          <div className="p-3.5 bg-[#0B0D11] border border-slate-800 rounded-lg space-y-2.5">
            <div className="text-xs font-semibold text-amber-400">Itens de Verificação</div>
            <div className="flex gap-2">
              <input
                type="text"
                value={novoItemTexto}
                onChange={(e) => setNovoItemTexto(e.target.value)}
                placeholder="Adicionar novo passo de verificação..."
                className="flex-1 px-3 py-1.5 bg-[#11151E] border border-slate-700 rounded text-xs text-slate-100"
              />
              <button
                type="button"
                onClick={() => {
                  if (!novoItemTexto.trim()) return;
                  setForm({
                    ...form,
                    itens: [...form.itens, { texto: novoItemTexto.trim(), concluido: false }]
                  });
                  setNovoItemTexto('');
                }}
                className="px-3 py-1.5 bg-amber-500 text-slate-950 font-semibold text-xs rounded"
              >
                Incluir Item
              </button>
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {form.itens.map((it: any, i: number) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-3 py-1.5 bg-[#11151E] border border-slate-800 rounded text-xs"
                >
                  <span>{it.texto}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        itens: form.itens.filter((_: any, idx: number) => idx !== i)
                      })
                    }
                    className="text-rose-400 hover:text-rose-300"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </FocusFormModal>
    </div>
  );
}

export function NotificacoesTab({
  data,
  onRefresh,
  showAlert,
  showConfirm,
  sseEventHistory
}: CommonTabProps & { sseEventHistory: { id: string; evento: string; ts: string; payload: any }[] }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<any>({
    id: null,
    titulo: '',
    mensagem: '',
    destino_wpp: '5591999990001',
    horario_disparo: '00:30',
    status: 'Programada'
  });

  const handleSave = async () => {
    try {
      const res = await fetch('/api/v20/notificacoes/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error('Erro ao salvar notificação');
      setModalOpen(false);
      await onRefresh();
    } catch (e: any) {
      showAlert('Erro em Notificações', e.message);
    }
  };

  const handleArchive = (id: number) => {
    showConfirm('Arquivar Notificação Programada', 'Confirma o arquivamento lógico deste alerta?', async () => {
      await fetch('/api/erp/arquivar-generico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, tabelaAlvo: 'erp_notificacoes' })
      });
      setModalOpen(false);
      await onRefresh();
    });
  };

  return (
    <div className="space-y-6 w-full">
      <div className="bg-[#11151E] border border-slate-800/90 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <UrutauEmblemSVG className="w-8 h-8 shrink-0" postura="canto" />
          <h2 className="text-base font-semibold text-slate-100">
            Notificações
          </h2>
        </div>
        <button
          type="button"
          onClick={() => {
            setForm({
              id: null,
              titulo: '',
              mensagem: '',
              destino_wpp: '5591999990001',
              horario_disparo: '01:00',
              status: 'Programada'
            });
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#05100C] bg-[#10B981] hover:bg-[#34D399] rounded min-h-[44px]"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Programar Disparo WhatsApp</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <div className="bg-[#11151E] border border-slate-800/90 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">
              Disparos Programados (WhatsApp)
            </h3>
          </div>
          <div className="divide-y divide-slate-800/60">
            {data.notificacoes.map((n) => (
              <div
                key={n.id}
                onClick={() => {
                  setForm({ ...n });
                  setModalOpen(true);
                }}
                className="p-4 hover:bg-[#113025]/60 cursor-pointer space-y-1.5 transition-colors"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-100">{n.titulo}</span>
                  <span className="font-mono text-[#F59E0B]">
                    {n.horario_disparo} · {n.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{n.mensagem}</p>
                <div className="text-[11px] font-mono text-[#94A3B8]">
                  Destino WhatsApp: {n.destino_wpp}
                </div>
              </div>
            ))}
          </div>
        </div>

        
        <div className="bg-[#11151E] border border-slate-800/90 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UrutauEmblemSVG className="w-5 h-5" postura="sentinela" />
              <h3 className="text-sm font-semibold text-slate-200">
                Eventos SSE em Tempo Real
              </h3>
            </div>
            <span className="text-xs font-mono text-[#10B981]">ONLINE</span>
          </div>
          <div className="divide-y divide-slate-800/60 max-h-96 overflow-y-auto">
            {sseEventHistory.map((ev, idx) => (
              <div
                key={ev.id}
                className={`p-3.5 text-xs space-y-1 ${idx === 0 ? 'sse-bioluminescent-pulse' : ''}`}
              >
                <div className="flex items-center justify-between font-mono">
                  <span className="text-[#10B981] font-semibold">{ev.evento}</span>
                  <span className="text-[#94A3B8]">{ev.ts}</span>
                </div>
                <div className="font-mono text-[11px] text-[#94A3B8] truncate">
                  {JSON.stringify(ev.payload)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <FocusFormModal
        open={modalOpen}
        title={form.id ? 'Editar Alerta Programado' : 'Novo Disparo Programado WhatsApp'}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onArchive={form.id ? () => handleArchive(form.id) : undefined}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-400 mb-1">Título do Alerta</label>
            <input
              type="text"
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">WhatsApp de Destino</label>
            <input
              type="text"
              value={form.destino_wpp}
              onChange={(e) => setForm({ ...form, destino_wpp: e.target.value })}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs font-mono text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Horário de Disparo</label>
            <input
              type="time"
              value={form.horario_disparo}
              onChange={(e) => setForm({ ...form, horario_disparo: e.target.value })}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs font-mono text-slate-100"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-400 mb-1">Mensagem a Disparar</label>
            <textarea
              rows={3}
              value={form.mensagem}
              onChange={(e) => setForm({ ...form, mensagem: e.target.value })}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
            />
          </div>
        </div>
      </FocusFormModal>
    </div>
  );
}

interface VpsExplorerItem {
  name: string;
  relPath: string;
  isDirectory: boolean;
  ext: string;
  sizeBytes: number;
  updatedAt: string;
  commentCount: number;
  isProtected: boolean;
}

export function VpsFileExplorerPanel({
  showAlert,
  showConfirm,
  onAfterSanitize
}: {
  showAlert: (titulo: string, mensagem: string, detalhes?: string) => void;
  showConfirm?: (titulo: string, mensagem: string, onConfirm: () => void) => void;
  onAfterSanitize?: () => void;
}) {
  const [currentDir, setCurrentDir] = useState<string>('');
  const [rootDirLabel, setRootDirLabel] = useState<string>('/var/www/urutau-erp');
  const [items, setItems] = useState<VpsExplorerItem[]>([]);
  const [loadingList, setLoadingList] = useState<boolean>(false);
  const [selectedFileRel, setSelectedFileRel] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [fileMeta, setFileMeta] = useState<{
    sizeBytes: number;
    lines: number;
    commentCount: number;
    updatedAt: string;
  } | null>(null);
  const [loadingFile, setLoadingFile] = useState<boolean>(false);
  const [savingFile, setSavingFile] = useState<boolean>(false);
  const [stripOnSave, setStripOnSave] = useState<boolean>(true);
  const [sanitizingAll, setSanitizingAll] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [newFileName, setNewFileName] = useState<string>('');
  const [filterQuery, setFilterQuery] = useState<string>('');

  const loadDirectory = async (dirRel: string) => {
    setLoadingList(true);
    try {
      const res = await fetch(`/api/vps/files/list?dir=${encodeURIComponent(dirRel)}`);
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.erro || 'Não foi possível listar o diretório da VPS.');
      }
      setCurrentDir(json.currentRelDir || '');
      setRootDirLabel(json.rootDir || '/var/www/urutau-erp');
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (e: any) {
      showAlert('Erro no Explorador da VPS', e.message);
    } finally {
      setLoadingList(false);
    }
  };

  const openFile = async (relPath: string) => {
    setLoadingFile(true);
    setSelectedFileRel(relPath);
    try {
      const res = await fetch(`/api/vps/files/read?path=${encodeURIComponent(relPath)}`);
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.erro || 'Não foi possível ler o arquivo.');
      }
      setFileContent(json.content || '');
      setFileMeta({
        sizeBytes: json.sizeBytes || 0,
        lines: json.lines || 0,
        commentCount: json.commentCount || 0,
        updatedAt: json.updatedAt || ''
      });
    } catch (e: any) {
      showAlert('Erro ao Abrir Arquivo', e.message);
      setSelectedFileRel(null);
    } finally {
      setLoadingFile(false);
    }
  };

  useEffect(() => {
    loadDirectory('');
  }, []);

  const handleSaveCurrentFile = async (forceStripComments?: boolean) => {
    if (!selectedFileRel) return;
    setSavingFile(true);
    try {
      const res = await fetch('/api/vps/files/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: selectedFileRel,
          content: fileContent,
          stripComments: forceStripComments !== undefined ? forceStripComments : stripOnSave
        })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.erro || 'Falha ao salvar arquivo na VPS.');
      }
      setFileContent(json.content || fileContent);
      setFileMeta({
        sizeBytes: json.sizeBytes || 0,
        lines: json.lines || 0,
        commentCount: json.commentCount || 0,
        updatedAt: new Date().toISOString()
      });
      await loadDirectory(currentDir);
      if (onAfterSanitize) onAfterSanitize();
      showAlert(
        'Arquivo Gravado na VPS',
        `O arquivo "${selectedFileRel}" foi atualizado com sucesso (${json.lines} linhas • ${json.commentCount} comentários).`
      );
    } catch (e: any) {
      showAlert('Erro ao Salvar Arquivo', e.message);
    } finally {
      setSavingFile(false);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newFolderName.trim().replace(/[^a-zA-Z0-9._-]/g, '-');
    if (!clean) return;
    const targetRel = currentDir ? `${currentDir}/${clean}` : clean;
    try {
      const res = await fetch('/api/vps/files/mkdir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: targetRel })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.erro || 'Erro ao criar pasta.');
      setNewFolderName('');
      await loadDirectory(currentDir);
    } catch (err: any) {
      showAlert('Erro ao Criar Pasta', err.message);
    }
  };

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newFileName.trim().replace(/[^a-zA-Z0-9._-]/g, '');
    if (!clean) return;
    const targetRel = currentDir ? `${currentDir}/${clean}` : clean;
    try {
      const res = await fetch('/api/vps/files/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: targetRel, content: '\n', stripComments: false })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.erro || 'Erro ao criar arquivo.');
      setNewFileName('');
      await loadDirectory(currentDir);
      await openFile(targetRel);
    } catch (err: any) {
      showAlert('Erro ao Criar Arquivo', err.message);
    }
  };

  const handleDeleteItem = (item: VpsExplorerItem) => {
    const executeDelete = async () => {
      try {
        const res = await fetch('/api/vps/files/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: item.relPath })
        });
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.erro || 'Erro ao excluir item.');
        if (selectedFileRel === item.relPath) {
          setSelectedFileRel(null);
          setFileContent('');
          setFileMeta(null);
        }
        await loadDirectory(currentDir);
      } catch (err: any) {
        showAlert('Operação Bloqueada', err.message);
      }
    };

    if (showConfirm) {
      showConfirm(
        `Excluir ${item.isDirectory ? 'Pasta' : 'Arquivo'} da VPS`,
        `Confirma a remoção definitiva de "${item.relPath}" do servidor?`,
        executeDelete
      );
    } else {
      executeDelete();
    }
  };

  const handleStripAllCommentsOnVps = async () => {
    setSanitizingAll(true);
    try {
      const res = await fetch('/api/vps/files/strip-all-comments', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.erro || 'Falha ao expurgar comentários.');
      await loadDirectory(currentDir);
      if (selectedFileRel) {
        await openFile(selectedFileRel);
      }
      if (onAfterSanitize) onAfterSanitize();
      showAlert(
        'Código 100% Funcional Aplicado na VPS',
        `${json.mensagem}\nEconomia imediata: ${(Number(json.bytesEconomizados || 0) / 1024).toFixed(1)} KB de comentários/documentações eliminados.`
      );
    } catch (e: any) {
      showAlert('Erro ao Limpar Comentários', e.message);
    } finally {
      setSanitizingAll(false);
    }
  };

  const breadcrumbs = currentDir ? currentDir.split('/').filter(Boolean) : [];
  const filteredItems = items.filter((it) =>
    !filterQuery.trim()
      ? true
      : it.name.toLowerCase().includes(filterQuery.trim().toLowerCase())
  );

  return (
    <div className="bg-[#120A16]/90 border-2 border-amber-500/50 rounded-xl p-4 sm:p-5 space-y-4 shadow-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/30 pb-3">
        <div className="space-y-0.5 min-w-0">
          <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-300">
            <HardDrive className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Explorador de Arquivos da Minha VPS (Acesso Direto ao Servidor)</span>
            <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-[10px] font-mono text-amber-200">
               EXCLUSIVO ADMIN MASTER
            </span>
          </div>
          <p className="text-xs text-slate-300">
            Navegue pelas pastas reais da sua VPS (<code className="text-amber-300 font-mono">{rootDirLabel}</code>), inspecione ou edite arquivos ao vivo, apague arquivos inúteis e mantenha apenas o código funcional sem comentários ou documentações.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleStripAllCommentsOnVps}
            disabled={sanitizingAll}
            className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-lg disabled:opacity-50"
          >
            <Zap className={`w-4 h-4 shrink-0 ${sanitizingAll ? 'animate-spin' : ''}`} />
            <span>
              {sanitizingAll
                ? 'Expurgando Comentários & Docs...'
                : ' Apagar Todos os Comentários & Documentações da VPS'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => loadDirectory(currentDir)}
            className="px-3 py-2 rounded-lg bg-black/50 hover:bg-black/80 text-slate-200 border border-amber-500/30 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingList ? 'animate-spin' : ''}`} />
            <span>Recarregar</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 bg-black/45 border border-amber-500/25 rounded-lg px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono min-w-0">
          <button
            type="button"
            onClick={() => loadDirectory('')}
            className="px-2 py-1 rounded bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 font-bold cursor-pointer"
          >
            {rootDirLabel}
          </button>
          {breadcrumbs.map((part, idx) => {
            const targetRel = breadcrumbs.slice(0, idx + 1).join('/');
            return (
              <React.Fragment key={targetRel}>
                <span className="text-slate-500">/</span>
                <button
                  type="button"
                  onClick={() => loadDirectory(targetRel)}
                  className="px-2 py-1 rounded bg-white/5 hover:bg-amber-500/20 text-slate-200 font-semibold cursor-pointer"
                >
                  {part}
                </button>
              </React.Fragment>
            );
          })}
          {currentDir && (
            <button
              type="button"
              onClick={() => {
                const parent = breadcrumbs.slice(0, -1).join('/');
                loadDirectory(parent);
              }}
              className="ml-2 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] cursor-pointer"
            >
              ⬆ Subir Nível (..)
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filtrar arquivo na pasta..."
            className="px-2.5 py-1.5 rounded-lg bg-black/60 border border-amber-500/30 text-xs text-white w-44"
          />
          <form onSubmit={handleCreateFolder} className="flex items-center gap-1">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Nova pasta..."
              className="px-2.5 py-1.5 rounded-lg bg-black/60 border border-slate-700 text-xs text-white w-32"
            />
            <button
              type="submit"
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Pasta</span>
            </button>
          </form>
          <form onSubmit={handleCreateFile} className="flex items-center gap-1">
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="Novo arquivo..."
              className="px-2.5 py-1.5 rounded-lg bg-black/60 border border-slate-700 text-xs text-white w-32"
            />
            <button
              type="submit"
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Arquivo</span>
            </button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 bg-black/50 border border-amber-500/25 rounded-xl overflow-hidden flex flex-col max-h-[520px]">
          <div className="px-3 py-2 bg-black/70 border-b border-amber-500/20 flex items-center justify-between text-[11px] font-bold text-amber-200">
            <span>Itens em /{currentDir || 'raiz'} ({filteredItems.length})</span>
            <span>Tamanho / Pureza</span>
          </div>
          <div className="divide-y divide-white/5 overflow-y-auto flex-1">
            {filteredItems.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Nenhum arquivo ou pasta encontrado neste diretório.
              </div>
            ) : (
              filteredItems.map((item) => {
                const isSelected = selectedFileRel === item.relPath;
                return (
                  <div
                    key={item.relPath}
                    className={`flex items-center justify-between gap-2 px-3 py-2 text-xs transition-colors ${
                      isSelected
                        ? 'bg-amber-500/20 border-l-2 border-amber-400 text-white'
                        : 'hover:bg-white/5 text-slate-200'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (item.isDirectory) {
                          loadDirectory(item.relPath);
                        } else {
                          openFile(item.relPath);
                        }
                      }}
                      className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-black uppercase shrink-0 ${
                          item.isDirectory
                            ? 'bg-amber-500/25 text-amber-300 border border-amber-400/40'
                            : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {item.isDirectory ? 'DIR' : item.ext || 'ARQ'}
                      </span>
                      <span className="font-mono truncate font-semibold">{item.name}</span>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      {!item.isDirectory && (
                        <>
                          <span className="text-[10px] font-mono text-slate-400">
                            {item.sizeBytes >= 1024
                              ? `${(item.sizeBytes / 1024).toFixed(1)} KB`
                              : `${item.sizeBytes} B`}
                          </span>
                          {['ts', 'tsx', 'js', 'css', 'html', 'sh', 'md'].includes(item.ext) && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                                item.commentCount === 0
                                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              }`}
                            >
                              {item.commentCount === 0 ? 'PURO' : `${item.commentCount} com.`}
                            </span>
                          )}
                        </>
                      )}
                      {!item.isProtected && (
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item)}
                          title={`Apagar ${item.name} da VPS`}
                          className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="lg:col-span-7 bg-black/60 border border-amber-500/25 rounded-xl p-3.5 flex flex-col justify-between min-h-[420px]">
          {!selectedFileRel ? (
            <div className="m-auto text-center space-y-2 p-6">
              <Terminal className="w-8 h-8 text-amber-400/70 mx-auto" />
              <div className="text-sm font-bold text-slate-200">
                Selecione um arquivo à esquerda para inspecionar ou editar na VPS
              </div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Você pode visualizar qualquer código-fonte em execução na sua VPS, editar linhas diretamente ou remover comentários para manter apenas o código funcional puro.
              </p>
            </div>
          ) : loadingFile ? (
            <div className="m-auto text-center text-xs text-amber-300 font-mono">
              Carregando {selectedFileRel} direto da VPS...
            </div>
          ) : (
            <div className="space-y-3 flex-1 flex flex-col">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                <div className="min-w-0">
                  <div className="text-xs font-mono font-bold text-amber-300 truncate">
                    {selectedFileRel}
                  </div>
                  {fileMeta && (
                    <div className="text-[10px] font-mono text-slate-400 flex flex-wrap items-center gap-2">
                      <span>{fileMeta.lines} linhas</span>
                      <span>•</span>
                      <span>{(fileMeta.sizeBytes / 1024).toFixed(2)} KB</span>
                      <span>•</span>
                      <span
                        className={
                          fileMeta.commentCount === 0
                            ? 'text-emerald-400 font-bold'
                            : 'text-amber-300 font-bold'
                        }
                      >
                        {fileMeta.commentCount === 0
                          ? 'Zero comentários (100% Funcional)'
                          : `${fileMeta.commentCount} comentários detectados`}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={stripOnSave}
                      onChange={(e) => setStripOnSave(e.target.checked)}
                    />
                    <span>Expurgar comentários ao salvar</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleSaveCurrentFile(true)}
                    disabled={savingFile}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 border border-amber-400/50 text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                     Limpar Comentários Deste Arquivo
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveCurrentFile()}
                    disabled={savingFile}
                    className="px-3 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-[#04120C] text-xs font-black cursor-pointer disabled:opacity-50"
                  >
                    {savingFile ? 'Gravando...' : ' Salvar na VPS'}
                  </button>
                </div>
              </div>

              <textarea
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                rows={18}
                spellCheck={false}
                className="w-full flex-1 font-mono text-[11px] leading-relaxed bg-[#05080B] text-emerald-100 border border-amber-500/25 rounded-lg p-3 focus:outline-none"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ConfigTab({
  data,
  onRefresh,
  showAlert,
  showConfirm,
  currentUser,
  onSwitchCurrentUser,
  inactivityLimitSec,
  onChangeInactivityLimit,
  currentAccentHex,
  onChangeAccentColor,
  categories = DEFAULT_CATEGORIES,
  onUpdateCategories,
  tabOverrides = {},
  onUpdateTabOverrides,
  menuPosition = 'left',
  onChangeMenuPosition,
  brandConfig,
  onUpdateBrandConfig,
  vpsUpdateCmd = '',
  vpsExportCmd = '',
  modoMenuIndividual = 'aparencia',
  securityGeofenceConfig = DEFAULT_SECURITY_GEOFENCE_TURNO_CONFIG,
  onUpdateSecurityGeofenceConfig,
  userGpsLocation,
  onSimulateGpsPosition,
  simulatedShiftMode = 'auto',
  onChangeSimulatedShiftMode,
  effectiveBrightness = DEFAULT_ADMIN_MASTER_BRIGHTNESS,
  adminMasterBrightness = DEFAULT_ADMIN_MASTER_BRIGHTNESS,
  userBrightnessOverride = null,
  onChangeBackgroundBrightness
}: CommonTabProps & {
  inactivityLimitSec: number;
  onChangeInactivityLimit: (sec: number) => void;
  currentAccentHex: string;
  onChangeAccentColor: (hex: string, rgb: { r: number; g: number; b: number }) => void;
  categories?: NavCategory[];
  onUpdateCategories?: (cats: NavCategory[]) => void;
  tabOverrides?: Record<string, CustomTabOverride>;
  onUpdateTabOverrides?: (overrides: Record<string, CustomTabOverride>) => void;
  menuPosition?: 'left' | 'bottom';
  onChangeMenuPosition?: (pos: 'left' | 'bottom') => void;
  brandConfig?: BrandIdentityConfig;
  onUpdateBrandConfig?: (cfg: BrandIdentityConfig) => void;
  vpsUpdateCmd?: string;
  vpsExportCmd?: string;
  modoMenuIndividual?: 'aparencia' | 'permissoes' | 'servidor_ia';
  securityGeofenceConfig?: SecurityGeofenceTurnoConfig;
  onUpdateSecurityGeofenceConfig?: (cfg: SecurityGeofenceTurnoConfig) => void;
  userGpsLocation?: {
    latitude: number;
    longitude: number;
    accuracy: number;
    simulated: boolean;
    label: string;
  };
  onSimulateGpsPosition?: (insideCompany: boolean) => void;
  simulatedShiftMode?: 'auto' | 'em_turno' | 'fora_turno';
  onChangeSimulatedShiftMode?: (mode: 'auto' | 'em_turno' | 'fora_turno') => void;
  effectiveBrightness?: number;
  adminMasterBrightness?: number;
  userBrightnessOverride?: number | null;
  onChangeBackgroundBrightness?: (next: number | null) => void;
}) {
  const initialSecao =
    modoMenuIndividual === 'servidor_ia'
      ? 'vps'
      : modoMenuIndividual === 'permissoes'
      ? 'permissoes'
      : 'marca';
  const [secaoAtiva, setSecaoAtiva] = useState<'marca' | 'menus' | 'vps' | 'explorador_vps' | 'plano_blindagem' | 'permissoes' | 'seguranca' | 'prompt_ia'>(initialSecao);
  const [matrizDestravada, setMatrizDestravada] = useState<boolean>(
    modoMenuIndividual === 'permissoes'
  );
  const [filtroPermissoes, setFiltroPermissoes] = useState<'subordinados' | 'todos' | 'gestores'>('todos');

  useEffect(() => {
    if (modoMenuIndividual === 'servidor_ia') {
      setSecaoAtiva((prev) =>
        prev === 'vps' || prev === 'explorador_vps' || prev === 'plano_blindagem' || prev === 'seguranca' || prev === 'prompt_ia' ? prev : 'vps'
      );
    } else if (modoMenuIndividual === 'permissoes') {
      setSecaoAtiva('permissoes');
      setMatrizDestravada(true);
    } else if (modoMenuIndividual === 'aparencia') {
      setSecaoAtiva((prev) => (prev === 'marca' || prev === 'menus' ? prev : 'marca'));
    }
  }, [modoMenuIndividual]);
  const [aparenciaSalvaFeedback, setAparenciaSalvaFeedback] = useState<string | null>(null);
  const [novaSenhaMestra, setNovaSenhaMestra] = useState('');
  const [vpsStatus, setVpsStatus] = useState<any>(null);
  const [copiedCmdKey, setCopiedCmdKey] = useState<string | null>(null);
  const [vpsExportLinkInput, setVpsExportLinkInput] = useState<string>('');
  const [vpsImportFeedback, setVpsImportFeedback] = useState<string | null>(null);

  const [otaMasterPass, setOtaMasterPass] = useState<string>('');
  const [otaLoading, setOtaLoading] = useState<boolean>(false);
  const [otaError, setOtaError] = useState<string | null>(null);
  const [otaResult, setOtaResult] = useState<{
    ok: boolean;
    arquivosSincronizados: number;
    hashIntegridade: string;
    backupPrevioHash: string;
    dominioConfigurado: string;
    etapas: string[];
    mensagem: string;
  } | null>(null);

  const [dominioInput, setDominioInput] = useState<string>('nyctibi.us');
  const [dominioStatus, setDominioStatus] = useState<any>(null);
  const [dominioSaving, setDominioSaving] = useState<boolean>(false);
  const [dominioFeedback, setDominioFeedback] = useState<string | null>(null);

  const [cleanVpsBundle, setCleanVpsBundle] = useState<{
    geradoEm: string;
    dominioConfigurado?: string;
    sha256Hash?: string;
    totalArquivos: number;
    totalLinhas: number;
    totalBytes: number;
    arquivos: Array<{
      path: string;
      category: 'config' | 'backend' | 'frontend';
      label: string;
      lines: number;
      sizeBytes: number;
      content: string;
    }>;
    scriptInstalacaoCompleta: string;
  } | null>(null);
  const [loadingCleanVpsCode, setLoadingCleanVpsCode] = useState<boolean>(false);
  const [selectedCodeView, setSelectedCodeView] = useState<string>('__FULL_SCRIPT__');

  const [novoGrupoNome, setNovoGrupoNome] = useState<string>('');
  const [editingIconTab, setEditingIconTab] = useState<TabId | null>(null);
  const [filtroGrupoEditor, setFiltroGrupoEditor] = useState<string>('todos');

  const activeBrand: BrandIdentityConfig = brandConfig || {
    companyName: data.empresas?.[0]?.nome || 'Minha Empresa',
    logoDataUrl: '',
    companyColorHex: currentAccentHex || '#10B981',
    companySecondaryHex: '#F59E0B',
    urutauBaseHex: '#10B981',
    blendRatio: 0.72,
    effectivePrimaryHex: currentAccentHex || '#10B981',
    effectivePrimaryRgb: hexToRgb(currentAccentHex || '#10B981'),
    effectiveSecondaryHex: '#F59E0B'
  };

  const fetchCleanVpsCode = async () => {
    setLoadingCleanVpsCode(true);
    try {
      const r = await fetch('/api/erp/vps-codigo-instalacao-zero');
      if (r.ok) {
        const json = await r.json();
        setCleanVpsBundle(json);
        if (json.dominioConfigurado) {
          setDominioInput(json.dominioConfigurado);
        }
      }
    } catch {
    } finally {
      setLoadingCleanVpsCode(false);
    }
  };

  const fetchDominioStatus = async () => {
    try {
      const r = await fetch('/api/erp/vps-dominio-status');
      if (r.ok) {
        const json = await r.json();
        setDominioStatus(json);
        if (json.dominio) setDominioInput(json.dominio);
      }
    } catch {}
  };

  useEffect(() => {
    fetch('/api/erp/vps-status')
      .then((r) => r.json())
      .then(setVpsStatus)
      .catch(() => {});
    fetchCleanVpsCode();
    fetchDominioStatus();
  }, [data]);

  const usuariosPermissoes = useMemo(() => {
    return (data.usuarios || []).filter((u: any) => {
      if (u.arquivado_legal) return false;
      const ehContaAdminMaster =
        isSuperAdminUser(u) ||
        Number(u.id) === 1 ||
        String(u.nome || '').toLowerCase().trim() === 'admin master';
      if (!isSuperAdminUser(currentUser) && ehContaAdminMaster) return false;
      if (data.empresaAtivaId) {
        const empIds = Array.isArray(u.empresas_ids) ? u.empresas_ids.map(Number) : [1];
        if (!isSuperAdminUser(currentUser) && !empIds.includes(Number(data.empresaAtivaId))) return false;
      }
      return true;
    });
  }, [data.usuarios, currentUser, data.empresaAtivaId]);

  const [usuarioSelecionadoId, setUsuarioSelecionadoId] = useState<number>(() => {
    return Number(usuariosPermissoes[0]?.id || currentUser?.id || 0);
  });
  const [salvandoPermissoes, setSalvandoPermissoes] = useState<boolean>(false);

  const usuarioAtual =
    usuariosPermissoes.find((u) => Number(u.id) === Number(usuarioSelecionadoId)) ||
    usuariosPermissoes[0];

  const handleCopyCommand = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedCmdKey(key);
    setTimeout(() => setCopiedCmdKey(null), 2600);
  };

  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || '');
      const extracted = await extractColorsFromLogoImage(dataUrl);
      const blended = blendCompanyWithUrutau(
        extracted.dominantHex,
        activeBrand.urutauBaseHex || '#10B981',
        activeBrand.blendRatio ?? 0.72
      );
      const updatedBrand: BrandIdentityConfig = {
        ...activeBrand,
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
          ...(activeBrand.imagePlacements || {}),
          topo_painel: 'logo_empresa'
        }
      };
      onUpdateBrandConfig?.(updatedBrand);
      onChangeAccentColor(blended.effectiveHex, blended.rgb);
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateBrandParameters = (partial: Partial<BrandIdentityConfig>) => {
    if (!podeMudarAparenciaSistema(currentUser)) {
      showAlert(
        'Permissão de Aparência Necessária',
        'Apenas gestores da empresa ou colaboradores autorizados podem mudar a aparência do sistema.'
      );
      return;
    }
    const nextCompHex = partial.companyColorHex ?? activeBrand.companyColorHex;
    const nextUruHex = partial.urutauBaseHex ?? activeBrand.urutauBaseHex;
    const nextRatio = partial.blendRatio ?? activeBrand.blendRatio;
    const blended = blendCompanyWithUrutau(nextCompHex, nextUruHex, nextRatio);
    const updatedBrand: BrandIdentityConfig = {
      ...activeBrand,
      ...partial,
      effectivePrimaryHex: blended.effectiveHex,
      effectivePrimaryRgb: blended.rgb
    };
    onUpdateBrandConfig?.(updatedBrand);
    onChangeAccentColor(blended.effectiveHex, blended.rgb);
  };

  const handleSalvarAparenciaEmpresaNoSistema = async () => {
    if (!podeMudarAparenciaSistema(currentUser)) {
      showAlert(
        'Permissão de Aparência Necessária',
        'Apenas gestores da empresa ou colaboradores com permissão de aparência podem salvar o tema.'
      );
      return;
    }
    try {
      await Promise.all([
        fetch('/api/erp/configs/salvar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chave: 'identidade_visual_empresa', valor_json: activeBrand })
        }),
        fetch('/api/erp/configs/salvar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chave: 'menu_categorias_personalizadas', valor_json: categories })
        }),
        fetch('/api/erp/configs/salvar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chave: 'menu_abas_overrides', valor_json: tabOverrides })
        })
      ]);
      setAparenciaSalvaFeedback('Aparência da empresa gravada e aplicada em todo o sistema!');
      setTimeout(() => setAparenciaSalvaFeedback(null), 3500);
    } catch (e: any) {
      showAlert('Erro ao Salvar Aparência', e.message);
    }
  };

  const podeGerenciarUsuarioAlvo = (alvo: any): boolean => {
    if (!alvo) return false;
    if (isSuperAdminUser(currentUser)) return true;
    if (!isGestorEmpresaUser(currentUser)) return false;
    if (isSuperAdminUser(alvo)) return false;
    return isSubordinadoDoGestor(currentUser, alvo, data.empresaAtivaId);
  };

  const handleAtualizarHierarquiaOuPrivilegioGestor = async (
    usuario: any,
    patch: {
      gestor_id?: number | null;
      tipo?: string;
      gerenciar_subordinados?: boolean;
      mudar_aparencia?: boolean;
    }
  ) => {
    if (!matrizDestravada) {
      showAlert(
        'Matriz de Permissões Bloqueada',
        'Destrave o Cadeado de Segurança para alterar hierarquia ou permissões de subordinados.'
      );
      return;
    }
    if (!podeGerenciarUsuarioAlvo(usuario)) {
      showAlert(
        'Fora da Sua Alçada de Subordinados',
        'Como gestor da empresa, você pode definir as permissões dos seus subordinados, mas não de contas Super Admin ou superiores.'
      );
      return;
    }
    const novasPermissoes = {
      ...(usuario.permissoes_json || {}),
      ...(patch.gerenciar_subordinados !== undefined
        ? { gerenciar_subordinados: patch.gerenciar_subordinados }
        : {}),
      ...(patch.mudar_aparencia !== undefined ? { mudar_aparencia: patch.mudar_aparencia } : {})
    };
    setSalvandoPermissoes(true);
    try {
      await fetch('/api/acessos/salvar-completo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...usuario,
          tipo: patch.tipo !== undefined ? patch.tipo : usuario.tipo,
          gestor_id: patch.gestor_id !== undefined ? patch.gestor_id : usuario.gestor_id,
          escalaFixa: data.escalaFixa?.[usuario.id] || [1, 2, 3, 4, 5],
          permissoes: novasPermissoes
        })
      });
      await onRefresh();
    } catch (e: any) {
      showAlert('Erro ao Atualizar Subordinado', e.message);
    } finally {
      setSalvandoPermissoes(false);
    }
  };

  const handleRenameGroup = (groupId: string, novoTitulo: string) => {
    if (!onUpdateCategories) return;
    const updated = categories.map((c) => (c.id === groupId ? { ...c, titulo: novoTitulo } : c));
    onUpdateCategories(updated);
  };

  const handleColorGroup = (groupId: string, novaCor: string) => {
    if (!onUpdateCategories) return;
    const updated = categories.map((c) => (c.id === groupId ? { ...c, corSimbolo: novaCor } : c));
    onUpdateCategories(updated);
  };

  const handleMoveGroup = (idx: number, dir: -1 | 1) => {
    if (!onUpdateCategories) return;
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= categories.length) return;
    const clone = [...categories];
    const [removed] = clone.splice(idx, 1);
    clone.splice(targetIdx, 0, removed);
    onUpdateCategories(clone);
  };

  const handleCreateGroup = () => {
    if (!novoGrupoNome.trim() || !onUpdateCategories) return;
    const slug = `grupo_${Date.now().toString().slice(-5)}`;
    onUpdateCategories([
      ...categories,
      { id: slug, titulo: novoGrupoNome.trim(), corSimbolo: '#10B981', abas: [] }
    ]);
    setNovoGrupoNome('');
  };

  const handleDeleteGroup = (groupId: string) => {
    if (!onUpdateCategories) return;
    if (categories.length <= 1) {
      showAlert('Mínimo de 1 Separador', 'O menu precisa manter pelo menos 1 separador ativo.');
      return;
    }
    const target = categories.find((c) => c.id === groupId);
    if (!target) return;
    const remaining = categories.filter((c) => c.id !== groupId);
    if (target.abas.length > 0 && remaining.length > 0) {
      remaining[0] = {
        ...remaining[0],
        abas: [...remaining[0].abas, ...target.abas.filter((t) => !remaining[0].abas.includes(t))]
      };
    }
    onUpdateCategories(remaining);
    if (filtroGrupoEditor === groupId) {
      setFiltroGrupoEditor('todos');
    }
  };

  const handleMoveTabToGroup = (tabId: TabId, destGroupId: string) => {
    if (!onUpdateCategories) return;
    const updated = categories.map((cat) => {
      const semTab = cat.abas.filter((t) => t !== tabId);
      if (cat.id === destGroupId) {
        return { ...cat, abas: [...semTab, tabId] };
      }
      return { ...cat, abas: semTab };
    });
    onUpdateCategories(updated);
  };

  const handleMoveTabInGroup = (groupId: string, tabIdx: number, dir: -1 | 1) => {
    if (!onUpdateCategories) return;
    const updated = categories.map((cat) => {
      if (cat.id !== groupId) return cat;
      const targetIdx = tabIdx + dir;
      if (targetIdx < 0 || targetIdx >= cat.abas.length) return cat;
      const abasClone = [...cat.abas];
      const [removed] = abasClone.splice(tabIdx, 1);
      abasClone.splice(targetIdx, 0, removed);
      return { ...cat, abas: abasClone };
    });
    onUpdateCategories(updated);
  };

  const handleUpdateSingleTabOverride = (tabId: TabId, patch: Partial<CustomTabOverride>) => {
    if (!onUpdateTabOverrides) return;
    const current = tabOverrides[tabId] || {};
    const next = {
      ...tabOverrides,
      [tabId]: { ...current, ...patch }
    };
    onUpdateTabOverrides(next);
  };

  const handleResetMenusAndIcons = () => {
    onUpdateCategories?.(DEFAULT_CATEGORIES);
    onUpdateTabOverrides?.({});
    showAlert('Menus Restaurados', 'Os grupos, nomes e ícones voltaram ao padrão original.');
  };

  const handleToggleModuloPermissao = async (
    usuario: any,
    moduloId: string,
    campo: 'ver' | 'editar'
  ) => {
    if (!matrizDestravada) {
      showAlert(
        'Matriz de Permissões Bloqueada',
        'Destrave primeiramente o Cadeado de Segurança para editar as permissões.'
      );
      return;
    }
    if (!usuario) return;
    if (!podeGerenciarUsuarioAlvo(usuario)) {
      showAlert(
        'Permissão Restrita aos Subordinados',
        'Os gestores da empresa podem definir as permissões dos seus subordinados, mas não podem alterar contas de nível superior ou Super Admin.'
      );
      return;
    }

    const isMaster = usuario.tipo === 'Super Admin' || usuario.permissoes_json?.total;
    const currentModulos = usuario.permissoes_json?.modulos || {};
    const modConfig = currentModulos[moduloId] || {
      ver: isMaster || !!usuario.permissoes_json?.[moduloId],
      editar: isMaster || !!usuario.permissoes_json?.[moduloId],
      escopo: 'todos'
    };

    let novoVer = modConfig.ver;
    let novoEditar = modConfig.editar;
    const escopoAtual = modConfig.escopo || 'todos';

    if (campo === 'ver') {
      novoVer = !modConfig.ver;
      if (!novoVer) novoEditar = false;
    } else {
      novoEditar = !modConfig.editar;
      if (novoEditar) novoVer = true;
    }

    const novasPermissoes = {
      ...(usuario.permissoes_json || {}),
      total: false,
      modulos: {
        ...currentModulos,
        [moduloId]: { ver: novoVer, editar: novoEditar, escopo: escopoAtual }
      },
      [moduloId]: novoVer
    };

    setSalvandoPermissoes(true);
    try {
      await fetch('/api/acessos/salvar-completo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...usuario,
          escalaFixa: data.escalaFixa?.[usuario.id] || [1, 2, 3, 4, 5],
          permissoes: novasPermissoes
        })
      });
      await onRefresh();
    } catch (e: any) {
      showAlert('Erro ao Salvar Permissão', e.message);
    } finally {
      setSalvandoPermissoes(false);
    }
  };

  const handleAlterarEscopoModulo = async (
    usuario: any,
    moduloId: string,
    novoEscopo: 'todos' | 'subordinados' | 'pessoal'
  ) => {
    if (!matrizDestravada) {
      showAlert(
        'Matriz de Permissões Bloqueada',
        'Destrave o Cadeado de Segurança para alterar o escopo desta função.'
      );
      return;
    }
    if (!usuario) return;
    if (!podeGerenciarUsuarioAlvo(usuario)) {
      showAlert(
        'Permissão Restrita aos Subordinados',
        'Você só pode alterar o escopo de visualização dos seus subordinados.'
      );
      return;
    }

    const isMaster = usuario.tipo === 'Super Admin' || usuario.permissoes_json?.total;
    const currentModulos = usuario.permissoes_json?.modulos || {};
    const modConfig = currentModulos[moduloId] || {
      ver: isMaster || !!usuario.permissoes_json?.[moduloId],
      editar: isMaster || !!usuario.permissoes_json?.[moduloId],
      escopo: 'todos'
    };

    const novasPermissoes = {
      ...(usuario.permissoes_json || {}),
      total: false,
      modulos: {
        ...currentModulos,
        [moduloId]: {
          ...modConfig,
          escopo: novoEscopo
        }
      }
    };

    setSalvandoPermissoes(true);
    try {
      await fetch('/api/acessos/salvar-completo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...usuario,
          escalaFixa: data.escalaFixa?.[usuario.id] || [1, 2, 3, 4, 5],
          permissoes: novasPermissoes
        })
      });
      await onRefresh();
    } catch (e: any) {
      showAlert('Erro ao Salvar Escopo da Função', e.message);
    } finally {
      setSalvandoPermissoes(false);
    }
  };

  const handleAplicarLotePermissoes = async (
    usuario: any,
    modo: 'total' | 'leitura' | 'bloqueado'
  ) => {
    if (!matrizDestravada) {
      showAlert('Matriz Bloqueada', 'Destrave o Cadeado para alterar permissões.');
      return;
    }
    if (!usuario) return;
    if (!podeGerenciarUsuarioAlvo(usuario)) {
      showAlert(
        'Permissão Restrita aos Subordinados',
        'Os gestores da empresa só podem aplicar permissões em lote aos seus subordinados.'
      );
      return;
    }

    const currentModulos = usuario.permissoes_json?.modulos || {};
    const modulosAtualizados: Record<string, { ver: boolean; editar: boolean; escopo: string }> = {};
    MODULOS_CONFIG_PERMISSOES.forEach((m) => {
      const escopoExistente = currentModulos[m.id]?.escopo || 'todos';
      if (modo === 'total') {
        modulosAtualizados[m.id] = { ver: true, editar: true, escopo: escopoExistente };
      } else if (modo === 'leitura') {
        modulosAtualizados[m.id] = { ver: true, editar: false, escopo: escopoExistente };
      } else {
        modulosAtualizados[m.id] = { ver: false, editar: false, escopo: escopoExistente };
      }
    });

    const novasPermissoes = {
      ...(usuario.permissoes_json || {}),
      total: modo === 'total',
      modulos: modulosAtualizados
    };

    setSalvandoPermissoes(true);
    try {
      await fetch('/api/acessos/salvar-completo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...usuario,
          escalaFixa: data.escalaFixa?.[usuario.id] || [1, 2, 3, 4, 5],
          permissoes: novasPermissoes
        })
      });
      await onRefresh();
    } catch (e: any) {
      showAlert('Erro ao Aplicar Permissões', e.message);
    } finally {
      setSalvandoPermissoes(false);
    }
  };

  const handleAlterarSenhaMestra = async () => {
    try {
      const res = await fetch('/api/v31/auth/alterar-senha-mestra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nova_senha: novaSenhaMestra })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro);
      setNovaSenhaMestra('');
      showAlert('Senha Atualizada', json.mensagem);
    } catch (e: any) {
      showAlert('Erro ao Alterar Senha Mestra', e.message);
    }
  };

  const handleTestarBloqueioDelete = async () => {
    const res = await fetch('/api/erp/dados-completos', { method: 'DELETE' });
    const json = await res.json();
    showAlert(
      `Proteção Ativa — Status HTTP ${res.status}`,
      json.erro,
      `Rota: DELETE /api/erp/dados-completos\nStatus: ${res.status} Method Not Allowed`
    );
    await onRefresh();
  };

  const handleDispararBackupAgora = async () => {
    const res = await fetch('/api/erp/backup-agora', { method: 'POST' });
    const json = await res.json();
    if (res.ok) {
      await onRefresh();
      showAlert(
        'Backup Sincronizado',
        `Snapshot cifrado enviado para a nuvem. Hash SHA-256: ${json.backup?.hash_sha256}`
      );
    }
  };

  const handleExecutarOtaSelfUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otaMasterPass.trim()) {
      setOtaError('Digite a Senha Mestra do Administrador para autorizar a atualização segura.');
      return;
    }
    setOtaLoading(true);
    setOtaError(null);
    setOtaResult(null);
    try {
      const res = await fetch('/api/erp/vps-ota-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha_mestra: otaMasterPass.trim() })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setOtaError(json.erro || 'Não foi possível concluir a atualização OTA.');
        return;
      }
      setOtaResult(json);
      setOtaMasterPass('');
      await fetchCleanVpsCode();
      await onRefresh();
    } catch (err: any) {
      setOtaError(err.message || 'Falha de comunicação com o servidor durante a atualização OTA.');
    } finally {
      setOtaLoading(false);
    }
  };

  const handleSalvarDominioVps = async (e: React.FormEvent) => {
    e.preventDefault();
    const domLimpo =
      String(dominioInput || 'nyctibi.us')
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '') || 'nyctibi.us';
    setDominioSaving(true);
    setDominioFeedback(null);
    try {
      const res = await fetch('/api/erp/vps-configurar-dominio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dominio: domLimpo,
          aplicar_nginx_local: true
        })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.erro || 'Erro ao configurar domínio');
      }
      setDominioInput(json.dominio || domLimpo);
      setDominioFeedback(
        json.mensagem || `Domínio ${domLimpo} configurado com sucesso!`
      );
      await fetchDominioStatus();
      await fetchCleanVpsCode();
      await onRefresh();
      setTimeout(() => setDominioFeedback(null), 6000);
    } catch (err: any) {
      showAlert('Erro ao Configurar Domínio', err.message);
    } finally {
      setDominioSaving(false);
    }
  };

  const officialCloudOrigin =
    dominioStatus?.cloud_master_origin ||
    'https://ais-pre-pejnpvvx5jpp4nbv5n76xv-247047087382.us-east1.run.app';
  const cleanDomainNow =
    String(dominioInput || 'nyctibi.us')
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '') || 'nyctibi.us';

  const updateCmdFinal =
    dominioStatus?.comandoComFallbackDns ||
    vpsUpdateCmd ||
    `(grep -q "1.1.1.1" /etc/resolv.conf 2>/dev/null || echo -e "nameserver 1.1.1.1\\nnameserver 8.8.8.8" >> /etc/resolv.conf 2>/dev/null || true) && curl -4 -sSL ${officialCloudOrigin}/atualizar-vps.sh | bash`;

  const domainCmdFinal =
    dominioStatus?.comandoConfigurarDominio ||
    `(grep -q "1.1.1.1" /etc/resolv.conf 2>/dev/null || echo -e "nameserver 1.1.1.1\\nnameserver 8.8.8.8" >> /etc/resolv.conf 2>/dev/null || true) && curl -4 -sSL ${officialCloudOrigin}/dominios/${cleanDomainNow}.sh | bash`;

  if (modoMenuIndividual === 'servidor_ia' && !isSuperAdminUser(currentUser)) {
    return (
      <div className="p-6 rounded-xl bg-[#11151E] border border-rose-500/40 text-center space-y-2">
        <ShieldCheck className="w-8 h-8 text-rose-400 mx-auto" />
        <h3 className="text-base font-bold text-slate-100">
          Acesso Exclusivo do Super Admin
        </h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          O menu <strong>Bloco 2 • Servidor, Segurança &amp; IA (Itens 1, 5 e 6)</strong> é restrito exclusivamente ao Super Admin do sistema.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 w-full max-w-full overflow-x-hidden">
      
      <div className="bg-[#11151E] border border-slate-800/90 rounded-xl p-3.5 sm:p-4 space-y-3 overflow-hidden max-w-full">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {modoMenuIndividual === 'servidor_ia' ? (
              <>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-[10px] font-black uppercase tracking-wider text-amber-300 mb-1">
                  <Server className="w-3.5 h-3.5 shrink-0" />
                  <span>Menu Individual Exclusivo do Super Admin</span>
                </div>
                <h2 className="text-base font-bold text-slate-100">
                  Bloco 2 • Servidor, Segurança &amp; IA (Itens 1, 5 e 6 • Guia Detalhado)
                </h2>
                <p className="text-xs text-slate-400">
                  Atualização direta da sua VPS pelo sistema (OTA Seguro), configuração do domínio oficial <strong>nyctibi.us</strong>, código completo do zero, backups criptografados e Prompt Mestre para IA.
                </p>
              </>
            ) : modoMenuIndividual === 'permissoes' ? (
              <>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#10B981]/15 border border-[#10B981]/40 text-[10px] font-black uppercase tracking-wider text-[#10B981] mb-1">
                  <Users className="w-3.5 h-3.5 shrink-0" />
                  <span>Menu Individual Restrito por Permissão</span>
                </div>
                <h2 className="text-base font-bold text-slate-100">
                  Permissões de Acesso &amp; Alçadas de Subordinados
                </h2>
                <p className="text-xs text-slate-400">
                  Defina exatamente quais menus e ações cada colaborador ou subordinado pode visualizar, criar, editar ou aprovar no sistema.
                </p>
              </>
            ) : (
              <>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#10B981]/15 border border-[#10B981]/40 text-[10px] font-black uppercase tracking-wider text-[#10B981] mb-1">
                  <Palette className="w-3.5 h-3.5 shrink-0" />
                  <span>Identidade Visual da Empresa</span>
                </div>
                <h2 className="text-base font-bold text-slate-100">
                  Aparência &amp; Marca da Empresa (Logo &amp; Cores)
                </h2>
                <p className="text-xs text-slate-400">
                  Personalize a logo, o nome e a paleta de cores da sua empresa. Para personalizar o menu, basta <strong>arrastar e soltar</strong> os itens no próprio menu ou <strong>segurar pressionado no texto</strong> para editar!
                </p>
              </>
            )}
          </div>

          
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto min-w-0">
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#0B0D11] border border-[#10B981]/35 w-full sm:w-auto min-w-0">
              <Users className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
              <span className="text-[11px] text-slate-400 shrink-0">Operador:</span>
              <select
                value={currentUser?.id || 1}
                onChange={(e) => {
                  const found = (data.usuarios || []).find(
                    (u) => Number(u.id) === Number(e.target.value)
                  );
                  if (found && onSwitchCurrentUser) {
                    if (isSuperAdminUser(found) && !isSuperAdminUser(currentUser)) {
                      showAlert('Acesso Restrito', 'O usuário Admin Master só pode ser acessado com credenciais mestras na tela de login.');
                      return;
                    }
                    onSwitchCurrentUser(found);
                  }
                }}
                className="!bg-transparent !border-none text-xs font-bold text-slate-100 focus:outline-none cursor-pointer truncate min-w-0 flex-1 !p-0"
                title="Alternar operador / testar visão de Gestor da Empresa"
              >
                {(data.usuarios || [])
                  .filter((u) => {
                    if (isSuperAdminUser(currentUser)) return true;
                    if (isSuperAdminUser(u)) return false;
                    const empAtiva = Number(data.empresaAtivaId || 1);
                    const empIds = Array.isArray(u.empresas_ids) ? u.empresas_ids.map(Number) : [1];
                    return empIds.includes(empAtiva);
                  })
                  .map((u) => (
                    <option key={u.id} value={u.id} className="bg-[#0B0D11] text-slate-100">
                      {isSuperAdminUser(u) ? ' ' : isGestorEmpresaUser(u) ? ' ' : ' '}
                      {u.nome} ({u.tipo})
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>

        
        {modoMenuIndividual === 'servidor_ia' && (
          <div className="p-3 sm:p-3.5 rounded-xl bg-[#0B0D11] border border-amber-500/40 space-y-2.5 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/20 pb-2">
              <div className="min-w-0">
                <div className="text-[11px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 shrink-0" />
                  <span>Bloco 2 • Servidor, Segurança &amp; IA (Itens 1, 5 e 6 • Guia Detalhado)</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Explicado passo a passo para qualquer pessoa ( Simples) e com ficha técnica completa para especialistas ( Avançado).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {[
                {
                  id: 'vps',
                  label: '1. VPS, OTA & Domínio',
                  sub: 'Atualizar pelo sistema + nyctibi.us',
                  icon: Server
                },
                {
                  id: 'plano_blindagem',
                  label: '2. Plano Admin Irraqueável',
                  sub: 'Apresentação Executiva 7 Camadas',
                  icon: Lock
                },
                {
                  id: 'seguranca',
                  label: '3. Segurança & Backups',
                  sub: 'Senhas, bloqueio e cópias',
                  icon: ShieldCheck
                },
                {
                  id: 'prompt_ia',
                  label: '4. Prompt Mestre IA',
                  sub: 'Manual para ensinar robôs/IA',
                  icon: Sparkles
                }
              ].map((aba) => {
                const IconComp = aba.icon;
                const ativa = secaoAtiva === aba.id;
                return (
                  <button
                    key={aba.id}
                    type="button"
                    onClick={() => setSecaoAtiva(aba.id as any)}
                    className={`w-full flex flex-col items-start justify-between gap-1 px-3 py-2.5 rounded-lg text-left transition-all cursor-pointer min-w-0 ${
                      ativa
                        ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400/50'
                        : 'bg-[#11151E] text-slate-200 border border-slate-800 hover:border-amber-500/50 hover:text-white'
                    }`}
                  >
                    <div className="inline-flex items-center gap-2 text-xs font-black w-full min-w-0">
                      <IconComp className="w-4 h-4 shrink-0" />
                      <span className="truncate">{aba.label}</span>
                    </div>
                    <span
                      className={`text-[10px] leading-tight truncate w-full ${
                        ativa ? 'text-slate-950/85 font-semibold' : 'text-slate-400'
                      }`}
                    >
                      {aba.sub}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {modoMenuIndividual === 'aparencia' && (
          <div className="p-3 rounded-xl bg-[#0B171D] border border-[#10B981]/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full sm:w-auto flex-1">
              <button
                type="button"
                onClick={() => setSecaoAtiva('marca')}
                className={`px-4 py-2.5 rounded-lg text-xs font-black inline-flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  secaoAtiva === 'marca'
                    ? 'bg-[#10B981] text-[#04120C] shadow-md'
                    : 'bg-[#112229] text-slate-200 border border-white/10 hover:text-white'
                }`}
              >
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>Identidade Visual, Cores & Luminosidade</span>
              </button>
              <button
                type="button"
                onClick={() => setSecaoAtiva('menus')}
                className={`px-4 py-2.5 rounded-lg text-xs font-black inline-flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  secaoAtiva === 'menus'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'bg-[#112229] text-slate-200 border border-white/10 hover:text-white'
                }`}
              >
                <Sliders className="w-4 h-4 shrink-0" />
                <span>Hub de Edição dos Menus & Separadores</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {secaoAtiva === 'plano_blindagem' && (
        <div className="bg-[#120916]/95 border-2 border-amber-500/60 rounded-2xl p-5 sm:p-6 space-y-5 shadow-2xl">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-amber-500/30 pb-4">
            <div className="space-y-1 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/60 text-[10px] font-mono font-black uppercase tracking-wider text-amber-300">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Documento Executivo para Apresentação • Arquitetura Zero-Trust</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white">
                 Plano de Implementação: Acesso "Admin Master Irraqueável" (7 Camadas)
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Arquitetura de defesa em profundidade desenhada para tornar o acesso e as atribuições do <strong>Admin Master</strong> matematicamente invioláveis contra vazamento de senha, sequestro de sessão, força bruta, ataques de rede ou manipulação de API.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const mdContent = [
                    '#  Plano Executivo de Implementação: Blindagem "Admin Master Irraqueável"',
                    'Sistema: Urutau ERP • Arquitetura Zero-Trust em 7 Camadas',
                    '',
                    '## 1. Chave Criptográfica Assimétrica de Hardware (WebAuthn / Passkey FIDO2)',
                    '- O dispositivo autorizado do Admin Master gera um par de chaves criptográficas (Ed25519 / ECDSA P-256) vinculado ao chip físico (FaceID/TouchID, Windows Hello ou YubiKey).',
                    '- Mesmo que alguém descubra a senha mestra, o servidor recusa qualquer login fora dos dispositivos fisicamente certificados.',
                    '',
                    '## 2. Cofre Zero-Knowledge com Argon2id + Pepper Isolado no Kernel da VPS',
                    '- A senha nunca fica salva em texto puro e recebe um Pepper (segredo exclusivo no nível root da VPS, fora do banco) combinado com hash Argon2id resistente a GPUs.',
                    '',
                    '## 3. Duplo Fator Dinâmico Híbrido (TOTP RFC 6238 Offline + Desafio no WhatsApp)',
                    '- Exige código temporário de 6 dígitos (30s, funciona offline) ou confirmação de 1 toque enviada ao WhatsApp pessoal do Admin Master informando IP e navegador.',
                    '',
                    '## 4. Vinculação Criptográfica de Sessão (Session Fingerprint & IP Binding)',
                    '- O token HttpOnly recebe assinatura HMAC-SHA256 amarrada ao hardware do navegador e IP. Se copiado para outra máquina, é invalidado na hora.',
                    '',
                    '## 5. Guilhotina Anti-Força Bruta (Tarpit Progressivo + Quarentena Automática de IP)',
                    '- 1ª e 2ª falhas aplicam atraso forçado de 5s; 3ª falha bloqueia o IP invasor por 24h e dispara alerta no WhatsApp do Admin Master.',
                    '',
                    '## 6. Modo Bunker e Reautenticação por Ação Crítica (Step-Up Auth + Senha de Coação)',
                    '- Operações sensíveis (editar arquivos na VPS, OTA, permissões, backups) exigem confirmação instantânea. Inclui opção de Senha de Coação (modo somente-leitura camuflado).',
                    '',
                    '## 7. Imutabilidade no Kernel do Servidor & Middleware Root-Only',
                    '- Bloqueio em nível de código contra exclusão, rebaixamento ou alteração do registro Admin Master (#1) e exigência de assinatura criptográfica em todas as rotas sistemáticas.'
                  ].join('\n');
                  const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'Plano-Blindagem-Admin-Master-Irraqueavel.md';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-lg"
              >
                <Download className="w-4 h-4" />
                <span>Baixar Apresentação (.MD)</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-2 rounded-xl bg-[#10B981] hover:bg-[#059669] text-[#04120C] font-black text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-lg"
              >
                <Eye className="w-4 h-4" />
                <span>Imprimir / Salvar PDF</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {[
              {
                camada: 'Camada 1',
                titulo: 'Chave Física & Biometria (WebAuthn / Passkey)',
                resumo:
                  'Vincula o login ao chip de segurança do seu computador ou celular (Windows Hello / FaceID / YubiKey). A chave privada jamais sai do seu aparelho.',
                garantia: 'Imune a vazamento ou roubo de senha'
              },
              {
                camada: 'Camada 2',
                titulo: 'Cofre Argon2id + Pepper no Root da VPS',
                resumo:
                  'Combina criptografia Argon2id de alto custo de memória com uma chave secreta (Pepper) isolada no Linux root da VPS, fora do arquivo do banco.',
                garantia: 'Imune a cópia ou vazamento do banco'
              },
              {
                camada: 'Camada 3',
                titulo: '2º Fator Híbrido (TOTP Offline + WhatsApp)',
                resumo:
                  'Exige código rotativo de 6 dígitos que muda a cada 30s (funciona 100% offline) ou aprovação instantânea enviada ao seu WhatsApp pessoal.',
                garantia: 'Bloqueia acessos em aparelhos desconhecidos'
              },
              {
                camada: 'Camada 4',
                titulo: 'Sessão Amarrada ao Hardware & IP (HMAC)',
                resumo:
                  'O token de sessão recebe assinatura criptográfica atrelada à impressão digital do seu navegador e IP atual.',
                garantia: 'Imune a sequestro de sessão / cookies'
              },
              {
                camada: 'Camada 5',
                titulo: 'Guilhotina Anti-Força Bruta & Tarpit',
                resumo:
                  'Atraso progressivo nas 2 primeiras falhas e quarentena automática de 24h do IP na 3ª tentativa errada, com alerta imediato no seu WhatsApp.',
                garantia: 'Neutraliza robôs e ataques de força bruta'
              },
              {
                camada: 'Camada 6',
                titulo: 'Modo Bunker & Senha de Pânico/Coação',
                resumo:
                  'Reautenticação instantânea antes de ações críticas na VPS + senha secundária de emergência que abre o sistema em modo camuflado somente-leitura.',
                garantia: 'Proteção contra tela aberta ou coação física'
              },
              {
                camada: 'Camada 7',
                titulo: 'Imutabilidade do Admin #1 no Kernel',
                resumo:
                  'Trava nativa no servidor (server.ts) que proíbe qualquer rota de excluir, desativar ou rebaixar o Admin Master e exige assinatura nas rotas da VPS.',
                garantia: 'Blindagem total das rotas de API do servidor'
              }
            ].map((item) => (
              <div
                key={item.camada}
                className="p-4 rounded-xl bg-black/55 border border-amber-500/35 flex flex-col justify-between space-y-2.5"
              >
                <div className="space-y-1.5">
                  <span className="inline-block px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-[10px] font-mono font-black uppercase text-amber-300">
                    {item.camada}
                  </span>
                  <h3 className="text-sm font-black text-white">{item.titulo}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">{item.resumo}</p>
                </div>
                <div className="pt-2 border-t border-white/10 text-[11px] font-mono font-bold text-emerald-300">
                   {item.garantia}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl bg-black/50 border border-emerald-500/35 space-y-2">
            <div className="text-xs font-black uppercase tracking-wider text-emerald-300">
               Cronograma de Implantação em 3 Fases
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-[#071712] border border-emerald-500/30">
                <div className="font-black text-emerald-300 mb-1">Fase 1 • Núcleo do Servidor</div>
                <p className="text-slate-300">
                  Ativação imediata das Camadas 2, 5 e 7 (Cofre Argon2id + Pepper, Guilhotina Anti-Força Bruta por IP e Imutabilidade do Admin #1 no Back-end).
                </p>
              </div>
              <div className="p-3 rounded-lg bg-[#071712] border border-amber-500/30">
                <div className="font-black text-amber-300 mb-1">Fase 2 • Controle de Sessão & 2FA</div>
                <p className="text-slate-300">
                  Ativação das Camadas 3, 4 e 6 (Reconhecimento de Aparelho Confiável, 2º Fator TOTP/WhatsApp em novos aparelhos e Modo Bunker para ações da VPS).
                </p>
              </div>
              <div className="p-3 rounded-lg bg-[#071712] border border-purple-500/30">
                <div className="font-black text-purple-300 mb-1">Fase 3 • Hardware & Anti-Coação</div>
                <p className="text-slate-300">
                  Ativação da Camada 1 (Passkey / Biometria Física FIDO2) e Senha de Coação com modo somente-leitura camuflado.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {secaoAtiva === 'vps' && (
        <div className="space-y-5 max-w-full overflow-hidden">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-6 bg-[#071712] border-2 border-[#10B981]/50 rounded-xl p-4 sm:p-5 space-y-4 shadow-xl flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#10B981]/25 pb-3">
                  <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#10B981]">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>Atualização pelo Próprio Sistema (OTA Blindado)</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#10B981]/20 border border-[#10B981]/50 text-[#10B981] text-[10px] font-mono font-bold">
                    Zero Terminal • 5 Camadas Anti-Ataque
                  </span>
                </div>

                
                <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2 text-xs">
                  <div className="font-bold text-amber-300">
                     Por que deu erro "Could not resolve host: n.uguu.se" na sua VPS e como atualizar agora sem terminal?
                  </div>
                  <p className="text-slate-200 leading-relaxed">
                    O site externo <code className="text-rose-300">n.uguu.se</code> é um encurtador temporário que expira e bloqueia servidores VPS da Hostinger. <strong>Eliminamos 100% a dependência dele!</strong> Agora o próprio servidor oficial entrega o código diretamente, e você pode atualizar clicando no botão abaixo <strong>dentro do próprio sistema</strong>!
                  </p>
                  <div className="pt-1 border-t border-white/10 space-y-1 text-[11px] text-slate-300">
                    <div className="font-bold text-[#10B981]">
                       Isso é seguro contra ataques de hackers? SIM! Veja as 5 blindagens ativas:
                    </div>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li><strong>1. Zero Comando Externo (Pull-Only):</strong> Ninguém consegue enviar comandos maliciosos para a VPS; ela apenas puxa o código oficial via HTTPS TLS 1.3.</li>
                      <li><strong>2. Trava Criptográfica Argon2id:</strong> Só executa com a sua Senha Mestra verificada em memória segura.</li>
                      <li><strong>3. Lacre SHA-256 (Checksum):</strong> Confere a assinatura digital antes de salvar qualquer arquivo.</li>
                      <li><strong>4. Backup Automático Antes de Atualizar:</strong> Tira uma cópia de segurança do banco (<code className="text-emerald-300">urutau_db.json</code>) antes de começar.</li>
                      <li><strong>5. Cadastros Intocáveis:</strong> Atualiza apenas as telas e funções, jamais apagando clientes, reservas, estoque ou RH.</li>
                    </ul>
                  </div>
                </div>

                
                <form onSubmit={handleExecutarOtaSelfUpdate} className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1.5">
                      Digite sua Senha Mestra para Autorizar a Atualização pelo Sistema:
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="password"
                        value={otaMasterPass}
                        onChange={(e) => setOtaMasterPass(e.target.value)}
                        placeholder="Digite a Senha Mestra autorizada..."
                        className="flex-1 min-w-0 px-3 py-2.5 rounded-lg bg-[#05100C] border border-[#10B981]/40 text-xs font-mono text-white"
                      />
                      <button
                        type="submit"
                        disabled={otaLoading}
                        className="px-4 py-2.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-[#04120C] font-black text-xs inline-flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50 shrink-0"
                      >
                        <RefreshCw className={`w-4 h-4 shrink-0 ${otaLoading ? 'animate-spin' : ''}`} />
                        <span>
                          {otaLoading
                            ? 'Verificando SHA-256 & Atualizando...'
                            : ' Atualizar Sistema Agora (OTA)'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {otaError && (
                    <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 font-semibold">
                       {otaError}
                    </div>
                  )}

                  {otaResult && (
                    <div className="p-3.5 rounded-xl bg-black/60 border border-[#10B981]/50 space-y-2 text-xs font-mono">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[#10B981] font-bold">
                        <span> {otaResult.mensagem}</span>
                        <span className="px-2 py-0.5 rounded bg-[#10B981]/20 text-[10px]">
                          SHA-256: {otaResult.hashIntegridade}
                        </span>
                      </div>
                      <div className="space-y-1 text-[11px] text-slate-200">
                        {otaResult.etapas.map((etapa, idx) => (
                          <div key={idx}>{etapa}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </form>
              </div>

              
              <div className="p-3 rounded-xl bg-[#05100C] border border-amber-500/40 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-amber-400">
                     Está com o Terminal da Hostinger (<code className="text-white">root@nyctibi:~#</code>) aberto agora?
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyCommand(updateCmdFinal, 'ota-ssh-direct')}
                    className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedCmdKey === 'ota-ssh-direct' ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Comando Oficial Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar Comando Oficial (Sem uguu.se)</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-300 leading-snug">
                  Este novo comando corrige automaticamente o DNS da sua VPS Ubuntu 26.04 (<code className="text-emerald-300">1.1.1.1</code> / <code className="text-emerald-300">8.8.8.8</code>), baixa direto da nuvem oficial Urutau e já vincula o seu domínio <strong className="text-white">{cleanDomainNow}</strong>:
                </p>
                <div className="p-2 rounded bg-black/80 border border-slate-800 font-mono text-[11px] text-emerald-300 break-all select-all">
                  {updateCmdFinal}
                </div>
              </div>
            </div>

            
            <div className="xl:col-span-6 bg-[#11151E] border-2 border-amber-500/45 rounded-xl p-4 sm:p-5 space-y-4 shadow-xl flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-400">
                    <Globe className="w-4 h-4 shrink-0" />
                    <span>Domínio Oficial da Sua VPS: {cleanDomainNow}</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-mono font-bold">
                    HTTPS Let&apos;s Encrypt + Nginx SSE
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#0B0D11] border border-slate-800 space-y-2 text-xs">
                  <div className="font-bold text-[#10B981]">
                     Como funciona o seu domínio <code className="text-white">{cleanDomainNow}</code> na VPS?
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    Em vez de digitar números de IP difíceis, você e sua equipe acessam direto por <strong>https://{cleanDomainNow}</strong> com cadeado de segurança verde (HTTPS). O sistema já configura o Nginx (porta 80/443 apontando para a porta 3000) e emite o certificado SSL gratuito Let&apos;s Encrypt sozinho!
                  </p>
                </div>

                
                <form onSubmit={handleSalvarDominioVps} className="space-y-2.5">
                  <label className="block text-xs font-bold text-slate-200">
                    Domínio Principal do Sistema na VPS:
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={dominioInput}
                      onChange={(e) => setDominioInput(e.target.value)}
                      placeholder="nyctibi.us"
                      className="flex-1 min-w-0 px-3 py-2.5 rounded-lg bg-[#05100C] border border-amber-500/40 text-xs font-mono font-bold text-white"
                    />
                    <button
                      type="submit"
                      disabled={dominioSaving}
                      className="px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs inline-flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50 shrink-0"
                    >
                      <Globe className="w-4 h-4 shrink-0" />
                      <span>
                        {dominioSaving
                          ? 'Configurando...'
                          : `Ativar Domínio ${cleanDomainNow}`}
                      </span>
                    </button>
                  </div>
                  {dominioFeedback && (
                    <div className="p-2.5 rounded-lg bg-[#10B981]/15 border border-[#10B981]/40 text-xs text-[#10B981] font-bold">
                       {dominioFeedback}
                    </div>
                  )}
                </form>

                
                <div className="p-3 rounded-xl bg-[#0B0D11] border border-slate-800 space-y-2">
                  <div className="text-xs font-bold text-amber-300">
                     Passo 1 (No painel onde registrou <code className="text-white">{cleanDomainNow}</code>): Confira estes 2 registros DNS:
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[11px] font-mono">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="py-1.5 px-2">Tipo</th>
                          <th className="py-1.5 px-2">Nome / Host</th>
                          <th className="py-1.5 px-2">Aponta Para (Valor)</th>
                          <th className="py-1.5 px-2">TTL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-200">
                        <tr>
                          <td className="py-1.5 px-2 text-[#10B981] font-bold">A</td>
                          <td className="py-1.5 px-2 font-bold">@</td>
                          <td className="py-1.5 px-2 text-amber-300">IP Público da sua VPS Hostinger</td>
                          <td className="py-1.5 px-2 text-slate-400">3600 (ou Auto)</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-2 text-blue-400 font-bold">CNAME</td>
                          <td className="py-1.5 px-2 font-bold">www</td>
                          <td className="py-1.5 px-2 text-emerald-300">{cleanDomainNow}</td>
                          <td className="py-1.5 px-2 text-slate-400">3600 (ou Auto)</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              
              <div className="p-3 rounded-xl bg-[#05100C] border border-[#10B981]/35 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-[#10B981]">
                     Passo 2: Comando de 1 Linha para Ativar Nginx + Cadeado HTTPS em <code className="text-white">{cleanDomainNow}</code>:
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyCommand(domainCmdFinal, 'domain-ssl-cmd')}
                    className="px-3 py-1 rounded-lg bg-[#10B981] hover:bg-[#059669] text-[#04120C] font-black text-[11px] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedCmdKey === 'domain-ssl-cmd' ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copiado! Cole no Terminal</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar Comando Domínio + SSL</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-2 rounded bg-black/80 border border-slate-800 font-mono text-[11px] text-amber-300 break-all select-all">
                  {domainCmdFinal}
                </div>
              </div>
            </div>
          </div>

          
          <div className="bg-[#11151E] border border-amber-500/35 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-400">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>Guia de Entendimento • Item 1: Código Completo do Sistema & Servidor VPS</span>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold">
                Leitura Fácil + Ficha Técnica Profunda
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              
              <div className="p-3.5 rounded-xl bg-[#071712] border border-[#10B981]/35 space-y-2.5">
                <div className="text-xs font-black text-[#10B981] flex items-center gap-1.5">
                  <span> EXPLICAÇÃO SIMPLES (PARA QUALQUER PESSOA ENTENDER)</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  <strong>O que é "Código Completo" e o que é "VPS"?</strong> Imagine que este sistema é uma casa pronta. O <strong>Código Completo</strong> é a planta inteira da casa (tijolos, paredes, pintura e encanamento). Já a <strong>VPS</strong> é um computador alugado na internet que fica ligado 24 horas por dia para que você e sua equipe acessem o sistema pelo endereço <strong>{cleanDomainNow}</strong> de qualquer celular ou computador.
                </p>
                <div className="space-y-1.5 text-xs text-slate-300 bg-black/35 p-3 rounded-lg border border-white/10">
                  <div className="font-bold text-amber-300">Para que você vai usar esta tela? (2 usos fáceis):</div>
                  <div>
                    <strong>1⃣ Para pedir ajuda a uma Inteligência Artificial (ChatGPT, Claude, Gemini):</strong> Basta apertar o grande botão amarelo <strong>"Copiar Código Completo"</strong> abaixo. Depois, abra o site da Inteligência Artificial, cole lá dentro e diga o que você quer mudar ou revisar.
                  </div>
                  <div>
                    <strong>2⃣ Para colocar o sistema em um computador/servidor novo (VPS Formatada):</strong> Se você alugou um servidor limpo (zerado), esse mesmo código monta tudo sozinho do zero e já configura o domínio <strong>{cleanDomainNow}</strong>!
                  </div>
                  <div className="pt-1 text-[#10B981] font-semibold">
                     Fique tranquilo: Apertar os botões de "Copiar" ou "Visualizar" abaixo NÃO apaga nem estraga nada no seu sistema!
                  </div>
                </div>
              </div>

              
              <div className="p-3.5 rounded-xl bg-[#0B0D11] border border-slate-800 space-y-2.5">
                <div className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                  <span> ESPECIFICAÇÃO TÉCNICA (PARA MESTRES DA TECNOLOGIA & DEVOPS)</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  O gerador dinâmico (<code className="text-emerald-300">GET /api/erp/vps-codigo-instalacao-zero</code>) lê recursivamente a árvore de arquivos em disco do servidor em execução e sintetiza um script idempotente <strong>Bash/POSIX Self-Contained</strong> com payloads <code className="text-amber-300">cat &lt;&lt;'EOF_URUTAU_FILE'</code>.
                </p>
                <ul className="space-y-1 text-[11px] text-slate-400 font-mono bg-black/40 p-3 rounded-lg border border-slate-800/90 list-disc list-inside">
                  <li><strong>Provisionamento Bare-Metal/VPS:</strong> Ubuntu 22.04/24.04/26.04 LTS ou Debian 11/12 com fallback DNS (<code className="text-emerald-300">1.1.1.1</code> / <code className="text-emerald-300">8.8.8.8</code>).</li>
                  <li><strong>Runtime & Daemon:</strong> Node.js v20 LTS (NodeSource) + PM2 Cluster/Fork (<code className="text-slate-200">pm2 reload urutau-erp</code> + <code className="text-slate-200">pm2 save</code>).</li>
                  <li><strong>Reverse Proxy & SSL:</strong> Nginx para <code className="text-amber-300">{cleanDomainNow}</code> e <code className="text-amber-300">www.{cleanDomainNow}</code> &rarr; <code className="text-slate-200">127.0.0.1:3000</code> com Certbot Let&apos;s Encrypt e SSE (<code className="text-slate-200">proxy_buffering off</code>).</li>
                  <li><strong>Full-Stack Bundle:</strong> Contém <code className="text-slate-200">package.json</code>, <code className="text-slate-200">server.ts</code>, <code className="text-slate-200">src/types/erp.ts</code>, <code className="text-slate-200">src/App.tsx</code> e todos os módulos de <code className="text-slate-200">src/components/</code>.</li>
                </ul>
              </div>
            </div>
          </div>

          
          <div className="bg-[#071712] border border-[#10B981]/35 rounded-xl p-3.5 sm:p-5 space-y-4 shadow-xl overflow-hidden max-w-full">
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-start justify-between gap-3">
              <div className="space-y-1 min-w-0 max-w-full flex-1">
                <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#10B981]">
                  <Terminal className="w-4 h-4 shrink-0" />
                  <span>1.1 • Painel de Cópia e Inspeção do Código-Fonte Integral (Front-end + Back-end)</span>
                </div>
                <h3 className="text-sm sm:text-base font-bold text-slate-100">
                  Script Completo de Instalação Limpa (Front-end + Back-end + Provisionamento do Zero)
                </h3>
                <p className="text-xs text-slate-300 max-w-4xl leading-relaxed">
                  <strong> Como funciona:</strong> Abaixo está todo o código que faz o sistema funcionar (telas visuais + banco de dados). Ao clicar no botão amarelo, todo esse código vai para a área de transferência ("Copiar e Colar") do seu aparelho.
                  <br />
                  <strong> Arquitetura:</strong> O payload unifica o script de provisionamento Linux com cada arquivo fonte real do projeto sem omissões, pronto para ingestão em LLMs de janela de contexto longa ou execução direta via <code className="text-emerald-300">bash</code> em root shell.
                </p>
              </div>

              <div className="flex flex-col sm:items-end gap-2 w-full sm:w-auto min-w-0 max-w-full">
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  {cleanVpsBundle && (
                    <span
                      className="px-3 py-1.5 rounded-full bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] text-[11px] sm:text-xs font-mono font-bold max-w-full truncate"
                      title="Quantidade total de arquivos do projeto, total de linhas de programação e tamanho em Kilobytes"
                    >
                      {cleanVpsBundle.totalArquivos} arquivos • {cleanVpsBundle.totalLinhas.toLocaleString('pt-BR')} linhas • {(cleanVpsBundle.totalBytes / 1024).toFixed(0)} KB
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={fetchCleanVpsCode}
                    className="px-3 py-1.5 rounded-lg bg-black/40 hover:bg-black/60 text-slate-200 border border-white/10 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer w-full sm:w-auto"
                    title="Lê novamente os arquivos salvos no servidor para garantir que você está vendo a versão mais recente"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${loadingCleanVpsCode ? 'animate-spin text-[#10B981]' : ''}`} />
                    <span>Atualizar Leitura</span>
                  </button>
                </div>
                <span className="text-[11px] text-slate-400">
                   <strong>O que significam esses números?</strong> Mostram quantas peças (arquivos), linhas escritas e o peso leve (KB) do seu sistema completo. O botão <em>Atualizar Leitura</em> relê tudo ao vivo.
                </span>
              </div>
            </div>

            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 p-3 rounded-xl bg-black/30 border border-white/10 text-xs">
              <div className="p-2.5 rounded-lg bg-[#05100C] border border-amber-500/30 space-y-1">
                <div className="font-bold text-amber-400"> Botão 1: Copiar Código Completo</div>
                <p className="text-[11px] text-slate-300 leading-snug">
                  <strong> Simples:</strong> Copia 100% do sistema de uma só vez. É o botão principal para colar em uma Inteligência Artificial ou instalar num servidor novo.
                </p>
                <p className="text-[10px] font-mono text-slate-400">
                   Copia o bundle <code className="text-amber-300">scriptInstalacaoCompleta</code> para a Clipboard API.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-[#05100C] border border-[#10B981]/30 space-y-1">
                <div className="font-bold text-[#10B981]"> Botão 2:Baixar Script (.sh)</div>
                <p className="text-[11px] text-slate-300 leading-snug">
                  <strong> Simples:</strong> Salva um arquivo único chamado <code className="text-slate-100">.sh</code> na pasta "Downloads" do seu celular ou computador para você guardar.
                </p>
                <p className="text-[10px] font-mono text-slate-400">
                   Dispara download HTTP com <code className="text-emerald-300">Content-Disposition: attachment</code>.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-[#05100C] border border-slate-700 space-y-1">
                <div className="font-bold text-slate-200"> Seletor "Visualizar" e Pílulas</div>
                <p className="text-[11px] text-slate-300 leading-snug">
                  <strong> Simples:</strong> Permite escolher se você quer ver o pacote inteiro ou apenas uma peça específica (como só a tela inicial ou só o servidor).
                </p>
                <p className="text-[10px] font-mono text-slate-400">
                   Filtra o AST/source buffer exibido no <code className="text-slate-200">&lt;textarea&gt;</code> de inspeção.
                </p>
              </div>
            </div>

            
            <div className="p-3 sm:p-4 rounded-xl bg-black/45 border border-[#10B981]/30 flex flex-col lg:flex-row lg:flex-wrap items-stretch lg:items-center justify-between gap-3 max-w-full overflow-hidden">
              <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 min-w-0 max-w-full">
                <button
                  type="button"
                  disabled={!cleanVpsBundle?.scriptInstalacaoCompleta}
                  onClick={() => {
                    if (!cleanVpsBundle?.scriptInstalacaoCompleta) return;
                    handleCopyCommand(cleanVpsBundle.scriptInstalacaoCompleta, 'copy-full-clean-vps-code');
                  }}
                  className="w-full sm:w-auto max-w-full px-4 py-3 rounded-xl bg-[#F59E0B] hover:bg-[#FBBF24] text-slate-950 font-black text-xs sm:text-sm inline-flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg disabled:opacity-50 whitespace-normal text-center leading-snug"
                >
                  {copiedCmdKey === 'copy-full-clean-vps-code' ? (
                    <>
                      <Check className="w-4 h-4 shrink-0" />
                      <span>Código Completo Copiado! (Front-end + Back-end + Instalação VPS do Zero)</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 shrink-0" />
                      <span>Copiar Código Completo (VPS Formatada do Zero: Front-end + Back-end)</span>
                    </>
                  )}
                </button>

                {selectedCodeView !== '__FULL_SCRIPT__' && cleanVpsBundle && (
                  <button
                    type="button"
                    onClick={() => {
                      const arq = cleanVpsBundle.arquivos.find((a) => a.path === selectedCodeView);
                      if (arq) handleCopyCommand(arq.content, 'copy-single-file-code');
                    }}
                    className="w-full sm:w-auto max-w-full px-4 py-3 rounded-xl bg-[#10B981]/20 hover:bg-[#10B981]/30 text-[#10B981] border border-[#10B981]/40 font-bold text-xs inline-flex items-center justify-center gap-2 cursor-pointer transition-all whitespace-normal text-center"
                  >
                    {copiedCmdKey === 'copy-single-file-code' ? (
                      <>
                        <Check className="w-4 h-4 shrink-0" />
                        <span className="truncate">Arquivo {selectedCodeView} Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 shrink-0" />
                        <span className="truncate">Copiar Apenas {selectedCodeView}</span>
                      </>
                    )}
                  </button>
                )}

                <a
                  href="/api/erp/vps-codigo-instalacao-zero.sh"
                  download
                  className="w-full sm:w-auto px-4 py-3 rounded-xl bg-[#0A1F17] hover:bg-[#113025] text-slate-100 border border-white/15 font-bold text-xs inline-flex items-center justify-center gap-2 transition-all"
                >
                  <Download className="w-4 h-4 text-[#10B981] shrink-0" />
                  <span>Baixar Script (.sh)</span>
                </a>
              </div>

              
              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 w-full lg:w-auto min-w-0 max-w-full">
                <span className="text-xs text-slate-400 font-semibold shrink-0">Visualizar:</span>
                <select
                  value={selectedCodeView}
                  onChange={(e) => setSelectedCodeView(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-[#05100C] border border-[#10B981]/30 text-xs font-mono text-slate-100 w-full sm:w-72 max-w-full min-w-0 truncate"
                >
                  <option value="__FULL_SCRIPT__">
                     SCRIPT COMPLETO DE INSTALAÇÃO DO ZERO (FRONT + BACK)
                  </option>
                  {cleanVpsBundle?.arquivos.map((arq) => (
                    <option key={arq.path} value={arq.path}>
                      [{arq.category.toUpperCase()}] {arq.path} ({arq.lines} linhas)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            
            {cleanVpsBundle && (
              <div className="space-y-1.5">
                <div className="text-[11px] text-slate-400">
                   <strong>Atalhos de Peças do Sistema:</strong> Clique em qualquer botãozinho abaixo se quiser espiar apenas aquela parte do código (ou clique no primeiro botão verde para voltar ao pacote completo):
                </div>
                <div className="flex flex-wrap gap-1.5 max-w-full overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setSelectedCodeView('__FULL_SCRIPT__')}
                    className={`max-w-full truncate px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
                      selectedCodeView === '__FULL_SCRIPT__'
                        ? 'bg-[#10B981] text-[#04120C]'
                        : 'bg-black/40 text-slate-300 border border-white/10 hover:text-white'
                    }`}
                  >
                     Script Completo VPS do Zero ({cleanVpsBundle.totalLinhas} linhas)
                  </button>
                  {cleanVpsBundle.arquivos.map((arq) => (
                    <button
                      key={arq.path}
                      type="button"
                      onClick={() => setSelectedCodeView(arq.path)}
                      className={`max-w-full truncate px-2.5 py-1.5 rounded-lg text-[11px] font-mono transition-all cursor-pointer ${
                        selectedCodeView === arq.path
                          ? 'bg-[#F59E0B] text-slate-950 font-bold'
                          : 'bg-black/40 text-slate-400 border border-white/10 hover:text-white'
                      }`}
                    >
                      {arq.path}
                    </button>
                  ))}
                </div>
              </div>
            )}

            
            <div className="rounded-xl bg-black/80 border border-[#10B981]/25 overflow-hidden max-w-full">
              <div className="px-3 sm:px-4 py-2.5 bg-black/60 border-b border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs font-mono min-w-0">
                <span className="text-[#10B981] font-bold break-all min-w-0">
                  {selectedCodeView === '__FULL_SCRIPT__'
                    ? 'urutau-instalacao-vps-formatada-completo.sh (Instalação do Zero: Node 20 + PM2 + Nginx + Back-end + Front-end)'
                    : selectedCodeView}
                </span>
                <span className="text-slate-400 shrink-0">
                  {selectedCodeView === '__FULL_SCRIPT__'
                    ? `${cleanVpsBundle?.totalLinhas.toLocaleString('pt-BR') || 0} linhas`
                    : `${cleanVpsBundle?.arquivos.find((a) => a.path === selectedCodeView)?.lines.toLocaleString('pt-BR') || 0} linhas`}
                </span>
              </div>
              <div className="px-3 sm:px-4 py-2 bg-[#05100C] border-b border-white/10 text-[11px] text-slate-300 flex flex-wrap items-center justify-between gap-2">
                <span>
                   <strong>Janela de Leitura Somente-Consulta:</strong> Ao clicar dentro da caixa preta abaixo, todo o texto fica selecionado automaticamente sem risco de você apagar nenhuma letra sem querer.
                </span>
                <span className="font-mono text-emerald-400"> Read-Only Source Buffer (UTF-8)</span>
              </div>
              <textarea
                readOnly
                value={
                  loadingCleanVpsCode
                    ? 'Carregando código-fonte completo do Front-end e Back-end...'
                    : selectedCodeView === '__FULL_SCRIPT__'
                    ? cleanVpsBundle?.scriptInstalacaoCompleta || ''
                    : cleanVpsBundle?.arquivos.find((a) => a.path === selectedCodeView)?.content || ''
                }
                onClick={(e) => e.currentTarget.select()}
                className="w-full h-[460px] p-4 bg-transparent text-emerald-300 font-mono text-[11px] leading-relaxed focus:outline-none resize-y"
                spellCheck={false}
              />
            </div>
          </div>

          
          <div className="bg-[#11151E] border border-slate-800/90 rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1 flex-1 min-w-0">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  1.2 • Atalho Opcional: Atualizar uma VPS que Já Está Funcionando (Sem Perder Cadastros)
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong> Para Iniciantes:</strong> Qual a diferença deste comando curto para o código grande de cima? O código grande de cima serve para um servidor <strong>novo/vazio</strong>. Já esta linha curta abaixo serve para quando seu servidor <strong>já está funcionando com clientes e reservas cadastrados</strong> e você quer apenas atualizar o visual das telas sem apagar nenhum cadastro!
                </p>
                <p className="text-[11px] text-slate-400 font-mono">
                   <strong>Para Mestres em TI:</strong> Executa pipeline de hot-reload aditivo: substitui exclusivamente artefatos de Front-end (<code className="text-slate-200">src/</code>, <code className="text-slate-200">dist/</code>), preserva <code className="text-emerald-300">urutau_db.json</code> e variáveis <code className="text-emerald-300">.env</code>, gera snapshot prévio em <code className="text-slate-200">/root/backups-urutau</code> e executa <code className="text-amber-300">pm2 reload</code> com zero downtime.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleCopyCommand(updateCmdFinal, 'vps-update-main')}
                className="px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs inline-flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto shrink-0"
              >
                {copiedCmdKey === 'vps-update-main' ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Atalho SSH Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copiar Atalho SSH de 1 Linha</span>
                  </>
                )}
              </button>
            </div>
            <div className="p-2.5 rounded-lg bg-black/70 border border-slate-800 font-mono text-xs text-amber-300 break-all select-all">
              {updateCmdFinal}
            </div>
          </div>

        </div>
      )}

      
      {secaoAtiva === 'marca' && (
        <div className="space-y-5">
          {onChangeBackgroundBrightness && (
            <div className="bg-[#11151E] border border-slate-800/90 rounded-xl p-4 sm:p-5">
              <BackgroundBrightnessControlPanel
                effectiveBrightness={effectiveBrightness}
                adminMasterBrightness={adminMasterBrightness}
                userBrightnessOverride={userBrightnessOverride}
                isAdminMaster={isSuperAdminUser(currentUser)}
                userName={currentUser?.nome}
                onChangeBrightness={onChangeBackgroundBrightness}
              />
            </div>
          )}

          <div className="bg-[#11151E] border border-slate-800/90 rounded-xl p-4 sm:p-5 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <h3 className="text-base font-bold text-slate-100">
                Aparência e Identidade da Empresa
              </h3>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleSalvarAparenciaEmpresaNoSistema}
                  className="px-4 py-2.5 rounded-lg bg-[#10B981] hover:bg-[#10B981]/90 text-[#04120C] font-black text-xs inline-flex items-center justify-center gap-2 cursor-pointer shadow-md w-full sm:w-auto"
                >
                  <Check className="w-4 h-4 shrink-0" />
                  <span>Salvar Aparência</span>
                </button>
              </div>
            </div>

            {aparenciaSalvaFeedback && (
              <div className="p-3 rounded-lg bg-[#10B981]/15 border border-[#10B981]/40 text-xs font-bold text-[#10B981] flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{aparenciaSalvaFeedback}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-5 p-4 rounded-xl bg-[#0B0D11] border border-slate-800 space-y-4">
                <div className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Logo e Nome da Empresa
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-xl bg-[#131B24] border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                    {activeBrand.logoDataUrl ? (
                      <img
                        src={activeBrand.logoDataUrl}
                        alt="Logo da Empresa"
                        className="w-full h-full object-contain p-1.5"
                      />
                    ) : (
                      <UrutauEmblemSVG className="w-12 h-12" postura="favicon" />
                    )}
                  </div>

                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer transition-all">
                        <Upload className="w-4 h-4" />
                        <span>Subir Logo</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoFileUpload}
                          className="hidden"
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
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#131B24] hover:bg-slate-800 border border-emerald-500/40 text-emerald-300 font-bold text-xs cursor-pointer transition-all"
                      >
                        <span>Galeria</span>
                      </button>
                    </div>

                    {activeBrand.logoDataUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateBrandParameters({
                            logoDataUrl: '',
                            imagePlacements: {
                              ...(activeBrand.imagePlacements || {}),
                              topo_painel:
                                activeBrand.imagePlacements?.topo_painel === 'logo_empresa'
                                  ? 'favicon'
                                  : activeBrand.imagePlacements?.topo_painel || 'favicon'
                            }
                          })
                        }
                        className="block text-[11px] text-rose-400 hover:underline cursor-pointer"
                      >
                        Remover logo
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Nome da Empresa
                  </label>
                  <input
                    type="text"
                    value={activeBrand.companyName || ''}
                    onChange={(e) => handleUpdateBrandParameters({ companyName: e.target.value })}
                    placeholder="Ex: Grupo Gastronômico / Sua Marca"
                    className="w-full px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="lg:col-span-7 p-4 rounded-xl bg-[#0B0D11] border border-slate-800 space-y-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Cores de Destaque da Marca
                  </div>
                  {activeBrand.logoDataUrl && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!activeBrand.logoDataUrl) return;
                        const extracted = await extractColorsFromLogoImage(activeBrand.logoDataUrl);
                        handleUpdateBrandParameters({
                          companyColorHex: extracted.dominantHex,
                          companySecondaryHex: extracted.secondaryHex,
                          companyTertiaryHex: extracted.tertiaryHex,
                          logoHighlights: extracted.highlights,
                          effectiveSecondaryHex: extracted.secondaryHex,
                          effectiveTertiaryHex: extracted.tertiaryHex
                        });
                      }}
                      className="text-[11px] font-bold text-cyan-400 hover:underline cursor-pointer"
                    >
                      Extrair Destaques da Logo
                    </button>
                  )}
                </div>

                {activeBrand.logoDataUrl &&
                  activeBrand.logoHighlights &&
                  activeBrand.logoHighlights.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-[#131B24] border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-slate-300">
                          Detalhes Detectados na Logo (Fundo Ignorado)
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Clique para definir Cor da Empresa
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {activeBrand.logoHighlights.map((hlHex, idx) => {
                          const isSelected =
                            (activeBrand.companyColorHex || '').toUpperCase() ===
                            hlHex.toUpperCase();
                          return (
                            <button
                              key={`${hlHex}-${idx}`}
                              type="button"
                              onClick={() =>
                                handleUpdateBrandParameters({
                                  companyColorHex: hlHex
                                })
                              }
                              className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-bold inline-flex items-center gap-1.5 cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-white/15 border-white text-white ring-1 ring-white/60'
                                  : 'bg-[#0B0D11] border-slate-700 text-slate-300 hover:border-slate-500'
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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-[#131B24] border border-slate-800 space-y-2">
                    <div className="text-[11px] text-slate-400 font-medium">
                      Cor da Empresa
                    </div>
                    <div className="flex items-center gap-2.5">
                      <input
                        type="color"
                        value={activeBrand.companyColorHex}
                        onChange={(e) =>
                          handleUpdateBrandParameters({
                            companyColorHex: e.target.value.toUpperCase()
                          })
                        }
                        className="w-10 h-10 rounded-lg cursor-pointer border border-white/20 bg-transparent p-0"
                      />
                      <div className="text-xs font-mono font-bold text-white">
                        {activeBrand.companyColorHex}
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#0A1F17] border border-slate-800 space-y-2">
                    <div className="text-[11px] text-slate-400 font-medium">
                      Base Urutau
                    </div>
                    <div className="flex items-center gap-2">
                      {[
                        { hex: '#10B981', nome: 'Turquesa Igarapé' },
                        { hex: '#F59E0B', nome: 'Ouro Guaraci' },
                        { hex: '#8B5CF6', nome: 'Açaí Bioluminescente' },
                        { hex: '#F43F5E', nome: 'Urucum Vibrante' }
                      ].map((base) => (
                        <button
                          key={base.hex}
                          type="button"
                          onClick={() => handleUpdateBrandParameters({ urutauBaseHex: base.hex })}
                          style={{ backgroundColor: base.hex }}
                          className={`w-7 h-7 rounded-lg border-2 transition-transform cursor-pointer ${
                            activeBrand.urutauBaseHex === base.hex
                              ? 'border-white scale-110'
                              : 'border-transparent opacity-70 hover:opacity-100'
                          }`}
                          title={`${base.nome} (${base.hex})`}
                        />
                      ))}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      {activeBrand.urutauBaseHex}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#0A1F17] border border-slate-700 space-y-2">
                    <div className="text-[11px] text-[#F59E0B] font-bold">
                      Cor Aplicada
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div
                        style={{ backgroundColor: activeBrand.effectivePrimaryHex }}
                        className="w-10 h-10 rounded-lg border border-white/25 shadow-md shrink-0"
                      />
                      <div className="text-xs font-mono font-bold text-white">
                        {activeBrand.effectivePrimaryHex}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">Proporção de Cor</span>
                    <span className="font-mono font-bold text-[#F59E0B]">
                      {Math.round((activeBrand.blendRatio ?? 0.72) * 100)}% Empresa /{' '}
                      {Math.round((1 - (activeBrand.blendRatio ?? 0.72)) * 100)}% Urutau
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={Math.round((activeBrand.blendRatio ?? 0.72) * 100)}
                    onChange={(e) =>
                      handleUpdateBrandParameters({ blendRatio: Number(e.target.value) / 100 })
                    }
                    className="w-full accent-[#10B981] cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 space-y-4">
              <h4 className="text-sm font-bold text-white">
                Gerenciador de Imagens da sua Empresa
              </h4>
              <UrutauSlotImageManager
                brandConfig={activeBrand}
                onUpdateBrandConfig={(next) => handleUpdateBrandParameters(next)}
              />
            </div>

            <LgpdGoogleSheetsCustodyPanel
              empresaId={Number(currentUser?.empresas_ids?.[0] || data?.empresas?.[0]?.id || 1)}
              empresaNome={activeBrand.companyName || data?.empresas?.[0]?.nome || 'Sua Empresa'}
              showAlert={showAlert}
            />
          </div>
        </div>
      )}

      
      {secaoAtiva === 'menus' && (
        <div className="space-y-5">
          
          <div className="bg-[#11151E] border border-slate-800/90 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  Hub de Edição dos Menus e Separadores
                </h3>
                <p className="text-xs text-slate-400">
                  Crie, renomeie, mova ou exclua qualquer separador e personalize ícones, cores e nomes de cada menu.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleSalvarAparenciaEmpresaNoSistema}
                  className="px-3.5 py-2 rounded-lg bg-[#10B981] hover:bg-[#10B981]/90 text-[#04120C] font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer w-full sm:w-auto"
                >
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>Salvar Menus & Separadores</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetMenusAndIcons}
                  className="px-3.5 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/35 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer w-full sm:w-auto"
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  <span>Restaurar Ordem da Foto</span>
                </button>
              </div>
            </div>

            {aparenciaSalvaFeedback && (
              <div className="p-3 rounded-lg bg-[#10B981]/15 border border-[#10B981]/40 text-xs font-bold text-[#10B981] flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{aparenciaSalvaFeedback}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0B0D11] p-3.5 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs font-bold text-slate-200">
                  Criar Novo Separador no Menu:
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 flex-1 max-w-md min-w-0">
                <input
                  type="text"
                  value={novoGrupoNome}
                  onChange={(e) => setNovoGrupoNome(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateGroup();
                    }
                  }}
                  placeholder="Ex: Comercial, Diretoria, Cozinha..."
                  className="flex-1 min-w-0 px-3 py-2 text-xs"
                />
                <button
                  type="button"
                  onClick={handleCreateGroup}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0 cursor-pointer w-full sm:w-auto"
                >
                  + Criar Separador
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFiltroGrupoEditor('todos')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  filtroGrupoEditor === 'todos'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-[#0B0D11] text-slate-300 border border-slate-800'
                }`}
              >
                Todos os Separadores ({categories.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setFiltroGrupoEditor(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    filtroGrupoEditor === cat.id
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-[#0B0D11] text-slate-300 border border-slate-800'
                  }`}
                >
                  {cat.titulo} ({cat.abas.length})
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {categories
                .filter((cat) => filtroGrupoEditor === 'todos' || cat.id === filtroGrupoEditor)
                .map((cat) => {
                  const realCatIdx = categories.findIndex((c) => c.id === cat.id);
                  return (
                    <div
                      key={cat.id}
                      className="p-4 rounded-xl bg-[#0B0D11] border border-slate-800 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[220px]">
                          <span className="text-xs font-mono text-amber-400 font-bold">
                            SEPARADOR #{realCatIdx + 1}:
                          </span>
                          <input
                            type="color"
                            value={cat.corSimbolo || '#10B981'}
                            onChange={(e) => handleColorGroup(cat.id, e.target.value)}
                            className="w-7 h-7 rounded cursor-pointer bg-transparent border border-slate-700 p-0.5 shrink-0"
                            title="Cor do separador"
                          />
                          <input
                            type="text"
                            value={cat.titulo}
                            onChange={(e) => handleRenameGroup(cat.id, e.target.value)}
                            className="px-3 py-1.5 text-xs font-bold max-w-xs"
                            placeholder="Nome do separador"
                          />
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleMoveGroup(realCatIdx, -1)}
                            disabled={realCatIdx === 0}
                            className="px-2 py-1.5 rounded bg-[#131B24] hover:bg-slate-800 text-slate-200 disabled:opacity-30 cursor-pointer inline-flex items-center gap-1 text-[11px] font-semibold"
                            title="Subir este separador"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                            <span>Subir</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveGroup(realCatIdx, 1)}
                            disabled={realCatIdx === categories.length - 1}
                            className="px-2 py-1.5 rounded bg-[#131B24] hover:bg-slate-800 text-slate-200 disabled:opacity-30 cursor-pointer inline-flex items-center gap-1 text-[11px] font-semibold"
                            title="Descer este separador"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                            <span>Descer</span>
                          </button>
                          {categories.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteGroup(cat.id)}
                              className="px-2.5 py-1.5 rounded bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-300 text-[11px] font-bold cursor-pointer"
                              title="Excluir este separador (os menus dele serão mantidos automaticamente)"
                            >
                              Excluir Separador
                            </button>
                          )}
                        </div>
                      </div>

                      
                      {cat.abas.length === 0 ? (
                        <div className="p-3 text-xs text-slate-500 text-center">
                          Nenhum módulo neste grupo. Use o seletor &quot; Grupo&quot; em qualquer módulo abaixo para movê-lo para cá.
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-800/60">
                          {cat.abas.map((tabId, tabIdx) => {
                            const baseMeta = DEFAULT_TAB_META[tabId];
                            if (!baseMeta) return null;
                            const override = tabOverrides[tabId] || {};
                            const currentLabel = override.label ?? baseMeta.label;
                            const currentIcon = override.iconName ?? baseMeta.iconName;
                            const currentIconColor = override.iconColor ?? baseMeta.iconColor ?? '#10B981';
                            const isHidden = Boolean(override.hidden);
                            const isChoosingIcon = editingIconTab === tabId;

                            return (
                              <div key={tabId} className="py-3 space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  
                                  <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[240px]">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setEditingIconTab(isChoosingIcon ? null : tabId)
                                      }
                                      className="px-3 py-2 rounded-lg bg-[#131B24] hover:bg-slate-800 border border-slate-700 flex items-center gap-2 text-xs font-semibold text-amber-400 cursor-pointer shrink-0"
                                      title="Clique para trocar o ícone e a cor deste módulo"
                                    >
                                      <TabIconSVG
                                        tab={tabId}
                                        iconName={currentIcon}
                                        iconColor={currentIconColor}
                                        className="w-4 h-4"
                                      />
                                      <span>Ícone & Cor</span>
                                    </button>

                                    <input
                                      type="color"
                                      value={currentIconColor}
                                      onChange={(e) =>
                                        handleUpdateSingleTabOverride(tabId, {
                                          iconColor: e.target.value
                                        })
                                      }
                                      className="w-8 h-8 rounded cursor-pointer bg-transparent border border-slate-700 p-0.5 shrink-0"
                                      title="Cor do Símbolo deste Menu"
                                    />

                                    <input
                                      type="text"
                                      value={currentLabel}
                                      onChange={(e) =>
                                        handleUpdateSingleTabOverride(tabId, {
                                          label: e.target.value
                                        })
                                      }
                                      className="flex-1 max-w-xs px-3 py-1.5 text-xs font-semibold"
                                      placeholder={baseMeta.label}
                                    />
                                  </div>

                                  
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="flex items-center gap-1.5 text-xs">
                                      <span className="text-slate-400">Grupo:</span>
                                      <select
                                        value={cat.id}
                                        onChange={(e) =>
                                          handleMoveTabToGroup(tabId, e.target.value)
                                        }
                                        className="px-2.5 py-1.5 text-xs font-medium"
                                      >
                                        {categories.map((g) => (
                                          <option key={g.id} value={g.id}>
                                            {g.titulo}
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleMoveTabInGroup(cat.id, tabIdx, -1)}
                                        disabled={tabIdx === 0}
                                        className="p-1.5 rounded bg-[#131B24] hover:bg-slate-800 text-slate-300 disabled:opacity-30 cursor-pointer"
                                        title="Subir item dentro do grupo"
                                      >
                                        <ArrowUp className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleMoveTabInGroup(cat.id, tabIdx, 1)}
                                        disabled={tabIdx === cat.abas.length - 1}
                                        className="p-1.5 rounded bg-[#131B24] hover:bg-slate-800 text-slate-300 disabled:opacity-30 cursor-pointer"
                                        title="Descer item dentro do grupo"
                                      >
                                        <ArrowDown className="w-3.5 h-3.5" />
                                      </button>
                                    </div>

                                    {tabId !== 'config' && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleUpdateSingleTabOverride(tabId, {
                                            hidden: !isHidden
                                          })
                                        }
                                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                                          isHidden
                                            ? 'bg-rose-500/15 text-rose-300 border border-rose-500/35'
                                            : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35'
                                        }`}
                                      >
                                        {isHidden ? (
                                          <>
                                            <EyeOff className="w-3.5 h-3.5" />
                                            <span>Oculto</span>
                                          </>
                                        ) : (
                                          <>
                                            <Eye className="w-3.5 h-3.5" />
                                            <span>Visível</span>
                                          </>
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </div>

                                
                                {isChoosingIcon && (
                                  <div className="p-3.5 rounded-xl bg-[#131B24] border border-slate-700 space-y-3">
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="font-bold text-amber-400">
                                        1. Escolha a Cor do Símbolo para &quot;{currentLabel}&quot;:
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setEditingIconTab(null)}
                                        className="text-slate-400 hover:text-white cursor-pointer"
                                      >
                                        Fechar seletor
                                      </button>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                      {MENU_SYMBOL_COLOR_PALETTE.map((cItem) => (
                                        <button
                                          key={cItem.hex}
                                          type="button"
                                          onClick={() =>
                                            handleUpdateSingleTabOverride(tabId, {
                                              iconColor: cItem.hex
                                            })
                                          }
                                          title={cItem.nome}
                                          className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                                            currentIconColor.toUpperCase() ===
                                            cItem.hex.toUpperCase()
                                              ? 'border-white bg-black/50 text-white'
                                              : 'border-slate-800 bg-[#0B0D11] text-slate-300'
                                          }`}
                                        >
                                          <span
                                            className="w-3.5 h-3.5 rounded-full shrink-0"
                                            style={{ backgroundColor: cItem.hex }}
                                          />
                                          <span>{cItem.nome}</span>
                                        </button>
                                      ))}
                                    </div>

                                    <div className="text-xs font-bold text-amber-400 pt-1">
                                      2. Escolha o Símbolo / Ícone:
                                    </div>
                                    <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2">
                                      {AVAILABLE_MENU_ICONS.map((ic) => {
                                        const selected = currentIcon === ic.name;
                                        return (
                                          <button
                                            key={ic.name}
                                            type="button"
                                            onClick={() => {
                                              handleUpdateSingleTabOverride(tabId, {
                                                iconName: ic.name
                                              });
                                            }}
                                            className={`p-2 rounded-lg border text-left flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                              selected
                                                ? 'bg-amber-500/20 text-white border-amber-400 font-bold'
                                                : 'bg-[#0B0D11] text-slate-300 border-slate-800 hover:border-slate-600'
                                            }`}
                                          >
                                            <TabIconSVG
                                              tab={tabId}
                                              iconName={ic.name}
                                              iconColor={currentIconColor}
                                              className="w-4 h-4"
                                            />
                                            <span className="text-[10px] truncate w-full text-center">
                                              {ic.label.split('/')[0].trim()}
                                            </span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      
      {secaoAtiva === 'permissoes' && (
        <div className="bg-[#11151E] border border-slate-800/90 rounded-xl p-4 sm:p-5 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-[#0B0D11] border border-slate-800 rounded-lg">
            <div>
              <p className="text-xs font-bold text-slate-100">
                Cadeado de Segurança de Permissões (Gestores da Empresa & Subordinados)
              </p>
              <p className="text-[11px] text-slate-400">
                Os gestores das empresas podem destravar a matriz e definir exatamente o que os subordinados deles podem ver e editar.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMatrizDestravada((v) => !v)}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors min-h-[40px] cursor-pointer ${
                matrizDestravada
                  ? 'bg-amber-500 text-slate-950 border-amber-500'
                  : 'bg-[#151A25] text-amber-300 border-amber-500/40'
              }`}
            >
              {matrizDestravada ? <Unlock className="w-4 h-4 shrink-0" /> : <Lock className="w-4 h-4 shrink-0" />}
              <span>
                {matrizDestravada ? 'Bloquear Matriz de Permissões' : 'Destravar Matriz para Edição'}
              </span>
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider">
                1. Selecione o Subordinado / Colaborador para Configurar
              </label>

              <div className="flex flex-wrap items-center gap-1 bg-[#0B0D11] p-1 rounded-lg border border-slate-800">
                {[
                  {
                    id: 'subordinados',
                    label: ` Subordinados sob Minha Gestão (${
                      usuariosPermissoes.filter((u: any) =>
                        isSubordinadoDoGestor(currentUser, u, data.empresaAtivaId)
                      ).length
                    })`
                  },
                  {
                    id: 'gestores',
                    label: ` Gestores da Empresa (${
                      usuariosPermissoes.filter(
                        (u: any) =>
                          isGestorEmpresaUser(u) ||
                          (isSuperAdminUser(currentUser) && isSuperAdminUser(u))
                      ).length
                    })`
                  },
                  {
                    id: 'todos',
                    label: ` Todos (${usuariosPermissoes.length})`
                  }
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFiltroPermissoes(f.id as any)}
                    className={`px-2.5 py-1.5 rounded text-xs font-semibold transition-all cursor-pointer ${
                      filtroPermissoes === f.id
                        ? 'bg-[#10B981] text-[#04120C] font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {usuariosPermissoes.length === 0 ? (
              <div className="p-4 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-400">
                Nenhum colaborador cadastrado no sistema.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {usuariosPermissoes
                  .filter((u: any) => {
                    if (filtroPermissoes === 'subordinados') {
                      return isSubordinadoDoGestor(currentUser, u, data.empresaAtivaId);
                    }
                    if (filtroPermissoes === 'gestores') {
                      return (
                        isGestorEmpresaUser(u) ||
                        (isSuperAdminUser(currentUser) && isSuperAdminUser(u))
                      );
                    }
                    return true;
                  })
                  .map((u: any) => {
                    const isSelected = Number(u.id) === Number(usuarioSelecionadoId);
                    const ehSubordinado = isSubordinadoDoGestor(
                      currentUser,
                      u,
                      data.empresaAtivaId
                    );
                    const gestorDireto = usuariosPermissoes.find(
                      (g: any) => Number(g.id) === Number(u.gestor_id)
                    );
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setUsuarioSelecionadoId(Number(u.id))}
                        className={`p-3 text-left rounded-lg border transition-all cursor-pointer min-h-[60px] flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-500 text-slate-100 shadow-lg'
                            : 'bg-[#0B0D11] border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="truncate min-w-0 flex-1">
                          <div className="text-xs font-bold truncate flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="truncate">{u.nome}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">
                            {u.cargo} · <span className="text-amber-400/90">{u.tipo}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            {ehSubordinado && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                                 Subordinado
                              </span>
                            )}
                            {gestorDireto && (
                              <span className="text-[10px] text-slate-400 truncate">
                                Gestor: {gestorDireto.nome}
                              </span>
                            )}
                          </div>
                        </div>
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
              </div>
            )}
          </div>

          {usuarioAtual && (
            <div className="space-y-6 pt-2 border-t border-slate-800/80">
              <div className="p-3.5 rounded-xl bg-[#071712] border border-[#10B981]/40 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <span className="text-slate-400">Você está logado como:</span>{' '}
                  <strong className="text-[#10B981]">{currentUser?.nome || 'Operador'}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Configurando permissões da ficha de:</span>{' '}
                  <strong className="text-amber-300">{usuarioAtual.nome}</strong> ({usuarioAtual.cargo || usuarioAtual.tipo})
                </div>
              </div>
              
              <div className="p-4 rounded-xl bg-[#0B0D11] border border-[#10B981]/30 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-[#10B981] uppercase tracking-wider">
                      Hierarquia & Alçada de Gestão de {usuarioAtual.nome}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Vincule o gestor direto deste colaborador (ou deixe Sem Gestor Superior para profissionais autônomos/independentes).
                    </p>
                  </div>
                  {!podeGerenciarUsuarioAlvo(usuarioAtual) && (
                    <span className="px-2.5 py-1 rounded bg-rose-500/15 border border-rose-500/35 text-rose-300 text-[11px] font-semibold">
                      Conta Superior / Protegida
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-2.5 rounded-lg bg-[#11151E] border border-slate-800 space-y-1">
                    <label className="block text-[11px] text-slate-400 font-semibold">
                      Gestor Direto Responsável:
                    </label>
                    <select
                      value={usuarioAtual.gestor_id ?? ''}
                      disabled={!matrizDestravada || !podeGerenciarUsuarioAlvo(usuarioAtual)}
                      onChange={(e) =>
                        handleAtualizarHierarquiaOuPrivilegioGestor(usuarioAtual, {
                          gestor_id: e.target.value ? Number(e.target.value) : null
                        })
                      }
                      className="w-full px-2.5 py-1.5 rounded bg-[#0B0D11] border border-slate-700 text-xs text-slate-100 disabled:opacity-50"
                    >
                      <option value="">Sem Gestor Superior / Autônomo (Independente / Topo)</option>
                      {usuariosPermissoes
                        .filter(
                          (g: any) =>
                            Number(g.id) !== Number(usuarioAtual.id) &&
                            (isGestorEmpresaUser(g) ||
                              (isSuperAdminUser(currentUser) && isSuperAdminUser(g)))
                        )
                        .map((g: any) => (
                          <option key={g.id} value={g.id}>
                             {g.nome} ({g.cargo || g.tipo})
                          </option>
                        ))}
                    </select>
                  </div>

                  <label className="p-2.5 rounded-lg bg-[#11151E] border border-slate-800 flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!matrizDestravada || !podeGerenciarUsuarioAlvo(usuarioAtual)}
                      checked={isGestorEmpresaUser(usuarioAtual)}
                      onChange={(e) =>
                        handleAtualizarHierarquiaOuPrivilegioGestor(usuarioAtual, {
                          gerenciar_subordinados: e.target.checked,
                          tipo:
                            e.target.checked && usuarioAtual.tipo === 'Colaborador'
                              ? 'Gerente'
                              : usuarioAtual.tipo
                        })
                      }
                      className="mt-0.5 w-4 h-4 accent-[#10B981]"
                    />
                    <div className="text-xs">
                      <div className="font-bold text-slate-100">
                         Definir Permissões de Subordinados
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Habilita este gestor a configurar o acesso dos subordinados dele.
                      </div>
                    </div>
                  </label>

                  <label className="p-2.5 rounded-lg bg-[#11151E] border border-slate-800 flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!matrizDestravada || !podeGerenciarUsuarioAlvo(usuarioAtual)}
                      checked={podeMudarAparenciaSistema(usuarioAtual)}
                      onChange={(e) =>
                        handleAtualizarHierarquiaOuPrivilegioGestor(usuarioAtual, {
                          mudar_aparencia: e.target.checked
                        })
                      }
                      className="mt-0.5 w-4 h-4 accent-[#10B981]"
                    />
                    <div className="text-xs">
                      <div className="font-bold text-slate-100">
                         Mudar a Aparência do Sistema
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Habilita personalizar logo, cores e organização de menus da empresa.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="space-y-3 bg-[#0B0D11] p-4 rounded-xl border border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckSquare className="w-4 h-4" />
                      2. Permissões e Escopo Individual por Função Operacional
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Para o colaborador <strong>{usuarioAtual.nome}</strong>, defina individualmente se ele pode visualizar, editar e o escopo de dados:
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAplicarLotePermissoes(usuarioAtual, 'total')}
                      className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 rounded text-xs font-semibold transition-colors min-h-[36px] cursor-pointer"
                    >
                      Liberar Tudo (Ver + Editar)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAplicarLotePermissoes(usuarioAtual, 'leitura')}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-medium transition-colors min-h-[36px] cursor-pointer"
                    >
                      Apenas Consulta
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAplicarLotePermissoes(usuarioAtual, 'bloqueado')}
                      className="px-2.5 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 rounded text-xs font-medium transition-colors min-h-[36px] cursor-pointer"
                    >
                      Bloquear Tudo
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-800 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-[#121622] text-[11px] font-mono uppercase text-slate-400">
                        <th className="py-2.5 px-3">Função / Módulo</th>
                        <th className="py-2.5 px-3 text-center w-28">Pode Visualizar</th>
                        <th className="py-2.5 px-3 text-center w-28">Pode Editar</th>
                        <th className="py-2.5 px-3 text-left w-56">Escopo de Visualização</th>
                        <th className="py-2.5 px-3 text-center w-36">Status de Acesso</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-[#0E121B]">
                      {MODULOS_CONFIG_PERMISSOES.map((mod) => {
                        const isMaster =
                          usuarioAtual.tipo === 'Super Admin' ||
                          usuarioAtual.permissoes_json?.total;

                        const modPerm = usuarioAtual.permissoes_json?.modulos?.[mod.id] || {
                          ver: isMaster || !!usuarioAtual.permissoes_json?.[mod.id],
                          editar: isMaster || !!usuarioAtual.permissoes_json?.[mod.id],
                          escopo: 'todos'
                        };

                        const podeVer = isMaster || modPerm.ver;
                        const podeEditar = isMaster || modPerm.editar;
                        const escopoMod = modPerm.escopo || 'todos';

                        return (
                          <tr key={mod.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-200">{mod.label}</div>
                              <div className="text-[11px] text-slate-400">{mod.desc}</div>
                            </td>

                            <td className="py-2.5 px-3 text-center">
                              <label className="inline-flex items-center justify-center p-2 rounded hover:bg-amber-500/10 cursor-pointer min-h-[44px] min-w-[44px]">
                                <input
                                  type="checkbox"
                                  checked={podeVer}
                                  onChange={() =>
                                    handleToggleModuloPermissao(usuarioAtual, mod.id, 'ver')
                                  }
                                  className="w-4 h-4 accent-amber-500 cursor-pointer"
                                />
                              </label>
                            </td>

                            <td className="py-2.5 px-3 text-center">
                              <label className="inline-flex items-center justify-center p-2 rounded hover:bg-amber-500/10 cursor-pointer min-h-[44px] min-w-[44px]">
                                <input
                                  type="checkbox"
                                  checked={podeEditar}
                                  onChange={() =>
                                    handleToggleModuloPermissao(usuarioAtual, mod.id, 'editar')
                                  }
                                  className="w-4 h-4 accent-amber-500 cursor-pointer"
                                />
                              </label>
                            </td>

                            <td className="py-2.5 px-3">
                              <select
                                value={escopoMod}
                                disabled={!podeVer}
                                onChange={(e) =>
                                  handleAlterarEscopoModulo(
                                    usuarioAtual,
                                    mod.id,
                                    e.target.value as 'todos' | 'subordinados' | 'pessoal'
                                  )
                                }
                                aria-label={`Escopo para ${mod.label}`}
                                className={`w-full px-2.5 py-1.5 rounded text-xs bg-[#121622] border transition-colors ${
                                  !podeVer
                                    ? 'text-slate-600 border-slate-800/80 cursor-not-allowed opacity-50'
                                    : 'text-slate-200 border-slate-700 hover:border-amber-500/50 cursor-pointer'
                                }`}
                              >
                                <option value="todos"> De Todo Mundo</option>
                                <option value="subordinados"> Apenas Subordinados</option>
                                <option value="pessoal"> Apenas Próprio (Pessoal)</option>
                              </select>
                            </td>

                            <td className="py-2.5 px-3 text-center">
                              {podeEditar ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  <Edit3 className="w-3 h-3 text-amber-400" />
                                  Ver + Editar
                                </span>
                              ) : podeVer ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                                  <Eye className="w-3 h-3 text-blue-400" />
                                  Apenas Consulta
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-800/80 border border-slate-700">
                                  Sem Acesso
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {salvandoPermissoes && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs font-mono text-amber-300 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Salvando alterações de permissões em tempo real...</span>
                </div>
              )}

              
              <div className="bg-[#0B0D11] border border-[#10B981]/35 rounded-xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <MapPin className="w-5 h-5 text-[#10B981]" />
                    <div>
                      <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                        Trava de Perímetro GPS (Dentro da Empresa) & Bloqueio Fora de Turno
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Escolha quais menus exigem que o colaborador esteja fisicamente dentro da empresa e quais são bloqueados fora do horário de turno.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {onSimulateGpsPosition && (
                      <>
                        <button
                          type="button"
                          onClick={() => onSimulateGpsPosition(true)}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer border ${
                            !userGpsLocation?.simulated || userGpsLocation.label.includes('Dentro')
                              ? 'bg-[#10B981] text-[#05100C] border-[#10B981]'
                              : 'bg-[#11151E] text-slate-300 border-slate-700'
                          }`}
                        >
                           Simular Dentro da Empresa
                        </button>
                        <button
                          type="button"
                          onClick={() => onSimulateGpsPosition(false)}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer border ${
                            userGpsLocation?.simulated && userGpsLocation.label.includes('Fora')
                              ? 'bg-rose-500 text-white border-rose-500'
                              : 'bg-[#11151E] text-slate-300 border-slate-700'
                          }`}
                        >
                           Simular Fora da Empresa (~890m)
                        </button>
                      </>
                    )}
                    {onChangeSimulatedShiftMode && (
                      <select
                        value={simulatedShiftMode}
                        onChange={(e) => onChangeSimulatedShiftMode(e.target.value as any)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#11151E] border border-amber-500/40 text-[11px] font-bold text-amber-300"
                      >
                        <option value="auto"> Turno Automático (Relógio)</option>
                        <option value="em_turno"> Forçar Em Turno (Teste)</option>
                        <option value="fora_turno"> Forçar Fora de Turno (Teste)</option>
                      </select>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="p-3 rounded-lg bg-[#11151E] border border-slate-800 flex items-center justify-between gap-2 cursor-pointer">
                    <div>
                      <div className="text-xs font-bold text-slate-100">Exigir GPS na Empresa</div>
                      <div className="text-[10px] text-slate-400">Bloqueia menus selecionados fora do raio</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={securityGeofenceConfig.geofenceAtivo}
                      onChange={(e) =>
                        onUpdateSecurityGeofenceConfig &&
                        onUpdateSecurityGeofenceConfig({
                          ...securityGeofenceConfig,
                          geofenceAtivo: e.target.checked
                        })
                      }
                      className="accent-[#10B981] w-4 h-4"
                    />
                  </label>

                  <label className="p-3 rounded-lg bg-[#11151E] border border-slate-800 flex items-center justify-between gap-2 cursor-pointer">
                    <div>
                      <div className="text-xs font-bold text-slate-100">Bloquear Fora de Turno</div>
                      <div className="text-[10px] text-slate-400">Restringe acesso fora da escala/horário</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={securityGeofenceConfig.bloqueioForaDeTurnoAtivo}
                      onChange={(e) =>
                        onUpdateSecurityGeofenceConfig &&
                        onUpdateSecurityGeofenceConfig({
                          ...securityGeofenceConfig,
                          bloqueioForaDeTurnoAtivo: e.target.checked
                        })
                      }
                      className="accent-amber-500 w-4 h-4"
                    />
                  </label>

                  <label className="p-3 rounded-lg bg-[#11151E] border border-slate-800 flex items-center justify-between gap-2 cursor-pointer">
                    <div>
                      <div className="text-xs font-bold text-slate-100">Isentar Super Admin</div>
                      <div className="text-[10px] text-slate-400">Desmarque para testar o bloqueio em você</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={securityGeofenceConfig.isentarSuperAdmin}
                      onChange={(e) =>
                        onUpdateSecurityGeofenceConfig &&
                        onUpdateSecurityGeofenceConfig({
                          ...securityGeofenceConfig,
                          isentarSuperAdmin: e.target.checked
                        })
                      }
                      className="accent-amber-500 w-4 h-4"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                      Latitude Sede
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      value={securityGeofenceConfig.empresaLatitude}
                      onChange={(e) =>
                        onUpdateSecurityGeofenceConfig &&
                        onUpdateSecurityGeofenceConfig({
                          ...securityGeofenceConfig,
                          empresaLatitude: Number(e.target.value)
                        })
                      }
                      className="w-full px-2.5 py-1.5 bg-[#11151E] border border-slate-800 rounded text-xs font-mono text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                      Longitude Sede
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      value={securityGeofenceConfig.empresaLongitude}
                      onChange={(e) =>
                        onUpdateSecurityGeofenceConfig &&
                        onUpdateSecurityGeofenceConfig({
                          ...securityGeofenceConfig,
                          empresaLongitude: Number(e.target.value)
                        })
                      }
                      className="w-full px-2.5 py-1.5 bg-[#11151E] border border-slate-800 rounded text-xs font-mono text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                      Raio Permitido (m)
                    </label>
                    <input
                      type="number"
                      min={20}
                      max={5000}
                      value={securityGeofenceConfig.raioPermitidoMetros}
                      onChange={(e) =>
                        onUpdateSecurityGeofenceConfig &&
                        onUpdateSecurityGeofenceConfig({
                          ...securityGeofenceConfig,
                          raioPermitidoMetros: Number(e.target.value)
                        })
                      }
                      className="w-full px-2.5 py-1.5 bg-[#11151E] border border-slate-800 rounded text-xs font-mono text-[#10B981] font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                      Início do Turno
                    </label>
                    <input
                      type="time"
                      value={securityGeofenceConfig.horarioInicioTurnoPadrao}
                      onChange={(e) =>
                        onUpdateSecurityGeofenceConfig &&
                        onUpdateSecurityGeofenceConfig({
                          ...securityGeofenceConfig,
                          horarioInicioTurnoPadrao: e.target.value
                        })
                      }
                      className="w-full px-2.5 py-1.5 bg-[#11151E] border border-slate-800 rounded text-xs font-mono text-amber-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                      Fim do Turno
                    </label>
                    <input
                      type="time"
                      value={securityGeofenceConfig.horarioFimTurnoPadrao}
                      onChange={(e) =>
                        onUpdateSecurityGeofenceConfig &&
                        onUpdateSecurityGeofenceConfig({
                          ...securityGeofenceConfig,
                          horarioFimTurnoPadrao: e.target.value
                        })
                      }
                      className="w-full px-2.5 py-1.5 bg-[#11151E] border border-slate-800 rounded text-xs font-mono text-amber-300"
                    />
                  </div>
                </div>

                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
                  <div className="p-3.5 rounded-xl bg-[#11151E] border border-slate-800 space-y-2.5">
                    <div className="text-xs font-bold text-[#10B981] flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Funcionalidades que Exigem Estar DENTRO da Empresa:</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {MODULOS_CONFIG_PERMISSOES.map((m) => {
                        const tId = m.id as TabId;
                        const exige = (securityGeofenceConfig.abasExigemLocalizacaoEmpresa || []).includes(tId);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              if (!onUpdateSecurityGeofenceConfig) return;
                              const atual = securityGeofenceConfig.abasExigemLocalizacaoEmpresa || [];
                              const prox = exige ? atual.filter((x) => x !== tId) : [...atual, tId];
                              onUpdateSecurityGeofenceConfig({
                                ...securityGeofenceConfig,
                                abasExigemLocalizacaoEmpresa: prox
                              });
                            }}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-left flex items-center justify-between gap-1 border transition-colors cursor-pointer ${
                              exige
                                ? 'bg-[#10B981]/20 border-[#10B981] text-white'
                                : 'bg-[#0B0D11] border-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <span className="truncate">{m.label}</span>
                            <span className="font-mono text-[10px]">{exige ? '' : '—'}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#11151E] border border-slate-800 space-y-2.5">
                    <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Funcionalidades Bloqueadas FORA DE TURNO:</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {MODULOS_CONFIG_PERMISSOES.map((m) => {
                        const tId = m.id as TabId;
                        const bloq = (securityGeofenceConfig.abasBloqueadasForaDeTurno || []).includes(tId);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              if (!onUpdateSecurityGeofenceConfig) return;
                              const atual = securityGeofenceConfig.abasBloqueadasForaDeTurno || [];
                              const prox = bloq ? atual.filter((x) => x !== tId) : [...atual, tId];
                              onUpdateSecurityGeofenceConfig({
                                ...securityGeofenceConfig,
                                abasBloqueadasForaDeTurno: prox
                              });
                            }}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-left flex items-center justify-between gap-1 border transition-colors cursor-pointer ${
                              bloq
                                ? 'bg-amber-500/20 border-amber-500 text-white'
                                : 'bg-[#0B0D11] border-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <span className="truncate">{m.label}</span>
                            <span className="font-mono text-[10px]">{bloq ? '' : '—'}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      
      {secaoAtiva === 'seguranca' && (
        <div className="space-y-5 max-w-full overflow-hidden">
          
          <div className="bg-[#11151E] border border-amber-500/35 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-400">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Guia de Entendimento • Item 5: Segurança, Cofre de Backups & Saúde do Servidor</span>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-[#10B981]/15 border border-[#10B981]/35 text-[#10B981] text-[11px] font-bold">
                Proteção Máxima Explicada Passo a Passo
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl bg-[#071712] border border-[#10B981]/30 space-y-2">
                <div className="text-xs font-black text-[#10B981]">
                   EXPLICAÇÃO SIMPLES (O QUE ESTA TELA FAZ POR VOCÊ)
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  Pense nesta tela como a <strong>portaria e o cofre do seu estabelecimento</strong>. Aqui você controla 4 proteções fundamentais:
                </p>
                <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
                  <li><strong>Chave Mestra (Senha):</strong> A senha principal que destrava áreas sensíveis.</li>
                  <li><strong>Trava Automática de Tela:</strong> Se alguém levantar do balcão e esquecer o sistema aberto, ele se tranca sozinho após alguns minutos.</li>
                  <li><strong>Cofre de Backup:</strong> Um botão que tira uma "foto completa" de todos os cadastros e guarda num cofre seguro na hora.</li>
                  <li><strong>Painel de Saúde (Velocímetro):</strong> Mostra se o computador do sistema está leve, rápido e saudável.</li>
                </ul>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0B0D11] border border-slate-800 space-y-2">
                <div className="text-xs font-black text-amber-400">
                   ESPECIFICAÇÃO TÉCNICA (ARQUITETURA DE SEGURANÇA & TELEMETRIA)
                </div>
                <ul className="space-y-1 text-[11px] text-slate-300 font-mono list-disc list-inside">
                  <li><strong>Derivação & Hash de Credencial Mestra:</strong> Persistência protegida com formato Argon2id / SHA-256 salted via endpoint <code className="text-emerald-300">POST /api/erp/alterar-senha-mestra</code> e registro imutável em <code className="text-slate-200">erp_audit_logs</code>.</li>
                  <li><strong>Watchdog de Sessão (Idle Timer):</strong> Listener de eventos DOM (<code className="text-slate-200">mousemove</code>, <code className="text-slate-200">keydown</code>, <code className="text-slate-200">touchstart</code>) parametrizável entre <code className="text-amber-300">30s</code> e <code className="text-amber-300">3600s</code>.</li>
                  <li><strong>Anti-Hard-Delete Middleware (Art. 1º):</strong> Interceptação em nível de protocolo HTTP retornando <code className="text-rose-400">405 Method Not Allowed</code> para qualquer verbo <code className="text-rose-400">DELETE</code> destrutivo.</li>
                  <li><strong>Snapshots Criptográficos:</strong> Geração de ponto de restauração verificado por checksum <code className="text-emerald-300">SHA-256</code>.</li>
                </ul>
              </div>
            </div>
          </div>

          
          <div className="bg-[#11151E] border border-slate-800/90 rounded-xl p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            <div className="p-4 bg-[#0B0D11] border border-slate-800 rounded-xl space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-black uppercase tracking-wider text-amber-400">
                    5.1 • Atualizar Senha Mestra Administrativa
                  </div>
                  <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px] font-mono">
                    Mínimo 6 caracteres
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-[#071712] border border-[#10B981]/25 text-xs text-slate-200 space-y-1">
                  <div className="font-bold text-[#10B981]"> Explicação Simples:</div>
                  <p className="text-[11px] leading-relaxed">
                    • <strong>Para que serve?</strong> É a senha do dono/administrador usada para destravar a tela de Permissões ou desbloquear o sistema quando ele entra em descanso.
                    <br />• <strong>Como mudar?</strong> Digite a senha nova na caixinha abaixo (pelo menos 6 letras ou números) e aperte <strong>Salvar Senha</strong>. Se deixar em branco e não apertar o botão, sua senha atual continua a mesma.
                  </p>
                </div>

                <p className="text-[11px] font-mono text-slate-400">
                   <strong>Técnico:</strong> Atualiza o hash mestre no banco persistente (<code className="text-slate-200">POST /api/erp/alterar-senha-mestra</code>) e grava trilha de auditoria sem expor a senha em texto puro nos logs (sanitizada automaticamente).
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <input
                  type="password"
                  value={novaSenhaMestra}
                  onChange={(e) => setNovaSenhaMestra(e.target.value)}
                  placeholder="Digite aqui a nova Senha Mestra (mín. 6 dígitos)"
                  className="flex-1 min-w-0 px-3 py-2 text-xs font-mono min-h-[40px]"
                />
                <button
                  type="button"
                  onClick={handleAlterarSenhaMestra}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg min-h-[40px] cursor-pointer w-full sm:w-auto"
                >
                  Salvar Senha
                </button>
              </div>
            </div>

            
            <div className="p-4 bg-[#0B0D11] border border-slate-800 rounded-xl space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-amber-400">
                    5.2 • Tempo de Bloqueio Automático por Inatividade
                  </h4>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10px] font-mono">
                    Ativo: {inactivityLimitSec}s ({Math.round((inactivityLimitSec / 60) * 10) / 10} min)
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-[#071712] border border-[#10B981]/25 text-xs text-slate-200 space-y-1">
                  <div className="font-bold text-[#10B981]"> Explicação Simples:</div>
                  <p className="text-[11px] leading-relaxed">
                    • <strong>O que é isto?</strong> Funciona igual ao bloqueio de tela do celular: quando ninguém toca na tela, no mouse ou no teclado durante esse tempo, o sistema coloca uma cortina de proteção para nenhum curioso mexer no caixa ou nas reservas.
                    <br />• <strong>Como regular?</strong> <code className="text-amber-300">60</code> segundos = 1 minuto. <code className="text-amber-300">300</code> segundos = 5 minutos (o mais recomendado). Clique em <strong>Padrão 300s (5 min)</strong> para voltar ao ideal com 1 toque.
                  </p>
                </div>

                <p className="text-[11px] font-mono text-slate-400">
                   <strong>Técnico:</strong> Define o threshold do state reativo <code className="text-slate-200">inactivityLimitSec</code> (intervalo permitido: <code className="text-slate-200">30s</code> a <code className="text-slate-200">3600s</code>). Quando <code className="text-slate-200">idleSeconds &gt;= inactivityLimitSec</code>, aciona o modal de bloqueio de sessão sem perda de estado de formulário em memória.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <input
                  type="number"
                  min={30}
                  max={3600}
                  value={inactivityLimitSec}
                  onChange={(e) => onChangeInactivityLimit(Math.max(30, Number(e.target.value)))}
                  className="w-32 px-3 py-2 text-xs font-mono min-h-[40px]"
                />
                <button
                  type="button"
                  onClick={() => onChangeInactivityLimit(300)}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg min-h-[40px] cursor-pointer"
                >
                  Padrão 300s (5 min)
                </button>
              </div>
            </div>
          </div>

          
          <div className="bg-[#11151E] border border-slate-800/90 rounded-xl p-4 sm:p-5 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="space-y-1 min-w-0 flex-1">
                <div className="text-xs font-black uppercase tracking-wider text-[#10B981]">
                  5.3 • Cofre de Backups Instantâneos, Blindagem Anti-Apagamento & Saúde do Servidor
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong> Para Iniciantes:</strong> Use os dois botões ao lado sempre que quiser guardar uma cópia extra de segurança antes de fechar o dia, ou testar se a trava que impede apagar dados por engano está ligada.
                </p>
                <p className="text-[11px] font-mono text-slate-400">
                   <strong>Para Mestres em TI:</strong> O botão de backup invoca <code className="text-emerald-300">POST /api/erp/backup-agora</code> gerando digest criptográfico <code className="text-amber-300">SHA-256</code> do payload persistido. O botão de teste valida a proteção <code className="text-rose-400">HTTP 405 Method Not Allowed</code> na rota crítica.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                <button
                  type="button"
                  onClick={handleDispararBackupAgora}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-lg cursor-pointer inline-flex items-center justify-center gap-2 w-full sm:w-auto shadow-md"
                >
                  <Database className="w-4 h-4 shrink-0" />
                  <span>Executar Backup Agora (Criar Cópia Segura)</span>
                </button>
                <button
                  type="button"
                  onClick={handleTestarBloqueioDelete}
                  className="px-4 py-2.5 bg-[#071712] hover:bg-[#113025] text-[#10B981] border border-[#10B981]/40 font-bold text-xs rounded-lg cursor-pointer inline-flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Testar Blindagem Anti-Exclusão (HTTP 405)</span>
                </button>
              </div>
            </div>

            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-[#0B0D11] border border-amber-500/25 space-y-1">
                <div className="font-bold text-amber-400"> O que acontece ao clicar em "Executar Backup Agora"?</div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  <strong> Simples:</strong> O sistema tira uma cópia fiel de tudo o que está cadastrado neste exato segundo e mostra na tela um "código de lacre" (chamado Hash SHA-256) provando que a cópia foi guardada sem nenhum erro.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-[#0B0D11] border border-[#10B981]/25 space-y-1">
                <div className="font-bold text-[#10B981]"> O que acontece ao clicar em "Testar Blindagem Anti-Exclusão"?</div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  <strong> Simples:</strong> Faz uma simulação segura tentando dar um comando de "apagar banco" só para você ver o escudo do sistema bloqueando na hora! Nenhum dado é apagado; ele apenas mostra o aviso confirmando que o escudo está funcionando.
                </p>
              </div>
            </div>

            
            {vpsStatus && (
              <div className="space-y-2.5">
                <div className="text-xs font-bold text-slate-200">
                  5.4 • Velocímetro e Saúde do Servidor em Tempo Real (Entenda Cada Número Abaixo):
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  
                  <div className="p-3.5 bg-[#0B0D11] border border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-300">1. Memória RAM</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10px] font-mono">
                        Saudável
                      </span>
                    </div>
                    <div className="text-base font-mono font-black text-slate-100 tabular-nums">
                      {vpsStatus.memoria_usada_mb} MB / {vpsStatus.memoria_total_mb} MB
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug">
                       <strong>Simples:</strong> É o "fôlego" do computador. O primeiro número ({vpsStatus.memoria_usada_mb} MB) é o que está sendo usado agora; o segundo ({vpsStatus.memoria_total_mb} MB) é o espaço total disponível. Quanto menor o primeiro número, mais leve está!
                    </p>
                    <p className="text-[10px] font-mono text-slate-400">
                       <strong>Técnico:</strong> RSS / Heap alocado pelo processo Node.js v20 via <code className="text-slate-200">process.memoryUsage()</code> vs RAM física/alocada ao container.
                    </p>
                  </div>

                  
                  <div className="p-3.5 bg-[#0B0D11] border border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-300">2. Tempo Online</span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px] font-mono">
                        24/7 Ativo
                      </span>
                    </div>
                    <div className="text-base font-mono font-black text-amber-400 tabular-nums">
                      {vpsStatus.uptime_seg}s ({Math.floor(vpsStatus.uptime_seg / 60)} min)
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug">
                       <strong>Simples:</strong> Mostra há quantos segundos (e minutos) o motor do sistema está ligado direto sem piscar e sem cair desde a última atualização.
                    </p>
                    <p className="text-[10px] font-mono text-slate-400">
                       <strong>Técnico:</strong> Uptime contínuo do processo servidor reportado por <code className="text-slate-200">Math.floor(process.uptime())</code> sob supervisão PM2.
                    </p>
                  </div>

                  
                  <div className="p-3.5 bg-[#0B0D11] border border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-300">3. Eventos Processados</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10px] font-mono">
                        Fila Zerada
                      </span>
                    </div>
                    <div className="text-base font-mono font-black text-emerald-400 tabular-nums">
                      {vpsStatus.outbox_processados} processados
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug">
                       <strong>Simples:</strong> Conta quantas operações (reservas salvas, vendas no caixa, estoque atualizado) o sistema já entregou e gravou com sucesso.
                    </p>
                    <p className="text-[10px] font-mono text-slate-400">
                       <strong>Técnico:</strong> Contador da tabela <code className="text-slate-200">outbox_events</code> com <code className="text-slate-200">status = 'PROCESSED'</code> propagados via Server-Sent Events (SSE).
                    </p>
                  </div>

                  
                  <div className="p-3.5 bg-[#0B0D11] border border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-300">4. Cache em Memória</span>
                      <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 text-[10px] font-mono">
                        Ultra Rápido
                      </span>
                    </div>
                    <div className="text-base font-mono font-black text-slate-100 tabular-nums">
                      {vpsStatus.cache_hits} leituras rápidas
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug">
                       <strong>Simples:</strong> É a "memória de ponta da língua" do sistema. Cada vez que você troca de aba, ele entrega os dados instantaneamente sem demora.
                    </p>
                    <p className="text-[10px] font-mono text-slate-400">
                       <strong>Técnico:</strong> In-memory state hits servidos em <code className="text-slate-200">&lt;1ms</code> evitando I/O bloqueante de disco a cada request GET.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      
      {secaoAtiva === 'prompt_ia' && (
        <div className="space-y-5 max-w-full overflow-hidden">
          
          <div className="bg-[#11151E] border border-amber-500/35 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-400">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>Guia de Entendimento • Item 6: O Manual de Regras para Inteligência Artificial (Prompt Mestre)</span>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold">
                Passo a Passo para Leigos + Governança para Engenheiros
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              
              <div className="p-3.5 rounded-xl bg-[#071712] border border-[#10B981]/35 space-y-2.5">
                <div className="text-xs font-black text-[#10B981]">
                   EXPLICAÇÃO SIMPLES: O QUE É "PROMPT" E COMO USAR MESMO SEM SABER INFORMÁTICA?
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  Imagine que você contratou um <strong>construtor robô muito inteligente</strong> (como o ChatGPT, o Claude ou o Gemini) para fazer uma melhoria no seu sistema. Se você não der as regras da casa para ele antes, ele pode pintar uma parede da cor errada ou derrubar uma coluna importante!
                  <br />
                  Este <strong>Prompt Mestre</strong> é justamente a <strong>folha de regras pronta</strong> que ensina ao robô tudo o que ele PODE e o que ele NÃO PODE fazer.
                </p>
                <div className="p-3 rounded-lg bg-black/40 border border-white/10 space-y-1.5 text-xs text-slate-200">
                  <div className="font-bold text-amber-300">Como usar em 3 passos super simples:</div>
                  <div>
                    <strong>Passo 1:</strong> Aperte o botão amarelo <strong>"Copiar Prompt Mestre Completo"</strong> logo abaixo.
                  </div>
                  <div>
                    <strong>Passo 2:</strong> Abra o site da Inteligência Artificial que você gosta de usar e <strong>Cole</strong> esse texto lá.
                  </div>
                  <div>
                    <strong>Passo 3:</strong> No final do texto colado, escreva com as suas próprias palavras o que você deseja (por exemplo: <em>"Quero adicionar um campo de observação no recibo"</em>) e envie!
                  </div>
                </div>
              </div>

              
              <div className="p-3.5 rounded-xl bg-[#0B0D11] border border-slate-800 space-y-2.5">
                <div className="text-xs font-black text-amber-400">
                   ESPECIFICAÇÃO TÉCNICA (SYSTEM PROMPT DE GOVERNANÇA ARQUITETURAL & LINTING)
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Projetado com engenharia de prompt estruturada (System Constraints + Architectural Invariants + Pre-Flight Verification Matrix) compatível com modelos SOTA (Gemini 2.5 Pro, Claude 3.7/4 Sonnet/Opus, GPT-4o/o3).
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="p-2.5 rounded bg-black/40 border border-rose-500/30 text-slate-300">
                    <div className="text-rose-400 font-bold mb-1"> Hard Guardrails (Proibições)</div>
                    Evita regressões destrutivas: bloqueia <code className="text-rose-300">DELETE</code> físico (força Soft-Delete), proíbe dialogs bloqueantes de browser, impede wipe de banco na VPS e blinda o cálculo matemático do Rateio.
                  </div>
                  <div className="p-2.5 rounded bg-black/40 border border-[#10B981]/30 text-slate-300">
                    <div className="text-[#10B981] font-bold mb-1"> Design & AST Verification</div>
                    Exige conformidade estrita com tokens CSS da paleta <em>Amazônia Viva</em>, componentes vetoriais de <code className="text-emerald-300">UrutauShared.tsx</code> e validação <code className="text-emerald-300">tsc --noEmit</code> + <code className="text-emerald-300">vite build</code>.
                  </div>
                </div>
              </div>
            </div>
          </div>

          
          <div className="bg-[#11151E] border border-slate-800/90 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>6.1 • Constituição Técnica & Design System Urutau (Pronto para Copiar)</span>
                </div>
                <h3 className="text-sm sm:text-base font-bold text-slate-100">
                  Prompt Mestre para Qualquer IA (Regras do Que Pode / Não Pode Fazer & Conferência de Código)
                </h3>
                <p className="text-xs text-slate-400">
                   Clique no botão amarelo ao lado para copiar todo o manual de regras abaixo com 1 toque.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleCopyCommand(
                    `# PROMPT MESTRE DE ENGENHARIA, ARQUITETURA E DESIGN — SISTEMA URUTAU ERP\n\nVocê está atuando como Engenheiro de Software Sênior responsável pela manutenção e evolução do **Sistema Urutau ERP** (React 19 + TypeScript + Tailwind CSS v4 + Express + Persistência Aditiva JSON/SQLite/PostgreSQL).\n\n## 1. O QUE VOCÊ NÃO PODE FAZER (PROIBIÇÕES ABSOLUTAS — BLOQUEIO IMEDIATO)\n1. **PROIBIDO HARD-DELETE (Exclusão Física):** Jamais execute \`DELETE FROM\`, \`DROP\`, \`.splice()\` destrutivo sem arquivamento ou exclusão física de registros. Toda remoção no sistema DEVE ser um **Arquivamento Lógico (Soft-Delete)** setando \`arquivado_legal = true\` e registrando em \`erp_audit_logs\`.\n2. **PROIBIDO DIALOGS NATIVOS DO NAVEGADOR:** Jamais use \`window.alert()\`, \`window.confirm()\`, \`window.prompt()\` ou \`window.open()\` bloqueante. Use exclusivamente \`UrutauSystemDialog\` (\`showAlert\` / \`showConfirm\`) e \`FocusFormModal\`.\n3. **PROIBIDO APAGAR DADOS OU ARQUIVOS DO BACK-END NA VPS:** Scripts de deploy/atualização devem substituir apenas o Front-end (\`src/\`, \`dist/\`, \`index.html\`) e mesclar rotas/pacotes de forma **100% aditiva** no Back-end, preservando \`urutau_db.json\`, \`.env\` e backups em \`/root/backups-urutau\`.\n4. **PROIBIDO REDISTRIBUIR DEDUTORES INDIVIDUAIS NO RATEIO (Art. 6º):** No módulo de Rateio (1% a 30%, padrão 10%), descontos individuais (vales, quebras, faltas) são **indecomponíveis**: abatem apenas da cota líquida daquele colaborador e JAMAIS são redistribuídos aos demais.\n5. **PROIBIDO EDIÇÃO INLINE DIRETA NA TABELA DE EQUIPE (Art. 8º):** A tabela de Equipe é somente leitura; qualquer edição de colaborador, escala fixa ou vínculos N:N deve abrir o **Modal Único Centralizado**.\n6. **PROIBIDO PALETA LEGADA AZUL/LARANJA OU JARGÕES CONFUSOS:** Não volte para o antigo azul/laranja genérico e não use termos regionais obscuros (como "Tapiri", " Puxirum", " Igarapé" em rótulos técnicos) para nomear componentes de interface.\n\n## 2. O QUE VOCÊ PODE E DEVE FAZER (OBRIGAÇÕES DE ARQUITETURA)\n1. **Design "Amazônia Viva" & Harmonia com a Marca do Cliente:**\n   - Superfícies escuras: \`#05100C\` (Fundo Base), \`#071712\` (Painéis), \`#0A1F17\` (Cards), \`#113025\` (Hover).\n   - Acentos padrão: \`#10B981\` (Turquesa Primário), \`#F59E0B\` (Ouro Secundário), \`#F43F5E\` (Alerta/Crítico), \`#8B5CF6\` (Tags N:N).\n   - Respeite as variáveis CSS dinâmicas (\`--urutau-accent-hex\`, \`--urutau-accent-rgb\`) que calculam o meio-termo (70% Cor da Logo da Empresa + 30% Base Urutau).\n2. **Comunicação Visual Simbólica (Menos Texto, Mais Símbolos e Imagens SVG):**\n   - Priorize ícones, avatares (\`VisualAvatar\`), mapas visuais de mesa (\`TableVisualSVG\`), ilustrações de insumos (\`ProductVisualThumbSVG\`), medidores circulares (\`CircularGaugeSVG\`) e selos curtos (\`\`, \`\`, \` Repor\`).\n3. **Discriminação Obrigatória de Salão (Art. 9º) e Limite de Portais (Art. 10):**\n   - Em Reservas, mantenha separados: \`adultos_pagantes\`, \`adultos_frequentadores\`, \`criancas_pagantes\`, \`criancas_frequentadores\`.\n   - Em Portais Externos, limite a no máximo **2 iframes simultâneos** lado a lado via proxy.\n\n## 3. PILARES DE CONSERTO, GERAÇÃO E CONFERÊNCIA DE CÓDIGO (CHECKLIST ANTES DE ENTREGAR)\n- [ ] **Pilar 1 (Tipagem & Compilação):** \`tsc --noEmit\` e \`vite build\` passam com 0 erros? Todos os imports de \`./UrutauShared\` e \`../types/erp\` existem?\n- [ ] **Pilar 2 (Integridade de Dados):** Todas as rotas \`POST\` validam payload, gravam no banco sem apagar chaves existentes e retornam JSON estruturado?\n- [ ] **Pilar 3 (Padronização Visual):** Todos os modais usam \`FocusFormModal\`? Os números financeiros/métricas usam \`font-mono tabular-nums\`?\n- [ ] **Pilar 4 (Zero Imagens Quebradas):** Nenhum \`<img>\` aponta para URL externa inexistente; todos os elementos visuais usam SVGs vetoriais determinísticos ou \`logoDataUrl\` validado.`,
                    'master-ai-prompt'
                  )
                }
                className="px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs inline-flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto shrink-0 shadow-md"
              >
                {copiedCmdKey === 'master-ai-prompt' ? (
                  <>
                    <Check className="w-4 h-4 shrink-0" />
                    <span>Prompt Mestre Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 shrink-0" />
                    <span>Copiar Prompt Mestre Completo</span>
                  </>
                )}
              </button>
            </div>

            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-[#0B0D11] border border-rose-500/25 space-y-1">
                <div className="font-bold text-rose-400"> Parte 1 do Texto: O que o Robô NÃO Pode Fazer</div>
                <p className="text-[11px] text-slate-300 leading-snug">
                  <strong> Em resumo:</strong> Proíbe a IA de apagar cadastros antigos, proíbe travar a tela do navegador com janelinhas antigas, proíbe apagar os dados da sua VPS e proíbe bagunçar a conta das gorjetas/rateio da equipe.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-[#0B0D11] border border-[#10B981]/25 space-y-1">
                <div className="font-bold text-[#10B981]"> Parte 2 do Texto: Como Manter o Visual Bonito</div>
                <p className="text-[11px] text-slate-300 leading-snug">
                  <strong> Em resumo:</strong> Obriga a IA a usar as cores da sua empresa combinadas com o tema escuro confortável para os olhos, além de usar desenhos e símbolos fáceis em vez de textos longos e cansativos.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-[#0B0D11] border border-amber-500/25 space-y-1">
                <div className="font-bold text-amber-400"> Parte 3 do Texto: Conferência Antes de Entregar</div>
                <p className="text-[11px] text-slate-300 leading-snug">
                  <strong> Em resumo:</strong> Exige que a IA faça uma revisão completa (teste de peças, botões no celular, banco de dados e imagens) para entregar tudo funcionando de primeira, sem erros.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#05100C] border border-slate-800 font-mono text-xs text-slate-200 whitespace-pre-wrap leading-relaxed max-h-[520px] overflow-y-auto select-all">
{`# PROMPT MESTRE DE ENGENHARIA, ARQUITETURA E DESIGN — SISTEMA URUTAU ERP

Você está atuando como Engenheiro de Software Sênior responsável pela manutenção e evolução do Sistema Urutau ERP (React 19 + TypeScript + Tailwind CSS v4 + Express + Persistência Aditiva).

## 1. O QUE A IA NÃO PODE FAZER (PROIBIÇÕES ABSOLUTAS)
1. PROIBIDO HARD-DELETE (Exclusão Física): Jamais execute DELETE físico. Toda remoção DEVE ser Soft-Delete (arquivado_legal = true) com registro em erp_audit_logs.
2. PROIBIDO DIALOGS NATIVOS: Jamais use window.alert(), window.confirm() ou window.prompt(). Use exclusivamente UrutauSystemDialog (showAlert / showConfirm) e FocusFormModal.
3. PROIBIDO APAGAR BACK-END NA VPS: Atualizações atualizam o Front-end e apenas adicionam o que faltar no Back-end (mesclagem aditiva), preservando urutau_db.json e .env.
4. PROIBIDO REDISTRIBUIR DEDUTORES INDIVIDUAIS NO RATEIO: Descontos individuais no Rateio (1% a 30%) abatem apenas da cota daquele colaborador e jamais voltam para o pool dos demais.
5. PROIBIDO EDIÇÃO INLINE NA LISTAGEM DE EQUIPE: A tabela de Equipe é somente leitura; qualquer edição deve abrir o Modal Único Centralizado.
6. PROIBIDO PALETA LEGADA AZUL/LARANJA OU TEXTOS VERBOSOS: Mantenha a paleta padrão "Amazônia Viva" (#05100C, #071712, #0A1F17, #10B981, #F59E0B) e priorize símbolos e imagens SVG.

## 2. O QUE A IA PODE E DEVE FAZER (ARQUITETURA & DESIGN)
- Usar os componentes visuais padronizados de UrutauShared.tsx: VisualAvatar, TableVisualSVG, ProductVisualThumbSVG, CircularGaugeSVG, CategorySymbolSVG, TabIconSVG e FocusFormModal.
- Respeitar o cálculo de Meio-Termo de Marca (blendCompanyWithUrutau: 70% Cor da Logo da Empresa + 30% Identidade Urutau).
- Aplicar font-mono tabular-nums em todos os valores monetários (R$), percentuais, datas e contadores.

## 3. PILARES DE CONSERTO E CONFERÊNCIA DE CÓDIGO (AUDITORIA)
1. Pilar de Compilação: Zero erros em TypeScript (tsc) e bundle Vite (npm run build).
2. Pilar de Persistência Aditiva: Novas tabelas/colunas devem ter fallback seguro sem quebrar bancos existentes na VPS.
3. Pilar de Coerência Visual: Zero caixas "Frankenstein"; todas as abas seguem o mesmo cabeçalho compacto, tabelas simbólicas e modais padronizados.
4. Pilar de Segurança & RBAC: Respeitar permissões por módulo (ver, editar, escopo: todos | subordinados | pessoal) e sanitizar logs sensíveis.`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function sanitizarTextoSensivel(texto: string): string {
  if (!texto) return '—';
  return String(texto)
    .replace(/\$argon2[a-z0-9$.,=/+-]+/gi, '[CREDENTIAL_OCULTA]')
    .replace(/\b[a-f0-9]{32,128}\b/gi, '[HASH_OCULTO]')
    .replace(/(token|c[oó]digo|senha|otp|hash|secret|key)\s*[:=#]?\s*([^\s,;]+)/gi, '$1: [PROTEGIDO]')
    .replace(/\b(\+?55\s?)?(\(?\d{2}\)?\s?)?\d{4,5}[-\s]?\d{4}\b/g, '[CONTATO_PROTEGIDO]');
}

function classificarCategoriaLog(acao: string): 'login' | 'permissoes' | 'dados' | 'seguranca' {
  const a = String(acao || '').toUpperCase();
  if (a.includes('LOGIN') || a.includes('AUTH') || a.includes('SESSAO') || a.includes('DESBLOQUEIO')) {
    return 'login';
  }
  if (
    a.includes('PERMISSAO') ||
    a.includes('ACESSO') ||
    a.includes('CARGO') ||
    a.includes('COLABORADOR') ||
    a.includes('SENHA') ||
    a.includes('ESCOPO')
  ) {
    return 'permissoes';
  }
  if (a.includes('BLOQUEIO') || a.includes('LINTER') || a.includes('SEGURANCA') || a.includes('BACKUP')) {
    return 'seguranca';
  }
  return 'dados';
}

export function AuditLogsTab({
  data,
  onRefresh,
  currentUser,
  securityGeofenceConfig = DEFAULT_SECURITY_GEOFENCE_TURNO_CONFIG,
  onUpdateSecurityGeofenceConfig,
  userGpsLocation,
  onSimulateGpsPosition,
  simulatedShiftMode = 'auto',
  onChangeSimulatedShiftMode
}: CommonTabProps & {
  currentUser?: any;
  securityGeofenceConfig?: SecurityGeofenceTurnoConfig;
  onUpdateSecurityGeofenceConfig?: (cfg: SecurityGeofenceTurnoConfig) => void;
  userGpsLocation?: {
    latitude: number;
    longitude: number;
    accuracy: number;
    simulated: boolean;
    label: string;
  };
  onSimulateGpsPosition?: (insideCompany: boolean) => void;
  simulatedShiftMode?: 'auto' | 'em_turno' | 'fora_turno';
  onChangeSimulatedShiftMode?: (mode: 'auto' | 'em_turno' | 'fora_turno') => void;
}) {
  const [filtroCategoria, setFiltroCategoria] = useState<
    'todos' | 'login' | 'permissoes' | 'dados' | 'seguranca'
  >('todos');
  const [busca, setBusca] = useState<string>('');
  const [filtroUsuarioMapa, setFiltroUsuarioMapa] = useState<string>('todos');
  const [filtroTipoTelemetria, setFiltroTipoTelemetria] = useState<string>('todos');
  const [pontoSelecionadoId, setPontoSelecionadoId] = useState<number | null>(null);

  const isAdminAutorizado = useMemo(() => {
    if (!currentUser) return true;
    return isSuperAdminUser(currentUser) || isGestorEmpresaUser(currentUser);
  }, [currentUser]);

  const [restaurandoKey, setRestaurandoKey] = useState<string | null>(null);
  const handleRestaurarRegistro = async (item: any) => {
    const key = `${item.tabela}-${item.id}`;
    setRestaurandoKey(key);
    try {
      const res = await fetch('/api/erp/restaurar-arquivado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          tabelaAlvo: item.tabela,
          usuario: currentUser?.nome || 'Operador'
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || 'Erro ao desarquivar registro');
      await onRefresh();
    } catch {
    } finally {
      setRestaurandoKey(null);
    }
  };

  const logsSanitizados = useMemo(() => {
    return (data.auditLogs || []).map((log) => {
      const categoria = classificarCategoriaLog(log.acao);
      return {
        ...log,
        categoria,
        acaoLimpa: sanitizarTextoSensivel(log.acao),
        detalhesLimpos: sanitizarTextoSensivel(log.detalhes)
      };
    });
  }, [data.auditLogs]);

  const pontosGpsExtraidosDosLogs = useMemo(() => {
    const comCoord = logsSanitizados
      .filter(
        (l) =>
          typeof l.latitude === 'number' &&
          typeof l.longitude === 'number' &&
          Number.isFinite(l.latitude) &&
          Number.isFinite(l.longitude)
      )
      .filter((l) => filtroUsuarioMapa === 'todos' || l.usuario === filtroUsuarioMapa)
      .filter(
        (l) =>
          filtroTipoTelemetria === 'todos' ||
          String(l.tipo_telemetria || '') === filtroTipoTelemetria
      );
    return [...comCoord].reverse();
  }, [logsSanitizados, filtroUsuarioMapa, filtroTipoTelemetria]);

  const usuariosUnicosNosLogs = useMemo(() => {
    return Array.from(new Set(logsSanitizados.map((l) => String(l.usuario || 'Operador'))));
  }, [logsSanitizados]);

  const logsFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return logsSanitizados.filter((log) => {
      if (filtroCategoria !== 'todos' && log.categoria !== filtroCategoria) {
        return false;
      }
      if (!termo) return true;
      const alvo = `${log.usuario} ${log.cargo} ${log.acaoLimpa} ${log.detalhesLimpos}`.toLowerCase();
      return alvo.includes(termo);
    });
  }, [logsSanitizados, filtroCategoria, busca]);

  const contadores = useMemo(() => {
    return {
      total: logsSanitizados.length,
      login: logsSanitizados.filter((l) => l.categoria === 'login').length,
      permissoes: logsSanitizados.filter((l) => l.categoria === 'permissoes').length,
      dados: logsSanitizados.filter((l) => l.categoria === 'dados').length,
      seguranca: logsSanitizados.filter((l) => l.categoria === 'seguranca').length
    };
  }, [logsSanitizados]);

  if (!isAdminAutorizado) {
    return (
      <div className="bg-[#11151E] border border-rose-500/30 rounded-xl p-8 text-center max-w-xl mx-auto my-8 space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-500/15 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-100 uppercase tracking-wider">
          Acesso Restrito à Governança Administrativa
        </h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          Esta aba de Audit Logs é exclusiva para Gestores da Empresa e Administradores.
        </p>
      </div>
    );
  }

  const centerLat = securityGeofenceConfig.empresaLatitude || -1.4558;
  const centerLng = securityGeofenceConfig.empresaLongitude || -48.5039;
  const mapSpan = 0.016; 

  const projectToSvg = (lat: number, lng: number) => {
    const x = 400 + ((lng - centerLng) / mapSpan) * 720;
    const y = 210 - ((lat - centerLat) / mapSpan) * 380;
    return {
      x: Math.max(28, Math.min(772, x)),
      y: Math.max(24, Math.min(396, y))
    };
  };

  const pontoAtivoDetalhe =
    pontosGpsExtraidosDosLogs.find((p) => Number(p.id) === Number(pontoSelecionadoId)) ||
    pontosGpsExtraidosDosLogs[pontosGpsExtraidosDosLogs.length - 1] ||
    null;

  const itensArquivados = data.registrosArquivados || [];

  const [clientErrorLogs, setClientErrorLogs] = useState<UrutauClientErrorLogEntry[]>(() => {
    try {
      const raw = localStorage.getItem('urutau_error_logs_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [copiedErrorId, setCopiedErrorId] = useState<string | null>(null);

  useEffect(() => {
    const syncClientErrors = () => {
      try {
        const raw = localStorage.getItem('urutau_error_logs_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setClientErrorLogs(parsed);
        } else {
          setClientErrorLogs([]);
        }
      } catch {}
    };
    window.addEventListener('urutau:error-logged', syncClientErrors);
    return () => window.removeEventListener('urutau:error-logged', syncClientErrors);
  }, []);

  const logsDeErrosEFalhas = useMemo(() => {
    const doServidor = logsSanitizados
      .filter((log) => {
        const txt = `${log.acao || ''} ${log.detalhes || ''}`.toUpperCase();
        return (
          txt.includes('ERRO') ||
          txt.includes('FALHA') ||
          txt.includes('BLOQUEIO') ||
          txt.includes('NEGADO') ||
          txt.includes('INVALID') ||
          txt.includes('EXPIRAD') ||
          txt.includes('QUARENTENA')
        );
      })
      .map((log) => ({
        id: `srv-${log.id}`,
        origem: 'Servidor / Auditoria',
        titulo: log.acaoLimpa || log.acao || 'Alerta de Sistema',
        mensagem: log.detalhesLimpos || log.detalhes || '',
        detalhesTecnicos: log.ip ? `Operador: ${log.usuario || 'Sistema'} • IP: ${log.ip}` : `Operador: ${log.usuario || 'Sistema'}`,
        criadoEm: log.criado_em
      }));

    const doCliente = clientErrorLogs.map((err) => ({
      id: err.id,
      origem: err.origem || 'Tela do Usuário',
      titulo: err.titulo || 'Erro no Sistema',
      mensagem: err.mensagem || '',
      detalhesTecnicos: err.detalhesTecnicos || '',
      criadoEm: err.criadoEm
    }));

    return [...doCliente, ...doServidor].slice(0, 80);
  }, [logsSanitizados, clientErrorLogs]);

  const handleLimparErrosLocais = () => {
    try {
      localStorage.removeItem('urutau_error_logs_v1');
      setClientErrorLogs([]);
    } catch {}
  };

  return (
    <div className="space-y-6 w-full">
      <div data-clean-stage="0" className="space-y-4">
        <div className="bg-[#160B11] border-2 border-rose-500/50 rounded-xl p-4 sm:p-5 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rose-500/25 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 shrink-0 flex items-center justify-center">
                <SystemSlotImage
                  slot="dialogos_seguranca"
                  overrideSource="comunicacao"
                  className="w-12 h-12"
                />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-mono font-bold uppercase">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Diagnóstico Direto de Erros ({logsDeErrosEFalhas.length})</span>
                </div>
                <h2 className="text-base font-bold text-white mt-0.5">
                  1. Central de Logs de Erros e Falhas do Sistema
                </h2>
                <p className="text-xs text-slate-300">
                  Todos os erros de login, falhas de comunicação, bloqueios de permissão ou alertas técnicos aparecem reunidos aqui em ordem recente.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0">
              {clientErrorLogs.length > 0 && (
                <button
                  type="button"
                  onClick={handleLimparErrosLocais}
                  className="w-full sm:w-auto min-h-[40px] px-3 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Limpar Avisos Locais</span>
                </button>
              )}
              <button
                type="button"
                onClick={onRefresh}
                className="w-full sm:w-auto min-h-[40px] px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Atualizar Logs</span>
              </button>
            </div>
          </div>

          {logsDeErrosEFalhas.length === 0 ? (
            <div className="p-4 rounded-xl bg-[#071712] border border-[#10B981]/40 flex items-center gap-3 text-xs text-emerald-200">
              <ShieldCheck className="w-5 h-5 text-[#10B981] shrink-0" />
              <div>
                <strong className="block text-white">Nenhum erro ou falha registrado!</strong>
                O sistema está operando sem erros de login, API ou permissão no momento.
              </div>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
              {logsDeErrosEFalhas.map((err) => {
                const dtFormatada = (() => {
                  try {
                    return new Date(err.criadoEm).toLocaleString('pt-BR');
                  } catch {
                    return err.criadoEm;
                  }
                })();
                return (
                  <div
                    key={err.id}
                    className="p-3.5 rounded-xl bg-[#0B0E14] border border-rose-500/35 hover:border-rose-400/60 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 shrink-0 mt-0.5 flex items-center justify-center">
                        <SystemSlotImage
                          slot="dialogos_seguranca"
                          overrideSource="comunicacao"
                          className="w-10 h-10"
                        />
                      </div>
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-mono font-bold">
                            {err.origem}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">{dtFormatada}</span>
                        </div>
                        <div className="text-sm font-bold text-rose-200 break-words">{err.titulo}</div>
                        <div className="text-xs text-slate-200 leading-relaxed break-words">
                          {err.mensagem}
                        </div>
                        {err.detalhesTecnicos && (
                          <div className="text-[11px] font-mono text-amber-300/90 bg-black/40 px-2.5 py-1.5 rounded border border-white/10 break-all">
                            {err.detalhesTecnicos}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const txt = `[${dtFormatada}] ${err.titulo}: ${err.mensagem} ${err.detalhesTecnicos || ''}`.trim();
                        navigator.clipboard?.writeText(txt);
                        setCopiedErrorId(err.id);
                        setTimeout(() => setCopiedErrorId(null), 2000);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-mono text-slate-200 inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      {copiedErrorId === err.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#10B981]" />
                          <span>Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar Erro</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div data-clean-stage="1" className="bg-[#071712] border-2 border-[#10B981]/45 rounded-xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-white">
              2. Registros Arquivados — Desarquivar / Restaurar com 1 Clique ({itensArquivados.length})
            </h3>
            <p className="text-xs text-slate-400">
              Arquivou algum cadastro, colaborador ou item sem querer? Basta clicar em "Desarquivar e Restaurar" abaixo.
            </p>
          </div>
        </div>

        {itensArquivados.length === 0 ? (
          <div className="p-3.5 rounded-xl bg-[#05100C] border border-white/10 text-xs text-emerald-300 font-medium">
            Nenhum registro arquivado no momento. Todos os seus cadastros e usuários estão ativos e visíveis.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {itensArquivados.map((item: any) => {
              const key = `${item.tabela}-${item.id}`;
              return (
                <div
                  key={key}
                  className="p-3.5 rounded-xl bg-[#05100C] border border-rose-500/40 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-mono font-bold">
                        {item.rotuloTabela || item.tabela}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">ID #{item.id}</span>
                    </div>
                    <div className="text-sm font-bold text-white">{item.nome}</div>
                    {item.detalhe && <div className="text-xs text-slate-400">{item.detalhe}</div>}
                    {item.whatsapp && (
                      <div className="text-[11px] font-mono text-[#10B981]">{item.whatsapp}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={restaurandoKey === key}
                    onClick={() => handleRestaurarRegistro(item)}
                    className="w-full py-2 px-3 rounded-lg bg-[#10B981] hover:bg-[#34D399] text-[#05100C] text-xs font-black cursor-pointer disabled:opacity-50"
                  >
                    {restaurandoKey === key ? 'Restaurando...' : 'Desarquivar e Restaurar Agora'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div data-clean-stage="2" className="space-y-5">
      {isAdminAutorizado && <ZeroTrustGovernancePanel currentUser={currentUser} />}
      <div className="bg-[#11151E] border border-[#10B981]/35 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#10B981]" />
            <div>
              <h3 className="text-sm font-bold text-white">
                Mapa de Localizações Traçadas do Usuário (Extraídas dos Logs de Cliques, Execuções e Menus)
              </h3>
              <p className="text-[11px] text-slate-400">
                Círculo Verde = Perímetro Autorizado da Empresa ({securityGeofenceConfig.raioPermitidoMetros}m) • Linha Tracejada = Deslocamento Cronológico (1 → {pontosGpsExtraidosDosLogs.length})
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filtroUsuarioMapa}
              onChange={(e) => setFiltroUsuarioMapa(e.target.value)}
              className="px-2.5 py-1.5 bg-[#0B0D11] border border-slate-800 rounded-lg text-xs text-slate-100"
            >
              <option value="todos"> Todos os Operadores ({usuariosUnicosNosLogs.length})</option>
              {usuariosUnicosNosLogs.map((u) => (
                <option key={u} value={u}>
                   {u}
                </option>
              ))}
            </select>

            <select
              value={filtroTipoTelemetria}
              onChange={(e) => setFiltroTipoTelemetria(e.target.value)}
              className="px-2.5 py-1.5 bg-[#0B0D11] border border-slate-800 rounded-lg text-xs text-slate-100"
            >
              <option value="todos"> Todos os Eventos ({pontosGpsExtraidosDosLogs.length})</option>
              <option value="ABERTURA_MENU"> Abertura de Menus</option>
              <option value="CLIQUE_BOTAO"> Cliques de Botão</option>
              <option value="EXECUCAO_SISTEMA"> Execuções & Salvamentos</option>
              <option value="BLOQUEIO_GEOFENCE_TURNO"> Tentativas Fora da Empresa / Turno</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          
          <div className="lg:col-span-8 rounded-xl overflow-hidden border border-slate-800 bg-[#06110D] relative">
            <svg viewBox="0 0 800 420" className="w-full h-[340px] sm:h-[380px] block">
              <defs>
                <pattern id="gpsGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path
                    d="M 40 0 L 0 0 0 40"
                    fill="none"
                    stroke="rgba(16, 185, 129, 0.09)"
                    strokeWidth="1"
                  />
                </pattern>
                <radialGradient id="geofenceFill" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(16, 185, 129, 0.28)" />
                  <stop offset="100%" stopColor="rgba(16, 185, 129, 0.04)" />
                </radialGradient>
              </defs>

              <rect width="800" height="420" fill="url(#gpsGrid)" />

              
              <line x1="0" y1="210" x2="800" y2="210" stroke="rgba(148, 163, 184, 0.14)" strokeDasharray="4 4" />
              <line x1="400" y1="0" x2="400" y2="420" stroke="rgba(148, 163, 184, 0.14)" strokeDasharray="4 4" />

              
              <circle
                cx="400"
                cy="210"
                r="82"
                fill="url(#geofenceFill)"
                stroke="#10B981"
                strokeWidth="2"
                strokeDasharray="6 4"
              />
              <circle cx="400" cy="210" r="6" fill="#10B981" />
              <text
                x="400"
                y="118"
                textAnchor="middle"
                fill="#10B981"
                fontSize="11"
                fontFamily="monospace"
                fontWeight="bold"
              >
                SEDE DA EMPRESA (RAIO {securityGeofenceConfig.raioPermitidoMetros}m)
              </text>

              
              {pontosGpsExtraidosDosLogs.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="2.5"
                  strokeDasharray="5 4"
                  points={pontosGpsExtraidosDosLogs
                    .map((pt) => {
                      const pos = projectToSvg(pt.latitude, pt.longitude);
                      return `${pos.x},${pos.y}`;
                    })
                    .join(' ')}
                />
              )}

              
              {pontosGpsExtraidosDosLogs.map((pt, idx) => {
                const pos = projectToSvg(pt.latitude, pt.longitude);
                const inside = pt.dentro_empresa !== false;
                const isSelected =
                  pontoAtivoDetalhe && Number(pontoAtivoDetalhe.id) === Number(pt.id);
                const color = !inside
                  ? '#F43F5E'
                  : pt.tipo_telemetria === 'EXECUCAO_SISTEMA'
                  ? '#F59E0B'
                  : pt.tipo_telemetria === 'ABERTURA_MENU'
                  ? '#38BDF8'
                  : '#10B981';

                return (
                  <g
                    key={pt.id}
                    onClick={() => setPontoSelecionadoId(pt.id)}
                    className="cursor-pointer"
                  >
                    {isSelected && (
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r="16"
                        fill="none"
                        stroke="#FFFFFF"
                        strokeWidth="2"
                      />
                    )}
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r="11"
                      fill={color}
                      stroke="#05100C"
                      strokeWidth="2"
                    />
                    <text
                      x={pos.x}
                      y={pos.y + 3.5}
                      textAnchor="middle"
                      fill="#05100C"
                      fontSize="9.5"
                      fontWeight="900"
                      fontFamily="monospace"
                    >
                      {idx + 1}
                    </text>
                  </g>
                );
              })}
            </svg>

            <div className="px-3 py-2 bg-[#05100C]/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[#10B981]">● Clique / Na Empresa</span>
                <span className="text-sky-400">● Abertura de Menu</span>
                <span className="text-amber-400">● Execução de Sistema</span>
                <span className="text-rose-400">● Fora da Empresa / Bloqueado</span>
              </div>
              <span className="text-slate-400">
                 Centro: {centerLat.toFixed(4)}, {centerLng.toFixed(4)}
              </span>
            </div>
          </div>

          
          <div className="lg:col-span-4 bg-[#0B0D11] border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Inspeção do Ponto na Trilha GPS
              </div>

              {pontoAtivoDetalhe ? (
                <div className="p-3 rounded-xl bg-[#11151E] border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-[#10B981]">
                      Log #{pontoAtivoDetalhe.id}
                    </span>
                    <span
                      className={`font-mono text-[11px] ${
                        pontoAtivoDetalhe.dentro_empresa !== false
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {pontoAtivoDetalhe.dentro_empresa !== false
                        ? ` Na Empresa (${pontoAtivoDetalhe.distancia_empresa_m ?? 0}m)`
                        : ` Fora (${pontoAtivoDetalhe.distancia_empresa_m ?? 890}m)`}
                    </span>
                  </div>
                  <div className="font-bold text-slate-100">{pontoAtivoDetalhe.usuario}</div>
                  <div className="text-[11px] text-amber-300 font-mono">
                    {pontoAtivoDetalhe.acaoLimpa}
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {pontoAtivoDetalhe.detalhesLimpos}
                  </p>
                  <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-1 text-[10px] font-mono text-slate-400">
                    <span>Lat: {Number(pontoAtivoDetalhe.latitude).toFixed(5)}</span>
                    <span>Lng: {Number(pontoAtivoDetalhe.longitude).toFixed(5)}</span>
                    <span>Menu: {pontoAtivoDetalhe.aba || 'geral'}</span>
                    <span>Turno: {pontoAtivoDetalhe.em_turno !== false ? 'Ativo' : 'Fora'}</span>
                  </div>
                </div>
              ) : (
                <div className="p-4 text-xs text-slate-500 text-center">
                  Clique em qualquer ponto numerado no mapa para inspecionar o evento.
                </div>
              )}

              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {pontosGpsExtraidosDosLogs.map((pt, idx) => (
                  <button
                    key={pt.id}
                    type="button"
                    onClick={() => setPontoSelecionadoId(pt.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-[11px] flex items-center justify-between gap-2 cursor-pointer ${
                      Number(pontoAtivoDetalhe?.id) === Number(pt.id)
                        ? 'bg-[#10B981]/15 border-[#10B981] text-white'
                        : 'bg-[#11151E] border-slate-800/80 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span className="truncate">
                      <strong className="font-mono text-amber-400 mr-1.5">{idx + 1}.</strong>
                      {pt.acaoLimpa}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400 shrink-0">
                      {pt.distancia_empresa_m ?? 0}m
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => setFiltroCategoria('todos')}
          className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
            filtroCategoria === 'todos'
              ? 'bg-amber-500/15 border-amber-500 text-slate-100'
              : 'bg-[#11151E] border-slate-800 text-slate-300 hover:border-slate-700'
          }`}
        >
          <div className="text-[11px] text-slate-400">Total de Eventos</div>
          <div className="text-lg font-mono font-bold text-amber-400 mt-0.5">{contadores.total}</div>
        </button>

        <button
          type="button"
          onClick={() => setFiltroCategoria('login')}
          className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
            filtroCategoria === 'login'
              ? 'bg-emerald-500/15 border-emerald-500 text-slate-100'
              : 'bg-[#11151E] border-slate-800 text-slate-300 hover:border-slate-700'
          }`}
        >
          <div className="text-[11px] text-slate-400">Acessos & Logins</div>
          <div className="text-lg font-mono font-bold text-emerald-400 mt-0.5">{contadores.login}</div>
        </button>

        <button
          type="button"
          onClick={() => setFiltroCategoria('permissoes')}
          className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
            filtroCategoria === 'permissoes'
              ? 'bg-purple-500/15 border-purple-500 text-slate-100'
              : 'bg-[#11151E] border-slate-800 text-slate-300 hover:border-slate-700'
          }`}
        >
          <div className="text-[11px] text-slate-400">Cargos & Permissões</div>
          <div className="text-lg font-mono font-bold text-purple-400 mt-0.5">
            {contadores.permissoes}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setFiltroCategoria('dados')}
          className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
            filtroCategoria === 'dados'
              ? 'bg-cyan-500/15 border-cyan-500 text-slate-100'
              : 'bg-[#11151E] border-slate-800 text-slate-300 hover:border-slate-700'
          }`}
        >
          <div className="text-[11px] text-slate-400">Cliques, Menus & Dados</div>
          <div className="text-lg font-mono font-bold text-cyan-400 mt-0.5">{contadores.dados}</div>
        </button>

        <button
          type="button"
          onClick={() => setFiltroCategoria('seguranca')}
          className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer col-span-2 sm:col-span-1 ${
            filtroCategoria === 'seguranca'
              ? 'bg-rose-500/15 border-rose-500 text-slate-100'
              : 'bg-[#11151E] border-slate-800 text-slate-300 hover:border-slate-700'
          }`}
        >
          <div className="text-[11px] text-slate-400">Proteção & Perímetro</div>
          <div className="text-lg font-mono font-bold text-rose-400 mt-0.5">
            {contadores.seguranca}
          </div>
        </button>
      </div>

      
      <div className="bg-[#11151E] border border-slate-800/90 rounded-lg p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'login', label: 'Logins & Sessão' },
            { id: 'permissoes', label: 'Mudanças de Permissão' },
            { id: 'dados', label: 'Cliques, Menus & Execuções' },
            { id: 'seguranca', label: 'Segurança & Perímetro' }
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setFiltroCategoria(cat.id as any)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer min-h-[36px] ${
                filtroCategoria === cat.id
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-[#0B0D11] text-slate-300 border border-slate-800 hover:border-slate-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-72">
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Filtrar por colaborador, ação ou coordenada..."
            className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 min-h-[40px]"
          />
        </div>
      </div>

      
      <div className="bg-[#11151E] border border-slate-800/90 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-[#0D1017] text-[11px] font-mono uppercase text-slate-400">
                <th className="py-3 px-4 w-44">Data / Hora</th>
                <th className="py-3 px-4 w-44">Operador / Perfil</th>
                <th className="py-3 px-4 w-44">Categoria & Ação</th>
                <th className="py-3 px-4 w-48">Coordenada GPS / Perímetro</th>
                <th className="py-3 px-4">Descrição Auditada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {logsFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 font-sans">
                    Nenhum registro de auditoria encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                logsFiltrados.map((log) => {
                  const dataFormatada = (() => {
                    try {
                      return new Date(log.criado_em).toLocaleString('pt-BR');
                    } catch {
                      return log.criado_em;
                    }
                  })();

                  return (
                    <tr
                      key={log.id}
                      onClick={() => {
                        if (typeof log.latitude === 'number') setPontoSelecionadoId(log.id);
                      }}
                      className="hover:bg-slate-800/30 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                        <span className="text-amber-400/80 mr-1.5">#{log.id}</span>
                        {dataFormatada}
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <div className="font-semibold text-slate-100">{log.usuario || 'Sistema'}</div>
                        <div className="text-[10px] font-mono text-slate-400 uppercase">
                          {log.cargo || 'OPERADOR'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-amber-300 font-semibold">
                        {log.acaoLimpa}
                      </td>
                      <td className="py-3 px-4 text-[11px]">
                        {typeof log.latitude === 'number' && typeof log.longitude === 'number' ? (
                          <div className="space-y-0.5">
                            <div className="text-slate-200">
                              {Number(log.latitude).toFixed(4)}, {Number(log.longitude).toFixed(4)}
                            </div>
                            <div
                              className={
                                log.dentro_empresa !== false ? 'text-emerald-400' : 'text-rose-400'
                              }
                            >
                              {log.dentro_empresa !== false
                                ? `Na Empresa (${log.distancia_empresa_m ?? 0}m)`
                                : `Fora (${log.distancia_empresa_m ?? 890}m)`}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500">Servidor Interno</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-200 font-sans leading-relaxed">
                        {log.detalhesLimpos}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </div>
  );
}

export function CadastrosPessoasTab(props: CommonTabProps) {
  const { data, onRefresh, showAlert, showConfirm, currentUser, onSwitchCurrentUser } = props;
  const [subHub, setSubHub] = useState<'unificado' | 'empresas' | 'freelancers' | 'equipe' | 'arquivados'>('unificado');
  const [filtroPapel, setFiltroPapel] = useState<'todos' | PapelCadastro | 'comunidade_wpp' | 'bloqueados'>('todos');
  const [filtroNatureza, setFiltroNatureza] = useState<'todos' | NaturezaCadastro>('todos');
  const [busca, setBusca] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [ultimoArquivadoUndo, setUltimoArquivadoUndo] = useState<{
    id: number;
    tabela: string;
    nome: string;
  } | null>(null);

  const [form, setForm] = useState<{
    id: number | null;
    usuario_sistema_id?: number | null;
    nome_original?: string;
    nome: string;
    natureza: NaturezaCadastro;
    tipo_pessoa: 'PF' | 'PJ';
    documento: string;
    whatsapp: string;
    email: string;
    papeis: PapelCadastro[];
    empresa_id: number;
    gestor_id: number | null;
    valor_diaria: number;
    cidade: string;
    cargo_ou_ramo: string;
    observacoes: string;
    senha_acesso: string;
    setoresIds: number[];
    unidadesIds: number[];
  }>({
    id: null,
    usuario_sistema_id: null,
    nome_original: '',
    nome: '',
    natureza: 'PF',
    tipo_pessoa: 'PF',
    documento: '',
    whatsapp: '',
    email: '',
    papeis: ['cliente'],
    empresa_id: Number(data.empresaAtivaId || data.empresas?.[0]?.id || 0),
    gestor_id: null,
    valor_diaria: 160,
    cidade: 'Belém - PA',
    cargo_ou_ramo: '',
    observacoes: '',
    senha_acesso: '',
    setoresIds: [Number(data.setores?.[0]?.id || 1)],
    unidadesIds: [Number(data.unidades?.[0]?.id || 1)]
  });
  const [criandoSetorCadastro, setCriandoSetorCadastro] = useState(false);
  const [novoSetorCadastroNome, setNovoSetorCadastroNome] = useState('');
  const [novoSetorCadastroPeso, setNovoSetorCadastroPeso] = useState('1.0');
  const [salvandoSetorCadastro, setSalvandoSetorCadastro] = useState(false);

  const [criandoEmpresaCadastro, setCriandoEmpresaCadastro] = useState(false);
  const [novaEmpresaCadastroNome, setNovaEmpresaCadastroNome] = useState('');
  const [salvandoEmpresaCadastro, setSalvandoEmpresaCadastro] = useState(false);

  const handleCriarSetorInlineCadastro = async () => {
    const nome = novoSetorCadastroNome.trim();
    if (!nome) {
      showAlert('Nome do Setor', 'Informe o nome do novo setor para vinculá-lo a este colaborador.');
      return;
    }
    setSalvandoSetorCadastro(true);
    try {
      const res = await fetch('/api/setores/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          peso_gorjeta: Number(novoSetorCadastroPeso) || 1.0,
          usuario_logado_id: currentUser?.id
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || 'Erro ao criar setor');
      await onRefresh();
      const novoId = Number(json.id);
      setForm((prev) => ({
        ...prev,
        setoresIds: prev.setoresIds.includes(novoId) ? prev.setoresIds : [...prev.setoresIds, novoId]
      }));
      setNovoSetorCadastroNome('');
      setNovoSetorCadastroPeso('1.0');
      setCriandoSetorCadastro(false);
    } catch (e: any) {
      showAlert('Erro ao Criar Setor', e.message);
    } finally {
      setSalvandoSetorCadastro(false);
    }
  };

  const handleCriarEmpresaInlineCadastro = async () => {
    const nome = novaEmpresaCadastroNome.trim();
    if (!nome) {
      showAlert('Nome da Empresa / Unidade', 'Informe o nome da nova empresa ou unidade.');
      return;
    }
    setSalvandoEmpresaCadastro(true);
    try {
      const res = await fetch('/api/empresas/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          cnpj: '',
          segmento: 'Gastronomia & Hospitalidade',
          cidade: form.cidade || 'Belém - PA',
          usuario_logado_id: currentUser?.id
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || 'Erro ao criar empresa');
      await onRefresh();
      const novoId = Number(json.id || json.empresa?.id);
      if (novoId) {
        setForm((prev) => ({
          ...prev,
          empresa_id: novoId
        }));
      }
      setNovaEmpresaCadastroNome('');
      setCriandoEmpresaCadastro(false);
    } catch (e: any) {
      showAlert('Erro ao Criar Empresa', e.message);
    } finally {
      setSalvandoEmpresaCadastro(false);
    }
  };

  const possuiAcessoSistemaEComunidadeWpp = (papeis: string[] = []) => {
    return papeis.some((p) =>
      ['colaborador', 'colaborador_efetivo', 'colaborador_free', 'gestor_conta'].includes(p)
    );
  };

  const todosCadastrosConsolidados = useMemo(() => {
    const usuariosLista = data.usuarios || [];
    const nomesJaListados = new Set<string>();
    const usuariosIdsJaListados = new Set<number>();
    const telefonesColaboradoresJaListados = new Set<string>();
    const base: any[] = [];

    (data.cadastrosPessoas || []).forEach((rawC: any) => {
      const c = { ...rawC };
      if (String(c.whatsapp || '').includes('@')) {
        c.whatsapp = '';
      }
      if (c.natureza === 'EMPRESA') {
        return;
      }
      const cNome = String(c.nome || '').trim().toLowerCase();
      const cTel8 = String(c.whatsapp || '').replace(/\D/g, '').slice(-8);

      if (!c.usuario_sistema_id) {
        const uMatch = usuariosLista.find((u: any) => {
          if (String(u.nome || '').trim().toLowerCase() === cNome) return true;
          const uTel8 = String(u.telefone || '').replace(/\D/g, '').slice(-8);
          return cTel8.length >= 8 && uTel8 === cTel8;
        });
        if (uMatch) {
          c.usuario_sistema_id = Number(uMatch.id);
        }
      }

      if (c.usuario_sistema_id) {
        const uid = Number(c.usuario_sistema_id);
        if (usuariosIdsJaListados.has(uid)) {
          return;
        }
        usuariosIdsJaListados.add(uid);
        if (uid === 1) {
          const papeisAtuais: string[] = Array.isArray(c.papeis) ? c.papeis : [];
          if (!papeisAtuais.includes('gestor_conta')) {
            c.papeis = ['gestor_conta', ...papeisAtuais];
          }
        }
      }

      if (cNome) nomesJaListados.add(cNome);
      if (cTel8.length >= 8 && possuiAcessoSistemaEComunidadeWpp(c.papeis)) {
        telefonesColaboradoresJaListados.add(cTel8);
      }
      base.push(c);
    });

    usuariosLista.forEach((u: any) => {
      if (!isSuperAdminUser(currentUser) && isSuperAdminUser(u)) return;
      const empAtiva = Number(data.empresaAtivaId || 0);
      const empIds = Array.isArray(u.empresas_ids) ? u.empresas_ids.map(Number).filter((n: number) => n > 0) : [];
      if (!isSuperAdminUser(currentUser) && empAtiva > 0 && empIds.length > 0 && !empIds.includes(empAtiva)) return;

      const uid = Number(u.id);
      const chave = String(u.nome || '').trim().toLowerCase();
      const rawTel = String(u.telefone || '').includes('@') ? '' : String(u.telefone || '');
      const uTel8 = rawTel.replace(/\D/g, '').slice(-8);
      if (
        !chave ||
        usuariosIdsJaListados.has(uid) ||
        nomesJaListados.has(chave) ||
        (uTel8.length >= 8 && telefonesColaboradoresJaListados.has(uTel8))
      ) {
        return;
      }
      usuariosIdsJaListados.add(uid);
      nomesJaListados.add(chave);
      if (uTel8.length >= 8) telefonesColaboradoresJaListados.add(uTel8);
      const isGestor = isGestorEmpresaUser(u) || isSuperAdminUser(u);
      base.push({
        id: 100000 + uid,
        usuario_sistema_id: u.id,
        nome: u.nome,
        tipo_pessoa: 'PF',
        natureza: 'PF',
        documento: '',
        whatsapp: rawTel,
        email: u.email || '',
        papeis: isGestor ? ['gestor_conta', 'colaborador_efetivo'] : ['colaborador_efetivo'],
        empresa_id: Number(empIds[0] || 0),
        gestor_id: u.gestor_id ?? null,
        cidade: 'Belém - PA',
        cargo_ou_ramo: `${u.cargo || 'Operacional'} (${u.tipo || 'Colaborador'})`,
        comunidade_wpp_autorizada: true,
        interacao_sistema_bloqueada: false,
        observacoes: 'Sincronizado da Equipe do Sistema',
        arquivado_legal: false,
        criado_em: getTodayISO()
      });
    });

    (data.freelancers || []).forEach((f: any) => {
      const chave = String(f.nome || '').trim().toLowerCase();
      if (!chave || nomesJaListados.has(chave)) return;
      nomesJaListados.add(chave);
      const rawWpp = String(f.whatsapp || '').includes('@') ? '' : String(f.whatsapp || '');
      const empAut = Array.isArray(f.empresas_autorizadas) && f.empresas_autorizadas.length > 0
        ? Number(f.empresas_autorizadas[0])
        : 0;
      base.push({
        id: 200000 + Number(f.id),
        nome: f.nome,
        tipo_pessoa: 'PF',
        natureza: 'FREELANCER',
        documento: '',
        whatsapp: rawWpp,
        email: '',
        papeis: ['colaborador_free'],
        empresa_id: empAut,
        valor_diaria: Number(f.valor_diaria || 150),
        cidade: f.cidade || 'Belém - PA',
        cargo_ou_ramo: f.funcao || 'Freelancer',
        comunidade_wpp_autorizada: true,
        interacao_sistema_bloqueada: false,
        observacoes: `Diária R$ ${Number(f.valor_diaria || 150).toFixed(2)} • Match Ativo`,
        arquivado_legal: false,
        criado_em: getTodayISO()
      });
    });

    (data.empresas || []).forEach((emp: any) => {
      const chave = String(emp.nome || '').trim().toLowerCase();
      if (!chave || nomesJaListados.has(chave)) return;
      nomesJaListados.add(chave);
      const rawWppEmp = String(emp.waha_numero || '').includes('@') ? '' : String(emp.waha_numero || '');
      base.push({
        id: 300000 + Number(emp.id),
        nome: emp.nome,
        tipo_pessoa: 'PJ',
        natureza: 'EMPRESA',
        documento: emp.cnpj || '',
        whatsapp: rawWppEmp,
        email: '',
        papeis: ['gestor_conta'],
        empresa_id: emp.id,
        valor_diaria: Number(emp.diaria_teto || 220),
        cidade: emp.cidade || 'Belém - PA',
        cargo_ou_ramo: emp.ramo || 'Gastronomia',
        comunidade_wpp_autorizada: true,
        interacao_sistema_bloqueada: false,
        observacoes: `Sessão WhatsApp: ${emp.waha_session_id || 'N/A'} (${emp.waha_status || 'Ativo'})`,
        arquivado_legal: false,
        criado_em: getTodayISO()
      });
    });

    return base;
  }, [data.cadastrosPessoas, data.usuarios, data.freelancers, data.empresas, currentUser, data.empresaAtivaId]);

  const listaCadastros = useMemo(() => {
    const empAtiva = data.empresaAtivaId ? Number(data.empresaAtivaId) : null;
    return todosCadastrosConsolidados.filter((c: any) => {
      if (
        empAtiva &&
        c.empresa_id &&
        Number(c.empresa_id) > 0 &&
        Number(c.empresa_id) !== empAtiva &&
        c.natureza !== 'EMPRESA'
      ) {
        return false;
      }
      const papeis: string[] = Array.isArray(c.papeis) ? c.papeis : [];
      const autorizadoWpp = possuiAcessoSistemaEComunidadeWpp(papeis);
      const nat: NaturezaCadastro =
        c.natureza || (c.tipo_pessoa === 'PJ' ? 'PJ' : 'PF');

      if (filtroPapel === 'comunidade_wpp' && !autorizadoWpp) return false;
      if (filtroPapel === 'bloqueados' && autorizadoWpp) return false;
      if (
        filtroPapel !== 'todos' &&
        filtroPapel !== 'comunidade_wpp' &&
        filtroPapel !== 'bloqueados'
      ) {
        if (filtroPapel === 'colaborador_efetivo') {
          if (!papeis.includes('colaborador_efetivo') && !papeis.includes('colaborador')) {
            return false;
          }
        } else if (!papeis.includes(filtroPapel)) {
          return false;
        }
      }

      if (filtroNatureza !== 'todos' && nat !== filtroNatureza) {
        return false;
      }

      if (busca.trim()) {
        const q = busca.toLowerCase();
        const alvo = `${c.nome || ''} ${c.documento || ''} ${c.whatsapp || ''} ${c.cargo_ou_ramo || ''}`.toLowerCase();
        if (!alvo.includes(q)) return false;
      }
      return true;
    });
  }, [todosCadastrosConsolidados, data.empresaAtivaId, filtroPapel, filtroNatureza, busca]);

  const contadores = useMemo(() => {
    const base = todosCadastrosConsolidados;
    return {
      total: base.length,
      clientes: base.filter((c: any) => c.papeis?.includes('cliente')).length,
      fornecedores: base.filter((c: any) => c.papeis?.includes('fornecedor')).length,
      efetivos: base.filter(
        (c: any) =>
          c.papeis?.includes('colaborador_efetivo') || c.papeis?.includes('colaborador')
      ).length,
      free: base.filter((c: any) => c.papeis?.includes('colaborador_free')).length,
      gestores: base.filter((c: any) => c.papeis?.includes('gestor_conta')).length,
      comunidadeWpp: base.filter((c: any) => possuiAcessoSistemaEComunidadeWpp(c.papeis)).length,
      proibidosSistema: base.filter((c: any) => !possuiAcessoSistemaEComunidadeWpp(c.papeis)).length
    };
  }, [todosCadastrosConsolidados]);

  const togglePapel = (papel: PapelCadastro) => {
    setForm((prev) => {
      const jaTem = prev.papeis.includes(papel);
      if (jaTem && prev.papeis.length === 1) return prev;
      const novos = jaTem ? prev.papeis.filter((p) => p !== papel) : [...prev.papeis, papel];
      return { ...prev, papeis: novos };
    });
  };

  const handleOpenNew = (
    papelInicial: PapelCadastro = 'cliente',
    naturezaInicial: NaturezaCadastro = 'PF'
  ) => {
    const tipoPessoa = naturezaInicial === 'PJ' || naturezaInicial === 'EMPRESA' ? 'PJ' : 'PF';
    const isFree = naturezaInicial === 'FREELANCER' || papelInicial === 'colaborador_free';
    setForm({
      id: null,
      usuario_sistema_id: null,
      nome_original: '',
      nome: '',
      natureza: naturezaInicial,
      tipo_pessoa: tipoPessoa,
      documento: '',
      whatsapp: '',
      email: '',
      papeis: [papelInicial],
      empresa_id: isFree ? 0 : Number(data.empresaAtivaId || data.empresas?.[0]?.id || 0),
      gestor_id: null,
      valor_diaria: 160,
      cidade: 'Belém - PA',
      cargo_ou_ramo: '',
      observacoes: '',
      senha_acesso: '',
      setoresIds: [Number(data.setores?.[0]?.id || 1)],
      unidadesIds: [Number(data.unidades?.[0]?.id || 1)]
    });
    setCriandoSetorCadastro(false);
    setCriandoEmpresaCadastro(false);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim() || form.nome.trim() === '#') {
      showAlert(
        'Campo Obrigatório',
        'Informe o Nome Completo (PF/Free) ou Razão Social / Nome Fantasia (PJ/Empresa).'
      );
      return;
    }
    try {
      const wppInfo = resolverWhatsappInteligente(form.whatsapp, data, currentUser);
      const autorizadoWpp = possuiAcessoSistemaEComunidadeWpp(form.papeis);
      const res = await fetch('/api/cadastros/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          id: form.id && form.id < 100000 ? form.id : null,
          id_original: form.id,
          usuario_sistema_id: form.usuario_sistema_id || null,
          nome_original: form.nome_original || '',
          whatsapp: wppInfo.numeroCompleto || form.whatsapp,
          comunidade_wpp_autorizada: autorizadoWpp,
          interacao_sistema_bloqueada: !autorizadoWpp,
          usuario_logado_id: currentUser?.id
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || 'Erro ao salvar cadastro unificado.');
      if (
        json.usuario_atualizado &&
        currentUser &&
        Number(json.usuario_atualizado.id) === Number(currentUser.id) &&
        onSwitchCurrentUser
      ) {
        onSwitchCurrentUser(json.usuario_atualizado);
      }
      setModalOpen(false);
      await onRefresh();
    } catch (e: any) {
      showAlert('Erro em Cadastros Unificados', e.message);
    }
  };

  const handleArchive = async (id: number) => {
    try {
      const res = await fetch('/api/cadastros/arquivar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          usuario: currentUser?.nome || 'Operador',
          usuario_logado_id: currentUser?.id
        })
      });
      const json = await res.json();
      if (!res.ok) {
        showAlert('Proteção Contra Arquivamento', json.erro || 'Não foi possível arquivar este registro.');
        return;
      }
      setUltimoArquivadoUndo({
        id: Number(json.id || id),
        tabela: String(json.tabela || 'cadastros_pessoas'),
        nome: String(json.nome || form.nome || `#${id}`)
      });
      setModalOpen(false);
      await onRefresh();
    } catch (e: any) {
      showAlert('Erro ao Arquivar', e.message);
    }
  };

  const handleRestaurarArquivado = async (id: number, tabela: string, nome?: string) => {
    try {
      const res = await fetch('/api/erp/restaurar-arquivado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          tabelaAlvo: tabela,
          usuario: currentUser?.nome || 'Operador'
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || 'Falha ao desarquivar');
      if (ultimoArquivadoUndo && Number(ultimoArquivadoUndo.id) === Number(id)) {
        setUltimoArquivadoUndo(null);
      }
      await onRefresh();
      showAlert(
        'Cadastro Desarquivado',
        `O registro "${nome || json.nome || `#${id}`}" foi restaurado e já está ativo novamente.`
      );
    } catch (e: any) {
      showAlert('Erro ao Desarquivar', e.message);
    }
  };

  const encontrarUsuarioSistema = (item: any) => {
    const usuarios = data.usuarios || [];
    if (item.usuario_sistema_id) {
      const byId = usuarios.find((u: any) => Number(u.id) === Number(item.usuario_sistema_id));
      if (byId) return byId;
    }
    const nomeAlvo = String(item.nome || '').trim().toLowerCase();
    const telAlvo = String(item.whatsapp || '').replace(/\D/g, '').slice(-8);
    return usuarios.find((u: any) => {
      const matchNome = String(u.nome || '').trim().toLowerCase() === nomeAlvo;
      const matchTel =
        telAlvo.length >= 8 && String(u.telefone || '').replace(/\D/g, '').endsWith(telAlvo);
      return matchNome || matchTel;
    });
  };

  const infoWppModal = resolverWhatsappInteligente(form.whatsapp, data, currentUser);
  const modalAutorizadoComunidade = possuiAcessoSistemaEComunidadeWpp(form.papeis);
  const gestoresLista = (data.usuarios || []).filter((u: any) => {
    const ehMaster =
      isSuperAdminUser(u) ||
      Number(u.id) === 1 ||
      String(u.nome || '').toLowerCase().trim() === 'admin master';
    if (ehMaster && !isSuperAdminUser(currentUser)) return false;
    const mesmoId =
      (form.id && Number(u.id) === Number(form.id)) ||
      (form.id && form.id >= 100000 && Number(u.id) === Number(form.id) - 100000);
    const mesmoNome =
      form.nome.trim().length > 0 &&
      String(u.nome || '').toLowerCase().trim() === form.nome.toLowerCase().trim();
    const telForm = String(form.whatsapp || '').replace(/\D/g, '').slice(-8);
    const telUser = String(u.telefone || '').replace(/\D/g, '').slice(-8);
    const mesmoTel = telForm.length >= 8 && telForm === telUser;
    if (mesmoId || mesmoNome || mesmoTel) return false;
    return isSuperAdminUser(u) || isGestorEmpresaUser(u);
  });

  const ehMeuProprioCadastroModal = useMemo(() => {
    if (!currentUser) return false;
    if (form.usuario_sistema_id && Number(form.usuario_sistema_id) === Number(currentUser.id)) return true;
    const nomeForm = String(form.nome || '').toLowerCase().trim();
    const nomeUser = String(currentUser.nome || '').toLowerCase().trim();
    if (nomeForm === 'admin master') return true;
    if (nomeForm && nomeForm === nomeUser) return true;
    if (form.id && form.id >= 100000 && Number(form.id) - 100000 === Number(currentUser.id)) return true;
    return false;
  }, [form.id, form.usuario_sistema_id, form.nome, currentUser]);

  const listaArquivados = data.registrosArquivados || [];

  return (
    <div className="space-y-5 w-full">
      {ultimoArquivadoUndo && (
        <div className="p-4 rounded-xl bg-amber-500/20 border-2 border-amber-400 flex flex-wrap items-center justify-between gap-3 shadow-lg">
          <div className="text-xs text-amber-100">
            <strong>Você acabou de arquivar "{ultimoArquivadoUndo.nome}".</strong> Arquivou sem querer?
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                handleRestaurarArquivado(
                  ultimoArquivadoUndo.id,
                  ultimoArquivadoUndo.tabela,
                  ultimoArquivadoUndo.nome
                )
              }
              className="px-3.5 py-2 rounded-xl bg-[#10B981] hover:bg-[#34D399] text-[#05100C] text-xs font-black cursor-pointer"
            >
              Desfazer e Restaurar Agora
            </button>
            <button
              type="button"
              onClick={() => setUltimoArquivadoUndo(null)}
              className="px-2.5 py-2 rounded-xl bg-black/40 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              Fechar Aviso
            </button>
          </div>
        </div>
      )}
      
      <div className="bg-[#071712] border border-[#10B981]/30 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#10B981]/15 border border-[#10B981]/40 flex items-center justify-center text-[#10B981] shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-white truncate">
              Cadastros Unificados (PF/PJ • Empresa • Freelancer • Autônomo Independente)
            </h2>
            <p className="text-xs text-slate-400">
              Suporta cadastros com ou sem vínculo empresarial e com ou sem gestor superior
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleOpenNew('colaborador_efetivo', 'PF')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#05100C] bg-[#10B981] hover:bg-[#34D399] rounded-xl cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span> Novo Colaborador / Gestor</span>
          </button>
          <button
            type="button"
            onClick={() => handleOpenNew('colaborador_free', 'FREELANCER')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#05100C] bg-[#F59E0B] hover:bg-[#FBBF24] rounded-xl cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span> Novo Freelancer / Autônomo</span>
          </button>
          <button
            type="button"
            onClick={() => handleOpenNew('cliente', 'PF')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-white/10 hover:bg-white/15 border border-white/15 rounded-xl cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span> Cliente / Fornecedor</span>
          </button>
        </div>
      </div>

      
      <div className="bg-[#071712] border border-white/10 rounded-xl p-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'unificado', label: ` Base Geral Unificada (${contadores.total})` },
            { id: 'equipe', label: ` Matriz de Permissões & Escalas (${(data.usuarios || []).length})` },
            { id: 'freelancers', label: ` Match Diárias Free (${(data.freelancers || []).length})` },
            { id: 'empresas', label: ` Empresas & WhatsApp (${(data.empresas || []).length})` },
            { id: 'arquivados', label: ` Arquivados / Desarquivar (${listaArquivados.length})` }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubHub(tab.id as any)}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                subHub === tab.id
                  ? tab.id === 'arquivados'
                    ? 'bg-rose-500 text-white shadow'
                    : 'bg-[#10B981] text-[#05100C] shadow'
                  : tab.id === 'arquivados' && listaArquivados.length > 0
                  ? 'bg-rose-500/20 text-rose-200 border border-rose-500/40'
                  : 'bg-[#05100C] text-slate-300 hover:text-white border border-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono px-2">
          <span className="text-[#10B981]"> Comunidade WPP: {contadores.comunidadeWpp}</span>
          <span className="text-slate-600">|</span>
          <span className="text-rose-400"> Bloqueados Sistema: {contadores.proibidosSistema}</span>
        </div>
      </div>

      
      {subHub === 'equipe' && <EquipeTab {...props} />}
      {subHub === 'freelancers' && <FreelancersTab {...props} />}
      {subHub === 'empresas' && <EmpresasTab {...props} />}

      {subHub === 'arquivados' && (
        <div className="bg-[#071712] border border-rose-500/35 rounded-xl p-4 sm:p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white">
              Cadastros e Registros Arquivados ({listaArquivados.length})
            </h3>
            <p className="text-xs text-slate-400">
              Qualquer cadastro arquivado por engano aparece aqui e pode ser restaurado imediatamente com 1 clique.
            </p>
          </div>
          {listaArquivados.length === 0 ? (
            <div className="p-4 rounded-xl bg-[#05100C] border border-white/10 text-xs text-emerald-300">
              Nenhum cadastro arquivado no momento. Todos os registros estão ativos na Base Geral Unificada.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {listaArquivados.map((arq: any) => (
                <div
                  key={`${arq.tabela}-${arq.id}`}
                  className="p-4 rounded-xl bg-[#05100C] border border-rose-500/40 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">
                        {arq.rotuloTabela || arq.tabela}
                      </span>
                      <span className="text-slate-500">ID #{arq.id}</span>
                    </div>
                    <div className="text-sm font-bold text-white">{arq.nome}</div>
                    {arq.detalhe && <div className="text-xs text-slate-400">{arq.detalhe}</div>}
                    {arq.whatsapp && (
                      <div className="text-[11px] font-mono text-[#10B981]">{arq.whatsapp}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRestaurarArquivado(arq.id, arq.tabela, arq.nome)}
                    className="w-full py-2 px-3 rounded-lg bg-[#10B981] hover:bg-[#34D399] text-[#05100C] text-xs font-black cursor-pointer"
                  >
                    Desarquivar / Restaurar Cadastro
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      
      {subHub === 'unificado' && (
        <>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {[
              { id: 'todos', label: 'Todos', count: contadores.total, symbol: '' },
              { id: 'colaborador_efetivo', label: 'Efetivos', count: contadores.efetivos, symbol: '' },
              { id: 'colaborador_free', label: 'Colab. Free', count: contadores.free, symbol: '' },
              { id: 'gestor_conta', label: 'Gestores', count: contadores.gestores, symbol: '' },
              { id: 'cliente', label: 'Clientes', count: contadores.clientes, symbol: '' },
              { id: 'fornecedor', label: 'Fornecedores', count: contadores.fornecedores, symbol: '' },
              { id: 'comunidade_wpp', label: 'Comunidade WPP', count: contadores.comunidadeWpp, symbol: '' },
              { id: 'bloqueados', label: 'Proibidos Sist.', count: contadores.proibidosSistema, symbol: '' }
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFiltroPapel(item.id as any)}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  filtroPapel === item.id
                    ? 'bg-[#113025] border-[#10B981] shadow-md'
                    : 'bg-[#071712] border-white/10 hover:border-white/25'
                }`}
              >
                <div className="text-[10px] text-slate-400 flex items-center gap-1 truncate">
                  <span>{item.symbol}</span>
                  <span className="truncate">{item.label}</span>
                </div>
                <div className="text-base font-mono font-black text-white mt-0.5">{item.count}</div>
              </button>
            ))}
          </div>

          
          <div className="bg-[#071712] border border-white/10 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'todos', label: 'Todas Naturezas' },
                  { id: 'PF', label: ' PF (CPF)' },
                  { id: 'PJ', label: ' PJ (CNPJ)' },
                  { id: 'EMPRESA', label: ' Empresa' },
                  { id: 'FREELANCER', label: ' Freelancer' }
                ] as { id: 'todos' | NaturezaCadastro; label: string }[]
              ).map((nat) => (
                <button
                  key={nat.id}
                  type="button"
                  onClick={() => setFiltroNatureza(nat.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                    filtroNatureza === nat.id
                      ? 'bg-[#F59E0B] text-[#05100C]'
                      : 'bg-[#05100C] text-slate-300 border border-white/10'
                  }`}
                >
                  {nat.label}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, CPF/CNPJ, WhatsApp (com ou sem DDD)..."
              className="flex-1 min-w-[220px] px-3.5 py-2 bg-[#05100C] border border-white/10 rounded-xl text-xs text-white"
            />
          </div>

          
          {(() => {
            const abrirModalEdicaoItem = (item: any) => {
              const papeis: string[] = Array.isArray(item.papeis) ? item.papeis : [];
              const autorizadoWpp = possuiAcessoSistemaEComunidadeWpp(papeis);
              const nat: NaturezaCadastro =
                item.natureza || (item.tipo_pessoa === 'PJ' ? 'PJ' : 'PF');
              const usuarioVinculado = autorizadoWpp ? encontrarUsuarioSistema(item) : null;
              const resolvedUid =
                item.usuario_sistema_id ||
                usuarioVinculado?.id ||
                (item.id >= 100000 && item.id < 200000 ? item.id - 100000 : null);
              const sIds = resolvedUid
                ? (data.relacionamentos?.rel_usuario_setor || [])
                    .filter((r: any) => Number(r.usuario_id) === Number(resolvedUid))
                    .map((r: any) => Number(r.setor_id))
                : [];
              const uIds = resolvedUid
                ? (data.relacionamentos?.rel_usuario_unidade || [])
                    .filter((r: any) => Number(r.usuario_id) === Number(resolvedUid))
                    .map((r: any) => Number(r.unidade_id))
                : [];
              const cleanWhatsapp = String(item.whatsapp || '').includes('@')
                ? ''
                : String(item.whatsapp || '');
              setForm({
                id: item.id,
                usuario_sistema_id: resolvedUid ? Number(resolvedUid) : null,
                nome_original: item.nome || '',
                nome: item.nome || '',
                natureza: nat,
                tipo_pessoa: item.tipo_pessoa === 'PJ' || nat === 'EMPRESA' ? 'PJ' : 'PF',
                documento: item.documento || '',
                whatsapp: cleanWhatsapp,
                email: item.email || '',
                papeis: papeis.length > 0 ? (papeis as PapelCadastro[]) : ['cliente'],
                empresa_id:
                  item.empresa_id !== undefined && item.empresa_id !== null
                    ? Number(item.empresa_id)
                    : 0,
                gestor_id: item.gestor_id ?? null,
                valor_diaria: Number(item.valor_diaria || 160),
                cidade: item.cidade || 'Belém - PA',
                cargo_ou_ramo: item.cargo_ou_ramo || '',
                observacoes: item.observacoes || '',
                senha_acesso: '',
                setoresIds: sIds.length > 0 ? sIds : [Number(data.setores?.[0]?.id || 1)],
                unidadesIds: uIds.length > 0 ? uIds : [Number(data.unidades?.[0]?.id || 1)]
              });
              setCriandoSetorCadastro(false);
              setCriandoEmpresaCadastro(false);
              setModalOpen(true);
            };

            const renderCardCadastro = (item: any, subtituloHierarquia?: string) => {
              const papeis: string[] = Array.isArray(item.papeis) ? item.papeis : [];
              const autorizadoWpp = possuiAcessoSistemaEComunidadeWpp(papeis);
              const cleanWpp = String(item.whatsapp || '').includes('@') ? '' : String(item.whatsapp || '');
              const wppInfo = resolverWhatsappInteligente(cleanWpp, data, currentUser);
              const nat: NaturezaCadastro =
                item.natureza || (item.tipo_pessoa === 'PJ' ? 'PJ' : 'PF');
              const usuarioVinculado = autorizadoWpp ? encontrarUsuarioSistema(item) : null;
              const ehMinhaContaLogada =
                Boolean(usuarioVinculado && currentUser) &&
                Number(usuarioVinculado.id) === Number(currentUser.id);
              const podeSimularEste =
                Boolean(onSwitchCurrentUser && usuarioVinculado) &&
                !ehMinhaContaLogada &&
                !isSuperAdminUser(usuarioVinculado) &&
                (isSuperAdminUser(currentUser) ||
                  (isGestorEmpresaUser(currentUser) &&
                    isSubordinadoDoGestor(currentUser, usuarioVinculado, data.empresaAtivaId)));
              const empVinculadaObj = (data.empresas || []).find(
                (e: any) => Number(e.id) === Number(item.empresa_id)
              );
              const gestorSuperiorObj = item.gestor_id
                ? (data.usuarios || []).find((u: any) => Number(u.id) === Number(item.gestor_id))
                : null;

              return (
                <div
                  key={`${nat}-${item.id}`}
                  onClick={() => abrirModalEdicaoItem(item)}
                  className={`p-3.5 bg-[#071712] border rounded-xl cursor-pointer transition-all flex flex-col justify-between gap-2.5 ${
                    ehMinhaContaLogada
                      ? 'border-[#10B981] ring-1 ring-[#10B981]/40'
                      : 'border-white/10 hover:border-[#10B981]/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <VisualAvatar
                      name={item.nome}
                      role={
                        papeis.includes('gestor_conta')
                          ? 'admin'
                          : autorizadoWpp
                          ? 'garcom'
                          : 'cliente'
                      }
                      size="md"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex flex-wrap items-center gap-1">
                          <span
                            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                              nat === 'EMPRESA' || nat === 'PJ'
                                ? 'bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30'
                                : nat === 'FREELANCER'
                                ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                                : 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30'
                            }`}
                          >
                            {subtituloHierarquia ||
                              (nat === 'EMPRESA'
                                ? 'EMPRESA'
                                : nat === 'FREELANCER'
                                ? 'FREELANCER'
                                : nat === 'PJ'
                                ? 'PJ (CNPJ)'
                                : 'PF (CPF)')}
                          </span>
                          {ehMinhaContaLogada && (
                            <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded bg-[#10B981] text-[#05100C]">
                              SUA CONTA ATIVA
                            </span>
                          )}
                        </div>
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                            autorizadoWpp
                              ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {autorizadoWpp ? 'Comunidade WPP' : 'Sem Acesso Sistema'}
                        </span>
                      </div>

                      <div className="text-sm font-bold text-white truncate">{item.nome}</div>
                      {item.cargo_ou_ramo && (
                        <div className="text-xs text-slate-400 truncate">{item.cargo_ou_ramo}</div>
                      )}
                      {gestorSuperiorObj && (
                        <div className="text-[11px] text-amber-300/90">
                          Gestor Acima: <strong>{gestorSuperiorObj.nome}</strong>
                        </div>
                      )}
                      {!empVinculadaObj && nat !== 'EMPRESA' && (
                        <div className="text-[11px] text-slate-400">
                          Vínculo: <strong className="text-slate-200">Independente / Sem Empresa</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                    <span className="text-[#10B981] truncate">
                      {cleanWpp ? `${wppInfo.formatado || cleanWpp}` : 'Sem WhatsApp'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {podeSimularEste && usuarioVinculado && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSwitchCurrentUser!(usuarioVinculado);
                          }}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500 hover:text-[#05100C] cursor-pointer"
                        >
                          Simular Tela
                        </button>
                      )}
                      {!ehMinhaContaLogada &&
                        String(item.nome || '').toLowerCase().trim() !== 'admin master' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleArchive(Number(item.id));
                            }}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/35 hover:bg-rose-500 hover:text-white cursor-pointer"
                          >
                            Arquivar
                          </button>
                        )}
                    </div>
                  </div>
                </div>
              );
            };

            const isItemGestor = (c: any) => {
              const p: string[] = Array.isArray(c.papeis) ? c.papeis : [];
              return c.natureza !== 'EMPRESA' && p.includes('gestor_conta');
            };
            const isItemFree = (c: any) => {
              const p: string[] = Array.isArray(c.papeis) ? c.papeis : [];
              return (
                c.natureza !== 'EMPRESA' &&
                !isItemGestor(c) &&
                (c.natureza === 'FREELANCER' || p.includes('colaborador_free'))
              );
            };
            const isItemColabEfetivo = (c: any) => {
              const p: string[] = Array.isArray(c.papeis) ? c.papeis : [];
              return (
                c.natureza !== 'EMPRESA' &&
                !isItemGestor(c) &&
                !isItemFree(c) &&
                (p.includes('colaborador_efetivo') || p.includes('colaborador'))
              );
            };
            const isItemClienteOuFornecedor = (c: any) => {
              return (
                c.natureza !== 'EMPRESA' &&
                !isItemGestor(c) &&
                !isItemFree(c) &&
                !isItemColabEfetivo(c)
              );
            };

            const empresasBase = (data.empresas || []).filter((e: any) => {
              if (e.arquivado_legal) return false;
              if (data.empresaAtivaId && Number(e.id) !== Number(data.empresaAtivaId)) return false;
              return true;
            });

            const idsEmpresasRenderizadas = new Set<number>(empresasBase.map((e: any) => Number(e.id)));
            const freesIndependentes = listaCadastros.filter(
              (c: any) =>
                isItemFree(c) &&
                (!c.empresa_id || Number(c.empresa_id) === 0 || !idsEmpresasRenderizadas.has(Number(c.empresa_id)))
            );
            const gestoresEColabsSemEmpresa = listaCadastros.filter(
              (c: any) =>
                (isItemGestor(c) || isItemColabEfetivo(c)) &&
                (!c.empresa_id || Number(c.empresa_id) === 0 || !idsEmpresasRenderizadas.has(Number(c.empresa_id)))
            );
            const clientesEFornecedores = listaCadastros.filter(isItemClienteOuFornecedor);

            return (
              <div className="space-y-5">
                {empresasBase.map((emp: any) => {
                  const cardEmpresaVirtual =
                    listaCadastros.find(
                      (c: any) => c.natureza === 'EMPRESA' && Number(c.empresa_id) === Number(emp.id)
                    ) || {
                      id: 300000 + Number(emp.id),
                      nome: emp.nome,
                      tipo_pessoa: 'PJ',
                      natureza: 'EMPRESA',
                      documento: emp.cnpj || '',
                      whatsapp: String(emp.waha_numero || '').includes('@') ? '' : emp.waha_numero || '',
                      email: '',
                      papeis: ['gestor_conta'],
                      empresa_id: emp.id,
                      valor_diaria: Number(emp.diaria_teto || 220),
                      cidade: emp.cidade || 'Belém - PA',
                      cargo_ou_ramo: emp.ramo || 'Gastronomia',
                      observacoes: ''
                    };

                  const vinculadosEmpresa = listaCadastros.filter(
                    (c: any) => c.natureza !== 'EMPRESA' && Number(c.empresa_id) === Number(emp.id)
                  );
                  const gestoresEmpresa = vinculadosEmpresa.filter(isItemGestor);
                  const colaboradoresEmpresa = vinculadosEmpresa.filter(isItemColabEfetivo);
                  const freelancersEmpresa = vinculadosEmpresa.filter(isItemFree);

                  const temAlgumFiltroAtivo =
                    filtroPapel !== 'todos' || filtroNatureza !== 'todos' || busca.trim().length > 0;
                  const matchNomeEmpresa =
                    !busca.trim() ||
                    `${emp.nome || ''} ${emp.cnpj || ''} ${emp.ramo || ''}`
                      .toLowerCase()
                      .includes(busca.toLowerCase());
                  if (
                    temAlgumFiltroAtivo &&
                    filtroNatureza !== 'EMPRESA' &&
                    gestoresEmpresa.length === 0 &&
                    colaboradoresEmpresa.length === 0 &&
                    freelancersEmpresa.length === 0 &&
                    !matchNomeEmpresa
                  ) {
                    return null;
                  }

                  return (
                    <div
                      key={`emp-hierarquia-${emp.id}`}
                      className="rounded-2xl bg-[#05100C] border-2 border-[#10B981]/35 overflow-hidden shadow-lg"
                    >
                      <div className="p-4 bg-gradient-to-r from-[#071712] via-[#0B231B] to-[#071712] border-b border-[#10B981]/30 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/20 border border-[#F59E0B]/50 flex items-center justify-center text-[#F59E0B] font-black text-sm">
                            PJ
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-[#F59E0B]/20 border border-[#F59E0B]/40 text-[#F59E0B] text-[10px] font-mono font-black uppercase">
                                EMPRESA / UNIDADE
                              </span>
                              <h4 className="text-base font-black text-white">{emp.nome}</h4>
                              {emp.cnpj && (
                                <span className="text-xs font-mono text-slate-400">CNPJ: {emp.cnpj}</span>
                              )}
                            </div>
                            <div className="text-xs text-slate-300 mt-0.5">
                              {emp.ramo || 'Gastronomia & Eventos'} • {emp.cidade || 'Belém - PA'} •{' '}
                              <span className="text-[#10B981] font-semibold">
                                {gestoresEmpresa.length} Gestor(es)
                              </span>{' '}
                              •{' '}
                              <span className="text-purple-300 font-semibold">
                                {colaboradoresEmpresa.length} Colaborador(es)
                              </span>{' '}
                              •{' '}
                              <span className="text-cyan-300 font-semibold">
                                {freelancersEmpresa.length} Free(s)
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => abrirModalEdicaoItem(cardEmpresaVirtual)}
                            className="px-3 py-1.5 rounded-xl bg-[#F59E0B]/20 hover:bg-[#F59E0B]/30 border border-[#F59E0B]/50 text-[#F59E0B] text-xs font-bold cursor-pointer"
                          >
                            Editar Empresa
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleOpenNew('colaborador_efetivo', 'PF');
                              setForm((prev) => ({ ...prev, empresa_id: Number(emp.id) }));
                            }}
                            className="px-3 py-1.5 rounded-xl bg-[#10B981] hover:bg-[#34D399] text-[#05100C] text-xs font-black cursor-pointer"
                          >
                            + Colaborador nesta Empresa
                          </button>
                        </div>
                      </div>

                      <div className="p-4 space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between border-b border-amber-500/25 pb-1.5">
                            <span className="text-xs font-black uppercase tracking-wider text-[#F59E0B]">
                              1º Nível Hierárquico — Gestores &amp; Liderança da Empresa ({gestoresEmpresa.length})
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              Acima dos colaboradores • Gerenciam escalas e equipe
                            </span>
                          </div>
                          {gestoresEmpresa.length === 0 ? (
                            <div className="p-3 rounded-xl bg-[#071712]/60 border border-white/5 text-xs text-slate-400">
                              Nenhum gestor vinculado a esta empresa no filtro atual.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                              {gestoresEmpresa.map((g: any) =>
                                renderCardCadastro(g, 'GESTOR / LIDERANÇA')
                              )}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2 pl-0 sm:pl-4 border-l-0 sm:border-l-2 border-[#10B981]/30">
                          <div className="flex items-center justify-between border-b border-emerald-500/20 pb-1.5">
                            <span className="text-xs font-black uppercase tracking-wider text-[#10B981]">
                              2º Nível Hierárquico — Colaboradores da Equipe Interna ({colaboradoresEmpresa.length})
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              Subordinados aos gestores da empresa
                            </span>
                          </div>
                          {colaboradoresEmpresa.length === 0 ? (
                            <div className="p-3 rounded-xl bg-[#071712]/60 border border-white/5 text-xs text-slate-400">
                              Nenhum colaborador efetivo vinculado a esta empresa no filtro atual.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                              {colaboradoresEmpresa.map((col: any) =>
                                renderCardCadastro(col, 'COLABORADOR DA EMPRESA')
                              )}
                            </div>
                          )}
                        </div>

                        {freelancersEmpresa.length > 0 && (
                          <div className="space-y-2 pl-0 sm:pl-4 border-l-0 sm:border-l-2 border-purple-500/30">
                            <div className="flex items-center justify-between border-b border-purple-500/20 pb-1.5">
                              <span className="text-xs font-black uppercase tracking-wider text-purple-300">
                                3º Nível — Freelancers / Diaristas Vinculados à Empresa ({freelancersEmpresa.length})
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                              {freelancersEmpresa.map((fr: any) =>
                                renderCardCadastro(fr, 'FREE VINCULADO')
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {gestoresEColabsSemEmpresa.length > 0 && (
                  <div className="p-4 rounded-2xl bg-[#05100C] border border-emerald-500/30 space-y-3">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
                        Profissionais &amp; Gestores Sem Empresa Fixa ({gestoresEColabsSemEmpresa.length})
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {gestoresEColabsSemEmpresa.map((item: any) => renderCardCadastro(item))}
                    </div>
                  </div>
                )}

                {freesIndependentes.length > 0 && (
                  <div className="p-4 rounded-2xl bg-[#05100C] border border-purple-500/35 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-500/20 pb-2">
                      <div>
                        <span className="text-xs font-black uppercase tracking-wider text-purple-300">
                          Banco de Freelancers &amp; Autônomos Independentes ({freesIndependentes.length})
                        </span>
                        <p className="text-[11px] text-slate-400">
                          Profissionais autônomos disponíveis para convocação de diárias (separados do quadro fixo das empresas)
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenNew('colaborador_free', 'FREELANCER')}
                        className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-200 text-xs font-bold cursor-pointer"
                      >
                        + Novo Freelancer
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {freesIndependentes.map((fr: any) =>
                        renderCardCadastro(fr, 'FREELANCER INDEPENDENTE')
                      )}
                    </div>
                  </div>
                )}

                {clientesEFornecedores.length > 0 && (
                  <div className="p-4 rounded-2xl bg-[#05100C] border border-slate-800 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                      <div>
                        <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                          Clientes de Salão &amp; Fornecedores Externos ({clientesEFornecedores.length})
                        </span>
                        <p className="text-[11px] text-slate-400">
                          Cadastros comerciais externos (sem permissão de login ou comandos no sistema)
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {clientesEFornecedores.map((cf: any) => renderCardCadastro(cf))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </>
      )}

      <FocusFormModal
        open={modalOpen}
        title={
          form.id
            ? `Editar ${form.natureza === 'EMPRESA' ? 'Empresa / Unidade' : 'Cadastro'} — ${form.nome}`
            : 'Novo Cadastro Unificado (PF/PJ • Empresa • Colaborador • Freelancer)'
        }
        subtitle={
          form.natureza === 'EMPRESA'
            ? 'Dados institucionais da Empresa / Unidade (Empresas abrigam gestores e colaboradores)'
            : 'Defina se é Gestor, Colaborador da Empresa, Freelancer, Cliente ou Fornecedor'
        }
        maxWidthClass="max-w-3xl"
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onArchive={
          form.id &&
          !ehMeuProprioCadastroModal &&
          String(form.nome || '').toLowerCase().trim() !== 'admin master'
            ? () => handleArchive(form.id!)
            : undefined
        }
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-[#071712] border border-[#10B981]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div>
              <span className="text-slate-400">Conta que você está usando (Logado):</span>{' '}
              <strong className="text-[#10B981]">{currentUser?.nome || 'Operador'}</strong>
            </div>
            <div>
              <span className="text-slate-400">Ficha aberta para edição:</span>{' '}
              <strong className="text-white">{form.nome || 'Novo Cadastro'}</strong>
              {ehMeuProprioCadastroModal && (
                <span className="ml-2 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                  Sua Própria Conta (Protegida Contra Arquivamento)
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              1. Natureza do Cadastro:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { id: 'PF', label: 'Pessoa Física (CPF)', tipo: 'PF' },
                  { id: 'PJ', label: 'Fornecedor PJ (CNPJ)', tipo: 'PJ' },
                  { id: 'EMPRESA', label: 'Empresa / Filial', tipo: 'PJ' },
                  { id: 'FREELANCER', label: 'Freelancer / Autônomo', tipo: 'PF' }
                ] as { id: NaturezaCadastro; label: string; tipo: 'PF' | 'PJ' }[]
              ).map((nat) => (
                <button
                  key={nat.id}
                  type="button"
                  onClick={() => {
                    const novosPapeis: PapelCadastro[] =
                      nat.id === 'EMPRESA'
                        ? ['gestor_conta']
                        : nat.id === 'FREELANCER'
                        ? ['colaborador_free']
                        : nat.id === 'PJ'
                        ? ['fornecedor']
                        : form.papeis;
                    setForm({
                      ...form,
                      natureza: nat.id,
                      tipo_pessoa: nat.tipo,
                      papeis: novosPapeis
                    });
                  }}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                    form.natureza === nat.id
                      ? 'bg-[#10B981]/20 border-[#10B981] text-white'
                      : 'bg-[#05100C] border-white/10 text-slate-400'
                  }`}
                >
                  <span>{nat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {form.natureza === 'EMPRESA' ? (
            <div className="p-3.5 bg-[#05100C] border border-[#F59E0B]/40 rounded-xl text-xs text-amber-200 space-y-1">
              <div className="font-bold text-[#F59E0B]">
                Cadastro Institucional de Empresa / Unidade
              </div>
              <div className="text-[11px] text-slate-300">
                Esta ficha representa uma Empresa. Empresas não são tratadas como colaboradores; os gestores e colaboradores são vinculados dentro desta empresa no painel hierárquico.
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-[#05100C] border border-[#10B981]/30 rounded-xl space-y-2.5">
              <label className="block text-xs font-bold text-[#10B981]">
                2. Selecione o Papel no Sistema (define hierarquia e acesso à Comunidade WhatsApp):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {(
                  [
                    {
                      id: 'gestor_conta',
                      label: 'Gestor / Liderança',
                      desc: '1º Nível (Acima de Colaboradores) • Gere Equipe',
                      wpp: true
                    },
                    {
                      id: 'colaborador_efetivo',
                      label: 'Colaborador / Técnico',
                      desc: '2º Nível (Dentro da Empresa) • Comunidade WPP',
                      wpp: true
                    },
                    {
                      id: 'colaborador_free',
                      label: 'Colaborador Free / Autônomo',
                      desc: 'Diarista / Apoio • Match de Diárias',
                      wpp: true
                    },
                    {
                      id: 'cliente',
                      label: 'Cliente',
                      desc: 'Reservas/Salão (Sem acesso ao sistema)',
                      wpp: false
                    },
                    {
                      id: 'fornecedor',
                      label: 'Fornecedor',
                      desc: 'Estoque/Compras (Sem acesso ao sistema)',
                      wpp: false
                    }
                  ] as { id: PapelCadastro; label: string; desc: string; wpp: boolean }[]
                ).map((p) => {
                  const marcado =
                    form.papeis.includes(p.id) ||
                    (p.id === 'colaborador_efetivo' && form.papeis.includes('colaborador'));
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePapel(p.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        marcado
                          ? p.wpp
                            ? 'bg-[#113025] border-[#10B981] text-white'
                            : 'bg-[#1F1610] border-[#F59E0B] text-white'
                          : 'bg-[#071712] border-white/10 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span>{p.label}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{p.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">
                {form.natureza === 'EMPRESA'
                  ? 'Nome Fantasia / Razão Social da Empresa'
                  : form.tipo_pessoa === 'PJ'
                  ? 'Razão Social / Nome do Fornecedor PJ'
                  : 'Nome Completo'}
              </label>
              <input
                type="text"
                autoComplete="off"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder={
                  form.natureza === 'EMPRESA'
                    ? 'Digite o nome da empresa / unidade...'
                    : 'Digite o nome completo...'
                }
                className="w-full px-3 py-2 bg-[#05100C] border border-slate-800 rounded text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                {form.tipo_pessoa === 'PJ' || form.natureza === 'EMPRESA' ? 'CNPJ' : 'CPF'} (Opcional)
              </label>
              <input
                type="text"
                autoComplete="off"
                value={form.documento}
                onChange={(e) => setForm({ ...form, documento: e.target.value })}
                placeholder={
                  form.tipo_pessoa === 'PJ' || form.natureza === 'EMPRESA'
                    ? '00.000.000/0001-00'
                    : '000.000.000-00'
                }
                className="w-full px-3 py-2 bg-[#05100C] border border-slate-800 rounded text-xs font-mono text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Telefone / WhatsApp (em branco se não informado)
              </label>
              <input
                type="tel"
                name="urutau_whatsapp_field_no_autofill"
                autoComplete="new-password"
                value={String(form.whatsapp || '').includes('@') ? '' : form.whatsapp}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm({ ...form, whatsapp: val.includes('@') ? '' : val });
                }}
                placeholder="Ex: 991122334"
                className="w-full px-3 py-2 bg-[#05100C] border border-slate-800 rounded text-xs font-mono text-white"
              />
              {form.whatsapp.trim() && !form.whatsapp.includes('@') && (
                <div className="mt-1 text-[10px] font-mono text-[#10B981]">
                  → {infoWppModal.formatado} ({infoWppModal.explicacao})
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                {form.natureza === 'EMPRESA' || form.tipo_pessoa === 'PJ'
                  ? 'Ramo de Atividade / Segmento da Empresa'
                  : 'Cargo / Função Operacional'}
              </label>
              <input
                type="text"
                autoComplete="off"
                value={form.cargo_ou_ramo}
                onChange={(e) => setForm({ ...form, cargo_ou_ramo: e.target.value })}
                placeholder={
                  form.natureza === 'EMPRESA' || form.tipo_pessoa === 'PJ'
                    ? 'Ex: Pizzaria & Gastronomia'
                    : 'Ex: Garçom / Pizzaiolo / Gerente / Barman'
                }
                className="w-full px-3 py-2 bg-[#05100C] border border-slate-800 rounded text-xs text-white"
              />
            </div>

            {form.natureza === 'EMPRESA' ? (
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Teto de Diária Free da Empresa (R$)
                </label>
                <input
                  type="number"
                  step="1"
                  value={form.valor_diaria}
                  onChange={(e) =>
                    setForm({ ...form, valor_diaria: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 bg-[#05100C] border border-slate-800 rounded text-xs font-mono text-[#F59E0B]"
                />
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-xs text-slate-400">Empresa / Unidade Vinculada</label>
                  <button
                    type="button"
                    data-no-confirm="true"
                    onClick={() => setCriandoEmpresaCadastro((v) => !v)}
                    className="px-2 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-[10px] font-bold text-emerald-300 cursor-pointer"
                  >
                    {criandoEmpresaCadastro ? 'Cancelar' : '+ Criar Empresa'}
                  </button>
                </div>
                {criandoEmpresaCadastro ? (
                  <div className="p-2.5 rounded-lg bg-[#05100C] border border-emerald-500/40 space-y-2">
                    <input
                      type="text"
                      value={novaEmpresaCadastroNome}
                      onChange={(e) => setNovaEmpresaCadastroNome(e.target.value)}
                      placeholder="Nome da nova empresa / unidade..."
                      className="w-full px-2.5 py-1.5 bg-[#071712] border border-slate-700 rounded text-xs text-white"
                    />
                    <button
                      type="button"
                      data-no-confirm="true"
                      disabled={salvandoEmpresaCadastro}
                      onClick={handleCriarEmpresaInlineCadastro}
                      className="w-full py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] cursor-pointer disabled:opacity-50"
                    >
                      {salvandoEmpresaCadastro ? 'Criando...' : 'Salvar e Vincular Empresa'}
                    </button>
                  </div>
                ) : (
                  <select
                    value={form.empresa_id ?? 0}
                    onChange={(e) => setForm({ ...form, empresa_id: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-[#05100C] border border-slate-800 rounded text-xs text-white"
                  >
                    <option value={0}>Sem Empresa Vinculada / Independente (Ecossistema Geral)</option>
                    {(data.empresas || []).map((emp: any) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.nome}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {(form.natureza === 'EMPRESA' || modalAutorizadoComunidade) && (
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-400 mb-1">
                  {form.natureza === 'EMPRESA'
                    ? 'Senha de Acesso da Empresa (para login com o perfil desta empresa — deixe em branco para manter a senha atual)'
                    : 'Senha de Acesso ao Sistema (opcional — deixe em branco para manter a senha atual)'}
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={form.senha_acesso || ''}
                  onChange={(e) => setForm({ ...form, senha_acesso: e.target.value })}
                  placeholder="Digite uma nova senha (mín. 4 caracteres) se desejar definir ou alterar..."
                  className="w-full px-3 py-2 bg-[#05100C] border border-slate-800 rounded text-xs font-mono text-white"
                />
              </div>
            )}

            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">
                Localização (País, Estado e Cidade)
              </label>
              <UrutauValidatedCityStateSelector
                value={form.cidade}
                onChange={(val) => setForm({ ...form, cidade: val })}
              />
            </div>

            {modalAutorizadoComunidade && form.natureza !== 'EMPRESA' && (
              <>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Gestor Responsável Acima deste Colaborador (Hierarquia)
                  </label>
                  <select
                    value={form.gestor_id ?? ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        gestor_id: e.target.value ? Number(e.target.value) : null
                      })
                    }
                    className="w-full px-3 py-2 bg-[#05100C] border border-slate-800 rounded text-xs text-white"
                  >
                    <option value="">Sem Gestor Superior / Liderança Direta</option>
                    {gestoresLista.map((g: any) => (
                      <option key={g.id} value={g.id}>
                        {g.nome} ({g.cargo || g.tipo})
                      </option>
                    ))}
                  </select>
                </div>

                {(form.papeis.includes('colaborador_free') ||
                  form.natureza === 'FREELANCER') && (
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Valor da Diária Free (R$)
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={form.valor_diaria}
                      onChange={(e) =>
                        setForm({ ...form, valor_diaria: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 bg-[#05100C] border border-slate-800 rounded text-xs font-mono text-[#F59E0B]"
                    />
                  </div>
                )}

                <div className="sm:col-span-2 p-3.5 rounded-xl bg-[#05100C] border border-[#10B981]/30 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-[#10B981]">
                        Setores Operacionais Vinculados ao Colaborador
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Selecione os setores de atuação do colaborador ou crie um novo setor diretamente daqui
                      </div>
                    </div>
                    <button
                      type="button"
                      data-no-confirm="true"
                      onClick={() => setCriandoSetorCadastro((v) => !v)}
                      className="px-2.5 py-1 rounded-lg bg-[#10B981]/20 hover:bg-[#10B981]/30 border border-[#10B981]/40 text-xs font-bold text-[#10B981] cursor-pointer"
                    >
                      {criandoSetorCadastro ? 'Cancelar Novo Setor' : '+ Criar Novo Setor'}
                    </button>
                  </div>

                  {criandoSetorCadastro && (
                    <div className="p-3 rounded-xl bg-[#071712] border border-emerald-500/40 grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-mono uppercase text-emerald-300 mb-1">
                          Nome do Novo Setor
                        </label>
                        <input
                          type="text"
                          value={novoSetorCadastroNome}
                          onChange={(e) => setNovoSetorCadastroNome(e.target.value)}
                          placeholder="Ex: Cozinha de Finalização / Sommelier / Lounge"
                          className="w-full px-3 py-1.5 bg-[#05100C] border border-slate-700 rounded text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono uppercase text-emerald-300 mb-1">
                          Peso Rateio 10%
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.1"
                            value={novoSetorCadastroPeso}
                            onChange={(e) => setNovoSetorCadastroPeso(e.target.value)}
                            className="w-20 px-2.5 py-1.5 bg-[#05100C] border border-slate-700 rounded text-xs font-mono text-amber-400"
                          />
                          <button
                            type="button"
                            data-no-confirm="true"
                            disabled={salvandoSetorCadastro}
                            onClick={handleCriarSetorInlineCadastro}
                            className="flex-1 py-1.5 px-3 rounded bg-[#10B981] hover:bg-[#34D399] text-[#05100C] font-black text-xs cursor-pointer disabled:opacity-50"
                          >
                            {salvandoSetorCadastro ? 'Salvando...' : 'Criar e Vincular'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    {(data.setores || []).map((st: any) => {
                      const checked = form.setoresIds.includes(Number(st.id));
                      return (
                        <label
                          key={st.id}
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-all ${
                            checked
                              ? 'bg-[#10B981]/20 border-[#10B981] text-white font-bold'
                              : 'bg-[#071712] border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setForm((prev) => {
                                const sid = Number(st.id);
                                const exists = prev.setoresIds.includes(sid);
                                return {
                                  ...prev,
                                  setoresIds: exists
                                    ? prev.setoresIds.filter((id) => id !== sid)
                                    : [...prev.setoresIds, sid]
                                };
                              })
                            }
                            className="accent-[#10B981]"
                          />
                          <span>{st.nome}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Observações</label>
              <textarea
                rows={2}
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                className="w-full px-3 py-2 bg-[#05100C] border border-slate-800 rounded text-xs text-white"
              />
            </div>
          </div>
        </div>
      </FocusFormModal>
    </div>
  );
}

function LgpdGoogleSheetsCustodyPanel({
  empresaId,
  empresaNome,
  showAlert
}: {
  empresaId: number;
  empresaNome: string;
  showAlert: (title: string, msg: string, tech?: string) => void;
}) {
  const [modoConexaoDrive, setModoConexaoDrive] = useState<'botao_google' | 'trocar_drive'>('botao_google');
  const [emailServicoSistema, setEmailServicoSistema] = useState<string>('bd@nyctibi.us');
  const [contaGoogleVinculada, setContaGoogleVinculada] = useState<string>('');
  const [provedorNuvem, setProvedorNuvem] = useState<string>('Google Drive');
  const [googleClientId, setGoogleClientId] = useState<string>('');
  const [pastaDriveUrl, setPastaDriveUrl] = useState<string>('');
  const [pastaRaizNome, setPastaRaizNome] = useState<string>('');
  const [planilhaUrl, setPlanilhaUrl] = useState<string>('');
  const [googleAccessToken, setGoogleAccessToken] = useState<string>('');
  const [controladorNome, setControladorNome] = useState<string>(empresaNome);
  const [controladorDocumento, setControladorDocumento] = useState<string>('');
  const [diretoriosEstrutura, setDiretoriosEstrutura] = useState<any[]>([]);
  const [statusConexao, setStatusConexao] = useState<string>('Não Conectada');
  const [ultimaSync, setUltimaSync] = useState<string>('');
  const [proximaExportacaoNuvem, setProximaExportacaoNuvem] = useState<string>('');
  const [ultimoBackupLocalFechamento, setUltimoBackupLocalFechamento] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [provisioning, setProvisioning] = useState<boolean>(false);
  const [titularBusca, setTitularBusca] = useState<string>('');
  const [anonimizando, setAnonimizando] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string>('');
  const [zeroGuardaAtivo, setZeroGuardaAtivo] = useState<boolean>(false);
  const [custodiaTransferidaEm, setCustodiaTransferidaEm] = useState<string>('');
  const [contagensVps, setContagensVps] = useState<any>(null);
  const [migrandoVps, setMigrandoVps] = useState<boolean>(false);
  const [restaurandoArquivo, setRestaurandoArquivo] = useState<boolean>(false);
  const [computadoresAtivos, setComputadoresAtivos] = useState<number>(1);
  const [driveConectadoReal, setDriveConectadoReal] = useState<boolean>(false);
  const [modoGuardaEscolhido, setModoGuardaEscolhido] = useState<'google_drive' | 'computador_local_multiacesso'>('google_drive');
  const [multiacessoSemDriveConfirmado, setMultiacessoSemDriveConfirmado] = useState<boolean>(false);
  const [multiacessoSemDriveConfirmadoEm, setMultiacessoSemDriveConfirmadoEm] = useState<string>('');
  const [aceiteLocalCheckbox, setAceiteLocalCheckbox] = useState<boolean>(false);
  const [salvandoModoMultiacesso, setSalvandoModoMultiacesso] = useState<boolean>(false);

  const carregarStatusProcessador = () => {
    fetch(`/api/lgpd/vps-processador/status/${empresaId || 1}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json?.ok) return;
        setZeroGuardaAtivo(Boolean(json.zero_guarda_operacional_vps));
        setCustodiaTransferidaEm(json.custodia_transferida_em || '');
        setContagensVps(json.contagens_vps || null);
        if (typeof json.computadores_ativos === 'number') {
          setComputadoresAtivos(Math.max(1, json.computadores_ativos));
        }
        const realConectado = Boolean(json.drive_conectado);
        setDriveConectadoReal(realConectado);
        setStatusConexao(realConectado ? 'Conectada (Drive do Cliente)' : 'Não Conectada');
        if (json.modo_guarda_escolhido) {
          setModoGuardaEscolhido(json.modo_guarda_escolhido);
        }
        const conf = Boolean(json.multiacesso_sem_drive_confirmado);
        setMultiacessoSemDriveConfirmado(conf);
        setAceiteLocalCheckbox(conf);
        setMultiacessoSemDriveConfirmadoEm(json.multiacesso_sem_drive_confirmado_em || '');
      })
      .catch(() => {});
  };

  const handleConfirmarModoMultiacesso = async (
    modo: 'google_drive' | 'computador_local_multiacesso',
    confirmarSemDrive: boolean
  ) => {
    if (modo === 'computador_local_multiacesso' && !confirmarSemDrive) {
      showAlert(
        'Confirmação necessária',
        'Marque a caixa confirmando que entendeu como funciona o uso em mais de um computador sem Google Drive.'
      );
      return;
    }
    setSalvandoModoMultiacesso(true);
    setFeedbackMsg('');
    try {
      const res = await fetch('/api/lgpd/vps-processador/definir-modo-multiacesso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: empresaId || 1,
          modo_guarda_escolhido: modo,
          multiacesso_sem_drive_confirmado: confirmarSemDrive,
          usuario_nome: controladorNome || empresaNome
        })
      });
      const json = await res.json();
      if (res.ok && json?.ok) {
        setModoGuardaEscolhido(json.modo_guarda_escolhido);
        setMultiacessoSemDriveConfirmado(Boolean(json.multiacesso_sem_drive_confirmado));
        setMultiacessoSemDriveConfirmadoEm(json.multiacesso_sem_drive_confirmado_em || '');
        setFeedbackMsg(
          modo === 'google_drive'
            ? 'Preferência salva: sincronização automática pelo Google Drive do cliente.'
            : 'Sua escolha foi registrada: uso multiacesso sem Google Drive seguindo as orientações de fechamento no último computador.'
        );
      } else {
        showAlert('Erro', json?.erro || 'Não foi possível salvar sua escolha.');
      }
    } catch (e: any) {
      showAlert('Erro', e.message);
    } finally {
      setSalvandoModoMultiacesso(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetch(`/api/lgpd/google-sheets/status/${empresaId || 1}`)
      .then((r) => r.json())
      .then((json) => {
        if (!active || !json?.ok) return;
        const cfg = json.config || {};
        if (json.email_servico_compartilhamento || cfg.email_servico_compartilhamento) {
          setEmailServicoSistema(
            json.email_servico_compartilhamento || cfg.email_servico_compartilhamento
          );
        }
        if (json.google_client_id && !googleClientId) {
          setGoogleClientId(json.google_client_id);
        }
        setContaGoogleVinculada(cfg.conta_google_vinculada || cfg.controlador_email || '');
        setProvedorNuvem(cfg.provedor_nuvem_backup || 'Google Drive');
        setPastaDriveUrl(cfg.pasta_google_drive_url || '');
        setPastaRaizNome(
          cfg.pasta_google_drive_nome || `Urutau ERP - ${empresaNome} (Backup de Segurança LGPD)`
        );
        setPlanilhaUrl(cfg.planilha_google_url || '');
        setControladorNome(cfg.controlador_nome || empresaNome);
        setControladorDocumento(cfg.controlador_documento || '');
        setDiretoriosEstrutura(
          Array.isArray(cfg.estrutura_diretorios_planilhas)
            ? cfg.estrutura_diretorios_planilhas
            : []
        );
        const realConectado = Boolean(json.drive_conectado || cfg.drive_conectado);
        setDriveConectadoReal(realConectado);
        setStatusConexao(
          realConectado ? cfg.status_conexao || 'Conectada (Drive do Cliente)' : 'Não Conectada'
        );
        setZeroGuardaAtivo(Boolean(cfg.zero_guarda_operacional_vps === true));
        setCustodiaTransferidaEm(cfg.custodia_transferida_em || '');
        setUltimaSync(cfg.ultima_sincronizacao_em || '');
        setProximaExportacaoNuvem(
          cfg.proxima_exportacao_nuvem_em ||
            new Date(Date.now() + 60 * 60 * 1000).toISOString()
        );
        let localCloseIso = cfg.ultimo_backup_local_fechamento_em || '';
        try {
          const savedLocal = localStorage.getItem('urutau_backup_local_fechamento_exe');
          if (savedLocal) {
            const parsed = JSON.parse(savedLocal);
            if (parsed?.exportado_em) localCloseIso = parsed.exportado_em;
          }
        } catch {}
        setUltimoBackupLocalFechamento(localCloseIso);
      })
      .catch(() => {});

    carregarStatusProcessador();

    return () => {
      active = false;
    };
  }, [empresaId, empresaNome]);

  const baixarArquivoJsonPortatil = (pacote: any) => {
    const empId = Number(empresaId || 1);
    try {
      localStorage.setItem(`urutau_pacote_local_empresa_${empId}`, JSON.stringify(pacote));
    } catch {}
    const blob = new Blob([JSON.stringify(pacote, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Urutau_Dados_Completos_Empresa_${empId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleBaixarCopiaCompletaVps = async () => {
    setMigrandoVps(true);
    setFeedbackMsg('');
    try {
      const empId = Number(empresaId || 1);
      const res = await fetch(`/api/lgpd/vps-processador/exportar-pacote/${empId}`);
      const json = await res.json();
      if (!res.ok || !json?.ok || !json.pacote_portatil) {
        showAlert('Erro na exportação', json?.erro || 'Não foi possível gerar o pacote completo.');
        return;
      }
      baixarArquivoJsonPortatil(json.pacote_portatil);
      const linkXls = document.createElement('a');
      linkXls.href = `/api/lgpd/google-sheets/baixar-planilha-mestre/${empId}?codigo=01`;
      linkXls.download = `Planilha_Mestre_Urutau_${empId}.xls`;
      document.body.appendChild(linkXls);
      linkXls.click();
      document.body.removeChild(linkXls);
      setFeedbackMsg(
        'Cópia de segurança completa salva no seu computador. Nenhum dado foi apagado.'
      );
    } catch (e: any) {
      showAlert('Erro ao exportar', e.message);
    } finally {
      setMigrandoVps(false);
    }
  };

  const handleMigrarEZerarGuardaVps = async () => {
    setMigrandoVps(true);
    setFeedbackMsg('');
    try {
      const empId = Number(empresaId || 1);
      const resPacote = await fetch(`/api/lgpd/vps-processador/exportar-pacote/${empId}`);
      const jsonPacote = await resPacote.json();
      if (!resPacote.ok || !jsonPacote?.ok || !jsonPacote.pacote_portatil) {
        showAlert('Erro de segurança', 'Não foi possível confirmar a cópia dos dados antes da transferência.');
        return;
      }
      baixarArquivoJsonPortatil(jsonPacote.pacote_portatil);

      const resMig = await fetch('/api/lgpd/vps-processador/migrar-e-expurgar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: empId,
          confirmado_recebimento_cliente: true,
          manter_sessao_ram: true
        })
      });
      const jsonMig = await resMig.json();
      if (resMig.ok && jsonMig?.ok) {
        setZeroGuardaAtivo(true);
        if (jsonMig.custodia_transferida_em) setCustodiaTransferidaEm(jsonMig.custodia_transferida_em);
        carregarStatusProcessador();
        setFeedbackMsg(
          'Pronto! Todos os seus dados foram transferidos para sua posse exclusiva, sem perder nenhuma informação.'
        );
      } else {
        showAlert('Erro na transferência', jsonMig?.erro || 'Não foi possível concluir a transferência dos dados.');
      }
    } catch (e: any) {
      showAlert('Erro', e.message);
    } finally {
      setMigrandoVps(false);
    }
  };

  const handleRestaurarArquivoLocal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestaurandoArquivo(true);
    setFeedbackMsg('');
    try {
      const text = await file.text();
      const pacote = JSON.parse(text);
      const empId = Number(empresaId || pacote?.empresa_id || 1);
      localStorage.setItem(`urutau_pacote_local_empresa_${empId}`, JSON.stringify(pacote));
      const pcIdLocal = (() => {
        try {
          return localStorage.getItem('urutau_pc_id') || '';
        } catch {
          return '';
        }
      })();
      const res = await fetch('/api/lgpd/vps-processador/hidratar-sessao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: empId,
          pacote_portatil: pacote,
          pc_id: pcIdLocal,
          forcar_liberacao_manual: true
        })
      });
      const json = await res.json();
      if (res.ok && json?.ok) {
        try {
          localStorage.removeItem('urutau_ultimo_pc_fechou_sem_nuvem');
        } catch {}
        setFeedbackMsg('Seus dados foram carregados com sucesso e liberados para todos os computadores.');
      } else {
        showAlert('Erro ao carregar cópia', json?.erro || 'Arquivo incompatível.');
      }
    } catch (err: any) {
      showAlert('Arquivo inválido', err.message || 'Selecione uma cópia de segurança salva anteriormente pelo sistema.');
    } finally {
      setRestaurandoArquivo(false);
      e.target.value = '';
    }
  };

  const handleProvisionarPastaEPlanilhas = async (tokenOverride?: string) => {
    const tokenLimpo = String(tokenOverride ?? googleAccessToken ?? '').trim();
    const pastaLimpa = pastaDriveUrl.trim();
    const planilhaLimpa = planilhaUrl.trim();
    if (!tokenLimpo && !pastaLimpa && !planilhaLimpa) {
      setModoConexaoDrive('trocar_drive');
      showAlert(
        'Vincule o Google Drive do Cliente',
        `Para conectar o Google Drive da empresa sem depender de login do desenvolvedor, cole o link da pasta do Google Drive do cliente (compartilhada com ${emailServicoSistema}) ou informe o Client ID OAuth do cliente.`
      );
      return;
    }
    setProvisioning(true);
    setFeedbackMsg('');
    try {
      const res = await fetch('/api/lgpd/google-sheets/provisionar-estrutura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: empresaId || 1,
          nome_empresa: empresaNome,
          controlador_nome: controladorNome,
          controlador_documento: controladorDocumento,
          controlador_email: contaGoogleVinculada.trim(),
          conta_google_vinculada: contaGoogleVinculada.trim(),
          provedor_nuvem_backup: provedorNuvem,
          modo_conexao_drive: 'botao_google',
          pasta_google_drive_url: pastaLimpa,
          planilha_google_url: planilhaLimpa,
          google_access_token: tokenLimpo
        })
      });
      const json = await res.json();
      if (res.ok && json?.ok) {
        if (json.pasta_raiz_nome) setPastaRaizNome(json.pasta_raiz_nome);
        if (json.pasta_google_drive_url) setPastaDriveUrl(json.pasta_google_drive_url);
        if (json.planilha_google_url) setPlanilhaUrl(json.planilha_google_url);
        if (Array.isArray(json.diretorios)) setDiretoriosEstrutura(json.diretorios);
        const realConectado = Boolean(json.drive_conectado || json.config?.drive_conectado);
        setDriveConectadoReal(realConectado);
        setStatusConexao(
          realConectado
            ? json.config?.status_conexao || 'Conectada (Drive do Cliente)'
            : 'Não Conectada'
        );
        if (json.config?.ultima_sincronizacao_em) setUltimaSync(json.config.ultima_sincronizacao_em);
        setProximaExportacaoNuvem(new Date(Date.now() + 60 * 60 * 1000).toISOString());
        if (realConectado) {
          setFeedbackMsg(
            'Google Drive do cliente conectado! As pastas e planilhas da empresa estão vinculadas ao Drive do cliente e serão atualizadas de 1 em 1 hora.'
          );
        }
      } else {
        setDriveConectadoReal(false);
        setStatusConexao('Não Conectada');
        showAlert('Conta Google Não Conectada', json?.erro || 'Não foi possível validar a conexão com o Google Drive.');
      }
    } catch (e: any) {
      showAlert('Erro de conexão', e.message);
    } finally {
      setProvisioning(false);
    }
  };

  const handleDesconectarGoogleDrive = async () => {
    setProvisioning(true);
    setFeedbackMsg('');
    try {
      const res = await fetch('/api/lgpd/google-sheets/desconectar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: empresaId || 1 })
      });
      const json = await res.json();
      if (res.ok && json?.ok) {
        setDriveConectadoReal(false);
        setStatusConexao('Não Conectada');
        setGoogleAccessToken('');
        setPastaDriveUrl('');
        setPlanilhaUrl('');
        setDiretoriosEstrutura([]);
        setFeedbackMsg('Conta Google desconectada. O sistema agora exibe o status real: Não Conectada.');
      }
    } catch (e: any) {
      showAlert('Erro ao desconectar', e.message);
    } finally {
      setProvisioning(false);
    }
  };

  const handleConectarGoogleDrivePopup = () => {
    const clientId = googleClientId.trim();
    if (!clientId) {
      if (pastaDriveUrl.trim() || planilhaUrl.trim()) {
        handleProvisionarPastaEPlanilhas('');
        return;
      }
      setModoConexaoDrive('trocar_drive');
      showAlert(
        'Conectar Google Drive do Cliente (BYOS)',
        `O cliente conecta o próprio Google Drive dele (nunca o seu). Cole o link da pasta do Google Drive do cliente (compartilhada com ${emailServicoSistema}) no campo abaixo e clique em "Salvar e Aplicar Drive em Nuvem".`
      );
      return;
    }
    const startOAuth = () => {
      const g = (window as any).google;
      if (!g?.accounts?.oauth2) {
        showAlert('Google Identity Indisponível', 'Não foi possível abrir a janela de autenticação do Google neste navegador.');
        return;
      }
      const tokenClient = g.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets',
        callback: (resp: any) => {
          const tok = String(resp?.access_token || '').trim();
          if (!tok) {
            showAlert('Autenticação Cancelada', 'Nenhum token de acesso foi retornado pelo Google.');
            return;
          }
          setGoogleAccessToken(tok);
          handleProvisionarPastaEPlanilhas(tok);
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
    script.onerror = () => {
      showAlert('Erro de Rede', 'Não foi possível carregar o serviço de login do Google.');
    };
    document.head.appendChild(script);
  };

  const handleSalvarConfigLgpd = async () => {
    setSaving(true);
    setFeedbackMsg('');
    try {
      const res = await fetch('/api/lgpd/google-sheets/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: empresaId || 1,
          controlador_nome: controladorNome,
          controlador_documento: controladorDocumento,
          controlador_email: contaGoogleVinculada.trim(),
          conta_google_vinculada: contaGoogleVinculada.trim(),
          provedor_nuvem_backup: provedorNuvem,
          modo_conexao_drive: 'botao_google',
          pasta_google_drive_url: pastaDriveUrl.trim(),
          planilha_google_url: planilhaUrl.trim(),
          google_access_token: googleAccessToken.trim()
        })
      });
      const json = await res.json();
      if (res.ok && json?.ok) {
        const realConectado = Boolean(json.drive_conectado || json.config?.drive_conectado);
        setDriveConectadoReal(realConectado);
        setStatusConexao(
          realConectado ? json.config?.status_conexao || 'Conectada (Drive do Cliente)' : 'Não Conectada'
        );
        if (json.config?.ultima_sincronizacao_em) setUltimaSync(json.config.ultima_sincronizacao_em);
        if (json.config?.proxima_exportacao_nuvem_em) setProximaExportacaoNuvem(json.config.proxima_exportacao_nuvem_em);
        if (realConectado) {
          await handleProvisionarPastaEPlanilhas();
          setFeedbackMsg(
            `Google Drive do cliente vinculado com sucesso (${contaGoogleVinculada || provedorNuvem}). Exportação automática de 1 em 1 hora ativa.`
          );
        } else {
          setFeedbackMsg(
            'Dados do controlador salvos. A Conta Google permanece como Não Conectada até que o cliente cole o link da pasta do Drive ou autentique sua conta.'
          );
        }
      } else {
        showAlert('Erro ao salvar', json?.erro || 'Não foi possível atualizar o Drive em nuvem.');
      }
    } catch (e: any) {
      showAlert('Erro de conexão', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSincronizarPlanilhaAgora = async () => {
    setSyncing(true);
    setFeedbackMsg('');
    try {
      const res = await fetch('/api/lgpd/google-sheets/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: empresaId || 1,
          origem: 'AUTOMATICA_1H'
        })
      });
      const json = await res.json();
      if (res.ok && json?.ok) {
        setUltimaSync(json.sincronizado_em || new Date().toISOString());
        if (json.proxima_exportacao_nuvem_em) {
          setProximaExportacaoNuvem(json.proxima_exportacao_nuvem_em);
        } else {
          setProximaExportacaoNuvem(new Date(Date.now() + 60 * 60 * 1000).toISOString());
        }
        setFeedbackMsg(
          driveConectadoReal
            ? 'Exportação no Google Drive do cliente concluída. Próxima exportação programada para daqui a 1 hora.'
            : 'Pacote local atualizado. Conecte o Google Drive do cliente para enviar também para a nuvem.'
        );
      } else {
        showAlert('Erro na atualização', json?.erro || 'Falha ao atualizar o backup no Google Drive.');
      }
    } catch (e: any) {
      showAlert('Erro na atualização', e.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleAnonimizarTitular = async () => {
    if (!titularBusca.trim() || titularBusca.trim().length < 3) {
      showAlert('Informe o Titular', 'Digite o nome, telefone ou e-mail do titular para anonimizar.');
      return;
    }
    setAnonimizando(true);
    setFeedbackMsg('');
    try {
      const res = await fetch('/api/lgpd/direitos-titular/anonimizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: empresaId || 1,
          identificador_titular: titularBusca.trim(),
          motivo_legal: 'Atendimento ao Art. 18 da LGPD pelo Controlador da Empresa'
        })
      });
      const json = await res.json();
      if (res.ok && json?.ok) {
        setTitularBusca('');
        setFeedbackMsg(
          `Anonimização LGPD concluída: ${json.registros_anonimizados} registro(s) desidentificado(s) mantendo os totais contábeis.`
        );
      } else {
        showAlert('Erro', json?.erro || 'Não foi possível anonimizar os dados do titular.');
      }
    } catch (e: any) {
      showAlert('Erro', e.message);
    } finally {
      setAnonimizando(false);
    }
  };

  return (
    <div className="pt-5 border-t border-slate-800 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-white">
            Seus Dados São 100% Seus (Custódia BYOS no Google Drive do Cliente)
          </h4>
          <p className="text-xs text-slate-400">
            Cada cliente/empresário conecta o <strong>próprio Google Drive dele</strong> (ou guarda no computador local). Nenhum dado de cliente vai para o Google do desenvolvedor.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
              driveConectadoReal
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
            }`}
          >
            Conta Google: {driveConectadoReal ? 'Conectada (Drive do Cliente)' : 'Não Conectada'}
          </span>
          <button
            type="button"
            onClick={handleConectarGoogleDrivePopup}
            disabled={provisioning}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black cursor-pointer disabled:opacity-50"
          >
            {provisioning
              ? 'Verificando Drive...'
              : driveConectadoReal
              ? 'Reconectar / Sincronizar Drive'
              : 'Conectar Google Drive do Cliente'}
          </button>
          <button
            type="button"
            onClick={() => setModoConexaoDrive('trocar_drive')}
            className="px-3 py-1.5 rounded-lg bg-[#0B0D11] hover:bg-slate-800 border border-amber-500/40 text-amber-300 text-xs font-bold cursor-pointer"
          >
            Vincular Link da Pasta do Cliente
          </button>
          {driveConectadoReal && (
            <button
              type="button"
              onClick={handleDesconectarGoogleDrive}
              disabled={provisioning}
              className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 text-xs font-bold cursor-pointer"
            >
              Desconectar
            </button>
          )}
        </div>
      </div>

      <div className="p-4 rounded-xl bg-[#0B0D11] border border-emerald-500/40 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-black text-white">
              Posse Exclusiva da Sua Empresa (Proteção LGPD)
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Ninguém além da sua empresa guarda suas informações. Ao encerrar o sistema, tudo fica salvo no <strong>seu Google Drive</strong> ou direto no <strong>seu computador</strong>.
            </p>
          </div>
          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border ${
              zeroGuardaAtivo
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
            }`}
          >
            {zeroGuardaAtivo
              ? 'DADOS SALVOS SÓ COM VOCÊ'
              : `TRANSFERÊNCIA DISPONÍVEL (${contagensVps?.total_registros ?? 0} REGISTROS)`}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleBaixarCopiaCompletaVps}
            disabled={migrandoVps}
            className="px-3.5 py-2 rounded-lg bg-[#11151E] hover:bg-slate-800 border border-slate-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            Baixar Cópia de Segurança Agora
          </button>

          {!zeroGuardaAtivo && (
            <button
              type="button"
              onClick={handleMigrarEZerarGuardaVps}
              disabled={migrandoVps}
              className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black cursor-pointer disabled:opacity-50"
            >
              {migrandoVps
                ? 'Transferindo seus dados...'
                : 'Transferir Todos os Meus Dados Para Minha Posse'}
            </button>
          )}

          <label className="px-3.5 py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-200 text-xs font-bold cursor-pointer">
            <span>{restaurandoArquivo ? 'Carregando...' : 'Abrir Cópia Salva do Computador'}</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleRestaurarArquivoLocal}
              disabled={restaurandoArquivo}
              className="hidden"
            />
          </label>
        </div>

        {custodiaTransferidaEm && (
          <div className="text-[10px] font-mono text-emerald-300">
            Posse exclusiva ativada em {new Date(custodiaTransferidaEm).toLocaleString('pt-BR')}
          </div>
        )}
      </div>

      <div className="p-4 rounded-xl bg-[#0B0D11] border border-amber-500/40 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-black text-white">
              Sua Escolha Para Uso em 1 ou Mais Computadores Ao Mesmo Tempo
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Você decide se quer sincronizar tudo pelo seu Google Drive ou usar apenas no computador local seguindo as orientações abaixo.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border bg-emerald-500/10 border-emerald-500/40 text-emerald-300">
            Computadores conectados agora: {computadoresAtivos}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div
            className={`p-3.5 rounded-xl border space-y-2 ${
              modoGuardaEscolhido === 'google_drive'
                ? 'bg-emerald-500/10 border-emerald-500/50'
                : 'bg-[#11151E] border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black text-emerald-300">
                Opção A: Com Google Drive Conectado
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 text-[10px] font-bold">
                RECOMENDADO (2+ PCs)
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Ideal para vários computadores: todos veem as alterações em tempo real e a cópia final vai sozinha para a sua conta Google. No dia seguinte, você pode abrir por qualquer computador.
            </p>
            <button
              type="button"
              onClick={() => {
                handleConfirmarModoMultiacesso('google_drive', false);
                handleConectarGoogleDrivePopup();
              }}
              disabled={salvandoModoMultiacesso || provisioning}
              className="w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black cursor-pointer disabled:opacity-50"
            >
              {driveConectadoReal ? 'Google Drive Conectado (Atualizar)' : 'Escolher e Conectar Meu Google Drive'}
            </button>
          </div>

          <div
            className={`p-3.5 rounded-xl border space-y-2 ${
              modoGuardaEscolhido === 'computador_local_multiacesso'
                ? 'bg-amber-500/10 border-amber-500/50'
                : 'bg-[#11151E] border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black text-amber-300">
                Opção B: Multiacesso Sem Google Drive
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 text-[10px] font-bold">
                SÓ NO COMPUTADOR
              </span>
            </div>
            <div className="text-[11px] text-slate-300 space-y-1 leading-relaxed">
              <div>
                <strong>1. Enquanto abertos juntos:</strong> os computadores sincronizam tudo na hora.
              </div>
              <div>
                <strong>2. Ao fechar no fim do dia:</strong> quando o <strong>último computador fechar</strong>, a versão final fica salva <strong>somente nesse último computador</strong>.
              </div>
              <div>
                <strong>3. Para nunca perder dados:</strong> no dia seguinte, <strong>abra primeiro pelo último computador que fechou</strong> (ou carregue a cópia pelo botão acima).
              </div>
            </div>

            <label className="flex items-start gap-2 pt-1 text-[11px] text-amber-100 cursor-pointer">
              <input
                type="checkbox"
                checked={aceiteLocalCheckbox}
                onChange={(e) => setAceiteLocalCheckbox(e.target.checked)}
                className="mt-0.5 accent-amber-400"
              />
              <span>
                Entendi como funciona sem Google Drive: sei que o último computador a fechar guarda a versão final e que devo abrir primeiro por ele (ou carregar a cópia salva).
              </span>
            </label>

            <button
              type="button"
              onClick={() => handleConfirmarModoMultiacesso('computador_local_multiacesso', aceiteLocalCheckbox)}
              disabled={salvandoModoMultiacesso}
              className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black cursor-pointer disabled:opacity-50"
            >
              {salvandoModoMultiacesso
                ? 'Registrando sua escolha...'
                : multiacessoSemDriveConfirmado
                ? 'Preferência Sem Drive Confirmada'
                : 'Confirmar Uso Sem Google Drive'}
            </button>

            {multiacessoSemDriveConfirmado && multiacessoSemDriveConfirmadoEm && (
              <div className="text-[10px] font-mono text-amber-300">
                Escolha confirmada por você em {new Date(multiacessoSemDriveConfirmadoEm).toLocaleString('pt-BR')}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-3.5 rounded-xl bg-[#0B0D11] border border-emerald-500/35 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-black text-emerald-300">
              1. No Seu Google Drive (A Cada 1 Hora)
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-mono font-bold">
              AUTOMÁTICO 1H
            </span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Conectando sua conta Google, o sistema cria as pastas da sua empresa e atualiza suas planilhas sozinho no seu {provedorNuvem} de 1 em 1 hora.
          </p>
          <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-slate-400 pt-1">
            <span>
              Última atualização: {ultimaSync ? new Date(ultimaSync).toLocaleString('pt-BR') : 'Ativa'}
            </span>
            <span>
              Próxima em: {proximaExportacaoNuvem ? new Date(proximaExportacaoNuvem).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '+1h'}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#0B0D11] border border-amber-500/35 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-black text-amber-300">
              2. No Seu Computador (Ao Fechar o Sistema)
            </span>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 text-[10px] font-mono font-bold">
              AO FECHAR
            </span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Sempre que você fecha o sistema no computador (ou se preferir não conectar o Google Drive), uma cópia atualizada é salva direto na sua máquina.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-slate-400 pt-1">
            <span>
              Último fechamento salvo: {ultimoBackupLocalFechamento ? new Date(ultimoBackupLocalFechamento).toLocaleString('pt-BR') : 'Pronto para o próximo fechamento'}
            </span>
          </div>
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-xs font-bold text-emerald-300">
          {feedbackMsg}
        </div>
      )}

      {diretoriosEstrutura.length > 0 && (
        <div className="p-4 rounded-xl bg-[#0B0D11] border border-emerald-500/30 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-bold text-emerald-300">
              Pasta da Sua Empresa no Drive: <span className="text-white font-mono">{pastaRaizNome}</span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Salvo em: {provedorNuvem} ({contaGoogleVinculada || 'Sua Conta Conectada'})
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {diretoriosEstrutura.map((dir: any) => (
              <div
                key={dir.codigo}
                className="p-2.5 rounded-lg bg-[#11151E] border border-slate-800 text-xs space-y-1"
              >
                <div className="font-mono font-bold text-emerald-300 truncate">
                  [{dir.codigo}] {dir.nome_pasta}
                </div>
                {dir.planilha_nome ? (
                  <div className="text-[11px] text-slate-200 truncate">
                    Planilha no Drive: <strong>{dir.planilha_nome}</strong>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 truncate">{dir.descricao}</div>
                )}
                <div className="text-[10px] text-slate-400 font-mono truncate">
                  Abas: {(dir.abas || []).join(', ')}
                </div>
                {dir.planilha_url && (
                  <div className="pt-1">
                    <a
                      href={dir.planilha_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block text-[10px] font-bold text-amber-300 hover:underline"
                    >
                      Abrir no Google Drive
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 p-4 rounded-xl bg-[#0B0D11] border border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
              1. Conta Google Conectada &amp; Alteração de Drive em Nuvem
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setModoConexaoDrive('botao_google')}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer ${
                  modoConexaoDrive === 'botao_google'
                    ? 'bg-emerald-500/20 border-emerald-500 text-white'
                    : 'bg-[#11151E] border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Conexão Automática Google
              </button>
              <button
                type="button"
                onClick={() => setModoConexaoDrive('trocar_drive')}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer ${
                  modoConexaoDrive === 'trocar_drive'
                    ? 'bg-amber-500/20 border-amber-500 text-white'
                    : 'bg-[#11151E] border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Alterar Drive em Nuvem
              </button>
            </div>
          </div>

          {modoConexaoDrive === 'botao_google' && (
            <div className="p-3 rounded-lg bg-[#11151E] border border-emerald-500/30 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-300 mb-1">
                    Sua Conta Google para Criação Automática no Drive
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="email"
                      value={contaGoogleVinculada}
                      onChange={(e) => setContaGoogleVinculada(e.target.value)}
                      placeholder="seuemail@gmail.com"
                      className="flex-1 px-3 py-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleConectarGoogleDrivePopup}
                      disabled={provisioning}
                      className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      {provisioning ? 'Criando no Drive...' : 'Conectar e Criar no Meu Drive'}
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Ao conectar sua conta Google, o sistema cria automaticamente a pasta da sua empresa direto no <strong>seu Google Drive</strong> e mantém tudo atualizado de 1 em 1 hora.
              </p>
            </div>
          )}

          {modoConexaoDrive === 'trocar_drive' && (
            <div className="p-3 rounded-lg bg-[#11151E] border border-amber-500/30 space-y-3 text-xs text-slate-200">
              <div className="font-bold text-amber-300">
                Alterar Seu Drive em Nuvem ou Trocar a Conta Google de Backup
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Serviço de Nuvem do Backup
                  </label>
                  <select
                    value={provedorNuvem}
                    onChange={(e) => setProvedorNuvem(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#0B0D11] border border-slate-700 rounded-lg text-white"
                  >
                    <option value="Google Drive">Google Drive Pessoal / Empresarial</option>
                    <option value="Google Workspace Corporativo">Google Workspace Corporativo</option>
                    <option value="Outro Drive em Nuvem">Outra Conta / Pasta em Nuvem</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Nova Conta Google (E-mail do Drive)
                  </label>
                  <input
                    type="email"
                    value={contaGoogleVinculada}
                    onChange={(e) => setContaGoogleVinculada(e.target.value)}
                    placeholder="novaconta@gmail.com"
                    className="w-full px-3 py-2 text-xs"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Link de Pasta Específica no Novo Drive (Opcional — se deixar em branco o sistema cria sozinho)
                  </label>
                  <input
                    type="url"
                    value={pastaDriveUrl}
                    onChange={(e) => setPastaDriveUrl(e.target.value)}
                    placeholder="https://drive.google.com/drive/folders/..."
                    className="w-full px-3 py-2 text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Responsável pela Empresa (Controlador LGPD)
              </label>
              <input
                type="text"
                value={controladorNome}
                onChange={(e) => setControladorNome(e.target.value)}
                className="w-full px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                CNPJ / CPF do Responsável
              </label>
              <input
                type="text"
                value={controladorDocumento}
                onChange={(e) => setControladorDocumento(e.target.value)}
                placeholder="00.000.000/0001-00"
                className="w-full px-3 py-2 text-xs"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button
              type="button"
              onClick={handleSalvarConfigLgpd}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-[#10B981] hover:bg-[#059669] text-[#04120C] text-xs font-black cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Transferindo para Novo Drive...' : 'Salvar e Aplicar Drive em Nuvem'}
            </button>

            <button
              type="button"
              onClick={handleSincronizarPlanilhaAgora}
              disabled={syncing}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black cursor-pointer disabled:opacity-50"
            >
              {syncing ? 'Atualizando Backup no Drive...' : 'Atualizar Backup no Meu Drive Agora'}
            </button>
          </div>
        </div>

        <div className="lg:col-span-5 p-4 rounded-xl bg-[#0B0D11] border border-slate-800 flex flex-col justify-between space-y-3">
          <div className="space-y-2">
            <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              2. Direitos do Titular (Art. 18 da LGPD) &amp; Anonimização
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Permite ao empresário atender pedidos de exclusão ou anonimização de dados pessoais de clientes ou ex-colaboradores, preservando apenas o histórico financeiro anônimo.
            </p>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Nome, WhatsApp ou E-mail do Titular
              </label>
              <input
                type="text"
                value={titularBusca}
                onChange={(e) => setTitularBusca(e.target.value)}
                placeholder="Digite para localizar e anonimizar..."
                className="w-full px-3 py-2 text-xs"
              />
            </div>

            <button
              type="button"
              onClick={handleAnonimizarTitular}
              disabled={anonimizando}
              className="w-full px-3.5 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              {anonimizando ? 'Anonimizando...' : 'Anonimizar Dados Pessoais do Titular'}
            </button>
          </div>

          <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="font-bold text-slate-200">Como Seus Dados Ficam Protegidos:</div>
            <div>• Tudo salvo direto no seu Google Drive a cada 1 hora (quando conectado)</div>
            <div>• Cópia automática salva no seu computador sempre que o sistema é fechado</div>
            <div>• Você pode trocar a conta do Google Drive quando quiser</div>
            <div>• Nenhum dado da sua empresa fica retido na plataforma</div>
          </div>
        </div>
      </div>
    </div>
  );
}

