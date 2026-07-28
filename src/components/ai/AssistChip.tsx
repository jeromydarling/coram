/**
 * AssistChip — Gentle micro-prompt for human friction assistance.
 *
 * WHAT: A small, warm chip that appears after high-confidence friction signals.
 * WHERE: Bottom-right corner of actionable pages.
 * WHY: Gently offers help without interrupting workflow — never intrusive.
 */

import { useState, useEffect, useCallback } from 'react';
import { X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTestimoniumCapture } from '@/hooks/useTestimoniumCapture';
import { usePraeceptumUpdate } from '@/hooks/usePraeceptumUpdate';

interface AssistChipProps {
  /** The gentle message to display */
  message: string;
  /** Page context for telemetry */
  context: string;
  /** Unique prompt key for Praeceptum learning */
  promptKey?: string;
  /** Whether to show the chip */
  visible: boolean;
  /** Called when user interacts (opens assistant) */
  onAccept?: () => void;
  /** Called when user dismisses */
  onDismiss?: () => void;
  /** Auto-dismiss after ms (default 15000) */
  autoHideMs?: number;
}

export function AssistChip({
  message,
  context,
  promptKey,
  visible,
  onAccept,
  onDismiss,
  autoHideMs = 15_000,
}: AssistChipProps) {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { captureTestimonium } = useTestimoniumCapture();
  const { reportGuidanceEvent } = usePraeceptumUpdate();

  const resolvedPromptKey = promptKey || `assist_${context}`;

  useEffect(() => {
    if (visible && !dismissed) {
      // Slight delay for gentle appearance
      const timer = setTimeout(() => setShow(true), 800);
      return () => clearTimeout(timer);
    }
    setShow(false);
  }, [visible, dismissed]);

  // Auto-hide
  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(() => {
      setShow(false);
      setDismissed(true);
    }, autoHideMs);
    return () => clearTimeout(timer);
  }, [show, autoHideMs]);

  const handleAccept = useCallback(() => {
    try {
      captureTestimonium({
        sourceModule: 'local_pulse',
        eventKind: 'assistant_intervention',
        summary: `Assist chip accepted on ${context}`,
        metadata: { context, message, source: 'signum', prompt_key: resolvedPromptKey },
        weight: 3,
      });
      // Report to Praeceptum — non-blocking
      reportGuidanceEvent({
        promptKey: resolvedPromptKey,
        context,
        eventType: 'intervention',
      });
    } catch {
      // silent
    }
    setShow(false);
    setDismissed(true);
    onAccept?.();
  }, [captureTestimonium, reportGuidanceEvent, context, message, resolvedPromptKey, onAccept]);

  const handleDismiss = useCallback(() => {
    setShow(false);
    setDismissed(true);
    onDismiss?.();
  }, [onDismiss]);

  if (!show) return null;

  return (
    <div
      className={cn(
        'fixed bottom-20 right-4 z-40 max-w-xs',
        'animate-in fade-in slide-in-from-bottom-2 duration-500',
      )}
    >
      <div className="bg-card border border-border/60 rounded-xl shadow-lg p-3.5 flex items-start gap-3">
        <div className="p-1.5 rounded-lg bg-primary/10 shrink-0 mt-0.5">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground leading-relaxed font-serif">{message}</p>
          <button
            onClick={handleAccept}
            className="mt-2 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
          >
            Show me how →
          </button>
        </div>
        <button
          onClick={handleDismiss}
          className="shrink-0 p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
