/**
 * EntityDetailLayout — Adaptive layout for Person and Partner entities.
 *
 * WHAT: Renders flat operational panels (richness 1) or tabbed narrative view (richness 3).
 * WHERE: PersonDetail, OpportunityDetail.
 * WHY: Unified entity architecture — same layout engine adapts to tenant orientation + per-entity overrides.
 */

import { ReactNode } from 'react';
import { useEntityRichness } from '@/hooks/useEntityRichness';
import { RichnessExplanation } from './RichnessExplanation';

interface Props {
  entityType: 'person' | 'partner';
  entityId: string;
  /** Flat mode content (richness 1) — existing panels */
  children: ReactNode;
  /** Tabbed mode content (richness 3) — only rendered when rich */
  tabbedContent?: ReactNode;
  /** Person name for banner display */
  entityName?: string;
}

export function EntityDetailLayout({ entityType, entityId, children, tabbedContent, entityName }: Props) {
  const { effectiveRichness } = useEntityRichness(entityType, entityId);

  return (
    <>
      {/* Richness explanation */}
      <div className="flex items-center justify-end gap-2 mb-2">
        <RichnessExplanation entityType={entityType} entityId={entityId} />
      </div>

      {effectiveRichness >= 3 && tabbedContent ? tabbedContent : children}
    </>
  );
}
