#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/urutau-erp}"
SQLITE_SOURCE="${SQLITE_SOURCE:-./data/urutau_acid_prod.sqlite}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP_UTC="$(date -u +%Y%m%dT%H%M%SZ)"
WORK_DIR="$(mktemp -d /tmp/urutau-backup-verify-XXXXXX)"

cleanup() {
  rm -rf "${WORK_DIR}"
}
trap cleanup EXIT

mkdir -p "${BACKUP_ROOT}"
chmod 700 "${BACKUP_ROOT}"

if [ ! -f "${SQLITE_SOURCE}" ]; then
  echo "[ERRO] Banco transacional nao encontrado em ${SQLITE_SOURCE}" >&2
  exit 1
fi

SNAPSHOT_FILE="${WORK_DIR}/urutau_snapshot_${TIMESTAMP_UTC}.sqlite"
RESTORE_TEST_FILE="${WORK_DIR}/urutau_restore_verify_${TIMESTAMP_UTC}.sqlite"
ARCHIVE_PLAIN="${WORK_DIR}/urutau_snapshot_${TIMESTAMP_UTC}.sqlite.gz"
FINAL_ARTIFACT="${BACKUP_ROOT}/urutau_backup_${TIMESTAMP_UTC}.sqlite.gz.enc"

echo "[1/5] Gerando snapshot transacional consistente (VACUUM INTO)..."
node -e "
const { DatabaseSync } = require('node:sqlite');
const src = new DatabaseSync(process.argv[1]);
const dst = process.argv[2].replace(/'/g, \"''\");
src.exec(\"VACUUM INTO '\" + dst + \"'\");
src.close();
" "${SQLITE_SOURCE}" "${SNAPSHOT_FILE}"

gzip -c "${SNAPSHOT_FILE}" > "${ARCHIVE_PLAIN}"

if [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
    -in "${ARCHIVE_PLAIN}" \
    -out "${FINAL_ARTIFACT}" \
    -pass env:BACKUP_ENCRYPTION_KEY
  chmod 600 "${FINAL_ARTIFACT}"
  echo "[2/5] Descriptografando e extraindo artefato para teste real de restauracao..."
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
    -in "${FINAL_ARTIFACT}" \
    -pass env:BACKUP_ENCRYPTION_KEY | gunzip -c > "${RESTORE_TEST_FILE}"
else
  FINAL_ARTIFACT="${BACKUP_ROOT}/urutau_backup_${TIMESTAMP_UTC}.sqlite.gz"
  cp "${ARCHIVE_PLAIN}" "${FINAL_ARTIFACT}"
  chmod 600 "${FINAL_ARTIFACT}"
  echo "[2/5] Extraindo artefato comprimido para teste real de restauracao..."
  gunzip -c "${FINAL_ARTIFACT}" > "${RESTORE_TEST_FILE}"
fi

echo "[3/5] Validando PRAGMA integrity_check, foreign_key_check e contagem em instancia temporaria..."
node -e "
const { DatabaseSync } = require('node:sqlite');
const orig = new DatabaseSync(process.argv[1], { readOnly: true });
const rest = new DatabaseSync(process.argv[2], { readOnly: true });
const integrity = rest.prepare('PRAGMA integrity_check').get();
if (!integrity || integrity.integrity_check !== 'ok') {
  throw new Error('Falha em integrity_check: ' + JSON.stringify(integrity));
}
const fkErrors = rest.prepare('PRAGMA foreign_key_check').all();
if (fkErrors.length > 0) {
  throw new Error('Violacao referencial na restauracao: ' + JSON.stringify(fkErrors));
}
for (const tbl of ['empresas', 'produtos_catalogo', 'estoque_saldos', 'pdv_comandas_acid', 'caixa_lancamentos_acid', 'eventos_processados']) {
  const c1 = orig.prepare('SELECT COUNT(*) AS total FROM ' + tbl).get().total;
  const c2 = rest.prepare('SELECT COUNT(*) AS total FROM ' + tbl).get().total;
  if (c1 !== c2) {
    throw new Error('Divergencia na tabela ' + tbl + ': origem=' + c1 + ' restaurado=' + c2);
  }
}
orig.close();
rest.close();
console.log('[OK] Restauracao isolada validada com 100% de integridade.');
" "${SQLITE_SOURCE}" "${RESTORE_TEST_FILE}"

echo "[4/5] Replicacao off-site (S3 / Cloudflare R2 / Host Secundario)..."
if [ -n "${OFFSITE_RCLONE_DEST:-}" ] && command -v rclone >/dev/null 2>&1; then
  rclone copy "${FINAL_ARTIFACT}" "${OFFSITE_RCLONE_DEST}"
  echo "[OK] Artefato enviado para destino externo: ${OFFSITE_RCLONE_DEST}"
elif [ -n "${R2_BUCKET_URI:-}" ] && command -v aws >/dev/null 2>&1; then
  aws s3 cp "${FINAL_ARTIFACT}" "${R2_BUCKET_URI%/}/"
  echo "[OK] Artefato enviado para bucket S3/R2: ${R2_BUCKET_URI}"
else
  echo "[INFO] Variavel OFFSITE_RCLONE_DEST/R2_BUCKET_URI nao definida; artefato local validado em ${FINAL_ARTIFACT}"
fi

echo "[5/5] Aplicando politica de retencao (${RETENTION_DAYS} dias)..."
find "${BACKUP_ROOT}" -type f -name "urutau_backup_*" -mtime "+${RETENTION_DAYS}" -delete 2>/dev/null || true
sha256sum "${FINAL_ARTIFACT}"
