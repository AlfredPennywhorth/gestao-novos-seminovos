-- =============================================================================
-- Script 09: limpeza controlada da importação de fevereiro/2026
--
-- IMPORTANTE:
-- 1. Revise v_competencia e v_nome_arquivo antes de executar.
-- 2. O filtro de nome deve identificar somente o arquivo/lote a ser reimportado.
-- 3. Itens são removidos apenas quando ficam sem saídas e sem custos vinculados.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_competencia DATE := DATE '2026-02-01';
  v_nome_arquivo TEXT := '02 - RELATÓRIO COMPARATIVO - FEV-2026.XLSX';
  v_lotes INTEGER;
BEGIN
  CREATE TEMP TABLE tmp_lotes_fevereiro ON COMMIT DROP AS
  SELECT DISTINCT l.id
  FROM public.lotes_importacao l
  JOIN public.saidas_itens s ON s.lote_importacao_id = l.id
  WHERE s.origem = 'IMPORTACAO'
    AND s.competencia = v_competencia
    AND UPPER(TRIM(l.nome_arquivo)) = v_nome_arquivo;

  SELECT COUNT(*) INTO v_lotes FROM tmp_lotes_fevereiro;
  IF v_lotes = 0 THEN
    RAISE EXCEPTION
      'Nenhum lote encontrado para competência % e filtro de arquivo %',
      v_competencia, v_nome_arquivo;
  END IF;

  CREATE TEMP TABLE tmp_itens_fevereiro ON COMMIT DROP AS
  SELECT DISTINCT s.item_id
  FROM public.saidas_itens s
  JOIN tmp_lotes_fevereiro l ON l.id = s.lote_importacao_id;

  DELETE FROM public.saidas_itens s
  USING tmp_lotes_fevereiro l
  WHERE s.lote_importacao_id = l.id;

  DELETE FROM public.lotes_importacao l
  USING tmp_lotes_fevereiro alvo
  WHERE l.id = alvo.id;

  DELETE FROM public.item_setor vinculo
  USING tmp_itens_fevereiro candidato
  WHERE vinculo.item_id = candidato.item_id
    AND NOT EXISTS (
      SELECT 1 FROM public.saidas_itens s WHERE s.item_id = candidato.item_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.custos_mensais_itens c WHERE c.item_id = candidato.item_id
    );

  DELETE FROM public.itens item
  USING tmp_itens_fevereiro candidato
  WHERE item.id = candidato.item_id
    AND NOT EXISTS (
      SELECT 1 FROM public.saidas_itens s WHERE s.item_id = candidato.item_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.custos_mensais_itens c WHERE c.item_id = candidato.item_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.item_setor vinculo WHERE vinculo.item_id = candidato.item_id
    );

  RAISE NOTICE '% lote(s) de fevereiro removido(s) com segurança.', v_lotes;
END $$;

COMMIT;
