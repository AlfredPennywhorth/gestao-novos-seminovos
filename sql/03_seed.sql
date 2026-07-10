-- =============================================================================
-- SISTEMA DE GESTÃO DE SAÍDAS — NOVOS & SEMINOVOS
-- Script 03: Seed Inicial
-- Execute APÓS o script 02_rls.sql
-- =============================================================================

-- =============================================================================
-- ALMOXARIFADOS INICIAIS
-- =============================================================================
INSERT INTO public.almoxarifados (nome, codigo, descricao, aceita_novos, aceita_seminovos, ativo)
VALUES
  ('Geral',          'GRL', 'Almoxarifado padrão para dados importados sem almoxarifado específico', TRUE,  TRUE,  TRUE),
  ('Vila Prudente',  'VPR', 'Unidade Vila Prudente',  TRUE,  TRUE,  TRUE),
  ('Vila Guarani',   'VGU', 'Unidade Vila Guarani',   FALSE, TRUE,  TRUE),
  ('Sapopemba',      'SAP', 'Unidade Sapopemba',      FALSE, TRUE,  TRUE),
  ('Canindé',        'CAN', 'Unidade Canindé',        FALSE, TRUE,  TRUE)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- SETORES INICIAIS (baseados na aba tblSeminovos da planilha)
-- =============================================================================
INSERT INTO public.setores (nome, descricao, ativo)
VALUES
  ('BEBÊ - CAMA E BANHO - CHINELOS', 'Itens para bebês: cama, banho e calçados', TRUE),
  ('ENFERMOS',                        'Itens para pacientes/enfermos',             TRUE),
  ('FEMININO ADULTO',                 'Roupas e itens femininos adultos',           TRUE),
  ('FEMININO INFANTIL',               'Roupas e itens femininos infantis',          TRUE),
  ('MASCULINO ADULTO',                'Roupas e itens masculinos adultos',          TRUE),
  ('MASCULINO INFANTIL',              'Roupas e itens masculinos infantis',         TRUE)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- CUSTO MÉDIO GERAL INICIAL (fallback padrão do sistema)
-- Competência: Janeiro/2023 até Dezembro/2026 (cobertura ampla)
-- =============================================================================
DO $$
DECLARE
  v_mes DATE;
BEGIN
  -- Inserir custo geral para cada mês de Jan/2023 a Dez/2026
  v_mes := '2023-01-01'::DATE;
  WHILE v_mes <= '2026-12-01'::DATE LOOP
    INSERT INTO public.custos_mensais_itens (
      competencia,
      item_id,
      almoxarifado_id,
      valor_medio_novo,
      valor_medio_seminovo,
      observacao,
      ativo
    ) VALUES (
      v_mes,
      NULL,   -- geral: aplica a todos os itens
      NULL,   -- geral: aplica a todos os almoxarifados
      40.00,
      4.00,
      'Custo médio padrão inicial do sistema',
      TRUE
    )
    ON CONFLICT DO NOTHING;

    v_mes := v_mes + INTERVAL '1 month';
  END LOOP;
END $$;

-- =============================================================================
-- FIM DO SEED
-- =============================================================================
