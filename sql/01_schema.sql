-- =============================================================================
-- SISTEMA DE GESTÃO DE SAÍDAS — NOVOS & SEMINOVOS
-- Script 01: Schema Completo
-- Executar no SQL Editor do Supabase, na ordem apresentada
-- =============================================================================

-- Extensão para gerar UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- FUNÇÃO AUXILIAR: atualizar updated_at automaticamente
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TABELA: profiles
-- Complementa auth.users do Supabase com dados do perfil de acesso
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome        TEXT,
  email       TEXT,
  role        TEXT NOT NULL DEFAULT 'VISUALIZADOR'
                CHECK (role IN ('ADMIN', 'OPERADOR', 'VISUALIZADOR')),
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.profiles IS 'Perfis de usuário vinculados ao Supabase Auth';
COMMENT ON COLUMN public.profiles.role IS 'ADMIN | OPERADOR | VISUALIZADOR';

-- =============================================================================
-- TABELA: almoxarifados
-- Unidades físicas que gerenciam os itens
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.almoxarifados (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome               TEXT NOT NULL,
  codigo             TEXT,
  descricao          TEXT,
  aceita_novos       BOOLEAN NOT NULL DEFAULT FALSE,
  aceita_seminovos   BOOLEAN NOT NULL DEFAULT TRUE,
  ativo              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_almoxarifados_nome ON public.almoxarifados(LOWER(nome)) WHERE ativo = TRUE;

CREATE TRIGGER trg_almoxarifados_updated_at
  BEFORE UPDATE ON public.almoxarifados
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.almoxarifados IS 'Almoxarifados / unidades físicas';
COMMENT ON COLUMN public.almoxarifados.aceita_novos IS 'Indica se o almoxarifado distribui itens novos';
COMMENT ON COLUMN public.almoxarifados.aceita_seminovos IS 'Indica se o almoxarifado distribui itens seminovos';

-- =============================================================================
-- TABELA: setores
-- Grupos/classificações dos itens (ex: FEMININO ADULTO, ENFERMOS)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.setores (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome        TEXT NOT NULL,
  descricao   TEXT,
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_setores_nome ON public.setores(LOWER(nome)) WHERE ativo = TRUE;

CREATE TRIGGER trg_setores_updated_at
  BEFORE UPDATE ON public.setores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.setores IS 'Setores / grupos de itens conforme planilha tblSeminovos';

-- =============================================================================
-- TABELA: itens
-- Catálogo de itens distribuídos
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.itens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome        TEXT NOT NULL,
  descricao   TEXT,
  unidade     TEXT NOT NULL DEFAULT 'peça',
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_itens_nome ON public.itens(LOWER(nome)) WHERE ativo = TRUE;

CREATE TRIGGER trg_itens_updated_at
  BEFORE UPDATE ON public.itens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.itens IS 'Catálogo de itens (um item pode aparecer em vários setores)';

-- =============================================================================
-- TABELA: item_setor
-- Relacionamento N:N entre itens e setores
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.item_setor (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id    UUID NOT NULL REFERENCES public.itens(id) ON DELETE CASCADE,
  setor_id   UUID NOT NULL REFERENCES public.setores(id) ON DELETE CASCADE,
  ativo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_item_setor_unique
  ON public.item_setor(item_id, setor_id) WHERE ativo = TRUE;

COMMENT ON TABLE public.item_setor IS 'Vínculo entre itens e setores (N:N)';

-- =============================================================================
-- TABELA: custos_mensais_itens
-- Custo médio mensal por competência, com granularidade por item e almoxarifado.
-- Waterfall de busca:
--   1. item + almoxarifado + competência
--   2. item + competência (almoxarifado_id IS NULL)
--   3. competência geral (item_id IS NULL e almoxarifado_id IS NULL)
--   4. Fallback padrão: Novo=40, Seminovo=4
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.custos_mensais_itens (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competencia          DATE NOT NULL,
  item_id              UUID REFERENCES public.itens(id) ON DELETE SET NULL,
  almoxarifado_id      UUID REFERENCES public.almoxarifados(id) ON DELETE SET NULL,
  valor_medio_novo     NUMERIC(12,2) NOT NULL DEFAULT 40.00,
  valor_medio_seminovo NUMERIC(12,2) NOT NULL DEFAULT 4.00,
  observacao           TEXT,
  ativo                BOOLEAN NOT NULL DEFAULT TRUE,
  created_by           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_valor_novo_positivo    CHECK (valor_medio_novo >= 0),
  CONSTRAINT chk_valor_seminovo_positivo CHECK (valor_medio_seminovo >= 0)
);

-- Índice para busca rápida por competência + item + almoxarifado
CREATE INDEX IF NOT EXISTS idx_custos_competencia ON public.custos_mensais_itens(competencia);
CREATE INDEX IF NOT EXISTS idx_custos_item ON public.custos_mensais_itens(item_id);
CREATE INDEX IF NOT EXISTS idx_custos_almoxarifado ON public.custos_mensais_itens(almoxarifado_id);

-- Unicidade: não pode ter dois registros com mesma competência + item + almoxarifado
CREATE UNIQUE INDEX IF NOT EXISTS idx_custos_unique
  ON public.custos_mensais_itens(
    competencia,
    COALESCE(item_id, '00000000-0000-0000-0000-000000000000'),
    COALESCE(almoxarifado_id, '00000000-0000-0000-0000-000000000000')
  ) WHERE ativo = TRUE;

CREATE TRIGGER trg_custos_updated_at
  BEFORE UPDATE ON public.custos_mensais_itens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.custos_mensais_itens IS 'Custos médios mensais por competência (geral, por item ou por item+almoxarifado)';
COMMENT ON COLUMN public.custos_mensais_itens.competencia IS 'Primeiro dia do mês de referência (ex: 2024-01-01)';
COMMENT ON COLUMN public.custos_mensais_itens.item_id IS 'NULL = custo geral (aplica a todos os itens nessa competência)';
COMMENT ON COLUMN public.custos_mensais_itens.almoxarifado_id IS 'NULL = aplica a todos os almoxarifados';

-- =============================================================================
-- TABELA: lotes_importacao
-- Rastreia cada importação de planilha Excel
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lotes_importacao (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome_arquivo             TEXT NOT NULL,
  almoxarifado_id          UUID REFERENCES public.almoxarifados(id) ON DELETE SET NULL,
  data_importacao          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  usuario_id               UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  total_linhas_lidas       INTEGER NOT NULL DEFAULT 0,
  total_registros_novo     INTEGER NOT NULL DEFAULT 0,
  total_registros_seminovo INTEGER NOT NULL DEFAULT 0,
  total_qtd_novo           INTEGER NOT NULL DEFAULT 0,
  total_qtd_seminovo       INTEGER NOT NULL DEFAULT 0,
  setores_criados          INTEGER NOT NULL DEFAULT 0,
  itens_criados            INTEGER NOT NULL DEFAULT 0,
  status                   TEXT NOT NULL DEFAULT 'PENDENTE'
                             CHECK (status IN ('PENDENTE', 'PROCESSANDO', 'CONCLUIDO', 'ERRO', 'DESFEITO')),
  observacoes              TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lotes_usuario ON public.lotes_importacao(usuario_id);
CREATE INDEX IF NOT EXISTS idx_lotes_status ON public.lotes_importacao(status);

CREATE TRIGGER trg_lotes_updated_at
  BEFORE UPDATE ON public.lotes_importacao
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.lotes_importacao IS 'Registro de cada importação de planilha Excel';

-- =============================================================================
-- TABELA: saidas_itens
-- Tabela fato principal: cada linha = uma saída de um tipo de item em um período
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.saidas_itens (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competencia        DATE NOT NULL,
  periodo_texto      TEXT,
  almoxarifado_id    UUID REFERENCES public.almoxarifados(id) ON DELETE RESTRICT,
  setor_id           UUID NOT NULL REFERENCES public.setores(id) ON DELETE RESTRICT,
  item_id            UUID NOT NULL REFERENCES public.itens(id) ON DELETE RESTRICT,
  tipo               TEXT NOT NULL CHECK (tipo IN ('NOVO', 'SEMINOVO')),
  quantidade         INTEGER NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  observacao         TEXT,
  origem             TEXT NOT NULL DEFAULT 'MANUAL'
                      CHECK (origem IN ('MANUAL', 'IMPORTACAO')),
  lote_importacao_id UUID REFERENCES public.lotes_importacao(id) ON DELETE SET NULL,
  created_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance nas queries do dashboard
CREATE INDEX IF NOT EXISTS idx_saidas_competencia      ON public.saidas_itens(competencia);
CREATE INDEX IF NOT EXISTS idx_saidas_setor            ON public.saidas_itens(setor_id);
CREATE INDEX IF NOT EXISTS idx_saidas_item             ON public.saidas_itens(item_id);
CREATE INDEX IF NOT EXISTS idx_saidas_almoxarifado     ON public.saidas_itens(almoxarifado_id);
CREATE INDEX IF NOT EXISTS idx_saidas_tipo             ON public.saidas_itens(tipo);
CREATE INDEX IF NOT EXISTS idx_saidas_lote             ON public.saidas_itens(lote_importacao_id);
CREATE INDEX IF NOT EXISTS idx_saidas_competencia_tipo ON public.saidas_itens(competencia, tipo);

-- Prevenção de duplicidade: mesma competência + almoxarifado + setor + item + tipo + lote
CREATE UNIQUE INDEX IF NOT EXISTS idx_saidas_unique
  ON public.saidas_itens(
    competencia,
    COALESCE(almoxarifado_id, '00000000-0000-0000-0000-000000000000'),
    setor_id,
    item_id,
    tipo,
    COALESCE(lote_importacao_id, '00000000-0000-0000-0000-000000000000')
  );

CREATE TRIGGER trg_saidas_updated_at
  BEFORE UPDATE ON public.saidas_itens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.saidas_itens IS 'Tabela fato: saídas de itens novos e seminovos por competência';
COMMENT ON COLUMN public.saidas_itens.tipo IS 'NOVO | SEMINOVO';
COMMENT ON COLUMN public.saidas_itens.origem IS 'MANUAL (lançamento) | IMPORTACAO (planilha Excel)';

-- =============================================================================
-- TABELA: auditoria
-- Log de ações importantes no sistema
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.auditoria (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  acao              TEXT NOT NULL,
  tabela_afetada    TEXT,
  registro_id       UUID,
  dados_anteriores  JSONB,
  dados_novos       JSONB,
  ip_address        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_usuario  ON public.auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_tabela   ON public.auditoria(tabela_afetada);
CREATE INDEX IF NOT EXISTS idx_auditoria_created  ON public.auditoria(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_registro ON public.auditoria(registro_id);

COMMENT ON TABLE public.auditoria IS 'Log de auditoria de ações no sistema';

-- =============================================================================
-- FIM DO SCHEMA
-- Execute o script 02_rls.sql para configurar Row Level Security
-- Execute o script 03_seed.sql para dados iniciais
-- Execute o script 04_functions.sql para funções auxiliares
-- =============================================================================
