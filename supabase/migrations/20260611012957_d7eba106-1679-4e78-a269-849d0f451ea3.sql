
-- Master archives table
CREATE TABLE public.semester_archives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  team_count INT NOT NULL DEFAULT 0,
  file_count INT NOT NULL DEFAULT 0,
  member_count INT NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.semester_archives TO authenticated;
GRANT ALL ON public.semester_archives TO service_role;
ALTER TABLE public.semester_archives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage archives" ON public.semester_archives FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Shadow tables (mirror live columns; FK to semester_archives)
CREATE TABLE public.archived_teams (
  archive_id UUID NOT NULL REFERENCES public.semester_archives(id) ON DELETE CASCADE,
  id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  section TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  PRIMARY KEY (archive_id, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.archived_teams TO authenticated;
GRANT ALL ON public.archived_teams TO service_role;
ALTER TABLE public.archived_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage archived_teams" ON public.archived_teams FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.archived_team_members (
  archive_id UUID NOT NULL REFERENCES public.semester_archives(id) ON DELETE CASCADE,
  id UUID NOT NULL,
  team_id UUID NOT NULL,
  user_id UUID NOT NULL,
  job_title public.team_job NOT NULL,
  joined_at TIMESTAMPTZ,
  PRIMARY KEY (archive_id, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.archived_team_members TO authenticated;
GRANT ALL ON public.archived_team_members TO service_role;
ALTER TABLE public.archived_team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage archived_team_members" ON public.archived_team_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.archived_files (
  archive_id UUID NOT NULL REFERENCES public.semester_archives(id) ON DELETE CASCADE,
  id UUID NOT NULL,
  team_id UUID,
  file_name TEXT NOT NULL,
  section TEXT NOT NULL,
  subsection TEXT NOT NULL,
  category TEXT,
  description TEXT,
  status public.vault_status,
  assigned_to UUID,
  uploaded_by UUID,
  is_locked BOOLEAN,
  is_template BOOLEAN,
  template_source_id UUID,
  current_version_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  PRIMARY KEY (archive_id, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.archived_files TO authenticated;
GRANT ALL ON public.archived_files TO service_role;
ALTER TABLE public.archived_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage archived_files" ON public.archived_files FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.archived_file_versions (
  archive_id UUID NOT NULL REFERENCES public.semester_archives(id) ON DELETE CASCADE,
  id UUID NOT NULL,
  file_id UUID NOT NULL,
  version_number INT NOT NULL,
  storage_path TEXT NOT NULL,
  archive_storage_path TEXT NOT NULL,
  mime_type TEXT,
  file_size BIGINT,
  uploaded_by UUID,
  uploaded_at TIMESTAMPTZ,
  PRIMARY KEY (archive_id, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.archived_file_versions TO authenticated;
GRANT ALL ON public.archived_file_versions TO service_role;
ALTER TABLE public.archived_file_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage archived_file_versions" ON public.archived_file_versions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.archived_file_tags (
  archive_id UUID NOT NULL REFERENCES public.semester_archives(id) ON DELETE CASCADE,
  id UUID NOT NULL,
  file_id UUID NOT NULL,
  tag TEXT NOT NULL,
  created_at TIMESTAMPTZ,
  PRIMARY KEY (archive_id, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.archived_file_tags TO authenticated;
GRANT ALL ON public.archived_file_tags TO service_role;
ALTER TABLE public.archived_file_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage archived_file_tags" ON public.archived_file_tags FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.archived_file_comments (
  archive_id UUID NOT NULL REFERENCES public.semester_archives(id) ON DELETE CASCADE,
  id UUID NOT NULL,
  file_id UUID NOT NULL,
  team_id UUID NOT NULL,
  author_id UUID NOT NULL,
  body TEXT NOT NULL,
  recipient_ids UUID[],
  to_entire_team BOOLEAN,
  related_status public.vault_status,
  created_at TIMESTAMPTZ,
  PRIMARY KEY (archive_id, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.archived_file_comments TO authenticated;
GRANT ALL ON public.archived_file_comments TO service_role;
ALTER TABLE public.archived_file_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage archived_file_comments" ON public.archived_file_comments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.archived_company_focus (
  archive_id UUID NOT NULL REFERENCES public.semester_archives(id) ON DELETE CASCADE,
  id UUID NOT NULL,
  team_id UUID NOT NULL,
  company_name TEXT,
  contact_person TEXT,
  contact_job_title TEXT,
  email TEXT,
  website TEXT,
  industry TEXT,
  employee_count TEXT,
  hq_address TEXT,
  updated_at TIMESTAMPTZ,
  PRIMARY KEY (archive_id, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.archived_company_focus TO authenticated;
GRANT ALL ON public.archived_company_focus TO service_role;
ALTER TABLE public.archived_company_focus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage archived_company_focus" ON public.archived_company_focus FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.archived_group_norms (
  archive_id UUID NOT NULL REFERENCES public.semester_archives(id) ON DELETE CASCADE,
  id UUID NOT NULL,
  team_id UUID NOT NULL,
  document_path TEXT NOT NULL,
  archive_document_path TEXT NOT NULL,
  is_locked BOOLEAN,
  locked_at TIMESTAMPTZ,
  uploaded_at TIMESTAMPTZ,
  PRIMARY KEY (archive_id, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.archived_group_norms TO authenticated;
GRANT ALL ON public.archived_group_norms TO service_role;
ALTER TABLE public.archived_group_norms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage archived_group_norms" ON public.archived_group_norms FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.archived_group_norms_signatures (
  archive_id UUID NOT NULL REFERENCES public.semester_archives(id) ON DELETE CASCADE,
  id UUID NOT NULL,
  group_norms_id UUID NOT NULL,
  user_id UUID NOT NULL,
  signed_at TIMESTAMPTZ,
  PRIMARY KEY (archive_id, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.archived_group_norms_signatures TO authenticated;
GRANT ALL ON public.archived_group_norms_signatures TO service_role;
ALTER TABLE public.archived_group_norms_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage archived_group_norms_signatures" ON public.archived_group_norms_signatures FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.archived_manager_submissions (
  archive_id UUID NOT NULL REFERENCES public.semester_archives(id) ON DELETE CASCADE,
  id UUID NOT NULL,
  team_id UUID NOT NULL,
  submitted_by UUID NOT NULL,
  manager_first_name TEXT,
  manager_last_name TEXT,
  company_name TEXT,
  company_website TEXT,
  industry TEXT,
  num_employees INT,
  status TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  PRIMARY KEY (archive_id, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.archived_manager_submissions TO authenticated;
GRANT ALL ON public.archived_manager_submissions TO service_role;
ALTER TABLE public.archived_manager_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage archived_manager_submissions" ON public.archived_manager_submissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admin audit log for semester operations
CREATE TABLE public.admin_audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID,
  action TEXT NOT NULL, -- 'archive' | 'reset' | 'promote' | 'delete_archive'
  archive_id UUID,
  archive_name TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.admin_audit_log_id_seq TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
GRANT ALL ON SEQUENCE public.admin_audit_log_id_seq TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read admin_audit_log" ON public.admin_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins write admin_audit_log" ON public.admin_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_admin_audit_log_created_at ON public.admin_audit_log(created_at DESC);
CREATE INDEX idx_archived_files_archive_team ON public.archived_files(archive_id, team_id);
CREATE INDEX idx_archived_file_versions_archive_file ON public.archived_file_versions(archive_id, file_id);
CREATE INDEX idx_archived_team_members_archive_team ON public.archived_team_members(archive_id, team_id);
