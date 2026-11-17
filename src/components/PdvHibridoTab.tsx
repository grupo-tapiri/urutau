import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Utensils,
  Receipt,
  ShoppingBag,
  Truck,
  Printer,
  Wifi,
  WifiOff,
  Server,
  Plus,
  Minus,
  Trash2,
  Search,
  Check,
  RefreshCw,
  DollarSign,
  Users,
  Percent,
  CreditCard,
  Package,
  Archive,
  Edit3,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  X
} from 'lucide-react';
import {
  ComandaPdv,
  ERPCompleteData,
  ImpressoraTermicaPdv,
  JobFilaImpressaoPdv,
  ProdutoCardapioPdv,
  SetorImpressaoPdv,
  TipoConexaoImpressoraPdv
} from '../types/erp';
import { offlineSyncEngine, ActiveNetworkTier } from '../services/offlineSyncEngine';

export interface PdvHibridoTabProps {
  data: ERPCompleteData;
  onRefresh: () => void;
  showAlert: (title: string, msg: string, tech?: string) => void;
  showConfirm: (title: string, msg: string, onConfirm: () => void) => void;
  selectedUnidadeId?: number | null;
  currentUser?: any;
  deepLinkEntityId?: number | null;
  deepLinkMesaCodigo?: string | null;
  clearDeepLink?: () => void;
}

interface DraftCartItem {
  tempId: string;
  produto: ProdutoCardapioPdv;
  quantidade: number;
  observacao: string;
}

const NOTAS_RAPIDAS_PREPARO = [
  'Sem cebola',
  'Bem passado',
  'Ao ponto',
  'Gelo e limão',
  'Sem gelo',
  'Para viagem',
  'Sem sal'
];

const METODOS_PAGAMENTO: Array<'PIX' | 'Cartão Crédito' | 'Cartão Débito' | 'Dinheiro' | 'Vale Refeição'> = [
  'PIX',
  'Cartão Crédito',
  'Cartão Débito',
  'Dinheiro',
  'Vale Refeição'
];

function formatBRL(val: number): string {
  return Number(val || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

export const PdvHibridoTab: React.FC<PdvHibridoTabProps> = ({
  data,
  onRefresh,
  showAlert,
  showConfirm,
  selectedUnidadeId,
  currentUser,
  deepLinkEntityId,
  deepLinkMesaCodigo,
  clearDeepLink
}) => {
  const [subView, setSubView] = useState<'salao' | 'balcao_delivery' | 'cardapio' | 'impressoras_wifi'>('salao');
  const [activeTier, setActiveTier] = useState<ActiveNetworkTier>(offlineSyncEngine.getActiveTier());
  const [lanConfig, setLanConfig] = useState(offlineSyncEngine.getLanConfig());
  const [ipManualInput, setIpManualInput] = useState<string>(offlineSyncEngine.getLanConfig().ipServidorLocal);
  const [portaManualInput, setPortaManualInput] = useState<string>(
    offlineSyncEngine.getLanConfig().portaServidorLocal || '3000'
  );
  const [vpsUrlInput, setVpsUrlInput] = useState<string>(
    data.lanHubStatus?.vps_remota_url || offlineSyncEngine.getLanConfig().vpsUrlPrincipal || 'https://nyctibi.us'
  );
  const [lanTestState, setLanTestState] = useState<{
    testing: boolean;
    ok?: boolean;
    msg?: string;
    latencyMs?: number;
  }>({ testing: false });
  const [reconcilingVps, setReconcilingVps] = useState(false);

  const unidadeAtivaId = Number(selectedUnidadeId || data.unidades?.[0]?.id || 1);
  const empresaAtivaId = Number(
    data.unidades?.find((u) => Number(u.id) === unidadeAtivaId)?.empresa_id ||
      data.empresas?.[0]?.id ||
      1
  );
  const operadorNome = String(currentUser?.nome || 'Atendente');

  useEffect(() => {
    const unsub = offlineSyncEngine.subscribe(() => {
      setActiveTier(offlineSyncEngine.getActiveTier());
      setLanConfig(offlineSyncEngine.getLanConfig());
    });
    return unsub;
  }, []);

  const produtosCardapio = useMemo<ProdutoCardapioPdv[]>(() => {
    return (data.pdvProdutos || []).filter((p) => !p.arquivado_legal);
  }, [data.pdvProdutos]);

  const comandasAtivas = useMemo<ComandaPdv[]>(() => {
    return (data.pdvComandas || []).filter(
      (c) => !c.arquivado_legal && c.status !== 'fechada' && c.status !== 'cancelada'
    );
  }, [data.pdvComandas]);

  const comandasFechadasHoje = useMemo<ComandaPdv[]>(() => {
    const hoje = new Date().toISOString().split('T')[0];
    return (data.pdvComandas || []).filter(
      (c) => !c.arquivado_legal && c.status === 'fechada' && String(c.data || '').startsWith(hoje)
    );
  }, [data.pdvComandas]);

  const impressoras = useMemo<ImpressoraTermicaPdv[]>(() => {
    return (data.pdvImpressoras || []).filter((i) => !i.arquivado_legal);
  }, [data.pdvImpressoras]);

  const filaImpressao = useMemo<JobFilaImpressaoPdv[]>(() => {
    return (data.pdvFilaImpressao || []).filter((j) => !j.arquivado_legal);
  }, [data.pdvFilaImpressao]);

  const categoriasCardapio = useMemo<string[]>(() => {
    const set = new Set<string>(['Todos']);
    produtosCardapio.forEach((p) => {
      if (p.categoria) set.add(p.categoria);
    });
    return Array.from(set);
  }, [produtosCardapio]);

  const [mesaSelecionadaNumero, setMesaSelecionadaNumero] = useState<string>('M-01');
  const [comandaAvulsaSelecionadaId, setComandaAvulsaSelecionadaId] = useState<number | null>(null);
  const [novaComandaIdentificador, setNovaComandaIdentificador] = useState<string>('');
  const [filtroStatusSalao, setFiltroStatusSalao] = useState<'todas' | 'ocupadas' | 'livres'>('todas');
  const [setorFiltroSalao, setSetorFiltroSalao] = useState<string>('Todos');
  const [buscaMesaSalao, setBuscaMesaSalao] = useState<string>('');
  const [buscaCardapio, setBuscaCardapio] = useState<string>('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('Todos');
  const [carrinhoMesa, setCarrinhoMesa] = useState<DraftCartItem[]>([]);
  const [pessoasMesaInput, setPessoasMesaInput] = useState<number>(2);
  const [clienteMesaInput, setClienteMesaInput] = useState<string>('');
  const [imprimirAoLancar, setImprimirAoLancar] = useState<boolean>(true);
  const [lancandoPedido, setLancandoPedido] = useState<boolean>(false);

  const [pagamentoModalOpen, setPagamentoModalOpen] = useState<boolean>(false);
  const [comandaParaPagar, setComandaParaPagar] = useState<ComandaPdv | null>(null);
  const [metodoPagSelecionado, setMetodoPagSelecionado] =
    useState<'PIX' | 'Cartão Crédito' | 'Cartão Débito' | 'Dinheiro' | 'Vale Refeição'>('PIX');
  const [aplicarGorjetaModal, setAplicarGorjetaModal] = useState<boolean>(true);
  const [pessoasDivisaoModal, setPessoasDivisaoModal] = useState<number>(1);
  const [descontoModal, setDescontoModal] = useState<string>('0');
  const [modoPagamentoParcial, setModoPagamentoParcial] = useState<'total' | 'por_pessoa' | 'valor_livre'>('total');
  const [valorLivrePagInput, setValorLivrePagInput] = useState<string>('');
  const [recebidoDinheiroInput, setRecebidoDinheiroInput] = useState<string>('');
  const [paganteRefInput, setPaganteRefInput] = useState<string>('');
  const [processandoPagamento, setProcessandoPagamento] = useState<boolean>(false);

  const [modoBalcaoDelivery, setModoBalcaoDelivery] = useState<'balcao' | 'delivery'>('balcao');
  const [carrinhoBalcao, setCarrinhoBalcao] = useState<DraftCartItem[]>([]);
  const [metodoBalcao, setMetodoBalcao] =
    useState<'PIX' | 'Cartão Crédito' | 'Cartão Débito' | 'Dinheiro' | 'Vale Refeição'>('PIX');
  const [recebidoBalcaoDinheiro, setRecebidoBalcaoDinheiro] = useState<string>('');
  const [delivCliente, setDelivCliente] = useState<string>('');
  const [delivWhatsapp, setDelivWhatsapp] = useState<string>('');
  const [delivEndereco, setDelivEndereco] = useState<string>('');
  const [delivEntregador, setDelivEntregador] = useState<string>('');
  const [delivTaxa, setDelivTaxa] = useState<string>('8.00');
  const [finalizandoBalcaoDelivery, setFinalizandoBalcaoDelivery] = useState<boolean>(false);

  const [editProdutoId, setEditProdutoId] = useState<number | null>(null);
  const [prodCodigo, setProdCodigo] = useState<string>('');
  const [prodNome, setProdNome] = useState<string>('');
  const [prodCategoria, setProdCategoria] = useState<string>('Pratos Principais');
  const [prodPreco, setProdPreco] = useState<string>('');
  const [prodSetor, setProdSetor] = useState<SetorImpressaoPdv>('cozinha');
  const [prodEstoqueId, setProdEstoqueId] = useState<string>('');
  const [prodQtdBaixa, setProdQtdBaixa] = useState<string>('1');
  const [salvandoProduto, setSalvandoProduto] = useState<boolean>(false);

  const [editImpId, setEditImpId] = useState<number | null>(null);
  const [impNome, setImpNome] = useState<string>('');
  const [impSetor, setImpSetor] = useState<'cozinha' | 'bar' | 'caixa' | 'geral'>('cozinha');
  const [impTipoConexao, setImpTipoConexao] = useState<TipoConexaoImpressoraPdv>('rede_tcp_9100');
  const [impIpRede, setImpIpRede] = useState<string>('192.168.0.201');
  const [impPortaRede, setImpPortaRede] = useState<string>('9100');
  const [impNomeUsb, setImpNomeUsb] = useState<string>('CAIXA-TERMICA-80MM');
  const [impLargura, setImpLargura] = useState<'80mm' | '58mm'>('80mm');
  const [impVias, setImpVias] = useState<string>('1');
  const [salvandoImp, setSalvandoImp] = useState<boolean>(false);
  const [jobSelecionadoBobina, setJobSelecionadoBobina] = useState<JobFilaImpressaoPdv | null>(null);

  const [floorPlanSyncTick, setFloorPlanSyncTick] = useState<number>(0);
  useEffect(() => {
    const syncFn = () => setFloorPlanSyncTick((t) => t + 1);
    window.addEventListener('urutau-floor-plan-updated', syncFn);
    return () => window.removeEventListener('urutau-floor-plan-updated', syncFn);
  }, []);

  const mesasSalaoPlanta = useMemo<
    { codigo: string; ambienteNome: string; lugares: number }[]
  >(() => {
    void floorPlanSyncTick;
    try {
      const serverPlan = (data.configs || []).find(
        (c) => c.chave === 'mapa_mesas_salao_layout'
      )?.valor_json;
      const rawLocal = localStorage.getItem('urutau_reservas_floor_plan_v2');
      const parsed = rawLocal ? JSON.parse(rawLocal) : serverPlan;
      if (Array.isArray(parsed?.tables) && parsed.tables.length > 0) {
        return parsed.tables
          .map((t: any) => ({
            codigo: String(t.codigo || '').trim(),
            ambienteNome: String(t.ambienteNome || 'Salão Principal').trim(),
            lugares: Number(t.lugares || 4)
          }))
          .filter((t: any) => Boolean(t.codigo));
      }
    } catch {}
    return Array.from({ length: 67 }, (_, idx) => ({
      codigo: `M-${String(idx + 1).padStart(2, '0')}`,
      ambienteNome:
        idx < 32
          ? 'Salão Principal'
          : idx < 50
          ? 'Varanda Coberta'
          : idx < 61
          ? 'Deck & Área Externa'
          : 'Espaço Família & VIP',
      lugares: idx >= 61 ? 8 : 4
    }));
  }, [data.configs, floorPlanSyncTick]);

  const setoresSalaoDisponiveis = useMemo<string[]>(() => {
    const set = new Set<string>(['Todos']);
    mesasSalaoPlanta.forEach((m) => {
      if (m.ambienteNome) set.add(m.ambienteNome);
    });
    return Array.from(set);
  }, [mesasSalaoPlanta]);

  const matchComandaPorCodigoMesa = useCallback(
    (c: ComandaPdv, codigoAlvo: string): boolean => {
      if (c.modalidade !== 'mesa') return false;
      const normCode = String(codigoAlvo || '')
        .trim()
        .replace(/^mesa\s+/i, '')
        .toUpperCase();
      const normMesaNum = String(c.mesa_numero || '')
        .trim()
        .replace(/^mesa\s+/i, '')
        .toUpperCase();
      const normIdent = String(c.identificador || '')
        .trim()
        .replace(/^mesa\s+/i, '')
        .split(' ')[0]
        .toUpperCase();
      if (normMesaNum && normMesaNum === normCode) return true;
      if (normIdent && normIdent === normCode) return true;

      const digitsCode = normCode.match(/^M-?0*(\d+)$/i) || normCode.match(/^0*(\d+)$/);
      if (digitsCode) {
        const numTarget = digitsCode[1];
        const digitsMesa = normMesaNum.match(/^M-?0*(\d+)$/i) || normMesaNum.match(/^0*(\d+)$/);
        if (digitsMesa && digitsMesa[1] === numTarget) return true;
        const digitsIdent = normIdent.match(/^M-?0*(\d+)$/i) || normIdent.match(/^0*(\d+)$/);
        if (digitsIdent && digitsIdent[1] === numTarget) return true;
      }
      return false;
    },
    []
  );

  useEffect(() => {
    if (!deepLinkEntityId && !deepLinkMesaCodigo) return;
    setSubView('salao');
    if (deepLinkMesaCodigo) {
      setComandaAvulsaSelecionadaId(null);
      setMesaSelecionadaNumero(deepLinkMesaCodigo);
    } else if (deepLinkEntityId) {
      const targetCom = comandasAtivas.find((c) => Number(c.id) === Number(deepLinkEntityId));
      if (targetCom) {
        if (targetCom.modalidade === 'mesa' && targetCom.mesa_numero) {
          setComandaAvulsaSelecionadaId(null);
          setMesaSelecionadaNumero(targetCom.mesa_numero);
        } else {
          setComandaAvulsaSelecionadaId(targetCom.id);
        }
      }
    }
    clearDeepLink?.();
  }, [clearDeepLink, comandasAtivas, deepLinkEntityId, deepLinkMesaCodigo]);

  const comandaAtivaSelecionada = useMemo<ComandaPdv | null>(() => {
    if (comandaAvulsaSelecionadaId) {
      return comandasAtivas.find((c) => Number(c.id) === Number(comandaAvulsaSelecionadaId)) || null;
    }
    return comandasAtivas.find((c) => matchComandaPorCodigoMesa(c, mesaSelecionadaNumero)) || null;
  }, [comandaAvulsaSelecionadaId, comandasAtivas, matchComandaPorCodigoMesa, mesaSelecionadaNumero]);

  useEffect(() => {
    if (comandaAtivaSelecionada) {
      setPessoasMesaInput(Math.max(1, Number(comandaAtivaSelecionada.pessoas_mesa || 1)));
      setClienteMesaInput(comandaAtivaSelecionada.cliente_nome || '');
    } else {
      setPessoasMesaInput(2);
      setClienteMesaInput('');
    }
  }, [comandaAtivaSelecionada?.id, mesaSelecionadaNumero]);

  const produtosFiltrados = useMemo(() => {
    const q = buscaCardapio.trim().toLowerCase();
    return produtosCardapio.filter((p) => {
      if (!p.disponivel) return false;
      if (categoriaFiltro !== 'Todos' && p.categoria !== categoriaFiltro) return false;
      if (!q) return true;
      return (
        p.nome.toLowerCase().includes(q) ||
        String(p.codigo || '').toLowerCase().includes(q) ||
        String(p.categoria || '').toLowerCase().includes(q)
      );
    });
  }, [produtosCardapio, categoriaFiltro, buscaCardapio]);

  const adicionarAoCarrinho = (
    prod: ProdutoCardapioPdv,
    alvo: 'salao' | 'balcao'
  ) => {
    const setter = alvo === 'salao' ? setCarrinhoMesa : setCarrinhoBalcao;
    setter((prev) => {
      const idx = prev.findIndex((item) => item.produto.id === prod.id && !item.observacao);
      if (idx >= 0) {
        const clone = [...prev];
        clone[idx] = { ...clone[idx], quantidade: clone[idx].quantidade + 1 };
        return clone;
      }
      return [
        ...prev,
        {
          tempId: `${prod.id}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          produto: prod,
          quantidade: 1,
          observacao: ''
        }
      ];
    });
  };

  const alterarQtdCarrinho = (tempId: string, delta: number, alvo: 'salao' | 'balcao') => {
    const setter = alvo === 'salao' ? setCarrinhoMesa : setCarrinhoBalcao;
    setter((prev) =>
      prev
        .map((it) => (it.tempId === tempId ? { ...it, quantidade: it.quantidade + delta } : it))
        .filter((it) => it.quantidade > 0)
    );
  };

  const alterarObsCarrinho = (tempId: string, obs: string, alvo: 'salao' | 'balcao') => {
    const setter = alvo === 'salao' ? setCarrinhoMesa : setCarrinhoBalcao;
    setter((prev) => prev.map((it) => (it.tempId === tempId ? { ...it, observacao: obs } : it)));
  };

  const subtotalCarrinhoMesa = useMemo(() => {
    return carrinhoMesa.reduce((acc, it) => acc + it.quantidade * Number(it.produto.preco || 0), 0);
  }, [carrinhoMesa]);

  const subtotalCarrinhoBalcao = useMemo(() => {
    return carrinhoBalcao.reduce((acc, it) => acc + it.quantidade * Number(it.produto.preco || 0), 0);
  }, [carrinhoBalcao]);

  const handleLancarPedidoSalao = async () => {
    if (carrinhoMesa.length === 0) {
      showAlert('Carrinho vazio', 'Selecione ao menos um item do cardápio para enviar à mesa ou comanda.');
      return;
    }
    setLancandoPedido(true);
    try {
      const ident = comandaAvulsaSelecionadaId && comandaAtivaSelecionada
        ? comandaAtivaSelecionada.identificador
        : `Mesa ${mesaSelecionadaNumero}`;

      const payload = {
        comanda_id: comandaAtivaSelecionada?.id || undefined,
        modalidade: comandaAvulsaSelecionadaId ? 'comanda' : 'mesa',
        identificador: ident,
        mesa_numero: comandaAvulsaSelecionadaId ? '' : mesaSelecionadaNumero,
        cliente_nome: clienteMesaInput.trim(),
        garcom_nome: operadorNome,
        pessoas_mesa: Math.max(1, Number(pessoasMesaInput || 1)),
        imprimir_setores: imprimirAoLancar,
        unidade_id: unidadeAtivaId,
        empresa_id: empresaAtivaId,
        novos_itens: carrinhoMesa.map((it) => ({
          id: `IT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          produto_id: it.produto.id,
          nome: it.produto.nome,
          categoria: it.produto.categoria,
          quantidade: it.quantidade,
          preco_unitario: it.produto.preco,
          observacao: it.observacao,
          setor_impressao: it.produto.setor_impressao
        }))
      };

      const resp = await fetch('/api/pdv/comandas/abrir-ou-adicionar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await resp.json();
      if (!resp.ok || !json?.ok) {
        showAlert('Erro ao lançar pedido', json?.erro || 'Não foi possível registrar o pedido.');
        return;
      }
      setCarrinhoMesa([]);
      onRefresh();
    } catch (e: any) {
      showAlert('Falha de comunicação', e?.message || 'Erro inesperado ao lançar pedido.');
    } finally {
      setLancandoPedido(false);
    }
  };

  const handleCriarComandaIndividual = async () => {
    const ident = novaComandaIdentificador.trim();
    if (!ident) {
      showAlert('Identificador obrigatório', 'Digite o número do cartão ou nome do cliente (ex: Comanda 105).');
      return;
    }
    try {
      const resp = await fetch('/api/pdv/comandas/abrir-ou-adicionar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modalidade: 'comanda',
          identificador: ident.toLowerCase().startsWith('comanda') ? ident : `Comanda ${ident}`,
          cliente_nome: ident,
          garcom_nome: operadorNome,
          pessoas_mesa: 1,
          novos_itens: [],
          imprimir_setores: false,
          unidade_id: unidadeAtivaId,
          empresa_id: empresaAtivaId
        })
      });
      const json = await resp.json();
      if (resp.ok && json?.comanda) {
        setNovaComandaIdentificador('');
        setComandaAvulsaSelecionadaId(Number(json.comanda.id));
        onRefresh();
      }
    } catch (e: any) {
      showAlert('Erro ao abrir comanda', e?.message || 'Falha ao criar comanda individual.');
    }
  };

  const handleImprimirConferencia = async (comanda: ComandaPdv) => {
    try {
      const resp = await fetch('/api/pdv/comandas/imprimir-conferencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comanda_id: comanda.id,
          pessoas_divisao: comanda.pessoas_mesa,
          aplicar_gorjeta_10: comanda.aplicar_gorjeta_10
        })
      });
      const json = await resp.json();
      if (!resp.ok || !json?.ok) {
        showAlert('Erro na conferência', json?.erro || 'Falha ao enviar conferência para a impressora do caixa.');
        return;
      }
      if (json.job) setJobSelecionadoBobina(json.job);
      onRefresh();
    } catch (e: any) {
      showAlert('Falha na impressão', e?.message || 'Erro ao imprimir conferência.');
    }
  };

  const abrirModalPagamento = (comanda: ComandaPdv) => {
    setComandaParaPagar(comanda);
    setAplicarGorjetaModal(comanda.aplicar_gorjeta_10);
    setPessoasDivisaoModal(Math.max(1, Number(comanda.pessoas_mesa || 1)));
    setDescontoModal(String(comanda.desconto || 0));
    setModoPagamentoParcial('total');
    setValorLivrePagInput('');
    setRecebidoDinheiroInput('');
    setPaganteRefInput('');
    setMetodoPagSelecionado('PIX');
    setPagamentoModalOpen(true);
  };

  const calculoModalPagamento = useMemo(() => {
    if (!comandaParaPagar) {
      return { subtotal: 0, gorjeta: 0, taxa: 0, descontoNum: 0, total: 0, jaPago: 0, saldo: 0, porPessoa: 0, pagarAgora: 0, troco: 0 };
    }
    const subtotal = Number(comandaParaPagar.subtotal_itens || 0);
    const gorjeta = aplicarGorjetaModal ? Number((subtotal * 0.1).toFixed(2)) : 0;
    const taxa = comandaParaPagar.modalidade === 'delivery' ? Number(comandaParaPagar.taxa_entrega || 0) : 0;
    const descontoNum = Math.max(0, Number(String(descontoModal).replace(',', '.') || 0));
    const total = Math.max(0, Number((subtotal + gorjeta + taxa - descontoNum).toFixed(2)));
    const jaPago = Number(comandaParaPagar.valor_pago_acumulado || 0);
    const saldo = Math.max(0, Number((total - jaPago).toFixed(2)));
    const divPessoas = Math.max(1, Number(pessoasDivisaoModal || 1));
    const porPessoa = Number((saldo / divPessoas).toFixed(2));

    let pagarAgora = saldo;
    if (modoPagamentoParcial === 'por_pessoa') {
      pagarAgora = porPessoa;
    } else if (modoPagamentoParcial === 'valor_livre') {
      const digitado = Number(String(valorLivrePagInput).replace(',', '.') || 0);
      pagarAgora = digitado > 0 ? Math.min(saldo, digitado) : saldo;
    }

    const recebidoNum = Number(String(recebidoDinheiroInput).replace(',', '.') || 0);
    const troco =
      metodoPagSelecionado === 'Dinheiro' && recebidoNum > pagarAgora
        ? Number((recebidoNum - pagarAgora).toFixed(2))
        : 0;

    return { subtotal, gorjeta, taxa, descontoNum, total, jaPago, saldo, porPessoa, pagarAgora, troco };
  }, [
    comandaParaPagar,
    aplicarGorjetaModal,
    descontoModal,
    pessoasDivisaoModal,
    modoPagamentoParcial,
    valorLivrePagInput,
    recebidoDinheiroInput,
    metodoPagSelecionado
  ]);

  const handleConfirmarPagamentoModal = async () => {
    if (!comandaParaPagar) return;
    setProcessandoPagamento(true);
    try {
      const resp = await fetch('/api/pdv/comandas/pagar-fechar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comanda_id: comandaParaPagar.id,
          metodo: metodoPagSelecionado,
          valor_pagamento: calculoModalPagamento.pagarAgora,
          valor_recebido_dinheiro:
            metodoPagSelecionado === 'Dinheiro'
              ? Number(String(recebidoDinheiroInput).replace(',', '.') || calculoModalPagamento.pagarAgora)
              : calculoModalPagamento.pagarAgora,
          pagante_ref:
            paganteRefInput.trim() ||
            (modoPagamentoParcial === 'por_pessoa' ? `Cota 1/${pessoasDivisaoModal}` : ''),
          aplicar_gorjeta_10: aplicarGorjetaModal,
          desconto: calculoModalPagamento.descontoNum,
          pessoas_mesa: pessoasDivisaoModal,
          operador: operadorNome,
          forcar_fechamento_total: modoPagamentoParcial === 'total'
        })
      });
      const json = await resp.json();
      if (!resp.ok || !json?.ok) {
        showAlert('Erro no pagamento', json?.erro || 'Falha ao registrar pagamento.');
        return;
      }
      if (json.job_impressao) {
        setJobSelecionadoBobina(json.job_impressao);
      }
      if (json.fechada_completa || json.offlineQueued) {
        setPagamentoModalOpen(false);
        setComandaParaPagar(null);
      } else if (json.comanda) {
        setComandaParaPagar(json.comanda);
        setValorLivrePagInput('');
        setRecebidoDinheiroInput('');
      }
      onRefresh();
    } catch (e: any) {
      showAlert('Erro ao fechar conta', e?.message || 'Falha inesperada no pagamento.');
    } finally {
      setProcessandoPagamento(false);
    }
  };

  const handleCancelarItemComanda = (comandaId: number, itemId: string, itemNome: string) => {
    showConfirm(
      'Cancelar item lançado',
      `Deseja cancelar o item "${itemNome}" desta comanda? O total será recalculado imediatamente.`,
      async () => {
        try {
          await fetch('/api/pdv/comandas/atualizar-item', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              comanda_id: comandaId,
              item_id: itemId,
              status_preparo: 'cancelado'
            })
          });
          onRefresh();
        } catch {}
      }
    );
  };

  const handleFinalizarVendaBalcaoOuDelivery = async () => {
    if (carrinhoBalcao.length === 0) {
      showAlert('Pedido vazio', 'Adicione ao menos um item ao pedido de balcão ou delivery.');
      return;
    }
    if (modoBalcaoDelivery === 'delivery' && !delivCliente.trim()) {
      showAlert('Dados do cliente', 'Informe ao menos o nome do cliente para identificar a entrega.');
      return;
    }

    setFinalizandoBalcaoDelivery(true);
    try {
      const taxaNum = modoBalcaoDelivery === 'delivery' ? Math.max(0, Number(String(delivTaxa).replace(',', '.') || 0)) : 0;
      const respAb = await fetch('/api/pdv/comandas/abrir-ou-adicionar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modalidade: modoBalcaoDelivery,
          identificador:
            modoBalcaoDelivery === 'balcao'
              ? `Balcão ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
              : `Delivery — ${delivCliente.trim()}`,
          cliente_nome: delivCliente.trim() || 'Cliente Balcão',
          cliente_telefone: delivWhatsapp.trim(),
          endereco_entrega: delivEndereco.trim(),
          entregador_nome: delivEntregador.trim(),
          taxa_entrega: taxaNum,
          garcom_nome: operadorNome,
          pessoas_mesa: 1,
          aplicar_gorjeta_10: false,
          imprimir_setores: true,
          unidade_id: unidadeAtivaId,
          empresa_id: empresaAtivaId,
          novos_itens: carrinhoBalcao.map((it) => ({
            id: `BD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            produto_id: it.produto.id,
            nome: it.produto.nome,
            categoria: it.produto.categoria,
            quantidade: it.quantidade,
            preco_unitario: it.produto.preco,
            observacao: it.observacao,
            setor_impressao: it.produto.setor_impressao
          }))
        })
      });
      const jsonAb = await respAb.json();
      if (!respAb.ok || !jsonAb?.ok) {
        showAlert('Erro no lançamento', jsonAb?.erro || 'Falha ao abrir venda rápida.');
        return;
      }

      if (modoBalcaoDelivery === 'balcao' && jsonAb.comanda?.id) {
        const totBalcao = Number(jsonAb.comanda.valor_total || subtotalCarrinhoBalcao);
        const recNum = Number(String(recebidoBalcaoDinheiro).replace(',', '.') || totBalcao);
        await fetch('/api/pdv/comandas/pagar-fechar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            comanda_id: jsonAb.comanda.id,
            metodo: metodoBalcao,
            valor_pagamento: totBalcao,
            valor_recebido_dinheiro: metodoBalcao === 'Dinheiro' ? Math.max(totBalcao, recNum) : totBalcao,
            aplicar_gorjeta_10: false,
            operador: operadorNome,
            forcar_fechamento_total: true
          })
        });
      }

      setCarrinhoBalcao([]);
      setRecebidoBalcaoDinheiro('');
      if (modoBalcaoDelivery === 'delivery') {
        setDelivCliente('');
        setDelivWhatsapp('');
        setDelivEndereco('');
      }
      onRefresh();
    } catch (e: any) {
      showAlert('Erro ao processar pedido', e?.message || 'Falha inesperada na venda.');
    } finally {
      setFinalizandoBalcaoDelivery(false);
    }
  };

  const handleSalvarProdutoCardapio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodNome.trim()) {
      showAlert('Nome obrigatório', 'Informe o nome do produto do cardápio.');
      return;
    }
    setSalvandoProduto(true);
    try {
      const resp = await fetch('/api/pdv/produtos/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editProdutoId || undefined,
          codigo: prodCodigo.trim(),
          nome: prodNome.trim(),
          categoria: prodCategoria.trim() || 'Salão & Cozinha',
          preco: Number(String(prodPreco).replace(',', '.') || 0),
          setor_impressao: prodSetor,
          estoque_item_id: prodEstoqueId ? Number(prodEstoqueId) : null,
          qtd_baixa_estoque: Number(String(prodQtdBaixa).replace(',', '.') || 1),
          disponivel: true,
          unidade_id: unidadeAtivaId,
          empresa_id: empresaAtivaId
        })
      });
      const json = await resp.json();
      if (!resp.ok || !json?.ok) {
        showAlert('Erro ao salvar produto', json?.erro || 'Falha ao gravar item do cardápio.');
        return;
      }
      setEditProdutoId(null);
      setProdCodigo('');
      setProdNome('');
      setProdPreco('');
      setProdEstoqueId('');
      setProdQtdBaixa('1');
      onRefresh();
    } finally {
      setSalvandoProduto(false);
    }
  };

  const handleSalvarPareamentoManualWifi = async () => {
    const cleanIp = ipManualInput.trim().replace(/^https?:\/\//i, '').split(':')[0];
    const cleanPort = portaManualInput.trim().replace(/\D/g, '') || '3000';
    const saved = offlineSyncEngine.saveLanConfig({
      ipServidorLocal: cleanIp,
      portaServidorLocal: cleanPort,
      vpsUrlPrincipal: vpsUrlInput.trim() || 'https://nyctibi.us',
      autoFailoverWifi: true
    });
    setIpManualInput(saved.ipServidorLocal);
    setPortaManualInput(saved.portaServidorLocal);

    fetch('/api/lan/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vps_remota_url: saved.vpsUrlPrincipal })
    }).catch(() => {});

    if (cleanIp) {
      setLanTestState({ testing: true });
      const res = await offlineSyncEngine.testLanConnection(cleanIp, cleanPort);
      setLanTestState({
        testing: false,
        ok: res.ok,
        latencyMs: res.latencyMs,
        msg: res.ok
          ? `Conectado ao Servidor Local via Wi-Fi (${cleanIp}:${cleanPort}) em ${res.latencyMs}ms.`
          : res.erro
      });
    } else {
      setLanTestState({
        testing: false,
        ok: true,
        msg: 'Configuração atualizada (sem IP local fixo definido).'
      });
    }
  };

  const handleSalvarImpressora = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!impNome.trim()) {
      showAlert('Nome obrigatório', 'Informe o nome da impressora térmica.');
      return;
    }
    setSalvandoImp(true);
    try {
      const resp = await fetch('/api/pdv/impressoras/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editImpId || undefined,
          nome: impNome.trim(),
          setor: impSetor,
          tipo_conexao: impTipoConexao,
          ip_rede: impIpRede.trim(),
          porta_rede: Number(impPortaRede || 9100),
          nome_usb_windows: impNomeUsb.trim() || 'CAIXA-TERMICA-80MM',
          largura_papel: impLargura,
          vias: Number(impVias || 1),
          cortar_papel: true,
          ativa: true,
          unidade_id: unidadeAtivaId,
          empresa_id: empresaAtivaId
        })
      });
      const json = await resp.json();
      if (!resp.ok || !json?.ok) {
        showAlert('Erro na impressora', json?.erro || 'Não foi possível salvar a impressora.');
        return;
      }
      setEditImpId(null);
      setImpNome('');
      onRefresh();
    } finally {
      setSalvandoImp(false);
    }
  };

  const handleTestarImpressora = async (impId: number) => {
    try {
      const resp = await fetch('/api/pdv/impressoras/testar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          impressora_id: impId,
          unidade_id: unidadeAtivaId,
          empresa_id: empresaAtivaId
        })
      });
      const json = await resp.json();
      if (json?.job) {
        setJobSelecionadoBobina(json.job);
      }
      onRefresh();
    } catch (e: any) {
      showAlert('Erro no teste de impressão', e?.message || 'Falha ao disparar teste ESC/POS.');
    }
  };

  const handleReimprimirJob = async (jobId: number) => {
    try {
      const resp = await fetch('/api/pdv/impressoras/reimprimir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId })
      });
      const json = await resp.json();
      if (json?.job) {
        setJobSelecionadoBobina(json.job);
      }
      onRefresh();
    } catch (e: any) {
      showAlert('Erro na reimpressão', e?.message || 'Falha ao reimprimir cupom.');
    }
  };

  const handleImprimirBobinaNavegador = (job: JobFilaImpressaoPdv) => {
    const areaPrint = document.getElementById('urutau-bobina-print-only');
    if (areaPrint) {
      areaPrint.innerText = (job.linhas_texto || []).join('\n');
    }
    window.print();
  };

  const handleReconciliarComVpsAgora = async () => {
    setReconcilingVps(true);
    try {
      const res = await offlineSyncEngine.probeAndReconcileVps();
      onRefresh();
      if (res.vpsOnline) {
        showAlert(
          'Reconciliação concluída',
          `Conexão com a VPS validada. ${res.reconciliados} operação(ões) pendente(s) foram reconciliadas sem duplicidade.`
        );
      } else {
        showAlert(
          'VPS ainda sem internet',
          'A VPS remota não respondeu no momento. Os lançamentos seguem seguros na rede Wi-Fi local e sincronizarão assim que a internet voltar.'
        );
      }
    } finally {
      setReconcilingVps(false);
    }
  };

  const faturamentoFechadoHoje = useMemo(() => {
    return comandasFechadasHoje.reduce((acc, c) => acc + Number(c.valor_total || 0), 0);
  }, [comandasFechadasHoje]);

  const totalEmAbertoSalao = useMemo(() => {
    return comandasAtivas.reduce((acc, c) => acc + Number(c.saldo_restante || 0), 0);
  }, [comandasAtivas]);

  const deliveriesAtivos = useMemo(() => {
    return comandasAtivas.filter((c) => c.modalidade === 'delivery');
  }, [comandasAtivas]);

  const ipsDetectadosCaixa = data.lanHubStatus?.ips_locais || [];

  return (
    <div className="space-y-4">
      <div id="urutau-bobina-print-only" className="hidden print:block font-mono text-xs whitespace-pre p-2 text-black bg-white" />

      <div className="bg-[#0B1217] border border-white/10 rounded-xl p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight">
              PDV Híbrido & Comandas (VPS + Contingência Wi-Fi Local)
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-md border ${
                activeTier === 'vps_online'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : activeTier === 'wifi_lan_ativo'
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                  : 'bg-rose-500/15 border-rose-500/40 text-rose-200'
              }`}
            >
              {activeTier === 'vps_online' ? (
                <>
                  <Server className="w-3.5 h-3.5" />
                  Operando na VPS Online
                </>
              ) : activeTier === 'wifi_lan_ativo' ? (
                <>
                  <Wifi className="w-3.5 h-3.5" />
                  Contingência Wi-Fi Local Ativa ({lanConfig.ipServidorLocal || window.location.hostname}:{lanConfig.portaServidorLocal || '3000'})
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5" />
                  Fila Offline neste Aparelho
                </>
              )}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Mesas, comandas, venda rápida de balcão, delivery, divisão de conta com 10% e impressão térmica por setor (Cozinha, Bar e Caixa).
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3 shrink-0">
          <div className="px-3 py-2 rounded-lg bg-[#0F171E] border border-white/10">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Abertas Agora</div>
            <div className="text-sm sm:text-base font-bold font-mono tabular-nums text-amber-300">
              {comandasAtivas.length} ({formatBRL(totalEmAbertoSalao)})
            </div>
          </div>
          <div className="px-3 py-2 rounded-lg bg-[#0F171E] border border-white/10">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Fechado Hoje</div>
            <div className="text-sm sm:text-base font-bold font-mono tabular-nums text-emerald-300">
              {formatBRL(faturamentoFechadoHoje)}
            </div>
          </div>
          <div className="px-3 py-2 rounded-lg bg-[#0F171E] border border-white/10">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Impressoras</div>
            <div className="text-sm sm:text-base font-bold font-mono tabular-nums text-slate-100">
              {impressoras.filter((i) => i.ativa).length} ativas
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-2">
        <button
          type="button"
          onClick={() => setSubView('salao')}
          className={`min-h-[44px] px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 border transition-colors cursor-pointer ${
            subView === 'salao'
              ? 'bg-emerald-500 text-slate-950 border-emerald-400'
              : 'bg-[#0B1217] text-slate-300 border-white/10 hover:bg-white/5'
          }`}
        >
          <Utensils className="w-4 h-4" />
          Mesas & Comandas ({comandasAtivas.filter((c) => c.modalidade === 'mesa' || c.modalidade === 'comanda').length})
        </button>

        <button
          type="button"
          onClick={() => setSubView('balcao_delivery')}
          className={`min-h-[44px] px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 border transition-colors cursor-pointer ${
            subView === 'balcao_delivery'
              ? 'bg-emerald-500 text-slate-950 border-emerald-400'
              : 'bg-[#0B1217] text-slate-300 border-white/10 hover:bg-white/5'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          Balcão Rápido & Delivery ({deliveriesAtivos.length})
        </button>

        <button
          type="button"
          onClick={() => setSubView('cardapio')}
          className={`min-h-[44px] px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 border transition-colors cursor-pointer ${
            subView === 'cardapio'
              ? 'bg-emerald-500 text-slate-950 border-emerald-400'
              : 'bg-[#0B1217] text-slate-300 border-white/10 hover:bg-white/5'
          }`}
        >
          <Package className="w-4 h-4" />
          Cardápio & Baixa de Estoque ({produtosCardapio.length})
        </button>

        <button
          type="button"
          onClick={() => setSubView('impressoras_wifi')}
          className={`min-h-[44px] px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 border transition-colors cursor-pointer ${
            subView === 'impressoras_wifi'
              ? 'bg-amber-500 text-slate-950 border-amber-400'
              : 'bg-[#0B1217] text-slate-300 border-white/10 hover:bg-white/5'
          }`}
        >
          <Printer className="w-4 h-4" />
          Impressoras & Rede Wi-Fi Local
        </button>
      </div>

      {subView === 'salao' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
          <div className="xl:col-span-5 space-y-4">
            <div className="bg-[#0B1217] border border-white/10 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-slate-100">
                  Mesas da Planta ({mesasSalaoPlanta.length})
                </h2>
                <div className="flex items-center gap-1">
                  {(['todas', 'ocupadas', 'livres'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFiltroStatusSalao(f)}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold border cursor-pointer ${
                        filtroStatusSalao === f
                          ? 'bg-white/15 text-white border-white/30'
                          : 'bg-transparent text-slate-400 border-white/10 hover:text-slate-200'
                      }`}
                    >
                      {f === 'todas' ? 'Todas' : f === 'ocupadas' ? 'Ocupadas' : 'Livres'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={buscaMesaSalao}
                  onChange={(e) => setBuscaMesaSalao(e.target.value)}
                  placeholder="Filtrar mesa ou cliente (ex: M-42)..."
                  className="flex-1 min-h-[36px] px-2.5 rounded-lg bg-[#0F171E] border border-white/15 text-xs text-slate-100"
                />
                {setoresSalaoDisponiveis.length > 2 && (
                  <select
                    value={setorFiltroSalao}
                    onChange={(e) => setSetorFiltroSalao(e.target.value)}
                    className="min-h-[36px] px-2.5 rounded-lg bg-[#0F171E] border border-white/15 text-xs text-slate-100"
                  >
                    {setoresSalaoDisponiveis.map((st) => (
                      <option key={st} value={st}>
                        {st === 'Todos' ? 'Todos os Setores' : st}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-[360px] overflow-y-auto pr-1">
                {mesasSalaoPlanta.map((mInfo) => {
                  const codigo = mInfo.codigo;
                  if (setorFiltroSalao !== 'Todos' && mInfo.ambienteNome !== setorFiltroSalao) {
                    return null;
                  }
                  const comMesa = comandasAtivas.find((c) => matchComandaPorCodigoMesa(c, codigo));
                  if (filtroStatusSalao === 'ocupadas' && !comMesa) return null;
                  if (filtroStatusSalao === 'livres' && comMesa) return null;

                  if (buscaMesaSalao.trim()) {
                    const q = buscaMesaSalao.trim().toLowerCase();
                    const matchCod = codigo.toLowerCase().includes(q);
                    const matchCli = String(comMesa?.cliente_nome || '')
                      .toLowerCase()
                      .includes(q);
                    if (!matchCod && !matchCli) return null;
                  }

                  const isSelected =
                    !comandaAvulsaSelecionadaId &&
                    String(mesaSelecionadaNumero).toUpperCase() === codigo.toUpperCase();
                  const aguardandoPag = comMesa?.status === 'aguardando_pagamento';
                  const displayCodigo = /^\d+$/.test(codigo) ? `M-${codigo}` : codigo;

                  return (
                    <button
                      key={codigo}
                      type="button"
                      onClick={() => {
                        setComandaAvulsaSelecionadaId(null);
                        setMesaSelecionadaNumero(codigo);
                      }}
                      className={`min-h-[60px] p-2 rounded-lg border text-left flex flex-col justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'ring-2 ring-emerald-400 bg-emerald-500/20 border-emerald-400'
                          : aguardandoPag
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-100'
                          : comMesa
                          ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-100'
                          : 'bg-[#0F171E] border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full gap-1">
                        <span className="text-xs font-bold font-mono tabular-nums truncate">
                          {displayCodigo}
                        </span>
                        <span className="text-[9px] font-mono tabular-nums text-slate-400 shrink-0">
                          {mInfo.lugares}L
                        </span>
                      </div>
                      <div className="text-[10px] font-mono tabular-nums truncate mt-1">
                        {comMesa ? formatBRL(comMesa.saldo_restante) : 'Livre'}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-white/10 space-y-2">
                <div className="text-xs font-bold text-slate-200">Comandas Individuais / Cartões</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={novaComandaIdentificador}
                    onChange={(e) => setNovaComandaIdentificador(e.target.value)}
                    placeholder="Ex: 104 ou João Balcão"
                    className="flex-1 min-h-[42px] px-3 rounded-lg bg-[#0F171E] border border-white/15 text-xs text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={handleCriarComandaIndividual}
                    className="min-h-[42px] px-3.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-slate-100 cursor-pointer shrink-0"
                  >
                    Abrir Comanda
                  </button>
                </div>

                {comandasAtivas.filter((c) => c.modalidade === 'comanda').length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {comandasAtivas
                      .filter((c) => c.modalidade === 'comanda')
                      .map((com) => (
                        <button
                          key={com.id}
                          type="button"
                          onClick={() => setComandaAvulsaSelecionadaId(com.id)}
                          className={`min-h-[40px] px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-2 cursor-pointer ${
                            comandaAvulsaSelecionadaId === com.id
                              ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                              : 'bg-[#0F171E] text-slate-200 border-white/15'
                          }`}
                        >
                          <span>{com.identificador}</span>
                          <span className="font-mono tabular-nums">{formatBRL(com.saldo_restante)}</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-[#0B1217] border border-white/10 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                <div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider">Conta Selecionada</div>
                  <h3 className="text-base font-bold text-slate-100">
                    {comandaAtivaSelecionada
                      ? comandaAtivaSelecionada.identificador
                      : `Mesa ${mesaSelecionadaNumero} (Livre)`}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    Pessoas:
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={pessoasMesaInput}
                      onChange={(e) => setPessoasMesaInput(Math.max(1, Number(e.target.value || 1)))}
                      className="w-14 min-h-[36px] px-2 rounded bg-[#0F171E] border border-white/15 text-xs font-mono text-center text-slate-100"
                    />
                  </label>
                </div>
              </div>

              <input
                type="text"
                value={clienteMesaInput}
                onChange={(e) => setClienteMesaInput(e.target.value)}
                placeholder="Nome do cliente na mesa (opcional)"
                className="w-full min-h-[40px] px-3 rounded-lg bg-[#0F171E] border border-white/10 text-xs text-slate-200"
              />

              {comandaAtivaSelecionada ? (
                <div className="space-y-3">
                  <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                    {(comandaAtivaSelecionada.itens || []).map((it) => (
                      <div
                        key={it.id}
                        className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 text-xs ${
                          it.status_preparo === 'cancelado'
                            ? 'bg-rose-500/5 border-rose-500/20 opacity-50 line-through'
                            : 'bg-[#0F171E] border-white/10'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-100 truncate">
                            {it.quantidade}x {it.nome}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Setor: {it.setor_impressao.toUpperCase()} • {it.horario} • {it.garcom_nome}
                            {it.observacao ? ` • Obs: ${it.observacao}` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono font-bold tabular-nums text-slate-100">
                            {formatBRL(it.subtotal)}
                          </span>
                          {it.status_preparo !== 'cancelado' && (
                            <button
                              type="button"
                              onClick={() =>
                                handleCancelarItemComanda(comandaAtivaSelecionada.id, it.id, it.nome)
                              }
                              className="p-1.5 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 cursor-pointer"
                              title="Cancelar item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 rounded-lg bg-[#0F171E] border border-white/10 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-300">
                      <span>Subtotal dos Itens</span>
                      <span className="font-mono tabular-nums">{formatBRL(comandaAtivaSelecionada.subtotal_itens)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-300">
                      <span>Taxa de Serviço Garçom (10%)</span>
                      <span className="font-mono tabular-nums text-amber-300">
                        {comandaAtivaSelecionada.aplicar_gorjeta_10
                          ? formatBRL(comandaAtivaSelecionada.valor_gorjeta)
                          : 'R$ 0,00 (Sem 10%)'}
                      </span>
                    </div>
                    {comandaAtivaSelecionada.valor_pago_acumulado > 0 && (
                      <div className="flex justify-between text-emerald-300">
                        <span>Pagamentos Parciais Recebidos</span>
                        <span className="font-mono tabular-nums">
                          - {formatBRL(comandaAtivaSelecionada.valor_pago_acumulado)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-bold text-white pt-1.5 border-t border-white/10">
                      <span>Saldo a Pagar ({Math.max(1, comandaAtivaSelecionada.pessoas_mesa)} pessoa/s)</span>
                      <span className="font-mono tabular-nums text-emerald-400">
                        {formatBRL(comandaAtivaSelecionada.saldo_restante)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Valor por pessoa na divisão igual:</span>
                      <span className="font-mono tabular-nums">
                        {formatBRL(
                          comandaAtivaSelecionada.saldo_restante /
                            Math.max(1, Number(comandaAtivaSelecionada.pessoas_mesa || 1))
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleImprimirConferencia(comandaAtivaSelecionada)}
                      className="min-h-[44px] px-3 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-slate-100 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      Imprimir Conferência
                    </button>
                    <button
                      type="button"
                      onClick={() => abrirModalPagamento(comandaAtivaSelecionada)}
                      className="min-h-[44px] px-3 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <DollarSign className="w-4 h-4" />
                      Dividir / Fechar Conta
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-[#0F171E] border border-white/5 text-xs text-slate-400 text-center">
                  Mesa livre. Toque nos itens do cardápio ao lado para montar e enviar o pedido para Cozinha e Bar.
                </div>
              )}
            </div>
          </div>

          <div className="xl:col-span-7 space-y-4">
            <div className="bg-[#0B1217] border border-white/10 rounded-xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={buscaCardapio}
                    onChange={(e) => setBuscaCardapio(e.target.value)}
                    placeholder="Buscar prato, bebida ou código..."
                    className="w-full min-h-[44px] pl-9 pr-3 rounded-lg bg-[#0F171E] border border-white/15 text-xs text-slate-100"
                  />
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {categoriasCardapio.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoriaFiltro(cat)}
                      className={`min-h-[44px] px-3 rounded-lg text-xs font-semibold whitespace-nowrap border cursor-pointer ${
                        categoriaFiltro === cat
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-[#0F171E] text-slate-300 border-white/10 hover:bg-white/5'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
                {produtosFiltrados.map((prod) => (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => adicionarAoCarrinho(prod, 'salao')}
                    className="min-h-[64px] p-3 rounded-lg bg-[#0F171E] hover:bg-white/[0.06] border border-white/10 hover:border-emerald-500/40 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-100 truncate">{prod.nome}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {prod.categoria} • Setor: {prod.setor_impressao.toUpperCase()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-bold font-mono tabular-nums text-emerald-300">
                        {formatBRL(prod.preco)}
                      </span>
                      <span className="w-7 h-7 rounded-md bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
                        <Plus className="w-4 h-4" />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-[#0B1217] border border-emerald-500/30 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-100">
                  Novo Pedido para {comandaAtivaSelecionada ? comandaAtivaSelecionada.identificador : `Mesa ${mesaSelecionadaNumero}`}
                </h3>
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={imprimirAoLancar}
                    onChange={(e) => setImprimirAoLancar(e.target.checked)}
                    className="rounded border-white/20"
                  />
                  Imprimir automaticamente na Cozinha / Bar
                </label>
              </div>

              {carrinhoMesa.length === 0 ? (
                <div className="p-4 rounded-lg bg-[#0F171E] border border-white/5 text-xs text-slate-400 text-center">
                  Toque nos produtos acima para adicionar ao pedido do garçom.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {carrinhoMesa.map((item) => (
                    <div
                      key={item.tempId}
                      className="p-3 rounded-lg bg-[#0F171E] border border-white/10 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-100">{item.produto.nome}</div>
                          <div className="text-[11px] text-slate-400">
                            Impressão: {item.produto.setor_impressao.toUpperCase()} • Unit: {formatBRL(item.produto.preco)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => alterarQtdCarrinho(item.tempId, -1, 'salao')}
                            className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/15 flex items-center justify-center text-slate-100 cursor-pointer"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-7 text-center font-mono font-bold text-sm text-white">
                            {item.quantidade}
                          </span>
                          <button
                            type="button"
                            onClick={() => alterarQtdCarrinho(item.tempId, 1, 'salao')}
                            className="w-9 h-9 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 flex items-center justify-center text-emerald-300 cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <span className="w-20 text-right font-mono font-bold tabular-nums text-xs text-emerald-300">
                            {formatBRL(item.quantidade * item.produto.preco)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <input
                          type="text"
                          value={item.observacao}
                          onChange={(e) => alterarObsCarrinho(item.tempId, e.target.value, 'salao')}
                          placeholder="Observação de preparo (ex: sem cebola, ponto da carne)..."
                          className="flex-1 min-w-[180px] min-h-[36px] px-2.5 rounded bg-black/30 border border-white/10 text-xs text-slate-200"
                        />
                        {NOTAS_RAPIDAS_PREPARO.slice(0, 4).map((nota) => (
                          <button
                            key={nota}
                            type="button"
                            onClick={() =>
                              alterarObsCarrinho(
                                item.tempId,
                                item.observacao ? `${item.observacao}, ${nota}` : nota,
                                'salao'
                              )
                            }
                            className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-slate-300 cursor-pointer"
                          >
                            + {nota}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-white/10">
                    <div>
                      <div className="text-[11px] text-slate-400">Subtotal deste envio</div>
                      <div className="text-base font-bold font-mono tabular-nums text-emerald-300">
                        {formatBRL(subtotalCarrinhoMesa)}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={lancandoPedido}
                      onClick={handleLancarPedidoSalao}
                      className="min-h-[48px] px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      {lancandoPedido
                        ? 'Enviando Pedido...'
                        : imprimirAoLancar
                        ? 'Enviar Pedido & Imprimir nos Setores'
                        : 'Salvar Pedido na Comanda'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {subView === 'balcao_delivery' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
          <div className="xl:col-span-7 bg-[#0B1217] border border-white/10 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModoBalcaoDelivery('balcao')}
                  className={`min-h-[44px] px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 border cursor-pointer ${
                    modoBalcaoDelivery === 'balcao'
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                      : 'bg-[#0F171E] text-slate-300 border-white/10'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4" />
                  Venda Rápida de Balcão
                </button>
                <button
                  type="button"
                  onClick={() => setModoBalcaoDelivery('delivery')}
                  className={`min-h-[44px] px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 border cursor-pointer ${
                    modoBalcaoDelivery === 'delivery'
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-[#0F171E] text-slate-300 border-white/10'
                  }`}
                >
                  <Truck className="w-4 h-4" />
                  Anotação de Delivery
                </button>
              </div>
              <input
                type="text"
                value={buscaCardapio}
                onChange={(e) => setBuscaCardapio(e.target.value)}
                placeholder="Pesquisar item rápido..."
                className="min-h-[42px] px-3 rounded-lg bg-[#0F171E] border border-white/15 text-xs text-slate-100"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[440px] overflow-y-auto pr-1">
              {produtosFiltrados.map((prod) => (
                <button
                  key={prod.id}
                  type="button"
                  onClick={() => adicionarAoCarrinho(prod, 'balcao')}
                  className="min-h-[60px] p-3 rounded-lg bg-[#0F171E] hover:bg-white/[0.06] border border-white/10 text-left flex items-center justify-between gap-2 cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-100 truncate">{prod.nome}</div>
                    <div className="text-[11px] text-slate-400">{prod.setor_impressao.toUpperCase()}</div>
                  </div>
                  <span className="font-mono font-bold text-xs text-emerald-300 shrink-0">
                    {formatBRL(prod.preco)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="xl:col-span-5 space-y-4">
            <div className="bg-[#0B1217] border border-white/10 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-bold text-slate-100">
                {modoBalcaoDelivery === 'balcao'
                  ? 'Fechamento Direto de Balcão (Imprime Produção + Recibo)'
                  : 'Dados da Entrega (Imprime Cozinha/Bar e Abre Acompanhamento)'}
              </h3>

              {modoBalcaoDelivery === 'delivery' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    value={delivCliente}
                    onChange={(e) => setDelivCliente(e.target.value)}
                    placeholder="Nome do cliente *"
                    className="min-h-[42px] px-3 rounded-lg bg-[#0F171E] border border-white/15 text-xs text-slate-100"
                  />
                  <input
                    type="text"
                    value={delivWhatsapp}
                    onChange={(e) => setDelivWhatsapp(e.target.value)}
                    placeholder="WhatsApp / Telefone"
                    className="min-h-[42px] px-3 rounded-lg bg-[#0F171E] border border-white/15 text-xs text-slate-100"
                  />
                  <input
                    type="text"
                    value={delivEndereco}
                    onChange={(e) => setDelivEndereco(e.target.value)}
                    placeholder="Endereço completo de entrega"
                    className="sm:col-span-2 min-h-[42px] px-3 rounded-lg bg-[#0F171E] border border-white/15 text-xs text-slate-100"
                  />
                  <input
                    type="text"
                    value={delivEntregador}
                    onChange={(e) => setDelivEntregador(e.target.value)}
                    placeholder="Entregador / Motoboy"
                    className="min-h-[42px] px-3 rounded-lg bg-[#0F171E] border border-white/15 text-xs text-slate-100"
                  />
                  <input
                    type="text"
                    value={delivTaxa}
                    onChange={(e) => setDelivTaxa(e.target.value)}
                    placeholder="Taxa Entrega (R$)"
                    className="min-h-[42px] px-3 rounded-lg bg-[#0F171E] border border-white/15 text-xs font-mono text-slate-100"
                  />
                </div>
              )}

              <div className="space-y-2 max-h-56 overflow-y-auto">
                {carrinhoBalcao.length === 0 ? (
                  <div className="p-4 rounded-lg bg-[#0F171E] text-xs text-slate-400 text-center">
                    Nenhum item selecionado.
                  </div>
                ) : (
                  carrinhoBalcao.map((it) => (
                    <div
                      key={it.tempId}
                      className="p-2.5 rounded-lg bg-[#0F171E] border border-white/10 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-100 truncate">{it.produto.nome}</div>
                        <input
                          type="text"
                          value={it.observacao}
                          onChange={(e) => alterarObsCarrinho(it.tempId, e.target.value, 'balcao')}
                          placeholder="Obs..."
                          className="mt-1 w-full px-2 py-1 rounded bg-black/30 border border-white/10 text-[11px] text-slate-300"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => alterarQtdCarrinho(it.tempId, -1, 'balcao')}
                          className="w-8 h-8 rounded bg-white/10 flex items-center justify-center text-slate-100 cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center font-mono font-bold">{it.quantidade}</span>
                        <button
                          type="button"
                          onClick={() => alterarQtdCarrinho(it.tempId, 1, 'balcao')}
                          className="w-8 h-8 rounded bg-emerald-500/20 text-emerald-300 flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {modoBalcaoDelivery === 'balcao' && (
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <div className="text-xs font-semibold text-slate-300">Forma de Pagamento no Balcão</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {METODOS_PAGAMENTO.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMetodoBalcao(m)}
                        className={`min-h-[38px] px-2 rounded-lg text-[11px] font-bold border cursor-pointer ${
                          metodoBalcao === m
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                            : 'bg-[#0F171E] text-slate-300 border-white/10'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  {metodoBalcao === 'Dinheiro' && (
                    <input
                      type="text"
                      value={recebidoBalcaoDinheiro}
                      onChange={(e) => setRecebidoBalcaoDinheiro(e.target.value)}
                      placeholder="Valor recebido em dinheiro p/ cálculo de troco"
                      className="w-full min-h-[40px] px-3 rounded-lg bg-[#0F171E] border border-white/15 text-xs font-mono text-slate-100"
                    />
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <span className="text-xs text-slate-400">Total do Pedido</span>
                <span className="text-lg font-bold font-mono tabular-nums text-emerald-300">
                  {formatBRL(
                    subtotalCarrinhoBalcao +
                      (modoBalcaoDelivery === 'delivery'
                        ? Math.max(0, Number(String(delivTaxa).replace(',', '.') || 0))
                        : 0)
                  )}
                </span>
              </div>

              <button
                type="button"
                disabled={finalizandoBalcaoDelivery}
                onClick={handleFinalizarVendaBalcaoOuDelivery}
                className="w-full min-h-[48px] py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                {finalizandoBalcaoDelivery
                  ? 'Processando...'
                  : modoBalcaoDelivery === 'balcao'
                  ? 'Receber Balcão, Lançar no Caixa & Imprimir'
                  : 'Lançar Delivery & Imprimir na Cozinha'}
              </button>
            </div>

            {deliveriesAtivos.length > 0 && (
              <div className="bg-[#0B1217] border border-white/10 rounded-xl p-4 space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Entregas em Andamento ({deliveriesAtivos.length})
                </h4>
                {deliveriesAtivos.map((del) => (
                  <div
                    key={del.id}
                    className="p-3 rounded-lg bg-[#0F171E] border border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-100">{del.identificador}</div>
                      <div className="text-[11px] text-slate-400">
                        {del.endereco_entrega || 'Retirada / Sem endereço'} • Motoboy: {del.entregador_nome || 'A definir'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-emerald-300">{formatBRL(del.saldo_restante)}</span>
                      <button
                        type="button"
                        onClick={() => abrirModalPagamento(del)}
                        className="min-h-[38px] px-3 rounded-lg bg-emerald-500 text-slate-950 font-bold cursor-pointer"
                      >
                        Baixar / Receber
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {subView === 'cardapio' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <form
            onSubmit={handleSalvarProdutoCardapio}
            className="lg:col-span-4 bg-[#0B1217] border border-white/10 rounded-xl p-4 space-y-3"
          >
            <h3 className="text-sm font-bold text-slate-100">
              {editProdutoId ? 'Editar Item do Cardápio' : 'Novo Item do Cardápio PDV'}
            </h3>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-400">Código</label>
                <input
                  type="text"
                  value={prodCodigo}
                  onChange={(e) => setProdCodigo(e.target.value)}
                  placeholder="PR-010"
                  className="w-full min-h-[40px] px-3 rounded-lg bg-[#0F171E] border border-white/15 text-xs font-mono text-slate-100"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Preço de Venda (R$)</label>
                <input
                  type="text"
                  value={prodPreco}
                  onChange={(e) => setProdPreco(e.target.value)}
                  placeholder="49.90"
                  className="w-full min-h-[40px] px-3 rounded-lg bg-[#0F171E] border border-white/15 text-xs font-mono text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-slate-400">Nome do Prato / Bebida</label>
              <input
                type="text"
                value={prodNome}
                onChange={(e) => setProdNome(e.target.value)}
                placeholder="Ex: Risoto de Funghi Secchi"
                className="w-full min-h-[40px] px-3 rounded-lg bg-[#0F171E] border border-white/15 text-xs text-slate-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-400">Categoria</label>
                <input
                  type="text"
                  value={prodCategoria}
                  onChange={(e) => setProdCategoria(e.target.value)}
                  className="w-full min-h-[40px] px-3 rounded-lg bg-[#0F171E] border border-white/15 text-xs text-slate-100"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Setor de Impressão</label>
                <select
                  value={prodSetor}
                  onChange={(e) => setProdSetor(e.target.value as SetorImpressaoPdv)}
                  className="w-full min-h-[40px] px-2.5 rounded-lg bg-[#0F171E] border border-white/15 text-xs text-slate-100"
                >
                  <option value="cozinha">Cozinha</option>
                  <option value="bar">Bar & Bebidas</option>
                  <option value="caixa">Caixa</option>
                  <option value="nenhum">Sem Impressão</option>
                </select>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#0F171E] border border-white/10 space-y-2">
              <div className="text-xs font-semibold text-slate-200">Vínculo de Baixa Automática no Estoque</div>
              <select
                value={prodEstoqueId}
                onChange={(e) => setProdEstoqueId(e.target.value)}
                className="w-full min-h-[40px] px-2.5 rounded-lg bg-[#0B1217] border border-white/15 text-xs text-slate-100"
              >
                <option value="">Sem baixa direta de insumo</option>
                {(data.estoque || []).map((est) => (
                  <option key={est.id} value={String(est.id)}>
                    {est.nome} (Saldo: {est.quantidade} {est.unidade_medida || 'un'})
                  </option>
                ))}
              </select>
              {prodEstoqueId && (
                <div>
                  <label className="text-[11px] text-slate-400">Quantidade baixada por venda</label>
                  <input
                    type="text"
                    value={prodQtdBaixa}
                    onChange={(e) => setProdQtdBaixa(e.target.value)}
                    className="w-full min-h-[38px] px-3 rounded-lg bg-[#0B1217] border border-white/15 text-xs font-mono text-slate-100"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {editProdutoId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditProdutoId(null);
                    setProdCodigo('');
                    setProdNome('');
                    setProdPreco('');
                    setProdEstoqueId('');
                  }}
                  className="min-h-[42px] px-3 rounded-lg bg-white/10 text-xs font-semibold text-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                disabled={salvandoProduto}
                className="flex-1 min-h-[42px] px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer"
              >
                {salvandoProduto ? 'Salvando...' : editProdutoId ? 'Atualizar Produto' : 'Cadastrar no Cardápio'}
              </button>
            </div>
          </form>

          <div className="lg:col-span-8 bg-[#0B1217] border border-white/10 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-bold text-slate-100">Itens Ativos no Cardápio ({produtosCardapio.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="py-2 pr-3">Código</th>
                    <th className="py-2 pr-3">Produto</th>
                    <th className="py-2 pr-3">Setor Impressora</th>
                    <th className="py-2 pr-3">Baixa Estoque</th>
                    <th className="py-2 pr-3 text-right">Preço</th>
                    <th className="py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {produtosCardapio.map((p) => {
                    const estVinc = (data.estoque || []).find((e) => Number(e.id) === Number(p.estoque_item_id));
                    return (
                      <tr key={p.id} className="hover:bg-white/[0.02]">
                        <td className="py-2.5 pr-3 font-mono text-slate-300">{p.codigo}</td>
                        <td className="py-2.5 pr-3">
                          <div className="font-semibold text-slate-100">{p.nome}</div>
                          <div className="text-[11px] text-slate-400">{p.categoria}</div>
                        </td>
                        <td className="py-2.5 pr-3 uppercase font-mono text-[11px] text-amber-300">
                          {p.setor_impressao}
                        </td>
                        <td className="py-2.5 pr-3 text-slate-300">
                          {estVinc ? `${estVinc.nome} (-${p.qtd_baixa_estoque || 1})` : '—'}
                        </td>
                        <td className="py-2.5 pr-3 text-right font-mono font-bold tabular-nums text-emerald-300">
                          {formatBRL(p.preco)}
                        </td>
                        <td className="py-2.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditProdutoId(p.id);
                                setProdCodigo(p.codigo);
                                setProdNome(p.nome);
                                setProdCategoria(p.categoria);
                                setProdPreco(String(p.preco));
                                setProdSetor(p.setor_impressao);
                                setProdEstoqueId(p.estoque_item_id ? String(p.estoque_item_id) : '');
                                setProdQtdBaixa(String(p.qtd_baixa_estoque ?? 1));
                              }}
                              className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-slate-200 cursor-pointer"
                              title="Editar"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                showConfirm(
                                  'Arquivar produto',
                                  `Deseja arquivar "${p.nome}" do cardápio PDV?`,
                                  async () => {
                                    await fetch('/api/pdv/produtos/arquivar', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ id: p.id })
                                    });
                                    onRefresh();
                                  }
                                );
                              }}
                              className="p-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 cursor-pointer"
                              title="Arquivar"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {subView === 'impressoras_wifi' && (
        <div className="space-y-4">
          <div className="bg-[#0B1217] border border-amber-500/30 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-amber-400" />
                  Pareamento dos Celulares ao Servidor Local no Wi-Fi (Digitação Manual de IP)
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  No modo normal todos usam a VPS online. Quando a internet cair, os celulares da equipe e o computador do caixa trocam dados e imprimem juntos pelo Wi-Fi do restaurante usando o IP fixo abaixo.
                </p>
              </div>
              {ipsDetectadosCaixa.length > 0 && (
                <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs shrink-0">
                  <div className="text-[10px] uppercase text-emerald-300 font-bold">IPs desta máquina na rede</div>
                  <div className="font-mono font-bold text-slate-100 mt-0.5">
                    {ipsDetectadosCaixa.join(' • ')} (Porta {data.lanHubStatus?.porta || 3000})
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-5">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  IP Fixo do Computador do Caixa no Wi-Fi
                </label>
                <input
                  type="text"
                  value={ipManualInput}
                  onChange={(e) => setIpManualInput(e.target.value)}
                  placeholder="Ex: 192.168.0.100"
                  className="w-full min-h-[44px] px-3.5 rounded-lg bg-[#0F171E] border border-white/20 text-sm font-mono text-slate-100"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">Porta Local</label>
                <input
                  type="text"
                  value={portaManualInput}
                  onChange={(e) => setPortaManualInput(e.target.value)}
                  placeholder="3000"
                  className="w-full min-h-[44px] px-3 rounded-lg bg-[#0F171E] border border-white/20 text-sm font-mono text-slate-100"
                />
              </div>
              <div className="md:col-span-5">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  URL da VPS Principal (Reconciliação quando a internet voltar)
                </label>
                <input
                  type="text"
                  value={vpsUrlInput}
                  onChange={(e) => setVpsUrlInput(e.target.value)}
                  placeholder="https://italiamo.nyctibi.us"
                  className="w-full min-h-[44px] px-3 rounded-lg bg-[#0F171E] border border-white/20 text-xs font-mono text-slate-100"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                disabled={lanTestState.testing}
                onClick={handleSalvarPareamentoManualWifi}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 cursor-pointer"
              >
                <Wifi className="w-4 h-4" />
                {lanTestState.testing ? 'Testando Wi-Fi Local...' : 'Salvar IP & Testar Conexão Wi-Fi'}
              </button>

              <button
                type="button"
                onClick={() => {
                  const nextForce = !lanConfig.forcarModoLanWifi;
                  if (nextForce && !ipManualInput.trim()) {
                    showAlert('IP necessário', 'Digite primeiro o IP do servidor local do caixa para ativar o modo Wi-Fi.');
                    return;
                  }
                  offlineSyncEngine.saveLanConfig({
                    ipServidorLocal: ipManualInput.trim(),
                    portaServidorLocal: portaManualInput.trim() || '3000',
                    forcarModoLanWifi: nextForce
                  });
                  onRefresh();
                }}
                className={`min-h-[44px] px-4 py-2 rounded-lg text-xs font-bold border flex items-center gap-2 cursor-pointer ${
                  lanConfig.forcarModoLanWifi
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                    : 'bg-[#0F171E] text-slate-200 border-white/15 hover:bg-white/5'
                }`}
              >
                <Server className="w-4 h-4" />
                {lanConfig.forcarModoLanWifi
                  ? 'Operando Forçado no Wi-Fi Local (Clique p/ Voltar Automático VPS)'
                  : 'Forçar Uso do Servidor Wi-Fi Agora'}
              </button>

              {ipManualInput.trim() && (
                <a
                  href={`http://${ipManualInput.trim().replace(/^https?:\/\//i, '').split(':')[0]}:${portaManualInput.trim() || '3000'}`}
                  className="min-h-[44px] px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-slate-100 inline-flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Abrir Direto no IP do Wi-Fi (http://{ipManualInput.trim().split(':')[0]}:{portaManualInput.trim() || '3000'})
                </a>
              )}

              <button
                type="button"
                disabled={reconcilingVps}
                onClick={handleReconciliarComVpsAgora}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 font-bold text-xs flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${reconcilingVps ? 'animate-spin' : ''}`} />
                Reconciliar Vendas Locais com a VPS ({data.lanHubStatus?.pendentes_outbox_lan || 0} pendentes)
              </button>
            </div>

            {lanTestState.msg && (
              <div
                className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                  lanTestState.ok
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                }`}
              >
                {lanTestState.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{lanTestState.msg}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            <form
              onSubmit={handleSalvarImpressora}
              className="lg:col-span-5 bg-[#0B1217] border border-white/10 rounded-xl p-4 space-y-3"
            >
              <h3 className="text-sm font-bold text-slate-100">
                {editImpId ? 'Editar Impressora Térmica' : 'Cadastrar Impressora Térmica (Rede 9100 ou USB Caixa)'}
              </h3>

              <div>
                <label className="text-[11px] text-slate-400">Identificação da Impressora</label>
                <input
                  type="text"
                  value={impNome}
                  onChange={(e) => setImpNome(e.target.value)}
                  placeholder="Ex: Elgin i9 Cozinha Quente"
                  className="w-full min-h-[40px] px-3 rounded-lg bg-[#0F171E] border border-white/15 text-xs text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400">Setor que Imprime</label>
                  <select
                    value={impSetor}
                    onChange={(e) => setImpSetor(e.target.value as any)}
                    className="w-full min-h-[40px] px-2.5 rounded-lg bg-[#0F171E] border border-white/15 text-xs text-slate-100"
                  >
                    <option value="cozinha">Cozinha</option>
                    <option value="bar">Bar & Bebidas</option>
                    <option value="caixa">Caixa (Conta / Recibo)</option>
                    <option value="geral">Geral (Contingência)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400">Tipo de Conexão Física</label>
                  <select
                    value={impTipoConexao}
                    onChange={(e) => setImpTipoConexao(e.target.value as TipoConexaoImpressoraPdv)}
                    className="w-full min-h-[40px] px-2.5 rounded-lg bg-[#0F171E] border border-white/15 text-xs text-slate-100"
                  >
                    <option value="rede_tcp_9100">Rede Wi-Fi / Cabo (IP :9100)</option>
                    <option value="usb_caixa_windows">USB Conectada no PC do Caixa</option>
                  </select>
                </div>
              </div>

              {impTipoConexao === 'rede_tcp_9100' ? (
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-[11px] text-slate-400">IP da Impressora na Rede</label>
                    <input
                      type="text"
                      value={impIpRede}
                      onChange={(e) => setImpIpRede(e.target.value)}
                      placeholder="192.168.0.201"
                      className="w-full min-h-[40px] px-3 rounded-lg bg-[#0F171E] border border-white/15 text-xs font-mono text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">Porta RAW</label>
                    <input
                      type="text"
                      value={impPortaRede}
                      onChange={(e) => setImpPortaRede(e.target.value)}
                      placeholder="9100"
                      className="w-full min-h-[40px] px-3 rounded-lg bg-[#0F171E] border border-white/15 text-xs font-mono text-slate-100"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-[11px] text-slate-400">
                    Nome da Impressora USB no Windows (Ponte via Urutau.exe)
                  </label>
                  <input
                    type="text"
                    value={impNomeUsb}
                    onChange={(e) => setImpNomeUsb(e.target.value)}
                    placeholder="CAIXA-TERMICA-80MM"
                    className="w-full min-h-[40px] px-3 rounded-lg bg-[#0F171E] border border-white/15 text-xs font-mono text-slate-100"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400">Largura da Bobina</label>
                  <select
                    value={impLargura}
                    onChange={(e) => setImpLargura(e.target.value as '80mm' | '58mm')}
                    className="w-full min-h-[40px] px-2.5 rounded-lg bg-[#0F171E] border border-white/15 text-xs text-slate-100"
                  >
                    <option value="80mm">80mm (42 colunas)</option>
                    <option value="58mm">58mm (32 colunas)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Número de Vias</label>
                  <input
                    type="number"
                    min={1}
                    max={3}
                    value={impVias}
                    onChange={(e) => setImpVias(e.target.value)}
                    className="w-full min-h-[40px] px-3 rounded-lg bg-[#0F171E] border border-white/15 text-xs font-mono text-slate-100"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={salvandoImp}
                className="w-full min-h-[44px] py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer"
              >
                {salvandoImp ? 'Salvando...' : editImpId ? 'Salvar Alterações da Impressora' : 'Adicionar Impressora ao Setor'}
              </button>
            </form>

            <div className="lg:col-span-7 space-y-4">
              <div className="bg-[#0B1217] border border-white/10 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-bold text-slate-100">Impressoras Configuradas na Rede & USB</h3>
                <div className="space-y-2">
                  {impressoras.map((imp) => (
                    <div
                      key={imp.id}
                      className="p-3 rounded-lg bg-[#0F171E] border border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-100">
                          {imp.nome} — Setor: <span className="uppercase text-amber-300">{imp.setor}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {imp.tipo_conexao === 'usb_caixa_windows'
                            ? `USB Windows: ${imp.nome_usb_windows} (${imp.largura_papel})`
                            : `Rede TCP/IP: ${imp.ip_rede}:${imp.porta_rede} (${imp.largura_papel})`}
                        </div>
                        {imp.ultimo_status && (
                          <div className="text-[11px] text-slate-300 mt-0.5">{imp.ultimo_status}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleTestarImpressora(imp.id)}
                          className="min-h-[38px] px-3 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 font-bold cursor-pointer"
                        >
                          Imprimir Teste
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditImpId(imp.id);
                            setImpNome(imp.nome);
                            setImpSetor(imp.setor);
                            setImpTipoConexao(imp.tipo_conexao);
                            setImpIpRede(imp.ip_rede);
                            setImpPortaRede(String(imp.porta_rede || 9100));
                            setImpNomeUsb(imp.nome_usb_windows || 'CAIXA-TERMICA-80MM');
                            setImpLargura(imp.largura_papel);
                            setImpVias(String(imp.vias || 1));
                          }}
                          className="p-2 rounded bg-white/5 hover:bg-white/10 text-slate-200 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#0B1217] border border-white/10 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-100">
                    Fila de Impressão & Bobina Térmica ({filaImpressao.length})
                  </h3>
                </div>

                {jobSelecionadoBobina && (
                  <div className="p-3.5 rounded-lg bg-[#F8FAFC] text-slate-950 font-mono text-xs space-y-2 border border-slate-300">
                    <div className="flex items-center justify-between border-b border-slate-300 pb-1.5 font-sans">
                      <span className="font-bold text-xs">
                        Prévia da Bobina Térmica: {jobSelecionadoBobina.referencia}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleImprimirBobinaNavegador(jobSelecionadoBobina)}
                          className="px-2.5 py-1 rounded bg-slate-900 text-white text-[11px] font-bold cursor-pointer"
                        >
                          Imprimir pelo Navegador / Driver Local
                        </button>
                        <button
                          type="button"
                          onClick={() => setJobSelecionadoBobina(null)}
                          className="p-1 text-slate-600 hover:text-black cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <pre className="whitespace-pre-wrap leading-snug text-[11px]">
                      {(jobSelecionadoBobina.linhas_texto || []).join('\n')}
                    </pre>
                  </div>
                )}

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filaImpressao.length === 0 ? (
                    <div className="p-4 rounded-lg bg-[#0F171E] text-xs text-slate-400 text-center">
                      Nenhum cupom disparado nesta sessão ainda.
                    </div>
                  ) : (
                    filaImpressao.slice(0, 25).map((job) => (
                      <div
                        key={job.id}
                        className="p-2.5 rounded-lg bg-[#0F171E] border border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <div className="font-semibold text-slate-100">
                            [{job.setor.toUpperCase()}] {job.referencia}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {job.impressora_nome} • {job.detalhe_transmissao}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setJobSelecionadoBobina(job)}
                            className="px-2.5 py-1.5 rounded bg-white/10 hover:bg-white/15 text-slate-200 font-semibold cursor-pointer"
                          >
                            Ver Cupom
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReimprimirJob(job.id)}
                            className="px-2.5 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-semibold cursor-pointer"
                          >
                            Reimprimir
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {pagamentoModalOpen && comandaParaPagar && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto">
          <div className="w-full max-w-xl bg-[#0B1217] border border-emerald-500/40 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-3.5 bg-[#080E12] border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-100">
                  Divisão de Conta, 10% & Pagamento — {comandaParaPagar.identificador}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Integra automaticamente ao Livro Caixa, Fechamento Diário e Fila Consumer.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPagamentoModalOpen(false)}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="p-3 rounded-xl bg-[#0F171E] border border-white/10 flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Percent className="w-3.5 h-3.5 text-amber-400" />
                    Serviço 10%
                  </span>
                  <input
                    type="checkbox"
                    checked={aplicarGorjetaModal}
                    onChange={(e) => setAplicarGorjetaModal(e.target.checked)}
                    className="w-4 h-4"
                  />
                </label>

                <div className="p-3 rounded-xl bg-[#0F171E] border border-white/10 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200">Dividir por:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPessoasDivisaoModal((p) => Math.max(1, p - 1))}
                      className="w-7 h-7 rounded bg-white/10 flex items-center justify-center text-white cursor-pointer"
                    >
                      -
                    </button>
                    <span className="font-mono font-bold text-sm w-6 text-center text-white">
                      {pessoasDivisaoModal}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPessoasDivisaoModal((p) => p + 1)}
                      className="w-7 h-7 rounded bg-white/10 flex items-center justify-center text-white cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#0F171E] border border-white/10">
                  <div className="text-[10px] text-slate-400">Desconto (R$)</div>
                  <input
                    type="text"
                    value={descontoModal}
                    onChange={(e) => setDescontoModal(e.target.value)}
                    className="w-full mt-0.5 bg-transparent font-mono font-bold text-sm text-slate-100 outline-none"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0F171E] border border-white/10 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>Consumo de Itens</span>
                  <span className="font-mono tabular-nums">{formatBRL(calculoModalPagamento.subtotal)}</span>
                </div>
                {calculoModalPagamento.taxa > 0 && (
                  <div className="flex justify-between text-slate-300">
                    <span>Taxa de Entrega</span>
                    <span className="font-mono tabular-nums">{formatBRL(calculoModalPagamento.taxa)}</span>
                  </div>
                )}
                <div className="flex justify-between text-amber-300">
                  <span>10% Gorjeta Garçom</span>
                  <span className="font-mono tabular-nums">{formatBRL(calculoModalPagamento.gorjeta)}</span>
                </div>
                {calculoModalPagamento.jaPago > 0 && (
                  <div className="flex justify-between text-emerald-300">
                    <span>Já Pago Parcialmente</span>
                    <span className="font-mono tabular-nums">- {formatBRL(calculoModalPagamento.jaPago)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-white pt-1.5 border-t border-white/10">
                  <span>Saldo Restante da Conta</span>
                  <span className="font-mono tabular-nums text-emerald-400">
                    {formatBRL(calculoModalPagamento.saldo)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-amber-200">
                  <span>Cota por Pessoa ({pessoasDivisaoModal}x):</span>
                  <span className="font-mono font-bold tabular-nums">
                    {formatBRL(calculoModalPagamento.porPessoa)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300">Quanto cobrar agora?</div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setModoPagamentoParcial('total')}
                    className={`min-h-[42px] px-2.5 rounded-lg text-xs font-bold border cursor-pointer ${
                      modoPagamentoParcial === 'total'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-[#0F171E] text-slate-300 border-white/10'
                    }`}
                  >
                    Quitar Saldo Total
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoPagamentoParcial('por_pessoa')}
                    className={`min-h-[42px] px-2.5 rounded-lg text-xs font-bold border cursor-pointer ${
                      modoPagamentoParcial === 'por_pessoa'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-[#0F171E] text-slate-300 border-white/10'
                    }`}
                  >
                    1 Pessoa ({formatBRL(calculoModalPagamento.porPessoa)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoPagamentoParcial('valor_livre')}
                    className={`min-h-[42px] px-2.5 rounded-lg text-xs font-bold border cursor-pointer ${
                      modoPagamentoParcial === 'valor_livre'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-[#0F171E] text-slate-300 border-white/10'
                    }`}
                  >
                    Valor Parcial Livre
                  </button>
                </div>

                {modoPagamentoParcial === 'valor_livre' && (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={valorLivrePagInput}
                      onChange={(e) => setValorLivrePagInput(e.target.value)}
                      placeholder="Valor parcial a cobrar (R$)"
                      className="min-h-[42px] px-3 rounded-lg bg-[#0F171E] border border-white/15 text-xs font-mono text-slate-100"
                    />
                    <input
                      type="text"
                      value={paganteRefInput}
                      onChange={(e) => setPaganteRefInput(e.target.value)}
                      placeholder="Identificação do pagante (opcional)"
                      className="min-h-[42px] px-3 rounded-lg bg-[#0F171E] border border-white/15 text-xs text-slate-100"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300">Meio de Pagamento</div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {METODOS_PAGAMENTO.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMetodoPagSelecionado(m)}
                      className={`min-h-[42px] px-2 rounded-lg text-[11px] font-bold border flex items-center justify-center gap-1 cursor-pointer ${
                        metodoPagSelecionado === m
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-[#0F171E] text-slate-200 border-white/10'
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{m}</span>
                    </button>
                  ))}
                </div>

                {metodoPagSelecionado === 'Dinheiro' && (
                  <div className="grid grid-cols-2 gap-2 items-center pt-1">
                    <input
                      type="text"
                      value={recebidoDinheiroInput}
                      onChange={(e) => setRecebidoDinheiroInput(e.target.value)}
                      placeholder="Valor entregue em espécie (R$)"
                      className="min-h-[42px] px-3 rounded-lg bg-[#0F171E] border border-white/15 text-xs font-mono text-slate-100"
                    />
                    <div className="px-3 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs flex justify-between">
                      <span className="text-slate-300">Troco:</span>
                      <span className="font-mono font-bold text-emerald-300">
                        {formatBRL(calculoModalPagamento.troco)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={processandoPagamento || calculoModalPagamento.pagarAgora <= 0}
                onClick={handleConfirmarPagamentoModal}
                className="w-full min-h-[48px] py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                {processandoPagamento
                  ? 'Registrando Pagamento...'
                  : `Confirmar Recebimento de ${formatBRL(calculoModalPagamento.pagarAgora)} & Imprimir Recibo`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
