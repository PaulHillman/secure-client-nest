import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StudentAvatar } from "@/components/student-avatar";
import { CalendarRange } from "lucide-react";
import { DAY_LABELS, SLOT_MINUTES, fmtSlot, memberColor, slotKey, slotRangeLabel } from "@/lib/availability";

export function TeamAvailabilityCard({ teamId }: { teamId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["team-availability", teamId],
    queryFn: async () => {
      const { data: tm, error: mErr } = await supabase
        .from("team_members")
        .select("user_id, job_title")
        .eq("team_id", teamId);
      if (mErr) throw mErr;
      const ids = (tm ?? []).map((m) => m.user_id);
      if (ids.length === 0) return { members: [], busyBy: new Map<string, string[]>() };

      const [{ data: profs, error: pErr }, { data: avail, error: aErr }] = await Promise.all([
        supabase.from("profiles").select("id, name, email, avatar_url").in("id", ids),
        supabase.from("student_availability").select("user_id, busy_slots").in("user_id", ids),
      ]);
      if (pErr) throw pErr;
      if (aErr) throw aErr;

      const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
      const availMap = new Map((avail ?? []).map((a) => [a.user_id, a.busy_slots ?? []]));

      const members = ids
        .map((id, i) => ({
          id,
          name: profMap.get(id)?.name ?? "—",
          email: profMap.get(id)?.email ?? null,
          avatar_url: profMap.get(id)?.avatar_url ?? null,
          color: memberColor(i),
          hasGrid: availMap.has(id) && (availMap.get(id) ?? []).length >= 0 && availMap.has(id),
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((m, i) => ({ ...m, color: memberColor(i) }));

      const busyBy = new Map<string, string[]>();
      for (const m of members) {
        for (const key of availMap.get(m.id) ?? []) {
          busyBy.set(key, [...(busyBy.get(key) ?? []), m.id]);
        }
      }
      return { members, busyBy };
    },
  });

  const members = data?.members ?? [];
  const busyBy = data?.busyBy ?? new Map<string, string[]>();
  const withGrid = members.filter((m) => m.hasGrid);

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-xl">
          <CalendarRange className="h-5 w-5 text-gold" /> Team availability overlay
        </CardTitle>
        <CardDescription>
          Each teammate has their own color. A blank square means everyone who filled in their grid is
          free at that half hour.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading availability…</p>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No members on this team yet.</p>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-3">
              {members.map((m) => (
                <span key={m.id} className="flex items-center gap-2 rounded-full border px-2 py-1 text-xs">
                  <span
                    className="h-3 w-3 rounded-sm"
                    style={{ backgroundColor: m.color }}
                    aria-hidden
                  />
                  <StudentAvatar name={m.name} email={m.email} avatarUrl={m.avatar_url} size={20} />
                  <span className="font-medium">{m.name}</span>
                  {!m.hasGrid && <span className="text-muted-foreground">(not filled in)</span>}
                </span>
              ))}
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[560px]">
                <div className="grid grid-cols-[64px_repeat(7,1fr)] gap-px text-[10px] font-semibold uppercase text-muted-foreground">
                  <div />
                  {DAY_LABELS.map((d) => (
                    <div key={d} className="pb-1 text-center">
                      {d}
                    </div>
                  ))}
                </div>
                {SLOT_MINUTES.map((m) => (
                  <div key={m} className="grid grid-cols-[64px_repeat(7,1fr)] gap-px">
                    <div className="pr-2 text-right text-[10px] leading-5 text-muted-foreground">
                      {m % 60 === 0 ? fmtSlot(m) : ""}
                    </div>
                    {DAY_LABELS.map((_, day) => {
                      const key = slotKey(day, m);
                      const ids = busyBy.get(key) ?? [];
                      const busyMembers = members.filter((mm) => ids.includes(mm.id));
                      const allFree = busyMembers.length === 0 && withGrid.length > 0;
                      return (
                        <div
                          key={key}
                          title={
                            busyMembers.length === 0
                              ? `${slotRangeLabel(day, m)} — everyone free`
                              : `${slotRangeLabel(day, m)} — busy: ${busyMembers.map((x) => x.name).join(", ")}`
                          }
                          className={`flex h-5 overflow-hidden rounded-[2px] border ${
                            allFree
                              ? "border-emerald-500/40 bg-emerald-500/15"
                              : "border-border/40 bg-muted/20"
                          }`}
                        >
                          {busyMembers.map((bm) => (
                            <span
                              key={bm.id}
                              className="h-full flex-1"
                              style={{ backgroundColor: bm.color }}
                            />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Green = every teammate who filled in their grid is free. Colored stripes show who is busy.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
