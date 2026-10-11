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

// Opens a real same-origin link (not a blob: URL — Chrome and blockers refuse
// blob: pages in a new tab). The tab is opened immediately on click so popup
// blockers allow it, then pointed at the 5-minute signed link.
export async function openVaultFileInNewTab(versionId: string): Promise<void> {
  const win = window.open("", "_blank");
  try {
    const { url } = await createFileTicket({ data: { versionId } });
    const abs = new URL(url, window.location.origin).toString();
    if (win) {
      win.opener = null;
      win.location.href = abs;
    } else {
      window.location.assign(abs);
    }
  } catch (e) {
    win?.close();
    throw e;
  }
}
