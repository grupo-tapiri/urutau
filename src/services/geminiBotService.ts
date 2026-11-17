import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';

export interface BotContext {
  db: any;
  executarComOutbox: (fnOperacao: () => any, eventoOutbox?: { agregado: string; tipo: string; payload: any }) => Promise<any>;
  registrarAuditLog: (operador: string, acao: string, detalhe: string, ip?: string, cargo?: string) => Promise<any>;
  nextId: (colecao: any[]) => number;
  saveDbToDisk: () => void;
  sseBroker: any;
}

export interface PendingAction {
  id: string;
  telefone: string;
  empresa_id: number;
  operador_nome: string;
  operador_cargo: string;
  tipo:
    | 'FINANCEIRO_CAIXA'
    | 'CONTRATACAO_FREELANCER'
    | 'RECEBIMENTO_MERCADORIA'
    | 'FECHAMENTO_RATEIO'
    | 'ADIANTAMENTO_VALE';
  resumo: string;
  payload: any;
  criado_em: number;
  expira_em: number;
}

export interface ColaboradorPermissoesWpp {
  identificado: boolean;
  nome: string;
  cargo: string;
  tipo: string;
  nivelHierarquico: number;
  podeFinanceiroCaixa: boolean;
  podeContratarFreelancer: boolean;
  podeEstoqueCompras: boolean;
  podeGestaoEscalaRH: boolean;
  podeOperacionalTurno: boolean;
  abasPermitidas: string[];
}

export class GeminiBotService {
  private ai: GoogleGenAI | null = null;
  private pendingActions = new Map<string, PendingAction>();
  private conversationHistory = new Map<string, Array<{ role: string; parts: any[] }>>();
  private ctx: BotContext;

  constructor(ctx: BotContext) {
    this.ctx = ctx;
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        this.ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build'
            }
          }
        });
      } catch (err) {
        console.warn('[GeminiBot] Falha ao inicializar GoogleGenAI com chave:', err);
      }
    } else {
      try {
        this.ai = new GoogleGenAI({
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build'
            }
          }
        });
      } catch (e) {
        console.warn('[GeminiBot] GoogleGenAI rodando sem chave configurada no momento.');
      }
    }
  }

  public resolverPermissoesColaboradorWpp(user: any, nomeFallback?: string): ColaboradorPermissoesWpp {
    const db = this.ctx.db;
    if (!user) {
      return {
        identificado: false,
        nome: nomeFallback || 'Visitante Não Identificado',
        cargo: 'Sem Cargo Vinculado',
        tipo: 'Externo',
        nivelHierarquico: 0,
        podeFinanceiroCaixa: false,
        podeContratarFreelancer: false,
        podeEstoqueCompras: false,
        podeGestaoEscalaRH: false,
        podeOperacionalTurno: true,
        abasPermitidas: ['escalas', 'checklists']
      };
    }

    const cargoStr = String(user.cargo || '').toLowerCase();
    const tipoStr = String(user.tipo || '').toLowerCase();

    const isSuperOrAdmin =
      tipoStr.includes('super admin') ||
      tipoStr.includes('admin') ||
      tipoStr.includes('diretor') ||
      tipoStr.includes('empresario') ||
      tipoStr.includes('empresário') ||
      tipoStr.includes('proprietario') ||
      tipoStr.includes('proprietário') ||
      cargoStr.includes('diretor') ||
      cargoStr.includes('gerente') ||
      cargoStr.includes('gestor') ||
      cargoStr.includes('sócio') ||
      cargoStr.includes('socio');

    const cargoCadastro = (db.cargos || []).find(
      (c: any) =>
        !c.arquivado_legal &&
        (Number(c.id) === Number(user.cargo_id) ||
          String(c.nome || '').toLowerCase() === cargoStr)
    );

    const nivelHierarquico = isSuperOrAdmin
      ? 10
      : Number(cargoCadastro?.nivel_hierarquico || (cargoStr.includes('chefe') || cargoStr.includes('líder') ? 5 : 2));

    let abasPermitidas: string[] = [];
    try {
      const rawPerms =
        typeof user.permissoes_json === 'string'
          ? JSON.parse(user.permissoes_json)
          : user.permissoes_json;
      if (Array.isArray(rawPerms)) {
        abasPermitidas = rawPerms.map((p: any) => String(p).toLowerCase());
      } else if (rawPerms && typeof rawPerms === 'object' && Array.isArray(rawPerms.abas)) {
        abasPermitidas = rawPerms.abas.map((p: any) => String(p).toLowerCase());
      }
    } catch {}

    const temCaixaCargo =
      isSuperOrAdmin ||
      cargoStr.includes('caixa') ||
      cargoStr.includes('financeiro') ||
      cargoStr.includes('atendente') ||
      abasPermitidas.includes('caixa') ||
      abasPermitidas.includes('rateio') ||
      nivelHierarquico >= 6;

    const temContratacaoCargo =
      isSuperOrAdmin ||
      cargoStr.includes('rh') ||
      cargoStr.includes('recursos humanos') ||
      cargoStr.includes('supervisor') ||
      cargoStr.includes('chefe') ||
      abasPermitidas.includes('equipe') ||
      abasPermitidas.includes('selecao') ||
      abasPermitidas.includes('rh') ||
      nivelHierarquico >= 6;

    const temEstoqueCargo =
      isSuperOrAdmin ||
      cargoStr.includes('estoque') ||
      cargoStr.includes('cozinha') ||
      cargoStr.includes('chef') ||
      cargoStr.includes('bar') ||
      cargoStr.includes('comprador') ||
      cargoStr.includes('garçom') ||
      cargoStr.includes('garcom') ||
      abasPermitidas.includes('estoque') ||
      abasPermitidas.includes('compras') ||
      nivelHierarquico >= 2;

    const temGestaoEscalaRH =
      isSuperOrAdmin ||
      cargoStr.includes('gerente') ||
      cargoStr.includes('gestor') ||
      cargoStr.includes('supervisor') ||
      cargoStr.includes('chefe') ||
      cargoStr.includes('rh') ||
      nivelHierarquico >= 5;

    return {
      identificado: true,
      nome: user.nome || nomeFallback || 'Colaborador',
      cargo: user.cargo || cargoCadastro?.nome || 'Colaborador Operacional',
      tipo: user.tipo || 'Colaborador',
      nivelHierarquico,
      podeFinanceiroCaixa: temCaixaCargo,
      podeContratarFreelancer: temContratacaoCargo,
      podeEstoqueCompras: temEstoqueCargo,
      podeGestaoEscalaRH: temGestaoEscalaRH,
      podeOperacionalTurno: true,
      abasPermitidas
    };
  }

  private getToolDeclarations(): FunctionDeclaration[] {
    return [
      {
        name: 'consultar_escalas_do_dia',
        description: 'Consulta as escalas de trabalho e colaboradores escalados para uma data específica.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            data: {
              type: Type.STRING,
              description: 'Data no formato AAAA-MM-DD. Se omitido, usa a data atual.'
            },
            empresa_id: {
              type: Type.NUMBER,
              description: 'ID da empresa.'
            }
          }
        }
      },
      {
        name: 'lancar_movimento_escala',
        description: 'Registra Falta Justificada, Falta Injustificada, Dobra de Turno, Folga Extra ou Hora Extra para um colaborador na escala do dia. Requer cargo de Gerente, Supervisor ou RH.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            colaborador_nome: {
              type: Type.STRING,
              description: 'Nome do colaborador afetado.'
            },
            tipo_movimento: {
              type: Type.STRING,
              description: 'Tipo do movimento: "Falta Injustificada", "Falta Justificada", "Dobra de Turno", "Folga Extra" ou "Hora Extra".'
            },
            motivo: {
              type: Type.STRING,
              description: 'Motivo ou observação da ocorrência.'
            },
            data: {
              type: Type.STRING,
              description: 'Data da ocorrência (AAAA-MM-DD).'
            },
            empresa_id: {
              type: Type.NUMBER,
              description: 'ID da empresa.'
            }
          },
          required: ['colaborador_nome', 'tipo_movimento', 'motivo']
        }
      },
      {
        name: 'solicitar_troca_turno',
        description: 'Registra solicitação ou aprovação de troca de turno/folga entre dois colaboradores.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            colaborador_solicitante: {
              type: Type.STRING,
              description: 'Nome do colaborador que está trocando.'
            },
            colaborador_substituto: {
              type: Type.STRING,
              description: 'Nome do colega que assumirá o turno.'
            },
            data_troca: {
              type: Type.STRING,
              description: 'Data do turno trocado (AAAA-MM-DD).'
            },
            motivo: {
              type: Type.STRING,
              description: 'Motivo da troca.'
            },
            empresa_id: {
              type: Type.NUMBER,
              description: 'ID da empresa.'
            }
          },
          required: ['colaborador_solicitante', 'colaborador_substituto', 'data_troca']
        }
      },
      {
        name: 'consultar_estoque_critico',
        description: 'Consulta itens do estoque que estão abaixo da quantidade mínima recomendada.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            empresa_id: {
              type: Type.NUMBER,
              description: 'ID da empresa.'
            }
          }
        }
      },
      {
        name: 'consultar_saldo_item_estoque',
        description: 'Consulta o saldo atual, unidade de medida, custo unitário e status de reposição de um insumo específico do estoque.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            insumo_termo: {
              type: Type.STRING,
              description: 'Nome do insumo ou produto pesquisado (ex: Camarão, Filé, Cerveja, Limão).'
            },
            empresa_id: {
              type: Type.NUMBER,
              description: 'ID da empresa.'
            }
          },
          required: ['insumo_termo']
        }
      },
      {
        name: 'dar_baixa_estoque',
        description: 'Registra saída, consumo de cozinha/bar ou descarte de perda de um insumo do estoque.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            insumo_termo: {
              type: Type.STRING,
              description: 'Nome do insumo que terá baixa.'
            },
            quantidade: {
              type: Type.NUMBER,
              description: 'Quantidade que está saindo.'
            },
            motivo: {
              type: Type.STRING,
              description: 'Motivo: "Consumo de Cozinha/Bar", "Perda/Quebra", "Avaria", "Descarte" ou "Vencimento".'
            },
            empresa_id: {
              type: Type.NUMBER,
              description: 'ID da empresa.'
            }
          },
          required: ['insumo_termo', 'quantidade']
        }
      },
      {
        name: 'atualizar_saldo_estoque',
        description: 'Atualiza o saldo físico apurado em contagem de estoque/balanço rápido do setor.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            insumo_termo: {
              type: Type.STRING,
              description: 'Nome do insumo contado.'
            },
            nova_quantidade: {
              type: Type.NUMBER,
              description: 'Quantidade real apurada na contagem física.'
            },
            observacao: {
              type: Type.STRING,
              description: 'Observação do balanço.'
            },
            empresa_id: {
              type: Type.NUMBER,
              description: 'ID da empresa.'
            }
          },
          required: ['insumo_termo', 'nova_quantidade']
        }
      },
      {
        name: 'solicitar_compra_insumo',
        description: 'Gera uma requisição de compra ou coloca um insumo na lista de compras urgentes da empresa.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            insumo_termo: {
              type: Type.STRING,
              description: 'Nome do insumo a ser comprado.'
            },
            quantidade_sugerida: {
              type: Type.NUMBER,
              description: 'Quantidade sugerida para compra.'
            },
            observacao: {
              type: Type.STRING,
              description: 'Urgência ou observação da compra.'
            },
            empresa_id: {
              type: Type.NUMBER,
              description: 'ID da empresa.'
            }
          },
          required: ['insumo_termo']
        }
      },
      {
        name: 'solicitar_recebimento_mercadoria',
        description: 'Inicia o registro de recebimento de mercadoria/insumo na porta ou estoque com confirmação em 2 etapas. Atualiza o estoque e opcionalmente gera despesa de compras no Caixa.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            insumo_termo: {
              type: Type.STRING,
              description: 'Nome do insumo recebido.'
            },
            quantidade_recebida: {
              type: Type.NUMBER,
              description: 'Quantidade entregue pelo fornecedor.'
            },
            valor_total: {
              type: Type.NUMBER,
              description: 'Valor total da compra/nota fiscal (R$).'
            },
            fornecedor: {
              type: Type.STRING,
              description: 'Nome do fornecedor ou entregador.'
            },
            lancar_no_caixa: {
              type: Type.BOOLEAN,
              description: 'Se true, registra a saída no Caixa operacional.'
            },
            empresa_id: {
              type: Type.NUMBER,
              description: 'ID da empresa.'
            }
          },
          required: ['insumo_termo', 'quantidade_recebida']
        }
      },
      {
        name: 'solicitar_lancamento_caixa',
        description: 'Inicia o registro de movimentação de caixa (Entrada, Saída, Sangria ou Suprimento) com confirmação em 2 etapas.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            tipo: {
              type: Type.STRING,
              description: 'Tipo da movimentação: "Entrada", "Saída", "Sangria" ou "Suprimento".'
            },
            valor: {
              type: Type.NUMBER,
              description: 'Valor monetário em Reais (R$).'
            },
            descricao: {
              type: Type.STRING,
              description: 'Motivo ou descrição da movimentação.'
            },
            empresa_id: {
              type: Type.NUMBER,
              description: 'ID da empresa.'
            }
          },
          required: ['tipo', 'valor', 'descricao']
        }
      },
      {
        name: 'consultar_resumo_financeiro_caixa',
        description: 'Consulta o resumo financeiro do caixa do dia (total de entradas, saídas, sangrias e saldo atual).',
        parameters: {
          type: Type.OBJECT,
          properties: {
            empresa_id: {
              type: Type.NUMBER,
              description: 'ID da empresa.'
            }
          }
        }
      },
      {
        name: 'consultar_rateio_dia',
        description: 'Consulta a apuração da caixinha/rateio de gorjetas e comissões do dia, mostrando o faturamento base, percentual do pool e valor acumulado.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            data: {
              type: Type.STRING,
              description: 'Data do rateio (AAAA-MM-DD).'
            },
            empresa_id: {
              type: Type.NUMBER,
              description: 'ID da empresa.'
            }
          }
        }
      },
      {
        name: 'solicitar_fechamento_rateio',
        description: 'Inicia o fechamento e distribuição oficial do rateio/gorjeta do dia com confirmação em 2 etapas. Requer permissão financeira ou de gerência.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            data: {
              type: Type.STRING,
              description: 'Data do fechamento do rateio (AAAA-MM-DD).'
            },
            percentual: {
              type: Type.NUMBER,
              description: 'Percentual do pool (padrão: 10%).'
            },
            empresa_id: {
              type: Type.NUMBER,
              description: 'ID da empresa.'
            }
          }
        }
      },
      {
        name: 'consultar_reservas_do_dia',
        description: 'Consulta as reservas de mesas e salão programadas para uma data.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            data: {
              type: Type.STRING,
              description: 'Data no formato AAAA-MM-DD.'
            },
            empresa_id: {
              type: Type.NUMBER,
              description: 'ID da empresa.'
            }
          }
        }
      },
      {
        name: 'criar_reserva_salao',
        description: 'Cria uma nova reserva de mesa no salão com cliente, horário, número de pagantes e mesa.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            cliente: {
              type: Type.STRING,
              description: 'Nome do cliente que fez a reserva.'
            },
            data: {
              type: Type.STRING,
              description: 'Data da reserva (AAAA-MM-DD).'
            },
            hora: {
              type: Type.STRING,
              description: 'Horário da reserva (ex: 20:00).'
            },
            adultos_pagantes: {
              type: Type.NUMBER,
              description: 'Número de adultos na reserva.'
            },
            mesa: {
              type: Type.STRING,
              description: 'Número ou identificador da mesa (ex: 4, 12, Varanda).'
            },
            area: {
              type: Type.STRING,
              description: 'Área do restaurante: "Salão Principal", "Varanda", "Climatizado" ou "Deck".'
            },
            whatsapp: {
              type: Type.STRING,
              description: 'WhatsApp do cliente.'
            },
            observacoes: {
              type: Type.STRING,
              description: 'Observações como aniversário, comemoração, etc.'
            },
            empresa_id: {
              type: Type.NUMBER,
              description: 'ID da empresa.'
            }
          },
          required: ['cliente', 'hora', 'adultos_pagantes']
        }
      },
      {
        name: 'atualizar_status_reserva',
        description: 'Atualiza o status de uma reserva (Confirmada, Cliente no Salão, Concluída ou Cancelada).',
        parameters: {
          type: Type.OBJECT,
          properties: {
            cliente_ou_mesa: {
              type: Type.STRING,
              description: 'Nome do cliente ou número da mesa.'
            },
            novo_status: {
              type: Type.STRING,
              description: 'Status: "Confirmada", "Cliente no Salão", "Concluída", "Cancelada" ou "No-show".'
            },
            empresa_id: {
              type: Type.NUMBER,
              description: 'ID da empresa.'
            }
          },
          required: ['cliente_ou_mesa', 'novo_status']
        }
      },
      {
        name: 'consultar_agenda_operacional',
        description: 'Consulta tarefas, compromissos e reuniões agendadas para o estabelecimento.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            data: {
              type: Type.STRING,
              description: 'Data da consulta (AAAA-MM-DD).'
            },
            empresa_id: {
              type: Type.NUMBER,
              description: 'ID da empresa.'
            }
          }
        }
      },
      {
        name: 'criar_compromisso_agenda',
        description: 'Registra uma nova tarefa ou compromisso operacional na agenda da empresa.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            titulo: {
              type: Type.STRING,
              description: 'Título do compromisso ou tarefa.'
            },
            data: {
              type: Type.STRING,
              description: 'Data (AAAA-MM-DD).'
            },
            hora: {
              type: Type.STRING,
              description: 'Hora (ex: 15:30).'
            },
            tipo: {
              type: Type.STRING,
              description: 'Tipo: "Tarefa", "Reunião", "Manutenção", "Auditoria" ou "Visita".'
            },
            descricao: {
              type: Type.STRING,
              description: 'Detalhes adicionais.'
            },
            empresa_id: {
              type: Type.NUMBER,
              description: 'ID da empresa.'
            }
          },
          required: ['titulo']
        }
      },
      {
        name: 'consultar_status_checklists',
        description: 'Consulta a lista de checklists e POPs operacionais do dia.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            setor: {
              type: Type.STRING,
              description: 'Filtro opcional por nome do setor ou palavra-chave.'
            },
            empresa_id: {
              type: Type.NUMBER,
              description: 'ID da empresa.'
            }
          }
        }
      },
      {
        name: 'concluir_checklist_setor',
        description: 'Marca um checklist/POP operacional como concluído pelo colaborador no turno.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            termo_checklist: {
              type: Type.STRING,
              description: 'Nome, setor ou palavra-chave do checklist concluído.'
            },
            observacao: {
              type: Type.STRING,
              description: 'Observação opcional.'
            },
            empresa_id: {
              type: Type.NUMBER,
              description: 'ID da empresa.'
            }
          },
          required: ['termo_checklist']
        }
      },
      {
        name: 'criar_item_checklist',
        description: 'Cria um novo checklist/POP operacional para um setor. Requer cargo de Gerente ou Supervisor.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            titulo: {
              type: Type.STRING,
              description: 'Título do checklist/POP.'
            },
            frequencia: {
              type: Type.STRING,
              description: 'Frequência: "Diária", "Semanal", "Mensal" ou "Abertura / Fechamento".'
            },
            descricao: {
              type: Type.STRING,
              description: 'Itens ou instruções de conformidade.'
            },
            empresa_id: {
              type: Type.NUMBER,
              description: 'ID da empresa.'
            }
          },
          required: ['titulo']
        }
      },
      {
        name: 'solicitar_adiantamento_vale',
        description: 'Inicia solicitação de Adiantamento Salarial / Vale para um colaborador com confirmação em 2 etapas. Registra no prontuário de RH e gera saída no Caixa.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            colaborador_nome: {
              type: Type.STRING,
              description: 'Nome do colaborador beneficiário do vale.'
            },
            valor: {
              type: Type.NUMBER,
              description: 'Valor do adiantamento em Reais (R$).'
            },
            motivo: {
              type: Type.STRING,
              description: 'Motivo ou observação do adiantamento.'
            },
            empresa_id: {
              type: Type.NUMBER,
              description: 'ID da empresa.'
            }
          },
          required: ['colaborador_nome', 'valor']
        }
      },
      {
        name: 'consultar_prontuario_rh',
        description: 'Consulta o histórico de prontuário, ocorrências, advertências e vales de um colaborador.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            colaborador_nome: {
              type: Type.STRING,
              description: 'Nome do colaborador para consulta.'
            },
            empresa_id: {
              type: Type.NUMBER,
              description: 'ID da empresa.'
            }
          },
          required: ['colaborador_nome']
        }
      },
      {
        name: 'consultar_cmv_produto',
        description: 'Consulta o Custo de Mercadorias Vendidas (CMV), custo unitário de insumo e margem de prato/drink ou apuração geral da empresa.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            termo_busca: {
              type: Type.STRING,
              description: 'Nome do insumo ou prato para análise de custo e CMV.'
            },
            empresa_id: {
              type: Type.NUMBER,
              description: 'ID da empresa.'
            }
          }
        }
      },
      {
        name: 'buscar_freelancers_match',
        description: 'Busca freelancers disponíveis por match de função e teto de diária. Requer cargo de Gestor/RH.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            funcao: {
              type: Type.STRING,
              description: 'Função desejada (Garçom, Cozinheiro, Cumim, Bartender, Limpeza).'
            },
            max_diaria: {
              type: Type.NUMBER,
              description: 'Valor máximo da diária em Reais.'
            },
            empresa_id: {
              type: Type.NUMBER,
              description: 'ID da empresa.'
            }
          },
          required: ['funcao']
        }
      },
      {
        name: 'solicitar_contratacao_freelancer',
        description: 'Inicia a contratação de freelancer com confirmação em 2 etapas.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            freelancer_id: {
              type: Type.NUMBER,
              description: 'ID do freelancer.'
            },
            funcao: {
              type: Type.STRING,
              description: 'Função contratada.'
            },
            data: {
              type: Type.STRING,
              description: 'Data da diária (AAAA-MM-DD).'
            },
            valor_diaria: {
              type: Type.NUMBER,
              description: 'Valor acordado em Reais.'
            },
            empresa_id: {
              type: Type.NUMBER,
              description: 'ID da empresa.'
            }
          },
          required: ['freelancer_id', 'valor_diaria']
        }
      },
      {
        name: 'registrar_ocorrencia_turno',
        description: 'Registra uma ocorrência de turno, justificativa, atraso ou manutenção na escala.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            tipo_ocorrencia: {
              type: Type.STRING,
              description: 'Tipo da ocorrência.'
            },
            descricao: {
              type: Type.STRING,
              description: 'Descrição detalhada.'
            },
            empresa_id: {
              type: Type.NUMBER,
              description: 'ID da empresa.'
            }
          },
          required: ['descricao']
        }
      }
    ];
  }

  private async executeToolCall(
    name: string,
    args: any,
    telefone: string,
    empresaIdDefault: number,
    permissoes: ColaboradorPermissoesWpp
  ): Promise<any> {
    const db = this.ctx.db;
    const empresaId = Number(args.empresa_id || empresaIdDefault || 1);
    const empresa = db.empresas.find((e: any) => Number(e.id) === empresaId && !e.arquivado_legal) || db.empresas[0];
    const dataHoje = new Date().toISOString().slice(0, 10);
    const horarioAgora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    switch (name) {
      case 'consultar_escalas_do_dia': {
        const dataTarget = args.data || dataHoje;
        const diaSemana = new Date(dataTarget).getDay();
        const escalados = db.usuarios.filter((u: any) => {
          if (u.arquivado_legal) return false;
          try {
            const dias = typeof u.escala_fixa_json === 'string' ? JSON.parse(u.escala_fixa_json) : u.escala_fixa_json;
            return Array.isArray(dias) && dias.includes(diaSemana);
          } catch {
            return false;
          }
        });

        const movimentos = (db.erp_escalas_movimentos || []).filter(
          (m: any) => !m.arquivado_legal && m.data === dataTarget
        );

        return {
          empresa: empresa?.nome || 'Urutau ERP',
          data: dataTarget,
          dia_semana_indice: diaSemana,
          total_escalados: escalados.length,
          equipe: escalados.map((u: any) => ({
            id: u.id,
            nome: u.nome,
            cargo: u.cargo,
            tipo: u.tipo
          })),
          movimentos_extra: movimentos.map((m: any) => ({
            colaborador: m.colaborador,
            tipo: m.tipo,
            motivo: m.motivo
          }))
        };
      }

      case 'lancar_movimento_escala': {
        if (!permissoes.podeGestaoEscalaRH) {
          return {
            erro_permissao: true,
            mensagem: `Acesso restrito: seu cargo (${permissoes.cargo}) não tem permissão para lançar faltas, dobras ou horas extras na escala. Solicite a um Gerente, Supervisor ou RH.`
          };
        }

        const colabNome = String(args.colaborador_nome || '').trim();
        const tipoMov = String(args.tipo_movimento || 'Ocorrência de Escala');
        const motivo = String(args.motivo || 'Registrado via WhatsApp');
        const dataTarget = args.data || dataHoje;

        const novoMov = {
          id: this.ctx.nextId(db.erp_escalas_movimentos),
          colaborador: colabNome,
          data: dataTarget,
          tipo: tipoMov,
          motivo: `${motivo} (Lançado por ${permissoes.nome} • ${permissoes.cargo})`,
          valor_diaria: tipoMov === 'Dobra de Turno' ? Number(empresa?.diaria_teto || 200) : 0,
          criado_em: new Date().toISOString(),
          arquivado_legal: false
        };

        db.erp_escalas_movimentos.unshift(novoMov);
        this.ctx.saveDbToDisk();
        this.ctx.sseBroker.emit('escala.atualizada', novoMov);
        await this.ctx.registrarAuditLog(
          permissoes.nome,
          'MOVIMENTO_ESCALA_WPP',
          `${tipoMov} lançado para ${colabNome} na data ${dataTarget}: ${motivo}`,
          '127.0.0.1',
          permissoes.cargo
        );

        return {
          ok: true,
          colaborador: colabNome,
          tipo: tipoMov,
          data: dataTarget,
          motivo,
          registrado_por: `${permissoes.nome} (${permissoes.cargo})`
        };
      }

      case 'solicitar_troca_turno': {
        const sol = String(args.colaborador_solicitante || '').trim();
        const sub = String(args.colaborador_substituto || '').trim();
        const dt = String(args.data_troca || dataHoje).trim();
        const mot = String(args.motivo || 'Troca de folga/turno acordada entre a equipe').trim();

        const movTroca = {
          id: this.ctx.nextId(db.erp_escalas_movimentos),
          colaborador: `${sol} ⇄ ${sub}`,
          data: dt,
          tipo: 'Troca de Turno',
          motivo: `${mot} (Registrado via WhatsApp por ${permissoes.nome})`,
          valor_diaria: 0,
          criado_em: new Date().toISOString(),
          arquivado_legal: false
        };

        db.erp_escalas_movimentos.unshift(movTroca);
        this.ctx.saveDbToDisk();
        this.ctx.sseBroker.emit('escala.atualizada', movTroca);
        await this.ctx.registrarAuditLog(
          permissoes.nome,
          'TROCA_TURNO_WPP',
          `Troca de turno entre ${sol} e ${sub} na data ${dt}: ${mot}`,
          '127.0.0.1',
          permissoes.cargo
        );

        return {
          ok: true,
          solicitante: sol,
          substituto: sub,
          data: dt,
          motivo: mot
        };
      }

      case 'consultar_estoque_critico': {
        const criticos = (db.erp_estoque || []).filter(
          (e: any) => !e.arquivado_legal && Number(e.quantidade) <= Number(e.estoque_minimo)
        );

        return {
          empresa: empresa?.nome,
          total_criticos: criticos.length,
          itens: criticos.map((e: any) => ({
            id: e.id,
            nome: e.nome,
            quantidade_atual: e.quantidade,
            minimo_recomendado: e.estoque_minimo,
            unidade: e.unidade_medida || e.unidade || 'un',
            categoria: e.categoria,
            fornecedor: e.fornecedor
          }))
        };
      }

      case 'consultar_saldo_item_estoque': {
        const termo = String(args.insumo_termo || '').toLowerCase().trim();
        const itens = (db.erp_estoque || []).filter(
          (e: any) => !e.arquivado_legal && String(e.nome || '').toLowerCase().includes(termo)
        );

        if (itens.length === 0) {
          return {
            encontrado: false,
            mensagem: `Nenhum insumo encontrado no estoque com o termo "${args.insumo_termo}".`
          };
        }

        return {
          encontrado: true,
          total_encontrados: itens.length,
          itens: itens.map((e: any) => ({
            id: e.id,
            nome: e.nome,
            quantidade_atual: e.quantidade,
            unidade: e.unidade_medida || e.unidade || 'un',
            custo_unitario: Number(e.custo_unitario || 0),
            estoque_minimo: Number(e.estoque_minimo || 0),
            status: e.quantidade <= Number(e.estoque_minimo || 0) ? 'Crítico (Reposição Necessária)' : 'Normal',
            em_compras: !!e.em_compras
          }))
        };
      }

      case 'dar_baixa_estoque': {
        const termo = String(args.insumo_termo || '').toLowerCase().trim();
        const qtdBaixa = Math.abs(Number(args.quantidade || 0));
        const motivo = String(args.motivo || 'Consumo Operacional');

        if (qtdBaixa <= 0) return { erro: 'A quantidade de baixa deve ser maior que zero.' };

        const item = (db.erp_estoque || []).find(
          (e: any) => !e.arquivado_legal && String(e.nome || '').toLowerCase().includes(termo)
        );

        if (!item) {
          return { erro: `Insumo "${args.insumo_termo}" não encontrado no estoque para dar baixa.` };
        }

        const qtdAnterior = Number(item.quantidade || 0);
        item.quantidade = Number(Math.max(0, qtdAnterior - qtdBaixa).toFixed(3));
        item.em_compras = item.quantidade <= Number(item.estoque_minimo || 0);

        this.ctx.saveDbToDisk();
        this.ctx.sseBroker.emit('estoque.atualizado', {
          id: item.id,
          nome: item.nome,
          quantidade: item.quantidade
        });

        await this.ctx.registrarAuditLog(
          permissoes.nome,
          'BAIXA_ESTOQUE_WPP',
          `Baixa de ${qtdBaixa} ${item.unidade_medida || 'un'} em "${item.nome}" (${motivo}). Saldo anterior: ${qtdAnterior} -> Novo saldo: ${item.quantidade}`,
          '127.0.0.1',
          permissoes.cargo
        );

        return {
          ok: true,
          insumo: item.nome,
          quantidade_baixada: qtdBaixa,
          unidade: item.unidade_medida || 'un',
          saldo_restante: item.quantidade,
          em_alerta_minimo: item.em_compras,
          motivo,
          responsavel: `${permissoes.nome} (${permissoes.cargo})`
        };
      }

      case 'atualizar_saldo_estoque': {
        const termo = String(args.insumo_termo || '').toLowerCase().trim();
        const novaQtd = Math.max(0, Number(args.nova_quantidade || 0));
        const obs = String(args.observacao || 'Contagem / Balanço de Setor');

        const item = (db.erp_estoque || []).find(
          (e: any) => !e.arquivado_legal && String(e.nome || '').toLowerCase().includes(termo)
        );

        if (!item) {
          return { erro: `Insumo "${args.insumo_termo}" não encontrado no estoque para atualizar saldo.` };
        }

        const anterior = Number(item.quantidade || 0);
        item.quantidade = Number(novaQtd.toFixed(3));
        item.em_compras = item.quantidade <= Number(item.estoque_minimo || 0);

        this.ctx.saveDbToDisk();
        this.ctx.sseBroker.emit('estoque.atualizado', {
          id: item.id,
          nome: item.nome,
          quantidade: item.quantidade
        });

        await this.ctx.registrarAuditLog(
          permissoes.nome,
          'BALANCO_ESTOQUE_WPP',
          `Balanço físico em "${item.nome}": ajustado de ${anterior} para ${novaQtd} ${item.unidade_medida || 'un'}. ${obs}`,
          '127.0.0.1',
          permissoes.cargo
        );

        return {
          ok: true,
          insumo: item.nome,
          saldo_anterior: anterior,
          novo_saldo: novaQtd,
          unidade: item.unidade_medida || 'un',
          status: item.em_compras ? 'Crítico (Reposição Necessária)' : 'Normal',
          responsavel: `${permissoes.nome} (${permissoes.cargo})`
        };
      }

      case 'solicitar_compra_insumo': {
        const termo = String(args.insumo_termo || '').toLowerCase().trim();
        const qtdSug = Number(args.quantidade_sugerida || 0);
        const obs = String(args.observacao || 'Requisição via WhatsApp');

        let item = (db.erp_estoque || []).find(
          (e: any) => !e.arquivado_legal && String(e.nome || '').toLowerCase().includes(termo)
        );

        if (item) {
          item.em_compras = true;
          item.observacao_compra = obs;
          if (qtdSug > 0) item.quantidade_sugerida_compra = qtdSug;
        }

        this.ctx.saveDbToDisk();
        this.ctx.sseBroker.emit('estoque.atualizado', item || { nome: args.insumo_termo, em_compras: true });

        await this.ctx.registrarAuditLog(
          permissoes.nome,
          'REQUISICAO_COMPRA_WPP',
          `Insumo "${args.insumo_termo}" adicionado à lista de compras${qtdSug > 0 ? ` (+${qtdSug})` : ''}: ${obs}`,
          '127.0.0.1',
          permissoes.cargo
        );

        return {
          ok: true,
          insumo: item ? item.nome : args.insumo_termo,
          quantidade_sugerida: qtdSug > 0 ? qtdSug : 'A definir',
          status_compra: 'Adicionado à Lista de Compras do ERP',
          solicitante: `${permissoes.nome} (${permissoes.cargo})`
        };
      }

      case 'solicitar_recebimento_mercadoria': {
        const termo = String(args.insumo_termo || '').toLowerCase().trim();
        const qtdRec = Math.abs(Number(args.quantidade_recebida || 0));
        const valorTot = Math.abs(Number(args.valor_total || 0));
        const forn = String(args.fornecedor || 'Fornecedor Local');
        const lancarCaixa = args.lancar_no_caixa !== false;

        if (qtdRec <= 0) return { erro: 'A quantidade recebida deve ser maior que zero.' };

        const item = (db.erp_estoque || []).find(
          (e: any) => !e.arquivado_legal && String(e.nome || '').toLowerCase().includes(termo)
        );

        const nomeInsumo = item ? item.nome : args.insumo_termo;
        const unidade = item ? (item.unidade_medida || 'un') : 'un';
        const actionId = `act_rec_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        const pending: PendingAction = {
          id: actionId,
          telefone,
          empresa_id: empresaId,
          operador_nome: permissoes.nome,
          operador_cargo: permissoes.cargo,
          tipo: 'RECEBIMENTO_MERCADORIA',
          resumo: `Recebimento de ${qtdRec} ${unidade} de "${nomeInsumo}" de ${forn}${valorTot > 0 ? ` por R$ ${valorTot.toFixed(2)}${lancarCaixa ? ' (com saída no Caixa)' : ''}` : ''}`,
          payload: {
            empresa_id: empresaId,
            item_id: item ? item.id : null,
            nomeInsumo,
            quantidade_recebida: qtdRec,
            valor_total: valorTot,
            fornecedor: forn,
            lancar_no_caixa: lancarCaixa,
            data: dataHoje
          },
          criado_em: Date.now(),
          expira_em: Date.now() + 10 * 60 * 1000
        };

        this.pendingActions.set(telefone, pending);

        return {
          status: 'PENDENTE_CONFIRMACAO',
          action_id: actionId,
          resumo: pending.resumo,
          instrucao_para_o_bot: 'Apresente o resumo do recebimento com fornecedor, quantidade e valor. Peça confirmação explícita ("Sim" para efetivar ou "Não" para cancelar).'
        };
      }

      case 'solicitar_lancamento_caixa': {
        if (!permissoes.podeFinanceiroCaixa) {
          await this.ctx.registrarAuditLog(
            permissoes.nome,
            'ACESSO_NEGADO_CARGO_WPP',
            `Cargo [${permissoes.cargo}] tentou lançar no caixa via WhatsApp sem permissão financeira.`,
            '127.0.0.1',
            permissoes.cargo
          );
          return {
            erro_permissao: true,
            mensagem: `Acesso restrito: seu cargo (${permissoes.cargo}) não possui permissão para realizar lançamentos financeiros no Caixa. Solicite a um Operador de Caixa ou Gerente.`
          };
        }

        const valor = Math.abs(Number(args.valor || 0));
        const tipo = String(args.tipo || 'Saída');
        const desc = String(args.descricao || 'Lançamento via WhatsApp');

        if (valor <= 0) return { erro: 'Valor do lançamento deve ser maior que zero.' };

        const actionId = `act_fin_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const pending: PendingAction = {
          id: actionId,
          telefone,
          empresa_id: empresaId,
          operador_nome: permissoes.nome,
          operador_cargo: permissoes.cargo,
          tipo: 'FINANCEIRO_CAIXA',
          resumo: `${tipo.toUpperCase()} de R$ ${valor.toFixed(2)} — "${desc}" (Responsável: ${permissoes.nome} • ${permissoes.cargo})`,
          payload: {
            empresa_id: empresaId,
            tipo,
            valor,
            descricao: desc,
            operador: permissoes.nome,
            cargo: permissoes.cargo,
            data: dataHoje
          },
          criado_em: Date.now(),
          expira_em: Date.now() + 10 * 60 * 1000
        };

        this.pendingActions.set(telefone, pending);

        return {
          status: 'PENDENTE_CONFIRMACAO',
          action_id: actionId,
          resumo: pending.resumo,
          instrucao_para_o_bot: 'Apresente este resumo ao usuário detalhando tipo, valor e descrição. Peça a confirmação explícita ("Confirmar" ou "Sim") antes de salvar.'
        };
      }

      case 'consultar_resumo_financeiro_caixa': {
        if (!permissoes.podeFinanceiroCaixa) {
          return {
            erro_permissao: true,
            mensagem: `Acesso restrito: seu cargo (${permissoes.cargo}) não possui autorização para consultar o saldo financeiro e faturamento do Caixa.`
          };
        }

        const lancamentosHoje = (db.erp_caixa || []).filter((c: any) => !c.arquivado_legal && c.data === dataHoje);

        let entradas = 0;
        let saidas = 0;
        lancamentosHoje.forEach((l: any) => {
          const val = Number(l.valor || 0);
          if (l.tipo === 'Entrada' || l.tipo === 'Suprimento') entradas += val;
          else saidas += val;
        });

        const saldoHoje = entradas - saidas;

        return {
          empresa: empresa?.nome,
          data: dataHoje,
          total_lancamentos: lancamentosHoje.length,
          total_entradas: entradas,
          total_saidas: saidas,
          saldo_dia: saldoHoje,
          extrato_recente: lancamentosHoje.slice(0, 5).map((l: any) => ({
            tipo: l.tipo,
            valor: l.valor,
            descricao: l.descricao,
            horario: l.criado_em ? new Date(l.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '00:00'
          }))
        };
      }

      case 'consultar_rateio_dia': {
        const dataTarget = args.data || dataHoje;
        const lancamentosEntrada = (db.erp_caixa || []).filter(
          (c: any) => !c.arquivado_legal && c.data === dataTarget && c.tipo === 'Entrada'
        );
        const faturamento = lancamentosEntrada.reduce((acc: number, c: any) => acc + Number(c.valor || 0), 0);
        const poolCalculado = Number((faturamento * 0.1).toFixed(2));

        const fechamentoExistente = (db.erp_rateios_historico || []).find(
          (r: any) => !r.arquivado_legal && r.data === dataTarget
        );

        const colaboradoresAptos = (db.usuarios || []).filter(
          (u: any) => !u.arquivado_legal && u.participa_rateio_10 !== false
        );

        return {
          data: dataTarget,
          faturamento_base: faturamento,
          percentual_pool: fechamentoExistente ? fechamentoExistente.percentual_pool : 10,
          valor_pool: fechamentoExistente ? fechamentoExistente.valor_pool : poolCalculado,
          status: fechamentoExistente ? 'Fechado Oficialmente' : 'Aberto em Andamento',
          total_colaboradores_aptos: colaboradoresAptos.length,
          estimativa_por_colaborador: colaboradoresAptos.length > 0
            ? Number(((fechamentoExistente ? fechamentoExistente.valor_pool : poolCalculado) / colaboradoresAptos.length).toFixed(2))
            : 0
        };
      }

      case 'solicitar_fechamento_rateio': {
        if (!permissoes.podeFinanceiroCaixa) {
          return {
            erro_permissao: true,
            mensagem: `Acesso restrito: seu cargo (${permissoes.cargo}) não tem alçada para fechar o rateio de gorjetas. Solicite à gerência financeira.`
          };
        }

        const dataTarget = args.data || dataHoje;
        const perc = Number(args.percentual || 10);
        const lancamentosEntrada = (db.erp_caixa || []).filter(
          (c: any) => !c.arquivado_legal && c.data === dataTarget && c.tipo === 'Entrada'
        );
        const faturamento = lancamentosEntrada.reduce((acc: number, c: any) => acc + Number(c.valor || 0), 0);
        const valorPool = Number(((faturamento * perc) / 100).toFixed(2));

        const actionId = `act_rat_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const pending: PendingAction = {
          id: actionId,
          telefone,
          empresa_id: empresaId,
          operador_nome: permissoes.nome,
          operador_cargo: permissoes.cargo,
          tipo: 'FECHAMENTO_RATEIO',
          resumo: `Fechamento do Rateio de ${dataTarget}: Pool de ${perc}% sobre R$ ${faturamento.toFixed(2)} = R$ ${valorPool.toFixed(2)} (Responsável: ${permissoes.nome})`,
          payload: {
            empresa_id: empresaId,
            data: dataTarget,
            faturamento_bruto: faturamento,
            percentual_pool: perc,
            valor_pool: valorPool
          },
          criado_em: Date.now(),
          expira_em: Date.now() + 10 * 60 * 1000
        };

        this.pendingActions.set(telefone, pending);

        return {
          status: 'PENDENTE_CONFIRMACAO',
          action_id: actionId,
          resumo: pending.resumo,
          instrucao_para_o_bot: 'Apresente o resumo do fechamento com data, percentual e valor do pool. Peça resposta "Sim" para oficializar no sistema ou "Não" para cancelar.'
        };
      }

      case 'consultar_reservas_do_dia': {
        const dataTarget = args.data || dataHoje;
        const reservas = (db.reservas || []).filter((r: any) => !r.arquivado_legal && r.data === dataTarget);

        return {
          empresa: empresa?.nome,
          data: dataTarget,
          total_reservas: reservas.length,
          lista: reservas.map((r: any) => ({
            cliente: r.cliente,
            hora: r.hora,
            mesa: r.mesa || 'Balcão',
            area: r.area || 'Salão',
            adultos_pagantes: r.adultos_pagantes,
            criancas_pagantes: r.criancas_pagantes || 0,
            status: r.status || 'Confirmada',
            observacoes: r.observacoes || ''
          }))
        };
      }

      case 'criar_reserva_salao': {
        const cliente = String(args.cliente || '').trim();
        const hora = String(args.hora || '20:00').trim();
        const adultos = Number(args.adultos_pagantes || 2);
        const dataTarget = args.data || dataHoje;
        const mesa = args.mesa ? String(args.mesa) : 'A definir';
        const area = args.area ? String(args.area) : 'Salão Principal';
        const obs = args.observacoes ? String(args.observacoes) : '';
        const wpp = args.whatsapp ? String(args.whatsapp) : '';

        if (!cliente) return { erro: 'Informe o nome do cliente para a reserva.' };

        const novaReserva = {
          id: this.ctx.nextId(db.reservas),
          cliente,
          whatsapp: wpp,
          data: dataTarget,
          hora,
          mesa,
          area,
          adultos_pagantes: adultos,
          criancas_pagantes: 0,
          status: 'Confirmada',
          observacoes: obs ? `${obs} (Via WhatsApp: ${permissoes.nome})` : `Registrada via WhatsApp por ${permissoes.nome}`,
          unidade_id: 1,
          arquivado_legal: false,
          criado_em: new Date().toISOString()
        };

        db.reservas.push(novaReserva);
        this.ctx.saveDbToDisk();
        this.ctx.sseBroker.emit('reserva.atualizada', novaReserva);

        await this.ctx.registrarAuditLog(
          permissoes.nome,
          'CRIAR_RESERVA_WPP',
          `Reserva criada para ${cliente} em ${dataTarget} às ${hora} (Mesa ${mesa}, ${adultos} pessoas)`,
          '127.0.0.1',
          permissoes.cargo
        );

        return {
          ok: true,
          id: novaReserva.id,
          cliente,
          data: dataTarget,
          hora,
          mesa,
          area,
          adultos_pagantes: adultos,
          status: 'Confirmada'
        };
      }

      case 'atualizar_status_reserva': {
        const busca = String(args.cliente_ou_mesa || '').toLowerCase().trim();
        const novoStatus = String(args.novo_status || 'Confirmada');

        const reserva = (db.reservas || []).find((r: any) => {
          if (r.arquivado_legal) return false;
          const cli = String(r.cliente || '').toLowerCase();
          const mes = String(r.mesa || '').toLowerCase();
          return cli.includes(busca) || mes === busca;
        });

        if (!reserva) {
          return { erro: `Reserva correspondente a "${args.cliente_ou_mesa}" não foi localizada para atualizar status.` };
        }

        reserva.status = novoStatus;
        this.ctx.saveDbToDisk();
        this.ctx.sseBroker.emit('reserva.atualizada', reserva);

        await this.ctx.registrarAuditLog(
          permissoes.nome,
          'STATUS_RESERVA_WPP',
          `Status da reserva de ${reserva.cliente} (Mesa ${reserva.mesa}) alterado para "${novoStatus}"`,
          '127.0.0.1',
          permissoes.cargo
        );

        return {
          ok: true,
          cliente: reserva.cliente,
          mesa: reserva.mesa,
          novo_status: novoStatus,
          horario: reserva.hora
        };
      }

      case 'consultar_agenda_operacional': {
        const dataTarget = args.data || dataHoje;
        const eventos = (db.eventos_agenda || []).filter(
          (e: any) => !e.arquivado_legal && (e.data === dataTarget || !args.data)
        );

        return {
          empresa: empresa?.nome,
          data_filtro: dataTarget,
          total_eventos: eventos.length,
          eventos: eventos.map((e: any) => ({
            id: e.id,
            titulo: e.titulo,
            data: e.data,
            hora: e.hora || '19:00',
            tipo: e.tipo || 'Tarefa',
            descricao: e.descricao || '',
            concluido: !!e.concluido
          }))
        };
      }

      case 'criar_compromisso_agenda': {
        const titulo = String(args.titulo || '').trim();
        const dataTarget = args.data || dataHoje;
        const hora = args.hora || '19:00';
        const tipo = args.tipo || 'Tarefa';
        const desc = args.descricao || `Criado via WhatsApp por ${permissoes.nome}`;

        if (!titulo) return { erro: 'Informe o título do compromisso/tarefa.' };

        const novoEvento = {
          id: this.ctx.nextId(db.eventos_agenda),
          titulo,
          data: dataTarget,
          hora,
          tipo,
          cor: '#10B981',
          descricao: `${desc} (Registrado por ${permissoes.nome} • ${permissoes.cargo})`,
          unidade_id: 1,
          setor_id: 0,
          usuario_id: 1,
          concluido: false,
          arquivado_legal: false,
          criado_em: new Date().toISOString()
        };

        db.eventos_agenda.push(novoEvento);
        this.ctx.saveDbToDisk();
        this.ctx.sseBroker.emit('agenda.atualizada', novoEvento);

        await this.ctx.registrarAuditLog(
          permissoes.nome,
          'CRIAR_AGENDA_WPP',
          `Compromisso "${titulo}" registrado para ${dataTarget} às ${hora}`,
          '127.0.0.1',
          permissoes.cargo
        );

        return {
          ok: true,
          id: novoEvento.id,
          titulo,
          data: dataTarget,
          hora,
          tipo
        };
      }

      case 'consultar_status_checklists': {
        const filtro = String(args.setor || '').toLowerCase().trim();
        const ativos = (db.checklists || []).filter((c: any) => {
          if (c.arquivado_legal) return false;
          if (!filtro) return true;
          const titulo = String(c.titulo || c.nome || '').toLowerCase();
          const desc = String(c.descricao || '').toLowerCase();
          return titulo.includes(filtro) || desc.includes(filtro);
        });

        const concluidosList = ativos.filter((c: any) => c.status_execucao === 'Concluído' || c.concluido_hoje === true);
        const total = ativos.length;
        const concluidos = concluidosList.length;

        return {
          empresa: empresa?.nome,
          total_rotinas: total,
          rotinas_concluidas: concluidos,
          rotinas_pendentes: total - concluidos,
          conformidade_percentual: total > 0 ? Math.round((concluidos / total) * 100) : 100,
          checklists: ativos.map((c: any) => ({
            id: c.id,
            titulo: c.titulo || c.nome,
            frequencia: c.frequencia || 'Diária',
            status_execucao: c.status_execucao || 'Pendente',
            ultimo_executor: c.ultimo_executor || 'Aguardando execução',
            ultima_conclusao: c.ultima_conclusao || null
          }))
        };
      }

      case 'concluir_checklist_setor': {
        const termo = String(args.termo_checklist || '').toLowerCase().trim();
        const obs = String(args.observacao || '').trim();
        const ativos = (db.checklists || []).filter((c: any) => !c.arquivado_legal);

        let alvo = ativos.find((c: any) => {
          const titulo = String(c.titulo || c.nome || '').toLowerCase();
          const desc = String(c.descricao || '').toLowerCase();
          return titulo.includes(termo) || termo.includes(titulo) || (termo.length >= 3 && desc.includes(termo));
        });

        if (!alvo) {
          const novoChecklist = {
            id: this.ctx.nextId(db.checklists),
            titulo: args.termo_checklist || 'Checklist Operacional de Turno',
            frequencia: 'Diária',
            obrigatorio_foto: false,
            descricao: obs || `Execução registrada via WhatsApp por ${permissoes.nome} (${permissoes.cargo})`,
            status_execucao: 'Concluído',
            concluido_hoje: true,
            ultimo_executor: `${permissoes.nome} (${permissoes.cargo})`,
            ultima_conclusao: `${dataHoje} às ${horarioAgora}`,
            observacao_execucao: obs,
            arquivado_legal: false
          };
          db.checklists.push(novoChecklist);
          alvo = novoChecklist;
        } else {
          alvo.status_execucao = 'Concluído';
          alvo.concluido_hoje = true;
          alvo.ultimo_executor = `${permissoes.nome} (${permissoes.cargo})`;
          alvo.ultima_conclusao = `${dataHoje} às ${horarioAgora}`;
          if (obs) alvo.observacao_execucao = obs;
        }

        this.ctx.saveDbToDisk();
        this.ctx.sseBroker.emit('checklist.atualizado', alvo);
        await this.ctx.registrarAuditLog(
          permissoes.nome,
          'CHECKLIST_CONCLUIDO_WPP',
          `Checklist "${alvo.titulo || alvo.nome}" marcado como Concluído via WhatsApp por ${permissoes.nome} (${permissoes.cargo}).`,
          '127.0.0.1',
          permissoes.cargo
        );

        return {
          ok: true,
          checklist_id: alvo.id,
          titulo: alvo.titulo || alvo.nome,
          status: 'Concluído',
          executor: `${permissoes.nome} (${permissoes.cargo})`,
          horario: horarioAgora,
          data: dataHoje
        };
      }

      case 'criar_item_checklist': {
        if (!permissoes.podeGestaoEscalaRH) {
          return {
            erro_permissao: true,
            mensagem: `Acesso restrito: seu cargo (${permissoes.cargo}) não tem alçada para criar novos POPs/Checklists. Solicite ao Supervisor ou Gerente.`
          };
        }

        const titulo = String(args.titulo || '').trim();
        const freq = args.frequencia || 'Diária';
        const desc = args.descricao || `Criado via WhatsApp por ${permissoes.nome}`;

        if (!titulo) return { erro: 'Informe o título do novo checklist.' };

        const novoC = {
          id: this.ctx.nextId(db.checklists),
          titulo,
          frequencia: freq,
          obrigatorio_foto: false,
          descricao: `${desc} (Criado por ${permissoes.nome} • ${permissoes.cargo})`,
          status_execucao: 'Pendente',
          concluido_hoje: false,
          arquivado_legal: false
        };

        db.checklists.push(novoC);
        this.ctx.saveDbToDisk();
        this.ctx.sseBroker.emit('checklist.atualizado', novoC);

        await this.ctx.registrarAuditLog(
          permissoes.nome,
          'CRIAR_CHECKLIST_WPP',
          `Checklist "${titulo}" (${freq}) criado via WhatsApp.`,
          '127.0.0.1',
          permissoes.cargo
        );

        return {
          ok: true,
          id: novoC.id,
          titulo,
          frequencia: freq
        };
      }

      case 'solicitar_adiantamento_vale': {
        if (!permissoes.podeFinanceiroCaixa && !permissoes.podeGestaoEscalaRH) {
          return {
            erro_permissao: true,
            mensagem: `Acesso restrito: seu cargo (${permissoes.cargo}) não pode aprovar vales ou adiantamentos salariais.`
          };
        }

        const colabNome = String(args.colaborador_nome || '').trim();
        const valor = Math.abs(Number(args.valor || 0));
        const motivo = String(args.motivo || 'Adiantamento de Vale Salarial');

        if (valor <= 0) return { erro: 'O valor do vale deve ser maior que zero.' };

        const targetUser = (db.usuarios || []).find(
          (u: any) => !u.arquivado_legal && String(u.nome || '').toLowerCase().includes(colabNome.toLowerCase())
        );

        const actionId = `act_val_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const pending: PendingAction = {
          id: actionId,
          telefone,
          empresa_id: empresaId,
          operador_nome: permissoes.nome,
          operador_cargo: permissoes.cargo,
          tipo: 'ADIANTAMENTO_VALE',
          resumo: `Adiantamento Salarial / Vale de R$ ${valor.toFixed(2)} para ${targetUser ? targetUser.nome : colabNome} (${motivo}) com saída de Caixa`,
          payload: {
            empresa_id: empresaId,
            usuario_id: targetUser ? targetUser.id : 1,
            colaborador_nome: targetUser ? targetUser.nome : colabNome,
            valor,
            motivo,
            data: dataHoje
          },
          criado_em: Date.now(),
          expira_em: Date.now() + 10 * 60 * 1000
        };

        this.pendingActions.set(telefone, pending);

        return {
          status: 'PENDENTE_CONFIRMACAO',
          action_id: actionId,
          resumo: pending.resumo,
          instrucao_para_o_bot: 'Apresente o resumo do vale com colaborador e valor. Peça resposta "Sim" para autorizar e gravar no caixa ou "Não" para cancelar.'
        };
      }

      case 'consultar_prontuario_rh': {
        const colabNome = String(args.colaborador_nome || '').toLowerCase().trim();
        const targetUser = (db.usuarios || []).find(
          (u: any) => !u.arquivado_legal && String(u.nome || '').toLowerCase().includes(colabNome)
        );

        if (!targetUser) {
          return { erro: `Colaborador "${args.colaborador_nome}" não foi localizado na equipe.` };
        }

        const registros = (db.erp_rh_nr01 || []).filter(
          (r: any) => !r.arquivado_legal && Number(r.usuario_id) === Number(targetUser.id)
        );

        return {
          colaborador: targetUser.nome,
          cargo: targetUser.cargo,
          tipo: targetUser.tipo,
          total_registros_prontuario: registros.length,
          historico: registros.slice(0, 5).map((r: any) => ({
            categoria: r.categoria,
            titulo: r.titulo,
            data: r.data,
            valor_financeiro: r.valor_financeiro || 0,
            status: r.status
          }))
        };
      }

      case 'consultar_cmv_produto': {
        const termo = String(args.termo_busca || '').toLowerCase().trim();

        const estoqueTotal = (db.erp_estoque || []).reduce(
          (acc: number, item: any) => acc + Number(item.quantidade || 0) * Number(item.custo_unitario || 0),
          0
        );

        const entradasHoje = (db.erp_caixa || []).filter((c: any) => !c.arquivado_legal && c.tipo === 'Entrada');
        const fatHoje = entradasHoje.reduce((acc: number, c: any) => acc + Number(c.valor || 0), 0);
        const comprasHoje = (db.erp_caixa || [])
          .filter((c: any) => !c.arquivado_legal && c.tipo === 'Saída' && String(c.categoria || '').includes('Compras'))
          .reduce((acc: number, c: any) => acc + Number(c.valor || 0), 0);

        let itemEspecifico = null;
        if (termo) {
          itemEspecifico = (db.erp_estoque || []).find(
            (e: any) => !e.arquivado_legal && String(e.nome || '').toLowerCase().includes(termo)
          );
        }

        const cmvEstimadoPeriodo = Math.max(0, comprasHoje);
        const percCmv = fatHoje > 0 ? Number(((cmvEstimadoPeriodo / fatHoje) * 100).toFixed(2)) : 0;

        return {
          empresa: empresa?.nome,
          valor_patrimonio_estoque: Number(estoqueTotal.toFixed(2)),
          faturamento_periodo: fatHoje,
          compras_periodo: comprasHoje,
          cmv_estimado: cmvEstimadoPeriodo,
          percentual_cmv: percCmv,
          item_analisado: itemEspecifico
            ? {
                nome: itemEspecifico.nome,
                custo_unitario: Number(itemEspecifico.custo_unitario || 0),
                unidade: itemEspecifico.unidade_medida || 'un',
                saldo: itemEspecifico.quantidade,
                categoria: itemEspecifico.categoria
              }
            : null
        };
      }

      case 'buscar_freelancers_match': {
        if (!permissoes.podeContratarFreelancer) {
          return {
            erro_permissao: true,
            mensagem: `Acesso restrito: seu cargo atual (${permissoes.cargo}) não possui permissão para buscar ou acionar freelancers. Solicite a um Gerente, Gestor ou RH.`
          };
        }

        const funcaoBuscada = String(args.funcao || '').toLowerCase().trim();
        const maxDiaria = args.max_diaria ? Number(args.max_diaria) : (empresa?.diaria_teto || 250);

        const freelancersMatch = db.freelancers.filter((f: any) => {
          if (f.arquivado_legal || !f.disponivel) return false;

          const funcoesValidas = [f.funcao, ...(f.funcoes_secundarias || [])].map((fn: string) => fn.toLowerCase());
          const matchFuncao = funcoesValidas.some((fn: string) => fn.includes(funcaoBuscada) || funcaoBuscada.includes(fn));
          if (!matchFuncao) return false;

          if (Number(f.valor_diaria) > maxDiaria) return false;

          const empBloqueou = (empresa?.bloqueios_freelancers || []).includes(f.id);
          const freeBloqueou = (f.empresas_bloqueadas || []).includes(empresa?.id);
          if (empBloqueou || freeBloqueou) return false;

          return true;
        });

        return {
          funcao: args.funcao,
          teto_aplicado: maxDiaria,
          empresa: empresa?.nome,
          encontrados: freelancersMatch.length,
          candidatos: freelancersMatch.map((f: any) => ({
            id: f.id,
            nome: f.nome,
            funcao: f.funcao,
            valor_diaria: f.valor_diaria,
            cidade: f.cidade,
            avaliacao: f.avaliacao_estrelas || 5.0,
            diarias_realizadas: f.total_diarias_realizadas || 0
          }))
        };
      }

      case 'solicitar_contratacao_freelancer': {
        if (!permissoes.podeContratarFreelancer) {
          return {
            erro_permissao: true,
            mensagem: `Acesso restrito: seu cargo atual (${permissoes.cargo}) não possui alçada para contratar freelancers via WhatsApp.`
          };
        }

        const free = db.freelancers.find((f: any) => Number(f.id) === Number(args.freelancer_id));
        if (!free) return { erro: 'Freelancer não encontrado no banco de talentos.' };

        const valor = Number(args.valor_diaria || free.valor_diaria);
        const data = args.data || dataHoje;
        const funcao = args.funcao || free.funcao;

        const actionId = `act_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const pending: PendingAction = {
          id: actionId,
          telefone,
          empresa_id: empresaId,
          operador_nome: permissoes.nome,
          operador_cargo: permissoes.cargo,
          tipo: 'CONTRATACAO_FREELANCER',
          resumo: `Contratação de ${free.nome} como ${funcao} na data ${data} por R$ ${valor.toFixed(2)} (Empresa: ${empresa?.nome})`,
          payload: {
            empresa_id: empresaId,
            freelancer_id: free.id,
            freelancer_nome: free.nome,
            funcao,
            data,
            valor_acordado: valor
          },
          criado_em: Date.now(),
          expira_em: Date.now() + 10 * 60 * 1000
        };

        this.pendingActions.set(telefone, pending);

        return {
          status: 'PENDENTE_CONFIRMACAO',
          action_id: actionId,
          resumo: pending.resumo,
          instrucao_para_o_bot: 'Apresente este resumo ao usuário com clareza e peça para ele responder "Confirmar" ou "Sim" para oficializar, ou "Não" para cancelar.'
        };
      }

      case 'registrar_ocorrencia_turno': {
        const tipoOcorrencia = String(args.tipo_ocorrencia || 'Ocorrência de Turno');
        const descricao = String(args.descricao || 'Comunicado operacional registrado via WhatsApp');

        if (!Array.isArray(db.erp_escalas_movimentos)) {
          db.erp_escalas_movimentos = [];
        }

        const novoMovimento = {
          id: this.ctx.nextId(db.erp_escalas_movimentos),
          colaborador: `${permissoes.nome} (${permissoes.cargo})`,
          data: dataHoje,
          tipo: tipoOcorrencia,
          motivo: descricao,
          valor_diaria: 0,
          criado_em: new Date().toISOString(),
          arquivado_legal: false
        };

        db.erp_escalas_movimentos.unshift(novoMovimento);
        this.ctx.saveDbToDisk();
        this.ctx.sseBroker.emit('escala.atualizada', novoMovimento);
        await this.ctx.registrarAuditLog(
          permissoes.nome,
          'OCORRENCIA_TURNO_WPP',
          `${tipoOcorrencia}: "${descricao}" registrado via WhatsApp por ${permissoes.nome} (${permissoes.cargo}).`,
          '127.0.0.1',
          permissoes.cargo
        );

        return {
          ok: true,
          id: novoMovimento.id,
          colaborador: novoMovimento.colaborador,
          tipo: tipoOcorrencia,
          descricao,
          data: dataHoje
        };
      }

      default:
        return { erro: `Ferramenta desconhecida: ${name}` };
    }
  }

  private checkDirectConfirmation(texto: string, telefone: string): { executado: boolean; respostaTexto?: string } {
    const pending = this.pendingActions.get(telefone);
    if (!pending) return { executado: false };

    if (Date.now() > pending.expira_em) {
      this.pendingActions.delete(telefone);
      return {
        executado: true,
        respostaTexto: 'O tempo limite de confirmação de 10 minutos expirou para esta operação. Por favor, solicite a ação novamente caso ainda deseje realizá-la.'
      };
    }

    const t = texto.toLowerCase().trim();
    const isSim = /(^|\b)(sim|confirmar|confirmo|confirma|ok|pode|autorizo|aprovo|beleza|positivo|vai|claro)(\b|$)/i.test(t);
    const isNao = /(^|\b)(não|nao|cancelar|cancela|deixa|abortar|esquece|negativo)(\b|$)/i.test(t);

    if (!isSim && !isNao) {
      return { executado: false };
    }

    this.pendingActions.delete(telefone);

    if (isNao) {
      return {
        executado: true,
        respostaTexto: `Ação cancelada com sucesso conforme sua solicitação:\n*${pending.resumo}*`
      };
    }

    const db = this.ctx.db;
    const dataHoje = new Date().toISOString().slice(0, 10);

    if (pending.tipo === 'FINANCEIRO_CAIXA') {
      const { tipo, valor, descricao, data } = pending.payload;
      const novoId = this.ctx.nextId(db.erp_caixa);
      const novoLancamento = {
        id: novoId,
        tipo,
        valor,
        descricao: `${descricao} (Via WhatsApp: ${pending.operador_nome})`,
        categoria: tipo === 'Entrada' ? 'Receita Operacional' : 'Despesa Operacional',
        forma_pagamento: 'Dinheiro / Caixa',
        data: data || dataHoje,
        status: 'Concluído',
        arquivado_legal: false,
        criado_em: new Date().toISOString()
      };

      db.erp_caixa.unshift(novoLancamento);
      this.ctx.saveDbToDisk();
      this.ctx.sseBroker.emit('caixa.movimentacao_registrada', novoLancamento);
      this.ctx.registrarAuditLog(
        pending.operador_nome || 'WhatsApp AI Bot',
        'LANCAMENTO_CAIXA_CONFIRMADO',
        `${tipo} de R$ ${valor.toFixed(2)} - ${descricao}`,
        '127.0.0.1',
        pending.operador_cargo
      );

      return {
        executado: true,
        respostaTexto: `*Lançamento Efetivado no Caixa!*\n\n• *Tipo:* ${tipo}\n• *Valor:* R$ ${valor.toFixed(2)}\n• *Descrição:* ${descricao}\n• *Operador:* ${pending.operador_nome} (${pending.operador_cargo})\n• *Registro:* #${novoId}\n• *Data:* ${novoLancamento.data}\n\nO saldo do caixa já foi atualizado em tempo real no painel.`
      };
    } else if (pending.tipo === 'CONTRATACAO_FREELANCER') {
      const { empresa_id, freelancer_id, freelancer_nome, funcao, data, valor_acordado } = pending.payload;
      const emp = db.empresas.find((e: any) => Number(e.id) === Number(empresa_id)) || db.empresas[0];
      const free = db.freelancers.find((f: any) => Number(f.id) === Number(freelancer_id));

      const novoMatch = {
        id: this.ctx.nextId(db.matches_contratacoes),
        empresa_id: emp.id,
        empresa_nome: emp.nome,
        freelancer_id: free ? free.id : freelancer_id,
        freelancer_nome,
        data,
        funcao,
        valor_acordado,
        status: `Confirmado via WhatsApp (${pending.operador_nome})`,
        criado_em: new Date().toISOString()
      };

      db.matches_contratacoes.push(novoMatch);
      if (free) {
        free.total_diarias_realizadas = (free.total_diarias_realizadas || 0) + 1;
      }
      this.ctx.saveDbToDisk();
      this.ctx.sseBroker.emit('equipe.contratado_automatico', novoMatch);
      this.ctx.registrarAuditLog(
        pending.operador_nome || 'WhatsApp AI Bot',
        'MATCH_CONTRATADO_CONFIRMADO',
        `${freelancer_nome} (${funcao}) contratado por R$ ${valor_acordado.toFixed(2)}`,
        '127.0.0.1',
        pending.operador_cargo
      );

      return {
        executado: true,
        respostaTexto: `*Contratação de Freelancer Confirmada!*\n\n• *Profissional:* ${freelancer_nome}\n• *Função:* ${funcao}\n• *Data:* ${data}\n• *Diária:* R$ ${valor_acordado.toFixed(2)}\n• *Aprovado por:* ${pending.operador_nome} (${pending.operador_cargo})\n• *Empresa:* ${emp.nome}\n\nO freelancer foi notificado e já está vinculado à escala.`
      };
    } else if (pending.tipo === 'RECEBIMENTO_MERCADORIA') {
      const { item_id, nomeInsumo, quantidade_recebida, valor_total, fornecedor, lancar_no_caixa, data } = pending.payload;
      let item = item_id ? db.erp_estoque.find((e: any) => Number(e.id) === Number(item_id)) : null;
      if (!item) {
        item = db.erp_estoque.find((e: any) => !e.arquivado_legal && String(e.nome || '').toLowerCase().includes(String(nomeInsumo).toLowerCase()));
      }

      if (item) {
        item.quantidade = Number((Number(item.quantidade || 0) + Number(quantidade_recebida)).toFixed(3));
        item.em_compras = item.quantidade <= Number(item.estoque_minimo || 0);
        if (valor_total > 0 && quantidade_recebida > 0) {
          item.custo_unitario = Number((valor_total / quantidade_recebida).toFixed(2));
        }
      }

      let idCaixa = null;
      if (lancar_no_caixa && valor_total > 0) {
        idCaixa = this.ctx.nextId(db.erp_caixa);
        db.erp_caixa.unshift({
          id: idCaixa,
          data: data || dataHoje,
          tipo: 'Saída',
          categoria: 'Compras & Reposição',
          descricao: `Recebimento Compra: ${nomeInsumo} (+${quantidade_recebida} ${item?.unidade_medida || 'un'}) - Fornecedor: ${fornecedor}`,
          expressao: `${quantidade_recebida} * ${(valor_total / quantidade_recebida).toFixed(2)}`,
          valor: valor_total,
          unidade_id: 1,
          usuario_id: 1,
          arquivado_legal: false,
          criado_em: new Date().toISOString()
        });
      }

      this.ctx.saveDbToDisk();
      if (item) this.ctx.sseBroker.emit('estoque.atualizado', item);
      if (idCaixa) this.ctx.sseBroker.emit('caixa.movimentacao_registrada', { id: idCaixa });

      this.ctx.registrarAuditLog(
        pending.operador_nome || 'WhatsApp AI Bot',
        'RECEBIMENTO_MERCADORIA_CONFIRMADO',
        `Entrada de ${quantidade_recebida} em ${nomeInsumo} de ${fornecedor} (Total R$ ${valor_total.toFixed(2)})`,
        '127.0.0.1',
        pending.operador_cargo
      );

      return {
        executado: true,
        respostaTexto: `*Recebimento de Mercadoria Efetivado!*\n\n• *Insumo:* ${nomeInsumo}\n• *Quantidade Adicionada:* +${quantidade_recebida} ${item?.unidade_medida || 'un'}\n• *Novo Saldo em Estoque:* ${item ? item.quantidade : quantidade_recebida} ${item?.unidade_medida || 'un'}\n• *Fornecedor:* ${fornecedor}${valor_total > 0 ? `\n• *Valor Total:* R$ ${valor_total.toFixed(2)}${lancar_no_caixa ? ' (Despesa lançada no Caixa)' : ''}` : ''}\n• *Recebido por:* ${pending.operador_nome} (${pending.operador_cargo})`
      };
    } else if (pending.tipo === 'FECHAMENTO_RATEIO') {
      const { data, faturamento_bruto, percentual_pool, valor_pool } = pending.payload;
      const novoId = this.ctx.nextId(db.erp_rateios_historico);

      const novoRateio = {
        id: novoId,
        data: data || dataHoje,
        unidade_id: 1,
        faturamento_bruto: Number(faturamento_bruto || 0),
        percentual_pool: Number(percentual_pool || 10),
        valor_pool: Number(valor_pool || 0),
        detalhes_json: [],
        arquivado_legal: false,
        criado_em: new Date().toISOString()
      };

      db.erp_rateios_historico.unshift(novoRateio);
      this.ctx.saveDbToDisk();
      this.ctx.sseBroker.emit('rateio.fechado', novoRateio);

      this.ctx.registrarAuditLog(
        pending.operador_nome || 'WhatsApp AI Bot',
        'FECHAMENTO_RATEIO_CONFIRMADO',
        `Rateio fechado em ${data}: Pool de ${percentual_pool}% = R$ ${valor_pool.toFixed(2)}`,
        '127.0.0.1',
        pending.operador_cargo
      );

      return {
        executado: true,
        respostaTexto: `*Fechamento de Rateio Oficializado!*\n\n• *Data:* ${data}\n• *Faturamento Base:* R$ ${faturamento_bruto.toFixed(2)}\n• *Percentual do Pool:* ${percentual_pool}%\n• *Total Distribuído no Rateio:* R$ ${valor_pool.toFixed(2)}\n• *Aprovado por:* ${pending.operador_nome} (${pending.operador_cargo})\n\nA aba Rateio e os relatórios financeiros já foram consolidados.`
      };
    } else if (pending.tipo === 'ADIANTAMENTO_VALE') {
      const { usuario_id, colaborador_nome, valor, motivo, data } = pending.payload;
      const novoIdRh = this.ctx.nextId(db.erp_rh_nr01);
      const novoIdCaixa = this.ctx.nextId(db.erp_caixa);

      db.erp_rh_nr01.unshift({
        id: novoIdRh,
        usuario_id: Number(usuario_id || 1),
        categoria: 'Vales & Adiantamentos',
        recurso_codigo: 'VALE_SALARIAL',
        titulo: `Vale / Adiantamento: ${colaborador_nome}`,
        descricao: `${motivo} (Autorizado via WhatsApp por ${pending.operador_nome})`,
        data: data || dataHoje,
        status: 'Concluído',
        valor_financeiro: valor,
        lancar_caixa: true,
        criado_em: new Date().toISOString(),
        arquivado_legal: false
      });

      db.erp_caixa.unshift({
        id: novoIdCaixa,
        data: data || dataHoje,
        tipo: 'Saída',
        categoria: 'Adiantamento Salarial / Vale',
        descricao: `Vale / Adiantamento: ${colaborador_nome} (${motivo})`,
        expressao: `${valor}`,
        valor,
        unidade_id: 1,
        usuario_id: Number(usuario_id || 1),
        arquivado_legal: false,
        criado_em: new Date().toISOString()
      });

      this.ctx.saveDbToDisk();
      this.ctx.sseBroker.emit('rh.atualizado', { id: novoIdRh, colaborador: colaborador_nome });
      this.ctx.sseBroker.emit('caixa.movimentacao_registrada', { id: novoIdCaixa, valor });

      this.ctx.registrarAuditLog(
        pending.operador_nome || 'WhatsApp AI Bot',
        'ADIANTAMENTO_VALE_CONFIRMADO',
        `Vale de R$ ${valor.toFixed(2)} para ${colaborador_nome} (${motivo}) registrado com saída no caixa.`,
        '127.0.0.1',
        pending.operador_cargo
      );

      return {
        executado: true,
        respostaTexto: `*Adiantamento Salarial / Vale Concluído!*\n\n• *Beneficiário:* ${colaborador_nome}\n• *Valor:* R$ ${valor.toFixed(2)}\n• *Motivo:* ${motivo}\n• *Prontuário RH:* Registrado (#${novoIdRh})\n• *Caixa:* Saída efetuada (#${novoIdCaixa})\n• *Autorizado por:* ${pending.operador_nome} (${pending.operador_cargo})`
      };
    }

    return { executado: false };
  }

  public async processarMensagem(params: {
    remetenteTelefone: string;
    nomeContato?: string;
    textoMensagem?: string;
    empresaId?: number;
    usuarioIdExplicito?: number;
  }): Promise<{
    resposta: string;
    toolCallsExecutadas?: string[];
    colaboradorIdentificado?: ColaboradorPermissoesWpp;
  }> {
    const { remetenteTelefone, nomeContato, textoMensagem, empresaId, usuarioIdExplicito } = params;
    const cleanTel = remetenteTelefone.replace(/\D/g, '');

    const db = this.ctx.db;
    const user =
      (usuarioIdExplicito
        ? db.usuarios.find((u: any) => !u.arquivado_legal && Number(u.id) === Number(usuarioIdExplicito))
        : null) ||
      db.usuarios.find(
        (u: any) =>
          !u.arquivado_legal &&
          cleanTel.length >= 8 &&
          String(u.telefone || '').replace(/\D/g, '').endsWith(cleanTel.slice(-8))
      );

    const permissoes = this.resolverPermissoesColaboradorWpp(user, nomeContato);

    if (textoMensagem) {
      const directConfirm = this.checkDirectConfirmation(textoMensagem, cleanTel);
      if (directConfirm.executado && directConfirm.respostaTexto) {
        return {
          resposta: directConfirm.respostaTexto,
          toolCallsExecutadas: ['confirmacao_2_etapas'],
          colaboradorIdentificado: permissoes
        };
      }
    }

    const empresaAtivaId = empresaId || user?.empresas_ids?.[0] || 1;
    const empresa = db.empresas.find((e: any) => Number(e.id) === Number(empresaAtivaId)) || db.empresas[0];

    const systemInstruction = `Você é o Urutau, a inteligência central do Urutau ERP.
Contexto da Empresa Ativa:
- Nome da Empresa: ${empresa?.nome || 'Urutau ERP'}
- Ramo: ${empresa?.ramo || 'Gastronomia & Eventos'}
- Teto de Diária para Freelancers: R$ ${empresa?.diaria_teto || 220},00
- Colaborador Identificado no WhatsApp: ${permissoes.nome} (Cargo: ${permissoes.cargo} | Perfil: ${permissoes.tipo})
- Alçadas do Cargo:
  • Rotinas de Turno (Escalas, Checklists, Reservas, Estoque, Ocorrências): AUTORIZADO
  • Movimentação, Saldo de Caixa e Fechamento de Rateio: ${permissoes.podeFinanceiroCaixa ? 'AUTORIZADO' : 'RESTRITO AO CARGO'}
  • Gestão de Escala, Faltas, Dobras e RH/Vales: ${permissoes.podeGestaoEscalaRH ? 'AUTORIZADO' : 'RESTRITO AO CARGO'}
  • Busca e Contratação de Freelancers: ${permissoes.podeContratarFreelancer ? 'AUTORIZADO' : 'RESTRITO AO CARGO'}
- Data Atual do Sistema: ${new Date().toLocaleDateString('pt-BR')} (${new Date().toLocaleDateString('pt-BR', { weekday: 'long' })})

Regras Fundamentais:
1. Responda sempre em português do Brasil de forma concisa, cordial e resolutiva.
2. Para lançamentos financeiros no caixa, contratações de freelancers, recebimentos de mercadorias, fechamento de rateio e adiantamento de vales, chame a ferramenta correspondente e peça confirmação em 2 etapas ("Sim" ou "Não").
3. Use as ferramentas disponibilizadas para consultar e alterar dados reais (estoque, compras, escala, rateio, reservas, agenda, checklists, prontuário RH e CMV). Nunca invente dados.
4. Se uma ferramenta retornar erro_permissao, explique educadamente a restrição de alçada do cargo atual.`;

    if (this.ai) {
      try {
        const tools = [{ functionDeclarations: this.getToolDeclarations() }];
        const userContentParts: any[] = [{ text: textoMensagem || 'Olá' }];

        const history = this.conversationHistory.get(cleanTel) || [];
        const contents = [
          ...history.slice(-6),
          { role: 'user', parts: userContentParts }
        ];

        const response = await this.ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents,
          config: {
            systemInstruction,
            tools
          }
        });

        const toolCalls = response.functionCalls;
        const toolCallsExecutadas: string[] = [];

        if (toolCalls && toolCalls.length > 0) {
          const toolResponseParts: any[] = [];

          for (const call of toolCalls) {
            const callName = call.name || '';
            if (!callName) continue;
            toolCallsExecutadas.push(callName);
            const toolResult = await this.executeToolCall(callName, call.args, cleanTel, empresaAtivaId, permissoes);
            toolResponseParts.push({
              functionResponse: {
                name: callName,
                response: toolResult
              }
            });
          }

          const followUpContents = [
            ...contents,
            { role: 'model', parts: [{ functionCalls: toolCalls }] },
            { role: 'user', parts: toolResponseParts }
          ];

          const followUpResponse = await this.ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: followUpContents,
            config: {
              systemInstruction
            }
          });

          const finalText = followUpResponse.text || 'Operação processada com sucesso pelo Urutau.';

          history.push({ role: 'user', parts: userContentParts });
          history.push({ role: 'model', parts: [{ text: finalText }] });
          this.conversationHistory.set(cleanTel, history.slice(-10));

          return {
            resposta: finalText,
            toolCallsExecutadas,
            colaboradorIdentificado: permissoes
          };
        }

        const modelText = response.text || 'Entendido. Estou monitorando os dados da sua empresa.';
        history.push({ role: 'user', parts: userContentParts });
        history.push({ role: 'model', parts: [{ text: modelText }] });
        this.conversationHistory.set(cleanTel, history.slice(-10));

        return {
          resposta: modelText,
          toolCallsExecutadas: [],
          colaboradorIdentificado: permissoes
        };
      } catch (geminiError: any) {
        console.warn('[GeminiBot] Acionando motor determinístico local:', geminiError?.message || geminiError);
      }
    }

    const fallbackRes = await this.fallbackInteligente(textoMensagem || 'Olá', cleanTel, empresaAtivaId, permissoes);
    return {
      ...fallbackRes,
      colaboradorIdentificado: permissoes
    };
  }

  private async fallbackInteligente(
    texto: string,
    telefone: string,
    empresaId: number,
    permissoes: ColaboradorPermissoesWpp
  ): Promise<{ resposta: string; toolCallsExecutadas?: string[] }> {
    const t = texto.toLowerCase();
    const db = this.ctx.db;
    const emp = db.empresas.find((e: any) => Number(e.id) === Number(empresaId)) || db.empresas[0] || { nome: 'Urutau ERP', diaria_teto: 220 };
    const dataHoje = new Date().toISOString().slice(0, 10);

    if (t.includes('recebi') || t.includes('entregou') || t.includes('chegou mercadoria') || t.includes('recebimento')) {
      const matchQtd = t.match(/(\d+(?:[.,]\d{1,3})?)\s*(kg|l|cx|pct|g|unidades?|un)?/i);
      const matchVal = t.match(/r\$\s*(\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?)\s*reais/i);
      const qtd = matchQtd ? parseFloat(matchQtd[1].replace(',', '.')) : 5;
      const val = matchVal ? parseFloat((matchVal[1] || matchVal[2]).replace(',', '.')) : 0;
      const insumo = texto.replace(/(recebi|entregou|chegou|recebimento|mercadoria|\d+|kg|l|cx|pct|reais|r\$|por|de|do|da|\s)+/gi, ' ').trim() || 'Insumo em Reposição';

      const pend = await this.executeToolCall(
        'solicitar_recebimento_mercadoria',
        {
          insumo_termo: insumo,
          quantidade_recebida: qtd,
          valor_total: val,
          fornecedor: 'Fornecedor Parceiro',
          lancar_no_caixa: val > 0
        },
        telefone,
        empresaId,
        permissoes
      );

      return {
        toolCallsExecutadas: ['solicitar_recebimento_mercadoria'],
        resposta: `*Confirmação de Recebimento de Mercadoria*\n\nPreparei o recebimento do insumo:\n*${pend.resumo}*\n\n*Confirmar entrada no estoque e lançamento financeiro?* Responda *Sim* ou *Não*.`
      };
    }

    if (
      t.includes('dar baixa') ||
      t.includes('baixa de') ||
      t.includes('baixar') ||
      t.includes('perda de') ||
      t.includes('quebrou') ||
      t.includes('descarte')
    ) {
      const matchQtd = t.match(/(\d+(?:[.,]\d{1,3})?)\s*(kg|l|cx|pct|g|unidades?|un)?/i);
      const qtd = matchQtd ? parseFloat(matchQtd[1].replace(',', '.')) : 1;
      const insumo = texto
        .replace(/(dar\s+baixa|baixa|de|do|da|baixar|perda|quebrou|descarte|\d+|kg|l|cx|pct|unidades?|un|na\s+cozinha|no\s+bar|\s)+/gi, ' ')
        .trim() || 'Insumo Operacional';
      const mot = t.includes('perda') || t.includes('quebrou') || t.includes('descarte') ? 'Perda / Descarte' : 'Consumo Cozinha/Bar';

      const res = await this.executeToolCall(
        'dar_baixa_estoque',
        { insumo_termo: insumo, quantidade: qtd, motivo: mot },
        telefone,
        empresaId,
        permissoes
      );

      if (res.erro) {
        return { toolCallsExecutadas: ['dar_baixa_estoque'], resposta: `*Atenção:* ${res.erro}` };
      }

      return {
        toolCallsExecutadas: ['dar_baixa_estoque'],
        resposta: `*Baixa de Estoque Registrada!*\n\n• *Insumo:* ${res.insumo}\n• *Quantidade Baixada:* -${res.quantidade_baixada} ${res.unidade}\n• *Novo Saldo em Estoque:* ${res.saldo_restante} ${res.unidade}${res.em_alerta_minimo ? '\n• *Atenção:* Insumo atingiu nível crítico de reposição!' : ''}\n• *Motivo:* ${res.motivo}\n• *Operador:* ${res.responsavel}`
      };
    }

    if (t.includes('pedir compra') || t.includes('comprar') || t.includes('requisitar') || t.includes('precisa comprar')) {
      const matchQtd = t.match(/(\d+(?:[.,]\d{1,3})?)\s*(kg|l|cx|pct|g|un)?/i);
      const qtd = matchQtd ? parseFloat(matchQtd[1].replace(',', '.')) : 0;
      const insumo = texto
        .replace(/(pedir\s+compra|comprar|requisitar|precisa\s+comprar|compra|de|do|da|\d+|kg|l|cx|pct|unidades?|un|\s)+/gi, ' ')
        .trim() || 'Insumo Requisitado';

      const res = await this.executeToolCall(
        'solicitar_compra_insumo',
        { insumo_termo: insumo, quantidade_sugerida: qtd, observacao: texto },
        telefone,
        empresaId,
        permissoes
      );

      return {
        toolCallsExecutadas: ['solicitar_compra_insumo'],
        resposta: `*Requisição de Compra Registrada!*\n\n• *Insumo:* ${res.insumo}\n• *Quantidade Sugerida:* ${res.quantidade_sugerida}\n• *Status:* ${res.status_compra}\n• *Solicitante:* ${res.solicitante}\n\nO item já aparece na lista de compras do painel.`
      };
    }

    if (t.includes('saldo de') || t.includes('quantas') || t.includes('quantos') || t.includes('tem no estoque') || t.includes('quanto tem')) {
      const insumo = texto
        .replace(/(saldo\s+de|quantas?|quantos?|tem\s+no\s+estoque|quanto\s+tem|de|do|da|no\s+estoque|\?|\s)+/gi, ' ')
        .trim() || 'Insumo';

      const res = await this.executeToolCall('consultar_saldo_item_estoque', { insumo_termo: insumo }, telefone, empresaId, permissoes);
      if (!res.encontrado) {
        return { toolCallsExecutadas: ['consultar_saldo_item_estoque'], resposta: res.mensagem };
      }

      const linhas = res.itens
        .map((i: any) => `• *${i.nome}*: ${i.quantidade_atual} ${i.unidade} (Custo: R$ ${i.custo_unitario.toFixed(2)}) [${i.status}]`)
        .join('\n');
      return {
        toolCallsExecutadas: ['consultar_saldo_item_estoque'],
        resposta: `*Consulta de Saldo de Estoque (${emp.nome})*\n\n${linhas}`
      };
    }

    if (t.includes('fechar rateio') || t.includes('fechamento do rateio') || t.includes('distribuir gorjeta')) {
      const res = await this.executeToolCall('solicitar_fechamento_rateio', { data: dataHoje }, telefone, empresaId, permissoes);
      if (res.erro_permissao) {
        return { toolCallsExecutadas: ['solicitar_fechamento_rateio'], resposta: `*Bloqueio de Alçada por Cargo*\n\n${res.mensagem}` };
      }
      return {
        toolCallsExecutadas: ['solicitar_fechamento_rateio'],
        resposta: `*Confirmação de Fechamento de Rateio*\n\nPreparei a consolidação da caixinha/rateio:\n*${res.resumo}*\n\n*Confirmar fechamento oficial?* Responda *Sim* ou *Não*.`
      };
    }

    if (t.includes('rateio') || t.includes('gorjeta') || t.includes('caixinha') || t.includes('comissão') || t.includes('comissao')) {
      const res = await this.executeToolCall('consultar_rateio_dia', { data: dataHoje }, telefone, empresaId, permissoes);
      return {
        toolCallsExecutadas: ['consultar_rateio_dia'],
        resposta: `*Rateio de Gorjetas & Comissões (${emp.nome})*\n\n• *Data:* ${res.data}\n• *Faturamento Base:* R$ ${res.faturamento_base.toFixed(2)}\n• *Pool (${res.percentual_pool}%):* R$ ${res.valor_pool.toFixed(2)}\n• *Status:* ${res.status}\n• *Colaboradores Aptos:* ${res.total_colaboradores_aptos}\n• *Estimativa por Cota:* R$ ${res.estimativa_por_colaborador.toFixed(2)}`
      };
    }

    if (t.includes('vale') || t.includes('adiantamento')) {
      const matchVal = t.match(/r\$\s*(\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?)\s*reais/i);
      const val = matchVal ? parseFloat((matchVal[1] || matchVal[2]).replace(',', '.')) : 100;
      const nomeColab = texto.replace(/(lançar|lanca|vale|de|do|da|adiantamento|salarial|\d+|reais|r\$|para|pro|\s)+/gi, ' ').trim() || permissoes.nome;

      const pend = await this.executeToolCall(
        'solicitar_adiantamento_vale',
        { colaborador_nome: nomeColab, valor: val, motivo: 'Adiantamento Solicitado via WhatsApp' },
        telefone,
        empresaId,
        permissoes
      );

      if (pend.erro_permissao) {
        return { toolCallsExecutadas: ['solicitar_adiantamento_vale'], resposta: `*Bloqueio de Alçada por Cargo*\n\n${pend.mensagem}` };
      }

      return {
        toolCallsExecutadas: ['solicitar_adiantamento_vale'],
        resposta: `*Confirmação de Vale / Adiantamento*\n\nPreparei a autorização:\n*${pend.resumo}*\n\n*Confirmar lançamento do vale e saída no caixa?* Responda *Sim* ou *Não*.`
      };
    }

    if (t.includes('falta') || t.includes('dobra') || t.includes('folga extra') || t.includes('hora extra')) {
      let tipoMov = 'Falta Justificada';
      if (t.includes('dobra')) tipoMov = 'Dobra de Turno';
      else if (t.includes('folga')) tipoMov = 'Folga Extra';
      else if (t.includes('injustificada')) tipoMov = 'Falta Injustificada';
      else if (t.includes('hora extra')) tipoMov = 'Hora Extra';

      const nomeColab = texto.replace(/(lançar|lanca|registrar|falta|justificada|injustificada|dobra|de|do|da|turno|folga|extra|hora|para|pro|\s)+/gi, ' ').trim() || 'Colaborador';

      const res = await this.executeToolCall(
        'lancar_movimento_escala',
        { colaborador_nome: nomeColab, tipo_movimento: tipoMov, motivo: texto },
        telefone,
        empresaId,
        permissoes
      );

      if (res.erro_permissao) {
        return { toolCallsExecutadas: ['lancar_movimento_escala'], resposta: `*Bloqueio de Alçada por Cargo*\n\n${res.mensagem}` };
      }

      return {
        toolCallsExecutadas: ['lancar_movimento_escala'],
        resposta: `*Movimento de Escala Registrado!*\n\n• *Colaborador:* ${res.colaborador}\n• *Tipo:* ${res.tipo}\n• *Data:* ${res.data}\n• *Motivo:* ${res.motivo}\n• *Lançado por:* ${res.registrado_por}`
      };
    }

    if (t.includes('troca de turno') || t.includes('trocar turno') || t.includes('troca de folga')) {
      const res = await this.executeToolCall(
        'solicitar_troca_turno',
        {
          colaborador_solicitante: permissoes.nome,
          colaborador_substituto: 'Colega de Turno',
          data_troca: dataHoje,
          motivo: texto
        },
        telefone,
        empresaId,
        permissoes
      );

      return {
        toolCallsExecutadas: ['solicitar_troca_turno'],
        resposta: `*Troca de Turno Registrada!*\n\n• *Solicitante:* ${res.solicitante}\n• *Substituto:* ${res.substituto}\n• *Data:* ${res.data}\n• *Motivo:* ${res.motivo}\n\nA alteração já consta no painel de Escalas.`
      };
    }

    if (t.includes('reservar') || t.includes('criar reserva') || t.includes('nova reserva')) {
      const matchPessoas = t.match(/(\d+)\s*(pessoas|lugares|adultos)?/i);
      const matchHora = t.match(/(\d{1,2}(?::\d{2}|h\d{0,2}))/i);
      const matchMesa = t.match(/mesa\s*(\d+|\w+)/i);

      const pessoas = matchPessoas ? parseInt(matchPessoas[1]) : 4;
      const hora = matchHora ? matchHora[1].replace('h', ':00') : '20:00';
      const mesa = matchMesa ? matchMesa[1] : '4';
      const cliente = texto.replace(/(reservar|criar|reserva|nova|para|pro|mesa|\d+|pessoas|lugares|adultos|às|as|h|\s)+/gi, ' ').trim() || 'Cliente Especial';

      const res = await this.executeToolCall(
        'criar_reserva_salao',
        { cliente, hora, adultos_pagantes: pessoas, mesa },
        telefone,
        empresaId,
        permissoes
      );

      return {
        toolCallsExecutadas: ['criar_reserva_salao'],
        resposta: `*Reserva Confirmada com Sucesso!*\n\n• *Cliente:* ${res.cliente}\n• *Data:* ${res.data}\n• *Horário:* ${res.hora}\n• *Mesa:* ${res.mesa}\n• *Pessoas:* ${res.adultos_pagantes}\n• *Status:* ${res.status}`
      };
    }

    if (t.includes('chegou') && (t.includes('reserva') || t.includes('mesa') || t.includes('cliente'))) {
      const busca = texto.replace(/(o|a|cliente|da|do|reserva|mesa|chegou|\s)+/gi, ' ').trim();
      const res = await this.executeToolCall(
        'atualizar_status_reserva',
        { cliente_ou_mesa: busca || 'Mesa 4', novo_status: 'Cliente no Salão' },
        telefone,
        empresaId,
        permissoes
      );

      if (res.erro) return { toolCallsExecutadas: ['atualizar_status_reserva'], resposta: res.erro };

      return {
        toolCallsExecutadas: ['atualizar_status_reserva'],
        resposta: `*Status da Reserva Atualizado!*\n\n• *Cliente:* ${res.cliente}\n• *Mesa:* ${res.mesa}\n• *Novo Status:* ${res.novo_status}`
      };
    }

    if (t.includes('agenda') || t.includes('compromisso') || t.includes('reunião') || t.includes('reuniao')) {
      if (t.includes('agendar') || t.includes('marcar') || t.includes('criar')) {
        const titulo = texto.replace(/(agendar|marcar|criar|agenda|compromisso|reunião|reuniao|para|às|as|\s)+/gi, ' ').trim() || 'Reunião Operacional';
        const res = await this.executeToolCall(
          'criar_compromisso_agenda',
          { titulo, data: dataHoje, hora: '15:00', tipo: 'Reunião' },
          telefone,
          empresaId,
          permissoes
        );

        return {
          toolCallsExecutadas: ['criar_compromisso_agenda'],
          resposta: `*Compromisso Agendado com Sucesso!*\n\n• *Título:* ${res.titulo}\n• *Data:* ${res.data}\n• *Hora:* ${res.hora}\n• *Tipo:* ${res.tipo}\n\nJá sincronizado na Agenda Operacional.`
        };
      }

      const res = await this.executeToolCall('consultar_agenda_operacional', { data: dataHoje }, telefone, empresaId, permissoes);
      const lista = (res.eventos || [])
        .map((e: any) => `• *${e.hora}* — [${e.tipo}] *${e.titulo}* ${e.concluido ? '(Concluído)' : '(Pendente)'}`)
        .join('\n');

      return {
        toolCallsExecutadas: ['consultar_agenda_operacional'],
        resposta: `*Agenda Operacional (${emp.nome})*\n\nTotal de compromissos: *${res.total_eventos}*\n\n${lista || 'Nenhum compromisso agendado para hoje.'}`
      };
    }

    if (t.includes('cmv') || t.includes('custo de mercadoria') || t.includes('margem') || t.includes('ficha técnica') || t.includes('ficha tecnica')) {
      const termo = texto.replace(/(qual|o|a|cmv|do|da|custo|margem|ficha|técnica|tecnica|de|\?|\s)+/gi, ' ').trim();
      const res = await this.executeToolCall('consultar_cmv_produto', { termo_busca: termo }, telefone, empresaId, permissoes);

      return {
        toolCallsExecutadas: ['consultar_cmv_produto'],
        resposta: `*Indicadores de CMV & Custos (${emp.nome})*\n\n• *Patrimônio em Estoque:* R$ ${res.valor_patrimonio_estoque.toFixed(2)}\n• *Compras do Período:* R$ ${res.compras_periodo.toFixed(2)}\n• *Faturamento:* R$ ${res.faturamento_periodo.toFixed(2)}\n• *CMV Estimado:* R$ ${res.cmv_estimado.toFixed(2)} (${res.percentual_cmv}% sobre faturamento)${res.item_analisado ? `\n\n*Item Pesquisado: ${res.item_analisado.nome}*\n• Custo Unitário: R$ ${res.item_analisado.custo_unitario.toFixed(2)} / ${res.item_analisado.unidade}\n• Saldo Atual: ${res.item_analisado.saldo} ${res.item_analisado.unidade}` : ''}`
      };
    }

    if (t.includes('prontuário') || t.includes('prontuario') || t.includes('histórico rh') || t.includes('historico rh')) {
      const nome = texto.replace(/(consultar|ver|prontuário|prontuario|histórico|historico|rh|de|do|da|\s)+/gi, ' ').trim() || permissoes.nome;
      const res = await this.executeToolCall('consultar_prontuario_rh', { colaborador_nome: nome }, telefone, empresaId, permissoes);

      if (res.erro) return { toolCallsExecutadas: ['consultar_prontuario_rh'], resposta: res.erro };

      const logs = (res.historico || [])
        .map((h: any) => `• [${h.data}] *${h.categoria}*: ${h.titulo} (${h.status})`)
        .join('\n');

      return {
        toolCallsExecutadas: ['consultar_prontuario_rh'],
        resposta: `*Prontuário de RH — ${res.colaborador} (${res.cargo})*\n\nTotal de registros: *${res.total_registros_prontuario}*\n\n${logs || 'Nenhum registro no prontuário.'}`
      };
    }

    if (
      (t.includes('conclu') || t.includes('finaliz') || t.includes('terminei') || t.includes('feito') || t.includes('marcar')) &&
      (t.includes('checklist') || t.includes('pop') || t.includes('abertura') || t.includes('fechamento') || t.includes('higieniza'))
    ) {
      const termoLimpo = texto
        .replace(/^(conclu[íi]|finalizei|terminei|marcar|checklist|o|a|de|do|da|\s)+/gi, '')
        .trim() || 'Checklist Operacional do Setor';
      const res = await this.executeToolCall(
        'concluir_checklist_setor',
        { termo_checklist: termoLimpo, observacao: texto },
        telefone,
        empresaId,
        permissoes
      );
      return {
        toolCallsExecutadas: ['concluir_checklist_setor'],
        resposta: `*Checklist Marcado como Concluído!*\n\n• *Rotina / POP:* ${res.titulo}\n• *Status:* ${res.status}\n• *Executado por:* ${res.executor}\n• *Horário:* ${res.horario}\n\nA conformidade do setor já foi atualizada em tempo real na aba Checklists.`
      };
    }

    if (t.includes('checklist') || t.includes('pop') || t.includes('rotina')) {
      const res = await this.executeToolCall('consultar_status_checklists', {}, telefone, empresaId, permissoes);
      const listaTxt = (res.checklists || [])
        .map((c: any) => `• *${c.titulo}* (${c.frequencia}) — Status: *${c.status_execucao}* (${c.ultimo_executor})`)
        .join('\n');
      return {
        toolCallsExecutadas: ['consultar_status_checklists'],
        resposta: `*Status dos Checklists / POPs (${emp.nome})*\n\n• *Concluídos hoje:* ${res.rotinas_concluidas} de ${res.total_rotinas} (${res.conformidade_percentual}%)\n\n${listaTxt || 'Nenhum checklist cadastrado.'}\n\nPara dar baixa em uma rotina pelo WhatsApp, envie por exemplo: *"Concluí o checklist de abertura do bar"*.`
      };
    }

    if (
      t.includes('ocorrência') ||
      t.includes('ocorrencia') ||
      t.includes('atraso') ||
      t.includes('justificativa') ||
      t.includes('atestado') ||
      t.includes('manutenção') ||
      t.includes('manutencao')
    ) {
      let tipoOc = 'Ocorrência de Turno';
      if (t.includes('atraso') || t.includes('justificativa') || t.includes('atestado')) {
        tipoOc = 'Justificativa / Atraso';
      } else if (t.includes('manutenção') || t.includes('manutencao')) {
        tipoOc = 'Manutenção / Equipamento';
      }
      const res = await this.executeToolCall(
        'registrar_ocorrencia_turno',
        { tipo_ocorrencia: tipoOc, descricao: texto },
        telefone,
        empresaId,
        permissoes
      );
      return {
        toolCallsExecutadas: ['registrar_ocorrencia_turno'],
        resposta: `*Ocorrência de Turno Registrada!*\n\n• *Tipo:* ${res.tipo}\n• *Colaborador:* ${res.colaborador}\n• *Relato:* "${res.descricao}"\n• *Data:* ${res.data}\n\nO registro já foi anexado à Escala do dia e ao Log de Auditoria.`
      };
    }

    if (t.includes('reserva') || t.includes('mesa') || t.includes('clientes hoje')) {
      const res = await this.executeToolCall('consultar_reservas_do_dia', {}, telefone, empresaId, permissoes);
      const lista = (res.lista || [])
        .map((r: any) => `• *${r.hora}* — *${r.cliente}* (Mesa ${r.mesa} • ${r.adultos_pagantes} adultos) [${r.status}]`)
        .join('\n');
      return {
        toolCallsExecutadas: ['consultar_reservas_do_dia'],
        resposta: `*Reservas de Hoje (${emp.nome})*\n\nTotal: *${res.total_reservas} reserva(s)*\n\n${lista || 'Nenhuma reserva cadastrada para hoje.'}`
      };
    }

    if (t.includes('escala') || t.includes('turno') || t.includes('trabalha') || t.includes('escalado')) {
      const res = await this.executeToolCall('consultar_escalas_do_dia', {}, telefone, empresaId, permissoes);
      const nomes = res.equipe.map((e: any) => `• *${e.nome}* (${e.cargo})`).join('\n');
      const movs = (res.movimentos_extra || [])
        .slice(0, 4)
        .map((m: any) => `• [${m.tipo}] ${m.colaborador}: ${m.motivo}`)
        .join('\n');
      return {
        toolCallsExecutadas: ['consultar_escalas_do_dia'],
        resposta: `*Urutau ERP — Escala de Hoje (${emp.nome})*\n\nTemos *${res.total_escalados} colaboradores* escalados para o turno de hoje:\n\n${nomes || 'Nenhum colaborador na escala fixa deste dia.'}${movs ? `\n\n*Ocorrências / Movimentos do Dia:*\n${movs}` : ''}`
      };
    }

    if (t.includes('freelancer') || t.includes('match') || t.includes('contratar') || t.includes('diária') || t.includes('diaria')) {
      let funcao = 'Garçom';
      if (t.includes('cozinha') || t.includes('cozinheiro')) funcao = 'Cozinheiro';
      else if (t.includes('bartender') || t.includes('bar')) funcao = 'Bartender';
      else if (t.includes('cumim')) funcao = 'Cumim';
      else if (t.includes('limpeza')) funcao = 'Auxiliar de Limpeza';

      const res = await this.executeToolCall('buscar_freelancers_match', { funcao }, telefone, empresaId, permissoes);
      if (res.erro_permissao) {
        return {
          toolCallsExecutadas: ['buscar_freelancers_match'],
          resposta: `*Bloqueio de Alçada por Cargo*\n\n${res.mensagem}`
        };
      }

      if (res.candidatos && res.candidatos.length > 0) {
        const top = res.candidatos[0];
        const pend = await this.executeToolCall(
          'solicitar_contratacao_freelancer',
          {
            freelancer_id: top.id,
            valor_diaria: top.valor_diaria,
            funcao: top.funcao
          },
          telefone,
          empresaId,
          permissoes
        );

        return {
          toolCallsExecutadas: ['buscar_freelancers_match', 'solicitar_contratacao_freelancer'],
          resposta: `*Match Encontrado para ${funcao}!*\n\nLocalizei o profissional *${top.nome}* (Avaliação: ${top.avaliacao}) com diária de *R$ ${top.valor_diaria.toFixed(2)}*.\n\n*Resumo:* ${pend.resumo}\n\n*Deseja confirmar a contratação?* Responda *Sim* para oficializar ou *Não* para cancelar.`
        };
      }
      return {
        toolCallsExecutadas: ['buscar_freelancers_match'],
        resposta: `Busquei no banco de talentos, mas não encontrei freelancers disponíveis para *${funcao}* dentro do teto configurado.`
      };
    }

    const matchValor = t.match(/(?:sa[íi]da|sangria|entrada|suprimento)\s+(?:de\s+)?(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/i);
    if (matchValor) {
      const valor = parseFloat(matchValor[1].replace(',', '.'));
      let tipo = 'Saída';
      if (t.includes('entrada')) tipo = 'Entrada';
      else if (t.includes('sangria')) tipo = 'Sangria';
      else if (t.includes('suprimento')) tipo = 'Suprimento';

      const pend = await this.executeToolCall(
        'solicitar_lancamento_caixa',
        {
          tipo,
          valor,
          descricao: texto.replace(/^(lançar|lanca|registra|registrar|anota)\s+/i, '')
        },
        telefone,
        empresaId,
        permissoes
      );

      if (pend.erro_permissao) {
        return {
          toolCallsExecutadas: ['solicitar_lancamento_caixa'],
          resposta: `*Bloqueio de Alçada por Cargo*\n\n${pend.mensagem}`
        };
      }

      return {
        toolCallsExecutadas: ['solicitar_lancamento_caixa'],
        resposta: `*Confirmação em 2 Etapas — Caixa*\n\nPreparei a movimentação financeira solicitada:\n*${pend.resumo}*\n\n*Confirmar lançamento no sistema?* Responda *Sim* ou *Não*.`
      };
    }

    if (t.includes('caixa') || t.includes('saldo') || t.includes('faturamento') || t.includes('entradas') || t.includes('saídas') || t.includes('saidas')) {
      const res = await this.executeToolCall('consultar_resumo_financeiro_caixa', {}, telefone, empresaId, permissoes);
      if (res.erro_permissao) {
        return {
          toolCallsExecutadas: ['consultar_resumo_financeiro_caixa'],
          resposta: `*Bloqueio de Alçada por Cargo*\n\n${res.mensagem}`
        };
      }
      return {
        toolCallsExecutadas: ['consultar_resumo_financeiro_caixa'],
        resposta: `*Resumo Financeiro do Caixa (${emp.nome})*\n\n• *Entradas Hoje:* R$ ${res.total_entradas.toFixed(2)}\n• *Saídas / Sangrias:* R$ ${res.total_saidas.toFixed(2)}\n• *Saldo em Caixa:* R$ ${res.saldo_dia.toFixed(2)}\n• *Movimentações registradas:* ${res.total_lancamentos}`
      };
    }

    if (t.includes('estoque') || t.includes('insumo') || t.includes('compras') || t.includes('acabando') || t.includes('falta')) {
      const res = await this.executeToolCall('consultar_estoque_critico', {}, telefone, empresaId, permissoes);
      if (res.total_criticos === 0) {
        return {
          toolCallsExecutadas: ['consultar_estoque_critico'],
          resposta: `*Estoque Seguro (${emp.nome}):* Todos os insumos estão acima do estoque mínimo estabelecido.`
        };
      }
      const itens = res.itens.map((i: any) => `• *${i.nome}*: ${i.quantidade_atual} ${i.unidade} (Mínimo: ${i.minimo_recomendado})`).join('\n');
      return {
        toolCallsExecutadas: ['consultar_estoque_critico'],
        resposta: `*Alerta de Estoque Crítico (${emp.nome})*\n\n${itens}`
      };
    }

    return {
      toolCallsExecutadas: [],
      resposta: `*Olá, ${permissoes.nome} (${permissoes.cargo})!*\n\nEstou conectado ao sistema da *${emp.nome}*. Você pode interagir com os módulos do ERP direto por aqui:\n\n• *Estoque & Compras:* "Saldo de camarão no estoque", "Baixa de 2kg de filé na cozinha", "Recebi 15kg de insumo de Fornecedor X por 500 reais", "Pedir compra de 10L de azeite"\n• *Escalas & Turnos:* "Quem está escalado hoje?", "Lançar falta para João hoje", "Troca de turno entre Ana e Carlos"\n• *Caixa & Rateio:* "Qual o saldo do caixa?", "Lançar saída de 50 reais para gelo", "Consultar rateio de hoje", "Fechar rateio do dia"\n• *Reservas & Agenda:* "Quais as reservas de hoje?", "Criar reserva para Carlos às 20h para 6 pessoas", "Compromissos da agenda de hoje"\n• *Checklists & POPs:* "Ver checklists pendentes", "Concluí o checklist de abertura do bar"\n• *RH & Vales:* "Lançar vale de 100 reais para Pedro", "Consultar prontuário de Maria"\n• *CMV & Custos:* "Qual o CMV do período?"`
    };
  }
}
