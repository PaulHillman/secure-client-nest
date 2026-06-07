import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Bell, Check, Trash2 } from "lucide-react";

type NotificationRow = {
  id: string;
  user_id: string;
  team_id: string | null;
  file_id: string | null;
  comment_id: string | null;
  actor_id: string | null;
  kind: string;
  message: string;
  read: boolean;
  created_at: string;
};

export function NotificationsBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as NotificationRow[];
    },
  });

  const items = data ?? [];
  const unread = useMemo(() => items.filter((n) => !n.read).length, [items]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications", user.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  const markRead = async (id: string) => {
    await supabase.from("notifications" as any).update({ read: true }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
  };

  const markAllRead = async () => {
    await supabase
      .from("notifications" as any)
      .update({ read: true })
      .eq("user_id", user?.id ?? "")
      .eq("read", false);
    qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
  };

  const remove = async (id: string) => {
    await supabase.from("notifications" as any).delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
  };

  const openNotification = async (n: NotificationRow) => {
    if (!n.read) await markRead(n.id);
    setOpen(false);
    if (n.team_id) {
      navigate({
        to: "/app/vault",
        search: { team: n.team_id, file: n.file_id ?? undefined } as never,
      });
    }
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center bg-rose-500 text-white border-0"
            >
              {unread > 99 ? "99+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-2 border-b">
          <div className="text-sm font-semibold">Notifications</div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead} className="h-7 text-xs">
              <Check className="h-3 w-3 mr-1" /> Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="p-4 text-xs text-muted-foreground italic">You're all caught up.</p>
          ) : (
            items.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-2 p-2 border-b text-sm hover:bg-muted/40 cursor-pointer ${
                  n.read ? "opacity-70" : "bg-muted/20"
                }`}
                onClick={() => openNotification(n)}
              >
                <div className="flex-1 min-w-0">
                  <p className="line-clamp-2">{n.message}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(n.id);
                  }}
                  aria-label="Dismiss"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
