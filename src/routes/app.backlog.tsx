import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, ClipboardList, ArrowRight, ArrowLeft, Play, CheckCircle2, Archive } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/backlog")({
  component: BacklogPage,
});

type Status = "todo" | "in_progress" | "done" | "shelved";
type Priority = "low" | "medium" | "high";

type Item = {
  id: string;
  title: string;
  notes: string | null;
  status: Status;
  priority: Priority;
  order_index: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

const STATUS_LABEL: Record<Status, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
  shelved: "Shelved",
};
const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};
const PRIORITY_CLASS: Record<Priority, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  high: "bg-destructive/15 text-destructive",
};
const STATUS_CLASS: Record<Status, string> = {
  todo: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  done: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  shelved: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300",
};

const NEXT_STATUS: Record<Status, Status | null> = {
  todo: "in_progress",
  in_progress: "done",
  done: null,
  shelved: null,
};

const PREV_STATUS: Record<Status, Status | null> = {
  todo: null,
  in_progress: "todo",
  done: "in_progress",
  shelved: "todo",
};

const STATUS_ORDER: Status[] = ["todo", "in_progress", "done", "shelved"];

function BacklogPage() {
  const { isAdmin, loading } = useAuth();
  const qc = useQueryClient();

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/app/dashboard" />;


  const { data: items = [], isLoading } = useQuery({
    queryKey: ["backlog_items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("backlog_items")
        .select("*")
        .order("status", { ascending: true })
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["backlog_items"] });

  const updateMut = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Item> }) => {
      const { error } = await supabase.from("backlog_items").update(patch).eq("id", id);
      if (error) throw error;
      return patch;
    },
    onSuccess: (patch) => {
      invalidate();
      if (patch?.status) {
        toast.success(`Moved to ${STATUS_LABEL[patch.status as Status]}`);
      }
    },
    onError: (e: any) => toast.error(e.message ?? "Update failed"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("backlog_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e.message ?? "Delete failed"),
  });

  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");

  const filteredItems = items.filter((i) => {
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    if (priorityFilter !== "all" && i.priority !== priorityFilter) return false;
    return true;
  });

  const visibleStatuses: Status[] =
    statusFilter === "all" ? STATUS_ORDER : [statusFilter];

  const groups: { key: Status; items: Item[] }[] = visibleStatuses.map(
    (k) => ({ key: k, items: filteredItems.filter((i) => i.status === k) }),
  );

  const counts = {
    todo: items.filter((i) => i.status === "todo").length,
    in_progress: items.filter((i) => i.status === "in_progress").length,
    done: items.filter((i) => i.status === "done").length,
    shelved: items.filter((i) => i.status === "shelved").length,
  };

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-primary" /> Work List
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track what's left to build, in progress, and shipped.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <Badge variant="outline">To do: {counts.todo}</Badge>
          <Badge variant="outline">In progress: {counts.in_progress}</Badge>
          <Badge variant="outline">Done: {counts.done}</Badge>
          <Badge variant="outline">Shelved: {counts.shelved}</Badge>
        </div>
      </header>

      {isAdmin && <NewItemForm />}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Filter:</span>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as Status | "all")}>
          <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_ORDER.map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as Priority | "all")}>
          <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
              <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(statusFilter !== "all" || priorityFilter !== "all") && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs"
            onClick={() => { setStatusFilter("all"); setPriorityFilter("all"); }}
          >
            Clear
          </Button>
        )}
      </div>


      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No items yet. {isAdmin ? "Add the first one above." : "An admin can add items."}
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.key} className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {STATUS_LABEL[g.key]} ({g.items.length})
              </h2>
              {g.items.length === 0 ? (
                <p className="text-xs text-muted-foreground italic px-1">Nothing here.</p>
              ) : (
                <ul className="space-y-2">
                  {g.items.map((item) => (
                    <li key={item.id}>
                      <Card className="p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[item.status]}`}>
                                {STATUS_LABEL[item.status]}
                              </span>
                              <span className={`rounded px-2 py-0.5 text-xs font-medium ${PRIORITY_CLASS[item.priority]}`}>
                                {PRIORITY_LABEL[item.priority]}
                              </span>
                            </div>
                            <h3 className="mt-2 font-medium leading-snug">{item.title}</h3>
                            {item.notes && (
                              <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                                {item.notes}
                              </p>
                            )}
                          </div>
                          {isAdmin && (
                            <div className="flex flex-wrap items-center gap-2">
                              <Select
                                value={item.status}
                                onValueChange={(v) => updateMut.mutate({ id: item.id, patch: { status: v as Status } })}
                              >
                                <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                                    <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Select
                                value={item.priority}
                                onValueChange={(v) => updateMut.mutate({ id: item.id, patch: { priority: v as Priority } })}
                              >
                                <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                                    <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                variant="ghost" size="icon"
                                onClick={() => {
                                  if (confirm(`Delete "${item.title}"?`)) deleteMut.mutate(item.id);
                                }}
                                aria-label="Delete"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {PREV_STATUS[item.status] && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs gap-1"
                              onClick={() =>
                                updateMut.mutate({
                                  id: item.id,
                                  patch: { status: PREV_STATUS[item.status]! },
                                })
                              }
                              disabled={updateMut.isPending}
                            >
                              <ArrowLeft className="h-3.5 w-3.5" />
                              {PREV_STATUS[item.status] === "todo"
                                ? "Move back to To do"
                                : PREV_STATUS[item.status] === "in_progress"
                                  ? "Reopen"
                                  : "Back"}
                            </Button>
                          )}
                          {NEXT_STATUS[item.status] && (
                            <Button
                              variant="default"
                              size="sm"
                              className="h-8 text-xs gap-1"
                              onClick={() =>
                                updateMut.mutate({
                                  id: item.id,
                                  patch: { status: NEXT_STATUS[item.status]! },
                                })
                              }
                              disabled={updateMut.isPending}
                            >
                              {NEXT_STATUS[item.status] === "in_progress" ? (
                                <>
                                  <Play className="h-3.5 w-3.5" /> Start work
                                </>
                              ) : NEXT_STATUS[item.status] === "done" ? (
                                <>
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                                </>
                              ) : (
                                <>
                                  <ArrowRight className="h-3.5 w-3.5" /> Next
                                </>
                              )}
                            </Button>
                          )}
                          {item.status !== "shelved" && item.status !== "done" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs gap-1 text-muted-foreground"
                              onClick={() =>
                                updateMut.mutate({ id: item.id, patch: { status: "shelved" } })
                              }
                              disabled={updateMut.isPending}
                            >
                              <Archive className="h-3.5 w-3.5" /> Shelve
                            </Button>
                          )}
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function NewItemForm() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [open, setOpen] = useState(false);

  const createMut = useMutation({
    mutationFn: async () => {
      const t = title.trim();
      if (!t) throw new Error("Title required");
      const { error } = await supabase.from("backlog_items").insert({
        title: t,
        notes: notes.trim() || null,
        priority,
        status: "todo",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitle(""); setNotes(""); setPriority("medium"); setOpen(false);
      qc.invalidateQueries({ queryKey: ["backlog_items"] });
      toast.success("Item added");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to add"),
  });

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="gap-2">
        <Plus className="h-4 w-4" /> Add item
      </Button>
    );
  }

  return (
    <Card className="p-4 space-y-3">
      <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      <div className="flex flex-wrap items-center gap-2">
        <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button variant="ghost" onClick={() => { setOpen(false); setTitle(""); setNotes(""); }}>Cancel</Button>
        <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
          {createMut.isPending ? "Adding…" : "Add"}
        </Button>
      </div>
    </Card>
  );
}
