import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  HelpCircle,
  Layers,
  Sparkles,
  X,
  ChevronRight,
  Eye,
  EyeOff,
  ExternalLink,
  Search
} from 'lucide-react';
import { CustomTabOverride, DEFAULT_TAB_META, TabId } from '../types/erp';
import { UrutauEmblemSVG } from './UrutauShared';

function parseHexToRgbTuple(hex: string): { r: number; g: number; b: number } {
  const clean = String(hex || '#10B981').replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) || 16;
    const g = parseInt(clean[1] + clean[1], 16) || 185;
    const b = parseInt(clean[2] + clean[2], 16) || 129;
    return { r, g, b };
  }
  const num = parseInt(clean.slice(0, 6), 16);
  if (Number.isNaN(num)) return { r: 16, g: 185, b: 129 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

export function getMenuColorTheme(
  tabId: TabId,
  tabOverrides?: Record<string, CustomTabOverride>
) {
  const hex =
    tabOverrides?.[tabId]?.iconColor ||
    DEFAULT_TAB_META[tabId]?.iconColor ||
    '#10B981';
  const { r, g, b } = parseHexToRgbTuple(hex);
  const rgb = `${r}, ${g}, ${b}`;
  const label =
    tabOverrides?.[tabId]?.label ||
    DEFAULT_TAB_META[tabId]?.label ||
    tabId;

  return {
    hex,
    r,
    g,
    b,
    rgb,
    label,
    solidBtnStyle: {
      backgroundColor: '#10B981',
      color: '#061014',
      borderColor: '#10B981'
    } as React.CSSProperties,
    softBtnStyle: {
      backgroundColor: '#181D28',
      color: '#E2E8F0',
      borderColor: 'rgba(148, 163, 184, 0.22)'
    } as React.CSSProperties,
    cardBoxStyle: {
      backgroundColor: '#12161F',
      borderColor: 'rgba(148, 163, 184, 0.14)'
    } as React.CSSProperties,
    badgeStyle: {
      backgroundColor: '#181D28',
      color: '#CBD5E1',
      borderColor: 'rgba(148, 163, 184, 0.18)'
    } as React.CSSProperties
  };
}

export interface CleanSubTabItem {
  id: string;
  slug: string;
  label: string;
  shortDesc: string;
  internalButtonMatch?: string;
}

export interface ModuleCleanGuide {
  title: string;
  subtitle: string;
  whatItDoes: string;
  steps: string[];
  mode: 'internal_buttons' | 'dom_stages';
  subTabs: CleanSubTabItem[];
}

export const MODULE_CLEAN_GUIDES: Record<TabId, ModuleCleanGuide> = {
  home: {
    title: 'Início · Painel Operacional',
    subtitle: 'Indicadores do dia, atalhos rápidos e central de alertas',
    whatItDoes: 'Centraliza os principais números de caixa, salão, reservas, estoque, atalhos e alertas operacionais da empresa.',
    steps: [
      'Acompanhe o resumo financeiro, salão e estoque em "1. Visão Geral".',
      'Acesse qualquer módulo com 1 toque em "2. Atalhos Rápidos".',
      'Consulte alertas e atividades recentes em "3. Alertas & Atividades".'
    ],
    mode: 'dom_stages',
    subTabs: [
      { id: 'stage_1', slug: 'visao-geral', label: '1. Visão Geral', shortDesc: 'Indicadores essenciais do dia' },
      { id: 'stage_2', slug: 'atalhos-setor', label: '2. Atalhos Rápidos', shortDesc: 'Acesso direto aos módulos operacionais' },
      { id: 'stage_3', slug: 'alertas-lembretes', label: '3. Alertas & Atividades', shortDesc: 'Central de alertas, lembretes e últimos registros' }
    ]
  },
  quadro_branco: {
    title: 'Quadro Branco Pessoal',
    subtitle: 'Lousa dedicada em tela cheia para post-its, pinos, cores e organização de turno',
    whatItDoes: 'Espaço visual dedicado e isolado para cada colaborador organizar tarefas, post-its, pinos e zonas de trabalho sem poluir o painel principal.',
    steps: [
      'Adicione post-its, pinos e áreas personalizadas diretamente na lousa.',
      'Use o zoom, grade e abas para estruturar seu turno de trabalho.'
    ],
    mode: 'dom_stages',
    subTabs: [
      { id: 'stage_1', slug: 'lousa', label: '1. Lousa em Tela Cheia', shortDesc: 'Quadro branco pessoal interativo' }
    ]
  },
  aprovacoes: {
    title: 'Aprovações, Quarentena LGPD & Acessos',
    subtitle: 'Gestão de novos cadastros pendentes, vínculos de empresa e delegação de equipe',
    whatItDoes: 'Permite ao Admin Master aprovar cadastros em quarentena vinculando empresa e cargo, e ao Proprietário da Empresa convidar e aprovar sua própria equipe.',
    steps: [
      'Revise os usuários em quarentena (pending_approval) com aceite LGPD registrado.',
      'Vincule a empresa e a função (company_owner, Gerente de RH, Garçom, Caixa) e aprove o acesso.'
    ],
    mode: 'dom_stages',
    subTabs: [
      { id: 'stage_1', slug: 'fila-pendentes', label: '1. Fila de Aprovações', shortDesc: 'Cadastros pendentes e gestão de acessos' }
    ]
  },
  pdv: {
    title: 'PDV, Mesas e Pedidos',
    subtitle: 'Atendimento de salão, comandas e impressão na cozinha ou caixa',
    whatItDoes: 'Lance pedidos nas mesas ou balcão, envie automaticamente para a cozinha e feche a conta sem complicação.',
    steps: [
      'Escolha uma mesa livre ou ocupada na etapa "1. Mesas e Comandas".',
      'Adicione pedidos rápidos ou entregas na etapa "2. Balcão e Delivery".',
      'Cadastre produtos na etapa "3. Cardápio" ou configure impressoras na etapa "4. Impressoras".'
    ],
    mode: 'internal_buttons',
    subTabs: [
      { id: 'stage_1', slug: 'mesas-comandas', label: '1. Mesas e Comandas', shortDesc: 'Mapa de atendimento e contas abertas', internalButtonMatch: 'Mesas & Comandas' },
      { id: 'stage_2', slug: 'balcao-delivery', label: '2. Balcão e Delivery', shortDesc: 'Pedidos rápidos e entregas', internalButtonMatch: 'Balcão Rápido & Delivery' },
      { id: 'stage_3', slug: 'cardapio', label: '3. Cardápio Rápido', shortDesc: 'Preços e ficha de baixa de estoque', internalButtonMatch: 'Cardápio & Baixa de Estoque' },
      { id: 'stage_4', slug: 'impressoras', label: '4. Impressoras e Rede', shortDesc: 'Conexão com impressoras térmicas e Wi-Fi', internalButtonMatch: 'Impressoras & Rede Wi-Fi Local' }
    ]
  },
  caixa: {
    title: 'Caixa e Movimentos',
    subtitle: 'Entradas, saídas, fechamento de turno e divisão de gorjetas',
    whatItDoes: 'Registre tudo o que entra e sai do caixa no dia e faça a conferência de fechamento de turno.',
    steps: [
      'Veja o saldo do dia e registre entradas, saídas ou fechamento na etapa "1. Fluxo de Caixa e Turno".',
      'Consulte ou calcule a divisão de gorjetas na etapa "2. Rateio e Comissões".',
      'Sincronize planilhas ou Urutau.exe na etapa "3. Integração Consumer".'
    ],
    mode: 'internal_buttons',
    subTabs: [
      { id: 'stage_1', slug: 'fluxo-turno', label: '1. Fluxo de Caixa e Turno', shortDesc: 'Saldo atual, lançamentos e fechamento cego', internalButtonMatch: 'Fluxo de Caixa, Tesouraria' },
      { id: 'stage_2', slug: 'rateio-comissoes', label: '2. Rateio e Comissões', shortDesc: 'Divisão justa da taxa de serviço', internalButtonMatch: 'Rateio & Comissões' },
      { id: 'stage_3', slug: 'integracao-consumer', label: '3. Integração Consumer', shortDesc: 'Urutau.exe e importação de planilhas', internalButtonMatch: 'PDV Consumer:' }
    ]
  },
  rateio: {
    title: 'Rateio de 10% (Gorjetas)',
    subtitle: 'Cálculo automático da comissão por função e presença no turno',
    whatItDoes: 'Divide automaticamente a taxa de serviço entre garçons, cozinha e apoio conforme o peso de cada função.',
    steps: [
      'Confira a divisão de comissões e gorjetas na etapa "1. Rateio e Comissões".',
      'Alterne para o fluxo de caixa completo na etapa "2. Fluxo de Caixa".',
      'Use a etapa "3. Integração Consumer" para importar vendas externas.'
    ],
    mode: 'internal_buttons',
    subTabs: [
      { id: 'stage_1', slug: 'comissoes', label: '1. Rateio e Comissões', shortDesc: 'Cálculo imediato por colaborador e pontos', internalButtonMatch: 'Rateio & Comissões' },
      { id: 'stage_2', slug: 'fluxo-caixa', label: '2. Fluxo de Caixa', shortDesc: 'Movimentações e fechamento do dia', internalButtonMatch: 'Fluxo de Caixa, Tesouraria' },
      { id: 'stage_3', slug: 'consumer', label: '3. Integração Consumer', shortDesc: 'Sincronização com Urutau.exe', internalButtonMatch: 'PDV Consumer:' }
    ]
  },
  reservas: {
    title: 'Reservas e Mapa de Mesas',
    subtitle: 'Organização do salão, ocupação ao vivo e reservas agendadas',
    whatItDoes: 'Controle quais mesas estão livres, reservadas ou ocupadas e agende clientes com confirmação rápida.',
    steps: [
      'Toque em qualquer mesa na etapa "1. Mapa do Salão" para mudar o status ou ver detalhes.',
      'Consulte a lista de clientes agendados por data na etapa "2. Lista de Reservas".',
      'Use o botão "+ Nova Reserva" para agendar um cliente em poucos segundos.'
    ],
    mode: 'dom_stages',
    subTabs: [
      { id: 'stage_1', slug: 'mapa-salao', label: '1. Mapa do Salão', shortDesc: 'Planta visual das mesas e ocupação' },
      { id: 'stage_2', slug: 'lista-reservas', label: '2. Lista de Reservas', shortDesc: 'Reservas por dia, semana ou mês' }
    ]
  },
  agenda: {
    title: 'Agenda e Compromissos',
    subtitle: 'Eventos do restaurante, manutenções, reuniões e vencimentos',
    whatItDoes: 'Reúne em um só lugar os compromissos da operação e envia lembretes para a equipe.',
    steps: [
      'Veja os compromissos do dia, semana ou mês na etapa "1. Calendário de Eventos".',
      'Filtre por tipo de compromisso ou cadastre um novo evento em "+ Novo Compromisso".'
    ],
    mode: 'dom_stages',
    subTabs: [
      { id: 'stage_1', slug: 'calendario', label: '1. Calendário de Eventos', shortDesc: 'Compromissos agendados por período' },
      { id: 'stage_2', slug: 'lista-detalhada', label: '2. Lista Detalhada', shortDesc: 'Alertas e responsáveis por evento' }
    ]
  },
  checklists: {
    title: 'Checklists do Turno',
    subtitle: 'Rotinas de abertura, limpeza, cozinha e fechamento',
    whatItDoes: 'Garante que nenhuma tarefa importante de abertura, higiene ou fechamento seja esquecida.',
    steps: [
      'Marque os itens concluídos da rotina na etapa "1. Executar Checklists".',
      'Crie novos checklists ou edite tarefas clicando em "+ Novo Checklist".'
    ],
    mode: 'dom_stages',
    subTabs: [
      { id: 'stage_1', slug: 'executar', label: '1. Executar Checklists', shortDesc: 'Listas de verificação ativas do turno' },
      { id: 'stage_2', slug: 'progresso-equipe', label: '2. Progresso e Equipe', shortDesc: 'Quem executa cada rotina' }
    ]
  },
  cadastros: {
    title: 'Cadastros Unificados',
    subtitle: 'Clientes, colaboradores, fornecedores e parceiros em um único lugar',
    whatItDoes: 'Centraliza todas as pessoas e empresas com quem o restaurante se relaciona.',
    steps: [
      'Pesquise por nome, telefone ou filtre por tipo na etapa "1. Base Geral Unificada".',
      'Navegue para Equipe, Freelancers ou Empresas nas etapas seguintes.',
      'Recupere qualquer cadastro removido na etapa "5. Arquivados".'
    ],
    mode: 'internal_buttons',
    subTabs: [
      { id: 'stage_1', slug: 'base-geral', label: '1. Base Geral Unificada', shortDesc: 'Todos os cadastros com busca rápida', internalButtonMatch: 'Base Geral Unificada' },
      { id: 'stage_2', slug: 'equipe-escalas', label: '2. Equipe e Escalas', shortDesc: 'Colaboradores fixos e permissões', internalButtonMatch: 'Matriz de Permissões & Escalas' },
      { id: 'stage_3', slug: 'freelancers', label: '3. Freelancers', shortDesc: 'Banco de diaristas e contratação', internalButtonMatch: 'Match Diárias Free' },
      { id: 'stage_4', slug: 'empresas', label: '4. Empresas', shortDesc: 'Unidades de negócio e assinaturas', internalButtonMatch: 'Empresas & WhatsApp' },
      { id: 'stage_5', slug: 'arquivados', label: '5. Arquivados', shortDesc: 'Desarquivar registros em 1 clique', internalButtonMatch: 'Arquivados / Desarquivar' }
    ]
  },
  equipe: {
    title: 'Equipe e Colaboradores',
    subtitle: 'Cadastro da equipe fixa, permissões de acesso e vínculos de trabalho',
    whatItDoes: 'Gerencia quem trabalha na empresa, qual função exerce e quais telas pode acessar.',
    steps: [
      'Veja todos os colaboradores ativos na etapa "1. Quadro da Equipe".',
      'Clique em "+ Novo Colaborador" para cadastrar nome, WhatsApp, cargo e senha.',
      'Ajuste vínculos de unidade, setor e permissões diretamente no cartão do colaborador.'
    ],
    mode: 'dom_stages',
    subTabs: [
      { id: 'stage_1', slug: 'quadro-equipe', label: '1. Quadro da Equipe', shortDesc: 'Colaboradores ativos, cargos e acessos' },
      { id: 'stage_2', slug: 'filtros-vinculos', label: '2. Filtros e Vínculos', shortDesc: 'Busca por unidade, setor e função' }
    ]
  },
  cargos: {
    title: 'Cargos e Funções',
    subtitle: 'Salários base, diárias, horários padrão e participação no rateio',
    whatItDoes: 'Padroniza as funções do restaurante para preencher automaticamente horários, salários e rateio.',
    steps: [
      'Consulte os cargos cadastrados e quantos colaboradores estão em cada um na etapa "1. Lista de Cargos".',
      'Crie ou edite um cargo definindo horário padrão e peso de rateio em "+ Novo Cargo".'
    ],
    mode: 'dom_stages',
    subTabs: [
      { id: 'stage_1', slug: 'lista-cargos', label: '1. Lista de Cargos', shortDesc: 'Funções, salários e horários padrão' },
      { id: 'stage_2', slug: 'indicadores', label: '2. Indicadores de Funções', shortDesc: 'Resumo de liderança e operação' }
    ]
  },
  escalas: {
    title: 'Escalas e Presença',
    subtitle: 'Dias de trabalho, folgas da semana, faltas e diárias extras',
    whatItDoes: 'Mostra quem trabalha em cada dia da semana e registra faltas, folgas ou diárias extras.',
    steps: [
      'Veja a grade semanal de trabalho e folgas na etapa "1. Escala da Semana".',
      'Clique em um dia do colaborador para alternar entre Trabalho e Folga Fixa.',
      'Use os botões de ação no topo para registrar falta, atestado ou folga extra.'
    ],
    mode: 'dom_stages',
    subTabs: [
      { id: 'stage_1', slug: 'escala-semana', label: '1. Escala da Semana', shortDesc: 'Quadro semanal de trabalho e folgas' },
      { id: 'stage_2', slug: 'excecoes-historico', label: '2. Exceções e Histórico', shortDesc: 'Faltas, atestados e diárias extras' }
    ]
  },
  freelancers: {
    title: 'Freelancers e Diaristas',
    subtitle: 'Banco de profissionais extras por função, avaliação e contratação rápida',
    whatItDoes: 'Encontra rapidamente garçons, barmans ou cozinheiros extras disponíveis para cobrir turnos.',
    steps: [
      'Filtre por função e valor máximo na etapa "1. Buscar e Chamar (Match)" para contratar em 1 clique.',
      'Veja todos os profissionais cadastrados na etapa "2. Profissionais Cadastrados".'
    ],
    mode: 'dom_stages',
    subTabs: [
      { id: 'stage_1', slug: 'buscar-match', label: '1. Buscar e Chamar (Match)', shortDesc: 'Filtro rápido e contratação via WhatsApp' },
      { id: 'stage_2', slug: 'profissionais', label: '2. Profissionais Cadastrados', shortDesc: 'Cartões de freelancers, notas e PIX' }
    ]
  },
  selecao: {
    title: 'Seleção e Recrutamento',
    subtitle: 'Candidatos, entrevistas e aprovação direta para a equipe',
    whatItDoes: 'Organiza os currículos e candidatos por etapa até a contratação.',
    steps: [
      'Acompanhe os candidatos em análise na etapa "1. Banco de Candidatos".',
      'Quando aprovar alguém, clique em "Contratar" para transformá-lo em colaborador automaticamente.'
    ],
    mode: 'internal_buttons',
    subTabs: [
      { id: 'stage_1', slug: 'candidatos', label: '1. Banco de Candidatos', shortDesc: 'Triagem, entrevista e aprovação', internalButtonMatch: 'Ambiente 2 • Seleção de Colaborador' },
      { id: 'stage_2', slug: 'documentos-rh', label: '2. Documentos de RH', shortDesc: 'Modelos prontos e dossiê da equipe', internalButtonMatch: 'Ambiente 1 • Gestão RH' }
    ]
  },
  rh: {
    title: 'RH, Documentos e NR-01',
    subtitle: 'Advertências, atestados, recibos, dossiê do colaborador e cofre sigiloso',
    whatItDoes: 'Gera documentos prontos de RH em segundos e guarda registros trabalhistas com segurança.',
    steps: [
      'Escolha um modelo pronto (férias, advertência, recibo) na etapa "1. Gerar Documento Rápido".',
      'Consulte a ficha completa de cada pessoa na etapa "2. Dossiê do Colaborador".',
      'Registre ocorrências sigilosas na etapa "3. Prontuários NR-01" ou veja candidatos na etapa "4. Seleção".'
    ],
    mode: 'internal_buttons',
    subTabs: [
      { id: 'stage_1', slug: 'gerar-documento', label: '1. Gerar Documento Rápido', shortDesc: 'Modelos prontos de RH para imprimir', internalButtonMatch: '1. Recursos de RH para Aplicar' },
      { id: 'stage_2', slug: 'dossie-colaborador', label: '2. Dossiê do Colaborador', shortDesc: 'Histórico individual 360° completo', internalButtonMatch: '2. Dossiê 360° por Colaborador' },
      { id: 'stage_3', slug: 'prontuarios-nr01', label: '3. Prontuários NR-01', shortDesc: 'Registros protegidos com criptografia', internalButtonMatch: '3. Prontuários & Histórico LGPD' },
      { id: 'stage_4', slug: 'selecao-vagas', label: '4. Seleção e Vagas', shortDesc: 'Candidatos em processo seletivo', internalButtonMatch: 'Ambiente 2 • Seleção de Colaborador' }
    ]
  },
  estoque: {
    title: 'Estoque e Validades',
    subtitle: 'Controle de insumos, alertas de vencimento e contagem rápida',
    whatItDoes: 'Mostra exatamente o que tem na casa, avisa o que está vencendo ou acabando e gera a compra.',
    steps: [
      'Veja o resumo e alertas de validade na etapa "1. Painel e Alertas".',
      'Consulte os itens e dê entrada ou baixa rápida na etapa "2. Itens em Estoque".',
      'Clique em "+ Novo Insumo" para cadastrar um produto com lote e validade.'
    ],
    mode: 'dom_stages',
    subTabs: [
      { id: 'stage_1', slug: 'painel-alertas', label: '1. Painel e Alertas', shortDesc: 'Resumo de validades e estoque crítico' },
      { id: 'stage_2', slug: 'itens-estoque', label: '2. Itens em Estoque', shortDesc: 'Busca, contagem e baixas rápidas' }
    ]
  },
  compras: {
    title: 'Lista de Compras',
    subtitle: 'Itens em falta, cotação por fornecedor e pedido direto no WhatsApp',
    whatItDoes: 'Monta automaticamente a lista do que precisa ser comprado e envia o pedido para cada fornecedor.',
    steps: [
      'Confira os itens que atingiram o estoque mínimo na etapa "1. Lista para Comprar".',
      'Envie o pedido pronto pelo WhatsApp do fornecedor ou registre a chegada da mercadoria.'
    ],
    mode: 'dom_stages',
    subTabs: [
      { id: 'stage_1', slug: 'lista-comprar', label: '1. Lista para Comprar', shortDesc: 'Insumos abaixo do mínimo ideal' },
      { id: 'stage_2', slug: 'fornecedores-pedidos', label: '2. Fornecedores e Pedidos', shortDesc: 'Cotação e recebimento no estoque' }
    ]
  },
  cmv: {
    title: 'Custos de Pratos (CMV)',
    subtitle: 'Fichas técnicas, custo dos ingredientes e margem de lucro ideal',
    whatItDoes: 'Calcula quanto custa produzir cada prato e mostra se o preço de venda está dando lucro saudável.',
    steps: [
      'Consulte o resumo e lance fichas técnicas na etapa "1. Simulador e Meta CMV".',
      'Veja a tabela de pratos e a evolução diária na etapa "2. Pratos e Histórico".'
    ],
    mode: 'dom_stages',
    subTabs: [
      { id: 'stage_1', slug: 'simulador-meta', label: '1. Simulador e Meta CMV', shortDesc: 'Lançar ficha técnica e ver margem' },
      { id: 'stage_2', slug: 'pratos-historico', label: '2. Pratos e Histórico', shortDesc: 'Tabela de pratos e evolução diária' }
    ]
  },
  unidades: {
    title: 'Unidades e Localização GPS',
    subtitle: 'Endereços das lojas e raio de presença no local',
    whatItDoes: 'Cadastra as unidades da empresa e define o ponto GPS para validar quando a equipe está no local.',
    steps: [
      'Calibre seu GPS atual ou cadastre uma nova filial na etapa "1. Meu GPS e Perímetro".',
      'Veja e edite os cartões das lojas cadastradas na etapa "2. Unidades da Empresa".'
    ],
    mode: 'dom_stages',
    subTabs: [
      { id: 'stage_1', slug: 'gps-perimetro', label: '1. Meu GPS e Perímetro', shortDesc: 'Leitura imediata do GPS e raio ativo' },
      { id: 'stage_2', slug: 'lojas-filiais', label: '2. Unidades da Empresa', shortDesc: 'Cartões das lojas e filiais cadastradas' }
    ]
  },
  setores: {
    title: 'Setores e Praças',
    subtitle: 'Divisão de Salão, Bar, Cozinha, Caixa e pesos de rateio',
    whatItDoes: 'Organiza as áreas de trabalho do restaurante e quem faz parte de cada praça.',
    steps: [
      'Veja e edite os setores (Salão, Cozinha, Bar) na etapa "1. Setores Ativos".',
      'Clique em qualquer setor para vincular colaboradores e checklists.'
    ],
    mode: 'dom_stages',
    subTabs: [
      { id: 'stage_1', slug: 'setores-ativos', label: '1. Setores Ativos', shortDesc: 'Praças de trabalho e peso no rateio' },
      { id: 'stage_2', slug: 'equipe-setor', label: '2. Equipe por Setor', shortDesc: 'Colaboradores e rotinas vinculados' }
    ]
  },
  empresas: {
    title: 'Empresas e Assinaturas',
    subtitle: 'Gestão multi-empresa, licenças de uso, links próprios e backup',
    whatItDoes: 'Gerencia as empresas cadastradas, seus níveis de acesso e a planilha automática no Google Drive.',
    steps: [
      'Veja e gerencie as empresas ativas e suas assinaturas na etapa "1. Empresas Cadastradas".',
      'Configure a planilha automática no Google Drive na etapa "2. Google Drive e Backup".'
    ],
    mode: 'dom_stages',
    subTabs: [
      { id: 'stage_1', slug: 'empresas-cadastradas', label: '1. Empresas Cadastradas', shortDesc: 'Painel de empresas, planos e Urutau.exe' },
      { id: 'stage_2', slug: 'google-drive-backup', label: '2. Google Drive e Backup', shortDesc: 'Sincronização com planilha do empresário' }
    ]
  },
  portais: {
    title: 'Portais e Links Externos',
    subtitle: 'Acessos rápidos para garçom, cozinha, cardápio digital e empresário',
    whatItDoes: 'Centraliza e organiza os portais específicos de cada área da operação.',
    steps: [
      'Consulte os acessos configurados na etapa "1. Portais por Perfil".',
      'Gerencie ou crie portais específicos na etapa "2. Portais Configurados".'
    ],
    mode: 'dom_stages',
    subTabs: [
      { id: 'stage_1', slug: 'links-rapidos', label: '1. Portais por Perfil', shortDesc: 'Acessos e atalhos por perfil' },
      { id: 'stage_2', slug: 'portais-configurados', label: '2. Portais Configurados', shortDesc: 'Portais de cardápio, salão e recepção' }
    ]
  },
  chat: {
    title: 'WhatsApp e Atendimento',
    subtitle: 'Web WhatsApp Comercial para clientes e Bot Interno exclusivo da equipe',
    whatItDoes: 'Separa o atendimento comercial de clientes do Bot interno que conversa com a equipe.',
    steps: [
      'Atenda clientes pelo navegador integrado na etapa "1. WhatsApp Comercial (Clientes)".',
      'Configure o número de avisos e comandos da equipe na etapa "2. Bot Interno da Equipe".'
    ],
    mode: 'internal_buttons',
    subTabs: [
      { id: 'stage_1', slug: 'whatsapp-comercial', label: '1. WhatsApp Comercial', shortDesc: 'QR Code e chat direto com clientes', internalButtonMatch: '1. Navegador Interno — Web WhatsApp Comercial' },
      { id: 'stage_2', slug: 'bot-equipe', label: '2. Bot Interno da Equipe', shortDesc: 'Conexão e simulador exclusivo da equipe', internalButtonMatch: '2. Área de Conexão do Bot Interno' }
    ]
  },
  notificacoes: {
    title: 'Alertas e Lembretes WhatsApp',
    subtitle: 'Disparos programados de checklists, estoque e fechamento',
    whatItDoes: 'Envia lembretes automáticos no WhatsApp nos horários programados para a equipe não esquecer rotinas.',
    steps: [
      'Veja os alertas ativos ou crie um novo disparo na etapa "1. Alertas Programados".',
      'Acompanhe o histórico de envios recentes na etapa "2. Envios em Tempo Real".'
    ],
    mode: 'dom_stages',
    subTabs: [
      { id: 'stage_1', slug: 'alertas-programados', label: '1. Alertas Programados', shortDesc: 'Horários e mensagens automáticas' },
      { id: 'stage_2', slug: 'envios-tempo-real', label: '2. Envios em Tempo Real', shortDesc: 'Registro de alertas disparados' }
    ]
  },
  auditoria: {
    title: 'Central de Logs de Erros e Auditoria',
    subtitle: 'Diagnóstico imediato de erros que aconteceram, desarquivamento e trilha GPS',
    whatItDoes: 'Mostra de forma simples todos os erros que aconteceram no sistema, permite restaurar cadastros arquivados e auditar ações.',
    steps: [
      'Veja qualquer erro de login, conexão ou operação na etapa "1. Logs de Erros e Falhas".',
      'Recupere itens arquivados com 1 clique na etapa "2. Restaurar Arquivados".',
      'Consulte o mapa GPS e o histórico geral de ações na etapa "3. Histórico e Mapa GPS".'
    ],
    mode: 'dom_stages',
    subTabs: [
      { id: 'stage_1', slug: 'erros-falhas', label: '1. Logs de Erros e Falhas', shortDesc: 'Erros recentes do sistema, login e API' },
      { id: 'stage_2', slug: 'restaurar-arquivados', label: '2. Restaurar Arquivados', shortDesc: 'Recuperar cadastros arquivados em 1 clique' },
      { id: 'stage_3', slug: 'historico-gps', label: '3. Histórico e Mapa GPS', shortDesc: 'Trilha completa de cliques e localização' }
    ]
  },
  permissoes: {
    title: 'Permissões de Acesso',
    subtitle: 'Controle simples do que cada cargo ou pessoa pode ver e editar',
    whatItDoes: 'Define de forma visual quais módulos cada colaborador pode abrir ou alterar.',
    steps: [
      'Selecione o colaborador e marque o que ele pode ver ou editar na etapa "1. Acessos por Pessoa".',
      'Altere a senha mestra ou tempo de bloqueio na etapa "2. Senha e Segurança".'
    ],
    mode: 'dom_stages',
    subTabs: [
      { id: 'stage_1', slug: 'acessos-pessoa', label: '1. Acessos por Pessoa', shortDesc: 'Liberar ou bloquear telas por usuário' },
      { id: 'stage_2', slug: 'senha-seguranca', label: '2. Senha e Segurança', shortDesc: 'Senha mestra e bloqueio automático' }
    ]
  },
  config: {
    title: 'Ajustes, Menus, Logs e Governança',
    subtitle: 'Identidade da marca, hub de edição dos menus, trilha de logs de auditoria e restauração de backup',
    whatItDoes: 'Personaliza cores, logotipo, brilho noturno e menus da empresa, além de centralizar os logs de auditoria, desarquivamento e cópias de segurança.',
    steps: [
      'Ajuste cores, brilho noturno, logotipo e edite menus e separadores na etapa "1. Identidade, Cores e Menus".',
      'Consulte a trilha de auditoria, desarquive registros e gerencie backups na etapa "2. Logs, Auditoria e Governança".'
    ],
    mode: 'dom_stages',
    subTabs: [
      { id: 'stage_1', slug: 'visual-marca', label: '1. Identidade, Cores e Menus', shortDesc: 'Cores, luminosidade noturna, marca e hub de menus' },
      { id: 'stage_2', slug: 'logs-auditoria', label: '2. Logs, Auditoria e Governança', shortDesc: 'Trilha de segurança, desarquivamento e backups' }
    ]
  },
  servidor_ia: {
    title: 'Governança e Segurança',
    subtitle: 'Blindagem Zero-Trust e restauração de backups',
    whatItDoes: 'Gerencia cópias de segurança e blindagem do banco de dados.',
    steps: ['Acesse em Ajustes > Logs, Auditoria e Governança.'],
    mode: 'dom_stages',
    subTabs: [
      { id: 'stage_1', slug: 'blindagem-backups', label: '1. Blindagem e Backups', shortDesc: 'Auditoria Zero-Trust e cópias seguras' }
    ]
  },
  modulos: {
    title: 'Atalhos Operacionais',
    subtitle: 'Navegação direta pelos módulos da empresa',
    whatItDoes: 'Acesse qualquer módulo diretamente pelo menu lateral.',
    steps: ['Selecione o módulo desejado no menu lateral.'],
    mode: 'dom_stages',
    subTabs: [
      { id: 'stage_1', slug: 'mapa-links', label: '1. Módulos', shortDesc: 'Menus do sistema' }
    ]
  }
};

interface CleanModuleShellProps {
  activeTab: TabId;
  customLabel?: string;
  companySubdomain?: string;
  initialSubTabSlug?: string | null;
  onSubTabChange?: (subTabSlug: string, stageIndex: number) => void;
  tabOverrides?: Record<string, CustomTabOverride>;
  children: React.ReactNode;
}

export const CleanModuleShell: React.FC<CleanModuleShellProps> = ({
  activeTab,
  customLabel,
  initialSubTabSlug,
  onSubTabChange,
  tabOverrides,
  children
}) => {
  const activeMenuTheme = useMemo(
    () => getMenuColorTheme(activeTab, tabOverrides),
    [activeTab, tabOverrides]
  );
  const guide = MODULE_CLEAN_GUIDES[activeTab] || {
    title: customLabel || activeTab,
    subtitle: 'Gestão simplificada por etapas',
    whatItDoes: 'Navegue pelas sub-abas acima para acessar cada etapa com a tela limpa.',
    steps: ['Selecione a etapa desejada nas sub-abas do topo.'],
    mode: 'dom_stages' as const,
    subTabs: [
      { id: 'stage_1', slug: 'principal', label: '1. Visão Principal', shortDesc: 'Operação principal' },
      { id: 'stage_2', slug: 'detalhes', label: '2. Detalhes e Ajustes', shortDesc: 'Complementos do módulo' }
    ]
  };

  const [selectedStageIndex, setSelectedStageIndex] = useState<number>(0);
  const [showAllStages, setShowAllStages] = useState<boolean>(false);
  const [helpOpen, setHelpOpen] = useState<boolean>(false);
  const [showDetailedDescriptions, setShowDetailedDescriptions] = useState<boolean>(false);
  const [detectedSectionCount, setDetectedSectionCount] = useState<number>(1);
  const contentContainerRef = useRef<HTMLDivElement | null>(null);

  const triggerInternalButtonForStage = (idx: number) => {
    const targetSub = guide.subTabs[idx];
    if (guide.mode === 'internal_buttons' && targetSub?.internalButtonMatch && contentContainerRef.current) {
      const buttons = Array.from(
        contentContainerRef.current.querySelectorAll('button')
      ) as HTMLButtonElement[];
      const matchLower = targetSub.internalButtonMatch.toLowerCase();
      const targetBtn = buttons.find((btn) =>
        (btn.textContent || '').toLowerCase().includes(matchLower)
      );
      if (targetBtn) {
        targetBtn.click();
      }
    }
  };

  useEffect(() => {
    setShowAllStages(false);
    setHelpOpen(false);
    let nextIdx = 0;
    if (initialSubTabSlug) {
      const foundIdx = guide.subTabs.findIndex(
        (s) => s.slug.toLowerCase() === initialSubTabSlug.toLowerCase() || s.id.toLowerCase() === initialSubTabSlug.toLowerCase()
      );
      if (foundIdx >= 0) {
        nextIdx = foundIdx;
      }
    }
    setSelectedStageIndex(nextIdx);
    const timer = window.setTimeout(() => {
      triggerInternalButtonForStage(nextIdx);
    }, 60);
    return () => window.clearTimeout(timer);
  }, [activeTab, initialSubTabSlug]);

  const handleSelectStage = (idx: number) => {
    setShowAllStages(false);
    setSelectedStageIndex(idx);
    triggerInternalButtonForStage(idx);
    const targetSub = guide.subTabs[idx] || guide.subTabs[0];
    if (targetSub && onSubTabChange) {
      onSubTabChange(targetSub.slug, idx);
    }
    try {
      const nextPath = `/${activeTab}/${targetSub?.slug || 'principal'}`;
      if (window.location.pathname !== nextPath) {
        window.history.replaceState({}, '', `${nextPath}${window.location.search}`);
      }
    } catch {}
  };

  const showTopSubTabs = (activeTab === 'home' || activeTab === 'config') && guide.subTabs.length > 1;

  useEffect(() => {
    const root = contentContainerRef.current;
    if (!root) return;

    const applyProgressivePartitioning = () => {
      const moduleWrapper = root.firstElementChild as HTMLElement | null;
      if (!moduleWrapper) return;

      if (!showTopSubTabs || guide.mode === 'internal_buttons') {
        const allChildren = Array.from(moduleWrapper.children) as HTMLElement[];
        allChildren.forEach((el) => {
          el.style.removeProperty('display');
        });
        setDetectedSectionCount(1);
        return;
      }

      const explicitStagedNodes = Array.from(
        moduleWrapper.querySelectorAll(':scope > [data-clean-stage]')
      ) as HTMLElement[];

      if (explicitStagedNodes.length > 0) {
        setDetectedSectionCount(explicitStagedNodes.length);
        explicitStagedNodes.forEach((node) => {
          if (showAllStages) {
            node.style.removeProperty('display');
            return;
          }
          const stageAttr = Number(node.getAttribute('data-clean-stage') || '0');
          if (stageAttr === selectedStageIndex) {
            node.style.removeProperty('display');
          } else {
            node.style.display = 'none';
          }
        });
        return;
      }

      const allChildren = Array.from(moduleWrapper.children) as HTMLElement[];
      allChildren.forEach((el) => {
        el.style.removeProperty('display');
      });
      setDetectedSectionCount(1);
    };

    applyProgressivePartitioning();

    const observer = new MutationObserver(() => {
      applyProgressivePartitioning();
    });

    observer.observe(root, { childList: true, subtree: false });
    return () => observer.disconnect();
  }, [activeTab, selectedStageIndex, showAllStages, showTopSubTabs, guide.mode, guide.subTabs.length]);

  const activeSubTabMeta = guide.subTabs[selectedStageIndex] || guide.subTabs[0];

  return (
    <div
      className={`w-full max-w-full overflow-x-hidden space-y-4 ${
        showDetailedDescriptions ? 'urutau-show-all-legends' : 'urutau-clean-mode'
      }`}
    >
      <div className="bg-[#12161F] border border-slate-800 rounded-xl overflow-hidden flex flex-col max-w-full">
        <div className="px-4 py-3 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-semibold text-slate-100 tracking-tight truncate">
                  {customLabel || guide.title}
                </h1>
                <span className="hidden md:inline-block text-slate-600" aria-hidden="true">·</span>
                <span className="hidden md:inline-block text-xs text-slate-400 truncate max-w-md">
                  {showTopSubTabs && activeSubTabMeta ? activeSubTabMeta.shortDesc : guide.subtitle}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setHelpOpen((prev) => !prev)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors min-h-[36px] ${
                  helpOpen
                    ? 'bg-[#181D28] border-slate-600 text-white'
                    : 'bg-[#0E1117] border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                }`}
                title="Como usar esta tela passo a passo"
              >
                <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Como usar</span>
              </button>
            </div>
          </div>

          {showTopSubTabs && (
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-stretch gap-1 p-1 rounded-lg bg-[#0E1117] border border-slate-800 w-full max-w-full">
              {guide.subTabs.map((sub, idx) => {
                const isSelected = !showAllStages && selectedStageIndex === idx;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => handleSelectStage(idx)}
                    title={sub.shortDesc}
                    className={`w-full sm:w-auto min-h-[36px] px-3 py-1.5 rounded-md text-xs font-medium flex items-center justify-center text-center leading-tight cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#181D28] text-white border border-slate-700'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className="line-clamp-2 sm:whitespace-nowrap">{sub.label}</span>
                  </button>
                );
              })}

              {guide.mode === 'dom_stages' && detectedSectionCount > 1 && (
                <button
                  type="button"
                  onClick={() => setShowAllStages((prev) => !prev)}
                  title="Ver todas as seções desta tela na mesma página"
                  className={`w-full sm:w-auto min-h-[36px] px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                    showAllStages
                      ? 'bg-[#181D28] text-white border border-slate-700'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span>Tudo</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {helpOpen && (
        <div
          className="bg-[#112229] border rounded-xl p-4 shadow-xl space-y-3 animate-fadeIn"
          style={{ borderColor: `rgba(${activeMenuTheme.rgb}, 0.45)` }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div
                className="text-xs font-bold flex items-center gap-1.5"
                style={{ color: activeMenuTheme.hex }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Guia Rápido — {guide.title}</span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">{guide.whatItDoes}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowDetailedDescriptions((prev) => !prev)}
                className="px-2.5 py-1 rounded-lg bg-[#081115] hover:bg-white/[0.06] border border-white/10 text-[11px] font-medium text-slate-300 inline-flex items-center gap-1.5 cursor-pointer"
                title="Mostrar ou recolher textos explicativos secundários da tela"
              >
                {showDetailedDescriptions ? (
                  <>
                    <EyeOff className="w-3 h-3 text-amber-400" />
                    <span>Ocultar legendas longas</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3 h-3" style={{ color: activeMenuTheme.hex }} />
                    <span>Mostrar legendas técnicas</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
                aria-label="Fechar guia"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
            {guide.steps.map((stepText, idx) => (
              <div
                key={idx}
                onClick={() => {
                  if (idx < guide.subTabs.length) {
                    handleSelectStage(idx);
                  }
                }}
                className="p-3 rounded-lg bg-[#081115] border flex items-start gap-2.5 cursor-pointer transition-colors"
                style={{ borderColor: `rgba(${activeMenuTheme.rgb}, 0.28)` }}
              >
                <span
                  className="w-5 h-5 rounded-full font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5"
                  style={activeMenuTheme.badgeStyle}
                >
                  {idx + 1}
                </span>
                <div className="space-y-1 min-w-0">
                  <p className="text-xs text-slate-200 leading-snug">{stepText}</p>
                  {idx < guide.subTabs.length && (
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-semibold"
                      style={{ color: activeMenuTheme.hex }}
                    >
                      <span>Ir para {guide.subTabs[idx].label}</span>
                      <ChevronRight className="w-3 h-3" />
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div ref={contentContainerRef} className="w-full max-w-full overflow-x-hidden">
        {children}
      </div>
    </div>
  );
};

export const HomeDashboardHub: React.FC<{
  data: any;
  currentUser: any;
  companyName: string;
  companySubdomain: string;
  tabOverrides?: Record<string, CustomTabOverride>;
  onNavigateTab: (tab: TabId, subTabSlug?: string) => void;
  alertasPanel?: React.ReactNode;
}> = ({ data, currentUser, companyName, tabOverrides, onNavigateTab, alertasPanel }) => {
  const resumo = useMemo(() => {
    const caixaLista = Array.isArray(data?.caixa) ? data.caixa : [];
    let entradas = 0;
    let saidas = 0;
    for (const item of caixaLista) {
      const val = Number(item?.valor || 0);
      const tipo = String(item?.tipo || '').toLowerCase();
      if (tipo.includes('saida') || tipo.includes('saída') || tipo.includes('despesa') || tipo.includes('sangria')) {
        saidas += val;
      } else {
        entradas += val;
      }
    }
    const saldoCaixa = entradas - saidas;

    const reservasLista = Array.isArray(data?.reservas) ? data.reservas : [];
    const reservasConfirmadas = reservasLista.filter((r: any) =>
      String(r?.status || '').toLowerCase().includes('confirm')
    );
    const totalPaxReservas = reservasLista.reduce((acc: number, r: any) => {
      const pax =
        Number(r?.pessoas || 0) ||
        Number(r?.adultos_pagantes || 0) +
          Number(r?.adultos_frequentadores || 0) +
          Number(r?.criancas_pagantes || 0) +
          Number(r?.criancas_frequentadores || 0);
      return acc + (pax > 0 ? pax : 2);
    }, 0);

    const estoqueLista = Array.isArray(data?.estoque) ? data.estoque : [];
    const estoqueCritico = estoqueLista.filter(
      (it: any) => Number(it?.qtd || 0) <= Number(it?.min || 5)
    );

    const usuariosAtivos = Array.isArray(data?.usuarios) ? data.usuarios.length : 0;
    const freelancersAtivos = Array.isArray(data?.freelancers) ? data.freelancers.length : 0;
    const cadastrosTotal = Array.isArray(data?.cadastrosPessoas) ? data.cadastrosPessoas.length : 0;
    const checklistsLista = Array.isArray(data?.checklists) ? data.checklists : [];

    const auditLista = Array.isArray(data?.auditLogs) ? data.auditLogs : [];
    const alertasRecentes = auditLista.filter((l: any) => {
      const txt = `${l?.acao || ''} ${l?.detalhes || ''}`.toUpperCase();
      return txt.includes('ERRO') || txt.includes('FALHA') || txt.includes('BLOQUEIO') || txt.includes('NEGADO');
    });

    return {
      entradas,
      saidas,
      saldoCaixa,
      caixaRecentes: caixaLista.slice(0, 5),
      totalReservas: reservasLista.length,
      reservasConfirmadas: reservasConfirmadas.length,
      totalPaxReservas,
      proximasReservas: reservasLista.slice(0, 5),
      totalEstoque: estoqueLista.length,
      estoqueCritico,
      usuariosAtivos,
      freelancersAtivos,
      cadastrosTotal,
      checklistsCount: checklistsLista.length,
      ultimosLogs: auditLista.slice(0, 8),
      alertasCount: alertasRecentes.length
    };
  }, [data]);

  const formatBRL = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const pdvTheme = getMenuColorTheme('pdv', tabOverrides);
  const reservasTheme = getMenuColorTheme('reservas', tabOverrides);
  const caixaTheme = getMenuColorTheme('caixa', tabOverrides);
  const cadastrosTheme = getMenuColorTheme('cadastros', tabOverrides);
  const estoqueTheme = getMenuColorTheme('estoque', tabOverrides);
  const rateioTheme = getMenuColorTheme('rateio', tabOverrides);
  const comprasTheme = getMenuColorTheme('compras', tabOverrides);
  const auditoriaTheme = getMenuColorTheme('auditoria', tabOverrides);

  return (
    <div className="space-y-5 w-full">
      <div data-clean-stage="0" className="space-y-5">
        <div className="bg-[#12161F] border border-slate-800 rounded-xl">
          <div className="p-4 sm:p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="shrink-0 hidden sm:flex flex-col items-center">
                <UrutauEmblemSVG
                  pose="sentinel"
                  className="w-12 h-12"
                />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="text-xs text-slate-400">
                  <span>Painel Central</span>
                  <span className="mx-1.5 text-slate-600" aria-hidden="true">·</span>
                  <span>{companyName || 'Empresa Ativa'}</span>
                </div>
                <h2 className="text-base sm:text-lg font-semibold text-white">
                  Olá, {currentUser?.nome || 'Operador'} ({currentUser?.cargo || currentUser?.tipo || 'Gestão'})
                </h2>
                <p className="text-xs text-slate-400">
                  Resumo operacional consolidado do turno atual.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onNavigateTab('pdv', 'mesas-comandas')}
                className="px-4 py-2 rounded-lg text-xs font-semibold min-h-[38px] cursor-pointer transition-colors bg-[#10B981] hover:bg-[#34D399] text-[#061014] whitespace-nowrap"
              >
                Abrir {pdvTheme.label}
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('quadro_branco')}
                className="px-3.5 py-2 rounded-lg border border-slate-700 bg-[#181D28] hover:bg-slate-800 text-slate-100 text-xs font-medium min-h-[38px] cursor-pointer transition-colors whitespace-nowrap"
              >
                Quadro Branco
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('reservas', 'mapa-salao')}
                className="px-3.5 py-2 rounded-lg border border-slate-700 bg-[#181D28] hover:bg-slate-800 text-slate-100 text-xs font-medium min-h-[38px] cursor-pointer transition-colors whitespace-nowrap"
              >
                Mapa de {reservasTheme.label}
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('caixa', 'fluxo-turno')}
                className="px-3.5 py-2 rounded-lg border border-slate-700 bg-[#181D28] hover:bg-slate-800 text-slate-100 text-xs font-medium min-h-[38px] cursor-pointer transition-colors whitespace-nowrap"
              >
                Fluxo de {caixaTheme.label}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
          <button
            type="button"
            onClick={() => onNavigateTab('caixa', 'fluxo-turno')}
            className="p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 hover:brightness-110"
            style={caixaTheme.cardBoxStyle}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: caixaTheme.hex }}
                />
                <span>Saldo Líquido em {caixaTheme.label}</span>
              </span>
              <span
                className="px-2 py-0.5 rounded border text-[10px] font-mono font-bold"
                style={caixaTheme.badgeStyle}
              >
                {caixaTheme.label}
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-mono font-black text-white tabular-nums">
                {formatBRL(resumo.saldoCaixa)}
              </div>
              <div className="text-[11px] font-mono text-slate-300 mt-1 flex items-center justify-between">
                <span style={{ color: caixaTheme.hex }}>Entradas: {formatBRL(resumo.entradas)}</span>
                <span className="text-rose-400">Saídas: {formatBRL(resumo.saidas)}</span>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('reservas', 'mapa-salao')}
            className="p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 hover:brightness-110"
            style={reservasTheme.cardBoxStyle}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: reservasTheme.hex }}
                />
                <span>{reservasTheme.label} & Salão</span>
              </span>
              <span
                className="px-2 py-0.5 rounded border text-[10px] font-mono font-bold"
                style={reservasTheme.badgeStyle}
              >
                {resumo.reservasConfirmadas} Confirmadas
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-mono font-black text-white tabular-nums">
                {resumo.totalReservas} Mesas • {resumo.totalPaxReservas} Pax
              </div>
              <div className="text-[11px] mt-1 font-medium" style={{ color: reservasTheme.hex }}>
                Toque para abrir {reservasTheme.label} e planta do salão
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('estoque', 'posicao-estoque')}
            className="p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 hover:brightness-110"
            style={estoqueTheme.cardBoxStyle}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: estoqueTheme.hex }}
                />
                <span>{estoqueTheme.label} & Insumos</span>
              </span>
              <span
                className="px-2 py-0.5 rounded border text-[10px] font-mono font-bold"
                style={
                  resumo.estoqueCritico.length > 0
                    ? {
                        backgroundColor: 'rgba(244, 63, 94, 0.2)',
                        color: '#FDA4AF',
                        borderColor: 'rgba(244, 63, 94, 0.45)'
                      }
                    : estoqueTheme.badgeStyle
                }
              >
                {resumo.estoqueCritico.length > 0
                  ? `${resumo.estoqueCritico.length} em Alerta`
                  : `${estoqueTheme.label} Saudável`}
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-mono font-black text-white tabular-nums">
                {resumo.totalEstoque} Itens Ativos
              </div>
              <div className="text-[11px] mt-1" style={{ color: estoqueTheme.hex }}>
                {resumo.estoqueCritico.length > 0
                  ? `${resumo.estoqueCritico.length} insumo(s) abaixo do mínimo recomendado`
                  : 'Todos os itens acima do estoque mínimo'}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('cadastros', 'base-geral')}
            className="p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 hover:brightness-110"
            style={cadastrosTheme.cardBoxStyle}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: cadastrosTheme.hex }}
                />
                <span>Equipe & {cadastrosTheme.label}</span>
              </span>
              <span
                className="px-2 py-0.5 rounded border text-[10px] font-mono font-bold"
                style={cadastrosTheme.badgeStyle}
              >
                Base Unificada
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-mono font-black text-white tabular-nums">
                {resumo.usuariosAtivos} Equipe • {resumo.freelancersAtivos} Free
              </div>
              <div className="text-[11px] mt-1" style={{ color: cadastrosTheme.hex }}>
                {resumo.cadastrosTotal} cadastros gerais • {resumo.checklistsCount} checklists ativos
              </div>
            </div>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div
            className="bg-[#112229] border rounded-xl p-4 space-y-3 flex flex-col justify-between"
            style={caixaTheme.cardBoxStyle}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <h3
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: caixaTheme.hex }}
                >
                  Últimos Lançamentos • {caixaTheme.label}
                </h3>
                <button
                  type="button"
                  onClick={() => onNavigateTab('caixa', 'fluxo-turno')}
                  className="px-2 py-0.5 rounded border text-[11px] font-bold cursor-pointer"
                  style={caixaTheme.badgeStyle}
                >
                  Abrir {caixaTheme.label}
                </button>
              </div>
              {resumo.caixaRecentes.length === 0 ? (
                <div className="p-3 rounded-lg bg-[#081115] text-xs text-slate-400">
                  Nenhuma movimentação registrada hoje.
                </div>
              ) : (
                <div className="space-y-2">
                  {resumo.caixaRecentes.map((c: any) => {
                    const isSaida =
                      String(c?.tipo || '').toLowerCase().includes('sai') ||
                      String(c?.tipo || '').toLowerCase().includes('desp');
                    return (
                      <div
                        key={c.id}
                        className="p-2.5 rounded-lg bg-[#081115] border border-white/5 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-white truncate">
                            {c.descricao || c.categoria || 'Movimento de Caixa'}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {c.forma_pagamento || c.tipo || 'Operação'}
                          </div>
                        </div>
                        <span
                          className={`font-mono font-bold shrink-0 tabular-nums ${
                            isSaida ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {isSaida ? '-' : '+'}
                          {formatBRL(Number(c.valor || 0))}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('rateio', 'comissoes')}
              className="w-full py-2 px-3 rounded-lg border text-xs font-bold cursor-pointer transition-all"
              style={rateioTheme.softBtnStyle}
            >
              Ver {rateioTheme.label} e Comissões
            </button>
          </div>

          <div
            className="bg-[#112229] border rounded-xl p-4 space-y-3 flex flex-col justify-between"
            style={reservasTheme.cardBoxStyle}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <h3
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: reservasTheme.hex }}
                >
                  {reservasTheme.label} e Ocupação de Mesas
                </h3>
                <button
                  type="button"
                  onClick={() => onNavigateTab('reservas', 'lista-reservas')}
                  className="px-2 py-0.5 rounded border text-[11px] font-bold cursor-pointer"
                  style={reservasTheme.badgeStyle}
                >
                  Abrir {reservasTheme.label}
                </button>
              </div>
              {resumo.proximasReservas.length === 0 ? (
                <div className="p-3 rounded-lg bg-[#081115] text-xs text-slate-400">
                  Nenhuma reserva cadastrada para o período.
                </div>
              ) : (
                <div className="space-y-2">
                  {resumo.proximasReservas.map((r: any) => (
                    <div
                      key={r.id}
                      className="p-2.5 rounded-lg bg-[#081115] border border-white/5 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-white truncate">
                          {r.cliente || 'Cliente'} • {r.area || `Mesa ${r.id}`}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {r.horario || '19:30'} • {r.status || 'Confirmada'}
                        </div>
                      </div>
                      <span
                        className="px-2 py-0.5 rounded border font-mono font-bold text-[11px] shrink-0"
                        style={reservasTheme.badgeStyle}
                      >
                        {r.pessoas || 4} pax
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('reservas', 'mapa-salao')}
              className="w-full py-2 px-3 rounded-lg border text-xs font-black cursor-pointer transition-all"
              style={reservasTheme.solidBtnStyle}
            >
              Abrir Mapa de {reservasTheme.label}
            </button>
          </div>

          <div
            className="bg-[#112229] border rounded-xl p-4 space-y-3 flex flex-col justify-between"
            style={estoqueTheme.cardBoxStyle}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <h3
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: estoqueTheme.hex }}
                >
                  Reposição de {estoqueTheme.label} & Alertas
                </h3>
                <button
                  type="button"
                  onClick={() => onNavigateTab('compras', 'sugestao-compras')}
                  className="px-2 py-0.5 rounded border text-[11px] font-bold cursor-pointer"
                  style={comprasTheme.badgeStyle}
                >
                  {comprasTheme.label}
                </button>
              </div>
              {resumo.estoqueCritico.length === 0 ? (
                <div className="p-3 rounded-lg bg-[#081115] text-xs text-emerald-300">
                  Nenhum insumo abaixo do estoque mínimo no momento.
                </div>
              ) : (
                <div className="space-y-2">
                  {resumo.estoqueCritico.slice(0, 5).map((it: any) => (
                    <div
                      key={it.id}
                      className="p-2.5 rounded-lg bg-[#081115] border border-rose-500/30 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-white truncate">{it.insumo}</div>
                        <div className="text-[10px] text-slate-400">
                          Mínimo: {it.min} {it.unidade || 'un'}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono font-bold text-[11px] shrink-0">
                        Atual: {it.qtd} {it.unidade || 'un'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('home', 'alertas-lembretes')}
              className="w-full py-2 px-3 rounded-lg border text-xs font-bold cursor-pointer transition-all"
              style={auditoriaTheme.softBtnStyle}
            >
              Alertas & Lembretes ({resumo.alertasCount} alertas)
            </button>
          </div>
        </div>

      </div>

      <div data-clean-stage="1" className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              grupo: '1. Salão, Atendimento e Operação',
              anchorTab: 'pdv' as TabId,
              itens: [
                { tab: 'pdv' as TabId, sub: 'mesas-comandas', titulo: 'PDV, Mesas e Comandas', desc: 'Pedidos no salão, balcão, delivery e impressão térmica' },
                { tab: 'checklists' as TabId, sub: 'executar', titulo: 'Checklists de Rotina', desc: 'Conferência de abertura, limpeza e fechamento' },
                { tab: 'chat' as TabId, sub: 'conversas-ativas', titulo: 'Chat WhatsApp & Bot IA', desc: 'Atendimento automático e conversas em tempo real' },
                { tab: 'reservas' as TabId, sub: 'mapa-salao', titulo: 'Reservas e Mapa do Salão', desc: 'Ocupação ao vivo das mesas e agendamentos de clientes' }
              ]
            },
            {
              grupo: '2. Financeiro, Caixa e Estoque',
              anchorTab: 'caixa' as TabId,
              itens: [
                { tab: 'caixa' as TabId, sub: 'fluxo-turno', titulo: 'Caixa e Fechamento de Turno', desc: 'Entradas, saídas, sangrias e conferência de turno' },
                { tab: 'estoque' as TabId, sub: 'posicao-estoque', titulo: 'Estoque e Kardex', desc: 'Controle de insumos, validade e movimentações' },
                { tab: 'cmv' as TabId, sub: 'fichas-tecnicas', titulo: 'CMV e Fichas Técnicas', desc: 'Custo por prato, margem de lucro e engenharia de cardápio' },
                { tab: 'portais' as TabId, sub: 'visor-portais', titulo: 'Portais de Delivery e Reservas', desc: 'Acesso simultâneo a portais externos integrados' }
              ]
            },
            {
              grupo: '3. RH, Cadastros e Escalas',
              anchorTab: 'rh' as TabId,
              itens: [
                { tab: 'rh' as TabId, sub: 'folha-holerite', titulo: 'RH, Ponto GPS e Folha', desc: 'Ponto com cerca geográfica, holerites e seleção de vagas' },
                { tab: 'cadastros' as TabId, sub: 'base-geral', titulo: 'Cadastros Unificados', desc: 'Colaboradores, gestores, freelancers, clientes e fornecedores' },
                { tab: 'escalas' as TabId, sub: 'escala-semanal', titulo: 'Escalas e Folgas', desc: 'Grade semanal de turnos e cobertura de folgas' },
                { tab: 'agenda' as TabId, sub: 'calendario', titulo: 'Agenda Operacional', desc: 'Compromissos, tarefas e cronograma da equipe' }
              ]
            },
            {
              grupo: '4. Estrutura e Administração',
              anchorTab: 'config' as TabId,
              itens: [
                { tab: 'equipe' as TabId, sub: 'quadro-equipe', titulo: 'Equipe e Colaboradores', desc: 'Quadro ativo de colaboradores e funções' },
                { tab: 'unidades' as TabId, sub: 'unidades', titulo: 'Unidades e Setores', desc: 'Lojas, filiais, setores e cargos operacionais' },
                { tab: 'permissoes' as TabId, sub: 'matriz-acessos', titulo: 'Acessos e Permissões', desc: 'Controle do que cada colaborador pode ver ou editar' },
                { tab: 'config' as TabId, sub: 'visual-marca', titulo: 'Ajustes, Menus e Logs', desc: 'Personalização de cores, menus, auditoria e backup' }
              ]
            }
          ].map((bloco) => {
            const groupTheme = getMenuColorTheme(bloco.anchorTab, tabOverrides);
            return (
              <div
                key={bloco.grupo}
                className="bg-[#112229] border rounded-xl p-4 space-y-3"
                style={{ borderColor: `rgba(${groupTheme.rgb}, 0.35)` }}
              >
                <h3 className="text-xs font-bold uppercase tracking-wider text-white border-b border-white/10 pb-2">
                  {bloco.grupo}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {bloco.itens.map((it) => {
                    const itemTheme = getMenuColorTheme(it.tab, tabOverrides);
                    return (
                      <button
                        key={`${it.tab}-${it.sub}`}
                        type="button"
                        onClick={() => onNavigateTab(it.tab, it.sub)}
                        className="p-3 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 hover:brightness-110"
                        style={itemTheme.cardBoxStyle}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-xs font-bold text-white flex items-center gap-1.5">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: itemTheme.hex }}
                              />
                              <span>{itemTheme.label || it.titulo}</span>
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-300 mt-1 leading-snug">{it.desc}</div>
                        </div>
                        <div
                          className="text-[10px] font-mono font-bold flex items-center justify-between pt-1"
                          style={{ color: itemTheme.hex }}
                        >
                          <span>Abrir {itemTheme.label}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div data-clean-stage="2" className="space-y-6">
        {alertasPanel}
        <div
          className="bg-[#112229] border rounded-xl p-4 sm:p-5 space-y-3"
          style={auditoriaTheme.cardBoxStyle}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white">
                Últimas Atividades Registradas na Empresa
              </h3>
              <p className="text-xs text-slate-300">
                Histórico recente de ações dos operadores e eventos automáticos do sistema.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('config', 'logs-auditoria')}
              className="px-3.5 py-2 rounded-lg border text-xs font-black cursor-pointer"
              style={auditoriaTheme.solidBtnStyle}
            >
              Ver Logs Completos em Ajustes
            </button>
          </div>

          <div className="divide-y divide-white/10">
            {resumo.ultimosLogs.length === 0 ? (
              <div className="p-4 text-xs text-slate-400">
                Nenhuma atividade recente registrada.
              </div>
            ) : (
              resumo.ultimosLogs.map((log: any) => (
                <div
                  key={log.id}
                  className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{log.usuario || 'Sistema'}</span>
                      <span className="px-2 py-0.5 rounded bg-white/5 text-[#10B981] font-mono text-[10px]">
                        {log.acao}
                      </span>
                    </div>
                    <div className="text-slate-300 truncate">{log.detalhes}</div>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 shrink-0">
                    {log.criado_em ? new Date(log.criado_em).toLocaleString('pt-BR') : ''}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

