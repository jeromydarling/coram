import { useGlobalModal } from '@/contexts/GlobalModalContext';
import { OpportunityModal } from './OpportunityModal';
import { ContactModal } from './ContactModal';
import { MetroDetailModal } from './MetroDetailModal';
import { PendingCallModal } from './PendingCallModal';

/** Rendered once at App level so entity modals survive route changes. */
export function GlobalModals() {
  const {
    opportunityModalOpen,
    opportunityModalEntity,
    closeOpportunityModal,
    contactModalOpen,
    contactModalEntity,
    closeContactModal,
    metroModalOpen,
    metroModalEntity,
    closeMetroModal,
  } = useGlobalModal();

  return (
    <>
      <PendingCallModal />
      <OpportunityModal
        open={opportunityModalOpen}
        onOpenChange={(open) => { if (!open) closeOpportunityModal(); }}
        opportunity={opportunityModalEntity as any}
      />
      <ContactModal
        open={contactModalOpen}
        onOpenChange={(open) => { if (!open) closeContactModal(); }}
        contact={contactModalEntity as any}
      />
      <MetroDetailModal
        metro={metroModalEntity as any}
        open={metroModalOpen}
        onOpenChange={(open) => { if (!open) closeMetroModal(); }}
      />
    </>
  );
}
