import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  HelpCircle,
  Layers,
  Sparkles,
  X,
  ChevronRight,
  Eye,
  EyeOff,
  Copy,
  Check,
  ExternalLink,
  Link2,
  Search
} from 'lucide-react';
import { DEFAULT_CATEGORIES, DEFAULT_TAB_META, NavCategory, TabId } from '../types/erp';

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
    title: 'Início • Dashboard Operacional',
    subtitle: 'Resumo executivo do dia, indicadores em tempo real e atalhos rápidos',
    whatItDoes: 'Reúne os principais números de caixa, salão, reservas, estoque e equipe em uma visão limpa e direta.',
    steps: [
      'Acompanhe o saldo do caixa, reservas do dia e alertas de estoque na etapa "1. Visão Geral".',
      'Acesse qualquer área do sistema com 1 toque na etapa "2. Atalhos Rápidos".',
      'Consulte as últimas movimentações e alertas na etapa "3. Atividade Recente".'
    ],
    mode: 'dom_stages',
    subTabs: [
      { id: 'stage_1', slug: 'visao-geral', label: '1. Visão Geral', shortDesc: 'Indicadores do dia, caixa, reservas e estoque' },
      { id: 'stage_2', slug: 'atalhos-setor', label: '2. Atalhos Rápidos', shortDesc: 'Acesso direto aos módulos operacionais' },
      { id: 'stage_3', slug: 'atividade-alertas', label: '3. Atividade Recente', shortDesc: 'Últimos registros e alertas do sistema' }
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
    subtitle: 'Endereços rápidos para garçom, cozinha, cardápio digital e empresário',
    whatItDoes: 'Cria e compartilha links diretos para cada área da operação abrir direto na tela certa.',
    steps: [
      'Copie ou abra os links prontos (.nyctibi.us) na etapa "1. Links Rápidos da Empresa".',
      'Gerencie ou crie portais específicos na etapa "2. Portais Configurados".'
    ],
    mode: 'dom_stages',
    subTabs: [
      { id: 'stage_1', slug: 'links-rapidos', label: '1. Links Rápidos da Empresa', shortDesc: 'Subdomínios e atalhos por perfil' },
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
    title: 'Aparência e Configurações',
    subtitle: 'Cores da sua marca, logotipo, brilho da tela, sons e organização do menu',
    whatItDoes: 'Personaliza o visual do sistema com o nome, logotipo e cores da sua empresa.',
    steps: [
      'Ajuste cores, brilho e logotipo da empresa na etapa "1. Visual e Marca".',
      'Organize a ordem do menu ou sons do sistema na etapa "2. Menu e Preferências".'
    ],
    mode: 'dom_stages',
    subTabs: [
      { id: 'stage_1', slug: 'visual-marca', label: '1. Visual e Marca', shortDesc: 'Cores, brilho de fundo e imagens' },
      { id: 'stage_2', slug: 'menu-preferencias', label: '2. Menu e Preferências', shortDesc: 'Ordem das abas, sons e tempo de tela' }
    ]
  },
  servidor_ia: {
    title: 'Servidor VPS e Segurança',
    subtitle: 'Atualização em 1 clique, domínio nyctibi.us, backups e blindagem Zero-Trust',
    whatItDoes: 'Painel exclusivo do Super Admin para atualizar a VPS, gerenciar backups e monitorar a segurança.',
    steps: [
      'Atualize sua VPS sem perder dados na etapa "1. Atualizar Sistema (OTA)".',
      'Verifique a blindagem Zero-Trust e faça backups testados na etapa "2. Blindagem e Backups".'
    ],
    mode: 'dom_stages',
    subTabs: [
      { id: 'stage_1', slug: 'atualizar-ota', label: '1. Atualizar Sistema (OTA)', shortDesc: 'Sincronizar VPS em 1 clique' },
      { id: 'stage_2', slug: 'blindagem-backups', label: '2. Blindagem e Backups', shortDesc: 'Auditoria Zero-Trust e cópias seguras' }
    ]
  },
  modulos: {
    title: 'Módulos & Links Diretos (.nyctibi.us)',
    subtitle: 'Diretório completo de menus e submenus com endereçamento exclusivo por empresa',
    whatItDoes: 'Centraliza todos os módulos e submenus do sistema com links diretos no formato empresa.nyctibi.us/menu/submenu.',
    steps: [
      'Navegue ou pesquise qualquer módulo e suas sub-abas na etapa "1. Mapa de Módulos e Submenus".',
      'Copie os links diretos por setor ou função na etapa "2. Links Rápidos por Setor".'
    ],
    mode: 'dom_stages',
    subTabs: [
      { id: 'stage_1', slug: 'mapa-links', label: '1. Mapa de Módulos e Submenus', shortDesc: 'Todos os menus e sub-abas com link direto' },
      { id: 'stage_2', slug: 'atalhos-setor', label: '2. Links Rápidos por Setor', shortDesc: 'Endereços prontos para equipe e gestores' }
    ]
  }
};

interface CleanModuleShellProps {
  activeTab: TabId;
  customLabel?: string;
  companySubdomain?: string;
  initialSubTabSlug?: string | null;
  onSubTabChange?: (subTabSlug: string, stageIndex: number) => void;
  children: React.ReactNode;
}

export const CleanModuleShell: React.FC<CleanModuleShellProps> = ({
  activeTab,
  customLabel,
  companySubdomain,
  initialSubTabSlug,
  onSubTabChange,
  children
}) => {
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
  const [copiedRouteLink, setCopiedRouteLink] = useState<boolean>(false);
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

  useEffect(() => {
    const root = contentContainerRef.current;
    if (!root) return;

    const applyProgressivePartitioning = () => {
      const moduleWrapper = root.firstElementChild as HTMLElement | null;
      if (!moduleWrapper) return;

      if (guide.mode === 'internal_buttons') {
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

      let directBlocks = Array.from(moduleWrapper.children).filter((el) => {
        const htmlEl = el as HTMLElement;
        const tag = htmlEl.tagName.toLowerCase();
        if (tag === 'style' || tag === 'script') return false;
        const pos = window.getComputedStyle(htmlEl).position;
        if (pos === 'fixed') return false;
        return true;
      }) as HTMLElement[];

      if (directBlocks.length === 1 && directBlocks[0].children.length >= 2) {
        const innerCandidates = Array.from(directBlocks[0].children).filter((el) => {
          const htmlEl = el as HTMLElement;
          const pos = window.getComputedStyle(htmlEl).position;
          return pos !== 'fixed';
        }) as HTMLElement[];
        if (innerCandidates.length >= 2) {
          directBlocks = innerCandidates;
        }
      }

      const subTabsCount = guide.subTabs.length;
      setDetectedSectionCount(directBlocks.length);

      if (showAllStages || directBlocks.length <= 1 || subTabsCount <= 1) {
        directBlocks.forEach((block) => {
          block.style.removeProperty('display');
        });
        return;
      }

      const firstBlock = directBlocks[0];
      const firstBlockIsCompactActionBar =
        directBlocks.length >= 2 &&
        firstBlock.querySelectorAll('table, form, textarea, canvas').length === 0 &&
        firstBlock.offsetHeight > 0 &&
        firstBlock.offsetHeight < 185;

      const stageableBlocks = firstBlockIsCompactActionBar
        ? directBlocks.slice(1)
        : directBlocks;

      if (firstBlockIsCompactActionBar) {
        firstBlock.style.removeProperty('display');
      }

      if (stageableBlocks.length <= 1) {
        stageableBlocks.forEach((b) => b.style.removeProperty('display'));
        return;
      }

      const totalBlocks = stageableBlocks.length;
      const effectiveTabs = Math.min(subTabsCount, totalBlocks);
      const clampedStage = Math.min(selectedStageIndex, effectiveTabs - 1);

      stageableBlocks.forEach((block, idx) => {
        const belongsToStage =
          totalBlocks <= effectiveTabs
            ? idx
            : Math.min(
                effectiveTabs - 1,
                Math.floor((idx / totalBlocks) * effectiveTabs)
              );

        if (belongsToStage === clampedStage) {
          block.style.removeProperty('display');
        } else {
          block.style.display = 'none';
        }
      });
    };

    applyProgressivePartitioning();

    const observer = new MutationObserver(() => {
      applyProgressivePartitioning();
    });

    observer.observe(root, { childList: true, subtree: false });
    return () => observer.disconnect();
  }, [activeTab, selectedStageIndex, showAllStages, guide.mode, guide.subTabs.length]);

  const activeSubTabMeta = guide.subTabs[selectedStageIndex] || guide.subTabs[0];
  const slugEmpresaFinal = (companySubdomain || 'empresa')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '') || 'empresa';
  const currentSubSlug = activeSubTabMeta?.slug || 'principal';
  const fullDeepLinkUrl = `https://${slugEmpresaFinal}.nyctibi.us/${activeTab}/${currentSubSlug}`;

  return (
    <div
      className={`w-full max-w-full overflow-x-hidden space-y-4 ${
        showDetailedDescriptions ? 'urutau-show-all-legends' : 'urutau-clean-mode'
      }`}
    >
      <div className="bg-[#111821] border border-white/[0.08] rounded-xl p-3 sm:px-4 sm:py-3 flex flex-col gap-3 max-w-full overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                {customLabel || guide.title}
              </h1>
              <span className="hidden sm:inline-block text-slate-600">·</span>
              <span className="hidden sm:inline-block text-xs text-slate-400 truncate max-w-md">
                {activeSubTabMeta ? activeSubTabMeta.shortDesc : guide.subtitle}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(fullDeepLinkUrl);
                setCopiedRouteLink(true);
                setTimeout(() => setCopiedRouteLink(false), 2000);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-[#090E14] hover:bg-white/[0.06] border border-white/10 text-[11px] font-mono text-emerald-300 inline-flex items-center gap-1.5 cursor-pointer transition-colors max-w-[220px] sm:max-w-xs truncate"
              title={`Copiar link direto deste submenu: ${fullDeepLinkUrl}`}
            >
              {copiedRouteLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
                  <span>Link Copiado!</span>
                </>
              ) : (
                <>
                  <Link2 className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
                  <span className="truncate">
                    {slugEmpresaFinal}.nyctibi.us/{activeTab}/{currentSubSlug}
                  </span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setHelpOpen((prev) => !prev)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors min-h-[36px] ${
                helpOpen
                  ? 'bg-[#10B981]/20 border-[#10B981]/50 text-[#10B981]'
                  : 'bg-[#090E14] hover:bg-white/[0.05] border-white/10 text-slate-300'
              }`}
              title="Como usar esta tela passo a passo"
            >
              <HelpCircle className="w-3.5 h-3.5 text-[#10B981]" />
              <span className="hidden sm:inline">Como usar</span>
            </button>
          </div>
        </div>

        {guide.subTabs.length > 1 && (
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-stretch gap-1.5 p-1.5 rounded-lg bg-[#090E14] border border-white/[0.06] w-full max-w-full">
            {guide.subTabs.map((sub, idx) => {
              const isSelected = !showAllStages && selectedStageIndex === idx;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => handleSelectStage(idx)}
                  title={`${sub.shortDesc} (${slugEmpresaFinal}.nyctibi.us/${activeTab}/${sub.slug})`}
                  className={`w-full sm:w-auto min-h-[40px] px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center justify-center text-center leading-tight cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[#10B981] text-[#05100C] shadow-sm font-bold'
                      : 'bg-[#111821]/80 sm:bg-transparent text-slate-300 hover:text-white hover:bg-white/[0.05]'
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
                className={`w-full sm:w-auto min-h-[40px] px-2.5 py-1.5 rounded-md text-xs font-medium inline-flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                  showAllStages
                    ? 'bg-white/15 text-white'
                    : 'bg-[#111821]/80 sm:bg-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                <Layers className="w-3.5 h-3.5 shrink-0" />
                <span>Tudo</span>
              </button>
            )}
          </div>
        )}
      </div>

      {helpOpen && (
        <div className="bg-[#111821] border border-[#10B981]/35 rounded-xl p-4 shadow-xl space-y-3 animate-fadeIn">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-bold text-[#10B981] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Guia Rápido — {guide.title}</span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">{guide.whatItDoes}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowDetailedDescriptions((prev) => !prev)}
                className="px-2.5 py-1 rounded-lg bg-[#090E14] hover:bg-white/[0.06] border border-white/10 text-[11px] font-medium text-slate-300 inline-flex items-center gap-1.5 cursor-pointer"
                title="Mostrar ou recolher textos explicativos secundários da tela"
              >
                {showDetailedDescriptions ? (
                  <>
                    <EyeOff className="w-3 h-3 text-amber-400" />
                    <span>Ocultar legendas longas</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3 h-3 text-[#10B981]" />
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
                className="p-3 rounded-lg bg-[#090E14] border border-white/[0.06] hover:border-[#10B981]/40 flex items-start gap-2.5 cursor-pointer transition-colors"
              >
                <span className="w-5 h-5 rounded-full bg-[#10B981]/20 text-[#10B981] font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <div className="space-y-1 min-w-0">
                  <p className="text-xs text-slate-200 leading-snug">{stepText}</p>
                  {idx < guide.subTabs.length && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#10B981]">
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

interface ModulosDirectoryHubProps {
  companySubdomain: string;
  companyName: string;
  categories: NavCategory[];
  onNavigateModuleSubTab: (tabId: TabId, subTabSlug?: string) => void;
}

export const ModulosDirectoryHub: React.FC<ModulosDirectoryHubProps> = ({
  companySubdomain,
  companyName,
  categories,
  onNavigateModuleSubTab
}) => {
  const [search, setSearch] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const slugEmpresa = useMemo(() => {
    return (
      String(companySubdomain || companyName || 'empresa')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'empresa'
    );
  }, [companySubdomain, companyName]);

  const allOrderedTabs = useMemo(() => {
    const sourceCats = categories && categories.length > 0 ? categories : DEFAULT_CATEGORIES;
    const seen = new Set<TabId>();
    const list: { tabId: TabId; groupTitle: string }[] = [];
    sourceCats.forEach((cat) => {
      cat.abas.forEach((tId) => {
        if (!seen.has(tId)) {
          seen.add(tId);
          list.push({ tabId: tId, groupTitle: cat.titulo });
        }
      });
    });
    (Object.keys(MODULE_CLEAN_GUIDES) as TabId[]).forEach((tId) => {
      if (!seen.has(tId)) {
        seen.add(tId);
        list.push({ tabId: tId, groupTitle: 'Outros Módulos' });
      }
    });
    return list;
  }, [categories]);

  const filteredModules = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allOrderedTabs;
    return allOrderedTabs.filter(({ tabId, groupTitle }) => {
      const guide = MODULE_CLEAN_GUIDES[tabId];
      const meta = DEFAULT_TAB_META[tabId];
      const target = [
        tabId,
        groupTitle,
        meta?.label || '',
        guide?.title || '',
        guide?.subtitle || '',
        ...(guide?.subTabs || []).map((s) => `${s.label} ${s.slug} ${s.shortDesc}`)
      ]
        .join(' ')
        .toLowerCase();
      return target.includes(q);
    });
  }, [allOrderedTabs, search]);

  const copyLink = (url: string, key: string) => {
    navigator.clipboard?.writeText(url);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-6 w-full">
      <div data-clean-stage="0" className="space-y-4">
        <div className="bg-[#071712] border border-[#10B981]/35 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <Link2 className="w-4 h-4 text-[#10B981]" />
              <span>Arquitetura de Links Diretos por Menu e Submenu</span>
            </div>
            <p className="text-xs text-slate-300">
              Cada menu e submenu possui seu endereço oficial no padrão{' '}
              <strong className="font-mono text-[#10B981]">
                https://{slugEmpresa}.nyctibi.us/menu/submenu
              </strong>
            </p>
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar menu, submenu ou link..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#05100C] border border-white/15 text-xs text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredModules.map(({ tabId, groupTitle }) => {
            const guide = MODULE_CLEAN_GUIDES[tabId];
            const meta = DEFAULT_TAB_META[tabId];
            if (!guide) return null;
            const mainMenuUrl = `https://${slugEmpresa}.nyctibi.us/${tabId}`;
            return (
              <div
                key={tabId}
                className="bg-[#111821] border border-white/10 hover:border-[#10B981]/45 rounded-xl p-4 flex flex-col justify-between gap-3 transition-all"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-[#10B981]/15 text-[#10B981] font-bold">
                        {groupTitle}
                      </span>
                      <h3 className="text-sm font-bold text-white mt-1">
                        {meta?.label || guide.title}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigateModuleSubTab(tabId, guide.subTabs[0]?.slug)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#34D399] text-[#05100C] text-xs font-black inline-flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <span>Abrir</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="p-2 rounded-lg bg-[#090E14] border border-white/[0.06] flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono text-emerald-300 truncate">
                      {slugEmpresa}.nyctibi.us/{tabId}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyLink(mainMenuUrl, `menu-${tabId}`)}
                      className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[10px] font-mono text-slate-200 inline-flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      {copiedKey === `menu-${tabId}` ? (
                        <>
                          <Check className="w-3 h-3 text-[#10B981]" />
                          <span>Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="text-[10px] font-mono uppercase text-slate-400">
                      Submenus ({guide.subTabs.length}):
                    </div>
                    {guide.subTabs.map((sub) => {
                      const subUrl = `https://${slugEmpresa}.nyctibi.us/${tabId}/${sub.slug}`;
                      const subKey = `sub-${tabId}-${sub.slug}`;
                      return (
                        <div
                          key={sub.id}
                          className="p-2 rounded-lg bg-[#090E14]/90 border border-white/[0.05] hover:border-[#10B981]/30 flex flex-col gap-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-100 truncate">
                              {sub.label}
                            </span>
                            <div className="grid grid-cols-2 gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => copyLink(subUrl, subKey)}
                                className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[10px] font-semibold text-slate-300 inline-flex items-center justify-center gap-1 cursor-pointer"
                              >
                                {copiedKey === subKey ? (
                                  <Check className="w-3 h-3 text-[#10B981]" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                                <span>{copiedKey === subKey ? 'OK' : 'Link'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onNavigateModuleSubTab(tabId, sub.slug)}
                                className="px-2 py-1 rounded bg-[#10B981]/20 hover:bg-[#10B981] text-[#10B981] hover:text-[#05100C] text-[10px] font-bold inline-flex items-center justify-center gap-1 cursor-pointer transition-colors"
                              >
                                <span>Ir</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 truncate">
                            {slugEmpresa}.nyctibi.us/{tabId}/{sub.slug}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div data-clean-stage="1" className="bg-[#111821] border border-white/10 rounded-xl p-4 sm:p-5 space-y-4">
        <h3 className="text-sm font-bold text-white">
          Atalhos Rápidos por Perfil de Operação ({slugEmpresa}.nyctibi.us)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            {
              perfil: 'Atendimento de Salão e Garçons',
              tab: 'pdv' as TabId,
              sub: 'mesas-comandas',
              desc: 'Abre direto no Mapa de Mesas e Comandas'
            },
            {
              perfil: 'Balcão e Expedição Delivery',
              tab: 'pdv' as TabId,
              sub: 'balcao-delivery',
              desc: 'Abre direto nos Pedidos Rápidos e Entregas'
            },
            {
              perfil: 'Fechamento de Caixa e Turno',
              tab: 'caixa' as TabId,
              sub: 'fluxo-turno',
              desc: 'Abre direto na Tesouraria e Fechamento Cego'
            },
            {
              perfil: 'Divisão de Gorjetas (Rateio 10%)',
              tab: 'caixa' as TabId,
              sub: 'rateio-comissoes',
              desc: 'Abre direto no Rateio de Comissões do Turno'
            },
            {
              perfil: 'Cadastros Unificados (PF / PJ / Equipe)',
              tab: 'cadastros' as TabId,
              sub: 'base-geral',
              desc: 'Abre direto na Base Geral Unificada'
            },
            {
              perfil: 'Central de Logs de Erros e Falhas',
              tab: 'auditoria' as TabId,
              sub: 'erros-falhas',
              desc: 'Abre direto no Diagnóstico de Erros do Sistema'
            }
          ].map((item) => {
            const url = `https://${slugEmpresa}.nyctibi.us/${item.tab}/${item.sub}`;
            const k = `preset-${item.tab}-${item.sub}`;
            return (
              <div
                key={k}
                className="p-3.5 rounded-xl bg-[#090E14] border border-white/10 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="text-xs font-bold text-white">{item.perfil}</div>
                  <div className="text-[11px] text-slate-400">{item.desc}</div>
                  <div className="text-[11px] font-mono text-[#10B981] break-all pt-1">{url}</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => copyLink(url, k)}
                    className="py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {copiedKey === k ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === k ? 'Copiado!' : 'Copiar Link'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateModuleSubTab(item.tab, item.sub)}
                    className="py-2 px-3 rounded-lg bg-[#10B981] hover:bg-[#34D399] text-[#05100C] text-xs font-black inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Abrir Agora</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const HomeDashboardHub: React.FC<{
  data: any;
  currentUser: any;
  companyName: string;
  companySubdomain: string;
  onNavigateTab: (tab: TabId, subTabSlug?: string) => void;
}> = ({ data, currentUser, companyName, companySubdomain, onNavigateTab }) => {
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

  return (
    <div className="space-y-5 w-full">
      <div data-clean-stage="0" className="space-y-5">
        <div className="bg-[#0A1813] border border-[#10B981]/35 rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-wider text-[#10B981]">
              <span>Painel Central • {companyName || 'Empresa Ativa'}</span>
              <span className="text-slate-500">•</span>
              <span className="text-amber-300">{companySubdomain}.nyctibi.us</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white">
              Olá, {currentUser?.nome || 'Operador'} ({currentUser?.cargo || currentUser?.tipo || 'Gestão'})
            </h2>
            <p className="text-xs text-slate-300">
              Acompanhe os indicadores em tempo real e toque em qualquer cartão abaixo para abrir a área desejada.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigateTab('pdv', 'mesas-comandas')}
              className="px-3.5 py-2.5 rounded-lg bg-[#10B981] hover:bg-[#34D399] text-[#05100C] text-xs font-black min-h-[40px] cursor-pointer"
            >
              Abrir PDV & Mesas
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('reservas', 'mapa-salao')}
              className="px-3.5 py-2.5 rounded-lg bg-[#F59E0B] hover:bg-[#FBBF24] text-[#05100C] text-xs font-black min-h-[40px] cursor-pointer"
            >
              Mapa de Reservas
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('caixa', 'fluxo-turno')}
              className="px-3.5 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-bold min-h-[40px] cursor-pointer"
            >
              Fluxo de Caixa
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('cadastros', 'base-geral')}
              className="px-3.5 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-bold min-h-[40px] cursor-pointer"
            >
              Cadastros
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
          <button
            type="button"
            onClick={() => onNavigateTab('caixa', 'fluxo-turno')}
            className="p-4 rounded-xl bg-[#111821] hover:bg-[#16202B] border border-[#10B981]/35 text-left transition-all cursor-pointer flex flex-col justify-between gap-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Saldo Líquido em Caixa
              </span>
              <span className="px-2 py-0.5 rounded bg-[#10B981]/20 text-[#10B981] text-[10px] font-mono font-bold">
                Caixa & Turno
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-mono font-black text-white tabular-nums">
                {formatBRL(resumo.saldoCaixa)}
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-1 flex items-center justify-between">
                <span className="text-emerald-400">Entradas: {formatBRL(resumo.entradas)}</span>
                <span className="text-rose-400">Saídas: {formatBRL(resumo.saidas)}</span>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('reservas', 'mapa-salao')}
            className="p-4 rounded-xl bg-[#111821] hover:bg-[#16202B] border border-amber-500/35 text-left transition-all cursor-pointer flex flex-col justify-between gap-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Reservas & Salão
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold">
                {resumo.reservasConfirmadas} Confirmadas
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-mono font-black text-white tabular-nums">
                {resumo.totalReservas} Mesas • {resumo.totalPaxReservas} Pax
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Toque para abrir a planta do salão e lista de clientes
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('estoque', 'posicao-estoque')}
            className={`p-4 rounded-xl bg-[#111821] hover:bg-[#16202B] border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${
              resumo.estoqueCritico.length > 0 ? 'border-rose-500/45' : 'border-cyan-500/35'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Estoque & Insumos
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  resumo.estoqueCritico.length > 0
                    ? 'bg-rose-500/20 text-rose-300'
                    : 'bg-cyan-500/20 text-cyan-300'
                }`}
              >
                {resumo.estoqueCritico.length > 0
                  ? `${resumo.estoqueCritico.length} em Alerta`
                  : 'Estoque Saudável'}
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-mono font-black text-white tabular-nums">
                {resumo.totalEstoque} Itens Ativos
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {resumo.estoqueCritico.length > 0
                  ? `${resumo.estoqueCritico.length} insumo(s) abaixo do mínimo recomendado`
                  : 'Todos os itens acima do estoque mínimo'}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('cadastros', 'base-geral')}
            className="p-4 rounded-xl bg-[#111821] hover:bg-[#16202B] border border-purple-500/35 text-left transition-all cursor-pointer flex flex-col justify-between gap-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Equipe & Cadastros
              </span>
              <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-mono font-bold">
                Base Unificada
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-mono font-black text-white tabular-nums">
                {resumo.usuariosAtivos} Equipe • {resumo.freelancersAtivos} Free
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {resumo.cadastrosTotal} cadastros gerais • {resumo.checklistsCount} checklists ativos
              </div>
            </div>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-[#111821] border border-white/10 rounded-xl p-4 space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#10B981]">
                  Últimos Lançamentos do Caixa
                </h3>
                <button
                  type="button"
                  onClick={() => onNavigateTab('caixa', 'fluxo-turno')}
                  className="text-[11px] font-semibold text-emerald-300 hover:underline cursor-pointer"
                >
                  Abrir Caixa
                </button>
              </div>
              {resumo.caixaRecentes.length === 0 ? (
                <div className="p-3 rounded-lg bg-[#090E14] text-xs text-slate-400">
                  Nenhuma movimentação registrada hoje.
                </div>
              ) : (
                <div className="space-y-2">
                  {resumo.caixaRecentes.map((c: any) => {
                    const isSaida = String(c?.tipo || '').toLowerCase().includes('sai') || String(c?.tipo || '').toLowerCase().includes('desp');
                    return (
                      <div
                        key={c.id}
                        className="p-2.5 rounded-lg bg-[#090E14] border border-white/5 flex items-center justify-between gap-2 text-xs"
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
              className="w-full py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 cursor-pointer"
            >
              Ver Rateio de 10% e Comissões
            </button>
          </div>

          <div className="bg-[#111821] border border-white/10 rounded-xl p-4 space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Reservas e Ocupação de Mesas
                </h3>
                <button
                  type="button"
                  onClick={() => onNavigateTab('reservas', 'lista-reservas')}
                  className="text-[11px] font-semibold text-amber-300 hover:underline cursor-pointer"
                >
                  Ver Todas
                </button>
              </div>
              {resumo.proximasReservas.length === 0 ? (
                <div className="p-3 rounded-lg bg-[#090E14] text-xs text-slate-400">
                  Nenhuma reserva cadastrada para o período.
                </div>
              ) : (
                <div className="space-y-2">
                  {resumo.proximasReservas.map((r: any) => (
                    <div
                      key={r.id}
                      className="p-2.5 rounded-lg bg-[#090E14] border border-white/5 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-white truncate">
                          {r.cliente || 'Cliente'} • {r.area || `Mesa ${r.id}`}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {r.horario || '19:30'} • {r.status || 'Confirmada'}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 font-mono font-bold text-[11px] shrink-0">
                        {r.pessoas || 4} pax
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('pdv', 'mesas-comandas')}
              className="w-full py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 cursor-pointer"
            >
              Abrir Atendimento de Mesas no PDV
            </button>
          </div>

          <div className="bg-[#111821] border border-white/10 rounded-xl p-4 space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-300">
                  Reposição de Estoque & Alertas
                </h3>
                <button
                  type="button"
                  onClick={() => onNavigateTab('compras', 'sugestao-compras')}
                  className="text-[11px] font-semibold text-rose-300 hover:underline cursor-pointer"
                >
                  Lista de Compras
                </button>
              </div>
              {resumo.estoqueCritico.length === 0 ? (
                <div className="p-3 rounded-lg bg-[#090E14] text-xs text-emerald-300">
                  Nenhum insumo abaixo do estoque mínimo no momento.
                </div>
              ) : (
                <div className="space-y-2">
                  {resumo.estoqueCritico.slice(0, 5).map((it: any) => (
                    <div
                      key={it.id}
                      className="p-2.5 rounded-lg bg-[#090E14] border border-rose-500/30 flex items-center justify-between gap-2 text-xs"
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
              onClick={() => onNavigateTab('auditoria', 'erros-falhas')}
              className="w-full py-2 px-3 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-xs font-bold text-rose-200 cursor-pointer"
            >
              Central de Logs de Erros ({resumo.alertasCount})
            </button>
          </div>
        </div>
      </div>

      <div data-clean-stage="1" className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              grupo: '1. Atendimento, Salão e Vendas',
              cor: 'border-[#10B981]/35',
              itens: [
                { tab: 'pdv' as TabId, sub: 'mesas-comandas', titulo: 'PDV, Mesas e Comandas', desc: 'Pedidos no salão, balcão, delivery e impressão térmica' },
                { tab: 'reservas' as TabId, sub: 'mapa-salao', titulo: 'Reservas e Mapa do Salão', desc: 'Ocupação ao vivo das mesas e agendamentos de clientes' },
                { tab: 'chat' as TabId, sub: 'conversas-ativas', titulo: 'Chat WhatsApp & Bot IA', desc: 'Atendimento automático e conversas em tempo real' },
                { tab: 'portais' as TabId, sub: 'visor-portais', titulo: 'Portais de Delivery e Reservas', desc: 'Acesso simultâneo a portais externos integrados' }
              ]
            },
            {
              grupo: '2. Financeiro, Compras e Estoque',
              cor: 'border-amber-500/35',
              itens: [
                { tab: 'caixa' as TabId, sub: 'fluxo-turno', titulo: 'Caixa e Fechamento de Turno', desc: 'Entradas, saídas, sangrias e conferência de turno' },
                { tab: 'rateio' as TabId, sub: 'comissoes', titulo: 'Rateio de 10% (Gorjetas)', desc: 'Divisão justa por pontos, pesos e presença no turno' },
                { tab: 'estoque' as TabId, sub: 'posicao-estoque', titulo: 'Estoque e Kardex', desc: 'Controle de insumos, validade e movimentações' },
                { tab: 'cmv' as TabId, sub: 'fichas-tecnicas', titulo: 'CMV e Fichas Técnicas', desc: 'Custo por prato, margem de lucro e engenharia de cardápio' }
              ]
            },
            {
              grupo: '3. Equipe, Escalas e RH',
              cor: 'border-purple-500/35',
              itens: [
                { tab: 'cadastros' as TabId, sub: 'base-geral', titulo: 'Cadastros Unificados', desc: 'Colaboradores, gestores, freelancers, clientes e fornecedores' },
                { tab: 'escalas' as TabId, sub: 'escala-semanal', titulo: 'Escalas e Folgas', desc: 'Grade semanal de turnos e cobertura de folgas' },
                { tab: 'rh' as TabId, sub: 'folha-holerite', titulo: 'RH, Ponto GPS e Folha', desc: 'Ponto com cerca geográfica, holerites e NR-01' },
                { tab: 'checklists' as TabId, sub: 'checklists-turno', titulo: 'Checklists de Rotina', desc: 'Conferência de abertura, limpeza e fechamento' }
              ]
            },
            {
              grupo: '4. Governança, Módulos e Sistema',
              cor: 'border-cyan-500/35',
              itens: [
                { tab: 'modulos' as TabId, sub: 'diretorio-links', titulo: 'Módulos & Links Diretos', desc: 'Todos os endereços empresa.nyctibi.us/menu/submenu' },
                { tab: 'auditoria' as TabId, sub: 'erros-falhas', titulo: 'Central de Logs de Erros e Desarquivar', desc: 'Diagnóstico de falhas, restauração de arquivados e GPS' },
                { tab: 'permissoes' as TabId, sub: 'matriz-acessos', titulo: 'Permissões de Acesso', desc: 'Controle do que cada colaborador pode ver ou editar' },
                { tab: 'config' as TabId, sub: 'marca-cores', titulo: 'Aparência, Menus e Brilho', desc: 'Personalização de cores, logo e organização dos menus' }
              ]
            }
          ].map((bloco) => (
            <div
              key={bloco.grupo}
              className={`bg-[#111821] border ${bloco.cor} rounded-xl p-4 space-y-3`}
            >
              <h3 className="text-xs font-bold uppercase tracking-wider text-white border-b border-white/10 pb-2">
                {bloco.grupo}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {bloco.itens.map((it) => (
                  <button
                    key={`${it.tab}-${it.sub}`}
                    type="button"
                    onClick={() => onNavigateTab(it.tab, it.sub)}
                    className="p-3 rounded-lg bg-[#090E14] hover:bg-[#113025]/60 border border-white/10 hover:border-[#10B981]/50 text-left transition-all cursor-pointer flex flex-col justify-between gap-2"
                  >
                    <div>
                      <div className="text-xs font-bold text-white">{it.titulo}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">{it.desc}</div>
                    </div>
                    <div className="text-[10px] font-mono text-[#10B981] flex items-center justify-between pt-1">
                      <span>/{it.tab}/{it.sub}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div data-clean-stage="2" className="space-y-4">
        <div className="bg-[#111821] border border-white/10 rounded-xl p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white">
                Últimas Atividades Registradas na Empresa
              </h3>
              <p className="text-xs text-slate-400">
                Histórico recente de ações dos operadores e eventos automáticos do sistema.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('auditoria', 'erros-falhas')}
              className="px-3.5 py-2 rounded-lg bg-[#10B981] hover:bg-[#34D399] text-[#05100C] text-xs font-black cursor-pointer"
            >
              Ver Todos os Logs e Erros
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

