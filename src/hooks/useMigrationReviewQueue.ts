/**
 * useMigrationReviewQueue — Fetch and act on AI-proposed migration repairs.
 *
 * WHAT: List pending AI rescue proposals + approve/reject mutations.
 * WHERE: Migration Review page (MACHINA zone) + MigrationAssistant panel.
 * WHY: Steward must explicitly approve every AI repair before commit —
 *      preserves "AI assists, never replaces" and the Confidence Ladder
 *      promise that nothing touches live records without a human nod.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";

export interface MigrationReviewItem {
  id: string;
  migration_id: string;
  tenant_id: string;
  integration_key: string;
  source_row: Record<string, unknown>;
  target_entity: string;
  failure_reason: string;
  ai_proposed_payload: Record<string, unknown> | null;
  ai_confidence: number | null;
  ai_reasoning: string | null;
  ai_error_kind: string | null;
  status:
    | "pending_review"
    | "approved"
    | "rejected"
    | "unrescuable"
    | "auto_rescued_pending_review";
  created_at: string;
  notification_sent_at: string | null;
}

export function useMigrationReviewQueue(opts: { tenantId?: string; migrationId?: string }) {
  return useQuery({
    queryKey: ["migration-review-queue", opts.tenantId ?? null, opts.migrationId ?? null],
    enabled: !!opts.tenantId,
    queryFn: async (): Promise<MigrationReviewItem[]> => {
      let q = supabase
        .from("migration_review_queue")
        .select("*")
        .eq("tenant_id", opts.tenantId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (opts.migrationId) q = q.eq("migration_id", opts.migrationId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as MigrationReviewItem[];
    },
  });
}

export function useReviewMigrationItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: string;
      decision: "approved" | "rejected";
    }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("migration_review_queue")
        .update({
          status: params.decision,
          reviewed_at: new Date().toISOString(),
          reviewed_by: userRes.user?.id ?? null,
        })
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["migration-review-queue"] });
      toast.success(vars.decision === "approved" ? "Repair approved" : "Proposal set aside");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
