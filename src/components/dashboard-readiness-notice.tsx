import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { getDashboardReadiness } from "@/lib/dashboard-readiness.functions";

export function DashboardReadinessNotice() {
  const { user, isAdmin, viewAs } = useAuth();
  const fetchReadiness = useServerFn(getDashboardReadiness);
  const studentId = viewAs?.id ?? user?.id;

  const { data } = useQuery({
    queryKey: ["dashboard-team-readiness", studentId],
    enabled: !!studentId && (!isAdmin || !!viewAs),
    queryFn: () => fetchReadiness({ data: viewAs ? { studentId: viewAs.id } : {} }),
  });

  if (isAdmin || !data || data.complete) return null;

  return (
    <Card className="mb-8 border-gold/60 bg-gold/10 shadow-sm">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-gold/20 text-foreground">
            <ClipboardCheck className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">
              Team Readiness · {data.doneCount} of 4 complete
            </p>
            <h2 className="font-display text-2xl">Next: {data.nextAction}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{data.detail}</p>
            <p className="mt-2 text-sm font-medium">
              Everyone must complete Team Readiness before the team may meet with Prof Hillman.
            </p>
          </div>
        </div>
        <Button asChild className="shrink-0">
          <Link
            to="/app/teams/$teamId"
            params={{ teamId: data.teamId }}
            hash="team-readiness"
          >
            Continue <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}