import crypto from 'crypto';
import { Readable } from 'stream';
import { isStagingEnvironment } from '../db/postgresEngine.ts';

export interface GoogleServiceAccountCredentials {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

export interface DriveUploadedFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  createdTime: string;
  sandboxSimulated?: boolean;
}

export interface DriveListedFile {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  createdTime: string;
}

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const DRIVE_FILE_ID_REGEX = /^[a-zA-Z0-9_-]{8,128}$/;

let cachedAccessToken: { token: string; expiresAtMs: number } | null = null;

function base64UrlEncode(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function loadGoogleServiceAccountCredentials(): GoogleServiceAccountCredentials | null {
  const rawJson = String(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON || '').trim();
  if (rawJson) {
    try {
      const decoded = rawJson.startsWith('{')
        ? rawJson
        : Buffer.from(rawJson, 'base64').toString('utf8');
      const parsed = JSON.parse(decoded);
      if (parsed?.client_email && parsed?.private_key) {
        return {
          client_email: String(parsed.client_email).trim(),
          private_key: String(parsed.private_key).replace(/\\n/g, '\n'),
          token_uri: String(parsed.token_uri || 'https://oauth2.googleapis.com/token')
        };
      }
    } catch (err: any) {
      console.error('[GoogleDriveSA] Erro ao interpretar GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON:', err?.message);
    }
  }

  const email = String(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL || '').trim();
  const privateKey = String(process.env.GOOGLE_DRIVE_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
  if (email && privateKey) {
    return {
      client_email: email,
      private_key: privateKey,
      token_uri: 'https://oauth2.googleapis.com/token'
    };
  }

  return null;
}

export function isGoogleDriveServiceAccountConfigured(): boolean {
  return loadGoogleServiceAccountCredentials() !== null;
}

export function assertValidDriveFileId(driveFileId: string): string {
  const clean = String(driveFileId || '').trim();
  if (!DRIVE_FILE_ID_REGEX.test(clean)) {
    throw new Error('Identificador drive_file_id invalido.');
  }
  return clean;
}

export async function getGoogleDriveAccessToken(): Promise<string> {
  if (cachedAccessToken && Date.now() < cachedAccessToken.expiresAtMs - 60_000) {
    return cachedAccessToken.token;
  }

  const creds = loadGoogleServiceAccountCredentials();
  if (!creds) {
    throw new Error(
      'Credenciais Google Drive Service Account nao configuradas (GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON ou GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL/PRIVATE_KEY).'
    );
  }

  const tokenUri = creds.token_uri || 'https://oauth2.googleapis.com/token';
  const nowSec = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claimSet = base64UrlEncode(
    JSON.stringify({
      iss: creds.client_email,
      scope: DRIVE_SCOPE,
      aud: tokenUri,
      iat: nowSec,
      exp: nowSec + 3600
    })
  );

  const unsignedJwt = `${header}.${claimSet}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsignedJwt);
  signer.end();
  const signature = base64UrlEncode(signer.sign(creds.private_key));
  const assertion = `${unsignedJwt}.${signature}`;

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion
  });

  const resp = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  const json = (await resp.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!resp.ok || !json.access_token) {
    throw new Error(
      `Falha ao obter token Google Drive Service Account: ${json.error_description || resp.statusText}`
    );
  }

  const ttlMs = Math.max(300, Number(json.expires_in || 3600)) * 1000;
  cachedAccessToken = {
    token: json.access_token,
    expiresAtMs: Date.now() + ttlMs
  };
  return json.access_token;
}

export async function uploadBufferToDrive(params: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  folderId?: string;
  description?: string;
}): Promise<DriveUploadedFileMetadata> {
  if (isStagingEnvironment() && !isGoogleDriveServiceAccountConfigured()) {
    console.log('[STAGING SANDBOX] Upload externo Google Drive simulado com seguranca:', params.fileName);
    return {
      id: `staging_drv_${crypto.randomBytes(8).toString('hex')}`,
      name: params.fileName,
      mimeType: params.mimeType,
      sizeBytes: params.buffer.byteLength,
      createdTime: new Date().toISOString(),
      sandboxSimulated: true
    };
  }

  const accessToken = await getGoogleDriveAccessToken();
  const boundary = `urutau_drive_${crypto.randomBytes(12).toString('hex')}`;

  const metadataObj: Record<string, unknown> = {
    name: params.fileName,
    mimeType: params.mimeType
  };
  if (params.folderId && params.folderId.trim()) {
    metadataObj.parents = [params.folderId.trim()];
  }
  if (params.description) {
    metadataObj.description = params.description;
  }

  const preamble = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
      metadataObj
    )}\r\n--${boundary}\r\nContent-Type: ${params.mimeType}\r\n\r\n`,
    'utf8'
  );
  const epilogue = Buffer.from(`\r\n--${boundary}--`, 'utf8');
  const multipartBody = Buffer.concat([preamble, params.buffer, epilogue]);

  try {
    const resp = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,size,createdTime',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'Content-Length': String(multipartBody.byteLength)
        },
        body: new Uint8Array(multipartBody)
      }
    );

    const json = (await resp.json()) as {
      id?: string;
      name?: string;
      mimeType?: string;
      size?: string;
      createdTime?: string;
      error?: { message?: string };
    };

    if (!resp.ok || !json.id) {
      throw new Error(
        `Falha no upload para Google Drive API v3: ${json.error?.message || resp.statusText}`
      );
    }

    return {
      id: json.id,
      name: json.name || params.fileName,
      mimeType: json.mimeType || params.mimeType,
      sizeBytes: Number(json.size || params.buffer.byteLength),
      createdTime: json.createdTime || new Date().toISOString()
    };
  } finally {
    multipartBody.fill(0);
  }
}

export async function downloadFileStreamFromDrive(driveFileId: string): Promise<{
  stream: Readable;
  contentType: string;
  contentLength?: number;
}> {
  const safeId = assertValidDriveFileId(driveFileId);
  const accessToken = await getGoogleDriveAccessToken();

  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(safeId)}?alt=media&supportsAllDrives=true`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  if (!resp.ok || !resp.body) {
    throw new Error(`Falha ao baixar arquivo ${safeId} do Google Drive (HTTP ${resp.status}).`);
  }

  const contentType = resp.headers.get('content-type') || 'application/octet-stream';
  const rawLength = resp.headers.get('content-length');
  const contentLength = rawLength ? Number(rawLength) : undefined;
  const nodeStream = Readable.fromWeb(resp.body as any);

  return {
    stream: nodeStream,
    contentType,
    contentLength: Number.isFinite(contentLength) ? contentLength : undefined
  };
}

export async function listFilesInDriveFolder(params: {
  folderId: string;
  namePrefix?: string;
}): Promise<DriveListedFile[]> {
  const accessToken = await getGoogleDriveAccessToken();
  const cleanFolder = assertValidDriveFileId(params.folderId);
  const queryParts = [`'${cleanFolder}' in parents`, 'trashed = false'];
  if (params.namePrefix) {
    const safePrefix = params.namePrefix.replace(/'/g, '');
    queryParts.push(`name contains '${safePrefix}'`);
  }

  const allFiles: DriveListedFile[] = [];
  let pageToken = '';

  do {
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', queryParts.join(' and '));
    url.searchParams.set('fields', 'nextPageToken, files(id, name, mimeType, size, createdTime)');
    url.searchParams.set('orderBy', 'createdTime desc');
    url.searchParams.set('pageSize', '100');
    url.searchParams.set('supportsAllDrives', 'true');
    url.searchParams.set('includeItemsFromAllDrives', 'true');
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    }

    const resp = await fetch(url.toString(), {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const json = (await resp.json()) as {
      files?: DriveListedFile[];
      nextPageToken?: string;
      error?: { message?: string };
    };

    if (!resp.ok) {
      throw new Error(
        `Falha ao listar arquivos do Google Drive: ${json.error?.message || resp.statusText}`
      );
    }

    if (Array.isArray(json.files)) {
      allFiles.push(...json.files);
    }
    pageToken = json.nextPageToken || '';
  } while (pageToken);

  return allFiles;
}

export async function deleteDriveFile(driveFileId: string): Promise<void> {
  const safeId = assertValidDriveFileId(driveFileId);
  const accessToken = await getGoogleDriveAccessToken();

  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(safeId)}?supportsAllDrives=true`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  if (!resp.ok && resp.status !== 404) {
    throw new Error(`Falha ao remover arquivo ${safeId} do Google Drive (HTTP ${resp.status}).`);
  }
}
