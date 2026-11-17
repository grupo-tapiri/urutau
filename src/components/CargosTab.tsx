import React, { useState, useMemo, useEffect } from 'react';
import {
  Briefcase,
  Plus,
  Edit2,
  Trash2,
  Users,
  Building2,
  Layers,
  ClipboardCheck,
  Clock,
  MapPin,
  Percent,
  Search,
  ArrowUpRight,
  ShieldCheck,
  Check,
  X,
  Sparkles,
  DollarSign
} from 'lucide-react';
import { CommonTabProps, Cargo, NivelHierarquicoCargo, TipoVinculoPadraoCargo } from '../types/erp';
import { FocusFormModal } from './UrutauShared';

const DIAS_SEMANA_NOMES = [
  { id: 0, label: 'Dom', nome: 'Domingo' },
  { id: 1, label: 'Seg', nome: 'Segunda-feira' },
  { id: 2, label: 'Ter', nome: 'Terça-feira' },
  { id: 3, label: 'Qua', nome: 'Quarta-feira' },
  { id: 4, label: 'Qui', nome: 'Quinta-feira' },
  { id: 5, label: 'Sex', nome: 'Sexta-feira' },
  { id: 6, label: 'Sáb', nome: 'Sábado' }
];

const CORES_CARGOS = [
  '#10B981', 
  '#F59E0B', 
  '#06B6D4', 
  '#22C55E', 
  '#8B5CF6', 
  '#EC4899', 
  '#F97316', 
  '#F43F5E'  
];

export function CargosTab(props: CommonTabProps) {
  const { data, onRefresh, showAlert, showConfirm, onNavigateDeepLink, deepLinkEntityId, clearDeepLink } = props;

  const [busca, setBusca] = useState('');
  const [filtroNivel, setFiltroNivel] = useState<'todos' | NivelHierarquicoCargo>('todos');
  const [filtroVinculo, setFiltroVinculo] = useState<'todos' | TipoVinculoPadraoCargo>('todos');
  const [filtroRateio, setFiltroRateio] = useState<'todos' | 'sim' | 'nao'>('todos');

  const [modalOpen, setModalOpen] = useState(false);
  const [universoCargo, setUniversoCargo] = useState<Cargo | null>(null);

  const [form, setForm] = useState<{
    id: number | null;
    nome: string;
    cbo: string;
    nivel_hierarquico: NivelHierarquicoCargo;
    tipo_vinculo_padrao: TipoVinculoPadraoCargo;
    salario_base_sugerido: number;
    valor_diaria_sugerida: number;
    participa_rateio_10: boolean;
    peso_rateio_padrao: number;
    horario_entrada_padrao: string;
    horario_saida_padrao: string;
    dias_semana_padrao: number[];
    intervalo_minutos: number;
    tolerancia_minutos: number;
    exige_controle_ponto: boolean;
    exige_gps: boolean;
    descricao_atividades: string;
    requisitos_qualificacao: string;
    setor_principal_id: number | null;
    cor_identificacao: string;
    unidadesIds: number[];
    setoresIds: number[];
    checklistsIds: number[];
    usuariosIds: number[];
  }>({
    id: null,
    nome: '',
    cbo: '',
    nivel_hierarquico: 'operacional',
    tipo_vinculo_padrao: 'efetivo_clt',
    salario_base_sugerido: 2000,
    valor_diaria_sugerida: 160,
    participa_rateio_10: true,
    peso_rateio_padrao: 1.0,
    horario_entrada_padrao: '17:00',
    horario_saida_padrao: '01:30',
    dias_semana_padrao: [1, 2, 3, 4, 5, 6],
    intervalo_minutos: 60,
    tolerancia_minutos: 15,
    exige_controle_ponto: true,
    exige_gps: true,
    descricao_atividades: '',
    requisitos_qualificacao: '',
    setor_principal_id: null,
    cor_identificacao: '#10B981',
    unidadesIds: [],
    setoresIds: [],
    checklistsIds: [],
    usuariosIds: []
  });

  const [criandoSetorCargo, setCriandoSetorCargo] = useState(false);
  const [novoSetorCargoNome, setNovoSetorCargoNome] = useState('');
  const [novoSetorCargoPeso, setNovoSetorCargoPeso] = useState('1.0');
  const [salvandoSetorCargo, setSalvandoSetorCargo] = useState(false);

  const [criandoUnidadeCargo, setCriandoUnidadeCargo] = useState(false);
  const [novaUnidadeCargoNome, setNovaUnidadeCargoNome] = useState('');
  const [salvandoUnidadeCargo, setSalvandoUnidadeCargo] = useState(false);

  const handleCriarSetorInlineCargo = async () => {
    const nome = novoSetorCargoNome.trim();
    if (!nome) {
      showAlert('Nome do Setor', 'Informe o nome do novo setor para vinculá-lo ao cargo.');
      return;
    }
    setSalvandoSetorCargo(true);
    try {
      const res = await fetch('/api/setores/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          peso_gorjeta: Number(novoSetorCargoPeso) || 1.0
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || 'Erro ao criar setor');
      await onRefresh();
      const novoId = Number(json.id);
      setForm((prev) => ({
        ...prev,
        setor_principal_id: prev.setor_principal_id ?? novoId,
        setoresIds: prev.setoresIds.includes(novoId) ? prev.setoresIds : [...prev.setoresIds, novoId]
      }));
      setNovoSetorCargoNome('');
      setNovoSetorCargoPeso('1.0');
      setCriandoSetorCargo(false);
    } catch (e: any) {
      showAlert('Erro ao Criar Setor', e.message);
    } finally {
      setSalvandoSetorCargo(false);
    }
  };

  const handleCriarUnidadeInlineCargo = async () => {
    const nome = novaUnidadeCargoNome.trim();
    if (!nome) {
      showAlert('Nome da Unidade', 'Informe o nome da nova unidade para vinculá-la ao cargo.');
      return;
    }
    setSalvandoUnidadeCargo(true);
    try {
      const res = await fetch('/api/unidades/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          cnpj: '',
          cidade: 'Belém - PA'
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || 'Erro ao criar unidade');
      await onRefresh();
      const novoId = Number(json.id);
      setForm((prev) => ({
        ...prev,
        unidadesIds: prev.unidadesIds.includes(novoId) ? prev.unidadesIds : [...prev.unidadesIds, novoId]
      }));
      setNovaUnidadeCargoNome('');
      setCriandoUnidadeCargo(false);
    } catch (e: any) {
      showAlert('Erro ao Criar Unidade', e.message);
    } finally {
      setSalvandoUnidadeCargo(false);
    }
  };

  const cargosList: Cargo[] = useMemo(() => {
    return (data.cargos || []).filter((c: any) => !c.arquivado_legal);
  }, [data.cargos]);

  useEffect(() => {
    if (deepLinkEntityId) {
      const alvo = cargosList.find((c) => Number(c.id) === Number(deepLinkEntityId));
      if (alvo) setUniversoCargo(alvo);
      clearDeepLink();
    }
  }, [deepLinkEntityId, cargosList, clearDeepLink]);

  const openEditCargo = (c?: Cargo) => {
    if (c) {
      const unIds = (data.relacionamentos?.rel_cargo_unidade || [])
        .filter((r: any) => Number(r.cargo_id) === Number(c.id) && !r.arquivado_legal)
        .map((r: any) => Number(r.unidade_id));
      const stIds = (data.relacionamentos?.rel_cargo_setor || [])
        .filter((r: any) => Number(r.cargo_id) === Number(c.id) && !r.arquivado_legal)
        .map((r: any) => Number(r.setor_id));
      const ckIds = (data.relacionamentos?.rel_cargo_checklist || [])
        .filter((r: any) => Number(r.cargo_id) === Number(c.id) && !r.arquivado_legal)
        .map((r: any) => Number(r.checklist_id));
      const usIds = (data.relacionamentos?.rel_cargo_usuario || [])
        .filter((r: any) => Number(r.cargo_id) === Number(c.id) && !r.arquivado_legal)
        .map((r: any) => Number(r.usuario_id));

      setForm({
        id: c.id,
        nome: c.nome,
        cbo: c.cbo || '',
        nivel_hierarquico: c.nivel_hierarquico || 'operacional',
        tipo_vinculo_padrao: c.tipo_vinculo_padrao || 'efetivo_clt',
        salario_base_sugerido: Number(c.salario_base_sugerido || 0),
        valor_diaria_sugerida: Number(c.valor_diaria_sugerida || 0),
        participa_rateio_10: Boolean(c.participa_rateio_10),
        peso_rateio_padrao: Number(c.peso_rateio_padrao || 1.0),
        horario_entrada_padrao: c.horario_entrada_padrao || '17:00',
        horario_saida_padrao: c.horario_saida_padrao || '01:30',
        dias_semana_padrao: Array.isArray(c.dias_semana_padrao) ? c.dias_semana_padrao : [1, 2, 3, 4, 5, 6],
        intervalo_minutos: Number(c.intervalo_minutos || 60),
        tolerancia_minutos: Number(c.tolerancia_minutos || 15),
        exige_controle_ponto: c.exige_controle_ponto !== false,
        exige_gps: c.exige_gps !== false,
        descricao_atividades: c.descricao_atividades || '',
        requisitos_qualificacao: c.requisitos_qualificacao || '',
        setor_principal_id: c.setor_principal_id ? Number(c.setor_principal_id) : null,
        cor_identificacao: c.cor_identificacao || '#10B981',
        unidadesIds: unIds,
        setoresIds: stIds,
        checklistsIds: ckIds,
        usuariosIds: usIds
      });
    } else {
      const defaultUnidades = (data.unidades || []).map((u: any) => Number(u.id));
      const defaultSetor = data.setores?.[0]?.id ? Number(data.setores[0].id) : null;
      setForm({
        id: null,
        nome: '',
        cbo: '',
        nivel_hierarquico: 'operacional',
        tipo_vinculo_padrao: 'efetivo_clt',
        salario_base_sugerido: 2000,
        valor_diaria_sugerida: 160,
        participa_rateio_10: true,
        peso_rateio_padrao: 1.0,
        horario_entrada_padrao: '17:00',
        horario_saida_padrao: '01:30',
        dias_semana_padrao: [1, 2, 3, 4, 5, 6],
        intervalo_minutos: 60,
        tolerancia_minutos: 15,
        exige_controle_ponto: true,
        exige_gps: true,
        descricao_atividades: '',
        requisitos_qualificacao: '',
        setor_principal_id: defaultSetor,
        cor_identificacao: '#10B981',
        unidadesIds: defaultUnidades,
        setoresIds: defaultSetor ? [defaultSetor] : [],
        checklistsIds: [],
        usuariosIds: []
      });
    }
    setModalOpen(true);
  };

  const toggleArrayItem = (arr: number[], id: number) =>
    arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];

  const handleSave = async () => {
    if (!form.nome.trim()) {
      showAlert('Atenção', 'Informe o título do Cargo.');
      return;
    }
    try {
      const res = await fetch('/api/cargos/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || 'Erro ao salvar cargo');
      setModalOpen(false);
      await onRefresh();
      showAlert('Sucesso', `Cargo "${form.nome}" registrado com sucesso.`);
    } catch (e: any) {
      showAlert('Erro em Cargos', e.message);
    }
  };

  const handleArchive = (id: number) => {
    showConfirm('Arquivar Cargo', 'Confirma o arquivamento deste cargo? Colaboradores vinculados manterão seus registros.', async () => {
      try {
        const res = await fetch('/api/cargos/arquivar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        });
        if (!res.ok) throw new Error('Falha ao arquivar cargo.');
        setModalOpen(false);
        setUniversoCargo(null);
        await onRefresh();
      } catch (e: any) {
        showAlert('Erro', e.message);
      }
    });
  };

  const cargosFiltrados = useMemo(() => {
    return cargosList.filter((c) => {
      if (busca.trim()) {
        const q = busca.toLowerCase();
        const mNome = c.nome.toLowerCase().includes(q);
        const mCbo = String(c.cbo || '').toLowerCase().includes(q);
        const stNome = data.setores?.find((s: any) => Number(s.id) === Number(c.setor_principal_id))?.nome || '';
        const mSetor = stNome.toLowerCase().includes(q);
        if (!mNome && !mCbo && !mSetor) return false;
      }
      if (filtroNivel !== 'todos' && c.nivel_hierarquico !== filtroNivel) return false;
      if (filtroVinculo !== 'todos' && c.tipo_vinculo_padrao !== filtroVinculo) return false;
      if (filtroRateio === 'sim' && !c.participa_rateio_10) return false;
      if (filtroRateio === 'nao' && c.participa_rateio_10) return false;
      return true;
    });
  }, [cargosList, busca, filtroNivel, filtroVinculo, filtroRateio, data.setores]);

  const totalCargos = cargosList.length;
  const cargosRateio = cargosList.filter((c) => c.participa_rateio_10).length;
  const colaboradoresAlocados = (data.relacionamentos?.rel_cargo_usuario || []).filter(
    (r: any) => !r.arquivado_legal
  ).length;

  return (
    <div className="space-y-6 w-full">
      
      <div className="bg-[#11151E] border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#10B981]/20 border border-[#10B981]/40 flex items-center justify-center text-[#10B981]">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span>Cargos & Funções da Empresa</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40">
                {totalCargos} cadastrados
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              CBO, níveis hierárquicos, horários padrão de turno, participação no rateio e vínculos N:N
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => openEditCargo()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#10B981] hover:bg-emerald-400 text-slate-950 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Cargo</span>
        </button>
      </div>

      
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-[#11151E] border border-slate-800 space-y-1">
          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
            <Briefcase className="w-3.5 h-3.5 text-[#10B981]" />
            <span>Total de Cargos</span>
          </div>
          <div className="text-xl font-bold font-mono text-white">{totalCargos}</div>
        </div>
        <div className="p-3.5 rounded-xl bg-[#11151E] border border-slate-800 space-y-1">
          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
            <Percent className="w-3.5 h-3.5 text-[#F59E0B]" />
            <span>Participam do Rateio 10%</span>
          </div>
          <div className="text-xl font-bold font-mono text-[#F59E0B]">{cargosRateio}</div>
        </div>
        <div className="p-3.5 rounded-xl bg-[#11151E] border border-slate-800 space-y-1">
          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-[#38BDF8]" />
            <span>Colaboradores Alocados</span>
          </div>
          <div className="text-xl font-bold font-mono text-[#38BDF8]">{colaboradoresAlocados}</div>
        </div>
        <div className="p-3.5 rounded-xl bg-[#11151E] border border-slate-800 space-y-1">
          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <span>Horários de Turno</span>
          </div>
          <div className="text-xs font-semibold text-slate-200">Herança Ativa por Cargo</div>
        </div>
      </div>

      
      <div className="p-3.5 rounded-xl bg-[#11151E] border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cargo por nome, CBO ou setor..."
            className="w-full pl-9 pr-3 py-2 bg-[#0B0D11] border border-slate-800 rounded-lg text-xs text-slate-100 placeholder:text-slate-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filtroNivel}
            onChange={(e: any) => setFiltroNivel(e.target.value)}
            className="px-2.5 py-1.5 bg-[#0B0D11] border border-slate-800 rounded-lg text-xs text-slate-200"
          >
            <option value="todos">Nível: Todos</option>
            <option value="autonomo">Autônomo / Independente</option>
            <option value="operacional">Operacional</option>
            <option value="lideranca">Liderança</option>
            <option value="supervisao">Supervisão</option>
            <option value="gestao">Gestão</option>
            <option value="diretoria">Diretoria</option>
          </select>

          <select
            value={filtroVinculo}
            onChange={(e: any) => setFiltroVinculo(e.target.value)}
            className="px-2.5 py-1.5 bg-[#0B0D11] border border-slate-800 rounded-lg text-xs text-slate-200"
          >
            <option value="todos">Vínculo: Todos</option>
            <option value="autonomo_sem_vinculo">Autônomo / Sem Vínculo</option>
            <option value="efetivo_clt">CLT / Efetivo</option>
            <option value="freelancer_diarista">Freelancer / Diária</option>
            <option value="pj">PJ</option>
            <option value="estagio">Estágio</option>
          </select>

          <select
            value={filtroRateio}
            onChange={(e: any) => setFiltroRateio(e.target.value)}
            className="px-2.5 py-1.5 bg-[#0B0D11] border border-slate-800 rounded-lg text-xs text-slate-200"
          >
            <option value="todos">Rateio 10%: Todos</option>
            <option value="sim">Participa do Rateio</option>
            <option value="nao">Não Participa</option>
          </select>
        </div>
      </div>

      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {cargosFiltrados.map((c) => {
          const uCount = (data.relacionamentos?.rel_cargo_usuario || []).filter(
            (r: any) => Number(r.cargo_id) === Number(c.id) && !r.arquivado_legal
          ).length;
          const sCount = (data.relacionamentos?.rel_cargo_setor || []).filter(
            (r: any) => Number(r.cargo_id) === Number(c.id) && !r.arquivado_legal
          ).length;
          const unCount = (data.relacionamentos?.rel_cargo_unidade || []).filter(
            (r: any) => Number(r.cargo_id) === Number(c.id) && !r.arquivado_legal
          ).length;
          const ckCount = (data.relacionamentos?.rel_cargo_checklist || []).filter(
            (r: any) => Number(r.cargo_id) === Number(c.id) && !r.arquivado_legal
          ).length;

          const setorPrincipal = data.setores?.find((s: any) => Number(s.id) === Number(c.setor_principal_id));

          return (
            <div
              key={c.id}
              className="p-5 bg-[#11151E] border border-slate-800 hover:border-slate-700 rounded-2xl flex flex-col justify-between gap-4 transition-all relative overflow-hidden"
            >
              
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ backgroundColor: c.cor_identificacao || '#10B981' }}
              />

              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono uppercase font-bold">
                    <span
                      className="px-2 py-0.5 rounded-md"
                      style={{
                        backgroundColor: `${c.cor_identificacao || '#10B981'}25`,
                        color: c.cor_identificacao || '#10B981'
                      }}
                    >
                      {c.nivel_hierarquico}
                    </span>
                    {c.cbo && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                        CBO: {c.cbo}
                      </span>
                    )}
                    {c.participa_rateio_10 ? (
                      <span className="px-2 py-0.5 rounded-md bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30">
                        Rateio {Number(c.peso_rateio_padrao || 1).toFixed(1)}x
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-500">
                        Sem Rateio
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditCargo(c)}
                      className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      title="Editar Cargo"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleArchive(c.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Arquivar Cargo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-bold text-white leading-snug">{c.nome}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {setorPrincipal ? `Setor Principal: ${setorPrincipal.nome}` : 'Setor Operacional Geral'}
                  </p>
                  {c.descricao_atividades && (
                    <p className="text-[11px] text-slate-300 mt-1.5 line-clamp-2 leading-relaxed">
                      {c.descricao_atividades}
                    </p>
                  )}
                </div>

                
                <div className="p-2.5 rounded-xl bg-[#0B0D11] border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#10B981]" />
                      <span>Horário Padrão do Turno:</span>
                    </span>
                    <span className="font-bold text-[#10B981]">
                      {c.horario_entrada_padrao || '08:00'} às {c.horario_saida_padrao || '17:00'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 flex items-center gap-1">
                    <span>Dias:</span>
                    <span className="text-slate-300">
                      {Array.isArray(c.dias_semana_padrao) && c.dias_semana_padrao.length > 0
                        ? c.dias_semana_padrao
                            .map((d) => DIAS_SEMANA_NOMES.find((item) => item.id === d)?.label || d)
                            .join(', ')
                        : 'Todos os dias'}
                    </span>
                  </div>
                </div>

                
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2 rounded-lg bg-[#0B0D11] border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 block">Salário Base</span>
                    <span className="font-bold text-slate-200">
                      R$ {Number(c.salario_base_sugerido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#0B0D11] border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 block">Diária Diarista</span>
                    <span className="font-bold text-amber-400">
                      R$ {Number(c.valor_diaria_sugerida || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              
              <div className="pt-3 border-t border-slate-800 space-y-2.5">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                  <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-300 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    <span>{uCount} colaboradores</span>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 text-purple-300 flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    <span>{sCount} setores</span>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    <span>{unCount} unidades</span>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center gap-1">
                    <ClipboardCheck className="w-3 h-3" />
                    <span>{ckCount} checklists</span>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setUniversoCargo(c)}
                  className="w-full py-2 px-3 rounded-xl bg-[#0B0D11] hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-300 hover:text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Ver Vínculos 360º (Universo)</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-[#10B981]" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      
      <FocusFormModal
        open={modalOpen}
        title={form.id ? `Editar Cargo — ${form.nome}` : 'Cadastrar Novo Cargo'}
        subtitle="Defina o CBO, horários padrão de turno, regras de rateio e vínculos transversais"
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onArchive={form.id ? () => handleArchive(Number(form.id)) : undefined}
      >
        <div className="space-y-5">
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Título do Cargo / Função *</label>
              <input
                type="text"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Garçom de Salão, Barman, Cozinheiro..."
                className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded-lg text-xs text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">CBO (Opcional)</label>
              <input
                type="text"
                value={form.cbo}
                onChange={(e) => setForm({ ...form, cbo: e.target.value })}
                placeholder="Ex: 5134-05"
                className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded-lg text-xs font-mono text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Nível Hierárquico</label>
              <select
                value={form.nivel_hierarquico}
                onChange={(e: any) => setForm({ ...form, nivel_hierarquico: e.target.value })}
                className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded-lg text-xs text-slate-100"
              >
                <option value="autonomo">Autônomo / Independente (Sem Superior)</option>
                <option value="operacional">Operacional</option>
                <option value="lideranca">Liderança</option>
                <option value="supervisao">Supervisão</option>
                <option value="gestao">Gestão</option>
                <option value="diretoria">Diretoria</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Vínculo Padrão</label>
              <select
                value={form.tipo_vinculo_padrao}
                onChange={(e: any) => setForm({ ...form, tipo_vinculo_padrao: e.target.value })}
                className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded-lg text-xs text-slate-100"
              >
                <option value="autonomo_sem_vinculo">Autônomo / Sem Vínculo Empresarial</option>
                <option value="efetivo_clt">CLT / Efetivo</option>
                <option value="freelancer_diarista">Freelancer / Diarista</option>
                <option value="pj">PJ</option>
                <option value="estagio">Estágio</option>
                <option value="aprendiz">Aprendiz</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Salário Base Sugerido (R$)</label>
              <input
                type="number"
                step="50"
                value={form.salario_base_sugerido}
                onChange={(e) => setForm({ ...form, salario_base_sugerido: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded-lg text-xs font-mono text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Diária Sugerida (R$)</label>
              <input
                type="number"
                step="10"
                value={form.valor_diaria_sugerida}
                onChange={(e) => setForm({ ...form, valor_diaria_sugerida: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded-lg text-xs font-mono text-amber-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className="block text-xs text-slate-400">Setor Principal de Lotação</label>
                <button
                  type="button"
                  data-no-confirm="true"
                  onClick={() => setCriandoSetorCargo((v) => !v)}
                  className="px-2 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-[10px] font-bold text-emerald-300 cursor-pointer"
                >
                  {criandoSetorCargo ? 'Cancelar' : '+ Criar Setor'}
                </button>
              </div>
              {criandoSetorCargo ? (
                <div className="p-2.5 rounded-lg bg-[#05100C] border border-emerald-500/40 space-y-2">
                  <input
                    type="text"
                    value={novoSetorCargoNome}
                    onChange={(e) => setNovoSetorCargoNome(e.target.value)}
                    placeholder="Nome do novo setor..."
                    className="w-full px-2.5 py-1.5 bg-[#0B0D11] border border-slate-700 rounded text-xs text-white"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      value={novoSetorCargoPeso}
                      onChange={(e) => setNovoSetorCargoPeso(e.target.value)}
                      placeholder="Peso 1.0"
                      className="w-24 px-2 py-1 bg-[#0B0D11] border border-slate-700 rounded text-xs font-mono text-amber-400"
                    />
                    <button
                      type="button"
                      data-no-confirm="true"
                      disabled={salvandoSetorCargo}
                      onClick={handleCriarSetorInlineCargo}
                      className="flex-1 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer disabled:opacity-50"
                    >
                      {salvandoSetorCargo ? 'Criando...' : 'Salvar e Vincular'}
                    </button>
                  </div>
                </div>
              ) : (
                <select
                  value={form.setor_principal_id ?? ''}
                  onChange={(e) => {
                    if (e.target.value === '__NEW_SETOR__') {
                      setCriandoSetorCargo(true);
                      return;
                    }
                    setForm({
                      ...form,
                      setor_principal_id: e.target.value ? Number(e.target.value) : null
                    });
                  }}
                  className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded-lg text-xs text-slate-100"
                >
                  <option value="">Sem Setor Fixo / Atuação Independente</option>
                  {(data.setores || []).map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                  <option value="__NEW_SETOR__">+ Criar Novo Setor...</option>
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Cor de Identificação do Cargo</label>
              <div className="flex items-center gap-2 pt-1">
                {CORES_CARGOS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    data-no-confirm="true"
                    onClick={() => setForm({ ...form, cor_identificacao: hex })}
                    style={{ backgroundColor: hex }}
                    className={`w-6 h-6 rounded-lg cursor-pointer transition-transform ${
                      form.cor_identificacao === hex
                        ? 'ring-2 ring-white scale-110'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Atribuições & Funções do Cargo</label>
              <textarea
                rows={2}
                value={form.descricao_atividades}
                onChange={(e) => setForm({ ...form, descricao_atividades: e.target.value })}
                placeholder="Descreva as responsabilidades e rotinas operacionais deste cargo..."
                className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded-lg text-xs text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Requisitos & Qualificações</label>
              <textarea
                rows={2}
                value={form.requisitos_qualificacao}
                onChange={(e) => setForm({ ...form, requisitos_qualificacao: e.target.value })}
                placeholder="Cursos, experiência ou certificações recomendadas..."
                className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded-lg text-xs text-slate-100"
              />
            </div>
          </div>

          
          <div className="p-4 rounded-xl bg-[#080B0F] border border-emerald-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#10B981]" />
                <span className="text-xs font-bold text-white">
                  Horário Padrão do Turno (Herdado pelos Colaboradores)
                </span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                Art. 13-A Segurança
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Entrada Padrão</label>
                <input
                  type="time"
                  value={form.horario_entrada_padrao}
                  onChange={(e) => setForm({ ...form, horario_entrada_padrao: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded-lg text-xs font-mono text-emerald-300"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Saída Padrão</label>
                <input
                  type="time"
                  value={form.horario_saida_padrao}
                  onChange={(e) => setForm({ ...form, horario_saida_padrao: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded-lg text-xs font-mono text-emerald-300"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Tolerância (minutos)</label>
                <input
                  type="number"
                  value={form.tolerancia_minutos}
                  onChange={(e) => setForm({ ...form, tolerancia_minutos: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded-lg text-xs font-mono text-slate-100"
                />
              </div>
            </div>

            
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Dias de Operação do Cargo:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    data-no-confirm="true"
                    onClick={() => setForm({ ...form, dias_semana_padrao: [0, 1, 2, 3, 4, 5, 6] })}
                    className="px-2 py-0.5 rounded bg-[#10B981]/20 hover:bg-[#10B981]/30 border border-[#10B981]/40 text-[#10B981] text-[10px] font-bold cursor-pointer transition-colors"
                  >
                     Marcar Tudo
                  </button>
                  <button
                    type="button"
                    data-no-confirm="true"
                    onClick={() => setForm({ ...form, dias_semana_padrao: [] })}
                    className="px-2 py-0.5 rounded bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-300 text-[10px] font-bold cursor-pointer transition-colors"
                  >
                     Desmarcar Tudo
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {DIAS_SEMANA_NOMES.map((d) => {
                  const ativo = (form.dias_semana_padrao || []).includes(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      data-no-confirm="true"
                      onClick={() => {
                        const atual = form.dias_semana_padrao || [];
                        const prox = ativo ? atual.filter((x) => x !== d.id) : [...atual, d.id];
                        setForm({ ...form, dias_semana_padrao: prox });
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                        ativo
                          ? 'bg-[#10B981] text-slate-950 border-[#10B981]'
                          : 'bg-[#0B0D11] text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-[#0B0D11] border border-slate-800">
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.participa_rateio_10}
                  onChange={(e) => setForm({ ...form, participa_rateio_10: e.target.checked })}
                  className="accent-[#F59E0B] w-4 h-4 rounded"
                />
                <span>Participa do Rateio 10%</span>
              </label>
              {form.participa_rateio_10 && (
                <div className="pt-1">
                  <label className="block text-[10px] font-mono text-slate-400">Peso no Rateio (ex: 1.0, 1.2)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.peso_rateio_padrao}
                    onChange={(e) => setForm({ ...form, peso_rateio_padrao: Number(e.target.value) })}
                    className="w-full px-2 py-1 bg-[#11151E] border border-slate-700 rounded text-xs font-mono text-amber-400"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.exige_controle_ponto}
                  onChange={(e) => setForm({ ...form, exige_controle_ponto: e.target.checked })}
                  className="accent-[#10B981] w-4 h-4 rounded"
                />
                <span>Exige Registro de Ponto</span>
              </label>
              <p className="text-[10px] text-slate-500 mt-1">
                Bloqueia funções caso não haja marcação de início de turno
              </p>
            </div>

            <div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.exige_gps}
                  onChange={(e) => setForm({ ...form, exige_gps: e.target.checked })}
                  className="accent-[#10B981] w-4 h-4 rounded"
                />
                <span>Exige Perímetro da Empresa (GPS)</span>
              </label>
              <p className="text-[10px] text-slate-500 mt-1">
                Apenas libera operação dentro do raio geofence configurado
              </p>
            </div>
          </div>

          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            
            <div className="p-3 bg-[#0B0D11] border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold text-amber-400">Setores</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    data-no-confirm="true"
                    onClick={() => setCriandoSetorCargo((v) => !v)}
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-pointer"
                  >
                    + Novo
                  </button>
                  <button
                    type="button"
                    data-no-confirm="true"
                    onClick={() => setForm({ ...form, setoresIds: (data.setores || []).map((s: any) => Number(s.id)) })}
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40 cursor-pointer"
                  >
                    Tudo
                  </button>
                  <button
                    type="button"
                    data-no-confirm="true"
                    onClick={() => setForm({ ...form, setoresIds: [] })}
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 cursor-pointer"
                  >
                    Limpar
                  </button>
                </div>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                {(data.setores || []).map((s: any) => (
                  <label key={s.id} className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer hover:text-white">
                    <input
                      type="checkbox"
                      checked={form.setoresIds.includes(Number(s.id))}
                      onChange={() => setForm({ ...form, setoresIds: toggleArrayItem(form.setoresIds, Number(s.id)) })}
                      className="accent-amber-500 rounded"
                    />
                    <span className="truncate">{s.nome}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="p-3 bg-[#0B0D11] border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold text-emerald-400">Unidades</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    data-no-confirm="true"
                    onClick={() => setCriandoUnidadeCargo((v) => !v)}
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-pointer"
                  >
                    + Nova
                  </button>
                  <button
                    type="button"
                    data-no-confirm="true"
                    onClick={() => setForm({ ...form, unidadesIds: (data.unidades || []).map((u: any) => Number(u.id)) })}
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40 cursor-pointer"
                  >
                    Tudo
                  </button>
                  <button
                    type="button"
                    data-no-confirm="true"
                    onClick={() => setForm({ ...form, unidadesIds: [] })}
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 cursor-pointer"
                  >
                    Limpar
                  </button>
                </div>
              </div>
              {criandoUnidadeCargo && (
                <div className="p-2 rounded bg-[#05100C] border border-emerald-500/40 space-y-1.5">
                  <input
                    type="text"
                    value={novaUnidadeCargoNome}
                    onChange={(e) => setNovaUnidadeCargoNome(e.target.value)}
                    placeholder="Nome da unidade..."
                    className="w-full px-2 py-1 bg-[#0B0D11] border border-slate-700 rounded text-[11px] text-white"
                  />
                  <button
                    type="button"
                    data-no-confirm="true"
                    disabled={salvandoUnidadeCargo}
                    onClick={handleCriarUnidadeInlineCargo}
                    className="w-full py-1 rounded bg-emerald-500 text-slate-950 font-bold text-[10px] cursor-pointer"
                  >
                    {salvandoUnidadeCargo ? 'Criando...' : 'Criar e Vincular'}
                  </button>
                </div>
              )}
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                {(data.unidades || []).map((u: any) => (
                  <label key={u.id} className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer hover:text-white">
                    <input
                      type="checkbox"
                      checked={form.unidadesIds.includes(Number(u.id))}
                      onChange={() => setForm({ ...form, unidadesIds: toggleArrayItem(form.unidadesIds, Number(u.id)) })}
                      className="accent-emerald-500 rounded"
                    />
                    <span className="truncate">{u.nome}</span>
                  </label>
                ))}
              </div>
            </div>

            
            <div className="p-3 bg-[#0B0D11] border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold text-cyan-400">Checklists</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    data-no-confirm="true"
                    onClick={() => setForm({ ...form, checklistsIds: (data.checklists || []).map((c: any) => Number(c.id)) })}
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40 cursor-pointer"
                  >
                    Tudo
                  </button>
                  <button
                    type="button"
                    data-no-confirm="true"
                    onClick={() => setForm({ ...form, checklistsIds: [] })}
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 cursor-pointer"
                  >
                    Limpar
                  </button>
                </div>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                {(data.checklists || []).map((c: any) => (
                  <label key={c.id} className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer hover:text-white">
                    <input
                      type="checkbox"
                      checked={form.checklistsIds.includes(Number(c.id))}
                      onChange={() => setForm({ ...form, checklistsIds: toggleArrayItem(form.checklistsIds, Number(c.id)) })}
                      className="accent-cyan-500 rounded"
                    />
                    <span className="truncate">{c.titulo}</span>
                  </label>
                ))}
              </div>
            </div>

            
            <div className="p-3 bg-[#0B0D11] border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold text-purple-400">Colaboradores</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    data-no-confirm="true"
                    onClick={() => setForm({ ...form, usuariosIds: (data.usuarios || []).map((u: any) => Number(u.id)) })}
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40 cursor-pointer"
                  >
                    Tudo
                  </button>
                  <button
                    type="button"
                    data-no-confirm="true"
                    onClick={() => setForm({ ...form, usuariosIds: [] })}
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 cursor-pointer"
                  >
                    Limpar
                  </button>
                </div>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                {(data.usuarios || []).map((u: any) => (
                  <label key={u.id} className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer hover:text-white">
                    <input
                      type="checkbox"
                      checked={form.usuariosIds.includes(Number(u.id))}
                      onChange={() => setForm({ ...form, usuariosIds: toggleArrayItem(form.usuariosIds, Number(u.id)) })}
                      className="accent-purple-500 rounded"
                    />
                    <span className="truncate">{u.nome}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </FocusFormModal>

      
      <FocusFormModal
        open={!!universoCargo}
        title={`Universo 360° do Cargo — ${universoCargo?.nome || ''}`}
        subtitle={`Vínculos ativos de colaboradores, unidades, setores e rotinas com navegação transversal`}
        onClose={() => setUniversoCargo(null)}
      >
        {universoCargo && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-[#080B0F] border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <span
                  className="w-3.5 h-3.5 rounded-full shrink-0"
                  style={{ backgroundColor: universoCargo.cor_identificacao || '#10B981' }}
                />
                <div>
                  <span className="font-bold text-white text-sm">{universoCargo.nome}</span>
                  <div className="text-slate-400 font-mono text-[11px] mt-0.5">
                    Turno: {universoCargo.horario_entrada_padrao || '08:00'} às {universoCargo.horario_saida_padrao || '17:00'} • Rateio: {universoCargo.participa_rateio_10 ? `Sim (${universoCargo.peso_rateio_padrao || 1}x)` : 'Não'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  const c = universoCargo;
                  setUniversoCargo(null);
                  openEditCargo(c);
                }}
                className="px-3 py-1.5 rounded-lg bg-[#10B981] text-slate-950 font-bold text-xs cursor-pointer flex items-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Editar Cargo</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              
              <div className="p-3.5 rounded-xl bg-[#0B0D11] border border-slate-800 space-y-2">
                <div className="font-bold text-purple-400 flex items-center justify-between">
                  <span>Colaboradores Lotados</span>
                  <Users className="w-3.5 h-3.5" />
                </div>
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {(data.relacionamentos?.rel_cargo_usuario || [])
                    .filter((r: any) => Number(r.cargo_id) === Number(universoCargo.id) && !r.arquivado_legal)
                    .map((r: any) => {
                      const u = data.usuarios?.find((usr: any) => Number(usr.id) === Number(r.usuario_id));
                      if (!u) return null;
                      return (
                        <div
                          key={u.id}
                          className="p-2 rounded-lg bg-[#11151E] border border-slate-800 flex items-center justify-between gap-1"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-white truncate">{u.nome}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{u.telefone || 'Sem WhatsApp'}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setUniversoCargo(null);
                              onNavigateDeepLink({ tab: 'cadastros', entityId: u.id, action: 'edit' });
                            }}
                            className="p-1 hover:text-[#10B981] text-slate-400 cursor-pointer"
                            title="Ver Cadastro"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>

              
              <div className="p-3.5 rounded-xl bg-[#0B0D11] border border-slate-800 space-y-2">
                <div className="font-bold text-amber-400 flex items-center justify-between">
                  <span>Setores de Atuação</span>
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {(data.relacionamentos?.rel_cargo_setor || [])
                    .filter((r: any) => Number(r.cargo_id) === Number(universoCargo.id) && !r.arquivado_legal)
                    .map((r: any) => {
                      const s = data.setores?.find((st: any) => Number(st.id) === Number(r.setor_id));
                      if (!s) return null;
                      return (
                        <div
                          key={s.id}
                          className="p-2 rounded-lg bg-[#11151E] border border-slate-800 flex items-center justify-between gap-1"
                        >
                          <span className="font-bold text-white truncate">{s.nome}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setUniversoCargo(null);
                              onNavigateDeepLink({ tab: 'setores', entityId: s.id, action: 'edit' });
                            }}
                            className="p-1 hover:text-amber-400 text-slate-400 cursor-pointer"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>

              
              <div className="p-3.5 rounded-xl bg-[#0B0D11] border border-slate-800 space-y-2">
                <div className="font-bold text-emerald-400 flex items-center justify-between">
                  <span>Unidades Operacionais</span>
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {(data.relacionamentos?.rel_cargo_unidade || [])
                    .filter((r: any) => Number(r.cargo_id) === Number(universoCargo.id) && !r.arquivado_legal)
                    .map((r: any) => {
                      const un = data.unidades?.find((u: any) => Number(u.id) === Number(r.unidade_id));
                      if (!un) return null;
                      return (
                        <div
                          key={un.id}
                          className="p-2 rounded-lg bg-[#11151E] border border-slate-800 flex items-center justify-between gap-1"
                        >
                          <span className="font-bold text-white truncate">{un.nome}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setUniversoCargo(null);
                              onNavigateDeepLink({ tab: 'unidades', entityId: un.id, action: 'edit' });
                            }}
                            className="p-1 hover:text-emerald-400 text-slate-400 cursor-pointer"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>

              
              <div className="p-3.5 rounded-xl bg-[#0B0D11] border border-slate-800 space-y-2">
                <div className="font-bold text-cyan-400 flex items-center justify-between">
                  <span>Checklists Atribuídos</span>
                  <ClipboardCheck className="w-3.5 h-3.5" />
                </div>
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {(data.relacionamentos?.rel_cargo_checklist || [])
                    .filter((r: any) => Number(r.cargo_id) === Number(universoCargo.id) && !r.arquivado_legal)
                    .map((r: any) => {
                      const ck = data.checklists?.find((c: any) => Number(c.id) === Number(r.checklist_id));
                      if (!ck) return null;
                      return (
                        <div
                          key={ck.id}
                          className="p-2 rounded-lg bg-[#11151E] border border-slate-800 flex items-center justify-between gap-1"
                        >
                          <span className="font-bold text-white truncate">{ck.titulo}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setUniversoCargo(null);
                              onNavigateDeepLink({ tab: 'checklists', entityId: ck.id, action: 'edit' });
                            }}
                            className="p-1 hover:text-cyan-400 text-slate-400 cursor-pointer"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        )}
      </FocusFormModal>
    </div>
  );
}
