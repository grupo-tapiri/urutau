INSERT OR IGNORE INTO empresas (id, nome, cnpj, ativo, criado_em_utc)
VALUES (1, 'Matriz Urutau', '00.000.000/0001-01', 1, '2026-01-01T00:00:00.000Z');

INSERT OR IGNORE INTO taxas_entrega_zonas (id, empresa_id, zona_codigo, nome, taxa_centavos, ativo)
VALUES
  (1, 1, 'PADRAO', 'Zona Urbana Padrão', 800, 1),
  (2, 1, 'CENTRO', 'Raio Central (Até 3km)', 600, 1),
  (3, 1, 'DISTANTE', 'Zona Expandida (Acima de 7km)', 1500, 1),
  (4, 1, 'RETIRADA', 'Retirada no Balcão', 0, 1);

INSERT OR IGNORE INTO cupons_desconto (id, empresa_id, codigo, tipo, valor, uso_maximo, usos_atuais, ativo, expira_em_utc)
VALUES
  (1, 1, 'URUTAU10', 'PERCENTUAL_BPS', 1000, 5000, 0, 1, '2030-12-31T23:59:59.000Z'),
  (2, 1, 'BEMVINDO5', 'FIXO_CENTAVOS', 500, 5000, 0, 1, '2030-12-31T23:59:59.000Z');
