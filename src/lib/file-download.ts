import { supabase } from "@/integrations/supabase/client";
import { createFileTicket } from "@/lib/file-download.functions";

// Fetches a vault file through the app's own domain (/api/public/file-download)
// instead of the storage domain, so browser ad/privacy blockers don't block it.
// Returns a same-origin blob URL suitable for window.open, <img src>, or fetch.
export async function fetchVaultFileUrl(versionId: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not signed in");
  const res = await fetch(`/api/public/file-download?version=${encodeURIComponent(versionId)}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!res.ok) throw new Error("Could not open this file right now.");
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// Saves the file to the user's computer from the current page (no new tab, so
// neither the browser's PDF viewer nor blocker extensions are involved).
// Name kept for existing callers.
export async function openVaultFileInNewTab(versionId: string, fileName?: string): Promise<void> {
  const url = await fetchVaultFileUrl(versionId);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName || "download";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export const downloadVaultFile = openVaultFileInNewTab;
