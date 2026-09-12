import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Check, Circle } from "lucide-react";
import { MAX_SKILLS_HAVE, MAX_SKILLS_LEARN } from "@/lib/student-skills";
import { completionStatus } from "@/lib/profile-completion";

function Item({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {done ? (
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      ) : (
        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      )}
      <span className={done ? "text-muted-foreground line-through" : ""}>{children}</span>
    </li>
  );
}

export function ProfileCompletionCard() {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["profile-completion", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: profile, error }, { data: avail }] = await Promise.all([
        supabase
          .from("profiles")
          .select("skills_have, skills_learn")
          .eq("id", user!.id)
          .maybeSingle(),
        supabase
          .from("student_availability")
          .select("user_id")
          .eq("user_id", user!.id)
          .maybeSingle(),
      ]);
      if (error) throw error;
      return completionStatus({
        skillsHave: profile?.skills_have,
        skillsLearn: profile?.skills_learn,
        hasAvailability: !!avail,
      });
    },
  });

  if (!user || !data || data.complete) return null;

  return (
    <Card className="border-amber-500/50 bg-amber-50/60 dark:bg-amber-950/10">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-display text-xl">
          <AlertTriangle className="h-5 w-5 text-amber-600" /> Finish setting up your profile
        </CardTitle>
        <CardDescription>
          Complete these three profile items so your team has the information it needs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-2">
          <Item done={data.skillsHaveDone}>
            Choose {MAX_SKILLS_HAVE} skills you already have — {data.skillsHaveCount} of{" "}
            {MAX_SKILLS_HAVE} chosen
          </Item>
          <Item done={data.skillsLearnDone}>
            Choose {MAX_SKILLS_LEARN} skills you want to learn — {data.skillsLearnCount} of{" "}
            {MAX_SKILLS_LEARN} chosen
          </Item>
          <Item done={data.availabilityDone}>
            Block out the times you absolutely cannot meet, then press Save
          </Item>
        </ul>
        <p className="text-xs text-muted-foreground">
          Until all three are done you (and your Project Manager) get a reminder every day.
        </p>
      </CardContent>
    </Card>
  );
}
