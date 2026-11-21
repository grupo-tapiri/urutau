import { PoolClient } from 'pg';
import {
  PostgresQueryExecutor,
  TransactionalPostgresEngine
} from '../db/postgresEngine.ts';

export interface CatalogProductRow {
  id: number;
  empresa_id: number;
  codigo: string;
  nome: string;
  categoria: string;
  preco_centavos: number;
  estoque_item_id: number | null;
  qtd_baixa_mili: number;
  setor_impressao: string;
  ativo: number;
  criado_em_utc: string;
}

export interface StockBalanceRow {
  id: number;
  empresa_id: number;
  insumo_nome: string;
  unidade_medida: string;
  saldo_mili: number;
  minimo_mili: number;
  custo_unitario_centavos: number;
  atualizado_em_utc: string;
}

export interface DiscountCouponRow {
  id: number;
  empresa_id: number;
  codigo: string;
  tipo: 'PERCENTUAL_BPS' | 'FIXO_CENTAVOS';
  valor: number;
  uso_maximo: number;
  usos_atuais: number;
  ativo: number;
  expira_em_utc: string | null;
}

export interface DeliveryZoneRow {
  id: number;
  empresa_id: number;
  zona_codigo: string;
  nome: string;
  taxa_centavos: number;
  ativo: number;
}

export interface AcidComandaRow {
  id: number;
  op_uuid: string;
  empresa_id: number;
  unidade_id: number;
  modalidade: 'mesa' | 'comanda' | 'balcao' | 'delivery';
  identificador: string;
  mesa_numero: string;
  cliente_nome: string;
  cliente_telefone: string;
  endereco_entrega: string;
  entregador_nome: string;
  zona_entrega_codigo: string;
  cupom_codigo: string | null;
  garcom_nome: string;
  pessoas_mesa: number;
  subtotal_itens_centavos: number;
  desconto_centavos: number;
  taxa_entrega_centavos: number;
  aplicar_gorjeta_10: number;
  gorjeta_centavos: number;
  total_centavos: number;
  pago_acumulado_centavos: number;
  saldo_restante_centavos: number;
  status: 'aberta' | 'aguardando_pagamento' | 'fechada' | 'cancelada';
  arquivado_legal: number;
  criado_em_utc: string;
  atualizado_em_utc: string;
  fechado_em_utc: string | null;
}

export interface AcidComandaItemRow {
  id: string;
  comanda_id: number;
  empresa_id: number;
  produto_id: number;
  nome_snapshot: string;
  categoria_snapshot: string;
  quantidade: number;
  preco_unitario_centavos: number;
  subtotal_centavos: number;
  setor_impressao: string;
  observacao: string;
  garcom_nome: string;
  cancelado: number;
  criado_em_utc: string;
}

export interface AcidPagamentoRow {
  id: string;
  comanda_id: number;
  empresa_id: number;
  metodo: string;
  valor_pago_centavos: number;
  recebido_dinheiro_centavos: number;
  troco_centavos: number;
  gorjeta_proporcional_centavos: number;
  pagante_ref: string;
  operador_uid: number;
  operador_nome: string;
  criado_em_utc: string;
}

export interface ProcessedEventRow {
  event_id: string;
  origem: string;
  empresa_id: number;
  assinatura_hmac_valida: number;
  payload_sha256: string;
  efeito_resumo: string;
  processado_em_utc: string;
}

export interface HardLimitRow {
  bucket_key: string;
  escopo: string;
  janela_utc: string;
  contagem: number;
  limite_maximo: number;
  atualizado_em_utc: string;
}

interface OutgoingChargeRow {
  idempotency_key: string;
  empresa_id: number;
  comanda_id: number;
  gateway: string;
  valor_centavos: number;
  status: string;
  resposta_json: string;
  criado_em_utc: string;
}

interface CaixaLancamentoAcidRow {
  id: number;
  op_uuid: string;
  empresa_id: number;
  unidade_id: number;
  data_referencia_utc: string;
  tipo: 'Entrada' | 'Saída';
  categoria: string;
  descricao: string;
  valor_centavos: number;
  forma_pagamento: string;
  responsavel: string;
  origem_comanda_id: number | null;
  arquivado_legal: number;
  criado_em_utc: string;
}

interface InMemoryRelationalFallback {
  empresas: Map<number, { id: number; nome: string; cnpj: string | null; ativo: number }>;
  produtos: Map<number, CatalogProductRow>;
  estoque: Map<number, StockBalanceRow>;
  cupons: Map<number, DiscountCouponRow>;
  zonas: Map<number, DeliveryZoneRow>;
  comandas: Map<number, AcidComandaRow>;
  comandaItens: Map<string, AcidComandaItemRow>;
  pagamentos: Map<string, AcidPagamentoRow>;
  caixaLancamentos: Map<string, CaixaLancamentoAcidRow>;
  eventosProcessados: Map<string, ProcessedEventRow>;
  cobrancasIdempotentes: Map<string, OutgoingChargeRow>;
  hardLimits: Map<string, HardLimitRow>;
  nextComandaId: number;
  nextCaixaId: number;
}

function createEmptyMemoryFallback(): InMemoryRelationalFallback {
  const mem: InMemoryRelationalFallback = {
    empresas: new Map([[1, { id: 1, nome: 'Matriz Urutau', cnpj: '00.000.000/0001-01', ativo: 1 }]]),
    produtos: new Map(),
    estoque: new Map(),
    cupons: new Map([
      [
        1,
        {
          id: 1,
          empresa_id: 1,
          codigo: 'URUTAU10',
          tipo: 'PERCENTUAL_BPS',
          valor: 1000,
          uso_maximo: 5000,
          usos_atuais: 0,
          ativo: 1,
          expira_em_utc: '2030-12-31T23:59:59.000Z'
        }
      ],
      [
        2,
        {
          id: 2,
          empresa_id: 1,
          codigo: 'BEMVINDO5',
          tipo: 'FIXO_CENTAVOS',
          valor: 500,
          uso_maximo: 5000,
          usos_atuais: 0,
          ativo: 1,
          expira_em_utc: '2030-12-31T23:59:59.000Z'
        }
      ]
    ]),
    zonas: new Map([
      [1, { id: 1, empresa_id: 1, zona_codigo: 'PADRAO', nome: 'Zona Urbana Padrão', taxa_centavos: 800, ativo: 1 }],
      [2, { id: 2, empresa_id: 1, zona_codigo: 'CENTRO', nome: 'Raio Central (Até 3km)', taxa_centavos: 600, ativo: 1 }],
      [3, { id: 3, empresa_id: 1, zona_codigo: 'DISTANTE', nome: 'Zona Expandida (Acima de 7km)', taxa_centavos: 1500, ativo: 1 }],
      [4, { id: 4, empresa_id: 1, zona_codigo: 'RETIRADA', nome: 'Retirada no Balcão', taxa_centavos: 0, ativo: 1 }]
    ]),
    comandas: new Map(),
    comandaItens: new Map(),
    pagamentos: new Map(),
    caixaLancamentos: new Map(),
    eventosProcessados: new Map(),
    cobrancasIdempotentes: new Map(),
    hardLimits: new Map(),
    nextComandaId: 1,
    nextCaixaId: 1
  };
  return mem;
}

function isoString(val: unknown): string {
  if (val instanceof Date) return val.toISOString();
  return String(val || new Date().toISOString());
}

export class CommerceRepository {
  private readonly engine: TransactionalPostgresEngine;
  private readonly mem: InMemoryRelationalFallback;

  constructor(engine: TransactionalPostgresEngine) {
    this.engine = engine;
    this.mem = createEmptyMemoryFallback();
  }

  public getEngine(): TransactionalPostgresEngine {
    return this.engine;
  }

  public async usePostgres(): Promise<boolean> {
    if (!this.engine.isConfigured()) return false;
    return this.engine.ensureReady();
  }

  public async runAtomicTransaction<T>(
    work: (client: PoolClient | null) => Promise<T>
  ): Promise<T> {
    if (await this.usePostgres()) {
      return this.engine.runInTransaction((client) => work(client));
    }
    const snapshot = this.snapshotMemory();
    try {
      return await work(null);
    } catch (err) {
      this.restoreMemory(snapshot);
      throw err;
    }
  }

  private snapshotMemory(): string {
    return JSON.stringify({
      empresas: Array.from(this.mem.empresas.entries()),
      produtos: Array.from(this.mem.produtos.entries()),
      estoque: Array.from(this.mem.estoque.entries()),
      cupons: Array.from(this.mem.cupons.entries()),
      zonas: Array.from(this.mem.zonas.entries()),
      comandas: Array.from(this.mem.comandas.entries()),
      comandaItens: Array.from(this.mem.comandaItens.entries()),
      pagamentos: Array.from(this.mem.pagamentos.entries()),
      caixaLancamentos: Array.from(this.mem.caixaLancamentos.entries()),
      eventosProcessados: Array.from(this.mem.eventosProcessados.entries()),
      cobrancasIdempotentes: Array.from(this.mem.cobrancasIdempotentes.entries()),
      hardLimits: Array.from(this.mem.hardLimits.entries()),
      nextComandaId: this.mem.nextComandaId,
      nextCaixaId: this.mem.nextCaixaId
    });
  }

  private restoreMemory(raw: string): void {
    const p = JSON.parse(raw);
    this.mem.empresas = new Map(p.empresas);
    this.mem.produtos = new Map(p.produtos);
    this.mem.estoque = new Map(p.estoque);
    this.mem.cupons = new Map(p.cupons);
    this.mem.zonas = new Map(p.zonas);
    this.mem.comandas = new Map(p.comandas);
    this.mem.comandaItens = new Map(p.comandaItens);
    this.mem.pagamentos = new Map(p.pagamentos);
    this.mem.caixaLancamentos = new Map(p.caixaLancamentos);
    this.mem.eventosProcessados = new Map(p.eventosProcessados);
    this.mem.cobrancasIdempotentes = new Map(p.cobrancasIdempotentes);
    this.mem.hardLimits = new Map(p.hardLimits);
    this.mem.nextComandaId = p.nextComandaId;
    this.mem.nextCaixaId = p.nextCaixaId;
  }

  private execTarget(client?: PoolClient | null): PostgresQueryExecutor {
    return client || this.engine;
  }

  public async ensureEmpresaExists(
    empresaId: number,
    nome = 'Empresa Operacional',
    client?: PoolClient | null
  ): Promise<void> {
    const cleanId = Number(empresaId || 1);
    const cleanNome = String(nome || `Empresa ${cleanId}`);
    if (!this.mem.empresas.has(cleanId)) {
      this.mem.empresas.set(cleanId, { id: cleanId, nome: cleanNome, cnpj: null, ativo: 1 });
    }

    if (client || (await this.usePostgres())) {
      await this.execTarget(client).query(
        `INSERT INTO empresas (id, nome, ativo, criado_em_utc)
         VALUES ($1, $2, 1, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [cleanId, cleanNome]
      );
    }
  }

  public async syncCatalogAndStockFromMemoryDb(legacyDb: any): Promise<void> {
    const nowUtc = new Date().toISOString();
    const empresas = Array.isArray(legacyDb?.empresas) ? legacyDb.empresas : [];
    const estoqueLista = Array.isArray(legacyDb?.erp_estoque) ? legacyDb.erp_estoque : [];
    const produtosLista = Array.isArray(legacyDb?.pdv_produtos) ? legacyDb.pdv_produtos : [];

    await this.runAtomicTransaction(async (client) => {
      if (empresas.length === 0) {
        await this.ensureEmpresaExists(1, 'Matriz Urutau', client);
      } else {
        for (const emp of empresas) {
          const empId = Number(emp.id || 1);
          const empNome = String(emp.nome || `Empresa ${empId}`);
          const cnpjVal = emp.cnpj ? String(emp.cnpj).trim() : null;
          const ativoVal = emp.arquivado_legal ? 0 : 1;
          this.mem.empresas.set(empId, { id: empId, nome: empNome, cnpj: cnpjVal, ativo: ativoVal });
          if (client) {
            await client.query(
              `INSERT INTO empresas (id, nome, cnpj, ativo, criado_em_utc)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, ativo = EXCLUDED.ativo`,
              [empId, empNome, cnpjVal || null, ativoVal, nowUtc]
            );
          }
        }
      }

      for (const item of estoqueLista) {
        if (item.arquivado_legal) continue;
        const empId = Number(item.empresa_id || item.unidade_id || 1);
        await this.ensureEmpresaExists(empId, `Empresa ${empId}`, client);
        const qtdRaw = Number(item.quantidade ?? item.estoque_atual ?? 0);
        const minRaw = Number(item.minimo ?? item.estoque_minimo ?? 0);
        const custoRaw = Number(item.custo_unitario ?? item.preco_unitario ?? 0);
        const row: StockBalanceRow = {
          id: Number(item.id),
          empresa_id: empId,
          insumo_nome: String(item.insumo || item.nome || `Insumo ${item.id}`),
          unidade_medida: String(item.unidade || 'UN'),
          saldo_mili: Math.max(0, Math.round(qtdRaw * 1000)),
          minimo_mili: Math.max(0, Math.round(minRaw * 1000)),
          custo_unitario_centavos: Math.max(0, Math.round(custoRaw * 100)),
          atualizado_em_utc: nowUtc
        };
        this.mem.estoque.set(row.id, row);
        if (client) {
          await client.query(
            `INSERT INTO estoque_saldos (id, empresa_id, insumo_nome, unidade_medida, saldo_mili, minimo_mili, custo_unitario_centavos, atualizado_em_utc)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO UPDATE SET
               insumo_nome = EXCLUDED.insumo_nome,
               unidade_medida = EXCLUDED.unidade_medida,
               saldo_mili = EXCLUDED.saldo_mili,
               minimo_mili = EXCLUDED.minimo_mili,
               custo_unitario_centavos = EXCLUDED.custo_unitario_centavos,
               atualizado_em_utc = EXCLUDED.atualizado_em_utc`,
            [
              row.id,
              row.empresa_id,
              row.insumo_nome,
              row.unidade_medida,
              row.saldo_mili,
              row.minimo_mili,
              row.custo_unitario_centavos,
              row.atualizado_em_utc
            ]
          );
        }
      }

      for (const prod of produtosLista) {
        const empId = Number(prod.empresa_id || prod.unidade_id || 1);
        await this.ensureEmpresaExists(empId, `Empresa ${empId}`, client);
        const codigo = String(prod.codigo || `PDV-${prod.id}`).trim().toUpperCase();
        const row: CatalogProductRow = {
          id: Number(prod.id),
          empresa_id: empId,
          codigo: `${codigo}-${prod.id}`,
          nome: String(prod.nome || `Produto ${prod.id}`),
          categoria: String(prod.categoria || 'Geral'),
          preco_centavos: Math.max(0, Math.round(Number(prod.preco || 0) * 100)),
          estoque_item_id: prod.estoque_item_id ? Number(prod.estoque_item_id) : null,
          qtd_baixa_mili: Math.max(0, Math.round(Number(prod.qtd_baixa_estoque ?? 1) * 1000)),
          setor_impressao: String(prod.setor_impressao || 'cozinha'),
          ativo: prod.arquivado_legal || prod.disponivel === false ? 0 : 1,
          criado_em_utc: nowUtc
        };
        this.mem.produtos.set(row.id, row);
        if (client) {
          await client.query(
            `INSERT INTO produtos_catalogo (id, empresa_id, codigo, nome, categoria, preco_centavos, estoque_item_id, qtd_baixa_mili, setor_impressao, ativo, criado_em_utc)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (id) DO UPDATE SET
               nome = EXCLUDED.nome,
               categoria = EXCLUDED.categoria,
               preco_centavos = EXCLUDED.preco_centavos,
               estoque_item_id = EXCLUDED.estoque_item_id,
               qtd_baixa_mili = EXCLUDED.qtd_baixa_mili,
               setor_impressao = EXCLUDED.setor_impressao,
               ativo = EXCLUDED.ativo`,
            [
              row.id,
              row.empresa_id,
              row.codigo,
              row.nome,
              row.categoria,
              row.preco_centavos,
              row.estoque_item_id,
              row.qtd_baixa_mili,
              row.setor_impressao,
              row.ativo,
              row.criado_em_utc
            ]
          );
        }
      }
    });
  }

  public async upsertSingleCatalogProduct(prod: {
    id: number;
    empresa_id: number;
    codigo: string;
    nome: string;
    categoria: string;
    preco_centavos: number;
    estoque_item_id: number | null;
    qtd_baixa_mili: number;
    setor_impressao: string;
    ativo: boolean;
  }): Promise<void> {
    const nowUtc = new Date().toISOString();
    const row: CatalogProductRow = {
      id: prod.id,
      empresa_id: prod.empresa_id,
      codigo: `${prod.codigo}-${prod.id}`,
      nome: prod.nome,
      categoria: prod.categoria,
      preco_centavos: Math.max(0, Math.trunc(prod.preco_centavos)),
      estoque_item_id: prod.estoque_item_id,
      qtd_baixa_mili: Math.max(0, Math.trunc(prod.qtd_baixa_mili)),
      setor_impressao: prod.setor_impressao,
      ativo: prod.ativo ? 1 : 0,
      criado_em_utc: nowUtc
    };
    this.mem.produtos.set(row.id, row);

    if (await this.usePostgres()) {
      await this.ensureEmpresaExists(prod.empresa_id);
      await this.engine.query(
        `INSERT INTO produtos_catalogo (id, empresa_id, codigo, nome, categoria, preco_centavos, estoque_item_id, qtd_baixa_mili, setor_impressao, ativo, criado_em_utc)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE SET
           codigo = EXCLUDED.codigo,
           nome = EXCLUDED.nome,
           categoria = EXCLUDED.categoria,
           preco_centavos = EXCLUDED.preco_centavos,
           estoque_item_id = EXCLUDED.estoque_item_id,
           qtd_baixa_mili = EXCLUDED.qtd_baixa_mili,
           setor_impressao = EXCLUDED.setor_impressao,
           ativo = EXCLUDED.ativo`,
        [
          row.id,
          row.empresa_id,
          row.codigo,
          row.nome,
          row.categoria,
          row.preco_centavos,
          row.estoque_item_id,
          row.qtd_baixa_mili,
          row.setor_impressao,
          row.ativo,
          row.criado_em_utc
        ]
      );
    }
  }

  public async upsertSingleStockItem(stock: {
    id: number;
    empresa_id: number;
    insumo_nome: string;
    unidade_medida: string;
    saldo_mili: number;
    minimo_mili: number;
    custo_unitario_centavos: number;
  }): Promise<void> {
    const nowUtc = new Date().toISOString();
    const row: StockBalanceRow = {
      id: stock.id,
      empresa_id: stock.empresa_id,
      insumo_nome: stock.insumo_nome,
      unidade_medida: stock.unidade_medida || 'UN',
      saldo_mili: Math.max(0, Math.trunc(stock.saldo_mili)),
      minimo_mili: Math.max(0, Math.trunc(stock.minimo_mili)),
      custo_unitario_centavos: Math.max(0, Math.trunc(stock.custo_unitario_centavos)),
      atualizado_em_utc: nowUtc
    };
    this.mem.estoque.set(row.id, row);

    if (await this.usePostgres()) {
      await this.ensureEmpresaExists(stock.empresa_id);
      await this.engine.query(
        `INSERT INTO estoque_saldos (id, empresa_id, insumo_nome, unidade_medida, saldo_mili, minimo_mili, custo_unitario_centavos, atualizado_em_utc)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           insumo_nome = EXCLUDED.insumo_nome,
           unidade_medida = EXCLUDED.unidade_medida,
           saldo_mili = EXCLUDED.saldo_mili,
           minimo_mili = EXCLUDED.minimo_mili,
           custo_unitario_centavos = EXCLUDED.custo_unitario_centavos,
           atualizado_em_utc = EXCLUDED.atualizado_em_utc`,
        [
          row.id,
          row.empresa_id,
          row.insumo_nome,
          row.unidade_medida,
          row.saldo_mili,
          row.minimo_mili,
          row.custo_unitario_centavos,
          row.atualizado_em_utc
        ]
      );
    }
  }

  public async findProductsByIdsConsolidated(
    client: PoolClient | null,
    empresaId: number,
    productIds: number[]
  ): Promise<Map<number, CatalogProductRow>> {
    const map = new Map<number, CatalogProductRow>();
    const uniqueIds = Array.from(
      new Set(productIds.map(Number).filter((n) => Number.isInteger(n) && n > 0))
    );
    if (uniqueIds.length === 0) return map;

    if (client) {
      const res = await client.query<CatalogProductRow>(
        `SELECT id, empresa_id, codigo, nome, categoria, preco_centavos, estoque_item_id, qtd_baixa_mili, setor_impressao, ativo, criado_em_utc::text AS criado_em_utc
         FROM produtos_catalogo
         WHERE empresa_id = $1 AND ativo = 1 AND id = ANY($2::int[])`,
        [empresaId, uniqueIds]
      );
      for (const row of res.rows) {
        map.set(Number(row.id), row);
      }
      return map;
    }

    for (const id of uniqueIds) {
      const row = this.mem.produtos.get(id);
      if (row && row.empresa_id === empresaId && row.ativo === 1) {
        map.set(id, row);
      }
    }
    return map;
  }

  public async decrementStockAtomically(
    client: PoolClient | null,
    empresaId: number,
    estoqueItemId: number,
    qtdBaixarMili: number,
    nowUtc: string
  ): Promise<StockBalanceRow | null> {
    if (client) {
      const res = await client.query<StockBalanceRow>(
        `UPDATE estoque_saldos
         SET saldo_mili = saldo_mili - $1, atualizado_em_utc = $2
         WHERE id = $3 AND empresa_id = $4 AND saldo_mili >= $1
         RETURNING id, empresa_id, insumo_nome, unidade_medida, saldo_mili, minimo_mili, custo_unitario_centavos, atualizado_em_utc::text AS atualizado_em_utc`,
        [qtdBaixarMili, nowUtc, estoqueItemId, empresaId]
      );
      return res.rows[0] || null;
    }

    const row = this.mem.estoque.get(estoqueItemId);
    if (!row || row.empresa_id !== empresaId || row.saldo_mili < qtdBaixarMili) {
      return null;
    }
    row.saldo_mili -= qtdBaixarMili;
    row.atualizado_em_utc = nowUtc;
    return { ...row };
  }

  public async getStockBalance(
    empresaId: number,
    estoqueItemId: number,
    client?: PoolClient | null
  ): Promise<StockBalanceRow | null> {
    if (client || (await this.usePostgres())) {
      const res = await this.execTarget(client).query<StockBalanceRow>(
        `SELECT id, empresa_id, insumo_nome, unidade_medida, saldo_mili, minimo_mili, custo_unitario_centavos, atualizado_em_utc::text AS atualizado_em_utc
         FROM estoque_saldos
         WHERE id = $1 AND empresa_id = $2`,
        [estoqueItemId, empresaId]
      );
      return res.rows[0] || null;
    }
    const row = this.mem.estoque.get(estoqueItemId);
    return row && row.empresa_id === empresaId ? { ...row } : null;
  }

  public async findDeliveryFeeZone(
    client: PoolClient | null,
    empresaId: number,
    zonaCodigo: string
  ): Promise<DeliveryZoneRow | null> {
    const cleanCode = String(zonaCodigo || 'PADRAO').trim().toUpperCase();
    if (client) {
      const res = await client.query<DeliveryZoneRow>(
        `SELECT id, empresa_id, zona_codigo, nome, taxa_centavos, ativo
         FROM taxas_entrega_zonas
         WHERE (empresa_id = $1 OR empresa_id = 1) AND zona_codigo = $2 AND ativo = 1
         ORDER BY CASE WHEN empresa_id = $1 THEN 0 ELSE 1 END
         LIMIT 1`,
        [empresaId, cleanCode]
      );
      return res.rows[0] || null;
    }

    const matches = Array.from(this.mem.zonas.values()).filter(
      (z) => (z.empresa_id === empresaId || z.empresa_id === 1) && z.zona_codigo === cleanCode && z.ativo === 1
    );
    matches.sort((a, b) => (a.empresa_id === empresaId ? 0 : 1) - (b.empresa_id === empresaId ? 0 : 1));
    return matches[0] || null;
  }

  public async findValidCoupon(
    client: PoolClient | null,
    empresaId: number,
    codigo: string,
    nowUtc: string
  ): Promise<DiscountCouponRow | null> {
    const cleanCode = String(codigo || '').trim().toUpperCase();
    if (!cleanCode) return null;

    if (client) {
      const res = await client.query<DiscountCouponRow>(
        `SELECT id, empresa_id, codigo, tipo, valor, uso_maximo, usos_atuais, ativo, expira_em_utc::text AS expira_em_utc
         FROM cupons_desconto
         WHERE (empresa_id = $1 OR empresa_id = 1)
           AND codigo = $2
           AND ativo = 1
           AND usos_atuais < uso_maximo
           AND (expira_em_utc IS NULL OR expira_em_utc >= $3::timestamptz)
         ORDER BY CASE WHEN empresa_id = $1 THEN 0 ELSE 1 END
         LIMIT 1`,
        [empresaId, cleanCode, nowUtc]
      );
      return res.rows[0] || null;
    }

    const matches = Array.from(this.mem.cupons.values()).filter(
      (c) =>
        (c.empresa_id === empresaId || c.empresa_id === 1) &&
        c.codigo === cleanCode &&
        c.ativo === 1 &&
        c.usos_atuais < c.uso_maximo &&
        (!c.expira_em_utc || c.expira_em_utc >= nowUtc)
    );
    matches.sort((a, b) => (a.empresa_id === empresaId ? 0 : 1) - (b.empresa_id === empresaId ? 0 : 1));
    return matches[0] || null;
  }

  public async consumeCouponAtomically(client: PoolClient | null, couponId: number): Promise<boolean> {
    if (client) {
      const res = await client.query(
        'UPDATE cupons_desconto SET usos_atuais = usos_atuais + 1 WHERE id = $1 AND ativo = 1 AND usos_atuais < uso_maximo',
        [couponId]
      );
      return Number(res.rowCount || 0) === 1;
    }
    const row = this.mem.cupons.get(couponId);
    if (!row || row.ativo !== 1 || row.usos_atuais >= row.uso_maximo) return false;
    row.usos_atuais += 1;
    return true;
  }

  public async findActiveComanda(
    client: PoolClient | null,
    empresaId: number,
    unidadeId: number,
    comandaId?: number,
    modalidade?: string,
    identificador?: string
  ): Promise<AcidComandaRow | null> {
    if (client) {
      if (comandaId && Number(comandaId) > 0) {
        const res = await client.query<AcidComandaRow>(
          `SELECT * FROM pdv_comandas_acid
           WHERE id = $1 AND empresa_id = $2 AND arquivado_legal = 0`,
          [Number(comandaId), empresaId]
        );
        return res.rows[0] ? this.normalizeComandaRow(res.rows[0]) : null;
      }
      if ((modalidade === 'mesa' || modalidade === 'comanda') && identificador) {
        const res = await client.query<AcidComandaRow>(
          `SELECT * FROM pdv_comandas_acid
           WHERE empresa_id = $1
             AND unidade_id = $2
             AND LOWER(identificador) = LOWER($3)
             AND status IN ('aberta', 'aguardando_pagamento')
             AND arquivado_legal = 0
           ORDER BY id DESC
           LIMIT 1`,
          [empresaId, unidadeId, identificador]
        );
        return res.rows[0] ? this.normalizeComandaRow(res.rows[0]) : null;
      }
      return null;
    }

    if (comandaId && Number(comandaId) > 0) {
      const row = this.mem.comandas.get(Number(comandaId));
      return row && row.empresa_id === empresaId && row.arquivado_legal === 0 ? { ...row } : null;
    }
    if ((modalidade === 'mesa' || modalidade === 'comanda') && identificador) {
      const lower = identificador.toLowerCase();
      const matches = Array.from(this.mem.comandas.values())
        .filter(
          (c) =>
            c.empresa_id === empresaId &&
            c.unidade_id === unidadeId &&
            c.identificador.toLowerCase() === lower &&
            (c.status === 'aberta' || c.status === 'aguardando_pagamento') &&
            c.arquivado_legal === 0
        )
        .sort((a, b) => b.id - a.id);
      return matches[0] ? { ...matches[0] } : null;
    }
    return null;
  }

  public async findComandaById(
    client: PoolClient | null,
    comandaId: number
  ): Promise<AcidComandaRow | null> {
    if (client) {
      const res = await client.query<AcidComandaRow>(
        'SELECT * FROM pdv_comandas_acid WHERE id = $1 AND arquivado_legal = 0',
        [comandaId]
      );
      return res.rows[0] ? this.normalizeComandaRow(res.rows[0]) : null;
    }
    const row = this.mem.comandas.get(comandaId);
    return row && row.arquivado_legal === 0 ? { ...row } : null;
  }

  public async createComanda(
    client: PoolClient | null,
    input: Omit<AcidComandaRow, 'id'>
  ): Promise<AcidComandaRow> {
    if (client) {
      const res = await client.query<AcidComandaRow>(
        `INSERT INTO pdv_comandas_acid (
          op_uuid, empresa_id, unidade_id, modalidade, identificador, mesa_numero,
          cliente_nome, cliente_telefone, endereco_entrega, entregador_nome,
          zona_entrega_codigo, cupom_codigo, garcom_nome, pessoas_mesa,
          subtotal_itens_centavos, desconto_centavos, taxa_entrega_centavos,
          aplicar_gorjeta_10, gorjeta_centavos, total_centavos,
          pago_acumulado_centavos, saldo_restante_centavos, status, arquivado_legal,
          criado_em_utc, atualizado_em_utc
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
        RETURNING *`,
        [
          input.op_uuid,
          input.empresa_id,
          input.unidade_id,
          input.modalidade,
          input.identificador,
          input.mesa_numero,
          input.cliente_nome,
          input.cliente_telefone,
          input.endereco_entrega,
          input.entregador_nome,
          input.zona_entrega_codigo,
          input.cupom_codigo,
          input.garcom_nome,
          input.pessoas_mesa,
          input.subtotal_itens_centavos,
          input.desconto_centavos,
          input.taxa_entrega_centavos,
          input.aplicar_gorjeta_10,
          input.gorjeta_centavos,
          input.total_centavos,
          input.pago_acumulado_centavos,
          input.saldo_restante_centavos,
          input.status,
          input.arquivado_legal,
          input.criado_em_utc,
          input.atualizado_em_utc
        ]
      );
      return this.normalizeComandaRow(res.rows[0]);
    }

    const id = this.mem.nextComandaId++;
    const created: AcidComandaRow = { id, ...input };
    this.mem.comandas.set(id, created);
    return { ...created };
  }

  public async listActiveComandaItens(
    client: PoolClient | null,
    comandaId: number
  ): Promise<AcidComandaItemRow[]> {
    if (client) {
      const res = await client.query<AcidComandaItemRow>(
        'SELECT * FROM pdv_comanda_itens_acid WHERE comanda_id = $1 AND cancelado = 0 ORDER BY criado_em_utc ASC',
        [comandaId]
      );
      return res.rows.map((r) => ({ ...r, criado_em_utc: isoString(r.criado_em_utc) }));
    }
    return Array.from(this.mem.comandaItens.values())
      .filter((i) => i.comanda_id === comandaId && i.cancelado === 0)
      .sort((a, b) => a.criado_em_utc.localeCompare(b.criado_em_utc));
  }

  public async insertComandaItem(
    client: PoolClient | null,
    item: AcidComandaItemRow
  ): Promise<void> {
    if (client) {
      await client.query(
        `INSERT INTO pdv_comanda_itens_acid (
          id, comanda_id, empresa_id, produto_id, nome_snapshot, categoria_snapshot,
          quantidade, preco_unitario_centavos, subtotal_centavos, setor_impressao,
          observacao, garcom_nome, cancelado, criado_em_utc
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,0,$13)`,
        [
          item.id,
          item.comanda_id,
          item.empresa_id,
          item.produto_id,
          item.nome_snapshot,
          item.categoria_snapshot,
          item.quantidade,
          item.preco_unitario_centavos,
          item.subtotal_centavos,
          item.setor_impressao,
          item.observacao,
          item.garcom_nome,
          item.criado_em_utc
        ]
      );
      return;
    }
    this.mem.comandaItens.set(item.id, { ...item });
  }

  public async listComandaPagamentos(
    client: PoolClient | null,
    comandaId: number
  ): Promise<AcidPagamentoRow[]> {
    if (client) {
      const res = await client.query<AcidPagamentoRow>(
        'SELECT * FROM pdv_pagamentos_acid WHERE comanda_id = $1 ORDER BY criado_em_utc ASC',
        [comandaId]
      );
      return res.rows.map((r) => ({ ...r, criado_em_utc: isoString(r.criado_em_utc) }));
    }
    return Array.from(this.mem.pagamentos.values())
      .filter((p) => p.comanda_id === comandaId)
      .sort((a, b) => a.criado_em_utc.localeCompare(b.criado_em_utc));
  }

  public async insertPagamento(
    client: PoolClient | null,
    pag: AcidPagamentoRow
  ): Promise<void> {
    if (client) {
      await client.query(
        `INSERT INTO pdv_pagamentos_acid (
          id, comanda_id, empresa_id, metodo, valor_pago_centavos,
          recebido_dinheiro_centavos, troco_centavos, gorjeta_proporcional_centavos,
          pagante_ref, operador_uid, operador_nome, criado_em_utc
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          pag.id,
          pag.comanda_id,
          pag.empresa_id,
          pag.metodo,
          pag.valor_pago_centavos,
          pag.recebido_dinheiro_centavos,
          pag.troco_centavos,
          pag.gorjeta_proporcional_centavos,
          pag.pagante_ref,
          pag.operador_uid,
          pag.operador_nome,
          pag.criado_em_utc
        ]
      );
      return;
    }
    this.mem.pagamentos.set(pag.id, { ...pag });
  }

  public async updateComandaTotalsAndMeta(
    client: PoolClient | null,
    params: {
      comandaId: number;
      cliente_nome: string;
      cliente_telefone: string;
      endereco_entrega: string;
      entregador_nome: string;
      zona_entrega_codigo: string;
      cupom_codigo: string | null;
      pessoas_mesa: number;
      aplicar_gorjeta_10: number;
      subtotal_itens_centavos: number;
      desconto_centavos: number;
      taxa_entrega_centavos: number;
      gorjeta_centavos: number;
      total_centavos: number;
      pago_acumulado_centavos: number;
      saldo_restante_centavos: number;
      atualizado_em_utc: string;
    }
  ): Promise<void> {
    if (client) {
      await client.query(
        `UPDATE pdv_comandas_acid SET
          cliente_nome = CASE WHEN $1 <> '' THEN $1 ELSE cliente_nome END,
          cliente_telefone = CASE WHEN $2 <> '' THEN $2 ELSE cliente_telefone END,
          endereco_entrega = CASE WHEN $3 <> '' THEN $3 ELSE endereco_entrega END,
          entregador_nome = CASE WHEN $4 <> '' THEN $4 ELSE entregador_nome END,
          zona_entrega_codigo = $5,
          cupom_codigo = $6,
          pessoas_mesa = $7,
          aplicar_gorjeta_10 = $8,
          subtotal_itens_centavos = $9,
          desconto_centavos = $10,
          taxa_entrega_centavos = $11,
          gorjeta_centavos = $12,
          total_centavos = $13,
          pago_acumulado_centavos = $14,
          saldo_restante_centavos = $15,
          atualizado_em_utc = $16
         WHERE id = $17`,
        [
          params.cliente_nome,
          params.cliente_telefone,
          params.endereco_entrega,
          params.entregador_nome,
          params.zona_entrega_codigo,
          params.cupom_codigo,
          params.pessoas_mesa,
          params.aplicar_gorjeta_10,
          params.subtotal_itens_centavos,
          params.desconto_centavos,
          params.taxa_entrega_centavos,
          params.gorjeta_centavos,
          params.total_centavos,
          params.pago_acumulado_centavos,
          params.saldo_restante_centavos,
          params.atualizado_em_utc,
          params.comandaId
        ]
      );
      return;
    }

    const row = this.mem.comandas.get(params.comandaId);
    if (!row) return;
    if (params.cliente_nome) row.cliente_nome = params.cliente_nome;
    if (params.cliente_telefone) row.cliente_telefone = params.cliente_telefone;
    if (params.endereco_entrega) row.endereco_entrega = params.endereco_entrega;
    if (params.entregador_nome) row.entregador_nome = params.entregador_nome;
    row.zona_entrega_codigo = params.zona_entrega_codigo;
    row.cupom_codigo = params.cupom_codigo;
    row.pessoas_mesa = params.pessoas_mesa;
    row.aplicar_gorjeta_10 = params.aplicar_gorjeta_10;
    row.subtotal_itens_centavos = params.subtotal_itens_centavos;
    row.desconto_centavos = params.desconto_centavos;
    row.taxa_entrega_centavos = params.taxa_entrega_centavos;
    row.gorjeta_centavos = params.gorjeta_centavos;
    row.total_centavos = params.total_centavos;
    row.pago_acumulado_centavos = params.pago_acumulado_centavos;
    row.saldo_restante_centavos = params.saldo_restante_centavos;
    row.atualizado_em_utc = params.atualizado_em_utc;
  }

  public async updateComandaPaymentStatus(
    client: PoolClient | null,
    params: {
      comandaId: number;
      pessoas_mesa: number;
      aplicar_gorjeta_10: number;
      subtotal_itens_centavos: number;
      desconto_centavos: number;
      gorjeta_centavos: number;
      total_centavos: number;
      pago_acumulado_centavos: number;
      saldo_restante_centavos: number;
      status: 'aberta' | 'aguardando_pagamento' | 'fechada' | 'cancelada';
      atualizado_em_utc: string;
      fechouCompleta: boolean;
    }
  ): Promise<void> {
    if (client) {
      await client.query(
        `UPDATE pdv_comandas_acid SET
          pessoas_mesa = $1,
          aplicar_gorjeta_10 = $2,
          subtotal_itens_centavos = $3,
          desconto_centavos = $4,
          gorjeta_centavos = $5,
          total_centavos = $6,
          pago_acumulado_centavos = $7,
          saldo_restante_centavos = $8,
          status = $9,
          atualizado_em_utc = $10,
          fechado_em_utc = CASE WHEN $11::boolean THEN $10::timestamptz ELSE fechado_em_utc END
         WHERE id = $12`,
        [
          params.pessoas_mesa,
          params.aplicar_gorjeta_10,
          params.subtotal_itens_centavos,
          params.desconto_centavos,
          params.gorjeta_centavos,
          params.total_centavos,
          params.pago_acumulado_centavos,
          params.saldo_restante_centavos,
          params.status,
          params.atualizado_em_utc,
          params.fechouCompleta,
          params.comandaId
        ]
      );
      return;
    }

    const row = this.mem.comandas.get(params.comandaId);
    if (!row) return;
    row.pessoas_mesa = params.pessoas_mesa;
    row.aplicar_gorjeta_10 = params.aplicar_gorjeta_10;
    row.subtotal_itens_centavos = params.subtotal_itens_centavos;
    row.desconto_centavos = params.desconto_centavos;
    row.gorjeta_centavos = params.gorjeta_centavos;
    row.total_centavos = params.total_centavos;
    row.pago_acumulado_centavos = params.pago_acumulado_centavos;
    row.saldo_restante_centavos = params.saldo_restante_centavos;
    row.status = params.status;
    row.atualizado_em_utc = params.atualizado_em_utc;
    if (params.fechouCompleta) {
      row.fechado_em_utc = params.atualizado_em_utc;
    }
  }

  public async insertCaixaLancamentoIdempotent(
    client: PoolClient | null,
    entry: Omit<CaixaLancamentoAcidRow, 'id'>,
    replaceOnConflict = false
  ): Promise<{ inserted: boolean; id: number }> {
    if (client) {
      if (replaceOnConflict) {
        const res = await client.query<{ id: number }>(
          `INSERT INTO caixa_lancamentos_acid (
            op_uuid, empresa_id, unidade_id, data_referencia_utc, tipo, categoria,
            descricao, valor_centavos, forma_pagamento, responsavel, origem_comanda_id,
            arquivado_legal, criado_em_utc
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
          ON CONFLICT (op_uuid) DO UPDATE SET
            descricao = EXCLUDED.descricao,
            valor_centavos = EXCLUDED.valor_centavos,
            categoria = EXCLUDED.categoria
          RETURNING id`,
          [
            entry.op_uuid,
            entry.empresa_id,
            entry.unidade_id,
            entry.data_referencia_utc,
            entry.tipo,
            entry.categoria,
            entry.descricao,
            entry.valor_centavos,
            entry.forma_pagamento,
            entry.responsavel,
            entry.origem_comanda_id,
            entry.arquivado_legal,
            entry.criado_em_utc
          ]
        );
        return { inserted: true, id: Number(res.rows[0]?.id || 0) };
      }

      const res = await client.query<{ id: number }>(
        `INSERT INTO caixa_lancamentos_acid (
          op_uuid, empresa_id, unidade_id, data_referencia_utc, tipo, categoria,
          descricao, valor_centavos, forma_pagamento, responsavel, origem_comanda_id,
          arquivado_legal, criado_em_utc
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (op_uuid) DO NOTHING
        RETURNING id`,
        [
          entry.op_uuid,
          entry.empresa_id,
          entry.unidade_id,
          entry.data_referencia_utc,
          entry.tipo,
          entry.categoria,
          entry.descricao,
          entry.valor_centavos,
          entry.forma_pagamento,
          entry.responsavel,
          entry.origem_comanda_id,
          entry.arquivado_legal,
          entry.criado_em_utc
        ]
      );
      if (res.rows.length > 0) {
        return { inserted: true, id: Number(res.rows[0].id) };
      }
      return { inserted: false, id: 0 };
    }

    const existing = this.mem.caixaLancamentos.get(entry.op_uuid);
    if (existing && !replaceOnConflict) {
      return { inserted: false, id: existing.id };
    }
    const id = existing ? existing.id : this.mem.nextCaixaId++;
    this.mem.caixaLancamentos.set(entry.op_uuid, { id, ...entry });
    return { inserted: true, id };
  }

  public async findOutgoingChargeByKey(
    client: PoolClient | null,
    idempotencyKey: string
  ): Promise<OutgoingChargeRow | null> {
    if (client) {
      const res = await client.query<OutgoingChargeRow>(
        'SELECT * FROM cobrancas_saida_idempotentes WHERE idempotency_key = $1',
        [idempotencyKey]
      );
      return res.rows[0]
        ? { ...res.rows[0], criado_em_utc: isoString(res.rows[0].criado_em_utc) }
        : null;
    }
    return this.mem.cobrancasIdempotentes.get(idempotencyKey) || null;
  }

  public async insertOutgoingCharge(
    client: PoolClient | null,
    charge: OutgoingChargeRow
  ): Promise<void> {
    if (client) {
      await client.query(
        `INSERT INTO cobrancas_saida_idempotentes (
          idempotency_key, empresa_id, comanda_id, gateway, valor_centavos, status, resposta_json, criado_em_utc
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          charge.idempotency_key,
          charge.empresa_id,
          charge.comanda_id,
          charge.gateway,
          charge.valor_centavos,
          charge.status,
          charge.resposta_json,
          charge.criado_em_utc
        ]
      );
      return;
    }
    this.mem.cobrancasIdempotentes.set(charge.idempotency_key, { ...charge });
  }

  public async getComandaWithDetailsConsolidated(
    client: PoolClient | null,
    empresaId: number,
    comandaId: number
  ): Promise<{ comanda: AcidComandaRow; itens: AcidComandaItemRow[]; pagamentos: AcidPagamentoRow[] } | null> {
    const comanda = await this.findActiveComanda(client, empresaId, 1, comandaId);
    if (!comanda) return null;
    const itens = await this.listActiveComandaItens(client, comandaId);
    const pagamentos = await this.listComandaPagamentos(client, comandaId);
    return { comanda, itens, pagamentos };
  }

  public async tryRegisterProcessedEvent(
    client: PoolClient | null,
    event: {
      event_id: string;
      origem: string;
      empresa_id: number;
      payload_sha256: string;
      efeito_resumo: string;
      processado_em_utc: string;
    }
  ): Promise<{ inserted: boolean; existing?: ProcessedEventRow }> {
    if (client) {
      const res = await client.query(
        `INSERT INTO eventos_processados
         (event_id, origem, empresa_id, assinatura_hmac_valida, payload_sha256, efeito_resumo, processado_em_utc)
         VALUES ($1, $2, $3, 1, $4, $5, $6)
         ON CONFLICT (event_id) DO NOTHING`,
        [
          event.event_id,
          event.origem,
          event.empresa_id,
          event.payload_sha256,
          event.efeito_resumo,
          event.processado_em_utc
        ]
      );

      if (Number(res.rowCount || 0) === 1) {
        return { inserted: true };
      }

      const existingRes = await client.query<ProcessedEventRow>(
        'SELECT * FROM eventos_processados WHERE event_id = $1',
        [event.event_id]
      );
      const existing = existingRes.rows[0]
        ? { ...existingRes.rows[0], processado_em_utc: isoString(existingRes.rows[0].processado_em_utc) }
        : undefined;
      return { inserted: false, existing };
    }

    const existing = this.mem.eventosProcessados.get(event.event_id);
    if (existing) {
      return { inserted: false, existing };
    }
    this.mem.eventosProcessados.set(event.event_id, {
      ...event,
      assinatura_hmac_valida: 1
    });
    return { inserted: true };
  }

  public async listRecentProcessedEvents(limit = 25): Promise<ProcessedEventRow[]> {
    const safeLimit = Math.max(1, Math.min(200, limit));
    if (await this.usePostgres()) {
      const res = await this.engine.query<ProcessedEventRow>(
        'SELECT event_id, origem, empresa_id, assinatura_hmac_valida, payload_sha256, efeito_resumo, processado_em_utc::text AS processado_em_utc FROM eventos_processados ORDER BY processado_em_utc DESC LIMIT $1',
        [safeLimit]
      );
      return res.rows;
    }
    return Array.from(this.mem.eventosProcessados.values())
      .sort((a, b) => b.processado_em_utc.localeCompare(a.processado_em_utc))
      .slice(0, safeLimit);
  }

  public async consumeHardLimitQuota(
    escopo: string,
    janelaUtc: string,
    limiteMaximo: number
  ): Promise<{ allowed: boolean; currentCount: number; maxLimit: number }> {
    const bucketKey = `${escopo}:${janelaUtc}`;
    const nowUtc = new Date().toISOString();

    return this.runAtomicTransaction(async (client) => {
      if (client) {
        await client.query(
          `INSERT INTO consumo_hard_limits
           (bucket_key, escopo, janela_utc, contagem, limite_maximo, atualizado_em_utc)
           VALUES ($1, $2, $3, 0, $4, $5)
           ON CONFLICT (bucket_key) DO NOTHING`,
          [bucketKey, escopo, janelaUtc, limiteMaximo, nowUtc]
        );

        const upd = await client.query(
          `UPDATE consumo_hard_limits
           SET contagem = contagem + 1, limite_maximo = $1, atualizado_em_utc = $2
           WHERE bucket_key = $3 AND contagem < $1`,
          [limiteMaximo, nowUtc, bucketKey]
        );

        const rowRes = await client.query<{ contagem: number; limite_maximo: number }>(
          'SELECT contagem, limite_maximo FROM consumo_hard_limits WHERE bucket_key = $1',
          [bucketKey]
        );
        const row = rowRes.rows[0];
        return {
          allowed: Number(upd.rowCount || 0) === 1,
          currentCount: Number(row?.contagem || 0),
          maxLimit: Number(row?.limite_maximo || limiteMaximo)
        };
      }

      let row = this.mem.hardLimits.get(bucketKey);
      if (!row) {
        row = {
          bucket_key: bucketKey,
          escopo,
          janela_utc: janelaUtc,
          contagem: 0,
          limite_maximo: limiteMaximo,
          atualizado_em_utc: nowUtc
        };
        this.mem.hardLimits.set(bucketKey, row);
      }
      row.limite_maximo = limiteMaximo;
      row.atualizado_em_utc = nowUtc;
      if (row.contagem < limiteMaximo) {
        row.contagem += 1;
        return { allowed: true, currentCount: row.contagem, maxLimit: limiteMaximo };
      }
      return { allowed: false, currentCount: row.contagem, maxLimit: limiteMaximo };
    });
  }

  public async listCurrentHardLimits(limit = 20): Promise<HardLimitRow[]> {
    const safeLimit = Math.max(1, Math.min(200, limit));
    if (await this.usePostgres()) {
      const res = await this.engine.query<HardLimitRow>(
        'SELECT bucket_key, escopo, janela_utc, contagem, limite_maximo, atualizado_em_utc::text AS atualizado_em_utc FROM consumo_hard_limits ORDER BY atualizado_em_utc DESC LIMIT $1',
        [safeLimit]
      );
      return res.rows;
    }
    return Array.from(this.mem.hardLimits.values())
      .sort((a, b) => b.atualizado_em_utc.localeCompare(a.atualizado_em_utc))
      .slice(0, safeLimit);
  }

  private normalizeComandaRow(r: any): AcidComandaRow {
    return {
      ...r,
      id: Number(r.id),
      empresa_id: Number(r.empresa_id),
      unidade_id: Number(r.unidade_id),
      pessoas_mesa: Number(r.pessoas_mesa),
      subtotal_itens_centavos: Number(r.subtotal_itens_centavos),
      desconto_centavos: Number(r.desconto_centavos),
      taxa_entrega_centavos: Number(r.taxa_entrega_centavos),
      aplicar_gorjeta_10: Number(r.aplicar_gorjeta_10),
      gorjeta_centavos: Number(r.gorjeta_centavos),
      total_centavos: Number(r.total_centavos),
      pago_acumulado_centavos: Number(r.pago_acumulado_centavos),
      saldo_restante_centavos: Number(r.saldo_restante_centavos),
      arquivado_legal: Number(r.arquivado_legal),
      criado_em_utc: isoString(r.criado_em_utc),
      atualizado_em_utc: isoString(r.atualizado_em_utc),
      fechado_em_utc: r.fechado_em_utc ? isoString(r.fechado_em_utc) : null
    };
  }
}
