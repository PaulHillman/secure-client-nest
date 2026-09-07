import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { teamLabel } from "@/lib/team-label";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Camera, LogOut, Loader2 } from "lucide-react";

type Form = {
  first_name: string;
  last_name: string;
  email: string;
  student_id: string;
  phone_number: string;
  phone_visible: boolean;
};

export function MyProfileCard() {
  const { user, signOut } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<Form>({
    first_name: "", last_name: "", email: "", student_id: "",
    phone_number: "", phone_visible: false,
  });

  const { data } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, name, first_name, last_name, email, student_id, phone_number, phone_visible, avatar_url, section")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;

      const { data: membership } = await supabase
        .from("team_members")
        .select("job_title, teams(name, section)")
        .eq("user_id", user!.id)
        .maybeSingle();

      return { profile, membership };
    },
  });

  useEffect(() => {
    const p = data?.profile;
    if (!p) return;
    const parts = (p.name ?? "").trim().split(/\s+/);
    setForm({
      first_name: p.first_name ?? parts[0] ?? "",
      last_name: p.last_name ?? parts.slice(1).join(" ") ?? "",
      email: p.email ?? user?.email ?? "",
      student_id: p.student_id ?? "",
      phone_number: p.phone_number ?? "",
      phone_visible: p.phone_visible ?? false,
    });
  }, [data, user?.email]);

  const save = useMutation({
    mutationFn: async (f: Form) => {
      const fullName = `${f.first_name} ${f.last_name}`.trim();
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: f.first_name.trim() || null,
          last_name: f.last_name.trim() || null,
          name: fullName,
          email: f.email.trim() || null,
          student_id: f.student_id.trim() || null,
          phone_number: f.phone_number.trim() || null,
          phone_visible: f.phone_visible,
        })
        .eq("id", user!.id);
      if (error) throw error;

      if (f.email.trim() && f.email.trim().toLowerCase() !== (user?.email ?? "").toLowerCase()) {
        const { error: authErr } = await supabase.auth.updateUser({ email: f.email.trim() });
        if (authErr) throw new Error(`Profile saved, but email change failed: ${authErr.message}`);
        return { emailChanged: true };
      }
      return { emailChanged: false };
    },
    onSuccess: (r) => {
      toast.success(r.emailChanged ? "Profile saved — check your new inbox to confirm the address." : "Profile saved");
      qc.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onPickFile = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error } = await supabase.from("profiles").update({ avatar_url: pub.publicUrl }).eq("id", user.id);
      if (error) throw error;
      toast.success("Profile picture updated");
      qc.invalidateQueries({ queryKey: ["my-profile"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (!user) return null;

  const p = data?.profile;
  const team = data?.membership?.teams as { name: string; section: string | null } | null | undefined;
  const initials = `${form.first_name[0] ?? ""}${form.last_name[0] ?? ""}`.toUpperCase() || "?";

  return (
    <Card className="border-border/60">
      <CardContent className="pt-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <Avatar className="h-24 w-24">
                {p?.avatar_url && <AvatarImage src={p.avatar_url} alt="Your profile picture" />}
                <AvatarFallback className="text-xl">{initials}</AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 rounded-full bg-primary p-2 text-primary-foreground shadow hover:opacity-90"
                aria-label="Change profile picture"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void onPickFile(f); e.target.value = ""; }}
              />
            </div>
          </div>

          <div className="flex-1 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl leading-tight">
                  {`${form.first_name} ${form.last_name}`.trim() || p?.name || user.email}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{team ? teamLabel(team) : "No team yet"}</Badge>
                  <Badge variant="outline">{data?.membership?.job_title ?? "No role yet"}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Team and role are set by your instructor and can't be changed here.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => void signOut()}>
                <LogOut className="mr-2 h-4 w-4" />Sign out
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="first_name">First name</Label>
                <Input id="first_name" value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })} maxLength={60} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="last_name">Last name</Label>
                <Input id="last_name" value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })} maxLength={60} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input id="email" type="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="student_id">G#</Label>
                <Input id="student_id" value={form.student_id} placeholder="G00123456"
                  onChange={(e) => setForm({ ...form, student_id: e.target.value })} maxLength={20} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone_number">Mobile number</Label>
                <Input id="phone_number" type="tel" value={form.phone_number} placeholder="(555) 555-5555"
                  onChange={(e) => setForm({ ...form, phone_number: e.target.value })} maxLength={25} />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2 sm:mt-6">
                <div>
                  <div className="text-sm font-medium">Share my number</div>
                  <div className="text-xs text-muted-foreground">Visible to teammates and the instructor</div>
                </div>
                <Switch checked={form.phone_visible}
                  onCheckedChange={(v) => setForm({ ...form, phone_visible: v })} />
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => save.mutate(form)} disabled={save.isPending}>
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save changes
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
