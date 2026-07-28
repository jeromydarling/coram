/**
 * MigrationReviewPage — Steward reviews AI-proposed migration repairs.
 * WHERE: MACHINA zone (integration tooling).
 * WHY:   Nothing touches live records without an explicit human nod.
 */
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useTenant } from "@/contexts/TenantContext";
import {
  useMigrationReviewQueue,
  useReviewMigrationItem,
  type MigrationReviewItem,
} from "@/hooks/useMigrationReviewQueue";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, AlertCircle } from "lucide-react";

function ConfidencePill({ c }: { c: number | null }) {
  if (c == null) return <Badge variant="outline">no confidence</Badge>;
  const pct = Math.round(c * 100);
  const variant = c >= 0.7 ? "default" : c >= 0.4 ? "secondary" : "outline";
  return <Badge variant={variant}>{pct}% confidence</Badge>;
}

function ItemCard({ item }: { item: MigrationReviewItem }) {
  const review = useReviewMigrationItem();
  const decided = item.status === "approved" || item.status === "rejected";

  return (
    <Card className="border-border/60">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="capitalize">{item.target_entity}</Badge>
          <ConfidencePill c={item.ai_confidence} />
          {item.status === "unrescuable" && (
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="h-3 w-3" /> needs human eyes
            </Badge>
          )}
          {decided && <Badge variant="secondary" className="capitalize">{item.status}</Badge>}
        </div>
        <CardTitle className="text-base font-serif">{item.failure_reason}</CardTitle>
        {item.ai_reasoning && (
          <CardDescription className="italic">{item.ai_reasoning}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">From vendor</p>
            <pre className="overflow-x-auto rounded-md bg-muted/40 p-2 text-xs">
              {JSON.stringify(item.source_row, null, 2)}
            </pre>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Proposed repair</p>
            <pre className="overflow-x-auto rounded-md bg-muted/40 p-2 text-xs">
              {item.ai_proposed_payload
                ? JSON.stringify(item.ai_proposed_payload, null, 2)
                : "— no repair proposed —"}
            </pre>
          </div>
        </div>
        {!decided && item.ai_proposed_payload && (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => review.mutate({ id: item.id, decision: "approved" })}
              disabled={review.isPending}
              className="rounded-full"
            >
              <Check className="mr-1 h-3 w-3" /> Approve repair
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => review.mutate({ id: item.id, decision: "rejected" })}
              disabled={review.isPending}
              className="rounded-full"
            >
              <X className="mr-1 h-3 w-3" /> Set aside
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function MigrationReviewPage() {
  const { tenantId } = useTenant();
  const [params] = useSearchParams();
  const migrationId = params.get("migration_id") ?? undefined;
  const { data, isLoading } = useMigrationReviewQueue({ tenantId: tenantId ?? undefined, migrationId });

  const grouped = useMemo(() => {
    const pending = (data ?? []).filter((i) => i.status === "pending_review" || i.status === "auto_rescued_pending_review");
    const unrescuable = (data ?? []).filter((i) => i.status === "unrescuable");
    const decided = (data ?? []).filter((i) => i.status === "approved" || i.status === "rejected");
    return { pending, unrescuable, decided };
  }, [data]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="font-serif text-2xl">Migration review</h1>
        <p className="text-muted-foreground">
          When a row stumbles during import, the AI offers a careful repair.
          Nothing touches your records until you say yes.
        </p>
      </header>

      {isLoading && <p className="text-muted-foreground">Listening…</p>}

      {!isLoading && (data ?? []).length === 0 && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          Quiet. No migrations need your eyes right now.
        </CardContent></Card>
      )}

      {grouped.pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-serif text-lg">Waiting for you ({grouped.pending.length})</h2>
          {grouped.pending.map((i) => <ItemCard key={i.id} item={i} />)}
        </section>
      )}
      {grouped.unrescuable.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-serif text-lg">Needs human eyes ({grouped.unrescuable.length})</h2>
          {grouped.unrescuable.map((i) => <ItemCard key={i.id} item={i} />)}
        </section>
      )}
      {grouped.decided.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-serif text-lg text-muted-foreground">Already reviewed</h2>
          {grouped.decided.map((i) => <ItemCard key={i.id} item={i} />)}
        </section>
      )}
    </div>
  );
}
