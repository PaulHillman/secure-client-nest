import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/app/teams/$teamId")({
  head: () => ({ meta: [{ title: "Team — ClientVault" }] }),
  component: TeamDetail,
});

function TeamDetail() {
  const { teamId } = Route.useParams();
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link to="/app/teams" className="text-sm text-muted-foreground hover:text-foreground">← All teams</Link>
      <h1 className="font-display text-4xl mt-4">Team detail</h1>
      <p className="mt-2 text-sm text-muted-foreground">Team ID: <code>{teamId}</code></p>
      <p className="mt-6 text-muted-foreground">
        Members, company focus brief, group norms e-signing, and the file vault will live here.
      </p>
    </div>
  );
}
