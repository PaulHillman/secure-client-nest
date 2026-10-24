const KEY = "cv-return-path";

/** Only same-origin app paths are remembered, so sign-in can never bounce to another site. */
export function safeAppPath(p: string | null | undefined): string | null {
  if (!p || !p.startsWith("/app/") || p.startsWith("//") || p.includes("\\")) return null;
  return p;
}

export function rememberReturnPath(p: string) {
  const safe = safeAppPath(p);
  if (safe) try { sessionStorage.setItem(KEY, safe); } catch { /* ignore */ }
}

export function takeReturnPath(): string | null {
  try {
    const p = safeAppPath(sessionStorage.getItem(KEY));
    sessionStorage.removeItem(KEY);
    return p;
  } catch { return null; }
}
