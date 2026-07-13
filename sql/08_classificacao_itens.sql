-- =============================================================================
-- Script 08: suporte à classificação de itens por código
-- Execute após 07_importacao_codigo_itens.sql.
-- =============================================================================

BEGIN;

-- O código é a identidade do item. Nomes podem se repetir para códigos distintos.
DROP INDEX IF EXISTS public.idx_itens_nome;
CREATE INDEX IF NOT EXISTS idx_itens_nome
  ON public.itens(LOWER(nome))
  WHERE ativo = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_itens_codigo
  ON public.itens(UPPER(codigo))
  WHERE codigo IS NOT NULL AND ativo = TRUE;

INSERT INTO public.setores (nome, descricao, ativo)
SELECT 'OUTROS', 'Itens aguardando classificação manual', TRUE
WHERE NOT EXISTS (
  SELECT 1
  FROM public.setores
  WHERE UPPER(TRIM(nome)) = 'OUTROS' AND ativo = TRUE
);

CREATE OR REPLACE FUNCTION public.atualizar_setor_item(
  p_item_id UUID,
  p_setor_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar o setor de um item';
  END IF;

  DELETE FROM public.item_setor WHERE item_id = p_item_id;
  INSERT INTO public.item_setor (item_id, setor_id, ativo)
  VALUES (p_item_id, p_setor_id, TRUE);
END;
$$;

REVOKE ALL ON FUNCTION public.atualizar_setor_item(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atualizar_setor_item(UUID, UUID) TO authenticated;

COMMIT;
