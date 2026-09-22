import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, Send } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Send } from "lucide-react";
import { toast } from "sonner";
import { listIncompleteProfiles, sendProfileReminders } from "@/lib/profile-reminders.functions";
import { StudentName } from "@/components/student-avatar";

export function ProfileCompletionAdminCard() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["incomplete-profiles"],
    queryFn: () => listIncompleteProfiles(),
  });

  const remind = useMutation({
    mutationFn: () => sendProfileReminders(),
    onSuccess: (r) => {
      toast.success(
        `${r.reminded} reminder${r.reminded === 1 ? "" : "s"} sent (${r.skipped} already reminded today).`,
      );
      qc.invalidateQueries({ queryKey: ["incomplete-profiles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data ?? [];

  if (!isLoading && rows.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 text-primary" />
        <span>
          Profiles — everyone has finished.{" "}
          <span className="text-xs">Reminders will reappear here if anyone falls behind.</span>
        </span>
      </div>
    );
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 font-display text-xl">
            <ClipboardList className="h-5 w-5 text-gold" /> Profiles not finished
          </CardTitle>
          <CardDescription>
            Students missing their 8 skills, 5 learning goals, or weekly availability. They are
            reminded automatically once every 24 hours.
          </CardDescription>
        </div>
        <Button size="sm" disabled={remind.isPending} onClick={() => remind.mutate()}>
          <Send className="mr-1 h-3.5 w-3.5" />
          {remind.isPending ? "Sending…" : "Remind now"}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map((r) => (
              <li key={r.userId} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <StudentName
                  name={r.name}
                  email={r.email}
                  avatarUrl={(r as any).avatarUrl}
                  className="min-w-40 font-medium"
                />
                <span className="text-xs text-muted-foreground">{r.email}</span>
                <span className="ml-auto flex flex-wrap gap-1">
                  {r.missing.map((m) => (
                    <Badge key={m} variant="outline" className="text-[10px]">
                      {m}
                    </Badge>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
