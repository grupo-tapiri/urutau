import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Database,
  Download,
  HardDrive,
  Lock,
  RefreshCw,
  Server,
  ShieldCheck,
  Terminal
} from 'lucide-react';
import { isSuperAdminUser } from './UrutauShared';

interface GovernanceStatusPayload {
  ok: boolean;
  ambiente: string;
  motorRelacional: string;
  caminhoBancoIsolado: string;
  constraintsAtivas: string[];
  moedaArmazenamento: string;
  padraoTemporal: string;
  migrationsAplicadas: Array<{
    version: string;
    filename: string;
    checksum_sha256: string;
    applied_at_utc: string;
  }>;
  auditoriaIndicesExplain: Array<{
    name: string;
    sql: string;
    planDetails: string[];
    usesIndex: boolean;
  }>;
  eventosWebhookIdempotentes: Array<{
    event_id: string;
    origem: string;
    efeito_resumo: string;
    processado_em_utc: string;
  }>;
  cotasHardLimits: Array<{
    bucket_key: string;
    escopo: string;
    janela_utc: string;
    contagem: number;
    limite_maximo: number;
    atualizado_em_utc: string;
  }>;
  backupsVerificados: Array<{
    filename: string;
    sizeBytes: number;
    createdAtUtc: string;
  }>;
  scriptsInfraDisponiveis: Array<{
    id: string;
    filename: string;
    titulo: string;
  }>;
}

interface BackupRestoreCertificate {
  ok: boolean;
  environment: string;
  backupPath: string;
  encrypted: boolean;
  sizeBytes: number;
  sha256: string;
  restoredTempVerified: boolean;
  integrityCheck: string;
  foreignKeyViolations: number;
  rowCounts: Record<string, { source: number; restored: number }>;
  durationMs: number;
  verifiedAtUtc: string;
}

export function ZeroTrustGovernancePanel({ currentUser }: { currentUser?: any }) {
  const [status, setStatus] = useState<GovernanceStatusPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [runningBackup, setRunningBackup] = useState<boolean>(false);
  const [certificate, setCertificate] = useState<BackupRestoreCertificate | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [activeSubSection, setActiveSubSection] = useState<
    'migrations_indices' | 'webhooks_limits' | 'backups_infra'
  >('migrations_indices');

  const isSuper = isSuperAdminUser(currentUser);

  const loadGovernanceStatus = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/governanca/status');
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setErrorMsg(json?.erro || 'Sem permissao administrativa para telemetria relacional.');
        return;
      }
      setStatus(json);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Falha ao consultar motor ACID.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGovernanceStatus();
  }, [loadGovernanceStatus]);

  const handleRunVerifiedBackup = async () => {
    setRunningBackup(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/governanca/backup-testar-restauracao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setErrorMsg(json?.erro || 'Falha na rotina de backup e restauracao isolada.');
        return;
      }
      setCertificate(json);
      await loadGovernanceStatus();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao executar backup com restauracao testada.');
    } finally {
      setRunningBackup(false);
    }
  };

  const handleDownloadInfraScript = async (scriptId: string, filename: string) => {
    setDownloadingId(scriptId);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/governanca/scripts/${encodeURIComponent(scriptId)}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        setErrorMsg(errJson?.erro || 'Download disponivel apenas para Super Admin.');
        return;
      }
      const textContent = await res.text();
      const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao transferir script operacional.');
    } finally {
      setDownloadingId(null);
    }
  };

  if (errorMsg && !status) {
    return null;
  }

  return (
    <div className="bg-[#11151E] border border-slate-800/90 rounded-lg p-4 sm:p-5 space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#10B981] shrink-0" />
            <h3 className="text-sm sm:text-base font-semibold text-slate-100 tracking-tight">
              Governanca Relacional Zero-Trust, ACID & Continuidade Operacional
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            Recalculo autoritativo em centavos inteiros, constraints SQL declarativas, idempotencia HMAC-SHA256 e restauracao testada em instancia isolada.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={runningBackup}
            onClick={handleRunVerifiedBackup}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#10B981] hover:bg-[#34D399] text-[#05100C] text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>
              {runningBackup
                ? 'Criptografando & Restaurando...'
                : 'Executar Backup + Teste de Restauracao'}
            </span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={loadGovernanceStatus}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-slate-700 hover:border-slate-500 text-slate-200 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar Telemetria</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded border border-rose-500/40 bg-rose-950/30 text-xs text-rose-200 font-medium">
          {errorMsg}
        </div>
      )}

      {status && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pb-4 border-b border-slate-800/80">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400">Motor & Isolamento</div>
              <div className="mt-1 text-sm font-semibold text-slate-100">{status.caminhoBancoIsolado}</div>
              <div className="text-[11px] font-mono tabular-nums text-[#10B981]">
                ENV: {status.ambiente.toUpperCase()}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400">Precisao Monetaria</div>
              <div className="mt-1 text-sm font-semibold text-slate-100">{status.moedaArmazenamento}</div>
              <div className="text-[11px] font-mono tabular-nums text-slate-400">
                Zero IEEE-754 Float
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400">Migrations Versionadas</div>
              <div className="mt-1 text-sm font-mono tabular-nums font-semibold text-slate-100">
                {status.migrationsAplicadas.length} aplicadas
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-400">
                Padrao {status.padraoTemporal}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400">Planos EXPLAIN Indexados</div>
              <div className="mt-1 text-sm font-mono tabular-nums font-semibold text-[#10B981]">
                {status.auditoriaIndicesExplain.filter((q) => q.usesIndex).length}/
                {status.auditoriaIndicesExplain.length} com indice B-Tree
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-400">
                Zero Full Table Scan em FKs
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-slate-800/80 pb-3">
            <button
              type="button"
              onClick={() => setActiveSubSection('migrations_indices')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                activeSubSection === 'migrations_indices'
                  ? 'bg-slate-800 text-white border border-slate-600'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Migrations & EXPLAIN QUERY PLAN
            </button>
            <button
              type="button"
              onClick={() => setActiveSubSection('webhooks_limits')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                activeSubSection === 'webhooks_limits'
                  ? 'bg-slate-800 text-white border border-slate-600'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Idempotencia de Webhooks & Hard Limits
            </button>
            <button
              type="button"
              onClick={() => setActiveSubSection('backups_infra')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                activeSubSection === 'backups_infra'
                  ? 'bg-slate-800 text-white border border-slate-600'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Backups Verificados & Scripts VPS/SSH
            </button>
          </div>

          {certificate && (
            <div className="p-4 rounded border border-[#10B981]/50 bg-[#071712] space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#10B981]">
                  <Check className="w-4 h-4" />
                  <span>
                    CERTIFICADO DE RESTAURACAO ISOLADA APROVADO — PRAGMA integrity_check ={' '}
                    {certificate.integrityCheck.toUpperCase()}
                  </span>
                </div>
                <span className="text-[11px] font-mono tabular-nums text-slate-300">
                  {certificate.verifiedAtUtc}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono tabular-nums text-slate-300">
                <div>
                  <span className="text-slate-400">Arquivo AES-256-GCM:</span>{' '}
                  {certificate.backupPath} ({certificate.sizeBytes} B)
                </div>
                <div>
                  <span className="text-slate-400">Violacoes FK:</span> {certificate.foreignKeyViolations} |{' '}
                  <span className="text-slate-400">Paridade Linhas:</span>{' '}
                  {certificate.restoredTempVerified ? '100% EXATA' : 'DIVERGENTE'}
                </div>
                <div className="truncate" title={certificate.sha256}>
                  <span className="text-slate-400">SHA-256:</span> {certificate.sha256.slice(0, 24)}...
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-2 border-t border-white/10 text-[11px] font-mono tabular-nums">
                {Object.entries(certificate.rowCounts || {}).map(([tbl, counts]) => (
                  <div key={tbl} className="text-slate-300">
                    <div className="text-slate-400 truncate">{tbl}</div>
                    <div className="text-[#10B981] font-semibold">
                      {counts.source} {'->'} {counts.restored}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSubSection === 'migrations_indices' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
                  <Database className="w-3.5 h-3.5 text-[#10B981]" />
                  <span>Historico schema_migrations (Versionadas)</span>
                </div>
                <div className="divide-y divide-slate-800/70 border-t border-b border-slate-800/70">
                  {status.migrationsAplicadas.map((m) => (
                    <div key={m.version} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="font-mono font-semibold text-slate-100">{m.filename}</div>
                        <div className="font-mono tabular-nums text-[11px] text-slate-400">
                          SHA-256: {m.checksum_sha256.slice(0, 20)}...
                        </div>
                      </div>
                      <div className="text-right font-mono tabular-nums text-[11px] text-slate-400">
                        {m.applied_at_utc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
                  <span>Auditoria Real EXPLAIN QUERY PLAN</span>
                </div>
                <div className="divide-y divide-slate-800/70 border-t border-b border-slate-800/70">
                  {status.auditoriaIndicesExplain.map((plan) => (
                    <div key={plan.name} className="py-2.5 space-y-1 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-semibold text-slate-100">{plan.name}</span>
                        <span
                          className={`font-mono text-[11px] font-bold ${
                            plan.usesIndex ? 'text-[#10B981]' : 'text-amber-400'
                          }`}
                        >
                          {plan.usesIndex ? 'INDEX SEARCH ATIVO' : 'SCAN'}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-slate-400">
                        {(plan.planDetails || []).join(' | ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeSubSection === 'webhooks_limits' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Tabela eventos_processados (Deduplicacao Idempotente)
                </div>
                {status.eventosWebhookIdempotentes.length === 0 ? (
                  <div className="py-4 text-xs text-slate-400 border-t border-b border-slate-800/70">
                    Nenhum webhook processado ainda nesta instancia. Reenvios duplicados sao absorvidos com HTTP 200 sem duplicar saldo.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/70 border-t border-b border-slate-800/70">
                    {status.eventosWebhookIdempotentes.map((ev) => (
                      <div key={ev.event_id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                        <div>
                          <div className="font-mono font-semibold text-slate-100">
                            {ev.event_id} ({ev.origem})
                          </div>
                          <div className="text-[11px] text-slate-400">{ev.efeito_resumo}</div>
                        </div>
                        <div className="font-mono tabular-nums text-[11px] text-slate-400 shrink-0">
                          {ev.processado_em_utc}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Disjuntores Hard Limits (Rate Limit & Teto Horario/Diario IA)
                </div>
                {status.cotasHardLimits.length === 0 ? (
                  <div className="py-4 text-xs text-slate-400 border-t border-b border-slate-800/70">
                    Nenhuma cota ativa registrada na janela atual.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/70 border-t border-b border-slate-800/70">
                    {status.cotasHardLimits.map((lim) => (
                      <div
                        key={lim.bucket_key}
                        className="py-2.5 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="font-mono font-semibold text-slate-100">{lim.escopo}</div>
                          <div className="font-mono text-[11px] text-slate-400">
                            Janela UTC: {lim.janela_utc}
                          </div>
                        </div>
                        <div className="font-mono tabular-nums text-xs font-bold text-[#10B981]">
                          {lim.contagem} / {lim.limite_maximo}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSubSection === 'backups_infra' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
                  <Server className="w-3.5 h-3.5 text-[#10B981]" />
                  <span>Snapshots Criptografados com Restauracao Verificada</span>
                </div>
                {status.backupsVerificados.length === 0 ? (
                  <div className="py-4 text-xs text-slate-400 border-t border-b border-slate-800/70">
                    Clique em "Executar Backup + Teste de Restauracao" acima para gerar e auditar o primeiro snapshot AES-256-GCM.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/70 border-t border-b border-slate-800/70">
                    {status.backupsVerificados.map((bk) => (
                      <div key={bk.filename} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                        <div className="font-mono text-slate-200 truncate">{bk.filename}</div>
                        <div className="font-mono tabular-nums text-[11px] text-slate-400 shrink-0">
                          {bk.sizeBytes} B • {bk.createdAtUtc}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
                  <Terminal className="w-3.5 h-3.5 text-[#10B981]" />
                  <span>Scripts Operacionais VPS, SSH, Firewall UFW & PostgreSQL</span>
                </div>
                <div className="divide-y divide-slate-800/70 border-t border-b border-slate-800/70">
                  {status.scriptsInfraDisponiveis.map((sc) => (
                    <div key={sc.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="font-semibold text-slate-100">{sc.titulo}</div>
                        <div className="font-mono text-[11px] text-slate-400">scripts/{sc.filename}</div>
                      </div>
                      {isSuper ? (
                        <button
                          type="button"
                          disabled={downloadingId === sc.id}
                          onClick={() => handleDownloadInfraScript(sc.id, sc.filename)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-slate-700 hover:border-[#10B981] text-slate-200 text-xs font-medium cursor-pointer shrink-0 disabled:opacity-50"
                        >
                          <Download className="w-3.5 h-3.5 text-[#10B981]" />
                          <span>{downloadingId === sc.id ? 'Baixando...' : 'Baixar'}</span>
                        </button>
                      ) : (
                        <span className="font-mono text-[11px] text-slate-500 shrink-0">Restrito Super Admin</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
