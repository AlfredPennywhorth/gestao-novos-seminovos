-- =============================================================================
-- SISTEMA DE GESTÃO DE SAÍDAS — NOVOS & SEMINOVOS
-- Script 07: Importação por código de item e almoxarifado da planilha comparativa
-- Execute após os scripts anteriores em bases já existentes.
-- =============================================================================

ALTER TABLE public.itens
  ADD COLUMN IF NOT EXISTS codigo TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_itens_codigo
  ON public.itens(UPPER(codigo))
  WHERE codigo IS NOT NULL AND ativo = TRUE;

COMMENT ON COLUMN public.itens.codigo IS
  'Código original do item na planilha comparativa. Usado como chave preferencial de importação.';

-- Ajusta os códigos dos almoxarifados para aceitar as siglas da planilha recebida.
UPDATE public.almoxarifados
SET codigo = 'VP'
WHERE LOWER(nome) = 'vila prudente'
  AND (codigo IS NULL OR UPPER(codigo) IN ('VPR', 'VP'));

UPDATE public.almoxarifados
SET codigo = 'VG'
WHERE LOWER(nome) = 'vila guarani'
  AND (codigo IS NULL OR UPPER(codigo) IN ('VGU', 'VG'));

UPDATE public.almoxarifados
SET codigo = 'SPB'
WHERE LOWER(nome) = 'sapopemba'
  AND (codigo IS NULL OR UPPER(codigo) IN ('SAP', 'SPB'));
