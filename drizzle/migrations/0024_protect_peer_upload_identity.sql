CREATE FUNCTION public.protect_peer_upload_identity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR public.has_role(auth.uid(),'admin') THEN RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END; END IF;
 IF TG_OP='DELETE' THEN
  IF OLD.subsection='Mid-Semester Peer Reviews' THEN RAISE EXCEPTION 'Previous peer-review submissions are retained. Ask your instructor to remove a broken upload.'; END IF;
  RETURN OLD;
 END IF;
 IF EXISTS(SELECT 1 FROM public.file_versions WHERE file_id=OLD.id) THEN
  IF OLD.subsection='Mid-Semester Peer Reviews' AND (NEW.assigned_to IS DISTINCT FROM OLD.assigned_to OR NEW.subsection IS DISTINCT FROM OLD.subsection OR NEW.team_id IS DISTINCT FROM OLD.team_id OR NEW.is_template IS DISTINCT FROM OLD.is_template) THEN RAISE EXCEPTION 'Peer-review identity and folder cannot be changed after upload. Ask your instructor.'; END IF;
  IF OLD.subsection<>'Mid-Semester Peer Reviews' AND NEW.subsection='Mid-Semester Peer Reviews' THEN RAISE EXCEPTION 'Upload this document directly into Peer Reviews so its permission can be checked.'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_peer_upload_identity BEFORE UPDATE OR DELETE ON public.files FOR EACH ROW EXECUTE FUNCTION public.protect_peer_upload_identity();
REVOKE ALL ON FUNCTION public.protect_peer_upload_identity() FROM PUBLIC;
