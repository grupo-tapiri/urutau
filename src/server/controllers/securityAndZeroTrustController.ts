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
import {
  isValidCoordinatePair,
  normalizeAllowedRadiusMeters
} from '../../shared/utils/geofencingUtils.ts';

export interface EmpresaPerimeterPayload {
  empresa_id: number;
  empresa_nome: string;
  latitude: number | null;
  longitude: number | null;
  allowed_radius_meters: number;
  configured: boolean;
  setor_id?: number | null;
  setor_nome?: string | null;
  setor_latitude?: number | null;
  setor_longitude?: number | null;
  setor_allowed_radius_meters?: number | null;
}

export async function resolveEmpresaPerimeterConfig(params: {
  engine?: ReturnType<CommerceRepository['getEngine']> | null;
  legacyDb: any;
  empresaId: number;
  setorId?: number | null;
}): Promise<EmpresaPerimeterPayload> {
  const targetEmpresaId = Number.isInteger(Number(params.empresaId)) && Number(params.empresaId) > 0
    ? Number(params.empresaId)
    : 1;
  const legacyEmp = Array.isArray(params.legacyDb?.empresas)
    ? params.legacyDb.empresas.find((e: any) => Number(e.id) === targetEmpresaId)
    : null;

  let empresaNome = String(legacyEmp?.nome || `Empresa #${targetEmpresaId}`);
  let lat: number | null = isValidCoordinatePair(legacyEmp?.latitude, legacyEmp?.longitude)
    ? Number(legacyEmp.latitude)
    : null;
  let lon: number | null = isValidCoordinatePair(legacyEmp?.latitude, legacyEmp?.longitude)
    ? Number(legacyEmp.longitude)
    : null;
  let radius = normalizeAllowedRadiusMeters(legacyEmp?.allowed_radius_meters, 50);

  if (params.engine && params.engine.isConfigured()) {
    try {
      const ready = await params.engine.ensureReady();
      if (ready) {
        const res = await params.engine.query<{
          nome: string;
          latitude: number | null;
          longitude: number | null;
          allowed_radius_meters: number | null;
        }>(
          'SELECT nome, latitude, longitude, allowed_radius_meters FROM empresas WHERE id = $1 LIMIT 1',
          [targetEmpresaId]
        );
        if (res.rows.length > 0) {
          const row = res.rows[0];
          if (row.nome) empresaNome = String(row.nome);
          if (isValidCoordinatePair(row.latitude, row.longitude)) {
            lat = Number(row.latitude);
            lon = Number(row.longitude);
          }
          if (row.allowed_radius_meters !== null && row.allowed_radius_meters !== undefined) {
            radius = normalizeAllowedRadiusMeters(row.allowed_radius_meters, radius);
          }
        }
      }
    } catch {}
  }

  let setorId: number | null = null;
  let setorNome: string | null = null;
  let setorLat: number | null = null;
  let setorLon: number | null = null;
  let setorRadius: number | null = null;

  const parsedSetorId = Number(params.setorId || 0);
  if (Number.isInteger(parsedSetorId) && parsedSetorId > 0) {
    setorId = parsedSetorId;
    const legacySetor = Array.isArray(params.legacyDb?.setores)
      ? params.legacyDb.setores.find((s: any) => Number(s.id) === parsedSetorId)
      : null;
    if (legacySetor) {
      setorNome = String(legacySetor.nome || '');
      if (isValidCoordinatePair(legacySetor.latitude, legacySetor.longitude)) {
        setorLat = Number(legacySetor.latitude);
        setorLon = Number(legacySetor.longitude);
      }
      setorRadius = normalizeAllowedRadiusMeters(legacySetor.allowed_radius_meters, radius);
    }
    if (params.engine && params.engine.isConfigured()) {
      try {
        const ready = await params.engine.ensureReady();
        if (ready) {
          const sRes = await params.engine.query<{
            nome: string;
            latitude: number | null;
            longitude: number | null;
            allowed_radius_meters: number | null;
          }>(
            'SELECT nome, latitude, longitude, allowed_radius_meters FROM setores WHERE id = $1 AND empresa_id = $2 LIMIT 1',
            [parsedSetorId, targetEmpresaId]
          );
          if (sRes.rows.length > 0) {
            const sRow = sRes.rows[0];
            if (sRow.nome) setorNome = String(sRow.nome);
            if (isValidCoordinatePair(sRow.latitude, sRow.longitude)) {
              setorLat = Number(sRow.latitude);
              setorLon = Number(sRow.longitude);
            }
            if (sRow.allowed_radius_meters !== null && sRow.allowed_radius_meters !== undefined) {
              setorRadius = normalizeAllowedRadiusMeters(sRow.allowed_radius_meters, radius);
            }
          }
        }
      } catch {}
    }
  }

  const effectiveLat = setorLat !== null && setorLon !== null ? setorLat : lat;
  const effectiveLon = setorLat !== null && setorLon !== null ? setorLon : lon;
  const effectiveRadius = setorLat !== null && setorLon !== null && setorRadius !== null ? setorRadius : radius;

  return {
    empresa_id: targetEmpresaId,
    empresa_nome: empresaNome,
    latitude: effectiveLat,
    longitude: effectiveLon,
    allowed_radius_meters: effectiveRadius,
    configured: isValidCoordinatePair(effectiveLat, effectiveLon),
    setor_id: setorId,
    setor_nome: setorNome,
    setor_latitude: setorLat,
    setor_longitude: setorLon,
    setor_allowed_radius_meters: setorRadius
  };
}

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

      const targetEmpresaId =
        Number(req.query?.empresa_id || req.headers['x-empresa-id'] || sessao.emp || 1) || 1;
      const perimeter = await resolveEmpresaPerimeterConfig({
        engine,
        legacyDb: getLegacyDb(),
        empresaId: targetEmpresaId
      });

      res.json({
        ok: true,
        ambiente: engine.getEnvironment(),
        motorRelacional: engine.isConfigured()
          ? 'PostgreSQL Pool (pg) + ACID Transactions + Hybrid Storage'
          : 'PostgreSQL Engine (aguardando DATABASE_URL) + Fallback Operacional',
        caminhoBancoIsolado: engine.getDatabaseTargetLabel(),
        backupWorkerStatus: getBackupSchedulerStatus(),
        perimeter,
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

  app.get('/api/zero-trust/perfil-perimetro', async (req: Request, res: Response) => {
    try {
      const sessao = (req as any).urutauAuthSession as AuthenticatedOperatorContext;
      const legacyDb = getLegacyDb();
      const targetEmpresaId =
        Number(req.query?.empresa_id || req.headers['x-empresa-id'] || sessao.emp || 1) || 1;
      const targetSetorId = Number(req.query?.setor_id || 0) || null;
      const activeUser = Array.isArray(legacyDb?.usuarios)
        ? legacyDb.usuarios.find((u: any) => Number(u.id) === Number(sessao.uid))
        : null;
      const safeUser = activeUser ? { ...activeUser } : { id: sessao.uid, nome: sessao.nome, cargo: sessao.cargo, tipo: sessao.tipo };
      delete safeUser.senha_argon2id;

      const effectiveSetorId =
        targetSetorId ||
        (Number(safeUser.setor_id || 0) > 0 ? Number(safeUser.setor_id) : null);

      const perimeter = await resolveEmpresaPerimeterConfig({
        engine: getRepo().getEngine(),
        legacyDb,
        empresaId: targetEmpresaId,
        setorId: effectiveSetorId
      });

      res.json({
        ok: true,
        usuario: {
          ...safeUser,
          perimeter
        },
        perimeter
      });
    } catch (err) {
      handleDomainErrorResponse(err, res);
    }
  });

  app.get('/api/governanca/perimetro', async (req: Request, res: Response) => {
    try {
      const sessao = (req as any).urutauAuthSession as AuthenticatedOperatorContext;
      const roleLower = `${sessao.cargo} ${sessao.tipo} ${(sessao as any).role || ''}`.toLowerCase();
      const isAdminOrGestor =
        sessao.super ||
        roleLower.includes('admin') ||
        roleLower.includes('diretor') ||
        roleLower.includes('gerente') ||
        roleLower.includes('empres') ||
        roleLower.includes('company_owner');

      if (!isAdminOrGestor) {
        res.status(403).json({
          ok: false,
          erro: 'Apenas Administradores, Proprietarios e Gerentes podem consultar a configuracao de perimetro.'
        });
        return;
      }

      const targetEmpresaId =
        Number(req.query?.empresa_id || req.headers['x-empresa-id'] || sessao.emp || 1) || 1;
      const legacyDb = getLegacyDb();
      const perimeter = await resolveEmpresaPerimeterConfig({
        engine: getRepo().getEngine(),
        legacyDb,
        empresaId: targetEmpresaId
      });

      const setores = Array.isArray(legacyDb?.setores)
        ? legacyDb.setores
            .filter((s: any) => !s.arquivado_legal && (!s.empresa_id || Number(s.empresa_id) === targetEmpresaId))
            .map((s: any) => ({
              id: Number(s.id),
              nome: String(s.nome || ''),
              latitude: isValidCoordinatePair(s.latitude, s.longitude) ? Number(s.latitude) : null,
              longitude: isValidCoordinatePair(s.latitude, s.longitude) ? Number(s.longitude) : null,
              allowed_radius_meters: normalizeAllowedRadiusMeters(s.allowed_radius_meters, 50)
            }))
        : [];

      res.json({
        ok: true,
        perimeter,
        setores
      });
    } catch (err) {
      handleDomainErrorResponse(err, res);
    }
  });

  app.put('/api/governanca/perimetro', async (req: Request, res: Response) => {
    try {
      const sessao = (req as any).urutauAuthSession as AuthenticatedOperatorContext;
      const roleLower = `${sessao.cargo} ${sessao.tipo} ${(sessao as any).role || ''}`.toLowerCase();
      const isAdminOrGestor =
        sessao.super ||
        roleLower.includes('admin') ||
        roleLower.includes('diretor') ||
        roleLower.includes('gerente') ||
        roleLower.includes('empres') ||
        roleLower.includes('company_owner');

      if (!isAdminOrGestor) {
        res.status(403).json({
          ok: false,
          erro: 'Apenas Administradores, Proprietarios e Gerentes podem alterar o perimetro GPS da unidade.'
        });
        return;
      }

      const rawEmpresaId = req.body?.empresa_id ?? req.headers['x-empresa-id'] ?? sessao.emp ?? 1;
      const targetEmpresaId = Number(rawEmpresaId);
      if (!Number.isInteger(targetEmpresaId) || targetEmpresaId <= 0) {
        res.status(400).json({ ok: false, erro: 'Identificador de empresa invalido.' });
        return;
      }

      if (!sessao.super && !sessao.emps.includes(targetEmpresaId) && sessao.emp !== targetEmpresaId) {
        res.status(403).json({
          ok: false,
          erro: 'Acesso negado: voce nao tem permissao para editar o perimetro desta empresa.'
        });
        return;
      }

      const rawLat = req.body?.latitude;
      const rawLon = req.body?.longitude;
      const isClearing =
        (rawLat === null || rawLat === undefined || String(rawLat).trim() === '') &&
        (rawLon === null || rawLon === undefined || String(rawLon).trim() === '');

      let latitude: number | null = null;
      let longitude: number | null = null;

      if (!isClearing) {
        if (!isValidCoordinatePair(rawLat, rawLon)) {
          res.status(400).json({
            ok: false,
            erro: 'Coordenadas GPS invalidas. Informe Latitude entre -90 e 90 e Longitude entre -180 e 180.'
          });
          return;
        }
        latitude = Number(Number(rawLat).toFixed(7));
        longitude = Number(Number(rawLon).toFixed(7));
      }

      const rawRadius = req.body?.allowed_radius_meters;
      const parsedRadius = Number(rawRadius ?? 50);
      if (!Number.isFinite(parsedRadius) || parsedRadius < 5 || parsedRadius > 50000) {
        res.status(400).json({
          ok: false,
          erro: 'Raio permitido invalido. Informe um valor entre 5 e 50000 metros.'
        });
        return;
      }
      const allowedRadiusMeters = Math.round(parsedRadius);

      const targetSetorId = req.body?.setor_id ? Number(req.body.setor_id) : null;
      const legacyDb = getLegacyDb();
      const engine = getRepo().getEngine();

      if (targetSetorId && Number.isInteger(targetSetorId) && targetSetorId > 0) {
        const setorObj = Array.isArray(legacyDb?.setores)
          ? legacyDb.setores.find(
              (s: any) =>
                Number(s.id) === targetSetorId &&
                (!s.empresa_id || Number(s.empresa_id) === targetEmpresaId)
            )
          : null;
        if (!setorObj) {
          res.status(404).json({ ok: false, erro: 'Setor nao encontrado nesta empresa.' });
          return;
        }
        setorObj.latitude = latitude;
        setorObj.longitude = longitude;
        setorObj.allowed_radius_meters = allowedRadiusMeters;
        saveLegacyDb();

        if (engine.isConfigured()) {
          try {
            const ready = await engine.ensureReady();
            if (ready) {
              await engine.query(
                `INSERT INTO setores (id, empresa_id, nome, latitude, longitude, allowed_radius_meters, atualizado_em_utc)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW())
                 ON CONFLICT (id) DO UPDATE SET
                   latitude = EXCLUDED.latitude,
                   longitude = EXCLUDED.longitude,
                   allowed_radius_meters = EXCLUDED.allowed_radius_meters,
                   atualizado_em_utc = NOW()`,
                [
                  targetSetorId,
                  targetEmpresaId,
                  String(setorObj.nome || `Setor #${targetSetorId}`),
                  latitude,
                  longitude,
                  allowedRadiusMeters
                ]
              );
            }
          } catch {}
        }
      } else {
        const empresaObj = Array.isArray(legacyDb?.empresas)
          ? legacyDb.empresas.find((e: any) => Number(e.id) === targetEmpresaId)
          : null;
        if (empresaObj) {
          empresaObj.latitude = latitude;
          empresaObj.longitude = longitude;
          empresaObj.allowed_radius_meters = allowedRadiusMeters;
          saveLegacyDb();
        }

        if (engine.isConfigured()) {
          try {
            const ready = await engine.ensureReady();
            if (ready) {
              const empNome = String(empresaObj?.nome || `Empresa #${targetEmpresaId}`);
              await engine.query(
                `INSERT INTO empresas (id, nome, latitude, longitude, allowed_radius_meters)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (id) DO UPDATE SET
                   latitude = EXCLUDED.latitude,
                   longitude = EXCLUDED.longitude,
                   allowed_radius_meters = EXCLUDED.allowed_radius_meters`,
                [targetEmpresaId, empNome, latitude, longitude, allowedRadiusMeters]
              );
            }
          } catch {}
        }
      }

      const updatedPerimeter = await resolveEmpresaPerimeterConfig({
        engine,
        legacyDb,
        empresaId: targetEmpresaId,
        setorId: targetSetorId
      });

      res.json({
        ok: true,
        mensagem: isClearing
          ? 'Perimetro GPS removido da unidade.'
          : `Perimetro GPS salvo com sucesso (raio de ${allowedRadiusMeters}m).`,
        perimeter: updatedPerimeter
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
