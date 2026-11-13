CREATE TABLE public.template_distribution_checks (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, checked_at timestamptz NOT NULL DEFAULT now(), payload jsonb NOT NULL);
GRANT SELECT ON public.template_distribution_checks TO authenticated;
GRANT ALL ON public.template_distribution_checks TO service_role;
ALTER TABLE public.template_distribution_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Instructor reads distribution checks" ON public.template_distribution_checks FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE FUNCTION public.template_distribution_status() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
WITH class_teams AS (SELECT id,coalesce(display_name,name) AS name,section FROM public.teams WHERE NOT is_test), templates AS (SELECT * FROM public.files WHERE is_template AND team_id IS NULL), states AS (
SELECT s.id AS template_id,t.id,t.name,t.section,
CASE WHEN NOT EXISTS(SELECT 1 FROM public.files f WHERE f.team_id=t.id AND f.template_source_id=s.id AND NOT f.is_template) THEN 'Not pushed'
WHEN EXISTS(SELECT 1 FROM public.files f JOIN public.file_versions v ON v.id=f.current_version_id AND v.file_id=f.id JOIN public.file_versions sv ON sv.id=s.current_version_id AND sv.file_id=s.id JOIN storage.objects o ON o.bucket_id='vault' AND o.name=v.storage_path JOIN storage.objects so ON so.bucket_id='vault' AND so.name=sv.storage_path WHERE f.team_id=t.id AND f.template_source_id=s.id AND NOT f.is_template AND f.section=s.section AND f.subsection=s.subsection AND f.file_name=s.file_name AND o.metadata->>'eTag' IS NOT NULL AND o.metadata->>'eTag'=so.metadata->>'eTag' AND o.metadata->>'size'=so.metadata->>'size') THEN NULL
ELSE 'Copy missing, outdated, or in a different folder' END AS reason
FROM templates s CROSS JOIN class_teams t), coverage AS (
SELECT s.id, count(st.id) FILTER(WHERE st.reason IS NULL) AS distributed,coalesce(jsonb_agg(jsonb_build_object('id',st.id,'name',st.name,'section',st.section,'reason',st.reason) ORDER BY lower(st.name),st.section) FILTER(WHERE st.reason IS NOT NULL),'[]'::jsonb) AS missing FROM templates s LEFT JOIN states st ON st.template_id=s.id GROUP BY s.id)
SELECT jsonb_build_object('checked_at',now(),'team_count',(SELECT count(*) FROM class_teams),'templates',coalesce((SELECT jsonb_agg(jsonb_build_object('template_id',id,'distributed',distributed,'missing',missing)) FROM coverage),'[]'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.template_distribution_status() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.template_distribution_status() TO service_role;
CREATE FUNCTION public.admin_template_distribution_status() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NOT coalesce(public.has_role(auth.uid(),'admin'),false) THEN RAISE EXCEPTION 'Instructor access required' USING ERRCODE='42501'; END IF; RETURN public.template_distribution_status(); END $$;
REVOKE ALL ON FUNCTION public.admin_template_distribution_status() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_template_distribution_status() TO authenticated,service_role;
CREATE FUNCTION public.check_template_distribution() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ INSERT INTO public.template_distribution_checks(payload) SELECT public.template_distribution_status(); $$;
REVOKE ALL ON FUNCTION public.check_template_distribution() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.check_template_distribution() TO service_role;