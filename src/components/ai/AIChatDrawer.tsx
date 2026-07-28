/**
 * AIChatDrawer — Unified CROS Companion (NRI) panel.
 *
 * WHAT: Slide-out chat panel with full platform knowledge + action execution.
 * WHERE: Global — accessible from any page via the floating compass button.
 * WHY: Single smart assistant that can guide users AND do things for them.
 *      Always shows current compass posture in header.
 *
 * ACCESSIBILITY:
 *   - role="log" + aria-live on chat history for screen readers
 *   - Focus trap: Tab cycles within drawer when open
 *   - Arrow keys navigate nudge cards and quick prompts
 *   - Escape closes the drawer
 *   - a11y-mode sends simplified response flag to NRI
 *   - Voice input button is prominently labeled
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Send, Compass, RotateCcw, User, ArrowRight, Mic, MicOff, ExternalLink, LifeBuoy } from 'lucide-react';
import { useAIChatSession, useSendChatMessage, useClearChatSession } from '@/hooks/useAIChatSession';
import { usePendingBundleCount } from '@/hooks/useAIBundles';
import { useRecentActions, useCreateRecoveryTicket } from '@/hooks/useRecoveryIntelligence';
import { useCompassPosture } from '@/hooks/useCompassPosture';
import { TodaysMovementSection } from '@/components/compass/TodaysMovementSection';
import { ProvidenceSection } from '@/components/compass/ProvidenceSection';
import { CompassGuideCard } from '@/components/compass/CompassGuideCard';
import type { GuideEntry } from '@/content/compassGuide';
import { cn } from '@/lib/utils';

interface AIChatDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guideEntry?: GuideEntry | null;
  onDismissGuide?: () => void;
}

/** Parse "→ Go to: /path — Description" navigation hints from AI responses */
function parseNavigationHints(content: string): { path: string; label: string }[] {
  const hints: { path: string; label: string }[] = [];
  const regex = /→ Go to: (\/[^\s—]+)\s*—?\s*(.*)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    hints.push({ path: match[1].trim(), label: match[2]?.trim() || match[1] });
  }
  return hints;
}

/** Render message content with navigation links */
function MessageContent({ content, onNavigate }: { content: string; onNavigate: (path: string) => void }) {
  const hints = parseNavigationHints(content);
  const cleanContent = content.replace(/→ Go to: \/[^\n]+/g, '').trim();

  return (
    <div className="space-y-2">
      <p className="text-sm whitespace-pre-wrap">{cleanContent}</p>
      {hints.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {hints.map((hint, i) => (
            <button
              key={i}
              onClick={() => onNavigate(hint.path)}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
              {hint.label || hint.path}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const QUICK_PROMPTS = [
  'What can you do for me?',
  'What happened this week?',
  'Help me log a meeting',
  'Move a partner to a new stage',
  'Write a reflection about a partner',
  'Who haven\'t I spoken to recently?',
  'Add a volunteer',
  'I accidentally deleted something — help me restore it',
];

const FRESH_TENANT_PROMPTS = [
  'What can you do for me?',
  'Help me add my first partner organization',
  'Add a contact for someone I work with',
  'How do I set up my community?',
  'Log my first meeting or visit',
  'Add a volunteer to my team',
  'What should I do first?',
];

const GARDENER_QUICK_PROMPTS = [
  'How are my tenants doing overall?',
  'Which tenants need activation help?',
  'Summarize the playbooks for me',
  'What does the Knowledge Vault say about our mission?',
  'Show me tenant readiness scores',
  'What archetype is most common?',
];

/** Check if a11y mode is active */
function isA11yMode(): boolean {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('a11y-mode');
}

export function AIChatDrawer({ open, onOpenChange, guideEntry, onDismissGuide }: AIChatDrawerProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isOperatorRoute = location.pathname.startsWith('/operator');
  // Detect fresh tenant (no opportunities yet) to show onboarding prompts
  const { data: oppCount } = useQuery({
    queryKey: ['opp-count-for-prompts'],
    queryFn: async () => {
      const { count } = await supabase
        .from('opportunities')
        .select('id', { count: 'exact', head: true })
        .limit(1);
      return count ?? 0;
    },
    staleTime: 5 * 60_000,
    enabled: !isOperatorRoute,
  });

  const isFreshTenant = !isOperatorRoute && typeof oppCount === 'number' && oppCount === 0;

  const activePrompts = useMemo(
    () => isOperatorRoute
      ? GARDENER_QUICK_PROMPTS
      : isFreshTenant
        ? FRESH_TENANT_PROMPTS
        : QUICK_PROMPTS,
    [isOperatorRoute, isFreshTenant]
  );
  const [input, setInput] = useState('');
  const pendingBundleCount = usePendingBundleCount();
  const { data: recentActions } = useRecentActions();
  const createRecoveryTicket = useCreateRecoveryTicket();
  const { posture, label: postureLabel } = useCompassPosture();
  const [postureHighlight, setPostureHighlight] = useState(false);
  const prevPostureRef = useRef(posture);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const chatLogRef = useRef<HTMLDivElement>(null);
  const [srAnnouncement, setSrAnnouncement] = useState('');

  const { data: session, isLoading: sessionLoading } = useAIChatSession();
  const sendMessage = useSendChatMessage();
  const clearSession = useClearChatSession();

  const messages = session?.messages || [];

  // Announce new assistant messages to screen readers
  const lastMessageRef = useRef<string | null>(null);
  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role === 'assistant' && last.id !== lastMessageRef.current) {
      lastMessageRef.current = last.id;
      // Truncate for SR announcement — full content is in the log
      const preview = last.content.length > 200
        ? last.content.slice(0, 200) + '…'
        : last.content;
      setSrAnnouncement(`NRI says: ${preview}`);
    }
  }, [messages]);

  // Posture change breathing effect
  useEffect(() => {
    if (posture !== prevPostureRef.current) {
      prevPostureRef.current = posture;
      setPostureHighlight(true);
      const timer = setTimeout(() => setPostureHighlight(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [posture]);

  const handleNavigate = useCallback((path: string) => {
    onOpenChange(false);
    navigate(path);
  }, [navigate, onOpenChange]);

  // Handle mobile keyboard visibility
  useEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    if (!viewport) return;
    const handleResize = () => {
      const heightDiff = window.innerHeight - viewport.height;
      setKeyboardHeight(heightDiff > 50 ? heightDiff : 0);
    };
    viewport.addEventListener('resize', handleResize);
    viewport.addEventListener('scroll', handleResize);
    return () => {
      viewport.removeEventListener('resize', handleResize);
      viewport.removeEventListener('scroll', handleResize);
    };
  }, [open]);

  // Focus input when drawer opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, keyboardHeight]);

  const handleInputFocus = useCallback(() => {
    setTimeout(() => {
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 300);
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || sendMessage.isPending) return;
    const message = input.trim();
    setInput('');
    // Pass a11y mode flag
    const a11y = isA11yMode();
    await sendMessage.mutateAsync(a11y ? `[accessibility_mode]\n${message}` : message);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (e.key === 'Enter' && !e.shiftKey && !isTouchDevice) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleClear = () => {
    clearSession.mutate();
  };

  const supportsVoice = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const toggleListening = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      setSrAnnouncement('Voice input stopped.');
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    let finalTranscript = '';
    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interim = transcript;
        }
      }
      setInput(prev => {
        const base = finalTranscript || prev;
        return interim ? base + interim : base;
      });
    };
    recognition.onend = () => {
      setIsListening(false);
      if (finalTranscript) {
        setInput(finalTranscript);
        setSrAnnouncement(`Voice captured: ${finalTranscript}`);
      }
    };
    recognition.onerror = () => {
      setIsListening(false);
      setSrAnnouncement('Voice input failed. Please try again.');
    };
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setSrAnnouncement('Listening for your voice…');
  }, [isListening]);

  // Arrow key navigation for quick prompts
  const handleQuickPromptKeyDown = useCallback((e: React.KeyboardEvent, index: number, prompts: string[]) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      const next = (e.currentTarget.parentElement?.children[index + 1] as HTMLElement);
      next?.focus();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = (e.currentTarget.parentElement?.children[index - 1] as HTMLElement);
      prev?.focus();
    }
  }, []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:w-[420px] p-0 flex flex-col compass-drawer"
        style={{ paddingBottom: keyboardHeight > 0 ? keyboardHeight : undefined }}
        aria-label="CROS Companion — NRI Assistant"
      >
        {/* Screen reader live announcements */}
        <div
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {srAnnouncement}
        </div>

        <SheetHeader className="p-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
              <Compass className="h-5 w-5 text-primary" aria-hidden="true" />
              CROS Companion
            </SheetTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={clearSession.isPending || messages.length === 0}
              aria-label="Clear conversation history"
            >
              <RotateCcw className="h-4 w-4 mr-1" aria-hidden="true" />
              Clear
            </Button>
          </div>
          {/* Always-visible posture label */}
          <p
            className={cn(
              "text-xs text-muted-foreground italic transition-opacity",
              postureHighlight ? "posture-label-enter" : "posture-label-rest"
            )}
            aria-live="polite"
          >
            {postureLabel}
          </p>
        </SheetHeader>

        <ScrollArea ref={scrollRef} className="flex-1 p-4 min-h-0">
          <div className="space-y-4">
            {/* Orientation line — always visible at top */}
            <div className="pt-2 pb-1">
              <p
                className="text-sm text-foreground tracking-wide"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                Verso l'alto.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Here's what needs your attention today.
              </p>
            </div>

            {/* Contextual Guide Card for new users */}
            {guideEntry && onDismissGuide && (
              <CompassGuideCard guide={guideEntry} onDismissGuide={onDismissGuide} />
            )}
            {/* Today's Movement — unified nudge surface */}
            <TodaysMovementSection onClose={() => onOpenChange(false)} />
            <ProvidenceSection />

            {/* Chat history with semantic role=log */}
            <div
              ref={chatLogRef}
              role="log"
              aria-label="Conversation with NRI"
              aria-live="polite"
              aria-relevant="additions"
            >
              {sessionLoading ? (
                <>
                  <Skeleton className="h-16 w-3/4" aria-label="Loading conversation…" />
                  <Skeleton className="h-12 w-2/3 ml-auto" />
                </>
              ) : messages.length === 0 ? (
                <div className="space-y-4">
                  <div className="space-y-2" role="group" aria-label="Suggested prompts">
                    <p className="text-xs text-muted-foreground font-medium" id="quick-prompts-label">
                      {isOperatorRoute ? 'Gardener suggestions:' : 'Try asking:'}
                    </p>
                    {activePrompts.map((prompt, index) => (
                      <button
                        key={prompt}
                        onClick={() => {
                          setInput(prompt);
                          setTimeout(() => {
                            sendMessage.mutateAsync(isA11yMode() ? `[accessibility_mode]\n${prompt}` : prompt);
                          }, 50);
                        }}
                        onKeyDown={(e) => handleQuickPromptKeyDown(e, index, activePrompts)}
                        disabled={sendMessage.isPending}
                        className="w-full text-left p-2.5 rounded-lg border border-border hover:border-primary/30 hover:bg-muted/30 transition-colors text-sm text-foreground"
                        aria-label={`Ask NRI: ${prompt}`}
                      >
                        {prompt}
                        <ArrowRight className="inline h-3 w-3 ml-1 text-muted-foreground" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex gap-3 mb-4",
                      msg.role === 'user' ? "justify-end" : "justify-start"
                    )}
                    role="article"
                    aria-label={msg.role === 'user' ? 'You said' : 'NRI responded'}
                  >
                    {msg.role === 'assistant' && (
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0" aria-hidden="true">
                        <Compass className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "rounded-lg px-3 py-2 max-w-[80%]",
                        msg.role === 'user'
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      {msg.role === 'assistant' ? (
                        <MessageContent content={msg.content} onNavigate={handleNavigate} />
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                    {msg.role === 'user' && (
                      <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0" aria-hidden="true">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {sendMessage.isPending && (
              <div className="flex gap-3" role="status" aria-label="NRI is thinking…">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0" aria-hidden="true">
                  <Compass className="h-4 w-4 text-primary animate-pulse" />
                </div>
                <div className="bg-muted rounded-lg px-3 py-2">
                  <div className="flex gap-1" aria-hidden="true">
                    <div className="h-2 w-2 rounded-full bg-foreground/30 animate-bounce" />
                    <div className="h-2 w-2 rounded-full bg-foreground/30 animate-bounce [animation-delay:0.1s]" />
                    <div className="h-2 w-2 rounded-full bg-foreground/30 animate-bounce [animation-delay:0.2s]" />
                  </div>
                  <span className="sr-only">NRI is composing a response…</span>
                </div>
              </div>
            )}

            {pendingBundleCount > 0 && (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-primary/30 text-primary"
                  onClick={() => handleNavigate('/quick-add')}
                >
                  <Compass className="h-4 w-4" aria-hidden="true" />
                  Review {pendingBundleCount} suggestion{pendingBundleCount !== 1 ? 's' : ''}
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Button>
              </div>
            )}

            {/* Recovery context hint */}
            {recentActions && recentActions.length > 0 && messages.length > 0 && (
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs text-muted-foreground"
                  onClick={() => {
                    createRecoveryTicket.mutate({
                      subject: 'Emergency recovery request',
                      description: 'User requested recovery assistance from the CROS Companion.',
                      recentActions: recentActions.slice(0, 25),
                      currentRoute: location.pathname,
                    });
                  }}
                  disabled={createRecoveryTicket.isPending}
                >
                  <LifeBuoy className="h-3 w-3" aria-hidden="true" />
                  Open emergency recovery request
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>

        <form
          onSubmit={handleSubmit}
          className="p-4 border-t shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]"
          aria-label="Send a message to NRI"
        >
          <div className="flex gap-2">
            {supportsVoice && (
              <Button
                type="button"
                size="icon"
                variant={isListening ? "destructive" : "outline"}
                onClick={toggleListening}
                disabled={sendMessage.isPending}
                className="shrink-0"
                aria-label={isListening ? "Stop voice input" : "Start voice input — speak your message"}
                aria-pressed={isListening}
              >
                {isListening ? <MicOff className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
              </Button>
            )}
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={handleInputFocus}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? "Listening..." : "Ask me anything about CROS..."}
              disabled={sendMessage.isPending}
              className="flex-1 min-h-[44px] max-h-[120px] resize-none"
              rows={1}
              aria-label="Type your message to NRI"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || sendMessage.isPending}
              aria-label="Send message"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          {/* Voice input hint in a11y mode */}
          {supportsVoice && (
            <p className="text-xs text-muted-foreground mt-2 hidden a11y-voice-hint">
              Press the microphone button or use keyboard shortcut to speak your message instead of typing.
            </p>
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
}
