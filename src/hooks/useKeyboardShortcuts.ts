import { useEffect, useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGlobalModal } from '@/contexts/GlobalModalContext';

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const { openOpportunityModal, openContactModal } = useGlobalModal();
  const pendingKey = useRef<string | null>(null);
  const pendingTimeout = useRef<NodeJS.Timeout | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const clearPending = useCallback(() => {
    pendingKey.current = null;
    if (pendingTimeout.current) {
      clearTimeout(pendingTimeout.current);
      pendingTimeout.current = null;
    }
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || 
                    target.tagName === 'TEXTAREA' || 
                    target.isContentEditable ||
                    target.closest('[role="dialog"]') ||
                    target.closest('[cmdk-root]');
    
    if (isInput) return;

    const key = e.key.toLowerCase();

    // Single key shortcuts
    if (key === '?' || (e.shiftKey && key === '/')) {
      e.preventDefault();
      setShortcutsOpen((prev) => !prev);
      return;
    }

    // G + key sequences (no Ctrl/Cmd needed)
    if (pendingKey.current === 'g') {
      e.preventDefault();
      clearPending();
      
      switch (key) {
        case 'd':
          navigate('/');
          break;
        case 'o':
          navigate('/opportunities');
          break;
        case 'n':
          openOpportunityModal(null);
          break;
        case 'p':
          navigate('/pipeline');
          break;
        case 'e':
          navigate('/events');
          break;
        case 'c':
          navigate('/contacts');
          break;
        case 'k':
          openContactModal(null);
          break;
        case 'm':
          navigate('/metros');
          break;
        case 'a':
          navigate('/anchors');
          break;
        case 'r':
          navigate('/reports');
          break;
        case 's':
          navigate('/settings');
          break;
        case 'x': {
          // Toggle tenant-view banner visibility for screenshots
          const event = new CustomEvent('toggle-tenant-banner');
          window.dispatchEvent(event);
          break;
        }
      }
      return;
    }

    // Start G sequence
    if (key === 'g') {
      pendingKey.current = 'g';
      // Clear after 1 second if no follow-up key
      pendingTimeout.current = setTimeout(clearPending, 1000);
      return;
    }

  }, [navigate, clearPending, openOpportunityModal, openContactModal]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearPending();
    };
  }, [handleKeyDown, clearPending]);

  return { shortcutsOpen, setShortcutsOpen };
}
