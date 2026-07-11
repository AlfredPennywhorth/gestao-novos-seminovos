# Security Hardening Report

## Scope

Security and publication-readiness review of the React/Vite/Supabase application.

## Implemented

- Prevented users from updating their own role or active status.
- Removed trust in user-controlled metadata when creating profiles.
- New accounts now start as inactive `VISUALIZADOR` accounts and require administrator approval.
- Authorization helpers now require an active profile.
- Restricted dashboard and cost RPC execution to authenticated users.
- Hardened `SECURITY DEFINER` functions with a controlled `search_path`.
- Reworked audit registration so the user identity comes from `auth.uid()`.
- Added server-side ownership enforcement for movement records.
- Added missing import-lot lifecycle columns.
- Updated frontend route protection to reject inactive or unavailable profiles.
- Corrected import schema mappings and duplicate detection.
- Added file and row limits plus finite/integer quantity validation.
- Added a security-focused SQL verification script.

## Deployment order

1. Back up the Supabase database.
2. Test in a staging Supabase project.
3. Run existing migrations 01 through 04 when provisioning a new environment.
4. Run `sql/05_security_hardening.sql`.
5. Run `sql/06_security_verification.sql` as an administrator/test operator.
6. Deploy the frontend only after the database migration succeeds.
7. Activate intended users in `public.profiles`.

## Required Supabase settings

- Disable open public sign-up unless self-registration is an explicit requirement.
- Require confirmed email.
- Configure production Site URL and exact redirect allow-list.
- Rotate credentials if any non-anon secret was ever committed or shared.
- Never expose the service-role key in Vite variables.
- Enable database backups and Point-in-Time Recovery if the plan supports it.

## Required repository settings

- Protect `main`.
- Require pull requests and successful CI.
- Enable Dependabot alerts and secret scanning.
- Add CI for typecheck, lint, build, tests, and migration verification.
- Keep production environment variables in the hosting provider, not the repository.

## Remaining work before production

- Move the complete import workflow into one transactional database RPC or trusted backend.
- Make undo-import transactional.
- Add automated RLS tests for anonymous, inactive, viewer, operator, and admin identities.
- Add unit tests for Excel parsing and date normalization.
- Add end-to-end tests for authentication, permissions, import, and undo.
- Run `npm audit` and review the SheetJS dependency before accepting untrusted workbooks.
- Add rate limiting or bot protection to authentication.
- Define whether operators are global or restricted by warehouse.
- Replace fallback financial costs with an explicit approval/quality state.
- Add monitoring, structured error reporting, retention policy, and incident procedures.

## Release decision

Do not publish to production until the migration has been tested in staging and the RLS verification matrix passes. The transactionality of import/undo remains the most important integrity improvement after this security patch.
