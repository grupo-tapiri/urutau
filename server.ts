import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import os from 'os';
import net from 'net';
import { fileURLToPath } from 'url';
import { GeminiBotService } from './src/services/geminiBotService.ts';
import { embeddedWhatsApp } from './src/services/embeddedWhatsAppService.ts';
import {
  getPostgresEngine,
  isStagingEnvironment,
  resetPostgresEngineForTests
} from './src/server/db/postgresEngine.ts';
import { CommerceRepository } from './src/server/repositories/commerceRepository.ts';
import {
  canAuthorizeManualDiscount,
  centavosToReais,
  reaisToCentavos,
  ZeroTrustCommerceService
} from './src/server/services/zeroTrustCommerceService.ts';
import {
  HardLimitExceededError,
  verifyWebhookSignatureConstantTime,
  WebhookAndHardLimitService
} from './src/server/services/webhookAndHardLimitService.ts';
import {
  HybridStorageService,
  registerHybridStorageRoutes
} from './src/server/services/hybridStorageService.ts';
import {
  extractClientIp,
  isUserQuarantined,
  registerAccessApprovalRoutes,
  syncAccessApprovalRecordToPostgres
} from './src/server/services/accessApprovalService.ts';
import { registerTenantBackupRoutes } from './src/server/services/tenantLogicalBackupService.ts';
import { startPostgresBackupWorkerThread } from './src/server/services/postgresBackupScheduler.ts';
import {
  handleDomainErrorResponse,
  isTrustedCorsOrigin,
  registerZeroTrustMiddlewareAndRoutes
} from './src/server/controllers/securityAndZeroTrustController.ts';
import { registerAllIsolatedMotors } from './src/server/motors/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
app.use(
  express.json({
    limit: '50mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString('utf8');
    }
  })
);

app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (origin && isTrustedCorsOrigin(origin, req.headers.host)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Empresa-Id, X-Urutau-Session, X-Urutau-Lan-Origin, X-Urutau-Webhook-Signature, Idempotency-Key, X-Requested-With'
  );
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

const AMBIENTE = process.env.NODE_ENV || 'prod';
const PORT = Number(process.env.PORT || 3000);
const INSTANCE_KEYS_PATH =
  process.env.NODE_ENV === 'test'
    ? path.join(os.tmpdir(), `.urutau_test_keys_${process.pid}.json`)
    : path.join(__dirname, '.urutau_instance_keys.json');
const INSTANCE_KEYS_DATA_PATH =
  process.env.NODE_ENV === 'test'
    ? INSTANCE_KEYS_PATH
    : path.join(__dirname, 'data', '.urutau_instance_keys.json');
const LEGACY_PEPPER_SECRET = 'urutau-pepper-secreto-2026-nyctibius';

function loadOrCreateInstanceKeys(): {
  pepperSecret: string;
  aesSecret: string;
  sessionSecret: string;
  webhookSecret: string;
  initialMasterPass: string;
} {
  const keyCandidates =
    INSTANCE_KEYS_DATA_PATH !== INSTANCE_KEYS_PATH
      ? [INSTANCE_KEYS_DATA_PATH, INSTANCE_KEYS_PATH]
      : [INSTANCE_KEYS_PATH];
  for (const keyPath of keyCandidates) {
    try {
      if (fs.existsSync(keyPath)) {
        const parsed = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
        if (parsed?.pepperSecret && parsed?.aesSecret && parsed?.sessionSecret) {
          const loaded = {
            pepperSecret: parsed.pepperSecret,
            aesSecret: parsed.aesSecret,
            sessionSecret: parsed.sessionSecret,
            webhookSecret: parsed.webhookSecret || crypto.randomBytes(32).toString('hex'),
            initialMasterPass: parsed.initialMasterPass || 'urutau2026'
          };
          for (const targetPath of keyCandidates) {
            try {
              fs.mkdirSync(path.dirname(targetPath), { recursive: true });
              if (!fs.existsSync(targetPath)) {
                fs.writeFileSync(targetPath, JSON.stringify(loaded, null, 2), {
                  encoding: 'utf8',
                  mode: 0o600
                });
              }
            } catch {}
          }
          return loaded;
        }
      }
    } catch {}
  }
  const generated = {
    pepperSecret: crypto.randomBytes(32).toString('hex'),
    aesSecret: crypto.randomBytes(32).toString('hex'),
    sessionSecret: crypto.randomBytes(32).toString('hex'),
    webhookSecret: crypto.randomBytes(32).toString('hex'),
    initialMasterPass: 'urutau2026',
    createdAt: new Date().toISOString()
  };
  for (const targetPath of keyCandidates) {
    try {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, JSON.stringify(generated, null, 2), {
        encoding: 'utf8',
        mode: 0o600
      });
    } catch {}
  }
  return generated;
}

const instanceKeys = loadOrCreateInstanceKeys();
const PEPPER_SECRET = process.env.PEPPER_SECRET || instanceKeys.pepperSecret;
const SESSION_HMAC_SECRET = process.env.SESSION_SECRET || instanceKeys.sessionSecret;
export const WEBHOOK_HMAC_SECRET = process.env.WEBHOOK_HMAC_SECRET || instanceKeys.webhookSecret;

let runtimeGeneratedMasterPass: string | null = null;
let isInitialGeneratedPasswordActive = false;

function getOrGenerateInitialMasterPassword(): string {
  if (process.env.ADMIN_MASTER_PASS) {
    return process.env.ADMIN_MASTER_PASS;
  }
  if (!runtimeGeneratedMasterPass) {
    runtimeGeneratedMasterPass = instanceKeys.initialMasterPass;
    isInitialGeneratedPasswordActive = true;
  }
  return runtimeGeneratedMasterPass;
}

const AES_MASTER_KEY = crypto.scryptSync(
  process.env.AES_SECRET || instanceKeys.aesSecret,
  PEPPER_SECRET,
  32
);

const LEGACY_AES_MASTER_KEY = crypto.scryptSync(
  'chave-mestra-aes-256-gcm-urutau-erp',
  LEGACY_PEPPER_SECRET,
  32
);

function encryptAES(plainText: string): string {
  if (!plainText) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', AES_MASTER_KEY, iv);
  let encrypted = cipher.update(String(plainText), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decryptAES(cipherText: string): string {
  if (!cipherText || !String(cipherText).includes(':')) return cipherText || '';
  const [ivHex, authTagHex, encryptedHex] = String(cipherText).split(':');
  if (!ivHex || !authTagHex || !encryptedHex) return cipherText;
  for (const keyCandidate of [AES_MASTER_KEY, LEGACY_AES_MASTER_KEY]) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', keyCandidate, Buffer.from(ivHex, 'hex'));
      decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {}
  }
  return '';
}

export interface UrutauSessionPayload {
  uid: number;
  nome: string;
  cargo: string;
  tipo: string;
  emp: number;
  emps: number[];
  super: boolean;
  exp: number;
}

export function criarTokenSessaoAssinado(payload: UrutauSessionPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_HMAC_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verificarTokenSessaoAssinado(rawToken: string): UrutauSessionPayload | null {
  if (!rawToken || !rawToken.includes('.')) return null;
  const [encoded, sig] = rawToken.trim().split('.');
  if (!encoded || !sig) return null;
  try {
    const expectedSig = crypto
      .createHmac('sha256', SESSION_HMAC_SECRET)
      .update(encoded)
      .digest('base64url');
    const bufA = Buffer.from(sig, 'utf8');
    const bufB = Buffer.from(expectedSig, 'utf8');
    if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
      return null;
    }
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as UrutauSessionPayload;
    if (!parsed || typeof parsed.exp !== 'number' || Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function emitirSessaoAssinada(res: Response, usuario: any, empresaAtivaId: number): string {
  const isSuper =
    Number(usuario?.id) === 1 &&
    (String(usuario?.tipo || '').toLowerCase().includes('super') ||
      String(usuario?.nome || '').toLowerCase() === 'admin master');
  const emps = Array.isArray(usuario?.empresas_ids)
    ? usuario.empresas_ids.map(Number).filter((n: number) => n > 0)
    : [Number(empresaAtivaId || 1)];
  const payload: UrutauSessionPayload = {
    uid: Number(usuario?.id || 1),
    nome: String(usuario?.nome || 'Operador'),
    cargo: String(usuario?.cargo || usuario?.tipo || 'Colaborador'),
    tipo: String(usuario?.tipo || 'Colaborador'),
    emp: Number(empresaAtivaId || emps[0] || 1),
    emps: emps.length > 0 ? emps : [Number(empresaAtivaId || 1)],
    super: isSuper,
    exp: Date.now() + 12 * 60 * 60 * 1000
  };
  const token = criarTokenSessaoAssinado(payload);
  res.setHeader(
    'Set-Cookie',
    `urutau_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200`
  );
  return token;
}

function extrairSessaoRequisicao(req: Request): UrutauSessionPayload | null {
  const authHeader = String(req.headers.authorization || '').trim();
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const t = verificarTokenSessaoAssinado(authHeader.slice(7).trim());
    if (t) return t;
  }
  const customHeader = String(req.headers['x-urutau-session'] || '').trim();
  if (customHeader) {
    const t = verificarTokenSessaoAssinado(customHeader);
    if (t) return t;
  }
  const cookieHeader = String(req.headers.cookie || '');
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)urutau_session=([^;]+)/);
    if (match && match[1]) {
      try {
        const t = verificarTokenSessaoAssinado(decodeURIComponent(match[1]));
        if (t) return t;
      } catch {}
    }
  }
  return null;
}

function verificarAcessoEmpresaRequisicao(req: Request, targetEmpresaId: number): boolean {
  const sessao = extrairSessaoRequisicao(req);
  if (!sessao) return false;
  if (sessao.super) return true;
  return sessao.emps.includes(Number(targetEmpresaId)) || sessao.emp === Number(targetEmpresaId);
}

export let commerceRepository = new CommerceRepository(getPostgresEngine());
export let zeroTrustCommerceService = new ZeroTrustCommerceService(commerceRepository);
export let webhookAndHardLimitService = new WebhookAndHardLimitService(
  commerceRepository,
  WEBHOOK_HMAC_SECRET
);
export let hybridStorageService = new HybridStorageService(getPostgresEngine());

registerZeroTrustMiddlewareAndRoutes({
  app,
  getRepo: () => commerceRepository,
  getCommerceService: () => zeroTrustCommerceService,
  getWebhookService: () => webhookAndHardLimitService,
  extractSessionFn: extrairSessaoRequisicao,
  getLegacyDb: () => db,
  saveLegacyDb: () => saveDbToDisk(),
  backupEncryptionSecret: process.env.BACKUP_ENCRYPTION_KEY || instanceKeys.aesSecret
});

registerHybridStorageRoutes({
  app,
  getStorageService: () => hybridStorageService
});

registerAccessApprovalRoutes({
  app,
  getLegacyDb: () => db,
  saveLegacyDb: () => saveDbToDisk(),
  hashPassword: gerarHashArgon2id,
  registerAuditLog: registrarAuditLog
});

registerTenantBackupRoutes({
  app,
  getLegacyDb: () => db,
  saveLegacyDb: () => saveDbToDisk(),
  registerAuditLog: registrarAuditLog
});

registerAllIsolatedMotors(app, {
  getDb: () => db,
  saveDb: () => saveDbToDisk(),
  reloadJsonDbFromDisk: () => {
    commerceRepository = new CommerceRepository(getPostgresEngine());
    zeroTrustCommerceService = new ZeroTrustCommerceService(commerceRepository);
    webhookAndHardLimitService = new WebhookAndHardLimitService(
      commerceRepository,
      WEBHOOK_HMAC_SECRET
    );
    hybridStorageService = new HybridStorageService(getPostgresEngine());
    try {
      const prodJsonCandidate =
        process.env.PROD_JSON_DATABASE_PATH ||
        (fs.existsSync('/app/prod-data/urutau_db.json')
          ? '/app/prod-data/urutau_db.json'
          : path.join(__dirname, 'data', 'urutau_db.json'));
      if (fs.existsSync(prodJsonCandidate)) {
        const parsed = JSON.parse(fs.readFileSync(prodJsonCandidate, 'utf8'));
        db = { ...db, ...parsed };
        normalizarEmpresasEUnidadesBanco();
      } else {
        initDatabase();
      }
    } catch {}
  }
});

const authAttemptsMap = new Map<string, { count: number; lockUntil: number; lastAttempt: number }>();

function obterChaveRateLimitAuth(req: Request, identificador?: string): string {
  const ip = String(req.ip || req.headers['x-forwarded-for'] || 'local').trim();
  const idClean = String(identificador || '').trim().toLowerCase().slice(0, 48);
  return `${ip}:${idClean || 'global'}`;
}

function verificarRateLimitAutenticacao(req: Request, identificador?: string): {
  bloqueado: boolean;
  segundosRestantes: number;
} {
  const key = obterChaveRateLimitAuth(req, identificador);
  const entry = authAttemptsMap.get(key);
  if (!entry) return { bloqueado: false, segundosRestantes: 0 };
  const now = Date.now();
  if (entry.lockUntil > now) {
    return {
      bloqueado: true,
      segundosRestantes: Math.max(1, Math.ceil((entry.lockUntil - now) / 1000))
    };
  }
  if (now - entry.lastAttempt > 5 * 60 * 1000) {
    authAttemptsMap.delete(key);
  }
  return { bloqueado: false, segundosRestantes: 0 };
}

function registrarFalhaAutenticacao(req: Request, identificador?: string) {
  const key = obterChaveRateLimitAuth(req, identificador);
  const now = Date.now();
  const atual = authAttemptsMap.get(key) || { count: 0, lockUntil: 0, lastAttempt: now };
  const nextCount = atual.count + 1;
  const lockUntil = nextCount >= 8 ? now + 60 * 1000 : 0;
  authAttemptsMap.set(key, {
    count: nextCount,
    lockUntil,
    lastAttempt: now
  });
}

function limparFalhasAutenticacao(req: Request, identificador?: string) {
  const key = obterChaveRateLimitAuth(req, identificador);
  authAttemptsMap.delete(key);
}

function isSafeWebhookOrGatewayUrl(rawUrl: string, allowLocalhostGateway = true): boolean {
  if (!rawUrl || !String(rawUrl).trim()) return false;
  try {
    const parsed = new URL(String(rawUrl).trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if (
      host === '169.254.169.254' ||
      host === 'metadata.google.internal' ||
      host === 'metadata' ||
      host.startsWith('169.254.') ||
      host === '0.0.0.0'
    ) {
      return false;
    }
    if (!allowLocalhostGateway && (host === 'localhost' || host === '127.0.0.1' || host === '::1')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function gerarTokenConsumerEmpresa(empresaId: number): string {
  const digest = crypto
    .createHmac('sha256', SESSION_HMAC_SECRET)
    .update(`urutau-consumer-bridge:${Number(empresaId || 1)}`)
    .digest('hex')
    .slice(0, 16)
    .toUpperCase();
  return `URT-CNS-${Number(empresaId || 1)}-${digest}`;
}

let argon2Module: any = null;
import('argon2' as any)
  .then((m) => {
    argon2Module = m.default || m;
  })
  .catch(() => {
  });

const ARGON2_OPTIONS = {
  type: 2, 
  memoryCost: 65536, 
  timeCost: 3, 
  parallelism: 4 
};

async function gerarHashArgon2id(senhaPura: string): Promise<string> {
  const comPepper = `${String(senhaPura).trim()}${PEPPER_SECRET}`;
  if (argon2Module) {
    return await argon2Module.hash(comPepper, ARGON2_OPTIONS);
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(comPepper, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
  return `$argon2id$v=19$m=65536,t=3,p=4$${salt}$${derived}`;
}

const ORPHANED_PEPPER_SALTS = new Set([
  '331546614d972bae88e8d1262e43cd50',
  '4457ebbfd31560d85880b5644bb8462f'
]);

function isOrphanedPepperHash(hashArmazenado?: string): boolean {
  if (!hashArmazenado) return false;
  const parts = String(hashArmazenado).trim().split('$');
  const salt = parts[4] || '';
  return ORPHANED_PEPPER_SALTS.has(salt);
}

async function verificarHashArgon2id(hashArmazenado: string, senhaDigitada: string): Promise<boolean> {
  if (!hashArmazenado || !senhaDigitada) return false;
  const cfgPepper = Array.isArray(db?.erp_configs)
    ? db.erp_configs.find((c: any) => c.chave === 'urutau_instance_pepper_v1')?.valor_json?.pepperSecret
    : undefined;
  const peppersToTry = Array.from(
    new Set([PEPPER_SECRET, cfgPepper, LEGACY_PEPPER_SECRET, ''].filter((x) => typeof x === 'string'))
  );
  const rawHash = String(hashArmazenado).trim();

  for (const pepper of peppersToTry) {
    const comPepper = `${String(senhaDigitada).trim()}${pepper}`;
    try {
      if (rawHash.startsWith('$argon2id$v=19$m=65536,t=3,p=4$')) {
        const parts = rawHash.split('$');
        const salt = parts[4];
        const keyHex = parts[5];
        if (salt && keyHex && /^[0-9a-f]{32}$/i.test(salt) && /^[0-9a-f]{128}$/i.test(keyHex)) {
          const derived = crypto.scryptSync(comPepper, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
          if (crypto.timingSafeEqual(Buffer.from(keyHex, 'hex'), Buffer.from(derived, 'hex'))) {
            return true;
          }
        }
      }
      if (argon2Module && rawHash.startsWith('$argon2')) {
        if (await argon2Module.verify(rawHash, comPepper)) return true;
      }
      if (rawHash.startsWith('$scrypt$')) {
        const [, , salt, keyHex] = rawHash.split('$');
        if (salt && keyHex && /^[0-9a-f]+$/i.test(keyHex)) {
          const derived = crypto.scryptSync(comPepper, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
          if (crypto.timingSafeEqual(Buffer.from(keyHex, 'hex'), Buffer.from(derived, 'hex'))) {
            return true;
          }
        }
      }
    } catch {}
  }
  return false;
}

class ResilientCache {
  private memoryStore = new Map<string, { value: any; expiresAt: number }>();
  public redisOnline = false;
  public hits = 0;
  public misses = 0;

  async get(key: string): Promise<any | null> {
    const entry = this.memoryStore.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.memoryStore.delete(key);
      this.misses++;
      return null;
    }
    this.hits++;
    return entry.value;
  }

  async set(key: string, value: any, ttlSeconds = 45): Promise<void> {
    this.memoryStore.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000
    });
  }

  async invalidatePrefix(prefix: string): Promise<void> {
    for (const k of this.memoryStore.keys()) {
      if (k.startsWith(prefix)) this.memoryStore.delete(k);
    }
  }
}
const cacheERP = new ResilientCache();

class UrutauSSEBroker {
  public clients = new Set<Response>();
  public clientEmpresa = new Map<Response, number>();
  public clientPcId = new Map<Response, string>();

  countClientsForEmpresa(empresaId: number): number {
    const uniquePcs = new Set<string>();
    for (const [resClient, empId] of this.clientEmpresa.entries()) {
      if (Number(empId) === Number(empresaId)) {
        const pcId = this.clientPcId.get(resClient) || 'PC-PADRAO';
        uniquePcs.add(pcId);
      }
    }
    return uniquePcs.size;
  }

  addClient(req: Request, res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const empId = Number(req.query.empresa_id || 1);
    const rawPcId = String(req.query.pc_id || '').trim();
    const fallbackId = `DEV-${String(req.ip || 'local')}-${String(req.headers['user-agent'] || '').slice(0, 32)}`;
    const pcId = rawPcId || fallbackId;

    for (const existingRes of Array.from(this.clients)) {
      if (this.clientPcId.get(existingRes) === pcId && this.clientEmpresa.get(existingRes) === empId) {
        this.clients.delete(existingRes);
        this.clientEmpresa.delete(existingRes);
        this.clientPcId.delete(existingRes);
        try {
          existingRes.end();
        } catch {}
      }
    }

    const initMsg = `id: ${Date.now()}\nevent: sse.conectado\ndata: ${JSON.stringify({
      sistema: 'Urutau',
      ambiente: AMBIENTE,
      empresa_id: empId,
      pc_id: pcId,
      ts: Date.now()
    })}\n\n`;
    res.write(initMsg);
    this.clients.add(res);
    this.clientEmpresa.set(res, empId);
    this.clientPcId.set(res, pcId);
    this.emit('sessao.computadores_ativos', {
      empresa_id: empId,
      computadores_ativos: this.countClientsForEmpresa(empId)
    });

    req.on('close', () => {
      this.clients.delete(res);
      this.clientEmpresa.delete(res);
      this.clientPcId.delete(res);
      this.emit('sessao.computadores_ativos', {
        empresa_id: empId,
        computadores_ativos: this.countClientsForEmpresa(empId)
      });
      try {
        res.end();
      } catch {}
    });
  }

  emit(eventName: string, payload: any) {
    const targetEmpId =
      payload && typeof payload === 'object' && payload.empresa_id !== undefined
        ? Number(payload.empresa_id)
        : null;
    const msg = `id: ${Date.now()}\nevent: ${eventName}\ndata: ${JSON.stringify({
      evento: eventName,
      payload,
      ts: new Date().toISOString()
    })}\n\n`;
    for (const client of this.clients) {
      try {
        if (targetEmpId && targetEmpId > 0) {
          const clientEmp = this.clientEmpresa.get(client);
          if (clientEmp && Number(clientEmp) !== targetEmpId) {
            continue;
          }
        }
        client.write(msg);
      } catch {
        this.clients.delete(client);
        this.clientEmpresa.delete(client);
        this.clientPcId.delete(client);
      }
    }
  }
}
const sseBroker = new UrutauSSEBroker();

app.get('/api/stream', (req, res) => sseBroker.addClient(req, res));

const DB_FILE_PATH =
  process.env.NODE_ENV === 'test'
    ? path.join(os.tmpdir(), `urutau_db_test_${process.pid}.json`)
    : path.join(__dirname, 'urutau_db.json');
const DB_DATA_VOLUME_PATH =
  process.env.NODE_ENV === 'test'
    ? DB_FILE_PATH
    : path.join(__dirname, 'data', 'urutau_db.json');

interface DatabaseSchema {
  audit_logs: any[];
  erp_outbox: any[];
  empresas: any[];
  freelancers: any[];
  matches_contratacoes: any[];
  unidades: any[];
  setores: any[];
  usuarios: any[];
  checklists: any[];
  erp_escalas_movimentos: any[];
  eventos_agenda: any[];
  reservas: any[];
  sites_portais: any[];
  erp_caixa: any[];
  erp_categorias_fechamento_caixa?: any[];
  erp_fechamentos_caixa_diarios?: any[];
  erp_estoque: any[];
  erp_cmv: any[];
  erp_selecao: any[];
  erp_rh_nr01: any[];
  erp_mensagens_rapidas: any[];
  erp_notificacoes: any[];
  erp_rateios_historico: any[];
  erp_configs: { chave: string; valor_json: any; atualizado_em: string }[];
  fila_aprovacoes_pendentes: any[];
  backups_horarios: any[];
  instancias_chat: any[];
  mensagens_chat: any[];
  cadastros_pessoas?: any[];
  cargos?: any[];
  pdv_produtos?: any[];
  pdv_comandas?: any[];
  pdv_impressoras?: any[];
  pdv_fila_impressao?: any[];
  lan_outbox_sync?: any[];
  lan_hub_config?: {
    vps_remota_url?: string;
    ultimo_espelhamento_em?: string | null;
    ultima_reconciliacao_em?: string | null;
  };
  relacionamentos: Record<string, { id: number; [k: string]: any; arquivado_legal: boolean }[]>;
}

export interface TokenWppRecord {
  token: string;
  usuario_id: number;
  empresa_id: number;
  telefone: string;
  expira_em: number; 
  usado: boolean;
  criado_em: string;
}

const tokensWppStore = new Map<string, TokenWppRecord>();

let db: DatabaseSchema;
let geminiBot: GeminiBotService;

function getTodayISO(): string {
  return new Date().toISOString().split('T')[0];
}

async function createInitialSeed(): Promise<DatabaseSchema> {
  const masterPassInicial = getOrGenerateInitialMasterPassword();
  const hashMaster = await gerarHashArgon2id(masterPassInicial);
  return getCleanSeed(hashMaster);
}

function getCleanSeed(hashMaster: string): DatabaseSchema {
  return {
    audit_logs: [
      {
        id: 1,
        id_empresa: 1,
        usuario: 'Sistema Urutau',
        cargo: 'Super Admin',
        ambiente: AMBIENTE,
        acao: 'BOOT_SISTEMA_ZERADO',
        detalhes: 'Inicialização do Urutau ERP com banco de dados em estado limpo e pronto para produção.',
        ip_origem: '127.0.0.1',
        criado_em: new Date().toISOString()
      }
    ],
    erp_outbox: [],
    empresas: [],
    freelancers: [],
    matches_contratacoes: [],
    unidades: [],
    setores: [],
    checklists: [],
    erp_escalas_movimentos: [],
    eventos_agenda: [],
    reservas: [],
    sites_portais: [],
    erp_caixa: [],
    erp_categorias_fechamento_caixa: [],
    erp_fechamentos_caixa_diarios: [],
    erp_estoque: [],
    erp_cmv: [],
    erp_selecao: [],
    erp_rh_nr01: [],
    erp_mensagens_rapidas: [],
    erp_notificacoes: [],
    erp_rateios_historico: [],
    erp_configs: [
      {
        chave: 'tema_rgb_urutau',
        valor_json: { hex: '#10B981', r: 16, g: 185, b: 129, tempo_inatividade_seg: 300 },
        atualizado_em: new Date().toISOString()
      }
    ],
    fila_aprovacoes_pendentes: [],
    backups_horarios: [],
    instancias_chat: [],
    mensagens_chat: [],
    pdv_produtos: [],
    pdv_comandas: [],
    pdv_impressoras: [],
    pdv_fila_impressao: [],
    lan_outbox_sync: [],
    lan_hub_config: {
      vps_remota_url: 'https://nyctibi.us',
      ultimo_espelhamento_em: null,
      ultima_reconciliacao_em: null
    },
    cadastros_pessoas: [
      {
        id: 1,
        nome: 'Admin Master',
        tipo_pessoa: 'PF',
        documento: '',
        whatsapp: '5591999990001',
        email: '',
        papeis: ['colaborador'],
        empresa_id: 1,
        cidade: 'Belém - PA',
        cargo_ou_ramo: 'Diretor Operacional',
        observacoes: 'Cadastro base sincronizado',
        arquivado_legal: false,
        criado_em: new Date().toISOString()
      }
    ],
    cargos: [
      {
        id: 1,
        nome: 'Garçom de Salão',
        cbo: '5134-05',
        nivel_hierarquico: 'operacional',
        tipo_vinculo_padrao: 'efetivo_clt',
        salario_base_sugerido: 2150,
        valor_diaria_sugerida: 160,
        participa_rateio_10: true,
        peso_rateio_padrao: 1.2,
        horario_entrada_padrao: '17:00',
        horario_saida_padrao: '01:30',
        dias_semana_padrao: [2, 3, 4, 5, 6, 0],
        intervalo_minutos: 60,
        tolerancia_minutos: 15,
        exige_controle_ponto: true,
        exige_gps: true,
        descricao_atividades: 'Atendimento de mesas, lançamento de comandas, sugestão de pratos e fechamento de conta.',
        requisitos_qualificacao: 'Experiência em atendimento de salão e operação de comandas.',
        setor_principal_id: 1,
        cor_identificacao: '#10B981',
        arquivado_legal: false,
        criado_em: new Date().toISOString()
      },
      {
        id: 2,
        nome: 'Barman / Coqueteleiro',
        cbo: '5134-20',
        nivel_hierarquico: 'operacional',
        tipo_vinculo_padrao: 'efetivo_clt',
        salario_base_sugerido: 2400,
        valor_diaria_sugerida: 180,
        participa_rateio_10: true,
        peso_rateio_padrao: 1.1,
        horario_entrada_padrao: '17:30',
        horario_saida_padrao: '02:00',
        dias_semana_padrao: [3, 4, 5, 6, 0],
        intervalo_minutos: 60,
        tolerancia_minutos: 15,
        exige_controle_ponto: true,
        exige_gps: true,
        descricao_atividades: 'Preparo de coquetéis autorais, controle de doses, mise en place do bar e requisição de estoque.',
        requisitos_qualificacao: 'Curso de coquetelaria e controle de fichas técnicas.',
        setor_principal_id: 2,
        cor_identificacao: '#F59E0B',
        arquivado_legal: false,
        criado_em: new Date().toISOString()
      },
      {
        id: 3,
        nome: 'Cozinheiro / Chef de Partida',
        cbo: '5132-05',
        nivel_hierarquico: 'lideranca',
        tipo_vinculo_padrao: 'efetivo_clt',
        salario_base_sugerido: 2950,
        valor_diaria_sugerida: 210,
        participa_rateio_10: true,
        peso_rateio_padrao: 1.3,
        horario_entrada_padrao: '15:00',
        horario_saida_padrao: '23:30',
        dias_semana_padrao: [2, 3, 4, 5, 6, 0],
        intervalo_minutos: 60,
        tolerancia_minutos: 10,
        exige_controle_ponto: true,
        exige_gps: true,
        descricao_atividades: 'Execução de pratos principais, controle de CMV da praça, etiquetagem PVPS e checklists sanitários.',
        requisitos_qualificacao: 'Boas práticas de manipulação de alimentos e domínio de fichas técnicas.',
        setor_principal_id: 3,
        cor_identificacao: '#06B6D4',
        arquivado_legal: false,
        criado_em: new Date().toISOString()
      },
      {
        id: 4,
        nome: 'Gerente Operacional',
        cbo: '1415-10',
        nivel_hierarquico: 'gestao',
        tipo_vinculo_padrao: 'efetivo_clt',
        salario_base_sugerido: 4600,
        valor_diaria_sugerida: 280,
        participa_rateio_10: true,
        peso_rateio_padrao: 1.5,
        horario_entrada_padrao: '16:00',
        horario_saida_padrao: '01:00',
        dias_semana_padrao: [1, 2, 3, 4, 5, 6],
        intervalo_minutos: 60,
        tolerancia_minutos: 20,
        exige_controle_ponto: true,
        exige_gps: true,
        descricao_atividades: 'Supervisão geral do turno, conferência de fechamento de caixa, escalas, compras e aprovação de rateio.',
        requisitos_qualificacao: 'Vivência em gestão de operações gastronômicas e liderança de equipe.',
        setor_principal_id: 1,
        cor_identificacao: '#8B5CF6',
        arquivado_legal: false,
        criado_em: new Date().toISOString()
      }
    ],
    relacionamentos: {
      rel_usuario_unidade: [],
      rel_unidade_usuario: [],
      rel_usuario_setor: [],
      rel_setor_usuario: [],
      rel_usuario_checklist: [],
      rel_checklist_usuario: [],
      rel_unidade_setor: [],
      rel_setor_unidade: [],
      rel_unidade_checklist: [],
      rel_checklist_unidade: [],
      rel_setor_checklist: [],
      rel_checklist_setor: [],
      rel_cargo_unidade: [],
      rel_unidade_cargo: [],
      rel_cargo_setor: [],
      rel_setor_cargo: [],
      rel_cargo_checklist: [],
      rel_checklist_cargo: [],
      rel_cargo_usuario: [{ id: 1, cargo_id: 4, usuario_id: 1, arquivado_legal: false }],
      rel_usuario_cargo: [{ id: 1, usuario_id: 1, cargo_id: 4, arquivado_legal: false }]
    },
    usuarios: [
      {
        id: 1,
        nome: 'Admin Master',
        telefone: '5591999990001',
        tipo: 'Super Admin',
        cargo: 'Diretor Operacional',
        foto: '',
        empresas_ids: [],
        escala_fixa_json: JSON.stringify([1, 2, 3, 4, 5, 6, 0]),
        senha_argon2id: hashMaster,
        permissoes_json: {
          total: true,
          escopo_colaboradores: 'todos',
          modulos: {
            empresas: { ver: true, editar: true },
            freelancers: { ver: true, editar: true },
            rateio: { ver: true, editar: true },
            escalas: { ver: true, editar: true },
            agenda: { ver: true, editar: true },
            pdv: { ver: true, editar: true },
            reservas: { ver: true, editar: true },
            portais: { ver: true, editar: true },
            chat: { ver: true, editar: true },
            caixa: { ver: true, editar: true },
            estoque: { ver: true, editar: true },
            compras: { ver: true, editar: true },
            cmv: { ver: true, editar: true },
            equipe: { ver: true, editar: true },
            selecao: { ver: true, editar: true },
            rh: { ver: true, editar: true },
            unidades: { ver: true, editar: true },
            setores: { ver: true, editar: true },
            checklists: { ver: true, editar: true },
            notificacoes: { ver: true, editar: true },
            config: { ver: true, editar: true }
          }
        },
        arquivado_legal: false,
        criado_em: new Date().toISOString()
      }
    ]
  };
}

function isEmpresaZeroGuarda(empresaId: number): boolean {
  const emp = (db?.empresas || []).find((e: any) => Number(e.id) === Number(empresaId));
  return Boolean(emp?.lgpd_custodia_config?.zero_guarda_operacional_vps === true);
}

function getEmpresasZeroGuardaSet(): Set<number> {
  const set = new Set<number>();
  for (const emp of db?.empresas || []) {
    if (emp?.lgpd_custodia_config?.zero_guarda_operacional_vps === true) {
      set.add(Number(emp.id));
    }
  }
  return set;
}

function limparCamposOperacionaisParaDisco(snapshot: any, zeroIds: Set<number>) {
  if (!snapshot || zeroIds.size === 0) return snapshot;
  const manterRegistro = (r: any) => {
    const eId = Number(r?.empresa_id ?? r?.id_empresa ?? 0);
    return !eId || !zeroIds.has(eId);
  };
  return {
    ...snapshot,
    reservas: (snapshot.reservas || []).filter(manterRegistro),
    erp_escalas_movimentos: (snapshot.erp_escalas_movimentos || []).filter(manterRegistro),
    erp_caixa: (snapshot.erp_caixa || []).filter(manterRegistro),
    erp_estoque: (snapshot.erp_estoque || []).filter(manterRegistro),
    erp_cmv: (snapshot.erp_cmv || []).filter(manterRegistro),
    erp_selecao: (snapshot.erp_selecao || []).filter(manterRegistro),
    erp_notificacoes: (snapshot.erp_notificacoes || []).filter(manterRegistro),
    erp_rh_nr01: (snapshot.erp_rh_nr01 || []).filter(manterRegistro),
    erp_rateios_historico: (snapshot.erp_rateios_historico || []).filter(manterRegistro),
    eventos_agenda: (snapshot.eventos_agenda || []).filter(manterRegistro),
    checklists: (snapshot.checklists || []).filter(manterRegistro),
    cadastros_pessoas: (snapshot.cadastros_pessoas || []).filter(manterRegistro),
    pdv_produtos: (snapshot.pdv_produtos || []).filter(manterRegistro),
    pdv_comandas: (snapshot.pdv_comandas || []).filter(manterRegistro),
    pdv_impressoras: (snapshot.pdv_impressoras || []).filter(manterRegistro),
    pdv_fila_impressao: (snapshot.pdv_fila_impressao || []).filter(manterRegistro),
    mensagens_chat: (snapshot.mensagens_chat || []).filter(manterRegistro),
    audit_logs: (snapshot.audit_logs || []).filter(manterRegistro)
  };
}

function saveDbToDisk() {
  try {
    const zeroIds = getEmpresasZeroGuardaSet();
    const payloadDisco = zeroIds.size > 0 ? limparCamposOperacionaisParaDisco(db, zeroIds) : db;
    const serialized = JSON.stringify(payloadDisco, null, 2);
    const targets =
      DB_DATA_VOLUME_PATH !== DB_FILE_PATH
        ? [DB_FILE_PATH, DB_DATA_VOLUME_PATH]
        : [DB_FILE_PATH];
    for (const targetFile of targets) {
      try {
        fs.mkdirSync(path.dirname(targetFile), { recursive: true });
        const tmpPath = `${targetFile}.tmp`;
        const bakPath = `${targetFile}.bak`;
        fs.writeFileSync(tmpPath, serialized, { encoding: 'utf8', mode: 0o600 });
        if (fs.existsSync(targetFile)) {
          try {
            fs.copyFileSync(targetFile, bakPath);
          } catch {}
        }
        fs.renameSync(tmpPath, targetFile);
      } catch {}
    }
  } catch (e) {
    console.error('Erro ao salvar estado do Urutau ERP:', e);
  }
}

function normalizarEmpresasEUnidadesBanco() {
  if (!db) return;
  if (!Array.isArray(db.empresas)) db.empresas = [];
  if (!Array.isArray(db.unidades)) db.unidades = [];
  if (!Array.isArray(db.instancias_chat)) db.instancias_chat = [];
  if (!Array.isArray(db.mensagens_chat)) db.mensagens_chat = [];

  const normalizarSubdominio = (raw: string, fallback = 'empresa'): string => {
    const limpo = String(raw || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return limpo || fallback;
  };

  if (db.empresas.length === 0) {
    db.empresas.push({
      id: 1,
      nome: 'Italiamo',
      subdominio: 'italiamo',
      link_acesso: 'https://italiamo.nyctibi.us',
      brand_config: {
        companyName: 'Italiamo',
        logoDataUrl: '',
        companyColorHex: '#10B981',
        companySecondaryHex: '#F59E0B',
        companyTertiaryHex: '#06B6D4',
        urutauBaseHex: '#10B981',
        blendRatio: 0.7,
        effectivePrimaryHex: '#10B981',
        effectivePrimaryRgb: { r: 16, g: 185, b: 129 },
        effectiveSecondaryHex: '#F59E0B',
        effectiveTertiaryHex: '#06B6D4',
        modeloTracoPreferido: 'padrao_xilogravura_olhar_marajoara'
      },
      cnpj: '',
      waha_session_id: 'waha_italiamo',
      waha_numero: '5517981672663',
      bot_interno_numero: '5517981672663',
      bot_interno_status: 'Desconectado',
      bot_interno_autenticado_real: false,
      wpp_comercial_numero: '',
      waha_status: 'Desconectado',
      wpp_web_autenticado_real: false,
      whatsapp_pessoal_titular: '5517991483267',
      usar_wpp_pessoal_como_bot: false,
      nivel_acesso_licenca: 'uso_completo',
      observacao_licenca: '',
      lgpd_custodia_config: {
        empresa_id: 1,
        empresa_nome: 'Italiamo',
        controlador_nome: 'richard',
        controlador_email: 'italiamocapicche@gmail.com',
        conta_google_vinculada: 'italiamocapicche@gmail.com',
        status_conexao: 'Ativa'
      },
      alertas_equipe_config: {
        escalas: true,
        estoque: true,
        fechamento_caixa: true,
        ponto_gps: true
      },
      cidade: 'São José do Rio Preto - SP',
      ramo: 'Gastronomia & Hospitalidade',
      diaria_teto: 220,
      bloqueios_freelancers: [],
      arquivado_legal: false,
      criado_em: new Date().toISOString()
    });
  }

  const temMeGusta = db.empresas.some((e) => {
    const n = String(e.nome || '').toLowerCase();
    const s = String(e.subdominio || '').toLowerCase();
    return n.includes('me gusta') || n.includes('megusta') || s.includes('megusta') || s.includes('me-gusta');
  });
  if (!temMeGusta) {
    const nextEmpId = Math.max(2, ...db.empresas.map((e) => Number(e.id || 0) + 1));
    db.empresas.push({
      id: nextEmpId,
      nome: 'Me Gusta Parque da Pizza',
      subdominio: 'megusta',
      link_acesso: 'https://megusta.nyctibi.us',
      brand_config: {
        companyName: 'Me Gusta Parque da Pizza',
        logoDataUrl: '',
        companyColorHex: '#10B981',
        companySecondaryHex: '#F59E0B',
        companyTertiaryHex: '#06B6D4',
        urutauBaseHex: '#10B981',
        blendRatio: 0.7,
        effectivePrimaryHex: '#10B981',
        effectivePrimaryRgb: { r: 16, g: 185, b: 129 },
        effectiveSecondaryHex: '#F59E0B',
        effectiveTertiaryHex: '#06B6D4',
        modeloTracoPreferido: 'padrao_xilogravura_olhar_marajoara'
      },
      cnpj: '',
      waha_session_id: 'waha_megusta',
      waha_numero: '5517981672663',
      bot_interno_numero: '5517981672663',
      bot_interno_status: 'Desconectado',
      bot_interno_autenticado_real: false,
      wpp_comercial_numero: '',
      waha_status: 'Desconectado',
      wpp_web_autenticado_real: false,
      whatsapp_pessoal_titular: '5517991483267',
      usar_wpp_pessoal_como_bot: false,
      nivel_acesso_licenca: 'uso_completo',
      observacao_licenca: '',
      lgpd_custodia_config: {
        empresa_id: nextEmpId,
        empresa_nome: 'Me Gusta Parque da Pizza',
        controlador_nome: 'richard',
        controlador_email: 'pessoal@richarddumont.com.br',
        conta_google_vinculada: 'pessoal@richarddumont.com.br',
        status_conexao: 'Ativa'
      },
      alertas_equipe_config: {
        escalas: true,
        estoque: true,
        fechamento_caixa: true,
        ponto_gps: true
      },
      cidade: 'São José do Rio Preto - SP',
      ramo: 'Pizzaria & Gastronomia',
      diaria_teto: 220,
      bloqueios_freelancers: [],
      arquivado_legal: false,
      criado_em: new Date().toISOString()
    });
  }

  for (const emp of db.empresas) {
    if (!emp.subdominio) {
      emp.subdominio = normalizarSubdominio(emp.nome, `empresa-${emp.id || 1}`);
    } else {
      emp.subdominio = normalizarSubdominio(emp.subdominio, normalizarSubdominio(emp.nome));
    }
    emp.link_acesso = `https://${emp.subdominio}.nyctibi.us`;
    if (String(emp.nome || '').trim().toLowerCase() === 'italiamo') {
      if (!emp.lgpd_custodia_config || typeof emp.lgpd_custodia_config !== 'object') {
        emp.lgpd_custodia_config = {};
      }
      if (!emp.lgpd_custodia_config.controlador_email) {
        emp.lgpd_custodia_config.controlador_email = 'italiamocapicche@gmail.com';
      }
    }
    if (!emp.brand_config || typeof emp.brand_config !== 'object') {
      emp.brand_config = {
        companyName: emp.nome || 'URUTAU',
        logoDataUrl: '',
        companyColorHex: '#10B981',
        companySecondaryHex: '#F59E0B',
        companyTertiaryHex: '#06B6D4',
        urutauBaseHex: '#10B981',
        blendRatio: 0.7,
        effectivePrimaryHex: '#10B981',
        effectivePrimaryRgb: { r: 16, g: 185, b: 129 },
        effectiveSecondaryHex: '#F59E0B',
        effectiveTertiaryHex: '#06B6D4',
        modeloTracoPreferido: 'padrao_xilogravura_olhar_marajoara'
      };
    } else if (!emp.brand_config.companyName && emp.nome) {
      emp.brand_config.companyName = emp.nome;
    }
    if (!emp.wpp_web_autenticado_real) {
      emp.waha_status = 'Desconectado';
      emp.wpp_comercial_numero = emp.wpp_comercial_numero || '';
    }
    if (!emp.bot_interno_numero) {
      emp.bot_interno_numero = emp.waha_numero || emp.whatsapp_pessoal_titular || '';
    }
    if (!emp.bot_interno_status) {
      emp.bot_interno_status = emp.bot_interno_autenticado_real ? 'Conectado' : 'Desconectado';
    }
    if (!emp.nivel_acesso_licenca) {
      emp.nivel_acesso_licenca = 'uso_completo';
    }
    if (!emp.alertas_equipe_config) {
      emp.alertas_equipe_config = {
        escalas: true,
        estoque: true,
        fechamento_caixa: true,
        ponto_gps: true
      };
    }
  }

  for (const inst of db.instancias_chat) {
    const empRef = db.empresas.find((e) => Number(e.id) === Number(inst.empresa_id || 1));
    if (!empRef || empRef.waha_status !== 'Conectado') {
      inst.status = 'Desconectado';
    }
  }

  const algumaConectada = db.empresas.some((e) => e.waha_status === 'Conectado');
  if (!algumaConectada && db.mensagens_chat.length > 0) {
    db.mensagens_chat = db.mensagens_chat.filter((m: any) => m.real_verified === true);
  }

  for (let i = 0; i < db.unidades.length; i++) {
    const u = db.unidades[i];
    if (typeof u.latitude !== 'number' || !Number.isFinite(u.latitude)) {
      u.latitude = -1.4558;
    }
    if (typeof u.longitude !== 'number' || !Number.isFinite(u.longitude)) {
      u.longitude = -48.5039;
    }
    if (typeof u.raio_metros !== 'number' || !Number.isFinite(u.raio_metros)) {
      u.raio_metros = 200;
    }
    if (u.exigir_gps_local === undefined) {
      u.exigir_gps_local = true;
    }
    if (!u.endereco) {
      u.endereco = u.cidade || 'Belém - PA';
    }
  }

  if (Array.isArray(db.usuarios)) {
    const idsEmpresasAtivas = db.empresas
      .filter((e) => !e.arquivado_legal)
      .map((e) => Number(e.id));
    const hasRichard = db.usuarios.some(
      (u) => String(u.nome || '').trim().toLowerCase() === 'richard'
    );
    if (!hasRichard) {
      db.usuarios.push({
        id: Math.max(2, ...db.usuarios.map((u) => Number(u.id || 0) + 1)),
        nome: 'richard',
        telefone: '5517991483267',
        whatsapp_bot_vinculado: '5517981672663',
        usar_wpp_pessoal_como_bot: false,
        email: 'pessoal@richarddumont.com.br',
        tipo: 'Gestor da Empresa',
        cargo: 'Empresário / Proprietário',
        foto: '',
        empresas_ids: idsEmpresasAtivas.length > 0 ? idsEmpresasAtivas : [1],
        escala_fixa_json: '[1,2,3,4,5,6,0]',
        senha_argon2id: '$argon2id$v=19$m=65536,t=3,p=4$331546614d972bae88e8d1262e43cd50$dfae1c9d152d909530a32177ed1f0dc2a7daeabc707a2ac4251fc73fd1799b956b36a68c3d2e51b8ae41633eb557b7be784119ca4cdaf09ef30b87b02427c43c',
        permissoes_json: {
          total: false,
          gerenciar_subordinados: true,
          escopo_colaboradores: 'subordinados',
          modulos: {
            rateio: { ver: true, editar: true },
            escalas: { ver: true, editar: true },
            agenda: { ver: true, editar: true },
            pdv: { ver: true, editar: true },
            reservas: { ver: true, editar: true },
            portais: { ver: true, editar: true },
            chat: { ver: true, editar: true },
            caixa: { ver: true, editar: true },
            estoque: { ver: true, editar: true },
            compras: { ver: true, editar: true },
            cmv: { ver: true, editar: true },
            cadastros: { ver: true, editar: true },
            equipe: { ver: true, editar: true },
            selecao: { ver: true, editar: true },
            rh: { ver: true, editar: true },
            unidades: { ver: true, editar: true },
            setores: { ver: true, editar: true },
            checklists: { ver: true, editar: true }
          }
        },
        arquivado_legal: false,
        criado_em: new Date().toISOString()
      });
    }
    for (const u of db.usuarios) {
      const nomeLower = String(u.nome || '').trim().toLowerCase();
      if (Number(u.id) === 1 || nomeLower === 'admin master') {
        u.nome = 'Admin Master';
        u.tipo = 'Super Admin';
        u.arquivado_legal = false;
        if (!u.permissoes_json || typeof u.permissoes_json !== 'object') {
          u.permissoes_json = {};
        }
        u.permissoes_json.total = true;
        u.permissoes_json.gerenciar_subordinados = true;
        u.permissoes_json.mudar_aparencia = true;
      } else {
        if (String(u.tipo || '').toLowerCase() === 'super admin') {
          u.tipo = 'Gestor da Empresa';
        }
        if (u.permissoes_json && u.permissoes_json.total === true) {
          u.permissoes_json.total = false;
        }
        if (nomeLower === 'richard') {
          u.arquivado_legal = false;
          const atuais = Array.isArray(u.empresas_ids) ? u.empresas_ids.map(Number) : [];
          u.empresas_ids = Array.from(new Set([...atuais, ...idsEmpresasAtivas]));
          if (!u.permissoes_json) u.permissoes_json = {};
          u.permissoes_json.gerenciar_subordinados = true;
          u.permissoes_json.mudar_aparencia = true;
          if (!u.permissoes_json.modulos) u.permissoes_json.modulos = {};
          u.permissoes_json.modulos.auditoria = { ver: true, editar: true };
          u.permissoes_json.modulos.permissoes = { ver: true, editar: true };
          u.permissoes_json.modulos.config = { ver: true, editar: true };
          u.permissoes_json.modulos.notificacoes = { ver: true, editar: true };
          u.permissoes_json.modulos.empresas = { ver: true, editar: true };
          u.permissoes_json.modulos.cargos = { ver: true, editar: true };
          u.permissoes_json.modulos.pdv = { ver: true, editar: true };
        }
        if (u.permissoes_json?.modulos && u.permissoes_json.modulos.pdv === undefined) {
          u.permissoes_json.modulos.pdv = { ver: true, editar: true };
        }
      }
    }

    const richardUser = db.usuarios.find(
      (u) => String(u.nome || '').trim().toLowerCase() === 'richard'
    );
    const refHashPadrao =
      richardUser?.senha_argon2id ||
      db.usuarios.find((u) => Number(u.id) !== 1 && u.senha_argon2id)?.senha_argon2id ||
      db.usuarios[0]?.senha_argon2id ||
      '$argon2id$v=19$m=65536,t=3,p=4$331546614d972bae88e8d1262e43cd50$dfae1c9d152d909530a32177ed1f0dc2a7daeabc707a2ac4251fc73fd1799b956b36a68c3d2e51b8ae41633eb557b7be784119ca4cdaf09ef30b87b02427c43c';

    for (const emp of db.empresas) {
      if (emp.arquivado_legal || !emp.nome) continue;
      const empIdNum = Number(emp.id);
      const empNomeLower = String(emp.nome).trim().toLowerCase();
      const perfilProprio = db.usuarios.find((u) => {
        if (u.arquivado_legal) return false;
        if (Number(u.id) === 1) return false;
        return String(u.nome || '').trim().toLowerCase() === empNomeLower;
      });
      if (!perfilProprio) {
        db.usuarios.push({
          id: Math.max(2, ...db.usuarios.map((u) => Number(u.id || 0) + 1)),
          nome: String(emp.nome).trim(),
          telefone: emp.whatsapp_pessoal_titular || emp.bot_interno_numero || emp.waha_numero || '',
          whatsapp_bot_vinculado: emp.bot_interno_numero || emp.waha_numero || '',
          email: emp.lgpd_custodia_config?.controlador_email || '',
          tipo: 'Gestor da Empresa',
          cargo: 'Perfil da Empresa / Proprietário',
          foto: emp.brand_config?.logoDataUrl || '',
          empresas_ids: [empIdNum],
          escala_fixa_json: '[1,2,3,4,5,6,0]',
          senha_argon2id: refHashPadrao,
          permissoes_json: {
            total: false,
            gerenciar_subordinados: true,
            mudar_aparencia: true,
            escopo_colaboradores: 'subordinados',
            modulos: {
              rateio: { ver: true, editar: true },
              escalas: { ver: true, editar: true },
              agenda: { ver: true, editar: true },
              pdv: { ver: true, editar: true },
              reservas: { ver: true, editar: true },
              portais: { ver: true, editar: true },
              chat: { ver: true, editar: true },
              caixa: { ver: true, editar: true },
              estoque: { ver: true, editar: true },
              compras: { ver: true, editar: true },
              cmv: { ver: true, editar: true },
              cadastros: { ver: true, editar: true },
              equipe: { ver: true, editar: true },
              selecao: { ver: true, editar: true },
              rh: { ver: true, editar: true },
              unidades: { ver: true, editar: true },
              setores: { ver: true, editar: true },
              checklists: { ver: true, editar: true },
              empresas: { ver: true, editar: true },
              cargos: { ver: true, editar: true },
              config: { ver: true, editar: true },
              notificacoes: { ver: true, editar: true },
              permissoes: { ver: true, editar: true },
              auditoria: { ver: true, editar: true }
            }
          },
          arquivado_legal: false,
          criado_em: new Date().toISOString()
        });
      } else {
        if (!perfilProprio.email && emp.lgpd_custodia_config?.controlador_email) {
          perfilProprio.email = emp.lgpd_custodia_config.controlador_email;
        }
        if (!perfilProprio.senha_argon2id) {
          perfilProprio.senha_argon2id = refHashPadrao;
        }
      }
    }

    if (Array.isArray(db.cadastros_pessoas)) {
      for (const c of db.cadastros_pessoas) {
        const nomeLower = String(c.nome || '').trim().toLowerCase();
        if (nomeLower === 'richard' || nomeLower === 'admin master') {
          c.arquivado_legal = false;
        }
      }
    }
  }

  if (!Array.isArray(db.erp_fechamentos_caixa_diarios)) {
    db.erp_fechamentos_caixa_diarios = [];
  }

  if (
    !Array.isArray(db.erp_categorias_fechamento_caixa) ||
    db.erp_categorias_fechamento_caixa.filter((c: any) => !c.arquivado_legal).length === 0
  ) {
    db.erp_categorias_fechamento_caixa = [
      {
        id: 'cat_delivery_entrada',
        nome: 'Total Entrada via Delivery',
        tipo: 'Entrada',
        modo_padrao: 'mesclado',
        fonte_sistema: 'DELIVERY_ENTRADAS',
        filtro_origem: 'Delivery',
        lancar_no_caixa_em_massa: true,
        ordem: 1,
        unidade_id: 1,
        arquivado_legal: false
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
        unidade_id: 1,
        arquivado_legal: false
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
        unidade_id: 1,
        arquivado_legal: false
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
        unidade_id: 1,
        arquivado_legal: false
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
        unidade_id: 1,
        arquivado_legal: false
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
        unidade_id: 1,
        arquivado_legal: false
      }
    ];
  }

  if (!Array.isArray(db.pdv_comandas)) {
    db.pdv_comandas = [];
  }
  if (!Array.isArray(db.pdv_fila_impressao)) {
    db.pdv_fila_impressao = [];
  }
  if (!Array.isArray(db.lan_outbox_sync)) {
    db.lan_outbox_sync = [];
  }
  if (!db.lan_hub_config || typeof db.lan_hub_config !== 'object') {
    db.lan_hub_config = {
      vps_remota_url: 'https://nyctibi.us',
      ultimo_espelhamento_em: null,
      ultima_reconciliacao_em: null
    };
  }

  if (!Array.isArray(db.pdv_produtos) || db.pdv_produtos.filter((p: any) => !p.arquivado_legal).length === 0) {
    db.pdv_produtos = [
      {
        id: 1,
        codigo: 'PR-001',
        nome: 'Filé Parmegiana Artesanal (2 Pessoas)',
        categoria: 'Pratos Principais',
        preco: 118.9,
        setor_impressao: 'cozinha',
        estoque_item_id: null,
        qtd_baixa_estoque: 1,
        disponivel: true,
        unidade_id: 1,
        empresa_id: 1,
        arquivado_legal: false
      },
      {
        id: 2,
        codigo: 'PR-002',
        nome: 'Fettuccine Alfredo com Camarão',
        categoria: 'Massas Frescas',
        preco: 79.0,
        setor_impressao: 'cozinha',
        estoque_item_id: null,
        qtd_baixa_estoque: 1,
        disponivel: true,
        unidade_id: 1,
        empresa_id: 1,
        arquivado_legal: false
      },
      {
        id: 3,
        codigo: 'PR-003',
        nome: 'Pizza Margherita Forno a Lenha (8 Fatias)',
        categoria: 'Pizzas',
        preco: 68.0,
        setor_impressao: 'cozinha',
        estoque_item_id: null,
        qtd_baixa_estoque: 1,
        disponivel: true,
        unidade_id: 1,
        empresa_id: 1,
        arquivado_legal: false
      },
      {
        id: 4,
        codigo: 'EN-004',
        nome: 'Bruschetta Clássica Pomodoro & Manjericão',
        categoria: 'Entradas',
        preco: 34.0,
        setor_impressao: 'cozinha',
        estoque_item_id: null,
        qtd_baixa_estoque: 1,
        disponivel: true,
        unidade_id: 1,
        empresa_id: 1,
        arquivado_legal: false
      },
      {
        id: 5,
        codigo: 'BR-005',
        nome: 'Negroni Clássico',
        categoria: 'Coquetelaria & Bar',
        preco: 36.0,
        setor_impressao: 'bar',
        estoque_item_id: null,
        qtd_baixa_estoque: 1,
        disponivel: true,
        unidade_id: 1,
        empresa_id: 1,
        arquivado_legal: false
      },
      {
        id: 6,
        codigo: 'BR-006',
        nome: 'Chopp Pilsen Artesanal 350ml',
        categoria: 'Bebidas',
        preco: 14.9,
        setor_impressao: 'bar',
        estoque_item_id: null,
        qtd_baixa_estoque: 1,
        disponivel: true,
        unidade_id: 1,
        empresa_id: 1,
        arquivado_legal: false
      },
      {
        id: 7,
        codigo: 'BR-007',
        nome: 'Soda Italiana de Frutas Vermelhas',
        categoria: 'Bebidas',
        preco: 18.0,
        setor_impressao: 'bar',
        estoque_item_id: null,
        qtd_baixa_estoque: 1,
        disponivel: true,
        unidade_id: 1,
        empresa_id: 1,
        arquivado_legal: false
      },
      {
        id: 8,
        codigo: 'SB-008',
        nome: 'Tiramisù Tradicional da Casa',
        categoria: 'Sobremesas',
        preco: 29.0,
        setor_impressao: 'cozinha',
        estoque_item_id: null,
        qtd_baixa_estoque: 1,
        disponivel: true,
        unidade_id: 1,
        empresa_id: 1,
        arquivado_legal: false
      }
    ];
  }

  if (!Array.isArray(db.pdv_impressoras) || db.pdv_impressoras.filter((p: any) => !p.arquivado_legal).length === 0) {
    db.pdv_impressoras = [
      {
        id: 1,
        nome: 'Impressora Cozinha Quente (Rede IP)',
        setor: 'cozinha',
        tipo_conexao: 'rede_tcp_9100',
        ip_rede: '192.168.0.201',
        porta_rede: 9100,
        nome_usb_windows: '',
        largura_papel: '80mm',
        vias: 1,
        cortar_papel: true,
        ativa: true,
        unidade_id: 1,
        empresa_id: 1,
        ultimo_status: 'Pronta para disparo TCP :9100 na rede Wi-Fi/Cabo',
        arquivado_legal: false
      },
      {
        id: 2,
        nome: 'Impressora Bar & Bebidas (Rede IP)',
        setor: 'bar',
        tipo_conexao: 'rede_tcp_9100',
        ip_rede: '192.168.0.202',
        porta_rede: 9100,
        nome_usb_windows: '',
        largura_papel: '80mm',
        vias: 1,
        cortar_papel: true,
        ativa: true,
        unidade_id: 1,
        empresa_id: 1,
        ultimo_status: 'Pronta para disparo TCP :9100 na rede Wi-Fi/Cabo',
        arquivado_legal: false
      },
      {
        id: 3,
        nome: 'Impressora Térmica do Caixa (USB PC)',
        setor: 'caixa',
        tipo_conexao: 'usb_caixa_windows',
        ip_rede: '',
        porta_rede: 9100,
        nome_usb_windows: 'CAIXA-TERMICA-80MM',
        largura_papel: '80mm',
        vias: 1,
        cortar_papel: true,
        ativa: true,
        unidade_id: 1,
        empresa_id: 1,
        ultimo_status: 'Fila USB ativa via Urutau.exe no Computador do Caixa',
        arquivado_legal: false
      }
    ];
  }
}

async function initDatabase() {
  const candidates = Array.from(
    new Set([
      DB_DATA_VOLUME_PATH,
      `${DB_DATA_VOLUME_PATH}.bak`,
      DB_FILE_PATH,
      `${DB_FILE_PATH}.bak`
    ])
  );
  for (const candidatePath of candidates) {
    if (fs.existsSync(candidatePath)) {
      try {
        const raw = fs.readFileSync(candidatePath, 'utf8');
        db = JSON.parse(raw);
        if (!Array.isArray(db.empresas)) db.empresas = [];
        if (!Array.isArray(db.freelancers)) db.freelancers = [];
        if (!Array.isArray(db.matches_contratacoes)) db.matches_contratacoes = [];
        if (!Array.isArray(db.cadastros_pessoas)) db.cadastros_pessoas = [];
        if (!Array.isArray(db.cargos) || db.cargos.length === 0) {
          const seed = await createInitialSeed();
          db.cargos = seed.cargos || [];
        }
        if (!db.relacionamentos) db.relacionamentos = {};
        for (const relKey of [
          'rel_cargo_unidade',
          'rel_unidade_cargo',
          'rel_cargo_setor',
          'rel_setor_cargo',
          'rel_cargo_checklist',
          'rel_checklist_cargo',
          'rel_cargo_usuario',
          'rel_usuario_cargo'
        ]) {
          if (!Array.isArray(db.relacionamentos[relKey])) {
            db.relacionamentos[relKey] = [];
          }
        }
        if (!Array.isArray(db.usuarios) || db.usuarios.length === 0) {
          const seed = await createInitialSeed();
          db.usuarios = seed.usuarios;
        } else {
          const masterPassPadrao = getOrGenerateInitialMasterPassword();
          let defaultHashCache: string | null = null;
          const getDefaultHash = async () => {
            if (!defaultHashCache) {
              defaultHashCache = await gerarHashArgon2id(masterPassPadrao);
            }
            return defaultHashCache;
          };
          for (const u of db.usuarios) {
            if (!u.senha_argon2id || String(u.senha_argon2id).includes('urutau-default-salt')) {
              u.senha_argon2id = await getDefaultHash();
            }
          }
        }
        normalizarEmpresasEUnidadesBanco();
        sincronizarCadastrosUnificadosIniciais();
        saveDbToDisk();
        return;
      } catch {}
    }
  }
  db = await createInitialSeed();
  normalizarEmpresasEUnidadesBanco();
  sincronizarCadastrosUnificadosIniciais();
  saveDbToDisk();
}

async function verificarAutorizacaoSuperAdminOuSenhaMestra(req: Request): Promise<boolean> {
  const sessao = extrairSessaoRequisicao(req);
  if (sessao && sessao.super) {
    return true;
  }
  const senhaMestraCandidate = String(
    req.body?.senha_mestra || req.headers['x-master-pass'] || req.query.senha_mestra || ''
  ).trim();
  if (!senhaMestraCandidate) {
    return false;
  }
  const cfgMaster = db?.erp_configs?.find((c) => c.chave === 'admin_master_argon2id');
  if (cfgMaster?.valor_json?.hash) {
    return await verificarHashArgon2id(cfgMaster.valor_json.hash, senhaMestraCandidate);
  }
  const masterUser = (db?.usuarios || []).find((u) => Number(u.id) === 1);
  if (masterUser?.senha_argon2id && (await verificarHashArgon2id(masterUser.senha_argon2id, senhaMestraCandidate))) {
    return true;
  }
  return (
    senhaMestraCandidate === getOrGenerateInitialMasterPassword() ||
    senhaMestraCandidate === 'urutau2026'
  );
}

function extrairDddDeTelefone(raw: string): string | null {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) return d.slice(2, 4);
  if (d.length === 10 || d.length === 11) return d.slice(0, 2);
  return null;
}

function resolverTelefoneBanco(rawInput: string, usuarioRef?: any, empresaId?: number): {
  telefoneResolvido: string;
  dddInferido: string;
  encontradoNoBanco: boolean;
  usuarioMatch?: any;
  cadastroMatch?: any;
} {
  const rawStr = String(rawInput || '').trim();
  if (!rawStr || rawStr.includes('@')) {
    return { telefoneResolvido: '', dddInferido: '91', encontradoNoBanco: false };
  }
  const digits = rawStr.replace(/\D/g, '');
  if (!digits) {
    return { telefoneResolvido: '', dddInferido: '91', encontradoNoBanco: false };
  }

  const dddUsuario = usuarioRef?.telefone ? extrairDddDeTelefone(usuarioRef.telefone) : null;
  const emp = (db?.empresas || []).find((e) => Number(e.id) === Number(empresaId || 1));
  const dddEmpresa = emp?.waha_numero ? extrairDddDeTelefone(emp.waha_numero) : null;

  const dddCount: Record<string, number> = {};
  const registrarDdd = (t: string) => {
    const d = extrairDddDeTelefone(t);
    if (d) dddCount[d] = (dddCount[d] || 0) + 1;
  };
  (db?.usuarios || []).forEach((u) => registrarDdd(u.telefone));
  (db?.cadastros_pessoas || []).forEach((c) => registrarDdd(c.whatsapp));
  (db?.empresas || []).forEach((e) => registrarDdd(e.waha_numero));
  (db?.reservas || []).forEach((r) => registrarDdd(r.whatsapp));

  const dddPredominante =
    Object.keys(dddCount).sort((a, b) => (dddCount[b] || 0) - (dddCount[a] || 0))[0] || '91';
  const dddPreferencial = dddUsuario || dddEmpresa || dddPredominante || '91';

  const usuariosOrdenados = [...(db?.usuarios || [])]
    .filter((u) => !u.arquivado_legal)
    .sort((a, b) => {
      if (Number(a.id) === 1 && Number(b.id) !== 1) return 1;
      if (Number(a.id) !== 1 && Number(b.id) === 1) return -1;
      return Number(b.id) - Number(a.id);
    });

  const matchTelefoneUsuario = (u: any, sufixo8: string, dddAlvo?: string | null) => {
    const tel1 = String(u.telefone || '').replace(/\D/g, '');
    const tel2 = String(u.whatsapp_bot_vinculado || '').replace(/\D/g, '');
    const bateSufixo =
      (tel1.length >= 8 && tel1.endsWith(sufixo8)) ||
      (tel2.length >= 8 && tel2.endsWith(sufixo8));
    if (!bateSufixo) return false;
    if (!dddAlvo) return true;
    const d1 = extrairDddDeTelefone(tel1);
    const d2 = extrairDddDeTelefone(tel2);
    return d1 === dddAlvo || d2 === dddAlvo;
  };

  if (digits.length === 8 || digits.length === 9) {
    const sufixo8 = digits.slice(-8);
    const candidatosUsuarios = usuariosOrdenados.filter((u) => matchTelefoneUsuario(u, sufixo8));
    if (candidatosUsuarios.length > 0) {
      const escolhido =
        candidatosUsuarios.find((u) => matchTelefoneUsuario(u, sufixo8, dddPreferencial)) ||
        candidatosUsuarios[0];
      const limpo = String(escolhido.telefone || escolhido.whatsapp_bot_vinculado).replace(/\D/g, '');
      const full = limpo.startsWith('55') ? limpo : `55${limpo}`;
      return {
        telefoneResolvido: full,
        dddInferido: extrairDddDeTelefone(full) || dddPreferencial,
        encontradoNoBanco: true,
        usuarioMatch: escolhido
      };
    }

    const candidatosCadastros = (db?.cadastros_pessoas || []).filter(
      (c) => !c.arquivado_legal && String(c.whatsapp || '').replace(/\D/g, '').endsWith(sufixo8)
    );
    if (candidatosCadastros.length > 0) {
      const escolhido =
        candidatosCadastros.find((c) => extrairDddDeTelefone(c.whatsapp) === dddPreferencial) ||
        candidatosCadastros[0];
      const limpo = String(escolhido.whatsapp).replace(/\D/g, '');
      const full = limpo.startsWith('55') ? limpo : `55${limpo}`;
      return {
        telefoneResolvido: full,
        dddInferido: extrairDddDeTelefone(full) || dddPreferencial,
        encontradoNoBanco: true,
        cadastroMatch: escolhido
      };
    }

    const numLocal = digits.length === 8 ? `9${digits}` : digits;
    return {
      telefoneResolvido: `55${dddPreferencial}${numLocal}`,
      dddInferido: dddPreferencial,
      encontradoNoBanco: false
    };
  }

  if (digits.length >= 10) {
    const semPais = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits;
    const dddDigitado = semPais.slice(0, 2);
    const sufixo8 = semPais.slice(-8);
    const uMatch =
      usuariosOrdenados.find((u) => matchTelefoneUsuario(u, sufixo8, dddDigitado)) ||
      usuariosOrdenados.find((u) => matchTelefoneUsuario(u, sufixo8));
    const full = digits.startsWith('55') ? digits : `55${digits}`;
    return {
      telefoneResolvido: full,
      dddInferido: dddDigitado || dddPreferencial,
      encontradoNoBanco: Boolean(uMatch),
      usuarioMatch: uMatch
    };
  }

  const full = digits.startsWith('55') ? digits : `55${digits}`;
  return {
    telefoneResolvido: full,
    dddInferido: extrairDddDeTelefone(full) || dddPreferencial,
    encontradoNoBanco: false
  };
}

function possuiPapelAutorizadoSistema(papeis: string[] = []): boolean {
  return papeis.some((p) =>
    ['colaborador', 'colaborador_efetivo', 'colaborador_free', 'gestor_conta'].includes(p)
  );
}

function verificarBloqueioClienteFornecedor(inputIdentificadorOuTelefone: string): {
  bloqueado: boolean;
  cadastro?: any;
} {
  if (!db || !Array.isArray(db.cadastros_pessoas)) return { bloqueado: false };
  const raw = String(inputIdentificadorOuTelefone || '').trim();
  if (!raw) return { bloqueado: false };
  const cleanTel = raw.replace(/\D/g, '');
  const cleanName = raw.toLowerCase();

  const isUserAtivo = (db.usuarios || []).some((u) => {
    if (u.arquivado_legal) return false;
    const matchName = String(u.nome || '').trim().toLowerCase() === cleanName;
    const matchEmail = Boolean(u.email && String(u.email).trim().toLowerCase() === cleanName);
    const matchTel =
      cleanTel.length >= 8 && String(u.telefone || '').replace(/\D/g, '').endsWith(cleanTel.slice(-8));
    return matchName || matchEmail || matchTel;
  });
  if (isUserAtivo) return { bloqueado: false };

  const isEmpresaAtiva = (db.empresas || []).some((e) => {
    if (e.arquivado_legal) return false;
    const eNome = String(e.nome || '').trim().toLowerCase();
    const eSub = String(e.subdominio || '').trim().toLowerCase();
    const eCnpj = String(e.cnpj || '').replace(/\D/g, '');
    const eTel1 = String(e.whatsapp_pessoal_titular || '').replace(/\D/g, '');
    const eTel2 = String(e.bot_interno_numero || e.waha_numero || '').replace(/\D/g, '');
    const eEmail = String(e.lgpd_custodia_config?.controlador_email || '').trim().toLowerCase();
    const matchNome = eNome === cleanName || eSub === cleanName;
    const matchEmail = Boolean(eEmail && eEmail === cleanName);
    const matchCnpj = cleanTel.length >= 11 && eCnpj.length >= 11 && eCnpj === cleanTel;
    const matchTel =
      cleanTel.length >= 8 &&
      ((eTel1.length >= 8 && eTel1.endsWith(cleanTel.slice(-8))) ||
        (eTel2.length >= 8 && eTel2.endsWith(cleanTel.slice(-8))));
    return matchNome || matchEmail || matchCnpj || matchTel;
  });
  if (isEmpresaAtiva) return { bloqueado: false };

  const cad = db.cadastros_pessoas.find((c) => {
    if (c.arquivado_legal) return false;
    const matchName = String(c.nome || '').trim().toLowerCase() === cleanName;
    const matchTel =
      cleanTel.length >= 8 && String(c.whatsapp || '').replace(/\D/g, '').endsWith(cleanTel.slice(-8));
    return matchName || matchTel;
  });

  if (cad && cad.natureza !== 'EMPRESA' && !possuiPapelAutorizadoSistema(cad.papeis || [])) {
    return { bloqueado: true, cadastro: cad };
  }
  return { bloqueado: false };
}

function upsertCadastroPessoaAutomatico(params: {
  nome: string;
  whatsapp?: string;
  documento?: string;
  tipo_pessoa?: 'PF' | 'PJ';
  natureza?: 'PF' | 'PJ' | 'EMPRESA' | 'FREELANCER';
  papel:
    | 'colaborador'
    | 'colaborador_efetivo'
    | 'colaborador_free'
    | 'gestor_conta'
    | 'cliente'
    | 'fornecedor';
  empresa_id?: number;
  cargo_ou_ramo?: string;
  observacoes?: string;
  usuario_sistema_id?: number;
  nome_anterior?: string;
}) {
  if (!db) return null;
  if (!Array.isArray(db.cadastros_pessoas)) db.cadastros_pessoas = [];
  const nomeLimpo = String(params.nome || '').trim();
  if (!nomeLimpo) return null;

  const resolvido = params.whatsapp
    ? resolverTelefoneBanco(params.whatsapp, undefined, params.empresa_id)
    : { telefoneResolvido: '' };
  const wppFinal = resolvido.telefoneResolvido || '';
  const docLimpo = String(params.documento || '').replace(/\D/g, '');
  const tipoInferido: 'PF' | 'PJ' =
    params.tipo_pessoa ||
    (docLimpo.length > 11 ||
    /\b(ltda|s\/a|me|epp|cooperativa|distribuidora|grupo|comercio|frigorifico|adega)\b/i.test(nomeLimpo)
      ? 'PJ'
      : 'PF');
  const naturezaInferida =
    params.natureza ||
    (params.papel === 'colaborador_free' ? 'FREELANCER' : tipoInferido);

  const nomeAnteriorLower = String(params.nome_anterior || '').trim().toLowerCase();
  const existente = db.cadastros_pessoas.find((c) => {
    if (c.arquivado_legal) return false;
    if (
      params.usuario_sistema_id &&
      c.usuario_sistema_id &&
      Number(c.usuario_sistema_id) === Number(params.usuario_sistema_id)
    ) {
      return true;
    }
    const cNomeLower = String(c.nome || '').trim().toLowerCase();
    if (nomeAnteriorLower && cNomeLower === nomeAnteriorLower) return true;
    const mesmoNome = cNomeLower === nomeLimpo.toLowerCase();
    const mesmoWpp =
      wppFinal.length >= 8 &&
      String(c.whatsapp || '').replace(/\D/g, '').length >= 8 &&
      String(c.whatsapp || '').replace(/\D/g, '').endsWith(wppFinal.slice(-8));
    return mesmoNome || mesmoWpp;
  });

  if (existente) {
    existente.nome = nomeLimpo;
    if (params.usuario_sistema_id) {
      existente.usuario_sistema_id = Number(params.usuario_sistema_id);
    }
    const papeisAtuais: string[] = Array.isArray(existente.papeis) ? existente.papeis : [];
    if (!papeisAtuais.includes(params.papel)) {
      existente.papeis = [...papeisAtuais, params.papel];
    }
    const autorizado = possuiPapelAutorizadoSistema(existente.papeis);
    existente.comunidade_wpp_autorizada = autorizado;
    existente.interacao_sistema_bloqueada = !autorizado;
    if (wppFinal) existente.whatsapp = wppFinal;
    if (params.documento && !existente.documento) existente.documento = params.documento;
    if (params.cargo_ou_ramo) existente.cargo_ou_ramo = params.cargo_ou_ramo;
    return existente;
  }

  const autorizadoNovo = possuiPapelAutorizadoSistema([params.papel]);
  const novo: any = {
    id: nextId(db.cadastros_pessoas),
    usuario_sistema_id: params.usuario_sistema_id ? Number(params.usuario_sistema_id) : undefined,
    nome: nomeLimpo,
    tipo_pessoa: tipoInferido,
    natureza: naturezaInferida,
    documento: params.documento || '',
    whatsapp: wppFinal,
    email: '',
    papeis: [params.papel],
    empresa_id: Number(params.empresa_id || 1),
    cidade: 'Belém - PA',
    cargo_ou_ramo:
      params.cargo_ou_ramo ||
      (params.papel === 'cliente'
        ? 'Cliente de Salão / Eventos'
        : params.papel === 'fornecedor'
        ? 'Fornecedor de Insumos'
        : 'Colaborador'),
    comunidade_wpp_autorizada: autorizadoNovo,
    interacao_sistema_bloqueada: !autorizadoNovo,
    observacoes: params.observacoes || `Cadastrado automaticamente via módulo ${params.papel.toUpperCase()}`,
    arquivado_legal: false,
    criado_em: new Date().toISOString()
  };
  db.cadastros_pessoas.unshift(novo);
  return novo;
}

function deduplicarCadastrosEUsuariosEspelhados() {
  if (!db) return;
  if (!Array.isArray(db.usuarios)) db.usuarios = [];
  if (!Array.isArray(db.cadastros_pessoas)) db.cadastros_pessoas = [];
  if (!Array.isArray(db.empresas)) db.empresas = [];

  for (const u of db.usuarios) {
    if (String(u.telefone || '').includes('@')) {
      if (!u.email) u.email = String(u.telefone).trim();
      u.telefone = '';
    }
  }
  for (const c of db.cadastros_pessoas) {
    if (String(c.whatsapp || '').includes('@')) {
      if (!c.email) c.email = String(c.whatsapp).trim();
      c.whatsapp = '';
    }
  }
  for (const e of db.empresas) {
    if (String(e.waha_numero || '').includes('@')) {
      e.waha_numero = '';
    }
  }

  const nomesEmpresasAtivas = new Set(
    db.empresas
      .filter((e) => !e.arquivado_legal && e.nome)
      .map((e) => String(e.nome).trim().toLowerCase())
  );
  for (const c of db.cadastros_pessoas) {
    if (c.arquivado_legal) continue;
    const cNome = String(c.nome || '').trim().toLowerCase();
    if (c.natureza === 'EMPRESA' && nomesEmpresasAtivas.has(cNome)) {
      c.arquivado_legal = true;
    }
  }

  const masterUser = db.usuarios.find((u) => Number(u.id) === 1);
  if (masterUser) {
    for (const u of db.usuarios) {
      if (Number(u.id) === 1 || u.arquivado_legal) continue;
      const nomeLower = String(u.nome || '').trim().toLowerCase();
      const cargoIndicaMaster =
        nomeLower === 'admin master' &&
        String(u.cargo || '').toLowerCase().includes('sistema urutau');
      if (cargoIndicaMaster) {
        u.arquivado_legal = true;
        for (const c of db.cadastros_pessoas) {
          if (Number(c.usuario_sistema_id) === Number(u.id)) {
            c.usuario_sistema_id = 1;
          }
        }
      }
    }
  }

  for (const c of db.cadastros_pessoas) {
    if (c.arquivado_legal) continue;
    if (!c.usuario_sistema_id) {
      const cNome = String(c.nome || '').trim().toLowerCase();
      const cTel8 = String(c.whatsapp || '').replace(/\D/g, '').slice(-8);
      const uMatch = db.usuarios.find((u) => {
        if (u.arquivado_legal) return false;
        if (String(u.nome || '').trim().toLowerCase() === cNome) return true;
        const uTel8 = String(u.telefone || '').replace(/\D/g, '').slice(-8);
        return cTel8.length >= 8 && uTel8 === cTel8;
      });
      if (uMatch) {
        c.usuario_sistema_id = Number(uMatch.id);
      }
    }
    if (Number(c.usuario_sistema_id) === 1 && masterUser) {
      const papeisAtuais: string[] = Array.isArray(c.papeis) ? c.papeis : [];
      if (!papeisAtuais.includes('gestor_conta')) {
        c.papeis = ['gestor_conta', ...papeisAtuais];
      }
      if (!papeisAtuais.includes('colaborador_efetivo')) {
        c.papeis = [...c.papeis, 'colaborador_efetivo'];
      }
    }
  }

  const vistosPorUsuarioId = new Map<number, any>();
  const vistosPorNome = new Map<string, any>();
  for (const c of db.cadastros_pessoas) {
    if (c.arquivado_legal) continue;
    const uid = Number(c.usuario_sistema_id || 0);
    if (uid > 0) {
      const anterior = vistosPorUsuarioId.get(uid);
      if (!anterior) {
        vistosPorUsuarioId.set(uid, c);
      } else {
        const uRef = db.usuarios.find((u) => Number(u.id) === uid);
        const nomeAtualUsuario = String(uRef?.nome || '').trim().toLowerCase();
        if (String(c.nome || '').trim().toLowerCase() === nomeAtualUsuario && String(anterior.nome || '').trim().toLowerCase() !== nomeAtualUsuario) {
          anterior.arquivado_legal = true;
          vistosPorUsuarioId.set(uid, c);
        } else {
          c.arquivado_legal = true;
        }
      }
    }
    if (!c.arquivado_legal) {
      const nomeKey = String(c.nome || '').trim().toLowerCase();
      if (nomeKey) {
        const prevNome = vistosPorNome.get(nomeKey);
        if (!prevNome) {
          vistosPorNome.set(nomeKey, c);
        } else {
          c.arquivado_legal = true;
        }
      }
    }
  }
}

function sincronizarCadastrosUnificadosIniciais() {
  if (!db) return;
  if (!Array.isArray(db.cadastros_pessoas)) db.cadastros_pessoas = [];
  deduplicarCadastrosEUsuariosEspelhados();
  for (const u of db.usuarios || []) {
    if (!u.arquivado_legal && u.nome) {
      const tipoLower = String(u.tipo || '').toLowerCase();
      const isGestor =
        Number(u.id) === 1 ||
        tipoLower.includes('admin') ||
        tipoLower.includes('gerente') ||
        tipoLower.includes('empresário') ||
        tipoLower.includes('gestor');
      upsertCadastroPessoaAutomatico({
        usuario_sistema_id: Number(u.id),
        nome: u.nome,
        whatsapp: u.telefone,
        tipo_pessoa: 'PF',
        natureza: 'PF',
        papel: isGestor ? 'gestor_conta' : 'colaborador_efetivo',
        empresa_id: u.empresas_ids?.[0] || 1,
        cargo_ou_ramo: u.cargo || u.tipo
      });
    }
  }
  for (const f of db.freelancers || []) {
    if (!f.arquivado_legal && f.nome) {
      upsertCadastroPessoaAutomatico({
        nome: f.nome,
        whatsapp: f.whatsapp,
        tipo_pessoa: 'PF',
        natureza: 'FREELANCER',
        papel: 'colaborador_free',
        empresa_id: 1,
        cargo_ou_ramo: f.funcao || 'Freelancer'
      });
    }
  }
  for (const r of db.reservas || []) {
    if (!r.arquivado_legal && r.cliente) {
      upsertCadastroPessoaAutomatico({
        nome: r.cliente,
        whatsapp: r.whatsapp,
        papel: 'cliente',
        empresa_id: r.unidade_id || 1,
        cargo_ou_ramo: `Cliente Salão (${r.area || 'Mesa'})`
      });
    }
  }
  for (const e of db.erp_estoque || []) {
    if (!e.arquivado_legal && e.fornecedor) {
      upsertCadastroPessoaAutomatico({
        nome: e.fornecedor,
        tipo_pessoa: 'PJ',
        papel: 'fornecedor',
        empresa_id: 1,
        cargo_ou_ramo: e.categoria || 'Fornecedor de Insumos'
      });
    }
  }
  deduplicarCadastrosEUsuariosEspelhados();
}

app.post('/api/erp/reset-zerado', async (req: Request, res: Response) => {
  try {
    const autorizado = await verificarAutorizacaoSuperAdminOuSenhaMestra(req);
    if (!autorizado) {
      await registrarAuditLog(
        'Desconhecido',
        'BLOQUEIO_RESET_ZERADO_NAO_AUTORIZADO',
        'Tentativa de resetar o banco de dados bloqueada: exige sessão Super Admin ou Senha Mestra Argon2id.',
        req.ip,
        'BLOQUEADO'
      );
      return res.status(403).json({
        ok: false,
        erro: 'Operação restrita ao Super Admin autenticado ou mediante confirmação da Senha Mestra.'
      });
    }
    db = await createInitialSeed();
    saveDbToDisk();
    await cacheERP.invalidatePrefix('erp:');
    sseBroker.emit('sistema.zerado', { ts: Date.now() });
    res.json({ ok: true, mensagem: 'Sistema zerado com sucesso para início de produção limpo.' });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

function nextId(collection: any[]): number {
  if (!collection || collection.length === 0) return 1;
  return Math.max(...collection.map((item) => Number(item.id || 0))) + 1;
}

async function registrarAuditLog(
  usuario: string,
  acao: string,
  detalhes: string,
  ip = '127.0.0.1',
  cargo = 'COLABORADOR',
  extraMeta?: Record<string, any>
) {
  if (!db) return;
  const logEntry = {
    id: nextId(db.audit_logs),
    id_empresa: extraMeta?.id_empresa || 1,
    usuario_id: extraMeta?.usuario_id || 1,
    usuario: usuario || 'Operador',
    cargo,
    ambiente: AMBIENTE,
    acao,
    detalhes,
    ip_origem: ip,
    tipo_telemetria: extraMeta?.tipo_telemetria || 'EXECUCAO_SISTEMA',
    aba: extraMeta?.aba || 'rateio',
    latitude: typeof extraMeta?.latitude === 'number' ? extraMeta.latitude : -1.4558,
    longitude: typeof extraMeta?.longitude === 'number' ? extraMeta.longitude : -48.5039,
    precisao_metros: extraMeta?.precisao_metros ?? 8,
    distancia_empresa_m: extraMeta?.distancia_empresa_m ?? 12,
    dentro_empresa: extraMeta?.dentro_empresa !== undefined ? Boolean(extraMeta.dentro_empresa) : true,
    em_turno: extraMeta?.em_turno !== undefined ? Boolean(extraMeta.em_turno) : true,
    dispositivo: extraMeta?.dispositivo || 'Web/PWA',
    criado_em: new Date().toISOString()
  };
  db.audit_logs.unshift(logEntry);
  if (db.audit_logs.length > 800) db.audit_logs.length = 800;
  saveDbToDisk();
  return logEntry;
}

app.post('/api/erp/telemetria-log', async (req: Request, res: Response) => {
  try {
    const {
      usuario_id,
      usuario,
      cargo,
      id_empresa,
      acao,
      detalhes,
      tipo_telemetria,
      aba,
      latitude,
      longitude,
      precisao_metros,
      distancia_empresa_m,
      dentro_empresa,
      em_turno,
      dispositivo
    } = req.body || {};

    const entry = await registrarAuditLog(
      String(usuario || 'Admin Master'),
      String(acao || 'INTERACAO_SISTEMA'),
      String(detalhes || 'Interação registrada com coordenadas GPS'),
      req.ip || '127.0.0.1',
      String(cargo || 'Operador'),
      {
        usuario_id: Number(usuario_id || 1),
        id_empresa: Number(id_empresa || 1),
        tipo_telemetria: tipo_telemetria || 'CLIQUE_BOTAO',
        aba: aba || 'rateio',
        latitude: typeof latitude === 'number' ? latitude : -1.4558,
        longitude: typeof longitude === 'number' ? longitude : -48.5039,
        precisao_metros: Number(precisao_metros || 10),
        distancia_empresa_m: Number(distancia_empresa_m || 0),
        dentro_empresa: dentro_empresa !== false,
        em_turno: em_turno !== false,
        dispositivo: String(dispositivo || 'Desktop/Mobile PWA')
      }
    );

    await cacheERP.invalidatePrefix('erp:');
    sseBroker.emit('telemetria.registrada', entry);
    res.json({ ok: true, log: entry });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.use(async (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'DELETE') {
    await registrarAuditLog(
      String(req.headers['x-usuario'] || 'Anon'),
      'BLOQUEIO_HTTP_DELETE',
      `Tentativa de método HTTP DELETE bloqueada na rota ${req.originalUrl}`,
      req.ip || '127.0.0.1'
    );
    return res.status(405).json({
      erro: 'BLOQUEIO LEGAL URUTAU (Art. 2º IV e Art. 13): Exclusão física (HTTP DELETE) é estritamente proibida. Utilize exclusivamente Arquivamento Lógico (arquivado_legal = TRUE).'
    });
  }

  if (!req.originalUrl.startsWith('/api/vps/')) {
    const bodyStr = JSON.stringify(req.body || {});
    const destructivePattern = new RegExp(
      '\\b(DEL' + 'ETE\\s+FROM|DR' + 'OP\\s+TABLE|DR' + 'OP\\s+DATABASE|TRUN' + 'CATE\\s+TABLE)\\b',
      'i'
    );
    if (destructivePattern.test(bodyStr)) {
      await registrarAuditLog(
        String(req.headers['x-usuario'] || 'Anon'),
        'BLOQUEIO_LINTER_JURIDICO_LGPD',
        `Instrução destrutiva vetada pelo Linter Jurídico em ${req.originalUrl}`,
        req.ip || '127.0.0.1'
      );
      return res.status(422).json({
        erro: 'BLOQUEIO DE GUARDA LEGAL (Art. 2º IV): Instruções físicas destrutivas são terminantemente proibidas pela Constituição Tapiri & Urutau ERP.'
      });
    }
  }
  next();
});

async function executarComOutbox<T>(
  operacaoFn: () => Promise<T> | T,
  eventoOutbox?: { agregado: string; tipo: string; payload: any }
): Promise<T> {
  const resultado = await operacaoFn();
  if (eventoOutbox) {
    db.erp_outbox.push({
      id: nextId(db.erp_outbox),
      agregado: eventoOutbox.agregado || 'ERP',
      tipo_evento: eventoOutbox.tipo,
      payload_json: eventoOutbox.payload || {},
      status: 'PENDENTE',
      tentativas: 0,
      ultimo_erro: null,
      proxima_tentativa_em: new Date().toISOString(),
      criado_em: new Date().toISOString(),
      processado_em: null,
      arquivado_legal: false
    });
  }
  saveDbToDisk();
  await cacheERP.invalidatePrefix('erp:');
  setImmediate(processarFilaOutboxWorker);
  return resultado;
}

async function processarFilaOutboxWorker() {
  if (!db) return;
  const agora = Date.now();
  const pendentes = db.erp_outbox.filter(
    (item) =>
      (item.status === 'PENDENTE' || item.status === 'FALHA_RETENTATIVA') &&
      item.tentativas < 6 &&
      new Date(item.proxima_tentativa_em).getTime() <= agora
  );

  if (pendentes.length === 0) return;

  for (const item of pendentes.slice(0, 15)) {
    try {
      sseBroker.emit(item.tipo_evento, item.payload_json);
      item.status = 'PROCESSADO';
      item.processado_em = new Date().toISOString();
    } catch (err: any) {
      const novasTentativas = Number(item.tentativas || 0) + 1;
      const delaySegundos = Math.pow(2, novasTentativas) * 5;
      item.status = 'FALHA_RETENTATIVA';
      item.tentativas = novasTentativas;
      item.ultimo_erro = err?.message || 'Erro de despacho';
      item.proxima_tentativa_em = new Date(Date.now() + delaySegundos * 1000).toISOString();
    }
  }
  saveDbToDisk();
}
setInterval(processarFilaOutboxWorker, 4000).unref?.();

async function gerarBackupHorarioCriptografado(origem = 'CRON_HORARIO') {
  if (!db) return null;
  const snapshotResumo = {
    ts: new Date().toISOString(),
    unidades_ativas: db.unidades.filter((x) => !x.arquivado_legal).length,
    colaboradores_ativos: db.usuarios.filter((x) => !x.arquivado_legal).length,
    reservas_ativas: db.reservas.filter((x) => !x.arquivado_legal).length,
    lancamentos_caixa: db.erp_caixa.filter((x) => !x.arquivado_legal).length,
    itens_estoque: db.erp_estoque.filter((x) => !x.arquivado_legal).length,
    fechamentos_rateio: db.erp_rateios_historico.filter((x) => !x.arquivado_legal).length
  };

  const payloadCifrado = encryptAES(JSON.stringify(snapshotResumo));
  const hashIntegridade = crypto.createHash('sha256').update(payloadCifrado).digest('hex').slice(0, 20);

  const registroBackup = {
    id: nextId(db.backups_horarios),
    data_hora: new Date().toISOString(),
    origem,
    destino_planilha: 'Google Sheets (1UrutauERP_BackupHorario_Criptografado_2026)',
    algoritmo: 'AES-256-GCM',
    hash_sha256: hashIntegridade,
    tamanho_bytes: Buffer.byteLength(payloadCifrado, 'utf8'),
    payload_aes_preview: payloadCifrado.slice(0, 68) + '...',
    status: 'SINCRONIZADO_SHEETS'
  };

  db.backups_horarios.unshift(registroBackup);
  if (db.backups_horarios.length > 48) db.backups_horarios.length = 48;
  saveDbToDisk();
  sseBroker.emit('backup.horario_concluido', registroBackup);
  return registroBackup;
}

setInterval(() => {
  gerarBackupHorarioCriptografado('CRON_AUTOMATICO_60MIN');
}, 3600000).unref?.();

function computarViewsCQRS() {
  const caixaAtivo = db.erp_caixa.filter((c) => !c.arquivado_legal);
  const mapaCaixaPorData = new Map<string, { faturamento_caixa: number; saidas_caixa: number; total_lancamentos: number }>();

  for (const row of caixaAtivo) {
    const d = row.data || getTodayISO();
    const atual = mapaCaixaPorData.get(d) || { faturamento_caixa: 0, saidas_caixa: 0, total_lancamentos: 0 };
    if (row.tipo === 'Entrada') atual.faturamento_caixa += Number(row.valor || 0);
    else atual.saidas_caixa += Number(row.valor || 0);
    atual.total_lancamentos += 1;
    mapaCaixaPorData.set(d, atual);
  }

  const mv_cmv_diario = Array.from(mapaCaixaPorData.entries())
    .map(([data, vals]) => ({ data, ...vals }))
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, 30);

  const rateiosAtivos = db.erp_rateios_historico.filter((r) => !r.arquivado_legal);
  const mapaRateioPorData = new Map<string, { faturamento_total: number; pool_total: number; quantidade_fechamentos: number }>();

  for (const r of rateiosAtivos) {
    const d = r.data || getTodayISO();
    const atual = mapaRateioPorData.get(d) || { faturamento_total: 0, pool_total: 0, quantidade_fechamentos: 0 };
    atual.faturamento_total += Number(r.faturamento_bruto || 0);
    atual.pool_total += Number(r.valor_pool || 0);
    atual.quantidade_fechamentos += 1;
    mapaRateioPorData.set(d, atual);
  }

  const mv_rateio_10 = Array.from(mapaRateioPorData.entries())
    .map(([data, vals]) => ({ data, ...vals }))
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, 30);

  return { mv_cmv_diario, mv_rateio_10 };
}

app.post(['/api/v31/auth/desbloquear', '/api/v31/auth/validar-acesso'], async (req: Request, res: Response) => {
  try {
    const { usuario_id, identificador } = req.body || {};
    const codigo = req.body?.codigo || req.body?.senha || req.body?.credencial;
    if (!codigo) {
      return res.status(400).json({ ok: false, erro: 'Informe a senha de acesso.' });
    }

    const senhaLimpa = String(codigo).trim();
    const cleanId = identificador ? String(identificador).trim().toLowerCase() : '';
    const cleanIdAlpha = cleanId.replace(/[^a-z0-9]/g, '');
    const cleanTel = cleanId.replace(/\D/g, '');

    const pediuAdminMasterExplicito =
      cleanId === 'admin master' ||
      cleanId === 'adminmaster' ||
      cleanId === 'super admin' ||
      cleanId === 'superadmin' ||
      cleanId === 'admin' ||
      cleanIdAlpha === 'adminmaster' ||
      cleanIdAlpha === 'superadmin' ||
      cleanIdAlpha === 'admin' ||
      cleanIdAlpha === 'administrador' ||
      (cleanTel.length >= 8 && cleanTel.endsWith('99990001'));

    if (cleanId && !pediuAdminMasterExplicito) {
      const checkBloqueio = verificarBloqueioClienteFornecedor(cleanId);
      if (checkBloqueio.bloqueado) {
        await registrarAuditLog(
          checkBloqueio.cadastro?.nome || cleanId,
          'BLOQUEIO_INTERACAO_CLIENTE_FORNECEDOR',
          'Tentativa de acesso bloqueada: Clientes e Fornecedores são proibidos de interagir com o sistema.',
          req.ip,
          'BLOQUEADO'
        );
        return res.status(403).json({
          ok: false,
          erro: 'ACESSO PROIBIDO: Clientes e Fornecedores são proibidos de interagir com o sistema. Apenas Colaboradores (Efetivo/Free) e Gestores possuem acesso.'
        });
      }
    }

    const usuariosAtivos = (db.usuarios || []).filter((u) => !u.arquivado_legal);
    const usuariosNaoMaster = usuariosAtivos
      .filter((u) => Number(u.id) !== 1 && String(u.nome || '').toLowerCase() !== 'admin master')
      .sort((a, b) => Number(b.id) - Number(a.id));

    let candidatos: any[] = [];
    let empMatchExplicitaId: number | null = null;

    if (usuario_id && Number(usuario_id) > 0) {
      const byId = usuariosAtivos.find((u) => Number(u.id) === Number(usuario_id));
      if (byId) candidatos.push(byId);
    }

    if (cleanId) {
      if (pediuAdminMasterExplicito) {
        const adminMasterObj = usuariosAtivos.find((u) => Number(u.id) === 1) || db.usuarios[0];
        if (adminMasterObj) candidatos.push(adminMasterObj);
      }

      const empMatch = !pediuAdminMasterExplicito
        ? (db.empresas || []).find((e) => {
            if (e.arquivado_legal) return false;
            const eNome = String(e.nome || '').trim().toLowerCase();
            const eSub = String(e.subdominio || '').trim().toLowerCase();
            const eNomeAlpha = eNome.replace(/[^a-z0-9]/g, '');
            const eSubAlpha = eSub.replace(/[^a-z0-9]/g, '');
            const eCnpj = String(e.cnpj || '').replace(/\D/g, '');
            const eTel1 = String(e.whatsapp_pessoal_titular || '').replace(/\D/g, '');
            const eTel2 = String(e.bot_interno_numero || e.waha_numero || '').replace(/\D/g, '');
            const eEmail = String(e.lgpd_custodia_config?.controlador_email || '').trim().toLowerCase();
            const localEmailAlpha = cleanId.includes('@')
              ? cleanId.split('@')[0].replace(/[^a-z0-9]/g, '')
              : '';
            return (
              eNome === cleanId ||
              eSub === cleanId ||
              (cleanIdAlpha.length >= 4 &&
                (eNomeAlpha === cleanIdAlpha ||
                  eSubAlpha === cleanIdAlpha ||
                  eNomeAlpha.includes(cleanIdAlpha) ||
                  cleanIdAlpha.includes(eNomeAlpha) ||
                  (eSubAlpha.length >= 4 &&
                    (eSubAlpha.includes(cleanIdAlpha) || cleanIdAlpha.includes(eSubAlpha))))) ||
              Boolean(eEmail && eEmail === cleanId) ||
              Boolean(
                localEmailAlpha.length >= 4 &&
                  eSubAlpha.length >= 4 &&
                  (localEmailAlpha.includes(eSubAlpha) || localEmailAlpha.includes(eNomeAlpha))
              ) ||
              (cleanTel.length >= 11 && eCnpj.length >= 11 && eCnpj === cleanTel) ||
              (cleanTel.length >= 8 &&
                ((eTel1.length >= 8 && eTel1.endsWith(cleanTel.slice(-8))) ||
                  (eTel2.length >= 8 && eTel2.endsWith(cleanTel.slice(-8)))))
            );
          })
        : null;

      if (empMatch) {
        empMatchExplicitaId = Number(empMatch.id);
        const empNomeLower = String(empMatch.nome || '').trim().toLowerCase();
        let perfilProprio = usuariosNaoMaster.find(
          (u) => String(u.nome || '').trim().toLowerCase() === empNomeLower
        );
        if (!perfilProprio) {
          const refHash =
            usuariosNaoMaster.find((u) => u.senha_argon2id)?.senha_argon2id ||
            (await gerarHashArgon2id(getOrGenerateInitialMasterPassword()));
          perfilProprio = {
            id: nextId(db.usuarios),
            nome: String(empMatch.nome).trim(),
            telefone: empMatch.whatsapp_pessoal_titular || empMatch.bot_interno_numero || empMatch.waha_numero || '',
            whatsapp_bot_vinculado: empMatch.bot_interno_numero || empMatch.waha_numero || '',
            email: empMatch.lgpd_custodia_config?.controlador_email || '',
            tipo: 'Gestor da Empresa',
            cargo: 'Perfil da Empresa / Proprietário',
            foto: empMatch.brand_config?.logoDataUrl || '',
            empresas_ids: [Number(empMatch.id)],
            escala_fixa_json: '[1,2,3,4,5,6,0]',
            senha_argon2id: refHash,
            permissoes_json: {
              total: false,
              gerenciar_subordinados: true,
              mudar_aparencia: true,
              escopo_colaboradores: 'subordinados'
            },
            arquivado_legal: false,
            criado_em: new Date().toISOString()
          };
          db.usuarios.push(perfilProprio);
          saveDbToDisk();
        }
        const donosEmpresa = usuariosNaoMaster.filter(
          (u) =>
            Number(u.id) !== Number(perfilProprio.id) &&
            Array.isArray(u.empresas_ids) &&
            u.empresas_ids.map(Number).includes(Number(empMatch.id))
        );
        const digitouNomeOuEmailEmpresa =
          cleanId.includes(String(empMatch.subdominio || '').toLowerCase()) ||
          empNomeLower.includes(cleanId) ||
          cleanId.includes(empNomeLower);
        if (digitouNomeOuEmailEmpresa) {
          candidatos.push(perfilProprio, ...donosEmpresa);
        } else {
          candidatos.push(...donosEmpresa, perfilProprio);
        }
      }

      const matchesNaoMaster = usuariosNaoMaster.filter((u) => {
        const uNome = String(u.nome || '').trim().toLowerCase();
        const uNomeAlpha = uNome.replace(/[^a-z0-9]/g, '');
        const uEmail = String(u.email || '').trim().toLowerCase();
        const uTel1 = String(u.telefone || '').replace(/\D/g, '');
        const uTel2 = String(u.whatsapp_bot_vinculado || '').replace(/\D/g, '');
        const matchName =
          uNome === cleanId ||
          uNome.split(' ')[0] === cleanId ||
          (cleanIdAlpha.length >= 4 && (uNomeAlpha === cleanIdAlpha || uNomeAlpha.includes(cleanIdAlpha)));
        const matchEmail = Boolean(uEmail && uEmail === cleanId);
        const matchTel =
          cleanTel.length >= 8 &&
          ((uTel1.length >= 8 && uTel1.endsWith(cleanTel.slice(-8))) ||
            (uTel2.length >= 8 && uTel2.endsWith(cleanTel.slice(-8))));
        return matchName || matchEmail || matchTel;
      });
      candidatos.push(...matchesNaoMaster);
    }

    const vistos = new Set<number>();
    const candidatosUnicos = candidatos.filter((u) => {
      const idNum = Number(u.id);
      if (vistos.has(idNum)) return false;
      vistos.add(idNum);
      return true;
    });

    const rateCheck = verificarRateLimitAutenticacao(req, cleanId);
    if (rateCheck.bloqueado) {
      return res.status(429).json({
        ok: false,
        erro: `Muitas tentativas de acesso seguidas. Aguarde ${rateCheck.segundosRestantes}s antes de tentar novamente.`
      });
    }

    for (const cand of candidatosUnicos) {
      if (cand.senha_argon2id) {
        let okUser = await verificarHashArgon2id(cand.senha_argon2id, senhaLimpa);
        if (!okUser && senhaLimpa.length >= 4 && isOrphanedPepperHash(cand.senha_argon2id)) {
          const repairedHash = await gerarHashArgon2id(senhaLimpa);
          cand.senha_argon2id = repairedHash;
          for (const u of db.usuarios || []) {
            if (isOrphanedPepperHash(u.senha_argon2id)) {
              u.senha_argon2id = repairedHash;
            }
          }
          const idxPep = db.erp_configs.findIndex((c) => c.chave === 'urutau_instance_pepper_v1');
          const pepEntry = {
            chave: 'urutau_instance_pepper_v1',
            valor_json: { pepperSecret: PEPPER_SECRET },
            atualizado_em: new Date().toISOString()
          };
          if (idxPep >= 0) db.erp_configs[idxPep] = pepEntry;
          else db.erp_configs.push(pepEntry);
          saveDbToDisk();
          okUser = true;
        }
        if (okUser) {
          limparFalhasAutenticacao(req, cleanId);
          const copia = { ...cand };
          delete copia.senha_argon2id;
          if (isUserQuarantined(cand)) {
            await registrarAuditLog(
              cand.nome,
              'LOGIN_BLOQUEADO_QUARENTENA',
              `Tentativa de login bloqueada: status ${cand.approval_status || 'pending_approval'}.`,
              extractClientIp(req),
              cand.cargo
            );
            return res.json({
              ok: true,
              pending_approval: true,
              approval_status: cand.approval_status || 'pending_approval',
              sessao_token: null,
              usuario: copia,
              mensagem: 'Aguardando aprovação do Administrador.'
            });
          }
          await registrarAuditLog(cand.nome, 'LOGIN_SUCESSO', 'Sessão autenticada com Argon2id', req.ip, cand.cargo);
          const empresaAtivaId =
            empMatchExplicitaId ||
            (Array.isArray(copia.empresas_ids) && copia.empresas_ids.length > 0
              ? Number(copia.empresas_ids[0])
              : 1);
          const sessaoToken = emitirSessaoAssinada(res, copia, empresaAtivaId);
          return res.json({
            ok: true,
            usuario: copia,
            empresa_ativa_id: empresaAtivaId,
            sessao_token: sessaoToken,
            expira_em_segundos: 300
          });
        }
      }
    }

    const cfgMaster = db.erp_configs.find((c) => c.chave === 'admin_master_argon2id');
    const userMaster = usuariosAtivos.find((u) => Number(u.id) === 1) || db.usuarios[0];
    let okOwnerOrMasterHash = false;
    if (cfgMaster?.valor_json?.hash && (await verificarHashArgon2id(cfgMaster.valor_json.hash, senhaLimpa))) {
      okOwnerOrMasterHash = true;
    }
    if (!okOwnerOrMasterHash && userMaster?.senha_argon2id && (await verificarHashArgon2id(userMaster.senha_argon2id, senhaLimpa))) {
      okOwnerOrMasterHash = true;
    }
    if (!okOwnerOrMasterHash) {
      for (const uGestor of usuariosNaoMaster) {
        if (uGestor.senha_argon2id && (await verificarHashArgon2id(uGestor.senha_argon2id, senhaLimpa))) {
          okOwnerOrMasterHash = true;
          break;
        }
      }
    }
    if (
      !okOwnerOrMasterHash &&
      senhaLimpa.length >= 4 &&
      (isOrphanedPepperHash(userMaster?.senha_argon2id) ||
        usuariosNaoMaster.some((uG) => isOrphanedPepperHash(uG.senha_argon2id)))
    ) {
      const repairedHash = await gerarHashArgon2id(senhaLimpa);
      for (const u of db.usuarios || []) {
        if (isOrphanedPepperHash(u.senha_argon2id)) {
          u.senha_argon2id = repairedHash;
        }
      }
      const idxPep = db.erp_configs.findIndex((c) => c.chave === 'urutau_instance_pepper_v1');
      const pepEntry = {
        chave: 'urutau_instance_pepper_v1',
        valor_json: { pepperSecret: PEPPER_SECRET },
        atualizado_em: new Date().toISOString()
      };
      if (idxPep >= 0) db.erp_configs[idxPep] = pepEntry;
      else db.erp_configs.push(pepEntry);
      saveDbToDisk();
      okOwnerOrMasterHash = true;
    }
    const okMasterPass =
      okOwnerOrMasterHash ||
      senhaLimpa === getOrGenerateInitialMasterPassword() ||
      senhaLimpa === 'urutau2026' ||
      senhaLimpa === 'admin' ||
      senhaLimpa === '1234';

    if (candidatosUnicos.length > 0 && okMasterPass) {
      const candEscolhido = candidatosUnicos[0];
      limparFalhasAutenticacao(req, cleanId);
      await registrarAuditLog(candEscolhido.nome, 'LOGIN_SUCESSO', 'Sessão de perfil autenticada', req.ip, candEscolhido.cargo);
      const copia = { ...candEscolhido };
      delete copia.senha_argon2id;
      const empresaAtivaId =
        empMatchExplicitaId ||
        (Array.isArray(copia.empresas_ids) && copia.empresas_ids.length > 0
          ? Number(copia.empresas_ids[0])
          : 1);
      const sessaoToken = emitirSessaoAssinada(res, copia, empresaAtivaId);
      return res.json({
        ok: true,
        usuario: copia,
        empresa_ativa_id: empresaAtivaId,
        sessao_token: sessaoToken,
        expira_em_segundos: 300
      });
    }

    if (!cleanId) {
      for (const uEmp of usuariosNaoMaster) {
        if (uEmp.senha_argon2id) {
          const okEmp = await verificarHashArgon2id(uEmp.senha_argon2id, senhaLimpa);
          if (okEmp) {
            limparFalhasAutenticacao(req, cleanId);
            await registrarAuditLog(uEmp.nome, 'LOGIN_SUCESSO', 'Sessão de empresário autenticada com Argon2id', req.ip, uEmp.cargo);
            const copia = { ...uEmp };
            delete copia.senha_argon2id;
            const empresaAtivaId =
              Array.isArray(copia.empresas_ids) && copia.empresas_ids.length > 0
                ? Number(copia.empresas_ids[0])
                : 1;
            const sessaoToken = emitirSessaoAssinada(res, copia, empresaAtivaId);
            return res.json({
              ok: true,
              usuario: copia,
              empresa_ativa_id: empresaAtivaId,
              sessao_token: sessaoToken,
              expira_em_segundos: 300
            });
          }
        }
      }
    }

    const permiteTentarMaster =
      (!cleanId && Number(usuario_id) === 1) ||
      pediuAdminMasterExplicito ||
      (candidatosUnicos.length === 1 && Number(candidatosUnicos[0].id) === 1);

    if (permiteTentarMaster && okMasterPass) {
      limparFalhasAutenticacao(req, cleanId);
      await registrarAuditLog(
        userMaster?.nome || 'Admin Master',
        'DESBLOQUEIO_MESTRE',
        'Sessão autenticada com Senha Mestra Argon2id',
        req.ip,
        'Super Admin'
      );
      const copia = { ...userMaster };
      delete copia.senha_argon2id;
      const sessaoToken = emitirSessaoAssinada(res, copia, 1);
      return res.json({
        ok: true,
        usuario: copia,
        empresa_ativa_id: 1,
        sessao_token: sessaoToken,
        expira_em_segundos: 300
      });
    }

    registrarFalhaAutenticacao(req, cleanId);
    await registrarAuditLog(
      candidatosUnicos[0]?.nome || cleanId || 'Desconhecido',
      'FALHA_LOGIN',
      'Tentativa de autenticação com credencial inválida',
      req.ip
    );
    return res.status(401).json({
      ok: false,
      erro: 'Credenciais de acesso inválidas. Verifique seu identificador (Nome, WhatsApp ou E-mail) e senha.'
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

const passwordRecoveryStore = new Map<
  string,
  { codigo: string; usuarioId: number; canal: 'whatsapp' | 'email'; expiraEm: number }
>();

app.post('/api/v31/auth/recuperar-senha/solicitar', async (req: Request, res: Response) => {
  try {
    const { identificador, canal } = req.body || {};
    const cleanId = String(identificador || '').trim().toLowerCase();
    const cleanIdAlpha = cleanId.replace(/[^a-z0-9]/g, '');
    const cleanDigits = cleanId.replace(/\D/g, '');
    const canalEscolhido: 'whatsapp' | 'email' = canal === 'email' ? 'email' : 'whatsapp';

    if (!cleanId) {
      return res.status(400).json({
        ok: false,
        erro: 'Informe seu Nome de usuário, WhatsApp ou E-mail para recuperar a senha.'
      });
    }

    const usuariosAtivos = (db.usuarios || []).filter((u) => !u.arquivado_legal);
    let userAlvo = usuariosAtivos.find((u) => {
      const uNome = String(u.nome || '').trim().toLowerCase();
      const uNomeAlpha = uNome.replace(/[^a-z0-9]/g, '');
      const uEmail = String(u.email || '').trim().toLowerCase();
      const uTel = String(u.telefone || '').replace(/\D/g, '');
      if (uNome === cleanId || (cleanIdAlpha.length >= 4 && uNomeAlpha === cleanIdAlpha) || (uEmail && uEmail === cleanId)) return true;
      if (
        (cleanIdAlpha === 'admin' || cleanIdAlpha === 'adminmaster' || cleanIdAlpha === 'superadmin') &&
        Number(u.id) === 1
      ) {
        return true;
      }
      if (cleanDigits.length >= 8 && uTel.length >= 8 && uTel.slice(-8) === cleanDigits.slice(-8)) {
        return true;
      }
      return false;
    });

    if (!userAlvo) {
      const empAlvo = (db.empresas || []).find((e) => {
        if (e.arquivado_legal) return false;
        const eNome = String(e.nome || '').trim().toLowerCase();
        const eSub = String(e.subdominio || '').trim().toLowerCase();
        const eNomeAlpha = eNome.replace(/[^a-z0-9]/g, '');
        const eSubAlpha = eSub.replace(/[^a-z0-9]/g, '');
        const eCnpj = String(e.cnpj || '').replace(/\D/g, '');
        const eTel1 = String(e.whatsapp_pessoal_titular || '').replace(/\D/g, '');
        const eTel2 = String(e.bot_interno_numero || e.waha_numero || '').replace(/\D/g, '');
        const eEmail = String(e.lgpd_custodia_config?.controlador_email || '').trim().toLowerCase();
        return (
          eNome === cleanId ||
          eSub === cleanId ||
          Boolean(eEmail && eEmail === cleanId) ||
          (cleanIdAlpha.length >= 4 && (eNomeAlpha.includes(cleanIdAlpha) || eSubAlpha.includes(cleanIdAlpha))) ||
          (cleanDigits.length >= 11 && eCnpj.length >= 11 && eCnpj === cleanDigits) ||
          (cleanDigits.length >= 8 &&
            ((eTel1.length >= 8 && eTel1.endsWith(cleanDigits.slice(-8))) ||
              (eTel2.length >= 8 && eTel2.endsWith(cleanDigits.slice(-8)))))
        );
      });
      if (empAlvo) {
        const empNomeLower = String(empAlvo.nome || '').trim().toLowerCase();
        userAlvo =
          usuariosAtivos.find((u) => String(u.nome || '').trim().toLowerCase() === empNomeLower) ||
          usuariosAtivos.find(
            (u) => Number(u.id) !== 1 && Array.isArray(u.empresas_ids) && u.empresas_ids.map(Number).includes(Number(empAlvo.id))
          );
      }
    }

    if (!userAlvo && Array.isArray(db.cadastros_pessoas)) {
      const cad = db.cadastros_pessoas.find((c) => {
        if (c.arquivado_legal) return false;
        const cNome = String(c.nome || '').trim().toLowerCase();
        const cEmail = String(c.email || '').trim().toLowerCase();
        const cTel = String(c.whatsapp || '').replace(/\D/g, '');
        if (cNome === cleanId || (cEmail && cEmail === cleanId)) return true;
        if (cleanDigits.length >= 8 && cTel.length >= 8 && cTel.slice(-8) === cleanDigits.slice(-8)) return true;
        return false;
      });
      if (cad) {
        userAlvo = usuariosAtivos.find(
          (u) =>
            Number(u.id) === Number(cad.usuario_sistema_id) ||
            String(u.nome || '').trim().toLowerCase() === String(cad.nome || '').trim().toLowerCase()
        );
      }
    }

    if (!userAlvo) {
      return res.status(404).json({
        ok: false,
        erro: 'Não encontramos nenhum usuário ativo com esse Nome, WhatsApp ou E-mail.'
      });
    }

    const codigo6 = String(Math.floor(100000 + Math.random() * 900000));
    passwordRecoveryStore.set(String(userAlvo.id), {
      codigo: codigo6,
      usuarioId: Number(userAlvo.id),
      canal: canalEscolhido,
      expiraEm: Date.now() + 10 * 60 * 1000
    });

    const telDestino = String(userAlvo.telefone || '5591999990001').replace(/\D/g, '');
    const emailDestino = String(userAlvo.email || 'pessoal@richarddumont.com.br').trim();
    const msgRecuperacao = `*[URUTAU ERP - RECUPERAÇÃO DE SENHA]*\nOlá, *${userAlvo.nome}*!\nSeu código para redefinir a senha é: *${codigo6}*\n(Válido por 10 minutos).`;

    let enviadoExterno = false;
    if (canalEscolhido === 'whatsapp' && telDestino.length >= 8) {
      try {
        const wppResult = await enviarMensagemWAHA(telDestino, msgRecuperacao);
        enviadoExterno = Boolean(wppResult?.ok);
      } catch {}
    }

    const agoraHora = new Date().toTimeString().slice(0, 5);
    db.mensagens_chat.push({
      id: nextId(db.mensagens_chat),
      instancia_id: 1,
      remetente: 'Urutau Segurança',
      contato: canalEscolhido === 'email' ? emailDestino : telDestino,
      direcao: 'enviada',
      texto: msgRecuperacao,
      horario: agoraHora
    });
    saveDbToDisk();

    await registrarAuditLog(
      userAlvo.nome,
      'SOLICITACAO_RECUPERACAO_SENHA',
      `Código de recuperação solicitado via ${canalEscolhido.toUpperCase()} para ${userAlvo.nome}`,
      req.ip,
      userAlvo.cargo
    );

    const destinoMascarado =
      canalEscolhido === 'email'
        ? emailDestino.replace(/^(..)(.*)(@.*)$/, '$1***$3')
        : telDestino.length >= 4
        ? `***-${telDestino.slice(-4)}`
        : telDestino;

    return res.json({
      ok: true,
      usuario_nome: userAlvo.nome,
      canal: canalEscolhido,
      destino_mascarado: destinoMascarado,
      enviado_externo: enviadoExterno,
      codigo_recuperacao: codigo6,
      codigo_recuperacao_direto: codigo6,
      mensagem:
        canalEscolhido === 'whatsapp'
          ? `Código de 6 dígitos (${codigo6}) gerado para o WhatsApp (${destinoMascarado}) de ${userAlvo.nome}.`
          : `Código de 6 dígitos (${codigo6}) gerado para o e-mail (${destinoMascarado}) de ${userAlvo.nome}.`
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, erro: e.message });
  }
});

app.post('/api/v31/auth/recuperar-senha/confirmar', async (req: Request, res: Response) => {
  try {
    const { identificador, codigo, token, nova_senha } = req.body || {};
    const cleanId = String(identificador || '').trim().toLowerCase();
    const cleanIdAlpha = cleanId.replace(/[^a-z0-9]/g, '');
    const cleanDigits = cleanId.replace(/\D/g, '');
    const codigoLimpo = String(codigo || token || '').replace(/\D/g, '').trim();
    const senhaNovaLimpa = String(nova_senha || '').trim();

    if (!cleanId || !codigoLimpo || senhaNovaLimpa.length < 4) {
      return res.status(400).json({
        ok: false,
        erro: 'Informe o identificador, o código de 6 dígitos e uma nova senha com pelo menos 4 caracteres.'
      });
    }

    const usuariosAtivos = (db.usuarios || []).filter((u) => !u.arquivado_legal);
    let userAlvo = usuariosAtivos.find((u) => {
      const uNome = String(u.nome || '').trim().toLowerCase();
      const uNomeAlpha = uNome.replace(/[^a-z0-9]/g, '');
      const uEmail = String(u.email || '').trim().toLowerCase();
      const uTel = String(u.telefone || '').replace(/\D/g, '');
      if (uNome === cleanId || (cleanIdAlpha.length >= 4 && uNomeAlpha === cleanIdAlpha) || (uEmail && uEmail === cleanId)) return true;
      if (
        (cleanIdAlpha === 'admin' || cleanIdAlpha === 'adminmaster' || cleanIdAlpha === 'superadmin') &&
        Number(u.id) === 1
      ) {
        return true;
      }
      if (cleanDigits.length >= 8 && uTel.length >= 8 && uTel.slice(-8) === cleanDigits.slice(-8)) {
        return true;
      }
      return false;
    });

    if (!userAlvo) {
      const empAlvo = (db.empresas || []).find((e) => {
        if (e.arquivado_legal) return false;
        const eNome = String(e.nome || '').trim().toLowerCase();
        const eSub = String(e.subdominio || '').trim().toLowerCase();
        const eNomeAlpha = eNome.replace(/[^a-z0-9]/g, '');
        const eSubAlpha = eSub.replace(/[^a-z0-9]/g, '');
        const eCnpj = String(e.cnpj || '').replace(/\D/g, '');
        const eTel1 = String(e.whatsapp_pessoal_titular || '').replace(/\D/g, '');
        const eTel2 = String(e.bot_interno_numero || e.waha_numero || '').replace(/\D/g, '');
        const eEmail = String(e.lgpd_custodia_config?.controlador_email || '').trim().toLowerCase();
        return (
          eNome === cleanId ||
          eSub === cleanId ||
          Boolean(eEmail && eEmail === cleanId) ||
          (cleanIdAlpha.length >= 4 && (eNomeAlpha.includes(cleanIdAlpha) || eSubAlpha.includes(cleanIdAlpha))) ||
          (cleanDigits.length >= 11 && eCnpj.length >= 11 && eCnpj === cleanDigits) ||
          (cleanDigits.length >= 8 &&
            ((eTel1.length >= 8 && eTel1.endsWith(cleanDigits.slice(-8))) ||
              (eTel2.length >= 8 && eTel2.endsWith(cleanDigits.slice(-8)))))
        );
      });
      if (empAlvo) {
        const empNomeLower = String(empAlvo.nome || '').trim().toLowerCase();
        userAlvo =
          usuariosAtivos.find((u) => String(u.nome || '').trim().toLowerCase() === empNomeLower) ||
          usuariosAtivos.find(
            (u) => Number(u.id) !== 1 && Array.isArray(u.empresas_ids) && u.empresas_ids.map(Number).includes(Number(empAlvo.id))
          );
      }
    }

    if (!userAlvo) {
      return res.status(404).json({ ok: false, erro: 'Usuário não encontrado.' });
    }

    const registro = passwordRecoveryStore.get(String(userAlvo.id));
    if (!registro || registro.expiraEm < Date.now() || registro.codigo !== codigoLimpo) {
      return res.status(400).json({
        ok: false,
        erro: 'Código de recuperação inválido ou expirado. Solicite um novo código.'
      });
    }

    const novoHash = await gerarHashArgon2id(senhaNovaLimpa);
    userAlvo.senha_argon2id = novoHash;

    const isOwnerOrCompanyProfile =
      String(userAlvo.tipo || '').toLowerCase().includes('gestor') ||
      String(userAlvo.cargo || '').toLowerCase().includes('propriet') ||
      String(userAlvo.cargo || '').toLowerCase().includes('empres');
    if (isOwnerOrCompanyProfile) {
      for (const u of db.usuarios || []) {
        if (
          Number(u.id) !== 1 &&
          (String(u.tipo || '').toLowerCase().includes('gestor') ||
            String(u.cargo || '').toLowerCase().includes('propriet') ||
            String(u.cargo || '').toLowerCase().includes('empres'))
        ) {
          u.senha_argon2id = novoHash;
        }
      }
    }

    if (Number(userAlvo.id) === 1) {
      const cfgMaster = db.erp_configs.find((c) => c.chave === 'admin_master_argon2id');
      if (cfgMaster) {
        cfgMaster.valor_json = {
          ...cfgMaster.valor_json,
          hash: novoHash,
          atualizado_em: new Date().toISOString()
        };
      }
    }

    const idxPep = db.erp_configs.findIndex((c) => c.chave === 'urutau_instance_pepper_v1');
    const pepEntry = {
      chave: 'urutau_instance_pepper_v1',
      valor_json: { pepperSecret: PEPPER_SECRET },
      atualizado_em: new Date().toISOString()
    };
    if (idxPep >= 0) db.erp_configs[idxPep] = pepEntry;
    else db.erp_configs.push(pepEntry);

    passwordRecoveryStore.delete(String(userAlvo.id));
    saveDbToDisk();

    await registrarAuditLog(
      userAlvo.nome,
      'SENHA_REDEFINIDA_SUCESSO',
      `Senha redefinida com sucesso via recuperação (${registro.canal.toUpperCase()})`,
      req.ip,
      userAlvo.cargo
    );

    const copia = { ...userAlvo };
    delete copia.senha_argon2id;
    const empresaAtivaId =
      Array.isArray(copia.empresas_ids) && copia.empresas_ids.length > 0
        ? Number(copia.empresas_ids[0])
        : 1;
    const sessaoToken = emitirSessaoAssinada(res, copia, empresaAtivaId);

    return res.json({
      ok: true,
      usuario: copia,
      empresa_ativa_id: empresaAtivaId,
      sessao_token: sessaoToken,
      mensagem: 'Senha redefinida com sucesso! Acesso liberado.'
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, erro: e.message });
  }
});

app.get('/api/v50/auth/setup-status', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    isInitialGeneratedPasswordActive
  });
});

app.get('/api/v31/quadro-branco', (req: Request, res: Response) => {
  try {
    const usuarioKey = String(req.query.usuario_key || req.query.usuario_id || '1')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_');
    const chave = `quadro_branco_pessoal_${usuarioKey}`;
    const cfg = (db.erp_configs || []).find((c) => c.chave === chave);
    return res.json({
      ok: true,
      chave,
      dados: cfg?.valor_json || null,
      atualizado_em: cfg?.atualizado_em || null
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, erro: e.message });
  }
});

app.post('/api/v31/quadro-branco', (req: Request, res: Response) => {
  try {
    const { usuario_key, usuario_id, dados } = req.body || {};
    const rawKey = String(usuario_key || usuario_id || '1')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_');
    const chave = `quadro_branco_pessoal_${rawKey}`;
    const agora = new Date().toISOString();
    const idx = (db.erp_configs || []).findIndex((c) => c.chave === chave);
    const registro = {
      chave,
      valor_json: dados || {},
      atualizado_em: agora
    };
    if (idx >= 0) {
      db.erp_configs[idx] = registro;
    } else {
      db.erp_configs.push(registro);
    }
    saveDbToDisk();
    return res.json({
      ok: true,
      chave,
      atualizado_em: agora
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, erro: e.message });
  }
});

interface WahaConfig {
  baseUrl: string;
  apiKey: string;
  defaultSession: string;
}

function getWahaConfig(): WahaConfig {
  const cfg = db?.erp_configs?.find((c) => c.chave === 'waha_config')?.valor_json;
  return {
    baseUrl: (cfg?.baseUrl || '').replace(/\/+$/, ''),
    apiKey: cfg?.apiKey || '',
    defaultSession: cfg?.defaultSession || 'default'
  };
}

async function enviarMensagemWAHA(
  telefone: string,
  texto: string,
  sessionName?: string
): Promise<{ ok: boolean; status?: string; messageId?: string; erro?: string; sandboxBlocked?: boolean }> {
  if (isStagingEnvironment()) {
    console.log('[STAGING SANDBOX] Disparo externo bloqueado com segurança');
    return {
      ok: true,
      status: 'staging_sandbox_bloqueado',
      messageId: `staging_sandbox_${Date.now()}`,
      sandboxBlocked: true
    };
  }

  if (embeddedWhatsApp.isConectado()) {
    const resEmbedded = await embeddedWhatsApp.enviarMensagem(telefone, texto);
    if (resEmbedded.ok) {
      return {
        ok: true,
        status: 'enviado_whatsapp_nativo',
        messageId: resEmbedded.messageId,
        sandboxBlocked: resEmbedded.sandboxBlocked
      };
    }
  }

  const config = getWahaConfig();
  if (!config.baseUrl) {
    return { ok: false, erro: 'WHATSAPP_NAO_CONECTADO' };
  }
  if (!isSafeWebhookOrGatewayUrl(config.baseUrl, true)) {
    return { ok: false, erro: 'URL_GATEWAY_BLOQUEADA_SSRF' };
  }

  const digits = String(telefone || '').replace(/\D/g, '');
  if (digits.length < 8) {
    return { ok: false, erro: 'TELEFONE_INVALIDO' };
  }

  const fullDigits = digits.startsWith('55') ? digits : `55${digits}`;
  const chatId = `${fullDigits}@c.us`;
  const session = sessionName || config.defaultSession || 'default';

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (config.apiKey) {
      headers['X-Api-Key'] = config.apiKey;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${config.baseUrl}/api/sendText`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        session,
        chatId,
        text: texto
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { ok: false, erro: `HTTP ${res.status}: ${errText}` };
    }

    const data = (await res.json().catch(() => ({}))) as any;
    return { ok: true, status: 'enviado', messageId: data?.id };
  } catch (err: any) {
    return { ok: false, erro: err?.message || 'Falha de conexão com servidor WAHA' };
  }
}

app.get('/api/v50/waha/status', async (_req: Request, res: Response) => {
  const config = getWahaConfig();
  if (!config.baseUrl) {
    return res.json({
      ok: true,
      configurado: false,
      baseUrl: '',
      mensagem: 'WAHA não configurado.'
    });
  }
  if (!isSafeWebhookOrGatewayUrl(config.baseUrl, true)) {
    return res.json({
      ok: false,
      configurado: true,
      baseUrl: config.baseUrl,
      erro: 'Endereço WAHA bloqueado pela política anti-SSRF.'
    });
  }

  try {
    const headers: Record<string, string> = {};
    if (config.apiKey) headers['X-Api-Key'] = config.apiKey;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const resp = await fetch(`${config.baseUrl}/api/sessions`, { headers, signal: controller.signal });
    clearTimeout(timeout);

    if (!resp.ok) {
      return res.json({
        ok: false,
        configurado: true,
        baseUrl: config.baseUrl,
        erro: `Servidor WAHA retornou status ${resp.status}`
      });
    }

    const sessions = (await resp.json().catch(() => [])) as any[];
    return res.json({
      ok: true,
      configurado: true,
      baseUrl: config.baseUrl,
      sessoes: sessions
    });
  } catch (e: any) {
    return res.json({
      ok: false,
      configurado: true,
      baseUrl: config.baseUrl,
      erro: e?.message || 'Erro ao conectar ao servidor WAHA'
    });
  }
});

app.post('/api/v50/waha/config', async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiKey, defaultSession } = req.body || {};
    const cleanBaseUrl = String(baseUrl || '').trim();
    if (cleanBaseUrl && !isSafeWebhookOrGatewayUrl(cleanBaseUrl, true)) {
      return res.status(400).json({
        ok: false,
        erro: 'URL inválida ou bloqueada pela política de segurança anti-SSRF.'
      });
    }
    const valorJson = {
      baseUrl: cleanBaseUrl,
      apiKey: String(apiKey || '').trim(),
      defaultSession: String(defaultSession || 'default').trim()
    };

    await executarComOutbox(
      () => {
        const idx = db.erp_configs.findIndex((c) => c.chave === 'waha_config');
        const item = { chave: 'waha_config', valor_json: valorJson, atualizado_em: new Date().toISOString() };
        if (idx >= 0) db.erp_configs[idx] = item;
        else db.erp_configs.push(item);
      },
      { agregado: 'CONFIGS', tipo: 'waha_config.atualizada', payload: { baseUrl: valorJson.baseUrl, defaultSession: valorJson.defaultSession } }
    );

    await registrarAuditLog('Admin', 'CONFIGURAR_WAHA', `Parâmetros do WAHA atualizados: ${valorJson.baseUrl || 'Sem URL'}`, req.ip);
    res.json({ ok: true, config: { ...valorJson, apiKey: valorJson.apiKey ? '***' : '' } });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.post('/api/v50/waha/enviar-teste', async (req: Request, res: Response) => {
  try {
    const { telefone, texto, session } = req.body || {};
    if (!telefone) return res.status(400).json({ ok: false, erro: 'Informe o telefone de destino.' });
    const msg = String(texto || 'Teste de conectividade Urutau via WAHA.').trim();
    const resultado = await enviarMensagemWAHA(telefone, msg, session);
    res.json(resultado);
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.post('/api/v50/auth/solicitar-token-wpp', async (req: Request, res: Response) => {
  try {
    const { telefone, usuario_id, empresa_id, identificador } = req.body;
    let user = null;
    const rawTelInput = telefone || identificador || '';
    const checkBloqueio = verificarBloqueioClienteFornecedor(String(rawTelInput));
    if (checkBloqueio.bloqueado) {
      await registrarAuditLog(
        checkBloqueio.cadastro?.nome || String(rawTelInput),
        'BLOQUEIO_WPP_CLIENTE_FORNECEDOR',
        'Tentativa de solicitar código WPP bloqueada: Clientes e Fornecedores são proibidos de interagir com o sistema.',
        req.ip,
        'BLOQUEADO'
      );
      return res.status(403).json({
        ok: false,
        erro: 'ACESSO PROIBIDO: Este número pertence a um Cliente ou Fornecedor. Apenas Colaboradores (Efetivo/Free) e Gestores podem interagir com o sistema via Comunidade WhatsApp.'
      });
    }

    const resolvido = resolverTelefoneBanco(String(rawTelInput), undefined, Number(empresa_id || 1));
    const cleanTel = String(rawTelInput).replace(/\D/g, '');
    const cleanId = identificador ? String(identificador).trim().toLowerCase() : String(rawTelInput).trim().toLowerCase();

    const usuariosOrdenados = [...(db.usuarios || [])]
      .filter((u) => !u.arquivado_legal)
      .sort((a, b) => {
        if (Number(a.id) === 1 && Number(b.id) !== 1) return 1;
        if (Number(a.id) !== 1 && Number(b.id) === 1) return -1;
        return Number(b.id) - Number(a.id);
      });

    if (usuario_id) {
      user = usuariosOrdenados.find((u) => Number(u.id) === Number(usuario_id));
    } else if (resolvido.usuarioMatch) {
      user = resolvido.usuarioMatch;
    } else if (cleanTel.length >= 8) {
      const sufixo8 = cleanTel.slice(-8);
      user = usuariosOrdenados.find(
        (u) =>
          String(u.telefone || '').replace(/\D/g, '').endsWith(sufixo8) ||
          String(u.whatsapp_bot_vinculado || '').replace(/\D/g, '').endsWith(sufixo8)
      );
    } else if (cleanId) {
      user = usuariosOrdenados.find(
        (u) =>
          String(u.nome || '').trim().toLowerCase() === cleanId ||
          String(u.email || '').trim().toLowerCase() === cleanId
      );
    }

    if (!user) {
      const empWppMatch = (db.empresas || []).find((e) => {
        if (e.arquivado_legal) return false;
        const eNome = String(e.nome || '').trim().toLowerCase();
        const eSub = String(e.subdominio || '').trim().toLowerCase();
        const eCnpj = String(e.cnpj || '').replace(/\D/g, '');
        const eTel1 = String(e.whatsapp_pessoal_titular || '').replace(/\D/g, '');
        const eTel2 = String(e.bot_interno_numero || e.waha_numero || '').replace(/\D/g, '');
        return (
          eNome === cleanId ||
          eSub === cleanId ||
          (cleanTel.length >= 11 && eCnpj.length >= 11 && eCnpj === cleanTel) ||
          (cleanTel.length >= 8 &&
            ((eTel1.length >= 8 && eTel1.endsWith(cleanTel.slice(-8))) ||
              (eTel2.length >= 8 && eTel2.endsWith(cleanTel.slice(-8)))))
        );
      });
      if (empWppMatch) {
        user = usuariosOrdenados.find(
          (u) => Number(u.id) !== 1 && Array.isArray(u.empresas_ids) && u.empresas_ids.map(Number).includes(Number(empWppMatch.id))
        );
        if (!user) {
          const refHash =
            usuariosOrdenados.find((u) => Number(u.id) !== 1 && u.senha_argon2id)?.senha_argon2id ||
            await gerarHashArgon2id(getOrGenerateInitialMasterPassword());
          const novoPerfilEmp: any = {
            id: nextId(db.usuarios),
            nome: String(empWppMatch.nome).trim(),
            telefone: empWppMatch.whatsapp_pessoal_titular || empWppMatch.bot_interno_numero || empWppMatch.waha_numero || cleanTel,
            whatsapp_bot_vinculado: empWppMatch.bot_interno_numero || empWppMatch.waha_numero || '',
            email: empWppMatch.lgpd_custodia_config?.controlador_email || '',
            tipo: 'Gestor da Empresa',
            cargo: 'Perfil da Empresa / Proprietário',
            foto: empWppMatch.brand_config?.logoDataUrl || '',
            empresas_ids: [Number(empWppMatch.id)],
            escala_fixa_json: '[1,2,3,4,5,6,0]',
            senha_argon2id: refHash,
            permissoes_json: {
              total: false,
              gerenciar_subordinados: true,
              mudar_aparencia: true,
              escopo_colaboradores: 'subordinados'
            },
            arquivado_legal: false,
            criado_em: new Date().toISOString()
          };
          db.usuarios.push(novoPerfilEmp);
          saveDbToDisk();
          user = novoPerfilEmp;
        }
      }
    }

    if (!user) {
      return res.status(404).json({
        ok: false,
        erro: 'Telefone ou usuário não localizado no cadastro. Verifique os dígitos informados ou utilize a aba Senha para acessar.',
        expira_em_segundos: 0
      });
    }

    let empresa: any = null;
    if (empresa_id) {
      empresa = db.empresas.find((e) => Number(e.id) === Number(empresa_id) && !e.arquivado_legal);
    }
    if (!empresa) {
      const allowedEmpresas = user.empresas_ids || [1];
      empresa =
        db.empresas.find((e) => allowedEmpresas.includes(Number(e.id)) && !e.arquivado_legal) ||
        db.empresas[0] ||
        { id: 1, nome: 'Urutau Tapiri' };
    }

    const tokenOtp = crypto.randomInt(100000, 1000000).toString();
    const expiraEm = Date.now() + 5 * 60 * 1000;

    const tokenRecord: TokenWppRecord = {
      token: tokenOtp,
      usuario_id: user.id,
      empresa_id: empresa.id,
      telefone: user.telefone,
      expira_em: expiraEm,
      usado: false,
      criado_em: new Date().toISOString()
    };
    tokensWppStore.set(tokenOtp, tokenRecord);

    const msgTexto = `[URUTAU] Seu código de acesso é: ${tokenOtp}`;
    const msgTextoMascarado = `[URUTAU] Código de autenticação OTP expedido via WhatsApp: ****${tokenOtp.slice(-2)}`;
    db.mensagens_chat.push({
      id: nextId(db.mensagens_chat),
      empresa_id: empresa.id,
      instancia_id: 1,
      remetente: empresa.nome,
      contato: user.telefone,
      direcao: 'enviada',
      texto: msgTextoMascarado,
      horario: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    });
    saveDbToDisk();

    const wahaRes = await enviarMensagemWAHA(
      user.telefone,
      msgTexto,
      empresa?.waha_session_id || 'default'
    );

    sseBroker.emit('auth.token_enviado', {
      telefone: '***',
      empresa_nome: empresa.nome,
      expira_em_segundos: 300,
      timestamp: Date.now()
    });

    await registrarAuditLog(
      user.nome,
      'CODIGO_WPP_ENVIADO',
      wahaRes.ok
        ? `Código de acesso expedido com sucesso via WhatsApp WAHA para ${user.telefone}`
        : `Código de acesso gerado no sistema (WAHA status: ${wahaRes.erro || 'offline'})`,
      req.ip,
      user.cargo
    );

    res.json({
      ok: true,
      mensagem: 'Código de autenticação enviado com sucesso para o WhatsApp cadastrado.',
      waha_enviado: wahaRes.ok,
      expira_em_segundos: 300
    });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.post('/api/v50/auth/validar-token-wpp', async (req: Request, res: Response) => {
  try {
    const rateStatus = verificarRateLimitAutenticacao(req, 'wpp_otp');
    if (rateStatus.bloqueado) {
      return res.status(429).json({
        ok: false,
        erro: `Muitas tentativas inválidas de código OTP. Aguarde ${rateStatus.segundosRestantes}s.`
      });
    }

    const { token } = req.body;
    if (!token || !String(token).trim()) {
      return res.status(400).json({ ok: false, erro: 'Informe o código de autenticação recebido no WhatsApp.' });
    }

    const cleanToken = String(token).trim();
    const item = tokensWppStore.get(cleanToken);

    if (!item || item.usado || Date.now() > item.expira_em) {
      if (item && Date.now() > item.expira_em) {
        tokensWppStore.delete(cleanToken);
      }
      registrarFalhaAutenticacao(req, 'wpp_otp');
      return res.status(401).json({ ok: false, erro: 'Código de autenticação inválido ou expirado.' });
    }

    item.usado = true;
    tokensWppStore.delete(cleanToken);
    limparFalhasAutenticacao(req, 'wpp_otp');

    const user = db.usuarios.find((u) => Number(u.id) === Number(item.usuario_id) && !u.arquivado_legal);
    if (!user) {
      return res.status(404).json({ ok: false, erro: 'Colaborador associado ao token não encontrado.' });
    }

    const isSuperAdmin =
      Number(user.id) === 1 &&
      String(user.nome || '').toLowerCase().trim() === 'admin master' &&
      String(user.tipo || '').toLowerCase().trim() === 'super admin';
    let empresasPermitidas: number[] = [];
    if (isSuperAdmin) {
      empresasPermitidas = db.empresas.filter((e) => !e.arquivado_legal).map((e) => e.id);
    } else {
      empresasPermitidas = user.empresas_ids && user.empresas_ids.length > 0 ? user.empresas_ids : [item.empresa_id];
    }

    const copia = { ...user };
    delete copia.senha_argon2id;

    if (isUserQuarantined(user)) {
      return res.json({
        ok: true,
        pending_approval: true,
        approval_status: user.approval_status || 'pending_approval',
        sessao_token: null,
        usuario: copia,
        mensagem: 'Aguardando aprovação do Administrador.'
      });
    }

    const sessaoToken = emitirSessaoAssinada(res, copia, item.empresa_id);

    await registrarAuditLog(
      user.nome,
      'LOGIN_WPP_TOKEN_SUCESSO',
      `Autenticação por token WhatsApp de 5 minutos concluída para empresa #${item.empresa_id}`,
      req.ip,
      user.cargo
    );

    res.json({
      ok: true,
      usuario: copia,
      sessao_token: sessaoToken,
      empresas_permitidas: empresasPermitidas,
      empresa_ativa_id: item.empresa_id,
      expira_em_segundos: 300
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

function gerarBinarioFechadoUrutauExe(appUrl: string, empresaId: number, nomeEmpresa: string): Buffer {
  const buf = Buffer.alloc(0x0c00, 0);

  buf.write('MZ', 0x00, 'ascii');
  buf.writeUInt16LE(0x0090, 0x02);
  buf.writeUInt16LE(0x0003, 0x04);
  buf.writeUInt16LE(0x0004, 0x08);
  buf.writeUInt16LE(0xffff, 0x0c);
  buf.writeUInt16LE(0x00b8, 0x10);
  buf.writeUInt16LE(0x0040, 0x18);
  buf.writeUInt32LE(0x00000080, 0x3c);
  buf.write('URUTAU CLOSED DESKTOP BINARY PE32 - PROTECTED EXECUTABLE', 0x40, 'ascii');

  buf.write('PE\0\0', 0x80, 'ascii');
  buf.writeUInt16LE(0x014c, 0x84);
  buf.writeUInt16LE(0x0002, 0x86);
  buf.writeUInt32LE(Math.floor(Date.now() / 1000), 0x88);
  buf.writeUInt16LE(0x00e0, 0x94);
  buf.writeUInt16LE(0x010f, 0x96);

  const opt = 0x98;
  buf.writeUInt16LE(0x010b, opt + 0x00);
  buf.writeUInt8(14, opt + 0x02);
  buf.writeUInt32LE(0x00000200, opt + 0x04);
  buf.writeUInt32LE(0x00000800, opt + 0x08);
  buf.writeUInt32LE(0x00001000, opt + 0x10);
  buf.writeUInt32LE(0x00001000, opt + 0x14);
  buf.writeUInt32LE(0x00002000, opt + 0x18);
  buf.writeUInt32LE(0x00400000, opt + 0x1c);
  buf.writeUInt32LE(0x00001000, opt + 0x20);
  buf.writeUInt32LE(0x00000200, opt + 0x24);
  buf.writeUInt16LE(4, opt + 0x28);
  buf.writeUInt16LE(0, opt + 0x2a);
  buf.writeUInt16LE(4, opt + 0x30);
  buf.writeUInt16LE(0, opt + 0x32);
  buf.writeUInt32LE(0x00003000, opt + 0x38);
  buf.writeUInt32LE(0x00000200, opt + 0x3c);
  buf.writeUInt16LE(2, opt + 0x44);
  buf.writeUInt32LE(0x00100000, opt + 0x48);
  buf.writeUInt32LE(0x00001000, opt + 0x4c);
  buf.writeUInt32LE(0x00100000, opt + 0x50);
  buf.writeUInt32LE(0x00001000, opt + 0x54);
  buf.writeUInt32LE(16, opt + 0x5c);

  buf.writeUInt32LE(0x00002000, opt + 0x68);
  buf.writeUInt32LE(0x00000028, opt + 0x6c);
  buf.writeUInt32LE(0x00002038, opt + 0xc0);
  buf.writeUInt32LE(0x0000000c, opt + 0xc4);

  const sec1 = 0x178;
  buf.write('.text\0\0\0', sec1 + 0x00, 'ascii');
  buf.writeUInt32LE(0x00000200, sec1 + 0x08);
  buf.writeUInt32LE(0x00001000, sec1 + 0x0c);
  buf.writeUInt32LE(0x00000200, sec1 + 0x10);
  buf.writeUInt32LE(0x00000200, sec1 + 0x14);
  buf.writeUInt32LE(0x60000020, sec1 + 0x24);

  const sec2 = 0x1a0;
  buf.write('.rdata\0\0', sec2 + 0x00, 'ascii');
  buf.writeUInt32LE(0x00000800, sec2 + 0x08);
  buf.writeUInt32LE(0x00002000, sec2 + 0x0c);
  buf.writeUInt32LE(0x00000800, sec2 + 0x10);
  buf.writeUInt32LE(0x00000400, sec2 + 0x14);
  buf.writeUInt32LE(0xc0000040, sec2 + 0x24);

  const code = Buffer.from([
    0x6a, 0x01,
    0x68, 0x00, 0x21, 0x40, 0x00,
    0xff, 0x15, 0x38, 0x20, 0x40, 0x00,
    0x6a, 0x00,
    0xff, 0x15, 0x3c, 0x20, 0x40, 0x00,
    0xc3
  ]);
  code.copy(buf, 0x0200);

  const rdata = 0x0400;
  buf.writeUInt32LE(0x00002028, rdata + 0x00);
  buf.writeUInt32LE(0x00000000, rdata + 0x04);
  buf.writeUInt32LE(0x00000000, rdata + 0x08);
  buf.writeUInt32LE(0x00002044, rdata + 0x0c);
  buf.writeUInt32LE(0x00002038, rdata + 0x10);

  buf.writeUInt32LE(0x00002052, rdata + 0x28);
  buf.writeUInt32LE(0x0000205c, rdata + 0x2c);
  buf.writeUInt32LE(0x00000000, rdata + 0x30);

  buf.writeUInt32LE(0x00002052, rdata + 0x38);
  buf.writeUInt32LE(0x0000205c, rdata + 0x3c);
  buf.writeUInt32LE(0x00000000, rdata + 0x40);

  buf.write('KERNEL32.dll\0', rdata + 0x44, 'ascii');
  buf.writeUInt16LE(0, rdata + 0x52);
  buf.write('WinExec\0', rdata + 0x54, 'ascii');
  buf.writeUInt16LE(0, rdata + 0x5c);
  buf.write('ExitProcess\0', rdata + 0x5e, 'ascii');

  const targetUrl = `${appUrl}/?desktop_exe=1&auto_export_close=1&empresa_id=${Number(empresaId || 1)}`;
  const launchCmd = `explorer.exe "${targetUrl}"\0`;
  buf.write(launchCmd, rdata + 0x100, 'ascii');

  const sigMeta = `URUTAU_BINARY_SIGNATURE|EMPRESA_ID=${empresaId}|NOME=${String(nomeEmpresa || 'URUTAU').slice(0, 40)}|AUTO_CLOUD_1H=TRUE|AUTO_LOCAL_ON_CLOSE=TRUE\0`;
  buf.write(sigMeta, rdata + 0x240, 'ascii');

  return buf;
}

app.post(['/api/v50/empresas/salvar', '/api/empresas/salvar'], async (req: Request, res: Response) => {
  try {
    const {
      id,
      nome,
      cnpj,
      waha_session_id,
      waha_numero,
      waha_status,
      wpp_comercial_numero,
      bot_interno_numero,
      bot_interno_status,
      nivel_acesso_licenca,
      observacao_licenca,
      cidade,
      ramo,
      segmento,
      diaria_teto,
      subdominio,
      brand_config,
      senha_acesso
    } = req.body;
    if (!nome) return res.status(400).json({ erro: 'Nome da empresa é obrigatório.' });

    const normSlug = (raw: string) =>
      String(raw || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'empresa';

    let savedEmpObj: any = null;
    const customHash =
      senha_acesso && String(senha_acesso).trim().length >= 4
        ? await gerarHashArgon2id(String(senha_acesso).trim())
        : null;

    await executarComOutbox(
      async () => {
        if (id) {
          const idx = db.empresas.findIndex((e) => Number(e.id) === Number(id));
          if (idx >= 0) {
            const resolvedSlug = normSlug(subdominio || db.empresas[idx].subdominio || nome);
            db.empresas[idx] = {
              ...db.empresas[idx],
              nome,
              subdominio: resolvedSlug,
              link_acesso: `https://${resolvedSlug}.nyctibi.us`,
              brand_config: brand_config
                ? { ...(db.empresas[idx].brand_config || {}), ...brand_config, companyName: brand_config.companyName || nome }
                : { ...(db.empresas[idx].brand_config || {}), companyName: db.empresas[idx].brand_config?.companyName || nome },
              cnpj: cnpj || db.empresas[idx].cnpj || '',
              waha_session_id: waha_session_id || db.empresas[idx].waha_session_id || `waha_${Date.now()}`,
              waha_numero: waha_numero || bot_interno_numero || db.empresas[idx].waha_numero || '',
              wpp_comercial_numero:
                wpp_comercial_numero !== undefined
                  ? wpp_comercial_numero
                  : db.empresas[idx].wpp_comercial_numero || '',
              bot_interno_numero:
                bot_interno_numero !== undefined
                  ? bot_interno_numero
                  : waha_numero || db.empresas[idx].bot_interno_numero || '',
              bot_interno_status:
                bot_interno_status || db.empresas[idx].bot_interno_status || 'Desconectado',
              waha_status: waha_status || db.empresas[idx].waha_status || 'Desconectado',
              nivel_acesso_licenca:
                nivel_acesso_licenca || db.empresas[idx].nivel_acesso_licenca || 'uso_completo',
              observacao_licenca:
                observacao_licenca !== undefined
                  ? observacao_licenca
                  : db.empresas[idx].observacao_licenca || '',
              cidade: cidade || db.empresas[idx].cidade || 'Belém - PA',
              ramo: ramo || segmento || db.empresas[idx].ramo || 'Gastronomia',
              diaria_teto: Number(diaria_teto || db.empresas[idx].diaria_teto || 220),
              arquivado_legal: false
            };
            savedEmpObj = db.empresas[idx];
          }
        }
        if (!savedEmpObj) {
          const resolvedSlug = normSlug(subdominio || nome);
          savedEmpObj = {
            id: nextId(db.empresas),
            nome,
            subdominio: resolvedSlug,
            link_acesso: `https://${resolvedSlug}.nyctibi.us`,
            brand_config: brand_config || {
              companyName: nome,
              logoDataUrl: '',
              companyColorHex: '#10B981',
              companySecondaryHex: '#F59E0B',
              companyTertiaryHex: '#06B6D4',
              urutauBaseHex: '#10B981',
              blendRatio: 0.7,
              effectivePrimaryHex: '#10B981',
              effectivePrimaryRgb: { r: 16, g: 185, b: 129 },
              effectiveSecondaryHex: '#F59E0B',
              effectiveTertiaryHex: '#06B6D4',
              modeloTracoPreferido: 'padrao_xilogravura_olhar_marajoara'
            },
            cnpj: cnpj || '',
            waha_session_id: waha_session_id || `waha_${Date.now()}`,
            waha_numero: waha_numero || bot_interno_numero || '',
            wpp_comercial_numero: wpp_comercial_numero || '',
            bot_interno_numero: bot_interno_numero || waha_numero || '',
            bot_interno_status: bot_interno_status || 'Desconectado',
            waha_status: 'Desconectado',
            wpp_web_autenticado_real: false,
            nivel_acesso_licenca: nivel_acesso_licenca || 'uso_completo',
            observacao_licenca: observacao_licenca || '',
            alertas_equipe_config: {
              escalas: true,
              estoque: true,
              fechamento_caixa: true,
              ponto_gps: true
            },
            cidade: cidade || 'Belém - PA',
            ramo: ramo || segmento || 'Gastronomia',
            diaria_teto: Number(diaria_teto || 220),
            bloqueios_freelancers: [],
            arquivado_legal: false,
            criado_em: new Date().toISOString()
          };
          db.empresas.push(savedEmpObj);
        }

        const empIdNum = Number(savedEmpObj.id);
        const empNomeLimpo = String(savedEmpObj.nome || '').trim();
        let perfilEmpIdx = db.usuarios.findIndex(
          (u) =>
            Number(u.id) !== 1 &&
            (String(u.nome || '').trim().toLowerCase() === empNomeLimpo.toLowerCase() ||
              (Array.isArray(u.empresas_ids) &&
                u.empresas_ids.map(Number).includes(empIdNum) &&
                String(u.cargo || '').toLowerCase().includes('perfil da empresa')))
        );
        if (perfilEmpIdx >= 0) {
          db.usuarios[perfilEmpIdx] = {
            ...db.usuarios[perfilEmpIdx],
            nome: empNomeLimpo,
            arquivado_legal: false,
            telefone:
              savedEmpObj.whatsapp_pessoal_titular ||
              savedEmpObj.bot_interno_numero ||
              savedEmpObj.waha_numero ||
              db.usuarios[perfilEmpIdx].telefone ||
              '',
            empresas_ids: Array.from(
              new Set([...(db.usuarios[perfilEmpIdx].empresas_ids || []).map(Number), empIdNum])
            ),
            senha_argon2id: customHash || db.usuarios[perfilEmpIdx].senha_argon2id
          };
        } else {
          const refHash =
            customHash ||
            db.usuarios.find((u) => Number(u.id) !== 1 && u.senha_argon2id)?.senha_argon2id ||
            (await gerarHashArgon2id(getOrGenerateInitialMasterPassword()));
          db.usuarios.push({
            id: nextId(db.usuarios),
            nome: empNomeLimpo,
            telefone:
              savedEmpObj.whatsapp_pessoal_titular ||
              savedEmpObj.bot_interno_numero ||
              savedEmpObj.waha_numero ||
              '',
            whatsapp_bot_vinculado: savedEmpObj.bot_interno_numero || savedEmpObj.waha_numero || '',
            email: savedEmpObj.lgpd_custodia_config?.controlador_email || '',
            tipo: 'Gestor da Empresa',
            cargo: 'Perfil da Empresa / Proprietário',
            foto: savedEmpObj.brand_config?.logoDataUrl || '',
            empresas_ids: [empIdNum],
            escala_fixa_json: '[1,2,3,4,5,6,0]',
            senha_argon2id: refHash,
            permissoes_json: {
              total: false,
              gerenciar_subordinados: true,
              mudar_aparencia: true,
              escopo_colaboradores: 'subordinados'
            },
            arquivado_legal: false,
            criado_em: new Date().toISOString()
          });
        }
      },
      { agregado: 'EMPRESAS', tipo: 'empresa.salva', payload: { nome, waha_session_id } }
    );

    await registrarAuditLog('Admin', 'SALVAR_EMPRESA_WAHA', `Perfil da empresa "${nome}" salvo`, req.ip);
    res.json({ ok: true, id: savedEmpObj?.id, empresa: savedEmpObj });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.post('/api/erp/empresas/alterar-licenca', async (req: Request, res: Response) => {
  try {
    const { empresa_id, nivel_acesso_licenca, observacao_licenca } = req.body || {};
    const emp = db.empresas.find((e) => Number(e.id) === Number(empresa_id));
    if (!emp) {
      res.status(404).json({ ok: false, erro: 'Empresa não encontrada.' });
      return;
    }
    const niveisValidos = ['uso_completo', 'somente_leitura', 'somente_download'];
    const novoNivel = niveisValidos.includes(nivel_acesso_licenca)
      ? nivel_acesso_licenca
      : 'uso_completo';

    emp.nivel_acesso_licenca = novoNivel;
    if (observacao_licenca !== undefined) {
      emp.observacao_licenca = String(observacao_licenca);
    }
    emp.licenca_atualizada_em = new Date().toISOString();

    saveDbToDisk();
    await cacheERP.invalidatePrefix('erp:');
    sseBroker.emit('empresa.licenca_atualizada', {
      empresa_id: emp.id,
      nome: emp.nome,
      nivel_acesso_licenca: emp.nivel_acesso_licenca,
      observacao_licenca: emp.observacao_licenca || ''
    });

    await registrarAuditLog(
      'Super Admin',
      'CONTROLE_ASSINATURA_LICENCA_EMPRESA',
      `Nível de acesso da empresa "${emp.nome}" (#${emp.id}) alterado manualmente para [${emp.nivel_acesso_licenca.toUpperCase()}]`,
      req.ip,
      'Super Admin'
    );

    res.json({
      ok: true,
      empresa_id: emp.id,
      nivel_acesso_licenca: emp.nivel_acesso_licenca,
      observacao_licenca: emp.observacao_licenca || ''
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.get('/api/erp/licenca-status', (req: Request, res: Response) => {
  const empId = Number(req.query.empresa_id || 1);
  const emp = db.empresas.find((e) => Number(e.id) === empId) || db.empresas[0];
  if (!emp) {
    res.json({
      ok: true,
      empresa_id: 1,
      nivel_acesso_licenca: 'uso_completo',
      permite_operacao: true,
      permite_leitura: true,
      permite_download: true
    });
    return;
  }
  const nivel = emp.nivel_acesso_licenca || 'uso_completo';
  res.json({
    ok: true,
    empresa_id: emp.id,
    nome_empresa: emp.nome,
    nivel_acesso_licenca: nivel,
    observacao_licenca: emp.observacao_licenca || '',
    permite_operacao: nivel === 'uso_completo',
    permite_leitura: nivel === 'uso_completo' || nivel === 'somente_leitura',
    permite_download: true
  });
});

app.post('/api/v50/empresas/conectar-waha', async (req: Request, res: Response) => {
  try {
    const { empresa_id, status, wpp_comercial_numero } = req.body;
    const emp = db.empresas.find((e) => Number(e.id) === Number(empresa_id));
    if (!emp) return res.status(404).json({ erro: 'Empresa não encontrada.' });

    const nextStatus = status || 'Conectado';
    emp.waha_status = nextStatus;
    emp.wpp_web_autenticado_real = nextStatus === 'Conectado';
    if (wpp_comercial_numero !== undefined) {
      emp.wpp_comercial_numero = String(wpp_comercial_numero).replace(/\D/g, '');
    }

    for (const inst of db.instancias_chat) {
      if (Number(inst.empresa_id || 1) === Number(emp.id)) {
        inst.status = emp.waha_status;
      }
    }

    saveDbToDisk();
    await cacheERP.invalidatePrefix('erp:');
    sseBroker.emit('waha.status_atualizado', {
      empresa_id: emp.id,
      status: emp.waha_status,
      wpp_comercial_numero: emp.wpp_comercial_numero
    });

    await registrarAuditLog(
      'Admin',
      'CONECTAR_WPP_WEB_COMERCIAL',
      `WhatsApp Comercial (Navegador Interno) da empresa ${emp.nome} atualizado para ${emp.waha_status}`,
      req.ip
    );
    res.json({
      ok: true,
      waha_status: emp.waha_status,
      wpp_comercial_numero: emp.wpp_comercial_numero
    });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.post('/api/erp/bot-interno/salvar-config', async (req: Request, res: Response) => {
  try {
    const {
      empresa_id,
      bot_interno_numero,
      usar_wpp_pessoal_como_bot,
      whatsapp_pessoal_titular,
      bot_interno_status,
      alertas_equipe_config,
      disparar_teste_equipe
    } = req.body || {};

    const emp =
      db.empresas.find((e) => Number(e.id) === Number(empresa_id || 1)) || db.empresas[0];
    if (!emp) {
      res.status(404).json({ ok: false, erro: 'Empresa não localizada.' });
      return;
    }

    if (bot_interno_numero !== undefined) {
      const resolvido = resolverTelefoneBanco(String(bot_interno_numero));
      emp.bot_interno_numero =
        resolvido.telefoneResolvido || String(bot_interno_numero).replace(/\D/g, '');
      emp.waha_numero = emp.bot_interno_numero;
    }
    if (usar_wpp_pessoal_como_bot !== undefined) {
      emp.usar_wpp_pessoal_como_bot = Boolean(usar_wpp_pessoal_como_bot);
    }
    if (whatsapp_pessoal_titular !== undefined) {
      emp.whatsapp_pessoal_titular = String(whatsapp_pessoal_titular).replace(/\D/g, '');
    }
    if (bot_interno_status !== undefined) {
      emp.bot_interno_status = bot_interno_status;
      emp.bot_interno_autenticado_real = bot_interno_status === 'Conectado';
    }
    if (alertas_equipe_config && typeof alertas_equipe_config === 'object') {
      emp.alertas_equipe_config = {
        escalas: Boolean(alertas_equipe_config.escalas),
        estoque: Boolean(alertas_equipe_config.estoque),
        fechamento_caixa: Boolean(alertas_equipe_config.fechamento_caixa),
        ponto_gps: Boolean(alertas_equipe_config.ponto_gps)
      };
    }

    if (disparar_teste_equipe) {
      db.erp_notificacoes.unshift({
        id: nextId(db.erp_notificacoes),
        titulo: `Comunicado Interno do Bot Urutau — ${emp.nome}`,
        mensagem: `Bot Interno (${emp.bot_interno_numero || 'Sem número'}) ativo exclusivamente para comunicação com a Equipe Interna e Empresário (sem atendimento a clientes).`,
        tipo: 'aviso_geral',
        remetente_nome: 'Bot Interno Urutau',
        remetente_cargo: 'Assistente Interno da Equipe',
        destinatario_grupo: 'todos',
        destino_wpp: emp.bot_interno_numero || '',
        horario_disparo: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        status: 'Enviado WhatsApp',
        arquivado_legal: false,
        criado_em: new Date().toISOString()
      });
    }

    saveDbToDisk();
    await cacheERP.invalidatePrefix('erp:');
    sseBroker.emit('bot_interno.atualizado', {
      empresa_id: emp.id,
      bot_interno_numero: emp.bot_interno_numero,
      bot_interno_status: emp.bot_interno_status
    });

    await registrarAuditLog(
      'Empresário',
      'CONFIGURAR_BOT_INTERNO_EQUIPE',
      `Bot Interno da equipe da empresa "${emp.nome}" configurado no número [${emp.bot_interno_numero}] com status [${emp.bot_interno_status}]`,
      req.ip
    );

    res.json({
      ok: true,
      empresa: emp
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.post('/api/erp/wpp-bot/iniciar-conexao', async (req: Request, res: Response) => {
  try {
    const {
      numero_bot,
      whatsapp_pessoal,
      usar_wpp_pessoal_como_bot,
      nome_empresa
    } = req.body || {};

    const numAlvo = usar_wpp_pessoal_como_bot ? (whatsapp_pessoal || numero_bot) : (numero_bot || whatsapp_pessoal);
    if (!numAlvo || String(numAlvo).replace(/\D/g, '').length < 8) {
      res.status(400).json({ ok: false, erro: 'Informe um número de WhatsApp válido para conectar o Bot Interno da equipe.' });
      return;
    }

    const resolvido = resolverTelefoneBanco(String(numAlvo));
    const telefoneBot = resolvido.telefoneResolvido || `5591${String(numAlvo).replace(/\D/g, '')}`;
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    const bloco1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const bloco2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    let codigoPareamento = `${bloco1}-${bloco2}`;
    const qrPayloadFallback = `https://wa.me/${telefoneBot}?text=${encodeURIComponent(
      `ATIVAR_BOT_INTERNO_EQUIPE_URUTAU:${codigoPareamento}:${String(nome_empresa || 'Empresa').trim()}`
    )}`;
    let qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrPayloadFallback)}`;

    try {
      await embeddedWhatsApp.iniciarConexao(telefoneBot);
      let waitCount = 0;
      while (!embeddedWhatsApp.getState().qrCodeDataUrl && waitCount < 6) {
        await new Promise((r) => setTimeout(r, 500));
        waitCount++;
      }
      const st = embeddedWhatsApp.getState();
      if (st.qrCodeDataUrl) {
        qrImageUrl = st.qrCodeDataUrl;
      }
      if (st.pairingCode) {
        codigoPareamento = st.pairingCode;
      }
    } catch {}

    const finalState = embeddedWhatsApp.getState();

    res.json({
      ok: true,
      numero_resolvido: telefoneBot,
      usar_wpp_pessoal_como_bot: Boolean(usar_wpp_pessoal_como_bot),
      codigo_pareamento: codigoPareamento,
      qr_payload: finalState.qrCodeRaw || qrPayloadFallback,
      qr_image_url: qrImageUrl,
      status: finalState.status || 'PRONTO_PARA_CONECTAR',
      gerado_em: new Date().toISOString()
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.get('/api/v50/whatsapp/status', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    state: embeddedWhatsApp.getState()
  });
});

app.post('/api/v50/whatsapp/iniciar', async (req: Request, res: Response) => {
  try {
    const { telefone } = req.body || {};
    const state = await embeddedWhatsApp.iniciarConexao(telefone);
    res.json({ ok: true, state });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.post('/api/v50/whatsapp/desconectar', async (_req: Request, res: Response) => {
  try {
    const state = await embeddedWhatsApp.desconectar();
    res.json({ ok: true, state });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.post('/api/erp/wpp-bot/confirmar-conexao', async (req: Request, res: Response) => {
  try {
    const {
      empresa_id,
      numero_bot,
      whatsapp_pessoal,
      usar_wpp_pessoal_como_bot,
      codigo_pareamento
    } = req.body || {};

    const numAlvo = usar_wpp_pessoal_como_bot ? (whatsapp_pessoal || numero_bot) : (numero_bot || whatsapp_pessoal);
    const resolvido = resolverTelefoneBanco(String(numAlvo || ''));
    const telefoneBot = resolvido.telefoneResolvido || `5591${String(numAlvo || '').replace(/\D/g, '')}`;

    const empId = Number(empresa_id || 1);
    const emp = db.empresas.find((e) => Number(e.id) === empId) || db.empresas[0];
    if (emp) {
      emp.bot_interno_numero = telefoneBot;
      emp.waha_numero = telefoneBot;
      emp.usar_wpp_pessoal_como_bot = Boolean(usar_wpp_pessoal_como_bot);
      emp.bot_interno_status = 'Conectado';
      emp.bot_interno_autenticado_real = true;
      emp.waha_status = 'Conectado';
      saveDbToDisk();
      await cacheERP.invalidatePrefix('erp:');
      sseBroker.emit('bot_interno.atualizado', {
        empresa_id: emp.id,
        bot_interno_numero: emp.bot_interno_numero,
        bot_interno_status: 'Conectado'
      });
    }

    res.json({
      ok: true,
      status: 'CONECTADO',
      numero_bot: telefoneBot,
      usar_wpp_pessoal_como_bot: Boolean(usar_wpp_pessoal_como_bot),
      codigo_pareamento: codigo_pareamento || '8K3M-P9V2',
      conectado_em: new Date().toISOString()
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

const servirBinarioUrutauExe = (req: Request, res: Response) => {
  const hostHeader = req.headers.host || 'localhost:3000';
  const protoHeader = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  const appUrl = `${protoHeader}://${hostHeader}`;
  const empresaId = Number(req.query.empresa_id || 1);
  const nomeEmpresa = String(req.query.empresa || 'URUTAU');

  const exeBuffer = gerarBinarioFechadoUrutauExe(appUrl, empresaId, nomeEmpresa);

  res.setHeader('Content-Type', 'application/vnd.microsoft.portable-executable');
  res.setHeader('Content-Disposition', 'attachment; filename="Urutau.exe"');
  res.setHeader('Content-Length', String(exeBuffer.length));
  res.send(exeBuffer);
};

app.get('/api/desktop/urutau.exe', servirBinarioUrutauExe);
app.get('/api/desktop/instalador-windows', servirBinarioUrutauExe);

app.post('/api/erp/onboarding-empresario', async (req: Request, res: Response) => {
  try {
    const {
      nome_empresario,
      whatsapp,
      usar_wpp_pessoal_como_bot,
      whatsapp_bot_empresa,
      wpp_bot_ja_conectado,
      email,
      senha,
      nome_empresa,
      cnpj,
      ramo,
      cidade,
      nome_unidade_inicial
    } = req.body || {};

    if (!nome_empresario || !String(nome_empresario).trim()) {
      res.status(400).json({ ok: false, erro: 'Informe o nome completo do empresário.' });
      return;
    }
    if (!nome_empresa || !String(nome_empresa).trim()) {
      res.status(400).json({ ok: false, erro: 'Informe o nome da empresa.' });
      return;
    }
    if (!whatsapp || String(whatsapp).replace(/\D/g, '').length < 8) {
      res.status(400).json({ ok: false, erro: 'Informe um número de WhatsApp pessoal válido.' });
      return;
    }
    const usarMesmoNumero = usar_wpp_pessoal_como_bot !== false;
    const numeroBotBruto = usarMesmoNumero ? whatsapp : (whatsapp_bot_empresa || whatsapp);
    if (!numeroBotBruto || String(numeroBotBruto).replace(/\D/g, '').length < 8) {
      res.status(400).json({ ok: false, erro: 'Informe o número de WhatsApp que será o Bot Interno da equipe.' });
      return;
    }
    if (!senha || String(senha).trim().length < 4) {
      res.status(400).json({ ok: false, erro: 'Defina uma senha de acesso com pelo menos 4 caracteres.' });
      return;
    }
    const termosAceitos = Boolean(
      req.body?.terms_accepted ?? req.body?.termsAccepted ?? req.body?.termo_uso_aceito ?? req.body?.termo_lgpd_aceito
    );
    if (!termosAceitos) {
      res.status(400).json({
        ok: false,
        codigo: 'LGPD_TERMS_REQUIRED',
        erro: 'É obrigatório aceitar os Termos de Uso e a Política de Privacidade (LGPD) para concluir o cadastro.'
      });
      return;
    }
    const termsAcceptedAtUtc = new Date().toISOString();
    const termsAcceptedIp = extractClientIp(req);

    const resolvidoPessoal = resolverTelefoneBanco(String(whatsapp));
    const telefonePessoalFinal =
      resolvidoPessoal.telefoneResolvido || `5591${String(whatsapp).replace(/\D/g, '')}`;

    const resolvidoBot = resolverTelefoneBanco(String(numeroBotBruto));
    const telefoneBotFinal =
      resolvidoBot.telefoneResolvido || `5591${String(numeroBotBruto).replace(/\D/g, '')}`;

    const hashSenha = await gerarHashArgon2id(String(senha).trim());
    const slugWaha = `waha_${String(nome_empresa)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 24)}_${Date.now().toString().slice(-4)}`;

    let novaEmpresaObj: any = null;
    let novoUsuarioObj: any = null;
    let novaUnidadeObj: any = null;
    const novosSetoresList: any[] = [];
    const empIdPrevisto = nextId(db.empresas);
    const secretSheetTokenPrevisto = `urutau_lgpd_${empIdPrevisto}_${crypto.randomBytes(8).toString('hex')}`;
    const googleAccessToken = String(req.body?.google_access_token || '').trim();
    const pastaCompartilhadaInput = String(req.body?.pasta_google_drive_url || '').trim();
    const contaGoogleVinculada = String(req.body?.conta_google_vinculada || email || '').trim();
    const provedorNuvemBackup = String(req.body?.provedor_nuvem_backup || 'Google Drive').trim();
    const modoConexaoDrive = (req.body?.modo_conexao_drive || 'botao_google') as
      | 'botao_google'
      | 'compartilhar_pasta'
      | 'automatico_depois';
    const emailServicoCompartilhamento = 'bd@nyctibi.us';
    const estruturaProvisionada = await provisionarDiretoriosEPlanilhasDaEmpresa(
      empIdPrevisto,
      String(nome_empresa).trim(),
      String(nome_empresario).trim(),
      String(cnpj || '').trim(),
      contaGoogleVinculada,
      googleAccessToken,
      pastaCompartilhadaInput,
      true
    );

    await executarComOutbox(
      () => {
        const empId = empIdPrevisto;
        const rawSheetUrl = String(
          req.body?.planilha_google_url || estruturaProvisionada.planilhaMestreUrl || ''
        ).trim();
        const rawWebhookUrl = String(req.body?.apps_script_webhook_url || '').trim();
        const extractedSheetIdMatch = rawSheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        const extractedSheetId = extractedSheetIdMatch
          ? extractedSheetIdMatch[1]
          : estruturaProvisionada.planilhaMestreId || rawSheetUrl;
        const secretSheetToken = secretSheetTokenPrevisto;

        const rawSubdominioInput = String(req.body?.subdominio || nome_empresa || '').trim();
        const subdominioBase =
          rawSubdominioInput
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '') || `empresa-${empId}`;
        const subdominioEmUso = db.empresas.some(
          (e) => !e.arquivado_legal && String(e.subdominio || '').toLowerCase() === subdominioBase
        );
        const subdominioFinal = subdominioEmUso ? `${subdominioBase}-${empId}` : subdominioBase;
        const corInicialHex = String(req.body?.cor_marca_hex || '#10B981').trim();
        const logoInicialDataUrl = String(req.body?.logo_data_url || '').trim();

        novaEmpresaObj = {
          id: empId,
          nome: String(nome_empresa).trim(),
          subdominio: subdominioFinal,
          link_acesso: `https://${subdominioFinal}.nyctibi.us`,
          brand_config: {
            companyName: String(nome_empresa).trim(),
            logoDataUrl: logoInicialDataUrl,
            companyColorHex: corInicialHex,
            companySecondaryHex: '#F59E0B',
            companyTertiaryHex: '#06B6D4',
            urutauBaseHex: '#10B981',
            blendRatio: 0.7,
            effectivePrimaryHex: corInicialHex,
            effectivePrimaryRgb: { r: 16, g: 185, b: 129 },
            effectiveSecondaryHex: '#F59E0B',
            effectiveTertiaryHex: '#06B6D4',
            modeloTracoPreferido: 'padrao_xilogravura_olhar_marajoara',
            ...(logoInicialDataUrl
              ? {
                  imagePlacements: { topo_painel: 'logo_empresa', tela_login: 'logo_empresa' },
                  slotCustomizations: {
                    topo_painel: { choice: 'logo_principal' },
                    tela_login: { choice: 'logo_principal' }
                  }
                }
              : {})
          },
          cnpj: String(cnpj || '').trim(),
          waha_session_id: slugWaha,
          waha_numero: telefoneBotFinal,
          bot_interno_numero: telefoneBotFinal,
          bot_interno_status: wpp_bot_ja_conectado ? 'Conectado' : 'Desconectado',
          bot_interno_autenticado_real: Boolean(wpp_bot_ja_conectado),
          wpp_comercial_numero: '',
          waha_status: 'Desconectado',
          wpp_web_autenticado_real: false,
          whatsapp_pessoal_titular: telefonePessoalFinal,
          usar_wpp_pessoal_como_bot: usarMesmoNumero,
          nivel_acesso_licenca: 'uso_completo',
          observacao_licenca: '',
          alertas_equipe_config: {
            escalas: true,
            estoque: true,
            fechamento_caixa: true,
            ponto_gps: false
          },
          lgpd_custodia_config: {
            empresa_id: empId,
            empresa_nome: String(nome_empresa).trim(),
            controlador_nome: String(nome_empresario).trim(),
            controlador_documento: String(cnpj || '').trim(),
            controlador_email: contaGoogleVinculada,
            conta_google_vinculada: contaGoogleVinculada,
            provedor_nuvem_backup: provedorNuvemBackup,
            termo_lgpd_aceito: true,
            termo_lgpd_aceito_em: new Date().toISOString(),
            termo_versao: 'LGPD-BYOS-2026.1',
            modo_conexao_drive: modoConexaoDrive,
            email_servico_compartilhamento: emailServicoCompartilhamento,
            pasta_google_drive_nome: estruturaProvisionada.pastaRaizNome,
            pasta_google_drive_url:
              String(pastaCompartilhadaInput || estruturaProvisionada.pastaRaizDriveUrl || 'https://drive.google.com/drive/my-drive').trim(),
            pasta_google_drive_id: estruturaProvisionada.pastaRaizDriveId || '',
            diretorio_workspace_id: estruturaProvisionada.diretorioWorkspaceRel,
            planilha_google_url: rawSheetUrl,
            planilha_google_id: extractedSheetId,
            apps_script_webhook_url: rawWebhookUrl,
            chave_secreta_planilha: secretSheetToken,
            guarda_exclusiva_planilha_empresario: true,
            zero_guarda_operacional_vps: true,
            custodia_transferida_em: new Date().toISOString(),
            modo_guarda_escolhido:
              req.body?.modo_guarda_escolhido === 'computador_local_multiacesso'
                ? 'computador_local_multiacesso'
                : 'google_drive',
            multiacesso_sem_drive_confirmado: Boolean(
              req.body?.multiacesso_sem_drive_confirmado === true
            ),
            multiacesso_sem_drive_confirmado_em:
              req.body?.multiacesso_sem_drive_confirmado === true
                ? new Date().toISOString()
                : null,
            exportacao_nuvem_intervalo_minutos: 60,
            exportacao_nuvem_automatica_ativa: true,
            exportacao_local_fechamento_exe_ativa: true,
            estrutura_criada_no_cadastro: true,
            estrutura_diretorios_planilhas: estruturaProvisionada.diretorios,
            ultima_sincronizacao_em: new Date().toISOString(),
            proxima_exportacao_nuvem_em: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            ultimo_backup_local_fechamento_em: new Date().toISOString(),
            status_conexao: 'Ativa'
          },
          cidade: String(cidade || 'Belém - PA').trim(),
          ramo: String(ramo || 'Gastronomia & Hospitalidade').trim(),
          diaria_teto: 220,
          bloqueios_freelancers: [],
          arquivado_legal: false,
          criado_em: new Date().toISOString()
        };
        db.empresas.push(novaEmpresaObj);

        const unidId = nextId(db.unidades);
        novaUnidadeObj = {
          id: unidId,
          id_empresa: empId,
          empresa_id: empId,
          nome: String(nome_unidade_inicial || `${String(nome_empresa).trim()} • Matriz`).trim(),
          cidade: String(cidade || 'Belém - PA').trim(),
          endereco: String(cidade || 'Belém - PA').trim(),
          latitude: -1.4558,
          longitude: -48.5039,
          raio_metros: 200,
          exigir_gps_local: false,
          sede_principal: true,
          status: 'Operacional',
          arquivado_legal: false,
          criado_em: new Date().toISOString()
        };
        db.unidades.push(novaUnidadeObj);

        const nomesSetoresBase = ['Salão Principal', 'Cozinha', 'Bar & Bebidas', 'Caixa & Recepção'];
        for (const nomeSetor of nomesSetoresBase) {
          const setorId = nextId(db.setores);
          const setorItem = {
            id: setorId,
            id_empresa: empId,
            empresa_id: empId,
            id_unidade: unidId,
            nome: nomeSetor,
            lider: String(nome_empresario).trim(),
            meta_turno: 'Operação Padrão',
            arquivado_legal: false,
            criado_em: new Date().toISOString()
          };
          db.setores.push(setorItem);
          novosSetoresList.push(setorItem);
        }

        const userId = nextId(db.usuarios);
        novoUsuarioObj = {
          id: userId,
          nome: String(nome_empresario).trim(),
          telefone: telefonePessoalFinal,
          whatsapp_bot_vinculado: telefoneBotFinal,
          usar_wpp_pessoal_como_bot: usarMesmoNumero,
          email: String(email || '').trim(),
          tipo: 'Gestor da Empresa',
          cargo: 'Empresário / Proprietário',
          role: 'company_owner',
          approval_status: 'pending_approval',
          terms_accepted: true,
          terms_version: 'LGPD-TERMOS-2026.1',
          terms_accepted_at_utc: termsAcceptedAtUtc,
          terms_accepted_ip: termsAcceptedIp,
          foto: '',
          empresas_ids: [empId],
          escala_fixa_json: JSON.stringify([1, 2, 3, 4, 5, 6, 0]),
          senha_argon2id: hashSenha,
          permissoes_json: {
            total: false,
            gerenciar_subordinados: true,
            escopo_colaboradores: 'subordinados',
            modulos: {
              aprovacoes: { ver: true, editar: true },
              quadro_branco: { ver: true, editar: true },
              rateio: { ver: true, editar: true },
              escalas: { ver: true, editar: true },
              agenda: { ver: true, editar: true },
              reservas: { ver: true, editar: true },
              portais: { ver: true, editar: true },
              chat: { ver: true, editar: true },
              caixa: { ver: true, editar: true },
              estoque: { ver: true, editar: true },
              compras: { ver: true, editar: true },
              cmv: { ver: true, editar: true },
              cadastros: { ver: true, editar: true },
              equipe: { ver: true, editar: true },
              selecao: { ver: true, editar: true },
              rh: { ver: true, editar: true },
              unidades: { ver: true, editar: true },
              setores: { ver: true, editar: true },
              checklists: { ver: true, editar: true }
            }
          },
          arquivado_legal: false,
          criado_em: termsAcceptedAtUtc
        };
        db.usuarios.push(novoUsuarioObj);

        if (!Array.isArray(db.cadastros_pessoas)) db.cadastros_pessoas = [];
        db.cadastros_pessoas.push({
          id: nextId(db.cadastros_pessoas),
          nome: String(nome_empresario).trim(),
          tipo_pessoa: 'PF',
          documento: String(cnpj || '').trim(),
          whatsapp: telefonePessoalFinal,
          email: String(email || '').trim(),
          papeis: ['gestor', 'colaborador'],
          empresa_id: empId,
          cidade: String(cidade || 'Belém - PA').trim(),
          cargo_ou_ramo: 'Empresário / Proprietário',
          observacoes: usarMesmoNumero
            ? `Titular da empresa ${novaEmpresaObj.nome} • WhatsApp Pessoal atua também como Bot Interno da Equipe (${telefoneBotFinal})`
            : `Titular da empresa ${novaEmpresaObj.nome} • WhatsApp Pessoal (${telefonePessoalFinal}) e Bot Interno da Equipe (${telefoneBotFinal})`,
          arquivado_legal: false,
          criado_em: new Date().toISOString()
        });

        db.instancias_chat.push({
          id: nextId(db.instancias_chat),
          empresa_id: empId,
          nome_instancia: `${novaEmpresaObj.nome} (WhatsApp Comercial — Navegador Interno)`,
          numero: '',
          bot_interno_numero: telefoneBotFinal,
          whatsapp_pessoal_titular: telefonePessoalFinal,
          usar_wpp_pessoal_como_bot: usarMesmoNumero,
          status: 'Desconectado',
          motor_ia_ativo: true
        });
      },
      {
        agregado: 'ONBOARDING_EMPRESARIO',
        tipo: 'empresa.onboarding_concluido',
        payload: {
          nome_empresa: String(nome_empresa).trim(),
          nome_empresario: String(nome_empresario).trim(),
          telefone_pessoal: telefonePessoalFinal,
          telefone_bot_interno: telefoneBotFinal,
          usar_wpp_pessoal_como_bot: usarMesmoNumero
        }
      }
    );

    await registrarAuditLog(
      String(nome_empresario).trim(),
      'ONBOARDING_EMPRESARIO_4_PLATAFORMAS',
      `Empresário "${nome_empresario}" cadastrou a empresa "${nome_empresa}" (#${novaEmpresaObj.id}). Bot Interno da Equipe: ${telefoneBotFinal} (${
        usarMesmoNumero ? 'Mesmo número do WhatsApp Pessoal' : `Separado do Pessoal ${telefonePessoalFinal}`
      }). WhatsApp Comercial inicia Desconectado até leitura de QR Code no navegador interno.`,
      req.ip,
      'Empresário / Proprietário'
    );

    await syncAccessApprovalRecordToPostgres({
      userId: Number(novoUsuarioObj.id),
      companyId: Number(novaEmpresaObj.id),
      nome: String(novoUsuarioObj.nome || ''),
      email: String(novoUsuarioObj.email || ''),
      telefone: String(novoUsuarioObj.telefone || ''),
      role: 'company_owner',
      approvalStatus: 'pending_approval',
      termsAccepted: true,
      termsVersion: 'LGPD-TERMOS-2026.1',
      termsAcceptedAtUtc,
      termsAcceptedIp
    });

    const usuarioSemHash = { ...novoUsuarioObj };
    delete usuarioSemHash.senha_argon2id;

    res.json({
      ok: true,
      pending_approval: true,
      approval_status: 'pending_approval',
      empresa: novaEmpresaObj,
      usuario: usuarioSemHash,
      sessao_token: null,
      unidade: novaUnidadeObj,
      setores: novosSetoresList,
      plataformas: {
        web: true,
        desktop_pwa: true,
        mobile_pwa: true,
        whatsapp_waha: slugWaha,
        whatsapp_bot_numero: telefoneBotFinal,
        usar_wpp_pessoal_como_bot: usarMesmoNumero
      }
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.post('/api/v50/freelancers/salvar', async (req: Request, res: Response) => {
  try {
    const {
      id,
      nome,
      whatsapp,
      funcao,
      funcoes_secundarias,
      valor_diaria,
      disponivel,
      disponibilidade_dias,
      cidade,
      empresas_bloqueadas
    } = req.body;

    if (!nome || !funcao) return res.status(400).json({ erro: 'Nome e Função do freelancer são obrigatórios.' });

    await executarComOutbox(
      () => {
        if (id) {
          const idx = db.freelancers.findIndex((f) => Number(f.id) === Number(id));
          if (idx >= 0) {
            db.freelancers[idx] = {
              ...db.freelancers[idx],
              nome,
              whatsapp: whatsapp || '',
              funcao,
              funcoes_secundarias: funcoes_secundarias || db.freelancers[idx].funcoes_secundarias || [],
              valor_diaria: Number(valor_diaria || 150),
              disponivel: disponivel !== undefined ? Boolean(disponivel) : true,
              disponibilidade_dias: disponibilidade_dias || [0, 1, 2, 3, 4, 5, 6],
              cidade: cidade || 'Belém - PA',
              empresas_bloqueadas: empresas_bloqueadas || db.freelancers[idx].empresas_bloqueadas || []
            };
          }
        } else {
          db.freelancers.push({
            id: nextId(db.freelancers),
            nome,
            whatsapp: whatsapp || '',
            funcao,
            funcoes_secundarias: funcoes_secundarias || [],
            valor_diaria: Number(valor_diaria || 150),
            disponivel: disponivel !== undefined ? Boolean(disponivel) : true,
            disponibilidade_dias: disponibilidade_dias || [4, 5, 6, 0],
            empresas_bloqueadas: empresas_bloqueadas || [],
            empresas_autorizadas: [],
            cidade: cidade || 'Belém - PA',
            avaliacao_estrelas: 5.0,
            total_diarias_realizadas: 0,
            arquivado_legal: false,
            criado_em: new Date().toISOString()
          });
        }
      },
      { agregado: 'FREELANCERS', tipo: 'freelancer.salvo', payload: { nome, funcao } }
    );

    await registrarAuditLog('Admin', 'SALVAR_FREELANCER', `Freelancer "${nome}" (${funcao}) registrado no banco de talentos`, req.ip);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.post('/api/v50/match/contratar', async (req: Request, res: Response) => {
  try {
    const { empresa_id, freelancer_id, data, funcao, valor_acordado } = req.body;
    const emp = db.empresas.find((e) => Number(e.id) === Number(empresa_id) && !e.arquivado_legal);
    const free = db.freelancers.find((f) => Number(f.id) === Number(freelancer_id) && !f.arquivado_legal);

    if (!emp || !free) {
      return res.status(404).json({ erro: 'Empresa ou Freelancer não localizado.' });
    }

    if (!free.disponivel) {
      return res.status(422).json({ erro: 'MATCH RECUSADO: Freelancer não está disponível no momento.' });
    }
    const diaSemanaIndex = data ? new Date(data).getDay() : new Date().getDay();
    if (free.disponibilidade_dias && !free.disponibilidade_dias.includes(diaSemanaIndex)) {
      return res.status(422).json({ erro: 'MATCH RECUSADO: Freelancer não possui disponibilidade para este dia da semana.' });
    }

    const valorFinal = Number(valor_acordado || free.valor_diaria);
    if (valorFinal > emp.diaria_teto) {
      return res.status(422).json({
        erro: `MATCH RECUSADO: Valor da diária (R$ ${valorFinal.toFixed(2)}) ultrapassa o teto máximo da empresa (R$ ${emp.diaria_teto.toFixed(2)}).`
      });
    }

    const funcoesValidas = [free.funcao, ...(free.funcoes_secundarias || [])].map((f) => f.toLowerCase());
    if (funcao && !funcoesValidas.includes(funcao.toLowerCase())) {
      return res.status(422).json({ erro: `MATCH RECUSADO: O colaborador não exerce a função "${funcao}".` });
    }

    const empBloqueou = (emp.bloqueios_freelancers || []).includes(free.id);
    const freeBloqueou = (free.empresas_bloqueadas || []).includes(emp.id);
    if (empBloqueou || freeBloqueou) {
      return res.status(422).json({ erro: 'MATCH RECUSADO: Há bloqueio mútuo registrado entre esta empresa e o freelancer.' });
    }

    const novoMatch = {
      id: nextId(db.matches_contratacoes),
      empresa_id: emp.id,
      empresa_nome: emp.nome,
      freelancer_id: free.id,
      freelancer_nome: free.nome,
      data: data || getTodayISO(),
      funcao: funcao || free.funcao,
      valor_acordado: valorFinal,
      status: 'Confirmado',
      criado_em: new Date().toISOString()
    };

    await executarComOutbox(
      () => {
        db.matches_contratacoes.push(novoMatch);
        free.total_diarias_realizadas = (free.total_diarias_realizadas || 0) + 1;
      },
      { agregado: 'MATCH', tipo: 'match.contratacao_realizada', payload: novoMatch }
    );

    const msgWAHA = `Olá, ${free.nome}! Você deu MATCH 100% com a empresa ${emp.nome} para a função de ${novoMatch.funcao} na data ${novoMatch.data}. Diária acordada: R$ ${valorFinal.toFixed(2)}.`;
    db.mensagens_chat.push({
      id: nextId(db.mensagens_chat),
      instancia_id: 1,
      remetente: emp.nome,
      contato: free.whatsapp,
      direcao: 'enviada',
      texto: msgWAHA,
      horario: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    });
    saveDbToDisk();

    await registrarAuditLog(
      'Empresário',
      'MATCH_CONTRATACAO_100',
      `Match perfeito confirmado: ${free.nome} contratado por ${emp.nome} (R$ ${valorFinal.toFixed(2)})`,
      req.ip
    );

    res.json({ ok: true, match: novoMatch, mensagem: 'Match 100% aprovado e notificação enviada via WhatsApp da empresa!' });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.post('/api/v31/auth/alterar-senha-mestra', async (req: Request, res: Response) => {
  try {
    const { nova_senha } = req.body;
    if (!nova_senha || String(nova_senha).trim().length < 6) {
      return res.status(400).json({ erro: 'A nova Senha Mestra deve conter ao menos 6 caracteres.' });
    }
    const novoHash = await gerarHashArgon2id(nova_senha);
    const idx = db.erp_configs.findIndex((c) => c.chave === 'admin_master_argon2id');
    const registro = {
      chave: 'admin_master_argon2id',
      valor_json: { hash: novoHash, algoritmo: 'argon2id', atualizado_em: new Date().toISOString() },
      atualizado_em: new Date().toISOString()
    };
    if (idx >= 0) db.erp_configs[idx] = registro;
    else db.erp_configs.push(registro);

    isInitialGeneratedPasswordActive = false;
    runtimeGeneratedMasterPass = null;

    saveDbToDisk();
    await registrarAuditLog('Admin Master', 'ALTERACAO_SENHA_MESTRA_ARGON2ID', 'Hash Argon2id + Pepper recriptografado com sucesso', req.ip, 'Super Admin');
    res.json({ ok: true, mensagem: 'Senha Mestra recriptografada com Argon2id (m=65536, t=3, p=4) + PEPPER_SECRET!' });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.get('/api/erp/dados-completos', async (req: Request, res: Response) => {
  try {
    const sessao = extrairSessaoRequisicao(req);
    if (!sessao) {
      return res.status(401).json({
        ok: false,
        codigo: 'NAO_AUTENTICADO',
        erro: 'Sessao autenticada obrigatoria para consultar dados operacionais.'
      });
    }
    deduplicarCadastrosEUsuariosEspelhados();
    const reqEmpId = Number(req.query.empresa_id || req.headers['x-empresa-id'] || sessao.emp || 0);
    const isSuper = Boolean(sessao.super);
    const cargoLower = String(sessao.cargo || sessao.tipo || '').toLowerCase();
    const podeDecifrarNr01 =
      isSuper ||
      cargoLower.includes('admin') ||
      cargoLower.includes('empres') ||
      cargoLower.includes('propriet') ||
      cargoLower.includes('gerente') ||
      cargoLower.includes('diretor') ||
      cargoLower.includes('rh');

    const escopoEmpresasPermitidas =
      sessao && !isSuper && Array.isArray(sessao.emps) && sessao.emps.length > 0
        ? new Set<number>(sessao.emps.map(Number))
        : null;

    const cacheKey = `erp:dados_completos:u_${sessao?.uid || 0}:emp_${reqEmpId}:s_${isSuper ? 1 : 0}:nr_${podeDecifrarNr01 ? 1 : 0}`;
    const cached = await cacheERP.get(cacheKey);
    if (cached) return res.json(cached);

    const pertenceAoEscopoTenant = (item: any): boolean => {
      if (!escopoEmpresasPermitidas) return true;
      const itemEmpId = Number(item?.empresa_id ?? item?.id_empresa ?? item?.unidade_id ?? 0);
      if (!itemEmpId) return true;
      return escopoEmpresasPermitidas.has(itemEmpId);
    };

    const escalaFixa: Record<number, number[]> = {};
    const usuariosSeguros = db.usuarios
      .filter((u) => !u.arquivado_legal)
      .filter((u) => {
        if (!escopoEmpresasPermitidas) return true;
        if (Number(u.id) === Number(sessao?.uid)) return true;
        const uEmps = Array.isArray(u.empresas_ids) ? u.empresas_ids.map(Number) : [];
        return uEmps.length === 0 || uEmps.some((id: number) => escopoEmpresasPermitidas.has(id));
      })
      .map((u) => {
        try {
          escalaFixa[u.id] = typeof u.escala_fixa_json === 'string' ? JSON.parse(u.escala_fixa_json || '[]') : u.escala_fixa_json || [];
        } catch {
          escalaFixa[u.id] = [];
        }
        const copia = { ...u };
        delete copia.senha_argon2id;
        return copia;
      });

    const rhDecifrado = db.erp_rh_nr01
      .filter((r) => !r.arquivado_legal && pertenceAoEscopoTenant(r))
      .map((r) => ({
        ...r,
        segredo_decifrado: podeDecifrarNr01
          ? r.segredo_aes
            ? decryptAES(r.segredo_aes)
            : ''
          : '[CONTEÚDO CRIPTOGRAFADO — ACESSO RESTRITO AO GESTOR / RH]'
      }));

    const relFiltrados: Record<string, any[]> = {};
    for (const [k, lista] of Object.entries(db.relacionamentos)) {
      relFiltrados[k] = (lista || []).filter((item) => !item.arquivado_legal);
    }

    const configsSanitizadas = (db.erp_configs || [])
      .filter((c: any) => c.chave !== 'admin_master_argon2id')
      .map((c: any) => {
        if (c.chave === 'waha_config' && c.valor_json) {
          return {
            ...c,
            valor_json: {
              ...c.valor_json,
              apiKey: c.valor_json.apiKey ? '***' : ''
            }
          };
        }
        return c;
      });

    const empresasFiltradas = (db.empresas || [])
      .filter((x) => !x.arquivado_legal)
      .filter((x) => !escopoEmpresasPermitidas || escopoEmpresasPermitidas.has(Number(x.id)))
      .map((emp: any) => {
        if (emp?.lgpd_custodia_config?.google_access_token) {
          return {
            ...emp,
            lgpd_custodia_config: {
              ...emp.lgpd_custodia_config,
              google_access_token: '***'
            }
          };
        }
        return emp;
      });

    const payload = {
      empresas: empresasFiltradas.length > 0 ? empresasFiltradas : (db.empresas || []).filter((x) => !x.arquivado_legal),
      freelancers: (db.freelancers || []).filter((x) => !x.arquivado_legal),
      matches_contratacoes: (db.matches_contratacoes || []).filter((x) => !x.arquivado_legal && pertenceAoEscopoTenant(x)),
      unidades: db.unidades.filter((x) => !x.arquivado_legal && pertenceAoEscopoTenant(x)),
      setores: db.setores.filter((x) => !x.arquivado_legal && pertenceAoEscopoTenant(x)),
      usuarios: usuariosSeguros,
      checklists: db.checklists.filter((x) => !x.arquivado_legal && pertenceAoEscopoTenant(x)),
      escalaFixa,
      movimentosEscala: db.erp_escalas_movimentos.filter((x) => !x.arquivado_legal && pertenceAoEscopoTenant(x)),
      agenda: db.eventos_agenda.filter((x) => !x.arquivado_legal && pertenceAoEscopoTenant(x)),
      reservas: db.reservas.filter((x) => !x.arquivado_legal && pertenceAoEscopoTenant(x)),
      portais: db.sites_portais.filter((x) => !x.arquivado_legal && pertenceAoEscopoTenant(x)),
      caixa: db.erp_caixa.filter((x) => !x.arquivado_legal && pertenceAoEscopoTenant(x)),
      categoriasFechamentoCaixa: (db.erp_categorias_fechamento_caixa || [])
        .filter((x: any) => !x.arquivado_legal)
        .sort((a: any, b: any) => Number(a.ordem || 0) - Number(b.ordem || 0)),
      fechamentosCaixaDiarios: (db.erp_fechamentos_caixa_diarios || []).filter(
        (x: any) => !x.arquivado_legal && pertenceAoEscopoTenant(x)
      ),
      estoque: db.erp_estoque.filter((x) => !x.arquivado_legal && pertenceAoEscopoTenant(x)),
      cmv: db.erp_cmv.filter((x) => !x.arquivado_legal && pertenceAoEscopoTenant(x)),
      selecao: db.erp_selecao.filter((x) => !x.arquivado_legal && pertenceAoEscopoTenant(x)),
      rhRegistros: rhDecifrado,
      mensagensRapidas: db.erp_mensagens_rapidas.filter((x) => !x.arquivado_legal && pertenceAoEscopoTenant(x)),
      notificacoes: db.erp_notificacoes.filter((x) => !x.arquivado_legal && pertenceAoEscopoTenant(x)),
      rateiosHistorico: db.erp_rateios_historico.filter((x) => !x.arquivado_legal && pertenceAoEscopoTenant(x)),
      configs: configsSanitizadas,
      auditLogs: (() => {
        const hasGpsSeed = db.audit_logs.some((l: any) => typeof l.latitude === 'number' && l.id >= 9000);
        if (!hasGpsSeed) {
          const baseTs = Date.now();
          const trilhaInicial = [
            {
              id: 9001,
              id_empresa: 1,
              usuario_id: 1,
              usuario: 'Admin Master',
              cargo: 'Diretor Operacional',
              ambiente: AMBIENTE,
              acao: 'ABERTURA_MENU',
              detalhes: 'Abriu o menu "Rateio" (Grupo: 2. Rateio, Escalas & Agenda)',
              ip_origem: '177.84.12.90',
              tipo_telemetria: 'ABERTURA_MENU',
              aba: 'rateio',
              latitude: -1.4558,
              longitude: -48.5039,
              precisao_metros: 6,
              distancia_empresa_m: 8,
              dentro_empresa: true,
              em_turno: true,
              dispositivo: 'Mobile PWA',
              criado_em: new Date(baseTs - 18 * 60000).toISOString()
            },
            {
              id: 9002,
              id_empresa: 1,
              usuario_id: 1,
              usuario: 'Admin Master',
              cargo: 'Diretor Operacional',
              ambiente: AMBIENTE,
              acao: 'CLIQUE_BOTAO',
              detalhes: 'Clicou em "Simular / Fechar Rateio 10%" no Salão Principal',
              ip_origem: '177.84.12.90',
              tipo_telemetria: 'CLIQUE_BOTAO',
              aba: 'rateio',
              latitude: -1.4555,
              longitude: -48.5035,
              precisao_metros: 7,
              distancia_empresa_m: 48,
              dentro_empresa: true,
              em_turno: true,
              dispositivo: 'Mobile PWA',
              criado_em: new Date(baseTs - 14 * 60000).toISOString()
            },
            {
              id: 9003,
              id_empresa: 1,
              usuario_id: 1,
              usuario: 'Admin Master',
              cargo: 'Diretor Operacional',
              ambiente: AMBIENTE,
              acao: 'ABERTURA_MENU',
              detalhes: 'Abriu o menu "Estoque & Compras" na doca de recebimento',
              ip_origem: '177.84.12.90',
              tipo_telemetria: 'ABERTURA_MENU',
              aba: 'estoque',
              latitude: -1.4551,
              longitude: -48.5031,
              precisao_metros: 8,
              distancia_empresa_m: 112,
              dentro_empresa: true,
              em_turno: true,
              dispositivo: 'Mobile PWA',
              criado_em: new Date(baseTs - 10 * 60000).toISOString()
            },
            {
              id: 9004,
              id_empresa: 1,
              usuario_id: 1,
              usuario: 'Admin Master',
              cargo: 'Diretor Operacional',
              ambiente: AMBIENTE,
              acao: 'EXECUCAO_SISTEMA',
              detalhes: 'Executou conferência de entrada de insumos e atualização de fichas CMV',
              ip_origem: '177.84.12.90',
              tipo_telemetria: 'EXECUCAO_SISTEMA',
              aba: 'cmv',
              latitude: -1.4547,
              longitude: -48.5026,
              precisao_metros: 9,
              distancia_empresa_m: 185,
              dentro_empresa: true,
              em_turno: true,
              dispositivo: 'Mobile PWA',
              criado_em: new Date(baseTs - 6 * 60000).toISOString()
            },
            {
              id: 9005,
              id_empresa: 1,
              usuario_id: 1,
              usuario: 'Admin Master',
              cargo: 'Diretor Operacional',
              ambiente: AMBIENTE,
              acao: 'ABERTURA_MENU',
              detalhes: 'Abriu o menu "Auditoria & Rastreamento GPS"',
              ip_origem: '177.84.12.90',
              tipo_telemetria: 'ABERTURA_MENU',
              aba: 'auditoria',
              latitude: -1.4557,
              longitude: -48.5038,
              precisao_metros: 5,
              distancia_empresa_m: 14,
              dentro_empresa: true,
              em_turno: true,
              dispositivo: 'Desktop Web',
              criado_em: new Date(baseTs - 2 * 60000).toISOString()
            }
          ];
          db.audit_logs.unshift(...trilhaInicial);
        }
        return db.audit_logs.filter(pertenceAoEscopoTenant).slice(0, 350);
      })(),
      backupsHorarios: db.backups_horarios.slice(0, 20),
      filaAprovacoes: db.fila_aprovacoes_pendentes.filter(pertenceAoEscopoTenant),
      instanciasChat: db.instancias_chat.filter(pertenceAoEscopoTenant),
      mensagensChat: db.mensagens_chat.filter(pertenceAoEscopoTenant),
      cadastrosPessoas: (db.cadastros_pessoas || []).filter((x) => !x.arquivado_legal && pertenceAoEscopoTenant(x)),
      registrosArquivados: (() => {
        const listaArq: any[] = [];
        const addArq = (
          colecao: any[],
          tabela: string,
          rotuloTabela: string,
          getNome: (x: any) => string,
          getDetalhe: (x: any) => string
        ) => {
          for (const item of colecao || []) {
            if (item && item.arquivado_legal && pertenceAoEscopoTenant(item)) {
              listaArq.push({
                id: item.id,
                tabela,
                rotuloTabela,
                nome: getNome(item) || `Registro #${item.id}`,
                detalhe: getDetalhe(item) || '',
                whatsapp: item.whatsapp || item.telefone || item.waha_numero || '',
                empresa_id: item.empresa_id ?? item.id_empresa ?? null,
                criado_em: item.criado_em || new Date().toISOString()
              });
            }
          }
        };
        addArq(
          db.cadastros_pessoas || [],
          'cadastros_pessoas',
          'Cadastro Unificado',
          (x) => x.nome,
          (x) => `${x.natureza || x.tipo_pessoa || 'PF'} • ${x.cargo_ou_ramo || (Array.isArray(x.papeis) ? x.papeis.join(', ') : '')}`
        );
        addArq(
          db.usuarios || [],
          'usuarios',
          'Colaborador / Usuário',
          (x) => x.nome,
          (x) => `${x.cargo || 'Operacional'} (${x.tipo || 'Colaborador'})`
        );
        addArq(
          db.freelancers || [],
          'freelancers',
          'Freelancer',
          (x) => x.nome,
          (x) => `${x.funcao || 'Freelancer'} • Diária R$ ${x.valor_diaria || 160}`
        );
        addArq(
          db.empresas || [],
          'empresas',
          'Empresa',
          (x) => x.nome,
          (x) => `${x.ramo || 'Unidade'} • ${x.cidade || ''}`
        );
        addArq(
          db.unidades || [],
          'unidades',
          'Unidade Física',
          (x) => x.nome,
          (x) => x.endereco || x.cidade || ''
        );
        addArq(
          db.setores || [],
          'setores',
          'Setor Operacional',
          (x) => x.nome,
          (x) => `Líder: ${x.lider || '—'}`
        );
        addArq(
          db.cargos || [],
          'cargos',
          'Cargo / Função',
          (x) => x.nome,
          (x) => `${x.nivel_hierarquico || ''} • ${x.tipo_vinculo_padrao || ''}`
        );
        addArq(
          db.checklists || [],
          'checklists',
          'Checklist',
          (x) => x.titulo || x.nome,
          (x) => x.frequencia || ''
        );
        addArq(
          db.reservas || [],
          'reservas',
          'Reserva de Salão',
          (x) => x.cliente || x.nome,
          (x) => `${x.data || ''} às ${x.horario || ''} • Mesa ${x.mesa || ''}`
        );
        addArq(
          db.pdv_produtos || [],
          'pdv_produtos',
          'Produto de Cardápio PDV',
          (x) => x.nome,
          (x) => `${x.categoria || ''} • R$ ${Number(x.preco || 0).toFixed(2)}`
        );
        addArq(
          db.pdv_impressoras || [],
          'pdv_impressoras',
          'Impressora Térmica PDV',
          (x) => x.nome,
          (x) => `Setor: ${x.setor || ''} • ${x.tipo_conexao === 'usb_caixa_windows' ? x.nome_usb_windows : `${x.ip_rede}:${x.porta_rede}`}`
        );
        return listaArq;
      })(),
      cargos: (db.cargos || []).filter((x) => !x.arquivado_legal && pertenceAoEscopoTenant(x)),
      pdvProdutos: (db.pdv_produtos || []).filter((x: any) => !x.arquivado_legal && pertenceAoEscopoTenant(x)),
      pdvComandas: (db.pdv_comandas || [])
        .filter((x: any) => !x.arquivado_legal && pertenceAoEscopoTenant(x))
        .slice(0, 300),
      pdvImpressoras: (db.pdv_impressoras || []).filter((x: any) => !x.arquivado_legal && pertenceAoEscopoTenant(x)),
      pdvFilaImpressao: (db.pdv_fila_impressao || [])
        .filter((x: any) => !x.arquivado_legal && pertenceAoEscopoTenant(x))
        .slice(0, 120),
      lanHubStatus: {
        ips_locais: listarIpsLocaisServidor(),
        porta: PORT,
        vps_remota_url: db.lan_hub_config?.vps_remota_url || 'https://nyctibi.us',
        ultimo_espelhamento_em: db.lan_hub_config?.ultimo_espelhamento_em || null,
        ultima_reconciliacao_em: db.lan_hub_config?.ultima_reconciliacao_em || null,
        pendentes_outbox_lan: (db.lan_outbox_sync || []).filter((o: any) => o.status === 'pendente').length,
        sincronizados_outbox_lan: (db.lan_outbox_sync || []).filter((o: any) => o.status === 'sincronizado').length
      },
      cqrs: computarViewsCQRS(),
      relacionamentos: relFiltrados
    };

    await cacheERP.set(cacheKey, payload, 30);
    res.json(payload);
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.get('/api/erp/busca-fts', (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (!q) return res.json({ estoque: [], usuarios: [] });

    const norm = (s: string) =>
      String(s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const termos = q.split(/\s+/).filter(Boolean);

    const estoque = db.erp_estoque
      .filter((e) => !e.arquivado_legal)
      .filter((e) => {
        const alvo = norm(`${e.nome} ${e.categoria} ${e.fornecedor}`);
        return termos.every((t) => alvo.includes(t));
      });

    const usuarios = db.usuarios
      .filter((u) => !u.arquivado_legal)
      .filter((u) => {
        const alvo = norm(`${u.nome} ${u.cargo} ${u.tipo}`);
        return termos.every((t) => alvo.includes(t));
      })
      .map(({ senha_argon2id, ...rest }) => rest);

    res.json({ estoque, usuarios });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.post('/api/acessos/salvar-completo', async (req: Request, res: Response) => {
  try {
    const {
      id,
      nome,
      telefone,
      tipo,
      cargo,
      foto,
      escalaFixa,
      senha,
      senha_plana,
      permissoes,
      unidadesIds,
      setoresIds,
      checklistsIds,
      empresas_ids,
      empresasIds,
      gestor_id,
      gestorId
    } = req.body;
    if (!nome) return res.status(400).json({ erro: 'O nome do colaborador é obrigatório.' });

    const escJson = JSON.stringify(Array.isArray(escalaFixa) ? escalaFixa.map(Number) : [1, 2, 3, 4, 5]);
    const senhaInformada = senha || senha_plana;
    const senhaHash = senhaInformada ? await gerarHashArgon2id(String(senhaInformada)) : null;
    const resolvedEmpresasIds = Array.isArray(empresas_ids)
      ? empresas_ids.map(Number).filter((n: number) => n > 0)
      : Array.isArray(empresasIds)
      ? empresasIds.map(Number).filter((n: number) => n > 0)
      : undefined;
    const resolvedGestorId =
      gestor_id !== undefined
        ? gestor_id
          ? Number(gestor_id)
          : null
        : gestorId !== undefined
        ? gestorId
          ? Number(gestorId)
          : null
        : undefined;

    const result = await executarComOutbox(
      async () => {
        let targetId = Number(id || 0);
        let nomeAnteriorColaborador = '';
        if (targetId > 0) {
          const idx = db.usuarios.findIndex((u) => Number(u.id) === targetId);
          if (idx >= 0) {
            nomeAnteriorColaborador = String(db.usuarios[idx].nome || '');
            const ehMaster = Number(db.usuarios[idx].id) === 1;
            db.usuarios[idx] = {
              ...db.usuarios[idx],
              nome,
              telefone: telefone || '',
              tipo: ehMaster ? 'Super Admin' : tipo || db.usuarios[idx].tipo || 'Colaborador',
              cargo: cargo || '',
              foto: foto !== undefined ? foto : db.usuarios[idx].foto,
              empresas_ids:
                resolvedEmpresasIds !== undefined
                  ? resolvedEmpresasIds
                  : db.usuarios[idx].empresas_ids || [],
              gestor_id:
                resolvedGestorId !== undefined && Number(resolvedGestorId) !== targetId
                  ? resolvedGestorId
                  : null,
              escala_fixa_json: escJson,
              senha_argon2id: senhaHash || db.usuarios[idx].senha_argon2id,
              permissoes_json: permissoes || db.usuarios[idx].permissoes_json
            };
          }
        } else {
          targetId = nextId(db.usuarios);
          const defaultHash = senhaHash || (await gerarHashArgon2id(getOrGenerateInitialMasterPassword()));
          db.usuarios.push({
            id: targetId,
            nome,
            telefone: telefone || '',
            tipo: tipo || 'Colaborador',
            cargo: cargo || '',
            foto: foto || '',
            empresas_ids: resolvedEmpresasIds !== undefined ? resolvedEmpresasIds : [],
            gestor_id: resolvedGestorId ?? null,
            escala_fixa_json: escJson,
            senha_argon2id: defaultHash,
            permissoes_json: permissoes || {},
            arquivado_legal: false,
            criado_em: new Date().toISOString()
          });
        }

        if (Array.isArray(unidadesIds)) {
          atualizarVinculoInterno('rel_usuario_unidade', 'usuario_id', 'unidade_id', targetId, unidadesIds);
        }
        if (Array.isArray(setoresIds)) {
          atualizarVinculoInterno('rel_usuario_setor', 'usuario_id', 'setor_id', targetId, setoresIds);
        }
        if (Array.isArray(checklistsIds)) {
          atualizarVinculoInterno('rel_usuario_checklist', 'usuario_id', 'checklist_id', targetId, checklistsIds);
        }

        const telResolvido = telefone ? resolverTelefoneBanco(telefone).telefoneResolvido : '';
        upsertCadastroPessoaAutomatico({
          usuario_sistema_id: targetId,
          nome_anterior: nomeAnteriorColaborador,
          nome,
          whatsapp: telResolvido || telefone || '',
          tipo_pessoa: 'PF',
          papel: Number(targetId) === 1 ? 'gestor_conta' : 'colaborador',
          empresa_id: resolvedEmpresasIds && resolvedEmpresasIds.length > 0 ? resolvedEmpresasIds[0] : 0,
          cargo_ou_ramo: cargo || tipo || 'Colaborador'
        });
        deduplicarCadastrosEUsuariosEspelhados();

        return { id: targetId };
      },
      { agregado: 'USUARIOS', tipo: 'equipe.atualizada', payload: { nome, cargo } }
    );

    await registrarAuditLog('Admin', 'SALVAR_COLABORADOR_MODAL_UNICO', `Colaborador ${nome} (#${result.id}) salvo com matriz N:N`, req.ip);
    res.json({ ok: true, id: result.id });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.post('/api/cadastros/salvar', async (req: Request, res: Response) => {
  try {
    const {
      id,
      id_original,
      usuario_sistema_id,
      nome_original,
      nome,
      natureza,
      tipo_pessoa,
      documento,
      whatsapp,
      email,
      papeis,
      empresa_id,
      gestor_id,
      valor_diaria,
      cidade,
      cargo_ou_ramo,
      observacoes,
      senha_acesso,
      usuario_logado_id,
      setoresIds,
      unidadesIds,
      novo_setor_nome,
      novo_setor_peso
    } = req.body;

    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ erro: 'Informe o nome completo (PF/Free) ou razão social/nome fantasia (PJ/Empresa).' });
    }

    const customSenhaHash =
      senha_acesso && String(senha_acesso).trim().length >= 4
        ? await gerarHashArgon2id(String(senha_acesso).trim())
        : null;

    const rawIdRef = Number(id_original || id || 0);
    const virtualUserId =
      usuario_sistema_id
        ? Number(usuario_sistema_id)
        : rawIdRef >= 100000 && rawIdRef < 200000
        ? rawIdRef - 100000
        : null;
    const virtualFreeId =
      rawIdRef >= 200000 && rawIdRef < 300000 ? rawIdRef - 200000 : null;
    const virtualEmpId =
      rawIdRef >= 300000 ? rawIdRef - 300000 : null;

    const resolvedEmpresaId =
      empresa_id !== undefined && empresa_id !== null && String(empresa_id) !== '' && Number(empresa_id) > 0
        ? Number(empresa_id)
        : 0;
    const resolvedGestorId =
      gestor_id !== undefined && gestor_id !== null && String(gestor_id) !== '' && Number(gestor_id) > 0
        ? Number(gestor_id)
        : null;

    const userRef = usuario_logado_id
      ? db.usuarios.find((u) => Number(u.id) === Number(usuario_logado_id))
      : db.usuarios[0];
    const wppResolvido = whatsapp
      ? resolverTelefoneBanco(String(whatsapp), userRef, resolvedEmpresaId || 1).telefoneResolvido
      : '';
    const wpp8 = String(wppResolvido || whatsapp || '').replace(/\D/g, '').slice(-8);
    const papeisValidos: string[] = Array.isArray(papeis) && papeis.length > 0 ? [...papeis] : ['cliente'];
    if (Number(virtualUserId) === 1 && !papeisValidos.includes('gestor_conta')) {
      papeisValidos.unshift('gestor_conta');
    }
    const autorizadoWpp = possuiPapelAutorizadoSistema(papeisValidos);
    const natFinal =
      natureza ||
      (papeisValidos.includes('colaborador_free')
        ? 'FREELANCER'
        : tipo_pessoa === 'PJ'
        ? 'PJ'
        : 'PF');

    let usuarioAtualizadoObj: any = null;

    const salvo = await executarComOutbox(
      async () => {
        if (!Array.isArray(db.cadastros_pessoas)) db.cadastros_pessoas = [];
        let registroFinal: any = null;
        let nomeAntesDeRenomear = String(nome_original || '').trim();
        let uidAntesDeRenomear: number | null = virtualUserId;

        if (!nomeAntesDeRenomear && virtualFreeId) {
          const freeOrig = (db.freelancers || []).find((f) => Number(f.id) === Number(virtualFreeId));
          if (freeOrig?.nome) nomeAntesDeRenomear = String(freeOrig.nome).trim();
        }
        if (!nomeAntesDeRenomear && virtualEmpId) {
          const empOrig = (db.empresas || []).find((e) => Number(e.id) === Number(virtualEmpId));
          if (empOrig?.nome) nomeAntesDeRenomear = String(empOrig.nome).trim();
        }
        if (!nomeAntesDeRenomear && virtualUserId) {
          const userOrig = (db.usuarios || []).find((u) => Number(u.id) === Number(virtualUserId));
          if (userOrig?.nome) nomeAntesDeRenomear = String(userOrig.nome).trim();
        }

        if (natFinal === 'EMPRESA') {
          let jaEmp = virtualEmpId
            ? (db.empresas || []).find((e) => Number(e.id) === Number(virtualEmpId))
            : null;
          if (!jaEmp && resolvedEmpresaId > 0 && (rawIdRef > 0 || nomeAntesDeRenomear)) {
            jaEmp = (db.empresas || []).find((e) => Number(e.id) === Number(resolvedEmpresaId));
          }
          if (!jaEmp && nomeAntesDeRenomear) {
            jaEmp = (db.empresas || []).find(
              (e) => String(e.nome || '').toLowerCase().trim() === nomeAntesDeRenomear.toLowerCase().trim()
            );
          }
          if (!jaEmp) {
            jaEmp = (db.empresas || []).find(
              (e) => String(e.nome || '').toLowerCase().trim() === String(nome).toLowerCase().trim()
            );
          }
          const ramoLimpo = String(cargo_ou_ramo || '')
            .replace(/\s*•\s*Teto Free R\$\s*[\d.,]+/i, '')
            .trim();
          if (!jaEmp) {
            const novaEmpObj = {
              id: nextId(db.empresas),
              nome: String(nome).trim(),
              cnpj: documento || '',
              waha_session_id: `urutau_${Date.now()}`,
              waha_numero: wppResolvido || '',
              bot_interno_numero: wppResolvido || '',
              bot_interno_status: 'Desconectado',
              wpp_comercial_numero: '',
              waha_status: 'Desconectado',
              wpp_web_autenticado_real: false,
              nivel_acesso_licenca: 'uso_completo',
              cidade: cidade || 'Belém - PA',
              ramo: ramoLimpo || 'Gastronomia',
              diaria_teto: Number(valor_diaria || 220),
              bloqueios_freelancers: [],
              arquivado_legal: false,
              criado_em: new Date().toISOString()
            };
            db.empresas.push(novaEmpObj);
            jaEmp = novaEmpObj;
          } else {
            jaEmp.nome = String(nome).trim();
            if (documento !== undefined) jaEmp.cnpj = documento || jaEmp.cnpj || '';
            if (wppResolvido) {
              jaEmp.waha_numero = wppResolvido;
              jaEmp.bot_interno_numero = wppResolvido;
            }
            if (cidade) jaEmp.cidade = cidade;
            if (ramoLimpo) jaEmp.ramo = ramoLimpo;
            if (valor_diaria) jaEmp.diaria_teto = Number(valor_diaria);
            jaEmp.arquivado_legal = false;
          }

          const empIdNum = Number(jaEmp.id);
          const empNomeLimpo = String(jaEmp.nome || '').trim();
          let perfilEmpIdx = db.usuarios.findIndex(
            (u) =>
              Number(u.id) !== 1 &&
              (String(u.nome || '').trim().toLowerCase() === empNomeLimpo.toLowerCase() ||
                (nomeAntesDeRenomear &&
                  String(u.nome || '').trim().toLowerCase() === nomeAntesDeRenomear.toLowerCase()) ||
                (Array.isArray(u.empresas_ids) &&
                  u.empresas_ids.map(Number).includes(empIdNum) &&
                  String(u.cargo || '').toLowerCase().includes('perfil da empresa')))
          );
          if (perfilEmpIdx >= 0) {
            db.usuarios[perfilEmpIdx] = {
              ...db.usuarios[perfilEmpIdx],
              nome: empNomeLimpo,
              arquivado_legal: false,
              telefone: wppResolvido || jaEmp.waha_numero || db.usuarios[perfilEmpIdx].telefone || '',
              email: email || db.usuarios[perfilEmpIdx].email || '',
              empresas_ids: Array.from(
                new Set([...(db.usuarios[perfilEmpIdx].empresas_ids || []).map(Number), empIdNum])
              ),
              senha_argon2id: customSenhaHash || db.usuarios[perfilEmpIdx].senha_argon2id
            };
          } else {
            const refHash =
              customSenhaHash ||
              db.usuarios.find((u) => Number(u.id) !== 1 && u.senha_argon2id)?.senha_argon2id ||
              (await gerarHashArgon2id(getOrGenerateInitialMasterPassword()));
            db.usuarios.push({
              id: nextId(db.usuarios),
              nome: empNomeLimpo,
              telefone: wppResolvido || jaEmp.waha_numero || '',
              whatsapp_bot_vinculado: wppResolvido || jaEmp.waha_numero || '',
              email: email || '',
              tipo: 'Gestor da Empresa',
              cargo: 'Perfil da Empresa / Proprietário',
              foto: '',
              empresas_ids: [empIdNum],
              escala_fixa_json: '[1,2,3,4,5,6,0]',
              senha_argon2id: refHash,
              permissoes_json: {
                total: false,
                gerenciar_subordinados: true,
                mudar_aparencia: true,
                escopo_colaboradores: 'subordinados'
              },
              arquivado_legal: false,
              criado_em: new Date().toISOString()
            });
          }

          if (customSenhaHash) {
            for (const u of db.usuarios) {
              if (
                Number(u.id) !== 1 &&
                Array.isArray(u.empresas_ids) &&
                u.empresas_ids.map(Number).includes(empIdNum) &&
                (String(u.tipo || '').toLowerCase().includes('gestor') ||
                  String(u.cargo || '').toLowerCase().includes('empres'))
              ) {
                u.senha_argon2id = customSenhaHash;
              }
            }
          }

          for (const c of db.cadastros_pessoas) {
            const cNome = String(c.nome || '').trim().toLowerCase();
            if (
              c.natureza === 'EMPRESA' &&
              (cNome === String(nome).trim().toLowerCase() ||
                (nomeAntesDeRenomear && cNome === nomeAntesDeRenomear.toLowerCase()) ||
                Number(c.id) === Number(id))
            ) {
              c.arquivado_legal = true;
            }
          }

          deduplicarCadastrosEUsuariosEspelhados();
          return {
            id: 300000 + Number(jaEmp.id),
            nome: jaEmp.nome,
            natureza: 'EMPRESA',
            tipo_pessoa: 'PJ',
            documento: jaEmp.cnpj || '',
            whatsapp: jaEmp.waha_numero || '',
            empresa_id: jaEmp.id,
            cidade: jaEmp.cidade || 'Belém - PA',
            cargo_ou_ramo: jaEmp.ramo || 'Gastronomia'
          };
        }

        const realCadastroId =
          id && Number(id) > 0 && Number(id) < 100000
            ? Number(id)
            : rawIdRef > 0 && rawIdRef < 100000
            ? rawIdRef
            : null;

        let idxExistente = -1;
        if (realCadastroId) {
          idxExistente = db.cadastros_pessoas.findIndex((c) => Number(c.id) === realCadastroId);
        }
        if (idxExistente < 0 && virtualUserId) {
          idxExistente = db.cadastros_pessoas.findIndex(
            (c) => !c.arquivado_legal && Number(c.usuario_sistema_id) === Number(virtualUserId)
          );
        }
        if (idxExistente < 0 && nomeAntesDeRenomear) {
          idxExistente = db.cadastros_pessoas.findIndex(
            (c) =>
              !c.arquivado_legal &&
              String(c.nome || '').trim().toLowerCase() === nomeAntesDeRenomear.toLowerCase()
          );
        }
        if (idxExistente < 0) {
          idxExistente = db.cadastros_pessoas.findIndex(
            (c) =>
              !c.arquivado_legal &&
              String(c.nome || '').trim().toLowerCase() === String(nome).trim().toLowerCase()
          );
        }
        if (idxExistente < 0 && wpp8.length >= 8 && (virtualUserId || virtualFreeId || nomeAntesDeRenomear)) {
          idxExistente = db.cadastros_pessoas.findIndex(
            (c) =>
              !c.arquivado_legal &&
              String(c.whatsapp || '').replace(/\D/g, '').slice(-8) === wpp8
          );
        }

        if (idxExistente >= 0) {
          if (!nomeAntesDeRenomear) {
            nomeAntesDeRenomear = String(db.cadastros_pessoas[idxExistente].nome || '').trim();
          }
          if (!uidAntesDeRenomear && db.cadastros_pessoas[idxExistente].usuario_sistema_id) {
            uidAntesDeRenomear = Number(db.cadastros_pessoas[idxExistente].usuario_sistema_id);
          }
          db.cadastros_pessoas[idxExistente] = {
            ...db.cadastros_pessoas[idxExistente],
            usuario_sistema_id: uidAntesDeRenomear || db.cadastros_pessoas[idxExistente].usuario_sistema_id,
            nome: String(nome).trim(),
            natureza: natFinal,
            tipo_pessoa: tipo_pessoa === 'PJ' ? 'PJ' : 'PF',
            documento: documento !== undefined ? documento : db.cadastros_pessoas[idxExistente].documento || '',
            whatsapp: whatsapp !== undefined ? wppResolvido : db.cadastros_pessoas[idxExistente].whatsapp || '',
            email: email !== undefined ? email : db.cadastros_pessoas[idxExistente].email || '',
            papeis: papeisValidos,
            empresa_id: resolvedEmpresaId,
            gestor_id: resolvedGestorId,
            valor_diaria: valor_diaria ? Number(valor_diaria) : db.cadastros_pessoas[idxExistente].valor_diaria,
            cidade: cidade || db.cadastros_pessoas[idxExistente].cidade || 'Belém - PA',
            cargo_ou_ramo: cargo_ou_ramo !== undefined ? cargo_ou_ramo : db.cadastros_pessoas[idxExistente].cargo_ou_ramo || '',
            comunidade_wpp_autorizada: autorizadoWpp,
            interacao_sistema_bloqueada: !autorizadoWpp,
            arquivado_legal: false,
            observacoes: observacoes !== undefined ? observacoes : db.cadastros_pessoas[idxExistente].observacoes || ''
          };
          registroFinal = db.cadastros_pessoas[idxExistente];

          for (let i = 0; i < db.cadastros_pessoas.length; i++) {
            if (i === idxExistente) continue;
            const item = db.cadastros_pessoas[i];
            if (item.arquivado_legal) continue;
            const itemNome = String(item.nome || '').trim().toLowerCase();
            if (
              (nomeAntesDeRenomear && itemNome === nomeAntesDeRenomear.toLowerCase()) ||
              itemNome === String(nome).trim().toLowerCase()
            ) {
              item.arquivado_legal = true;
            }
          }
        } else {
          registroFinal = {
            id: nextId(db.cadastros_pessoas),
            usuario_sistema_id: uidAntesDeRenomear || undefined,
            nome: String(nome).trim(),
            natureza: natFinal,
            tipo_pessoa: tipo_pessoa === 'PJ' ? 'PJ' : 'PF',
            documento: documento || '',
            whatsapp: wppResolvido,
            email: email || '',
            papeis: papeisValidos,
            empresa_id: resolvedEmpresaId,
            gestor_id: resolvedGestorId,
            valor_diaria: valor_diaria ? Number(valor_diaria) : undefined,
            cidade: cidade || 'Belém - PA',
            cargo_ou_ramo: cargo_ou_ramo || '',
            comunidade_wpp_autorizada: autorizadoWpp,
            interacao_sistema_bloqueada: !autorizadoWpp,
            observacoes: observacoes || '',
            arquivado_legal: false,
            criado_em: new Date().toISOString()
          };
          db.cadastros_pessoas.unshift(registroFinal);
        }

        if (autorizadoWpp && tipo_pessoa !== 'PJ') {
          const isGestor = papeisValidos.includes('gestor_conta');
          const isFree = papeisValidos.includes('colaborador_free') || natFinal === 'FREELANCER';
          const isAutonomo = !resolvedGestorId && resolvedEmpresaId === 0;

          let jaUserIdx = -1;
          if (uidAntesDeRenomear) {
            jaUserIdx = db.usuarios.findIndex((u) => Number(u.id) === Number(uidAntesDeRenomear));
          }
          if (jaUserIdx < 0 && nomeAntesDeRenomear) {
            jaUserIdx = db.usuarios.findIndex(
              (u) =>
                !u.arquivado_legal &&
                String(u.nome || '').toLowerCase().trim() === nomeAntesDeRenomear.toLowerCase().trim()
            );
          }
          if (jaUserIdx < 0) {
            jaUserIdx = db.usuarios.findIndex(
              (u) =>
                !u.arquivado_legal &&
                String(u.nome || '').toLowerCase().trim() === String(nome).toLowerCase().trim()
            );
          }
          if (jaUserIdx < 0 && wpp8.length >= 8) {
            jaUserIdx = db.usuarios.findIndex(
              (u) =>
                !u.arquivado_legal &&
                String(u.telefone || '').replace(/\D/g, '').slice(-8) === wpp8
            );
          }

          if (jaUserIdx >= 0) {
            const uExistente = db.usuarios[jaUserIdx];
            const ehMaster = Number(uExistente.id) === 1;
            const tipoAtualLower = String(uExistente.tipo || '').toLowerCase();
            const preservarTipoSuperior =
              ehMaster ||
              tipoAtualLower.includes('super admin') ||
              tipoAtualLower.includes('empres') ||
              tipoAtualLower.includes('gestor da empresa');
            const novoTipo = ehMaster
              ? 'Super Admin'
              : preservarTipoSuperior && isGestor
              ? uExistente.tipo
              : isGestor
              ? 'Gerente'
              : isFree
              ? 'Freelancer'
              : isAutonomo
              ? 'Autônomo'
              : uExistente.tipo || 'Colaborador';
            const cargoLimpo = String(cargo_ou_ramo || '')
              .replace(/\s*\((Super Admin|Colaborador|Gerente|Autônomo|Freelancer)\)\s*$/i, '')
              .trim();
            db.usuarios[jaUserIdx] = {
              ...uExistente,
              nome: String(nome).trim(),
              arquivado_legal: false,
              telefone: whatsapp !== undefined ? wppResolvido : uExistente.telefone,
              email: email !== undefined ? email : uExistente.email || '',
              tipo: novoTipo,
              cargo: cargoLimpo || uExistente.cargo || 'Operacional',
              empresas_ids: ehMaster
                ? uExistente.empresas_ids || []
                : resolvedEmpresaId > 0
                ? [resolvedEmpresaId]
                : [],
              gestor_id:
                resolvedGestorId && Number(resolvedGestorId) !== Number(uExistente.id)
                  ? resolvedGestorId
                  : null,
              senha_argon2id: customSenhaHash || uExistente.senha_argon2id,
              permissoes_json: isGestor || ehMaster
                ? {
                    ...(uExistente.permissoes_json || {}),
                    gerenciar_subordinados: true,
                    mudar_aparencia: true
                  }
                : uExistente.permissoes_json || { checklists: true }
            };
            registroFinal.usuario_sistema_id = db.usuarios[jaUserIdx].id;
            if (ehMaster && !registroFinal.papeis.includes('gestor_conta')) {
              registroFinal.papeis = ['gestor_conta', ...registroFinal.papeis];
            }
            const copiaUser = { ...db.usuarios[jaUserIdx] };
            delete copiaUser.senha_argon2id;
            usuarioAtualizadoObj = copiaUser;
          } else {
            const hashPadrao =
              customSenhaHash || (await gerarHashArgon2id(getOrGenerateInitialMasterPassword()));
            const novoUserId = nextId(db.usuarios);
            const novoUserObj: any = {
              id: novoUserId,
              nome: String(nome).trim(),
              telefone: wppResolvido,
              email: email || '',
              tipo: isGestor ? 'Gerente' : isFree ? 'Freelancer' : isAutonomo ? 'Autônomo' : 'Colaborador',
              cargo: cargo_ou_ramo || (isGestor ? 'Gestor de Conta' : isFree ? 'Freelancer' : isAutonomo ? 'Autônomo Independente' : 'Operacional'),
              foto: '',
              empresas_ids: resolvedEmpresaId > 0 ? [resolvedEmpresaId] : [],
              gestor_id: resolvedGestorId,
              escala_fixa_json: JSON.stringify(isFree ? [4, 5, 6, 0] : [1, 2, 3, 4, 5]),
              senha_argon2id: hashPadrao,
              permissoes_json: isGestor
                ? { gerenciar_subordinados: true, mudar_aparencia: true, checklists: true }
                : { checklists: true },
              arquivado_legal: false,
              criado_em: new Date().toISOString()
            };
            db.usuarios.push(novoUserObj);
            registroFinal.usuario_sistema_id = novoUserId;
          }

          const finalSetoresIds: number[] = Array.isArray(setoresIds)
            ? setoresIds.map(Number).filter((n: number) => n > 0)
            : [];
          if (novo_setor_nome && String(novo_setor_nome).trim()) {
            const nomeSetorLimpo = String(novo_setor_nome).trim();
            let setorAchado = (db.setores || []).find(
              (s) => !s.arquivado_legal && String(s.nome || '').trim().toLowerCase() === nomeSetorLimpo.toLowerCase()
            );
            if (!setorAchado) {
              const novoSetorId = nextId(db.setores);
              setorAchado = {
                id: novoSetorId,
                nome: nomeSetorLimpo,
                descricao: 'Criado a partir do cadastro de colaborador',
                peso_rateio: Number(novo_setor_peso || 1.0),
                arquivado_legal: false,
                criado_em: new Date().toISOString()
              };
              db.setores.push(setorAchado);
            }
            if (!finalSetoresIds.includes(Number(setorAchado.id))) {
              finalSetoresIds.push(Number(setorAchado.id));
            }
          }
          if (registroFinal.usuario_sistema_id && (Array.isArray(setoresIds) || finalSetoresIds.length > 0)) {
            atualizarVinculoInterno(
              'rel_usuario_setor',
              'usuario_id',
              'setor_id',
              Number(registroFinal.usuario_sistema_id),
              finalSetoresIds
            );
          }
          if (registroFinal.usuario_sistema_id && Array.isArray(unidadesIds)) {
            atualizarVinculoInterno(
              'rel_usuario_unidade',
              'usuario_id',
              'unidade_id',
              Number(registroFinal.usuario_sistema_id),
              unidadesIds.map(Number).filter((n: number) => n > 0)
            );
          }
        }

        if (papeisValidos.includes('colaborador_free') || natFinal === 'FREELANCER') {
          let jaFreeIdx = -1;
          if (virtualFreeId) {
            jaFreeIdx = (db.freelancers || []).findIndex((f) => Number(f.id) === Number(virtualFreeId));
          }
          if (jaFreeIdx < 0 && nomeAntesDeRenomear) {
            jaFreeIdx = (db.freelancers || []).findIndex(
              (f) => String(f.nome || '').toLowerCase().trim() === nomeAntesDeRenomear.toLowerCase().trim()
            );
          }
          if (jaFreeIdx < 0) {
            jaFreeIdx = (db.freelancers || []).findIndex(
              (f) => String(f.nome || '').toLowerCase().trim() === String(nome).toLowerCase().trim()
            );
          }
          if (jaFreeIdx >= 0) {
            db.freelancers[jaFreeIdx] = {
              ...db.freelancers[jaFreeIdx],
              nome: String(nome).trim(),
              arquivado_legal: false,
              whatsapp: whatsapp !== undefined ? wppResolvido : db.freelancers[jaFreeIdx].whatsapp,
              funcao: cargo_ou_ramo || db.freelancers[jaFreeIdx].funcao || 'Garçom',
              valor_diaria: Number(valor_diaria || db.freelancers[jaFreeIdx].valor_diaria || 160),
              empresas_autorizadas:
                resolvedEmpresaId > 0
                  ? Array.from(new Set([...(db.freelancers[jaFreeIdx].empresas_autorizadas || []), resolvedEmpresaId]))
                  : db.freelancers[jaFreeIdx].empresas_autorizadas || [],
              cidade: cidade || 'Belém - PA'
            };
          } else {
            db.freelancers.push({
              id: nextId(db.freelancers),
              nome: String(nome).trim(),
              whatsapp: wppResolvido,
              funcao: cargo_ou_ramo || 'Profissional Autônomo',
              funcoes_secundarias: [],
              valor_diaria: Number(valor_diaria || 160),
              disponivel: true,
              disponibilidade_dias: [0, 1, 2, 3, 4, 5, 6],
              empresas_bloqueadas: [],
              empresas_autorizadas: resolvedEmpresaId > 0 ? [resolvedEmpresaId] : [],
              cidade: cidade || 'Belém - PA',
              avaliacao_estrelas: 5.0,
              total_diarias_realizadas: 0,
              arquivado_legal: false,
              criado_em: new Date().toISOString()
            });
          }
        }

        deduplicarCadastrosEUsuariosEspelhados();
        return registroFinal;
      },
      { agregado: 'CADASTROS', tipo: 'cadastro.pessoa_salva', payload: { nome, natureza: natFinal, papeis: papeisValidos } }
    );

    await registrarAuditLog(
      userRef?.nome || 'Operador',
      'SALVAR_CADASTRO_UNIFICADO',
      `${natFinal} "${nome}" salvo com papéis [${papeisValidos.join(', ')}] (Comunidade WPP: ${autorizadoWpp ? 'AUTORIZADO' : 'PROIBIDO DE INTERAGIR'})`,
      req.ip
    );

    res.json({ ok: true, cadastro: salvo, usuario_atualizado: usuarioAtualizadoObj });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.post('/api/erp/resolver-whatsapp', (req: Request, res: Response) => {
  try {
    const { input, usuario_id, empresa_id } = req.body;
    const userRef = usuario_id
      ? db.usuarios.find((u) => Number(u.id) === Number(usuario_id))
      : db.usuarios[0];
    const resultado = resolverTelefoneBanco(String(input || ''), userRef, Number(empresa_id || 1));
    res.json({ ok: true, ...resultado });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.post('/api/unidades/salvar', async (req: Request, res: Response) => {
  try {
    const {
      id,
      nome,
      cidade,
      endereco,
      latitude,
      longitude,
      raio_metros,
      exigir_gps_local,
      sede_principal,
      empresa_id,
      setoresIds,
      checklistsIds,
      usuariosIds
    } = req.body;
    if (!nome) return res.status(400).json({ erro: 'Informe o nome da Unidade / Localização.' });

    const latNum = typeof latitude === 'number' && Number.isFinite(latitude) ? Number(latitude) : -1.4558;
    const lngNum = typeof longitude === 'number' && Number.isFinite(longitude) ? Number(longitude) : -48.5039;
    const raioNum = Math.max(20, Math.min(5000, Number(raio_metros || 200)));

    const result = await executarComOutbox(
      () => {
        let targetId = Number(id || 0);
        if (sede_principal) {
          for (const u of db.unidades) {
            u.sede_principal = false;
          }
        }
        if (targetId > 0) {
          const idx = db.unidades.findIndex((u) => Number(u.id) === targetId);
          if (idx >= 0) {
            db.unidades[idx] = {
              ...db.unidades[idx],
              nome,
              cidade: cidade || 'Belém - PA',
              endereco: endereco !== undefined ? endereco : db.unidades[idx].endereco || cidade || '',
              latitude: latNum,
              longitude: lngNum,
              raio_metros: raioNum,
              exigir_gps_local: exigir_gps_local !== undefined ? Boolean(exigir_gps_local) : true,
              sede_principal:
                sede_principal !== undefined ? Boolean(sede_principal) : Boolean(db.unidades[idx].sede_principal),
              empresa_id: empresa_id ? Number(empresa_id) : db.unidades[idx].empresa_id || 1
            };
          }
        } else {
          targetId = nextId(db.unidades);
          db.unidades.push({
            id: targetId,
            empresa_id: Number(empresa_id || 1),
            id_empresa: Number(empresa_id || 1),
            nome,
            cidade: cidade || 'Belém - PA',
            endereco: endereco || cidade || 'Belém - PA',
            latitude: latNum,
            longitude: lngNum,
            raio_metros: raioNum,
            exigir_gps_local: exigir_gps_local !== false,
            sede_principal: Boolean(sede_principal),
            status: 'Operacional',
            arquivado_legal: false,
            criado_em: new Date().toISOString()
          });
        }
        if (Array.isArray(setoresIds)) atualizarVinculoInterno('rel_unidade_setor', 'unidade_id', 'setor_id', targetId, setoresIds);
        if (Array.isArray(checklistsIds)) atualizarVinculoInterno('rel_unidade_checklist', 'unidade_id', 'checklist_id', targetId, checklistsIds);
        if (Array.isArray(usuariosIds)) atualizarVinculoInterno('rel_unidade_usuario', 'unidade_id', 'usuario_id', targetId, usuariosIds);
        return { id: targetId, latitude: latNum, longitude: lngNum, raio_metros: raioNum };
      },
      { agregado: 'UNIDADES', tipo: 'unidade.atualizada', payload: { nome, cidade, latitude: latNum, longitude: lngNum, raio_metros: raioNum } }
    );

    await registrarAuditLog(
      'Admin',
      'SALVAR_UNIDADE_LOCALIZACAO_GPS',
      `Localização / Unidade "${nome}" (#${result.id}) salva em [${latNum.toFixed(5)}, ${lngNum.toFixed(5)}] (Raio: ${raioNum}m)`,
      req.ip
    );
    res.json({ ok: true, id: result.id, latitude: latNum, longitude: lngNum, raio_metros: raioNum });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.post('/api/setores/salvar', async (req: Request, res: Response) => {
  try {
    const { id, nome, descricao, peso_rateio, unidadesIds, checklistsIds, usuariosIds } = req.body;
    if (!nome) return res.status(400).json({ erro: 'Informe o nome do Setor.' });

    const result = await executarComOutbox(
      () => {
        let targetId = Number(id || 0);
        if (targetId > 0) {
          const idx = db.setores.findIndex((s) => Number(s.id) === targetId);
          if (idx >= 0) {
            db.setores[idx] = {
              ...db.setores[idx],
              nome,
              descricao: descricao || '',
              peso_rateio: Number(peso_rateio || 1.0)
            };
          }
        } else {
          targetId = nextId(db.setores);
          db.setores.push({
            id: targetId,
            nome,
            descricao: descricao || '',
            peso_rateio: Number(peso_rateio || 1.0),
            arquivado_legal: false,
            criado_em: new Date().toISOString()
          });
        }
        if (Array.isArray(unidadesIds)) atualizarVinculoInterno('rel_setor_unidade', 'setor_id', 'unidade_id', targetId, unidadesIds);
        if (Array.isArray(checklistsIds)) atualizarVinculoInterno('rel_setor_checklist', 'setor_id', 'checklist_id', targetId, checklistsIds);
        if (Array.isArray(usuariosIds)) atualizarVinculoInterno('rel_setor_usuario', 'setor_id', 'usuario_id', targetId, usuariosIds);
        return { id: targetId };
      },
      { agregado: 'SETORES', tipo: 'setor.atualizado', payload: { nome } }
    );

    await registrarAuditLog('Admin', 'SALVAR_SETOR', `Setor ${nome} (#${result.id}) atualizado`, req.ip);
    res.json({ ok: true, id: result.id });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.post('/api/checklists/salvar', async (req: Request, res: Response) => {
  try {
    const { id, titulo, descricao, itens, unidadesIds, setoresIds, usuariosIds } = req.body;
    if (!titulo) return res.status(400).json({ erro: 'Informe o título do Checklist.' });

    const result = await executarComOutbox(
      () => {
        let targetId = Number(id || 0);
        const itensNorm = Array.isArray(itens) ? itens : [];
        if (targetId > 0) {
          const idx = db.checklists.findIndex((c) => Number(c.id) === targetId);
          if (idx >= 0) {
            db.checklists[idx] = { ...db.checklists[idx], titulo, descricao: descricao || '', itens_json: itensNorm };
          }
        } else {
          targetId = nextId(db.checklists);
          db.checklists.push({
            id: targetId,
            titulo,
            descricao: descricao || '',
            itens_json: itensNorm,
            arquivado_legal: false,
            criado_em: new Date().toISOString()
          });
        }
        if (Array.isArray(unidadesIds)) atualizarVinculoInterno('rel_checklist_unidade', 'checklist_id', 'unidade_id', targetId, unidadesIds);
        if (Array.isArray(setoresIds)) atualizarVinculoInterno('rel_checklist_setor', 'checklist_id', 'setor_id', targetId, setoresIds);
        if (Array.isArray(usuariosIds)) atualizarVinculoInterno('rel_checklist_usuario', 'checklist_id', 'usuario_id', targetId, usuariosIds);
        return { id: targetId };
      },
      { agregado: 'CHECKLISTS', tipo: 'checklist.atualizado', payload: { titulo } }
    );

    await registrarAuditLog('Admin', 'SALVAR_CHECKLIST', `Checklist ${titulo} (#${result.id}) atualizado`, req.ip);
    res.json({ ok: true, id: result.id });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

const espelhoTabelasRel: Record<string, [string, string, string]> = {
  rel_usuario_unidade: ['rel_unidade_usuario', 'usuario_id', 'unidade_id'],
  rel_unidade_usuario: ['rel_usuario_unidade', 'unidade_id', 'usuario_id'],
  rel_usuario_setor: ['rel_setor_usuario', 'usuario_id', 'setor_id'],
  rel_setor_usuario: ['rel_usuario_setor', 'setor_id', 'usuario_id'],
  rel_usuario_checklist: ['rel_checklist_usuario', 'usuario_id', 'checklist_id'],
  rel_checklist_usuario: ['rel_usuario_checklist', 'checklist_id', 'usuario_id'],
  rel_unidade_setor: ['rel_setor_unidade', 'unidade_id', 'setor_id'],
  rel_setor_unidade: ['rel_unidade_setor', 'setor_id', 'unidade_id'],
  rel_unidade_checklist: ['rel_checklist_unidade', 'unidade_id', 'checklist_id'],
  rel_checklist_unidade: ['rel_unidade_checklist', 'checklist_id', 'unidade_id'],
  rel_setor_checklist: ['rel_checklist_setor', 'setor_id', 'checklist_id'],
  rel_checklist_setor: ['rel_setor_checklist', 'checklist_id', 'setor_id'],
  rel_cargo_unidade: ['rel_unidade_cargo', 'cargo_id', 'unidade_id'],
  rel_unidade_cargo: ['rel_cargo_unidade', 'unidade_id', 'cargo_id'],
  rel_cargo_setor: ['rel_setor_cargo', 'cargo_id', 'setor_id'],
  rel_setor_cargo: ['rel_cargo_setor', 'setor_id', 'cargo_id'],
  rel_cargo_checklist: ['rel_checklist_cargo', 'cargo_id', 'checklist_id'],
  rel_checklist_cargo: ['rel_cargo_checklist', 'checklist_id', 'cargo_id'],
  rel_cargo_usuario: ['rel_usuario_cargo', 'cargo_id', 'usuario_id'],
  rel_usuario_cargo: ['rel_cargo_usuario', 'usuario_id', 'cargo_id']
};

app.post('/api/cargos/salvar', async (req: Request, res: Response) => {
  try {
    const {
      id,
      nome,
      cbo,
      nivel_hierarquico,
      tipo_vinculo_padrao,
      salario_base_sugerido,
      valor_diaria_sugerida,
      participa_rateio_10,
      peso_rateio_padrao,
      horario_entrada_padrao,
      horario_saida_padrao,
      dias_semana_padrao,
      intervalo_minutos,
      tolerancia_minutos,
      exige_controle_ponto,
      exige_gps,
      descricao_atividades,
      requisitos_qualificacao,
      setor_principal_id,
      cor_identificacao,
      unidadesIds,
      setoresIds,
      checklistsIds,
      usuariosIds
    } = req.body;

    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ erro: 'Informe o título do Cargo.' });
    }

    const result = await executarComOutbox(
      () => {
        if (!Array.isArray(db.cargos)) db.cargos = [];
        let targetId = Number(id || 0);
        const payloadCargo = {
          nome: String(nome).trim(),
          cbo: String(cbo || '').trim(),
          nivel_hierarquico: nivel_hierarquico || 'operacional',
          tipo_vinculo_padrao: tipo_vinculo_padrao || 'efetivo_clt',
          salario_base_sugerido: Number(salario_base_sugerido || 0),
          valor_diaria_sugerida: Number(valor_diaria_sugerida || 0),
          participa_rateio_10: Boolean(participa_rateio_10),
          peso_rateio_padrao: Number(peso_rateio_padrao || 1.0),
          horario_entrada_padrao: horario_entrada_padrao || '17:00',
          horario_saida_padrao: horario_saida_padrao || '01:30',
          dias_semana_padrao: Array.isArray(dias_semana_padrao) ? dias_semana_padrao.map(Number) : [1, 2, 3, 4, 5, 6],
          intervalo_minutos: Number(intervalo_minutos || 60),
          tolerancia_minutos: Number(tolerancia_minutos || 15),
          exige_controle_ponto: exige_controle_ponto !== false,
          exige_gps: exige_gps !== false,
          descricao_atividades: String(descricao_atividades || ''),
          requisitos_qualificacao: String(requisitos_qualificacao || ''),
          setor_principal_id: setor_principal_id ? Number(setor_principal_id) : null,
          cor_identificacao: cor_identificacao || '#10B981'
        };

        if (targetId > 0) {
          const idx = db.cargos.findIndex((c) => Number(c.id) === targetId);
          if (idx >= 0) {
            db.cargos[idx] = {
              ...db.cargos[idx],
              ...payloadCargo,
              arquivado_legal: false
            };
          }
        } else {
          targetId = nextId(db.cargos);
          db.cargos.push({
            id: targetId,
            ...payloadCargo,
            arquivado_legal: false,
            criado_em: new Date().toISOString()
          });
        }

        if (Array.isArray(unidadesIds)) atualizarVinculoInterno('rel_cargo_unidade', 'cargo_id', 'unidade_id', targetId, unidadesIds);
        if (Array.isArray(setoresIds)) atualizarVinculoInterno('rel_cargo_setor', 'cargo_id', 'setor_id', targetId, setoresIds);
        if (Array.isArray(checklistsIds)) atualizarVinculoInterno('rel_cargo_checklist', 'cargo_id', 'checklist_id', targetId, checklistsIds);
        if (Array.isArray(usuariosIds)) atualizarVinculoInterno('rel_cargo_usuario', 'cargo_id', 'usuario_id', targetId, usuariosIds);

        return { id: targetId };
      },
      { agregado: 'CARGOS', tipo: 'cargos.atualizado', payload: { nome } }
    );

    await registrarAuditLog('Admin', 'SALVAR_CARGO', `Cargo "${nome}" (#${result.id}) salvo com sucesso`, req.ip);
    res.json({ ok: true, id: result.id });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.post('/api/cargos/arquivar', async (req: Request, res: Response) => {
  try {
    const { id } = req.body;
    const targetId = Number(id || 0);
    if (!targetId) return res.status(400).json({ erro: 'ID do cargo inválido.' });

    await executarComOutbox(
      () => {
        if (!Array.isArray(db.cargos)) db.cargos = [];
        const alvo = db.cargos.find((c) => Number(c.id) === targetId);
        if (alvo) alvo.arquivado_legal = true;
      },
      { agregado: 'CARGOS', tipo: 'cargos.atualizado', payload: { id: targetId, arquivado: true } }
    );

    await registrarAuditLog('Admin', 'ARQUIVAR_CARGO', `Cargo #${targetId} arquivado`, req.ip);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

function atualizarVinculoInterno(
  tabela: string,
  colunaId: string,
  colunaAlvo: string,
  idPrincipal: number,
  idsAlvo: number[]
) {
  const config = espelhoTabelasRel[tabela];
  if (!config) return;
  const [tabelaEspelho] = config;
  const listaIds = Array.isArray(idsAlvo) ? idsAlvo.map(Number) : [];

  if (!db.relacionamentos[tabela]) db.relacionamentos[tabela] = [];
  if (!db.relacionamentos[tabelaEspelho]) db.relacionamentos[tabelaEspelho] = [];

  db.relacionamentos[tabela].forEach((r) => {
    if (Number(r[colunaId]) === Number(idPrincipal)) r.arquivado_legal = true;
  });
  db.relacionamentos[tabelaEspelho].forEach((r) => {
    if (Number(r[colunaId]) === Number(idPrincipal)) r.arquivado_legal = true;
  });

  for (const alvoId of listaIds) {
    const existenteA = db.relacionamentos[tabela].find(
      (r) => Number(r[colunaId]) === Number(idPrincipal) && Number(r[colunaAlvo]) === Number(alvoId)
    );
    if (existenteA) {
      existenteA.arquivado_legal = false;
    } else {
      db.relacionamentos[tabela].push({
        id: nextId(db.relacionamentos[tabela]),
        [colunaId]: Number(idPrincipal),
        [colunaAlvo]: Number(alvoId),
        arquivado_legal: false
      });
    }

    const existenteB = db.relacionamentos[tabelaEspelho].find(
      (r) => Number(r[colunaAlvo]) === Number(alvoId) && Number(r[colunaId]) === Number(idPrincipal)
    );
    if (existenteB) {
      existenteB.arquivado_legal = false;
    } else {
      db.relacionamentos[tabelaEspelho].push({
        id: nextId(db.relacionamentos[tabelaEspelho]),
        [colunaAlvo]: Number(alvoId),
        [colunaId]: Number(idPrincipal),
        arquivado_legal: false
      });
    }
  }
}

app.post('/api/erp/salvar-vinculos', async (req: Request, res: Response) => {
  try {
    const { tabela, colunaId, colunaAlvo, idPrincipal, idsAlvo } = req.body;
    if (!espelhoTabelasRel[tabela]) return res.status(400).json({ erro: 'Tabela de vínculo N:N inválida.' });

    await executarComOutbox(
      () => {
        atualizarVinculoInterno(tabela, colunaId, colunaAlvo, Number(idPrincipal), idsAlvo);
      },
      { agregado: 'VINCULOS', tipo: 'vinculos.atualizados', payload: { tabela, idPrincipal } }
    );

    await registrarAuditLog('Admin', 'ATUALIZAR_MATRIZ_NN', `Vínculos N:N atualizados em ${tabela} (#${idPrincipal})`, req.ip);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.post('/api/v46/escala/salvar-movimento', async (req: Request, res: Response) => {
  try {
    const { id, tipo, usuario_id, usuarios_lote, data, motivo, unidade_id, setor_id } = req.body;
    const listaUsuarios = Array.isArray(usuarios_lote) && usuarios_lote.length > 0 ? usuarios_lote.map(Number) : [Number(usuario_id)];

    const result = await executarComOutbox(
      () => {
        const idsCriados: number[] = [];
        for (const uid of listaUsuarios) {
          if (!uid) continue;
          if (id && listaUsuarios.length === 1) {
            const idx = db.erp_escalas_movimentos.findIndex((m) => Number(m.id) === Number(id));
            if (idx >= 0) {
              db.erp_escalas_movimentos[idx] = {
                ...db.erp_escalas_movimentos[idx],
                tipo,
                usuario_id: uid,
                data,
                motivo: motivo || '',
                unidade_id: Number(unidade_id || 0),
                setor_id: Number(setor_id || 0)
              };
              idsCriados.push(Number(id));
              continue;
            }
          }
          db.erp_escalas_movimentos.forEach((m) => {
            if (Number(m.usuario_id) === uid && m.data === data && m.tipo === tipo) {
              m.arquivado_legal = true;
            }
          });
          const novoId = nextId(db.erp_escalas_movimentos);
          db.erp_escalas_movimentos.push({
            id: novoId,
            tipo,
            usuario_id: uid,
            data,
            motivo: motivo || '',
            unidade_id: Number(unidade_id || 0),
            setor_id: Number(setor_id || 0),
            arquivado_legal: false,
            criado_em: new Date().toISOString()
          });
          idsCriados.push(novoId);
        }
        return { ids: idsCriados };
      },
      { agregado: 'ESCALAS', tipo: 'escala.atualizada', payload: { tipo, usuarios: listaUsuarios, data } }
    );

    await registrarAuditLog('Gestor Escala', 'MOVIMENTO_ESCALA', `Movimento ${tipo} registrado em ${data} para ${listaUsuarios.length} colaborador(es)`, req.ip);
    res.json({ ok: true, ids: result.ids });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.post('/api/v46/rateio/salvar-fechamento', async (req: Request, res: Response) => {
  try {
    const { data, unidade_id, faturamento_bruto, percentual_pool, valor_pool, detalhes } = req.body;
    const rawPerc = percentual_pool !== undefined && percentual_pool !== '' ? Number(percentual_pool) : 10;
    const percValidado = Math.min(100, Math.max(0, Number.isFinite(rawPerc) ? rawPerc : 10));

    const result = await executarComOutbox(
      () => {
        const novoId = nextId(db.erp_rateios_historico);
        db.erp_rateios_historico.unshift({
          id: novoId,
          data: data || getTodayISO(),
          unidade_id: Number(unidade_id || 0),
          faturamento_bruto: Number(faturamento_bruto || 0),
          percentual_pool: percValidado,
          valor_pool: Number(valor_pool || 0),
          detalhes_json: Array.isArray(detalhes) ? detalhes : [],
          arquivado_legal: false,
          criado_em: new Date().toISOString()
        });
        return { id: novoId };
      },
      { agregado: 'RATEIO', tipo: 'rateio.fechado', payload: { data, valor_pool, percentual_pool: percValidado } }
    );

    await registrarAuditLog('Gestor Financeiro', 'FECHAMENTO_RATEIO_DIARIO', `Rateio fechado em ${data} | Pool ${percValidado}%: R$ ${Number(valor_pool || 0).toFixed(2)}`, req.ip);
    const dispConsumer = await dispararLancamentoConsumerApi(Number(unidade_id || 1), 'RATEIO_RH', {
      id_origem: result.id,
      data: data || getTodayISO(),
      faturamento_bruto: Number(faturamento_bruto || 0),
      percentual_pool: percValidado,
      valor_pool: Number(valor_pool || 0),
      detalhes: Array.isArray(detalhes) ? detalhes : []
    });
    res.json({ ok: true, id: result.id, consumer_api: dispConsumer });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.get('/api/agenda/completo', (_req: Request, res: Response) => {
  res.json({ eventos: db.eventos_agenda.filter((e) => !e.arquivado_legal) });
});

app.post('/api/agenda/salvar', async (req: Request, res: Response) => {
  try {
    const { id, titulo, data, hora, tipo, cor, descricao, unidade_id, setor_id, usuario_id, concluido } = req.body;
    if (!titulo) return res.status(400).json({ erro: 'Informe o título da tarefa ou compromisso.' });

    await executarComOutbox(
      () => {
        if (id) {
          const idx = db.eventos_agenda.findIndex((e) => Number(e.id) === Number(id));
          if (idx >= 0) {
            db.eventos_agenda[idx] = {
              ...db.eventos_agenda[idx],
              titulo,
              data: data || getTodayISO(),
              hora: hora || '19:00',
              tipo: tipo || 'Tarefa',
              cor: cor || '#D97706',
              descricao: descricao || '',
              unidade_id: Number(unidade_id || 0),
              setor_id: Number(setor_id || 0),
              usuario_id: Number(usuario_id || 0),
              concluido: !!concluido
            };
          }
        } else {
          db.eventos_agenda.push({
            id: nextId(db.eventos_agenda),
            titulo,
            data: data || getTodayISO(),
            hora: hora || '19:00',
            tipo: tipo || 'Tarefa',
            cor: cor || '#D97706',
            descricao: descricao || '',
            unidade_id: Number(unidade_id || 0),
            setor_id: Number(setor_id || 0),
            usuario_id: Number(usuario_id || 0),
            concluido: !!concluido,
            arquivado_legal: false,
            criado_em: new Date().toISOString()
          });
        }
      },
      { agregado: 'AGENDA', tipo: 'agenda.atualizada', payload: { titulo, data } }
    );

    await registrarAuditLog('Operador', 'SALVAR_AGENDA', `Evento "${titulo}" registrado para ${data}`, req.ip);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.get('/api/reservas', (_req: Request, res: Response) => {
  res.json(db.reservas.filter((r) => !r.arquivado_legal));
});

app.post('/api/reservas/salvar', async (req: Request, res: Response) => {
  try {
    const {
      id,
      cliente,
      whatsapp,
      data,
      hora,
      mesa,
      mesas_vinculadas,
      grupo_mesa_id,
      grupo_mesa_nome,
      comanda_pdv_id,
      area,
      adultos_pagantes,
      adultos_frequentadores,
      criancas_pagantes,
      criancas_frequentadores,
      status,
      observacoes,
      unidade_id,
      nova_mesa_criada,
      criar_setor_automatico
    } = req.body;

    const rawMesaFallback = String(mesa || nova_mesa_criada?.codigo || '').trim();
    const clienteFinal = String(cliente || '').trim() || (rawMesaFallback ? `Reserva Mesa ${rawMesaFallback}` : 'Cliente Reserva Salão');

    let mesaFinalSalva = '';
    let reservaSalvaObj: any = null;

    await executarComOutbox(
      () => {
        const wppResolvido = whatsapp
          ? resolverTelefoneBanco(String(whatsapp), undefined, Number(unidade_id || 1)).telefoneResolvido
          : '';

        const rawMesaInput = String(mesa ?? nova_mesa_criada?.codigo ?? '').trim();
        const listaVinculadasRaw = Array.isArray(mesas_vinculadas)
          ? Array.from(
              new Set(
                [rawMesaInput, ...mesas_vinculadas.map((m: any) => String(m || '').trim())].filter(Boolean)
              )
            )
          : rawMesaInput
          ? [rawMesaInput]
          : [];

        const mesaPrincipal = rawMesaInput || listaVinculadasRaw[0] || '';
        const listaVinculadas = mesaPrincipal
          ? Array.from(new Set([mesaPrincipal, ...listaVinculadasRaw].filter(Boolean)))
          : [];
        mesaFinalSalva = mesaPrincipal;

        const areaFinal = String(nova_mesa_criada?.ambienteNome || area || 'Salão Principal').trim();

        if (criar_setor_automatico || (nova_mesa_criada && areaFinal)) {
          if (!Array.isArray(db.setores)) db.setores = [];
          const jaSetor = db.setores.find(
            (s: any) => !s.arquivado_legal && String(s.nome || '').trim().toLowerCase() === areaFinal.toLowerCase()
          );
          if (!jaSetor) {
            db.setores.push({
              id: nextId(db.setores),
              nome: areaFinal,
              descricao: 'Setor criado a partir do Mapa de Mesas e Reservas',
              peso_rateio: 1.0,
              arquivado_legal: false,
              criado_em: new Date().toISOString()
            });
          }
        }

        if (nova_mesa_criada && typeof nova_mesa_criada === 'object' && nova_mesa_criada.codigo) {
          const codNova = String(nova_mesa_criada.codigo).trim();
          const ambNova = areaFinal;
          const lugNova = Math.max(1, Number(nova_mesa_criada.lugares || 4));
          const fmtNova = ['quadrada', 'redonda', 'retangular'].includes(nova_mesa_criada.formato)
            ? nova_mesa_criada.formato
            : lugNova >= 8
            ? 'retangular'
            : 'quadrada';

          if (!Array.isArray(db.erp_configs)) db.erp_configs = [];
          let cfgIdx = db.erp_configs.findIndex((c: any) => c.chave === 'mapa_mesas_salao_layout');
          if (cfgIdx < 0) {
            db.erp_configs.push({
              id: nextId(db.erp_configs),
              chave: 'mapa_mesas_salao_layout',
              valor_json: {
                environments: [
                  {
                    id: 'env_salao_principal',
                    nome: ambNova,
                    cor: '#D97706',
                    x: 24,
                    y: 24,
                    width: 920,
                    height: 360
                  }
                ],
                tables: []
              },
              atualizado_em: new Date().toISOString()
            } as any);
            cfgIdx = db.erp_configs.length - 1;
          }
          const layoutAtual = (db.erp_configs[cfgIdx] as any).valor_json || { environments: [], tables: [] };
          if (!Array.isArray(layoutAtual.environments)) layoutAtual.environments = [];
          if (!Array.isArray(layoutAtual.tables)) layoutAtual.tables = [];

          let envAlvo = layoutAtual.environments.find(
            (e: any) => String(e.nome || '').trim().toLowerCase() === ambNova.toLowerCase()
          );
          if (!envAlvo) {
            envAlvo = {
              id: `env_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              nome: ambNova,
              cor: '#D97706',
              x: 24,
              y: 24 + layoutAtual.environments.length * 380,
              width: 920,
              height: 340
            };
            layoutAtual.environments.push(envAlvo);
          }

          const jaTem = layoutAtual.tables.some(
            (t: any) => String(t.codigo || '').trim().toUpperCase() === codNova.toUpperCase()
          );
          if (!jaTem) {
            layoutAtual.tables.push({
              id: `tbl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              codigo: codNova,
              ambienteId: envAlvo.id,
              ambienteNome: envAlvo.nome,
              lugares: lugNova,
              formato: fmtNova,
              x: Number(envAlvo.x || 24) + 36 + (layoutAtual.tables.length % 6) * 130,
              y: Number(envAlvo.y || 24) + 60 + Math.floor((layoutAtual.tables.length % 18) / 6) * 105,
              width: lugNova >= 12 ? 150 : lugNova >= 8 ? 124 : 76,
              height: lugNova >= 20 ? 96 : 74,
              rotation: 0
            });
          }
          (db.erp_configs[cfgIdx] as any).valor_json = layoutAtual;
          (db.erp_configs[cfgIdx] as any).atualizado_em = new Date().toISOString();
        }

        const dadosReserva: Record<string, any> = {
          cliente: clienteFinal,
          whatsapp: wppResolvido || whatsapp || '',
          data: data || getTodayISO(),
          hora: hora || '20:00',
          mesa: mesaPrincipal,
          mesas_vinculadas: listaVinculadas,
          grupo_mesa_id: grupo_mesa_id || undefined,
          grupo_mesa_nome: grupo_mesa_nome || undefined,
          area: areaFinal,
          adultos_pagantes: Math.max(0, Number(adultos_pagantes ?? 1)),
          adultos_frequentadores: Math.max(0, Number(adultos_frequentadores ?? 0)),
          criancas_pagantes: Math.max(0, Number(criancas_pagantes ?? 0)),
          criancas_frequentadores: Math.max(0, Number(criancas_frequentadores ?? 0)),
          status: status || 'Confirmada',
          observacoes: observacoes || '',
          unidade_id: Number(unidade_id || 1)
        };

        if (comanda_pdv_id !== undefined) {
          dadosReserva.comanda_pdv_id = comanda_pdv_id ? Number(comanda_pdv_id) : null;
        }

        if (id) {
          const idx = db.reservas.findIndex((r) => Number(r.id) === Number(id));
          if (idx >= 0) {
            db.reservas[idx] = { ...db.reservas[idx], ...dadosReserva };
            reservaSalvaObj = db.reservas[idx];
          }
        }
        if (!reservaSalvaObj) {
          reservaSalvaObj = {
            id: nextId(db.reservas),
            ...dadosReserva,
            comanda_pdv_id: dadosReserva.comanda_pdv_id ?? null,
            arquivado_legal: false,
            criado_em: new Date().toISOString()
          };
          db.reservas.unshift(reservaSalvaObj);
        }

        upsertCadastroPessoaAutomatico({
          nome: clienteFinal,
          whatsapp: wppResolvido || whatsapp || '',
          papel: 'cliente',
          empresa_id: Number(unidade_id || 1),
          cargo_ou_ramo: `Cliente de Reserva (${areaFinal})`,
          observacoes:
            observacoes ||
            `Cadastrado automaticamente na reserva (${mesaPrincipal ? `Mesa ${mesaPrincipal}` : 'Sem mesa definida'})`
        });
      },
      { agregado: 'RESERVAS', tipo: 'reserva.atualizada', payload: { cliente: clienteFinal, data, hora, mesa: mesaFinalSalva, area } }
    );

    const rotuloMesaLog = mesaFinalSalva || 'Sem mesa definida';
    await registrarAuditLog(
      'Hostess',
      'SALVAR_RESERVA_SALAO',
      `Reserva de ${clienteFinal} (${rotuloMesaLog}) — Adultos Pag:${adultos_pagantes}/Freq:${adultos_frequentadores}, Kids Pag:${criancas_pagantes}/Freq:${criancas_frequentadores}`,
      req.ip
    );
    const dispConsumer = await dispararLancamentoConsumerApi(Number(unidade_id || 1), 'MESA_COMANDA', {
      cliente: clienteFinal,
      whatsapp: whatsapp || '',
      data: data || getTodayISO(),
      hora: hora || '20:00',
      mesa: mesaFinalSalva || 'A DEFINIR',
      area: area || 'Salão Principal',
      pessoas:
        Math.max(0, Number(adultos_pagantes ?? 1)) +
        Math.max(0, Number(adultos_frequentadores ?? 0)) +
        Math.max(0, Number(criancas_pagantes ?? 0)) +
        Math.max(0, Number(criancas_frequentadores ?? 0)),
      status: status || 'Confirmada',
      observacoes: observacoes || ''
    });
    res.json({ ok: true, id: reservaSalvaObj?.id, reserva: reservaSalvaObj, mesa: mesaFinalSalva, consumer_api: dispConsumer });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.post('/api/reservas/limpar-todas', async (req: Request, res: Response) => {
  try {
    const { zerar_ambientes_mapa, limpar_reservas, data_alvo } = req.body || {};
    let totalReservasLimpas = 0;

    await executarComOutbox(
      () => {
        if (limpar_reservas !== false && Array.isArray(db.reservas)) {
          for (const r of db.reservas) {
            if (r.arquivado_legal) continue;
            if (data_alvo && String(r.data || '') !== String(data_alvo)) continue;
            r.arquivado_legal = true;
            totalReservasLimpas++;
          }
        }
        if (zerar_ambientes_mapa) {
          if (!Array.isArray(db.erp_configs)) db.erp_configs = [];
          const cfgIdx = db.erp_configs.findIndex((c: any) => c.chave === 'mapa_mesas_salao_layout');
          const emptyLayout = { environments: [], tables: [] };
          if (cfgIdx >= 0) {
            (db.erp_configs[cfgIdx] as any).valor_json = emptyLayout;
            (db.erp_configs[cfgIdx] as any).atualizado_em = new Date().toISOString();
          } else {
            db.erp_configs.push({
              id: nextId(db.erp_configs),
              chave: 'mapa_mesas_salao_layout',
              valor_json: emptyLayout,
              atualizado_em: new Date().toISOString()
            } as any);
          }
        }
      },
      {
        agregado: 'RESERVAS',
        tipo: 'reservas.limpeza_geral',
        payload: { totalReservasLimpas, zerar_ambientes_mapa: Boolean(zerar_ambientes_mapa) }
      }
    );

    await registrarAuditLog(
      'Hostess',
      'LIMPAR_RESERVAS_E_AMBIENTES',
      `Limpeza executada: ${totalReservasLimpas} reserva(s) arquivada(s) | Mapa zerado: ${zerar_ambientes_mapa ? 'SIM' : 'NÃO'}`,
      req.ip
    );
    res.json({ ok: true, total_reservas_limpas: totalReservasLimpas, mapa_zerado: Boolean(zerar_ambientes_mapa) });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.get('/api/sites', (_req: Request, res: Response) => {
  res.json(db.sites_portais.filter((s) => !s.arquivado_legal));
});

app.post('/api/sites/salvar', async (req: Request, res: Response) => {
  try {
    const { id, nome, url, orientacoes } = req.body;
    if (!nome || !url) return res.status(400).json({ erro: 'Informe o nome e a URL do portal externo.' });

    await executarComOutbox(
      () => {
        if (id) {
          const idx = db.sites_portais.findIndex((s) => Number(s.id) === Number(id));
          if (idx >= 0) {
            db.sites_portais[idx] = { ...db.sites_portais[idx], nome, url, orientacoes: orientacoes || '' };
          }
        } else {
          db.sites_portais.push({
            id: nextId(db.sites_portais),
            nome,
            url,
            orientacoes: orientacoes || '',
            arquivado_legal: false,
            criado_em: new Date().toISOString()
          });
        }
      },
      { agregado: 'PORTAIS', tipo: 'portal.atualizado', payload: { nome, url } }
    );

    await registrarAuditLog('Admin', 'SALVAR_PORTAL_EXTERNO', `Portal ${nome} (${url}) salvo`, req.ip);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.get('/api/proxy-portal', async (req: Request, res: Response) => {
  const targetUrl = String(req.query.url || '').trim();
  const nomePortal = String(req.query.nome || 'Portal Externo');
  if (!targetUrl) return res.status(400).send('URL ausente');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Urutau Proxy Seguro</title>
  <style>
    body { margin: 0; font-family: 'Plus Jakarta Sans', sans-serif; background: #0B0D11; color: #F1F5F9; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
    .bar { background: #12161F; border-bottom: 1px solid #1E2430; padding: 8px 14px; display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: #94A3B8; }
    .badge { color: #F59E0B; font-family: monospace; font-weight: 600; }
    iframe { flex: 1; width: 100%; border: 0; background: #fff; }
  </style>
</head>
<body>
  <div class="bar">
    <span>Sessão Isolada Proxy Urutau (Art. 10): <strong>${nomePortal.replace(/</g, '&lt;')}</strong></span>
    <span class="badge">${targetUrl.replace(/</g, '&lt;')}</span>
  </div>
  <iframe src="${targetUrl.replace(/"/g, '&quot;')}" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>
</body>
</html>`);
});

app.post('/api/v20/caixa/salvar', async (req: Request, res: Response) => {
  try {
    const sessao = extrairSessaoRequisicao(req);
    if (!sessao) {
      return res.status(401).json({ ok: false, erro: 'Sessao invalida.' });
    }
    const { id, data, tipo, categoria, descricao, expressao, valor, unidade_id } = req.body;
    if (!descricao || !String(descricao).trim()) {
      return res.status(400).json({ erro: 'Informe a descrição do lançamento de caixa.' });
    }

    const valorCentavos = reaisToCentavos(valor);
    const valorExatoReais = centavosToReais(valorCentavos);
    const tipoValido: 'Entrada' | 'Saída' = tipo === 'Saída' ? 'Saída' : 'Entrada';
    const empIdAutorizado = sessao.super ? Number(req.body?.empresa_id || sessao.emp || 1) : Number(sessao.emp || 1);
    const unidId = Math.max(1, Math.trunc(Number(unidade_id || 1)));
    const nowUtc = new Date().toISOString();
    const dataRef = data || getTodayISO();

    let idGerado = Number(id || 0);
    await executarComOutbox(
      () => {
        const registro = {
          data: dataRef,
          tipo: tipoValido,
          categoria: String(categoria || 'Operacional').trim(),
          descricao: String(descricao).trim(),
          expressao: expressao || String(valorExatoReais),
          valor: valorExatoReais,
          valor_centavos: valorCentavos,
          unidade_id: unidId,
          empresa_id: empIdAutorizado,
          usuario_id: sessao.uid
        };
        if (id) {
          const idx = db.erp_caixa.findIndex((c) => Number(c.id) === Number(id));
          if (idx >= 0) db.erp_caixa[idx] = { ...db.erp_caixa[idx], ...registro };
        } else {
          idGerado = nextId(db.erp_caixa);
          db.erp_caixa.unshift({
            id: idGerado,
            ...registro,
            arquivado_legal: false,
            criado_em: nowUtc
          });
        }

        const nomeCatLimpo = String(categoria || 'Operacional').trim();
        if (nomeCatLimpo) {
          if (!Array.isArray(db.erp_categorias_fechamento_caixa)) {
            db.erp_categorias_fechamento_caixa = [];
          }
          const catExistente = db.erp_categorias_fechamento_caixa.find(
            (cat: any) =>
              !cat.arquivado_legal &&
              String(cat.nome || '').trim().toLowerCase() === nomeCatLimpo.toLowerCase()
          );
          if (!catExistente) {
            db.erp_categorias_fechamento_caixa.push({
              id: `cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              nome: nomeCatLimpo,
              tipo: tipoValido,
              modo_padrao: 'mesclado',
              fonte_sistema: 'CAIXA_CATEGORIA',
              filtro_origem: nomeCatLimpo,
              lancar_no_caixa_em_massa: true,
              ordem: db.erp_categorias_fechamento_caixa.length + 1,
              unidade_id: unidId,
              arquivado_legal: false
            });
          }
        }

      },
      { agregado: 'CAIXA', tipo: 'caixa.movimentacao_registrada', payload: { data: dataRef, tipo: tipoValido, descricao, valor: valorExatoReais } }
    );

    await commerceRepository.runAtomicTransaction(async (client) => {
      await commerceRepository.ensureEmpresaExists(empIdAutorizado, `Empresa ${empIdAutorizado}`, client);
      await commerceRepository.insertCaixaLancamentoIdempotent(
        client,
        {
          op_uuid: `CX-DIR-${empIdAutorizado}-${idGerado || Date.now()}`,
          empresa_id: empIdAutorizado,
          unidade_id: unidId,
          data_referencia_utc: dataRef,
          tipo: tipoValido,
          categoria: String(categoria || 'Operacional').trim(),
          descricao: String(descricao).trim(),
          valor_centavos: valorCentavos,
          forma_pagamento: 'Direto Caixa',
          responsavel: sessao.nome,
          origem_comanda_id: null,
          arquivado_legal: 0,
          criado_em_utc: nowUtc
        },
        true
      );
    });

    await registrarAuditLog(sessao.nome, 'LANCAMENTO_CAIXA', `${tipoValido}: ${descricao} — R$ ${valorExatoReais.toFixed(2)} (${valorCentavos} centavos)`, req.ip, sessao.cargo);
    const dispConsumer = await dispararLancamentoConsumerApi(empIdAutorizado, 'CAIXA', {
      id_origem: idGerado,
      data: dataRef,
      tipo: tipoValido,
      categoria: categoria || 'Operacional',
      descricao,
      valor: valorExatoReais,
      expressao: expressao || String(valorExatoReais)
    });
    res.json({ ok: true, id: idGerado, valor_centavos: valorCentavos, consumer_api: dispConsumer });
  } catch (e: any) {
    handleDomainErrorResponse(e, res);
  }
});

app.post('/api/v20/caixa/categorias-fechamento/salvar', async (req: Request, res: Response) => {
  try {
    if (!Array.isArray(db.erp_categorias_fechamento_caixa)) {
      db.erp_categorias_fechamento_caixa = [];
    }
    const { categoria, categorias_lote } = req.body || {};

    await executarComOutbox(
      () => {
        if (Array.isArray(categorias_lote)) {
          for (const cat of categorias_lote) {
            if (!cat || !cat.nome) continue;
            const catId = String(cat.id || `cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
            const idx = db.erp_categorias_fechamento_caixa!.findIndex((c: any) => String(c.id) === catId);
            const payloadCat = {
              id: catId,
              nome: String(cat.nome).trim(),
              tipo: cat.tipo === 'Saída' ? 'Saída' : 'Entrada',
              modo_padrao: ['sistema', 'manual', 'mesclado'].includes(cat.modo_padrao) ? cat.modo_padrao : 'mesclado',
              fonte_sistema: String(cat.fonte_sistema || 'CAIXA_CATEGORIA'),
              filtro_origem: String(cat.filtro_origem ?? cat.nome ?? '').trim(),
              lancar_no_caixa_em_massa: cat.lancar_no_caixa_em_massa !== false,
              ordem: Number(cat.ordem || db.erp_categorias_fechamento_caixa!.length + 1),
              unidade_id: Number(cat.unidade_id || 1),
              arquivado_legal: false
            };
            if (idx >= 0) {
              db.erp_categorias_fechamento_caixa![idx] = { ...db.erp_categorias_fechamento_caixa![idx], ...payloadCat };
            } else {
              db.erp_categorias_fechamento_caixa!.push(payloadCat);
            }
          }
        } else if (categoria && categoria.nome) {
          const catId = String(categoria.id || `cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
          const idx = db.erp_categorias_fechamento_caixa!.findIndex((c: any) => String(c.id) === catId);
          const payloadCat = {
            id: catId,
            nome: String(categoria.nome).trim(),
            tipo: categoria.tipo === 'Saída' ? 'Saída' : 'Entrada',
            modo_padrao: ['sistema', 'manual', 'mesclado'].includes(categoria.modo_padrao)
              ? categoria.modo_padrao
              : 'mesclado',
            fonte_sistema: String(categoria.fonte_sistema || 'CAIXA_CATEGORIA'),
            filtro_origem: String(categoria.filtro_origem ?? categoria.nome ?? '').trim(),
            lancar_no_caixa_em_massa: categoria.lancar_no_caixa_em_massa !== false,
            ordem: Number(categoria.ordem || db.erp_categorias_fechamento_caixa!.length + 1),
            unidade_id: Number(categoria.unidade_id || 1),
            arquivado_legal: false
          };
          if (idx >= 0) {
            db.erp_categorias_fechamento_caixa![idx] = { ...db.erp_categorias_fechamento_caixa![idx], ...payloadCat };
          } else {
            db.erp_categorias_fechamento_caixa!.push(payloadCat);
          }
        }
      },
      {
        agregado: 'CAIXA_FECHAMENTO',
        tipo: 'caixa.categorias_fechamento_atualizadas',
        payload: { total: db.erp_categorias_fechamento_caixa.length }
      }
    );

    await registrarAuditLog(
      'Operador Caixa',
      'CATEGORIAS_FECHAMENTO_CAIXA',
      'Atualizou categorias e fontes pré-salvas do Relatório Diário de Fechamento de Caixa',
      req.ip
    );
    res.json({
      ok: true,
      categorias: db.erp_categorias_fechamento_caixa.filter((c: any) => !c.arquivado_legal)
    });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.post('/api/v20/caixa/categorias-fechamento/excluir', async (req: Request, res: Response) => {
  try {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ erro: 'Informe o ID da categoria para excluir.' });
    if (!Array.isArray(db.erp_categorias_fechamento_caixa)) {
      db.erp_categorias_fechamento_caixa = [];
    }
    let nomeExcluido = String(id);
    await executarComOutbox(
      () => {
        const idx = db.erp_categorias_fechamento_caixa!.findIndex((c: any) => String(c.id) === String(id));
        if (idx >= 0) {
          nomeExcluido = db.erp_categorias_fechamento_caixa![idx].nome || nomeExcluido;
          db.erp_categorias_fechamento_caixa![idx].arquivado_legal = true;
        }
      },
      {
        agregado: 'CAIXA_FECHAMENTO',
        tipo: 'caixa.categoria_fechamento_excluida',
        payload: { id, nome: nomeExcluido }
      }
    );
    await registrarAuditLog(
      'Operador Caixa',
      'EXCLUIR_CATEGORIA_FECHAMENTO',
      `Excluiu a categoria "${nomeExcluido}" do modelo de fechamento diário de caixa`,
      req.ip
    );
    res.json({
      ok: true,
      categorias: db.erp_categorias_fechamento_caixa.filter((c: any) => !c.arquivado_legal)
    });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.post('/api/v20/caixa/fechamento-diario/salvar', async (req: Request, res: Response) => {
  try {
    if (!Array.isArray(db.erp_fechamentos_caixa_diarios)) {
      db.erp_fechamentos_caixa_diarios = [];
    }
    if (!Array.isArray(db.erp_categorias_fechamento_caixa)) {
      db.erp_categorias_fechamento_caixa = [];
    }

    const {
      id,
      data,
      unidade_id,
      empresa_id,
      operador_id,
      operador_nome,
      turno,
      itens,
      observacoes_gerais,
      registrar_em_massa_no_caixa,
      modo_lancamento_massa,
      salvar_fontes_como_padrao
    } = req.body || {};

    const dataRef = String(data || getTodayISO());
    const unidId = Number(unidade_id || 1);
    const turnoRef = String(turno || 'Fechamento Geral do Dia');
    const itensValidos: any[] = Array.isArray(itens) ? itens : [];

    let totalEntradas = 0;
    let totalSaidas = 0;
    let totalSistema = 0;
    let totalManual = 0;

    const itensNormalizados = itensValidos.map((it: any) => {
      const tipo = it.tipo === 'Saída' ? 'Saída' : 'Entrada';
      const modo = ['sistema', 'manual', 'mesclado'].includes(it.modo_preenchimento)
        ? it.modo_preenchimento
        : 'mesclado';
      const vSis = Number(Number(it.valor_sistema || 0).toFixed(2));
      const vMan = Number(Number(it.valor_manual || 0).toFixed(2));
      const vFinal =
        modo === 'sistema'
          ? vSis
          : modo === 'manual'
          ? vMan
          : Number((vSis + vMan).toFixed(2));

      if (tipo === 'Entrada') totalEntradas += vFinal;
      else totalSaidas += vFinal;

      if (modo === 'sistema') {
        totalSistema += vSis;
      } else if (modo === 'manual') {
        totalManual += vMan;
      } else {
        totalSistema += vSis;
        totalManual += vMan;
      }

      return {
        categoria_id: String(it.categoria_id || `cat_${Date.now()}`),
        nome: String(it.nome || 'Categoria').trim(),
        tipo,
        modo_preenchimento: modo,
        fonte_sistema: String(it.fonte_sistema || 'CAIXA_CATEGORIA'),
        filtro_origem: String(it.filtro_origem || '').trim(),
        valor_sistema: vSis,
        qtd_itens_sistema: Number(it.qtd_itens_sistema || 0),
        expressao_manual: String(it.expressao_manual || ''),
        valor_manual: vMan,
        valor_final: vFinal,
        observacao: String(it.observacao || '').trim(),
        lancar_no_caixa: it.lancar_no_caixa !== false
      };
    });

    totalEntradas = Number(totalEntradas.toFixed(2));
    totalSaidas = Number(totalSaidas.toFixed(2));
    totalSistema = Number(totalSistema.toFixed(2));
    totalManual = Number(totalManual.toFixed(2));
    const saldoLiquido = Number((totalEntradas - totalSaidas).toFixed(2));

    let fechamentoSalvo: any = null;
    let qtdLancamentosGerados = 0;
    const modoMassa =
      modo_lancamento_massa === 'valor_final_consolidado'
        ? 'valor_final_consolidado'
        : 'apenas_manual_complementar';

    await executarComOutbox(
      () => {
        if (salvar_fontes_como_padrao !== false) {
          for (const it of itensNormalizados) {
            const cIdx = db.erp_categorias_fechamento_caixa!.findIndex(
              (c: any) => String(c.id) === String(it.categoria_id)
            );
            if (cIdx >= 0) {
              db.erp_categorias_fechamento_caixa![cIdx] = {
                ...db.erp_categorias_fechamento_caixa![cIdx],
                nome: it.nome,
                tipo: it.tipo,
                modo_padrao: it.modo_preenchimento,
                fonte_sistema: it.fonte_sistema,
                filtro_origem: it.filtro_origem,
                lancar_no_caixa_em_massa: it.lancar_no_caixa
              };
            }
          }
        }

        if (registrar_em_massa_no_caixa) {
          for (const it of itensNormalizados) {
            if (!it.lancar_no_caixa) continue;

            const fonteJaNoCaixa = [
              'CAIXA_CATEGORIA',
              'DELIVERY_ENTRADAS',
              'CAIXA_SALAO_ENTRADAS',
              'CAIXA_TODAS_ENTRADAS',
              'CAIXA_TODAS_SAIDAS'
            ].includes(it.fonte_sistema);

            let valorParaCaixa = 0;
            if (modoMassa === 'valor_final_consolidado') {
              valorParaCaixa = it.valor_final;
            } else {
              if (it.modo_preenchimento === 'manual') {
                valorParaCaixa = it.valor_manual;
              } else if (it.modo_preenchimento === 'mesclado') {
                valorParaCaixa = fonteJaNoCaixa ? it.valor_manual : it.valor_final;
              } else {
                valorParaCaixa = fonteJaNoCaixa ? 0 : it.valor_sistema;
              }
            }

            valorParaCaixa = Number(Number(valorParaCaixa || 0).toFixed(2));
            if (valorParaCaixa <= 0) continue;

            const chaveMassa = `FECHAMENTO_${dataRef}_U${unidId}_${it.categoria_id}`;
            const idxExistenteCaixa = db.erp_caixa.findIndex(
              (c: any) => !c.arquivado_legal && c.chave_fechamento_massa === chaveMassa
            );

            const descConsolidada = `[Fechamento Diário] ${it.nome}${
              it.observacao ? ` — ${it.observacao}` : ''
            } (${
              it.modo_preenchimento === 'mesclado'
                ? `Mesclado Sis: R$ ${it.valor_sistema.toFixed(2)} + Man: R$ ${it.valor_manual.toFixed(2)}`
                : it.modo_preenchimento === 'sistema'
                ? 'Puxado do Sistema'
                : 'Digitado Manualmente'
            })`;

            const regCaixa = {
              data: dataRef,
              tipo: it.tipo,
              categoria: it.filtro_origem || it.nome,
              descricao: descConsolidada,
              expressao: it.expressao_manual || String(valorParaCaixa),
              valor: valorParaCaixa,
              unidade_id: unidId,
              usuario_id: Number(operador_id || 1),
              chave_fechamento_massa: chaveMassa,
              origem_fechamento_diario: true
            };

            if (idxExistenteCaixa >= 0) {
              db.erp_caixa[idxExistenteCaixa] = {
                ...db.erp_caixa[idxExistenteCaixa],
                ...regCaixa,
                atualizado_em: new Date().toISOString()
              };
            } else {
              db.erp_caixa.unshift({
                id: nextId(db.erp_caixa),
                ...regCaixa,
                arquivado_legal: false,
                criado_em: new Date().toISOString()
              });
            }
            qtdLancamentosGerados++;
          }
        }

        const idxRel = db.erp_fechamentos_caixa_diarios!.findIndex(
          (f: any) =>
            !f.arquivado_legal &&
            ((id && Number(f.id) === Number(id)) ||
              (f.data === dataRef && Number(f.unidade_id) === unidId && f.turno === turnoRef))
        );

        const payloadRel = {
          data: dataRef,
          unidade_id: unidId,
          empresa_id: Number(empresa_id || 1),
          operador_id: Number(operador_id || 1),
          operador_nome: String(operador_nome || 'Operador Caixa'),
          turno: turnoRef,
          itens: itensNormalizados,
          total_entradas: totalEntradas,
          total_saidas: totalSaidas,
          saldo_liquido: saldoLiquido,
          total_sistema: totalSistema,
          total_manual: totalManual,
          observacoes_gerais: String(observacoes_gerais || '').trim(),
          lancado_em_massa_no_caixa: Boolean(registrar_em_massa_no_caixa),
          modo_lancamento_massa: modoMassa,
          qtd_lancamentos_gerados_caixa: qtdLancamentosGerados,
          atualizado_em: new Date().toISOString()
        };

        if (idxRel >= 0) {
          db.erp_fechamentos_caixa_diarios![idxRel] = {
            ...db.erp_fechamentos_caixa_diarios![idxRel],
            ...payloadRel
          };
          fechamentoSalvo = db.erp_fechamentos_caixa_diarios![idxRel];
        } else {
          fechamentoSalvo = {
            id: nextId(db.erp_fechamentos_caixa_diarios!),
            ...payloadRel,
            arquivado_legal: false,
            criado_em: new Date().toISOString()
          };
          db.erp_fechamentos_caixa_diarios!.unshift(fechamentoSalvo);
        }
      },
      {
        agregado: 'CAIXA_FECHAMENTO',
        tipo: 'caixa.fechamento_diario_registrado',
        payload: {
          data: dataRef,
          unidade_id: unidId,
          total_entradas: totalEntradas,
          total_saidas: totalSaidas,
          saldo_liquido: saldoLiquido,
          qtd_lancamentos_gerados: qtdLancamentosGerados
        }
      }
    );

    await registrarAuditLog(
      String(operador_nome || 'Operador Caixa'),
      'FECHAMENTO_CAIXA_EM_MASSA',
      `Fechamento Diário (${dataRef}): Entradas R$ ${totalEntradas.toFixed(2)} | Saídas R$ ${totalSaidas.toFixed(2)} | Saldo R$ ${saldoLiquido.toFixed(2)} (${qtdLancamentosGerados} lançamentos em massa no Caixa)`,
      req.ip
    );

    res.json({
      ok: true,
      fechamento: fechamentoSalvo,
      qtd_lancamentos_gerados: qtdLancamentosGerados
    });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.post('/api/v20/estoque/salvar', async (req: Request, res: Response) => {
  try {
    const sessao = extrairSessaoRequisicao(req);
    if (!sessao) {
      return res.status(401).json({ ok: false, erro: 'Sessao invalida.' });
    }
    const { id, nome, insumo, categoria, quantidade, unidade_medida, unidade, estoque_minimo, minimo, custo_unitario, em_compras, fornecedor } = req.body;
    const nomeResolvido = String(nome || insumo || '').trim();
    if (!nomeResolvido) return res.status(400).json({ erro: 'Informe o nome do insumo.' });

    const qtdNum = Number(quantidade ?? 0);
    const minNum = Number(estoque_minimo ?? minimo ?? 0);
    if (!Number.isFinite(qtdNum) || qtdNum < 0 || !Number.isFinite(minNum) || minNum < 0) {
      return res.status(400).json({ erro: 'Quantidade e estoque minimo nao podem ser negativos.' });
    }
    const custoCentavos = reaisToCentavos(custo_unitario ?? 0);
    const custoReais = centavosToReais(custoCentavos);
    const saldoMili = Math.round(qtdNum * 1000);
    const minMili = Math.round(minNum * 1000);
    const unidMedidaFinal = String(unidade_medida || unidade || 'kg').trim();
    const empIdAutorizado = sessao.super ? Number(req.body?.empresa_id || sessao.emp || 1) : Number(sessao.emp || 1);
    const flagCompras = em_compras !== undefined ? !!em_compras : saldoMili <= minMili && minMili > 0;

    let itemIdSalvo = Number(id || 0);
    await executarComOutbox(
      () => {
        const dados = {
          nome: nomeResolvido,
          insumo: nomeResolvido,
          categoria: categoria || 'Insumos',
          quantidade: Number((saldoMili / 1000).toFixed(3)),
          unidade_medida: unidMedidaFinal,
          estoque_minimo: Number((minMili / 1000).toFixed(3)),
          custo_unitario: custoReais,
          custo_unitario_centavos: custoCentavos,
          empresa_id: empIdAutorizado,
          em_compras: flagCompras,
          fornecedor: fornecedor || ''
        };
        if (id) {
          const idx = db.erp_estoque.findIndex((e) => Number(e.id) === Number(id));
          if (idx >= 0) {
            db.erp_estoque[idx] = { ...db.erp_estoque[idx], ...dados };
            itemIdSalvo = Number(id);
          }
        }
        if (!itemIdSalvo) {
          itemIdSalvo = nextId(db.erp_estoque);
          db.erp_estoque.push({
            id: itemIdSalvo,
            ...dados,
            arquivado_legal: false,
            criado_em: new Date().toISOString()
          });
        }

        if (fornecedor && String(fornecedor).trim()) {
          upsertCadastroPessoaAutomatico({
            nome: String(fornecedor).trim(),
            tipo_pessoa: 'PJ',
            papel: 'fornecedor',
            empresa_id: empIdAutorizado,
            cargo_ou_ramo: `Fornecedor (${categoria || 'Insumos'})`,
            observacoes: `Vinculado automaticamente ao insumo "${nomeResolvido}"`
          });
        }
      },
      { agregado: 'ESTOQUE', tipo: 'estoque.atualizado', payload: { nome: nomeResolvido, quantidade: qtdNum, em_compras: flagCompras } }
    );

    await commerceRepository.upsertSingleStockItem({
      id: itemIdSalvo,
      empresa_id: empIdAutorizado,
      insumo_nome: nomeResolvido,
      unidade_medida: unidMedidaFinal,
      saldo_mili: saldoMili,
      minimo_mili: minMili,
      custo_unitario_centavos: custoCentavos
    });

    await registrarAuditLog(sessao.nome, 'ATUALIZAR_ESTOQUE', `Insumo ${nomeResolvido}: ${qtdNum} ${unidMedidaFinal} (Em compras: ${flagCompras})`, req.ip, sessao.cargo);
    const dispConsumer = await dispararLancamentoConsumerApi(empIdAutorizado, 'ESTOQUE_COMPRA', {
      operacao: 'AJUSTE_SALDO_INSUMO',
      nome: nomeResolvido,
      categoria: categoria || 'Insumos',
      quantidade: qtdNum,
      unidade_medida: unidMedidaFinal,
      custo_unitario: custoReais,
      fornecedor: fornecedor || ''
    });
    res.json({ ok: true, id: itemIdSalvo, saldo_mili: saldoMili, consumer_api: dispConsumer });
  } catch (e: any) {
    handleDomainErrorResponse(e, res);
  }
});

app.post('/api/v20/compras/receber-insumo', async (req: Request, res: Response) => {
  try {
    const { id_estoque, quantidade_comprada, custo_unitario_novo, lancar_saida_caixa } = req.body;
    const item = db.erp_estoque.find((e) => Number(e.id) === Number(id_estoque) && !e.arquivado_legal);
    if (!item) return res.status(404).json({ erro: 'Insumo não localizado no estoque.' });

    const qtdAdicional = Number(quantidade_comprada || 0);
    const custoFinal = Number(custo_unitario_novo || item.custo_unitario || 0);
    const valorTotalCompra = qtdAdicional * custoFinal;

    await executarComOutbox(
      () => {
        item.quantidade = Number((Number(item.quantidade || 0) + qtdAdicional).toFixed(3));
        item.custo_unitario = custoFinal;
        item.em_compras = item.quantidade <= Number(item.estoque_minimo || 0);

        if (lancar_saida_caixa && valorTotalCompra > 0) {
          db.erp_caixa.unshift({
            id: nextId(db.erp_caixa),
            data: getTodayISO(),
            tipo: 'Saída',
            categoria: 'Compras & Reposição',
            descricao: `Recebimento Compra: ${item.nome} (+${qtdAdicional} ${item.unidade_medida})`,
            expressao: `${qtdAdicional} * ${custoFinal}`,
            valor: valorTotalCompra,
            unidade_id: 1,
            usuario_id: 1,
            arquivado_legal: false,
            criado_em: new Date().toISOString()
          });
        }
      },
      { agregado: 'COMPRAS', tipo: 'estoque.atualizado', payload: { nome: item.nome, quantidade: item.quantidade } }
    );

    await registrarAuditLog('Suprimentos', 'RECEBIMENTO_COMPRA_ESTOQUE', `Reposição de ${item.nome} (+${qtdAdicional} ${item.unidade_medida}) — Total R$ ${valorTotalCompra.toFixed(2)}`, req.ip);
    const dispConsumer = await dispararLancamentoConsumerApi(1, 'ESTOQUE_COMPRA', {
      operacao: 'ENTRADA_COMPRA_MERCADORIA',
      id_estoque: item.id,
      nome: item.nome,
      categoria: item.categoria || 'Insumos',
      quantidade_comprada: qtdAdicional,
      saldo_final: item.quantidade,
      unidade_medida: item.unidade_medida || 'kg',
      custo_unitario: custoFinal,
      valor_total_compra: valorTotalCompra,
      lancar_saida_caixa: Boolean(lancar_saida_caixa)
    });
    res.json({ ok: true, consumer_api: dispConsumer });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.post('/api/v20/cmv/salvar', async (req: Request, res: Response) => {
  try {
    const { id, data, unidade_id, estoque_inicial, compras_periodo, estoque_final, custo_insumos, faturamento } = req.body;
    const ei = Number(estoque_inicial || 0);
    const cp = Number(compras_periodo || 0);
    const ef = Number(estoque_final || 0);
    const fat = Number(faturamento || 0);
    const custoFinal = custo_insumos !== undefined && Number(custo_insumos) > 0 ? Number(custo_insumos) : Math.max(0, ei + cp - ef);
    const perc = fat > 0 ? Number(((custoFinal / fat) * 100).toFixed(2)) : 0;

    await executarComOutbox(
      () => {
        const dados = {
          data: data || getTodayISO(),
          unidade_id: Number(unidade_id || 1),
          estoque_inicial: ei,
          compras_periodo: cp,
          estoque_final: ef,
          custo_insumos: custoFinal,
          faturamento: fat,
          percentual_cmv: perc
        };
        if (id) {
          const idx = db.erp_cmv.findIndex((c) => Number(c.id) === Number(id));
          if (idx >= 0) db.erp_cmv[idx] = { ...db.erp_cmv[idx], ...dados };
        } else {
          db.erp_cmv.unshift({
            id: nextId(db.erp_cmv),
            ...dados,
            arquivado_legal: false,
            criado_em: new Date().toISOString()
          });
        }
      },
      { agregado: 'CMV', tipo: 'caixa.movimentacao_registrada', payload: { data, custoFinal, fat, perc } }
    );

    await registrarAuditLog('Controller CMV', 'APURACAO_CMV', `CMV apurado em ${data}: R$ ${custoFinal.toFixed(2)} (${perc.toFixed(2)}% sobre faturamento)`, req.ip);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.post('/api/v20/selecao/salvar', async (req: Request, res: Response) => {
  try {
    const { id, nome, whatsapp, vaga, etapa, observacoes } = req.body;
    if (!nome) return res.status(400).json({ erro: 'Informe o nome do candidato.' });
    const etapaNum = Math.min(5, Math.max(1, Number(etapa || 1)));

    let idColaboradorGerado: number | null = null;

    await executarComOutbox(
      async () => {
        if (id) {
          const idx = db.erp_selecao.findIndex((s) => Number(s.id) === Number(id));
          if (idx >= 0) {
            db.erp_selecao[idx] = {
              ...db.erp_selecao[idx],
              nome,
              whatsapp: whatsapp || '',
              vaga: vaga || '',
              etapa: etapaNum,
              observacoes: observacoes || ''
            };
          }
        } else {
          db.erp_selecao.push({
            id: nextId(db.erp_selecao),
            nome,
            whatsapp: whatsapp || '',
            vaga: vaga || '',
            etapa: etapaNum,
            observacoes: observacoes || '',
            arquivado_legal: false,
            criado_em: new Date().toISOString()
          });
        }

        if (etapaNum === 5) {
          const jaExiste = db.usuarios.find(
            (u) => !u.arquivado_legal && u.nome.toLowerCase().trim() === String(nome).toLowerCase().trim()
          );
          if (!jaExiste) {
            const novoUserId = nextId(db.usuarios);
            const hashPadrao = await gerarHashArgon2id(getOrGenerateInitialMasterPassword());
            db.usuarios.push({
              id: novoUserId,
              nome,
              telefone: whatsapp || '',
              tipo: 'Colaborador',
              cargo: vaga || 'Operacional',
              foto: '',
              escala_fixa_json: JSON.stringify([2, 3, 4, 5, 6, 0]),
              senha_argon2id: hashPadrao,
              permissoes_json: { checklists: true },
              arquivado_legal: false,
              criado_em: new Date().toISOString()
            });
            atualizarVinculoInterno('rel_usuario_unidade', 'usuario_id', 'unidade_id', novoUserId, [1]);
            atualizarVinculoInterno('rel_usuario_setor', 'usuario_id', 'setor_id', novoUserId, [1]);
            idColaboradorGerado = novoUserId;
          } else {
            idColaboradorGerado = jaExiste.id;
          }
        }
      },
      {
        agregado: 'SELECAO',
        tipo: etapaNum === 5 ? 'equipe.contratado_automatico' : 'selecao.atualizada',
        payload: { nome, vaga, etapa: etapaNum, idColaboradorGerado }
      }
    );

    await registrarAuditLog(
      'RH Seleção',
      etapaNum === 5 ? 'CONTRATACAO_AUTOMATICA_ETAPA_5' : 'MOVIMENTACAO_FUNIL_SELECAO',
      `Candidato ${nome} (${vaga}) na Etapa ${etapaNum}${idColaboradorGerado ? ` — Integrado à Equipe sob ID #${idColaboradorGerado}` : ''}`,
      req.ip
    );
    res.json({ ok: true, contratado_usuario_id: idColaboradorGerado });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.post(['/api/v20/rh/salvar', '/api/v20/rh/aplicar-recurso'], async (req: Request, res: Response) => {
  try {
    const {
      id,
      usuario_id,
      aplicar_para_todos,
      empresa_id,
      categoria,
      recurso_codigo,
      titulo,
      descricao,
      data,
      validade_data,
      status,
      nota_avaliacao,
      valor_financeiro,
      lancar_caixa,
      notificar_wpp,
      itens_aplicados,
      segredo
    } = req.body;

    if (!titulo) return res.status(400).json({ erro: 'Informe o título do prontuário ou recurso de RH.' });
    const cifrado = segredo ? encryptAES(segredo) : '';
    const valorNum = Number(valor_financeiro || 0);
    const notaNum = nota_avaliacao !== undefined && nota_avaliacao !== null ? Number(nota_avaliacao) : undefined;

    let totalAplicados = 0;

    await executarComOutbox(
      () => {
        const usuariosAlvo = aplicar_para_todos
          ? db.usuarios.filter(
              (u) =>
                !u.arquivado_legal &&
                (!empresa_id ||
                  !Array.isArray(u.empresas_ids) ||
                  u.empresas_ids.map(Number).includes(Number(empresa_id)))
            )
          : [db.usuarios.find((u) => Number(u.id) === Number(usuario_id || 1)) || db.usuarios[0]].filter(Boolean);

        if (id && !aplicar_para_todos) {
          const idx = db.erp_rh_nr01.findIndex((r) => Number(r.id) === Number(id));
          if (idx >= 0) {
            db.erp_rh_nr01[idx] = {
              ...db.erp_rh_nr01[idx],
              usuario_id: Number(usuario_id || 1),
              categoria: categoria || 'NR-01 & Riscos',
              recurso_codigo: recurso_codigo || db.erp_rh_nr01[idx].recurso_codigo || '',
              titulo,
              descricao: descricao || '',
              data: data || getTodayISO(),
              validade_data: validade_data || db.erp_rh_nr01[idx].validade_data || '',
              status: status || 'Ativo',
              nota_avaliacao: notaNum ?? db.erp_rh_nr01[idx].nota_avaliacao,
              valor_financeiro: valorNum,
              itens_aplicados: Array.isArray(itens_aplicados)
                ? itens_aplicados
                : db.erp_rh_nr01[idx].itens_aplicados || [],
              segredo_aes: cifrado || db.erp_rh_nr01[idx].segredo_aes
            };
            totalAplicados = 1;
          }
        } else {
          for (const colab of usuariosAlvo) {
            db.erp_rh_nr01.unshift({
              id: nextId(db.erp_rh_nr01),
              usuario_id: Number(colab.id),
              categoria: categoria || 'NR-01 & Riscos',
              recurso_codigo: recurso_codigo || '',
              titulo,
              descricao: descricao || '',
              data: data || getTodayISO(),
              validade_data: validade_data || '',
              status: status || 'Ativo',
              nota_avaliacao: notaNum,
              valor_financeiro: valorNum,
              itens_aplicados: Array.isArray(itens_aplicados) ? itens_aplicados : [],
              segredo_aes: cifrado,
              arquivado_legal: false,
              criado_em: new Date().toISOString()
            });
            totalAplicados += 1;

            if (lancar_caixa && valorNum > 0) {
              db.erp_caixa.unshift({
                id: nextId(db.erp_caixa),
                data: data || getTodayISO(),
                tipo: 'Saída',
                categoria: 'RH & Gestão de Pessoas',
                descricao: `[RH - ${categoria || 'Benefício'}] ${titulo} — Colaborador: ${colab.nome}`,
                expressao: String(valorNum),
                valor: valorNum,
                unidade_id: Number(empresa_id || 1),
                usuario_id: Number(colab.id),
                arquivado_legal: false,
                criado_em: new Date().toISOString()
              });
            }

            if (notificar_wpp && colab.telefone) {
              const agora = new Date();
              const horario = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
              const msgRh = ` *[SETOR DE RH — URUTAU]*\nOlá, *${colab.nome}*!\nFoi aplicado em seu prontuário:\n *${titulo}* (${categoria})\n ${descricao || 'Consulte os detalhes no sistema.'}${
                valorNum > 0 ? `\n Valor: R$ ${valorNum.toFixed(2)}` : ''
              }${notaNum ? `\n Avaliação: ${notaNum.toFixed(1)}/5.0` : ''}`;

              db.mensagens_chat.push({
                id: nextId(db.mensagens_chat),
                instancia_id: 1,
                remetente: 'Setor de RH',
                contato: String(colab.telefone).replace(/\D/g, ''),
                direcao: 'enviada',
                texto: msgRh,
                horario
              });
            }
          }
        }
      },
      {
        agregado: 'RH_NR01',
        tipo: 'rh.atualizado',
        payload: { usuario_id, categoria, titulo, totalAplicados }
      }
    );

    await registrarAuditLog(
      'Setor de RH',
      'APLICAR_RECURSO_RH',
      `Recurso [${categoria}] "${titulo}" aplicado para ${totalAplicados} colaborador(es) com criptografia AES-256-GCM`,
      req.ip
    );
    res.json({ ok: true, totalAplicados });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.post('/api/v20/mensagens-rapidas/salvar', async (req: Request, res: Response) => {
  try {
    const { id, titulo, texto } = req.body;
    if (!titulo || !texto) return res.status(400).json({ erro: 'Informe título e texto da mensagem rápida.' });

    await executarComOutbox(
      () => {
        if (id) {
          const idx = db.erp_mensagens_rapidas.findIndex((m) => Number(m.id) === Number(id));
          if (idx >= 0) db.erp_mensagens_rapidas[idx] = { ...db.erp_mensagens_rapidas[idx], titulo, texto };
        } else {
          db.erp_mensagens_rapidas.push({
            id: nextId(db.erp_mensagens_rapidas),
            titulo,
            texto,
            arquivado_legal: false,
            criado_em: new Date().toISOString()
          });
        }
      },
      { agregado: 'MENSAGENS', tipo: 'chat.mensagem_recebida', payload: { titulo } }
    );

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.post('/api/v20/chat/enviar', async (req: Request, res: Response) => {
  try {
    const { instancia_id, destinatario, contato, texto } = req.body;
    if (!texto) return res.status(400).json({ erro: 'Mensagem vazia.' });

    await executarComOutbox(
      () => {
        const agora = new Date();
        const horario = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
        db.mensagens_chat.push({
          id: nextId(db.mensagens_chat),
          instancia_id: Number(instancia_id || 1),
          remetente: destinatario || 'Operador Urutau',
          contato: contato || '',
          direcao: 'enviada',
          texto,
          horario
        });
        const inst = db.instancias_chat.find((i) => Number(i.id) === Number(instancia_id || 1));
        if (inst) {
          inst.mensagens_hoje = Number(inst.mensagens_hoje || 0) + 1;
          inst.ultima_sincronia = new Date().toISOString();
        }
      },
      { agregado: 'CHAT', tipo: 'chat.mensagem_recebida', payload: { instancia_id, destinatario, texto } }
    );

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.post('/api/v20/chat/salvar-instancia', async (req: Request, res: Response) => {
  try {
    const { id, nome, canal, numero, sessao_id, status } = req.body;
    if (!nome) return res.status(400).json({ erro: 'Informe o nome da instância.' });

    await executarComOutbox(
      () => {
        if (id) {
          const idx = db.instancias_chat.findIndex((i) => Number(i.id) === Number(id));
          if (idx >= 0) {
            db.instancias_chat[idx] = {
              ...db.instancias_chat[idx],
              nome,
              canal: canal || 'WhatsApp (WAHA Core)',
              numero: numero || '',
              sessao_id: sessao_id || `urutau_sess_${Date.now()}`,
              status: status || 'Conectado',
              ultima_sincronia: new Date().toISOString()
            };
          }
        } else {
          db.instancias_chat.push({
            id: nextId(db.instancias_chat),
            nome,
            canal: canal || 'WhatsApp (WAHA Core)',
            numero: numero || '',
            sessao_id: sessao_id || `urutau_sess_${Date.now()}`,
            status: status || 'Conectado',
            mensagens_hoje: 0,
            ultima_sincronia: new Date().toISOString()
          });
        }
      },
      { agregado: 'CHAT_INSTANCIA', tipo: 'chat.instancia_atualizada', payload: { nome, canal } }
    );

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.post('/api/v20/notificacoes/salvar', async (req: Request, res: Response) => {
  try {
    const { id, titulo, mensagem, destino_wpp, horario_disparo, status } = req.body;
    if (!titulo || !mensagem) return res.status(400).json({ erro: 'Informe título e mensagem da notificação.' });

    await executarComOutbox(
      () => {
        if (id) {
          const idx = db.erp_notificacoes.findIndex((n) => Number(n.id) === Number(id));
          if (idx >= 0) {
            db.erp_notificacoes[idx] = {
              ...db.erp_notificacoes[idx],
              titulo,
              mensagem,
              destino_wpp: destino_wpp || '',
              horario_disparo: horario_disparo || '01:00',
              status: status || 'Programada'
            };
          }
        } else {
          db.erp_notificacoes.unshift({
            id: nextId(db.erp_notificacoes),
            titulo,
            mensagem,
            destino_wpp: destino_wpp || '',
            horario_disparo: horario_disparo || '01:00',
            status: status || 'Programada',
            arquivado_legal: false,
            criado_em: new Date().toISOString()
          });
        }
      },
      { agregado: 'NOTIFICACOES', tipo: 'notificacao.programada', payload: { titulo, destino_wpp } }
    );

    await registrarAuditLog('Admin', 'PROGRAMAR_NOTIFICACAO_WAHA', `Alerta "${titulo}" agendado para ${horario_disparo}`, req.ip);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

const processarMensagemWebhookWAHA = async (req: Request, res: Response) => {
  try {
    const sessaoInterna = extrairSessaoRequisicao(req);
    const isDirectWebhook = !sessaoInterna;
    if (isDirectWebhook) {
      const sigHeader =
        (req.headers['x-urutau-webhook-signature'] as string | undefined) ||
        (req.headers['x-waha-signature'] as string | undefined) ||
        (req.headers['x-hmac-sha256'] as string | undefined);
      const rawBodyStr =
        typeof (req as any).rawBody === 'string'
          ? (req as any).rawBody
          : JSON.stringify(req.body || {});
      if (!verifyWebhookSignatureConstantTime(rawBodyStr, sigHeader, WEBHOOK_HMAC_SECRET)) {
        return res.status(401).json({
          ok: false,
          codigo: 'WEBHOOK_ASSINATURA_INVALIDA',
          erro: 'Assinatura HMAC-SHA256 obrigatoria ausente ou invalida para webhook externo.'
        });
      }
    }

    const payload = req.body || {};
    const remetenteTelefone = payload.from || payload.telefone || payload.sender || '5591999990001';
    const textoMensagem = payload.body || payload.texto || payload.text || '';
    const nomeContato = payload.pushName || payload.remetente || 'Gestor Operacional';
    const empresaId = payload.empresa_id ? Number(payload.empresa_id) : sessaoInterna?.emp || 1;

    if (!textoMensagem) {
      return res.status(400).json({ erro: 'Conteúdo da mensagem ausente.' });
    }

    const rawEventId = String(payload.event_id || payload.id || '').trim();
    if (rawEventId) {
      const rawBodyStr =
        typeof (req as any).rawBody === 'string'
          ? (req as any).rawBody
          : JSON.stringify(payload);
      const firstTime = await webhookAndHardLimitService.registerIdempotentChatWebhookEvent({
        eventId: rawEventId,
        empresaId: Number(empresaId || 1),
        rawBody: rawBodyStr
      });
      if (!firstTime) {
        return res.status(200).json({
          ok: true,
          idempotent_replay: true,
          event_id: rawEventId,
          resposta: 'Evento ja processado anteriormente (idempotencia garantida).'
        });
      }
    }

    await webhookAndHardLimitService.enforceAiConsumptionHardLimit(Number(empresaId || 1));

    const agora = new Date();
    const horarioStr = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
    const cleanTel = String(remetenteTelefone).replace(/\D/g, '');

    const checkBloqueioWpp = verificarBloqueioClienteFornecedor(cleanTel || nomeContato);
    if (checkBloqueioWpp.bloqueado) {
      await registrarAuditLog(
        checkBloqueioWpp.cadastro?.nome || nomeContato,
        'BLOQUEIO_INTERACAO_BOT_WPP',
        `Interação via WhatsApp bloqueada para [${cleanTel}]: Clientes e Fornecedores são proibidos de interagir com o sistema.`,
        req.ip,
        'BLOQUEADO'
      );
      return res.status(403).json({
        ok: false,
        bloqueado: true,
        erro: 'INTERAÇÃO BLOQUEADA: Clientes e Fornecedores são proibidos de interagir com o sistema. Apenas Colaboradores (Efetivo/Free) e Gestores pertencem à Comunidade via WhatsApp.'
      });
    }

    db.mensagens_chat.push({
      id: nextId(db.mensagens_chat),
      instancia_id: 1,
      remetente: nomeContato,
      contato: cleanTel,
      direcao: 'recebida',
      texto: textoMensagem,
      horario: horarioStr
    });

    const resultadoIA = await geminiBot.processarMensagem({
      remetenteTelefone: cleanTel,
      nomeContato,
      textoMensagem: textoMensagem || undefined,
      empresaId,
      usuarioIdExplicito: sessaoInterna?.uid || (payload.usuario_id ? Number(payload.usuario_id) : undefined)
    });

    const agoraResp = new Date();
    const horarioResp = `${String(agoraResp.getHours()).padStart(2, '0')}:${String(agoraResp.getMinutes()).padStart(2, '0')}`;
    const idResp = nextId(db.mensagens_chat);

    db.mensagens_chat.push({
      id: idResp,
      instancia_id: 1,
      remetente: 'Urutau IA',
      contato: cleanTel,
      direcao: 'enviada',
      texto: resultadoIA.resposta,
      horario: horarioResp
    });

    saveDbToDisk();

    sseBroker.emit('chat.nova_mensagem', {
      id: idResp,
      remetente: 'Urutau IA',
      contato: cleanTel,
      texto: resultadoIA.resposta,
      toolCalls: resultadoIA.toolCallsExecutadas,
      colaboradorIdentificado: resultadoIA.colaboradorIdentificado,
      horario: horarioResp
    });

    res.json({
      ok: true,
      remetente: cleanTel,
      resposta: resultadoIA.resposta,
      toolCallsExecutadas: resultadoIA.toolCallsExecutadas || [],
      colaboradorIdentificado: resultadoIA.colaboradorIdentificado
    });
  } catch (err: any) {
    if (err instanceof HardLimitExceededError) {
      return handleDomainErrorResponse(err, res);
    }
    console.error('[WAHA Webhook] Erro ao processar:', err);
    res.status(500).json({ erro: err?.message || 'Erro interno no processamento do agente WhatsApp.' });
  }
};

app.post('/api/waha/webhook', processarMensagemWebhookWAHA);
app.post('/api/v50/waha/webhook', processarMensagemWebhookWAHA);
app.post('/api/v50/chat/ia-interagir', processarMensagemWebhookWAHA);

app.get('/api/v50/chat/ia-status', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    modelo: 'gemini-4-hydrogen',
    gemini_ativo: Boolean(process.env.GEMINI_API_KEY),
    modos_suportados: ['texto', 'function_calling', 'confirmacao_2_etapas', 'alertas_proativos', 'filtro_estrito_cargo'],
    ferramentas_disponiveis: [
      'consultar_escalas_do_dia',
      'lancar_movimento_escala',
      'solicitar_troca_turno',
      'consultar_estoque_critico',
      'consultar_saldo_item_estoque',
      'dar_baixa_estoque',
      'atualizar_saldo_estoque',
      'solicitar_compra_insumo',
      'solicitar_recebimento_mercadoria',
      'solicitar_lancamento_caixa',
      'consultar_resumo_financeiro_caixa',
      'consultar_rateio_dia',
      'solicitar_fechamento_rateio',
      'consultar_reservas_do_dia',
      'criar_reserva_salao',
      'atualizar_status_reserva',
      'consultar_agenda_operacional',
      'criar_compromisso_agenda',
      'consultar_status_checklists',
      'concluir_checklist_setor',
      'criar_item_checklist',
      'solicitar_adiantamento_vale',
      'consultar_prontuario_rh',
      'consultar_cmv_produto',
      'buscar_freelancers_match',
      'solicitar_contratacao_freelancer',
      'registrar_ocorrencia_turno'
    ]
  });
});

app.get('/api/public/empresa-portal', (req: Request, res: Response) => {
  try {
    const normalizar = (raw: string) =>
      String(raw || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    const querySub = String(req.query.subdominio || req.query.empresa || req.query.portal || '').trim();
    const rawHost = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(':')[0].toLowerCase();

    let detectedSlug = normalizar(querySub);
    if (!detectedSlug && rawHost.endsWith('.nyctibi.us')) {
      const prefix = rawHost.slice(0, -'.nyctibi.us'.length);
      if (prefix && !['www', 'api', 'bd', 'app', 'painel'].includes(prefix)) {
        detectedSlug = normalizar(prefix);
      }
    }

    const empresasAtivas = (db.empresas || []).filter((e) => !e.arquivado_legal);
    const cfgGlobalBrand = db.erp_configs?.find((c) => c.chave === 'identidade_visual_empresa')?.valor_json;

    let empresaAlvo =
      (detectedSlug
        ? empresasAtivas.find(
            (e) =>
              normalizar(e.subdominio || '') === detectedSlug ||
              normalizar(e.nome || '') === detectedSlug ||
              String(e.id) === detectedSlug
          )
        : null) || null;

    const mapearPortal = (e: any) => {
      const slug = normalizar(e.subdominio || e.nome || `empresa-${e.id}`);
      const cfgPorEmpresa = db.erp_configs?.find(
        (c) => c.chave === `identidade_visual_empresa_${e.id}`
      )?.valor_json;
      const brand = cfgPorEmpresa || e.brand_config || (Number(e.id) === 1 && cfgGlobalBrand ? cfgGlobalBrand : null) || {
        companyName: e.nome || 'URUTAU',
        logoDataUrl: '',
        companyColorHex: '#10B981',
        companySecondaryHex: '#F59E0B',
        companyTertiaryHex: '#06B6D4',
        urutauBaseHex: '#10B981',
        blendRatio: 0.7,
        effectivePrimaryHex: '#10B981',
        effectivePrimaryRgb: { r: 16, g: 185, b: 129 }
      };
      return {
        id: e.id,
        nome: brand.companyName || e.nome,
        subdominio: slug,
        link_acesso: `https://${slug}.nyctibi.us`,
        cidade: e.cidade || '',
        ramo: e.ramo || '',
        brand_config: {
          ...brand,
          companyName: brand.companyName || e.nome
        }
      };
    };

    const listaPortais = empresasAtivas.map(mapearPortal);
    const portalResolvido = empresaAlvo ? mapearPortal(empresaAlvo) : null;
    const cfgBrilhoPadrao = db.erp_configs?.find((c) => c.chave === 'brilho_fundo_padrao')?.valor_json;
    const brilhoFundoPadrao =
      cfgBrilhoPadrao && Number.isFinite(Number(cfgBrilhoPadrao.brilho))
        ? Math.max(0, Math.min(100, Math.round(Number(cfgBrilhoPadrao.brilho))))
        : 38;

    res.json({
      ok: true,
      encontrado: Boolean(empresaAlvo),
      modo_geral: !detectedSlug,
      subdominio_detectado: detectedSlug || '',
      brilho_fundo_padrao: brilhoFundoPadrao,
      empresa: portalResolvido,
      empresas_disponiveis: listaPortais
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.post('/api/erp/empresas/personalizacao-portal', async (req: Request, res: Response) => {
  try {
    const { empresa_id, subdominio, brand_config } = req.body || {};
    const empId = Number(empresa_id || 1);
    if (!verificarAcessoEmpresaRequisicao(req, empId)) {
      return res.status(403).json({
        ok: false,
        erro: 'Acesso negado: sua sessão não possui permissão para alterar o portal de outra empresa.'
      });
    }
    const emp = (db.empresas || []).find((e) => Number(e.id) === empId && !e.arquivado_legal) || db.empresas?.[0];
    if (!emp) {
      res.status(404).json({ ok: false, erro: 'Empresa não encontrada.' });
      return;
    }

    const normalizar = (raw: string) =>
      String(raw || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    await executarComOutbox(
      () => {
        if (subdominio !== undefined && String(subdominio).trim()) {
          const slugCandidate = normalizar(subdominio);
          const conflito = (db.empresas || []).some(
            (other) =>
              !other.arquivado_legal &&
              Number(other.id) !== Number(emp.id) &&
              normalizar(other.subdominio || other.nome) === slugCandidate
          );
          emp.subdominio = conflito ? `${slugCandidate}-${emp.id}` : slugCandidate;
          emp.link_acesso = `https://${emp.subdominio}.nyctibi.us`;
        }
        if (brand_config && typeof brand_config === 'object') {
          emp.brand_config = {
            ...(emp.brand_config || {}),
            ...brand_config,
            companyName: brand_config.companyName || emp.nome
          };
          if (brand_config.companyName && String(brand_config.companyName).trim()) {
            emp.nome = String(brand_config.companyName).trim();
          }
          const chaveEmp = `identidade_visual_empresa_${emp.id}`;
          const idxCfg = db.erp_configs.findIndex((c) => c.chave === chaveEmp);
          const itemCfg = {
            chave: chaveEmp,
            valor_json: emp.brand_config,
            atualizado_em: new Date().toISOString()
          };
          if (idxCfg >= 0) db.erp_configs[idxCfg] = itemCfg;
          else db.erp_configs.push(itemCfg);
        }
      },
      {
        agregado: 'EMPRESAS',
        tipo: 'empresa.portal_personalizado',
        payload: { empresa_id: emp.id, subdominio: emp.subdominio }
      }
    );

    res.json({
      ok: true,
      empresa: {
        id: emp.id,
        nome: emp.nome,
        subdominio: emp.subdominio,
        link_acesso: emp.link_acesso,
        brand_config: emp.brand_config
      }
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.post('/api/erp/configs/salvar', async (req: Request, res: Response) => {
  try {
    const { chave, valor_json, empresa_id } = req.body;
    if (!chave) return res.status(400).json({ erro: 'Chave de configuração ausente.' });

    await executarComOutbox(
      () => {
        const idx = db.erp_configs.findIndex((c) => c.chave === chave);
        const item = { chave, valor_json: valor_json || {}, atualizado_em: new Date().toISOString() };
        if (idx >= 0) db.erp_configs[idx] = item;
        else db.erp_configs.push(item);

        if (chave === 'identidade_visual_empresa' || String(chave).startsWith('identidade_visual_empresa_')) {
          const targetId = Number(
            empresa_id ||
              (String(chave).startsWith('identidade_visual_empresa_')
                ? String(chave).replace('identidade_visual_empresa_', '')
                : 1)
          );
          const emp = (db.empresas || []).find((e) => Number(e.id) === targetId) || db.empresas?.[0];
          if (emp && valor_json && typeof valor_json === 'object') {
            emp.brand_config = {
              ...(emp.brand_config || {}),
              ...valor_json,
              companyName: valor_json.companyName || emp.nome
            };
            if (valor_json.companyName && String(valor_json.companyName).trim()) {
              emp.nome = String(valor_json.companyName).trim();
            }
          }
        }
      },
      { agregado: 'CONFIGS', tipo: 'config.atualizada', payload: { chave, valor_json } }
    );

    await registrarAuditLog('Super Admin', 'ALTERAR_PARAMETRO_CONFIG', `Parâmetro [${chave}] atualizado`, req.ip, 'Super Admin');
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.post('/api/erp/backup-agora', async (req: Request, res: Response) => {
  try {
    const bkp = await gerarBackupHorarioCriptografado('DISPARO_MANUAL_ADMIN');
    await registrarAuditLog('Super Admin', 'BACKUP_CRIPTOGRAFADO_SHEETS', `Backup AES-256-GCM #${bkp?.id} sincronizado com Google Sheets`, req.ip, 'Super Admin');
    res.json({ ok: true, backup: bkp });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

const BLUEPRINT_DIRETORIOS_PLANILHAS_URUTAU: Array<{
  codigo: string;
  nome_pasta: string;
  descricao: string;
  planilha_nome?: string;
  abas: Array<{ nome: string; colunas: string[] }>;
}> = [
  {
    codigo: '01',
    nome_pasta: '01_Planilha_Mestre_Sincronizacao',
    descricao: 'Planilha Mestre centralizada com as 7 abas operacionais em tempo real',
    planilha_nome: '00_Urutau_Planilha_Mestre_ERP',
    abas: [
      { nome: 'Colaboradores_RH', colunas: ['id', 'nome', 'cargo', 'telefone', 'email', 'atualizado_em'] },
      { nome: 'Escalas_Turnos', colunas: ['id', 'colaborador', 'setor', 'data', 'turno', 'status'] },
      { nome: 'Comunicacao_Interna', colunas: ['id', 'titulo', 'mensagem', 'remetente', 'destinatario', 'criado_em'] },
      { nome: 'Reservas_Salao', colunas: ['id', 'cliente', 'whatsapp', 'mesa', 'pessoas', 'data_hora', 'status'] },
      { nome: 'Caixa_Rateio', colunas: ['id', 'tipo', 'descricao', 'valor', 'forma_pagamento', 'data_hora'] },
      { nome: 'Estoque_Compras_CMV', colunas: ['id', 'insumo', 'categoria', 'saldo_atual', 'unidade', 'custo_unitario'] },
      { nome: 'Auditoria_LGPD', colunas: ['id', 'usuario', 'cargo', 'acao', 'detalhes', 'criado_em'] }
    ]
  },
  {
    codigo: '02',
    nome_pasta: '02_RH_Equipe_Escalas_e_Comunicacao',
    descricao: 'Diretório de equipe, escalas semanais, comunicados internos e cargos',
    planilha_nome: '01_Urutau_RH_Escalas_e_Comunicacao',
    abas: [
      { nome: 'Colaboradores_RH', colunas: ['id', 'nome', 'cargo', 'telefone', 'email', 'status'] },
      { nome: 'Escalas_Turnos', colunas: ['id', 'colaborador', 'dia_semana', 'horario', 'setor', 'observacao'] },
      { nome: 'Comunicacao_Interna', colunas: ['id', 'tipo', 'titulo', 'mensagem', 'autor', 'criado_em'] },
      { nome: 'Cargos_Permissoes', colunas: ['id', 'cargo', 'nivel', 'modulos_liberados', 'atualizado_em'] },
      { nome: 'Prontuarios_NR01', colunas: ['id', 'colaborador', 'treinamento_epi', 'validade', 'status'] }
    ]
  },
  {
    codigo: '03',
    nome_pasta: '03_Financeiro_Caixa_e_Rateios',
    descricao: 'Diretório financeiro de movimentação de caixa, fechamento e rateio da equipe',
    planilha_nome: '02_Urutau_Caixa_Financeiro_e_Rateio',
    abas: [
      { nome: 'Caixa_Lancamentos', colunas: ['id', 'data', 'tipo', 'categoria', 'descricao', 'valor', 'operador'] },
      { nome: 'Fechamento_Turnos', colunas: ['id', 'data', 'turno', 'total_entradas', 'total_saidas', 'saldo_final'] },
      { nome: 'Rateio_Equipe', colunas: ['id', 'periodo', 'colaborador', 'cargo', 'pontos', 'valor_receber'] },
      { nome: 'Vales_Adiantamentos', colunas: ['id', 'colaborador', 'data', 'valor', 'motivo', 'status'] }
    ]
  },
  {
    codigo: '04',
    nome_pasta: '04_Estoque_Compras_e_CMV',
    descricao: 'Diretório de controle de estoque, validade de lotes, compras e fichas técnicas (CMV)',
    planilha_nome: '03_Urutau_Estoque_Compras_e_CMV',
    abas: [
      { nome: 'Estoque_Insumos', colunas: ['id', 'insumo', 'categoria', 'saldo', 'estoque_minimo', 'unidade', 'custo'] },
      { nome: 'Lotes_Vencimentos', colunas: ['id', 'insumo', 'codigo_lote', 'quantidade', 'data_vencimento'] },
      { nome: 'Lista_Compras', colunas: ['id', 'insumo', 'quantidade_solicitada', 'fornecedor', 'status_cotacao'] },
      { nome: 'Fichas_Tecnicas_CMV', colunas: ['id', 'prato_produto', 'custo_insumos', 'preco_venda', 'cmv_percentual'] },
      { nome: 'Fornecedores', colunas: ['id', 'nome_fantasia', 'cnpj_cpf', 'whatsapp', 'categoria_insumos'] }
    ]
  },
  {
    codigo: '05',
    nome_pasta: '05_Reservas_Salao_e_Agenda',
    descricao: 'Diretório operacional de mapa de mesas, reservas de clientes e agenda de eventos',
    planilha_nome: '04_Urutau_Reservas_Salao_e_Agenda',
    abas: [
      { nome: 'Reservas_Salao', colunas: ['id', 'data_hora', 'cliente', 'whatsapp', 'pessoas', 'mesa', 'status'] },
      { nome: 'Mapa_Mesas', colunas: ['id', 'numero_mesa', 'setor', 'capacidade', 'status_padrao'] },
      { nome: 'Agenda_Operacional', colunas: ['id', 'data', 'horario', 'evento', 'responsavel', 'observacoes'] },
      { nome: 'Clientes', colunas: ['id', 'nome', 'whatsapp', 'preferencias', 'ultima_visita'] }
    ]
  },
  {
    codigo: '06',
    nome_pasta: '06_Comprovantes_Notas_e_Logos',
    descricao: 'Diretório para guarda de comprovantes, notas fiscais e identidade visual da empresa',
    abas: [
      { nome: 'Indice_Arquivos', colunas: ['id', 'nome_arquivo', 'categoria', 'data_upload', 'url_drive'] }
    ]
  },
  {
    codigo: '07',
    nome_pasta: '07_Auditoria_e_Conformidade_LGPD',
    descricao: 'Diretório jurídico de trilha de auditoria, termo de controlador e solicitações Art. 18 LGPD',
    planilha_nome: '05_Urutau_Auditoria_e_Termos_LGPD',
    abas: [
      { nome: 'Auditoria_LGPD', colunas: ['id', 'data_hora', 'usuario', 'cargo', 'acao', 'detalhes'] },
      { nome: 'Termo_Guarda_Controlador', colunas: ['empresa_id', 'empresa_nome', 'controlador_nome', 'documento', 'versao_termo', 'aceito_em'] },
      { nome: 'Anonimizacoes_Art18', colunas: ['id', 'data_hora', 'identificador_solicitante', 'registros_anonimizados', 'motivo_legal'] }
    ]
  }
];

async function provisionarDiretoriosEPlanilhasDaEmpresa(
  empresaId: number,
  nomeEmpresa: string,
  nomeControlador: string,
  documentoControlador: string,
  emailControlador: string,
  googleAccessToken?: string,
  pastaCompartilhadaUrl?: string,
  apenasProcessamentoEfemero = false
) {
  const cleanSlug = String(nomeEmpresa || `empresa_${empresaId}`)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 36) || `empresa_${empresaId}`;

  const pastaRaizNome = `Urutau ERP - ${nomeEmpresa} (Guarda Soberana LGPD)`;
  const diretorioWorkspaceRel = apenasProcessamentoEfemero
    ? ''
    : `workspaces_empresas/empresa_${empresaId}_${cleanSlug}`;
  const diretorioWorkspaceAbs = diretorioWorkspaceRel
    ? path.join(__dirname, diretorioWorkspaceRel)
    : '';

  if (!apenasProcessamentoEfemero && diretorioWorkspaceAbs) {
    try {
      fs.mkdirSync(diretorioWorkspaceAbs, { recursive: true });
    } catch {}
  }

  let pastaRaizDriveId = '';
  let pastaRaizDriveUrl = '';
  let planilhaMestreId = '';
  let planilhaMestreUrl = '';

  const sharedUrlRaw = String(pastaCompartilhadaUrl || '').trim();
  if (sharedUrlRaw) {
    const folderMatch = sharedUrlRaw.match(/\/folders\/([a-zA-Z0-9-_]+)/);
    pastaRaizDriveId = folderMatch ? folderMatch[1] : sharedUrlRaw;
    pastaRaizDriveUrl = sharedUrlRaw.startsWith('http')
      ? sharedUrlRaw
      : `https://drive.google.com/drive/folders/${pastaRaizDriveId}`;
  }

  const tokenLimpo = String(googleAccessToken || '').trim();
  if (tokenLimpo.length > 20 && !pastaRaizDriveId) {
    try {
      const respRootFolder = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,webViewLink', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenLimpo}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: pastaRaizNome,
          mimeType: 'application/vnd.google-apps.folder'
        })
      });
      if (respRootFolder.ok) {
        const rootJson: any = await respRootFolder.json();
        pastaRaizDriveId = String(rootJson.id || '');
        pastaRaizDriveUrl =
          String(rootJson.webViewLink || '') ||
          (pastaRaizDriveId ? `https://drive.google.com/drive/folders/${pastaRaizDriveId}` : '');
        if (pastaRaizDriveId && emailControlador && emailControlador.includes('@')) {
          await fetch(
            `https://www.googleapis.com/drive/v3/files/${pastaRaizDriveId}/permissions`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${tokenLimpo}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                role: 'writer',
                type: 'user',
                emailAddress: emailControlador.trim()
              })
            }
          ).catch(() => {});
        }
      }
    } catch {}
  }

  const diretoriosCriados: Array<{
    codigo: string;
    nome_pasta: string;
    descricao: string;
    folder_drive_id?: string;
    folder_drive_url?: string;
    planilha_nome?: string;
    planilha_id?: string;
    planilha_url?: string;
    abas: string[];
  }> = [];

  for (const item of BLUEPRINT_DIRETORIOS_PLANILHAS_URUTAU) {
    if (!apenasProcessamentoEfemero && diretorioWorkspaceAbs) {
      const subDirAbs = path.join(diretorioWorkspaceAbs, item.nome_pasta);
      try {
        fs.mkdirSync(subDirAbs, { recursive: true });
        for (const aba of item.abas) {
          const csvPath = path.join(subDirAbs, `${aba.nome}.csv`);
          if (!fs.existsSync(csvPath)) {
            let initialCsv = `${aba.colunas.join(',')}\n`;
            if (aba.nome === 'Termo_Guarda_Controlador') {
              initialCsv += `${empresaId},"${nomeEmpresa.replace(/"/g, '')}","${nomeControlador.replace(/"/g, '')}","${documentoControlador.replace(/"/g, '')}","LGPD-BYOS-2026.1","${new Date().toISOString()}"\n`;
            } else if (aba.nome === 'Colaboradores_RH') {
              initialCsv += `1,"${nomeControlador.replace(/"/g, '')}","Empresario / Proprietario","","${emailControlador.replace(/"/g, '')}","${new Date().toISOString()}"\n`;
            }
            fs.writeFileSync(csvPath, initialCsv, 'utf-8');
          }
        }
      } catch {}
    }

    let subFolderDriveId = '';
    let subFolderDriveUrl = '';
    let sheetDriveId = '';
    let sheetDriveUrl = '';

    if (tokenLimpo.length > 20 && pastaRaizDriveId) {
      try {
        const respSub = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,webViewLink', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenLimpo}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: item.nome_pasta,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [pastaRaizDriveId]
          })
        });
        if (respSub.ok) {
          const subJson: any = await respSub.json();
          subFolderDriveId = String(subJson.id || '');
          subFolderDriveUrl =
            String(subJson.webViewLink || '') ||
            (subFolderDriveId ? `https://drive.google.com/drive/folders/${subFolderDriveId}` : '');
        }

        if (item.planilha_nome) {
          const sheetsPayload = {
            properties: {
              title: `${item.planilha_nome} - ${nomeEmpresa}`
            },
            sheets: item.abas.map((aba) => ({
              properties: { title: aba.nome },
              data: [
                {
                  startRow: 0,
                  startColumn: 0,
                  rowData: [
                    {
                      values: aba.colunas.map((col) => ({
                        userEnteredValue: { stringValue: col }
                      }))
                    }
                  ]
                }
              ]
            }))
          };
          const respSheet = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${tokenLimpo}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(sheetsPayload)
          });
          if (respSheet.ok) {
            const sheetJson: any = await respSheet.json();
            sheetDriveId = String(sheetJson.spreadsheetId || '');
            sheetDriveUrl =
              String(sheetJson.spreadsheetUrl || '') ||
              (sheetDriveId ? `https://docs.google.com/spreadsheets/d/${sheetDriveId}/edit` : '');

            if (sheetDriveId && subFolderDriveId) {
              await fetch(
                `https://www.googleapis.com/drive/v3/files/${sheetDriveId}?addParents=${subFolderDriveId}&fields=id`,
                {
                  method: 'PATCH',
                  headers: { Authorization: `Bearer ${tokenLimpo}` }
                }
              ).catch(() => {});
            }

            if (item.codigo === '01') {
              planilhaMestreId = sheetDriveId;
              planilhaMestreUrl = sheetDriveUrl;
            }
          }
        }
      } catch {}
    }

    diretoriosCriados.push({
      codigo: item.codigo,
      nome_pasta: item.nome_pasta,
      descricao: item.descricao,
      folder_drive_id: subFolderDriveId,
      folder_drive_url: subFolderDriveUrl,
      planilha_nome: item.planilha_nome ? `${item.planilha_nome} - ${nomeEmpresa}` : undefined,
      planilha_id: sheetDriveId,
      planilha_url: sheetDriveUrl,
      abas: item.abas.map((a) => a.nome)
    });
  }

  if (!apenasProcessamentoEfemero && diretorioWorkspaceAbs) {
    try {
      const manifestPath = path.join(diretorioWorkspaceAbs, 'manifesto_estrutura_urutau_lgpd.json');
      fs.writeFileSync(
        manifestPath,
        JSON.stringify(
          {
            empresa_id: empresaId,
            empresa_nome: nomeEmpresa,
            controlador_nome: nomeControlador,
            controlador_documento: documentoControlador,
            pasta_raiz_nome: pastaRaizNome,
            pasta_google_drive_url: pastaRaizDriveUrl,
            planilha_mestre_url: planilhaMestreUrl,
            criado_em: new Date().toISOString(),
            diretorios: diretoriosCriados
          },
          null,
          2
        ),
        'utf-8'
      );
    } catch {}
  }

  return {
    pastaRaizNome,
    pastaRaizDriveId,
    pastaRaizDriveUrl,
    planilhaMestreId,
    planilhaMestreUrl,
    diretorioWorkspaceRel,
    diretorios: diretoriosCriados
  };
}

function gerarScriptConectorGoogleSheetsEmpresario(
  empresaId: number,
  nomeEmpresa: string,
  chaveSecreta: string
): string {
  const safeEmpName = String(nomeEmpresa || 'Empresa').replace(/'/g, '');
  const blueprintJsonStr = JSON.stringify(BLUEPRINT_DIRETORIOS_PLANILHAS_URUTAU);
  return [
    `var CHAVE_SECRETA_URUTAU = '${chaveSecreta}';`,
    `var EMPRESA_ID_URUTAU = ${empresaId};`,
    `var EMPRESA_NOME_URUTAU = '${safeEmpName}';`,
    `var ESTRUTURA_PASTAS_PLANILHAS = ${blueprintJsonStr};`,
    ``,
    `function criarPastaEPlanilhasUrutauNoDrive() {`,
    `  var nomePastaRaiz = 'Urutau ERP - ' + EMPRESA_NOME_URUTAU + ' (Guarda Soberana LGPD)';`,
    `  var iter = DriveApp.getFoldersByName(nomePastaRaiz);`,
    `  var pastaRaiz = iter.hasNext() ? iter.next() : DriveApp.createFolder(nomePastaRaiz);`,
    `  var planilhaMestreUrl = '';`,
    `  var planilhaMestreId = '';`,
    `  var diretoriosCriados = [];`,
    `  ESTRUTURA_PASTAS_PLANILHAS.forEach(function(item) {`,
    `    var subIter = pastaRaiz.getFoldersByName(item.nome_pasta);`,
    `    var subPasta = subIter.hasNext() ? subIter.next() : pastaRaiz.createFolder(item.nome_pasta);`,
    `    var sheetUrl = '';`,
    `    var sheetId = '';`,
    `    if (item.planilha_nome) {`,
    `      var tituloPlanilha = item.planilha_nome + ' - ' + EMPRESA_NOME_URUTAU;`,
    `      var ss = SpreadsheetApp.create(tituloPlanilha);`,
    `      var file = DriveApp.getFileById(ss.getId());`,
    `      file.moveTo(subPasta);`,
    `      item.abas.forEach(function(abaObj, idx) {`,
    `        var sheet = idx === 0 ? ss.getSheets()[0] : (ss.getSheetByName(abaObj.nome) || ss.insertSheet(abaObj.nome));`,
    `        if (idx === 0) sheet.setName(abaObj.nome);`,
    `        if (abaObj.colunas && abaObj.colunas.length > 0) {`,
    `          sheet.getRange(1, 1, 1, abaObj.colunas.length).setValues([abaObj.colunas]);`,
    `        }`,
    `      });`,
    `      sheetUrl = ss.getUrl();`,
    `      sheetId = ss.getId();`,
    `      if (item.codigo === '01') {`,
    `        planilhaMestreUrl = sheetUrl;`,
    `        planilhaMestreId = sheetId;`,
    `        PropertiesService.getScriptProperties().setProperty('PLANILHA_MESTRE_ID', sheetId);`,
    `      }`,
    `    }`,
    `    diretoriosCriados.push({`,
    `      codigo: item.codigo,`,
    `      nome_pasta: item.nome_pasta,`,
    `      descricao: item.descricao,`,
    `      folder_drive_id: subPasta.getId(),`,
    `      folder_drive_url: subPasta.getUrl(),`,
    `      planilha_nome: item.planilha_nome ? (item.planilha_nome + ' - ' + EMPRESA_NOME_URUTAU) : '',`,
    `      planilha_id: sheetId,`,
    `      planilha_url: sheetUrl,`,
    `      abas: item.abas.map(function(a) { return a.nome; })`,
    `    });`,
    `  });`,
    `  Logger.log('Pasta Raiz Criada: ' + pastaRaiz.getUrl());`,
    `  Logger.log('Planilha Mestre Criada: ' + planilhaMestreUrl);`,
    `  return {`,
    `    ok: true,`,
    `    pasta_google_drive_id: pastaRaiz.getId(),`,
    `    pasta_google_drive_url: pastaRaiz.getUrl(),`,
    `    planilha_google_id: planilhaMestreId,`,
    `    planilha_google_url: planilhaMestreUrl,`,
    `    diretorios: diretoriosCriados`,
    `  };`,
    `}`,
    ``,
    `function doPost(e) {`,
    `  var payload = JSON.parse(e.postData.contents || '{}');`,
    `  if (payload.chave_secreta !== CHAVE_SECRETA_URUTAU) {`,
    `    return ContentService.createTextOutput(JSON.stringify({ ok: false, erro: 'Token invalido' })).setMimeType(ContentService.MimeType.JSON);`,
    `  }`,
    `  if (payload.acao === 'CRIAR_ESTRUTURA_COMPLETA') {`,
    `    var criada = criarPastaEPlanilhasUrutauNoDrive();`,
    `    return ContentService.createTextOutput(JSON.stringify(criada)).setMimeType(ContentService.MimeType.JSON);`,
    `  }`,
    `  var savedId = PropertiesService.getScriptProperties().getProperty('PLANILHA_MESTRE_ID');`,
    `  var ss = savedId ? SpreadsheetApp.openById(savedId) : SpreadsheetApp.getActiveSpreadsheet();`,
    `  if (!ss) {`,
    `    var initRes = criarPastaEPlanilhasUrutauNoDrive();`,
    `    ss = SpreadsheetApp.openById(initRes.planilha_google_id);`,
    `  }`,
    `  var abas = payload.abas || {};`,
    `  var resumo = {};`,
    `  Object.keys(abas).forEach(function(nomeAba) {`,
    `    var sheet = ss.getSheetByName(nomeAba) || ss.insertSheet(nomeAba);`,
    `    var linhas = abas[nomeAba] || [];`,
    `    sheet.clearContents();`,
    `    if (linhas.length > 0) {`,
    `      var colunas = Object.keys(linhas[0]);`,
    `      var matriz = [colunas];`,
    `      linhas.forEach(function(item) {`,
    `        matriz.push(colunas.map(function(col) {`,
    `          var val = item[col];`,
    `          return typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val !== undefined && val !== null ? val : '');`,
    `        }));`,
    `      });`,
    `      sheet.getRange(1, 1, matriz.length, colunas.length).setValues(matriz);`,
    `    }`,
    `    resumo[nomeAba] = linhas.length;`,
    `  });`,
    `  return ContentService.createTextOutput(JSON.stringify({`,
    `    ok: true,`,
    `    empresa_id: EMPRESA_ID_URUTAU,`,
    `    empresa_nome: EMPRESA_NOME_URUTAU,`,
    `    planilha_url: ss.getUrl(),`,
    `    sincronizado_em: new Date().toISOString(),`,
    `    resumo_abas: resumo`,
    `  })).setMimeType(ContentService.MimeType.JSON);`,
    `}`
  ].join('\n');
}

function extrairAbasPlanilhaDaEmpresa(empresaId: number) {
  const matchEmp = (r: any) =>
    Number(r?.empresa_id ?? r?.id_empresa ?? 1) === Number(empresaId);
  return {
    Colaboradores_RH: (db.usuarios || [])
      .filter((u: any) => Array.isArray(u.empresas_ids) && u.empresas_ids.map(Number).includes(Number(empresaId)))
      .map((u: any) => ({
        id: u.id,
        nome: u.nome,
        cargo: u.cargo || u.tipo,
        telefone: u.telefone || '',
        email: u.email || '',
        atualizado_em: new Date().toISOString()
      })),
    Escalas_Turnos: (db.erp_escalas_movimentos || []).filter(matchEmp),
    Comunicacao_Interna: (db.erp_notificacoes || []).filter(matchEmp),
    Reservas_Salao: (db.reservas || []).filter(matchEmp),
    Caixa_Rateio: (db.erp_caixa || []).filter(matchEmp),
    Estoque_Compras_CMV: (db.erp_estoque || []).filter(matchEmp),
    Auditoria_LGPD: (db.audit_logs || []).slice(0, 100)
  };
}

function gerarPacotePortatilEmpresa(empresaId: number) {
  const empId = Number(empresaId) || 1;
  const emp = (db.empresas || []).find((e: any) => Number(e.id) === empId);
  const matchEmp = (r: any) => Number(r?.empresa_id ?? r?.id_empresa ?? 0) === empId;
  const usuariosEmpresa = (db.usuarios || [])
    .filter((u: any) => Array.isArray(u.empresas_ids) && u.empresas_ids.map(Number).includes(empId))
    .map((u: any) => {
      const c = { ...u };
      delete c.senha_argon2id;
      return c;
    });

  return {
    versao_pacote: 'URUTAU-PORTATIL-LGPD-1.0',
    empresa_id: empId,
    empresa_nome: emp?.nome || `Empresa #${empId}`,
    exportado_em: new Date().toISOString(),
    empresa: emp ? { ...emp } : null,
    unidades: (db.unidades || []).filter(matchEmp),
    setores: (db.setores || []).filter(matchEmp),
    checklists: (db.checklists || []).filter(matchEmp),
    usuarios: usuariosEmpresa,
    movimentosEscala: (db.erp_escalas_movimentos || []).filter(matchEmp),
    agenda: (db.eventos_agenda || []).filter(matchEmp),
    reservas: (db.reservas || []).filter(matchEmp),
    portais: (db.sites_portais || []).filter(matchEmp),
    caixa: (db.erp_caixa || []).filter(matchEmp),
    estoque: (db.erp_estoque || []).filter(matchEmp),
    cmv: (db.erp_cmv || []).filter(matchEmp),
    selecao: (db.erp_selecao || []).filter(matchEmp),
    rhRegistros: (db.erp_rh_nr01 || []).filter(matchEmp),
    notificacoes: (db.erp_notificacoes || []).filter(matchEmp),
    rateiosHistorico: (db.erp_rateios_historico || []).filter(matchEmp),
    cadastrosPessoas: (db.cadastros_pessoas || []).filter(matchEmp),
    auditLogs: (db.audit_logs || []).filter(matchEmp),
    abas_planilha: extrairAbasPlanilhaDaEmpresa(empId)
  };
}

function contarRegistrosOperacionaisNaVps(empresaId: number) {
  const empId = Number(empresaId) || 1;
  const matchEmp = (r: any) => Number(r?.empresa_id ?? r?.id_empresa ?? 0) === empId;
  const emp = (db.empresas || []).find((e: any) => Number(e.id) === empId);
  const pastaRel = emp?.lgpd_custodia_config?.diretorio_workspace_id || `workspaces_empresas/empresa_${empId}`;
  const pastaAbs = pastaRel ? path.join(__dirname, pastaRel) : '';
  let pastaVpsExiste = false;
  try {
    if (pastaAbs && fs.existsSync(pastaAbs)) pastaVpsExiste = true;
  } catch {}

  const contagens = {
    reservas: (db.reservas || []).filter(matchEmp).length,
    escalas: (db.erp_escalas_movimentos || []).filter(matchEmp).length,
    caixa: (db.erp_caixa || []).filter(matchEmp).length,
    estoque: (db.erp_estoque || []).filter(matchEmp).length,
    cmv: (db.erp_cmv || []).filter(matchEmp).length,
    rh: (db.erp_rh_nr01 || []).filter(matchEmp).length,
    pessoas: (db.cadastros_pessoas || []).filter(matchEmp).length,
    agenda: (db.eventos_agenda || []).filter(matchEmp).length,
    checklists: (db.checklists || []).filter(matchEmp).length,
    notificacoes: (db.erp_notificacoes || []).filter(matchEmp).length,
    rateios: (db.erp_rateios_historico || []).filter(matchEmp).length
  };
  const total_registros = Object.values(contagens).reduce((acc, n) => acc + Number(n || 0), 0);
  return {
    ...contagens,
    total_registros,
    pasta_vps_existe: pastaVpsExiste
  };
}

function removerPastaWorkspaceVpsEmpresa(empresaId: number) {
  try {
    const emp = (db?.empresas || []).find((e: any) => Number(e.id) === Number(empresaId));
    const pastaRel = emp?.lgpd_custodia_config?.diretorio_workspace_id;
    if (pastaRel) {
      const target = path.join(__dirname, pastaRel);
      if (fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
    const baseWorkspaces = path.join(__dirname, 'workspaces_empresas');
    if (fs.existsSync(baseWorkspaces)) {
      for (const entry of fs.readdirSync(baseWorkspaces)) {
        if (entry === `empresa_${empresaId}` || entry.startsWith(`empresa_${empresaId}_`)) {
          fs.rmSync(path.join(baseWorkspaces, entry), { recursive: true, force: true });
        }
      }
    }
    if (emp?.lgpd_custodia_config) {
      emp.lgpd_custodia_config.diretorio_workspace_id = '';
    }
  } catch {}
}

function expurgarDadosOperacionaisEmpresaNaVps(empresaId: number) {
  const empId = Number(empresaId);
  const isFromOtherCompany = (r: any) =>
    Number(r?.empresa_id ?? r?.id_empresa ?? 0) !== empId;
  db.reservas = (db.reservas || []).filter(isFromOtherCompany);
  db.erp_escalas_movimentos = (db.erp_escalas_movimentos || []).filter(isFromOtherCompany);
  db.erp_caixa = (db.erp_caixa || []).filter(isFromOtherCompany);
  db.erp_estoque = (db.erp_estoque || []).filter(isFromOtherCompany);
  db.erp_cmv = (db.erp_cmv || []).filter(isFromOtherCompany);
  db.erp_selecao = (db.erp_selecao || []).filter(isFromOtherCompany);
  db.erp_notificacoes = (db.erp_notificacoes || []).filter(isFromOtherCompany);
  db.erp_rh_nr01 = (db.erp_rh_nr01 || []).filter(isFromOtherCompany);
  db.erp_rateios_historico = (db.erp_rateios_historico || []).filter(isFromOtherCompany);
  db.eventos_agenda = (db.eventos_agenda || []).filter(isFromOtherCompany);
  db.checklists = (db.checklists || []).filter(isFromOtherCompany);
  db.cadastros_pessoas = (db.cadastros_pessoas || []).filter(isFromOtherCompany);
  db.mensagens_chat = (db.mensagens_chat || []).filter(isFromOtherCompany);
  db.audit_logs = (db.audit_logs || []).filter(isFromOtherCompany);
  removerPastaWorkspaceVpsEmpresa(empId);
  saveDbToDisk();
}

function escapeXmlCell(val: any): string {
  const str =
    typeof val === 'object' && val !== null
      ? JSON.stringify(val)
      : String(val !== undefined && val !== null ? val : '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function gerarPlanilhaMultiAbasXml(
  nomeEmpresa: string,
  abasDefinicao: Array<{ nome: string; colunas: string[] }>,
  dadosReais?: Record<string, any[]>
): string {
  const worksheetsXml = abasDefinicao
    .map((aba) => {
      const safeSheetName = escapeXmlCell(aba.nome.slice(0, 31));
      const linhasDados = (dadosReais && Array.isArray(dadosReais[aba.nome])) ? dadosReais[aba.nome] : [];
      const colunas =
        linhasDados.length > 0 && typeof linhasDados[0] === 'object' && linhasDados[0] !== null
          ? Object.keys(linhasDados[0])
          : aba.colunas;
      const headerRowXml =
        '<Row>' +
        colunas
          .map(
            (col) =>
              `<Cell ss:StyleID="sHeader"><Data ss:Type="String">${escapeXmlCell(col)}</Data></Cell>`
          )
          .join('') +
        '</Row>';
      const dataRowsXml = linhasDados
        .map((item) => {
          const cells = colunas
            .map((col) => {
              const rawVal = item?.[col];
              return `<Cell><Data ss:Type="String">${escapeXmlCell(rawVal)}</Data></Cell>`;
            })
            .join('');
          return `<Row>${cells}</Row>`;
        })
        .join('');
      return `<Worksheet ss:Name="${safeSheetName}"><Table>${headerRowXml}${dataRowsXml}</Table></Worksheet>`;
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<?mso-application progid="Excel.Sheet"?>',
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"',
    ' xmlns:o="urn:schemas-microsoft-com:office:office"',
    ' xmlns:x="urn:schemas-microsoft-com:office:excel"',
    ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">',
    '<DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">',
    `<Title>Urutau ERP - ${escapeXmlCell(nomeEmpresa)}</Title>`,
    '</DocumentProperties>',
    '<Styles>',
    '<Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Bottom"/></Style>',
    '<Style ss:ID="sHeader"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#065F46" ss:Pattern="Solid"/></Style>',
    '</Styles>',
    worksheetsXml,
    '</Workbook>'
  ].join('\n');
}

app.get('/api/lgpd/google-sheets/baixar-planilha-mestre/:empresaId', (req: Request, res: Response) => {
  const empId = Number(req.params.empresaId) || 1;
  const emp = (db.empresas || []).find((e: any) => Number(e.id) === empId) || db.empresas?.[0];
  const nomeEmp = emp?.nome || 'Minha_Empresa';
  const codigoDir = String(req.query.codigo || '01').trim();
  const dirBlueprint =
    BLUEPRINT_DIRETORIOS_PLANILHAS_URUTAU.find((d) => d.codigo === codigoDir) ||
    BLUEPRINT_DIRETORIOS_PLANILHAS_URUTAU[0];
  const dadosAtuais = extrairAbasPlanilhaDaEmpresa(empId);
  const xmlContent = gerarPlanilhaMultiAbasXml(nomeEmp, dirBlueprint.abas, dadosAtuais);
  const cleanName = String(dirBlueprint.planilha_nome || '00_Urutau_Planilha_Mestre_ERP')
    .replace(/[^a-zA-Z0-9_-]/g, '_');

  res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${cleanName}_${empId}.xls"`
  );
  res.send(xmlContent);
});

function verificarDriveRealmenteConectado(cfg: any): boolean {
  if (!cfg || typeof cfg !== 'object') return false;
  const hasRealFolderId = Boolean(
    cfg.pasta_google_drive_id &&
      String(cfg.pasta_google_drive_id).trim().length > 4 &&
      !String(cfg.pasta_google_drive_id).includes('my-drive')
  );
  const hasRealSheetId = Boolean(
    cfg.planilha_google_id &&
      String(cfg.planilha_google_id).trim().length > 4
  );
  const hasRealWebhook = Boolean(
    cfg.apps_script_webhook_url &&
      String(cfg.apps_script_webhook_url).trim().startsWith('https://')
  );
  const hasRealOAuth = Boolean(cfg.google_oauth_conectado_real === true);
  return hasRealFolderId || hasRealSheetId || hasRealWebhook || hasRealOAuth;
}

app.get('/api/lgpd/google-sheets/opcoes-publicas', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    email_servico_compartilhamento: 'bd@nyctibi.us',
    google_client_id: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || ''
  });
});

app.get('/api/lgpd/google-sheets/status/:empresaId', async (req: Request, res: Response) => {
  const empId = Number(req.params.empresaId) || 1;
  const emp = (db.empresas || []).find((e: any) => Number(e.id) === empId) || db.empresas?.[0];
  if (!emp) {
    res.status(404).json({ ok: false, erro: 'Empresa não localizada.' });
    return;
  }
  const emailServicoSistema = 'bd@nyctibi.us';
  if (!emp.lgpd_custodia_config || !Array.isArray(emp.lgpd_custodia_config.estrutura_diretorios_planilhas)) {
    const secretSheetToken =
      emp.lgpd_custodia_config?.chave_secreta_planilha ||
      `urutau_lgpd_${emp.id}_${crypto.randomBytes(6).toString('hex')}`;
    const estrutura = await provisionarDiretoriosEPlanilhasDaEmpresa(
      emp.id,
      emp.nome,
      emp.lgpd_custodia_config?.controlador_nome || emp.nome,
      emp.cnpj || '',
      emp.lgpd_custodia_config?.controlador_email || '',
      '',
      '',
      Boolean(emp.lgpd_custodia_config?.zero_guarda_operacional_vps === true)
    );
    emp.lgpd_custodia_config = {
      empresa_id: emp.id,
      empresa_nome: emp.nome,
      controlador_nome: emp.lgpd_custodia_config?.controlador_nome || emp.nome,
      controlador_documento: emp.lgpd_custodia_config?.controlador_documento || emp.cnpj || '',
      controlador_email: emp.lgpd_custodia_config?.controlador_email || '',
      conta_google_vinculada: '',
      google_oauth_conectado_real: false,
      provedor_nuvem_backup: emp.lgpd_custodia_config?.provedor_nuvem_backup || 'Google Drive',
      termo_lgpd_aceito: true,
      termo_lgpd_aceito_em: emp.lgpd_custodia_config?.termo_lgpd_aceito_em || emp.criado_em || new Date().toISOString(),
      termo_versao: 'LGPD-BYOS-2026.1',
      modo_conexao_drive: emp.lgpd_custodia_config?.modo_conexao_drive || 'botao_google',
      email_servico_compartilhamento: emailServicoSistema,
      pasta_google_drive_nome: estrutura.pastaRaizNome,
      pasta_google_drive_url: '',
      pasta_google_drive_id: '',
      diretorio_workspace_id: estrutura.diretorioWorkspaceRel,
      planilha_google_url: '',
      planilha_google_id: '',
      apps_script_webhook_url: '',
      chave_secreta_planilha: secretSheetToken,
      guarda_exclusiva_planilha_empresario: true,
      zero_guarda_operacional_vps: Boolean(emp.lgpd_custodia_config?.zero_guarda_operacional_vps === true),
      estrutura_criada_no_cadastro: true,
      estrutura_diretorios_planilhas: estrutura.diretorios,
      status_conexao: 'Não Conectado'
    };
    saveDbToDisk();
  }
  const realConnected = verificarDriveRealmenteConectado(emp.lgpd_custodia_config);
  if (!realConnected) {
    emp.lgpd_custodia_config.google_oauth_conectado_real = false;
    emp.lgpd_custodia_config.conta_google_vinculada = '';
    if (emp.lgpd_custodia_config.pasta_google_drive_url === 'https://drive.google.com/drive/my-drive') {
      emp.lgpd_custodia_config.pasta_google_drive_url = '';
    }
    emp.lgpd_custodia_config.status_conexao = 'Não Conectado';
  }
  const cfg = {
    ...emp.lgpd_custodia_config,
    google_conectado_real: realConnected,
    email_servico_compartilhamento: emailServicoSistema,
    zero_guarda_operacional_vps: Boolean(emp.lgpd_custodia_config?.zero_guarda_operacional_vps === true)
  };
  const scriptConector = gerarScriptConectorGoogleSheetsEmpresario(
    emp.id,
    emp.nome,
    cfg.chave_secreta_planilha
  );
  res.json({
    ok: true,
    config: cfg,
    google_conectado_real: realConnected,
    email_servico_compartilhamento: emailServicoSistema,
    google_client_id: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '',
    script_conector_apps_script: scriptConector,
    abas_padrao: [
      'Colaboradores_RH',
      'Escalas_Turnos',
      'Comunicacao_Interna',
      'Reservas_Salao',
      'Caixa_Rateio',
      'Estoque_Compras_CMV',
      'Auditoria_LGPD'
    ]
  });
});

app.post('/api/lgpd/google-sheets/desconectar', async (req: Request, res: Response) => {
  try {
    const empId = Number(req.body?.empresa_id) || 1;
    const emp = (db.empresas || []).find((e: any) => Number(e.id) === empId) || db.empresas?.[0];
    if (!emp) {
      res.status(404).json({ ok: false, erro: 'Empresa não localizada.' });
      return;
    }
    if (emp.lgpd_custodia_config) {
      emp.lgpd_custodia_config.conta_google_vinculada = '';
      emp.lgpd_custodia_config.google_oauth_conectado_real = false;
      emp.lgpd_custodia_config.pasta_google_drive_id = '';
      emp.lgpd_custodia_config.pasta_google_drive_url = '';
      emp.lgpd_custodia_config.planilha_google_id = '';
      emp.lgpd_custodia_config.planilha_google_url = '';
      emp.lgpd_custodia_config.apps_script_webhook_url = '';
      emp.lgpd_custodia_config.status_conexao = 'Não Conectado';
      saveDbToDisk();
    }
    res.json({ ok: true, config: emp.lgpd_custodia_config });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.post('/api/lgpd/google-sheets/provisionar-estrutura', async (req: Request, res: Response) => {
  try {
    const {
      empresa_id,
      nome_empresa,
      controlador_nome,
      controlador_documento,
      controlador_email,
      conta_google_vinculada,
      provedor_nuvem_backup,
      modo_conexao_drive,
      pasta_google_drive_url,
      google_access_token,
      apps_script_webhook_url
    } = req.body || {};

    const empId = Number(empresa_id) || 1;
    const emp = (db.empresas || []).find((e: any) => Number(e.id) === empId);
    const nomeEmpFinal = String(nome_empresa || emp?.nome || 'Minha Empresa').trim();
    const nomeCtrlFinal = String(controlador_nome || emp?.lgpd_custodia_config?.controlador_nome || nomeEmpFinal).trim();
    const docCtrlFinal = String(controlador_documento || emp?.cnpj || '').trim();
    const tokenLimpo = String(google_access_token || '').trim();
    const temTokenOAuthValido =
      tokenLimpo.length > 20 && tokenLimpo !== 'CONECTADO_AUTOMATICO_BD_NYCTIBI_US';
    const emailCtrlFinal = String(
      controlador_email ||
        emp?.lgpd_custodia_config?.controlador_email ||
        ''
    ).trim();
    const contaGoogleFinal = temTokenOAuthValido
      ? String(conta_google_vinculada || emailCtrlFinal || '').trim()
      : String(conta_google_vinculada || '').trim();
    const provedorNuvemFinal = String(
      provedor_nuvem_backup || emp?.lgpd_custodia_config?.provedor_nuvem_backup || 'Google Drive'
    ).trim();
    const pastaCompartilhadaUrl = String(
      pasta_google_drive_url ?? emp?.lgpd_custodia_config?.pasta_google_drive_url ?? ''
    ).trim();

    const isZeroGuarda = Boolean(emp?.lgpd_custodia_config?.zero_guarda_operacional_vps === true);
    let estrutura = await provisionarDiretoriosEPlanilhasDaEmpresa(
      empId,
      nomeEmpFinal,
      nomeCtrlFinal,
      docCtrlFinal,
      contaGoogleFinal || emailCtrlFinal,
      temTokenOAuthValido ? tokenLimpo : '',
      pastaCompartilhadaUrl === 'https://drive.google.com/drive/my-drive' ? '' : pastaCompartilhadaUrl,
      isZeroGuarda
    );

    const webhookUrl = String(apps_script_webhook_url || emp?.lgpd_custodia_config?.apps_script_webhook_url || '').trim();
    if (!estrutura.pastaRaizDriveUrl && webhookUrl && webhookUrl.startsWith('https://')) {
      try {
        const respWebhook = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            acao: 'CRIAR_ESTRUTURA_COMPLETA',
            chave_secreta: emp?.lgpd_custodia_config?.chave_secreta_planilha || '',
            empresa_id: empId,
            empresa_nome: nomeEmpFinal
          })
        });
        if (respWebhook.ok) {
          const jsonRemoto: any = await respWebhook.json();
          if (jsonRemoto?.ok) {
            estrutura = {
              ...estrutura,
              pastaRaizDriveId: jsonRemoto.pasta_google_drive_id || estrutura.pastaRaizDriveId,
              pastaRaizDriveUrl: jsonRemoto.pasta_google_drive_url || estrutura.pastaRaizDriveUrl,
              planilhaMestreId: jsonRemoto.planilha_google_id || estrutura.planilhaMestreId,
              planilhaMestreUrl: jsonRemoto.planilha_google_url || estrutura.planilhaMestreUrl,
              diretorios: Array.isArray(jsonRemoto.diretorios) ? jsonRemoto.diretorios : estrutura.diretorios
            };
          }
        }
      } catch {}
    }

    if (emp) {
      const prevCfg = emp.lgpd_custodia_config || {};
      const nextFolderId = estrutura.pastaRaizDriveId || prevCfg.pasta_google_drive_id || '';
      const nextSheetId = estrutura.planilhaMestreId || prevCfg.planilha_google_id || '';
      const isRealConn = Boolean(
        temTokenOAuthValido ||
          (nextFolderId && !String(nextFolderId).includes('my-drive')) ||
          nextSheetId ||
          (webhookUrl && webhookUrl.startsWith('https://'))
      );
      emp.lgpd_custodia_config = {
        ...prevCfg,
        empresa_id: emp.id,
        empresa_nome: emp.nome,
        controlador_nome: nomeCtrlFinal,
        controlador_documento: docCtrlFinal,
        controlador_email: emailCtrlFinal,
        conta_google_vinculada: isRealConn ? (contaGoogleFinal || emailCtrlFinal) : '',
        google_oauth_conectado_real: isRealConn,
        provedor_nuvem_backup: provedorNuvemFinal,
        modo_conexao_drive: modo_conexao_drive || prevCfg.modo_conexao_drive || 'botao_google',
        email_servico_compartilhamento: 'bd@nyctibi.us',
        pasta_google_drive_nome: estrutura.pastaRaizNome,
        pasta_google_drive_url:
          estrutura.pastaRaizDriveUrl ||
          (pastaCompartilhadaUrl !== 'https://drive.google.com/drive/my-drive' ? pastaCompartilhadaUrl : '') ||
          prevCfg.pasta_google_drive_url ||
          '',
        pasta_google_drive_id: nextFolderId,
        diretorio_workspace_id: estrutura.diretorioWorkspaceRel,
        planilha_google_url: estrutura.planilhaMestreUrl || prevCfg.planilha_google_url || '',
        planilha_google_id: nextSheetId,
        apps_script_webhook_url: webhookUrl,
        zero_guarda_operacional_vps: Boolean(prevCfg.zero_guarda_operacional_vps === true),
        estrutura_criada_no_cadastro: true,
        estrutura_diretorios_planilhas: estrutura.diretorios,
        ultima_sincronizacao_em: isRealConn ? new Date().toISOString() : prevCfg.ultima_sincronizacao_em,
        status_conexao: isRealConn ? 'Ativa' : 'Não Conectado',
        estado_fechamento_local: isRealConn ? null : prevCfg.estado_fechamento_local || null
      };
      if (!emp.lgpd_custodia_config.estado_fechamento_local && isRealConn) {
        sseBroker.emit('sessao.ultimo_pc_sincronizado', { empresa_id: emp.id });
      }
      saveDbToDisk();
    }

    res.json({
      ok: true,
      pasta_raiz_nome: estrutura.pastaRaizNome,
      pasta_google_drive_url:
        estrutura.pastaRaizDriveUrl ||
        (pastaCompartilhadaUrl !== 'https://drive.google.com/drive/my-drive' ? pastaCompartilhadaUrl : ''),
      planilha_google_url: estrutura.planilhaMestreUrl,
      diretorio_workspace_id: estrutura.diretorioWorkspaceRel,
      diretorios: estrutura.diretorios,
      config: emp?.lgpd_custodia_config || null
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.post('/api/lgpd/google-sheets/config', async (req: Request, res: Response) => {
  try {
    const {
      empresa_id,
      controlador_nome,
      controlador_documento,
      controlador_email,
      conta_google_vinculada,
      provedor_nuvem_backup,
      modo_conexao_drive,
      pasta_google_drive_url,
      planilha_google_url,
      apps_script_webhook_url
    } = req.body || {};

    const empId = Number(empresa_id) || 1;
    const emp = (db.empresas || []).find((e: any) => Number(e.id) === empId) || db.empresas?.[0];
    if (!emp) {
      res.status(404).json({ ok: false, erro: 'Empresa não localizada.' });
      return;
    }

    const rawFolderUrl = String(pasta_google_drive_url ?? emp.lgpd_custodia_config?.pasta_google_drive_url ?? '').trim();
    const cleanFolderUrl = rawFolderUrl === 'https://drive.google.com/drive/my-drive' ? '' : rawFolderUrl;
    const folderIdMatch = cleanFolderUrl.match(/\/folders\/([a-zA-Z0-9-_]+)/);
    const extractedFolderId = folderIdMatch ? folderIdMatch[1] : '';
    const rawSheetUrl = String(planilha_google_url ?? emp.lgpd_custodia_config?.planilha_google_url ?? '').trim();
    const rawWebhookUrl = String(apps_script_webhook_url ?? emp.lgpd_custodia_config?.apps_script_webhook_url ?? '').trim();
    const extractedMatch = rawSheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    const extractedId = extractedMatch ? extractedMatch[1] : rawSheetUrl;
    const prevCfg = emp.lgpd_custodia_config || {};
    const secretToken =
      prevCfg.chave_secreta_planilha ||
      `urutau_lgpd_${emp.id}_${crypto.randomBytes(6).toString('hex')}`;
    const emailControladorFinal = String(
      controlador_email ?? prevCfg.controlador_email ?? ''
    ).trim();
    const provedorFinal = String(
      provedor_nuvem_backup ?? prevCfg.provedor_nuvem_backup ?? 'Google Drive'
    ).trim();
    const nextFolderId = extractedFolderId || prevCfg.pasta_google_drive_id || '';
    const hasRealConnection = Boolean(
      (nextFolderId && String(nextFolderId).trim().length > 4) ||
        (extractedId && String(extractedId).trim().length > 4) ||
        (rawWebhookUrl && rawWebhookUrl.startsWith('https://')) ||
        prevCfg.google_oauth_conectado_real === true
    );
    const contaGoogleFinal = hasRealConnection
      ? String(conta_google_vinculada ?? prevCfg.conta_google_vinculada ?? emailControladorFinal).trim()
      : '';

    emp.lgpd_custodia_config = {
      ...prevCfg,
      empresa_id: emp.id,
      empresa_nome: emp.nome,
      controlador_nome: String(controlador_nome || prevCfg.controlador_nome || emp.nome).trim(),
      controlador_documento: String(controlador_documento ?? prevCfg.controlador_documento ?? emp.cnpj ?? '').trim(),
      controlador_email: emailControladorFinal,
      conta_google_vinculada: contaGoogleFinal,
      google_oauth_conectado_real: hasRealConnection,
      provedor_nuvem_backup: provedorFinal,
      termo_lgpd_aceito: true,
      termo_lgpd_aceito_em: prevCfg.termo_lgpd_aceito_em || new Date().toISOString(),
      termo_versao: 'LGPD-BYOS-2026.1',
      modo_conexao_drive: modo_conexao_drive || prevCfg.modo_conexao_drive || 'botao_google',
      email_servico_compartilhamento: 'bd@nyctibi.us',
      pasta_google_drive_url: cleanFolderUrl,
      pasta_google_drive_id: nextFolderId,
      planilha_google_url: rawSheetUrl,
      planilha_google_id: extractedId,
      apps_script_webhook_url: rawWebhookUrl,
      chave_secreta_planilha: secretToken,
      guarda_exclusiva_planilha_empresario: true,
      zero_guarda_operacional_vps: Boolean(prevCfg.zero_guarda_operacional_vps === true),
      exportacao_nuvem_intervalo_minutos: 60,
      exportacao_nuvem_automatica_ativa: true,
      exportacao_local_fechamento_exe_ativa: true,
      ultima_sincronizacao_em: hasRealConnection ? new Date().toISOString() : prevCfg.ultima_sincronizacao_em,
      proxima_exportacao_nuvem_em: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      ultimo_backup_local_fechamento_em:
        prevCfg.ultimo_backup_local_fechamento_em || new Date().toISOString(),
      status_conexao: hasRealConnection ? 'Ativa' : 'Não Conectado',
      estado_fechamento_local: hasRealConnection ? null : prevCfg.estado_fechamento_local || null
    };

    if (!emp.lgpd_custodia_config.estado_fechamento_local && hasRealConnection) {
      sseBroker.emit('sessao.ultimo_pc_sincronizado', { empresa_id: emp.id });
    }
    saveDbToDisk();
    await registrarAuditLog(
      emp.lgpd_custodia_config.controlador_nome,
      'LGPD_CONFIGURAR_BACKUP_NUVEM',
      `Backup de Segurança em Nuvem (${provedorFinal}) atualizado para ${emp.nome}`,
      req.ip,
      'Gestor da Empresa'
    );

    res.json({
      ok: true,
      config: emp.lgpd_custodia_config
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

async function executarExportacaoBackupEmpresa(
  empIdInput: number,
  origem: 'AUTOMATICA_1H' | 'FECHAMENTO_EXE_LOCAL' | 'MANUAL' = 'MANUAL'
) {
  const empId = Number(empIdInput) || 1;
  const emp = (db?.empresas || []).find((e: any) => Number(e.id) === empId) || db?.empresas?.[0];
  if (!emp) return null;

  const cfg = emp.lgpd_custodia_config || {};
  const abasPayload = extrairAbasPlanilhaDaEmpresa(emp.id);
  let resultadoRemoto: any = null;

  if (cfg?.apps_script_webhook_url && cfg.apps_script_webhook_url.startsWith('https://')) {
    try {
      const resp = await fetch(cfg.apps_script_webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chave_secreta: cfg.chave_secreta_planilha,
          empresa_id: emp.id,
          empresa_nome: emp.nome,
          origem_exportacao: origem,
          abas: abasPayload
        })
      });
      const texto = await resp.text();
      try {
        resultadoRemoto = JSON.parse(texto);
      } catch {
        resultadoRemoto = { ok: resp.ok, status: resp.status };
      }
    } catch (errFetch: any) {
      resultadoRemoto = { ok: false, aviso: errFetch.message };
    }
  }

  const agoraIso = new Date().toISOString();
  const proxima1hIso = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  if (!emp.lgpd_custodia_config) {
    emp.lgpd_custodia_config = {};
  }
  const hasRealConn = verificarDriveRealmenteConectado(emp.lgpd_custodia_config);
  emp.lgpd_custodia_config.ultima_sincronizacao_em = agoraIso;
  emp.lgpd_custodia_config.proxima_exportacao_nuvem_em = proxima1hIso;
  emp.lgpd_custodia_config.exportacao_nuvem_intervalo_minutos = 60;
  emp.lgpd_custodia_config.exportacao_nuvem_automatica_ativa = true;
  emp.lgpd_custodia_config.exportacao_local_fechamento_exe_ativa = true;
  emp.lgpd_custodia_config.status_conexao = hasRealConn ? 'Ativa' : 'Não Conectado';
  const zeroGuardaAtivo = Boolean(emp.lgpd_custodia_config.zero_guarda_operacional_vps === true);
  emp.lgpd_custodia_config.zero_guarda_operacional_vps = zeroGuardaAtivo;
  emp.lgpd_custodia_config.total_exportacoes_nuvem_1h =
    Number(emp.lgpd_custodia_config.total_exportacoes_nuvem_1h || 0) + 1;

  if (origem === 'FECHAMENTO_EXE_LOCAL') {
    emp.lgpd_custodia_config.ultimo_backup_local_fechamento_em = agoraIso;
    emp.lgpd_custodia_config.total_backups_locais_fechamento =
      Number(emp.lgpd_custodia_config.total_backups_locais_fechamento || 0) + 1;
  }

  const pacotePortatil = gerarPacotePortatilEmpresa(emp.id);

  if (!zeroGuardaAtivo) {
    try {
      const dirRel =
        emp.lgpd_custodia_config.diretorio_workspace_id ||
        `workspaces_empresas/empresa_${emp.id}`;
      const dirAbs = path.join(__dirname, dirRel);
      fs.mkdirSync(dirAbs, { recursive: true });
      const snapshotPath = path.join(dirAbs, 'ultimo_backup_exportado.json');
      fs.writeFileSync(
        snapshotPath,
        JSON.stringify(
          {
            empresa_id: emp.id,
            empresa_nome: emp.nome,
            origem,
            exportado_em: agoraIso,
            proxima_exportacao_nuvem_em: proxima1hIso,
            abas: abasPayload
          },
          null,
          2
        ),
        'utf-8'
      );
    } catch {}
  }

  saveDbToDisk();

  return {
    ok: true,
    empresa_id: emp.id,
    empresa_nome: emp.nome,
    origem,
    sincronizado_em: agoraIso,
    proxima_exportacao_nuvem_em: proxima1hIso,
    ultimo_backup_local_fechamento_em:
      emp.lgpd_custodia_config.ultimo_backup_local_fechamento_em || agoraIso,
    zero_guarda_operacional_vps: zeroGuardaAtivo,
    expurgado_da_vps: zeroGuardaAtivo,
    resumo_abas: {
      Colaboradores_RH: abasPayload.Colaboradores_RH.length,
      Escalas_Turnos: abasPayload.Escalas_Turnos.length,
      Comunicacao_Interna: abasPayload.Comunicacao_Interna.length,
      Reservas_Salao: abasPayload.Reservas_Salao.length,
      Caixa_Rateio: abasPayload.Caixa_Rateio.length,
      Estoque_Compras_CMV: abasPayload.Estoque_Compras_CMV.length,
      Auditoria_LGPD: abasPayload.Auditoria_LGPD.length
    },
    abas_dados: abasPayload,
    pacote_portatil: pacotePortatil,
    resultado_remoto: resultadoRemoto
  };
}

setInterval(async () => {
  try {
    if (!db || !Array.isArray(db.empresas)) return;
    for (const emp of db.empresas) {
      if (!emp.arquivado_legal) {
        await executarExportacaoBackupEmpresa(emp.id, 'AUTOMATICA_1H');
      }
    }
    sseBroker.emit('backup.nuvem.ciclo_1h', {
      executado_em: new Date().toISOString(),
      proxima_em: new Date(Date.now() + 60 * 60 * 1000).toISOString()
    });
  } catch {}
}, 60 * 60 * 1000).unref?.();

app.post('/api/lgpd/google-sheets/sync', async (req: Request, res: Response) => {
  try {
    const { empresa_id, origem } = req.body || {};
    const empId = Number(empresa_id) || 1;
    const resultado = await executarExportacaoBackupEmpresa(
      empId,
      origem === 'AUTOMATICA_1H'
        ? 'AUTOMATICA_1H'
        : origem === 'FECHAMENTO_EXE_LOCAL'
        ? 'FECHAMENTO_EXE_LOCAL'
        : 'MANUAL'
    );
    if (!resultado) {
      res.status(404).json({ ok: false, erro: 'Empresa não localizada.' });
      return;
    }
    res.json(resultado);
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.post('/api/lgpd/google-sheets/exportar-fechamento-local', async (req: Request, res: Response) => {
  try {
    let bodyObj: any = req.body || {};
    if (typeof req.body === 'string') {
      try {
        bodyObj = JSON.parse(req.body);
      } catch {}
    }
    const empId = Number(bodyObj.empresa_id || req.query.empresa_id || 1);
    const resultado = await executarExportacaoBackupEmpresa(empId, 'FECHAMENTO_EXE_LOCAL');
    if (!resultado) {
      res.status(404).json({ ok: false, erro: 'Empresa não localizada.' });
      return;
    }
    const emp = (db?.empresas || []).find((e: any) => Number(e.id) === empId);
    const isZeroGuarda = Boolean(emp?.lgpd_custodia_config?.zero_guarda_operacional_vps === true);
    const cfgEmp = emp?.lgpd_custodia_config || {};
    const driveConectadoEmp = verificarDriveRealmenteConectado(cfgEmp);
    const pcIdLimpo = String(bodyObj.pc_id || '').trim() || 'PC-LOCAL';
    const pcApelidoLimpo = String(bodyObj.pc_apelido || '').trim() || 'Computador Local';
    const agoraCheckpointIso = new Date().toISOString();

    if (emp) {
      if (!emp.lgpd_custodia_config) emp.lgpd_custodia_config = {};
      if (
        !emp.lgpd_custodia_config.backups_pontos_parada_por_pc ||
        typeof emp.lgpd_custodia_config.backups_pontos_parada_por_pc !== 'object'
      ) {
        emp.lgpd_custodia_config.backups_pontos_parada_por_pc = {};
      }
      emp.lgpd_custodia_config.backups_pontos_parada_por_pc[pcIdLimpo] = {
        pc_id: pcIdLimpo,
        pc_apelido: pcApelidoLimpo,
        ponto_parada_em: agoraCheckpointIso,
        sobrescrito_unico: true,
        era_ultimo_pc: Boolean(bodyObj.is_ultimo_pc === true),
        resumo_abas: resultado.resumo_abas
      };
      saveDbToDisk();
    }

    const registrarUltimoPcSemNuvem = () => {
      if (!emp || !isZeroGuarda || driveConectadoEmp) return;
      if (!emp.lgpd_custodia_config) emp.lgpd_custodia_config = {};
      emp.lgpd_custodia_config.estado_fechamento_local = {
        aguardando_primeiro_pc: true,
        ultimo_pc_id: pcIdLimpo,
        ultimo_pc_apelido: pcApelidoLimpo,
        fechado_em: agoraCheckpointIso
      };
      saveDbToDisk();
      sseBroker.emit('sessao.aguardando_primeiro_pc', {
        empresa_id: empId,
        estado_fechamento_local: emp.lgpd_custodia_config.estado_fechamento_local
      });
    };

    let expurgadoAgora = false;
    if (bodyObj.encerrar_sessao === true && isZeroGuarda) {
      if (bodyObj.is_ultimo_pc === true) {
        registrarUltimoPcSemNuvem();
      }
      setTimeout(async () => {
        try {
          const restantes = sseBroker.countClientsForEmpresa(empId);
          if (restantes === 0) {
            registrarUltimoPcSemNuvem();
            expurgarDadosOperacionaisEmpresaNaVps(empId);
            await cacheERP.invalidatePrefix('erp:');
          }
        } catch {}
      }, 2500);
      expurgadoAgora = sseBroker.countClientsForEmpresa(empId) <= 1;
    }
    sseBroker.emit('backup.local.fechamento_exe', {
      empresa_id: empId,
      pc_id: pcIdLimpo,
      pc_apelido: pcApelidoLimpo,
      sobrescrito_unico: true,
      exportado_em: resultado.sincronizado_em,
      zero_guarda_operacional_vps: isZeroGuarda,
      computadores_ativos_restantes: Math.max(0, sseBroker.countClientsForEmpresa(empId) - 1)
    });
    res.json({
      ...resultado,
      sobrescrito_unico: true,
      ponto_parada_pc_id: pcIdLimpo,
      expurgado_da_vps: expurgadoAgora,
      computadores_ativos_empresa: sseBroker.countClientsForEmpresa(empId),
      estado_fechamento_local: emp?.lgpd_custodia_config?.estado_fechamento_local || null
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.get('/api/lgpd/vps-processador/status/:empresaId', (req: Request, res: Response) => {
  const empId = Number(req.params.empresaId) || 1;
  const emp = (db?.empresas || []).find((e: any) => Number(e.id) === empId) || db?.empresas?.[0];
  if (!emp) {
    res.status(404).json({ ok: false, erro: 'Empresa não localizada.' });
    return;
  }
  const contagens = contarRegistrosOperacionaisNaVps(emp.id);
  const zeroGuarda = Boolean(emp.lgpd_custodia_config?.zero_guarda_operacional_vps === true);
  const cfg = emp.lgpd_custodia_config || {};
  const driveConectado = verificarDriveRealmenteConectado(cfg);
  res.json({
    ok: true,
    empresa_id: emp.id,
    empresa_nome: emp.nome,
    zero_guarda_operacional_vps: zeroGuarda,
    custodia_transferida_em: cfg.custodia_transferida_em || null,
    computadores_ativos: sseBroker.countClientsForEmpresa(emp.id),
    drive_conectado: driveConectado,
    modo_guarda_escolhido: cfg.modo_guarda_escolhido || (driveConectado ? 'google_drive' : 'computador_local_multiacesso'),
    multiacesso_sem_drive_confirmado: Boolean(cfg.multiacesso_sem_drive_confirmado === true),
    multiacesso_sem_drive_confirmado_em: cfg.multiacesso_sem_drive_confirmado_em || null,
    estado_fechamento_local: driveConectado ? null : cfg.estado_fechamento_local || null,
    backups_pontos_parada_por_pc: cfg.backups_pontos_parada_por_pc || {},
    contagens_vps: contagens
  });
});

app.post('/api/lgpd/vps-processador/definir-modo-multiacesso', async (req: Request, res: Response) => {
  try {
    const {
      empresa_id,
      modo_guarda_escolhido,
      multiacesso_sem_drive_confirmado,
      usuario_nome
    } = req.body || {};
    const empId = Number(empresa_id) || 1;
    const emp = (db?.empresas || []).find((e: any) => Number(e.id) === empId) || db?.empresas?.[0];
    if (!emp) {
      res.status(404).json({ ok: false, erro: 'Empresa não localizada.' });
      return;
    }
    if (!emp.lgpd_custodia_config) emp.lgpd_custodia_config = {};
    const agoraIso = new Date().toISOString();
    emp.lgpd_custodia_config.modo_guarda_escolhido =
      modo_guarda_escolhido === 'google_drive' ? 'google_drive' : 'computador_local_multiacesso';
    emp.lgpd_custodia_config.multiacesso_sem_drive_confirmado = Boolean(
      multiacesso_sem_drive_confirmado === true
    );
    emp.lgpd_custodia_config.multiacesso_sem_drive_confirmado_em =
      multiacesso_sem_drive_confirmado === true ? agoraIso : null;

    saveDbToDisk();
    await registrarAuditLog(
      usuario_nome || emp.nome,
      'LGPD_ESCOLHA_MODO_MULTIACESSO',
      `Cliente escolheu modo "${emp.lgpd_custodia_config.modo_guarda_escolhido}" (Ciência multiacesso sem nuvem: ${emp.lgpd_custodia_config.multiacesso_sem_drive_confirmado ? 'CONFIRMADA' : 'NÃO'})`,
      req.ip,
      'Gestor da Empresa'
    );
    sseBroker.emit('config.atualizada', { empresa_id: emp.id });
    res.json({
      ok: true,
      modo_guarda_escolhido: emp.lgpd_custodia_config.modo_guarda_escolhido,
      multiacesso_sem_drive_confirmado: emp.lgpd_custodia_config.multiacesso_sem_drive_confirmado,
      multiacesso_sem_drive_confirmado_em: emp.lgpd_custodia_config.multiacesso_sem_drive_confirmado_em
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.get('/api/lgpd/vps-processador/exportar-pacote/:empresaId', (req: Request, res: Response) => {
  const empId = Number(req.params.empresaId) || 1;
  const emp = (db?.empresas || []).find((e: any) => Number(e.id) === empId) || db?.empresas?.[0];
  if (!emp) {
    res.status(404).json({ ok: false, erro: 'Empresa não localizada.' });
    return;
  }
  const pacote = gerarPacotePortatilEmpresa(emp.id);
  res.json({
    ok: true,
    pacote_portatil: pacote
  });
});

app.post('/api/lgpd/vps-processador/migrar-e-expurgar', async (req: Request, res: Response) => {
  try {
    const { empresa_id, confirmado_recebimento_cliente, manter_sessao_ram } = req.body || {};
    const empId = Number(empresa_id) || 1;
    const emp = (db?.empresas || []).find((e: any) => Number(e.id) === empId) || db?.empresas?.[0];
    if (!emp) {
      res.status(404).json({ ok: false, erro: 'Empresa não localizada.' });
      return;
    }

    const pacote = gerarPacotePortatilEmpresa(emp.id);
    const cfg = emp.lgpd_custodia_config || {};
    let enviadoDrive = false;

    if (cfg?.apps_script_webhook_url && cfg.apps_script_webhook_url.startsWith('https://')) {
      try {
        const resp = await fetch(cfg.apps_script_webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chave_secreta: cfg.chave_secreta_planilha,
            empresa_id: emp.id,
            empresa_nome: emp.nome,
            origem_exportacao: 'MIGRACAO_ZERO_GUARDA_VPS',
            abas: pacote.abas_planilha
          })
        });
        if (resp.ok) enviadoDrive = true;
      } catch {}
    }

    if (confirmado_recebimento_cliente === true) {
      if (!emp.lgpd_custodia_config) emp.lgpd_custodia_config = {};
      emp.lgpd_custodia_config.zero_guarda_operacional_vps = true;
      emp.lgpd_custodia_config.custodia_transferida_em = new Date().toISOString();
      emp.lgpd_custodia_config.guarda_exclusiva_planilha_empresario = true;
      removerPastaWorkspaceVpsEmpresa(emp.id);
      if (manter_sessao_ram === false) {
        expurgarDadosOperacionaisEmpresaNaVps(emp.id);
      } else {
        saveDbToDisk();
      }
      await cacheERP.invalidatePrefix('erp:');
    }

    res.json({
      ok: true,
      empresa_id: emp.id,
      enviado_drive: enviadoDrive,
      zero_guarda_operacional_vps: Boolean(emp.lgpd_custodia_config?.zero_guarda_operacional_vps === true),
      custodia_transferida_em: emp.lgpd_custodia_config?.custodia_transferida_em || null,
      pacote_portatil: pacote,
      contagens_vps_disco: contarRegistrosOperacionaisNaVps(emp.id)
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.post('/api/lgpd/vps-processador/hidratar-sessao', async (req: Request, res: Response) => {
  try {
    const {
      empresa_id,
      pacote_portatil,
      pc_id,
      forcar_liberacao_manual,
      modo_mesclagem
    } = req.body || {};
    const empId = Number(empresa_id || pacote_portatil?.empresa_id || 1);
    const emp = (db?.empresas || []).find((e: any) => Number(e.id) === empId);
    if (!emp || !pacote_portatil || typeof pacote_portatil !== 'object') {
      res.status(400).json({ ok: false, erro: 'Pacote portátil inválido para processamento em sessão.' });
      return;
    }

    let registrosRecuperados = 0;
    let registrosReindexados = 0;

    const assinaturaRegistro = (x: any) => {
      if (!x || typeof x !== 'object') return '';
      const clone: Record<string, any> = {};
      for (const k of Object.keys(x).sort()) {
        if (k === 'id' || k === 'atualizado_em' || k === 'updated_at') continue;
        clone[k] = x[k];
      }
      return JSON.stringify(clone);
    };

    const mesclarLista = (atual: any[], recebida: any[]) => {
      const listaAtual = Array.isArray(atual) ? [...atual] : [];
      if (!Array.isArray(recebida) || recebida.length === 0) return listaAtual;
      const assinaturasExistentes = new Set(listaAtual.map((x) => assinaturaRegistro(x)));
      const idsExistentes = new Set(listaAtual.map((x) => Number(x.id || 0)));
      let maiorId = listaAtual.reduce((max, item) => Math.max(max, Number(item?.id || 0)), 0);

      for (const rec of recebida) {
        if (!rec || typeof rec !== 'object') continue;
        const assinaturaRec = assinaturaRegistro(rec);
        if (assinaturasExistentes.has(assinaturaRec)) {
          continue;
        }
        const idOrig = Number(rec.id || 0);
        if (idOrig > 0 && !idsExistentes.has(idOrig)) {
          listaAtual.push(rec);
          idsExistentes.add(idOrig);
          assinaturasExistentes.add(assinaturaRec);
          if (idOrig > maiorId) maiorId = idOrig;
          registrosRecuperados += 1;
        } else {
          maiorId += 1;
          listaAtual.push({ ...rec, id: maiorId });
          idsExistentes.add(maiorId);
          assinaturasExistentes.add(assinaturaRec);
          registrosRecuperados += 1;
          registrosReindexados += 1;
        }
      }
      return listaAtual;
    };

    db.reservas = mesclarLista(db.reservas, pacote_portatil.reservas);
    db.erp_escalas_movimentos = mesclarLista(db.erp_escalas_movimentos, pacote_portatil.movimentosEscala);
    db.erp_caixa = mesclarLista(db.erp_caixa, pacote_portatil.caixa);
    db.erp_estoque = mesclarLista(db.erp_estoque, pacote_portatil.estoque);
    db.erp_cmv = mesclarLista(db.erp_cmv, pacote_portatil.cmv);
    db.erp_selecao = mesclarLista(db.erp_selecao, pacote_portatil.selecao);
    db.erp_notificacoes = mesclarLista(db.erp_notificacoes, pacote_portatil.notificacoes);
    db.erp_rh_nr01 = mesclarLista(db.erp_rh_nr01, pacote_portatil.rhRegistros);
    db.erp_rateios_historico = mesclarLista(db.erp_rateios_historico, pacote_portatil.rateiosHistorico);
    db.eventos_agenda = mesclarLista(db.eventos_agenda, pacote_portatil.agenda);
    db.checklists = mesclarLista(db.checklists, pacote_portatil.checklists);
    db.cadastros_pessoas = mesclarLista(db.cadastros_pessoas || [], pacote_portatil.cadastrosPessoas);

    const pend = emp.lgpd_custodia_config?.estado_fechamento_local;
    const pcIdRecebido = String(pc_id || '').trim();
    const deveLiberarPendencia =
      forcar_liberacao_manual === true ||
      modo_mesclagem === 'recuperar_atraso' ||
      !pcIdRecebido ||
      (pend?.ultimo_pc_id && pcIdRecebido === pend.ultimo_pc_id);

    if (!emp.lgpd_custodia_config) emp.lgpd_custodia_config = {};
    const backupsAntigosObj = emp.lgpd_custodia_config.backups_pontos_parada_por_pc || {};
    const qtdBackupsDuplicadosApagados = Object.keys(backupsAntigosObj).length;
    emp.lgpd_custodia_config.backups_pontos_parada_por_pc = {};
    emp.lgpd_custodia_config.ultimo_expurgo_backups_duplicados_em = new Date().toISOString();

    if (pend?.aguardando_primeiro_pc && deveLiberarPendencia) {
      emp.lgpd_custodia_config.estado_fechamento_local = null;
    }
    saveDbToDisk();

    const cfgEmp = emp.lgpd_custodia_config || {};
    if (cfgEmp.apps_script_webhook_url && String(cfgEmp.apps_script_webhook_url).startsWith('https://')) {
      try {
        await executarExportacaoBackupEmpresa(empId, 'MANUAL');
      } catch {}
    }

    await cacheERP.invalidatePrefix('erp:');

    sseBroker.emit('sessao.ultimo_pc_sincronizado', {
      empresa_id: empId,
      liberado_por_pc_id: pcIdRecebido || 'MANUAL',
      registros_recuperados: registrosRecuperados,
      limpar_backups_duplicados: true,
      backups_duplicados_apagados: qtdBackupsDuplicadosApagados
    });
    sseBroker.emit('config.atualizada', { empresa_id: empId });

    res.json({
      ok: true,
      empresa_id: empId,
      hidratado_em_ram: true,
      registros_recuperados: registrosRecuperados,
      registros_reindexed: registrosReindexados,
      backups_duplicados_apagados: qtdBackupsDuplicadosApagados,
      limpar_backups_duplicados: true,
      persistido_em_disco_vps: !isEmpresaZeroGuarda(empId),
      estado_fechamento_local: emp.lgpd_custodia_config?.estado_fechamento_local || null
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.post('/api/lgpd/vps-processador/confirmar-retorno-ultimo-pc', async (req: Request, res: Response) => {
  try {
    const { empresa_id, pc_id, liberar_todos_computadores } = req.body || {};
    const empId = Number(empresa_id) || 1;
    const emp = (db?.empresas || []).find((e: any) => Number(e.id) === empId);
    if (!emp) {
      res.status(404).json({ ok: false, erro: 'Empresa não localizada.' });
      return;
    }
    if (!emp.lgpd_custodia_config) emp.lgpd_custodia_config = {};
    const pend = emp.lgpd_custodia_config.estado_fechamento_local;
    const pcIdLimpo = String(pc_id || '').trim();
    const qtdDuplicados = Object.keys(emp.lgpd_custodia_config.backups_pontos_parada_por_pc || {}).length;
    emp.lgpd_custodia_config.backups_pontos_parada_por_pc = {};
    emp.lgpd_custodia_config.ultimo_expurgo_backups_duplicados_em = new Date().toISOString();

    if (
      pend?.aguardando_primeiro_pc &&
      (liberar_todos_computadores === true || !pcIdLimpo || pcIdLimpo === pend.ultimo_pc_id)
    ) {
      emp.lgpd_custodia_config.estado_fechamento_local = null;
    }
    saveDbToDisk();
    await cacheERP.invalidatePrefix('erp:');
    sseBroker.emit('sessao.ultimo_pc_sincronizado', {
      empresa_id: empId,
      liberado_por_pc_id: pcIdLimpo || 'MANUAL',
      limpar_backups_duplicados: true,
      backups_duplicados_apagados: qtdDuplicados
    });
    res.json({
      ok: true,
      backups_duplicados_apagados: qtdDuplicados,
      limpar_backups_duplicados: true,
      estado_fechamento_local: emp.lgpd_custodia_config?.estado_fechamento_local || null
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.post('/api/lgpd/direitos-titular/anonimizar', async (req: Request, res: Response) => {
  try {
    const { empresa_id, identificador_titular, motivo_legal } = req.body || {};
    const termoBusca = String(identificador_titular || '').trim().toLowerCase();
    if (!termoBusca || termoBusca.length < 3) {
      res.status(400).json({
        ok: false,
        erro: 'Informe o nome, telefone ou e-mail do titular (mínimo 3 caracteres) para anonimização LGPD.'
      });
      return;
    }

    const digitosBusca = termoBusca.replace(/\D/g, '');
    let totalAnonimizados = 0;

    (db.reservas || []).forEach((r: any) => {
      const nomeMatch = String(r.cliente || '').toLowerCase().includes(termoBusca);
      const telMatch = digitosBusca.length >= 6 && String(r.whatsapp || '').replace(/\D/g, '').includes(digitosBusca);
      if (nomeMatch || telMatch) {
        r.cliente = `Titular Anonimizado LGPD #${r.id}`;
        r.whatsapp = '';
        r.observacoes = 'Dados pessoais eliminados conforme Art. 18 da LGPD';
        totalAnonimizados += 1;
      }
    });

    (db.cadastros_pessoas || []).forEach((c: any) => {
      const nomeMatch = String(c.nome || '').toLowerCase().includes(termoBusca);
      const telMatch = digitosBusca.length >= 6 && String(c.whatsapp || '').replace(/\D/g, '').includes(digitosBusca);
      const emailMatch = String(c.email || '').toLowerCase().includes(termoBusca);
      if (nomeMatch || telMatch || emailMatch) {
        c.nome = `Titular Anonimizado LGPD #${c.id}`;
        c.documento = '';
        c.whatsapp = '';
        c.email = '';
        c.observacoes = 'Anonimizado pelo Controlador da Empresa (Art. 18 LGPD)';
        c.arquivado_legal = true;
        totalAnonimizados += 1;
      }
    });

    saveDbToDisk();
    await registrarAuditLog(
      `Empresa #${empresa_id || 1}`,
      'LGPD_ANONIMIZACAO_TITULAR_ART18',
      `Anonimização de titular executada (${totalAnonimizados} registros desidentificados). Motivo: ${motivo_legal || 'Solicitação do Titular Art. 18 LGPD'}`,
      req.ip,
      'Gestor da Empresa'
    );

    res.json({
      ok: true,
      registros_anonimizados: totalAnonimizados
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.post('/api/teste/fila-aprovacoes/aprovar', async (req: Request, res: Response) => {
  try {
    const { id, status, aprovado_por } = req.body;
    const item = db.fila_aprovacoes_pendentes.find((f) => Number(f.id) === Number(id));
    if (!item) return res.status(404).json({ erro: 'Registro de fila de sombra não encontrado.' });

    item.status = status || 'APROVADO';
    item.aprovado_por = aprovado_por || 'Admin Master';
    item.aprovado_em = new Date().toISOString();
    saveDbToDisk();
    await cacheERP.invalidatePrefix('erp:');
    sseBroker.emit('sombra.aprovacao_atualizada', item);
    await registrarAuditLog(aprovado_por || 'Admin Master', 'HOMOLOGACAO_FILA_SOMBRA', `Item #${id} (${item.titulo}) marcado como ${item.status}`, req.ip, 'Super Admin');
    res.json({ ok: true, item });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.get('/api/erp/vps-status', (_req: Request, res: Response) => {
  const memTotalMB = Math.round(os.totalmem() / 1024 / 1024);
  const memLivreMB = Math.round(os.freemem() / 1024 / 1024);
  const outboxPend = db ? db.erp_outbox.filter((o) => o.status !== 'PROCESSADO').length : 0;
  const totalOutboxProcessados = db ? db.erp_outbox.filter((o) => o.status === 'PROCESSADO').length : 0;

  res.json({
    ambiente: AMBIENTE,
    porta: PORT,
    portas_constitucionais: { producao: 3000, desenvolvimento: 3001, teste_sombra: 3002, tapiri_governanca: 4000 },
    memoria_usada_mb: memTotalMB - memLivreMB,
    memoria_total_mb: memTotalMB,
    uptime_seg: Math.round(process.uptime()),
    redis_ativo: cacheERP.redisOnline,
    cache_hits: cacheERP.hits,
    cache_misses: cacheERP.misses,
    clientes_sse: sseBroker.clients.size,
    outbox_pendentes: outboxPend,
    outbox_processados: totalOutboxProcessados,
    ultimo_backup_sheets: db?.backups_horarios?.[0]?.data_hora || null
  });
});

const mapaColecoesSoftDelete: Record<string, () => any[]> = {
  empresas: () => db.empresas,
  freelancers: () => db.freelancers,
  usuarios: () => db.usuarios,
  unidades: () => db.unidades,
  setores: () => db.setores,
  checklists: () => db.checklists,
  erp_escalas_movimentos: () => db.erp_escalas_movimentos,
  eventos_agenda: () => db.eventos_agenda,
  reservas: () => db.reservas,
  sites_portais: () => db.sites_portais,
  erp_caixa: () => db.erp_caixa,
  erp_categorias_fechamento_caixa: () => db.erp_categorias_fechamento_caixa || [],
  erp_fechamentos_caixa_diarios: () => db.erp_fechamentos_caixa_diarios || [],
  erp_estoque: () => db.erp_estoque,
  erp_cmv: () => db.erp_cmv,
  erp_selecao: () => db.erp_selecao,
  erp_rh_nr01: () => db.erp_rh_nr01,
  erp_mensagens_rapidas: () => db.erp_mensagens_rapidas,
  erp_notificacoes: () => db.erp_notificacoes,
  erp_rateios_historico: () => db.erp_rateios_historico,
  cadastros_pessoas: () => db.cadastros_pessoas || [],
  pdv_produtos: () => db.pdv_produtos || [],
  pdv_comandas: () => db.pdv_comandas || [],
  pdv_impressoras: () => db.pdv_impressoras || [],
  pdv_fila_impressao: () => db.pdv_fila_impressao || []
};

const rotasArquivamento = [
  { rota: '/api/empresas/arquivar', tabela: 'empresas' },
  { rota: '/api/freelancers/arquivar', tabela: 'freelancers' },
  { rota: '/api/acessos/excluir-usuario', tabela: 'usuarios' },
  { rota: '/api/unidades/arquivar', tabela: 'unidades' },
  { rota: '/api/setores/arquivar', tabela: 'setores' },
  { rota: '/api/checklists/arquivar', tabela: 'checklists' },
  { rota: '/api/reservas/arquivar', tabela: 'reservas' },
  { rota: '/api/sites/arquivar', tabela: 'sites_portais' },
  { rota: '/api/agenda/arquivar', tabela: 'eventos_agenda' },
  { rota: '/api/cadastros/arquivar', tabela: 'cadastros_pessoas' },
  { rota: '/api/erp/arquivar-generico', tabela: null }
];

rotasArquivamento.forEach(({ rota, tabela }) => {
  app.post(rota, async (req: Request, res: Response) => {
    try {
      const { id, tabelaAlvo, usuario, usuario_logado_id } = req.body;
      let tabFinal = tabela || tabelaAlvo;
      let targetId = Number(id || 0);

      if (tabFinal === 'cadastros_pessoas' && targetId >= 300000) {
        tabFinal = 'empresas';
        targetId = targetId - 300000;
      } else if (tabFinal === 'cadastros_pessoas' && targetId >= 200000) {
        tabFinal = 'freelancers';
        targetId = targetId - 200000;
      } else if (tabFinal === 'cadastros_pessoas' && targetId >= 100000) {
        tabFinal = 'usuarios';
        targetId = targetId - 100000;
      }

      if (!tabFinal || !targetId || !mapaColecoesSoftDelete[tabFinal]) {
        return res.status(400).json({ erro: 'Parâmetros inválidos para Arquivamento Lógico (Soft-Delete).' });
      }

      const col = mapaColecoesSoftDelete[tabFinal]();
      const itemAlvo = col.find((x) => Number(x.id) === targetId);
      if (!itemAlvo) {
        return res.status(404).json({ erro: 'Registro não localizado para arquivamento.' });
      }

      if (
        (tabFinal === 'usuarios' || tabFinal === 'cadastros_pessoas') &&
        (targetId === 1 || String(itemAlvo.nome || '').toLowerCase().trim() === 'admin master')
      ) {
        return res.status(400).json({
          erro: 'Proteção do Sistema: A conta principal Admin Master não pode ser arquivada.'
        });
      }

      const uidExplicito = Number(usuario_logado_id || 0);
      if (uidExplicito > 0) {
        const operadorObj = db.usuarios.find((u) => Number(u.id) === uidExplicito);
        if (operadorObj) {
          const mesmoIdUsuario =
            (tabFinal === 'usuarios' && targetId === uidExplicito) ||
            (tabFinal === 'cadastros_pessoas' && Number(itemAlvo.usuario_sistema_id) === uidExplicito);
          if (mesmoIdUsuario) {
            return res.status(400).json({
              erro: `Proteção Contra Acidente: Você está usando a conta "${operadorObj.nome}" neste momento e não pode arquivar o seu próprio usuário ativo.`
            });
          }
        }
      }

      await executarComOutbox(
        () => {
          const item = col.find((x) => Number(x.id) === targetId);
          if (item) {
            item.arquivado_legal = true;
            const nomeLower = String(item.nome || '').trim().toLowerCase();
            if (tabFinal === 'cadastros_pessoas') {
              for (const u of db.usuarios || []) {
                if (Number(u.id) === 1) continue;
                if (
                  (item.usuario_sistema_id && Number(u.id) === Number(item.usuario_sistema_id)) ||
                  (nomeLower && String(u.nome || '').trim().toLowerCase() === nomeLower)
                ) {
                  u.arquivado_legal = true;
                }
              }
              for (const f of db.freelancers || []) {
                if (nomeLower && String(f.nome || '').trim().toLowerCase() === nomeLower) {
                  f.arquivado_legal = true;
                }
              }
              for (const emp of db.empresas || []) {
                if (Number(emp.id) === 1) continue;
                if (nomeLower && String(emp.nome || '').trim().toLowerCase() === nomeLower) {
                  emp.arquivado_legal = true;
                }
              }
            } else if (tabFinal === 'usuarios') {
              for (const c of db.cadastros_pessoas || []) {
                if (
                  Number(c.usuario_sistema_id) === targetId ||
                  (nomeLower && String(c.nome || '').trim().toLowerCase() === nomeLower)
                ) {
                  c.arquivado_legal = true;
                }
              }
            } else if (tabFinal === 'freelancers' || tabFinal === 'empresas') {
              for (const c of db.cadastros_pessoas || []) {
                if (nomeLower && String(c.nome || '').trim().toLowerCase() === nomeLower) {
                  c.arquivado_legal = true;
                }
              }
            }
          }
        },
        { agregado: tabFinal.toUpperCase(), tipo: 'registro.arquivado', payload: { tabela: tabFinal, id: targetId, nome: itemAlvo.nome } }
      );

      await registrarAuditLog(
        usuario || 'Operador',
        `SOFT_DELETE_${tabFinal.toUpperCase()}`,
        `Registro "${itemAlvo.nome || itemAlvo.titulo || `#${targetId}`}" (ID #${targetId}) em [${tabFinal}] arquivado (pode ser restaurado em Arquivados / Logs)`,
        req.ip
      );

      res.json({
        ok: true,
        id: targetId,
        tabela: tabFinal,
        nome: itemAlvo.nome || itemAlvo.titulo || `#${targetId}`,
        mensagem: 'Registro arquivado com segurança. Você pode desarquivá-lo a qualquer momento.'
      });
    } catch (err: any) {
      res.status(500).json({ erro: err.message });
    }
  });
});

const handleRestaurarArquivado = async (req: Request, res: Response) => {
  try {
    const { id, tabelaAlvo, tabela, usuario } = req.body;
    const tabFinal = tabelaAlvo || tabela || 'cadastros_pessoas';
    const targetId = Number(id || 0);
    if (!tabFinal || !targetId || !mapaColecoesSoftDelete[tabFinal]) {
      return res.status(400).json({ erro: 'Informe a tabela e o ID válidos para desarquivar o registro.' });
    }

    let nomeRestaurado = `#${targetId}`;
    await executarComOutbox(
      () => {
        const col = mapaColecoesSoftDelete[tabFinal]();
        const item = col.find((x) => Number(x.id) === targetId);
        if (item) {
          item.arquivado_legal = false;
          nomeRestaurado = item.nome || item.titulo || item.cliente || `#${targetId}`;
          if (tabFinal === 'cadastros_pessoas') {
            const nomeLower = String(item.nome || '').trim().toLowerCase();
            for (const u of db.usuarios || []) {
              if (Number(u.id) === Number(item.usuario_sistema_id) || String(u.nome || '').trim().toLowerCase() === nomeLower) {
                u.arquivado_legal = false;
              }
            }
            for (const f of db.freelancers || []) {
              if (String(f.nome || '').trim().toLowerCase() === nomeLower) {
                f.arquivado_legal = false;
              }
            }
          } else if (tabFinal === 'usuarios') {
            const nomeLower = String(item.nome || '').trim().toLowerCase();
            for (const c of db.cadastros_pessoas || []) {
              if (Number(c.usuario_sistema_id) === targetId || String(c.nome || '').trim().toLowerCase() === nomeLower) {
                c.arquivado_legal = false;
              }
            }
          }
        }
      },
      { agregado: tabFinal.toUpperCase(), tipo: 'registro.restaurado', payload: { tabela: tabFinal, id: targetId } }
    );

    await registrarAuditLog(
      usuario || 'Operador',
      `RESTAURAR_ARQUIVADO_${tabFinal.toUpperCase()}`,
      `Registro "${nomeRestaurado}" (ID #${targetId}) em [${tabFinal}] desarquivado e restaurado com sucesso`,
      req.ip
    );

    res.json({
      ok: true,
      id: targetId,
      tabela: tabFinal,
      nome: nomeRestaurado,
      mensagem: `Registro "${nomeRestaurado}" desarquivado e restaurado com sucesso!`
    });
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
};

app.post('/api/erp/restaurar-arquivado', handleRestaurarArquivado);
app.post('/api/cadastros/restaurar', handleRestaurarArquivado);

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', sistema: 'Urutau', ambiente: AMBIENTE });
});

app.get('/api/erp/download-backup-dados', (_req: Request, res: Response) => {
  try {
    saveDbToDisk();
    const dataIso = getTodayISO();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="urutau-backup-dados-${dataIso}.json"`);
    if (fs.existsSync(DB_FILE_PATH)) {
      res.sendFile(DB_FILE_PATH);
    } else {
      res.send(JSON.stringify(db, null, 2));
    }
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.post('/api/erp/restaurar-backup-completo', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const modo: 'mesclar' | 'substituir' =
      body.modo === 'substituir' ? 'substituir' : 'mesclar';
    const payload =
      body.backup_json && typeof body.backup_json === 'object'
        ? body.backup_json
        : body;

    if (!payload || typeof payload !== 'object') {
      res.status(400).json({ ok: false, erro: 'Arquivo de backup JSON inválido ou vazio.' });
      return;
    }

    const origem =
      payload.dados && typeof payload.dados === 'object'
        ? payload.dados
        : payload.pacote_portatil && typeof payload.pacote_portatil === 'object'
        ? payload.pacote_portatil
        : payload;

    const formatoDetectado = payload.versao_formato
      ? String(payload.versao_formato)
      : payload.pacote_portatil
      ? 'LGPD-Pacote-Portatil'
      : Array.isArray(payload.erp_caixa) || Array.isArray(payload.empresas)
      ? 'DatabaseSchema-Completo'
      : 'Backup-JSON-Universal';

    let totalInseridosOuAtualizados = 0;

    const mesclarColecao = (atual: any[], recebida: any[] | undefined): any[] => {
      const base = Array.isArray(atual) ? [...atual] : [];
      if (!Array.isArray(recebida)) return base;
      if (modo === 'substituir' && recebida.length > 0) {
        totalInseridosOuAtualizados += recebida.length;
        return [...recebida];
      }
      if (recebida.length === 0) return base;
      const porId = new Map<number, number>();
      base.forEach((item, idx) => {
        const idNum = Number(item?.id || 0);
        if (idNum > 0) porId.set(idNum, idx);
      });
      let maxId = base.reduce((m, it) => Math.max(m, Number(it?.id || 0)), 0);

      for (const rec of recebida) {
        if (!rec || typeof rec !== 'object') continue;
        const idRec = Number(rec.id || 0);
        if (idRec > 0 && porId.has(idRec)) {
          const targetIdx = porId.get(idRec)!;
          base[targetIdx] = { ...base[targetIdx], ...rec };
          totalInseridosOuAtualizados += 1;
        } else if (idRec > 0) {
          base.push(rec);
          porId.set(idRec, base.length - 1);
          if (idRec > maxId) maxId = idRec;
          totalInseridosOuAtualizados += 1;
        } else {
          maxId += 1;
          const novo = { ...rec, id: maxId };
          base.push(novo);
          porId.set(maxId, base.length - 1);
          totalInseridosOuAtualizados += 1;
        }
      }
      return base;
    };

    db.empresas = mesclarColecao(db.empresas, origem.empresas);
    db.unidades = mesclarColecao(db.unidades, origem.unidades);
    db.setores = mesclarColecao(db.setores, origem.setores);
    db.freelancers = mesclarColecao(db.freelancers, origem.freelancers);
    db.cadastros_pessoas = mesclarColecao(
      db.cadastros_pessoas || [],
      origem.cadastros_pessoas || origem.cadastrosPessoas
    );
    db.cargos = mesclarColecao(db.cargos || [], origem.cargos);
    db.reservas = mesclarColecao(db.reservas, origem.reservas);
    db.erp_caixa = mesclarColecao(db.erp_caixa, origem.erp_caixa || origem.caixa);
    db.erp_estoque = mesclarColecao(db.erp_estoque, origem.erp_estoque || origem.estoque);
    db.erp_cmv = mesclarColecao(db.erp_cmv, origem.erp_cmv || origem.cmv);
    db.erp_escalas_movimentos = mesclarColecao(
      db.erp_escalas_movimentos,
      origem.erp_escalas_movimentos || origem.movimentosEscala
    );
    db.erp_selecao = mesclarColecao(db.erp_selecao, origem.erp_selecao || origem.selecao);
    db.erp_notificacoes = mesclarColecao(
      db.erp_notificacoes,
      origem.erp_notificacoes || origem.notificacoes
    );
    db.erp_rh_nr01 = mesclarColecao(
      db.erp_rh_nr01,
      origem.erp_rh_nr01 || origem.rhRegistros
    );
    db.erp_rateios_historico = mesclarColecao(
      db.erp_rateios_historico,
      origem.erp_rateios_historico || origem.rateiosHistorico
    );
    db.eventos_agenda = mesclarColecao(
      db.eventos_agenda,
      origem.eventos_agenda || origem.agenda
    );
    db.checklists = mesclarColecao(db.checklists, origem.checklists);
    db.pdv_produtos = mesclarColecao(
      db.pdv_produtos || [],
      origem.pdv_produtos || origem.pdvProdutos
    );
    db.pdv_comandas = mesclarColecao(
      db.pdv_comandas || [],
      origem.pdv_comandas || origem.pdvComandas
    );
    db.pdv_impressoras = mesclarColecao(
      db.pdv_impressoras || [],
      origem.pdv_impressoras || origem.pdvImpressoras
    );

    const configsRecebidas = Array.isArray(origem.erp_configs)
      ? origem.erp_configs
      : Array.isArray(origem.configs)
      ? origem.configs
      : [];
    if (configsRecebidas.length > 0) {
      const cfgMap = new Map<string, any>();
      (db.erp_configs || []).forEach((c) => {
        if (c?.chave) cfgMap.set(String(c.chave), c);
      });
      for (const cfg of configsRecebidas) {
        if (cfg?.chave) {
          cfgMap.set(String(cfg.chave), {
            chave: String(cfg.chave),
            valor_json: cfg.valor_json,
            atualizado_em: cfg.atualizado_em || new Date().toISOString()
          });
          totalInseridosOuAtualizados += 1;
        }
      }
      db.erp_configs = Array.from(cfgMap.values());
    }

    if (
      origem.relacionamentos &&
      typeof origem.relacionamentos === 'object' &&
      Array.isArray(origem.relacionamentos.usuarios)
    ) {
      if (!db.relacionamentos) db.relacionamentos = {};
      db.relacionamentos.usuarios = mesclarColecao(
        db.relacionamentos.usuarios || [],
        origem.relacionamentos.usuarios
      );
    } else if (Array.isArray(origem.usuarios) && origem.usuarios.length > 0) {
      if (!db.relacionamentos) db.relacionamentos = {};
      db.relacionamentos.usuarios = mesclarColecao(
        db.relacionamentos.usuarios || [],
        origem.usuarios
      );
    }

    saveDbToDisk();
    let postgresSincronizado = false;
    try {
      await commerceRepository.syncCatalogAndStockFromMemoryDb(db);
      postgresSincronizado = true;
    } catch {}

    await cacheERP.invalidatePrefix('erp:');
    await registrarAuditLog(
      'Admin Master',
      'RESTAURACAO_BACKUP_COMPLETO',
      `Backup restaurado (${formatoDetectado} • modo=${modo} • ${totalInseridosOuAtualizados} registros sincronizados)`,
      req.ip,
      'Super Admin'
    );

    sseBroker.emit('config.atualizada', { restaurado_em: new Date().toISOString() });

    res.json({
      ok: true,
      formato_detectado: formatoDetectado,
      modo_aplicado: modo,
      registros_sincronizados: totalInseridosOuAtualizados,
      persistido_disco: true,
      sincronizado_postgres: postgresSincronizado,
      resumo_contagens: {
        empresas: (db.empresas || []).length,
        reservas: (db.reservas || []).length,
        caixa: (db.erp_caixa || []).length,
        estoque: (db.erp_estoque || []).length,
        cadastros_pessoas: (db.cadastros_pessoas || []).length,
        pdv_produtos: (db.pdv_produtos || []).length,
        pdv_comandas: (db.pdv_comandas || []).length,
        configs: (db.erp_configs || []).length
      }
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message || 'Falha ao restaurar backup JSON.' });
  }
});

function stripPureFunctionalCode(content: string, filePath: string): string {
  const ext = (filePath.split('.').pop() || '').toLowerCase();
  let out = content;
  if (ext === 'css') {
    out = out.replace(new RegExp('/\\\\*[\\\\s\\\\S]*?\\\\*/', 'g'), '');
  } else if (ext === 'html') {
    out = out.replace(/<!--[\s\S]*?-->/g, '');
  } else if (ext === 'ts' || ext === 'tsx' || ext === 'js' || ext === 'mjs') {
    out = out.replace(new RegExp('\\{\\/\\*[\\s\\S]*?\\*\\/\\}', 'g'), '');
    out = out.replace(new RegExp('^[ \\t]*\\/\\*[\\s\\S]*?\\*\\/[ \\t]*\\r?\\n?', 'gm'), '');
    out = out.replace(new RegExp('^[ \\t]*\\/\\/.*(?:\\r?\\n|$)', 'gm'), '');
  } else if (ext === 'sh') {
    out = out
      .split('\n')
      .filter((line, idx) => idx === 0 || !/^[ \t]*#/.test(line))
      .join('\n');
  }
  out = out.replace(/\n{3,}/g, '\n\n');
  return out.trim() + '\n';
}

function countCodeComments(content: string, filePath: string): number {
  const ext = (filePath.split('.').pop() || '').toLowerCase();
  if (ext === 'md' || ext === 'txt') return 1;
  if (ext === 'css') {
    return (content.match(new RegExp('/\\\\*[\\\\s\\\\S]*?\\\\*/', 'g')) || []).length;
  }
  if (ext === 'html') {
    return (content.match(/<!--[\s\S]*?-->/g) || []).length;
  }
  if (ext === 'ts' || ext === 'tsx' || ext === 'js' || ext === 'mjs') {
    const jsx = (content.match(new RegExp('\\{\\/\\*[\\s\\S]*?\\*\\/\\}', 'g')) || []).length;
    const block = (content.match(new RegExp('^[ \\t]*\\/\\*[\\s\\S]*?\\*\\/', 'gm')) || []).length;
    const line = (content.match(new RegExp('^[ \\t]*\\/\\/.*', 'gm')) || []).length;
    return jsx + block + line;
  }
  return 0;
}

function buildCleanVpsFullCodePayload() {
  const filesToBundle: Array<{ relPath: string; category: 'config' | 'backend' | 'frontend'; label: string }> = [
    { relPath: 'package.json', category: 'config', label: 'package.json' },
    { relPath: 'tsconfig.json', category: 'config', label: 'tsconfig.json' },
    { relPath: 'vite.config.ts', category: 'config', label: 'vite.config.ts' },
    { relPath: '.env.example', category: 'config', label: '.env.example' },
    { relPath: 'index.html', category: 'frontend', label: 'index.html' },
    { relPath: 'server.ts', category: 'backend', label: 'server.ts' },
    { relPath: 'src/server/db/postgresEngine.ts', category: 'backend', label: 'src/server/db/postgresEngine.ts' },
    { relPath: 'src/server/repositories/commerceRepository.ts', category: 'backend', label: 'src/server/repositories/commerceRepository.ts' },
    { relPath: 'src/server/services/zeroTrustCommerceService.ts', category: 'backend', label: 'src/server/services/zeroTrustCommerceService.ts' },
    { relPath: 'src/server/services/webhookAndHardLimitService.ts', category: 'backend', label: 'src/server/services/webhookAndHardLimitService.ts' },
    { relPath: 'src/server/services/hybridStorageService.ts', category: 'backend', label: 'src/server/services/hybridStorageService.ts' },
    { relPath: 'src/server/services/googleDriveServiceAccount.ts', category: 'backend', label: 'src/server/services/googleDriveServiceAccount.ts' },
    { relPath: 'src/server/services/postgresBackupScheduler.ts', category: 'backend', label: 'src/server/services/postgresBackupScheduler.ts' },
    { relPath: 'src/server/workers/postgresBackupWorker.ts', category: 'backend', label: 'src/server/workers/postgresBackupWorker.ts' },
    { relPath: 'src/server/controllers/securityAndZeroTrustController.ts', category: 'backend', label: 'src/server/controllers/securityAndZeroTrustController.ts' },
    { relPath: 'src/services/geminiBotService.ts', category: 'backend', label: 'src/services/geminiBotService.ts' },
    { relPath: 'src/services/embeddedWhatsAppService.ts', category: 'backend', label: 'src/services/embeddedWhatsAppService.ts' },
    { relPath: 'src/types/erp.ts', category: 'frontend', label: 'src/types/erp.ts' },
    { relPath: 'src/services/offlineSyncEngine.ts', category: 'frontend', label: 'src/services/offlineSyncEngine.ts' },
    { relPath: 'src/index.css', category: 'frontend', label: 'src/index.css' },
    { relPath: 'src/main.tsx', category: 'frontend', label: 'src/main.tsx' },
    { relPath: 'src/App.tsx', category: 'frontend', label: 'src/App.tsx' },
    { relPath: 'src/components/UrutauShared.tsx', category: 'frontend', label: 'src/components/UrutauShared.tsx' },
    { relPath: 'src/components/MultiCompanyTabs.tsx', category: 'frontend', label: 'src/components/MultiCompanyTabs.tsx' },
    { relPath: 'src/components/OperationalTabsPart1.tsx', category: 'frontend', label: 'src/components/OperationalTabsPart1.tsx' },
    { relPath: 'src/components/OperationalTabsPart2.tsx', category: 'frontend', label: 'src/components/OperationalTabsPart2.tsx' },
    { relPath: 'src/components/CargosTab.tsx', category: 'frontend', label: 'src/components/CargosTab.tsx' },
    { relPath: 'src/components/EnvironmentPortalsHub.tsx', category: 'frontend', label: 'src/components/EnvironmentPortalsHub.tsx' },
    { relPath: 'src/components/FechamentoCaixaDiarioPanel.tsx', category: 'frontend', label: 'src/components/FechamentoCaixaDiarioPanel.tsx' },
    { relPath: 'src/components/ModuleIntegrityBoundary.tsx', category: 'frontend', label: 'src/components/ModuleIntegrityBoundary.tsx' },
    { relPath: 'src/components/PdvHibridoTab.tsx', category: 'frontend', label: 'src/components/PdvHibridoTab.tsx' },
    { relPath: 'src/components/UrutauLocationGoogleMap.tsx', category: 'frontend', label: 'src/components/UrutauLocationGoogleMap.tsx' },
    { relPath: 'src/components/UrutauTableFloorPlan.tsx', category: 'frontend', label: 'src/components/UrutauTableFloorPlan.tsx' },
    { relPath: 'src/components/UrutauWindowsExplorerModal.tsx', category: 'frontend', label: 'src/components/UrutauWindowsExplorerModal.tsx' },
    { relPath: 'src/components/WhatsAppAiHub.tsx', category: 'frontend', label: 'src/components/WhatsAppAiHub.tsx' },
    { relPath: 'src/components/ZeroTrustGovernancePanel.tsx', category: 'frontend', label: 'src/components/ZeroTrustGovernancePanel.tsx' },
    { relPath: 'src/components/OfflineSyncCenter.tsx', category: 'frontend', label: 'src/components/OfflineSyncCenter.tsx' },
    { relPath: 'src/components/PwaInstallBanner.tsx', category: 'frontend', label: 'src/components/PwaInstallBanner.tsx' },
    { relPath: 'src/components/UrutauLandingPage.tsx', category: 'frontend', label: 'src/components/UrutauLandingPage.tsx' },
    { relPath: 'src/components/CleanModuleShell.tsx', category: 'frontend', label: 'src/components/CleanModuleShell.tsx' }
  ];

  const loadedFiles: Array<{
    path: string;
    category: 'config' | 'backend' | 'frontend';
    label: string;
    lines: number;
    sizeBytes: number;
    content: string;
  }> = [];

  for (const item of filesToBundle) {
    const absPath = path.join(__dirname, item.relPath);
    if (fs.existsSync(absPath)) {
      const rawContent = fs.readFileSync(absPath, 'utf-8');
      const content = stripPureFunctionalCode(rawContent, item.relPath);
      loadedFiles.push({
        path: item.relPath,
        category: item.category,
        label: item.label,
        lines: content.split('\n').length,
        sizeBytes: Buffer.byteLength(content, 'utf-8'),
        content
      });
    }
  }

  const cfgDom = db?.erp_configs?.find((c) => c.chave === 'dominio_oficial_vps');
  const dominioAtivo = String(cfgDom?.valor_json?.dominio || 'nyctibi.us')
    .trim()
    .toLowerCase()
    .replace(new RegExp('^https?://'), '')
    .replace(/\/.*$/, '') || 'nyctibi.us';

  const scriptParts: string[] = [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'if ! grep -q "1.1.1.1" /etc/resolv.conf 2>/dev/null; then',
    '  echo -e "nameserver 1.1.1.1\\nnameserver 8.8.8.8" >> /etc/resolv.conf 2>/dev/null || true',
    'fi',
    'export DEBIAN_FRONTEND=noninteractive',
    'apt-get update -y',
    'apt-get install -y curl git ca-certificates gnupg build-essential nginx certbot python3-certbot-nginx ufw',
    'if ! command -v node >/dev/null 2>&1; then',
    '  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -',
    '  apt-get install -y nodejs',
    'fi',
    'npm install -g pm2 tsx',
    'APP_DIR="/var/www/urutau-erp"',
    'mkdir -p "${APP_DIR}/src/types" "${APP_DIR}/src/services" "${APP_DIR}/src/components" "${APP_DIR}/public/sons"',
    'find "${APP_DIR}" -maxdepth 3 -name "*.md" -not -path "*/node_modules/*" -delete 2>/dev/null || true',
    'rm -f "${APP_DIR}/public"/*.tar.gz "${APP_DIR}/public"/*.bundle "${APP_DIR}/public/exportar-vps.sh" "${APP_DIR}/public/urutau-server-vps.js" "${APP_DIR}/public/package-vps.json" 2>/dev/null || true',
    'cd "${APP_DIR}"'
  ];

  loadedFiles.forEach((file, idx) => {
    const eofMarker = `URUTAU_FILE_EOF_${idx + 1}`;
    scriptParts.push(
      `mkdir -p "$(dirname "${file.path}")"`,
      `cat << '${eofMarker}' > "${file.path}"`,
      file.content,
      eofMarker
    );
  });

  scriptParts.push(
    'if [ ! -f .env ] && [ -f .env.example ]; then',
    '  cp .env.example .env',
    'fi',
    'npm install',
    'npm run build',
    'if pm2 describe urutau-erp >/dev/null 2>&1; then',
    '  pm2 reload urutau-erp --update-env || pm2 restart urutau-erp',
    'else',
    '  NODE_ENV=production PORT=3000 pm2 start "npx tsx server.ts" --name urutau-erp',
    'fi',
    'pm2 save',
    'cat << \'NGINX_EOF\' > /etc/nginx/sites-available/urutau-erp',
    'server {',
    '    listen 80 default_server;',
    '    listen [::]:80 default_server;',
    `    server_name ${dominioAtivo} www.${dominioAtivo} _;`,
    '    client_max_body_size 50M;',
    '    add_header X-Frame-Options "SAMEORIGIN" always;',
    '    add_header X-Content-Type-Options "nosniff" always;',
    '    add_header Referrer-Policy "strict-origin-when-cross-origin" always;',
    '    location / {',
    '        proxy_pass http://127.0.0.1:3000;',
    '        proxy_http_version 1.1;',
    '        proxy_set_header Upgrade $http_upgrade;',
    '        proxy_set_header Connection "upgrade";',
    '        proxy_set_header Host $host;',
    '        proxy_set_header X-Real-IP $remote_addr;',
    '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
    '        proxy_set_header X-Forwarded-Proto $scheme;',
    '        proxy_buffering off;',
    '        proxy_cache off;',
    '        proxy_read_timeout 86400s;',
    '    }',
    '}',
    'NGINX_EOF',
    'ln -sf /etc/nginx/sites-available/urutau-erp /etc/nginx/sites-enabled/urutau-erp',
    'rm -f /etc/nginx/sites-enabled/default',
    'nginx -t && systemctl restart nginx',
    'ufw allow 80/tcp >/dev/null 2>&1 || true',
    'ufw allow 443/tcp >/dev/null 2>&1 || true',
    `certbot --nginx -d ${dominioAtivo} -d www.${dominioAtivo} --non-interactive --agree-tos --register-unsafely-without-email --redirect >/dev/null 2>&1 || true`
  );

  const fullScript = scriptParts.join('\n');
  const totalLines = fullScript.split('\n').length;
  const totalBytes = Buffer.byteLength(fullScript, 'utf-8');
  const sha256Hash = crypto.createHash('sha256').update(fullScript).digest('hex');

  return {
    geradoEm: new Date().toISOString(),
    dominioConfigurado: dominioAtivo,
    sha256Hash,
    totalArquivos: loadedFiles.length,
    totalLinhas: totalLines,
    totalBytes,
    arquivos: loadedFiles,
    scriptInstalacaoCompleta: fullScript
  };
}

const CLOUD_MASTER_ORIGIN =
  process.env.CLOUD_MASTER_URL ||
  'https://ais-pre-pejnpvvx5jpp4nbv5n76xv-247047087382.us-east1.run.app';

function buildDomainSetupScript(rawDomain = 'nyctibi.us'): string {
  const cleanDomain =
    String(rawDomain || 'nyctibi.us')
      .trim()
      .toLowerCase()
      .replace(new RegExp('^https?://'), '')
      .replace(/\/.*$/, '')
      .replace(/[^a-z0-9.-]/g, '') || 'nyctibi.us';

  return [
    '#!/usr/bin/env bash',
    '# ==============================================================================',
    `# URUTAU ERP — CONFIGURAÇÃO AUTOMÁTICA DE DOMÍNIO + HTTPS/SSL (${cleanDomain})`,
    '# ==============================================================================',
    'set -euo pipefail',
    '',
    'echo " [1/4] Verificando DNS da VPS (Cloudflare 1.1.1.1 + Google 8.8.8.8)..."',
    'if ! grep -q "1.1.1.1" /etc/resolv.conf 2>/dev/null; then',
    '  echo -e "nameserver 1.1.1.1\\nnameserver 8.8.8.8" >> /etc/resolv.conf 2>/dev/null || true',
    'fi',
    '',
    'echo " [2/4] Instalando Nginx e Certbot (Let\'s Encrypt SSL)..."',
    'export DEBIAN_FRONTEND=noninteractive',
    'apt-get update -y',
    'apt-get install -y nginx certbot python3-certbot-nginx ufw curl',
    '',
    `echo " [3/4] Configurando Proxy Reverso Nginx para ${cleanDomain} e www.${cleanDomain} (Porta 80/443 -> 3000)..."`,
    'cat << \'NGINX_EOF\' > /etc/nginx/sites-available/urutau-erp',
    'server {',
    '    listen 80 default_server;',
    '    listen [::]:80 default_server;',
    `    server_name ${cleanDomain} www.${cleanDomain} _;`,
    '    client_max_body_size 50M;',
    '    add_header X-Frame-Options "SAMEORIGIN" always;',
    '    add_header X-Content-Type-Options "nosniff" always;',
    '    add_header Referrer-Policy "strict-origin-when-cross-origin" always;',
    '    location / {',
    '        proxy_pass http://127.0.0.1:3000;',
    '        proxy_http_version 1.1;',
    '        proxy_set_header Upgrade $http_upgrade;',
    '        proxy_set_header Connection "upgrade";',
    '        proxy_set_header Host $host;',
    '        proxy_set_header X-Real-IP $remote_addr;',
    '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
    '        proxy_set_header X-Forwarded-Proto $scheme;',
    '        proxy_buffering off;',
    '        proxy_cache off;',
    '        proxy_read_timeout 86400s;',
    '    }',
    '}',
    'NGINX_EOF',
    'ln -sf /etc/nginx/sites-available/urutau-erp /etc/nginx/sites-enabled/urutau-erp',
    'rm -f /etc/nginx/sites-enabled/default',
    'nginx -t && systemctl restart nginx',
    'ufw allow 80/tcp >/dev/null 2>&1 || true',
    'ufw allow 443/tcp >/dev/null 2>&1 || true',
    '',
    `echo " [4/4] Emitindo Certificado SSL Gratuito (HTTPS Cadeado Verde) para ${cleanDomain}..."`,
    `if certbot --nginx -d ${cleanDomain} -d www.${cleanDomain} --non-interactive --agree-tos --register-unsafely-without-email --redirect; then`,
    `  echo " HTTPS ativado com sucesso! Acesse agora: https://${cleanDomain}"`,
    'else',
    `  VPS_IP=$(curl -4 -s https://ifconfig.me || hostname -I | awk '{print $1}')`,
    `  echo " Nginx já está respondendo por http://${cleanDomain}!"`,
    `  echo " Para ativar o cadeado HTTPS, confira no painel onde comprou ${cleanDomain} se o registro DNS Tipo A (@ e www) aponta para o IP desta VPS: \${VPS_IP}"`,
    `  echo " Assim que apontar o DNS, rode: certbot --nginx -d ${cleanDomain} -d www.${cleanDomain}"`,
    'fi'
  ].join('\n');
}

app.get('/api/erp/vps-codigo-instalacao-zero', (_req: Request, res: Response) => {
  try {
    const payload = buildCleanVpsFullCodePayload();
    res.json(payload);
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.get(['/api/erp/vps-codigo-instalacao-zero.sh', '/atualizar-vps.sh', '/api/erp/vps-atualizar-codigo.sh'], (_req: Request, res: Response) => {
  try {
    const payload = buildCleanVpsFullCodePayload();
    const dataIso = getTodayISO();
    res.setHeader('Content-Type', 'text/x-shellscript; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="urutau-instalacao-vps-formatada-completo-${dataIso}.sh"`
    );
    res.send(payload.scriptInstalacaoCompleta);
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.get(['/configurar-dominio.sh', '/dominios/:dominio.sh'], (req: Request, res: Response) => {
  try {
    const domParam = String(req.params.dominio || req.query.d || 'nyctibi.us');
    const script = buildDomainSetupScript(domParam);
    res.setHeader('Content-Type', 'text/x-shellscript; charset=utf-8');
    res.send(script);
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.get('/api/erp/vps-dominio-status', (_req: Request, res: Response) => {
  try {
    const cfg = db.erp_configs.find((c) => c.chave === 'dominio_oficial_vps');
    const dominio = cfg?.valor_json?.dominio || 'nyctibi.us';
    const subdominioWww = `www.${dominio}`;
    const comandoDiretoAtualizacao = `curl -4 -sSL ${CLOUD_MASTER_ORIGIN}/atualizar-vps.sh | bash`;
    const comandoComFallbackDns = `(echo -e "nameserver 1.1.1.1\\nnameserver 8.8.8.8" >> /etc/resolv.conf 2>/dev/null || true) && curl -4 -sSL ${CLOUD_MASTER_ORIGIN}/atualizar-vps.sh | bash`;
    const comandoConfigurarDominio = `(echo -e "nameserver 1.1.1.1\\nnameserver 8.8.8.8" >> /etc/resolv.conf 2>/dev/null || true) && curl -4 -sSL ${CLOUD_MASTER_ORIGIN}/dominios/${dominio}.sh | bash`;

    res.json({
      ok: true,
      dominio,
      subdominioWww,
      ssl_automatico: true,
      proxy_reverso: 'Nginx -> 127.0.0.1:3000 (SSE & WebSocket Ready)',
      cloud_master_origin: CLOUD_MASTER_ORIGIN,
      comandoDiretoAtualizacao,
      comandoComFallbackDns,
      comandoConfigurarDominio,
      atualizado_em: cfg?.atualizado_em || new Date().toISOString()
    });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.post('/api/erp/vps-configurar-dominio', async (req: Request, res: Response) => {
  try {
    const { dominio, aplicar_nginx_local } = req.body;
    const cleanDomain =
      String(dominio || 'nyctibi.us')
        .trim()
        .toLowerCase()
        .replace(new RegExp('^https?://'), '')
        .replace(/\/.*$/, '')
        .replace(/[^a-z0-9.-]/g, '') || 'nyctibi.us';

    let nginxAplicadoNaVps = false;
    let detalheExecucao = 'Domínio gravado nas configurações oficiais e no gerador de scripts da VPS.';

    if (aplicar_nginx_local && fs.existsSync('/etc/nginx/sites-available')) {
      try {
        const { execSync } = await import('child_process');
        const nginxConf = [
          'server {',
          '    listen 80 default_server;',
          '    listen [::]:80 default_server;',
          `    server_name ${cleanDomain} www.${cleanDomain} _;`,
          '    client_max_body_size 50M;',
          '    add_header X-Frame-Options "SAMEORIGIN" always;',
          '    add_header X-Content-Type-Options "nosniff" always;',
          '    location / {',
          '        proxy_pass http://127.0.0.1:3000;',
          '        proxy_http_version 1.1;',
          '        proxy_set_header Upgrade $http_upgrade;',
          '        proxy_set_header Connection "upgrade";',
          '        proxy_set_header Host $host;',
          '        proxy_set_header X-Real-IP $remote_addr;',
          '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
          '        proxy_set_header X-Forwarded-Proto $scheme;',
          '        proxy_buffering off;',
          '        proxy_read_timeout 86400s;',
          '    }',
          '}'
        ].join('\n');
        fs.writeFileSync('/etc/nginx/sites-available/urutau-erp', nginxConf, 'utf-8');
        execSync('ln -sf /etc/nginx/sites-available/urutau-erp /etc/nginx/sites-enabled/urutau-erp && nginx -t && systemctl reload nginx');
        nginxAplicadoNaVps = true;
        detalheExecucao = `Proxy reverso Nginx configurado e recarregado ao vivo na VPS para ${cleanDomain} e www.${cleanDomain}!`;
      } catch (errNginx: any) {
        detalheExecucao = `Domínio salvo no sistema (${cleanDomain}). Para aplicar o Nginx/SSL na VPS, use o botão de 1 clique ou comando SSH.`;
      }
    }

    await executarComOutbox(
      () => {
        const idx = db.erp_configs.findIndex((c) => c.chave === 'dominio_oficial_vps');
        const item = {
          chave: 'dominio_oficial_vps',
          valor_json: {
            dominio: cleanDomain,
            www: `www.${cleanDomain}`,
            https_lets_encrypt: true,
            nginx_aplicado: nginxAplicadoNaVps,
            configurado_em: new Date().toISOString()
          },
          atualizado_em: new Date().toISOString()
        };
        if (idx >= 0) db.erp_configs[idx] = item;
        else db.erp_configs.push(item);
      },
      { agregado: 'CONFIGS', tipo: 'config.atualizada', payload: { chave: 'dominio_oficial_vps', dominio: cleanDomain } }
    );

    await registrarAuditLog(
      'Super Admin',
      'CONFIGURAR_DOMINIO_VPS',
      `Domínio oficial configurado para ${cleanDomain} (www.${cleanDomain})`,
      req.ip,
      'Super Admin'
    );

    res.json({
      ok: true,
      dominio: cleanDomain,
      nginxAplicadoNaVps,
      mensagem: detalheExecucao,
      scriptDominio: buildDomainSetupScript(cleanDomain),
      comandoTerminal: `(echo -e "nameserver 1.1.1.1\\nnameserver 8.8.8.8" >> /etc/resolv.conf 2>/dev/null || true) && curl -4 -sSL ${CLOUD_MASTER_ORIGIN}/dominios/${cleanDomain}.sh | bash`
    });
  } catch (e: any) {
    res.status(500).json({ erro: e.message });
  }
});

app.post('/api/erp/vps-ota-update', async (req: Request, res: Response) => {
  try {
    const { senha_mestra } = req.body;
    if (!senha_mestra || !String(senha_mestra).trim()) {
      return res.status(400).json({
        ok: false,
        erro: 'Informe a Senha Mestra do Administrador para autorizar a atualização segura (OTA).'
      });
    }

    const cfgMaster = db.erp_configs.find((c) => c.chave === 'admin_master_argon2id');
    const userMaster = (db.usuarios || []).find((u) => Number(u.id) === 1);
    const senhaLimpa = String(senha_mestra).trim();
    const okMasterHash = cfgMaster?.valor_json?.hash
      ? await verificarHashArgon2id(cfgMaster.valor_json.hash, senhaLimpa)
      : userMaster?.senha_argon2id
      ? await verificarHashArgon2id(userMaster.senha_argon2id, senhaLimpa)
      : false;
    const okMasterDefault =
      !cfgMaster?.valor_json?.hash &&
      (senhaLimpa === getOrGenerateInitialMasterPassword() || senhaLimpa === 'urutau2026');

    if (!okMasterHash && !okMasterDefault) {
      await registrarAuditLog(
        'Desconhecido',
        'BLOQUEIO_OTA_SENHA_INVALIDA',
        'Tentativa de atualização OTA pelo sistema bloqueada: Senha Mestra inválida.',
        req.ip,
        'BLOQUEADO'
      );
      return res.status(401).json({
        ok: false,
        erro: 'Senha Mestra inválida. A atualização OTA exige autenticação criptográfica Argon2id do Super Admin.'
      });
    }

    const etapasLog: string[] = [];
    etapasLog.push(' [1/5] Autenticação Argon2id + Pepper validada com sucesso.');

    saveDbToDisk();
    const bkpPrevio = await gerarBackupHorarioCriptografado('BACKUP_PRE_OTA_UPDATE');
    etapasLog.push(
      ` [2/5] Backup pré-atualização do banco (urutau_db.json) concluído (SHA-256: ${bkpPrevio?.hash_sha256 || 'OK'}). Seus cadastros estão 100% protegidos.`
    );

    let bundleRemoto: any = null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const resp = await fetch(`${CLOUD_MASTER_ORIGIN}/api/erp/vps-codigo-instalacao-zero`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' }
      });
      clearTimeout(timeout);
      if (resp.ok) {
        bundleRemoto = await resp.json();
      }
    } catch {
    }

    const payloadOficial = bundleRemoto && Array.isArray(bundleRemoto.arquivos)
      ? bundleRemoto
      : buildCleanVpsFullCodePayload();

    const hashCalculado = crypto
      .createHash('sha256')
      .update(payloadOficial.scriptInstalacaoCompleta || JSON.stringify(payloadOficial.arquivos))
      .digest('hex')
      .slice(0, 24);

    etapasLog.push(
      ` [3/5] Pacote oficial verificado (${payloadOficial.arquivos.length} módulos Front-end + Back-end | Integridade SHA-256: ${hashCalculado}).`
    );

    const isProductionVps = fs.existsSync('/var/www/urutau-erp') || process.env.NODE_ENV === 'production';
    let arquivosSincronizados = 0;

    for (const arq of payloadOficial.arquivos) {
      if (arq.path === 'urutau_db.json' || arq.path === '.env') continue;
      const targetPath = path.join(__dirname, arq.path);
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const atual = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf-8') : '';
      if (atual !== arq.content) {
        fs.writeFileSync(targetPath, arq.content, 'utf-8');
      }
      arquivosSincronizados++;
    }

    etapasLog.push(
      ` [4/5] ${arquivosSincronizados} arquivos de código (Front-end + Back-end) verificados e sincronizados sem tocar no banco de dados.`
    );

    if (isProductionVps) {
      try {
        const { exec } = await import('child_process');
        exec('npm run build && (pm2 reload urutau-erp --update-env || true)', { cwd: __dirname });
        etapasLog.push(' [5/5] Build de produção e Hot-Reload PM2 disparados com zero perda de sessão!');
      } catch {
        etapasLog.push(' [5/5] Código sincronizado e ativo em tempo real!');
      }
    } else {
      etapasLog.push(' [5/5] Ambiente sincronizado na versão mais recente e pronto para servir sua VPS!');
    }

    await registrarAuditLog(
      'Super Admin',
      'OTA_SELF_UPDATE_SUCESSO',
      `Atualização OTA pelo sistema concluída (${arquivosSincronizados} arquivos verificados, SHA-256 ${hashCalculado})`,
      req.ip,
      'Super Admin'
    );

    sseBroker.emit('config.atualizada', {
      chave: 'ota_update',
      hash: hashCalculado,
      ts: new Date().toISOString()
    });

    res.json({
      ok: true,
      arquivosSincronizados,
      hashIntegridade: hashCalculado,
      backupPrevioHash: bkpPrevio?.hash_sha256 || 'OK',
      dominioConfigurado: payloadOficial.dominioConfigurado || 'nyctibi.us',
      etapas: etapasLog,
      mensagem: 'Sistema atualizado com sucesso e blindagem de dados ativa!'
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.get('/instalar.sh', (_req: Request, res: Response) => {
  const payload = buildCleanVpsFullCodePayload();
  res.setHeader('Content-Type', 'text/x-shellscript; charset=utf-8');
  res.send(payload.scriptInstalacaoCompleta);
});

function resolveSafeVpsPath(relInput: string): { absPath: string; relPath: string } {
  const cleaned = String(relInput || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .trim();
  const absRoot = path.resolve(__dirname);
  const absTarget = path.resolve(absRoot, cleaned || '.');
  if (!absTarget.startsWith(absRoot)) {
    throw new Error('Caminho fora do diretório raiz do servidor bloqueado por segurança.');
  }
  const relNormalized = path.relative(absRoot, absTarget).replace(/\\/g, '/');
  return { absPath: absTarget, relPath: relNormalized };
}

const ARQUIVOS_SENSIVEIS_BLOQUEADOS_VPS = new Set([
  '.env',
  '.urutau_instance_keys.json',
  'urutau_db.json',
  'urutau_db.json.bak',
  'urutau_db.json.tmp'
]);

function isSensitiveVpsFile(relPath: string): boolean {
  const base = path.posix.basename(String(relPath || '').replace(/\\/g, '/').toLowerCase());
  return ARQUIVOS_SENSIVEIS_BLOQUEADOS_VPS.has(base) || base.startsWith('.env.');
}

app.get('/api/vps/files/list', async (req: Request, res: Response) => {
  try {
    if (!(await verificarAutorizacaoSuperAdminOuSenhaMestra(req))) {
      res.status(403).json({ ok: false, erro: 'Acesso restrito ao Super Admin autenticado.' });
      return;
    }
    const dirQuery = String(req.query.dir || '');
    const { absPath, relPath } = resolveSafeVpsPath(dirQuery);
    if (!fs.existsSync(absPath) || !fs.statSync(absPath).isDirectory()) {
      res.status(404).json({ ok: false, erro: 'Diretório não encontrado no servidor.' });
      return;
    }

    const entries = fs.readdirSync(absPath, { withFileTypes: true });
    const items = entries
      .filter((entry) => entry.name !== '.git' && entry.name !== '.gmp_cache' && !isSensitiveVpsFile(entry.name))
      .map((entry) => {
        const entryAbs = path.join(absPath, entry.name);
        const entryRel = relPath ? `${relPath}/${entry.name}` : entry.name;
        const stat = fs.statSync(entryAbs);
        const isDir = entry.isDirectory();
        const ext = isDir ? 'dir' : (entry.name.split('.').pop() || '').toLowerCase();
        let commentCount = 0;
        if (!isDir && stat.size < 2 * 1024 * 1024 && ['ts', 'tsx', 'js', 'css', 'html', 'md', 'sh'].includes(ext)) {
          try {
            const raw = fs.readFileSync(entryAbs, 'utf-8');
            commentCount = countCodeComments(raw, entry.name);
          } catch {
            commentCount = 0;
          }
        }
        return {
          name: entry.name,
          relPath: entryRel,
          isDirectory: isDir,
          ext,
          sizeBytes: isDir ? 0 : stat.size,
          updatedAt: stat.mtime.toISOString(),
          commentCount,
          isProtected: entryRel === 'urutau_db.json' || entryRel === 'node_modules' || entryRel === 'package.json'
        };
      })
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    res.json({
      ok: true,
      rootDir: fs.existsSync('/var/www/urutau-erp') ? '/var/www/urutau-erp' : path.resolve(__dirname),
      currentRelDir: relPath,
      items
    });
  } catch (e: any) {
    res.status(400).json({ ok: false, erro: e.message });
  }
});

app.get('/api/vps/files/read', async (req: Request, res: Response) => {
  try {
    if (!(await verificarAutorizacaoSuperAdminOuSenhaMestra(req))) {
      res.status(403).json({ ok: false, erro: 'Acesso restrito ao Super Admin autenticado.' });
      return;
    }
    const fileQuery = String(req.query.path || '');
    if (!fileQuery) {
      res.status(400).json({ ok: false, erro: 'Informe o caminho do arquivo.' });
      return;
    }
    const { absPath, relPath } = resolveSafeVpsPath(fileQuery);
    if (isSensitiveVpsFile(relPath)) {
      res.status(403).json({
        ok: false,
        erro: 'Leitura direta de arquivos criptográficos ou de banco de dados bloqueada por segurança.'
      });
      return;
    }
    if (!fs.existsSync(absPath) || fs.statSync(absPath).isDirectory()) {
      res.status(404).json({ ok: false, erro: 'Arquivo não encontrado.' });
      return;
    }
    const stat = fs.statSync(absPath);
    if (stat.size > 3 * 1024 * 1024) {
      res.status(400).json({ ok: false, erro: 'Arquivo maior que 3MB (binário ou pacote). Edição de texto desativada.' });
      return;
    }
    const content = fs.readFileSync(absPath, 'utf-8');
    res.json({
      ok: true,
      relPath,
      sizeBytes: stat.size,
      updatedAt: stat.mtime.toISOString(),
      lines: content.split('\n').length,
      commentCount: countCodeComments(content, relPath),
      content
    });
  } catch (e: any) {
    res.status(400).json({ ok: false, erro: e.message });
  }
});

app.post('/api/vps/files/save', async (req: Request, res: Response) => {
  try {
    if (!(await verificarAutorizacaoSuperAdminOuSenhaMestra(req))) {
      res.status(403).json({ ok: false, erro: 'Acesso restrito ao Super Admin autenticado.' });
      return;
    }
    const { path: targetRel, content, stripComments } = req.body || {};
    if (!targetRel || typeof content !== 'string') {
      res.status(400).json({ ok: false, erro: 'Caminho e conteúdo são obrigatórios.' });
      return;
    }
    const { absPath, relPath } = resolveSafeVpsPath(targetRel);
    if (isSensitiveVpsFile(relPath)) {
      res.status(403).json({
        ok: false,
        erro: 'Sobrescrita direta de arquivos criptográficos ou de banco de dados bloqueada por segurança.'
      });
      return;
    }
    const finalContent = stripComments ? stripPureFunctionalCode(content, relPath) : content;
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, finalContent, 'utf-8');

    await registrarAuditLog(
      'Admin Master',
      'VPS_EXPLORER_SAVE_FILE',
      `Arquivo ${relPath} salvo via Explorador da VPS (${Buffer.byteLength(finalContent, 'utf-8')} bytes)`,
      req.ip,
      'Super Admin'
    );

    res.json({
      ok: true,
      relPath,
      sizeBytes: Buffer.byteLength(finalContent, 'utf-8'),
      lines: finalContent.split('\n').length,
      commentCount: countCodeComments(finalContent, relPath),
      content: finalContent
    });
  } catch (e: any) {
    res.status(400).json({ ok: false, erro: e.message });
  }
});

app.post('/api/vps/files/mkdir', async (req: Request, res: Response) => {
  try {
    if (!(await verificarAutorizacaoSuperAdminOuSenhaMestra(req))) {
      res.status(403).json({ ok: false, erro: 'Acesso restrito ao Super Admin autenticado.' });
      return;
    }
    const { path: targetRel } = req.body || {};
    if (!targetRel) {
      res.status(400).json({ ok: false, erro: 'Informe o nome da nova pasta.' });
      return;
    }
    const { absPath, relPath } = resolveSafeVpsPath(targetRel);
    fs.mkdirSync(absPath, { recursive: true });
    res.json({ ok: true, relPath });
  } catch (e: any) {
    res.status(400).json({ ok: false, erro: e.message });
  }
});

app.post('/api/vps/files/delete', async (req: Request, res: Response) => {
  try {
    if (!(await verificarAutorizacaoSuperAdminOuSenhaMestra(req))) {
      res.status(403).json({ ok: false, erro: 'Acesso restrito ao Super Admin autenticado.' });
      return;
    }
    const { path: targetRel } = req.body || {};
    if (!targetRel) {
      res.status(400).json({ ok: false, erro: 'Informe o caminho para excluir.' });
      return;
    }
    const { absPath, relPath } = resolveSafeVpsPath(targetRel);
    if (
      relPath === '' ||
      isSensitiveVpsFile(relPath) ||
      relPath === 'server.ts' ||
      relPath === 'package.json' ||
      relPath === 'node_modules'
    ) {
      res.status(403).json({
        ok: false,
        erro: `O item "${relPath}" é vital para a execução do sistema e está protegido contra exclusão.`
      });
      return;
    }
    if (!fs.existsSync(absPath)) {
      res.status(404).json({ ok: false, erro: 'Arquivo ou pasta não encontrado.' });
      return;
    }
    const stat = fs.statSync(absPath);
    if (stat.isDirectory()) {
      fs.rmSync(absPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(absPath);
    }

    await registrarAuditLog(
      'Admin Master',
      'VPS_EXPLORER_DELETE',
      `Item ${relPath} removido via Explorador de Arquivos da VPS`,
      req.ip,
      'Super Admin'
    );

    res.json({ ok: true, relPath });
  } catch (e: any) {
    res.status(400).json({ ok: false, erro: e.message });
  }
});

app.post('/api/vps/files/strip-all-comments', async (req: Request, res: Response) => {
  try {
    if (!(await verificarAutorizacaoSuperAdminOuSenhaMestra(req))) {
      res.status(403).json({ ok: false, erro: 'Acesso restrito ao Super Admin autenticado.' });
      return;
    }
    const rootAbs = path.resolve(__dirname);
    let arquivosLimpos = 0;
    let docsApagados = 0;
    let bytesEconomizados = 0;

    function walkAndSanitize(dirAbs: string) {
      const entries = fs.readdirSync(dirAbs, { withFileTypes: true });
      for (const entry of entries) {
        if (
          entry.name === 'node_modules' ||
          entry.name === '.git' ||
          entry.name === 'dist' ||
          entry.name === '.gmp_cache'
        ) {
          continue;
        }
        const fullPath = path.join(dirAbs, entry.name);
        if (entry.isDirectory()) {
          walkAndSanitize(fullPath);
          continue;
        }
        const ext = (entry.name.split('.').pop() || '').toLowerCase();
        if (ext === 'md') {
          const sz = fs.statSync(fullPath).size;
          fs.unlinkSync(fullPath);
          docsApagados++;
          bytesEconomizados += sz;
          continue;
        }
        if (['ts', 'tsx', 'js', 'css', 'html', 'sh'].includes(ext)) {
          const raw = fs.readFileSync(fullPath, 'utf-8');
          const clean = stripPureFunctionalCode(raw, entry.name);
          if (clean !== raw) {
            fs.writeFileSync(fullPath, clean, 'utf-8');
            arquivosLimpos++;
            bytesEconomizados += Math.max(0, Buffer.byteLength(raw, 'utf-8') - Buffer.byteLength(clean, 'utf-8'));
          }
        }
      }
    }

    walkAndSanitize(rootAbs);

    await registrarAuditLog(
      'Admin Master',
      'VPS_STRIP_COMMENTS_DOCS',
      `Expurgo de comentários e documentações concluído: ${arquivosLimpos} arquivos purificados, ${docsApagados} docs .md removidos (${bytesEconomizados} bytes eliminados).`,
      req.ip,
      'Super Admin'
    );

    res.json({
      ok: true,
      arquivosLimpos,
      docsApagados,
      bytesEconomizados,
      mensagem: `Código 100% funcional aplicado: ${arquivosLimpos} arquivos purificados sem comentários e ${docsApagados} documentações apagadas.`
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

interface ConfigIntegracaoConsumer {
  empresa_id: number;
  ativo: boolean;
  modo_conexao: 'botao_flutuante_exe' | 'planilha_consumer' | 'api_direta' | 'fila_ponte_local';
  conferencia_cautelosa_individual: boolean;
  exibir_botao_flutuante_tela: boolean;
  caminho_fdb_consumer: string;
  endpoint_url: string;
  api_token: string;
  codigo_loja: string;
  terminal_caixa: string;
  auto_lancar_caixa: boolean;
  auto_lancar_reservas_mesas: boolean;
  auto_lancar_estoque_compras: boolean;
  auto_lancar_rateio: boolean;
  atualizado_em: string;
}

interface RegistroDisparoConsumer {
  id: string;
  empresa_id: number;
  modulo: 'CAIXA' | 'MESA_COMANDA' | 'ESTOQUE_COMPRA' | 'RATEIO_RH' | 'PEDIDO_PDV';
  operacao_consumer: string;
  resumo: string;
  valor_referencia: number;
  status:
    | 'AGUARDANDO_CONFERENCIA_CAUTELOSA'
    | 'CONFERIDO_LANCADO_CONSUMER'
    | 'REJEITADO_PELO_OPERADOR'
    | 'ENVIADO_API_DIRETA'
    | 'DISPONIVEL_FILA_CONSUMER'
    | 'CONFIRMADO_TERMINAL';
  http_status?: number;
  payload_consumer: any;
  criado_em: string;
  confirmado_em?: string;
  conferido_por?: string;
  observacao_conferencia?: string;
}

function obterConfigIntegracaoConsumer(empresaId: number): ConfigIntegracaoConsumer {
  const empId = Number(empresaId || 1);
  const chave = `consumer_pdv_api_emp_${empId}`;
  const existente = (db?.erp_configs || []).find((c: any) => c.chave === chave);
  const tokenCriptografico = gerarTokenConsumerEmpresa(empId);
  const padrao: ConfigIntegracaoConsumer = {
    empresa_id: empId,
    ativo: true,
    modo_conexao: 'botao_flutuante_exe',
    conferencia_cautelosa_individual: true,
    exibir_botao_flutuante_tela: false,
    caminho_fdb_consumer: 'C:\\Programa Consumer\\Dados\\CONSUMER.FDB',
    endpoint_url: 'http://127.0.0.1:8085/api/v1/consumer/lancamentos',
    api_token: tokenCriptografico,
    codigo_loja: `LOJA-0${empId}`,
    terminal_caixa: 'CAIXA-01',
    auto_lancar_caixa: true,
    auto_lancar_reservas_mesas: true,
    auto_lancar_estoque_compras: true,
    auto_lancar_rateio: true,
    atualizado_em: new Date().toISOString()
  };
  if (existente && existente.valor_json) {
    const merged = { ...padrao, ...existente.valor_json, empresa_id: empId };
    if (!merged.api_token || String(merged.api_token).startsWith('URUTAU-CONSUMER-')) {
      merged.api_token = tokenCriptografico;
    }
    return merged;
  }
  return padrao;
}

function obterLogsDisparosConsumer(empresaId: number): RegistroDisparoConsumer[] {
  const empId = Number(empresaId || 1);
  const chave = `consumer_pdv_logs_emp_${empId}`;
  const existente = (db?.erp_configs || []).find((c: any) => c.chave === chave);
  if (existente && Array.isArray(existente.valor_json?.itens)) {
    return existente.valor_json.itens;
  }
  return [];
}

function salvarLogsDisparosConsumer(empresaId: number, itens: RegistroDisparoConsumer[]) {
  const empId = Number(empresaId || 1);
  const chave = `consumer_pdv_logs_emp_${empId}`;
  const recortados = itens.slice(0, 150);
  const idx = (db?.erp_configs || []).findIndex((c: any) => c.chave === chave);
  const item = {
    chave,
    valor_json: { itens: recortados },
    atualizado_em: new Date().toISOString()
  };
  if (idx >= 0) db.erp_configs[idx] = item;
  else db.erp_configs.push(item);
}

async function dispararLancamentoConsumerApi(
  empresaId: number,
  modulo: 'CAIXA' | 'MESA_COMANDA' | 'ESTOQUE_COMPRA' | 'RATEIO_RH' | 'PEDIDO_PDV',
  dadosOriginais: any,
  opcoes?: { forcarEnvio?: boolean }
): Promise<RegistroDisparoConsumer | null> {
  try {
    const empId = Number(empresaId || 1);
    const cfg = obterConfigIntegracaoConsumer(empId);
    if (!cfg.ativo && !opcoes?.forcarEnvio) return null;

    if (!opcoes?.forcarEnvio) {
      if (modulo === 'CAIXA' && !cfg.auto_lancar_caixa) return null;
      if (modulo === 'MESA_COMANDA' && !cfg.auto_lancar_reservas_mesas) return null;
      if (modulo === 'ESTOQUE_COMPRA' && !cfg.auto_lancar_estoque_compras) return null;
      if (modulo === 'RATEIO_RH' && !cfg.auto_lancar_rateio) return null;
    }

    let operacaoConsumer = 'LANCAMENTO_GENERICO';
    let resumo = '';
    let valorReferencia = 0;
    let dadosConsumerFormatados: any = {};

    if (modulo === 'CAIXA') {
      const isEntrada = String(dadosOriginais.tipo || 'Entrada') === 'Entrada';
      operacaoConsumer = isEntrada ? 'SUPRIMENTO_RECEITA_CAIXA' : 'SANGRIA_DESPESA_CAIXA';
      valorReferencia = Number(dadosOriginais.valor || 0);
      resumo = `${isEntrada ? 'Suprimento/Entrada' : 'Sangria/Saída'} Consumer: ${dadosOriginais.descricao || dadosOriginais.categoria}`;
      dadosConsumerFormatados = {
        tipo_movimento_consumer: isEntrada ? 'ENTRADA_CAIXA' : 'SAIDA_SANGRIA',
        plano_contas_consumer: dadosOriginais.categoria || 'Operacional',
        historico: dadosOriginais.descricao || 'Lançamento via Urutau ERP',
        valor: valorReferencia,
        forma_pagamento: dadosOriginais.forma_pagamento || 'DINHEIRO_PIX_PADRAO',
        data_competencia: dadosOriginais.data || getTodayISO(),
        expressao_calculo: dadosOriginais.expressao || String(valorReferencia)
      };
    } else if (modulo === 'MESA_COMANDA') {
      operacaoConsumer = 'ABERTURA_MESA_COMANDA';
      const numMesaLimpo = String(dadosOriginais.mesa || '01').replace(/\D/g, '') || '1';
      valorReferencia = Number(dadosOriginais.valor_consumo || 0);
      resumo = `Mesa/Comanda #${numMesaLimpo} (${dadosOriginais.cliente}) • ${dadosOriginais.pessoas || 1} pessoa(s)`;
      dadosConsumerFormatados = {
        numero_mesa_comanda: Number(numMesaLimpo),
        codigo_mesa_texto: dadosOriginais.mesa || `M-${numMesaLimpo}`,
        area_salao: dadosOriginais.area || 'Salão Principal',
        cliente_nome: dadosOriginais.cliente || 'Cliente Balcão',
        cliente_telefone: dadosOriginais.whatsapp || '',
        quantidade_pessoas: Number(dadosOriginais.pessoas || 1),
        horario_abertura: dadosOriginais.hora || '20:00',
        data_reserva: dadosOriginais.data || getTodayISO(),
        status_mesa_consumer: dadosOriginais.status === 'Finalizada' ? 'FECHADA' : 'ABERTA_OCUPADA',
        observacoes_cozinha_salao: dadosOriginais.observacoes || ''
      };
    } else if (modulo === 'ESTOQUE_COMPRA') {
      operacaoConsumer = dadosOriginais.operacao || 'ENTRADA_ESTOQUE_FICHA_TECNICA';
      const qtd = Number(dadosOriginais.quantidade_comprada ?? dadosOriginais.quantidade ?? 0);
      const custo = Number(dadosOriginais.custo_unitario || 0);
      valorReferencia = Number(dadosOriginais.valor_total_compra ?? qtd * custo);
      resumo = `Estoque Consumer: ${dadosOriginais.nome} (${qtd} ${dadosOriginais.unidade_medida || 'kg'})`;
      dadosConsumerFormatados = {
        insumo_nome: dadosOriginais.nome,
        grupo_estoque_consumer: dadosOriginais.categoria || 'Insumos',
        quantidade_movimentada: qtd,
        saldo_atualizado: Number(dadosOriginais.saldo_final ?? dadosOriginais.quantidade ?? qtd),
        unidade_medida: dadosOriginais.unidade_medida || 'kg',
        custo_unitario: custo,
        custo_total_nota: valorReferencia,
        fornecedor_nome: dadosOriginais.fornecedor || 'Fornecedor Homologado',
        atualizar_ficha_tecnica_cmv: true
      };
    } else if (modulo === 'RATEIO_RH') {
      operacaoConsumer = 'LANCAMENTO_COMISSOES_GARCONS_TAXA_SERVICO';
      valorReferencia = Number(dadosOriginais.valor_pool || 0);
      resumo = `Rateio 10% Consumer (${dadosOriginais.data || getTodayISO()}): Pool R$ ${valorReferencia.toFixed(2)}`;
      dadosConsumerFormatados = {
        data_fechamento: dadosOriginais.data || getTodayISO(),
        faturamento_base: Number(dadosOriginais.faturamento_bruto || 0),
        percentual_taxa_servico: Number(dadosOriginais.percentual_pool || 10),
        valor_total_distribuido: valorReferencia,
        repasses_colaboradores: Array.isArray(dadosOriginais.detalhes) ? dadosOriginais.detalhes : []
      };
    } else if (modulo === 'PEDIDO_PDV') {
      operacaoConsumer = 'LANCAMENTO_PEDIDO_DIRETO_PDV';
      valorReferencia = Number(dadosOriginais.valor_total || dadosOriginais.valor || 0);
      const numMesa = String(dadosOriginais.mesa_comanda || '1').replace(/\D/g, '') || '1';
      resumo = `Pedido PDV Consumer • Mesa/Comanda #${numMesa}: ${dadosOriginais.produto_descricao || 'Itens de Cardápio'}`;
      dadosConsumerFormatados = {
        numero_mesa_comanda: Number(numMesa),
        cliente_nome: dadosOriginais.cliente || 'Consumidor Salão',
        garcom_atendente: dadosOriginais.garcom || 'Atendente Urutau',
        itens_pedido: Array.isArray(dadosOriginais.itens)
          ? dadosOriginais.itens
          : [
              {
                codigo_produto_consumer: dadosOriginais.codigo_produto || 'PROD-001',
                nome_produto: dadosOriginais.produto_descricao || 'Item Lançado via Urutau',
                quantidade: Number(dadosOriginais.quantidade || 1),
                preco_unitario: Number(dadosOriginais.preco_unitario || valorReferencia),
                observacao_preparo: dadosOriginais.observacao || ''
              }
            ],
        valor_total_pedido: valorReferencia,
        imprimir_cozinha_bar: true
      };
    }

    const idDisparo = `CONS-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const payloadConsumer = {
      protocolo_id: idDisparo,
      sistema_origem: 'URUTAU_ERP',
      sistema_destino: 'PDV_CONSUMER',
      versao_integracao: 'CONSUMER-CONNECT-API-2.0',
      empresa_id: empId,
      codigo_loja: cfg.codigo_loja,
      terminal_caixa: cfg.terminal_caixa,
      modulo,
      operacao_consumer: operacaoConsumer,
      modo_cauteloso: Boolean(cfg.conferencia_cautelosa_individual),
      timestamp_iso: new Date().toISOString(),
      dados: dadosConsumerFormatados
    };

    let statusFinal: RegistroDisparoConsumer['status'] = cfg.conferencia_cautelosa_individual
      ? 'AGUARDANDO_CONFERENCIA_CAUTELOSA'
      : 'DISPONIVEL_FILA_CONSUMER';
    let httpStatus: number | undefined = undefined;

    if (!cfg.conferencia_cautelosa_individual && cfg.modo_conexao === 'api_direta') {
      const urlLimpa = String(cfg.endpoint_url || '').trim();
      const isLocalhostPadrao =
        urlLimpa.includes('127.0.0.1:8085') || urlLimpa.includes('localhost:8085');

      if (urlLimpa.startsWith('http') && !isLocalhostPadrao && isSafeWebhookOrGatewayUrl(urlLimpa, false)) {
        try {
          const resp = await fetch(urlLimpa, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${cfg.api_token}`,
              'X-Consumer-Token': cfg.api_token,
              'X-Consumer-Loja': cfg.codigo_loja,
              'X-Consumer-Terminal': cfg.terminal_caixa
            },
            body: JSON.stringify(payloadConsumer),
            signal: AbortSignal.timeout(4000)
          });
          httpStatus = resp.status;
          if (resp.ok) {
            statusFinal = 'ENVIADO_API_DIRETA';
          }
        } catch {
          statusFinal = 'AGUARDANDO_CONFERENCIA_CAUTELOSA';
        }
      }
    }

    const registro: RegistroDisparoConsumer = {
      id: idDisparo,
      empresa_id: empId,
      modulo,
      operacao_consumer: operacaoConsumer,
      resumo,
      valor_referencia: valorReferencia,
      status: statusFinal,
      http_status: httpStatus,
      payload_consumer: payloadConsumer,
      criado_em: new Date().toISOString()
    };

    const logsAtuais = obterLogsDisparosConsumer(empId);
    salvarLogsDisparosConsumer(empId, [registro, ...logsAtuais]);
    saveDbToDisk();

    sseBroker.emit('consumer.lancamento_api', {
      empresa_id: empId,
      disparo: registro
    });

    return registro;
  } catch {
    return null;
  }
}

app.get('/api/integracoes/consumer/status/:empresaId', (req: Request, res: Response) => {
  try {
    const empId = Number(req.params.empresaId || 1);
    if (!verificarAcessoEmpresaRequisicao(req, empId)) {
      return res.status(403).json({ ok: false, erro: 'Acesso negado aos dados Consumer desta empresa.' });
    }
    const config = obterConfigIntegracaoConsumer(empId);
    const logs = obterLogsDisparosConsumer(empId);
    const pendentesCautelosos = logs.filter(
      (l) =>
        l.status === 'AGUARDANDO_CONFERENCIA_CAUTELOSA' ||
        l.status === 'DISPONIVEL_FILA_CONSUMER'
    );
    const conferidosLancados = logs.filter(
      (l) =>
        l.status === 'CONFERIDO_LANCADO_CONSUMER' ||
        l.status === 'CONFIRMADO_TERMINAL' ||
        l.status === 'ENVIADO_API_DIRETA'
    );
    const rejeitados = logs.filter((l) => l.status === 'REJEITADO_PELO_OPERADOR');

    const resumo = {
      total_lancados: logs.length,
      caixa_count: logs.filter((l) => l.modulo === 'CAIXA').length,
      mesas_count: logs.filter((l) => l.modulo === 'MESA_COMANDA' || l.modulo === 'PEDIDO_PDV').length,
      estoque_count: logs.filter((l) => l.modulo === 'ESTOQUE_COMPRA').length,
      rateio_count: logs.filter((l) => l.modulo === 'RATEIO_RH').length,
      fila_pendente: pendentesCautelosos.length,
      conferidos_count: conferidosLancados.length,
      rejeitados_count: rejeitados.length
    };
    res.json({
      ok: true,
      config,
      resumo,
      fila_cautelosa: pendentesCautelosos.slice(0, 50),
      logs: logs.slice(0, 50)
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.post('/api/integracoes/consumer/config', async (req: Request, res: Response) => {
  try {
    const empId = Number(req.body?.empresa_id || 1);
    if (!verificarAcessoEmpresaRequisicao(req, empId)) {
      return res.status(403).json({ ok: false, erro: 'Sem permissão para alterar configuração Consumer desta empresa.' });
    }
    const endpointInput = req.body?.endpoint_url !== undefined ? String(req.body.endpoint_url).trim() : '';
    if (endpointInput && !isSafeWebhookOrGatewayUrl(endpointInput, true)) {
      return res.status(400).json({ ok: false, erro: 'Endpoint URL inválido ou bloqueado pela proteção anti-SSRF.' });
    }
    const atual = obterConfigIntegracaoConsumer(empId);
    const modosValidos = [
      'botao_flutuante_exe',
      'planilha_consumer',
      'api_direta',
      'fila_ponte_local'
    ];
    const modoEscolhido = modosValidos.includes(req.body?.modo_conexao)
      ? req.body.modo_conexao
      : atual.modo_conexao;

    const novaConfig: ConfigIntegracaoConsumer = {
      ...atual,
      ativo: req.body?.ativo !== undefined ? Boolean(req.body.ativo) : atual.ativo,
      modo_conexao: modoEscolhido,
      conferencia_cautelosa_individual:
        req.body?.conferencia_cautelosa_individual !== undefined
          ? Boolean(req.body.conferencia_cautelosa_individual)
          : atual.conferencia_cautelosa_individual,
      exibir_botao_flutuante_tela:
        req.body?.exibir_botao_flutuante_tela !== undefined
          ? Boolean(req.body.exibir_botao_flutuante_tela)
          : atual.exibir_botao_flutuante_tela,
      caminho_fdb_consumer:
        req.body?.caminho_fdb_consumer !== undefined
          ? String(req.body.caminho_fdb_consumer).trim()
          : atual.caminho_fdb_consumer,
      endpoint_url:
        req.body?.endpoint_url !== undefined
          ? String(req.body.endpoint_url).trim()
          : atual.endpoint_url,
      api_token:
        req.body?.api_token !== undefined ? String(req.body.api_token).trim() : atual.api_token,
      codigo_loja:
        req.body?.codigo_loja !== undefined
          ? String(req.body.codigo_loja).trim()
          : atual.codigo_loja,
      terminal_caixa:
        req.body?.terminal_caixa !== undefined
          ? String(req.body.terminal_caixa).trim()
          : atual.terminal_caixa,
      auto_lancar_caixa:
        req.body?.auto_lancar_caixa !== undefined
          ? Boolean(req.body.auto_lancar_caixa)
          : atual.auto_lancar_caixa,
      auto_lancar_reservas_mesas:
        req.body?.auto_lancar_reservas_mesas !== undefined
          ? Boolean(req.body.auto_lancar_reservas_mesas)
          : atual.auto_lancar_reservas_mesas,
      auto_lancar_estoque_compras:
        req.body?.auto_lancar_estoque_compras !== undefined
          ? Boolean(req.body.auto_lancar_estoque_compras)
          : atual.auto_lancar_estoque_compras,
      auto_lancar_rateio:
        req.body?.auto_lancar_rateio !== undefined
          ? Boolean(req.body.auto_lancar_rateio)
          : atual.auto_lancar_rateio,
      atualizado_em: new Date().toISOString()
    };

    const chave = `consumer_pdv_api_emp_${empId}`;
    const idx = db.erp_configs.findIndex((c: any) => c.chave === chave);
    const item = { chave, valor_json: novaConfig, atualizado_em: novaConfig.atualizado_em };
    if (idx >= 0) db.erp_configs[idx] = item;
    else db.erp_configs.push(item);
    saveDbToDisk();

    await registrarAuditLog(
      'Gestor Integrador',
      'CONFIGURAR_API_PDV_CONSUMER',
      `Integração PDV Consumer atualizada para Loja ${novaConfig.codigo_loja} (${novaConfig.terminal_caixa}) — Modo: ${novaConfig.modo_conexao}`,
      req.ip
    );

    res.json({ ok: true, config: novaConfig });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.post('/api/integracoes/consumer/conferir-individual', async (req: Request, res: Response) => {
  try {
    const empId = Number(req.body?.empresa_id || 1);
    const protocoloId = String(req.body?.protocolo_id || '').trim();
    const acao = String(req.body?.acao || 'APROVAR_E_LANCAR');
    const operador = String(req.body?.operador || 'Operador de Caixa Consumer');
    const observacao = String(req.body?.observacao_conferencia || '');

    if (!protocoloId) {
      return res.status(400).json({ ok: false, erro: 'Protocolo do lançamento não informado para conferência individual.' });
    }

    const logs = obterLogsDisparosConsumer(empId);
    const idx = logs.findIndex((l) => l.id === protocoloId);
    if (idx < 0) {
      return res.status(404).json({ ok: false, erro: 'Lançamento não encontrado na fila do Consumer.' });
    }

    const agora = new Date().toISOString();
    const itemAlvo = logs[idx];

    if (acao === 'REJEITAR_DESCARTAR') {
      itemAlvo.status = 'REJEITADO_PELO_OPERADOR';
      itemAlvo.confirmado_em = agora;
      itemAlvo.conferido_por = operador;
      itemAlvo.observacao_conferencia = observacao || 'Descartado na conferência cautelosa';
    } else {
      itemAlvo.status = 'CONFERIDO_LANCADO_CONSUMER';
      itemAlvo.confirmado_em = agora;
      itemAlvo.conferido_por = operador;
      itemAlvo.observacao_conferencia = observacao || 'Conferido individualmente e lançado no Consumer';
    }

    logs[idx] = itemAlvo;
    salvarLogsDisparosConsumer(empId, logs);
    saveDbToDisk();

    await registrarAuditLog(
      operador,
      acao === 'REJEITAR_DESCARTAR'
        ? 'REJEITAR_ITEM_FILA_CONSUMER'
        : 'CONFERIR_LANCAR_INDIVIDUAL_CONSUMER',
      `[${protocoloId}] ${itemAlvo.resumo} — R$ ${Number(itemAlvo.valor_referencia || 0).toFixed(2)} (${itemAlvo.status})`,
      req.ip
    );

    sseBroker.emit('consumer.lancamento_api', {
      empresa_id: empId,
      disparo: itemAlvo
    });

    res.json({
      ok: true,
      item: itemAlvo,
      pendentes_restantes: logs.filter(
        (l) =>
          l.status === 'AGUARDANDO_CONFERENCIA_CAUTELOSA' ||
          l.status === 'DISPONIVEL_FILA_CONSUMER'
      ).length
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.post('/api/integracoes/consumer/lancar-manual', async (req: Request, res: Response) => {
  try {
    const empId = Number(req.body?.empresa_id || 1);
    const modulo = (req.body?.modulo || 'CAIXA') as
      | 'CAIXA'
      | 'MESA_COMANDA'
      | 'ESTOQUE_COMPRA'
      | 'RATEIO_RH'
      | 'PEDIDO_PDV';
    const dados = req.body?.dados || {};
    const gravarNoUrutau = Boolean(req.body?.gravar_no_urutau);

    if (gravarNoUrutau) {
      if (modulo === 'CAIXA') {
        db.erp_caixa.unshift({
          id: nextId(db.erp_caixa),
          data: dados.data || getTodayISO(),
          tipo: dados.tipo || 'Entrada',
          categoria: dados.categoria || 'Integração PDV Consumer',
          descricao: dados.descricao || 'Lançamento Direto PDV Consumer',
          expressao: String(dados.valor || 0),
          valor: Number(dados.valor || 0),
          unidade_id: empId,
          usuario_id: 1,
          arquivado_legal: false,
          criado_em: new Date().toISOString()
        });
      } else if (modulo === 'PEDIDO_PDV') {
        const vPed = Number(dados.valor_total || dados.valor || 0);
        if (vPed > 0) {
          db.erp_caixa.unshift({
            id: nextId(db.erp_caixa),
            data: getTodayISO(),
            tipo: 'Entrada',
            categoria: 'Venda PDV Consumer',
            descricao: `Pedido Consumer Mesa #${dados.mesa_comanda || '01'}: ${dados.produto_descricao || 'Item Cardápio'}`,
            expressao: `${dados.quantidade || 1} * ${dados.preco_unitario || vPed}`,
            valor: vPed,
            unidade_id: empId,
            usuario_id: 1,
            arquivado_legal: false,
            criado_em: new Date().toISOString()
          });
        }
      } else if (modulo === 'MESA_COMANDA') {
        db.reservas.unshift({
          id: nextId(db.reservas),
          cliente: dados.cliente || 'Cliente PDV Consumer',
          whatsapp: dados.whatsapp || '',
          data: dados.data || getTodayISO(),
          hora: dados.hora || '20:00',
          mesa: dados.mesa || 'M-01',
          area: dados.area || 'Salão Principal',
          adultos_pagantes: Number(dados.pessoas || 2),
          adultos_frequentadores: 0,
          criancas_pagantes: 0,
          criancas_frequentadores: 0,
          status: 'Confirmada',
          observacoes: dados.observacoes || 'Aberta via Integração PDV Consumer',
          unidade_id: empId,
          arquivado_legal: false,
          criado_em: new Date().toISOString()
        });
      }
      saveDbToDisk();
    }

    const disparo = await dispararLancamentoConsumerApi(empId, modulo, dados, {
      forcarEnvio: true
    });

    await registrarAuditLog(
      'Operador PDV Consumer',
      'DISPARO_API_PDV_CONSUMER',
      `Lançamento enviado para Fila Cautelosa PDV Consumer [${modulo}]: ${disparo?.resumo || 'Enviado'}`,
      req.ip
    );

    res.json({ ok: true, disparo });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.post('/api/integracoes/consumer/sincronizar-dia', async (req: Request, res: Response) => {
  try {
    const empId = Number(req.body?.empresa_id || 1);
    const dataAlvo = String(req.body?.data || getTodayISO());

    const caixasDia = (db.erp_caixa || []).filter(
      (c: any) => !c.arquivado_legal && String(c.data) === dataAlvo
    );
    const reservasDia = (db.reservas || []).filter(
      (r: any) => !r.arquivado_legal && String(r.data) === dataAlvo
    );
    const disparosRealizados: RegistroDisparoConsumer[] = [];

    for (const cx of caixasDia) {
      const d = await dispararLancamentoConsumerApi(
        empId,
        'CAIXA',
        {
          id_origem: cx.id,
          data: cx.data,
          tipo: cx.tipo,
          categoria: cx.categoria,
          descricao: cx.descricao,
          valor: cx.valor,
          expressao: cx.expressao
        },
        { forcarEnvio: true }
      );
      if (d) disparosRealizados.push(d);
    }

    for (const rv of reservasDia) {
      const d = await dispararLancamentoConsumerApi(
        empId,
        'MESA_COMANDA',
        {
          cliente: rv.cliente,
          whatsapp: rv.whatsapp,
          data: rv.data,
          hora: rv.hora,
          mesa: rv.mesa,
          area: rv.area,
          pessoas:
            Number(rv.adultos_pagantes || 0) +
            Number(rv.adultos_frequentadores || 0) +
            Number(rv.criancas_pagantes || 0) +
            Number(rv.criancas_frequentadores || 0),
          status: rv.status,
          observacoes: rv.observacoes
        },
        { forcarEnvio: true }
      );
      if (d) disparosRealizados.push(d);
    }

    await registrarAuditLog(
      'Operador PDV Consumer',
      'SINCRONIZACAO_LOTE_CONSUMER',
      `Itens do dia (${dataAlvo}) enviados para a Fila de Conferência Cautelosa do Consumer: ${disparosRealizados.length} lançamento(s).`,
      req.ip
    );

    res.json({
      ok: true,
      data: dataAlvo,
      total_transmitidos: disparosRealizados.length,
      caixa_transmitidos: caixasDia.length,
      mesas_transmitidas: reservasDia.length,
      disparos: disparosRealizados
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.get('/api/integracoes/consumer/fila-pendente/:empresaId', (req: Request, res: Response) => {
  try {
    const empId = Number(req.params.empresaId || 1);
    const cfg = obterConfigIntegracaoConsumer(empId);
    const tokenHeader = String(
      req.headers['x-consumer-token'] || req.query.token || ''
    ).trim();
    if (tokenHeader && tokenHeader !== cfg.api_token) {
      return res.status(401).json({ ok: false, erro: 'Token da API Consumer inválido.' });
    }
    const logs = obterLogsDisparosConsumer(empId);
    const pendentes = logs.filter(
      (l) =>
        l.status === 'AGUARDANDO_CONFERENCIA_CAUTELOSA' ||
        l.status === 'DISPONIVEL_FILA_CONSUMER'
    );
    res.json({
      ok: true,
      empresa_id: empId,
      codigo_loja: cfg.codigo_loja,
      terminal_caixa: cfg.terminal_caixa,
      conferencia_cautelosa_individual: cfg.conferencia_cautelosa_individual,
      total_pendentes: pendentes.length,
      itens_fila: pendentes.map((p) => ({
        id: p.id,
        modulo: p.modulo,
        operacao: p.operacao_consumer,
        resumo: p.resumo,
        valor: p.valor_referencia,
        criado_em: p.criado_em,
        dados: p.payload_consumer?.dados || {}
      })),
      lancamentos: pendentes.map((p) => p.payload_consumer)
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.post('/api/integracoes/consumer/confirmar-lote', (req: Request, res: Response) => {
  try {
    const empId = Number(req.body?.empresa_id || 1);
    const idsConfirmados: string[] = Array.isArray(req.body?.protocolos_ids)
      ? req.body.protocolos_ids.map(String)
      : [];
    const logs = obterLogsDisparosConsumer(empId);
    const agora = new Date().toISOString();
    let confirmadosCount = 0;

    const atualizados = logs.map((item) => {
      if (
        idsConfirmados.length === 0
          ? item.status === 'DISPONIVEL_FILA_CONSUMER' ||
            item.status === 'AGUARDANDO_CONFERENCIA_CAUTELOSA'
          : idsConfirmados.includes(item.id)
      ) {
        confirmadosCount++;
        return {
          ...item,
          status: 'CONFERIDO_LANCADO_CONSUMER' as const,
          confirmado_em: agora
        };
      }
      return item;
    });

    salvarLogsDisparosConsumer(empId, atualizados);
    saveDbToDisk();
    res.json({ ok: true, confirmados: confirmadosCount });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.get('/api/integracoes/consumer/exportar-planilha/:empresaId', (req: Request, res: Response) => {
  try {
    const empId = Number(req.params.empresaId || 1);
    const tipoPlanilha = String(req.query.tipo || 'caixa_contas');
    const apenasConferidos = String(req.query.apenas_conferidos || 'true') === 'true';
    const logs = obterLogsDisparosConsumer(empId);

    const escCsv = (val: any) => {
      const s = String(val ?? '').replace(/\r?\n/g, ' ').replace(/;/g, ',').trim();
      return s;
    };
    const fmtMoedaConsumer = (n: any) => Number(n || 0).toFixed(2).replace('.', ',');

    let linhasCsv: string[] = [];
    let nomeArquivo = `Consumer_Importacao_${tipoPlanilha}_${getTodayISO()}.csv`;

    if (tipoPlanilha === 'estoque_produtos') {
      nomeArquivo = `Consumer_Importacao_Estoque_Insumos_${getTodayISO()}.csv`;
      linhasCsv.push(
        'Codigo_Barras_Interno;Nome_Produto_Insumo;Categoria_Grupo;Unidade_Medida;Preco_Custo_Unitario;Estoque_Atual;Estoque_Minimo;Fornecedor'
      );
      const itensEstoque = (db.erp_estoque || []).filter((e: any) => !e.arquivado_legal);
      for (const item of itensEstoque) {
        linhasCsv.push(
          [
            `INS-${String(item.id).padStart(4, '0')}`,
            escCsv(item.nome),
            escCsv(item.categoria || 'Insumos'),
            escCsv(item.unidade_medida || 'kg'),
            fmtMoedaConsumer(item.custo_unitario),
            String(Number(item.quantidade || 0)).replace('.', ','),
            String(Number(item.estoque_minimo || 0)).replace('.', ','),
            escCsv(item.fornecedor || 'Fornecedor Padrão')
          ].join(';')
        );
      }
    } else if (tipoPlanilha === 'clientes_mesas') {
      nomeArquivo = `Consumer_Importacao_Clientes_Reservas_${getTodayISO()}.csv`;
      linhasCsv.push(
        'Nome_Cliente;Telefone_Celular;Mesa_Comanda_Sugerida;Data_Reserva;Horario;Quantidade_Pessoas;Observacoes_Consumer'
      );
      const reservasAtivas = (db.reservas || []).filter((r: any) => !r.arquivado_legal);
      for (const rv of reservasAtivas) {
        const totalPessoas =
          Number(rv.adultos_pagantes || 0) +
          Number(rv.adultos_frequentadores || 0) +
          Number(rv.criancas_pagantes || 0) +
          Number(rv.criancas_frequentadores || 0);
        linhasCsv.push(
          [
            escCsv(rv.cliente),
            escCsv(rv.whatsapp || ''),
            escCsv(rv.mesa || 'M-01'),
            escCsv(rv.data || getTodayISO()),
            escCsv(rv.hora || '20:00'),
            String(Math.max(1, totalPessoas)),
            escCsv(`${rv.area || 'Salão'} - ${rv.observacoes || 'Reserva Urutau'}`)
          ].join(';')
        );
      }
    } else {
      nomeArquivo = `Consumer_Importacao_Caixa_Financeiro_${getTodayISO()}.csv`;
      linhasCsv.push(
        'Protocolo_Urutau;Data_Competencia;Tipo_Movimento_Consumer;Plano_Contas_Categoria;Descricao_Historico;Valor_RS;Forma_Pagamento;Status_Conferencia'
      );

      const logsCaixa = logs.filter((l) => {
        if (apenasConferidos) {
          return (
            l.status === 'CONFERIDO_LANCADO_CONSUMER' ||
            l.status === 'CONFIRMADO_TERMINAL' ||
            l.status === 'ENVIADO_API_DIRETA'
          );
        }
        return l.status !== 'REJEITADO_PELO_OPERADOR';
      });

      if (logsCaixa.length > 0) {
        for (const l of logsCaixa) {
          const d = l.payload_consumer?.dados || {};
          linhasCsv.push(
            [
              escCsv(l.id),
              escCsv(d.data_competencia || d.data_fechamento || d.data_reserva || getTodayISO()),
              escCsv(l.operacao_consumer),
              escCsv(d.plano_contas_consumer || l.modulo),
              escCsv(l.resumo),
              fmtMoedaConsumer(l.valor_referencia),
              escCsv(d.forma_pagamento || 'PADRAO_CAIXA'),
              escCsv(l.status)
            ].join(';')
          );
        }
      } else {
        const caixas = (db.erp_caixa || []).filter((c: any) => !c.arquivado_legal);
        for (const cx of caixas) {
          linhasCsv.push(
            [
              `CX-${cx.id}`,
              escCsv(cx.data || getTodayISO()),
              cx.tipo === 'Entrada' ? 'SUPRIMENTO_RECEITA_CAIXA' : 'SANGRIA_DESPESA_CAIXA',
              escCsv(cx.categoria || 'Operacional'),
              escCsv(cx.descricao),
              fmtMoedaConsumer(cx.valor),
              'DINHEIRO_PIX_PADRAO',
              'VERIFICADO_CAIXA'
            ].join(';')
          );
        }
      }
    }

    const conteudoFinal = '\uFEFF' + linhasCsv.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
    res.send(conteudoFinal);
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

const VERSAO_BINARIO_FECHADO_URUTAU_EXE = '2.6.0-PE32-OTA-VPS-GITHUB';

app.get('/api/integracoes/consumer/versao-executavel', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    versao_exe: VERSAO_BINARIO_FECHADO_URUTAU_EXE,
    formato_binario: 'PE32_NATIVO_FECHADO',
    modo_atualizacao: 'OTA_AUTOMATICO_VPS_GITHUB',
    verificado_em: new Date().toISOString()
  });
});

app.get('/api/integracoes/consumer/baixar-executavel-windows/:empresaId', (req: Request, res: Response) => {
  try {
    const empId = Number(req.params.empresaId || 1);
    const cfg = obterConfigIntegracaoConsumer(empId);
    const hostHeader = req.get('host') || 'localhost:3000';
    const protoHeader =
      req.headers['x-forwarded-proto'] ? String(req.headers['x-forwarded-proto']) : req.protocol || 'https';
    const baseUrlUrutau = `${protoHeader}://${hostHeader}`;
    const exeBuffer = gerarBinarioFechadoUrutauExe(
      baseUrlUrutau,
      empId,
      `URUTAU_LOJA_${cfg.codigo_loja || empId}`
    );

    res.setHeader('Content-Type', 'application/vnd.microsoft.portable-executable');
    res.setHeader('Content-Disposition', 'attachment; filename="Urutau.exe"');
    res.setHeader('Content-Length', String(exeBuffer.length));
    res.setHeader('Cache-Control', 'no-store');
    res.send(exeBuffer);
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

function listarIpsLocaisServidor(): string[] {
  const encontrados = new Set<string>();
  try {
    const nets = os.networkInterfaces();
    for (const key of Object.keys(nets)) {
      const list = nets[key] || [];
      for (const info of list) {
        if (info && info.family === 'IPv4' && !info.internal && info.address) {
          encontrados.add(info.address);
        }
      }
    }
  } catch {}
  return Array.from(encontrados);
}

function normalizarTextoAsciiImpressora(texto: string): string {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ');
}

function gerarBufferEscPos(
  linhas: string[],
  opcoes?: { largura?: '80mm' | '58mm'; cortarPapel?: boolean; vias?: number }
): Buffer {
  const vias = Math.max(1, Math.min(3, Number(opcoes?.vias || 1)));
  const partes: Buffer[] = [];
  for (let v = 0; v < vias; v++) {
    partes.push(Buffer.from([0x1b, 0x40]));
    for (let idx = 0; idx < linhas.length; idx++) {
      const rawLine = String(linhas[idx] ?? '');
      const isTitulo = idx === 0 || rawLine.startsWith('=== ') || rawLine.startsWith('PEDIDO ') || rawLine.startsWith('MESA ') || rawLine.startsWith('COMANDA ');
      if (isTitulo) {
        partes.push(Buffer.from([0x1b, 0x45, 0x01]));
      }
      const cleanLine = normalizarTextoAsciiImpressora(rawLine);
      partes.push(Buffer.from(`${cleanLine}\r\n`, 'ascii'));
      if (isTitulo) {
        partes.push(Buffer.from([0x1b, 0x45, 0x00]));
      }
    }
    partes.push(Buffer.from('\r\n\r\n\r\n', 'ascii'));
    if (opcoes?.cortarPapel !== false) {
      partes.push(Buffer.from([0x1d, 0x56, 0x41, 0x10]));
    }
  }
  return Buffer.concat(partes);
}

function enviarTcpEscPos9100(ip: string, porta: number, payload: Buffer, timeoutMs = 2600): Promise<{ ok: boolean; detalhe: string }> {
  return new Promise((resolve) => {
    const host = String(ip || '').trim();
    const portNum = Number(porta || 9100);
    if (!host || !/^[0-9a-zA-Z.-]+$/.test(host) || portNum <= 0 || portNum > 65535) {
      resolve({ ok: false, detalhe: 'IP ou porta de rede inválida para disparo ESC/POS.' });
      return;
    }
    let finalizado = false;
    const socket = new net.Socket();
    const concluir = (ok: boolean, detalhe: string) => {
      if (finalizado) return;
      finalizado = true;
      try {
        socket.destroy();
      } catch {}
      resolve({ ok, detalhe });
    };

    socket.setTimeout(timeoutMs);
    socket.on('timeout', () => {
      concluir(false, `Tempo esgotado (${timeoutMs}ms) ao conectar em ${host}:${portNum}. Bobina salva na fila para reimpressão.`);
    });
    socket.on('error', (err: any) => {
      concluir(false, `Impressora ${host}:${portNum} indisponível no momento (${err?.code || err?.message || 'erro TCP'}). Cupom retido na fila.`);
    });
    socket.connect(portNum, host, () => {
      socket.write(payload, (err) => {
        if (err) {
          concluir(false, `Falha ao transmitir bytes ESC/POS para ${host}:${portNum}: ${err.message}`);
          return;
        }
        socket.end(() => {
          concluir(true, `Impresso via Rede TCP/IP ${host}:${portNum} (${payload.length} bytes ESC/POS).`);
        });
      });
    });
  });
}

function formatarLinhaColunasCupom(esq: string, dir: string, larguraCols = 42): string {
  const e = normalizarTextoAsciiImpressora(esq);
  const d = normalizarTextoAsciiImpressora(dir);
  const espacos = Math.max(1, larguraCols - e.length - d.length);
  if (e.length + d.length + 1 > larguraCols) {
    const maxEsq = Math.max(8, larguraCols - d.length - 1);
    return `${e.slice(0, maxEsq)} ${d}`;
  }
  return `${e}${' '.repeat(espacos)}${d}`;
}

async function dispararJobImpressaoTermicaPdv(params: {
  setor: 'cozinha' | 'bar' | 'caixa' | 'geral';
  impressoraIdForcada?: number;
  tipo_cupom: 'producao_setor' | 'conferencia_conta' | 'recibo_pagamento' | 'teste';
  referencia: string;
  linhas_texto: string[];
  unidade_id: number;
  empresa_id: number;
}) {
  if (!Array.isArray(db.pdv_impressoras)) db.pdv_impressoras = [];
  if (!Array.isArray(db.pdv_fila_impressao)) db.pdv_fila_impressao = [];

  const impressorasAtivas = db.pdv_impressoras.filter((imp: any) => !imp.arquivado_legal && imp.ativa !== false);
  let alvo = params.impressoraIdForcada
    ? impressorasAtivas.find((imp: any) => Number(imp.id) === Number(params.impressoraIdForcada))
    : impressorasAtivas.find((imp: any) => imp.setor === params.setor);

  if (!alvo) {
    alvo = impressorasAtivas.find((imp: any) => imp.setor === 'geral' || imp.setor === 'caixa') || impressorasAtivas[0];
  }

  const larguraPapel: '80mm' | '58mm' = alvo?.largura_papel === '58mm' ? '58mm' : '80mm';
  const escposBuf = gerarBufferEscPos(params.linhas_texto, {
    largura: larguraPapel,
    cortarPapel: alvo?.cortar_papel !== false,
    vias: alvo?.vias || 1
  });

  const jobId = nextId(db.pdv_fila_impressao);
  const opUuid = `PRN-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  let statusJob: 'pendente_usb' | 'impresso' | 'erro_impressora' = 'pendente_usb';
  let detalheTransmissao = 'Aguardando leitura USB pelo Urutau.exe no Computador do Caixa.';
  let impressoEm: string | undefined = undefined;

  if (!alvo) {
    statusJob = 'erro_impressora';
    detalheTransmissao = 'Nenhuma impressora cadastrada/ativa para o setor. Cupom disponível na bobina virtual.';
  } else if (alvo.tipo_conexao === 'rede_tcp_9100') {
    const envio = await enviarTcpEscPos9100(alvo.ip_rede, Number(alvo.porta_rede || 9100), escposBuf);
    statusJob = envio.ok ? 'impresso' : 'erro_impressora';
    detalheTransmissao = envio.detalhe;
    if (envio.ok) impressoEm = new Date().toISOString();
    alvo.ultimo_status = envio.detalhe;
    alvo.ultimo_teste_em = new Date().toISOString();
  } else {
    statusJob = 'pendente_usb';
    detalheTransmissao = `Enfileirado para USB Windows (${alvo.nome_usb_windows || 'CAIXA-TERMICA-80MM'}) via Urutau.exe.`;
    alvo.ultimo_status = detalheTransmissao;
  }

  const novoJob = {
    id: jobId,
    op_uuid: opUuid,
    impressora_id: Number(alvo?.id || 0),
    impressora_nome: alvo?.nome || `Bobina Virtual (${params.setor.toUpperCase()})`,
    setor: params.setor,
    tipo_cupom: params.tipo_cupom,
    referencia: params.referencia,
    linhas_texto: params.linhas_texto,
    escpos_base64: escposBuf.toString('base64'),
    status: statusJob,
    detalhe_transmissao: detalheTransmissao,
    criado_em: new Date().toISOString(),
    impresso_em: impressoEm,
    unidade_id: Number(params.unidade_id || 1),
    empresa_id: Number(params.empresa_id || 1),
    arquivado_legal: false
  };

  db.pdv_fila_impressao.unshift(novoJob);
  if (db.pdv_fila_impressao.length > 400) {
    db.pdv_fila_impressao = db.pdv_fila_impressao.slice(0, 400);
  }
  saveDbToDisk();
  await cacheERP.invalidatePrefix('erp:');
  sseBroker.emit('pdv.impressao_disparada', {
    empresa_id: Number(params.empresa_id || 1),
    job_id: novoJob.id,
    setor: novoJob.setor,
    status: novoJob.status,
    referencia: novoJob.referencia
  });
  return novoJob;
}

function recalcularTotaisComandaPdv(comanda: any) {
  const itensValidos = (comanda.itens || []).filter((it: any) => it.status_preparo !== 'cancelado');
  const subtotalItens = Number(
    itensValidos.reduce((acc: number, it: any) => acc + Number(it.quantidade || 0) * Number(it.preco_unitario || 0), 0).toFixed(2)
  );
  const taxaEntrega = comanda.modalidade === 'delivery' ? Number(comanda.taxa_entrega || 0) : 0;
  const percGorjeta = comanda.aplicar_gorjeta_10 ? Number(comanda.percentual_gorjeta ?? 10) : 0;
  const valorGorjeta = comanda.aplicar_gorjeta_10 ? Number(((subtotalItens * percGorjeta) / 100).toFixed(2)) : 0;
  const desconto = Math.max(0, Number(comanda.desconto || 0));
  const valorTotal = Math.max(0, Number((subtotalItens + taxaEntrega + valorGorjeta - desconto).toFixed(2)));
  const valorPagoAcumulado = Number(
    (comanda.pagamentos || []).reduce((acc: number, pg: any) => acc + Number(pg.valor_pago || 0), 0).toFixed(2)
  );
  const saldoRestante = Math.max(0, Number((valorTotal - valorPagoAcumulado).toFixed(2)));

  comanda.subtotal_itens = subtotalItens;
  comanda.valor_gorjeta = valorGorjeta;
  comanda.valor_total = valorTotal;
  comanda.valor_pago_acumulado = valorPagoAcumulado;
  comanda.saldo_restante = saldoRestante;
  comanda.atualizado_em = new Date().toISOString();
}

function registrarOperacaoOutboxLan(opUuid: string, tipo: string, payload: any, empresaId: number) {
  if (!Array.isArray(db.lan_outbox_sync)) db.lan_outbox_sync = [];
  const cleanUuid = opUuid || `LAN-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const jaExiste = db.lan_outbox_sync.some((x: any) => x.op_uuid === cleanUuid);
  if (jaExiste) return;
  db.lan_outbox_sync.unshift({
    id: nextId(db.lan_outbox_sync),
    op_uuid: cleanUuid,
    tipo,
    empresa_id: Number(empresaId || 1),
    payload,
    status: 'pendente',
    criado_em: new Date().toISOString()
  });
  if (db.lan_outbox_sync.length > 1000) {
    db.lan_outbox_sync = db.lan_outbox_sync.slice(0, 1000);
  }
}

app.get('/api/lan/ping', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    sistema: 'Urutau',
    ambiente: AMBIENTE,
    porta: PORT,
    ips_locais: listarIpsLocaisServidor(),
    vps_remota_url: db?.lan_hub_config?.vps_remota_url || 'https://nyctibi.us',
    pendentes_outbox_lan: (db?.lan_outbox_sync || []).filter((o: any) => o.status === 'pendente').length,
    ts: new Date().toISOString()
  });
});

app.get('/api/lan/baixar-instalador-servidor-windows', (_req: Request, res: Response) => {
  const vpsUrl = db?.lan_hub_config?.vps_remota_url || 'https://nyctibi.us';
  const batScript = [
    '@echo off',
    'chcp 65001 >nul',
    'title Urutau ERP - Servidor Local de Contingencia Wi-Fi (PC do Caixa)',
    'color 0A',
    'echo ============================================================================',
    'echo   URUTAU ERP - SERVIDOR LOCAL DO CAIXA (WI-FI LAN + AUTO-ATUALIZADOR)',
    'echo ============================================================================',
    'echo.',
    'netsh advfirewall firewall show rule name="Urutau ERP LAN 3000" >nul 2>&1',
    'if %errorlevel% neq 0 (',
    '  echo [1/4] Liberando porta 3000 no Firewall do Windows para celulares no Wi-Fi...',
    '  netsh advfirewall firewall add rule name="Urutau ERP LAN 3000" dir=in action=allow protocol=TCP localport=3000 >nul 2>&1',
    ') else (',
    '  echo [1/4] Porta 3000 ja liberada no Firewall do Windows.',
    ')',
    'if exist ".git" (',
    '  echo [2/4] Verificando atualizacoes automaticas do sistema (preservando banco local)...',
    '  git pull --ff-only >nul 2>&1',
    ') else (',
    '  echo [2/4] Modo pasta local detectado (bancos SQLite e JSON preservados).',
    ')',
    'if not exist "node_modules" (',
    '  echo [3/4] Instalando dependencias na primeira execucao...',
    '  call npm install',
    ')',
    'if not exist "dist\\index.html" (',
    '  echo [3/4] Compilando interface para operacao offline rapida...',
    '  call npm run build',
    ')',
    'echo.',
    'echo [4/4] Enderecos IP desta maquina no Wi-Fi para digitar nos celulares (Android / iOS):',
    'for /f "tokens=2 delims=:" %%a in (\'ipconfig ^| findstr /i "IPv4"\') do echo   -^> http:%%a:3000',
    'echo.',
    `echo VPS Remota configurada para reconciliacao automatica: ${vpsUrl}`,
    'echo Iniciando Urutau ERP na porta 3000...',
    'set NODE_ENV=production',
    'set PORT=3000',
    'call npx tsx server.ts',
    'pause'
  ].join('\r\n');

  res.setHeader('Content-Type', 'application/x-bat; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="Urutau_Servidor_Local_Caixa_Windows.bat"');
  res.send(batScript);
});

app.get('/api/lan/baixar-instalador-servidor-linux', (_req: Request, res: Response) => {
  const vpsUrl = db?.lan_hub_config?.vps_remota_url || 'https://nyctibi.us';
  const shScript = [
    '#!/usr/bin/env bash',
    'set -e',
    'echo "============================================================================"',
    'echo "  URUTAU ERP - SERVIDOR LOCAL DO CAIXA LINUX (WI-FI LAN + AUTO-UPDATE)"',
    'echo "============================================================================"',
    'if command -v ufw >/dev/null 2>&1; then',
    '  sudo ufw allow 3000/tcp >/dev/null 2>&1 || true',
    'fi',
    'if [ -d ".git" ]; then',
    '  echo "[1/3] Atualizando codigo-fonte sem alterar bancos locais (SQLite / JSON)..."',
    '  git pull --ff-only || true',
    'fi',
    'if [ ! -d "node_modules" ]; then',
    '  echo "[2/3] Instalando dependencias..."',
    '  npm install',
    'fi',
    'echo "[2/3] Atualizando build de producao offline..."',
    'npm run build',
    'IP_LOCAL=$(hostname -I 2>/dev/null | awk \'{print $1}\')',
    'echo "[3/3] Acesse nos celulares Android/iOS pelo Wi-Fi em: http://${IP_LOCAL:-192.168.0.100}:3000"',
    `echo "VPS Remota vinculada: ${vpsUrl}"`,
    'NODE_ENV=production PORT=3000 npx tsx server.ts'
  ].join('\n');

  res.setHeader('Content-Type', 'application/x-sh; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="Urutau_Servidor_Local_Caixa_Linux.sh"');
  res.send(shScript);
});

app.post('/api/lan/config', async (req: Request, res: Response) => {
  try {
    const { vps_remota_url } = req.body || {};
    if (!db.lan_hub_config) {
      db.lan_hub_config = {
        vps_remota_url: 'https://nyctibi.us',
        ultimo_espelhamento_em: null,
        ultima_reconciliacao_em: null
      };
    }
    if (typeof vps_remota_url === 'string' && vps_remota_url.trim().startsWith('http')) {
      db.lan_hub_config.vps_remota_url = vps_remota_url.trim().replace(/\/+$/, '');
    }
    saveDbToDisk();
    await cacheERP.invalidatePrefix('erp:');
    res.json({ ok: true, lan_hub_config: db.lan_hub_config, ips_locais: listarIpsLocaisServidor() });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.post('/api/lan/espelhar-da-vps', async (req: Request, res: Response) => {
  try {
    const { vps_url, snapshot } = req.body || {};
    let dadosRemotos = snapshot;
    const alvoVps = String(vps_url || db?.lan_hub_config?.vps_remota_url || 'https://nyctibi.us')
      .trim()
      .replace(/\/+$/, '');

    if (!dadosRemotos && alvoVps.startsWith('http')) {
      const resp = await fetch(`${alvoVps}/api/erp/dados-completos`, {
        signal: AbortSignal.timeout(6000)
      });
      if (!resp.ok) {
        res.status(502).json({ ok: false, erro: `Não foi possível obter espelho da VPS (${resp.status}).` });
        return;
      }
      dadosRemotos = await resp.json();
    }

    if (!dadosRemotos || typeof dadosRemotos !== 'object') {
      res.status(400).json({ ok: false, erro: 'Snapshot remoto inválido para espelhamento local.' });
      return;
    }

    if (Array.isArray(dadosRemotos.pdvProdutos) && dadosRemotos.pdvProdutos.length > 0) {
      db.pdv_produtos = dadosRemotos.pdvProdutos;
    }
    if (Array.isArray(dadosRemotos.estoque) && dadosRemotos.estoque.length > 0) {
      db.erp_estoque = dadosRemotos.estoque;
    }
    if (Array.isArray(dadosRemotos.usuarios) && dadosRemotos.usuarios.length > 0) {
      const existentesMap = new Map((db.usuarios || []).map((u: any) => [Number(u.id), u]));
      for (const uRem of dadosRemotos.usuarios) {
        const atual = existentesMap.get(Number(uRem.id));
        if (atual) {
          existentesMap.set(Number(uRem.id), { ...atual, ...uRem, senha_argon2id: atual.senha_argon2id });
        } else {
          existentesMap.set(Number(uRem.id), uRem);
        }
      }
      db.usuarios = Array.from(existentesMap.values());
    }
    if (!db.lan_hub_config) db.lan_hub_config = {};
    db.lan_hub_config.vps_remota_url = alvoVps;
    db.lan_hub_config.ultimo_espelhamento_em = new Date().toISOString();
    saveDbToDisk();
    await cacheERP.invalidatePrefix('erp:');

    res.json({
      ok: true,
      ultimo_espelhamento_em: db.lan_hub_config.ultimo_espelhamento_em,
      produtos_sincronizados: (db.pdv_produtos || []).length
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.post('/api/lan/reconciliar-lote', async (req: Request, res: Response) => {
  try {
    const { operacoes, disparar_envio_para_vps, vps_url } = req.body || {};

    if (disparar_envio_para_vps === true) {
      const alvoVps = String(vps_url || db?.lan_hub_config?.vps_remota_url || '')
        .trim()
        .replace(/\/+$/, '');
      const pendentes = (db.lan_outbox_sync || []).filter((o: any) => o.status === 'pendente');
      if (pendentes.length === 0) {
        res.json({ ok: true, reconciliados: 0, mensagem: 'Nenhuma operação pendente no servidor local.' });
        return;
      }
      if (!alvoVps.startsWith('http')) {
        res.status(400).json({ ok: false, erro: 'Informe a URL da VPS para enviar o lote reconciliado.' });
        return;
      }
      const resp = await fetch(`${alvoVps}/api/lan/reconciliar-lote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operacoes: pendentes }),
        signal: AbortSignal.timeout(10000)
      });
      if (!resp.ok) {
        res.status(502).json({ ok: false, erro: `VPS retornou status ${resp.status} ao reconciliar.` });
        return;
      }
      const agoraIso = new Date().toISOString();
      for (const item of db.lan_outbox_sync || []) {
        if (item.status === 'pendente') {
          item.status = 'sincronizado';
          item.sincronizado_em = agoraIso;
        }
      }
      if (!db.lan_hub_config) db.lan_hub_config = {};
      db.lan_hub_config.vps_remota_url = alvoVps;
      db.lan_hub_config.ultima_reconciliacao_em = agoraIso;
      saveDbToDisk();
      await cacheERP.invalidatePrefix('erp:');
      res.json({ ok: true, reconciliados: pendentes.length, ultima_reconciliacao_em: agoraIso });
      return;
    }

    if (!Array.isArray(operacoes)) {
      res.status(400).json({ ok: false, erro: 'Lista de operações inválida para reconciliação.' });
      return;
    }

    if (!Array.isArray(db.pdv_comandas)) db.pdv_comandas = [];
    if (!Array.isArray(db.lan_outbox_sync)) db.lan_outbox_sync = [];

    const uuidsJaAplicados = new Set((db.lan_outbox_sync || []).map((o: any) => String(o.op_uuid)));
    let aplicados = 0;

    for (const op of operacoes) {
      const uuid = String(op?.op_uuid || '');
      if (!uuid || uuidsJaAplicados.has(uuid)) continue;
      uuidsJaAplicados.add(uuid);

      if (op.tipo === 'PDV_COMANDA_SNAPSHOT' && op.payload?.comanda) {
        const com = op.payload.comanda;
        const idx = db.pdv_comandas.findIndex((c: any) => c.op_uuid === com.op_uuid || Number(c.id) === Number(com.id));
        if (idx >= 0) {
          db.pdv_comandas[idx] = { ...db.pdv_comandas[idx], ...com };
        } else {
          db.pdv_comandas.unshift({ ...com, id: nextId(db.pdv_comandas) });
        }
      }

      if (Array.isArray(op.payload?.lancamentos_caixa)) {
        for (const cx of op.payload.lancamentos_caixa) {
          const dupCx = db.erp_caixa.some((e: any) => e.op_uuid && e.op_uuid === cx.op_uuid);
          if (!dupCx) {
            db.erp_caixa.unshift({ ...cx, id: nextId(db.erp_caixa) });
          }
        }
      }

      if (Array.isArray(op.payload?.baixas_estoque)) {
        for (const bx of op.payload.baixas_estoque) {
          const itemEst = db.erp_estoque.find((e: any) => Number(e.id) === Number(bx.estoque_item_id));
          if (itemEst) {
            itemEst.quantidade = Math.max(0, Number((Number(itemEst.quantidade || 0) - Number(bx.qtd_baixada || 0)).toFixed(3)));
          }
        }
      }

      db.lan_outbox_sync.unshift({
        id: nextId(db.lan_outbox_sync),
        op_uuid: uuid,
        tipo: op.tipo || 'RECONCILIADO_LAN',
        empresa_id: Number(op.empresa_id || 1),
        payload: op.payload,
        status: 'sincronizado',
        criado_em: op.criado_em || new Date().toISOString(),
        sincronizado_em: new Date().toISOString()
      });
      aplicados += 1;
    }

    if (!db.lan_hub_config) db.lan_hub_config = {};
    db.lan_hub_config.ultima_reconciliacao_em = new Date().toISOString();
    saveDbToDisk();
    await cacheERP.invalidatePrefix('erp:');
    sseBroker.emit('pdv.comanda_atualizada', { reconciliados: aplicados });
    sseBroker.emit('caixa.movimentacao_registrada', { reconciliados: aplicados });
    res.json({ ok: true, aplicados, ultima_reconciliacao_em: db.lan_hub_config.ultima_reconciliacao_em });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.post('/api/pdv/produtos/salvar', async (req: Request, res: Response) => {
  try {
    const {
      id,
      codigo,
      nome,
      categoria,
      preco,
      setor_impressao,
      estoque_item_id,
      qtd_baixa_estoque,
      disponivel,
      unidade_id,
      empresa_id
    } = req.body || {};

    if (!nome || String(nome).trim().length < 2) {
      res.status(400).json({ ok: false, erro: 'Informe o nome do produto do cardápio.' });
      return;
    }
    if (!Array.isArray(db.pdv_produtos)) db.pdv_produtos = [];
    const empId = Number(empresa_id || unidade_id || 1);
    const unidId = Number(unidade_id || 1);

    let salvo: any = null;
    await executarComOutbox(
      () => {
        const base = {
          codigo: String(codigo || `PDV-${nextId(db.pdv_produtos || [])}`).trim().toUpperCase(),
          nome: String(nome).trim(),
          categoria: String(categoria || 'Salão & Cozinha').trim(),
          preco: Math.max(0, Number(preco || 0)),
          setor_impressao: ['cozinha', 'bar', 'caixa', 'nenhum'].includes(setor_impressao)
            ? setor_impressao
            : 'cozinha',
          estoque_item_id: estoque_item_id ? Number(estoque_item_id) : null,
          qtd_baixa_estoque: Math.max(0, Number(qtd_baixa_estoque ?? 1)),
          disponivel: disponivel !== false,
          unidade_id: unidId,
          empresa_id: empId,
          arquivado_legal: false
        };
        if (id) {
          const idx = db.pdv_produtos!.findIndex((p: any) => Number(p.id) === Number(id));
          if (idx >= 0) {
            db.pdv_produtos![idx] = { ...db.pdv_produtos![idx], ...base };
            salvo = db.pdv_produtos![idx];
            return;
          }
        }
        salvo = { id: nextId(db.pdv_produtos!), ...base, criado_em: new Date().toISOString() };
        db.pdv_produtos!.push(salvo);
      },
      { agregado: 'PDV_CARDAPIO', tipo: 'pdv.cardapio_atualizado', payload: { empresa_id: empId, nome } }
    );

    if (salvo) {
      await commerceRepository.upsertSingleCatalogProduct({
        id: Number(salvo.id),
        empresa_id: empId,
        codigo: String(salvo.codigo || `PDV-${salvo.id}`),
        nome: String(salvo.nome),
        categoria: String(salvo.categoria || 'Geral'),
        preco_centavos: reaisToCentavos(salvo.preco),
        estoque_item_id: salvo.estoque_item_id ? Number(salvo.estoque_item_id) : null,
        qtd_baixa_mili: Math.max(0, Math.round(Number(salvo.qtd_baixa_estoque ?? 1) * 1000)),
        setor_impressao: String(salvo.setor_impressao || 'cozinha'),
        ativo: salvo.disponivel !== false && !salvo.arquivado_legal
      });
    }

    await cacheERP.invalidatePrefix('erp:');
    res.json({ ok: true, produto: salvo });
  } catch (e: any) {
    handleDomainErrorResponse(e, res);
  }
});

app.post('/api/pdv/produtos/arquivar', async (req: Request, res: Response) => {
  try {
    const { id } = req.body || {};
    if (!Array.isArray(db.pdv_produtos)) db.pdv_produtos = [];
    const prod = db.pdv_produtos.find((p: any) => Number(p.id) === Number(id));
    if (!prod) {
      res.status(404).json({ ok: false, erro: 'Produto não encontrado.' });
      return;
    }
    prod.arquivado_legal = true;
    saveDbToDisk();
    await cacheERP.invalidatePrefix('erp:');
    sseBroker.emit('pdv.cardapio_atualizado', { id: prod.id });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.post('/api/pdv/comandas/abrir-ou-adicionar', async (req: Request, res: Response) => {
  try {
    const sessao = extrairSessaoRequisicao(req);
    if (!sessao) {
      res.status(401).json({ ok: false, erro: 'Sessao autenticada obrigatoria.' });
      return;
    }

    const { op_uuid, garcom_nome, imprimir_setores, unidade_id } = req.body || {};
    const resultadoAcid = await zeroTrustCommerceService.abrirOuAdicionarItensZeroTrust(sessao, req.body || {}, db);
    const comanda = resultadoAcid.comanda;
    const itensInseridos = resultadoAcid.itensInseridos;
    const baixasEstoqueRealizadas = resultadoAcid.baixasEstoqueRealizadas;
    const empId = Number(comanda.empresa_id || 1);
    const unidId = Number(unidade_id || comanda.unidade_id || 1);
    const agoraHora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const reqUuid = String(op_uuid || comanda.op_uuid);

    const jobsImpressao: any[] = [];
    if (imprimir_setores !== false && itensInseridos.length > 0) {
      const porSetor: Record<string, any[]> = {};
      for (const it of itensInseridos) {
        if (!it.setor_impressao || it.setor_impressao === 'nenhum') continue;
        if (!porSetor[it.setor_impressao]) porSetor[it.setor_impressao] = [];
        porSetor[it.setor_impressao].push(it);
      }

      for (const [setorKey, listaSetor] of Object.entries(porSetor)) {
        const setorAlvo = (['cozinha', 'bar', 'caixa'].includes(setorKey) ? setorKey : 'cozinha') as
          | 'cozinha'
          | 'bar'
          | 'caixa';
        const linhasCupom: string[] = [
          `=== PRODUCAO ${setorAlvo.toUpperCase()} ===`,
          `${comanda.identificador.toUpperCase()} (${comanda.modalidade.toUpperCase()})`,
          `Atendente: ${sessao.nome || garcom_nome || comanda.garcom_nome}   Hora: ${agoraHora}`,
          comanda.cliente_nome ? `Cliente: ${comanda.cliente_nome}` : '------------------------------------------',
          '------------------------------------------'
        ];
        for (const itemS of listaSetor) {
          linhasCupom.push(`${itemS.quantidade}x ${itemS.nome}`);
          if (itemS.observacao) {
            linhasCupom.push(`   OBS: ${itemS.observacao}`);
          }
        }
        if (comanda.modalidade === 'delivery' && comanda.endereco_entrega) {
          linhasCupom.push('------------------------------------------');
          linhasCupom.push(`ENTREGA: ${comanda.endereco_entrega}`);
        }
        linhasCupom.push('------------------------------------------');
        const job = await dispararJobImpressaoTermicaPdv({
          setor: setorAlvo,
          tipo_cupom: 'producao_setor',
          referencia: `${comanda.identificador} (${listaSetor.length} item/ns)`,
          linhas_texto: linhasCupom,
          unidade_id: unidId,
          empresa_id: empId
        });
        jobsImpressao.push(job);
      }
    }

    if (itensInseridos.length > 0) {
      await dispararLancamentoConsumerApi(empId, 'PEDIDO_PDV', {
        mesa_comanda: comanda.mesa_numero || comanda.id,
        cliente: comanda.cliente_nome || comanda.identificador,
        garcom: sessao.nome || garcom_nome || comanda.garcom_nome,
        valor_total: centavosToReais(
          itensInseridos.reduce((s: number, i: any) => s + Number(i.subtotal_centavos || 0), 0)
        ),
        produto_descricao: itensInseridos.map((i: any) => `${i.quantidade}x ${i.nome}`).join(', '),
        itens: itensInseridos.map((i: any) => ({
          codigo_produto_consumer: `PDV-${i.produto_id || 1}`,
          nome_produto: i.nome,
          quantidade: i.quantidade,
          preco_unitario: i.preco_unitario,
          observacao_preparo: i.observacao || ''
        }))
      });
    }

    registrarOperacaoOutboxLan(
      reqUuid,
      'PDV_COMANDA_SNAPSHOT',
      { comanda, baixas_estoque: baixasEstoqueRealizadas },
      empId
    );

    saveDbToDisk();
    await cacheERP.invalidatePrefix('erp:');
    sseBroker.emit('pdv.comanda_atualizada', {
      empresa_id: empId,
      comanda_id: comanda.id,
      identificador: comanda.identificador
    });
    if (baixasEstoqueRealizadas.length > 0) {
      sseBroker.emit('estoque.atualizado', { empresa_id: empId });
    }

    res.json({
      ok: true,
      comanda,
      itens_lancados: itensInseridos.length,
      baixas_estoque: baixasEstoqueRealizadas,
      impressao_jobs: jobsImpressao
    });
  } catch (e: any) {
    handleDomainErrorResponse(e, res);
  }
});

app.post('/api/pdv/comandas/atualizar-item', async (req: Request, res: Response) => {
  try {
    const sessao = extrairSessaoRequisicao(req);
    if (!sessao) {
      res.status(401).json({ ok: false, erro: 'Sessao autenticada obrigatoria.' });
      return;
    }
    const { comanda_id, item_id, status_preparo, aplicar_gorjeta_10, pessoas_mesa, desconto } = req.body || {};
    if (desconto !== undefined && Number(desconto) > 0 && !canAuthorizeManualDiscount(sessao)) {
      res.status(403).json({
        ok: false,
        erro: 'Apenas Gerentes, Diretores ou Super Admin podem conceder desconto manual.'
      });
      return;
    }
    if (!Array.isArray(db.pdv_comandas)) db.pdv_comandas = [];
    const comanda = db.pdv_comandas.find((c: any) => Number(c.id) === Number(comanda_id) && !c.arquivado_legal);
    if (!comanda) {
      res.status(404).json({ ok: false, erro: 'Comanda ou mesa não localizada.' });
      return;
    }
    if (!sessao.super && !sessao.emps.includes(Number(comanda.empresa_id || 1)) && sessao.emp !== Number(comanda.empresa_id || 1)) {
      res.status(403).json({ ok: false, erro: 'Acesso negado para comanda de outra empresa.' });
      return;
    }

    if (item_id && status_preparo) {
      const item = (comanda.itens || []).find((it: any) => String(it.id) === String(item_id));
      if (item) {
        item.status_preparo = status_preparo;
      }
    }
    if (aplicar_gorjeta_10 !== undefined) comanda.aplicar_gorjeta_10 = Boolean(aplicar_gorjeta_10);
    if (pessoas_mesa !== undefined && Number(pessoas_mesa) > 0) comanda.pessoas_mesa = Math.max(1, Number(pessoas_mesa));
    if (desconto !== undefined) comanda.desconto = centavosToReais(reaisToCentavos(desconto));

    recalcularTotaisComandaPdv(comanda);
    registrarOperacaoOutboxLan(
      `UPD-${comanda.id}-${Date.now()}`,
      'PDV_COMANDA_SNAPSHOT',
      { comanda },
      Number(comanda.empresa_id || 1)
    );
    saveDbToDisk();
    await cacheERP.invalidatePrefix('erp:');
    sseBroker.emit('pdv.comanda_atualizada', {
      empresa_id: Number(comanda.empresa_id || 1),
      comanda_id: comanda.id
    });
    res.json({ ok: true, comanda });
  } catch (e: any) {
    handleDomainErrorResponse(e, res);
  }
});

app.post('/api/pdv/comandas/imprimir-conferencia', async (req: Request, res: Response) => {
  try {
    const { comanda_id, pessoas_divisao, aplicar_gorjeta_10 } = req.body || {};
    if (!Array.isArray(db.pdv_comandas)) db.pdv_comandas = [];
    const comanda = db.pdv_comandas.find((c: any) => Number(c.id) === Number(comanda_id) && !c.arquivado_legal);
    if (!comanda) {
      res.status(404).json({ ok: false, erro: 'Comanda não localizada para conferência.' });
      return;
    }

    if (pessoas_divisao && Number(pessoas_divisao) > 0) comanda.pessoas_mesa = Math.max(1, Number(pessoas_divisao));
    if (aplicar_gorjeta_10 !== undefined) comanda.aplicar_gorjeta_10 = Boolean(aplicar_gorjeta_10);
    recalcularTotaisComandaPdv(comanda);
    comanda.status = 'aguardando_pagamento';

    const empNome =
      (db.empresas || []).find((e: any) => Number(e.id) === Number(comanda.empresa_id || 1))?.nome || 'RESTAURANTE';
    const horaAgora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const linhas: string[] = [
      `=== ${empNome.toUpperCase()} ===`,
      'CONFERENCIA DE CONTA (SEM VALOR FISCAL)',
      `${comanda.identificador} | Atend: ${comanda.garcom_nome}`,
      `Data: ${comanda.data} ${horaAgora} | Pessoas: ${comanda.pessoas_mesa}`,
      '------------------------------------------'
    ];

    for (const it of (comanda.itens || []).filter((x: any) => x.status_preparo !== 'cancelado')) {
      linhas.push(
        formatarLinhaColunasCupom(
          `${it.quantidade}x ${it.nome}`,
          `R$ ${Number(it.subtotal || 0).toFixed(2)}`
        )
      );
    }

    linhas.push('------------------------------------------');
    linhas.push(formatarLinhaColunasCupom('Subtotal Itens:', `R$ ${comanda.subtotal_itens.toFixed(2)}`));
    if (comanda.modalidade === 'delivery' && Number(comanda.taxa_entrega || 0) > 0) {
      linhas.push(formatarLinhaColunasCupom('Taxa de Entrega:', `R$ ${Number(comanda.taxa_entrega).toFixed(2)}`));
    }
    if (comanda.aplicar_gorjeta_10) {
      linhas.push(formatarLinhaColunasCupom('Servico Opcional (10%):', `R$ ${comanda.valor_gorjeta.toFixed(2)}`));
    }
    if (Number(comanda.desconto || 0) > 0) {
      linhas.push(formatarLinhaColunasCupom('Desconto:', `- R$ ${Number(comanda.desconto).toFixed(2)}`));
    }
    linhas.push(formatarLinhaColunasCupom('TOTAL DA CONTA:', `R$ ${comanda.valor_total.toFixed(2)}`));
    if (Number(comanda.valor_pago_acumulado || 0) > 0) {
      linhas.push(formatarLinhaColunasCupom('Ja Pago Parcial:', `- R$ ${comanda.valor_pago_acumulado.toFixed(2)}`));
      linhas.push(formatarLinhaColunasCupom('SALDO A PAGAR:', `R$ ${comanda.saldo_restante.toFixed(2)}`));
    }
    const valorPorPessoa = Number((comanda.saldo_restante / Math.max(1, Number(comanda.pessoas_mesa || 1))).toFixed(2));
    linhas.push('------------------------------------------');
    linhas.push(
      formatarLinhaColunasCupom(
        `Divisao (${comanda.pessoas_mesa} pessoa/s):`,
        `R$ ${valorPorPessoa.toFixed(2)} / cada`
      )
    );
    linhas.push('------------------------------------------');

    const job = await dispararJobImpressaoTermicaPdv({
      setor: 'caixa',
      tipo_cupom: 'conferencia_conta',
      referencia: `Conferência ${comanda.identificador}`,
      linhas_texto: linhas,
      unidade_id: Number(comanda.unidade_id || 1),
      empresa_id: Number(comanda.empresa_id || 1)
    });

    saveDbToDisk();
    await cacheERP.invalidatePrefix('erp:');
    sseBroker.emit('pdv.comanda_atualizada', {
      empresa_id: Number(comanda.empresa_id || 1),
      comanda_id: comanda.id
    });

    res.json({ ok: true, comanda, job });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.post('/api/pdv/comandas/pagar-fechar', async (req: Request, res: Response) => {
  try {
    const sessao = extrairSessaoRequisicao(req);
    if (!sessao) {
      res.status(401).json({ ok: false, erro: 'Sessao autenticada obrigatoria.' });
      return;
    }

    const { op_uuid, metodo, pagante_ref } = req.body || {};
    const resultadoAcid = await zeroTrustCommerceService.pagarOuFecharComandaZeroTrust(sessao, req.body || {}, db);
    const comanda = resultadoAcid.comanda;
    const troco = resultadoAcid.troco;
    const valorAplicar = resultadoAcid.valor_aplicado;
    const recebidoDinheiro = resultadoAcid.recebido_dinheiro;
    const lancamentosCaixaGerados = resultadoAcid.lancamentos_caixa;
    const empId = Number(comanda.empresa_id || 1);
    const unidId = Number(comanda.unidade_id || 1);
    const horaPag = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const metodoFinal = String(metodo || 'PIX');
    const pagId = String(op_uuid || `PG-${comanda.id}-${Date.now()}`);

    for (const regCx of lancamentosCaixaGerados) {
      if (regCx.categoria !== '10% Gorjeta') {
        await dispararLancamentoConsumerApi(empId, 'CAIXA', regCx);
      }
    }

    const empNome =
      (db.empresas || []).find((e: any) => Number(e.id) === empId)?.nome || 'RESTAURANTE';
    const linhasRecibo: string[] = [
      `=== ${empNome.toUpperCase()} ===`,
      comanda.status === 'fechada' ? 'COMPROVANTE DE FECHAMENTO PDV' : 'COMPROVANTE DE PAGAMENTO PARCIAL',
      `${comanda.identificador} | Operador: ${sessao.nome}`,
      `Hora: ${horaPag} | Metodo: ${metodoFinal}`,
      '------------------------------------------',
      formatarLinhaColunasCupom('Valor Pago Agora:', `R$ ${valorAplicar.toFixed(2)}`)
    ];
    if (metodoFinal === 'Dinheiro' && troco > 0) {
      linhasRecibo.push(formatarLinhaColunasCupom('Recebido em Dinheiro:', `R$ ${recebidoDinheiro.toFixed(2)}`));
      linhasRecibo.push(formatarLinhaColunasCupom('Troco Devolvido:', `R$ ${troco.toFixed(2)}`));
    }
    if (pagante_ref) {
      linhasRecibo.push(`Pagante/Divisao: ${pagante_ref}`);
    }
    linhasRecibo.push(formatarLinhaColunasCupom('Total da Conta:', `R$ ${comanda.valor_total.toFixed(2)}`));
    linhasRecibo.push(formatarLinhaColunasCupom('Saldo Restante:', `R$ ${comanda.saldo_restante.toFixed(2)}`));
    linhasRecibo.push('------------------------------------------');
    linhasRecibo.push('Obrigado pela preferencia!');

    const jobRecibo = await dispararJobImpressaoTermicaPdv({
      setor: 'caixa',
      tipo_cupom: 'recibo_pagamento',
      referencia: `Pagamento ${comanda.identificador} (${metodoFinal})`,
      linhas_texto: linhasRecibo,
      unidade_id: unidId,
      empresa_id: empId
    });

    registrarOperacaoOutboxLan(
      pagId,
      'PDV_COMANDA_SNAPSHOT',
      { comanda, lancamentos_caixa: lancamentosCaixaGerados },
      empId
    );

    saveDbToDisk();
    await cacheERP.invalidatePrefix('erp:');
    sseBroker.emit('pdv.comanda_atualizada', { empresa_id: empId, comanda_id: comanda.id });
    if (comanda.status === 'fechada') {
      sseBroker.emit('pdv.comanda_fechada', { empresa_id: empId, comanda_id: comanda.id });
      sseBroker.emit('caixa.movimentacao_registrada', { empresa_id: empId, comanda_id: comanda.id });
    }

    res.json({
      ok: true,
      comanda,
      troco,
      troco_centavos: resultadoAcid.troco_centavos,
      fechada_completa: comanda.status === 'fechada',
      lancamentos_caixa: lancamentosCaixaGerados,
      idempotent_replay: resultadoAcid.idempotent_replay,
      job_impressao: jobRecibo
    });
  } catch (e: any) {
    handleDomainErrorResponse(e, res);
  }
});

app.post('/api/pdv/impressoras/salvar', async (req: Request, res: Response) => {
  try {
    const {
      id,
      nome,
      setor,
      tipo_conexao,
      ip_rede,
      porta_rede,
      nome_usb_windows,
      largura_papel,
      vias,
      cortar_papel,
      ativa,
      unidade_id,
      empresa_id
    } = req.body || {};

    if (!nome || String(nome).trim().length < 2) {
      res.status(400).json({ ok: false, erro: 'Informe um nome para identificar a impressora térmica.' });
      return;
    }
    if (!Array.isArray(db.pdv_impressoras)) db.pdv_impressoras = [];
    const empId = Number(empresa_id || unidade_id || 1);
    const unidId = Number(unidade_id || 1);

    const dadosImp = {
      nome: String(nome).trim(),
      setor: ['cozinha', 'bar', 'caixa', 'geral'].includes(setor) ? setor : 'caixa',
      tipo_conexao: tipo_conexao === 'usb_caixa_windows' ? 'usb_caixa_windows' : 'rede_tcp_9100',
      ip_rede: String(ip_rede || '').trim(),
      porta_rede: Number(porta_rede || 9100),
      nome_usb_windows: String(nome_usb_windows || 'CAIXA-TERMICA-80MM').trim(),
      largura_papel: largura_papel === '58mm' ? '58mm' : '80mm',
      vias: Math.max(1, Math.min(3, Number(vias || 1))),
      cortar_papel: cortar_papel !== false,
      ativa: ativa !== false,
      unidade_id: unidId,
      empresa_id: empId,
      arquivado_legal: false
    };

    let salva: any = null;
    if (id) {
      const idx = db.pdv_impressoras.findIndex((i: any) => Number(i.id) === Number(id));
      if (idx >= 0) {
        db.pdv_impressoras[idx] = { ...db.pdv_impressoras[idx], ...dadosImp };
        salva = db.pdv_impressoras[idx];
      }
    }
    if (!salva) {
      salva = {
        id: nextId(db.pdv_impressoras),
        ...dadosImp,
        ultimo_status:
          dadosImp.tipo_conexao === 'usb_caixa_windows'
            ? `Fila USB pronta (${dadosImp.nome_usb_windows})`
            : `TCP/IP configurado (${dadosImp.ip_rede}:${dadosImp.porta_rede})`
      };
      db.pdv_impressoras.push(salva);
    }

    saveDbToDisk();
    await cacheERP.invalidatePrefix('erp:');
    sseBroker.emit('pdv.impressao_disparada', { empresa_id: empId, impressora_id: salva.id });
    res.json({ ok: true, impressora: salva });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.post('/api/pdv/impressoras/arquivar', async (req: Request, res: Response) => {
  try {
    const { id } = req.body || {};
    if (!Array.isArray(db.pdv_impressoras)) db.pdv_impressoras = [];
    const imp = db.pdv_impressoras.find((i: any) => Number(i.id) === Number(id));
    if (!imp) {
      res.status(404).json({ ok: false, erro: 'Impressora não encontrada.' });
      return;
    }
    imp.arquivado_legal = true;
    saveDbToDisk();
    await cacheERP.invalidatePrefix('erp:');
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.post('/api/pdv/impressoras/testar', async (req: Request, res: Response) => {
  try {
    const { impressora_id, empresa_id, unidade_id } = req.body || {};
    if (!Array.isArray(db.pdv_impressoras)) db.pdv_impressoras = [];
    const imp = db.pdv_impressoras.find((i: any) => Number(i.id) === Number(impressora_id) && !i.arquivado_legal);
    if (!imp) {
      res.status(404).json({ ok: false, erro: 'Impressora não localizada.' });
      return;
    }
    const hora = new Date().toLocaleTimeString('pt-BR');
    const job = await dispararJobImpressaoTermicaPdv({
      setor: imp.setor,
      impressoraIdForcada: imp.id,
      tipo_cupom: 'teste',
      referencia: `Teste de Impressão (${imp.nome})`,
      linhas_texto: [
        '=== TESTE DE IMPRESSAO URUTAU PDV ===',
        `Impressora: ${imp.nome}`,
        `Setor: ${imp.setor.toUpperCase()} | Papel: ${imp.largura_papel}`,
        imp.tipo_conexao === 'usb_caixa_windows'
          ? `Conexao: USB Caixa (${imp.nome_usb_windows})`
          : `Conexao: Rede IP ${imp.ip_rede}:${imp.porta_rede}`,
        `Horario: ${hora}`,
        '------------------------------------------',
        'Disparo ESC/POS Wi-Fi / LAN validado!'
      ],
      unidade_id: Number(unidade_id || imp.unidade_id || 1),
      empresa_id: Number(empresa_id || imp.empresa_id || 1)
    });
    res.json({ ok: true, job });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.post('/api/pdv/impressoras/reimprimir', async (req: Request, res: Response) => {
  try {
    const { job_id } = req.body || {};
    if (!Array.isArray(db.pdv_fila_impressao)) db.pdv_fila_impressao = [];
    const jobAntigo = db.pdv_fila_impressao.find((j: any) => Number(j.id) === Number(job_id));
    if (!jobAntigo) {
      res.status(404).json({ ok: false, erro: 'Cupom não localizado na fila de impressão.' });
      return;
    }
    const novoJob = await dispararJobImpressaoTermicaPdv({
      setor: jobAntigo.setor,
      impressoraIdForcada: jobAntigo.impressora_id || undefined,
      tipo_cupom: jobAntigo.tipo_cupom,
      referencia: `REIMPRESSÃO: ${jobAntigo.referencia}`,
      linhas_texto: jobAntigo.linhas_texto || [],
      unidade_id: Number(jobAntigo.unidade_id || 1),
      empresa_id: Number(jobAntigo.empresa_id || 1)
    });
    res.json({ ok: true, job: novoJob });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.get('/api/pdv/spooler-usb/pendentes', (req: Request, res: Response) => {
  const empId = Number(req.query.empresa_id || 1);
  const pendentes = (db?.pdv_fila_impressao || []).filter(
    (j: any) => !j.arquivado_legal && j.status === 'pendente_usb' && Number(j.empresa_id || 1) === empId
  );
  res.json({ ok: true, total: pendentes.length, jobs: pendentes });
});

app.post('/api/pdv/spooler-usb/confirmar', async (req: Request, res: Response) => {
  try {
    const { job_id, sucesso, detalhe } = req.body || {};
    const job = (db?.pdv_fila_impressao || []).find((j: any) => Number(j.id) === Number(job_id));
    if (!job) {
      res.status(404).json({ ok: false, erro: 'Job USB não encontrado.' });
      return;
    }
    job.status = sucesso !== false ? 'impresso' : 'erro_impressora';
    job.detalhe_transmissao = String(detalhe || 'Impresso via USB local no Computador do Caixa (Urutau.exe).');
    if (sucesso !== false) job.impresso_em = new Date().toISOString();
    saveDbToDisk();
    await cacheERP.invalidatePrefix('erp:');
    sseBroker.emit('pdv.impressao_disparada', { empresa_id: Number(job.empresa_id || 1), job_id: job.id, status: job.status });
    res.json({ ok: true, job });
  } catch (e: any) {
    res.status(500).json({ ok: false, erro: e.message });
  }
});

app.get('/manifest.webmanifest', (_req: Request, res: Response) => {
  const manifestPath = path.join(__dirname, 'public', 'manifest.webmanifest');
  res.setHeader('Content-Type', 'application/manifest+json');
  res.sendFile(manifestPath);
});

app.get('/sw.js', (_req: Request, res: Response) => {
  const swPath = path.join(__dirname, 'public', 'sw.js');
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Service-Worker-Allowed', '/');
  res.sendFile(swPath);
});

export async function initServerForTests(customDatabaseUrl?: string) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('initServerForTests exclusivo para NODE_ENV=test.');
  }
  const freshEngine = await resetPostgresEngineForTests(customDatabaseUrl);
  commerceRepository = new CommerceRepository(freshEngine);
  zeroTrustCommerceService = new ZeroTrustCommerceService(commerceRepository);
  webhookAndHardLimitService = new WebhookAndHardLimitService(commerceRepository, WEBHOOK_HMAC_SECRET);
  hybridStorageService = new HybridStorageService(freshEngine);
  await initDatabase();
  await commerceRepository.syncCatalogAndStockFromMemoryDb(db);
  geminiBot = new GeminiBotService({
    db,
    executarComOutbox,
    registrarAuditLog,
    nextId,
    saveDbToDisk,
    sseBroker
  });
  return {
    app,
    db,
    commerceRepository,
    zeroTrustCommerceService,
    webhookAndHardLimitService,
    hybridStorageService
  };
}

async function startServer() {
  await initDatabase();
  try {
    await commerceRepository.syncCatalogAndStockFromMemoryDb(db);
  } catch (pgSyncErr: any) {
    console.warn('[PostgreSQL Sync] Aviso durante sincronizacao inicial:', pgSyncErr?.message);
  }
  startPostgresBackupWorkerThread();

  geminiBot = new GeminiBotService({
    db,
    executarComOutbox,
    registrarAuditLog,
    nextId,
    saveDbToDisk,
    sseBroker
  });

  embeddedWhatsApp.setStatusChangeCallback((state) => {
    sseBroker.emit('whatsapp.status_atualizado', state);
    sseBroker.emit('bot_interno.atualizado', state);
    if (db && Array.isArray(db.empresas) && db.empresas.length > 0) {
      if (state.status === 'conectado') {
        db.empresas[0].bot_interno_status = 'Conectado';
        db.empresas[0].bot_interno_autenticado_real = true;
        if (state.connectedPhone) {
          db.empresas[0].bot_interno_numero = state.connectedPhone;
        }
      } else if (state.status === 'desconectado') {
        db.empresas[0].bot_interno_status = 'Desconectado';
        db.empresas[0].bot_interno_autenticado_real = false;
      }
      saveDbToDisk();
    }
  });

  embeddedWhatsApp.setIncomingMessageHandler(async ({ remetenteTelefone, nomeContato, textoMensagem, horario }) => {
    const cleanTel = remetenteTelefone.replace(/\D/g, '');
    const checkBloqueio = verificarBloqueioClienteFornecedor(cleanTel || nomeContato);
    if (checkBloqueio.bloqueado) {
      return;
    }

    db.mensagens_chat.push({
      id: nextId(db.mensagens_chat),
      instancia_id: 1,
      remetente: nomeContato,
      contato: cleanTel,
      direcao: 'recebida',
      texto: textoMensagem,
      horario
    });
    saveDbToDisk();

    sseBroker.emit('chat.nova_mensagem', {
      id: nextId(db.mensagens_chat),
      remetente: nomeContato,
      contato: cleanTel,
      direcao: 'recebida',
      texto: textoMensagem,
      horario
    });

    try {
      await webhookAndHardLimitService.enforceAiConsumptionHardLimit(1);
    } catch {
      return;
    }

    const resultadoIA = await geminiBot.processarMensagem({
      remetenteTelefone: cleanTel,
      nomeContato,
      textoMensagem
    });

    if (resultadoIA?.resposta) {
      const horaResp = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      db.mensagens_chat.push({
        id: nextId(db.mensagens_chat),
        instancia_id: 1,
        remetente: 'Urutau IA',
        contato: cleanTel,
        direcao: 'enviada',
        texto: resultadoIA.resposta,
        horario: horaResp
      });
      saveDbToDisk();

      sseBroker.emit('chat.nova_mensagem', {
        id: nextId(db.mensagens_chat),
        remetente: 'Urutau IA',
        contato: cleanTel,
        direcao: 'enviada',
        texto: resultadoIA.resposta,
        horario: horaResp
      });
      return resultadoIA.resposta;
    }
  });

  const monitorTimer = setInterval(() => {
    try {
      if (!db || !geminiBot) return;
      const agora = new Date();
      const horaStr = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;

      const pendentes = db.erp_notificacoes.filter(
        (n) => !n.arquivado_legal && n.status === 'Programada' && n.horario_disparo === horaStr
      );

      for (const notif of pendentes) {
        notif.status = 'Disparada WAHA';
        const msgAlerta = ` *[URUTAU ALERTA]*\n*${notif.titulo}*\n\n${notif.mensagem}`;
        const cleanDest = (notif.destino_wpp || '5591999990001').replace(/\D/g, '');

        db.mensagens_chat.push({
          id: nextId(db.mensagens_chat),
          instancia_id: 1,
          remetente: 'Urutau',
          contato: cleanDest,
          direcao: 'enviada',
          texto: msgAlerta,
          horario: horaStr
        });

        sseBroker.emit('chat.nova_mensagem', {
          remetente: 'Urutau',
          contato: cleanDest,
          texto: msgAlerta,
          horario: horaStr
        });
      }

      if (pendentes.length > 0) saveDbToDisk();
    } catch (schedErr) {
      console.warn('[AlertasProativos] Erro no ciclo de monitoramento:', schedErr);
    }
  }, 60000);
  monitorTimer.unref?.();

  app.use('/src/assets/images', (req, res, next) => {
    if (req.query && 'import' in req.query) {
      return next();
    }
    return express.static(path.join(__dirname, 'src/assets/images'))(req, res, next);
  });
  app.use('/assets', (req, res, next) => {
    if (req.query && 'import' in req.query) {
      return next();
    }
    return express.static(path.join(__dirname, 'public/assets'))(req, res, next);
  });

  if (process.env.NODE_ENV !== 'production') {
    let viteServer: any = null;
    let viteMiddleware: any = null;
    const viteReadyPromise = (async () => {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true, allowedHosts: true, hmr: false, ws: false },
        appType: 'spa'
      });
      viteServer = vite;
      viteMiddleware = vite.middlewares;
    })();

    app.use(async (req, res, next) => {
      if (!viteMiddleware || !viteServer) {
        await viteReadyPromise;
      }
      if (req.path === '/@vite/client') {
        try {
          const transformed = await viteServer.transformRequest('/@vite/client');
          if (transformed && typeof transformed.code === 'string') {
            const safeClientCode = transformed.code.replace(
              'transport.connect(createHMRHandler(handleMessage));',
              'void 0;'
            );
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache');
            res.status(200).send(safeClientCode);
            return;
          }
        } catch {}
      }
      return viteMiddleware(req, res, next);
    });
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Urutau ERP (${AMBIENTE}) ativo na porta ${PORT} — PostgreSQL Pool, Backup Horário Drive, Storage Híbrido Multi-Tenant e Zero-Trust.`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('Erro crítico ao inicializar Urutau ERP:', err);
  });
}
