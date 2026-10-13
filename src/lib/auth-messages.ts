/** Turns raw sign-in errors into plain, student-friendly guidance. */
export function friendlyAuthError(raw: string | undefined | null): string {
  const m = (raw ?? "").toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid_credentials"))
    return "Email or password is incorrect. Your first password is your G# with a capital G (for example G00123456). Forgot it? Use “Forgot password?” or “Email me a sign-in code”.";
  if (m.includes("signups not allowed") || m.includes("user not found") || m.includes("otp_disabled"))
    return "No ClientVault account uses that email. Check the spelling — it should end in @mail.gvsu.edu. If it still fails, contact Professor Hillman.";
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes"))
    return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("expired") || m.includes("invalid") && m.includes("otp") || m.includes("token has expired"))
    return "That code is wrong or has expired. Request a new one and use the newest email.";
  if (m.includes("email not confirmed"))
    return "Your account isn't confirmed yet. Use “Email me a sign-in code” to get in.";
  if (m.includes("network") || m.includes("fetch"))
    return "Can't reach ClientVault right now. Check your internet connection and try again.";
  return raw || "Something went wrong. Please try again.";
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
