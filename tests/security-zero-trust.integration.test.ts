import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

process.env.NODE_ENV = 'test';
process.env.API_RATE_LIMIT_PER_MINUTE = '2000';

import {
  app,
  criarTokenSessaoAssinado,
  initServerForTests,
  WEBHOOK_HMAC_SECRET
} from '../server.ts';
import {
  computeWebhookHmacHex,
  HardLimitExceededError
} from '../src/server/services/webhookAndHardLimitService.ts';
import { computeSmartRetentionPlan } from '../scripts/postgres-gdrive-backup.ts';

let httpServer: http.Server;
let baseUrl = '';
let activeRepo: Awaited<ReturnType<typeof initServerForTests>>['commerceRepository'];
let activeWebhookSvc: Awaited<ReturnType<typeof initServerForTests>>['webhookAndHardLimitService'];

let superAdminToken = '';
let garcomEmp1Token = '';
let gerenteEmp1Token = '';
let operadorEmp2Token = '';

async function sendJson(
  endpoint: string,
  options: {
    method?: string;
    token?: string;
    headers?: Record<string, string>;
    body?: unknown;
  } = {}
): Promise<{ status: number; json: any; rawBody: string }> {
  const method = options.method || 'GET';
  const headers: Record<string, string> = {
    ...(options.headers || {})
  };
  if (options.token) {
    headers['X-Urutau-Session'] = options.token;
  }
  let serializedBody: string | undefined;
  if (options.body !== undefined) {
    serializedBody = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
  }

  const resp = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers,
    body: serializedBody
  });
  const rawBody = await resp.text();
  let json: any = null;
  try {
    json = JSON.parse(rawBody);
  } catch {
    json = { raw: rawBody };
  }
  return { status: resp.status, json, rawBody };
}

describe('Suite E2E de Seguranca Zero-Trust, Transacoes ACID, Concorrencia & Idempotencia', () => {
  before(async () => {
    const initialized = await initServerForTests();
    activeRepo = initialized.commerceRepository;
    activeWebhookSvc = initialized.webhookAndHardLimitService;

    await activeRepo.ensureEmpresaExists(1, 'Restaurante Matriz Teste #1');
    await activeRepo.ensureEmpresaExists(2, 'Restaurante Filial Isolada #2');

    const expFuture = Date.now() + 60 * 60 * 1000;

    superAdminToken = criarTokenSessaoAssinado({
      uid: 1,
      nome: 'Admin Master',
      cargo: 'Super Administrador',
      tipo: 'SuperAdmin',
      emp: 1,
      emps: [1, 2],
      super: true,
      exp: expFuture
    });

    garcomEmp1Token = criarTokenSessaoAssinado({
      uid: 101,
      nome: 'Carlos Garcom',
      cargo: 'Garcom de Salao',
      tipo: 'Colaborador',
      emp: 1,
      emps: [1],
      super: false,
      exp: expFuture
    });

    gerenteEmp1Token = criarTokenSessaoAssinado({
      uid: 102,
      nome: 'Mariana Gerente',
      cargo: 'Gerente Geral',
      tipo: 'Gestor',
      emp: 1,
      emps: [1],
      super: false,
      exp: expFuture
    });

    operadorEmp2Token = criarTokenSessaoAssinado({
      uid: 201,
      nome: 'Operador Empresa Dois',
      cargo: 'Gerente',
      tipo: 'Gestor',
      emp: 2,
      emps: [2],
      super: false,
      exp: expFuture
    });

    await new Promise<void>((resolve) => {
      httpServer = app.listen(0, '127.0.0.1', () => {
        const addr = httpServer.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  after(async () => {
    if (httpServer) {
      (httpServer as any).closeAllConnections?.();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
    try {
      await activeRepo.getEngine().close();
    } catch {}
  });

  it('1. Anti-Race Condition (Promise.all): 12 pedidos simultaneos disputando a ultima unidade do estoque aprovam exatamente 1 e barram 11 sem negativar saldo', async () => {
    const stockRes = await sendJson('/api/v20/estoque/salvar', {
      method: 'POST',
      token: gerenteEmp1Token,
      body: {
        empresa_id: 1,
        insumo: 'Picanha Angus Reserva Especial',
        unidade: 'UN',
        quantidade: 1,
        minimo: 1,
        custo_unitario: 42.0
      }
    });
    assert.equal(stockRes.status, 200);
    assert.equal(stockRes.json.ok, true);
    const stockItemId = Number(stockRes.json.id);
    assert.ok(stockItemId > 0);

    const prodRes = await sendJson('/api/pdv/produtos/salvar', {
      method: 'POST',
      token: gerenteEmp1Token,
      body: {
        empresa_id: 1,
        codigo: 'PICANHA-ULTIMA-UN',
        nome: 'Picanha na Brasa Individual',
        categoria: 'Carnes Nobres',
        preco: 89.9,
        setor_impressao: 'nenhum',
        estoque_item_id: stockItemId,
        qtd_baixa_estoque: 1,
        disponivel: true
      }
    });
    assert.equal(prodRes.status, 200);
    const produtoId = Number(prodRes.json.produto.id);
    assert.ok(produtoId > 0);

    const totalConcorrentes = 12;
    const promessasConcorrentes = Array.from({ length: totalConcorrentes }, (_, idx) =>
      sendJson('/api/pdv/comandas/abrir-ou-adicionar', {
        method: 'POST',
        token: garcomEmp1Token,
        body: {
          empresa_id: 1,
          modalidade: 'balcao',
          identificador: `Balcao Race #${idx + 1}`,
          imprimir_setores: false,
          novos_itens: [
            {
              produto_id: produtoId,
              quantidade: 1
            }
          ]
        }
      })
    );

    const respostas = await Promise.all(promessasConcorrentes);
    const aprovadas = respostas.filter((r) => r.status === 200);
    const bloqueadasEstoque = respostas.filter(
      (r) => r.status === 409 && r.json?.codigo === 'ESTOQUE_INSUFICIENTE_CONCORRENCIA'
    );

    assert.equal(aprovadas.length, 1);
    assert.equal(bloqueadasEstoque.length, totalConcorrentes - 1);

    const saldoFinalBanco = await activeRepo.getStockBalance(1, stockItemId);
    assert.ok(saldoFinalBanco);
    assert.equal(saldoFinalBanco.saldo_mili, 0);
  });

  it('2. Webhooks Assinados & Idempotencia Estrita: rejeita HMAC invalido (401) e absorve 7 disparos identicos (Promise.all + replay) creditando o caixa uma unica vez', async () => {
    const webhookPayload = {
      event_id: 'EVT-APPMAX-PIX-99001',
      gateway: 'APPMAX_PIX',
      empresa_id: 1,
      valor_centavos: 12590,
      descricao: 'Liquidacao PIX Pedido Online #99001'
    };
    const rawBody = JSON.stringify(webhookPayload);

    const semAssinatura = await sendJson('/api/webhooks/pagamentos', {
      method: 'POST',
      body: rawBody
    });
    assert.equal(semAssinatura.status, 401);
    assert.equal(semAssinatura.json.codigo, 'WEBHOOK_ASSINATURA_INVALIDA');

    const assinaturaFalsa = await sendJson('/api/webhooks/pagamentos', {
      method: 'POST',
      headers: {
        'X-Urutau-Webhook-Signature': 'sha256=' + 'a'.repeat(64)
      },
      body: rawBody
    });
    assert.equal(assinaturaFalsa.status, 401);

    const hmacValido = computeWebhookHmacHex(rawBody, WEBHOOK_HMAC_SECRET);

    const rajadaSimultanea = await Promise.all(
      Array.from({ length: 6 }, () =>
        sendJson('/api/webhooks/pagamentos', {
          method: 'POST',
          headers: {
            'X-Urutau-Webhook-Signature': `sha256=${hmacValido}`
          },
          body: rawBody
        })
      )
    );

    for (const resp of rajadaSimultanea) {
      assert.equal(resp.status, 200);
      assert.equal(resp.json.ok, true);
    }

    const replayAtrasado = await sendJson('/api/webhooks/pagamentos', {
      method: 'POST',
      headers: {
        'X-Urutau-Webhook-Signature': hmacValido
      },
      body: rawBody
    });
    assert.equal(replayAtrasado.status, 200);
    assert.equal(replayAtrasado.json.idempotent_replay, true);

    const todosEnvios = [...rajadaSimultanea, replayAtrasado];
    const execucoesOriginais = todosEnvios.filter((r) => r.json.idempotent_replay === false);
    const replaysIdempotentes = todosEnvios.filter((r) => r.json.idempotent_replay === true);
    assert.equal(execucoesOriginais.length, 1);
    assert.equal(replaysIdempotentes.length, 6);

    const recentEvents = await activeRepo.listRecentProcessedEvents(50);
    const matchingEvents = recentEvents.filter((e) => e.event_id === 'EVT-APPMAX-PIX-99001');
    assert.equal(matchingEvents.length, 1);
  });

  it('3. Zero Trust no Servidor: ignora preco_unitario adulterado (R$ 0,01) e taxa_entrega=0 do cliente, aplica cupom/frete oficiais em centavos e barra desconto manual por Garcom (403)', async () => {
    const prodRes = await sendJson('/api/pdv/produtos/salvar', {
      method: 'POST',
      token: gerenteEmp1Token,
      body: {
        empresa_id: 1,
        codigo: 'FILHOTE-AMAZONIA',
        nome: 'Filhote Grelhado com Tucupi',
        categoria: 'Pratos Principais',
        preco: 59.9,
        setor_impressao: 'nenhum',
        disponivel: true
      }
    });
    assert.equal(prodRes.status, 200);
    const produtoId = Number(prodRes.json.produto.id);

    const pedidoAdulterado = await sendJson('/api/pdv/comandas/abrir-ou-adicionar', {
      method: 'POST',
      token: garcomEmp1Token,
      body: {
        empresa_id: 1,
        modalidade: 'delivery',
        cliente_nome: 'Cliente Auditoria Zero Trust',
        endereco_entrega: 'Av. Nazare, 500',
        zona_entrega_codigo: 'PADRAO',
        cupom_codigo: 'URUTAU10',
        taxa_entrega: 0,
        desconto: 999,
        valor_total: 0.02,
        aplicar_gorjeta_10: false,
        imprimir_setores: false,
        novos_itens: [
          {
            produto_id: produtoId,
            quantidade: 2,
            preco_unitario: 0.01,
            subtotal: 0.02
          }
        ]
      }
    });

    assert.equal(pedidoAdulterado.status, 200);
    const comanda = pedidoAdulterado.json.comanda;
    assert.equal(comanda.subtotal_itens_centavos, 11980);
    assert.equal(comanda.desconto_centavos, 1198);
    assert.equal(comanda.taxa_entrega_centavos, 800);
    assert.equal(comanda.total_centavos, 11582);
    assert.equal(comanda.valor_total, 115.82);

    const tentativaDescontoGarcom = await sendJson('/api/pdv/comandas/pagar-fechar', {
      method: 'POST',
      token: garcomEmp1Token,
      body: {
        comanda_id: comanda.id,
        metodo: 'PIX',
        desconto: 50
      }
    });
    assert.equal(tentativaDescontoGarcom.status, 403);
    assert.equal(tentativaDescontoGarcom.json.codigo, 'ACESSO_PROIBIDO_BOLA');

    const fechamentoGerente = await sendJson('/api/pdv/comandas/pagar-fechar', {
      method: 'POST',
      token: gerenteEmp1Token,
      body: {
        comanda_id: comanda.id,
        metodo: 'PIX',
        forcar_fechamento_total: true
      }
    });
    assert.equal(fechamentoGerente.status, 200);
    assert.equal(fechamentoGerente.json.fechada_completa, true);
    assert.equal(fechamentoGerente.json.comanda.saldo_restante_centavos, 0);
    assert.equal(fechamentoGerente.json.comanda.pago_acumulado_centavos, 11582);
  });

  it('4. Anti-BOLA / IDOR: bloqueia requisicoes sem sessao (401) e impede acesso cruzado entre empresas (403)', async () => {
    const semTokenDados = await sendJson('/api/erp/dados-completos');
    assert.equal(semTokenDados.status, 401);
    assert.equal(semTokenDados.json.codigo, 'NAO_AUTENTICADO');

    const semTokenCaixa = await sendJson('/api/v20/caixa/salvar', {
      method: 'POST',
      body: { empresa_id: 1, tipo: 'Entrada', valor: 100, descricao: 'Invasao' }
    });
    assert.equal(semTokenCaixa.status, 401);

    const crossTenantQuery = await sendJson('/api/reservas?empresa_id=1', {
      token: operadorEmp2Token
    });
    assert.equal(crossTenantQuery.status, 403);
    assert.equal(crossTenantQuery.json.codigo, 'BOLA_IDOR_BLOQUEADO');

    const crossTenantWrite = await sendJson('/api/v20/caixa/salvar', {
      method: 'POST',
      token: operadorEmp2Token,
      body: {
        empresa_id: 1,
        tipo: 'Saída',
        categoria: 'Sangria',
        descricao: 'Tentativa IDOR em outra empresa',
        valor: 500
      }
    });
    assert.equal(crossTenantWrite.status, 403);
  });

  it('5. Idempotency-Key de Saida, Disjuntor Hard Limit (429) e Backup Criptografado com Teste Real de Restauracao Isolada', async () => {
    const prodRes = await sendJson('/api/pdv/produtos/salvar', {
      method: 'POST',
      token: gerenteEmp1Token,
      body: {
        empresa_id: 1,
        codigo: 'CAFE-EXPRESSO',
        nome: 'Cafe Expresso Especial',
        categoria: 'Cafeteria',
        preco: 9.5,
        setor_impressao: 'nenhum',
        disponivel: true
      }
    });
    const prodId = Number(prodRes.json.produto.id);

    const cmdRes = await sendJson('/api/pdv/comandas/abrir-ou-adicionar', {
      method: 'POST',
      token: garcomEmp1Token,
      body: {
        empresa_id: 1,
        modalidade: 'mesa',
        mesa_numero: '42',
        imprimir_setores: false,
        novos_itens: [{ produto_id: prodId, quantidade: 2 }]
      }
    });
    assert.equal(cmdRes.status, 200);
    const comandaId = Number(cmdRes.json.comanda.id);

    const cobranca1 = await sendJson('/api/pdv/cobrancas/emitir', {
      method: 'POST',
      token: garcomEmp1Token,
      body: {
        comanda_id: comandaId,
        gateway: 'APPMAX_PIX',
        idempotency_key: 'IDEMP-TESTE-MESA-42'
      }
    });
    assert.equal(cobranca1.status, 200);
    assert.equal(cobranca1.json.idempotent_replay, false);
    assert.equal(
      cobranca1.json.cobranca.headers_enviados_gateway['Idempotency-Key'],
      'IDEMP-TESTE-MESA-42'
    );

    const cobranca2 = await sendJson('/api/pdv/cobrancas/emitir', {
      method: 'POST',
      token: garcomEmp1Token,
      body: {
        comanda_id: comandaId,
        gateway: 'APPMAX_PIX',
        idempotency_key: 'IDEMP-TESTE-MESA-42'
      }
    });
    assert.equal(cobranca2.status, 200);
    assert.equal(cobranca2.json.idempotent_replay, true);
    assert.equal(cobranca2.json.cobranca.charge_id, cobranca1.json.cobranca.charge_id);

    process.env.AI_HARD_LIMIT_PER_HOUR = '2';
    const q1 = await activeWebhookSvc.enforceAiConsumptionHardLimit(99);
    assert.equal(q1.hourCount, 1);
    const q2 = await activeWebhookSvc.enforceAiConsumptionHardLimit(99);
    assert.equal(q2.hourCount, 2);
    await assert.rejects(
      async () => activeWebhookSvc.enforceAiConsumptionHardLimit(99),
      (err: unknown) => err instanceof HardLimitExceededError && err.statusCode === 429
    );

    const govStatus = await sendJson('/api/governanca/status', {
      token: superAdminToken
    });
    assert.equal(govStatus.status, 200);
    assert.equal(govStatus.json.ambiente, 'test');

    const backupVerify = await sendJson('/api/governanca/backup-testar-restauracao', {
      method: 'POST',
      token: superAdminToken,
      body: {}
    });
    assert.equal(backupVerify.status, 200);
    assert.equal(backupVerify.json.ok, true);
    assert.equal(backupVerify.json.restoredTempVerified, true);
    assert.equal(backupVerify.json.integrityCheck, 'ok');
    assert.equal(backupVerify.json.foreignKeyViolations, 0);
    assert.ok(backupVerify.json.sha256 && backupVerify.json.sha256.length === 64);

    if (backupVerify.json.backupPath) {
      const generatedBackupFullPath = path.join(process.cwd(), 'backups', backupVerify.json.backupPath);
      if (fs.existsSync(generatedBackupFullPath)) {
        fs.unlinkSync(generatedBackupFullPath);
      }
    }
  });

  it('6. Storage Hibrido Multi-Tenant: converte product_photo em WebP local, envia hr_document para Cold Storage e bloqueia download cross-tenant (403)', async () => {
    const png1x1Base64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const hotRes = await sendJson('/api/storage/upload', {
      method: 'POST',
      token: gerenteEmp1Token,
      body: {
        uploadType: 'product_photo',
        fileName: 'coca-cola-lata.png',
        mimeType: 'image/png',
        base64Data: png1x1Base64
      }
    });
    assert.equal(hotRes.status, 201);
    assert.equal(hotRes.json.ok, true);
    assert.equal(hotRes.json.file.storageTier, 'hot_local');
    assert.equal(hotRes.json.file.mimeType, 'image/webp');
    assert.equal(hotRes.json.file.companyId, 1);
    assert.ok(String(hotRes.json.file.relativePath).startsWith('/uploads/hot-storage/'));
    assert.ok(String(hotRes.json.file.relativePath).endsWith('.webp'));

    const staticResp = await fetch(`${baseUrl}${hotRes.json.file.relativePath}`);
    assert.equal(staticResp.status, 200);
    assert.ok(String(staticResp.headers.get('content-type') || '').includes('webp'));

    const pdfContent = Buffer.from('%PDF-1.4\nContrato RH Confidencial Empresa 1', 'utf8').toString('base64');
    const coldRes = await sendJson('/api/storage/upload', {
      method: 'POST',
      token: gerenteEmp1Token,
      body: {
        uploadType: 'hr_document',
        fileName: 'contrato-colaborador.pdf',
        mimeType: 'application/pdf',
        base64Data: pdfContent
      }
    });
    assert.equal(coldRes.status, 201);
    assert.equal(coldRes.json.file.storageTier, 'cold_gdrive');
    assert.equal(coldRes.json.file.companyId, 1);
    assert.ok(coldRes.json.file.driveFileId);
    assert.equal(coldRes.json.file.relativePath, null);

    const fileId = coldRes.json.file.id;

    const crossTenantDownload = await sendJson(`/api/storage/download/${fileId}`, {
      token: operadorEmp2Token
    });
    assert.equal(crossTenantDownload.status, 403);

    const signedRes = await sendJson(`/api/storage/download/${fileId}?mode=signed-url`, {
      token: gerenteEmp1Token
    });
    assert.equal(signedRes.status, 200);
    assert.ok(String(signedRes.json.signedUrl).startsWith('/api/storage/signed/'));

    const signedStreamResp = await fetch(`${baseUrl}${signedRes.json.signedUrl}`);
    assert.equal(signedStreamResp.status, 200);
    const downloadedText = await signedStreamResp.text();
    assert.ok(downloadedText.includes('Contrato RH Confidencial Empresa 1'));

    await sendJson(`/api/storage/${hotRes.json.file.id}`, {
      method: 'DELETE',
      token: gerenteEmp1Token
    });
  });

  it('7. Politica de Retencao Inteligente de Backups: mantem todos os horarios das ultimas 48h e apenas 1 diario para dias anteriores', () => {
    const nowMs = Date.parse('2026-11-20T18:00:00.000Z');
    const files = [
      { id: 'h1', name: 'urutau-pg-backup-2026-11-20T17-00-00Z.sql.gz', mimeType: 'application/gzip', size: '100', createdTime: '2026-11-20T17:00:00.000Z' },
      { id: 'h2', name: 'urutau-pg-backup-2026-11-19T10-00-00Z.sql.gz', mimeType: 'application/gzip', size: '100', createdTime: '2026-11-19T10:00:00.000Z' },
      { id: 'd1_old_morning', name: 'urutau-pg-backup-2026-11-17T08-00-00Z.sql.gz', mimeType: 'application/gzip', size: '100', createdTime: '2026-11-17T08:00:00.000Z' },
      { id: 'd1_old_night', name: 'urutau-pg-backup-2026-11-17T23-00-00Z.sql.gz', mimeType: 'application/gzip', size: '100', createdTime: '2026-11-17T23:00:00.000Z' },
      { id: 'd2_old_noon', name: 'urutau-pg-backup-2026-11-16T12-00-00Z.sql.gz', mimeType: 'application/gzip', size: '100', createdTime: '2026-11-16T12:00:00.000Z' },
      { id: 'd2_old_late', name: 'urutau-pg-backup-2026-11-16T22-00-00Z.sql.gz', mimeType: 'application/gzip', size: '100', createdTime: '2026-11-16T22:00:00.000Z' }
    ];

    const plan = computeSmartRetentionPlan(files, nowMs);
    assert.equal(plan.keptRecent48h, 2);
    assert.equal(plan.keptDailyArchive, 2);
    assert.ok(plan.keepIds.has('h1'));
    assert.ok(plan.keepIds.has('h2'));
    assert.ok(plan.keepIds.has('d1_old_night'));
    assert.ok(plan.keepIds.has('d2_old_late'));
    assert.deepEqual(plan.deleteIds.sort(), ['d1_old_morning', 'd2_old_noon']);
  });
});
