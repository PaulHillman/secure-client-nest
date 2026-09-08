import { StudentAvatar } from "@/components/student-avatar";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Eye, X } from "lucide-react";
import { toast } from "sonner";

export function ViewAsStudentPicker() {
  const { realIsAdmin, viewAs, setViewAs } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["view-as-students"],
    enabled: realIsAdmin && open,
    queryFn: async () => {
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      const adminIds = new Set((adminRoles ?? []).map((r) => r.user_id));
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, first_name, last_name, email, section, avatar_url")
        .order("last_name", { ascending: true });
      if (error) throw error;
      return (data ?? []).filter((p) => !adminIds.has(p.id));
    },
  });

  if (!realIsAdmin) return null;

  const term = q.trim().toLowerCase();
  const shown = students
    .filter((s) => {
      if (!term) return true;
      const full = `${s.first_name ?? ""} ${s.last_name ?? ""} ${s.name ?? ""} ${s.email ?? ""} ${s.section ?? ""}`;
      return full.toLowerCase().includes(term);
    })
    .slice(0, 60);

  const pick = (s: any) => {
    const name =
      s.first_name && s.last_name ? `${s.first_name} ${s.last_name}` : s.name || s.email || "Student";
    setViewAs({ id: s.id, name, email: s.email ?? null });
    qc.invalidateQueries();
    setOpen(false);
    setQ("");
    toast.success(`Now viewing as ${name}`);
  };

  const stop = () => {
    setViewAs(null);
    qc.invalidateQueries();
    toast.success("Back to your admin view");
  };

  if (viewAs) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={stop}
        className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      >
        <X className="h-4 w-4 mr-2" />
        Stop viewing as student
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <Eye className="h-4 w-4 mr-2" />
          View as Student
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-72 p-2">
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email, section…"
          className="h-8"
        />
        <div className="mt-2 max-h-64 overflow-auto">
          {isLoading ? (
            <p className="p-2 text-sm text-muted-foreground">Loading students…</p>
          ) : shown.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">No matching students.</p>
          ) : (
            shown.map((s) => (
              <button
                key={s.id}
                onClick={() => pick(s)}
                className="w-full text-left rounded px-2 py-1.5 text-sm hover:bg-accent"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <StudentAvatar name={s.name} email={s.email} avatarUrl={s.avatar_url} size={26} />
                  <div className="min-w-0">
                    <div className="truncate">
                      {s.first_name && s.last_name ? `${s.first_name} ${s.last_name}` : s.name || s.email}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {s.email}
                      {s.section ? ` · Section ${s.section}` : ""}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ViewAsBanner() {
  const { viewAs, setViewAs } = useAuth();
  const qc = useQueryClient();
  if (!viewAs) return null;
  return (
    <div className="flex items-center justify-between gap-3 bg-gold/15 border-b border-gold/40 px-4 py-2 text-sm">
      <span className="truncate">
        Viewing the system as <strong>{viewAs.name}</strong>
      </span>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setViewAs(null);
          qc.invalidateQueries();
        }}
      >
        Exit
      </Button>
    </div>
  );
}
