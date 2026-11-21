import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { Express, Request, Response } from 'express';
import { getPostgresEngine } from '../db/postgresEngine.ts';
import {
  isGoogleDriveServiceAccountConfigured,
  uploadBufferToDrive
} from './googleDriveServiceAccount.ts';
import { AuthenticatedOperatorContext } from './zeroTrustCommerceService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');

interface TenantTableSpec {
  table: string;
  tenantColumn: string;
}

export const TENANT_RELATIONAL_TABLES_FK_ORDER: TenantTableSpec[] = [
  { table: 'empresas', tenantColumn: 'id' },
  { table: 'produtos_catalogo', tenantColumn: 'empresa_id' },
  { table: 'estoque_saldos', tenantColumn: 'empresa_id' },
  { table: 'pdv_comandas_acid', tenantColumn: 'empresa_id' },
  { table: 'pdv_comanda_itens_acid', tenantColumn: 'empresa_id' },
  { table: 'caixa_lancamentos_acid', tenantColumn: 'empresa_id' },
  { table: 'storage_files', tenantColumn: 'company_id' },
  { table: 'user_access_approvals', tenantColumn: 'company_id' }
];

const LEGACY_COMPANY_COLLECTIONS: Array<{ key: string; idField: string }> = [
  { key: 'unidades', idField: 'empresa_id' },
  { key: 'setores', idField: 'empresa_id' },
  { key: 'reservas', idField: 'empresa_id' },
  { key: 'caixa', idField: 'empresa_id' },
  { key: 'estoque', idField: 'empresa_id' },
  { key: 'pdv_produtos', idField: 'empresa_id' },
  { key: 'pdv_comandas', idField: 'empresa_id' },
  { key: 'agenda', idField: 'empresa_id' },
  { key: 'checklists', idField: 'empresa_id' },
  { key: 'cadastros_pessoas', idField: 'empresa_id' }
];

const SAFE_SQL_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

export interface TenantLogicalBackupPayload {
  schemaVersion: 'urutau-tenant-logical-v1';
  companyId: number;
  exportedAtUtc: string;
  tables: Record<string, Record<string, unknown>[]>;
  legacySlice?: {
    empresa: Record<string, unknown> | null;
    collections: Record<string, Record<string, unknown>[]>;
  };
  integritySha256: string;
}

export interface TenantBackupExportResult {
  ok: boolean;
  companyId: number;
  fileName: string;
  filePath: string;
  driveFileId: string | null;
  sizeBytes: number;
  sha256: string;
  rowCounts: Record<string, number>;
  exportedAtUtc: string;
}

export interface TenantRestoreResult {
  ok: boolean;
  companyId: number;
  backupFile: string;
  restoredTables: Record<string, number>;
  restoredLegacyCollections: Record<string, number>;
  totalRowsRestored: number;
  verifiedSha256: string;
  restoredAtUtc: string;
}

export function resolveTenantBackupDirectory(customDir?: string): string {
  const configured = String(customDir || process.env.TENANT_BACKUP_DIR || '').trim();
  const preferred = configured || path.resolve(ROOT_DIR, 'data', 'backups', 'tenants');
  const resolved = path.isAbsolute(preferred) ? preferred : path.resolve(ROOT_DIR, preferred);
  fs.mkdirSync(resolved, { recursive: true, mode: 0o755 });
  return resolved;
}

function assertPositiveCompanyId(companyId: number): number {
  const id = Number(companyId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`companyId invalido para backup/restore isolado: ${companyId}`);
  }
  return id;
}

function computeCanonicalPayloadHash(
  companyId: number,
  tables: Record<string, Record<string, unknown>[]>,
  legacySlice?: TenantLogicalBackupPayload['legacySlice']
): string {
  const canonical = JSON.stringify({ companyId, tables, legacySlice: legacySlice || null });
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function extractLegacySliceForCompany(
  legacyDb: any,
  companyId: number
): TenantLogicalBackupPayload['legacySlice'] | undefined {
  if (!legacyDb || typeof legacyDb !== 'object') return undefined;
  const empresas = Array.isArray(legacyDb.empresas) ? legacyDb.empresas : [];
  const empresa = empresas.find((e: any) => Number(e?.id) === companyId) || null;
  const collections: Record<string, Record<string, unknown>[]> = {};

  for (const spec of LEGACY_COMPANY_COLLECTIONS) {
    const arr = Array.isArray(legacyDb[spec.key]) ? legacyDb[spec.key] : [];
    collections[spec.key] = arr
      .filter((row: any) => Number(row?.[spec.idField] ?? row?.id_empresa ?? row?.company_id ?? 0) === companyId)
      .map((row: any) => ({ ...row }));
  }

  return {
    empresa: empresa ? { ...empresa } : null,
    collections
  };
}

function applyLegacySliceForCompany(
  legacyDb: any,
  companyId: number,
  slice?: TenantLogicalBackupPayload['legacySlice']
): Record<string, number> {
  const counts: Record<string, number> = {};
  if (!legacyDb || typeof legacyDb !== 'object' || !slice) return counts;

  if (slice.empresa && Array.isArray(legacyDb.empresas)) {
    const restoredEmpresa = { ...slice.empresa, id: companyId };
    legacyDb.empresas = [
      ...legacyDb.empresas.filter((e: any) => Number(e?.id) !== companyId),
      restoredEmpresa
    ];
    counts.empresas = 1;
  }

  const sliceCollections = slice.collections || {};
  for (const spec of LEGACY_COMPANY_COLLECTIONS) {
    if (!Array.isArray(sliceCollections[spec.key])) continue;
    const current = Array.isArray(legacyDb[spec.key]) ? legacyDb[spec.key] : [];
    const preservedOtherTenants = current.filter(
      (row: any) => Number(row?.[spec.idField] ?? row?.id_empresa ?? row?.company_id ?? 0) !== companyId
    );
    const restoredRows = sliceCollections[spec.key].map((row: any) => ({
      ...row,
      [spec.idField]: companyId
    }));
    legacyDb[spec.key] = [...preservedOtherTenants, ...restoredRows];
    counts[spec.key] = restoredRows.length;
  }

  return counts;
}

export async function exportTenantLogicalBackup(
  companyIdInput: number,
  options: {
    outputDir?: string;
    uploadToDrive?: boolean;
    driveFolderId?: string;
    legacyDb?: any;
  } = {}
): Promise<TenantBackupExportResult> {
  const companyId = assertPositiveCompanyId(companyIdInput);
  const exportedAtUtc = new Date().toISOString();
  const engine = getPostgresEngine();
  const tables: Record<string, Record<string, unknown>[]> = {};
  const rowCounts: Record<string, number> = {};

  if (engine.isConfigured()) {
    for (const spec of TENANT_RELATIONAL_TABLES_FK_ORDER) {
      if (!SAFE_SQL_IDENTIFIER.test(spec.table) || !SAFE_SQL_IDENTIFIER.test(spec.tenantColumn)) {
        continue;
      }
      try {
        const res = await engine.query(
          `SELECT * FROM ${spec.table} WHERE ${spec.tenantColumn} = $1`,
          [companyId]
        );
        tables[spec.table] = res.rows as Record<string, unknown>[];
        rowCounts[spec.table] = res.rows.length;
      } catch {
        tables[spec.table] = [];
        rowCounts[spec.table] = 0;
      }
    }
  } else {
    for (const spec of TENANT_RELATIONAL_TABLES_FK_ORDER) {
      tables[spec.table] = [];
      rowCounts[spec.table] = 0;
    }
  }

  const legacySlice = extractLegacySliceForCompany(options.legacyDb, companyId);
  const integritySha256 = computeCanonicalPayloadHash(companyId, tables, legacySlice);

  const payload: TenantLogicalBackupPayload = {
    schemaVersion: 'urutau-tenant-logical-v1',
    companyId,
    exportedAtUtc,
    tables,
    ...(legacySlice ? { legacySlice } : {}),
    integritySha256
  };

  const outDir = resolveTenantBackupDirectory(options.outputDir);
  const stamp = exportedAtUtc.replace(/[:.]/g, '-');
  const fileName = `urutau-tenant-${companyId}-${stamp}.json.gz`;
  const filePath = path.resolve(outDir, fileName);
  const outPrefix = outDir.endsWith(path.sep) ? outDir : `${outDir}${path.sep}`;
  if (!filePath.startsWith(outPrefix)) {
    throw new Error('Caminho de destino fora do diretorio autorizado de backups.');
  }

  const compressed = zlib.gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'), { level: 9 });
  fs.writeFileSync(filePath, compressed, { mode: 0o600 });

  let driveFileId: string | null = null;
  const folderId = String(
    options.driveFolderId ||
      process.env.GOOGLE_DRIVE_TENANT_BACKUP_FOLDER_ID ||
      process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID ||
      ''
  ).trim();

  if (options.uploadToDrive && isGoogleDriveServiceAccountConfigured() && folderId) {
    const uploadCopy = Buffer.from(compressed);
    try {
      const uploaded = await uploadBufferToDrive({
        buffer: uploadCopy,
        fileName,
        mimeType: 'application/gzip',
        folderId,
        description: `Urutau Tenant #${companyId} Logical Backup UTC=${exportedAtUtc} SHA256=${integritySha256}`
      });
      driveFileId = uploaded.id;
    } finally {
      uploadCopy.fill(0);
    }
  }

  return {
    ok: true,
    companyId,
    fileName,
    filePath,
    driveFileId,
    sizeBytes: compressed.byteLength,
    sha256: integritySha256,
    rowCounts,
    exportedAtUtc
  };
}

export async function exportAllTenantsLogicalBackups(options: {
  companyIds?: number[];
  outputDir?: string;
  uploadToDrive?: boolean;
  driveFolderId?: string;
  legacyDb?: any;
} = {}): Promise<TenantBackupExportResult[]> {
  const companyIdSet = new Set<number>();

  if (Array.isArray(options.companyIds)) {
    for (const cid of options.companyIds) {
      if (Number.isInteger(Number(cid)) && Number(cid) > 0) {
        companyIdSet.add(Number(cid));
      }
    }
  }

  const engine = getPostgresEngine();
  if (companyIdSet.size === 0 && engine.isConfigured()) {
    try {
      const res = await engine.query<{ id: number }>('SELECT id FROM empresas ORDER BY id ASC');
      for (const row of res.rows) {
        if (Number.isInteger(Number(row.id)) && Number(row.id) > 0) {
          companyIdSet.add(Number(row.id));
        }
      }
    } catch {}
  }

  if (companyIdSet.size === 0 && Array.isArray(options.legacyDb?.empresas)) {
    for (const emp of options.legacyDb.empresas) {
      if (!emp?.arquivado_legal && Number.isInteger(Number(emp?.id)) && Number(emp.id) > 0) {
        companyIdSet.add(Number(emp.id));
      }
    }
  }

  const results: TenantBackupExportResult[] = [];
  for (const cid of Array.from(companyIdSet).sort((a, b) => a - b)) {
    const exported = await exportTenantLogicalBackup(cid, options);
    results.push(exported);
  }
  return results;
}

export async function restoreTenant(
  companyIdInput: number,
  backupFile: string,
  options: {
    allowedBaseDir?: string;
    legacyDb?: any;
    saveLegacyDb?: () => void;
  } = {}
): Promise<TenantRestoreResult> {
  const companyId = assertPositiveCompanyId(companyIdInput);
  const rawPath = String(backupFile || '').trim();
  if (!rawPath) {
    throw new Error('Informe o caminho do arquivo de backup (.json.gz ou .json) para restauracao.');
  }

  const resolvedBackupPath = path.resolve(rawPath);
  if (options.allowedBaseDir) {
    const resolvedBase = path.resolve(options.allowedBaseDir);
    const basePrefix = resolvedBase.endsWith(path.sep) ? resolvedBase : `${resolvedBase}${path.sep}`;
    if (!resolvedBackupPath.startsWith(basePrefix)) {
      throw new Error('Caminho do arquivo de backup fora do diretorio permitido.');
    }
  }

  if (!fs.existsSync(resolvedBackupPath)) {
    throw new Error(`Arquivo de backup nao encontrado: ${resolvedBackupPath}`);
  }

  const rawBuffer = fs.readFileSync(resolvedBackupPath);
  const jsonText = resolvedBackupPath.endsWith('.gz')
    ? zlib.gunzipSync(rawBuffer).toString('utf8')
    : rawBuffer.toString('utf8');

  const payload = JSON.parse(jsonText) as TenantLogicalBackupPayload;
  if (!payload || payload.schemaVersion !== 'urutau-tenant-logical-v1') {
    throw new Error('Formato de arquivo de backup multi-tenant invalido ou incompativel.');
  }
  if (Number(payload.companyId) !== companyId) {
    throw new Error(
      `Bloqueio de seguranca multi-tenant: backup pertence a empresa #${payload.companyId}, mas o alvo informado foi empresa #${companyId}.`
    );
  }

  const computedHash = computeCanonicalPayloadHash(
    companyId,
    payload.tables || {},
    payload.legacySlice
  );
  if (payload.integritySha256 !== computedHash) {
    throw new Error('Falha na verificacao SHA-256 do backup: arquivo corrompido ou adulterado.');
  }

  const restoredTables: Record<string, number> = {};
  let totalRowsRestored = 0;

  const engine = getPostgresEngine();
  if (engine.isConfigured()) {
    await engine.runInTransaction(async (client) => {
      const reverseTables = [...TENANT_RELATIONAL_TABLES_FK_ORDER].reverse();
      for (const spec of reverseTables) {
        if (!SAFE_SQL_IDENTIFIER.test(spec.table) || !SAFE_SQL_IDENTIFIER.test(spec.tenantColumn)) {
          continue;
        }
        await client.query(`SAVEPOINT sp_del_${spec.table}`);
        try {
          await client.query(
            `DELETE FROM ${spec.table} WHERE ${spec.tenantColumn} = $1`,
            [companyId]
          );
          await client.query(`RELEASE SAVEPOINT sp_del_${spec.table}`);
        } catch {
          await client.query(`ROLLBACK TO SAVEPOINT sp_del_${spec.table}`);
        }
      }

      for (const spec of TENANT_RELATIONAL_TABLES_FK_ORDER) {
        const rows = Array.isArray(payload.tables?.[spec.table]) ? payload.tables[spec.table] : [];
        let insertedCount = 0;

        for (const rawRow of rows) {
          if (!rawRow || typeof rawRow !== 'object') continue;
          const sanitizedRow: Record<string, unknown> = {
            ...rawRow,
            [spec.tenantColumn]: companyId
          };
          const columns = Object.keys(sanitizedRow).filter((col) => SAFE_SQL_IDENTIFIER.test(col));
          if (columns.length === 0) continue;

          const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
          const values = columns.map((col) => sanitizedRow[col]);

          await client.query(`SAVEPOINT sp_ins_${spec.table}`);
          try {
            await client.query(
              `INSERT INTO ${spec.table} (${columns.join(', ')}) VALUES (${placeholders})`,
              values
            );
            await client.query(`RELEASE SAVEPOINT sp_ins_${spec.table}`);
            insertedCount += 1;
          } catch (insertErr) {
            await client.query(`ROLLBACK TO SAVEPOINT sp_ins_${spec.table}`);
            throw insertErr;
          }
        }

        restoredTables[spec.table] = insertedCount;
        totalRowsRestored += insertedCount;
      }
    });
  }

  const restoredLegacyCollections = applyLegacySliceForCompany(
    options.legacyDb,
    companyId,
    payload.legacySlice
  );
  for (const count of Object.values(restoredLegacyCollections)) {
    totalRowsRestored += count;
  }
  if (options.legacyDb && options.saveLegacyDb) {
    options.saveLegacyDb();
  }

  return {
    ok: true,
    companyId,
    backupFile: resolvedBackupPath,
    restoredTables,
    restoredLegacyCollections,
    totalRowsRestored,
    verifiedSha256: computedHash,
    restoredAtUtc: new Date().toISOString()
  };
}

export function registerTenantBackupRoutes(params: {
  app: Express;
  getLegacyDb: () => any;
  saveLegacyDb: () => void;
  registerAuditLog: (
    usuario: string,
    acao: string,
    detalhes: string,
    ip?: string,
    cargo?: string
  ) => Promise<unknown>;
}): void {
  const { app, getLegacyDb, saveLegacyDb, registerAuditLog } = params;

  app.get('/api/backups/tenant/:companyId/list', (req: Request, res: Response) => {
    const sessao = (req as any).urutauAuthSession as AuthenticatedOperatorContext | undefined;
    if (!sessao || !sessao.super) {
      res.status(403).json({
        ok: false,
        erro: 'Operacao exclusiva do Admin Master autenticado.'
      });
      return;
    }

    try {
      const companyId = assertPositiveCompanyId(Number(req.params.companyId));
      const dir = resolveTenantBackupDirectory();
      const prefix = `urutau-tenant-${companyId}-`;
      const files = fs
        .readdirSync(dir)
        .filter((f) => f.startsWith(prefix) && f.endsWith('.json.gz'))
        .sort()
        .reverse()
        .map((fileName) => {
          const full = path.join(dir, fileName);
          const stat = fs.statSync(full);
          return {
            fileName,
            sizeBytes: stat.size,
            modifiedAtUtc: stat.mtime.toISOString()
          };
        });

      res.json({ ok: true, companyId, files });
    } catch (err: any) {
      res.status(400).json({ ok: false, erro: err?.message || 'Erro ao listar backups do tenant.' });
    }
  });

  app.post('/api/backups/tenant/:companyId/export', async (req: Request, res: Response) => {
    const sessao = (req as any).urutauAuthSession as AuthenticatedOperatorContext | undefined;
    if (!sessao || !sessao.super) {
      res.status(403).json({
        ok: false,
        erro: 'Operacao exclusiva do Admin Master autenticado.'
      });
      return;
    }

    try {
      const companyId = assertPositiveCompanyId(Number(req.params.companyId));
      const report = await exportTenantLogicalBackup(companyId, {
        uploadToDrive: req.body?.uploadToDrive !== false,
        legacyDb: getLegacyDb()
      });

      await registerAuditLog(
        sessao.nome,
        'BACKUP_LOGICO_TENANT_EXPORTADO',
        `Dump logico isolado da empresa #${companyId} gerado: ${report.fileName} (${report.sizeBytes} bytes).`,
        req.ip,
        sessao.cargo
      );

      res.json(report);
    } catch (err: any) {
      res.status(400).json({ ok: false, erro: err?.message || 'Falha ao exportar backup do tenant.' });
    }
  });

  app.post('/api/backups/tenant/:companyId/restore', async (req: Request, res: Response) => {
    const sessao = (req as any).urutauAuthSession as AuthenticatedOperatorContext | undefined;
    if (!sessao || !sessao.super) {
      res.status(403).json({
        ok: false,
        erro: 'Operacao exclusiva do Admin Master autenticado.'
      });
      return;
    }

    try {
      const companyId = assertPositiveCompanyId(Number(req.params.companyId));
      const fileName = path.basename(String(req.body?.fileName || '').trim());
      if (!fileName || !fileName.endsWith('.json.gz')) {
        res.status(400).json({ ok: false, erro: 'Informe um fileName .json.gz valido.' });
        return;
      }

      const backupDir = resolveTenantBackupDirectory();
      const targetFile = path.resolve(backupDir, fileName);
      const result = await restoreTenant(companyId, targetFile, {
        allowedBaseDir: backupDir,
        legacyDb: getLegacyDb(),
        saveLegacyDb
      });

      await registerAuditLog(
        sessao.nome,
        'RESTORE_ISOLADO_TENANT',
        `Restore atomico executado exclusivamente para empresa #${companyId} a partir de ${fileName} (${result.totalRowsRestored} registros).`,
        req.ip,
        sessao.cargo
      );

      res.json(result);
    } catch (err: any) {
      res.status(400).json({ ok: false, erro: err?.message || 'Falha ao restaurar tenant isolado.' });
    }
  });
}
