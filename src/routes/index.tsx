import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ClientVault — MGT 331 Team Workspace" },
      { name: "description", content: "Team workspace for MGT 331 student consulting teams." },
      { property: "og:title", content: "ClientVault — MGT 331 Team Workspace" },
      { property: "og:description", content: "Team workspace for MGT 331 student consulting teams." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/app/dashboard" /> : <Navigate to="/login" />;
}
