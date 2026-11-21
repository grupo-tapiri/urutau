import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Check,
  Trash2,
  Calculator,
  RefreshCw,
  Layers,
  Eye,
  Calendar,
  ArrowUpRight,
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  CategoriaFechamentoCaixa,
  ERPCompleteData,
  FonteSistemaFechamentoCaixa,
  ItemRelatorioFechamentoCaixa,
  ModoPreenchimentoFechamento,
  RelatorioFechamentoCaixaDiario
} from '../types/erp';
import { evaluateMathExpression } from './UrutauShared';

interface FechamentoCaixaDiarioPanelProps {
  data: ERPCompleteData;
  unidadesPermitidas: any[];
  effectiveUnidadesIds: number[];
  currentUser?: any;
  onRefresh: () => Promise<void>;
  showAlert: (title: string, message: string, technicalDetails?: string) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
  onEditCaixaItem?: (item: any) => void;
}

function getTodayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function formatBRL(val: number): string {
  return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export const DEFAULT_CATEGORIAS_FECHAMENTO_PADRAO: CategoriaFechamentoCaixa[] = [
  {
    id: 'cat_delivery_entrada',
    nome: 'Total Entrada via Delivery',
    tipo: 'Entrada',
    modo_padrao: 'mesclado',
    fonte_sistema: 'DELIVERY_ENTRADAS',
    filtro_origem: 'Delivery',
    lancar_no_caixa_em_massa: true,
    ordem: 1,
    unidade_id: 1
  },
  {
    id: 'cat_gorjeta_10',
    nome: 'Total 10% Gorjeta do Garçom',
    tipo: 'Entrada',
    modo_padrao: 'mesclado',
    fonte_sistema: 'RATEIO_10_GORJETA',
    filtro_origem: '10% Gorjeta',
    lancar_no_caixa_em_massa: true,
    ordem: 2,
    unidade_id: 1
  },
  {
    id: 'cat_salao_entrada',
    nome: 'Faturamento Salão / Mesas & Balcão',
    tipo: 'Entrada',
    modo_padrao: 'mesclado',
    fonte_sistema: 'CAIXA_SALAO_ENTRADAS',
    filtro_origem: 'Faturamento Salão',
    lancar_no_caixa_em_massa: true,
    ordem: 3,
    unidade_id: 1
  },
  {
    id: 'cat_entregadores_saida',
    nome: 'Despesas com Entregadores / Motoboys',
    tipo: 'Saída',
    modo_padrao: 'mesclado',
    fonte_sistema: 'ENTREGADORES_DESPESAS',
    filtro_origem: 'Entregadores',
    lancar_no_caixa_em_massa: true,
    ordem: 4,
    unidade_id: 1
  },
  {
    id: 'cat_fornecedores_saida',
    nome: 'Compras de Insumos & Pagamento de Fornecedores',
    tipo: 'Saída',
    modo_padrao: 'mesclado',
    fonte_sistema: 'COMPRAS_FORNECEDORES',
    filtro_origem: 'Fornecedores',
    lancar_no_caixa_em_massa: true,
    ordem: 5,
    unidade_id: 1
  },
  {
    id: 'cat_rh_vales_saida',
    nome: 'Vales, Diárias Extras & Despesas de Equipe',
    tipo: 'Saída',
    modo_padrao: 'mesclado',
    fonte_sistema: 'RH_VALES_PAGAMENTOS',
    filtro_origem: 'Vales / Equipe',
    lancar_no_caixa_em_massa: true,
    ordem: 6,
    unidade_id: 1
  }
];

const FONTES_SISTEMA_LABELS: { value: FonteSistemaFechamentoCaixa; label: string }[] = [
  { value: 'CAIXA_CATEGORIA', label: 'Caixa: Apontar Categoria / Termo Específico' },
  { value: 'DELIVERY_ENTRADAS', label: 'Sistema: Total Entradas via Delivery (Caixa)' },
  { value: 'RATEIO_10_GORJETA', label: 'Sistema: Total 10% Gorjeta do Garçom / Rateio' },
  { value: 'CAIXA_SALAO_ENTRADAS', label: 'Sistema: Faturamento Salão / Mesas (Caixa)' },
  { value: 'ENTREGADORES_DESPESAS', label: 'Sistema: Despesas com Entregadores (Caixa + Diárias)' },
  { value: 'COMPRAS_FORNECEDORES', label: 'Sistema: Compras de Insumos & Fornecedores' },
  { value: 'RH_VALES_PAGAMENTOS', label: 'Sistema: Vales, Adiantamentos & Equipe (RH + Caixa)' },
  { value: 'CAIXA_TODAS_ENTRADAS', label: 'Sistema: Soma de Todas as Entradas do Caixa no Dia' },
  { value: 'CAIXA_TODAS_SAIDAS', label: 'Sistema: Soma de Todas as Saídas do Caixa no Dia' },
  { value: 'MANUAL_PURO', label: 'Sem Vínculo com Sistema (Apenas Digitação Manual)' }
];

export function FechamentoCaixaDiarioPanel({
  data,
  unidadesPermitidas,
  effectiveUnidadesIds,
  currentUser,
  onRefresh,
  showAlert,
  showConfirm,
  onEditCaixaItem
}: FechamentoCaixaDiarioPanelProps) {
  const [abaInterna, setAbaInterna] = useState<'preenchimento' | 'relatorios'>('preenchimento');
  const [dataFechamento, setDataFechamento] = useState<string>(getTodayISO());
  const [unidadeId, setUnidadeId] = useState<number>(effectiveUnidadesIds[0] || 1);
  const [turnoFechamento, setTurnoFechamento] = useState<string>('Fechamento Geral do Dia');
  const [observacoesGerais, setObservacoesGerais] = useState<string>('');
  const [modoLancamentoMassa, setModoLancamentoMassa] = useState<
    'apenas_manual_complementar' | 'valor_final_consolidado'
  >('apenas_manual_complementar');
  const [salvarFontesComoPadrao, setSalvarFontesComoPadrao] = useState<boolean>(true);
  const [salvando, setSalvando] = useState<boolean>(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState<boolean>(false);

  const [novaCatOpen, setNovaCatOpen] = useState<boolean>(false);
  const [novaCatForm, setNovaCatForm] = useState<{
    nome: string;
    tipo: 'Entrada' | 'Saída';
    modo_padrao: ModoPreenchimentoFechamento;
    fonte_sistema: FonteSistemaFechamentoCaixa;
    filtro_origem: string;
  }>({
    nome: '',
    tipo: 'Entrada',
    modo_padrao: 'mesclado',
    fonte_sistema: 'CAIXA_CATEGORIA',
    filtro_origem: ''
  });

  const [detalheOrigemAbertoCatId, setDetalheOrigemAbertoCatId] = useState<string | null>(null);

  const [filtroRelDataInicio, setFiltroRelDataInicio] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [filtroRelDataFim, setFiltroRelDataFim] = useState<string>(getTodayISO());
  const [filtroRelTipo, setFiltroRelTipo] = useState<'Todos' | 'Entrada' | 'Saída'>('Todos');
  const [filtroRelCategoria, setFiltroRelCategoria] = useState<string>('Todas');
  const [buscaRelTexto, setBuscaRelTexto] = useState<string>('');

  const categoriasSalvas = useMemo<CategoriaFechamentoCaixa[]>(() => {
    const lista = data.categoriasFechamentoCaixa;
    if (Array.isArray(lista) && lista.length > 0) {
      return lista;
    }
    return DEFAULT_CATEGORIAS_FECHAMENTO_PADRAO;
  }, [data.categoriasFechamentoCaixa]);

  const categoriasExistentesNoCaixa = useMemo<string[]>(() => {
    const set = new Set<string>([
      'Delivery',
      '10% Gorjeta',
      'Faturamento Salão',
      'Entregadores',
      'Fornecedores',
      'Vales / Equipe',
      'Pix / Cartão',
      'Suprimento de Caixa',
      'Sangria Operacional'
    ]);
    for (const c of data.caixa || []) {
      if (c?.categoria && String(c.categoria).trim()) {
        set.add(String(c.categoria).trim());
      }
    }
    return Array.from(set);
  }, [data.caixa]);

  const apurarOrigemSistema = useMemo(() => {
    return (
      fonte: FonteSistemaFechamentoCaixa,
      filtro: string,
      tipoEsperado: 'Entrada' | 'Saída'
    ): { total: number; qtd: number; lancamentos: any[] } => {
      if (fonte === 'MANUAL_PURO') {
        return { total: 0, qtd: 0, lancamentos: [] };
      }

      const caixaDia = (data.caixa || []).filter(
        (c: any) =>
          !c.arquivado_legal &&
          c.data === dataFechamento &&
          (!c.unidade_id || Number(c.unidade_id) === Number(unidadeId)) &&
          !c.origem_fechamento_diario &&
          !c.chave_fechamento_massa
      );

      const termoFiltro = String(filtro || '').trim().toLowerCase();
      const matchTexto = (c: any, termos: string[]) => {
        const cat = String(c.categoria || '').toLowerCase();
        const desc = String(c.descricao || '').toLowerCase();
        return termos.some((t) => t && (cat.includes(t) || desc.includes(t)));
      };

      if (fonte === 'CAIXA_TODAS_ENTRADAS') {
        const itens = caixaDia.filter((c: any) => c.tipo === 'Entrada');
        const total = itens.reduce((acc: number, c: any) => acc + Number(c.valor || 0), 0);
        return { total: Number(total.toFixed(2)), qtd: itens.length, lancamentos: itens };
      }

      if (fonte === 'CAIXA_TODAS_SAIDAS') {
        const itens = caixaDia.filter((c: any) => c.tipo === 'Saída');
        const total = itens.reduce((acc: number, c: any) => acc + Number(c.valor || 0), 0);
        return { total: Number(total.toFixed(2)), qtd: itens.length, lancamentos: itens };
      }

      if (fonte === 'DELIVERY_ENTRADAS') {
        const termos = [termoFiltro, 'delivery', 'ifood', 'entrega', 'app'].filter(Boolean);
        const itens = caixaDia.filter((c: any) => c.tipo === 'Entrada' && matchTexto(c, termos));
        const total = itens.reduce((acc: number, c: any) => acc + Number(c.valor || 0), 0);
        return { total: Number(total.toFixed(2)), qtd: itens.length, lancamentos: itens };
      }

      if (fonte === 'RATEIO_10_GORJETA') {
        const termos = [termoFiltro, '10%', 'gorjeta', 'rateio', 'comissão', 'comissao', 'garçom', 'garcom'].filter(Boolean);
        const itensCaixa = caixaDia.filter((c: any) => matchTexto(c, termos));
        const rateiosDia = (data.rateiosHistorico || []).filter(
          (r: any) => !r.arquivado_legal && r.data === dataFechamento
        );
        const somaCaixa = itensCaixa.reduce((acc: number, c: any) => acc + Number(c.valor || 0), 0);
        const somaRateio = rateiosDia.reduce(
          (acc: number, r: any) => acc + Number(r.valor_pool || 0),
          0
        );
        const lancs = [
          ...itensCaixa,
          ...rateiosDia.map((r: any) => ({
            id: `rateio_${r.id}`,
            categoria: 'Fechamento de Rateio 10%',
            descricao: `Pool de Rateio (${r.percentual_pool || 10}% sobre ${formatBRL(r.faturamento_bruto)})`,
            valor: Number(r.valor_pool || 0),
            tipo: 'Entrada'
          }))
        ];
        const total = somaCaixa > 0 && somaRateio > 0 ? Math.max(somaCaixa, somaRateio) : somaCaixa + somaRateio;
        return { total: Number(total.toFixed(2)), qtd: lancs.length, lancamentos: lancs };
      }

      if (fonte === 'CAIXA_SALAO_ENTRADAS') {
        const termos = [termoFiltro, 'salão', 'salao', 'mesa', 'balcão', 'balcao', 'faturamento'].filter(Boolean);
        const itens = caixaDia.filter((c: any) => c.tipo === 'Entrada' && matchTexto(c, termos));
        const total = itens.reduce((acc: number, c: any) => acc + Number(c.valor || 0), 0);
        return { total: Number(total.toFixed(2)), qtd: itens.length, lancamentos: itens };
      }

      if (fonte === 'ENTREGADORES_DESPESAS') {
        const termos = [termoFiltro, 'entregador', 'motoboy', 'motoqueiro', 'frete', 'taxa entrega'].filter(Boolean);
        const itensCaixa = caixaDia.filter((c: any) => c.tipo === 'Saída' && matchTexto(c, termos));
        const matchesDia = (data.matches_contratacoes || []).filter(
          (m: any) =>
            !m.arquivado_legal &&
            m.data === dataFechamento &&
            matchTexto({ categoria: m.funcao, descricao: m.freelancer_nome }, [
              'entregador',
              'motoboy',
              termoFiltro
            ])
        );
        const somaCaixa = itensCaixa.reduce((acc: number, c: any) => acc + Number(c.valor || 0), 0);
        const somaMatches = matchesDia.reduce(
          (acc: number, m: any) => acc + Number(m.valor_acordado || 0),
          0
        );
        const lancs = [
          ...itensCaixa,
          ...matchesDia.map((m: any) => ({
            id: `match_${m.id}`,
            categoria: 'Diária Freelancer / Entregador',
            descricao: `${m.freelancer_nome} (${m.funcao})`,
            valor: Number(m.valor_acordado || 0),
            tipo: 'Saída'
          }))
        ];
        return {
          total: Number((somaCaixa + somaMatches).toFixed(2)),
          qtd: lancs.length,
          lancamentos: lancs
        };
      }

      if (fonte === 'COMPRAS_FORNECEDORES') {
        const termos = [termoFiltro, 'fornecedor', 'insumo', 'compra', 'mercadoria', 'estoque', 'nota'].filter(Boolean);
        const itens = caixaDia.filter((c: any) => c.tipo === 'Saída' && matchTexto(c, termos));
        const total = itens.reduce((acc: number, c: any) => acc + Number(c.valor || 0), 0);
        return { total: Number(total.toFixed(2)), qtd: itens.length, lancamentos: itens };
      }

      if (fonte === 'RH_VALES_PAGAMENTOS') {
        const termos = [termoFiltro, 'vale', 'adiantamento', 'equipe', 'rh', 'diária', 'diaria', 'folha', 'salário'].filter(Boolean);
        const itens = caixaDia.filter((c: any) => c.tipo === 'Saída' && matchTexto(c, termos));
        const total = itens.reduce((acc: number, c: any) => acc + Number(c.valor || 0), 0);
        return { total: Number(total.toFixed(2)), qtd: itens.length, lancamentos: itens };
      }

      const termosBusca = termoFiltro ? [termoFiltro] : [];
      const itens = caixaDia.filter((c: any) => {
        const mesmoTipo = !tipoEsperado || c.tipo === tipoEsperado;
        if (termosBusca.length === 0) return mesmoTipo;
        return mesmoTipo && matchTexto(c, termosBusca);
      });
      const total = itens.reduce((acc: number, c: any) => acc + Number(c.valor || 0), 0);
      return { total: Number(total.toFixed(2)), qtd: itens.length, lancamentos: itens };
    };
  }, [data.caixa, data.rateiosHistorico, data.matches_contratacoes, dataFechamento, unidadeId]);

  const [itensRelatorio, setItensRelatorio] = useState<ItemRelatorioFechamentoCaixa[]>([]);
  const [fechamentoCarregadoId, setFechamentoCarregadoId] = useState<number | null>(null);

  useEffect(() => {
    const fechamentoSalvoDia = (data.fechamentosCaixaDiarios || []).find(
      (f: RelatorioFechamentoCaixaDiario) =>
        !f.arquivado_legal &&
        f.data === dataFechamento &&
        Number(f.unidade_id || 1) === Number(unidadeId) &&
        f.turno === turnoFechamento
    );

    if (fechamentoSalvoDia && Array.isArray(fechamentoSalvoDia.itens)) {
      setFechamentoCarregadoId(fechamentoSalvoDia.id);
      setObservacoesGerais(fechamentoSalvoDia.observacoes_gerais || '');
      const idsSalvos = new Set(fechamentoSalvoDia.itens.map((i) => i.categoria_id));
      const itensMesclados: ItemRelatorioFechamentoCaixa[] = fechamentoSalvoDia.itens.map((it) => {
        const apuracao = apurarOrigemSistema(it.fonte_sistema, it.filtro_origem, it.tipo);
        const vSis = apuracao.total;
        const vMan = Number(it.valor_manual || 0);
        const vFinal =
          it.modo_preenchimento === 'sistema'
            ? vSis
            : it.modo_preenchimento === 'manual'
            ? vMan
            : Number((vSis + vMan).toFixed(2));
        return {
          ...it,
          valor_sistema: vSis,
          qtd_itens_sistema: apuracao.qtd,
          valor_final: vFinal
        };
      });

      for (const cat of categoriasSalvas) {
        if (!idsSalvos.has(cat.id)) {
          const apuracao = apurarOrigemSistema(cat.fonte_sistema, cat.filtro_origem, cat.tipo);
          itensMesclados.push({
            categoria_id: cat.id,
            nome: cat.nome,
            tipo: cat.tipo,
            modo_preenchimento: cat.modo_padrao || 'mesclado',
            fonte_sistema: cat.fonte_sistema,
            filtro_origem: cat.filtro_origem,
            valor_sistema: apuracao.total,
            qtd_itens_sistema: apuracao.qtd,
            expressao_manual: '',
            valor_manual: 0,
            valor_final: cat.modo_padrao === 'manual' ? 0 : apuracao.total,
            observacao: '',
            lancar_no_caixa: cat.lancar_no_caixa_em_massa !== false
          });
        }
      }
      setItensRelatorio(itensMesclados);
    } else {
      setFechamentoCarregadoId(null);
      setObservacoesGerais('');
      const novosItens: ItemRelatorioFechamentoCaixa[] = categoriasSalvas.map((cat) => {
        const apuracao = apurarOrigemSistema(cat.fonte_sistema, cat.filtro_origem, cat.tipo);
        const modo = cat.modo_padrao || 'mesclado';
        return {
          categoria_id: cat.id,
          nome: cat.nome,
          tipo: cat.tipo,
          modo_preenchimento: modo,
          fonte_sistema: cat.fonte_sistema,
          filtro_origem: cat.filtro_origem,
          valor_sistema: apuracao.total,
          qtd_itens_sistema: apuracao.qtd,
          expressao_manual: '',
          valor_manual: 0,
          valor_final: modo === 'manual' ? 0 : apuracao.total,
          observacao: '',
          lancar_no_caixa: cat.lancar_no_caixa_em_massa !== false
        };
      });
      setItensRelatorio(novosItens);
    }
  }, [
    dataFechamento,
    unidadeId,
    turnoFechamento,
    categoriasSalvas,
    data.fechamentosCaixaDiarios,
    apurarOrigemSistema
  ]);

  const atualizarItemRelatorio = (
    categoriaId: string,
    patch: Partial<ItemRelatorioFechamentoCaixa>
  ) => {
    setItensRelatorio((prev) =>
      prev.map((item) => {
        if (item.categoria_id !== categoriaId) return item;
        const atualizado = { ...item, ...patch };
        if (
          patch.fonte_sistema !== undefined ||
          patch.filtro_origem !== undefined ||
          patch.tipo !== undefined
        ) {
          const apuracao = apurarOrigemSistema(
            atualizado.fonte_sistema,
            atualizado.filtro_origem,
            atualizado.tipo
          );
          atualizado.valor_sistema = apuracao.total;
          atualizado.qtd_itens_sistema = apuracao.qtd;
        }
        const vSis = Number(atualizado.valor_sistema || 0);
        const vMan = Number(atualizado.valor_manual || 0);
        atualizado.valor_final =
          atualizado.modo_preenchimento === 'sistema'
            ? vSis
            : atualizado.modo_preenchimento === 'manual'
            ? vMan
            : Number((vSis + vMan).toFixed(2));
        return atualizado;
      })
    );
  };

  const handleExpressaoManualItem = (categoriaId: string, expr: string) => {
    const limpo = expr.trim();
    if (!limpo) {
      atualizarItemRelatorio(categoriaId, { expressao_manual: '', valor_manual: 0 });
      return;
    }
    const calc = evaluateMathExpression(limpo.replace(',', '.'));
    const numDireto = Number(limpo.replace(',', '.'));
    const valorCalculado = calc.valid
      ? calc.value
      : !Number.isNaN(numDireto)
      ? numDireto
      : 0;
    atualizarItemRelatorio(categoriaId, {
      expressao_manual: expr,
      valor_manual: Number(valorCalculado.toFixed(2))
    });
  };

  const totaisFechamentoAtual = useMemo(() => {
    return itensRelatorio.reduce(
      (acc, it) => {
        const vFinal = Number(it.valor_final || 0);
        const vSis = it.modo_preenchimento === 'manual' ? 0 : Number(it.valor_sistema || 0);
        const vMan = it.modo_preenchimento === 'sistema' ? 0 : Number(it.valor_manual || 0);
        if (it.tipo === 'Entrada') {
          acc.entradas += vFinal;
          acc.entradasSistema += vSis;
          acc.entradasManual += vMan;
        } else {
          acc.saidas += vFinal;
          acc.saidasSistema += vSis;
          acc.saidasManual += vMan;
        }
        acc.saldo = acc.entradas - acc.saidas;
        return acc;
      },
      {
        entradas: 0,
        saidas: 0,
        saldo: 0,
        entradasSistema: 0,
        entradasManual: 0,
        saidasSistema: 0,
        saidasManual: 0
      }
    );
  }, [itensRelatorio]);

  const handleCriarNovaCategoria = async () => {
    if (!novaCatForm.nome.trim()) {
      showAlert('Nome Obrigatório', 'Informe o nome da categoria para o relatório diário de fechamento.');
      return;
    }
    setSalvando(true);
    try {
      const novaCat: CategoriaFechamentoCaixa = {
        id: `cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        nome: novaCatForm.nome.trim(),
        tipo: novaCatForm.tipo,
        modo_padrao: novaCatForm.modo_padrao,
        fonte_sistema: novaCatForm.fonte_sistema,
        filtro_origem: (novaCatForm.filtro_origem || novaCatForm.nome).trim(),
        lancar_no_caixa_em_massa: true,
        ordem: itensRelatorio.length + 1,
        unidade_id: unidadeId
      };
      const res = await fetch('/api/v20/caixa/categorias-fechamento/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoria: novaCat })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.erro || 'Erro ao criar categoria');
      setNovaCatOpen(false);
      setNovaCatForm({
        nome: '',
        tipo: 'Entrada',
        modo_padrao: 'mesclado',
        fonte_sistema: 'CAIXA_CATEGORIA',
        filtro_origem: ''
      });
      await onRefresh();
      showAlert(
        'Categoria Pré-Salva Criada',
        `A categoria "${novaCat.nome}" foi adicionada ao modelo de fechamento diário e já está pronta para uso.`
      );
    } catch (e: any) {
      showAlert('Erro ao Criar Categoria', e.message);
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluirCategoria = (item: ItemRelatorioFechamentoCaixa) => {
    showConfirm(
      'Excluir Categoria do Relatório de Fechamento',
      `Deseja remover a categoria "${item.nome}" do modelo de fechamento diário de caixa?`,
      async () => {
        setSalvando(true);
        try {
          const res = await fetch('/api/v20/caixa/categorias-fechamento/excluir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: item.categoria_id })
          });
          const json = await res.json();
          if (!res.ok || !json.ok) throw new Error(json.erro || 'Erro ao excluir categoria');
          setItensRelatorio((prev) => prev.filter((x) => x.categoria_id !== item.categoria_id));
          await onRefresh();
        } catch (e: any) {
          showAlert('Erro ao Excluir Categoria', e.message);
        } finally {
          setSalvando(false);
        }
      }
    );
  };

  const handleSalvarModeloCategoriasPadrao = async () => {
    setSalvando(true);
    try {
      const categoriasLote = itensRelatorio.map((it, idx) => ({
        id: it.categoria_id,
        nome: it.nome,
        tipo: it.tipo,
        modo_padrao: it.modo_preenchimento,
        fonte_sistema: it.fonte_sistema,
        filtro_origem: it.filtro_origem,
        lancar_no_caixa_em_massa: it.lancar_no_caixa,
        ordem: idx + 1,
        unidade_id: unidadeId
      }));
      const res = await fetch('/api/v20/caixa/categorias-fechamento/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categorias_lote: categoriasLote })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.erro || 'Erro ao salvar pré-configuração');
      await onRefresh();
      showAlert(
        'Fontes & Categorias Pré-Salvas',
        'As categorias, modos de preenchimento (Sistema, Manual ou Mesclado) e apontamentos de origem foram salvos como padrão para os próximos fechamentos.'
      );
    } catch (e: any) {
      showAlert('Erro ao Salvar Padrão', e.message);
    } finally {
      setSalvando(false);
    }
  };

  const handleSalvarFechamentoDiario = async (registrarEmMassaNoCaixa: boolean) => {
    setSalvando(true);
    try {
      const res = await fetch('/api/v20/caixa/fechamento-diario/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: fechamentoCarregadoId,
          data: dataFechamento,
          unidade_id: unidadeId,
          empresa_id: data.empresaAtivaId || 1,
          operador_id: currentUser?.id || 1,
          operador_nome: currentUser?.nome || 'Operador Caixa',
          turno: turnoFechamento,
          itens: itensRelatorio,
          observacoes_gerais: observacoesGerais,
          registrar_em_massa_no_caixa: registrarEmMassaNoCaixa,
          modo_lancamento_massa: modoLancamentoMassa,
          salvar_fontes_como_padrao: salvarFontesComoPadrao
        })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.erro || 'Erro ao salvar fechamento diário');
      await onRefresh();
      if (registrarEmMassaNoCaixa) {
        showAlert(
          'Fechamento Diário & Registro em Massa Concluídos',
          `O relatório de fechamento de ${dataFechamento} foi gravado e ${json.qtd_lancamentos_gerados || 0} lançamento(s) consolidado(s) foram registrados/atualizados em massa diretamente no Livro Caixa.`
        );
      } else {
        showAlert(
          'Relatório de Fechamento Diário Salvo',
          `O levantamento diário de ${dataFechamento} (Entradas: ${formatBRL(
            totaisFechamentoAtual.entradas
          )} | Saídas: ${formatBRL(totaisFechamentoAtual.saidas)} | Saldo: ${formatBRL(
            totaisFechamentoAtual.saldo
          )}) foi anotado no histórico para consulta e relatórios.`
        );
      }
    } catch (e: any) {
      showAlert('Erro no Fechamento Diário', e.message);
    } finally {
      setSalvando(false);
    }
  };

  const fechamentosPeriodo = useMemo(() => {
    return (data.fechamentosCaixaDiarios || []).filter((f: RelatorioFechamentoCaixaDiario) => {
      if (f.arquivado_legal) return false;
      if (filtroRelDataInicio && f.data < filtroRelDataInicio) return false;
      if (filtroRelDataFim && f.data > filtroRelDataFim) return false;
      return true;
    });
  }, [data.fechamentosCaixaDiarios, filtroRelDataInicio, filtroRelDataFim]);

  const consolidadoPorCategoriaRelatorio = useMemo(() => {
    const mapa = new Map<
      string,
      {
        nome: string;
        tipo: 'Entrada' | 'Saída';
        totalSistema: number;
        totalManual: number;
        totalFinal: number;
        ocorrencias: number;
      }
    >();

    for (const fech of fechamentosPeriodo) {
      for (const it of fech.itens || []) {
        if (filtroRelTipo !== 'Todos' && it.tipo !== filtroRelTipo) continue;
        if (filtroRelCategoria !== 'Todas' && it.nome !== filtroRelCategoria) continue;
        if (
          buscaRelTexto.trim() &&
          !it.nome.toLowerCase().includes(buscaRelTexto.toLowerCase()) &&
          !String(it.observacao || '').toLowerCase().includes(buscaRelTexto.toLowerCase())
        ) {
          continue;
        }
        const chave = `${it.tipo}::${it.nome}`;
        const atual = mapa.get(chave) || {
          nome: it.nome,
          tipo: it.tipo,
          totalSistema: 0,
          totalManual: 0,
          totalFinal: 0,
          ocorrencias: 0
        };
        const vSis = it.modo_preenchimento === 'manual' ? 0 : Number(it.valor_sistema || 0);
        const vMan = it.modo_preenchimento === 'sistema' ? 0 : Number(it.valor_manual || 0);
        atual.totalSistema += vSis;
        atual.totalManual += vMan;
        atual.totalFinal += Number(it.valor_final || 0);
        atual.ocorrencias += 1;
        mapa.set(chave, atual);
      }
    }

    return Array.from(mapa.values()).sort((a, b) => b.totalFinal - a.totalFinal);
  }, [fechamentosPeriodo, filtroRelTipo, filtroRelCategoria, buscaRelTexto]);

  const handleExportarRelatorioCSV = () => {
    const linhas = [
      [
        'Categoria',
        'Tipo',
        'Total Puxado Sistema (R$)',
        'Total Digitado Manual (R$)',
        'Total Consolidado (R$)',
        'Dias Registrados'
      ].join(';')
    ];
    for (const row of consolidadoPorCategoriaRelatorio) {
      linhas.push(
        [
          `"${row.nome.replace(/"/g, '""')}"`,
          row.tipo,
          row.totalSistema.toFixed(2).replace('.', ','),
          row.totalManual.toFixed(2).replace('.', ','),
          row.totalFinal.toFixed(2).replace('.', ','),
          row.ocorrencias
        ].join(';')
      );
    }
    const blob = new Blob(['\uFEFF' + linhas.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `levantamento_fechamento_caixa_${filtroRelDataInicio}_a_${filtroRelDataFim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-[#12161F] border border-slate-800 rounded-xl p-4 sm:p-5 space-y-5">
      <datalist id="urutau-caixa-categorias-datalist">
        {categoriasExistentesNoCaixa.map((cat) => (
          <option key={cat} value={cat} />
        ))}
      </datalist>

      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>Fechamento de Caixa Diário</span>
            {fechamentoCarregadoId && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-amber-400">
                  Salvo em {dataFechamento} (#{fechamentoCarregadoId})
                </span>
              </>
            )}
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-white">
            Levantamento Diário de Entradas e Saídas
          </h3>
          <p className="text-xs text-slate-400 max-w-3xl">
            Confira os valores apurados pelo sistema, informe ajustes manuais quando necessário e conclua o fechamento no Livro Caixa.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0E1117] border border-slate-800">
            <button
              type="button"
              onClick={() => setAbaInterna('preenchimento')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                abaInterna === 'preenchimento'
                  ? 'bg-[#181D28] text-white border border-slate-700'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              1. Preenchimento Diário
            </button>
            <button
              type="button"
              onClick={() => setAbaInterna('relatorios')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                abaInterna === 'relatorios'
                  ? 'bg-[#181D28] text-white border border-slate-700'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              2. Relatórios ({(data.fechamentosCaixaDiarios || []).length})
            </button>
          </div>

          {abaInterna === 'preenchimento' && (
            <button
              type="button"
              onClick={() => setShowAdvancedOptions((prev) => !prev)}
              className={`px-3 py-2 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 border cursor-pointer transition-colors whitespace-nowrap ${
                showAdvancedOptions
                  ? 'bg-[#181D28] border-slate-600 text-white'
                  : 'bg-[#0E1117] border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Opções Avançadas</span>
              {showAdvancedOptions ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {abaInterna === 'preenchimento' ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-[#0E1117] border border-slate-800 rounded-xl p-3.5">
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Data do Fechamento
              </label>
              <input
                type="date"
                value={dataFechamento}
                onChange={(e) => setDataFechamento(e.target.value)}
                className="w-full px-3 py-2 bg-[#12161F] border border-slate-700 rounded-lg text-xs font-mono font-semibold text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Turno / Referência
              </label>
              <select
                value={turnoFechamento}
                onChange={(e) => setTurnoFechamento(e.target.value)}
                className="w-full px-3 py-2 bg-[#12161F] border border-slate-700 rounded-lg text-xs text-slate-100"
              >
                <option value="Fechamento Geral do Dia">Fechamento Geral do Dia</option>
                <option value="Turno Almoço / Diurno">Turno Almoço / Diurno</option>
                <option value="Turno Jantar / Noturno">Turno Jantar / Noturno</option>
              </select>
            </div>

            {showAdvancedOptions && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Unidade do Caixa
                </label>
                <select
                  value={unidadeId}
                  onChange={(e) => setUnidadeId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[#12161F] border border-slate-700 rounded-lg text-xs text-slate-100"
                >
                  {unidadesPermitidas.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className={`flex flex-col justify-end gap-1.5 ${showAdvancedOptions ? '' : 'sm:col-span-2'}`}>
              <div className="flex items-center justify-end gap-2">
                {showAdvancedOptions && (
                  <>
                    <button
                      type="button"
                      onClick={() => setNovaCatOpen(!novaCatOpen)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[#181D28] hover:bg-slate-800 text-slate-100 border border-slate-700 cursor-pointer whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Nova Categoria</span>
                    </button>
                    <button
                      type="button"
                      disabled={salvando}
                      onClick={handleSalvarModeloCategoriasPadrao}
                      className="px-3 py-2 rounded-lg text-xs font-medium bg-[#181D28] hover:bg-slate-800 text-slate-200 border border-slate-700 cursor-pointer whitespace-nowrap"
                      title="Deixar pré-salvo de onde o sistema puxa os valores de cada categoria"
                    >
                      Pré-Salvar Fontes
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {showAdvancedOptions && novaCatOpen && (
            <div className="p-4 rounded-xl bg-[#0E1117] border border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Criar Nova Categoria Pré-Salva para o Fechamento de Caixa
                </h4>
                <button
                  type="button"
                  onClick={() => setNovaCatOpen(false)}
                  className="text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Fechar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Nome da Categoria (Ex: Vendas iFood, Gorjeta 10%, Taxa Motoboys)
                  </label>
                  <input
                    type="text"
                    value={novaCatForm.nome}
                    onChange={(e) =>
                      setNovaCatForm({
                        ...novaCatForm,
                        nome: e.target.value,
                        filtro_origem: novaCatForm.filtro_origem || e.target.value
                      })
                    }
                    placeholder="Digite o nome da categoria..."
                    className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-700 rounded-lg text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Tipo</label>
                  <select
                    value={novaCatForm.tipo}
                    onChange={(e: any) => setNovaCatForm({ ...novaCatForm, tipo: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-700 rounded-lg text-xs text-white"
                  >
                    <option value="Entrada">Entrada (Receita)</option>
                    <option value="Saída">Saída (Despesa)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    De Onde Puxar no Sistema
                  </label>
                  <select
                    value={novaCatForm.fonte_sistema}
                    onChange={(e: any) =>
                      setNovaCatForm({ ...novaCatForm, fonte_sistema: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-700 rounded-lg text-xs text-white"
                  >
                    {FONTES_SISTEMA_LABELS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Termo / Categoria Alvo no Caixa
                  </label>
                  <input
                    type="text"
                    list="urutau-caixa-categorias-datalist"
                    value={novaCatForm.filtro_origem}
                    onChange={(e) =>
                      setNovaCatForm({ ...novaCatForm, filtro_origem: e.target.value })
                    }
                    placeholder="Ex: Delivery, Entregadores..."
                    className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-700 rounded-lg text-xs text-amber-300"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <span>Modo padrão ao abrir:</span>
                  {(['mesclado', 'sistema', 'manual'] as ModoPreenchimentoFechamento[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setNovaCatForm({ ...novaCatForm, modo_padrao: m })}
                      className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer ${
                        novaCatForm.modo_padrao === m
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {m === 'mesclado'
                        ? 'Mesclar (Sistema + Manual)'
                        : m === 'sistema'
                        ? 'Puxar do Sistema'
                        : 'Digitar Manual'}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={salvando}
                  onClick={handleCriarNovaCategoria}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Salvar Nova Categoria no Modelo</span>
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {itensRelatorio.map((item) => {
              const apuracaoDetalhada = apurarOrigemSistema(
                item.fonte_sistema,
                item.filtro_origem,
                item.tipo
              );
              const isDetalheAberto = detalheOrigemAbertoCatId === item.categoria_id;

              return (
                <div
                  key={item.categoria_id}
                  className="p-3.5 rounded-xl bg-[#0E1117] border border-slate-800 transition-colors space-y-3"
                >
                  <div className={`grid grid-cols-1 gap-3 items-start ${showAdvancedOptions ? 'lg:grid-cols-12' : 'lg:grid-cols-12'}`}>
                    <div className={showAdvancedOptions ? 'lg:col-span-3 space-y-1.5' : 'lg:col-span-5 space-y-1'}>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[11px] font-mono font-semibold ${
                            item.tipo === 'Entrada' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {item.tipo === 'Entrada' ? 'Entrada (+)' : 'Saída (-)'}
                        </span>

                        {showAdvancedOptions && (
                          <div className="flex items-center gap-1.5">
                            <select
                              value={item.tipo}
                              onChange={(e: any) =>
                                atualizarItemRelatorio(item.categoria_id, { tipo: e.target.value })
                              }
                              className="px-1.5 py-0.5 bg-[#12161F] border border-slate-700 rounded text-[10px] text-slate-300"
                            >
                              <option value="Entrada">Entrada</option>
                              <option value="Saída">Saída</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => handleExcluirCategoria(item)}
                              className="p-1 rounded bg-[#181D28] hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-700 cursor-pointer"
                              title="Excluir categoria do relatório"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {showAdvancedOptions ? (
                        <input
                          type="text"
                          value={item.nome}
                          onChange={(e) =>
                            atualizarItemRelatorio(item.categoria_id, { nome: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 bg-[#12161F] border border-slate-800 rounded text-xs font-semibold text-white"
                        />
                      ) : (
                        <div className="text-sm font-medium text-slate-100">{item.nome}</div>
                      )}

                      {showAdvancedOptions && (
                        <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.lancar_no_caixa}
                            onChange={(e) =>
                              atualizarItemRelatorio(item.categoria_id, {
                                lancar_no_caixa: e.target.checked
                              })
                            }
                            className="accent-emerald-500"
                          />
                          <span>Incluir no registro em massa do Caixa</span>
                        </label>
                      )}
                    </div>

                    {showAdvancedOptions && (
                      <div className="lg:col-span-3 space-y-1.5">
                        <label className="block text-[11px] text-slate-400">
                          Origem no Sistema
                        </label>
                        <select
                          value={item.fonte_sistema}
                          onChange={(e: any) =>
                            atualizarItemRelatorio(item.categoria_id, {
                              fonte_sistema: e.target.value
                            })
                          }
                          className="w-full px-2.5 py-1.5 bg-[#12161F] border border-slate-700 rounded text-xs text-slate-200"
                        >
                          {FONTES_SISTEMA_LABELS.map((f) => (
                            <option key={f.value} value={f.value}>
                              {f.label}
                            </option>
                          ))}
                        </select>

                        {item.fonte_sistema !== 'MANUAL_PURO' &&
                          item.fonte_sistema !== 'CAIXA_TODAS_ENTRADAS' &&
                          item.fonte_sistema !== 'CAIXA_TODAS_SAIDAS' && (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                list="urutau-caixa-categorias-datalist"
                                value={item.filtro_origem}
                                onChange={(e) =>
                                  atualizarItemRelatorio(item.categoria_id, {
                                    filtro_origem: e.target.value
                                  })
                                }
                                placeholder="Categoria/termo alvo..."
                                className="flex-1 px-2.5 py-1 bg-[#12161F] border border-slate-800 rounded text-[11px] font-mono text-slate-200"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setDetalheOrigemAbertoCatId(
                                    isDetalheAberto ? null : item.categoria_id
                                  )
                                }
                                className="px-2 py-1 rounded bg-[#181D28] hover:bg-slate-800 text-[10px] font-mono text-slate-300 border border-slate-700 cursor-pointer whitespace-nowrap"
                              >
                                {apuracaoDetalhada.qtd} lanç.
                              </button>
                            </div>
                          )}
                      </div>
                    )}

                    <div className={showAdvancedOptions ? 'lg:col-span-3 space-y-1.5' : 'lg:col-span-4 space-y-1.5'}>
                      {showAdvancedOptions ? (
                        <>
                          <label className="block text-[11px] text-slate-400">
                            Modo e Valor Manual
                          </label>
                          <div className="grid grid-cols-3 gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                atualizarItemRelatorio(item.categoria_id, {
                                  modo_preenchimento: 'sistema'
                                })
                              }
                              className={`py-1 px-1.5 rounded text-[10px] font-medium cursor-pointer border ${
                                item.modo_preenchimento === 'sistema'
                                  ? 'bg-[#181D28] text-white border-slate-500'
                                  : 'bg-[#12161F] text-slate-400 border-slate-800 hover:text-white'
                              }`}
                            >
                              Sistema
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                atualizarItemRelatorio(item.categoria_id, {
                                  modo_preenchimento: 'manual'
                                })
                              }
                              className={`py-1 px-1.5 rounded text-[10px] font-medium cursor-pointer border ${
                                item.modo_preenchimento === 'manual'
                                  ? 'bg-[#181D28] text-white border-slate-500'
                                  : 'bg-[#12161F] text-slate-400 border-slate-800 hover:text-white'
                              }`}
                            >
                              Manual
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                atualizarItemRelatorio(item.categoria_id, {
                                  modo_preenchimento: 'mesclado'
                                })
                              }
                              className={`py-1 px-1.5 rounded text-[10px] font-medium cursor-pointer border ${
                                item.modo_preenchimento === 'mesclado'
                                  ? 'bg-[#181D28] text-white border-slate-500'
                                  : 'bg-[#12161F] text-slate-400 border-slate-800 hover:text-white'
                              }`}
                            >
                              Mesclado
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>Ajuste Manual</span>
                          <span className="font-mono tabular-nums">
                            Sistema: {formatBRL(item.valor_sistema)}
                          </span>
                        </div>
                      )}

                      {item.modo_preenchimento !== 'sistema' ? (
                        <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                          <input
                            type="text"
                            value={item.expressao_manual}
                            onChange={(e) =>
                              handleExpressaoManualItem(item.categoria_id, e.target.value)
                            }
                            placeholder="Ex: 120+50"
                            className="px-2.5 py-1.5 bg-[#12161F] border border-slate-700 rounded text-xs font-mono text-slate-200"
                          />
                          <input
                            type="number"
                            step="0.01"
                            value={item.valor_manual || ''}
                            onChange={(e) =>
                              atualizarItemRelatorio(item.categoria_id, {
                                valor_manual: Number(e.target.value || 0),
                                expressao_manual: e.target.value
                              })
                            }
                            placeholder="R$ 0,00"
                            className="px-2.5 py-1.5 bg-[#12161F] border border-slate-700 rounded text-xs font-mono font-semibold text-white"
                          />
                        </div>
                      ) : (
                        <div className="px-2.5 py-1.5 rounded bg-[#12161F] border border-slate-800 text-[11px] text-slate-300 font-mono tabular-nums">
                          Automático: {formatBRL(item.valor_sistema)}
                        </div>
                      )}
                    </div>

                    <div className="lg:col-span-3 space-y-1.5 flex flex-col justify-between">
                      <div className="p-2.5 rounded-lg bg-[#12161F] border border-slate-800 space-y-0.5">
                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                          <span>Total do Dia</span>
                          <span className="tabular-nums">{apuracaoDetalhada.qtd} lanç.</span>
                        </div>
                        <div
                          className={`text-base font-mono font-bold text-right tabular-nums ${
                            item.tipo === 'Entrada' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {item.tipo === 'Saída' ? '- ' : '+ '}
                          {formatBRL(item.valor_final)}
                        </div>
                      </div>

                      {showAdvancedOptions && (
                        <input
                          type="text"
                          value={item.observacao || ''}
                          onChange={(e) =>
                            atualizarItemRelatorio(item.categoria_id, { observacao: e.target.value })
                          }
                          placeholder="Observação opcional..."
                          className="w-full px-2.5 py-1 bg-[#12161F] border border-slate-800 rounded text-[11px] text-slate-300"
                        />
                      )}
                    </div>
                  </div>

                  {isDetalheAberto && (
                    <div className="p-3 rounded-lg bg-black/60 border border-cyan-500/30 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-cyan-300">
                          Lançamentos do Sistema Puxados em {dataFechamento} para &ldquo;{item.nome}&rdquo; ({apuracaoDetalhada.qtd})
                        </span>
                        <button
                          type="button"
                          onClick={() => setDetalheOrigemAbertoCatId(null)}
                          className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
                        >
                          Ocultar
                        </button>
                      </div>
                      {apuracaoDetalhada.lancamentos.length === 0 ? (
                        <div className="text-[11px] text-slate-400">
                          Nenhum lançamento encontrado no sistema para esta data/filtro. Você pode digitar o valor manualmente ou mudar a fonte apontada acima.
                        </div>
                      ) : (
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {apuracaoDetalhada.lancamentos.map((l: any, idx: number) => (
                            <div
                              key={l.id || idx}
                              className="flex items-center justify-between py-1 px-2 rounded bg-white/5 text-[11px]"
                            >
                              <div>
                                <span className="font-semibold text-white">
                                  {l.descricao || l.categoria}
                                </span>{' '}
                                <span className="text-slate-400 font-mono">({l.categoria})</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-emerald-300">
                                  {formatBRL(l.valor)}
                                </span>
                                {onEditCaixaItem && typeof l.id === 'number' && (
                                  <button
                                    type="button"
                                    onClick={() => onEditCaixaItem(l)}
                                    className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-cyan-300 cursor-pointer"
                                  >
                                    Abrir
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3.5 rounded-xl bg-[#0E1117] border border-slate-800 space-y-1">
              <div className="text-xs font-medium text-slate-400">
                Total Entradas ({dataFechamento})
              </div>
              <div className="text-lg font-mono font-bold text-emerald-400 tabular-nums">
                {formatBRL(totaisFechamentoAtual.entradas)}
              </div>
              <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                Sistema: {formatBRL(totaisFechamentoAtual.entradasSistema)} · Manual:{' '}
                {formatBRL(totaisFechamentoAtual.entradasManual)}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0E1117] border border-slate-800 space-y-1">
              <div className="text-xs font-medium text-slate-400">
                Total Saídas ({dataFechamento})
              </div>
              <div className="text-lg font-mono font-bold text-rose-400 tabular-nums">
                {formatBRL(totaisFechamentoAtual.saidas)}
              </div>
              <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                Sistema: {formatBRL(totaisFechamentoAtual.saidasSistema)} · Manual:{' '}
                {formatBRL(totaisFechamentoAtual.saidasManual)}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0E1117] border border-slate-800 space-y-1">
              <div className="text-xs font-medium text-slate-400">
                Saldo Líquido Apurado
              </div>
              <div className="text-lg font-mono font-bold text-white tabular-nums">
                {formatBRL(totaisFechamentoAtual.saldo)}
              </div>
              <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                {itensRelatorio.filter((i) => i.lancar_no_caixa).length} categorias ativas no fechamento
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#0E1117] border border-slate-800 space-y-3">
            {showAdvancedOptions && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Observações Gerais do Fechamento (Opcional)
                  </label>
                  <input
                    type="text"
                    value={observacoesGerais}
                    onChange={(e) => setObservacoesGerais(e.target.value)}
                    placeholder="Ex: Conferência realizada sem divergências..."
                    className="w-full px-3 py-2 bg-[#12161F] border border-slate-700 rounded-lg text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Regra ao Registrar em Massa no Livro Caixa
                  </label>
                  <select
                    value={modoLancamentoMassa}
                    onChange={(e: any) => setModoLancamentoMassa(e.target.value)}
                    className="w-full px-3 py-2 bg-[#12161F] border border-slate-700 rounded-lg text-xs text-slate-200 font-medium"
                  >
                    <option value="apenas_manual_complementar">
                      Lançar apenas valores manuais e fontes externas (evita duplicidade)
                    </option>
                    <option value="valor_final_consolidado">
                      Lançar valor final consolidado de cada categoria marcada
                    </option>
                  </select>
                </div>
              </div>
            )}

            <div className={`flex flex-wrap items-center justify-between gap-3 ${showAdvancedOptions ? 'pt-2 border-t border-slate-800' : ''}`}>
              {showAdvancedOptions ? (
                <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={salvarFontesComoPadrao}
                    onChange={(e) => setSalvarFontesComoPadrao(e.target.checked)}
                    className="accent-emerald-500"
                  />
                  <span>
                    Manter fontes e modos configurados como padrão para os próximos dias
                  </span>
                </label>
              ) : (
                <div className="text-xs text-slate-400">
                  Use <strong className="text-slate-200">Opções Avançadas</strong> para ajustar fontes do sistema, categorias e regras de lançamento.
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {showAdvancedOptions && (
                  <button
                    type="button"
                    disabled={salvando}
                    onClick={() => handleSalvarFechamentoDiario(false)}
                    className="px-4 py-2 rounded-lg text-xs font-medium bg-[#181D28] hover:bg-slate-800 text-slate-200 border border-slate-700 cursor-pointer disabled:opacity-50"
                  >
                    Apenas Salvar Relatório (Anotação)
                  </button>
                )}

                <button
                  type="button"
                  disabled={salvando}
                  onClick={() => handleSalvarFechamentoDiario(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold bg-[#10B981] hover:bg-[#34D399] text-[#061014] cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  <Check className="w-4 h-4" />
                  <span>Salvar Fechamento e Registrar no Caixa</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-[#090D14] border border-slate-800 rounded-xl p-3.5">
            <div>
              <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                Data Inicial
              </label>
              <input
                type="date"
                value={filtroRelDataInicio}
                onChange={(e) => setFiltroRelDataInicio(e.target.value)}
                className="w-full px-3 py-2 bg-[#11151E] border border-slate-700 rounded-lg text-xs font-mono text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                Data Final
              </label>
              <input
                type="date"
                value={filtroRelDataFim}
                onChange={(e) => setFiltroRelDataFim(e.target.value)}
                className="w-full px-3 py-2 bg-[#11151E] border border-slate-700 rounded-lg text-xs font-mono text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                Tipo de Movimento
              </label>
              <select
                value={filtroRelTipo}
                onChange={(e: any) => setFiltroRelTipo(e.target.value)}
                className="w-full px-3 py-2 bg-[#11151E] border border-slate-700 rounded-lg text-xs text-white"
              >
                <option value="Todos">Entradas e Saídas</option>
                <option value="Entrada">Somente Entradas (+)</option>
                <option value="Saída">Somente Saídas (-)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                Filtrar Categoria Específica
              </label>
              <select
                value={filtroRelCategoria}
                onChange={(e) => setFiltroRelCategoria(e.target.value)}
                className="w-full px-3 py-2 bg-[#11151E] border border-slate-700 rounded-lg text-xs text-amber-300 font-semibold"
              >
                <option value="Todas">Todas as Categorias</option>
                {categoriasSalvas.map((c) => (
                  <option key={c.id} value={c.nome}>
                    {c.nome} ({c.tipo})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col justify-end">
              <button
                type="button"
                onClick={handleExportarRelatorioCSV}
                className="w-full py-2 px-3 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-200 text-xs font-bold cursor-pointer"
              >
                Exportar Levantamento (CSV)
              </button>
            </div>
          </div>

          <div className="bg-[#090D14] border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-white">
                  Levantamento Consolidado por Categoria ({filtroRelDataInicio} até {filtroRelDataFim})
                </h4>
                <p className="text-[11px] text-slate-400">
                  Comparativo entre valores puxados automaticamente do sistema, valores digitados à mão e soma final consolidada.
                </p>
              </div>
              <input
                type="text"
                value={buscaRelTexto}
                onChange={(e) => setBuscaRelTexto(e.target.value)}
                placeholder="Buscar categoria ou observação..."
                className="px-3 py-1.5 bg-[#11151E] border border-slate-700 rounded-lg text-xs text-white"
              />
            </div>

            {consolidadoPorCategoriaRelatorio.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Nenhum fechamento diário registrado no período selecionado. Preencha a aba &ldquo;1. Preenchimento Diário &amp; Registro em Massa&rdquo; e clique em Salvar para consolidar seus relatórios.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-[#0B0D11] text-[11px] font-mono uppercase text-slate-400">
                      <th className="py-2.5 px-4">Categoria do Fechamento</th>
                      <th className="py-2.5 px-4">Tipo</th>
                      <th className="py-2.5 px-4 text-right">Puxado do Sistema</th>
                      <th className="py-2.5 px-4 text-right">Inserido à Mão</th>
                      <th className="py-2.5 px-4 text-right">Total Consolidado</th>
                      <th className="py-2.5 px-4 text-center">Dias / Registros</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {consolidadoPorCategoriaRelatorio.map((row) => (
                      <tr key={`${row.tipo}_${row.nome}`} className="hover:bg-white/5">
                        <td className="py-2.5 px-4 font-bold text-white">{row.nome}</td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              row.tipo === 'Entrada'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            {row.tipo}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-cyan-300">
                          {formatBRL(row.totalSistema)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-amber-300">
                          {formatBRL(row.totalManual)}
                        </td>
                        <td
                          className={`py-2.5 px-4 text-right font-mono font-bold ${
                            row.tipo === 'Entrada' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {formatBRL(row.totalFinal)}
                        </td>
                        <td className="py-2.5 px-4 text-center font-mono text-slate-300">
                          {row.ocorrencias}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-[#090D14] border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800">
              <h4 className="text-sm font-bold text-white">
                Histórico de Relatórios Diários de Fechamento Salvos ({fechamentosPeriodo.length})
              </h4>
            </div>
            {fechamentosPeriodo.length === 0 ? (
              <div className="p-5 text-center text-xs text-slate-400">
                Nenhum fechamento salvo neste intervalo de datas.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-[#0B0D11] text-[11px] font-mono uppercase text-slate-400">
                      <th className="py-2.5 px-4">Data / Turno</th>
                      <th className="py-2.5 px-4">Operador</th>
                      <th className="py-2.5 px-4 text-right">Total Entradas</th>
                      <th className="py-2.5 px-4 text-right">Total Saídas</th>
                      <th className="py-2.5 px-4 text-right">Saldo Líquido</th>
                      <th className="py-2.5 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {fechamentosPeriodo.map((f: RelatorioFechamentoCaixaDiario) => (
                      <tr key={f.id} className="hover:bg-white/5">
                        <td className="py-2.5 px-4">
                          <div className="font-mono font-bold text-emerald-300">{f.data}</div>
                          <div className="text-[10px] text-slate-400">{f.turno}</div>
                        </td>
                        <td className="py-2.5 px-4 text-slate-200">
                          <div>{f.operador_nome}</div>
                          {f.observacoes_gerais && (
                            <div className="text-[10px] text-slate-400">{f.observacoes_gerais}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-400">
                          {formatBRL(f.total_entradas)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-400">
                          {formatBRL(f.total_saidas)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-amber-400">
                          {formatBRL(f.saldo_liquido)}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setDataFechamento(f.data);
                              setUnidadeId(Number(f.unidade_id || 1));
                              setTurnoFechamento(f.turno || 'Fechamento Geral do Dia');
                              setAbaInterna('preenchimento');
                            }}
                            className="px-3 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold cursor-pointer"
                          >
                            Abrir no Fechamento
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
