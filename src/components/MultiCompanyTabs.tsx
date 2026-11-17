import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Plus,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Users,
  Search,
  Check,
  X,
  Sparkles,
  ShieldCheck,
  Send,
  SlidersHorizontal,
  ExternalLink,
  Ban,
  Database,
  HardDrive,
  RefreshCw,
  Copy,
  Download,
  Upload
} from 'lucide-react';
import { CommonTabProps } from './OperationalTabsPart1';
import { Empresa, Freelancer } from '../types/erp';
import { FocusFormModal, UrutauValidatedCityStateSelector } from './UrutauShared';

const DIAS_SEMANA_NOMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function formatBRL(val: number): string {
  return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function Kvm2GoogleSheetsPersistentDbSection({
  onRefresh,
  showAlert,
  showConfirm
}: {
  onRefresh: () => Promise<void>;
  showAlert: (title: string, message: string, technicalDetails?: string) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
}) {
  const [statusData, setStatusData] = useState<any>(null);
  const [webhookInput, setWebhookInput] = useState<string>('');
  const [spreadsheetIdInput, setSpreadsheetIdInput] = useState<string>('');
  const [modoCompacto, setModoCompacto] = useState<boolean>(true);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);
  const [showAppsScriptModal, setShowAppsScriptModal] = useState<boolean>(false);

  const [soberaniaMapa, setSoberaniaMapa] = useState<Record<string, any>>({});
  const [empresaSoberaniaId, setEmpresaSoberaniaId] = useState<number>(1);
  const [provedorBanco, setProvedorBanco] = useState<string>('postgresql_cliente');
  const [databaseUrlInput, setDatabaseUrlInput] = useState<string>('');
  const [s3BucketInput, setS3BucketInput] = useState<string>('');
  const [controladorNome, setControladorNome] = useState<string>('');
  const [controladorDoc, setControladorDoc] = useState<string>('');
  const [controladorEmail, setControladorEmail] = useState<string>('');
  const [janelaOfflineDias, setJanelaOfflineDias] = useState<number>(7);
  const [politicaAtualizacao, setPoliticaAtualizacao] = useState<string>('escolha_ou_bloqueio');

  const carregarStatusKvm2 = async () => {
    try {
      const [r, rSob] = await Promise.all([
        fetch('/api/erp/kvm2-sheets-status'),
        fetch('/api/erp/soberania-dados-status')
      ]);
      if (r.ok) {
        const json = await r.json();
        setStatusData(json);
        if (json.config) {
          setWebhookInput(json.config.webhookUrl || '');
          setSpreadsheetIdInput(json.config.spreadsheetId || '');
          setModoCompacto(json.config.modoCompactoKvm2 !== false);
        }
      }
      if (rSob.ok) {
        const jSob = await rSob.json();
        const mapa = jSob.soberaniaPorEmpresa || {};
        setSoberaniaMapa(mapa);
        const rec = mapa[String(empresaSoberaniaId)] || {};
        setProvedorBanco(rec.provedor_banco || 'postgresql_cliente');
        setDatabaseUrlInput(rec.database_url || '');
        setS3BucketInput(rec.s3_bucket_url || '');
        setControladorNome(rec.controlador_nome || '');
        setControladorDoc(rec.controlador_documento || '');
        setControladorEmail(rec.controlador_email || '');
        setJanelaOfflineDias(Number(rec.janela_offline_dias || 7));
        setPoliticaAtualizacao(rec.politica_atualizacao || 'escolha_ou_bloqueio');
      }
    } catch {
    }
  };

  useEffect(() => {
    carregarStatusKvm2();
  }, []);

  const handleTrocarEmpresaSoberania = (empId: number) => {
    setEmpresaSoberaniaId(empId);
    const rec = soberaniaMapa[String(empId)] || {};
    setProvedorBanco(rec.provedor_banco || 'postgresql_cliente');
    setDatabaseUrlInput(rec.database_url || '');
    setS3BucketInput(rec.s3_bucket_url || '');
    setControladorNome(rec.controlador_nome || '');
    setControladorDoc(rec.controlador_documento || '');
    setControladorEmail(rec.controlador_email || '');
    setJanelaOfflineDias(Number(rec.janela_offline_dias || 7));
    setPoliticaAtualizacao(rec.politica_atualizacao || 'escolha_ou_bloqueio');
  };

  const handleSalvarSoberaniaEmpresario = async (assinarTermo: boolean) => {
    setLoadingAction(assinarTermo ? 'assinar_lgpd' : 'salvar_soberania');
    try {
      const r = await fetch('/api/erp/soberania-dados-salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: empresaSoberaniaId,
          provedor_banco: provedorBanco,
          database_url: databaseUrlInput,
          s3_bucket_url: s3BucketInput,
          controlador_nome: controladorNome,
          controlador_documento: controladorDoc,
          controlador_email: controladorEmail,
          assinar_termo_lgpd: assinarTermo,
          janela_offline_dias: janelaOfflineDias,
          politica_atualizacao: politicaAtualizacao
        })
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.erro || 'Falha ao salvar guarda do banco');
      setSoberaniaMapa(json.soberaniaPorEmpresa || {});
      await onRefresh();
      showAlert(
        assinarTermo
          ? 'Termo de Guarda do BD Assinado (LGPD Art. 39 e 42)'
          : 'Configuração de Banco & Atualização Salva',
        assinarTermo
          ? `A responsabilidade legal e técnica da guarda dos dados da Empresa #${empresaSoberaniaId} foi registrada em nome de "${controladorNome || 'Empresário Controlador'}" com assinatura SHA-256: ${json.registro?.hash_assinatura_lgpd?.slice(0, 24)}...`
          : 'Conexão BYODB (100GB+), janela de sincronização offline e política de atualização sem perda de dados atualizadas.'
      );
    } catch (e: any) {
      showAlert('Erro ao Salvar Guarda de Dados', e.message);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSimularDisparoAtualizacao = async () => {
    setLoadingAction('simular_update');
    try {
      const r = await fetch('/api/system/anunciar-atualizacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          versao: `v${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`,
          notas: 'Nova versão sincronizada via GitHub (Web, Mobile PWA & Desktop) pronta sem perda de dados.'
        })
      });
      if (!r.ok) throw new Error('Falha ao anunciar atualização');
      showAlert(
        'Aviso de Nova Versão Disparado!',
        'Observe no topo da tela o banner permitindo escolher entre "Atualizar Imediatamente" ou "Atualizar ao Bloquear Tela / Iniciar".'
      );
    } catch (e: any) {
      showAlert('Erro', e.message);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSalvarConfigSheets = async () => {
    setLoadingAction('config');
    try {
      const r = await fetch('/api/erp/kvm2-sheets-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: webhookInput.trim(),
          spreadsheetId: spreadsheetIdInput.trim(),
          autoSyncWriteThrough: true,
          modoCompactoKvm2: modoCompacto
        })
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.erro || 'Erro ao salvar configuração');
      await carregarStatusKvm2();
      showAlert(
        'Banco Persistente Google Sheets Configurado',
        'A ponte com o Google Sheets e o Modo Ultra-Compacto para a sua VPS KVM2 foram salvos com sucesso!'
      );
    } catch (e: any) {
      showAlert('Erro ao Salvar Configuração', e.message);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSincronizarAgora = async (empresaId?: number) => {
    setLoadingAction(empresaId ? `sync_${empresaId}` : 'sync_all');
    try {
      const r = await fetch('/api/erp/kvm2-sheets-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: empresaId })
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.erro || 'Falha na sincronização');
      await carregarStatusKvm2();
      await onRefresh();
      showAlert(
        'Sincronização Concluída',
        `${json.detalheRemoto || 'Dados sincronizados.'}\nPeso compactado Gzip: ${json.tamanhoCompactadoKb || 0} KB.`
      );
    } catch (e: any) {
      showAlert('Erro ao Sincronizar', e.message);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleOtimizarDiscoKvm2 = async () => {
    setLoadingAction('otimizar_disco');
    try {
      const r = await fetch('/api/erp/kvm2-otimizar-disco', { method: 'POST' });
      const json = await r.json();
      if (!r.ok) throw new Error(json.erro || 'Falha ao otimizar disco');
      await carregarStatusKvm2();
      await onRefresh();
      showAlert('HD da VPS KVM2 Otimizado!', json.mensagem);
    } catch (e: any) {
      showAlert('Erro na Otimização', e.message);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleOffloadEmpresa = (emp: any) => {
    showConfirm(
      `Descarregar "${emp.nome}" para o Google Sheets?`,
      `Isto salvará todos os lançamentos operacionais de "${emp.nome}" no cofre persistente do Google Sheets (e em cápsula Gzip ultra-leve) e liberará espaço no HD da sua VPS KVM2. Você pode recarregar os dados a qualquer momento com 1 clique.`,
      async () => {
        setLoadingAction(`offload_${emp.id}`);
        try {
          const r = await fetch('/api/erp/kvm2-offload-empresa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ empresa_id: emp.id })
          });
          const json = await r.json();
          if (!r.ok) throw new Error(json.erro || 'Erro ao descarregar empresa');
          await carregarStatusKvm2();
          await onRefresh();
          showAlert('Espaço Liberado na VPS KVM2', json.mensagem);
        } catch (e: any) {
          showAlert('Erro ao Hibernar Empresa', e.message);
        } finally {
          setLoadingAction(null);
        }
      }
    );
  };

  const handleHidratarEmpresa = async (empresaId?: number, nome?: string) => {
    setLoadingAction(empresaId ? `hydrate_${empresaId}` : 'hydrate_all');
    try {
      const r = await fetch('/api/erp/kvm2-hidratar-empresa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: empresaId || 0 })
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.erro || 'Erro ao restaurar dados');
      await carregarStatusKvm2();
      await onRefresh();
      showAlert(
        'Dados Restaurados do Google Sheets',
        nome ? `A empresa "${nome}" voltou para a memória ativa com todos os registros!` : json.mensagem
      );
    } catch (e: any) {
      showAlert('Aviso de Restauração', e.message);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCopyAppsScript = () => {
    if (!statusData?.appsScriptCode) return;
    navigator.clipboard?.writeText(statusData.appsScriptCode);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 3000);
  };

  const registroAtualSoberania = soberaniaMapa[String(empresaSoberaniaId)] || {};

  return (
    <div className="bg-[#071712] border-2 border-[#10B981]/45 rounded-xl p-4 sm:p-5 space-y-5 shadow-xl">
      
      <div className="p-4 rounded-xl bg-[#05100C] border border-amber-500/40 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="space-y-0.5">
            <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-400">
              <Database className="w-4 h-4 shrink-0" />
              <span>Soberania & Guarda de Dados pelo Empresário (BYODB 100GB+ • LGPD) + Atualização Segura</span>
            </div>
            <p className="text-xs text-slate-300">
              Transfira o controle e a responsabilidade jurídica/técnica do Banco de Dados ao empresário, configure a janela de cache Offline e defina quando atualizar (Escolha do Usuário, Bloqueio de Tela ou Início).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/api/erp/soberania-dados-exportar/${empresaSoberaniaId}`}
              download
              className="px-3 py-1.5 rounded-lg bg-[#10B981]/20 hover:bg-[#10B981]/30 text-[#10B981] border border-[#10B981]/40 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar Dump Completo da Empresa (Posse do Empresário)</span>
            </a>
            <button
              type="button"
              data-no-confirm="true"
              disabled={loadingAction === 'simular_update'}
              onClick={handleSimularDisparoAtualizacao}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAction === 'simular_update' ? 'animate-spin' : ''}`} />
              <span>Testar Aviso de Atualização Segura</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">
              1. Empresa / Unidade de Guarda:
            </label>
            <select
              value={empresaSoberaniaId}
              onChange={(e) => handleTrocarEmpresaSoberania(Number(e.target.value))}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-700 rounded-lg text-xs text-white font-semibold"
            >
              {(statusData?.empresas || [{ id: 1, nome: 'Empresa Principal #1' }]).map((emp: any) => (
                <option key={emp.id} value={emp.id}>
                  Empresa #{emp.id} — {emp.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">
              2. Infraestrutura de Banco do Empresário (100GB+):
            </label>
            <select
              value={provedorBanco}
              onChange={(e) => setProvedorBanco(e.target.value)}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-700 rounded-lg text-xs text-emerald-300 font-semibold"
            >
              <option value="postgresql_cliente">PostgreSQL do Empresário (Supabase / RDS / Cloud SQL / VPS)</option>
              <option value="s3_r2_cliente">PostgreSQL + Object Storage S3 / Cloudflare R2 (100GB+)</option>
              <option value="sheets_drive_cliente">Google Sheets / Google Drive da Conta do Empresário</option>
              <option value="servidor_local_cliente">Servidor Físico Local no Estabelecimento (On-Premise)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">
              3. Política de Atualização (Web, Mobile & Desktop):
            </label>
            <select
              value={politicaAtualizacao}
              onChange={(e) => setPoliticaAtualizacao(e.target.value)}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-700 rounded-lg text-xs text-amber-300 font-semibold"
            >
              <option value="escolha_ou_bloqueio">Perguntar ao Usuário ou Atualizar ao Bloquear Tela</option>
              <option value="ao_bloquear_tela">Atualizar Automaticamente Assim que a Tela Bloquear</option>
              <option value="ao_iniciar_sistema">Atualizar Automaticamente Apenas ao Iniciar o Sistema</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">
              4. Janela Operacional Offline no Aparelho:
            </label>
            <select
              value={janelaOfflineDias}
              onChange={(e) => setJanelaOfflineDias(Number(e.target.value))}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-700 rounded-lg text-xs text-sky-300 font-semibold"
            >
              <option value={7}>Últimos 7 dias (~15 MB no aparelho • 100GB na nuvem)</option>
              <option value={15}>Últimos 15 dias (~30 MB no aparelho • 100GB na nuvem)</option>
              <option value={30}>Últimos 30 dias (~45 MB no aparelho • 100GB na nuvem)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">
              String de Conexão do Banco do Empresário (PostgreSQL URI / Endpoint):
            </label>
            <input
              type="text"
              value={databaseUrlInput}
              onChange={(e) => setDatabaseUrlInput(e.target.value)}
              placeholder="postgresql://usuario:senha@db.empresa.com.br:5432/urutau_prod"
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-700 rounded-lg text-xs font-mono text-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">
              Bucket de Mídias & Backups de 100GB+ do Empresário (S3 / R2 / Google Drive):
            </label>
            <input
              type="text"
              value={s3BucketInput}
              onChange={(e) => setS3BucketInput(e.target.value)}
              placeholder="s3://guarda-dados-empresario-100gb/backups"
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-700 rounded-lg text-xs font-mono text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1">
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">
              Nome do Empresário / Razão Social (Controlador LGPD):
            </label>
            <input
              type="text"
              value={controladorNome}
              onChange={(e) => setControladorNome(e.target.value)}
              placeholder="Ex: João Silva / Restaurante Amazônia Ltda"
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-700 rounded-lg text-xs text-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">
              CPF ou CNPJ do Detentor da Guarda dos Dados:
            </label>
            <input
              type="text"
              value={controladorDoc}
              onChange={(e) => setControladorDoc(e.target.value)}
              placeholder="00.000.000/0001-00"
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-700 rounded-lg text-xs font-mono text-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">
              E-mail para Recebimento de Alertas de Backup:
            </label>
            <input
              type="email"
              value={controladorEmail}
              onChange={(e) => setControladorEmail(e.target.value)}
              placeholder="diretoria@empresa.com.br"
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-700 rounded-lg text-xs text-white"
            />
          </div>
        </div>

        <div className="p-3 rounded-lg bg-[#0B0D11] border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            {registroAtualSoberania.termo_guarda_assinado ? (
              <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  Termo de Guarda Assinado por {registroAtualSoberania.controlador_nome || 'Empresário'} ({registroAtualSoberania.controlador_documento || 'Doc. Registrado'})
                </span>
              </div>
            ) : (
              <div className="text-amber-300 font-bold">
                 Termo de Transferência de Guarda do Banco de Dados (LGPD Art. 39 e 42) pendente de assinatura nesta empresa
              </div>
            )}
            <div className="text-[11px] font-mono text-slate-400">
              {registroAtualSoberania.hash_assinatura_lgpd
                ? `Lacre SHA-256: ${registroAtualSoberania.hash_assinatura_lgpd.slice(0, 32)}... • Assinado em ${new Date(registroAtualSoberania.assinado_em).toLocaleString('pt-BR')}`
                : 'Ao assinar, o empresário assume formalmente a titularidade como Controlador e detentor da guarda física/nuvem do banco.'}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleSalvarSoberaniaEmpresario(false)}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs cursor-pointer"
            >
              Salvar Parâmetros
            </button>
            <button
              type="button"
              onClick={() => handleSalvarSoberaniaEmpresario(true)}
              className="px-4 py-2 rounded-lg bg-[#10B981] hover:bg-emerald-400 text-slate-950 font-black text-xs inline-flex items-center gap-1.5 cursor-pointer shadow"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Assinar Termo de Guarda do BD (Empresário)</span>
            </button>
          </div>
        </div>
      </div>

      
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#10B981]/25 pb-3">
        <div className="space-y-0.5">
          <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#10B981]">
            <HardDrive className="w-4 h-4 shrink-0" />
            <span>Economia de HD para VPS KVM2 + Banco de Dados Persistente no Google Sheets (Multi-Empresas)</span>
          </div>
          <p className="text-xs text-slate-300">
            Guarde quantas empresas quiser usando o <strong>Google Sheets como banco persistente</strong> (sem login OAuth bloqueante) e mantenha o disco da sua VPS KVM2 sempre leve!
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-black/50 border border-[#10B981]/40 text-[#10B981] font-mono text-xs font-bold">
            HD Banco Atual: {statusData?.discoKvm2?.tamanhoKb ?? '...'} KB ({statusData?.discoKvm2?.tamanhoMb ?? 0} MB)
          </span>
          <button
            type="button"
            onClick={() => setShowAppsScriptModal(true)}
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs inline-flex items-center gap-1.5 cursor-pointer shadow"
          >
            <Copy className="w-3.5 h-3.5" />
            <span> Copiar Script da Planilha Google (30s)</span>
          </button>
        </div>
      </div>

      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
        <div className="lg:col-span-6">
          <label className="block text-[11px] font-bold text-slate-200 mb-1">
            URL do App da Web da Sua Planilha Google (Banco Persistente Sem Limite de HD):
          </label>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={webhookInput}
              onChange={(e) => setWebhookInput(e.target.value)}
              placeholder="Cole aqui: https://script.google.com/macros/s/.../exec"
              className="w-full px-3 py-2 bg-[#05100C] border border-slate-700 focus:border-[#10B981] rounded-lg text-xs font-mono text-white"
            />
            <button
              type="button"
              disabled={loadingAction === 'config'}
              onClick={handleSalvarConfigSheets}
              className="px-3.5 py-2 rounded-lg bg-[#10B981] hover:bg-emerald-400 text-slate-950 font-black text-xs shrink-0 cursor-pointer"
            >
              {loadingAction === 'config' ? 'Salvando...' : 'Salvar URL'}
            </button>
          </div>
        </div>

        <div className="lg:col-span-6 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={loadingAction === 'sync_all'}
            onClick={() => handleSincronizarAgora()}
            className="px-3.5 py-2 rounded-lg bg-[#10B981]/20 hover:bg-[#10B981]/30 text-[#10B981] border border-[#10B981]/40 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingAction === 'sync_all' ? 'animate-spin' : ''}`} />
            <span> Sincronizar Todas as Empresas c/ Sheets</span>
          </button>

          <button
            type="button"
            disabled={loadingAction === 'otimizar_disco'}
            onClick={handleOtimizarDiscoKvm2}
            className="px-3.5 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>
              {loadingAction === 'otimizar_disco'
                ? 'Compactando...'
                : ' Compactar & Limpar HD da KVM2'}
            </span>
          </button>

          <button
            type="button"
            disabled={loadingAction === 'hydrate_all'}
            onClick={() => handleHidratarEmpresa()}
            className="px-3 py-2 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
            title="Restaura todos os dados salvos na aba _URUTAU_DB_PERSISTENTE da sua Planilha Google"
          >
            <Download className="w-3.5 h-3.5" />
            <span> Puxar Banco do Sheets</span>
          </button>
        </div>
      </div>

      
      {Array.isArray(statusData?.empresas) && statusData.empresas.length > 0 && (
        <div className="p-3 rounded-xl bg-[#05100C] border border-slate-800 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-slate-200">
               Partições por Empresa (Sincronize ou Descarregue Empresas Inativas no Google Sheets para economizar HD):
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              Status: {statusData?.config?.ultimoStatus || 'Ativo'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {statusData.empresas.map((empInfo: any) => (
              <div
                key={empInfo.id}
                className={`p-3 rounded-lg border flex flex-col justify-between gap-2 text-xs ${
                  empInfo.hibernadaNoSheets
                    ? 'bg-sky-950/25 border-sky-500/40'
                    : 'bg-[#0B0D11] border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <span>{empInfo.nome}</span>
                      {empInfo.hibernadaNoSheets && (
                        <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[10px] font-mono">
                           No Sheets
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      Peso no HD: <strong className="text-emerald-300">{empInfo.kbAtivos} KB</strong> •{' '}
                      {empInfo.contagem.reservas} res • {empInfo.contagem.caixa} cx •{' '}
                      {empInfo.contagem.estoque} est
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => handleSincronizarAgora(empInfo.id)}
                    className="px-2 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold cursor-pointer"
                  >
                     Salvar no Sheets
                  </button>

                  {!empInfo.hibernadaNoSheets ? (
                    <button
                      type="button"
                      onClick={() => handleOffloadEmpresa(empInfo)}
                      className="px-2 py-1 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[11px] font-bold cursor-pointer"
                      title="Envia para o Google Sheets e libera a memória pesada do HD da VPS KVM2"
                    >
                       Hibernar p/ Liberar HD
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleHidratarEmpresa(empInfo.id, empInfo.nome)}
                      className="px-2 py-1 rounded bg-sky-500 hover:bg-sky-400 text-slate-950 text-[11px] font-black cursor-pointer"
                    >
                       Reativar do Sheets
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      
      <FocusFormModal
        open={showAppsScriptModal}
        title="Como Usar Sua Planilha Google Como Banco de Dados Persistente (Sem Gastar HD da KVM2)"
        subtitle="Funciona direto na sua conta Google sem precisar de login OAuth ou chaves pagas"
        onClose={() => setShowAppsScriptModal(false)}
        onSave={() => {
          handleCopyAppsScript();
          setShowAppsScriptModal(false);
        }}
      >
        <div className="space-y-3 text-xs">
          <div className="p-3 rounded-lg bg-[#071712] border border-[#10B981]/35 space-y-1.5 text-slate-200">
            <div className="font-bold text-[#10B981]">Passo a Passo Rápido (30 segundos):</div>
            <div>1⃣ Abra qualquer planilha no seu Google Sheets e clique no menu superior <strong>Extensões → Apps Script</strong>.</div>
            <div>2⃣ Apague o texto que estiver lá e <strong>cole o código abaixo</strong>.</div>
            <div>3⃣ Clique no botão azul <strong>Implantar → Nova implantação → App da Web</strong>.</div>
            <div>4⃣ Em <em>&quot;Quem pode acessar&quot;</em>, selecione <strong>Qualquer pessoa</strong> e clique em <strong>Implantar</strong>.</div>
            <div>5⃣ Copie o link gerado (<code className="text-amber-300">https://script.google.com/macros/s/.../exec</code>) e cole no campo de URL desta tela!</div>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-amber-300">
              Código Google Apps Script (Cria abas automáticas para cada Empresa + Cofre de Restauração):
            </span>
            <button
              type="button"
              onClick={handleCopyAppsScript}
              className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              {copiedScript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedScript ? 'Código Copiado!' : 'Copiar Código Apps Script'}</span>
            </button>
          </div>

          <textarea
            readOnly
            value={statusData?.appsScriptCode || ''}
            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            className="w-full h-64 p-3 rounded-lg bg-black/90 border border-slate-800 font-mono text-[11px] text-emerald-300"
          />
        </div>
      </FocusFormModal>
    </div>
  );
}

export function EmpresasTab({
  data,
  onRefresh,
  showAlert,
  showConfirm
}: CommonTabProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [changingLicencaId, setChangingLicencaId] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<Empresa>>({
    id: undefined,
    nome: '',
    cnpj: '',
    waha_session_id: '',
    waha_numero: '',
    bot_interno_numero: '',
    wpp_comercial_numero: '',
    waha_status: 'Desconectado',
    bot_interno_status: 'Desconectado',
    nivel_acesso_licenca: 'uso_completo',
    observacao_licenca: '',
    cidade: 'Belém - PA',
    ramo: 'Gastronomia & Eventos',
    diaria_teto: 250
  });

  const [qrModalEmpresa, setQrModalEmpresa] = useState<Empresa | null>(null);

  const handleOpenEmpresa = (emp?: Empresa) => {
    if (emp) {
      setForm({ ...emp });
    } else {
      const slug = `waha_emp_${Date.now().toString().slice(-6)}`;
      setForm({
        id: undefined,
        nome: '',
        cnpj: '',
        waha_session_id: slug,
        waha_numero: '',
        bot_interno_numero: '',
        wpp_comercial_numero: '',
        waha_status: 'Desconectado',
        bot_interno_status: 'Desconectado',
        nivel_acesso_licenca: 'uso_completo',
        observacao_licenca: '',
        cidade: 'Belém - PA',
        ramo: 'Restaurante / Bar',
        diaria_teto: 220
      });
    }
    setModalOpen(true);
  };

  const handleAlterarLicencaManual = async (
    emp: Empresa,
    novoNivel: 'uso_completo' | 'somente_leitura' | 'somente_download'
  ) => {
    setChangingLicencaId(emp.id);
    try {
      const res = await fetch('/api/erp/empresas/alterar-licenca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: emp.id,
          nivel_acesso_licenca: novoNivel
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || 'Falha ao atualizar acesso da empresa');
      await onRefresh();
      const mapLabel = {
        uso_completo: 'Uso Completo Liberado (Ativo)',
        somente_leitura: 'Apenas Acessar/Visualizar os Dados (Somente Leitura)',
        somente_download: 'Apenas Baixar os Dados (Bloqueio Operacional)'
      };
      showAlert(
        'Controle Manual de Assinatura Atualizado',
        `A empresa "${emp.nome}" agora está no modo: ${mapLabel[novoNivel]}. A regra já está valendo imediatamente na Web, Celular e no Urutau.exe.`
      );
    } catch (e: any) {
      showAlert('Erro ao Alterar Permissão da Empresa', e.message);
    } finally {
      setChangingLicencaId(null);
    }
  };

  const handleSalvar = async () => {
    if (!form.nome?.trim()) {
      showAlert('Campo Obrigatório', 'Informe a razão social ou nome fantasia da empresa.');
      return;
    }
    try {
      const res = await fetch('/api/v50/empresas/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || 'Falha ao salvar empresa');
      setModalOpen(false);
      await onRefresh();
      showAlert('Perfil Empresarial Atualizado', `Empresa "${form.nome}" salva com sucesso.`);
    } catch (e: any) {
      showAlert('Erro ao Salvar Empresa', e.message);
    }
  };

  const handleSimularConexaoWaha = async (empresaId: number) => {
    try {
      const res = await fetch('/api/v50/empresas/conectar-waha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: empresaId, status: 'Conectado' })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro);
      setQrModalEmpresa(null);
      await onRefresh();
      showAlert('Web WhatsApp Comercial Conectado', 'O WhatsApp Comercial da empresa foi conectado.');
    } catch (e: any) {
      showAlert('Erro WhatsApp', e.message);
    }
  };

  return (
    <div className="space-y-6 w-full">
      <div className="p-4 sm:p-5 urutau-glass rounded-xl flex flex-wrap items-center justify-between gap-4 border border-[#10B981]/30">
        <div className="space-y-1">
          <h2 className="text-base sm:text-lg font-black text-slate-100 tracking-tight">
            Empresas & Controle Manual de Assinaturas (Super Admin)
          </h2>
          <p className="text-xs text-slate-300">
            Vendas e cobranças são resolvidas por você fora do sistema. Defina manualmente abaixo qual empresa <strong>continua usando</strong>, qual <strong>só pode acessar os dados</strong> e qual <strong>só pode baixar os dados</strong> (inclusive no <code className="text-[#10B981]">Urutau.exe</code>).
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleOpenEmpresa()}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-black text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-all shadow-lg shadow-amber-500/20 min-h-[40px] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Empresa</span>
        </button>
      </div>

      <div data-clean-stage="0" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {(data.empresas || []).map((emp) => {
          const isWppComercialConectado = emp.waha_status === 'Conectado';
          const isBotInternoConectado = emp.bot_interno_status === 'Conectado';
          const nivelAtual = emp.nivel_acesso_licenca || 'uso_completo';

          return (
            <div
              key={emp.id}
              className="p-5 urutau-glass rounded-xl space-y-4 hover:border-amber-500/40 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-100">{emp.nome}</h3>
                      <div className="text-[11px] font-mono text-slate-400">{emp.cidade}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenEmpresa(emp)}
                    className="text-xs text-slate-400 hover:text-amber-400 font-mono p-1 min-h-[36px] cursor-pointer"
                  >
                    Editar
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-[#051215] border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                      Controle de Assinatura (Manual)
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        nivelAtual === 'uso_completo'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : nivelAtual === 'somente_leitura'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}
                    >
                      {nivelAtual === 'uso_completo'
                        ? ' Uso Completo'
                        : nivelAtual === 'somente_leitura'
                        ? ' Só Acessar Dados'
                        : ' Só Baixar Dados'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-1.5 pt-1">
                    <button
                      type="button"
                      disabled={changingLicencaId === emp.id}
                      onClick={() => handleAlterarLicencaManual(emp, 'uso_completo')}
                      className={`w-full px-2.5 py-1.5 rounded-lg text-left text-[11px] font-bold flex items-center justify-between cursor-pointer transition-all ${
                        nivelAtual === 'uso_completo'
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-black/40 text-slate-300 hover:bg-white/10 border border-white/10'
                      }`}
                    >
                      <span>1. Continuar Usando (Acesso Total)</span>
                      {nivelAtual === 'uso_completo' && <Check className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      type="button"
                      disabled={changingLicencaId === emp.id}
                      onClick={() => handleAlterarLicencaManual(emp, 'somente_leitura')}
                      className={`w-full px-2.5 py-1.5 rounded-lg text-left text-[11px] font-bold flex items-center justify-between cursor-pointer transition-all ${
                        nivelAtual === 'somente_leitura'
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-black/40 text-slate-300 hover:bg-white/10 border border-white/10'
                      }`}
                    >
                      <span>2. Só Acessar os Dados (Somente Leitura)</span>
                      {nivelAtual === 'somente_leitura' && <Check className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      type="button"
                      disabled={changingLicencaId === emp.id}
                      onClick={() => handleAlterarLicencaManual(emp, 'somente_download')}
                      className={`w-full px-2.5 py-1.5 rounded-lg text-left text-[11px] font-bold flex items-center justify-between cursor-pointer transition-all ${
                        nivelAtual === 'somente_download'
                          ? 'bg-rose-500 text-white'
                          : 'bg-black/40 text-slate-300 hover:bg-white/10 border border-white/10'
                      }`}
                    >
                      <span>3. Só Baixar os Dados (Bloqueio de Telas)</span>
                      {nivelAtual === 'somente_download' && <Check className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-black/40 border border-white/[0.06] rounded-lg space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Bot Interno (Equipe):</span>
                    <span
                      className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold ${
                        isBotInternoConectado ? 'text-emerald-400' : 'text-slate-400'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isBotInternoConectado ? 'bg-emerald-400' : 'bg-slate-500'
                        }`}
                      />
                      {isBotInternoConectado ? 'Conectado' : 'Desconectado'} (
                      {emp.bot_interno_numero || emp.waha_numero || 'Sem nº'})
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Web WhatsApp Comercial:</span>
                    <span
                      className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold ${
                        isWppComercialConectado ? 'text-emerald-400' : 'text-rose-300'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isWppComercialConectado ? 'bg-emerald-400' : 'bg-rose-400'
                        }`}
                      />
                      {isWppComercialConectado ? 'Conectado' : 'Desconectado'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/[0.06] pt-1.5 text-[11px]">
                    <span className="text-slate-400">Diária Teto Homologada:</span>
                    <span className="font-mono text-amber-300 font-semibold">{formatBRL(emp.diaria_teto)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
                <a
                  href={`/api/desktop/urutau.exe?empresa=${encodeURIComponent(emp.nome)}&empresa_id=${emp.id}`}
                  download="Urutau.exe"
                  className="flex-1 py-2.5 px-3 bg-[#10B981]/15 hover:bg-[#10B981] hover:text-slate-950 text-[#6EE7B7] border border-[#10B981]/35 rounded-lg text-xs font-bold transition-all inline-flex items-center justify-center gap-1.5 min-h-[40px]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar Urutau.exe</span>
                </a>
              </div>
            </div>
          );
        })}
      </div>

      <div data-clean-stage="1">
        <Kvm2GoogleSheetsPersistentDbSection
          onRefresh={onRefresh}
          showAlert={showAlert}
          showConfirm={showConfirm}
        />
      </div>

      <FocusFormModal
        open={modalOpen}
        title={form.id ? `Editar Empresa — ${form.nome}` : 'Cadastrar Nova Empresa Parceira'}
        subtitle="Configuração de canais da equipe, Web WhatsApp Comercial e nível de acesso da assinatura"
        onClose={() => setModalOpen(false)}
        onSave={handleSalvar}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-400 mb-1">Razão Social / Nome Fantasia</label>
            <input
              type="text"
              value={form.nome || ''}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex: Grupo Tapajós Alta Gastronomia"
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">CNPJ</label>
            <input
              type="text"
              value={form.cnpj || ''}
              onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
              placeholder="00.000.000/0001-00"
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs font-mono text-slate-100"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-400 mb-1">Localização (País, Estado e Cidade)</label>
            <UrutauValidatedCityStateSelector
              value={form.cidade || 'Belém - PA'}
              onChange={(val) => setForm({ ...form, cidade: val })}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Bot Interno da Equipe (Sem Clientes)</label>
            <input
              type="text"
              value={form.bot_interno_numero || form.waha_numero || ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  bot_interno_numero: e.target.value,
                  waha_numero: e.target.value
                })
              }
              placeholder="5591999990001"
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs font-mono text-amber-300"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Nível de Acesso / Assinatura</label>
            <select
              value={form.nivel_acesso_licenca || 'uso_completo'}
              onChange={(e) =>
                setForm({
                  ...form,
                  nivel_acesso_licenca: e.target.value as any
                })
              }
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100 font-bold"
            >
              <option value="uso_completo">1. Continuar Usando (Acesso Total)</option>
              <option value="somente_leitura">2. Só Acessar os Dados (Somente Leitura)</option>
              <option value="somente_download">3. Só Baixar os Dados (Bloqueio Operacional)</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-400 mb-1">Valor Teto Padrão de Diária (R$)</label>
            <input
              type="number"
              step="5"
              value={form.diaria_teto || 200}
              onChange={(e) => setForm({ ...form, diaria_teto: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs font-mono text-slate-100"
            />
          </div>
        </div>
      </FocusFormModal>

      {qrModalEmpresa && (
        <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md urutau-glass rounded-xl p-6 space-y-5 text-center">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="text-sm font-bold text-slate-100">
                Conectar Web WhatsApp Comercial — {qrModalEmpresa.nome}
              </div>
              <button
                type="button"
                onClick={() => setQrModalEmpresa(null)}
                className="text-slate-400 hover:text-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleSimularConexaoWaha(qrModalEmpresa.id)}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-colors"
            >
              Confirmar Leitura do QR Code
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function FreelancersTab({
  data,
  onRefresh,
  showAlert,
  showConfirm
}: CommonTabProps) {
  const [empresaFiltroId, setEmpresaFiltroId] = useState<number>(data.empresas[0]?.id || 1);
  const [funcaoFiltro, setFuncaoFiltro] = useState<string>('Todas');
  const [diariaMaxima, setDiariaMaxima] = useState<number>(300);
  const [diaSemanaFiltro, setDiaSemanaFiltro] = useState<number>(new Date().getDay());
  const [apenasDisponiveis, setApenasDisponiveis] = useState<boolean>(true);

  const [modalNovoFreeOpen, setModalNovoFreeOpen] = useState<boolean>(false);
  const [formFree, setFormFree] = useState<Partial<Freelancer>>({
    nome: '',
    whatsapp: '',
    funcao: 'Garçom Extra',
    valor_diaria: 180,
    disponivel: true,
    disponibilidade_dias: [0, 4, 5, 6],
    empresas_bloqueadas: [],
    cidade: 'Belém - PA'
  });

  const empresaSelecionada = useMemo(() => {
    if (Number(empresaFiltroId) === 0) return null;
    return data.empresas.find((e) => Number(e.id) === Number(empresaFiltroId)) || null;
  }, [data.empresas, empresaFiltroId]);

  const freelancersComMatch = useMemo(() => {
    return (data.freelancers || [])
      .filter((f) => !f.arquivado_legal)
      .map((f) => {
        const condicaoDisponivel = f.disponivel;
        const condicaoDiaSemana = f.disponibilidade_dias?.includes(diaSemanaFiltro);
        const condicaoDiaria = Number(f.valor_diaria || 0) <= diariaMaxima;
        const condicaoFuncao = funcaoFiltro === 'Todas' || f.funcao === funcaoFiltro;
        const bloqueadoPeloFree = empresaSelecionada
          ? f.empresas_bloqueadas?.includes(empresaSelecionada.id)
          : false;

        const deuMatch =
          condicaoDisponivel &&
          condicaoDiaSemana &&
          condicaoDiaria &&
          condicaoFuncao &&
          !bloqueadoPeloFree;

        return {
          ...f,
          deuMatch,
          motivosRecusa: (
            [
              !condicaoDisponivel ? 'Indisponível no momento' : null,
              !condicaoDiaSemana ? `Não atua em ${DIAS_SEMANA_NOMES[diaSemanaFiltro]}` : null,
              !condicaoDiaria ? `Diária acima do teto (pede ${formatBRL(f.valor_diaria)})` : null,
              !condicaoFuncao ? `Função diferente de ${funcaoFiltro}` : null,
              bloqueadoPeloFree ? 'Bloqueio cadastrado com esta empresa' : null
            ] as (string | null)[]
          ).filter((m): m is string => Boolean(m))
        };
      });
  }, [
    data.freelancers,
    diaSemanaFiltro,
    diariaMaxima,
    funcaoFiltro,
    empresaSelecionada
  ]);

  const listaFiltrada = useMemo(() => {
    if (apenasDisponiveis) {
      return freelancersComMatch.filter((f) => f.deuMatch);
    }
    return freelancersComMatch;
  }, [freelancersComMatch, apenasDisponiveis]);

  const handleSolicitarContratacaoMatch = async (free: any) => {
    if (!free.deuMatch) {
      showAlert(
        'Match Não Atendido',
        `Não é possível contratar: ${free.motivosRecusa.join(', ')}.`
      );
      return;
    }

    const nomeSolicitante = empresaSelecionada?.nome || 'Contratação Independente / Avulsa';
    try {
      const res = await fetch('/api/v50/match/contratar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: empresaSelecionada?.id || 0,
          empresa_nome: nomeSolicitante,
          freelancer_id: free.id,
          freelancer_nome: free.nome,
          freelancer_whatsapp: free.whatsapp,
          data: new Date().toISOString().split('T')[0],
          funcao: free.funcao,
          valor_acordado: free.valor_diaria
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || 'Falha ao solicitar freelancer');
      await onRefresh();
      showAlert(
        'Match Concluído & Notificação Enviada!',
        `Solicitação registrada por "${nomeSolicitante}" para o profissional ${free.nome} (${free.funcao}). Mensagem WhatsApp de convocação disparada para ${free.whatsapp}.`
      );
    } catch (e: any) {
      showAlert('Erro no Match', e.message);
    }
  };

  const handleSalvarNovoFreelancer = async () => {
    if (!formFree.nome?.trim() || !formFree.whatsapp?.trim()) {
      showAlert('Campos Obrigatórios', 'Informe nome e WhatsApp do freelancer.');
      return;
    }
    try {
      const res = await fetch('/api/v50/freelancers/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formFree)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || 'Erro ao cadastrar');
      setModalNovoFreeOpen(false);
      await onRefresh();
      showAlert('Freelancer Cadastrado', `Perfil de ${formFree.nome} ativo no banco de talentos.`);
    } catch (e: any) {
      showAlert('Erro', e.message);
    }
  };

  return (
    <div className="space-y-6 w-full">
      
      <div className="p-5 urutau-glass rounded-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-base font-bold text-slate-100 tracking-tight">
            Freelancers
          </h2>

          <button
            type="button"
            onClick={() => setModalNovoFreeOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-all shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Freelancer</span>
          </button>
        </div>

        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-3 border-t border-white/[0.06]">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1 font-mono uppercase">Empresa Solicitante</label>
            <select
              value={empresaFiltroId}
              onChange={(e) => setEmpresaFiltroId(Number(e.target.value))}
              className="w-full px-3 py-2 bg-black/40 border border-white/[0.08] rounded-lg text-xs text-slate-100 font-semibold focus:border-amber-500"
            >
              <option value={0}>Contratação Independente / Sem Empresa Vinculada</option>
              {data.empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome} (Teto: {formatBRL(e.diaria_teto)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1 font-mono uppercase">Função Desejada</label>
            <select
              value={funcaoFiltro}
              onChange={(e) => setFuncaoFiltro(e.target.value)}
              className="w-full px-3 py-2 bg-black/40 border border-white/[0.08] rounded-lg text-xs text-slate-100 focus:border-amber-500"
            >
              <option value="Todas">Todas as Funções</option>
              <option value="Técnico / Manutenção">Técnico / Manutenção</option>
              <option value="Consultor / Especialista">Consultor / Especialista</option>
              <option value="Garçom Extra">Garçom Extra</option>
              <option value="Bartender Extra">Bartender Extra</option>
              <option value="Cozinheiro de Linha">Cozinheiro de Linha</option>
              <option value="Cumim / Apoio">Cumim / Apoio</option>
              <option value="Hostess / Recepção">Hostess / Recepção</option>
              <option value="Operador de Caixa">Operador de Caixa</option>
              <option value="Serviços Gerais / Apoio">Serviços Gerais / Apoio</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1 font-mono uppercase">Dia Requisitado</label>
            <select
              value={diaSemanaFiltro}
              onChange={(e) => setDiaSemanaFiltro(Number(e.target.value))}
              className="w-full px-3 py-2 bg-black/40 border border-white/[0.08] rounded-lg text-xs font-mono text-amber-300 focus:border-amber-500"
            >
              {DIAS_SEMANA_NOMES.map((d, i) => (
                <option key={i} value={i}>
                  {d} ({i === 0 ? 'Domingo' : i === 6 ? 'Sábado' : 'Dia Útil'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1 font-mono uppercase">
              Teto Máximo da Diária (R$)
            </label>
            <input
              type="number"
              step="10"
              value={diariaMaxima}
              onChange={(e) => setDiariaMaxima(Number(e.target.value))}
              className="w-full px-3 py-2 bg-black/40 border border-white/[0.08] rounded-lg text-xs font-mono tabular-nums text-slate-100"
            />
          </div>

          <div className="flex items-center pt-5">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={apenasDisponiveis}
                onChange={(e) => setApenasDisponiveis(e.target.checked)}
                className="accent-amber-500 w-4 h-4"
              />
              <span>Exibir Apenas Matches Perfeitos</span>
            </label>
          </div>
        </div>
      </div>

      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {listaFiltrada.map((free) => (
          <div
            key={free.id}
            className={`p-5 rounded-xl border transition-all flex flex-col justify-between space-y-4 ${
              free.deuMatch
                ? 'urutau-glass border-amber-500/40 shadow-lg shadow-amber-500/5'
                : 'bg-black/30 border-white/[0.05] opacity-60'
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-100">{free.nome}</h3>
                    {free.deuMatch && (
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                        MATCH!
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-amber-400 font-medium">{free.funcao}</div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-mono font-bold text-slate-100 tabular-nums">
                    {formatBRL(free.valor_diaria)}
                  </div>
                  <div className="text-[10px] text-slate-400">por diária</div>
                </div>
              </div>

              <div className="p-3 bg-black/40 border border-white/[0.06] rounded-lg space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Status Geral:</span>
                  <span className={free.disponivel ? 'text-emerald-400' : 'text-rose-400'}>
                    {free.disponivel ? 'Disponível para Chamadas' : 'Indisponível'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Dias Disponíveis:</span>
                  <span className="text-slate-200">
                    {free.disponibilidade_dias?.map((d: number) => DIAS_SEMANA_NOMES[d]).join(', ')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] border-t border-white/[0.06] pt-1.5">
                  <span className="text-slate-400">WhatsApp de Contato:</span>
                  <span className="text-amber-300">{free.whatsapp}</span>
                </div>
              </div>

              {!free.deuMatch && (
                <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300 space-y-0.5">
                  <span className="font-semibold block">Incompatibilidade:</span>
                  {free.motivosRecusa.map((mot: string, idx: number) => (
                    <div key={idx}>• {mot}</div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={!free.deuMatch}
              onClick={() => handleSolicitarContratacaoMatch(free)}
              className={`w-full py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                free.deuMatch
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-white/[0.05] text-slate-500 cursor-not-allowed border border-white/[0.05]'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Solicitar Contratação de Diária</span>
            </button>
          </div>
        ))}
      </div>

      
      <div className="p-5 urutau-glass rounded-xl space-y-3">
        <h3 className="text-sm font-bold text-slate-200">
          Histórico Recente de Matches & Contratações na Rede
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/[0.08] text-[11px] font-mono uppercase text-slate-400">
                <th className="py-2.5 px-3">Data</th>
                <th className="py-2.5 px-3">Empresa</th>
                <th className="py-2.5 px-3">Freelancer</th>
                <th className="py-2.5 px-3">Função</th>
                <th className="py-2.5 px-3 text-right">Diária Acordada</th>
                <th className="py-2.5 px-3 text-right">Status do Match</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {(data.matches_contratacoes || []).map((m) => (
                <tr key={m.id} className="hover:bg-white/[0.02]">
                  <td className="py-2.5 px-3 font-mono text-amber-400">{m.data}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-100">{m.empresa_nome}</td>
                  <td className="py-2.5 px-3 text-slate-200">{m.freelancer_nome}</td>
                  <td className="py-2.5 px-3 text-slate-300">{m.funcao}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-amber-300 font-semibold">
                    {formatBRL(m.valor_acordado)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-400 font-semibold">
                    {m.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      
      <FocusFormModal
        open={modalNovoFreeOpen}
        title="Cadastrar Novo Freelancer no Banco de Talentos"
        subtitle="O colaborador será listado automaticamente para match de empresas respeitando diária e disponibilidade"
        onClose={() => setModalNovoFreeOpen(false)}
        onSave={handleSalvarNovoFreelancer}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Nome Completo</label>
            <input
              type="text"
              value={formFree.nome || ''}
              onChange={(e) => setFormFree({ ...formFree, nome: e.target.value })}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">WhatsApp (com DDD)</label>
            <input
              type="text"
              value={formFree.whatsapp || ''}
              onChange={(e) => setFormFree({ ...formFree, whatsapp: e.target.value })}
              placeholder="5591988887777"
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs font-mono text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Função / Especialidade Principal</label>
            <input
              type="text"
              list="urutau-funcoes-free-list"
              value={formFree.funcao || ''}
              onChange={(e) => setFormFree({ ...formFree, funcao: e.target.value })}
              placeholder="Ex: Técnico, Garçom Extra, Consultor..."
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs text-slate-100"
            />
            <datalist id="urutau-funcoes-free-list">
              <option value="Técnico / Manutenção" />
              <option value="Consultor / Especialista" />
              <option value="Garçom Extra" />
              <option value="Bartender Extra" />
              <option value="Cozinheiro de Linha" />
              <option value="Cumim / Apoio" />
              <option value="Hostess / Recepção" />
              <option value="Operador de Caixa" />
              <option value="Serviços Gerais / Apoio" />
            </datalist>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Preço da Diária Padrão (R$)</label>
            <input
              type="number"
              step="10"
              value={formFree.valor_diaria || 180}
              onChange={(e) => setFormFree({ ...formFree, valor_diaria: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-[#0B0D11] border border-slate-800 rounded text-xs font-mono text-slate-100"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-400 mb-1">Localização (País, Estado e Cidade)</label>
            <UrutauValidatedCityStateSelector
              value={formFree.cidade || 'Belém - PA'}
              onChange={(val) => setFormFree({ ...formFree, cidade: val })}
            />
          </div>
        </div>

        <div className="p-3.5 bg-[#0B0D11] border border-slate-800 rounded-lg space-y-2">
          <label className="block text-xs font-semibold text-amber-400">
            Dias de Disponibilidade na Semana
          </label>
          <div className="flex flex-wrap gap-2">
            {DIAS_SEMANA_NOMES.map((d, idx) => {
              const ativo = formFree.disponibilidade_dias?.includes(idx);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    const novosDias = ativo
                      ? (formFree.disponibilidade_dias || []).filter((x) => x !== idx)
                      : [...(formFree.disponibilidade_dias || []), idx];
                    setFormFree({ ...formFree, disponibilidade_dias: novosDias });
                  }}
                  className={`px-3 py-1.5 text-xs font-mono rounded border transition-colors ${
                    ativo
                      ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold'
                      : 'bg-black/40 text-slate-400 border-white/[0.08]'
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      </FocusFormModal>
    </div>
  );
}
