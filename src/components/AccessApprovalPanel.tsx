import React, { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  Check,
  Clock,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  X
} from 'lucide-react';

interface ApprovalUserRow {
  id: number;
  nome: string;
  email?: string;
  telefone?: string;
  cargo?: string;
  tipo?: string;
  role?: string;
  approval_status: 'pending_approval' | 'approved' | 'rejected';
  empresas_ids?: number[];
  terms_accepted?: boolean;
  terms_version?: string;
  terms_accepted_at_utc?: string;
  terms_accepted_ip?: string;
  rejection_reason?: string;
  criado_em?: string;
}

interface CompanyOption {
  id: number;
  nome: string;
  subdominio?: string;
}

const ROLE_OPTIONS_MASTER = [
  { value: 'company_owner', label: 'Proprietário da Empresa (company_owner)' },
  { value: 'rh_manager', label: 'Gerente de RH' },
  { value: 'manager', label: 'Gerente Operacional' },
  { value: 'cashier', label: 'Operador de Caixa' },
  { value: 'waiter', label: 'Garçom / Salão' },
  { value: 'member', label: 'Colaborador' }
];

const ROLE_OPTIONS_OWNER = [
  { value: 'rh_manager', label: 'Gerente de RH' },
  { value: 'manager', label: 'Gerente Operacional' },
  { value: 'cashier', label: 'Operador de Caixa' },
  { value: 'waiter', label: 'Garçom / Salão' },
  { value: 'member', label: 'Colaborador' }
];

function formatDateBr(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export const AccessApprovalPanel: React.FC<{
  onRefreshErp?: () => Promise<void> | void;
}> = ({ onRefreshErp }) => {
  const [scope, setScope] = useState<'admin_master' | 'company_owner'>('company_owner');
  const [pendingUsers, setPendingUsers] = useState<ApprovalUserRow[]>([]);
  const [activeUsers, setActiveUsers] = useState<ApprovalUserRow[]>([]);
  const [rejectedUsers, setRejectedUsers] = useState<ApprovalUserRow[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [activeSection, setActiveSection] = useState<'pending' | 'invite' | 'directory'>('pending');

  const [selectedCompanyByUser, setSelectedCompanyByUser] = useState<Record<number, number>>({});
  const [selectedRoleByUser, setSelectedRoleByUser] = useState<Record<number, string>>({});

  const [inviteNome, setInviteNome] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteTelefone, setInviteTelefone] = useState('');
  const [inviteSenha, setInviteSenha] = useState('');
  const [inviteRole, setInviteRole] = useState('waiter');
  const [inviteCompanyId, setInviteCompanyId] = useState<number>(0);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/access/pending');
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: 'err', text: json.erro || 'Não foi possível carregar a fila de aprovações.' });
        return;
      }
      setScope(json.scope === 'admin_master' ? 'admin_master' : 'company_owner');
      const nextCompanies: CompanyOption[] = Array.isArray(json.companies) ? json.companies : [];
      setCompanies(nextCompanies);
      const nextPending: ApprovalUserRow[] = Array.isArray(json.pendingUsers) ? json.pendingUsers : [];
      setPendingUsers(nextPending);
      setActiveUsers(Array.isArray(json.activeUsers) ? json.activeUsers : []);
      setRejectedUsers(Array.isArray(json.rejectedUsers) ? json.rejectedUsers : []);

      const defaultCompId = nextCompanies[0]?.id || 1;
      setInviteCompanyId((prev) => (prev > 0 ? prev : defaultCompId));

      setSelectedCompanyByUser((prev) => {
        const next = { ...prev };
        for (const u of nextPending) {
          if (!next[u.id]) {
            next[u.id] =
              Array.isArray(u.empresas_ids) && u.empresas_ids.length > 0
                ? Number(u.empresas_ids[0])
                : defaultCompId;
          }
        }
        return next;
      });

      setSelectedRoleByUser((prev) => {
        const next = { ...prev };
        for (const u of nextPending) {
          if (!next[u.id]) {
            next[u.id] =
              json.scope === 'admin_master' && u.role === 'company_owner'
                ? 'company_owner'
                : 'member';
          }
        }
        return next;
      });
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'Erro de comunicação com o servidor.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const handleApprove = async (user: ApprovalUserRow) => {
    const companyId = selectedCompanyByUser[user.id] || companies[0]?.id || 0;
    const role = selectedRoleByUser[user.id] || 'member';
    if (!companyId) {
      setFeedback({ type: 'err', text: 'Selecione uma empresa para vincular este usuário.' });
      return;
    }
    setBusyUserId(user.id);
    setFeedback(null);
    try {
      const res = await fetch('/api/access/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, companyId, role })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: 'err', text: json.erro || 'Não foi possível aprovar o cadastro.' });
        return;
      }
      setFeedback({
        type: 'ok',
        text: `Acesso de ${user.nome} aprovado com sucesso.`
      });
      await loadQueue();
      if (onRefreshErp) await onRefreshErp();
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'Falha ao aprovar usuário.' });
    } finally {
      setBusyUserId(null);
    }
  };

  const handleReject = async (user: ApprovalUserRow) => {
    setBusyUserId(user.id);
    setFeedback(null);
    try {
      const res = await fetch('/api/access/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          reason: 'Solicitação não autorizada pela administração.'
        })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: 'err', text: json.erro || 'Não foi possível recusar o cadastro.' });
        return;
      }
      setFeedback({ type: 'ok', text: `Solicitação de ${user.nome} recusada.` });
      await loadQueue();
      if (onRefreshErp) await onRefreshErp();
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'Falha ao recusar cadastro.' });
    } finally {
      setBusyUserId(null);
    }
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteNome.trim() || !inviteSenha.trim()) {
      setFeedback({ type: 'err', text: 'Preencha o nome completo e a senha inicial do membro.' });
      return;
    }
    const targetCompanyId = inviteCompanyId || companies[0]?.id || 0;
    if (!targetCompanyId) {
      setFeedback({ type: 'err', text: 'Selecione a empresa de destino.' });
      return;
    }
    setInviteSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/access/invite-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: inviteNome.trim(),
          email: inviteEmail.trim(),
          telefone: inviteTelefone.trim(),
          senha: inviteSenha.trim(),
          role: inviteRole,
          companyId: targetCompanyId
        })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFeedback({ type: 'err', text: json.erro || 'Não foi possível cadastrar o membro.' });
        return;
      }
      setFeedback({
        type: 'ok',
        text: `Membro ${inviteNome.trim()} cadastrado e liberado para acesso.`
      });
      setInviteNome('');
      setInviteEmail('');
      setInviteTelefone('');
      setInviteSenha('');
      await loadQueue();
      if (onRefreshErp) await onRefreshErp();
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'Falha ao cadastrar membro.' });
    } finally {
      setInviteSubmitting(false);
    }
  };

  const roleChoices = scope === 'admin_master' ? ROLE_OPTIONS_MASTER : ROLE_OPTIONS_OWNER;

  const getCompanyName = (companyIds?: number[]) => {
    if (!Array.isArray(companyIds) || companyIds.length === 0) return 'Sem vínculo';
    const match = companies.find((c) => c.id === Number(companyIds[0]));
    return match ? match.nome : `Empresa #${companyIds[0]}`;
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-[#12161F] border border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>
              {scope === 'admin_master'
                ? 'Central Zero-Trust de Aprovações (Admin Master)'
                : 'Equipe & Aprovações da Sua Empresa'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {scope === 'admin_master'
              ? 'Novos cadastros permanecem em quarentena até você aprovar, vincular a uma empresa e definir a permissão.'
              : 'Gerencie e cadastre membros exclusivamente para a sua empresa (RH, Gerente, Caixa, Garçom).'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg bg-[#0E1117] border border-white/[0.08] p-0.5">
            <button
              type="button"
              onClick={() => setActiveSection('pending')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                activeSection === 'pending'
                  ? 'bg-[#181D28] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Pendentes ({pendingUsers.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('invite')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                activeSection === 'invite'
                  ? 'bg-[#181D28] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Cadastrar Membro
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('directory')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                activeSection === 'directory'
                  ? 'bg-[#181D28] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Ativos ({activeUsers.length})
            </button>
          </div>
          <button
            type="button"
            onClick={loadQueue}
            disabled={loading}
            className="p-2 rounded-lg bg-[#181D28] border border-white/[0.08] text-slate-300 hover:text-white cursor-pointer"
            title="Atualizar fila"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`px-3.5 py-2.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-2 ${
            feedback.type === 'ok'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-current opacity-70 hover:opacity-100 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {activeSection === 'pending' && (
        <div className="rounded-xl bg-[#12161F] border border-white/[0.08] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Cadastros em Quarentena (Aguardando Aprovação)</span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {pendingUsers.length} pendente(s)
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Carregando fila de aprovações...</div>
          ) : pendingUsers.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <UserCheck className="w-7 h-7 text-slate-500 mx-auto" />
              <div className="text-sm font-medium text-slate-200">Nenhum cadastro pendente no momento</div>
              <p className="text-xs text-slate-400">
                Novos usuários que solicitarem acesso aparecerão aqui com data e IP do aceite LGPD.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {pendingUsers.map((user) => (
                <div
                  key={user.id}
                  className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-white/[0.02]"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">{user.nome}</span>
                      <span className="text-[11px] font-mono text-amber-300">
                        pending_approval
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                      {user.email && <span>E-mail: {user.email}</span>}
                      {user.telefone && <span>WhatsApp: {user.telefone}</span>}
                      <span>Solicitado: {formatDateBr(user.criado_em)}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      LGPD: {user.terms_accepted ? 'Aceito' : 'Pendente'} •{' '}
                      {formatDateBr(user.terms_accepted_at_utc)} • IP:{' '}
                      {user.terms_accepted_ip || 'não registrado'}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <select
                        value={selectedCompanyByUser[user.id] || companies[0]?.id || ''}
                        disabled={scope !== 'admin_master' && companies.length <= 1}
                        onChange={(e) =>
                          setSelectedCompanyByUser((prev) => ({
                            ...prev,
                            [user.id]: Number(e.target.value)
                          }))
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-[#0E1117] border border-white/[0.1] text-xs text-slate-200"
                      >
                        {companies.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nome}
                          </option>
                        ))}
                      </select>
                    </div>

                    <select
                      value={selectedRoleByUser[user.id] || 'member'}
                      onChange={(e) =>
                        setSelectedRoleByUser((prev) => ({
                          ...prev,
                          [user.id]: e.target.value
                        }))
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-[#0E1117] border border-white/[0.1] text-xs text-slate-200"
                    >
                      {roleChoices.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={busyUserId === user.id}
                      onClick={() => handleApprove(user)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Aprovar</span>
                    </button>

                    <button
                      type="button"
                      disabled={busyUserId === user.id}
                      onClick={() => handleReject(user)}
                      className="px-3 py-1.5 rounded-lg bg-[#181D28] hover:bg-rose-500/20 border border-white/[0.1] hover:border-rose-500/40 text-slate-300 hover:text-rose-200 text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Recusar</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSection === 'invite' && (
        <form
          onSubmit={handleInviteSubmit}
          className="p-5 rounded-xl bg-[#12161F] border border-white/[0.08] space-y-4 max-w-2xl"
        >
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-emerald-400" />
              <span>Cadastrar e Liberar Novo Membro</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              O membro criado por aqui é vinculado diretamente à empresa selecionada e entra aprovado no perfil escolhido.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Nome Completo *
              </label>
              <input
                type="text"
                value={inviteNome}
                onChange={(e) => setInviteNome(e.target.value)}
                placeholder="Ex.: Carla Mendes"
                className="w-full px-3 py-2 rounded-lg bg-[#0E1117] border border-white/[0.1] text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Empresa *
              </label>
              <select
                value={inviteCompanyId || companies[0]?.id || ''}
                disabled={scope !== 'admin_master' && companies.length <= 1}
                onChange={(e) => setInviteCompanyId(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-[#0E1117] border border-white/[0.1] text-xs text-white"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                E-mail
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="carla@empresa.com"
                className="w-full px-3 py-2 rounded-lg bg-[#0E1117] border border-white/[0.1] text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                WhatsApp
              </label>
              <input
                type="text"
                value={inviteTelefone}
                onChange={(e) => setInviteTelefone(e.target.value)}
                placeholder="(91) 99999-9999"
                className="w-full px-3 py-2 rounded-lg bg-[#0E1117] border border-white/[0.1] text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Função / Permissão *
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0E1117] border border-white/[0.1] text-xs text-white"
              >
                {roleChoices.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Senha Inicial *
              </label>
              <input
                type="password"
                value={inviteSenha}
                onChange={(e) => setInviteSenha(e.target.value)}
                placeholder="Mínimo 4 caracteres"
                className="w-full px-3 py-2 rounded-lg bg-[#0E1117] border border-white/[0.1] text-xs text-white"
              />
            </div>
          </div>

          <div className="pt-1 flex justify-end">
            <button
              type="submit"
              disabled={inviteSubmitting}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{inviteSubmitting ? 'Cadastrando...' : 'Cadastrar e Aprovar Membro'}</span>
            </button>
          </div>
        </form>
      )}

      {activeSection === 'directory' && (
        <div className="rounded-xl bg-[#12161F] border border-white/[0.08] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <Users className="w-4 h-4 text-slate-400" />
              <span>Usuários Aprovados no Escopo</span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {activeUsers.length} ativo(s) • {rejectedUsers.length} recusado(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="py-2.5 px-4 font-semibold">Usuário</th>
                  <th className="py-2.5 px-4 font-semibold">Empresa</th>
                  <th className="py-2.5 px-4 font-semibold">Perfil / Cargo</th>
                  <th className="py-2.5 px-4 font-semibold">Aceite LGPD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {activeUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-white/[0.02]">
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-white">{u.nome}</div>
                      <div className="text-[11px] text-slate-400">
                        {u.email || u.telefone || `ID #${u.id}`}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-300">{getCompanyName(u.empresas_ids)}</td>
                    <td className="py-2.5 px-4">
                      <div className="text-slate-200">{u.cargo || u.tipo}</div>
                      <div className="text-[11px] font-mono text-slate-500">{u.role}</div>
                    </td>
                    <td className="py-2.5 px-4 text-[11px] font-mono text-slate-400">
                      {u.terms_accepted_at_utc
                        ? `${formatDateBr(u.terms_accepted_at_utc)} (${u.terms_accepted_ip || 'local'})`
                        : 'Conta pré-existente'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
