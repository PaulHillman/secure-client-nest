ALTER TABLE public.peer_review_assessments ADD COLUMN IF NOT EXISTS source_snapshot jsonb;
ALTER TABLE public.peer_review_assessments DROP CONSTRAINT peer_review_assessments_file_id_fkey;
ALTER TABLE public.peer_review_assessments ADD CONSTRAINT peer_review_assessments_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.files(id) ON DELETE SET NULL;
ALTER TABLE public.peer_review_assessments DROP CONSTRAINT peer_review_assessments_version_id_fkey;
ALTER TABLE public.peer_review_assessments ADD CONSTRAINT peer_review_assessments_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.file_versions(id) ON DELETE SET NULL;
CREATE OR REPLACE FUNCTION public.delete_vault_file(_file_id uuid)
RETURNS text[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE target public.files; paths text[]; source jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO target FROM public.files WHERE id = _file_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'File not found or already deleted'; END IF;
  IF NOT (public.has_role(auth.uid(), 'admin') OR (target.team_id IS NOT NULL AND NOT target.is_locked AND public.is_team_member(target.team_id, auth.uid()))) THEN
    RAISE EXCEPTION 'You cannot delete this file';
  END IF;
  SELECT coalesce(array_agg(storage_path), '{}'), jsonb_build_object('file', to_jsonb(target), 'versions', coalesce(jsonb_agg(to_jsonb(v)), '[]'::jsonb)) INTO paths, source FROM public.file_versions v WHERE v.file_id = _file_id;
  UPDATE public.peer_review_assessments SET source_snapshot = source, status = 'source_deleted' WHERE file_id = _file_id;
  DELETE FROM public.files WHERE id = _file_id;
  RETURN paths;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_vault_file(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_vault_file(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_vault_file(uuid) TO service_role;