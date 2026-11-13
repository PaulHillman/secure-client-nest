export type MissingTemplateTeam = { id: string; name: string; section: string | null; reason: string };
export type TemplateCoverage = { template_id: string; distributed: number; missing: MissingTemplateTeam[] };
export type TemplateDistribution = { checked_at: string; team_count: number; templates: TemplateCoverage[] };

export function templateCoverageComplete(distributed: number, teamCount: number): boolean {
  return teamCount > 0 && distributed === teamCount;
}