import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { recordHealthReportView } from "@/lib/health-report-views";
import { fetchVaultFileUrl } from "@/lib/file-download";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/health-report/$fileId")({
  head: () => ({
    meta: [
      { title: "Team Health Review report · ClientVault" },
      { name: "description", content: "Open your team's weekly Health Review report in ClientVault." },
      { property: "og:title", content: "Team Health Review report · ClientVault" },
      { property: "og:description", content: "Open your team's weekly Health Review report in ClientVault." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HealthReportOpen,
});

function HealthReportOpen() {
  const { fileId } = Route.useParams();
  const [url, setUrl] = useState<string | null>(null);
  const [name, setName] = useState("Team Health Review.pdf");
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    let blob: string | null = null;
    (async () => {
      const { data: f } = await supabase.from("files")
        .select("id, team_id, file_name, subsection, current_version_id").eq("id", fileId).maybeSingle();
      if (!f || f.subsection !== "Health Reports" || !f.current_version_id) {
        setError("This report could not be found, or you are not on this team.");
        return;
      }
      setName(f.file_name);
      // Record the open to the signed-in student first, then show the PDF.
      await recordHealthReportView(f.id, f.team_id, true, f.current_version_id);
      try {
        blob = await fetchVaultFileUrl(f.current_version_id);
        setUrl(blob);
      } catch {
        setError("Your opening was recorded, but the PDF could not be shown right now. Find it in File Vault → Team Documents → Health Reports.");
      }
    })();
    return () => { if (blob) setTimeout(() => URL.revokeObjectURL(blob!), 30_000); };
  }, [fileId]);

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Team Health Review</h1>
          <p className="text-sm text-muted-foreground">{url ? "Your opening of this report has been recorded." : error ? "" : "Opening your report…"}</p>
        </div>
        {url && (
          <Button asChild><a href={url} download={name}>Download the PDF</a></Button>
        )}
      </div>
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {error} <Link to="/app/vault" search={{} as never} className="underline">Go to File Vault</Link>
        </p>
      )}
      {url && <iframe title={name} src={url} className="h-[80vh] w-full rounded-md border" />}
    </div>
  );
}
