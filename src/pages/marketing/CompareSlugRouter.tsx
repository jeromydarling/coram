/**
 * CompareSlugRouter — Routes /compare/:slug to the correct comparison page.
 *
 * WHAT: Checks if slug matches a competitor comparison or archetype comparison.
 * WHERE: /compare/:slug
 * WHY: Unified routing for both competitor and archetype comparison content.
 */
import { useParams, Navigate } from 'react-router-dom';
import { competitorComparisons } from '@/content/competitorComparisons';
import { archetypeComparisons } from '@/content/archetypeComparisons';
import { lazy, Suspense } from 'react';

const CompareCompetitorPage = lazy(() => import('@/pages/marketing/CompareCompetitorPage'));
const CompareArchetypePage = lazy(() => import('@/pages/marketing/CompareArchetypePage'));

export default function CompareSlugRouter() {
  const { slug } = useParams<{ slug: string }>();

  const isCompetitor = competitorComparisons.some((c) => c.slug === slug);
  const isArchetype = archetypeComparisons.some((c) => c.slug === slug);

  if (isCompetitor) {
    return (
      <Suspense fallback={null}>
        <CompareCompetitorPage />
      </Suspense>
    );
  }

  if (isArchetype) {
    return (
      <Suspense fallback={null}>
        <CompareArchetypePage />
      </Suspense>
    );
  }

  return <Navigate to="/compare" replace />;
}
