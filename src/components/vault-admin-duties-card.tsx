import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, CheckCircle2 } from "lucide-react";

export const VAULT_ADMIN_ROLE = "Client Vault & Tech Administrator";

export const VAULT_ADMIN_DUTIES = [
  "Keep all client information current — company address, industry, website, contact names and email addresses.",
  "Monitor vault activity and review every upload: right location, clear label, visible to the whole team.",
  "Make sure agendas, meeting minutes, B-roll, research and org charts are all uploaded.",
  "Know the rubric and help the PM keep material in the vault on the milestone schedule.",
  "Collect and enter phone numbers for every team member.",
  "Follow up with teammates who have not signed in or are not using the vault.",
  "Answer questions about vault usage and provide technical support to the team.",
];

export function VaultAdminDutiesCard({ holder }: { holder?: string | null }) {
  return (
    <Card className="border-border/60 mt-6">
      <CardHeader>
        <CardTitle className="font-display text-xl flex flex-wrap items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-gold" />
          {VAULT_ADMIN_ROLE}
          {holder ? (
            <Badge variant="secondary">{holder}</Badge>
          ) : (
            <Badge variant="outline">Not assigned</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {VAULT_ADMIN_DUTIES.map((d) => (
            <li key={d} className="flex gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-gold" />
              <span>{d}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          Weekly summaries of vault uploads and inactive teammates go to this person.
        </p>
      </CardContent>
    </Card>
  );
}
