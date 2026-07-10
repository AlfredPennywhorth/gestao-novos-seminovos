-- =============================================================================
-- SISTEMA DE GESTÃO DE SAÍDAS — NOVOS & SEMINOVOS
-- Script 04: Funções Auxiliares e Triggers
-- Execute APÓS o script 03_seed.sql
-- =============================================================================

-- =============================================================================
-- TRIGGER: Criar profile automaticamente ao registrar novo usuário no Auth
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, role, ativo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'VISUALIZADOR'),
    TRUE
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vincular trigger ao evento de novo usuário no Auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- FUNÇÃO: Buscar custo efetivo por waterfall de prioridade
-- Retorna (valor_novo, valor_seminovo, fonte)
-- Fonte: 'item+almoxarifado', 'item', 'geral', 'padrao'
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_custo_efetivo(
  p_competencia     DATE,
  p_item_id         UUID,
  p_almoxarifado_id UUID DEFAULT NULL
)
RETURNS TABLE(
  valor_novo     NUMERIC(12,2),
  valor_seminovo NUMERIC(12,2),
  fonte          TEXT
) AS $$
DECLARE
  v_valor_novo     NUMERIC(12,2);
  v_valor_seminovo NUMERIC(12,2);
  v_fonte          TEXT;
BEGIN
  -- 1. Busca: item + almoxarifado + competência
  IF p_almoxarifado_id IS NOT NULL THEN
    SELECT cmi.valor_medio_novo, cmi.valor_medio_seminovo
    INTO v_valor_novo, v_valor_seminovo
    FROM public.custos_mensais_itens cmi
    WHERE cmi.competencia = DATE_TRUNC('month', p_competencia)
      AND cmi.item_id = p_item_id
      AND cmi.almoxarifado_id = p_almoxarifado_id
      AND cmi.ativo = TRUE
    LIMIT 1;

    IF FOUND THEN
      v_fonte := 'item+almoxarifado';
      RETURN QUERY SELECT v_valor_novo, v_valor_seminovo, v_fonte;
      RETURN;
    END IF;
  END IF;

  -- 2. Busca: item + competência (sem almoxarifado)
  SELECT cmi.valor_medio_novo, cmi.valor_medio_seminovo
  INTO v_valor_novo, v_valor_seminovo
  FROM public.custos_mensais_itens cmi
  WHERE cmi.competencia = DATE_TRUNC('month', p_competencia)
    AND cmi.item_id = p_item_id
    AND cmi.almoxarifado_id IS NULL
    AND cmi.ativo = TRUE
  LIMIT 1;

  IF FOUND THEN
    v_fonte := 'item';
    RETURN QUERY SELECT v_valor_novo, v_valor_seminovo, v_fonte;
    RETURN;
  END IF;

  -- 3. Busca: custo geral da competência (item_id IS NULL e almoxarifado_id IS NULL)
  SELECT cmi.valor_medio_novo, cmi.valor_medio_seminovo
  INTO v_valor_novo, v_valor_seminovo
  FROM public.custos_mensais_itens cmi
  WHERE cmi.competencia = DATE_TRUNC('month', p_competencia)
    AND cmi.item_id IS NULL
    AND cmi.almoxarifado_id IS NULL
    AND cmi.ativo = TRUE
  LIMIT 1;

  IF FOUND THEN
    v_fonte := 'geral';
    RETURN QUERY SELECT v_valor_novo, v_valor_seminovo, v_fonte;
    RETURN;
  END IF;

  -- 4. Fallback: valores padrão do sistema
  RETURN QUERY SELECT 40.00::NUMERIC(12,2), 4.00::NUMERIC(12,2), 'padrao'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================================================
-- FUNÇÃO: Dashboard — Resumo de saídas por período com cálculo de economia
-- Retorna agregados por competência/setor/item/almoxarifado
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_dashboard_resumo(
  p_data_inicio     DATE DEFAULT NULL,
  p_data_fim        DATE DEFAULT NULL,
  p_almoxarifado_id UUID DEFAULT NULL,
  p_setor_id        UUID DEFAULT NULL,
  p_item_id         UUID DEFAULT NULL,
  p_tipo            TEXT DEFAULT NULL
)
RETURNS TABLE(
  competencia          DATE,
  setor_nome           TEXT,
  item_nome            TEXT,
  almoxarifado_nome    TEXT,
  tipo                 TEXT,
  quantidade           BIGINT,
  valor_novo           NUMERIC(12,2),
  valor_seminovo       NUMERIC(12,2),
  custo_evitado_bruto  NUMERIC(15,2),
  custo_dos_seminovos  NUMERIC(15,2),
  economia_liquida     NUMERIC(15,2),
  fonte_custo          TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.competencia,
    st.nome AS setor_nome,
    i.nome  AS item_nome,
    COALESCE(a.nome, 'Geral') AS almoxarifado_nome,
    s.tipo,
    SUM(s.quantidade)::BIGINT AS quantidade,
    ce.valor_novo,
    ce.valor_seminovo,
    -- Custo evitado bruto (somente SEMINOVO)
    CASE
      WHEN s.tipo = 'SEMINOVO'
      THEN SUM(s.quantidade) * ce.valor_novo
      ELSE 0
    END AS custo_evitado_bruto,
    -- Custo dos seminovos
    CASE
      WHEN s.tipo = 'SEMINOVO'
      THEN SUM(s.quantidade) * ce.valor_seminovo
      ELSE 0
    END AS custo_dos_seminovos,
    -- Economia líquida = Qtd × (Valor Novo - Valor Seminovo)
    CASE
      WHEN s.tipo = 'SEMINOVO'
      THEN SUM(s.quantidade) * (ce.valor_novo - ce.valor_seminovo)
      ELSE 0
    END AS economia_liquida,
    ce.fonte AS fonte_custo
  FROM public.saidas_itens s
  INNER JOIN public.setores st ON st.id = s.setor_id
  INNER JOIN public.itens i    ON i.id  = s.item_id
  LEFT  JOIN public.almoxarifados a ON a.id = s.almoxarifado_id
  -- Subconsulta lateral para waterfall de custo
  LEFT JOIN LATERAL (
    SELECT ce2.valor_novo, ce2.valor_seminovo, ce2.fonte
    FROM public.get_custo_efetivo(s.competencia, s.item_id, s.almoxarifado_id) ce2
  ) ce ON TRUE
  WHERE
    (p_data_inicio IS NULL OR s.competencia >= p_data_inicio)
    AND (p_data_fim IS NULL OR s.competencia <= p_data_fim)
    AND (p_almoxarifado_id IS NULL OR s.almoxarifado_id = p_almoxarifado_id)
    AND (p_setor_id IS NULL OR s.setor_id = p_setor_id)
    AND (p_item_id IS NULL OR s.item_id = p_item_id)
    AND (p_tipo IS NULL OR s.tipo = p_tipo)
  GROUP BY
    s.competencia, st.nome, i.nome, a.nome, s.tipo,
    ce.valor_novo, ce.valor_seminovo, ce.fonte
  ORDER BY
    s.competencia, st.nome, i.nome;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================================================
-- FUNÇÃO: KPI totais para o dashboard (cards principais)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_dashboard_kpis(
  p_data_inicio     DATE DEFAULT NULL,
  p_data_fim        DATE DEFAULT NULL,
  p_almoxarifado_id UUID DEFAULT NULL,
  p_setor_id        UUID DEFAULT NULL,
  p_item_id         UUID DEFAULT NULL
)
RETURNS TABLE(
  total_saidas           BIGINT,
  total_novos            BIGINT,
  total_seminovos        BIGINT,
  percentual_seminovos   NUMERIC(5,2),
  economia_estimada      NUMERIC(15,2),
  custo_evitado_bruto    NUMERIC(15,2),
  media_mensal_economia  NUMERIC(15,2),
  meses_com_dados        BIGINT
) AS $$
DECLARE
  v_total_saidas          BIGINT;
  v_total_novos           BIGINT;
  v_total_seminovos       BIGINT;
  v_economia              NUMERIC(15,2) := 0;
  v_custo_evitado         NUMERIC(15,2) := 0;
  v_meses                 BIGINT;
BEGIN
  -- Agregar totais básicos
  SELECT
    SUM(s.quantidade),
    SUM(CASE WHEN s.tipo = 'NOVO'     THEN s.quantidade ELSE 0 END),
    SUM(CASE WHEN s.tipo = 'SEMINOVO' THEN s.quantidade ELSE 0 END),
    COUNT(DISTINCT DATE_TRUNC('month', s.competencia))
  INTO v_total_saidas, v_total_novos, v_total_seminovos, v_meses
  FROM public.saidas_itens s
  WHERE
    (p_data_inicio IS NULL OR s.competencia >= p_data_inicio)
    AND (p_data_fim IS NULL OR s.competencia <= p_data_fim)
    AND (p_almoxarifado_id IS NULL OR s.almoxarifado_id = p_almoxarifado_id)
    AND (p_setor_id IS NULL OR s.setor_id = p_setor_id)
    AND (p_item_id IS NULL OR s.item_id = p_item_id);

  -- Calcular economia apenas para saídas SEMINOVO
  SELECT
    COALESCE(SUM(s.quantidade * (ce.valor_novo - ce.valor_seminovo)), 0),
    COALESCE(SUM(s.quantidade * ce.valor_novo), 0)
  INTO v_economia, v_custo_evitado
  FROM public.saidas_itens s
  LEFT JOIN LATERAL (
    SELECT ce2.valor_novo, ce2.valor_seminovo
    FROM public.get_custo_efetivo(s.competencia, s.item_id, s.almoxarifado_id) ce2
  ) ce ON TRUE
  WHERE
    s.tipo = 'SEMINOVO'
    AND (p_data_inicio IS NULL OR s.competencia >= p_data_inicio)
    AND (p_data_fim IS NULL OR s.competencia <= p_data_fim)
    AND (p_almoxarifado_id IS NULL OR s.almoxarifado_id = p_almoxarifado_id)
    AND (p_setor_id IS NULL OR s.setor_id = p_setor_id)
    AND (p_item_id IS NULL OR s.item_id = p_item_id);

  RETURN QUERY SELECT
    COALESCE(v_total_saidas, 0),
    COALESCE(v_total_novos, 0),
    COALESCE(v_total_seminovos, 0),
    CASE
      WHEN COALESCE(v_total_saidas, 0) > 0
      THEN ROUND((v_total_seminovos::NUMERIC / v_total_saidas) * 100, 2)
      ELSE 0::NUMERIC(5,2)
    END,
    COALESCE(v_economia, 0),
    COALESCE(v_custo_evitado, 0),
    CASE
      WHEN COALESCE(v_meses, 0) > 0
      THEN ROUND(v_economia / v_meses, 2)
      ELSE 0::NUMERIC(15,2)
    END,
    COALESCE(v_meses, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================================================
-- FUNÇÃO: Série temporal mensal (para gráfico principal do dashboard)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_serie_temporal(
  p_data_inicio     DATE DEFAULT NULL,
  p_data_fim        DATE DEFAULT NULL,
  p_almoxarifado_id UUID DEFAULT NULL,
  p_setor_id        UUID DEFAULT NULL,
  p_item_id         UUID DEFAULT NULL
)
RETURNS TABLE(
  mes              DATE,
  total_novos      BIGINT,
  total_seminovos  BIGINT,
  total_geral      BIGINT,
  economia_mes     NUMERIC(15,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE_TRUNC('month', s.competencia)::DATE AS mes,
    SUM(CASE WHEN s.tipo = 'NOVO'     THEN s.quantidade ELSE 0 END)::BIGINT AS total_novos,
    SUM(CASE WHEN s.tipo = 'SEMINOVO' THEN s.quantidade ELSE 0 END)::BIGINT AS total_seminovos,
    SUM(s.quantidade)::BIGINT AS total_geral,
    COALESCE(SUM(
      CASE
        WHEN s.tipo = 'SEMINOVO'
        THEN s.quantidade * (ce.valor_novo - ce.valor_seminovo)
        ELSE 0
      END
    ), 0)::NUMERIC(15,2) AS economia_mes
  FROM public.saidas_itens s
  LEFT JOIN LATERAL (
    SELECT ce2.valor_novo, ce2.valor_seminovo
    FROM public.get_custo_efetivo(s.competencia, s.item_id, s.almoxarifado_id) ce2
  ) ce ON TRUE
  WHERE
    (p_data_inicio IS NULL OR s.competencia >= p_data_inicio)
    AND (p_data_fim IS NULL OR s.competencia <= p_data_fim)
    AND (p_almoxarifado_id IS NULL OR s.almoxarifado_id = p_almoxarifado_id)
    AND (p_setor_id IS NULL OR s.setor_id = p_setor_id)
    AND (p_item_id IS NULL OR s.item_id = p_item_id)
  GROUP BY DATE_TRUNC('month', s.competencia)
  ORDER BY mes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================================================
-- FUNÇÃO: Itens sem custo específico cadastrado (alerta do dashboard)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_itens_sem_custo_especifico(
  p_data_inicio DATE DEFAULT NULL,
  p_data_fim    DATE DEFAULT NULL
)
RETURNS TABLE(
  item_id        UUID,
  item_nome      TEXT,
  competencia    DATE,
  total_saidas   BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    i.id,
    i.nome,
    DATE_TRUNC('month', s.competencia)::DATE,
    SUM(s.quantidade)::BIGINT
  FROM public.saidas_itens s
  INNER JOIN public.itens i ON i.id = s.item_id
  WHERE
    s.tipo = 'SEMINOVO'
    AND (p_data_inicio IS NULL OR s.competencia >= p_data_inicio)
    AND (p_data_fim IS NULL OR s.competencia <= p_data_fim)
    -- Sem custo específico por item nessa competência
    AND NOT EXISTS (
      SELECT 1 FROM public.custos_mensais_itens cmi
      WHERE cmi.item_id = s.item_id
        AND cmi.competencia = DATE_TRUNC('month', s.competencia)
        AND cmi.ativo = TRUE
    )
  GROUP BY i.id, i.nome, DATE_TRUNC('month', s.competencia)
  ORDER BY DATE_TRUNC('month', s.competencia), i.nome;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================================================
-- FIM DAS FUNÇÕES
-- =============================================================================
