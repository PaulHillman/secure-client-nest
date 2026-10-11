// Short-lived signed tickets so a vault file can open in a new tab as a real
// same-origin URL (/api/public/file-download?ticket=...). A new tab cannot send
// the sign-in header, and blob: URLs opened in a new tab are blocked by Chrome
// and by ad/privacy blockers, so the ticket carries the (already verified) access.
const TTL_SECONDS = 5 * 60;

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Uint8Array {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function key(): Promise<CryptoKey> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Server signing key missing");
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`file-ticket:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signFileTicket(versionId: string, now = Date.now()): Promise<string> {
  const body = b64url(new TextEncoder().encode(JSON.stringify({ v: versionId, exp: Math.floor(now / 1000) + TTL_SECONDS })));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await key(), new TextEncoder().encode(body)));
  return `${body}.${b64url(sig)}`;
}

/** Returns the version id if the ticket is genuine and unexpired, else null. */
export async function verifyFileTicket(ticket: string, now = Date.now()): Promise<string | null> {
  const [body, sig] = ticket.split(".");
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await key(), fromB64url(sig), new TextEncoder().encode(body));
    if (!ok) return null;
    const { v, exp } = JSON.parse(new TextDecoder().decode(fromB64url(body))) as { v?: string; exp?: number };
    if (!v || !exp || exp < Math.floor(now / 1000)) return null;
    return v;
  } catch {
    return null;
  }
}
