import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Briefcase, Plus, Trash2, ExternalLink } from "lucide-react";

type Submission = {
  id: string;
  team_id: string;
  manager_first_name: string;
  manager_last_name: string;
  company_name: string;
  company_website: string;
  industry: string;
  num_employees: number;
  status: string;
  admin_notes: string | null;
  created_at: string;
  submitted_by: string;
};

function statusBadge(status: string) {
  if (status === "approved") return <Badge className="bg-green-600 text-white">approved</Badge>;
  if (status === "rejected") return <Badge variant="destructive">rejected</Badge>;
  return <Badge variant="secondary">pending</Badge>;
}

export function ManagerSubmissions({ teamId }: { teamId: string }) {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();

  const { data: subs, isLoading } = useQuery({
    queryKey: ["manager-submissions", teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manager_submissions")
        .select("*")
        .eq("team_id", teamId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Submission[];
    },
  });

  const create = useMutation({
    mutationFn: async (v: Omit<Submission, "id" | "status" | "admin_notes" | "created_at" | "submitted_by" | "team_id">) => {
      const { error } = await supabase.from("manager_submissions").insert({
        ...v,
        team_id: teamId,
        submitted_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Manager submitted for approval");
      qc.invalidateQueries({ queryKey: ["manager-submissions", teamId] });
      qc.invalidateQueries({ queryKey: ["manager-submissions-all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("manager_submissions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Submission removed");
      qc.invalidateQueries({ queryKey: ["manager-submissions", teamId] });
      qc.invalidateQueries({ queryKey: ["manager-submissions-all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-gold" />
          <h2 className="font-display text-2xl">Manager submissions</h2>
          <span className="text-sm text-muted-foreground">({subs?.length ?? 0})</span>
        </div>
        <SubmitDialog onSubmit={(v) => create.mutate(v)} />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : subs?.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            No managers submitted yet. Submit a potential manager for instructor approval.
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {subs?.map((s) => (
            <Card key={s.id} className="border-border/60">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="font-display text-lg">
                    {s.manager_first_name} {s.manager_last_name}
                  </CardTitle>
                  {statusBadge(s.status)}
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <div className="font-medium">{s.company_name}</div>
                <div className="text-muted-foreground">{s.industry} · {s.num_employees} employees</div>
                <a
                  href={s.company_website.startsWith("http") ? s.company_website : `https://${s.company_website}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-3 w-3" /> {s.company_website}
                </a>
                {s.admin_notes && (
                  <p className="text-xs italic text-muted-foreground pt-1 border-t mt-2">
                    Note: {s.admin_notes}
                  </p>
                )}
                {(s.submitted_by === user?.id || isAdmin) && s.status === "pending" && (
                  <div className="pt-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm("Remove this submission?")) remove.mutate(s.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Remove
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function SubmitDialog({
  onSubmit,
}: {
  onSubmit: (v: {
    manager_first_name: string;
    manager_last_name: string;
    company_name: string;
    company_website: string;
    industry: string;
    num_employees: number;
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [employees, setEmployees] = useState("");

  const valid =
    first.trim() && last.trim() && company.trim() && website.trim() && industry.trim() && Number(employees) > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" /> Submit manager
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Submit a manager for approval</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>First name</Label>
              <Input value={first} onChange={(e) => setFirst(e.target.value)} maxLength={100} />
            </div>
            <div>
              <Label>Last name</Label>
              <Input value={last} onChange={(e) => setLast(e.target.value)} maxLength={100} />
            </div>
          </div>
          <div>
            <Label>Company name</Label>
            <Input value={company} onChange={(e) => setCompany(e.target.value)} maxLength={200} />
          </div>
          <div>
            <Label>Company website</Label>
            <Input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
              maxLength={500}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Industry</Label>
              <Input value={industry} onChange={(e) => setIndustry(e.target.value)} maxLength={100} />
            </div>
            <div>
              <Label># of employees</Label>
              <Input
                type="number"
                min={1}
                value={employees}
                onChange={(e) => setEmployees(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={!valid}
            onClick={() => {
              onSubmit({
                manager_first_name: first.trim(),
                manager_last_name: last.trim(),
                company_name: company.trim(),
                company_website: website.trim(),
                industry: industry.trim(),
                num_employees: Number(employees),
              });
              setFirst("");
              setLast("");
              setCompany("");
              setWebsite("");
              setIndustry("");
              setEmployees("");
              setOpen(false);
            }}
          >
            Submit for approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
