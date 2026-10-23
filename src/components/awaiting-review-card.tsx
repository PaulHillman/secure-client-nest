import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchAwaitingReview } from "@/lib/awaiting-review";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Inbox } from "lucide-react";

/** Dashboard summary of everything waiting on the instructor. */
export function AwaitingReviewCard() {
  const { data } = useQuery({ queryKey: ["awaiting-review"], queryFn: fetchAwaitingReview });
  const total = data?.total ?? 0;
  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Inbox className="h-5 w-5 text-gold" />
          Awaiting your review
        </CardTitle>
        <span
          className={`font-display text-2xl ${total > 0 ? "text-destructive" : "text-muted-foreground"}`}
        >
          {total}
        </span>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Requirement submissions</span>
          <span>{data?.requirements.length ?? 0}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Manager submissions</span>
          <span>{data?.managers.length ?? 0}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Peer review decisions</span>
          <span>{data?.peerDecisions.length ?? 0}</span>
        </div>
        <Link to="/app/admin/awaiting-review" className="block pt-2 text-primary underline text-sm">
          Open the queue
        </Link>
      </CardContent>
    </Card>
  );
}
