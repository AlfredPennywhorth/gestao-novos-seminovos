-- =============================================================================
-- Script 10: unificação de setores legados
--
-- Destinos canônicos:
--   FEMININO INFANTIL  -> INFANTIL FEMININO
--   MASCULINO INFANTIL -> INFANTIL MASCULINO
--   BEBÊ - CAMA E BANHO - CHINELOS -> catálogo por código; sem código -> OUTROS
--
-- O script preserva históricos e soma quantidades quando a troca de setor
-- encontra uma saída equivalente já existente no setor de destino.
-- Pode ser executado novamente sem duplicar registros.
-- =============================================================================

BEGIN;

INSERT INTO public.setores (nome, descricao, ativo)
VALUES
  ('BEBÊ', 'Itens para bebês', TRUE),
  ('CAMA, MESA E BANHO', 'Itens de cama, mesa e banho', TRUE),
  ('INFANTIL FEMININO', 'Roupas e itens femininos infantis', TRUE),
  ('INFANTIL MASCULINO', 'Roupas e itens masculinos infantis', TRUE),
  ('OUTROS', 'Itens aguardando classificação manual', TRUE)
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE tmp_setores_legados ON COMMIT DROP AS
SELECT id, UPPER(TRIM(nome)) AS nome
FROM public.setores
WHERE UPPER(TRIM(nome)) IN (
  'BEBÊ - CAMA E BANHO - CHINELOS',
  'FEMININO INFANTIL',
  'MASCULINO INFANTIL'
);

CREATE TEMP TABLE tmp_classificacao_codigo (
  codigo TEXT PRIMARY KEY,
  setor_nome TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO tmp_classificacao_codigo (codigo, setor_nome)
SELECT codigo, 'BEBÊ'
FROM unnest(ARRAY[
  'B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07M',
  'B08C-G', 'B08C-M', 'B08C-P', 'B08L-G', 'B08L-M', 'B08L-P',
  'B09', 'B10C', 'B11-G', 'B11-M', 'B11-P', 'B12', 'B13', 'B14',
  'B15', 'B16', 'B18', 'B19', 'B33', 'B50-M', 'B90', 'D31'
]::TEXT[]) AS codigo;

INSERT INTO tmp_classificacao_codigo (codigo, setor_nome)
SELECT codigo, 'CAMA, MESA E BANHO'
FROM unnest(ARRAY[
  'C01-C', 'C01-S', 'C01C', 'C01S', 'C03-C', 'C03-S', 'C04',
  'C05-C', 'C05-S', 'C05-S-SC', 'C06-B', 'C06-B-SC', 'C06-J',
  'C06-R', 'C06-R-SC', 'C07', 'C08-B', 'C08-C', 'C08-S', 'D36'
]::TEXT[]) AS codigo;

CREATE TEMP TABLE tmp_item_destino ON COMMIT DROP AS
WITH itens_legados AS (
  SELECT vinculo.item_id, legado.nome
  FROM public.item_setor vinculo
  JOIN tmp_setores_legados legado ON legado.id = vinculo.setor_id

  UNION ALL

  SELECT saida.item_id, legado.nome
  FROM public.saidas_itens saida
  JOIN tmp_setores_legados legado ON legado.id = saida.setor_id
), resumo AS (
  SELECT
    item_id,
    BOOL_OR(nome = 'FEMININO INFANTIL') AS feminino,
    BOOL_OR(nome = 'MASCULINO INFANTIL') AS masculino
  FROM itens_legados
  GROUP BY item_id
), classificados AS (
  SELECT
    resumo.item_id,
    CASE
      WHEN resumo.feminino THEN 'INFANTIL FEMININO'
      WHEN resumo.masculino THEN 'INFANTIL MASCULINO'
      ELSE COALESCE(catalogo.setor_nome, 'OUTROS')
    END AS setor_nome
  FROM resumo
  JOIN public.itens item ON item.id = resumo.item_id
  LEFT JOIN tmp_classificacao_codigo catalogo
    ON catalogo.codigo = UPPER(TRIM(item.codigo))
)
SELECT classificados.item_id, destino.id AS setor_id
FROM classificados
JOIN public.setores destino
  ON UPPER(TRIM(destino.nome)) = classificados.setor_nome
 AND destino.ativo = TRUE;

-- Agrupa todas as saídas legadas pela chave única que terão após a migração.
CREATE TEMP TABLE tmp_saidas_consolidadas ON COMMIT DROP AS
SELECT
  saida.competencia,
  saida.almoxarifado_id,
  destino.setor_id,
  saida.item_id,
  saida.tipo,
  saida.lote_importacao_id,
  ARRAY_AGG(saida.id ORDER BY saida.id) AS ids_origem,
  SUM(saida.quantidade)::INTEGER AS quantidade,
  (
    SELECT atual.id
    FROM public.saidas_itens atual
    WHERE atual.competencia = saida.competencia
      AND atual.almoxarifado_id IS NOT DISTINCT FROM saida.almoxarifado_id
      AND atual.setor_id = destino.setor_id
      AND atual.item_id = saida.item_id
      AND atual.tipo = saida.tipo
      AND atual.lote_importacao_id IS NOT DISTINCT FROM saida.lote_importacao_id
    LIMIT 1
  ) AS id_destino_existente
FROM public.saidas_itens saida
JOIN tmp_setores_legados legado ON legado.id = saida.setor_id
JOIN tmp_item_destino destino ON destino.item_id = saida.item_id
GROUP BY
  saida.competencia,
  saida.almoxarifado_id,
  destino.setor_id,
  saida.item_id,
  saida.tipo,
  saida.lote_importacao_id;

-- Se já existe a mesma saída no destino, incorpora a quantidade nela.
UPDATE public.saidas_itens atual
SET quantidade = atual.quantidade + consolidada.quantidade
FROM tmp_saidas_consolidadas consolidada
WHERE consolidada.id_destino_existente = atual.id;

DELETE FROM public.saidas_itens saida
USING tmp_saidas_consolidadas consolidada
WHERE consolidada.id_destino_existente IS NOT NULL
  AND saida.id = ANY(consolidada.ids_origem);

-- Sem registro no destino, mantém uma origem, remove eventuais duplicatas
-- legadas e então troca seu setor.
DELETE FROM public.saidas_itens saida
USING tmp_saidas_consolidadas consolidada
WHERE consolidada.id_destino_existente IS NULL
  AND saida.id = ANY(consolidada.ids_origem)
  AND saida.id <> consolidada.ids_origem[1];

UPDATE public.saidas_itens saida
SET
  setor_id = consolidada.setor_id,
  quantidade = consolidada.quantidade
FROM tmp_saidas_consolidadas consolidada
WHERE consolidada.id_destino_existente IS NULL
  AND saida.id = consolidada.ids_origem[1];

-- Garante um único vínculo ativo do item com o setor canônico.
INSERT INTO public.item_setor (item_id, setor_id, ativo)
SELECT destino.item_id, destino.setor_id, TRUE
FROM tmp_item_destino destino
WHERE NOT EXISTS (
  SELECT 1
  FROM public.item_setor atual
  WHERE atual.item_id = destino.item_id
    AND atual.setor_id = destino.setor_id
    AND atual.ativo = TRUE
);

DELETE FROM public.item_setor vinculo
USING tmp_setores_legados legado
WHERE vinculo.setor_id = legado.id;

-- O setor misto não tem mais função após a redistribuição. Exclui somente
-- quando não restar nenhum vínculo ou histórico apontando para ele. Este
-- bloco usa apenas tabelas permanentes para também poder ser repetido sozinho.
DELETE FROM public.setores setor
WHERE UPPER(TRIM(setor.nome)) = 'BEBÊ - CAMA E BANHO - CHINELOS'
  AND NOT EXISTS (
    SELECT 1 FROM public.item_setor vinculo WHERE vinculo.setor_id = setor.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.saidas_itens saida WHERE saida.setor_id = setor.id
  );

UPDATE public.setores setor
SET ativo = FALSE
WHERE UPPER(TRIM(setor.nome)) IN (
    'BEBÊ - CAMA E BANHO - CHINELOS',
    'FEMININO INFANTIL',
    'MASCULINO INFANTIL'
  )
  AND setor.ativo = TRUE;

COMMIT;

-- Verificação esperada: somente os nomes canônicos devem permanecer ativos.
SELECT nome, ativo
FROM public.setores
WHERE UPPER(TRIM(nome)) IN (
  'BEBÊ',
  'BEBÊ - CAMA E BANHO - CHINELOS',
  'CAMA, MESA E BANHO',
  'FEMININO INFANTIL',
  'INFANTIL FEMININO',
  'MASCULINO INFANTIL',
  'INFANTIL MASCULINO',
  'OUTROS'
)
ORDER BY nome;
