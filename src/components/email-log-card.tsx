import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mail, MailX, MailWarning } from "lucide-react";

type EmailLogRow = {
  id: string;
  template: string;
  recipient: string;
  subject: string;
  body_text: string | null;
  status: string;
  error: string | null;
  created_at: string;
};

const STATUS_STYLE: Record<string, string> = {
  sent: "bg-emerald-100 text-emerald-800 border-emerald-300",
  suppressed: "bg-amber-100 text-amber-800 border-amber-300",
  failed: "bg-red-100 text-red-800 border-red-300",
};

function statusBadge(status: string) {
  const Icon = status === "sent" ? Mail : status === "failed" ? MailX : MailWarning;
  return (
    <Badge variant="outline" className={STATUS_STYLE[status] ?? ""}>
      <Icon className="h-3 w-3 mr-1" /> {status}
    </Badge>
  );
}

export function EmailLogCard() {
  const [openRow, setOpenRow] = useState<EmailLogRow | null>(null);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["email-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_log")
        .select("id, template, recipient, subject, body_text, status, error, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as EmailLogRow[];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" /> Email log
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          A copy of every email the app has sent, most recent first. Click a row to read it.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !rows?.length ? (
          <p className="text-sm text-muted-foreground">No emails have been sent yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-3 font-medium">To</th>
                  <th className="py-2 pr-3 font-medium">Template</th>
                  <th className="py-2 pr-3 font-medium">Subject</th>
                  <th className="py-2 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b last:border-0 cursor-pointer hover:bg-muted/50"
                    onClick={() => setOpenRow(r)}
                  >
                    <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3">{r.recipient}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{r.template}</td>
                    <td className="py-2 pr-3">{r.subject}</td>
                    <td className="py-2">{statusBadge(r.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!openRow} onOpenChange={(open) => !open && setOpenRow(null)}>
        <DialogContent className="max-w-2xl">
          {openRow && (
            <>
              <DialogHeader>
                <DialogTitle>{openRow.subject}</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-muted-foreground">To:</span> {openRow.recipient}
                  {statusBadge(openRow.status)}
                </div>
                <p className="text-muted-foreground">
                  {new Date(openRow.created_at).toLocaleString()} · template “{openRow.template}”
                </p>
                {openRow.error && (
                  <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
                    {openRow.error}
                  </p>
                )}
                <pre className="whitespace-pre-wrap bg-muted rounded-md p-4 text-sm max-h-[50vh] overflow-auto">
                  {openRow.body_text ?? "(no body recorded)"}
                </pre>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
