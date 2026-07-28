/**
 * OperatorTestimoniumPage — Witness console and narrative economy at operator level.
 */
import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { LivingSignalCard } from '@/components/living/LivingSignalCard';

const WitnessConsole = lazy(() => import('@/pages/admin/WitnessConsole'));

export default function OperatorTestimoniumPage() {
  return (
    <div className="space-y-4" data-testid="testimonium-root">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Testimonium</h1>
        <p className="text-sm text-muted-foreground">Witness console and narrative stewardship.</p>
      </div>
      <LivingSignalCard />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <WitnessConsole />
      </Suspense>
    </div>
  );
}
