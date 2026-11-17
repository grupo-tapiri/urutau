export type TabId =
  | 'home'
  | 'empresas'
  | 'freelancers'
  | 'cadastros'
  | 'cargos'
  | 'rateio'
  | 'escalas'
  | 'agenda'
  | 'pdv'
  | 'reservas'
  | 'portais'
  | 'chat'
  | 'caixa'
  | 'estoque'
  | 'compras'
  | 'cmv'
  | 'equipe'
  | 'selecao'
  | 'rh'
  | 'unidades'
  | 'setores'
  | 'checklists'
  | 'modulos'
  | 'notificacoes'
  | 'auditoria'
  | 'permissoes'
  | 'config'
  | 'servidor_ia';

export interface NavCategory {
  id: string;
  titulo: string;
  abas: TabId[];
  corSimbolo?: string;
}

export interface TabMeta {
  id: TabId;
  label: string;
  categoriaId: string;
  descricaoCurta: string;
  iconName?: string;
  iconColor?: string;
  hidden?: boolean;
}

export interface CustomTabOverride {
  label?: string;
  iconName?: string;
  iconColor?: string;
  hidden?: boolean;
}

export type SystemImageSlotId =
  | 'topo_painel'
  | 'pulso_tempo_real'
  | 'tela_login'
  | 'menu_lateral'
  | 'dialogos_seguranca'
  | 'favicon_guia';

export type SystemImageSourceId =
  | 'vazado'
  | 'favicon'
  | 'sentinela'
  | 'camuflagem'
  | 'olhos_fechados'
  | 'canto'
  | 'comunicacao'
  | 'totem'
  | 'octogono'
  | 'voando'
  | 'logo_empresa'
  | string;

export interface CustomBrandImageItem {
  id: string;
  nome: string;
  dataUrl: string;
}

export type SystemSoundSlotId =
  | 'salvamento'
  | 'notificacao'
  | 'erro'
  | 'mensagem'
  | 'evento_sse'
  | 'transicao_voo'
  | 'login_acesso'
  | 'alerta_caixa_estoque';

export type SystemSoundSourceId =
  | 'canto_urutau_suave'
  | 'flauta_igarape'
  | 'maraca_cristal'
  | 'tambor_urucum'
  | 'gota_orvalho'
  | 'asas_vento'
  | 'harpa_guaraci'
  | 'sino_tapiri'
  | 'silencioso'
  | string;

export interface CustomSoundItem {
  id: string;
  nome: string;
  dataUrl: string;
  criadoEm?: string;
}

export interface SoundSystemConfig {
  enabled: boolean;
  masterVolume: number; 
  soundPlacements?: Partial<Record<SystemSoundSlotId, SystemSoundSourceId>>;
  customSounds?: CustomSoundItem[];
}

export type SlotDisplayChoice = 'passaro' | 'logo_principal' | 'imagem_especifica';

export interface SlotCustomizationItem {
  choice: SlotDisplayChoice;
  customDataUrl?: string;
  customFileName?: string;
}

export interface BrandIdentityConfig {
  companyName?: string;
  logoDataUrl?: string;
  companyColorHex: string;
  companySecondaryHex?: string;
  companyTertiaryHex?: string;
  logoHighlights?: string[];
  urutauBaseHex: string;
  blendRatio: number;
  effectivePrimaryHex: string;
  effectivePrimaryRgb: { r: number; g: number; b: number };
  effectiveSecondaryHex: string;
  effectiveTertiaryHex?: string;
  modeloTracoPreferido?: string;
  customGallery?: CustomBrandImageItem[];
  imagePlacements?: Partial<Record<SystemImageSlotId, SystemImageSourceId>>;
  slotCustomizations?: Partial<Record<SystemImageSlotId, SlotCustomizationItem>>;
  soundConfig?: SoundSystemConfig;
  backgroundBrightness?: number | null;
}

export const MENU_SYMBOL_COLOR_PALETTE = [
  { hex: '#10B981', nome: 'Turquesa Igarapé' },
  { hex: '#F59E0B', nome: 'Ouro Guaraci' },
  { hex: '#F43F5E', nome: 'Urucum Vibrante' },
  { hex: '#8B5CF6', nome: 'Açaí Bioluminescente' },
  { hex: '#06B6D4', nome: 'Azul Cristal' },
  { hex: '#22C55E', nome: 'Esmeralda Viva' },
  { hex: '#EC4899', nome: 'Rosa Vitória-Régia' },
  { hex: '#F97316', nome: 'Laranja Tucupi' },
  { hex: '#EAB308', nome: 'Sol Dourado' },
  { hex: '#38BDF8', nome: 'Céu da Mata' },
  { hex: '#A855F7', nome: 'Orquídea Roxa' },
  { hex: '#F8FAFC', nome: 'Branco Brilhante' }
];

export const DEFAULT_TAB_META: Record<TabId, TabMeta> = {
  home: { id: 'home', label: 'Início', categoriaId: 'salao_atendimento', descricaoCurta: 'Visão geral, indicadores e alertas', iconName: 'LayoutGrid', iconColor: '#10B981' },
  empresas: { id: 'empresas', label: 'Empresas', categoriaId: 'estrutura_qualidade', descricaoCurta: '', iconName: 'Network', iconColor: '#10B981' },
  freelancers: { id: 'freelancers', label: 'Freelancers', categoriaId: 'rh_selecao', descricaoCurta: '', iconName: 'Sparkles', iconColor: '#F59E0B' },
  cadastros: { id: 'cadastros', label: 'Cadastros', categoriaId: 'rh_selecao', descricaoCurta: 'PF/PJ, Clientes, Fornecedores e Equipe', iconName: 'UserPlus', iconColor: '#8B5CF6' },
  cargos: { id: 'cargos', label: 'Cargos', categoriaId: 'estrutura_qualidade', descricaoCurta: 'Cadastro de Cargos e Vínculos N:N', iconName: 'BadgeCheck', iconColor: '#F59E0B' },
  rateio: { id: 'rateio', label: 'Rateio (Área do Financeiro)', categoriaId: 'financeiro_caixa', descricaoCurta: 'Subárea do Financeiro para divisão de comissões', iconName: 'Percent', iconColor: '#F59E0B' },
  escalas: { id: 'escalas', label: 'Escalas', categoriaId: 'operacao_escalas', descricaoCurta: 'Matriz semanal e turnos da operação', iconName: 'Clock', iconColor: '#38BDF8' },
  agenda: { id: 'agenda', label: 'Agenda', categoriaId: 'operacao_escalas', descricaoCurta: 'Calendário operacional e tarefas', iconName: 'Calendar', iconColor: '#22C55E' },
  pdv: { id: 'pdv', label: 'PDV & Comandas', categoriaId: 'salao_atendimento', descricaoCurta: 'Mesas, balcão, delivery, impressão e modo Wi-Fi local', iconName: 'Utensils', iconColor: '#10B981' },
  reservas: { id: 'reservas', label: 'Reservas', categoriaId: 'operacao_escalas', descricaoCurta: 'Mapa de mesas, reservas e fila', iconName: 'Store', iconColor: '#EC4899' },
  portais: { id: 'portais', label: 'Portais', categoriaId: 'operacao_escalas', descricaoCurta: 'Sistemas externos integrados', iconName: 'Globe', iconColor: '#06B6D4' },
  chat: { id: 'chat', label: 'WhatsApp', categoriaId: 'salao_atendimento', descricaoCurta: 'Atendimento e comunidade', iconName: 'MessageSquare', iconColor: '#10B981' },
  caixa: { id: 'caixa', label: 'Caixa', categoriaId: 'financeiro_caixa', descricaoCurta: 'Financeiro, entradas, saídas, pagamentos de RH e rateio', iconName: 'Wallet', iconColor: '#22C55E' },
  estoque: { id: 'estoque', label: 'Estoque', categoriaId: 'financeiro_caixa', descricaoCurta: 'Insumos, alertas e reposição', iconName: 'Boxes', iconColor: '#F59E0B' },
  compras: { id: 'compras', label: 'Compras', categoriaId: 'financeiro_caixa', descricaoCurta: '', iconName: 'ShoppingCart', iconColor: '#F59E0B' },
  cmv: { id: 'cmv', label: 'CMV', categoriaId: 'financeiro_caixa', descricaoCurta: 'Custo de mercadoria vendida', iconName: 'PieChart', iconColor: '#EC4899' },
  equipe: { id: 'equipe', label: 'Equipe', categoriaId: 'estrutura_qualidade', descricaoCurta: 'Colaboradores ativos e funções', iconName: 'Users', iconColor: '#38BDF8' },
  selecao: { id: 'selecao', label: 'Seleção', categoriaId: 'rh_selecao', descricaoCurta: '', iconName: 'UserPlus', iconColor: '#F59E0B' },
  rh: { id: 'rh', label: 'RH', categoriaId: 'rh_selecao', descricaoCurta: 'Recursos de RH, Folha, Vagas e Seleção', iconName: 'Briefcase', iconColor: '#10B981' },
  unidades: { id: 'unidades', label: 'Unidades', categoriaId: 'estrutura_qualidade', descricaoCurta: 'Lojas e filiais operacionais', iconName: 'Building2', iconColor: '#F59E0B' },
  setores: { id: 'setores', label: 'Setores', categoriaId: 'estrutura_qualidade', descricaoCurta: 'Áreas de atendimento e produção', iconName: 'Layers', iconColor: '#A855F7' },
  checklists: { id: 'checklists', label: 'Checklists', categoriaId: 'salao_atendimento', descricaoCurta: 'Rotinas de abertura e fechamento', iconName: 'ClipboardCheck', iconColor: '#22C55E' },
  modulos: { id: 'modulos', label: 'Módulos', categoriaId: 'governanca_sistema', descricaoCurta: '', iconName: 'Boxes', iconColor: '#10B981' },
  notificacoes: { id: 'notificacoes', label: 'Alertas', categoriaId: 'salao_atendimento', descricaoCurta: 'Incorporado ao menu Início', iconName: 'Bell', iconColor: '#EAB308' },
  auditoria: { id: 'auditoria', label: 'Logs', categoriaId: 'governanca_sistema', descricaoCurta: 'Incorporado ao menu Ajustes', iconName: 'FileSearch', iconColor: '#06B6D4' },
  permissoes: { id: 'permissoes', label: 'Acessos', categoriaId: 'rh_selecao', descricaoCurta: 'Alçadas de subordinados e acessos', iconName: 'KeyRound', iconColor: '#F43F5E' },
  config: { id: 'config', label: 'Ajustes', categoriaId: 'governanca_sistema', descricaoCurta: 'Identidade, menus, logs, auditoria e backup', iconName: 'Settings', iconColor: '#10B981' },
  servidor_ia: { id: 'servidor_ia', label: 'Servidor', categoriaId: 'governanca_sistema', descricaoCurta: '', iconName: 'Server', iconColor: '#F59E0B' }
};

export type EscopoColaboradores = 'todos' | 'subordinados' | 'pessoal';

export interface ModuloPermissao {
  ver: boolean;
  editar: boolean;
  escopo?: EscopoColaboradores;
}

export interface PermissoesUsuario {
  total?: boolean;
  escopo_colaboradores?: EscopoColaboradores;
  modulos?: Record<string, ModuloPermissao>;
  [k: string]: any;
}

export const DEFAULT_CATEGORIES: NavCategory[] = [
  {
    id: 'salao_atendimento',
    titulo: 'Salão',
    corSimbolo: '#10B981',
    abas: ['home', 'pdv', 'checklists', 'chat']
  },
  {
    id: 'operacao_escalas',
    titulo: 'Operação',
    corSimbolo: '#F59E0B',
    abas: ['escalas', 'agenda', 'reservas', 'portais']
  },
  {
    id: 'financeiro_caixa',
    titulo: 'Financeiro',
    corSimbolo: '#22C55E',
    abas: ['caixa', 'estoque', 'cmv']
  },
  {
    id: 'rh_selecao',
    titulo: 'RH & Vagas',
    corSimbolo: '#EC4899',
    abas: ['rh', 'cadastros', 'permissoes']
  },
  {
    id: 'estrutura_qualidade',
    titulo: 'Estrutura',
    corSimbolo: '#38BDF8',
    abas: ['equipe', 'unidades', 'setores', 'cargos']
  },
  {
    id: 'governanca_sistema',
    titulo: 'Admin',
    corSimbolo: '#F43F5E',
    abas: ['config']
  }
];

export type PapelCadastro =
  | 'cliente'
  | 'fornecedor'
  | 'colaborador'
  | 'colaborador_efetivo'
  | 'colaborador_free'
  | 'gestor_conta';

export type NaturezaCadastro = 'PF' | 'PJ' | 'EMPRESA' | 'FREELANCER';

export interface CadastroPessoa {
  id: number;
  tipo_pessoa: 'PF' | 'PJ';
  natureza?: NaturezaCadastro;
  nome: string;
  nome_fantasia?: string;
  documento: string; 
  whatsapp: string;
  email?: string;
  cidade?: string;
  endereco?: string;
  cargo_ou_ramo?: string;
  papeis: PapelCadastro[];
  empresa_id?: number;
  gestor_id?: number | null;
  valor_diaria?: number;
  disponibilidade_dias?: number[];
  comunidade_wpp_autorizada?: boolean;
  interacao_sistema_bloqueada?: boolean;
  usuario_sistema_id?: number | null;
  observacoes?: string;
  arquivado_legal: boolean;
  criado_em: string;
}

export interface DeepLinkTarget {
  tab: TabId;
  entityId?: number;
  mesaCodigo?: string;
  action?: 'edit' | 'universe' | 'filter';
}

export type NivelAcessoLicencaEmpresa = 'uso_completo' | 'somente_leitura' | 'somente_download';

export interface DiretorioPlanilhaItem {
  codigo: string;
  nome_pasta: string;
  descricao: string;
  folder_drive_id?: string;
  folder_drive_url?: string;
  planilha_nome?: string;
  planilha_id?: string;
  planilha_url?: string;
  abas: string[];
}

export type ModoConexaoGoogleDrive = 'botao_google' | 'compartilhar_pasta' | 'automatico_depois';

export interface LgpdGoogleSheetsCustodyConfig {
  empresa_id: number;
  empresa_nome: string;
  controlador_nome: string;
  controlador_documento: string;
  controlador_email: string;
  termo_lgpd_aceito: boolean;
  termo_lgpd_aceito_em: string;
  termo_versao: string;
  modo_conexao_drive?: ModoConexaoGoogleDrive;
  email_servico_compartilhamento?: string;
  pasta_google_drive_nome?: string;
  pasta_google_drive_url?: string;
  pasta_google_drive_id?: string;
  diretorio_workspace_id?: string;
  planilha_google_url: string;
  planilha_google_id: string;
  apps_script_webhook_url: string;
  chave_secreta_planilha: string;
  guarda_exclusiva_planilha_empresario: boolean;
  zero_guarda_operacional_vps: boolean;
  estrutura_criada_no_cadastro?: boolean;
  estrutura_diretorios_planilhas?: DiretorioPlanilhaItem[];
  ultima_sincronizacao_em?: string;
  status_conexao: 'Ativa' | 'Aguardando Vínculo' | 'Erro de Conexão';
}

export interface Empresa {
  id: number;
  nome: string;
  cnpj: string;
  waha_session_id: string;
  waha_numero: string;
  waha_status: 'Conectado' | 'Desconectado' | 'Aguardando QR Code';
  wpp_comercial_numero?: string;
  bot_interno_numero?: string;
  bot_interno_status?: 'Conectado' | 'Desconectado' | 'Aguardando Pareamento';
  usar_wpp_pessoal_como_bot?: boolean;
  whatsapp_pessoal_titular?: string;
  alertas_equipe_config?: {
    escalas: boolean;
    estoque: boolean;
    fechamento_caixa: boolean;
    ponto_gps: boolean;
  };
  lgpd_custodia_config?: LgpdGoogleSheetsCustodyConfig;
  nivel_acesso_licenca?: NivelAcessoLicencaEmpresa;
  status_licenca?: string;
  observacao_licenca?: string;
  cidade: string;
  ramo: string;
  diaria_teto: number;
  subdominio?: string;
  link_acesso?: string;
  brand_config?: Partial<BrandIdentityConfig> | null;
  arquivado_legal: boolean;
  criado_em: string;
}

export interface Freelancer {
  id: number;
  nome: string;
  whatsapp: string;
  funcao: string;
  funcoes_secundarias?: string[];
  valor_diaria: number;
  disponivel: boolean;
  disponibilidade_dias: number[]; 
  empresas_bloqueadas: number[]; 
  empresas_autorizadas?: number[]; 
  cidade: string;
  avaliacao_estrelas: number;
  total_diarias_realizadas: number;
  arquivado_legal: boolean;
  criado_em: string;
}

export interface MatchContratacao {
  id: number;
  empresa_id: number;
  empresa_nome: string;
  freelancer_id: number;
  freelancer_nome: string;
  data: string;
  funcao: string;
  valor_acordado: number;
  status: 'Solicitado' | 'Confirmado' | 'Recusado' | 'Concluído';
  criado_em: string;
}

export interface VagaRH {
  id: number;
  titulo: string;
  setor: string;
  unidade_id: number;
  quantidade_vagas: number;
  remuneracao: string;
  turno: string;
  requisitos: string;
  status: 'Aberta' | 'Em Triagem' | 'Concluída' | 'Pausada';
  data_abertura: string;
  prontuario_rh_id?: number | null;
  arquivado_legal?: boolean;
  criado_em: string;
}

export type NivelHierarquicoCargo = 'autonomo' | 'operacional' | 'lideranca' | 'supervisao' | 'gestao' | 'diretoria';
export type TipoVinculoPadraoCargo = 'autonomo_sem_vinculo' | 'efetivo_clt' | 'freelancer_diarista' | 'pj' | 'estagio' | 'aprendiz';

export interface Cargo {
  id: number;
  nome: string;
  cbo?: string;
  nivel_hierarquico: NivelHierarquicoCargo;
  tipo_vinculo_padrao: TipoVinculoPadraoCargo;
  salario_base_sugerido?: number;
  valor_diaria_sugerida?: number;
  participa_rateio_10: boolean;
  peso_rateio_padrao?: number;
  exige_controle_ponto: boolean;
  exige_gps: boolean;
  descricao_atividades?: string;
  requisitos_qualificacao?: string;
  setor_principal_id?: number | null;
  horario_entrada_padrao?: string;
  horario_saida_padrao?: string;
  dias_semana_padrao?: number[];
  intervalo_minutos?: number;
  tolerancia_minutos?: number;
  cor_identificacao?: string;
  arquivado_legal: boolean;
  criado_em: string;
}

export interface ERPCompleteData {
  empresas: Empresa[];
  freelancers: Freelancer[];
  cadastrosPessoas?: CadastroPessoa[];
  registrosArquivados?: any[];
  cargos?: Cargo[];
  matches_contratacoes: MatchContratacao[];
  empresaAtivaId: number | null; 
  unidades: any[];
  setores: any[];
  usuarios: any[];
  checklists: any[];
  escalaFixa: Record<number, number[]>;
  movimentosEscala: any[];
  agenda: any[];
  reservas: any[];
  pdvProdutos?: ProdutoCardapioPdv[];
  pdvComandas?: ComandaPdv[];
  pdvImpressoras?: ImpressoraTermicaPdv[];
  pdvFilaImpressao?: JobFilaImpressaoPdv[];
  lanHubStatus?: LanHubStatusInfo;
  portais: any[];
  caixa: any[];
  categoriasFechamentoCaixa?: CategoriaFechamentoCaixa[];
  fechamentosCaixaDiarios?: RelatorioFechamentoCaixaDiario[];
  estoque: any[];
  cmv: any[];
  vagasRH?: VagaRH[];
  selecao: any[];
  rhRegistros: any[];
  mensagensRapidas: any[];
  notificacoes: any[];
  rateiosHistorico: any[];
  configs: { chave: string; valor_json: any; atualizado_em: string }[];
  auditLogs: any[];
  backupsHorarios: any[];
  filaAprovacoes: any[];
  instanciasChat: any[];
  mensagensChat: any[];
  cqrs: {
    mv_cmv_diario: any[];
    mv_rateio_10: any[];
  };
  pesosRateioSetoresEmpresas?: Record<string, Record<string, number>>;
  relacionamentos: Record<string, any[]>;
}

export interface CommonTabProps {
  data: ERPCompleteData;
  onRefresh: () => Promise<void>;
  onNavigateDeepLink: (target: DeepLinkTarget) => void;
  showAlert: (title: string, message: string, technicalDetails?: string) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
  deepLinkEntityId?: number | null;
  clearDeepLink: () => void;
  currentUser?: any;
  onSwitchCurrentUser?: (user: any) => void;
}

export interface SecurityGeofenceTurnoConfig {
  geofenceAtivo: boolean;
  empresaLatitude: number;
  empresaLongitude: number;
  raioPermitidoMetros: number;
  enderecoReferencia?: string;
  empresaNomeReferencia?: string;
  abasExigemLocalizacaoEmpresa: TabId[];
  bloqueioForaDeTurnoAtivo: boolean;
  bloqueioForaTurnoAtivo?: boolean;
  horarioInicioTurnoPadrao: string;
  horarioFimTurnoPadrao: string;
  toleranciaMinutos?: number;
  abasBloqueadasForaDeTurno: TabId[];
  isentarSuperAdmin: boolean;
  rastrearCliquesELogsNoMapa: boolean;
  aplicarEmModoSimulacao?: boolean;
}

export const DEFAULT_OPERATIONAL_BLOCKED_TABS: TabId[] = [
  'rateio',
  'escalas',
  'agenda',
  'pdv',
  'reservas',
  'chat',
  'caixa',
  'estoque',
  'compras',
  'cmv',
  'cadastros',
  'cargos',
  'equipe',
  'selecao',
  'rh',
  'unidades',
  'setores',
  'checklists',
  'portais',
  'empresas',
  'freelancers'
];

export const DEFAULT_SECURITY_GEOFENCE_TURNO_CONFIG: SecurityGeofenceTurnoConfig = {
  geofenceAtivo: false,
  empresaLatitude: -1.4558,
  empresaLongitude: -48.5039,
  raioPermitidoMetros: 250,
  enderecoReferencia: 'Sede Matriz Cumaru — Belém/PA',
  abasExigemLocalizacaoEmpresa: [],
  bloqueioForaDeTurnoAtivo: false,
  bloqueioForaTurnoAtivo: false,
  horarioInicioTurnoPadrao: '08:00',
  horarioFimTurnoPadrao: '23:30',
  abasBloqueadasForaDeTurno: [],
  isentarSuperAdmin: true,
  rastrearCliquesELogsNoMapa: false,
  aplicarEmModoSimulacao: false
};

export interface LoteFardoVencimento {
  id: string;
  codigo_lote: string; 
  quantidade: number; 
  unidade_fardo?: string; 
  data_vencimento: string; 
  observacao?: string;
  criado_em?: string;
}

export type TipoComunicacao =
  | 'troca_turno'
  | 'alerta_estoque'
  | 'reserva_vip'
  | 'briefing_turno'
  | 'aviso_geral'
  | 'fechamento_caixa'
  | 'chamado_geral';

export interface RespostaComunicacao {
  id: string;
  autor: string;
  papel: string;
  texto: string;
  criado_em: string;
  wpp_enviado?: boolean;
}

export interface AcaoSistemaComunicacao {
  tipo: 'troca_escala' | 'ver_estoque' | 'abrir_mapa_mesas' | 'ver_caixa' | 'confirmar_leitura' | 'repor_insumo';
  descricao?: string;
  payload?: any;
  executada: boolean;
  executada_por?: string;
  executada_em?: string;
}

export interface ComunicacaoNotificacao {
  id: number;
  titulo: string;
  mensagem: string;
  tipo?: TipoComunicacao;
  remetente_nome?: string;
  remetente_cargo?: string;
  destinatario_nome?: string;
  destinatario_grupo?: 'todos' | 'salao' | 'cozinha' | 'bar' | 'gestores' | 'individual';
  destino_wpp?: string;
  horario_disparo?: string;
  status?: 'Pendente Gestor' | 'Aprovado' | 'Concluído' | 'Enviado WhatsApp' | 'Lido' | 'Programada';
  acao_sistema?: AcaoSistemaComunicacao;
  respostas?: RespostaComunicacao[];
  arquivado_legal?: boolean;
  criado_em?: string;
}

export type FonteSistemaFechamentoCaixa =
  | 'CAIXA_CATEGORIA'
  | 'DELIVERY_ENTRADAS'
  | 'RATEIO_10_GORJETA'
  | 'CAIXA_SALAO_ENTRADAS'
  | 'ENTREGADORES_DESPESAS'
  | 'COMPRAS_FORNECEDORES'
  | 'RH_VALES_PAGAMENTOS'
  | 'CAIXA_TODAS_ENTRADAS'
  | 'CAIXA_TODAS_SAIDAS'
  | 'MANUAL_PURO';

export type ModoPreenchimentoFechamento = 'sistema' | 'manual' | 'mesclado';

export interface CategoriaFechamentoCaixa {
  id: string;
  nome: string;
  tipo: 'Entrada' | 'Saída';
  modo_padrao: ModoPreenchimentoFechamento;
  fonte_sistema: FonteSistemaFechamentoCaixa;
  filtro_origem: string;
  lancar_no_caixa_em_massa: boolean;
  ordem: number;
  unidade_id?: number;
  arquivado_legal?: boolean;
}

export interface ItemRelatorioFechamentoCaixa {
  categoria_id: string;
  nome: string;
  tipo: 'Entrada' | 'Saída';
  modo_preenchimento: ModoPreenchimentoFechamento;
  fonte_sistema: FonteSistemaFechamentoCaixa;
  filtro_origem: string;
  valor_sistema: number;
  qtd_itens_sistema: number;
  expressao_manual: string;
  valor_manual: number;
  valor_final: number;
  observacao?: string;
  lancar_no_caixa: boolean;
}

export interface RelatorioFechamentoCaixaDiario {
  id: number;
  data: string;
  unidade_id: number;
  empresa_id?: number;
  operador_id?: number;
  operador_nome: string;
  turno: string;
  itens: ItemRelatorioFechamentoCaixa[];
  total_entradas: number;
  total_saidas: number;
  saldo_liquido: number;
  total_sistema: number;
  total_manual: number;
  observacoes_gerais?: string;
  lancado_em_massa_no_caixa: boolean;
  modo_lancamento_massa?: 'apenas_manual_complementar' | 'valor_final_consolidado';
  qtd_lancamentos_gerados_caixa?: number;
  criado_em: string;
  atualizado_em?: string;
  arquivado_legal?: boolean;
}

export type SetorImpressaoPdv = 'cozinha' | 'bar' | 'caixa' | 'nenhum';

export type TipoConexaoImpressoraPdv = 'rede_tcp_9100' | 'usb_caixa_windows';

export interface ProdutoCardapioPdv {
  id: number;
  codigo: string;
  nome: string;
  categoria: string;
  preco: number;
  setor_impressao: SetorImpressaoPdv;
  estoque_item_id?: number | null;
  qtd_baixa_estoque?: number;
  disponivel: boolean;
  unidade_id?: number;
  empresa_id?: number;
  arquivado_legal?: boolean;
}

export interface ItemPedidoComandaPdv {
  id: string;
  produto_id: number;
  nome: string;
  categoria: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  observacao?: string;
  setor_impressao: SetorImpressaoPdv;
  garcom_nome: string;
  horario: string;
  impresso_setor: boolean;
  status_preparo: 'enviado' | 'entregue' | 'cancelado';
}

export interface PagamentoParcialPdv {
  id: string;
  metodo: 'PIX' | 'Cartão Crédito' | 'Cartão Débito' | 'Dinheiro' | 'Vale Refeição';
  valor_pago: number;
  valor_recebido_dinheiro?: number;
  troco: number;
  pagante_ref?: string;
  inclui_gorjeta_valor: number;
  horario: string;
  operador: string;
}

export interface ComandaPdv {
  id: number;
  op_uuid: string;
  data: string;
  modalidade: 'mesa' | 'comanda' | 'balcao' | 'delivery';
  identificador: string;
  mesa_numero?: string;
  cliente_nome?: string;
  cliente_telefone?: string;
  endereco_entrega?: string;
  entregador_nome?: string;
  taxa_entrega?: number;
  garcom_nome: string;
  pessoas_mesa: number;
  itens: ItemPedidoComandaPdv[];
  pagamentos: PagamentoParcialPdv[];
  aplicar_gorjeta_10: boolean;
  percentual_gorjeta: number;
  desconto: number;
  subtotal_itens: number;
  valor_gorjeta: number;
  valor_total: number;
  valor_pago_acumulado: number;
  saldo_restante: number;
  status: 'aberta' | 'aguardando_pagamento' | 'fechada' | 'cancelada';
  unidade_id: number;
  empresa_id?: number;
  origem_offline_lan?: boolean;
  criado_em: string;
  atualizado_em?: string;
  fechado_em?: string;
  arquivado_legal?: boolean;
}

export interface ImpressoraTermicaPdv {
  id: number;
  nome: string;
  setor: 'cozinha' | 'bar' | 'caixa' | 'geral';
  tipo_conexao: TipoConexaoImpressoraPdv;
  ip_rede: string;
  porta_rede: number;
  nome_usb_windows: string;
  largura_papel: '80mm' | '58mm';
  vias: number;
  cortar_papel: boolean;
  ativa: boolean;
  unidade_id: number;
  empresa_id?: number;
  ultimo_status?: string;
  ultimo_teste_em?: string;
  arquivado_legal?: boolean;
}

export interface JobFilaImpressaoPdv {
  id: number;
  op_uuid: string;
  impressora_id: number;
  impressora_nome: string;
  setor: 'cozinha' | 'bar' | 'caixa' | 'geral';
  tipo_cupom: 'producao_setor' | 'conferencia_conta' | 'recibo_pagamento' | 'teste';
  referencia: string;
  linhas_texto: string[];
  escpos_base64: string;
  status: 'pendente_usb' | 'impresso' | 'erro_impressora';
  detalhe_transmissao: string;
  criado_em: string;
  impresso_em?: string;
  unidade_id: number;
  empresa_id?: number;
  arquivado_legal?: boolean;
}

export interface LanHubStatusInfo {
  ips_locais: string[];
  porta: number;
  vps_remota_url: string;
  ultimo_espelhamento_em?: string | null;
  ultima_reconciliacao_em?: string | null;
  pendentes_outbox_lan: number;
  sincronizados_outbox_lan: number;
}


