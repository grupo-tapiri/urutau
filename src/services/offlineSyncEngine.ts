import { ERPCompleteData } from '../types/erp';

export interface OfflineQueueItem {
  id: string;
  op_uuid?: string;
  url: string;
  method: string;
  body: any;
  modulo: string;
  resumo: string;
  operador: string;
  aparelho: string;
  createdAt: string;
  baseSnapshotAt: string;
  baseRecord?: any;
  serverRecord?: any;
  conflictFields?: {
    campo: string;
    label: string;
    valorLocal: string;
    valorServidor: string;
  }[];
  status: 'pendente' | 'conflito' | 'sincronizado' | 'erro';
  syncedAt?: string;
  errorMsg?: string;
}

export interface LanFailoverClientConfig {
  ipServidorLocal: string;
  portaServidorLocal: string;
  autoFailoverWifi: boolean;
  forcarModoLanWifi: boolean;
  vpsUrlPrincipal: string;
}

export type ActiveNetworkTier = 'vps_online' | 'wifi_lan_ativo' | 'offline_aparelho';

const SNAPSHOT_STORAGE_KEY = 'urutau_offline_snapshot_v1';
const SNAPSHOT_META_KEY = 'urutau_offline_snapshot_meta_v1';
const QUEUE_STORAGE_KEY = 'urutau_offline_queue_v1';
const OFFLINE_SIMULATION_KEY = 'urutau_force_offline_mode_v1';
const LAN_CONFIG_STORAGE_KEY = 'urutau_lan_failover_config_v1';

const FIELD_LABELS: Record<string, string> = {
  nome: 'Nome',
  descricao: 'Descrição',
  valor: 'Valor (R$)',
  tipo: 'Tipo',
  categoria: 'Categoria',
  quantidade: 'Quantidade em Estoque',
  estoque_atual: 'Quantidade Atual',
  estoque_minimo: 'Estoque Mínimo',
  preco_unitario: 'Preço Unitário (R$)',
  custo_unitario: 'Custo Unitário (R$)',
  cargo: 'Cargo / Função',
  telefone: 'WhatsApp / Telefone',
  status: 'Situação',
  observacoes: 'Observações',
  faturamento_bruto: 'Faturamento do Dia (R$)',
  porcentagem_rateio: 'Percentual de Rateio (%)',
  responsavel: 'Responsável',
  turno: 'Turno',
  horario: 'Horário',
  setor: 'Setor'
};

function isPrivateLanHostname(hostname: string): boolean {
  const h = String(hostname || '').trim().toLowerCase();
  if (!h) return false;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (h.endsWith('.local')) return true;
  return false;
}

function formatHumanValue(val: any): string {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'boolean') return val ? 'Sim' : 'Não';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  }
  return String(val);
}

function describeEndpoint(
  url: string,
  body: any
): { modulo: string; resumo: string; tableKey?: keyof ERPCompleteData } {
  const path = url.replace(/^https?:\/\/[^/]+/, '');
  if (path.includes('/api/pdv/comandas/pagar-fechar')) {
    const val = body?.valor_pagamento ? ` (R$ ${Number(body.valor_pagamento).toFixed(2)})` : '';
    return {
      modulo: 'PDV & Comandas',
      resumo: `Pagamento / Fechamento Comanda #${body?.comanda_id || ''}${val}`,
      tableKey: 'pdvComandas'
    };
  }
  if (path.includes('/api/pdv/comandas')) {
    const ident = body?.identificador || (body?.mesa_numero ? `Mesa ${body.mesa_numero}` : 'Pedido PDV');
    const qtdItens = Array.isArray(body?.novos_itens) ? ` (${body.novos_itens.length} item/ns)` : '';
    return {
      modulo: 'PDV & Comandas',
      resumo: `${ident}${qtdItens}`,
      tableKey: 'pdvComandas'
    };
  }
  if (path.includes('/api/pdv/produtos')) {
    return {
      modulo: 'Cardápio PDV',
      resumo: body?.nome ? `Produto: ${body.nome}` : 'Atualização de Cardápio PDV',
      tableKey: 'pdvProdutos'
    };
  }
  if (path.includes('/api/pdv/impressoras')) {
    return {
      modulo: 'Impressoras Térmicas',
      resumo: body?.nome || 'Disparo / Configuração de Impressora',
      tableKey: 'pdvImpressoras'
    };
  }
  if (path.includes('/caixa')) {
    const desc = body?.descricao || body?.categoria || 'Movimentação de Caixa';
    const val = body?.valor ? ` (R$ ${Number(body.valor).toFixed(2)})` : '';
    return { modulo: 'Caixa Diário', resumo: `${desc}${val}`, tableKey: 'caixa' };
  }
  if (path.includes('/estoque')) {
    const nome = body?.insumo || body?.nome || body?.item || 'Item de Estoque';
    const qtd = body?.quantidade ?? body?.estoque_atual;
    return {
      modulo: 'Estoque',
      resumo: `${nome}${qtd !== undefined ? ` — Qtd: ${qtd}` : ''}`,
      tableKey: 'estoque'
    };
  }
  if (path.includes('/rateio')) {
    const fat = body?.faturamento_bruto ? `R$ ${Number(body.faturamento_bruto).toFixed(2)}` : 'Fechamento';
    return { modulo: 'Rateio Diário', resumo: `Fechamento de Rateio (${fat})`, tableKey: 'rateiosHistorico' };
  }
  if (path.includes('/escalas')) {
    return {
      modulo: 'Escalas & Turnos',
      resumo: body?.colaborador_nome || body?.observacao || 'Atualização de Escala',
      tableKey: 'movimentosEscala'
    };
  }
  if (path.includes('/equipe') || path.includes('/usuarios')) {
    return {
      modulo: 'Equipe & Pessoal',
      resumo: body?.nome ? `Colaborador: ${body.nome}` : 'Atualização da Equipe',
      tableKey: 'usuarios'
    };
  }
  if (path.includes('/reservas')) {
    return {
      modulo: 'Reservas de Salão',
      resumo: body?.cliente_nome || body?.cliente ? `Reserva de ${body.cliente_nome || body.cliente}` : 'Registro de Reserva',
      tableKey: 'reservas'
    };
  }
  if (path.includes('/checklists')) {
    return {
      modulo: 'Checklists Operacionais',
      resumo: body?.titulo || 'Atualização de Checklist',
      tableKey: 'checklists'
    };
  }
  if (path.includes('/agenda')) {
    return {
      modulo: 'Agenda Operacional',
      resumo: body?.titulo || 'Compromisso na Agenda',
      tableKey: 'agenda'
    };
  }
  if (path.includes('/compras')) {
    return {
      modulo: 'Compras & Pedidos',
      resumo: body?.insumo || body?.fornecedor || 'Pedido de Compra',
      tableKey: 'estoque'
    };
  }
  if (path.includes('/config')) {
    return {
      modulo: 'Configurações',
      resumo: body?.chave || 'Ajuste de Segurança e Governança',
      tableKey: 'configs'
    };
  }
  return {
    modulo: 'Operação do Sistema',
    resumo: body?.nome || body?.descricao || body?.titulo || 'Registro Operacional'
  };
}

class OfflineSyncEngine {
  private listeners = new Set<() => void>();
  private originalFetch: typeof window.fetch | null = null;
  private isSyncing = false;
  private currentOperator = 'Operador Local';
  private activeTier: ActiveNetworkTier = 'vps_online';
  private lastLanLatencyMs: number | null = null;
  private lastLanError: string = '';
  private sessionToken: string = '';

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const savedSessionRaw = localStorage.getItem('urutau_active_user_session_v2');
        if (savedSessionRaw) {
          const parsedSession = JSON.parse(savedSessionRaw);
          if (typeof parsedSession?.sessaoToken === 'string' && parsedSession.sessaoToken.includes('.')) {
            this.sessionToken = parsedSession.sessaoToken.trim();
          }
        }
      } catch {}
      const hostAtual = window.location.hostname;
      if (isPrivateLanHostname(hostAtual)) {
        const currentCfg = this.getLanConfig();
        if (!currentCfg.ipServidorLocal) {
          this.saveLanConfig({
            ...currentCfg,
            ipServidorLocal: hostAtual,
            portaServidorLocal: window.location.port || '3000'
          });
        }
        this.activeTier = 'wifi_lan_ativo';
      }

      this.installFetchInterceptor();
      window.addEventListener('online', () => {
        if (!this.isForcedOffline() && !this.getLanConfig().forcarModoLanWifi) {
          this.probeAndReconcileVps();
        } else {
          this.notify();
        }
      });
      window.addEventListener('offline', () => {
        this.evaluateFallbackTierOnDrop();
      });

      window.setInterval(() => {
        if (this.activeTier === 'wifi_lan_ativo' && !this.getLanConfig().forcarModoLanWifi && !this.isForcedOffline()) {
          this.probeAndReconcileVps();
        }
      }, 25000);
    }
  }

  public getLanConfig(): LanFailoverClientConfig {
    const defaultVps =
      typeof window !== 'undefined' && !isPrivateLanHostname(window.location.hostname)
        ? window.location.origin
        : 'https://nyctibi.us';
    const fallback: LanFailoverClientConfig = {
      ipServidorLocal: '',
      portaServidorLocal: '3000',
      autoFailoverWifi: true,
      forcarModoLanWifi: false,
      vpsUrlPrincipal: defaultVps
    };
    try {
      const raw = localStorage.getItem(LAN_CONFIG_STORAGE_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return {
        ipServidorLocal: String(parsed.ipServidorLocal || '').trim(),
        portaServidorLocal: String(parsed.portaServidorLocal || '3000').replace(/\D/g, '') || '3000',
        autoFailoverWifi: parsed.autoFailoverWifi !== false,
        forcarModoLanWifi: Boolean(parsed.forcarModoLanWifi === true),
        vpsUrlPrincipal: String(parsed.vpsUrlPrincipal || defaultVps).trim()
      };
    } catch {
      return fallback;
    }
  }

  public saveLanConfig(next: Partial<LanFailoverClientConfig>): LanFailoverClientConfig {
    const merged: LanFailoverClientConfig = {
      ...this.getLanConfig(),
      ...next
    };
    merged.ipServidorLocal = String(merged.ipServidorLocal || '')
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/\/.*$/, '')
      .split(':')[0];
    merged.portaServidorLocal = String(merged.portaServidorLocal || '3000').replace(/\D/g, '') || '3000';

    try {
      localStorage.setItem(LAN_CONFIG_STORAGE_KEY, JSON.stringify(merged));
    } catch {}

    if (merged.forcarModoLanWifi && merged.ipServidorLocal) {
      this.setActiveTier('wifi_lan_ativo');
    } else if (!merged.forcarModoLanWifi && this.isEffectivelyOnline() && !isPrivateLanHostname(window.location.hostname)) {
      this.setActiveTier('vps_online');
    }
    this.notify();
    return merged;
  }

  public getLanServerBaseUrl(): string {
    const cfg = this.getLanConfig();
    if (!cfg.ipServidorLocal) return '';
    return `http://${cfg.ipServidorLocal}:${cfg.portaServidorLocal || '3000'}`;
  }

  public getActiveTier(): ActiveNetworkTier {
    if (typeof window !== 'undefined' && isPrivateLanHostname(window.location.hostname)) {
      return 'wifi_lan_ativo';
    }
    const cfg = this.getLanConfig();
    if (cfg.forcarModoLanWifi && cfg.ipServidorLocal) {
      return 'wifi_lan_ativo';
    }
    if (this.isForcedOffline() && !cfg.ipServidorLocal) {
      return 'offline_aparelho';
    }
    return this.activeTier;
  }

  private setActiveTier(tier: ActiveNetworkTier) {
    if (this.activeTier === tier) return;
    this.activeTier = tier;
    this.notify();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('urutau:tier-changed', {
          detail: {
            tier,
            apiBaseUrl: this.getActiveApiBaseUrl()
          }
        })
      );
    }
  }

  public getActiveApiBaseUrl(): string {
    const tier = this.getActiveTier();
    if (tier === 'wifi_lan_ativo') {
      if (typeof window !== 'undefined' && isPrivateLanHostname(window.location.hostname)) {
        return '';
      }
      return this.getLanServerBaseUrl();
    }
    return '';
  }

  public getLastLanDiagnostics(): { latencyMs: number | null; error: string; mixedContentBlocked: boolean } {
    const isHttpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const mixedContentBlocked = Boolean(isHttpsPage && this.lastLanError.includes('HTTPS'));
    return {
      latencyMs: this.lastLanLatencyMs,
      error: this.lastLanError,
      mixedContentBlocked
    };
  }

  public async testLanConnection(
    customIp?: string,
    customPort?: string
  ): Promise<{ ok: boolean; latencyMs: number; ipsLocais?: string[]; pendentesLan?: number; erro?: string }> {
    const nativeFetch = this.originalFetch || window.fetch.bind(window);
    const cfg = this.getLanConfig();
    const ip = String(customIp ?? cfg.ipServidorLocal ?? '')
      .trim()
      .replace(/^https?:\/\//i, '')
      .split(':')[0];
    const port = String(customPort ?? cfg.portaServidorLocal ?? '3000').replace(/\D/g, '') || '3000';

    if (!ip) {
      return { ok: false, latencyMs: 0, erro: 'Digite o IP fixo do servidor local do caixa (ex: 192.168.0.100).' };
    }

    const targetUrl = `http://${ip}:${port}/api/lan/ping`;
    const t0 = performance.now();
    try {
      const resp = await nativeFetch(targetUrl, {
        method: 'GET',
        headers: { 'X-Urutau-Lan-Origin': 'true' },
        signal: AbortSignal.timeout(3000)
      });
      const latencyMs = Math.max(1, Math.round(performance.now() - t0));
      if (!resp.ok) {
        this.lastLanError = `Servidor local respondeu HTTP ${resp.status}`;
        this.notify();
        return { ok: false, latencyMs, erro: this.lastLanError };
      }
      const data = await resp.json();
      this.lastLanLatencyMs = latencyMs;
      this.lastLanError = '';
      this.notify();
      return {
        ok: true,
        latencyMs,
        ipsLocais: data?.ips_locais || [ip],
        pendentesLan: Number(data?.pendentes_outbox_lan || 0)
      };
    } catch (e: any) {
      const latencyMs = Math.round(performance.now() - t0);
      const isHttpsOrigin = typeof window !== 'undefined' && window.location.protocol === 'https:';
      this.lastLanError = isHttpsOrigin
        ? `Navegador HTTPS bloqueou acesso direto a http://${ip}:${port} ou o IP está fora do mesmo Wi-Fi. Use o botão "Abrir Direto no IP do Wi-Fi" no celular.`
        : `Não foi possível alcançar http://${ip}:${port} no Wi-Fi (${e?.message || 'sem resposta'}). Confira se o PC do Caixa está ligado na mesma rede.`;
      this.notify();
      return { ok: false, latencyMs, erro: this.lastLanError };
    }
  }

  private async evaluateFallbackTierOnDrop() {
    const cfg = this.getLanConfig();
    if (cfg.autoFailoverWifi && cfg.ipServidorLocal) {
      const check = await this.testLanConnection(cfg.ipServidorLocal, cfg.portaServidorLocal);
      if (check.ok) {
        this.setActiveTier('wifi_lan_ativo');
        return;
      }
    }
    this.setActiveTier('offline_aparelho');
  }

  public async probeAndReconcileVps(): Promise<{ vpsOnline: boolean; reconciliados: number }> {
    const nativeFetch = this.originalFetch || window.fetch.bind(window);
    if (this.isForcedOffline() || this.getLanConfig().forcarModoLanWifi) {
      return { vpsOnline: false, reconciliados: 0 };
    }

    const cfg = this.getLanConfig();
    const isCurrentlyOnLanHost = typeof window !== 'undefined' && isPrivateLanHostname(window.location.hostname);
    const vpsTarget = isCurrentlyOnLanHost ? cfg.vpsUrlPrincipal.replace(/\/+$/, '') : '';

    try {
      const pingResp = await nativeFetch(`${vpsTarget}/api/lan/ping`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      if (!pingResp.ok) {
        return { vpsOnline: false, reconciliados: 0 };
      }

      let reconciliados = 0;
      const lanBase = isCurrentlyOnLanHost ? '' : this.getLanServerBaseUrl();
      if (lanBase || isCurrentlyOnLanHost) {
        try {
          const recHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-Urutau-Lan-Origin': 'true'
          };
          const activeToken = this.getSessionToken();
          if (activeToken) {
            recHeaders['X-Urutau-Session'] = activeToken;
          }
          const recResp = await nativeFetch(`${lanBase}/api/lan/reconciliar-lote`, {
            method: 'POST',
            credentials: 'include',
            headers: recHeaders,
            body: JSON.stringify({
              disparar_envio_para_vps: true,
              vps_url: cfg.vpsUrlPrincipal
            }),
            signal: AbortSignal.timeout(8000)
          });
          if (recResp.ok) {
            const recJson = await recResp.json();
            reconciliados += Number(recJson?.reconciliados || 0);
          }
        } catch {}
      }

      if (!isCurrentlyOnLanHost) {
        this.setActiveTier('vps_online');
      }
      const localSync = await this.syncPendingOperations();
      reconciliados += localSync.sincronizados;
      return { vpsOnline: true, reconciliados };
    } catch {
      return { vpsOnline: false, reconciliados: 0 };
    }
  }

  public setCurrentOperator(name: string) {
    if (name) this.currentOperator = name;
  }

  public setSessionToken(token: string | null | undefined) {
    this.sessionToken = typeof token === 'string' ? token.trim() : '';
  }

  public getSessionToken(): string {
    if (this.sessionToken) return this.sessionToken;
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('urutau_active_user_session_v2');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (typeof parsed?.sessaoToken === 'string' && parsed.sessaoToken.includes('.')) {
            this.sessionToken = parsed.sessaoToken.trim();
            return this.sessionToken;
          }
        }
      } catch {}
    }
    return '';
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
  }

  public isForcedOffline(): boolean {
    try {
      return localStorage.getItem(OFFLINE_SIMULATION_KEY) === 'true';
    } catch {
      return false;
    }
  }

  public setForcedOffline(val: boolean) {
    try {
      localStorage.setItem(OFFLINE_SIMULATION_KEY, val ? 'true' : 'false');
    } catch {}
    if (val) {
      this.evaluateFallbackTierOnDrop();
    } else {
      if (!isPrivateLanHostname(window.location.hostname) && !this.getLanConfig().forcarModoLanWifi) {
        this.setActiveTier('vps_online');
      }
      if (navigator.onLine) {
        this.probeAndReconcileVps();
      }
    }
    this.notify();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('urutau:offline-state', {
          detail: { isOffline: !this.isEffectivelyOnline() }
        })
      );
      window.dispatchEvent(new Event(val ? 'offline' : 'online'));
    }
  }

  public isEffectivelyOnline(): boolean {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine && !this.isForcedOffline();
  }

  public getSnapshotMeta(): { savedAt: string; totalRegistros: number } | null {
    try {
      const raw = localStorage.getItem(SNAPSHOT_META_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  public saveSnapshot(data: ERPCompleteData) {
    try {
      const savedAt = new Date().toISOString();
      localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(data));
      const totalRegistros =
        (data.usuarios?.length || 0) +
        (data.caixa?.length || 0) +
        (data.estoque?.length || 0) +
        (data.reservas?.length || 0) +
        (data.pdvComandas?.length || 0) +
        (data.pdvProdutos?.length || 0) +
        (data.checklists?.length || 0);
      localStorage.setItem(SNAPSHOT_META_KEY, JSON.stringify({ savedAt, totalRegistros }));
      this.notify();
    } catch {}
  }

  public getSnapshot(): ERPCompleteData | null {
    try {
      const raw = localStorage.getItem(SNAPSHOT_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  public getQueue(): OfflineQueueItem[] {
    try {
      const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveQueue(items: OfflineQueueItem[]) {
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(items));
    } catch {}
    this.notify();
  }

  private applyOptimisticToSnapshot(tableKey: keyof ERPCompleteData | undefined, body: any) {
    if (!tableKey || !body) return;
    const snap = this.getSnapshot();
    if (!snap) return;
    const list = (snap[tableKey] as any[]) || [];
    if (!Array.isArray(list)) return;

    if (tableKey === 'pdvComandas' && Array.isArray(body.novos_itens)) {
      const ident = String(body.identificador || `Mesa ${String(body.mesa_numero || '01').padStart(2, '0')}`);
      const existingIdx = list.findIndex(
        (c: any) =>
          (body.comanda_id && Number(c.id) === Number(body.comanda_id)) ||
          (c.status !== 'fechada' && String(c.identificador).toLowerCase() === ident.toLowerCase())
      );
      const novosItensFormatados = body.novos_itens.map((it: any, idx: number) => ({
        id: it.id || `off-it-${Date.now()}-${idx}`,
        produto_id: Number(it.produto_id || 0),
        nome: it.nome || 'Item PDV',
        categoria: it.categoria || 'Cardápio',
        quantidade: Number(it.quantidade || 1),
        preco_unitario: Number(it.preco_unitario || 0),
        subtotal: Number((Number(it.quantidade || 1) * Number(it.preco_unitario || 0)).toFixed(2)),
        observacao: it.observacao || '',
        setor_impressao: it.setor_impressao || 'cozinha',
        garcom_nome: body.garcom_nome || this.currentOperator,
        horario: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        impresso_setor: false,
        status_preparo: 'enviado'
      }));
      if (existingIdx >= 0) {
        const atual = { ...list[existingIdx] };
        atual.itens = [...(atual.itens || []), ...novosItensFormatados];
        const sub = atual.itens.reduce((s: number, x: any) => s + Number(x.subtotal || 0), 0);
        const gorj = atual.aplicar_gorjeta_10 ? Number((sub * 0.1).toFixed(2)) : 0;
        atual.subtotal_itens = Number(sub.toFixed(2));
        atual.valor_gorjeta = gorj;
        atual.valor_total = Number((sub + gorj + Number(atual.taxa_entrega || 0) - Number(atual.desconto || 0)).toFixed(2));
        atual.saldo_restante = Math.max(0, Number((atual.valor_total - Number(atual.valor_pago_acumulado || 0)).toFixed(2)));
        list[existingIdx] = atual;
      } else {
        const sub = novosItensFormatados.reduce((s: number, x: any) => s + Number(x.subtotal || 0), 0);
        const aplicar10 = body.aplicar_gorjeta_10 !== false;
        const gorj = aplicar10 ? Number((sub * 0.1).toFixed(2)) : 0;
        const taxa = Number(body.taxa_entrega || 0);
        const tot = Number((sub + gorj + taxa).toFixed(2));
        list.unshift({
          id: Date.now(),
          op_uuid: body.op_uuid || `OFF-${Date.now()}`,
          data: new Date().toISOString().split('T')[0],
          modalidade: body.modalidade || 'mesa',
          identificador: ident,
          mesa_numero: body.mesa_numero || '01',
          cliente_nome: body.cliente_nome || '',
          cliente_telefone: body.cliente_telefone || '',
          endereco_entrega: body.endereco_entrega || '',
          entregador_nome: body.entregador_nome || '',
          taxa_entrega: taxa,
          garcom_nome: body.garcom_nome || this.currentOperator,
          pessoas_mesa: Number(body.pessoas_mesa || 1),
          itens: novosItensFormatados,
          pagamentos: [],
          aplicar_gorjeta_10: aplicar10,
          percentual_gorjeta: 10,
          desconto: 0,
          subtotal_itens: sub,
          valor_gorjeta: gorj,
          valor_total: tot,
          valor_pago_acumulado: 0,
          saldo_restante: tot,
          status: 'aberta',
          unidade_id: Number(body.unidade_id || 1),
          criado_em: new Date().toISOString(),
          _offlinePending: true
        });
      }
      (snap as any)[tableKey] = list;
      this.saveSnapshot(snap);
      return;
    }

    if (body.id) {
      const idx = list.findIndex((r) => Number(r.id) === Number(body.id));
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...body, _offlinePending: true };
      } else {
        list.unshift({ ...body, _offlinePending: true });
      }
    } else {
      const tempId = Date.now();
      list.unshift({ id: tempId, ...body, criado_em: new Date().toISOString(), _offlinePending: true });
    }
    (snap as any)[tableKey] = list;
    this.saveSnapshot(snap);
  }

  private enqueueOfflineRequest(url: string, method: string, body: any): OfflineQueueItem {
    const opUuid = body?.op_uuid || `OP-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const bodyWithUuid = { ...(body || {}), op_uuid: opUuid };
    const { modulo, resumo, tableKey } = describeEndpoint(url, bodyWithUuid);
    const snap = this.getSnapshot();
    const meta = this.getSnapshotMeta();

    let baseRecord: any = undefined;
    if (tableKey && snap && Array.isArray(snap[tableKey])) {
      const arr = snap[tableKey] as any[];
      if (bodyWithUuid?.id) {
        baseRecord = arr.find((r) => Number(r.id) === Number(bodyWithUuid.id));
      } else if (bodyWithUuid?.insumo || bodyWithUuid?.nome || bodyWithUuid?.descricao) {
        baseRecord = arr.find(
          (r) =>
            (bodyWithUuid.insumo && r.insumo === bodyWithUuid.insumo) ||
            (bodyWithUuid.nome && r.nome === bodyWithUuid.nome) ||
            (bodyWithUuid.descricao && r.descricao === bodyWithUuid.descricao)
        );
      }
    }

    const isMobile = /iphone|ipad|ipod|android/i.test(navigator.userAgent);
    const cleanRelativeUrl = url.replace(/^https?:\/\/[^/]+/, '');
    const item: OfflineQueueItem = {
      id: `off-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      op_uuid: opUuid,
      url: cleanRelativeUrl,
      method,
      body: bodyWithUuid,
      modulo,
      resumo,
      operador: this.currentOperator,
      aparelho: isMobile ? 'Celular (Fila Offline Local)' : 'Computador PC (Modo Offline)',
      createdAt: new Date().toISOString(),
      baseSnapshotAt: meta?.savedAt || new Date().toISOString(),
      baseRecord,
      status: 'pendente'
    };

    const queue = this.getQueue();
    queue.unshift(item);
    this.saveQueue(queue);
    this.applyOptimisticToSnapshot(tableKey, bodyWithUuid);
    return item;
  }

  private computeConflicts(localBody: any, baseRecord: any, serverRecord: any) {
    const conflicts: {
      campo: string;
      label: string;
      valorLocal: string;
      valorServidor: string;
    }[] = [];

    if (!localBody || !serverRecord) return conflicts;

    const ignoredKeys = new Set([
      'id',
      'op_uuid',
      'criado_em',
      'atualizado_em',
      'senha_hash',
      'hash_argon2',
      'permissoes_json',
      '_offlinePending'
    ]);

    const keys = new Set([...Object.keys(localBody), ...Object.keys(serverRecord)]);

    keys.forEach((key) => {
      if (ignoredKeys.has(key)) return;
      if (localBody[key] === undefined) return;

      const localVal = formatHumanValue(localBody[key]);
      const serverVal = formatHumanValue(serverRecord[key]);
      const baseVal = baseRecord ? formatHumanValue(baseRecord[key]) : undefined;

      if (localVal !== serverVal && (!baseRecord || serverVal !== baseVal)) {
        conflicts.push({
          campo: key,
          label: FIELD_LABELS[key] || key.replace(/_/g, ' ').toUpperCase(),
          valorLocal: localVal,
          valorServidor: serverVal
        });
      }
    });

    return conflicts;
  }

  public async syncPendingOperations(): Promise<{
    sincronizados: number;
    conflitos: number;
  }> {
    const targetBase = this.getActiveApiBaseUrl();
    const canSyncToTarget = this.isEffectivelyOnline() || Boolean(targetBase);
    if (this.isSyncing || !canSyncToTarget || !this.originalFetch) {
      return { sincronizados: 0, conflitos: 0 };
    }

    const queue = this.getQueue();
    const pendentes = queue.filter((q) => q.status === 'pendente');
    if (pendentes.length === 0) {
      return { sincronizados: 0, conflitos: 0 };
    }

    this.isSyncing = true;
    this.notify();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('urutau:offline-sync', { detail: { syncing: true } }));
    }

    let sincronizados = 0;
    let conflitos = 0;

    try {
      let liveServerData: ERPCompleteData | null = null;
      try {
        const snapHeaders: Record<string, string> = {};
        if (targetBase) snapHeaders['X-Urutau-Lan-Origin'] = 'true';
        const activeToken = this.getSessionToken();
        if (activeToken) snapHeaders['X-Urutau-Session'] = activeToken;
        const res = await this.originalFetch(`${targetBase}/api/erp/dados-completos`, {
          credentials: 'include',
          headers: Object.keys(snapHeaders).length > 0 ? snapHeaders : undefined
        });
        if (res.ok) {
          liveServerData = await res.json();
        }
      } catch {}

      const updatedQueue = [...queue];

      for (let i = 0; i < updatedQueue.length; i++) {
        const item = updatedQueue[i];
        if (item.status !== 'pendente') continue;

        const { tableKey } = describeEndpoint(item.url, item.body);
        let serverRecord: any = null;

        if (liveServerData && tableKey && tableKey !== 'pdvComandas' && Array.isArray(liveServerData[tableKey])) {
          const serverList = liveServerData[tableKey] as any[];
          if (item.body?.id) {
            serverRecord = serverList.find((r) => Number(r.id) === Number(item.body.id));
          } else if (item.body?.insumo || item.body?.nome || item.body?.descricao) {
            serverRecord = serverList.find(
              (r) =>
                (item.body.insumo && r.insumo === item.body.insumo) ||
                (item.body.nome && r.nome === item.body.nome) ||
                (item.body.descricao && r.descricao === item.body.descricao)
            );
          }
        }

        if (serverRecord && item.baseRecord) {
          const diffFields = this.computeConflicts(item.body, item.baseRecord, serverRecord);
          if (diffFields.length > 0) {
            updatedQueue[i] = {
              ...item,
              status: 'conflito',
              serverRecord,
              conflictFields: diffFields
            };
            conflitos++;
            continue;
          }
        }

        try {
          const cleanPath = item.url.replace(/^https?:\/\/[^/]+/, '');
          const activeToken = this.getSessionToken();
          const resp = await this.originalFetch(`${targetBase}${cleanPath}`, {
            method: item.method,
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              ...(targetBase ? { 'X-Urutau-Lan-Origin': 'true' } : {}),
              ...(activeToken ? { 'X-Urutau-Session': activeToken } : {})
            },
            body: JSON.stringify(item.body)
          });
          if (resp.ok) {
            updatedQueue[i] = {
              ...item,
              status: 'sincronizado',
              syncedAt: new Date().toISOString()
            };
            sincronizados++;
          } else {
            updatedQueue[i] = {
              ...item,
              status: 'erro',
              errorMsg: 'O servidor recusou este formato de dados.'
            };
          }
        } catch {}
      }

      this.saveQueue(updatedQueue);
    } finally {
      this.isSyncing = false;
      this.notify();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('urutau:offline-sync', { detail: { syncing: false, sincronizados, conflitos } })
        );
      }
    }

    return { sincronizados, conflitos };
  }

  public async resolveConflictKeepLocal(itemId: string): Promise<boolean> {
    if (!this.originalFetch) return false;
    const queue = this.getQueue();
    const idx = queue.findIndex((q) => q.id === itemId);
    if (idx < 0) return false;

    const item = queue[idx];
    const targetBase = this.getActiveApiBaseUrl();
    try {
      const activeToken = this.getSessionToken();
      const resp = await this.originalFetch(`${targetBase}${item.url}`, {
        method: item.method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { 'X-Urutau-Session': activeToken } : {})
        },
        body: JSON.stringify(item.body)
      });
      if (resp.ok) {
        queue[idx] = {
          ...item,
          status: 'sincronizado',
          syncedAt: new Date().toISOString(),
          conflictFields: undefined
        };
        this.saveQueue(queue);
        return true;
      }
    } catch {}
    return false;
  }

  public resolveConflictKeepServer(itemId: string): boolean {
    const queue = this.getQueue();
    const idx = queue.findIndex((q) => q.id === itemId);
    if (idx < 0) return false;

    queue[idx] = {
      ...queue[idx],
      status: 'sincronizado',
      syncedAt: new Date().toISOString(),
      resumo: `${queue[idx].resumo} (Mantida versão do outro aparelho)`,
      conflictFields: undefined
    };
    this.saveQueue(queue);
    return true;
  }

  public async resolveConflictKeepBoth(itemId: string): Promise<boolean> {
    if (!this.originalFetch) return false;
    const queue = this.getQueue();
    const idx = queue.findIndex((q) => q.id === itemId);
    if (idx < 0) return false;

    const item = queue[idx];
    const clonedBody = { ...item.body };
    delete clonedBody.id;
    if (clonedBody.descricao) {
      clonedBody.descricao = `${clonedBody.descricao} (Registro Complementar Sincronizado)`;
    } else if (clonedBody.insumo) {
      clonedBody.insumo = `${clonedBody.insumo} (Lote Complementar)`;
    }

    const targetBase = this.getActiveApiBaseUrl();
    try {
      const activeToken = this.getSessionToken();
      const resp = await this.originalFetch(`${targetBase}${item.url}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { 'X-Urutau-Session': activeToken } : {})
        },
        body: JSON.stringify(clonedBody)
      });
      if (resp.ok) {
        queue[idx] = {
          ...item,
          status: 'sincronizado',
          syncedAt: new Date().toISOString(),
          resumo: `${item.resumo} (Ambos os envios preservados)`,
          conflictFields: undefined
        };
        this.saveQueue(queue);
        return true;
      }
    } catch {}
    return false;
  }

  public simulateSimultaneousConflict() {
    const now = new Date().toISOString();
    const demoItem: OfflineQueueItem = {
      id: `conflito-demo-${Date.now()}`,
      url: '/api/erp/caixa',
      method: 'POST',
      modulo: 'Caixa Diário & Estoque',
      resumo: 'Fechamento de Turno — Caixa Principal (2 Aparelhos enviaram ao mesmo tempo)',
      operador: this.currentOperator || 'Computador do Caixa (PC)',
      aparelho: 'Computador PC (Modo Offline)',
      createdAt: now,
      baseSnapshotAt: now,
      body: {
        tipo: 'ENTRADA',
        categoria: 'Vendas Turno Noite',
        descricao: 'Fechamento de Caixa do Turno',
        valor: 4850.0,
        responsavel: this.currentOperator || 'Operador do PC'
      },
      baseRecord: {
        tipo: 'ENTRADA',
        categoria: 'Vendas Turno Noite',
        descricao: 'Fechamento de Caixa do Turno',
        valor: 4200.0,
        responsavel: 'Sistema Inicial'
      },
      serverRecord: {
        tipo: 'ENTRADA',
        categoria: 'Vendas Turno Noite',
        descricao: 'Fechamento de Caixa do Turno (Enviado pelo Celular)',
        valor: 4620.0,
        responsavel: 'Gerente (Pelo Celular)'
      },
      conflictFields: [
        {
          campo: 'valor',
          label: 'Valor Registrado (R$)',
          valorLocal: 'R$ 4.850,00 (Computador PC)',
          valorServidor: 'R$ 4.620,00 (Celular da Gerência)'
        },
        {
          campo: 'responsavel',
          label: 'Quem Enviou',
          valorLocal: `${this.currentOperator} (Neste PC sem internet)`,
          valorServidor: 'Gerente Operacional (Pelo Celular)'
        },
        {
          campo: 'descricao',
          label: 'Observação do Lançamento',
          valorLocal: 'Fechamento de Caixa do Turno (Incluindo mesas extras)',
          valorServidor: 'Fechamento de Caixa do Turno (Enviado pelo Celular)'
        }
      ],
      status: 'conflito'
    };

    const queue = this.getQueue();
    queue.unshift(demoItem);
    this.saveQueue(queue);
  }

  public clearSyncedHistory() {
    const queue = this.getQueue().filter((q) => q.status !== 'sincronizado');
    this.saveQueue(queue);
  }

  public enqueueManualOfflineTest() {
    this.enqueueOfflineRequest('/api/erp/caixa', 'POST', {
      tipo: 'ENTRADA',
      categoria: 'Venda Balcão (Modo Offline)',
      descricao: `Venda registrada sem internet às ${new Date().toLocaleTimeString('pt-BR')}`,
      valor: 185.5,
      responsavel: this.currentOperator || 'Operador do PC'
    });
  }

  private buildSessionInit(init?: RequestInit, extraLanOrigin = false): RequestInit {
    const mergedHeaders = new Headers(init?.headers || {});
    if (extraLanOrigin) {
      mergedHeaders.set('X-Urutau-Lan-Origin', 'true');
    }
    const activeToken = this.getSessionToken();
    if (activeToken && !mergedHeaders.has('X-Urutau-Session')) {
      mergedHeaders.set('X-Urutau-Session', activeToken);
    }
    return {
      ...init,
      credentials: init?.credentials || 'include',
      headers: mergedHeaders
    };
  }

  private buildLanRewriteInit(init?: RequestInit): RequestInit {
    return this.buildSessionInit(init, true);
  }

  public async fetchWithOfflineSupport(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const nativeFetch = this.originalFetch || window.fetch.bind(window);
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method || 'GET').toUpperCase();

    if (/^https?:\/\//i.test(rawUrl) && typeof window !== 'undefined' && !rawUrl.startsWith(window.location.origin)) {
      return nativeFetch(input, init);
    }

    const relativePath = rawUrl.replace(/^https?:\/\/[^/]+/, '');
    if (!relativePath.startsWith('/api/')) {
      return nativeFetch(input, init);
    }

    const authedInit = this.buildSessionInit(init, false);
    const lanCfg = this.getLanConfig();
    const lanBase = this.getLanServerBaseUrl();
    const isAlreadyOnLanHost = typeof window !== 'undefined' && isPrivateLanHostname(window.location.hostname);

    const tryLanFetch = async (): Promise<Response | null> => {
      if (isAlreadyOnLanHost) {
        return nativeFetch(relativePath, this.buildLanRewriteInit(init));
      }
      if (!lanBase || (!lanCfg.autoFailoverWifi && !lanCfg.forcarModoLanWifi)) {
        return null;
      }
      try {
        const resp = await nativeFetch(`${lanBase}${relativePath}`, {
          ...this.buildLanRewriteInit(init),
          signal: init?.signal || AbortSignal.timeout(4500)
        });
        if (resp.ok || resp.status < 500) {
          this.setActiveTier('wifi_lan_ativo');
          return resp;
        }
      } catch {}
      return null;
    };

    if (relativePath.includes('/api/erp/dados-completos') && method === 'GET') {
      if (lanCfg.forcarModoLanWifi && lanBase && !isAlreadyOnLanHost) {
        const lanResp = await tryLanFetch();
        if (lanResp && lanResp.ok) {
          const clone = lanResp.clone();
          clone.json().then((d) => this.saveSnapshot(d)).catch(() => {});
          return lanResp;
        }
      }

      if (!this.isEffectivelyOnline()) {
        const lanResp = await tryLanFetch();
        if (lanResp && lanResp.ok) {
          const clone = lanResp.clone();
          clone.json().then((d) => this.saveSnapshot(d)).catch(() => {});
          return lanResp;
        }
        this.setActiveTier('offline_aparelho');
        const cached = this.getSnapshot();
        if (cached) {
          return new Response(JSON.stringify(cached), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'X-Urutau-Offline': 'true' }
          });
        }
      }

      try {
        const response = await nativeFetch(input, {
          ...authedInit,
          signal: init?.signal || AbortSignal.timeout(3800)
        });
        if (response.ok) {
          if (!isAlreadyOnLanHost) this.setActiveTier('vps_online');
          const clone = response.clone();
          clone
            .json()
            .then((data) => {
              this.saveSnapshot(data);
              if (lanBase && !isAlreadyOnLanHost && lanCfg.autoFailoverWifi) {
                const mirrorHeaders: Record<string, string> = {
                  'Content-Type': 'application/json',
                  'X-Urutau-Lan-Origin': 'true'
                };
                const activeToken = this.getSessionToken();
                if (activeToken) mirrorHeaders['X-Urutau-Session'] = activeToken;
                nativeFetch(`${lanBase}/api/lan/espelhar-da-vps`, {
                  method: 'POST',
                  credentials: 'include',
                  headers: mirrorHeaders,
                  body: JSON.stringify({ vps_url: window.location.origin, snapshot: data })
                }).catch(() => {});
              }
            })
            .catch(() => {});
        }
        return response;
      } catch (err) {
        const lanResp = await tryLanFetch();
        if (lanResp && lanResp.ok) {
          const clone = lanResp.clone();
          clone.json().then((d) => this.saveSnapshot(d)).catch(() => {});
          return lanResp;
        }
        this.setActiveTier('offline_aparelho');
        const cached = this.getSnapshot();
        if (cached) {
          return new Response(JSON.stringify(cached), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'X-Urutau-Offline': 'true' }
          });
        }
        throw err;
      }
    }

    const isOperationalWrite =
      (relativePath.startsWith('/api/erp/') ||
        relativePath.startsWith('/api/pdv/') ||
        relativePath.startsWith('/api/v20/') ||
        relativePath.startsWith('/api/v46/') ||
        relativePath.startsWith('/api/v50/') ||
        relativePath.startsWith('/api/reservas') ||
        relativePath.startsWith('/api/integracoes/consumer/')) &&
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    if (lanCfg.forcarModoLanWifi && lanBase && !isAlreadyOnLanHost) {
      const lanResp = await tryLanFetch();
      if (lanResp) return lanResp;
    }

    if (isOperationalWrite && !this.isEffectivelyOnline()) {
      const lanResp = await tryLanFetch();
      if (lanResp) return lanResp;

      this.setActiveTier('offline_aparelho');
      let parsedBody: any = {};
      if (init?.body && typeof init.body === 'string') {
        try {
          parsedBody = JSON.parse(init.body);
        } catch {}
      }
      const item = this.enqueueOfflineRequest(relativePath, method, parsedBody);
      return new Response(
        JSON.stringify({
          ok: true,
          offlineQueued: true,
          itemId: item.id,
          mensagem:
            'Salvo com segurança neste aparelho. Assim que conectar ao Wi-Fi do Servidor Local ou à internet, será sincronizado e impresso!'
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'X-Urutau-Offline-Queued': 'true' }
        }
      );
    }

    if (isOperationalWrite) {
      try {
        const resp = await nativeFetch(input, {
          ...authedInit,
          signal: init?.signal || AbortSignal.timeout(4500)
        });
        if (!isAlreadyOnLanHost) this.setActiveTier('vps_online');
        return resp;
      } catch {
        const lanResp = await tryLanFetch();
        if (lanResp) return lanResp;

        this.setActiveTier('offline_aparelho');
        let parsedBody: any = {};
        if (init?.body && typeof init.body === 'string') {
          try {
            parsedBody = JSON.parse(init.body);
          } catch {}
        }
        const item = this.enqueueOfflineRequest(relativePath, method, parsedBody);
        return new Response(
          JSON.stringify({
            ok: true,
            offlineQueued: true,
            itemId: item.id,
            mensagem:
              'A conexão oscilou, mas o lançamento foi guardado na fila offline do aparelho sem perda de dados!'
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'X-Urutau-Offline-Queued': 'true' }
          }
        );
      }
    }

    try {
      return await nativeFetch(input, authedInit);
    } catch (err) {
      const lanResp = await tryLanFetch();
      if (lanResp) return lanResp;
      throw err;
    }
  }

  private installFetchInterceptor() {
    if (this.originalFetch) return;
    if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;

    this.originalFetch = window.fetch.bind(window);
    const wrappedFetch = (input: RequestInfo | URL, init?: RequestInit) =>
      this.fetchWithOfflineSupport(input, init);

    try {
      const desc =
        Object.getOwnPropertyDescriptor(window, 'fetch') ||
        Object.getOwnPropertyDescriptor(Object.getPrototypeOf(window), 'fetch');
      if (!desc || desc.writable) {
        window.fetch = wrappedFetch;
      } else if (desc.configurable) {
        Object.defineProperty(window, 'fetch', {
          value: wrappedFetch,
          configurable: true,
          writable: true
        });
      }
    } catch {}
  }
}

export const offlineSyncEngine = new OfflineSyncEngine();
