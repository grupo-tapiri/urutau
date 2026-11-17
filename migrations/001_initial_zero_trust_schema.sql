CREATE TABLE IF NOT EXISTS empresas (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  cnpj TEXT UNIQUE,
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  criado_em_utc TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  nome TEXT NOT NULL,
  email TEXT UNIQUE,
  cargo TEXT NOT NULL,
  tipo TEXT NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  criado_em_utc TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS produtos_catalogo (
  id INTEGER PRIMARY KEY,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL,
  preco_centavos INTEGER NOT NULL CHECK (preco_centavos >= 0),
  estoque_item_id INTEGER,
  qtd_baixa_mili INTEGER NOT NULL DEFAULT 1000 CHECK (qtd_baixa_mili >= 0),
  setor_impressao TEXT NOT NULL DEFAULT 'cozinha',
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  criado_em_utc TEXT NOT NULL,
  UNIQUE (empresa_id, codigo)
) STRICT;

CREATE TABLE IF NOT EXISTS estoque_saldos (
  id INTEGER PRIMARY KEY,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  insumo_nome TEXT NOT NULL,
  unidade_medida TEXT NOT NULL DEFAULT 'UN',
  saldo_mili INTEGER NOT NULL CHECK (saldo_mili >= 0),
  minimo_mili INTEGER NOT NULL DEFAULT 0 CHECK (minimo_mili >= 0),
  custo_unitario_centavos INTEGER NOT NULL DEFAULT 0 CHECK (custo_unitario_centavos >= 0),
  atualizado_em_utc TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS cupons_desconto (
  id INTEGER PRIMARY KEY,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  codigo TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('PERCENTUAL_BPS', 'FIXO_CENTAVOS')),
  valor INTEGER NOT NULL CHECK (valor >= 0),
  uso_maximo INTEGER NOT NULL DEFAULT 1000 CHECK (uso_maximo >= 0),
  usos_atuais INTEGER NOT NULL DEFAULT 0 CHECK (usos_atuais >= 0 AND usos_atuais <= uso_maximo),
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  expira_em_utc TEXT,
  UNIQUE (empresa_id, codigo)
) STRICT;

CREATE TABLE IF NOT EXISTS taxas_entrega_zonas (
  id INTEGER PRIMARY KEY,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  zona_codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  taxa_centavos INTEGER NOT NULL CHECK (taxa_centavos >= 0),
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  UNIQUE (empresa_id, zona_codigo)
) STRICT;

CREATE TABLE IF NOT EXISTS pdv_comandas_acid (
  id INTEGER PRIMARY KEY,
  op_uuid TEXT NOT NULL UNIQUE,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  unidade_id INTEGER NOT NULL DEFAULT 1,
  modalidade TEXT NOT NULL CHECK (modalidade IN ('mesa', 'comanda', 'balcao', 'delivery')),
  identificador TEXT NOT NULL,
  mesa_numero TEXT NOT NULL DEFAULT '',
  cliente_nome TEXT NOT NULL DEFAULT '',
  cliente_telefone TEXT NOT NULL DEFAULT '',
  endereco_entrega TEXT NOT NULL DEFAULT '',
  entregador_nome TEXT NOT NULL DEFAULT '',
  zona_entrega_codigo TEXT NOT NULL DEFAULT 'PADRAO',
  cupom_codigo TEXT,
  garcom_nome TEXT NOT NULL DEFAULT 'Atendente',
  pessoas_mesa INTEGER NOT NULL DEFAULT 1 CHECK (pessoas_mesa >= 1),
  subtotal_itens_centavos INTEGER NOT NULL DEFAULT 0 CHECK (subtotal_itens_centavos >= 0),
  desconto_centavos INTEGER NOT NULL DEFAULT 0 CHECK (desconto_centavos >= 0),
  taxa_entrega_centavos INTEGER NOT NULL DEFAULT 0 CHECK (taxa_entrega_centavos >= 0),
  aplicar_gorjeta_10 INTEGER NOT NULL DEFAULT 1 CHECK (aplicar_gorjeta_10 IN (0, 1)),
  gorjeta_centavos INTEGER NOT NULL DEFAULT 0 CHECK (gorjeta_centavos >= 0),
  total_centavos INTEGER NOT NULL DEFAULT 0 CHECK (total_centavos >= 0),
  pago_acumulado_centavos INTEGER NOT NULL DEFAULT 0 CHECK (pago_acumulado_centavos >= 0),
  saldo_restante_centavos INTEGER NOT NULL DEFAULT 0 CHECK (saldo_restante_centavos >= 0),
  status TEXT NOT NULL CHECK (status IN ('aberta', 'aguardando_pagamento', 'fechada', 'cancelada')),
  arquivado_legal INTEGER NOT NULL DEFAULT 0 CHECK (arquivado_legal IN (0, 1)),
  criado_em_utc TEXT NOT NULL,
  atualizado_em_utc TEXT NOT NULL,
  fechado_em_utc TEXT
) STRICT;

CREATE TABLE IF NOT EXISTS pdv_comanda_itens_acid (
  id TEXT PRIMARY KEY,
  comanda_id INTEGER NOT NULL REFERENCES pdv_comandas_acid(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  produto_id INTEGER NOT NULL REFERENCES produtos_catalogo(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  nome_snapshot TEXT NOT NULL,
  categoria_snapshot TEXT NOT NULL DEFAULT 'Geral',
  quantidade INTEGER NOT NULL CHECK (quantidade >= 1),
  preco_unitario_centavos INTEGER NOT NULL CHECK (preco_unitario_centavos >= 0),
  subtotal_centavos INTEGER NOT NULL CHECK (subtotal_centavos >= 0),
  setor_impressao TEXT NOT NULL DEFAULT 'cozinha',
  observacao TEXT NOT NULL DEFAULT '',
  garcom_nome TEXT NOT NULL DEFAULT 'Atendente',
  cancelado INTEGER NOT NULL DEFAULT 0 CHECK (cancelado IN (0, 1)),
  criado_em_utc TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS pdv_pagamentos_acid (
  id TEXT PRIMARY KEY,
  comanda_id INTEGER NOT NULL REFERENCES pdv_comandas_acid(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  metodo TEXT NOT NULL,
  valor_pago_centavos INTEGER NOT NULL CHECK (valor_pago_centavos > 0),
  recebido_dinheiro_centavos INTEGER NOT NULL CHECK (recebido_dinheiro_centavos >= valor_pago_centavos),
  troco_centavos INTEGER NOT NULL CHECK (troco_centavos >= 0),
  gorjeta_proporcional_centavos INTEGER NOT NULL DEFAULT 0 CHECK (gorjeta_proporcional_centavos >= 0),
  pagante_ref TEXT NOT NULL DEFAULT '',
  operador_uid INTEGER NOT NULL,
  operador_nome TEXT NOT NULL,
  criado_em_utc TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS caixa_lancamentos_acid (
  id INTEGER PRIMARY KEY,
  op_uuid TEXT NOT NULL UNIQUE,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  unidade_id INTEGER NOT NULL DEFAULT 1,
  data_referencia_utc TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('Entrada', 'Saída')),
  categoria TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor_centavos INTEGER NOT NULL CHECK (valor_centavos >= 0),
  forma_pagamento TEXT NOT NULL,
  responsavel TEXT NOT NULL,
  origem_comanda_id INTEGER REFERENCES pdv_comandas_acid(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  arquivado_legal INTEGER NOT NULL DEFAULT 0 CHECK (arquivado_legal IN (0, 1)),
  criado_em_utc TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS eventos_processados (
  event_id TEXT PRIMARY KEY,
  origem TEXT NOT NULL,
  empresa_id INTEGER NOT NULL DEFAULT 1,
  assinatura_hmac_valida INTEGER NOT NULL CHECK (assinatura_hmac_valida = 1),
  payload_sha256 TEXT NOT NULL,
  efeito_resumo TEXT NOT NULL,
  processado_em_utc TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS cobrancas_saida_idempotentes (
  idempotency_key TEXT PRIMARY KEY,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  comanda_id INTEGER REFERENCES pdv_comandas_acid(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  gateway TEXT NOT NULL,
  valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
  status TEXT NOT NULL,
  resposta_json TEXT NOT NULL,
  criado_em_utc TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS consumo_hard_limits (
  bucket_key TEXT PRIMARY KEY,
  escopo TEXT NOT NULL,
  janela_utc TEXT NOT NULL,
  contagem INTEGER NOT NULL CHECK (contagem >= 0),
  limite_maximo INTEGER NOT NULL CHECK (limite_maximo > 0),
  atualizado_em_utc TEXT NOT NULL,
  CHECK (contagem <= limite_maximo)
) STRICT;
