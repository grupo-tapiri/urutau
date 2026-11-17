import { DatabaseSync } from 'node:sqlite';
import { TransactionalSqliteEngine } from '../db/sqliteEngine.ts';

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

export class CommerceRepository {
  private readonly engine: TransactionalSqliteEngine;

  constructor(engine: TransactionalSqliteEngine) {
    this.engine = engine;
  }

  public getEngine(): TransactionalSqliteEngine {
    return this.engine;
  }

  public ensureEmpresaExists(empresaId: number, nome = 'Empresa Operacional'): void {
    const conn = this.engine.getConnection();
    conn
      .prepare(
        'INSERT OR IGNORE INTO empresas (id, nome, ativo, criado_em_utc) VALUES (?, ?, 1, ?)'
      )
      .run(Number(empresaId || 1), String(nome || `Empresa ${empresaId}`), new Date().toISOString());
  }

  public syncCatalogAndStockFromMemoryDb(legacyDb: any): void {
    this.engine.runInImmediateTransaction((conn) => {
      const nowUtc = new Date().toISOString();
      const empresas = Array.isArray(legacyDb?.empresas) ? legacyDb.empresas : [];
      const upsertEmp = conn.prepare(
        `INSERT INTO empresas (id, nome, cnpj, ativo, criado_em_utc)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET nome = excluded.nome, ativo = excluded.ativo`
      );
      if (empresas.length === 0) {
        upsertEmp.run(1, 'Matriz Urutau', null, 1, nowUtc);
      } else {
        for (const emp of empresas) {
          const empId = Number(emp.id || 1);
          const cnpjVal = emp.cnpj ? String(emp.cnpj).trim() : null;
          upsertEmp.run(empId, String(emp.nome || `Empresa ${empId}`), cnpjVal || null, emp.arquivado_legal ? 0 : 1, nowUtc);
        }
      }

      const estoqueLista = Array.isArray(legacyDb?.erp_estoque) ? legacyDb.erp_estoque : [];
      const upsertEst = conn.prepare(
        `INSERT INTO estoque_saldos (id, empresa_id, insumo_nome, unidade_medida, saldo_mili, minimo_mili, custo_unitario_centavos, atualizado_em_utc)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           insumo_nome = excluded.insumo_nome,
           unidade_medida = excluded.unidade_medida,
           saldo_mili = excluded.saldo_mili,
           minimo_mili = excluded.minimo_mili,
           custo_unitario_centavos = excluded.custo_unitario_centavos,
           atualizado_em_utc = excluded.atualizado_em_utc`
      );
      for (const item of estoqueLista) {
        if (item.arquivado_legal) continue;
        const empId = Number(item.empresa_id || item.unidade_id || 1);
        this.ensureEmpresaExists(empId);
        const qtdRaw = Number(item.quantidade ?? item.estoque_atual ?? 0);
        const minRaw = Number(item.minimo ?? item.estoque_minimo ?? 0);
        const custoRaw = Number(item.custo_unitario ?? item.preco_unitario ?? 0);
        upsertEst.run(
          Number(item.id),
          empId,
          String(item.insumo || item.nome || `Insumo ${item.id}`),
          String(item.unidade || 'UN'),
          Math.max(0, Math.round(qtdRaw * 1000)),
          Math.max(0, Math.round(minRaw * 1000)),
          Math.max(0, Math.round(custoRaw * 100)),
          nowUtc
        );
      }

      const produtosLista = Array.isArray(legacyDb?.pdv_produtos) ? legacyDb.pdv_produtos : [];
      const upsertProd = conn.prepare(
        `INSERT INTO produtos_catalogo (id, empresa_id, codigo, nome, categoria, preco_centavos, estoque_item_id, qtd_baixa_mili, setor_impressao, ativo, criado_em_utc)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           nome = excluded.nome,
           categoria = excluded.categoria,
           preco_centavos = excluded.preco_centavos,
           estoque_item_id = excluded.estoque_item_id,
           qtd_baixa_mili = excluded.qtd_baixa_mili,
           setor_impressao = excluded.setor_impressao,
           ativo = excluded.ativo`
      );
      for (const prod of produtosLista) {
        const empId = Number(prod.empresa_id || prod.unidade_id || 1);
        this.ensureEmpresaExists(empId);
        const codigo = String(prod.codigo || `PDV-${prod.id}`).trim().toUpperCase();
        const precoCentavos = Math.max(0, Math.round(Number(prod.preco || 0) * 100));
        const baixaMili = Math.max(0, Math.round(Number(prod.qtd_baixa_estoque ?? 1) * 1000));
        const ativoFlag = prod.arquivado_legal || prod.disponivel === false ? 0 : 1;
        upsertProd.run(
          Number(prod.id),
          empId,
          `${codigo}-${prod.id}`,
          String(prod.nome || `Produto ${prod.id}`),
          String(prod.categoria || 'Geral'),
          precoCentavos,
          prod.estoque_item_id ? Number(prod.estoque_item_id) : null,
          baixaMili,
          String(prod.setor_impressao || 'cozinha'),
          ativoFlag,
          nowUtc
        );
      }
    });
  }

  public upsertSingleCatalogProduct(prod: {
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
  }): void {
    this.ensureEmpresaExists(prod.empresa_id);
    const conn = this.engine.getConnection();
    conn
      .prepare(
        `INSERT INTO produtos_catalogo (id, empresa_id, codigo, nome, categoria, preco_centavos, estoque_item_id, qtd_baixa_mili, setor_impressao, ativo, criado_em_utc)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           codigo = excluded.codigo,
           nome = excluded.nome,
           categoria = excluded.categoria,
           preco_centavos = excluded.preco_centavos,
           estoque_item_id = excluded.estoque_item_id,
           qtd_baixa_mili = excluded.qtd_baixa_mili,
           setor_impressao = excluded.setor_impressao,
           ativo = excluded.ativo`
      )
      .run(
        prod.id,
        prod.empresa_id,
        `${prod.codigo}-${prod.id}`,
        prod.nome,
        prod.categoria,
        Math.max(0, Math.trunc(prod.preco_centavos)),
        prod.estoque_item_id,
        Math.max(0, Math.trunc(prod.qtd_baixa_mili)),
        prod.setor_impressao,
        prod.ativo ? 1 : 0,
        new Date().toISOString()
      );
  }

  public upsertSingleStockItem(stock: {
    id: number;
    empresa_id: number;
    insumo_nome: string;
    unidade_medida: string;
    saldo_mili: number;
    minimo_mili: number;
    custo_unitario_centavos: number;
  }): void {
    this.ensureEmpresaExists(stock.empresa_id);
    const conn = this.engine.getConnection();
    conn
      .prepare(
        `INSERT INTO estoque_saldos (id, empresa_id, insumo_nome, unidade_medida, saldo_mili, minimo_mili, custo_unitario_centavos, atualizado_em_utc)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           insumo_nome = excluded.insumo_nome,
           unidade_medida = excluded.unidade_medida,
           saldo_mili = excluded.saldo_mili,
           minimo_mili = excluded.minimo_mili,
           custo_unitario_centavos = excluded.custo_unitario_centavos,
           atualizado_em_utc = excluded.atualizado_em_utc`
      )
      .run(
        stock.id,
        stock.empresa_id,
        stock.insumo_nome,
        stock.unidade_medida || 'UN',
        Math.max(0, Math.trunc(stock.saldo_mili)),
        Math.max(0, Math.trunc(stock.minimo_mili)),
        Math.max(0, Math.trunc(stock.custo_unitario_centavos)),
        new Date().toISOString()
      );
  }

  public findProductsByIdsConsolidated(
    conn: DatabaseSync,
    empresaId: number,
    productIds: number[]
  ): Map<number, CatalogProductRow> {
    const map = new Map<number, CatalogProductRow>();
    const uniqueIds = Array.from(new Set(productIds.map(Number).filter((n) => Number.isInteger(n) && n > 0)));
    if (uniqueIds.length === 0) return map;

    const placeholders = uniqueIds.map(() => '?').join(', ');
    const sql = `
      SELECT id, empresa_id, codigo, nome, categoria, preco_centavos, estoque_item_id, qtd_baixa_mili, setor_impressao, ativo, criado_em_utc
      FROM produtos_catalogo
      WHERE empresa_id = ? AND ativo = 1 AND id IN (${placeholders})
    `;
    const rows = conn.prepare(sql).all(empresaId, ...uniqueIds) as unknown as CatalogProductRow[];
    for (const row of rows) {
      map.set(Number(row.id), row);
    }
    return map;
  }

  public decrementStockAtomically(
    conn: DatabaseSync,
    empresaId: number,
    estoqueItemId: number,
    qtdBaixarMili: number,
    nowUtc: string
  ): StockBalanceRow | null {
    const result = conn
      .prepare(
        `UPDATE estoque_saldos
         SET saldo_mili = saldo_mili - ?, atualizado_em_utc = ?
         WHERE id = ? AND empresa_id = ? AND saldo_mili >= ?`
      )
      .run(qtdBaixarMili, nowUtc, estoqueItemId, empresaId, qtdBaixarMili);

    if (Number(result.changes || 0) === 0) {
      return null;
    }

    const updated = conn
      .prepare(
        'SELECT id, empresa_id, insumo_nome, unidade_medida, saldo_mili, minimo_mili, custo_unitario_centavos, atualizado_em_utc FROM estoque_saldos WHERE id = ? AND empresa_id = ?'
      )
      .get(estoqueItemId, empresaId) as unknown as StockBalanceRow | undefined;
    return updated || null;
  }

  public getStockBalance(empresaId: number, estoqueItemId: number): StockBalanceRow | null {
    const row = this.engine
      .getConnection()
      .prepare(
        'SELECT id, empresa_id, insumo_nome, unidade_medida, saldo_mili, minimo_mili, custo_unitario_centavos, atualizado_em_utc FROM estoque_saldos WHERE id = ? AND empresa_id = ?'
      )
      .get(estoqueItemId, empresaId) as unknown as StockBalanceRow | undefined;
    return row || null;
  }

  public findDeliveryFeeZone(conn: DatabaseSync, empresaId: number, zonaCodigo: string): DeliveryZoneRow | null {
    const cleanCode = String(zonaCodigo || 'PADRAO').trim().toUpperCase();
    const row = conn
      .prepare(
        `SELECT id, empresa_id, zona_codigo, nome, taxa_centavos, ativo
         FROM taxas_entrega_zonas
         WHERE (empresa_id = ? OR empresa_id = 1) AND zona_codigo = ? AND ativo = 1
         ORDER BY CASE WHEN empresa_id = ? THEN 0 ELSE 1 END
         LIMIT 1`
      )
      .get(empresaId, cleanCode, empresaId) as unknown as DeliveryZoneRow | undefined;
    return row || null;
  }

  public findValidCoupon(conn: DatabaseSync, empresaId: number, codigo: string, nowUtc: string): DiscountCouponRow | null {
    const cleanCode = String(codigo || '').trim().toUpperCase();
    if (!cleanCode) return null;
    const row = conn
      .prepare(
        `SELECT id, empresa_id, codigo, tipo, valor, uso_maximo, usos_atuais, ativo, expira_em_utc
         FROM cupons_desconto
         WHERE (empresa_id = ? OR empresa_id = 1)
           AND codigo = ?
           AND ativo = 1
           AND usos_atuais < uso_maximo
           AND (expira_em_utc IS NULL OR expira_em_utc >= ?)
         ORDER BY CASE WHEN empresa_id = ? THEN 0 ELSE 1 END
         LIMIT 1`
      )
      .get(empresaId, cleanCode, nowUtc, empresaId) as unknown as DiscountCouponRow | undefined;
    return row || null;
  }

  public consumeCouponAtomically(conn: DatabaseSync, couponId: number): boolean {
    const res = conn
      .prepare(
        'UPDATE cupons_desconto SET usos_atuais = usos_atuais + 1 WHERE id = ? AND ativo = 1 AND usos_atuais < uso_maximo'
      )
      .run(couponId);
    return Number(res.changes || 0) === 1;
  }

  public findActiveComanda(
    conn: DatabaseSync,
    empresaId: number,
    unidadeId: number,
    comandaId?: number,
    modalidade?: string,
    identificador?: string
  ): AcidComandaRow | null {
    if (comandaId && Number(comandaId) > 0) {
      const byId = conn
        .prepare(
          `SELECT * FROM pdv_comandas_acid
           WHERE id = ? AND empresa_id = ? AND arquivado_legal = 0`
        )
        .get(Number(comandaId), empresaId) as unknown as AcidComandaRow | undefined;
      return byId || null;
    }
    if ((modalidade === 'mesa' || modalidade === 'comanda') && identificador) {
      const byIdent = conn
        .prepare(
          `SELECT * FROM pdv_comandas_acid
           WHERE empresa_id = ?
             AND unidade_id = ?
             AND LOWER(identificador) = LOWER(?)
             AND status IN ('aberta', 'aguardando_pagamento')
             AND arquivado_legal = 0
           ORDER BY id DESC
           LIMIT 1`
        )
        .get(empresaId, unidadeId, identificador) as unknown as AcidComandaRow | undefined;
      return byIdent || null;
    }
    return null;
  }

  public getComandaWithDetailsConsolidated(
    conn: DatabaseSync,
    empresaId: number,
    comandaId: number
  ): { comanda: AcidComandaRow; itens: AcidComandaItemRow[]; pagamentos: AcidPagamentoRow[] } | null {
    const comanda = conn
      .prepare('SELECT * FROM pdv_comandas_acid WHERE id = ? AND empresa_id = ? AND arquivado_legal = 0')
      .get(comandaId, empresaId) as unknown as AcidComandaRow | undefined;
    if (!comanda) return null;

    const itens = conn
      .prepare('SELECT * FROM pdv_comanda_itens_acid WHERE comanda_id = ? AND cancelado = 0 ORDER BY criado_em_utc ASC')
      .all(comandaId) as unknown as AcidComandaItemRow[];

    const pagamentos = conn
      .prepare('SELECT * FROM pdv_pagamentos_acid WHERE comanda_id = ? ORDER BY criado_em_utc ASC')
      .all(comandaId) as unknown as AcidPagamentoRow[];

    return { comanda, itens, pagamentos };
  }

  public tryRegisterProcessedEvent(
    conn: DatabaseSync,
    event: {
      event_id: string;
      origem: string;
      empresa_id: number;
      payload_sha256: string;
      efeito_resumo: string;
      processado_em_utc: string;
    }
  ): { inserted: boolean; existing?: ProcessedEventRow } {
    const res = conn
      .prepare(
        `INSERT OR IGNORE INTO eventos_processados
         (event_id, origem, empresa_id, assinatura_hmac_valida, payload_sha256, efeito_resumo, processado_em_utc)
         VALUES (?, ?, ?, 1, ?, ?, ?)`
      )
      .run(
        event.event_id,
        event.origem,
        event.empresa_id,
        event.payload_sha256,
        event.efeito_resumo,
        event.processado_em_utc
      );

    if (Number(res.changes || 0) === 1) {
      return { inserted: true };
    }

    const existing = conn
      .prepare('SELECT * FROM eventos_processados WHERE event_id = ?')
      .get(event.event_id) as unknown as ProcessedEventRow | undefined;
    return { inserted: false, existing };
  }

  public listRecentProcessedEvents(limit = 25): ProcessedEventRow[] {
    return this.engine
      .getConnection()
      .prepare('SELECT * FROM eventos_processados ORDER BY processado_em_utc DESC LIMIT ?')
      .all(Math.max(1, Math.min(200, limit))) as unknown as ProcessedEventRow[];
  }

  public consumeHardLimitQuota(
    escopo: string,
    janelaUtc: string,
    limiteMaximo: number
  ): { allowed: boolean; currentCount: number; maxLimit: number } {
    const bucketKey = `${escopo}:${janelaUtc}`;
    const nowUtc = new Date().toISOString();

    return this.engine.runInImmediateTransaction((conn) => {
      conn
        .prepare(
          `INSERT OR IGNORE INTO consumo_hard_limits
           (bucket_key, escopo, janela_utc, contagem, limite_maximo, atualizado_em_utc)
           VALUES (?, ?, ?, 0, ?, ?)`
        )
        .run(bucketKey, escopo, janelaUtc, limiteMaximo, nowUtc);

      const upd = conn
        .prepare(
          `UPDATE consumo_hard_limits
           SET contagem = contagem + 1, limite_maximo = ?, atualizado_em_utc = ?
           WHERE bucket_key = ? AND contagem < ?`
        )
        .run(limiteMaximo, nowUtc, bucketKey, limiteMaximo);

      const row = conn
        .prepare('SELECT contagem, limite_maximo FROM consumo_hard_limits WHERE bucket_key = ?')
        .get(bucketKey) as { contagem: number; limite_maximo: number };

      return {
        allowed: Number(upd.changes || 0) === 1,
        currentCount: Number(row?.contagem || 0),
        maxLimit: Number(row?.limite_maximo || limiteMaximo)
      };
    });
  }

  public listCurrentHardLimits(limit = 20): Array<{
    bucket_key: string;
    escopo: string;
    janela_utc: string;
    contagem: number;
    limite_maximo: number;
    atualizado_em_utc: string;
  }> {
    return this.engine
      .getConnection()
      .prepare('SELECT * FROM consumo_hard_limits ORDER BY atualizado_em_utc DESC LIMIT ?')
      .all(limit) as any[];
  }
}
