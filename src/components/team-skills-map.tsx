import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ROLE_SKILL_MAP, roleMatches, skillLabel } from "@/lib/student-skills";
import { Sparkles, Users } from "lucide-react";

type Member = {
  user_id: string;
  job_title: string | null;
  profiles?: {
    name?: string | null;
    skills_have?: string[] | null;
    skills_learn?: string[] | null;
    top_skills?: string[] | null;
  } | null;
};

export function TeamSkillsMap({ members }: { members: Member[] }) {
  const contributors = new Map<string, string[]>();
  for (const member of members) {
    const name = member.profiles?.name || "A teammate";
    for (const skill of member.profiles?.skills_have ?? []) {
      contributors.set(skill, [...(contributors.get(skill) ?? []), name]);
    }
  }

  const uncoveredRoles = Object.keys(ROLE_SKILL_MAP).filter(
    (role) =>
      !members.some((member) =>
        roleMatches(member.profiles?.skills_have ?? [], member.profiles?.top_skills ?? []).some(
          (match) => match.role === role && match.score >= 2,
        ),
      ),
  );

  return (
    <Card className="mt-6 border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-xl">
          <Sparkles className="h-5 w-5 text-gold" />
          Team skills map
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          A shared view of the strengths and growth goals your teammates chose to share.
        </p>
      </CardHeader>
      <CardContent>
        {contributors.size === 0 ? (
          <div className="rounded-md border border-dashed p-5 text-center text-sm text-muted-foreground">
            Skills will appear here as teammates complete their profiles.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {[...contributors.entries()]
              .sort(([a], [b]) => skillLabel(a).localeCompare(skillLabel(b)))
              .map(([skill, names]) => (
                <div key={skill} className="rounded-md border border-border/60 p-3">
                  <div className="font-medium">{skillLabel(skill)}</div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {names.join(", ")}
                  </div>
                </div>
              ))}
          </div>
        )}
        {uncoveredRoles.length > 0 &&
          members.some((member) => (member.profiles?.skills_have?.length ?? 0) > 0) && (
            <div className="mt-4 rounded-md bg-muted/50 p-3 text-sm">
              <span className="font-medium">Skills to discuss or develop:</span>{" "}
              <span className="text-muted-foreground">No strong match is visible yet for </span>
              {uncoveredRoles.map((role) => (
                <Badge key={role} variant="outline" className="ml-1">
                  {role}
                </Badge>
              ))}
            </div>
          )}
      </CardContent>
    </Card>
  );
}
