import { teamLabel } from "@/lib/team-label";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trash2, Plus, UserCog, Briefcase, Check, X, ExternalLink, FileStack, ArrowUp, ArrowDown, ArrowUpDown, History, Archive, Upload } from "lucide-react";
import { TemplatesPanel } from "@/components/templates-panel";
import { AuditLogPanel } from "@/components/audit-log-panel";
import { SemesterPanel } from "@/components/semester-panel";
import { BulkImportPanel } from "@/components/bulk-import-panel";

export const Route = createFileRoute("/app/admin")({
  head: () => ({ meta: [{ title: "Admin — ClientVault" }] }),
  component: Admin,
});

const TEAM_JOBS = [
  "PM",
  "Communication Specialist",
  "Video Specialist",
  "Company Liaison",
  "Client Vault & Tech Administrator",
  "Unassigned",
] as const;
type TeamJob = (typeof TEAM_JOBS)[number];

function Admin() {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin) return <Navigate to="/app/dashboard" />;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="font-display text-4xl">Admin</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage users, teams, and roster assignments.
        </p>
      </header>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Students</TabsTrigger>
          <TabsTrigger value="import">
            <Upload className="h-3.5 w-3.5 mr-1" /> Import
          </TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="templates">
            <FileStack className="h-3.5 w-3.5 mr-1" /> Templates
          </TabsTrigger>
          <TabsTrigger value="submissions">Client</TabsTrigger>
          <TabsTrigger value="audit">
            <History className="h-3.5 w-3.5 mr-1" /> Audit log
          </TabsTrigger>
          <TabsTrigger value="semester">
            <Archive className="h-3.5 w-3.5 mr-1" /> Semester
          </TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-6">
          <StudentsPanel />
        </TabsContent>
        <TabsContent value="import" className="mt-6">
          <BulkImportPanel />
        </TabsContent>
        <TabsContent value="teams" className="mt-6">
          <TeamsPanel />
        </TabsContent>
        <TabsContent value="templates" className="mt-6">
          <TemplatesPanel />
        </TabsContent>
        <TabsContent value="submissions" className="mt-6">
          <SubmissionsPanel />
        </TabsContent>
        <TabsContent value="audit" className="mt-6">
          <AuditLogPanel />
        </TabsContent>
        <TabsContent value="semester" className="mt-6">
          <SemesterPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Students ---------------- */

function StudentsPanel() {
  const qc = useQueryClient();
  const { data: students } = useQuery({
    queryKey: ["admin", "students"],
    queryFn: async () => {
      const [{ data: profiles, error }, { data: roles, error: rErr }, { data: members, error: mErr }, { data: teams, error: tErr }] = await Promise.all([
        supabase.from("profiles").select("id, name, email, section").order("name"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("team_members").select("user_id, team_id, job_title"),
        supabase.from("teams").select("id, name, section"),
      ]);
      if (error) throw error;
      if (rErr) throw rErr;
      if (mErr) throw mErr;
      if (tErr) throw tErr;

      const adminSet = new Set((roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));
      const teamMap = new Map((teams ?? []).map((t) => [t.id, teamLabel(t)] as const));
      const memberMap = new Map<string, { team_name: string; job_title: string }>();
      (members ?? []).forEach((m) => {
        memberMap.set(m.user_id, {
          team_name: teamMap.get(m.team_id) ?? "—",
          job_title: m.job_title ?? "—",
        });
      });

      return (profiles ?? [])
        .filter((p) => !adminSet.has(p.id))
        .map((p) => ({
          ...p,
          team_name: memberMap.get(p.id)?.team_name ?? null,
          job_title: memberMap.get(p.id)?.job_title ?? null,
        }));
    },
  });

  const updateProfile = useMutation({
    mutationFn: async (vars: { id: string; section: string | null; name: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ section: vars.section, name: vars.name })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Student updated");
      qc.invalidateQueries({ queryKey: ["admin", "students"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<"name" | "email" | "section" | "team" | "role">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const sectionOptions = Array.from(new Set((students ?? []).map((s) => s.section).filter(Boolean))) as string[];
  sectionOptions.sort();
  const teamOptions = Array.from(new Set((students ?? []).map((s) => s.team_name).filter(Boolean))) as string[];
  teamOptions.sort();
  const roleOptions = Array.from(new Set((students ?? []).map((s) => s.job_title).filter(Boolean))) as string[];
  roleOptions.sort();

  const filtered = (students ?? []).filter((s) => {
    if (sectionFilter !== "all" && (s.section ?? "") !== (sectionFilter === "__none__" ? "" : sectionFilter)) return false;
    if (teamFilter !== "all" && (s.team_name ?? "") !== (teamFilter === "__none__" ? "" : teamFilter)) return false;
    if (roleFilter !== "all" && (s.job_title ?? "") !== (roleFilter === "__none__" ? "" : roleFilter)) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const getVal = (s: typeof a) => {
      switch (sortKey) {
        case "name": return (s.name ?? "").toLowerCase();
        case "email": return (s.email ?? "").toLowerCase();
        case "section": return s.section ?? "";
        case "team": return (s.team_name ?? "").toLowerCase();
        case "role": return (s.job_title ?? "").toLowerCase();
      }
    };
    const av = getVal(a), bv = getVal(b);
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const SortIcon = ({ k }: { k: typeof sortKey }) =>
    sortKey !== k ? <ArrowUpDown className="h-3 w-3 inline ml-1 opacity-40" /> :
    sortDir === "asc" ? <ArrowUp className="h-3 w-3 inline ml-1" /> :
    <ArrowDown className="h-3 w-3 inline ml-1" />;

  const filterSelect = (
    value: string,
    setValue: (v: string) => void,
    options: string[],
    label: string,
  ) => (
    <Select value={value} onValueChange={setValue}>
      <SelectTrigger className="h-8 w-[140px]"><SelectValue placeholder={label} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All {label}</SelectItem>
        <SelectItem value="__none__">— none —</SelectItem>
        {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <CardTitle className="font-display text-xl flex items-center gap-2">
            <UserCog className="h-5 w-5 text-gold" /> Students ({sorted.length}{sorted.length !== (students?.length ?? 0) ? ` of ${students?.length}` : ""})
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground">Section</Label>
              {filterSelect(sectionFilter, setSectionFilter, sectionOptions, "sections")}
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground">Team</Label>
              {filterSelect(teamFilter, setTeamFilter, teamOptions, "teams")}
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground">Role</Label>
              {filterSelect(roleFilter, setRoleFilter, roleOptions, "roles")}
            </div>
            {(sectionFilter !== "all" || teamFilter !== "all" || roleFilter !== "all") && (
              <Button size="sm" variant="ghost" onClick={() => { setSectionFilter("all"); setTeamFilter("all"); setRoleFilter("all"); }}>
                Clear
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                <th className="py-2 pr-3 cursor-pointer select-none" onClick={() => toggleSort("name")}>Name<SortIcon k="name" /></th>
                <th className="py-2 pr-3 cursor-pointer select-none" onClick={() => toggleSort("email")}>Email<SortIcon k="email" /></th>
                <th className="py-2 pr-3 cursor-pointer select-none" onClick={() => toggleSort("section")}>Section<SortIcon k="section" /></th>
                <th className="py-2 pr-3 cursor-pointer select-none" onClick={() => toggleSort("team")}>Team<SortIcon k="team" /></th>
                <th className="py-2 pr-3 cursor-pointer select-none" onClick={() => toggleSort("role")}>Role on team<SortIcon k="role" /></th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <StudentRow
                  key={s.id}
                  student={s}
                  onSave={(name, section) =>
                    updateProfile.mutate({ id: s.id, name, section })
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function StudentRow({
  student,
  onSave,
}: {
  student: {
    id: string;
    name: string;
    email: string | null;
    section: string | null;
    team_name: string | null;
    job_title: string | null;
  };
  onSave: (name: string, section: string | null) => void;
}) {
  const [name, setName] = useState(student.name);
  const [section, setSection] = useState(student.section ?? "");
  const dirty = name !== student.name || (section || null) !== (student.section || null);

  return (
    <tr className="border-b last:border-0 align-middle">
      <td className="py-2 pr-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8" />
      </td>
      <td className="py-2 pr-3 text-muted-foreground">{student.email}</td>
      <td className="py-2 pr-3">
        <Input
          value={section}
          onChange={(e) => setSection(e.target.value)}
          placeholder="—"
          className="h-8 w-20"
        />
      </td>
      <td className="py-2 pr-3">
        {student.team_name ? (
          <span className="text-sm">{student.team_name}</span>
        ) : (
          <span className="text-xs text-muted-foreground italic">unassigned</span>
        )}
      </td>
      <td className="py-2 pr-3">
        {student.job_title ? (
          <Badge variant="secondary">{student.job_title}</Badge>
        ) : (
          <span className="text-xs text-muted-foreground italic">—</span>
        )}
      </td>
      <td className="py-2 text-right">
        {dirty && (
          <Button size="sm" variant="outline" onClick={() => onSave(name, section || null)}>
            Save
          </Button>
        )}
      </td>
    </tr>
  );
}


/* ---------------- Teams ---------------- */

function TeamsPanel() {
  const qc = useQueryClient();
  const { data: teams } = useQuery({
    queryKey: ["admin", "teams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, description, section")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const createTeam = useMutation({
    mutationFn: async (vars: { name: string; section: string | null; description: string | null }) => {
      const { error } = await supabase.from("teams").insert(vars);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Team created");
      qc.invalidateQueries({ queryKey: ["admin", "teams"] });
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteTeam = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("teams").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Team deleted");
      qc.invalidateQueries({ queryKey: ["admin", "teams"] });
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <NewTeamDialog onCreate={(v) => createTeam.mutate(v)} />
      </div>

      {teams?.map((t) => (
        <TeamCard key={t.id} team={t} onDelete={() => deleteTeam.mutate(t.id)} />
      ))}
    </div>
  );
}

function NewTeamDialog({
  onCreate,
}: {
  onCreate: (v: { name: string; section: string | null; description: string | null }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [section, setSection] = useState("");
  const [description, setDescription] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" /> New team
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Create team</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Section</Label>
            <Input value={section} onChange={(e) => setSection(e.target.value)} placeholder="e.g. 01" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={!name.trim()}
            onClick={() => {
              onCreate({
                name: name.trim(),
                section: section.trim() || null,
                description: description.trim() || null,
              });
              setName("");
              setSection("");
              setDescription("");
              setOpen(false);
            }}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TeamCard({
  team,
  onDelete,
}: {
  team: { id: string; name: string; description: string | null; section: string | null };
  onDelete: () => void;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(team.name);
  const [section, setSection] = useState(team.section ?? "");
  const [description, setDescription] = useState(team.description ?? "");

  const { data: members } = useQuery({
    queryKey: ["admin", "team-members", team.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id, user_id, job_title")
        .eq("team_id", team.id);
      if (error) throw error;
      const ids = (data ?? []).map((m) => m.user_id);
      let profMap = new Map<string, { name: string; email: string | null }>();
      if (ids.length) {
        const { data: profs, error: pErr } = await supabase
          .from("profiles")
          .select("id, name, email")
          .in("id", ids);
        if (pErr) throw pErr;
        profs?.forEach((p) => profMap.set(p.id, { name: p.name, email: p.email }));
      }
      return (data ?? []).map((m) => ({
        ...m,
        job_title: m.job_title as TeamJob,
        profiles: profMap.get(m.user_id) ?? { name: "", email: null },
      }));
    },
  });

  const { data: allProfiles } = useQuery({
    queryKey: ["admin", "assignable-users", team.section ?? "_none"],
    queryFn: async () => {
      let q = supabase.from("profiles").select("id, name, email, section").order("name");
      if (team.section) q = q.eq("section", team.section);
      else q = q.is("section", null);
      const { data: profs, error } = await q;
      if (error) throw error;

      const ids = (profs ?? []).map((p) => p.id);
      if (!ids.length) return [];

      const [{ data: assigned }, { data: roles }] = await Promise.all([
        supabase.from("team_members").select("user_id").in("user_id", ids),
        supabase.from("user_roles").select("user_id, role").in("user_id", ids),
      ]);
      const assignedSet = new Set((assigned ?? []).map((a) => a.user_id));
      const adminSet = new Set(
        (roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id),
      );
      return (profs ?? []).filter((p) => !assignedSet.has(p.id) && !adminSet.has(p.id));
    },
  });

  const saveTeam = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("teams")
        .update({
          name: name.trim(),
          section: section.trim() || null,
          description: description.trim() || null,
        })
        .eq("id", team.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Team updated");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["admin", "teams"] });
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMember = useMutation({
    mutationFn: async (v: { userId: string; job: TeamJob }) => {
      const { error } = await supabase
        .from("team_members")
        .insert({ team_id: team.id, user_id: v.userId, job_title: v.job });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Member added");
      qc.invalidateQueries({ queryKey: ["admin", "team-members", team.id] });
      qc.invalidateQueries({ queryKey: ["admin", "assignable-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Member removed");
      qc.invalidateQueries({ queryKey: ["admin", "team-members", team.id] });
      qc.invalidateQueries({ queryKey: ["admin", "assignable-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const memberIds = new Set(members?.map((m) => m.user_id));
  const available = allProfiles?.filter((p) => !memberIds.has(p.id)) ?? [];

  const [newUser, setNewUser] = useState<string>("");
  const [newJob, setNewJob] = useState<TeamJob>("PM");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          {editing ? (
            <div className="flex-1 space-y-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
              <div className="flex gap-2">
                <Input
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  placeholder="Section"
                  className="w-24"
                />
              </div>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          ) : (
            <div>
              <CardTitle className="font-display text-xl">
                {team.name}
                {team.section && (
                  <span className="ml-2 text-xs rounded-full bg-secondary px-2 py-0.5">
                    §{team.section}
                  </span>
                )}
              </CardTitle>
              {team.description && (
                <p className="text-sm text-muted-foreground mt-1">{team.description}</p>
              )}
            </div>
          )}
          <div className="flex gap-2 shrink-0">
            {editing ? (
              <>
                <Button size="sm" onClick={() => saveTeam.mutate()}>
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditing(false);
                    setName(team.name);
                    setSection(team.section ?? "");
                    setDescription(team.description ?? "");
                  }}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (confirm(`Delete team "${team.name}"? This removes all members and files.`)) {
                      onDelete();
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-xs uppercase text-muted-foreground mb-2">
          Members ({members?.length ?? 0})
        </div>
        <div className="space-y-1 mb-4">
          {members?.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50"
            >
              <div className="text-sm">
                <span className="font-medium">{m.profiles.name || m.profiles.email}</span>
                <span className="ml-2 text-xs text-muted-foreground">{m.job_title}</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeMember.mutate(m.id)}
                aria-label="Remove member"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {members?.length === 0 && (
            <p className="text-sm text-muted-foreground italic">No members yet.</p>
          )}
        </div>

        <div className="flex gap-2 items-end border-t pt-3">
          <div className="flex-1">
            <Label className="text-xs">Add user</Label>
            <Select value={newUser} onValueChange={setNewUser}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent>
                {available.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name || p.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <Label className="text-xs">Role</Label>
            <Select value={newJob} onValueChange={(v) => setNewJob(v as TeamJob)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEAM_JOBS.map((j) => (
                  <SelectItem key={j} value={j}>
                    {j}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            disabled={!newUser}
            onClick={() => {
              addMember.mutate({ userId: newUser, job: newJob });
              setNewUser("");
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- Submissions ---------------- */

function SubmissionsPanel() {
  const qc = useQueryClient();
  const { data: subs, isLoading } = useQuery({
    queryKey: ["manager-submissions-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manager_submissions")
        .select("*, teams(name, section)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const review = useMutation({
    mutationFn: async (v: { id: string; status: "approved" | "rejected"; notes?: string }) => {
      const { error } = await supabase
        .from("manager_submissions")
        .update({ status: v.status, admin_notes: v.notes ?? null })
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Submission updated");
      qc.invalidateQueries({ queryKey: ["manager-submissions-all"] });
      qc.invalidateQueries({ queryKey: ["manager-submissions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("manager_submissions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["manager-submissions-all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-xl flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-gold" /> Client Manager Submissions ({subs?.length ?? 0})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : subs?.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No submissions yet.</p>
        ) : (
          <div className="space-y-3">
            {subs?.map((s) => (
              <SubmissionRow
                key={s.id}
                sub={s}
                onApprove={(notes) => review.mutate({ id: s.id, status: "approved", notes })}
                onReject={(notes) => review.mutate({ id: s.id, status: "rejected", notes })}
                onDelete={() => remove.mutate(s.id)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SubmissionRow({
  sub,
  onApprove,
  onReject,
  onDelete,
}: {
  sub: any;
  onApprove: (notes?: string) => void;
  onReject: (notes?: string) => void;
  onDelete: () => void;
}) {
  const [notes, setNotes] = useState(sub.admin_notes ?? "");
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div className="font-display text-lg">
            {sub.manager_first_name} {sub.manager_last_name}
          </div>
          <div className="text-sm text-muted-foreground">
            {sub.teams?.name}
            {sub.teams?.section && ` · §${sub.teams.section}`}
          </div>
        </div>
        {sub.status === "approved" ? (
          <Badge className="bg-green-600 text-white">approved</Badge>
        ) : sub.status === "rejected" ? (
          <Badge variant="destructive">rejected</Badge>
        ) : (
          <Badge variant="secondary">pending</Badge>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-2 text-sm mb-3">
        <div>
          <span className="text-muted-foreground">Company:</span> {sub.company_name}
        </div>
        <div>
          <span className="text-muted-foreground">Industry:</span> {sub.industry}
        </div>
        <div>
          <span className="text-muted-foreground">Employees:</span> {sub.num_employees}
        </div>
        <div className="truncate">
          <a
            href={sub.company_website.startsWith("http") ? sub.company_website : `https://${sub.company_website}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 hover:underline"
          >
            <ExternalLink className="h-3 w-3" /> {sub.company_website}
          </a>
        </div>
      </div>
      <Input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        className="h-8 mb-2"
      />
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={() => onReject(notes || undefined)}>
          <X className="h-4 w-4 mr-1" /> Reject
        </Button>
        <Button size="sm" onClick={() => onApprove(notes || undefined)}>
          <Check className="h-4 w-4 mr-1" /> Approve
        </Button>
      </div>
    </div>
  );
}
