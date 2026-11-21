import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';
import express, { Express, Request, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { TransactionalPostgresEngine } from '../db/postgresEngine.ts';
import {
  deleteDriveFile,
  downloadFileStreamFromDrive,
  isGoogleDriveServiceAccountConfigured,
  uploadBufferToDrive
} from './googleDriveServiceAccount.ts';
import { AuthenticatedOperatorContext } from './zeroTrustCommerceService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');

export type UploadAssetType =
  | 'product_photo'
  | 'profile_picture'
  | 'hr_document'
  | 'chat_attachment'
  | 'spreadsheet';

export type StorageTier = 'hot_local' | 'cold_gdrive';

export const HOT_STORAGE_ASSET_TYPES = new Set<UploadAssetType>([
  'product_photo',
  'profile_picture'
]);

export const COLD_STORAGE_ASSET_TYPES = new Set<UploadAssetType>([
  'hr_document',
  'chat_attachment',
  'spreadsheet'
]);

const ALLOWED_COLD_MIME_TYPES = new Set<string>([
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/webp',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
  'video/mp4',
  'application/zip',
  'application/octet-stream'
]);

const MAX_UPLOAD_SIZE_BYTES = Math.max(
  1 * 1024 * 1024,
  Number(process.env.STORAGE_MAX_UPLOAD_BYTES || 25 * 1024 * 1024)
);

const FALLBACK_SIGNED_URL_SECRET = crypto.randomBytes(32).toString('hex');

export interface StorageFileRecord {
  id: string;
  companyId: number;
  uploadedByUid: number;
  uploadType: UploadAssetType;
  storageTier: StorageTier;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  relativePath: string | null;
  driveFileId: string | null;
  sha256Hash: string;
  createdAtUtc: string;
}

export interface HybridUploadInput {
  companyId: number;
  uploadedByUid: number;
  uploadType: UploadAssetType;
  originalName: string;
  mimeType: string;
  buffer: Buffer;
}

export interface SignedDownloadPayload {
  fid: string;
  cid: number;
  uid: number;
  exp: number;
}

export class StorageValidationError extends Error {
  public readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'StorageValidationError';
  }
}

export class StorageAccessDeniedError extends Error {
  public readonly statusCode = 403;
  constructor(message: string) {
    super(message);
    this.name = 'StorageAccessDeniedError';
  }
}

export class StorageNotFoundError extends Error {
  public readonly statusCode = 404;
  constructor(message: string) {
    super(message);
    this.name = 'StorageNotFoundError';
  }
}

function getSignedUrlSecret(): string {
  return String(process.env.STORAGE_SIGNED_URL_SECRET || '').trim() || FALLBACK_SIGNED_URL_SECRET;
}

export function resolveHotStorageDirectory(): string {
  const configured = String(process.env.HOT_STORAGE_DIR || '').trim();
  const preferred = configured || '/app/uploads/hot-storage';
  const resolvedPreferred = path.isAbsolute(preferred)
    ? preferred
    : path.resolve(ROOT_DIR, preferred);

  try {
    fs.mkdirSync(resolvedPreferred, { recursive: true, mode: 0o755 });
    fs.accessSync(resolvedPreferred, fs.constants.W_OK);
    return resolvedPreferred;
  } catch {
    const fallbackLocal = path.resolve(ROOT_DIR, 'uploads', 'hot-storage');
    fs.mkdirSync(fallbackLocal, { recursive: true, mode: 0o755 });
    return fallbackLocal;
  }
}

function sanitizeFileSlug(originalName: string): string {
  const base = path.basename(originalName || 'arquivo', path.extname(originalName || ''));
  const normalized = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return normalized || 'asset';
}

function sanitizeDownloadFilename(originalName: string): string {
  const clean = path.basename(String(originalName || 'arquivo'))
    .replace(/["\\\r\n;]/g, '')
    .trim();
  return clean || 'arquivo';
}

export function isValidUploadAssetType(value: unknown): value is UploadAssetType {
  return (
    value === 'product_photo' ||
    value === 'profile_picture' ||
    value === 'hr_document' ||
    value === 'chat_attachment' ||
    value === 'spreadsheet'
  );
}

function mapDbRowToRecord(row: any): StorageFileRecord {
  return {
    id: String(row.id),
    companyId: Number(row.company_id),
    uploadedByUid: Number(row.uploaded_by_uid),
    uploadType: row.upload_type as UploadAssetType,
    storageTier: row.storage_tier as StorageTier,
    originalName: String(row.original_name),
    mimeType: String(row.mime_type),
    sizeBytes: Number(row.size_bytes),
    relativePath: row.relative_path ? String(row.relative_path) : null,
    driveFileId: row.drive_file_id ? String(row.drive_file_id) : null,
    sha256Hash: String(row.sha256_hash),
    createdAtUtc:
      row.created_at_utc instanceof Date
        ? row.created_at_utc.toISOString()
        : String(row.created_at_utc)
  };
}

export class HybridStorageService {
  private readonly engine: TransactionalPostgresEngine;
  private readonly hotStorageDir: string;
  private readonly fallbackMemoryStore = new Map<string, StorageFileRecord>();
  private readonly fallbackColdBuffers = new Map<string, Buffer>();

  constructor(engine: TransactionalPostgresEngine) {
    this.engine = engine;
    this.hotStorageDir = resolveHotStorageDirectory();
  }

  public getHotStorageDir(): string {
    return this.hotStorageDir;
  }

  public assertTenantAccess(
    operator: AuthenticatedOperatorContext,
    targetCompanyId: number
  ): void {
    const cleanCompanyId = Number(targetCompanyId);
    if (!Number.isInteger(cleanCompanyId) || cleanCompanyId <= 0) {
      throw new StorageValidationError('companyId invalido.');
    }
    if (operator.super) return;
    if (operator.emp === cleanCompanyId || operator.emps.includes(cleanCompanyId)) {
      return;
    }
    throw new StorageAccessDeniedError(
      `Acesso negado: sua sessao nao possui autorizacao para arquivos da empresa #${cleanCompanyId}.`
    );
  }

  public async uploadAsset(input: HybridUploadInput): Promise<StorageFileRecord> {
    if (!isValidUploadAssetType(input.uploadType)) {
      throw new StorageValidationError(
        'uploadType invalido. Use product_photo, profile_picture, hr_document, chat_attachment ou spreadsheet.'
      );
    }
    if (!Number.isInteger(input.companyId) || input.companyId <= 0) {
      throw new StorageValidationError('companyId inteiro positivo obrigatorio.');
    }
    if (!Buffer.isBuffer(input.buffer) || input.buffer.byteLength === 0) {
      throw new StorageValidationError('Conteudo do arquivo ausente ou vazio.');
    }
    if (input.buffer.byteLength > MAX_UPLOAD_SIZE_BYTES) {
      throw new StorageValidationError(
        `Arquivo excede o limite maximo permitido (${Math.round(MAX_UPLOAD_SIZE_BYTES / (1024 * 1024))}MB).`
      );
    }

    if (HOT_STORAGE_ASSET_TYPES.has(input.uploadType)) {
      return this.processHotLocalUpload(input);
    }
    return this.processColdDriveUpload(input);
  }

  private async processHotLocalUpload(input: HybridUploadInput): Promise<StorageFileRecord> {
    const maxDim = input.uploadType === 'profile_picture' ? 512 : 1200;
    const fileId = crypto.randomUUID();
    const slug = sanitizeFileSlug(input.originalName);
    const shortId = fileId.slice(0, 8);
    const fileName = `emp${input.companyId}-${slug}-${shortId}.webp`;
    const resolvedTarget = path.resolve(this.hotStorageDir, fileName);

    if (!resolvedTarget.startsWith(this.hotStorageDir + path.sep)) {
      throw new StorageValidationError('Caminho de destino invalido para Hot Storage.');
    }

    let optimizedBuffer: Buffer;
    try {
      optimizedBuffer = await sharp(input.buffer)
        .rotate()
        .resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82, effort: 4 })
        .toBuffer();
    } catch {
      throw new StorageValidationError(
        'Arquivo de imagem invalido ou corrompido para otimizacao WebP no Hot Storage.'
      );
    } finally {
      input.buffer.fill(0);
    }

    const sha256Hash = crypto.createHash('sha256').update(optimizedBuffer).digest('hex');
    const sizeBytes = optimizedBuffer.byteLength;

    fs.mkdirSync(this.hotStorageDir, { recursive: true, mode: 0o755 });
    fs.writeFileSync(resolvedTarget, optimizedBuffer, { mode: 0o644 });
    optimizedBuffer.fill(0);

    const record: StorageFileRecord = {
      id: fileId,
      companyId: input.companyId,
      uploadedByUid: input.uploadedByUid,
      uploadType: input.uploadType,
      storageTier: 'hot_local',
      originalName: sanitizeDownloadFilename(input.originalName),
      mimeType: 'image/webp',
      sizeBytes,
      relativePath: `/uploads/hot-storage/${fileName}`,
      driveFileId: null,
      sha256Hash,
      createdAtUtc: new Date().toISOString()
    };

    await this.persistFileRecord(record);
    return record;
  }

  private async processColdDriveUpload(input: HybridUploadInput): Promise<StorageFileRecord> {
    const cleanMime = String(input.mimeType || 'application/octet-stream').trim().toLowerCase();
    if (!ALLOWED_COLD_MIME_TYPES.has(cleanMime) && !cleanMime.startsWith('image/')) {
      throw new StorageValidationError(`Tipo MIME nao permitido no Cold Storage: ${cleanMime}`);
    }

    const fileId = crypto.randomUUID();
    const safeOriginal = sanitizeDownloadFilename(input.originalName);
    const sha256Hash = crypto.createHash('sha256').update(input.buffer).digest('hex');
    const sizeBytes = input.buffer.byteLength;
    const driveFileName = `emp-${input.companyId}_${input.uploadType}_${fileId.slice(0, 8)}_${safeOriginal}`;
    const storageFolderId = String(process.env.GOOGLE_DRIVE_STORAGE_FOLDER_ID || '').trim();

    let driveFileId: string;

    try {
      if (isGoogleDriveServiceAccountConfigured()) {
        const uploaded = await uploadBufferToDrive({
          buffer: input.buffer,
          fileName: driveFileName,
          mimeType: cleanMime,
          folderId: storageFolderId || undefined,
          description: `Urutau Multi-Tenant Cold Storage | companyId=${input.companyId} | type=${input.uploadType} | sha256=${sha256Hash}`
        });
        driveFileId = uploaded.id;
      } else {
        driveFileId = `local_sim_${crypto.randomBytes(10).toString('hex')}`;
        this.fallbackColdBuffers.set(driveFileId, Buffer.from(input.buffer));
      }
    } finally {
      input.buffer.fill(0);
    }

    const record: StorageFileRecord = {
      id: fileId,
      companyId: input.companyId,
      uploadedByUid: input.uploadedByUid,
      uploadType: input.uploadType,
      storageTier: 'cold_gdrive',
      originalName: safeOriginal,
      mimeType: cleanMime,
      sizeBytes,
      relativePath: null,
      driveFileId,
      sha256Hash,
      createdAtUtc: new Date().toISOString()
    };

    await this.persistFileRecord(record);
    return record;
  }

  private async persistFileRecord(record: StorageFileRecord): Promise<void> {
    this.fallbackMemoryStore.set(record.id, record);

    if (!this.engine.isConfigured()) {
      return;
    }

    const ready = await this.engine.ensureReady();
    if (!ready) {
      return;
    }

    await this.engine.runInTransaction(async (client) => {
      await client.query(
        `INSERT INTO empresas (id, nome, ativo, criado_em_utc)
         VALUES ($1, $2, 1, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [record.companyId, `Empresa ${record.companyId}`]
      );

      await client.query(
        `INSERT INTO storage_files (
          id, company_id, uploaded_by_uid, upload_type, storage_tier,
          original_name, mime_type, size_bytes, relative_path, drive_file_id,
          sha256_hash, created_at_utc
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          record.id,
          record.companyId,
          record.uploadedByUid,
          record.uploadType,
          record.storageTier,
          record.originalName,
          record.mimeType,
          record.sizeBytes,
          record.relativePath,
          record.driveFileId,
          record.sha256Hash,
          record.createdAtUtc
        ]
      );
    });
  }

  public async findFileById(fileId: string): Promise<StorageFileRecord | null> {
    const cleanId = String(fileId || '').trim();
    if (!cleanId || cleanId.length > 128) return null;

    if (this.engine.isConfigured() && (await this.engine.ensureReady())) {
      const res = await this.engine.query(
        `SELECT id, company_id, uploaded_by_uid, upload_type, storage_tier,
                original_name, mime_type, size_bytes, relative_path, drive_file_id,
                sha256_hash, created_at_utc
         FROM storage_files
         WHERE id = $1`,
        [cleanId]
      );
      if (res.rows.length > 0) {
        return mapDbRowToRecord(res.rows[0]);
      }
      return null;
    }

    return this.fallbackMemoryStore.get(cleanId) || null;
  }

  public async listFilesForCompany(
    companyId: number,
    uploadType?: UploadAssetType
  ): Promise<StorageFileRecord[]> {
    if (this.engine.isConfigured() && (await this.engine.ensureReady())) {
      if (uploadType && isValidUploadAssetType(uploadType)) {
        const res = await this.engine.query(
          `SELECT id, company_id, uploaded_by_uid, upload_type, storage_tier,
                  original_name, mime_type, size_bytes, relative_path, drive_file_id,
                  sha256_hash, created_at_utc
           FROM storage_files
           WHERE company_id = $1 AND upload_type = $2
           ORDER BY created_at_utc DESC
           LIMIT 200`,
          [companyId, uploadType]
        );
        return res.rows.map(mapDbRowToRecord);
      }

      const res = await this.engine.query(
        `SELECT id, company_id, uploaded_by_uid, upload_type, storage_tier,
                original_name, mime_type, size_bytes, relative_path, drive_file_id,
                sha256_hash, created_at_utc
         FROM storage_files
         WHERE company_id = $1
         ORDER BY created_at_utc DESC
         LIMIT 200`,
        [companyId]
      );
      return res.rows.map(mapDbRowToRecord);
    }

    return Array.from(this.fallbackMemoryStore.values())
      .filter(
        (f) =>
          f.companyId === companyId &&
          (!uploadType || f.uploadType === uploadType)
      )
      .sort((a, b) => b.createdAtUtc.localeCompare(a.createdAtUtc));
  }

  public createSignedDownloadToken(
    record: StorageFileRecord,
    operator: AuthenticatedOperatorContext,
    ttlSeconds = 300
  ): { token: string; expiresInSeconds: number; expiresAtUtc: string } {
    this.assertTenantAccess(operator, record.companyId);
    const safeTtl = Math.max(30, Math.min(900, Math.trunc(ttlSeconds)));
    const expMs = Date.now() + safeTtl * 1000;
    const payload: SignedDownloadPayload = {
      fid: record.id,
      cid: record.companyId,
      uid: operator.uid,
      exp: expMs
    };
    const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const sig = crypto
      .createHmac('sha256', getSignedUrlSecret())
      .update(encoded)
      .digest('base64url');

    return {
      token: `${encoded}.${sig}`,
      expiresInSeconds: safeTtl,
      expiresAtUtc: new Date(expMs).toISOString()
    };
  }

  public verifySignedDownloadToken(rawToken: string): SignedDownloadPayload {
    if (!rawToken || !rawToken.includes('.')) {
      throw new StorageAccessDeniedError('Token temporario de download ausente ou malformado.');
    }
    const [encoded, sig] = rawToken.trim().split('.');
    if (!encoded || !sig) {
      throw new StorageAccessDeniedError('Token temporario de download invalido.');
    }

    const expectedSig = crypto
      .createHmac('sha256', getSignedUrlSecret())
      .update(encoded)
      .digest('base64url');
    const bufA = Buffer.from(sig, 'utf8');
    const bufB = Buffer.from(expectedSig, 'utf8');
    if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
      throw new StorageAccessDeniedError('Assinatura do link temporario invalida.');
    }

    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as SignedDownloadPayload;
    if (!payload || !payload.fid || !payload.cid || Date.now() > Number(payload.exp || 0)) {
      throw new StorageAccessDeniedError('Link temporario expirado. Solicite um novo download.');
    }
    return payload;
  }

  public async openDownloadStream(record: StorageFileRecord): Promise<{
    stream: Readable;
    contentType: string;
    contentLength?: number;
    fileName: string;
  }> {
    const fileName = sanitizeDownloadFilename(record.originalName);

    if (record.storageTier === 'hot_local' && record.relativePath) {
      const baseFileName = path.basename(record.relativePath);
      const resolvedFile = path.resolve(this.hotStorageDir, baseFileName);
      if (!resolvedFile.startsWith(this.hotStorageDir + path.sep) || !fs.existsSync(resolvedFile)) {
        throw new StorageNotFoundError('Arquivo nao localizado no volume Hot Storage.');
      }
      const stat = fs.statSync(resolvedFile);
      return {
        stream: fs.createReadStream(resolvedFile),
        contentType: record.mimeType || 'image/webp',
        contentLength: stat.size,
        fileName
      };
    }

    if (record.storageTier === 'cold_gdrive' && record.driveFileId) {
      if (record.driveFileId.startsWith('local_sim_')) {
        const memBuf = this.fallbackColdBuffers.get(record.driveFileId);
        if (!memBuf) {
          throw new StorageNotFoundError('Arquivo simulado nao localizado na memoria local.');
        }
        return {
          stream: Readable.from(memBuf),
          contentType: record.mimeType || 'application/octet-stream',
          contentLength: memBuf.byteLength,
          fileName
        };
      }

      const driveRes = await downloadFileStreamFromDrive(record.driveFileId);
      return {
        stream: driveRes.stream,
        contentType: record.mimeType || driveRes.contentType,
        contentLength: driveRes.contentLength ?? record.sizeBytes,
        fileName
      };
    }

    throw new StorageNotFoundError('Localizacao fisica do arquivo nao disponivel.');
  }

  public async deleteAsset(
    fileId: string,
    operator: AuthenticatedOperatorContext
  ): Promise<boolean> {
    const record = await this.findFileById(fileId);
    if (!record) {
      throw new StorageNotFoundError('Arquivo nao encontrado.');
    }
    this.assertTenantAccess(operator, record.companyId);

    if (record.storageTier === 'hot_local' && record.relativePath) {
      const baseFileName = path.basename(record.relativePath);
      const resolvedFile = path.resolve(this.hotStorageDir, baseFileName);
      if (resolvedFile.startsWith(this.hotStorageDir + path.sep) && fs.existsSync(resolvedFile)) {
        try {
          fs.rmSync(resolvedFile, { force: true });
        } catch {}
      }
    } else if (record.storageTier === 'cold_gdrive' && record.driveFileId) {
      if (record.driveFileId.startsWith('local_sim_')) {
        this.fallbackColdBuffers.delete(record.driveFileId);
      } else if (isGoogleDriveServiceAccountConfigured()) {
        await deleteDriveFile(record.driveFileId);
      }
    }

    this.fallbackMemoryStore.delete(record.id);

    if (this.engine.isConfigured() && (await this.engine.ensureReady())) {
      await this.engine.query('DELETE FROM storage_files WHERE id = $1 AND company_id = $2', [
        record.id,
        record.companyId
      ]);
    }

    return true;
  }
}

function handleStorageRouteError(err: unknown, res: Response): void {
  if (
    err instanceof StorageValidationError ||
    err instanceof StorageAccessDeniedError ||
    err instanceof StorageNotFoundError
  ) {
    res.status(err.statusCode).json({ ok: false, erro: err.message });
    return;
  }
  const message = err instanceof Error ? err.message : 'Erro interno no gerenciador de storage.';
  res.status(500).json({ ok: false, erro: message });
}

export function registerHybridStorageRoutes(params: {
  app: Express;
  getStorageService: () => HybridStorageService;
}): void {
  const { app, getStorageService } = params;
  const hotDir = getStorageService().getHotStorageDir();

  app.use(
    '/uploads/hot-storage',
    express.static(hotDir, {
      maxAge: '30d',
      immutable: true,
      dotfiles: 'deny',
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
      }
    })
  );

  const uploadMiddleware = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MAX_UPLOAD_SIZE_BYTES,
      files: 1
    }
  });

  app.post(
    '/api/storage/upload',
    (req: Request, res: Response, next) => {
      const contentType = String(req.headers['content-type'] || '').toLowerCase();
      if (contentType.includes('multipart/form-data')) {
        uploadMiddleware.single('file')(req, res, (err: any) => {
          if (err) {
            res.status(400).json({ ok: false, erro: err.message || 'Falha no upload multipart.' });
            return;
          }
          next();
        });
        return;
      }
      next();
    },
    async (req: Request, res: Response) => {
      try {
        const sessao = (req as any).urutauAuthSession as AuthenticatedOperatorContext | undefined;
        if (!sessao) {
          res.status(401).json({ ok: false, erro: 'Sessao autenticada obrigatoria.' });
          return;
        }

        const storageSvc = getStorageService();
        const rawUploadType = String(req.body?.uploadType || req.body?.upload_type || '').trim();
        if (!isValidUploadAssetType(rawUploadType)) {
          throw new StorageValidationError(
            'Informe uploadType valido (product_photo, profile_picture, hr_document, chat_attachment, spreadsheet).'
          );
        }

        const requestedCompanyId = Number(
          req.body?.companyId || req.body?.company_id || req.body?.empresa_id || sessao.emp || 1
        );
        storageSvc.assertTenantAccess(sessao, requestedCompanyId);

        let fileBuffer: Buffer;
        let originalName: string;
        let mimeType: string;

        const multipartFile = (req as any).file as Express.Multer.File | undefined;
        if (multipartFile && Buffer.isBuffer(multipartFile.buffer)) {
          fileBuffer = multipartFile.buffer;
          originalName = multipartFile.originalname || 'arquivo';
          mimeType = multipartFile.mimetype || 'application/octet-stream';
        } else if (typeof req.body?.base64Data === 'string' && req.body.base64Data.trim()) {
          const cleanB64 = String(req.body.base64Data).replace(/^data:[^;]+;base64,/i, '');
          fileBuffer = Buffer.from(cleanB64, 'base64');
          originalName = String(req.body.fileName || req.body.originalName || 'arquivo');
          mimeType = String(req.body.mimeType || 'application/octet-stream');
        } else {
          throw new StorageValidationError(
            'Envie o arquivo em multipart/form-data (campo "file") ou JSON com "base64Data".'
          );
        }

        const saved = await storageSvc.uploadAsset({
          companyId: requestedCompanyId,
          uploadedByUid: sessao.uid,
          uploadType: rawUploadType,
          originalName,
          mimeType,
          buffer: fileBuffer
        });

        res.status(201).json({
          ok: true,
          file: saved,
          accessUrl:
            saved.storageTier === 'hot_local'
              ? saved.relativePath
              : `/api/storage/download/${saved.id}`
        });
      } catch (err) {
        handleStorageRouteError(err, res);
      }
    }
  );

  app.get('/api/storage/files', async (req: Request, res: Response) => {
    try {
      const sessao = (req as any).urutauAuthSession as AuthenticatedOperatorContext | undefined;
      if (!sessao) {
        res.status(401).json({ ok: false, erro: 'Sessao autenticada obrigatoria.' });
        return;
      }

      const storageSvc = getStorageService();
      const targetCompanyId = Number(
        req.query.companyId || req.query.company_id || req.query.empresa_id || sessao.emp || 1
      );
      storageSvc.assertTenantAccess(sessao, targetCompanyId);

      const rawType = req.query.uploadType ? String(req.query.uploadType).trim() : undefined;
      const filterType = rawType && isValidUploadAssetType(rawType) ? rawType : undefined;
      const files = await storageSvc.listFilesForCompany(targetCompanyId, filterType);

      res.json({
        ok: true,
        companyId: targetCompanyId,
        total: files.length,
        files
      });
    } catch (err) {
      handleStorageRouteError(err, res);
    }
  });

  app.get('/api/storage/download/:fileId', async (req: Request, res: Response) => {
    try {
      const sessao = (req as any).urutauAuthSession as AuthenticatedOperatorContext | undefined;
      if (!sessao) {
        res.status(401).json({ ok: false, erro: 'Sessao autenticada obrigatoria.' });
        return;
      }

      const storageSvc = getStorageService();
      const record = await storageSvc.findFileById(String(req.params.fileId || ''));
      if (!record) {
        throw new StorageNotFoundError('Arquivo nao localizado.');
      }

      storageSvc.assertTenantAccess(sessao, record.companyId);

      if (String(req.query.mode || '').toLowerCase() === 'signed-url') {
        const ttl = Number(req.query.ttl || 300);
        const signed = storageSvc.createSignedDownloadToken(record, sessao, ttl);
        res.json({
          ok: true,
          fileId: record.id,
          companyId: record.companyId,
          storageTier: record.storageTier,
          signedUrl: `/api/storage/signed/${signed.token}`,
          expiresInSeconds: signed.expiresInSeconds,
          expiresAtUtc: signed.expiresAtUtc
        });
        return;
      }

      const download = await storageSvc.openDownloadStream(record);
      res.setHeader('Content-Type', download.contentType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${download.fileName}"`
      );
      if (download.contentLength !== undefined) {
        res.setHeader('Content-Length', String(download.contentLength));
      }

      download.stream.on('error', (streamErr) => {
        if (!res.headersSent) {
          res.status(502).json({
            ok: false,
            erro: `Falha no stream do arquivo: ${streamErr.message}`
          });
        } else {
          res.end();
        }
      });

      download.stream.pipe(res);
    } catch (err) {
      handleStorageRouteError(err, res);
    }
  });

  app.get('/api/storage/signed/:token', async (req: Request, res: Response) => {
    try {
      const storageSvc = getStorageService();
      const payload = storageSvc.verifySignedDownloadToken(String(req.params.token || ''));
      const record = await storageSvc.findFileById(payload.fid);
      if (!record) {
        throw new StorageNotFoundError('Arquivo nao localizado.');
      }
      if (record.companyId !== payload.cid) {
        throw new StorageAccessDeniedError('Divergencia multi-tenant detectada no token assinado.');
      }

      const download = await storageSvc.openDownloadStream(record);
      res.setHeader('Content-Type', download.contentType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${download.fileName}"`
      );
      if (download.contentLength !== undefined) {
        res.setHeader('Content-Length', String(download.contentLength));
      }

      download.stream.on('error', () => {
        if (!res.headersSent) {
          res.status(502).json({ ok: false, erro: 'Falha ao transmitir stream assinado.' });
        } else {
          res.end();
        }
      });

      download.stream.pipe(res);
    } catch (err) {
      handleStorageRouteError(err, res);
    }
  });

  app.delete('/api/storage/:fileId', async (req: Request, res: Response) => {
    try {
      const sessao = (req as any).urutauAuthSession as AuthenticatedOperatorContext | undefined;
      if (!sessao) {
        res.status(401).json({ ok: false, erro: 'Sessao autenticada obrigatoria.' });
        return;
      }

      const storageSvc = getStorageService();
      await storageSvc.deleteAsset(String(req.params.fileId || ''), sessao);
      res.json({ ok: true, deletedFileId: req.params.fileId });
    } catch (err) {
      handleStorageRouteError(err, res);
    }
  });
}
