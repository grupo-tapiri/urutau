import 'dotenv/config';
import { restoreTenant } from '../src/server/services/tenantLogicalBackupService.ts';

async function main() {
  const companyIdArg = process.argv[2];
  const backupFileArg = process.argv[3];

  if (!companyIdArg || !backupFileArg) {
    console.error('Uso: npm run restore:tenant -- <companyId> <caminho-do-backup.json.gz>');
    process.exit(1);
  }

  const companyId = Number(companyIdArg);
  const report = await restoreTenant(companyId, backupFileArg);
  console.log('[RESTORE-TENANT OK]', JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error('[RESTORE-TENANT ERROR]', err?.message || err);
  process.exit(1);
});
