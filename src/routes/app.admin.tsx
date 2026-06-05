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
import { Trash2, Plus, UserCog } from "lucide-react";

export const Route = createFileRoute("/app/admin")({
  head: () => ({ meta: [{ title: "Admin — ClientVault" }] }),
  component: Admin,
});

const TEAM_JOBS = [
  "PM",
  "Communication Specialist",
  "Video Specialist",
  "Company Liaison",
  "Researcher",
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
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-6">
          <UsersPanel />
        </TabsContent>
        <TabsContent value="teams" className="mt-6">
          <TeamsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Users ---------------- */

function UsersPanel() {
  const qc = useQueryClient();
  const { data: users } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, name, email, section")
        .order("name");
      if (error) throw error;
      const { data: roles, error: rErr } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (rErr) throw rErr;
      const roleMap = new Map<string, string[]>();
      roles?.forEach((r) => {
        const arr = roleMap.get(r.user_id) ?? [];
        arr.push(r.role);
        roleMap.set(r.user_id, arr);
      });
      return profiles!.map((p) => ({ ...p, roles: roleMap.get(p.id) ?? [] }));
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
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAdmin = useMutation({
    mutationFn: async (vars: { userId: string; makeAdmin: boolean }) => {
      if (vars.makeAdmin) {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: vars.userId, role: "admin" });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", vars.userId)
          .eq("role", "admin");
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-xl flex items-center gap-2">
          <UserCog className="h-5 w-5 text-gold" /> Users ({users?.length ?? 0})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Section</th>
                <th className="py-2 pr-3">Roles</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  onSave={(name, section) =>
                    updateProfile.mutate({ id: u.id, name, section })
                  }
                  onToggleAdmin={(makeAdmin) =>
                    toggleAdmin.mutate({ userId: u.id, makeAdmin })
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

function UserRow({
  user,
  onSave,
  onToggleAdmin,
}: {
  user: { id: string; name: string; email: string | null; section: string | null; roles: string[] };
  onSave: (name: string, section: string | null) => void;
  onToggleAdmin: (makeAdmin: boolean) => void;
}) {
  const [name, setName] = useState(user.name);
  const [section, setSection] = useState(user.section ?? "");
  const isAdmin = user.roles.includes("admin");
  const dirty = name !== user.name || (section || null) !== (user.section || null);

  return (
    <tr className="border-b last:border-0 align-middle">
      <td className="py-2 pr-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8" />
      </td>
      <td className="py-2 pr-3 text-muted-foreground">{user.email}</td>
      <td className="py-2 pr-3">
        <Input
          value={section}
          onChange={(e) => setSection(e.target.value)}
          placeholder="—"
          className="h-8 w-20"
        />
      </td>
      <td className="py-2 pr-3">
        {isAdmin ? (
          <Badge className="bg-gold text-black">admin</Badge>
        ) : (
          <Badge variant="secondary">student</Badge>
        )}
      </td>
      <td className="py-2 text-right">
        <div className="flex justify-end gap-2">
          {dirty && (
            <Button size="sm" variant="outline" onClick={() => onSave(name, section || null)}>
              Save
            </Button>
          )}
          <Button
            size="sm"
            variant={isAdmin ? "ghost" : "secondary"}
            onClick={() => onToggleAdmin(!isAdmin)}
          >
            {isAdmin ? "Revoke admin" : "Make admin"}
          </Button>
        </div>
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
