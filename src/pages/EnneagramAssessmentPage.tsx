/**
 * Enneagram Assessment Page — Indoles Module
 *
 * WHAT: Standalone route wrapper for the Enneagram assessment.
 * WHERE: /:tenantSlug/assessment/enneagram
 * WHY: Provides entity context (profile vs contact) and handles result persistence.
 */

import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import EnneagramAssessment, { type EnneagramResult } from "@/components/indoles/EnneagramAssessment";

export default function EnneagramAssessmentPage() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { tenant } = useTenant();
  const { user } = useAuth();

  // Determine target: profile (self) or contact (facilitated)
  const entityType = searchParams.get("entity") || "profile";
  const entityId = searchParams.get("id") || user?.id;

  const handleComplete = async (result: EnneagramResult) => {
    if (!entityId) return;

    try {
      const table = entityType === "contact" ? "contacts" : entityType === "volunteer" ? "volunteers" : "profiles";

      const { error } = await supabase
        .from(table)
        .update({
          enneagram_type: result.enneagram_type,
          enneagram_wing: result.enneagram_wing,
          enneagram_confidence: result.enneagram_confidence,
          enneagram_scores: result.enneagram_scores,
          enneagram_source: result.enneagram_source,
        } as any)
        .eq("id", entityId);

      if (error) throw error;

      toast({
        title: t('enneagramAssessment.savedTitle'),
        description: t('enneagramAssessment.savedDesc', { type: result.enneagram_type, wing: result.enneagram_wing }),
      });

      // Navigate back
      if (entityType === "contact" && tenant?.slug) {
        navigate(`/${tenant.slug}/people/${entityId}`);
      } else if (entityType === "volunteer" && tenant?.slug) {
        navigate(`/${tenant.slug}/volunteers/${entityId}`);
      } else if (tenant?.slug) {
        navigate(`/${tenant.slug}/settings`);
      }
    } catch (err) {
      console.error("[indoles] save error:", err);
      toast({
        title: t('enneagramAssessment.errorTitle'),
        description: t('enneagramAssessment.errorDesc'),
        variant: "destructive",
      });
    }
  };

  const handleManualSelect = () => {
    if (tenant?.slug) {
      navigate(`/${tenant.slug}/settings`);
    }
  };

  return (
    <EnneagramAssessment
      onComplete={handleComplete}
      onManualSelect={handleManualSelect}
    />
  );
}
