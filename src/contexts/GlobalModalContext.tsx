import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface EntityData {
  [key: string]: unknown;
}

interface GlobalModalState {
  opportunityModal: { open: boolean; entity: EntityData | null };
  contactModal: { open: boolean; entity: EntityData | null };
  metroModal: { open: boolean; entity: EntityData | null; mode: 'create' | 'edit' };
}

interface GlobalModalContextType {
  openOpportunityModal: (entity?: EntityData | null) => void;
  closeOpportunityModal: () => void;
  opportunityModalOpen: boolean;
  opportunityModalEntity: EntityData | null;

  openContactModal: (entity?: EntityData | null) => void;
  closeContactModal: () => void;
  contactModalOpen: boolean;
  contactModalEntity: EntityData | null;

  openMetroModal: (entity?: EntityData | null, mode?: 'create' | 'edit') => void;
  closeMetroModal: () => void;
  metroModalOpen: boolean;
  metroModalEntity: EntityData | null;
  metroModalMode: 'create' | 'edit';
}

const GlobalModalContext = createContext<GlobalModalContextType | undefined>(undefined);

export function GlobalModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GlobalModalState>({
    opportunityModal: { open: false, entity: null },
    contactModal: { open: false, entity: null },
    metroModal: { open: false, entity: null, mode: 'create' },
  });

  const openOpportunityModal = useCallback((entity?: EntityData | null) => {
    setState(prev => ({ ...prev, opportunityModal: { open: true, entity: entity ?? null } }));
  }, []);

  const closeOpportunityModal = useCallback(() => {
    setState(prev => ({ ...prev, opportunityModal: { open: false, entity: null } }));
  }, []);

  const openContactModal = useCallback((entity?: EntityData | null) => {
    setState(prev => ({ ...prev, contactModal: { open: true, entity: entity ?? null } }));
  }, []);

  const closeContactModal = useCallback(() => {
    setState(prev => ({ ...prev, contactModal: { open: false, entity: null } }));
  }, []);

  const openMetroModal = useCallback((entity?: EntityData | null, mode: 'create' | 'edit' = 'create') => {
    setState(prev => ({ ...prev, metroModal: { open: true, entity: entity ?? null, mode } }));
  }, []);

  const closeMetroModal = useCallback(() => {
    setState(prev => ({ ...prev, metroModal: { open: false, entity: null, mode: 'create' } }));
  }, []);

  return (
    <GlobalModalContext.Provider value={{
      openOpportunityModal,
      closeOpportunityModal,
      opportunityModalOpen: state.opportunityModal.open,
      opportunityModalEntity: state.opportunityModal.entity,
      openContactModal,
      closeContactModal,
      contactModalOpen: state.contactModal.open,
      contactModalEntity: state.contactModal.entity,
      openMetroModal,
      closeMetroModal,
      metroModalOpen: state.metroModal.open,
      metroModalEntity: state.metroModal.entity,
      metroModalMode: state.metroModal.mode,
    }}>
      {children}
    </GlobalModalContext.Provider>
  );
}

export function useGlobalModal() {
  const ctx = useContext(GlobalModalContext);
  if (!ctx) throw new Error('useGlobalModal must be used within GlobalModalProvider');
  return ctx;
}
