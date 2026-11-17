CREATE INDEX IF NOT EXISTS idx_usuarios_empresa_id
  ON usuarios(empresa_id);

CREATE INDEX IF NOT EXISTS idx_produtos_empresa_ativo
  ON produtos_catalogo(empresa_id, ativo, nome);

CREATE INDEX IF NOT EXISTS idx_produtos_estoque_fk
  ON produtos_catalogo(estoque_item_id);

CREATE INDEX IF NOT EXISTS idx_estoque_empresa_nome
  ON estoque_saldos(empresa_id, insumo_nome);

CREATE INDEX IF NOT EXISTS idx_cupons_empresa_codigo
  ON cupons_desconto(empresa_id, codigo, ativo);

CREATE INDEX IF NOT EXISTS idx_taxas_entrega_empresa_zona
  ON taxas_entrega_zonas(empresa_id, zona_codigo, ativo);

CREATE INDEX IF NOT EXISTS idx_comandas_empresa_status_criado
  ON pdv_comandas_acid(empresa_id, status, criado_em_utc DESC);

CREATE INDEX IF NOT EXISTS idx_comandas_identificador_aberto
  ON pdv_comandas_acid(empresa_id, unidade_id, identificador, status);

CREATE INDEX IF NOT EXISTS idx_comanda_itens_comanda_id
  ON pdv_comanda_itens_acid(comanda_id, cancelado);

CREATE INDEX IF NOT EXISTS idx_comanda_itens_empresa_id
  ON pdv_comanda_itens_acid(empresa_id);

CREATE INDEX IF NOT EXISTS idx_comanda_itens_produto_id
  ON pdv_comanda_itens_acid(produto_id);

CREATE INDEX IF NOT EXISTS idx_pagamentos_comanda_id
  ON pdv_pagamentos_acid(comanda_id, criado_em_utc);

CREATE INDEX IF NOT EXISTS idx_pagamentos_empresa_id
  ON pdv_pagamentos_acid(empresa_id, criado_em_utc DESC);

CREATE INDEX IF NOT EXISTS idx_caixa_empresa_data
  ON caixa_lancamentos_acid(empresa_id, data_referencia_utc DESC, criado_em_utc DESC);

CREATE INDEX IF NOT EXISTS idx_caixa_origem_comanda
  ON caixa_lancamentos_acid(origem_comanda_id);

CREATE INDEX IF NOT EXISTS idx_eventos_origem_data
  ON eventos_processados(origem, processado_em_utc DESC);

CREATE INDEX IF NOT EXISTS idx_cobrancas_empresa_comanda
  ON cobrancas_saida_idempotentes(empresa_id, comanda_id);

CREATE INDEX IF NOT EXISTS idx_hard_limits_escopo_janela
  ON consumo_hard_limits(escopo, janela_utc);
