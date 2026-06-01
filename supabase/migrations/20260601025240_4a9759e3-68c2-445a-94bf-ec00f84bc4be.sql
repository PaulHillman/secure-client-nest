
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'student');
CREATE TYPE public.team_job AS ENUM ('PM', 'Communication Specialist', 'Video Specialist', 'Company Liaison', 'Researcher');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT,
  section TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- Teams
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  section TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_title team_job NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- helper
CREATE OR REPLACE FUNCTION public.is_team_member(_team_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_members WHERE team_id = _team_id AND user_id = _user_id);
$$;

-- Company focus
CREATE TABLE public.company_focus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL UNIQUE REFERENCES public.teams(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_person TEXT NOT NULL DEFAULT '',
  contact_job_title TEXT NOT NULL DEFAULT '',
  website TEXT,
  email TEXT NOT NULL DEFAULT '',
  hq_address TEXT,
  industry TEXT NOT NULL DEFAULT '',
  employee_count TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_focus TO authenticated;
GRANT ALL ON public.company_focus TO service_role;
ALTER TABLE public.company_focus ENABLE ROW LEVEL SECURITY;

-- Group norms
CREATE TABLE public.group_norms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL UNIQUE REFERENCES public.teams(id) ON DELETE CASCADE,
  document_path TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_locked BOOLEAN NOT NULL DEFAULT false,
  locked_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_norms TO authenticated;
GRANT ALL ON public.group_norms TO service_role;
ALTER TABLE public.group_norms ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.group_norms_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_norms_id UUID NOT NULL REFERENCES public.group_norms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_norms_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.group_norms_signatures TO authenticated;
GRANT ALL ON public.group_norms_signatures TO service_role;
ALTER TABLE public.group_norms_signatures ENABLE ROW LEVEL SECURITY;

-- Files
CREATE TABLE public.files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'Other',
  current_version_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.files TO authenticated;
GRANT ALL ON public.files TO service_role;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.file_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);
GRANT SELECT, INSERT, DELETE ON public.file_versions TO authenticated;
GRANT ALL ON public.file_versions TO service_role;
ALTER TABLE public.file_versions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.file_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(file_id, tag)
);
GRANT SELECT, INSERT, DELETE ON public.file_tags TO authenticated;
GRANT ALL ON public.file_tags TO service_role;
ALTER TABLE public.file_tags ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES

-- Profiles: anyone signed in can read; users update own; admins update any
CREATE POLICY "profiles select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Roles: read all (so UI can show badges); only admins write (via service role typically)
CREATE POLICY "roles select" ON public.user_roles FOR SELECT TO authenticated USING (true);

-- Teams: read all; admins write
CREATE POLICY "teams select" ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "teams admin write" ON public.teams FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Team members: read all; admins write
CREATE POLICY "team_members select" ON public.team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "team_members admin write" ON public.team_members FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Company focus: read all; team members + admins write
CREATE POLICY "company_focus select" ON public.company_focus FOR SELECT TO authenticated USING (true);
CREATE POLICY "company_focus write" ON public.company_focus FOR ALL TO authenticated
  USING (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- Group norms: read all; team members + admins write
CREATE POLICY "group_norms select" ON public.group_norms FOR SELECT TO authenticated USING (true);
CREATE POLICY "group_norms write" ON public.group_norms FOR ALL TO authenticated
  USING (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- Signatures: read all; users sign themselves (when team member); admins manage
CREATE POLICY "signatures select" ON public.group_norms_signatures FOR SELECT TO authenticated USING (true);
CREATE POLICY "signatures insert self" ON public.group_norms_signatures FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.group_norms gn WHERE gn.id = group_norms_id AND public.is_team_member(gn.team_id, auth.uid())));
CREATE POLICY "signatures delete admin" ON public.group_norms_signatures FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Files
CREATE POLICY "files select" ON public.files FOR SELECT TO authenticated USING (true);
CREATE POLICY "files write" ON public.files FOR ALL TO authenticated
  USING (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "file_versions select" ON public.file_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "file_versions write" ON public.file_versions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.files f WHERE f.id = file_id AND (public.is_team_member(f.team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.files f WHERE f.id = file_id AND (public.is_team_member(f.team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))));

CREATE POLICY "file_tags select" ON public.file_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "file_tags write" ON public.file_tags FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.files f WHERE f.id = file_id AND (public.is_team_member(f.team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.files f WHERE f.id = file_id AND (public.is_team_member(f.team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''), NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER set_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_teams_updated BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_company_focus_updated BEFORE UPDATE ON public.company_focus FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_files_updated BEFORE UPDATE ON public.files FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('vault', 'vault', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (path convention: avatars/<uid>/..., teams/<team_id>/...)
CREATE POLICY "vault read auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'vault');

CREATE POLICY "vault avatar upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vault' AND (storage.foldername(name))[1] = 'avatars' AND (storage.foldername(name))[2] = auth.uid()::text);

CREATE POLICY "vault avatar update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'vault' AND (storage.foldername(name))[1] = 'avatars' AND (storage.foldername(name))[2] = auth.uid()::text);

CREATE POLICY "vault avatar delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vault' AND (storage.foldername(name))[1] = 'avatars' AND (storage.foldername(name))[2] = auth.uid()::text);

CREATE POLICY "vault team upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'vault'
    AND (storage.foldername(name))[1] = 'teams'
    AND (
      public.is_team_member(((storage.foldername(name))[2])::uuid, auth.uid())
      OR public.has_role(auth.uid(), 'admin')
    )
  );

CREATE POLICY "vault team update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'vault'
    AND (storage.foldername(name))[1] = 'teams'
    AND (
      public.is_team_member(((storage.foldername(name))[2])::uuid, auth.uid())
      OR public.has_role(auth.uid(), 'admin')
    )
  );

CREATE POLICY "vault team delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'vault'
    AND (storage.foldername(name))[1] = 'teams'
    AND (
      public.is_team_member(((storage.foldername(name))[2])::uuid, auth.uid())
      OR public.has_role(auth.uid(), 'admin')
    )
  );
