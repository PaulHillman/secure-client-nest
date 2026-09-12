import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  approveTeamNorms,
  getTeamNorms,
  saveTeamNorms,
} from "@/lib/group-norms.functions";
import {
  AFFIRMATION_TEXT,
  findVagueLanguage,
  NORMS_INTRO,
  NORM_SECTIONS,
  normalizeNorms,
  sameNorms,
  type NormsContent,
} from "@/lib/group-norms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { StudentAvatar } from "@/components/student-avatar";
import { AlertTriangle, CheckCircle2, Clock, FileSignature, Pencil, ScrollText } from "lucide-react";

export function GroupNormsCard({ teamId }: { teamId: string }) {
  const qc = useQueryClient();
  const fetchNorms = useServerFn(getTeamNorms);
  const save = useServerFn(saveTeamNorms);
  const approve = useServerFn(approveTeamNorms);

  const { data, isLoading } = useQuery({
    queryKey: ["group-norms", teamId],
    queryFn: () => fetchNorms({ data: { teamId } }),
  });

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<NormsContent>({});
  const [affirmed, setAffirmed] = useState(false);
  

  useEffect(() => {
    if (data) setDraft(normalizeNorms(data.content));
  }, [data?.version, data?.updatedAt]);

  const dirty = useMemo(
    () => (data ? !sameNorms(normalizeNorms(data.content), normalizeNorms(draft)) : false),
    [data, draft],
  );

  const draftFindings = useMemo(
    () => findVagueLanguage(normalizeNorms(draft)),
    [draft],
  );

  const saveMut = useMutation({
    mutationFn: () => save({ data: { teamId, content: draft } }),
    onSuccess: (r) => {
      toast.success(
        r.newVersion
          ? `Saved as version ${r.version}. Every member approves again.`
          : "Saved. Nothing changed, so approvals stay in place.",
      );
      setEditing(false);
      void qc.invalidateQueries({ queryKey: ["group-norms", teamId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveMut = useMutation({
    mutationFn: () =>
      approve({ data: { teamId, version: data!.version } }),
    onSuccess: () => {
      toast.success("Your approval has been recorded.");
      setAffirmed(false);
      void qc.invalidateQueries({ queryKey: ["group-norms", teamId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return (
      <Card id="group-norms" className="border-border/60 scroll-mt-4">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-2xl">Group Norms</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Loading…</CardContent>
      </Card>
    );
  }

  const set = (key: string, value: string) => setDraft((d) => ({ ...d, [key]: value }));

  return (
    <Card id="group-norms" className="border-border/60 scroll-mt-4">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="font-display text-2xl flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-gold" />
            Group Norms
            {data.exists && <Badge variant="secondary">Version {data.version}</Badge>}
            {data.flaggedForReview && (
              <Badge variant="outline" className="border-amber-500 text-amber-600">
                <AlertTriangle className="h-3 w-3 mr-1" /> Flagged for Prof Hillman
              </Badge>
            )}
            {data.exists && data.approvedCount === data.total && data.total > 0 && (
              <Badge className="bg-emerald-600 hover:bg-emerald-600">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Fully approved
              </Badge>
            )}
          </CardTitle>
          {data.canEdit && !editing && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4 mr-1" />
              {data.exists ? "Edit norms" : "Write our norms"}
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{NORMS_INTRO}</p>
        {!data.canEdit && data.isMember && (
          <p className="text-sm text-muted-foreground">
            Your Project Manager is taking the lead writing this document and will gather input
            from the team. Every member — including the PM — still reads and approves it here.
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ---------- The document ---------- */}
        <div className="space-y-5">
          {NORM_SECTIONS.map((s) => (
            <section key={s.key} className="space-y-2">
              <div>
                <h3
                  className={
                    s.emphasis
                      ? "font-display text-lg text-gold"
                      : "font-display text-lg"
                  }
                >
                  {s.title}
                  {s.optional && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">Optional</span>
                  )}
                </h3>
                <p className="text-xs text-muted-foreground">{s.guidance}</p>
              </div>

              {s.levels ? (
                <div className="space-y-3">
                  {s.levels.map((l) => (
                    <div key={l.key} className="space-y-1">
                      <p className="text-sm font-medium">{l.label}</p>
                      <p className="text-xs text-muted-foreground">{l.guidance}</p>
                      {editing ? (
                        <Textarea
                          rows={3}
                          value={draft[l.key] ?? ""}
                          onChange={(e) => set(l.key, e.target.value)}
                        />
                      ) : (
                        <SavedText value={data.content[l.key]} />
                      )}
                    </div>
                  ))}
                </div>
              ) : editing ? (
                <Textarea
                  rows={s.key === "other" ? 2 : 3}
                  value={draft[s.key] ?? ""}
                  onChange={(e) => set(s.key, e.target.value)}
                />
              ) : (
                <SavedText value={data.content[s.key]} optional={s.optional} />
              )}
            </section>
          ))}
        </div>

        {editing && (
          <VagueNotice
            findings={draftFindings}
            title="Make this measurable before you save"
            intro="Group Norms have to be enforceable. These phrases cannot be measured:"
          />
        )}

        {editing && (
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
              Save
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setDraft(normalizeNorms(data.content));
                setEditing(false);
              }}
            >
              Cancel
            </Button>
            {dirty && (
              <p className="text-xs text-muted-foreground">
                Changing the wording creates a new version and every member approves again.
              </p>
            )}
          </div>
        )}

        {!editing && data.exists && (
          <p className="text-xs text-muted-foreground">
            Last saved{" "}
            {data.updatedAt ? new Date(data.updatedAt).toLocaleString() : "—"}
            {data.updatedByName ? ` by ${data.updatedByName}` : ""} · {data.history.length} version
            {data.history.length === 1 ? "" : "s"} kept.
          </p>
        )}

        {/* ---------- Approvals ---------- */}
        <div className="rounded-lg border border-border/60 p-4 space-y-3">
          <h3 className="font-display text-lg flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-gold" />
            Member acceptance and approval
          </h3>
          <p className="text-xs text-muted-foreground">
            {data.approvedCount} of {data.total} members have approved version {data.version}.
          </p>

          <ul className="space-y-1.5">
            {data.roster.map((m) => (
              <li key={m.userId} className="flex items-center gap-2 text-sm">
                <StudentAvatar name={m.name} avatarUrl={m.avatarUrl} size={24} />
                <span className="truncate">{m.name}</span>
                {m.jobTitle && (
                  <span className="text-xs text-muted-foreground truncate">{m.jobTitle}</span>
                )}
                <span className="ml-auto text-xs">
                  {m.approvedAt ? (
                    <span className="text-emerald-500 inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {new Date(m.approvedAt).toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-muted-foreground inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Pending
                    </span>
                  )}
                </span>
              </li>
            ))}
            {data.roster.length === 0 && (
              <li className="text-sm text-muted-foreground">No members on this team yet.</li>
            )}
          </ul>

          {data.canApprove ? (
            data.myApprovalAt ? (
              <p className="text-sm text-emerald-500">
                You approved version {data.version} on{" "}
                {new Date(data.myApprovalAt).toLocaleString()}.
              </p>
            ) : !data.exists ? (
              <p className="text-sm text-muted-foreground">
                Your team has not saved its norms yet.
              </p>
            ) : !data.complete ? (
              <p className="text-sm text-muted-foreground">
                Every section must be completed before anyone can approve. Still needed:{" "}
                {data.missing.join(", ")}.
              </p>
            ) : (
              <div className="space-y-3 pt-1">
                {data.vagueFindings.length > 0 && (
                  <VagueNotice
                    findings={data.vagueFindings}
                    title="Warning: this document uses wording that cannot be measured"
                    intro="You can still approve it. It will be noted for Prof Hillman's review before the kick-off meeting. Your PM can fix the wording first:"
                  />
                )}
                <label className="flex items-start gap-3 text-sm">
                  <Checkbox
                    checked={affirmed}
                    onCheckedChange={(v) => setAffirmed(v === true)}
                    className="mt-0.5"
                  />
                  <span>{AFFIRMATION_TEXT}</span>
                </label>
                <Button
                  disabled={!affirmed || approveMut.isPending || editing}
                  onClick={() => approveMut.mutate()}
                >
                  Approve Group Norms
                </Button>
              </div>
            )
          ) : (
            <p className="text-xs text-muted-foreground">
              You are viewing this team's progress. Only a member of this team can approve their
              own norms.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function VagueNotice({
  findings,
  title,
  intro,
}: {
  findings: { label: string; phrase: string; reason: string }[];
  title: string;
  intro: string;
}) {
  if (!findings.length) return null;
  return (
    <div className="rounded-lg border border-amber-500/60 bg-amber-500/5 p-4 space-y-2">
      <h4 className="text-sm font-medium flex items-center gap-2 text-amber-600">
        <AlertTriangle className="h-4 w-4" />
        {title}
      </h4>
      <p className="text-xs text-muted-foreground">{intro}</p>
      <ul className="space-y-1 text-xs">
        {findings.map((f, i) => (
          <li key={`${f.label}-${f.phrase}-${i}`}>
            <span className="font-medium">{f.label}:</span> “{f.phrase}” — {f.reason}.
          </li>
        ))}
      </ul>
    </div>
  );
}

function SavedText({ value, optional }: { value?: string; optional?: boolean }) {
  const text = (value ?? "").trim();
  if (!text) {
    return (
      <p className="text-sm italic text-muted-foreground">
        {optional ? "Nothing added." : "Not written yet."}
      </p>
    );
  }
  return <p className="text-sm whitespace-pre-wrap leading-relaxed">{text}</p>;
}
