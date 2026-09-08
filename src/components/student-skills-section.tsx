import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Lightbulb, Plus, Sparkles, Star, Target, X } from "lucide-react";
import {
  MAX_SKILLS_HAVE,
  MAX_SKILLS_LEARN,
  MAX_TOP_SKILLS,
  ROLE_SKILL_MAP,
  SKILL_CATEGORIES,
  STUDENT_SKILLS,
  roleMatches,
  skillLabel,
} from "@/lib/student-skills";

export type StudentSkillsValue = {
  skills_have: string[];
  skills_learn: string[];
  top_skills: string[];
  work_style: string;
};

type Props = {
  value: StudentSkillsValue;
  onChange: (value: StudentSkillsValue) => void;
};

function countClass(count: number, max: number) {
  return count >= max ? "text-emerald-700 font-medium" : "text-amber-700 font-medium";
}

function CountLabel({ count, max }: { count: number; max: number }) {
  return (
    <span className={`flex items-center gap-1 text-xs ${countClass(count, max)}`}>
      {count >= max && <Check className="h-3.5 w-3.5" />}
      {count}/{max}
    </span>
  );
}

export function StudentSkillsSection({ value, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [customSkill, setCustomSkill] = useState("");
  const [customTarget, setCustomTarget] = useState<"have" | "learn">("have");

  const selected = new Set([...value.skills_have, ...value.skills_learn]);
  const matches = roleMatches(value.skills_have, value.top_skills).slice(0, 3);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? STUDENT_SKILLS.filter((skill) => skill.label.toLowerCase().includes(q))
      : STUDENT_SKILLS;
  }, [query]);

  const choose = (id: string, target: "have" | "learn") => {
    const source = target === "have" ? value.skills_have : value.skills_learn;
    const max = target === "have" ? MAX_SKILLS_HAVE : MAX_SKILLS_LEARN;
    const exists = source.includes(id);
    if (!exists && source.length >= max) return;

    const nextHave =
      target === "have"
        ? exists
          ? value.skills_have.filter((skill) => skill !== id)
          : [...value.skills_have, id]
        : value.skills_have.filter((skill) => skill !== id);
    const nextLearn =
      target === "learn"
        ? exists
          ? value.skills_learn.filter((skill) => skill !== id)
          : [...value.skills_learn, id]
        : value.skills_learn.filter((skill) => skill !== id);
    onChange({
      ...value,
      skills_have: nextHave,
      skills_learn: nextLearn,
      top_skills: value.top_skills.filter((skill) => nextHave.includes(skill)),
    });
  };

  const toggleTop = (id: string) => {
    if (!value.skills_have.includes(id)) return;
    const exists = value.top_skills.includes(id);
    if (!exists && value.top_skills.length >= MAX_TOP_SKILLS) return;
    onChange({
      ...value,
      top_skills: exists
        ? value.top_skills.filter((skill) => skill !== id)
        : [...value.top_skills, id],
    });
  };

  const addCustom = () => {
    const clean = customSkill.trim().replace(/\s+/g, " ").slice(0, 50);
    if (!clean) return;
    const id = `custom:${clean}`;
    choose(id, customTarget);
    setCustomSkill("");
  };

  return (
    <section className="space-y-5 rounded-lg border border-border/60 bg-muted/15 p-4 sm:p-5">
      <div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-gold" />
          <h3 className="font-display text-xl">Skills & contribution profile</h3>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Help your teammates understand what you can contribute and what you hope to practice this
          semester. This is a conversation starter—not a résumé or a permanent job assignment.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <Label className="text-base">Choose {MAX_SKILLS_HAVE} skills you have</Label>
              <p className="text-xs text-muted-foreground">
                All {MAX_SKILLS_HAVE} are required; star your strongest {MAX_TOP_SKILLS}.
              </p>
            </div>
            <span className={`text-xs ${countClass(value.skills_have.length, MAX_SKILLS_HAVE)}`}>
              {value.skills_have.length}/{MAX_SKILLS_HAVE}
            </span>
          </div>
          <div className="min-h-12 rounded-md border border-border/60 bg-background p-2">
            {value.skills_have.length === 0 ? (
              <p className="px-1 py-2 text-xs text-muted-foreground">
                Select skills below to introduce what you bring to the team.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {value.skills_have.map((id) => (
                  <span
                    key={id}
                    className="inline-flex items-center rounded-full border bg-background text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => toggleTop(id)}
                      className="p-1.5"
                      aria-label={`${value.top_skills.includes(id) ? "Remove" : "Mark"} ${skillLabel(id)} as a strongest skill`}
                    >
                      <Star
                        className={`h-3.5 w-3.5 ${value.top_skills.includes(id) ? "fill-gold text-gold" : "text-muted-foreground"}`}
                      />
                    </button>
                    <span className="pr-1">{skillLabel(id)}</span>
                    <button
                      type="button"
                      onClick={() => choose(id, "have")}
                      className="p-1.5 text-muted-foreground hover:text-foreground"
                      aria-label={`Remove ${skillLabel(id)}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <Label className="text-base">
                Choose {MAX_SKILLS_LEARN} skills you want to learn
              </Label>
              <p className="text-xs text-muted-foreground">
                All {MAX_SKILLS_LEARN} growth goals are required.
              </p>
            </div>
            <span className={`text-xs ${countClass(value.skills_learn.length, MAX_SKILLS_LEARN)}`}>
              {value.skills_learn.length}/{MAX_SKILLS_LEARN}
            </span>
          </div>
          <div className="min-h-12 rounded-md border border-border/60 bg-background p-2">
            {value.skills_learn.length === 0 ? (
              <p className="px-1 py-2 text-xs text-muted-foreground">
                Choose skills you would like the project to help you practice.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {value.skills_learn.map((id) => (
                  <Badge key={id} variant="outline" className="gap-1 border-dashed py-1">
                    <Target className="h-3 w-3" />
                    {skillLabel(id)}
                    <button
                      type="button"
                      onClick={() => choose(id, "learn")}
                      aria-label={`Remove ${skillLabel(id)}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Label htmlFor="skill-search">Explore possible skills</Label>
          <Input
            id="skill-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search 40+ suggestions…"
            className="sm:max-w-xs"
          />
        </div>
        <div className="max-h-80 space-y-4 overflow-y-auto rounded-md border border-border/60 bg-background p-3">
          {SKILL_CATEGORIES.map((category) => {
            const skills = filtered.filter((skill) => skill.category === category);
            if (!skills.length) return null;
            return (
              <div key={category}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {category}
                </p>
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill) => {
                    const inHave = value.skills_have.includes(skill.id);
                    const inLearn = value.skills_learn.includes(skill.id);
                    return (
                      <div
                        key={skill.id}
                        className="inline-flex overflow-hidden rounded-full border border-border/70 text-xs"
                      >
                        <button
                          type="button"
                          onClick={() => choose(skill.id, "have")}
                          disabled={!inHave && value.skills_have.length >= MAX_SKILLS_HAVE}
                          className={`px-2.5 py-1.5 transition ${inHave ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted disabled:opacity-35"}`}
                        >
                          {skill.label}
                        </button>
                        {!inHave && (
                          <button
                            type="button"
                            onClick={() => choose(skill.id, "learn")}
                            disabled={!inLearn && value.skills_learn.length >= MAX_SKILLS_LEARN}
                            className={`border-l px-2 py-1.5 transition ${inLearn ? "bg-gold/20 text-foreground" : "bg-muted/30 text-muted-foreground hover:text-foreground disabled:opacity-35"}`}
                            aria-label={`${inLearn ? "Remove" : "Add"} ${skill.label} as a skill to develop`}
                          >
                            {inLearn ? "Learning" : "+ Learn"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No matching suggestions. Add your own below.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex rounded-md border border-border/60 p-1 text-xs">
          <button
            type="button"
            onClick={() => setCustomTarget("have")}
            className={`rounded px-2 py-1 ${customTarget === "have" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            I bring it
          </button>
          <button
            type="button"
            onClick={() => setCustomTarget("learn")}
            className={`rounded px-2 py-1 ${customTarget === "learn" ? "bg-gold/20" : "text-muted-foreground"}`}
          >
            I want to learn it
          </button>
        </div>
        <Input
          value={customSkill}
          onChange={(event) => setCustomSkill(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addCustom();
            }
          }}
          placeholder="Add a skill we missed"
          maxLength={50}
        />
        <Button type="button" variant="outline" onClick={addCustom} disabled={!customSkill.trim()}>
          <Plus className="mr-1 h-4 w-4" />
          Add
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="work-style">How I work best</Label>
        <Textarea
          id="work-style"
          value={value.work_style}
          onChange={(event) => onChange({ ...value, work_style: event.target.value.slice(0, 400) })}
          placeholder="Example: I’m good at organizing complicated projects and polishing written work. I appreciate clear deadlines, and I would like more practice presenting to clients."
          rows={3}
          maxLength={400}
        />
        <div className="text-right text-xs text-muted-foreground">
          {value.work_style.length}/400
        </div>
      </div>

      {matches.length > 0 && (
        <div className="rounded-md border border-gold/30 bg-gold/5 p-4">
          <div className="flex items-center gap-2 font-medium">
            <Lightbulb className="h-4 w-4 text-gold" />
            Roles worth discussing
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Suggestions are based on your selections. Your team still decides who serves in each
            role.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {matches.map((match) => (
              <div key={match.role} className="rounded-md bg-background p-3 shadow-sm">
                <div className="text-sm font-semibold">{match.role}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {ROLE_SKILL_MAP[match.role].description}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {match.matches.slice(0, 3).map((id) => (
                    <Badge key={id} variant="secondary" className="text-[10px]">
                      {skillLabel(id)}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
