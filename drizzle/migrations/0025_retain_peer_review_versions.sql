CREATE FUNCTION public.protect_peer_versions() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR public.has_role(auth.uid(),'admin') THEN RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END; END IF;
 IF EXISTS (SELECT 1 FROM public.files WHERE id=OLD.file_id AND subsection='Mid-Semester Peer Reviews') THEN RAISE EXCEPTION 'Peer-review versions are immutable. Upload a new submission instead.'; END IF;
 IF TG_OP='UPDATE' AND EXISTS (SELECT 1 FROM public.files WHERE id=NEW.file_id AND subsection='Mid-Semester Peer Reviews') THEN RAISE EXCEPTION 'Upload directly into Peer Reviews so its permission can be checked.'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER protect_peer_versions BEFORE UPDATE OR DELETE ON public.file_versions FOR EACH ROW EXECUTE FUNCTION public.protect_peer_versions();
REVOKE ALL ON FUNCTION public.protect_peer_versions() FROM PUBLIC;
