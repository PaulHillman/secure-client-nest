import { supabase } from "@/integrations/supabase/client";

/** Records that the signed-in student opened a Health Report file (banner click or vault download). */
export async function recordHealthReportView(fileId: string, teamId: string | null, viaBanner: boolean) {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return;
  const now = new Date().toISOString();
  const { data: row } = await supabase
    .from("health_report_views").select("id, view_count, clicked_at")
    .eq("user_id", uid).eq("file_id", fileId).maybeSingle();
  if (row) {
    await supabase.from("health_report_views").update({
      view_count: (row.view_count ?? 0) + 1,
      last_viewed_at: now,
      clicked_at: row.clicked_at ?? (viaBanner ? now : null),
    }).eq("id", row.id);
  } else {
    await supabase.from("health_report_views").insert({
      user_id: uid, file_id: fileId, team_id: teamId,
      view_count: 1, last_viewed_at: now, clicked_at: viaBanner ? now : null,
    });
  }
}

export function sessionIdFromToken(token?: string | null): string | null {
  if (!token) return null;
  try {
    const p = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return p.session_id ?? null;
  } catch {
    return null;
  }
}
