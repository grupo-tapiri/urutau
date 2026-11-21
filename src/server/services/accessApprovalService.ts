import { Express, Request, Response } from 'express';
import { getPostgresEngine } from '../db/postgresEngine.ts';
import { AuthenticatedOperatorContext } from './zeroTrustCommerceService.ts';

type PostgresEngineHandle = ReturnType<typeof getPostgresEngine>;

export type ApprovalStatus = 'pending_approval' | 'approved' | 'rejected';

export type UrutauAccessRole =
  | 'admin_master'
  | 'company_owner'
  | 'rh_manager'
  | 'manager'
  | 'cashier'
  | 'waiter'
  | 'member';

export interface AccessApprovalRecord {
  userId: number;
  companyId: number | null;
  nome: string;
  email: string;
  telefone: string;
  role: UrutauAccessRole;
  approvalStatus: ApprovalStatus;
  termsAccepted: boolean;
  termsVersion: string;
  termsAcceptedAtUtc: string;
  termsAcceptedIp: string;
  approvedByUid?: number | null;
  approvedAtUtc?: string | null;
  rejectionReason?: string;
}

const ALLOWED_NON_MASTER_ROLES = new Set<UrutauAccessRole>([
  'company_owner',
  'rh_manager',
  'manager',
  'cashier',
  'waiter',
  'member'
]);

const ALLOWED_OWNER_ASSIGNABLE_ROLES = new Set<UrutauAccessRole>([
  'rh_manager',
  'manager',
  'cashier',
  'waiter',
  'member'
]);

export function extractClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim().slice(0, 128);
  }
  if (Array.isArray(xff) && xff.length > 0 && xff[0]) {
    return String(xff[0]).split(',')[0].trim().slice(0, 128);
  }
  const xReal = req.headers['x-real-ip'];
  if (typeof xReal === 'string' && xReal.trim()) {
    return xReal.trim().slice(0, 128);
  }
  const direct = req.ip || req.socket?.remoteAddress || '127.0.0.1';
  return String(direct).trim().slice(0, 128);
}

export function normalizeApprovalStatus(raw: unknown): ApprovalStatus {
  const val = String(raw || '').trim().toLowerCase();
  if (val === 'pending_approval') return 'pending_approval';
  if (val === 'rejected') return 'rejected';
  return 'approved';
}

export function isUserQuarantined(user: any): boolean {
  if (!user) return false;
  if (isSuperAdminRecord(user)) return false;
  const status = normalizeApprovalStatus(user.approval_status);
  return status === 'pending_approval' || status === 'rejected';
}

export function isSuperAdminRecord(user: any): boolean {
  if (!user) return false;
  return (
    Number(user.id) === 1 &&
    String(user.tipo || '').trim().toLowerCase() === 'super admin'
  );
}

export function isCompanyOwnerRecord(user: any): boolean {
  if (!user || isSuperAdminRecord(user)) return false;
  const role = String(user.role || '').trim().toLowerCase();
  const tipo = String(user.tipo || '').trim().toLowerCase();
  const cargo = String(user.cargo || '').trim().toLowerCase();
  return (
    role === 'company_owner' ||
    tipo.includes('gestor') ||
    tipo.includes('propriet') ||
    cargo.includes('empres') ||
    cargo.includes('propriet') ||
    cargo.includes('diretor')
  );
}

export function buildRoleProfile(roleInput: string): {
  role: UrutauAccessRole;
  tipo: string;
  cargo: string;
  permissoes_json: any;
} {
  const clean = String(roleInput || 'member').trim().toLowerCase() as UrutauAccessRole;
  switch (clean) {
    case 'company_owner':
      return {
        role: 'company_owner',
        tipo: 'Gestor da Empresa',
        cargo: 'Proprietário / Gestor da Empresa',
        permissoes_json: {
          total: false,
          gerenciar_subordinados: true,
          mudar_aparencia: true,
          escopo_colaboradores: 'subordinados',
          modulos: {
            home: { ver: true, editar: true },
            quadro_branco: { ver: true, editar: true },
            aprovacoes: { ver: true, editar: true },
            pdv: { ver: true, editar: true },
            caixa: { ver: true, editar: true },
            reservas: { ver: true, editar: true },
            escalas: { ver: true, editar: true },
            agenda: { ver: true, editar: true },
            estoque: { ver: true, editar: true },
            cmv: { ver: true, editar: true },
            rh: { ver: true, editar: true },
            equipe: { ver: true, editar: true },
            cadastros: { ver: true, editar: true },
            cargos: { ver: true, editar: true },
            chat: { ver: true, editar: true },
            portais: { ver: true, editar: true },
            unidades: { ver: true, editar: true },
            setores: { ver: true, editar: true },
            checklists: { ver: true, editar: true },
            config: { ver: true, editar: true }
          }
        }
      };
    case 'rh_manager':
      return {
        role: 'rh_manager',
        tipo: 'Colaborador',
        cargo: 'Gerente de RH',
        permissoes_json: {
          total: false,
          gerenciar_subordinados: true,
          escopo_colaboradores: 'subordinados',
          modulos: {
            home: { ver: true, editar: true },
            quadro_branco: { ver: true, editar: true },
            rh: { ver: true, editar: true },
            equipe: { ver: true, editar: true },
            cadastros: { ver: true, editar: true },
            cargos: { ver: true, editar: true },
            escalas: { ver: true, editar: true },
            agenda: { ver: true, editar: true },
            checklists: { ver: true, editar: true },
            pdv: { ver: false, editar: false },
            caixa: { ver: false, editar: false }
          }
        }
      };
    case 'manager':
      return {
        role: 'manager',
        tipo: 'Colaborador',
        cargo: 'Gerente Operacional',
        permissoes_json: {
          total: false,
          gerenciar_subordinados: true,
          escopo_colaboradores: 'subordinados',
          modulos: {
            home: { ver: true, editar: true },
            quadro_branco: { ver: true, editar: true },
            pdv: { ver: true, editar: true },
            caixa: { ver: true, editar: true },
            reservas: { ver: true, editar: true },
            escalas: { ver: true, editar: true },
            estoque: { ver: true, editar: true },
            checklists: { ver: true, editar: true },
            chat: { ver: true, editar: true }
          }
        }
      };
    case 'cashier':
      return {
        role: 'cashier',
        tipo: 'Colaborador',
        cargo: 'Operador de Caixa',
        permissoes_json: {
          total: false,
          gerenciar_subordinados: false,
          modulos: {
            home: { ver: true, editar: false },
            quadro_branco: { ver: true, editar: true },
            pdv: { ver: true, editar: true },
            caixa: { ver: true, editar: true },
            reservas: { ver: true, editar: false },
            rh: { ver: false, editar: false },
            config: { ver: false, editar: false }
          }
        }
      };
    case 'waiter':
      return {
        role: 'waiter',
        tipo: 'Colaborador',
        cargo: 'Garçom / Atendimento',
        permissoes_json: {
          total: false,
          gerenciar_subordinados: false,
          modulos: {
            home: { ver: true, editar: false },
            quadro_branco: { ver: true, editar: true },
            pdv: { ver: true, editar: true },
            reservas: { ver: true, editar: true },
            escalas: { ver: true, editar: false },
            checklists: { ver: true, editar: true },
            caixa: { ver: false, editar: false },
            rh: { ver: false, editar: false },
            config: { ver: false, editar: false }
          }
        }
      };
    default:
      return {
        role: 'member',
        tipo: 'Colaborador',
        cargo: 'Colaborador',
        permissoes_json: {
          total: false,
          gerenciar_subordinados: false,
          modulos: {
            home: { ver: true, editar: false },
            quadro_branco: { ver: true, editar: true },
            escalas: { ver: true, editar: false },
            agenda: { ver: true, editar: false },
            checklists: { ver: true, editar: true }
          }
        }
      };
  }
}

let tableEnsured = false;

async function ensureApprovalsTable(engine: PostgresEngineHandle): Promise<void> {
  if (tableEnsured || !engine.isConfigured()) return;
  try {
    await engine.query(`
      CREATE TABLE IF NOT EXISTS user_access_approvals (
        user_id INTEGER PRIMARY KEY,
        company_id INTEGER,
        nome TEXT NOT NULL,
        email TEXT DEFAULT '',
        telefone TEXT DEFAULT '',
        role TEXT NOT NULL DEFAULT 'member',
        approval_status TEXT NOT NULL DEFAULT 'pending_approval',
        terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,
        terms_version TEXT NOT NULL DEFAULT 'LGPD-TERMOS-2026.1',
        terms_accepted_at_utc TIMESTAMPTZ,
        terms_accepted_ip TEXT DEFAULT '',
        approved_by_uid INTEGER,
        approved_at_utc TIMESTAMPTZ,
        rejection_reason TEXT DEFAULT '',
        created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    tableEnsured = true;
  } catch {}
}

export async function syncAccessApprovalRecordToPostgres(
  record: AccessApprovalRecord,
  engine: PostgresEngineHandle = getPostgresEngine()
): Promise<void> {
  if (!engine.isConfigured()) return;
  try {
    await ensureApprovalsTable(engine);
    await engine.query(
      `
        INSERT INTO user_access_approvals (
          user_id, company_id, nome, email, telefone, role, approval_status,
          terms_accepted, terms_version, terms_accepted_at_utc, terms_accepted_ip,
          approved_by_uid, approved_at_utc, rejection_reason, updated_at_utc
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10::timestamptz, $11,
          $12, $13::timestamptz, $14, NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          company_id = EXCLUDED.company_id,
          nome = EXCLUDED.nome,
          email = EXCLUDED.email,
          telefone = EXCLUDED.telefone,
          role = EXCLUDED.role,
          approval_status = EXCLUDED.approval_status,
          terms_accepted = EXCLUDED.terms_accepted,
          terms_version = EXCLUDED.terms_version,
          terms_accepted_at_utc = COALESCE(EXCLUDED.terms_accepted_at_utc, user_access_approvals.terms_accepted_at_utc),
          terms_accepted_ip = COALESCE(NULLIF(EXCLUDED.terms_accepted_ip, ''), user_access_approvals.terms_accepted_ip),
          approved_by_uid = EXCLUDED.approved_by_uid,
          approved_at_utc = EXCLUDED.approved_at_utc,
          rejection_reason = EXCLUDED.rejection_reason,
          updated_at_utc = NOW()
      `,
      [
        record.userId,
        record.companyId,
        record.nome,
        record.email,
        record.telefone,
        record.role,
        record.approvalStatus,
        record.termsAccepted,
        record.termsVersion,
        record.termsAcceptedAtUtc || null,
        record.termsAcceptedIp || '',
        record.approvedByUid ?? null,
        record.approvedAtUtc ?? null,
        record.rejectionReason || ''
      ]
    );
  } catch {}
}

function sanitizeUserRecord(user: any): any {
  const copy = { ...user };
  delete copy.senha_argon2id;
  return {
    ...copy,
    approval_status: normalizeApprovalStatus(user.approval_status),
    role:
      user.role ||
      (isSuperAdminRecord(user)
        ? 'admin_master'
        : isCompanyOwnerRecord(user)
          ? 'company_owner'
          : 'member')
  };
}

function getNextNumericId(items: any[]): number {
  if (!Array.isArray(items) || items.length === 0) return 1;
  return items.reduce((max, item) => Math.max(max, Number(item?.id) || 0), 0) + 1;
}

export function registerAccessApprovalRoutes(params: {
  app: Express;
  getLegacyDb: () => any;
  saveLegacyDb: () => void;
  hashPassword: (plain: string) => Promise<string>;
  registerAuditLog: (
    usuario: string,
    acao: string,
    detalhes: string,
    ip?: string,
    cargo?: string
  ) => Promise<unknown>;
}): void {
  const { app, getLegacyDb, saveLegacyDb, hashPassword, registerAuditLog } = params;

  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const nome = String(body.nome || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const telefone = String(body.telefone || body.whatsapp || '').trim();
      const senha = String(body.senha || '').trim();
      const termsAccepted = Boolean(body.termsAccepted ?? body.terms_accepted ?? body.termo_uso_aceito);
      const requestedCompanyId = Number(body.companyId ?? body.company_id ?? body.empresa_id ?? 0);

      if (!nome || nome.length < 2) {
        res.status(400).json({ ok: false, erro: 'Informe seu nome completo.' });
        return;
      }
      if (!email && telefone.replace(/\D/g, '').length < 8) {
        res.status(400).json({ ok: false, erro: 'Informe um e-mail ou WhatsApp válido.' });
        return;
      }
      if (!senha || senha.length < 4) {
        res.status(400).json({ ok: false, erro: 'A senha deve possuir ao menos 4 caracteres.' });
        return;
      }
      if (!termsAccepted) {
        res.status(400).json({
          ok: false,
          codigo: 'LGPD_TERMS_REQUIRED',
          erro: 'É obrigatório aceitar os Termos de Uso e a Política de Privacidade (LGPD) para concluir o cadastro.'
        });
        return;
      }

      const db = getLegacyDb();
      if (!Array.isArray(db.usuarios)) db.usuarios = [];

      const duplicate = db.usuarios.find((u: any) => {
        if (u.arquivado_legal) return false;
        const uEmail = String(u.email || '').trim().toLowerCase();
        const uTel = String(u.telefone || '').replace(/\D/g, '');
        const cleanTel = telefone.replace(/\D/g, '');
        if (email && uEmail && uEmail === email) return true;
        if (cleanTel.length >= 8 && uTel && uTel === cleanTel) return true;
        return false;
      });

      if (duplicate) {
        res.status(409).json({
          ok: false,
          erro: 'Já existe uma conta cadastrada com este e-mail ou WhatsApp.'
        });
        return;
      }

      const validCompanyId =
        Number.isInteger(requestedCompanyId) &&
        requestedCompanyId > 0 &&
        Array.isArray(db.empresas) &&
        db.empresas.some((e: any) => !e.arquivado_legal && Number(e.id) === requestedCompanyId)
          ? requestedCompanyId
          : null;

      const acceptedAtUtc = new Date().toISOString();
      const acceptedIp = extractClientIp(req);
      const passwordHash = await hashPassword(senha);
      const roleProfile = buildRoleProfile('member');
      const userId = getNextNumericId(db.usuarios);

      const newUser = {
        id: userId,
        nome,
        email,
        telefone,
        tipo: roleProfile.tipo,
        cargo: roleProfile.cargo,
        role: roleProfile.role,
        approval_status: 'pending_approval' as ApprovalStatus,
        terms_accepted: true,
        terms_version: 'LGPD-TERMOS-2026.1',
        terms_accepted_at_utc: acceptedAtUtc,
        terms_accepted_ip: acceptedIp,
        foto: '',
        empresas_ids: validCompanyId ? [validCompanyId] : [],
        escala_fixa_json: JSON.stringify([1, 2, 3, 4, 5]),
        senha_argon2id: passwordHash,
        permissoes_json: roleProfile.permissoes_json,
        arquivado_legal: false,
        criado_em: acceptedAtUtc
      };

      db.usuarios.push(newUser);
      saveLegacyDb();

      await syncAccessApprovalRecordToPostgres({
        userId,
        companyId: validCompanyId,
        nome,
        email,
        telefone,
        role: 'member',
        approvalStatus: 'pending_approval',
        termsAccepted: true,
        termsVersion: 'LGPD-TERMOS-2026.1',
        termsAcceptedAtUtc: acceptedAtUtc,
        termsAcceptedIp: acceptedIp
      });

      await registerAuditLog(
        nome,
        'CADASTRO_QUARENTENA_LGPD',
        `Novo cadastro criado em quarentena (pending_approval). Termos LGPD aceitos em ${acceptedAtUtc} via IP ${acceptedIp}.`,
        acceptedIp,
        'Aguardando Aprovação'
      );

      res.status(201).json({
        ok: true,
        pending_approval: true,
        approval_status: 'pending_approval',
        sessao_token: null,
        usuario: sanitizeUserRecord(newUser),
        mensagem: 'Cadastro recebido com sucesso. Aguardando aprovação do Administrador.'
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, erro: err?.message || 'Erro ao processar cadastro.' });
    }
  });

  app.get('/api/access/pending', (req: Request, res: Response) => {
    const sessao = (req as any).urutauAuthSession as AuthenticatedOperatorContext | undefined;
    if (!sessao) {
      res.status(401).json({ ok: false, erro: 'Sessão não autenticada.' });
      return;
    }

    const db = getLegacyDb();
    const usuarios: any[] = Array.isArray(db.usuarios) ? db.usuarios.filter((u: any) => !u.arquivado_legal) : [];
    const empresas: any[] = Array.isArray(db.empresas) ? db.empresas.filter((e: any) => !e.arquivado_legal) : [];
    const operatorRecord = usuarios.find((u: any) => Number(u.id) === Number(sessao.uid));
    const isMaster = Boolean(sessao.super);
    const isOwner = !isMaster && isCompanyOwnerRecord(operatorRecord);

    if (!isMaster && !isOwner) {
      res.status(403).json({
        ok: false,
        codigo: 'PRIVILEGIO_INSUFICIENTE',
        erro: 'Apenas o Admin Master ou o Proprietário da Empresa podem gerenciar aprovações de acesso.'
      });
      return;
    }

    const allowedCompanyIds = new Set<number>(
      isMaster
        ? empresas.map((e: any) => Number(e.id))
        : [...(sessao.emps || []), Number(sessao.emp)].filter((n) => Number.isInteger(n) && n > 0)
    );

    const visibleUsers = usuarios
      .filter((u: any) => {
        if (isMaster) return true;
        if (isSuperAdminRecord(u)) return false;
        const userCompanyIds: number[] = Array.isArray(u.empresas_ids)
          ? u.empresas_ids.map(Number).filter((n: number) => Number.isInteger(n) && n > 0)
          : [];
        return userCompanyIds.some((cid) => allowedCompanyIds.has(cid));
      })
      .map(sanitizeUserRecord);

    const visibleCompanies = empresas
      .filter((e: any) => isMaster || allowedCompanyIds.has(Number(e.id)))
      .map((e: any) => ({
        id: Number(e.id),
        nome: String(e.nome || `Empresa #${e.id}`),
        subdominio: String(e.subdominio || '')
      }));

    res.json({
      ok: true,
      scope: isMaster ? 'admin_master' : 'company_owner',
      pendingUsers: visibleUsers.filter((u) => u.approval_status === 'pending_approval'),
      activeUsers: visibleUsers.filter((u) => u.approval_status === 'approved'),
      rejectedUsers: visibleUsers.filter((u) => u.approval_status === 'rejected'),
      companies: visibleCompanies
    });
  });

  app.post('/api/access/approve', async (req: Request, res: Response) => {
    try {
      const sessao = (req as any).urutauAuthSession as AuthenticatedOperatorContext | undefined;
      if (!sessao) {
        res.status(401).json({ ok: false, erro: 'Sessão não autenticada.' });
        return;
      }

      const body = req.body || {};
      const targetUserId = Number(body.userId ?? body.user_id);
      const targetCompanyId = Number(body.companyId ?? body.company_id ?? body.empresa_id ?? 0);
      const requestedRole = String(body.role || 'member').trim().toLowerCase() as UrutauAccessRole;

      if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
        res.status(400).json({ ok: false, erro: 'Informe um usuário válido para aprovação.' });
        return;
      }
      if (!Number.isInteger(targetCompanyId) || targetCompanyId <= 0) {
        res.status(400).json({ ok: false, erro: 'Vincule o usuário a uma empresa válida antes de aprovar.' });
        return;
      }

      const db = getLegacyDb();
      const usuarios: any[] = Array.isArray(db.usuarios) ? db.usuarios : [];
      const empresas: any[] = Array.isArray(db.empresas) ? db.empresas : [];
      const operatorRecord = usuarios.find((u: any) => Number(u.id) === Number(sessao.uid));
      const isMaster = Boolean(sessao.super);
      const isOwner = !isMaster && isCompanyOwnerRecord(operatorRecord);

      if (!isMaster && !isOwner) {
        res.status(403).json({
          ok: false,
          codigo: 'PRIVILEGIO_INSUFICIENTE',
          erro: 'Você não tem permissão para aprovar usuários.'
        });
        return;
      }

      const companyExists = empresas.some(
        (e: any) => !e.arquivado_legal && Number(e.id) === targetCompanyId
      );
      if (!companyExists) {
        res.status(404).json({ ok: false, erro: `Empresa #${targetCompanyId} não encontrada.` });
        return;
      }

      const targetUser = usuarios.find(
        (u: any) => !u.arquivado_legal && Number(u.id) === targetUserId
      );
      if (!targetUser) {
        res.status(404).json({ ok: false, erro: 'Usuário solicitado não encontrado.' });
        return;
      }

      if (isMaster) {
        if (!ALLOWED_NON_MASTER_ROLES.has(requestedRole)) {
          res.status(400).json({ ok: false, erro: `Role inválida: ${requestedRole}.` });
          return;
        }
      } else {
        const ownerCompanyIds = new Set<number>(
          [...(sessao.emps || []), Number(sessao.emp)].filter((n) => Number.isInteger(n) && n > 0)
        );
        if (!ownerCompanyIds.has(targetCompanyId)) {
          res.status(403).json({
            ok: false,
            codigo: 'TENANT_DELEGATION_VIOLATION',
            erro: 'Você só pode aprovar membros vinculados exclusivamente à sua própria empresa.'
          });
          return;
        }
        if (isSuperAdminRecord(targetUser)) {
          res.status(403).json({ ok: false, erro: 'Operação não permitida sobre o Admin Master.' });
          return;
        }
        const existingEmpIds: number[] = Array.isArray(targetUser.empresas_ids)
          ? targetUser.empresas_ids.map(Number).filter((n: number) => Number.isInteger(n) && n > 0)
          : [];
        if (existingEmpIds.length > 0 && !existingEmpIds.some((cid) => ownerCompanyIds.has(cid))) {
          res.status(403).json({
            ok: false,
            codigo: 'TENANT_DELEGATION_VIOLATION',
            erro: 'Este usuário pertence a outra empresa e não pode ser gerenciado por esta conta.'
          });
          return;
        }
        if (!ALLOWED_OWNER_ASSIGNABLE_ROLES.has(requestedRole)) {
          res.status(403).json({
            ok: false,
            erro: 'Proprietários podem atribuir apenas cargos operacionais da própria empresa (RH, Gerente, Caixa, Garçom ou Colaborador).'
          });
          return;
        }
      }

      const profile = buildRoleProfile(requestedRole);
      const approvedAtUtc = new Date().toISOString();

      targetUser.approval_status = 'approved';
      targetUser.role = profile.role;
      targetUser.tipo = profile.tipo;
      targetUser.cargo = String(body.cargo || '').trim() || profile.cargo;
      targetUser.permissoes_json = profile.permissoes_json;
      targetUser.empresas_ids = [targetCompanyId];
      targetUser.approved_by_uid = sessao.uid;
      targetUser.approved_at_utc = approvedAtUtc;
      targetUser.rejection_reason = '';

      saveLegacyDb();

      await syncAccessApprovalRecordToPostgres({
        userId: Number(targetUser.id),
        companyId: targetCompanyId,
        nome: String(targetUser.nome || ''),
        email: String(targetUser.email || ''),
        telefone: String(targetUser.telefone || ''),
        role: profile.role,
        approvalStatus: 'approved',
        termsAccepted: Boolean(targetUser.terms_accepted ?? true),
        termsVersion: String(targetUser.terms_version || 'LGPD-TERMOS-2026.1'),
        termsAcceptedAtUtc: String(targetUser.terms_accepted_at_utc || approvedAtUtc),
        termsAcceptedIp: String(targetUser.terms_accepted_ip || ''),
        approvedByUid: sessao.uid,
        approvedAtUtc
      });

      await registerAuditLog(
        sessao.nome,
        'ACESSO_APROVADO_ZERO_TRUST',
        `Usuário #${targetUser.id} (${targetUser.nome}) aprovado para Empresa #${targetCompanyId} com perfil ${profile.role}.`,
        extractClientIp(req),
        sessao.cargo
      );

      res.json({
        ok: true,
        usuario: sanitizeUserRecord(targetUser)
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, erro: err?.message || 'Erro ao aprovar usuário.' });
    }
  });

  app.post('/api/access/reject', async (req: Request, res: Response) => {
    try {
      const sessao = (req as any).urutauAuthSession as AuthenticatedOperatorContext | undefined;
      if (!sessao) {
        res.status(401).json({ ok: false, erro: 'Sessão não autenticada.' });
        return;
      }

      const targetUserId = Number(req.body?.userId ?? req.body?.user_id);
      const reason = String(req.body?.reason || req.body?.motivo || 'Solicitação recusada pelo administrador.').trim().slice(0, 300);

      if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
        res.status(400).json({ ok: false, erro: 'Informe um usuário válido.' });
        return;
      }

      const db = getLegacyDb();
      const usuarios: any[] = Array.isArray(db.usuarios) ? db.usuarios : [];
      const operatorRecord = usuarios.find((u: any) => Number(u.id) === Number(sessao.uid));
      const isMaster = Boolean(sessao.super);
      const isOwner = !isMaster && isCompanyOwnerRecord(operatorRecord);

      if (!isMaster && !isOwner) {
        res.status(403).json({ ok: false, erro: 'Sem permissão para recusar acessos.' });
        return;
      }

      const targetUser = usuarios.find((u: any) => !u.arquivado_legal && Number(u.id) === targetUserId);
      if (!targetUser || isSuperAdminRecord(targetUser)) {
        res.status(404).json({ ok: false, erro: 'Usuário não encontrado.' });
        return;
      }

      if (!isMaster) {
        const ownerCompanyIds = new Set<number>(
          [...(sessao.emps || []), Number(sessao.emp)].filter((n) => Number.isInteger(n) && n > 0)
        );
        const targetCompanies: number[] = Array.isArray(targetUser.empresas_ids)
          ? targetUser.empresas_ids.map(Number)
          : [];
        if (!targetCompanies.some((cid) => ownerCompanyIds.has(cid))) {
          res.status(403).json({
            ok: false,
            codigo: 'TENANT_DELEGATION_VIOLATION',
            erro: 'Você não pode recusar usuários de outras empresas.'
          });
          return;
        }
      }

      targetUser.approval_status = 'rejected';
      targetUser.rejection_reason = reason;
      saveLegacyDb();

      const primaryCompanyId =
        Array.isArray(targetUser.empresas_ids) && targetUser.empresas_ids.length > 0
          ? Number(targetUser.empresas_ids[0])
          : null;

      await syncAccessApprovalRecordToPostgres({
        userId: Number(targetUser.id),
        companyId: primaryCompanyId,
        nome: String(targetUser.nome || ''),
        email: String(targetUser.email || ''),
        telefone: String(targetUser.telefone || ''),
        role: (targetUser.role || 'member') as UrutauAccessRole,
        approvalStatus: 'rejected',
        termsAccepted: Boolean(targetUser.terms_accepted),
        termsVersion: String(targetUser.terms_version || 'LGPD-TERMOS-2026.1'),
        termsAcceptedAtUtc: String(targetUser.terms_accepted_at_utc || new Date().toISOString()),
        termsAcceptedIp: String(targetUser.terms_accepted_ip || ''),
        rejectionReason: reason
      });

      await registerAuditLog(
        sessao.nome,
        'ACESSO_RECUSADO_ZERO_TRUST',
        `Solicitação do usuário #${targetUser.id} (${targetUser.nome}) recusada. Motivo: ${reason}`,
        extractClientIp(req),
        sessao.cargo
      );

      res.json({ ok: true, usuario: sanitizeUserRecord(targetUser) });
    } catch (err: any) {
      res.status(500).json({ ok: false, erro: err?.message || 'Erro ao recusar acesso.' });
    }
  });

  app.post('/api/access/invite-member', async (req: Request, res: Response) => {
    try {
      const sessao = (req as any).urutauAuthSession as AuthenticatedOperatorContext | undefined;
      if (!sessao) {
        res.status(401).json({ ok: false, erro: 'Sessão não autenticada.' });
        return;
      }

      const body = req.body || {};
      const nome = String(body.nome || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const telefone = String(body.telefone || body.whatsapp || '').trim();
      const senha = String(body.senha || '').trim();
      const requestedRole = String(body.role || 'member').trim().toLowerCase() as UrutauAccessRole;
      const requestedCompanyId = Number(body.companyId ?? body.company_id ?? body.empresa_id ?? sessao.emp);

      if (!nome || nome.length < 2) {
        res.status(400).json({ ok: false, erro: 'Informe o nome completo do membro.' });
        return;
      }
      if (!senha || senha.length < 4) {
        res.status(400).json({ ok: false, erro: 'Informe uma senha inicial de no mínimo 4 caracteres.' });
        return;
      }

      const db = getLegacyDb();
      const usuarios: any[] = Array.isArray(db.usuarios) ? db.usuarios : [];
      const empresas: any[] = Array.isArray(db.empresas) ? db.empresas : [];
      const operatorRecord = usuarios.find((u: any) => Number(u.id) === Number(sessao.uid));
      const isMaster = Boolean(sessao.super);
      const isOwner = !isMaster && isCompanyOwnerRecord(operatorRecord);

      if (!isMaster && !isOwner) {
        res.status(403).json({
          ok: false,
          codigo: 'PRIVILEGIO_INSUFICIENTE',
          erro: 'Apenas Admin Master ou Proprietário da Empresa podem cadastrar membros.'
        });
        return;
      }

      if (!isMaster) {
        const ownerCompanyIds = new Set<number>(
          [...(sessao.emps || []), Number(sessao.emp)].filter((n) => Number.isInteger(n) && n > 0)
        );
        if (!ownerCompanyIds.has(requestedCompanyId)) {
          res.status(403).json({
            ok: false,
            codigo: 'TENANT_DELEGATION_VIOLATION',
            erro: 'Você só pode cadastrar membros exclusivamente para a sua própria empresa.'
          });
          return;
        }
        if (!ALLOWED_OWNER_ASSIGNABLE_ROLES.has(requestedRole)) {
          res.status(403).json({
            ok: false,
            erro: 'Cargo não permitido para delegação por Proprietário.'
          });
          return;
        }
      } else if (!ALLOWED_NON_MASTER_ROLES.has(requestedRole)) {
        res.status(400).json({ ok: false, erro: `Role inválida: ${requestedRole}.` });
        return;
      }

      const companyExists = empresas.some(
        (e: any) => !e.arquivado_legal && Number(e.id) === requestedCompanyId
      );
      if (!companyExists) {
        res.status(404).json({ ok: false, erro: `Empresa #${requestedCompanyId} não encontrada.` });
        return;
      }

      const nowUtc = new Date().toISOString();
      const operatorIp = extractClientIp(req);
      const profile = buildRoleProfile(requestedRole);
      const userId = getNextNumericId(usuarios);
      const passwordHash = await hashPassword(senha);

      const newMember = {
        id: userId,
        nome,
        email,
        telefone,
        tipo: profile.tipo,
        cargo: String(body.cargo || '').trim() || profile.cargo,
        role: profile.role,
        approval_status: 'approved' as ApprovalStatus,
        terms_accepted: true,
        terms_version: 'LGPD-DELEGADO-2026.1',
        terms_accepted_at_utc: nowUtc,
        terms_accepted_ip: operatorIp,
        approved_by_uid: sessao.uid,
        approved_at_utc: nowUtc,
        foto: '',
        empresas_ids: [requestedCompanyId],
        escala_fixa_json: JSON.stringify([1, 2, 3, 4, 5]),
        senha_argon2id: passwordHash,
        permissoes_json: profile.permissoes_json,
        arquivado_legal: false,
        criado_em: nowUtc
      };

      usuarios.push(newMember);
      saveLegacyDb();

      await syncAccessApprovalRecordToPostgres({
        userId,
        companyId: requestedCompanyId,
        nome,
        email,
        telefone,
        role: profile.role,
        approvalStatus: 'approved',
        termsAccepted: true,
        termsVersion: 'LGPD-DELEGADO-2026.1',
        termsAcceptedAtUtc: nowUtc,
        termsAcceptedIp: operatorIp,
        approvedByUid: sessao.uid,
        approvedAtUtc: nowUtc
      });

      await registerAuditLog(
        sessao.nome,
        'MEMBRO_CADASTRADO_DELEGACAO',
        `Membro "${nome}" (#${userId}) cadastrado e aprovado na Empresa #${requestedCompanyId} com cargo ${profile.role}.`,
        operatorIp,
        sessao.cargo
      );

      res.status(201).json({
        ok: true,
        usuario: sanitizeUserRecord(newMember)
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, erro: err?.message || 'Erro ao convidar membro.' });
    }
  });
}
