import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Streams a vault file through the app's own domain so browser ad/privacy
// blockers (which block the storage domain) never see the file URL.
// This route is under /api/public, which bypasses site auth, so the caller
// is verified here: a valid user bearer token is required and all data
// access goes through a user-scoped client (RLS applies).
export const Route = createFileRoute("/api/public/file-download")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const json = (body: unknown, status: number) =>
          new Response(JSON.stringify(body), {
            status,
            headers: { "Content-Type": "application/json" },
          });

        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
        if (!token) return json({ error: "Unauthorized" }, 401);

        const url = new URL(request.url);
        const versionId = url.searchParams.get("version");
        if (!versionId) return json({ error: "Missing version" }, 400);

        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
          },
        );

        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

        // RLS on file_versions/files ensures the caller may see this file.
        const { data: version, error: vErr } = await supabase
          .from("file_versions")
          .select("storage_path, mime_type, file_id")
          .eq("id", versionId)
          .maybeSingle();
        if (vErr || !version) return json({ error: "Not found" }, 404);

        const { data: file } = await supabase
          .from("files")
          .select("file_name")
          .eq("id", version.file_id)
          .maybeSingle();
        if (!file) return json({ error: "Not found" }, 404);

        const { data: blob, error: dErr } = await supabase.storage
          .from("vault")
          .download(version.storage_path);
        if (dErr || !blob) return json({ error: "Could not read file" }, 502);

        const safeName = file.file_name.replace(/["\r\n]/g, "_");
        return new Response(blob, {
          status: 200,
          headers: {
            "Content-Type": version.mime_type || blob.type || "application/octet-stream",
            "Content-Disposition": `inline; filename="${safeName}"`,
            "Cache-Control": "private, no-store",
          },
        });
      },
    },
  },
});
