-- Manual verification checklist. Run in a staging database.
-- 1. Anonymous RPC calls must fail.
-- 2. Inactive profiles must not read protected tables.
-- 3. VISUALIZADOR cannot update profiles, insert movements or import lots.
-- 4. OPERADOR can insert movements but cannot change roles.
-- 5. ADMIN can manage profiles.
-- 6. Attempting to set raw_user_meta_data.role during signup must still create
--    an inactive VISUALIZADOR profile.
-- 7. Direct update of one's own role must fail.
-- 8. registrar_auditoria must always store auth.uid() as usuario_id.

SELECT proname, prosecdef, proconfig
FROM pg_proc
JOIN pg_namespace n ON n.oid = pg_proc.pronamespace
WHERE n.nspname = 'public'
  AND proname IN (
    'get_user_role','is_admin','is_operador_or_admin','is_authenticated',
    'registrar_auditoria','get_dashboard_resumo','get_dashboard_kpis',
    'get_serie_temporal','get_itens_sem_custo_especifico'
  )
ORDER BY proname;
