import { useEffect, useState } from "react";
import { HeartPulse, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { recordHealthReportView, sessionIdFromToken } from "@/lib/health-report-views";

type Report = { id: string; file_name: string; team_id: string | null; current_version_id: string | null };

/**
 * Student-only banner: shown on up to 2 logins per report, hidden for good once clicked.
 * A "login" = a distinct auth session id.
 */
export function HealthReportBanner() {
  const { user, isAdmin, viewAs } = useAuth();
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    if (!user || isAdmin) return;
    let cancelled = false;
    (async () => {
      const { data: mem } = await supabase.from("team_members").select("team_id").eq("user_id", user.id);
      const teamIds = (mem ?? []).map((m) => m.team_id);
      if (!teamIds.length) return;
      const { data: files } = await supabase
        .from("files").select("id, file_name, team_id, current_version_id")
        .in("team_id", teamIds).eq("section", "Team Documents").eq("subsection", "Health Reports")
        .order("created_at", { ascending: false }).limit(1);
      const f = files?.[0];
      if (!f) return;
      // Admin "View as" preview: show the banner exactly as the student would see it,
      // but never write tracking rows — nothing to reset afterwards.
      if (viewAs) {
        if (!cancelled) setReport(f);
        return;
      }
      const { data: s } = await supabase.auth.getSession();
      const sid = sessionIdFromToken(s.session?.access_token) ?? "unknown";
      const { data: row } = await supabase
        .from("health_report_views").select("*")
        .eq("user_id", user.id).eq("file_id", f.id).maybeSingle();
      const now = new Date().toISOString();
      if (row?.clicked_at) return;
      if (row && row.last_session_id === sid) {
        if (!cancelled) setReport(f);
        return;
      }
      if ((row?.logins_shown ?? 0) >= 2) return;
      if (row) {
        await supabase.from("health_report_views").update({
          logins_shown: row.logins_shown + 1, last_session_id: sid, last_shown_at: now,
        }).eq("id", row.id);
      } else {
        await supabase.from("health_report_views").insert({
          user_id: user.id, file_id: f.id, team_id: f.team_id,
          logins_shown: 1, last_session_id: sid, first_shown_at: now, last_shown_at: now,
        });
      }
      if (!cancelled) setReport(f);
    })();
    return () => { cancelled = true; };
  }, [user, isAdmin]);

  if (!report) return null;

  const open = async () => {
    if (!report.current_version_id) return toast.error("Report not available");
    const { data: v } = await supabase.from("file_versions").select("storage_path").eq("id", report.current_version_id).single();
    if (!v) return toast.error("Report not available");
    const { data: signed } = await supabase.storage.from("vault").createSignedUrl(v.storage_path, 300);
    if (!signed) return toast.error("Could not open report");
    window.open(signed.signedUrl, "_blank");
    if (!viewAs) await recordHealthReportView(report.id, report.team_id, true);
    setReport(null);
  };

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-gold/60 bg-card p-4 text-sm">
      <HeartPulse className="h-5 w-5 text-gold" />
      <div className="flex-1 min-w-[12rem]">
        <strong>Your team's Health Review is in.</strong> See how your team is doing and what needs attention.
      </div>
      <Button size="sm" onClick={open}>View report</Button>
      <button type="button" aria-label="Hide for now" onClick={() => setReport(null)} className="text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
