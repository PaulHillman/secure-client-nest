import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "student";

const VIEW_AS_KEY = "clientvault_view_as";

export type ViewAsStudent = { id: string; name: string; email: string | null };

interface AuthCtx {
  user: User | null;
  realUser: User | null;
  session: Session | null;
  roles: Role[];
  isAdmin: boolean;
  realIsAdmin: boolean;
  loading: boolean;
  viewAs: ViewAsStudent | null;
  isImpersonating: boolean;
  setViewAs: (student: ViewAsStudent | null) => void;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewAs, setViewAsState] = useState<ViewAsStudent | null>(null);

  useEffect(() => {
    if (typeof sessionStorage === "undefined") return;
    const raw = sessionStorage.getItem(VIEW_AS_KEY);
    if (raw) {
      try {
        setViewAsState(JSON.parse(raw));
      } catch {
        /* ignore */
      }
    }
  }, []);

  const setViewAs = (student: ViewAsStudent | null) => {
    setViewAsState(student);
    if (typeof sessionStorage !== "undefined") {
      if (student) sessionStorage.setItem(VIEW_AS_KEY, JSON.stringify(student));
      else sessionStorage.removeItem(VIEW_AS_KEY);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => loadRoles(s.user.id), 0);
      } else {
        setRoles([]);
      }
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        await loadRoles(data.session.user.id);
      }
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadRoles = async (userId: string) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    setRoles((data ?? []).map((r) => r.role as Role));
  };

  const realUser = session?.user ?? null;
  const realIsAdmin = roles.includes("admin");
  const impersonating = realIsAdmin && !!viewAs;

  const effectiveUser = impersonating && realUser
    ? ({ ...realUser, id: viewAs!.id, email: viewAs!.email ?? realUser.email } as User)
    : realUser;

  const value: AuthCtx = {
    user: effectiveUser,
    realUser,
    session,
    roles,
    isAdmin: realIsAdmin && !impersonating,
    realIsAdmin,
    loading,
    viewAs: impersonating ? viewAs : null,
    isImpersonating: impersonating,
    setViewAs,
    signOut: async () => {
      const uid = realUser?.id;
      setViewAs(null);
      if (uid) {
        const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;
        try {
          await supabase.from("auth_audit_log").insert({ user_id: uid, event: "signout", user_agent: ua });
          if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(`auth_audit_signin:${uid}`);
        } catch { /* ignore */ }
      }
      await supabase.auth.signOut();
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
