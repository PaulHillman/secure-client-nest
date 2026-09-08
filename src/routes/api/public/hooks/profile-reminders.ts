import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/profile-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? request.headers.get("x-api-key");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!expected || apikey !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runProfileReminders } = await import("@/lib/profile-reminders.server");
        try {
          const result = await runProfileReminders(supabaseAdmin as any);
          return new Response(JSON.stringify({ success: true, ...result }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e: any) {
          console.error("[profile-reminders] failed:", e);
          return new Response(JSON.stringify({ success: false, error: e.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
