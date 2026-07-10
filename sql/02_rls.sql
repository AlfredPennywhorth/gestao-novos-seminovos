-- =============================================================================
-- SISTEMA DE GESTÃO DE SAÍDAS — NOVOS & SEMINOVOS
-- Script 02: Row Level Security (RLS)
-- Execute APÓS o script 01_schema.sql
-- =============================================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.almoxarifados      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setores            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_setor         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custos_mensais_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes_importacao   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saidas_itens       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria          ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- FUNÇÃO AUXILIAR: retorna o role do usuário autenticado
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT get_user_role() = 'ADMIN';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_operador_or_admin()
RETURNS BOOLEAN AS $$
  SELECT get_user_role() IN ('ADMIN', 'OPERADOR');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS BOOLEAN AS $$
  SELECT auth.uid() IS NOT NULL;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================================================
-- POLÍTICAS: profiles
-- =============================================================================

-- Usuário vê apenas o próprio perfil; ADMIN vê todos
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id OR is_admin()
  );

-- Apenas ADMIN pode inserir (o trigger cria automaticamente, mas por segurança)
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (is_admin() OR auth.uid() = id);

-- Usuário edita o próprio; ADMIN edita todos
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (
    auth.uid() = id OR is_admin()
  );

-- Apenas ADMIN pode deletar
CREATE POLICY "profiles_delete" ON public.profiles
  FOR DELETE USING (is_admin());

-- =============================================================================
-- POLÍTICAS: almoxarifados
-- =============================================================================
CREATE POLICY "almoxarifados_select" ON public.almoxarifados
  FOR SELECT USING (is_authenticated());

CREATE POLICY "almoxarifados_insert" ON public.almoxarifados
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "almoxarifados_update" ON public.almoxarifados
  FOR UPDATE USING (is_admin());

CREATE POLICY "almoxarifados_delete" ON public.almoxarifados
  FOR DELETE USING (is_admin());

-- =============================================================================
-- POLÍTICAS: setores
-- =============================================================================
CREATE POLICY "setores_select" ON public.setores
  FOR SELECT USING (is_authenticated());

CREATE POLICY "setores_insert" ON public.setores
  FOR INSERT WITH CHECK (is_operador_or_admin());

CREATE POLICY "setores_update" ON public.setores
  FOR UPDATE USING (is_admin());

CREATE POLICY "setores_delete" ON public.setores
  FOR DELETE USING (is_admin());

-- =============================================================================
-- POLÍTICAS: itens
-- =============================================================================
CREATE POLICY "itens_select" ON public.itens
  FOR SELECT USING (is_authenticated());

CREATE POLICY "itens_insert" ON public.itens
  FOR INSERT WITH CHECK (is_operador_or_admin());

CREATE POLICY "itens_update" ON public.itens
  FOR UPDATE USING (is_admin());

CREATE POLICY "itens_delete" ON public.itens
  FOR DELETE USING (is_admin());

-- =============================================================================
-- POLÍTICAS: item_setor
-- =============================================================================
CREATE POLICY "item_setor_select" ON public.item_setor
  FOR SELECT USING (is_authenticated());

CREATE POLICY "item_setor_insert" ON public.item_setor
  FOR INSERT WITH CHECK (is_operador_or_admin());

CREATE POLICY "item_setor_update" ON public.item_setor
  FOR UPDATE USING (is_admin());

CREATE POLICY "item_setor_delete" ON public.item_setor
  FOR DELETE USING (is_admin());

-- =============================================================================
-- POLÍTICAS: custos_mensais_itens
-- =============================================================================
CREATE POLICY "custos_select" ON public.custos_mensais_itens
  FOR SELECT USING (is_authenticated());

CREATE POLICY "custos_insert" ON public.custos_mensais_itens
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "custos_update" ON public.custos_mensais_itens
  FOR UPDATE USING (is_admin());

CREATE POLICY "custos_delete" ON public.custos_mensais_itens
  FOR DELETE USING (is_admin());

-- =============================================================================
-- POLÍTICAS: lotes_importacao
-- =============================================================================
CREATE POLICY "lotes_select" ON public.lotes_importacao
  FOR SELECT USING (is_authenticated());

CREATE POLICY "lotes_insert" ON public.lotes_importacao
  FOR INSERT WITH CHECK (is_operador_or_admin());

CREATE POLICY "lotes_update" ON public.lotes_importacao
  FOR UPDATE USING (is_operador_or_admin());

-- Apenas ADMIN pode marcar lote como DESFEITO (delete lógico)
CREATE POLICY "lotes_delete" ON public.lotes_importacao
  FOR DELETE USING (is_admin());

-- =============================================================================
-- POLÍTICAS: saidas_itens
-- =============================================================================
CREATE POLICY "saidas_select" ON public.saidas_itens
  FOR SELECT USING (is_authenticated());

CREATE POLICY "saidas_insert" ON public.saidas_itens
  FOR INSERT WITH CHECK (is_operador_or_admin());

CREATE POLICY "saidas_update" ON public.saidas_itens
  FOR UPDATE USING (is_operador_or_admin());

-- Apenas ADMIN pode excluir saídas
CREATE POLICY "saidas_delete" ON public.saidas_itens
  FOR DELETE USING (is_admin());

-- =============================================================================
-- POLÍTICAS: auditoria
-- Apenas ADMIN pode visualizar; inserção é feita via funções internas (SECURITY DEFINER)
-- =============================================================================
CREATE POLICY "auditoria_select" ON public.auditoria
  FOR SELECT USING (is_admin());

-- Nenhum usuário insere diretamente; apenas funções SECURITY DEFINER
CREATE POLICY "auditoria_insert" ON public.auditoria
  FOR INSERT WITH CHECK (FALSE);

-- Auditoria é imutável
CREATE POLICY "auditoria_update" ON public.auditoria
  FOR UPDATE USING (FALSE);

CREATE POLICY "auditoria_delete" ON public.auditoria
  FOR DELETE USING (FALSE);

-- =============================================================================
-- FUNÇÃO DE AUDITORIA (SECURITY DEFINER — ignora RLS)
-- Chamada internamente pelo sistema para registrar ações
-- =============================================================================
CREATE OR REPLACE FUNCTION public.registrar_auditoria(
  p_usuario_id      UUID,
  p_acao            TEXT,
  p_tabela_afetada  TEXT DEFAULT NULL,
  p_registro_id     UUID DEFAULT NULL,
  p_dados_anteriores JSONB DEFAULT NULL,
  p_dados_novos     JSONB DEFAULT NULL,
  p_ip_address      TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.auditoria (
    usuario_id, acao, tabela_afetada, registro_id,
    dados_anteriores, dados_novos, ip_address
  ) VALUES (
    p_usuario_id, p_acao, p_tabela_afetada, p_registro_id,
    p_dados_anteriores, p_dados_novos, p_ip_address
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- FIM DO RLS
-- =============================================================================
