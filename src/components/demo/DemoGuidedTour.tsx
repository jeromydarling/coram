/**
 * DemoGuidedTour — Guided walkthrough for demo visitors.
 *
 * WHAT: Joyride-powered tour highlighting key CROS features.
 * WHERE: Activates once when demo mode starts on Command Center.
 * WHY: Prevents visitors from getting lost — guides them through the story.
 */

import { useState, useEffect, useCallback } from 'react';
import Joyride, { type Step, type CallBackProps, STATUS } from 'react-joyride';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { useLocation } from 'react-router-dom';

const TOUR_SEEN_KEY = 'cros_demo_tour_seen';

const TOUR_STEPS: Step[] = [
  {
    target: '[data-tour="weekly-snapshot"]',
    content: 'Your Weekly Snapshot shows the rhythm of community engagement — meetings, reflections, and relationship moments at a glance.',
    title: 'Weekly Snapshot',
    disableBeacon: true,
    placement: 'bottom',
  },
  {
    target: '[data-tour="stale-next-steps"]',
    content: 'CROS gently surfaces relationships that may need attention — no pressure, just awareness.',
    title: 'Gentle Nudges',
    placement: 'top',
  },
  {
    target: '[data-tour="leadership-brief"]',
    content: 'A narrative summary for leadership — written in human language, not metrics dashboards.',
    title: 'Leadership Brief',
    placement: 'left',
  },
  {
    target: '[data-tour="local-pulse-card"]',
    content: 'Local Pulse discovers relevant community events and articles in your metro — powered by NRI.',
    title: 'Local Pulse',
    placement: 'left',
  },
  {
    target: '[data-tour="focus-plan"]',
    content: 'Your weekly focus plan helps you be intentional about which relationships to nurture this week.',
    title: 'Weekly Focus',
    placement: 'left',
  },
];

export function DemoGuidedTour() {
  const { isDemoMode } = useDemoMode();
  const location = useLocation();
  const [run, setRun] = useState(false);

  useEffect(() => {
    if (!isDemoMode) return;

    // Only start tour on command center
    const isCommandCenter = location.pathname === '/' || location.pathname.endsWith('/');
    const hasSeen = sessionStorage.getItem(TOUR_SEEN_KEY);

    if (isCommandCenter && !hasSeen) {
      // Delay to let the page render
      const timer = setTimeout(() => setRun(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [isDemoMode, location.pathname]);

  const handleCallback = useCallback((data: CallBackProps) => {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      sessionStorage.setItem(TOUR_SEEN_KEY, 'true');
    }
  }, []);

  if (!isDemoMode) return null;

  return (
    <Joyride
      steps={TOUR_STEPS}
      run={run}
      continuous
      showSkipButton
      showProgress
      callback={handleCallback}
      styles={{
        options: {
          primaryColor: 'hsl(var(--primary))',
          zIndex: 10000,
          arrowColor: 'hsl(var(--card))',
          backgroundColor: 'hsl(var(--card))',
          textColor: 'hsl(var(--card-foreground))',
        },
        tooltipTitle: {
          fontSize: '1rem',
          fontWeight: 600,
        },
        tooltipContent: {
          fontSize: '0.875rem',
          lineHeight: 1.6,
        },
        buttonNext: {
          borderRadius: '9999px',
          padding: '8px 16px',
          fontSize: '0.8125rem',
        },
        buttonBack: {
          color: 'hsl(var(--muted-foreground))',
          fontSize: '0.8125rem',
        },
        buttonSkip: {
          color: 'hsl(var(--muted-foreground))',
          fontSize: '0.75rem',
        },
      }}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Got it!',
        next: 'Next',
        skip: 'Skip tour',
      }}
    />
  );
}
