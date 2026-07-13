-- Security hardening and integrity fixes
-- Run after 04_functions.sql.

BEGIN;

-- Align the schema with the import service while preserving existing data.
ALTER TABLE public.lotes_importacao
  ADD COLUMN IF NOT EXISTS concluido_em timestamptz,
  ADD COLUMN IF NOT EXISTS erro_mensagem text,
  ADD COLUMN IF NOT EXISTS desfeito_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS desfeito_em timestamptz;

-- Authorization helpers always require an active authenticated profile.
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid() AND ativo = true;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$ SELECT COALESCE(public.get_user_role() = 'ADMIN', false); $$;

CREATE OR REPLACE FUNCTION public.is_operador_or_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$ SELECT COALESCE(public.get_user_role() IN ('ADMIN', 'OPERADOR'), false); $$;

CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND ativo = true
  );
$$;

-- New registrations never receive a role from user-controlled metadata.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, role, ativo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    'VISUALIZADOR',
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- A user may read their profile, but only admins may change authorization data.
DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_update_admin ON public.profiles
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS profiles_insert ON public.profiles;
CREATE POLICY profiles_insert_admin ON public.profiles
  FOR INSERT
  WITH CHECK (public.is_admin());

-- Force server ownership fields and protect immutable/privileged fields.
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators may update profiles';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();

CREATE OR REPLACE FUNCTION public.enforce_saida_ownership()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_saida_ownership ON public.saidas_itens;
CREATE TRIGGER trg_enforce_saida_ownership
BEFORE INSERT OR UPDATE ON public.saidas_itens
FOR EACH ROW EXECUTE FUNCTION public.enforce_saida_ownership();

-- Remove the legacy spoofable signature before creating the safe API.
DROP FUNCTION IF EXISTS public.registrar_auditoria(uuid,text,text,uuid,jsonb,jsonb,text);

-- Audit identity is derived from the JWT, never accepted from the browser.
CREATE OR REPLACE FUNCTION public.registrar_auditoria(
  p_acao text,
  p_tabela_afetada text DEFAULT NULL,
  p_registro_id uuid DEFAULT NULL,
  p_dados_anteriores jsonb DEFAULT NULL,
  p_dados_novos jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_authenticated() THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  INSERT INTO public.auditoria (
    usuario_id, acao, tabela_afetada, registro_id,
    dados_anteriores, dados_novos
  )
  VALUES (
    auth.uid(), p_acao, p_tabela_afetada, p_registro_id,
    p_dados_anteriores, p_dados_novos
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_auditoria(text,text,uuid,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_auditoria(text,text,uuid,jsonb,jsonb) TO authenticated;

-- Read-only dashboard/cost RPCs run as the caller so table RLS remains effective.
ALTER FUNCTION public.get_custo_efetivo(date,uuid,uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_dashboard_resumo(date,date,uuid,uuid,uuid,text) SECURITY INVOKER;
ALTER FUNCTION public.get_dashboard_kpis(date,date,uuid,uuid,uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_serie_temporal(date,date,uuid,uuid,uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_itens_sem_custo_especifico(date,date) SECURITY INVOKER;

-- RPCs must not be callable anonymously.
REVOKE ALL ON FUNCTION public.get_custo_efetivo(date,uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_dashboard_resumo(date,date,uuid,uuid,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_dashboard_kpis(date,date,uuid,uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_serie_temporal(date,date,uuid,uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_itens_sem_custo_especifico(date,date) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_custo_efetivo(date,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_resumo(date,date,uuid,uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_kpis(date,date,uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_serie_temporal(date,date,uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_itens_sem_custo_especifico(date,date) TO authenticated;

-- Add explicit authentication checks to privileged dashboard functions.
-- RLS remains the second line of defense for direct table access.
CREATE OR REPLACE FUNCTION public.assert_active_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_authenticated() THEN
    RAISE EXCEPTION 'Active authenticated user required';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.assert_active_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_active_user() TO authenticated;

COMMIT;
