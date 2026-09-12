import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logoAsset from "@/assets/clientvault-safe.png.asset.json";

export const Route = createFileRoute("/set-password")({
  head: () => ({
    meta: [
      { title: "Set your password — ClientVault" },
      {
        name: "description",
        content:
          "Choose a password for your ClientVault account after following an invitation or reset link.",
      },
      { property: "og:title", content: "Set your password — ClientVault" },
      {
        property: "og:description",
        content: "Choose a password for your ClientVault account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SetPasswordPage,
});

/** Public page for invitation and password-reset links. */
function SetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasLink, setHasLink] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase hydrates the invite / recovery session from the URL on load.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) {
        setHasLink(true);
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setHasLink(!!data.session);
      setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Those two passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password saved. You are signed in.");
      navigate({ to: "/app/dashboard", replace: true });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-3">
          <img src={logoAsset.url} alt="" className="h-12 w-12 object-contain" />
          <span className="font-display text-2xl tracking-tight">
            <span className="text-foreground">Client</span>
            <span className="text-gold">Vault</span>
          </span>
        </div>

        <h1 className="font-display text-3xl">Set your password</h1>

        {!ready ? (
          <p className="mt-3 text-sm text-muted-foreground">Checking your link…</p>
        ) : !hasLink ? (
          <p className="mt-3 text-sm text-muted-foreground">
            This page works only when you open it from an invitation or password-reset email. Open
            that link again, or{" "}
            <Link to="/login" className="underline underline-offset-4">
              go to sign in
            </Link>
            .
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose a password for your account. You will use it to sign in from now on.
            </p>
            <form onSubmit={onSubmit} className="mt-8 space-y-4">
              <div>
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  className="mt-1.5"
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Saving…" : "Save password"}
              </Button>
            </form>
          </>
        )}

        <div className="mt-8 text-xs text-muted-foreground">
          <Link to="/login" className="hover:underline">
            ← Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
