import crypto from 'crypto';
import { CommerceRepository } from '../repositories/commerceRepository.ts';
import { centavosToReais, DomainValidationError } from './zeroTrustCommerceService.ts';

export class InvalidWebhookSignatureError extends Error {
  public readonly statusCode = 401;
  constructor(message = 'Assinatura criptografica HMAC do webhook ausente ou invalida.') {
    super(message);
    this.name = 'InvalidWebhookSignatureError';
  }
}

export class HardLimitExceededError extends Error {
  public readonly statusCode = 429;
  public readonly scope: string;
  public readonly limit: number;
  constructor(message: string, scope: string, limit: number) {
    super(message);
    this.name = 'HardLimitExceededError';
    this.scope = scope;
    this.limit = limit;
  }
}

export function computeWebhookHmacHex(rawBody: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

export function verifyWebhookSignatureConstantTime(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string
): boolean {
  if (!signatureHeader || !secret) return false;
  const cleanHeader = String(signatureHeader).trim().replace(/^sha256=/i, '');
  if (!/^[0-9a-f]{64}$/i.test(cleanHeader)) return false;

  const expectedHex = computeWebhookHmacHex(rawBody, secret);
  const bufReceived = Buffer.from(cleanHeader.toLowerCase(), 'hex');
  const bufExpected = Buffer.from(expectedHex.toLowerCase(), 'hex');
  if (bufReceived.length !== bufExpected.length) return false;
  return crypto.timingSafeEqual(bufReceived, bufExpected);
}

export class WebhookAndHardLimitService {
  private readonly repo: CommerceRepository;
  private readonly webhookSecret: string;

  constructor(repo: CommerceRepository, webhookSecret: string) {
    this.repo = repo;
    this.webhookSecret = webhookSecret;
  }

  public getWebhookSecret(): string {
    return this.webhookSecret;
  }

  public async enforceAiConsumptionHardLimit(empresaId: number): Promise<{
    hourCount: number;
    hourLimit: number;
    dayCount: number;
    dayLimit: number;
  }> {
    const now = new Date();
    const hourWindow = now.toISOString().slice(0, 13);
    const dayWindow = now.toISOString().slice(0, 10);
    const hourLimit = Math.max(1, Number(process.env.AI_HARD_LIMIT_PER_HOUR || 60));
    const dayLimit = Math.max(1, Number(process.env.AI_HARD_LIMIT_PER_DAY || 300));

    const hourCheck = await this.repo.consumeHardLimitQuota(`ai_emp_${empresaId}_hour`, hourWindow, hourLimit);
    if (!hourCheck.allowed) {
      throw new HardLimitExceededError(
        `Hard Limit horario de IA atingido (${hourCheck.maxLimit} chamadas/hora). Disjuntor acionado para protecao de custos.`,
        `ai_emp_${empresaId}_hour`,
        hourCheck.maxLimit
      );
    }

    const dayCheck = await this.repo.consumeHardLimitQuota(`ai_emp_${empresaId}_day`, dayWindow, dayLimit);
    if (!dayCheck.allowed) {
      throw new HardLimitExceededError(
        `Hard Limit diario de IA atingido (${dayCheck.maxLimit} chamadas/dia). Disjuntor acionado ate o proximo ciclo UTC.`,
        `ai_emp_${empresaId}_day`,
        dayCheck.maxLimit
      );
    }

    return {
      hourCount: hourCheck.currentCount,
      hourLimit: hourCheck.maxLimit,
      dayCount: dayCheck.currentCount,
      dayLimit: dayCheck.maxLimit
    };
  }

  public async enforceEndpointRateHardLimit(scopeKey: string, limitPerMinute?: number): Promise<void> {
    const minuteWindow = new Date().toISOString().slice(0, 16);
    const maxLimit = Math.max(5, Number(limitPerMinute || process.env.API_RATE_LIMIT_PER_MINUTE || 240));
    const check = await this.repo.consumeHardLimitQuota(`api_rate_${scopeKey}`, minuteWindow, maxLimit);
    if (!check.allowed) {
      throw new HardLimitExceededError(
        `Limite de requisicoes por minuto excedido (${check.maxLimit}/min).`,
        `api_rate_${scopeKey}`,
        check.maxLimit
      );
    }
  }

  public async processSignedPaymentWebhook(params: {
    rawBody: string;
    signatureHeader: string | undefined;
    payload: any;
    legacyDb?: any;
  }) {
    const validSig = verifyWebhookSignatureConstantTime(
      params.rawBody,
      params.signatureHeader,
      this.webhookSecret
    );
    if (!validSig) {
      throw new InvalidWebhookSignatureError();
    }

    const eventId = String(params.payload?.event_id || params.payload?.id || '').trim();
    if (!eventId || eventId.length < 4) {
      throw new DomainValidationError('Payload de webhook exige chave unica event_id.');
    }

    const origem = String(params.payload?.gateway || params.payload?.origem || 'APPMAX_PIX_GATEWAY')
      .trim()
      .toUpperCase();
    const empresaId = Math.max(1, Math.trunc(Number(params.payload?.empresa_id || 1)));
    const valorPagoCentavos = Math.max(0, Math.trunc(Number(params.payload?.valor_centavos || 0)));
    const comandaId = params.payload?.comanda_id ? Number(params.payload.comanda_id) : null;
    const descricaoWebhook = String(
      params.payload?.descricao || `Recebimento Confirmado Webhook [${origem}] #${eventId}`
    ).trim();

    const payloadSha256 = crypto.createHash('sha256').update(params.rawBody, 'utf8').digest('hex');
    const nowUtc = new Date().toISOString();

    const result = await this.repo.runAtomicTransaction(async (client) => {
      await this.repo.ensureEmpresaExists(empresaId, `Empresa ${empresaId}`, client);

      const idemp = await this.repo.tryRegisterProcessedEvent(client, {
        event_id: eventId,
        origem,
        empresa_id: empresaId,
        payload_sha256: payloadSha256,
        efeito_resumo: `Credito confirmado ${valorPagoCentavos} centavos`,
        processado_em_utc: nowUtc
      });

      if (!idemp.inserted) {
        return {
          ok: true,
          idempotent_replay: true,
          event_id: eventId,
          processado_originalmente_em_utc: idemp.existing?.processado_em_utc || nowUtc,
          caixa_lancamento: null
        };
      }

      let caixaGerado: any = null;

      if (valorPagoCentavos > 0) {
        const opUuid = `WHK-${eventId}`;
        const dataRefUtc = nowUtc.slice(0, 10);

        let validComandaId: number | null = null;
        if (comandaId && comandaId > 0) {
          const cmd = await this.repo.findActiveComanda(client, empresaId, 1, comandaId);
          if (cmd) {
            validComandaId = cmd.id;
            const novoPago = cmd.pago_acumulado_centavos + valorPagoCentavos;
            const novoSaldo = Math.max(0, cmd.total_centavos - novoPago);
            const novoStatus = novoSaldo === 0 ? 'fechada' : 'aguardando_pagamento';
            await this.repo.updateComandaPaymentStatus(client, {
              comandaId: cmd.id,
              pessoas_mesa: cmd.pessoas_mesa,
              aplicar_gorjeta_10: cmd.aplicar_gorjeta_10,
              subtotal_itens_centavos: cmd.subtotal_itens_centavos,
              desconto_centavos: cmd.desconto_centavos,
              gorjeta_centavos: cmd.gorjeta_centavos,
              total_centavos: cmd.total_centavos,
              pago_acumulado_centavos: novoPago,
              saldo_restante_centavos: novoSaldo,
              status: novoStatus,
              atualizado_em_utc: nowUtc,
              fechouCompleta: novoSaldo === 0
            });
          }
        }

        const insertRes = await this.repo.insertCaixaLancamentoIdempotent(client, {
          op_uuid: opUuid,
          empresa_id: empresaId,
          unidade_id: 1,
          data_referencia_utc: dataRefUtc,
          tipo: 'Entrada',
          categoria: 'Gateway / Webhook',
          descricao: descricaoWebhook,
          valor_centavos: valorPagoCentavos,
          forma_pagamento: origem,
          responsavel: 'Webhook Assinado',
          origem_comanda_id: validComandaId,
          arquivado_legal: 0,
          criado_em_utc: nowUtc
        });

        caixaGerado = {
          id: insertRes.id,
          op_uuid: opUuid,
          data: dataRefUtc,
          tipo: 'Entrada',
          categoria: 'Gateway / Webhook',
          descricao: descricaoWebhook,
          expressao: String(centavosToReais(valorPagoCentavos)),
          valor: centavosToReais(valorPagoCentavos),
          valor_centavos: valorPagoCentavos,
          forma_pagamento: origem,
          responsavel: 'Webhook Assinado',
          unidade_id: 1,
          empresa_id: empresaId,
          origem_pdv_comanda_id: validComandaId,
          arquivado_legal: false,
          criado_em: nowUtc
        };
      }

      return {
        ok: true,
        idempotent_replay: false,
        event_id: eventId,
        processado_originalmente_em_utc: nowUtc,
        caixa_lancamento: caixaGerado
      };
    });

    if (!result.idempotent_replay && result.caixa_lancamento && params.legacyDb) {
      if (!Array.isArray(params.legacyDb.erp_caixa)) params.legacyDb.erp_caixa = [];
      params.legacyDb.erp_caixa.unshift(result.caixa_lancamento);
    }

    return result;
  }

  public async registerIdempotentChatWebhookEvent(params: {
    eventId: string;
    empresaId: number;
    rawBody: string;
  }): Promise<boolean> {
    const cleanId = String(params.eventId || '').trim();
    if (!cleanId) return true;
    const sha = crypto.createHash('sha256').update(params.rawBody, 'utf8').digest('hex');
    const nowUtc = new Date().toISOString();

    return this.repo.runAtomicTransaction(async (client) => {
      await this.repo.ensureEmpresaExists(params.empresaId, `Empresa ${params.empresaId}`, client);
      const res = await this.repo.tryRegisterProcessedEvent(client, {
        event_id: `WAHA-${cleanId}`,
        origem: 'WAHA_WHATSAPP',
        empresa_id: params.empresaId,
        payload_sha256: sha,
        efeito_resumo: 'Interacao bot WhatsApp',
        processado_em_utc: nowUtc
      });
      return res.inserted;
    });
  }

  public isStagingSandboxActive(): boolean {
    const appEnv = String(process.env.APP_ENV || '').trim().toLowerCase();
    const nodeEnv = String(process.env.NODE_ENV || '').trim().toLowerCase();
    return appEnv === 'staging' || nodeEnv === 'staging';
  }

  public async dispatchExternalWebhookSafely(params: {
    targetUrl: string;
    payload: unknown;
    headers?: Record<string, string>;
  }): Promise<{ ok: boolean; sandboxBlocked: boolean; status?: number; message: string }> {
    if (this.isStagingSandboxActive()) {
      console.log('[STAGING SANDBOX] Disparo externo bloqueado com segurança');
      return {
        ok: true,
        sandboxBlocked: true,
        status: 200,
        message: '[STAGING SANDBOX] Disparo externo bloqueado com segurança'
      };
    }

    const rawBody = JSON.stringify(params.payload ?? {});
    const signature = computeWebhookHmacHex(rawBody, this.webhookSecret);
    const response = await fetch(params.targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Urutau-Webhook-Signature': `sha256=${signature}`,
        ...(params.headers || {})
      },
      body: rawBody
    });

    return {
      ok: response.ok,
      sandboxBlocked: false,
      status: response.status,
      message: response.ok ? 'Webhook externo enviado com sucesso.' : `Falha HTTP ${response.status}`
    };
  }
}
