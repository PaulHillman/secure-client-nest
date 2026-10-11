import { supabase } from "@/integrations/supabase/client";

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

export async function openVaultFileInNewTab(versionId: string): Promise<void> {
  const url = await fetchVaultFileUrl(versionId);
  window.open(url, "_blank");
}
