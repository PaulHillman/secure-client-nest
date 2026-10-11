import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Issue a 5-minute link for a vault file the signed-in user is allowed to see. */
export const createFileTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { versionId: string }) => {
    if (!i?.versionId) throw new Error("Missing file");
    return i;
  })
  .handler(async ({ data, context }) => {
    // RLS: the caller only sees versions of files they may access.
    const { data: version } = await context.supabase
      .from("file_versions")
      .select("id")
      .eq("id", data.versionId)
      .maybeSingle();
    if (!version) throw new Error("File not found");
    const { signFileTicket } = await import("@/lib/file-ticket.server");
    return { url: `/api/public/file-download?ticket=${encodeURIComponent(await signFileTicket(version.id))}` };
  });
