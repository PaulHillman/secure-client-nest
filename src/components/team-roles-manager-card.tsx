import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { assignMemberRole } from "@/lib/team-role.functions";
import { selectableRoles } from "@/lib/team-roles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StudentName } from "@/components/student-avatar";
import { ShieldCheck } from "lucide-react";

const UNASSIGNED = "Unassigned";

type Member = {
  user_id: string;
  job_title: string | null;
  profiles?: { name?: string | null; avatar_url?: string | null } | undefined;
};

export function TeamRolesManagerCard({
  teamId,
  members,
}: {
  teamId: string;
  members: Member[];
}) {
  const qc = useQueryClient();
  const assign = useServerFn(assignMemberRole);

  const mutation = useMutation({
    mutationFn: (v: { userId: string; role: string }) =>
      assign({ data: { teamId, userId: v.userId, role: v.role } }),
    onSuccess: (res) => {
      toast.success(
        res.displaced
          ? `Role updated. ${res.displaced} no longer has that role and needs a new one.`
          : "Role updated.",
      );
      void qc.invalidateQueries({ queryKey: ["team", teamId] });
      void qc.invalidateQueries({ queryKey: ["role-options"] });
      void qc.invalidateQueries({ queryKey: ["team-readiness", teamId] });
      void qc.invalidateQueries({ queryKey: ["readiness-board"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roles = selectableRoles(members.length);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-display text-xl">
          <ShieldCheck className="h-5 w-5" /> Assign roles
        </CardTitle>
        <CardDescription>
          Set the job each person holds. Only one person can hold each job — giving a job to
          someone else leaves the previous holder without a role.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {members.map((m) => (
          <div
            key={m.user_id}
            className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <StudentName
              name={m.profiles?.name ?? "Unlinked team member"}
              avatarUrl={m.profiles?.avatar_url ?? undefined}
              size={28}
            />
            <Select
              value={m.job_title ?? UNASSIGNED}
              disabled={mutation.isPending}
              onValueChange={(v) => mutation.mutate({ userId: m.user_id, role: v })}
            >
              <SelectTrigger className="h-9 w-full text-sm sm:w-[280px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>No role yet</SelectItem>
                {roles.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
