import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/app/admin")({
  head: () => ({ meta: [{ title: "Admin — ClientVault" }] }),
  component: Admin,
});

function Admin() {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin) return <Navigate to="/app/dashboard" />;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="font-display text-4xl">Admin</h1>
      <p className="text-sm text-muted-foreground mt-1">Manage users, teams, and roster assignments.</p>
      <Card className="mt-6 border-dashed">
        <CardHeader><CardTitle className="font-display text-xl">Coming next</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          User list with role/section editing and team creation will live here.
        </CardContent>
      </Card>
    </div>
  );
}
