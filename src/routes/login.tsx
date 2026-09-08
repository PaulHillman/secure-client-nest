import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logoAsset from "@/assets/clientvault-safe.png.asset.json";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — ClientVault" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/app/dashboard", replace: true });
  }, [user, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
        navigate({ to: "/app/dashboard", replace: true });
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { name }, emailRedirectTo: `${window.location.origin}/app/dashboard` },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account.");
        setMode("signin");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
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
          <h2 className="font-display text-3xl">{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin" ? "Sign in to your team workspace." : "Use your GVSU email to get started."}
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            {mode === "signup" && (
              <div>
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="mt-1.5" />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" value={email}
                onChange={(e) => setEmail(e.target.value)} required className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="password">{mode === "signin" ? "Password or G#" : "Password"}</Label>
              <Input id="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="mt-1.5" />
              {mode === "signin" && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  First time here? Your password is your G# — including the G (for example G00123456).
                </p>
              )}

            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-6 text-sm text-muted-foreground hover:text-foreground"
          >
            {mode === "signin" ? "No account? Sign up" : "Already have an account? Sign in"}
          </button>
          <div className="mt-8 text-xs text-muted-foreground">
            <Link to="/" className="hover:underline">← Back home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
