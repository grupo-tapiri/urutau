import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Crosshair,
  Database,
  Download,
  FileArchive,
  HardDrive,
  Lock,
  MapPin,
  RefreshCw,
  Save,
  Server,
  ShieldCheck,
  Terminal,
  Trash2,
  Upload
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
  perimeter?: {
    empresa_id: number;
    empresa_nome: string;
    latitude: number | null;
    longitude: number | null;
    allowed_radius_meters: number;
    configured: boolean;
  };
  scriptsInfraDisponiveis: Array<{
    id: string;
    filename: string;
    titulo: string;
  }>;
}

interface SetorPerimeterItem {
  id: number;
  nome: string;
  latitude: number | null;
  longitude: number | null;
  allowed_radius_meters: number;
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
  const [restoringJson, setRestoringJson] = useState<boolean>(false);
  const [restoreMode, setRestoreMode] = useState<'mesclar' | 'substituir'>('mesclar');
  const [restoreResult, setRestoreResult] = useState<{
    formato_detectado: string;
    modo_aplicado: string;
    registros_sincronizados: number;
    sincronizado_sqlite_wal: boolean;
    resumo_contagens: Record<string, number>;
  } | null>(null);
  const [certificate, setCertificate] = useState<BackupRestoreCertificate | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [activeSubSection, setActiveSubSection] = useState<
    'perimetro_gps' | 'migrations_indices' | 'webhooks_limits' | 'backups_infra'
  >('perimetro_gps');
  const [perimeterLatInput, setPerimeterLatInput] = useState<string>('');
  const [perimeterLonInput, setPerimeterLonInput] = useState<string>('');
  const [perimeterRadiusInput, setPerimeterRadiusInput] = useState<string>('50');
  const [perimeterEmpresaNome, setPerimeterEmpresaNome] = useState<string>('Unidade Ativa');
  const [perimeterEmpresaId, setPerimeterEmpresaId] = useState<number>(1);
  const [perimeterConfigured, setPerimeterConfigured] = useState<boolean>(false);
  const [perimeterSetores, setPerimeterSetores] = useState<SetorPerimeterItem[]>([]);
  const [selectedSetorId, setSelectedSetorId] = useState<string>('');
  const [capturingGps, setCapturingGps] = useState<boolean>(false);
  const [capturedAccuracy, setCapturedAccuracy] = useState<number | null>(null);
  const [savingPerimeter, setSavingPerimeter] = useState<boolean>(false);
  const [perimeterFeedback, setPerimeterFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [exportingLgpd, setExportingLgpd] = useState<boolean>(false);
  const [exportLgpdProgress, setExportLgpdProgress] = useState<number>(0);
  const [exportLgpdToast, setExportLgpdToast] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const restoreFileInputRef = useRef<HTMLInputElement | null>(null);

  const isSuper = isSuperAdminUser(currentUser);
  const canExportLgpdData = (() => {
    if (isSuper) return true;
    const role = String(currentUser?.role || '').trim().toLowerCase();
    if (role) return role === 'company_owner';
    const tipo = String(currentUser?.tipo || '').trim().toLowerCase();
    const cargo = String(currentUser?.cargo || '').trim().toLowerCase();
    return (
      tipo === 'gestor da empresa' ||
      cargo.includes('propriet') ||
      cargo.includes('empres') ||
      cargo.includes('dono')
    );
  })();
  const exportTargetCompanyId =
    perimeterEmpresaId ||
    Number(currentUser?.empresa_id || currentUser?.empresas_ids?.[0] || 1);

  const loadPerimeterConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/governanca/perimetro');
      const json = await res.json();
      if (res.ok && json?.ok && json?.perimeter) {
        setPerimeterEmpresaId(Number(json.perimeter.empresa_id || 1));
        setPerimeterEmpresaNome(String(json.perimeter.empresa_nome || 'Unidade Ativa'));
        setPerimeterConfigured(Boolean(json.perimeter.configured));
        setPerimeterLatInput(
          json.perimeter.latitude !== null && json.perimeter.latitude !== undefined
            ? String(json.perimeter.latitude)
            : ''
        );
        setPerimeterLonInput(
          json.perimeter.longitude !== null && json.perimeter.longitude !== undefined
            ? String(json.perimeter.longitude)
            : ''
        );
        setPerimeterRadiusInput(String(json.perimeter.allowed_radius_meters ?? 50));
        setPerimeterSetores(Array.isArray(json.setores) ? json.setores : []);
      }
    } catch {}
  }, []);

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
    loadPerimeterConfig();
  }, [loadGovernanceStatus, loadPerimeterConfig]);

  const handleSelectPerimeterScope = (nextSetorId: string) => {
    setSelectedSetorId(nextSetorId);
    setPerimeterFeedback(null);
    setCapturedAccuracy(null);
    if (!nextSetorId) {
      loadPerimeterConfig();
      return;
    }
    const found = perimeterSetores.find((s) => String(s.id) === nextSetorId);
    if (found) {
      setPerimeterLatInput(found.latitude !== null ? String(found.latitude) : '');
      setPerimeterLonInput(found.longitude !== null ? String(found.longitude) : '');
      setPerimeterRadiusInput(String(found.allowed_radius_meters ?? 50));
    }
  };

  const handleCaptureCurrentLocation = () => {
    setPerimeterFeedback(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setPerimeterFeedback({
        type: 'error',
        text: 'Seu navegador nao suporta Geolocation HTML5.'
      });
      return;
    }
    setCapturingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPerimeterLatInput(pos.coords.latitude.toFixed(7));
        setPerimeterLonInput(pos.coords.longitude.toFixed(7));
        setCapturedAccuracy(
          Number.isFinite(pos.coords.accuracy) ? Math.round(pos.coords.accuracy) : null
        );
        setPerimeterFeedback({
          type: 'success',
          text: `Coordenadas capturadas via GPS do dispositivo (precisao aproximada: ±${Math.round(
            pos.coords.accuracy || 0
          )}m). Clique em Salvar Perimetro para aplicar.`
        });
        setCapturingGps(false);
      },
      (geoErr) => {
        setCapturingGps(false);
        const msg =
          geoErr.code === geoErr.PERMISSION_DENIED
            ? 'Permissao de localizacao negada no navegador. Autorize o GPS para capturar sua posicao atual.'
            : 'Nao foi possivel obter sua localizacao GPS atual. Tente novamente ou informe manualmente.';
        setPerimeterFeedback({ type: 'error', text: msg });
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0
      }
    );
  };

  const handleSavePerimeter = async (clearCoordinates = false) => {
    setSavingPerimeter(true);
    setPerimeterFeedback(null);
    try {
      const payload: Record<string, unknown> = {
        empresa_id: perimeterEmpresaId,
        latitude: clearCoordinates
          ? null
          : perimeterLatInput.trim() === ''
          ? null
          : Number(perimeterLatInput.replace(',', '.')),
        longitude: clearCoordinates
          ? null
          : perimeterLonInput.trim() === ''
          ? null
          : Number(perimeterLonInput.replace(',', '.')),
        allowed_radius_meters: Number(perimeterRadiusInput || 50)
      };
      if (selectedSetorId) {
        payload.setor_id = Number(selectedSetorId);
      }

      const res = await fetch('/api/governanca/perimetro', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setPerimeterFeedback({
          type: 'error',
          text: json?.erro || 'Nao foi possivel salvar a configuracao de perimetro.'
        });
        return;
      }

      if (clearCoordinates) {
        setPerimeterLatInput('');
        setPerimeterLonInput('');
      }
      setPerimeterConfigured(Boolean(json.perimeter?.configured));
      setPerimeterFeedback({
        type: 'success',
        text: json.mensagem || 'Perimetro GPS salvo com sucesso.'
      });
      await loadPerimeterConfig();
      await loadGovernanceStatus();
      window.dispatchEvent(
        new CustomEvent('urutau:perimeter-updated', { detail: json.perimeter })
      );
    } catch (err: any) {
      setPerimeterFeedback({
        type: 'error',
        text: err?.message || 'Erro de comunicacao ao salvar perimetro.'
      });
    } finally {
      setSavingPerimeter(false);
    }
  };

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

  const handleDownloadFullJsonBackup = async () => {
    setErrorMsg('');
    try {
      const res = await fetch('/api/erp/download-backup-dados');
      if (!res.ok) {
        setErrorMsg('Falha ao baixar backup completo em JSON.');
        return;
      }
      const textContent = await res.text();
      const blob = new Blob([textContent], { type: 'application/json;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dataIso = new Date().toISOString().split('T')[0];
      link.href = blobUrl;
      link.download = `urutau-backup-dados-${dataIso}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao exportar backup JSON.');
    }
  };

  const handleRestoreJsonFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoringJson(true);
    setErrorMsg('');
    setRestoreResult(null);
    try {
      const rawText = await file.text();
      const parsed = JSON.parse(rawText);
      const res = await fetch('/api/erp/restaurar-backup-completo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modo: restoreMode,
          backup_json: parsed
        })
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setErrorMsg(json?.erro || 'Falha ao restaurar arquivo de backup.');
        return;
      }
      setRestoreResult(json);
      await loadGovernanceStatus();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Arquivo JSON inválido para restauração.');
    } finally {
      setRestoringJson(false);
      if (restoreFileInputRef.current) {
        restoreFileInputRef.current.value = '';
      }
    }
  };

  const handleExportAllTenantData = async () => {
    if (exportingLgpd) return;
    setExportingLgpd(true);
    setExportLgpdProgress(18);
    setExportLgpdToast(null);
    const progressTimer = window.setInterval(() => {
      setExportLgpdProgress((prev) => (prev < 82 ? prev + 14 : prev));
    }, 240);

    try {
      const targetId = Math.max(1, Number(exportTargetCompanyId) || 1);
      const res = await fetch(`/api/export-tenant-data/${targetId}?format=zip`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!res.ok) {
        let erroMsg = 'Não foi possível exportar os dados da empresa.';
        try {
          const errJson = await res.json();
          if (errJson?.erro) erroMsg = String(errJson.erro);
        } catch {}
        setExportLgpdToast({ type: 'error', text: erroMsg });
        return;
      }

      setExportLgpdProgress(92);
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const nameMatch = disposition.match(/filename="?([^"]+)"?/i);
      const fileName =
        nameMatch?.[1] ||
        `urutau-lgpd-empresa-${targetId}-${new Date().toISOString().slice(0, 10)}.zip`;

      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(downloadUrl);

      setExportLgpdProgress(100);
      setExportLgpdToast({
        type: 'success',
        text: `Pacote completo baixado com sucesso (${fileName}).`
      });
    } catch (err: any) {
      setExportLgpdToast({
        type: 'error',
        text: err?.message || 'Erro de conexão ao gerar exportação LGPD.'
      });
    } finally {
      window.clearInterval(progressTimer);
      window.setTimeout(() => {
        setExportingLgpd(false);
        setExportLgpdProgress(0);
      }, 600);
    }
  };

  const renderLgpdPortabilitySection = () => {
    if (!canExportLgpdData) return null;
    return (
      <div className="rounded-lg border border-slate-800 bg-[#0D1118] p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileArchive className="w-4 h-4 text-slate-300 shrink-0" />
              <h4 className="text-sm font-semibold text-slate-100">
                Portabilidade e Meus Dados (LGPD)
              </h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
              Seus dados são protegidos na infraestrutura híbrida gerenciada do Urutau. Em conformidade com o Art. 18, V da LGPD, você pode baixar um arquivo <span className="font-mono text-slate-300">.zip</span> completo contendo usuários, mesas, reservas, comandas, produtos, caixa, estoque e o catálogo de arquivos da empresa <span className="text-slate-200 font-medium">{perimeterEmpresaNome}</span>.
            </p>
          </div>

          <button
            type="button"
            disabled={exportingLgpd}
            onClick={handleExportAllTenantData}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-600/90 hover:border-rose-400/60 bg-slate-900/90 hover:bg-rose-950/25 text-slate-200 hover:text-rose-100 text-xs font-semibold transition-colors cursor-pointer shrink-0 disabled:opacity-50"
          >
            <Download className={`w-4 h-4 ${exportingLgpd ? 'animate-bounce' : ''}`} />
            <span>
              {exportingLgpd ? 'Compactando Pacote LGPD...' : 'Baixar Todos os Meus Dados'}
            </span>
          </button>
        </div>

        {exportingLgpd && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Reunindo tabelas relacionais, histórico operacional e arquivos estáticos...</span>
              <span className="font-mono tabular-nums text-slate-200">{exportLgpdProgress}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-slate-300 transition-all duration-200"
                style={{ width: `${Math.min(100, Math.max(8, exportLgpdProgress))}%` }}
              />
            </div>
          </div>
        )}

        {exportLgpdToast && (
          <div
            className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border text-xs ${
              exportLgpdToast.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-950/25 text-emerald-200'
                : 'border-rose-500/40 bg-rose-950/25 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {exportLgpdToast.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{exportLgpdToast.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setExportLgpdToast(null)}
              className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer shrink-0"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    );
  };

  if (errorMsg && !status) {
    if (canExportLgpdData) {
      return (
        <div className="bg-[#11151E] border border-slate-800/90 rounded-lg p-4 sm:p-5 space-y-4">
          {renderLgpdPortabilitySection()}
        </div>
      );
    }
    return null;
  }

  return (
    <div className="bg-[#11151E] border border-slate-800/90 rounded-lg p-4 sm:p-5 space-y-5">
      <input
        ref={restoreFileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleRestoreJsonFileChange}
      />
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#10B981] shrink-0" />
            <h3 className="text-sm sm:text-base font-semibold text-slate-100 tracking-tight">
              Governanca Relacional Zero-Trust, ACID & Continuidade Operacional
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            Recalculo autoritativo em centavos inteiros, constraints SQL declarativas, idempotencia HMAC-SHA256 e restauracao completa verificada.
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
            onClick={handleDownloadFullJsonBackup}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Baixar Backup (.json)</span>
          </button>

          <div className="inline-flex items-center gap-1">
            <select
              value={restoreMode}
              onChange={(e) =>
                setRestoreMode(e.target.value === 'substituir' ? 'substituir' : 'mesclar')
              }
              className="px-2 py-2 rounded text-xs bg-[#081115] border border-slate-700 text-slate-200"
              title="Modo de restauração do backup JSON"
            >
              <option value="mesclar">Mesclar Backup</option>
              <option value="substituir">Substituir Tudo</option>
            </select>
            <button
              type="button"
              disabled={restoringJson}
              onClick={() => restoreFileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{restoringJson ? 'Restaurando...' : 'Restaurar Backup (.json)'}</span>
            </button>
          </div>

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

      {restoreResult && (
        <div className="p-4 rounded border border-amber-500/50 bg-[#0A1813] space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
              <Check className="w-4 h-4 text-[#10B981]" />
              <span>
                BACKUP JSON RESTAURADO COM SUCESSO ({restoreResult.formato_detectado} • Modo:{' '}
                {restoreResult.modo_aplicado.toUpperCase()})
              </span>
            </div>
            <span className="text-[11px] font-mono text-[#10B981]">
              {restoreResult.registros_sincronizados} registros sincronizados • SQLite WAL:{' '}
              {restoreResult.sincronizado_sqlite_wal ? 'OK' : 'N/A'}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 pt-2 border-t border-white/10 text-[11px] font-mono">
            {Object.entries(restoreResult.resumo_contagens || {}).map(([k, v]) => (
              <div key={k} className="text-slate-300">
                <div className="text-slate-400 truncate">{k}</div>
                <div className="text-[#10B981] font-bold">{v} ativos</div>
              </div>
            ))}
          </div>
        </div>
      )}

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
              onClick={() => setActiveSubSection('perimetro_gps')}
              className={`px-3 py-1.5 rounded text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeSubSection === 'perimetro_gps'
                  ? 'bg-slate-800 text-white border border-slate-600'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-[#10B981]" />
              <span>Controle de Perimetro (GPS)</span>
            </button>
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

          {activeSubSection === 'perimetro_gps' && (
            <div className="rounded-lg bg-[#0E1117] border border-slate-800 p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#10B981]" />
                    <h4 className="text-sm font-semibold text-white">
                      Controle de Perimetro Zero-Trust (Geofencing GPS Nativo)
                    </h4>
                  </div>
                  <p className="text-xs text-slate-400">
                    Restringe modulos criticos (PDV/Comandas e Mapa de Mesas) apenas a dispositivos fisicamente dentro do raio autorizado usando HTML5 Geolocation e Formula de Haversine (zero APIs pagas).
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold border ${
                      perimeterConfigured
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    {perimeterConfigured ? 'PERIMETRO ATIVO' : 'SEM TRAVA GPS'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-slate-400 font-medium">Escopo do Perimetro:</span>
                  <select
                    value={selectedSetorId}
                    onChange={(e) => handleSelectPerimeterScope(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-[#12161F] border border-slate-700 text-slate-100 text-xs"
                  >
                    <option value="">Empresa Principal ({perimeterEmpresaNome})</option>
                    {perimeterSetores.map((setor) => (
                      <option key={setor.id} value={String(setor.id)}>
                        Setor: {setor.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  disabled={capturingGps}
                  onClick={handleCaptureCurrentLocation}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#181D28] hover:bg-slate-800 border border-slate-700 text-slate-100 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Crosshair className={`w-3.5 h-3.5 text-[#10B981] ${capturingGps ? 'animate-spin' : ''}`} />
                  <span>
                    {capturingGps ? 'Capturando GPS...' : 'Capturar Minha Localizacao Atual'}
                  </span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    Latitude (-90 a 90)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min={-90}
                    max={90}
                    value={perimeterLatInput}
                    onChange={(e) => setPerimeterLatInput(e.target.value)}
                    placeholder="Ex: -23.5505200"
                    className="w-full px-3 py-2 rounded-lg bg-[#12161F] border border-slate-700 focus:border-[#10B981] focus:outline-none text-xs font-mono text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    Longitude (-180 a 180)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min={-180}
                    max={180}
                    value={perimeterLonInput}
                    onChange={(e) => setPerimeterLonInput(e.target.value)}
                    placeholder="Ex: -46.6333080"
                    className="w-full px-3 py-2 rounded-lg bg-[#12161F] border border-slate-700 focus:border-[#10B981] focus:outline-none text-xs font-mono text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    Raio Permitido em Metros (Ex: 50m)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={50000}
                    step={1}
                    value={perimeterRadiusInput}
                    onChange={(e) => setPerimeterRadiusInput(e.target.value)}
                    placeholder="50"
                    className="w-full px-3 py-2 rounded-lg bg-[#12161F] border border-slate-700 focus:border-[#10B981] focus:outline-none text-xs font-mono text-white"
                  />
                </div>
              </div>

              {capturedAccuracy !== null && (
                <div className="text-[11px] font-mono text-slate-400">
                  Ultima leitura GPS do navegador com precisao estimada de ±{capturedAccuracy} metros.
                </div>
              )}

              {perimeterFeedback && (
                <div
                  className={`p-3 rounded-lg border text-xs font-medium ${
                    perimeterFeedback.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-200'
                      : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                  }`}
                >
                  {perimeterFeedback.text}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  disabled={savingPerimeter}
                  onClick={() => handleSavePerimeter(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 hover:border-rose-500/50 text-slate-300 hover:text-rose-200 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Limpar / Desativar Perimetro</span>
                </button>

                <button
                  type="button"
                  disabled={savingPerimeter}
                  onClick={() => handleSavePerimeter(false)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#10B981] hover:bg-emerald-400 text-[#05100C] text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingPerimeter ? 'Salvando...' : 'Salvar Perimetro Zero-Trust'}</span>
                </button>
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

      {renderLgpdPortabilitySection()}
    </div>
  );
}
