import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logoAsset from "@/assets/clientvault-safe.png.asset.json";
import { friendlyAuthError, normalizeEmail } from "@/lib/auth-messages";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — ClientVault" },
      { name: "description", content: "Sign in to your ClientVault team workspace with your password or an emailed code." },
      { property: "og:title", content: "Sign in — ClientVault" },
      { property: "og:description", content: "Sign in to your ClientVault team workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

type Mode = "password" | "code" | "forgot";

function LoginPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) navigate({ to: "/app/dashboard", replace: true });
  }, [user, navigate]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setCodeSent(false);
    setResetSent(false);
    setCode("");
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(friendlyAuthError((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const onPassword = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const { error } = await supabase.auth.signInWithPassword({ email: normalizeEmail(email), password });
      if (error) throw error;
      toast.success("Welcome back");
      navigate({ to: "/app/dashboard", replace: true });
    });
  };

  const sendCode = () =>
    run(async () => {
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizeEmail(email),
        options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/login` },
      });
      if (error) throw error;
      setCodeSent(true);
      toast.success("Check your email for your sign-in code.");
    });

  const onCode = (e: FormEvent) => {
    e.preventDefault();
    if (!codeSent) return sendCode();
    run(async () => {
      const { error } = await supabase.auth.verifyOtp({ email: normalizeEmail(email), token: code.trim(), type: "email" });
      if (error) throw error;
      toast.success("Signed in");
      navigate({ to: "/app/dashboard", replace: true });
    });
  };

  const onForgot = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), {
        redirectTo: `${window.location.origin}/set-password`,
      });
      if (error) throw error;
      setResetSent(true);
    });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-sidebar text-sidebar-foreground relative overflow-hidden">
        <div className="flex items-center gap-3 relative z-10">
          <img src={logoAsset.url} alt="" className="h-10 w-10 object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]" />
          <span className="font-display text-2xl tracking-tight overflow-hidden">
            <span className="vault-client-slide text-sidebar-foreground">Client</span><span className="text-gold">Vault</span>
          </span>
        </div>
        <div className="relative z-10 flex flex-col items-center text-center">
          <img src={logoAsset.url} alt="" className="vault-door-swing h-72 w-72 object-contain mb-8 drop-shadow-[0_20px_50px_rgba(0,0,0,0.6)]" />
          <h1 className="font-display text-5xl leading-tight">
            The workspace for <span className="text-gold italic">MGT 331</span> consulting teams.
          </h1>
          <p className="mt-4 max-w-md text-sidebar-foreground/70">
            Team rosters, company focus briefs, signed group norms, and a versioned file vault — all in one place.
          </p>
        </div>
        <div className="text-xs text-sidebar-foreground/50 relative z-10">
          Seidman College of Business · Grand Valley State University
        </div>
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-gold/10 blur-3xl" />
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex items-center justify-center gap-3">
            <img src={logoAsset.url} alt="" className="h-12 w-12 object-contain" />
            <span className="font-display text-2xl tracking-tight">
              <span className="text-foreground">Client</span><span className="text-gold">Vault</span>
            </span>
          </div>
          <h2 className="font-display text-3xl">
            {mode === "password" ? "Welcome back" : mode === "code" ? "Sign in with a code" : "Reset your password"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "password" && "Sign in to your team workspace."}
            {mode === "code" && "We'll email you a code. No password needed."}
            {mode === "forgot" && "We'll email you a link to choose a new password."}
          </p>

          {error && (
            <div role="alert" className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {mode === "password" && (
            <form onSubmit={onPassword} className="mt-6 space-y-4">
              <EmailField email={email} setEmail={setEmail} />
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password or G#</Label>
                  <button type="button" onClick={() => switchMode("forgot")} className="text-sm font-medium text-primary hover:underline">
                    Forgot password?
                  </button>
                </div>
                <Input id="password" type="password" autoComplete="current-password" value={password}
                  onChange={(e) => setPassword(e.target.value)} required className="mt-1.5" />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  First time here? Your password is your G# — including the capital G (for example G00123456).
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={busy}>{busy ? "Please wait…" : "Sign in"}</Button>
              <Button type="button" variant="outline" className="w-full" onClick={() => switchMode("code")}>
                Email me a sign-in code
              </Button>
            </form>
          )}

          {mode === "code" && (
            <form onSubmit={onCode} className="mt-6 space-y-4">
              <EmailField email={email} setEmail={setEmail} disabled={codeSent} />
              {codeSent && (
                <div>
                  <Label htmlFor="code">Code from your email</Label>
                  <Input id="code" inputMode="numeric" autoComplete="one-time-code" value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))} required className="mt-1.5 tracking-widest" />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Sent to {email}. Check junk/spam if it doesn't arrive within a minute. You can also click the link in that email.
                  </p>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Please wait…" : codeSent ? "Sign in" : "Email me a code"}
              </Button>
              {codeSent && (
                <button type="button" onClick={sendCode} disabled={busy} className="text-sm text-muted-foreground hover:text-foreground">
                  Send a new code
                </button>
              )}
            </form>
          )}

          {mode === "forgot" && (
            resetSent ? (
              <div className="mt-6 rounded-md border bg-muted/40 p-4 text-sm">
                If <strong>{email}</strong> has a ClientVault account, a reset link is on its way. Open it on this device, then choose a new password.
                Check junk/spam if it doesn't arrive within a few minutes.
              </div>
            ) : (
              <form onSubmit={onForgot} className="mt-6 space-y-4">
                <EmailField email={email} setEmail={setEmail} />
                <Button type="submit" className="w-full" disabled={busy}>{busy ? "Please wait…" : "Email me a reset link"}</Button>
              </form>
            )
          )}

          {mode !== "password" && (
            <button type="button" onClick={() => switchMode("password")} className="mt-6 text-sm text-muted-foreground hover:text-foreground">
              ← Sign in with password instead
            </button>
          )}

          <details className="mt-8 rounded-md border p-3 text-sm">
            <summary className="cursor-pointer font-medium">Trouble signing in?</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Use your GVSU email, ending in <strong>@mail.gvsu.edu</strong>.</li>
              <li>First password = your G# with a capital G.</li>
              <li>Forgot your password? Use “Forgot password?” or “Email me a sign-in code”.</li>
              <li>Emails can take a minute — check junk/spam, and always use the newest one.</li>
              <li>Accounts are created by your instructor. Still stuck? Email Professor Hillman.</li>
            </ul>
          </details>

          <div className="mt-6 text-xs text-muted-foreground">
            <Link to="/" className="hover:underline">← Back home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmailField({ email, setEmail, disabled }: { email: string; setEmail: (v: string) => void; disabled?: boolean }) {
  return (
    <div>
      <Label htmlFor="email">GVSU email</Label>
      <Input id="email" type="email" autoComplete="email" placeholder="you@mail.gvsu.edu" value={email}
        onChange={(e) => setEmail(e.target.value)} required disabled={disabled} className="mt-1.5" />
    </div>
  );
}
