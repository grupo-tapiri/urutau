import crypto from 'crypto';
import {
  AcidComandaItemRow,
  AcidComandaRow,
  AcidPagamentoRow,
  CommerceRepository
} from '../repositories/commerceRepository.ts';

export interface AuthenticatedOperatorContext {
  uid: number;
  nome: string;
  cargo: string;
  tipo: string;
  emp: number;
  emps: number[];
  super: boolean;
}

export class DomainValidationError extends Error {
  public readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'DomainValidationError';
  }
}

export class UnauthorizedPrivilegeError extends Error {
  public readonly statusCode = 403;
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedPrivilegeError';
  }
}

export class ResourceNotFoundError extends Error {
  public readonly statusCode = 404;
  constructor(message: string) {
    super(message);
    this.name = 'ResourceNotFoundError';
  }
}

export class InsufficientStockError extends Error {
  public readonly statusCode = 409;
  public readonly details: { produto_id: number; nome: string; solicitado_mili: number; disponivel_mili: number };
  constructor(
    message: string,
    details: { produto_id: number; nome: string; solicitado_mili: number; disponivel_mili: number }
  ) {
    super(message);
    this.name = 'InsufficientStockError';
    this.details = details;
  }
}

export function reaisToCentavos(valorReais: unknown): number {
  const num = Number(valorReais ?? 0);
  if (!Number.isFinite(num) || num < 0) {
    throw new DomainValidationError('Valor monetario invalido ou negativo.');
  }
  return Math.round(num * 100);
}

export function centavosToReais(centavos: number): number {
  return Number((Math.trunc(centavos) / 100).toFixed(2));
}

export function miliToUnidades(mili: number): number {
  return Number((Math.trunc(mili) / 1000).toFixed(3));
}

export function canAuthorizeManualDiscount(operator: AuthenticatedOperatorContext): boolean {
  if (operator.super) return true;
  const role = `${operator.cargo} ${operator.tipo}`.toLowerCase();
  return (
    role.includes('admin') ||
    role.includes('diretor') ||
    role.includes('gerente') ||
    role.includes('gestor') ||
    role.includes('empres') ||
    role.includes('propriet') ||
    role.includes('socio') ||
    role.includes('sócio')
  );
}

export function formatAcidComandaForFrontend(
  comanda: AcidComandaRow,
  itens: AcidComandaItemRow[],
  pagamentos: AcidPagamentoRow[]
) {
  return {
    id: comanda.id,
    op_uuid: comanda.op_uuid,
    data: comanda.criado_em_utc.slice(0, 10),
    modalidade: comanda.modalidade,
    identificador: comanda.identificador,
    mesa_numero: comanda.mesa_numero,
    cliente_nome: comanda.cliente_nome,
    cliente_telefone: comanda.cliente_telefone,
    endereco_entrega: comanda.endereco_entrega,
    entregador_nome: comanda.entregador_nome,
    zona_entrega_codigo: comanda.zona_entrega_codigo,
    cupom_codigo: comanda.cupom_codigo,
    taxa_entrega: centavosToReais(comanda.taxa_entrega_centavos),
    taxa_entrega_centavos: comanda.taxa_entrega_centavos,
    garcom_nome: comanda.garcom_nome,
    pessoas_mesa: comanda.pessoas_mesa,
    itens: itens.map((it) => ({
      id: it.id,
      produto_id: it.produto_id,
      nome: it.nome_snapshot,
      categoria: it.categoria_snapshot,
      quantidade: it.quantidade,
      preco_unitario: centavosToReais(it.preco_unitario_centavos),
      preco_unitario_centavos: it.preco_unitario_centavos,
      subtotal: centavosToReais(it.subtotal_centavos),
      subtotal_centavos: it.subtotal_centavos,
      observacao: it.observacao,
      setor_impressao: it.setor_impressao,
      garcom_nome: it.garcom_nome,
      horario: it.criado_em_utc.slice(11, 16),
      impresso_setor: it.setor_impressao !== 'nenhum',
      status_preparo: it.cancelado ? 'cancelado' : 'enviado'
    })),
    pagamentos: pagamentos.map((pg) => ({
      id: pg.id,
      metodo: pg.metodo,
      valor_pago: centavosToReais(pg.valor_pago_centavos),
      valor_pago_centavos: pg.valor_pago_centavos,
      valor_recebido_dinheiro: centavosToReais(pg.recebido_dinheiro_centavos),
      troco: centavosToReais(pg.troco_centavos),
      troco_centavos: pg.troco_centavos,
      pagante_ref: pg.pagante_ref,
      inclui_gorjeta_valor: centavosToReais(pg.gorjeta_proporcional_centavos),
      horario: pg.criado_em_utc.slice(11, 16),
      operador: pg.operador_nome
    })),
    aplicar_gorjeta_10: comanda.aplicar_gorjeta_10 === 1,
    percentual_gorjeta: 10,
    desconto: centavosToReais(comanda.desconto_centavos),
    desconto_centavos: comanda.desconto_centavos,
    subtotal_itens: centavosToReais(comanda.subtotal_itens_centavos),
    subtotal_itens_centavos: comanda.subtotal_itens_centavos,
    valor_gorjeta: centavosToReais(comanda.gorjeta_centavos),
    gorjeta_centavos: comanda.gorjeta_centavos,
    valor_total: centavosToReais(comanda.total_centavos),
    total_centavos: comanda.total_centavos,
    valor_pago_acumulado: centavosToReais(comanda.pago_acumulado_centavos),
    pago_acumulado_centavos: comanda.pago_acumulado_centavos,
    saldo_restante: centavosToReais(comanda.saldo_restante_centavos),
    saldo_restante_centavos: comanda.saldo_restante_centavos,
    status: comanda.status,
    unidade_id: comanda.unidade_id,
    empresa_id: comanda.empresa_id,
    criado_em: comanda.criado_em_utc,
    atualizado_em: comanda.atualizado_em_utc,
    fechado_em: comanda.fechado_em_utc || undefined,
    arquivado_legal: comanda.arquivado_legal === 1
  };
}

export class ZeroTrustCommerceService {
  private readonly repo: CommerceRepository;

  constructor(repo: CommerceRepository) {
    this.repo = repo;
  }

  private computeTotalsPureInteger(params: {
    itensAtivos: Array<{ subtotal_centavos: number }>;
    descontoManualCentavos: number;
    cupomDescontoCentavos: number;
    taxaEntregaCentavos: number;
    aplicarGorjeta10: boolean;
    pagamentosRealizados: Array<{ valor_pago_centavos: number }>;
  }) {
    const subtotalItensCentavos = params.itensAtivos.reduce(
      (acc, item) => acc + Math.max(0, Math.trunc(item.subtotal_centavos)),
      0
    );
    const gorjetaCentavos = params.aplicarGorjeta10 ? Math.round((subtotalItensCentavos * 10) / 100) : 0;
    const descontoBruto = Math.max(0, Math.trunc(params.descontoManualCentavos)) + Math.max(0, Math.trunc(params.cupomDescontoCentavos));
    const tetoDesconto = subtotalItensCentavos + params.taxaEntregaCentavos + gorjetaCentavos;
    const descontoEfetivoCentavos = Math.min(descontoBruto, tetoDesconto);
    const totalCentavos = Math.max(
      0,
      subtotalItensCentavos + gorjetaCentavos + Math.max(0, Math.trunc(params.taxaEntregaCentavos)) - descontoEfetivoCentavos
    );
    const pagoAcumuladoCentavos = params.pagamentosRealizados.reduce(
      (acc, pg) => acc + Math.max(0, Math.trunc(pg.valor_pago_centavos)),
      0
    );
    const saldoRestanteCentavos = Math.max(0, totalCentavos - pagoAcumuladoCentavos);

    return {
      subtotalItensCentavos,
      gorjetaCentavos,
      descontoEfetivoCentavos,
      totalCentavos,
      pagoAcumuladoCentavos,
      saldoRestanteCentavos
    };
  }

  public async abrirOuAdicionarItensZeroTrust(
    operator: AuthenticatedOperatorContext,
    rawPayload: any,
    legacyDb?: any
  ) {
    const empresaId = operator.super
      ? Number(rawPayload?.empresa_id || rawPayload?.unidade_id || operator.emp || 1)
      : Number(rawPayload?.empresa_id || operator.emp || 1);

    if (!operator.super && !operator.emps.includes(empresaId) && operator.emp !== empresaId) {
      throw new UnauthorizedPrivilegeError('Acesso negado ao escopo desta empresa (BOLA/IDOR bloqueado).');
    }

    const unidadeId = Math.max(1, Math.trunc(Number(rawPayload?.unidade_id || 1)));
    const modalidade: 'mesa' | 'comanda' | 'balcao' | 'delivery' = ['mesa', 'comanda', 'balcao', 'delivery'].includes(
      rawPayload?.modalidade
    )
      ? rawPayload.modalidade
      : 'mesa';

    const rawNovosItens = Array.isArray(rawPayload?.novos_itens) ? rawPayload.novos_itens : [];
    for (const rawIt of rawNovosItens) {
      const prodId = Number(rawIt?.produto_id || 0);
      const qtd = Number(rawIt?.quantidade ?? 1);
      if (!Number.isInteger(prodId) || prodId <= 0) {
        throw new DomainValidationError('Todo item do pedido exige produto_id inteiro valido do catalogo oficial.');
      }
      if (!Number.isInteger(qtd) || qtd < 1 || qtd > 500) {
        throw new DomainValidationError('Quantidade do item deve ser um numero inteiro entre 1 e 500.');
      }
    }

    const nowUtc = new Date().toISOString();
    const reqUuid = String(
      rawPayload?.op_uuid || `OP-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
    );

    const txResult = await this.repo.runAtomicTransaction(async (client) => {
      await this.repo.ensureEmpresaExists(empresaId, `Empresa ${empresaId}`, client);

      const requestedProductIds = rawNovosItens.map((it: any) => Number(it.produto_id));
      const catalogMap = await this.repo.findProductsByIdsConsolidated(client, empresaId, requestedProductIds);

      for (const pid of requestedProductIds) {
        if (!catalogMap.has(pid)) {
          throw new ResourceNotFoundError(
            `Produto ID ${pid} inexistente, inativo ou pertencente a outra empresa.`
          );
        }
      }

      const mesaNumStr = rawPayload?.mesa_numero ? String(rawPayload.mesa_numero).trim() : '';
      const defaultIdent =
        modalidade === 'mesa'
          ? `Mesa ${String(mesaNumStr || '01').padStart(2, '0')}`
          : modalidade === 'balcao'
          ? `Balcão #${Date.now().toString().slice(-4)}`
          : modalidade === 'delivery'
          ? `Delivery ${String(rawPayload?.cliente_nome || '').trim() || `#${Date.now().toString().slice(-4)}`}`
          : `Comanda #${Date.now().toString().slice(-4)}`;
      const identLimpo = String(rawPayload?.identificador || defaultIdent).trim();

      let comandaRow = await this.repo.findActiveComanda(
        client,
        empresaId,
        unidadeId,
        rawPayload?.comanda_id ? Number(rawPayload.comanda_id) : undefined,
        modalidade,
        identLimpo
      );

      const zonaCodigo =
        modalidade === 'delivery'
          ? String(rawPayload?.zona_entrega_codigo || 'PADRAO').trim().toUpperCase()
          : 'RETIRADA';
      const zonaAutoritativa =
        modalidade === 'delivery' ? await this.repo.findDeliveryFeeZone(client, empresaId, zonaCodigo) : null;
      const taxaEntregaAutoritativaCentavos =
        modalidade === 'delivery' ? Number(zonaAutoritativa?.taxa_centavos ?? 800) : 0;

      const aplicarGorjeta =
        rawPayload?.aplicar_gorjeta_10 !== undefined
          ? Boolean(rawPayload.aplicar_gorjeta_10)
          : modalidade === 'mesa' || modalidade === 'comanda';

      const pessoasMesa = Math.max(1, Math.trunc(Number(rawPayload?.pessoas_mesa || comandaRow?.pessoas_mesa || 1)));
      const cupomSolicitado = rawPayload?.cupom_codigo
        ? String(rawPayload.cupom_codigo).trim().toUpperCase()
        : comandaRow?.cupom_codigo || null;

      if (!comandaRow) {
        comandaRow = await this.repo.createComanda(client, {
          op_uuid: reqUuid,
          empresa_id: empresaId,
          unidade_id: unidadeId,
          modalidade,
          identificador: identLimpo,
          mesa_numero: mesaNumStr || (modalidade === 'mesa' ? identLimpo.replace(/\D/g, '') || '01' : ''),
          cliente_nome: String(rawPayload?.cliente_nome || '').trim(),
          cliente_telefone: String(rawPayload?.cliente_telefone || '').trim(),
          endereco_entrega: String(rawPayload?.endereco_entrega || '').trim(),
          entregador_nome: String(rawPayload?.entregador_nome || '').trim(),
          zona_entrega_codigo: zonaCodigo,
          cupom_codigo: cupomSolicitado,
          garcom_nome: String(operator.nome || rawPayload?.garcom_nome || 'Atendente').trim(),
          pessoas_mesa: pessoasMesa,
          subtotal_itens_centavos: 0,
          desconto_centavos: 0,
          taxa_entrega_centavos: taxaEntregaAutoritativaCentavos,
          aplicar_gorjeta_10: aplicarGorjeta ? 1 : 0,
          gorjeta_centavos: 0,
          total_centavos: 0,
          pago_acumulado_centavos: 0,
          saldo_restante_centavos: 0,
          status: 'aberta',
          arquivado_legal: 0,
          criado_em_utc: nowUtc,
          atualizado_em_utc: nowUtc,
          fechado_em_utc: null
        });
      }

      const existingItems = await this.repo.listActiveComandaItens(client, comandaRow.id);
      const existingItemIds = new Set(existingItems.map((i) => i.id));

      const itensInseridos: AcidComandaItemRow[] = [];
      const baixasEstoqueRealizadas: Array<{
        estoque_item_id: number;
        qtd_baixada: number;
        saldo_restante_mili: number;
        nome: string;
      }> = [];

      for (const rawIt of rawNovosItens) {
        const itemIdUnico = String(
          rawIt.id || `${reqUuid}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
        );
        if (existingItemIds.has(itemIdUnico)) {
          continue;
        }

        const prod = catalogMap.get(Number(rawIt.produto_id))!;
        const qtd = Math.trunc(Number(rawIt.quantidade ?? 1));
        const precoUnitCentavos = prod.preco_centavos;
        const subtotalCentavos = qtd * precoUnitCentavos;

        if (prod.estoque_item_id && prod.qtd_baixa_mili > 0) {
          const totalBaixarMili = qtd * prod.qtd_baixa_mili;
          const updatedStock = await this.repo.decrementStockAtomically(
            client,
            empresaId,
            prod.estoque_item_id,
            totalBaixarMili,
            nowUtc
          );
          if (!updatedStock) {
            const currentStock = await this.repo.getStockBalance(empresaId, prod.estoque_item_id, client);
            throw new InsufficientStockError(
              `Estoque insuficiente para "${prod.nome}". Operacao abortada atomicamente sem alterar saldos.`,
              {
                produto_id: prod.id,
                nome: prod.nome,
                solicitado_mili: totalBaixarMili,
                disponivel_mili: Number(currentStock?.saldo_mili ?? 0)
              }
            );
          }
          baixasEstoqueRealizadas.push({
            estoque_item_id: prod.estoque_item_id,
            qtd_baixada: miliToUnidades(totalBaixarMili),
            saldo_restante_mili: updatedStock.saldo_mili,
            nome: updatedStock.insumo_nome
          });
        }

        const newItemRow: AcidComandaItemRow = {
          id: itemIdUnico,
          comanda_id: comandaRow.id,
          empresa_id: empresaId,
          produto_id: prod.id,
          nome_snapshot: prod.nome,
          categoria_snapshot: prod.categoria,
          quantidade: qtd,
          preco_unitario_centavos: precoUnitCentavos,
          subtotal_centavos: subtotalCentavos,
          setor_impressao: prod.setor_impressao || 'cozinha',
          observacao: String(rawIt.observacao || '').trim().slice(0, 240),
          garcom_nome: String(operator.nome || rawPayload?.garcom_nome || comandaRow.garcom_nome),
          cancelado: 0,
          criado_em_utc: nowUtc
        };

        await this.repo.insertComandaItem(client, newItemRow);
        existingItemIds.add(itemIdUnico);
        itensInseridos.push(newItemRow);
      }

      const todosItensAtivos = [...existingItems, ...itensInseridos];
      const pagamentosExistentes = await this.repo.listComandaPagamentos(client, comandaRow.id);

      let cupomDescontoCentavos = 0;
      if (cupomSolicitado) {
        const cupomRow = await this.repo.findValidCoupon(client, empresaId, cupomSolicitado, nowUtc);
        if (!cupomRow) {
          throw new DomainValidationError(`Cupom "${cupomSolicitado}" invalido, expirado ou esgotado.`);
        }
        const subTemp = todosItensAtivos.reduce((s, i) => s + i.subtotal_centavos, 0);
        if (cupomRow.tipo === 'PERCENTUAL_BPS') {
          cupomDescontoCentavos = Math.round((subTemp * cupomRow.valor) / 10000);
        } else {
          cupomDescontoCentavos = cupomRow.valor;
        }
        if (comandaRow.cupom_codigo !== cupomRow.codigo) {
          const okCupom = await this.repo.consumeCouponAtomically(client, cupomRow.id);
          if (!okCupom) {
            throw new DomainValidationError(`Cupom "${cupomSolicitado}" esgotou durante a concorrencia.`);
          }
        }
      }

      const totals = this.computeTotalsPureInteger({
        itensAtivos: todosItensAtivos,
        descontoManualCentavos: 0,
        cupomDescontoCentavos,
        taxaEntregaCentavos: taxaEntregaAutoritativaCentavos,
        aplicarGorjeta10: aplicarGorjeta,
        pagamentosRealizados: pagamentosExistentes
      });

      await this.repo.updateComandaTotalsAndMeta(client, {
        comandaId: comandaRow.id,
        cliente_nome: String(rawPayload?.cliente_nome || '').trim(),
        cliente_telefone: String(rawPayload?.cliente_telefone || '').trim(),
        endereco_entrega: String(rawPayload?.endereco_entrega || '').trim(),
        entregador_nome: String(rawPayload?.entregador_nome || '').trim(),
        zona_entrega_codigo: zonaCodigo,
        cupom_codigo: cupomSolicitado,
        pessoas_mesa: pessoasMesa,
        aplicar_gorjeta_10: aplicarGorjeta ? 1 : 0,
        subtotal_itens_centavos: totals.subtotalItensCentavos,
        desconto_centavos: totals.descontoEfetivoCentavos,
        taxa_entrega_centavos: taxaEntregaAutoritativaCentavos,
        gorjeta_centavos: totals.gorjetaCentavos,
        total_centavos: totals.totalCentavos,
        pago_acumulado_centavos: totals.pagoAcumuladoCentavos,
        saldo_restante_centavos: totals.saldoRestanteCentavos,
        atualizado_em_utc: nowUtc
      });

      const consolidated = (await this.repo.getComandaWithDetailsConsolidated(client, empresaId, comandaRow.id))!;
      return {
        consolidated,
        itensInseridos,
        baixasEstoqueRealizadas
      };
    });

    const formattedComanda = formatAcidComandaForFrontend(
      txResult.consolidated.comanda,
      txResult.consolidated.itens,
      txResult.consolidated.pagamentos
    );

    if (legacyDb) {
      this.projectComandaAndStockToMemoryDb(legacyDb, formattedComanda, txResult.baixasEstoqueRealizadas);
    }

    return {
      comanda: formattedComanda,
      itensInseridos: formattedComanda.itens.filter((i) =>
        txResult.itensInseridos.some((ins) => ins.id === i.id)
      ),
      baixasEstoqueRealizadas: txResult.baixasEstoqueRealizadas
    };
  }

  public async pagarOuFecharComandaZeroTrust(
    operator: AuthenticatedOperatorContext,
    rawPayload: any,
    legacyDb?: any
  ) {
    const comandaId = Number(rawPayload?.comanda_id || 0);
    if (!Number.isInteger(comandaId) || comandaId <= 0) {
      throw new DomainValidationError('Identificador comanda_id invalido.');
    }

    const manualDescontoInformado = rawPayload?.desconto !== undefined && Number(rawPayload.desconto) > 0;
    if (manualDescontoInformado && !canAuthorizeManualDiscount(operator)) {
      throw new UnauthorizedPrivilegeError(
        'Apenas Gerentes, Diretores ou Super Admin autenticados podem conceder desconto manual na conta.'
      );
    }

    const metodoValido: 'PIX' | 'Cartão Crédito' | 'Cartão Débito' | 'Dinheiro' | 'Vale Refeição' = [
      'PIX',
      'Cartão Crédito',
      'Cartão Débito',
      'Dinheiro',
      'Vale Refeição'
    ].includes(rawPayload?.metodo)
      ? rawPayload.metodo
      : 'PIX';

    const nowUtc = new Date().toISOString();
    const pagId = String(
      rawPayload?.op_uuid || `PG-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
    );

    const txResult = await this.repo.runAtomicTransaction(async (client) => {
      const comandaCheck = await this.repo.findComandaById(client, comandaId);
      if (!comandaCheck) {
        throw new ResourceNotFoundError('Comanda ou mesa nao localizada.');
      }

      if (
        !operator.super &&
        !operator.emps.includes(comandaCheck.empresa_id) &&
        operator.emp !== comandaCheck.empresa_id
      ) {
        throw new UnauthorizedPrivilegeError('Acesso negado para operar comanda de outra empresa (BOLA/IDOR bloqueado).');
      }

      const itensAtivos = await this.repo.listActiveComandaItens(client, comandaId);
      const pagamentosAntes = await this.repo.listComandaPagamentos(client, comandaId);

      const aplicarGorjeta =
        rawPayload?.aplicar_gorjeta_10 !== undefined
          ? Boolean(rawPayload.aplicar_gorjeta_10)
          : comandaCheck.aplicar_gorjeta_10 === 1;

      const descontoManualCentavos = manualDescontoInformado
        ? reaisToCentavos(rawPayload.desconto)
        : comandaCheck.desconto_centavos;

      const pessoasMesa =
        rawPayload?.pessoas_mesa && Number(rawPayload.pessoas_mesa) > 0
          ? Math.max(1, Math.trunc(Number(rawPayload.pessoas_mesa)))
          : comandaCheck.pessoas_mesa;

      const preTotals = this.computeTotalsPureInteger({
        itensAtivos,
        descontoManualCentavos,
        cupomDescontoCentavos: 0,
        taxaEntregaCentavos: comandaCheck.taxa_entrega_centavos,
        aplicarGorjeta10: aplicarGorjeta,
        pagamentosRealizados: pagamentosAntes
      });

      if (preTotals.saldoRestanteCentavos === 0 && comandaCheck.status === 'fechada') {
        const details = (await this.repo.getComandaWithDetailsConsolidated(client, comandaCheck.empresa_id, comandaId))!;
        return {
          consolidated: details,
          trocoCentavos: 0,
          valorAplicadoCentavos: 0,
          recebidoDinheiroCentavos: 0,
          lancamentosCaixa: [] as any[],
          idempotentReplay: true
        };
      }

      const jaProcessadoPagamento = pagamentosAntes.find((p) => p.id === pagId);
      let valorAplicarCentavos = 0;
      let recebidoDinheiroCentavos = 0;
      let trocoCentavos = 0;

      if (!jaProcessadoPagamento && preTotals.saldoRestanteCentavos > 0) {
        const valorSolicitadoCentavos =
          rawPayload?.forcar_fechamento_total === true || !rawPayload?.valor_pagamento
            ? preTotals.saldoRestanteCentavos
            : Math.min(preTotals.saldoRestanteCentavos, Math.max(1, reaisToCentavos(rawPayload.valor_pagamento)));

        valorAplicarCentavos = valorSolicitadoCentavos;
        recebidoDinheiroCentavos =
          metodoValido === 'Dinheiro' && rawPayload?.valor_recebido_dinheiro !== undefined
            ? Math.max(valorAplicarCentavos, reaisToCentavos(rawPayload.valor_recebido_dinheiro))
            : valorAplicarCentavos;
        trocoCentavos = metodoValido === 'Dinheiro' ? Math.max(0, recebidoDinheiroCentavos - valorAplicarCentavos) : 0;

        const gorjetaProporcionalCentavos =
          preTotals.totalCentavos > 0
            ? Math.round((valorAplicarCentavos * preTotals.gorjetaCentavos) / preTotals.totalCentavos)
            : 0;

        await this.repo.insertPagamento(client, {
          id: pagId,
          comanda_id: comandaId,
          empresa_id: comandaCheck.empresa_id,
          metodo: metodoValido,
          valor_pago_centavos: valorAplicarCentavos,
          recebido_dinheiro_centavos: recebidoDinheiroCentavos,
          troco_centavos: trocoCentavos,
          gorjeta_proporcional_centavos: gorjetaProporcionalCentavos,
          pagante_ref: String(rawPayload?.pagante_ref || '').trim().slice(0, 120),
          operador_uid: operator.uid,
          operador_nome: operator.nome,
          criado_em_utc: nowUtc
        });
      }

      const pagamentosDepois = await this.repo.listComandaPagamentos(client, comandaId);

      const postTotals = this.computeTotalsPureInteger({
        itensAtivos,
        descontoManualCentavos,
        cupomDescontoCentavos: 0,
        taxaEntregaCentavos: comandaCheck.taxa_entrega_centavos,
        aplicarGorjeta10: aplicarGorjeta,
        pagamentosRealizados: pagamentosDepois
      });

      const fechouCompleta = postTotals.saldoRestanteCentavos === 0;
      const novoStatus = fechouCompleta ? 'fechada' : 'aguardando_pagamento';

      await this.repo.updateComandaPaymentStatus(client, {
        comandaId,
        pessoas_mesa: pessoasMesa,
        aplicar_gorjeta_10: aplicarGorjeta ? 1 : 0,
        subtotal_itens_centavos: postTotals.subtotalItensCentavos,
        desconto_centavos: postTotals.descontoEfetivoCentavos,
        gorjeta_centavos: postTotals.gorjetaCentavos,
        total_centavos: postTotals.totalCentavos,
        pago_acumulado_centavos: postTotals.pagoAcumuladoCentavos,
        saldo_restante_centavos: postTotals.saldoRestanteCentavos,
        status: novoStatus,
        atualizado_em_utc: nowUtc,
        fechouCompleta
      });

      const lancamentosCaixa: any[] = [];
      if (fechouCompleta) {
        const metodosResumo = Array.from(new Set(pagamentosDepois.map((p) => p.metodo))).join(' + ') || metodoValido;
        const principalSemGorjetaCentavos = Math.max(0, postTotals.totalCentavos - postTotals.gorjetaCentavos);
        const categoriaPrincipal = comandaCheck.modalidade === 'delivery' ? 'Delivery' : 'Faturamento Salão';
        const dataRefUtc = nowUtc.slice(0, 10);

        if (principalSemGorjetaCentavos > 0) {
          const opPrinc = `CX-PRINC-CMD-${comandaId}`;
          const descPrinc = `PDV ${comandaCheck.identificador}${comandaCheck.cliente_nome ? ` (${comandaCheck.cliente_nome})` : ''} [${metodosResumo}]`;
          const r1 = await this.repo.insertCaixaLancamentoIdempotent(client, {
            op_uuid: opPrinc,
            empresa_id: comandaCheck.empresa_id,
            unidade_id: comandaCheck.unidade_id,
            data_referencia_utc: dataRefUtc,
            tipo: 'Entrada',
            categoria: categoriaPrincipal,
            descricao: descPrinc,
            valor_centavos: principalSemGorjetaCentavos,
            forma_pagamento: metodosResumo,
            responsavel: operator.nome,
            origem_comanda_id: comandaId,
            arquivado_legal: 0,
            criado_em_utc: nowUtc
          });
          if (r1.inserted) {
            lancamentosCaixa.push({
              id: r1.id,
              op_uuid: opPrinc,
              data: dataRefUtc,
              tipo: 'Entrada',
              categoria: categoriaPrincipal,
              descricao: descPrinc,
              expressao: String(centavosToReais(principalSemGorjetaCentavos)),
              valor: centavosToReais(principalSemGorjetaCentavos),
              valor_centavos: principalSemGorjetaCentavos,
              forma_pagamento: metodosResumo,
              responsavel: operator.nome,
              unidade_id: comandaCheck.unidade_id,
              empresa_id: comandaCheck.empresa_id,
              origem_pdv_comanda_id: comandaId,
              arquivado_legal: false,
              criado_em: nowUtc
            });
          }
        }

        if (aplicarGorjeta && postTotals.gorjetaCentavos > 0) {
          const opGorj = `CX-GORJ-CMD-${comandaId}`;
          const descGorj = `10% Gorjeta Garçom (${comandaCheck.garcom_nome}) — ${comandaCheck.identificador}`;
          const r2 = await this.repo.insertCaixaLancamentoIdempotent(client, {
            op_uuid: opGorj,
            empresa_id: comandaCheck.empresa_id,
            unidade_id: comandaCheck.unidade_id,
            data_referencia_utc: dataRefUtc,
            tipo: 'Entrada',
            categoria: '10% Gorjeta',
            descricao: descGorj,
            valor_centavos: postTotals.gorjetaCentavos,
            forma_pagamento: metodosResumo,
            responsavel: comandaCheck.garcom_nome || operator.nome,
            origem_comanda_id: comandaId,
            arquivado_legal: 0,
            criado_em_utc: nowUtc
          });
          if (r2.inserted) {
            lancamentosCaixa.push({
              id: r2.id,
              op_uuid: opGorj,
              data: dataRefUtc,
              tipo: 'Entrada',
              categoria: '10% Gorjeta',
              descricao: descGorj,
              expressao: String(centavosToReais(postTotals.gorjetaCentavos)),
              valor: centavosToReais(postTotals.gorjetaCentavos),
              valor_centavos: postTotals.gorjetaCentavos,
              forma_pagamento: metodosResumo,
              responsavel: comandaCheck.garcom_nome || operator.nome,
              unidade_id: comandaCheck.unidade_id,
              empresa_id: comandaCheck.empresa_id,
              origem_pdv_comanda_id: comandaId,
              arquivado_legal: false,
              criado_em: nowUtc
            });
          }
        }
      }

      const consolidated = (await this.repo.getComandaWithDetailsConsolidated(client, comandaCheck.empresa_id, comandaId))!;
      return {
        consolidated,
        trocoCentavos,
        valorAplicadoCentavos: valorAplicarCentavos,
        recebidoDinheiroCentavos,
        lancamentosCaixa,
        idempotentReplay: Boolean(jaProcessadoPagamento)
      };
    });

    const formattedComanda = formatAcidComandaForFrontend(
      txResult.consolidated.comanda,
      txResult.consolidated.itens,
      txResult.consolidated.pagamentos
    );

    if (legacyDb) {
      this.projectComandaAndCaixaToMemoryDb(legacyDb, formattedComanda, txResult.lancamentosCaixa);
    }

    return {
      comanda: formattedComanda,
      troco: centavosToReais(txResult.trocoCentavos),
      troco_centavos: txResult.trocoCentavos,
      valor_aplicado: centavosToReais(txResult.valorAplicadoCentavos),
      recebido_dinheiro: centavosToReais(txResult.recebidoDinheiroCentavos),
      fechada_completa: formattedComanda.status === 'fechada',
      lancamentos_caixa: txResult.lancamentosCaixa,
      idempotent_replay: txResult.idempotentReplay
    };
  }

  public async emitirCobrancaGatewayIdempotente(
    operator: AuthenticatedOperatorContext,
    rawPayload: any
  ) {
    const comandaId = Number(rawPayload?.comanda_id || 0);
    if (!Number.isInteger(comandaId) || comandaId <= 0) {
      throw new DomainValidationError('Informe comanda_id valido para gerar cobranca no servidor.');
    }
    const gateway = String(rawPayload?.gateway || 'PIX_GATEWAY_OFICIAL').trim().toUpperCase();
    const clientProvidedIdempKey = rawPayload?.idempotency_key
      ? String(rawPayload.idempotency_key).trim()
      : '';

    return this.repo.runAtomicTransaction(async (client) => {
      const comanda = await this.repo.findComandaById(client, comandaId);
      if (!comanda) {
        throw new ResourceNotFoundError('Comanda nao localizada para emissao de cobranca.');
      }
      if (
        !operator.super &&
        !operator.emps.includes(comanda.empresa_id) &&
        operator.emp !== comanda.empresa_id
      ) {
        throw new UnauthorizedPrivilegeError('Escopo de empresa invalido para emissao de cobranca.');
      }
      if (comanda.saldo_restante_centavos <= 0) {
        throw new DomainValidationError('Esta comanda ja esta integralmente quitada.');
      }

      const idempotencyKey =
        clientProvidedIdempKey ||
        `IDEMP-CMD-${comanda.empresa_id}-${comanda.id}-${comanda.saldo_restante_centavos}-${gateway}`;

      const existing = await this.repo.findOutgoingChargeByKey(client, idempotencyKey);
      if (existing) {
        return {
          ok: true,
          idempotent_replay: true,
          idempotency_key: existing.idempotency_key,
          valor_centavos: existing.valor_centavos,
          valor_reais: centavosToReais(existing.valor_centavos),
          cobranca: JSON.parse(existing.resposta_json)
        };
      }

      const nowUtc = new Date().toISOString();
      const chargePayload = {
        charge_id: `CHG-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
        gateway,
        comanda_id: comanda.id,
        empresa_id: comanda.empresa_id,
        valor_centavos: comanda.saldo_restante_centavos,
        valor_reais: centavosToReais(comanda.saldo_restante_centavos),
        headers_enviados_gateway: {
          'Idempotency-Key': idempotencyKey
        },
        emitido_em_utc: nowUtc
      };

      await this.repo.insertOutgoingCharge(client, {
        idempotency_key: idempotencyKey,
        empresa_id: comanda.empresa_id,
        comanda_id: comanda.id,
        gateway,
        valor_centavos: comanda.saldo_restante_centavos,
        status: 'EMITIDA',
        resposta_json: JSON.stringify(chargePayload),
        criado_em_utc: nowUtc
      });

      return {
        ok: true,
        idempotent_replay: false,
        idempotency_key: idempotencyKey,
        valor_centavos: comanda.saldo_restante_centavos,
        valor_reais: centavosToReais(comanda.saldo_restante_centavos),
        cobranca: chargePayload
      };
    });
  }

  private projectComandaAndStockToMemoryDb(
    legacyDb: any,
    formattedComanda: any,
    baixas: Array<{ estoque_item_id: number; saldo_restante_mili: number }>
  ): void {
    if (!Array.isArray(legacyDb.pdv_comandas)) legacyDb.pdv_comandas = [];
    const idx = legacyDb.pdv_comandas.findIndex((c: any) => Number(c.id) === Number(formattedComanda.id));
    if (idx >= 0) {
      legacyDb.pdv_comandas[idx] = formattedComanda;
    } else {
      legacyDb.pdv_comandas.unshift(formattedComanda);
    }

    if (Array.isArray(legacyDb.erp_estoque)) {
      for (const bx of baixas) {
        const estItem = legacyDb.erp_estoque.find((e: any) => Number(e.id) === Number(bx.estoque_item_id));
        if (estItem) {
          estItem.quantidade = miliToUnidades(bx.saldo_restante_mili);
        }
      }
    }
  }

  private projectComandaAndCaixaToMemoryDb(legacyDb: any, formattedComanda: any, lancamentosCaixa: any[]): void {
    if (!Array.isArray(legacyDb.pdv_comandas)) legacyDb.pdv_comandas = [];
    const idx = legacyDb.pdv_comandas.findIndex((c: any) => Number(c.id) === Number(formattedComanda.id));
    if (idx >= 0) {
      legacyDb.pdv_comandas[idx] = formattedComanda;
    } else {
      legacyDb.pdv_comandas.unshift(formattedComanda);
    }

    if (!Array.isArray(legacyDb.erp_caixa)) legacyDb.erp_caixa = [];
    for (const cx of lancamentosCaixa) {
      if (!legacyDb.erp_caixa.some((e: any) => e.op_uuid === cx.op_uuid)) {
        legacyDb.erp_caixa.unshift(cx);
      }
    }
  }
}
