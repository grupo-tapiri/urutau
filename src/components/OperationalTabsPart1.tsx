import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  ExternalLink,
  Check,
  Archive,
  Send,
  Layers,
  Calculator,
  ArrowUpRight,
  Columns,
  Eye,
  RefreshCw,
  Copy,
  ShoppingCart,
  Calendar,
  AlertTriangle,
  Trash2,
  Clock,
  Scale
} from 'lucide-react';
import { DeepLinkTarget, ERPCompleteData, LoteFardoVencimento } from '../types/erp';
import {
  FocusFormModal,
  evaluateMathExpression,
  VisualAvatar,
  TableVisualSVG,
  ProductVisualThumbSVG,
  CircularGaugeSVG,
  resolverWhatsappInteligente,
  UrutauDateMultiView,
  getUnidadesPermitidasUsuario,
  UnidadesMultiSelectControl
} from './UrutauShared';
import { UrutauTableFloorPlan } from './UrutauTableFloorPlan';
import { FechamentoCaixaDiarioPanel } from './FechamentoCaixaDiarioPanel';

export interface CommonTabProps {
  data: ERPCompleteData;
  onRefresh: () => Promise<void>;
  onNavigateDeepLink: (target: DeepLinkTarget) => void;
  showAlert: (title: string, message: string, technicalDetails?: string) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
  deepLinkEntityId?: number | null;
  clearDeepLink: () => void;
  currentUser?: any;
  onSwitchCurrentUser?: (user: any) => void;
}

const DIAS_SEMANA = [
  { idx: 0, curto: 'Dom', longo: 'Domingo' },
  { idx: 1, curto: 'Seg', longo: 'Segunda-feira' },
  { idx: 2, curto: 'Ter', longo: 'Terça-feira' },
  { idx: 3, curto: 'Qua', longo: 'Quarta-feira' },
  { idx: 4, curto: 'Qui', longo: 'Quinta-feira' },
  { idx: 5, curto: 'Sex', longo: 'Sexta-feira' },
  { idx: 6, curto: 'Sáb', longo: 'Sábado' }
];

function getTodayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function getDayOfWeekFromISO(dateStr: string): number {
  const [y, m, d] = String(dateStr || getTodayISO()).split('-').map(Number);
  if (!y || !m || !d) return new Date().getDay();
  return new Date(y, m - 1, d).getDay();
}

function formatBRL(val: number): string {
  return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface AdiantamentoRateioItem {
  id: string;
  usuario_id: number;
  data: string;
  valor: number;
  observacao: string;
}

function getDatesBetweenISO(startISO: string, endISO: string): string[] {
  const s = startISO <= endISO ? startISO : endISO;
  const e = startISO <= endISO ? endISO : startISO;
  const result: string[] = [];
  const [sy, sm, sd] = s.split('-').map(Number);
  const [ey, em, ed] = e.split('-').map(Number);
  if (!sy || !ey) return [getTodayISO()];
  const cur = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  let guard = 0;
  while (cur <= end && guard < 95) {
    const yyyy = cur.getFullYear();
    const mm = String(cur.getMonth() + 1).padStart(2, '0');
    const dd = String(cur.getDate()).padStart(2, '0');
    result.push(`${yyyy}-${mm}-${dd}`);
    cur.setDate(cur.getDate() + 1);
    guard++;
  }
  return result.length > 0 ? result : [getTodayISO()];
}

export function RateioTab({
  data,
  onRefresh,
  onNavigateDeepLink,
  showAlert,
  currentUser
}: CommonTabProps) {
  const todayISO = getTodayISO();
  const [dataInicioFiltro, setDataInicioFiltro] = useState<string>(todayISO);
  const [dataFimFiltro, setDataFimFiltro] = useState<string>(todayISO);

  const unidadesPermitidas = useMemo(
    () => getUnidadesPermitidasUsuario(data, currentUser),
    [data, currentUser]
  );
  const [unidadesSelecionadasIds, setUnidadesSelecionadasIds] = useState<number[]>([]);
  const effectiveUnidadesIds = useMemo(() => {
    const allIds = unidadesPermitidas.map((u: any) => Number(u.id));
    if (unidadesSelecionadasIds.length === 0) return allIds;
    const valid = unidadesSelecionadasIds.filter((id) => allIds.includes(Number(id)));
    return valid.length > 0 ? valid : allIds;
  }, [unidadesPermitidas, unidadesSelecionadasIds]);

  const [setoresSelecionadosIds, setSetoresSelecionadosIds] = useState<number[]>([]);
  const [percentualPool, setPercentualPool] = useState<number>(10);
  const [modoVisao, setModoVisao] = useState<'detalhada' | 'resumida'>('detalhada');

  const [adiantamentos, setAdiantamentos] = useState<AdiantamentoRateioItem[]>(() => {
    try {
      const saved = localStorage.getItem('urutau_rateio_adiantamentos_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [modalAdiantamentoUser, setModalAdiantamentoUser] = useState<any | null>(null);
  const [novoAdiantamentoValor, setNovoAdiantamentoValor] = useState<string>('');
  const [novoAdiantamentoData, setNovoAdiantamentoData] = useState<string>(todayISO);
  const [novoAdiantamentoObs, setNovoAdiantamentoObs] = useState<string>('Adiantamento de Rateio');

  const saveAdiantamentosList = (next: AdiantamentoRateioItem[]) => {
    setAdiantamentos(next);
    try {
      localStorage.setItem('urutau_rateio_adiantamentos_v1', JSON.stringify(next));
      fetch('/api/erp/configs/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chave: 'rateio_adiantamentos_colaboradores_v1',
          valor_json: next
        })
      }).catch(() => {});
    } catch {}
  };

  const handleSetAdiantamentoDireto = (usuarioId: number, valorTotalDesejado: number) => {
    const inicio = dataInicioFiltro <= dataFimFiltro ? dataInicioFiltro : dataFimFiltro;
    const fim = dataInicioFiltro <= dataFimFiltro ? dataFimFiltro : dataInicioFiltro;
    const outros = adiantamentos.filter(
      (a) => !(Number(a.usuario_id) === Number(usuarioId) && a.data >= inicio && a.data <= fim)
    );
    if (valorTotalDesejado > 0) {
      outros.push({
        id: `adt_${Date.now()}_${usuarioId}`,
        usuario_id: Number(usuarioId),
        data: fim,
        valor: Number(valorTotalDesejado),
        observacao: 'Adiantamento de Rateio no período'
      });
    }
    saveAdiantamentosList(outros);
  };

  const handleAdicionarAdiantamentoModal = () => {
    if (!modalAdiantamentoUser) return;
    const val = Number(novoAdiantamentoValor || 0);
    if (!val || val <= 0) {
      showAlert('Valor Inválido', 'Informe um valor positivo em R$ para o pagamento adiantado.');
      return;
    }
    const novo: AdiantamentoRateioItem = {
      id: `adt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      usuario_id: Number(modalAdiantamentoUser.id),
      data: novoAdiantamentoData || todayISO,
      valor: val,
      observacao: novoAdiantamentoObs.trim() || 'Adiantamento de Rateio'
    };
    saveAdiantamentosList([...adiantamentos, novo]);
    setNovoAdiantamentoValor('');
    setNovoAdiantamentoObs('Adiantamento de Rateio');
  };

  const handleRemoverAdiantamento = (id: string) => {
    saveAdiantamentosList(adiantamentos.filter((a) => a.id !== id));
  };

  const datasDoPeriodo = useMemo(
    () => getDatesBetweenISO(dataInicioFiltro, dataFimFiltro),
    [dataInicioFiltro, dataFimFiltro]
  );

  const aplicarAtalhoPeriodo = (tipo: 'hoje' | '7dias' | 'quinzena' | 'mes') => {
    const hoje = new Date();
    const fmt = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const fimStr = fmt(hoje);
    if (tipo === 'hoje') {
      setDataInicioFiltro(fimStr);
      setDataFimFiltro(fimStr);
    } else if (tipo === '7dias') {
      const d7 = new Date(hoje);
      d7.setDate(d7.getDate() - 6);
      setDataInicioFiltro(fmt(d7));
      setDataFimFiltro(fimStr);
    } else if (tipo === 'quinzena') {
      const d15 = new Date(hoje);
      d15.setDate(d15.getDate() - 14);
      setDataInicioFiltro(fmt(d15));
      setDataFimFiltro(fimStr);
    } else if (tipo === 'mes') {
      const dMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      setDataInicioFiltro(fmt(dMes));
      setDataFimFiltro(fimStr);
    }
  };

  const faturamentoCaixaPeriodo = useMemo(() => {
    const inicio = dataInicioFiltro <= dataFimFiltro ? dataInicioFiltro : dataFimFiltro;
    const fim = dataInicioFiltro <= dataFimFiltro ? dataFimFiltro : dataInicioFiltro;
    return data.caixa
      .filter(
        (c) =>
          c.data >= inicio &&
          c.data <= fim &&
          c.tipo === 'Entrada' &&
          (effectiveUnidadesIds.length === 0 ||
            effectiveUnidadesIds.includes(Number(c.unidade_id || 1)))
      )
      .reduce((acc, cur) => acc + Number(cur.valor || 0), 0);
  }, [data.caixa, dataInicioFiltro, dataFimFiltro, effectiveUnidadesIds]);

  const [faturamentoManual, setFaturamentoManual] = useState<string>('');
  const faturamentoEfetivo =
    faturamentoManual !== ''
      ? Number(faturamentoManual || 0)
      : faturamentoCaixaPeriodo || 17871.0 * Math.max(1, datasDoPeriodo.length);

  const [descontoGlobalValor, setDescontoGlobalValor] = useState<number>(0);
  const [descontoGlobalTipo, setDescontoGlobalTipo] = useState<'BRL' | 'PERC'>('BRL');

  const [dedutoresIndividuais, setDedutoresIndividuais] = useState<
    Record<number, { valor: number; tipo: 'BRL' | 'PERC'; motivo: string }>
  >({});

  const empAtivaId = Number(data.empresaAtivaId || 1);
  const empresaAtivaObj = data.empresas.find((e: any) => Number(e.id) === empAtivaId) || data.empresas[0];
  const [pesosSetoresLocais, setPesosSetoresLocais] = useState<Record<string, number>>(() => {
    return data.pesosRateioSetoresEmpresas?.[String(empAtivaId)] || {};
  });
  const [salvandoPesos, setSalvandoPesos] = useState(false);

  useEffect(() => {
    setPesosSetoresLocais(data.pesosRateioSetoresEmpresas?.[String(empAtivaId)] || {});
  }, [data.pesosRateioSetoresEmpresas, empAtivaId]);

  const handleSalvarPesosSetores = async () => {
    setSalvandoPesos(true);
    try {
      const res = await fetch('/api/rateio/pesos-setores/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: empAtivaId,
          pesos: pesosSetoresLocais
        })
      });
      if (!res.ok) throw new Error('Falha ao salvar pesos dos setores');
      await onRefresh();
      showAlert('Pesos Salvos', `Multiplicadores de rateio salvos com sucesso para ${empresaAtivaObj?.nome || 'a empresa'}!`);
    } catch (e: any) {
      showAlert('Erro', e.message);
    } finally {
      setSalvandoPesos(false);
    }
  };

  const participantesCalculados = useMemo(() => {
    const relUnidade = data.relacionamentos.rel_usuario_unidade || [];
    const relSetor = data.relacionamentos.rel_usuario_setor || [];

    const mapaParticipantes: Record<
      number,
      {
        usuario: any;
        unidadeId: number;
        unidadeNome: string;
        setorId: number;
        setorNome: string;
        pesoSetor: number;
        diasTrabalhados: number;
        pesoAcumuladoPeriodo: number;
        statusEscala: string;
      }
    > = {};

    for (const dateISO of datasDoPeriodo) {
      const diaSem = getDayOfWeekFromISO(dateISO);
      const movsDia = data.movimentosEscala.filter((m) => m.data === dateISO);

      for (const u of data.usuarios) {
        const escalaDias = data.escalaFixa[u.id] || [];
        const movsUser = movsDia.filter((m) => Number(m.usuario_id) === Number(u.id));
        const temFolgaOuFalta = movsUser.some(
          (m) => m.tipo === 'Folga Extra' || m.tipo === 'Falta' || m.tipo === 'Atestado'
        );
        const movReforco = movsUser.find((m) => m.tipo === 'Reforço');
        const movLotacao = movsUser.find((m) => m.tipo === 'Lotação Temporária');

        const escaladoNormal = escalaDias.includes(diaSem);
        if (temFolgaOuFalta && !movReforco) continue;
        if (!escaladoNormal && !movReforco && !movLotacao) continue;

        const vinculoUnidadePadrao =
          relUnidade.find((r) => Number(r.usuario_id) === Number(u.id))?.unidade_id || 1;
        const vinculoSetorPadrao =
          relSetor.find((r) => Number(r.usuario_id) === Number(u.id))?.setor_id || 1;

        const unidEfetiva = Number(
          movLotacao?.unidade_id || movReforco?.unidade_id || vinculoUnidadePadrao
        );
        const setorEfetivo = Number(
          movLotacao?.setor_id || movReforco?.setor_id || vinculoSetorPadrao
        );

        if (effectiveUnidadesIds.length > 0 && !effectiveUnidadesIds.includes(unidEfetiva)) {
          continue;
        }
        if (setoresSelecionadosIds.length > 0 && !setoresSelecionadosIds.includes(setorEfetivo)) {
          continue;
        }

        const objUnidade = data.unidades.find((un) => Number(un.id) === unidEfetiva);
        const objSetor = data.setores.find((st) => Number(st.id) === setorEfetivo);
        const empKey = String(empAtivaId);
        const pesoCustom = pesosSetoresLocais[String(setorEfetivo)] ?? data.pesosRateioSetoresEmpresas?.[empKey]?.[String(setorEfetivo)];
        const pesoDia = typeof pesoCustom === 'number' ? pesoCustom : Number(objSetor?.peso_rateio || 1.0);

        if (!mapaParticipantes[u.id]) {
          mapaParticipantes[u.id] = {
            usuario: u,
            unidadeId: unidEfetiva,
            unidadeNome: objUnidade?.nome || 'Matriz',
            setorId: setorEfetivo,
            setorNome: objSetor?.nome || 'Salão',
            pesoSetor: pesoDia,
            diasTrabalhados: 1,
            pesoAcumuladoPeriodo: pesoDia,
            statusEscala: movLotacao
              ? 'Lotação Temporária'
              : movReforco
              ? 'Reforço do Dia'
              : 'Escala Fixa'
          };
        } else {
          mapaParticipantes[u.id].diasTrabalhados += 1;
          mapaParticipantes[u.id].pesoAcumuladoPeriodo += pesoDia;
        }
      }
    }

    return Object.values(mapaParticipantes);
  }, [data, datasDoPeriodo, effectiveUnidadesIds, setoresSelecionadosIds, pesosSetoresLocais, empAtivaId]);

  const calculoRateio = useMemo(() => {
    const inicio = dataInicioFiltro <= dataFimFiltro ? dataInicioFiltro : dataFimFiltro;
    const fim = dataInicioFiltro <= dataFimFiltro ? dataFimFiltro : dataInicioFiltro;

    const poolBruto = (faturamentoEfetivo * percentualPool) / 100;
    const descGlobalReais =
      descontoGlobalTipo === 'PERC'
        ? (poolBruto * Number(descontoGlobalValor || 0)) / 100
        : Number(descontoGlobalValor || 0);
    const poolLiquidoDistribuivel = Math.max(0, poolBruto - descGlobalReais);

    const somaPesos = participantesCalculados.reduce(
      (acc, p) => acc + p.pesoAcumuladoPeriodo,
      0
    );

    let somaLiquidaPaga = 0;
    let somaDedutoresIndividuais = 0;
    let somaTotalAdiantado = 0;
    let somaDiferencaAReceber = 0;
    let somaDiferencaACompensar = 0;

    const linhas = participantesCalculados.map((p) => {
      const cotaBruta =
        somaPesos > 0 ? (poolLiquidoDistribuivel * p.pesoAcumuladoPeriodo) / somaPesos : 0;
      const ded = dedutoresIndividuais[p.usuario.id] || { valor: 0, tipo: 'BRL', motivo: '' };
      const valorDedutor =
        ded.tipo === 'PERC'
          ? (cotaBruta * Number(ded.valor || 0)) / 100
          : Number(ded.valor || 0);
      const cotaLiquida = Math.max(0, cotaBruta - valorDedutor);

      const adiantamentosColab = adiantamentos.filter(
        (a) =>
          Number(a.usuario_id) === Number(p.usuario.id) &&
          a.data >= inicio &&
          a.data <= fim
      );
      const valorAdiantado = adiantamentosColab.reduce(
        (acc, cur) => acc + Number(cur.valor || 0),
        0
      );

      const diferencaPendente = cotaLiquida - valorAdiantado;

      somaLiquidaPaga += cotaLiquida;
      somaDedutoresIndividuais += Math.min(cotaBruta, valorDedutor);
      somaTotalAdiantado += valorAdiantado;
      if (diferencaPendente > 0) somaDiferencaAReceber += diferencaPendente;
      if (diferencaPendente < 0) somaDiferencaACompensar += Math.abs(diferencaPendente);

      return {
        ...p,
        cotaBruta,
        valorDedutor: Math.min(cotaBruta, valorDedutor),
        cotaLiquida,
        valorAdiantado,
        adiantamentosColab,
        diferencaPendente,
        dedutorConfig: ded
      };
    });

    return {
      poolBruto,
      descGlobalReais,
      poolLiquidoDistribuivel,
      somaLiquidaPaga,
      somaDedutoresIndividuais,
      somaTotalAdiantado,
      somaDiferencaAReceber,
      somaDiferencaACompensar,
      retencaoCaixaPorDedutores: somaDedutoresIndividuais,
      linhas
    };
  }, [
    faturamentoEfetivo,
    percentualPool,
    descontoGlobalTipo,
    descontoGlobalValor,
    participantesCalculados,
    dedutoresIndividuais,
    adiantamentos,
    dataInicioFiltro,
    dataFimFiltro
  ]);

  const handleSalvarFechamento = async () => {
    try {
      const res = await fetch('/api/v46/rateio/salvar-fechamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: dataFimFiltro,
          periodo_inicio: dataInicioFiltro,
          periodo_fim: dataFimFiltro,
          unidade_id: effectiveUnidadesIds[0] || 1,
          unidades_ids: effectiveUnidadesIds,
          faturamento_bruto: faturamentoEfetivo,
          percentual_pool: percentualPool,
          valor_pool: calculoRateio.somaLiquidaPaga,
          detalhes: calculoRateio.linhas.map((l) => ({
            usuario_id: l.usuario.id,
            nome: l.usuario.nome,
            cargo: l.usuario.cargo,
            setor: l.setorNome,
            dias_trabalhados: l.diasTrabalhados,
            bruto: Number(l.cotaBruta.toFixed(2)),
            desconto: Number(l.valorDedutor.toFixed(2)),
            liquido: Number(l.cotaLiquida.toFixed(2)),
            adiantado: Number(l.valorAdiantado.toFixed(2)),
            diferenca_pendente: Number(l.diferencaPendente.toFixed(2))
          }))
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || 'Falha ao gravar fechamento de rateio');
      await onRefresh();
      showAlert(
        'Fechamento de Rateio Gravado',
        `Rateio do período ${dataInicioFiltro} a ${dataFimFiltro} (${percentualPool}%) registrado com sucesso com cálculo de adiantamentos e diferenças pendentes.`
      );
    } catch (e: any) {
      showAlert('Erro ao Fechar Rateio', e.message, e.stack);
    }
  };

  return (
    <div className="space-y-6 w-full">
      
      <div className="bg-[#11151E] border border-slate-800/90 rounded-lg p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              Rateio por Período, Adiantamentos & Diferenças Pendentes
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Filtre um dia ou período completo, lance pagamentos adiantados em cada colaborador e apure saldos pendentes para mais (+) ou para menos (-).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-[#0B0D11] border border-slate-800 rounded p-1">
              <button
                type="button"
                onClick={() => setModoVisao('detalhada')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                  modoVisao === 'detalhada'
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Visão Detalhada"
              >
                 Detalhado
              </button>
              <button
                type="button"
                onClick={() => setModoVisao('resumida')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                  modoVisao === 'resumida'
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Visão Resumida"
              >
                ⊞ Resumo
              </button>
            </div>

            <button
              type="button"
              onClick={handleSalvarFechamento}
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Gravar Rateio do Período</span>
            </button>
          </div>
        </div>

        
        <UnidadesMultiSelectControl
          unidadesPermitidas={unidadesPermitidas}
          selectedUnidadesIds={effectiveUnidadesIds}
          onChangeSelectedIds={setUnidadesSelecionadasIds}
          label="Unidades no Rateio"
        />

        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-4 pt-2 border-t border-slate-800/80">
          <div className="xl:col-span-4 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
              <label className="block text-xs text-slate-400">
                Período de Apuração ({datasDoPeriodo.length}{' '}
                {datasDoPeriodo.length === 1 ? 'dia' : 'dias'})
              </label>
              <div className="flex flex-wrap items-center gap-1">
                {[
                  { id: 'hoje', label: 'Hoje' },
                  { id: '7dias', label: '7 Dias' },
                  { id: 'quinzena', label: 'Quinzena' },
                  { id: 'mes', label: 'Mês Atual' }
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => aplicarAtalhoPeriodo(p.id as any)}
                    className="px-2 py-0.5 rounded bg-[#0B0D11] hover:bg-slate-800 border border-slate-800 text-[10px] font-mono text-amber-300 cursor-pointer"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="min-w-0">
                <input
                  type="date"
                  value={dataInicioFiltro}
                  onChange={(e) => setDataInicioFiltro(e.target.value)}
                  className="w-full px-2.5 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100 font-mono"
                  title="Data Inicial do Período"
                />
              </div>
              <div className="min-w-0">
                <input
                  type="date"
                  value={dataFimFiltro}
                  onChange={(e) => setDataFimFiltro(e.target.value)}
                  className="w-full px-2.5 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100 font-mono"
                  title="Data Final do Período"
                />
              </div>
            </div>
          </div>

          <div className="xl:col-span-4 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Setores (Caixas Checkbox)
              </label>
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  data-no-confirm="true"
                  onClick={() => setSetoresSelecionadosIds(data.setores.map((s: any) => Number(s.id)))}
                  className="px-2 py-0.5 rounded bg-[#10B981]/20 hover:bg-[#10B981]/30 border border-[#10B981]/40 text-[#10B981] text-[10px] font-bold cursor-pointer transition-colors"
                  title="Marcar todos os setores"
                >
                   Marcar Tudo
                </button>
                <button
                  type="button"
                  data-no-confirm="true"
                  onClick={() => setSetoresSelecionadosIds([])}
                  className="px-2 py-0.5 rounded bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-300 text-[10px] font-bold cursor-pointer transition-colors"
                  title="Desmarcar todos os setores"
                >
                   Desmarcar Tudo
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 p-2 rounded bg-[#0B0D11] border border-slate-800 max-h-24 overflow-y-auto">
              <label className="inline-flex items-center gap-1 text-[11px] text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={setoresSelecionadosIds.length === 0}
                  onChange={() => setSetoresSelecionadosIds([])}
                  className="w-3.5 h-3.5 accent-[#10B981] rounded cursor-pointer"
                />
                <span className="font-semibold text-[#10B981]">Todos</span>
              </label>
              {data.setores.map((s) => {
                const checked =
                  setoresSelecionadosIds.length > 0 &&
                  setoresSelecionadosIds.includes(Number(s.id));
                return (
                  <label
                    key={s.id}
                    className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                      checked
                        ? 'bg-[#10B981]/15 text-[#10B981] font-semibold border border-[#10B981]/30'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const sid = Number(s.id);
                        setSetoresSelecionadosIds((prev) =>
                          prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]
                        );
                      }}
                      className="w-3.5 h-3.5 accent-[#10B981] rounded cursor-pointer"
                    />
                    <span>{s.nome}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="xl:col-span-2 min-w-0 flex flex-col justify-between">
            <label className="block text-xs text-slate-400 mb-1.5">
              Faturamento Bruto do Período (R$)
            </label>
            <input
              type="number"
              step="0.01"
              placeholder={String(
                faturamentoCaixaPeriodo || 17871 * Math.max(1, datasDoPeriodo.length)
              )}
              value={faturamentoManual}
              onChange={(e) => setFaturamentoManual(e.target.value)}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100 font-mono tabular-nums focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="xl:col-span-2 min-w-0 flex flex-col justify-between">
            <label className="block text-xs text-slate-400 mb-1.5">
              Desconto Global do Pool (Taxa Cartão/Quebra)
            </label>
            <div className="flex gap-1.5 min-w-0">
              <input
                type="number"
                step="0.01"
                value={descontoGlobalValor}
                onChange={(e) => setDescontoGlobalValor(Number(e.target.value))}
                className="w-full min-w-0 px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100 font-mono tabular-nums focus:outline-none focus:border-amber-500"
              />
              <select
                value={descontoGlobalTipo}
                onChange={(e) => setDescontoGlobalTipo(e.target.value as 'BRL' | 'PERC')}
                className="px-2.5 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-amber-400 font-mono shrink-0"
              >
                <option value="BRL">R$</option>
                <option value="PERC">%</option>
              </select>
            </div>
          </div>
        </div>

        
        <div className="pt-3 border-t border-slate-800/80 space-y-3">
          <div className="flex items-center gap-3 w-full min-w-0">
            <CircularGaugeSVG
              percent={Math.min(100, Math.max(0, percentualPool))}
              label={`${percentualPool}%`}
              colorHex="#10B981"
              size={52}
            />
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-slate-300 font-medium">Seletor do Rateio (0% a 100%)</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[0, 5, 10, 20, 50, 100].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setPercentualPool(preset)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                        percentualPool === preset
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-[#0B0D11] text-slate-400 hover:text-amber-300 border border-slate-800'
                      }`}
                    >
                      {preset}%
                    </button>
                  ))}
                  <div className="flex items-center bg-[#0B0D11] border border-slate-700 rounded px-1.5 py-0.5">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={percentualPool}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v)) {
                          setPercentualPool(Math.min(100, Math.max(0, v)));
                        }
                      }}
                      className="w-12 bg-transparent text-right text-xs font-mono font-bold text-amber-400 focus:outline-none"
                      aria-label="Percentual do Rateio (0 a 100)"
                    />
                    <span className="text-[11px] font-mono text-slate-400 ml-0.5">%</span>
                  </div>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={percentualPool}
                onChange={(e) =>
                  setPercentualPool(Math.min(100, Math.max(0, Number(e.target.value))))
                }
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5 w-full">
            <div className="px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded min-w-0 overflow-hidden">
              <div className="text-[10px] text-slate-400 uppercase font-mono truncate">Faturamento</div>
              <div className="text-xs sm:text-sm font-mono font-semibold text-slate-100 tabular-nums truncate">
                {formatBRL(faturamentoEfetivo)}
              </div>
            </div>
            <div className="px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded min-w-0 overflow-hidden">
              <div className="text-[10px] text-slate-400 uppercase font-mono truncate">
                Repasse Líquido ({percentualPool}%)
              </div>
              <div className="text-xs sm:text-sm font-mono font-bold text-amber-400 tabular-nums truncate">
                {formatBRL(calculoRateio.somaLiquidaPaga)}
              </div>
            </div>
            <div className="px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded min-w-0 overflow-hidden">
              <div className="text-[10px] text-slate-400 uppercase font-mono truncate">
                Adiantamentos Pagos
              </div>
              <div className="text-xs sm:text-sm font-mono font-semibold text-sky-300 tabular-nums truncate">
                {formatBRL(calculoRateio.somaTotalAdiantado)}
              </div>
            </div>
            <div className="px-3 py-2 bg-[#0B0D11] border border-emerald-500/30 rounded min-w-0 overflow-hidden">
              <div className="text-[10px] text-emerald-300 uppercase font-mono truncate">
                Diferença a Pagar (+)
              </div>
              <div className="text-xs sm:text-sm font-mono font-bold text-emerald-400 tabular-nums truncate">
                + {formatBRL(calculoRateio.somaDiferencaAReceber)}
              </div>
            </div>
            <div className="px-3 py-2 bg-[#0B0D11] border border-rose-500/30 rounded min-w-0 overflow-hidden">
              <div className="text-[10px] text-rose-300 uppercase font-mono truncate">
                Adiantado a Maior (-)
              </div>
              <div className="text-xs sm:text-sm font-mono font-bold text-rose-400 tabular-nums truncate">
                - {formatBRL(calculoRateio.somaDiferencaACompensar)}
              </div>
            </div>
          </div>
        </div>
      </div>

      
      <div className="bg-[#11151E] border border-amber-500/30 rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Scale className="w-4 h-4 text-amber-400" />
              <span>Pesos Multiplicadores dos Setores no Rateio — {empresaAtivaObj?.nome || 'Empresa Ativa'}</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Configuração exclusiva desta empresa. O peso de cada setor multiplica a cota do colaborador nos dias trabalhados.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSalvarPesosSetores}
            disabled={salvandoPesos}
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow self-start sm:self-auto"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{salvandoPesos ? 'Salvando...' : 'Salvar Pesos da Empresa'}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 pt-1">
          {data.setores.map((s: any) => {
            const sid = String(s.id);
            const valAtual =
              pesosSetoresLocais[sid] ??
              data.pesosRateioSetoresEmpresas?.[String(empAtivaId)]?.[sid] ??
              Number(s.peso_rateio || 1.0);
            return (
              <div key={s.id} className="bg-[#0B0D11] border border-slate-800 rounded-lg p-2.5 space-y-1">
                <div className="text-[11px] font-semibold text-slate-200 truncate" title={s.nome}>
                  {s.nome}
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={valAtual}
                    onChange={(e) => {
                      const n = parseFloat(e.target.value) || 0;
                      setPesosSetoresLocais((prev) => ({ ...prev, [sid]: n }));
                    }}
                    className="w-full px-2 py-1 bg-[#151922] border border-slate-700 rounded text-xs font-mono font-bold text-amber-400 text-right focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-[11px] font-mono text-slate-400">x</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      
      <div className="bg-[#11151E] border border-slate-800/90 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-medium text-slate-300 flex flex-wrap items-center gap-2">
            <span className="font-mono text-amber-400">
              {dataInicioFiltro === dataFimFiltro
                ? dataInicioFiltro
                : `${dataInicioFiltro} até ${dataFimFiltro}`}
            </span>
            <span>·</span>
            <span>
              {datasDoPeriodo.length} {datasDoPeriodo.length === 1 ? 'dia apurado' : 'dias apurados'}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-mono text-[11px]">
              {calculoRateio.linhas.length} colaboradores ativos
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
             Digite o valor adiantado direto na linha de cada nome ou clique em <strong>+ Lançar</strong> para múltiplos adiantamentos.
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-[#0D1017] text-[11px] font-mono uppercase text-slate-400">
                <th className="py-3 px-4">Colaborador</th>
                {modoVisao === 'detalhada' && <th className="py-3 px-4">Unidade / Setor</th>}
                {modoVisao === 'detalhada' && <th className="py-3 px-3 text-center">Dias</th>}
                <th className="py-3 px-3 text-right">Peso</th>
                <th className="py-3 px-3 text-right">Bruto</th>
                {modoVisao === 'detalhada' && <th className="py-3 px-3">Dedutor (R$ / %)</th>}
                <th className="py-3 px-3 text-right">Rateio Líquido</th>
                <th className="py-3 px-4">Pagamento Adiantado (R$)</th>
                <th className="py-3 px-4 text-right">Diferença Pendente (+ / -)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {calculoRateio.linhas.map((item) => {
                const ded = dedutoresIndividuais[item.usuario.id] || {
                  valor: 0,
                  tipo: 'BRL' as const,
                  motivo: ''
                };
                const dif = item.diferencaPendente;
                const isParaMais = dif > 0.009;
                const isParaMenos = dif < -0.009;

                return (
                  <tr key={item.usuario.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <VisualAvatar name={item.usuario.nome} role={item.usuario.cargo} size="sm" />
                        <div>
                          <button
                            type="button"
                            onClick={() =>
                              onNavigateDeepLink({
                                tab: 'equipe',
                                entityId: item.usuario.id,
                                action: 'edit'
                              })
                            }
                            className="font-semibold text-slate-100 hover:text-amber-400 inline-flex items-center gap-1 transition-colors text-left cursor-pointer"
                          >
                            <span>{item.usuario.nome}</span>
                            <ArrowUpRight className="w-3 h-3 text-amber-400 shrink-0" />
                          </button>
                          <div className="text-[11px] text-slate-400">{item.usuario.cargo}</div>
                        </div>
                      </div>
                    </td>

                    {modoVisao === 'detalhada' && (
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-300">{item.unidadeNome}</span>
                          <span className="text-slate-600">·</span>
                          <span className="text-amber-300">{item.setorNome}</span>
                        </div>
                      </td>
                    )}

                    {modoVisao === 'detalhada' && (
                      <td className="py-3 px-3 text-center font-mono text-slate-300">
                        {item.diasTrabalhados}d
                      </td>
                    )}

                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-300">
                      {item.pesoAcumuladoPeriodo.toFixed(1)}x
                    </td>

                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-200">
                      {formatBRL(item.cotaBruta)}
                    </td>

                    {modoVisao === 'detalhada' && (
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1 max-w-[210px]">
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={ded.valor}
                            onChange={(e) =>
                              setDedutoresIndividuais((prev) => ({
                                ...prev,
                                [item.usuario.id]: { ...ded, valor: Number(e.target.value) }
                              }))
                            }
                            className="w-16 px-1.5 py-1 bg-[#0B0D11] border border-slate-800 rounded text-xs font-mono tabular-nums text-slate-100"
                          />
                          <select
                            value={ded.tipo}
                            onChange={(e) =>
                              setDedutoresIndividuais((prev) => ({
                                ...prev,
                                [item.usuario.id]: {
                                  ...ded,
                                  tipo: e.target.value as 'BRL' | 'PERC'
                                }
                              }))
                            }
                            className="px-1 py-1 bg-[#0B0D11] border border-slate-800 rounded text-xs font-mono text-amber-400"
                          >
                            <option value="BRL">R$</option>
                            <option value="PERC">%</option>
                          </select>
                          <input
                            type="text"
                            placeholder="Motivo"
                            value={ded.motivo}
                            onChange={(e) =>
                              setDedutoresIndividuais((prev) => ({
                                ...prev,
                                [item.usuario.id]: { ...ded, motivo: e.target.value }
                              }))
                            }
                            className="w-full px-1.5 py-1 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-300"
                          />
                        </div>
                      </td>
                    )}

                    <td className="py-3 px-3 text-right font-mono font-semibold tabular-nums text-amber-300">
                      {formatBRL(item.cotaLiquida)}
                    </td>

                    
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <div className="relative flex items-center">
                          <span className="text-[10px] font-mono text-slate-400 mr-1">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={item.valorAdiantado ? Number(item.valorAdiantado.toFixed(2)) : ''}
                            placeholder="0,00"
                            onChange={(e) =>
                              handleSetAdiantamentoDireto(
                                item.usuario.id,
                                Number(e.target.value || 0)
                              )
                            }
                            className="w-24 px-2 py-1 bg-[#0B0D11] border border-slate-700 rounded text-xs font-mono tabular-nums text-slate-100"
                            title="Digite o total adiantado no período para este colaborador"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setModalAdiantamentoUser(item.usuario);
                            setNovoAdiantamentoData(dataFimFiltro);
                            setNovoAdiantamentoValor('');
                            setNovoAdiantamentoObs('Adiantamento de Rateio');
                          }}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-amber-300 border border-slate-700 cursor-pointer whitespace-nowrap"
                          title="Gerenciar múltiplos lançamentos de adiantamento para este colaborador"
                        >
                          + Lançar ({item.adiantamentosColab.length})
                        </button>
                      </div>
                    </td>

                    
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                      {isParaMais ? (
                        <div className="inline-flex flex-col items-end">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-xs">
                            + {formatBRL(dif)}
                          </span>
                          <span className="text-[10px] text-emerald-400 mt-0.5">
                            A pagar ao colaborador (Para mais)
                          </span>
                        </div>
                      ) : isParaMenos ? (
                        <div className="inline-flex flex-col items-end">
                          <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold text-xs">
                            - {formatBRL(Math.abs(dif))}
                          </span>
                          <span className="text-[10px] text-rose-400 mt-0.5">
                            Adiantado a maior / Compensar (Para menos)
                          </span>
                        </div>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-slate-800/80 text-slate-400 text-[11px]">
                          {formatBRL(0)} (Quitado)
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

      
      <FocusFormModal
        open={Boolean(modalAdiantamentoUser)}
        title={`Pagamentos Adiantados de Rateio — ${modalAdiantamentoUser?.nome || ''}`}
        subtitle="Lance vales ou adiantamentos parciais de rateio para calcular automaticamente a diferença pendente (+ ou -)"
        onClose={() => setModalAdiantamentoUser(null)}
        onSave={() => setModalAdiantamentoUser(null)}
      >
        {modalAdiantamentoUser && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-lg bg-[#0B0D11] border border-slate-800">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Data do Adiantamento</label>
                <input
                  type="date"
                  value={novoAdiantamentoData}
                  onChange={(e) => setNovoAdiantamentoData(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#11151E] border border-slate-800 rounded text-xs font-mono text-slate-100"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Valor Adiantado (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={novoAdiantamentoValor}
                  onChange={(e) => setNovoAdiantamentoValor(e.target.value)}
                  placeholder="Ex: 150.00"
                  className="w-full px-2.5 py-1.5 bg-[#11151E] border border-slate-800 rounded text-xs font-mono text-slate-100"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Observação</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={novoAdiantamentoObs}
                    onChange={(e) => setNovoAdiantamentoObs(e.target.value)}
                    placeholder="Vale rateio..."
                    className="w-full px-2.5 py-1.5 bg-[#11151E] border border-slate-800 rounded text-xs text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={handleAdicionarAdiantamentoModal}
                    className="px-3 py-1.5 rounded bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer shrink-0"
                  >
                    + Incluir
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-300">
                Adiantamentos Registrados para {modalAdiantamentoUser.nome}
              </h4>
              <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg bg-[#0B0D11] max-h-60 overflow-y-auto">
                {adiantamentos
                  .filter((a) => Number(a.usuario_id) === Number(modalAdiantamentoUser.id))
                  .map((a) => (
                    <div
                      key={a.id}
                      className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <span className="font-mono text-amber-300 mr-2">{a.data}</span>
                        <span className="text-slate-200">{a.observacao}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-sky-300">
                          {formatBRL(a.valor)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoverAdiantamento(a.id)}
                          className="text-rose-400 hover:text-rose-300 text-[11px] font-semibold cursor-pointer"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ))}
                {adiantamentos.filter(
                  (a) => Number(a.usuario_id) === Number(modalAdiantamentoUser.id)
                ).length === 0 && (
                  <div className="p-4 text-center text-xs text-slate-500">
                    Nenhum pagamento adiantado lançado para este colaborador.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </FocusFormModal>

      
      <UrutauDateMultiView
        title="Histórico de Fechamentos Gravados por Data"
        items={data.rateiosHistorico || []}
        getDateISO={(h: any) => h.data}
        getTitle={(h: any) =>
          `Faturamento: ${formatBRL(h.faturamento_bruto)} • Pool (${h.percentual_pool}%): ${formatBRL(h.valor_pool)}`
        }
        getSubtitle={(h: any) =>
          Array.isArray(h.detalhes_json)
            ? `${h.detalhes_json.length} colaboradores contemplados no rateio`
            : 'Fechamento de rateio gravado'
        }
        getBadge={(h: any) => ({
          text: `${h.percentual_pool}% Pool`,
          colorClass: 'text-amber-400'
        })}
        getRightMeta={(h: any) => formatBRL(h.valor_pool)}
        initialDateISO={dataFimFiltro}
        onSelectedDateChange={(iso) => {
          setDataInicioFiltro(iso);
          setDataFimFiltro(iso);
        }}
        onEditItem={(h: any) => {
          setDataInicioFiltro(h.data);
          setDataFimFiltro(h.data);
          setPercentualPool(Number(h.percentual_pool ?? 10));
          setFaturamentoManual(String(h.faturamento_bruto || ''));
          showAlert(
            'Fechamento Carregado para Edição',
            `Os parâmetros do fechamento de ${h.data} (${h.percentual_pool}% sobre ${formatBRL(h.faturamento_bruto)}) foram carregados no painel superior para revisão ou regravação.`
          );
        }}
        onCreateAtDate={(iso) => {
          setDataInicioFiltro(iso);
          setDataFimFiltro(iso);
        }}
        createButtonLabel="Apurar Nesta Data"
      />
    </div>
  );
}

export function EscalasTab({
  data,
  onRefresh,
  onNavigateDeepLink,
  showAlert,
  showConfirm,
  currentUser
}: CommonTabProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editMovId, setEditMovId] = useState<number | null>(null);
  const [tipoMov, setTipoMov] = useState('Reforço');
  const [dataMov, setDataMov] = useState(getTodayISO());
  const [motivoMov, setMotivoMov] = useState('');
  const [unidadeMov, setUnidadeMov] = useState<number>(1);
  const [setorMov, setSetorMov] = useState<number>(1);
  const [usuariosSelecionadosLote, setUsuariosSelecionadosLote] = useState<number[]>([]);
  const [criandoSetorEscala, setCriandoSetorEscala] = useState(false);
  const [novoSetorEscalaNome, setNovoSetorEscalaNome] = useState('');
  const [salvandoSetorEscala, setSalvandoSetorEscala] = useState(false);

  const unidadesPermitidas = useMemo(
    () => getUnidadesPermitidasUsuario(data, currentUser),
    [data, currentUser]
  );
  const [filtroUnidadesIds, setFiltroUnidadesIds] = useState<number[]>([]);
  const effectiveUnidadesIds = useMemo(() => {
    const allIds = unidadesPermitidas.map((u: any) => Number(u.id));
    if (filtroUnidadesIds.length === 0) return allIds;
    const valid = filtroUnidadesIds.filter((id) => allIds.includes(Number(id)));
    return valid.length > 0 ? valid : allIds;
  }, [unidadesPermitidas, filtroUnidadesIds]);

  const [filtroTiposMov, setFiltroTiposMov] = useState<string[]>([]);
  const [filtroColabsIds, setFiltroColabsIds] = useState<string[]>([]);
  const [filtroSetoresIds, setFiltroSetoresIds] = useState<number[]>([]);
  const [filtroDiasSemana, setFiltroDiasSemana] = useState<number[]>([]);

  const handleOpenNew = (tipoPadrao = 'Reforço', dataInicial?: string) => {
    setEditMovId(null);
    setTipoMov(tipoPadrao);
    setDataMov(dataInicial || getTodayISO());
    setMotivoMov('');
    setUnidadeMov(effectiveUnidadesIds[0] || data.unidades[0]?.id || 1);
    setSetorMov(data.setores[0]?.id || 1);
    setUsuariosSelecionadosLote([]);
    setModalOpen(true);
  };

  const handleOpenEditMov = (m: any) => {
    setEditMovId(m.id);
    setTipoMov(m.tipo || 'Reforço');
    setDataMov(m.data || getTodayISO());
    setMotivoMov(m.motivo || '');
    setUnidadeMov(Number(m.unidade_id || effectiveUnidadesIds[0] || data.unidades[0]?.id || 1));
    setSetorMov(Number(m.setor_id || data.setores[0]?.id || 1));
    setUsuariosSelecionadosLote(m.usuario_id ? [Number(m.usuario_id)] : []);
    setModalOpen(true);
  };

  const toggleUsuarioLote = (uid: number) => {
    setUsuariosSelecionadosLote((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleSalvarMovimento = async () => {
    if (usuariosSelecionadosLote.length === 0) {
      showAlert('Seleção Obrigatória', 'Selecione ao menos um colaborador para aplicar o movimento de escala.');
      return;
    }
    try {
      const res = await fetch('/api/v46/escala/salvar-movimento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editMovId,
          tipo: tipoMov,
          usuario_id: usuariosSelecionadosLote[0],
          usuarios_lote: usuariosSelecionadosLote,
          data: dataMov,
          motivo: motivoMov,
          unidade_id: unidadeMov,
          setor_id: setorMov
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || 'Erro ao gravar movimento de escala');
      setModalOpen(false);
      await onRefresh();
    } catch (e: any) {
      showAlert('Erro na Escala', e.message);
    }
  };

  const handleArquivarMovimento = (id: number) => {
    showConfirm(
      'Arquivar Movimento de Escala (Soft-Delete)',
      'Deseja arquivar legalmente (arquivado_legal = TRUE) esta exceção de escala?',
      async () => {
        await fetch('/api/erp/arquivar-generico', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, tabelaAlvo: 'erp_escalas_movimentos' })
        });
        setModalOpen(false);
        await onRefresh();
      }
    );
  };

  const usuariosMatrizFiltrados = useMemo(() => {
    const relUnidade = data.relacionamentos.rel_usuario_unidade || [];
    const relSetor = data.relacionamentos.rel_usuario_setor || [];

    return data.usuarios.filter((u) => {
      if (filtroColabsIds.length > 0 && !filtroColabsIds.includes(String(u.id))) {
        return false;
      }
      const unidPadrao =
        relUnidade.find((r) => Number(r.usuario_id) === Number(u.id))?.unidade_id || 1;
      if (effectiveUnidadesIds.length > 0 && !effectiveUnidadesIds.includes(Number(unidPadrao))) {
        return false;
      }
      const setorPadrao =
        relSetor.find((r) => Number(r.usuario_id) === Number(u.id))?.setor_id || 1;
      if (filtroSetoresIds.length > 0 && !filtroSetoresIds.includes(Number(setorPadrao))) {
        return false;
      }
      if (filtroDiasSemana.length > 0) {
        const diasAtivos = data.escalaFixa[u.id] || [];
        const atendeDia = filtroDiasSemana.some((d) => diasAtivos.includes(d));
        if (!atendeDia) return false;
      }
      return true;
    });
  }, [data, filtroColabsIds, effectiveUnidadesIds, filtroSetoresIds, filtroDiasSemana]);

  const diasSemanaVisiveis = useMemo(() => {
    if (filtroDiasSemana.length === 0) return DIAS_SEMANA;
    return DIAS_SEMANA.filter((d) => filtroDiasSemana.includes(d.idx));
  }, [filtroDiasSemana]);

  return (
    <div className="space-y-6 w-full">
      <div className="bg-[#11151E] border border-slate-800/90 rounded-lg p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-slate-100">
            Escalas
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenNew('Reforço')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Lançar Reforço em Lote / Exceção</span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenNew('Lotação Temporária')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded transition-colors cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Alterar Lotação Temporária</span>
            </button>
          </div>
        </div>

        
        <UnidadesMultiSelectControl
          unidadesPermitidas={unidadesPermitidas}
          selectedUnidadesIds={effectiveUnidadesIds}
          onChangeSelectedIds={setFiltroUnidadesIds}
          label="Unidades da Escala"
        />

        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-800/80">
          
          <div className="p-2.5 rounded-lg bg-[#0B0D11] border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-amber-300 font-bold">
                Filtrar Setores (Checkbox):
              </span>
              {filtroSetoresIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFiltroSetoresIds([])}
                  className="text-[10px] text-slate-400 hover:text-white cursor-pointer"
                >
                  Limpar
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <label className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#11151E] border border-slate-800 text-[11px] text-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filtroSetoresIds.length === 0}
                  onChange={() => setFiltroSetoresIds([])}
                  className="w-3 h-3 accent-amber-500 rounded cursor-pointer"
                />
                <span>Todos</span>
              </label>
              {data.setores.map((s) => {
                const sid = Number(s.id);
                const checked = filtroSetoresIds.includes(sid);
                return (
                  <label
                    key={sid}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] cursor-pointer select-none ${
                      checked
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 font-semibold'
                        : 'bg-[#11151E]/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setFiltroSetoresIds((prev) =>
                          prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]
                        )
                      }
                      className="w-3 h-3 accent-amber-500 rounded cursor-pointer"
                    />
                    <span>{s.nome}</span>
                  </label>
                );
              })}
            </div>
          </div>

          
          <div className="p-2.5 rounded-lg bg-[#0B0D11] border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-amber-300 font-bold">
                Filtrar Dias da Semana (Checkbox):
              </span>
              {filtroDiasSemana.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFiltroDiasSemana([])}
                  className="text-[10px] text-slate-400 hover:text-white cursor-pointer"
                >
                  Limpar
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <label className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#11151E] border border-slate-800 text-[11px] text-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filtroDiasSemana.length === 0}
                  onChange={() => setFiltroDiasSemana([])}
                  className="w-3 h-3 accent-amber-500 rounded cursor-pointer"
                />
                <span>Todos</span>
              </label>
              {DIAS_SEMANA.map((d) => {
                const checked = filtroDiasSemana.includes(d.idx);
                return (
                  <label
                    key={d.idx}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] cursor-pointer select-none ${
                      checked
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 font-semibold'
                        : 'bg-[#11151E]/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setFiltroDiasSemana((prev) =>
                          prev.includes(d.idx) ? prev.filter((x) => x !== d.idx) : [...prev, d.idx]
                        )
                      }
                      className="w-3 h-3 accent-amber-500 rounded cursor-pointer"
                    />
                    <span>{d.curto}</span>
                  </label>
                );
              })}
            </div>
          </div>

          
          <div className="p-2.5 rounded-lg bg-[#0B0D11] border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-amber-300 font-bold">
                Filtrar Colaboradores (Checkbox):
              </span>
              {filtroColabsIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFiltroColabsIds([])}
                  className="text-[10px] text-slate-400 hover:text-white cursor-pointer"
                >
                  Limpar
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
              <label className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#11151E] border border-slate-800 text-[11px] text-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filtroColabsIds.length === 0}
                  onChange={() => setFiltroColabsIds([])}
                  className="w-3 h-3 accent-amber-500 rounded cursor-pointer"
                />
                <span>Todos</span>
              </label>
              {data.usuarios.map((u) => {
                const uidStr = String(u.id);
                const checked = filtroColabsIds.includes(uidStr);
                return (
                  <label
                    key={uidStr}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] cursor-pointer select-none ${
                      checked
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 font-semibold'
                        : 'bg-[#11151E]/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setFiltroColabsIds((prev) =>
                          prev.includes(uidStr)
                            ? prev.filter((x) => x !== uidStr)
                            : [...prev, uidStr]
                        )
                      }
                      className="w-3 h-3 accent-amber-500 rounded cursor-pointer"
                    />
                    <span>{u.nome.split(' ')[0]}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      
      <div className="bg-[#11151E] border border-slate-800/90 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">
            Escala Semanal ({usuariosMatrizFiltrados.length} colaboradores)
          </h3>
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className="inline-flex items-center gap-1 text-emerald-400">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 inline-flex items-center justify-center font-bold"></span>
              Ativo
            </span>
            <span className="inline-flex items-center gap-1 text-slate-400">
              <span className="w-5 h-5 rounded-full bg-slate-800/80 border border-slate-700 inline-flex items-center justify-center"></span>
              Folga
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-[#0D1017] text-[11px] font-mono uppercase text-slate-400">
                <th className="py-3 px-4">Colaborador</th>
                {diasSemanaVisiveis.map((d) => (
                  <th key={d.idx} className="py-3 px-3 text-center">
                    {d.curto}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {usuariosMatrizFiltrados.map((u) => {
                const diasAtivos = data.escalaFixa[u.id] || [];
                return (
                  <tr key={u.id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <VisualAvatar name={u.nome} role={u.cargo} size="sm" />
                        <div>
                          <button
                            type="button"
                            onClick={() =>
                              onNavigateDeepLink({ tab: 'equipe', entityId: u.id, action: 'edit' })
                            }
                            className="font-semibold text-slate-100 hover:text-amber-400 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span>{u.nome}</span>
                            <ArrowUpRight className="w-3 h-3 text-amber-400" />
                          </button>
                          <div className="text-[11px] text-slate-400">{u.cargo}</div>
                        </div>
                      </div>
                    </td>
                    {diasSemanaVisiveis.map((d) => {
                      const escalado = diasAtivos.includes(d.idx);
                      return (
                        <td key={d.idx} className="py-2.5 px-3 text-center font-mono">
                          <span
                            title={escalado ? 'Escalado (Ativo)' : 'Folga Semanal'}
                            className={`w-7 h-7 rounded-full inline-flex items-center justify-center text-xs font-bold transition-transform ${
                              escalado
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : 'bg-slate-900/60 text-slate-500 border border-slate-800'
                            }`}
                          >
                            {escalado ? '' : ''}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      
      <UrutauDateMultiView
        title="Movimentos de Escala, Reforços e Lotações por Data"
        items={(data.movimentosEscala || []).filter((m: any) => {
          if (effectiveUnidadesIds.length > 0 && m.unidade_id && !effectiveUnidadesIds.includes(Number(m.unidade_id))) {
            return false;
          }
          if (filtroTiposMov.length > 0 && !filtroTiposMov.includes(String(m.tipo))) return false;
          if (filtroColabsIds.length > 0 && !filtroColabsIds.includes(String(m.usuario_id))) return false;
          if (filtroSetoresIds.length > 0 && m.setor_id && !filtroSetoresIds.includes(Number(m.setor_id))) return false;
          return true;
        })}
        getDateISO={(m: any) => m.data}
        getTitle={(m: any) => {
          const colab = data.usuarios.find((u) => Number(u.id) === Number(m.usuario_id));
          return `${m.tipo} — ${colab?.nome || `Colaborador #${m.usuario_id}`}`;
        }}
        getSubtitle={(m: any) => {
          const unid = data.unidades.find((u) => Number(u.id) === Number(m.unidade_id));
          const set = data.setores.find((s) => Number(s.id) === Number(m.setor_id));
          return `${unid?.nome || 'Unidade Padrão'} · ${set?.nome || 'Setor Padrão'}${m.motivo ? ` — ${m.motivo}` : ''}`;
        }}
        getBadge={(m: any) => ({
          text: m.tipo,
          colorClass:
            m.tipo === 'Reforço' || m.tipo === 'Lotação Temporária'
              ? 'text-emerald-400'
              : 'text-amber-400'
        })}
        onEditItem={(m: any) => handleOpenEditMov(m)}
        onCreateAtDate={(iso: string) => handleOpenNew('Reforço', iso)}
        createButtonLabel="Novo Movimento"
        criteriaFilters={[
          {
            id: 'tipo',
            label: 'Modalidades',
            value: 'TODOS',
            onChange: () => {},
            multiSelect: true,
            selectedValues: filtroTiposMov,
            onMultiChange: setFiltroTiposMov,
            options: [
              { value: 'TODOS', label: 'Todas' },
              { value: 'Reforço', label: 'Reforço' },
              { value: 'Lotação Temporária', label: 'Lotação Temporária' },
              { value: 'Folga Extra', label: 'Folga Extra' },
              { value: 'Falta', label: 'Falta / Ausência' },
              { value: 'Atestado', label: 'Atestado Médico' }
            ]
          },
          {
            id: 'colab',
            label: 'Colaboradores',
            value: 'TODOS',
            onChange: () => {},
            multiSelect: true,
            selectedValues: filtroColabsIds,
            onMultiChange: setFiltroColabsIds,
            options: [
              { value: 'TODOS', label: 'Todos' },
              ...data.usuarios.map((u) => ({ value: String(u.id), label: u.nome.split(' ')[0] }))
            ]
          }
        ]}
      />

      <FocusFormModal
        open={modalOpen}
        title="Lançamento de Escala, Reforço em Lote ou Lotação Temporária"
        subtitle="Selecione um ou múltiplos colaboradores para aplicar a regra com reflexo imediato no Rateio"
        onClose={() => setModalOpen(false)}
        onSave={handleSalvarMovimento}
        onArchive={editMovId ? () => handleArquivarMovimento(editMovId) : undefined}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Modalidade do Movimento</label>
            <select
              value={tipoMov}
              onChange={(e) => setTipoMov(e.target.value)}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
            >
              <option value="Reforço">Reforço (Escala Extra / Lote)</option>
              <option value="Lotação Temporária">Alteração Temporária de Lotação</option>
              <option value="Folga Extra">Folga Extra / Compensação</option>
              <option value="Falta">Ausência / Falta</option>
              <option value="Atestado">Atestado Médico (NR-01)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Data de Vigência</label>
            <input
              type="date"
              value={dataMov}
              onChange={(e) => setDataMov(e.target.value)}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs font-mono text-slate-100"
            />
          </div>

          {unidadesPermitidas.length > 1 && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Unidade de Destino (Lotação)</label>
              <select
                value={unidadeMov}
                onChange={(e) => setUnidadeMov(Number(e.target.value))}
                className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
              >
                {unidadesPermitidas.map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label className="block text-xs text-slate-400">Setor de Destino</label>
              <button
                type="button"
                onClick={() => setCriandoSetorEscala((v) => !v)}
                className="text-[11px] font-bold text-[#10B981] hover:text-[#34D399] cursor-pointer"
              >
                {criandoSetorEscala ? 'Cancelar' : '+ Criar Setor'}
              </button>
            </div>
            <select
              value={setorMov}
              onChange={(e) => {
                if (e.target.value === '__NEW_SETOR__') {
                  setCriandoSetorEscala(true);
                  return;
                }
                setSetorMov(Number(e.target.value));
              }}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
            >
              {data.setores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
              <option value="__NEW_SETOR__">+ Criar novo setor...</option>
            </select>
            {criandoSetorEscala && (
              <div className="mt-2 p-2.5 rounded-lg bg-[#071712] border border-[#10B981]/40 flex items-center gap-2">
                <input
                  type="text"
                  value={novoSetorEscalaNome}
                  onChange={(e) => setNovoSetorEscalaNome(e.target.value)}
                  placeholder="Nome do novo setor..."
                  className="flex-1 px-2.5 py-1.5 bg-[#05100C] border border-slate-700 rounded text-xs text-white"
                />
                <button
                  type="button"
                  disabled={salvandoSetorEscala}
                  onClick={async () => {
                    const n = novoSetorEscalaNome.trim();
                    if (!n) return;
                    setSalvandoSetorEscala(true);
                    try {
                      const res = await fetch('/api/setores/salvar', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ nome: n, peso_rateio: 1.0 })
                      });
                      const json = await res.json();
                      if (res.ok && json.id) {
                        setNovoSetorEscalaNome('');
                        setCriandoSetorEscala(false);
                        await onRefresh();
                        setSetorMov(Number(json.id));
                      }
                    } finally {
                      setSalvandoSetorEscala(false);
                    }
                  }}
                  className="px-3 py-1.5 rounded bg-[#10B981] text-[#05100C] text-xs font-bold cursor-pointer shrink-0"
                >
                  {salvandoSetorEscala ? '...' : 'Criar'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <label className="block text-xs text-slate-400">
              Seleção de Colaboradores (Suporte a Reforço em Lote — {usuariosSelecionadosLote.length} selecionados)
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setUsuariosSelecionadosLote(data.usuarios.map((u) => u.id))}
                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/40 cursor-pointer"
              >
                 Marcar Todos
              </button>
              <button
                type="button"
                onClick={() => setUsuariosSelecionadosLote([])}
                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                 Desmarcar Todos
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto p-3 bg-[#0B0D11] border border-slate-800 rounded">
            {data.usuarios.map((u) => {
              const checked = usuariosSelecionadosLote.includes(u.id);
              return (
                <label
                  key={u.id}
                  className={`flex items-center gap-2.5 p-2 rounded border cursor-pointer text-xs transition-colors ${
                    checked
                      ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                      : 'border-slate-800 text-slate-300 hover:bg-slate-800/40'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleUsuarioLote(u.id)}
                    className="accent-amber-500"
                  />
                  <div>
                    <div className="font-medium">{u.nome}</div>
                    <div className="text-[11px] text-slate-400">{u.cargo}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Motivo / Justificativa Operacional</label>
          <textarea
            rows={3}
            value={motivoMov}
            onChange={(e) => setMotivoMov(e.target.value)}
            placeholder="Descreva o motivo do reforço, cobertura de turno ou alteração temporária de lotação..."
            className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
          />
        </div>
      </FocusFormModal>
    </div>
  );
}

export function AgendaTab({
  data,
  onRefresh,
  onNavigateDeepLink,
  showAlert,
  showConfirm
}: CommonTabProps) {
  const [dataSelecionada, setDataSelecionada] = useState(getTodayISO());
  const [modoCalendario, setModoCalendario] = useState<'mensal' | 'semanal'>('mensal');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<any>({
    id: null,
    titulo: '',
    data: getTodayISO(),
    hora: '19:00',
    tipo: 'Operacional',
    descricao: '',
    unidade_id: 1,
    setor_id: 1,
    usuario_id: 1,
    concluido: false
  });

  const diaSemana = getDayOfWeekFromISO(dataSelecionada);

  const resumoEscalaDoDia = useMemo(() => {
    const movs = data.movimentosEscala.filter((m) => m.data === dataSelecionada);
    return data.usuarios.map((u) => {
      const fixos = data.escalaFixa[u.id] || [];
      const mov = movs.find((m) => Number(m.usuario_id) === Number(u.id));
      const ativo = mov
        ? mov.tipo === 'Reforço' || mov.tipo === 'Lotação Temporária'
        : fixos.includes(diaSemana);
      return {
        usuario: u,
        status: mov ? mov.tipo : ativo ? 'Escalado' : 'Folga Semanal',
        ativo
      };
    });
  }, [data, dataSelecionada, diaSemana]);

  const handleOpenEvent = (ev?: any) => {
    if (ev) {
      setForm({ ...ev });
    } else {
      setForm({
        id: null,
        titulo: '',
        data: dataSelecionada,
        hora: '19:00',
        tipo: 'Operacional',
        descricao: '',
        unidade_id: data.unidades[0]?.id || 1,
        setor_id: data.setores[0]?.id || 1,
        usuario_id: data.usuarios[0]?.id || 1,
        concluido: false
      });
    }
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const res = await fetch('/api/agenda/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || 'Erro ao salvar evento');
      setModalOpen(false);
      await onRefresh();
    } catch (e: any) {
      showAlert('Erro na Agenda', e.message);
    }
  };

  const handleArchive = (id: number) => {
    showConfirm('Arquivar Evento da Agenda', 'Confirma o arquivamento lógico desta tarefa?', async () => {
      await fetch('/api/agenda/arquivar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      setModalOpen(false);
      await onRefresh();
    });
  };

  const [filtroStatusAgenda, setFiltroStatusAgenda] = useState<string>('todos');
  const [filtroRespAgenda, setFiltroRespAgenda] = useState<string>('0');

  return (
    <div className="space-y-6 w-full">
      <div className="w-full">
        <UrutauDateMultiView
          title="Agenda & Cronograma de Tarefas"
          items={(data.agenda || []).filter((ev: any) => {
            if (filtroStatusAgenda === 'pendentes' && ev.concluido) return false;
            if (filtroStatusAgenda === 'concluidas' && !ev.concluido) return false;
            if (filtroRespAgenda !== '0' && String(ev.usuario_id) !== filtroRespAgenda) return false;
            return true;
          })}
          getDateISO={(ev: any) => ev.data}
          getTitle={(ev: any) => `${ev.hora ? `${ev.hora} — ` : ''}${ev.titulo}`}
          getSubtitle={(ev: any) => {
            const resp = data.usuarios.find((u) => Number(u.id) === Number(ev.usuario_id));
            return `${ev.descricao || 'Sem descrição'}${resp ? ` • Resp: ${resp.nome}` : ''}`;
          }}
          getBadge={(ev: any) => ({
            text: ev.concluido ? 'CONCLUÍDA' : 'PENDENTE',
            colorClass: ev.concluido ? 'text-emerald-400' : 'text-amber-400'
          })}
          getRightMeta={(ev: any) => ev.tipo || 'Operacional'}
          initialDateISO={dataSelecionada}
          onSelectedDateChange={(iso) => setDataSelecionada(iso)}
          onEditItem={(ev: any) => handleOpenEvent(ev)}
          onCreateAtDate={(iso: string) => {
            setDataSelecionada(iso);
            setForm({
              id: null,
              titulo: '',
              data: iso,
              hora: '19:00',
              tipo: 'Operacional',
              descricao: '',
              unidade_id: data.unidades[0]?.id || 1,
              setor_id: data.setores[0]?.id || 1,
              usuario_id: data.usuarios[0]?.id || 1,
              concluido: false
            });
            setModalOpen(true);
          }}
          createButtonLabel="Nova Tarefa"
          criteriaFilters={[
            {
              id: 'status',
              label: 'Status',
              value: filtroStatusAgenda,
              onChange: setFiltroStatusAgenda,
              options: [
                { value: 'todos', label: 'Todas' },
                { value: 'pendentes', label: 'Pendentes' },
                { value: 'concluidas', label: 'Concluídas' }
              ]
            },
            {
              id: 'resp',
              label: 'Responsável',
              value: filtroRespAgenda,
              onChange: setFiltroRespAgenda,
              options: [
                { value: '0', label: 'Todos' },
                ...data.usuarios.map((u) => ({ value: String(u.id), label: u.nome }))
              ]
            }
          ]}
        />
      </div>

      <div className="w-full bg-[#11151E] border border-slate-800/90 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">
            Resumo da Escala do Dia ({dataSelecionada})
          </h3>
          <span className="text-xs font-mono text-amber-400">
            {DIAS_SEMANA[diaSemana]?.curto}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-800/60">
          {resumoEscalaDoDia.map((r) => (
            <div key={r.usuario.id} className="px-4 py-3 flex items-center justify-between text-xs">
              <div>
                <button
                  type="button"
                  onClick={() =>
                    onNavigateDeepLink({ tab: 'equipe', entityId: r.usuario.id, action: 'edit' })
                  }
                  className="font-medium text-slate-200 hover:text-amber-400"
                >
                  {r.usuario.nome}
                </button>
                <div className="text-[11px] text-slate-400">{r.usuario.cargo}</div>
              </div>
              <span
                className={`font-mono text-[11px] ${
                  r.ativo ? 'text-emerald-400 font-semibold' : 'text-slate-500'
                }`}
              >
                {r.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      <FocusFormModal
        open={modalOpen}
        title={form.id ? 'Editar Tarefa / Evento' : 'Nova Tarefa na Agenda'}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onArchive={form.id ? () => handleArchive(form.id) : undefined}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-400 mb-1">Título da Tarefa</label>
            <input
              type="text"
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Data</label>
            <input
              type="date"
              value={form.data}
              onChange={(e) => setForm({ ...form, data: e.target.value })}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs font-mono text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Horário</label>
            <input
              type="time"
              value={form.hora}
              onChange={(e) => setForm({ ...form, hora: e.target.value })}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs font-mono text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Responsável</label>
            <select
              value={form.usuario_id}
              onChange={(e) => setForm({ ...form, usuario_id: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
            >
              {data.usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center pt-5">
            <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={!!form.concluido}
                onChange={(e) => setForm({ ...form, concluido: e.target.checked })}
                className="accent-amber-500"
              />
              <span>Marcar tarefa como Concluída</span>
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-400 mb-1">Descrição Operacional</label>
            <textarea
              rows={3}
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
            />
          </div>
        </div>
      </FocusFormModal>
    </div>
  );
}

export function ReservasTab({
  data,
  onRefresh,
  onNavigateDeepLink,
  showAlert,
  showConfirm,
  deepLinkEntityId,
  clearDeepLink,
  currentUser
}: CommonTabProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [areaFiltro, setAreaFiltro] = useState('Todas');
  const [form, setForm] = useState<any>({
    id: null,
    cliente: '',
    whatsapp: '',
    data: getTodayISO(),
    hora: '20:00',
    mesa: '',
    mesas_vinculadas: [],
    area: 'Salão Principal',
    adultos_pagantes: 2,
    adultos_frequentadores: 0,
    criancas_pagantes: 0,
    criancas_frequentadores: 0,
    status: 'Confirmada',
    observacoes: '',
    unidade_id: 1,
    nova_mesa_criada: null
  });

  const [criandoMesaInline, setCriandoMesaInline] = useState(false);
  const [novaMesaForm, setNovaMesaForm] = useState<{
    codigo: string;
    lugares: number;
    formato: 'quadrada' | 'redonda' | 'retangular';
    ambienteNome: string;
  }>({
    codigo: '',
    lugares: 4,
    formato: 'quadrada',
    ambienteNome: 'Salão Principal'
  });

  const [criandoAmbienteInline, setCriandoAmbienteInline] = useState(false);
  const [novoAmbienteNome, setNovoAmbienteNome] = useState('');

  const [optionsSyncTick, setOptionsSyncTick] = useState(0);

  useEffect(() => {
    const handleSync = () => setOptionsSyncTick((t) => t + 1);
    window.addEventListener('urutau-floor-plan-updated', handleSync);
    window.addEventListener('urutau-select-options-updated', handleSync);
    return () => {
      window.removeEventListener('urutau-floor-plan-updated', handleSync);
      window.removeEventListener('urutau-select-options-updated', handleSync);
    };
  }, []);

  const floorPlanMeta = useMemo(() => {
    void optionsSyncTick;
    const defaultTables = [
      { codigo: 'M-01', ambienteNome: 'Salão Principal', lugares: 4 },
      { codigo: 'M-02', ambienteNome: 'Salão Principal', lugares: 2 },
      { codigo: 'M-03', ambienteNome: 'Salão Principal', lugares: 4 },
      { codigo: 'M-04', ambienteNome: 'Salão Principal', lugares: 3 },
      { codigo: 'M-05', ambienteNome: 'Salão Principal', lugares: 4 },
      { codigo: 'M-06', ambienteNome: 'Salão Principal', lugares: 2 },
      { codigo: 'V-01', ambienteNome: 'Varanda Cumaru', lugares: 2 },
      { codigo: 'V-02', ambienteNome: 'Varanda Cumaru', lugares: 3 },
      { codigo: 'V-03', ambienteNome: 'Varanda Cumaru', lugares: 4 },
      { codigo: 'VIP-01', ambienteNome: 'Sala VIP Copaíba', lugares: 4 },
      { codigo: 'VIP-02', ambienteNome: 'Sala VIP Copaíba', lugares: 4 }
    ];
    const defaultAreas = ['Salão Principal', 'Varanda Cumaru', 'Sala VIP Copaíba'];
    const defaultStatuses = [
      { value: 'Confirmada', label: 'Confirmada' },
      { value: 'Sentada', label: 'Sentada no Salão' },
      { value: 'Lista de Espera', label: 'Lista de Espera' },
      { value: 'Encerrada', label: 'Encerrada' }
    ];

    let tables = [...defaultTables];
    let areas = [...defaultAreas];
    try {
      const serverPlan = (data.configs || []).find((c) => c.chave === 'mapa_mesas_salao_layout')?.valor_json;
      const raw = localStorage.getItem('urutau_reservas_floor_plan_v2');
      const parsed = raw ? JSON.parse(raw) : serverPlan;
      if (parsed) {
        if (Array.isArray(parsed?.tables) && parsed.tables.length > 0) {
          tables = parsed.tables.map((t: any) => ({
            codigo: String(t.codigo || '').trim(),
            ambienteNome: String(t.ambienteNome || 'Salão Principal').trim(),
            lugares: Number(t.lugares || 4)
          })).filter((t: any) => t.codigo);
        }
        if (Array.isArray(parsed?.environments) && parsed.environments.length > 0) {
          parsed.environments.forEach((env: any) => {
            if (env.tipoZona && env.tipoZona !== 'ambiente') return;
            const n = String(env.nome || '').trim();
            if (n && !areas.includes(n)) areas.push(n);
          });
        }
      }
      const rawCustom = localStorage.getItem('urutau_custom_select_options_v1');
      if (rawCustom) {
        const customMap = JSON.parse(rawCustom);
        if (Array.isArray(customMap?.mesa)) {
          customMap.mesa.forEach((opt: any) => {
            const code = String(opt.value || opt.label || '').trim();
            if (code && !tables.some((t) => t.codigo === code)) {
              tables.push({
                codigo: code,
                ambienteNome: String(opt.meta?.ambiente || 'Salão Principal'),
                lugares: Number(opt.meta?.lugares || 4)
              });
            }
          });
        }
        if (Array.isArray(customMap?.ambiente)) {
          customMap.ambiente.forEach((opt: any) => {
            const areaName = String(opt.value || opt.label || '').trim();
            if (areaName && !areas.includes(areaName)) areas.push(areaName);
          });
        }
        if (Array.isArray(customMap?.status_reserva)) {
          customMap.status_reserva.forEach((opt: any) => {
            const val = String(opt.value || opt.label || '').trim();
            if (val && !defaultStatuses.some((s) => s.value === val)) {
              defaultStatuses.push({ value: val, label: String(opt.label || val) });
            }
          });
        }
      }
    } catch {}

    (data.reservas || []).forEach((r: any) => {
      const m = String(r.mesa || '').trim();
      if (m && !tables.some((t) => t.codigo === m)) {
        tables.push({ codigo: m, ambienteNome: r.area || 'Salão Principal', lugares: 4 });
      }
      const a = String(r.area || '').trim();
      if (a && !areas.includes(a)) areas.push(a);
      const s = String(r.status || '').trim();
      if (s && !defaultStatuses.some((st) => st.value === s)) {
        defaultStatuses.push({ value: s, label: s });
      }
    });

    if (form.mesa && !tables.some((t) => t.codigo === form.mesa)) {
      tables.push({ codigo: form.mesa, ambienteNome: form.area || 'Salão Principal', lugares: 4 });
    }
    if (form.area && !areas.includes(form.area)) {
      areas.push(form.area);
    }
    if (form.status && !defaultStatuses.some((s) => s.value === form.status)) {
      defaultStatuses.push({ value: form.status, label: form.status });
    }

    return { tables, areas, statuses: defaultStatuses };
  }, [optionsSyncTick, data.reservas, form.mesa, form.area, form.status]);

  useEffect(() => {
    if (deepLinkEntityId) {
      const alvo = data.reservas.find((r) => Number(r.id) === Number(deepLinkEntityId));
      if (alvo) {
        setForm({ ...alvo });
        setModalOpen(true);
      }
      clearDeepLink();
    }
  }, [deepLinkEntityId, data.reservas, clearDeepLink]);

  const totaisSalao = useMemo(() => {
    return data.reservas.reduce(
      (acc, r) => {
        const ap = Number(r.adultos_pagantes || 0);
        const af = Number(r.adultos_frequentadores || 0);
        const cp = Number(r.criancas_pagantes || 0);
        const cf = Number(r.criancas_frequentadores || 0);
        acc.adultosPag += ap;
        acc.adultosFreq += af;
        acc.kidsPag += cp;
        acc.kidsFreq += cf;
        acc.totalPagantes += ap + cp;
        acc.totalFrequentadoresIsentos += af + cf;
        acc.totalGeral += ap + af + cp + cf;
        return acc;
      },
      {
        adultosPag: 0,
        adultosFreq: 0,
        kidsPag: 0,
        kidsFreq: 0,
        totalPagantes: 0,
        totalFrequentadoresIsentos: 0,
        totalGeral: 0
      }
    );
  }, [data.reservas]);

  const handleOpenReserva = (r?: any) => {
    setCriandoMesaInline(false);
    setCriandoAmbienteInline(false);
    if (r) {
      const mesaStr = String(r.mesa || '').trim();
      const vinc =
        Array.isArray(r.mesas_vinculadas) && r.mesas_vinculadas.length > 0
          ? r.mesas_vinculadas.map((m: any) => String(m || '').trim()).filter(Boolean)
          : mesaStr
          ? [mesaStr]
          : [];
      setForm({ ...r, mesa: mesaStr, mesas_vinculadas: vinc, nova_mesa_criada: null });
    } else {
      setForm({
        id: null,
        cliente: '',
        whatsapp: '',
        data: getTodayISO(),
        hora: '20:00',
        mesa: '',
        mesas_vinculadas: [],
        area: 'Salão Principal',
        adultos_pagantes: 2,
        adultos_frequentadores: 0,
        criancas_pagantes: 0,
        criancas_frequentadores: 0,
        status: 'Confirmada',
        observacoes: '',
        unidade_id: Number(data.unidades?.[0]?.id || 1),
        nova_mesa_criada: null
      });
    }
    setModalOpen(true);
  };

  const handleCriarMesaInline = () => {
    const cod = String(novaMesaForm.codigo || '').trim().toUpperCase();
    if (!cod) {
      showAlert('Código da Mesa Obrigatório', 'Informe o código ou identificador da nova mesa (ex: M-15, VIP-03, Bistrô 1).');
      return;
    }
    const amb = String(novaMesaForm.ambienteNome || form.area || 'Salão Principal').trim();
    const lug = Math.min(200, Math.max(1, Number(novaMesaForm.lugares || 4)));
    const fmt = novaMesaForm.formato || 'quadrada';

    try {
      const rawCustom = localStorage.getItem('urutau_custom_select_options_v1');
      const customMap = rawCustom ? JSON.parse(rawCustom) : {};
      if (!Array.isArray(customMap.mesa)) customMap.mesa = [];
      if (!customMap.mesa.some((o: any) => String(o.value || '').toUpperCase() === cod)) {
        customMap.mesa.push({
          value: cod,
          label: `${cod} • ${amb} (${lug} lug.)`,
          meta: { ambiente: amb, lugares: lug, formato: fmt }
        });
      }
      if (!Array.isArray(customMap.ambiente)) customMap.ambiente = [];
      if (amb && !customMap.ambiente.some((o: any) => String(o.value || '').toLowerCase() === amb.toLowerCase())) {
        customMap.ambiente.push({ value: amb, label: amb });
      }
      localStorage.setItem('urutau_custom_select_options_v1', JSON.stringify(customMap));
    } catch {}

    fetch('/api/setores/salvar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: amb,
        descricao: 'Setor criado a partir do Mapa de Mesas e Reservas',
        cor_identificacao: '#10B981',
        empresa_id: Number(data.empresaAtivaId || data.unidades?.[0]?.id || 1)
      })
    }).catch(() => {});

    window.dispatchEvent(
      new CustomEvent('urutau-external-floor-plan-table-added', {
        detail: {
          table: { codigo: cod, ambienteNome: amb, lugares: lug, formato: fmt },
          environment: { nome: amb }
        }
      })
    );
    window.dispatchEvent(new Event('urutau-select-options-updated'));
    window.dispatchEvent(new Event('urutau-floor-plan-updated'));

    setOptionsSyncTick((t) => t + 1);
    setForm((prev: any) => {
      const atuais = Array.isArray(prev.mesas_vinculadas)
        ? prev.mesas_vinculadas.filter(Boolean)
        : [];
      const novaLista = Array.from(new Set([cod, ...atuais]));
      return {
        ...prev,
        mesa: cod,
        mesas_vinculadas: novaLista,
        area: amb,
        nova_mesa_criada: { codigo: cod, ambienteNome: amb, lugares: lug, formato: fmt }
      };
    });
    setNovaMesaForm({
      codigo: '',
      lugares: 4,
      formato: 'quadrada',
      ambienteNome: amb
    });
    setCriandoMesaInline(false);
  };

  const handleCriarAmbienteInline = () => {
    const amb = String(novoAmbienteNome || '').trim();
    if (!amb) {
      showAlert('Nome do Ambiente', 'Informe o nome do novo ambiente ou área do salão.');
      return;
    }
    try {
      const rawCustom = localStorage.getItem('urutau_custom_select_options_v1');
      const customMap = rawCustom ? JSON.parse(rawCustom) : {};
      if (!Array.isArray(customMap.ambiente)) customMap.ambiente = [];
      if (!customMap.ambiente.some((o: any) => String(o.value || '').toLowerCase() === amb.toLowerCase())) {
        customMap.ambiente.push({ value: amb, label: amb });
      }
      localStorage.setItem('urutau_custom_select_options_v1', JSON.stringify(customMap));
    } catch {}

    fetch('/api/setores/salvar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: amb,
        descricao: 'Setor criado a partir do Mapa de Mesas e Reservas',
        cor_identificacao: '#10B981',
        empresa_id: Number(data.empresaAtivaId || data.unidades?.[0]?.id || 1)
      })
    }).catch(() => {});

    window.dispatchEvent(
      new CustomEvent('urutau-external-floor-plan-table-added', {
        detail: {
          environment: { nome: amb }
        }
      })
    );
    window.dispatchEvent(new Event('urutau-select-options-updated'));
    window.dispatchEvent(new Event('urutau-floor-plan-updated'));
    setOptionsSyncTick((t) => t + 1);
    setForm((prev: any) => ({ ...prev, area: amb }));
    setNovoAmbienteNome('');
    setCriandoAmbienteInline(false);
  };

  const handleSave = async () => {
    try {
      const res = await fetch('/api/reservas/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || 'Falha ao salvar reserva');
      setModalOpen(false);
      await onRefresh();
    } catch (e: any) {
      showAlert('Erro em Reservas', e.message);
    }
  };

  const handleArchive = (id: number) => {
    showConfirm('Arquivar Reserva de Salão', 'Confirma o arquivamento desta reserva de mesa?', async () => {
      await fetch('/api/reservas/arquivar', {
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
      
      <div className="bg-[#11151E] border border-slate-800/90 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-slate-100">
            Reservas
          </h2>
          <button
            type="button"
            onClick={() => handleOpenReserva()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Reserva de Mesa</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-slate-800">
          <div className="p-2.5 bg-[#0B0D11] border border-slate-800 rounded flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Adultos $</span>
            <span className="text-base font-mono font-bold text-slate-100 tabular-nums">
              {totaisSalao.adultosPag}
            </span>
          </div>
          <div className="p-2.5 bg-[#0B0D11] border border-slate-800 rounded flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Adultos </span>
            <span className="text-base font-mono font-semibold text-amber-400 tabular-nums">
              {totaisSalao.adultosFreq}
            </span>
          </div>
          <div className="p-2.5 bg-[#0B0D11] border border-slate-800 rounded flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Kids $</span>
            <span className="text-base font-mono font-bold text-slate-100 tabular-nums">
              {totaisSalao.kidsPag}
            </span>
          </div>
          <div className="p-2.5 bg-[#0B0D11] border border-slate-800 rounded flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Kids </span>
            <span className="text-base font-mono font-semibold text-amber-400 tabular-nums">
              {totaisSalao.kidsFreq}
            </span>
          </div>
          <div className="p-2.5 bg-[#0B0D11] border border-emerald-500/30 rounded flex items-center justify-between">
            <span className="text-[11px] text-emerald-300">Pagantes</span>
            <span className="text-base font-mono font-bold text-emerald-400 tabular-nums">
              {totaisSalao.totalPagantes}
            </span>
          </div>
          <div className="p-2.5 bg-[#0B0D11] border border-amber-500/30 rounded flex items-center justify-between">
            <span className="text-[11px] text-amber-300">Total Pax</span>
            <span className="text-base font-mono font-bold text-amber-400 tabular-nums">
              {totaisSalao.totalGeral}
            </span>
          </div>
        </div>
      </div>

      <UrutauTableFloorPlan
        reservas={data.reservas || []}
        pdvComandas={data.pdvComandas || []}
        configs={data.configs || []}
        unidadeId={Number(data.unidades?.[0]?.id || 1)}
        empresaId={data.empresaAtivaId}
        currentUser={currentUser}
        areaFiltro={areaFiltro}
        onChangeAreaFiltro={setAreaFiltro}
        onOpenEditReserva={handleOpenReserva}
        onOpenNewReservaAtTable={({ mesa, mesas_vinculadas, area, lugares, data: dataPreset }) => {
          const listaMesas =
            Array.isArray(mesas_vinculadas) && mesas_vinculadas.length > 0
              ? mesas_vinculadas
              : [mesa];
          setForm({
            id: null,
            cliente: '',
            whatsapp: '',
            data: dataPreset || getTodayISO(),
            hora: '20:00',
            mesa,
            mesas_vinculadas: listaMesas,
            area,
            adultos_pagantes: lugares,
            adultos_frequentadores: 0,
            criancas_pagantes: 0,
            criancas_frequentadores: 0,
            observacoes: `Jogo de ${lugares} lugares (${listaMesas.join(' + ')})`,
            status: 'Confirmada',
            unidade_id: Number(data.unidades?.[0]?.id || 1)
          });
          setModalOpen(true);
        }}
        onOpenTableInPdv={({ mesaCodigo, comandaId }) => {
          onNavigateDeepLink({
            tab: 'pdv',
            entityId: comandaId ?? undefined,
            mesaCodigo
          });
        }}
        onRefresh={onRefresh}
        showAlert={showAlert}
      />

      <UrutauDateMultiView
        title="Agenda de Reservas de Salão (Lista, Kanban da Semana & Calendário do Mês)"
        items={(data.reservas || []).filter(
          (r: any) => areaFiltro === 'Todas' || r.area === areaFiltro
        )}
        getDateISO={(r: any) => r.data || getTodayISO()}
        getTitle={(r: any) => {
          const mesasLabel =
            Array.isArray(r.mesas_vinculadas) && r.mesas_vinculadas.filter(Boolean).length > 1
              ? r.mesas_vinculadas.filter(Boolean).join('+')
              : String(r.mesa || '').trim();
          const prefixoMesa = mesasLabel ? `Mesa ${mesasLabel}` : 'Sem mesa definida';
          return `${r.hora || '20:00'} • ${prefixoMesa} — ${r.cliente}`;
        }}
        getSubtitle={(r: any) => {
          const totalPax =
            Number(r.adultos_pagantes || 0) +
            Number(r.adultos_frequentadores || 0) +
            Number(r.criancas_pagantes || 0) +
            Number(r.criancas_frequentadores || 0);
          return `${r.area} • ${totalPax} pax (Ad: ${r.adultos_pagantes}+${r.adultos_frequentadores} | Kids: ${r.criancas_pagantes}+${r.criancas_frequentadores})`;
        }}
        getBadge={(r: any) => ({
          text: r.status || 'Confirmada',
          colorClass:
            r.status === 'Sentada'
              ? 'text-sky-400'
              : r.status === 'Confirmada'
              ? 'text-emerald-400'
              : 'text-amber-400'
        })}
        getRightMeta={(r: any) =>
          Array.isArray(r.mesas_vinculadas) && r.mesas_vinculadas.filter(Boolean).length > 1
            ? r.mesas_vinculadas.filter(Boolean).join('+')
            : String(r.mesa || '').trim() || 'Sem Mesa'
        }
        onEditItem={(r: any) => handleOpenReserva(r)}
        onCreateAtDate={(iso: string) => {
          setCriandoMesaInline(false);
          setCriandoAmbienteInline(false);
          setForm({
            id: null,
            cliente: '',
            whatsapp: '',
            data: iso,
            hora: '20:00',
            mesa: '',
            mesas_vinculadas: [],
            area: areaFiltro === 'Todas' ? 'Salão Principal' : areaFiltro,
            adultos_pagantes: 2,
            adultos_frequentadores: 0,
            criancas_pagantes: 0,
            criancas_frequentadores: 0,
            status: 'Confirmada',
            observacoes: '',
            unidade_id: Number(data.unidades?.[0]?.id || 1),
            nova_mesa_criada: null
          });
          setModalOpen(true);
        }}
        createButtonLabel="Nova Reserva"
        criteriaFilters={[
          {
            id: 'area',
            label: 'Ambiente',
            value: areaFiltro,
            onChange: setAreaFiltro,
            options: [
              { value: 'Todas', label: 'Todas as Áreas' },
              ...floorPlanMeta.areas.map((a) => ({ value: a, label: a }))
            ]
          }
        ]}
      />

      <FocusFormModal
        open={modalOpen}
        title={
          form.id
            ? `Editar Reserva — ${form.mesa ? `Mesa ${form.mesa}` : 'Sem Mesa Definida'}`
            : 'Nova Reserva de Salão (Com ou Sem Mesa Definida)'
        }
        subtitle="Você pode salvar a reserva sem identificar a mesa, selecionar uma mesa existente ou criar uma nova mesa diretamente abaixo"
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onArchive={form.id ? () => handleArchive(form.id) : undefined}
      >
        {(() => {
          const clientesCadastrados = (data.cadastrosPessoas || []).filter(
            (c: any) => Array.isArray(c.papeis) && c.papeis.includes('cliente')
          );
          const clienteJaExiste = clientesCadastrados.some(
            (c: any) =>
              String(c.nome || '').trim().toLowerCase() ===
              String(form.cliente || '').trim().toLowerCase()
          );
          const infoWpp = resolverWhatsappInteligente(form.whatsapp, data);

          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 p-3 bg-[#071712] border border-[#10B981]/30 rounded-xl space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-bold text-[#10B981]">
                    Lista de Clientes da Empresa ({clientesCadastrados.length})
                  </label>
                  {form.cliente?.trim() && (
                    <span
                      className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${
                        clienteJaExiste
                          ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/40'
                          : 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/40'
                      }`}
                    >
                      {clienteJaExiste
                        ? ' Cliente já cadastrado na empresa'
                        : ' Novo cliente: será cadastrado automaticamente ao salvar'}
                    </span>
                  )}
                </div>
                <select
                  data-urutau-entity="cliente"
                  data-urutau-label="Cliente da Empresa"
                  value=""
                  onChange={(e) => {
                    const rawVal = e.target.value;
                    const createdName = e.currentTarget.dataset.urutauLastCreatedName || '';
                    const createdWpp = e.currentTarget.dataset.urutauLastCreatedWhatsapp || '';
                    e.currentTarget.dataset.urutauLastCreatedName = '';
                    e.currentTarget.dataset.urutauLastCreatedWhatsapp = '';

                    const idSel = Number(rawVal);
                    const achado =
                      clientesCadastrados.find((c: any) => Number(c.id) === idSel) ||
                      clientesCadastrados.find((c: any) => String(c.nome) === rawVal);
                    if (achado) {
                      setForm((prev: any) => ({
                        ...prev,
                        cliente: achado.nome,
                        whatsapp: achado.whatsapp || createdWpp || prev.whatsapp
                      }));
                    } else if (createdName) {
                      setForm((prev: any) => ({
                        ...prev,
                        cliente: createdName,
                        whatsapp: createdWpp || prev.whatsapp
                      }));
                    } else if (rawVal) {
                      setForm((prev: any) => ({
                        ...prev,
                        cliente: rawVal
                      }));
                    }
                  }}
                  className="w-full px-3 py-2 bg-[#05100C] border border-slate-800 rounded text-xs text-slate-100"
                >
                  <option value="">
                    — Selecionar cliente já cadastrado (ou digite um novo abaixo) —
                  </option>
                  {clientesCadastrados.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.tipo_pessoa === 'PJ' ? '' : ''} {c.nome}{' '}
                      {c.whatsapp ? `• ${c.whatsapp}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-400 mb-1">
                  Nome do Cliente / Titular (PF ou PJ)
                </label>
                <input
                  type="text"
                  value={form.cliente}
                  onChange={(e) => setForm((prev: any) => ({ ...prev, cliente: e.target.value }))}
                  placeholder="Digite o nome (se for novo, cria o cadastro de Cliente ao salvar)"
                  className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  WhatsApp (não precisa +55 nem DDD)
                </label>
                <input
                  type="text"
                  value={form.whatsapp}
                  onChange={(e) => {
                    const val = e.target.value;
                    const resWpp = resolverWhatsappInteligente(val, data);
                    setForm((prev: any) => {
                      if (resWpp.encontradoNoBanco && resWpp.nomeEncontrado && !prev.cliente.trim()) {
                        return { ...prev, whatsapp: val, cliente: resWpp.nomeEncontrado };
                      }
                      return { ...prev, whatsapp: val };
                    });
                  }}
                  placeholder="Ex: 991122334 ou 91991122334"
                  className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs font-mono text-slate-100"
                />
                {form.whatsapp?.trim() && (
                  <div className="mt-1 text-[10px] font-mono text-[#10B981] flex items-center justify-between">
                    <span>→ {infoWpp.formatado}</span>
                    <span className="text-slate-400 truncate ml-2">{infoWpp.explicacao}</span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Status da Reserva</label>
                <select
                  data-urutau-entity="status_reserva"
                  data-urutau-label="Status da Reserva"
                  value={form.status}
                  onChange={(e) => setForm((prev: any) => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
                >
                  {floorPlanMeta.statuses.map((st) => (
                    <option key={st.value} value={st.value}>
                      {st.label}
                    </option>
                  ))}
                </select>
              </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Data</label>
            <input
              type="date"
              value={form.data}
              onChange={(e) => setForm((prev: any) => ({ ...prev, data: e.target.value }))}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs font-mono text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Horário de Chegada</label>
            <input
              type="time"
              value={form.hora}
              onChange={(e) => setForm((prev: any) => ({ ...prev, hora: e.target.value }))}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs font-mono text-slate-100"
            />
          </div>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
              <label className="block text-xs text-slate-400">
                Mesa Principal <span className="text-[10px] text-emerald-400">(Opcional)</span>
              </label>
              <div className="flex items-center gap-2">
                {form.mesa && (
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev: any) => ({
                        ...prev,
                        mesa: '',
                        mesas_vinculadas: []
                      }))
                    }
                    className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 cursor-pointer"
                  >
                    Deixar Sem Mesa
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const nextNum = floorPlanMeta.tables.length + 1;
                    setNovaMesaForm({
                      codigo: `M-${String(nextNum).padStart(2, '0')}`,
                      lugares: Math.max(
                        2,
                        Number(form.adultos_pagantes || 2) + Number(form.criancas_pagantes || 0)
                      ),
                      formato: 'quadrada',
                      ambienteNome: form.area || 'Salão Principal'
                    });
                    setCriandoMesaInline((v) => !v);
                  }}
                  className="text-[11px] font-bold text-[#10B981] hover:text-[#34D399] cursor-pointer"
                >
                  {criandoMesaInline ? 'Fechar Nova Mesa' : '+ Criar Nova Mesa'}
                </button>
              </div>
            </div>
            <select
              data-urutau-entity="mesa"
              data-urutau-label="Identificador da Mesa"
              value={form.mesa || ''}
              onChange={(e) => {
                const novaMesa = e.target.value;
                if (novaMesa === '__NEW_MESA__') {
                  const nextNum = floorPlanMeta.tables.length + 1;
                  setNovaMesaForm({
                    codigo: `M-${String(nextNum).padStart(2, '0')}`,
                    lugares: 4,
                    formato: 'quadrada',
                    ambienteNome: form.area || 'Salão Principal'
                  });
                  setCriandoMesaInline(true);
                  return;
                }
                const createdAmb = e.currentTarget.dataset.urutauLastCreatedAmbiente || '';
                e.currentTarget.dataset.urutauLastCreatedAmbiente = '';
                if (!novaMesa) {
                  setForm((prev: any) => ({
                    ...prev,
                    mesa: '',
                    mesas_vinculadas: []
                  }));
                  return;
                }
                const mesaInfo = floorPlanMeta.tables.find((t) => t.codigo === novaMesa);
                setForm((prev: any) => {
                  const prevExtras = Array.isArray(prev.mesas_vinculadas)
                    ? prev.mesas_vinculadas.filter((m: string) => m && m !== prev.mesa && m !== novaMesa)
                    : [];
                  return {
                    ...prev,
                    mesa: novaMesa,
                    mesas_vinculadas: [novaMesa, ...prevExtras],
                    area: createdAmb || mesaInfo?.ambienteNome || prev.area
                  };
                });
              }}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs font-mono text-slate-100"
            >
              <option value="">— Sem mesa definida (Alocar na chegada) —</option>
              {floorPlanMeta.tables.map((t) => (
                <option key={t.codigo} value={t.codigo}>
                  {t.codigo} • {t.ambienteNome} ({t.lugares} lug.)
                </option>
              ))}
              <option value="__NEW_MESA__">+ Criar nova mesa não existente...</option>
            </select>
          </div>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
              <label className="block text-xs text-slate-400">Ambiente / Área do Salão</label>
              <button
                type="button"
                onClick={() => setCriandoAmbienteInline((v) => !v)}
                className="text-[11px] font-bold text-[#10B981] hover:text-[#34D399] cursor-pointer"
              >
                {criandoAmbienteInline ? 'Fechar' : '+ Criar Ambiente'}
              </button>
            </div>
            <select
              data-urutau-entity="ambiente"
              data-urutau-label="Ambiente / Área do Salão"
              value={form.area}
              onChange={(e) => {
                if (e.target.value === '__NEW_AMBIENTE__') {
                  setCriandoAmbienteInline(true);
                  return;
                }
                setForm((prev: any) => ({ ...prev, area: e.target.value }));
              }}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
            >
              {floorPlanMeta.areas.map((areaName) => (
                <option key={areaName} value={areaName}>
                  {areaName}
                </option>
              ))}
              <option value="__NEW_AMBIENTE__">+ Criar novo ambiente...</option>
            </select>
            {criandoAmbienteInline && (
              <div className="mt-2 p-2.5 rounded-lg bg-[#071712] border border-[#10B981]/40 flex items-center gap-2">
                <input
                  type="text"
                  value={novoAmbienteNome}
                  onChange={(e) => setNovoAmbienteNome(e.target.value)}
                  placeholder="Nome do novo ambiente (ex: Deck Externo)..."
                  className="flex-1 px-2.5 py-1.5 bg-[#05100C] border border-slate-700 rounded text-xs text-white"
                />
                <button
                  type="button"
                  onClick={handleCriarAmbienteInline}
                  className="px-3 py-1.5 rounded bg-[#10B981] text-[#05100C] text-xs font-bold cursor-pointer shrink-0"
                >
                  Criar
                </button>
              </div>
            )}
          </div>

          {criandoMesaInline && (
            <div className="sm:col-span-2 p-3.5 rounded-xl bg-[#071712] border border-[#10B981]/50 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-[#10B981]">
                    Criar Nova Mesa Não Existente (Vincula Automaticamente à Reserva e ao Mapa)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    A mesa criada já fica selecionada nesta reserva e passa a existir no Mapa do Salão.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCriandoMesaInline(false)}
                  className="text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Fechar
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-300 mb-1">
                    Código / Nome da Mesa *
                  </label>
                  <input
                    type="text"
                    value={novaMesaForm.codigo}
                    onChange={(e) =>
                      setNovaMesaForm((prev) => ({ ...prev, codigo: e.target.value }))
                    }
                    placeholder="Ex: M-15, VIP-03"
                    className="w-full px-2.5 py-1.5 bg-[#05100C] border border-slate-700 rounded text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-300 mb-1">
                    Capacidade (Digite ou Escolha — ex: 40)
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={novaMesaForm.lugares}
                      onChange={(e) =>
                        setNovaMesaForm((prev) => ({
                          ...prev,
                          lugares: Math.min(200, Math.max(1, Number(e.target.value || 4)))
                        }))
                      }
                      placeholder="Ex: 40"
                      className="w-20 px-2 py-1.5 bg-[#05100C] border border-emerald-500/50 rounded text-xs font-mono font-bold text-emerald-300 text-center"
                    />
                    <select
                      value={[2, 4, 6, 8, 10, 12, 20, 40].includes(novaMesaForm.lugares) ? novaMesaForm.lugares : ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          setNovaMesaForm((prev) => ({ ...prev, lugares: Number(e.target.value) }));
                        }
                      }}
                      className="flex-1 px-2 py-1.5 bg-[#05100C] border border-slate-700 rounded text-xs font-mono text-white"
                    >
                      <option value="">{novaMesaForm.lugares} lug.</option>
                      {[2, 4, 6, 8, 10, 12, 20, 40].map((n) => (
                        <option key={n} value={n}>
                          {n} lugares
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-300 mb-1">
                    Formato da Mesa
                  </label>
                  <select
                    value={novaMesaForm.formato}
                    onChange={(e) =>
                      setNovaMesaForm((prev) => ({
                        ...prev,
                        formato: e.target.value as 'quadrada' | 'redonda' | 'retangular'
                      }))
                    }
                    className="w-full px-2.5 py-1.5 bg-[#05100C] border border-slate-700 rounded text-xs text-white"
                  >
                    <option value="quadrada">Quadrada</option>
                    <option value="redonda">Redonda</option>
                    <option value="retangular">Retangular</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-300 mb-1">
                    Ambiente / Área
                  </label>
                  <input
                    type="text"
                    value={novaMesaForm.ambienteNome}
                    onChange={(e) =>
                      setNovaMesaForm((prev) => ({ ...prev, ambienteNome: e.target.value }))
                    }
                    placeholder="Ex: Salão Principal"
                    className="w-full px-2.5 py-1.5 bg-[#05100C] border border-slate-700 rounded text-xs text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCriarMesaInline}
                  className="px-4 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#34D399] text-[#05100C] text-xs font-bold cursor-pointer"
                >
                  Criar Mesa e Vincular à Reserva
                </button>
              </div>
            </div>
          )}

          <div className="sm:col-span-2 p-3 rounded-lg bg-[#0B0D11] border border-slate-800 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-200">
                Mesas Vinculadas à Reserva (Clique para selecionar, juntar ou desmarcar)
              </span>
              <span className="font-mono tabular-nums text-amber-300">
                {(() => {
                  const listaAtiva = (
                    Array.isArray(form.mesas_vinculadas) && form.mesas_vinculadas.filter(Boolean).length > 0
                      ? form.mesas_vinculadas.filter(Boolean)
                      : form.mesa
                      ? [form.mesa]
                      : []
                  );
                  return listaAtiva.length > 0
                    ? listaAtiva.join(' + ')
                    : 'Sem mesa identificada (Alocar na chegada)';
                })()}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              <button
                type="button"
                onClick={() =>
                  setForm((prev: any) => ({
                    ...prev,
                    mesa: '',
                    mesas_vinculadas: []
                  }))
                }
                className={`px-2.5 py-1 rounded text-[11px] font-mono border cursor-pointer ${
                  !form.mesa && (!Array.isArray(form.mesas_vinculadas) || form.mesas_vinculadas.filter(Boolean).length === 0)
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                    : 'bg-[#11151E] text-slate-300 border-slate-800 hover:border-slate-600'
                }`}
              >
                Sem Mesa Definida
              </button>
              {floorPlanMeta.tables
                .filter(
                  (t) =>
                    t.ambienteNome === form.area ||
                    (form.mesas_vinculadas || []).includes(t.codigo) ||
                    t.codigo === form.mesa
                )
                .map((t) => {
                  const selectedList: string[] =
                    Array.isArray(form.mesas_vinculadas) && form.mesas_vinculadas.filter(Boolean).length > 0
                      ? form.mesas_vinculadas.filter(Boolean)
                      : form.mesa
                      ? [form.mesa]
                      : [];
                  const isChecked = selectedList.includes(t.codigo);
                  const isMain = t.codigo === form.mesa && Boolean(form.mesa);
                  return (
                    <button
                      key={t.codigo}
                      type="button"
                      onClick={() => {
                        setForm((prev: any) => {
                          const curr: string[] =
                            Array.isArray(prev.mesas_vinculadas) && prev.mesas_vinculadas.filter(Boolean).length > 0
                              ? prev.mesas_vinculadas.filter(Boolean)
                              : prev.mesa
                              ? [prev.mesa]
                              : [];
                          const next = curr.includes(t.codigo)
                            ? curr.filter((x) => x !== t.codigo)
                            : [...curr, t.codigo];
                          const nextMain =
                            next.length === 0
                              ? ''
                              : prev.mesa && next.includes(prev.mesa)
                              ? prev.mesa
                              : next[0];
                          return {
                            ...prev,
                            mesa: nextMain,
                            mesas_vinculadas: next
                          };
                        });
                      }}
                      className={`px-2 py-1 rounded text-[11px] font-mono tabular-nums border cursor-pointer ${
                        isMain
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                          : isChecked
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                          : 'bg-[#11151E] text-slate-300 border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      {t.codigo} ({t.lugares}L)
                    </button>
                  );
                })}
            </div>
          </div>
            </div>
          );
        })()}

        
        <div className="p-4 bg-[#0B0D11] border border-amber-500/30 rounded-lg space-y-3">
          <div className="text-xs font-semibold text-amber-400">
            Discriminação Obrigatória de Público (Art. 9º, Parágrafo Único)
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Adultos Pagantes</label>
              <input
                type="number"
                min={0}
                value={form.adultos_pagantes}
                onChange={(e) => setForm({ ...form, adultos_pagantes: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-[#11151E] border border-slate-800 rounded text-xs font-mono text-slate-100"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Adultos Frequentadores
              </label>
              <input
                type="number"
                min={0}
                value={form.adultos_frequentadores}
                onChange={(e) =>
                  setForm({ ...form, adultos_frequentadores: Number(e.target.value) })
                }
                className="w-full px-3 py-2 bg-[#11151E] border border-slate-800 rounded text-xs font-mono text-amber-300"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Crianças (Kids) Pagantes
              </label>
              <input
                type="number"
                min={0}
                value={form.criancas_pagantes}
                onChange={(e) => setForm({ ...form, criancas_pagantes: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-[#11151E] border border-slate-800 rounded text-xs font-mono text-slate-100"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Crianças Frequentadoras
              </label>
              <input
                type="number"
                min={0}
                value={form.criancas_frequentadores}
                onChange={(e) =>
                  setForm({ ...form, criancas_frequentadores: Number(e.target.value) })
                }
                className="w-full px-3 py-2 bg-[#11151E] border border-slate-800 rounded text-xs font-mono text-amber-300"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Observações de Atendimento / Restrições</label>
          <textarea
            rows={3}
            value={form.observacoes}
            onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
          />
        </div>
      </FocusFormModal>
    </div>
  );
}

export function PortaisTab({ data, onRefresh, showAlert, showConfirm }: CommonTabProps) {
  const [portaisAbertosIds, setPortaisAbertosIds] = useState<number[]>([
    data.portais[0]?.id || 1
  ]);
  const [telaAmpliada, setTelaAmpliada] = useState<boolean>(false);
  const [mostrarListaPortais, setMostrarListaPortais] = useState<boolean>(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<any>({ id: null, nome: '', url: '', orientacoes: '' });

  const togglePortalIframe = (id: number) => {
    if (portaisAbertosIds.includes(id)) {
      setPortaisAbertosIds((prev) => prev.filter((item) => item !== id));
      return;
    }
    if (portaisAbertosIds.length >= 2) {
      showAlert(
        'Limite de Portais Simultâneos',
        'O sistema permite a abertura simultânea de no máximo 2 portais integrados lado a lado. Feche um dos portais ativos antes de expandir outro.'
      );
      return;
    }
    setPortaisAbertosIds((prev) => [...prev, id]);
  };

  const handleSave = async () => {
    try {
      const res = await fetch('/api/sites/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || 'Erro ao salvar portal');
      setModalOpen(false);
      await onRefresh();
    } catch (e: any) {
      showAlert('Erro em Portais', e.message);
    }
  };

  const handleArchive = (id: number) => {
    showConfirm('Arquivar Portal Terceirizado', 'Deseja arquivar este portal?', async () => {
      await fetch('/api/sites/arquivar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      setModalOpen(false);
      await onRefresh();
    });
  };

  const portaisAtivos = data.portais.filter((p) => portaisAbertosIds.includes(p.id));

  return (
    <div className="space-y-3 w-full">
      
      <div className="bg-[#11151E] border border-slate-800/90 rounded-lg px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-200 mr-1">Portais:</span>
          {data.portais.map((p) => {
            const isOpen = portaisAbertosIds.includes(p.id);
            return (
              <div key={p.id} className="inline-flex items-center rounded border border-slate-800 bg-[#0B0D11] overflow-hidden">
                <button
                  type="button"
                  onClick={() => togglePortalIframe(p.id)}
                  className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isOpen
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Columns className="w-3.5 h-3.5" />
                  <span>{p.nome}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForm({ ...p });
                    setModalOpen(true);
                  }}
                  className="px-2 py-1.5 text-[11px] text-slate-400 hover:text-amber-400 border-l border-slate-800 cursor-pointer"
                  title="Editar portal"
                >
                  Editar
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono text-amber-400">
            Ativos: {portaisAtivos.length}/2
          </span>
          <button
            type="button"
            onClick={() => setTelaAmpliada((v) => !v)}
            className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors cursor-pointer ${
              telaAmpliada
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-[#0B0D11] border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            {telaAmpliada ? 'Altura Padrão (78vh)' : 'Maximizar Altura (88vh)'}
          </button>
          <button
            type="button"
            onClick={() => setMostrarListaPortais((v) => !v)}
            className="px-3 py-1.5 text-xs font-medium rounded bg-[#0B0D11] border border-slate-800 text-slate-300 hover:text-amber-300 cursor-pointer"
          >
            {mostrarListaPortais ? 'Ocultar Detalhes' : 'Ver Detalhes'}
          </button>
          <button
            type="button"
            onClick={() => {
              setForm({ id: null, nome: '', url: 'https://', orientacoes: '' });
              setModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Cadastrar Portal</span>
          </button>
        </div>
      </div>

      
      {mostrarListaPortais && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {data.portais.map((p) => {
            const isOpen = portaisAbertosIds.includes(p.id);
            return (
              <div
                key={p.id}
                className={`p-3.5 rounded-lg border transition-colors flex flex-col justify-between gap-2.5 ${
                  isOpen
                    ? 'bg-[#151B28] border-amber-500/60'
                    : 'bg-[#11151E] border-slate-800/90'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-100 truncate">{p.nome}</h3>
                    <button
                      type="button"
                      onClick={() => {
                        setForm({ ...p });
                        setModalOpen(true);
                      }}
                      className="text-xs text-slate-400 hover:text-amber-400 cursor-pointer"
                    >
                      Editar
                    </button>
                  </div>
                  <div className="text-[11px] font-mono text-amber-400/90 truncate mt-0.5">{p.url}</div>
                  <p className="text-xs text-slate-400 mt-1">{p.orientacoes}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      
      {portaisAtivos.length > 0 ? (
        <div
          className={`grid gap-3 ${
            portaisAtivos.length === 2 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
          }`}
        >
          {portaisAtivos.map((p) => (
            <div
              key={p.id}
              className={`bg-[#11151E] border border-amber-500/40 rounded-lg overflow-hidden flex flex-col ${
                telaAmpliada ? 'h-[88vh] min-h-[720px]' : 'h-[78vh] min-h-[600px]'
              }`}
            >
              <div className="px-4 py-2 bg-[#161C28] border-b border-slate-800 flex items-center justify-between text-xs shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-slate-100 truncate">{p.nome}</span>
                  <span className="text-[11px] font-mono text-amber-400/80 truncate hidden sm:inline">
                    {p.url}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-400 hover:text-amber-300 font-medium"
                  >
                    Abrir Nova Guia ↗
                  </a>
                  <button
                    type="button"
                    onClick={() => togglePortalIframe(p.id)}
                    className="text-rose-400 hover:text-rose-300 font-medium cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </div>
              <iframe
                title={p.nome}
                src={`/api/proxy-portal?url=${encodeURIComponent(p.url)}&nome=${encodeURIComponent(p.nome)}`}
                className="w-full flex-1 border-0 bg-[#0B0D11]"
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8 bg-[#11151E] border border-slate-800 rounded-lg text-center text-xs text-slate-400">
          Selecione um ou até dois portais na barra acima para visualizá-los em tela ampla.
        </div>
      )}

      <FocusFormModal
        open={modalOpen}
        title={form.id ? 'Editar Portal Terceirizado' : 'Novo Portal Terceirizado'}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onArchive={form.id ? () => handleArchive(form.id) : undefined}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Nome do Portal / Sistema</label>
            <input
              type="text"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">URL Completa (HTTPS)</label>
            <input
              type="url"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs font-mono text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Orientações Operacionais de Acesso</label>
            <textarea
              rows={3}
              value={form.orientacoes}
              onChange={(e) => setForm({ ...form, orientacoes: e.target.value })}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
            />
          </div>
        </div>
      </FocusFormModal>
    </div>
  );
}

export function ChatAppsTab({ data, onRefresh, showAlert }: CommonTabProps) {
  const [instanciaAtivaId, setInstanciaAtivaId] = useState<number>(
    data.instanciasChat[0]?.id || 1
  );
  const [textoMsg, setTextoMsg] = useState('');
  const [destinatario, setDestinatario] = useState('Cliente Reserva VIP');
  const [contato, setContato] = useState('5591991122334');

  const [modalMsgRapidaOpen, setModalMsgRapidaOpen] = useState(false);
  const [formRapida, setFormRapida] = useState<any>({ id: null, titulo: '', texto: '' });

  const handleEnviarMensagem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textoMsg.trim()) return;
    try {
      await fetch('/api/v20/chat/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instancia_id: instanciaAtivaId,
          destinatario,
          contato,
          texto: textoMsg
        })
      });
      setTextoMsg('');
      await onRefresh();
    } catch (err: any) {
      showAlert('Erro no Disparo WhatsApp', err.message);
    }
  };

  const handleSaveMsgRapida = async () => {
    try {
      const res = await fetch('/api/v20/mensagens-rapidas/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formRapida)
      });
      if (!res.ok) throw new Error('Falha ao salvar mensagem rápida');
      setModalMsgRapidaOpen(false);
      await onRefresh();
    } catch (err: any) {
      showAlert('Erro', err.message);
    }
  };

  const mensagensFiltradas = data.mensagensChat.filter(
    (m) => Number(m.instancia_id) === Number(instanciaAtivaId)
  );

  return (
    <div className="space-y-6 w-full">
      <div className="bg-[#11151E] border border-slate-800/90 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-slate-100">
          Atendimento
        </h2>
        <button
          type="button"
          onClick={() => {
            setFormRapida({ id: null, titulo: '', texto: '' });
            setModalMsgRapidaOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Cadastrar Mensagem Rápida</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="bg-[#11151E] border border-slate-800/90 rounded-lg p-4 space-y-3">
          <div className="text-xs font-semibold text-slate-300 uppercase font-mono">
            Instâncias Conectadas ({data.instanciasChat.length})
          </div>
          {data.instanciasChat.map((inst) => {
            const active = Number(inst.id) === Number(instanciaAtivaId);
            return (
              <div
                key={inst.id}
                onClick={() => setInstanciaAtivaId(inst.id)}
                className={`p-3.5 rounded-lg border cursor-pointer transition-colors ${
                  active
                    ? 'bg-amber-500/15 border-amber-500/60'
                    : 'bg-[#0B0D11] border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-100">{inst.nome}</span>
                  <span className="font-mono text-[11px] text-emerald-400">{inst.status}</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {inst.canal} · <span className="font-mono">{inst.numero}</span>
                </div>
                <div className="text-[11px] font-mono text-slate-500 mt-1.5">
                  Sessão: {inst.sessao_id} · {inst.mensagens_hoje} msgs hoje
                </div>
              </div>
            );
          })}
        </div>

        
        <div className="lg:col-span-2 bg-[#11151E] border border-slate-800/90 rounded-lg flex flex-col h-[460px]">
          <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                {data.instanciasChat.find((i) => Number(i.id) === Number(instanciaAtivaId))?.nome}
              </h3>
              <p className="text-[11px] text-slate-400">
                Comunicação em tempo real ativa
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={destinatario}
                onChange={(e) => setDestinatario(e.target.value)}
                placeholder="Nome Contato"
                className="px-2.5 py-1 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-200"
              />
              <input
                type="text"
                value={contato}
                onChange={(e) => setContato(e.target.value)}
                placeholder="WhatsApp"
                className="px-2.5 py-1 bg-[#0B0D11] border border-slate-800 rounded text-xs font-mono text-slate-200 w-32"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0B0D11]/60">
            {mensagensFiltradas.map((m) => (
              <div
                key={m.id}
                className={`max-w-lg p-3 rounded-lg text-xs ${
                  m.direcao === 'enviada'
                    ? 'ml-auto bg-amber-500/20 border border-amber-500/40 text-slate-100'
                    : 'mr-auto bg-[#151A25] border border-slate-800 text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-4 text-[11px] text-slate-400 mb-1">
                  <span className="font-semibold text-amber-300">{m.remetente}</span>
                  <span className="font-mono">{m.horario}</span>
                </div>
                <p className="leading-relaxed">{m.texto}</p>
              </div>
            ))}
          </div>

          <form
            onSubmit={handleEnviarMensagem}
            className="p-3 border-t border-slate-800 bg-[#11151E] flex items-center gap-2"
          >
            <input
              type="text"
              value={textoMsg}
              onChange={(e) => setTextoMsg(e.target.value)}
              placeholder="Digite a mensagem ou cole uma Mensagem Rápida..."
              className="flex-1 px-3.5 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100 focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Enviar</span>
            </button>
          </form>
        </div>
      </div>

      <FocusFormModal
        open={modalMsgRapidaOpen}
        title="Nova Mensagem Rápida"
        onClose={() => setModalMsgRapidaOpen(false)}
        onSave={handleSaveMsgRapida}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Título Identificador</label>
            <input
              type="text"
              value={formRapida.titulo}
              onChange={(e) => setFormRapida({ ...formRapida, titulo: e.target.value })}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Texto Integral para Cópia Automática</label>
            <textarea
              rows={4}
              value={formRapida.texto}
              onChange={(e) => setFormRapida({ ...formRapida, texto: e.target.value })}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
            />
          </div>
        </div>
      </FocusFormModal>
    </div>
  );
}

export function CaixaTab({
  data,
  onRefresh,
  showAlert,
  showConfirm,
  currentUser,
  initialSubArea = 'caixa',
  ...restProps
}: CommonTabProps & { initialSubArea?: 'caixa' | 'rateio' | 'consumer_api' }) {
  const [subAreaFinanceiro, setSubAreaFinanceiro] = useState<'caixa' | 'rateio' | 'consumer_api'>(
    initialSubArea
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [fechamentoDiarioAberto, setFechamentoDiarioAberto] = useState(true);

  const [consumerConfig, setConsumerConfig] = useState<any>({
    empresa_id: 1,
    ativo: true,
    modo_conexao: 'botao_flutuante_exe',
    conferencia_cautelosa_individual: true,
    exibir_botao_flutuante_tela: true,
    caminho_fdb_consumer: 'C:\\Programa Consumer\\Dados\\CONSUMER.FDB',
    endpoint_url: 'http://127.0.0.1:8085/api/v1/consumer/lancamentos',
    api_token: 'URUTAU-CONSUMER-1-2026',
    codigo_loja: 'LOJA-01',
    terminal_caixa: 'CAIXA-01',
    auto_lancar_caixa: true,
    auto_lancar_reservas_mesas: true,
    auto_lancar_estoque_compras: true,
    auto_lancar_rateio: true
  });
  const [consumerResumo, setConsumerResumo] = useState<any>({
    total_lancados: 0,
    caixa_count: 0,
    mesas_count: 0,
    estoque_count: 0,
    rateio_count: 0,
    fila_pendente: 0,
    conferidos_count: 0,
    rejeitados_count: 0
  });
  const [consumerFilaCautelosa, setConsumerFilaCautelosa] = useState<any[]>([]);
  const [consumerLogs, setConsumerLogs] = useState<any[]>([]);
  const [consumerLoading, setConsumerLoading] = useState(false);
  const [payloadInspecionado, setPayloadInspecionado] = useState<any | null>(null);

  const [indiceItemCauteloso, setIndiceItemCauteloso] = useState(0);
  const [checkCautelaMarcado, setCheckCautelaMarcado] = useState(false);
  const [copiadoFeedbackId, setCopiadoFeedbackId] = useState<string | null>(null);
  const [exportarApenasConferidos, setExportarApenasConferidos] = useState(true);

  const [lancamentoRapidoConsumer, setLancamentoRapidoConsumer] = useState<any>({
    modulo: 'PEDIDO_PDV',
    mesa_comanda: '12',
    cliente: 'Cliente Salão',
    garcom: 'Atendente Salão',
    produto_descricao: 'Combo Principal + Bebidas',
    quantidade: 1,
    valor: 145.0,
    tipo_caixa: 'Entrada',
    categoria_caixa: 'Faturamento Salão',
    gravar_no_urutau: true
  });

  const carregarStatusConsumer = async () => {
    try {
      const empId = Number((data as any)?.empresa?.id || 1);
      const res = await fetch(`/api/integracoes/consumer/status/${empId}`);
      const json = await res.json();
      if (json.ok) {
        if (json.config) setConsumerConfig(json.config);
        if (json.resumo) setConsumerResumo(json.resumo);
        if (Array.isArray(json.fila_cautelosa)) setConsumerFilaCautelosa(json.fila_cautelosa);
        if (Array.isArray(json.logs)) setConsumerLogs(json.logs);
      }
    } catch {}
  };

  useEffect(() => {
    setSubAreaFinanceiro(initialSubArea);
  }, [initialSubArea]);

  useEffect(() => {
    carregarStatusConsumer();
  }, [data.caixa?.length, data.reservas?.length]);

  useEffect(() => {
    setCheckCautelaMarcado(false);
    if (indiceItemCauteloso >= consumerFilaCautelosa.length) {
      setIndiceItemCauteloso(0);
    }
  }, [indiceItemCauteloso, consumerFilaCautelosa.length]);

  const handleSalvarConfigConsumer = async () => {
    setConsumerLoading(true);
    try {
      const empId = Number((data as any)?.empresa?.id || 1);
      const res = await fetch('/api/integracoes/consumer/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...consumerConfig, empresa_id: empId })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.erro || 'Falha ao salvar configuração Consumer');
      setConsumerConfig(json.config);
      showAlert(
        'Configuração PDV Consumer Salva',
        `Integração atualizada para ${json.config.codigo_loja} (${json.config.terminal_caixa}) com Conferência Cautelosa ${
          json.config.conferencia_cautelosa_individual ? 'Ativa (1 por 1)' : 'Direta'
        }.`
      );
      await carregarStatusConsumer();
    } catch (e: any) {
      showAlert('Erro na Configuração Consumer', e.message);
    } finally {
      setConsumerLoading(false);
    }
  };

  const handleConferirItemIndividual = async (
    item: any,
    acao: 'APROVAR_E_LANCAR' | 'REJEITAR_DESCARTAR'
  ) => {
    if (!item?.id) return;
    if (acao === 'APROVAR_E_LANCAR' && !checkCautelaMarcado) {
      showAlert(
        'Trava de Segurança Contra Erros em Massa',
        'Marque a caixa de confirmação cautelosa indicando que conferiu o valor e a descrição deste lançamento antes de aprová-lo.'
      );
      return;
    }

    setConsumerLoading(true);
    try {
      const empId = Number((data as any)?.empresa?.id || 1);
      const res = await fetch('/api/integracoes/consumer/conferir-individual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: empId,
          protocolo_id: item.id,
          acao,
          operador: currentUser?.nome || 'Operador Caixa Consumer'
        })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.erro || 'Falha ao processar item individual');
      setCheckCautelaMarcado(false);
      await carregarStatusConsumer();
    } catch (e: any) {
      showAlert('Erro na Conferência Individual', e.message);
    } finally {
      setConsumerLoading(false);
    }
  };

  const handleCopiarDadosItemConsumer = (item: any) => {
    if (!item) return;
    const texto = `${item.resumo} | Valor: R$ ${Number(item.valor_referencia || 0)
      .toFixed(2)
      .replace('.', ',')} | Protocolo: ${item.id}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).catch(() => {});
    }
    setCopiadoFeedbackId(item.id);
    setTimeout(() => setCopiadoFeedbackId(null), 2500);
  };

  const handleDispararRapidoConsumer = async () => {
    setConsumerLoading(true);
    try {
      const empId = Number((data as any)?.empresa?.id || 1);
      const mod = lancamentoRapidoConsumer.modulo;
      let dadosEnvio: any = {};

      if (mod === 'PEDIDO_PDV') {
        const qtd = Math.max(1, Number(lancamentoRapidoConsumer.quantidade || 1));
        const valUnit = Number(lancamentoRapidoConsumer.valor || 0);
        dadosEnvio = {
          mesa_comanda: lancamentoRapidoConsumer.mesa_comanda || '01',
          cliente: lancamentoRapidoConsumer.cliente || 'Cliente Salão',
          garcom: lancamentoRapidoConsumer.garcom || 'Garçom',
          produto_descricao: lancamentoRapidoConsumer.produto_descricao || 'Pedido Lançado via Urutau',
          quantidade: qtd,
          preco_unitario: valUnit,
          valor_total: Number((qtd * valUnit).toFixed(2))
        };
      } else if (mod === 'CAIXA') {
        dadosEnvio = {
          data: getTodayISO(),
          tipo: lancamentoRapidoConsumer.tipo_caixa || 'Entrada',
          categoria: lancamentoRapidoConsumer.categoria_caixa || 'Faturamento Salão',
          descricao:
            lancamentoRapidoConsumer.produto_descricao || 'Suprimento / Lançamento Caixa Consumer',
          valor: Number(lancamentoRapidoConsumer.valor || 0)
        };
      } else if (mod === 'MESA_COMANDA') {
        dadosEnvio = {
          mesa: `M-${String(lancamentoRapidoConsumer.mesa_comanda || '01').replace(/\D/g, '') || '01'}`,
          cliente: lancamentoRapidoConsumer.cliente || 'Cliente Reserva',
          pessoas: Math.max(1, Number(lancamentoRapidoConsumer.quantidade || 2)),
          data: getTodayISO(),
          hora: new Date().toTimeString().slice(0, 5),
          area: 'Salão Principal',
          observacoes: lancamentoRapidoConsumer.produto_descricao || 'Abertura de mesa via API Urutau'
        };
      } else if (mod === 'ESTOQUE_COMPRA') {
        dadosEnvio = {
          operacao: 'ENTRADA_COMPRA_MERCADORIA',
          nome: lancamentoRapidoConsumer.produto_descricao || 'Insumo Recebido',
          categoria: 'Insumos',
          quantidade_comprada: Math.max(1, Number(lancamentoRapidoConsumer.quantidade || 1)),
          unidade_medida: 'un',
          custo_unitario: Number(lancamentoRapidoConsumer.valor || 0),
          valor_total_compra:
            Math.max(1, Number(lancamentoRapidoConsumer.quantidade || 1)) *
            Number(lancamentoRapidoConsumer.valor || 0)
        };
      }

      const res = await fetch('/api/integracoes/consumer/lancar-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: empId,
          modulo: mod,
          dados: dadosEnvio,
          gravar_no_urutau: Boolean(lancamentoRapidoConsumer.gravar_no_urutau)
        })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.erro || 'Erro ao lançar no PDV Consumer');

      await carregarStatusConsumer();
      if (lancamentoRapidoConsumer.gravar_no_urutau) {
        await onRefresh();
      }
      showAlert(
        'Enviado para a Fila Cautelosa do Consumer',
        `Protocolo ${json.disparo?.id}: ${json.disparo?.resumo} entrou na Fila Cautelosa (Menu Lateral do Urutau.exe e Painel Consumer) para conferência 1 a 1 antes da efetivação.`
      );
    } catch (e: any) {
      showAlert('Falha no Envio para Consumer', e.message);
    } finally {
      setConsumerLoading(false);
    }
  };

  const handleSincronizarDiaConsumer = async () => {
    setConsumerLoading(true);
    try {
      const empId = Number((data as any)?.empresa?.id || 1);
      const res = await fetch('/api/integracoes/consumer/sincronizar-dia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: empId,
          data: getTodayISO()
        })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.erro || 'Erro ao sincronizar dia com Consumer');
      await carregarStatusConsumer();
      showAlert(
        'Movimentos na Fila de Conferência Cautelosa',
        `Foram adicionados ${json.total_transmitidos} lançamento(s) de hoje (${json.caixa_transmitidos} de Caixa e ${json.mesas_transmitidas} de Mesas/Reservas) na Fila Cautelosa para você conferir 1 por 1 com segurança.`
      );
    } catch (e: any) {
      showAlert('Erro na Sincronização Consumer', e.message);
    } finally {
      setConsumerLoading(false);
    }
  };

  const unidadesPermitidas = useMemo(
    () => getUnidadesPermitidasUsuario(data, currentUser),
    [data, currentUser]
  );
  const [unidadesSelecionadasIds, setUnidadesSelecionadasIds] = useState<number[]>([]);
  const effectiveUnidadesIds = useMemo(() => {
    const allIds = unidadesPermitidas.map((u: any) => Number(u.id));
    if (unidadesSelecionadasIds.length === 0) return allIds;
    const valid = unidadesSelecionadasIds.filter((id) => allIds.includes(Number(id)));
    return valid.length > 0 ? valid : allIds;
  }, [unidadesPermitidas, unidadesSelecionadasIds]);

  const [form, setForm] = useState<any>({
    id: null,
    data: getTodayISO(),
    tipo: 'Entrada',
    categoria: 'Faturamento Salão',
    descricao: '',
    expressao: '',
    valor: 0,
    unidade_id: 1,
    usuario_id: 1
  });

  const [criandoCatContaInline, setCriandoCatContaInline] = useState(false);
  const [novaCatContaForm, setNovaCatContaForm] = useState<{
    nome: string;
    tipo: 'Entrada' | 'Saída';
    modo_padrao: 'mesclado' | 'sistema' | 'manual';
  }>({
    nome: '',
    tipo: 'Entrada',
    modo_padrao: 'mesclado'
  });
  const [salvandoCatContaInline, setSalvandoCatContaInline] = useState(false);

  const categoriasDeContaCatalog = useMemo(() => {
    const mapa = new Map<string, { nome: string; tipo: 'Entrada' | 'Saída' }>();
    const padroes: { nome: string; tipo: 'Entrada' | 'Saída' }[] = [
      { nome: 'Faturamento Salão', tipo: 'Entrada' },
      { nome: 'Total Entrada via Delivery', tipo: 'Entrada' },
      { nome: 'Pix / Cartão', tipo: 'Entrada' },
      { nome: 'Total 10% Gorjeta do Garçom', tipo: 'Entrada' },
      { nome: 'Suprimento de Caixa', tipo: 'Entrada' },
      { nome: 'Fornecedores', tipo: 'Saída' },
      { nome: 'Compras de Insumos & Pagamento de Fornecedores', tipo: 'Saída' },
      { nome: 'Despesas com Entregadores / Motoboys', tipo: 'Saída' },
      { nome: 'Vales, Diárias Extras & Despesas de Equipe', tipo: 'Saída' },
      { nome: 'Sangria Operacional', tipo: 'Saída' },
      { nome: 'Aluguel, Energia & Contas Fixas', tipo: 'Saída' }
    ];
    padroes.forEach((p) => mapa.set(p.nome.toLowerCase(), p));
    (data.categoriasFechamentoCaixa || []).forEach((c: any) => {
      const n = String(c?.nome || '').trim();
      if (n) {
        mapa.set(n.toLowerCase(), {
          nome: n,
          tipo: c.tipo === 'Saída' ? 'Saída' : 'Entrada'
        });
      }
    });
    (data.caixa || []).forEach((c: any) => {
      const n = String(c?.categoria || '').trim();
      if (n && !mapa.has(n.toLowerCase())) {
        mapa.set(n.toLowerCase(), {
          nome: n,
          tipo: c.tipo === 'Saída' ? 'Saída' : 'Entrada'
        });
      }
    });
    const currentCat = String(form.categoria || '').trim();
    if (currentCat && !mapa.has(currentCat.toLowerCase())) {
      mapa.set(currentCat.toLowerCase(), {
        nome: currentCat,
        tipo: form.tipo === 'Saída' ? 'Saída' : 'Entrada'
      });
    }
    return Array.from(mapa.values());
  }, [data.categoriasFechamentoCaixa, data.caixa, form.categoria, form.tipo]);

  const handleCriarCategoriaContaInline = async () => {
    const nomeLimpo = String(novaCatContaForm.nome || '').trim();
    if (!nomeLimpo) {
      showAlert('Nome da Categoria Obrigatório', 'Informe o nome da nova Categoria de Conta para vinculá-la ao lançamento.');
      return;
    }
    setSalvandoCatContaInline(true);
    try {
      const res = await fetch('/api/v20/caixa/categorias-fechamento/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoria: {
            nome: nomeLimpo,
            tipo: novaCatContaForm.tipo || form.tipo || 'Entrada',
            modo_padrao: novaCatContaForm.modo_padrao || 'mesclado',
            fonte_sistema: 'CAIXA_CATEGORIA',
            filtro_origem: nomeLimpo,
            lancar_no_caixa_em_massa: true,
            unidade_id: Number(form.unidade_id || effectiveUnidadesIds[0] || 1)
          }
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || 'Erro ao criar categoria de conta');
      setForm((prev: any) => ({
        ...prev,
        categoria: nomeLimpo,
        tipo: novaCatContaForm.tipo || prev.tipo
      }));
      setNovaCatContaForm({
        nome: '',
        tipo: form.tipo === 'Saída' ? 'Saída' : 'Entrada',
        modo_padrao: 'mesclado'
      });
      setCriandoCatContaInline(false);
      await onRefresh();
    } catch (e: any) {
      showAlert('Erro ao Criar Categoria de Conta', e.message);
    } finally {
      setSalvandoCatContaInline(false);
    }
  };

  const handleExpressaoChange = (expr: string) => {
    const calc = evaluateMathExpression(expr);
    setForm((prev: any) => ({
      ...prev,
      expressao: expr,
      valor: calc.valid ? calc.value : prev.valor
    }));
  };

  const caixaFiltrado = useMemo(() => {
    return (data.caixa || []).filter(
      (c: any) =>
        effectiveUnidadesIds.length === 0 ||
        !c.unidade_id ||
        effectiveUnidadesIds.includes(Number(c.unidade_id))
    );
  }, [data.caixa, effectiveUnidadesIds]);

  const resumoCaixa = useMemo(() => {
    return caixaFiltrado.reduce(
      (acc, c) => {
        const v = Number(c.valor || 0);
        if (c.tipo === 'Entrada') acc.entradas += v;
        else acc.saidas += v;
        acc.saldo = acc.entradas - acc.saidas;
        return acc;
      },
      { entradas: 0, saidas: 0, saldo: 0 }
    );
  }, [caixaFiltrado]);

  const handleSave = async () => {
    try {
      const res = await fetch('/api/v20/caixa/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || 'Erro ao salvar lançamento de caixa');
      setModalOpen(false);
      await onRefresh();
      await carregarStatusConsumer();
    } catch (e: any) {
      showAlert('Erro no Caixa', e.message);
    }
  };

  const handleArchive = (id: number) => {
    showConfirm('Arquivar Lançamento de Caixa', 'Confirma o arquivamento lógico deste lançamento financeiro?', async () => {
      await fetch('/api/erp/arquivar-generico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, tabelaAlvo: 'erp_caixa' })
      });
      setModalOpen(false);
      await onRefresh();
    });
  };

  const itemAtualFila = consumerFilaCautelosa[indiceItemCauteloso] || consumerFilaCautelosa[0] || null;
  const empIdAtual = Number((data as any)?.empresa?.id || 1);

  return (
    <div className="space-y-6 w-full relative">
      <div className="bg-[#0B1518] border border-[#10B981]/30 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#6EE7B7] px-2">
            Áreas do Financeiro:
          </span>
          <button
            type="button"
            onClick={() => setSubAreaFinanceiro('caixa')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
              subAreaFinanceiro === 'caixa'
                ? 'bg-[#10B981] text-[#04120C]'
                : 'bg-black/40 text-slate-300 hover:text-white border border-white/10'
            }`}
          >
            Fluxo de Caixa, Tesouraria & Pagamentos de RH
          </button>
          <button
            type="button"
            onClick={() => setSubAreaFinanceiro('rateio')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
              subAreaFinanceiro === 'rateio'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-black/40 text-slate-300 hover:text-white border border-white/10'
            }`}
          >
            Rateio & Comissões (Área do Financeiro)
          </button>
          <button
            type="button"
            onClick={() => setSubAreaFinanceiro('consumer_api')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors inline-flex items-center gap-1.5 ${
              subAreaFinanceiro === 'consumer_api'
                ? 'bg-cyan-400 text-slate-950'
                : 'bg-cyan-950/50 text-cyan-300 hover:text-white border border-cyan-500/40'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>
              PDV Consumer: Urutau.exe &amp; Planilhas ({consumerFilaCautelosa.length} na fila)
            </span>
          </button>
        </div>
      </div>

      {subAreaFinanceiro === 'rateio' ? (
        <RateioTab
          data={data}
          onRefresh={onRefresh}
          showAlert={showAlert}
          showConfirm={showConfirm}
          currentUser={currentUser}
          {...restProps}
        />
      ) : subAreaFinanceiro === 'consumer_api' ? (
        <div className="space-y-6">
          <div className="bg-[#0B1518] border border-cyan-500/35 rounded-xl p-5 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    DUPLA OPÇÃO: BINÁRIO FECHADO URUTAU.EXE + PLANILHAS CONSUMER
                  </span>
                  <h2 className="text-base font-bold text-white">
                    Central de Lançamento Cauteloso do Urutau ERP no PDV Consumer
                  </h2>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Escolha livremente entre usar a <strong>Fila Cautelosa 1 por 1 integrada ao Menu Lateral Recolhível do Urutau.exe</strong> (sem arquivos .bat e sem códigos abertos) ou <strong>Baixar as Planilhas no Layout Oficial do Consumer</strong>.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={consumerLoading}
                  onClick={handleSincronizarDiaConsumer}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${consumerLoading ? 'animate-spin' : ''}`} />
                  <span>Enviar Movimentos de Hoje para a Fila Cautelosa</span>
                </button>
                <button
                  type="button"
                  disabled={consumerLoading}
                  onClick={handleSalvarConfigConsumer}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-[#10B981] hover:bg-[#34D399] text-[#04120C] cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Salvar Preferências</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#071418] border-2 border-emerald-500/50 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500 text-slate-950">
                    OPÇÃO 1 • EXECUTÁVEL FECHADO URUTAU.EXE + FILA CAUTELOSA (1 A 1)
                  </span>
                  <span className="text-[11px] font-mono text-emerald-300 font-bold">
                    Conferência 1 a 1
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white">
                  Conferência Cautelosa Individual (Sem .BAT e Sem Códigos Abertos)
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Ao executar programas no <strong>Urutau.exe</strong>, o menu lateral recolhe na esquerda e amplia ao clicar, exibindo a fila de lançamentos que o Urutau está enviando para você <strong>checar e confirmar um por um com cautela</strong>, impedindo erros em massa.
                </p>

                {!itemAtualFila ? (
                  <div className="p-3.5 text-center bg-[#0B1518] border border-white/10 rounded-lg space-y-1">
                    <div className="text-xs font-bold text-emerald-300">
                      Fila de Conferência Limpa!
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Todos os lançamentos enviados pelo Urutau já foram conferidos individualmente.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-[#0B1518] border border-cyan-500/40 rounded-lg space-y-2.5">
                    <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        ITEM {indiceItemCauteloso + 1} DE {consumerFilaCautelosa.length} •{' '}
                        {itemAtualFila.modulo}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {itemAtualFila.id}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs font-bold text-white leading-snug">
                        {itemAtualFila.resumo}
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-slate-400">Operação no Consumer:</span>
                        <span className="font-mono text-[11px] text-amber-300">
                          {itemAtualFila.operacao_consumer}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Valor para Conferência:</span>
                        <span className="font-mono text-sm font-black text-emerald-400">
                          {formatBRL(Number(itemAtualFila.valor_referencia || 0))}
                        </span>
                      </div>
                    </div>

                    {consumerFilaCautelosa.length > 1 && (
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <button
                          type="button"
                          disabled={indiceItemCauteloso <= 0}
                          onClick={() =>
                            setIndiceItemCauteloso(Math.max(0, indiceItemCauteloso - 1))
                          }
                          className="px-2 py-1 rounded bg-slate-800 text-[10px] text-slate-300 disabled:opacity-40 cursor-pointer"
                        >
                          &lt; Anterior
                        </button>
                        <span className="text-[10px] font-mono text-slate-400">
                          Item ({indiceItemCauteloso + 1}/{consumerFilaCautelosa.length})
                        </span>
                        <button
                          type="button"
                          disabled={indiceItemCauteloso >= consumerFilaCautelosa.length - 1}
                          onClick={() =>
                            setIndiceItemCauteloso(
                              Math.min(
                                consumerFilaCautelosa.length - 1,
                                indiceItemCauteloso + 1
                              )
                            )
                          }
                          className="px-2 py-1 rounded bg-slate-800 text-[10px] text-slate-300 disabled:opacity-40 cursor-pointer"
                        >
                          Próximo &gt;
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleCopiarDadosItemConsumer(itemAtualFila)}
                      className="w-full py-1.5 px-3 rounded bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-200 text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>
                        {copiadoFeedbackId === itemAtualFila.id
                          ? 'Dados Copiados! Cole no Consumer'
                          : '1. Copiar Valor/Descrição para o Consumer'}
                      </span>
                    </button>

                    <label className="flex items-start gap-2 p-2 rounded bg-black/40 border border-emerald-500/30 text-[11px] text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checkCautelaMarcado}
                        onChange={(e) => setCheckCautelaMarcado(e.target.checked)}
                        className="mt-0.5"
                      />
                      <span>
                        Conferi individualmente o valor (
                        <strong>{formatBRL(Number(itemAtualFila.valor_referencia || 0))}</strong>) e
                        confirmo este lançamento no Consumer.
                      </span>
                    </label>

                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <button
                        type="button"
                        disabled={consumerLoading}
                        onClick={() =>
                          handleConferirItemIndividual(itemAtualFila, 'APROVAR_E_LANCAR')
                        }
                        className={`col-span-2 py-2 px-3 rounded text-xs font-bold flex items-center justify-center gap-1 cursor-pointer ${
                          checkCautelaMarcado
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-[#04120C]'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>2. Confirmar (1 a 1)</span>
                      </button>
                      <button
                        type="button"
                        disabled={consumerLoading}
                        onClick={() =>
                          handleConferirItemIndividual(itemAtualFila, 'REJEITAR_DESCARTAR')
                        }
                        className="py-2 px-2 rounded bg-rose-950/70 hover:bg-rose-900 border border-rose-500/40 text-rose-200 text-[11px] font-semibold cursor-pointer"
                      >
                        Rejeitar
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <a
                    href={`/api/integracoes/consumer/baixar-executavel-windows/${empIdAtual}`}
                    download="Urutau.exe"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-[#04120C] cursor-pointer"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    <span>Baixar Binário Fechado Urutau.exe (Windows)</span>
                  </a>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#071418] border-2 border-cyan-500/50 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-400 text-slate-950">
                    OPÇÃO 2 • IMPORTAÇÃO VIA PLANILHA OFICIAL CONSUMER
                  </span>
                  <label className="inline-flex items-center gap-1.5 text-[11px] text-cyan-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportarApenasConferidos}
                      onChange={(e) => setExportarApenasConferidos(e.target.checked)}
                    />
                    <span>Exportar apenas itens conferidos</span>
                  </label>
                </div>
                <h3 className="text-sm font-bold text-white">
                  Baixar no Layout de Planilha do PDV Consumer (Sem Instalar Nada)
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Gera as planilhas prontas no formato aceito pelo <strong>Programa Consumer</strong> para você importar quando preferir, mantendo total controle sobre o que entra no Caixa, no Estoque e no Cadastro de Clientes.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <a
                    href={`/api/integracoes/consumer/exportar-planilha/${empIdAtual}?tipo=caixa_contas&apenas_conferidos=${exportarApenasConferidos}`}
                    download
                    className="px-3 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-200 text-xs font-bold text-center cursor-pointer"
                  >
                    Planilha Caixa &amp; Contas
                  </a>
                  <a
                    href={`/api/integracoes/consumer/exportar-planilha/${empIdAtual}?tipo=estoque_produtos&apenas_conferidos=${exportarApenasConferidos}`}
                    download
                    className="px-3 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-200 text-xs font-bold text-center cursor-pointer"
                  >
                    Planilha Estoque &amp; Insumos
                  </a>
                  <a
                    href={`/api/integracoes/consumer/exportar-planilha/${empIdAtual}?tipo=clientes_mesas&apenas_conferidos=${exportarApenasConferidos}`}
                    download
                    className="px-3 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-bold text-center cursor-pointer"
                  >
                    Planilha Clientes &amp; Mesas
                  </a>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3 bg-[#071013] border border-amber-500/40 rounded-lg">
                <div className="text-[11px] text-amber-200">Aguardando Conferência (1 a 1)</div>
                <div className="text-lg font-mono font-bold text-amber-400 mt-0.5">
                  {consumerFilaCautelosa.length}
                </div>
              </div>
              <div className="p-3 bg-[#071013] border border-emerald-500/40 rounded-lg">
                <div className="text-[11px] text-emerald-200">Conferidos &amp; Lançados</div>
                <div className="text-lg font-mono font-bold text-emerald-400 mt-0.5">
                  {consumerResumo.conferidos_count || 0}
                </div>
              </div>
              <div className="p-3 bg-[#071013] border border-cyan-500/30 rounded-lg">
                <div className="text-[11px] text-slate-400">Caixa (Suprimento/Sangria)</div>
                <div className="text-lg font-mono font-bold text-cyan-300 mt-0.5">
                  {consumerResumo.caixa_count}
                </div>
              </div>
              <div className="p-3 bg-[#071013] border border-purple-500/30 rounded-lg">
                <div className="text-[11px] text-slate-400">Mesas &amp; Estoque</div>
                <div className="text-lg font-mono font-bold text-purple-300 mt-0.5">
                  {Number(consumerResumo.mesas_count || 0) + Number(consumerResumo.estoque_count || 0)}
                </div>
              </div>
              <div className="p-3 bg-[#071013] border border-rose-500/30 rounded-lg col-span-2 sm:col-span-1">
                <div className="text-[11px] text-slate-400">Rejeitados na Conferência</div>
                <div className="text-lg font-mono font-bold text-rose-400 mt-0.5">
                  {consumerResumo.rejeitados_count || 0}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2">
              <div className="p-4 bg-[#071013] border border-white/10 rounded-xl space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                    1. Modo de Segurança Cautelosa e Parâmetros do Caixa
                  </h3>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(consumerConfig.ativo)}
                      onChange={(e) =>
                        setConsumerConfig({ ...consumerConfig, ativo: e.target.checked })
                      }
                      className="rounded border-slate-700"
                    />
                    <span>Integração Ativa</span>
                  </label>
                </div>

                <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/40 space-y-2">
                  <label className="flex items-start gap-2.5 text-xs text-emerald-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(consumerConfig.conferencia_cautelosa_individual)}
                      onChange={(e) =>
                        setConsumerConfig({
                          ...consumerConfig,
                          conferencia_cautelosa_individual: e.target.checked
                        })
                      }
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-bold text-white">
                        Exigir Conferência Cautelosa Individual (1 por 1) antes de Lançar
                      </div>
                      <div className="text-[11px] text-slate-300 mt-0.5">
                        Recomendado: Nenhum lançamento entra em lote sem antes passar pela sua checagem visual individual (1 por 1).
                      </div>
                    </div>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Método Principal Escolhido pelo Operador
                    </label>
                    <select
                      value={consumerConfig.modo_conexao || 'botao_flutuante_exe'}
                      onChange={(e) =>
                        setConsumerConfig({ ...consumerConfig, modo_conexao: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-[#0B1518] border border-slate-700 rounded text-xs text-white"
                    >
                      <option value="botao_flutuante_exe">
                        Executável Fechado Urutau.exe (Menu Lateral Recolhível + Fila Cautelosa 1 a 1)
                      </option>
                      <option value="planilha_consumer">
                        Exportação de Planilha Oficial Consumer + Conferência Prévia
                      </option>
                      <option value="api_direta">
                        Envio via API Local / Webhook Direto para o Terminal
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Token de Segurança da Fila (X-Consumer-Token)
                    </label>
                    <input
                      type="text"
                      value={consumerConfig.api_token || ''}
                      onChange={(e) =>
                        setConsumerConfig({ ...consumerConfig, api_token: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-[#0B1518] border border-slate-700 rounded text-xs font-mono text-amber-300"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Código Loja</label>
                      <input
                        type="text"
                        value={consumerConfig.codigo_loja || ''}
                        onChange={(e) =>
                          setConsumerConfig({ ...consumerConfig, codigo_loja: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-[#0B1518] border border-slate-700 rounded text-xs font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Terminal Caixa</label>
                      <input
                        type="text"
                        value={consumerConfig.terminal_caixa || ''}
                        onChange={(e) =>
                          setConsumerConfig({ ...consumerConfig, terminal_caixa: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-[#0B1518] border border-slate-700 rounded text-xs font-mono text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10 space-y-2">
                  <div className="text-[11px] font-bold text-slate-300">
                    Módulos do Urutau que Alimentam a Fila do Consumer Automaticamente:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-200">
                    <label className="flex items-center gap-2 p-2 rounded bg-[#0B1518] border border-white/5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(consumerConfig.auto_lancar_caixa)}
                        onChange={(e) =>
                          setConsumerConfig({
                            ...consumerConfig,
                            auto_lancar_caixa: e.target.checked
                          })
                        }
                      />
                      <span>Caixa (Entradas, Sangrias e Suprimentos)</span>
                    </label>
                    <label className="flex items-center gap-2 p-2 rounded bg-[#0B1518] border border-white/5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(consumerConfig.auto_lancar_reservas_mesas)}
                        onChange={(e) =>
                          setConsumerConfig({
                            ...consumerConfig,
                            auto_lancar_reservas_mesas: e.target.checked
                          })
                        }
                      />
                      <span>Reservas (Abrir Mesas e Comandas)</span>
                    </label>
                    <label className="flex items-center gap-2 p-2 rounded bg-[#0B1518] border border-white/5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(consumerConfig.auto_lancar_estoque_compras)}
                        onChange={(e) =>
                          setConsumerConfig({
                            ...consumerConfig,
                            auto_lancar_estoque_compras: e.target.checked
                          })
                        }
                      />
                      <span>Estoque &amp; Compras (Entrada de Notas)</span>
                    </label>
                    <label className="flex items-center gap-2 p-2 rounded bg-[#0B1518] border border-white/5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(consumerConfig.auto_lancar_rateio)}
                        onChange={(e) =>
                          setConsumerConfig({
                            ...consumerConfig,
                            auto_lancar_rateio: e.target.checked
                          })
                        }
                      />
                      <span>Rateio 10% (Comissões de Garçons)</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-[#071013] border border-emerald-500/30 rounded-xl space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                    2. Enviar Novo Lançamento para a Fila Cautelosa do Consumer
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">
                    Destino: {consumerConfig.terminal_caixa}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Tipo de Operação no PDV Consumer
                    </label>
                    <select
                      value={lancamentoRapidoConsumer.modulo}
                      onChange={(e) =>
                        setLancamentoRapidoConsumer({
                          ...lancamentoRapidoConsumer,
                          modulo: e.target.value
                        })
                      }
                      className="w-full px-3 py-2 bg-[#0B1518] border border-slate-700 rounded text-xs text-white font-semibold"
                    >
                      <option value="PEDIDO_PDV">
                        Lançar Pedido / Itens em Mesa ou Comanda no Consumer
                      </option>
                      <option value="CAIXA">
                        Lançar Suprimento (Entrada) ou Sangria (Saída) no Caixa do Consumer
                      </option>
                      <option value="MESA_COMANDA">
                        Abrir Mesa / Comanda no Mapa de Mesas do Consumer
                      </option>
                      <option value="ESTOQUE_COMPRA">
                        Dar Entrada de Mercadoria / Insumo no Estoque do Consumer
                      </option>
                    </select>
                  </div>

                  {(lancamentoRapidoConsumer.modulo === 'PEDIDO_PDV' ||
                    lancamentoRapidoConsumer.modulo === 'MESA_COMANDA') && (
                    <>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">
                          Nº da Mesa ou Comanda no Consumer
                        </label>
                        <input
                          type="text"
                          value={lancamentoRapidoConsumer.mesa_comanda}
                          onChange={(e) =>
                            setLancamentoRapidoConsumer({
                              ...lancamentoRapidoConsumer,
                              mesa_comanda: e.target.value
                            })
                          }
                          placeholder="Ex: 12"
                          className="w-full px-3 py-2 bg-[#0B1518] border border-slate-700 rounded text-xs font-mono text-amber-300"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">
                          Cliente / Identificação da Comanda
                        </label>
                        <input
                          type="text"
                          value={lancamentoRapidoConsumer.cliente}
                          onChange={(e) =>
                            setLancamentoRapidoConsumer({
                              ...lancamentoRapidoConsumer,
                              cliente: e.target.value
                            })
                          }
                          className="w-full px-3 py-2 bg-[#0B1518] border border-slate-700 rounded text-xs text-white"
                        />
                      </div>
                    </>
                  )}

                  {lancamentoRapidoConsumer.modulo === 'CAIXA' && (
                    <>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">
                          Tipo no Caixa Consumer
                        </label>
                        <select
                          value={lancamentoRapidoConsumer.tipo_caixa}
                          onChange={(e) =>
                            setLancamentoRapidoConsumer({
                              ...lancamentoRapidoConsumer,
                              tipo_caixa: e.target.value
                            })
                          }
                          className="w-full px-3 py-2 bg-[#0B1518] border border-slate-700 rounded text-xs text-white"
                        >
                          <option value="Entrada">Suprimento / Receita (Entrada)</option>
                          <option value="Saída">Sangria / Pagamento (Saída)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">
                          Plano de Contas / Categoria
                        </label>
                        <input
                          type="text"
                          value={lancamentoRapidoConsumer.categoria_caixa}
                          onChange={(e) =>
                            setLancamentoRapidoConsumer({
                              ...lancamentoRapidoConsumer,
                              categoria_caixa: e.target.value
                            })
                          }
                          className="w-full px-3 py-2 bg-[#0B1518] border border-slate-700 rounded text-xs text-white"
                        />
                      </div>
                    </>
                  )}

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-slate-400 mb-1">
                      {lancamentoRapidoConsumer.modulo === 'PEDIDO_PDV'
                        ? 'Produto / Prato / Bebida a Lançar na Mesa'
                        : lancamentoRapidoConsumer.modulo === 'ESTOQUE_COMPRA'
                        ? 'Nome do Insumo / Produto no Consumer'
                        : 'Descrição / Observação do Lançamento'}
                    </label>
                    <input
                      type="text"
                      value={lancamentoRapidoConsumer.produto_descricao}
                      onChange={(e) =>
                        setLancamentoRapidoConsumer({
                          ...lancamentoRapidoConsumer,
                          produto_descricao: e.target.value
                        })
                      }
                      className="w-full px-3 py-2 bg-[#0B1518] border border-slate-700 rounded text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      {lancamentoRapidoConsumer.modulo === 'MESA_COMANDA'
                        ? 'Quantidade de Pessoas na Mesa'
                        : 'Quantidade'}
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={lancamentoRapidoConsumer.quantidade}
                      onChange={(e) =>
                        setLancamentoRapidoConsumer({
                          ...lancamentoRapidoConsumer,
                          quantidade: Number(e.target.value)
                        })
                      }
                      className="w-full px-3 py-2 bg-[#0B1518] border border-slate-700 rounded text-xs font-mono text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Valor Unitário / Total (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={lancamentoRapidoConsumer.valor}
                      onChange={(e) =>
                        setLancamentoRapidoConsumer({
                          ...lancamentoRapidoConsumer,
                          valor: Number(e.target.value)
                        })
                      }
                      className="w-full px-3 py-2 bg-[#0B1518] border border-slate-700 rounded text-xs font-mono font-bold text-emerald-400"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(lancamentoRapidoConsumer.gravar_no_urutau)}
                      onChange={(e) =>
                        setLancamentoRapidoConsumer({
                          ...lancamentoRapidoConsumer,
                          gravar_no_urutau: e.target.checked
                        })
                      }
                    />
                    <span>Registrar simultaneamente no Livro Caixa / Salão do Urutau</span>
                  </label>

                  <button
                    type="button"
                    disabled={consumerLoading}
                    onClick={handleDispararRapidoConsumer}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold bg-cyan-400 hover:bg-cyan-300 text-slate-950 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Enviar para Fila Cautelosa do Consumer</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#11151E] border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Fila de Conferência Cautelosa (1 por 1) &amp; Histórico de Lançamentos Consumer
                </h3>
                <p className="text-[11px] text-slate-400">
                  Confira cada lançamento individualmente antes de efetivar no PDV Consumer para evitar erros em massa.
                </p>
              </div>
              <button
                type="button"
                onClick={carregarStatusConsumer}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer"
              >
                Atualizar Fila
              </button>
            </div>

            {consumerLogs.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Nenhum lançamento na fila no momento. Salve um item no Caixa, Reserva ou Estoque, ou utilize o formulário acima para enviar à fila do PDV Consumer.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-[#0B0D11] text-[11px] font-mono uppercase text-slate-400">
                      <th className="py-2.5 px-4">Protocolo / Horário</th>
                      <th className="py-2.5 px-4">Módulo Consumer</th>
                      <th className="py-2.5 px-4">Descrição do Lançamento</th>
                      <th className="py-2.5 px-4 text-right">Valor Ref.</th>
                      <th className="py-2.5 px-4 text-center">Status Conferência</th>
                      <th className="py-2.5 px-4 text-right">Ação Individual (1 a 1)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {consumerLogs.map((log: any) => {
                      const isPendente =
                        log.status === 'AGUARDANDO_CONFERENCIA_CAUTELOSA' ||
                        log.status === 'DISPONIVEL_FILA_CONSUMER';
                      return (
                        <tr key={log.id} className="hover:bg-white/5">
                          <td className="py-2.5 px-4 font-mono text-[11px] text-slate-300">
                            <div className="font-bold text-cyan-300">{log.id}</div>
                            <div className="text-[10px] text-slate-500">
                              {new Date(log.criado_em).toLocaleString('pt-BR')}
                            </div>
                          </td>
                          <td className="py-2.5 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-200 border border-slate-700">
                              {log.modulo}
                            </span>
                            <div className="text-[10px] font-mono text-amber-300 mt-0.5">
                              {log.operacao_consumer}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-slate-200">{log.resumo}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-400">
                            {formatBRL(Number(log.valor_referencia || 0))}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                log.status === 'CONFERIDO_LANCADO_CONSUMER' ||
                                log.status === 'CONFIRMADO_TERMINAL' ||
                                log.status === 'ENVIADO_API_DIRETA'
                                  ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
                                  : log.status === 'REJEITADO_PELO_OPERADOR'
                                  ? 'bg-rose-950/60 text-rose-300 border border-rose-500/40'
                                  : 'bg-amber-950/60 text-amber-300 border border-amber-500/40'
                              }`}
                            >
                              {log.status === 'CONFERIDO_LANCADO_CONSUMER' ||
                              log.status === 'CONFIRMADO_TERMINAL'
                                ? 'CONFERIDO E LANÇADO'
                                : log.status === 'REJEITADO_PELO_OPERADOR'
                                ? 'REJEITADO / DESCARTADO'
                                : 'AGUARDANDO CONFERÊNCIA 1 A 1'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              {isPendente && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const idxFila = consumerFilaCautelosa.findIndex(
                                      (f) => f.id === log.id
                                    );
                                    if (idxFila >= 0) setIndiceItemCauteloso(idxFila);
                                  }}
                                  className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-[#04120C] text-[11px] font-bold cursor-pointer"
                                >
                                  Selecionar na Fila (1 a 1)
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setPayloadInspecionado(log)}
                                className="px-2.5 py-1 rounded bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-[11px] font-mono cursor-pointer"
                              >
                                Ver Dados
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {payloadInspecionado && (
            <FocusFormModal
              open={Boolean(payloadInspecionado)}
              title={`Pacote API PDV Consumer • ${payloadInspecionado.id}`}
              subtitle="Estrutura enviada pelo Urutau ERP para conferência no PDV Consumer"
              onClose={() => setPayloadInspecionado(null)}
              onSave={() => setPayloadInspecionado(null)}
            >
              <div className="space-y-3">
                <div className="text-xs text-slate-300">
                  Operação: <strong className="text-amber-300">{payloadInspecionado.operacao_consumer}</strong>
                </div>
                <pre className="p-3 bg-[#07090D] border border-slate-800 rounded-lg text-[11px] font-mono text-cyan-200 overflow-x-auto max-h-96">
                  {JSON.stringify(payloadInspecionado.payload_consumer, null, 2)}
                </pre>
              </div>
            </FocusFormModal>
          )}
        </div>
      ) : (
        <>
          <div className="bg-[#11151E] border border-slate-800/90 rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-100">
                  Financeiro • Livro Caixa &amp; Pagamentos de RH
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Lançamentos salvos aqui vão para a Fila Cautelosa do PDV Consumer ({consumerConfig.codigo_loja} • {consumerConfig.terminal_caixa}).
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFechamentoDiarioAberto(!fechamentoDiarioAberto)}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded cursor-pointer transition-colors ${
                    fechamentoDiarioAberto
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-900/60'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>
                    {fechamentoDiarioAberto
                      ? 'Ocultar Fechamento Diário em Massa'
                      : 'Abrir Fechamento Diário & Registro em Massa'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForm({
                      id: null,
                      data: getTodayISO(),
                      tipo: 'Entrada',
                      categoria: 'Faturamento Salão',
                      descricao: '',
                      expressao: '10 * 145 + 10%',
                      valor: 1450.1,
                      unidade_id: effectiveUnidadesIds[0] || 1,
                      usuario_id: 1
                    });
                    setModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Novo Lançamento Individual</span>
                </button>
              </div>
            </div>

            <UnidadesMultiSelectControl
              unidadesPermitidas={unidadesPermitidas}
              selectedUnidadesIds={effectiveUnidadesIds}
              onChangeSelectedIds={setUnidadesSelecionadasIds}
              label="Unidades do Caixa"
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800">
              <div className="p-3.5 bg-[#0B0D11] border border-slate-800 rounded">
                <div className="text-xs text-slate-400">Total de Entradas</div>
                <div className="text-base font-mono font-bold text-emerald-400 tabular-nums">
                  {formatBRL(resumoCaixa.entradas)}
                </div>
              </div>
              <div className="p-3.5 bg-[#0B0D11] border border-slate-800 rounded">
                <div className="text-xs text-slate-400">Total de Saídas</div>
                <div className="text-base font-mono font-bold text-rose-400 tabular-nums">
                  {formatBRL(resumoCaixa.saidas)}
                </div>
              </div>
              <div
                data-urutau-anomaly={resumoCaixa.saldo < 0 ? 'true' : undefined}
                className="p-3.5 bg-[#0B0D11] border border-amber-500/30 rounded"
              >
                <div className="text-xs text-amber-300">Saldo Operacional Líquido</div>
                <div className="text-base font-mono font-bold text-amber-400 tabular-nums">
                  {formatBRL(resumoCaixa.saldo)}
                </div>
              </div>
            </div>
          </div>

          {fechamentoDiarioAberto && (
            <FechamentoCaixaDiarioPanel
              data={data}
              unidadesPermitidas={unidadesPermitidas}
              effectiveUnidadesIds={effectiveUnidadesIds}
              currentUser={currentUser}
              onRefresh={onRefresh}
              showAlert={showAlert}
              showConfirm={showConfirm}
              onEditCaixaItem={(c: any) => {
                setForm({ ...c });
                setModalOpen(true);
              }}
            />
          )}

          <UrutauDateMultiView
            title="Lançamentos do Livro Caixa por Data"
            items={caixaFiltrado}
            getDateISO={(c: any) => c.data}
            getTitle={(c: any) => `${c.descricao || c.categoria}`}
            getSubtitle={(c: any) =>
              `${c.categoria}${c.expressao ? ` • Calc: ${c.expressao}` : ''} • Fila Cautelosa Consumer`
            }
            getBadge={(c: any) => ({
              text: c.tipo,
              colorClass: c.tipo === 'Entrada' ? 'text-emerald-400' : 'text-rose-400'
            })}
            getRightMeta={(c: any) =>
              `${c.tipo === 'Saída' ? '- ' : '+ '}${formatBRL(c.valor)}`
            }
            onEditItem={(c: any) => {
              setForm({ ...c });
              setModalOpen(true);
            }}
            onCreateAtDate={(iso: string) => {
              setForm({
                id: null,
                data: iso,
                tipo: 'Entrada',
                categoria: 'Faturamento Salão',
                descricao: '',
                expressao: '10 * 145 + 10%',
                valor: 1450.1,
                unidade_id: effectiveUnidadesIds[0] || 1,
                usuario_id: 1
              });
              setModalOpen(true);
            }}
            createButtonLabel="Novo Lançamento"
          />

          <FocusFormModal
            open={modalOpen}
            title={form.id ? 'Editar Lançamento de Caixa' : 'Novo Lançamento de Caixa'}
            subtitle="Utilize a calculadora de expressões matemáticas (+, -, *, /, %) para apuração imediata"
            onClose={() => setModalOpen(false)}
            onSave={handleSave}
            onArchive={form.id ? () => handleArchive(form.id) : undefined}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Tipo de Movimento</label>
                <select
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
                >
                  <option value="Entrada">Entrada (Receita / Faturamento)</option>
                  <option value="Saída">Saída (Despesa / Sangria / Fornecedor)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Data</label>
                <input
                  type="date"
                  value={form.data}
                  onChange={(e) => setForm({ ...form, data: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs font-mono text-slate-100"
                />
              </div>
              <div>
                <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                  <label className="block text-xs text-slate-400">Categoria de Conta</label>
                  <button
                    type="button"
                    onClick={() => {
                      setNovaCatContaForm({
                        nome: '',
                        tipo: form.tipo === 'Saída' ? 'Saída' : 'Entrada',
                        modo_padrao: 'mesclado'
                      });
                      setCriandoCatContaInline((v) => !v);
                    }}
                    className="text-[11px] font-bold text-[#10B981] hover:text-[#34D399] cursor-pointer"
                  >
                    {criandoCatContaInline ? 'Cancelar' : '+ Criar Categoria de Conta'}
                  </button>
                </div>
                <select
                  value={form.categoria}
                  onChange={(e) => {
                    if (e.target.value === '__NEW_CATEGORIA__') {
                      setNovaCatContaForm({
                        nome: '',
                        tipo: form.tipo === 'Saída' ? 'Saída' : 'Entrada',
                        modo_padrao: 'mesclado'
                      });
                      setCriandoCatContaInline(true);
                      return;
                    }
                    setForm({ ...form, categoria: e.target.value });
                  }}
                  className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
                >
                  <optgroup label={`Categorias de ${form.tipo || 'Entrada'}`}>
                    {categoriasDeContaCatalog
                      .filter((c) => c.tipo === (form.tipo || 'Entrada'))
                      .map((c) => (
                        <option key={`p-${c.nome}`} value={c.nome}>
                          {c.nome}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Outras Categorias de Conta">
                    {categoriasDeContaCatalog
                      .filter((c) => c.tipo !== (form.tipo || 'Entrada'))
                      .map((c) => (
                        <option key={`o-${c.nome}`} value={c.nome}>
                          {c.nome} ({c.tipo})
                        </option>
                      ))}
                  </optgroup>
                  <option value="__NEW_CATEGORIA__">+ Criar nova Categoria de Conta...</option>
                </select>
              </div>
              {criandoCatContaInline && (
                <div className="sm:col-span-2 p-3.5 rounded-xl bg-[#071712] border border-[#10B981]/50 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-[#10B981]">
                        Criar Nova Categoria de Conta (Plano de Contas &amp; Fechamento de Caixa)
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        A categoria criada já fica vinculada a este lançamento e disponível no Fechamento Diário de Caixa.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCriandoCatContaInline(false)}
                      className="text-xs text-slate-400 hover:text-white cursor-pointer"
                    >
                      Fechar
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-300 mb-1">
                        Nome da Categoria de Conta *
                      </label>
                      <input
                        type="text"
                        value={novaCatContaForm.nome}
                        onChange={(e) =>
                          setNovaCatContaForm((prev) => ({ ...prev, nome: e.target.value }))
                        }
                        placeholder="Ex: Couvert Artístico, Energia, Embalagens..."
                        className="w-full px-2.5 py-1.5 bg-[#05100C] border border-slate-700 rounded text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-300 mb-1">
                        Natureza da Conta
                      </label>
                      <select
                        value={novaCatContaForm.tipo}
                        onChange={(e) =>
                          setNovaCatContaForm((prev) => ({
                            ...prev,
                            tipo: e.target.value as 'Entrada' | 'Saída'
                          }))
                        }
                        className="w-full px-2.5 py-1.5 bg-[#05100C] border border-slate-700 rounded text-xs text-white"
                      >
                        <option value="Entrada">Entrada (Receita)</option>
                        <option value="Saída">Saída (Despesa / Custos)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-300 mb-1">
                        Apuração no Fechamento
                      </label>
                      <select
                        value={novaCatContaForm.modo_padrao}
                        onChange={(e) =>
                          setNovaCatContaForm((prev) => ({
                            ...prev,
                            modo_padrao: e.target.value as 'mesclado' | 'sistema' | 'manual'
                          }))
                        }
                        className="w-full px-2.5 py-1.5 bg-[#05100C] border border-slate-700 rounded text-xs text-white"
                      >
                        <option value="mesclado">Mesclado (Sistema + Manual)</option>
                        <option value="sistema">Automático do Caixa</option>
                        <option value="manual">Apenas Digitação Manual</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={salvandoCatContaInline}
                      onClick={handleCriarCategoriaContaInline}
                      className="px-4 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#34D399] text-[#05100C] text-xs font-bold cursor-pointer disabled:opacity-50"
                    >
                      {salvandoCatContaInline
                        ? 'Salvando...'
                        : 'Criar Categoria e Vincular ao Lançamento'}
                    </button>
                  </div>
                </div>
              )}
              {unidadesPermitidas.length > 1 && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Unidade</label>
                  <select
                    value={form.unidade_id}
                    onChange={(e) => setForm({ ...form, unidade_id: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
                  >
                    {unidadesPermitidas.map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Descrição Detalhada</label>
                <input
                  type="text"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
                />
              </div>

              <div className="p-4 bg-[#0B0D11] border border-amber-500/30 rounded-lg sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-amber-400 mb-1">
                    Calculadora de Expressão Matemática (+, -, *, /, %)
                  </label>
                  <input
                    type="text"
                    value={form.expressao}
                    onChange={(e) => handleExpressaoChange(e.target.value)}
                    placeholder="Ex: 15 * 89.90 - 50"
                    className="w-full px-3 py-2 bg-[#11151E] border border-slate-700 rounded text-xs font-mono text-amber-300"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Valor Calculado (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.valor}
                    onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-[#11151E] border border-slate-700 rounded text-xs font-mono font-bold text-emerald-400 tabular-nums"
                  />
                </div>
              </div>
            </div>
          </FocusFormModal>
        </>
      )}
    </div>
  );
}

export function calcularStatusVencimento(dataISO?: string) {
  if (!dataISO || !dataISO.trim()) {
    return { dias: null, label: 'Sem data', cor: 'text-slate-400 bg-slate-800/40 border-slate-700/50', nivel: 'indefinido' };
  }
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const [y, m, d] = String(dataISO).split('-').map(Number);
  if (!y || !m || !d) return { dias: null, label: 'Inválido', cor: 'text-slate-400 bg-slate-800/40 border-slate-700/50', nivel: 'indefinido' };
  const alvo = new Date(y, m - 1, d);
  const diffMs = alvo.getTime() - hoje.getTime();
  const dias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (dias < 0) {
    return { dias, label: ` Vencido (${Math.abs(dias)}d atrás)`, cor: 'text-rose-400 bg-rose-950/40 border-rose-500/60 font-bold', nivel: 'vencido' };
  }
  if (dias === 0) {
    return { dias, label: ' Vence Hoje!', cor: 'text-rose-400 bg-rose-950/60 border-rose-500 font-bold animate-pulse', nivel: 'critico' };
  }
  if (dias <= 7) {
    return { dias, label: ` Vence em ${dias}d`, cor: 'text-amber-400 bg-amber-950/40 border-amber-500/50 font-bold', nivel: 'alerta' };
  }
  if (dias <= 30) {
    return { dias, label: ` Vence em ${dias}d`, cor: 'text-amber-300 bg-amber-950/20 border-amber-500/30 font-semibold', nivel: 'aviso' };
  }
  return { dias, label: ` Válido (${dias}d)`, cor: 'text-emerald-400 bg-emerald-950/20 border-emerald-500/30', nivel: 'ok' };
}

export function EstoqueTab({ data, onRefresh, showAlert, showConfirm }: CommonTabProps) {
  const [termoBusca, setTermoBusca] = useState('');
  const [resultadosFTS, setResultadosFTS] = useState<any[] | null>(null);
  const [visaoIntegrada, setVisaoIntegrada] = useState<'integrado' | 'estoque' | 'compras'>('integrado');
  const [filtroNivel, setFiltroNivel] = useState<'todos' | 'repor' | 'vencimento' | 'ok'>('todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [receberModalOpen, setReceberModalOpen] = useState(false);
  const [itemAlvo, setItemAlvo] = useState<any>(null);
  const [qtdCompra, setQtdCompra] = useState<number>(20);
  const [custoCompra, setCustoCompra] = useState<number>(0);
  const [lancarCaixa, setLancarCaixa] = useState<boolean>(true);

  const [cadastrarComoLote, setCadastrarComoLote] = useState<boolean>(true);
  const [loteCodigo, setLoteCodigo] = useState<string>('');
  const [loteVencimento, setLoteVencimento] = useState<string>('');
  const [loteObs, setLoteObs] = useState<string>('');

  const [itemExpandidoId, setItemExpandidoId] = useState<number | null>(null);

  const [form, setForm] = useState<any>({
    id: null,
    nome: '',
    categoria: 'Proteínas & Pescados',
    quantidade: 0,
    unidade_medida: 'kg',
    estoque_minimo: 10,
    custo_unitario: 0,
    fornecedor: '',
    em_compras: false,
    lotes: []
  });

  useEffect(() => {
    if (!termoBusca.trim()) {
      setResultadosFTS(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/erp/busca-fts?q=${encodeURIComponent(termoBusca)}`);
        const json = await res.json();
        setResultadosFTS(json.estoque || []);
      } catch {
        setResultadosFTS(null);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [termoBusca]);

  const listaBase = resultadosFTS !== null ? resultadosFTS : data.estoque;

  const analisarLotesItem = (item: any) => {
    const lotes: any[] = Array.isArray(item.lotes) ? item.lotes : [];
    let loteMaisProximo: any = null;
    let menorDias: number = Infinity;
    let vencidosCount = 0;
    let alerta30Count = 0;

    lotes.forEach((l) => {
      const st = calcularStatusVencimento(l.data_vencimento);
      if (st.dias !== null) {
        if (st.dias < menorDias) {
          menorDias = st.dias;
          loteMaisProximo = l;
        }
        if (st.dias < 0) vencidosCount++;
        else if (st.dias <= 30) alerta30Count++;
      }
    });

    return {
      totalLotes: lotes.length,
      loteMaisProximo,
      menorDias: menorDias === Infinity ? null : menorDias,
      vencidosCount,
      alerta30Count,
      temRiscoVencimento: vencidosCount > 0 || alerta30Count > 0
    };
  };

  const listaExibida = useMemo(() => {
    return (listaBase || []).filter((item) => {
      const critico = item.em_compras || Number(item.quantidade) <= Number(item.estoque_minimo);
      const infoLotes = analisarLotesItem(item);

      if (filtroNivel === 'repor' && !critico) return false;
      if (filtroNivel === 'vencimento' && !infoLotes.temRiscoVencimento) return false;
      if (filtroNivel === 'ok' && (critico || infoLotes.temRiscoVencimento)) return false;
      return true;
    });
  }, [listaBase, filtroNivel]);

  const itensEmReposicao = useMemo(() => {
    return (data.estoque || []).filter(
      (e) => e.em_compras || Number(e.quantidade) <= Number(e.estoque_minimo)
    );
  }, [data.estoque]);

  const itensComVencimentoCritico = useMemo(() => {
    return (data.estoque || []).filter((e) => {
      const info = analisarLotesItem(e);
      return info.temRiscoVencimento;
    });
  }, [data.estoque]);

  const metricasSuprimentos = useMemo(() => {
    const todos = data.estoque || [];
    const valorPatrimonio = todos.reduce(
      (acc, i) => acc + Number(i.quantidade || 0) * Number(i.custo_unitario || 0),
      0
    );
    const orcamentoCompras = itensEmReposicao.reduce((acc, i) => {
      const sugerido = Math.max(10, Number(i.estoque_minimo || 10) * 2 - Number(i.quantidade || 0));
      return acc + sugerido * Number(i.custo_unitario || 0);
    }, 0);
    const fornecedoresUnicos = new Set(
      todos.map((i) => String(i.fornecedor || '').trim()).filter(Boolean)
    ).size;

    let fardosTotais = 0;
    let fardosVencidos = 0;
    todos.forEach((i) => {
      const info = analisarLotesItem(i);
      fardosTotais += info.totalLotes;
      fardosVencidos += info.vencidosCount;
    });

    return {
      totalInsumos: todos.length,
      emReposicao: itensEmReposicao.length,
      valorPatrimonio,
      orcamentoCompras,
      fornecedoresUnicos,
      fardosTotais,
      fardosVencidos,
      comVencimentoCritico: itensComVencimentoCritico.length
    };
  }, [data.estoque, itensEmReposicao, itensComVencimentoCritico]);

  const handleSave = async () => {
    try {
      const res = await fetch('/api/v20/estoque/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || 'Erro ao salvar item de estoque');
      setModalOpen(false);
      await onRefresh();
    } catch (e: any) {
      showAlert('Erro no Estoque & Compras', e.message);
    }
  };

  const handleArchive = (id: number) => {
    showConfirm('Arquivar Insumo do Estoque', 'Confirma o arquivamento lógico deste insumo?', async () => {
      await fetch('/api/erp/arquivar-generico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, tabelaAlvo: 'erp_estoque' })
      });
      setModalOpen(false);
      await onRefresh();
    });
  };

  const handleOpenRecebimento = (item: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const sugerido = Math.max(
      10,
      Number(item.estoque_minimo || 10) * 2 - Number(item.quantidade || 0)
    );
    setItemAlvo(item);
    setQtdCompra(Number(sugerido.toFixed(2)));
    setCustoCompra(Number(item.custo_unitario || 0));
    setLancarCaixa(true);
    setCadastrarComoLote(true);

    const proximoNum = (Array.isArray(item.lotes) ? item.lotes.length : 0) + 1;
    setLoteCodigo(`Fardo #${proximoNum}`);

    const dataSug = new Date();
    dataSug.setDate(dataSug.getDate() + 60);
    setLoteVencimento(dataSug.toISOString().split('T')[0]);
    setLoteObs(`Entrada compra reposição ${new Date().toLocaleDateString('pt-BR')}`);

    setReceberModalOpen(true);
  };

  const handleConfirmarRecebimento = async () => {
    if (!itemAlvo) return;
    try {
      const payload: any = {
        id_estoque: itemAlvo.id,
        quantidade_comprada: qtdCompra,
        custo_unitario_novo: custoCompra,
        lancar_saida_caixa: lancarCaixa
      };

      if (cadastrarComoLote && loteVencimento) {
        payload.lote_vencimento = {
          codigo_lote: loteCodigo || `Fardo ${new Date().toLocaleDateString('pt-BR')}`,
          quantidade: qtdCompra,
          data_vencimento: loteVencimento,
          observacao: loteObs
        };
      }

      const res = await fetch('/api/v20/compras/receber-insumo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || 'Falha ao processar recebimento de compra');
      setReceberModalOpen(false);
      await onRefresh();
      showAlert(
        'Mercadoria Recebida no Estoque',
        `O saldo de "${itemAlvo.nome}" foi acrescido em +${qtdCompra} ${itemAlvo.unidade_medida}${
          cadastrarComoLote ? ` com lote/fardo registrado (validade: ${loteVencimento})` : ''
        }${lancarCaixa ? ' e despesa lançada no Caixa.' : '.'}`
      );
    } catch (e: any) {
      showAlert('Erro em Compras', e.message);
    }
  };

  const handleToggleFilaCompras = async (item: any, flag: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    await fetch('/api/v20/estoque/salvar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...item, em_compras: flag })
    });
    await onRefresh();
  };

  const handleBaixarLote = (item: any, lote: LoteFardoVencimento, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    showConfirm(
      'Baixar / Descartar Fardo do Estoque',
      `Confirma a baixa integral do fardo "${lote.codigo_lote}" (${lote.quantidade} ${lote.unidade_fardo || item.unidade_medida}) com vencimento em ${lote.data_vencimento}? Esta quantidade será abatida do saldo total do estoque.`,
      async () => {
        try {
          const res = await fetch('/api/v20/estoque/baixar-lote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id_estoque: item.id,
              id_lote: lote.id,
              quantidade_baixa: lote.quantidade,
              motivo: 'Baixa por vencimento / uso de fardo'
            })
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.erro || 'Erro ao baixar lote');
          await onRefresh();
          showAlert('Lote Baixado', `Fardo ${lote.codigo_lote} baixado com sucesso. Saldo restante: ${json.saldoRestante} ${item.unidade_medida}`);
        } catch (err: any) {
          showAlert('Erro na Baixa', err.message);
        }
      }
    );
  };

  const handleAdicionarLoteForm = () => {
    const lotesAtuais = Array.isArray(form.lotes) ? [...form.lotes] : [];
    const novoLote: LoteFardoVencimento = {
      id: `lote-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      codigo_lote: `Fardo #${lotesAtuais.length + 1}`,
      quantidade: 5,
      unidade_fardo: form.unidade_medida || 'kg',
      data_vencimento: new Date(Date.now() + 45 * 86400000).toISOString().split('T')[0],
      observacao: ''
    };
    setForm({ ...form, lotes: [...lotesAtuais, novoLote] });
  };

  const handleAtualizarLoteForm = (index: number, campo: keyof LoteFardoVencimento, valor: any) => {
    const lotesAtuais = Array.isArray(form.lotes) ? [...form.lotes] : [];
    if (!lotesAtuais[index]) return;
    lotesAtuais[index] = { ...lotesAtuais[index], [campo]: valor };
    setForm({ ...form, lotes: lotesAtuais });
  };

  const handleRemoverLoteForm = (index: number) => {
    const lotesAtuais = Array.isArray(form.lotes) ? [...form.lotes] : [];
    lotesAtuais.splice(index, 1);
    setForm({ ...form, lotes: lotesAtuais });
  };

  const handleSincronizarTotalComFardos = () => {
    const lotesAtuais = Array.isArray(form.lotes) ? form.lotes : [];
    if (lotesAtuais.length === 0) {
      showAlert('Nenhum Fardo', 'Adicione pelo menos um fardo para sincronizar o saldo.');
      return;
    }
    const soma = lotesAtuais.reduce((acc: number, l: any) => acc + Number(l.quantidade || 0), 0);
    setForm({ ...form, quantidade: Number(soma.toFixed(3)) });
    showAlert('Saldo Sincronizado', `O saldo total foi recalculado para ${soma.toFixed(2)} ${form.unidade_medida} com base nos ${lotesAtuais.length} fardos.`);
  };

  return (
    <div className="space-y-5 w-full">
      
      <div className="bg-[#071712] border border-[#10B981]/30 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#10B981]/15 border border-[#10B981]/40 flex items-center justify-center text-[#10B981] shrink-0">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-white truncate flex items-center gap-2">
              <span>Estoque & Compras com Rastreamento de Fardos e Validades</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40">
                Multi-Vencimento Ativo
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Acompanhe a quantidade e data de validade de cada fardo individualmente, com alertas de vencimento e reposição direta
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              placeholder="Buscar insumo, fardo, lote ou fornecedor..."
              className="pl-8 pr-3 py-2 bg-[#05100C] border border-white/10 rounded-xl text-xs text-slate-100 w-64 sm:w-72 focus:outline-none focus:border-[#10B981]"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setForm({
                id: null,
                nome: '',
                categoria: 'Insumos Amazônicos',
                quantidade: 10,
                unidade_medida: 'kg',
                estoque_minimo: 5,
                custo_unitario: 45,
                fornecedor: '',
                em_compras: false,
                lotes: [
                  {
                    id: `lote-${Date.now()}-1`,
                    codigo_lote: 'Fardo #01 (Lote Inicial)',
                    quantidade: 10,
                    unidade_fardo: 'kg',
                    data_vencimento: new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0],
                    observacao: 'Lote de abertura'
                  }
                ]
              });
              setModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#05100C] bg-[#10B981] hover:bg-[#34D399] rounded-xl cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span> Novo Insumo / Fardos</span>
          </button>
        </div>
      </div>

      
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl bg-[#071712] border border-[#10B981]/25">
          <div className="text-[11px] text-slate-400"> Patrimônio em Estoque</div>
          <div className="text-lg font-mono font-black text-[#10B981] mt-1">
            {formatBRL(metricasSuprimentos.valorPatrimonio)}
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
            {metricasSuprimentos.totalInsumos} insumos cadastrados
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#071712] border border-[#F59E0B]/30">
          <div className="text-[11px] text-slate-400"> Fila Ativa de Compras</div>
          <div className="text-lg font-mono font-black text-[#F59E0B] mt-1">
            {metricasSuprimentos.emReposicao} item(ns)
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
            Abaixo do mínimo de segurança
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#071712] border border-cyan-500/30">
          <div className="text-[11px] text-slate-400"> Fardos / Lotes Ativos</div>
          <div className="text-lg font-mono font-black text-cyan-400 mt-1">
            {metricasSuprimentos.fardosTotais} fardos
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
            Com datas de vencimento individuais
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#071712] border border-rose-500/30">
          <div className="text-[11px] text-slate-400"> Vencimento Crítico (&lt; 30d)</div>
          <div className="text-lg font-mono font-black text-rose-400 mt-1">
            {metricasSuprimentos.comVencimentoCritico} produto(s)
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
            {metricasSuprimentos.fardosVencidos > 0 ? ` ${metricasSuprimentos.fardosVencidos} fardo(s) já vencido(s)` : 'Nenhum vencido até o momento'}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#071712] border border-white/10 col-span-2 lg:col-span-1">
          <div className="text-[11px] text-slate-400"> Orçamento Reposição</div>
          <div className="text-lg font-mono font-black text-white mt-1">
            {formatBRL(metricasSuprimentos.orcamentoCompras)}
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
            Para atingir 2x o estoque mínimo
          </div>
        </div>
      </div>

      
      <div className="bg-[#071712] border border-white/10 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'integrado', label: ' Visão Completa (Estoque + Compras)' },
            { id: 'estoque', label: ` Saldo, Fardos & Validades (${listaExibida.length})` },
            { id: 'compras', label: ` Ordem de Compras & Entrada (${itensEmReposicao.length})` }
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setVisaoIntegrada(m.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                visaoIntegrada === m.id
                  ? 'bg-[#10B981] text-[#05100C] shadow'
                  : 'bg-[#05100C] text-slate-300 hover:text-white border border-white/10'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'vencimento', label: ` Validades Críticas (${itensComVencimentoCritico.length})` },
            { id: 'repor', label: ` Em Compras (${itensEmReposicao.length})` },
            { id: 'ok', label: ' Saldo & Validade OK' }
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltroNivel(f.id as any)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono cursor-pointer transition-all ${
                filtroNivel === f.id
                  ? f.id === 'vencimento'
                    ? 'bg-rose-500/25 text-rose-300 border border-rose-500/60 font-bold'
                    : 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/50 font-bold'
                  : 'bg-[#05100C] text-slate-400 border border-white/10 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      
      {(visaoIntegrada === 'integrado' || visaoIntegrada === 'compras') && (
        <div className="bg-[#071712] border border-[#F59E0B]/35 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 bg-[#0A1F17] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/40">
                FILA DE COMPRAS ATIVA
              </span>
              <h3 className="text-sm font-bold text-white">
                Ordem de Reposição & Recebimento com Data de Vencimento do Fardo ({itensEmReposicao.length} itens)
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">
              Ao receber o insumo, cadastre a data de validade específica do fardo que chegou
            </span>
          </div>

          {itensEmReposicao.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
               Nenhum insumo em nível crítico ou pendente na fila de compras no momento.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-[#05100C] text-[11px] font-mono uppercase text-slate-400">
                    <th className="py-3 px-4">Insumo</th>
                    <th className="py-3 px-4">Fornecedor</th>
                    <th className="py-3 px-4 text-right">Saldo Atual / Mín.</th>
                    <th className="py-3 px-4 text-center">Fardos & Validades</th>
                    <th className="py-3 px-4 text-right">Sugestão Compra</th>
                    <th className="py-3 px-4 text-right">Custo Estimado</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {itensEmReposicao.map((item) => {
                    const infoLotes = analisarLotesItem(item);
                    const sugerido = Math.max(
                      10,
                      Number(item.estoque_minimo || 10) * 2 - Number(item.quantidade || 0)
                    );
                    const custoEst = sugerido * Number(item.custo_unitario || 0);
                    const st = infoLotes.loteMaisProximo
                      ? calcularStatusVencimento((infoLotes.loteMaisProximo as any)?.data_vencimento)
                      : null;

                    return (
                      <tr key={`comp-${item.id}`} className="hover:bg-white/5">
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <ProductVisualThumbSVG categoria={item.categoria} nome={item.nome} />
                            <div>
                              <div className="font-semibold text-white">{item.nome}</div>
                              <div className="text-[10px] text-slate-400">{item.categoria}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-slate-300">{item.fornecedor || '—'}</td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-rose-400 font-bold">
                          {Number(item.quantidade).toFixed(1)} / {Number(item.estoque_minimo).toFixed(0)}{' '}
                          {item.unidade_medida}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          {infoLotes.totalLotes > 0 ? (
                            <div className="inline-flex flex-col items-center gap-0.5">
                              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-cyan-950/40 text-cyan-300 border border-cyan-500/30">
                                 {infoLotes.totalLotes} fardo(s)
                              </span>
                              {st && (
                                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${st.cor}`}>
                                  {st.label}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-500 italic">Sem fardos reg.</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-[#F59E0B] font-bold">
                          +{sugerido.toFixed(1)} {item.unidade_medida}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-200">
                          {formatBRL(custoEst)}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => handleOpenRecebimento(item, e)}
                              className="px-3 py-1.5 text-xs font-bold text-[#05100C] bg-[#10B981] hover:bg-[#34D399] rounded-lg inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span> Receber Fardo</span>
                            </button>
                            {Number(item.quantidade) > Number(item.estoque_minimo) && (
                              <button
                                type="button"
                                onClick={(e) => handleToggleFilaCompras(item, false, e)}
                                className="px-2 py-1 text-[11px] font-mono text-slate-400 hover:text-white bg-white/5 rounded cursor-pointer"
                              >
                                Retirar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      
      {(visaoIntegrada === 'integrado' || visaoIntegrada === 'estoque') && (
        <div className="bg-[#071712] border border-white/10 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 bg-[#0A1F17] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-pulse" />
              <h3 className="text-sm font-bold text-white">
                 Posição de Estoque por Fardo, Lote e Data de Vencimento
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">
              Clique em <strong> Ver Fardos</strong> para inspecionar os lotes e validades de cada produto
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-[#05100C] text-[11px] font-mono uppercase text-slate-400">
                  <th className="py-3 px-4">Insumo</th>
                  <th className="py-3 px-4">Fornecedor</th>
                  <th className="py-3 px-4 text-right">Saldo / Mínimo</th>
                  <th className="py-3 px-4 text-center">Fardos & Vencimentos</th>
                  <th className="py-3 px-4 text-right">Custo Un.</th>
                  <th className="py-3 px-4 text-right">Patrimônio</th>
                  <th className="py-3 px-4 text-right">Ações Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {listaExibida.map((item) => {
                  const critico = item.em_compras || Number(item.quantidade) <= Number(item.estoque_minimo);
                  const totalItem = Number(item.quantidade || 0) * Number(item.custo_unitario || 0);
                  const infoLotes = analisarLotesItem(item);
                  const st = infoLotes.loteMaisProximo
                    ? calcularStatusVencimento((infoLotes.loteMaisProximo as any)?.data_vencimento)
                    : null;
                  const isExpandido = itemExpandidoId === item.id;
                  const lotesItem: LoteFardoVencimento[] = Array.isArray(item.lotes) ? item.lotes : [];

                  return (
                    <React.Fragment key={item.id}>
                      <tr
                        data-urutau-anomaly={
                          critico || infoLotes.vencidosCount > 0 ? 'true' : undefined
                        }
                        onClick={() => {
                          setForm({
                            ...item,
                            lotes: Array.isArray(item.lotes) ? [...item.lotes] : []
                          });
                          setModalOpen(true);
                        }}
                        className={`hover:bg-white/5 cursor-pointer transition-colors ${
                          isExpandido ? 'bg-white/[0.03]' : ''
                        }`}
                      >
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <ProductVisualThumbSVG categoria={item.categoria} nome={item.nome} />
                            <div>
                              <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                                <span>{item.nome}</span>
                                {infoLotes.vencidosCount > 0 && (
                                  <span className="text-[10px] font-mono px-1.5 py-0.2 bg-rose-500/20 text-rose-400 border border-rose-500/50 rounded">
                                     {infoLotes.vencidosCount} VENCIDO
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400">{item.categoria}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-slate-300">{item.fornecedor || '—'}</td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                          <span className={`font-bold ${critico ? 'text-rose-400' : 'text-slate-100'}`}>
                            {Number(item.quantidade).toFixed(1)}
                          </span>{' '}
                          <span className="text-slate-500">
                            / {Number(item.estoque_minimo).toFixed(0)} {item.unidade_medida}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          {infoLotes.totalLotes > 0 ? (
                            <div className="inline-flex flex-col items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setItemExpandidoId(isExpandido ? null : item.id);
                                }}
                                className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-cyan-950/40 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-900/40 cursor-pointer inline-flex items-center gap-1"
                                title="Clique para expandir lista detalhada de fardos"
                              >
                                <span> {infoLotes.totalLotes} fardo(s)</span>
                                <span className="text-[9px] text-cyan-400">{isExpandido ? '▲' : '▼'}</span>
                              </button>
                              {st && (
                                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${st.cor}`}>
                                  {st.label}
                                </span>
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setForm({
                                  ...item,
                                  lotes: [
                                    {
                                      id: `lote-${Date.now()}-1`,
                                      codigo_lote: 'Fardo #01',
                                      quantidade: Number(item.quantidade || 0),
                                      unidade_fardo: item.unidade_medida,
                                      data_vencimento: new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0],
                                      observacao: 'Lote inicial'
                                    }
                                  ]
                                });
                                setModalOpen(true);
                              }}
                              className="text-[10px] font-mono text-slate-400 hover:text-emerald-400 underline cursor-pointer"
                            >
                              + Cadastrar Fardo
                            </button>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-300">
                          {formatBRL(item.custo_unitario)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-[#F59E0B]">
                          {formatBRL(totalItem)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono">
                          <div className="inline-flex flex-wrap items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e) => handleOpenRecebimento(item, e)}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 hover:bg-[#10B981]/25 cursor-pointer inline-flex items-center gap-1"
                              title="Receber novo fardo ou reposição de compra"
                            >
                              <Plus className="w-3 h-3" />
                              <span>+ Fardo</span>
                            </button>
                            {critico ? (
                              <button
                                type="button"
                                onClick={(e) => handleOpenRecebimento(item, e)}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[#F59E0B] text-[#05100C] hover:bg-[#FBBF24] cursor-pointer"
                                title="Dar entrada de compra imediata"
                              >
                                 Repor
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => handleToggleFilaCompras(item, true, e)}
                                className="px-2 py-1 rounded text-[10px] text-slate-400 hover:text-white bg-white/5 cursor-pointer"
                                title="Marcar insumo para compra"
                              >
                                 Comprar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      
                      {isExpandido && (
                        <tr className="bg-[#05100C]/80 border-b border-cyan-500/20">
                          <td colSpan={7} className="p-3 pl-8">
                            <div className="bg-[#071712] border border-cyan-500/30 rounded-xl p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-cyan-300">
                                     Fardos & Validades Individuais de &quot;{item.nome}&quot;
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-400">
                                    ({lotesItem.length} fardo(s) cadastrado(s))
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setForm({
                                      ...item,
                                      lotes: Array.isArray(item.lotes) ? [...item.lotes] : []
                                    });
                                    setModalOpen(true);
                                  }}
                                  className="text-[11px] font-bold text-[#10B981] hover:underline cursor-pointer"
                                >
                                   Editar Fardos na Ficha Técnica
                                </button>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                {lotesItem.map((lote) => {
                                  const stLote = calcularStatusVencimento(lote.data_vencimento);
                                  return (
                                    <div
                                      key={lote.id}
                                      className="p-2.5 rounded-lg bg-[#05100C] border border-white/10 flex flex-col justify-between gap-1.5"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-white font-mono">
                                          {lote.codigo_lote}
                                        </span>
                                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${stLote.cor}`}>
                                          {stLote.label}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between text-xs font-mono text-slate-300">
                                        <span>
                                          Qtd: <strong>{lote.quantidade} {lote.unidade_fardo || item.unidade_medida}</strong>
                                        </span>
                                        <span>Validade: <strong>{lote.data_vencimento}</strong></span>
                                      </div>
                                      {lote.observacao && (
                                        <div className="text-[10px] text-slate-400 italic truncate">
                                          {lote.observacao}
                                        </div>
                                      )}
                                      <div className="pt-1 border-t border-white/5 flex items-center justify-between">
                                        <span className="text-[9px] text-slate-500 font-mono">
                                          ID: {lote.id.slice(-6)}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={(e) => handleBaixarLote(item, lote, e)}
                                          className="text-[10px] font-bold text-rose-400 hover:text-rose-300 hover:underline cursor-pointer"
                                          title="Baixar ou descartar este lote"
                                        >
                                          Baixar Lote
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      
      <FocusFormModal
        open={modalOpen}
        title={form.id ? `Editar Insumo — ${form.nome}` : 'Novo Insumo (Estoque, Compras & Fardos)'}
        subtitle="Gerencie quantidades gerais e acompanhe as datas de validade de cada fardo individualmente"
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onArchive={form.id ? () => handleArchive(form.id) : undefined}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-400 mb-1">Nome do Insumo</label>
            <input
              type="text"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="w-full px-3 py-2 bg-[#05100C] border border-slate-800 rounded text-xs text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Categoria</label>
            <input
              type="text"
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              className="w-full px-3 py-2 bg-[#05100C] border border-slate-800 rounded text-xs text-slate-100"
            />
          </div>
          <div>
            {(() => {
              const fornecedoresLista = (data.cadastrosPessoas || []).filter(
                (c: any) => Array.isArray(c.papeis) && c.papeis.includes('fornecedor')
              );
              const fornExiste = fornecedoresLista.some(
                (c: any) =>
                  String(c.nome || '').trim().toLowerCase() ===
                  String(form.fornecedor || '').trim().toLowerCase()
              );
              return (
                <>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs text-slate-400">Fornecedor Principal</label>
                    {form.fornecedor?.trim() && (
                      <span
                        className={`text-[10px] font-mono ${
                          fornExiste ? 'text-[#10B981]' : 'text-[#F59E0B]'
                        }`}
                      >
                        {fornExiste ? ' Cadastrado' : ' Novo Fornecedor'}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) setForm({ ...form, fornecedor: e.target.value });
                      }}
                      className="w-36 px-2 py-2 bg-[#071712] border border-[#10B981]/30 rounded text-xs text-slate-200 shrink-0"
                    >
                      <option value="">Lista ({fornecedoresLista.length})</option>
                      {fornecedoresLista.map((f: any) => (
                        <option key={f.id} value={f.nome}>
                          {f.nome}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={form.fornecedor}
                      onChange={(e) => setForm({ ...form, fornecedor: e.target.value })}
                      placeholder="Ou digite novo fornecedor..."
                      className="w-full px-3 py-2 bg-[#05100C] border border-slate-800 rounded text-xs text-slate-100"
                    />
                  </div>
                </>
              );
            })()}
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs text-slate-400">Quantidade Total no Estoque</label>
              {Array.isArray(form.lotes) && form.lotes.length > 0 && (
                <button
                  type="button"
                  onClick={handleSincronizarTotalComFardos}
                  className="text-[10px] font-bold text-cyan-400 hover:underline cursor-pointer"
                  title="Soma os fardos cadastrados e preenche o saldo total"
                >
                   Somar dos Fardos
                </button>
              )}
            </div>
            <input
              type="number"
              step="0.01"
              value={form.quantidade}
              onChange={(e) => setForm({ ...form, quantidade: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-[#05100C] border border-slate-800 rounded text-xs font-mono text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Unidade de Medida (kg, L, un, cx)</label>
            <input
              type="text"
              value={form.unidade_medida}
              onChange={(e) => setForm({ ...form, unidade_medida: e.target.value })}
              className="w-full px-3 py-2 bg-[#05100C] border border-slate-800 rounded text-xs font-mono text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Estoque Mínimo de Segurança</label>
            <input
              type="number"
              step="0.01"
              value={form.estoque_minimo}
              onChange={(e) => setForm({ ...form, estoque_minimo: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-[#05100C] border border-slate-800 rounded text-xs font-mono text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Custo Unitário (R$)</label>
            <input
              type="number"
              step="0.01"
              value={form.custo_unitario}
              onChange={(e) => setForm({ ...form, custo_unitario: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-[#05100C] border border-slate-800 rounded text-xs font-mono text-slate-100"
            />
          </div>

          <div className="sm:col-span-2 p-3 bg-[#05100C] border border-white/10 rounded-xl flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(form.em_compras)}
                onChange={(e) => setForm({ ...form, em_compras: e.target.checked })}
                className="accent-[#F59E0B]"
              />
              <span> Manter este insumo na Fila Ativa de Compras (mesmo acima do mínimo)</span>
            </label>
          </div>

          
          <div className="sm:col-span-2 p-4 bg-[#071712] border border-cyan-500/30 rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <span> Rastreamento de Fardos & Validades Diferenciadas</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                    {Array.isArray(form.lotes) ? form.lotes.length : 0} fardo(s)
                  </span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  Mesmo com datas diferentes para cada fardo, registre cada um com sua quantidade e validade específica
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAdicionarLoteForm}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-cyan-500 text-[#05100C] hover:bg-cyan-400 cursor-pointer inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Adicionar Fardo</span>
                </button>
              </div>
            </div>

            {(!Array.isArray(form.lotes) || form.lotes.length === 0) ? (
              <div className="p-4 text-center text-xs text-slate-400 border border-dashed border-white/10 rounded-lg">
                Nenhum fardo com validade registrado. Clique em <strong>+ Adicionar Fardo</strong> para registrar cada lote separadamente.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {form.lotes.map((lote: LoteFardoVencimento, idx: number) => {
                  const statusLote = calcularStatusVencimento(lote.data_vencimento);
                  return (
                    <div
                      key={lote.id || idx}
                      className="p-3 bg-[#05100C] border border-white/10 rounded-lg grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center"
                    >
                      <div className="sm:col-span-3">
                        <label className="block text-[10px] font-mono text-slate-400 mb-0.5">Identificação Fardo</label>
                        <input
                          type="text"
                          value={lote.codigo_lote}
                          onChange={(e) => handleAtualizarLoteForm(idx, 'codigo_lote', e.target.value)}
                          placeholder="Ex: Fardo #1, Lote A"
                          className="w-full px-2 py-1.5 bg-[#071712] border border-white/15 rounded text-xs text-white font-mono"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-mono text-slate-400 mb-0.5">
                          Quantidade ({form.unidade_medida || 'un'})
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={lote.quantidade}
                          onChange={(e) => handleAtualizarLoteForm(idx, 'quantidade', Number(e.target.value))}
                          className="w-full px-2 py-1.5 bg-[#071712] border border-white/15 rounded text-xs text-white font-mono"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[10px] font-mono text-slate-400 mb-0.5">Data de Vencimento</label>
                        <input
                          type="date"
                          value={lote.data_vencimento}
                          onChange={(e) => handleAtualizarLoteForm(idx, 'data_vencimento', e.target.value)}
                          className="w-full px-2 py-1.5 bg-[#071712] border border-white/15 rounded text-xs text-white font-mono"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[10px] font-mono text-slate-400 mb-0.5">Situação / Validade</label>
                        <div className={`px-2 py-1 rounded text-[11px] font-mono border text-center ${statusLote.cor}`}>
                          {statusLote.label}
                        </div>
                      </div>

                      <div className="sm:col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleRemoverLoteForm(idx)}
                          className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded cursor-pointer"
                          title="Remover este fardo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="sm:col-span-12">
                        <input
                          type="text"
                          value={lote.observacao || ''}
                          onChange={(e) => handleAtualizarLoteForm(idx, 'observacao', e.target.value)}
                          placeholder="Observações do fardo (ex: fornecedor específico, lote de fábrica, prateleira B-3)..."
                          className="w-full px-2 py-1 bg-[#071712] border border-white/10 rounded text-[11px] text-slate-300"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </FocusFormModal>

      
      <FocusFormModal
        open={receberModalOpen}
        title={`Receber Compra no Estoque — ${itemAlvo?.nome || ''}`}
        subtitle="Atualiza instantaneamente o saldo físico e registra o fardo com sua data de validade específica"
        onClose={() => setReceberModalOpen(false)}
        onSave={handleConfirmarRecebimento}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Quantidade Recebida ({itemAlvo?.unidade_medida})
            </label>
            <input
              type="number"
              step="0.01"
              value={qtdCompra}
              onChange={(e) => setQtdCompra(Number(e.target.value))}
              className="w-full px-3 py-2 bg-[#05100C] border border-slate-800 rounded text-xs font-mono text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Custo Unitário na Nota (R$)</label>
            <input
              type="number"
              step="0.01"
              value={custoCompra}
              onChange={(e) => setCustoCompra(Number(e.target.value))}
              className="w-full px-3 py-2 bg-[#05100C] border border-slate-800 rounded text-xs font-mono text-slate-100"
            />
          </div>

          
          <div className="sm:col-span-2 p-3.5 bg-[#071712] border border-cyan-500/30 rounded-xl space-y-3">
            <label className="flex items-center gap-2 text-xs text-cyan-300 font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={cadastrarComoLote}
                onChange={(e) => setCadastrarComoLote(e.target.checked)}
                className="accent-cyan-400"
              />
              <span> Cadastrar esta entrada como novo Fardo / Lote com Data de Vencimento</span>
            </label>

            {cadastrarComoLote && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-mono text-slate-300 mb-1">
                    Código / Identificação do Fardo
                  </label>
                  <input
                    type="text"
                    value={loteCodigo}
                    onChange={(e) => setLoteCodigo(e.target.value)}
                    placeholder="Ex: Fardo #3, Lote NOV-2026"
                    className="w-full px-2.5 py-1.5 bg-[#05100C] border border-white/15 rounded text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-slate-300 mb-1">
                    Data de Vencimento deste Fardo *
                  </label>
                  <input
                    type="date"
                    value={loteVencimento}
                    onChange={(e) => setLoteVencimento(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[#05100C] border border-white/15 rounded text-xs text-white font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-mono text-slate-300 mb-1">
                    Observações do Fardo / Lote
                  </label>
                  <input
                    type="text"
                    value={loteObs}
                    onChange={(e) => setLoteObs(e.target.value)}
                    placeholder="Ex: Nota fiscal 4821, fornecedor Cooperativa Tomé-Açu..."
                    className="w-full px-2.5 py-1.5 bg-[#05100C] border border-white/10 rounded text-xs text-slate-200"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="sm:col-span-2 p-3.5 bg-[#05100C] border border-slate-800 rounded flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={lancarCaixa}
                onChange={(e) => setLancarCaixa(e.target.checked)}
                className="accent-[#F59E0B]"
              />
              <span>Lançar automaticamente como Saída no Livro Caixa</span>
            </label>
            <span className="font-mono text-sm font-bold text-[#F59E0B] tabular-nums">
              Total: {formatBRL(qtdCompra * custoCompra)}
            </span>
          </div>
        </div>
      </FocusFormModal>
    </div>
  );
}

export function ComprasTab(props: CommonTabProps) {
  return <EstoqueTab {...props} />;
}
