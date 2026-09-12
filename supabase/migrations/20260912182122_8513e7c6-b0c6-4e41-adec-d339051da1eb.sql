DROP POLICY IF EXISTS "group_norms write" ON public.group_norms;
DROP POLICY IF EXISTS "signatures insert self current version" ON public.group_norms_signatures;
REVOKE INSERT, UPDATE, DELETE ON public.group_norms FROM authenticated;
REVOKE INSERT, UPDATE ON public.group_norms_signatures FROM authenticated;