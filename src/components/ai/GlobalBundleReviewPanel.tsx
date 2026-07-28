import { BundleReviewPanel } from '@/components/ai/BundleReviewPanel';
import { useEmailInsightsPanel } from '@/contexts/EmailInsightsPanelContext';

/** Rendered once at App level so the sidebar survives route changes. */
export function GlobalBundleReviewPanel() {
  const { isOpen, setIsOpen } = useEmailInsightsPanel();
  return <BundleReviewPanel open={isOpen} onOpenChange={setIsOpen} />;
}
