import crypto from 'crypto';
import zlib from 'zlib';
import { Express, Request, Response } from 'express';
import { getPostgresEngine } from '../db/postgresEngine.ts';
import { TENANT_RELATIONAL_TABLES_FK_ORDER } from './tenantLogicalBackupService.ts';
import { HybridStorageService, StorageFileRecord } from './hybridStorageService.ts';
import { AuthenticatedOperatorContext } from './zeroTrustCommerceService.ts';

const SAFE_SQL_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

const SENSITIVE_FIELD_KEYS = new Set<string>([
  'senha',
  'senha_hash',
  'password',
  'password_hash',
  'pin',
  'pin_hash',
  'salt',
  'google_access_token',
  'refresh_token',
  'access_token',
  'session_token',
  'chave_secreta_planilha',
  'apikey',
  'api_key',
  'secret',
  'webhook_secret',
  'private_key'
]);

const OPERATIONAL_COLLECTION_KEYS: string[] = [
  'unidades',
  'setores',
  'cargos',
  'mesas',
  'mesas_layout',
  'reservas',
  'pdv_produtos',
  'pdv_comandas',
  'caixa',
  'rateios_historico',
  'estoque',
  'compras',
  'cmv',
  'movimentos_escala',
  'agenda',
  'checklists',
  'cadastros_pessoas',
  'erp_configs',
  'chat_mensagens',
  'matches_contratacoes',
  'audit_logs'
];

export interface TenantExportAccessResult {
  allowed: boolean;
  statusCode: 200 | 401 | 403;
  roleUsed?: 'admin_master' | 'company_owner';
  error?: string;
}

export interface TenantStorageAssetEntry {
  id: string;
  companyId: number;
  uploadType: string;
  storageTier: 'hot_local' | 'cold_gdrive';
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  staticUrl: string | null;
  downloadApiUrl: string;
  driveFileId: string | null;
  sha256Hash: string;
  createdAtUtc: string;
}

export interface TenantPortabilityDump {
  schemaVersion: 'urutau-lgpd-portability-v1';
  legalBasis: 'LGPD Art. 18, V - Portabilidade de Dados';
  companyId: number;
  companyName: string;
  exportedAtUtc: string;
  exportedBy: {
    uid: number;
    nome: string;
    role: 'admin_master' | 'company_owner';
  };
  companyProfile: Record<string, unknown> | null;
  relationalTables: Record<string, Record<string, unknown>[]>;
  operationalCollections: Record<string, Record<string, unknown>[]>;
  users: Record<string, unknown>[];
}

export interface TenantPortabilityPackage {
  dump: TenantPortabilityDump;
  storageAssets: {
    companyId: number;
    totalFiles: number;
    hotStorageCount: number;
    coldStorageCount: number;
    files: TenantStorageAssetEntry[];
  };
  manifest: {
    schemaVersion: 'urutau-lgpd-portability-v1';
    companyId: number;
    companyName: string;
    exportedAtUtc: string;
    exportedByUid: number;
    exportedByRole: 'admin_master' | 'company_owner';
    relationalTableCounts: Record<string, number>;
    operationalCollectionCounts: Record<string, number>;
    usersCount: number;
    storageAssetsCount: number;
    integrity: {
      databaseDumpSha256: string;
      storageAssetsSha256: string;
    };
  };
  zipBuffer: Buffer;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function computeCrc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc = CRC32_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function getDosDateTime(date: Date): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, date.getUTCFullYear());
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = Math.floor(date.getUTCSeconds() / 2);
  const dosTime = (hours << 11) | (minutes << 5) | seconds;
  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  return { dosTime, dosDate };
}

export function buildZipArchive(
  entries: Array<{ name: string; content: Buffer }>
): Buffer {
  const now = new Date();
  const { dosTime, dosDate } = getDosDateTime(now);
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const cleanName = String(entry.name || 'file.txt').replace(/^\/+/, '');
    const nameBuf = Buffer.from(cleanName, 'utf8');
    const rawBuf = Buffer.isBuffer(entry.content) ? entry.content : Buffer.from(entry.content);
    const compressedBuf = zlib.deflateRawSync(rawBuf, { level: 6 });
    const crc = computeCrc32(rawBuf);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressedBuf.length, 18);
    localHeader.writeUInt32LE(rawBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, compressedBuf);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressedBuf.length, 20);
    centralHeader.writeUInt32LE(rawBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + compressedBuf.length;
  }

  const centralDirBuf = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirBuf, eocd]);
}

export function scrubSensitiveFields<T>(input: T): T {
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) {
    return input.map((item) => scrubSensitiveFields(item)) as unknown as T;
  }
  if (typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (SENSITIVE_FIELD_KEYS.has(key.toLowerCase())) {
        continue;
      }
      out[key] = scrubSensitiveFields(value);
    }
    return out as T;
  }
  return input;
}

function isStrictCompanyOwner(
  sessao: AuthenticatedOperatorContext,
  legacyDb?: any
): boolean {
  const usuarios = Array.isArray(legacyDb?.usuarios) ? legacyDb.usuarios : [];
  const dbUser = usuarios.find((u: any) => Number(u?.id) === Number(sessao.uid));
  if (dbUser && typeof dbUser.role === 'string' && dbUser.role.trim().length > 0) {
    return dbUser.role.trim().toLowerCase() === 'company_owner';
  }

  const tipo = String(dbUser?.tipo || sessao.tipo || '').trim().toLowerCase();
  const cargo = String(dbUser?.cargo || sessao.cargo || '').trim().toLowerCase();
  const combined = `${tipo} ${cargo}`;
  if (
    combined.includes('garcom') ||
    combined.includes('garçom') ||
    combined.includes('cozinheir') ||
    combined.includes('atendente') ||
    combined.includes('caixa') ||
    combined.includes('gerente de loja') ||
    combined.includes('gerente de rh') ||
    tipo === 'gestor rh' ||
    tipo === 'gerente' ||
    tipo === 'colaborador'
  ) {
    return false;
  }
  return (
    tipo === 'gestor da empresa' ||
    cargo.includes('propriet') ||
    cargo.includes('empres') ||
    cargo.includes('dono') ||
    cargo.includes('sócio') ||
    cargo.includes('socio')
  );
}

export function evaluateTenantExportAccess(
  sessao: AuthenticatedOperatorContext | undefined,
  companyId: number,
  legacyDb?: any
): TenantExportAccessResult {
  if (!sessao || !Number.isInteger(Number(sessao.uid)) || Number(sessao.uid) <= 0) {
    return {
      allowed: false,
      statusCode: 401,
      error: 'Autenticação obrigatória para exportar os dados da empresa.'
    };
  }

  if (sessao.super === true) {
    return {
      allowed: true,
      statusCode: 200,
      roleUsed: 'admin_master'
    };
  }

  if (!isStrictCompanyOwner(sessao, legacyDb)) {
    return {
      allowed: false,
      statusCode: 403,
      error: 'Acesso restrito: apenas o proprietário da empresa (company_owner) ou Admin Master pode exportar os dados LGPD.'
    };
  }

  const allowedCompanyIds = new Set<number>();
  if (Number.isInteger(Number(sessao.emp)) && Number(sessao.emp) > 0) {
    allowedCompanyIds.add(Number(sessao.emp));
  }
  if (Array.isArray(sessao.emps)) {
    for (const id of sessao.emps) {
      const n = Number(id);
      if (Number.isInteger(n) && n > 0) allowedCompanyIds.add(n);
    }
  }

  if (!allowedCompanyIds.has(companyId)) {
    return {
      allowed: false,
      statusCode: 403,
      error: 'Isolamento multi-empresa: você só tem permissão para exportar os dados da sua própria empresa.'
    };
  }

  return {
    allowed: true,
    statusCode: 200,
    roleUsed: 'company_owner'
  };
}

function rowBelongsToCompany(row: any, companyId: number): boolean {
  if (!row || typeof row !== 'object') return false;
  const directId = Number(row.empresa_id ?? row.id_empresa ?? row.company_id ?? 0);
  if (directId === companyId) return true;
  if (Array.isArray(row.empresas_ids)) {
    return row.empresas_ids.map(Number).includes(companyId);
  }
  return false;
}

async function listAllStorageAssetsForExport(
  companyId: number,
  storageService?: HybridStorageService
): Promise<TenantStorageAssetEntry[]> {
  const engine = getPostgresEngine();
  let rawRecords: StorageFileRecord[] = [];

  if (engine.isConfigured() && (await engine.ensureReady())) {
    try {
      const res = await engine.query(
        `SELECT id, company_id, uploaded_by_uid, upload_type, storage_tier,
                original_name, mime_type, size_bytes, relative_path, drive_file_id,
                sha256_hash, created_at_utc
         FROM storage_files
         WHERE company_id = $1
         ORDER BY created_at_utc DESC`,
        [companyId]
      );
      rawRecords = res.rows.map((row: any) => ({
        id: String(row.id),
        companyId: Number(row.company_id),
        uploadedByUid: Number(row.uploaded_by_uid || 0),
        uploadType: row.upload_type,
        storageTier: row.storage_tier,
        originalName: String(row.original_name || ''),
        mimeType: String(row.mime_type || 'application/octet-stream'),
        sizeBytes: Number(row.size_bytes || 0),
        relativePath: row.relative_path ? String(row.relative_path) : null,
        driveFileId: row.drive_file_id ? String(row.drive_file_id) : null,
        sha256Hash: String(row.sha256_hash || ''),
        createdAtUtc: String(row.created_at_utc || '')
      }));
    } catch {
      rawRecords = storageService ? await storageService.listFilesForCompany(companyId) : [];
    }
  } else if (storageService) {
    rawRecords = await storageService.listFilesForCompany(companyId);
  }

  return rawRecords.map((rec) => ({
    id: rec.id,
    companyId: rec.companyId,
    uploadType: rec.uploadType,
    storageTier: rec.storageTier,
    originalName: rec.originalName,
    mimeType: rec.mimeType,
    sizeBytes: rec.sizeBytes,
    staticUrl: rec.storageTier === 'hot_local' ? rec.relativePath : null,
    downloadApiUrl: `/api/storage/download/${encodeURIComponent(rec.id)}`,
    driveFileId: rec.storageTier === 'cold_gdrive' ? rec.driveFileId : null,
    sha256Hash: rec.sha256Hash,
    createdAtUtc: rec.createdAtUtc
  }));
}

export async function buildTenantPortabilityPackage(
  companyIdInput: number,
  options: {
    legacyDb?: any;
    storageService?: HybridStorageService;
    exportedBy: {
      uid: number;
      nome: string;
      role: 'admin_master' | 'company_owner';
    };
  }
): Promise<TenantPortabilityPackage> {
  const companyId = Number(companyIdInput);
  if (!Number.isInteger(companyId) || companyId <= 0) {
    throw new Error('Identificador de empresa inválido para exportação LGPD.');
  }

  const exportedAtUtc = new Date().toISOString();
  const engine = getPostgresEngine();
  const relationalTables: Record<string, Record<string, unknown>[]> = {};
  const relationalTableCounts: Record<string, number> = {};

  if (engine.isConfigured() && (await engine.ensureReady())) {
    for (const spec of TENANT_RELATIONAL_TABLES_FK_ORDER) {
      if (!SAFE_SQL_IDENTIFIER.test(spec.table) || !SAFE_SQL_IDENTIFIER.test(spec.tenantColumn)) {
        continue;
      }
      try {
        const res = await engine.query(
          `SELECT * FROM ${spec.table} WHERE ${spec.tenantColumn} = $1`,
          [companyId]
        );
        const sanitizedRows = scrubSensitiveFields(res.rows as Record<string, unknown>[]);
        relationalTables[spec.table] = sanitizedRows;
        relationalTableCounts[spec.table] = sanitizedRows.length;
      } catch {
        relationalTables[spec.table] = [];
        relationalTableCounts[spec.table] = 0;
      }
    }
  } else {
    for (const spec of TENANT_RELATIONAL_TABLES_FK_ORDER) {
      relationalTables[spec.table] = [];
      relationalTableCounts[spec.table] = 0;
    }
  }

  const legacyDb = options.legacyDb || {};
  const empresasArr = Array.isArray(legacyDb.empresas) ? legacyDb.empresas : [];
  const rawEmpresa = empresasArr.find((e: any) => Number(e?.id) === companyId) || null;
  const companyProfile = rawEmpresa
    ? (scrubSensitiveFields(rawEmpresa) as Record<string, unknown>)
    : null;
  const companyName = String(
    rawEmpresa?.nome ||
      (relationalTables.empresas?.[0] as any)?.nome ||
      `Empresa #${companyId}`
  );

  const rawUsuarios = Array.isArray(legacyDb.usuarios) ? legacyDb.usuarios : [];
  const users = rawUsuarios
    .filter((u: any) => {
      const isPlatformMaster =
        Number(u?.id) === 1 && String(u?.tipo || '').trim().toLowerCase() === 'super admin';
      if (isPlatformMaster) return false;
      return rowBelongsToCompany(u, companyId);
    })
    .map((u: any) => scrubSensitiveFields(u) as Record<string, unknown>);

  const operationalCollections: Record<string, Record<string, unknown>[]> = {};
  const operationalCollectionCounts: Record<string, number> = {};

  for (const key of OPERATIONAL_COLLECTION_KEYS) {
    const arr = Array.isArray(legacyDb[key]) ? legacyDb[key] : [];
    const scopedRows = arr
      .filter((row: any) => rowBelongsToCompany(row, companyId))
      .map((row: any) => scrubSensitiveFields(row) as Record<string, unknown>);
    operationalCollections[key] = scopedRows;
    operationalCollectionCounts[key] = scopedRows.length;
  }

  const files = await listAllStorageAssetsForExport(companyId, options.storageService);
  const hotStorageCount = files.filter((f) => f.storageTier === 'hot_local').length;
  const coldStorageCount = files.filter((f) => f.storageTier === 'cold_gdrive').length;

  const dump: TenantPortabilityDump = {
    schemaVersion: 'urutau-lgpd-portability-v1',
    legalBasis: 'LGPD Art. 18, V - Portabilidade de Dados',
    companyId,
    companyName,
    exportedAtUtc,
    exportedBy: options.exportedBy,
    companyProfile,
    relationalTables,
    operationalCollections,
    users
  };

  const storageAssets = {
    companyId,
    totalFiles: files.length,
    hotStorageCount,
    coldStorageCount,
    files
  };

  const dumpJsonBuf = Buffer.from(JSON.stringify(dump, null, 2), 'utf8');
  const assetsJsonBuf = Buffer.from(JSON.stringify(storageAssets, null, 2), 'utf8');

  const databaseDumpSha256 = crypto.createHash('sha256').update(dumpJsonBuf).digest('hex');
  const storageAssetsSha256 = crypto.createHash('sha256').update(assetsJsonBuf).digest('hex');

  const manifest = {
    schemaVersion: 'urutau-lgpd-portability-v1' as const,
    companyId,
    companyName,
    exportedAtUtc,
    exportedByUid: options.exportedBy.uid,
    exportedByRole: options.exportedBy.role,
    relationalTableCounts,
    operationalCollectionCounts,
    usersCount: users.length,
    storageAssetsCount: files.length,
    integrity: {
      databaseDumpSha256,
      storageAssetsSha256
    }
  };

  const manifestJsonBuf = Buffer.from(JSON.stringify(manifest, null, 2), 'utf8');
  const readmeText = [
    'URUTAU ERP/PDV — PACOTE DE PORTABILIDADE DE DADOS (LGPD Art. 18, V)',
    '====================================================================',
    `Empresa: ${companyName} (ID: ${companyId})`,
    `Data da Exportacao (UTC): ${exportedAtUtc}`,
    `Solicitado por: ${options.exportedBy.nome} (${options.exportedBy.role})`,
    '',
    'CONTEUDO DESTE ARQUIVO ZIP:',
    '1. manifest.json       - Resumo de contagens por tabela/colecao e hashes SHA-256.',
    '2. database-dump.json  - Dump logico completo dos registros da empresa (usuarios, mesas, reservas, comandas, produtos, caixa, estoque, escalas e configuracoes).',
    '3. storage-assets.json - Catalogo de arquivos estaticos (Hot Storage) e anexos/documentos (Storage Frio) vinculados a empresa com URLs/IDs.',
    '',
    'SEGURANCA:',
    '- Credenciais, hashes de senha, PINs e chaves internas foram removidos automaticamente deste pacote.',
    `- SHA-256 database-dump.json: ${databaseDumpSha256}`,
    `- SHA-256 storage-assets.json: ${storageAssetsSha256}`,
    ''
  ].join('\n');

  const zipBuffer = buildZipArchive([
    { name: 'README-LGPD.txt', content: Buffer.from(readmeText, 'utf8') },
    { name: 'manifest.json', content: manifestJsonBuf },
    { name: 'database-dump.json', content: dumpJsonBuf },
    { name: 'storage-assets.json', content: assetsJsonBuf }
  ]);

  return {
    dump,
    storageAssets,
    manifest,
    zipBuffer
  };
}

export function registerTenantExportRoutes(deps: {
  app: Express;
  getStorageService: () => HybridStorageService;
  getLegacyDb: () => any;
  registerAuditLog?: (
    usuario: string,
    acao: string,
    detalhes: string,
    ip?: string,
    papel?: string
  ) => Promise<unknown> | unknown;
}): void {
  const { app, getStorageService, getLegacyDb, registerAuditLog } = deps;

  app.get('/api/export-tenant-data/:companyId', async (req: Request, res: Response) => {
    try {
      const companyId = Number(req.params.companyId);
      if (!Number.isInteger(companyId) || companyId <= 0) {
        res.status(400).json({ ok: false, erro: 'companyId inválido.' });
        return;
      }

      const sessao = (req as any).urutauAuthSession as AuthenticatedOperatorContext | undefined;
      const legacyDb = getLegacyDb();
      const access = evaluateTenantExportAccess(sessao, companyId, legacyDb);

      if (!access.allowed || !access.roleUsed || !sessao) {
        res.status(access.statusCode).json({
          ok: false,
          erro: access.error || 'Acesso negado.'
        });
        return;
      }

      const pkg = await buildTenantPortabilityPackage(companyId, {
        legacyDb,
        storageService: getStorageService(),
        exportedBy: {
          uid: sessao.uid,
          nome: sessao.nome || 'Proprietario',
          role: access.roleUsed
        }
      });

      if (registerAuditLog) {
        await registerAuditLog(
          sessao.nome || `UID ${sessao.uid}`,
          'EXPORTACAO_PORTABILIDADE_LGPD',
          `Exportação completa de dados (LGPD Art. 18, V) da empresa #${companyId} (${pkg.manifest.companyName}) • ${pkg.manifest.usersCount} usuários • ${pkg.manifest.storageAssetsCount} arquivos`,
          req.ip,
          access.roleUsed === 'admin_master' ? 'Admin Master' : 'Proprietário da Empresa'
        );
      }

      const safeStamp = pkg.manifest.exportedAtUtc.replace(/[:.]/g, '-');
      const requestedFormat = String(req.query.format || 'zip').trim().toLowerCase();

      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, no-store, max-age=0');

      if (requestedFormat === 'json') {
        const fileName = `urutau-lgpd-empresa-${companyId}-${safeStamp}.json`;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.status(200).send(
          JSON.stringify(
            {
              ok: true,
              manifest: pkg.manifest,
              dump: pkg.dump,
              storageAssets: pkg.storageAssets
            },
            null,
            2
          )
        );
        return;
      }

      const fileName = `urutau-lgpd-empresa-${companyId}-${safeStamp}.zip`;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', String(pkg.zipBuffer.length));
      res.status(200).send(pkg.zipBuffer);
    } catch (err: any) {
      res.status(500).json({
        ok: false,
        erro: err?.message || 'Erro interno ao gerar pacote de exportação LGPD.'
      });
    }
  });
}
