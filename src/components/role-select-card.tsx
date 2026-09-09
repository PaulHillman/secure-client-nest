import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { claimTeamRole, getRoleOptions } from "@/lib/team-role.functions";
import { SELECTABLE_ROLES } from "@/lib/team-roles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Loader2, UserCheck } from "lucide-react";

export function RoleSelectCard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchOptions = useServerFn(getRoleOptions);
  const claim = useServerFn(claimTeamRole);

  const { data } = useQuery({
    queryKey: ["role-options", user?.id],
    enabled: !!user,
    queryFn: () => fetchOptions(),
  });

  const mutation = useMutation({
    mutationFn: (role: string) => claim({ data: { role } }),
    onSuccess: (res) => {
      toast.success(`You are now the ${res.role}.`);
      void qc.invalidateQueries({ queryKey: ["role-options"] });
      void qc.invalidateQueries({ queryKey: ["my-profile"] });
      void qc.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user || !data || !data.hasTeam) return null;

  const takenBy = new Map(data.taken.map((t) => [t.role, t.name]));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-display text-xl">
          <UserCheck className="h-5 w-5" /> Pick your role
        </CardTitle>
        <CardDescription>
          {data.canSelect
            ? "Choose the job you will hold on your team. Only one person can hold each job."
            : `Locked until you finish your profile — still missing: ${data.missing.join(", ")}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {SELECTABLE_ROLES.map((role) => {
          const mine = data.currentRole === role.value;
          const heldBy = takenBy.get(role.value);
          const disabled = !data.canSelect || !!heldBy || mine || mutation.isPending;
          return (
            <div
              key={role.value}
              className={`flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between ${
                mine ? "border-primary bg-primary/5" : ""
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{role.value}</span>
                  {mine && <Badge>Your role</Badge>}
                  {heldBy && <Badge variant="secondary">Taken by {heldBy}</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{role.blurb}</p>
              </div>
              <Button
                size="sm"
                variant={mine ? "secondary" : "outline"}
                disabled={disabled}
                onClick={() => mutation.mutate(role.value)}
              >
                {mutation.isPending && mutation.variables === role.value ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : !data.canSelect ? (
                  <Lock className="h-4 w-4" />
                ) : mine ? (
                  "Selected"
                ) : heldBy ? (
                  "Unavailable"
                ) : (
                  "Select"
                )}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
