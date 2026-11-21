import { Express, NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CommerceRepository } from '../repositories/commerceRepository.ts';
import {
  AuthenticatedOperatorContext,
  DomainValidationError,
  InsufficientStockError,
  ResourceNotFoundError,
  UnauthorizedPrivilegeError,
  ZeroTrustCommerceService
} from '../services/zeroTrustCommerceService.ts';
import {
  HardLimitExceededError,
  InvalidWebhookSignatureError,
  WebhookAndHardLimitService
} from '../services/webhookAndHardLimitService.ts';
import { getBackupSchedulerStatus } from '../services/postgresBackupScheduler.ts';
import { isUserQuarantined } from '../services/accessApprovalService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');

const PUBLIC_API_EXACT_PATHS = new Set<string>([
  '/api/health',
  '/api/lan/ping',
  '/api/public/bootstrap-branding',
  '/api/public/empresa-portal',
  '/api/v31/auth/desbloquear',
  '/api/v31/auth/validar-acesso',
  '/api/v31/auth/recuperar-senha/solicitar',
  '/api/v31/auth/recuperar-senha/confirmar',
  '/api/v50/auth/setup-status',
  '/api/v50/auth/solicitar-token-wpp',
  '/api/v50/auth/validar-token-wpp',
  '/api/auth/register',
  '/api/erp/onboarding-empresario',
  '/api/lgpd/google-sheets/opcoes-publicas',
  '/api/erp/vps-codigo-instalacao-zero',
  '/api/webhooks/pagamentos',
  '/api/waha/webhook',
  '/api/v50/waha/webhook',
  '/api/system/staging/status',
  '/api/system/staging/reset',
  '/api/motors/health',
  '/api/v31/quadro-branco'
]);

const PUBLIC_API_PREFIXES = ['/api/storage/signed/'];

const SUPER_ADMIN_ONLY_PREFIXES = [
  '/api/vps/files/',
  '/api/erp/vps-configurar-dominio',
  '/api/erp/reset-zerado',
  '/api/erp/download-backup-dados'
];

export function isTrustedCorsOrigin(origin: string | undefined, requestHost: string | undefined): boolean {
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.run.app') ||
      hostname === 'nyctibi.us' ||
      hostname.endsWith('.nyctibi.us') ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)
    ) {
      return true;
    }
    if (requestHost) {
      const cleanReqHost = requestHost.split(':')[0].toLowerCase();
      if (hostname === cleanReqHost) return true;
    }
    const envAllowed = String(process.env.ALLOWED_CORS_ORIGINS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return envAllowed.includes(origin.toLowerCase()) || envAllowed.includes(hostname);
  } catch {
    return false;
  }
}

export function extractTargetEmpresaIdsFromRequest(req: Request): number[] {
  const candidates: unknown[] = [
    req.params?.empresaId,
    req.query?.empresa_id,
    req.query?.empresaId,
    req.query?.companyId,
    req.query?.company_id,
    req.headers['x-empresa-id'],
    req.body?.empresa_id,
    req.body?.empresaId,
    req.body?.company_id,
    req.body?.companyId,
    req.body?.id_empresa
  ];

  const ids = new Set<number>();
  for (const val of candidates) {
    if (val === undefined || val === null || val === '') continue;
    const num = Number(val);
    if (Number.isInteger(num) && num > 0) {
      ids.add(num);
    }
  }
  return Array.from(ids);
}

export function handleDomainErrorResponse(err: unknown, res: Response): void {
  if (err instanceof DomainValidationError) {
    res.status(err.statusCode).json({ ok: false, codigo: 'PAYLOAD_INVALIDO', erro: err.message });
    return;
  }
  if (err instanceof UnauthorizedPrivilegeError) {
    res.status(err.statusCode).json({ ok: false, codigo: 'ACESSO_PROIBIDO_BOLA', erro: err.message });
    return;
  }
  if (err instanceof ResourceNotFoundError) {
    res.status(err.statusCode).json({ ok: false, codigo: 'NAO_ENCONTRADO', erro: err.message });
    return;
  }
  if (err instanceof InsufficientStockError) {
    res.status(err.statusCode).json({
      ok: false,
      codigo: 'ESTOQUE_INSUFICIENTE_CONCORRENCIA',
      erro: err.message,
      detalhes: err.details
    });
    return;
  }
  if (err instanceof InvalidWebhookSignatureError) {
    res.status(err.statusCode).json({ ok: false, codigo: 'WEBHOOK_ASSINATURA_INVALIDA', erro: err.message });
    return;
  }
  if (err instanceof HardLimitExceededError) {
    res.status(err.statusCode).json({
      ok: false,
      codigo: 'HARD_LIMIT_EXCEDIDO',
      erro: err.message,
      escopo: err.scope,
      limite: err.limit
    });
    return;
  }
  const genericMsg = err instanceof Error ? err.message : 'Erro interno inesperado no servidor.';
  res.status(500).json({ ok: false, codigo: 'ERRO_INTERNO', erro: genericMsg });
}

export function registerZeroTrustMiddlewareAndRoutes(params: {
  app: Express;
  getRepo: () => CommerceRepository;
  getCommerceService: () => ZeroTrustCommerceService;
  getWebhookService: () => WebhookAndHardLimitService;
  extractSessionFn: (req: Request) => AuthenticatedOperatorContext | null;
  getLegacyDb: () => any;
  saveLegacyDb: () => void;
  backupEncryptionSecret: string;
}): void {
  const {
    app,
    getRepo,
    getCommerceService,
    getWebhookService,
    extractSessionFn,
    getLegacyDb,
    saveLegacyDb,
    backupEncryptionSecret
  } = params;

  app.use('/api', async (req: Request, res: Response, next: NextFunction) => {
    const fullPath = `/api${req.path === '/' ? '' : req.path}`;
    if (
      PUBLIC_API_EXACT_PATHS.has(fullPath) ||
      PUBLIC_API_PREFIXES.some((prefix) => fullPath.startsWith(prefix))
    ) {
      next();
      return;
    }

    if (fullPath === '/api/stream') {
      const tokenQuery = typeof req.query.session_token === 'string' ? req.query.session_token : '';
      if (tokenQuery && !req.headers['x-urutau-session']) {
        req.headers['x-urutau-session'] = tokenQuery;
      }
    }

    const sessao = extractSessionFn(req);
    if (!sessao) {
      res.status(401).json({
        ok: false,
        codigo: 'NAO_AUTENTICADO',
        erro: 'Sessao ausente, expirada ou invalida. Autentique-se novamente para acessar este recurso.'
      });
      return;
    }

    const legacyDbSnapshot = getLegacyDb();
    const matchedLegacyUser = Array.isArray(legacyDbSnapshot?.usuarios)
      ? legacyDbSnapshot.usuarios.find((u: any) => Number(u.id) === Number(sessao.uid))
      : null;
    if (matchedLegacyUser && isUserQuarantined(matchedLegacyUser)) {
      res.status(403).json({
        ok: false,
        codigo: 'PENDING_APPROVAL',
        approval_status: matchedLegacyUser.approval_status || 'pending_approval',
        erro: 'Aguardando aprovação do Administrador.'
      });
      return;
    }

    try {
      const rateScope = `uid_${sessao.uid}`;
      await getWebhookService().enforceEndpointRateHardLimit(rateScope);
    } catch (rateErr) {
      handleDomainErrorResponse(rateErr, res);
      return;
    }

    const requiresSuper = SUPER_ADMIN_ONLY_PREFIXES.some((prefix) => fullPath.startsWith(prefix));
    if (requiresSuper && !sessao.super) {
      res.status(403).json({
        ok: false,
        codigo: 'PRIVILEGIO_INSUFICIENTE',
        erro: 'Operacao exclusiva do Super Administrador autenticado.'
      });
      return;
    }

    if (!sessao.super) {
      const targetEmpresaIds = extractTargetEmpresaIdsFromRequest(req);
      for (const targetEmpId of targetEmpresaIds) {
        const permitido = sessao.emps.includes(targetEmpId) || sessao.emp === targetEmpId;
        if (!permitido) {
          res.status(403).json({
            ok: false,
            codigo: 'BOLA_IDOR_BLOQUEADO',
            erro: `Acesso negado: sua sessao nao possui autorizacao sobre a empresa #${targetEmpId}.`
          });
          return;
        }
      }
    }

    (req as any).urutauAuthSession = sessao;
    next();
  });

  app.get('/api/public/bootstrap-branding', (_req: Request, res: Response) => {
    const legacyDb = getLegacyDb();
    const configsPublicas = Array.isArray(legacyDb?.erp_configs)
      ? legacyDb.erp_configs.filter((c: any) => {
          const chave = String(c?.chave || '');
          return (
            [
              'identidade_marca_sistema',
              'identidade_visual_empresa',
              'brilho_padrao_admin_master_v1',
              'brilho_fundo_padrao',
              'tema_rgb_urutau',
              'dominio_oficial_vps'
            ].includes(chave) || chave.startsWith('identidade_visual_empresa_')
          );
        })
      : [];

    const empresasResumoPublico = Array.isArray(legacyDb?.empresas)
      ? legacyDb.empresas
          .filter((e: any) => !e.arquivado_legal)
          .map((e: any) => ({
            id: Number(e.id),
            nome: String(e.nome || 'Empresa'),
            subdominio: e.subdominio || e.slug_portal || '',
            slug_portal: e.slug_portal || '',
            cor_primaria: e.cor_primaria || '#10B981',
            logo_url: e.logo_url || '',
            brand_config: e.brand_config || null
          }))
      : [];

    res.json({
      ok: true,
      empresas: empresasResumoPublico,
      configs: configsPublicas
    });
  });

  app.post('/api/webhooks/pagamentos', async (req: Request, res: Response) => {
    try {
      const signature =
        (req.headers['x-urutau-webhook-signature'] as string | undefined) ||
        (req.headers['x-appmax-signature'] as string | undefined) ||
        (req.headers['x-webhook-signature'] as string | undefined);

      const rawBody =
        typeof (req as any).rawBody === 'string'
          ? (req as any).rawBody
          : JSON.stringify(req.body || {});

      const legacyDb = getLegacyDb();
      const result = await getWebhookService().processSignedPaymentWebhook({
        rawBody,
        signatureHeader: signature,
        payload: req.body || {},
        legacyDb
      });

      if (!result.idempotent_replay) {
        saveLegacyDb();
      }

      res.status(200).json(result);
    } catch (err) {
      handleDomainErrorResponse(err, res);
    }
  });

  app.post('/api/pdv/cobrancas/emitir', async (req: Request, res: Response) => {
    try {
      const sessao = (req as any).urutauAuthSession as AuthenticatedOperatorContext;
      const result = await getCommerceService().emitirCobrancaGatewayIdempotente(sessao, req.body || {});
      res.status(200).json(result);
    } catch (err) {
      handleDomainErrorResponse(err, res);
    }
  });

  app.get('/api/governanca/status', async (req: Request, res: Response) => {
    try {
      const sessao = (req as any).urutauAuthSession as AuthenticatedOperatorContext;
      const roleLower = `${sessao.cargo} ${sessao.tipo}`.toLowerCase();
      const isAdminOrGestor =
        sessao.super ||
        roleLower.includes('admin') ||
        roleLower.includes('diretor') ||
        roleLower.includes('gerente') ||
        roleLower.includes('empres');

      if (!isAdminOrGestor) {
        res.status(403).json({
          ok: false,
          erro: 'Apenas Administradores e Gestores podem consultar telemetria de governanca.'
        });
        return;
      }

      const activeRepo = getRepo();
      const engine = activeRepo.getEngine();
      const migrations = await engine.listAppliedMigrations();
      const queryPlans = await engine.auditQueryPlans();
      const recentWebhooks = await activeRepo.listRecentProcessedEvents(15);
      const hardLimits = await activeRepo.listCurrentHardLimits(15);

      const backupsDir = path.join(ROOT_DIR, 'backups');
      let backupsVerificados: Array<{ filename: string; sizeBytes: number; createdAtUtc: string }> = [];
      if (fs.existsSync(backupsDir)) {
        backupsVerificados = fs
          .readdirSync(backupsDir)
          .filter(
            (f) =>
              f.startsWith('urutau_pg_verified_backup_') ||
              f.startsWith('urutau_verified_backup_') ||
              f.startsWith('urutau_backup_')
          )
          .map((filename) => {
            const st = fs.statSync(path.join(backupsDir, filename));
            return {
              filename,
              sizeBytes: st.size,
              createdAtUtc: st.mtime.toISOString()
            };
          })
          .sort((a, b) => b.createdAtUtc.localeCompare(a.createdAtUtc))
          .slice(0, 10);
      }

      res.json({
        ok: true,
        ambiente: engine.getEnvironment(),
        motorRelacional: engine.isConfigured()
          ? 'PostgreSQL Pool (pg) + ACID Transactions + Hybrid Storage'
          : 'PostgreSQL Engine (aguardando DATABASE_URL) + Fallback Operacional',
        caminhoBancoIsolado: engine.getDatabaseTargetLabel(),
        backupWorkerStatus: getBackupSchedulerStatus(),
        constraintsAtivas: [
          'NOT NULL',
          'UNIQUE',
          'CHECK (saldo_mili >= 0)',
          'CHECK (preco_centavos >= 0)',
          'FOREIGN KEY CASCADE/RESTRICT',
          'MULTI-TENANT company_id'
        ],
        moedaArmazenamento: 'INTEGER (Centavos Exatos)',
        padraoTemporal: 'TIMESTAMPTZ UTC ISO-8601',
        migrationsAplicadas: migrations,
        auditoriaIndicesExplain: queryPlans,
        eventosWebhookIdempotentes: recentWebhooks,
        cotasHardLimits: hardLimits,
        backupsVerificados,
        scriptsInfraDisponiveis: [
          { id: 'vps-ssh-ufw', filename: 'vps-hardening-ssh-ufw.sh', titulo: 'Blindagem SSH Somente Chave + Restart Daemon + Firewall UFW' },
          { id: 'backup-restore', filename: 'postgres-gdrive-backup.ts', titulo: 'Backup Horário PostgreSQL (pg_dump + gzip) -> Google Drive API v3' },
          { id: 'postgres-least-priv', filename: 'postgres-least-privilege.sql', titulo: 'Role PostgreSQL de Menor Privilégio (Sem DROP/SUPERUSER)' }
        ]
      });
    } catch (err) {
      handleDomainErrorResponse(err, res);
    }
  });

  app.post('/api/governanca/backup-testar-restauracao', async (req: Request, res: Response) => {
    try {
      const sessao = (req as any).urutauAuthSession as AuthenticatedOperatorContext;
      const roleLower = `${sessao.cargo} ${sessao.tipo}`.toLowerCase();
      if (!sessao.super && !roleLower.includes('admin') && !roleLower.includes('empres')) {
        res.status(403).json({
          ok: false,
          erro: 'Apenas Super Admin ou Proprietario pode disparar backup com teste de restauracao.'
        });
        return;
      }

      const activeRepo = getRepo();
      const legacyDb = getLegacyDb();
      await activeRepo.syncCatalogAndStockFromMemoryDb(legacyDb);
      const report = await activeRepo.getEngine().verifyBackupAndIsolatedRestore(backupEncryptionSecret);
      res.json(report);
    } catch (err) {
      handleDomainErrorResponse(err, res);
    }
  });

  app.get('/api/governanca/scripts/:scriptId', (req: Request, res: Response) => {
    try {
      const sessao = (req as any).urutauAuthSession as AuthenticatedOperatorContext;
      if (!sessao.super) {
        res.status(403).json({ ok: false, erro: 'Download de scripts de infraestrutura restrito ao Super Admin.' });
        return;
      }
      const map: Record<string, { file: string; mime: string }> = {
        'vps-ssh-ufw': { file: 'vps-hardening-ssh-ufw.sh', mime: 'text/x-shellscript; charset=utf-8' },
        'backup-restore': { file: 'postgres-gdrive-backup.ts', mime: 'application/typescript; charset=utf-8' },
        'postgres-least-priv': { file: 'postgres-least-privilege.sql', mime: 'application/sql; charset=utf-8' }
      };
      const entry = map[String(req.params.scriptId || '')];
      if (!entry) {
        res.status(404).json({ ok: false, erro: 'Script nao encontrado.' });
        return;
      }
      const fullPath = path.join(ROOT_DIR, 'scripts', entry.file);
      const content = fs.readFileSync(fullPath, 'utf8');
      res.setHeader('Content-Type', entry.mime);
      res.setHeader('Content-Disposition', `attachment; filename="${entry.file}"`);
      res.send(content);
    } catch (err) {
      handleDomainErrorResponse(err, res);
    }
  });
}
