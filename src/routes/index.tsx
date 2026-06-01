import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ClientVault — MGT 331 Team Workspace" },
      { name: "description", content: "Team workspace for MGT 331 student consulting teams." },
    ],
  }),
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/app/dashboard" /> : <Navigate to="/login" />;
}
