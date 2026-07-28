import { createContext, useContext, useState, ReactNode } from 'react';

interface EmailInsightsPanelContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const EmailInsightsPanelContext = createContext<EmailInsightsPanelContextType | undefined>(undefined);

export function EmailInsightsPanelProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <EmailInsightsPanelContext.Provider value={{ isOpen, setIsOpen }}>
      {children}
    </EmailInsightsPanelContext.Provider>
  );
}

export function useEmailInsightsPanel() {
  const ctx = useContext(EmailInsightsPanelContext);
  if (!ctx) throw new Error('useEmailInsightsPanel must be used within EmailInsightsPanelProvider');
  return ctx;
}
